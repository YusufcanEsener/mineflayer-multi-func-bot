function joinTowny(bot) {
    console.log("Towny sunucusuna girme komutu alındı. Pusula aranıyor...");
    
    // Tüm slotları kontrol et (hotbar dahil)
    const compass = bot.inventory.slots.find(item => item && item.name && item.name.includes('compass')) || bot.heldItem;

    if (!compass || !compass.name.includes('compass')) {
        const itemNames = bot.inventory.items().map(i => i.name).join(', ');
        console.log(`Envanterde pusula bulunamadı! Mevcut eşyalar: ${itemNames || 'Boş'}`);
        return;
    }

    try {
        // Eğer eşya hotbar'daysa (36-44 arası), direkt slotu seç
        if (compass.slot >= 36 && compass.slot <= 44) {
            bot.setQuickBarSlot(compass.slot - 36);
        } else {
            console.log("Pusula hotbar'da değil, elle alınmaya çalışılıyor...");
            // Eğer hotbarda değilse equip kullanmak zorunda kalabiliriz ama genelde lobilerde hotbardadır.
        }

        setTimeout(() => {
            bot.activateItem();
            console.log("Pusulaya tıklandı, menü bekleniyor...");
        }, 500);
    } catch (err) {
        console.log("Pusula seçilirken hata oluştu:", err.message);
    }

    // Menü açıldığında bir kereliğine çalışacak kod
    bot.once('windowOpen', (window) => {
        setTimeout(() => {
            const serverItem = window.slots.find(item => item && item.name === 'light_blue_glazed_terracotta');

            if (serverItem) {
                bot.clickWindow(serverItem.slot, 0, 0)
                    .then(() => {
                        console.log("Towny sunucusuna yönlendiriliyor!");
                    })
                    .catch((err) => {
                        console.log("Tıklama başarısız:", err.message);
                    });
            } else {
                console.log("Menüde hedeflenen eşya bulunamadı.");
            }
        }, 1000);
    });
}

module.exports = { joinTowny };
