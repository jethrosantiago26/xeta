<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use SoftDeletes;
    protected $fillable = [
        'category_id',
        'name',
        'slug',
        'description',
        'specs',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'specs' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('sort_order');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    public function promotions(): BelongsToMany
    {
        return $this->belongsToMany(Promotion::class, 'promotion_product')->withTimestamps();
    }

    public function primaryImage(): HasMany
    {
        return $this->hasMany(ProductImage::class)->where('is_primary', true);
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function getAverageRatingAttribute($value): ?float
    {
        if ($value !== null) {
            return round((float) $value, 1);
        }

        if ($this->relationLoaded('reviews')) {
            $avg = $this->reviews
                ->where('is_approved', true)
                ->avg('rating');

            return $avg !== null ? round((float) $avg, 1) : null;
        }

        $avg = $this->reviews()->where('is_approved', true)->avg('rating');

        return $avg !== null ? round((float) $avg, 1) : null;
    }

    public function getReviewCountAttribute($value): int
    {
        if ($value !== null) {
            return (int) $value;
        }

        if ($this->relationLoaded('reviews')) {
            return (int) $this->reviews
                ->where('is_approved', true)
                ->count();
        }

        return $this->reviews()->where('is_approved', true)->count();
    }

    public function getLowestPriceAttribute($value): ?float
    {
        if ($value !== null) {
            return (float) $value;
        }

        if ($this->relationLoaded('variants')) {
            $min = $this->variants
                ->where('is_active', true)
                ->where('condition', 'new')
                ->min('price');

            return $min !== null ? (float) $min : null;
        }

        $min = $this->variants()
            ->where('is_active', true)
            ->where('condition', 'new')
            ->min('price');

        return $min !== null ? (float) $min : null;
    }
}
