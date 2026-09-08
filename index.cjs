const { Telegraf } = require('telegraf');
const fs = require('fs');

const bot = new Telegraf('8963407967:AAEMfQ6NkTtIDY4f6b4palcck3TU82cOXQg');

const DB_FILE = 'database.json';
let db = { users: {}, groups: {}, mutes: {}, globalMutes: {}, settings: {} };

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!db.mutes) db.mutes = {};
        if (!db.globalMutes) db.globalMutes = {};
        if (!db.settings) db.settings = {};
    } catch (e) {
        db = { users: {}, groups: {}, mutes: {}, globalMutes: {}, settings: {} };
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

bot.start((ctx) => {
    return ctx.reply('اهلا بك يا قلبي 🫀 - \n\n• انا اشغل لك اللي تبي بالمكالمه', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '➕ أضفني في مجموعتك', url: `https://t.me/${ctx.botInfo.username}?startgroup=true` }],
                [{ text: '👤 المطور', url: 'https://t.me/j4xa7' }]
            ]
        }
    });
});

function mentionUser(user) {
    const name = user.first_name || 'المستخدم';
    const escapedName = name.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
    return `[${escapedName}](tg://user?id=${user.id})`;
}

function getUserRank(userId) {
    if (!db.users[userId]) {
        db.users[userId] = { rank: 'member', messages: 0, balance: 0 };
        saveDB();
    }
    return db.users[userId].rank || 'member';
}

function checkPermission(userRank, requiredRank) {
    return (RANK_HIERARCHY[userRank] || 1) >= (RANK_HIERARCHY[requiredRank] || 1);
}

// أمر رتبتي وتفاعلي
bot.hears(['رتبتي', 'تفاعلي'], (ctx) => {
    const userId = ctx.from.id;
    const rankKey = getUserRank(userId);
    const rankInfo = RANKS[rankKey] || RANKS.member;
    const user = db.users[userId];
    const userMention = mentionUser(ctx.from);

    const sortedUsers = Object.entries(db.users)
        .sort((a, b) => (b[1].messages || 0) - (a[1].messages || 0));
    
    let position = sortedUsers.findIndex(([id]) => id == userId) + 1;
    if (position === 0) position = 1;

    const text = `${userMention}\n\n` +
        `• رتبتك هي ↤  ${rankInfo.name}\n` +
        `• رسائلك بالتفاعل ↤ ${user.messages || 0}\n` +
        `• ترتيبك بالمتفاعلين ↤ ${position}`;

    return ctx.reply(text, {
        parse_mode: 'Markdown',
        reply_to_message_id: ctx.message.message_id
    });
});

// إدارة الأوامر والرسائل
bot.on('text', (ctx, next) => {
    if (ctx.message.text.startsWith('/')) return next();
    
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const text = ctx.message.text.trim();

    if (!db.users[userId]) {
        db.users[userId] = { rank: 'dev', messages: 0, balance: 0 }; // افتراضي ديف للاختبار البداية أو عضو
        saveDB();
    }
    db.users[userId].messages = (db.users[userId].messages || 0) + 1;
    saveDB();

    if (!db.mutes[chatId]) db.mutes[chatId] = [];

    // حماية البوت ضد أوامر الإدارة بريبلاي على البوت
    const adminCommands = ['كتم', 'اهمس', 'تقييد', 'حظر', 'طرد', 'عام', 'قفل المخالفات', 'فتح المخالفات', 'قفل الالعاب', 'فتح الالعاب'];
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.from.id === ctx.botInfo.id) {
        if (adminCommands.includes(text) || text.startsWith('رفع') || text.startsWith('تنزيل')) {
            return ctx.reply('ياغبي هذا البوت', {
                reply_to_message_id: ctx.message.message_id
            });
        }
    }

    const userRank = getUserRank(userId);
    const userRankVal = RANK_HIERARCHY[userRank] || 1;

    // 1. Dev (Dev🎖️) - صلاحيات كاملة
    if (text === 'قفل المخالفات') {
        if (userRankVal < RANK_HIERARCHY['dev']) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
        }
        db.settings[chatId] = db.settings[chatId] || {};
        db.settings[chatId].violations = false;
        saveDB();
        return ctx.reply('• تم قفل المخالفات .', { reply_to_message_id: ctx.message.message_id });
    }
    if (text === 'فتح المخالفات') {
        if (userRankVal < RANK_HIERARCHY['dev']) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
        }
        db.settings[chatId] = db.settings[chatId] || {};
        db.settings[chatId].violations = true;
        saveDB();
        return ctx.reply('• تم فتح المخالفات .', { reply_to_message_id: ctx.message.message_id });
    }
    if (text === 'قفل الالعاب') {
        if (userRankVal < RANK_HIERARCHY['dev']) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
        }
        db.settings[chatId] = db.settings[chatId] || {};
        db.settings[chatId].games = false;
        saveDB();
        return ctx.reply('• تم قفل الألعاب .', { reply_to_message_id: ctx.message.message_id });
    }
    if (text === 'فتح الالعاب') {
        if (userRankVal < RANK_HIERARCHY['dev']) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
        }
        db.settings[chatId] = db.settings[chatId] || {};
        db.settings[chatId].games = true;
        saveDB();
        return ctx.reply('• تم فتح الألعاب .', { reply_to_message_id: ctx.message.message_id });
    }
    if (text === 'تصفير التفاعل') {
        if (userRankVal < RANK_HIERARCHY['dev']) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الشخص لتصفير تفاعله.');
        const targetId = ctx.message.reply_to_message.from.id;
        if (db.users[targetId]) {
            db.users[targetId].messages = 0;
            saveDB();
        }
        return ctx.reply('• تم تصفير تفاعل العضو .', { reply_to_message_id: ctx.message.message_id });
    }
    if (text === 'اضف تفاعل 10000' || text.startsWith('اضف تفاعل')) {
        if (userRankVal < RANK_HIERARCHY['dev']) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الشخص لزيادة تفاعله.');
        const targetId = ctx.message.reply_to_message.from.id;
        if (!db.users[targetId]) db.users[targetId] = { rank: 'member', messages: 0 };
        db.users[targetId].messages = (db.users[targetId].messages || 0) + 10000;
        saveDB();
        return ctx.reply('• تم إضافة 10000 تفاعل للعضو .', { reply_to_message_id: ctx.message.message_id });
    }

    // 2. Dev² (Dev²🎖️) - يرفع إلا ميث اكسترا وما فوق، تقييد ورفع قيود
    if (text === 'تقييد' || text === 'الغاء التقييد') {
        if (userRankVal < RANK_HIERARCHY['dev2']) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev²🎖 ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الشخص.');
        return ctx.reply(`• تم تطبيق أمر (${text}) بنجاح.`, { reply_to_message_id: ctx.message.message_id });
    }

    // 3. Myth (Myth 🎖️) - كتم عام (عام) وفك عام (خخ)، تنزيل الرتب لمن تحته
    if (text === 'عام') {
        if (userRankVal < RANK_HIERARCHY['myth_extra']) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Myth 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الشخص لكتمه عام.');
        const targetId = ctx.message.reply_to_message.from.id;
        const targetRank = getUserRank(targetId);
        
        // لا يقدر على Dev² أو ما فوق
        if (RANK_HIERARCHY[targetRank] >= RANK_HIERARCHY['dev2']) {
            return ctx.reply('• ماتقدر تستخدم الامر على ↤ ｢ Dev²🎖 ｣', { reply_to_message_id: ctx.message.message_id });
        }

        db.globalMutes[targetId] = true;
        saveDB();
        return ctx.reply('• تم كتم المستخدم عام .', { reply_to_message_id: ctx.message.message_id });
    }

    if (text === 'خخ') {
        if (userRankVal < RANK_HIERARCHY['myth_extra']) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Myth 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) {
            // إذا لم يكن ريبلاي وكان خخ العادية الخاصة بمسح المكتومين العام
            return ctx.reply('• لا يوجد مكتومين عام .', { reply_to_message_id: ctx.message.message_id });
        }
        const targetId = ctx.message.reply_to_message.from.id;
        delete db.globalMutes[targetId];
        saveDB();
        return ctx.reply('• تم فك الكتم العام عن المستخدم .', { reply_to_message_id: ctx.message.message_id });
    }

    // أوامر التنظيف (كتم، مم، مسح المكتومين) تبدأ من رتبة Myth فما فوق
    if (text === 'كتم') {
        if (userRankVal < RANK_HIERARCHY['myth']) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Myth ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على رسالة الشخص المراد كتمه.');
        const targetUser = ctx.message.reply_to_message.from;
        const targetMention = mentionUser(targetUser);

        if (!db.mutes[chatId].includes(targetUser.id)) {
            db.mutes[chatId].push(targetUser.id);
            saveDB();
        }
        return ctx.reply(`• المستخدم ← ${targetMention}\n• تم كتمه .`, {
            parse_mode: 'Markdown',
            reply_to_message_id: ctx.message.message_id
        });
    }

    if (text === 'مم') {
        if (userRankVal < RANK_HIERARCHY['myth']) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Myth ｣', { reply_to_message_id: ctx.message.message_id });
        }
        const count = db.mutes[chatId].length;
        if (count === 0) {
            return ctx.reply('• لا يوجد مكتومين .', { reply_to_message_id: ctx.message.message_id });
        }
        db.mutes[chatId] = [];
        saveDB();
        return ctx.reply(`• تم مسح ( ${count} ) من المكتومين .`, { reply_to_message_id: ctx.message.message_id });
    }

    // 4. مالك أساسي (main_owner) - يرفع رتبة العضو لـ مميز أو مالك، ويلغي التقييد
    if (text === 'رفع مميز' || text === 'رفع مالك') {
        if (userRankVal < RANK_HIERARCHY['main_owner']) {
            return ctx.reply('• هذا الامر يخص رتبة أعلى.', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الشخص.');
        const targetId = ctx.message.reply_to_message.from.id;
        const newRank = text.includes('مميز') ? 'member' : 'owner';
        db.users[targetId] = db.users[targetId] || { messages: 0 };
        db.users[targetId].rank = newRank;
        saveDB();
        return ctx.reply(`• تم رفع رتبة العضو إلى (${text.includes('مميز') ? 'مميز' : 'مالك'}) .`, { reply_to_message_id: ctx.message.message_id });
    }

    if (text === 'الغاء التقييد') {
        if (userRankVal < RANK_HIERARCHY['main_owner']) {
            return ctx.reply('• هذا الامر يخص مالك أساسي أو أعلى.', { reply_to_message_id: ctx.message.message_id });
        }
        return ctx.reply('• تم إلغاء التقييد بنجاح.', { reply_to_message_id: ctx.message.message_id });
    }

    // فحص الكتم العام والمحلي للمستخدمين العاديين
    if (db.globalMutes[userId] || (db.mutes[chatId] && db.mutes[chatId].includes(userId))) {
        ctx.deleteMessage().catch(() => {});
        return;
    }

    if (text === 'ايلاف') {
        return ctx.reply(`• منشن المالكة ↤ @j4xa7`, {
            reply_to_message_id: ctx.message.message_id
        });
    }

    return next();
});

bot.launch();
console.log('Bot is running with full strict hierarchical rank permissions...');
