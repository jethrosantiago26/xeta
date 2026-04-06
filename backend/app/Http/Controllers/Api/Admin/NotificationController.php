<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\SendMarketingEmailRequest;
use App\Models\User;
use App\Services\ResendEmailService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class NotificationController extends Controller
{
    public function __construct(
        private readonly ResendEmailService $resendEmailService,
    ) {}

    /**
     * Send a marketing email campaign to users who opted in.
     */
    public function sendMarketing(SendMarketingEmailRequest $request): JsonResponse
    {
        if (!Schema::hasColumn('users', 'marketing_emails')) {
            return response()->json([
                'message' => 'Marketing preferences are not available yet. Run the latest database migration first.',
                'sent_count' => 0,
                'recipient_count' => 0,
                'failed_count' => 0,
                'opted_in_count' => 0,
                'run_summary' => $this->buildRunSummary(0, 0, 0, 0),
            ], 409);
        }

        $validated = $request->validated();

        $subject = $validated['subject'];
        $message = $validated['message'];
        $previewOnly = (bool) ($validated['preview_only'] ?? false);
        $limit = (int) ($validated['limit'] ?? 1000);
        $limit = max(1, min(1000, $limit));

        $optedInUsersQuery = $this->marketingOptInQuery();
        $optedInCount = (clone $optedInUsersQuery)->count();
        $recipients = $this->resolveRecipientEmails(clone $optedInUsersQuery, $limit);

        if (empty($recipients)) {
            Log::info('Marketing campaign skipped: no deliverable recipients', [
                'opted_in_count' => $optedInCount,
                'limit' => $limit,
            ]);

            return response()->json([
                'message' => $optedInCount > 0
                    ? 'Opted-in users exist, but none have a deliverable email address.'
                    : 'No opted-in recipients found.',
                'sent_count' => 0,
                'failed_count' => 0,
                'recipient_count' => 0,
                'opted_in_count' => $optedInCount,
                'run_summary' => $this->buildRunSummary($optedInCount, 0, 0, 0),
            ]);
        }

        if ($previewOnly) {
            return response()->json([
                'message' => 'Preview generated. No emails were sent.',
                'sent_count' => 0,
                'failed_count' => 0,
                'recipient_count' => count($recipients),
                'opted_in_count' => $optedInCount,
                'run_summary' => $this->buildRunSummary($optedInCount, count($recipients), 0, 0),
                'sample_recipients' => array_slice($recipients, 0, 10),
            ]);
        }

        $sentCount = 0;
        $failedCount = 0;
        $failureReasons = [];

        foreach ($recipients as $recipient) {
            $details = null;
            $sent = $this->resendEmailService->send($recipient, $subject, $message, $details);

            if ($sent) {
                $sentCount++;
                continue;
            }

            $failedCount++;

            $reason = trim((string) ($details['message'] ?? 'Email delivery failed for this recipient.'));

            if ($reason !== '') {
                $failureReasons[] = $this->humanizeFailureReason($reason);
            }

            Log::warning('Marketing campaign recipient delivery failed', [
                'recipient' => $recipient,
                'status' => $details['status'] ?? null,
                'reason' => $reason,
            ]);
        }

        $failureReasons = array_values(array_unique(array_filter($failureReasons)));

        return response()->json([
            'message' => $this->buildCampaignResultMessage($sentCount, $failedCount, $failureReasons),
            'sent_count' => $sentCount,
            'failed_count' => $failedCount,
            'recipient_count' => count($recipients),
            'opted_in_count' => $optedInCount,
            'failure_reasons' => array_slice($failureReasons, 0, 3),
            'run_summary' => $this->buildRunSummary($optedInCount, count($recipients), $sentCount, $failedCount),
        ]);
    }

    private function buildCampaignResultMessage(int $sentCount, int $failedCount, array $failureReasons): string
    {
        if ($failedCount === 0) {
            return 'Marketing campaign completed.';
        }

        $reason = $failureReasons[0] ?? 'Email delivery failed for one or more recipients.';

        if ($sentCount === 0) {
            return 'Marketing campaign failed. ' . $reason;
        }

        return 'Marketing campaign partially completed. ' . $reason;
    }

    private function humanizeFailureReason(string $reason): string
    {
        $normalized = trim(preg_replace('/\s+/', ' ', $reason) ?? $reason);
        $lower = Str::lower($normalized);

        if (
            Str::contains($lower, 'you can only send testing emails to your own email address')
            || Str::contains($lower, 'verify a domain at resend.com/domains')
        ) {
            return 'Resend is in testing mode. Verify a domain at resend.com/domains and set RESEND_FROM_ADDRESS to that verified domain.';
        }

        return $normalized;
    }

    private function buildRunSummary(int $optedInCount, int $deliverableCount, int $sentCount, int $failedCount): array
    {
        return [
            ['label' => 'Opted-in users', 'value' => $optedInCount],
            ['label' => 'Deliverable emails', 'value' => $deliverableCount],
            ['label' => 'Sent', 'value' => $sentCount],
            ['label' => 'Failed', 'value' => $failedCount],
        ];
    }

    private function marketingOptInQuery(): Builder
    {
        return User::query()->where(function (Builder $query): void {
            // Be resilient to historical/legacy values across dbs and manual edits.
            $query->where('marketing_emails', true)
                ->orWhere('marketing_emails', 1)
                ->orWhere('marketing_emails', '1')
                ->orWhereRaw("LOWER(CAST(marketing_emails AS CHAR)) = 'true'");
        });
    }

    private function resolveRecipientEmails(Builder $query, int $limit): array
    {
        return $query
            ->whereNotNull('email')
            ->whereRaw("TRIM(email) <> ''")
            ->orderBy('id')
            ->limit($limit)
            ->pluck('email')
            ->map(static fn (mixed $email): string => strtolower(trim((string) $email)))
            ->filter(static fn (string $email): bool => $email !== '')
            ->unique()
            ->values()
            ->all();
    }
}
