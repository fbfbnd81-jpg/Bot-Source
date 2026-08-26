const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

// مبرمجي البوت (حط معرفات التليجرام الرقمية أو الـ Usernames هنا)
const developers = ['j4xa7', 'to6ri']; // حطوا يوزراتكم بدون @

bot.start((ctx) => {
    ctx.reply('مرحباً بك! تم تشغيل بوت الإشراف والفعاليات بنجاح.\n\nاكتب /help لعرض قائمة الأوامر المتاحة.');
});

// قائمة الأوامر بالعربي
bot.command('help', (ctx) => {
    ctx.reply(`
قائمة الأوامر المتاحة:
1. كتم / فك كتم (بالرد على الرسالة)
2. تقييد / فك تقييد (بالرد على الرسالة)
3. حظر / فك حظر (بالرد على الرسالة)
4. رتبة مميز، مالك، مالك اساسي، ميث، اكسترا، ديف، مطور اساسي
5. همسه (إرسال رسالة خاصة)
6. بحث اغاني
7. زواج (بالرد على الشخص + كتابة المهر ورقم)
8. المالك
    `);
});

// 1. الكتم، التقييد، الحظر (تتم بالرد على الرسالة)
bot.command('كتم', async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ الرد على رسالة العضو مطلوب.');
    const chatId = ctx.chat.id;
    const userId = ctx.message.reply_to_message.from.id;
    try {
        await ctx.telegram.restrictChatMember(chatId, userId, { permissions: { can_send_messages: false } });
        ctx.reply('🔇 تم كتم العضو بنجاح.');
    } catch (e) { ctx.reply('❌ حدث خطأ، تأكد من صلاحيات البوت.'); }
});

bot.command('فك_كتم', async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ الرد على رسالة العضو مطلوب.');
    const chatId = ctx.chat.id;
    const userId = ctx.message.reply_to_message.from.id;
    try {
        await ctx.telegram.restrictChatMember(chatId, userId, { permissions: { can_send_messages: true, can_send_media_messages: true, can_send_other_messages: true, can_add_web_page_previews: true } });
        ctx.reply('🔊 تم فك الكتم بنجاح.');
    } catch (e) { ctx.reply('❌ حدث خطأ.'); }
});

bot.command('حظر', async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ الرد على رسالة العضو مطلوب.');
    const chatId = ctx.chat.id;
    const userId = ctx.message.reply_to_message.from.id;
    try {
        await ctx.telegram.banChatMember(chatId, userId);
        ctx.reply('🔨 تم حظر العضو بنجاح.');
    } catch (e) { ctx.reply('❌ حدث خطأ.'); }
});

// 2. نظام الرتب (رفع رتب)
const ranks = ['مميز', 'مالك', 'مالك اساسي', 'ميث', 'اكسترا', 'ديف', 'مطور اساسي'];
ranks.forEach(rank => {
    bot.command(rank, (ctx) => {
        if (!ctx.message.reply_to_message) return ctx.reply(`⚠️ الرد على العضو مطلوب لتعيين رتبة: ${rank}`);
        const targetUser = ctx.message.reply_to_message.from.first_name;
        ctx.reply(`✨ تم تعيين رتبة [ ${rank} ] للعضو ${targetUser} بنجاح!`);
    });
});

// 3. همسة (مثال توضيحي)
bot.command('همسه', (ctx) => {
    ctx.reply('🔒 هذه الخاصية تستخدم لإرسال رسائل سرية، اكتب النص مع الأمر.');
});

// 4. بحث أغاني (بحث تجريبي)
bot.command('بحث_اغاني', (ctx) => {
    ctx.reply('🎵 جاري البحث عن الأغنية المطلوبة... (أدخل اسم الأغنية بعد الأمر)');
});

// 5. تفاعلات الشات والمنشن التلقائي والمالك والألعاب والزواج
bot.on('text', (ctx) => {
    const text = ctx.message.text;

    // المنشن التلقائي للأسماء
    if (text.includes('ايلاف')) {
        return ctx.reply('إيلاف هنا: @j4xa7');
    }
    if (text.includes('توري')) {
        return ctx.reply('توري هنا: @to6ri');
    }

    // أمر المالك
    if (text === 'المالك') {
        return ctx.reply('👑 بروفايل المالك الأساسي:\nحسابي: @j4xa7\nالمطورة: @to6ri');
    }

    // 6. فعالية الزواج (بالرد على رسالة شخص + كتابة زواج والمهر ورقم)
    if (text.startsWith('زواج') && ctx.message.reply_to_message) {
        const groom = ctx.from.first_name;
        const bride = ctx.message.reply_to_message.from.first_name;
        const details = text.replace('زواج', '').trim(); // ياخذ المهر ورقم
        return ctx.reply(`💍 ألف ألف مبروك الزواج!\nالعريس: ${groom}\nالعروسة: ${bride}\nالتفاصيل والمهر: ${details}\nبالتوفيق لكم! 🎉`);
    }

    // 7. ألعاب خفيفة (مثلاً كلمات أو مقالات أو العاب جماعية)
    if (text === 'لعبة كلمات') {
        ctx.reply('🎮 لعبة الكلمات: رتب الحرفين الآتيين (ق م ل) لتصبح كلمة مفيدة!');
    }
});

bot.launch();
console.log('Bot is running...');
