function handleMinecraftChat(bot, sendToDiscordFn) {
    bot.on('message', (jsonMsg) => {
        const rawText = jsonMsg.toString();
        // Boş mesajları engelle
        if (!rawText || rawText.trim() === '') return;

        // jsonMsg.toAnsi() Minecraft renk kodlarını terminal renk kodlarına çevirir.
        // Discord, ```ansi kod blokları içinde bu renkleri destekler!
        const ansiText = jsonMsg.toAnsi();
        sendToDiscordFn(`\`\`\`ansi\n${ansiText}\n\`\`\``);
    });
}

/**
 * Send a message to Minecraft chat.
 */
function sendMinecraftMessage(bot, message) {
    bot.chat(message);
}

module.exports = { handleMinecraftChat, sendMinecraftMessage };
