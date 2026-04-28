<?php

namespace Tests\Feature\Admin;

use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminSupportTicketFiltersTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware();
    }

    public function test_admin_support_index_filters_by_status_list_and_search(): void
    {
        $customerOne = User::factory()->create([
            'role' => 'customer',
            'name' => 'Juan Dela Cruz',
            'email' => 'juan@example.test',
        ]);

        $customerTwo = User::factory()->create([
            'role' => 'customer',
            'name' => 'Maria Santos',
            'email' => 'maria@example.test',
        ]);

        $openTicket = $this->createTicket($customerOne, [
            'subject' => 'Keyboard firmware issue',
            'status' => 'open',
            'description' => 'Need assistance with firmware update.',
        ]);

        $this->createTicket($customerTwo, [
            'subject' => 'Shipping delay update',
            'status' => 'waiting_customer',
            'description' => 'Customer asked for courier update.',
        ]);

        $this->createTicket($customerTwo, [
            'subject' => 'Resolved billing concern',
            'status' => 'resolved',
            'description' => 'Issue already settled.',
        ]);

        $response = $this->getJson('/api/v1/admin/support/tickets?status=open,waiting_customer&search=firmware');

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $openTicket->id)
            ->assertJsonPath('status_counts.active', 2)
            ->assertJsonPath('status_counts.waiting', 1)
            ->assertJsonPath('status_counts.resolved', 1);
    }

    public function test_admin_support_index_returns_empty_for_invalid_status_filter(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $this->createTicket($customer, [
            'subject' => 'Mouse switch issue',
            'status' => 'open',
            'description' => 'Double click issue',
        ]);

        $this->getJson('/api/v1/admin/support/tickets?status=invalid_status')
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('status_counts.active', 1)
            ->assertJsonPath('status_counts.waiting', 0)
            ->assertJsonPath('status_counts.resolved', 0);
    }

    private function createTicket(User $customer, array $overrides = []): SupportTicket
    {
        return SupportTicket::query()->create(array_merge([
            'user_id' => $customer->id,
            'ticket_number' => 'SUP-' . strtoupper(Str::random(8)),
            'subject' => 'General support request',
            'type' => 'other',
            'status' => 'open',
            'channel' => 'web',
            'description' => 'Default ticket description',
        ], $overrides));
    }
}
