<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $accessories = Category::updateOrCreate(
            ['slug' => 'accessories'],
            [
                'name' => 'Accessories',
                'description' => 'Desk and setup accessories that complete the workspace.',
                'sort_order' => 4,
            ],
        );

        $deskMat = Product::updateOrCreate(
            ['slug' => 'xeta-desk-mat'],
            [
                'category_id' => $accessories->id,
                'name' => 'XETA Desk Mat',
                'description' => 'Large low-friction desk mat with stitched edges and a muted retail finish.',
                'specs' => [
                    'size' => '900 x 400mm',
                    'surface' => 'Speed cloth',
                    'base' => 'Anti-slip rubber',
                ],
                'is_active' => true,
            ],
        );

        ProductVariant::updateOrCreate(
            ['sku' => 'XETA-DM-BLK'],
            [
                'product_id' => $deskMat->id,
                'name' => 'Desk Mat — Black',
                'price' => 1250,
                'stock_quantity' => 120,
                'condition' => 'new',
                'attributes' => ['color' => 'Black'],
                'is_active' => true,
            ],
        );

        ProductImage::updateOrCreate(
            [
                'product_id' => $deskMat->id,
                'sort_order' => 1,
            ],
            [
                'url' => '/images/products/desk-mat-black.svg',
                'product_id' => $deskMat->id,
                'alt_text' => 'XETA Desk Mat Black',
                'is_primary' => true,
            ],
        );

        $wristRest = Product::updateOrCreate(
            ['slug' => 'xeta-wrist-rest'],
            [
                'category_id' => $accessories->id,
                'name' => 'XETA Wrist Rest',
                'description' => 'Minimal wrist support designed to sit flush under compact keyboards.',
                'specs' => [
                    'material' => 'Memory foam core',
                    'cover' => 'Microfiber',
                    'size' => '75% / 60%',
                ],
                'is_active' => true,
            ],
        );

        ProductVariant::updateOrCreate(
            ['sku' => 'XETA-WR-GRY'],
            [
                'product_id' => $wristRest->id,
                'name' => 'Wrist Rest — Graphite',
                'price' => 950,
                'stock_quantity' => 90,
                'condition' => 'new',
                'attributes' => ['color' => 'Graphite'],
                'is_active' => true,
            ],
        );

        ProductImage::updateOrCreate(
            [
                'product_id' => $wristRest->id,
                'sort_order' => 1,
            ],
            [
                'url' => '/images/products/wrist-rest-graphite.svg',
                'product_id' => $wristRest->id,
                'alt_text' => 'XETA Wrist Rest Graphite',
                'is_primary' => true,
            ],
        );

        $coiledCable = Product::updateOrCreate(
            ['slug' => 'xeta-coiled-cable'],
            [
                'category_id' => $accessories->id,
                'name' => 'XETA Coiled Cable',
                'description' => 'Premium USB-C coiled cable to clean up the desk and frame the board.',
                'specs' => [
                    'connector' => 'USB-C',
                    'finish' => 'Braided',
                    'length' => '1.8m',
                ],
                'is_active' => true,
            ],
        );

        ProductVariant::updateOrCreate(
            ['sku' => 'XETA-CC-IVO'],
            [
                'product_id' => $coiledCable->id,
                'name' => 'Coiled Cable — Ivory',
                'price' => 1500,
                'stock_quantity' => 75,
                'condition' => 'new',
                'attributes' => ['color' => 'Ivory'],
                'is_active' => true,
            ],
        );

        ProductImage::updateOrCreate(
            [
                'product_id' => $coiledCable->id,
                'sort_order' => 1,
            ],
            [
                'url' => '/images/products/coiled-cable-ivory.svg',
                'product_id' => $coiledCable->id,
                'alt_text' => 'XETA Coiled Cable Ivory',
                'is_primary' => true,
            ],
        );
    }
}
