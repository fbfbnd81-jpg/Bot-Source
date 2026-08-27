const { Telegraf, Markup } = require('telegraf');
const http = require('http');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf(process.env.BOT_TOKEN);

// فحص الرتبة المباشر
function getRole(username) {
    const devs = ['j4xa7', 'to6ri', 'evy', 'evelaf', 'i_evy', 'evyyytoiry'];
    if (username && devs.includes(username.toLowerCase())) {
        return 'Dev🎖️';
    }
    return 'عضو';
}

// التفاعل مع كل رسالة بشكل مباشر بدون عقد
bot.on('message', async (ctx) => {
    try {
        if (!ctx.message || !ctx.message.text) return;
        const text = ctx.message.text.trim();
        const username = ctx.from.username || '';
        const role = getRole(username);

        // 1. أمر رتبتي
        if (text === 'رتبتي' || text === '/رتبتي') {
            return ctx.reply(`• رتبتك هي ⟵ ｢ ${role} ｣\n• آي دي حسابك ⟵ ${ctx.from.id}`, { reply_to_message_id: ctx.message.message_id });
        }

        // 2. أمر فتح المخالفات
        if (text === 'فتح المخالفات') {
            if (role !== 'Dev🎖️') return ctx.reply('• هذا الأمر يخص المطورين فقط ⟵ ｢ Dev🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
            return ctx.reply('🔓 تم فتح المخالفات بنجاح.', { reply_to_message_id: ctx.message.message_id });
        }

        // 3. أمر قفل المخالفات
        if (text === 'قفل المخالفات') {
            if (role !== 'Dev🎖️') return ctx.reply('• هذا الأمر يخص المطورين فقط ⟵ ｢ Dev🎖️ ｣', { reply_to_message_id: ctx.message.message_id });
            return ctx.reply('🔒 تم قفل المخالفات وحماية الجروب بنجاح.', { reply_to_message_id: ctx.message.message_id });
        }

        // 4. رد توري
        if (text === 'توري') {
            return ctx.reply('• توري ⟵ @to6ri', { reply_to_message_id: ctx.message.message_id });
        }

        // 5. رد ايفي أو ايلاف
        if (text === 'ايفي' || text === 'ايلاف') {
            return ctx.reply('• المطور ⟵ @j4xa7', { reply_to_message_id: ctx.message.message_id });
        }

        // 6. رد تورايف
        if (text === 'تورايف') {
            const replies = ['عيوني 🤍', 'أمر؟ 👀', 'سم 🫶', 'وش بغيت؟ 🦦', 'عيون ايفي وتوري ✨', 'هلا 🤍'];
            const randomReply = replies[Math.floor(Math.random() * replies.length)];
            return ctx.reply(randomReply, { reply_to_message_id: ctx.message.message_id });
        }

    } catch (e) {
        console.log(e);
    }
});

bot.launch();

