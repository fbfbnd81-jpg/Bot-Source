const { Telegraf, Markup } = require('telegraf');
const http = require('http');

// سيرفر وهمي بسيط عشان ريلواي يخليه شغال دايماً وما يصير أحمر
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running successfully!');
}).listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

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
    const userName = ctx.from.first_name || 'صديقي';
    ctx.reply(
        `اهلا بك يا قلبي 🫶 ــ ${userName}\n\n• انا اشغل لك اللي تبي بالمكالمة`,
        Markup.inlineKeyboard([
            [Markup.button.url('➕ أضفني في مجموعتك', `https://t.me/${botUsername}?startgroup=true`)],
            [Markup.button.url('👤 المطور', 'https://t.me/j4xa7')]
        ])
    );
});

// احصائيات التفاعل وحماية المكتومين
bot.on('message', (ctx, next) => {
    try {
        if (ctx.chat && ctx.from && !ctx.from.is_bot) {
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

// --- نظام الأغاني (يوت) ---
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

// --- نظام الهمسات النظيف والآمن ---
bot.hears(/^اهمس$/, (ctx) => {
    if (!ctx.message.reply_to_message) {
        return ctx.reply('⚠️ يرجى الرد على الشخص المراد أهماسه بكلمة (اهمس).', { reply_to_message_id: ctx.message.message_id });
    }

    const targetUser = ctx.message.reply_to_message.from.first_name || 'الشخص';
    const targetId = ctx.message.reply_to_message.from.id;
    const senderId = ctx.from.id;
    const senderName = ctx.from.first_name || 'صديق';

    whisperStore[senderId] = {
        targetId,
        targetUser,
        senderName,
        step: 'waiting_for_text'
    };

    ctx.reply(
        `• تم تحديد الهمسه لـ ⟵ ${targetUser}\n• اضغط الزر أدناه لكتابة الهمسة سرّاً:`,
        {
            reply_to_message_id: ctx.message.message_id,
            ...Markup.inlineKeyboard([
                [Markup.button.callback('اهمس هنا ↗', `open_input_${senderId}`)]
            ])
        }
    );
});

bot.action(/^open_input_(\d+)$/, (ctx) => {
    const ownerId = parseInt(ctx.match[1]);
    if (ctx.from.id !== ownerId) {
        return ctx.answerCbQuery('❌ عذراً، هذه الهمسة ليست لك!', { show_alert: true });
    }
    ctx.answerCbQuery();
    ctx.reply(`✍️ أهلاً بك، أرسل الآن نص الهمسة في رسالة هنا وسيتم إرسالها سراً للشخص المستهدف.`);
});

// --- معالجة النصوص العامة والهمسات ---
bot.on('text', (ctx, next) => {
    try {
        const userId = ctx.from.id;
        const text = ctx.message.text ? ctx.message.text.trim() : '';

        if (whisperStore[userId] && whisperStore[userId].step === 'waiting_for_text') {
            const whisperData = whisperStore[userId];
            delete whisperStore[userId];

            const viewId = `vw_${Date.now()}_${Math.random()}`;
            whisperStore[viewId] = {
                text: text,
                targetId: whisperData.targetId,
                senderName: whisperData.senderName
            };

            try { ctx.deleteMessage(); } catch (e) {}

            return ctx.reply(
                `• يا حلو ⟵ ${whisperData.targetUser}\n• وصلتك همسة سرية جديدة 🔐\n• انت وحدك تقدر تشوفها`,
                {
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('رؤية الهمسة', `read_wh_${viewId}`)],
                        [Markup.button.callback('رد على الهمسة ↗', `reply_wh_${userId}`)]
                    ])
                }
            );
        }

        if (text.includes('تورايف') || text.toLowerCase().includes('toraif')) {
            const replies = ['هلا', 'عيوني', 'سم', 'امر', 'وش بغيت'];
            const randomReply = replies[Math.floor(Math.random() * replies.length)];
            return ctx.reply(randomReply, { reply_to_message_id: ctx.message.message_id });
        }
    } catch (e) {}
    return next();
});

bot.action(/^read_wh_(.+)$/, (ctx) => {
    const viewId = ctx.match[1];
    const whisper = whisperStore[viewId];

    if (!whisper) {
        return ctx.answerCbQuery('⚠️ انتهت صلاحية الهمسة أو تم قراءتها.', { show_alert: true });
    }

    if (ctx.from.id !== whisper.targetId) {
        return ctx.answerCbQuery('❌ عذراً، هذه الهمسة ليست موجهة لك وحدك!', { show_alert: true });
    }

    return ctx.answerCbQuery(`محتوى الهمسة:\n\n${whisper.text}`, { show_alert: true });
});

bot.action(/^reply_wh_(\d+)$/, (ctx) => {
    ctx.answerCbQuery('💬 قم بالرد على رسالة الهمسة مباشرة.');
});

// --- نظام الألعاب والفعاليات ---
bot.hears(/^تعطيل الالعاب$/, (ctx) => {
    const senderRole = getUserRole(ctx);
    if (senderRole !== 'Dev🎖️') {
        return ctx.reply('• هذا الامر يخص ↤ ｢ Dev🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
    }
    gamesEnabled = false;
    ctx.reply('🔒 تم تعطيل الألعاب والفعاليات بنجاح.', { reply_to_message_id: ctx.message.message_id });
});

bot.hears(/^تفعيل الالعاب$/, (ctx) => {
    const senderRole = getUserRole(ctx);
    if (senderRole !== 'Dev🎖️') {
        return ctx.reply('• هذا الامر يخص ↤ ｢ Dev🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
    }
    gamesEnabled = true;
    ctx.reply('🔓 تم تفعيل الألعاب والفعاليات بنجاح.', { reply_to_message_id: ctx.message.message_id });
});

bot.hears(/^(?:\/)?الالعاب$/, (ctx) => {
    if (!gamesEnabled) {
        return ctx.reply('⚠️ عذراً، الألعاب معطلة حالياً من قبل المطور.', { reply_to_message_id: ctx.message.message_id });
    }
    const menu = `•  قائمة العاب البوت \n` +
                 `━━━━━━━━━━\n` +
                 `• ترتيب\n• سمايلات\n• اسئله\n• احكام\n• فنانين\n• حيوانات\n• زوم\n• المختلف\n• اكمل\n• العكس\n• حزوره\n• كرسي\n• حظي\n• عربي\n• اسالني\n• الروليت\n• رياضيات\n• انجليزي\n• اعلام\n• جمل\n• عواصم\n• حزر\n• صور\n• عقاب\n• دين\n• تفكيك\n• حجره\n• نمله\n• معاني\n• بات\n• خمن\n• كلمات\n• الحظ\n• ناقص\n• مصطلح\n• اختبار\n• مفرد\n• حروف\n` +
                 `━━━━━━━━━━`;
    ctx.reply(menu, { reply_to_message_id: ctx.message.message_id });
});

const gameCommands = [
    'ترتيب', 'سمايلات', 'اسئله', 'احكام', 'فنانين', 'حيوانات', 'زوم', 'المختلف', 
    'اكمل', 'العكس', 'حزوره', 'كرسي', 'حظي', 'عربي', 'اسالني', 'الروليت', 
    'رياضيات', 'انجليزي', 'اعلام', 'جمل', 'عواصم', 'حزر', 'صور', 'عقاب', 
    'دين', 'تفكيك', 'حجره', 'نمله', 'معاني', 'بات', 'خمن', 'كلمات', 'الحظ', 
    'ناقص', 'مصطلح', 'اختبار', 'مفرد', 'حروف'
];

bot.hears(new RegExp(`^(?:\\/)?(${gameCommands.join('|')})$`), (ctx) => {
    if (!gamesEnabled) {
        return ctx.reply('⚠️ الألعاب معطلة حالياً.', { reply_to_message_id: ctx.message.message_id });
    }
    const gameName = ctx.match[1];
    const responses = [
        `🎮 لعبة [ ${gameName} ] بدأت! أسرع واحد يجاوب:\n• رتبة المشاركين جاهزة، اطلقوا الإبداع!`,
        `🎯 حماس! فتحنا لعبة [ ${gameName} ]\n• نبي نشوف تفاعلكم يا ابطال.`,
        `✨ لعبة [ ${gameName} ] اشتغلت، شارك معنا الآن!`
    ];
    const randomRes = responses[Math.floor(Math.random() * responses.length)];
    ctx.reply(randomRes, { reply_to_message_id: ctx.message.message_id });
});

// الأوامر والرتب
bot.hears(/^(?:\/)?رتبتي$/, (ctx) => {
    const role = getUserRole(ctx);
    const userId = ctx.from.id;
    ctx.reply(`• رتبتك هي ↤ ｢ ${role} ｣\n• آي دي حساَبك ↤ ${userId}`, { reply_to_message_id: ctx.message.message_id });
});

bot.hears(/^(?:\/)?تفاعل$/, (ctx) => {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    const role = getUserRole(ctx);
    
    if (!userStats[chatId] || !userStats[chatId][userId]) {
        return ctx.reply(`• رتبتك هي ↤ ｢ ${role} ｣\n• رسائلك بالتفاعل ↤ 1\n• ترتيبك بالمتفاعلين ↤ 1`, { reply_to_message_id: ctx.message.message_id });
    }

    const sortedUsers = Object.entries(userStats[chatId]).sort((a, b) => b[1].count - a[1].count);
    const userRankIndex = sortedUsers.findIndex(item => item[0] == userId);
    const userMessageCount = userStats[chatId][userId].count;
    const rankNumber = userRankIndex !== -1 ? userRankIndex + 1 : 1;

    ctx.reply(
        `• رتبتك هي ↤ ｢ ${role} ｣\n• رسائلك بالتفاعل ↤ ${userMessageCount}\n• ترتيبك بالمتفاعلين ↤ ${rankNumber}\n-`,
        { reply_to_message_id: ctx.message.message_id }
    );
});

bot.hears(/^رفع (مميز|مالك|مالك اساسي|ميث|اكسترا|ديف2|ديف تو|ديف|مطور اساسي)$/, async (ctx) => {
    const chatId = ctx.chat.id;
    const senderRole = getUserRole(ctx);
    const senderLevel = getRoleLevel(senderRole);
    let inputRank = ctx.match[1];
    
    let targetRank = inputRank;
    if (inputRank === 'ديف' || inputRank === 'ديف2' || inputRank === 'ديف تو') {
        targetRank = 'Dev²🎖';
    }
    if (inputRank === 'مطور اساسي') {
        targetRank = 'Dev🎖️';
    }

    if (senderLevel < getRoleLevel('مالك اساسي') && senderRole !== 'Dev🎖️' && senderRole !== 'Dev²🎖') {
        return ctx.reply('• هذا الامر يخص ↤ ｢ مالك اساسي ｣', { reply_to_message_id: ctx.message.message_id });
    }

    if (!ctx.message.reply_to_message) {
        return ctx.reply('⚠️ يرجى الرد على رسالة العضو المراد رفع رتبته.', { reply_to_message_id: ctx.message.message_id });
    }

    const targetUser = ctx.message.reply_to_message.from.first_name || 'عضو';
    const targetId = ctx.message.reply_to_message.from.id;

    if (!userRoles[chatId]) userRoles[chatId] = {};
    userRoles[chatId][targetId] = targetRank;
    
    ctx.reply(
        `• المستخدم ذا ↤︎ ｢ ${targetUser} ｣\n• تم رفعه [ ${targetRank} ]`,
        { reply_to_message_id: ctx.message.message_id }
    );
});

bot.hears(/^(?:\/)?كتم$/, async (ctx) => {
    const chatId = ctx.chat.id;
    const senderRole = getUserRole(ctx);
    if (getRoleLevel(senderRole) < getRoleLevel('ميث')) {
        return ctx.reply('• هذا الامر يخص ↤ ｢ ميث ｣', { reply_to_message_id: ctx.message.message_id });
    }

    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ الرد على العضو مطلوب.', { reply_to_message_id: ctx.message.message_id });
    
    const targetUser = ctx.message.reply_to_message.from.first_name || 'عضو';
    const targetId = ctx.message.reply_to_message.from.id;
    
    if (!mutedUsers[chatId]) mutedUsers[chatId] = {};
    mutedUsers[chatId][targetId] = targetUser;

    try {
        await ctx.telegram.restrictChatMember(chatId, targetId, { permissions: { can_send_messages: false } });
    } catch (e) {}

    ctx.reply(`• المستخدم ذا ↤︎ ｢ ${targetUser} ｣\n• كتمته`, { reply_to_message_id: ctx.message.message_id });
});

bot.hears('مم', (ctx) => {
    const chatId = ctx.chat.id;
    if (!mutedUsers[chatId] || Object.keys(mutedUsers[chatId]).length === 0) {
        return ctx.reply('• لا يوجد مكتومين', { reply_to_message_id: ctx.message.message_id });
    }

    let list = '• قائمة المكتومين:\n';
    for (const [id, name] of Object.entries(mutedUsers[chatId])) {
        list += `- ｢ ${name} ｣\n`;
    }
    ctx.reply(list, { reply_to_message_id: ctx.message.message_id });
});

bot.hears(/^(?:\/)?فك الكتم$/, async (ctx) => {
    const chatId = ctx.chat.id;
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ الرد على العضو مطلوب لفك كتمه.', { reply_to_message_id: ctx.message.message_id });
    
    const targetId = ctx.message.reply_to_message.from.id;
    const targetUser = ctx.message.reply_to_message.from.first_name || 'عضو';

    if (mutedUsers[chatId] && mutedUsers[chatId][targetId]) {
        delete mutedUsers[chatId][targetId];
        try {
            await ctx.telegram.restrictChatMember(chatId, targetId, { permissions: { can_send_messages: true, can_send_media_messages: true, can_send_other_messages: true, can_add_web_page_previews: true } });
        } catch (e) {}
        return ctx.reply(`• تم فك الكتم عن ↤︎ ｢ ${targetUser} ｣`, { reply_to_message_id: ctx.message.message_id });
    }
    ctx.reply('• هذا العضو ليس مكتوماً', { reply_to_message_id: ctx.message.message_id });
});

bot.hears(/^(?:\/)?المالك$/, (ctx) => {
    ctx.reply(
        `Owner Group ↦ NORTH\n\nUSE ↦ 8ny\n\nحكُّمُ سُيوفَكَ في رِقابِ العُدُّلِ وَإِذا إبتُليتَ بِظالِمٍ كُن ظالِما`,
        { reply_to_message_id: ctx.message.message_id }
    );
});

bot.launch().then(() => {
    console.log('Bot is running successfully with HTTP server!');
}).catch(err => {
    console.error('Failed to launch bot:', err);
});
