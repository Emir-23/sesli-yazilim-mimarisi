<?php

namespace Database\Seeders;

use App\Models\Project;
use Illuminate\Database\Seeder;

class ProjectSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $projects = [
            [
                'title' => 'GAI-VISION Test Projesi',
                'description' => 'Sesli komutlarla görüntü analizi akışını doğrulayan proof-of-concept; STT ve görüntü işleme servisleri arası entegrasyon testleri.',
            ],
            [
                'title' => 'Sesli Asistan MVP',
                'description' => 'Kişisel asistan için niyet tanıma ve yerel komut seti; prototip kullanıcı senaryoları ve kayıt kalitesi değerlendirmesi.',
            ],
            [
                'title' => 'E-Ticaret Mikroservis Mimarisi',
                'description' => 'Sipariş, ödeme ve stok servislerinin olay güdümlü iletişimini modelleyen referans mimari diyagramı.',
            ],
            [
                'title' => 'IoT Cihaz Gateway',
                'description' => 'Edge cihazlardan merkezi kolektöre MQTT/HTTP üzerinden veri akışı; cihaz sağlığı ve telemetri örnekleri.',
            ],
            [
                'title' => 'İç API Dokümantasyon Pilotu',
                'description' => 'Şirket içi REST API uçlarının görsel haritası; ekipler arası sözleşme ve sürümleme görünürlüğü için pilot.',
            ],
        ];

        foreach ($projects as $data) {
            Project::factory()->create($data);
        }
    }
}
