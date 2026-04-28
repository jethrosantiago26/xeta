<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PromotionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $status = 'active';
        $now = now();

        if (!$this->is_active) {
            $status = 'inactive';
        } elseif ($this->starts_at && $this->starts_at->isFuture()) {
            $status = 'scheduled';
        } elseif ($this->ends_at && $this->ends_at->lt($now)) {
            $status = 'expired';
        }

        return [
            'id' => $this->id,
            'name' => $this->name,
            'code' => $this->code,
            'description' => $this->description,
            'discount_type' => $this->discount_type,
            'scope' => $this->scope,
            'value' => $this->value !== null ? (float) $this->value : null,
            'buy_quantity' => $this->buy_quantity,
            'get_quantity' => $this->get_quantity,
            'bundle_price' => $this->bundle_price !== null ? (float) $this->bundle_price : null,
            'min_purchase_amount' => $this->min_purchase_amount !== null ? (float) $this->min_purchase_amount : null,
            'first_order_only' => (bool) $this->first_order_only,
            'requires_code' => (bool) $this->requires_code,
            'is_stackable' => (bool) $this->is_stackable,
            'priority' => (int) $this->priority,
            'starts_at' => $this->starts_at?->toISOString(),
            'ends_at' => $this->ends_at?->toISOString(),
            'usage_limit' => $this->usage_limit,
            'usage_limit_per_user' => $this->usage_limit_per_user,
            'usage_count' => (int) $this->usage_count,
            'conditions' => $this->conditions ?? [],
            'is_active' => (bool) $this->is_active,
            'status' => $status,
            'product_ids' => $this->whenLoaded('products', fn () => $this->products->pluck('id')->values()->all()),
            'category_ids' => $this->whenLoaded('categories', fn () => $this->categories->pluck('id')->values()->all()),
            'created_by' => $this->whenLoaded('creator', fn () => [
                'id' => $this->creator?->id,
                'name' => $this->creator?->name,
                'email' => $this->creator?->email,
            ]),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
