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

        return [
            'id' => $this->id,
            'quantity' => $this->quantity,
            'variant' => new ProductVariantResource($this->whenLoaded('variant')),
            'product' => [
                'id' => $product?->id,
                'name' => $product?->name,
                'slug' => $product?->slug,
                'image' => $product?->images?->firstWhere('is_primary', true)?->url
                    ?? $product?->images?->first()?->url,
            ],
            'line_total' => $variant ? (float) $variant->price * $this->quantity : 0,
        ];
    }
}
