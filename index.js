const { Telegraf, Markup } = require('telegraf');
const http = require('http');

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!');
}).listen(PORT);

const bot = new Telegraf(process.env.BOT_TOKEN);

const groupSettings = {};
const floodControl = {};
let gamesEnabled = true;

function getUserRole(ctx) {
    if (!ctx.from || !ctx.chat) return 'عضو';
    const username = ctx.from.username ? ctx.from.username.toLowerCase() : '';
    const devUsernames = ['j4xa7', 'to6ri', 'evy', 'evelaf', 'toraif'];
    if (devUsernames.includes(username)) return 'Dev🎖️';
    return 'عضو';
}

bot.start((ctx) => {
    ctx.reply('أهلاً بك! بوت الحماية والإدارة يعمل بكامل طاقته.');
});

// أوامر القفل والفتح
bot.hears(/^قفل الصور$/, (ctx) => {
    if (ctx.chat.type === 'private') return;
    groupSettings[ctx.chat.id] = groupSettings[ctx.chat.id] || {};
    groupSettings[ctx.chat.id].lockPhotos = true;
    return ctx.reply('🔒 تم قفل الصور بنجاح.');
});

bot.hears(/^فتح الصور$/, (ctx) => {
    if (ctx.chat.type === 'private') return;
    groupSettings[ctx.chat.id] = groupSettings[ctx.chat.id] || {};
    groupSettings[ctx.chat.id].lockPhotos = false;
    return ctx.reply('🔓 تم فتح الصور.');
});

bot.hears(/^قفل الملصقات$/, (ctx) => {
    if (ctx.chat.type === 'private') return;
    groupSettings[ctx.chat.id] = groupSettings[ctx.chat.id] || {};
    groupSettings[ctx.chat.id].lockStickers = true;
    return ctx.reply('🔒 تم قفل الملصقات بنجاح.');
});

bot.hears(/^فتح الملصقات$/, (ctx) => {
    if (ctx.chat.type === 'private') return;
    groupSettings[ctx.chat.id] = groupSettings[ctx.chat.id] || {};
    groupSettings[ctx.chat.id].lockStickers = false;
    return ctx.reply('🔓 تم فتح الملصقات.');
});

// مراقبة الحماية
bot.on('message', async (ctx, next) => {
    try {
        if (!ctx.chat || ctx.chat.type === 'private' || !ctx.from || ctx.from.is_bot) return next();
        const chatId = ctx.chat.id;
        const settings = groupSettings[chatId] || {};

        if (settings.lockPhotos && ctx.message.photo) {
            await ctx.deleteMessage().catch(() => {});
            return ctx.reply('⚠️ تم حذف الصورة: الصور مقفولة.');
        }
        if (settings.lockStickers && ctx.message.sticker) {
            await ctx.deleteMessage().catch(() => {});
            return ctx.reply('⚠️ تم حذف الملصق: الملصقات مقفولة.');
        }
    } catch (e) {}
    return next();
});

bot.launch().then(() => {
    console.log('Bot is running successfully!');
});
