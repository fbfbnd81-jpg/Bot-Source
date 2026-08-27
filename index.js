const { Telegraf } = require('telegraf');
const http = require('http');
const fs = require('fs');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf('8963407967:AAEjxoIl2MYDghsdSVsAcWCEYRGrTqa_GS8');

const antiSpamEnabled = {};
const mutedUsers = {};       
const globalMutedUsers = {}; 

const DATA_FILE = './bot_database.json';
let db = { roles: {}, stats: {} };

if (fs.existsSync(DATA_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (!db.roles) db.roles = {};
        if (!db.stats) db.stats = {};
    } catch (e) {}
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    } catch (e) {}
}

function getUserRole(chatId, userId, username) {
    if (db.roles[chatId] && db.roles[chatId][userId]) {
        return db.roles[chatId][userId];
    }
    // تم إضافة يوزراتكم هنا عشان تثبت الرتبة فوراً وما ترجع "عضو"
    const devOnes = ['j4xa7', 'to6ri', 'evy', 'evelaf', 'i_evy', 'evyyytoiry'];
    if (username && devOnes.includes(username.toLowerCase())) {
        return 'Dev🎖️';
    }
    return 'عضو';
}

const roleHierarchy = {
    'عضو': 0,
    'مميز': 1,
    'مالك': 2,
    'مالك اساسي': 3,
    'myth': 4,
    'Myth🎖️': 5,
    'Dev 2': 6,
    'Dev🎖️': 7
};

function hasPermission(userRole, requiredRole) {
    return (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
}

bot.on('message', async (ctx) => {
    try {
        if (!ctx.message || !ctx.chat || ctx.chat.type === 'private') return;
        if (!ctx.from || ctx.from.is_bot) return;

        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        const username = ctx.from.username || '';
        const name = ctx.from.first_name || 'المستخدم';
        const role = getUserRole(chatId, userId, username);
        const text = (ctx.message.text || ctx.message.caption || '').trim();

        // احتساب وتخزين الرسائل والتفاعل
        if (!db.stats[chatId]) db.stats[chatId] = {};
        if (!db.stats[chatId][userId]) {
            db.stats[chatId][userId] = { count: 0, name: name, username: username };
        }
        db.stats[chatId][userId].count += 1;
        db.stats[chatId][userId].name = name;
        saveData();

        if (text === 'رتبتي' || text === '/رتبتي') {
            return ctx.reply(`• رتبتك هي ⟵ ｢ ${role} ｣`, { reply_to_message_id: ctx.message.message_id });
        }

        // أمر تفاعلي (مصلح بالكامل عشان ما يعلق)
        if (text === 'تفاعلي') {
            const userGroupStats = db.stats[chatId] || {};
            const sortedUsers = Object.entries(userGroupStats)
                .sort((a, b) => b[1].count - a[1].count);

            let userRank = sortedUsers.findIndex(item => item[0] == userId) + 1;
            let userMessages = userGroupStats[userId] ? userGroupStats[userId].count : 0;
            if (userRank === 0) userRank = sortedUsers.length + 1;

            const replyText = `• رتبتك هي ⟵ ${role}\n\n` +
                              `• رسائلك بالتفاعل ⟵ ${userMessages}\n` +
                              `• ترتيبك بالمتفاعلين ⟵ ${userRank}\n-`;
            
            return ctx.reply(replyText, { reply_to_message_id: ctx.message.message_id });
        }

        // أمر المتفاعلين (توب 20 بالشكل النظيف المطلوب)
        if (text === 'المتفاعلين' || text === 'قائمة المتفاعلين') {
            const userGroupStats = db.stats[chatId];
            if (!userGroupStats || Object.keys(userGroupStats).length === 0) {
                return ctx.reply('• لا يوجد تفاعلات مسجلة حتى الآن.', { reply_to_message_id: ctx.message.message_id });
            }

            const sortedUsers = Object.entries(userGroupStats)
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 20);

            let msg = 'توب اكثر 20 متفاعلين بالقروب :\n_________________________\n\n';
            sortedUsers.forEach(([id, data], index) => {
                const formattedCount = data.count.toLocaleString();
                const mention = `[${data.name}](tg://user?id=${id})`;
                msg += `${index + 1} ) ${formattedCount} | ${mention}\n`;
            });

            return ctx.reply(msg, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'توري') {
            return ctx.reply('• توري ⟵ @to6ri', { reply_to_message_id: ctx.message.message_id });
        }
        if (text === 'ايفي' || text === 'ايلاف') {
            return ctx.reply('• المطور ⟵ @j4xa7', { reply_to_message_id: ctx.message.message_id });
        }
        if (text === 'تورايف') {
            const replies = ['عيوني', 'أمر؟', 'سم', 'وش بغيت؟', 'عيون ايفي وتوري', 'هلا'];
            const randomReply = replies[Math.floor(Math.random() * replies.length)];
            return ctx.reply(randomReply, { reply_to_message_id: ctx.message.message_id });
        }

    } catch (e) {}
});

bot.launch();
