const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Chest = require('../Models/Chest');
const DiggerStat = require('../Models/DiggerStat');
const { startBot, stopBot, getBot, setIo, getBotStats } = require('../Functions/botManager');
const { fetchItem } = require('../Functions/chestScanner');
const { startDigger, stopDigger, getDiggerStats, saveDiggerPos } = require('../Functions/autoDigger');

function startWebServer() {
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use(express.static('public'));

    const server = http.createServer(app);
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // io instance'ını manager'a gönder
    setIo(io);

    // --- REST API ENDPOINTLERİ ---
    app.get('/api/chests', async (req, res) => {
        try {
            const chests = await Chest.find({ serverHost: process.env.HOST || 'localhost' });
            res.json(chests);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.get('/api/digger/stats', async (req, res) => {
        try {
            const host = process.env.HOST || 'localhost';
            
            // Son 60 dakikanın verileri (1 dakikalık aralıklarla atıldığı için limit 60 yeterli)
            const recentStats = await DiggerStat.find({ serverHost: host })
                .sort({ timestamp: -1 })
                .limit(60);
                
            // Günlük bazda toplulaştırma (Aggregate)
            const dailyStats = await DiggerStat.aggregate([
                { $match: { serverHost: host } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                        totalBlocks: { $sum: "$blocksMined" },
                        totalPickaxes: { $sum: "$pickaxesUsed" }
                    }
                },
                { $sort: { _id: 1 } },
                { $limit: 7 } // Son 7 gün
            ]);
            
            res.json({ recent: recentStats.reverse(), daily: dailyStats });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // --- WEBSOCKET EVENTLERİ ---
    io.on('connection', (socket) => {
        console.log('[WebPanel] Yeni bir yönetici bağlandı.');

        // Bağlanan kişiye mevcut bot durumunu ve ayarlarını yolla
        socket.emit('bot_online_status', getBot() !== null);
        socket.emit('config_update', require('../Functions/botManager').getConfig());

        // Config Güncelleme İsteği
        socket.on('update_config', (newConfig) => {
            require('../Functions/botManager').updateConfig(newConfig);
            io.emit('config_update', require('../Functions/botManager').getConfig());
        });

        // Manuel Towny Giriş İsteği
        socket.on('join_towny', () => {
            const bot = getBot();
            if (bot) {
                require('../Functions/gamemodeSelector').joinTowny(bot);
            }
        });

        // Envanterden Eşya Atma İsteği
        socket.on('toss_item', async (data) => {
            const bot = getBot();
            if (bot && bot.inventory) {
                try {
                    const item = bot.inventory.items().find(i => i.name === data.name);
                    if (item) {
                        await bot.toss(item.type, null, data.count || 1);
                        socket.emit('system_message', `${data.count} adet ${data.name} atıldı.`);
                    }
                } catch (err) {
                    socket.emit('system_error', "Eşya atılamadı: " + err.message);
                }
            }
        });

        // Sandıkları Tarama İsteği
        socket.on('scan_chests', () => {
            const bot = getBot();
            if (bot) {
                const { scanChests } = require('../Functions/chestScanner');
                scanChests(bot);
                socket.emit('system_message', "Sandık taraması başlatıldı!");
            } else {
                socket.emit('system_error', "Bot kapalı olduğu için sandıklar taranamıyor.");
            }
        });

        // Web'den bota mesaj gönderme
        socket.on('send_chat', (msg) => {
            const activeBot = getBot();
            if (activeBot && activeBot.chat) {
                activeBot.chat(msg);
            }
        });

        // Bot Başlatma İsteği
        socket.on('start_bot', () => {
            const started = startBot();
            if (!started) {
                socket.emit('system_error', "Bot zaten açık!");
            }
        });

        // Bot Durdurma İsteği
        socket.on('stop_bot', () => {
            const stopped = stopBot();
            if (!stopped) {
                socket.emit('system_error', "Bot zaten kapalı!");
            }
        });

        // Oto-Kazıcı İsteği
        socket.on('start_digger', () => {
            const bot = getBot();
            if (bot) {
                startDigger(bot);
                socket.emit('system_message', "Oto-Kazıcı başlatıldı!");
            } else {
                socket.emit('system_error', "Bot kapalı!");
            }
        });

        socket.on('stop_digger', async () => {
            await stopDigger();
            socket.emit('system_message', "Oto-Kazıcı durduruldu!");
        });

        socket.on('save_digger_pos', async () => {
            const bot = getBot();
            if (bot) {
                const saved = await saveDiggerPos(bot);
                if (saved) {
                    socket.emit('system_message', "Oto-Kazıcı konumu başarıyla kaydedildi!");
                } else {
                    socket.emit('system_error', "Konum alınamadı (Bot yüklenmemiş olabilir).");
                }
            } else {
                socket.emit('system_error', "Bot kapalı!");
            }
        });

        // Kurye İsteği (Eşya Getir / Bırak)
        socket.on('fetch_item', async (data) => {
            const { itemName, amount, targetType, targetData } = data;
            const bot = getBot();
            
            if (!bot) {
                socket.emit('courier_status', { success: false, message: "Bot kapalı. Lütfen önce botu başlatın." });
                return;
            }

            socket.emit('courier_status', { success: null, message: `${amount} adet ${itemName} için kurye yola çıktı...` });
            
            // Asenkron olarak kurye fonksiyonunu çağır
            const result = await fetchItem(bot, itemName, amount, targetType, targetData);
            socket.emit('courier_status', result);
        });

        socket.on('disconnect', () => {
            console.log('[WebPanel] Yönetici ayrıldı.');
        });
    });

    // --- TPS ve Ping Takibi ---
    let lastTickTime = Date.now();
    let tps = 20;
    
    // Her 1 saniyede durumu kontrol et ve yayınla
    setInterval(() => {
        const bot = getBot();
        if (!bot) return; // Bot açık değilse yayın yapma

        // TPS hesabı için physicsTick eventi burada tanımlanabilir
        // Ancak en doğrusu botManager içinde halletmek. 
        // Şimdilik ping üzerinden varsayılan gönderiyoruz veya 
        // physicsTick'i listener ile yakalıyoruz:
        if (!bot.hasTpsListener) {
            bot.on('physicsTick', () => {
                const now = Date.now();
                const dt = (now - lastTickTime) / 1000;
                lastTickTime = now;
                const currentTps = dt > 0 ? Math.min(20, 1 / dt) : 20;
                tps = tps * 0.9 + currentTps * 0.1;
            });
            bot.hasTpsListener = true;
        }

        if (!bot.entity) return;

        const equipment = {
            helmet: bot.inventory.slots[5]?.name || "Yok",
            chestplate: bot.inventory.slots[6]?.name || "Yok",
            leggings: bot.inventory.slots[7]?.name || "Yok",
            boots: bot.inventory.slots[8]?.name || "Yok",
            hand: bot.heldItem?.name || "Boş"
        };

        const inventoryItems = bot.inventory.items().map(i => ({ 
            name: i.name, 
            count: i.count 
        }));

        io.emit('bot_status', {
            isOnline: true,
            health: bot.health,
            food: bot.food,
            position: {
                x: Math.round(bot.entity.position.x),
                y: Math.round(bot.entity.position.y),
                z: Math.round(bot.entity.position.z)
            },
            username: bot.username,
            server: process.env.HOST,
            equipment: equipment,
            inventory: inventoryItems,
            tps: tps.toFixed(1),
            ping: bot.player?.ping || 0,
            botStats: getBotStats(),
            diggerStats: getDiggerStats()
        });

        // Scoreboard gönder (Gizli Takımları Çözümleme)
        if (bot.myTeamMap) {
            let manualLines = [];
            for (let i = 1; i <= 15; i++) {
                const team = bot.myTeamMap[`TAB-Sidebar-${i}`];
                if (team) {
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
                    const prefix = parseMessage(team.prefix);
                    const suffix = parseMessage(team.suffix);
                    manualLines.push((prefix + " " + suffix).trim());
                }
            }
            // Çok fazla log spam yapmaması için sadece doluysa yaz
            if (manualLines.length > 0) {
                console.log("[Scoreboard] Çözümlenen Satırlar:", manualLines);
                io.emit('scoreboard_update', { title: "CHICKENNW", lines: manualLines });
            }
        }
    }, 1000);

    const PORT = process.env.WEB_PORT || 4000;
    server.listen(PORT, () => {
        console.log(`[WebPanel] Gerçek zamanlı veri sunucusu çalışıyor: http://localhost:${PORT}`);
    });
}

module.exports = { startWebServer };
