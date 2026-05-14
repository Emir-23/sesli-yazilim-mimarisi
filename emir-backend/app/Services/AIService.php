<?php

namespace App\Services;

use Exception;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;
use JsonException;

class AIService
{
    private string $apiKey;

    /** UML isteğinde bağlam çok uzunsa model dağılmasın diye üst sınır (UTF-8 bayt değil karakter) */
    private const UML_INPUT_MAX_CHARS = 28000;

    public function __construct()
    {
        $this->apiKey = trim((string) config('services.gemini.key', ''));
    }

    /**
     * @throws InvalidArgumentException
     */
    private function assertGeminiApiKeyPresent(): void
    {
        if ($this->apiKey === '') {
            throw new InvalidArgumentException('Lütfen .env dosyanıza GEMINI_API_KEY ekleyin.');
        }
    }

    private function normalizedGeminiModelId(): string
    {
        $raw = trim((string) config('services.gemini.model', 'gemini-2.5-flash'));
        $raw = ltrim($raw, '/');
        while (str_starts_with($raw, 'models/')) {
            $raw = trim(substr($raw, strlen('models/')));
        }
        $raw = trim($raw);
        if (($colon = strpos($raw, ':')) !== false) {
            $raw = substr($raw, 0, $colon);
        }
        $raw = trim($raw);

        // generativelanguage.googleapis.com/v1 altında 1.5-flash artık yok; eski .env değerlerini tek modele sabitle
        if ($raw !== '' && str_starts_with(strtolower($raw), 'gemini-1.5-flash')) {
            $raw = 'gemini-2.5-flash';
        }

        return $raw !== '' ? $raw : 'gemini-2.5-flash';
    }

    private function geminiGenerateContentEndpoint(): string
    {
        $model = $this->normalizedGeminiModelId();

        return sprintf(
            'https://generativelanguage.googleapis.com/v1/models/%s:generateContent',
            rawurlencode($model)
        );
    }

    /**
     * Gemini REST: anahtar Google'ın beklediği biçimde URL sorgu parametresi ?key=... olarak eklenir.
     *
     * @param  array<string, mixed>  $body
     *
     * @throws InvalidArgumentException
     */
    private function postGeminiGenerateContent(array $body): Response
    {
        $this->assertGeminiApiKeyPresent();

        return Http::timeout((int) config('services.gemini.timeout', 60))
            ->acceptJson()
            ->asJson()
            ->withQueryParameters(['key' => $this->apiKey])
            ->post($this->geminiGenerateContentEndpoint(), $body);
    }

    /**
     * Çok uzun toplantı metnini kısaltır; baş ve son bölüm korunur.
     */
    private function truncateMeetingTextForUml(string $text): string
    {
        $t = trim($text);
        $max = self::UML_INPUT_MAX_CHARS;
        if (mb_strlen($t) <= $max) {
            return $t;
        }
        $head = (int) floor($max * 0.52);
        $tail = $max - $head - 100;
        $prefix = mb_substr($t, 0, $head);
        $suffix = mb_substr($t, -max(0, $tail));

        return $prefix."\n\n[... uzun metnin ortası çıkarıldı; çekirdek baş ve son bölüm korundu ...]\n\n".$suffix;
    }

    /**
     * @return array<string, mixed>
     */
    private function umlGenerationConfig(float $temperature): array
    {
        $cfg = [
            'temperature' => $temperature,
            'topP' => (float) config('services.gemini.top_p', 0.92),
            'maxOutputTokens' => (int) config('services.gemini.max_output_tokens', 8192),
        ];
        if (filter_var(config('services.gemini.uml_json_mode', true), FILTER_VALIDATE_BOOL)) {
            $cfg['responseMimeType'] = 'application/json';
        }

        return $cfg;
    }

    private function responseBodyLooksLikeHtml(string $body): bool
    {
        $head = strtolower(substr($body, 0, 800));

        return str_contains($head, '<!doctype') || str_contains($head, '<html');
    }

    /**
     * HTML veya boş gövdeyi kullanıcıya göstermez; anlaşılır Türkçe mesaj üretir.
     */
    private function geminiHttpFailureMessage(Response $response): string
    {
        $status = $response->status();
        $body = $response->body();

        if ($status === 429) {
            return 'Google yapay zeka servisleri çok yoğun veya istek sınırına ulaşıldı. Lütfen bir süre sonra tekrar deneyin.';
        }

        if (in_array($status, [500, 502, 503, 504], true) || $this->responseBodyLooksLikeHtml($body)) {
            return 'Google yapay zeka sunucuları şu an yoğun veya geçici olarak yanıt veremiyor. Lütfen kısa bir süre sonra tekrar deneyin.';
        }

        $json = $response->json();
        if (is_array($json) && isset($json['error']['message']) && is_string($json['error']['message']) && $json['error']['message'] !== '') {
            return $json['error']['message'];
        }

        return 'Google yapay zeka sunucuları şu an yoğun veya geçici olarak yanıt veremiyor. Lütfen kısa bir süre sonra tekrar deneyin.';
    }

    private function geminiNonJsonResponseMessage(Response $response): string
    {
        $body = $response->body();
        if ($this->responseBodyLooksLikeHtml($body)) {
            return 'Google yapay zeka sunucuları şu an yoğun veya geçici olarak yanıt veremiyor. Lütfen kısa bir süre sonra tekrar deneyin.';
        }

        return 'Google yanıtı işlenemedi. Sunucular yoğun olabilir; lütfen kısa bir süre sonra tekrar deneyin.';
    }

    /**
     * Toplantı metninden React Flow tuvalinde çizilecek düğüm ve kenar listesi üretir (JSON).
     *
     * @param  string  $type  "class" | "use_case"
     * @return array{nodes: list<array<string, mixed>>, edges: list<array<string, mixed>>}
     *
     * @throws InvalidArgumentException GEMINI_API_KEY yoksa
     * @throws Exception Google veya çıktı hatası
     */
    public function generateUmlFromText(string $meetingText, string $type = 'class'): array
    {
        $type = $type === 'use_case' ? 'use_case' : 'class';

        if ($type === 'use_case') {
            $systemPrompt = <<<'PROMPT'
Sen UML Use Case diyagramları konusunda uzmansın. Görevin, verilen toplantı veya tartışma metninden React Flow kütüphanesinde doğrudan kullanılabilecek bir Use Case görünümü üretmektir.

KRİTİK — ÇIKTI BİÇİMİ (buna uyulmazsa yanıt geçersizdir):
YALNIZCA geçerli bir JSON objesi döndür. İçinde "nodes" ve "edges" dizileri olsun.
Asla markdown, kod çiti (üçlü tırnak blokları), başlık, özet, açıklama veya JSON dışında tek karakter bile yazma.

Kalite — metinden model çıkarma (bu adımları yanıtta yazma; doğrudan uygula):
1) Metindeki rolleri, dış sistemleri ve kullanıcıların yapmak istediği somut hedefleri ayırt et (ör. "öğrenci", "ödeme sağlayıcısı", "admin", "raporlama servisi").
2) Her kullanım senaryosu tek bir net iş faydası ifade etsin; çok genel "Yönet" yerine "Ders Kaydı Oluştur", "Fatura İndir" gibi isimler kullan.
3) Metinde geçmeyen senaryoları abartmadan ekleme; belirsizse daha az düğüm ve daha net ilişki tercih et.
4) En fazla 12 düğüm; mümkünse hem aktör hem en az iki use case olsun.

Use Case diyagramı kuralları (kesin):
- Yanıtın YALNIZCA tek bir JSON nesnesi olmalı; PlantUML veya düz metin kullanma.
- Kök nesnede tam olarak iki alan olmalı: "nodes" (dizi) ve "edges" (dizi).
- "nodes": her düğüm bir "Aktör" (insan kullanıcı türü veya dış sistem) veya bir "Kullanım Senaryosu" (Use Case / eylem) temsil eder. "data.label" kısa ve net olsun (ör. "Öğrenci", "Sistem Yöneticisi", "Ders Kaydı", "Ödeme Al").
- "edges": kaynak ve hedef anlamlı olsun (ör. Aktör → Use Case veya Use Case → Use Case). Her kenarda "label" ZORUNLUDUR ve YALNIZCA şu üç değerden biri olabilir (küçük harf, tam eşleşme): "communicates", "includes", "extends". Başka hiçbir metin, Türkçe fiil veya açıklama kullanma.
- İsteğe bağlı: "animated" (boolean), "style" (ör. { "stroke": "#64748b" }).
- Düğümleri ızgaraya benzer şekilde dağıt; en az 3 düğüm üretmeye çalış (hem aktör hem senaryo mümkünse).

Konumlandırma (kesin — React Flow: x sağa doğru artar, y aşağı doğru artar):
- Sütunlar soldan sağa: her yeni sütunda x yaklaşık +260 px artır.
- Aynı sütunda düğümler aşağıdan yukarıya sıralansın: sütundaki ilk düğüm en altta (büyük y, örn. y≈580), sonraki düğümler yukarı (y yaklaşık 148 px azalarak). Sütun başına en fazla 5 düğüm; dolunca sağdaki sütuna geç.
- Rastgele veya üst üste binen koordinat verme; diyagram dik bir kolon-satır düzeni gibi okunabilir olsun.
PROMPT;
        } else {
            $systemPrompt = <<<'PROMPT'
Sen deneyimli bir yazılım mimarı ve domain modelleme uzmanısın. Görevin, verilen toplantı veya tartışma metninden kalıcı veri ve iş kurallarını React Flow kütüphanesinde doğrudan kullanılabilecek bir SINIF (entity / aggregate) şeması olarak yansıtmaktır. Bu bir kullanım senaryosu (Use Case) diyagramı DEĞİLDİR.

KRİTİK — ÇIKTI BİÇİMİ (buna uyulmazsa yanıt geçersizdir):
YALNIZCA geçerli bir JSON objesi döndür. İçinde "nodes" ve "edges" dizileri olsun.
Asla markdown, kod çiti (üçlü tırnak blokları), başlık, özet, açıklama veya JSON dışında tek karakter bile yazma.

Kalite — metinden model çıkarma (bu adımları yanıtta yazma; doğrudan uygula):
1) Metinde geçen iş nesnelerini, rolleri ve "tutulması gereken veri"yi listeleyin (Sipariş, Ödeme, Kullanıcı, Ders, Randevu vb.).
2) Kalıcı veri taşıyan kavramları sınıf düğümü yapın; saf UI veya tek seferlik eylem için ayrı sınıf açmayın.
3) İki varlık arası ilişkiyi metinden çıkarın; metin belirsizse en olası kardinaliteyi seçin (çoğunlukla 1:N veya N:1).
4) İsimleri metindeki dil ile tutarlı ve kısa tutun; gereksiz soyutlama ve "Manager/Helper" yağmurundan kaçının.
5) En fazla 14 düğüm ve 18 kenar; çekirdek domaini önceliklendirin.

Sınıf / veri şeması kuralları (kesin):
- Yanıtın YALNIZCA tek bir JSON nesnesi olmalı; PlantUML veya düz metin kullanma.
- Kök nesnede tam olarak iki alan olmalı: "nodes" (dizi) ve "edges" (dizi).
- Her node: "id", "position" ({ "x", "y" }), "data": { "label": string } — label tablo, entity, sınıf veya ana veri bileşeni adı olsun. İsteğe bağlı "style".
- Kenar (edge) "label" alanında YALNIZCA ve KESİNLİKLE şunlardan biri kullanılabilir: "1:1", "1:N", "M:N", "extends" (miras / genelleme). "includes", "communicates", "uses", "içerir", "bağlıdır" veya Use Case'e özgü başka herhangi bir terim kullanman KESİNLİKLE YASAKTIR.
- Bir ilişki tanımlıyorsan kardinaliteyi mutlaka bu dört etiketten biriyle göster (ör. bir kullanıcının birden çok siparişi varsa "1:N").
- İsteğe bağlı: "style" (ör. { "stroke": "#64748b" } — kesik çizgi / strokeDasharray kullanma).
- Düğümleri ızgaraya benzer şekilde dağıt; en az 3 düğüm üretmeye çalış.

Konumlandırma (kesin — React Flow: x sağa doğru artar, y aşağı doğru artar):
- Sütunlar soldan sağa: her yeni sütunda x yaklaşık +260 px artır.
- Aynı sütunda düğümler aşağıdan yukarıya sıralansın: sütundaki ilk düğüm en altta (büyük y, örn. y≈580), sonraki düğümler yukarı (y yaklaşık 148 px azalarak). Sütun başına en fazla 5 düğüm; dolunca sağdaki sütuna geç.
- Rastgele veya üst üste binen koordinat verme; şema dik kolonlar halinde okunabilir olsun.
PROMPT;
        }

        $meetingBody = $this->truncateMeetingTextForUml($meetingText);
        $combinedText = $systemPrompt."\n\nToplantı / tartışma metni:\n".$meetingBody;

        $rawUmlTemp = config('services.gemini.uml_temperature');
        $temperature = is_numeric($rawUmlTemp)
            ? (float) $rawUmlTemp
            : (float) config('services.gemini.temperature', 0.3);

        $body = [
            'contents' => [
                [
                    'role' => 'user',
                    'parts' => [
                        ['text' => $combinedText],
                    ],
                ],
            ],
            'generationConfig' => $this->umlGenerationConfig($temperature),
        ];

        $response = $this->postGeminiGenerateContent($body);

        if ($response->status() === 400 && isset($body['generationConfig']['responseMimeType'])) {
            unset($body['generationConfig']['responseMimeType']);
            $response = $this->postGeminiGenerateContent($body);
        }

        if ($response->failed()) {
            throw new Exception($this->geminiHttpFailureMessage($response));
        }

        $json = $response->json();
        if (! is_array($json)) {
            throw new Exception($this->geminiNonJsonResponseMessage($response));
        }

        $rawText = $this->extractGeminiResponseText($json);

        return $this->decodeReactFlowDiagramJson($rawText);
    }

    /**
     * Gemini bazen JSON'u markdown kod çitleri veya kısa ön metinle sarar; json_decode öncesi temizlenir.
     */
    private function stripMarkdownFencesBeforeJsonDecode(string $text): string
    {
        $s = trim($text);
        if ($s === '') {
            return '';
        }

        $s = preg_replace('/^\xEF\xBB\xBF/u', '', $s) ?? $s;

        $s = preg_replace('/^json\s*\R?/iu', '', $s) ?? $s;
        $s = trim($s);

        if (preg_match('/```(?:json)?\s*(.*?)\s*```/s', $s, $m)) {
            $s = trim($m[1]);
        } else {
            $s = preg_replace('/^```(?:json)?\s*\R?/iu', '', $s) ?? $s;
            $s = preg_replace('/\R?```\s*$/u', '', $s) ?? $s;
            $s = trim($s);
        }

        $s = preg_replace('/^\R?#+\s+.*$/m', '', $s) ?? $s;
        $s = trim($s);

        if ($s !== '' && ! str_starts_with($s, '{')) {
            $start = strpos($s, '{');
            $end = strrpos($s, '}');
            if ($start !== false && $end !== false && $end > $start) {
                $s = substr($s, $start, $end - $start + 1);
            }
        }

        return trim($s);
    }

    /**
     * @return array{nodes: list<array<string, mixed>>, edges: list<array<string, mixed>>}
     *
     * @throws Exception
     */
    private function decodeReactFlowDiagramJson(string $rawText): array
    {
        $trimmed = $this->stripMarkdownFencesBeforeJsonDecode($rawText);
        if ($trimmed === '') {
            throw new Exception('Gemini boş yanıt döndürdü.');
        }

        try {
            $decoded = json_decode($trimmed, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new Exception('Gemini yanıtı geçerli JSON değil: '.$rawText);
        }

        return $this->normalizeReactFlowPayload($decoded);
    }

    /**
     * Açık arka planda koyu metin; koyu arka planda açık metin (hex arka plan için).
     *
     * @param  array<string, mixed>  $style
     * @return array<string, mixed>
     */
    private function finalizeNodeStyleForReadability(array $style): array
    {
        $bg = isset($style['backgroundColor']) ? strtolower(trim((string) $style['backgroundColor'])) : '';
        if ($bg === '' || ! preg_match('/^#([0-9a-f]{3}|[0-9a-f]{6})$/', $bg, $m)) {
            if (! isset($style['color']) || ! is_string($style['color']) || trim($style['color']) === '') {
                $style['color'] = '#0a1628';
            }

            return $style;
        }
        $hex = $m[1];
        if (strlen($hex) === 3) {
            $hex = $hex[0].$hex[0].$hex[1].$hex[1].$hex[2].$hex[2];
        }
        $r = hexdec(substr($hex, 0, 2));
        $g = hexdec(substr($hex, 2, 2));
        $b = hexdec(substr($hex, 4, 2));
        $l = (0.2126 * $r + 0.7152 * $g + 0.0722 * $b) / 255;
        if ($l > 0.58) {
            $style['color'] = '#0a1628';
        } elseif (! isset($style['color']) || ! is_string($style['color']) || trim($style['color']) === '') {
            $style['color'] = '#e2e8f0';
        }

        return $style;
    }

    /**
     * Düğümleri soldan sağa sütunlara, her sütunda alttan üste (y azalarak) hizalar.
     *
     * @param  list<array<string, mixed>>  $nodes
     * @return list<array<string, mixed>>
     */
    private function applyOrthogonalGridPositionsToNodes(array $nodes): array
    {
        $startX = 72.0;
        $colW = 260.0;
        $rowH = 148.0;
        $baseY = 580.0;
        $maxPerCol = 5;

        foreach ($nodes as $i => &$node) {
            $col = intdiv($i, $maxPerCol);
            $rowFromBottom = $i % $maxPerCol;
            $node['position'] = [
                'x' => $startX + $col * $colW,
                'y' => $baseY - $rowFromBottom * $rowH,
            ];
        }
        unset($node);

        return $nodes;
    }

    /**
     * @param  mixed  $decoded
     * @return array{nodes: list<array<string, mixed>>, edges: list<array<string, mixed>>}
     *
     * @throws Exception
     */
    private function normalizeReactFlowPayload(mixed $decoded): array
    {
        if (! is_array($decoded)) {
            throw new Exception('Diyagram JSON kökü nesne değil.');
        }

        $nodesRaw = $decoded['nodes'] ?? null;
        $edgesRaw = $decoded['edges'] ?? null;

        if (! is_array($nodesRaw) || $nodesRaw === []) {
            throw new Exception('Geçerli "nodes" dizisi bulunamadı.');
        }
        if (! is_array($edgesRaw)) {
            throw new Exception('Geçerli "edges" dizisi bulunamadı.');
        }

        $defaultNodeStyle = [
            'backgroundColor' => '#f8fafc',
            'color' => '#0a1628',
            'border' => '1px solid #10b981',
            'borderRadius' => '4px',
            'padding' => '10px',
            'fontSize' => '12px',
        ];

        /** @var list<array<string, mixed>> $nodes */
        $nodes = [];
        foreach ($nodesRaw as $i => $n) {
            if (! is_array($n)) {
                continue;
            }
            $id = isset($n['id']) ? trim((string) $n['id']) : '';
            if ($id === '') {
                $id = 'n'.$i;
            }
            $data = is_array($n['data'] ?? null) ? $n['data'] : [];
            $label = isset($data['label']) && is_string($data['label']) ? $data['label'] : ('Bileşen '.($i + 1));
            $style = is_array($n['style'] ?? null) ? array_merge($defaultNodeStyle, $n['style']) : $defaultNodeStyle;
            $style = $this->finalizeNodeStyleForReadability($style);

            $nodes[] = [
                'id' => $id,
                'position' => ['x' => 0.0, 'y' => 0.0],
                'data' => ['label' => $label],
                'style' => $style,
            ];
        }

        if ($nodes === []) {
            throw new Exception('İşlenebilir düğüm bulunamadı.');
        }

        $nodes = $this->applyOrthogonalGridPositionsToNodes($nodes);

        $validIds = [];
        foreach ($nodes as $node) {
            $validIds[$node['id']] = true;
        }

        /** @var list<array<string, mixed>> $edges */
        $edges = [];
        foreach ($edgesRaw as $i => $e) {
            if (! is_array($e)) {
                continue;
            }
            $eid = isset($e['id']) ? trim((string) $e['id']) : '';
            if ($eid === '') {
                $eid = 'e'.$i;
            }
            $src = isset($e['source']) ? trim((string) $e['source']) : '';
            $tgt = isset($e['target']) ? trim((string) $e['target']) : '';
            if ($src === '' || $tgt === '' || ! isset($validIds[$src]) || ! isset($validIds[$tgt])) {
                continue;
            }
            $edgeStyle = is_array($e['style'] ?? null) ? $e['style'] : ['stroke' => '#64748b'];
            unset($edgeStyle['strokeDasharray'], $edgeStyle['stroke-dasharray']);
            $edge = [
                'id' => $eid,
                'source' => $src,
                'target' => $tgt,
                'style' => array_merge(['stroke' => '#64748b'], $edgeStyle),
            ];
            if (isset($e['label']) && is_string($e['label']) && $e['label'] !== '') {
                $edge['label'] = $e['label'];
            }
            $edges[] = $edge;
        }

        if ($edges === []) {
            $ids = array_column($nodes, 'id');
            if (count($ids) >= 2) {
                $edges[] = [
                    'id' => 'e-auto-0',
                    'source' => $ids[0],
                    'target' => $ids[1],
                    'style' => ['stroke' => '#64748b'],
                ];
            }
        }

        return ['nodes' => $nodes, 'edges' => $edges];
    }

    /**
     * Toplantı / analiz metnine göre sprint görevleri üretir (JSON dizi).
     *
     * @return list<array<string, mixed>>
     *
     * @throws InvalidArgumentException
     * @throws Exception
     */
    public function generateTasksFromText(string $meetingText): array
    {
        $body = trim($meetingText);
        if ($body === '') {
            throw new InvalidArgumentException('Görev üretmek için metin boş olamaz.');
        }

        $systemPrompt = <<<'PROMPT'
Sen bir teknik lider ve agile koçsun. Verilen toplantı veya analiz metnine dayanarak ekibin 1–2 haftalık sprintlere bölebileceği eyleme dönüştürülebilir görevler üret.

Kurallar:
- Yanıtın SADECE geçerli bir JSON dizisi (array) olmalı; markdown, açıklama veya kod bloğu kullanma.
- Her görev şu alanları içersin: "title" (kısa başlık), "description" (ne yapılacağı), "priority" ("P0"|"P1"|"P2"|"P3"), "area" ("backend"|"frontend"|"devops"|"data"|"qa"|"mobile"|"other"), "acceptance_criteria" (string dizisi), "related_node_ids" (metinde düğüm yoksa boş dizi).
- İsteğe bağlı: "sprint_label" (ör. "Sprint 1", "Sprint 2", "Backlog"); vermezsen tek sprint varsayılır.
- Metinde geçmeyen özellikleri uydurma; çıkarım yaparken muhafazakâr ol.
- 6 ile 18 görev arasında üret; metin çok kısaysa daha az.
PROMPT;

        $combinedText = $systemPrompt."\n\nToplantı / analiz metni:\n".$this->truncateMeetingTextForUml($body);

        $rawUmlTemp = config('services.gemini.uml_temperature');
        $temperature = is_numeric($rawUmlTemp)
            ? (float) $rawUmlTemp
            : (float) config('services.gemini.temperature', 0.3);

        $requestBody = [
            'contents' => [
                [
                    'role' => 'user',
                    'parts' => [
                        ['text' => $combinedText],
                    ],
                ],
            ],
            'generationConfig' => $this->umlGenerationConfig($temperature),
        ];

        $response = $this->postGeminiGenerateContent($requestBody);

        if ($response->status() === 400 && isset($requestBody['generationConfig']['responseMimeType'])) {
            unset($requestBody['generationConfig']['responseMimeType']);
            $response = $this->postGeminiGenerateContent($requestBody);
        }

        if ($response->failed()) {
            throw new Exception($this->geminiHttpFailureMessage($response));
        }

        $json = $response->json();
        if (! is_array($json)) {
            throw new Exception($this->geminiNonJsonResponseMessage($response));
        }

        $rawText = $this->extractGeminiResponseText($json);

        return $this->decodeTaskListJson($rawText);
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
        $diagramJson = json_encode($diagramData, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);

        $systemPrompt = <<<'PROMPT'
Sen bir teknik lider ve agile koçsun. Görevin, verilen mimari diyagram JSON'unu (nodes[], edges[]) inceleyerek yazılım ekibi için eyleme dönüştürülebilir sprint görevleri üretmektir.

Kurallar:
- Yanıtın SADECE geçerli bir JSON dizisi (array) olmalı; dışında açıklama, markdown veya kod bloğu kullanma.
- Her görev şu alanları içermeli: "title" (kısa başlık), "description" (ne yapılacağı), "priority" ("P0"|"P1"|"P2"|"P3"), "area" ("backend"|"frontend"|"devops"|"data"|"qa"|"mobile"|"other"), "acceptance_criteria" (string dizisi), "related_node_ids" (diyagramdaki node id dizisi, bilinmiyorsa boş dizi).
- İsteğe bağlı: "sprint_label" (ör. "Sprint 1", "Sprint 2", "Backlog"); ilişkili düğümleri ve kenarları hangi sprintte ele alınacağına göre grupla.
- Görevler bağımlılık sırasına uygun, test edilebilir ve tahmin edilebilir parçalara bölünsün.
- 5 ile 20 görev arasında üret; mimari basitse daha az, karmaşıksa daha çok.
PROMPT;

        $combinedText = $systemPrompt."\n\nDiyagram JSON:\n".$diagramJson;

        $rawUmlTemp = config('services.gemini.uml_temperature');
        $temperature = is_numeric($rawUmlTemp)
            ? (float) $rawUmlTemp
            : (float) config('services.gemini.temperature', 0.3);

        $requestBody = [
            'contents' => [
                [
                    'role' => 'user',
                    'parts' => [
                        ['text' => $combinedText],
                    ],
                ],
            ],
            'generationConfig' => $this->umlGenerationConfig($temperature),
        ];

        $response = $this->postGeminiGenerateContent($requestBody);

        if ($response->status() === 400 && isset($requestBody['generationConfig']['responseMimeType'])) {
            unset($requestBody['generationConfig']['responseMimeType']);
            $response = $this->postGeminiGenerateContent($requestBody);
        }

        if ($response->failed()) {
            throw new Exception($this->geminiHttpFailureMessage($response));
        }

        $json = $response->json();
        if (! is_array($json)) {
            throw new Exception($this->geminiNonJsonResponseMessage($response));
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
            if (! is_array($row)) {
                continue;
            }
            if (isset($row['title']) && is_string($row['title']) && $row['title'] !== '') {
                $out[] = $row;

                continue;
            }
            if (isset($row['task_name']) && is_string($row['task_name']) && $row['task_name'] !== '') {
                $row['title'] = $row['task_name'];
                $out[] = $row;
            }
        }

        if ($out === []) {
            throw new Exception('Geçerli görev satırı bulunamadı.');
        }

        return $out;
    }
}
