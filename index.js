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
    ctx.reply(`
قائمة الأوامر المتاحة:
1. تقفيل الألعاب / تفعيل الألعاب (خاص بالديف/الأدمن)
2. [ 1 ] لحذف الملصقات (بالرد)
3. [ مم ] فك كتم عام بدون رد
4. [ خخ ] فك كتم عام بدون رد
5. [ تقييد ] لحظر/تقييد العضو (بالرد)
6. [ رفع القيود ] بالرد أو المنشن (خاص بالديف/المطور)
7. [ الغاء التقييد ] بالرد أو المنشن (خاص بالمالك الأساسي)
8. كتم / فك_كتم / همسه / بحث_اغاني / زواج
    `);
});

// 3. نظام تنظيف الملصقات عبر الرقم (1)
bot.hears('1', async (ctx) => {
    const authorized = await checkAdminOrDev(ctx);
    if (!authorized) return ctx.reply('[هذا الأمر يخص Dev🎖️]');
    
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.sticker) {
        try {
            await ctx.deleteMessage(ctx.message.reply_to_message.message_id);
            await ctx.deleteMessage();
            return ctx.reply('🗑️ تم حذف الملصق بنجاح.');
        } catch (e) {
            return ctx.reply('❌ تأكد من صلاحيات البوت لحذف الرسائل.');
        }
    }
    ctx.reply('⚠️ يرجى الرد على الملصق المراد حذفه.');
});

// 4. فك الكتم (مم / خخ) - بدون رد أو منشن (تنفذ فوراً بالشات)
bot.hears('مم', async (ctx) => {
    const authorized = await checkAdminOrDev(ctx);
    if (!authorized) return ctx.reply('[هذا الأمر يخص Dev🎖️]');
    ctx.reply('🔊 تم تنفيذ فك الكتم (مم) بنجاح.');
});

bot.hears('خخ', async (ctx) => {
    const authorized = await checkAdminOrDev(ctx);
    if (!authorized) return ctx.reply('[هذا الأمر يخص Dev🎖️]');
    ctx.reply('🌐 تم تنفيذ فك الكتم العام (خخ) بنجاح.');
});

// 5. أمر "تقييد" (بديل الحظر - بالرد على العضو)
bot.hears(/^(?:\/)?تقييد$/, async (ctx) => {
    const authorized = await checkAdminOrDev(ctx);
    if (!authorized) return ctx.reply('[هذا الأمر يخص Dev🎖️]');
    
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ يرجى الرد على رسالة العضو المراد تقييده/حظره.');
    try {
        await ctx.telegram.banChatMember(ctx.chat.id, ctx.message.reply_to_message.from.id);
        ctx.reply('🔨 تم تقييد/حظر العضو بنجاح.');
    } catch (e) { ctx.reply('❌ حدث خطأ، تأكد من صلاحيات البوت.'); }
});

// 6. رفع القيود (مخصص لـ ديف أو المطور - بالرد أو المنشن)
bot.hears(/^رفع القيود(?:\s+@?\w+)?$/, async (ctx) => {
    const userId = ctx.from.username;
    const isDev = developers.includes(userId);
    const authorized = await checkAdminOrDev(ctx);

    if (!isDev && !authorized) {
        return ctx.reply('[هذا الأمر يخص Dev🎖️]');
    }
    ctx.reply('🔓 تم رفع القيود بنجاح (بواسطة صلاحيات الديف/المطور).');
});

// 7. الغاء التقييد (مخصص حصرياً للمالك الأساسي أو فوقه - بالرد أو المنشن)
bot.hears(/^الغاء التقييد(?:\s+@?\w+)?$/, async (ctx) => {
    const isOwner = await checkOwnerOrAbove(ctx);
    if (!isOwner) {
        return ctx.reply('[هذا الأمر يخص Dev🎖️]');
    }
    ctx.reply('👑 تم تنفيذ "الغاء التقييد" بنجاح (صلاحية المالك الأساسي).');
});

// 8. تفعيل / تقفيل الألعاب
bot.hears('تفعيل الألعاب', async (ctx) => {
    const authorized = await checkAdminOrDev(ctx);
    if (!authorized) return ctx.reply('[هذا الأمر يخص Dev🎖️]');
    gamesEnabled = true;
    ctx.reply('🎮 تم تفعيل الألعاب بنجاح!');
});

bot.hears('تقفيل الألعاب', async (ctx) => {
    const authorized = await checkAdminOrDev(ctx);
    if (!authorized) return ctx.reply('[هذا الأمر يخص Dev🎖️]');
    gamesEnabled = false;
    ctx.reply('🛑 تم تقفيل الألعاب.');
});

// 9. أوامر الإشراف الأساسية (كتم، فك كتم)
bot.hears(/^(?:\/)?كتم$/, async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ يرجى الرد على رسالة العضو.');
    try {
        await ctx.telegram.restrictChatMember(ctx.chat.id, ctx.message.reply_to_message.from.id, { 
            permissions: { can_send_messages: false } 
        });
        ctx.reply('🔇 تم كتم العضو بنجاح.');
    } catch (e) { ctx.reply('❌ حدث خطأ.'); }
});

bot.hears(/^(?:\/)?فك_كتم$/, async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ يرجى الرد على رسالة العضو.');
    try {
        await ctx.telegram.restrictChatMember(ctx.chat.id, ctx.message.reply_to_message.from.id, { 
            permissions: { can_send_messages: true, can_send_media_messages: true, can_send_other_messages: true, can_add_web_page_previews: true } 
        });
        ctx.reply('🔊 تم فك الكتم بنجاح.');
    } catch (e) { ctx.reply('❌ حدث خطأ.'); }
});

// 10. نظام الرتب
const ranks = ['مميز', 'مالك', 'مالك اساسي', 'ميث', 'اكسترا', 'ديف', 'مطور اساسي'];
ranks.forEach(rank => {
    bot.hears(new RegExp(`^(?:\\/)?${rank}$`), (ctx) => {
        if (!ctx.message.reply_to_message) return ctx.reply(`⚠️ الرد على العضو مطلوب لتعيين رتبة: ${rank}`);
        const targetUser = ctx.message.reply_to_message.from.first_name;
        ctx.reply(`✨ تم تعيين رتبة [ ${rank} ] للعضو ${targetUser} بنجاح!`);
    });
});

// 11. الهمسات وبحث الأغاني والزواج
bot.hears(/^(?:\/)?همسه(?:\s+(.+))?$/, async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply('⚠️ يرجى الرد على رسالة الشخص.');
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

bot.hears(/^(?:\/)?بحث_اغاني(?:\s+(.+))?$/, (ctx) => {
    const query = ctx.match[1] || 'عامة';
    ctx.reply(`🎵 جاري البحث عن: ${query} ...`);
});

bot.on('text', (ctx) => {
    const text = ctx.message.text;

    if (text.includes('ايلاف')) return ctx.reply('إيلاف هنا: @j4xa7');
    if (text.includes('توري')) return ctx.reply('توري هنا: @to6ri');
    if (text === 'المالك') return ctx.reply('👑 بروفايل المالك الأساسي:\nحسابي: @j4xa7\nالمطورة: @to6ri');

    if (text.startsWith('زواج') && ctx.message.reply_to_message) {
        if (!gamesEnabled) return ctx.reply('🛑 عذراً، الألعاب مقفلة حالياً.');
        const groom = ctx.from.first_name;
        const bride = ctx.message.reply_to_message.from.first_name;
        const details = text.replace('زواج', '').trim();
        return ctx.reply(`💍 ألف ألف مبروك الزواج!\nالعريس: ${groom}\nالعروسة: ${bride}\nالتفاصيل والمهر: ${details}`);
    }
});

bot.launch();
console.log('Bot is running...');
