<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductImageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'url' => $this->normalizeAssetUrl($this->url),
            'alt_text' => $this->alt_text,
            'sort_order' => $this->sort_order,
            'is_primary' => $this->is_primary,
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

        if (str_starts_with($value, '/uploads/')) {
            return '/storage/' . ltrim(substr($value, strlen('/uploads/')), '/');
        }

        if (str_starts_with($value, 'uploads/')) {
            return '/storage/' . ltrim(substr($value, strlen('uploads/')), '/');
        }

        return '/' . ltrim($value, '/');
    }
}
