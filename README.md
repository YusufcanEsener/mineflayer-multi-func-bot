# Mineflayer Multi Func Bot 🤖

Gelişmiş web kontrol paneline sahip, tamamen otonom ve interaktif bir Minecraft botudur. `mineflayer` kütüphanesi üzerine inşa edilmiş olup, Discord entegrasyonu, eşya kuryeliği, canlı harita ve daha birçok özelliği bünyesinde barındırır.

## Özellikler 🌟

- **Web Tabanlı Kontrol Paneli (Dashboard):** Botu dilediğiniz yerden tarayıcı üzerinden başlatıp durdurabilir, anlık can, açlık ve TPS değerlerini izleyebilirsiniz.
- **Otonom Sistemler:** 
  - **Auto-Reconnect:** Bağlantı koptuğunda otomatik yeniden bağlanır.
  - **Oto-Yemek:** Açlık düştüğünde envanterdeki yemekleri otomatik tüketir.
  - **Oto-Towny:** Seçili sunuculara girerken otomatik lobi/şifre geçişi yapar.
- **Kurye & Lojistik Sistemi:** Etraftaki sandıkları tarayarak `MongoDB` üzerine kaydeder. İhtiyacınız olan eşyayı web panelinden seçtiğinizde bot o eşyayı sandıktan alır ve size veya belirttiğiniz koordinata teslim eder.
- **Canlı 3D Harita:** Botun gözünden etrafı tarayıcı üzerinden izlemenizi sağlar.
- **Discord Entegrasyonu:** Oyun içi sohbetleri belirlediğiniz Discord kanalına aktarır ve Discord üzerinden bota komut vermenizi sağlar (`!gel`, `!sandıktara` vb).
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
   *(Geliştirme süreci için `nodemon` kullanabilirsiniz.)*

4. Tarayıcınızdan panele erişin:
   ```text
   http://localhost:4000
   ```

## Kullanım 🚀

Uygulamayı başlattığınızda bot anında oyuna girmez. Önce Web Paneline (`localhost:4000`) girmeli ve **"Başlat"** butonuna basmalısınız. Bot bağlandıktan sonra tüm veriler anlık olarak web panelinize akmaya başlayacaktır. Sandıkları taramak için sağ alt köşedeki sohbet kutusuna `sandiktara` yazabilirsiniz.

---
*Bu proje Node.js, Express, Socket.io, Mongoose ve Mineflayer kullanılarak geliştirilmiştir.*
