<?php

namespace App\Http\Resources;

use App\Services\PromotionEngineService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductVariantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $attributes = is_array($this->attributes) ? $this->attributes : [];

        if (array_key_exists('image_url', $attributes)) {
            $attributes['image_url'] = $this->normalizeAssetUrl($attributes['image_url']);
        }

        if (array_key_exists('image', $attributes)) {
            $attributes['image'] = $this->normalizeAssetUrl($attributes['image']);
        }

        if (array_key_exists('preview_image', $attributes)) {
            $attributes['preview_image'] = $this->normalizeAssetUrl($attributes['preview_image']);
        }

        $promotionPricing = app(PromotionEngineService::class)->getVariantPricing($this->resource);
        $salePrice = (float) ($promotionPricing['unit_price'] ?? $this->price);
        $saleDiscountAmount = (float) ($promotionPricing['line_discount'] ?? 0);
        $saleDiscountPercentage = (int) ($promotionPricing['discount_percentage'] ?? 0);
        $salePromotions = is_array($promotionPricing['applied_promotions'] ?? null)
            ? $promotionPricing['applied_promotions']
            : [];
        $saleStartsAt = collect($salePromotions)
            ->pluck('starts_at')
            ->filter()
            ->sort()
            ->first();
        $saleEndsAt = collect($salePromotions)
            ->pluck('ends_at')
            ->filter()
            ->sort()
            ->first();
        $isPromotionSale = (bool) ($promotionPricing['is_on_sale'] ?? false);

        return [
            'id' => $this->id,
            'name' => $this->normalizeDisplayText($this->name),
            'sku' => $this->sku,
            'price' => (float) $this->price,
            'sale_price' => $salePrice,
            'final_price' => $salePrice,
            'sale_discount_amount' => $saleDiscountAmount,
            'sale_discount_percentage' => $saleDiscountPercentage,
            'sale_label' => $saleDiscountPercentage > 0 ? sprintf('%d%% OFF', $saleDiscountPercentage) : ($isPromotionSale ? 'SALE' : null),
            'sale_applied_promotions' => $salePromotions,
            'sale_starts_at' => $saleStartsAt,
            'sale_ends_at' => $saleEndsAt,
            'compare_at_price' => $this->compare_at_price ? (float) $this->compare_at_price : null,
            'stock_quantity' => $this->stock_quantity,
            'condition' => $this->condition,
            'attributes' => $attributes,
            'color_hex' => $attributes['color_hex'] ?? null,
            'image_url' => $attributes['image_url'] ?? null,
            'is_active' => $this->is_active,
            'in_stock' => $this->isInStock(),
            'on_sale' => $this->isOnSale() || $isPromotionSale,
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
