const { Telegraf, Markup } = require('telegraf');
const http = require('http');

// سيرفر وهمي عشان ريلواي يثبت البوت وما يصير أحمر
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
const whisperStore = {}; // تخزين الهمسات مؤقتاً بالذاكرة

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
        `اهلا بك يا قلبي 🫶 ــ ${userName}\n\n• انا اشغل لك اللي تبي بالمكالمة`,
        Markup.inlineKeyboard([
            [Markup.button.url('➕ أضفني في مجموعتك', `https://t.me/${botUsername}?startgroup=true`)],
            [Markup.button.url('👤 المطور', 'https://t.me/j4xa7')]
        ])
    );
});

// --- نظام الهمسات المباشر (زي الفيديو) ---
// الطريقة: يكتب المستخدم (اهمس [النص] @الشخص) أو بالرد مع النص
bot.hears(/^(?:اهمس|همسه)\s+(.+)$/, async (ctx) => {
    try {
        let targetId, targetName;
        const whisperText = ctx.match[1]; // النص اللي بعد كلمة اهمس

        // إذا كان بالرد على الشخص
        if (ctx.message.reply_to_message) {
            targetId = ctx.message.reply_to_message.from.id.toString();
            targetName = ctx.message.reply_to_message.from.first_name || 'الشخص';
        } else {
            return ctx.reply('⚠️ يرجى الرد على رسالة الشخص المراد أهماسه مع كتابة الهمسة، مثال:\nاهمس كيفك', { reply_to_message_id: ctx.message.message_id });
        }

        const senderId = ctx.from.id.toString();
        const senderName = ctx.from.first_name || 'صديق';

        // تخزين الهمسة في الذاكرة مع تحديد من المرسل ومن المستقبل فقط
        const whisperId = `wh_${Date.now()}_${Math.random()}`;
        whisperStore[whisperId] = {
            text: whisperText,
            targetId: targetId,
            senderId: senderId,
            targetName: targetName,
            senderName: senderName
        };

        // حذف رسالة الشخص الأصلية للسرية التامة
        try {
            await ctx.deleteMessage();
        } catch (e) {}

        // إرسال رسالة الهمسة في القروب بنفس الشكل المطلوب
        await ctx.reply(
            `• يا حلو ⟵ ${targetName}\n• وصلتك همسة سرية جديدة من ⟵ ${senderName}\n• انت وحدك تقدر تشوفها`,
            Markup.inlineKeyboard([
                [Markup.button.callback('رؤية الهمسة', `show_wh_${whisperId}`)]
            ])
        );

    } catch (e) {
        console.log(e);
    }
});

// عند الضغط على زر رؤية الهمسة
bot.action(/^show_wh_(.+)$/, (ctx) => {
    const whisperId = ctx.match[1];
    const whisper = whisperStore[whisperId];

    if (!whisper) {
        return ctx.answerCbQuery('⚠️ انتهت صلاحية الهمسة أو تم حذفها.', { show_alert: true });
    }

    const userId = ctx.from.id.toString();

    // التحقق هل هو الشخص الموجهة له الهمسة أو المرسل نفسه؟
    if (userId !== whisper.targetId && userId !== whisper.senderId) {
        return ctx.answerCbQuery('❌ عذراً، هذه الهمسة ليست موجهة لك وحدك!', { show_alert: true });
    }

    // إظهار الهمسة لنافذة منبثقة (Alert) زي الفيديو تماماً
    return ctx.answerCbQuery(`💌 محتوى الهمسة:\n\n${whisper.text}`, { show_alert: true });
});

// --- الأوامر العامة والألعاب ---
bot.hears(/^يوت\s+(.+)$/, (ctx) => {
    const songName = ctx.match[1];
    const botUsername = ctx.botInfo.username;
    ctx.reply(
        `🎵 جارٍ تشغيل الأغنية: [ ${songName} ]\n• اضغط الزر بالأسفل للاستماع والتحكم بالموسيقى.`,
        Markup.inlineKeyboard([
            [Markup.button.url(`▶️ استماع لـ (${songName})`, `https://t.me/${botUsername}`)],
            [Markup.button.url('🌐 البحث في يوتيوب', `https://www.youtube.com/results?search_query=${encodeURIComponent(songName)}`)]
        ])
    );
});

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

bot.launch().then(() => {
    console.log('Bot is running successfully with Direct Popup Whispers!');
});
