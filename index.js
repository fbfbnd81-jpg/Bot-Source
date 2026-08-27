const { Telegraf } = require('telegraf');
const http = require('http');
const fs = require('fs');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf('8963407967:AAEjxoIl2MYDghsdSVsAcWCEYRGrTqa_GS8');

const mutedUsers = {};       
const globalMutedUsers = {}; 
const groupSettings = {}; // لحفظ حالة القفل والفتح لكل قروب

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
        if (!ctx.chat || ctx.chat.type === 'private') return;
        if (!ctx.from || ctx.from.is_bot) return;

        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        const username = ctx.from.username || '';
        const name = ctx.from.first_name || 'المستخدم';
        const role = getUserRole(chatId, userId, username);
        const text = (ctx.message.text || ctx.message.caption || '').trim();
        const isEdited = !!ctx.update.edited_message;

        // تهيئة إعدادات الحماية للقروب
        if (!groupSettings[chatId]) {
            groupSettings[chatId] = {
                violations: true,
                edit: true,
                links: false,
                forward: false,
                spam: false
            };
        }

        // رتبة المالك فما فوق لديهم حصانة كاملة ضد الكتم والحذف
        const isOwnerOrAbove = hasPermission(role, 'مالك');

        // فحص تعديل الرسائل (حماية التعديل)
        if (isEdited && groupSettings[chatId].edit && !isOwnerOrAbove) {
            try { await ctx.deleteMessage(); } catch (e) {}
            return;
        }

        // احتساب وتخزين الرسائل والتفاعل
        if (!db.stats[chatId]) db.stats[chatId] = {};
        if (!db.stats[chatId][userId]) {
            db.stats[chatId][userId] = { count: 0, name: name, username: username };
        }
        db.stats[chatId][userId].count += 1;
        db.stats[chatId][userId].name = name;
        saveData();

        // فحص المكتومين (المالك فما فوق مستحيل ينكتم)
        if (!isOwnerOrAbove) {
            if ((globalMutedUsers[userId]) || (mutedUsers[chatId] && mutedUsers[chatId][userId])) {
                try { await ctx.deleteMessage(); } catch (e) {}
                return;
            }
        }

        if (text === 'رتبتي' || text === '/رتبتي') {
            return ctx.reply(`• رتبتك هي ⟵ ｢ ${role} ｣`, { reply_to_message_id: ctx.message.message_id });
        }

        // أمر تفاعلي
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

        // أمر المتفاعلين
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

        // أوامر القفل والفتح (الحماية والمخالفات)
        if (['قفل المخالفات', 'فتح المخالفات', 'تفعيل المخالفات', 'تقفيل المخالفات', 'قفل التعديل', 'فتح التعديل'].includes(text)) {
            if (!hasPermission(role, 'مالك')) {
                return ctx.reply('• هذا الأمر يتطلب رتبة مالك فما فوق.', { reply_to_message_id: ctx.message.message_id });
            }

            if (text === 'قفل المخالفات' || text === 'تقفيل المخالفات') {
                groupSettings[chatId].violations = true;
                return ctx.reply('• أهلاً بك، تم قفل المخالفات بنجاح.', { reply_to_message_id: ctx.message.message_id });
            }
            if (text === 'فتح المخالفات' || text === 'تفعيل المخالفات') {
                groupSettings[chatId].violations = false;
                return ctx.reply('• أهلاً بك، تم فتح المخالفات بنجاح.', { reply_to_message_id: ctx.message.message_id });
            }
            if (text === 'قفل التعديل') {
                groupSettings[chatId].edit = true;
                return ctx.reply('• تم قفل تعديل الرسائل.', { reply_to_message_id: ctx.message.message_id });
            }
            if (text === 'فتح التعديل') {
                groupSettings[chatId].edit = false;
                return ctx.reply('• تم فتح تعديل الرسائل.', { reply_to_message_id: ctx.message.message_id });
            }
        }

        // أوامر الرفع وتنزيل الرتب
        if (text.startsWith('رفع ') || text === 'تنزيل الكل') {
            if (!ctx.message.reply_to_message) {
                return ctx.reply('يرجى الرد على الشخص لتنفيذ الأمر.', { reply_to_message_id: ctx.message.message_id });
            }
            const targetUser = ctx.message.reply_to_message.from;
            const targetId = targetUser.id;
            const targetName = targetUser.first_name || 'المستخدم';

            if (text === 'تنزيل الكل') {
                if (!hasPermission(role, 'Myth🎖️')) return ctx.reply('• ليس لديك صلاحية لتنزيل الرتب.', { reply_to_message_id: ctx.message.message_id });
                if (!db.roles[chatId]) db.roles[chatId] = {};
                db.roles[chatId][targetId] = 'عضو';
                saveData();
                return ctx.reply(`• المستخدم ⟵ ｢ ${targetName} ｣\n• تم تنزيله من الرتبة ( عضو )`, { reply_to_message_id: ctx.message.message_id });
            }

            if (text.startsWith('رفع ')) {
                const rawRank = text.replace('رفع ', '').trim().toLowerCase();
                let requestedRank = '';
                let displayRank = '';

                if (rawRank === 'ديف') {
                    requestedRank = 'Dev 2';
                    displayRank = 'Dev 2';
                } else if (rawRank === 'مطور اساسي' || rawRank === 'مطور أساسي') {
                    requestedRank = 'Dev🎖️';
                    displayRank = 'Dev🎖️';
                } else if (rawRank === 'ميث' || rawRank === 'm') {
                    requestedRank = 'myth';
                    displayRank = 'myth';
                } else if (rawRank === 'اكس' || rawRank === 'إكسترا' || rawRank === 'اكسترا' || rawRank === 'ا') {
                    requestedRank = 'Myth🎖️';
                    displayRank = 'Myth🎖️';
                } else if (rawRank === 'مميز') {
                    requestedRank = 'مميز';
                    displayRank = 'مميز';
                } else if (rawRank === 'مالك') {
                    requestedRank = 'مالك';
                    displayRank = 'مالك';
                } else if (rawRank === 'مالك اساسي' || rawRank === 'مالك أساسي') {
                    requestedRank = 'مالك اساسي';
                    displayRank = 'مالك اساسي';
                } else {
                    return ctx.reply('عذراً، هذه الرتبة غير صحيحة أو غير متوفرة.', { reply_to_message_id: ctx.message.message_id });
                }

                if (!hasPermission(role, 'مالك اساسي')) {
                    return ctx.reply('• أمر الرفع يتطلب رتبة (مالك اساسي) فما فوق.', { reply_to_message_id: ctx.message.message_id });
                }

                if (!db.roles[chatId]) db.roles[chatId] = {};
                db.roles[chatId][targetId] = requestedRank;
                saveData();
                
                return ctx.reply(`• المستخدم ⟵ ｢ ${targetName} ｣\n• تم رفعه ${displayRank}`, { reply_to_message_id: ctx.message.message_id });
            }
        }

        // أمر مم (عدد المكتومين في القروب + فك الكتم عن الجميع)
        if (text === 'مم') {
            const mutedList = mutedUsers[chatId] ? Object.keys(mutedUsers[chatId]) : [];
            if (mutedList.length === 0) return ctx.reply('• لا يوجد مكتومين .', { reply_to_message_id: ctx.message.message_id });
            
            const count = mutedList.length;
            mutedUsers[chatId] = {}; 
            return ctx.reply(`• عدد المكتومين في القروب: ${count}\n• تم فك الكتم عن الجميع .`, { reply_to_message_id: ctx.message.message_id });
        }

        // أمر خخ (عدد المكتومين عام + فك الكتم العام عن الجميع)
        if (text === 'خخ') {
            const globalList = Object.keys(globalMutedUsers);
            if (globalList.length === 0) return ctx.reply('• لا يوجد مكتومين عام .', { reply_to_message_id: ctx.message.message_id });
            
            const count = globalList.length;
            for (let id in globalMutedUsers) delete globalMutedUsers[id]; 
            return ctx.reply(`• عدد المكتومين عام: ${count}\n• تم فك الكتم العام عن الجميع .`, { reply_to_message_id: ctx.message.message_id });
        }

        // أوامر الكتم الفردي بالرد
        if (['كتم', 'كتم عام', 'فك الكتم', 'فك الكتم العام'].includes(text)) {
            if (!ctx.message.reply_to_message) {
                return ctx.reply('يرجى الرد على الرسالة لتنفيذ الأمر.', { reply_to_message_id: ctx.message.message_id });
            }

            const targetUser = ctx.message.reply_to_message.from;
            const targetId = targetUser.id;
            const targetName = targetUser.first_name || 'المستخدم';
            const targetRole = getUserRole(chatId, targetId, targetUser.username || '');

            // منع كتم المالك فما فوق
            if (hasPermission(targetRole, 'مالك')) {
                return ctx.reply('• لا يمكنك كتم شخص يحمل رتبة مالك أو أعلى!', { reply_to_message_id: ctx.message.message_id });
            }

            if (text === 'كتم') {
                if (!mutedUsers[chatId]) mutedUsers[chatId] = {};
                mutedUsers[chatId][targetId] = true;
                return ctx.reply(`• المستخدم ⟵ ｢ ${targetName} ｣\n• كتمته .`, { reply_to_message_id: ctx.message.message_id });
            }

            if (text === 'كتم عام') {
                globalMutedUsers[targetId] = true;
                return ctx.reply(`• المستخدم ⟵ ｢ ${targetName} ｣\n• كتمته عام .`, { reply_to_message_id: ctx.message.message_id });
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
