<?php

namespace App\Services;

use App\Models\CartItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class OrderService
{
    private const ORDER_RELATIONS = ['items.variant.product.images'];

    public function __construct(
        private readonly CartService $cartService,
        private readonly ResendEmailService $resendEmailService,
    ) {}

    /**
     * Create an order from the user's current cart.
     */
    public function createFromCart(
        User $user,
        ?array $shippingAddress = null,
    ): Order {
        return DB::transaction(function () use ($user, $shippingAddress) {
            $cartItems = $this->cartService->getCart($user);

            if ($cartItems->isEmpty()) {
                throw new \InvalidArgumentException('Cart is empty');
            }

            $totals = $this->cartService->calculateTotals($user);

            $order = Order::create([
                'user_id' => $user->id,
                'order_number' => Order::generateOrderNumber(),
                'status' => 'pending',
                'payment_method' => 'cash_on_delivery',
                'subtotal' => $totals['subtotal'],
                'tax' => $totals['tax'],
                'shipping' => $totals['shipping'],
                'total' => $totals['total'],
                'shipping_address' => $shippingAddress,
                'paid_at' => null,
            ]);

            foreach ($cartItems as $cartItem) {
                $variant = $cartItem->variant;
                $product = $variant->product;

                OrderItem::create([
                    'order_id' => $order->id,
                    'variant_id' => $variant->id,
                    'product_name' => $product->name,
                    'variant_name' => $variant->name,
                    'unit_price' => $variant->price,
                    'quantity' => $cartItem->quantity,
                    'total' => $variant->price * $cartItem->quantity,
                ]);

                // Decrement stock
                $variant->decrement('stock_quantity', $cartItem->quantity);
            }

            // Clear the cart
            $this->cartService->clearCart($user);

            Log::info('Order created', [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'user_id' => $user->id,
            ]);

            return $order->load(self::ORDER_RELATIONS);
        });
    }

    /**
     * Update order status.
     */
    public function updateStatus(Order $order, string $status): Order
    {
        $previousStatus = (string) $order->status;
        $order->update(['status' => $status]);

        Log::info('Order status updated', [
            'order_id' => $order->id,
            'previous_status' => $previousStatus,
            'new_status' => $status,
        ]);

        $this->notifyUserAboutStatusChange($order, $previousStatus, $status);

        return $order;
    }

    private function notifyUserAboutStatusChange(Order $order, string $previousStatus, string $newStatus): void
    {
        $order->loadMissing('user');
        $user = $order->user;

        if (!$user?->email || !$user->order_updates) {
            return;
        }

        $subject = sprintf('Order %s is now %s', $order->order_number, $this->humanizeStatus($newStatus));
        $recipientName = $user->first_name ?: ($user->name ?: 'there');

        $body = sprintf(
            "Hi %s,\n\nYour order %s status changed from %s to %s.\n\nTotal: PHP %s\nPayment method: %s\n\nThank you for shopping with XETA.",
            $recipientName,
            $order->order_number,
            $this->humanizeStatus($previousStatus),
            $this->humanizeStatus($newStatus),
            number_format((float) $order->total, 2),
            $this->humanizeStatus($order->payment_method),
        );

        $this->resendEmailService->send($user->email, $subject, $body);
    }

    private function humanizeStatus(string $value): string
    {
        return ucfirst(str_replace('_', ' ', $value));
    }

    /**
     * Get paginated orders for a user.
     */
    public function getUserOrders(User $user, int $perPage = 10)
    {
        return $user->orders()
            ->with([
                ...self::ORDER_RELATIONS,
                'items.variant.product.reviews' => fn ($query) => $query->where('user_id', $user->id),
            ])
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    /**
     * Get all orders (admin), optionally filtered by status.
     */
    public function getAllOrders(?string $status = null, int $perPage = 20, bool $withArchived = false)
    {
        $query = Order::with(['user', ...self::ORDER_RELATIONS])->orderByDesc('created_at');

        if ($withArchived) {
            $query->withTrashed();
        }

        if ($status) {
            $query->where('status', $status);
        }

        return $query->paginate($perPage);
    }
}
