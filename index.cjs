const { Telegraf } = require('telegraf');
const fs = require('fs');

const bot = new Telegraf('8963407967:AAEMfQ6NkTtIDY4f6b4palcck3TU82cOXQg');

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
    return ctx.reply('اهلا بك يا قلبي 🫀 - \n\n• انا اشغل لك اللي تبي بالمكالمه\n\nادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '➕ أضفني في مجموعتك', url: `https://t.me/${ctx.botInfo.username}?startgroup=true` }],
                [{ text: '👤 المطور', url: 'https://t.me/j4xa7' }]
            ]
        }
    });
});

// أمر رتبتي وتفاعلي بالشكل المطلوب
bot.hears(['رتبتي', 'تفاعلي'], (ctx) => {
    const userId = ctx.from.id;
    
    if (!db.users[userId]) {
        db.users[userId] = { rank: 'dev', messages: 1, balance: 0 };
        saveDB();
    }
    
    const user = db.users[userId];
    const rankInfo = RANKS[user.rank] || RANKS.member;
    const name = ctx.from.first_name || 'المستخدم';

    const sortedUsers = Object.entries(db.users)
        .sort((a, b) => (b[1].messages || 0) - (a[1].messages || 0));
    
    let position = sortedUsers.findIndex(([id]) => id == userId) + 1;
    if (position === 0) position = 1;

    const text = `${name}\nرتبتي\n\n` +
        `🏅 رتبتك هي ↤ ${rankInfo.name}\n` +
        `• رسائلك بالتفاعل ↤ ${user.messages}\n` +
        `• ترتيبك بالمتفاعلين ↤ ${position}`;

    return ctx.reply(text, {
        reply_to_message_id: ctx.message.message_id
    });
});

// أمر المتفاعلين
bot.hears('المتفاعلين', (ctx) => {
    const sortedUsers = Object.entries(db.users)
        .sort((a, b) => (b[1].messages || 0) - (a[1].messages || 0))
        .slice(0, 20);

    if (sortedUsers.length === 0) {
        return ctx.reply('قائمة المتفاعلين فارغة حالياً.');
    }

    let text = 'توب اكثر 20 متفاعلين بالقروب :\n___________________\n\n';
    
    sortedUsers.forEach(([id, data], index) => {
        let medal = `${index + 1} )`;
        if (index === 0) medal = '🥇 )';
        else if (index === 1) medal = '🥈 )';
        else if (index === 2) medal = '🥉 )';

        text += `${medal} ${data.messages || 0} | مستخدم\n`;
    });

    return ctx.reply(text);
});

// الاستجابة للكلمات والأوامر القصيرة (مم، خخ، كتم، الأوامر، إلخ)
bot.on('text', (ctx, next) => {
    if (ctx.message.text.startsWith('/')) return next();
    
    const userId = ctx.from.id;
    if (!db.users[userId]) {
        db.users[userId] = { rank: 'dev', messages: 0, balance: 0 };
    }
    db.users[userId].messages = (db.users[userId].messages || 0) + 1;
    saveDB();

    const text = ctx.message.text.trim();

    // الرد على الكلمات المحددة التي ذكرتيها
    if (text === 'مم') {
        return ctx.reply('مماتك العافية يا قلبي، تفضل آمرني بشيء؟');
    }
    if (text === 'خخ' || text === 'هههه' || text === 'ههه') {
        return ctx.reply('دوم هالضحكة يارب 🤍');
    }
    if (text === 'كتم') {
        return ctx.reply('عذراً، يحتاج استخدام أمر الكتم صلاحيات إدارية (قريباً سيتم تفعيله بالكامل).');
    }
    if (text === 'الأوامر' || text === 'قائمة الاوامر') {
        return ctx.reply('📜 **قائمة أوامر تورايف:**\n\n• رتبتي / تفاعلي : لعرض رتبتك وتفاعلك\n• المتفاعلين : لعرض توب المتفاعلين\n• ايلاف : منشن المالكة\n• تورايف / بوت : للتحدث مع البوت');
    }

    if (text === 'ايلاف') {
        return ctx.reply(`• منشن المالكة ↤ @j4xa7`, {
            reply_to_message_id: ctx.message.message_id
        });
    }

    if (text.startsWith('تورايف') || text.startsWith('بوت')) {
        const replies = ['هلا', 'عيوني', 'امر', 'وش بغيت', 'ها', 'عيون ايفي'];
        if (text.includes('ايلاف')) {
            return ctx.reply('إلاف هي مالكة ومبرمجة البوت الأبدية وأجمل شخص بالدنيا 😭💗');
        }
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        return ctx.reply(randomReply);
    }

    return next();
});

bot.launch();
console.log('Bot is running with full commands support...');
