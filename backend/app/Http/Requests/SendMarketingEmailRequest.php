<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SendMarketingEmailRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'subject' => ['required', 'string', 'max:200'],
            'message' => ['required', 'string', 'max:10000'],
            'preview_only' => ['sometimes', 'boolean'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:1000'],
        ];
    }
}
