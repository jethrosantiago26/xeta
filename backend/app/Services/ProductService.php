<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Cache;

class ProductService
{
    /**
     * Get filtered, sorted, paginated products.
     */
    public function getProducts(array $filters = [], int $perPage = 12): LengthAwarePaginator
    {
        $query = Product::active()
            ->with([
                'category',
                'variants' => fn ($q) => $q->active()->where('condition', 'new'),
                'images' => fn ($q) => $q->where('is_primary', true),
            ]);

        // Filter by category
        if (!empty($filters['category'])) {
            $query->whereHas('category', fn ($q) => $q->where('slug', $filters['category']));
        }

        // Filter by price range (checks variant prices)
        if (!empty($filters['min_price'])) {
            $query->whereHas('variants', fn ($q) => $q
                ->where('price', '>=', $filters['min_price'])
                ->where('condition', 'new')
                ->active());
        }
        if (!empty($filters['max_price'])) {
            $query->whereHas('variants', fn ($q) => $q
                ->where('price', '<=', $filters['max_price'])
                ->where('condition', 'new')
                ->active());
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
            'price_asc' => $query->orderByRaw(
                "(SELECT MIN(price) FROM product_variants WHERE product_variants.product_id = products.id AND product_variants.is_active = 1 AND product_variants.condition = 'new') ASC"
            ),
            'price_desc' => $query->orderByRaw(
                "(SELECT MIN(price) FROM product_variants WHERE product_variants.product_id = products.id AND product_variants.is_active = 1 AND product_variants.condition = 'new') DESC"
            ),
            'name_asc' => $query->orderBy('name'),
            'name_desc' => $query->orderByDesc('name'),
            default => $query->orderByDesc('created_at'),
        };

        return $query->paginate($perPage);
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
}
