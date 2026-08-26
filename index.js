const { Telegraf, Markup } = require('telegraf');
const http = require('http');

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running successfully!');
}).listen(PORT);

const bot = new Telegraf(process.env.BOT_TOKEN);

const adminIds = []; 
const userRoles = {};
const groupSettings = {};
const floodControl = {};
let gamesEnabled = true;

// تحديد الرتب (مع منشن توريف وإيفي)
function getUserRole(ctx) {
    if (!ctx.from || !ctx.chat) return 'عضو';
    const userId = ctx.from.id;
    const username = ctx.from.username ? ctx.from.username.toLowerCase() : '';
    const chatId = ctx.chat.id;
    
    const devUsernames = ['j4xa7', 'to6ri', 'evy', 'evelaf', 'toraif'];
    
    if (devUsernames.includes(username) || adminIds.includes(userId.toString())) {
        return 'Dev🎖️';
    }
    if (!userRoles[chatId]) userRoles[chatId] = {};
    return userRoles[chatId][userId] || 'عضو';
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
    const chatId = ctx.chat.id;
    if (!groupSettings[chatId]) groupSettings[chatId] = {};
    groupSettings[chatId].lockPhotos = true;
    return ctx.reply('🔒 تم قفل الصور بنجاح، سيتم حذف أي صورة تُرسل.');
});

bot.hears(/^فتح الصور$/, (ctx) => {
    if (ctx.chat.type === 'private') return;
    const chatId = ctx.chat.id;
    if (!groupSettings[chatId]) groupSettings[chatId] = {};
    groupSettings[chatId].lockPhotos = false;
    return ctx.reply('🔓 تم فتح الصور.');
});

bot.hears(/^قفل الملصقات$/, (ctx) => {
    if (ctx.chat.type === 'private') return;
    const chatId = ctx.chat.id;
    if (!groupSettings[chatId]) groupSettings[chatId] = {};
    groupSettings[chatId].lockStickers = true;
    return ctx.reply('🔒 تم قفل الملصقات بنجاح، سيتم حذفها فوراً.');
});

bot.hears(/^فتح الملصقات$/, (ctx) => {
    if (ctx.chat.type === 'private') return;
    const chatId = ctx.chat.id;
    if (!groupSettings[chatId]) groupSettings[chatId] = {};
    groupSettings[chatId].lockStickers = false;
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
        const userId = ctx.from.id;
        const userName = ctx.from.first_name || 'مستخدم';
        
        if (!groupSettings[chatId]) groupSettings[chatId] = {};
        const settings = groupSettings[chatId];

        if (settings.lockPhotos && ctx.message.photo) {
            try { await ctx.deleteMessage(); } catch (e) {}
            return ctx.reply(`⚠️ تم حذف الصورة: الصور مقفولة في المجموعة.`);
        }

        if (settings.lockStickers && ctx.message.sticker) {
            try { await ctx.deleteMessage(); } catch (e) {}
            return ctx.reply(`⚠️ تم حذف الملصق: الملصقات ممنوعة في المجموعة.`);
        }

        const now = Date.now();
        const TWO_MINUTES = 2 * 60 * 1000;
        let mediaType = null;

        if (ctx.message.voice || ctx.message.audio) mediaType = 'voice';
        else if (ctx.message.photo) mediaType = 'photo';

        if (mediaType) {
            if (!floodControl[chatId]) floodControl[chatId] = {};
            if (!floodControl[chatId][userId]) {
                floodControl[chatId][userId] = { voices: [], photos: [] };
            }

            const userRecord = floodControl[chatId][userId];
            const list = mediaType === 'voice' ? userRecord.voices : userRecord.photos;

            const validTimestamps = list.filter(t => (now - t) < TWO_MINUTES);
            validTimestamps.push(now);
            
            if (mediaType === 'voice') userRecord.voices = validTimestamps;
            else userRecord.photos = validTimestamps;

            if (validTimestamps.length > 11) {
                try {
                    await ctx.deleteMessage();
                    await ctx.restrictChatMember(userId, {
                        permissions: {
                            can_send_messages: false,
                            can_send_media_messages: false,
                            can_send_other_messages: false,
                            can_add_web_page_previews: false
                        }
                    });
                } catch (e) {}

                const typeText = mediaType === 'voice' ? 'الرسائل الصوتية' : 'الصور';
                return ctx.reply(`🚨 تم تقييد العضو [ ${userName} ] لتكرار إرسال ${typeText} بشكل مزعج!`);
            }
        }
    } catch (e) {}
    return next();
});

bot.launch().then(() => {
    console.log('Bot is running successfully!');
});
