<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSupportTicketRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['nullable', 'in:open,in_progress,waiting_customer,resolved,closed'],
            'assigned_admin_id' => ['nullable', 'integer', 'exists:users,id'],
            'resolution_summary' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
