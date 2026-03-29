<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductVariantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'sku' => $this->sku,
            'price' => (float) $this->price,
            'compare_at_price' => $this->compare_at_price ? (float) $this->compare_at_price : null,
            'stock_quantity' => $this->stock_quantity,
            'condition' => $this->condition,
            'attributes' => $this->attributes,
            'is_active' => $this->is_active,
            'in_stock' => $this->isInStock(),
            'on_sale' => $this->isOnSale(),
        ];
    }
}
