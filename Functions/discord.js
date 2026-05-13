const { Client, GatewayIntentBits } = require('discord.js');
const { joinTowny } = require('./gamemodeSelector');
const { scanChests, fetchItem } = require('./chestScanner');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

function handleDiscordChat(getBot) {
    client.on('messageCreate', (message) => {
        if (message.author.bot || message.channel.id !== process.env.CHANNEL_ID) return;
        
        const bot = getBot();
        if (!bot) {
            message.reply("Minecraft botu şu anda çevrimdışı. Lütfen Web Panelinden botu başlatın.");
            return;
        }

        if (message.content.toLowerCase() === 'sandiktara') {
            message.reply("Sandık taraması başlatılıyor. Sonuçlar konsola yazdırılacak...");
            scanChests(bot);
            return;
        }

        if (message.content.toLowerCase().startsWith('getir ')) {
            const args = message.content.split(' ');
            if (args.length >= 3) {
                const itemName = args[1];
                const amount = args[2];
                message.reply(`Kurye yola çıkıyor! ${amount} adet ${itemName} EmsalSizOFC adlı oyuncuya teslim edilecek.`);
                fetchItem(bot, itemName, amount, 'player', "EmsalSizOFC");
            } else {
                message.reply("Kullanım: `getir <eşya_adı> <miktar>` (Örn: `getir stone 10`)");
            }
            return;
        }

        bot.chat(`${message.content}`);
    });
}

async function sendToDiscord(content) {
    try {
        const channel = await client.channels.fetch(process.env.CHANNEL_ID);
        if (channel) {
            channel.send(content);
        }
    } catch (err) {
        console.error("Discord mesaj gönderme hatası:", err.message);
    }
}


client.login(process.env.DISCORD_TOKEN);

module.exports = { handleDiscordChat, sendToDiscord };
