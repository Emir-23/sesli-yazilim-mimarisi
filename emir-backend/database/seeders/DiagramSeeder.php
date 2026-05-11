<?php

namespace Database\Seeders;

use App\Models\Diagram;
use App\Models\Project;
use Illuminate\Database\Seeder;

class DiagramSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $byTitle = [
            'GAI-VISION Test Projesi' => [
                'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1],
                'nodes' => [
                    ['id' => 'mic', 'type' => 'input', 'label' => 'Mikrofon / Ses dosyası', 'position' => ['x' => 40, 'y' => 160]],
                    ['id' => 'stt', 'type' => 'process', 'label' => 'Konuşmayı metne (STT)', 'position' => ['x' => 220, 'y' => 160]],
                    ['id' => 'vision', 'type' => 'service', 'label' => 'Görüntü analizi servisi', 'position' => ['x' => 440, 'y' => 100]],
                    ['id' => 'tts', 'type' => 'output', 'label' => 'TTS yanıtı', 'position' => ['x' => 440, 'y' => 240]],
                ],
                'edges' => [
                    ['id' => 'e1', 'source' => 'mic', 'target' => 'stt'],
                    ['id' => 'e2', 'source' => 'stt', 'target' => 'vision'],
                    ['id' => 'e3', 'source' => 'vision', 'target' => 'tts'],
                ],
            ],
            'Sesli Asistan MVP' => [
                'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1],
                'nodes' => [
                    ['id' => 'wake', 'type' => 'input', 'label' => 'Uyandırma kelimesi', 'position' => ['x' => 60, 'y' => 140]],
                    ['id' => 'nlu', 'type' => 'process', 'label' => 'Niyet / varlık çıkarımı', 'position' => ['x' => 260, 'y' => 140]],
                    ['id' => 'skill', 'type' => 'service', 'label' => 'Beceri yönlendirici', 'position' => ['x' => 460, 'y' => 140]],
                    ['id' => 'resp', 'type' => 'output', 'label' => 'Sesli yanıt', 'position' => ['x' => 660, 'y' => 140]],
                ],
                'edges' => [
                    ['id' => 'e1', 'source' => 'wake', 'target' => 'nlu'],
                    ['id' => 'e2', 'source' => 'nlu', 'target' => 'skill'],
                    ['id' => 'e3', 'source' => 'skill', 'target' => 'resp'],
                ],
            ],
            'E-Ticaret Mikroservis Mimarisi' => [
                'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1],
                'nodes' => [
                    ['id' => 'api', 'type' => 'gateway', 'label' => 'API Gateway', 'position' => ['x' => 200, 'y' => 40]],
                    ['id' => 'order', 'type' => 'service', 'label' => 'Sipariş servisi', 'position' => ['x' => 80, 'y' => 200]],
                    ['id' => 'pay', 'type' => 'service', 'label' => 'Ödeme servisi', 'position' => ['x' => 320, 'y' => 200]],
                    ['id' => 'stock', 'type' => 'service', 'label' => 'Stok servisi', 'position' => ['x' => 200, 'y' => 340]],
                    ['id' => 'bus', 'type' => 'infra', 'label' => 'Olay otobüsü', 'position' => ['x' => 520, 'y' => 200]],
                ],
                'edges' => [
                    ['id' => 'e1', 'source' => 'api', 'target' => 'order'],
                    ['id' => 'e2', 'source' => 'api', 'target' => 'pay'],
                    ['id' => 'e3', 'source' => 'order', 'target' => 'stock'],
                    ['id' => 'e4', 'source' => 'order', 'target' => 'bus'],
                    ['id' => 'e5', 'source' => 'pay', 'target' => 'bus'],
                ],
            ],
            'IoT Cihaz Gateway' => [
                'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1],
                'nodes' => [
                    ['id' => 'device', 'type' => 'device', 'label' => 'Edge cihaz', 'position' => ['x' => 80, 'y' => 180]],
                    ['id' => 'gw', 'type' => 'gateway', 'label' => 'Protokol gateway', 'position' => ['x' => 300, 'y' => 180]],
                    ['id' => 'ingest', 'type' => 'service', 'label' => 'Telemetri ingest', 'position' => ['x' => 520, 'y' => 120]],
                    ['id' => 'rules', 'type' => 'process', 'label' => 'Kural motoru', 'position' => ['x' => 520, 'y' => 260]],
                ],
                'edges' => [
                    ['id' => 'e1', 'source' => 'device', 'target' => 'gw'],
                    ['id' => 'e2', 'source' => 'gw', 'target' => 'ingest'],
                    ['id' => 'e3', 'source' => 'gw', 'target' => 'rules'],
                ],
            ],
            'İç API Dokümantasyon Pilotu' => [
                'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1],
                'nodes' => [
                    ['id' => 'portal', 'type' => 'ui', 'label' => 'Dokümantasyon portalı', 'position' => ['x' => 120, 'y' => 80]],
                    ['id' => 'spec', 'type' => 'artifact', 'label' => 'OpenAPI özeti', 'position' => ['x' => 120, 'y' => 220]],
                    ['id' => 'svc-a', 'type' => 'service', 'label' => 'Kimlik servisi', 'position' => ['x' => 400, 'y' => 120]],
                    ['id' => 'svc-b', 'type' => 'service', 'label' => 'Fatura servisi', 'position' => ['x' => 400, 'y' => 260]],
                ],
                'edges' => [
                    ['id' => 'e1', 'source' => 'portal', 'target' => 'spec'],
                    ['id' => 'e2', 'source' => 'spec', 'target' => 'svc-a'],
                    ['id' => 'e3', 'source' => 'spec', 'target' => 'svc-b'],
                ],
            ],
        ];

        foreach ($byTitle as $title => $diagramData) {
            $project = Project::query()->where('title', $title)->first();
            if ($project === null) {
                continue;
            }

            Diagram::factory()
                ->for($project)
                ->create(['diagram_data' => $diagramData]);
        }
    }
}
