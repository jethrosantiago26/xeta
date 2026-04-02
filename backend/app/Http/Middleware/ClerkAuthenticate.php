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
                'url' => $request->fullUrl(),
                'token_prefix' => substr($token, 0, 10),
                'error' => $e->getMessage(),
                'ip' => $request->ip(),
            ]);

            return response()->json([
                'status' => 'error',
                'code' => 'unauthorized',
                'message' => $e->getMessage() === 'Expired token' ? 'Your session has expired. Please wait while we refresh it.' : 'Invalid or expired token',
            ], 401);
        }

        return $next($request);
    }
}
