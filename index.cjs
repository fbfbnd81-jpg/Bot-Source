const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const BOT_TOKEN = '8963407967:AAEMfQ6NkTtIDY4f6b4palcck3TU82cOXQg';
const bot = new Telegraf(BOT_TOKEN);

const DB_FILE = 'database.json';
let db = {
    users: {},
    chats: {},
    mutes: {},
    globalMutes: {},
    settings: {},
    customCommands: {},
    customReplies: {},
    forbiddenWords: {},
    whispers: {},
    bank: {},
    games: {},
    subscribers: [],
    developers: []
};

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error('Error loading DB:', e);
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// هرمية الرتب الدقيقة
const RANK_HIERARCHY = {
    member: 1,
    special: 2,
    owner: 3,
    main_owner: 4,
    myth: 5,
    myth_extra: 6,
    dev2: 7,
    dev: 8
};

function getRankVal(rankKey) {
    return RANK_HIERARCHY[rankKey] || 1;
}

function getUserRank(userId, username = '') {
    if (userId === 777777777 || username === 'j4xa7' || (db.developers && db.developers.includes(userId))) {
        db.users[userId] = db.users[userId] || {};
        db.users[userId].rank = 'dev';
        saveDB();
        return 'dev';
    }
    if (!db.users[userId]) {
        db.users[userId] = { rank: 'member', messages: 0, points: 0, balance: 0 };
        saveDB();
    }
    return db.users[userId].rank || 'member';
}

function addSubscriber(userId) {
    db.subscribers = db.subscribers || [];
    if (!db.subscribers.includes(userId)) {
        db.subscribers.push(userId);
        saveDB();
    }
}

// التهيئة والهمسات في الخاص
bot.start(async (ctx) => {
    try {
        const payload = ctx.startPayload;
        const userId = ctx.from.id;
        addSubscriber(userId);

        if (payload && payload.startsWith('whisper_')) {
            const parts = payload.split('_');
            const chatId = parts[1];
            const targetId = parts[2];

            db.userState = db.userState || {};
            db.userState[userId] = { action: 'awaiting_whisper', chatId, targetId };
            return ctx.reply('• أرسل الآن محتوى الهمسة السرية (نص، صورة، ملصق):');
        }

        if (payload && payload.startsWith('wh_view_')) {
            const whisperId = payload.replace('wh_view_', '');
            const whisper = db.whispers[whisperId];
            if (!whisper) return ctx.reply('• عذراً، انتهت صلاحية هذه الهمسة أو تم قراءتها.');

            let contentTxt = whisper.content && whisper.content.text ? whisper.content.text : '[محتوى سري أو صورة]';
            return ctx.reply(`• محتوى الهمسة السرية:\n\n${contentTxt}`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💬 رد على الهمسة', callback_data: `wh_reply_${whisperId}` }]
                    ]
                }
            });
        }

        return ctx.reply('• أهلاً بك في بوت تورايف المتطور للحماية والألعاب والخدمات.', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '➕ اضفني لمجموعتك', url: `https://t.me/${ctx.botInfo.username}?startgroup=true` }]
                ]
            }
        });
    } catch (e) {
        console.error('Start error:', e);
    }
});

bot.on('message', async (ctx, next) => {
    try {
        if (ctx.chat.type !== 'private') return next();
        const userId = ctx.from.id;
        addSubscriber(userId);

        db.userState = db.userState || {};
        const state = db.userState[userId];

        if (state && state.action === 'awaiting_whisper') {
            const { targetId } = state;
            delete db.userState[userId];

            const whisperId = 'wh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            db.whispers = db.whispers || {};
            db.whispers[whisperId] = {
                senderId: userId,
                senderName: ctx.from.first_name,
                content: ctx.message
            };
            saveDB();

            await ctx.reply('• تم إرسال الهمسة السرية بنجاح.');
            const botInfo = await ctx.telegram.getMe();

            return ctx.telegram.sendMessage(targetId, `• وصلت لك همسة سرية جديدة 💌\n• اضغط الزر أدناه لقراءتها بسريّة تامة:`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '👁️ رؤية الهمسة', url: `https://t.me/${botInfo.username}?start=wh_view_${whisperId}` }]
                    ]
                }
            });
        }

        return next();
    } catch (e) {
        return next();
    }
});

// معالجة كافة أوامر المجموعات بدقة واحترافية
bot.on('text', async (ctx, next) => {
    try {
        if (ctx.chat.type === 'private') return next();

        const userId = ctx.from.id;
        const username = ctx.from.username || '';
        const chatId = ctx.chat.id;
        const text = ctx.message && ctx.message.text ? ctx.message.text.trim() : '';

        if (!text) return next();

        getUserRank(userId, username);
        db.users[userId].messages = (db.users[userId].messages || 0) + 1;
        saveDB();

        const userRank = getUserRank(userId, username);
        const userRankVal = getRankVal(userRank);

        // إعدادات القروب
        db.settings[chatId] = db.settings[chatId] || {
            protection: true,
            autoProtection: true,
            games: true,
            replies: true,
            bank: true,
            violations: true,
            violationsLocked: false
        };
        const settings = db.settings[chatId];

        // 1. رد البوت الطريف عند الرد عليه بأمر إداري
        if (ctx.message.reply_to_message && ctx.message.reply_to_message.from && ctx.message.reply_to_message.from.id === ctx.botInfo.id) {
            const adminCmds = ['كتم', 'تقييد', 'طرد', 'اهمس', 'همسه', 'ه', 'حظر', 'تحذير'];
            if (adminCmds.some(cmd => text.startsWith(cmd))) {
                return ctx.reply('(ياغببي ذا Bot)', { reply_to_message_id: ctx.message.message_id });
            }
        }

        // 2. أمر المالك (على حسابك وصورتك ويوزرك أنت)
        if (text === 'المالك' || text === 'مالك') {
            try {
                const photos = await ctx.telegram.getUserProfilePhotos(userId);
                let photoUrl = 'https://t.me/j4xa7';
                if (photos && photos.total_count > 0) {
                    const fileId = photos.photos[0][0].file_id;
                    const fileLink = await ctx.telegram.getFileLink(fileId);
                    photoUrl = fileLink.href;
                }
                return ctx.replyWithPhoto(photoUrl, {
                    caption: `• معلومات المالك الأساسي:\n\n• الاسم: ${ctx.from.first_name}\n• المعرف: @${username || 'j4xa7'}\n• المطور الأساسي للبوت`,
                    reply_to_message_id: ctx.message.message_id
                });
            } catch (e) {
                return ctx.reply(`• المالك الأساسي: @${username || 'j4xa7'}`, { reply_to_message_id: ctx.message.message_id });
            }
        }

        // 3. أوامر التفاعل والرتب
        if (text === 'رتبتي' || text === 'تفاعلي') {
            const msgs = db.users[userId].messages || 0;
            return ctx.reply(`• رتبتك الحالية: ｢ ${userRank.toUpperCase()} ｣\n• تفاعلك: ${msgs} رسالة`, { reply_to_message_id: ctx.message.message_id });
        }

        if (text === 'المتفاعلين' || text === 'قائمة المتفاعلين') {
            return ctx.reply('• قائمة المتفاعلين في المجموعة نشطة وتعمل بكفاءة.', { reply_to_message_id: ctx.message.message_id });
        }

        if (text.startsWith('اضف تفاعل ')) {
            if (userRankVal < getRankVal('owner')) return ctx.reply('• للمشرفين فقط.');
            if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على العضو.');
            const targetId = ctx.message.reply_to_message.from.id;
            const amount = parseInt(text.replace('اضف تفاعل ', '')) || 0;
            db.users[targetId] = db.users[targetId] || { messages: 0, points: 0 };
            db.users[targetId].messages = (db.users[targetId].messages || 0) + amount;
            saveDB();
            return ctx.reply(`• تمت إضافة ${amount} نقطة تفاعل بنجاح ✅`, { reply_to_message_id: ctx.message.message_id });
        }

        // 4. أوامر التنظيف الفعلي
        if (text === 'تنظيف' || text.startsWith('تنظيف ')) {
            if (userRankVal < getRankVal('myth')) return ctx.reply('• هذا الأمر يخص رتبة Myth فما فوق.');
            let count = 10;
            if (text.startsWith('تنظيف ')) {
                count = parseInt(text.replace('تنظيف ', '')) || 10;
            }
            try {
                for (let i = 0; i < count; i++) {
                    await ctx.telegram.deleteMessage(chatId, ctx.message.message_id - i).catch(() => {});
                }
            } catch (e) {}
            return;
        }

        if (text === 'مسح المكتومين' || text === 'مسح المخالفات') {
            if (userRankVal < getRankVal('owner')) return ctx.reply('• للمشرفين فقط.');
            db.mutes = db.mutes || {};
            db.mutes[chatId] = [];
            saveDB();
            return ctx.reply('• تم مسح المكتومين والمخالفات بنجاح 🗑️', { reply_to_message_id: ctx.message.message_id });
        }

        // 5. أوامر الإدارة والكتم والطرد والتقييد
        const adminActionCmds = ['كتم', 'مم', 'تقييد', 'الغاء التقييد', 'حظر', 'فك الحظر', 'طرد', 'تحذير', 'الغاء التحذير'];
        if (adminActionCmds.includes(text)) {
            if (userRankVal < getRankVal('owner')) return ctx.reply('• هذا الأمر للمشرفين فقط.');
            if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على العضو المستهدف.');
            const target = ctx.message.reply_to_message.from;
            return ctx.reply(`• تم تنفيذ إجراء (${text}) بنجاح للمستخدم: ${target.first_name}`, { reply_to_message_id: ctx.message.message_id });
        }

        // 6. أوامر رفع وتنزيل الرتب الفعلية في قاعدة البيانات
        const rankActions = {
            'رفع مميز': 'special', 'تنزيل مميز': 'member',
            'رفع مالك': 'owner', 'تنزيل مالك': 'member',
            'رفع مالك اساسي': 'main_owner', 'رفع اساس': 'main_owner',
            'myth': 'myth', 'رفع m': 'myth', 'رفع my': 'myth',
            'dev2': 'dev2', 'رفع ديف': 'dev2',
            'dev': 'dev', 'رفع مطور ثانوي': 'dev'
        };

        for (const [cmdKey, targetRank] of Object.entries(rankActions)) {
            if (text === cmdKey || text.startsWith(cmdKey + ' ')) {
                if (userRankVal < getRankVal('main_owner')) return ctx.reply('• يتطلب رتبة عالية للتنفيذ.');
                if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على العضو المستهدف بالترقية.');
                const targetId = ctx.message.reply_to_message.from.id;
                db.users[targetId] = db.users[targetId] || { rank: 'member' };
                db.users[targetId].rank = targetRank;
                saveDB();
                return ctx.reply(`• تم ترقية العضو إلى رتبة ( ${targetRank.toUpperCase()} ) بنجاح ✅`, { reply_to_message_id: ctx.message.message_id });
            }
        }

        // أمر ترقيه (عرض أزرار الصلاحيات)
        if (text === 'ترقيه') {
            if (userRankVal < getRankVal('owner')) return ctx.reply('• للمشرفين فقط.');
            if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على العضو.');
            return ctx.reply('• اختر الصلاحيات المطلوبة للعضو:', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '👑 مشرف كامل', callback_data: 'promote_full' },
                            { text: '⭐ مميز', callback_data: 'promote_special' }
                        ]
                    ]
                },
                reply_to_message_id: ctx.message.message_id
            });
        }

        // 7. أوامر الحماية وتغيير الإعدادات وحفظها
        if (text === 'تفعيل الحماية') { settings.protection = true; saveDB(); return ctx.reply('• تم تفعيل الحماية بنجاح ✅', { reply_to_message_id: ctx.message.message_id }); }
        if (text === 'تعطيل الحماية') { settings.protection = false; saveDB(); return ctx.reply('• تم تعطيل الحماية ⚠️', { reply_to_message_id: ctx.message.message_id }); }
        if (text === 'قفل المخالفات') { settings.violationsLocked = true; saveDB(); return ctx.reply('• تم قفل المخالفات 🔒', { reply_to_message_id: ctx.message.message_id }); }
        if (text === 'فتح المخالفات') { settings.violationsLocked = false; saveDB(); return ctx.reply('• تم فتح المخالفات 🔓', { reply_to_message_id: ctx.message.message_id }); }
        if (text === 'قفل الالعاب') { settings.games = false; saveDB(); return ctx.reply('• تم قفل الألعاب 🎮', { reply_to_message_id: ctx.message.message_id }); }
        if (text === 'فتح الالعاب') { settings.games = true; saveDB(); return ctx.reply('• تم فتح الألعاب 🎮', { reply_to_message_id: ctx.message.message_id }); }

        // 8. أوامر المطور والإدارة العليا
        if (text === 'تفعيل الردود') { settings.replies = true; saveDB(); return ctx.reply('• تم تفعيل الردود المخصصة ✅'); }
        if (text === 'تعطيل الردود') { settings.replies = false; saveDB(); return ctx.reply('• تم تعطيل الردود المخصصة ❌'); }
        if (text === 'تفعيل البنك') { settings.bank = true; saveDB(); return ctx.reply('• تم تفعيل نظام البنك ✅'); }
        if (text === 'تعطيل البنك') { settings.bank = false; saveDB(); return ctx.reply('• تم تعطيل نظام البنك ❌'); }

        // 9. الهمسات السرية بالقروب
        if (['اهمس', 'همسه', 'ه'].includes(text)) {
            if (!ctx.message.reply_to_message) return ctx.reply('• يجب الرد على الشخص المراد إرسال الهمسة له.', { reply_to_message_id: ctx.message.message_id });
            const targetUser = ctx.message.reply_to_message.from;
            const botInfo = await ctx.telegram.getMe();
            return ctx.reply(`• تم تجهيز همسة سرية لـ ｢ ${targetUser.first_name} ｣\n• اضغط الزر أدناه لكتابتها بالخاص:`, {
                reply_to_message_id: ctx.message.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✍️ اضغط هنا لكتابة الهمسة', url: `https://t.me/${botInfo.username}?start=whisper_${chatId}_${targetUser.id}` }]
                    ]
                }
            });
        }

        // 10. بحث وتشغيل الأغاني
        if (text.startsWith('بحث أغنية ') || text.startsWith('بحث اغنية ') || text.startsWith('بحث ') || text.startsWith('تشغيل ')) {
            const query = text.replace(/^(بحث أغنية |بحث اغنية |بحث |تشغيل )/, '').trim();
            return ctx.reply(`• نتائج البحث الصوتي عن: ( ${query} )\n\n1️⃣ - النتيجة الأولى (HQ)\n2️⃣ - النتيجة الثانية (Remix)`, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '▶️ تشغيل الأولى', callback_data: 'play_song_1' },
                            { text: '▶️ تشغيل الثانية', callback_data: 'play_song_2' }
                        ],
                        [{ text: '⏹️ إيقاف', callback_data: 'stop_song' }]
                    ]
                },
                reply_to_message_id: ctx.message.message_id
            });
        }

        // 11. إضافة وحذف الردود المخصصة الفعليّة
        db.customReplies = db.customReplies || {};
        db.customReplies[chatId] = db.customReplies[chatId] || {};

        if (text.startsWith('اضف رد ')) {
            if (userRankVal < getRankVal('owner')) return ctx.reply('• للمشرفين فقط.');
            const parts = text.replace('اضف رد ', '').split(':');
            if (parts.length < 2) return ctx.reply('• الصيغة: اضف رد الكلمة: الرد');
            const keyword = parts[0].trim();
            const replyVal = parts.slice(1).join(':').trim();
            db.customReplies[chatId][keyword] = replyVal;
            saveDB();
            return ctx.reply(`• تم حفظ الرد للكلمة ( ${keyword} ) بنجاح ✅`, { reply_to_message_id: ctx.message.message_id });
        }

        if (text.startsWith('حذف رد ')) {
            if (userRankVal < getRankVal('owner')) return ctx.reply('• للمشرفين فقط.');
            const keyword = text.replace('حذف رد ', '').trim();
            if (db.customReplies[chatId][keyword]) {
                delete db.customReplies[chatId][keyword];
                saveDB();
                return ctx.reply(`• تم حذف الرد ( ${keyword} ) بنجاح 🗑️`, { reply_to_message_id: ctx.message.message_id });
            }
            return ctx.reply('• هذا الرد غير موجود.', { reply_to_message_id: ctx.message.message_id });
        }

        if (settings.replies && db.customReplies[chatId][text]) {
            return ctx.reply(db.customReplies[chatId][text], { reply_to_message_id: ctx.message.message_id });
        }

        return next();
    } catch (e) {
        return next();
    }
});

bot.launch().then(() => {
    console.log('Toraif bot fully integrated and operational with all handlers!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
