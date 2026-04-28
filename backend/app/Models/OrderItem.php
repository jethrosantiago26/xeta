<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id',
        'variant_id',
        'product_name',
        'variant_name',
        'base_unit_price',
        'unit_price',
        'quantity',
        'total',
        'discount_total',
        'applied_promotions',
    ];

    protected function casts(): array
    {
        return [
            'base_unit_price' => 'decimal:2',
            'unit_price' => 'decimal:2',
            'total' => 'decimal:2',
            'discount_total' => 'decimal:2',
            'applied_promotions' => 'array',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id')->withTrashed();
    }
}
