<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone')->nullable()->after('email');
            $table->string('address_line1')->nullable()->after('phone');
            $table->string('address_line2')->nullable()->after('address_line1');
            $table->string('city')->nullable()->after('address_line2');
            $table->string('state')->nullable()->after('city');
            $table->string('postal_code')->nullable()->after('state');
            $table->string('country', 2)->nullable()->after('postal_code');
            $table->string('timezone')->nullable()->after('country');
            $table->string('location_name')->nullable()->after('timezone');
            $table->decimal('latitude', 10, 7)->nullable()->after('location_name');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->string('location_source')->nullable()->after('longitude');
            $table->enum('preferred_contact_method', ['email', 'phone', 'whatsapp'])
                ->default('email')
                ->after('location_source');
            $table->timestamp('location_updated_at')->nullable()->after('preferred_contact_method');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
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
                'preferred_contact_method',
                'location_updated_at',
            ]);
        });
    }
};
