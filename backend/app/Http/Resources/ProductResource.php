<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->normalizeDisplayText($this->name),
            'slug' => $this->slug,
            'description' => $this->description,
            'specs' => $this->specs,
            'is_active' => $this->is_active,
            'category' => new CategoryResource($this->whenLoaded('category')),
            'variants' => ProductVariantResource::collection($this->whenLoaded('variants')),
            'images' => ProductImageResource::collection($this->whenLoaded('images')),
            'reviews' => ReviewResource::collection($this->whenLoaded('reviews')),
            'lowest_price' => $this->lowest_price,
            'average_rating' => $this->average_rating,
            'review_count' => $this->review_count,
            'primary_image' => $this->whenLoaded('images', function () {
                $primary = $this->images->firstWhere('is_primary', true);
                return $this->normalizeAssetUrl($primary ? $primary->url : $this->images->first()?->url);
            }),
            'created_at' => $this->created_at,
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
