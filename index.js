const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

// مسح أي ويبهوك عالق تلقائياً عند التشغيل لتجنب تعارض الـ Polling
bot.telegram.deleteWebhook({ drop_pending_updates: true }).then(() => {
    console.log('Webhook cleared successfully!');
});

bot.start((ctx) => ctx.reply('البوت شغال وثابت!'));

bot.on('message', async (ctx) => {
    try {
        if (!ctx.message || !ctx.message.text) return;
        const text = ctx.message.text.trim();

        if (text === 'رتبتي' || text === '/رتبتي') {
            return ctx.reply(`• رتبتك هي ↤ ｢ Dev🎖️ ｣\n• آي دي حسابك ↤ ${ctx.from.id}`);
        }
    } catch (e) {
        console.log(e);
    }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
