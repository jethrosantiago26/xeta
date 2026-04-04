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

        $productImage = null;
        if ($product && $product->relationLoaded('images')) {
            $primary = $product->images->firstWhere('is_primary', true);
            $productImage = $primary?->url ?? $product->images->first()?->url;
        }

        $matchingReview = null;
        if ($product && $product->relationLoaded('reviews')) {
            $matchingReview = $product->reviews->firstWhere('variant_id', $this->variant_id)
                ?? $product->reviews->firstWhere('order_id', $this->order_id)
                ?? $product->reviews->first();
        }

        $variantImage = data_get($variant, 'attributes.image_url');

        return [
            'id' => $this->id,
            'product_name' => $this->product_name,
            'variant_name' => $this->variant_name,
            'unit_price' => (float) $this->unit_price,
            'quantity' => $this->quantity,
            'total' => (float) $this->total,
            'product' => [
                'id' => $product?->id,
                'slug' => $product?->slug,
                'name' => $product?->name,
                'image_url' => $productImage,
            ],
            'variant' => [
                'id' => $variant?->id,
                'sku' => $variant?->sku,
                'name' => $variant?->name,
                'color_hex' => data_get($variant, 'attributes.color_hex'),
                'image_url' => $variantImage,
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
}
