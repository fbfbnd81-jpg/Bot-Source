const { Telegraf } = require('telegraf');
const fs = require('fs');

const bot = new Telegraf('8963407967:AAEMfQ6NkTtIDY4f6b4palcck3TU82cOXQg');

// ملف قاعدة البيانات لحفظ الرتب والتفاعل
const DB_FILE = 'database.json';
let db = { users: {}, groups: {} };

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        db = { users: {}, groups: {} };
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// تعريف الرتب وتدرجها الصارم (من الأقل للأعلى)
const RANKS = {
    member: { id: 1, name: 'مميز', badge: '⭐' },
    owner: { id: 2, name: 'مالك', badge: '🛡️' },
    main_owner: { id: 3, name: 'مالك أساسي', badge: '👑' },
    myth: { id: 4, name: 'Myth', badge: '🎖️' },
    myth_extra: { id: 5, name: 'Myth 🎖️', badge: '🎖️✨' },
    dev2: { id: 6, name: 'Dev²🎖️', badge: '🎖️⭐' },
    dev: { id: 7, name: 'Dev🎖️', badge: '🔥' }
};

function getUserRank(userId) {
    if (!db.users[userId]) {
        db.users[userId] = { rank: 'member', messages: 0, balance: 0 };
        saveDB();
    }
    return db.users[userId].rank;
}

function checkHierarchy(actorRankKey, targetRankKey) {
    const actorLevel = RANKS[actorRankKey]?.id || 1;
    const targetLevel = RANKS[targetRankKey]?.id || 1;
    return actorLevel > targetLevel;
}

// أمر /start الواجهة
bot.start((ctx) => {
    return ctx.reply('اهلا بك يا قلبي 🫀 - \n\n• انا اشغل لك اللي تبي بالمكالمه\n\nادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '➕ أضفني في مجموعتك', url: `https://t.me/${ctx.botInfo.username}?startgroup=true` }],
                [{ text: '👤 المطور', url: 'https://t.me/j4xa7' }]
            ]
        }
    });
});

// أمر رتبتي الحقيقي والديناميكي
bot.hears(['رتبتي', 'تفاعلي'], (ctx) => {
    const userId = ctx.from.id;
    const user = db.users[userId] || { rank: 'member', messages: 5, balance: 0 };
    const rankInfo = RANKS[user.rank] || RANKS.member;

    const name = ctx.from.first_name || 'المستخدم';
    
    // حساب الترتيب بين المتفاعلين
    const sortedUsers = Object.entries(db.users)
        .sort((a, b) => (b[1].messages || 0) - (a[1].messages || 0));
    
    let position = sortedUsers.findIndex(([id]) => id == userId) + 1;
    if (position === 0) position = 1;

    const text = `${name}\nرتبتي\n\n` +
        `🏅 رتبتك هي ↤ ${rankInfo.name}\n` +
        `• رسائلك بالتفاعل ↤ ${user.messages || 5}\n` +
        `• ترتيبك بالمتفاعلين ↤ ${position}`;

    return ctx.reply(text);
});

// نظام الرد التلقائي وحساب التفاعل والرسائل
bot.on('text', (ctx, next) => {
    if (ctx.message.text.startsWith('/')) return next();
    
    const userId = ctx.from.id;
    if (!db.users[userId]) {
        db.users[userId] = { rank: 'dev', messages: 0, balance: 0 }; // اجعل حسابك Dev للتجربة
    }
    db.users[userId].messages = (db.users[userId].messages || 0) + 1;
    saveDB();

    const text = ctx.message.text.trim();

    // الرد على كلمة ايلاف
    if (text === 'ايلاف') {
        return ctx.reply(`• منشن المالكة ↤ @j4xa7`, {
            reply_to_message_id: ctx.message.message_id
        });
    }

    // الرد على اسم البوت
    if (text.startsWith('تورايف') || text.startsWith('بوت')) {
        const replies = ['هلا', 'عيوني', 'امر', 'وش بغيت', 'ها', 'عيون ايفي'];
        if (text.includes('ايلاف')) {
            return ctx.reply('إلاف هي مالكة ومبرمجة البوت الأبدية وأجمل شخص بالدنيا 😭💗');
        }
        if (text.includes('ماتشا')) {
            return ctx.reply('عشان تسوي ماتشا صح: اخلطي بودرة الماتشا مع موية حارة بالنشارة، وضعي حليب بارد ومكعبات ثلج وعسل حسب الرغبة بالعافية!');
        }
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        return ctx.reply(randomReply);
    }

    return next();
});

bot.launch();
console.log('Bot with Rank System is running...');
