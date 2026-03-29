<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Services\ProductService;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CategoryController extends Controller
{
    public function __construct(
        private readonly ProductService $productService,
    ) {}

    /**
     * List all categories with product counts.
     */
    public function index(): AnonymousResourceCollection
    {
        $categories = $this->productService->getCategories();
        return CategoryResource::collection($categories);
    }

    /**
     * Get a single category by slug.
     */
    public function show(string $slug): CategoryResource
    {
        $category = \App\Models\Category::where('slug', $slug)
            ->withCount(['products' => fn ($q) => $q->where('is_active', true)])
            ->firstOrFail();

        return new CategoryResource($category);
    }
}
