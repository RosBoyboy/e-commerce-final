<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Rider extends Model
{
    protected $fillable = [
        'user_id',
        'phone',
        'vehicle_plate',
        'status',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    /**
     * Set each rider's status to busy if they have any shipped order, else available.
     */
    public static function syncAvailability(?int ...$ids): void
    {
        foreach (array_values(array_unique(array_filter($ids))) as $rid) {
            $r = self::find($rid);
            if (!$r) {
                continue;
            }
            $busy = Order::where('rider_id', $rid)->where('status', 'shipped')->exists();
            $r->update(['status' => $busy ? 'busy' : 'available']);
        }
    }
}
