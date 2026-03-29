<?php

return [
    'secret_key' => env('CLERK_SECRET_KEY'),
    'publishable_key' => env('CLERK_PUBLISHABLE_KEY'),
    'jwks_url' => env('CLERK_JWKS_URL', 'https://api.clerk.com/v1/jwks'),
    'jwt_key' => env('CLERK_JWT_KEY'),
    'jwks_cache_ttl' => env('CLERK_JWKS_CACHE_TTL', 3600),
];
