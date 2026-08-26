const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

bot.start((ctx) => {
    ctx.reply('مرحباً بك! تم تشغيل بوت الإشراف والفعاليات بنجاح.\n\nاكتب /help لعرض قائمة الأوامر المتاحة.');
});

bot.command('help', (ctx) => {
    ctx.reply(`
قائمة الأوامر المتاحة:
1. كتم / فك_كتم (بالرد على الرسالة)
2. تقييد / فك_تقييد (بالرد على الرسالة)
3. حظر (بالرد على الرسالة)
4. رتبة: مميز، مالك، مالك اساسي، ميث، اكسترا، ديف، مطور اساسي
5. همسه
6. بحث_اغاني
7. زواج (بالرد على الشخص + كتابة المهر ورقم)
8. المالك
    `);
});

bot.command('كتم', async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ الرد على رسالة العضو مطلوب.');
    try {
        await ctx.telegram.restrictChatMember(ctx.chat.id, ctx.message.reply_to_message.from.id, { permissions: { can_send_messages: false } });
        ctx.reply('🔇 تم كتم العضو بنجاح.');
    } catch (e) { ctx.reply('❌ حدث خطأ، تأكد من صلاحيات البوت.'); }
});

bot.command('فك_كتم', async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ الرد على رسالة العضو مطلوب.');
    try {
        await ctx.telegram.restrictChatMember(ctx.chat.id, ctx.message.reply_to_message.from.id, { permissions: { can_send_messages: true, can_send_media_messages: true, can_send_other_messages: true, can_add_web_page_previews: true } });
        ctx.reply('🔊 تم فك الكتم بنجاح.');
    } catch (e) { ctx.reply('❌ حدث خطأ.'); }
});

bot.command('حظر', async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ الرد على رسالة العضو مطلوب.');
    try {
        await ctx.telegram.banChatMember(ctx.chat.id, ctx.message.reply_to_message.from.id);
        ctx.reply('🔨 تم حظر العضو بنجاح.');
    } catch (e) { ctx.reply('❌ حدث خطأ.'); }
});

const ranks = ['مميز', 'مالك', 'مالك_اساسي', 'ميث', 'اكسترا', 'ديف', 'مطور_اساسي'];
ranks.forEach(rank => {
    bot.command(rank, (ctx) => {
        if (!ctx.message.reply_to_message) return ctx.reply('⚠️ الرد على العضو مطلوب لتعيين الرتبة.');
        ctx.reply(`✨ تم تعيين الرتبة بنجاح!`);
    });
});

bot.on('text', (ctx) => {
    const text = ctx.message.text;

    if (text.includes('ايلاف')) return ctx.reply('إيلاف هنا: @j4xa7');
    if (text.includes('توري')) return ctx.reply('توري هنا: @to6ri');

    if (text === 'المالك') {
        return ctx.reply('👑 بروفايل المالك:\nحسابي: @j4xa7\nالمطورة: @to6ri');
    }

    if (text.startsWith('زواج') && ctx.message.reply_to_message) {
        const groom = ctx.from.first_name;
        const bride = ctx.message.reply_to_message.from.first_name;
        const details = text.replace('زواج', '').trim();
        return ctx.reply(`💍 ألف ألف مبروك الزواج!\nالعريس: ${groom}\nالعروسة: ${bride}\nالمهر والتفاصيل: ${details}\nبالتوفيق لكم! 🎉`);
    }

    if (text === 'لعبة كلمات') {
        return ctx.reply('🎮 لعبة الكلمات: رتب الحرفين (ق م ل) لتصبح كلمة مفيدة!');
    }
});

bot.launch();
