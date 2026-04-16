<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Product extends Model
{
    use HasFactory;

    public const APPROVAL_PENDING = 'pending';

    public const APPROVAL_APPROVED = 'approved';

    public const APPROVAL_REJECTED = 'rejected';

    protected $fillable = [
        'name', 'slug', 'description', 'price', 'stock', 'image', 'category_id', 'seller_id',
        'is_active', 'is_archived', 'sizes', 'color', 'approval_status', 'sales_cap_quantity', 'sales_cap_period',
    ];

    protected $casts = [
        'sizes' => 'array',
        'is_archived' => 'boolean',
    ];

    /**
     * Units sold in the current calendar month or year (non-cancelled orders), for period caps.
     */
    public function unitsSoldInCurrentCapPeriod(): int
    {
        if (!$this->sales_cap_quantity || !$this->sales_cap_period) {
            return 0;
        }

        $q = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->where('order_items.product_id', $this->id)
            ->where('orders.status', '!=', 'cancelled');

        if ($this->sales_cap_period === 'month') {
            $q->whereYear('orders.created_at', now()->year)
                ->whereMonth('orders.created_at', now()->month);
        } elseif ($this->sales_cap_period === 'year') {
            $q->whereYear('orders.created_at', now()->year);
        } else {
            return 0;
        }

        return (int) $q->sum('order_items.quantity');
    }

    /**
     * How many units customers may still buy: min(physical stock, remaining period cap).
     */
    public function effectiveAvailableQuantity(): int
    {
        $physical = max(0, (int) $this->stock);

        if (!$this->sales_cap_quantity || !$this->sales_cap_period) {
            return $physical;
        }

        $sold = $this->unitsSoldInCurrentCapPeriod();
        $cap = max(0, (int) $this->sales_cap_quantity);
        $remainingInPeriod = max(0, $cap - $sold);

        return min($physical, $remainingInPeriod);
    }

    public function isVisibleOnStorefront(): bool
    {
        return !$this->is_archived
            && $this->is_active
            && $this->approval_status === self::APPROVAL_APPROVED;
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function seller()
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function cartItems()
    {
        return $this->hasMany(CartItem::class);
    }

    public function wishlists()
    {
        return $this->hasMany(Wishlist::class);
    }
}
