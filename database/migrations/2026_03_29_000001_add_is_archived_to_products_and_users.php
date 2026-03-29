<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('is_archived')->default(false)->after('is_active');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_archived')->default(false)->after('role_id');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('is_archived');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_archived');
        });
    }
};
