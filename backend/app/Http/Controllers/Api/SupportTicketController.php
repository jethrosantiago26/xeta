<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSupportMessageRequest;
use App\Http\Requests\StoreSupportTicketRequest;
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
     * List the authenticated user's tickets.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $tickets = $request->user()
            ->supportTickets()
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 10));

        return SupportTicketResource::collection($tickets);
    }

    /**
     * Create a new support ticket.
     */
    public function store(StoreSupportTicketRequest $request): SupportTicketResource
    {
        $imageUrl = $this->storeUploadedImage($request);

        $ticket = $this->supportTicketService->createTicket(
            $request->user(),
            $request->validated(),
            $imageUrl,
        );

        return new SupportTicketResource($ticket->load(['user']));
    }

    /**
     * Show a single support ticket with messages.
     */
    public function show(Request $request, int $ticket): SupportTicketResource
    {
        $ticketModel = $request->user()
            ->supportTickets()
            ->with(['messages.user', 'assignedAdmin'])
            ->findOrFail($ticket);

        return new SupportTicketResource($ticketModel);
    }

    /**
     * Add a customer reply to the support ticket.
     */
    public function storeMessage(StoreSupportMessageRequest $request, int $ticket): SupportMessageResource
    {
        $ticketModel = $request->user()
            ->supportTickets()
            ->findOrFail($ticket);

        $imageUrl = $this->storeUploadedImage($request);
        $messageText = $request->validated('message') ?? '';

        // Ensure at least image or message is present
        if (empty(trim($messageText)) && !$imageUrl) {
            throw ValidationException::withMessages([
                'message' => ['A message or image is required.'],
            ]);
        }

        $message = $this->supportTicketService->addMessage(
            $ticketModel,
            $request->user(),
            $messageText ?: 'Image attached',
            'customer',
            true,
            $imageUrl,
        );

        return new SupportMessageResource($message);
    }

    /**
     * Reopen a closed or resolved support ticket.
     */
    public function reopen(Request $request, int $ticket)
    {
        $ticketModel = $request->user()
            ->supportTickets()
            ->findOrFail($ticket);

        if ($ticketModel->status !== 'resolved' && $ticketModel->status !== 'closed') {
            return response()->json(['message' => 'Only resolved or closed tickets can be reopened.'], 422);
        }

        $this->supportTicketService->updateTicket($ticketModel, ['status' => 'open'], $request->user());

        $this->supportTicketService->addMessage(
            $ticketModel,
            $request->user(),
            'Ticket reopened by customer.',
            'system',
            true
        );

        return new SupportTicketResource($ticketModel->refresh());
    }

    /**
     * Store an uploaded image to the public disk and return the URL.
     */
    private function storeUploadedImage(Request $request): ?string
    {
        if (!$request->hasFile('image') || !$request->file('image')->isValid()) {
            return null;
        }

        $path = Storage::disk('public')->putFile('support-attachments', $request->file('image'));

        if (!$path) {
            throw ValidationException::withMessages([
                'image' => ['Unable to store the uploaded image. Please try again.'],
            ]);
        }

        return '/storage/' . ltrim(str_replace('\\', '/', $path), '/');
    }
}
