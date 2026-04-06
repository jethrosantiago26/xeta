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
        'unit_price',
        'quantity',
        'total',
    ];

    protected function casts(): array
    {
        return [
            'unit_price' => 'decimal:2',
            'total' => 'decimal:2',
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
