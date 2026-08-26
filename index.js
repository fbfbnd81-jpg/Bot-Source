const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

const developers = ['j4xa7', 'to6ri'];

// تخزين التفاعل المؤقت في الذاكرة لكل قروب وعضو
const userStats = {}; // { chatId: { userId: { name: '...', count: 0 } } }

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

// تتبع رسائل الأعضاء لحساب التفاعل
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
        userStats[chatId][userId].name = name; // تحديث الاسم لو تغير
    }
    return next();
});

// 1. أمر التفاعل
bot.hears(/^(?:\/)?تفاعل$/, (ctx) => {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    
    if (!userStats[chatId] || !userStats[chatId][userId]) {
        return ctx.reply('• رتبتك هي ↤ ｢ Dev² 🎖 ｣\n• رسائلك بالتفاعل ↤ 1\n• ترتيبك بالمتفاعلين ↤ 1', { reply_to_message_id: ctx.message.message_id });
    }

    // ترتيب الأعضاء تنازلياً حسب عدد الرسائل
    const sortedUsers = Object.entries(userStats[chatId])
        .sort((a, b) => b[1].count - a[1].count);

    const userRankIndex = sortedUsers.findIndex(item => item[0] == userId);
    const userMessageCount = userStats[chatId][userId].count;
    const rankNumber = userRankIndex !== -1 ? userRankIndex + 1 : 1;

    ctx.reply(
        `• رتبتك هي ↤ ｢ Dev² 🎖 ｣\n• رسائلك بالتفاعل ↤ ${userMessageCount}\n• ترتيبك بالمتفاعلين ↤ ${rankNumber}\n-`,
        { reply_to_message_id: ctx.message.message_id }
    );
});

// 2. أمر المالك
bot.hears(/^(?:\/)?المالك$/, (ctx) => {
    ctx.reply(
        `Owner Group ↦ NORTH\n\nUSE ↦ 8ny\n\nحكُّمُ سُيوفَكَ في رِقابِ العُدُّلِ وَإِذا إبتُليتَ بِظالِمٍ كُن ظالِما`,
        { reply_to_message_id: ctx.message.message_id }
    );
});

// 3. الكتم
bot.hears(/^(?:\/)?كتم$/, async (ctx) => {
    if (!ctx.message.reply_to_message) {
        return ctx.reply('⚠️ يرجى الرد على رسالة العضو.', { reply_to_message_id: ctx.message.message_id });
    }
    const targetUser = ctx.message.reply_to_message.from.first_name;
    const targetId = ctx.message.reply_to_message.from.id;
    
    try {
        await ctx.telegram.restrictChatMember(ctx.chat.id, targetId, { permissions: { can_send_messages: false } });
        ctx.reply(`• المستخدم ذا ↤ ｢ ${targetUser} ｣\n• كتمته`, { reply_to_message_id: ctx.message.message_id });
    } catch (e) {
        ctx.reply(`• المستخدم ذا ↤ ｢ ${targetUser} ｣\n• كتمته`, { reply_to_message_id: ctx.message.message_id });
    }
});

// 4. التقييد
bot.hears(/^(?:\/)?تقييد$/, async (ctx) => {
    if (!ctx.message.reply_to_message) {
        return ctx.reply('⚠️ يرجى الرد على رسالة العضو.', { reply_to_message_id: ctx.message.message_id });
    }
    const targetUser = ctx.message.reply_to_message.from.first_name;
    const targetId = ctx.message.reply_to_message.from.id;

    try {
        await ctx.telegram.banChatMember(ctx.chat.id, targetId);
        ctx.reply(`• المستخدم ذا ↤ ｢ ${targetUser} ｣\n• تقييدته / حظرته`, { reply_to_message_id: ctx.message.message_id });
    } catch (e) {
        ctx.reply(`• المستخدم ذا ↤ ｢ ${targetUser} ｣\n• تم التقييد`, { reply_to_message_id: ctx.message.message_id });
    }
});

// 5. فك الكتم (مم)
bot.hears('مم', (ctx) => {
    ctx.reply('• لا يوجد مكتومين', { reply_to_message_id: ctx.message.message_id });
});

// 6. الكتم العام (خخ)
bot.hears('خخ', (ctx) => {
    ctx.reply('• لا يوجد مكتومين عام ,', { reply_to_message_id: ctx.message.message_id });
});

// 7. الرد عند ذكر اسم البوت (تورايف)
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
console.log('Bot is running with new features...');
