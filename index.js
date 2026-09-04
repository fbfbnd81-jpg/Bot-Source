const { Telegraf, Markup } = require('telegraf');
const http = require('http');
const fs = require('fs');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Torayf Bot is active!');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf('8963407967:AAHnqGEd7ft6JPeEQ_97R_cj284V3kJJhng');

const DATA_FILE = './toraif_github_database.json';
let db = { 
    roles: {}, 
    stats: {}, 
    titles: {}, 
    muted: {}, 
    globalMuted: {}, 
    whispers: {}, 
    pendingWhispers: {},
    pendingReplies: {},
    money: {},
    activeGames: {},
    warnings: {},
    violationsSettings: {},
    marriages: {},
    customCommands: {},
    customReplies: {},
    settings: {}
};

if (fs.existsSync(DATA_FILE)) {
    try {
        const fileData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (fileData.roles) db.roles = fileData.roles;
        if (fileData.stats) db.stats = fileData.stats;
        if (fileData.titles) db.titles = fileData.titles;
        if (fileData.muted) db.muted = fileData.muted;
        if (fileData.globalMuted) db.globalMuted = fileData.globalMuted;
        if (fileData.whispers) db.whispers = fileData.whispers;
        if (fileData.pendingWhispers) db.pendingWhispers = fileData.pendingWhispers;
        if (fileData.pendingReplies) db.pendingReplies = fileData.pendingReplies;
        if (fileData.money) db.money = fileData.money;
        if (fileData.activeGames) db.activeGames = fileData.activeGames;
        if (fileData.warnings) db.warnings = fileData.warnings;
        if (fileData.violationsSettings) db.violationsSettings = fileData.violationsSettings;
        if (fileData.marriages) db.marriages = fileData.marriages;
        if (fileData.customCommands) db.customCommands = fileData.customCommands;
        if (fileData.customReplies) db.customReplies = fileData.customReplies;
        if (fileData.settings) db.settings = fileData.settings;
    } catch (e) {}
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    } catch (e) {}
}

function isDev1(userId, username) {
    return (username && username.toLowerCase() === 'j4xa7') || userId.toString() === '123456789';
}

function getHierarchyLevel(role) {
    if (!role) return 0;
    const r = role.trim();
    if (r === 'Dev🎖️') return 7;
    if (r === 'Dev²🎖️') return 6;
    if (r === 'Myth 🎖️') return 5;
    if (r === 'Myth') return 4;
    if (r === 'مالك أساسي') return 3;
    if (r === 'مالك') return 2;
    if (r === 'مميز') return 1;
    return 0;
}

function getRankName(level) {
    switch (level) {
        case 7: return 'Dev🎖️';
        case 6: return 'Dev²🎖️';
        case 5: return 'Myth 🎖️';
        case 4: return 'Myth';
        case 3: return 'مالك أساسي';
        case 2: return 'مالك';
        case 1: return 'مميز';
        default: return 'عضو';
    }
}

function getUserRole(chatId, userId, username) {
    if (isDev1(userId, username)) return 'Dev🎖️';
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

bot.on('edited_message', async (ctx) => {
    try {
        if (!ctx.chat) return;
        const chatId = ctx.chat.id;
        if (db.violationsSettings && db.violationsSettings[chatId] === false) return;

        const userId = ctx.from ? ctx.from.id : chatId;
        const username = ctx.from && ctx.from.username ? ctx.from.username : '';
        const name = ctx.from && ctx.from.first_name ? ctx.from.first_name : 'المستخدم';

        const role = getUserRole(chatId, userId, username);
        if (getHierarchyLevel(role) >= 1) return;

        try { await ctx.deleteMessage(); } catch (e) {}
        return ctx.reply(`${name}، ممنوع ارسال تعديل الرسائل`, { reply_to_message_id: ctx.editedMessage.message_id }).catch(() => {});
    } catch (e) {}
});

bot.on('message', async (ctx) => {
    try {
        if (!ctx.chat) return;

        const chatId = ctx.chat.id.toString();
        const userId = ctx.from ? ctx.from.id.toString() : chatId;
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

            const isOpenViolations = (db.violationsSettings[chatId] !== false);

            if (isOpenViolations && userLevel < 1) {
                let isViolating = false;
                let warningReason = '';

                const urlRegex = /(https?:\/\/[^\s]+)|(t\.me\/[^\s]+)|(www\.[^\s]+)/gi;
                if (urlRegex.test(text) || (ctx.message.entities && ctx.message.entities.some(e => e.type === 'url' || e.type === 'text_link'))) {
                    isViolating = true;
                    warningReason = 'ممنوع إرسال الروابط!';
                }

                if (!isViolating && text.length > 400) {
                    isViolating = true;
                    warningReason = 'رسالتك طويلة جداً ومخالفة لقوانين المجموعة!';
                }

                if (isViolating) {
                    try { await ctx.deleteMessage(); } catch (e) {}

                    if (!db.warnings) db.warnings = {};
                    if (!db.warnings[chatId]) db.warnings[chatId] = {};
                    if (!db.warnings[chatId][userId]) db.warnings[chatId][userId] = 0;

                    db.warnings[chatId][userId] += 1;
                    const currentWarnings = db.warnings[chatId][userId];
                    saveData();

                    if (currentWarnings >= 3) {
                        if (!db.muted[chatId]) db.muted[chatId] = {};
                        db.muted[chatId][userId] = true;
                        db.warnings[chatId][userId] = 0;
                        saveData();
                        return ctx.reply(`⚠️ ${name}، لقد وصلت إلى 3 إنذارات! تم تطبيق عقوبة الكتم عليك.`);
                    } else {
                        return ctx.reply(`⚠️ تحذير لـ [${name}](tg://user?id=${userId}): ${warningReason} (إنذار ${currentWarnings}/3)`, { parse_mode: 'Markdown' });
                    }
                }
            }
        }

        if (text === 'فتح المخالفات') {
            if (userLevel < 7) return ctx.reply('• هذا الامر يخص ↤ ｢ Dev🎖️ ｣');
            if (!db.violationsSettings) db.violationsSettings = {};
            db.violationsSettings[chatId] = true;
            saveData();
            return ctx.reply('🔓 تم فتح المخالفات.');
        }

        if (text === 'قفل المخالفات') {
            if (userLevel < 7) return ctx.reply('• هذا الامر يخص ↤ ｢ Dev🎖️ ｣');
            if (!db.violationsSettings) db.violationsSettings = {};
            db.violationsSettings[chatId] = false;
            saveData();
            return ctx.reply('🔒 تم قفل المخالفات بنجاح');
        }

        if (text === 'تورايف') {
            return ctx.reply('عيون وقلب تورايف 🤍', { reply_to_message_id: ctx.message.message_id });
        }

        // --- تعديل الشكل ليطابق الصور المطلوبة تماماً ---
        let targetId = userId;
        let targetName = name;
        let targetUsername = username;

        if (ctx.message.reply_to_message && ctx.message.reply_to_message.from) {
            targetId = ctx.message.reply_to_message.from.id.toString();
            targetName = ctx.message.reply_to_message.from.first_name || 'المستخدم';
            targetUsername = ctx.message.reply_to_message.from.username || '';
        }

        const targetRole = getUserRole(chatId, targetId, targetUsername);
        const targetUserLevel = getHierarchyLevel(targetRole);

        if (text === 'تفاعلي' || text === 'رتبتي') {
            if (!db.stats[chatId]) db.stats[chatId] = {};
            const count = db.stats[chatId][targetId] ? db.stats[chatId][targetId].count : 0;
            const sorted = Object.entries(db.stats[chatId]).sort((a,b)=>b[1].count - a[1].count);
            let rankNum = sorted.findIndex(s=>s[0] === targetId) + 1;
            if (rankNum === 0) rankNum = sorted.length + 1;

            const exactReply = `• المستخدم ذا ↤ ${targetName}\n\nرتبتك هي ↤ ${targetRole}\n• رسائلك بالتفاعل ↤ ${count}\n• ترتيبك بالممتفاعلين ↤ ${rankNum}\n-`;
            return ctx.reply(exactReply);
        }

        if (text === 'المتفاعلين' || text === 'التوب') {
            if (!db.stats[chatId]) return ctx.reply('لا توجد إحصائيات تفاعل.');
            const sorted = Object.entries(db.stats[chatId]).sort((a,b)=>b[1].count - a[1].count).slice(0, 20);
            let msg = 'توب اكتر 20 متفاعلين بالقروب :\n\n';
            sorted.forEach(([uId, data], i) => {
                msg += `${i + 1} ) ${data.count} | ${data.name}\n`;
            });
            return ctx.reply(msg);
        }

        if (text === 'اهمس' || text === 'همسه' || text === 'ه') {
            if (!ctx.message.reply_to_message) return ctx.reply('يرجى الرد على الشخص.');
            const tId = ctx.message.reply_to_message.from.id.toString();
            const tName = ctx.message.reply_to_message.from.first_name || 'المستخدم';

            if (!db.pendingWhispers) db.pendingWhispers = {};
            db.pendingWhispers[userId] = { chatId, targetId: tId, targetName: tName };
            saveData();

            const botInfo = await ctx.telegram.getMe();
            return ctx.reply(`• تم تحديد الهمسه لـ ↤ ${tName}\n• اضغط الزر لكتابة الهمسة`, {
                reply_markup: { inline_keyboard: [[{ text: 'اهمس هنا', url: `https://t.me/${botInfo.username}?start=start_whisper_${userId}` }]] }
            });
        }

    } catch (e) {}
});

bot.action('hide_message', async (ctx) => {
    try { await ctx.deleteMessage(); } catch(e){}
});

bot.action(/wh_view_(.+)/, async (ctx) => {
    try {
        const wId = ctx.match[1];
        const userId = ctx.from.id.toString();
        if (!db.whispers || !db.whispers[wId]) return ctx.answerCbQuery('انتهت الصلاحية', { show_alert: true });
        const wh = db.whispers[wId];
        if (userId !== wh.targetId.toString()) return ctx.answerCbQuery('لا تخصك', { show_alert: true });
        
        return ctx.answerCbQuery(wh.content.value || 'محتوى الهمسة', { show_alert: true });
    } catch(e){}
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
