const { Telegraf, Markup } = require('telegraf');
const http = require('http');
const fs = require('fs');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Torayf Bot is active!');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf('8963407967:AAEMfQ6NkTtIDY4f6b4palcck3TU82cOXQg');

const devPanelText = `أهلًا بك عزيزي في لوحة تحكم المطور
━━━━━━━━━━━━━━━
أوامر التحكم والتفعيل :
تحديد عدد الأعضاء + العدد
تفعيل - تعطيل الردود العامة
تفعيل - تعطيل البنك العام
تفعيل التواصل
الاشتراك الإجباري
تعديل الاشتراك الإجباري
━━━━━━━━━━━━━━━`;

const channelsPanelText = `أهلًا بك عزيزي في قائمة أوامر القنوات
━━━━━━━━━━━━━━━
ربط قناة ربط البوت بالقناة وتشغيل الخدمات فيها
فك ربط قناة إزالة القناة المرتبطة بالبوت
━━━━━━━━━━━━━━━`;

const gamesPanelText = `قائمة الألعاب والفعاليات المتاحة
━━━━━━━━━━━━━━━
لعبة عرض الألعاب المتاحة
العاب قائمة الألعاب
فعالية عرض الفعاليات المتاحة
تسلية فعالية تسلية عشوائية
━━━━━━━━━━━━━━━`;

const membersPanelText = `قسم الأعضاء
━━━━━━━━━━━━━━━
معلوماتي عرض معلوماتك
ايدي عرض إيديك
رتبتي عرض رتبتك
نقاطي عرض نقاطك
━━━━━━━━━━━━━━━`;

const adminPanelText = `قسم الإدارة
━━━━━━━━━━━━━━━
المشرفين عرض قائمة المشرفين
معلومات القروب عرض معلومات القروب
رفع / تنزيل العضو
طرد / حظر / كتم العضو
━━━━━━━━━━━━━━━`;

const protectionPanelText = `قسم الحماية
━━━━━━━━━━━━━━━
الحماية عرض إعدادات الحماية
حماية تفعيل الحماية
تعطيل الحماية تعطيل الحماية
الروابط تشغيل أو إيقاف منع الروابط
━━━━━━━━━━━━━━━`;

async function showCommandsMenu(ctx, isEdit = false) {
    const text = 'أهلًا بك يا مطورنا في لوحة الأوامر';
    const markup = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'أوامر التفاعل والأعضاء', callback_data: 'cmd_members' },
                    { text: 'أوامر الحماية والتسلية', callback_data: 'cmd_protection' }
                ],
                [
                    { text: 'أوامر الرفع والربط', callback_data: 'cmd_channels' },
                    { text: 'أوامر الميديا والبحث والألعاب', callback_data: 'cmd_games' }
                ],
                [
                    { text: 'أوامر لوحة المطور', callback_data: 'cmd_dev' },
                    { text: 'أوامر الإدارة', callback_data: 'cmd_admin' }
                ],
                [
                    { text: 'إخفاء الأمر', callback_data: 'hide_message' }
                ]
            ]
        }
    };
    if (isEdit) {
        return ctx.editMessageText(text, markup);
    }
    return ctx.reply(text, markup);
}

bot.start(async (ctx) => {
    return ctx.reply('أهلاً بك في البوت! يعمل الآن بشكل نظيف.');
});

bot.action('cmd_dev', async (ctx) => {
    try {
        await ctx.editMessageText(devPanelText, {
            reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'back_to_main' }], [{ text: 'إخفاء الأمر', callback_data: 'hide_message' }]] }
        });
    } catch (e) {}
});

bot.action('cmd_channels', async (ctx) => {
    try {
        await ctx.editMessageText(channelsPanelText, {
            reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'back_to_main' }], [{ text: 'إخفاء الأمر', callback_data: 'hide_message' }]] }
        });
    } catch (e) {}
});

bot.action('cmd_games', async (ctx) => {
    try {
        await ctx.editMessageText(gamesPanelText, {
            reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'back_to_main' }], [{ text: 'إخفاء الأمر', callback_data: 'hide_message' }]] }
        });
    } catch (e) {}
});

bot.action('cmd_members', async (ctx) => {
    try {
        await ctx.editMessageText(membersPanelText, {
            reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'back_to_main' }], [{ text: 'إخفاء الأمر', callback_data: 'hide_message' }]] }
        });
    } catch (e) {}
});

bot.action('cmd_admin', async (ctx) => {
    try {
        await ctx.editMessageText(adminPanelText, {
            reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'back_to_main' }], [{ text: 'إخفاء الأمر', callback_data: 'hide_message' }]] }
        });
    } catch (e) {}
});

bot.action('cmd_protection', async (ctx) => {
    try {
        await ctx.editMessageText(protectionPanelText, {
            reply_markup: { inline_keyboard: [[{ text: 'رجوع', callback_data: 'back_to_main' }], [{ text: 'إخفاء الأمر', callback_data: 'hide_message' }]] }
        });
    } catch (e) {}
});

bot.action('back_to_main', async (ctx) => {
    try {
        await showCommandsMenu(ctx, true);
    } catch (e) {}
});

bot.action('hide_message', async (ctx) => {
    try { 
        await ctx.deleteMessage(); 
    } catch(e) {}
});

bot.on('message', async (ctx) => {
    try {
        if (!ctx.message || !ctx.message.text) return;
        const text = ctx.message.text.trim();
        const lowerText = text.toLowerCase();

        // تفعيل الاستجابة المباشرة لكلمات الأوامر
        if (['الأوامر', 'اوامر', 'تورايف', '|||', 'قائمة الاوامر', 'قائمة الأوامر', 'الاورامر'].includes(text) || lowerText === 'الاورامر') {
            return showCommandsMenu(ctx, false);
        }

        if (lowerText === 'معلوماتي' || lowerText === 'ايدي') {
            return ctx.reply(`معلوماتك:\nالآيدي: ${ctx.from.id}\nالاسم: ${ctx.from.first_name}`);
        }
    } catch (e) {}
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
