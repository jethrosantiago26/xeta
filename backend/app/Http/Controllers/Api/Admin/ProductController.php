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
use App\Services\ProductService;
use App\Services\VariantVisualService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use League\Flysystem\UnableToCreateDirectory;
use League\Flysystem\UnableToWriteFile;

class ProductController extends Controller
{
    public function __construct(
        private readonly ProductService $productService,
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
            $imageUrl = $this->storeProductImage($request->file('image'));

            ProductImage::create([
                'product_id' => $product->id,
                'url' => $imageUrl,
                'alt_text' => $product->name,
                'sort_order' => 0,
                'is_primary' => true,
            ]);
        }

        $this->invalidateCatalogCaches();

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
        $this->invalidateCatalogCaches();

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
        $this->invalidateCatalogCaches();

        return response()->json(['message' => 'Product archived']);
    }

    /**
     * Restore a product.
     */
    public function restore(int $product): JsonResponse
    {
        $productModel = Product::onlyTrashed()->findOrFail($product);
        $productModel->restore();
        $this->invalidateCatalogCaches();

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
        $productModel = Product::withTrashed()
            ->with([
                'images',
                'variants' => fn ($query) => $query->withTrashed(),
            ])
            ->findOrFail($product);

        if (!$productModel->trashed()) {
            return response()->json([
                'message' => 'Only archived products can be permanently deleted. Archive the product first.',
            ], 422);
        }

        $this->cleanupProductAttachments($productModel);
        $productModel->forceDelete();
        $this->invalidateCatalogCaches();

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
        $payload['attributes'] = $this->variantVisualService->buildAttributes($payload);

        $variant = $productModel->variants()->create($payload);
        $variant->refresh();
        $this->invalidateCatalogCaches();

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
            'name' => ['sometimes', 'string', 'max:255', 'not_regex:/\bused\b/i'],
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
        $previousImageUrl = $this->extractVariantImageUrl($variantModel);
        unset($validated['image']);

        // Log upload attempt metadata (best-effort, avoid logging sensitive token values)
        try {
            $file = $request->file('image');
            if ($file) {
                Log::info('Admin variant image upload attempt', [
                    'product_id' => $product,
                    'variant_id' => $variant,
                    'has_authorization_header' => (bool) $request->header('Authorization'),
                    'client_ip' => $request->ip(),
                    'file_name' => $file->getClientOriginalName(),
                    'file_size' => $file->getSize(),
                    'file_mime' => $file->getClientMimeType(),
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to record upload attempt metadata', ['exception' => $e->getMessage()]);
        }

        if ($request->hasFile('image')) {
            $validated['attributes'] = is_array($validated['attributes'] ?? null) ? $validated['attributes'] : [];
            $validated['attributes']['image_url'] = $this->storeVariantImage($request->file('image'));
        }

        $validated['attributes'] = $this->variantVisualService->buildAttributes(
            $validated,
            $variantModel,
        );
        $validated['condition'] = 'new';

        // Log pre-update state for debugging
        try {
            Log::info('Variant pre-update state', [
                'variant_id' => $variant,
                'previous_image_url' => $previousImageUrl,
                'incoming_attributes' => $validated['attributes'] ?? [],
                'incoming_name' => $validated['name'] ?? null,
                'incoming_price' => $validated['price'] ?? null,
            ]);
        } catch (\Throwable $e) {
            // Non-fatal
        }

        $variantModel->update($validated);
        $variantModel->refresh();

        // Log post-update state for debugging
        try {
            $storedImageUrl = $this->extractVariantImageUrl($variantModel);
            Log::info('Variant post-update state', [
                'variant_id' => $variant,
                'stored_attributes' => $variantModel->attributes ?? [],
                'stored_image_url' => $storedImageUrl,
                'stored_name' => $variantModel->name,
                'stored_price' => $variantModel->price,
            ]);
        } catch (\Throwable $e) {
            // Non-fatal
        }

        $this->cleanupVariantAttachmentIfChanged(
            $previousImageUrl,
            $this->extractVariantImageUrl($variantModel),
        );

        $this->invalidateCatalogCaches();

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
        $variantModel = ProductVariant::where('product_id', $product)->findOrFail($variant);

        $this->cleanupVariantAttachment($variantModel);
        $variantModel->delete();

        $this->invalidateCatalogCaches();

        return response()->json(['message' => 'Variant deleted']);
    }

    private function invalidateCatalogCaches(): void
    {
        $this->productService->invalidateCatalogCaches();
    }

    private function storeProductImage(UploadedFile $image): string
    {
        $directory = trim((string) config('products.attachments_directory', 'products'), '/');

        return $this->storeAttachment($image, $directory !== '' ? $directory : 'products');
    }

    private function storeVariantImage(UploadedFile $image): string
    {
        $directory = trim((string) config('products.variant_attachments_directory', 'product-variants'), '/');

        return $this->storeAttachment($image, $directory !== '' ? $directory : 'product-variants');
    }

    private function storeAttachment(UploadedFile $file, string $directory): string
    {
        $diskName = $this->resolveAttachmentDisk();

        // Log attempt metadata (best-effort)
        try {
            Log::info('Attempting to store product attachment', [
                'disk' => $diskName,
                'directory' => $directory,
                'file_name' => $file->getClientOriginalName(),
                'file_size' => $file->getSize(),
                'file_mime' => $file->getClientMimeType(),
            ]);
        } catch (\Throwable $e) {
            // Non-fatal
        }

        try {
            $storedPath = Storage::disk($diskName)->putFile($directory, $file);
        } catch (\Throwable $exception) {
            $errorId = uniqid('img_', true);

            Log::error('Failed to store product attachment', [
                'error_id' => $errorId,
                'disk' => $diskName,
                'directory' => $directory,
                'file_name' => $file->getClientOriginalName() ?? null,
                'file_size' => $file->getSize() ?? null,
                'exception' => $exception instanceof \Throwable ? $exception->getMessage() : (string) $exception,
            ]);

            throw ValidationException::withMessages([
                'image' => ['Image storage is temporarily unavailable. Please try again in a moment.'],
                'error_id' => [$errorId],
            ]);
        }

        if (!$storedPath) {
            $errorId = uniqid('img_', true);

            Log::error('Failed to store product attachment - no path returned', [
                'error_id' => $errorId,
                'disk' => $diskName,
                'directory' => $directory,
                'file_name' => $file->getClientOriginalName() ?? null,
                'file_size' => $file->getSize() ?? null,
            ]);

            throw ValidationException::withMessages([
                'image' => ['Unable to store the uploaded image. Please try again.'],
                'error_id' => [$errorId],
            ]);
        }

        // Log successful storage for easier tracing in logs (do not expose full paths publicly)
        try {
            Log::info('Stored product attachment', [
                'disk' => $diskName,
                'path' => $storedPath,
            ]);
        } catch (\Throwable $e) {
            // Non-fatal: logging should not break upload flow
        }

        return $this->resolveAttachmentUrl($diskName, $storedPath);
    }

    private function resolveAttachmentDisk(): string
    {
        $configured = trim((string) config('products.attachments_disk', 'public'));
        $diskName = $configured !== '' ? $configured : 'public';

        if ($diskName === 'local') {
            $diskName = 'public';
        }

        if (!is_array(config("filesystems.disks.{$diskName}"))) {
            return 'public';
        }

        return $diskName;
    }

    private function resolveAttachmentUrl(string $diskName, string $path): string
    {
        $normalizedPath = ltrim(str_replace('\\', '/', $path), '/');

        if ($diskName === 'public') {
            return '/storage/' . $normalizedPath;
        }

        $diskUrl = rtrim((string) config("filesystems.disks.{$diskName}.url", ''), '/');

        if ($diskUrl !== '') {
            return $diskUrl . '/' . $normalizedPath;
        }

        return '/storage/' . $normalizedPath;
    }

    private function cleanupProductAttachments(Product $productModel): void
    {
        foreach ($productModel->images as $image) {
            $this->deleteAttachmentByUrl((string) ($image->url ?? ''));
        }

        foreach ($productModel->variants as $variant) {
            $this->cleanupVariantAttachment($variant);
        }
    }

    private function cleanupVariantAttachment(ProductVariant $variant): void
    {
        $imageUrl = $this->extractVariantImageUrl($variant);

        if ($imageUrl === '') {
            return;
        }

        $this->deleteAttachmentByUrl($imageUrl);
    }

    private function cleanupVariantAttachmentIfChanged(string $previousImageUrl, string $nextImageUrl): void
    {
        if ($previousImageUrl === '') {
            return;
        }

        if ($this->normalizeComparableAttachmentUrl($previousImageUrl) === $this->normalizeComparableAttachmentUrl($nextImageUrl)) {
            return;
        }

        $this->deleteAttachmentByUrl($previousImageUrl);
    }

    private function extractVariantImageUrl(ProductVariant $variant): string
    {
        $attributes = is_array($variant->attributes) ? $variant->attributes : [];

        return trim((string) ($attributes['image_url'] ?? ''));
    }

    private function deleteAttachmentByUrl(string $url): void
    {
        $trimmedUrl = trim($url);

        if ($trimmedUrl === '') {
            return;
        }

        $preferredDisk = $this->resolveAttachmentDisk();
        $diskCandidates = array_values(array_unique([$preferredDisk, 'public']));

        foreach ($diskCandidates as $diskName) {
            if (!is_array(config("filesystems.disks.{$diskName}"))) {
                continue;
            }

            $relativePath = $this->extractRelativeAttachmentPath($trimmedUrl, $diskName);

            if ($relativePath === '') {
                continue;
            }

            try {
                $disk = Storage::disk($diskName);

                if ($disk->exists($relativePath)) {
                    $disk->delete($relativePath);
                    return;
                }
            } catch (\Throwable) {
                // Best-effort cleanup; do not block the deletion flow.
            }
        }
    }

    private function extractRelativeAttachmentPath(string $url, string $diskName): string
    {
        $value = trim(str_replace('\\', '/', $url));

        if ($value === '' || str_starts_with($value, 'data:') || str_starts_with($value, 'blob:')) {
            return '';
        }

        $diskUrl = rtrim((string) config("filesystems.disks.{$diskName}.url", ''), '/');

        if ($diskUrl !== '' && str_starts_with($value, $diskUrl . '/')) {
            return ltrim(substr($value, strlen($diskUrl)), '/');
        }

        $isAbsoluteUrl = preg_match('/^(https?:)?\/\//i', $value) === 1;

        if ($isAbsoluteUrl) {
            $parsedPath = parse_url($value, PHP_URL_PATH);

            if (!is_string($parsedPath) || $parsedPath === '') {
                return '';
            }

            $value = $parsedPath;
        }

        if (str_starts_with($value, '/storage/')) {
            return ltrim(substr($value, strlen('/storage/')), '/');
        }

        if (str_starts_with($value, 'storage/')) {
            return ltrim(substr($value, strlen('storage/')), '/');
        }

        if (str_starts_with($value, '/uploads/')) {
            return ltrim(substr($value, strlen('/uploads/')), '/');
        }

        if (str_starts_with($value, 'uploads/')) {
            return ltrim(substr($value, strlen('uploads/')), '/');
        }

        if ($isAbsoluteUrl && $diskUrl !== '') {
            return '';
        }

        return ltrim($value, '/');
    }

    private function normalizeComparableAttachmentUrl(string $url): string
    {
        $value = trim(str_replace('\\', '/', $url));

        if ($value === '') {
            return '';
        }

        if (preg_match('/^(https?:)?\/\//i', $value) === 1) {
            $parsedPath = parse_url($value, PHP_URL_PATH);
            $value = is_string($parsedPath) ? $parsedPath : $value;
        }

        if (str_starts_with($value, '/uploads/')) {
            $value = '/storage/' . ltrim(substr($value, strlen('/uploads/')), '/');
        } elseif (str_starts_with($value, 'uploads/')) {
            $value = '/storage/' . ltrim(substr($value, strlen('uploads/')), '/');
        } elseif (!str_starts_with($value, '/')) {
            $value = '/' . ltrim($value, '/');
        }

        return rtrim($value, '/');
    }
}
