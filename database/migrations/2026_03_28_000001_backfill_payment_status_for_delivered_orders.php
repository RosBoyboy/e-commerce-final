<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * COD: payment is collected when the order is delivered — align payment_status with reality.
     */
    public function up(): void
    {
        DB::table('orders')
            ->where('status', 'delivered')
            ->where('payment_status', 'pending')
            ->update(['payment_status' => 'paid']);
    }

    public function down(): void
    {
        // Cannot reliably reverse without knowing which were COD vs unpaid edge cases
    }
};
