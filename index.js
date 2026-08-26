const { Telegraf, Markup } = require('telegraf');
const http = require('http');

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running and stable 24/7!');
}).listen(PORT);

const bot = new Telegraf(process.env.BOT_TOKEN);

const groupSettings = {};

// تحديد الرتب
function getUserRole(ctx) {
    if (!ctx.from) return 'عضو';
    const username = ctx.from.username ? ctx.from.username.toLowerCase() : '';
    const devUsernames = ['j4xa7', 'to6ri', 'evy', 'evelaf', 'toraif'];
    if (devUsernames.includes(username)) {
        return 'Dev🎖️';
    }
    return 'عضو';
}

// 1. أمر البداية
bot.start((ctx) => {
    const botUsername = ctx.botInfo.username;
    const userName = ctx.from.first_name || 'صديقي';
    ctx.reply(
        `أهلاً بك يا قلبي 🫶 ــ ${userName}\n\n• أنا بوتك المتكامل للحماية وإدارة القروب.`,
        Markup.inlineKeyboard([
            [Markup.button.url('➕ أضفني في مجموعتك', `https://t.me/${botUsername}?startgroup=true`)],
            [Markup.button.url('👤 المطور (توريف / إيفي)', 'https://t.me/j4xa7')]
        ])
    );
});

// 2. معالجة الأوامر والكلمات النصية (تشتغل فوراً وبدون تعليق)
bot.on('text', async (ctx, next) => {
    try {
        const text = ctx.message.text.trim();
        const chatId = ctx.chat.id;
        const isGroup = ctx.chat.type !== 'private';

        // أمر رتبتي
        if (text === 'رتبتي' || text === '/رتبتي') {
            const role = getUserRole(ctx);
            return ctx.reply(`• رتبتك هي ↤ ｢ ${role} ｣\n• آي دي حسابك ↤ ${ctx.from.id}`);
        }

        // الرد على اسم المطورين
        if (/toraif|توريف|إيفي|evy/i.test(text)) {
            return ctx.reply('• عيون المطورين (توريف وإيفي) 🤍');
        }

        // أوامر القفل والفتح (للقروبات فقط)
        if (isGroup) {
            if (text === 'قفل الصور') {
                groupSettings[chatId] = groupSettings[chatId] || {};
                groupSettings[chatId].lockPhotos = true;
                return ctx.reply('🔒 تم قفل الصور بنجاح، سيتم حذف أي صورة تُرسل.');
            }
            if (text === 'فتح الصور') {
                groupSettings[chatId] = groupSettings[chatId] || {};
                groupSettings[chatId].lockPhotos = false;
                return ctx.reply('🔓 تم فتح الصور.');
            }
            if (text === 'قفل الملصقات') {
                groupSettings[chatId] = groupSettings[chatId] || {};
                groupSettings[chatId].lockStickers = true;
                return ctx.reply('🔒 تم قفل الملصقات بنجاح، سيتم حذفها فوراً.');
            }
            if (text === 'فتح الملصقات') {
                groupSettings[chatId] = groupSettings[chatId] || {};
                groupSettings[chatId].lockStickers = false;
                return ctx.reply('🔓 تم فتح الملصقات.');
            }
        }
    } catch (e) {}
    
    return next(); // عشان تخلي الرسالة تكمل وتفحصها الحماية بعدها
});

// 3. نظام حماية الوسائط (صور وملصقات) منفصل لحاله عشان ما يعطل الأوامر
bot.on('message', async (ctx) => {
    try {
        if (!ctx.chat || ctx.chat.type === 'private' || !ctx.from || ctx.from.is_bot) return;
        const chatId = ctx.chat.id;
        const settings = groupSettings[chatId] || {};

        if (settings.lockPhotos && ctx.message.photo) {
            await ctx.deleteMessage().catch(() => {});
            return ctx.reply('⚠️ تم حذف الصورة: الصور مقفولة في المجموعة.');
        }

        if (settings.lockStickers && ctx.message.sticker) {
            await ctx.deleteMessage().catch(() => {});
            return ctx.reply('⚠️ تم حذف الملصق: الملصقات ممنوعة في المجموعة.');
        }
    } catch (e) {}
});

bot.launch({
    allowedUpdates: ['message', 'chat_member', 'callback_query']
}).then(() => {
    console.log('Bot is running smoothly and cleanly!');
});
