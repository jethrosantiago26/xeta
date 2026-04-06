<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ResendEmailService
{
    /**
     * Send a plain-text email through Resend.
     */
    public function send(string|array $to, string $subject, string $text, ?array &$details = null): bool
    {
        $details = null;
        $key = config('services.resend.key');
        $from = config('services.resend.from');

        if (!$key || !$from) {
            $details = [
                'status' => null,
                'message' => 'RESEND_API_KEY or RESEND_FROM_ADDRESS is missing.',
            ];

            Log::warning('Resend email not sent: missing configuration.');
            return false;
        }

        $recipients = is_array($to)
            ? array_values(array_filter(array_map('trim', $to)))
            : [trim($to)];

        if (empty($recipients)) {
            $details = [
                'status' => null,
                'message' => 'No recipients were provided.',
            ];

            return false;
        }

        try {
            $response = Http::withToken($key)
                ->post('https://api.resend.com/emails', [
                    'from' => $from,
                    'to' => $recipients,
                    'subject' => $subject,
                    'text' => $text,
                ]);

            if (!$response->successful()) {
                $errorMessage = $this->extractErrorMessage($response->json(), $response->body());

                $details = [
                    'status' => $response->status(),
                    'message' => $errorMessage,
                ];

                Log::warning('Resend email failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'to' => $recipients,
                    'subject' => Str::limit($subject, 120),
                ]);

                return false;
            }

            $details = [
                'status' => $response->status(),
                'message' => null,
            ];

            return true;
        } catch (\Throwable $error) {
            $details = [
                'status' => null,
                'message' => $error->getMessage(),
            ];

            Log::warning('Resend email exception', [
                'message' => $error->getMessage(),
                'to' => $recipients,
            ]);

            return false;
        }
    }

    private function extractErrorMessage(mixed $jsonBody, string $rawBody): string
    {
        if (is_array($jsonBody) && !empty($jsonBody['message'])) {
            return trim((string) $jsonBody['message']);
        }

        $rawBody = trim($rawBody);

        if ($rawBody !== '') {
            return $rawBody;
        }

        return 'Resend API request failed.';
    }
}
