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

// أوامر القفل والفتح
bot.hears(/^قفل الصور$/, (ctx) => {
    if (ctx.chat.type === 'private') return;
    groupSettings[ctx.chat.id] = groupSettings[ctx.chat.id] || {};
    groupSettings[ctx.chat.id].lockPhotos = true;
    return ctx.reply('🔒 تم قفل الصور بنجاح، سيتم حذف أي صورة تُرسل.');
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
    return ctx.reply('🔒 تم قفل الملصقات بنجاح، سيتم حذفها فوراً.');
});

bot.hears(/^فتح الملصقات$/, (ctx) => {
    if (ctx.chat.type === 'private') return;
    groupSettings[ctx.chat.id] = groupSettings[ctx.chat.id] || {};
    groupSettings[ctx.chat.id].lockStickers = false;
    return ctx.reply('🔓 تم فتح الملصقات.');
});

// الألعاب والرتب
bot.hears(/^تعطيل الالعاب$/, (ctx) => {
    if (getUserRole(ctx) !== 'Dev🎖️') return ctx.reply('• هذا الامر يخص ↤ ｢ Dev🎖️ ｣');
    gamesEnabled = false;
    ctx.reply('🔒 تم تعطيل الألعاب والفعاليات بنجاح.');
});

bot.hears(/^تفعيل الالعاب$/, (ctx) => {
    if (getUserRole(ctx) !== 'Dev🎖️') return ctx.reply('• هذا الامر يخص ↤ ｢ Dev🎖️ ｣');
    gamesEnabled = true;
    ctx.reply('🔓 تم تفعيل الألعاب والفعاليات بنجاح.');
});

bot.hears(/^(?:\/)?الالعاب$/, (ctx) => {
    if (!gamesEnabled) return ctx.reply('⚠️ عذراً، الألعاب معطلة حالياً.');
    ctx.reply('• قائمة العاب البوت:\n• ترتيب\n• سمايلات\n• اسئله\n• احكام\n• حزوره\n• روليت');
});

bot.hears(/^(?:\/)?رتبتي$/, (ctx) => {
    const role = getUserRole(ctx);
    ctx.reply(`• رتبتك هي ↤ ｢ ${role} ｣\n• آي دي حسابك ↤ ${ctx.from.id}`);
});

// حماية البوتات
bot.on('new_chat_members', async (ctx) => {
    try {
        const newMembers = ctx.message.new_chat_members;
        for (const member of newMembers) {
            if (member.is_bot) {
                const myUsername = ctx.botInfo.username;
                if (member.username !== myUsername) {
                    await ctx.kickChatMember(member.id);
                    await ctx.reply(`🚨 تم اكتشاف بوت غريب (${member.first_name}) وتم طرده لحماية القروب!`);
                }
            }
        }
    } catch (e) {}
});

// المراقبة والحماية الشاملة
bot.on('message', async (ctx, next) => {
    try {
        if (!ctx.chat || ctx.chat.type === 'private' || !ctx.from || ctx.from.is_bot) {
            return next();
        }

        const chatId = ctx.chat.id;
        const settings = groupSettings[chatId] || {};

        if (settings.lockPhotos && ctx.message.photo) {
            try { await ctx.deleteMessage(); } catch (e) {}
            return ctx.reply('⚠️ تم حذف الصورة: الصور مقفولة في المجموعة.');
        }

        if (settings.lockStickers && ctx.message.sticker) {
            try { await ctx.deleteMessage(); } catch (e) {}
            return ctx.reply('⚠️ تم حذف الملصق: الملصقات ممنوعة في المجموعة.');
        }
    } catch (e) {}
    return next();
});

bot.launch().then(() => {
    console.log('Bot is running successfully!');
});
