<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreTranscriptRequest extends FormRequest
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
            'content' => ['required', 'string', 'max:20000'],
            'is_final' => ['sometimes', 'boolean'],
            'spoken_at' => ['nullable', 'date'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'user_name' => ['nullable', 'string', 'max:120'],
            'deepgram' => ['nullable', 'array'],
        ];
    }
}
