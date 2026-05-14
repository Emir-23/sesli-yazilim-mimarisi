<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Frontend `FALLBACK_BACKEND_PROJECT_ID = 1` ile gelen transcript/chat/media istekleri için
 * `projects` tablosunda id=1 satırının kesin bulunmasını sağlar.
 */
class TestProjectSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        DB::table('projects')->updateOrInsert(
            ['id' => 1],
            [
                'title' => 'SesMimari Test Projesi (id=1)',
                'description' => 'Geçici test kaydı: frontend fallback backendId=1 ile Laravel API uyumu.',
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );
    }
}
