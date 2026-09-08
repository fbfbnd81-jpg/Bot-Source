const { Telegraf } = require('telegraf');

const bot = new Telegraf('8963407967:AAEMfQ6NkTtIDY4f6b4palcck3TU82cOXQg');

// أمر البداية للخاص
bot.start((ctx) => {
    return ctx.reply('أهلاً بك! تم تشغيل البوت بنجاح تام.');
});

// قائمة الأوامر التفاعلية
function sendMenu(ctx) {
    return ctx.reply('أهلاً بك في لوحة أوامر تورايف', {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'أوامر الأعضاء', callback_data: 'members' },
                    { text: 'أوامر الحماية', callback_data: 'protection' }
                ],
                [
                    { text: 'إخفاء القائمة', callback_data: 'hide' }
                ]
            ]
        }
    });
}

// الاستجابة عبر الأوامر الرسمية المباشرة
bot.command(['start', 'help', 'commands', 'الاوامر', 'اوامر'], (ctx) => {
    return sendMenu(ctx);
});

// الاستجابة للكلمات النصية داخل المجموعة والخاص
bot.on('text', (ctx) => {
    const text = ctx.message.text.trim();
    if (['الاوامر', 'اوامر', 'تورايف', 'قائمة الاوامر'].includes(text)) {
        return sendMenu(ctx);
    }
});

// أزرار اللوحة التفاعلية
bot.action('members', (ctx) => {
    ctx.answerCbQuery();
    return ctx.editMessageText('قسم الأعضاء يعمل بنجاح.', {
        reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'back' }]] }
    });
});

bot.action('protection', (ctx) => {
    ctx.answerCbQuery();
    return ctx.editMessageText('قسم الحماية يعمل بنجاح.', {
        reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'back' }]] }
    });
});

bot.action('back', (ctx) => {
    ctx.answerCbQuery();
    return ctx.editMessageText('أهلاً بك في لوحة أوامر تورايف', {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'أوامر الأعضاء', callback_data: 'members' },
                    { text: 'أوامر الحماية', callback_data: 'protection' }
                ],
                [
                    { text: 'إخفاء القائمة', callback_data: 'hide' }
                ]
            ]
        }
    });
});

bot.action('hide', (ctx) => {
    try {
        ctx.deleteMessage();
    } catch (e) {}
});

// تشغيل البوت
bot.launch().then(() => {
    console.log('Bot is running successfully!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
