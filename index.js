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
const userStats = {};
const mutedUsers = {}; 
const whisperStore = {}; 

let gamesEnabled = true;

function getUserRole(ctx) {
    if (!ctx.from || !ctx.chat) return 'عضو';
    const userId = ctx.from.id;
    const username = ctx.from.username ? ctx.from.username.toLowerCase() : '';
    const chatId = ctx.chat.id;
    const devUsernames = ['j4xa7', 'to6ri', 'evy', 'evelaf'];
    
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
        `اهلا بك يا قلبي 🫶 ــ ${userName}`,
        Markup.inlineKeyboard([
            [Markup.button.url('➕ أضفني في مجموعتك', `https://t.me/${botUsername}?startgroup=true`)],
            [Markup.button.url('👤 المطور', 'https://t.me/j4xa7')]
        ])
    );
});

// نظام الهمسات المباشر والسريع بالقروب (اهمس + النص بالرد على الشخص)
bot.hears(/^(?:اهمس|همسه)\s+(.+)$/, async (ctx) => {
    try {
        if (!ctx.message.reply_to_message) {
            return ctx.reply('⚠️ يرجى الرد على الشخص مع كتابة الهمسة، مثال:\nاهمس كيفك', { reply_to_message_id: ctx.message.message_id });
        }

        const targetId = ctx.message.reply_to_message.from.id.toString();
        const targetName = ctx.message.reply_to_message.from.first_name || 'الشخص';
        const whisperText = ctx.match[1];
        const senderId = ctx.from.id.toString();
        const senderName = ctx.from.first_name || 'صديق';

        const whisperId = `wh_${Date.now()}_${Math.random()}`;
        whisperStore[whisperId] = {
            text: whisperText,
            targetId: targetId,
            senderId: senderId,
            targetName: targetName,
            senderName: senderName
        };

        // حذف رسالتك الأصلية عشان تكون سرية تماماً بالقروب
        try { await ctx.deleteMessage(); } catch (e) {}

        // إرسال الهمسة للقروب بنفس الشكل الفخم اللي تبيه
        await ctx.reply(
            `• يا حلو ⟵ ${targetName}\n• وصلتك همسة سرية جديدة من ⟵ ${senderName}\n• انت وحدك تقدر تشوفها`,
            Markup.inlineKeyboard([
                [Markup.button.callback('رؤية الهمسة', `show_wh_${whisperId}`)]
            ])
        );
    } catch (e) {}
});

// رؤية الهمسة عبر النافذة المنبثقة (Alert)
bot.action(/^show_wh_(.+)$/, (ctx) => {
    const whisperId = ctx.match[1];
    const whisper = whisperStore[whisperId];

    if (!whisper) {
        return ctx.answerCbQuery('⚠️ انتهت صلاحية الهمسة أو تم حذفها.', { show_alert: true });
    }

    const userId = ctx.from.id.toString();
    if (userId !== whisper.targetId && userId !== whisper.senderId) {
        return ctx.answerCbQuery('❌ عذراً، هذه الهمسة ليست موجهة لك وحدك!', { show_alert: true });
    }

    return ctx.answerCbQuery(`💌 محتوى الهمسة:\n\n${whisper.text}`, { show_alert: true });
});

// الأوامر الأخرى
bot.hears(/^يوت\s+(.+)$/, (ctx) => {
    const songName = ctx.match[1];
    const botUsername = ctx.botInfo.username;
    ctx.reply(
        `🎵 جارٍ تشغيل الأغنية: [ ${songName} ]`,
        Markup.inlineKeyboard([
            [Markup.button.url(`▶️ استماع`, `https://t.me/${botUsername}`)]
        ])
    );
});

bot.hears(/^رتبتي$/, (ctx) => {
    const role = getUserRole(ctx);
    ctx.reply(`• رتبتك هي ↤ ｢ ${role} ｣\n• آي دي حسابك ↤ ${ctx.from.id}`);
});

bot.launch().then(() => {
    console.log('Bot is running successfully with Instant Group Whispers!');
});
