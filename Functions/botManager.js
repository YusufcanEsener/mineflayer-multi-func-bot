const mineflayer = require('mineflayer');
const autoeat = require('mineflayer-auto-eat').plugin;
const viewer = require('prismarine-viewer').mineflayer;
const { handleMinecraftChat } = require('./message');
const { sendToDiscord } = require('./discord');
const { joinTowny } = require('./gamemodeSelector');

let botInstance = null;
let ioInstance = null;
let reconnectTimeout = null;

// Global Bot Config State
const botConfig = {
    autoReconnect: true,
    autoTowny: false,
    autoEat: true
};

function setIo(io) {
    ioInstance = io;
}

function getBot() {
    return botInstance;
}

function updateConfig(newConfig) {
    Object.assign(botConfig, newConfig);
    console.log("[BotManager] Config güncellendi:", botConfig);
    
    if (botInstance && botInstance.autoEat) {
        if (botConfig.autoEat) {
            botInstance.autoEat.enable();
        } else {
            botInstance.autoEat.disable();
        }
    }
}

function getConfig() {
    return botConfig;
}

function startBot(isReconnect = false) {
    if (botInstance) {
        if (!isReconnect) console.log("[BotManager] Bot zaten açık!");
        return false;
    }

    console.log(`[BotManager] Bot ${isReconnect ? 'yeniden ' : ''}başlatılıyor...`);
    
    botInstance = mineflayer.createBot({
        host: process.env.HOST,
        username: process.env.BOT_USERNAME,
        port: parseInt(process.env.PORT) || 25565,
        version: process.env.VERSION === 'false' ? false : process.env.VERSION,
    });

    // Plugin Yüklemeleri
    botInstance.loadPlugin(autoeat);

    botInstance.on('message', (jsonMsg) => {
        const msg = jsonMsg.toString();
        console.log(jsonMsg.toAnsi());

        // Otomatik Giriş
        if (msg.includes('/gir şifre') || msg.includes('/login')) {
            botInstance.chat(`/gir ${process.env.PASSWORD}`);
        }

        if (ioInstance) {
            ioInstance.emit('chat_message', { text: msg, ansi: jsonMsg.toAnsi() });
        }
    });

    handleMinecraftChat(botInstance, sendToDiscord);

    // Scoreboard Oku
    botInstance.on('scoreUpdated', (scoreboard, item) => {
        if (ioInstance && botInstance.scoreboards) {
            // Sadece sağ yandaki tabloyu gönder
            const board = Object.values(botInstance.scoreboards)[0];
            if (board) {
                const lines = board.items.map(i => i.displayName.toString());
                ioInstance.emit('scoreboard_update', { title: board.title.toString(), lines });
            }
        }
    });

    const handleDisconnect = (reason) => {
        console.log("[BotManager] Bot bağlantısı koptu. Sebep:", reason);
        botInstance = null;
        if (ioInstance) ioInstance.emit('bot_online_status', false);

        if (botConfig.autoReconnect) {
            console.log("[BotManager] Auto-Reconnect aktif, 10 saniye içinde yeniden bağlanılıyor...");
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(() => startBot(true), 10000);
        }
    };

    botInstance.on('kicked', handleDisconnect);
    botInstance.on('error', handleDisconnect);
    botInstance.on('end', () => handleDisconnect("Sunucu bağlantıyı kapattı."));

    botInstance.on('spawn', () => {
        console.log("[BotManager] Bot başarıyla oyuna girdi!");
        if (ioInstance) ioInstance.emit('bot_online_status', true);

        // Auto-Eat Başlat
        if (botConfig.autoEat) {
            botInstance.autoEat.options.priority = "foodPoints";
            botInstance.autoEat.options.bannedFood = [];
            botInstance.autoEat.options.eatingTimeout = 3000;
            botInstance.autoEat.enable();
        }

        // Prismarine Viewer Başlat (Port 3000)
        try {
            viewer(botInstance, { port: 3000, firstPerson: true });
            console.log("[BotManager] Live Viewer 3000 portunda başlatıldı.");
        } catch (e) {
            console.log("[BotManager] Viewer zaten açık veya hata oluştu:", e.message);
        }

        // Auto-Towny Mantığı
        if (botConfig.autoTowny) {
            console.log("[BotManager] Auto-Towny aktif, 30 saniye sonra Towny sunucusuna geçilecek...");
            setTimeout(() => {
                if (botInstance) joinTowny(botInstance);
            }, 30000);
        }
    });

    botInstance.on('autoeat_started', () => {
        console.log('[AutoEat] Bot yemek yiyor...');
    });

    return true;
}

function stopBot() {
    if (!botInstance) {
        console.log("[BotManager] Bot zaten kapalı.");
        return false;
    }

    console.log("[BotManager] Bot manuel durduruluyor...");
    
    // Manuel durdurmada reconnect iptal et
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    
    try {
        botInstance.quit();
    } catch (e) {}
    
    botInstance = null;
    if (ioInstance) ioInstance.emit('bot_online_status', false);
    return true;
}

module.exports = { startBot, stopBot, getBot, setIo, updateConfig, getConfig };
