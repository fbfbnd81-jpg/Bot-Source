const { Telegraf } = require('telegraf');
const http = require('http');
const fs = require('fs');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Toraif Bot is active!');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf('8963407967:AAHnqGEd7ft6JPeEQ_97R_cj284V3kJJhng');

const DATA_FILE = './toraif_github_database.json';
let db = { 
    roles: {}, 
    stats: {}, 
    titles: {}, 
    muted: {}, 
    globalMuted: {}, 
    adminMenus: {}, 
    whispers: {}, 
    pendingWhispers: {},
    pendingReplies: {},
    money: {},
    activeGames: {}
};

if (fs.existsSync(DATA_FILE)) {
    try {
        const fileData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (fileData.roles) db.roles = fileData.roles;
        if (fileData.stats) db.stats = fileData.stats;
        if (fileData.titles) db.titles = fileData.titles;
        if (fileData.muted) db.muted = fileData.muted;
        if (fileData.globalMuted) db.globalMuted = fileData.globalMuted;
        if (fileData.adminMenus) db.adminMenus = fileData.adminMenus;
        if (fileData.whispers) db.whispers = fileData.whispers;
        if (fileData.pendingWhispers) db.pendingWhispers = fileData.pendingWhispers;
        if (fileData.pendingReplies) db.pendingReplies = fileData.pendingReplies;
        if (fileData.money) db.money = fileData.money;
        if (fileData.activeGames) db.activeGames = fileData.activeGames;
    } catch (e) {}
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    } catch (e) {}
}

function isDev1(userId, username) {
    return username && username.toLowerCase() === 'j4xa7';
}

function getHierarchyLevel(role) {
    if (!role) return 0;
    const r = role.trim();
    if (r.includes('Dev') && r.includes('²')) return 6;
    if (r.includes('Dev') || r === 'Dev ↤') return 7; 
    if (r.includes('Myth') || r === 'myth') return 5; 
    if (r === 'مالك اساسي') return 3; 
    if (r === 'مالك') return 2; 
    if (r === 'مميز') return 1; 
    return 0;
}

function getUserRole(chatId, userId, username) {
    if (isDev1(userId, username)) return 'Dev ↤';
    if (db.roles[chatId] && db.roles[chatId][userId]) return db.roles[chatId][userId];
    return 'عضو';
}

function getUserTitle(chatId, userId) {
    if (db.titles && db.titles[chatId] && db.titles[chatId][userId]) {
        return db.titles[chatId][userId];
    }
    return 'ما حط لقب';
}

bot.start(async (ctx) => {
    try {
        if (ctx.chat.type === 'private') {
            const args = ctx.message.text.split(' ');
            if (args.length > 1) {
                if (args[1].startsWith('start_whisper_')) {
                    const targetId = args[1].replace('start_whisper_', '');
                    if (ctx.from.id.toString() !== targetId.toString()) {
                        return ctx.reply('هذا البدء مخصص لشخص آخر.');
                    }
                    if (!db.pendingWhispers) db.pendingWhispers = {};
                    return ctx.reply('• أرسل الآن الهمسة\n\n• يمكنك إرسال نص أو ملصق أو صورة أو قيف');
                }

                if (args[1].startsWith('start_reply_')) {
                    const wId = args[1].replace('start_reply_', '');
                    if (!db.whispers || !db.whispers[wId]) {
                        return ctx.reply('انتهت صلاحية هذه الهمسة.');
                    }
                    const wh = db.whispers[wId];
                    if (ctx.from.id.toString() !== wh.targetId.toString()) {
                        return ctx.reply('هذا الرد لا يخصك.');
                    }

                    if (!db.pendingReplies) db.pendingReplies = {};
                    db.pendingReplies[ctx.from.id] = {
                        senderId: wh.senderId,
                        senderName: wh.senderName,
                        chatId: wh.chatId
                    };
                    saveData();

                    return ctx.reply('• أرسل الآن ردك (يمكنك إرسال نص، صورة، ملصق، قيف):');
                }
            }
        }

        const botInfo = await ctx.telegram.getMe();
        const botUsername = botInfo.username;
        const startText = `اهلا بك يا قلبي 🫶 - ُ\n\n• انا اشغل لك اللي تبي بالمكالمه\n\nادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.`;

        return ctx.reply(startText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '➕ أضفني في مجموعتك', url: `https://t.me/${botUsername}?startgroup=true` }],
                    [{ text: '🎖️ المطور', url: 'https://t.me/j4xa7' }]
                ]
            }
        });
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
        const userLevel = getHierarchyLevel(role);
        const text = (ctx.message.text || ctx.message.caption || '').trim();
        const isTheDev1 = isDev1(userId, username);

        if (ctx.chat.type === 'private') {
            if (db.pendingWhispers && db.pendingWhispers[userId]) {
                const whInfo = db.pendingWhispers[userId];
                const wId = Date.now().toString() + Math.floor(Math.random() * 1000);

                let contentData = { type: 'text', value: '' };
                if (ctx.message.text) {
                    contentData = { type: 'text', value: ctx.message.text };
                } else if (ctx.message.sticker) {
                    contentData = { type: 'sticker', value: ctx.message.sticker.file_id };
                } else if (ctx.message.photo) {
                    contentData = { type: 'photo', value: ctx.message.photo[ctx.message.photo.length - 1].file_id, caption: ctx.message.caption || '' };
                } else if (ctx.message.animation) {
                    contentData = { type: 'animation', value: ctx.message.animation.file_id, caption: ctx.message.caption || '' };
                } else {
                    return ctx.reply('نوع المحتوى غير مدعوم. يرجى إرسال نص أو ملصق أو صورة أو قيف.');
                }

                if (!db.whispers) db.whispers = {};
                db.whispers[wId] = {
                    senderId: userId,
                    senderName: name,
                    targetId: whInfo.targetId,
                    targetName: whInfo.targetName,
                    chatId: whInfo.chatId,
                    content: contentData,
                    seen: false
                };
                delete db.pendingWhispers[userId];
                saveData();
                
                const botInfo = await ctx.telegram.getMe();
                await ctx.telegram.sendMessage(whInfo.chatId, 
                    `• ياحلو ↤ [${whInfo.targetName}](tg://user?id=${whInfo.targetId})\n\n• وصلتك همسة سرية من ↤ [${name}](tg://user?id=${userId})\n\n• انت وحدك تقدر تشوفها`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'رؤية الهمسه', callback_data: `wh_view_${wId}` }],
                            [{ text: 'رد على الهمسه', url: `https://t.me/${botInfo.username}?start=start_reply_${wId}` }]
                        ]
                    }
                });

                return ctx.reply('• تم ارسال الهمسة');
            }

            if (db.pendingReplies && db.pendingReplies[userId]) {
                const repInfo = db.pendingReplies[userId];
                const wId = Date.now().toString() + Math.floor(Math.random() * 1000);

                let contentData = { type: 'text', value: '' };
                if (ctx.message.text) {
                    contentData = { type: 'text', value: ctx.message.text };
                } else if (ctx.message.sticker) {
                    contentData = { type: 'sticker', value: ctx.message.sticker.file_id };
                } else if (ctx.message.photo) {
                    contentData = { type: 'photo', value: ctx.message.photo[ctx.message.photo.length - 1].file_id, caption: ctx.message.caption || '' };
                } else if (ctx.message.animation) {
                    contentData = { type: 'animation', value: ctx.message.animation.file_id, caption: ctx.message.caption || '' };
                } else {
                    return ctx.reply('نوع المحتوى غير مدعوم للرد.');
                }

                if (!db.whispers) db.whispers = {};
                
                const originalWhisper = Object.values(db.whispers).find(w => w.targetId.toString() === userId.toString() || w.senderId.toString() === userId.toString());
                const targetChatId = repInfo.chatId || (originalWhisper ? originalWhisper.chatId : null);
                
                const originalSenderId = originalWhisper ? (originalWhisper.senderId.toString() === userId.toString() ? originalWhisper.targetId : originalWhisper.senderId) : repInfo.senderId;
                const originalSenderName = originalWhisper ? (originalWhisper.senderId.toString() === userId.toString() ? originalWhisper.targetName : originalWhisper.senderName) : 'المستخدم';

                db.whispers[wId] = {
                    senderId: userId,
                    senderName: name,
                    targetId: originalSenderId,
                    targetName: originalSenderName,
                    chatId: targetChatId,
                    content: contentData,
                    seen: false
                };
                delete db.pendingReplies[userId];
                saveData();

                const botInfo = await ctx.telegram.getMe();
                
                if (targetChatId) {
                    await ctx.telegram.sendMessage(targetChatId, 
                        `• ياحلو ↤ [${originalSenderName}](tg://user?id=${originalSenderId})\n\n• وصلتك همسة سرية من ↤ [${name}](tg://user?id=${userId})\n\n• انت وحدك تقدر تشوفها`, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'رؤية الهمسه', callback_data: `wh_view_${wId}` }],
                                [{ text: 'رد على الهمسه', url: `https://t.me/${botInfo.username}?start=start_reply_${wId}` }]
                            ]
                        }
                    });
                }

                return ctx.reply('• تم ارسال الرد كهمسة في القروب بنجاح ✓');
            }

            return;
        }

        if (ctx.chat.type === 'supergroup' || ctx.chat.type === 'group') {
            if (!db.stats[chatId]) db.stats[chatId] = {};
            if (!db.stats[chatId][userId]) db.stats[chatId][userId] = { count: 0, name: name };
            db.stats[chatId][userId].count += 1;
            db.stats[chatId][userId].name = name;
            saveData();

            if (db.muted[chatId] && db.muted[chatId][userId]) {
                try { await ctx.deleteMessage(); } catch(e){}
                return;
            }
            if (db.globalMuted && db.globalMuted[userId]) {
                try { await ctx.deleteMessage(); } catch(e){}
                return;
            }
        }

        // --- نظام الألعاب والتفاعل الحقيقي بدون إزعاج عند الخطأ ---
        if (db.activeGames && db.activeGames[chatId]) {
            const game = db.activeGames[chatId];
            const timeElapsed = ((Date.now() - game.startTime) / 1000).toFixed(1);

            if (text === game.answer) {
                delete db.activeGames[chatId];
                if (!db.money) db.money = {};
                if (!db.money[userId]) db.money[userId] = 0;
                db.money[userId] += 10;
                saveData();

                return ctx.reply(`صح عليك! 👏\nالمستخدم: [${name}](tg://user?id=${userId})\nالوقت المستغرق: ${timeElapsed} ثانية\nالسرعة ممتازة!\nتم إضافة 10 ريال وهمية لرصيدك. رصيدك الحالي: ${db.money[userId]} ريال`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            } else {
                // إذا أجاب بشكل خاطئ، لا يرد البوت نهائياً (يتجاهل الرسالة تماماً لكي لا يزعج القروب)
                return;
            }
        }

        if (text === 'تورايف') {
            return ctx.reply('عيون وقلب تورايف 🤍', { reply_to_message_id: ctx.message.message_id });
        }

        // --- أوامر الألعاب الفورية الحقيقية ---
        if (text === 'احزر' || text === 'لغز' || text === 'سؤال') {
            const questions = [
                { q: 'ما هو الشيء الذي أبيض من السُّكر وأسود من الفحم؟', a: 'القرآن' },
                { q: 'ما هو البيت الذي ليس فيه أبواب ولا نوافذ؟', a: 'بيت الشعر' },
                { q: 'من هو الحيوان الذي يحك أذنه بأنفه؟', a: 'الفيل' }
            ];
            const randomQ = questions[Math.floor(Math.random() * questions.length)];
            
            if (!db.activeGames) db.activeGames = {};
            db.activeGames[chatId] = {
                answer: randomQ.a,
                startTime: Date.now()
            };
            saveData();

            return ctx.reply(`• سؤال / لغز جديد:\n${randomQ.q}`, { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'سرعة' || text === 'أسرع') {
            const words = ['برمجة', 'تيليجرام', 'تورايف', 'تطوير', 'تفاعل'];
            const randomWord = words[Math.floor(Math.random() * words.length)];

            if (!db.activeGames) db.activeGames = {};
            db.activeGames[chatId] = {
                answer: randomWord,
                startTime: Date.now()
            };
            saveData();

            return ctx.reply(`• تحدي السرعة! رتب أو اكتب الكلمة التالية:\n\n💬 **${randomWord}**`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'فلوسي' || text === 'رصيدي') {
            const userMoney = (db.money && db.money[userId]) ? db.money[userId] : 0;
            return ctx.reply(`• رصيدك الوهمي الحالي هو: ${userMoney} ريال`, { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'الاوامر' || text === 'الأوامر' || text === 'اوامر' || text === 'أوامر' || text === 'مساعدة' || text === 'الخدمات') {
            return ctx.reply('• إليك قائمة أوامر بوت تورايف الشاملة، اختر القسم المطلوب:', {
                reply_to_message_id: ctx.message.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'التفاعل والتسلية', callback_data: 'help_games' },
                            { text: 'الأعضاء', callback_data: 'help_members' }
                        ],
                        [
                            { text: 'الحماية والإدارة', callback_data: 'help_protection' },
                            { text: 'الأغاني والمكالمة', callback_data: 'help_music' }
                        ],
                        [
                            { text: 'البوت', callback_data: 'help_bot' },
                            { text: '🎖️ المطور', callback_data: 'help_dev' }
                        ]
                    ]
                }
            });
        }

        let targetId = userId;
        let targetName = name;
        let targetUsername = username;

        if (ctx.message.reply_to_message && ctx.message.reply_to_message.from) {
            targetId = ctx.message.reply_to_message.from.id;
            targetName = ctx.message.reply_to_message.from.first_name || 'المستخدم';
            targetUsername = ctx.message.reply_to_message.from.username || '';
        }

        const targetRole = getUserRole(chatId, targetId, targetUsername);
        const targetTitle = getUserTitle(chatId, targetId);
        const targetUserLevel = getHierarchyLevel(targetRole);

        if (text === 'كتم' || text === 'عام' || text === 'الغاء التقييد' || text === 'الغاء الكتم') {
            if (userLevel < 2 && !isTheDev1) {
                return ctx.reply('هذا الأمر للمشرفين والممالك فقط.', { reply_to_message_id: ctx.message.message_id });
            }

            if (!ctx.message.reply_to_message) {
                return ctx.reply('يرجى الرد على رسالة الشخص المراد تطبيق الأمر عليه.', { reply_to_message_id: ctx.message.message_id });
            }

            if (targetUserLevel >= userLevel && !isTheDev1) {
                return ctx.reply(`• ما تقدر تستخدم الامر على ↤ [ ${targetRole} ]`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }

            if (targetId === userId) {
                return ctx.reply('لا يمكنك كتم نفسك.', { reply_to_message_id: ctx.message.message_id });
            }

            if (text === 'كتم') {
                if (!db.muted[chatId]) db.muted[chatId] = {};
                db.muted[chatId][targetId] = true;
                saveData();
                return ctx.reply(`• المستخدم ذا ↤ [ ${targetName} ](tg://user?id=${targetId})\n• كتمته`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }

            if (text === 'عام') {
                if (!db.globalMuted) db.globalMuted = {};
                db.globalMuted[targetId] = true;
                saveData();
                return ctx.reply(`• المستخدم ذا ↤ [ ${targetName} ](tg://user?id=${targetId})\n• تم كتمه عام`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }

            if (text === 'الغاء التقييد' || text === 'الغاء الكتم') {
                if (db.muted[chatId]) delete db.muted[chatId][targetId];
                if (db.globalMuted) delete db.globalMuted[targetId];
                saveData();
                return ctx.reply(`• المستخدم ذا ↤ [ ${targetName} ](tg://user?id=${targetId})\n• الغيت تقييده`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }
        }

        if (text === 'مم') {
            if (userLevel < 2 && !isTheDev1) {
                return ctx.reply('هذا الأمر للمشرفين والممالك فقط.', { reply_to_message_id: ctx.message.message_id });
            }
            const mutedList = db.muted[chatId] ? Object.keys(db.muted[chatId]) : [];
            if (mutedList.length === 0) {
                return ctx.reply('• لا يوجد مكتومين', { reply_to_message_id: ctx.message.message_id });
            }
            const count = mutedList.length;
            db.muted[chatId] = {};
            saveData();
            return ctx.reply(`• تم مسح ( ${count} ) من المكتومين`, { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'خخ') {
            if (userLevel < 2 && !isTheDev1) {
                return ctx.reply('هذا الأمر للمشرفين والممالك فقط.', { reply_to_message_id: ctx.message.message_id });
            }
            const globalMutedList = db.globalMuted ? Object.keys(db.globalMuted) : [];
            if (globalMutedList.length === 0) {
                return ctx.reply('• لا يوجد مكتومين عام ,', { reply_to_message_id: ctx.message.message_id });
            }
            const count = globalMutedList.length;
            db.globalMuted = {};
            saveData();
            return ctx.reply(`• تم مسح ( ${count} ) من المكتومين عام`, { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'اهمس' || text === 'همسه' || text === 'ه') {
            if (!ctx.message.reply_to_message) {
                return ctx.reply('يرجى الرد على رسالة الشخص المراد اهماسه.', { reply_to_message_id: ctx.message.message_id });
            }

            const targetUser = ctx.message.reply_to_message.from;
            const tId = targetUser.id;
            const tName = targetUser.first_name || 'المستخدم';

            if (tId === userId) {
                return ctx.reply('لا يمكنك إرسال همسة لنفسك.', { reply_to_message_id: ctx.message.message_id });
            }

            if (!db.pendingWhispers) db.pendingWhispers = {};
            db.pendingWhispers[userId] = {
                chatId: chatId,
                targetId: tId,
                targetName: tName
            };
            saveData();

            const botInfo = await ctx.telegram.getMe();
            return ctx.reply(`• تم تحديد الهمسه لـ ↤ [${tName}](tg://user?id=${tId})\n\n• اضغط الزر لكتابة الهمسة`, {
                parse_mode: 'Markdown',
                reply_to_message_id: ctx.message.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'اهمس هنا', url: `https://t.me/${botInfo.username}?start=start_whisper_${userId}` }]
                    ]
                }
            });
        }

        if (text === 'تفاعلي' || text === 'تفاعل') {
            if (!db.stats[chatId]) db.stats[chatId] = {};
            
            const sortedUsers = Object.entries(db.stats[chatId])
                .sort((a, b) => b[1].count - a[1].count);
            
            let userRank = 0;
            for (let i = 0; i < sortedUsers.length; i++) {
                if (sortedUsers[i][0].toString() === targetId.toString()) {
                    userRank = i + 1;
                    break;
                }
            }

            const userStats = (db.stats[chatId][targetId]) ? db.stats[chatId][targetId].count : 0;
            const finalRank = userRank > 0 ? userRank : (sortedUsers.length + 1);

            const replyMsg = `• المستخدم ذا ↤ [ ${targetName} ](tg://user?id=${targetId})\n\nرتبتك هي ↤ ${targetRole}\n• رسائلك بالتفاعل ↤ ${userStats}\n• ترتيبك بالممتفاعلين ↤ ${finalRank}\n-`;
            return ctx.reply(replyMsg, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'رتبته' || text === 'رتبتي') {
            return ctx.reply(`• المستخدم ذا ↤ [ ${targetName} ](tg://user?id=${targetId})\n\nرتبته ↤ ${targetRole}`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'لقبه' || text === 'لقبي') {
            return ctx.reply(`• المستخدم ذا ↤ [ ${targetName} ](tg://user?id=${targetId})\n\nلقبه ↤ ${targetTitle}`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'المتفاعلين' || text === 'المتفاعلير' || text === 'توب') {
            if (!db.stats[chatId] || Object.keys(db.stats[chatId]).length === 0) {
                return ctx.reply('لا توجد إحصائيات تفاعل مسجلة بعد في هذه المجموعة.', { reply_to_message_id: ctx.message.message_id });
            }

            const sortedUsers = Object.entries(db.stats[chatId])
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 20);

            let listText = 'توب اكثر 20 متفاعلين بالقروب :\n\n';
            
            sortedUsers.forEach(([uId, data], index) => {
                let medal = `${index + 1} )`;
                if (index === 0) medal = '1 )';
                else if (index === 1) medal = '2 )';
                else if (index === 2) medal = '3 )';

                listText += `${medal} ${data.count} | [${data.name}](tg://user?id=${uId})\n`;
            });

            return ctx.reply(listText, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
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
        const name = ctx.from.first_name || 'المستخدم';
        const isTheDev1 = isDev1(userId, username);

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
            let alertText = c.type === 'sticker' ? 'محتوى الهمسة: ملصق' : (c.type === 'photo' ? (c.caption ? `${c.caption}` : 'محتوى الهمسة: صورة') : (c.type === 'animation' ? (c.caption ? `${c.caption}` : 'محتوى الهمسة: تحريك') : c.value));
            
            if (!wh.seen) {
                wh.seen = true;
                saveData();
                try { await ctx.telegram.sendMessage(wh.senderId, `• ${name}\n• شاف همستك .\n-`); } catch (e) {}
            }
            return ctx.answerCbQuery(alertText, { show_alert: true });
        }

        if (data.startsWith('help_')) {
            let sectionText = '';
            let backButton = [[{ text: 'العودة للقائمة الرئيسية', callback_data: 'help_main' }]];

            if (data === 'help_games') {
                sectionText = 'قسم التفاعل والتسلية:\n\n- مسابقة ، احزر ، حظ ، نرد ، عملة ، سرعة ، اختار ، صراحة ، تحدي ، توافق ، نقاط ، مستواي ، توب ، ترتيب ، فعالية ، سؤال ، لغز ، ذكاء ، أسرع ، صح ، خطأ';
            } else if (data === 'help_members') {
                sectionText = 'قسم الأعضاء:\n\n- معلوماتي ، ايدي ، رتبتي ، حسابي ، منشن ، قوانين ، اهمس ، همسه ، ه ، وقتي ، نقاطي ، مستواي ، رتبتي';
            } else if (data === 'help_protection') {
                sectionText = 'قسم الحماية والإدارة:\n\n- حظر ، فك_الحظر ، طرد ، كتم ، فك_الكتم ، تقييد ، فك_التقييد ، تحذير ، فك_التحذير ، حذف ، تثبيت ، فك_التثبيت ، قفل ، فتح ، القوانين ، تعيين_القوانين ، ممنوع ، فك_المنع ، منع_الروابط ، منع_التكرار ، تنظيف ، مم ، خخ';
            } else if (data === 'help_music') {
                sectionText = 'قسم الأغاني والمكالمة:\n\n- شغل ، أغنية ، ابحث ، يوت ، تشغيل ، إيقاف ، تخطي ، قائمة';
            } else if (data === 'help_bot') {
                sectionText = 'قسم البوت:\n\n- بداية ، مساعدة ، معلومات ، إعدادات ، سرعة_البوت';
            } else if (data === 'help_dev') {
                if (!isTheDev1) {
                    return ctx.answerCbQuery('هذا القسم مخصص للمطور الأساسي فقط!', { show_alert: true });
                }
                sectionText = '🎖️ قسم المطور:\n\n- مطور ، إحصائيات ، المستخدمين ، المجموعات ، إذاعة ، إضافة_مطور ، حذف_مطور ، إعادة_تشغيل ، صيانة ، السجل ، تغيير_البادئة ، نسخة_احتياطية';
            } else if (data === 'help_main') {
                sectionText = '• إليك قائمة أوامر بوت تورايف الشاملة، اختر القسم المطلوب:';
                backButton = [
                    [
                        { text: 'التفاعل والتسلية', callback_data: 'help_games' },
                        { text: 'الأعضاء', callback_data: 'help_members' }
                    ],
                    [
                        { text: 'الحماية والإدارة', callback_data: 'help_protection' },
                        { text: 'الأغاني والمكالمة', callback_data: 'help_music' }
                    ],
                    [
                        { text: 'البوت', callback_data: 'help_bot' },
                        { text: '🎖️ المطور', callback_data: 'help_dev' }
                    ]
                ];
            }

            return ctx.editMessageText(sectionText, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: backButton
                }
            });
        }
    } catch (e) {}
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
