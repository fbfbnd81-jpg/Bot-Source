const { Telegraf, Markup } = require('telegraf');
const http = require('http');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Torayf Bot is active!');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf('8963407967:AAEMfQ6NkTtIDY4f6b4palcck3TU82cOXQg');

async function showCommandsMenu(ctx, isEdit = false) {
    const text = 'أهلاً بك في لوحة أوامر تورايف النظيفة';
    const markup = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'أوامر التفاعل والأعضاء', callback_data: 'cmd_members' },
                    { text: 'أوامر الحماية والتسلية', callback_data: 'cmd_protection' }
                ],
                [
                    { text: 'أوامر الرفع والربط', callback_data: 'cmd_channels' },
                    { text: 'أوامر الألعاب', callback_data: 'cmd_games' }
                ],
                [
                    { text: 'أوامر المطور والإدارة', callback_data: 'cmd_dev' },
                    { text: 'إخفاء القائمة', callback_data: 'hide_message' }
                ]
            ]
        }
    };
    if (isEdit) {
        return ctx.editMessageText(text, markup).catch(() => {});
    }
    return ctx.reply(text, markup);
}

bot.command(['start', 'help', 'commands'], async (ctx) => {
    return showCommandsMenu(ctx, false);
});

bot.action('cmd_dev', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.editMessageText('لوحة المطور والإدارة تابعة للبوت النظيف.', {
        reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'back_to_main' }]] }
    }).catch(() => {});
});

bot.action('cmd_channels', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.editMessageText('قائمة أوامر القنوات والربط.', {
        reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'back_to_main' }]] }
    }).catch(() => {});
});

bot.action('cmd_games', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.editMessageText('قائمة الألعاب والفعاليات.', {
        reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'back_to_main' }]] }
    }).catch(() => {});
});

bot.action('cmd_members', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.editMessageText('قسم الأعضاء ومعلومات المستخدم.', {
        reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'back_to_main' }]] }
    }).catch(() => {});
});

bot.action('cmd_protection', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.editMessageText('قسم الحماية وإعدادات المجموعات.', {
        reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'back_to_main' }]] }
    }).catch(() => {});
});

bot.action('back_to_main', async (ctx) => {
    await ctx.answerCbQuery();
    return showCommandsMenu(ctx, true);
});

bot.action('hide_message', async (ctx) => {
    try {
        await ctx.deleteMessage();
    } catch (e) {}
});

// هنا تم إضافة التقاط الكلمات العادية في المجموعة والخاص بدقة
bot.on('text', async (ctx) => {
    try {
        const text = ctx.message.text.trim();
        const keywords = ['الاوامر', 'اوامر', 'الاورامر', 'تورايف', 'قائمة الاوامر', 'قائمة الأوامر'];
        if (keywords.includes(text)) {
            return showCommandsMenu(ctx, false);
        }
    } catch (e) {}
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
