const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

const developers = ['j4xa7', 'to6ri', 'Evy', 'evelaf']; // حط يوزرك هنا لو تغير
const userRoles = {};
const userStats = {};
const mutedUsers = {}; // تخزين المكتومين بكل قروب: { chatId: { userId: 'اسم العضو' } }
const globalMutedUsers = {}; // للمكتومين عام (خخ)

const ranksHierarchy = ['عضو', 'مميز', 'مالك', 'مالك اساسي', 'ميث', 'اكسترا', 'Dev²🎖', 'Dev🎖️'];

function getRoleLevel(role) {
    return ranksHierarchy.indexOf(role) !== -1 ? ranksHierarchy.indexOf(role) : 0;
}

function getUserRole(chatId, userId, username) {
    if (username && developers.includes(username.toLowerCase())) {
        return 'Dev🎖️';
    }
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

bot.on('message', (ctx, next) => {
    if (ctx.chat && ctx.from && !ctx.from.is_bot) {
        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        const username = ctx.from.username;
        const name = ctx.from.first_name;

        // منع المكتومين من الكلام
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
    return next();
});

// معرفة الرتبة
bot.hears(/^(?:\/)?رتبتي$/, (ctx) => {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    const username = ctx.from.username;
    const role = getUserRole(chatId, userId, username);
    ctx.reply(`• رتبتك هي ↤ ｢ ${role} ｣`, { reply_to_message_id: ctx.message.message_id });
});

// التفاعل
bot.hears(/^(?:\/)?تفاعل$/, (ctx) => {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    const username = ctx.from.username;
    const role = getUserRole(chatId, userId, username);
    
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

// رفع الرتب
bot.hears(/^رفع (مميز|مالك|مالك اساسي|ميث|اكسترا|ديف2|ديف تو|Dev²🎖|ديف ون|ديف 1|Dev🎖️)$/, async (ctx) => {
    const chatId = ctx.chat.id;
    const senderId = ctx.from.id;
    const senderUsername = ctx.from.username;
    let targetRankInput = ctx.match[1];
    
    let targetRank = targetRankInput;
    if (targetRankInput === 'ديف2' || targetRankInput === 'ديف تو') targetRank = 'Dev²🎖';
    if (targetRankInput === 'ديف ون' || targetRankInput === 'ديف 1') targetRank = 'Dev🎖️';

    const senderRole = getUserRole(chatId, senderId, senderUsername);
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

// الكتم (ميث فما فوق)
bot.hears(/^(?:\/)?كتم$/, async (ctx) => {
    const chatId = ctx.chat.id;
    const senderRole = getUserRole(chatId, ctx.from.id, ctx.from.username);
    if (getRoleLevel(senderRole) < getRoleLevel('ميث')) {
        return ctx.reply('• هذا الامر يخص ↤ ｢ ميث ｣', { reply_to_message_id: ctx.message.message_id });
    }

    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ الرد على العضو مطلوب.', { reply_to_message_id: ctx.message.message_id });
    
    const targetUser = ctx.message.reply_to_message.from.first_name;
    const targetId = ctx.message.reply_to_message.from.id;
    
    if (!mutedUsers[chatId]) mutedUsers[chatId] = {};
    mutedUsers[chatId][targetId] = targetUser;

    try {
        await ctx.telegram.restrictChatMember(chatId, targetId, { permissions: { can_send_messages: false } });
    } catch (e) {}

    ctx.reply(`• المستخدم ذا ↤ ｢ ${targetUser} ｣\n• كتمته`, { reply_to_message_id: ctx.message.message_id });
});

// قائمة المكتومين وفك الكتم (مم)
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

// فك الكتم بالرد
bot.hears(/^(?:\/)?فك الكتم$/, async (ctx) => {
    const chatId = ctx.chat.id;
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ الرد على العضو مطلوب لفك كتمه.', { reply_to_message_id: ctx.message.message_id });
    
    const targetId = ctx.message.reply_to_message.from.id;
    const targetUser = ctx.message.reply_to_message.from.first_name;

    if (mutedUsers[chatId] && mutedUsers[chatId][targetId]) {
        delete mutedUsers[chatId][targetId];
        try {
            await ctx.telegram.restrictChatMember(chatId, targetId, { permissions: { can_send_messages: true, can_send_media_messages: true, can_send_other_messages: true, can_add_web_page_previews: true } });
        } catch (e) {}
        return ctx.reply(`• تم فك الكتم عن ↤ ｢ ${targetUser} ｣`, { reply_to_message_id: ctx.message.message_id });
    }
    ctx.reply('• هذا العضو ليس مكتوماً', { reply_to_message_id: ctx.message.message_id });
});

// الكتم العام (خخ)
bot.hears(/^(?:\/)?خخ$/, (ctx) => {
    const chatId = ctx.chat.id;
    const senderRole = getUserRole(chatId, ctx.from.id, ctx.from.username);
    if (getRoleLevel(senderRole) < getRoleLevel('اكسترا')) {
        return ctx.reply('• هذا الامر يخص ↤ ｢ اكسترا🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
    }
    
    if (!globalMutedUsers[chatId] || Object.keys(globalMutedUsers[chatId]).length === 0) {
        return ctx.reply('• لا يوجد مكتومين عام ,', { reply_to_message_id: ctx.message.message_id });
    }

    let list = '• قائمة المكتومين عام:\n';
    for (const [id, name] of Object.entries(globalMutedUsers[chatId])) {
        list += `- ｢ ${name} ｣\n`;
    }
    ctx.reply(list, { reply_to_message_id: ctx.message.message_id });
});

bot.hears(/^الغاء التقييد$/, (ctx) => {
    const chatId = ctx.chat.id;
    const senderRole = getUserRole(chatId, ctx.from.id, ctx.from.username);
    if (getRoleLevel(senderRole) < getRoleLevel('مالك اساسي')) {
        return ctx.reply('• هذا الامر يخص ↤ ｢ مالك اساسي ｣', { reply_to_message_id: ctx.message.message_id });
    }
    ctx.reply('👑 تم تنفيذ "الغاء التقييد" بنجاح.', { reply_to_message_id: ctx.message.message_id });
});

bot.hears(/^رفع القيود$/, (ctx) => {
    const chatId = ctx.chat.id;
    const senderRole = getUserRole(chatId, ctx.from.id, ctx.from.username);
    if (getRoleLevel(senderRole) < getRoleLevel('Dev²🎖')) {
        return ctx.reply('• هذا الامر يخص ↤ ｢ Dev²🎖 ｣', { reply_to_message_id: ctx.message.message_id });
    }
    ctx.reply('🔓 تم تنفيذ "رفع القيود" بنجاح.', { reply_to_message_id: ctx.message.message_id });
});

bot.hears(/^تنزيل الكل$/, (ctx) => {
    const chatId = ctx.chat.id;
    const senderRole = getUserRole(chatId, ctx.from.id, ctx.from.username);
    if (getRoleLevel(senderRole) < getRoleLevel('اكسترا')) {
        return ctx.reply('• هذا الامر يخص ↤ ｢ اكسترا🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
    }
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ يرجى الرد على الشخص.', { reply_to_message_id: ctx.message.message_id });
    
    const targetId = ctx.message.reply_to_message.from.id;
    userRoles[chatId][targetId] = 'عضو';
    ctx.reply('🔻 تمت إزالة رتبته وإرجاعه كـ [ عضو ] بنجاح.', { reply_to_message_id: ctx.message.message_id });
});

bot.hears(/^(?:\/)?المالك$/, (ctx) => {
    ctx.reply(
        `Owner Group ↦ NORTH\n\nUSE ↦ 8ny\n\nحكُّمُ سُيوفَكَ في رِقابِ العُدُّلِ وَإِذا إبتُليتَ بِظالِمٍ كُن ظالِما`,
        { reply_to_message_id: ctx.message.message_id }
    );
});

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
console.log('Bot with Mute system is running...');
