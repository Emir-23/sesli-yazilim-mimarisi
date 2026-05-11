<?php

namespace App\Services;

use Exception;
use Illuminate\Support\Facades\Http;
use JsonException;

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

    /**
     * Diyagram (düğüm ve kenar) verisinden geliştirici sprint görevleri üretir.
     *
     * @param  array<string, mixed>  $diagramData
     * @return list<array<string, mixed>>
     *
     * @throws Exception
     */
    public function generateSprintTasksFromDiagram(array $diagramData): array
    {
        if ($this->apiKey === '') {
            throw new Exception('GEMINI API anahtarı yapılandırılmamış (services.gemini.key).');
        }

        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='.$this->apiKey;

        $diagramJson = json_encode($diagramData, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);

        $systemPrompt = <<<'PROMPT'
Sen bir teknik lider ve agile koçsun. Görevin, verilen mimari diyagram JSON'unu (viewport, nodes[], edges[]) inceleyerek yazılım ekibi için eyleme dönüştürülebilir sprint görevleri üretmektir.

Kurallar:
- Yanıtın SADECE geçerli bir JSON dizisi (array) olmalı; dışında açıklama, markdown veya kod bloğu kullanma.
- Her görev şu alanları içermeli: "title" (kısa başlık), "description" (ne yapılacağı), "priority" ("P0"|"P1"|"P2"|"P3"), "area" ("backend"|"frontend"|"devops"|"data"|"qa"|"mobile"|"other"), "acceptance_criteria" (string dizisi), "related_node_ids" (diyagramdaki node id dizisi, bilinmiyorsa boş dizi).
- Görevler bağımlılık sırasına uygun, test edilebilir ve tahmin edilebilir parçalara bölünsün.
- 5 ile 20 görev arasında üret; mimari basitse daha az, karmaşıksa daha çok.
PROMPT;

        $combinedText = $systemPrompt."\n\nDiyagram JSON:\n".$diagramJson;

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
        if (! is_array($json)) {
            throw new Exception('Google yanıtı işlenemedi: '.$response->body());
        }

        $rawText = $this->extractGeminiResponseText($json);
        $tasks = $this->decodeTaskListJson($rawText);

        return $tasks;
    }

    /**
     * @param  array<string, mixed>|null  $responseJson
     */
    private function extractGeminiResponseText(?array $responseJson): string
    {
        $rawText = '';
        $parts = data_get($responseJson, 'candidates.0.content.parts', []);
        if (is_array($parts)) {
            foreach ($parts as $part) {
                if (is_array($part) && isset($part['text']) && is_string($part['text'])) {
                    $rawText .= $part['text'];
                }
            }
        }

        return $rawText;
    }

    /**
     * @return list<array<string, mixed>>
     *
     * @throws Exception
     */
    private function decodeTaskListJson(string $rawText): array
    {
        $trimmed = trim($rawText);
        if (preg_match('/```(?:json)?\s*(.*?)\s*```/s', $trimmed, $m)) {
            $trimmed = trim($m[1]);
        }

        try {
            $decoded = json_decode($trimmed, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new Exception('Gemini yanıtı geçerli JSON değil: '.$rawText);
        }

        if (isset($decoded['tasks']) && is_array($decoded['tasks'])) {
            $decoded = $decoded['tasks'];
        }

        if (! is_array($decoded) || ($decoded !== [] && ! array_is_list($decoded))) {
            throw new Exception('Beklenen görev listesi (JSON array) alınamadı.');
        }

        /** @var list<array<string, mixed>> $out */
        $out = [];
        foreach ($decoded as $row) {
            if (is_array($row) && isset($row['title']) && is_string($row['title']) && $row['title'] !== '') {
                $out[] = $row;
            }
        }

        if ($out === []) {
            throw new Exception('Geçerli görev satırı bulunamadı.');
        }

        return $out;
    }
}
