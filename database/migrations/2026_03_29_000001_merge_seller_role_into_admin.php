<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Seller dashboard is removed; all former seller accounts use the admin role for login and API access.
 * Product and conversation seller_id still reference these user rows as the store owner.
 */
return new class extends Migration
{
    public function up(): void
    {
        $seller = DB::table('roles')->where('name', 'seller')->first();
        $admin = DB::table('roles')->where('name', 'admin')->first();
        if ($seller && $admin) {
            DB::table('users')->where('role_id', $seller->id)->update(['role_id' => $admin->id]);
        }
    }

    public function down(): void
    {
        // Cannot safely restore which users were sellers without a backup column.
    }
};
