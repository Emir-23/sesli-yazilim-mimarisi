<?php

namespace Database\Seeders;

use App\Models\Project;
use App\Models\ProjectFile;
use Illuminate\Database\Seeder;

class ProjectFileSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $byTitle = [
            'GAI-VISION Test Projesi' => [
                ['file_name' => 'gai-vision-tanitim.mp3', 'file_path' => 'storage/projects/gai-vision/tanitim.mp3'],
                ['file_name' => 'gai-vision-demo-kayit.mp3', 'file_path' => 'storage/projects/gai-vision/demo-kayit.mp3'],
            ],
            'Sesli Asistan MVP' => [
                ['file_name' => 'asistan-merhaba.mp3', 'file_path' => 'storage/projects/sesli-asistan/merhaba-ornek.mp3'],
                ['file_name' => 'asistan-hava.mp3', 'file_path' => 'storage/projects/sesli-asistan/hava-durumu-sorgusu.mp3'],
            ],
            'E-Ticaret Mikroservis Mimarisi' => [
                ['file_name' => 'siparis-akisi.mp3', 'file_path' => 'storage/projects/e-ticaret/siparis-akisi-aciklama.mp3'],
            ],
            'IoT Cihaz Gateway' => [
                ['file_name' => 'gateway-baglantı.mp3', 'file_path' => 'storage/projects/iot-gateway/cihaz-baglantı-logu.mp3'],
                ['file_name' => 'telemetri-ornek.mp3', 'file_path' => 'storage/projects/iot-gateway/telemetri-ornek.mp3'],
            ],
            'İç API Dokümantasyon Pilotu' => [
                ['file_name' => 'api-genel-bakis.mp3', 'file_path' => 'storage/projects/ic-api/genel-bakis.mp3'],
                ['file_name' => 'api-auth-flow.mp3', 'file_path' => 'storage/projects/ic-api/auth-flow-aciklama.mp3'],
            ],
        ];

        foreach ($byTitle as $title => $files) {
            $project = Project::query()->where('title', $title)->first();
            if ($project === null) {
                continue;
            }

            foreach ($files as $file) {
                ProjectFile::factory()
                    ->for($project)
                    ->create($file);
            }
        }
    }
}
