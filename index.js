const { Telegraf } = require('telegraf');
const http = require('http');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf(process.env.BOT_TOKEN);

const antiSpamEnabled = {};
const mutedUsers = {};       
const globalMutedUsers = {}; 

const userRoles = {};

function getUserRole(chatId, userId, username) {
    if (userRoles[chatId] && userRoles[chatId][userId]) {
        return userRoles[chatId][userId];
    }
    const devOnes = ['j4xa7', 'to6ri', 'evy', 'evelaf', 'i_evy', 'evyyytoiry'];
    if (username && devOnes.includes(username.toLowerCase())) {
        return 'Dev🎖️';
    }
    return 'عضو';
}

const roleHierarchy = {
    'عضو': 0,
    'مميز': 1,
    'مالك': 2,
    'مالك اساسي': 3,
    'myth': 4,
    'Myth🎖️': 5,
    'Dev 2': 6,
    'Dev🎖️': 7
};

function hasPermission(userRole, requiredRole) {
    return (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
}

bot.on('message', async (ctx) => {
    try {
        if (!ctx.message || !ctx.chat || ctx.chat.type === 'private') return;
        if (!ctx.from || ctx.from.is_bot) return;

        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        const username = ctx.from.username || '';
        const role = getUserRole(chatId, userId, username);
        const text = (ctx.message.text || ctx.message.caption || '').trim();

        if (role !== 'Dev🎖️' && role !== 'Dev 2' && role !== 'Myth🎖️') {
            if ((globalMutedUsers[userId]) || (mutedUsers[chatId] && mutedUsers[chatId][userId])) {
                try { await ctx.deleteMessage(); } catch (e) {}
                return;
            }
        }

        const isProtected = roleHierarchy[role] >= roleHierarchy['مميز'];
        
        if (!isProtected) {
            if (antiSpamEnabled[chatId]) {
                const hasLink = /https?:\/\/|t\.me\/|www\./i.test(text);
                if (hasLink) {
                    try { await ctx.deleteMessage(); } catch (e) {}
                    return;
                }
            }
            const hasEnglish = /[a-zA-Z]{5,}/.test(text);
            if (hasEnglish && text.length > 100) {
                try { await ctx.deleteMessage(); } catch (e) {}
                return;
            }
        }

        // أمر رتبتي بدون أي آي دي نهائياً
        if (text === 'رتبتي' || text === '/رتبتي') {
            return ctx.reply(`• رتبتك هي ⟵ ｢ ${role} ｣`, { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'فتح المخالفات') {
            if (!hasPermission(role, 'Dev 2')) return ctx.reply('• هذا الأمر يخص الديفات والإدارة العليا فقط.', { reply_to_message_id: ctx.message.message_id });
            antiSpamEnabled[chatId] = false;
            return ctx.reply('تم فتح المخالفات بنجاح.', { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'قفل المخالفات') {
            if (!hasPermission(role, 'Dev 2')) return ctx.reply('• هذا الأمر يخص الديفات والإدارة العليا فقط.', { reply_to_message_id: ctx.message.message_id });
            antiSpamEnabled[chatId] = true;
            return ctx.reply('تم قفل المخالفات وحماية الجروب بنجاح.', { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'مم') {
            if (!hasPermission(role, 'myth')) return ctx.reply('• ليس لديك صلاحية لعرض المكتومين.', { reply_to_message_id: ctx.message.message_id });
            const mutedList = mutedUsers[chatId] ? Object.keys(mutedUsers[chatId]) : [];
            if (mutedList.length === 0) return ctx.reply('• لا يوجد مكتومين .', { reply_to_message_id: ctx.message.message_id });
            return ctx.reply(`• عدد المكتومين في الجروب: ${mutedList.length}`, { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'خخ') {
            if (!hasPermission(role, 'Myth🎖️')) return ctx.reply('• ليس لديك صلاحية لعرض المكتومين عام.', { reply_to_message_id: ctx.message.message_id });
            const globalList = Object.keys(globalMutedUsers);
            if (globalList.length === 0) return ctx.reply('• لا يوجد مكتومين عام .', { reply_to_message_id: ctx.message.message_id });
            return ctx.reply(`• عدد المكتومين عام: ${globalList.length}`, { reply_to_message_id: ctx.message.message_id });
        }

        if (text.startsWith('رفع ') || text === 'تنزيل الكل') {
            if (!ctx.message.reply_to_message) {
                return ctx.reply('يرجى الرد على الشخص لتنفيذ الأمر.', { reply_to_message_id: ctx.message.message_id });
            }
            const targetUser = ctx.message.reply_to_message.from;
            const targetId = targetUser.id;
            const targetName = targetUser.first_name || 'المستخدم';

            if (text === 'تنزيل الكل') {
                if (!hasPermission(role, 'Myth🎖️')) return ctx.reply('• ليس لديك صلاحية لتنزيل الرتب.', { reply_to_message_id: ctx.message.message_id });
                if (!userRoles[chatId]) userRoles[chatId] = {};
                userRoles[chatId][targetId] = 'عضو';
                return ctx.reply(`• المستخدم ⟵ ｢ ${targetName} ｣\n• تم تنزيله من الرتبة ( عضو )`, { reply_to_message_id: ctx.message.message_id });
            }

            if (text.startsWith('رفع ')) {
                const rawRank = text.replace('رفع ', '').trim().toLowerCase();
                let requestedRank = '';
                let displayRank = '';

                if (rawRank === 'ديف') {
                    requestedRank = 'Dev 2';
                    displayRank = 'Dev 2';
                } else if (rawRank === 'مطور اساسي' || rawRank === 'مطور أساسي') {
                    requestedRank = 'Dev🎖️';
                    displayRank = 'Dev🎖️';
                } else if (rawRank === 'ميث' || rawRank === 'm') {
                    requestedRank = 'myth';
                    displayRank = 'myth';
                } else if (rawRank === 'اكس' || rawRank === 'إكسترا' || rawRank === 'اكسترا' || rawRank === 'ا') {
                    requestedRank = 'Myth🎖️';
                    displayRank = 'Myth🎖️';
                } else if (rawRank === 'مميز') {
                    requestedRank = 'مميز';
                    displayRank = 'مميز';
                } else if (rawRank === 'مالك') {
                    requestedRank = 'مالك';
                    displayRank = 'مالك';
                } else if (rawRank === 'مالك اساسي' || rawRank === 'مالك أساسي') {
                    requestedRank = 'مالك اساسي';
                    displayRank = 'مالك اساسي';
                } else {
                    return ctx.reply('عذراً، هذه الرتبة غير صحيحة أو غير متوفرة.', { reply_to_message_id: ctx.message.message_id });
                }

                if (role === 'مالك اساسي' && (requestedRank === 'myth' || requestedRank === 'Myth🎖️' || requestedRank === 'Dev 2' || requestedRank === 'Dev🎖️')) {
                    return ctx.reply('عذراً، لا يمكنك رفع شخص لهذه الرتبة العالية.', { reply_to_message_id: ctx.message.message_id });
                }
                if (!hasPermission(role, 'مالك اساسي')) {
                    return ctx.reply('• أمر الرفع يتطلب رتبة (مالك اساسي) فما فوق.', { reply_to_message_id: ctx.message.message_id });
                }

                if (!userRoles[chatId]) userRoles[chatId] = {};
                userRoles[chatId][targetId] = requestedRank;
                
                return ctx.reply(`• المستخدم ⟵ ｢ ${targetName} ｣\n• تم رفعه ${displayRank}`, { reply_to_message_id: ctx.message.message_id });
            }
        }

        if (['كتم', 'كتم عام', 'تقييد', 'طرد', 'حظر', 'فك الكتم', 'رفع القيود', 'الغاء التقييد'].includes(text)) {
            if (!ctx.message.reply_to_message) {
                return ctx.reply('يرجى الرد على الرسالة لتنفيذ الأمر.', { reply_to_message_id: ctx.message.message_id });
            }

            const targetUser = ctx.message.reply_to_message.from;
            const targetId = targetUser.id;
            const targetName = targetUser.first_name || 'المستخدم';

            if (text === 'كتم') {
                if (!hasPermission(role, 'myth')) return ctx.reply('• أمر الكتم يتطلب رتبة (myth) فما فوق.', { reply_to_message_id: ctx.message.message_id });
                if (!mutedUsers[chatId]) mutedUsers[chatId] = {};
                mutedUsers[chatId][targetId] = true;
                return ctx.reply(`• المستخدم ⟵ ｢ ${targetName} ｣\n• كتمته .`, { reply_to_message_id: ctx.message.message_id });
            }

            if (text === 'كتم عام') {
                if (!hasPermission(role, 'Myth🎖️')) return ctx.reply('• أمر الكتم العام يتطلب رتبة (Myth🎖️) فما فوق.', { reply_to_message_id: ctx.message.message_id });
                globalMutedUsers[targetId] = true;
                return ctx.reply(`• المستخدم ⟵ ｢ ${targetName} ｣\n• كتمته عام .`, { reply_to_message_id: ctx.message.message_id });
            }

            if (text === 'تقييد') {
                if (!hasPermission(role, 'Dev 2')) return ctx.reply('• أمر التقييد يتطلب رتبة (Dev 2) فما فوق.', { reply_to_message_id: ctx.message.message_id });
                try {
                    await ctx.restrictChatMember(targetId, { permissions: { can_send_messages: false } });
                    return ctx.reply(`• تم تقييد العضو ⟵ ｢ ${targetName} ｣ بنجاح.`, { reply_to_message_id: ctx.message.message_id });
                } catch (e) {
                    return ctx.reply('لا يمكنني تقييد هذا العضو.', { reply_to_message_id: ctx.message.message_id });
                }
            }

            if (text === 'طرد' || text === 'حظر') {
                if (!hasPermission(role, 'Dev 2')) return ctx.reply('• هذا الأمر يتطلب رتبة (Dev 2) فما فوق.', { reply_to_message_id: ctx.message.message_id });
                try {
                    if (text === 'طرد') await ctx.unbanChatMember(targetId);
                    else await ctx.banChatMember(targetId);
                    return ctx.reply(`• تم ${text} العضو ⟵ ｢ ${targetName} ｣ بنجاح.`, { reply_to_message_id: ctx.message.message_id });
                } catch (e) {
                    return ctx.reply('لا يمكنني تنفيذ الأمر على هذا العضو.', { reply_to_message_id: ctx.message.message_id });
                }
            }

            if (text === 'الغاء التقييد') {
                if (!hasPermission(role, 'مالك اساسي')) return ctx.reply('• أمر إلغاء التقييد يتطلب (مالك اساسي) فما فوق.', { reply_to_message_id: ctx.message.message_id });
                try {
                    await ctx.unbanChatMember(targetId);
                    return ctx.reply(`• تم الغاء التقييد عن العضو ⟵ ｢ ${targetName} ｣.`, { reply_to_message_id: ctx.message.message_id });
                } catch (e) {
                    return ctx.reply('حدث خطأ.', { reply_to_message_id: ctx.message.message_id });
                }
            }

            if (['فك الكتم', 'رفع القيود'].includes(text)) {
                if (!hasPermission(role, 'Dev 2')) return ctx.reply('• أمر (رفع القيود) خاص بالديف تو ومن فوقه.', { reply_to_message_id: ctx.message.message_id });
                if (mutedUsers[chatId]) delete mutedUsers[chatId][targetId];
                delete globalMutedUsers[targetId];
                try {
                    await ctx.unbanChatMember(targetId);
                    return ctx.reply(`• تم رفع القيود وفك الكتم عن ⟵ ｢ ${targetName} ｣ بنجاح.`, { reply_to_message_id: ctx.message.message_id });
                } catch (e) {
                    return ctx.reply(`• تم فك الكتم عن ⟵ ｢ ${targetName} ｣.`, { reply_to_message_id: ctx.message.message_id });
                }
            }
        }

        if (text === 'توري') {
            return ctx.reply('• توري ⟵ @to6ri', { reply_to_message_id: ctx.message.message_id });
        }
        if (text === 'ايفي' || text === 'ايلاف') {
            return ctx.reply('• المطور ⟵ @j4xa7', { reply_to_message_id: ctx.message.message_id });
        }
        if (text === 'تورايف') {
            const replies = ['عيوني', 'أمر؟', 'سم', 'وش بغيت؟', 'عيون ايفي وتوري', 'هلا'];
            const randomReply = replies[Math.floor(Math.random() * replies.length)];
            return ctx.reply(randomReply, { reply_to_message_id: ctx.message.message_id });
        }

    } catch (e) {}
});

bot.on('edited_message', async (ctx) => {
    try {
        const editedMsg = ctx.editedMessage;
        if (!editedMsg || !editedMsg.chat || editedMsg.chat.type === 'private') return;
        if (!editedMsg.from || editedMsg.from.is_bot) return;

        const chatId = editedMsg.chat.id;
        const userId = editedMsg.from.id;
        const username = editedMsg.from.username || '';
        const role = getUserRole(chatId, userId, username);

        const isProtected = roleHierarchy[role] >= roleHierarchy['مميز'];
        if (!isProtected) {
            await ctx.telegram.deleteMessage(chatId, editedMsg.message_id);
        }
    } catch (e) {}
});

bot.launch();
