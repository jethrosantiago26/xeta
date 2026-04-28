<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;

class Promotion extends Model
{
    public const DISCOUNT_PERCENTAGE = 'percentage';
    public const DISCOUNT_FIXED = 'fixed';
    public const DISCOUNT_BOGO = 'bogo';
    public const DISCOUNT_BUNDLE = 'bundle';

    public const SCOPE_ORDER = 'order';
    public const SCOPE_PRODUCT = 'product';
    public const SCOPE_CATEGORY = 'category';

    protected $fillable = [
        'name',
        'code',
        'description',
        'discount_type',
        'scope',
        'value',
        'buy_quantity',
        'get_quantity',
        'bundle_price',
        'min_purchase_amount',
        'first_order_only',
        'requires_code',
        'is_stackable',
        'priority',
        'starts_at',
        'ends_at',
        'usage_limit',
        'usage_limit_per_user',
        'usage_count',
        'conditions',
        'is_active',
        'created_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'decimal:2',
            'bundle_price' => 'decimal:2',
            'min_purchase_amount' => 'decimal:2',
            'first_order_only' => 'boolean',
            'requires_code' => 'boolean',
            'is_stackable' => 'boolean',
            'is_active' => 'boolean',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'conditions' => 'array',
        ];
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'promotion_product')->withTimestamps();
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'promotion_category')->withTimestamps();
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(PromotionRedemption::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        $now = now();

        return $query
            ->where('is_active', true)
            ->where(function (Builder $windowQuery) use ($now): void {
                $windowQuery
                    ->whereNull('starts_at')
                    ->orWhere('starts_at', '<=', $now);
            })
            ->where(function (Builder $windowQuery) use ($now): void {
                $windowQuery
                    ->whereNull('ends_at')
                    ->orWhere('ends_at', '>=', $now);
            });
    }
}
