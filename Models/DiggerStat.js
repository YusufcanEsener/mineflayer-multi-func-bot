const mongoose = require('mongoose');

const DiggerStatSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    blocksMined: { type: Number, required: true },
    minedBlocksBreakdown: { 
        type: Map, 
        of: Number,
        default: {} 
    },
    pickaxesUsed: { type: Number, required: true },
    serverHost: { type: String, required: true }
});

module.exports = mongoose.model('DiggerStat', DiggerStatSchema);
