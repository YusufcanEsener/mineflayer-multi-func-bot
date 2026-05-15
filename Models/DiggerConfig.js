const mongoose = require('mongoose');

const DiggerConfigSchema = new mongoose.Schema({
    serverHost: { type: String, required: true, unique: true },
    savedCoordinate: {
        x: Number,
        y: Number,
        z: Number
    },
    savedDigDirection: {
        x: Number,
        y: Number,
        z: Number
    },
    isActive: { type: Boolean, default: false }
});

module.exports = mongoose.model('DiggerConfig', DiggerConfigSchema);
