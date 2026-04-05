<?php

namespace App\Services;

use App\Models\Product;
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
        $normalizedCategorySlugs = $this->extractCategorySlugs($filters);

        if (!empty($normalizedCategorySlugs)) {
            sort($normalizedCategorySlugs);
            $filters['categories'] = $normalizedCategorySlugs;
        } else {
            unset($filters['categories']);
        }

        unset($filters['category']);

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

            $minPrice = isset($filters['min_price']) && $filters['min_price'] !== ''
                ? (float) $filters['min_price']
                : null;
            $maxPrice = isset($filters['max_price']) && $filters['max_price'] !== ''
                ? (float) $filters['max_price']
                : null;
            $categorySlugs = $this->extractCategorySlugs($filters);

            if ($minPrice !== null && $maxPrice !== null && $minPrice > $maxPrice) {
                [$minPrice, $maxPrice] = [$maxPrice, $minPrice];
            }

            // Filter by category
            if (!empty($categorySlugs)) {
                $query->whereHas('category', fn ($q) => $q->whereIn('slug', $categorySlugs));
            }

            // Filter by price range on the same variant to avoid mismatched min/max hits.
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

            // Filter by in-stock only
            if (!empty($filters['in_stock'])) {
                $query->whereHas('variants', fn ($q) => $q->inStock()->where('condition', 'new')->active());
            }

            // Search by name
            if (!empty($filters['search'])) {
                $query->where('name', 'like', '%' . $filters['search'] . '%');
            }

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
