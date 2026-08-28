const { Telegraf } = require('telegraf');
const http = require('http');
const fs = require('fs');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Toraif Bot is active!');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf('8963407967:AAHnqGEd7ft6JPeEQ_97R_cj284V3kJJhng');

const mutedUsers = {};       
const globalMutedUsers = {}; 
const groupSettings = {}; 
const userMessageTimestamps = {}; 

const DATA_FILE = './toraif_github_database.json';
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

// حسابك يثبت كـ Dev🎖️ (الديف ون) وما ينزل أبداً
function getUserRole(chatId, userId, username) {
    if (username && username.toLowerCase() === 'j4xa7') {
        return 'Dev🎖️';
    }
    if (db.roles[chatId] && db.roles[chatId][userId]) {
        return db.roles[chatId][userId];
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
    'Dev²🎖': 6,
    'Dev🎖️': 7,
    'Dev1_Super': 8
};

function hasPermission(userRole, requiredRole) {
    return (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
}

bot.on('message', async (ctx) => {
    try {
        if (!ctx.chat) return;
        
        const isChannel = ctx.chat.type === 'channel';
        const chatId = ctx.chat.id;
        const userId = ctx.from ? ctx.from.id : chatId;
        const username = ctx.from && ctx.from.username ? ctx.from.username : '';
        const name = ctx.from && ctx.from.first_name ? ctx.from.first_name : 'المستخدم';
        const role = isChannel ? 'Dev🎖️' : getUserRole(chatId, userId, username);
        const text = (ctx.message.text || ctx.message.caption || '').trim();
        const isEdited = !!ctx.update.edited_message;
        const mention = `[${name}](tg://user?id=${userId})`;

        if (text === 'احبك' || text === 'أحبك') {
            const loveReplies = ['وانا احب ايفي', 'وانا احب توري', 'وانا بعد', 'اعشقك'];
            return ctx.reply(loveReplies[Math.floor(Math.random() * loveReplies.length)], { reply_to_message_id: ctx.message.message_id });
        }

        // أوامر الفتح والقفل خاصة بك وحدك (الديف ون j4xa7) أو بصلاحية Dev🎖️
        if (text === 'فتح المخالفات' || text === 'فتح التعديل') {
            if (username.toLowerCase() !== 'j4xa7' && role !== 'Dev🎖️') {
                return ctx.reply('• هذا الأمر مخصص للديف ون فقط.');
            }
            if (!groupSettings[chatId]) groupSettings[chatId] = { violations: true, edit: true };
            groupSettings[chatId].violations = true;
            groupSettings[chatId].edit = true;
            return ctx.reply('تم فتح المخالفات والتعديل. 🔓', { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'قفل المخالفات' || text === 'قفل التعديل') {
            if (username.toLowerCase() !== 'j4xa7' && role !== 'Dev🎖️') {
                return ctx.reply('• هذا الأمر مخصص للديف ون فقط.');
            }
            if (!groupSettings[chatId]) groupSettings[chatId] = { violations: true, edit: true };
            groupSettings[chatId].violations = false;
            groupSettings[chatId].edit = false;

            const closeMsg = `تم قفل المخالفات بنجاح 🔒\n\n` +
                             `المحتوى الممنوع في المجموعة:\n` +
                             `• المخدرات وأي شكل من أشكال التعاطي\n` +
                             `• العنف الدموي والمشاهد المروعة\n` +
                             `• الأسلحة النارية أو التهديد بها\n\n` +
                             `سيتم حذف المحتوى المخالف تلقائيًا مع نظام إنذارات (3 إنذارات ⟵ عقوبة).`;
            return ctx.reply(closeMsg, { reply_to_message_id: ctx.message.message_id });
        }

        if (ctx.chat.type === 'private') return;
        if (ctx.from && ctx.from.is_bot) return;

        if (!groupSettings[chatId]) {
            groupSettings[chatId] = { violations: true, edit: true };
        }

        // الاستثناء الوحيد للحماية هو أنت (الديف ون) فقط، بينما الإداريين الباقين تتطبق عليهم الحماية إذا كانت مقفلة
        const isTheDevOne = (username.toLowerCase() === 'j4xa7');

        if (!isTheDevOne) {
            // منع تعديل الرسائل للجميع إذا كان النظام مقفل (يشمل الإداريين والكل)
            if (isEdited && !groupSettings[chatId].edit) {
                try { await ctx.deleteMessage(); } catch (e) {}
                return ctx.reply(`عذراً ${mention} ‼️ : يمنع تعديل الرسايل بالمجموعة`, { parse_mode: 'Markdown' });
            }

            // فحص السبام والتكرار للجميع إذا كانت المخالفات مقفلة
            if (!groupSettings[chatId].violations) {
                const now = Date.now();
                if (!userMessageTimestamps[userId]) userMessageTimestamps[userId] = [];
                userMessageTimestamps[userId] = userMessageTimestamps[userId].filter(timestamp => now - timestamp < 4000);
                userMessageTimestamps[userId].push(now);

                if (userMessageTimestamps[userId].length > 4) {
                    try { await ctx.deleteMessage(); } catch (e) {}
                    userMessageTimestamps[userId] = [];
                    return ctx.reply(`تم حذف رسالة ${mention} بسبب الإزعاج أو التكرار (سبام) ‼️`, { parse_mode: 'Markdown' });
                }
            }
        }

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

        if (text.startsWith('رفع ') || text === 'تنزيل الكل') {
            if (!ctx.message.reply_to_message) {
                return ctx.reply('يرجى الرد على الشخص لتنفيذ الأمر.', { reply_to_message_id: ctx.message.message_id });
            }
            const targetUser = ctx.message.reply_to_message.from;
            const targetId = targetUser.id;
            const targetName = targetUser.first_name || 'المستخدم';

            if (!hasPermission(role, 'Myth🎖️')) {
                return ctx.reply('• أمر الرفع والتنزيل يتطلب رتبة (Myth🎖️ الإكسترا) فما فوق.', { reply_to_message_id: ctx.message.message_id });
            }

            if (text === 'تنزيل الكل') {
                if (!db.roles[chatId]) db.roles[chatId] = {};
                db.roles[chatId][targetId] = 'عضو';
                saveData();
                return ctx.reply(`• المستخدم ⟵ ｢ ${targetName} ｣\n• تم تنزيله من الرتبة ( عضو )`, { reply_to_message_id: ctx.message.message_id });
            }

            if (text.startsWith('رفع ')) {
                const rawRank = text.replace('رفع ', '').trim().toLowerCase();
                let requestedRank = '';

                if (rawRank === 'ديف') { requestedRank = 'Dev²🎖'; }
                else if (rawRank === 'مطور اساسي' || rawRank === 'ديف 1' || rawRank === 'ديف١') { requestedRank = 'Dev🎖️'; }
                else if (rawRank === 'اكس' || rawRank === 'اكسترا') { requestedRank = 'Myth🎖️'; }
                else if (rawRank === 'ميث') { requestedRank = 'myth'; }
                else if (rawRank === 'مالك اساسي') { requestedRank = 'مالك اساسي'; }
                else if (rawRank === 'مالك') { requestedRank = 'مالك'; }
                else if (rawRank === 'مميز') { requestedRank = 'مميز'; }
                else { return ctx.reply('عذراً، هذه الرتبة غير صحيحة.', { reply_to_message_id: ctx.message.message_id }); }

                if (!db.roles[chatId]) db.roles[chatId] = {};
                db.roles[chatId][targetId] = requestedRank;
                saveData();
                return ctx.reply(`• المستخدم ⟵ ｢ ${targetName} ｣\n• تم رفعه ⟵ ${requestedRank}`, { reply_to_message_id: ctx.message.message_id });
            }
        }

        if (text === 'توري') return ctx.reply('• توري ⟵ @to6ri', { reply_to_message_id: ctx.message.message_id });
        if (text === 'ايفي' || text === 'ايلاف') return ctx.reply('• المطور ⟵ @j4xa7', { reply_to_message_id: ctx.message.message_id });
        if (text === 'تورايف') {
            const replies = ['عيوني', 'أمر؟', 'سم', 'عيون ايفي وتوري', 'هلا'];
            return ctx.reply(replies[Math.floor(Math.random() * replies.length)], { reply_to_message_id: ctx.message.message_id });
        }

    } catch (e) {}
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
