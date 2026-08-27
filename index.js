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

const whisperSessions = {};
const whisperStore = {};

const userVoiceTimestamps = {};
const userPhotoTimestamps = {};

let gamesEnabled = true;
const antiSpamEnabled = {};

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
    const payload = ctx.startPayload;

    if (payload && payload.startsWith('wh_')) {
        const parts = payload.split('_');
        const targetId = parts[1];
        const targetName = decodeURIComponent(parts[2]);
        const chatId = parts[3];

        whisperSessions[ctx.from.id] = {
            targetId: targetId,
            targetName: targetName,
            chatId: chatId,
            senderName: ctx.from.first_name || 'صديق'
        };

        return ctx.reply(`✍️ أهلاً بك يا ${ctx.from.first_name}!\n\n• أرسل الآن نص الهمسة الموجهة إلى [ ${targetName} ] في رسالة هنا، وسيتم نشرها في الجروب سراً.`);
    }

    const userName = ctx.from.first_name || 'صديقي';
    ctx.reply(
        `اهلا بك يا قلبي 🫶 ــ ${userName}\n\n• انا بوت تورايف أشغل لك اللي تبي بالمكالمة`,
        Markup.inlineKeyboard([
            [Markup.button.url('➕ أضفني في مجموعتك', `https://t.me/${botUsername}?startgroup=true`)],
            [Markup.button.url('👤 المطورين', 'https://t.me/j4xa7')]
        ])
    );
});

// 🔒 أوامر قفل وفتح المخالفات (مستقلة بالبداية لتستجيب فوراً)
bot.hears(/^قفل المخالفات$/, (ctx) => {
    if (getUserRole(ctx) !== 'Dev🎖️') return ctx.reply('• هذا الأمر يخص المطورين فقط ↤ ｢ Dev🎖️ ｣');
    const chatId = ctx.chat.id;
    antiSpamEnabled[chatId] = true;
    return ctx.reply('🔒 تم قفل المخالفات وحماية الجروب بالكامل بنجاح.', { reply_to_message_id: ctx.message.message_id });
});

bot.hears(/^فتح المخالفات$/, (ctx) => {
    if (getUserRole(ctx) !== 'Dev🎖️') return ctx.reply('• هذا الأمر يخص المطورين فقط ↤ ｢ Dev🎖️ ｣');
    const chatId = ctx.chat.id;
    antiSpamEnabled[chatId] = false;
    return ctx.reply('🔓 تم فتح المخالفات بنجاح.', { reply_to_message_id: ctx.message.message_id });
});

// معالجة كافة الرسائل والتحكم الكامل
bot.on('message', async (ctx, next) => {
    try {
        if (!ctx.chat || ctx.chat.type === 'private') return next();
        if (!ctx.from || ctx.from.is_bot) return next();

        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        const name = ctx.from.first_name || 'مستخدم';
        const role = getUserRole(ctx);
        const now = Date.now();

        if (mutedUsers[chatId] && mutedUsers[chatId][userId]) {
            try { await ctx.deleteMessage(); } catch (e) {}
            return;
        }

        const text = ctx.message.text || ctx.message.caption || '';

        // 1. فحص المحتوى المحظور (إباحي، مخدرات) وحذفه تلقائياً
        const forbiddenWordsRegex = /إباحي|جنس|سكس|porn|sex|مخدرات|حشيش|هيروين|كوكايين|شبو|كبتاجون|حبوب|عقار مخدر/i;
        if (forbiddenWordsRegex.test(text) && role !== 'Dev🎖️') {
            try {
                await ctx.deleteMessage();
                await ctx.reply(`⚠️ تم حذف رسالة مخالفة (محتوى محظور) من العضو: ${name}`, { reply_to_message_id: ctx.message.message_id });
            } catch (e) {}
            return;
        }

        // 2. حماية الروابط إذا كانت المخالفات مقفلة
        if (antiSpamEnabled[chatId] && role !== 'Dev🎖️') {
            const hasLink = /https?:\/\/|t\.me\/|www\./i.test(text);
            if (hasLink) {
                try {
                    await ctx.deleteMessage();
                    return;
                } catch (e) {}
            }
        }

        // 3. قيد الفويس (أكثر من 10 بصمات بدقتين)
        if (ctx.message.voice && role !== 'Dev🎖️') {
            if (!userVoiceTimestamps[userId]) userVoiceTimestamps[userId] = [];
            userVoiceTimestamps[userId] = userVoiceTimestamps[userId].filter(time => now - time < 120000);
            userVoiceTimestamps[userId].push(now);

            if (userVoiceTimestamps[userId].length > 10) {
                try {
                    await ctx.deleteMessage();
                    await ctx.restrictChatMember(userId, { permissions: { can_send_messages: false } });
                    return ctx.reply(`⚠️ تم تقييد العضو [ ${name} ] تلقائياً لتجاوزه حد الرسائل الصوتية.`);
                } catch (e) {}
            }
        }

        // 4. قيد الصور والوسائط المتكررة
        if ((ctx.message.photo || ctx.message.document) && role !== 'Dev🎖️') {
            if (!userPhotoTimestamps[userId]) userPhotoTimestamps[userId] = [];
            userPhotoTimestamps[userId] = userPhotoTimestamps[userId].filter(time => now - time < 120000);
            userPhotoTimestamps[userId].push(now);

            if (userPhotoTimestamps[userId].length > 10) {
                try {
                    await ctx.deleteMessage();
                    await ctx.restrictChatMember(userId, { permissions: { can_send_messages: false } });
                    return ctx.reply(`⚠️ تم تقييد العضو [ ${name} ] تلقائياً بسبب إرسال صور بشكل مفرط.`);
                } catch (e) {}
            }
        }

        // الاستجابة الدقيقة للأسماء (توري، ايفي، تورايف)
        if (text) {
            if (/^توري$/i.test(text)) {
                return ctx.reply('• توري ⟵ @to6ri', { reply_to_message_id: ctx.message.message_id });
            }
            if (/^(ايفي|ايلاف)$/i.test(text)) {
                return ctx.reply('• المطور ⟵ @j4xa7', { reply_to_message_id: ctx.message.message_id });
            }
            if (/^تورايف$/i.test(text)) {
                const replies = ['عيوني 🤍', 'أمر؟ 👀', 'سم 🫶', 'وش بغيت؟ 🦦', 'عيون ايفي وتوري ✨', 'هلا 🤍'];
                const randomReply = replies[Math.floor(Math.random() * replies.length)];
                return ctx.reply(randomReply, { reply_to_message_id: ctx.message.message_id });
            }
        }

        if (!userStats[chatId]) userStats[chatId] = {};
        if (!userStats[chatId][userId]) {
            userStats[chatId][userId] = { name: name, count: 0 };
        }
        userStats[chatId][userId].count += 1;
        userStats[chatId][userId].name = name;

    } catch (e) {}
    return next();
});

bot.hears(/^(?:اهمس|همسه)$/i, (ctx) => {
    if (!ctx.message.reply_to_message) {
        return ctx.reply('⚠️ يرجى الرد على الشخص المراد أهماسه بكلمة (اهمس).', { reply_to_message_id: ctx.message.message_id });
    }

    const targetUser = ctx.message.reply_to_message.from.first_name || 'الشخص';
    const targetId = ctx.message.reply_to_message.from.id;
    const botUsername = ctx.botInfo.username;
    const chatId = ctx.chat.id;

    const whisperLink = `https://t.me/${botUsername}?start=wh_${targetId}_${encodeURIComponent(targetUser)}_${chatId}`;

    ctx.reply(
        `• تم تحديد الهمسه لـ ⟵ ${targetUser}\n• اضغط الزر أدناه لكتابة الهمسة في الخاص:`,
        {
            reply_to_message_id: ctx.message.message_id,
            ...Markup.inlineKeyboard([
                [Markup.button.url('اهمس هنا ↗', whisperLink)]
            ])
        }
    );
});

bot.action(/^read_wh_(.+)$/, (ctx) => {
    const viewId = ctx.match[1];
    const whisper = whisperStore[viewId];

    if (!whisper) {
        return ctx.answerCbQuery('⚠️ انتهت صلاحية الهمسة أو تم قراءتها.', { show_alert: true });
    }

    if (ctx.from.id.toString() !== whisper.targetId.toString()) {
        return ctx.answerCbQuery('❌ عذراً، هذه الهمسة ليست موجهة لك وحدك!', { show_alert: true });
    }

    return ctx.answerCbQuery(`محتوى الهمسة:\n\n${whisper.text}`, { show_alert: true });
});

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
    console.log('Toraif Bot is running successfully with everything combined!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
