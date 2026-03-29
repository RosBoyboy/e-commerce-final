<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Rider;
use Illuminate\Http\Request;

class SellerOrderController extends Controller
{
    /**
     * Get orders that contain the seller's products.
     */
    public function index(Request $request)
    {
        $sellerId = $request->user()->id;
        if (!$request->user()->hasRole('seller')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $orders = Order::with([
            'customer:id,name,email',
            'rider.user:id,name,email',
            'items' => function ($q) use ($sellerId) {
                $q->with('product:id,name,image,slug,seller_id')
                    ->whereHas('product', fn ($p) => $p->where('seller_id', $sellerId));
            },
        ])
            ->whereHas('items.product', fn ($q) => $q->where('seller_id', $sellerId))
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['orders' => $orders], 200);
    }

    /**
     * Seller marks order as shipped only. Delivered is set by the assigned rider.
     */
    public function updateStatus(Request $request, $id)
    {
        if (!$request->user()->hasRole('seller')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $sellerId = $request->user()->id;
        $order = Order::with(['customer:id,name,email', 'items.product:id,name,slug,image,seller_id'])
            ->whereHas('items.product', fn ($q) => $q->where('seller_id', $sellerId))
            ->findOrFail($id);
        $validated = $request->validate(['status' => 'required|string|in:shipped']);

        $status = strtolower($validated['status']);
        $current = strtolower($order->status ?? 'pending');

        if ($status === 'shipped') {
            // Allow marking as shipped from any non-final state.
            // Only block if already delivered or explicitly cancelled/completed.
            if (in_array($current, ['delivered', 'cancelled', 'completed'], true)) {
                return response()->json(['message' => 'Order is already completed and cannot be marked as shipped.'], 422);
            }

            // If it's already shipped, just return success without duplicating messages.
            if ($current !== 'shipped') {
                $order->update(['status' => 'shipped']);

                // Auto-chat: notify customer that order has been shipped
                $customer = $order->customer;
                $lineForSeller = $order->items->firstWhere(fn ($item) => optional($item->product)->seller_id === $sellerId) ?? $order->items->first();
                $product = optional($lineForSeller)->product;
                if ($customer && $product) {
                    $conversation = Conversation::firstOrCreate(
                        [
                            'seller_id' => $sellerId,
                            'customer_id' => $customer->id,
                        ],
                        ['product_id' => $product->id]
                    );
                    if (!$conversation->product_id && $product->id) {
                        $conversation->update(['product_id' => $product->id]);
                    }
                    Message::create([
                        'conversation_id' => $conversation->id,
                        'user_id' => $sellerId,
                        'body' => sprintf(
                            'Hi %s! Your order for %s has been shipped. You will receive your tracking number shortly. Stay stylish!',
                            $customer->name ?? 'there',
                            $product->name ?? 'your item'
                        ),
                    ]);
                }
            }
        }

        $fresh = $order->fresh(['items.product', 'rider.user']);
        if ($fresh->rider_id) {
            Rider::syncAvailability($fresh->rider_id);
        }

        return response()->json([
            'message' => 'Order status updated.',
            'order' => $fresh,
        ], 200);
    }

    /**
     * List riders for assignment dropdown (seller).
     */
    public function riders(Request $request)
    {
        if (!$request->user()->hasRole('seller')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $list = Rider::with('user:id,name')
            ->orderBy('id')
            ->get()
            ->map(fn (Rider $r) => [
                'id' => $r->id,
                'name' => $r->user ? $r->user->name : null,
                'phone' => $r->phone,
                'vehicle_plate' => $r->vehicle_plate,
                'status' => $r->status,
            ]);

        return response()->json(['riders' => $list], 200);
    }

    /**
     * Assign rider when order is shipped (seller's line items only).
     */
    public function assignRider(Request $request, $id)
    {
        if (!$request->user()->hasRole('seller')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $sellerId = $request->user()->id;
        $order = Order::whereHas('items.product', fn ($q) => $q->where('seller_id', $sellerId))
            ->findOrFail($id);

        if (strtolower($order->status ?? '') !== 'shipped') {
            return response()->json(['message' => 'Assign a rider only when the order is shipped.'], 422);
        }

        $validated = $request->validate([
            'rider_id' => 'required|exists:riders,id',
        ]);

        $prev = $order->rider_id;
        $order->update(['rider_id' => $validated['rider_id']]);
        Rider::syncAvailability($prev, (int) $validated['rider_id']);

        return response()->json([
            'message' => 'Rider assigned.',
            'order' => $order->fresh(['customer:id,name,email', 'items.product', 'rider.user:id,name,email']),
        ], 200);
    }
}
