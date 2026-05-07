<?php

namespace App\Services;

use Exception;
use Illuminate\Support\Facades\Http;

class AIService
{
    private string $apiKey;
    private const TEMPERATURE = 0.1;
    private const RESPONSE_MIME_TYPE = 'application/json';

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

ÖRNEK TOPLANTI GİRDİSİ:
"Sipariş oluşturulunca ÖdemeBekleniyor durumuna geçsin. Ödeme alınırsa Hazırlanıyor olsun. Kargoya verilince Kargoda, teslim edilince TeslimEdildi."

BEKLENEN JSON ÇIKTISI (örnek format):
{"nodes":[{"id":"n1","data":{"label":"ÖdemeBekleniyor"}},{"id":"n2","data":{"label":"Hazırlanıyor"}}],"edges":[{"id":"e1","source":"n1","target":"n2","label":"Ödeme alındı"}]}
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

ÖRNEK TOPLANTI GİRDİSİ:
"Kütüphane sisteminde Kitap ve Yazar sınıfları var. Yazar birçok Kitap yazabilir. Kitap'ın adı ve ISBN'i olsun."

BEKLENEN JSON ÇIKTISI (örnek format):
{"nodes":[{"id":"1","data":{"label":"Yazar","attributes":["ad:string"],"methods":[]}},{"id":"2","data":{"label":"Kitap","attributes":["ad:string","isbn:string"],"methods":[]}}],"edges":[{"id":"e1","source":"1","target":"2","label":"1:* yazar"}]}
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

ÖRNEK TOPLANTI GİRDİSİ:
"Kütüphane sisteminde Kitap ve Yazar sınıfları var. Yazar birçok Kitap yazabilir. Kitap'ın adı ve ISBN'i olsun."

BEKLENEN JSON ÇIKTISI (örnek format):
{"nodes":[{"id":"1","data":{"label":"Yazar","attributes":["ad:string"],"methods":[]}},{"id":"2","data":{"label":"Kitap","attributes":["ad:string","isbn:string"],"methods":[]}}],"edges":[{"id":"e1","source":"1","target":"2","label":"1:* yazar"}]}
PROMPT,
        };

        $combinedText = $systemPrompt."\n\n".$meetingText;

        // Retry mekanizması:
        // - 429/503 gibi yoğunluk hatalarında
        // - Modelin bozuk JSON üretmesinde
        // kullanıcıya hissettirmeden 1 kez daha dene (toplam max 2).
        $lastError = null;
        for ($attempt = 1; $attempt <= 2; $attempt++) {
            try {
                $response = Http::acceptJson()
                    ->asJson()
                    ->post($url, [
                        'generationConfig' => [
                            'temperature' => self::TEMPERATURE,
                            'response_mime_type' => self::RESPONSE_MIME_TYPE,
                        ],
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
                    $status = $response->status();

                    // Yoğunluk / rate-limit: 1 kez tekrar et
                    if (in_array($status, [429, 503], true) && $attempt === 1) {
                        continue;
                    }

                    throw new Exception("Google Hatası (HTTP {$status}): ".$response->body());
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

                // JSON mode açık olsa bile bazı cevaplar etrafına ekstra metin ekleyebilir.
                // Mevcut temizleme yaklaşımını koruyup biraz optimize ediyoruz.
                $cleanJson = trim($geminiResponse);
                $cleanJson = str_replace(["\u{FEFF}", '```json', '```'], '', $cleanJson);
                $cleanJson = trim($cleanJson);

                $jsonStart = strpos($cleanJson, '{');
                $jsonEnd = strrpos($cleanJson, '}');
                if ($jsonStart !== false && $jsonEnd !== false && $jsonEnd >= $jsonStart) {
                    $cleanJson = substr($cleanJson, $jsonStart, $jsonEnd - $jsonStart + 1);
                }

                $decoded = json_decode($cleanJson, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    // Bozuk JSON: 1 kez tekrar et
                    if ($attempt === 1) {
                        continue;
                    }

                    throw new Exception('Yapay zeka geçerli bir JSON üretemedi: '.json_last_error_msg());
                }

                return $decoded;
            } catch (Exception $e) {
                $lastError = $e;
                if ($attempt === 1) {
                    continue;
                }
                throw $e;
            }
        }

        // Teoride buraya düşmez; yine de güvenlik için.
        throw $lastError ?? new Exception('Yapay zeka çağrısı başarısız oldu.');
    }

    /**
     * Toplantı metninden yazılımcılar için eyleme dönüştürülebilir görevler üretir.
     *
     * Beklenen format:
     * [
     *   {"task_name":"...","description":"..."},
     *   ...
     * ]
     *
     * @return array<int, array<string, string>>
     *
     * @throws Exception
     */
    public function generateTasksFromText(string $text): array
    {
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='.$this->apiKey;

        $prompt = <<<'PROMPT'
Sen kıdemli bir teknik proje yöneticisi ve yazılım mimarısın. Sana bir geliştirme toplantısının kronolojik notlarını vereceğim.
GÖREVİN:
- Günlük sohbetleri yoksay.
- Yazılımcıların yapabileceği 3 ila 10 adet somut görev çıkar.
- Her görev için "task_name" kısa ve net olsun.
- "description" 1-2 cümle ile kabul kriteri/bağlam içersin.

ÇIKTI KURALLARI:
- Çıktı SADECE geçerli bir JSON array olmalı.
- Her eleman şu şekildedir: {"task_name":"...","description":"..."}
- Markdown, açıklama metni, kod bloğu işaretleri (```json) ASLA kullanma. Sadece saf JSON döndür.

ÖRNEK TOPLANTI GİRDİSİ:
"Kullanıcı girişi eklenecek. Şifreler hash’lenecek. Şifremi unuttum akışı lazım."

BEKLENEN JSON ÇIKTISI (örnek format):
[{"task_name":"Login API","description":"POST /login endpoint’i ekle; doğru kimlik bilgisiyle token dönsün, hatalıda 401 dönsün."},{"task_name":"Password hashing","description":"Kayıt olurken şifreyi bcrypt ile hash’le; düz metin şifre DB’ye yazılmasın."}]
PROMPT;

        $combinedText = $prompt."\n\n".$text;

        $lastError = null;
        for ($attempt = 1; $attempt <= 2; $attempt++) {
            try {
                $response = Http::acceptJson()
                    ->asJson()
                    ->post($url, [
                        'generationConfig' => [
                            'temperature' => self::TEMPERATURE,
                            'response_mime_type' => self::RESPONSE_MIME_TYPE,
                        ],
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
                    $status = $response->status();
                    if (in_array($status, [429, 503], true) && $attempt === 1) {
                        continue;
                    }
                    throw new Exception("Google Hatası (HTTP {$status}): ".$response->body());
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

                $cleanJson = trim($geminiResponse);
                $cleanJson = str_replace(["\u{FEFF}", '```json', '```'], '', $cleanJson);
                $cleanJson = trim($cleanJson);

                // Beklenen çıktı array, bu yüzden [] aralığını yakalamaya çalış.
                $arrStart = strpos($cleanJson, '[');
                $arrEnd = strrpos($cleanJson, ']');
                if ($arrStart !== false && $arrEnd !== false && $arrEnd >= $arrStart) {
                    $cleanJson = substr($cleanJson, $arrStart, $arrEnd - $arrStart + 1);
                }

                $decoded = json_decode($cleanJson, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    if ($attempt === 1) {
                        continue;
                    }
                    throw new Exception('Yapay zeka geçerli bir JSON üretemedi: '.json_last_error_msg());
                }

                if (! is_array($decoded)) {
                    if ($attempt === 1) {
                        continue;
                    }
                    throw new Exception('Yapay zeka beklenen formatta görev listesi üretmedi.');
                }

                // Şekil doğrulaması (hafif): task_name + description string olmalı
                $tasks = [];
                foreach ($decoded as $item) {
                    if (! is_array($item)) {
                        continue;
                    }
                    $name = $item['task_name'] ?? null;
                    $desc = $item['description'] ?? null;
                    if (is_string($name) && is_string($desc) && $name !== '' && $desc !== '') {
                        $tasks[] = ['task_name' => $name, 'description' => $desc];
                    }
                }

                if (count($tasks) < 3) {
                    if ($attempt === 1) {
                        continue;
                    }
                }

                return $tasks;
            } catch (Exception $e) {
                $lastError = $e;
                if ($attempt === 1) {
                    continue;
                }
                throw $e;
            }
        }

        throw $lastError ?? new Exception('Yapay zeka çağrısı başarısız oldu.');
    }
}
