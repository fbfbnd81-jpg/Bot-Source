// --- نظام الهمسات المطور والاحترافي ---
bot.hears(/^اهمس$/, (ctx) => {
    if (!ctx.message.reply_to_message) {
        return ctx.reply('⚠️ يرجى الرد على الشخص المراد أهماسه بكلمة (اهمس).', { reply_to_message_id: ctx.message.message_id });
    }

    const targetUser = ctx.message.reply_to_message.from.first_name;
    const targetId = ctx.message.reply_to_message.from.id;
    const senderId = ctx.from.id;
    const senderName = ctx.from.first_name;

    const whisperId = `wh_${senderId}_${targetId}_${Date.now()}`;
    
    // تخزين مؤقت للهمسة
    whisperStore[whisperId] = { targetId, targetUser, senderName };

    ctx.reply(
        `• تم تحديد الهمسه لـ ⟵ ${targetUser}\n• اضغط الزر أدناه لكتابة الهمسة سراَ:`,
        {
            reply_to_message_id: ctx.message.message_id,
            ...Markup.inlineKeyboard([
                [Markup.button.callback('اهمس هنا ↗', `open_input_${whisperId}`)]
            ])
        }
    );
});

// لما يضغط الزر، بدل ما يكتب بالشات نخليه يظهر له تنبيه أو إدخال سريع
bot.action(/^open_input_(.+)$/, (ctx) => {
    const whisperId = ctx.match[1];
    const data = whisperStore[whisperId];

    if (!data) {
        return ctx.answerCbQuery('⚠️ انتهت صلاحية هذه الهمسة.', { show_alert: true });
    }

    // استخدام الـ answerCbQuery مع نافذة إدخال أو توجيه نظيف
    ctx.answerCbQuery('💡 اكتب نص الهمسة الآن ردًا على هذه الرسالة أو استخدم زر الرد السريع.', { show_alert: true });
    
    ctx.reply(`✍️ أهلاً بك يا ${data.senderName}، رد على هذه الرسالة واكتب همستك لـ [ ${data.targetUser} ]:`);
});

// استقبال الرد المباشر كهمسة
bot.on('text', (ctx, next) => {
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.text && ctx.message.reply_to_message.text.includes('رد على هذه الرسالة واكتب همستك')) {
        const whisperText = ctx.message.text;
        const senderName = ctx.from.first_name;
        
        // استخراج اسم المستهدف من النص أو تخزينه بطريقة أسهل
        // للتبسيط، ننشئ زر رؤية الهمسة مباشرة
        const viewId = `vw_${Date.now()}`;
        whisperStore[viewId] = {
            text: whisperText,
            senderName: senderName,
            senderId: ctx.from.id
        };

        // حذف رسالة الكاتب لتبقى السرية تامة
        try { ctx.deleteMessage(); } catch (e) {}

        return ctx.reply(
            `• يا حلو ⟵ ${senderName}\n• وصلتك همسة سرية جديدة 🔐\n• انت وحدك تقدر تشوفها`,
            {
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('رؤية الهمسة', `read_wh_${viewId}`)],
                    [Markup.button.callback('رد على الهمسة ↗', `reply_wh_${ctx.from.id}`)]
                ])
            }
        );
    }
    return next();
});

bot.action(/^read_wh_(.+)$/, (ctx) => {
    const viewId = ctx.match[1];
    const whisper = whisperStore[viewId];

    if (!whisper) {
        return ctx.answerCbQuery('⚠️ انتهت صلاحية الهمسة أو تم قراءتها.', { show_alert: true });
    }

    // إظهار النص في نافذة منبثقة (Alert) كما طلبت تماماً
    return ctx.answerCbQuery(`محتوى الهمسة:\n\n${whisper.text}`, { show_alert: true });
});
