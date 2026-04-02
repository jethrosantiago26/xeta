<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSupportTicketRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'subject' => ['required', 'string', 'max:160'],
            'type' => ['required', 'in:order,payment,shipping,product,account,other'],
            'priority' => ['required', 'in:low,normal,high,urgent'],
            'message' => ['required', 'string', 'min:10'],
            'image' => ['nullable', 'image', 'max:5120'], // 5MB max
        ];
    }
}
