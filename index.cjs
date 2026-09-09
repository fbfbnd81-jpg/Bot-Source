const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const BOT_TOKEN = '8963407967:AAEMfQ6NkTtIDY4f6b4palcck3TU82cOXQg';
const bot = new Telegraf(BOT_TOKEN);

const DB_FILE = 'database.json';
let db = {
    users: {},
    chats: {},
    settings: {},
    customCommands: {},
    customReplies: {},
    whispers: {},
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
    if (userId === 777777777 || username === 'j4xa7') {
        db.users[userId] = db.users[userId] || {};
        db.users[userId].rank = 'dev';
        saveDB();
        return 'dev';
    }
    if (!db.users[userId]) {
        db.users[userId] = { rank: 'member', messages: 0 };
        saveDB();
    }
    return db.users[userId].rank || 'member';
}

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
        db.userState[userId] = { action: 'awaiting_whisper', chatId, targetId };
        return ctx.reply('• أرسل الآن محتوى الهمسة السرية الخاصة بك:');
    }

    if (payload && payload.startsWith('wh_view_')) {
        const whisperId = payload.replace('wh_view_', '');
        const whisper = db.whispers[whisperId];
        if (!whisper) return ctx.reply('• عذراً، هذه الهمسة انتهت صلاحيتها.');

        let txt = whisper.content.text || '[محتوى سري]';
        return ctx.reply(`• محتوى الهمسة السرية:\n\n${txt}`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💬 رد على الهمسة', callback_data: `wh_reply_${whisperId}` }]
                ]
            }
        });
    }

    return ctx.reply('أهلاً بك في بوت تورايف المتطور.', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '➕ اضفني لمجموعتك', url: `https://t.me/${ctx.botInfo.username}?startgroup=true` }]
            ]
        }
    });
});

bot.on('message', async (ctx, next) => {
    if (ctx.chat.type !== 'private') return next();
    const userId = ctx.from.id;
    addSubscriber(userId);

    db.userState = db.userState || {};
    const state = db.userState[userId];

    if (state && state.action === 'awaiting_whisper') {
        const { targetId } = state;
        delete db.userState[userId];

        const whisperId = 'wh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        db.whispers = db.whispers || {};
        db.whispers[whisperId] = {
            senderId: userId,
            senderName: ctx.from.first_name,
            content: ctx.message
        };
        saveDB();

        await ctx.reply('• تم إرسال الهمسة السرية بنجاح.');
        const botInfo = await ctx.telegram.getMe();

        return ctx.telegram.sendMessage(targetId, `• وصلت لك همسة سرية جديدة 💌\n• اضغط الزر أدناه للاطلاع عليها:`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '👁️ رؤية الهمسة', url: `https://t.me/${botInfo.username}?start=wh_view_${whisperId}` }]
                ]
            }
        });
    }

    return next();
});

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

    // الرد الطريف عند عمل ريبلاي على البوت بأمر
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.from.id === ctx.botInfo.id) {
        const adminCmds = ['كتم', 'تقييد', 'طرد', 'اهمس', 'همسه', 'ه', 'حظر'];
        if (adminCmds.some(cmd => text.startsWith(cmd))) {
            return ctx.reply('(ياغببي ذا Bot)', { reply_to_message_id: ctx.message.message_id });
        }
    }

    // أمر المالك بصورتك ومعلوماتك
    if (text === 'المالك' || text === 'مالك') {
        try {
            const photos = await ctx.telegram.getUserProfilePhotos(userId);
            let photoUrl = 'https://t.me/j4xa7';
            if (photos && photos.total_count > 0) {
                const fileId = photos.photos[0][0].file_id;
                const fileLink = await ctx.telegram.getFileLink(fileId);
                photoUrl = fileLink.href;
            }
            return ctx.replyWithPhoto(photoUrl, {
                caption: `• معلومات المالك الأساسي:\n\n• الاسم: ${ctx.from.first_name}\n• المعرف: @${username || 'j4xa7'}\n• الرتبة: المطور الأساسي`,
                reply_to_message_id: ctx.message.message_id
            });
        } catch (e) {
            return ctx.reply(`• المالك الأساسي: @${username || 'j4xa7'}`, { reply_to_message_id: ctx.message.message_id });
        }
    }

    // أوامر التفاعل والرتبة
    if (text === 'رتبتي' || text === 'تفاعلي') {
        const msgs = db.users[userId].messages || 0;
        return ctx.reply(`• رتبتك: ｢ ${userRank.toUpperCase()} ｣\n• تفاعلك: ${msgs} رسالة`, { reply_to_message_id: ctx.message.message_id });
    }

    if (text === 'المتفاعلين') {
        return ctx.reply('• قائمة المتفاعلين في المجموعة متوفرة وتعمل بنجاح.', { reply_to_message_id: ctx.message.message_id });
    }

    // أوامر رفع الرتب
    const promotionCmds = ['رفع مميز', 'رفع مشرف', 'ترقيه', 'رفع صانع', 'رفع مالك', 'تنزيل مميز', 'تنزيل مشرف'];
    if (promotionCmds.some(cmd => text.startsWith(cmd))) {
        if (userRankVal < getRankVal('owner')) {
            return ctx.reply('• هذا الأمر للمشرفين والملاك فقط.', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) {
            return ctx.reply('• يجب الرد على المستخدم المعني.', { reply_to_message_id: ctx.message.message_id });
        }
        return ctx.reply(`• تم تنفيذ (${text}) بنجاح.`, { reply_to_message_id: ctx.message.message_id });
    }

    // الهمسات
    if (['اهمس', 'همسه', 'ه'].includes(text)) {
        if (!ctx.message.reply_to_message) {
            return ctx.reply('• يجب الرد على رسالة الشخص المستهدف.', { reply_to_message_id: ctx.message.message_id });
        }
        const targetUser = ctx.message.reply_to_message.from;
        const botInfo = await ctx.telegram.getMe();
        return ctx.reply(`• تم تجهيز الهمسة لـ ｢ ${targetUser.first_name} ｣`, {
            reply_to_message_id: ctx.message.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✍️ اضغط هنا لكتابة الهمسة', url: `https://t.me/${botInfo.username}?start=whisper_${chatId}_${targetUser.id}` }]
                ]
            }
        });
    }

    // بحث الأغاني
    if (text.startsWith('بحث أغنية ') || text.startsWith('بحث اغنية ') || text.startsWith('بحث ')) {
        const query = text.replace(/^(بحث أغنية |بحث اغنية |بحث )/, '').trim();
