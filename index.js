const { Telegraf, Markup } = require('telegraf');
const http = require('http');
const yts = require('yt-search'); // مكتبة البحث في يوتيوب

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Music Bot is running!');
}).listen(PORT);

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
    ctx.reply(`أهلاً بك يا قلبي 🫶\n• انا بوت الأغاني، اكتب:\nيوت [اسم الأغنية]\nوسأقوم بإرسالها هنا فوراً!`);
});

// أمر يوت لجلب الأغنية وإرسالها كملف صوتي أو صوت مباشر بالقروب
bot.hears(/^يوت\s+(.+)$/, async (ctx) => {
    const query = ctx.match[1];
    
    try {
        // رسالة انتظار لطيفة
        const waitMsg = await ctx.reply(`🎵 جارٍ البحث عن [ ${query} ]...`);

        // البحث في يوتيوب عن أول نتيجة
        const searchResult = await yts(query);
        const videos = searchResult.videos;

        if (!videos || videos.length === 0) {
            return ctx.telegram.editMessageText(ctx.chat.id, waitMsg.message_id, null, '⚠️ عذراً، لم أجد هذه الأغنية!');
        }

        const song = videos[0]; // أول نتيجة
        const botUsername = ctx.botInfo.username;

        // حذف رسالة الانتظار
        try { await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id); } catch (e) {}

        // إرسال الأغنية بنفس تنسيق البوتات الكبيرة (رسالة صوتية أو صوت مع معلومات)
        await ctx.replyWithAudio(song.url, {
            title: song.title,
            performer: song.author.name,
            caption: `🎵 ${song.title}\n👤 ${song.author.name}\n⏱️ ${song.timestamp}\n• @${botUsername}`,
            ...Markup.inlineKeyboard([
                [Markup.button.url('🌐 رابط الأغنية في يوتيوب', song.url)]
            ])
        });

    } catch (error) {
        console.error(error);
        ctx.reply('❌ حدث خطأ أثناء جلب الأغنية، تأكد من اسم الأغنية وجرب مرة أخرى.');
    }
});

bot.launch().then(() => {
    console.log('Music Bot is running and ready to send songs!');
});
