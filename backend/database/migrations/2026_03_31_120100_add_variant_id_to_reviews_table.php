<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('reviews', 'variant_id')) {
            Schema::table('reviews', function (Blueprint $table) {
                $table->foreignId('variant_id')
                    ->nullable()
                    ->after('product_id')
                    ->constrained('product_variants')
                    ->nullOnDelete();
            });

            // Backfill existing reviews from their associated order items.
            DB::table('reviews')
                ->orderBy('id')
                ->chunkById(200, function ($reviews): void {
                    foreach ($reviews as $review) {
                        $variantId = DB::table('order_items')
                            ->join('product_variants', 'product_variants.id', '=', 'order_items.variant_id')
                            ->where('order_items.order_id', $review->order_id)
                            ->where('product_variants.product_id', $review->product_id)
                            ->orderBy('order_items.id')
                            ->value('order_items.variant_id');

                        if ($variantId) {
                            DB::table('reviews')
                                ->where('id', $review->id)
                                ->update(['variant_id' => $variantId]);
                        }
                    }
                });
        }

        Schema::table('reviews', function (Blueprint $table) {
            // Check if we need to add a replacement index for user_id to satisfy FK constraint
            // before dropping the unique index that was previously covering it.
            $table->index('user_id');

            $table->dropUnique('reviews_user_id_product_id_order_id_unique');
            $table->unique(['user_id', 'variant_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->dropUnique('reviews_user_id_variant_id_unique');
            $table->unique(['user_id', 'product_id', 'order_id']);
            $table->dropConstrainedForeignId('variant_id');
        });
    }
};
