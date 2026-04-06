<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('order_updates')->default(true)->after('role');
            $table->boolean('security_alerts')->default(true)->after('order_updates');
            $table->boolean('marketing_emails')->default(false)->after('security_alerts');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'order_updates',
                'security_alerts',
                'marketing_emails',
            ]);
        });
    }
};
