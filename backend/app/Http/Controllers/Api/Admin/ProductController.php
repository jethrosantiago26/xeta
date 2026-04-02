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
use App\Services\VariantVisualService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Cache;

class ProductController extends Controller
{
    public function __construct(
        private readonly VariantVisualService $variantVisualService,
    ) {
    }

    /**
     * List all products (including inactive).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Product::with([
            'category',
            'variants' => fn ($query) => $query->where('condition', 'new'),
            'images',
        ]);

        if ($request->boolean('with_archived')) {
            $query->withTrashed();
        }

        $products = $query->orderByDesc('created_at')
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

        return response()->json(['message' => 'Product archived']);
    }

    /**
     * Restore a product.
     */
    public function restore(int $product): JsonResponse
    {
        $productModel = Product::onlyTrashed()->findOrFail($product);
        $productModel->restore();
        Cache::forget('categories');

        return response()->json([
            'message' => 'Product restored',
            'product' => new ProductResource($productModel->load(['category', 'variants', 'images'])),
        ]);
    }

    /**
     * Permanently delete a product.
     */
    public function forceDelete(int $product): JsonResponse
    {
        $productModel = Product::withTrashed()->findOrFail($product);
        $productModel->forceDelete();
        Cache::forget('categories');

        return response()->json(['message' => 'Product permanently deleted']);
    }

    /**
     * Add a variant to a product.
     */
    public function storeVariant(StoreVariantRequest $request, int $product): JsonResponse
    {
        $productModel = Product::findOrFail($product);
        $payload = $request->validated();
        unset($payload['image']);

        if ($request->hasFile('image')) {
            $payload['attributes'] = is_array($payload['attributes'] ?? null) ? $payload['attributes'] : [];
            $payload['attributes']['image_url'] = $this->storeVariantImage($request->file('image'));
        }

        $payload['condition'] = 'new';
        $payload['attributes'] = $this->variantVisualService->buildAttributes($productModel, $payload);

        $variant = $productModel->variants()->create($payload);

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
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'sku' => ['sometimes', 'string', 'max:255', 'unique:product_variants,sku,' . $variant],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'compare_at_price' => ['nullable', 'numeric', 'min:0'],
            'stock_quantity' => ['sometimes', 'integer', 'min:0'],
            'condition' => ['sometimes', 'in:new'],
            'attributes' => ['nullable', 'array'],
            'image' => ['nullable', 'image', 'max:5120'],
            'is_active' => ['boolean'],
        ]);

        $variantModel = ProductVariant::where('product_id', $product)->findOrFail($variant);
        $productModel = Product::findOrFail($product);

        unset($validated['image']);

        if ($request->hasFile('image')) {
            $validated['attributes'] = is_array($validated['attributes'] ?? null) ? $validated['attributes'] : [];
            $validated['attributes']['image_url'] = $this->storeVariantImage($request->file('image'));
        }

        $validated['attributes'] = $this->variantVisualService->buildAttributes(
            $productModel,
            $validated,
            $variantModel,
        );
        $validated['condition'] = 'new';

        $variantModel->update($validated);

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

    private function storeVariantImage(UploadedFile $image): string
    {
        $destination = public_path('uploads/variants');

        if (!is_dir($destination)) {
            mkdir($destination, 0755, true);
        }

        $filename = $image->hashName();
        $image->move($destination, $filename);

        return '/uploads/variants/' . $filename;
    }
}
