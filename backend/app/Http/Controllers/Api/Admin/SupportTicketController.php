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
        $query = SupportTicket::with(['user', 'assignedAdmin'])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        $tickets = $query->paginate($request->integer('per_page', 20));

        return SupportTicketResource::collection($tickets);
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
            $messageText ?: '📷 Image attached',
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

        $path = $request->file('image')->store('support-attachments', 'public');

        return '/storage/' . $path;
    }
}
