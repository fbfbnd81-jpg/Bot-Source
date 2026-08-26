const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

const developers = ['j4xa7', 'to6ri'];
let gamesEnabled = true;

const deniedMsg = '• هذا الامر يخص ↤ ｢ Dev 🎖 ｣';

bot.start((ctx) => {
    const botUsername = ctx.botInfo.username;
    const userName = ctx.from.first_name;
    ctx.reply(
        `اهلا بك يا قلبي 🫶 ــ ${userName}\n\n• انا اشغل لك اللي تبي بالمكالمة\n\nادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.`,
        Markup.inlineKeyboard([
            [Markup.button.url('➕ أضفني في مجموعتك', `https://t.me/${botUsername}?startgroup=true`)],
            [Markup.button.url('👤 المطور', 'https://t.me/j4xa7')]
        ])
    );
});

bot.command('help', (ctx) => {
    ctx.reply('قائمة الأوامر:\n1. [ 1 ] حذف الرسالة\n2. كتم / فك_كتم / تقييد\n3. همسه / بحث_اغاني', {
        reply_to_message_id: ctx.message.message_id
    });
});

// 1. أمر التنظيف (1) - حذف رسالتك والملصق بالرد
bot.hears('1', async (ctx) => {
    try {
        if (ctx.message.reply_to_message) {
            await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.reply_to_message.message_id);
        }
        await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
    } catch (e) {
        ctx.reply('❌ خطأ في الحذف: تأكد من صلاحيات البوت.', { reply_to_message_id: ctx.message.message_id });
    }
});

// فك الكتم السريع
bot.hears('مم', (ctx) => ctx.reply('🔊 تم فك الكتم (مم).', { reply_to_message_id: ctx.message.message_id }));
bot.hears('خخ', (ctx) => ctx.reply('🌐 تم فك الكتم العام (خخ).', { reply_to_message_id: ctx.message.message_id }));

// أمر الكتم الحقيقي
bot.hears(/^(?:\/)?كتم$/, async (ctx) => {
    if (!ctx.message.reply_to_message) {
        return ctx.reply('⚠️ يرجى الرد على رسالة العضو المراد كتمه.', { reply_to_message_id: ctx.message.message_id });
    }
    try {
        const targetUserId = ctx.message.reply_to_message.from.id;
        await ctx.telegram.restrictChatMember(ctx.chat.id, targetUserId, {
            permissions: { can_send_messages: false }
        });
        ctx.reply('🔇 تم كتم العضو بنجاح.', { reply_to_message_id: ctx.message.message_id });
    } catch (e) {
        ctx.reply(`❌ فشل الكتم: ${e.message}`, { reply_to_message_id: ctx.message.message_id });
    }
});

// أمر فك الكتم الحقيقي
bot.hears(/^(?:\/)?فك_كتم$/, async (ctx) => {
    if (!ctx.message.reply_to_message) {
        return ctx.reply('⚠️ يرجى الرد على رسالة العضو.', { reply_to_message_id: ctx.message.message_id });
    }
    try {
        const targetUserId = ctx.message.reply_to_message.from.id;
        await ctx.telegram.restrictChatMember(ctx.chat.id, targetUserId, {
            permissions: { 
                can_send_messages: true, 
                can_send_media_messages: true, 
                can_send_other_messages: true, 
                can_add_web_page_previews: true 
            }
        });
        ctx.reply('🔊 تم فك الكتم عن العضو بنجاح.', { reply_to_message_id: ctx.message.message_id });
    } catch (e) {
        ctx.reply(`❌ فشل فك الكتم: ${e.message}`, { reply_to_message_id: ctx.message.message_id });
    }
});

// أمر التقييد / الطرد
bot.hears(/^(?:\/)?تقييد$/, async (ctx) => {
    if (!ctx.message.reply_to_message) {
        return ctx.reply('⚠️ يرجى الرد على رسالة العضو المراد تقييده.', { reply_to_message_id: ctx.message.message_id });
    }
    try {
        const targetUserId = ctx.message.reply_to_message.from.id;
        await ctx.telegram.banChatMember(ctx.chat.id, targetUserId);
        ctx.reply('🔨 تم تقييد/حظر العضو بنجاح.', { reply_to_message_id: ctx.message.message_id });
    } catch (e) {
        ctx.reply(`❌ فشل التقييد: ${e.message}`, { reply_to_message_id: ctx.message.message_id });
    }
});

// الهمسات
bot.hears(/^(?:\/)?همسه(?:\s+(.+))?$/, async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ يرجى الرد على الشخص.', { reply_to_message_id: ctx.message.message_id });
    const sender = ctx.from.first_name;
    const recipient = ctx.message.reply_to_message.from.first_name;
    const text = ctx.match[1] || 'رسالة سرية';
    try {
        await ctx.deleteMessage();
        ctx.reply(`🔒 همسة سرية من **${sender}** إلى **${recipient}**:\n${text}`, { reply_to_message_id: ctx.message.reply_to_message.message_id });
    } catch (e) {
        ctx.reply(`🔒 همسة من ${sender} إلى ${recipient}:\n${text}`, { reply_to_message_id: ctx.message.message_id });
    }
});

bot.hears(/^(?:\/)?بحث_اغاني(?:\s+(.+))?$/, (ctx) => {
    const query = ctx.match[1] || 'عامة';
    ctx.reply(`🎵 جاري البحث عن: ${query} ...`, { reply_to_message_id: ctx.message.message_id });
});

bot.on('text', (ctx) => {
    const text = ctx.message.text;
    if (text.includes('ايلاف')) return ctx.reply('إيلاف هنا: @j4xa7', { reply_to_message_id: ctx.message.message_id });
    if (text.includes('توري')) return ctx.reply('توري هنا: @to6ri', { reply_to_message_id: ctx.message.message_id });
    if (text === 'المالك') return ctx.reply('👑 بروفايل المالك:\nحسابي: @j4xa7\nالمطورة: @to6ri', { reply_to_message_id: ctx.message.message_id });
});

bot.launch();
console.log('Bot is running...');
