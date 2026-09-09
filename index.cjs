const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {8963407967:AAEMfQ6NkTtIDY4f6b4palcck3TU82cOXQg
    throw new Error('BOT_TOKEN غير موجود في Replit Secrets');
}

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
    developers: [],
    userState: {}
};

function loadDB() {
    if (!fs.existsSync(DB_FILE)) return;

    try {
        const saved = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

        db = {
            ...db,
            ...saved,
            users: saved.users || {},
            chats: saved.chats || {},
            mutes: saved.mutes || {},
            globalMutes: saved.globalMutes || {},
            settings: saved.settings || {},
            customCommands: saved.customCommands || {},
            customReplies: saved.customReplies || {},
            forbiddenWords: saved.forbiddenWords || {},
            whispers: saved.whispers || {},
            bank: saved.bank || {},
            games: saved.games || {},
            subscribers: saved.subscribers || [],
            developers: saved.developers || [],
            userState: saved.userState || {}
        };
    } catch (error) {
        console.error('خطأ في تحميل قاعدة البيانات:', error);
    }
}

loadDB();

function saveDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (error) {
        console.error('خطأ في حفظ قاعدة البيانات:', error);
    }
}

/* =========================================================
   الرتب
========================================================= */

const RANK_HIERARCHY = {
    member: 0,
    special: 1,
    owner: 2,
    main_owner: 3,
    myth: 4,
    myth_extra: 5,
    dev2: 6,
    dev: 7
};

const RANK_NAMES = {
    member: 'عضو',
    special: 'مميز',
    owner: 'مالك',
    main_owner: 'مالك أساسي',
    myth: 'Myth',
    myth_extra: 'Myth🎖️',
    dev2: 'Dev²🎖️',
    dev: 'Dev🎖️'
};

function getRankVal(rank) {
    return RANK_HIERARCHY[rank] ?? 0;
}

function getRankName(rank) {
    return RANK_NAMES[rank] || 'عضو';
}

function ensureUser(userId) {
    if (!db.users[userId]) {
        db.users[userId] = {
            id: userId,
            username: '',
            name: '',
            rank: 'member',
            messages: 0,
            points: 0,
            balance: 0
        };
    }

    return db.users[userId];
}

function ensureChat(chatId) {
    if (!db.chats[chatId]) {
        db.chats[chatId] = {
            id: chatId,
            users: {},
            messages: 0
        };
    }

    if (!db.settings[chatId]) {
        db.settings[chatId] = {
            protection: true,
            autoProtection: true,
            violations: true,
            violationsLocked: false,
            games: true,
            replies: true,
            bank: true,

            preventLinks: true,
            preventEdits: true,
            preventRepeats: true,
            preventAds: true,
            preventMentions: true,
            preventForwards: true,

            autoWarnings: true,
            autoMute: true,
            autoBan: false,

            warningLimit: 3,

            lockChat: false,
            lockMedia: false,
            lockLinks: false,
            lockPhotos: false,
            lockVideos: false,
            lockFiles: false,
            lockStickers: false,
            lockGif: false,
            lockAudio: false,
            lockForward: false,
            lockMentions: false,

            allMention: true
        };
    }

    return db.chats[chatId];
}

function getChatUser(chatId, userId) {
    ensureChat(chatId);

    if (!db.chats[chatId].users[userId]) {
        db.chats[chatId].users[userId] = {
            id: userId,
            rank: 'member',
            messages: 0,
            points: 0,
            warnings: 0
        };
    }

    return db.chats[chatId].users[userId];
}

function getUserRank(userId, chatId = null) {
    const user = ensureUser(userId);

    /*
      Dev🎖️ و Dev²🎖️ عالميين.
      باقي الرتب خاصة بالقروب.
    */

    if (user.rank === 'dev') return 'dev';
    if (user.rank === 'dev2') return 'dev2';

    if (chatId !== null) {
        return getChatUser(chatId, userId).rank || 'member';
    }

    return user.rank || 'member';
}

function setChatRank(chatId, userId, rank) {
    const member = getChatUser(chatId, userId);
    member.rank = rank;
    saveDB();
}

function setGlobalRank(userId, rank) {
    const user = ensureUser(userId);
    user.rank = rank;
    saveDB();
}

function hasRank(userId, chatId, requiredRank) {
    return getRankVal(getUserRank(userId, chatId)) >= getRankVal(requiredRank);
}

function requiredRank(requiredRank) {
    return `• هذا الامر يخص ↤ ｢ ${getRankName(requiredRank)} ｣`;
}

function isDev(userId) {
    return getRankVal(getUserRank(userId)) >= 6;
}

function isDevMain(userId) {
    return getRankVal(getUserRank(userId)) >= 7;
}

/* =========================================================
   معلومات المستخدم
========================================================= */

function updateUserData(ctx) {
    const userId = ctx.from.id;
    const user = ensureUser(userId);

    user.username = ctx.from.username || '';
    user.name = ctx.from.first_name || '';

    if (ctx.chat && ctx.chat.type !== 'private') {
        const chatUser = getChatUser(ctx.chat.id, userId);

        chatUser.username = ctx.from.username || '';
        chatUser.name = ctx.from.first_name || '';

        chatUser.messages++;
        chatUser.points++;

        db.chats[ctx.chat.id].messages++;
    }

    user.messages++;

    saveDB();
}

/* =========================================================
   المشتركين
========================================================= */

function addSubscriber(userId) {
    db.subscribers = db.subscribers || [];

    if (!db.subscribers.includes(userId)) {
        db.subscribers.push(userId);
        saveDB();
    }
}

/* =========================================================
   الحماية من معاقبة رتبة أعلى
========================================================= */

function canPunish(executorId, targetId, chatId) {
    const executorRank = getUserRank(executorId, chatId);
    const targetRank = getUserRank(targetId, chatId);

    return getRankVal(executorRank) > getRankVal(targetRank);
}

function canChangeRank(executorId, targetId, chatId, newRank) {
    const executorRank = getUserRank(executorId, chatId);
    const targetRank = getUserRank(targetId, chatId);

    const executorValue = getRankVal(executorRank);
    const targetValue = getRankVal(targetRank);
    const newValue = getRankVal(newRank);

    if (executorId === targetId) return false;

    if (targetValue >= executorValue) return false;

    if (newValue >= executorValue) return false;

    return true;
}

/* =========================================================
   منشن
========================================================= */

function mentionUser(user) {
    if (!user) return 'العضو';

    const name = user.first_name || user.username || 'العضو';

    return `<a href="tg://user?id=${user.id}">${escapeHtml(name)}</a>`;
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* =========================================================
   إعدادات الحماية
========================================================= */

const protectionCommands = {
    'تفعيل منع الروابط': ['preventLinks', true],
    'تعطيل منع الروابط': ['preventLinks', false],

    'تفعيل منع التعديل': ['preventEdits', true],
    'تعطيل منع التعديل': ['preventEdits', false],

    'تفعيل منع التكرار': ['preventRepeats', true],
    'تعطيل منع التكرار': ['preventRepeats', false],

    'تفعيل منع الإعلانات': ['preventAds', true],
    'تعطيل منع الإعلانات': ['preventAds', false],

    'تفعيل منع المنشن': ['preventMentions', true],
    'تعطيل منع المنشن': ['preventMentions', false],

    'تفعيل منع الفوروارد': ['preventForwards', true],
    'تعطيل منع الفوروارد': ['preventForwards', false],

    'تفعيل الإنذارات': ['autoWarnings', true],
    'تعطيل الإنذارات': ['autoWarnings', false],

    'تفعيل الكتم التلقائي': ['autoMute', true],
    'تعطيل الكتم التلقائي': ['autoMute', false],

    'تفعيل الحظر التلقائي': ['autoBan', true],
    'تعطيل الحظر التلقائي': ['autoBan', false]
};

/* =========================================================
   أوامر الحماية
========================================================= */

async function executeProtectionCommand(ctx, text) {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;

    ensureChat(chatId);

    if (!hasRank(userId, chatId, 'owner')) {
        await ctx.reply(requiredRank('مالك'));
        return true;
    }

    const settings = db.settings[chatId];

    if (text === 'تفعيل الحماية') {
        settings.protection = true;
        saveDB();
        await ctx.reply('• تم تفعيل الحماية.');
        return true;
    }

    if (text === 'تعطيل الحماية') {
        settings.protection = false;
        saveDB();
        await ctx.reply('• تم تعطيل الحماية.');
        return true;
    }

    if (text === 'قفل الحماية') {
        settings.protection = false;
        saveDB();
        await ctx.reply('• تم قفل الحماية.');
        return true;
    }

    if (text === 'فتح الحماية') {
        settings.protection = true;
        saveDB();
        await ctx.reply('• تم فتح الحماية.');
        return true;
    }

    if (text === 'حالة الحماية') {
        await ctx.reply(
            `• حالة الحماية: ${settings.protection ? 'مفتوحة' : 'مقفلة'}\n` +
            `• الحماية التلقائية: ${settings.autoProtection ? 'مفعلة' : 'معطلة'}\n` +
            `• المخالفات: ${settings.violations ? 'مفعلة' : 'معطلة'}`
        );
        return true;
    }

    if (text === 'تفعيل الحماية التلقائية') {
        settings.autoProtection = true;
        saveDB();
        await ctx.reply('• تم تفعيل الحماية التلقائية.');
        return true;
    }

    if (text === 'تعطيل الحماية التلقائية') {
        settings.autoProtection = false;
        saveDB();
        await ctx.reply('• تم تعطيل الحماية التلقائية.');
        return true;
    }

    if (text === 'فتح المخالفات') {
        settings.violationsLocked = false;
        settings.violations = true;
        saveDB();
        await ctx.reply('• تم فتح المخالفات.');
        return true;
    }

    if (text === 'قفل المخالفات') {
        settings.violationsLocked = true;
        settings.violations = false;
        saveDB();
        await ctx.reply('• تم قفل المخالفات.');
        return true;
    }

    if (protectionCommands[text]) {
        const [key, value] = protectionCommands[text];

        settings[key] = value;

        saveDB();

        await ctx.reply(
            value
                ? `• تم تفعيل ${key}.`
                : `• تم تعطيل ${key}.`
        );

        return true;
    }

    return false;
}

/* =========================================================
   الإدارة الفعلية
========================================================= */

async function executeAdminAction(ctx, action) {
    const chatId = ctx.chat.id;
    const executorId = ctx.from.id;

    if (!hasRank(executorId, chatId, 'owner')) {
        await ctx.reply(requiredRank('مالك'));
        return;
    }

    const reply = ctx.message.reply_to_message;

    if (!reply || !reply.from) {
        await ctx.reply('• يجب الرد على العضو المستهدف.');
        return;
    }

    const targetId = reply.from.id;

    if (targetId === ctx.botInfo.id) {
        await ctx.reply('(ياغببي ذا Bot)');
        return;
    }

    if (!canPunish(executorId, targetId, chatId)) {
        await ctx.reply('• لا يمكنك تنفيذ الأمر على رتبة مساوية أو أعلى منك.');
        return;
    }

    try {
        if (action === 'كتم') {
            await ctx.telegram.restrictChatMember(chatId, targetId, {
                permissions: {
                    can_send_messages: false
                }
            });

            db.mutes[chatId] = db.mutes[chatId] || {};
            db.mutes[chatId][targetId] = true;

            saveDB();

            await ctx.reply('• تم كتم العضو.');
            return;
        }

        if (action === 'فك كتم') {
            await ctx.telegram.restrictChatMember(chatId, targetId, {
                permissions: {
                    can_send_messages: true,
                    can_send_audios: true,
                    can_send_documents: true,
                    can_send_photos: true,
                    can_send_videos: true,
                    can_send_video_notes: true,
                    can_send_voice_notes: true,
                    can_send_polls: true,
                    can_send_other_messages: true,
                    can_add_web_page_previews: true
                }
            });

            if (db.mutes[chatId]) {
                delete db.mutes[chatId][targetId];
            }

            saveDB();

            await ctx.reply('• تم فك الكتم.');
            return;
        }

        if (action === 'كتم عام') {
            await ctx.telegram.restrictChatMember(chatId, targetId, {
                permissions: {
                    can_send_messages: false
                }
            });

            db.globalMutes[chatId] = db.globalMutes[chatId] || {};
            db.globalMutes[chatId][targetId] = true;

            saveDB();

            await ctx.reply('• تم الكتم العام.');
            return;
        }

        if (action === 'فك الكتم العام') {
            if (db.globalMutes[chatId]) {
                delete db.globalMutes[chatId][targetId];
            }

            await ctx.telegram.restrictChatMember(chatId, targetId, {
                permissions: {
                    can_send_messages: true,
                    can_send_audios: true,
                    can_send_documents: true,
                    can_send_photos: true,
                    can_send_videos: true,
                    can_send_video_notes: true,
                    can_send_voice_notes: true,
                    can_send_polls: true,
                    can_send_other_messages: true,
                    can_add_web_page_previews: true
                }
            });

            saveDB();

            await ctx.reply('• تم فك الكتم العام.');
            return;
        }

        if (action === 'تقييد') {
            await ctx.telegram.restrictChatMember(chatId, targetId, {
                permissions: {
                    can_send_messages: false,
                    can_send_audios: false,
                    can_send_documents: false,
                    can_send_photos: false,
                    can_send_videos: false,
                    can_send_video_notes: false,
                    can_send_voice_notes: false,
                    can_send_polls: false,
                    can_send_other_messages: false,
                    can_add_web_page_previews: false
                }
            });

            await ctx.reply('• تم تقييد العضو.');
            return;
        }

        if (action === 'الغاء التقييد') {
            await ctx.telegram.restrictChatMember(chatId, targetId, {
                permissions: {
                    can_send_messages: true,
                    can_send_audios: true,
                    can_send_documents: true,
                    can_send_photos: true,
                    can_send_videos: true,
                    can_send_video_notes: true,
                    can_send_voice_notes: true,
                    can_send_polls: true,
                    can_send_other_messages: true,
                    can_add_web_page_previews: true
                }
            });

            await ctx.reply('• تم إلغاء التقييد.');
            return;
        }

        if (action === 'حظر') {
            await ctx.telegram.banChatMember(chatId, targetId);

            await ctx.reply('• تم حظر العضو.');
            return;
        }

        if (action === 'فك الحظر') {
            await ctx.telegram.unbanChatMember(chatId, targetId, {
                only_if_banned: true
            });

            await ctx.reply('• تم فك الحظر.');
            return;
        }

        if (action === 'طرد') {
            await ctx.telegram.banChatMember(chatId, targetId);
            await ctx.telegram.unbanChatMember(chatId, targetId);

            await ctx.reply('• تم طرد العضو.');
            return;
        }

        if (action === 'تحذير') {
            const member = getChatUser(chatId, targetId);

            member.warnings = (member.warnings || 0) + 1;

            saveDB();

            await ctx.reply(`• تم تحذير العضو.\n• عدد التحذيرات: ${member.warnings}`);

            if (member.warnings >= 3 && db.settings[chatId].autoMute) {
                await ctx.telegram.restrictChatMember(chatId, targetId, {
                    permissions: {
                        can_send_messages: false
                    }
                }).catch(() => {});

                db.mutes[chatId] = db.mutes[chatId] || {};
                db.mutes[chatId][targetId] = true;

                saveDB();

                await ctx.reply('• وصل العضو إلى الحد المسموح من التحذيرات وتم كتمه تلقائيًا.');
            }

            return;
        }

        if (action === 'الغاء التحذير') {
            const member = getChatUser(chatId, targetId);

            member.warnings = 0;

            saveDB();

            await ctx.reply('• تم إلغاء تحذيرات العضو.');
            return;
        }
    } catch (error) {
        console.error('Admin action error:', error);

        await ctx.reply(
            '• تعذر تنفيذ الأمر. تأكد أن البوت يملك صلاحيات الإدارة المطلوبة.'
        );
    }
}

/* =========================================================
   التنظيف
========================================================= */

function getCleanType(text) {
    if (text === 'تنظيف') return 9;

    const match = text.match(/^تنظيف\s+(\d+)$/);

    if (!match) return null;

    return Number(match[1]);
}

function messageMatchesCleanType(message, type) {
    if (!message) return false;

    if (type === 0) {
        return !!message.text;
    }

    if (type === 1) {
        return !!message.photo;
    }

    if (type === 2) {
        return !!message.video;
    }

    if (type === 3) {
        return !!message.document;
    }

    if (type === 4) {
        return !!message.sticker;
    }

    if (type === 5) {
        return !!message.animation;
    }

    if (type === 6) {
        return !!message.audio;
    }

    if (type === 7) {
        return !!message.voice;
    }

    if (type === 8) {
        const text = message.text || message.caption || '';
        return /(https?:\/\/|t\.me\/|www\.)/i.test(text);
    }

    if (type === 9) {
        return true;
    }

    return false;
}

/* =========================================================
   القائمة
========================================================= */

function mainMenu() {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('المطور', 'menu_dev'),
            Markup.button.callback('الرتب', 'menu_ranks')
        ],
        [
            Markup.button.callback('الحماية', 'menu_protection'),
            Markup.button.callback('التفاعل والألعاب والفعاليات', 'menu_games')
        ],
        [
            Markup.button.callback('الهمسات والأغاني', 'menu_music'),
            Markup.button.callback('الأوامر المخصصة', 'menu_custom')
        ],
        [
            Markup.button.callback('القروب', 'menu_group')
        ]
    ]);
}

function backButton() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('رجوع', 'menu_main')]
    ]);
}

function menuText(section) {
    const menus = {
        dev:
`قسم المطور

تفعيل الردود
تعطيل الردود
تفعيل البنك
تعطيل البنك
تفعيل التواصل
تعطيل التواصل
تفعيل الاشتراك الاجباري
تعطيل الاشتراك الاجباري
تغيير الاشتراك الاجباري
تفعيل بوت الخدمة
تعطيل بوت الخدمة
تفعيل الاحصائيات
تعطيل الاحصائيات
تفعيل الزاجل
تعطيل الزاجل
تفعيل التنسيقات
تعطيل التنسيقات

رفع مطور ثانوي
تنزيل مطور ثانوي
رفع ديف
تنزيل ديف
رفع MY
تنزيل MY
رفع M
تنزيل M
رفع مالك اساسي
تنزيل مالك اساسي
قائمة المطورين
مسح المطورين`,

        ranks:
`قسم الرتب

مميز
مالك
مالك اساسي
Myth
Myth🎖️
Dev²🎖️
Dev🎖️

رتبتي
رتبته`,

        protection:
`قسم الحماية

قفل الحماية
فتح الحماية
حالة الحماية
تفعيل الحماية
تعطيل الحماية
تفعيل الحماية التلقائية
تعطيل الحماية التلقائية

تفعيل منع الروابط
تعطيل منع الروابط
تفعيل منع التعديل
تعطيل منع التعديل
تفعيل منع التكرار
تعطيل منع التكرار
تفعيل منع الإعلانات
تعطيل منع الإعلانات
تفعيل منع المنشن
تعطيل منع المنشن
تفعيل منع الفوروارد
تعطيل منع الفوروارد

كتم
فك كتم
كتم عام
فك الكتم العام
تقييد
الغاء التقييد
حظر
فك الحظر
طرد
تحذير
الغاء التحذير

تنظيف
تنظيف 10
مسح المخالفات`,

        games:
`قسم التفاعل والألعاب والفعاليات

تفاعلي
المتفاعلين
رتبتي
رتبته
تفاعله
اضف تفاعل

قفل الالعاب
فتح الالعاب

صور
كلمة
ترتيب
مقال
جملة
حروف
خمن
لغز
صح أو خطأ
أكمل
مقلوب
فكك
إيموجي
سرعة
حساب
ذاكرة
من أنا
كلمة السر

فعالية
ابدأ فعالية
فعالية + اسم الفعالية

احكام
انهاء احكام`,

        music:
`قسم الهمسات والأغاني

اهمس
همسه
ه

بحث أغنية + اسم الأغنية
تشغيل + اسم الأغنية
إيقاف
استئناف
تخطي
إلغاء
الأغنية
قائمة التشغيل
مسح القائمة`,

        custom:
`قسم الأوامر المخصصة

اضف امر
حذف امر
اوامري
اضف رد
حذف رد
ردودي`,

        group:
`قسم القروب

قروب
القوانين
المالك

ا
ت
ق
م
ن
ح
د`
    };

    return menus[section] || '• القسم غير موجود.';
}

/* =========================================================
   أوامر /start
========================================================= */

bot.start(async (ctx) => {
    try {
        addSubscriber(ctx.from.id);

        const payload = ctx.startPayload || '';

        if (payload.startsWith('whisper_')) {
            const parts = payload.split('_');

            const chatId = parts[1];
            const targetId = parts[2];

            db.userState[ctx.from.id] = {
                action: 'awaiting_whisper',
                chatId,
                targetId
            };

            saveDB();

            return ctx.reply(
                '• أرسل الآن الهمسة\n• يمكنك إرسال نص أو ملصق أو صورة أو قيف\n-'
            );
        }

        return ctx.reply(
            '• أهلًا بك في بوت تورايف.',
            Markup.inlineKeyboard([
                [
                    Markup.button.url(
                        'اضفني لمجموعتك',
                        `https://t.me/${ctx.botInfo.username}?startgroup=true`
                    )
                ]
            ])
        );
    } catch (error) {
        console.error(error);
    }
});

/* =========================================================
   الهمسات في الخاص
========================================================= */

bot.on('message', async (ctx, next) => {
    try {
        if (!ctx.chat || ctx.chat.type !== 'private') {
            return next();
        }

        addSubscriber(ctx.from.id);

        const state = db.userState[ctx.from.id];

        if (!state || state.action !== 'awaiting_whisper') {
            return next();
        }

        delete db.userState[ctx.from.id];

        const whisperId =
            'wh_' +
            Date.now() +
            '_' +
            Math.random().toString(36).slice(2, 8);

        db.whispers[whisperId] = {
            senderId: ctx.from.id,
            senderName: ctx.from.first_name,
            targetId: state.targetId,
            chatId: state.chatId,
            content: ctx.message,
            createdAt: Date.now()
        };

        saveDB();

        await ctx.reply('• تم ارسال الهمسة');

        const sender = {
            id: ctx.from.id,
            first_name: ctx.from.first_name,
            username: ctx.from.username
        };

        const botInfo = await ctx.telegram.getMe();

        const message =
            `• ياحلو ↤ ${mentionUser({
                id: state.targetId,
                first_name: 'المستلم'
            })}\n` +
            `• وصلتك همسة سرية من ↤ ${mentionUser(sender)}\n` +
            `• انت وحدك تقدر تشوفها`;

        await ctx.telegram.sendMessage(
            state.targetId,
            message,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'رؤية الهمسة',
                                url: `https://t.me/${botInfo.username}?start=wh_view_${whisperId}`
                            }
                        ],
                        [
                            {
                                text: 'رد على الهمسة',
                                callback_data: `wh_reply_${whisperId}`
                            }
                        ]
                    ]
                }
            }
        );

        return;
    } catch (error) {
        console.error('Whisper error:', error);
        return next();
    }
});

/* =========================================================
   أزرار الهمسات
========================================================= */

bot.action(/^wh_view_(.+)$/, async (ctx) => {
    try {
        const whisperId = ctx.match[1];
        const whisper = db.whispers[whisperId];

        if (!whisper) {
            return ctx.answerCbQuery('انتهت الهمسة.');
        }

        if (ctx.from.id !== whisper.targetId) {
            return ctx.answerCbQuery('هذه الهمسة ليست لك.');
        }

        await ctx.answerCbQuery();

        const message = whisper.content;

        if (message.text) {
            return ctx.reply(
                `• الهمسة:\n\n${message.text}`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'رد على الهمسة',
                                    callback_data: `wh_reply_${whisperId}`
                                }
                            ]
                        ]
                    }
                }
            );
        }

        if (message.photo) {
            return ctx.replyWithPhoto(
                message.photo[message.photo.length - 1].file_id,
                {
                    caption: '• الهمسة',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'رد على الهمسة',
                                    callback_data: `wh_reply_${whisperId}`
                                }
                            ]
                        ]
                    }
                }
            );
        }

        if (message.sticker) {
            await ctx.replyWithSticker(message.sticker.file_id);

            return ctx.reply('• الهمسة', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'رد على الهمسة',
                                callback_data: `wh_reply_${whisperId}`
                            }
                        ]
                    ]
                }
            });
        }

        if (message.animation) {
            return ctx.replyWithAnimation(
                message.animation.file_id,
                {
                    caption: '• الهمسة',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'رد على الهمسة',
                                    callback_data: `wh_reply_${whisperId}`
                                }
                            ]
                        ]
                    }
                }
            );
        }

        return ctx.reply('• لا يمكن قراءة نوع المحتوى هذا.');
    } catch (error) {
        console.error(error);
    }
});

bot.action(/^wh_reply_(.+)$/, async (ctx) => {
    try {
        const whisperId = ctx.match[1];
        const whisper = db.whispers[whisperId];

        if (!whisper) {
            return ctx.answerCbQuery('انتهت الهمسة.');
        }

        if (ctx.from.id !== whisper.targetId) {
            return ctx.answerCbQuery('هذه الهمسة ليست لك.');
        }

        db.userState[ctx.from.id] = {
            action: 'awaiting_whisper_reply',
            whisperId,
            targetId: whisper.senderId,
            chatId: whisper.chatId
        };

        saveDB();

        await ctx.answerCbQuery();

        return ctx.reply(
            '• أرسل الآن الهمسة\n• يمكنك إرسال نص أو ملصق أو صورة أو قيف\n-'
        );
    } catch (error) {
        console.error(error);
    }
});

/* =========================================================
   الحماية الأساسية للرسائل
========================================================= */

async function runMessageProtection(ctx) {
    if (!ctx.chat || ctx.chat.type === 'private') return false;

    const chatId = ctx.chat.id;
    const userId = ctx.from.id;

    ensureChat(chatId);

    const settings = db.settings[chatId];

    if (!settings.protection || !settings.autoProtection) {
        return false;
    }

    const rank = getUserRank(userId, chatId);

    /*
      أصحاب الرتب المعتمدة لا تحذف الحماية رسائلهم.
    */
    if (getRankVal(rank) >= 1) {
        return false;
    }

    const message = ctx.message;

    const text = message.text || message.caption || '';

    if (
        settings.preventLinks &&
        /(https?:\/\/|www\.|t\.me\/|telegram\.me\/)/i.test(text)
    ) {
        await ctx.deleteMessage().catch(() => {});

        await ctx.reply(
            `${mentionUser(ctx.from)}، ممنوع إرسال الروابط.`,
            { parse_mode: 'HTML' }
        ).catch(() => {});

        return true;
    }

    if (
        settings.preventForwards &&
        message.forward_origin
    ) {
        await ctx.deleteMessage().catch(() => {});

        await ctx.reply(
            `${mentionUser(ctx.from)}، ممنوع إرسال الفوروارد.`,
            { parse_mode: 'HTML' }
        ).catch(() => {});

        return true;
    }

    if (
        settings.preventMentions &&
        text.includes('@')
    ) {
        await ctx.deleteMessage().catch(() => {});

        await ctx.reply(
            `${mentionUser(ctx.from)}، ممنوع إرسال المنشنات.`,
            { parse_mode: 'HTML' }
        ).catch(() => {});

        return true;
    }

    if (
        text.length > 1000
    ) {
        await ctx.deleteMessage().catch(() => {});

        await ctx.reply(
            `${mentionUser(ctx.from)}، ممنوع إرسال الرسائل الطويلة.`,
            { parse_mode: 'HTML' }
        ).catch(() => {});

        return true;
    }

    const forbidden = db.forbiddenWords[chatId] || [];

    const lowerText = text.toLowerCase();

    for (const word of forbidden) {
        if (word && lowerText.includes(String(word).toLowerCase())) {
            await ctx.deleteMessage().catch(() => {});

            await ctx.reply(
                `${mentionUser(ctx.from)}، هذه الكلمة ممنوعة.`,
                { parse_mode: 'HTML' }
            ).catch(() => {});

            return true;
        }
    }

    return false;
}

/* =========================================================
   الرسائل المعدلة
========================================================= */

bot.on('edited_message', async (ctx) => {
    try {
        if (!ctx.chat || ctx.chat.type === 'private') return;

        const chatId = ctx.chat.id;
        const userId = ctx.from.id;

        ensureChat(chatId);

        if (!db.settings[chatId].protection) return;
        if (!db.settings[chat
