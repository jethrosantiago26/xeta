<?php

use App\Http\Middleware\ClerkAuthenticate;
use App\Http\Middleware\EnsureAdmin;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\HandleCors;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Prepend CORS first so preflight OPTIONS requests are handled
        // before any auth/route middleware can reject them.
        $middleware->prepend(HandleCors::class);

        $middleware->alias([
            'clerk' => ClerkAuthenticate::class,
            'admin' => EnsureAdmin::class,
        ]);

        // Trust proxies for Railway / reverse proxy
        $middleware->trustProxies(at: '*');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
