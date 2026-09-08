const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const https = require('https');
const yts = require('yt-search'); // يُرجى تثبيت حزمة yt-search و ytdl-core أو استخدام مكتبة مناسبة للتحميل

// ضع توكن بوتك هنا
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
    whispers: {}
};

// تحميل قاعدة البيانات
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

// هيكل الرتب وترتيبها (من الأقل للأعلى)
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
    // تحديد حساب المطور الأساسي تلقائياً
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

// أمر البدء /start
bot.start((ctx) => {
    return ctx.reply('✨ أهلاً بك يا قلبي في بوت **تورايف** الحماية والألعاب المتكامل 🛡️\n\n• أنا بوت تورايف لإدارة مجموعات تليجرام بأعلى كفاءة وسرعة!', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '➕ أضفني في مجموعتك', url: `https://t.me/${ctx.botInfo.username}?startgroup=true` }],
                [{ text: '👤 المطور', url: 'https://t.me/j4xa7' }]
            ]
        }
    });
});

// أمر رتبتي وتفاعلي
bot.hears(['رتبتي', 'تفاعلي'], (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username || '';
    const rankKey = getUserRank(userId, username);
    const rankInfo = RANKS[rankKey] || RANKS.member;
    const user = db.users[userId];

    const sortedUsers = Object.entries(db.users)
        .sort((a, b) => (b[1].messages || 0) - (a[1].messages || 0));
    
    let position = sortedUsers.findIndex(([id]) => id == userId) + 1;
    if (position === 0) position = 1;

    const name = ctx.from.first_name || 'User';

    const text = `${name}\n` +
        `🏅 رتبتك هي ↤ ${rankInfo.name}\n` +
        `• رسائلك بالتفاعل ↤ ${user.messages || 0}\n` +
        `• ترتيبك بالمتفاعلين ↤ ${position}`;

    return ctx.reply(text, { reply_to_message_id: ctx.message.message_id });
});

// أمر التوب / المتفاعلين
bot.hears(['المتفاعلين', 'التوب'], (ctx) => {
    const sortedUsers = Object.entries(db.users)
        .sort((a, b) => (b[1].messages || 0) - (a[1].messages || 0))
        .slice(0, 20);

    let msg = 'توب اكثر 20 متفاعلين بالقروب :\n\n━━━━━━━━━\n\n';
    const medals = ['🥇', '🥈', '🥉'];

    sortedUsers.forEach(([id, data], index) => {
        const rankPrefix = medals[index] || `${index + 1}`;
        msg += `${rankPrefix} ) ${data.messages || 0} تفاعل l <a href="tg://user?id=${id}">عضو</a>\n`;
    });

    msg += '\n━━━━━━━━━\n\n';
    const userId = ctx.from.id;
    const userMsgCount = db.users[userId]?.messages || 0;
    let userPos = Object.entries(db.users).sort((a, b) => (b[1].messages || 0) - (a[1].messages || 0)).findIndex(([id]) => id == userId) + 1;
    
    msg += `• you) ${userMsgCount} تفاعل l <a href="tg://user?id=${userId}">أنت</a> (الترتيب: ${userPos})`;

    return ctx.reply(msg, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: 'إخفاء الأمر', callback_data: 'hide_message' }]
            ]
        }
    });
});

bot.action('hide_message', (ctx) => {
    ctx.deleteMessage().catch(() => {});
});

// معالجة الرسائل ونظام الحماية والمخالفات والأوامر
bot.on('text', async (ctx, next) => {
    if (ctx.chat.type === 'private') return next();
    
    const userId = ctx.from.id;
    const username = ctx.from.username || '';
    const chatId = ctx.chat.id;
    const text = ctx.message.text.trim();

    // تحديث التفاعل والرسائل
    getUserRank(userId, username);
    db.users[userId].messages = (db.users[userId].messages || 0) + 1;
    saveDB();

    const userRank = getUserRank(userId, username);
    const userRankVal = getRankVal(userRank);

    // التحقق من إعدادات القروب والمخالفات
    db.settings[chatId] = db.settings[chatId] || { violations: true, chatOpen: true, gamesOpen: true, repliesOpen: true };
    const settings = db.settings[chatId];

    // نظام حماية الشات المغلق
    if (!settings.chatOpen && userRankVal < getRankVal('myth')) {
        await ctx.deleteMessage().catch(() => {});
        return;
    }

    // الحماية التلقائية (روابط، إعلانات، تعديل، إلخ) إذا كانت المخالفات مفعلة
    if (settings.violations && userRankVal < getRankVal('myth')) {
        if (text.includes('http://') || text.includes('https://') || text.includes('t.me/')) {
            await ctx.deleteMessage().catch(() => {});
            return ctx.reply(`⚠️ ${ctx.from.first_name}، ممنوع إرسال الروابط هنا!`, { reply_to_message_id: ctx.message.message_id });
        }
    }

    // استجابة لـ "ايلاف"
    if (text === 'ايلاف') {
        return ctx.reply(`• منشن المالكة ↤ @j4xa7`, {
            reply_to_message_id: ctx.message.message_id
        });
    }

    // شخصية البوت (تورايف / بوت)
    if (text.startsWith('تورايف') || text.startsWith('بوت')) {
        if (text.includes('ماتشا')) {
            return ctx.reply('سهلة مرره! جيبي بودرة الماتشا، اخفقيها بشوية موية دافية لين تفور، وضعيها فوق حليب بارد وثالثهم ثلج وعوافي 🍵✨', { reply_to_message_id: ctx.message.message_id });
        }
        if (text.includes('ايلاف') || text.includes('إيلاف')) {
            return ctx.reply('إيلاف أسطورة الفخامة ومبرمجتي العظيمة.. فديتها وفديت عيونها 😭💖✨', { reply_to_message_id: ctx.message.message_id });
        }
        const replies = ['هلا', 'عيوني 🫀', 'امرني يا قلبي', 'وش بغيت؟', 'هاه معك', 'عيون ايفي انت 🥹'];
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        return ctx.reply(randomReply, { reply_to_message_id: ctx.message.message_id });
    }

    // أمر المالك
    if (text === 'المالك') {
        try {
            const chatMember = await ctx.telegram.getChatMember('@j4xa7'.replace('@', ''), '@j4xa7'.replace('@', ''));
            // جلب البيانات والأفاتار
            return ctx.reply('• منشن المالكة ↤ @j4xa7\n• يوزر المالكة: j4xa7\n👑 المالكة الأساسية والمطورة للبوت.', { reply_to_message_id: ctx.message.message_id });
        } catch (e) {
            return ctx.reply('• منشن المالكة ↤ @j4xa7\n• يوزر المالكة: j4xa7', { reply_to_message_id: ctx.message.message_id });
        }
    }

    // أوامر Dev (Dev🎖️)
    if (text === 'قفل المخالفات') {
        if (userRankVal < getRankVal('dev')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
        }
        settings.violations = false;
        saveDB();
        return ctx.reply('• تم قفل المخالفات .', { reply_to_message_id: ctx.message.message_id });
    }
    if (text === 'فتح المخالفات') {
        if (userRankVal < getRankVal('dev')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
        }
        settings.violations = true;
        saveDB();
        return ctx.reply('• تم فتح المخالفات .', { reply_to_message_id: ctx.message.message_id });
    }
    if (text === 'قفل الشات') {
        if (userRankVal < getRankVal('dev')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
        }
        settings.chatOpen = false;
        saveDB();
        return ctx.reply('• تم قفل الشات بنجاح.', { reply_to_message_id: ctx.message.message_id });
    }
    if (text === 'فتح الشات') {
        if (userRankVal < getRankVal('dev')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
        }
        settings.chatOpen = true;
        saveDB();
        return ctx.reply('• تم فتح الشات بنجاح.', { reply_to_message_id: ctx.message.message_id });
    }
    if (text === 'تصفير التفاعل') {
        if (userRankVal < getRankVal('dev')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الشخص لتصفير تفاعله.');
        const targetId = ctx.message.reply_to_message.from.id;
        if (db.users[targetId]) {
            db.users[targetId].messages = 0;
            saveDB();
        }
        return ctx.reply('• تم تصفير تفاعل العضو .', { reply_to_message_id: ctx.message.message_id });
    }
    if (text.startsWith('اضف تفاعل') || text.startsWith('اضف 10000')) {
        if (userRankVal < getRankVal('dev')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على العضو لإضافة التفاعل.');
        const targetId = ctx.message.reply_to_message.from.id;
        db.users[targetId] = db.users[targetId] || { messages: 0 };
        db.users[targetId].messages += 10000;
        saveDB();
        return ctx.reply('• تم إضافة 10000 تفاعل للعضو .', { reply_to_message_id: ctx.message.message_id });
    }

    // أوامر الحماية والتحكم الفعلي (كتم، تقييد، طرد، حظر)
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

    if (text === 'عام') {
        if (userRankVal < getRankVal('myth_extra')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Myth 🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الشخص لكتمه عام.');
        const target = ctx.message.reply_to_message.from;
        const targetRank = getUserRank(target.id);
        if (getRankVal(targetRank) >= getRankVal('dev2')) {
            return ctx.reply('• لا يمكنك تطبيق الكتم العام على رتبة Dev²🎖️ أو أعلى!', { reply_to_message_id: ctx.message.message_id });
        }
        db.globalMutes[target.id] = true;
        saveDB();
        return ctx.reply(`• تم كتم المستخدم عام ↤ ｢ ${target.first_name} ｣`, { reply_to_message_id: ctx.message.message_id });
    }

    if (text === 'خخ') {
        if (userRankVal < getRankVal('myth_extra')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Myth 🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
        }
        const globalMutedIds = Object.keys(db.globalMutes);
        const count = globalMutedIds.length;
        if (count === 0) {
            return ctx.reply('• لا يوجد مكتومين عام ,', { reply_to_message_id: ctx.message.message_id });
        }
        db.globalMutes = {};
        saveDB();
        return ctx.reply(`• تم مسح ( ${count} ) من المكتومين عام`, { reply_to_message_id: ctx.message.message_id });
    }

    if (text === 'تقييد') {
        if (userRankVal < getRankVal('dev2')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev²🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الشخص.');
        const target = ctx.message.reply_to_message.from;
        try {
            await ctx.restrictChatMember(target.id, { permissions: { can_send_messages: false } });
            return ctx.reply(`• تم تقييد العضو ↤ ｢ ${target.first_name} ｣ فعلياً.`, { reply_to_message_id: ctx.message.message_id });
        } catch (e) {
            return ctx.reply('❌ عذراً، ليس لدي صلاحية تقييد الأعضاء في هذه المجموعة.');
        }
    }

    if (text === 'الغاء التقييد') {
        if (userRankVal < getRankVal('main_owner')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ المالك الأساسي ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الشخص.');
        const target = ctx.message.reply_to_message.from;
        try {
            await ctx.restrictChatMember(target.id, { permissions: { can_send_messages: true, can_send_media_messages: true, can_send_other_messages: true, can_add_web_page_previews: true } });
            return ctx.reply(`• تم إلغاء التقييد عن العضو ↤ ｢ ${target.first_name} ｣`, { reply_to_message_id: ctx.message.message_id });
        } catch (e) {
            return ctx.reply('❌ عذراً، ليس لدي الصلاحيات الكافية.');
        }
    }

    // رفع الرتب (مالك أساسي فما فوق)
    if (text === 'رفع مميز' || text === 'رفع مالك') {
        if (userRankVal < getRankVal('main_owner')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ المالك الأساسي ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على العضو.');
        const target = ctx.message.reply_to_message.from;
        const newRank = text.includes('مميز') ? 'member' : 'owner';
        db.users[target.id] = db.users[target.id] || { messages: 0 };
        db.users[target.id].rank = newRank;
        saveDB();
        return ctx.reply(`• تم رفع رتبة العضو ｢ ${target.first_name} ｣ إلى (${text.includes('مميز') ? 'مميز' : 'مالك'}) .`, { reply_to_message_id: ctx.message.message_id });
    }

    // نظام الهمسات (اهمس / همسه / ه)
    if (text === 'اهمس' || text === 'همسه' || text === 'ه') {
        return ctx.reply('• تم تحديد الهمسه لـ ↤ اضغط الزر لكتابة الهمسة', {
            reply_to_message_id: ctx.message.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'اهمس هنا', url: `https://t.me/${ctx.botInfo.username}?start=whisper_${chatId}` }]
                ]
            }
        });
    }

    // ألعاب التسلية: مقال
    if (text === 'مقال') {
        const questions = [
            { q: 'ما هي عاصمة المملكة العربية السعودية؟', a: 'الرياض' },
            { q: 'كم عدد ركعات صلاة المغرب؟', a: '3' },
            { q: 'ما هو اللون الناتج من دمج الازرق والأصفر؟', a: 'اخضر' }
        ];
        const randomQ = questions[Math.floor(Math.random() * questions.length)];
        db.activeGame = db.activeGame || {};
        db.activeGame[chatId] = { answer: randomQ.a, time: Date.now() };
        return ctx.reply(`🎯 تحدي السرعة (مقال):\n\n❓ ${randomQ.q}\n\n• اكتب الإجابة بسرعة لتحصل على 10 ريال وهمية!`);
    }

    // التحقق من إجابة اللعبة أو كتم العضو المحظور
    if (db.activeGame && db.activeGame[chatId] && db.activeGame[chatId].answer === text) {
        const gameData = db.activeGame[chatId];
        const timeTaken = ((Date.now() - gameData.time) / 1000).toFixed(1);
        db.users[userId].balance = (db.users[userId].balance || 0) + 10;
        delete db.activeGame[chatId];
        saveDB();
        return ctx.reply(`كفو 👏🏻\nصح عليك!\n\n⏱️ الوقت: ${timeTaken} ثانية\n🚀 السرعة ممتازة!\n💰 حصلت على: 10 ريال وهمية`, { reply_to_message_id: ctx.message.message_id });
    }

    // نظام الأغاني (يوت / بحث)
    if (text.startsWith('يوت ') || text.startsWith('بحث ')) {
        const query = text.replace(/^(يوت|بحث)\s+/, '');
        try {
            const searchResult = await yts(query);
            if (!searchResult || !searchResult.videos.length) {
                return ctx.reply('❌ لم يتم العثور على نتائج مطابقة.');
            }
            const video = searchResult.videos[0];
            await ctx.reply(`🎵 <b>${video.title}</b>\n⏱️ المدة: ${video.timestamp}\n• طلب بواسطة: <a href="tg://user?id=${userId}">${ctx.from.first_name}</a>`, {
                parse_mode: 'HTML',
                reply_to_message_id: ctx.message.message_id
            });
            // ملاحظة: لإرسال الصوت الفعلي يتم استخدام رابط التحميل المباشر وتليجرام sendAudio
        } catch (e) {
            return ctx.reply('❌ حدث خطأ أثناء البحث عن الأغنية.');
        }
    }

    // فحص الكتم العام والمحلي لحذف الرسالة
    if (db.globalMutes[userId] || (db.mutes[chatId] && db.mutes[chatId].includes(userId))) {
        await ctx.deleteMessage().catch(() => {});
        return;
    }

    return next();
});

// تشغيل البوت
bot.launch().then(() => {
    console.log('🤖 Bot Toraif is successfully running and connected to Telegram!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
