require('dotenv').config();
const { handleDiscordChat } = require('./Functions/discord');
const { startWebServer } = require('./Server/webServer');
const { getBot } = require('./Functions/botManager');

const connectDB = require('./Database/db');

// DB Bağlantısını Başlat
connectDB();

// Initialize Discord Handler with dynamic bot getter
handleDiscordChat(getBot);

// Web Server'ı Başlat (Bot artık web üzerinden başlatılacak)
startWebServer();
