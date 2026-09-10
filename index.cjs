const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
    console.error("BOT_TOKEN غير موجود في Environment Variables");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

const DB_FILE = path.join(__dirname, "database.json");

/* =====================================================
   إعداد المالك والمطورين
===================================================== */

const MAIN_OWNER_ID = Number(
    process.env.MAIN_OWNER_ID || 0
);

const DEVELOPERS_IDS = String(
    process.env.DEVELOPERS_IDS || ""
)
    .split(",")
    .map(x => Number(x.trim()))
    .filter(Boolean);

/* =====================================================
   الرتب
===================================================== */

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

const RANK_NAMES = [
    "عضو",
    "مميز",
    "مالك",
    "مالك أساسي",
    "Myth",
    "Myth🎖️",
    "Dev²🎖️",
    "Dev🎖️"
];

/* =====================================================
   إعدادات القروب
===================================================== */

const DEFAULT_SETTINGS = {
    botEnabled: true,

    protection: true,
    autoProtection: true,
    violationsOpen: true,

    replies: true,
    bank: true,
    games: true,
    communication: true,

    statistics: true,
    zaajel: true,
    formats: true,

    forcedSubscription: false,
    forcedSubscriptionChannel: "",

    antiLinks: true,
    antiEdits: true,
    antiSpam: true,
    antiAds: true,
    antiMentions: true,
    antiForwards: true,
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

    globalMute: false,

    memberLimit: 0
};

/* =====================================================
   قاعدة البيانات
===================================================== */

const DEFAULT_DB = {
    users: {},
    chats: {},

    developers: {
        dev: [],
        dev2: []
    },

    forbiddenWords: {},

    customCommands: {},
    customReplies: {},

    whispers: {},
    userStates: {},

    violations: {},

    logs: {},

    bankAccounts: {},
    transfers: {},

    games: {},
    events: {},

    music: {},

    adminPromotions: {},

    settings: {}
};

/* =====================================================
   أدوات قاعدة البيانات
===================================================== */

function clone(obj) {
    return JSON.parse(
        JSON.stringify(obj)
    );
}

function mergeDefaults(defaults, current) {
    if (
        !current ||
        typeof current !== "object"
    ) {
        return defaults;
    }

    for (const key of Object.keys(current)) {

        if (
            current[key] &&
            typeof current[key] === "object" &&
            !Array.isArray(current[key]) &&
            defaults[key] &&
            typeof defaults[key] === "object" &&
            !Array.isArray(defaults[key])
        ) {
            defaults[key] = mergeDefaults(
                defaults[key],
                current[key]
            );
        } else {
            defaults[key] = current[key];
        }
    }

    return defaults;
}

function loadDB() {

    try {

        if (!fs.existsSync(DB_FILE)) {

            fs.writeFileSync(
                DB_FILE,
                JSON.stringify(
                    DEFAULT_DB,
                    null,
                    2
                ),
                "utf8"
            );

            return clone(DEFAULT_DB);
        }

        const raw =
            fs.readFileSync(
                DB_FILE,
                "utf8"
            );

        if (!raw.trim()) {
            return clone(DEFAULT_DB);
        }

        return mergeDefaults(
            clone(DEFAULT_DB),
            JSON.parse(raw)
        );

    } catch (error) {

        console.error(
            "خطأ في قاعدة البيانات:",
            error
        );

        return clone(DEFAULT_DB);
    }
}

let db = loadDB();

function saveDB() {

    try {

        fs.writeFileSync(
            DB_FILE,
            JSON.stringify(
                db,
                null,
                2
            ),
            "utf8"
        );

    } catch (error) {

        console.error(
            "خطأ في حفظ قاعدة البيانات:",
            error
        );
    }
}

/* =====================================================
   أدوات عامة
===================================================== */

function normalize(text = "") {

    return String(text)
        .trim()
        .replace(/\s+/g, " ")
        .replace(/[إأآ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي");
}

function escapeHTML(text = "") {

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function mention(user) {

    if (!user) {
        return "المستخدم";
    }

    const name =
        escapeHTML(
            user.first_name ||
            user.username ||
            "المستخدم"
        );

    return `<a href="tg://user?id=${user.id}">${name}</a>`;
}

function mentionById(
    id,
    name = "المستخدم"
) {

    return `<a href="tg://user?id=${id}">${escapeHTML(name)}</a>`;
}

function htmlOptions(extra = {}) {

    return {
        parse_mode: "HTML",
        ...extra
    };
}

function isGroup(ctx) {

    return !!(
        ctx.chat &&
        (
            ctx.chat.type === "group" ||
            ctx.chat.type === "supergroup"
        )
    );
}

/* =====================================================
   القروبات
===================================================== */

function getChat(chatId) {

    const id = String(chatId);

    if (!db.chats[id]) {

        db.chats[id] = {

            id,

            title: "",

            users: {},

            ranks: {},

            mutedUsers: {},

            globalMutedUsers: {},

            blockedUsers: {},

            rules: "",

            settings:
                clone(DEFAULT_SETTINGS),

            createdAt: Date.now()
        };
    }

    const chat =
        db.chats[id];

    chat.users ||= {};
    chat.ranks ||= {};
    chat.mutedUsers ||= {};
    chat.globalMutedUsers ||= {};
    chat.blockedUsers ||= {};

    chat.settings =
        mergeDefaults(
            clone(DEFAULT_SETTINGS),
            chat.settings || {}
        );

    return chat;
}

/* =====================================================
   المستخدمين
===================================================== */

function getUser(userId) {

    const id =
        String(userId);

    if (!db.users[id]) {

        db.users[id] = {

            id: Number(userId),

            username: "",

            first_name: "",

            last_name: "",

            balance: 0,

            points: {},

            messages: {},

            warnings: {},

            bank: null,

            transferHistory: [],

            createdAt: Date.now()
        };
    }

    return db.users[id];
}

function ensureUser(ctx) {

    if (!ctx.from) {
        return;
    }

    const user =
        getUser(ctx.from.id);

    user.username =
        ctx.from.username ||
        user.username ||
        "";

    user.first_name =
        ctx.from.first_name ||
        user.first_name ||
        "";

    user.last_name =
        ctx.from.last_name ||
        user.last_name ||
        "";

    if (isGroup(ctx)) {

        const chat =
            getChat(ctx.chat.id);

        const id =
            String(ctx.from.id);

        if (!chat.users[id]) {

            chat.users[id] = {

                id: ctx.from.id,

                username:
                    ctx.from.username || "",

                first_name:
                    ctx.from.first_name || "",

                messages: 0,

                points: 0,

                joinedAt: Date.now()
            };

        } else {

            chat.users[id].username =
                ctx.from.username ||
                chat.users[id].username ||
                "";

            chat.users[id].first_name =
                ctx.from.first_name ||
                chat.users[id].first_name ||
                "";
        }
    }
}

/* =====================================================
   الرتب
===================================================== */

function getRank(
    ctx,
    userId = null
) {

    const id =
        Number(
            userId !== null
                ? userId
                : ctx.from?.id
        );

    if (!id) {
        return "عضو";
    }

    if (
        MAIN_OWNER_ID &&
        id === MAIN_OWNER_ID
    ) {
        return "Dev🎖️";
    }

    if (
        DEVELOPERS_IDS.includes(id)
    ) {
        return "Dev🎖️";
    }

    if (
        db.developers.dev.includes(id)
    ) {
        return "Dev🎖️";
    }

    if (
        db.developers.dev2.includes(id)
    ) {
        return "Dev²🎖️";
    }

    if (ctx.chat) {

        const chat =
            getChat(ctx.chat.id);

        const rank =
            chat.ranks[
                String(id)
            ];

        if (
            rank &&
            RANKS[rank] !== undefined
        ) {
            return rank;
        }
    }

    return "عضو";
}

function getRankLevel(
    ctx,
    userId = null
) {

    return (
        RANKS[
            getRank(
                ctx,
                userId
            )
        ] ?? 0
    );
}

function hasRank(
    ctx,
    requiredRank,
    userId = null
) {

    return (
        getRankLevel(
            ctx,
            userId
        ) >=
        RANKS[requiredRank]
    );
}

function isDev(
    ctx,
    userId = null
) {

    return hasRank(
        ctx,
        "Dev²🎖️",
        userId
    );
}

function isTopDev(
    ctx,
    userId = null
) {

    return hasRank(
        ctx,
        "Dev🎖️",
        userId
    );
}

async function requireRank(
    ctx,
    requiredRank
) {

    if (
        hasRank(
            ctx,
            requiredRank
        )
    ) {
        return true;
    }

    await ctx.reply(
        `• ما تقدر تستخدم الأمر، رتبتك الحالية ${escapeHTML(getRank(ctx))}`
    );

    return false;
}

/* =====================================================
   صلاحيات التحكم بالرتب
===================================================== */

function canControlUser(
    ctx,
    targetId
) {

    return (
        getRankLevel(ctx) >
        getRankLevel(
            ctx,
            targetId
        )
    );
}

async function canModerateTarget(
    ctx,
    targetId
) {

    if (
        targetId ===
        ctx.from.id
    ) {

        await ctx.reply(
            "• لا يمكنك تنفيذ الأمر على نفسك."
        );

        return false;
    }

    if (
        !canControlUser(
            ctx,
            targetId
        )
    ) {

        await ctx.reply(
            "• ما تقدر تستخدم الأمر على مستخدم رتبته مساوية أو أعلى من رتبتك."
        );

        return false;
    }

    try {

        const member =
            await ctx.telegram.getChatMember(
                ctx.chat.id,
                targetId
            );

        if (
            member.status ===
            "creator"
        ) {

            await ctx.reply(
                "• لا يمكنك تنفيذ الأمر على مالك القروب."
            );

            return false;
        }

    } catch {}

    return true;
}

/* =====================================================
   إعدادات القروب
===================================================== */

function getSettings(ctx) {

    return getChat(
        ctx.chat.id
    ).settings;
}

function setSetting(
    ctx,
    key,
    value
) {

    getSettings(ctx)[key] =
        value;

    saveDB();
}

/* =====================================================
   جلب العضو
===================================================== */

async function getMember(
    ctx,
    userId
) {

    try {

        return await ctx.telegram.getChatMember(
            ctx.chat.id,
            userId
        );

    } catch {

        return null;
    }
}

async function isCreator(
    ctx,
    userId
) {

    const member =
        await getMember(
            ctx,
            userId
        );

    return (
        member?.status ===
        "creator"
    );
}

/* =====================================================
   الريبلاي
===================================================== */

function getReplyTarget(ctx) {

    return (
        ctx.message
            ?.reply_to_message
            ?.from || null
    );
}

async function requireReply(ctx) {

    const target =
        getReplyTarget(ctx);

    if (!target) {

        await ctx.reply(
            "• يجب عليك عمل ريبلاي على المستخدم."
        );

        return null;
    }

    return target;
}

/* =====================================================
   تسجيل الأحداث
===================================================== */

function logAction(
    ctx,
    action,
    targetId = null,
    extra = {}
) {

    if (!ctx.chat) {
        return;
    }

    const id =
        String(ctx.chat.id);

    db.logs[id] ||= [];

    db.logs[id].push({

        action,

        actorId:
            ctx.from?.id || null,

        targetId,

        extra,

        time: Date.now()
    });

    if (
        db.logs[id].length >
        500
    ) {

        db.logs[id] =
            db.logs[id]
                .slice(-500);
    }

    saveDB();
}

/* =====================================================
   Middleware
===================================================== */

bot.use(
    async (ctx, next) => {

        try {

            ensureUser(ctx);

            if (
                isGroup(ctx) &&
                ctx.message &&
                ctx.from
            ) {

                const chat =
                    getChat(
                        ctx.chat.id
                    );

                const id =
                    String(
                        ctx.from.id
                    );

                chat.users[id] ||= {

                    id:
                        ctx.from.id,

                    username:
                        ctx.from.username || "",

                    first_name:
                        ctx.from.first_name || "",

                    messages: 0,

                    points: 0
                };

                chat.users[id]
                    .messages++;

                chat.users[id]
                    .points++;

                const user =
                    getUser(
                        ctx.from.id
                    );

                const chatId =
                    String(
                        ctx.chat.id
                    );

                user.messages[chatId] =
                    Number(
                        user.messages[chatId] || 0
                    ) + 1;

                user.points[chatId] =
                    Number(
                        user.points[chatId] || 0
                    ) + 1;

                saveDB();
            }

            return next();

        } catch (error) {

            console.error(
                "Middleware error:",
                error
            );

            return next();
        }
    }
);

/* =====================================================
   رتبتي
===================================================== */

bot.hears(
    "رتبتي",
    async ctx => {

        await ctx.reply(
            `• رتبتك الحالية ↤ ${escapeHTML(getRank(ctx))}`
        );
    }
);

/* =====================================================
   تفاعلي
===================================================== */

bot.hears(
    "تفاعلي",
    async ctx => {

        if (!isGroup(ctx)) {
            return;
        }

        const chat =
            getChat(
                ctx.chat.id
            );

        const data =
            chat.users[
                String(
                    ctx.from.id
                )
            ] || {};

        const users =
            Object.values(
                chat.users
            )
            .sort(
                (a, b) =>
                    Number(
                        b.points || 0
                    ) -
                    Number(
                        a.points || 0
                    )
            );

        const position =
            users.findIndex(
                x =>
                    Number(x.id) ===
                    Number(ctx.from.id)
            ) + 1;

        await ctx.reply(
            `• تفاعلك\n` +
            `━━━━━━━━━━━━━━\n` +
            `• رتبتك ↤ ${escapeHTML(getRank(ctx))}\n` +
            `• رسائلك بالتفاعل ↤ ${Number(data.messages || 0)}\n` +
            `• ترتيبك بالمتفاعلين ↤ ${position || "-"}\n` +
            `• نقاطك ↤ ${Number(data.points || 0)}`,
            htmlOptions()
        );
    }
);

/* =====================================================
   المتصدرين
===================================================== */

bot.hears(
    ["المتصدرين", "المتصدر"],
    async ctx => {

        if (!isGroup(ctx)) {
            return;
        }

        const chat =
            getChat(
                ctx.chat.id
            );

        const users =
            Object.values(
                chat.users
            )
            .sort(
                (a, b) =>
                    Number(
                        b.points || 0
                    ) -
                    Number(
                        a.points || 0
                    )
            )
            .slice(0, 10);

        if (!users.length) {

            await ctx.reply(
                "• لا يوجد متفاعلين."
            );

            return;
        }

        let text =
            "• المتفاعلين\n" +
            "━━━━━━━━━━━━━━\n";

        users.forEach(
            (user, index) => {

                text +=
                    `${index + 1} - ` +
                    `${mentionById(
                        user.id,
                        user.first_name ||
                        user.username ||
                        "مستخدم"
                    )}` +
                    ` ↤ ${Number(
                        user.points || 0
                    )}\n`;
            }
        );

        await ctx.reply(
            text,
            htmlOptions()
        );
    }
);

/* =====================================================
   أخطاء البوت
===================================================== */

bot.catch(
    async (error, ctx) => {

        console.error(
            "BOT ERROR:",
            error
        );

        try {

            if (ctx?.chat) {

                await ctx.reply(
                    "• حدث خطأ غير متوقع، حاول مرة أخرى."
                );
            }

        } catch {}
    }
);

// =====================================================
// TORAYF BOT - PART 2
// الرتب + الإدارة + الحماية الأساسية
// =====================================================

/* =====================================================
   بيانات التحذيرات
===================================================== */

function getViolationData(chatId, userId) {

    const chatIdKey = String(chatId);
    const userIdKey = String(userId);

    db.violations[chatIdKey] ||= {};

    db.violations[chatIdKey][userIdKey] ||= {
        count: 0,
        history: []
    };

    return db.violations[chatIdKey][userIdKey];
}

/* =====================================================
   تغيير الرتبة
===================================================== */

function removeGlobalDeveloper(targetId) {

    db.developers.dev =
        db.developers.dev.filter(
            id => Number(id) !== Number(targetId)
        );

    db.developers.dev2 =
        db.developers.dev2.filter(
            id => Number(id) !== Number(targetId)
        );
}

async function changeRank(
    ctx,
    target,
    newRank,
    action = "رفع"
) {

    if (!isGroup(ctx)) {
        return;
    }

    const actorLevel =
        getRankLevel(ctx);

    const targetLevel =
        getRankLevel(
            ctx,
            target.id
        );

    const newLevel =
        RANKS[newRank];

    if (newLevel === undefined) {
        return;
    }

    if (
        Number(target.id) ===
        Number(ctx.from.id)
    ) {

        await ctx.reply(
            "• لا يمكنك تغيير رتبتك بنفسك."
        );

        return;
    }

    if (
        targetLevel >=
        actorLevel
    ) {

        await ctx.reply(
            "• لا يمكنك تعديل رتبة مستخدم رتبته مساوية أو أعلى من رتبتك."
        );

        return;
    }

    /*
       صلاحيات إعطاء الرتب
    */

    if (
        newLevel >=
        RANKS["Dev²🎖️"]
    ) {

        if (!isTopDev(ctx)) {

            await ctx.reply(
                "• هذا الأمر يخص ↤ Dev🎖️"
            );

            return;
        }

    } else if (
        newLevel >=
        RANKS["Myth🎖️"]
    ) {

        if (!isDev(ctx)) {

            await ctx.reply(
                "• هذا الأمر يخص ↤ Dev²🎖️"
            );

            return;
        }

    } else if (
        newLevel >=
        RANKS["مالك أساسي"]
    ) {

        if (
            actorLevel <
            RANKS["Myth"]
        ) {

            await ctx.reply(
                "• هذا الأمر يخص ↤ Myth"
            );

            return;
        }

    } else if (
        newLevel >=
        RANKS["مالك"]
    ) {

        if (
            actorLevel <
            RANKS["مالك أساسي"]
        ) {

            await ctx.reply(
                "• هذا الأمر يخص ↤ مالك أساسي"
            );

            return;
        }

    } else if (
        newLevel >=
        RANKS["مميز"]
    ) {

        if (
            actorLevel <
            RANKS["مالك"]
        ) {

            await ctx.reply(
                "• هذا الأمر يخص ↤ مالك"
            );

            return;
        }
    }

    if (
        newLevel >=
        actorLevel
    ) {

        await ctx.reply(
            "• لا يمكنك إعطاء رتبة مساوية أو أعلى من رتبتك."
        );

        return;
    }

    const chat =
        getChat(ctx.chat.id);

    /*
       إزالة أي رتبة مطور قديمة
    */

    removeGlobalDeveloper(
        target.id
    );

    /*
       عضو = إزالة الرتبة
    */

    if (newLevel === 0) {

        delete chat.ranks[
            String(target.id)
        ];

    } else {

        chat.ranks[
            String(target.id)
        ] = newRank;
    }

    /*
       المطورين العالميين
    */

    if (
        newRank === "Dev🎖️"
    ) {

        if (
            !db.developers.dev.includes(
                Number(target.id)
            )
        ) {

            db.developers.dev.push(
                Number(target.id)
            );
        }
    }

    if (
        newRank === "Dev²🎖️"
    ) {

        if (
            !db.developers.dev2.includes(
                Number(target.id)
            )
        ) {

            db.developers.dev2.push(
                Number(target.id)
            );
        }
    }

    saveDB();

    logAction(
        ctx,
        action === "رفع"
            ? "رفع رتبة"
            : "تنزيل رتبة",
        target.id,
        {
            rank: newRank
        }
    );

    await ctx.reply(
        `${mention(target)}\n` +
        `• المستخدم ↤ تم تعديل رتبته\n` +
        `• الرتبة ↤ ${escapeHTML(newRank)}\n` +
        `• تم ${action} الرتبة بنجاح.`,
        htmlOptions()
    );
}

/* =====================================================
   أوامر رفع الرتب
===================================================== */

const PROMOTION_COMMANDS = {

    "رفع مميز": "مميز",
    "رفع مالك": "مالك",
    "رفع مالك اساسي": "مالك أساسي",
    "رفع اساس": "مالك أساسي",

    "رفع M": "Myth",
    "رفع MY": "Myth🎖️",
    "رفع اكس": "Myth🎖️",

    "رفع ديف": "Dev²🎖️",
    "رفع Dev": "Dev²🎖️",

    "رفع مطور ثانوي": "Dev🎖️"
};

/* =====================================================
   أوامر تنزيل الرتب
===================================================== */

const DEMOTION_COMMANDS = {

    "تنزيل مميز": "عضو",
    "تنزيل مالك": "مميز",
    "تنزيل مالك اساسي": "مالك",

    "تنزيل M": "مالك أساسي",
    "تنزيل MY": "Myth",
    "تنزيل اكس": "Myth",

    "تنزيل ديف": "Myth🎖️",
    "تنزيل Dev": "Myth🎖️",

    "تنزيل مطور ثانوي": "Dev²🎖️"
};

function findCommandRank(
    object,
    text
) {

    const normalized =
        normalize(text);

    for (
        const [command, rank]
        of Object.entries(object)
    ) {

        if (
            normalize(command) ===
            normalized
        ) {

            return rank;
        }
    }

    return null;
}

bot.on(
    "text",
    async ctx => {

        if (!isGroup(ctx)) {
            return;
        }

        const text =
            ctx.message.text;

        const promotionRank =
            findCommandRank(
                PROMOTION_COMMANDS,
                text
            );

        const demotionRank =
            findCommandRank(
                DEMOTION_COMMANDS,
                text
            );

        if (
            promotionRank ||
            demotionRank
        ) {

            const target =
                await requireReply(ctx);

            if (!target) {
                return;
            }

            await changeRank(
                ctx,
                target,
                promotionRank ||
                demotionRank,
                promotionRank
                    ? "رفع"
                    : "تنزيل"
            );
        }
    }
);

/* =====================================================
   تنزيل الكل
===================================================== */

bot.hears(
    "تنزيل الكل",
    async ctx => {

        if (!isGroup(ctx)) {
            return;
        }

        const target =
            await requireReply(ctx);

        if (!target) {
            return;
        }

        if (
            !canControlUser(
                ctx,
                target.id
            )
        ) {

            await ctx.reply(
                "• لا يمكنك تنزيل مستخدم رتبته مساوية أو أعلى من رتبتك."
            );

            return;
        }

        if (
            await isCreator(
                ctx,
                target.id
            )
        ) {

            await ctx.reply(
                "• لا يمكنك تنزيل مالك القروب."
            );

            return;
        }

        const chat =
            getChat(ctx.chat.id);

        delete chat.ranks[
            String(target.id)
        ];

        removeGlobalDeveloper(
            target.id
        );

        saveDB();

        await ctx.reply(
            `${mention(target)}\n` +
            `• المستخدم ↤ تم تنزيله\n` +
            `• الرتبة ↤ عضو`,
            htmlOptions()
        );

        logAction(
            ctx,
            "تنزيل الكل",
            target.id
        );
    }
);

/* =====================================================
   الكتم
===================================================== */

const FULL_PERMISSIONS = {

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
};

const MUTE_PERMISSIONS = {

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
};

const RESTRICT_PERMISSIONS = {

    can_send_messages: true,
    can_send_audios: false,
    can_send_documents: false,
    can_send_photos: false,
    can_send_videos: false,
    can_send_video_notes: false,
    can_send_voice_notes: false,
    can_send_polls: false,
    can_send_other_messages: false,
    can_add_web_page_previews: false
};

async function muteUser(
    ctx,
    targetId,
    minutes = null
) {

    const duration =
        minutes ??
        Number(
            getSettings(ctx)
                .muteMinutes || 10
        );

    const until =
        Math.floor(
            Date.now() / 1000
        ) +
        duration * 60;

    try {

        await ctx.telegram.restrictChatMember(
            ctx.chat.id,
            targetId,
            {
                permissions:
                    MUTE_PERMISSIONS,
                until_date: until
            }
        );

        const chat =
            getChat(ctx.chat.id);

        chat.mutedUsers[
            String(targetId)
        ] = {

            until,

            by:
                ctx.from.id,

            createdAt:
                Date.now()
        };

        saveDB();

        return true;

    } catch (error) {

        console.error(
            "Mute error:",
            error.message
        );

        return false;
    }
}

/* =====================================================
   فك الكتم
===================================================== */

async function unmuteUser(
    ctx,
    targetId
) {

    try {

        await ctx.telegram.restrictChatMember(
            ctx.chat.id,
            targetId,
            {
                permissions:
                    FULL_PERMISSIONS
            }
        );

        const chat =
            getChat(ctx.chat.id);

        delete chat.mutedUsers[
            String(targetId)
        ];

        saveDB();

        return true;

    } catch (error) {

        console.error(
            "Unmute error:",
            error.message
        );

        return false;
    }
}

/* =====================================================
   التقييد
===================================================== */

async function restrictUser(
    ctx,
    targetId,
    minutes = null
) {

    const duration =
        minutes ??
        Number(
            getSettings(ctx)
                .restrictMinutes || 10
        );

    const until =
        Math.floor(
            Date.now() / 1000
        ) +
        duration * 60;

    try {

        await ctx.telegram.restrictChatMember(
            ctx.chat.id,
            targetId,
            {
                permissions:
                    RESTRICT_PERMISSIONS,
                until_date: until
            }
        );

        return true;

    } catch (error) {

        console.error(
            "Restrict error:",
            error.message
        );

        return false;
    }
}

/* =====================================================
   إلغاء التقييد
===================================================== */

async function unrestrictUser(
    ctx,
    targetId
) {

    return unmuteUser(
        ctx,
        targetId
    );
}

/* =====================================================
   الحظر
===================================================== */

async function banUser(
    ctx,
    targetId
) {

    try {

        await ctx.telegram.banChatMember(
            ctx.chat.id,
            targetId
        );

        return true;

    } catch (error) {

        console.error(
            "Ban error:",
            error.message
        );

        return false;
    }
}

/* =====================================================
   فك الحظر
===================================================== */

async function unbanUser(
    ctx,
    targetId
) {

    try {

        await ctx.telegram.unbanChatMember(
            ctx.chat.id,
            targetId,
            {
                only_if_banned: true
            }
        );

        return true;

    } catch (error) {

        console.error(
            "Unban error:",
            error.message
        );

        return false;
    }
}

/* =====================================================
   الطرد
===================================================== */

async function kickUser(
    ctx,
    targetId
) {

    try {

        await ctx.telegram.banChatMember(
            ctx.chat.id,
            targetId
        );

        await ctx.telegram.unbanChatMember(
            ctx.chat.id,
            targetId
        );

        return true;

    } catch (error) {

        console.error(
            "Kick error:",
            error.message
        );

        return false;
    }
}

/* =====================================================
   أوامر الإدارة
===================================================== */

const MODERATION_COMMANDS = {

    "كتم": "mute",
    "فك كتم": "unmute",

    "تقييد": "restrict",
    "الغاء التقييد": "unrestrict",

    "حظر": "ban",
    "فك الحظر": "unban",

    "طرد": "kick",

    "تحذير": "warn",
    "الغاء التحذير": "unwarn"
};

bot.on(
    "text",
    async ctx => {

        if (!isGroup(ctx)) {
            return;
        }

        const command =
            normalize(
                ctx.message.text
            );

        let action = null;

        for (
            const [name, value]
            of Object.entries(
                MODERATION_COMMANDS
            )
        ) {

            if (
                normalize(name) ===
                command
            ) {

                action = value;
                break;
            }
        }

        if (!action) {
            return;
        }

        const target =
            await requireReply(ctx);

        if (!target) {
            return;
        }

        if (
            !await canModerateTarget(
                ctx,
                target.id
            )
        ) {

            return;
        }

        let requiredRank =
            "مميز";

        if (
            [
                "restrict",
                "unrestrict"
            ].includes(action)
        ) {

            requiredRank =
                "Dev²🎖️";
        }

        if (
            [
                "ban",
                "unban",
                "kick",
                "warn",
                "unwarn"
            ].includes(action)
        ) {

            requiredRank =
                "Myth";
        }

        if (
            !await requireRank(
                ctx,
                requiredRank
            )
        ) {

            return;
        }

        let success = false;

        if (
            action === "mute"
        ) {

            success =
                await muteUser(
                    ctx,
                    target.id
                );
        }

        if (
            action === "unmute"
        ) {

            success =
                await unmuteUser(
                    ctx,
                    target.id
                );
        }

        if (
            action === "restrict"
        ) {

            success =
                await restrictUser(
                    ctx,
                    target.id
                );
        }

        if (
            action === "unrestrict"
        ) {

            success =
                await unrestrictUser(
                    ctx,
                    target.id
                );
        }

        if (
            action === "ban"
        ) {

            success =
                await banUser(
                    ctx,
                    target.id
                );
        }

        if (
            action === "unban"
        ) {

            success =
                await unbanUser(
                    ctx,
                    target.id
                );
        }

        if (
            action === "kick"
        ) {

            success =
                await kickUser(
                    ctx,
                    target.id
                );
        }

        if (
            action === "warn"
        ) {

            const data =
                getViolationData(
                    ctx.chat.id,
                    target.id
                );

            data.count++;

            data.history.push({

                type:
                    "تحذير يدوي",

                by:
                    ctx.from.id,

                time:
                    Date.now()
            });

            saveDB();

            success = true;
        }

        if (
            action === "unwarn"
        ) {

            const data =
                getViolationData(
                    ctx.chat.id,
                    target.id
                );

            data.count = 0;
            data.history = [];

            saveDB();

            success = true;
        }

        if (!success) {

            await ctx.reply(
                "• تعذر تنفيذ الأمر، تأكد من أن البوت مشرف ويملك الصلاحيات المطلوبة."
            );

            return;
        }

        logAction(
            ctx,
            command,
            target.id
        );

        let resultText =
            "• تم تنفيذ الأمر بنجاح.";

        if (action === "mute") {
            resultText =
                `• تم كتم المستخدم لمدة ${getSettings(ctx).muteMinutes} دقيقة.`;
        }

        if (action === "unmute") {
            resultText =
                "• تم فك الكتم.";
        }

        if (action === "restrict") {
            resultText =
                `• تم تقييد المستخدم لمدة ${getSettings(ctx).restrictMinutes} دقيقة.`;
        }

        if (action === "unrestrict") {
            resultText =
                "• تم إلغاء التقييد.";
        }

        if (action === "ban") {
            resultText =
                "• تم حظر المستخدم.";
        }

        if (action === "unban") {
            resultText =
                "• تم فك الحظر.";
        }

        if (action === "kick") {
            resultText =
                "• تم طرد المستخدم.";
        }

        if (action === "warn") {
            resultText =
                `• تم تحذير المستخدم.\n• عدد التحذيرات ↤ ${getViolationData(ctx.chat.id, target.id).count}`;
        }

        if (action === "unwarn") {
            resultText =
                "• تم إلغاء جميع التحذيرات.";
        }

        await ctx.reply(
            `${mention(target)}\n${resultText}`,
            htmlOptions()
        );
    }
);

/* =====================================================
   مسح المكتومين
   مم = عادي
===================================================== */

async function clearMutedUsers(ctx) {

    const chat =
        getChat(ctx.chat.id);

    const ids =
        Object.keys(
            chat.mutedUsers
        );

    if (!ids.length) {

        await ctx.reply(
            "• لا يوجد مكتومين."
        );

        return;
    }

    let success = 0;

    for (const id of ids) {

        const result =
            await unmuteUser(
                ctx,
                Number(id)
            );

        if (result) {
            success++;
        }
    }

    chat.mutedUsers = {};

    saveDB();

    await ctx.reply(
        `• تم مسح المكتومين\n• العدد ↤ ${success}`
    );
}

bot.hears(
    ["مم", "مسح المكتومين"],
    async ctx => {

        if (!isGroup(ctx)) {
            return;
        }

        if (
            !await requireRank(
                ctx,
                "Myth"
            )
        ) {
            return;
        }

        await clearMutedUsers(ctx);
    }
);

/* =====================================================
   الكتم العام
   خخ
===================================================== */

bot.hears(
    ["خخ", "مسح المكتومين عام"],
    async ctx => {

        if (!isGroup(ctx)) {
            return;
        }

        if (
            !await requireRank(
                ctx,
                "Myth🎖️"
            )
        ) {
            return;
        }

        const chat =
            getChat(ctx.chat.id);

        const ids =
            Object.keys(
                chat.globalMutedUsers
            );

        if (!ids.length) {

            await ctx.reply(
                "• لا يوجد مكتومين عام."
            );

            return;
        }

        let success = 0;

        for (const id of ids) {

            const result =
                await unmuteUser(
                    ctx,
                    Number(id)
                );

            if (result) {
                success++;
            }
        }

        chat.globalMutedUsers = {};

        saveDB();

        await ctx.reply(
            `• تم مسح المكتومين عام\n• العدد ↤ ${success}`
        );
    }
);

/* =====================================================
   كتم عام
===================================================== */

bot.hears(
    "كتم عام",
    async ctx => {

        if (!isGroup(ctx)) {
            return;
        }

        if (
            !await requireRank(
                ctx,
                "Myth🎖️"
            )
        ) {
            return;
        }

        const chat =
            getChat(ctx.chat.id);

        chat.settings.globalMute =
            true;

        saveDB();

        await ctx.reply(
            "• تم تفعيل الكتم العام."
        );
    }
);

bot.hears(
    "فك الكتم العام",
    async ctx => {

        if (!isGroup(ctx)) {
            return;
        }

        if (
            !await requireRank(
                ctx,
                "Myth🎖️"
            )
        ) {
            return;
        }

        const chat =
            getChat(ctx.chat.id);

        chat.settings.globalMute =
            false;

        saveDB();

        await ctx.reply(
            "• تم إلغاء الكتم العام."
        );
    }
);

/* =====================================================
   رفع مشرف
===================================================== */

const ADMIN_PERMISSIONS = {

    can_change_info: false,
    can_post_messages: false,
    can_edit_messages: false,
    can_delete_messages: false,
    can_invite_users: false,
    can_restrict_members: false,
    can_pin_messages: false,
    can_promote_members: false,
    can_manage_video_chats: false,
    can_manage_topics: false,
    can_manage_stories: false,
    can_post_stories: false,
    can_edit_stories: false,
    can_delete_stories: false
};

const ADMIN_PERMISSION_NAMES = {

    can_delete_messages:
        "حذف الرسائل",

    can_pin_messages:
        "تثبيت الرسائل",

    can_restrict_members:
        "حظر المستخدمين",

    can_invite_users:
        "دعوة المستخدمين",

    can_promote_members:
        "إضافة مشرفين",

    can_change_info:
        "تغيير معلومات المجموعة",

    can_manage_video_chats:
        "إدارة المكالمات",

    can_manage_topics:
        "إدارة المواضيع",

    can_manage_stories:
        "إدارة القصص"
};

function getPromotionData(
    chatId,
    userId
) {

    const key =
        `${chatId}:${userId}`;

    db.adminPromotions[key] ||=
        clone(ADMIN_PERMISSIONS);

    return db.adminPromotions[key];
}

function promotionKey(
    chatId,
    userId
) {

    return `${chatId}:${userId}`;
}

async function showPromotionPanel(
    ctx,
    target
) {

    const permissions =
        getPromotionData(
            ctx.chat.id,
            target.id
        );

    let text =
        `• صلاحيات المستخدم\n` +
        `━━━━━━━━━━━━━━\n` +
        `• المستخدم ↤ ${escapeHTML(
            target.first_name ||
            target.username ||
            "مستخدم"
        )}\n\n`;

    for (
        const [key, name]
        of Object.entries(
            ADMIN_PERMISSION_NAMES
        )
    ) {

        text +=
            `• ${name} ↤ ` +
            `${permissions[key] ? "نعم" : "لا"}\n`;
    }

    text +=
        "\n• اختر تعديل الصلاحيات من الزر بالأسفل.";

    await ctx.reply(
        text,
        htmlOptions({
            reply_markup:
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback(
                            "تعديل الصلاحيات",
                            `admin_edit:${target.id}`
                        )
                    ],
                    [
                        Markup.button.callback(
                            "إخفاء الأمر",
                            `admin_hide:${target.id}`
                        )
                    ]
                ]).reply_markup
        })
    );
}

bot.hears(
    ["رفع مشرف", "ترقيه"],
    async ctx => {

        if (!isGroup(ctx)) {
            return;
        }

        const target =
            await requireReply(ctx);

        if (!target) {
            return;
        }

        if (
            !await requireRank(
                ctx,
                "مالك"
            )
        ) {
            return;
        }

        if (
            Number(target.id) ===
            Number(ctx.from.id)
        ) {

            await ctx.reply(
                "• لا يمكنك رفع نفسك مشرف."
            );

            return;
        }

        if (
            !canControlUser(
                ctx,
                target.id
            )
        ) {

            await ctx.reply(
                "• لا يمكنك تعديل صلاحيات مستخدم رتبته مساوية أو أعلى من رتبتك."
            );

            return;
        }

        const targetMember =
            await getMember(
                ctx,
                target.id
            );

        if (
            targetMember?.status ===
            "creator"
        ) {

            await ctx.reply(
                "• هذا المستخدم مالك القروب."
            );

            return;
        }

        if (
            targetMember?.status ===
            "administrator"
        ) {

            await ctx.reply(
                "• المستخدم مشرف بالفعل."
            );

            return;
        }

        await showPromotionPanel(
            ctx,
            target
        );
    }
);

/* =====================================================
   تعديل الصلاحيات
===================================================== */

function promotionButtons(
    targetId
) {

    const permissions =
        getPromotionData(
            "pending",
            targetId
        );

    return permissions;
}

function buildPermissionKeyboard(
    chatId,
    targetId
) {

    const permissions =
        getPromotionData(
            chatId,
            targetId
        );

    const buttons = [];

    for (
        const [key, name]
        of Object.entries(
            ADMIN_PERMISSION_NAMES
        )
    ) {

        buttons.push([
            Markup.button.callback(
                `${permissions[key] ? "✓" : "×"} ${name}`,
                `admin_toggle:${targetId}:${key}`
            )
        ]);
    }

    buttons.push([
        Markup.button.callback(
            "حفظ الصلاحيات",
            `admin_save:${targetId}`
        )
    ]);

    buttons.push([
        Markup.button.callback(
            "إخفاء الأمر",
            `admin_hide:${targetId}`
        )
    ]);

    return Markup.inlineKeyboard(
        buttons
    ).reply_markup;
}

bot.action(
    /^admin_edit:(\d+)$/,
    async ctx => {

        const targetId =
            Number(ctx.match[1]);

        if (
            !isGroup(ctx)
        ) {

            await ctx.answerCbQuery();
            return;
        }

        if (
            !hasRank(
                ctx,
                "مالك"
            )
        ) {

            await ctx.answerCbQuery(
                "ليس لديك الصلاحية"
            );

            return;
        }

        await ctx.answerCbQuery();

        await ctx.editMessageReplyMarkup(
            buildPermissionKeyboard(
                ctx.chat.id,
                targetId
            )
        );
    }
);

/* =====================================================
   تشغيل وإيقاف الصلاحيات
===================================================== */

bot.action(
    /^admin_toggle:(\d+):(.+)$/,
    async ctx => {

        const targetId =
            Number(ctx.match[1]);

        const permission =
            ctx.match[2];

        if (
            !ADMIN_PERMISSION_NAMES[
                permission
            ]
        ) {

            await ctx.answerCbQuery();
            return;
        }

        if (
            !hasRank(
                ctx,
                "مالك"
            )
        ) {

            await ctx.answerCbQuery(
                "ليس لديك الصلاحية"
            );

            return;
        }

        const data =
            getPromotionData(
                ctx.chat.id,
                targetId
            );

        data[permission] =
            !data[permission];

        saveDB();

        await ctx.answerCbQuery(
            data[permission]
                ? "تم التفعيل"
                : "تم الإيقاف"
        );

        await ctx.editMessageReplyMarkup(
            buildPermissionKeyboard(
                ctx.chat.id,
                targetId
            )
        );
    }
);

/* =====================================================
   حفظ صلاحيات المشرف
===================================================== */

bot.action(
    /^admin_save:(\d+)$/,
    async ctx => {

        const targetId =
            Number(ctx.match[1]);

        if (
            !hasRank(
                ctx,
                "مالك"
            )
        ) {

            await ctx.answerCbQuery(
                "ليس لديك الصلاحية"
            );

            return;
        }

        if (
            !canControlUser(
                ctx,
                targetId
            )
        ) {

            await ctx.answerCbQuery(
                "لا يمكنك تعديل هذا المستخدم"
            );

            return;
        }

        const member =
            await getMember(
                ctx,
                targetId
            );

        if (
            member?.status ===
            "creator"
        ) {

            await ctx.answerCbQuery(
                "لا يمكن تعديل مالك القروب"
            );

            return;
        }

        const permissions =
            getPromotionData(
                ctx.chat.id,
                targetId
            );

        try {

            await ctx.telegram.promoteChatMember(
                ctx.chat.id,
                targetId,
                permissions
            );

            saveDB();

            logAction(
                ctx,
                "رفع مشرف",
                targetId,
                {
                    permissions
                }
            );

            await ctx.answerCbQuery(
                "تم حفظ الصلاحيات"
            );

            await ctx.editMessageText(
                `• صلاحيات المستخدم\n` +
                `━━━━━━━━━━━━━━\n` +
                `• المستخدم ↤ ${mentionById(
                    targetId
                )}\n` +
                `• تم رفعه مشرف بنجاح.`,
                htmlOptions({
                    reply_markup:
                        Markup.inlineKeyboard([
                            [
                                Markup.button.callback(
                                    "إخفاء الأمر",
                                    `admin_hide:${targetId}`
                                )
                            ]
                        ]).reply_markup
                })
            );

        } catch (error) {

            console.error(
                "Promotion error:",
                error.message
            );

            await ctx.answerCbQuery(
                "تعذر رفع المشرف"
            );

            await ctx.reply(
                "• تعذر رفع المستخدم مشرف.\n• تأكد أن البوت مشرف ويملك صلاحية إضافة المشرفين."
            );
        }
    }
);

/* =====================================================
   إخفاء أمر المشرف
===================================================== */

bot.action(
    /^admin_hide:(\d+)$/,
    async ctx => {

        try {

            await ctx.deleteMessage();

        } catch {

            try {

                await ctx.editMessageText(
                    "• تم إخفاء الأمر."
                );

            } catch {}
        }

        await ctx.answerCbQuery();
    }
);
// =====================================================
// TORAYF BOT - PART 2
// الرتب + الإدارة + الحماية الأساسية
// =====================================================

/* =====================================================
   بيانات التحذيرات
===================================================== */

function getViolationData(chatId, userId) {

    const chatIdKey = String(chatId);
    const userIdKey = String(userId);

    db.violations[chatIdKey] ||= {};

    db.violations[chatIdKey][userIdKey] ||= {
        count: 0,
        history: []
    };

    return db.violations[chatIdKey][userIdKey];
}

/* =====================================================
   تغيير الرتبة
===================================================== */

function removeGlobalDeveloper(targetId) {

    db.developers.dev =
        db.developers.dev.filter(
            id => Number(id) !== Number(targetId)
        );

    db.developers.dev2 =
        db.developers.dev2.filter(
            id => Number(id) !== Number(targetId)
        );
}

async function changeRank(
    ctx,
    target,
    newRank,
    action = "رفع"
) {

    if (!isGroup(ctx)) {
        return;
    }

    const actorLevel =
        getRankLevel(ctx);

    const targetLevel =
        getRankLevel(
            ctx,
            target.id
        );

    const newLevel =
        RANKS[newRank];

    if (newLevel === undefined) {
        return;
    }

    if (
        Number(target.id) ===
        Number(ctx.from.id)
    ) {

        await ctx.reply(
            "• لا يمكنك تغيير رتبتك بنفسك."
        );

        return;
    }

    if (
        targetLevel >=
        actorLevel
    ) {

        await ctx.reply(
            "• لا يمكنك تعديل رتبة مستخدم رتبته مساوية أو أعلى من رتبتك."
        );

        return;
    }

    /*
       صلاحيات إعطاء الرتب
    */

    if (
        newLevel >=
        RANKS["Dev²🎖️"]
    ) {

        if (!isTopDev(ctx)) {

            await ctx.reply(
                "• هذا الأمر يخص ↤ Dev🎖️"
            );

            return;
        }

    } else if (
        newLevel >=
        RANKS["Myth🎖️"]
    ) {

        if (!isDev(ctx)) {

            await ctx.reply(
                "• هذا الأمر يخص ↤ Dev²🎖️"
            );

            return;
        }

    } else if (
        newLevel >=
        RANKS["مالك أساسي"]
    ) {

        if (
            actorLevel <
            RANKS["Myth"]
        ) {

            await ctx.reply(
                "• هذا الأمر يخص ↤ Myth"
            );

            return;
        }

    } else if (
        newLevel >=
        RANKS["مالك"]
    ) {

        if (
            actorLevel <
            RANKS["مالك أساسي"]
        ) {

            await ctx.reply(
                "• هذا الأمر يخص ↤ مالك أساسي"
            );

            return;
        }

    } else if (
        newLevel >=
        RANKS["مميز"]
    ) {

        if (
            actorLevel <
            RANKS["مالك"]
        ) {

            await ctx.reply(
                "• هذا الأمر يخص ↤ مالك"
            );

            return;
        }
    }

    if (
        newLevel >=
        actorLevel
    ) {

        await ctx.reply(
            "• لا يمكنك إعطاء رتبة مساوية أو أعلى من رتبتك."
        );

        return;
    }

    const chat =
        getChat(ctx.chat.id);

    /*
       إزالة أي رتبة مطور قديمة
    */

    removeGlobalDeveloper(
        target.id
    );

    /*
       عضو = إزالة الرتبة
    */

    if (newLevel === 0) {

        delete chat.ranks[
            String(target.id)
        ];

    } else {

        chat.ranks[
            String(target.id)
        ] = newRank;
    }

    /*
       المطورين العالميين
    */

    if (
        newRank === "Dev🎖️"
    ) {

        if (
            !db.developers.dev.includes(
                Number(target.id)
            )
        ) {

            db.developers.dev.push(
                Number(target.id)
            );
        }
    }

    if (
        newRank === "Dev²🎖️"
    ) {

        if (
            !db.developers.dev2.includes(
                Number(target.id)
            )
        ) {

            db.developers.dev2.push(
                Number(target.id)
            );
        }
    }

    saveDB();

    logAction(
        ctx,
        action === "رفع"
            ? "رفع رتبة"
            : "تنزيل رتبة",
        target.id,
        {
            rank: newRank
        }
    );

    await ctx.reply(
        `${mention(target)}\n` +
        `• المستخدم ↤ تم تعديل رتبته\n` +
        `• الرتبة ↤ ${escapeHTML(newRank)}\n` +
        `• تم ${action} الرتبة بنجاح.`,
        htmlOptions()
    );
}

/* =====================================================
   أوامر رفع الرتب
===================================================== */

const PROMOTION_COMMANDS = {

    "رفع مميز": "مميز",
    "رفع مالك": "مالك",
    "رفع مالك اساسي": "مالك أساسي",
    "رفع اساس": "مالك أساسي",

    "رفع M": "Myth",
    "رفع MY": "Myth🎖️",
    "رفع اكس": "Myth🎖️",

    "رفع ديف": "Dev²🎖️",
    "رفع Dev": "Dev²🎖️",

    "رفع مطور ثانوي": "Dev🎖️"
};

/* =====================================================
   أوامر تنزيل الرتب
===================================================== */

const DEMOTION_COMMANDS = {

    "تنزيل مميز": "عضو",
    "تنزيل مالك": "مميز",
    "تنزيل مالك اساسي": "مالك",

    "تنزيل M": "مالك أساسي",
    "تنزيل MY": "Myth",
    "تنزيل اكس": "Myth",

    "تنزيل ديف": "Myth🎖️",
    "تنزيل Dev": "Myth🎖️",

    "تنزيل مطور ثانوي": "Dev²🎖️"
};

function findCommandRank(
    object,
    text
) {

    const normalized =
        normalize(text);

    for (
        const [command, rank]
        of Object.entries(object)
    ) {

        if (
            normalize(command) ===
            normalized
        ) {

            return rank;
        }
    }

    return null;
}

bot.on(
    "text",
    async ctx => {

        if (!isGroup(ctx)) {
            return;
        }

        const text =
            ctx.message.text;

        const promotionRank =
            findCommandRank(
                PROMOTION_COMMANDS,
                text
            );

        const demotionRank =
            findCommandRank(
                DEMOTION_COMMANDS,
                text
            );

        if (
            promotionRank ||
            demotionRank
        ) {

            const target =
                await requireReply(ctx);

            if (!target) {
                return;
            }

            await changeRank(
                ctx,
                target,
                promotionRank ||
                demotionRank,
                promotionRank
                    ? "رفع"
                    : "تنزيل"
            );
        }
    }
);

/* =====================================================
   تنزيل الكل
===================================================== */

bot.hears(
    "تنزيل الكل",
    async ctx => {

        if (!isGroup(ctx)) {
            return;
        }

        const target =
            await requireReply(ctx);

        if (!target) {
            return;
        }

        if (
            !canControlUser(
                ctx,
                target.id
            )
        ) {

            await ctx.reply(
                "• لا يمكنك تنزيل مستخدم رتبته مساوية أو أعلى من رتبتك."
            );

            return;
        }

        if (
            await isCreator(
                ctx,
                target.id
            )
        ) {

            await ctx.reply(
                "• لا يمكنك تنزيل مالك القروب."
            );

            return;
        }

        const chat =
            getChat(ctx.chat.id);

        delete chat.ranks[
            String(target.id)
        ];

        removeGlobalDeveloper(
            target.id
        );

        saveDB();

        await ctx.reply(
            `${mention(target)}\n` +
            `• المستخدم ↤ تم تنزيله\n` +
            `• الرتبة ↤ عضو`,
            htmlOptions()
        );

        logAction(
            ctx,
            "تنزيل الكل",
            target.id
        );
    }
);

/* =====================================================
   الكتم
===================================================== */

const FULL_PERMISSIONS = {

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
};

const MUTE_PERMISSIONS = {

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
};

const RESTRICT_PERMISSIONS = {

    can_send_messages: true,
    can_send_audios: false,
    can_send_documents: false,
    can_send_photos: false,
    can_send_videos: false,
    can_send_video_notes: false,
    can_send_voice_notes: false,
    can_send_polls: false,
    can_send_other_messages: false,
    can_add_web_page_previews: false
};

async function muteUser(
    ctx,
    targetId,
    minutes = null
) {

    const duration =
        minutes ??
        Number(
            getSettings(ctx)
                .muteMinutes || 10
        );

    const until =
        Math.floor(
            Date.now() / 1000
        ) +
        duration * 60;

    try {

        await ctx.telegram.restrictChatMember(
            ctx.chat.id,
            targetId,
            {
                permissions:
                    MUTE_PERMISSIONS,
                until_date: until
            }
        );

        const chat =
            getChat(ctx.chat.id);

        chat.mutedUsers[
            String(targetId)
        ] = {

            until,

            by:
                ctx.from.id,

            createdAt:
                Date.now()
        };

        saveDB();

        return true;

    } catch (error) {

        console.error(
            "Mute error:",
            error.message
        );

        return false;
    }
}

/* =====================================================
   فك الكتم
===================================================== */

async function unmuteUser(
    ctx,
    targetId
) {

    try {

        await ctx.telegram.restrictChatMember(
            ctx.chat.id,
            targetId,
            {
                permissions:
                    FULL_PERMISSIONS
            }
        );

        const chat =
            getChat(ctx.chat.id);

        delete chat.mutedUsers[
            String(targetId)
        ];

        saveDB();

        return true;

    } catch (error) {

        console.error(
            "Unmute error:",
            error.message
        );

        return false;
    }
}

/* =====================================================
   التقييد
===================================================== */

async function restrictUser(
    ctx,
    targetId,
    minutes = null
) {

    const duration =
        minutes ??
        Number(
            getSettings(ctx)
                .restrictMinutes || 10
        );

    const until =
        Math.floor(
            Date.now() / 1000
        ) +
        duration * 60;

    try {

        await ctx.telegram.restrictChatMember(
            ctx.chat.id,
            targetId,
            {
                permissions:
                    RESTRICT_PERMISSIONS,
                until_date: until
            }
        );

        return true;

    } catch (error) {

        console.error(
            "Restrict error:",
            error.message
        );

        return false;
    }
}

/* =====================================================
   إلغاء التقييد
===================================================== */

async function unrestrictUser(
    ctx,
    targetId
) {

    return unmuteUser(
        ctx,
        targetId
    );
}

/* =====================================================
   الحظر
===================================================== */

async function banUser(
    ctx,
    targetId
) {

    try {

        await ctx.telegram.banChatMember(
            ctx.chat.id,
            targetId
        );

        return true;

    } catch (error) {

        console.error(
            "Ban error:",
            error.message
        );

        return false;
    }
}

/* =====================================================
   فك الحظر
===================================================== */

async function unbanUser(
    ctx,
    targetId
) {

    try {

        await ctx.telegram.unbanChatMember(
            ctx.chat.id,
            targetId,
            {
                only_if_banned: true
            }
        );

        return true;

    } catch (error) {

        console.error(
            "Unban error:",
            error.message
        );

        return false;
    }
}

/* =====================================================
   الطرد
===================================================== */

async function kickUser(
    ctx,
    targetId
) {

    try {

        await ctx.telegram.banChatMember(
            ctx.chat.id,
            targetId
        );

        await ctx.telegram.unbanChatMember(
            ctx.chat.id,
            targetId
        );

        return true;

    } catch (error) {

        console.error(
            "Kick error:",
            error.message
        );

        return false;
    }
}

/* =====================================================
   أوامر الإدارة
===================================================== */

const MODERATION_COMMANDS = {

    "كتم": "mute",
    "فك كتم": "unmute",

    "تقييد": "restrict",
    "الغاء التقييد": "unrestrict",

    "حظر": "ban",
    "فك الحظر": "unban",

    "طرد": "kick",

    "تحذير": "warn",
    "الغاء التحذير": "unwarn"
};

bot.on(
    "text",
    async ctx => {

        if (!isGroup(ctx)) {
            return;
        }

        const command =
            normalize(
                ctx.message.text
            );

        let action = null;

        for (
            const [name, value]
            of Object.entries(
                MODERATION_COMMANDS
            )
        ) {

            if (
                normalize(name) ===
                command
            ) {

                action = value;
                break;
            }
        }

        if (!action) {
            return;
        }

        const target =
            await requireReply(ctx);

        if (!target) {
            return;
        }

        if (
            !await canModerateTarget(
                ctx,
                target.id
            )
        ) {

            return;
        }

        let requiredRank =
            "مميز";

        if (
            [
                "restrict",
                "unrestrict"
            ].includes(action)
        ) {

            requiredRank =
                "Dev²🎖️";
        }

        if (
            [
                "ban",
                "unban",
                "kick",
                "warn",
                "unwarn"
            ].includes(action)
        ) {

            requiredRank =
                "Myth";
        }

        if (
            !await requireRank(
                ctx,
                requiredRank
            )
        ) {

            return;
        }

        let success = false;

        if (
            action === "mute"
        ) {

            success =
                await muteUser(
                    ctx,
                    target.id
                );
        }

        if (
            action === "unmute"
        ) {

            success =
                await unmuteUser(
                    ctx,
                    target.id
                );
        }

        if (
            action === "restrict"
        ) {

            success =
                await restrictUser(
                    ctx,
                    target.id
                );
        }

        if (
            action === "unrestrict"
        ) {

            success =
                await unrestrictUser(
                    ctx,
                    target.id
                );
        }

        if (
            action === "ban"
        ) {

            success =
                await banUser(
                    ctx,
                    target.id
                );
        }

        if (
            action === "unban"
        ) {

            success =
                await unbanUser(
                    ctx,
                    target.id
                );
        }

        if (
            action === "kick"
        ) {

            success =
                await kickUser(
                    ctx,
                    target.id
                );
        }

        if (
            action === "warn"
        ) {

            const data =
                getViolationData(
                    ctx.chat.id,
                    target.id
                );

            data.count++;

            data.history.push({

                type:
                    "تحذير يدوي",

                by:
                    ctx.from.id,

                time:
                    Date.now()
            });

            saveDB();

            success = true;
        }

        if (
            action === "unwarn"
        ) {

            const data =
                getViolationData(
                    ctx.chat.id,
                    target.id
                );

            data.count = 0;
            data.history = [];

            saveDB();

            success = true;
        }

        if (!success) {

            await ctx.reply(
                "• تعذر تنفيذ الأمر، تأكد من أن البوت مشرف ويملك الصلاحيات المطلوبة."
            );

            return;
        }

        logAction(
            ctx,
            command,
            target.id
        );

        let resultText =
            "• تم تنفيذ الأمر بنجاح.";

        if (action === "mute") {
            resultText =
                `• تم كتم المستخدم لمدة ${getSettings(ctx).muteMinutes} دقيقة.`;
        }

        if (action === "unmute") {
            resultText =
                "• تم فك الكتم.";
        }

        if (action === "restrict") {
            resultText =
                `• تم تقييد المستخدم لمدة ${getSettings(ctx).restrictMinutes} دقيقة.`;
        }

        if (action === "unrestrict") {
            resultText =
                "• تم إلغاء التقييد.";
        }

        if (action === "ban") {
            resultText =
                "• تم حظر المستخدم.";
        }

        if (action === "unban") {
            resultText =
                "• تم فك الحظر.";
        }

        if (action === "kick") {
            resultText =
                "• تم طرد المستخدم.";
        }

        if (action === "warn") {
            resultText =
                `• تم تحذير المستخدم.\n• عدد التحذيرات ↤ ${getViolationData(ctx.chat.id, target.id).count}`;
        }

        if (action === "unwarn") {
            resultText =
                "• تم إلغاء جميع التحذيرات.";
        }

        await ctx.reply(
            `${mention(target)}\n${resultText}`,
            htmlOptions()
        );
    }
);

/* =====================================================
   مسح المكتومين
   مم = عادي
===================================================== */

async function clearMutedUsers(ctx) {

    const chat =
        getChat(ctx.chat.id);

    const ids =
        Object.keys(
            chat.mutedUsers
        );

    if (!ids.length) {

        await ctx.reply(
            "• لا يوجد مكتومين."
        );

        return;
    }

    let success = 0;

    for (const id of ids) {

        const result =
            await unmuteUser(
                ctx,
                Number(id)
            );

        if (result) {
            success++;
        }
    }

    chat.mutedUsers = {};

    saveDB();

    await ctx.reply(
        `• تم مسح المكتومين\n• العدد ↤ ${success}`
    );
}

bot.hears(
    ["مم", "مسح المكتومين"],
    async ctx => {

        if (!isGroup(ctx)) {
            return;
        }

        if (
            !await requireRank(
                ctx,
                "Myth"
            )
        ) {
            return;
        }

        await clearMutedUsers(ctx);
    }
);

/* =====================================================
   الكتم العام
   خخ
===================================================== */

bot.hears(
    ["خخ", "مسح المكتومين عام"],
    async ctx => {

        if (!isGroup(ctx)) {
            return;
        }

        if (
            !await requireRank(
                ctx,
                "Myth🎖️"
            )
        ) {
            return;
        }

        const chat =
            getChat(ctx.chat.id);

        const ids =
            Object.keys(
                chat.globalMutedUsers
            );

        if (!ids.length) {

            await ctx.reply(
                "• لا يوجد مكتومين عام."
            );

            return;
        }

        let success = 0;

        for (const id of ids) {

            const result =
                await unmuteUser(
                    ctx,
                    Number(id)
                );

            if (result) {
                success++;
            }
        }

        chat.globalMutedUsers = {};

        saveDB();

        await ctx.reply(
            `• تم مسح المكتومين عام\n• العدد ↤ ${success}`
        );
    }
);

/* =====================================================
   كتم عام
===================================================== */

bot.hears(
    "كتم عام",
    async ctx => {

        if (!isGroup(ctx)) {
            return;
        }

        if (
            !await requireRank(
                ctx,
                "Myth🎖️"
            )
        ) {
            return;
        }

        const chat =
            getChat(ctx.chat.id);

        chat.settings.globalMute =
            true;

        saveDB();

        await ctx.reply(
            "• تم تفعيل الكتم العام."
        );
    }
);

bot.hears(
    "فك الكتم العام",
    async ctx => {

        if (!isGroup(ctx)) {
            return;
        }

        if (
            !await requireRank(
                ctx,
                "Myth🎖️"
            )
        ) {
            return;
        }

        const chat =
            getChat(ctx.chat.id);

        chat.settings.globalMute =
            false;

        saveDB();

        await ctx.reply(
            "• تم إلغاء الكتم العام."
        );
    }
);

/* =====================================================
   رفع مشرف
===================================================== */

const ADMIN_PERMISSIONS = {

    can_change_info: false,
    can_post_messages: false,
    can_edit_messages: false,
    can_delete_messages: false,
    can_invite_users: false,
    can_restrict_members: false,
    can_pin_messages: false,
    can_promote_members: false,
    can_manage_video_chats: false,
    can_manage_topics: false,
    can_manage_stories: false,
    can_post_stories: false,
    can_edit_stories: false,
    can_delete_stories: false
};

const ADMIN_PERMISSION_NAMES = {

    can_delete_messages:
        "حذف الرسائل",

    can_pin_messages:
        "تثبيت الرسائل",

    can_restrict_members:
        "حظر المستخدمين",

    can_invite_users:
        "دعوة المستخدمين",

    can_promote_members:
        "إضافة مشرفين",

    can_change_info:
        "تغيير معلومات المجموعة",

    can_manage_video_chats:
        "إدارة المكالمات",

    can_manage_topics:
        "إدارة المواضيع",

    can_manage_stories:
        "إدارة القصص"
};

function getPromotionData(
    chatId,
    userId
) {

    const key =
        `${chatId}:${userId}`;

    db.adminPromotions[key] ||=
        clone(ADMIN_PERMISSIONS);

    return db.adminPromotions[key];
}

function promotionKey(
    chatId,
    userId
) {

    return `${chatId}:${userId}`;
}

async function showPromotionPanel(
    ctx,
    target
) {

    const permissions =
        getPromotionData(
            ctx.chat.id,
            target.id
        );

    let text =
        `• صلاحيات المستخدم\n` +
        `━━━━━━━━━━━━━━\n` +
        `• المستخدم ↤ ${escapeHTML(
            target.first_name ||
            target.username ||
            "مستخدم"
        )}\n\n`;

    for (
        const [key, name]
        of Object.entries(
            ADMIN_PERMISSION_NAMES
        )
    ) {

        text +=
            `• ${name} ↤ ` +
            `${permissions[key] ? "نعم" : "لا"}\n`;
    }

    text +=
        "\n• اختر تعديل الصلاحيات من الزر بالأسفل.";

    await ctx.reply(
        text,
        htmlOptions({
            reply_markup:
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback(
                            "تعديل الصلاحيات",
                            `admin_edit:${target.id}`
                        )
                    ],
                    [
                        Markup.button.callback(
                            "إخفاء الأمر",
                            `admin_hide:${target.id}`
                        )
                    ]
                ]).reply_markup
        })
    );
}

bot.hears(
    ["رفع مشرف", "ترقيه"],
    async ctx => {

        if (!isGroup(ctx)) {
            return;
        }

        const target =
            await requireReply(ctx);

        if (!target) {
            return;
        }

        if (
            !await requireRank(
                ctx,
                "مالك"
            )
        ) {
            return;
        }

        if (
            Number(target.id) ===
            Number(ctx.from.id)
        ) {

            await ctx.reply(
                "• لا يمكنك رفع نفسك مشرف."
            );

            return;
        }

        if (
            !canControlUser(
                ctx,
                target.id
            )
        ) {

            await ctx.reply(
                "• لا يمكنك تعديل صلاحيات مستخدم رتبته مساوية أو أعلى من رتبتك."
            );

            return;
        }

        const targetMember =
            await getMember(
                ctx,
                target.id
            );

        if (
            targetMember?.status ===
            "creator"
        ) {

            await ctx.reply(
                "• هذا المستخدم مالك القروب."
            );

            return;
        }

        if (
            targetMember?.status ===
            "administrator"
        ) {

            await ctx.reply(
                "• المستخدم مشرف بالفعل."
            );

            return;
        }

        await showPromotionPanel(
            ctx,
            target
        );
    }
);

/* =====================================================
   تعديل الصلاحيات
===================================================== */

function promotionButtons(
    targetId
) {

    const permissions =
        getPromotionData(
            "pending",
            targetId
        );

    return permissions;
}

function buildPermissionKeyboard(
    chatId,
    targetId
) {

    const permissions =
        getPromotionData(
            chatId,
            targetId
        );

    const buttons = [];

    for (
        const [key, name]
        of Object.entries(
            ADMIN_PERMISSION_NAMES
        )
    ) {

        buttons.push([
            Markup.button.callback(
                `${permissions[key] ? "✓" : "×"} ${name}`,
                `admin_toggle:${targetId}:${key}`
            )
        ]);
    }

    buttons.push([
        Markup.button.callback(
            "حفظ الصلاحيات",
            `admin_save:${targetId}`
        )
    ]);

    buttons.push([
        Markup.button.callback(
            "إخفاء الأمر",
            `admin_hide:${targetId}`
        )
    ]);

    return Markup.inlineKeyboard(
        buttons
    ).reply_markup;
}

bot.action(
    /^admin_edit:(\d+)$/,
    async ctx => {

        const targetId =
            Number(ctx.match[1]);

        if (
            !isGroup(ctx)
        ) {

            await ctx.answerCbQuery();
            return;
        }

        if (
            !hasRank(
                ctx,
                "مالك"
            )
        ) {

            await ctx.answerCbQuery(
                "ليس لديك الصلاحية"
            );

            return;
        }

        await ctx.answerCbQuery();

        await ctx.editMessageReplyMarkup(
            buildPermissionKeyboard(
                ctx.chat.id,
                targetId
            )
        );
    }
);

/* =====================================================
   تشغيل وإيقاف الصلاحيات
===================================================== */

bot.action(
    /^admin_toggle:(\d+):(.+)$/,
    async ctx => {

        const targetId =
            Number(ctx.match[1]);

        const permission =
            ctx.match[2];

        if (
            !ADMIN_PERMISSION_NAMES[
                permission
            ]
        ) {

            await ctx.answerCbQuery();
            return;
        }

        if (
            !hasRank(
                ctx,
                "مالك"
            )
        ) {

            await ctx.answerCbQuery(
                "ليس لديك الصلاحية"
            );

            return;
        }

        const data =
            getPromotionData(
                ctx.chat.id,
                targetId
            );

        data[permission] =
            !data[permission];

        saveDB();

        await ctx.answerCbQuery(
            data[permission]
                ? "تم التفعيل"
                : "تم الإيقاف"
        );

        await ctx.editMessageReplyMarkup(
            buildPermissionKeyboard(
                ctx.chat.id,
                targetId
            )
        );
    }
);

/* =====================================================
   حفظ صلاحيات المشرف
===================================================== */

bot.action(
    /^admin_save:(\d+)$/,
    async ctx => {

        const targetId =
            Number(ctx.match[1]);

        if (
            !hasRank(
                ctx,
                "مالك"
            )
        ) {

            await ctx.answerCbQuery(
                "ليس لديك الصلاحية"
            );

            return;
        }

        if (
            !canControlUser(
                ctx,
                targetId
            )
        ) {

            await ctx.answerCbQuery(
                "لا يمكنك تعديل هذا المستخدم"
            );

            return;
        }

        const member =
            await getMember(
                ctx,
                targetId
            );

        if (
            member?.status ===
            "creator"
        ) {

            await ctx.answerCbQuery(
                "لا يمكن تعديل مالك القروب"
            );

            return;
        }

        const permissions =
            getPromotionData(
                ctx.chat.id,
                targetId
            );

        try {

            await ctx.telegram.promoteChatMember(
                ctx.chat.id,
                targetId,
                permissions
            );

            saveDB();

            logAction(
                ctx,
                "رفع مشرف",
                targetId,
                {
                    permissions
                }
            );

            await ctx.answerCbQuery(
                "تم حفظ الصلاحيات"
            );

            await ctx.editMessageText(
                `• صلاحيات المستخدم\n` +
                `━━━━━━━━━━━━━━\n` +
                `• المستخدم ↤ ${mentionById(
                    targetId
                )}\n` +
                `• تم رفعه مشرف بنجاح.`,
                htmlOptions({
                    reply_markup:
                        Markup.inlineKeyboard([
                            [
                                Markup.button.callback(
                                    "إخفاء الأمر",
                                    `admin_hide:${targetId}`
                                )
                            ]
                        ]).reply_markup
                })
            );

        } catch (error) {

            console.error(
                "Promotion error:",
                error.message
            );

            await ctx.answerCbQuery(
                "تعذر رفع المشرف"
            );

            await ctx.reply(
                "• تعذر رفع المستخدم مشرف.\n• تأكد أن البوت مشرف ويملك صلاحية إضافة المشرفين."
            );
        }
    }
);

/* =====================================================
   إخفاء أمر المشرف
===================================================== */

bot.action(
    /^admin_hide:(\d+)$/,
    async ctx => {

        try {

            await ctx.deleteMessage();

        } catch {

            try {

                await ctx.editMessageText(
                    "• تم إخفاء الأمر."
                );

            } catch {}
        }

        await ctx.answerCbQuery();
    }
);

// ======================================================
// TORAYF BOT - PART 4
// الألعاب + التسلية + الفعاليات
// ======================================================
// ======================================================
// تهيئة بيانات الألعاب
// ======================================================
function getGameData(chatId) {
    const chat =
        getChat(chatId);
    if (!chat.activeGames) {
        chat.activeGames = {};
    }
    return chat.activeGames;
}
// ======================================================
// قائمة الألعاب
// ======================================================
bot.hears(
    [
        "الألعاب",
        "العاب",
        "لعب",
        "قائمة الألعاب"
    ],
    async ctx => {
        if (!isGroup(ctx)) return;
        await ctx.reply(
            "• قسم الألعاب\n" +
            "━━━━━━━━━━━━━━\n" +
            "• XO\n" +
            "• تخمين الرقم\n" +
            "• حجر ورقة مقص\n" +
            "• أسرع إجابة\n" +
            "• سؤال وجواب\n" +
            "• تحدي عضو\n" +
            "• النقاط\n" +
            "• المتصدرين\n" +
            "━━━━━━━━━━━━━━\n" +
            "• اكتب اسم اللعبة لبدئها.",
            replyOptions()
        );
    }
);
// ======================================================
// النقاط
// ======================================================
function getGamePoints(
    chatId,
    userId
) {
    const chat =
        getChat(chatId);
    if (!chat.stats) {
        chat.stats = {};
    }
    if (!chat.stats[String(userId)]) {
        chat.stats[String(userId)] = {};
    }
    if (
        typeof chat.stats[String(userId)].gamePoints
        !== "number"
    ) {
        chat.stats[String(userId)].gamePoints = 0;
    }
    return chat.stats[String(userId)];
}
function addGamePoints(
    chatId,
    userId,
    amount
) {
    const data =
        getGamePoints(
            chatId,
            userId
        );
    data.gamePoints +=
        Number(amount || 0);
    saveDB();
}
// ======================================================
// نقاطي
// ======================================================
bot.hears(
    [
        "نقاطي",
        "نقاطي الألعاب"
    ],
    async ctx => {
        if (!isGroup(ctx)) return;
        const data =
            getGamePoints(
                ctx.chat.id,
                ctx.from.id
            );
        await ctx.reply(
            `• نقاطك في الألعاب ↤ ${data.gamePoints}`,
            replyOptions()
        );
    }
);
// ======================================================
// المتصدرين
// ======================================================
bot.hears(
    [
        "المتصدرين",
        "متصدرين",
        "ترتيب الألعاب"
    ],
    async ctx => {
        if (!isGroup(ctx)) return;
        const chat =
            getChat(ctx.chat.id);
        const users =
            Object.entries(
                chat.stats || {}
            )
            .map(
                ([id, data]) => ({
                    id: Number(id),
                    points:
                        Number(
                            data.gamePoints || 0
                        )
                })
            )
            .filter(
                user =>
                    user.points > 0
            )
            .sort(
                (a, b) =>
                    b.points - a.points
            )
            .slice(0, 10);
        if (!users.length) {
            await ctx.reply(
                "• لا توجد نقاط حتى الآن."
            );
            return;
        }
        let text =
            "• متصدرو الألعاب\n" +
            "━━━━━━━━━━━━━━\n";
        users.forEach(
            (user, index) => {
                const member =
                    getUser(user.id);
                text +=
                    `${index + 1} - ` +
                    `${mentionById(
                        user.id,
                        member?.first_name ||
                        member?.username ||
                        "مستخدم"
                    )}` +
                    ` ↤ ${user.points} نقطة\n`;
            }
        );
        await ctx.reply(
            text,
            replyOptions()
        );
    }
);
// ======================================================
// حجر - ورقة - مقص
// ======================================================
bot.hears(
    [
        "حجر ورقة مقص",
        "حجر ورق مقص"
    ],
    async ctx => {
        if (!isGroup(ctx)) return;
        const choices = [
            "حجر",
            "ورقة",
            "مقص"
        ];
        const botChoice =
            choices[
                Math.floor(
                    Math.random() *
                    choices.length
                )
            ];
        await ctx.reply(
            "• اختر:\n" +
            "━━━━━━━━━━━━━━\n" +
            "• حجر\n" +
            "• ورقة\n" +
            "• مقص\n\n" +
            "• أرسل اختيارك.",
            replyOptions()
        );
        const chat =
            getChat(ctx.chat.id);
        chat.pendingRPS ||=
            {};
        chat.pendingRPS[
            String(ctx.from.id)
        ] = {
            botChoice,
            createdAt: Date.now()
        };
        saveDB();
    }
);
// ======================================================
// معالجة حجر ورقة مقص
// ======================================================
bot.on(
    "text",
    async ctx => {
        if (!isGroup(ctx)) return;
        const chat =
            getChat(ctx.chat.id);
        if (!chat.pendingRPS) return;
        const key =
            String(ctx.from.id);
        const game =
            chat.pendingRPS[key];
        if (!game) return;
        const choice =
            normalize(
                ctx.message.text
            );
        const choices = [
            "حجر",
            "ورقة",
            "مقص"
        ];
        const selected =
            choices.find(
                x =>
                    normalize(x) ===
                    choice
            );
        if (!selected) return;
        const botChoice =
            game.botChoice;
        let result;
        if (
            selected === botChoice
        ) {
            result =
                "• تعادل.";
        }
        else if (
            (
                selected === "حجر" &&
                botChoice === "مقص"
            ) ||
            (
                selected === "ورقة" &&
                botChoice === "حجر"
            ) ||
            (
                selected === "مقص" &&
                botChoice === "ورقة"
            )
        ) {
            result =
                "• فزت وحصلت على 5 نقاط.";
            addGamePoints(
                ctx.chat.id,
                ctx.from.id,
                5
            );
        }
        else {
            result =
                "• خسرت هذه الجولة.";
        }
        delete chat.pendingRPS[key];
        saveDB();
        await ctx.reply(
            `• اختيارك ↤ ${selected}\n` +
            `• اختيار البوت ↤ ${botChoice}\n` +
            `${result}`,
            replyOptions()
        );
    }
);
// ======================================================
// تخمين الرقم
// ======================================================
bot.hears(
    [
        "تخمين الرقم",
        "خمن الرقم"
    ],
    async ctx => {
        if (!isGroup(ctx)) return;
        const number =
            Math.floor(
                Math.random() * 10
            ) + 1;
        const chat =
            getChat(ctx.chat.id);
        chat.numberGames ||=
            {};
        chat.numberGames[
            String(ctx.from.id)
        ] = {
            number,
            attempts: 0,
            createdAt: Date.now()
        };
        saveDB();
        await ctx.reply(
            "• لعبة تخمين الرقم\n" +
            "━━━━━━━━━━━━━━\n" +
            "• خمن رقمًا من 1 إلى 10."
        );
    }
);
// ======================================================
// معالجة تخمين الرقم
// ======================================================
bot.on(
    "text",
    async ctx => {
        if (!isGroup(ctx)) return;
        const chat =
            getChat(ctx.chat.id);
        const games =
            chat.numberGames || {};
        const game =
            games[
                String(ctx.from.id)
            ];
        if (!game) return;
        const guess =
            Number(
                ctx.message.text
            );
        if (
            !Number.isInteger(guess) ||
            guess < 1 ||
            guess > 10
        ) {
            return;
        }
        game.attempts++;
        if (
            guess === game.number
        ) {
            const points =
                Math.max(
                    2,
                    10 - game.attempts
                );
            addGamePoints(
                ctx.chat.id,
                ctx.from.id,
                points
            );
            delete games[
                String(ctx.from.id)
            ];
            saveDB();
            await ctx.reply(
                `• إجابة صحيحة.\n` +
                `• عدد المحاولات ↤ ${game.attempts}\n` +
                `• النقاط ↤ ${points}`
            );
            return;
        }
        if (
            game.attempts >= 5
        ) {
            const answer =
                game.number;
            delete games[
                String(ctx.from.id)
            ];
            saveDB();
            await ctx.reply(
                `• انتهت المحاولات.\n` +
                `• الرقم الصحيح ↤ ${answer}`
            );
            return;
        }
        await ctx.reply(
            guess < game.number
                ? "• الرقم أكبر."
                : "• الرقم أصغر."
        );
    }
);
// ======================================================
// إلغاء اللعبة
// ======================================================
bot.hears(
    [
        "الغاء اللعبة",
        "إلغاء اللعبة",
        "وقف اللعبة"
    ],
    async ctx => {
        if (!isGroup(ctx)) return;
        const chat =
            getChat(ctx.chat.id);
        const id =
            String(ctx.from.id);
        let cancelled = false;
        if (
            chat.numberGames?.[id]
        ) {
            delete chat.numberGames[id];
            cancelled = true;
        }
        if (
            chat.pendingRPS?.[id]
        ) {
            delete chat.pendingRPS[id];
            cancelled = true;
        }
        saveDB();
        await ctx.reply(
            cancelled
                ? "• تم إلغاء اللعبة."
                : "• لا توجد لديك لعبة نشطة."
        );
    }
);
// ======================================================
// تحدي عضو
// ======================================================
bot.hears(
    [
        "تحدي",
        "تحدي عضو"
    ],
    async ctx => {
        if (!isGroup(ctx)) return;
        const target =
            await requireReply(ctx);
        if (!target) {
            await ctx.reply(
                "• قم بالرد على رسالة العضو الذي تريد تحديه."
            );
            return;
        }
        if (
            target.id ===
            ctx.from.id
        ) {
            await ctx.reply(
                "• لا يمكنك تحدي نفسك."
            );
            return;
        }
        const chat =
            getChat(ctx.chat.id);
        chat.challenges ||=
            {};
        const challengeId =
            `${ctx.from.id}_${target.id}_${Date.now()}`;
        chat.challenges[
            challengeId
        ] = {
            from:
                ctx.from.id,
            target:
                target.id,
            createdAt:
                Date.now(),
            status:
                "pending"
        };
        saveDB();
        await ctx.reply(
            `${mention(target)}\n` +
            "• تم تحديك.\n" +
            "• اكتب «قبول التحدي» للبدء.",
            replyOptions()
        );
    }
);
// ======================================================
// قبول التحدي
// ======================================================
bot.hears(
    [
        "قبول التحدي"
    ],
    async ctx => {
        if (!isGroup(ctx)) return;
        const chat =
            getChat(ctx.chat.id);
        const challenges =
            chat.challenges || {};
        const challenge =
            Object.values(
                challenges
            )
            .find(
                item =>
                    item.target ===
                    ctx.from.id &&
                    item.status ===
                    "pending"
            );
        if (!challenge) {
            await ctx.reply(
                "• لا يوجد تحدي موجه إليك."
            );
            return;
        }
        challenge.status =
            "active";
        challenge.startedAt =
            Date.now();
        saveDB();
        await ctx.reply(
            "• تم قبول التحدي.\n" +
            "• اكتب «لعب» لبدء الجولة."
        );
    }
);
// ======================================================
// إلغاء التحديات القديمة
// ======================================================
function cleanOldChallenges(
    chat
) {
    if (!chat.challenges) {
        return;
    }
    const now =
        Date.now();
    for (
        const [key, challenge]
        of Object.entries(
            chat.challenges
        )
    ) {
        if (
            now -
            Number(
                challenge.createdAt || 0
            ) >
            10 * 60 * 1000
        ) {
            delete chat.challenges[key];
        }
    }
}
// ======================================================
// الفعاليات
// ======================================================
const EVENTS = [
    {
        name: "أسرع إجابة",
        questions: [
            "ما هو أكبر كوكب في المجموعة الشمسية؟",
            "كم عدد أيام الأسبوع؟",
            "ما عاصمة المملكة العربية السعودية؟",
            "كم عدد أضلاع المثلث؟"
        ]
    },
    {
        name: "لغز",
        questions: [
            "شيء يمشي بلا رجلين ويبكي بلا عينين، ما هو؟",
            "ما الشيء الذي له أسنان ولا يعض؟",
            "ما الشيء الذي كلما أخذت منه كبر؟"
        ]
    }
];
// ======================================================
// قائمة الفعاليات
// ======================================================
bot.hears(
    [
        "الفعاليات",
        "فعاليات"
    ],
    async ctx => {
        if (!isGroup(ctx)) return;
        await ctx.reply(
            "• قسم الفعاليات\n" +
            "━━━━━━━━━━━━━━\n" +
            "• أسرع إجابة\n" +
            "• لغز\n" +
            "• فعالية عشوائية\n\n" +
            "• لبدء فعالية اكتب:\n" +
            "«ابدأ فعالية»"
        );
    }
);
// ======================================================
// بدء فعالية عشوائية
// ======================================================
bot.hears(
    [
        "ابدأ فعالية",
        "فعالية"
    ],
    async ctx => {
        if (!isGroup(ctx)) return;
        const chat =
            getChat(ctx.chat.id);
        if (
            chat.activeEvent
        ) {
            await ctx.reply(
                "• توجد فعالية نشطة بالفعل."
            );
            return;
        }
        const event =
            EVENTS[
                Math.floor(
                    Math.random() *
                    EVENTS.length
                )
            ];
        const question =
            event.questions[
                Math.floor(
                    Math.random() *
                    event.questions.length
                )
            ];
        chat.activeEvent = {
            name:
                event.name,
            question,
            startedBy:
                ctx.from.id,
            createdAt:
                Date.now()
        };
        saveDB();
        await ctx.reply(
            "• بدأت الفعالية\n" +
            "━━━━━━━━━━━━━━\n" +
            `• النوع ↤ ${event.name}\n` +
            `• السؤال ↤ ${question}\n\n` +
            "• أول إجابة صحيحة تحصل على 10 نقاط."
        );
    }
);
// ======================================================
// إنهاء الفعالية
// ======================================================
bot.hears(
    [
        "انهاء الفعالية",
        "إنهاء الفعالية"
    ],
    async ctx => {
        if (!isGroup(ctx)) return;
        const chat =
            getChat(ctx.chat.id);
        if (
            !chat.activeEvent
        ) {
            await ctx.reply(
                "• لا توجد فعالية نشطة."
            );
            return;
        }
        delete chat.activeEvent;
        saveDB();
        await ctx.reply(
            "• تم إنهاء الفعالية."
        );
    }
);
// ======================================================
// فحص إجابات الفعالية
// ======================================================
function normalizeAnswer(
    text
) {
    return normalize(
        String(text || "")
            .replace(
                /[؟?!.,،]/g,
                ""
            )
            .trim()
    );
}
const EVENT_ANSWERS = {
    "ما هو أكبر كوكب في المجموعة الشمسية؟":
        [
            "المشتري"
        ],
    "كم عدد أيام الأسبوع؟":
        [
            "7",
            "سبعة"
        ],
    "ما عاصمة المملكة العربية السعودية؟":
        [
            "الرياض"
        ],
    "كم عدد أضلاع المثلث؟":
        [
            "3",
            "ثلاثة"
        ],
    "شيء يمشي بلا رجلين ويبكي بلا عينين، ما هو؟":
        [
            "السحاب",
            "السحاب"
        ],
    "ما الشيء الذي له أسنان ولا يعض؟":
        [
            "المشط"
        ],
    "ما الشيء الذي كلما أخذت منه كبر؟":
        [
            "الحفرة"
        ]
};
// ======================================================
// استقبال إجابة الفعالية
// ======================================================
bot.on(
    "text",
    async ctx => {
        if (!isGroup(ctx)) return;
        const chat =
            getChat(ctx.chat.id);
        const event =
            chat.activeEvent;
        if (!event) return;
        const answers =
            EVENT_ANSWERS[
                event.question
            ] || [];
        const userAnswer =
            normalizeAnswer(
                ctx.message.text
            );
        const correct =
            answers.some(
                answer =>
                    normalizeAnswer(
                        answer
                    ) ===
                    userAnswer
            );
        if (!correct) return;
        addGamePoints(
            ctx.chat.id,
            ctx.from.id,
            10
        );
        delete chat.activeEvent;
        saveDB();
        await ctx.reply(
            `${mention({
                id: ctx.from.id,
                first_name:
                    ctx.from.first_name,
                username:
                    ctx.from.username
            })}\n` +
            "• إجابة صحيحة.\n" +
            "• حصلت على 10 نقاط."
        );
    }
);
// ======================================================
// تنظيف البيانات القديمة
// ======================================================
bot.use(
    async (ctx, next) => {
        try {
            if (
                isGroup(ctx)
            ) {
                const chat =
                    getChat(
                        ctx.chat.id
                    );
                cleanOldChallenges(
                    chat
                );
                if (
                    chat.activeEvent &&
                    Date.now() -
                    Number(
                        chat.activeEvent.createdAt ||
                        0
                    ) >
                    10 * 60 * 1000
                ) {
                    delete chat.activeEvent;
                    saveDB();
                }
            }
        } catch (error) {
            console.error(
                "Games cleanup error:",
                error.message
            );
        }
        return next();
    }
);
// ======================================================
// TORAYF BOT - PART 5
// البنك + الاقتصاد + الرصيد + التحويلات
// ======================================================
// ======================================================
// تهيئة بيانات البنك
// ======================================================
function getBankData(
    chatId,
    userId
) {
    const chat =
        getChat(chatId);
    if (!chat.bank) {
        chat.bank = {};
    }
    const id =
        String(userId);
    if (!chat.bank[id]) {
        chat.bank[id] = {
            balance: 0,
            bank: 0,
            totalEarned: 0,
            totalTransferred: 0,
            createdAt: Date.now()
        };
    }
    return chat.bank[id];
}
// ======================================================
// التأكد من تفعيل البنك
// ======================================================
function isBankEnabled(ctx) {
    const settings =
        getSettings(ctx);
    return settings.bank !== false;
}
// ======================================================
// الحصول على الرصيد
// ======================================================
function getBalance(
    chatId,
    userId
) {
    return getBankData(
        chatId,
        userId
    ).balance;
}
// ======================================================
// إضافة مبلغ
// ======================================================
function addMoney(
    chatId,
    userId,
    amount
) {
    const data =
        getBankData(
            chatId,
            userId
        );
    const value =
        Number(amount);
    if (
        !Number.isFinite(value) ||
        value <= 0
    ) {
        return false;
    }
    data.balance += value;
    data.totalEarned += value;
    saveDB();
    return true;
}
// ======================================================
// خصم مبلغ
// ======================================================
function removeMoney(
    chatId,
    userId,
    amount
) {
    const data =
        getBankData(
            chatId,
            userId
        );
    const value =
        Number(amount);
    if (
        !Number.isFinite(value) ||
        value <= 0
    ) {
        return false;
    }
    if (
        data.balance < value
    ) {
        return false;
    }
    data.balance -= value;
    saveDB();
    return true;
}
// ======================================================
// فلوسي
// ======================================================
bot.hears(
    [
        "فلوسي",
        "رصيدي",
        "رصيد",
        "حسابي"
    ],
    async ctx => {
        if (!isGroup(ctx)) return;
        if (!isBankEnabled(ctx)) {
            await ctx.reply(
                "• البنك غير مفعل في هذه المجموعة."
            );
            return;
        }
        const data =
            getBankData(
                ctx.chat.id,
                ctx.from.id
            );
        await ctx.reply(
            "• حسابك البنكي\n" +
            "━━━━━━━━━━━━━━\n" +
            `• الرصيد ↤ ${data.balance}\n` +
            `• البنك ↤ ${data.bank}`,
            replyOptions()
        );
    }
);
// ======================================================
// البنك
// ======================================================
bot.hears(
    [
        "البنك",
        "رصيد البنك"
    ],
    async ctx => {
        if (!isGroup(ctx)) return;
        if (!isBankEnabled(ctx)) {
            await ctx.reply(
                "• البنك غير مفعل في هذه المجموعة."
            );
            return;
        }
        const data =
            getBankData(
                ctx.chat.id,
                ctx.from.id
            );
        await ctx.reply(
            "• البنك\n" +
            "━━━━━━━━━━━━━━\n" +
            `• الرصيد الموجود معك ↤ ${data.balance}\n` +
            `• المبلغ المودع ↤ ${data.bank}`,
            replyOptions()
        );
    }
);
// ======================================================
// إيداع
// ======================================================
bot.hears(
    /^ايداع\s+(\d+)$/i,
    async ctx => {
        if (!isGroup(ctx)) return;
        if (!isBankEnabled(ctx)) {
            await ctx.reply(
                "• البنك غير مفعل."
            );
            return;
        }
        const amount =
            Number(
                ctx.match[1]
            );
        const data =
            getBankData(
                ctx.chat.id,
                ctx.from.id
            );
        if (
            data.balance < amount
        ) {
            await ctx.reply(
                "• لا تملك رصيدًا كافيًا."
            );
            return;
        }
        data.balance -= amount;
        data.bank += amount;
        saveDB();
        await ctx.reply(
            `• تم إيداع ${amount} بنجاح.\n` +
            `• رصيدك الحالي ↤ ${data.balance}`
        );
    }
);
// ======================================================
// سحب
// ======================================================
bot.hears(
    /^سحب\s+(\d+)$/i,
    async ctx => {
        if (!isGroup(ctx)) return;
        if (!isBankEnabled(ctx)) {
            await ctx.reply(
                "• البنك غير مفعل."
            );
            return;
        }
        const amount =
            Number(
                ctx.match[1]
            );
        const data =
            getBankData(
                ctx.chat.id,
                ctx.from.id
            );
        if (
            data.bank < amount
        ) {
            await ctx.reply(
                "• لا تملك هذا المبلغ في البنك."
            );
            return;
        }
        data.bank -= amount;
        data.balance += amount;
        saveDB();
        await ctx.reply(
            `• تم سحب ${amount} بنجاح.\n` +
            `• رصيدك الحالي ↤ ${data.balance}`
        );
    }
);
// ======================================================
// تحويل
// ======================================================
bot.hears(
    /^تحويل\s+(\d+)$/i,
    async ctx => {
        if (!isGroup(ctx)) return;
        if (!isBankEnabled(ctx)) {
            await ctx.reply(
                "• البنك غير مفعل."
            );
            return;
        }
        const target =
            await requireReply(ctx);
        if (!target) {
            await ctx.reply(
                "• قم بالرد على رسالة العضو الذي تريد التحويل له."
            );
            return;
        }
        if (
            target.id ===
            ctx.from.id
        ) {
            await ctx.reply(
                "• لا يمكنك التحويل لنفسك."
            );
            return;
        }
        const amount =
            Number(
                ctx.match[1]
            );
        if (
            amount <= 0
        ) {
            return;
        }
        const sender =
            getBankData(
                ctx.chat.id,
                ctx.from.id
            );
        if (
            sender.balance < amount
        ) {
            await ctx.reply(
                "• رصيدك غير كافي."
            );
            return;
        }
        const receiver =
            getBankData(
                ctx.chat.id,
                target.id
            );
        sender.balance -= amount;
        receiver.balance += amount;
        sender.totalTransferred =
            Number(
                sender.totalTransferred || 0
            ) + amount;
        saveDB();
        await ctx.reply(
            `${mention(target)}\n` +
            `• تم تحويل ↤ ${amount}\n` +
            `• رصيدك الحالي ↤ ${sender.balance}`,
            replyOptions()
        );
        logAction(
            ctx,
            "تحويل",
            target.id,
            {
                amount
            }
        );
    }
);
// ======================================================
// استلام هدية
// ======================================================
bot.hears(
    "هدية",
    async ctx => {
        if (!isGroup(ctx)) return;
        if (!isBankEnabled(ctx)) {
            return;
        }
        const data =
            getBankData(
                ctx.chat.id,
                ctx.from.id
            );
        const now =
            Date.now();
        const lastGift =
            Number(
                data.lastGift || 0
            );
        const cooldown =
            24 * 60 * 60 * 1000;
        if (
            now - lastGift <
            cooldown
        ) {
            const remaining =
                cooldown -
                (now - lastGift);
            const hours =
                Math.ceil(
                    remaining /
                    (60 * 60 * 1000)
                );
            await ctx.reply(
                `• استلمت هديتك مسبقًا.\n` +
                `• حاول مرة أخرى بعد ${hours} ساعة.`
            );
            return;
        }
        const amount =
            Math.floor(
                Math.random() *
                91
            ) + 10;
        data.balance += amount;
        data.totalEarned += amount;
        data.lastGift =
            now;
        saveDB();
        await ctx.reply(
            `• مبروك.\n` +
            `• حصلت على ${amount} ريال وهمي.\n` +
            `• رصيدك ↤ ${data.balance}`
        );
    }
);
// ======================================================
// راتبي
// ======================================================
bot.hears(
    [
        "راتب",
        "راتبي"
    ],
    async ctx => {
        if (!isGroup(ctx)) return;
        if (!isBankEnabled(ctx)) {
            return;
        }
        const data =
            getBankData(
                ctx.chat.id,
                ctx.from.id
            );
        const now =
            Date.now();
        const lastSalary =
            Number(
                data.lastSalary || 0
            );
        const cooldown =
            12 * 60 * 60 * 1000;
        if (
            now - lastSalary <
            cooldown
        ) {
            const remaining =
                cooldown -
                (now - lastSalary);
            const hours =
                Math.ceil(
                    remaining /
                    (60 * 60 * 1000)
                );
            await ctx.reply(
                `• استلمت راتبك مسبقًا.\n` +
                `• المتبقي تقريبًا ↤ ${hours} ساعة.`
            );
            return;
        }
        const salary =
            Math.floor(
                Math.random() *
                201
            ) + 100;
        data.balance += salary;
        data.totalEarned += salary;
        data.lastSalary =
            now;
        saveDB();
        await ctx.reply(
            `• تم إيداع راتبك.\n` +
            `• الراتب ↤ ${salary}\n` +
            `• رصيدك ↤ ${data.balance}`
        );
    }
);
// ======================================================
// ثروتي
// ======================================================
bot.hears(
    [
        "ثروتي",
        "احصائياتي المالية"
    ],
    async ctx => {
        if (!isGroup(ctx)) return;
        if (!isBankEnabled(ctx)) {
            return;
        }
        const data =
            getBankData(
                ctx.chat.id,
                ctx.from.id
            );
        const total =
            Number(data.balance || 0) +
            Number(data.bank || 0);
        await ctx.reply(
            "• معلوماتك المالية\n" +
            "━━━━━━━━━━━━━━\n" +
            `• الرصيد ↤ ${data.balance}\n` +
            `• البنك ↤ ${data.bank}\n` +
            `• إجمالي الثروة ↤ ${total}\n` +
            `• إجمالي الأرباح ↤ ${data.totalEarned || 0}\n` +
            `• إجمالي التحويلات ↤ ${data.totalTransferred || 0}`,
            replyOptions()
        );
    }
);
// ======================================================
// أغنى الأعضاء
// ======================================================
bot.hears(
    [
        "الأغنياء",
        "أغنى الأعضاء",
        "ترتيب الأغنياء"
    ],
    async ctx => {
        if (!isGroup(ctx)) return;
        if (!isBankEnabled(ctx)) {
            return;
        }
        const chat =
            getChat(ctx.chat.id);
        const list =
            Object.entries(
                chat.bank || {}
            )
            .map(
                ([id, data]) => ({
                    id: Number(id),
                    wealth:
                        Number(
                            data.balance || 0
                        ) +
                        Number(
                            data.bank || 0
                        )
                })
            )
            .filter(
                user =>
                    user.wealth > 0
            )
            .sort(
                (a, b) =>
                    b.wealth -
                    a.wealth
            )
            .slice(0, 10);
        if (!list.length) {
            await ctx.reply(
                "• لا توجد بيانات مالية حتى الآن."
            );
            return;
        }
        let text =
            "• أغنى الأعضاء\n" +
            "━━━━━━━━━━━━━━\n";
        list.forEach(
            (user, index) => {
                const member =
                    getUser(user.id);
                text +=
                    `${index + 1} - ` +
                    `${mentionById(
                        user.id,
                        member?.first_name ||
                        member?.username ||
                        "مستخدم"
                    )}` +
                    ` ↤ ${user.wealth}\n`;
            }
        );
        await ctx.reply(
            text,
            replyOptions()
        );
    }
);
// ======================================================
// تفعيل البنك
// ======================================================
bot.hears(
    "تفعيل البنك",
    async ctx => {
        if (!isGroup(ctx)) return;
        if (
            !await requireRank(
                ctx,
                "Myth🎖️"
            )
        ) {
            return;
        }
        const settings =
            getSettings(ctx);
        settings.bank = true;
        saveDB();
        await ctx.reply(
            "• تم تفعيل البنك."
        );
    }
);
// ======================================================
// تعطيل البنك
// ======================================================
bot.hears(
    "تعطيل البنك",
    async ctx => {
        if (!isGroup(ctx)) return;
        if (
            !await requireRank(
                ctx,
                "Myth🎖️"
            )
        ) {
            return;
        }
        const settings =
            getSettings(ctx);
        settings.bank = false;
        saveDB();
        await ctx.reply(
            "• تم تعطيل البنك."
        );
    }
);
// ======================================================
// تحويل الكل
// ======================================================
bot.hears(
    "رصيدي",
    async ctx => {
        if (!isGroup(ctx)) return;
        if (!isBankEnabled(ctx)) {
            return;
        }
        const data =
            getBankData(
                ctx.chat.id,
                ctx.from.id
            );
        await ctx.reply(
            `• رصيدك الحالي ↤ ${data.balance}`
        );
    }
);
// =====================================================
// TORAYF BOT - PART 6
// التواصل + زاجل + الإحصائيات + الاشتراك الإجباري
// بوت الخدمة + التنسيقات
// =====================================================

/* =====================================================
   تهيئة بيانات الأنظمة
===================================================== */

function getSystemData(chatId) {
    const chat = getChat(chatId);

    chat.settings ||= {};

    if (chat.settings.communication === undefined)
        chat.settings.communication = true;

    if (chat.settings.zajel === undefined)
        chat.settings.zajel = true;

    if (chat.settings.stats === undefined)
        chat.settings.stats = true;

    if (chat.settings.formats === undefined)
        chat.settings.formats = true;

    if (chat.settings.serviceBot === undefined)
        chat.settings.serviceBot = true;

    if (chat.settings.forcedSubscription === undefined)
        chat.settings.forcedSubscription = false;

    if (chat.settings.forcedChannel === undefined)
        chat.settings.forcedChannel = "";

    chat.communication ||= {
        messages: {},
        pending: {}
    };

    chat.zajel ||= {
        messages: [],
        enabled: true
    };

    return chat;
}


/* =====================================================
   تشغيل / إيقاف الأنظمة
===================================================== */

function systemEnabled(ctx, name) {
    const chat = getSystemData(ctx.chat.id);

    return chat.settings[name] !== false;
}


/* =====================================================
   الإحصائيات
===================================================== */

function updateChatStats(chatId, userId) {
    const chat = getSystemData(chatId);

    if (chat.settings.stats === false)
        return;

    chat.stats ||= {};

    const uid = String(userId);

    chat.stats[uid] ||= {
        messages: 0,
        gamePoints: 0,
        warnings: 0,
        joins: 0
    };

    chat.stats[uid].messages++;
    chat.stats[uid].lastMessage = Date.now();
}


bot.on("message", async (ctx, next) => {
    try {
        if (ctx.chat && ctx.from) {
            updateChatStats(ctx.chat.id, ctx.from.id);
            saveDB();
        }
    } catch (e) {
        console.log("Stats error:", e.message);
    }

    return next();
});


/* =====================================================
   أمر إحصائياتي
===================================================== */

bot.hears(
    ["احصائياتي", "إحصائياتي", "احصائي", "إحصائي"],
    async (ctx) => {

        if (!isGroup(ctx))
            return;

        if (!systemEnabled(ctx, "stats"))
            return ctx.reply("الإحصائيات معطلة حالياً.");

        const chat = getSystemData(ctx.chat.id);
        const uid = String(ctx.from.id);

        const data = chat.stats?.[uid] || {
            messages: 0,
            gamePoints: 0,
            warnings: 0,
            joins: 0
        };

        await ctx.reply(
`إحصائياتك

الاسم: ${ctx.from.first_name || "غير معروف"}
الرسائل: ${data.messages || 0}
نقاط الألعاب: ${data.gamePoints || 0}
التحذيرات: ${data.warnings || 0}`
        );
    }
);


/* =====================================================
   أكثر الأعضاء نشاطاً
===================================================== */

bot.hears(
    ["المتفاعلين", "المتفاعلين في القروب", "نشاط الأعضاء"],
    async (ctx) => {

        if (!isGroup(ctx))
            return;

        if (!systemEnabled(ctx, "stats"))
            return ctx.reply("الإحصائيات معطلة حالياً.");

        const chat = getSystemData(ctx.chat.id);

        const stats = Object.entries(chat.stats || {})
            .sort((a, b) => {
                return (b[1].messages || 0) - (a[1].messages || 0);
            })
            .slice(0, 10);

        if (!stats.length)
            return ctx.reply("لا توجد إحصائيات حتى الآن.");

        let text = "أكثر الأعضاء تفاعلاً\n\n";

        for (let i = 0; i < stats.length; i++) {
            const [userId, data] = stats[i];

            text += `${i + 1}. ${mentionById(userId)} — ${data.messages || 0} رسالة\n`;
        }

        await ctx.reply(text, {
            parse_mode: "HTML"
        });
    }
);


/* =====================================================
   التواصل
===================================================== */

function getCommunicationData(chatId) {
    const chat = getSystemData(chatId);

    chat.communication ||= {
        messages: {},
        pending: {}
    };

    return chat.communication;
}


/* =====================================================
   رسالة تواصل
   تواصل + الرسالة
===================================================== */

bot.hears(/^تواصل(?:\s+(.+))?$/i, async (ctx) => {

    if (!isGroup(ctx))
        return;

    if (!systemEnabled(ctx, "communication"))
        return ctx.reply("نظام التواصل معطل حالياً.");

    const message = ctx.match?.[1]?.trim();

    if (!message)
        return ctx.reply(
`طريقة الاستخدام:

تواصل + الرسالة`
        );

    const data = getCommunicationData(ctx.chat.id);

    const id = `${ctx.from.id}_${Date.now()}`;

    data.messages[id] = {
        from: ctx.from.id,
        text: message,
        createdAt: Date.now()
    };

    saveDB();

    await ctx.reply(
`تم إرسال رسالة التواصل.

الرسالة:
${message}`
    );
});


/* =====================================================
   زاجل
===================================================== */

function getZajelData(chatId) {
    const chat = getSystemData(chatId);

    chat.zajel ||= {
        messages: [],
        enabled: true
    };

    return chat.zajel;
}


/*
   زاجل + الرسالة
*/

bot.hears(/^زاجل(?:\s+(.+))?$/i, async (ctx) => {

    if (!isGroup(ctx))
        return;

    if (!systemEnabled(ctx, "zajel"))
        return ctx.reply("نظام زاجل معطل حالياً.");

    const message = ctx.match?.[1]?.trim();

    if (!message)
        return ctx.reply(
`طريقة الاستخدام:

زاجل + الرسالة`
        );

    const zajel = getZajelData(ctx.chat.id);

    zajel.messages.push({
        from: ctx.from.id,
        text: message,
        createdAt: Date.now()
    });

    if (zajel.messages.length > 100)
        zajel.messages.shift();

    saveDB();

    await ctx.reply(
`زاجل

${message}`
    );
});


/* =====================================================
   عرض رسائل زاجل
===================================================== */

bot.hears(
    ["رسائل زاجل", "زاجل الرسائل"],
    async (ctx) => {

        if (!isGroup(ctx))
            return;

        if (!systemEnabled(ctx, "zajel"))
            return ctx.reply("نظام زاجل معطل حالياً.");

        const zajel = getZajelData(ctx.chat.id);

        if (!zajel.messages.length)
            return ctx.reply("لا توجد رسائل زاجل.");

        const messages = zajel.messages.slice(-10).reverse();

        let text = "آخر رسائل زاجل\n\n";

        messages.forEach((item, index) => {
            text += `${index + 1}. ${item.text}\n\n`;
        });

        await ctx.reply(text);
    }
);


/* =====================================================
   الاشتراك الإجباري
===================================================== */

function getForcedSubscription(ctx) {
    const chat = getSystemData(ctx.chat.id);

    return {
        enabled: chat.settings.forcedSubscription === true,
        channel: chat.settings.forcedChannel || ""
    };
}


/* =====================================================
   تعيين قناة الاشتراك الإجباري
===================================================== */

bot.hears(/^تعيين قناة الاشتراك(?:\s+(.+))?$/i, async (ctx) => {

    if (!isGroup(ctx))
        return;

    if (!requireRank(ctx, 6))
        return;

    const channel = ctx.match?.[1]?.trim();

    if (!channel)
        return ctx.reply(
`طريقة الاستخدام:

تعيين قناة الاشتراك + يوزر القناة`
        );

    const chat = getSystemData(ctx.chat.id);

    chat.settings.forcedChannel = channel;

    saveDB();

    await ctx.reply(
`تم تعيين قناة الاشتراك الإجباري:

${channel}`
    );
});


/* =====================================================
   تفعيل الاشتراك الإجباري
===================================================== */

bot.hears(
    ["تفعيل الاشتراك الإجباري", "فتح الاشتراك الإجباري"],
    async (ctx) => {

        if (!isGroup(ctx))
            return;

        if (!requireRank(ctx, 6))
            return;

        const chat = getSystemData(ctx.chat.id);

        if (!chat.settings.forcedChannel)
            return ctx.reply(
                "قم بتعيين قناة الاشتراك أولاً."
            );

        chat.settings.forcedSubscription = true;

        saveDB();

        await ctx.reply(
            "تم تفعيل الاشتراك الإجباري."
        );
    }
);


/* =====================================================
   تعطيل الاشتراك الإجباري
===================================================== */

bot.hears(
    ["تعطيل الاشتراك الإجباري", "قفل الاشتراك الإجباري"],
    async (ctx) => {

        if (!isGroup(ctx))
            return;

        if (!requireRank(ctx, 6))
            return;

        const chat = getSystemData(ctx.chat.id);

        chat.settings.forcedSubscription = false;

        saveDB();

        await ctx.reply(
            "تم تعطيل الاشتراك الإجباري."
        );
    }
);


/* =====================================================
   التحقق من الاشتراك
===================================================== */

async function checkForcedSubscription(ctx) {

    try {

        const settings = getForcedSubscription(ctx);

        if (!settings.enabled)
            return true;

        if (!settings.channel)
            return true;

        if (!ctx.from)
            return true;

        const member = await ctx.telegram.getChatMember(
            settings.channel,
            ctx.from.id
        );

        const allowed = [
            "creator",
            "administrator",
            "member"
        ];

        if (allowed.includes(member.status))
            return true;

        await ctx.reply(
`يجب عليك الاشتراك في القناة أولاً:

${settings.channel}`
        );

        return false;

    } catch (e) {

        console.log(
            "Forced subscription error:",
            e.message
        );

        return true;
    }
}


/* =====================================================
   بوت الخدمة
===================================================== */

function serviceBotEnabled(ctx) {
    return systemEnabled(ctx, "serviceBot");
}


/*
   مساعدة البوت
*/

bot.hears(
    ["مساعدة", "المساعدة", "خدمات"],
    async (ctx) => {

        if (!serviceBotEnabled(ctx))
            return;

        await ctx.reply(
`خدمات البوت

الألعاب
الأحداث والفعاليات
البنك
الإحصائيات
زاجل
التواصل
الحماية
الرتب
الإدارة

اكتب اسم القسم لمعرفة أوامره.`
        );
    }
);


/* =====================================================
   أوامر التنسيق
===================================================== */

function formatText(type, text) {

    if (!text)
        return "";

    switch (type) {

        case "نص":
            return text;

        case "كبير":
            return text.toUpperCase();

        case "اقتباس":
            return `> ${text}`;

        case "عنوان":
            return `━━ ${text} ━━`;

        default:
            return text;
    }
}


/* =====================================================
   تنسيق
   تنسيق + النص
===================================================== */

bot.hears(/^تنسيق(?:\s+(.+))?$/i, async (ctx) => {

    if (!isGroup(ctx))
        return;

    if (!systemEnabled(ctx, "formats"))
        return ctx.reply("نظام التنسيقات معطل حالياً.");

    const text = ctx.match?.[1]?.trim();

    if (!text)
        return ctx.reply(
`طريقة الاستخدام:

تنسيق + النص`
        );

    await ctx.reply(
        `━━ ${text} ━━`
    );
});


/* =====================================================
   تفعيل الأنظمة
===================================================== */

bot.hears(/^تفعيل (ردود البوت|التواصل|زاجل|الإحصائيات|التنسيقات|بوت الخدمة)$/i, async (ctx) => {

    if (!isGroup(ctx))
        return;

    if (!requireRank(ctx, 6))
        return;

    const system = ctx.match[1];

    const map = {
        "ردود البوت": "replies",
        "التواصل": "communication",
        "زاجل": "zajel",
        "الإحصائيات": "stats",
        "التنسيقات": "formats",
        "بوت الخدمة": "serviceBot"
    };

    const key = map[system];

    if (!key)
        return;

    const chat = getSystemData(ctx.chat.id);

    chat.settings[key] = true;

    saveDB();

    await ctx.reply(
        `تم تفعيل ${system}.`
    );
});


/* =====================================================
   تعطيل الأنظمة
===================================================== */

bot.hears(/^تعطيل (ردود البوت|التواصل|زاجل|الإحصائيات|التنسيقات|بوت الخدمة)$/i, async (ctx) => {

    if (!isGroup(ctx))
        return;

    if (!requireRank(ctx, 6))
        return;

    const system = ctx.match[1];

    const map = {
        "ردود البوت": "replies",
        "التواصل": "communication",
        "زاجل": "zajel",
        "الإحصائيات": "stats",
        "التنسيقات": "formats",
        "بوت الخدمة": "serviceBot"
    };

    const key = map[system];

    if (!key)
        return;

    const chat = getSystemData(ctx.chat.id);

    chat.settings[key] = false;

    saveDB();

    await ctx.reply(
        `تم تعطيل ${system}.`
    );
});


/* =====================================================
   عرض حالة الأنظمة
===================================================== */

bot.hears(
    ["حالة الأنظمة", "حالة البوت", "الأنظمة"],
    async (ctx) => {

        if (!isGroup(ctx))
            return;

        const chat = getSystemData(ctx.chat.id);

        const status = value =>
            value === false ? "معطل" : "مفعل";

        await ctx.reply(
`حالة أنظمة البوت

ردود البوت: ${status(chat.settings.replies)}
البنك: ${status(chat.settings.bank)}
التواصل: ${status(chat.settings.communication)}
زاجل: ${status(chat.settings.zajel)}
الإحصائيات: ${status(chat.settings.stats)}
التنسيقات: ${status(chat.settings.formats)}
بوت الخدمة: ${status(chat.settings.serviceBot)}
الاشتراك الإجباري: ${status(chat.settings.forcedSubscription)}`
        );
    }
);


/* =====================================================
   حفظ البيانات
===================================================== */

try {
    saveDB();
} catch (e) {
    console.log(
        "Final Part 6 save error:",
        e.message
    );
}

console.log("TORAYF BOT PART 6 LOADED");
