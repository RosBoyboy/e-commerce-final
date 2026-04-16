<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Rider;
use App\Services\OrderChatService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use DateTimeInterface;

class RiderOrderController extends Controller
{
    private function riderForUser(Request $request): ?Rider
    {
        $user = $request->user();
        if (!$user || !$user->hasRole('rider')) {
            return null;
        }

        return Rider::where('user_id', $user->id)->first();
    }

    private function ensureRider(Request $request): Rider
    {
        $rider = $this->riderForUser($request);
        if (!$rider) {
            abort(403, 'Rider profile not found.');
        }

        return $rider;
    }

    /**
     * Active deliveries (shipped) and recent completed for this rider.
     */
    public function orders(Request $request)
    {
        $rider = $this->ensureRider($request);

        $active = Order::with([
            'customer:id,name,email,phone',
            'items.product:id,name,image,slug,price',
        ])
            ->where('rider_id', $rider->id)
            ->where('status', 'shipped')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (Order $o) => $this->serializeOrderForRider($o));

        $recentDone = Order::with([
            'customer:id,name,email,phone',
            'items.product:id,name,image,slug,price',
        ])
            ->where('rider_id', $rider->id)
            ->where('status', 'delivered')
            ->orderByDesc('updated_at')
            ->limit(20)
            ->get()
            ->map(fn (Order $o) => $this->serializeOrderForRider($o));

        return response()->json([
            'active' => $active,
            'recent_delivered' => $recentDone,
        ], 200);
    }

    /**
     * Simple earnings-style stats (delivered counts / amounts).
     */
    public function stats(Request $request)
    {
        $rider = $this->ensureRider($request);
        $todayStart = now()->startOfDay();

        $deliveredToday = Order::where('rider_id', $rider->id)
            ->where('status', 'delivered')
            ->where('updated_at', '>=', $todayStart)
            ->count();

        $revenueToday = (float) Order::where('rider_id', $rider->id)
            ->where('status', 'delivered')
            ->where('updated_at', '>=', $todayStart)
            ->sum('total_amount');

        $deliveredWeek = Order::where('rider_id', $rider->id)
            ->where('status', 'delivered')
            ->where('updated_at', '>=', now()->subDays(7)->startOfDay())
            ->count();

        $activeCount = Order::where('rider_id', $rider->id)->where('status', 'shipped')->count();

        return response()->json([
            'stats' => [
                'active_deliveries' => $activeCount,
                'delivered_today' => $deliveredToday,
                'revenue_today' => round($revenueToday, 2),
                'delivered_last_7_days' => $deliveredWeek,
            ],
        ], 200);
    }

    /**
     * Rider marks assigned shipped order as delivered (only role that may set delivered).
     */
    public function markDelivered(Request $request, $id)
    {
        $rider = $this->ensureRider($request);

        $order = Order::where('id', $id)
            ->where('rider_id', $rider->id)
            ->where('status', 'shipped')
            ->firstOrFail();

        DB::transaction(function () use ($order) {
            $order->update([
                'status' => 'delivered',
                'payment_status' => 'paid',
            ]);
        });

        Rider::syncAvailability($rider->id);

        $order = $order->fresh(['customer:id,name,email,phone', 'items.product:id,name,image,slug,price,seller_id']);
        OrderChatService::sendSellerAutomatedMessage(
            $order,
            OrderChatService::bodyRiderDelivered($order),
            'delivered'
        );

        return response()->json([
            'message' => 'Order marked as completed.',
            'order' => $this->serializeOrderForRider($order),
        ], 200);
    }

    /**
     * Rider confirms they have picked up the parcel (out for delivery).
     */
    public function markPickedUp(Request $request, $id)
    {
        $rider = $this->ensureRider($request);

        $order = Order::where('id', $id)
            ->where('rider_id', $rider->id)
            ->where('status', 'shipped')
            ->firstOrFail();

        if ($order->picked_up_at) {
            return response()->json([
                'message' => 'Pickup was already recorded.',
                'order' => $this->serializeOrderForRider($order->load(['customer:id,name,email,phone', 'items.product:id,name,image,slug,price'])),
            ], 200);
        }

        $order->update(['picked_up_at' => now()]);
        $order->load(['customer:id,name,email,phone', 'items.product:id,name,image,slug,price']);

        return response()->json([
            'message' => 'Pickup recorded. You are out for delivery.',
            'order' => $this->serializeOrderForRider($order),
        ], 200);
    }

    /**
     * Current rider profile (vehicle + user).
     */
    public function profile(Request $request)
    {
        $rider = $this->ensureRider($request);
        $rider->load('user:id,name,email,phone');

        return response()->json([
            'rider' => [
                'id' => $rider->id,
                'phone' => $rider->phone,
                'vehicle_plate' => $rider->vehicle_plate,
                'address' => $rider->address,
                'status' => $rider->status,
                'name' => $rider->user ? $rider->user->name : null,
                'email' => $rider->user ? $rider->user->email : null,
            ],
        ], 200);
    }

    /**
     * Rider updates contact, vehicle, and base address (ride / dispatch info).
     */
    public function updateProfile(Request $request)
    {
        $rider = $this->ensureRider($request);
        $validated = $request->validate([
            'phone' => 'sometimes|nullable|string|max:32',
            'vehicle_plate' => 'sometimes|string|max:32',
            'address' => 'sometimes|nullable|string|max:2000',
        ]);

        if (array_key_exists('phone', $validated)) {
            $rider->phone = $validated['phone'];
        }
        if (array_key_exists('vehicle_plate', $validated)) {
            $rider->vehicle_plate = $validated['vehicle_plate'] !== '' ? $validated['vehicle_plate'] : $rider->vehicle_plate;
        }
        if (array_key_exists('address', $validated)) {
            $rider->address = $validated['address'];
        }
        $rider->save();
        $rider->load('user:id,name,email,phone');

        return response()->json([
            'message' => 'Profile updated.',
            'rider' => [
                'id' => $rider->id,
                'phone' => $rider->phone,
                'vehicle_plate' => $rider->vehicle_plate,
                'address' => $rider->address,
                'status' => $rider->status,
                'name' => $rider->user ? $rider->user->name : null,
                'email' => $rider->user ? $rider->user->email : null,
            ],
        ], 200);
    }

    /**
     * ISO8601 for JSON; accepts Carbon, DateTime, or DB string.
     */
    private function dateToIso($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if ($value instanceof DateTimeInterface) {
            return $value->format(DATE_ATOM);
        }

        return \Carbon\Carbon::parse($value)->toIso8601String();
    }

    private function serializeOrderForRider(Order $o): array
    {
        $o->loadMissing(['items.product:id,name,image,slug,price']);

        $items = $o->items->map(function ($it) {
            $qty = (int) $it->quantity;
            $price = (float) $it->price;

            return [
                'id' => $it->id,
                'quantity' => $qty,
                'price' => $price,
                'line_total' => round($price * $qty, 2),
                'product' => $it->product ? [
                    'id' => $it->product->id,
                    'name' => $it->product->name,
                    'image' => $it->product->image,
                ] : null,
            ];
        })->values()->all();

        return [
            'id' => $o->id,
            'order_number' => $o->order_number,
            'status' => $o->status,
            'total_amount' => (float) $o->total_amount,
            'shipping_address' => $o->shipping_address,
            'phone' => $o->phone,
            'customer' => $o->customer ? [
                'id' => $o->customer->id,
                'name' => $o->customer->name,
                'email' => $o->customer->email,
                'phone' => $o->customer->phone,
            ] : null,
            'items' => $items,
            'created_at' => $this->dateToIso($o->created_at),
            'updated_at' => $this->dateToIso($o->updated_at),
            'received_at' => $this->dateToIso($o->received_at),
            'picked_up_at' => $this->dateToIso($o->picked_up_at),
        ];
    }
}
