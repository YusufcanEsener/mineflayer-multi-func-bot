const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const Vec3 = require('vec3');

const DiggerStat = require('../Models/DiggerStat');
const DiggerConfig = require('../Models/DiggerConfig');

let isDigging = false;
let diggerStats = {
    blocksMined: 0,
    minedBlocksBreakdown: {},
    pickaxesUsed: 0
};
let intervalMinedBlocks = {};
let lastSavedStats = {
    blocksMined: 0,
    pickaxesUsed: 0
};

let startPosition = null;
let digDirection = null;

let savedCoordinate = null;
let savedDigDirection = null;

// MongoDB'den kayıtlı koordinatı yükle
async function loadSavedConfig() {
    try {
        const host = process.env.HOST || 'localhost';
        const config = await DiggerConfig.findOne({ serverHost: host });
        if (config && config.savedCoordinate) {
            savedCoordinate = new Vec3(config.savedCoordinate.x, config.savedCoordinate.y, config.savedCoordinate.z);
            savedDigDirection = new Vec3(config.savedDigDirection.x, config.savedDigDirection.y, config.savedDigDirection.z);
            console.log(`[AutoDigger] Kayıtlı koordinatlar MongoDB'den yüklendi: X:${savedCoordinate.x} Y:${savedCoordinate.y} Z:${savedCoordinate.z}`);
        }
    } catch (err) {
        console.error("[AutoDigger] Kayıtlı koordinatlar yüklenirken hata:", err);
    }
}
loadSavedConfig();

// Her 1 dakikada bir (demo için 1 dakika, normalde 5 de olabilir) DB'ye kayıt atar
setInterval(() => {
    if (!isDigging) return;
    const deltaBlocks = diggerStats.blocksMined - lastSavedStats.blocksMined;
    const deltaPickaxes = diggerStats.pickaxesUsed - lastSavedStats.pickaxesUsed;
    
    if (deltaBlocks > 0 || deltaPickaxes > 0) {
        new DiggerStat({
            blocksMined: deltaBlocks,
            minedBlocksBreakdown: intervalMinedBlocks,
            pickaxesUsed: deltaPickaxes,
            serverHost: process.env.HOST || 'localhost'
        }).save().catch(err => console.error("[AutoDigger] İstatistik kaydedilirken hata:", err));
        
        lastSavedStats.blocksMined = diggerStats.blocksMined;
        lastSavedStats.pickaxesUsed = diggerStats.pickaxesUsed;
        intervalMinedBlocks = {};
    }
}, 60 * 1000); // 1 dakikada bir

async function saveDiggerPos(bot) {
    if (!bot || !bot.entity) return false;
    
    savedCoordinate = bot.entity.position.clone();
    const yaw = bot.entity.yaw;
    const pitch = bot.entity.pitch;
    savedDigDirection = new Vec3(
        -Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch)
    ).normalize();

    // Veritabanına kaydet
    try {
        const host = process.env.HOST || 'localhost';
        await DiggerConfig.findOneAndUpdate(
            { serverHost: host },
            { 
                savedCoordinate: { x: savedCoordinate.x, y: savedCoordinate.y, z: savedCoordinate.z },
                savedDigDirection: { x: savedDigDirection.x, y: savedDigDirection.y, z: savedDigDirection.z }
            },
            { upsert: true, new: true }
        );
        console.log(`[AutoDigger] Kazı başlangıç konumu MongoDB'ye kaydedildi: X:${Math.floor(savedCoordinate.x)} Y:${Math.floor(savedCoordinate.y)} Z:${Math.floor(savedCoordinate.z)}`);
        return true;
    } catch (err) {
        console.error("[AutoDigger] Konum kaydedilirken DB hatası:", err);
        return false;
    }
}

async function startDigger(bot) {
    if (isDigging) return;
    
    if (!bot.pathfinder) {
        bot.loadPlugin(pathfinder);
    }
    
    isDigging = true;
    
    if (savedCoordinate && savedDigDirection) {
        startPosition = savedCoordinate.clone();
        digDirection = savedDigDirection.clone();
        console.log(`[AutoDigger] Kayıtlı konuma odaklanıldı.`);
    } else {
        startPosition = bot.entity.position.clone();
        const yaw = bot.entity.yaw;
        const pitch = bot.entity.pitch;
        digDirection = new Vec3(
            -Math.sin(yaw) * Math.cos(pitch),
            Math.sin(pitch),
            -Math.cos(yaw) * Math.cos(pitch)
        ).normalize();
        console.log(`[AutoDigger] Kayıtlı konum yok, mevcut konum baz alınıyor.`);
    }
    
    console.log(`[AutoDigger] Başlatıldı. Yön: ${digDirection}`);
    
    // 1. Kazma Kontrolü Yap
    const pickaxes = bot.inventory.items().filter(i => i.name.includes('pickaxe'));
    let validPickaxe = null;
    for (const pickaxe of pickaxes) {
        const maxD = bot.registry.itemsByName[pickaxe.name].maxDurability || 1561;
        const used = pickaxe.durabilityUsed || 0;
        if (maxD - used >= 20) {
            validPickaxe = pickaxe;
            break;
        }
    }

    if (!validPickaxe) {
        console.log("[AutoDigger] Başlamadan önce yeterli cana sahip kazma yok. Sandığa gidiliyor...");
        await swapPickaxe(bot);
        if (!isDigging) return;
    } else {
        console.log("[AutoDigger] Kazma yeterli, hedef konuma gidiliyor...");
        // Kayıtlı veya mevcut hedefe git
        const move = new Movements(bot);
        move.scafoldingBlocks = []; // Blok koymayı engelle
        bot.pathfinder.setMovements(move);
        bot.pathfinder.setGoal(new goals.GoalNear(startPosition.x, startPosition.y, startPosition.z, 1));
        await new Promise(resolve => {
            bot.once('goal_reached', resolve);
            setTimeout(resolve, 15000);
        });
        const yaw = Math.atan2(-digDirection.x, -digDirection.z);
        const pitch = Math.asin(digDirection.y);
        await bot.look(yaw, pitch, true);
    }
    
    digLoop(bot);
    
    // DB durumunu güncelle
    try {
        const host = process.env.HOST || 'localhost';
        await DiggerConfig.findOneAndUpdate({ serverHost: host }, { isActive: true }, { upsert: true });
    } catch(e) {}
}

async function stopDigger() {
    isDigging = false;
    console.log("[AutoDigger] Durduruldu.");
    
    // DB durumunu güncelle
    try {
        const host = process.env.HOST || 'localhost';
        await DiggerConfig.findOneAndUpdate({ serverHost: host }, { isActive: false }, { upsert: true });
    } catch(e) {}
}

async function checkAutoResume(bot) {
    try {
        const host = process.env.HOST || 'localhost';
        const config = await DiggerConfig.findOne({ serverHost: host });
        if (config && config.isActive) {
            console.log("[AutoDigger] Önceki oturumda aktif olduğu tespit edildi, otomatik başlatılıyor...");
            // Biraz bekleyelim bot tam otursun (3 saniye)
            setTimeout(() => {
                if (!isDigging) startDigger(bot);
            }, 3000);
        }
    } catch (err) {
        console.error("[AutoDigger] Auto-resume kontrolü sırasında hata:", err);
    }
}

function getDiggerStats() {
    return {
        isActive: isDigging,
        savedCoordinate: savedCoordinate ? {
            x: Math.floor(savedCoordinate.x),
            y: Math.floor(savedCoordinate.y),
            z: Math.floor(savedCoordinate.z)
        } : null,
        ...diggerStats
    };
}

async function digLoop(bot) {
    if (!isDigging) return;

    // Find a valid pickaxe in inventory
    const pickaxes = bot.inventory.items().filter(i => i.name.includes('pickaxe'));
    console.log(`[AutoDigger] Envanterde ${pickaxes.length} adet kazma tespit edildi.`);
    
    let validPickaxe = null;

    for (const pickaxe of pickaxes) {
        const maxD = bot.registry.itemsByName[pickaxe.name].maxDurability || 1561;
        const used = pickaxe.durabilityUsed || 0;
        const durability = maxD - used;
        
        console.log(`[AutoDigger] Kazma inceleniyor - İsim: ${pickaxe.name}, Kalan Can: ${durability}`);

        if (durability >= 20) {
            validPickaxe = pickaxe;
            console.log(`[AutoDigger] Sağlam kazma bulundu ve seçildi.`);
            break;
        }
    }

    if (!validPickaxe) {
        console.log(`[AutoDigger] Envanterde sağlam kazma yok. Sandığa gidiliyor.`);
        await swapPickaxe(bot);
        if (!isDigging) return;
    } else {
        if (!bot.heldItem || bot.heldItem.name !== validPickaxe.name) {
            try {
                await bot.equip(validPickaxe, 'hand');
            } catch(e) {}
        }
    }

    // Attempt to dig the block we are looking at (max distance 5)
    const blockToDig = bot.blockAtCursor(5);

    if (!blockToDig || blockToDig.name === 'air' || blockToDig.name === 'water' || blockToDig.name === 'lava') {
        // Wait for block to generate
        await new Promise(res => setTimeout(res, 200));
        return digLoop(bot);
    }

    try {
        if (bot.canDigBlock(blockToDig)) {
            const blockName = blockToDig.name;
            await bot.dig(blockToDig);
            diggerStats.blocksMined++;
            diggerStats.minedBlocksBreakdown[blockName] = (diggerStats.minedBlocksBreakdown[blockName] || 0) + 1;
            intervalMinedBlocks[blockName] = (intervalMinedBlocks[blockName] || 0) + 1;
        } else {
             await new Promise(res => setTimeout(res, 200));
        }
    } catch (err) {
        console.log(`[AutoDigger] Kazma hatası: ${err.message}`);
    }

    setTimeout(() => digLoop(bot), 50);
}

async function swapPickaxe(bot) {
    console.log("[AutoDigger] Yeni kazma aranıyor...");
    diggerStats.pickaxesUsed++;

    const chestBlock = bot.findBlock({
        matching: bot.registry.blocksByName.chest.id,
        maxDistance: 32
    });

    if (!chestBlock) {
        console.log("[AutoDigger] Yakında sandık bulunamadı! Kazma işlemi duraklatılıyor.");
        isDigging = false;
        return;
    }

    const defaultMove = new Movements(bot);
    defaultMove.canDig = false;
    defaultMove.scafoldingBlocks = []; // Blok koymayı engelle
    bot.pathfinder.setMovements(defaultMove);
    bot.pathfinder.setGoal(new goals.GoalGetToBlock(chestBlock.position.x, chestBlock.position.y, chestBlock.position.z));

    await new Promise(resolve => {
        bot.once('goal_reached', resolve);
        setTimeout(resolve, 15000); 
    });

    try {
        console.log("[AutoDigger] Sandık açılıyor...");
        let chest = await bot.openContainer(chestBlock);
        await new Promise(res => setTimeout(res, 500));

        // 1. Önce envanterdeki canı az olan kazmaları bırak
        console.log("[AutoDigger] 1. Aşama: Envanterdeki kırık kazmalar sandığa bırakılıyor...");
        let deposited = false;
        for (const item of bot.inventory.items()) {
            if (item.name.includes('pickaxe')) {
                const maxD = bot.registry.itemsByName[item.name].maxDurability || 1561;
                const used = item.durabilityUsed || 0;
                const durability = maxD - used;
                
                if (durability < 20) {
                    console.log(`[AutoDigger] Kırık kazma bulundu (Can: ${durability}). Sandığa aktarılıyor...`);
                    await chest.deposit(item.type, item.metadata, item.count, item.nbt);
                    deposited = true;
                    await new Promise(res => setTimeout(res, 500)); // İşlemin yansıması için bekle
                }
            }
        }

        if (deposited) {
            console.log("[AutoDigger] Envanter senkronizasyonu için sandık yenileniyor...");
            await chest.close();
            await new Promise(res => setTimeout(res, 500));
            chest = await bot.openContainer(chestBlock);
            await new Promise(res => setTimeout(res, 500));
        }

        // 2. Sandıktaki canı yüksek kazmayı ara
        console.log("[AutoDigger] 2. Aşama: Sandıktan sağlam kazma aranıyor...");
        let newPickaxe = null;
        for (const item of chest.containerItems()) {
            if (item.name.includes('pickaxe')) {
                const maxD = bot.registry.itemsByName[item.name].maxDurability || 1561;
                const used = item.durabilityUsed || 0;
                const durability = maxD - used;
                
                console.log(`[AutoDigger] Sandıkta kazma bulundu. İsim: ${item.name}, Can: ${durability}`);
                if (durability >= 20) {
                    newPickaxe = item;
                    console.log(`[AutoDigger] Sağlam kazma seçildi! (Can: ${durability})`);
                    break;
                }
            }
        }

        // 3. Bulunan sağlam kazmayı al
        if (newPickaxe) {
            console.log(`[AutoDigger] 3. Aşama: Seçilen sağlam kazma (Slot: ${newPickaxe.slot}) envantere çekiliyor...`);
            // mineflayer 'withdraw' fonksiyonu nbt eşleştirmesinde hata yapıp ilk bulduğu kırık kazmayı çektiği için,
            // tam olarak sağlam kazmanın bulunduğu slota shift-click yaparak alıyoruz.
            await bot.clickWindow(newPickaxe.slot, 0, 1);
            await new Promise(res => setTimeout(res, 500));
            console.log("[AutoDigger] Yeni kazma başarıyla envantere alındı.");
        } else {
            console.log("[AutoDigger] Sandıkta sağlam kazma bulunamadı! İşlem durduruluyor.");
            isDigging = false;
        }

        console.log("[AutoDigger] Sandık kapatılıyor.");
        await chest.close();
        await new Promise(res => setTimeout(res, 500));

    } catch (err) {
        console.log(`[AutoDigger] Sandık işlemi sırasında hata: ${err.message}`);
        isDigging = false;
    }

    if (isDigging && startPosition) {
        const move = new Movements(bot);
        move.scafoldingBlocks = []; // Blok koymayı engelle
        bot.pathfinder.setMovements(move);
        bot.pathfinder.setGoal(new goals.GoalNear(startPosition.x, startPosition.y, startPosition.z, 1));
        await new Promise(resolve => {
            bot.once('goal_reached', resolve);
            setTimeout(resolve, 15000);
        });
        
        const yaw = Math.atan2(-digDirection.x, -digDirection.z);
        const pitch = Math.asin(digDirection.y);
        await bot.look(yaw, pitch, true);
    }
}

module.exports = { startDigger, stopDigger, getDiggerStats, saveDiggerPos, checkAutoResume };
