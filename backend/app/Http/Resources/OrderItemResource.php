<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $variant = $this->relationLoaded('variant') ? $this->variant : null;
        $product = $variant && $variant->relationLoaded('product') ? $variant->product : null;
        $variantAttributes = is_array(data_get($variant, 'attributes'))
            ? data_get($variant, 'attributes')
            : [];

        $productImage = null;
        $productImages = [];
        if ($product && $product->relationLoaded('images')) {
            $primary = $product->images->firstWhere('is_primary', true);
            $productImage = $this->normalizeAssetUrl($primary?->url ?? $product->images->first()?->url);
            $productImages = $product->images
                ->map(fn ($image) => $this->normalizeAssetUrl($image?->url))
                ->filter(fn ($url) => $url !== null)
                ->values()
                ->all();
        }

        $matchingReview = null;
        if ($product && $product->relationLoaded('reviews')) {
            $matchingReview = $product->reviews->firstWhere('variant_id', $this->variant_id)
                ?? $product->reviews->firstWhere('order_id', $this->order_id)
                ?? $product->reviews->first();
        }

        $variantImage = $this->normalizeAssetUrl(
            $variantAttributes['image_url']
                ?? $variantAttributes['image']
                ?? $variantAttributes['preview_image']
                ?? null,
        );

        return [
            'id' => $this->id,
            'product_name' => $this->normalizeDisplayText($this->product_name),
            'variant_name' => $this->normalizeDisplayText($this->variant_name),
            'base_unit_price' => $this->base_unit_price !== null ? (float) $this->base_unit_price : null,
            'unit_price' => (float) $this->unit_price,
            'quantity' => $this->quantity,
            'total' => (float) $this->total,
            'discount_total' => (float) $this->discount_total,
            'applied_promotions' => is_array($this->applied_promotions) ? $this->applied_promotions : [],
            'product' => [
                'id' => $product?->id,
                'slug' => $product?->slug,
                'name' => $product ? $this->normalizeDisplayText($product->name) : null,
                'image_url' => $productImage,
                'primary_image' => $productImage,
                'images' => $productImages,
            ],
            'variant' => [
                'id' => $variant?->id,
                'sku' => $variant?->sku,
                'name' => $variant ? $this->normalizeDisplayText($variant->name) : null,
                'color_hex' => $variantAttributes['color_hex'] ?? null,
                'image_url' => $variantImage,
                'attributes' => [
                    'image_url' => $this->normalizeAssetUrl($variantAttributes['image_url'] ?? null),
                    'image' => $this->normalizeAssetUrl($variantAttributes['image'] ?? null),
                    'preview_image' => $this->normalizeAssetUrl($variantAttributes['preview_image'] ?? null),
                    'color_hex' => $variantAttributes['color_hex'] ?? null,
                ],
            ],
            'review' => $matchingReview ? [
                'id' => $matchingReview->id,
                'rating' => $matchingReview->rating,
                'comment' => $matchingReview->comment,
                'is_anonymous' => (bool) $matchingReview->is_anonymous,
                'created_at' => $matchingReview->created_at,
            ] : null,
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
            preg_match('/^(https?:)?\\/\\//i', $value) === 1
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
