<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\ProductResource;
use App\Services\ProductService;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductController extends Controller
{
    public function __construct(
        private readonly ProductService $productService,
    ) {}

    /**
     * List products with filtering and sorting.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->only([
            'category', 'categories', 'min_price', 'max_price',
            'in_stock', 'search', 'sort',
        ]);

        $products = $this->productService->getProducts(
            $filters,
            $request->integer('per_page', 12),
        );

        $boundsQuery = ProductVariant::query()
            ->active()
            ->where('condition', 'new')
            ->whereHas('product', function ($query) use ($filters) {
                $query->active();

                if (!empty($filters['search'])) {
                    $query->where('name', 'like', '%' . $filters['search'] . '%');
                }
            });

        if (!empty($filters['in_stock'])) {
            $boundsQuery->inStock();
        }

        // Intentionally ignore min_price/max_price when computing bounds
        // so users can widen or reset the slider range.
        $minPrice = (clone $boundsQuery)->min('price');
        $maxPrice = (clone $boundsQuery)->max('price');

        $priceBounds = [
            'min' => $minPrice !== null ? (float) $minPrice : 0,
            'max' => $maxPrice !== null ? (float) $maxPrice : 0,
        ];

        return ProductResource::collection($products)->additional([
            'meta' => [
                'price_bounds' => $priceBounds,
            ],
        ]);
    }

    /**
     * Get a single product by slug.
     */
    public function show(string $slug): ProductResource
    {
        $product = $this->productService->getBySlug($slug);
        return new ProductResource($product);
    }
}
