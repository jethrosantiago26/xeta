<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        // ─── Categories ─────────────────────────────────────────
        $mice = Category::updateOrCreate([
            'slug' => 'mice',
        ], [
            'name' => 'Mice',
            'description' => 'Precision gaming mice engineered for speed and accuracy.',
            'sort_order' => 1,
        ]);

        $keyboards = Category::updateOrCreate([
            'slug' => 'keyboards',
        ], [
            'name' => 'Keyboards',
            'description' => 'Mechanical keyboards with cutting-edge switch technology.',
            'sort_order' => 2,
        ]);

        $mousepads = Category::updateOrCreate([
            'slug' => 'mousepads',
        ], [
            'name' => 'Mousepads',
            'description' => 'Premium control and speed surfaces for your setup.',
            'sort_order' => 3,
        ]);

        // ─── Mice Products ──────────────────────────────────────
        $f1v2 = Product::updateOrCreate([
            'slug' => 'xeta-f1-v2',
        ], [
            'category_id' => $mice->id,
            'name' => 'XETA F1 V2',
            'description' => 'Ultra-lightweight wireless gaming mouse with Hall Effect sensor. The F1 V2 features a 3950 DPI sensor, 55g weight, and 80-hour battery life.',
            'specs' => [
                'sensor' => 'PAW3950',
                'dpi' => '26000',
                'weight' => '55g',
                'battery' => '80 hours',
                'connectivity' => 'Wireless 2.4GHz / Bluetooth / USB-C',
                'switches' => 'Hall Effect',
                'shape' => 'Symmetrical',
            ],
            'is_active' => true,
        ]);

        ProductVariant::updateOrCreate([
            'sku' => 'XETA-F1V2-WHT',
        ], [
            'product_id' => $f1v2->id,
            'name' => 'F1 V2 — White',
            'price' => 89.99,
            'stock_quantity' => 50,
            'condition' => 'new',
            'attributes' => ['color' => 'White'],
        ]);

        ProductVariant::updateOrCreate([
            'sku' => 'XETA-F1V2-BLK',
        ], [
            'product_id' => $f1v2->id,
            'name' => 'F1 V2 — Black',
            'price' => 89.99,
            'stock_quantity' => 45,
            'condition' => 'new',
            'attributes' => ['color' => 'Black'],
        ]);

        ProductVariant::updateOrCreate([
            'sku' => 'XETA-F1V2-BLK-USED',
        ], [
            'product_id' => $f1v2->id,
            'name' => 'F1 V2 — Black (Used)',
            'price' => 59.99,
            'compare_at_price' => 89.99,
            'stock_quantity' => 5,
            'condition' => 'used',
            'attributes' => ['color' => 'Black', 'grade' => 'A — Like New'],
        ]);

        ProductImage::updateOrCreate([
            'product_id' => $f1v2->id,
            'sort_order' => 1,
        ], [
            'url' => '/images/products/f1v2-white.svg',
            'product_id' => $f1v2->id,
            'alt_text' => 'XETA F1 V2 White Gaming Mouse',
            'is_primary' => true,
        ]);

        // ─── X1 V2 Mouse ───────────────────────────────────────
        $x1v2 = Product::updateOrCreate([
            'slug' => 'xeta-x1-v2',
        ], [
            'category_id' => $mice->id,
            'name' => 'XETA X1 V2',
            'description' => 'Ergonomic wireless gaming mouse with Rapid Trigger support. Features a 3395 sensor, 62g weight, and 100-hour battery.',
            'specs' => [
                'sensor' => 'PAW3395',
                'dpi' => '26000',
                'weight' => '62g',
                'battery' => '100 hours',
                'connectivity' => 'Wireless 2.4GHz / USB-C',
                'switches' => 'Optical',
                'shape' => 'Ergonomic (Right-hand)',
            ],
            'is_active' => true,
        ]);

        ProductVariant::updateOrCreate([
            'sku' => 'XETA-X1V2-PHT',
        ], [
            'product_id' => $x1v2->id,
            'name' => 'X1 V2 — Phantom',
            'price' => 79.99,
            'stock_quantity' => 60,
            'condition' => 'new',
            'attributes' => ['color' => 'Phantom Gray'],
        ]);

        ProductVariant::updateOrCreate([
            'sku' => 'XETA-X1V2-ARC',
        ], [
            'product_id' => $x1v2->id,
            'name' => 'X1 V2 — Arctic',
            'price' => 79.99,
            'stock_quantity' => 40,
            'condition' => 'new',
            'attributes' => ['color' => 'Arctic White'],
        ]);

        ProductImage::updateOrCreate([
            'product_id' => $x1v2->id,
            'sort_order' => 1,
        ], [
            'url' => '/images/products/x1v2-phantom.svg',
            'product_id' => $x1v2->id,
            'alt_text' => 'XETA X1 V2 Phantom Gray Gaming Mouse',
            'is_primary' => true,
        ]);

        // ─── Keyboard Products ──────────────────────────────────
        $k1 = Product::updateOrCreate([
            'slug' => 'xeta-k1-pro',
        ], [
            'category_id' => $keyboards->id,
            'name' => 'XETA K1 Pro',
            'description' => 'Full-size hot-swappable mechanical keyboard with Rapid Trigger support and Hall Effect magnetic switches. Gasket mounted, south-facing LEDs.',
            'specs' => [
                'layout' => '75%',
                'switches' => 'Hall Effect Magnetic',
                'rapid_trigger' => true,
                'actuation' => '0.1mm — 4.0mm adjustable',
                'keycaps' => 'PBT Double-shot',
                'connectivity' => 'USB-C / Wireless 2.4GHz / Bluetooth',
                'battery' => '4000mAh',
                'mount' => 'Gasket',
            ],
            'is_active' => true,
        ]);

        ProductVariant::updateOrCreate([
            'sku' => 'XETA-K1P-CRB',
        ], [
            'product_id' => $k1->id,
            'name' => 'K1 Pro — Carbon',
            'price' => 149.99,
            'stock_quantity' => 30,
            'condition' => 'new',
            'attributes' => ['color' => 'Carbon Black'],
        ]);

        ProductVariant::updateOrCreate([
            'sku' => 'XETA-K1P-IVR',
        ], [
            'product_id' => $k1->id,
            'name' => 'K1 Pro — Ivory',
            'price' => 149.99,
            'stock_quantity' => 25,
            'condition' => 'new',
            'attributes' => ['color' => 'Ivory White'],
        ]);

        ProductVariant::updateOrCreate([
            'sku' => 'XETA-K1P-CRB-USED',
        ], [
            'product_id' => $k1->id,
            'name' => 'K1 Pro — Carbon (Used)',
            'price' => 109.99,
            'compare_at_price' => 149.99,
            'stock_quantity' => 3,
            'condition' => 'used',
            'attributes' => ['color' => 'Carbon Black', 'grade' => 'B — Good condition'],
        ]);

        ProductImage::updateOrCreate([
            'product_id' => $k1->id,
            'sort_order' => 1,
        ], [
            'url' => '/images/products/k1-pro-carbon.svg',
            'product_id' => $k1->id,
            'alt_text' => 'XETA K1 Pro Carbon Mechanical Keyboard',
            'is_primary' => true,
        ]);

        // ─── K1 Mini ────────────────────────────────────────────
        $k1mini = Product::updateOrCreate([
            'slug' => 'xeta-k1-mini',
        ], [
            'category_id' => $keyboards->id,
            'name' => 'XETA K1 Mini',
            'description' => '60% compact keyboard with the same Hall Effect technology as the K1 Pro in a smaller form factor.',
            'specs' => [
                'layout' => '60%',
                'switches' => 'Hall Effect Magnetic',
                'rapid_trigger' => true,
                'actuation' => '0.1mm — 4.0mm adjustable',
                'keycaps' => 'PBT Double-shot',
                'connectivity' => 'USB-C / Wireless 2.4GHz',
                'battery' => '3000mAh',
                'mount' => 'Gasket',
            ],
            'is_active' => true,
        ]);

        ProductVariant::updateOrCreate([
            'sku' => 'XETA-K1M-ONX',
        ], [
            'product_id' => $k1mini->id,
            'name' => 'K1 Mini — Onyx',
            'price' => 119.99,
            'stock_quantity' => 35,
            'condition' => 'new',
            'attributes' => ['color' => 'Onyx'],
        ]);

        ProductImage::updateOrCreate([
            'product_id' => $k1mini->id,
            'sort_order' => 1,
        ], [
            'url' => '/images/products/k1-mini-onyx.svg',
            'product_id' => $k1mini->id,
            'alt_text' => 'XETA K1 Mini Onyx Compact Keyboard',
            'is_primary' => true,
        ]);

        // ─── Mousepad Products ──────────────────────────────────
        $p1 = Product::updateOrCreate([
            'slug' => 'xeta-p1-control',
        ], [
            'category_id' => $mousepads->id,
            'name' => 'XETA P1 Control',
            'description' => 'Premium cloth mousepad optimized for control. Micro-textured surface provides consistent tracking with any sensor.',
            'specs' => [
                'surface' => 'Cloth — Control',
                'base' => 'Non-slip rubber',
                'thickness' => '4mm',
                'sizes' => ['M (360x300mm)', 'L (490x420mm)', 'XL (900x400mm)'],
                'edge' => 'Stitched',
            ],
            'is_active' => true,
        ]);

        ProductVariant::updateOrCreate([
            'sku' => 'XETA-P1C-M',
        ], [
            'product_id' => $p1->id,
            'name' => 'P1 Control — Medium',
            'price' => 24.99,
            'stock_quantity' => 100,
            'condition' => 'new',
            'attributes' => ['size' => 'M (360x300mm)'],
        ]);

        ProductVariant::updateOrCreate([
            'sku' => 'XETA-P1C-L',
        ], [
            'product_id' => $p1->id,
            'name' => 'P1 Control — Large',
            'price' => 34.99,
            'stock_quantity' => 80,
            'condition' => 'new',
            'attributes' => ['size' => 'L (490x420mm)'],
        ]);

        ProductVariant::updateOrCreate([
            'sku' => 'XETA-P1C-XL',
        ], [
            'product_id' => $p1->id,
            'name' => 'P1 Control — XL Desk Mat',
            'price' => 44.99,
            'stock_quantity' => 60,
            'condition' => 'new',
            'attributes' => ['size' => 'XL (900x400mm)'],
        ]);

        ProductImage::updateOrCreate([
            'product_id' => $p1->id,
            'sort_order' => 1,
        ], [
            'url' => '/images/products/p1-control.svg',
            'product_id' => $p1->id,
            'alt_text' => 'XETA P1 Control Mousepad',
            'is_primary' => true,
        ]);

        // ─── P1 Speed ───────────────────────────────────────────
        $p1speed = Product::updateOrCreate([
            'slug' => 'xeta-p1-speed',
        ], [
            'category_id' => $mousepads->id,
            'name' => 'XETA P1 Speed',
            'description' => 'Glass-coated hybrid mousepad for maximum speed. Ultra-low friction surface for swift, precise movements.',
            'specs' => [
                'surface' => 'Glass-coated hybrid',
                'base' => 'Non-slip rubber',
                'thickness' => '3mm',
                'sizes' => ['L (490x420mm)', 'XL (900x400mm)'],
                'edge' => 'Rounded',
            ],
            'is_active' => true,
        ]);

        ProductVariant::updateOrCreate([
            'sku' => 'XETA-P1S-L',
        ], [
            'product_id' => $p1speed->id,
            'name' => 'P1 Speed — Large',
            'price' => 49.99,
            'stock_quantity' => 40,
            'condition' => 'new',
            'attributes' => ['size' => 'L (490x420mm)'],
        ]);

        ProductVariant::updateOrCreate([
            'sku' => 'XETA-P1S-XL',
        ], [
            'product_id' => $p1speed->id,
            'name' => 'P1 Speed — XL',
            'price' => 64.99,
            'stock_quantity' => 30,
            'condition' => 'new',
            'attributes' => ['size' => 'XL (900x400mm)'],
        ]);

        ProductImage::updateOrCreate([
            'product_id' => $p1speed->id,
            'sort_order' => 1,
        ], [
            'url' => '/images/products/p1-speed.svg',
            'product_id' => $p1speed->id,
            'alt_text' => 'XETA P1 Speed Glass Mousepad',
            'is_primary' => true,
        ]);
    }
}
