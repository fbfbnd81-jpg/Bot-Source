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

// 1. عند الضغط على الرابط ودخول الخاص، يطلب إرسال Start بالإنجليزية بدون كلام كثير
bot.start(async (ctx) => {
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

        // إرسال رسالة نظيفة يكتب فيها المستخدم start أو يبدأ بإرسال الهمسة
        const sentMsg = await ctx.reply(`Start writing your whisper for [ ${targetName} ]:`);
        whisperSessions[ctx.from.id].promptMsgId = sentMsg.message_id;
        return;
    }

    const userName = ctx.from.first_name || 'صديقي';
    ctx.reply(
        `اهلا بك يا قلبي 🫶 ــ ${userName}`,
        Markup.inlineKeyboard([
            [Markup.button.url('➕ أضفني في مجموعتك', `https://t.me/${botUsername}?startgroup=true`)],
            [Markup.button.url('👤 المطور', 'https://t.me/j4xa7')]
        ])
    );
});

// 2. استقبال رسالة الهمسة في الخاص، حذف رسالة الطلب، وإرسالها للقروب
bot.on('message', async (ctx, next) => {
    try {
        if (ctx.chat.type === 'private' && whisperSessions[ctx.from.id] && ctx.message.text) {
            const data = whisperSessions[ctx.from.id];
            const whisperText = ctx.message.text;
            
            // حذف رسالة البرومبت السابقة إذا وجدت لنظافة الشاشة
            if (data.promptMsgId) {
                try { await ctx.telegram.deleteMessage(ctx.chat.id, data.promptMsgId); } catch (e) {}
            }
            try { await ctx.deleteMessage(); } catch (e) {} // حذف رسالة الهمسة نفسها من الخاص للسرية

            delete whisperSessions[ctx.from.id];

            const viewId = `vw_${Date.now()}_${Math.random()}`;
            whisperStore[viewId] = {
                text: whisperText,
                targetId: data.targetId,
                senderName: data.senderName
            };

            // إرسال الهمسة للقروب بالشكل المطلوب
            await bot.telegram.sendMessage(
                data.chatId,
                `• يا حلو ⟵ ${data.targetName}\n• وصلتك همسة سرية جديدة من ⟵ ${data.senderName}\n• انت وحدك تقدر تشوفها`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('رؤية الهمسة', `read_wh_${viewId}`)],
                    [Markup.button.url('رد على الهمسة ↗', `https://t.me/${ctx.botInfo.username}?start=wh_${ctx.from.id}_${encodeURIComponent(data.senderName)}_${data.chatId}`)]
                ])
            );

            // الرد في الخاص باختصار
            return ctx.reply('✅ تم إرسال الهمسه');
        }

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

// 3. أمر اهمس في القروب
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
        `• تم تحديد الهمسه لـ ⟵ ${targetUser}`,
        {
            reply_to_message_id: ctx.message.message_id,
            ...Markup.inlineKeyboard([
                [Markup.button.url('اهمس هنا ↗', whisperLink)]
            ])
        }
    );
});

// 4. رؤية الهمسة عبر النافذة المنبثقة
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
        `🎵 جارٍ تشغيل الأغنية: [ ${songName} ]`,
        Markup.inlineKeyboard([
            [Markup.button.url(`▶️ استماع`, `https://t.me/${botUsername}`)]
        ])
    );
});

bot.launch().then(() => {
    console.log('Bot is running successfully!');
});
