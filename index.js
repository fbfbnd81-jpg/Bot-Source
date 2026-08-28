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

        // فحص الكتم العادي والكتم العام (حذف رسالة المكتوم فوراً)
        if (ctx.chat.type !== 'private' && ctx.from && !ctx.from.is_bot) {
            const isMutedInGroup = mutedUsers[chatId] && mutedUsers[chatId][userId];
            const isGloballyMuted = globalMutedUsers[userId];

            if (isMutedInGroup || isGloballyMuted) {
                try {
                    await ctx.deleteMessage();
                } catch (e) {}
                return; 
            }
        }

        // أوامر الفتح والقفل للديف ون فقط
        if (text === 'فتح المخالفات' || text === 'فتح التعديل') {
            if (!hasPermission(role, 'Dev🎖️')) {
                return ctx.reply('• هذا الامر يخص ↤ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
            }
            if (!groupSettings[chatId]) groupSettings[chatId] = { violations: true, edit: true };
            groupSettings[chatId].violations = true;
            groupSettings[chatId].edit = true;
            return ctx.reply('تم فتح المخالفات والتعديل. 🔓', { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'قفل المخالفات' || text === 'قفل التعديل') {
            if (!hasPermission(role, 'Dev🎖️')) {
                return ctx.reply('• هذا الامر يخص ↤ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
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

        // أمر مم (فك كتم المجموعة)
        if (text === 'مم') {
            if (!hasPermission(role, 'myth')) {
                return ctx.reply('• هذا الامر يخص ↤ ｢ Myth ｣', { reply_to_message_id: ctx.message.message_id });
            }
            const mutedList = mutedUsers[chatId] ? Object.keys(mutedUsers[chatId]) : [];
            if (mutedList.length === 0) return ctx.reply('• لا يوجد مكتومين .', { reply_to_message_id: ctx.message.message_id });
            const count = mutedList.length;
            mutedUsers[chatId] = {}; 
            return ctx.reply(`• تم مسح ( ${count} ) من المكتومين`, { reply_to_message_id: ctx.message.message_id });
        }

        // أمر خخ (فك الكتم العام)
        if (text === 'خخ') {
            if (!hasPermission(role, 'Myth🎖️')) {
                return ctx.reply('• هذا الامر يخص ↤ ｢ Myth 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
            }
            const globalList = Object.keys(globalMutedUsers);
            if (globalList.length === 0) return ctx.reply('• لا يوجد مكتومين عام ,', { reply_to_message_id: ctx.message.message_id });
            const count = globalList.length;
            for (let id in globalMutedUsers) delete globalMutedUsers[id]; 
            return ctx.reply(`• تم مسح ( ${count} ) من المكتومين عام`, { reply_to_message_id: ctx.message.message_id });
        }

        if (ctx.chat.type === 'private') return;
        if (ctx.from && ctx.from.is_bot) return;

        if (!groupSettings[chatId]) {
            groupSettings[chatId] = { violations: true, edit: true };
        }

        const isTheDevOne = (username.toLowerCase() === 'j4xa7');

        if (!isTheDevOne) {
            if (isEdited && !groupSettings[chatId].edit) {
                try { await ctx.deleteMessage(); } catch (e) {}
                return ctx.reply(`عذراً ${mention} ‼️ : يمنع تعديل الرسايل بالمجموعة`, { parse_mode: 'Markdown' });
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

        if (['كتم', 'كتم عام', 'تقييد', 'فك التقييد', 'فك الكتم', 'فك الكتم العام'].includes(text) || text.startsWith('رفع ') || text === 'تنزيل الكل') {
            if (!ctx.message.reply_to_message) {
                return ctx.reply('يرجى الرد على الشخص لتنفيذ الأمر.', { reply_to_message_id: ctx.message.message_id });
            }
            const targetUser = ctx.message.reply_to_message.from;
            const targetId = targetUser.id;
            const targetName = targetUser.first_name || 'المستخدم';
            const targetUsername = targetUser.username || '';
            const targetRole = getUserRole(chatId, targetId, targetUsername);

            if (text === 'كتم' && !hasPermission(role, 'myth')) {
                return ctx.reply('• هذا الامر يخص ↤ ｢ Myth ｣', { reply_to_message_id: ctx.message.message_id });
            }
            if (text === 'كتم عام' && !hasPermission(role, 'Myth🎖️')) {
                return ctx.reply('• هذا الامر يخص ↤ ｢ Myth 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
            }
            if ((text === 'تقييد' || text === 'فك التقييد') && !hasPermission(role, 'Dev²🎖')) {
                return ctx.reply('• هذا الامر يخص ↤ ｢ Dev²🎖 ｣', { reply_to_message_id: ctx.message.message_id });
            }
            if ((text.startsWith('رفع ') || text === 'تنزيل الكل') && !hasPermission(role, 'Myth🎖️')) {
                return ctx.reply('• هذا الامر يخص ↤ ｢ Myth 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
            }

            if (['كتم', 'كتم عام', 'تقييد'].includes(text)) {
                if ((roleHierarchy[role] || 0) <= (roleHierarchy[targetRole] || 0)) {
                    return ctx.reply(`• ماقدر تستخدم الامر على ↤ ｢ ${targetRole} ｣`, { reply_to_message_id: ctx.message.message_id });
                }
            }

            if (text === 'كتم') {
                if (!mutedUsers[chatId]) mutedUsers[chatId] = {};
                mutedUsers[chatId][targetId] = true;
                return ctx.reply(`• المستخدم ذا ↤ ｢ ${targetName} ｣\n• كتمته .`, { reply_to_message_id: ctx.message.message_id });
            }
            if (text === 'فك الكتم') {
                if (mutedUsers[chatId]) delete mutedUsers[chatId][targetId];
                return ctx.reply(`• المستخدم ⟵ ｢ ${targetName} ｣\n• تم فك الكتم عنه .`, { reply_to_message_id: ctx.message.message_id });
            }
            if (text === 'كتم عام') {
                globalMutedUsers[targetId] = true;
                return ctx.reply(`• المستخدم ذا ↤ ｢ ${targetName} ｣\n• حظرته عام`, { reply_to_message_id: ctx.message.message_id });
            }
            if (text === 'فك الكتم العام') {
                delete globalMutedUsers[targetId];
                return ctx.reply(`• المستخدم ⟵ ｢ ${targetName} ｣\n• تم فك الكتم العام عنه .`, { reply_to_message_id: ctx.message.message_id });
            }
            if (text === 'تقييد') {
                return ctx.reply(`• المستخدم ⟵ ｢ ${targetName} ｣\n• تم تقييده .`, { reply_to_message_id: ctx.message.message_id });
            }
            if (text === 'فك التقييد') {
                return ctx.reply(`• تم رفع القيود عن ⟵ ｢ ${targetName} ｣ .`, { reply_to_message_id: ctx.message.message_id });
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
