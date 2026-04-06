<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\ResendEmailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class AuthController extends Controller
{
    public function __construct(
        private readonly ResendEmailService $resendEmailService,
    ) {}

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
        $payload = $request->validated();

        foreach (['order_updates', 'security_alerts', 'marketing_emails'] as $notificationField) {
            if (!Schema::hasColumn('users', $notificationField)) {
                unset($payload[$notificationField]);
            }
        }

        $user->fill($payload);
        $changedAttributes = array_keys($user->getDirty());
        $user->save();

        $this->sendProfileSecurityAlert($user, $changedAttributes);

        return response()->json([
            'message' => 'Profile updated',
            'user' => new UserResource($user->refresh()),
        ]);
    }

    /**
     * Send a basic account-change security email when the user has opted in.
     */
    private function sendProfileSecurityAlert(User $user, array $changedAttributes): void
    {
        if (!$user->security_alerts || !$user->email || empty($changedAttributes)) {
            return;
        }

        $displayableChanges = array_values(array_filter($changedAttributes, static function (string $field): bool {
            return !in_array($field, ['latitude', 'longitude', 'location_name', 'location_source', 'location_updated_at', 'updated_at'], true);
        }));

        if (empty($displayableChanges)) {
            return;
        }

        $changesLabel = implode(', ', array_map(
            static fn (string $field): string => str_replace('_', ' ', $field),
            array_slice($displayableChanges, 0, 8),
        ));

        $body = sprintf(
            "Hi %s,\n\nYour XETA account profile was updated.\nChanged fields: %s\n\nIf this wasn't you, please contact support immediately.",
            $user->first_name ?: ($user->name ?: 'there'),
            $changesLabel,
        );

        $this->resendEmailService->send($user->email, 'Security alert: profile updated', $body);
    }
}
