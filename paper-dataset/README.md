# GAI-VISION (VocalFlow AI) Makale Test Veri Seti

Bu depo, çok modlu verileri (ses, canlı chat ve metin) birleştirerek otonom UML sınıf diyagramları üreten  sisteminin performans testlerini içerir. 

## 🎯 Amaç ve Temel İddiamız
Sistemimiz; toplantı ses dökümlerini , arayüz yazışmalarını ve dışarıdan yüklenen belgeleri tek bir bağlamda kronolojik olarak birleştirir.

İddiamız: Bu karmaşık verinin içindeki gündelik takım sohbetlerini, konu dışı tartışmaları ve STT kelime hatalarını filtreleyerek, yalnızca yazılım mimarisine ait teknik sinyallere odaklanabilmektedir.

## 📂 Veri Seti İçeriği
Zorluk dereceleri farklı 20 yazılım projesinin test edildiği bu depoda, her proje klasörü sistemin çalışma anında doğrudan arka plandan çekilen şu dosyaları barındırır:

* **`birlestirilmis_log.txt`**: GAI-VISION uygulaması çalışırken, tarayıcı geliştirici araçları (F12 - DevTools) kullanılarak uygulamanın `Session Storage` alanındaki `analysisContext` değişkeninden doğrudan kopyalanan ham sistem günlüğüdür. Sistemin arka planda ses (STT), chat ve dış dosyaları nasıl birleştirdiğini gösteren ve yapay zeka API'sine gönderilen %100 gerçek girdi (payload) verisidir.
* **`uml_ciktisi.png / .json`**: Sistemin yukarıdaki F12 konsolundan çekilen bu gürültülü veriyi işleyerek React Flow tuvalinde otonom olarak oluşturduğu nihai Sınıf Diyagramı (Class Diagram).

## 🧮 Değerlendirme Metrikleri ve Formüller
Sistemin ürettiği UML diyagramlarının performansı, Doğal Dil İşleme (NLP) literatüründe standart kabul edilen metriklerle hesaplanmıştır. Hesaplamalarda referans alınan temel değerler şunlardır:

* **True Positive (TP):** Sistemin doğru olarak ürettiği UML bileşenleri.
* **False Positive (FP):** Sistemin ürettiği ancak referans metinde olmayan, hatalı bileşenler (halüsinasyon).
* **False Negative (FN):** Referans metinde olmasına rağmen sistemin yakalayamadığı eksik bileşenler.

**1. Doğruluk (Precision):**
Sistemin ürettiği diyagramdaki elemanların doğruluk oranını ölçer.
$$Precision = \frac{TP}{TP + FP}$$

**2. Kapsayıcılık (Recall):**
Orijinal gereksinimlerde olması gereken tüm bileşenlerin ne kadarının sistem tarafından başarıyla bulunduğunu gösterir.
$$Recall = \frac{TP}{TP + FN}$$

**3. F1-Skoru:**
Doğruluk ve Kapsayıcılık metriklerinin harmonik ortalamasıdır. Gürültülü verilerde modelin genel analiz yeteneğini gösteren dengeli skordur.
$$F1 = 2 \times \frac{Precision \times Recall}{Precision + Recall}$$













