<?php

namespace Tests\Feature\Admin;

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\Review;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminArchiveGuardsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware();
    }

    public function test_order_force_delete_requires_archived_order(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $order = $this->createOrderForCustomer($customer);

        $this->deleteJson("/api/v1/admin/orders/{$order->id}/force")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Only archived orders can be permanently deleted. Archive this order first.');

        $this->assertDatabaseHas('orders', ['id' => $order->id]);

        $order->delete();

        $this->deleteJson("/api/v1/admin/orders/{$order->id}/force")
            ->assertOk()
            ->assertJsonPath('message', 'Order permanently deleted');

        $this->assertDatabaseMissing('orders', ['id' => $order->id]);
    }

    public function test_order_bulk_restore_rejects_mixed_archive_states(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $activeOrder = $this->createOrderForCustomer($customer);
        $archivedOrder = $this->createOrderForCustomer($customer);
        $archivedOrder->delete();

        $this->postJson('/api/v1/admin/orders/bulk', [
            'order_ids' => [$activeOrder->id, $archivedOrder->id],
            'action' => 'restore',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Please select archived orders only for restore or permanent delete actions.');

        $this->assertDatabaseHas('orders', ['id' => $activeOrder->id, 'deleted_at' => null]);
        $this->assertSoftDeleted('orders', ['id' => $archivedOrder->id]);
    }

    public function test_order_bulk_force_delete_rejects_mixed_archive_states(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $activeOrder = $this->createOrderForCustomer($customer);
        $archivedOrder = $this->createOrderForCustomer($customer);
        $archivedOrder->delete();

        $this->postJson('/api/v1/admin/orders/bulk', [
            'order_ids' => [$activeOrder->id, $archivedOrder->id],
            'action' => 'force_delete',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Please select archived orders only for restore or permanent delete actions.');

        $this->assertDatabaseHas('orders', ['id' => $activeOrder->id, 'deleted_at' => null]);
        $this->assertSoftDeleted('orders', ['id' => $archivedOrder->id]);
    }

    public function test_order_bulk_archive_rejects_archived_rows(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $activeOrder = $this->createOrderForCustomer($customer);
        $archivedOrder = $this->createOrderForCustomer($customer);
        $archivedOrder->delete();

        $this->postJson('/api/v1/admin/orders/bulk', [
            'order_ids' => [$activeOrder->id, $archivedOrder->id],
            'action' => 'archive',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Archive action only applies to active orders.');

        $this->assertDatabaseHas('orders', ['id' => $activeOrder->id, 'deleted_at' => null]);
        $this->assertSoftDeleted('orders', ['id' => $archivedOrder->id]);
    }

    public function test_customer_force_delete_requires_archived_customer(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);

        $this->deleteJson("/api/v1/admin/customers/{$customer->id}/force")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Only archived customers can be permanently deleted. Archive this customer first.');

        $this->assertDatabaseHas('users', ['id' => $customer->id]);

        $customer->delete();

        $this->deleteJson("/api/v1/admin/customers/{$customer->id}/force")
            ->assertOk()
            ->assertJsonPath('message', 'Customer permanently deleted');

        $this->assertDatabaseMissing('users', ['id' => $customer->id]);
    }

    public function test_review_force_delete_requires_archived_review(): void
    {
        $review = $this->createReview();

        $this->deleteJson("/api/v1/admin/reviews/{$review->id}/force")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Only archived reviews can be permanently deleted. Archive this review first.');

        $this->assertDatabaseHas('reviews', ['id' => $review->id]);

        $review->delete();

        $this->deleteJson("/api/v1/admin/reviews/{$review->id}/force")
            ->assertOk()
            ->assertJsonPath('message', 'Review permanently deleted');

        $this->assertDatabaseMissing('reviews', ['id' => $review->id]);
    }

    private function createOrderForCustomer(User $customer): Order
    {
        return Order::query()->create([
            'user_id' => $customer->id,
            'order_number' => 'XETA-TST-' . strtoupper(Str::random(6)),
            'status' => 'pending',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 100,
            'discount_total' => 0,
            'tax' => 0,
            'shipping' => 0,
            'total' => 100,
            'shipping_address' => [
                'name' => 'Test Customer',
                'address' => '123 Test Lane',
                'city' => 'Test City',
            ],
        ]);
    }

    private function createReview(): Review
    {
        $customer = User::factory()->create(['role' => 'customer']);

        $category = Category::query()->create([
            'name' => 'Peripherals',
            'slug' => 'peripherals-' . strtolower(Str::random(5)),
            'description' => 'Test category',
            'sort_order' => 0,
        ]);

        $product = Product::query()->create([
            'category_id' => $category->id,
            'name' => 'Mechanical Keyboard',
            'slug' => 'keyboard-' . strtolower(Str::random(6)),
            'description' => 'Test product',
            'is_active' => true,
        ]);

        $order = $this->createOrderForCustomer($customer);

        return Review::query()->create([
            'user_id' => $customer->id,
            'product_id' => $product->id,
            'order_id' => $order->id,
            'rating' => 5,
            'comment' => 'Great product',
            'is_approved' => false,
            'is_anonymous' => false,
        ]);
    }
}
