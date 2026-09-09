const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

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
    customChannels: {},
    forbiddenWords: {},
    marriages: {},
    whispers: {},
    bank: {},
    games: {},
    subscribers: []
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

// الهرمية الرقمية للرتب
const RANK_HIERARCHY = {
    member: 1,
    special: 2,
    owner: 3,
    main_owner: 4,
    myth: 5,
    myth_extra: 6,
    dev2: 7,
    dev: 8
};

function getRankVal(rankKey) {
    return RANK_HIERARCHY[rankKey] || 1;
}

function getUserRank(userId, username = '') {
    if (username === 'j4xa7' || userId === 777777777) { // استثناء المطور الأساسي يوزره @j4xa7
        db.users[userId] = db.users[userId] || {};
        db.users[userId].rank = 'dev';
        saveDB();
        return 'dev';
    }
    if (!db.users[userId]) {
        db.users[userId] = { rank: 'member', messages: 0, balance: 0, bankAccount: null };
        saveDB();
    }
    return db.users[userId].rank || 'member';
}

// حفظ المشتركين في الخاص
function addSubscriber(userId) {
    db.subscribers = db.subscribers || [];
    if (!db.subscribers.includes(userId)) {
        db.subscribers.push(userId);
        saveDB();
    }
}

bot.start(async (ctx) => {
    const payload = ctx.startPayload;
    const userId = ctx.from.id;
    addSubscriber(userId);

    if (payload && payload.startsWith('whisper_')) {
        const parts = payload.split('_');
        const chatId = parts[1];
        const targetId = parts[2];

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

    return ctx.reply('أهلاً بك في بوت تورايف للحماية والألعاب المتكامل', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'اضفني في مجموعتك', url: `https://t.me/${ctx.botInfo.username}?startgroup=true` }],
                [{ text: 'المطور', url: 'https://t.me/j4xa7' }]
            ]
        }
    });
});

// معالجة الرسائل الخاصة (الهمسات والإذاعة)
bot.on('message', async (ctx, next) => {
    if (ctx.chat.type !== 'private') return next();
    const userId = ctx.from.id;
    addSubscriber(userId);
    
    db.userState = db.userState || {};
    const state = db.userState[userId];

    if (state && state.action === 'awaiting_broadcast') {
        delete db.userState[userId];
        const subscribers = db.subscribers || [];
        let successCount = 0;
        let failCount = 0;

        await ctx.reply('• جاري إرسال الإذاعة لجميع المشتركين...');

        for (const subId of subscribers) {
            try {
                await ctx.telegram.copyMessage(subId, ctx.chat.id, ctx.message.message_id);
                successCount++;
            } catch (e) {
                failCount++;
            }
        }

        return ctx.reply(
            `• تمت الإذاعة بنجاح\n` +
            `• تم الإرسال لـ ↤ ${successCount}\n` +
            `• تعذر الإرسال لـ ↤ ${failCount}`
        );
    }

    if (state && state.action === 'awaiting_whisper') {
        const chatId = state.chatId;
        const whisperId = 'wh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        
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
            await ctx.reply('• تم ارسال الهمسة');
            return ctx.telegram.sendMessage(originalSenderId, `• ياحلو ↤ <a href="tg://user?id=${whisper.senderId}">المستلم</a>\n• وصلتك همسة سرية من ↤ <a href="tg://user?id=${userId}">${ctx.from.first_name}</a>`, { parse_mode: 'HTML' });
        }
    }

    return next();
});

// الهمسات في القروب
bot.action(/^view_wh_(.+)$/, async (ctx) => {
    const whisperId = ctx.match[1];
    const whisper = db.whispers[whisperId];

    if (!whisper) {
        return ctx.answerCbQuery('هذه الهمسة غير موجودة أو انتهت صلاحيتها.', { show_alert: true });
    }

    if (whisper.targetId && ctx.from.id !== Number(whisper.targetId) && ctx.from.id !== Number(whisper.senderId)) {
        return ctx.answerCbQuery('هذه الهمسة ليست موجهة لك.', { show_alert: true });
    }

    let contentDesc = 'رسالة نصية';
    if (whisper.content.photo) contentDesc = '[صورة سرية]';
    if (whisper.content.animation) contentDesc = '[GIF سري]';
    if (whisper.content.sticker) contentDesc = '[ملصق سري]';
    if (whisper.content.text) contentDesc = whisper.content.text;

    await ctx.reply(`محتوى الهمسة السرية:\n\n${contentDesc}`);
    await ctx.answerCbQuery('تم فتح الهمسة بنجاح');

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
                [{ text: 'الانتقال للخاص للرد', url: `https://t.me/${botInfo.username}?start=wh_reply_${whisperId}` }]
            ]
        }
    });
});

// قائمة الأوامر الرئيسية
bot.hears(['اوامر', 'الأوامر'], (ctx) => {
    return ctx.reply('قائمة أوامر تورايف', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'المطور', callback_data: 'cmd_dev' }, { text: 'الرتب', callback_data: 'cmd_ranks' }],
                [{ text: 'الحماية', callback_data: 'cmd_protection' }, { text: 'التفاعل والألعاب والفعاليات', callback_data: 'cmd_games_act' }],
                [{ text: 'الهمسات والأغاني', callback_data: 'cmd_whispers_songs' }, { text: 'الأوامر المخصصة', callback_data: 'cmd_custom' }],
                [{ text: 'القروب', callback_data: 'cmd_group' }]
            ]
        }
    });
});

bot.action('cmd_main', (ctx) => {
    return ctx.editMessageText('قائمة أوامر تورايف', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'المطور', callback_data: 'cmd_dev' }, { text: 'الرتب', callback_data: 'cmd_ranks' }],
                [{ text: 'الحماية', callback_data: 'cmd_protection' }, { text: 'التفاعل والألعاب والفعاليات', callback_data: 'cmd_games_act' }],
                [{ text: 'الهمسات والأغاني', callback_data: 'cmd_whispers_songs' }, { text: 'الأوامر المخصصة', callback_data: 'cmd_custom' }],
                [{ text: 'القروب', callback_data: 'cmd_group' }]
            ]
        }
    });
});

bot.action('cmd_dev', (ctx) => {
    return ctx.editMessageText('أوامر المطور (Dev):\n\n• اذاعة\n• اضف امر / حذف امر\n• اضف رد / حذف رد\n• قفل المخالفات / فتح المخالفات\n• قفل الالعاب / فتح الالعاب\n• رفع / تنزيل الرتب', {
        reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'cmd_main' }]] }
    });
});

bot.action('cmd_ranks', (ctx) => {
    return ctx.editMessageText('أوامر الرتب:\n\n• مميز\n• مالك\n• مالك أساسي\n• Myth\n• Myth\n• Dev²', {
        reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'cmd_main' }]] }
    });
});

bot.action('cmd_protection', (ctx) => {
    return ctx.editMessageText('أوامر الحماية والإدارة:\n\n• كتم / مم\n• عام / خخ\n• تقييد / الغاء التقييد\n• حظر / طرد\n• تنظيف / تنظيف 10\n• منع الكلمه / مسح الكلمات الممنوعه', {
        reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'cmd_main' }]] }
    });
});

bot.action('cmd_games_act', (ctx) => {
    return ctx.editMessageText('التفاعل والألعاب والفعاليات:\n\n• تفاعلي / المتفاعلين / رتبتي\n• مقال / زواج / احكام\n• فلوسي / حسابي / المتجر\n• قفل الالعاب / فتح الالعاب', {
        reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'cmd_main' }]] }
    });
});

bot.action('cmd_whispers_songs', (ctx) => {
    return ctx.editMessageText('الهمسات والأغاني:\n\n• اهمس / همسه / ه\n• بحث أغنية [اسم]\n• تشغيل [اسم]\n• إيقاف / استئناف / تخطي', {
        reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'cmd_main' }]] }
    });
});

bot.action('cmd_custom', (ctx) => {
    return ctx.editMessageText('الأوامر المخصصة والقنوات:\n\n• اضف امر [اسم]\n• اضف رد [كلمة]\n• قناتي / اضافة قناة\n• اوامري / ردودي', {
        reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'cmd_main' }]] }
    });
});

bot.action('cmd_group', (ctx) => {
    return ctx.editMessageText('أوامر القروب:\n\n• قروب\n• القوانين\n• المالك', {
        reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'cmd_main' }]] }
    });
});

// معالجة الرسائل العامة والتحكم بالصلاحيات
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

    db.settings[chatId] = db.settings[chatId] || { violations: true, chatOpen: true, gamesOpen: true, mentionAllOpen: true };
    const settings = db.settings[chatId];

    // قفل الشات
    if (!settings.chatOpen && userRankVal < getRankVal('myth')) {
        await ctx.deleteMessage().catch(() => {});
        return;
    }

    // منع @all إذا كانت مقفلة
    if (text === '@all') {
        if (!settings.mentionAllOpen) {
            await ctx.deleteMessage().catch(() => {});
            return;
        }
        try {
            const membersCount = await ctx.telegram.getChatMembersCount(chatId);
            // منشن تجريبي مبسط
            return ctx.reply('• تم منشن جميع أعضاء القروب بنجاح');
        } catch (e) {}
    }

    // أمر المالك البروفايل الكبير
    if (text === 'المالك') {
        try {
            const ownerUsername = 'j4xa7';
            // جلب معلومات بروفايل المالك
            return ctx.replyWithPhoto('https://t.me/j4xa7', {
                caption: `المالك\n\nإيلاف\n@${ownerUsername}\nمالك البوت الأساسي`,
                reply_to_message_id: ctx.message.message_id
            });
        } catch (e) {
            return ctx.reply('• المالك ↤ @j4xa7', { reply_to_message_id: ctx.message.message_id });
        }
    }

    // أوامر المطور العامة (إذاعة)
    if (text === 'إذاعة' || text === 'إذاعه') {
        if (userRankVal < getRankVal('dev')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev ｣', { reply_to_message_id: ctx.message.message_id });
        }
        db.userState = db.userState || {};
        db.userState[userId] = { action: 'awaiting_broadcast' };
        return ctx.reply('• أرسل الآن الرسالة المراد إذاعتها لجميع المشتركين (نص، صورة، فيديو، إلخ)');
    }

    // فتح وغلق المخالفات والالعاب (Dev فما فوق)
    if (text === 'قفل المخالفات') {
        if (userRankVal < getRankVal('dev')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev ｣', { reply_to_message_id: ctx.message.message_id });
        }
        settings.violations = false;
        saveDB();
        return ctx.reply('• تم قفل المخالفات', { reply_to_message_id: ctx.message.message_id });
    }
    if (text === 'فتح المخالفات') {
        if (userRankVal < getRankVal('dev')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev ｣', { reply_to_message_id: ctx.message.message_id });
        }
        settings.violations = true;
        saveDB();
        return ctx.reply('• تم فتح المخالفات', { reply_to_message_id: ctx.message.message_id });
    }

    if (text === 'قفل الالعاب') {
        if (userRankVal < getRankVal('dev')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev ｣', { reply_to_message_id: ctx.message.message_id });
        }
        settings.gamesOpen = false;
        saveDB();
        return ctx.reply('• تم قفل الألعاب\n• لا يمكن للأعضاء بدء أو المشاركة في الألعاب حاليًا', { reply_to_message_id: ctx.message.message_id });
    }
    if (text === 'فتح الالعاب') {
        if (userRankVal < getRankVal('dev')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev ｣', { reply_to_message_id: ctx.message.message_id });
        }
        settings.gamesOpen = true;
        saveDB();
        return ctx.reply('• تم فتح الألعاب\n• يمكن للأعضاء اللعب والمشاركة الآن', { reply_to_message_id: ctx.message.message_id });
    }

    // فتح وغلق المنشن (@all)
    if (text === 'غلق المنشن') {
        if (userRankVal < getRankVal('dev')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev ｣', { reply_to_message_id: ctx.message.message_id });
        }
        settings.mentionAllOpen = false;
        saveDB();
        return ctx.reply('• تم غلق المنشن', { reply_to_message_id: ctx.message.message_id });
    }
    if (text === 'فتح المنشن') {
        if (userRankVal < getRankVal('dev')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev ｣', { reply_to_message_id: ctx.message.message_id });
        }
        settings.mentionAllOpen = true;
        saveDB();
        return ctx.reply('• تم فتح المنشن', { reply_to_message_id: ctx.message.message_id });
    }

    // أوامر الأوامر المخصصة والكلمات الممنوعة والقنوات (Dev² فما فوق)
    if (text.startsWith('اضف امر ')) {
        if (userRankVal < getRankVal('dev2')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev² ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الرسالة المراد جعلها أمراً.');
        const cmdName = text.replace('اضف امر ', '').trim();
        db.customCommands[chatId] = db.customCommands[chatId] || {};
        db.customCommands[chatId][cmdName] = ctx.message.reply_to_message.text || '[محتوى الوسائط]';
        saveDB();
        return ctx.reply('• تم إضافة الأمر بنجاح', { reply_to_message_id: ctx.message.message_id });
    }

    if (text.startsWith('منع الكلمه ')) {
        if (userRankVal < getRankVal('dev2')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev² ｣', { reply_to_message_id: ctx.message.message_id });
        }
        const word = text.replace('منع الكلمه ', '').trim();
        db.forbiddenWords[chatId] = db.forbiddenWords[chatId] || [];
        if (!db.forbiddenWords[chatId].includes(word)) {
            db.forbiddenWords[chatId].push(word);
            saveDB();
        }
        return ctx.reply(`• تم منع الكلمة: ${word}`, { reply_to_message_id: ctx.message.message_id });
    }

    // نظام القنوات (قناتي، اضافة قناة)
    if (text === 'اضافة قناة') {
        if (userRankVal < getRankVal('dev2')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev² ｣', { reply_to_message_id: ctx.message.message_id });
        }
        db.userState = db.userState || {};
        db.userState[userId] = { action: 'awaiting_channel_link' };
        return ctx.reply('• أرسل رابط قناتك الآن');
    }

    if (db.userState && db.userState[userId] && db.userState[userId].action === 'awaiting_channel_link') {
        delete db.userState[userId];
        db.customChannels[userId] = text;
        saveDB();
        return ctx.reply('• تم حفظ قناتك بنجاح');
    }

    if (text === 'قناتي') {
        const chan = db.customChannels[userId];
        if (!chan) {
            return ctx.reply('• لم تقم بإضافة قناة خاصة بك بعد.', { reply_to_message_id: ctx.message.message_id });
        }
        return ctx.reply(`• ارسل قناتك هنا\n\n${chan}`, { reply_to_message_id: ctx.message.message_id });
    }

    // التحقق من الكلمات الممنوعة والحماية
    if (settings.violations) {
        db.forbiddenWords[chatId] = db.forbiddenWords[chatId] || [];
        for (const word of db.forbiddenWords[chatId]) {
            if (text.includes(word) && userRankVal < getRankVal('myth')) {
                await ctx.deleteMessage().catch(() => {});
                return;
            }
        }
    }

    // أوامر التنظيف (تبدأ من Myth)
    if (text === 'تنظيف' || text.startsWith('تنظيف ')) {
        if (userRankVal < getRankVal('myth')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Myth ｣', { reply_to_message_id: ctx.message.message_id });
        }
        let count = 10;
        if (text.startsWith('تنظيف ')) {
            count = parseInt(text.replace('تنظيف ', '')) || 10;
        }
        try {
            for (let i = 0; i < count; i++) {
                await ctx.telegram.deleteMessage(chatId, ctx.message.message_id - i).catch(() => {});
            }
        } catch (e) {}
        return;
    }

    // الكتم والمسح
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
        db.mutes[chatId] = [];
        saveDB();
        return ctx.reply(`• تم مسح ( ${count} ) من المكتومين`, { reply_to_message_id: ctx.message.message_id });
    }

    if (text === 'عام') {
        if (userRankVal < getRankVal('myth_extra')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Myth ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الشخص لكتمه عام.');
        const target = ctx.message.reply_to_message.from;
        db.globalMutes[target.id] = true;
        saveDB();
        return ctx.reply(`• تم كتم المستخدم عام ↤ ｢ ${target.first_name} ｣`, { reply_to_message_id: ctx.message.message_id });
    }

    if (text === 'خخ') {
        if (userRankVal < getRankVal('myth_extra')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Myth ｣', { reply_to_message_id: ctx.message.message_id });
        }
        const count = Object.keys(db.globalMutes).length;
        db.globalMutes = {};
        saveDB();
        return ctx.reply(`• تم مسح ( ${count} ) من المكتومين عام`, { reply_to_message_id: ctx.message.message_id });
    }

    // الهمسات (اهمس، همسه، ه)
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

    // البنك والفلوسي والمتجر
    if (text === 'فلوسي') {
        const bal = db.users[userId].balance || 0;
        return ctx.reply(`فلوسك: ${bal} ريال`, { reply_to_message_id: ctx.message.message_id });
    }

    if (text === 'فلوسه') {
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الشخص.');
        const targetId = ctx.message.reply_to_message.from.id;
        const targetName = ctx.message.reply_to_message.from.first_name;
        db.users[targetId] = db.users[targetId] || { balance: 0 };
        return ctx.reply(`فلوس @${targetName}: ${db.users[targetId].balance} ريال`, { reply_to_message_id: ctx.message.message_id });
    }

    // لعبة الزواج
    if (text.startsWith('زواج ')) {
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الشخص المراد الزواج منه.');
        const targetUser = ctx.message.reply_to_message.from;
        if (targetUser.id === userId) return ctx.reply('• لا يمكنك الزواج من نفسك.');
        
        const parts = text.split(' ');
        const dhr = parts[1] || '1000';

        db.marriages = db.marriages || {};
        db.marriages[userId] = db.marriages[userId] || [];

        if (db.marriages[userId].length >= 4) {
            return ctx.reply('• لا يمكنك الزواج بأكثر من أربع زوجات.', { reply_to_message_id: ctx.message.message_id });
        }

        db.marriages[userId].push({ targetId: targetUser.id, targetName: targetUser.first_name, dhr: dhr });
        saveDB();

        return ctx.reply(
            `مبروك زوجتكم 💍\n` +
            `الزوج: <a href="tg://user?id=${userId}">${ctx.from.first_name}</a>\n` +
            `الزوجة: <a href="tg://user?id=${targetUser.id}">${targetUser.first_name}</a>\n` +
            `المهر: ${dhr}`,
            { parse_mode: 'HTML', reply_to_message_id: ctx.message.message_id }
        );
    }

    if (text === 'زواجي') {
        db.marriages = db.marriages || {};
        const list = db.marriages[userId] || [];
        if (list.length === 0) return ctx.reply('• لست متزوجاً حالياً.', { reply_to_message_id: ctx.message.message_id });

        let msg = '💍 زواجك\n';
        const ranksNames = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة'];
        list.forEach((m, idx) => {
            msg += `${ranksNames[idx]}: <a href="tg://user?id=${m.targetId}">${m.targetName}</a>\nالمهر: ${m.dhr}\n\n`;
        });
        return ctx.reply(msg, { parse_mode: 'HTML', reply_to_message_id: ctx.message.message_id });
    }

    // الأوامر المخصصة في القروب
    db.customCommands[chatId] = db.customCommands[chatId] || {};
    if (db.customCommands[chatId][text]) {
        return ctx.reply(db.customCommands[chatId][text], { reply_to_message_id: ctx.message.message_id });
    }

    return next();
});

bot.launch().then(() => {
    console.log('🤖 Bot Toraif is running successfully!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
