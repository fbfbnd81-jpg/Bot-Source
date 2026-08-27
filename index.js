const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

// رد بسيط للتأكد
bot.start((ctx) => {
    return ctx.reply('أهلاً بك! البوت يعمل بنجاح.');
});

bot.on('message', async (ctx) => {
    try {
        if (!ctx.message || !ctx.message.text) return;
        const text = ctx.message.text.trim();

        if (text === 'رتبتي' || text === '/رتبتي') {
            return ctx.reply(`• رتبتك هي ↤ ｢ Dev🎖️ ｣\n• آي دي حسابك ↤ ${ctx.from.id}`);
        }

        if (/toraif|توريف|إيفي|evy/i.test(text)) {
            return ctx.reply('• عيون المطورين (توريف وإيفي) 🤍');
        }
    } catch (e) {
        console.log('Error:', e);
    }
});

// تشغيل البوت مباشرة بدون سيرفرات معقدة
bot.launch().then(() => {
    console.log('Bot is running perfectly!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
