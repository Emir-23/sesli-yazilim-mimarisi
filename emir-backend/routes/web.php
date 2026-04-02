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

        $result = $aiService->generateUmlFromText($sampleText);

        // Ekranda güzel görünmesi için <pre> etiketi kullanıyoruz
        return "<pre style='background: #f4f4f4; padding: 20px; border-radius: 5px;'>".htmlspecialchars($result).'</pre>';

    } catch (Exception $e) {
        return 'Hata Oluştu: '.$e->getMessage();
    }
});
