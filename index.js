bot.on('callback_query', async (ctx) => {
    try {
        const data = ctx.callbackQuery.data;
        const userId = ctx.from.id;
        const name = ctx.from.first_name || 'المستخدم';

        if (data.startsWith('wh_view_')) {
            const wId = data.replace('wh_view_', '');

            if (!db.whispers || !db.whispers[wId]) {
                return ctx.answerCbQuery('انتهت صلاحية هذه الهمسة.', { show_alert: true });
            }

            const wh = db.whispers[wId];

            if (userId.toString() !== wh.targetId.toString()) {
                return ctx.answerCbQuery('الهمسه لا تخصك', { show_alert: true });
            }

            const c = wh.content;
            let alertText = '';

            if (c.type === 'sticker') {
                alertText = '📁 محتوى الهمسة: [ملصق]';
            } else if (c.type === 'photo') {
                alertText = c.caption ? `📸 ${c.caption}` : '📸 محتوى الهمسة: [صورة]';
            } else if (c.type === 'animation') {
                alertText = c.caption ? `🎥 ${c.caption}` : '🎥 محتوى الهمسة: [تحريك/GIF]';
            } else {
                alertText = c.value;
            }

            if (!wh.seen) {
                wh.seen = true;
                saveData();
                try {
                    await ctx.telegram.sendMessage(wh.senderId, `• ${name}\n• شاف همستك .\n-`);
                } catch (e) {}
            }

            // إظهار النص مباشرة كـ Alert منبثق كما طلبت
            return ctx.answerCbQuery(alertText, { show_alert: true });
        }

        if (data.startsWith('prm_')) {
            const parts = data.split('_');
            const menuId = parts[1];
            const action = parts[2];

            if (!db.adminMenus || !db.adminMenus[menuId]) {
                return ctx.answerCbQuery('القائمة صالحة ومحفوظة ✓');
            }

            const menu = db.adminMenus[menuId];
            const p = menu.p;

            if (action === 'hide') {
                delete db.adminMenus[menuId];
                saveData();
                try { await ctx.deleteMessage(); } catch (e) {}
                return ctx.answerCbQuery();
            }

            if (action === 'ci') p.change_info = !p.change_info;
            if (action === 'pm') p.pin_messages = !p.pin_messages;
            if (action === 'rm') p.restrict_members = !p.restrict_members;
            if (action === 'iu') p.invite_users = !p.invite_users;
            if (action === 'dm') p.delete_messages = !p.delete_messages;
            if (action === 'vc') p.manage_video_chats = !p.manage_video_chats;
            if (action === 'pr') p.promote_members = !p.promote_members;
            saveData();

            try {
                await ctx.telegram.promoteChatMember(menu.chatId, menu.targetId, {
                    is_anonymous: false,
                    can_manage_chat: true,
                    can_post_messages: true,
                    can_edit_messages: true,
                    can_delete_messages: p.delete_messages,
                    can_manage_voice_chats: p.manage_video_chats,
                    can_restrict_members: p.restrict_members,
                    can_promote_members: p.promote_members,
                    can_change_info: p.change_info,
                    can_invite_users: p.invite_users,
                    can_pin_messages: p.pin_messages
                });
            } catch (e) {}

            const getSt = (v) => v ? 'نعم' : 'لا';

            await ctx.editMessageText(`• حدد الصلاحيات ↦ [${menu.targetName}](tg://user?id=${menu.targetId})`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: `• تغيير معلومات المجموعة ↦ ${getSt(p.change_info)}`, callback_data: `prm_${menuId}_ci` }],
                        [{ text: `• تثبيت الرسائل ↦ ${getSt(p.pin_messages)}`, callback_data: `prm_${menuId}_pm` }],
                        [{ text: `• حظر المستخدمين ↦ ${getSt(p.restrict_members)}`, callback_data: `prm_${menuId}_rm` }],
                        [{ text: `• دعوة المستخدمين ↦ ${getSt(p.invite_users)}`, callback_data: `prm_${menuId}_iu` }],
                        [{ text: `• مسح الرسائل ↦ ${getSt(p.delete_messages)}`, callback_data: `prm_${menuId}_dm` }],
                        [{ text: `• ادارة المكالمات ↦ ${getSt(p.manage_video_chats)}`, callback_data: `prm_${menuId}_vc` }],
                        [{ text: `• اضافة مشرفين ↦ ${getSt(p.promote_members)}`, callback_data: `prm_${menuId}_pr` }],
                        [{ text: 'إخفاء الأوامر', callback_data: `prm_${menuId}_hide` }]
                    ]
                }
            });
            return ctx.answerCbQuery('تم التحديث ✓');
        }
    } catch (e) {}
});
