<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('support_tickets', function (Blueprint $table) {
            $table->dropIndex(['status', 'priority']);
            $table->dropColumn('priority');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::table('support_tickets', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->enum('priority', ['low', 'normal', 'high', 'urgent'])->default('normal')->after('type');
            $table->index(['status', 'priority']);
        });
    }
};
