const { Telegraf } = require('telegraf');
const http = require('http');
const fs = require('fs');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Toraif Bot is active!');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf('8963407967:AAEjxoIl2MYDghsdSVsAcWCEYRGrTqa_GS8');

const mutedUsers = {};       
const globalMutedUsers = {}; 
const groupSettings = {}; 

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

// تم حذف اليوزرات التلقائية عشان يعتمد على الرفع اليدوي فقط
function getUserRole(chatId, userId, username) {
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

        if (text === 'احبك' || text === 'أحبك') {
            const loveReplies = [
                'وانا احب ايفي',
                'وانا احب توري',
                'وانا بعد',
                'اعشقك'
            ];
            const randomReply = loveReplies[Math.floor(Math.random() * loveReplies.length)];
            return ctx.reply(randomReply, { reply_to_message_id: ctx.message.message_id });
        }

        if (isChannel) {
            if (text === 'تورايف') {
                return ctx.reply('عيون ايفي وتوري في القناة ❤️');
            }
            return;
        }

        if (ctx.chat.type === 'private') return;
        if (ctx.from && ctx.from.is_bot) return;

        if (!groupSettings[chatId]) {
            groupSettings[chatId] = { violations: true, edit: true };
        }

        const isProtectedUser = role !== 'عضو';

        if (!isProtectedUser) {
            if ((globalMutedUsers[userId]) || (mutedUsers[chatId] && mutedUsers[chatId][userId])) {
                try { await ctx.deleteMessage(); } catch (e) {}
                return;
            }
        }

        if (isEdited && groupSettings[chatId].edit && !isProtectedUser) {
            try { await ctx.deleteMessage(); } catch (e) {}
            return;
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

        if (text === 'تفاعلي') {
            const userGroupStats = db.stats[chatId] || {};
            const sortedUsers = Object.entries(userGroupStats).sort((a, b) => b[1].count - a[1].count);
            let userRank = sortedUsers.findIndex(item => item[0] == userId) + 1;
            let userMessages = userGroupStats[userId] ? userGroupStats[userId].count : 0;
            if (userRank === 0) userRank = sortedUsers.length + 1;

            const replyText = `• رتبتك هي ⟵ ${role}\n\n` +
                              `• رسائلك بالتفاعل ⟵ ${userMessages}\n` +
                              `• ترتيبك بالمتفاعلين ⟵ ${userRank}\n-`;
            return ctx.reply(replyText, { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'المتفاعلين' || text === 'قائمة المتفاعلين') {
            const userGroupStats = db.stats[chatId];
            if (!userGroupStats || Object.keys(userGroupStats).length === 0) {
                return ctx.reply('• لا يوجد تفاعلات مسجلة حتى الآن.', { reply_to_message_id: ctx.message.message_id });
            }
            const sortedUsers = Object.entries(userGroupStats).sort((a, b) => b[1].count - a[1].count).slice(0, 20);
            let msg = 'توب اكثر 20 متفاعلين بالمجموعة :\n_________________________\n\n';
            sortedUsers.forEach(([id, data], index) => {
                const formattedCount = data.count.toLocaleString();
                const mention = `[${data.name}](tg://user?id=${id})`;
                msg += `${index + 1} ) ${formattedCount} | ${mention}\n`;
            });
            return ctx.reply(msg, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
        }

        if (text.startsWith('رفع ') || text === 'تنزيل الكل') {
            if (!ctx.message.reply_to_message) {
                return ctx.reply('يرجى الرد على الشخص لتنفيذ الأمر.', { reply_to_message_id: ctx.message.message_id });
            }
            const targetUser = ctx.message.reply_to_message.from;
            const targetId = targetUser.id;
            const targetName = targetUser.first_name || 'المستخدم';

            if (!hasPermission(role, 'Dev²🎖')) {
                return ctx.reply('• أمر الرفع والتنزيل يتطلب رتبة (Dev²🎖) فما فوق.', { reply_to_message_id: ctx.message.message_id });
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

        if (text === 'مم') {
            if (!hasPermission(role, 'myth')) {
                return ctx.reply('• أمر فك كتم المجموعة يتطلب رتبة (myth) فما فوق.', { reply_to_message_id: ctx.message.message_id });
            }
            const mutedList = mutedUsers[chatId] ? Object.keys(mutedUsers[chatId]) : [];
            if (mutedList.length === 0) return ctx.reply('• لا يوجد مكتومين .', { reply_to_message_id: ctx.message.message_id });
            const count = mutedList.length;
            mutedUsers[chatId] = {}; 
            return ctx.reply(`• عدد المكتومين في المجموعة ⟵ ${count}\n• تم فك الكتم عن الجميع .`, { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'خخ') {
            if (!hasPermission(role, 'Myth🎖️')) {
                return ctx.reply('• أمر فك الكتم العام يتطلب رتبة (Myth🎖️) فما فوق.', { reply_to_message_id: ctx.message.message_id });
            }
            const globalList = Object.keys(globalMutedUsers);
            if (globalList.length === 0) return ctx.reply('• لا يوجد مكتومين عام .', { reply_to_message_id: ctx.message.message_id });
            const count = globalList.length;
            for (let id in globalMutedUsers) delete globalMutedUsers[id]; 
            return ctx.reply(`• عدد المكتومين عام ⟵ ${count}\n• تم فك الكتم العام عن الجميع .`, { reply_to_message_id: ctx.message.message_id });
        }

        if (['كتم', 'كتم عام', 'فك الكتم', 'فك الكتم العام'].includes(text)) {
            if (!hasPermission(role, 'مالك اساسي')) {
                return ctx.reply('• أوامر القيود والرفع تتطلب رتبة (مالك اساسي) فما فوق.', { reply_to_message_id: ctx.message.message_id });
            }

            if (!ctx.message.reply_to_message) {
                return ctx.reply('يرجى الرد على الرسالة لتنفيذ الأمر.', { reply_to_message_id: ctx.message.message_id });
            }
            const targetUser = ctx.message.reply_to_message.from;
            const targetId = targetUser.id;
            const targetName = targetUser.first_name || 'المستخدم';
            const targetRole = getUserRole(chatId, targetId, targetUser.username || '');

            if (targetRole !== 'عضو') {
                return ctx.reply(`• ما تقدر تستخدم الامر على ⟵ ｢ ${targetRole} ｣`, { reply_to_message_id: ctx.message.message_id });
            }

            if (text === 'كتم') {
                if (!mutedUsers[chatId]) mutedUsers[chatId] = {};
                mutedUsers[chatId][targetId] = true;
                return ctx.reply(`• المستخدم ⟵ ｢ ${targetName} ｣\n• تم كتمه .`, { reply_to_message_id: ctx.message.message_id });
            }
            if (text === 'كتم عام') {
                globalMutedUsers[targetId] = true;
                return ctx.reply(`• المستخدم ⟵ ｢ ${targetName} ｣\n• تم كتمه عام .`, { reply_to_message_id: ctx.message.message_id });
            }
            if (text === 'فك الكتم') {
                if (mutedUsers[chatId]) delete mutedUsers[chatId][targetId];
                return ctx.reply(`• تم فك الكتم عن ⟵ ｢ ${targetName} ｣.`, { reply_to_message_id: ctx.message.message_id });
            }
            if (text === 'فك الكتم العام') {
                delete globalMutedUsers[targetId];
                return ctx.reply(`• تم فك الكتم العام عن ⟵ ｢ ${targetName} ｣.`, { reply_to_message_id: ctx.message.message_id });
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
