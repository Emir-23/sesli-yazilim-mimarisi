<?php

namespace App\Services;

use Exception;
use Illuminate\Support\Facades\Http;

class AIService
{
    private string $apiKey;

    public function __construct()
    {
        $this->apiKey = (string) config('services.gemini.key', '');
    }

    /**
     * Toplantı metnini Google Gemini üzerinden PlantUML kaynak koduna dönüştürür.
     *
     * @throws Exception
     */
    public function generateUmlFromText(string $meetingText): string
    {
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='.$this->apiKey;

        $systemPrompt = <<<'PROMPT'
Sen deneyimli bir Yazılım Mimarısın. Görevin, verilen toplantı veya tartışma metninden yazılım mimarisini yansıtan geçerli PlantUML diyagramları üretmektir.

Kurallar:
- Sadece ham PlantUML kaynak kodunu döndür; açıklama, özet veya "işte diyagram" gibi metin yazma.
- Çıktın mutlaka @startuml ile başlamalı ve @enduml ile bitmeli.
- Markdown kod bloğu (```), başlık veya etiket kullanma.
- Metindeki bileşenleri, ilişkileri ve akışı mimari olarak anlamlı şekilde modelle.
PROMPT;

        $combinedText = $systemPrompt."\n\n".$meetingText;

        $response = Http::acceptJson()
            ->asJson()
            ->post($url, [
                'contents' => [
                    [
                        'role' => 'user',
                        'parts' => [
                            ['text' => $combinedText],
                        ],
                    ],
                ],
            ]);

        if ($response->failed()) {
            throw new Exception('Google Hatası: '.$response->body());
        }

        $json = $response->json();
        $rawText = '';
        $parts = data_get($json, 'candidates.0.content.parts', []);
        if (is_array($parts)) {
            foreach ($parts as $part) {
                if (is_array($part) && isset($part['text']) && is_string($part['text'])) {
                    $rawText .= $part['text'];
                }
            }
        }

        if (! preg_match('/@startuml(.*?)@enduml/s', $rawText, $matches)) {
            throw new Exception('Google Hatası: '.$response->body());
        }

        return trim('@startuml'.$matches[1].'@enduml');
    }
}
