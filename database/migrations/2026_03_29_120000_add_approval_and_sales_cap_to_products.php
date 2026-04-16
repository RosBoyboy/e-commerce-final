<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('approval_status', 32)->default('approved')->after('is_archived');
            $table->unsignedInteger('sales_cap_quantity')->nullable()->after('approval_status');
            $table->string('sales_cap_period', 16)->nullable()->after('sales_cap_quantity');
        });

        DB::table('products')->update(['approval_status' => 'approved']);
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['approval_status', 'sales_cap_quantity', 'sales_cap_period']);
        });
    }
};
