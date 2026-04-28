<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class AdminVariantImageUploadTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_update_variant_image_with_formdata_and_method_override()
    {
        // Create admin user
        $admin = User::factory()->create(['role' => 'admin']);

        // Create product and variant
        $product = Product::factory()->create();
        $variant = ProductVariant::factory()->create([
            'product_id' => $product->id,
            'attributes' => ['color_hex' => '#2563eb'],
        ]);

        // Create a fake image file
        $image = UploadedFile::fake()->image('test-variant.jpg', 200, 200);

        // Send FormData with _method=PUT override
        $response = $this->actingAs($admin)
            ->post(
                "/api/v1/admin/products/{$product->id}/variants/{$variant->id}",
                [
                    'name' => $variant->name,
                    'sku' => $variant->sku,
                    'price' => 999.99,
                    'stock_quantity' => 100,
                    'condition' => 'new',
                    'is_active' => true,
                    'attributes' => ['color_hex' => '#ef4444'],
                    'image' => $image,
                    '_method' => 'PUT',
                ],
                [
                    'Authorization' => 'Bearer test-token',
                ]
            );

        // Assert response is successful
        $response->assertStatus(200);
        $response->assertJsonPath('message', 'Variant updated');

        // Assert variant was actually updated
        $variant->refresh();
        $this->assertEquals(999.99, $variant->price);
        $this->assertEquals(100, $variant->stock_quantity);

        // Assert image URL is present in attributes
        $this->assertNotNull($variant->attributes['image_url'] ?? null);
        $this->assertStringContainsString('/storage/', $variant->attributes['image_url']);
    }
}
