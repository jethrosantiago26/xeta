<?php

use App\Http\Middleware\ClerkAuthenticate;
use App\Http\Middleware\EnsureAdmin;
use App\Http\Middleware\MethodOverride;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'clerk' => ClerkAuthenticate::class,
            'admin' => EnsureAdmin::class,
        ]);

        // Handle _method override for FormData file uploads - register globally
        $middleware->append(MethodOverride::class);

        // Trust proxies for Railway / reverse proxy
        $middleware->trustProxies(at: '*');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
