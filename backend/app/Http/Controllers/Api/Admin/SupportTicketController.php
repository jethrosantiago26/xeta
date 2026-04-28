<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSupportMessageRequest;
use App\Http\Requests\UpdateSupportTicketRequest;
use App\Http\Resources\SupportMessageResource;
use App\Http\Resources\SupportTicketResource;
use App\Models\SupportTicket;
use App\Services\SupportTicketService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class SupportTicketController extends Controller
{
    public function __construct(
        private readonly SupportTicketService $supportTicketService,
    ) {}

    /**
     * List support tickets for admins.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $allowedStatuses = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'];

        $query = SupportTicket::with(['user', 'assignedAdmin'])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $rawStatuses = preg_split('/\s*,\s*/', (string) $request->input('status')) ?: [];
            $statuses = array_values(array_intersect($allowedStatuses, array_filter($rawStatuses)));

            if (!empty($statuses)) {
                $query->whereIn('status', $statuses);
            } else {
                // An explicitly invalid status filter should return no records.
                $query->whereRaw('1 = 0');
            }
        }

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('search')) {
            $searchTerm = trim((string) $request->input('search'));

            if ($searchTerm !== '') {
                $like = '%' . $searchTerm . '%';

                $query->where(function ($builder) use ($like) {
                    $builder
                        ->where('ticket_number', 'like', $like)
                        ->orWhere('subject', 'like', $like)
                        ->orWhere('description', 'like', $like)
                        ->orWhereHas('user', function ($userQuery) use ($like) {
                            $userQuery
                                ->where('name', 'like', $like)
                                ->orWhere('email', 'like', $like);
                        });
                });
            }
        }

        $tickets = $query->paginate($request->integer('per_page', 20));

        $statusCounts = [
            'active' => SupportTicket::query()
                ->whereIn('status', ['open', 'in_progress', 'waiting_customer'])
                ->count(),
            'waiting' => SupportTicket::query()
                ->where('status', 'waiting_customer')
                ->count(),
            'resolved' => SupportTicket::query()
                ->whereIn('status', ['resolved', 'closed'])
                ->count(),
        ];

        return SupportTicketResource::collection($tickets)->additional([
            'status_counts' => $statusCounts,
        ]);
    }

    /**
     * Show a single support ticket with messages.
     */
    public function show(int $ticket): SupportTicketResource
    {
        $ticketModel = SupportTicket::with(['user', 'assignedAdmin', 'messages.user'])->findOrFail($ticket);

        return new SupportTicketResource($ticketModel);
    }

    /**
     * Update a support ticket.
     */
    public function update(UpdateSupportTicketRequest $request, int $ticket): SupportTicketResource
    {
        $ticketModel = SupportTicket::findOrFail($ticket);

        $updated = $this->supportTicketService->updateTicket(
            $ticketModel,
            $request->validated(),
            $request->user(),
        );

        return new SupportTicketResource($updated->load(['user', 'assignedAdmin']));
    }

    /**
     * Add an admin reply to the support ticket.
     */
    public function storeMessage(StoreSupportMessageRequest $request, int $ticket): SupportMessageResource
    {
        $ticketModel = SupportTicket::findOrFail($ticket);

        $imageUrl = $this->storeUploadedImage($request);
        $messageText = $request->validated('message') ?? '';

        if (empty(trim($messageText)) && !$imageUrl) {
            throw ValidationException::withMessages([
                'message' => ['A message or image is required.'],
            ]);
        }

        $message = $this->supportTicketService->addMessage(
            $ticketModel,
            $request->user(),
            $messageText ?: 'Image attached',
            'admin',
            true,
            $imageUrl
        );

        return new SupportMessageResource($message);
    }

    /**
     * Store an uploaded image to the public disk and return the URL.
     */
    private function storeUploadedImage(Request $request): ?string
    {
        if (!$request->hasFile('image') || !$request->file('image')->isValid()) {
            return null;
        }

        $diskName = $this->resolveAttachmentDisk();
        $directory = trim((string) config('support.attachments_directory', 'support-attachments'), '/');

        $path = Storage::disk($diskName)->putFile(
            $directory !== '' ? $directory : 'support-attachments',
            $request->file('image'),
        );

        if (!$path) {
            throw ValidationException::withMessages([
                'image' => ['Unable to store the uploaded image. Please try again.'],
            ]);
        }

        return $this->resolveAttachmentUrl($diskName, $path);
    }

    private function resolveAttachmentDisk(): string
    {
        $configured = trim((string) config('support.attachments_disk', 'public'));
        $diskName = $configured !== '' ? $configured : 'public';

        // The default local disk is private in this project, so map it to the public disk for attachments.
        if ($diskName === 'local') {
            $diskName = 'public';
        }

        if (!is_array(config("filesystems.disks.{$diskName}"))) {
            return 'public';
        }

        return $diskName;
    }

    private function resolveAttachmentUrl(string $diskName, string $path): string
    {
        $normalizedPath = ltrim(str_replace('\\', '/', $path), '/');

        if ($diskName === 'public') {
            return '/storage/' . $normalizedPath;
        }

        $diskUrl = rtrim((string) config("filesystems.disks.{$diskName}.url", ''), '/');

        if ($diskUrl !== '') {
            return $diskUrl . '/' . $normalizedPath;
        }

        return '/storage/' . $normalizedPath;
    }
}
