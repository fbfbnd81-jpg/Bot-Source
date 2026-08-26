const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

// مبرمجي البوت والمطورين الأساسيين
const developers = ['j4xa7', 'to6ri']; // يوزرات المطورين بدون @

// حالة الألعاب في البوت
let gamesEnabled = true;

// دالة التحقق هل المستخدم مطور أو مشرف
async function checkAdminOrDev(ctx) {
    const userId = ctx.from.username;
    if (developers.includes(userId)) return true;

    try {
        const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
        if (member.status === 'creator' || member.status === 'administrator') {
            return true;
        }
    } catch (e) {
        if (ctx.chat.type === 'private' && developers.includes(userId)) return true;
    }
    return false;
}

// دالة التحقق من رتبة المالك الأساسي أو فوقه
async function checkOwnerOrAbove(ctx) {
    const userId = ctx.from.username;
    if (developers.includes(userId)) return true;

    try {
        const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
        if (member.status === 'creator') {
            return true;
        }
    } catch (e) {}
    return false;
}

// رسالة الرفض بالشكل المطلوب
const deniedMsg = '• هذا الامر يخص ↤ ｢ Dev 🎖 ｣';

// 1. أمر البدء (Start)
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

// 2. قائمة المساعدة
bot.command('help', (ctx) => {
    ctx.reply('قائمة الأوامر المتاحة:\n1. تفعيل / تقفيل الألعاب\n2. [ 1 ] حذف الملصق بالرد\n3. [ مم / خخ ] فك الكتم\n4. كتم / تقييد / همسه / بحث_اغاني', {
        reply_to_message_id: ctx.message.message_id
    });
});

// 3. نظام تنظيف الملصقات عبر الرقم (1) - بالرد على الملصق
bot.hears('1', async (ctx) => {
    const authorized = await checkAdminOrDev(ctx);
    if (!authorized) return ctx.reply(deniedMsg, { reply_to_message_id: ctx.message.message_id });
    
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.sticker) {
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.reply_to_message.message_id);
            await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
        } catch (e) {
            return ctx.reply('❌ تأكد من صلاحيات البوت لحذف الرسائل.', { reply_to_message_id: ctx.message.message_id });
        }
    } else {
        ctx.reply('⚠️ يرجى الرد على الملصق المراد حذفه وإرسال 1.', { reply_to_message_id: ctx.message.message_id });
    }
});

// 4. فك الكتم (مم / خخ) بدون رد
bot.hears('مم', async (ctx) => {
    const authorized = await checkAdminOrDev(ctx);
    if (!authorized) return ctx.reply(deniedMsg, { reply_to_message_id: ctx.message.message_id });
    ctx.reply('🔊 تم تنفيذ فك الكتم (مم) بنجاح.', { reply_to_message_id: ctx.message.message_id });
});

bot.hears('خخ', async (ctx) => {
    const authorized = await checkAdminOrDev(ctx);
    if (!authorized) return ctx.reply(deniedMsg, { reply_to_message_id: ctx.message.message_id });
    ctx.reply('🌐 تم تنفيذ فك الكتم العام (خخ) بنجاح.', { reply_to_message_id: ctx.message.message_id });
});

// 5. أمر "تقييد" (بالرد على العضو)
bot.hears(/^(?:\/)?تقييد$/, async (ctx) => {
    const authorized = await checkAdminOrDev(ctx);
    if (!authorized) return ctx.reply(deniedMsg, { reply_to_message_id: ctx.message.message_id });
    
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ يرجى الرد على رسالة العضو المراد تقييده.', { reply_to_message_id: ctx.message.message_id });
    try {
        await ctx.telegram.banChatMember(ctx.chat.id, ctx.message.reply_to_message.from.id);
        ctx.reply('🔨 تم تقييد/حظر العضو بنجاح.', { reply_to_message_id: ctx.message.message_id });
    } catch (e) { ctx.reply('❌ حدث خطأ، تأكد من صلاحيات المشرف للبوت.', { reply_to_message_id: ctx.message.message_id }); }
});

// 6. رفع القيود (للـ ديف أو المطور)
bot.hears(/^رفع القيود(?:\s+@?\w+)?$/, async (ctx) => {
    const userId = ctx.from.username;
    const isDev = developers.includes(userId);
    const authorized = await checkAdminOrDev(ctx);

    if (!isDev && !authorized) {
        return ctx.reply(deniedMsg, { reply_to_message_id: ctx.message.message_id });
    }
    ctx.reply('🔓 تم رفع القيود بنجاح.', { reply_to_message_id: ctx.message.message_id });
});

// 7. الغاء التقييد (للمالك الأساسي فقط)
bot.hears(/^الغاء التقييد(?:\s+@?\w+)?$/, async (ctx) => {
    const isOwner = await checkOwnerOrAbove(ctx);
    if (!isOwner) {
        return ctx.reply(deniedMsg, { reply_to_message_id: ctx.message.message_id });
    }
    ctx.reply('👑 تم تنفيذ "الغاء التقييد" بنجاح.', { reply_to_message_id: ctx.message.message_id });
});

// 8. تفعيل / تقفيل الألعاب
bot.hears('تفعيل الألعاب', async (ctx) => {
    const authorized = await checkAdminOrDev(ctx);
    if (!authorized) return ctx.reply(deniedMsg, { reply_to_message_id: ctx.message.message_id });
    gamesEnabled = true;
    ctx.reply('🎮 تم تفعيل الألعاب بنجاح!', { reply_to_message_id: ctx.message.message_id });
});

bot.hears('تقفيل الألعاب', async (ctx) => {
    const authorized = await checkAdminOrDev(ctx);
    if (!authorized) return ctx.reply(deniedMsg, { reply_to_message_id: ctx.message.message_id });
    gamesEnabled = false;
    ctx.reply('🛑 تم تقفيل الألعاب.', { reply_to_message_id: ctx.message.message_id });
});

// 9. أوامر الإشراف الأساسية (كتم، فك كتم)
bot.hears(/^(?:\/)?كتم$/, async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ يرجى الرد على رسالة العضو.', { reply_to_message_id: ctx.message.message_id });
    try {
        await ctx.telegram.restrictChatMember(ctx.chat.id, ctx.message.reply_to_message.from.id, { 
            permissions: { can_send_messages: false } 
        });
        ctx.reply('🔇 تم كتم العضو بنجاح.', { reply_to_message_id: ctx.message.message_id });
    } catch (e) { ctx.reply('❌ حدث خطأ تأكد من صلاحيات البوت.', { reply_to_message_id: ctx.message.message_id }); }
});

bot.hears(/^(?:\/)?فك_كتم$/, async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ يرجى الرد على رسالة العضو.', { reply_to_message_id: ctx.message.message_id });
    try {
        await ctx.telegram.restrictChatMember(ctx.chat.id, ctx.message.reply_to_message.from.id, { 
            permissions: { can_send_messages: true, can_send_media_messages: true, can_send_other_messages: true, can_add_web_page_previews: true } 
        });
        ctx.reply('🔊 تم فك الكتم بنجاح.', { reply_to_message_id: ctx.message.message_id });
    } catch (e) { ctx.reply('❌ حدث خطأ.', { reply_to_message_id: ctx.message.message_id }); }
});

// 10. نظام الرتب
const ranks = ['مميز', 'مالك', 'مالك اساسي', 'ميث', 'اكسترا', 'ديف', 'مطور اساسي'];
ranks.forEach(rank => {
    bot.hears(new RegExp(`^(?:\\/)?${rank}$`), (ctx) => {
        if (!ctx.message.reply_to_message) return ctx.reply(`⚠️ الرد على العضو مطلوب لتعيين رتبة: ${rank}`, { reply_to_message_id: ctx.message.message_id });
        const targetUser = ctx.message.reply_to_message.from.first_name;
        ctx.reply(`✨ تم تعيين رتبة [ ${rank} ] للعضو ${targetUser} بنجاح!`, { reply_to_message_id: ctx.message.message_id });
    });
});

// 11. الهمسات وبحث الأغاني والزواج
bot.hears(/^(?:\/)?همسه(?:\s+(.+))?$/, async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ يرجى الرد على رسالة الشخص.', { reply_to_message_id: ctx.message.message_id });
    const sender = ctx.from.first_name;
    const recipient = ctx.message.reply_to_message.from.first_name;
    const text = ctx.match[1] || 'رسالة سرية';
    try {
        await ctx.deleteMessage();
        ctx.reply(`🔒 همسة سرية من **${sender}** إلى **${recipient}**:\n${text}`);
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
    if (text === 'المالك') return ctx.reply('👑 بروفايل المالك الأساسي:\nحسابي: @j4xa7\nالمطورة: @to6ri', { reply_to_message_id: ctx.message.message_id });

    if (text.startsWith('زواج') && ctx.message.reply_to_message) {
        if (!gamesEnabled) return ctx.reply('🛑 عذراً، الألعاب مقفلة حالياً.', { reply_to_message_id: ctx.message.message_id });
        const groom = ctx.from.first_name;
        const bride = ctx.message.reply_to_message.from.first_name;
        const details = text.replace('زواج', '').trim();
        return ctx.reply(`💍 ألف ألف مبروك الزواج!\nالعريس: ${groom}\nالعروسة: ${bride}\nالتفاصيل والمهر: ${details}`, { reply_to_message_id: ctx.message.message_id });
    }
});

bot.launch();
console.log('Bot is running...');
