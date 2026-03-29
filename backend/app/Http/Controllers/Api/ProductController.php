<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\ProductResource;
use App\Services\ProductService;
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
            'category', 'condition', 'min_price', 'max_price',
            'in_stock', 'search', 'sort',
        ]);

        $products = $this->productService->getProducts(
            $filters,
            $request->integer('per_page', 12),
        );

        return ProductResource::collection($products);
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
