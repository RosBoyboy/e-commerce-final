<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StoreSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'store_name',
        'support_email',
        'description',
        'logo_data_url',
        'brand_primary',
        'brand_accent',
        'banner_text',
        'banner_enabled',
        'maintenance_mode',
        'enable_coupons',
        'enable_2fa',
        'email_on_new_order',
        'sms_alerts',
    ];

    protected $casts = [
        'banner_enabled' => 'boolean',
        'maintenance_mode' => 'boolean',
        'enable_coupons' => 'boolean',
        'enable_2fa' => 'boolean',
        'email_on_new_order' => 'boolean',
        'sms_alerts' => 'boolean',
    ];
}

