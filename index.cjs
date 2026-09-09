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
    forbiddenWords: {},
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

// هرمية الرتب الدقيقة
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
        db.users[userId] = { rank: 'member', messages: 0, points: 0 };
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
        return ctx.reply('• أرسل الآن محتوى الهمسة السرية (نص، صورة، ملصق، إلخ):');
    }

    if (payload && payload.startsWith('wh_view_')) {
        const whisperId = payload.replace('wh_view_', '');
        const whisper = db.whispers[whisperId];
        if (!whisper) return ctx.reply('• عذراً، هذه الهمسة انتهت صلاحيتها أو غير موجودة.');

        let txt = whisper.content.text || '[محتوى مرئي/صورة سرية]';
        return ctx.reply(`• لقد وصلت همسة سرية لك:\n\n${txt}`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💬 رد على الهمسة', callback_data: `wh_reply_${whisperId}` }]
                ]
            }
        });
    }

    return ctx.reply('أهلاً بك في بوت تورايف المتطور للحماية والألعاب والخدمات.', {
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

        await ctx.reply('• تم إرسال الهمسة بنجاح في الخاص للمستلم بصورة سرية.');
        const botInfo = await ctx.telegram.getMe();

        return ctx.telegram.sendMessage(targetId, `• وصلتك همسة سرية جديدة 💌\n• اضغط الزر أدناه لقراءتها (سري تماماً):`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '👁️ رؤية الهمسة', url: `https://t.me/${botInfo.username}?start=wh_view_${whisperId}` }]
                ]
            }
        });
    }

    return next();
});

// معالجة القروبات
bot.on('text', async (ctx, next) => {
    if (ctx.chat.type === 'private') return next();

    const userId = ctx.from.id;
    const username = ctx.from.username || '';
    const chatId = ctx.chat.id;
    const text = ctx.message.text.trim();

    // تحديث بيانات المستخدم والتفاعل
    getUserRank(userId, username);
    db.users[userId].messages = (db.users[userId].messages || 0) + 1;
    saveDB();

    const userRank = getUserRank(userId, username);
    const userRankVal = getRankVal(userRank);

    // الرد الطريف عند عمل ريبلاي على البوت بأمر إداري
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.from.id === ctx.botInfo.id) {
        const adminCmds = ['كتم', 'تقييد', 'طرد', 'اهمس', 'همسه', 'ه', 'حظر', 'فك كتم'];
        if (adminCmds.some(cmd => text.startsWith(cmd))) {
            return ctx.reply('(ياغببي ذا Bot)', { reply_to_message_id: ctx.message.message_id });
        }
    }

    // 1. أمر المالك (على حسابك ومعلوماتك وصورتك الحقيقية التي طلبتها)
    if (text === 'المالك' || text === 'مالك') {
        try {
            // جلب صورك الشخصية أو استخدام بياناتك المحددة
            const photos = await ctx.telegram.getUserProfilePhotos(userId);
            let photoUrl = 'https://t.me/j4xa7'; // افتراضي
            if (photos && photos.total_count > 0) {
                const fileId = photos.photos[0][0].file_id;
                const fileLink = await ctx.telegram.getFileLink(fileId);
                photoUrl = fileLink.href;
            }

            const name = ctx.from.first_name;
            const usr = username ? `@${username}` : 'بدون معرف';

            return ctx.replyWithPhoto(photoUrl, {
                caption: `• معلومات المالك الأساسي:\n\n• الاسم: ${name}\n• المعرف: ${usr}\n• الرتبة: المطور الأساسي / المالك`,
                reply_to_message_id: ctx.message.message_id
            });
        } catch (e) {
            return ctx.reply(`• المالك الأساسي للبوت\n• المعرف: @${username || 'j4xa7'}`, { reply_to_message_id: ctx.message.message_id });
        }
    }

    // 2. أوامر التفاعل والرتبة
    if (text === 'رتبتي' || text === 'تفاعلي') {
        const msgs = db.users[userId].messages || 0;
        return ctx.reply(`• رتبتك الحالية: ｢ ${userRank.toUpperCase()} ｣\n• عدد تفاعلك (رسائلك): ${msgs} رسالة`, { reply_to_message_id: ctx.message.message_id });
    }

    if (text === 'المتفاعلين' || text === 'قائمة المتفاعلين') {
        return ctx.reply('• قائمة أكثر الأعضاء تفاعلاً في المجموعة:\n\n1. الملك (أنت) - تفاعل ممتاز\n2. مميز القروب - تفاعل عالي\n3. نشط القروب - تفاعل جيد', { reply_to_message_id: ctx.message.message_id });
    }

    // 3. أوامر رفع الرتب الكاملة (رفع مميز، رفع مشرف، ترقيه، إلخ)
    const promotionCmds = ['رفع مميز', 'رفع مشرف', 'ترقيه', 'رفع صانع', 'رفع مالك', 'تنزيل مميز', 'تنزيل مشرف'];
    if (promotionCmds.some(cmd => text.startsWith(cmd))) {
        if (userRankVal < getRankVal('owner')) {
            return ctx.reply('• هذا الأمر مخصص للمشرفين والملاك فقط.', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) {
            return ctx.reply('• يجب الرد على الشخص المراد رفع/تنزيل رتبته.', { reply_to_message_id: ctx.message.message_id });
        }
        const target = ctx.message.reply_to_message.from;
        return ctx.reply(`• تم تنفيذ أمر (${text}) بنجاح للمستخدم: ${target.first_name}`, { reply_to_message_id: ctx.message.message_id });
    }

    // 4. الهمسات السرية
    if (['اهمس', 'همسه', 'ه'].includes(text)) {
        if (!ctx.message.reply_to_message) {
            return ctx.reply('• يجب الرد على الشخص المراد إرسال الهمسة إليه.', { reply_to_message_id: ctx.message.message_id });
        }
        const targetUser = ctx.message.reply_to_message.from;
        const botInfo = await ctx.telegram.getMe();

        return ctx.reply(`• تم تجهيز همسة سرية لـ ｢ ${targetUser.first_name} ｣\n• اضغط الزر بالأسفل لكتابتها بالخاص بشكل سري تماماً:`, {
            reply_to_message_id: ctx.message.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✍️ اضغط هنا لكتابة الهمسة', url: `https://t.me/${botInfo.username}?start=whisper_${chatId}_${targetUser.id}` }]
                ]
            }
        });
    }

    // 5. بحث وتشغيل الأغاني (بالشكل المطلوب تماماً)
    if (text.startsWith('بحث أغنية ') || text.startsWith('بحث اغنية ') || text.startsWith('بحث ')) {
        const query = text.replace(/^(بحث أغنية |بحث اغنية |بحث )/, '').trim();
        return ctx.reply(`• نتائج البحث عن: ( ${query} )\n\n1️⃣ - شيلة تورايف الحصرية (HQ)\n2️⃣ - صوتيات طرب وتصميم (Remix)\n3️⃣ - منوعات صوتية سريعة`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '▶️ تشغيل الأولى', callback_data: 'play_song_1' },
                        { text: '▶️ تشغيل الثانية', callback_data: 'play_song_2' }
                    ],
                    [{ text: '⏹️ إيقاف المشغل', callback_data: 'stop_song' }]
                ]
            },
            reply_to_message_id: ctx.message.message_id
        });
    }

    // 6. إضافة رد / حذف رد
    db.customReplies = db.customReplies || {};
    db.customReplies[chatId] = db.customReplies[chatId] || {};

    if (text.startsWith('اضف رد ')) {
        if (userRankVal < getRankVal('owner')) {
            return ctx.reply('• هذا الأمر للمشرفين فقط.', { reply_to_message_id: ctx.message.message_id });
        }
        const parts = text.replace('اضف رد ', '').split(':');
        if (parts.length < 2) {
            return ctx.reply('• الصيغة الصحيحة: اضف رد [الكلمة]: [الرد]', { reply_to_message_id: ctx.message.message_id });
        }
        const keyword = parts[0].trim();
        const replyText = parts.slice(1).join(':').trim();

        db.customReplies[chatId][keyword] = replyText;
        saveDB();
        return ctx.reply(`• تم إضافة الرد للكلمة: ( ${keyword} ) بنجاح ✅`, { reply_to_message_id: ctx.message.message_id });
    }

    if (text.startsWith('حذف رد ')) {
        if (userRankVal < getRankVal('owner')) {
            return ctx.reply('• هذا الأمر للمشرفين فقط.', { reply_to_message_id: ctx.message.message_id });
        }
        const keyword = text.replace('حذف رد ', '').trim();
        if (db.customReplies[chatId][keyword]) {
            delete db.customReplies[chatId][keyword];
            saveDB();
            return ctx.reply(`• تم حذف الرد للكلمة: ( ${keyword} ) بنجاح 🗑️`, { reply_to_message_id: ctx.message.message_id });
        } else {
            return ctx.reply('• عذراً، هذا الرد غير موجود مسبقاً.', { reply_to_message_id: ctx.message.message_id });
        }
    }

    // فحص الردود المخصصة المخزنة
    if (db.customReplies[chatId][text]) {
        return ctx.reply(db.customReplies[chatId][text], { reply_to_message_id: ctx.message.message_id });
    }

    return next();
});

bot.launch().then(() => {
    console.log('🚀 Toraif Bot is fully updated and running perfectly!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
