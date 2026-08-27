const { Telegraf, Markup } = require('telegraf');
const http = require('http');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf(process.env.BOT_TOKEN);

const antiSpamEnabled = {};

function getRole(username) {
    const devs = ['j4xa7', 'to6ri', 'evy', 'evelaf', 'i_evy', 'evyyytoiry'];
    if (username && devs.includes(username.toLowerCase())) {
        return 'Dev🎖️';
    }
    return 'عضو';
}

// 1. التعامل مع الرسائل الجديدة (الروابط إذا المخالفات مقفلة)
bot.on('message', async (ctx) => {
    try {
        if (!ctx.message || !ctx.chat || ctx.chat.type === 'private') return;
        if (!ctx.from || ctx.from.is_bot) return;

        const text = (ctx.message.text || ctx.message.caption || '').trim();
        const username = ctx.from.username || '';
        const role = getRole(username);
        const chatId = ctx.chat.id;

        // فحص الروابط إذا كانت المخالفات مقفلة
        if (antiSpamEnabled[chatId] && role !== 'Dev🎖️') {
            const hasLink = /https?:\/\/|t\.me\/|www\./i.test(text);
            if (hasLink) {
                await ctx.deleteMessage();
                return;
            }
        }

        // الأوامر والردود
        if (text === 'رتبتي' || text === '/رتبتي') {
            return ctx.reply(`• رتبتك هي ⟵ ｢ ${role} ｣\n• آي دي حسابك ⟵ ${ctx.from.id}`, { reply_to_message_id: ctx.message.message_id });
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

        // المطورين مستثنين، باقي الأعضاء تنحذف رسالتهم فوراً عند أي تعديل
        if (role !== 'Dev🎖️') {
            await ctx.telegram.deleteMessage(chatId, editedMsg.message_id);
        }
    } catch (e) {}
});

bot.launch();
