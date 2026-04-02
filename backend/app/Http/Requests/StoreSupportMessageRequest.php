<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSupportMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'message' => ['required_without:image', 'nullable', 'string', 'min:2'],
            'image' => ['nullable', 'image', 'max:5120'], // 5MB max
        ];
    }
}
