const { Telegraf } = require('telegraf');
const http = require('http');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf(process.env.BOT_TOKEN);

const antiSpamEnabled = {};
const mutedUsers = {};       
const globalMutedUsers = {}; 
const userRoles = {};

// قواعد بيانات التفاعل (تخزين الرسائل لكل مستخدم في كل جروب)
const chatStats = {}; // { chatId: { userId: { count: 0, name: '', username: '' } } }

function getUserRole(chatId, userId, username) {
    if (userRoles[chatId] && userRoles[chatId][userId]) {
        return userRoles[chatId][userId];
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
        if (!ctx.message || !ctx.chat || ctx.chat.type === 'private') return;
        if (!ctx.from || ctx.from.is_bot) return;

        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        const username = ctx.from.username || '';
        const name = ctx.from.first_name || 'المستخدم';
        const role = getUserRole(chatId, userId, username);
        const text = (ctx.message.text || ctx.message.caption || '').trim();

        // --- 1. نظام احتساب الرسائل والتفاعل ---
        if (!chatStats[chatId]) chatStats[chatId] = {};
        if (!chatStats[chatId][userId]) {
            chatStats[chatId][userId] = { count: 0, name: name, username: username };
        }
        chatStats[chatId][userId].count += 1;
        chatStats[chatId][userId].name = name; // تحديث الاسم لو تغير

        if (role !== 'Dev🎖️' && role !== 'Dev 2' && role !== 'Myth🎖️') {
            if ((globalMutedUsers[userId]) || (mutedUsers[chatId] && mutedUsers[chatId][userId])) {
                try { await ctx.deleteMessage(); } catch (e) {}
                return;
            }
        }

        const isProtected = roleHierarchy[role] >= roleHierarchy['مميز'];
        
        if (!isProtected) {
            if (antiSpamEnabled[chatId]) {
                const hasLink = /https?:\/\/|t\.me\/|www\./i.test(text);
                if (hasLink) {
                    try { await ctx.deleteMessage(); } catch (e) {}
                    return;
                }
            }
            const hasEnglish = /[a-zA-Z]{5,}/.test(text);
            if (hasEnglish && text.length > 100) {
                try { await ctx.deleteMessage(); } catch (e) {}
                return;
            }
        }

        if (text === 'رتبتي' || text === '/رتبتي') {
            return ctx.reply(`• رتبتك هي ⟵ ｢ ${role} ｣`, { reply_to_message_id: ctx.message.message_id });
        }

        // --- 2. أمر "تفاعلي" (يعرض رسائل وترتيب الشخص) ---
        if (text === 'تفاعلي') {
            const userGroupStats = chatStats[chatId];
            // ترتيب المستخدمين تنازلياً حسب عدد الرسائل لمعرفة الترتيب
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

        // --- 3. أمر "المتفاعلين" (توب 20 مع المنشن والترتيب) ---
        if (text === 'المتفاعلين' || text === 'قائمة المتفاعلين') {
            const userGroupStats = chatStats[chatId];
            if (!userGroupStats || Object.keys(userGroupStats).length === 0) {
                return ctx.reply('• لا يوجد تفاعلات مسجلة حتى الآن.', { reply_to_message_id: ctx.message.message_id });
            }

            // ترتيب الأعضاء وتحديد أول 20 شخص فقط
            const sortedUsers = Object.entries(userGroupStats)
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 20);

            let msg = '🏆 **قائمة توب 20 متفاعل في الجروب:**\n\n';
            sortedUsers.forEach(([id, data], index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `🔹`;
                // عمل منشن صحيح بالاسم
                const mention = `[${data.name}](tg://user?id=${id})`;
                msg += `${medal} ${index + 1}. ${mention} ⟵ [ ${data.count} رسالة ]\n`;
            });

            return ctx.reply(msg, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'فتح المخالفات') {
            if (!hasPermission(role, 'Dev🎖️')) {
                return ctx.reply('• هذا الامر يخص ↤ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
            }
            antiSpamEnabled[chatId] = false;
            return ctx.reply(`من (${name})\nتم فتح المخالفات بنجاح 🔓`, { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'قفل المخالفات') {
            if (!hasPermission(role, 'Dev🎖️')) {
                return ctx.reply('• هذا الامر يخص ↤ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
            }
            antiSpamEnabled[chatId] = true;
            return ctx.reply(`من (${name})\nتم تقفيل المخالفات بنجاح 🔒`, { reply_to_message_id: ctx.message.message_id });
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
