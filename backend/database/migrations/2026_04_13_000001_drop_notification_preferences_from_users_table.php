<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('users')) {
            return;
        }

        $columnsToDrop = array_values(array_filter([
            Schema::hasColumn('users', 'order_updates') ? 'order_updates' : null,
            Schema::hasColumn('users', 'security_alerts') ? 'security_alerts' : null,
            Schema::hasColumn('users', 'marketing_emails') ? 'marketing_emails' : null,
        ]));

        if ($columnsToDrop === []) {
            return;
        }

        Schema::table('users', function (Blueprint $table) use ($columnsToDrop): void {
            $table->dropColumn($columnsToDrop);
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table): void {
            if (!Schema::hasColumn('users', 'order_updates')) {
                $table->boolean('order_updates')->default(true)->after('role');
            }

            if (!Schema::hasColumn('users', 'security_alerts')) {
                $after = Schema::hasColumn('users', 'order_updates') ? 'order_updates' : 'role';
                $table->boolean('security_alerts')->default(true)->after($after);
            }

            if (!Schema::hasColumn('users', 'marketing_emails')) {
                $after = Schema::hasColumn('users', 'security_alerts')
                    ? 'security_alerts'
                    : (Schema::hasColumn('users', 'order_updates') ? 'order_updates' : 'role');
                $table->boolean('marketing_emails')->default(false)->after($after);
            }
        });
    }
};
