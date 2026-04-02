<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SupportMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $authorName = $this->user?->name;

        if ($this->author_role === 'system') {
            $authorName = 'System';
        } else if ($this->author_role === 'admin') {
            $authorName = $this->user?->name ?? 'Support Agent';
        }

        return [
            'id' => $this->id,
            'message' => $this->message,
            'image_url' => $this->image_url,
            'author_role' => $this->author_role,
            'author_name' => $authorName,
            'created_at' => $this->created_at,
        ];
    }
}
