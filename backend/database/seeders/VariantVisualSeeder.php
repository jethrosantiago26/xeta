<?php

namespace Database\Seeders;

use App\Models\ProductVariant;
use App\Services\VariantVisualService;
use Illuminate\Database\Seeder;

class VariantVisualSeeder extends Seeder
{
    public function run(): void
    {
        $visualService = app(VariantVisualService::class);

        ProductVariant::query()
            ->with('product')
            ->lazyById(100)
            ->each(function (ProductVariant $variant) use ($visualService): void {
                if ($variant->product === null) {
                    return;
                }

                $attributes = $visualService->buildAttributes(
                    $variant->product,
                    [
                        'id' => $variant->id,
                        'name' => $variant->name,
                        'sku' => $variant->sku,
                        'attributes' => is_array($variant->attributes) ? $variant->attributes : [],
                    ],
                    $variant,
                );

                $variant->update([
                    'attributes' => $attributes,
                ]);
            });
    }
}
