<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreProductRequest;
use App\Http\Requests\StoreVariantRequest;
use App\Http\Requests\UpdateProductRequest;
use App\Http\Resources\ProductResource;
use App\Http\Resources\ProductVariantResource;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Cache;

class ProductController extends Controller
{
    /**
     * List all products (including inactive).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $products = Product::with(['category', 'variants', 'images'])
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 20));

        return ProductResource::collection($products);
    }

    /**
     * Create a new product.
     */
    public function store(StoreProductRequest $request): JsonResponse
    {
        $validated = $request->validated();
        unset($validated['image']);

        $product = Product::create($validated);

        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $destination = public_path('uploads/products');

            if (!is_dir($destination)) {
                mkdir($destination, 0755, true);
            }

            $filename = $image->hashName();
            $image->move($destination, $filename);

            ProductImage::create([
                'product_id' => $product->id,
                'url' => '/uploads/products/' . $filename,
                'alt_text' => $product->name,
                'sort_order' => 0,
                'is_primary' => true,
            ]);
        }

        Cache::forget('categories');

        return response()->json([
            'message' => 'Product created',
            'product' => new ProductResource($product->load(['category', 'images'])),
        ], 201);
    }

    /**
     * Update a product.
     */
    public function update(UpdateProductRequest $request, int $product): JsonResponse
    {
        $productModel = Product::findOrFail($product);
        $productModel->update($request->validated());
        Cache::forget('categories');

        return response()->json([
            'message' => 'Product updated',
            'product' => new ProductResource($productModel->load(['category', 'variants', 'images'])),
        ]);
    }

    /**
     * Delete a product.
     */
    public function destroy(int $product): JsonResponse
    {
        Product::findOrFail($product)->delete();
        Cache::forget('categories');

        return response()->json(['message' => 'Product deleted']);
    }

    /**
     * Add a variant to a product.
     */
    public function storeVariant(StoreVariantRequest $request, int $product): JsonResponse
    {
        $productModel = Product::findOrFail($product);

        $variant = $productModel->variants()->create($request->validated());

        return response()->json([
            'message' => 'Variant created',
            'variant' => new ProductVariantResource($variant),
        ], 201);
    }

    /**
     * Update a variant.
     */
    public function updateVariant(Request $request, int $product, int $variant): JsonResponse
    {
        $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'sku' => ['sometimes', 'string', 'max:255', 'unique:product_variants,sku,' . $variant],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'compare_at_price' => ['nullable', 'numeric', 'min:0'],
            'stock_quantity' => ['sometimes', 'integer', 'min:0'],
            'condition' => ['sometimes', 'in:new,used'],
            'attributes' => ['nullable', 'array'],
            'is_active' => ['boolean'],
        ]);

        $variantModel = ProductVariant::where('product_id', $product)->findOrFail($variant);
        $variantModel->update($request->all());

        return response()->json([
            'message' => 'Variant updated',
            'variant' => new ProductVariantResource($variantModel),
        ]);
    }

    /**
     * Delete a variant.
     */
    public function destroyVariant(int $product, int $variant): JsonResponse
    {
        ProductVariant::where('product_id', $product)->findOrFail($variant)->delete();

        return response()->json(['message' => 'Variant deleted']);
    }
}
