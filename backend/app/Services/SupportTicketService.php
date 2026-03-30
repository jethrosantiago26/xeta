<?php

namespace App\Services;

use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SupportTicketService
{
    public function createTicket(User $user, array $payload): SupportTicket
    {
        $ticket = SupportTicket::create([
            'user_id' => $user->id,
            'ticket_number' => SupportTicket::generateTicketNumber(),
            'subject' => $payload['subject'],
            'type' => $payload['type'],
            'priority' => $payload['priority'],
            'status' => 'open',
            'channel' => 'web',
            'description' => $payload['message'],
            'last_reply_at' => Carbon::now(),
        ]);

        $this->addMessage($ticket, $user, $payload['message'], 'customer', false);

        $this->notifySupportInbox($ticket, $payload['message']);
        $this->notifyCustomer($ticket, $user, 'We received your support request.', $payload['message']);

        return $ticket->refresh();
    }

    public function addMessage(
        SupportTicket $ticket,
        User $user,
        string $message,
        string $role,
        bool $sendEmail = true,
    ): SupportMessage {
        $record = SupportMessage::create([
            'ticket_id' => $ticket->id,
            'user_id' => $user->id,
            'author_role' => $role,
            'message' => $message,
        ]);

        $ticket->last_reply_at = Carbon::now();

        if ($role === 'admin' && $ticket->status !== 'resolved' && $ticket->status !== 'closed') {
            $ticket->status = 'waiting_customer';
        }

        if ($role === 'customer' && $ticket->status === 'waiting_customer') {
            $ticket->status = 'in_progress';
        }

        if ($ticket->isDirty()) {
            $ticket->save();
        }

        if ($sendEmail) {
            if ($role === 'admin') {
                $this->notifyCustomer($ticket, $ticket->user, 'Support update from XETA', $message);
            } else {
                $this->notifySupportInbox($ticket, $message);
            }
        }

        return $record;
    }

    public function updateTicket(SupportTicket $ticket, array $payload, ?User $admin = null): SupportTicket
    {
        $previousStatus = $ticket->status;

        if (array_key_exists('status', $payload) && $payload['status']) {
            $ticket->status = $payload['status'];
        }

        if (array_key_exists('priority', $payload) && $payload['priority']) {
            $ticket->priority = $payload['priority'];
        }

        if (array_key_exists('assigned_admin_id', $payload)) {
            $ticket->assigned_admin_id = $payload['assigned_admin_id'];
        }

        if (array_key_exists('resolution_summary', $payload)) {
            $ticket->resolution_summary = $payload['resolution_summary'];
        }

        if ($ticket->status === 'resolved') {
            $ticket->resolved_at = $ticket->resolved_at ?? Carbon::now();
        } else {
            $ticket->resolved_at = null;
        }

        if ($ticket->status === 'closed') {
            $ticket->closed_at = $ticket->closed_at ?? Carbon::now();
        } else {
            $ticket->closed_at = null;
        }

        if ($ticket->isDirty()) {
            $ticket->save();
        }

        if ($previousStatus !== $ticket->status && $ticket->status === 'resolved') {
            $this->notifyCustomer(
                $ticket,
                $ticket->user,
                'Your support ticket has been resolved',
                $ticket->resolution_summary ?: 'Your ticket has been resolved. Let us know if you need more help.'
            );
        }

        return $ticket;
    }

    private function notifySupportInbox(SupportTicket $ticket, string $message): void
    {
        $recipients = $this->resolveSupportRecipients();

        if (empty($recipients)) {
            return;
        }

        $subject = sprintf('New support message [%s]', $ticket->ticket_number);
        $body = sprintf(
            "Ticket %s\nSubject: %s\nPriority: %s\nStatus: %s\n\nMessage:\n%s",
            $ticket->ticket_number,
            $ticket->subject,
            $ticket->priority,
            $ticket->status,
            $message,
        );

        $this->sendEmail($recipients, $subject, $body);
    }

    /**
     * Resolve support recipients by combining explicit support inboxes and admin emails.
     */
    private function resolveSupportRecipients(): array
    {
        $configuredInbox = config('services.resend.support_inbox');
        $configuredRecipients = [];

        if (is_string($configuredInbox) && trim($configuredInbox) !== '') {
            $configuredRecipients = array_map('trim', explode(',', $configuredInbox));
        } elseif (is_array($configuredInbox)) {
            $configuredRecipients = $configuredInbox;
        }

        $adminEmails = config('admin.emails', []);
        $adminRecipients = is_array($adminEmails) ? $adminEmails : [];

        return array_values(array_unique(array_filter(array_map('trim', [
            ...$configuredRecipients,
            ...$adminRecipients,
        ]))));
    }

    private function notifyCustomer(SupportTicket $ticket, ?User $user, string $subject, string $message): void
    {
        if (!$user?->email) {
            return;
        }

        $body = sprintf(
            "Ticket %s\nSubject: %s\nStatus: %s\n\n%s",
            $ticket->ticket_number,
            $ticket->subject,
            $ticket->status,
            $message,
        );

        $this->sendEmail($user->email, $subject, $body);
    }

    private function sendEmail(string|array $to, string $subject, string $text): void
    {
        $key = config('services.resend.key');
        $from = config('services.resend.from');

        if (!$key || !$from) {
            Log::warning('Resend email not sent: missing configuration.');
            return;
        }

        $recipients = is_array($to)
            ? array_values(array_filter(array_map('trim', $to)))
            : [trim($to)];

        if (empty($recipients)) {
            return;
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
                Log::warning('Resend email failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'to' => $recipients,
                    'subject' => Str::limit($subject, 120),
                ]);
            }
        } catch (\Throwable $error) {
            Log::warning('Resend email exception', [
                'message' => $error->getMessage(),
                'to' => $recipients,
            ]);
        }
    }
}
