<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class MethodOverride
{
    /**
     * Handle an incoming request.
     *
     * @param \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response) $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethod('post')) {
            $methodFromInput = $request->input('_method');
            $methodFromHeader = $request->header('X-HTTP-METHOD-OVERRIDE');
            $method = $methodFromInput ?? $methodFromHeader;

            // Log for debugging
            try {
                Log::debug('MethodOverride middleware check', [
                    'path' => $request->path(),
                    'original_method' => $request->getMethod(),
                    'method_from_input' => $methodFromInput,
                    'method_from_header' => $methodFromHeader,
                    'detected_method' => $method,
                ]);
            } catch (\Throwable $e) {
                // Non-fatal
            }

            if ($method && in_array(strtoupper($method), ['PUT', 'PATCH', 'DELETE'])) {
                $convertedMethod = strtoupper($method);
                $request->setMethod($convertedMethod);

                // Log successful conversion
                try {
                    Log::info('MethodOverride: Converted POST to ' . $convertedMethod, [
                        'path' => $request->path(),
                    ]);
                } catch (\Throwable $e) {
                    // Non-fatal
                }
            }
        }

        return $next($request);
    }
}
