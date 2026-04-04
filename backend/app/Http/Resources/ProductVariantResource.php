<?php

namespace App\Http\Resources;

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

        return [
            'id' => $this->id,
            'name' => $this->name,
            'sku' => $this->sku,
            'price' => (float) $this->price,
            'compare_at_price' => $this->compare_at_price ? (float) $this->compare_at_price : null,
            'stock_quantity' => $this->stock_quantity,
            'condition' => $this->condition,
            'attributes' => $attributes,
            'color_hex' => $attributes['color_hex'] ?? null,
            'image_url' => $attributes['image_url'] ?? null,
            'is_active' => $this->is_active,
            'in_stock' => $this->isInStock(),
            'on_sale' => $this->isOnSale(),
        ];
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

        return '/' . ltrim($value, '/');
    }
}
