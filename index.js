const { Telegraf } = require('telegraf');
const http = require('http');

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive!');
}).listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
    ctx.reply('أهلاً بك! بوت الحماية والإدارة يعمل بنجاح.');
});

// نظام حماية الصور والملصقات البسيط
const groupSettings = {};

bot.hears(/^قفل الصور$/, (ctx) => {
    if (ctx.chat.type === 'private') return;
    groupSettings[ctx.chat.id] = { ...groupSettings[ctx.chat.id], lockPhotos: true };
    return ctx.reply('🔒 تم قفل الصور بنجاح.');
});

bot.hears(/^فتح الصور$/, (ctx) => {
    if (ctx.chat.type === 'private') return;
    groupSettings[ctx.chat.id] = { ...groupSettings[ctx.chat.id], lockPhotos: false };
    return ctx.reply('🔓 تم فتح الصور.');
});

bot.on('message', async (ctx, next) => {
    try {
        if (!ctx.chat || ctx.chat.type === 'private' || !ctx.from || ctx.from.is_bot) return next();
        const settings = groupSettings[ctx.chat.id] || {};
        if (settings.lockPhotos && ctx.message.photo) {
            await ctx.deleteMessage().catch(() => {});
            return ctx.reply('⚠️ تم حذف الصورة: الصور مقفولة.');
        }
    } catch (e) {}
    return next();
});

bot.launch().then(() => {
    console.log('Bot started successfully via Polling!');
});
