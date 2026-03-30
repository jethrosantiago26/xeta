<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SupportMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $authorName = $this->user?->name;

        if (!$authorName && $this->author_role === 'system') {
            $authorName = 'System';
        }

        return [
            'id' => $this->id,
            'message' => $this->message,
            'author_role' => $this->author_role,
            'author_name' => $authorName,
            'created_at' => $this->created_at,
        ];
    }
}
