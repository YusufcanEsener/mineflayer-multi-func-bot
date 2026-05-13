const mongoose = require('mongoose');

const chestSchema = new mongoose.Schema({
    serverHost: { type: String, required: true }, // Hangi sunucuda olduğu
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    z: { type: Number, required: true },
    items: [
        {
            name: { type: String, required: true }, // Eşya adı (örn: stone)
            count: { type: Number, required: true } // Miktarı
        }
    ],
    lastScanned: { type: Date, default: Date.now }
});

// Aynı sunucuda aynı koordinatta birden fazla sandık olamaz
chestSchema.index({ serverHost: 1, x: 1, y: 1, z: 1 }, { unique: true });

module.exports = mongoose.model('Chest', chestSchema);
