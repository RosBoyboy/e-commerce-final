<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use HasFactory;

    protected $fillable = ['customer_id', 'rider_id', 'picked_up_at', 'order_number', 'total_amount', 'status', 'payment_status', 'shipping_address', 'phone', 'received_by', 'received_at', 'customer_feedback', 'proof_of_delivery_image', 'proof_uploaded_at'];

    protected $casts = [
        'received_at' => 'datetime',
        'picked_up_at' => 'datetime',
        'proof_uploaded_at' => 'datetime',
    ];

    public function customer()
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function rider()
    {
        return $this->belongsTo(Rider::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }
}
