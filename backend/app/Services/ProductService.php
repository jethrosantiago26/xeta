<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Cache;

class ProductService
{
    private const PRODUCT_LIST_CACHE_VERSION_KEY = 'products.list.version';

    /**
     * Get filtered, sorted, paginated products.
     */
    public function getProducts(array $filters = [], int $perPage = 12): LengthAwarePaginator
    {
        $filters = $this->normalizeFilters($filters);

        $page = request()->query('page', 1);
            $cacheVersion = max(1, (int) Cache::get(self::PRODUCT_LIST_CACHE_VERSION_KEY, 1));
            $cacheKey = 'products.list.v5.' . $cacheVersion . '.' . md5(serialize($filters) . '.' . $perPage . '.' . $page);

        return Cache::remember($cacheKey, 60 * 60, function () use ($filters, $perPage) {
            $query = Product::active()
                ->with([
                    'category',
                    'variants' => fn ($q) => $q->active()->where('condition', 'new'),
                    'images',
                ])
                ->withCount([
                    'reviews as review_count' => fn ($q) => $q->approved(),
                ])
                ->withAvg([
                    'reviews as average_rating' => fn ($q) => $q->approved(),
                ], 'rating')
                ->withMin([
                    'variants as lowest_price' => fn ($q) => $q->active()->where('condition', 'new'),
                ], 'price');

            $this->applyCommonFilters($query, $filters);
            $this->applyAvailabilityFilter($query, $filters);

            // Sorting
            $sortBy = $filters['sort'] ?? 'newest';
            $query = match ($sortBy) {
                'price_asc' => $query
                    ->orderByRaw('CASE WHEN lowest_price IS NULL THEN 1 ELSE 0 END ASC')
                    ->orderBy('lowest_price')
                    ->orderBy('name'),
                'price_desc' => $query
                    ->orderByRaw('CASE WHEN lowest_price IS NULL THEN 1 ELSE 0 END ASC')
                    ->orderByDesc('lowest_price')
                    ->orderBy('name'),
                'name_asc' => $query->orderBy('name'),
                'name_desc' => $query->orderByDesc('name'),
                default => $query->orderByDesc('created_at'),
            };

            return $query->paginate($perPage);
        });
    }

    public function getStockCounts(array $filters = []): array
    {
        $filters = $this->normalizeFilters($filters);
        unset($filters['in_stock'], $filters['stock_view']);

        $baseQuery = Product::active();
        $this->applyCommonFilters($baseQuery, $filters);

        $inStock = (clone $baseQuery)
            ->whereHas('variants', fn ($q) => $q->inStock()->where('condition', 'new')->active())
            ->count();

        $outOfStock = (clone $baseQuery)
            ->whereDoesntHave('variants', fn ($q) => $q->inStock()->where('condition', 'new')->active())
            ->count();

        return [
            'in_stock' => $inStock,
            'out_of_stock' => $outOfStock,
        ];
    }

    public function getPriceBounds(array $filters = []): array
    {
        $filters = $this->normalizeFilters($filters);
        unset($filters['min_price'], $filters['max_price']);

        $variantQuery = ProductVariant::query()
            ->active()
            ->where('condition', 'new')
            ->whereHas('product', function (Builder $productQuery) use ($filters) {
                $productQuery->active();
                $this->applyCommonFilters($productQuery, $filters);
                $this->applyAvailabilityFilter($productQuery, $filters);
            });

        if (!empty($filters['in_stock'])) {
            $variantQuery->inStock();
        }

        $minPrice = (clone $variantQuery)->min('price');
        $maxPrice = (clone $variantQuery)->max('price');

        return [
            'min' => $minPrice !== null ? (float) $minPrice : 0,
            'max' => $maxPrice !== null ? (float) $maxPrice : 0,
        ];
    }

    /**
     * Get a single product by slug with all relationships.
     */
    public function getBySlug(string $slug): Product
    {
        return Product::active()
            ->where('slug', $slug)
            ->with([
                'category',
                'variants' => fn ($q) => $q->active()->where('condition', 'new'),
                'images',
                'reviews' => fn ($q) => $q->approved()->with(['user', 'variant'])->latest(),
            ])
            ->withCount([
                'reviews as review_count' => fn ($q) => $q->approved(),
            ])
            ->withAvg([
                'reviews as average_rating' => fn ($q) => $q->approved(),
            ], 'rating')
            ->withMin([
                'variants as lowest_price' => fn ($q) => $q->active()->where('condition', 'new'),
            ], 'price')
            ->firstOrFail();
    }

    /**
     * Get all categories with product counts (cached).
     */
    public function getCategories()
    {
        return Cache::remember('categories', 3600, function () {
            return \App\Models\Category::withCount([
                'products' => fn ($q) => $q->active(),
            ])
                ->orderBy('sort_order')
                ->get();
        });
    }

    public function bumpProductListCacheVersion(): void
    {
        $currentVersion = max(1, (int) Cache::get(self::PRODUCT_LIST_CACHE_VERSION_KEY, 1));
        Cache::forever(self::PRODUCT_LIST_CACHE_VERSION_KEY, $currentVersion + 1);
    }

    public function invalidateCatalogCaches(): void
    {
        Cache::forget('categories');
        $this->bumpProductListCacheVersion();
    }

    private function normalizeFilters(array $filters): array
    {
        $normalizedCategorySlugs = $this->extractCategorySlugs($filters);

        if (!empty($normalizedCategorySlugs)) {
            sort($normalizedCategorySlugs);
            $filters['categories'] = $normalizedCategorySlugs;
        } else {
            unset($filters['categories']);
        }

        unset($filters['category']);

        $minPrice = isset($filters['min_price']) && $filters['min_price'] !== ''
            ? (float) $filters['min_price']
            : null;
        $maxPrice = isset($filters['max_price']) && $filters['max_price'] !== ''
            ? (float) $filters['max_price']
            : null;

        if ($minPrice !== null && $maxPrice !== null && $minPrice > $maxPrice) {
            [$minPrice, $maxPrice] = [$maxPrice, $minPrice];
        }

        $filters['min_price'] = $minPrice;
        $filters['max_price'] = $maxPrice;

        return $filters;
    }

    private function applyCommonFilters(Builder $query, array $filters): void
    {
        $categorySlugs = $filters['categories'] ?? [];
        $minPrice = $filters['min_price'] ?? null;
        $maxPrice = $filters['max_price'] ?? null;

        if (!empty($categorySlugs)) {
            $query->whereHas('category', fn ($categoryQuery) => $categoryQuery->whereIn('slug', $categorySlugs));
        }

        if ($minPrice !== null || $maxPrice !== null) {
            $query->whereHas('variants', function ($variantQuery) use ($minPrice, $maxPrice) {
                $variantQuery->where('condition', 'new')->active();

                if ($minPrice !== null) {
                    $variantQuery->where('price', '>=', $minPrice);
                }

                if ($maxPrice !== null) {
                    $variantQuery->where('price', '<=', $maxPrice);
                }
            });
        }

        if (!empty($filters['search'])) {
            $query->where('name', 'like', '%' . $filters['search'] . '%');
        }
    }

    private function applyAvailabilityFilter(Builder $query, array $filters): void
    {
        if (!empty($filters['in_stock'])) {
            $query->whereHas('variants', fn ($variantQuery) => $variantQuery->inStock()->where('condition', 'new')->active());
            return;
        }

        if (($filters['stock_view'] ?? null) === 'out') {
            $query->whereDoesntHave('variants', fn ($variantQuery) => $variantQuery->inStock()->where('condition', 'new')->active());
        }
    }

    private function extractCategorySlugs(array $filters): array
    {
        $rawCategories = $filters['categories'] ?? ($filters['category'] ?? []);

        if (is_string($rawCategories)) {
            $rawCategories = explode(',', $rawCategories);
        }

        if (!is_array($rawCategories)) {
            $rawCategories = [$rawCategories];
        }

        $slugs = array_map(
            static fn ($value) => trim((string) $value),
            $rawCategories,
        );

        return array_values(array_unique(array_filter($slugs)));
    }
}
