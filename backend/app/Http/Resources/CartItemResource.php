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
        $pricing = is_array($this->getAttribute('pricing')) ? $this->getAttribute('pricing') : [];
        $baseUnitPrice = array_key_exists('base_unit_price', $pricing)
            ? (float) $pricing['base_unit_price']
            : ($variant ? (float) $variant->price : 0.0);
        $unitPrice = array_key_exists('unit_price', $pricing)
            ? (float) $pricing['unit_price']
            : ($variant ? (float) $variant->price : 0.0);
        $lineSubtotal = array_key_exists('line_subtotal', $pricing)
            ? (float) $pricing['line_subtotal']
            : round($baseUnitPrice * (int) $this->quantity, 2);
        $lineDiscount = array_key_exists('line_discount', $pricing)
            ? (float) $pricing['line_discount']
            : max(0, round($lineSubtotal - ($unitPrice * (int) $this->quantity), 2));
        $lineTotal = array_key_exists('line_total', $pricing)
            ? (float) $pricing['line_total']
            : round($unitPrice * (int) $this->quantity, 2);
        $appliedPromotions = is_array($pricing['applied_promotions'] ?? null)
            ? $pricing['applied_promotions']
            : [];

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
            'base_unit_price' => $baseUnitPrice,
            'unit_price' => $unitPrice,
            'product' => [
                'id' => $product?->id,
                'name' => $this->normalizeDisplayText($product?->name),
                'slug' => $product?->slug,
                'image' => $productImage,
                'primary_image' => $productImage,
                'image_url' => $productImage,
                'images' => $productImages,
            ],
            'line_subtotal' => $lineSubtotal,
            'line_discount' => $lineDiscount,
            'line_total' => $lineTotal,
            'applied_promotions' => $appliedPromotions,
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
