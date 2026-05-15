const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');
const Chest = require('../Models/Chest');

async function scanChests(bot) {
    console.log("\n[ChestScanner] Etraftaki sandıklar taranıyor...");
    
    if (!bot.pathfinder) {
        bot.loadPlugin(pathfinder);
    }

    const chestIds = [
        bot.registry.blocksByName.chest?.id,
        bot.registry.blocksByName.trapped_chest?.id,
        bot.registry.blocksByName.barrel?.id
    ].filter(id => id !== undefined);

    const chestBlocks = bot.findBlocks({
        matching: chestIds,
        maxDistance: 16,
        count: 50
    });

    if (chestBlocks.length === 0) {
        console.log("[ChestScanner] Yakında (16 blok) hiçbir sandık veya fıçı bulunamadı.");
        return;
    }

    console.log(`[ChestScanner] Toplam ${chestBlocks.length} sandık/fıçı bulundu. Tek tek dolaşılıyor...`);

    const allItems = {};
    const defaultMove = new Movements(bot);
    defaultMove.canOpenDoors = true;
    defaultMove.scafoldingBlocks = []; // Blok koymayı engelle

    for (let i = 0; i < chestBlocks.length; i++) {
        const chestPos = chestBlocks[i];
        console.log(`[ChestScanner] Gidiliyor: Sandık ${i + 1}/${chestBlocks.length} (${chestPos.x}, ${chestPos.y}, ${chestPos.z})`);

        bot.pathfinder.setMovements(defaultMove);
        const goal = new goals.GoalNear(chestPos.x, chestPos.y, chestPos.z, 3);
        
        try {
            await bot.pathfinder.goto(goal);
            
            const chestBlock = bot.blockAt(chestPos);
            const chest = await bot.openContainer(chestBlock);
            
            const items = chest.containerItems();
            const chestContent = {};

            for (const item of items) {
                // Toplam liste için
                if (allItems[item.name]) {
                    allItems[item.name] += item.count;
                } else {
                    allItems[item.name] = item.count;
                }
                
                // Bu spesifik sandık için
                if (chestContent[item.name]) {
                    chestContent[item.name] += item.count;
                } else {
                    chestContent[item.name] = item.count;
                }
            }
            
            // Sandığı MongoDB'ye kaydet
            const itemsArray = Object.entries(chestContent).map(([name, count]) => ({ name, count }));
            await Chest.findOneAndUpdate(
                { serverHost: process.env.HOST || 'localhost', x: chestPos.x, y: chestPos.y, z: chestPos.z },
                { items: itemsArray, lastScanned: Date.now() },
                { upsert: true, returnDocument: 'after' }
            );

            await chest.close();
            await new Promise(r => setTimeout(r, 1000));
            
        } catch (err) {
            console.log(`[ChestScanner] Sandık (${chestPos.x}, ${chestPos.y}, ${chestPos.z}) açılamadı:`, err.message);
        }
    }

    console.log("\n====== BULUNAN TÜM EŞYALAR ======");
    if (Object.keys(allItems).length === 0) {
        console.log("Taranan tüm sandıklar tamamen BOŞ.");
    } else {
        const sortedItems = Object.entries(allItems).sort((a, b) => b[1] - a[1]);
        for (const [itemName, count] of sortedItems) {
            console.log(`- ${itemName}: ${count} adet`);
        }
    }
    console.log("=================================\n");
}

async function fetchItem(bot, itemName, amountStr, targetType, targetData) {
    if (!bot.pathfinder) bot.loadPlugin(pathfinder);
    
    const amount = parseInt(amountStr);
    if (isNaN(amount) || amount <= 0) {
        console.log("[Kurye] Geçersiz miktar.");
        return { success: false, message: "Geçersiz miktar." };
    }

    // MongoDB'den bu eşyayı içeren sandıkları bul
    const targetChests = await Chest.find({ 
        serverHost: process.env.HOST || 'localhost',
        "items.name": itemName,
        "items.count": { $gt: 0 }
    });

    if (targetChests.length === 0) {
        const msg = `[Kurye] Veritabanında ${itemName} içeren hiçbir sandık bulunamadı! Önce 'sandiktara' yapın.`;
        console.log(msg);
        return { success: false, message: msg };
    }

    let remainingToFetch = amount;
    console.log(`[Kurye] ${amount} adet ${itemName} toplanmaya başlanıyor...`);

    const defaultMove = new Movements(bot);
    defaultMove.canOpenDoors = true;
    defaultMove.scafoldingBlocks = []; // Blok koymayı engelle

    for (const chestDoc of targetChests) {
        if (remainingToFetch <= 0) break;

        const itemRecord = chestDoc.items.find(i => i.name === itemName);
        if (!itemRecord || itemRecord.count <= 0) continue;

        const availableAmount = itemRecord.count;
        const amountToTakeFromHere = Math.min(availableAmount, remainingToFetch);

        console.log(`[Kurye] (${chestDoc.x}, ${chestDoc.y}, ${chestDoc.z}) konumundaki sandıktan ${amountToTakeFromHere} adet alınacak.`);

        bot.pathfinder.setMovements(defaultMove);
        const goal = new goals.GoalNear(chestDoc.x, chestDoc.y, chestDoc.z, 3);
        
        try {
            await bot.pathfinder.goto(goal);
            
            const vecPos = new Vec3(chestDoc.x, chestDoc.y, chestDoc.z);
            const chestBlock = bot.blockAt(vecPos);
            const chest = await bot.openContainer(chestBlock);
            
            const itemsToTake = chest.containerItems().filter(i => i.name === itemName);
            let takenFromThisChest = 0;

            for (const item of itemsToTake) {
                if (takenFromThisChest >= amountToTakeFromHere) break;
                
                const countToWithdraw = Math.min(item.count, amountToTakeFromHere - takenFromThisChest);
                try {
                    await chest.withdraw(item.type, null, countToWithdraw);
                    takenFromThisChest += countToWithdraw;
                } catch (withdrawErr) {
                    console.log("[Kurye] Çekerken hata:", withdrawErr.message);
                }
            }

            await chest.close();
            remainingToFetch -= takenFromThisChest;

            // Veritabanını güncelle
            itemRecord.count -= takenFromThisChest;
            await chestDoc.save();

        } catch (err) {
            console.log(`[Kurye] Sandığa gidilemedi veya açılamadı:`, err.message);
        }
    }

    const fetchedAmount = amount - remainingToFetch;
    if (fetchedAmount === 0) {
        const msg = `[Kurye] Hiç ${itemName} bulunamadı veya alınamadı.`;
        console.log(msg);
        return { success: false, message: msg };
    }

    console.log(`[Kurye] Toplam ${fetchedAmount} adet ${itemName} alındı. Hedefe gidiliyor...`);

    let targetGoal = null;
    let deliveryMessage = "";

    if (targetType === 'player') {
        const targetPlayerName = targetData;
        const targetPlayer = bot.players[targetPlayerName];
        if (!targetPlayer || !targetPlayer.entity) {
            const msg = `[Kurye] ${targetPlayerName} bulunamadı veya görüş mesafesi dışında!`;
            console.log(msg);
            return { success: false, message: msg };
        }
        targetGoal = new goals.GoalNear(targetPlayer.entity.position.x, targetPlayer.entity.position.y, targetPlayer.entity.position.z, 1);
        deliveryMessage = `${targetPlayerName} adlı oyuncuya`;
    } else if (targetType === 'coordinate') {
        const { x, y, z } = targetData;
        targetGoal = new goals.GoalNear(parseFloat(x), parseFloat(y), parseFloat(z), 1);
        deliveryMessage = `(${x}, ${y}, ${z}) koordinatına`;
    }

    if (!targetGoal) {
        return { success: false, message: "Geçersiz hedef türü." };
    }

    bot.pathfinder.setMovements(defaultMove);
    
    try {
        await bot.pathfinder.goto(targetGoal);
        console.log(`[Kurye] Hedefe ulaşıldı, eşyalar atılıyor...`);
        
        const itemsToToss = bot.inventory.items().filter(i => i.name === itemName);
        let tossedAmount = 0;
        
        for (const item of itemsToToss) {
            if (tossedAmount >= fetchedAmount) break;
            const countToToss = Math.min(item.count, fetchedAmount - tossedAmount);
            await bot.toss(item.type, null, countToToss);
            tossedAmount += countToToss;
        }
        
        const successMsg = `[Kurye] ${tossedAmount} adet ${itemName} başarıyla ${deliveryMessage} teslim edildi!`;
        console.log(successMsg);
        return { success: true, message: successMsg };

    } catch (err) {
        const errMsg = `[Kurye] Teslimat sırasında hata oluştu: ${err.message}`;
        console.log(errMsg);
        return { success: false, message: errMsg };
    }
}

module.exports = { scanChests, fetchItem };
