<?php

use App\Models\User;

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

foreach (User::all() as $user) {
    echo "ID: " . $user->id . " | Name: " . $user->name . " | Username: " . ($user->username ?? 'NULL') . "\n";
}
