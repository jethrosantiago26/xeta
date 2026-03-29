<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $allowedEmails = array_map('strtolower', config('admin.emails', []));
        $userEmail = strtolower((string) ($user?->email ?? ''));

        if (!$user || (!$user->isAdmin() && !in_array($userEmail, $allowedEmails, true))) {
            return response()->json([
                'message' => 'Forbidden: admin access required',
            ], 403);
        }

        return $next($request);
    }
}
