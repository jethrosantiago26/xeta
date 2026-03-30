<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SupportTicketResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'ticket_number' => $this->ticket_number,
            'subject' => $this->subject,
            'type' => $this->type,
            'priority' => $this->priority,
            'status' => $this->status,
            'channel' => $this->channel,
            'description' => $this->description,
            'resolution_summary' => $this->resolution_summary,
            'last_reply_at' => $this->last_reply_at,
            'resolved_at' => $this->resolved_at,
            'closed_at' => $this->closed_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'user' => new UserResource($this->whenLoaded('user')),
            'assigned_admin' => new UserResource($this->whenLoaded('assignedAdmin')),
            'messages' => SupportMessageResource::collection($this->whenLoaded('messages')),
        ];
    }
}
