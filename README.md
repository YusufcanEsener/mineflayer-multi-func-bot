# Mineflayer Multi Func Bot 🤖

[![npm version](https://img.shields.io/badge/npm-v1.0.0-blue.svg)](https://www.npmjs.com/) [![Mineflayer version](https://img.shields.io/badge/mineflayer-v4.37.1-green.svg)](https://github.com/PrismarineJS/mineflayer) [![Node version](https://img.shields.io/badge/node-%3E%3D18.x-brightgreen.svg)](https://nodejs.org/) [![CI status](https://img.shields.io/badge/CI-passing-success.svg)](https://github.com/) [![License](https://img.shields.io/badge/license-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Discord](https://img.shields.io/badge/discord-online-blueviolet.svg)](https://discord.com/)


Gelişmiş web kontrol paneline sahip, tamamen otonom ve interaktif bir Minecraft botudur. `mineflayer` kütüphanesi üzerine inşa edilmiş olup, Discord entegrasyonu, eşya kuryeliği, canlı harita ve daha birçok özelliği bünyesinde barındırır.

## Özellikler 🌟

- **Web Tabanlı Kontrol Paneli (Dashboard):** Botu dilediğiniz yerden tarayıcı üzerinden başlatıp durdurabilir, anlık can, açlık ve TPS değerlerini izleyebilirsiniz.
- **Otonom Sistemler:** 
  - **Auto-Reconnect:** Bağlantı koptuğunda otomatik yeniden bağlanır.
  - **Oto-Yemek:** Açlık düştüğünde envanterdeki yemekleri otomatik tüketir.
  - **Oto-Towny:** Seçili sunuculara girerken otomatik lobi/şifre geçişi yapar.
- **Gelişmiş Auto-Digger (Otomatik Kazıcı):** 
  - Belirlenen yöne doğru otonom kazı yapar. 
  - Kazılan blokların istatistiklerini (blok türü, kazma sayısı vb.) MongoDB'de tutar.
  - Kazma dayanıklılığı düştüğünde envanterdeki veya yakındaki sandıktaki sağlam kazma ile otomatik değişim yapar.
  - Sunucu restartları sonrası kazı işlemine kaldığı yerden otomatik devam eder (Auto-Resume).
- **Kurye & Lojistik Sistemi:** Etraftaki sandıkları tarayarak `MongoDB` üzerine kaydeder. İhtiyacınız olan eşyayı web panelinden seçtiğinizde bot o eşyayı sandıktan alır ve size veya belirttiğiniz koordinata teslim eder.
- **Canlı 3D Harita:** Botun gözünden etrafı tarayıcı üzerinden izlemenizi sağlar (Prismarine Viewer).
- **Discord Entegrasyonu:** Oyun içi sohbetleri Discord kanalına aktarır ve `!gel`, `!sandıktara`, `!kurye` gibi komutlarla botu yönetmenizi sağlar.
- **İstatistik & Grafik Paneli:** Kazı botunun performansını `Chart.js` ile gerçek zamanlı ve günlük grafikler üzerinden takip edebilirsiniz.
- **Tema Desteği:** Web arayüzünde Glassmorphism, Dark Mode, Hacker ve Minecraft Classic gibi farklı temalar kullanılabilir.

## Kurulum 🛠️

1. Gerekli kütüphaneleri indirin:
   ```bash
   npm install
   ```

2. `.env.example` dosyasının adını `.env` olarak değiştirin ve kendi bilgilerinize göre doldurun:
   ```env
   HOST=play.sunucu.com
   PORT=25565
   BOT_USERNAME=BotAdim
   PASSWORD=BotSifrem
   VERSION=1.16.5
   DISCORD_TOKEN=your_bot_token
   DISCORD_CHANNEL_ID=your_channel_id
   MONGO_URI=mongodb_baglanti_linki
   ```

3. Uygulamayı başlatın:
   ```bash
   node app.js
   ```
   *(Geliştirme süreci için `npm run dev` kullanabilirsiniz.)*

4. Tarayıcınızdan panele erişin:
   ```text
   http://localhost:4000
   ```

## Kullanım 🚀

Uygulamayı başlattığınızda bot anında oyuna girmez. Önce Web Paneline (`localhost:4000`) girmeli ve **"Başlat"** butonuna basmalısınız. Bot bağlandıktan sonra tüm veriler anlık olarak web panelinize akmaya başlayacaktır. 

- **Sandık Tarama:** `sandiktara` yazarak etraftaki eşyaları veritabanına işleyebilirsiniz.
- **Kurye:** Panelden eşya seçip miktar girerek kendinize veya koordinata kurye çağırabilirsiniz.
- **Auto-Digger:** Kazıcı sekmesinden başlangıç konumunu kaydedip kazıyı başlatabilirsiniz.

---
*Bu proje **Node.js**, **Express**, **Socket.io**, **Mongoose**, **Chart.js**, **Discord.js** ve **Mineflayer** kullanılarak geliştirilmiştir.*
