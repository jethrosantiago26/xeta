<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use App\Models\SupportMessage;
use App\Models\SupportTicket;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'clerk_id',
        'first_name',
        'last_name',
        'name',
        'username',
        'email',
        'phone',
        'address_line1',
        'address_line2',
        'city',
        'state',
        'postal_code',
        'country',
        'timezone',
        'location_name',
        'latitude',
        'longitude',
        'location_source',
        'location_updated_at',
        'role',
        'order_updates',
        'security_alerts',
        'marketing_emails',
    ];

    protected $hidden = [];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'location_updated_at' => 'datetime',
            'order_updates' => 'boolean',
            'security_alerts' => 'boolean',
            'marketing_emails' => 'boolean',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    public function cartItems(): HasMany
    {
        return $this->hasMany(CartItem::class);
    }

    public function wishlistItems(): HasMany
    {
        return $this->hasMany(WishlistItem::class);
    }

    public function supportTickets(): HasMany
    {
        return $this->hasMany(SupportTicket::class);
    }

    public function assignedSupportTickets(): HasMany
    {
        return $this->hasMany(SupportTicket::class, 'assigned_admin_id');
    }

    public function supportMessages(): HasMany
    {
        return $this->hasMany(SupportMessage::class);
    }
}
