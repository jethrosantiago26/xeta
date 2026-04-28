<?php

namespace App\Services;

use App\Models\Promotion;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PromotionService
{
    private const PROMOTION_FIELDS = [
        'name',
        'code',
        'description',
        'discount_type',
        'scope',
        'value',
        'buy_quantity',
        'get_quantity',
        'bundle_price',
        'min_purchase_amount',
        'first_order_only',
        'requires_code',
        'is_stackable',
        'priority',
        'starts_at',
        'ends_at',
        'usage_limit',
        'usage_limit_per_user',
        'conditions',
        'is_active',
    ];

    public function __construct(
        private readonly ProductService $productService,
    ) {
    }

    public function paginateForAdmin(int $perPage = 20, bool $activeOnly = false): LengthAwarePaginator
    {
        $query = Promotion::query()
            ->with(['products:id', 'categories:id', 'creator:id,name,email'])
            ->orderBy('priority')
            ->orderByDesc('created_at');

        if ($activeOnly) {
            $query->active();
        }

        return $query->paginate($perPage);
    }

    public function create(array $payload, User $creator): Promotion
    {
        $normalized = $this->normalizePayload($payload);
        $this->validateNoConflicts($normalized);

        $promotion = DB::transaction(function () use ($normalized, $creator) {
            $promotion = Promotion::create([
                ...$this->extractPromotionAttributes($normalized),
                'created_by_user_id' => $creator->id,
            ]);

            $this->syncTargets($promotion, $normalized);

            return $promotion;
        });

        $this->invalidateCatalogCaches();

        return $promotion->load(['products:id', 'categories:id', 'creator:id,name,email']);
    }

    public function update(Promotion $promotion, array $payload): Promotion
    {
        $prospective = array_merge(
            $promotion->only(self::PROMOTION_FIELDS),
            $payload,
            [
                'product_ids' => array_key_exists('product_ids', $payload)
                    ? $payload['product_ids']
                    : $promotion->products()->pluck('products.id')->all(),
                'category_ids' => array_key_exists('category_ids', $payload)
                    ? $payload['category_ids']
                    : $promotion->categories()->pluck('categories.id')->all(),
            ],
        );

        $normalizedProspective = $this->normalizePayload($prospective);
        $this->validateNoConflicts($normalizedProspective, $promotion);

        $normalizedUpdate = $this->normalizePayload($payload);

        DB::transaction(function () use ($promotion, $normalizedUpdate) {
            $attributes = $this->extractPromotionAttributes($normalizedUpdate);

            if (!empty($attributes)) {
                $promotion->update($attributes);
            }

            $this->syncTargets($promotion, $normalizedUpdate);
        });

        $this->invalidateCatalogCaches();

        return $promotion->fresh(['products:id', 'categories:id', 'creator:id,name,email']);
    }

    public function destroy(Promotion $promotion): void
    {
        $promotion->delete();
        $this->invalidateCatalogCaches();
    }

    public function setActive(Promotion $promotion, bool $isActive): Promotion
    {
        $updated = $this->update($promotion, ['is_active' => $isActive]);

        return $updated;
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function validateNoConflicts(array $payload, ?Promotion $ignore = null): void
    {
        $code = $payload['code'] ?? null;

        if ($code) {
            $codeConflict = Promotion::query()
                ->when($ignore, fn (Builder $query) => $query->where('id', '!=', $ignore->id))
                ->whereRaw('LOWER(code) = ?', [Str::lower((string) $code)])
                ->exists();

            if ($codeConflict) {
                throw ValidationException::withMessages([
                    'code' => ['Another promotion already uses this promo code.'],
                ]);
            }
        }

        if (!(bool) ($payload['is_active'] ?? true)) {
            return;
        }

        $isStackable = (bool) ($payload['is_stackable'] ?? false);
        if ($isStackable) {
            return;
        }

        $scope = (string) ($payload['scope'] ?? Promotion::SCOPE_ORDER);
        $startsAt = $payload['starts_at'] ?? null;
        $endsAt = $payload['ends_at'] ?? null;

        $query = Promotion::query()
            ->where('is_active', true)
            ->where('is_stackable', false)
            ->where('scope', $scope)
            ->when($ignore, fn (Builder $builder) => $builder->where('id', '!=', $ignore->id));

        if ($endsAt) {
            $query->where(function (Builder $builder) use ($endsAt): void {
                $builder->whereNull('starts_at')->orWhere('starts_at', '<=', $endsAt);
            });
        }

        if ($startsAt) {
            $query->where(function (Builder $builder) use ($startsAt): void {
                $builder->whereNull('ends_at')->orWhere('ends_at', '>=', $startsAt);
            });
        }

        if ($scope === Promotion::SCOPE_PRODUCT) {
            $productIds = array_values(array_unique(array_map('intval', $payload['product_ids'] ?? [])));

            if (!empty($productIds)) {
                $query->where(function (Builder $builder) use ($productIds): void {
                    $builder
                        ->whereDoesntHave('products')
                        ->orWhereHas('products', fn (Builder $related) => $related->whereIn('products.id', $productIds));
                });
            }
        }

        if ($scope === Promotion::SCOPE_CATEGORY) {
            $categoryIds = array_values(array_unique(array_map('intval', $payload['category_ids'] ?? [])));

            if (!empty($categoryIds)) {
                $query->where(function (Builder $builder) use ($categoryIds): void {
                    $builder
                        ->whereDoesntHave('categories')
                        ->orWhereHas('categories', fn (Builder $related) => $related->whereIn('categories.id', $categoryIds));
                });
            }
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'conflict' => ['This non-stackable promotion conflicts with another active promotion in the same scope and schedule.'],
            ]);
        }
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function normalizePayload(array $payload): array
    {
        $normalized = $payload;

        if (array_key_exists('code', $normalized)) {
            $code = strtoupper(trim((string) $normalized['code']));
            $normalized['code'] = $code === '' ? null : $code;
        }

        foreach (['first_order_only', 'requires_code', 'is_stackable', 'is_active'] as $boolField) {
            if (array_key_exists($boolField, $normalized)) {
                $normalized[$boolField] = (bool) $normalized[$boolField];
            }
        }

        foreach (['value', 'bundle_price', 'min_purchase_amount'] as $decimalField) {
            if (array_key_exists($decimalField, $normalized) && $normalized[$decimalField] !== null && $normalized[$decimalField] !== '') {
                $normalized[$decimalField] = round((float) $normalized[$decimalField], 2);
            }
        }

        foreach (['buy_quantity', 'get_quantity', 'priority', 'usage_limit', 'usage_limit_per_user'] as $intField) {
            if (array_key_exists($intField, $normalized) && $normalized[$intField] !== null && $normalized[$intField] !== '') {
                $normalized[$intField] = (int) $normalized[$intField];
            }
        }

        if (array_key_exists('product_ids', $normalized)) {
            $normalized['product_ids'] = array_values(array_unique(array_map('intval', Arr::wrap($normalized['product_ids']))));
        }

        if (array_key_exists('category_ids', $normalized)) {
            $normalized['category_ids'] = array_values(array_unique(array_map('intval', Arr::wrap($normalized['category_ids']))));
        }

        if (array_key_exists('conditions', $normalized)) {
            $conditions = is_array($normalized['conditions']) ? $normalized['conditions'] : [];
            if (isset($conditions['variant_ids'])) {
                $conditions['variant_ids'] = array_values(array_unique(array_filter(array_map(
                    'intval',
                    Arr::wrap($conditions['variant_ids'])
                ), fn ($id) => $id > 0)));
            }
            if (isset($conditions['bundle_product_ids'])) {
                $conditions['bundle_product_ids'] = array_values(array_unique(array_map('intval', Arr::wrap($conditions['bundle_product_ids']))));
            }
            if (isset($conditions['bundle_quantity'])) {
                $conditions['bundle_quantity'] = max(1, (int) $conditions['bundle_quantity']);
            }
            if (isset($conditions['bundle_price'])) {
                $conditions['bundle_price'] = round((float) $conditions['bundle_price'], 2);
            }

            $normalized['conditions'] = $conditions;
        }

        return $normalized;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function extractPromotionAttributes(array $payload): array
    {
        return Arr::only($payload, self::PROMOTION_FIELDS);
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function syncTargets(Promotion $promotion, array $payload): void
    {
        if (array_key_exists('product_ids', $payload)) {
            $promotion->products()->sync($payload['product_ids'] ?? []);
        }

        if (array_key_exists('category_ids', $payload)) {
            $promotion->categories()->sync($payload['category_ids'] ?? []);
        }
    }

    private function invalidateCatalogCaches(): void
    {
        Cache::forget('categories');
        $this->productService->bumpProductListCacheVersion();
    }
}
