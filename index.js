const { Telegraf } = require('telegraf');
const http = require('http');
const fs = require('fs');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Toraif Bot is active!');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf('8963407967:AAHnqGEd7ft6JPeEQ_97R_cj284V3kJJhng');

const mutedUsers = {};       
const globalMutedUsers = {}; 
const groupSettings = {}; 
const whispers = {}; 

const DATA_FILE = './toraif_github_database.json';
let db = { roles: {}, stats: {}, titles: {} };

if (fs.existsSync(DATA_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (!db.roles) db.roles = {};
        if (!db.stats) db.stats = {};
        if (!db.titles) db.titles = {};
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

bot.start(async (ctx) => {
    try {
        const userId = ctx.from.id;
        if (global.waitingForWhisper && global.waitingForWhisper[userId]) {
            return ctx.reply('• أرسل الآن الهمسة\n• يمكنك إرسال نص أو ملصق أو صورة أو فيديو');
        }
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

        if (ctx.chat.type === 'private') {
            if (global.waitingForWhisper && global.waitingForWhisper[userId]) {
                const targetData = global.waitingForWhisper[userId];
                delete global.waitingForWhisper[userId];

                const whisperId = Math.random().toString(36).substring(2, 9);
                let whisperType = 'text';
                let contentData = text;

                if (ctx.message.photo) {
                    whisperType = 'photo';
                    contentData = ctx.message.photo[ctx.message.photo.length - 1].file_id;
                } else if (ctx.message.sticker) {
                    whisperType = 'sticker';
                    contentData = ctx.message.sticker.file_id;
                } else if (ctx.message.video) {
                    whisperType = 'video';
                    contentData = ctx.message.video.file_id;
                }

                whispers[whisperId] = {
                    fromId: userId, fromName: name,
                    toId: targetData.targetId, toName: targetData.targetName,
                    type: whisperType, content: contentData
                };

                const whisperMsgText = `ـ\n• يا حلوه ↰ [${targetData.targetName}](tg://user?id=${targetData.targetId})\n• وصلتك همسة سرية من ↰ ${name}\n• انت وحدك تقدر تشوفها`;

                await bot.telegram.sendMessage(targetData.targetChatId, whisperMsgText, {
                    parse_mode: 'Markdown',
                    reply_to_message_id: targetData.replyMessageId,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'رؤية الهمسة', callback_data: `view_whisper_${whisperId}` }],
                            [{ text: 'رد على الهمسة', callback_data: `reply_whisper_${whisperId}` }]
                        ]
                    }
                });
                return ctx.reply('• تم إرسال الهمسة .');
            }
            return;
        }

        // لوحة الأوامر (للمطور فقط)
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
            if ((mutedUsers[chatId] && mutedUsers[chatId][userId]) || globalMutedUsers[userId]) {
                try { await ctx.deleteMessage(); } catch (e) {}
                return; 
            }
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

        // تفاعلي والمتفاعلين ورتبتي (تعمل للجميع بدون استثناء)
        if (text === 'تفاعلي') {
            if (ctx.chat.type === 'private') return;
            const chatStats = db.stats[chatId] || {};
            const sortedUsers = Object.entries(chatStats).sort((a, b) => b[1].count - a[1].count);
            const userIndex = sortedUsers.findIndex(([id]) => id == userId);
            const rankNumber = userIndex !== -1 ? userIndex + 1 : 'خارج القائمة';
            const msgCount = chatStats[userId] ? chatStats[userId].count : 0;
            const customTitle = (db.titles[chatId] && db.titles[chatId][userId]) ? ` | ${db.titles[chatId][userId]}` : '';
            
            return ctx.reply(`• رتبتك هي ↦ ${role}${customTitle}\n\n• رسايلك بالتفاعل ↦ ${msgCount}\n• ترتيبك بالممتفاعلين ↦ ${rankNumber}\n-`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'المتفاعلين') {
            if (ctx.chat.type === 'private') return;
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
            const customTitle = (db.titles[chatId] && db.titles[chatId][userId]) ? ` [${db.titles[chatId][userId]}]` : '';
            return ctx.reply(`• رتبتك هي ↦ ｢ ${role} ｣${customTitle}`, { reply_to_message_id: ctx.message.message_id });
        }

        // أوامر الرفع، الكتم، المشرفين وغيرها (تعمل للجميع بالرد)
        const isActionCommand = ['كتم', 'كتم عام', 'تقييد', 'فك التقييد', 'الغاء التقييد', 'رفع القيود', 'فك الكتم', 'فك الكتم العام', 'رفع مشرف', 'تنزيل مشرف', 'تنزيل الكل'].includes(text) || text.startsWith('رفع ');

        if (isActionCommand) {
            if (!ctx.message.reply_to_message) {
                return ctx.reply('يرجى الرد على الشخص لتنفيذ الأمر.', { reply_to_message_id: ctx.message.message_id });
            }
            const targetUser = ctx.message.reply_to_message.from;
            const targetId = targetUser.id;
            const targetName = targetUser.first_name || 'المستخدم';
            const targetMention = `[${targetName}](tg://user?id=${targetId})`;

            if (text === 'رفع مشرف') {
                try {
                    await ctx.promoteChatMember(targetId, {
                        is_anonymous: false,
                        can_manage_chat: true,
                        can_delete_messages: true,
                        can_manage_video_chats: false,
                        can_restrict_members: false,
                        can_promote_members: false,
                        can_change_info: false,
                        can_invite_users: true,
                        can_pin_messages: true
                    });
                    if (!db.roles[chatId]) db.roles[chatId] = {};
                    db.roles[chatId][targetId] = 'مشرف';
                    saveData();
                    return ctx.reply(`• المستخدم ↦ ${targetMention}\n• تم رفعه مشرف بنجاح ✓`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
                } catch (err) {
                    return ctx.reply('فشل رفع المشرف، تأكد أن البوت يملك صلاحية (إضافة مشرفين جدد) في المجموعة.', { reply_to_message_id: ctx.message.message_id });
                }
            }

            if (text === 'تنزيل مشرف') {
                try {
                    await ctx.promoteChatMember(targetId, {
                        is_anonymous: false, can_manage_chat: false, can_delete_messages: false,
                        can_manage_video_chats: false, can_restrict_members: false, can_promote_members: false,
                        can_change_info: false, can_invite_users: false, can_pin_messages: false
                    });
                    if (!db.roles[chatId]) db.roles[chatId] = {};
                    db.roles[chatId][targetId] = 'عضو';
                    saveData();
                    return ctx.reply(`• المستخدم ↦ ${targetMention}\n• تم تنزيله من الإشراف ✓`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
                } catch (err) {
                    return ctx.reply('فشل في إزالة الإشراف.', { reply_to_message_id: ctx.message.message_id });
                }
            }

            if (text === 'كتم' || text === 'تقييد') {
                if (!mutedUsers[chatId]) mutedUsers[chatId] = {};
                mutedUsers[chatId][targetId] = true;
                return ctx.reply(`• المستخدم ↦ ${targetMention}\n• تم كتمه/تقييده ✓`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }

            if (text === 'فك الكتم' || text === 'فك التقييد' || text === 'الغاء التقييد' || text === 'رفع القيود') {
                if (mutedUsers[chatId]) delete mutedUsers[chatId][targetId];
                return ctx.reply(`• المستخدم ↦ ${targetMention}\n• تم فك الكتم عنه ✓`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }

            if (text === 'تنزيل الكل') {
                if (!db.roles[chatId]) db.roles[chatId] = {};
                db.roles[chatId][targetId] = 'عضو';
                saveData();
                return ctx.reply(`• المستخدم ↦ ${targetMention}\n• تم إرجاعه ( عضو ) ✓`, { parse_mode: 'Markdown',
