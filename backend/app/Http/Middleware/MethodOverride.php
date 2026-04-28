<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
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
            $method = $request->input('_method') ?? $request->header('X-HTTP-METHOD-OVERRIDE');
            
            if ($method && in_array(strtoupper($method), ['PUT', 'PATCH', 'DELETE'])) {
                $request->setMethod(strtoupper($method));
            }
        }

        return $next($request);
    }
}
