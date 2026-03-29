<?php

namespace App\Http\Middleware;

use App\Services\ClerkService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class ClerkAuthenticate
{
    public function __construct(
        private readonly ClerkService $clerkService,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json([
                'message' => 'Authentication required',
            ], 401);
        }

        try {
            $user = $this->clerkService->authenticateToken($token);
            $request->setUserResolver(fn () => $user);
        } catch (\Exception $e) {
            Log::warning('Clerk authentication failed', [
                'token_prefix' => substr($token, 0, 20),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Invalid or expired token',
            ], 401);
        }

        return $next($request);
    }
}
