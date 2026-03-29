<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('store_settings', function (Blueprint $table) {
            $table->id();
            $table->string('store_name')->default('urbanNxt');
            $table->string('support_email')->nullable();
            $table->text('description')->nullable();

            // Appearance
            $table->longText('logo_data_url')->nullable();
            $table->string('brand_primary')->default('#4f46e5');
            $table->string('brand_accent')->default('#2563eb');
            $table->string('banner_text')->nullable();
            $table->boolean('banner_enabled')->default(true);

            // Toggles
            $table->boolean('maintenance_mode')->default(false);
            $table->boolean('enable_coupons')->default(true);
            $table->boolean('enable_2fa')->default(false);

            // Notifications
            $table->boolean('email_on_new_order')->default(true);
            $table->boolean('sms_alerts')->default(false);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('store_settings');
    }
};

