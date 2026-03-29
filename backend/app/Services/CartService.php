<?php

namespace App\Services;

use App\Models\CartItem;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Support\Collection;

class CartService
{
    /**
     * Get all cart items for a user with loaded relationships.
     */
    public function getCart(User $user): Collection
    {
        return $user->cartItems()
            ->with(['variant.product.images' => fn ($q) => $q->where('is_primary', true)])
            ->get();
    }

    /**
     * Add a variant to the cart (or increment quantity if already present).
     */
    public function addItem(User $user, int $variantId, int $quantity = 1): CartItem
    {
        $variant = ProductVariant::where('is_active', true)->findOrFail($variantId);

        $cartItem = CartItem::where('user_id', $user->id)
            ->where('variant_id', $variantId)
            ->first();

        if ($cartItem) {
            $newQty = $cartItem->quantity + $quantity;
            $this->validateStock($variant, $newQty);
            $cartItem->update(['quantity' => $newQty]);
        } else {
            $this->validateStock($variant, $quantity);
            $cartItem = CartItem::create([
                'user_id' => $user->id,
                'variant_id' => $variantId,
                'quantity' => $quantity,
            ]);
        }

        return $cartItem->load('variant.product');
    }

    /**
     * Update the quantity of a cart item.
     */
    public function updateItem(User $user, int $cartItemId, int $quantity): CartItem
    {
        $cartItem = CartItem::where('user_id', $user->id)->findOrFail($cartItemId);
        $this->validateStock($cartItem->variant, $quantity);

        $cartItem->update(['quantity' => $quantity]);

        return $cartItem->load('variant.product');
    }

    /**
     * Remove an item from the cart.
     */
    public function removeItem(User $user, int $cartItemId): void
    {
        CartItem::where('user_id', $user->id)->findOrFail($cartItemId)->delete();
    }

    /**
     * Clear all cart items for a user.
     */
    public function clearCart(User $user): void
    {
        $user->cartItems()->delete();
    }

    /**
     * Merge guest cart items (from localStorage) into the user's server-side cart.
     */
    public function mergeCart(User $user, array $guestItems): void
    {
        foreach ($guestItems as $item) {
            $variantId = $item['variant_id'] ?? null;
            $quantity = $item['quantity'] ?? 1;

            if (!$variantId) {
                continue;
            }

            try {
                $this->addItem($user, $variantId, $quantity);
            } catch (\Exception $e) {
                // Skip items that can't be added (out of stock, inactive, etc.)
                continue;
            }
        }
    }

    /**
     * Calculate cart totals.
     */
    public function calculateTotals(User $user): array
    {
        $items = $this->getCart($user);

        $subtotal = $items->sum(fn (CartItem $item) => $item->variant->price * $item->quantity);
        $tax = round($subtotal * 0.08, 2); // 8% tax
        $shipping = $subtotal >= 100 ? 0 : 9.99; // Free shipping over $100

        return [
            'subtotal' => round($subtotal, 2),
            'tax' => $tax,
            'shipping' => $shipping,
            'total' => round($subtotal + $tax + $shipping, 2),
            'item_count' => $items->sum('quantity'),
        ];
    }

    private function validateStock(ProductVariant $variant, int $quantity): void
    {
        if ($variant->stock_quantity < $quantity) {
            throw new \InvalidArgumentException(
                "Insufficient stock for {$variant->name}. Available: {$variant->stock_quantity}"
            );
        }
    }
}
