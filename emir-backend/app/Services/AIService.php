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
     * Toplantı metnini Google Gemini üzerinden React Flow JSON verisine dönüştürür.
     *
     * @return array<string, mixed>
     *
     * @throws Exception
     */
    public function generateUmlFromText(string $meetingText, string $diagramType = 'class'): array
    {
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='.$this->apiKey;

        $systemPrompt = match ($diagramType) {
            'state' => <<<'PROMPT'
Sen kıdemli bir yazılım mimarısın. Sana verilen toplantı metninden bir Durum Diyagramı (State Machine Diagram) çıkar. Günlük diyalogları yoksay. Metinde bahsedilen süreçlerin durumlarını (states) ve bu durumlar arası geçişleri/tetikleyicileri (transitions) tespit et. Çıktı SADECE React Flow'a uygun geçerli bir JSON objesi olacaktır. 'nodes' (durumlar) ve 'edges' (geçişler/tetikleyiciler) içersin. Asla markdown (```json) kullanma, sadece saf JSON döndür.
PROMPT,
            'class' => <<<'PROMPT'
Sen kıdemli bir yazılım mimarısın. Sana bir yazılım ekibinin geliştirme toplantısına ait kronolojik konuşma ve mesaj kayıtlarını vereceğim.
GÖREVİN:

Günlük sohbetleri ve alakasız diyalogları tamamen yoksay.

Metinde AÇIKÇA bahsedilen Sınıfları (Classes), Özellikleri (Attributes) ve Metotları (Methods) tespit et.

Asla metinde geçmeyen bir sınıfı uydurma (Halüsinasyon kesinlikle yasak).

Sınıflar arasındaki ilişkileri (has-many, belongs-to, vb.) belirle.

ÇIKTI KURALLARI:

Çıktı SADECE geçerli ve kurallı bir JSON objesi olacaktır.

JSON objesi sadece iki ana dizi içermelidir: 'nodes' ve 'edges'.

'nodes' içindeki her obje id ve data (label, attributes, methods) içermelidir.

'edges' içindeki her obje id, source, target ve label içermelidir.

Çıktının başında veya sonunda ```json veya ``` gibi markdown işaretleri ASLA olmayacaktır. Sadece saf JSON döndür.
PROMPT,
            default => <<<'PROMPT'
Sen kıdemli bir yazılım mimarısın. Sana bir yazılım ekibinin geliştirme toplantısına ait kronolojik konuşma ve mesaj kayıtlarını vereceğim.
GÖREVİN:

Günlük sohbetleri ve alakasız diyalogları tamamen yoksay.

Metinde AÇIKÇA bahsedilen Sınıfları (Classes), Özellikleri (Attributes) ve Metotları (Methods) tespit et.

Asla metinde geçmeyen bir sınıfı uydurma (Halüsinasyon kesinlikle yasak).

Sınıflar arasındaki ilişkileri (has-many, belongs-to, vb.) belirle.

ÇIKTI KURALLARI:

Çıktı SADECE geçerli ve kurallı bir JSON objesi olacaktır.

JSON objesi sadece iki ana dizi içermelidir: 'nodes' ve 'edges'.

'nodes' içindeki her obje id ve data (label, attributes, methods) içermelidir.

'edges' içindeki her obje id, source, target ve label içermelidir.

Çıktının başında veya sonunda ```json veya ``` gibi markdown işaretleri ASLA olmayacaktır. Sadece saf JSON döndür.
PROMPT,
        };

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
        $geminiResponse = '';
        $parts = data_get($json, 'candidates.0.content.parts', []);
        if (is_array($parts)) {
            foreach ($parts as $part) {
                if (is_array($part) && isset($part['text']) && is_string($part['text'])) {
                    $geminiResponse .= $part['text'];
                }
            }
        }

        $cleanJson = str_replace(['```json', '```'], '', $geminiResponse);
        $cleanJson = trim($cleanJson);

        $jsonStart = strpos($cleanJson, '{');
        $jsonEnd = strrpos($cleanJson, '}');
        if ($jsonStart !== false && $jsonEnd !== false && $jsonEnd >= $jsonStart) {
            $cleanJson = substr($cleanJson, $jsonStart, $jsonEnd - $jsonStart + 1);
        }

        $decoded = json_decode($cleanJson, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Yapay zeka geçerli bir JSON üretemedi: '.json_last_error_msg());
        }

        return $decoded;
    }
}
