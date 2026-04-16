<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Services\OrderChatService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    /**
     * Get customer orders
     */
    public function customerOrders(Request $request)
    {
        $orders = Order::where('customer_id', $request->user()->id)
            ->with(['items.product', 'rider.user:id,name,email'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'orders' => $orders,
        ], 200);
    }

    /**
     * Get all orders (Admin)
     */
    public function index(Request $request)
    {
        $orders = Order::with('customer', 'items.product')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'orders' => $orders,
        ], 200);
    }

    /**
     * Store a new order
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'total_amount' => 'required|numeric|min:0',
            'shipping_address' => 'required|string',
            'phone' => 'required|string',
            'items' => 'required|array',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.price' => 'required|numeric|min:0',
        ]);

        $order = DB::transaction(function () use ($request, $validated) {
            $lineItems = [];

            foreach ($validated['items'] as $item) {
                $productId = (int) $item['product_id'];
                $qty = (int) $item['quantity'];
                $lineItems[$productId] = ($lineItems[$productId] ?? 0) + $qty;
            }

            $products = Product::whereIn('id', array_keys($lineItems))
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            foreach ($lineItems as $productId => $qty) {
                $product = $products->get($productId);
                if (!$product) {
                    abort(422, 'One or more products no longer exist.');
                }
                if (!$product->isVisibleOnStorefront()) {
                    abort(422, sprintf('Product "%s" is no longer available.', $product->name ?? 'Item'));
                }
                $available = $product->effectiveAvailableQuantity();
                if ($available < $qty) {
                    abort(422, sprintf(
                        'Insufficient stock for %s. Available: %d, requested: %d.',
                        $product->name ?? 'selected product',
                        $available,
                        $qty
                    ));
                }
            }

            $order = Order::create([
                'customer_id' => $request->user()->id,
                'order_number' => 'ORD-' . time(),
                'total_amount' => $validated['total_amount'],
                'shipping_address' => $validated['shipping_address'],
                'phone' => $validated['phone'],
                'status' => 'pending',
                'payment_status' => 'pending',
            ]);

            foreach ($validated['items'] as $item) {
                $product = $products->get((int) $item['product_id']);
                $qty = (int) $item['quantity'];

                $order->items()->create([
                    'product_id' => $product->id,
                    'quantity' => $qty,
                    // Use current DB price so payload can't tamper with price.
                    'price' => $product->price,
                ]);

                $product->decrement('stock', $qty);
            }

            return $order;
        });

        return response()->json([
            'message' => 'Order created successfully',
            'order' => $order->load('items.product'),
        ], 201);
    }

    /**
     * Customer cancels their own order (only if still pending/confirmed/processing).
     */
    public function updateStatus(Request $request, $id)
    {
        $order = Order::with(['customer:id,name,email', 'items.product:id,name,image,slug,seller_id'])
            ->where('customer_id', $request->user()->id)
            ->findOrFail($id);
        $validated = $request->validate([
            'status' => 'required|string|in:cancelled,delivered',
            'received_by' => 'nullable|string|max:255',
            'customer_feedback' => 'nullable|string|max:2000',
        ]);

        $status = strtolower($validated['status']);
        $current = strtolower($order->status ?? 'pending');

        // Customer can cancel pending pipeline orders, or confirm receipt after ship/delivery (rider sets delivered).
        if ($status === 'cancelled') {
            if (!in_array($current, ['pending', 'confirmed', 'processing'], true)) {
                return response()->json(['message' => 'Order can no longer be cancelled.'], 422);
            }
            DB::transaction(function () use ($order) {
                foreach ($order->items as $item) {
                    if ($item->product_id) {
                        Product::where('id', $item->product_id)->increment('stock', (int) ($item->quantity ?? 0));
                    }
                }
                $order->update(['status' => 'cancelled']);
            });
            return response()->json(['message' => 'Order cancelled.', 'order' => $order->fresh('items.product')], 200);
        }

        // Allow customer to confirm receipt while shipped, or when already delivered but not yet acknowledged.
        if (
            $status === 'delivered'
            && (
                $current === 'shipped'
                || ($current === 'delivered' && empty($order->received_by))
            )
        ) {
            $receivedBy = trim((string) ($validated['received_by'] ?? ''));
            $customerFeedback = trim((string) ($validated['customer_feedback'] ?? ''));

            // Send thank-you chat when confirming from shipped, OR when order was already "delivered"
            // (e.g. rider marked delivered first) but receipt was not yet acknowledged.
            $sendThankYouChat = ($current === 'shipped')
                || ($current === 'delivered' && empty($order->received_by));

            DB::transaction(function () use (
                $order,
                $request,
                $receivedBy,
                $customerFeedback,
                $sendThankYouChat
            ) {
                $order->update([
                    'status' => 'delivered',
                    'payment_status' => 'paid',
                    'received_by' => $receivedBy !== '' ? $receivedBy : ($request->user()->name ?? null),
                    'received_at' => now(),
                    'customer_feedback' => $customerFeedback !== '' ? $customerFeedback : null,
                ]);

                if (!$sendThankYouChat) {
                    return;
                }

                $order->loadMissing(['items.product', 'customer']);
                $body = OrderChatService::bodyCustomerReceiptThankYou($order);
                OrderChatService::sendSellerAutomatedMessage($order, $body, 'received');
            });

            return response()->json(['message' => 'Order receipt confirmed.', 'order' => $order->fresh('items.product')], 200);
        }

        return response()->json(['message' => 'Invalid status update.'], 422);
    }
}
