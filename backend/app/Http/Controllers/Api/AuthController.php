<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    /**
     * Get the currently authenticated user.
     */
    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    /**
     * Sync user data from Clerk (called on first login or profile update).
     */
    public function sync(Request $request): JsonResponse
    {
        // User is already synced by ClerkAuthenticate middleware
        $user = $request->user()->refresh();

        return response()->json([
            'status' => 'success',
            'message' => 'User account synchronized with Clerk',
            'data' => new UserResource($user),
        ]);
    }

    /**
     * Update the signed-in user's profile details.
     */
    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->fill($request->validated());
        $user->save();

        return response()->json([
            'message' => 'Profile updated',
            'user' => new UserResource($user->refresh()),
        ]);
    }
}
