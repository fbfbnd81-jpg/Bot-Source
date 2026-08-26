const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

const userRoles = {};
const userStats = {};

// الترتيب الهرمي للرتب من الأقل للأعلى
const ranksHierarchy = ['عضو', 'مميز', 'مالك', 'مالك اساسي', 'ميث', 'اكسترا', 'Dev²🎖', 'Dev🎖️'];

function getRoleLevel(role) {
    return ranksHierarchy.indexOf(role) !== -1 ? ranksHierarchy.indexOf(role) : 0;
}

function getUserRole(chatId, userId) {
    if (!userRoles[chatId]) userRoles[chatId] = {};
    return userRoles[chatId][userId] || 'عضو';
}

bot.start((ctx) => {
    const botUsername = ctx.botInfo.username;
    const userName = ctx.from.first_name;
    ctx.reply(
        `اهلا بك يا قلبي 🫶 ــ ${userName}\n\n• انا اشغل لك اللي تبي بالمكالمة`,
        Markup.inlineKeyboard([
            [Markup.button.url('➕ أضفني في مجموعتك', `https://t.me/${botUsername}?startgroup=true`)],
            [Markup.button.url('👤 المطور', 'https://t.me/j4xa7')]
        ])
    );
});

// تتبع التفاعل ورسائل الأعضاء
bot.on('message', (ctx, next) => {
    if (ctx.chat && ctx.from && !ctx.from.is_bot) {
        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        const name = ctx.from.first_name;

        if (!userStats[chatId]) userStats[chatId] = {};
        if (!userStats[chatId][userId]) {
            userStats[chatId][userId] = { name: name, count: 0 };
        }
        userStats[chatId][userId].count += 1;
        userStats[chatId][userId].name = name;
    }
    return next();
});

// 1. معرفة الرتبة (رتبتي)
bot.hears(/^(?:\/)?رتبتي$/, (ctx) => {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    const role = getUserRole(chatId, userId);
    ctx.reply(`• رتبتك هي ↤ ｢ ${role} ｣`, { reply_to_message_id: ctx.message.message_id });
});

// 2. أمر التفاعل
bot.hears(/^(?:\/)?تفاعل$/, (ctx) => {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    const role = getUserRole(chatId, userId);
    
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

// 3. رفع الرتب (مع التنسيق الجديد للمستخدم والرسالة)
bot.hears(/^رفع (مميز|مالك|مالك اساسي|ميث|اكسترا|Dev²🎖|Dev🎖️)$/, async (ctx) => {
    const chatId = ctx.chat.id;
    const senderId = ctx.from.id;
    const targetRank = ctx.match[1];
    const senderRole = getUserRole(chatId, senderId);
    const senderLevel = getRoleLevel(senderRole);

    if (senderLevel < getRoleLevel('مالك اساسي') && senderRole !== 'Dev🎖️' && senderRole !== 'Dev²🎖') {
        return ctx.reply('• هذا الامر يخص ↤ ｢ مالك اساسي ｣', { reply_to_message_id: ctx.message.message_id });
    }

    if (!ctx.message.reply_to_message) {
        return ctx.reply('⚠️ يرجى الرد على رسالة العضو المراد رفع رتبته.', { reply_to_message_id: ctx.message.message_id });
    }

    const targetUser = ctx.message.reply_to_message.from.first_name;
    const targetId = ctx.message.reply_to_message.from.id;

    userRoles[chatId][targetId] = targetRank;
    
    ctx.reply(
        `• المستخدم ذا ↤ ｢ ${targetUser} ｣\n• تم رفعه رتبة [ ${targetRank} ]`,
        { reply_to_message_id: ctx.message.message_id }
    );
});

// 4. الكتم (ميث فما فوق)
bot.hears(/^(?:\/)?كتم$/, async (ctx) => {
    const chatId = ctx.chat.id;
    const senderRole = getUserRole(chatId, ctx.from.id);
    if (getRoleLevel(senderRole) < getRoleLevel('ميث')) {
        return ctx.reply('• هذا الامر يخص ↤ ｢ ميث ｣', { reply_to_message_id: ctx.message.message_id });
    }

    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ الرد على العضو مطلوب.', { reply_to_message_id: ctx.message.message_id });
    const targetUser = ctx.message.reply_to_message.from.first_name;
    const targetId = ctx.message.reply_to_message.from.id;
    
    try {
        await ctx.telegram.restrictChatMember(chatId, targetId, { permissions: { can_send_messages: false } });
    } catch (e) {}
    ctx.reply(`• المستخدم ذا ↤ ｢ ${targetUser} ｣\n• كتمته`, { reply_to_message_id: ctx.message.message_id });
});

// 5. الكتم العام / خخ (اكسترا فما فوق)
bot.hears(/^(?:\/)?خخ$/, (ctx) => {
    const chatId = ctx.chat.id;
    const senderRole = getUserRole(chatId, ctx.from.id);
    if (getRoleLevel(senderRole) < getRoleLevel('اكسترا')) {
        return ctx.reply('• هذا الامر يخص ↤ ｢ اكسترا🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
    }
    ctx.reply('• لا يوجد مكتومين عام ,', { reply_to_message_id: ctx.message.message_id });
});

// 6. فك الكتم (مم)
bot.hears('مم', (ctx) => {
    ctx.reply('• لا يوجد مكتومين', { reply_to_message_id: ctx.message.message_id });
});

// 7. إلغاء التقييد (مالك أساسي فما فوق)
bot.hears(/^الغاء التقييد$/, (ctx) => {
    const chatId = ctx.chat.id;
    const senderRole = getUserRole(chatId, ctx.from.id);
    if (getRoleLevel(senderRole) < getRoleLevel('مالك اساسي')) {
        return ctx.reply('• هذا الامر يخص ↤ ｢ مالك اساسي ｣', { reply_to_message_id: ctx.message.message_id });
    }
    ctx.reply('👑 تم تنفيذ "الغاء التقييد" بنجاح.', { reply_to_message_id: ctx.message.message_id });
});

// 8. رفع القيود (Dev²🎖 فما فوق)
bot.hears(/^رفع القيود$/, (ctx) => {
    const chatId = ctx.chat.id;
    const senderRole = getUserRole(chatId, ctx.from.id);
    if (getRoleLevel(senderRole) < getRoleLevel('Dev²🎖')) {
        return ctx.reply('• هذا الامر يخص ↤ ｢ Dev²🎖 ｣', { reply_to_message_id: ctx.message.message_id });
    }
    ctx.reply('🔓 تم تنفيذ "رفع القيود" بنجاح.', { reply_to_message_id: ctx.message.message_id });
});

// 9. تنزيل الكل (اكسترا فما فوق)
bot.hears(/^تنزيل الكل$/, (ctx) => {
    const chatId = ctx.chat.id;
    const senderRole = getUserRole(chatId, ctx.from.id);
    if (getRoleLevel(senderRole) < getRoleLevel('اكسترا')) {
        return ctx.reply('• هذا الامر يخص ↤ ｢ اكسترا🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
    }
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ يرجى الرد على الشخص.', { reply_to_message_id: ctx.message.message_id });
    
    const targetId = ctx.message.reply_to_message.from.id;
    userRoles[chatId][targetId] = 'عضو';
    ctx.reply('🔻 تمت إزالة رتبته وإرجاعه كـ [ عضو ] بنجاح.', { reply_to_message_id: ctx.message.message_id });
});

// 10. أمر المالك
bot.hears(/^(?:\/)?المالك$/, (ctx) => {
    ctx.reply(
        `Owner Group ↦ NORTH\n\nUSE ↦ 8ny\n\nحكُّمُ سُيوفَكَ في رِقابِ العُدُّلِ وَإِذا إبتُليتَ بِظالِمٍ كُن ظالِما`,
        { reply_to_message_id: ctx.message.message_id }
    );
});

// 11. الرد عند مناداة اسم البوت (تورايف)
bot.on('text', (ctx, next) => {
    const text = ctx.message.text ? ctx.message.text.trim() : '';
    if (text.includes('تورايف') || text.toLowerCase().includes('toraif')) {
        const replies = ['هلا', 'عيوني', 'سم', 'امر', 'وش بغيت'];
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        return ctx.reply(randomReply, { reply_to_message_id: ctx.message.message_id });
    }
    return next();
});

bot.launch();
console.log('Bot with updated Ranks & Styles is running...');
