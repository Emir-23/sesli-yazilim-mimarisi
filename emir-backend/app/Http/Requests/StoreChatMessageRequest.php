<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreChatMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'message' => ['required', 'string', 'max:4000'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'user_name' => ['nullable', 'string', 'max:120'],
            'sent_at' => ['nullable', 'date'],
        ];
    }
}
