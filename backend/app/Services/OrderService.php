<?php

namespace App\Services;

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
        private readonly PromotionEngineService $promotionEngineService,
        private readonly ProductService $productService,
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

            $cartCalculation = $this->cartService->calculateDetailedCart($user, $cartItems);
            $totals = $cartCalculation['totals'];
            $itemPricingByCartItemId = collect($cartCalculation['items'])->keyBy('cart_item_id');

            $order = Order::create([
                'user_id' => $user->id,
                'order_number' => Order::generateOrderNumber(),
                'status' => 'pending',
                'payment_method' => 'cash_on_delivery',
                'subtotal' => $totals['subtotal'],
                'discount_total' => $totals['discount_total'] ?? 0,
                'tax' => $totals['tax'],
                'shipping' => $totals['shipping'],
                'total' => $totals['total'],
                'shipping_address' => $shippingAddress,
                'promotion_breakdown' => [
                    'items' => $cartCalculation['applied_promotions']['items'] ?? [],
                    'order' => $cartCalculation['applied_promotions']['order'] ?? [],
                ],
                'paid_at' => null,
            ]);

            foreach ($cartItems as $cartItem) {
                $variant = $cartItem->variant;
                $product = $variant->product;
                $itemPricing = $itemPricingByCartItemId->get($cartItem->id, []);
                $quantity = (int) $cartItem->quantity;
                $baseUnitPrice = (float) ($itemPricing['base_unit_price'] ?? $variant->price);
                $unitPrice = (float) ($itemPricing['unit_price'] ?? $variant->price);
                $lineTotal = (float) ($itemPricing['line_total'] ?? ($unitPrice * $quantity));
                $lineDiscount = (float) ($itemPricing['line_discount'] ?? max(0, ($baseUnitPrice * $quantity) - $lineTotal));
                $appliedPromotions = is_array($itemPricing['applied_promotions'] ?? null)
                    ? $itemPricing['applied_promotions']
                    : [];

                OrderItem::create([
                    'order_id' => $order->id,
                    'variant_id' => $variant->id,
                    'product_name' => $product->name,
                    'variant_name' => $variant->name,
                    'base_unit_price' => $baseUnitPrice,
                    'unit_price' => $unitPrice,
                    'quantity' => $quantity,
                    'total' => $lineTotal,
                    'discount_total' => $lineDiscount,
                    'applied_promotions' => $appliedPromotions,
                ]);

                // Decrement stock
                $variant->decrement('stock_quantity', $quantity);
            }

            $this->promotionEngineService->recordOrderPromotionUsage($user, $order);

            // Clear the cart
            $this->cartService->clearCart($user);

            Log::info('Order created', [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'user_id' => $user->id,
            ]);

            $this->productService->invalidateCatalogCaches();

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

        return $order;
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
