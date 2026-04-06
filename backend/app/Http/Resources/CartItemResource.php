<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CartItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $variant = $this->variant;
        $product = $variant?->product;
        $productImage = $this->normalizeAssetUrl(
            $product?->images?->firstWhere('is_primary', true)?->url
                ?? $product?->images?->first()?->url,
        );
        $productImages = $product?->images
            ? $product->images
                ->map(fn ($image) => $this->normalizeAssetUrl($image?->url))
                ->filter(fn ($url) => $url !== null)
                ->values()
                ->all()
            : [];

        return [
            'id' => $this->id,
            'quantity' => $this->quantity,
            'variant' => new ProductVariantResource($this->whenLoaded('variant')),
            'product' => [
                'id' => $product?->id,
                'name' => $this->normalizeDisplayText($product?->name),
                'slug' => $product?->slug,
                'image' => $productImage,
                'primary_image' => $productImage,
                'image_url' => $productImage,
                'images' => $productImages,
            ],
            'line_total' => $variant ? (float) $variant->price * $this->quantity : 0,
        ];
    }

    private function normalizeDisplayText(mixed $value): string
    {
        $text = trim((string) $value);

        if ($text === '') {
            return '';
        }

        $text = preg_replace('/\x{FFFD}+/u', ' - ', $text) ?? $text;
        $text = preg_replace('/\s*\?{2,}\s*/u', ' - ', $text) ?? $text;
        $text = preg_replace('/\s{2,}/', ' ', $text) ?? $text;

        return trim($text);
    }

    private function normalizeAssetUrl(mixed $url): ?string
    {
        $value = trim(str_replace('\\', '/', (string) $url));

        if ($value === '') {
            return null;
        }

        if (
            preg_match('/^(https?:)?\/\//i', $value) === 1
            || str_starts_with($value, 'data:')
            || str_starts_with($value, 'blob:')
        ) {
            return $value;
        }

        if (str_starts_with($value, '/uploads/')) {
            return '/storage/' . ltrim(substr($value, strlen('/uploads/')), '/');
        }

        if (str_starts_with($value, 'uploads/')) {
            return '/storage/' . ltrim(substr($value, strlen('uploads/')), '/');
        }

        return '/' . ltrim($value, '/');
    }
}
