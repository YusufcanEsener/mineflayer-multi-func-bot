const mineflayer = require('mineflayer');
const autoeat = require('mineflayer-auto-eat').loader;
const viewer = require('prismarine-viewer').mineflayer;
const { handleMinecraftChat } = require('./message');
const { sendToDiscord } = require('./discord');
const { joinTowny } = require('./gamemodeSelector');

let botInstance = null;
let ioInstance = null;
let reconnectTimeout = null;

let botStartTime = null;
let disconnectCount = 0;

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
            botInstance.autoEat.enableAuto();
        } else {
            botInstance.autoEat.disableAuto();
        }
    }
}

function getConfig() {
    return botConfig;
}

function getBotStats() {
    return {
        uptime: botStartTime ? Date.now() - botStartTime : 0,
        disconnects: disconnectCount
    };
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
        hideErrors: true
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

    // Tüm gelen paketleri görmek için doğru listener (_client)
    const seenPackets = new Set();
    
    // Mineflayer'ın kendi Team sistemi NBT verilerinde (1.21) çöktüğü için takımları kendimiz tutacağız
    botInstance.myTeamMap = {};

    botInstance._client.on('packet', (data, meta) => {
        if (!seenPackets.has(meta.name)) {
            seenPackets.add(meta.name);
            if (meta.name.includes('score') || meta.name.includes('objective') || meta.name.includes('team') || meta.name.includes('display')) {
                console.log(`[New HUD Packet] ${meta.name}`);
            }
        }
        
        // Takım verilerini kendimiz yakalıyoruz (Mineflayer'ın çökmesini baypas et)
        if (meta.name === 'teams' || meta.name === 'scoreboard_team') {
            if (data.mode === 0) {
                botInstance.myTeamMap[data.team] = data;
            } else if (data.mode === 2 && botInstance.myTeamMap[data.team]) {
                // Update
                if (data.prefix) botInstance.myTeamMap[data.team].prefix = data.prefix;
                if (data.suffix) botInstance.myTeamMap[data.team].suffix = data.suffix;
            } else if (data.mode === 1) {
                delete botInstance.myTeamMap[data.team];
            }
        }
    });

    // Scoreboard Oku
    botInstance.on('scoreUpdated', (scoreboard, item) => {
        if (ioInstance && botInstance.scoreboard && botInstance.scoreboard['1']) {
            const board = botInstance.scoreboard['1'];
            if (board) {
                const parseMessage = (msg) => {
                    if (!msg) return "";
                    if (typeof msg === 'string') return msg;
                    
                    let out = "";
                    if (msg.type === 'compound' && msg.value) {
                        if (msg.value.text && msg.value.text.value) out += msg.value.text.value;
                        if (msg.value.extra && msg.value.extra.value && Array.isArray(msg.value.extra.value.value)) {
                            out += msg.value.extra.value.value.map(parseMessage).join('');
                        }
                        if (out) return out;
                    }
                    
                    if (msg.text) out += (typeof msg.text === 'string' ? msg.text : parseMessage(msg.text));
                    if (msg.extra && Array.isArray(msg.extra)) out += msg.extra.map(parseMessage).join('');
                    if (out) return out;

                    if (msg.toAnsi) return msg.toString();
                    if (msg.toString && typeof msg.toString === 'function' && msg.toString() !== '[object Object]') return msg.toString();
                    return JSON.stringify(msg);
                };
                
                const title = board.title ? parseMessage(board.title) : "Scoreboard";
                const lines = board.items.map(i => {
                    const text = parseMessage(i.displayName);
                    return text ? text : i.name;
                });

                ioInstance.emit('scoreboard_update', { title, lines });
            }
        }
    });

    const handleDisconnect = (reason) => {
        console.log("[BotManager] Bot bağlantısı koptu. Sebep:", reason);
        botInstance = null;
        botStartTime = null;
        disconnectCount++;
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
        botStartTime = Date.now();
        if (ioInstance) ioInstance.emit('bot_online_status', true);

        // Auto-Eat Başlat
        if (botConfig.autoEat) {
            botInstance.autoEat.setOpts({
                priority: "foodPoints",
                bannedFood: [],
                eatingTimeout: 3000
            });
            botInstance.autoEat.enableAuto();
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

        // Auto-Digger Auto-Resume
        const { checkAutoResume } = require('./autoDigger');
        checkAutoResume(botInstance);
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

module.exports = { startBot, stopBot, getBot, setIo, updateConfig, getConfig, getBotStats };
