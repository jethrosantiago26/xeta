<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('discount_total', 10, 2)->default(0)->after('subtotal');
            $table->string('promo_code')->nullable()->after('payment_method');
            $table->json('promotion_breakdown')->nullable()->after('shipping_address');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->decimal('base_unit_price', 10, 2)->nullable()->after('variant_name');
            $table->decimal('discount_total', 10, 2)->default(0)->after('total');
            $table->json('applied_promotions')->nullable()->after('discount_total');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['base_unit_price', 'discount_total', 'applied_promotions']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['discount_total', 'promo_code', 'promotion_breakdown']);
        });
    }
};
