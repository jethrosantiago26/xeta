<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $adminEmail = config('admin.emails.0', 'admin@example.com');

        User::updateOrCreate(
            ['email' => $adminEmail],
            [
                'clerk_id' => 'seed-admin-' . Str::slug($adminEmail),
                'name' => 'XETA Admin',
                'role' => 'admin',
                'phone' => null,
                'address_line1' => null,
                'address_line2' => null,
                'city' => null,
                'state' => null,
                'postal_code' => null,
                'country' => null,
                'timezone' => null,
                'location_name' => null,
                'latitude' => null,
                'longitude' => null,
                'location_source' => 'seed',
                'preferred_contact_method' => 'email',
            ],
        );
    }
}
