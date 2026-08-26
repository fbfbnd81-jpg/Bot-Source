const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

const adminIds = []; 
const userRoles = {};
const userStats = {};
const mutedUsers = {}; 
const globalMutedUsers = {}; 

// حالة الألعاب (مفتوحة افتراضياً)
let gamesEnabled = true;

const ranksHierarchy = ['عضو', 'مميز', 'مالك', 'مالك اساسي', 'ميث', 'اكسترا', 'Dev²🎖', 'Dev🎖️'];

function getRoleLevel(role) {
    return ranksHierarchy.indexOf(role) !== -1 ? ranksHierarchy.indexOf(role) : 0;
}

function getUserRole(ctx) {
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
        const name = ctx.from.first_name;

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

// أوامر تعطيل وتفعيل الألعاب (خاصة بالديف فقط)
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

// قائمة ألعاب البوت
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

// تفاعل ألعاب الفعاليات (جمل، حروف، وغيرها من القائمة)
const gameCommands = [
    'ترتيب', 'سمايلات', 'اسئله', 'احكام', 'فنانين', 'حيوانات', 'زوم', 'المختلف', 
    'اكمل', 'العكس', 'حزوره', 'كرسي', 'حظي', 'عربي', 'اسالني', 'الروليت', 
    'رياضيات', 'انجليزي', 'اعلام', 'جمل', 'عواصم', 'حزر', 'صور', 'عقاب', 
    'دين', 'تفكيك', 'حجره', 'نمله', 'معاني', 'بات', 'خمن', 'كلمات', 'الحظ', 
    'ناقص', 'مصطلح', 'اختبار', 'مفرد', 'حروف'
];

bot.hears(new RegExp(`^(?:\\/)?(${gameCommands.join('|R')})$`), (ctx) => {
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

// معرفة الرتبة
bot.hears(/^(?:\/)?رتبتي$/, (ctx) => {
    const role = getUserRole(ctx);
    const userId = ctx.from.id;
    ctx.reply(`• رتبتك هي ↤ ｢ ${role} ｣\n• آي دي حساَبك ↤ ${userId}`, { reply_to_message_id: ctx.message.message_id });
});

// التفاعل
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

// رفع الرتب بالرد
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

    const targetUser = ctx.message.reply_to_message.from.first_name;
    const targetId = ctx.message.reply_to_message.from.id;

    if (!userRoles[chatId]) userRoles[chatId] = {};
    userRoles[chatId][targetId] = targetRank;
    
    ctx.reply(
        `• المستخدم ذا ↤︎ ｢ ${targetUser} ｣\n• تم رفعه [ ${targetRank} ]`,
        { reply_to_message_id: ctx.message.message_id }
    );
});

// الكتم
bot.hears(/^(?:\/)?كتم$/, async (ctx) => {
    const chatId = ctx.chat.id;
    const senderRole = getUserRole(ctx);
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
    const targetUser = ctx.message.reply_to_message.from.first_name;

    if (mutedUsers[chatId] && mutedUsers[chatId][targetId]) {
        delete mutedUsers[chatId][targetId];
        try {
            await ctx.telegram.restrictChatMember(chatId, targetId, { permissions: { can_send_messages: true, can_send_media_messages: true, can_send_other_messages: true, can_add_web_page_previews: true } });
        } catch (e) {}
        return ctx.reply(`• تم فك الكتم عن ↤︎ ｢ ${targetUser} ｣`, { reply_to_message_id: ctx.message.message_id });
    }
    ctx.reply('• هذا العضو ليس مكتوماً', { reply_to_message_id: ctx.message.message_id });
});

bot.hears(/^(?:\/)?خخ$/, (ctx) => {
    const chatId = ctx.chat.id;
    const senderRole = getUserRole(ctx);
    if (getRoleLevel(senderRole) < getRoleLevel('اكسترا')) {
        return ctx.reply('• هذا الامر يخص ↤ ｢ اكسترا🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
    }
    ctx.reply('• لا يوجد مكتومين عام ,', { reply_to_message_id: ctx.message.message_id });
});

bot.hears(/^الغاء التقييد$/, (ctx) => {
    const chatId = ctx.chat.id;
    const senderRole = getUserRole(ctx);
    if (getRoleLevel(senderRole) < getRoleLevel('مالك اساسي')) {
        return ctx.reply('• هذا الامر يخص ↤ ｢ مالك اساسي ｣', { reply_to_message_id: ctx.message.message_id });
    }
    ctx.reply('👑 تم تنفيذ "الغاء التقييد" بنجاح.', { reply_to_message_id: ctx.message.message_id });
});

bot.hears(/^رفع القيود$/, (ctx) => {
    const chatId = ctx.chat.id;
    const senderRole = getUserRole(ctx);
    if (getRoleLevel(senderRole) < getRoleLevel('Dev²🎖')) {
        return ctx.reply('• هذا الامر يخص ↤ ｢ Dev²🎖 ｣', { reply_to_message_id: ctx.message.message_id });
    }
    ctx.reply('🔓 تم تنفيذ "رفع القيود" بنجاح.', { reply_to_message_id: ctx.message.message_id });
});

// تنزيل الكل
bot.hears(/^تنزيل الكل$/, (ctx) => {
    const chatId = ctx.chat.id;
    const senderRole = getUserRole(ctx);
    if (getRoleLevel(senderRole) < getRoleLevel('اكسترا')) {
        return ctx.reply('• هذا الامر يخص ↤ ｢ اكسترا🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
    }
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ يرجى الرد على الشخص المراد تنزيله.', { reply_to_message_id: ctx.message.message_id });
    
    const targetId = ctx.message.reply_to_message.from.id;
    const targetUser = ctx.message.reply_to_message.from.first_name;

    if (!userRoles[chatId]) userRoles[chatId] = {};
    const currentTargetRole = userRoles[chatId][targetId] || 'عضو';

    if (currentTargetRole === 'عضو') {
        return ctx.reply(`• المستخدم ↤︎ ｢ ${targetUser} ｣ هو بالفعل عضو ولا يحمل أي رتبة.`, { reply_to_message_id: ctx.message.message_id });
    }

    userRoles[chatId][targetId] = 'عضو';

    ctx.reply(
        `• المستخدم ↤︎ ｢ ${targetUser} ｣\n• تم تنزيله من الرتبة ( ${currentTargetRole} )`,
        { reply_to_message_id: ctx.message.message_id }
    );
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
console.log('Bot is running with full games and control system...');
