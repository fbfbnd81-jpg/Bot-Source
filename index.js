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

function isDev(username) {
    return username && username.toLowerCase() === 'j4xa7';
}

function getUserRole(chatId, userId, username) {
    if (isDev(username)) {
        return 'Dev🎖️';
    }
    if (db.roles[chatId] && db.roles[chatId][userId]) {
        return db.roles[chatId][userId];
    }
    return 'عضو';
}

const roleHierarchy = {
    'عضو': 0,
    'مميز': 1,
    'مشرف': 2,
    'مالك': 3,
    'مالك اساسي': 4,
    'myth': 5,
    'Myth🎖️': 6,      
    'Dev²🎖': 7,
    'Dev🎖️': 8,
    'Dev1_Super': 9
};

function hasPermission(userRole, requiredRole) {
    return (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
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

bot.on('message', async (ctx, next) => {
    try {
        if (!ctx.chat) return;

        const chatId = ctx.chat.id;
        const userId = ctx.from ? ctx.from.id : chatId;
        const username = ctx.from && ctx.from.username ? ctx.from.username : '';
        const name = ctx.from && ctx.from.first_name ? ctx.from.first_name : 'المستخدم';
        const role = getUserRole(chatId, userId, username);
        const text = (ctx.message.text || ctx.message.caption || '').trim();
        const isEdited = !!ctx.update.edited_message;
        const mention = `[${name}](tg://user?id=${userId})`;
        const isTheDevOne = isDev(username);

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
                    fromId: userId,
                    fromName: name,
                    toId: targetData.targetId,
                    toName: targetData.targetName,
                    type: whisperType,
                    content: contentData
                };

                const whisperMsgText = `ـ\n` +
                                       `• يا حلوه ↰ [${targetData.targetName}](tg://user?id=${targetData.targetId})\n` +
                                       `• وصلتك همسة سرية من ↰ ${name}\n` +
                                       `• انت وحدك تقدر تشوفها`;

                await bot.telegram.sendMessage(targetData.targetChatId, whisperMsgText, {
                    parse_mode: 'Markdown',
                    reply_to_message_id: targetData.replyMessageId,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'رؤية الهمسة', callback_data: `view_whisper_${whisperId}` }
                            ],
                            [
                                { text: 'رد على الهمسة', callback_data: `reply_whisper_${whisperId}` }
                            ]
                        ]
                    }
                });

                return ctx.reply('• تم إرسال الهمسة .');
            }
            return;
        }

        // --- لوحة الأوامر (بأزرار شفافة وخاصة بالمطور Dev فقط) ---
        if (['الأوامر', 'الاوامر', 'الخدمات', 'مساعدة', '/help'].includes(text)) {
            if (!isTheDevOne) {
                return ctx.reply('• هذا الأمر مخصص لـ ｢ Dev 🎖 ｣ فقط ❌', { reply_to_message_id: ctx.message.message_id });
            }

            const menuText = `• أهلاً بك يا مطورنا في لوحة الأوامر الشفافة 🛠️`;

            return ctx.reply(menuText, {
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
                        [
                            { text: '❌ إغلاق اللوحة', callback_data: 'dev_close_menu' }
                        ]
                    ]
                }
            });
        }

        if (text === 'احبك' || text === 'أحبك') {
            const loveReplies = ['وانا احب ايفي', 'وانا احب توري', 'وانا بعد', 'اعشقك'];
            return ctx.reply(loveReplies[Math.floor(Math.random() * loveReplies.length)], { reply_to_message_id: ctx.message.message_id });
        }

        if (ctx.chat.type !== 'private' && ctx.from && !ctx.from.is_bot) {
            const isMutedInGroup = mutedUsers[chatId] && mutedUsers[chatId][userId];
            const isGloballyMuted = globalMutedUsers[userId];

            if (isMutedInGroup || isGloballyMuted) {
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

        if (text.startsWith('يوت ') || text.startsWith('بحث ')) {
            const query = text.replace(/^(يوت|بحث)\s+/, '').trim();
            if (!query) return ctx.reply('يرجى كتابة اسم الأغنية بعد الأمر.', { reply_to_message_id: ctx.message.message_id });

            const searchingMsg = await ctx.reply(`🔍 جاري البحث عن: [ ${query} ] ...`, { reply_to_message_id: ctx.message.message_id });

            try {
                const searchRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`);
                const data = await searchRes.json();

                if (data.results && data.results.length > 0) {
                    const track = data.results[0];
                    const audioUrl = track.previewUrl;
                    const trackName = track.trackName;
                    const artistName = track.artistName;
                    const durationMs = track.trackTimeMillis || 180000;
                    
                    const minutes = Math.floor(durationMs / 60000);
                    const seconds = ((durationMs % 60000) / 1000).toFixed(0);
                    const durationFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

                    const botUsername = ctx.botInfo ? ctx.botInfo.username : 'Toraif_bot';

                    try { await ctx.deleteMessage(searchingMsg.message_id); } catch (e) {}

                    if (audioUrl) {
                        return ctx.replyWithAudio(audioUrl, {
                            title: trackName,
                            performer: artistName,
                            duration: Math.floor(durationMs / 1000),
                            caption: `• @${botUsername} ♪ ${durationFormatted}`,
                            parse_mode: 'Markdown',
                            reply_to_message_id: ctx.message.message_id
                        });
                    }
                }
                
                try { await ctx.deleteMessage(searchingMsg.message_id); } catch (e) {}
                return ctx.reply(`عذراً، لم أتمكن من العثور على الأغنية: "${query}".`, { reply_to_message_id: ctx.message.message_id });

            } catch (err) {
                try { await ctx.deleteMessage(searchingMsg.message_id); } catch (e) {}
                return ctx.reply('حدث خطأ أثناء البحث، حاول مرة أخرى.', { reply_to_message_id: ctx.message.message_id });
            }
        }

        if (['همسه', 'اهمس', 'ه'].includes(text)) {
            if (!ctx.message.reply_to_message) {
                return ctx.reply('يرجى الرد على الشخص الذي تريد أهمسته.', { reply_to_message_id: ctx.message.message_id });
            }
            const targetUser = ctx.message.reply_to_message.from;
            const targetId = targetUser.id;
            const targetName = targetUser.first_name || 'المستخدم';
            const replyMessageId = ctx.message.reply_to_message.message_id;
            const botUsername = ctx.botInfo ? ctx.botInfo.username : 'Toraif_bot';

            if (!global.waitingForWhisper) global.waitingForWhisper = {};
            global.waitingForWhisper[userId] = { targetChatId: chatId, targetId, targetName, replyMessageId };

            const replyText = `• تم تحديد الهمسه ↦ [${targetName}](tg://user?id=${targetId})\n• اضغط الزر لكتابة الهمسة`;

            return ctx.reply(replyText, {
                parse_mode: 'Markdown',
                reply_to_message_id: ctx.message.message_id,
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'اهمس هنا ↗', url: `https://t.me/${botUsername}?start=whisper` }
                    ]]
                }
            });
        }

        if (text === 'تفاعلي') {
            if (ctx.chat.type === 'private') return;
            const chatStats = db.stats[chatId] || {};
            const sortedUsers = Object.entries(chatStats).sort((a, b) => b[1].count - a[1].count);
            const userIndex = sortedUsers.findIndex(([id]) => id == userId);
            const rankNumber = userIndex !== -1 ? userIndex + 1 : 'خارج القائمة';
            const msgCount = chatStats[userId] ? chatStats[userId].count : 0;

            let roleDisplay = '';
            if (role === 'myth' || role === 'Myth🎖️') {
                roleDisplay = '🎖️ Myth';
            } else if (role.includes('Dev') || role === 'Dev²🎖' || role === 'Dev🎖️') {
                roleDisplay = '🎖️ Dev';
            } else if (role === 'مشرف') {
                roleDisplay = 'مشرف';
            } else if (role === 'مميز') {
                roleDisplay = 'مميز';
            } else if (role === 'مالك' || role === 'مالك اساسي') {
                roleDisplay = role;
            } else {
                roleDisplay = 'عضو';
            }

            const customTitle = (db.titles[chatId] && db.titles[chatId][userId]) ? ` | ${db.titles[chatId][userId]}` : '';
            const replyText = `• رتبتك هي ↦ ${roleDisplay}${customTitle}\n\n` +
                              `• رسايلك بالتفاعل ↦ ${msgCount}\n` +
                              `• ترتيبك بالممتفاعلين ↦ ${rankNumber}\n-`;
            return ctx.reply(replyText, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
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
                let prefix = `${index + 1} )`;
                if (index === 0) prefix = `🥇 )`;
                else if (index === 1) prefix = `🥈 )`;
                else if (index === 2) prefix = `🥉 )`;

                const mName = data.name || 'عضو';
                const title = (db.titles[chatId] && db.titles[chatId][id]) ? ` [${db.titles[chatId][id]}]` : '';
                topText += `${prefix} ${data.count} | [${mName}](tg://user?id=${id})${title}\n`;
            });

            return ctx.reply(topText, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
        }

        if (text.startsWith('ضع لقب ')) {
            if (!isTheDevOne) {
                return ctx.reply('• هذا الأمر مخصص لـ ｢ Dev 🎖 ｣ فقط ❌', { reply_to_message_id: ctx.message.message_id });
            }
            if (!ctx.message.reply_to_message) {
                return ctx.reply('يرجى الرد على الشخص لتحديد لقبه.', { reply_to_message_id: ctx.message.message_id });
            }
            const titleValue = text.replace('ضع لقب ', '').trim();
            const targetUser = ctx.message.reply_to_message.from;
            const targetId = targetUser.id;
            const targetName = targetUser.first_name || 'المستخدم';
            const targetMention = `[${targetName}](tg://user?id=${targetId})`;

            try {
                await ctx.setChatAdministratorCustomTitle(targetId, titleValue === 'حذف' || titleValue === 'مسح' ? '' : titleValue);

                if (!db.titles[chatId]) db.titles[chatId] = {};
                if (titleValue === 'حذف' || titleValue === 'مسح') {
                    delete db.titles[chatId][targetId];
                    saveData();
                    return ctx.reply(`• تم حذف اللقب عن ↦ ${targetMention} ✓`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
                }

                db.titles[chatId][targetId] = titleValue;
                saveData();
                return ctx.reply(`• تم تعيين اللقب للمستخدم ↦ ${targetMention}\n• اللقب: [ ${titleValue} ] ✓`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            } catch (err) {
                return ctx.reply('• فشل تعيين اللقب، تأكد أن المستخدم مشرف بالقروب وأن البوت يملك صلاحيات كافية.', { reply_to_message_id: ctx.message.message_id });
            }
        }

        if (text === 'قفل المنشن' || text === 'فتح المنشن') {
            if (!isTheDevOne) {
                return ctx.reply('• هذا الامر يخص ↦ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
            }
            if (!groupSettings[chatId]) groupSettings[chatId] = { violations: true, edit: true, mentionAll: true };
            
            if (text === 'قفل المنشن') {
                groupSettings[chatId].mentionAll = false;
                return ctx.reply(`• بواسطة ↦ ${mention}\n• تم قفل المنشن .`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            } else {
                groupSettings[chatId].mentionAll = true;
                return ctx.reply(`• بواسطة ↦ ${mention}\n• تم فتح المنشن .`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }
        }

        if (text === '@all') {
            if (!groupSettings[chatId]) groupSettings[chatId] = { violations: true, edit: true, mentionAll: true };
            if (groupSettings[chatId].mentionAll === false && !isTheDevOne) {
                return ctx.reply('عذراً، المنشن العام (@all) مقفل من قِبل المطور 🔒', { reply_to_message_id: ctx.message.message_id });
            }
            
            if (!db.stats[chatId] || Object.keys(db.stats[chatId]).length === 0) {
                return ctx.reply('لا يوجد أعضاء مسجلين بالقروب بعد.', { reply_to_message_id: ctx.message.message_id });
            }

            let mentionText = '• تنبيه للجميع 📢:\n';
            let count = 0;
            for (let id in db.stats[chatId]) {
                const member = db.stats[chatId][id];
                const mName = member.name || 'عضو';
                mentionText += `[${mName}](tg://user?id=${id}) `;
                count++;
                if (count >= 35) break; 
            }
            return ctx.reply(mentionText, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'فتح المخالفات' || text === 'فتح التعديل') {
            if (!isTheDevOne) {
                return ctx.reply('• هذا الامر يخص ↦ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
            }
            if (!groupSettings[chatId]) groupSettings[chatId] = { violations: true, edit: true, mentionAll: true };
            groupSettings[chatId].violations = true;
            groupSettings[chatId].edit = true;
            return ctx.reply('تم فتح المخالفات والتعديل. 🔓', { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'قفل المخالفات' || text === 'قفل التعديل') {
            if (!isTheDevOne) {
                return ctx.reply('• هذا الامر يخص ↦ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
            }
            if (!groupSettings[chatId]) groupSettings[chatId] = { violations: true, edit: true, mentionAll: true };
            groupSettings[chatId].violations = false;
            groupSettings[chatId].edit = false;

            const closeMsg = `تم قفل المخالفات بنجاح 🔒\n\n` +
                             `المحتوى الممنوع في المجموعة:\n` +
                             `• المخدرات وأي شكل من أشكال التعاطي\n` +
                             `• العنف الدموي والمشاهد المروعة\n` +
                             `• الأسلحة النارية أو التهديد بها\n\n` +
                             `سيتم حذف المحتوى المخالف تلقائيًا مع نظام إنذارات (3 إنذارات ↦ عقوبة).`;
            return ctx.reply(closeMsg, { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'مم') {
            if (!hasPermission(role, 'myth')) {
                return ctx.reply('• هذا الامر يخص ↦ ｢ Myth ｣', { reply_to_message_id: ctx.message.message_id });
            }
            const mutedList = mutedUsers[chatId] ? Object.keys(mutedUsers[chatId]) : [];
            if (mutedList.length === 0) return ctx.reply('• لا يوجد مكتومين .', { reply_to_message_id: ctx.message.message_id });
            const count = mutedList.length;
            mutedUsers[chatId] = {}; 
            return ctx.reply(`• تم مسح ( ${count} ) من المكتومين`, { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'خخ') {
            if (!hasPermission(role, 'Myth🎖️')) {
                return ctx.reply('• هذا الامر يخص ↦ ｢ Myth 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
            }
            const globalList = Object.keys(globalMutedUsers);
            if (globalList.length === 0) return ctx.reply('• لا يوجد مكتومين عام ,', { reply_to_message_id: ctx.message.message_id });
            const count = globalList.length;
            for (let id in globalMutedUsers) delete globalMutedUsers[id]; 
            return ctx.reply(`• تم مسح ( ${count} ) من المكتومين عام`, { reply_to_message_id: ctx.message.message_id });
        }

        if (ctx.chat.type === 'private') return;
        if (ctx.from && ctx.from.is_bot) return;

        if (!groupSettings[chatId]) {
            groupSettings[chatId] = { violations: true, edit: true, mentionAll: true };
        }

        if (!isTheDevOne) {
            if (isEdited && !groupSettings[chatId].edit) {
                try { await ctx.deleteMessage(); } catch (e) {}
                return ctx.reply(`عذراً ${mention} ‼️ : يمنع تعديل الرسايل بالمجموعة`, { parse_mode: 'Markdown' });
            }
        }

        if (text === 'رتبتي' || text === '/رتبتي') {
            const customTitle = (db.titles[chatId] && db.titles[chatId][userId]) ? ` [${db.titles[chatId][userId]}]` : '';
            return ctx.reply(`• رتبتك هي ↦ ｢ ${role} ｣${customTitle}`, { reply_to_message_id: ctx.message.message_id });
        }

        if (['كتم', 'كتم عام', 'تقييد', 'فك التقييد', 'الغاء التقييد', 'رفع القيود', 'فك الكتم', 'فك الكتم العام', 'رفع مشرف', 'تنزيل مشرف'].includes(text) || text.startsWith('رفع ') || text === 'تنزيل الكل') {
            if (!ctx.message.reply_to_message) {
                return ctx.reply('يرجى الرد على الشخص لتنفيذ الأمر.', { reply_to_message_id: ctx.message.message_id });
            }
            const targetUser = ctx.message.reply_to_message.from;
            const targetId = targetUser.id;
            const targetName = targetUser.first_name || 'المستخدم';
            const targetUsername = targetUser.username || '';
            const targetRole = getUserRole(chatId, targetId, targetUsername);
            const targetMention = `[${targetName}](tg://user?id=${targetId})`;

            if (['رفع مشرف', 'تنزيل مشرف'].includes(text)) {
                if (!isTheDevOne) {
                    return ctx.reply('• هذا الأمر مخصص لـ ｢ Dev 🎖 ｣ (المطور) فقط ❌', { reply_to_message_id: ctx.message.message_id });
                }
            }

            if (text === 'رفع مشرف') {
                if (!global.adminConfigSessions) global.adminConfigSessions = {};
                global.adminConfigSessions[targetId] = {
                    chatId: chatId,
                    targetName: targetName,
                    rights: {
                        can_change_info: false,
                        can_pin_messages: false,
                        can_restrict_members: false,
                        can_invite_users: false,
                        can_delete_messages: true,
                        can_manage_video_chats: false,
                        can_promote_members: false
                    }
                };

                const cfg = global.adminConfigSessions[targetId].rights;
                const panelText = `• رفع مشرف\n\n• حدد الصلاحيات ↦`;

                return ctx.reply(panelText, {
                    reply_to_message_id: ctx.message.message_id,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: `• تغيير معلومات المجموعه ↦ ${cfg.can_change_info ? 'نعم' : 'لا'}`, callback_data: `adm_toggle_${targetId}_can_change_info` }
                            ],
                            [
                                { text: `• تثبيت الرسائل ↦ ${cfg.can_pin_messages ? 'نعم' : 'لا'}`, callback_data: `adm_toggle_${targetId}_can_pin_messages` }
                            ],
                            [
                                { text: `• حظر المستخدمين ↦ ${cfg.can_restrict_members ? 'نعم' : 'لا'}`, callback_data: `adm_toggle_${targetId}_can_restrict_members` }
                            ],
                            [
                                { text: `• دعوة المستخدمين ↦ ${cfg.can_invite_users ? 'نعم' : 'لا'}`, callback_data: `adm_toggle_${targetId}_can_invite_users` }
                            ],
                            [
                                { text: `• مسح الرسائل ↦ ${cfg.can_delete_messages ? 'نعم' : 'لا'}`, callback_data: `adm_toggle_${targetId}_can_delete_messages` }
                            ],
                            [
                                { text: `• ادارة المكالمات ↦ ${cfg.can_manage_video_chats ? 'نعم' : 'لا'}`, callback_data: `adm_toggle_${targetId}_can_manage_video_chats` }
                            ],
                            [
                                { text: `• اضافة مشرفين ↦ ${cfg.can_promote_members ? 'نعم' : 'لا'}`, callback_data: `adm_toggle_${targetId}_can_promote_members` }
                            ],
                            [
                                { text: '- اخفاء الامر', callback_data: `adm_hide_${targetId}` }
                            ]
                        ]
                    }
                });
            }

            if (text === 'تنزيل مشرف') {
                try {
                    await ctx.promoteChatMember(targetId, {
                        is_anonymous: false,
                        can_manage_chat: false,
                        can_delete_messages: false,
                        can_manage_video_chats: false,
                        can_restrict_members: false,
                        can_promote_members: false,
                        can_change_info: false,
                        can_invite_users: false,
                        can_pin_messages: false
                    });

                    if (!db.roles[chatId]) db.roles[chatId] = {};
                    db.roles[chatId][targetId] = 'عضو';
                    saveData();

                    return ctx.reply(`• المستخدم ↦ ${targetMention}\n• تم سحب الإشراف عنه وإرجاعه عضو ✓`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
                } catch (err) {
                    return ctx.reply('فشل في إزالة الإشراف، تأكد من صلاحيات البوت.', { reply_to_message_id: ctx.message.message_id });
                }
            }

            if (text === 'كتم') {
                if (!mutedUsers[chatId]) mutedUsers[chatId] = {};
                mutedUsers[chatId][targetId] = true;
                return ctx.reply(`• المستخدم ذا ↦ ${targetMention}\n• كتمته .`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }
            if (text === 'فك الكتم') {
                if (mutedUsers[chatId]) delete mutedUsers[chatId][targetId];
                return ctx.reply(`• المستخدم ↦ ${targetMention}\n• تم فك الكتم عنه .`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }
            if (text === 'كتم عام') {
                globalMutedUsers[targetId] = true;
                return ctx.reply(`• المستخدم ذا ↦ ${targetMention}\n• حظرته عام`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }
            if (text === 'فك الكتم العام') {
                delete globalMutedUsers[targetId];
                return ctx.reply(`• المستخدم ↦ ${targetMention}\n• تم فك الكتم العام عنه .`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }
            if (text === 'تقييد') {
                if (!mutedUsers[chatId]) mutedUsers[chatId] = {};
                mutedUsers[chatId][targetId] = true;
                return ctx.reply(`• المستخدم ذا ↦ ${targetMention}\n• تم تقييده .`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }
            if (text === 'فك التقييد' || text === 'الغاء التقييد' || text === 'رفع القيود') {
                if (mutedUsers[chatId]) delete mutedUsers[chatId][targetId];
                return ctx.reply(`• تم رفع القيود عن ↦ ${targetMention} .`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }
            if (text === 'تنزيل الكل') {
                if (!hasPermission(role, 'Myth🎖️')) return ctx.reply('• هذا الامر يخص ↦ ｢ Myth 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
                if (!db.roles[chatId]) db.roles[chatId] = {};
                db.roles[chatId][targetId] = 'عضو';
                saveData();
                return ctx.reply(`• المستخدم ↦ ${targetMention}\n• تم تنزيله من الرتبة ( عضو )`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }
            if (text.startsWith('رفع ')) {
                if (!hasPermission(role, 'Myth🎖️')) return ctx.reply('• هذا الامر يخص ↦ ｢ Myth 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
                const rawRank = text.replace('رفع ', '').trim().toLowerCase();
                let requestedRank = '';

                if (rawRank === 'ديف') { requestedRank = 'Dev²🎖'; }
                else if (rawRank === 'مطور اساسي' || rawRank === 'ديف 1' || rawRank === 'ديف١') { requestedRank = 'Dev🎖️'; }
                else if (rawRank === 'اكس' || rawRank === 'اكسترا') { requestedRank = 'Myth🎖️'; }
                else if (rawRank === 'ميث') { requestedRank = 'myth'; }
                else if (rawRank === 'مالك اساسي') { requestedRank = 'مالك اساسي'; }
                else if (rawRank === 'مالك') { requestedRank = 'مالك'; }
                else if (rawRank === 'مميز') { requestedRank = 'مميز'; }
                else { return ctx.reply('عذراً، هذه الرتبة غير صحيحة.', { reply_to_message_id: ctx.message.message_id }); }

                if (!db.roles[chatId]) db.roles[chatId] = {};
                db.roles[chatId][targetId] = requestedRank;
                saveData();
                return ctx.reply(`• المستخدم ↦ ${targetMention}\n• تم رفعه ↦ ${requestedRank}`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }
        }

        if (text === 'توري') return ctx.reply('• توري ↦ @to6ri', { reply_to_message_id: ctx.message.message_id });
        if (text === 'ايفي' || text === 'ايلاف') return ctx.reply('• المطور ↦ @j4xa7', { reply_to_message_id: ctx.message.message_id });
        if (text === 'تورايف') {
            const replies = ['عيوني', 'أمر؟', 'سم', 'عيون ايفي وتوري', 'هلا'];
            return ctx.reply(replies[Math.floor(Math.random() * replies.length)], { reply_to_message_id: ctx.message.message_id });
        }

    } catch (e) {}
});

bot.on('callback_query', async (ctx) => {
    try {
        const data = ctx.callbackQuery.data;
        const userId = ctx.from.id;
        const username = ctx.from.username || '';

        // حماية الأزرار بحيث لا يستطيع استخدامها إلا الديف
        if (!isDev(username)) {
            return ctx.answerCbQuery('• هذه الأوامر مخصصة للمطور (Dev) فقط ❌', { show_alert: true });
        }

        if (data === 'dev_cmd_protection') {
            const msg = `🔒 *أوامر الحماية والتحكم:*\n` +
                        `• قفل المنشن / فتح المنشن\n` +
                        `• قفل المخالفات / فتح المخالفات\n` +
                        `• كتم / فك الكتم / كتم عام`;
            return ctx.answerCbQuery(msg, { show_alert: true });
        }

        if (data === 'dev_cmd_stats') {
            const msg = `📊 *أوامر التفاعل:*\n` +
                        `• تفاعلي (لعرض رسائلك ورتبتك)\n` +
                        `• المتفاعلين (عرض توب 20)`;
            return ctx.answerCbQuery(msg, { show_alert: true });
        }

        if (data === 'dev_cmd_media') {
            const msg = `🎵 *أوامر البحث والميديا:*\n` +
                        `• يوت [اسم الأغنية]\n` +
                        `• بحث [الاسم]`;
            return ctx.answerCbQuery(msg, { show_alert: true });
        }

        if (data === 'dev_cmd_roles') {
            const msg = `🎖️ *أوامر الرتب والألقاب:*\n` +
                        `• رفع مشرف / تنزيل مشرف\n` +
                        `• ضع لقب [اللقب]\n` +
                        `• رفع [الرتبة]`;
            return ctx.answerCbQuery(msg, { show_alert: true });
        }

        if (data === 'dev_close_menu') {
            try {
                await ctx.deleteMessage();
            } catch (e) {}
            return ctx.answerCbQuery('تم إغلاق اللوحة ✓');
        }

        if (data.startsWith('adm_toggle_')) {
            const parts = data.replace('adm_toggle_', '').split('_');
            const targetId = parts[0];
            const permKey = parts.slice(1).join('_');

            if (global.adminConfigSessions && global.adminConfigSessions[targetId]) {
                const session = global.adminConfigSessions[targetId];
                session.rights[permKey] = !session.rights[permKey];
                const cfg = session.rights;

                try {
                    await ctx.promoteChatMember(targetId, {
                        is_anonymous: false,
                        can_manage_chat: true,
                        can_delete_messages: cfg.can_delete_messages,
                        can_manage_video_chats: cfg.can_manage_video_chats,
                        can_restrict_members: cfg.can_restrict_members,
                        can_promote_members: cfg.can_promote_members,
                        can_change_info: cfg.can_change_info,
                        can_invite_users: cfg.can_invite_users,
                        can_pin_messages: cfg.can_pin_messages
                    });

                    if (!db.roles[session.chatId]) db.roles[session.chatId] = {};
                    db.roles[session.chatId][targetId] = 'مشرف';
                    saveData();
                } catch (e) {}

                await ctx.editMessageReplyMarkup({
                    inline_keyboard: [
                        [
                            { text: `• تغيير معلومات المجموعه ↦ ${cfg.can_change_info ? 'نعم' : 'لا'}`, callback_data: `adm_toggle_${targetId}_can_change_info` }
                        ],
                        [
                            { text: `• تثبيت الرسائل ↦ ${cfg.can_pin_messages ? 'نعم' : 'لا'}`, callback_data: `adm_toggle_${targetId}_can_pin_messages` }
                        ],
                        [
                            { text: `• حظر المستخدمين ↦ ${cfg.can_restrict_members ? 'نعم' : 'لا'}`, callback_data: `adm_toggle_${targetId}_can_restrict_members` }
                        ],
                        [
                            { text: `• دعوة المستخدمين ↦ ${cfg.can_invite_users ? 'نعم' : 'لا'}`, callback_data: `adm_toggle_${targetId}_can_invite_users` }
                        ],
                        [
                            { text: `• مسح الرسائل ↦ ${cfg.can_delete_messages ? 'نعم' : 'لا'}`, callback_data: `adm_toggle_${targetId}_can_delete_messages` }
                        ],
                        [
                            { text: `• ادارة المكالمات ↦ ${cfg.can_manage_video_chats ? 'نعم' : 'لا'}`, callback_data: `adm_toggle_${targetId}_can_manage_video_chats` }
                        ],
                        [
                            { text: `• اضافة مشرفين ↦ ${cfg.can_promote_members ? 'نعم' : 'لا'}`, callback_data: `adm_toggle_${targetId}_can_promote_members` }
                        ],
                        [
                            { text: '- اخفاء الامر', callback_data: `adm_hide_${targetId}` }
                        ]
                    ]
                });
            }
            return ctx.answerCbQuery('تم تحديث الصلاحية ✓');
        }

        if (data.startsWith('adm_hide_')) {
            const targetId = data.replace('adm_hide_', '');
            if (global.adminConfigSessions && global.adminConfigSessions[targetId]) {
                delete global.adminConfigSessions[targetId];
            }
            try {
                await ctx.deleteMessage();
            } catch (e) {
                try {
                    await ctx.editMessageText('• تم إخفاء لوحة الصلاحيات ✓');
                } catch (err) {}
            }
            return ctx.answerCbQuery('تم اخفاء اللوحة ✓');
        }

        if (data.startsWith('view_whisper_')) {
            const whisperId = data.replace('view_whisper_', '');
            const whisper = whispers[whisperId];

            if (!whisper) {
                return ctx.answerCbQuery('انتهت صلاحية الهمسة أو تم حذفها.', { show_alert: true });
            }

            const currentUserId = ctx.from.id;
            if (currentUserId !== whisper.toId && currentUserId !== whisper.fromId) {
                return ctx.answerCbQuery('• أنت وحدك تقدر تشوفها ❌', { show_alert: true });
            }

            if (whisper.type === 'photo') {
                await ctx.replyWithPhoto(whisper.content, { caption: `• محتوى الهمسة من (${whisper.fromName}):` });
                return ctx.answerCbQuery('تم إرسال محتوى الهمسة في الخاص ✓');
            } else if (whisper.type === 'sticker') {
                await ctx.replyWithSticker(whisper.content);
                return ctx.answerCbQuery('تم إرسال الملصق في الخاص ✓');
            } else if (whisper.type === 'video') {
                await ctx.replyWithVideo(whisper.content, { caption: `• محتوى الهمسة من (${whisper.fromName}):` });
                return ctx.answerCbQuery('تم إرسال الفيديو في الخاص ✓');
            } else {
                return ctx.answerCbQuery(`• الهمسة :\n${whisper.content}`, { show_alert: true });
            }
        }

        if (data.startsWith('reply_whisper_')) {
            const whisperId = data.replace('reply_whisper_', '');
            const whisper = whispers[whisperId];
            if (!whisper) {
                return ctx.answerCbQuery('انتهت صلاحية الهمسة.', { show_alert: true });
            }
            const currentUserId = ctx.from.id;
            if (currentUserId !== whisper.toId) {
                return ctx.answerCbQuery('هذا الزر مخصص للشخص المرسل إليه الهمسة فقط.', { show_alert: true });
            }

            const botUsername = ctx.botInfo ? ctx.botInfo.username : 'Toraif_bot';
            await ctx.answerCbQuery();
            return ctx.reply(`للرد على الهمسة، اضغط على الرابط للذهاب لخاص البوت:\nhttps://t.me/${botUsername}`);
        }
    } catch (e) {}
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
