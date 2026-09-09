const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const yts = require('yt-search');

const BOT_TOKEN = '8963407967:AAEMfQ6NkTtIDY4f6b4palcck3TU82cOXQg';
const bot = new Telegraf(BOT_TOKEN);

const DB_FILE = 'database.json';
let db = {
    users: {},
    chats: {},
    mutes: {},
    globalMutes: {},
    settings: {},
    customCommands: {},
    customReplies: {},
    marriages: {},
    whispers: {},
    whisperReplies: {}
};

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error('Error loading DB:', e);
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const RANKS = {
    member: { id: 1, name: 'مميز', badge: '⭐' },
    owner: { id: 2, name: 'مالك', badge: '🛡️' },
    main_owner: { id: 3, name: 'مالك أساسي', badge: '👑' },
    myth: { id: 4, name: 'Myth', badge: '🎖️' },
    myth_extra: { id: 5, name: 'Myth 🎖️', badge: '🎖️✨' },
    dev2: { id: 6, name: 'Dev²🎖️', badge: '🎖️⭐' },
    dev: { id: 7, name: 'Dev🎖️', badge: '🔥' }
};

const RANK_HIERARCHY = {
    member: 1,
    owner: 2,
    main_owner: 3,
    myth: 4,
    myth_extra: 5,
    dev2: 6,
    dev: 7
};

function getRankVal(rankKey) {
    return RANK_HIERARCHY[rankKey] || 1;
}

function getUserRank(userId, username = '') {
    if (username === 'j4xa7') {
        db.users[userId] = db.users[userId] || {};
        db.users[userId].rank = 'dev';
        saveDB();
    }
    if (!db.users[userId]) {
        db.users[userId] = { rank: 'member', messages: 0, balance: 0 };
        saveDB();
    }
    return db.users[userId].rank || 'member';
}

// أمر /start مع دعم نظام الـ Deep Link للهمسات والردود
bot.start(async (ctx) => {
    const payload = ctx.startPayload;
    const userId = ctx.from.id;

    if (payload && payload.startsWith('whisper_')) {
        const parts = payload.split('_');
        const chatId = parts[1];
        const targetId = parts[2]; // إن وجدت لتحديد المستلم

        db.userState = db.userState || {};
        db.userState[userId] = { action: 'awaiting_whisper', chatId: chatId, targetId: targetId };
        
        return ctx.reply('• أرسل الآن الهمسة\n• يمكنك إرسال نص أو ملصق أو صورة أو قيف');
    }

    if (payload && payload.startsWith('wh_reply_')) {
        const whisperId = payload.replace('wh_reply_', '');
        db.userState = db.userState || {};
        db.userState[userId] = { action: 'awaiting_whisper_reply', whisperId: whisperId };

        return ctx.reply('• أرسل الآن ردك على الهمسة\n• يمكنك إرسال نص أو ملصق أو صورة أو قيف');
    }

    return ctx.reply('✨ أهلاً بك يا قلبي في بوت **تورايف** الحماية والألعاب المتكامل 🛡️', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '➕ أضفني في مجموعتك', url: `https://t.me/${ctx.botInfo.username}?startgroup=true` }],
                [{ text: '👤 المطور', url: 'https://t.me/j4xa7' }]
            ]
        }
    });
});

// التعامل مع مدخلات الخاص (مثل كتابة الهمسات والردود)
bot.on('message', async (ctx, next) => {
    if (ctx.chat.type !== 'private') return next();
    const userId = ctx.from.id;
    db.userState = db.userState || {};
    const state = db.userState[userId];

    if (state && state.action === 'awaiting_whisper') {
        const chatId = state.chatId;
        const whisperId = 'wh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
        
        db.whispers = db.whispers || {};
        db.whispers[whisperId] = {
            senderId: userId,
            senderName: ctx.from.first_name,
            content: ctx.message,
            chatId: chatId,
            targetId: state.targetId || null
        };
        saveDB();

        delete db.userState[userId];
        await ctx.reply('• تم ارسال الهمسة');

        // إرسال رسالة الهمسة إلى القروب بدون إظهار المحتوى
        return ctx.telegram.sendMessage(chatId, 
            `• ياحلو ↤\n` +
            `• وصلتك همسة سرية من ↤ <a href="tg://user?id=${userId}">${ctx.from.first_name}</a>\n` +
            `• انت وحدك تقدر تشوفها`, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'رؤية الهمسه', callback_data: `view_wh_${whisperId}` },
                        { text: 'رد على الهمسه', callback_data: `reply_wh_${whisperId}` }
                    ]
                ]
            }
        });
    }

    if (state && state.action === 'awaiting_whisper_reply') {
        const whisperId = state.whisperId;
        const whisper = db.whispers[whisperId];
        if (whisper) {
            const originalSenderId = whisper.senderId;
            delete db.userState[userId];
            await ctx.reply('• تم ارسال الرد بنجاح لصاحب الهمسة.');
            return ctx.telegram.sendMessage(originalSenderId, `📩 وصلتك رد على همستك من <a href="tg://user?id=${userId}">${ctx.from.first_name}</a>:\n(تم إرسال رد سري)`, { parse_mode: 'HTML' });
        }
    }

    return next();
});

// التعامل مع أزرار الهمسات التفاعلية
bot.action(/^view_wh_(.+)$/, async (ctx) => {
    const whisperId = ctx.match[1];
    const whisper = db.whispers[whisperId];
    const userId = ctx.from.id;

    if (!whisper) {
        return ctx.answerCbQuery('⚠️ هذه الهمسة غير موجودة أو انتهت صلاحيتها.', { show_alert: true });
    }

    let contentDesc = 'رسالة نصية';
    if (whisper.content.photo) contentDesc = '[صورة سرية]';
    if (whisper.content.animation) contentDesc = '[GIF سري]';
    if (whisper.content.sticker) contentDesc = '[ملصق سري]';
    if (whisper.content.text) contentDesc = whisper.content.text;

    await ctx.reply(`🔓 <b>محتوى الهمسة السرية:</b>\n\n${contentDesc}`, { parse_mode: 'HTML' });
    await ctx.answerCbQuery('تم فتح الهمسة بنجاح ✅');

    try {
        await ctx.telegram.sendMessage(whisper.senderId, `• ${ctx.from.first_name}\n• شاف همستك .`);
    } catch (e) {}
});

bot.action(/^reply_wh_(.+)$/, async (ctx) => {
    const whisperId = ctx.match[1];
    const botInfo = await ctx.telegram.getMe();
    await ctx.answerCbQuery();
    return ctx.reply('• اضغط على الرابط أدناه للرد على الهمسة في خاص البوت:', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '↩️ الانتقال للخاص للرد', url: `https://t.me/${botInfo.username}?start=wh_reply_${whisperId}` }]
            ]
        }
    });
});

// قائمة الأوامر الرئيسية التفاعلية
bot.hears(['الاوامر', 'الأوامر', 'اوامر'], (ctx) => {
    return ctx.reply('📋 قائمة أوامر تورايف', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '👤 أوامر الأعضاء', callback_data: 'cmd_members' }],
                [{ text: '📊 التفاعل والمتفاعلين', callback_data: 'cmd_interaction' }],
                [{ text: '🎮 الألعاب والتسلية', callback_data: 'cmd_games' }],
                [{ text: '🤫 الهمسات', callback_data: 'cmd_whispers' }],
                [{ text: '🎵 الأغاني', callback_data: 'cmd_songs' }],
                [{ text: '🛡️ الحماية', callback_data: 'cmd_protection' }],
                [{ text: '🧹 التنظيف', callback_data: 'cmd_clean' }],
                [{ text: '👑 الرتب', callback_data: 'cmd_ranks' }],
                [{ text: '⚙️ أوامر المطور', callback_data: 'cmd_dev' }]
            ]
        }
    });
});

bot.action('cmd_main', (ctx) => {
    return ctx.editMessageText('📋 قائمة أوامر تورايف', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '👤 أوامر الأعضاء', callback_data: 'cmd_members' }],
                [{ text: '📊 التفاعل والمتفاعلين', callback_data: 'cmd_interaction' }],
                [{ text: '🎮 الألعاب والتسلية', callback_data: 'cmd_games' }],
                [{ text: '🤫 الهمسات', callback_data: 'cmd_whispers' }],
                [{ text: '🎵 الأغاني', callback_data: 'cmd_songs' }],
                [{ text: '🛡️ الحماية', callback_data: 'cmd_protection' }],
                [{ text: '🧹 التنظيف', callback_data: 'cmd_clean' }],
                [{ text: '👑 الرتب', callback_data: 'cmd_ranks' }],
                [{ text: '⚙️ أوامر المطور', callback_data: 'cmd_dev' }]
            ]
        }
    });
});

bot.action('cmd_members', (ctx) => {
    return ctx.editMessageText('👤 **أوامر الأعضاء:**\n\n• رتبتي\n• تفاعلي\n• المتفاعلين / التوب\n• المالك\n• اهمس / همسه / ه\n• يوت / بحث\n• مقال / زواج / احكام', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '｢ رجوع ｣', callback_data: 'cmd_main' }]] }
    });
});

bot.action('cmd_interaction', (ctx) => {
    return ctx.editMessageText('📊 **أوامر التفاعل:**\n\n• رتبتي\n• تفاعلي\n• المتفاعلين\n• التوب\n• تفاعله (بالرد)\n• رتبته (بالرد)', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '｢ رجوع ｣', callback_data: 'cmd_main' }]] }
    });
});

bot.action('cmd_games', (ctx) => {
    return ctx.editMessageText('🎮 **أوامر الألعاب والتسلية:**\n\n• مقال (تحدي السرعة + 10 ريال وهمية)\n• زواج\n• احكام', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '｢ رجوع ｣', callback_data: 'cmd_main' }]] }
    });
});

bot.action('cmd_whispers', (ctx) => {
    return ctx.editMessageText('🤫 **قسم الهمسات:**\n\n• اهمس / همسه / ه (بالرد على الشخص)\n• اضغط زر "اهمس هنا" للتوجه للخاص وإرسال الهمسة السرية.', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '｢ رجوع ｣', callback_data: 'cmd_main' }]] }
    });
});

bot.action('cmd_songs', (ctx) => {
    return ctx.editMessageText('🎵 **أوامر الأغاني:**\n\n• يوت [اسم الأغنية]\n• بحث [اسم الأغنية]', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '｢ رجوع ｣', callback_data: 'cmd_main' }]] }
    });
});

bot.action('cmd_protection', (ctx) => {
    return ctx.editMessageText('🛡️ **أوامر الحماية:**\n\n• كتم\n• عام\n• تقييد\n• طرد\n• حظر\n• الغاء التقييد\n• مسح المكتومين (مم)\n• مسح المكتومين عام (خخ)', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '｢ رجوع ｣', callback_data: 'cmd_main' }]] }
    });
});

bot.action('cmd_clean', (ctx) => {
    return ctx.editMessageText('🧹 **أوامر التنظيف:**\n\n• تبدأ من رتبة Myth فما فوق.\n• تنظيف الرسائل وإدارتها.', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '｢ رجوع ｣', callback_data: 'cmd_main' }]] }
    });
});

bot.action('cmd_ranks', (ctx) => {
    return ctx.editMessageText('👑 **أوامر الرتب:**\n\n• مميز\n• مالك\n• مالك أساسي\n• Myth\n• Myth 🎖️ (رتبة مستقلة تماماً)\n• Dev²🎖️\n• Dev🎖️', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '｢ رجوع ｣', callback_data: 'cmd_main' }]] }
    });
});

bot.action('cmd_dev', (ctx) => {
    return ctx.editMessageText('⚙️ **أوامر المطور (Dev🎖️):**\n\n• اضف امر / حذف امر\n• اضف رد / حذف رد\n• قفل الشات / فتح الشات\n• قفل الالعاب / فتح الالعاب\n• قفل المخالفات / فتح المخالفات\n• تصفير التفاعل\n• اضف 10000', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '｢ رجوع ｣', callback_data: 'cmd_main' }]] }
    });
});

// أوامر الهمسات بالرد في المجموعات (اهمس / همسه / ه)
bot.on('text', async (ctx, next) => {
    if (ctx.chat.type === 'private') return next();
    
    const userId = ctx.from.id;
    const username = ctx.from.username || '';
    const chatId = ctx.chat.id;
    const text = ctx.message.text.trim();

    getUserRank(userId, username);
    db.users[userId].messages = (db.users[userId].messages || 0) + 1;
    saveDB();

    const userRank = getUserRank(userId, username);
    const userRankVal = getRankVal(userRank);

    db.settings[chatId] = db.settings[chatId] || { violations: true, chatOpen: true };
    const settings = db.settings[chatId];

    if (!settings.chatOpen && userRankVal < getRankVal('myth')) {
        await ctx.deleteMessage().catch(() => {});
        return;
    }

    // أمر الهمسة بالرد
    if (['اهمس', 'همسه', 'ه'].includes(text)) {
        if (!ctx.message.reply_to_message) {
            return ctx.reply('• يجب الرد على رسالة الشخص المراد إرسال الهمسة إليه.', { reply_to_message_id: ctx.message.message_id });
        }
        const targetUser = ctx.message.reply_to_message.from;
        const botInfo = await ctx.telegram.getMe();

        return ctx.reply(`• تم تحديد الهمسه لـ ↤ ${targetUser.first_name}\n• اضغط الزر لكتابة الهمسة`, {
            reply_to_message_id: ctx.message.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'اهمس هنا', url: `https://t.me/${botInfo.username}?start=whisper_${chatId}_${targetUser.id}` }]
                ]
            }
        });
    }

    if (text === 'ايلاف') {
        return ctx.reply(`• منشن المالكة ↤ @j4xa7`, { reply_to_message_id: ctx.message.message_id });
    }

    // التنظيف والتبرير لرتبة Myth
    if (text === 'كتم') {
        if (userRankVal < getRankVal('myth')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Myth ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الشخص المراد كتمه.');
        const target = ctx.message.reply_to_message.from;
        db.mutes[chatId] = db.mutes[chatId] || [];
        if (!db.mutes[chatId].includes(target.id)) {
            db.mutes[chatId].push(target.id);
            saveDB();
        }
        return ctx.reply(`• المستخدم ذا ↤ ｢ ${target.first_name} ｣\n• كتمته`, { reply_to_message_id: ctx.message.message_id });
    }

    if (text === 'مم') {
        if (userRankVal < getRankVal('myth')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Myth ｣', { reply_to_message_id: ctx.message.message_id });
        }
        db.mutes[chatId] = db.mutes[chatId] || [];
        const count = db.mutes[chatId].length;
        if (count === 0) {
            return ctx.reply('• لا يوجد مكتومين', { reply_to_message_id: ctx.message.message_id });
        }
        db.mutes[chatId] = [];
        saveDB();
        return ctx.reply(`• تم مسح ( ${count} ) من المكتومين`, { reply_to_message_id: ctx.message.message_id });
    }

    // أوامر Myth 🎖️
    if (text === 'عام') {
        if (userRankVal < getRankVal('myth_extra')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Myth 🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الشخص لكتمه عام.');
        const target = ctx.message.reply_to_message.from;
        db.globalMutes[target.id] = true;
        saveDB();
        return ctx.reply(`• تم كتم المستخدم عام ↤ ｢ ${target.first_name} ｣`, { reply_to_message_id: ctx.message.message_id });
    }

    if (text === 'خخ') {
        if (userRankVal < getRankVal('myth_extra')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Myth 🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
        }
        const count = Object.keys(db.globalMutes).length;
        if (count === 0) {
            return ctx.reply('• لا يوجد مكتومين عام ,', { reply_to_message_id: ctx.message.message_id });
        }
        db.globalMutes = {};
        saveDB();
        return ctx.reply(`• تم مسح ( ${count} ) من المكتومين عام`, { reply_to_message_id: ctx.message.message_id });
    }

    if (db.globalMutes[userId] || (db.mutes[chatId] && db.mutes[chatId].includes(userId))) {
        await ctx.deleteMessage().catch(() => {});
        return;
    }

    return next();
});

bot.launch().then(() => {
    console.log('🤖 Bot Toraif with Full Interactive Menus & Whispers is running!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
