<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Rider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

        $active = Order::with(['customer:id,name,email,phone'])
            ->where('rider_id', $rider->id)
            ->where('status', 'shipped')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (Order $o) => $this->serializeOrderForRider($o));

        $recentDone = Order::with(['customer:id,name,email,phone'])
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

        $order->load(['customer:id,name,email,phone']);

        return response()->json([
            'message' => 'Order marked as delivered.',
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
                'status' => $rider->status, 
                'name' => $rider->user ? $rider->user->name : null,
                'email' => $rider->user ? $rider->user->email : null,
            ],
        ], 200);
    }

    private function serializeOrderForRider(Order $o): array
    {
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
            'updated_at' => $o->updated_at ? $o->updated_at->toIso8601String() : null,
        ];
    }
}
