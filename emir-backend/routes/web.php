<?php

use App\Services\AIService;
use Illuminate\Support\Facades\Route; // Bunu ekledik ki servisimiz tanınsın

Route::get('/', function () {
    return view('welcome');
});

// Senin Test Rotan Buradan Başlıyor
Route::get('/ai-test', function () {
    try {
        $aiService = app(AIService::class);

        // Örnek bir senaryo yazıyoruz
        $sampleText = 'Bir Kütüphane sisteminde Kitap ve Yazar sınıfları olmalı. Bir yazarın birçok kitabı olabilir.';

        $result = $aiService->generateUmlFromText($sampleText, 'class');

        $pretty = json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);

        return "<pre style='background: #f4f4f4; padding: 20px; border-radius: 5px;'>".htmlspecialchars($pretty).'</pre>';

    } catch (Exception $e) {
        return 'Hata Oluştu: '.$e->getMessage();
    }
});
