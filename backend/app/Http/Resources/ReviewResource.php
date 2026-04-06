<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $authorName = 'Verified Buyer';
        if ($this->relationLoaded('user') && $this->user) {
            $displayName = $this->user->username ?: $this->user->name;
            if ($this->is_anonymous) {
                if (strlen($displayName) > 4) {
                    $authorName = substr($displayName, 0, 2) . '****' . substr($displayName, -2);
                } else {
                    $authorName = substr($displayName, 0, 1) . '***';
                }
            } else {
                $authorName = $displayName;
            }
        }

        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'variant_id' => $this->variant_id,
            'rating' => $this->rating,
            'comment' => $this->comment,
            'is_approved' => $this->is_approved,
            'is_anonymous' => $this->is_anonymous,
            'author_name' => $authorName,
            'created_at' => $this->created_at,
            'product' => $this->whenLoaded('product'),
            'variant' => $this->whenLoaded('variant', fn () => [
                'id' => $this->variant?->id,
                'name' => $this->normalizeDisplayText($this->variant?->name),
                'sku' => $this->variant?->sku,
            ]),
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
}
