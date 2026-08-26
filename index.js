const { Telegraf } = require('telegraf');
const http = require('http');

// إعداد السيرفر البسيط الخاص بريلواي عشان يضمن التثبيت 24/7
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive and running!');
}).listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

// التحقق من وجود التوكن
if (!process.env.BOT_TOKEN) {
    console.error('Error: BOT_TOKEN is missing in environment variables!');
    process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// أمر البدء بالخاص
bot.start((ctx) => {
    return ctx.reply('أهلاً بك يا قلبي! البوت يعمل بنجاح وثبات تام.');
});

// الرد الفوري على الرسائل في القروبات والخاص للتأكد من الاستجابة
bot.on('message', async (ctx) => {
    try {
        if (!ctx.message || !ctx.message.text) return;
        const text = ctx.message.text.trim();

        // الرد على كلمة رتبتي أو توريف للتجربة
        if (text === 'رتبتي' || text === '/رتبتي') {
            return ctx.reply(`• رتبتك هي ↤ ｢ Dev🎖️ ｣\n• آي دي حسابك ↤ ${ctx.from.id}`);
        }

        if (/toraif|توريف|إيفي|evy/i.test(text)) {
            return ctx.reply('• عيون المطورين (توريف وإيفي) 🤍');
        }

        if (ctx.chat.type !== 'private') {
            console.log('تم استلام رسالة في القروب:', text);
        }
    } catch (e) {
        console.log('Error in message handler:', e);
    }
});

// تشغيل البوت بسلاسة
bot.launch().then(() => {
    console.log('Bot has successfully started via Polling!');
}).catch((err) => {
    console.error('Failed to launch bot:', err);
});

// التعامل مع الإغلاق الآمن
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
