const { Telegraf } = require('telegraf');
const http = require('http');
const fs = require('fs');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Toraif Bot is active!');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf('8963407967:AAHnqGEd7ft6JPeEQ_97R_cj284V3kJJhng');

const adminMenus = {}; 

const DATA_FILE = './toraif_github_database.json';
let db = { roles: {}, stats: {}, titles: {}, muted: {}, globalMuted: {} };

if (fs.existsSync(DATA_FILE)) {
    try {
        const fileData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (fileData.roles) db.roles = fileData.roles;
        if (fileData.stats) db.stats = fileData.stats;
        if (fileData.titles) db.titles = fileData.titles;
        if (fileData.muted) db.muted = fileData.muted;
        if (fileData.globalMuted) db.globalMuted = fileData.globalMuted;
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
    if (r === 'Dev🎖️') return 7; // ديف ون / مطور اساسي
    if (r === 'Dev²🎖️') return 6; // ديف تو
    if (r === 'Myth🎖️') return 5; // اكسترا / اكس
    if (r === 'myth') return 4; // ميث / M
    if (r === 'مالك اساسي') return 3; // اساس / مالك اساسي
    if (r === 'مالك') return 2; // مالك
    if (r === 'مميز') return 1; // مميز
    return 0;
}

function getUserRole(chatId, userId, username) {
    if (isDev1(userId, username)) return 'Dev🎖️';
    if (db.roles[chatId] && db.roles[chatId][userId]) return db.roles[chatId][userId];
    return 'عضو';
}

bot.start(async (ctx) => {
    try {
        const botInfo = await ctx.telegram.getMe();
        const botUsername = botInfo.username;
        const startText = `اهلا بك يا قلبي 🫶 - ُ\n\n• انا اشغل لك اللي تبي بالمكالمه\n\nادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.`;

        return ctx.reply(startText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '➕ أضفني في مجموعتك', url: `https://t.me/${botUsername}?startgroup=true` }],
                    [{ text: '👤 المطور', url: 'https://t.me/j4xa7' }]
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

        if (ctx.chat.type === 'private') return;

        // فحص الكتم والعام والمكتومين
        if (ctx.chat.type !== 'private' && ctx.from && !ctx.from.is_bot) {
            const isMuted = db.muted[chatId] && db.muted[chatId][userId];
            const isGlobalMuted = db.globalMuted && db.globalMuted[userId];
            if (isMuted || isGlobalMuted) {
                try { await ctx.deleteMessage(); } catch (e) {}
                return; 
            }
        }

        // الرد "ياغبيي ذا البوت" فقط عند محاولة كتم/تقييد/حظر/همس البوت نفسه
        const isTargetingBot = ctx.message.reply_to_message && 
                               ctx.message.reply_to_message.from && 
                               ctx.message.reply_to_message.from.is_bot && 
                               ctx.message.reply_to_message.from.id === ctx.botInfo.id;
        
        const isBotActionAttempt = ['كتم', 'كتم عام', 'تقييد', 'حظر', 'اهمس', 'طرد'].includes(text);
        if (isBotActionAttempt && isTargetingBot) {
            return ctx.reply('ياغبيي ذا البوت', { reply_to_message_id: ctx.message.message_id });
        }

        // تفاعلات عامة
        if (text === 'احبك' || text === 'أحبك') {
            const loveReplies = ['وانا احب ايفي', 'وانا احب توري', 'وانا بعد', 'اعشقك'];
            return ctx.reply(loveReplies[Math.floor(Math.random() * loveReplies.length)], { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'توري') return ctx.reply('• توري ↦ @to6ri', { reply_to_message_id: ctx.message.message_id });
        if (text === 'ايفي' || text === 'ايلاف') return ctx.reply('• المطور ↦ @j4xa7', { reply_to_message_id: ctx.message.message_id });
        if (text === 'تورايف') {
            const replies = ['عيوني', 'أمر؟', 'سم', 'عيون ايفي وتوري', 'هلا'];
            return ctx.reply(replies[Math.floor(Math.random() * replies.length)], { reply_to_message_id: ctx.message.message_id });
        }

        // تتبع التفاعل
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

        // أمر تصفير التفاعل (مخصص لديف ون فقط)
        if (text === 'تصفير التفاعل') {
            if (!isTheDev1) {
                return ctx.reply('• هذا الامر يخص ↤ ｢ Dev 🎖 ｣', { reply_to_message_id: ctx.message.message_id });
            }
            db.stats[chatId] = {};
            saveData();
            return ctx.reply('• تم تصفير تفاعل القروب بنجاح ✓', { reply_to_message_id: ctx.message.message_id });
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

        // --- أوامر الكتم الخاصة ---
        if (text === 'مم') { // مسح المكتومين
            if (userLevel < 4) { // تحتاج ميث وفوق مثلاً أو مشرف
                return ctx.reply('• هذا الأمر مخصص للمشرفين والرتب العليا فقط ❌', { reply_to_message_id: ctx.message.message_id });
            }
            db.muted[chatId] = {};
            saveData();
            return ctx.reply('• تم مسح جميع المكتومين في القروب ✓', { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'خخ') { // مسح المكتومين عام
            if (userLevel < 6) { // ديف تو وفوق
                return ctx.reply('• هذا الامر يخص ↤ ｢ Dev²🎖 ｣', { reply_to_message_id: ctx.message.message_id });
            }
            db.globalMuted = {};
            saveData();
            return ctx.reply('• تم مسح جميع المكتومين عام ✓', { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'كتم') {
            if (userLevel < 4) { // ماحد يقدر الا myth وفوق
                return ctx.reply('• هذا الأمر مخصص لـ ｢ myth ｣ وفوق ❌', { reply_to_message_id: ctx.message.message_id });
            }
            if (!ctx.message.reply_to_message) return ctx.reply('يرجى الرد على الشخص.', { reply_to_message_id: ctx.message.message_id });
            const tId = ctx.message.reply_to_message.from.id;
            if (!db.muted[chatId]) db.muted[chatId] = {};
            db.muted[chatId][tId] = true;
            saveData();
            return ctx.reply('• تم كتم المستخدم بنجاح ✓', { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'عام') { // الكتم العام
            if (userLevel < 5) { // Myth🎖️ وفوق
                return ctx.reply('• هذا الأمر مخصص لـ ｢ Myth🎖️ ｣ وفوق ❌', { reply_to_message_id: ctx.message.message_id });
            }
            if (!ctx.message.reply_to_message) return ctx.reply('يرجى الرد على الشخص.', { reply_to_message_id: ctx.message.message_id });
            const tId = ctx.message.reply_to_message.from.id;
            db.globalMuted[tId] = true;
            saveData();
            return ctx.reply('• تم كتم المستخدم عام بنجاح ✓', { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'تقييد') {
            if (userLevel < 6) { // ديف تو وفوق فقط
                return ctx.reply('• هذا الامر يخص ↤ ｢ Dev²🎖 ｣', { reply_to_message_id: ctx.message.message_id });
            }
            if (!ctx.message.reply_to_message) return ctx.reply('يرجى الرد على الشخص.', { reply_to_message_id: ctx.message.message_id });
            const tId = ctx.message.reply_to_message.from.id;
            try {
                await ctx.telegram.restrictChatMember(chatId, tId, { permissions: { can_send_messages: false } });
            } catch(e){}
            return ctx.reply('• تم تقييد المستخدم بنجاح ✓', { reply_to_message_id: ctx.message.message_id });
        }

        // --- أوامر الرفع والرتب ---
        const isPromotionCmd = text.startsWith('رفع ') || ['مميز', 'مالك', 'اساس', 'اساسي', 'م', 'ميث', 'اكس', 'اكسترا', 'ديف', 'مطور اساسي', 'تنزيل مشرف', 'تنزيل الكل'].includes(text);

        if (isPromotionCmd) {
            if (!ctx.message.reply_to_message) {
                return ctx.reply('يرجى الرد على الشخص لتنفيذ الأمر.', { reply_to_message_id: ctx.message.message_id });
            }
            const targetUser = ctx.message.reply_to_message.from;
            const targetId = targetUser.id;
            const targetName = targetUser.first_name || 'المستخدم';
            const targetMention = `[${targetName}](tg://user?id=${targetId})`;

            // تحليل الرتبة المطلوبة وصيغها
            let requestedRank = '';
            let targetRankLevel = 0;

            const cleanText = text.replace('رفع ', '').trim();
            if (cleanText === 'مميز') { requestedRank = 'مميز'; targetRankLevel = 1; }
            else if (cleanText === 'مالك') { requestedRank = 'مالك'; targetRankLevel = 2; }
            else if (cleanText === 'اساس' || cleanText === 'اساسي' || cleanText === 'مالك اساسي') { requestedRank = 'مالك اساسي'; targetRankLevel = 3; }
            else if (cleanText === 'م' || cleanText === 'ميث') { requestedRank = 'myth'; targetRankLevel = 4; }
            else if (cleanText === 'اكس' || cleanText === 'اكسترا') { requestedRank = 'Myth🎖️'; targetRankLevel = 5; }
            else if (cleanText === 'ديف') { requestedRank = 'Dev²🎖️'; targetRankLevel = 6; }
            else if (cleanText === 'مطور اساسي') { requestedRank = 'Dev🎖️'; targetRankLevel = 7; }
            else if (text === 'تنزيل مشرف' || text === 'تنزيل الكل') { requestedRank = 'عضو'; targetRankLevel = 0; }

            // فحص صلاحيات الرفع بناءً على طلبك:
            // - المالك الأساسي يقدر يرفع المميز والمالك فقط (level 3 يقدر يرفع 1 و 2)
            // - الميث يقدر يرفع: مالك اساسي، مالك، مميز (level 4 يقدر يرفع 3, 2, 1)
            // - الاكسترا يقدر يرفع: مالك اساسي، مالك، مميز (level 5 يقدر يرفع 3, 2, 1)
            // - ديف تو يقدر يرفع: ميث، مالك اساسي، مميز (level 6 يقدر يرفع 4, 3, 1)
            // - ديف ون يرفع الكل
            let canPromote = false;
            if (isTheDev1 || userLevel === 7) {
                canPromote = true; // ديف ون يرفع الكل
            } else if (userLevel === 6) { // ديف تو (يقدر يرفع: ميث، مالك اساسي، مميز)
                if ([1, 3, 4].includes(targetRankLevel)) canPromote = true;
            } else if (userLevel === 5 || userLevel === 4) { // اكسترا أو ميث (يقدر يرفع: مالك اساسي، مالك، مميز)
                if ([1, 2, 3].includes(targetRankLevel)) canPromote = true;
            } else if (userLevel === 3) { // مالك اساسي (يقدر يرفع: المميز والمالك فقط)
                if ([1, 2].includes(targetRankLevel)) canPromote = true;
            }

            if (!canPromote && userLevel > 0 && targetRankLevel >= userLevel) {
                return ctx.reply('• لا يمكنك رفع شخص لرتبة مساوية أو أعلى منك أو لا توجد صلاحية ❌', { reply_to_message_id: ctx.message.message_id });
            }
            if (!canPromote && userLevel === 0) {
                return ctx.reply('• هذا الأمر مخصص للمشرفين والرتب العليا فقط ❌', { reply_to_message_id: ctx.message.message_id });
            }

            if (requestedRank) {
                if (!db.roles[chatId]) db.roles[chatId] = {};
                db.roles[chatId][targetId] = requestedRank;
                saveData();
                return ctx.reply(`• المستخدم ↦ ${targetMention}\n• تم رفعه رتبة: [ ${requestedRank} ] ✓`, { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }
        }

    } catch (e) {
        console.error("Error:", e);
    }
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
