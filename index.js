const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

// مبرمجي البوت
const developers = ['j4xa7', 'to6ri'];

// أمر البدء (Start) مع الأزرار الشفافة الفخمة
bot.start((ctx) => {
    const botUsername = ctx.botInfo.username;
    
    ctx.reply(
        'اهلا بك يا قلبي 🫶 ــ Evy\n\n• انا اشغل لك اللي تبي بالمكالمة\n\nادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.',
        Markup.inlineKeyboard([
            [Markup.button.url('➕ أضفني في مجموعتك', `https://t.me/${botUsername}?startgroup=true`)],
            [Markup.button.url('👤 المطور', 'https://t.me/j4xa7')]
        ])
    );
});

// قائمة الأوامر (مساعدة)
bot.command('help', (ctx) => {
    ctx.reply(`
قائمة الأوامر المتاحة (بالرد على الرسالة):
1. كتم / فك_كتم
2. حظر
3. مميز، مالك، مالك اساسي، ميث، اكسترا، ديف، مطور اساسي
4. همسه [النص]
5. بحث_اغاني [اسم الأغنية]
6. زواج [المهر ورقم]
7. المالك
    `);
});

// أمر الكتم
bot.hears(/^(?:\/)?كتم$/, async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ يرجى الرد على رسالة العضو المراد كتمه.');
    try {
        await ctx.telegram.restrictChatMember(ctx.chat.id, ctx.message.reply_to_message.from.id, { 
            permissions: { can_send_messages: false } 
        });
        ctx.reply('🔇 تم كتم العضو بنجاح.');
    } catch (e) { ctx.reply('❌ حدث خطأ، تأكد من صلاحيات البوت.'); }
});

// أمر فك الكتم
bot.hears(/^(?:\/)?فك_كتم$/, async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ يرجى الرد على رسالة العضو.');
    try {
        await ctx.telegram.restrictChatMember(ctx.chat.id, ctx.message.reply_to_message.from.id, { 
            permissions: { can_send_messages: true, can_send_media_messages: true, can_send_other_messages: true, can_add_web_page_previews: true } 
        });
        ctx.reply('🔊 تم فك الكتم بنجاح.');
    } catch (e) { ctx.reply('❌ حدث خطأ.'); }
});

// أمر الحظر
bot.hears(/^(?:\/)?حظر$/, async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ يرجى الرد على رسالة العضو.');
    try {
        await ctx.telegram.banChatMember(ctx.chat.id, ctx.message.reply_to_message.from.id);
        ctx.reply('🔨 تم حظر العضو بنجاح.');
    } catch (e) { ctx.reply('❌ حدث خطأ.'); }
});

// نظام الرتب
const ranks = ['مميز', 'مالك', 'مالك اساسي', 'ميث', 'اكسترا', 'ديف', 'مطور اساسي'];
ranks.forEach(rank => {
    bot.hears(new RegExp(`^(?:\\/)?${rank}$`), (ctx) => {
        if (!ctx.message.reply_to_message) return ctx.reply(`⚠️ الرد على العضو مطلوب لتعيين رتبة: ${rank}`);
        const targetUser = ctx.message.reply_to_message.from.first_name;
        ctx.reply(`✨ تم تعيين رتبة [ ${rank} ] للعضو ${targetUser} بنجاح!`);
    });
});

// نظام الهمسة
bot.hears(/^(?:\/)?همسه(?:\s+(.+))?$/, async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ يرجى الرد على رسالة الشخص المراد إرسال الهمسة له.');
    const sender = ctx.from.first_name;
    const recipient = ctx.message.reply_to_message.from.first_name;
    const text = ctx.match[1] || 'رسالة سرية';
    try {
        await ctx.deleteMessage();
        ctx.reply(`🔒 همسة سرية من **${sender}** إلى **${recipient}**:\n${text}`);
    } catch (e) {
        ctx.reply(`🔒 همسة من ${sender} إلى ${recipient}:\n${text}`);
    }
});

// بحث أغاني
bot.hears(/^(?:\/)?بحث_اغاني(?:\s+(.+))?$/, (ctx) => {
    const query = ctx.match[1] || 'عامة';
    ctx.reply(`🎵 جاري البحث عن: ${query} ...`);
});

// التفاعلات والمنشن والزواج
bot.on('text', (ctx) => {
    const text = ctx.message.text;

    if (text.includes('ايلاف')) {
        return ctx.reply('إيلاف هنا: @j4xa7');
    }
    if (text.includes('توري')) {
        return ctx.reply('توري هنا: @to6ri');
    }
    if (text === 'المالك') {
        return ctx.reply('👑 بروفايل المالك الأساسي:\nحسابي: @j4xa7\nالمطورة: @to6ri');
    }

    if (text.startsWith('زواج') && ctx.message.reply_to_message) {
        const groom = ctx.from.first_name;
        const bride = ctx.message.reply_to_message.from.first_name;
        const details = text.replace('زواج', '').trim();
        return ctx.reply(`💍 ألف ألف مبروك الزواج!\nالعريس: ${groom}\nالعروسة: ${bride}\nالتفاصيل والمهر: ${details}\nبالتوفيق لكم! 🎉`);
    }
});

bot.launch();
console.log('Bot is running...');
