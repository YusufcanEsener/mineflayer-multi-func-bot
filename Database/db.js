const mongoose = require('mongoose');

async function connectDB() {
    try {
        const uri = process.env.MONGO_URI;
        await mongoose.connect(uri);
        console.log("[Sistem] MongoDB bağlantısı başarılı!");
    } catch (err) {
        console.error("[Kritik Hata] MongoDB'ye bağlanılamadı:", err.message);
        process.exit(1); // Veritabanı yoksa botun çalışmasının anlamı yok
    }
}

module.exports = connectDB;
