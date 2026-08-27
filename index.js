const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

// أمر البداية
bot.start((ctx) => {
    return ctx.reply('أهلاً بك يا قلبي! البوت يعمل بنجاح.');
});

// الرد على الأوامر والرسائل بكل سلاسة
bot.on('message', async (ctx) => {
    try {
        if (!ctx.message || !ctx.message.text) return;
        const text = ctx.message.text.trim();

        // أمر رتبتي
        if (text === 'رتبتي' || text === '/رتبتي') {
            return ctx.reply(`• رتبتك هي ↤ ｢ Dev🎖️ ｣\n• آي دي حسابك ↤ ${ctx.from.id}`);
        }

        // الرد على المطورين
        if (/toraif|توريف|إيفي|evy/i.test(text)) {
            return ctx.reply('• عيون المطورين (توريف وإيفي) 🤍');
        }
    } catch (e) {
        console.log('Error:', e);
    }
});

// تشغيل البوت
bot.launch().then(() => {
    console.log('Bot is running successfully!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
