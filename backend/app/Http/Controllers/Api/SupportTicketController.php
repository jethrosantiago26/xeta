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
        $ticket = $this->supportTicketService->createTicket($request->user(), $request->validated());

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

        $message = $this->supportTicketService->addMessage(
            $ticketModel,
            $request->user(),
            $request->validated('message'),
            'customer'
        );

        return new SupportMessageResource($message);
    }
}
