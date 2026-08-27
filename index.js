const { Telegraf, Markup } = require('telegraf');
const http = require('http');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf(process.env.BOT_TOKEN);

const antiSpamEnabled = {};
const mutedUsers = {};       // الكتم العادي { chatId: { userId: true } }
const globalMutedUsers = {}; // الكتم العام { userId: true }

function getRole(username) {
    const devs = ['j4xa7', 'to6ri', 'evy', 'evelaf', 'i_evy', 'evyyytoiry'];
    if (username && devs.includes(username.toLowerCase())) {
        return 'Dev🎖️';
    }
    return 'عضو';
}

// 1. التعامل مع الرسائل الجديدة (حماية الروابط والكتم والعام والأوامر)
bot.on('message', async (ctx) => {
    try {
        if (!ctx.message || !ctx.chat || ctx.chat.type === 'private') return;
        if (!ctx.from || ctx.from.is_bot) return;

        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        const name = ctx.from.first_name || 'مستخدم';
        const username = ctx.from.username || '';
        const role = getRole(username);
        const text = (ctx.message.text || ctx.message.caption || '').trim();

        // أ) التحقق من الكتم العام أو الكتم العادي بالجروب
        if (role !== 'Dev🎖️') {
            if ((globalMutedUsers[userId]) || (mutedUsers[chatId] && mutedUsers[chatId][userId])) {
                try { await ctx.deleteMessage(); } catch (e) {}
                return;
            }
        }

        // ب) فحص الروابط إذا المخالفات مقفلة
        if (antiSpamEnabled[chatId] && role !== 'Dev🎖️') {
            const hasLink = /https?:\/\/|t\.me\/|www\./i.test(text);
            if (hasLink) {
                try { await ctx.deleteMessage(); } catch (e) {}
                return;
            }
        }

        // جـ) الأوامر والردود
        if (text === 'رتبتي' || text === '/رتبتي') {
            return ctx.reply(`• رتبتك هي ⟵ ｢ ${role} ｣\n• آي دي حسابك ⟵ ${userId}`, { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'فتح المخالفات') {
            if (role !== 'Dev🎖️') return ctx.reply('• هذا الأمر يخص المطورين فقط ⟵ ｢ Dev🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
            antiSpamEnabled[chatId] = false;
            return ctx.reply('🔓 تم فتح المخالفات بنجاح.', { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'قفل المخالفات') {
            if (role !== 'Dev🎖️') return ctx.reply('• هذا الأمر يخص المطورين فقط ⟵ ｢ Dev🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
            antiSpamEnabled[chatId] = true;
            return ctx.reply('🔒 تم قفل المخالفات وحماية الجروب بنجاح.', { reply_to_message_id: ctx.message.message_id });
        }

        // د) قائمة المكتومين (مم) والعام (خخ)
        if (text === 'مم') {
            const mutedList = mutedUsers[chatId] ? Object.keys(mutedUsers[chatId]) : [];
            if (mutedList.length === 0) return ctx.reply('• لا يوجد مكتومين .', { reply_to_message_id: ctx.message.message_id });
            return ctx.reply(`• عدد المكتومين في الجروب: ${mutedList.length}`, { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'خخ') {
            const globalList = Object.keys(globalMutedUsers);
            if (globalList.length === 0) return ctx.reply('• لا يوجد مكتومين عام .', { reply_to_message_id: ctx.message.message_id });
            return ctx.reply(`• عدد المكتومين عام: ${globalList.length}`, { reply_to_message_id: ctx.message.message_id });
        }

        // هـ) أوامر الإدارة بالرد على الشخص
        if (['كتم', 'كتم عام', 'تقييد', 'طرد', 'حظر', 'فك الكتم', 'رفع القيود', 'الغاء التقييد'].includes(text)) {
            if (role !== 'Dev🎖️') return ctx.reply('• هذا الأمر يخص المطورين فقط ⟵ ｢ Dev🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
            
            if (!ctx.message.reply_to_message) {
                return ctx.reply('⚠️ يرجى الرد على الرسالة لتنفيذ الأمر.', { reply_to_message_id: ctx.message.message_id });
            }

            const targetUser = ctx.message.reply_to_message.from;
            const targetId = targetUser.id;
            const targetName = targetUser.first_name || 'المستخدم';

            if (text === 'كتم') {
                if (!mutedUsers[chatId]) mutedUsers[chatId] = {};
                mutedUsers[chatId][targetId] = true;
                return ctx.reply(`• المستخدم ذا ⟵ ｢ ${targetName} ｣\n• كتمته .`, { reply_to_message_id: ctx.message.message_id });
            }

            if (text === 'كتم عام') {
                globalMutedUsers[targetId] = true;
                return ctx.reply(`• المستخدم ذا ⟵ ｢ ${targetName} ｣\n• كتمته عام .`, { reply_to_message_id: ctx.message.message_id });
            }

            if (text === 'تقييد') {
                try {
                    await ctx.restrictChatMember(targetId, { permissions: { can_send_messages: false } });
                    return ctx.reply(`• تم تقييد العضو ⟵ ｢ ${targetName} ｣ بنجاح.`, { reply_to_message_id: ctx.message.message_id });
                } catch (e) {
                    return ctx.reply('❌ لا يمكنني تقييد هذا العضو (قد يكون مشرفاً).', { reply_to_message_id: ctx.message.message_id });
                }
            }

            if (text === 'طرد') {
                try {
                    await ctx.unbanChatMember(targetId); // طرد بدون حظر نهائي
                    return ctx.reply(`• تم طرد العضو ⟵ ｢ ${targetName} ｣ بنجاح.`, { reply_to_message_id: ctx.message.message_id });
                } catch (e) {
                    return ctx.reply('❌ لا يمكنني طرد هذا العضو.', { reply_to_message_id: ctx.message.message_id });
                }
            }

            if (text === 'حظر') {
                try {
                    await ctx.banChatMember(targetId);
                    return ctx.reply(`• تم حظر العضو ⟵ ｢ ${targetName} ｣ نهائياً.`, { reply_to_message_id: ctx.message.message_id });
                } catch (e) {
                    return ctx.reply('❌ لا يمكنني حظر هذا العضو.', { reply_to_message_id: ctx.message.message_id });
                }
            }

            if (['فك الكتم', 'رفع القيود', 'الغاء التقييد'].includes(text)) {
                if (mutedUsers[chatId]) delete mutedUsers[chatId][targetId];
                delete globalMutedUsers[targetId];
                try {
                    await ctx.unbanChatMember(targetId); // يرفع الحظر والتقييد والكتم
                    return ctx.reply(`• تم رفع القيود وفك الكتم عن العضو ⟵ ｢ ${targetName} ｣ بنجاح.`, { reply_to_message_id: ctx.message.message_id });
                } catch (e) {
                    return ctx.reply(`• تم فك الكتم الداخلي عن ⟵ ｢ ${targetName} ｣.`, { reply_to_message_id: ctx.message.message_id });
                }
            }
        }

        // و) الردود التلقائية (توري، ايفي، ايلاف، تورايف)
        if (text === 'توري') {
            return ctx.reply('• توري ⟵ @to6ri', { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'ايفي' || text === 'ايلاف') {
            return ctx.reply('• المطور ⟵ @j4xa7', { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'تورايف') {
            const replies = ['عيوني 🤍', 'أمر؟ 👀', 'سم 🫶', 'وش بغيت؟ 🦦', 'عيون ايفي وتوري ✨', 'هلا 🤍'];
            const randomReply = replies[Math.floor(Math.random() * replies.length)];
            return ctx.reply(randomReply, { reply_to_message_id: ctx.message.message_id });
        }

    } catch (e) {}
});

// 2. الحماية الصارمة: أي رسالة يتم تعديلها من أي عضو (غير المطور) تُحذف فوراً
bot.on('edited_message', async (ctx) => {
    try {
        const editedMsg = ctx.editedMessage;
        if (!editedMsg || !editedMsg.chat || editedMsg.chat.type === 'private') return;
        if (!editedMsg.from || editedMsg.from.is_bot) return;

        const chatId = editedMsg.chat.id;
        const username = editedMsg.from.username || '';
        const role = getRole(username);

        if (role !== 'Dev🎖️') {
            await ctx.telegram.deleteMessage(chatId, editedMsg.message_id);
        }
    } catch (e) {}
});

bot.launch();
