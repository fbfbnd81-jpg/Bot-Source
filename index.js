const { Telegraf } = require('telegraf');
const http = require('http');

// هذا السيرفر ياخذ البورت من ريلواي بشكل صحيح ومضمون
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
    return ctx.reply('أهلاً بك يا قلبي! البوت يعمل بنجاح.');
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

bot.launch().then(() => {
    console.log('Bot is listening to messages successfully!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
