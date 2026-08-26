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
const whisperStore = {}; 

let gamesEnabled = true;

const ranksHierarchy = ['عضو', 'مميز', 'مالك', 'مالك اساسي', 'ميث', 'اكسترا', 'Dev²🎖', 'Dev🎖️'];

function getRoleLevel(role) {
    return ranksHierarchy.indexOf(role) !== -1 ? ranksHierarchy.indexOf(role) : 0;
}

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

    // إذا دخل من رابط الهمسة في الخاص
    if (payload && payload.startsWith('wh_')) {
        const parts = payload.split('_');
        const targetId = parts[1];
        const targetName = decodeURIComponent(parts[2]);
        const chatId = parts[3];

        whisperStore[ctx.from.id] = {
            targetId: targetId,
            targetName: targetName,
            chatId: chatId,
            senderName: ctx.from.first_name || 'صديق'
        };

        return ctx.reply(`✍️ أهلاً بك يا ${ctx.from.first_name}!\n\n• أرسل الآن نص الهمسة الموجهة إلى [ ${targetName} ] في رسالة هنا، وسيتم نشرها في الجروب سراً.`);
    }

    const userName = ctx.from.first_name || 'صديقي';
    ctx.reply(
        `اهلا بك يا قلبي 🫶 ــ ${userName}\n\n• انا اشغل لك اللي تبي بالمكالمة`,
        Markup.inlineKeyboard([
            [Markup.button.url('➕ أضفني في مجموعتك', `https://t.me/${botUsername}?startgroup=true`)],
            [Markup.button.url('👤 المطور', 'https://t.me/j4xa7')]
        ])
    );
});

// استقبال رسائل الهمسة في الخاص وإرسالها للجروب
bot.on('message', async (ctx, next) => {
    try {
        // إذا كانت الرسالة في الخاصة وكان المستخدم يكتب همسة
        if (ctx.chat.type === 'private' && whisperStore[ctx.from.id] && ctx.message.text) {
            const data = whisperStore[ctx.from.id];
            const whisperText = ctx.message.text;
            delete whisperStore[ctx.from.id];

            const viewId = `vw_${Date.now()}_${Math.random()}`;
            whisperStore[viewId] = {
                text: whisperText,
                targetId: data.targetId,
                senderName: data.senderName
            };

            // إرسال رسالة الهمسة للجروب بشكل سري
            await bot.telegram.sendMessage(
                data.chatId,
                `• يا حلو ⟵ ${data.targetName}\n• وصلتك همسة سرية جديدة من ⟵ ${data.senderName}\n• انت وحدك تقدر تشوفها`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('رؤية الهمسة', `read_wh_${viewId}`)],
                    [Markup.button.url('رد على الهمسة ↗', `https://t.me/${ctx.botInfo.username}?start=wh_${ctx.from.id}_${encodeURIComponent(data.senderName)}_${data.chatId}`)]
                ])
            );

            return ctx.reply('✅ تم إرسال همستك بنجاح إلى الجروب بشكل سري!');
        }

        // احصائيات وكتم في الجروبات
        if (ctx.chat && ctx.chat.type !== 'private' && ctx.from && !ctx.from.is_bot) {
            const chatId = ctx.chat.id;
            const userId = ctx.from.id;
            const name = ctx.from.first_name || 'مستخدم';

            if (mutedUsers[chatId] && mutedUsers[chatId][userId]) {
                try { ctx.deleteMessage(); } catch (e) {}
                return;
            }

            if (!userStats[chatId]) userStats[chatId] = {};
            if (!userStats[chatId][userId]) {
                userStats[chatId][userId] = { name: name, count: 0 };
            }
            userStats[chatId][userId].count += 1;
            userStats[chatId][userId].name = name;
        }
    } catch (e) {}
    return next();
});

// --- نظام الهمسات (عند كتابة اهمس بالجروب) ---
bot.hears(/^(?:اهمس|همسه)$/, (ctx) => {
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

// قراءة الهمسة عبر النافذة المنبثقة (Alert)
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

// --- بقية الأوامر والألعاب ---
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
    console.log('Bot is running successfully with Private Whisper feature!');
});
