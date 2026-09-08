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

function getRankVal(rankKey) {
    return RANK_HIERARCHY[rankKey] || 1;
}

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

function getUserRank(userId) {
    if (!db.users[userId]) {
        db.users[userId] = { rank: 'dev', messages: 0, balance: 0 };
        saveDB();
    }
    return db.users[userId].rank || 'dev';
}

bot.hears(['رتبتي', 'تفاعلي'], (ctx) => {
    const userId = ctx.from.id;
    const rankKey = getUserRank(userId);
    const rankInfo = RANKS[rankKey] || RANKS.member;
    const user = db.users[userId];

    const sortedUsers = Object.entries(db.users)
        .sort((a, b) => (b[1].messages || 0) - (a[1].messages || 0));
    
    let position = sortedUsers.findIndex(([id]) => id == userId) + 1;
    if (position === 0) position = 1;

    const text = `• رتبتك هي ↤  ${rankInfo.name}\n` +
        `• رسائلك بالتفاعل ↤ ${user.messages || 0}\n` +
        `• ترتيبك بالمتفاعلين ↤ ${position}`;

    return ctx.reply(text, {
        reply_to_message_id: ctx.message.message_id
    });
});

bot.on('text', (ctx, next) => {
    if (ctx.message.text.startsWith('/')) return next();
    
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const text = ctx.message.text.trim();

    if (!db.users[userId]) {
        db.users[userId] = { rank: 'dev', messages: 0, balance: 0 };
        saveDB();
    }
    db.users[userId].messages = (db.users[userId].messages || 0) + 1;
    saveDB();

    if (!db.mutes[chatId]) db.mutes[chatId] = [];

    const adminCommands = ['كتم', 'اهمس', 'تقييد', 'حظر', 'طرد', 'عام', 'قفل المخالفات', 'فتح المخالفات', 'قفل الالعاب', 'فتح الالعاب', 'رفع مميز', 'رفع مالك'];
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.from.id === ctx.botInfo.id) {
        if (adminCommands.some(cmd => text.startsWith(cmd))) {
            return ctx.reply('ياغبي هذا البوت', {
                reply_to_message_id: ctx.message.message_id
            });
        }
    }

    const userRank = getUserRank(userId);
    const userRankVal = getRankVal(userRank);

    if (text === 'قفل المخالفات') {
        if (userRankVal < getRankVal('dev')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
        }
        db.settings[chatId] = db.settings[chatId] || {};
        db.settings[chatId].violations = false;
        saveDB();
        return ctx.reply('• تم قفل المخالفات .', { reply_to_message_id: ctx.message.message_id });
    }
    if (text === 'فتح المخالفات') {
        if (userRankVal < getRankVal('dev')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
        }
        db.settings[chatId] = db.settings[chatId] || {};
        db.settings[chatId].violations = true;
        saveDB();
        return ctx.reply('• تم فتح المخالفات .', { reply_to_message_id: ctx.message.message_id });
    }
    if (text === 'قفل الالعاب') {
        if (userRankVal < getRankVal('dev')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
        }
        db.settings[chatId] = db.settings[chatId] || {};
        db.settings[chatId].games = false;
        saveDB();
        return ctx.reply('• تم قفل الألعاب .', { reply_to_message_id: ctx.message.message_id });
    }
    if (text === 'فتح الالعاب') {
        if (userRankVal < getRankVal('dev')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
        }
        db.settings[chatId] = db.settings[chatId] || {};
        db.settings[chatId].games = true;
        saveDB();
        return ctx.reply('• تم فتح الألعاب .', { reply_to_message_id: ctx.message.message_id });
    }
    if (text === 'تصفير التفاعل') {
        if (userRankVal < getRankVal('dev')) {
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
        if (userRankVal < getRankVal('dev')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الشخص لزيادة تفاعله.');
        const targetId = ctx.message.reply_to_message.from.id;
        if (!db.users[targetId]) db.users[targetId] = { rank: 'member', messages: 0 };
        db.users[targetId].messages = (db.users[targetId].messages || 0) + 10000;
        saveDB();
        return ctx.reply('• تم إضافة 10000 تفاعل للعضو .', { reply_to_message_id: ctx.message.message_id });
    }

    if (text === 'تقييد' || text === 'الغاء التقييد') {
        if (userRankVal < getRankVal('dev2')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Dev²🎖 ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الشخص.');
        return ctx.reply(`• تم تطبيق أمر (${text}) بنجاح.`, { reply_to_message_id: ctx.message.message_id });
    }

    if (text === 'عام') {
        if (userRankVal < getRankVal('myth_extra')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Myth 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الشخص لكتمه عام.');
        const targetId = ctx.message.reply_to_message.from.id;
        const targetRank = getUserRank(targetId);
        
        if (getRankVal(targetRank) >= getRankVal('dev2')) {
            return ctx.reply('• ماتقدر تستخدم الامر على ↤ ｢ Dev²🎖 ｣', { reply_to_message_id: ctx.message.message_id });
        }

        db.globalMutes[targetId] = true;
        saveDB();
        return ctx.reply('• تم كتم المستخدم عام .', { reply_to_message_id: ctx.message.message_id });
    }

    if (text === 'خخ') {
        if (userRankVal < getRankVal('myth_extra')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Myth 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) {
            return ctx.reply('• لا يوجد مكتومين عام .', { reply_to_message_id: ctx.message.message_id });
        }
        const targetId = ctx.message.reply_to_message.from.id;
        delete db.globalMutes[targetId];
        saveDB();
        return ctx.reply('• تم فك الكتم العام عن المستخدم .', { reply_to_message_id: ctx.message.message_id });
    }

    if (text === 'كتم') {
        if (userRankVal < getRankVal('myth')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ Myth ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على رسالة الشخص المراد كتمه.');
        const targetUser = ctx.message.reply_to_message.from;
        if (!db.mutes[chatId].includes(targetUser.id)) {
            db.mutes[chatId].push(targetUser.id);
            saveDB();
        }
        return ctx.reply(`• تم كتم المستخدم .`, { reply_to_message_id: ctx.message.message_id });
    }

    if (text === 'مم') {
        if (userRankVal < getRankVal('myth')) {
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

    if (text === 'رفع مميز' || text === 'رفع مالك') {
        if (userRankVal < getRankVal('main_owner')) {
            return ctx.reply('• هذا الامر يخص ↤ ｢ المالك الأساسي ｣', { reply_to_message_id: ctx.message.message_id });
        }
        if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الشخص.');
        const targetId = ctx.message.reply_to_message.from.id;
        const newRank = text.includes('مميز') ? 'member' : 'owner';
        db.users[targetId] = db.users[targetId] || { messages: 0 };
        db.users[targetId].rank = newRank;
        saveDB();
        return ctx.reply(`• تم رفع رتبة العضو إلى (${text.includes('مميز') ? 'مميز' : 'مالك'}) .`, { reply_to_message_id: ctx.message.message_id });
    }

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
console.log('Bot is running successfully!');
