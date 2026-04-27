<?php

namespace App\Services;

class DeepgramService
{
    /**
     * @return array<string, mixed>
     */
    public function liveConfig(): array
    {
        return [
            'provider' => 'deepgram',
            'model' => config('services.deepgram.model', 'nova-3'),
            'language' => config('services.deepgram.language', 'tr'),
            'punctuate' => true,
            'smart_format' => true,
            'interim_results' => true,
            'vad_events' => true,
            'endpointing' => 500,
            'url' => 'wss://api.deepgram.com/v1/listen',
            'auth_mode' => 'token',
            'note' => 'Client should connect with Authorization: Token <DEEPGRAM_API_KEY> header.',
        ];
    }
}
