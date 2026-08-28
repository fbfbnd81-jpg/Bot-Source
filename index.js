const { Telegraf, Markup } = require('telegraf');
const http = require('http');
const fs = require('fs');
const ytsr = require('ytsr');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Toraif Bot is active!');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf('8963407967:AAHnqGEd7ft6JPeEQ_97R_cj284V3kJJhng');

const mutedUsers = {};       
const globalMutedUsers = {}; 
const groupSettings = {}; 
const whispers = {}; // تخزين الهمسات المؤقتة

const DATA_FILE = './toraif_github_database.json';
let db = { roles: {}, stats: {} };

if (fs.existsSync(DATA_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (!db.roles) db.roles = {};
        if (!db.stats) db.stats = {};
    } catch (e) {}
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    } catch (e) {}
}

function getUserRole(chatId, userId, username) {
    if (username && username.toLowerCase() === 'j4xa7') {
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
    'مالك': 2,
    'مالك اساسي': 3,
    'myth': 4,
    'Myth🎖️': 5,      
    'Dev²🎖': 6,
    'Dev🎖️': 7,
    'Dev1_Super': 8
};

function hasPermission(userRole, requiredRole) {
    return (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
}

bot.on('message', async (ctx) => {
    try {
        if (!ctx.chat) return;
        
        const isChannel = ctx.chat.type === 'channel';
        const chatId = ctx.chat.id;
        const userId = ctx.from ? ctx.from.id : chatId;
        const username = ctx.from && ctx.from.username ? ctx.from.username : '';
        const name = ctx.from && ctx.from.first_name ? ctx.from.first_name : 'المستخدم';
        const role = isChannel ? 'Dev🎖️' : getUserRole(chatId, userId, username);
        const text = (ctx.message.text || ctx.message.caption || '').trim();
        const isEdited = !!ctx.update.edited_message;
        const mention = `[${name}](tg://user?id=${userId})`;
        const isTheDevOne = (username.toLowerCase() === 'j4xa7');

        // التعامل مع الرسائل الخاصة (الهمسات)
        if (ctx.chat.type === 'private') {
            if (global.waitingForWhisper && global.waitingForWhisper[userId]) {
                const targetData = global.waitingForWhisper[userId];
                delete global.waitingForWhisper[userId];

                const whisperId = Math.random().toString(36).substring(2, 9);
                whispers[whisperId] = {
                    fromId: userId,
                    fromName: name,
                    toId: targetData.targetId,
                    toName: targetData.targetName,
                    text: text
                };

                // إرسال الهمسة للقروب بالشكل المطلوب
                const whisperMsgText = `• تم تحديد الهمسه ↦ [${targetData.targetName}](tg://user?id=${targetData.targetId})\n• اضغط الزر لكتابة الهمسة`;
                await bot.telegram.sendMessage(targetData.chatId, whisperMsgText, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: 'رؤية الهمسة', callback_data: `view_whisper_${whisperId}` },
                            { text: 'رد على الهمسة', callback_data: `reply_whisper_${whisperId}` }
                        ]]
                    }
                });

                return ctx.reply('• تم إرسال الهمسه بنجاح ✓');
            }
            return;
        }

        if (text === 'احبك' || text === 'أحبك') {
            const loveReplies = ['وانا احب ايفي', 'وانا احب توري', 'وانا بعد', 'اعشقك'];
            return ctx.reply(loveReplies[Math.floor(Math.random() * loveReplies.length)], { reply_to_message_id: ctx.message.message_id });
        }

        if (ctx.chat.type !== 'private' && ctx.from && !ctx.from.is_bot) {
            const isMutedInGroup = mutedUsers[chatId] && mutedUsers[chatId][userId];
            const isGloballyMuted = globalMutedUsers[userId];

            if (isMutedInGroup || isGloballyMuted) {
                try {
                    await ctx.deleteMessage();
                } catch (e) {}
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

        // نظام بحث الأغاني (يوت / بحث)
        if (text.startsWith('يوت ') || text.startsWith('بحث ')) {
            const query = text.replace(/^(يوت|بحث)\s+/, '').trim();
            if (!query) return ctx.reply('يرجى كتابة اسم الأغنية بعد الأمر.', { reply_to_message_id: ctx.message.message_id });

            try {
                const searchResults = await ytsr(query, { limit: 1 });
                if (!searchResults || searchResults.items.length === 0) {
                    return ctx.reply('لم يتم العثور على نتائج مطابقة.', { reply_to_message_id: ctx.message.message_id });
                }
                const video = searchResults.items[0];
                const botUsername = ctx.botInfo ? ctx.botInfo.username : 'Toraif_bot';

                const musicReplyText = `[${video.title}](${video.url})\nانوفي 16 شراري\n\n• @${botUsername} 🎵`;
                return ctx.reply(musicReplyText, {
                    parse_mode: 'Markdown',
                    reply_to_message_id: ctx.message.message_id,
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '▶ تشغيل', url: video.url }
                        ]]
                    }
                });
            } catch (err) {
                return ctx.reply('حدث خطأ أثناء البحث عن الأغنية.', { reply_to_message_id: ctx.message.message_id });
            }
        }

        // نظام الهمسة (همسه / اهمس / ه) بالرد على الشخص
        if (['همسه', 'اهمس', 'ه'].includes(text)) {
            if (!ctx.message.reply_to_message) {
                return ctx.reply('يرجى الرد على الشخص الذي تريد أهمسته.', { reply_to_message_id: ctx.message.message_id });
            }
            const targetUser = ctx.message.reply_to_message.from;
            const targetId = targetUser.id;
            const targetName = targetUser.first_name || 'المستخدم';

            const botUsername = ctx.botInfo ? ctx.botInfo.username : 'Toraif_bot';
            const replyText = `• تم تحديد الهمسه ↦ [${targetName}](tg://user?id=${targetId})\n• اضغط الزر لكتابة الهمسة`;

            return ctx.reply(replyText, {
                parse_mode: 'Markdown',
                reply_to_message_id: ctx.message.message_id,
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'اهمس هنا ↗', url: `https://t.me/${botUsername}?start=whisper_${chatId}_${targetId}_${targetName}` }
                    ]]
                }
            });
        }

        // أمر تفاعلي
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
            } else if (role === 'مميز') {
                roleDisplay = 'مميز';
            } else if (role === 'مالك' || role === 'مالك اساسي') {
                roleDisplay = role;
            } else {
                roleDisplay = 'عضو';
            }

            const replyText = `• رتبتك هي ↦ ${roleDisplay}\n\n` +
                              `• رسايلك بالتفاعل ↦ ${msgCount}\n` +
                              `• ترتيبك بالممتفاعلين ↦ ${rankNumber}\n-`;
            return ctx.reply(replyText, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
        }

        // أمر المتفاعلين
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
                topText += `${prefix} ${data.count} | [${mName}](tg://user?id=${id})\n`;
            });

            return ctx.reply(topText, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
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
            if (!hasPermission(role, 'Dev🎖️')) {
                return ctx.reply('• هذا الامر يخص ↦ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
            }
            if (!groupSettings[chatId]) groupSettings[chatId] = { violations: true, edit: true, mentionAll: true };
            groupSettings[chatId].violations = true;
            groupSettings[chatId].edit = true;
            return ctx.reply('تم فتح المخالفات والتعديل. 🔓', { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'قفل المخالفات' || text === 'قفل التعديل') {
            if (!hasPermission(role, 'Dev🎖️')) {
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
            return ctx.reply(`• رتبتك هي ↦ ｢ ${role} ｣`, { reply_to_message_id: ctx.message.message_id });
        }

        if (['كتم', 'كتم عام', 'تقييد', 'فك التقييد', 'الغاء التقييد', 'رفع القيود', 'فك الكتم', 'فك الكتم العام'].includes(text) || text.startsWith('رفع ') || text === 'تنزيل الكل') {
            if (!ctx.message.reply_to_message) {
                return ctx.reply('يرجى الرد على الشخص لتنفيذ الأمر.', { reply_to_message_id: ctx.message.message_id });
            }
            const targetUser = ctx.message.reply_to_message.from;
            const targetId = targetUser.id;
            const targetName = targetUser.first_name || 'المستخدم';
            const targetUsername = targetUser.username || '';
            const targetRole = getUserRole(chatId, targetId, targetUsername);
            const targetMention = `[${targetName}](tg://user?id=${targetId})`;

            if (text === 'كتم' && !hasPermission(role, 'myth')) {
                return ctx.reply('• هذا الامر يخص ↦ ｢ Myth ｣', { reply_to_message_id: ctx.message.message_id });
            }
            if (text === 'كتم عام' && !hasPermission(role, 'Myth🎖️')) {
                return ctx.reply('• هذا الامر يخص ↦ ｢ Myth 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
            }
            if ((text === 'تقييد' || text === 'فك التقييد' || text === 'الغاء التقييد' || text === 'رفع القيود') && !hasPermission(role, 'Dev²🎖')) {
                return ctx.reply('• هذا الامر يخص ↦ ｢ Dev²🎖 ｣', { reply_to_message_id: ctx.message.message_id });
            }
            if ((text.startsWith('رفع ') || text === 'تنزيل الكل') && !hasPermission(role, 'Myth🎖️')) {
                return ctx.reply('• هذا الامر يخص ↦ ｢ Myth 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
            }

            if (['كتم', 'كتم عام', 'تقييد'].includes(text)) {
                if ((roleHierarchy[role] || 0) <= (roleHierarchy[targetRole] || 0)) {
                    return ctx.reply(`• ماقدر تستخدم الامر على ↦ ｢ ${targetRole} ｣`, { reply_to_message_id: ctx.message.message_id });
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
                if (!db.roles[chatId]) db.roles[chatId] = {};
                db.roles[chatId][targetId] = 'عضو';
                saveData();
                return ctx.reply(`• المستخدم ↦ ${targetMention}\n• تم تنزيله من الرتبة ( عضو )`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }
            if (text.startsWith('رفع ')) {
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

// التعامل مع الضغط على أزرار الهمسات وعملية /start الخاصة بالهمسة
bot.on('callback_query', async (ctx) => {
    try {
        const data = ctx.callbackQuery.data;

        if (data.startsWith('view_whisper_')) {
            const whisperId = data.replace('view_whisper_', '');
            const whisper = whispers[whisperId];

            if (!whisper) {
                return ctx.answerCbQuery('انتهت صلاحية الهمسة أو تم حذفها.', { show_alert: true });
            }

            const currentUserId = ctx.from.id;
            if (currentUserId !== whisper.toId && currentUserId !== whisper.fromId) {
                return ctx.answerCbQuery('عذراً، هذه الهمسة ليس لك (أنت وحدك تقدر تشوفها).', { show_alert: true });
            }

            return ctx.answerCbQuery(`محتوى الهمسة:\n${whisper.text}`, { show_alert: true });
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
            return ctx.reply(`لرد الهمسة، اضغط على الرابط للذهاب لخاص البوت:\nhttps://t.me/${botUsername}`);
        }
    } catch (e) {}
});

bot.on('message', async (ctx, next) => {
    if (ctx.chat && ctx.chat.type === 'private' && ctx.message.text && ctx.message.text.startsWith('/start whisper_')) {
        const parts = ctx.message.text.replace('/start whisper_', '').split('_');
        const chatId = parts[0];
        const targetId = parts[1];
        const targetName = decodeURIComponent(parts[2] || 'المستخدم');
        const userId = ctx.from.id;

        if (!global.waitingForWhisper) global.waitingForWhisper = {};
        global.waitingForWhisper[userId] = { chatId, targetId, targetName };

        return ctx.reply(`• تم تحديد الهمسه لـ ↦ ${targetName}\n• اكتب الهمسة الآن في الخاص (مثال: احبك):`);
    }
    return next();
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
