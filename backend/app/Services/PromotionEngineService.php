<?php

namespace App\Services;

use App\Models\CartItem;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Promotion;
use App\Models\PromotionRedemption;
use App\Models\User;
use Illuminate\Support\Collection;

class PromotionEngineService
{
    private ?Collection $activePromotions = null;

    /**
     * @var array<string, bool>
     */
    private array $firstOrderCache = [];

    /**
     * @var array<string, int>
     */
    private array $perUserUsageCache = [];

    public function getVariantPricing(
        ProductVariant $variant,
        int $quantity = 1,
        ?User $user = null,
    ): array {
        $safeQuantity = max(1, $quantity);
        $baseUnitPrice = round((float) $variant->price, 2);
        $lineSubtotal = round($baseUnitPrice * $safeQuantity, 2);

        if ($lineSubtotal <= 0) {
            return [
                'base_unit_price' => $baseUnitPrice,
                'unit_price' => $baseUnitPrice,
                'line_subtotal' => $lineSubtotal,
                'line_discount' => 0.0,
                'line_total' => $lineSubtotal,
                'discount_percentage' => 0,
                'applied_promotions' => [],
                'is_on_sale' => false,
            ];
        }

        $workingLineTotal = $lineSubtotal;
        $appliedPromotions = [];

        $eligiblePromotions = $this->getEligibleItemPromotions(
            $variant,
            $user,
            $lineSubtotal,
        );

        foreach ($eligiblePromotions as $promotion) {
            $discount = $this->calculateItemDiscount($promotion, $safeQuantity, $workingLineTotal);

            if ($discount <= 0) {
                continue;
            }

            $workingLineTotal = max(0, round($workingLineTotal - $discount, 2));

            $appliedPromotions[] = $this->formatAppliedPromotion($promotion, $discount, 'item');

            if (!$promotion->is_stackable) {
                break;
            }
        }

        $lineDiscount = round($lineSubtotal - $workingLineTotal, 2);
        $unitPrice = round($workingLineTotal / $safeQuantity, 2);
        $discountPercentage = $lineSubtotal > 0
            ? (int) round(($lineDiscount / $lineSubtotal) * 100)
            : 0;

        return [
            'base_unit_price' => $baseUnitPrice,
            'unit_price' => $unitPrice,
            'line_subtotal' => $lineSubtotal,
            'line_discount' => $lineDiscount,
            'line_total' => round($workingLineTotal, 2),
            'discount_percentage' => max(0, $discountPercentage),
            'applied_promotions' => $appliedPromotions,
            'is_on_sale' => $lineDiscount > 0,
        ];
    }

    /**
     * Calculate all pricing effects for cart totals with stacking rules.
     */
    public function calculateCart(User $user, Collection $cartItems): array
    {
        $itemBreakdown = [];
        $itemPromotionList = [];
        $subtotal = 0.0;
        $itemDiscountTotal = 0.0;
        $itemCount = 0;

        foreach ($cartItems as $item) {
            if (!$item instanceof CartItem || !$item->variant) {
                continue;
            }

            $quantity = max(1, (int) $item->quantity);
            $itemCount += $quantity;

            $pricing = $this->getVariantPricing(
                $item->variant,
                $quantity,
                $user,
            );

            $subtotal += $pricing['line_subtotal'];
            $itemDiscountTotal += $pricing['line_discount'];

            foreach ($pricing['applied_promotions'] as $promotionRow) {
                $itemPromotionList[] = $promotionRow;
            }

            $itemBreakdown[] = [
                'cart_item_id' => $item->id,
                'variant_id' => $item->variant_id,
                'product_id' => $item->variant->product_id,
                'quantity' => $quantity,
                ...$pricing,
            ];
        }

        $subtotal = round($subtotal, 2);
        $itemDiscountTotal = round($itemDiscountTotal, 2);
        $subtotalAfterItemDiscounts = max(0, round($subtotal - $itemDiscountTotal, 2));

        $orderLevel = $this->applyOrderPromotions(
            $user,
            collect($itemBreakdown),
            $subtotalAfterItemDiscounts,
        );

        $orderDiscountTotal = (float) $orderLevel['discount_total'];
        $subtotalAfterDiscounts = max(0, round($subtotalAfterItemDiscounts - $orderDiscountTotal, 2));

        $tax = 0.0;
        $shipping = $subtotalAfterDiscounts >= 100 ? 0.0 : 9.99;
        $discountTotal = round($itemDiscountTotal + $orderDiscountTotal, 2);
        $total = round($subtotalAfterDiscounts + $shipping + $tax, 2);

        return [
            'items' => $itemBreakdown,
            'totals' => [
                'subtotal' => $subtotal,
                'item_discount' => $itemDiscountTotal,
                'order_discount' => round($orderDiscountTotal, 2),
                'discount_total' => $discountTotal,
                'tax' => $tax,
                'shipping' => round($shipping, 2),
                'total' => $total,
                'item_count' => $itemCount,
            ],
            'applied_promotions' => [
                'items' => $itemPromotionList,
                'order' => $orderLevel['applied_promotions'],
            ],
        ];
    }

    public function getProductSaleSummary(Product $product): array
    {
        $variants = $product->relationLoaded('variants')
            ? $product->variants
            : $product->variants()->active()->where('condition', 'new')->get();

        if ($variants->isEmpty()) {
            return [
                'is_on_sale' => false,
                'label' => null,
                'discount_percentage' => 0,
                'ends_at' => null,
                'starts_at' => null,
            ];
        }

        $highestDiscount = 0;
        $startsAt = null;
        $endsAt = null;

        foreach ($variants as $variant) {
            $pricing = $this->getVariantPricing($variant);

            if (!$pricing['is_on_sale']) {
                continue;
            }

            $highestDiscount = max($highestDiscount, (int) ($pricing['discount_percentage'] ?? 0));

            foreach ($pricing['applied_promotions'] as $applied) {
                $promotionStart = $applied['starts_at'] ?? null;
                $promotionEnd = $applied['ends_at'] ?? null;

                if ($promotionStart && ($startsAt === null || $promotionStart < $startsAt)) {
                    $startsAt = $promotionStart;
                }

                if ($promotionEnd && ($endsAt === null || $promotionEnd > $endsAt)) {
                    $endsAt = $promotionEnd;
                }
            }
        }

        $isOnSale = $highestDiscount > 0;

        return [
            'is_on_sale' => $isOnSale,
            'label' => $isOnSale
                ? ($highestDiscount > 0 ? sprintf('%d%% OFF', $highestDiscount) : 'SALE')
                : null,
            'discount_percentage' => $highestDiscount,
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
        ];
    }

    /**
     * Persist usage counters and redemption audit rows after a successful order.
     */
    public function recordOrderPromotionUsage(User $user, Order $order): void
    {
        $breakdown = is_array($order->promotion_breakdown) ? $order->promotion_breakdown : [];
        $items = is_array($breakdown['items'] ?? null) ? $breakdown['items'] : [];
        $orderLevel = is_array($breakdown['order'] ?? null) ? $breakdown['order'] : [];

        $discountByPromotion = [];

        foreach (array_merge($items, $orderLevel) as $promotionRow) {
            $promotionId = (int) ($promotionRow['id'] ?? 0);

            if ($promotionId <= 0) {
                continue;
            }

            $discountByPromotion[$promotionId] = round(
                (float) ($discountByPromotion[$promotionId] ?? 0) + (float) ($promotionRow['discount_amount'] ?? 0),
                2,
            );
        }

        if (empty($discountByPromotion)) {
            return;
        }

        $promotions = Promotion::whereIn('id', array_keys($discountByPromotion))->get()->keyBy('id');

        foreach ($discountByPromotion as $promotionId => $discountAmount) {
            /** @var Promotion|null $promotion */
            $promotion = $promotions->get($promotionId);

            if (!$promotion || $discountAmount <= 0) {
                continue;
            }

            PromotionRedemption::create([
                'promotion_id' => $promotion->id,
                'user_id' => $user->id,
                'order_id' => $order->id,
                'code_used' => null,
                'discount_amount' => $discountAmount,
                'metadata' => [
                    'order_number' => $order->order_number,
                ],
            ]);

            $promotion->increment('usage_count');
        }
    }

    private function applyOrderPromotions(
        User $user,
        Collection $itemBreakdown,
        float $subtotalAfterItemDiscounts,
    ): array {
        $workingSubtotal = $subtotalAfterItemDiscounts;
        $applied = [];

        $promotions = $this->getActivePromotions()
            ->filter(function (Promotion $promotion) use ($user, $subtotalAfterItemDiscounts): bool {
                if ($promotion->scope !== Promotion::SCOPE_ORDER) {
                    return false;
                }

                if (!$this->isPromotionEligibleForUser($promotion, $user)) {
                    return false;
                }

                if (!$this->hasRemainingUsage($promotion, $user)) {
                    return false;
                }

                return $this->meetsMinimumPurchase($promotion, $subtotalAfterItemDiscounts);
            })
            ->values();

        foreach ($promotions as $promotion) {
            if (!$this->meetsMinimumPurchase($promotion, $workingSubtotal)) {
                continue;
            }

            $discount = $this->calculateOrderDiscount($promotion, $itemBreakdown, $workingSubtotal);

            if ($discount <= 0) {
                continue;
            }

            $workingSubtotal = max(0, round($workingSubtotal - $discount, 2));
            $applied[] = $this->formatAppliedPromotion($promotion, $discount, 'order');

            if (!$promotion->is_stackable) {
                break;
            }
        }

        return [
            'discount_total' => round($subtotalAfterItemDiscounts - $workingSubtotal, 2),
            'applied_promotions' => $applied,
        ];
    }

    private function calculateOrderDiscount(Promotion $promotion, Collection $itemBreakdown, float $workingSubtotal): float
    {
        if ($workingSubtotal <= 0) {
            return 0.0;
        }

        return match ($promotion->discount_type) {
            Promotion::DISCOUNT_PERCENTAGE => $this->calculatePercentageDiscount($workingSubtotal, (float) $promotion->value),
            Promotion::DISCOUNT_FIXED => min($workingSubtotal, max(0, (float) $promotion->value)),
            Promotion::DISCOUNT_BUNDLE => $this->calculateBundleDiscount($promotion, $itemBreakdown, $workingSubtotal),
            default => 0.0,
        };
    }

    private function calculateBundleDiscount(Promotion $promotion, Collection $itemBreakdown, float $workingSubtotal): float
    {
        $conditions = is_array($promotion->conditions) ? $promotion->conditions : [];

        $bundleProductIds = array_values(array_filter(array_map(
            'intval',
            $conditions['bundle_product_ids'] ?? [],
        )));

        if (empty($bundleProductIds)) {
            return 0.0;
        }

        $bundleQuantity = max(1, (int) ($conditions['bundle_quantity'] ?? 1));
        $bundlePrice = (float) ($promotion->bundle_price ?? ($conditions['bundle_price'] ?? 0));

        if ($bundlePrice <= 0) {
            return 0.0;
        }

        $bundleCountCandidates = [];
        $regularBundlePrice = 0.0;

        foreach ($bundleProductIds as $productId) {
            $matchingRows = $itemBreakdown->where('product_id', $productId)->values();
            $productQty = (int) $matchingRows->sum('quantity');

            if ($productQty < $bundleQuantity) {
                return 0.0;
            }

            $bundleCountCandidates[] = intdiv($productQty, $bundleQuantity);

            $unitPrice = (float) ($matchingRows->min('unit_price') ?? 0);
            $regularBundlePrice += $unitPrice * $bundleQuantity;
        }

        $bundleCount = min($bundleCountCandidates);

        if ($bundleCount <= 0 || $regularBundlePrice <= 0) {
            return 0.0;
        }

        $singleBundleDiscount = max(0, $regularBundlePrice - $bundlePrice);
        $totalDiscount = $singleBundleDiscount * $bundleCount;

        return min($workingSubtotal, round($totalDiscount, 2));
    }

    private function getEligibleItemPromotions(
        ProductVariant $variant,
        ?User $user,
        float $lineSubtotal,
    ): Collection {
        $variant->loadMissing('product:id,category_id');

        $variantId = (int) $variant->id;
        $productId = (int) $variant->product_id;
        $categoryId = (int) ($variant->product?->category_id ?? 0);

        return $this->getActivePromotions()
            ->filter(function (Promotion $promotion) use (
                $user,
                $lineSubtotal,
                $variantId,
                $productId,
                $categoryId,
            ): bool {
                if (!in_array($promotion->scope, [Promotion::SCOPE_PRODUCT, Promotion::SCOPE_CATEGORY], true)) {
                    return false;
                }

                if (!$this->isPromotionEligibleForUser($promotion, $user)) {
                    return false;
                }

                if (!$this->hasRemainingUsage($promotion, $user)) {
                    return false;
                }

                if (!$this->meetsMinimumPurchase($promotion, $lineSubtotal)) {
                    return false;
                }

                if ($promotion->scope === Promotion::SCOPE_PRODUCT) {
                    if (!$promotion->products->pluck('id')->contains($productId)) {
                        return false;
                    }

                    $variantIds = $this->extractVariantIds($promotion);

                    if (!empty($variantIds) && !in_array($variantId, $variantIds, true)) {
                        return false;
                    }

                    return true;
                }

                if ($promotion->scope === Promotion::SCOPE_CATEGORY) {
                    return $categoryId > 0 && $promotion->categories->pluck('id')->contains($categoryId);
                }

                return false;
            })
            ->values();
    }

    /**
     * @return array<int, int>
     */
    private function extractVariantIds(Promotion $promotion): array
    {
        $conditions = is_array($promotion->conditions) ? $promotion->conditions : [];

        return array_values(array_unique(array_filter(array_map(
            'intval',
            is_array($conditions['variant_ids'] ?? null) ? $conditions['variant_ids'] : [],
        ), fn ($id) => $id > 0)));
    }

    private function calculateItemDiscount(Promotion $promotion, int $quantity, float $workingLineTotal): float
    {
        if ($quantity <= 0 || $workingLineTotal <= 0) {
            return 0.0;
        }

        return match ($promotion->discount_type) {
            Promotion::DISCOUNT_PERCENTAGE => $this->calculatePercentageDiscount($workingLineTotal, (float) $promotion->value),
            Promotion::DISCOUNT_FIXED => min($workingLineTotal, max(0, (float) $promotion->value) * $quantity),
            Promotion::DISCOUNT_BOGO => $this->calculateBogoDiscount($promotion, $quantity, $workingLineTotal),
            default => 0.0,
        };
    }

    private function calculatePercentageDiscount(float $amount, float $percent): float
    {
        $safePercent = max(0, min(100, $percent));

        return round($amount * ($safePercent / 100), 2);
    }

    private function calculateBogoDiscount(Promotion $promotion, int $quantity, float $workingLineTotal): float
    {
        $buyQuantity = max(1, (int) ($promotion->buy_quantity ?? 0));
        $getQuantity = max(0, (int) ($promotion->get_quantity ?? 0));

        if ($getQuantity === 0) {
            return 0.0;
        }

        $setSize = $buyQuantity + $getQuantity;

        if ($setSize <= 0) {
            return 0.0;
        }

        $completedSets = intdiv($quantity, $setSize);
        $freeUnits = $completedSets * $getQuantity;

        if ($freeUnits <= 0) {
            return 0.0;
        }

        $unitPrice = $workingLineTotal / $quantity;

        return round(min($workingLineTotal, $unitPrice * $freeUnits), 2);
    }

    private function isPromotionEligibleForUser(Promotion $promotion, ?User $user): bool
    {
        if (!$promotion->first_order_only) {
            return true;
        }

        if (!$user) {
            return false;
        }

        return $this->isFirstOrderCustomer($user);
    }

    private function isFirstOrderCustomer(User $user): bool
    {
        $cacheKey = (string) $user->id;

        if (!array_key_exists($cacheKey, $this->firstOrderCache)) {
            $this->firstOrderCache[$cacheKey] = !$user->orders()
                ->where('status', '!=', 'cancelled')
                ->exists();
        }

        return $this->firstOrderCache[$cacheKey];
    }

    private function hasRemainingUsage(Promotion $promotion, ?User $user): bool
    {
        $usageLimit = $promotion->usage_limit !== null
            ? (int) $promotion->usage_limit
            : null;

        if ($usageLimit !== null && (int) $promotion->usage_count >= $usageLimit) {
            return false;
        }

        $perUserLimit = $promotion->usage_limit_per_user !== null
            ? (int) $promotion->usage_limit_per_user
            : null;

        if ($perUserLimit === null) {
            return true;
        }

        if (!$user) {
            return false;
        }

        $cacheKey = sprintf('%d:%d', $promotion->id, $user->id);

        if (!array_key_exists($cacheKey, $this->perUserUsageCache)) {
            $this->perUserUsageCache[$cacheKey] = PromotionRedemption::query()
                ->where('promotion_id', $promotion->id)
                ->where('user_id', $user->id)
                ->count();
        }

        return $this->perUserUsageCache[$cacheKey] < $perUserLimit;
    }

    private function meetsMinimumPurchase(Promotion $promotion, float $amount): bool
    {
        if ($promotion->min_purchase_amount === null) {
            return true;
        }

        return $amount >= (float) $promotion->min_purchase_amount;
    }

    private function getActivePromotions(): Collection
    {
        if ($this->activePromotions !== null) {
            return $this->activePromotions;
        }

        $this->activePromotions = Promotion::query()
            ->active()
            ->where('requires_code', false)
            ->with([
                'products:id',
                'categories:id',
            ])
            ->orderBy('priority')
            ->orderBy('id')
            ->get();

        return $this->activePromotions;
    }

    private function formatAppliedPromotion(Promotion $promotion, float $discountAmount, string $source): array
    {
        return [
            'id' => $promotion->id,
            'name' => $promotion->name,
            'code' => $promotion->code,
            'source' => $source,
            'scope' => $promotion->scope,
            'discount_type' => $promotion->discount_type,
            'discount_amount' => round($discountAmount, 2),
            'is_stackable' => (bool) $promotion->is_stackable,
            'priority' => (int) $promotion->priority,
            'starts_at' => $promotion->starts_at?->toISOString(),
            'ends_at' => $promotion->ends_at?->toISOString(),
        ];
    }
}
