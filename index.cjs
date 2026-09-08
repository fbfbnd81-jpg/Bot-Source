const { Telegraf } = require('telegraf');
const fs = require('fs');

const bot = new Telegraf('8963407967:AAEMfQ6NkTtIDY4f6b4palcck3TU82cOXQg');

const DB_FILE = 'database.json';
let db = { users: {}, groups: {}, mutes: {} };

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!db.mutes) db.mutes = {};
    } catch (e) {
        db = { users: {}, groups: {}, mutes: {} };
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

// دالة مساعدة لعمل منشن حقيقي للشخص (Markdown)
function mentionUser(user) {
    const name = user.first_name || 'المستخدم';
    const escapedName = name.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
    return `[${escapedName}](tg://user?id=${user.id})`;
}

// أمر رتبتي وتفاعلي بالشكل المطلوب تماماً مع منشن الحساب
bot.hears(['رتبتي', 'تفاعلي'], (ctx) => {
    const userId = ctx.from.id;
    
    if (!db.users[userId]) {
        db.users[userId] = { rank: 'dev', messages: 1, balance: 0 };
        saveDB();
    }
    
    const user = db.users[userId];
    const rankInfo = RANKS[user.rank] || RANKS.member;
    const userMention = mentionUser(ctx.from);

    const sortedUsers = Object.entries(db.users)
        .sort((a, b) => (b[1].messages || 0) - (a[1].messages || 0));
    
    let position = sortedUsers.findIndex(([id]) => id == userId) + 1;
    if (position === 0) position = 1;

    const text = `${userMention}\nرتبتي\n\n` +
        `• رتبتك هي ↤ 「 ${rankInfo.badge} ${rankInfo.name} 」\n` +
        `• رسائلك بالتفاعل ↤ ${user.messages}\n` +
        `• ترتيبك بالمتفاعلين ↤ ${position}`;

    return ctx.reply(text, {
        parse_mode: 'Markdown',
        reply_to_message_id: ctx.message.message_id
    });
});

// أوامر الكتم ومسح المكتومين
bot.on('text', (ctx, next) => {
    if (ctx.message.text.startsWith('/')) return next();
    
    const userId = ctx.from.id;
    if (!db.users[userId]) {
        db.users[userId] = { rank: 'dev', messages: 0, balance: 0 };
    }
    db.users[userId].messages = (db.users[userId].messages || 0) + 1;
    saveDB();

    const text = ctx.message.text.trim();
    const chatId = ctx.chat.id;

    if (!db.mutes[chatId]) db.mutes[chatId] = [];

    // أمر كتم (إذا كان برد على شخص)
    if (text === 'كتم') {
        if (!ctx.message.reply_to_message) {
            return ctx.reply('• يجب الرد على رسالة الشخص المراد كتمه.');
        }
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

    // أمر مم (مسح المكتومين)
    if (text === 'مم') {
        const count = db.mutes[chatId].length;
        if (count === 0) {
            return ctx.reply('• لا يوجد مكتومين .', { reply_to_message_id: ctx.message.message_id });
        }
        db.mutes[chatId] = [];
        saveDB();
        return ctx.reply(`• تم مسح ( ${count} ) من المكتومين .`, { reply_to_message_id: ctx.message.message_id });
    }

    // أمر خخ (مسح المكتومين عام)
    if (text === 'خخ') {
        return ctx.reply('• لا يوجد مكتومين عام .', { reply_to_message_id: ctx.message.message_id });
    }

    // منع المكتومين من التكلم
    if (db.mutes[chatId] && db.mutes[chatId].includes(userId)) {
        ctx.deleteMessage().catch(() => {});
        return;
    }

    if (text === 'ايلاف') {
        const userMention = mentionUser(ctx.from);
        return ctx.reply(`• منشن المالكة ↤ @j4xa7`, {
            reply_to_message_id: ctx.message.message_id
        });
    }

    return next();
});

bot.launch();
console.log('Bot is running with exact formats and mentions...');
