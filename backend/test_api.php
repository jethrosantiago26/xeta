<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

function testUser($username, $password) {
    global $app;
    echo "Testing user $username...\n";
    $user = \App\Models\User::where('username', $username)->first();
    if (!$user) {
        $user = \App\Models\User::where('email', $username)->first();
    }
    
    if (!$user) {
        echo "User not found\n";
        return;
    }

    echo "User found: {$user->id} Role: {$user->role}\n";
    
    // Simulate requests as this user
    \Illuminate\Support\Facades\Auth::login($user);

    // List of requests to test based on role
    $requests = [
        ['GET', '/api/user'],
        ['GET', '/api/orders'],
        ['GET', '/api/reviews'],
        ['GET', '/api/cart'],
        ['GET', '/api/wishlist'],
        ['GET', '/api/products'],
        ['GET', '/api/categories'],
        ['GET', '/api/support/tickets'],
    ];

    if ($user->role === 'admin') {
        $requests = array_merge($requests, [
            ['GET', '/api/admin/orders'],
            ['GET', '/api/admin/products'],
            ['GET', '/api/admin/customers'],
            ['GET', '/api/admin/reviews'],
            ['GET', '/api/admin/support/assigned'],
            ['GET', '/api/admin/analytics/overview'],
        ]);
    }

    foreach ($requests as $req) {
        try {
            $response = $app->handle(
                \Illuminate\Http\Request::create($req[1], $req[0])
            );
            $status = $response->getStatusCode();
            echo "{$req[0]} {$req[1]} -> Status: {$status}\n";
            if ($status >= 500) {
                echo "Error response content:\n";
                echo substr($response->getContent(), 0, 500) . "\n";
            }
        } catch (\Exception $e) {
            echo "{$req[0]} {$req[1]} -> Exception: {$e->getMessage()}\n";
        }
    }
    echo "--------------------------\n";
}

testUser('jhetros', 'sekreto18100001440');
testUser('jethrosantiago', 'sekreto18100001440');
