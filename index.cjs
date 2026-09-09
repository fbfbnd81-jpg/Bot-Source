const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");

const BOT_TOKEN = process.env.BOT_TOKEN;
const MAIN_OWNER_ID = Number(process.env.MAIN_OWNER_ID || 0);

const DEVELOPERS_IDS = (process.env.DEVELOPERS_IDS || "")
    .split(",")
    .map(x => Number(x.trim()))
    .filter(Boolean);

if (!BOT_TOKEN) {
    console.error("BOT_TOKEN غير موجود في Replit Secrets");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const DB_FILE = "./database.json";

/* =========================================================
   الرتب
========================================================= */

const RANKS = {
    "عضو": 0,
    "مميز": 1,
    "مالك": 2,
    "مالك أساسي": 3,
    "Myth": 4,
    "Myth🎖️": 5,
    "Dev²🎖️": 6,
    "Dev🎖️": 7
};

function rankValue(rank) {
    return RANKS[rank] ?? 0;
}

/* =========================================================
   قاعدة البيانات
========================================================= */

const DEFAULT_DB = {
    users: {},
    chats: {},
    subscribers: [],
    developers: [],
    forbiddenWords: {},
    customCommands: {},
    customReplies: {},
    whispers: {},
    userStates: {},
    broadcasts: {},
    tempPerms: {},
    marriage: {},
    logs: {},
    backups: [],
    channels: {},
    stats: {
        messages: 0,
        groups: 0
    }
};

function deepMerge(target, source) {
    if (!source || typeof source !== "object") return target;

    for (const key of Object.keys(source)) {
        if (
            source[key] &&
            typeof source[key] === "object" &&
            !Array.isArray(source[key])
        ) {
            if (
                !target[key] ||
                typeof target[key] !== "object" ||
                Array.isArray(target[key])
            ) {
                target[key] = {};
            }

            deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }

    return target;
}

let db = JSON.parse(JSON.stringify(DEFAULT_DB));

if (fs.existsSync(DB_FILE)) {
    try {
        const old = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
        db = deepMerge(db, old);
    } catch (err) {
        console.error("تعذر قراءة قاعدة البيانات:", err.message);
    }
}

db.developers = [
    ...new Set([
        ...(db.developers || []),
        ...(MAIN_OWNER_ID ? [MAIN_OWNER_ID] : []),
        ...DEVELOPERS_IDS
    ])
];

function saveDB() {
    try {
        fs.writeFileSync(
            DB_FILE,
            JSON.stringify(db, null, 2),
            "utf8"
        );
    } catch (err) {
        console.error("خطأ حفظ قاعدة البيانات:", err.message);
    }
}

/* =========================================================
   إعدادات القروب
========================================================= */

const DEFAULT_SETTINGS = {
    botEnabled: true,

    protection: true,
    autoProtection: true,
    violationsOpen: true,

    games: true,
    replies: true,
    bank: true,

    mentionOpen: true,

    antiLinks: true,
    antiEdits: true,
    antiSpam: true,
    antiAds: true,
    antiMentions: true,
    antiForwards: true,
    antiCommands: false,
    antiForbiddenWords: true,
    antiLongMessages: false,
    antiPhones: false,
    antiUsernames: false,
    antiEnglish: false,

    antiPhotos: false,
    antiVideos: false,
    antiFiles: false,
    antiStickers: false,
    antiGif: false,
    antiAudio: false,
    antiVoice: false,

    warningsEnabled: true,
    warningLimit: 3,

    autoMute: true,
    autoBan: false,

    muteMinutes: 10,
    restrictMinutes: 10,

    bankName1: "الراجحي",
    bankName2: "الأهلي",
    bankName3: "البنك الثالث",

    memberLimit: 0,

    forcedSubscription: false,
    forcedSubscriptionChannel: "",

    serviceBot: false,
    statistics: true,
    zaajel: false,
    formats: true,

    developerMode: false
};

function getChat(chatId) {
    if (!db.chats[chatId]) {
        db.chats[chatId] = {
            settings: {},
            users: {},
            rules: "",
            activeGame: null,
            ahkam: null,
            music: {
                queue: [],
                current: null
            }
        };
    }

    db.chats[chatId].settings = deepMerge(
        JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
        db.chats[chatId].settings || {}
    );

    return db.chats[chatId];
}

/* =========================================================
   المستخدم
========================================================= */

function getUser(chatId, userId, telegramUser = {}) {
    const chat = getChat(chatId);

    if (!chat.users[userId]) {
        chat.users[userId] = {
            id: userId,
            name: telegramUser.first_name || "",
            username: telegramUser.username || "",

            rank: "عضو",

            messages: 0,
            points: 0,

            balance: 100,

            warnings: 0,

            gamesPlayed: 0,
            gamesWon: 0,
            correctAnswers: 0,

            bestSpeed: null,

            bank: null,
            accountNumber: null,

            transferHistory: [],
            purchases: []
        };
    }

    if (telegramUser.first_name) {
        chat.users[userId].name = telegramUser.first_name;
    }

    if (telegramUser.username !== undefined) {
        chat.users[userId].username =
            telegramUser.username || "";
    }

    return chat.users[userId];
}

function getRank(chatId, userId) {
    if (db.developers.includes(Number(userId))) {
        if (Number(userId) === MAIN_OWNER_ID) {
            return "Dev🎖️";
        }

        return "Dev²🎖️";
    }

    return getUser(chatId, userId).rank || "عضو";
}

function hasRank(chatId, userId, requiredRank) {
    return (
        rankValue(getRank(chatId, userId)) >=
        rankValue(requiredRank)
    );
}

function rankDenied(rank) {
    return `• هذا الامر يخص ↤ ｢ ${rank} ｣`;
}

/* =========================================================
   أدوات
========================================================= */

function escapeHTML(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function mention(user) {
    return `<a href="tg://user?id=${user.id}">${escapeHTML(
        user.first_name || user.username || "العضو"
    )}</a>`;
}

function replyOptions(ctx) {
    return {
        reply_to_message_id:
            ctx.message?.message_id
    };
}

function normalize(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

async function logAction(chatId, text) {
    db.logs[chatId] ||= [];

    db.logs[chatId].push({
        time: Date.now(),
        text
    });

    if (db.logs[chatId].length > 300) {
        db.logs[chatId].shift();
    }

    saveDB();
}

async function isTelegramAdmin(ctx, userId) {
    try {
        const member =
            await ctx.telegram.getChatMember(
                ctx.chat.id,
                userId
            );

        return (
            member.status === "creator" ||
            member.status === "administrator"
        );
    } catch {
        return false;
    }
}

/* =========================================================
   المشتركين
========================================================= */

function addSubscriber(user) {
    const id = Number(user.id);

    if (!db.subscribers.includes(id)) {
        db.subscribers.push(id);
    }

    db.users[id] = {
        ...(db.users[id] || {}),
        id,
        firstName: user.first_name || "",
        username: user.username || ""
    };

    saveDB();
}

/* =========================================================
   الحماية
========================================================= */

function containsLink(text) {
    return /(https?:\/\/|www\.|t\.me\/|telegram\.me\/)/i.test(
        text || ""
    );
}

function containsPhone(text) {
    return /\b05\d{8}\b/.test(text || "");
}

function containsUsername(text) {
    return /@[A-Za-z0-9_]{5,}/.test(text || "");
}

function isEnglishOnly(text) {
    if (!text || !/[A-Za-z]/.test(text)) {
        return false;
    }

    const letters = text.replace(
        /[^A-Za-z\u0600-\u06FF]/g,
        ""
    );

    return (
        letters.length > 0 &&
        !/[\u0600-\u06FF]/.test(letters)
    );
}

function containsAd(text) {
    return /(اعلان|إعلان|للبيع|بيع|شراء|خصم|عرض|متوفر|للطلب|تواصل خاص|اشتراك)/i.test(
        text || ""
    );
}

function protectionMessage(type, userId) {
    const messages = {
        "الروابط":
            "منشن الحساب، ممنوع إرسال الروابط.",
        "التعديل":
            "منشن الحساب، ممنوع إرسال تعديل الرسائل.",
        "التكرار":
            "منشن الحساب، ممنوع تكرار الرسائل.",
        "الإعلانات":
            "منشن الحساب، ممنوع إرسال الإعلانات.",
        "المنشنات":
            "منشن الحساب، ممنوع إرسال المنشنات.",
        "الفوروارد":
            "منشن الحساب، ممنوع إرسال الفوروارد.",
        "الصور":
            "منشن الحساب، ممنوع إرسال الصور.",
        "الفيديوهات":
            "منشن الحساب، ممنوع إرسال الفيديوهات.",
        "الملفات":
            "منشن الحساب، ممنوع إرسال الملفات.",
        "الملصقات":
            "منشن الحساب، ممنوع إرسال الملصقات"
    };

    return `<a href="tg://user?id=${userId}">${
        messages[type] || "مخالفة الحماية."
    }</a>`;
}

async function punishViolation(ctx, type) {
    const chat = getChat(ctx.chat.id);
    const user = getUser(
        ctx.chat.id,
        ctx.from.id,
        ctx.from
    );

    try {
        await ctx.deleteMessage();
    } catch {}

    if (!chat.settings.warningsEnabled) {
        return;
    }

    user.warnings =
        Number(user.warnings || 0) + 1;

    saveDB();

    await ctx.reply(
        protectionMessage(type, ctx.from.id),
        { parse_mode: "HTML" }
    ).catch(() => {});

    if (
        user.warnings >=
        chat.settings.warningLimit
    ) {
        if (chat.settings.autoMute) {
            try {
                await ctx.telegram.restrictChatMember(
                    ctx.chat.id,
                    ctx.from.id,
                    {
                        permissions: {
                            can_send_messages: false
                        },
                        until_date:
                            Math.floor(
                                Date.now() / 1000
                            ) +
                            chat.settings
                                .muteMinutes *
                                60
                    }
                );
            } catch {}
        }

        if (chat.settings.autoBan) {
            try {
                await ctx.telegram.banChatMember(
                    ctx.chat.id,
                    ctx.from.id
                );
            } catch {}
        }
    }
}

/* =========================================================
   /start
========================================================= */

bot.start(async ctx => {
    try {
        addSubscriber(ctx.from);

        const payload =
            ctx.startPayload || "";

        if (payload.startsWith("whisper_")) {
            const parts =
                payload.split("_");

            const chatId =
                Number(parts[1]);

            const targetId =
                Number(parts[2]);

            db.userStates[ctx.from.id] = {
                action: "whisper",
                chatId,
                targetId
            };

            saveDB();

            return ctx.reply(
                "• أرسل الآن الهمسة\n• يمكنك إرسال نص أو ملصق أو صورة أو قيف\n-"
            );
        }

        if (
            payload.startsWith("wh_view_")
        ) {
            return showWhisper(
                ctx,
                payload.slice(9)
            );
        }

        if (
            payload.startsWith("wh_reply_")
        ) {
            const whisperId =
                payload.slice(10);

            const whisper =
                db.whispers[whisperId];

            if (
                !whisper ||
                whisper.targetId !==
                    ctx.from.id
            ) {
                return ctx.reply(
                    "• هذه الهمسة ليست موجهة لك."
                );
            }

            db.userStates[
                ctx.from.id
            ] = {
                action: "whisper_reply",
                whisperId
            };

            saveDB();

            return ctx.reply(
                "• أرسل الآن الهمسة\n• يمكنك إرسال نص أو ملصق أو صورة أو قيف\n-"
            );
        }

        return ctx.reply(
            "• أهلًا بك في بوت تورايف",
            {
                reply_markup:
                    Markup.inlineKeyboard([
                        [
                            Markup.button.url(
                                "اضفني لمجموعتك",
                                `https://t.me/${ctx.botInfo.username}?startgroup=true`
                            )
                        ]
                    ])
            }
        );
    } catch (err) {
        console.error(
            "START:",
            err.message
        );
    }
});

/* =========================================================
   الهمسات
========================================================= */

async function showWhisper(ctx, whisperId) {
    const whisper =
        db.whispers[whisperId];

    if (!whisper) {
        return ctx.reply(
            "• عذراً، انتهت صلاحية هذه الهمسة."
        );
    }

    if (
        ctx.from.id !==
        whisper.targetId
    ) {
        return ctx.reply(
            "• هذه الهمسة ليست موجهة لك."
        );
    }

    try {
        await ctx.telegram.sendMessage(
            whisper.senderId,
            "• شاف همستك ."
        );
    } catch {}

    const message =
        whisper.message;

    const keyboard =
        Markup.inlineKeyboard([
            [
                Markup.button.url(
                    "رد على الهمسة",
                    `https://t.me/${ctx.botInfo.username}?start=wh_reply_${whisperId}`
                )
            ]
        ]);

    if (message.text) {
        return ctx.reply(
            message.text,
            {
                reply_markup:
                    keyboard.reply_markup
            }
        );
    }

    if (message.photo) {
        return ctx.replyWithPhoto(
            message.photo[
                message.photo.length - 1
            ].file_id,
            {
                caption:
                    message.caption || "",
                reply_markup:
                    keyboard.reply_markup
            }
        );
    }

    if (message.sticker) {
        await ctx.replyWithSticker(
            message.sticker.file_id
        );

        return ctx.reply(
            "•",
            {
                reply_markup:
                    keyboard.reply_markup
            }
        );
    }

    if (message.animation) {
        return ctx.replyWithAnimation(
            message.animation.file_id,
            {
                caption:
                    message.caption || "",
                reply_markup:
                    keyboard.reply_markup
            }
        );
    }

    if (message.video) {
        return ctx.replyWithVideo(
            message.video.file_id,
            {
                caption:
                    message.caption || "",
                reply_markup:
                    keyboard.reply_markup
            }
        );
    }

    return ctx.reply(
        "• وصلت الهمسة.",
        {
            reply_markup:
                keyboard.reply_markup
        }
    );
}

/* =========================================================
   الخاص
========================================================= */

bot.on("message", async (ctx, next) => {
    try {
        if (
            ctx.chat.type !==
            "private"
        ) {
            return next();
        }

        addSubscriber(ctx.from);

        const state =
            db.userStates[
                ctx.from.id
            ];

        if (!state) {
            return next();
        }

        /* الهمسة */

        if (
            state.action ===
            "whisper"
        ) {
            delete db.userStates[
                ctx.from.id
            ];

            const whisperId =
                "w_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(2, 8);

            db.whispers[
                whisperId
            ] = {
                senderId:
                    ctx.from.id,
                targetId:
                    state.targetId,
                chatId:
                    state.chatId,
                message:
                    ctx.message,
                createdAt:
                    Date.now()
            };

            saveDB();

            await ctx.reply(
                "• تم ارسال الهمسة"
            );

            try {
                await ctx.telegram.sendMessage(
                    state.targetId,
                    `• ياحلو ↤ <a href="tg://user?id=${state.targetId}">المستلم</a>\n• وصلتك همسة سرية من ↤ <a href="tg://user?id=${ctx.from.id}">${escapeHTML(ctx.from.first_name)}</a>\n• انت وحدك تقدر تشوفها`,
                    {
                        parse_mode: "HTML",
                        reply_markup:
                            Markup.inlineKeyboard([
                                [
                                    Markup.button.url(
                                        "رؤية الهمسة",
                                        `https://t.me/${ctx.botInfo.username}?start=wh_view_${whisperId}`
                                    )
                                ],
                                [
                                    Mark
