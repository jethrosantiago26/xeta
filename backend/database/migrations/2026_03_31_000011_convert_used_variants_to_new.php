<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('product_variants')
            ->where('condition', 'used')
            ->update(['condition' => 'new']);
    }

    public function down(): void
    {
        // Intentionally left blank because previous condition values are unknown.
    }
};
