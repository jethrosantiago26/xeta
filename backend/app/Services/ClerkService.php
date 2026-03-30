<?php

namespace App\Services;

use App\Models\User;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class ClerkService
{
    /**
     * Authenticate a Clerk JWT token and return the corresponding local user.
     */
    public function authenticateToken(string $token): User
    {
        $claims = $this->verifyToken($token);
        return $this->syncUser($claims);
    }

    /**
     * Verify a JWT token using Clerk's JWKS and return the decoded claims.
     */
    private function verifyToken(string $token): object
    {
        $previousLeeway = JWT::$leeway;
        JWT::$leeway = (int) config('clerk.jwt_leeway', 60);

        try {
            try {
                return $this->decodeWithJwks($token, $this->getJwks());
            } catch (\Throwable $firstError) {
                // Clerk can rotate signing keys; refresh JWKS once before failing.
                Cache::forget('clerk_jwks');
                return $this->decodeWithJwks($token, $this->getJwks());
            }
        } finally {
            JWT::$leeway = $previousLeeway;
        }
    }

    private function decodeWithJwks(string $token, array $jwks): object
    {
        $keys = JWK::parseKeySet($jwks);
        return JWT::decode($token, $keys);
    }

    /**
     * Fetch and cache Clerk's JWKS (JSON Web Key Set).
     */
    private function getJwks(): array
    {
        $cacheTtl = config('clerk.jwks_cache_ttl', 3600);

        return Cache::remember('clerk_jwks', $cacheTtl, function () {
            $jwksUrl = config('clerk.jwks_url');

            Log::info('Fetching Clerk JWKS', ['url' => $jwksUrl]);

            $response = Http::timeout(10)->get($jwksUrl);

            if (!$response->successful()) {
                throw new \RuntimeException('Failed to fetch Clerk JWKS');
            }

            return $response->json();
        });
    }

    /**
     * Sync a Clerk user to the local database (create on first login, update on subsequent logins).
     */
    private function syncUser(object $claims): User
    {
        $clerkId = $claims->sub;
        $email = $this->resolveEmailAddress($claims);
        $allowedAdminEmails = array_map('strtolower', config('admin.emails', []));
        $isAdminEmail = $email && in_array(strtolower($email), $allowedAdminEmails, true);
        $claimName = trim(($claims->first_name ?? '') . ' ' . ($claims->last_name ?? '')) ?: null;

        $userData = [
            'email' => $email,
            'role' => $isAdminEmail ? 'admin' : 'customer',
        ];

        // Remove null values to avoid overwriting existing data
        $userData = array_filter($userData, fn ($v) => $v !== null);

        return DB::transaction(function () use ($clerkId, $email, $userData, $isAdminEmail, $claimName): User {
            $existingUser = User::where('clerk_id', $clerkId)->first();

            if (!$existingUser && $email) {
                $existingUser = User::where('email', $email)->first();
            }

            if ($existingUser) {
                $existingUser->fill(array_merge($userData, ['clerk_id' => $clerkId]));

                // Preserve user-edited profile name instead of resetting it from Clerk claims every request.
                if ((!$existingUser->name || $existingUser->name === 'User') && $claimName) {
                    $existingUser->name = $claimName;
                }

                $existingUser->role = $existingUser->role === 'admin' || $isAdminEmail
                    ? 'admin'
                    : $existingUser->role;
                $existingUser->save();

                return $existingUser;
            }

            return User::create(array_merge($userData, [
                'clerk_id' => $clerkId,
                'name' => $claimName ?: 'User',
            ]));
        });
    }

    /**
     * Resolve the best available email address for a Clerk user.
     */
    private function resolveEmailAddress(object $claims): ?string
    {
        $candidateEmails = [
            $claims->email ?? null,
            $claims->email_address ?? null,
            $claims->primary_email_address ?? null,
        ];

        foreach ($candidateEmails as $candidateEmail) {
            if (is_string($candidateEmail) && $candidateEmail !== '') {
                return $candidateEmail;
            }
        }

        return $this->fetchEmailFromClerkApi($claims->sub);
    }

    /**
     * Fallback to the Clerk API when the JWT does not expose an email address.
     */
    private function fetchEmailFromClerkApi(string $clerkId): ?string
    {
        $secretKey = config('clerk.secret_key');

        if (!$secretKey) {
            return null;
        }

        $response = Http::withToken($secretKey)
            ->timeout(10)
            ->get("https://api.clerk.com/v1/users/{$clerkId}");

        if (!$response->successful()) {
            return null;
        }

        $userData = $response->json();
        $emailAddresses = $userData['email_addresses'] ?? [];
        $primaryEmailAddressId = $userData['primary_email_address_id'] ?? null;

        foreach ($emailAddresses as $emailAddress) {
            if (($emailAddress['id'] ?? null) === $primaryEmailAddressId && !empty($emailAddress['email_address'])) {
                return $emailAddress['email_address'];
            }
        }

        foreach ($emailAddresses as $emailAddress) {
            if (!empty($emailAddress['email_address'])) {
                return $emailAddress['email_address'];
            }
        }

        return null;
    }
}
