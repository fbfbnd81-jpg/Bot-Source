const { Telegraf } = require('telegraf');
const http = http = require('http');
const fs = require('fs');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Toraif Bot is active!');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf('8963407967:AAHnqGEd7ft6JPeEQ_97R_cj284V3kJJhng');

const adminMenus = {}; 

const DATA_FILE = './toraif_github_database.json';
let db = { roles: {}, stats: {}, titles: {}, muted: {} };

if (fs.existsSync(DATA_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (!db.roles) db.roles = {};
        if (!db.stats) db.stats = {};
        if (!db.titles) db.titles = {};
        if (!db.muted) db.muted = {};
    } catch (e) {}
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    } catch (e) {}
}

const DEV_USER_ID = 0; 

function isDev(userId, username) {
    if (userId === DEV_USER_ID && DEV_USER_ID !== 0) return true;
    return username && username.toLowerCase() === 'j4xa7';
}

function getUserRole(chatId, userId, username) {
    if (isDev(userId, username)) return 'Dev🎖️';
    if (db.roles[chatId] && db.roles[chatId][userId]) return db.roles[chatId][userId];
    return 'عضو';
}

function checkAdminPermission(chatId, userId, username) {
    if (isDev(userId, username)) return true;
    const role = getUserRole(chatId, userId, username);
    return ['Dev🎖️', 'Dev²🎖️', 'myth', 'Myth🎖️', 'مميز', 'مالك', 'مالك اساسي'].includes(role);
}

bot.start(async (ctx) => {
    try {
        return ctx.reply('أهلاً بك في بوت تورايف! البوت يعمل بنجاح.');
    } catch (e) {}
});

bot.on('message', async (ctx) => {
    try {
        if (!ctx.chat) return;

        const chatId = ctx.chat.id;
        const userId = ctx.from ? ctx.from.id : chatId;
        const username = ctx.from && ctx.from.username ? ctx.from.username : '';
        const name = ctx.from && ctx.from.first_name ? ctx.from.first_name : 'المستخدم';
        const role = getUserRole(chatId, userId, username);
        const text = (ctx.message.text || ctx.message.caption || '').trim();
        const isTheDevOne = isDev(userId, username);

        if (ctx.chat.type === 'private') return;

        if (ctx.chat.type !== 'private' && ctx.from && !ctx.from.is_bot) {
            if (db.muted[chatId] && db.muted[chatId][userId]) {
                try { await ctx.deleteMessage(); } catch (e) {}
                return; 
            }
        }

        const isExplicitCommand = ['كتم', 'كتم عام', 'تقييد', 'فك التقييد', 'الغاء التقييد', 'رفع القيود', 'فك الكتم', 'فك الكتم العام', 'رفع مشرف', 'ترقية', 'تنزيل مشرف', 'تنزيل الكل', 'مميز', 'مالك', 'طرد', 'حظر', 'اهمس'].includes(text) || text.startsWith('رفع ') || text === 'ديف' || text === 'ميث' || text === 'م' || text === 'اكس' || text === 'مالك اساسي' || text === 'اساس';

        const isReplyToBot = ctx.message.reply_to_message && ctx.message.reply_to_message.from && ctx.message.reply_to_message.from.is_bot;

        if (isExplicitCommand || isReplyToBot) {
            if (text) {
                await ctx.reply('ياغبيي ذا البوت', { reply_to_message_id: ctx.message.message_id });
            }
        }

        if (['الأوامر', 'الاوامر', 'الخدمات', 'مساعدة', '/help'].includes(text)) {
            if (!isTheDevOne) {
                return ctx.reply('• هذا الأمر مخصص لـ ｢ Dev 🎖 ｣ فقط ❌', { reply_to_message_id: ctx.message.message_id });
            }
            return ctx.reply('• أهلاً بك يا مطورنا في لوحة الأوامر الشفافة 🛠️', {
                parse_mode: 'Markdown',
                reply_to_message_id: ctx.message.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '• أوامر الحماية والتحكم', callback_data: 'dev_cmd_protection' },
                            { text: '• أوامر التفاعل والأعضاء', callback_data: 'dev_cmd_stats' }
                        ],
                        [
                            { text: '• أوامر الميديا والبحث', callback_data: 'dev_cmd_media' },
                            { text: '• أوامر الرفعات والرتب', callback_data: 'dev_cmd_roles' }
                        ],
                        [{ text: '❌ إغلاق اللوحة', callback_data: 'dev_close_menu' }]
                    ]
                }
            });
        }

        if (text === 'احبك' || text === 'أحبك') {
            const loveReplies = ['وانا احب ايفي', 'وانا احب توري', 'وانا بعد', 'اعشقك'];
            return ctx.reply(loveReplies[Math.floor(Math.random() * loveReplies.length)], { reply_to_message_id: ctx.message.message_id });
        }

        if (ctx.chat.type !== 'private' && ctx.from && !ctx.from.is_bot) {
            if (!db.stats[chatId]) db.stats[chatId] = {};
            if (!db.stats[chatId][userId]) {
                db.stats[chatId][userId] = { count: 0, name: name, username: username };
            }
            db.stats[chatId][userId].count += 1;
            db.stats[chatId][userId].name = name;
            db.stats[chatId][userId].username = username;
            saveData();
        }

        if (text === 'تفاعلي') {
            let targetId = userId;
            let targetRole = role;
            let targetName = name;
            let targetUsername = username;

            if (ctx.message.reply_to_message && ctx.message.reply_to_message.from) {
                targetId = ctx.message.reply_to_message.from.id;
                targetUsername = ctx.message.reply_to_message.from.username || '';
                targetName = ctx.message.reply_to_message.from.first_name || 'المستخدم';
                targetRole = getUserRole(chatId, targetId, targetUsername);
            }

            const chatStats = db.stats[chatId] || {};
            const sortedUsers = Object.entries(chatStats).sort((a, b) => b[1].count - a[1].count);
            const userIndex = sortedUsers.findIndex(([id]) => id == targetId);
            const rankNumber = userIndex !== -1 ? userIndex + 1 : 'خارج القائمة';
            const msgCount = chatStats[targetId] ? chatStats[targetId].count : 0;
            const customTitle = (db.titles[chatId] && db.titles[chatId][targetId]) ? ` | ${db.titles[chatId][targetId]}` : '';
            
            return ctx.reply(`• معلومات المستخدم: [${targetName}](tg://user?id=${targetId})\n• رتبته هي ↦ ${targetRole}${customTitle}\n\n• رسايلك بالتفاعل ↦ ${msgCount}\n• ترتيبك بالممتفاعلين ↦ ${rankNumber}\n-`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'المتفاعلين') {
            const chatStats = db.stats[chatId] || {};
            const sortedUsers = Object.entries(chatStats).sort((a, b) => b[1].count - a[1].count).slice(0, 20);

            if (sortedUsers.length === 0) {
                return ctx.reply('لا يوجد أعضاء مسجلين بالتفاعل بعد.', { reply_to_message_id: ctx.message.message_id });
            }

            let topText = 'توب اكثر 20 متفاعلين بالقروب :\n______________________\n\n';
            sortedUsers.forEach(([id, data], index) => {
                let prefix = index === 0 ? '🥇 )' : index === 1 ? '🥈 )' : index === 2 ? '🥉 )' : `${index + 1} )`;
                const title = (db.titles[chatId] && db.titles[chatId][id]) ? ` [${db.titles[chatId][id]}]` : '';
                topText += `${prefix} ${data.count} | [${data.name || 'عضو'}](tg://user?id=${id})${title}\n`;
            });
            return ctx.reply(topText, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'رتبتي' || text === '/رتبتي') {
            let targetId = userId;
            let targetRole = role;
            let targetUsername = username;

            if (ctx.message.reply_to_message && ctx.message.reply_to_message.from) {
                targetId = ctx.message.reply_to_message.from.id;
                targetUsername = ctx.message.reply_to_message.from.username || '';
                targetRole = getUserRole(chatId, targetId, targetUsername);
            }

            const customTitle = (db.titles[chatId] && db.titles[chatId][targetId]) ? ` [${db.titles[chatId][targetId]}]` : '';
            return ctx.reply(`• الرتبة ↦ ｢ ${targetRole} ｣${customTitle}`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
        }

        if (isExplicitCommand) {
            if (!checkAdminPermission(chatId, userId, username)) {
                return ctx.reply('• هذا الأمر مخصص للمشرفين والرتب العليا فقط ❌', { reply_to_message_id: ctx.message.message_id });
            }

            if (!ctx.message.reply_to_message) {
                return ctx.reply('يرجى الرد على الشخص لتنفيذ الأمر.', { reply_to_message_id: ctx.message.message_id });
            }
            const targetUser = ctx.message.reply_to_message.from;
            const targetId = targetUser.id;
            const targetName = targetUser.first_name || 'المستخدم';
            const targetMention = `[${targetName}](tg://user?id=${targetId})`;

            if (targetId === userId && !isTheDevOne) {
                return ctx.reply('• لا يمكنك تنفيذ هذا الأمر على نفسك ❌', { reply_to_message_id: ctx.message.message_id });
            }

            if (text === 'رفع مشرف' || text === 'ترقية') {
                const menuId = Date.now().toString();
                adminMenus[menuId] = {
                    chatId,
                    targetId,
                    targetName,
                    p: {
                        change_info: false,
                        pin_messages: false,
                        restrict_members: false,
                        invite_users: false,
                        delete_messages: true,
                        manage_video_chats: false,
                        promote_members: false
                    }
                };

                const getSt = (v) => v ? 'نعم' : 'لا';
                const p = adminMenus[menuId].p;

                return ctx.reply(`• حدد الصلاحيات ↦ [${targetName}](tg://user?id=${targetId})`, {
                    parse_mode: 'Markdown',
                    reply_to_message_id: ctx.message.message_id,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: `• تغيير معلومات المجموعة ↦ ${getSt(p.change_info)}`, callback_data: `prm_${menuId}_ci` }],
                            [{ text: `• تثبيت الرسائل ↦ ${getSt(p.pin_messages)}`, callback_data: `prm_${menuId}_pm` }],
                            [{ text: `• حظر المستخدمين ↦ ${getSt(p.restrict_members)}`, callback_data: `prm_${menuId}_rm` }],
                            [{ text: `• دعوة المستخدمين ↦ ${getSt(p.invite_users)}`, callback_data: `prm_${menuId}_iu` }],
                            [{ text: `• مسح الرسائل ↦ ${getSt(p.delete_messages)}`, callback_data: `prm_${menuId}_dm` }],
                            [{ text: `• ادارة المكالمات ↦ ${getSt(p.manage_video_chats)}`, callback_data: `prm_${menuId}_vc` }],
                            [{ text: `• اضافة مشرفين ↦ ${getSt(p.promote_members)}`, callback_data: `prm_${menuId}_pr` }],
                            [{ text: '- اخفاء الامر', callback_data: `prm_${menuId}_hide` }]
                        ]
                    }
                });
            }

            let assignedRank = '';
            if (text === 'ديف' || text === 'رفع ديف') {
                assignedRank = 'Dev²🎖️';
            } else if (text === 'رفع مطور اساسي') {
                assignedRank = 'Dev🎖️';
            } else if (text === 'ميث' || text === 'م') {
                assignedRank = 'myth';
            } else if (text === 'اكس') {
                assignedRank = 'Myth🎖️';
            } else if (text === 'مميز') {
                assignedRank = 'مميز';
            } else if (text === 'مالك') {
                assignedRank = 'مالك';
            } else if (text === 'مالك اساسي' || text === 'اساس') {
                assignedRank = 'مالك اساسي';
            } else if (text.startsWith('رفع ')) {
                const sub = text.replace('رفع ', '').trim().toLowerCase();
                if (sub === 'ديف') assignedRank = 'Dev²🎖️';
                else if (sub === 'مطور اساسي') assignedRank = 'Dev🎖️';
                else if (sub === 'ميث' || sub === 'م') assignedRank = 'myth';
                else if (sub === 'اكس') assignedRank = 'Myth🎖️';
                else if (sub === 'مميز') assignedRank = 'مميز';
                else if (sub === 'مالك') assignedRank = 'مالك';
                else if (sub === 'مالك اساسي' || sub === 'اساس') assignedRank = 'مالك اساسي';
                else assignedRank = text.replace('رفع ', '').trim();
            }

            if (assignedRank) {
                if (!db.roles[chatId]) db.roles[chatId] = {};
                db.roles[chatId][targetId] = assignedRank;
                saveData();
                return ctx.reply(`• المستخدم ↦ ${targetMention}\n• تم رفعه رتبة: [ ${assignedRank} ] ✓`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }

            if (text === 'تنزيل مشرف') {
                try {
                    await ctx.telegram.promoteChatMember(chatId, targetId, {
                        is_anonymous: false,
                        can_manage_chat: false,
                        can_post_messages: false,
                        can_edit_messages: false,
                        can_delete_messages: false,
                        can_manage_voice_chats: false,
                        can_restrict_members: false,
                        can_promote_members: false,
                        can_change_info: false,
                        can_invite_users: false,
                        can_pin_messages: false
                    });
                } catch (e) {}

                if (!db.roles[chatId]) db.roles[chatId] = {};
                db.roles[chatId][targetId] = 'عضو';
                saveData();
                return ctx.reply(`• المستخدم ↦ ${targetMention}\n• تم تنزيله من الإشراف ✓`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }

            if (text === 'كتم' || text === 'تقييد') {
                if (!db.muted[chatId]) db.muted[chatId] = {};
                db.muted[chatId][targetId] = true;
                saveData();
                return ctx.reply(`• المستخدم ↦ ${targetMention}\n• تم كتمه/تقييده ✓`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }

            if (text === 'فك الكتم' || text === 'فك التقييد' || text === 'الغاء التقييد' || text === 'رفع القيود') {
                if (db.muted[chatId]) delete db.muted[chatId][targetId];
                saveData();
                return ctx.reply(`• المستخدم ↦ ${targetMention}\n• تم فك الكتم عنه ✓`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }

            if (text === 'تنزيل الكل') {
                if (!db.roles[chatId]) db.roles[chatId] = {};
                db.roles[chatId][targetId] = 'عضو';
                saveData();
                return ctx.reply(`• المستخدم ↦ ${targetMention}\n• تم إرجاعه ( عضو ) ✓`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }
        }

        if (text === 'توري') return ctx.reply('• توري ↦ @to6ri', { reply_to_message_id: ctx.message.message_id });
        if (text === 'ايفي' || text === 'ايلاف') return ctx.reply('• المطور ↦ @j4xa7', { reply_to_message_id: ctx.message.message_id });
        if (text === 'تورايف') {
            const replies = ['عيوني', 'أمر؟', 'سم', 'عيون ايفي وتوري', 'هلا'];
            return ctx.reply(replies[Math.floor(Math.random() * replies.length)], { reply_to_message_id: ctx.message.message_id });
        }

    } catch (e) {
        console.error("Error:", e);
    }
});

bot.on('callback_query', async (ctx) => {
    try {
        const data = ctx.callbackQuery.data;
        const userId = ctx.from.id;
        const username = ctx.from.username || '';

        if (data.startsWith('prm_')) {
            const parts = data.split('_');
            const menuId = parts[1];
            const action = parts[2];

            if (!adminMenus[menuId]) {
                return ctx.answerCbQuery('انتهت صلاحية هذه القائمة.', { show_alert: true });
            }

            const menu = adminMenus[menuId];
            const p = menu.p;

            if (action === 'hide') {
                delete adminMenus[menuId];
                try {
                    await ctx.deleteMessage();
                } catch (e) {}
                return ctx.answerCbQuery();
            }

            if (action === 'ci') p.change_info = !p.change_info;
            if (action === 'pm') p.pin_messages = !p.pin_messages;
            if (action === 'rm') p.restrict_members = !p.restrict_members;
            if (action === 'iu') p.invite_users = !p.invite_users;
            if (action === 'dm') p.delete_messages = !p.delete_messages;
            if (action === 'vc') p.manage_video_chats = !p.manage_video_chats;
            if (action === 'pr') p.promote_members = !p.promote_members;

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
                        [{ text: '- اخفاء الامر', callback_data: `prm_${menuId}_hide` }]
                    ]
                }
            });
            return ctx.answerCbQuery('تم التحديث ✓');
        }

        if (!isDev(userId, username)) {
            return ctx.answerCbQuery('• هذه الأوامر مخصصة للمطور (Dev) فقط ❌', { show_alert: true });
        }

        if (data === 'dev_close_menu') {
            try { await ctx.deleteMessage(); } catch (e) {}
            return ctx.answerCbQuery('تم إغلاق اللوحة ✓');
        }
    } catch (e) {}
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
