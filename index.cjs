const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");

// ======================================================
// TORAYF BOT
// PART 1
// الأساس + قاعدة البيانات + الرتب + الحماية
// ======================================================

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
    console.error("BOT_TOKEN غير موجود في Environment Variables");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

const DB_FILE = path.join(__dirname, "database.json");

// ======================================================
// الإعدادات الأساسية
// ======================================================

const MAIN_OWNER_ID = Number(
    process.env.MAIN_OWNER_ID || 0
);

const DEVELOPERS_IDS = String(
    process.env.DEVELOPERS_IDS || ""
)
    .split(",")
    .map(x => Number(x.trim()))
    .filter(Boolean);

// ======================================================
// الرتب
// ======================================================

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

// ======================================================
// إعدادات القروب
// ======================================================

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

    bankNames: {
        bank1: "الراجحي",
        bank2: "الأهلي",
        bank3: "البنك الثالث"
    },

    memberLimit: 0,

    forcedSubscription: false,
    forcedSubscriptionChannel: "",

    serviceBot: false,
    statistics: true,
    zaajel: false,
    formats: true,

    developerMode: false
};

// ======================================================
// قاعدة البيانات
// ======================================================

const DEFAULT_DB = {
    users: {},
    chats: {},
    subscribers: [],

    developers: {
        dev: [],
        dev2: []
    },

    forbiddenWords: {},
    customCommands: {},
    customReplies: {},

    whispers: {},
    userStates: {},
    broadcasts: {},

    tempPerms: {},
    marriage: {},

    logs: {},
    backups: {},
    channels: {},

    stats: {},

    games: {},
    queues: {},
    music: {},

    pendingPromotions: {},

    recentMessages: {},
    violations: {},

    events: {},
    judgments: {},

    bankAccounts: {},
    transfers: {},

    settings: {}
};

// ======================================================
// أدوات قاعدة البيانات
// ======================================================

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
            defaults[key] =
                mergeDefaults(
                    defaults[key],
                    current[key]
                );
        } else {
            defaults[key] =
                current[key];
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

        const data =
            JSON.parse(raw);

        return mergeDefaults(
            clone(DEFAULT_DB),
            data
        );

    } catch (err) {
        console.error(
            "خطأ في قراءة قاعدة البيانات:",
            err
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
    } catch (err) {
        console.error(
            "خطأ في حفظ قاعدة البيانات:",
            err
        );
    }
}

// ======================================================
// الأدوات العامة
// ======================================================

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

function replyOptions(extra = {}) {
    return {
        parse_mode: "HTML",
        ...extra
    };
}

// ======================================================
// القروبات
// ======================================================

function isGroup(ctx) {
    return (
        ctx.chat &&
        (
            ctx.chat.type === "group" ||
            ctx.chat.type === "supergroup"
        )
    );
}

function getChat(chatId) {
    chatId = String(chatId);

    if (!db.chats[chatId]) {
        db.chats[chatId] = {
            id: chatId,
            title: "",
            users: {},
            ranks: {},
            blockedUsers: {},
            settings: clone(
                DEFAULT_SETTINGS
            ),
            rules: "",
            inviteLink: "",
            mutedUsers: {},
            globalMutedUsers: {},
            createdAt: Date.now()
        };

        saveDB();
    }

    if (!db.chats[chatId].settings) {
        db.chats[chatId].settings =
            clone(DEFAULT_SETTINGS);
    } else {
        db.chats[chatId].settings =
            mergeDefaults(
                clone(DEFAULT_SETTINGS),
                db.chats[chatId].settings
            );
    }

    if (!db.chats[chatId].blockedUsers) {
        db.chats[chatId].blockedUsers = {};
    }

    if (!db.chats[chatId].mutedUsers) {
        db.chats[chatId].mutedUsers = {};
    }

    if (!db.chats[chatId].globalMutedUsers) {
        db.chats[chatId].globalMutedUsers = {};
    }

    return db.chats[chatId];
}

// ======================================================
// المستخدمين
// ======================================================

function getUser(userId) {
    userId = String(userId);

    if (!db.users[userId]) {
        db.users[userId] = {
            id: Number(userId),

            username: "",
            first_name: "",
            last_name: "",

            balance: 0,

            messages: {},
            points: {},

            warnings: {},
            violations: {},

            bank: {
                active: false,
                name: "",
                accountNumber: ""
            },

            purchases: [],
            transferHistory: [],

            createdAt: Date.now()
        };
    }

    return db.users[userId];
}

function ensureChatUser(ctx) {
    if (
        !ctx.from ||
        !ctx.chat
    ) {
        return null;
    }

    const user =
        getUser(ctx.from.id);

    const chat =
        getChat(ctx.chat.id);

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

    saveDB();

    return {
        user,
        chat
    };
}

// ======================================================
// الرتب
// ======================================================

function getRank(ctx, userId = null) {
    const id = Number(
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
        db.developers?.dev?.includes(id)
    ) {
        return "Dev🎖️";
    }

    if (
        db.developers?.dev2?.includes(id)
    ) {
        return "Dev²🎖️";
    }

    if (ctx?.chat?.id) {
        const chat =
            getChat(ctx.chat.id);

        const rank =
            chat.ranks?.[String(id)];

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
            getRank(ctx, userId)
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

async function rankDenied(
    ctx,
    requiredRank
) {
    await ctx.reply(
        `• هذا الامر يخص ↤ ｢ ${escapeHTML(requiredRank)} ｣`
    );

    return false;
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

    return rankDenied(
        ctx,
        requiredRank
    );
}

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

// ======================================================
// الإعدادات
// ======================================================

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

function settingEnabled(
    ctx,
    key
) {
    return (
        getSettings(ctx)[key] ===
        true
    );
}

// ======================================================
// Telegram Admin
// ======================================================

async function getMember(
    ctx,
    userId
) {
    try {
        return await ctx.telegram
            .getChatMember(
                ctx.chat.id,
                userId
            );
    } catch {
        return null;
    }
}

async function isCreator(
    ctx,
    userId = null
) {
    const id =
        userId ||
        ctx.from?.id;

    const member =
        await getMember(
            ctx,
            id
        );

    return (
        member?.status ===
        "creator"
    );
}

// ======================================================
// Reply Target
// ======================================================

function getReplyTarget(ctx) {
    const reply =
        ctx.message
            ?.reply_to_message;

    if (
        !reply?.from?.id
    ) {
        return null;
    }

    return reply.from;
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

// ======================================================
// التسجيل
// ======================================================

function logAction(
    ctx,
    action,
    targetId = null,
    extra = {}
) {
    const chatId =
        ctx.chat?.id;

    if (!chatId) {
        return;
    }

    const key =
        String(chatId);

    if (!db.logs[key]) {
        db.logs[key] = [];
    }

    db.logs[key].push({
        action,
        actorId:
            ctx.from?.id || null,
        targetId,
        extra,
        timestamp: Date.now()
    });

    if (
        db.logs[key].length > 500
    ) {
        db.logs[key] =
            db.logs[key].slice(-500);
    }

    saveDB();
}

// ======================================================
// تحديث المستخدم والتفاعل
// ======================================================

bot.use(
    async (ctx, next) => {
        try {
            if (ctx.from) {
                const user =
                    getUser(
                        ctx.from.id
                    );

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
                    ensureChatUser(ctx);
                }

                saveDB();
            }

            return next();

        } catch (err) {
            console.error(
                "middleware error:",
                err
            );

            return next();
        }
    }
);

// ======================================================
// رتبتك
// ======================================================

bot.hears(
    "رتبتي",
    async ctx => {
        await ctx.reply(
            `• رتبتك الحالية ↤ ${escapeHTML(getRank(ctx))}`
        );
    }
);

// ======================================================
// تفاعلي
// ======================================================

bot.hears(
    "تفاعلي",
    async ctx => {
        if (!isGroup(ctx)) {
            return;
        }

        const chat =
            getChat(ctx.chat.id);

        const data =
            chat.users[
                String(ctx.from.id)
            ] || {};

        await ctx.reply(
            `• تفاعلك\n` +
            `━━━━━━━━━━━━━━\n` +
            `• الرتبة: ${escapeHTML(getRank(ctx))}\n` +
            `• الرسائل: ${Number(data.messages || 0)}\n` +
            `• النقاط: ${Number(data.points || 0)}`
        );
    }
);

// ======================================================
// تسجيل الرسائل
// ======================================================

function trackMessage(ctx) {
    if (
        !isGroup(ctx) ||
        !ctx.from
    ) {
        return;
    }

    const chat =
        getChat(ctx.chat.id);

    const user =
        getUser(ctx.from.id);

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
    }

    chat.users[id].messages =
        Number(
            chat.users[id].messages || 0
        ) + 1;

    chat.users[id].points =
        Number(
            chat.users[id].points || 0
        ) + 1;

    user.messages[
        String(ctx.chat.id)
    ] =
        Number(
            user.messages[
                String(ctx.chat.id)
            ] || 0
        ) + 1;

    user.points[
        String(ctx.chat.id)
    ] =
        Number(
            user.points[
                String(ctx.chat.id)
            ] || 0
        ) + 1;

    saveDB();
}

// ======================================================
// تحديث التفاعل
// ======================================================

bot.use(
    async (ctx, next) => {
        try {
            if (
                isGroup(ctx) &&
                ctx.message
            ) {
                trackMessage(ctx);
            }

            return next();

        } catch (err) {
            console.error(
                "tracking error:",
                err
            );

            return next();
        }
    }
);

// ======================================================
// حماية الرتب
// ======================================================

async function canModerateTarget(
    ctx,
    targetId
) {
    const actorId =
        ctx.from.id;

    if (
        actorId === targetId
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
            "• لا يمكنك تنفيذ الأمر على مستخدم رتبته مساوية أو أعلى من رتبتك."
        );

        return false;
    }

    if (
        await isCreator(
            ctx,
            targetId
        )
    ) {
        await ctx.reply(
            "• لا يمكنك تنفيذ الأمر على مالك القروب."
        );

        return false;
    }

    return true;
}

// ======================================================
// الأخطاء
// ======================================================

bot.catch(
    async (err, ctx) => {
        console.error(
            "BOT ERROR:",
            err
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
// ======================================================
// TORAYF BOT - PART 2
// الرتب + الإدارة + الحماية + البلوك
// ======================================================

// ======================================================
// أوامر رفع وتنزيل الرتب
// ======================================================

const PROMOTION_COMMANDS = {
    "رفع مطور ثانوي": "Dev🎖️",
    "رفع ديف": "Dev²🎖️",
    "رفع MY": "Myth🎖️",
    "رفع اكس": "Myth🎖️",
    "رفع M": "Myth",
    "رفع مالك اساسي": "مالك أساسي",
    "رفع اساس": "مالك أساسي",
    "رفع مالك": "مالك",
    "رفع مميز": "مميز"
};

const DEMOTION_COMMANDS = {
    "تنزيل مطور ثانوي": "Dev🎖️",
    "تنزيل ديف": "Dev²🎖️",
    "تنزيل MY": "Myth🎖️",
    "تنزيل اكس": "Myth🎖️",
    "تنزيل M": "Myth",
    "تنزيل مالك اساسي": "مالك أساسي",
    "تنزيل اساس": "مالك أساسي",
    "تنزيل مالك": "مالك",
    "تنزيل مميز": "مميز"
};

async function changeRank(
    ctx,
    target,
    newRank,
    mode
) {
    if (!isGroup(ctx)) return;

    const actorLevel =
        getRankLevel(ctx);

    const targetLevel =
        getRankLevel(
            ctx,
            target.id
        );

    const requestedLevel =
        RANKS[newRank];

    if (
        requestedLevel === undefined
    ) {
        return;
    }

    if (
        target.id === ctx.from.id
    ) {
        await ctx.reply(
            "• لا يمكنك تغيير رتبتك بنفسك."
        );
        return;
    }

    if (
        targetLevel >= actorLevel
    ) {
        await ctx.reply(
            "• لا يمكنك تعديل رتبة مستخدم رتبته مساوية أو أعلى من رتبتك."
        );
        return;
    }

    if (
        requestedLevel >=
        RANKS["Dev²🎖️"]
    ) {
        if (!isTopDev(ctx)) {
            return rankDenied(
                ctx,
                "Dev🎖️"
            );
        }
    } else if (
        requestedLevel >=
        RANKS["Myth🎖️"]
    ) {
        if (!isDev(ctx)) {
            return rankDenied(
                ctx,
                "Dev²🎖️"
            );
        }
    } else if (
        requestedLevel >=
        RANKS["مالك أساسي"]
    ) {
        if (
            actorLevel <
            RANKS["Myth"]
        ) {
            return rankDenied(
                ctx,
                "Myth"
            );
        }
    } else if (
        requestedLevel >=
        RANKS["مالك"]
    ) {
        if (
            actorLevel <
            RANKS["مالك أساسي"]
        ) {
            return rankDenied(
                ctx,
                "مالك أساسي"
            );
        }
    } else if (
        requestedLevel >=
        RANKS["مميز"]
    ) {
        if (
            actorLevel <
            RANKS["مالك"]
        ) {
            return rankDenied(
                ctx,
                "مالك"
            );
        }
    }

    if (
        requestedLevel >=
        actorLevel
    ) {
        await ctx.reply(
            "• لا يمكنك رفع مستخدم إلى رتبة مساوية أو أعلى من رتبتك."
        );
        return;
    }

    const chat =
        getChat(ctx.chat.id);

    if (
        requestedLevel === 0
    ) {
        delete chat.ranks[
            String(target.id)
        ];
    } else {
        chat.ranks[
            String(target.id)
        ] = newRank;
    }

    // المطورين العالميين
    if (
        newRank === "Dev🎖️"
    ) {
        if (
            !db.developers.dev.includes(
                target.id
            )
        ) {
            db.developers.dev.push(
                target.id
            );
        }
    }

    if (
        newRank === "Dev²🎖️"
    ) {
        if (
            !db.developers.dev2.includes(
                target.id
            )
        ) {
            db.developers.dev2.push(
                target.id
            );
        }
    }

    saveDB();

    logAction(
        ctx,
        mode === "promote"
            ? "رفع رتبة"
            : "تنزيل رتبة",
        target.id,
        {
            newRank
        }
    );

    await ctx.reply(
        `${mention(target)}\n` +
        `• الرتبة: ${escapeHTML(newRank)}\n` +
        `• تم ${mode === "promote" ? "رفع" : "تنزيل"} الرتبة بنجاح.`,
        replyOptions()
    );
}

// ======================================================
// رفع / تنزيل
// ======================================================

bot.hears(
    Object.keys(PROMOTION_COMMANDS),
    async ctx => {
        if (!isGroup(ctx)) return;

        const target =
            await requireReply(ctx);

        if (!target) return;

        await changeRank(
            ctx,
            target,
            PROMOTION_COMMANDS[
                normalize(
                    ctx.message.text
                )
            ],
            "promote"
        );
    }
);

bot.hears(
    Object.keys(DEMOTION_COMMANDS),
    async ctx => {
        if (!isGroup(ctx)) return;

        const target =
            await requireReply(ctx);

        if (!target) return;

        await changeRank(
            ctx,
            target,
            DEMOTION_COMMANDS[
                normalize(
                    ctx.message.text
                )
            ],
            "demote"
        );
    }
);

// ======================================================
// الكتم
// ======================================================

async function muteUser(
    ctx,
    targetId,
    minutes = null
) {
    const duration =
        minutes === null
            ? getSettings(ctx)
                .muteMinutes
            : minutes;

    const until =
        Math.floor(
            Date.now() / 1000
        ) +
        duration * 60;

    try {
        await ctx.telegram
            .restrictChatMember(
                ctx.chat.id,
                targetId,
                {
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
                    },
                    until_date: until
                }
            );

        const chat =
            getChat(ctx.chat.id);

        chat.mutedUsers[
            String(targetId)
        ] = {
            until,
            by: ctx.from.id,
            createdAt: Date.now()
        };

        saveDB();

        return true;

    } catch (err) {
        console.error(
            "mute error:",
            err.message
        );

        return false;
    }
}

// ======================================================
// فك الكتم
// ======================================================

async function unmuteUser(
    ctx,
    targetId
) {
    try {
        await ctx.telegram
            .restrictChatMember(
                ctx.chat.id,
                targetId,
                {
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
                }
            );

        const chat =
            getChat(ctx.chat.id);

        delete chat.mutedUsers[
            String(targetId)
        ];

        saveDB();

        return true;

    } catch (err) {
        console.error(
            "unmute error:",
            err.message
        );

        return false;
    }
}

// ======================================================
// التقييد
// ======================================================

async function restrictUser(
    ctx,
    targetId,
    minutes = null
) {
    const duration =
        minutes === null
            ? getSettings(ctx)
                .restrictMinutes
            : minutes;

    const until =
        Math.floor(
            Date.now() / 1000
        ) +
        duration * 60;

    try {
        await ctx.telegram
            .restrictChatMember(
                ctx.chat.id,
                targetId,
                {
                    permissions: {
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
                    },
                    until_date: until
                }
            );

        return true;

    } catch (err) {
        console.error(
            "restrict error:",
            err.message
        );

        return false;
    }
}

async function unrestrictUser(
    ctx,
    targetId
) {
    return unmuteUser(
        ctx,
        targetId
    );
}

// ======================================================
// الحظر
// ======================================================

async function banUser(
    ctx,
    targetId
) {
    try {
        await ctx.telegram
            .banChatMember(
                ctx.chat.id,
                targetId
            );

        return true;

    } catch (err) {
        console.error(
            "ban error:",
            err.message
        );

        return false;
    }
}

async function unbanUser(
    ctx,
    targetId
) {
    try {
        await ctx.telegram
            .unbanChatMember(
                ctx.chat.id,
                targetId,
                {
                    only_if_banned: true
                }
            );

        return true;

    } catch (err) {
        console.error(
            "unban error:",
            err.message
        );

        return false;
    }
}

// ======================================================
// الطرد
// ======================================================

async function kickUser(
    ctx,
    targetId
) {
    try {
        await ctx.telegram
            .banChatMember(
                ctx.chat.id,
                targetId
            );

        await ctx.telegram
            .unbanChatMember(
                ctx.chat.id,
                targetId
            );

        return true;

    } catch (err) {
        console.error(
            "kick error:",
            err.message
        );

        return false;
    }
}

// ======================================================
// أوامر الإدارة
// ======================================================

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

bot.hears(
    Object.keys(
        MODERATION_COMMANDS
    ),
    async ctx => {
        if (!isGroup(ctx)) return;

        const command =
            normalize(
                ctx.message.text
            );

        const action =
            MODERATION_COMMANDS[
                command
            ];

        const target =
            await requireReply(ctx);

        if (!target) return;

        if (
            !await canModerateTarget(
                ctx,
                target.id
            )
        ) {
            return;
        }

        let required =
            "مميز";

        if (
            [
                "restrict",
                "unrestrict"
            ].includes(action)
        ) {
            required =
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
            required =
                "Myth";
        }

        if (
            !await requireRank(
                ctx,
                required
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
                type: "تحذير يدوي",
                timestamp: Date.now()
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

        if (success) {
            logAction(
                ctx,
                command,
                target.id
            );

            await ctx.reply(
                `${mention(target)}\n• تم تنفيذ الأمر بنجاح.`,
                replyOptions()
            );
        } else {
            await ctx.reply(
                "• تعذر تنفيذ الأمر، تأكد من صلاحيات البوت."
            );
        }
    }
);

// ======================================================
// الكتم العام
// ======================================================

bot.hears(
    ["كتم عام", "فك الكتم العام"],
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

        if (
            normalize(
                ctx.message.text
            ) === "كتم عام"
        ) {
            settings.globalMute =
                true;

            await ctx.reply(
                "• تم تفعيل الكتم العام."
            );
        } else {
            settings.globalMute =
                false;

            await ctx.reply(
                "• تم إلغاء الكتم العام."
            );
        }

        saveDB();
    }
);

// ======================================================
// مسح المكتومين
// ======================================================

bot.hears(
    "مسح المكتومين",
    async ctx => {
        if (!isGroup(ctx)) return;

        if (
            !await requireRank(
                ctx,
                "Myth"
            )
        ) {
            return;
        }

        const chat =
            getChat(ctx.chat.id);

        const ids =
            Object.keys(
                chat.mutedUsers
            );

        for (const id of ids) {
            await unmuteUser(
                ctx,
                Number(id)
            );
        }

        chat.mutedUsers = {};

        saveDB();

        await ctx.reply(
            "• تم مسح المكتومين."
        );
    }
);

// ======================================================
// نظام البلوك
// ======================================================

function getBlockedUsers(
    chatId,
    userId
) {
    const chat =
        getChat(chatId);

    const id =
        String(userId);

    if (
        !chat.blockedUsers[id]
    ) {
        chat.blockedUsers[id] = [];
    }

    return chat.blockedUsers[id];
}

function hasBlocked(
    chatId,
    blockerId,
    targetId
) {
    return getBlockedUsers(
        chatId,
        blockerId
    ).includes(
        Number(targetId)
    );
}

async function checkCommunicationBlock(
    ctx,
    targetId
) {
    if (
        !ctx.from ||
        !ctx.chat ||
        !targetId
    ) {
        return false;
    }

    const actorId =
        Number(ctx.from.id);

    const target =
        Number(targetId);

    if (
        actorId === target
    ) {
        return false;
    }

    // الهدف حاظر الشخص الذي يحاول التواصل معه
    if (
        hasBlocked(
            ctx.chat.id,
            target,
            actorId
        )
    ) {
        await ctx.reply(
            "• لا يمكنك التواصل مع هذا العضو عبر البوت لأنه قام بحظرك."
        );

        return true;
    }

    return false;
}

// ======================================================
// بلوك
// ======================================================

bot.hears(
    "بلوك",
    async ctx => {
        if (!isGroup(ctx)) return;

        const target =
            await requireReply(ctx);

        if (!target) return;

        if (
            target.id ===
            ctx.from.id
        ) {
            await ctx.reply(
                "• لا يمكنك حظر نفسك."
            );
            return;
        }

        const blocked =
            getBlockedUsers(
                ctx.chat.id,
                ctx.from.id
            );

        if (
            blocked.includes(
                Number(target.id)
            )
        ) {
            await ctx.reply(
                "• هذا العضو موجود بالفعل في قائمة البلوك."
            );
            return;
        }

        blocked.push(
            Number(target.id)
        );

        saveDB();

        await ctx.reply(
            `${mention(target)}\n• تم حظر التواصل معه عبر البوت.`,
            replyOptions()
        );

        logAction(
            ctx,
            "بلوك",
            target.id
        );
    }
);

// ======================================================
// الغاء البلوك
// ======================================================

bot.hears(
    "الغاء البلوك",
    async ctx => {
        if (!isGroup(ctx)) return;

        const target =
            await requireReply(ctx);

        if (!target) return;

        const blocked =
            getBlockedUsers(
                ctx.chat.id,
                ctx.from.id
            );

        const index =
            blocked.indexOf(
                Number(target.id)
            );

        if (
            index === -1
        ) {
            await ctx.reply(
                "• هذا العضو غير موجود في قائمة البلوك."
            );
            return;
        }

        blocked.splice(
            index,
            1
        );

        saveDB();

        await ctx.reply(
            `${mention(target)}\n• تم إلغاء البلوك.`,
            replyOptions()
        );

        logAction(
            ctx,
            "إلغاء البلوك",
            target.id
        );
    }
);

// ======================================================
// بلوكاتي
// ======================================================

bot.hears(
    "بلوكاتي",
    async ctx => {
        if (!isGroup(ctx)) return;

        const blocked =
            getBlockedUsers(
                ctx.chat.id,
                ctx.from.id
            );

        if (
            !blocked.length
        ) {
            await ctx.reply(
                "• لا يوجد أشخاص في قائمة البلوك."
            );
            return;
        }

        let text =
            "• الأشخاص المحظورون لديك\n" +
            "━━━━━━━━━━━━━━\n";

        blocked.forEach(
            (id, index) => {
                const user =
                    getUser(id);

                text +=
                    `${index + 1} - ${mentionById(
                        id,
                        user.first_name ||
                        user.username ||
                        "مستخدم"
                    )}\n`;
            }
        );

        await ctx.reply(
            text,
            replyOptions()
        );
    }
);

// ======================================================
// الإنذارات
// ======================================================

function getViolationData(
    chatId,
    userId
) {
    const chat =
        getChat(chatId);

    const id =
        String(userId);

    if (
        !db.violations[
            String(chatId)
        ]
    ) {
        db.violations[
            String(chatId)
        ] = {};
    }

    if (
        !db.violations[
            String(chatId)
        ][id]
    ) {
        db.violations[
            String(chatId)
        ][id] = {
            count: 0,
            history: []
        };
    }

    return db.violations[
        String(chatId)
    ][id];
}

// ======================================================
// الكلمات الممنوعة
// ======================================================

bot.hears(
    /^منع الكلمه (.+)$/i,
    async ctx => {
        if (!isGroup(ctx)) return;

        if (
            !await requireRank(
                ctx,
                "Myth"
            )
        ) {
            return;
        }

        const word =
            ctx.message.text
                .replace(
                    /^منع الكلمه\s+/i,
                    ""
                )
                .trim();

        const chatId =
            String(ctx.chat.id);

        if (
            !db.forbiddenWords[
                chatId
            ]
        ) {
            db.forbiddenWords[
                chatId
            ] = [];
        }

        if (
            !db.forbiddenWords[
                chatId
            ].some(
                x =>
                    normalize(x) ===
                    normalize(word)
            )
        ) {
            db.forbiddenWords[
                chatId
            ].push(word);
        }

        saveDB();

        await ctx.reply(
            "• تمت إضافة الكلمة إلى قائمة المنع."
        );
    }
);

bot.hears(
    /^الغاء منع الكلمه (.+)$/i,
    async ctx => {
        if (!isGroup(ctx)) return;

        if (
            !await requireRank(
                ctx,
                "Myth"
            )
        ) {
            return;
        }

        const word =
            ctx.message.text
                .replace(
                    /^الغاء منع الكلمه\s+/i,
                    ""
                )
                .trim();

        const chatId =
            String(ctx.chat.id);

        if (
            !db.forbiddenWords[
                chatId
            ]
        ) {
            db.forbiddenWords[
                chatId
            ] = [];
        }

        db.forbiddenWords[
            chatId
        ] =
            db.forbiddenWords[
                chatId
            ].filter(
                x =>
                    normalize(x) !==
                    normalize(word)
            );

        saveDB();

        await ctx.reply(
            "• تمت إزالة الكلمة من قائمة المنع."
        );
    }
);

bot.hears(
    "الكلمات الممنوعه",
    async ctx => {
        if (!isGroup(ctx)) return;

        if (
            !await requireRank(
                ctx,
                "Myth"
            )
        ) {
            return;
        }

        const words =
            db.forbiddenWords[
                String(ctx.chat.id)
            ] || [];

        if (!words.length) {
            await ctx.reply(
                "• لا توجد كلمات ممنوعة."
            );
            return;
        }

        await ctx.reply(
            "• الكلمات الممنوعة\n" +
            "━━━━━━━━━━━━━━\n" +
            words
                .map(
                    (word, i) =>
                        `${i + 1} - ${escapeHTML(word)}`
                )
                .join("\n")
        );
    }
);

bot.hears(
    "مسح الكلمات الممنوعه",
    async ctx => {
        if (!isGroup(ctx)) return;

        if (
            !await requireRank(
                ctx,
                "Myth"
            )
        ) {
            return;
        }

        db.forbiddenWords[
            String(ctx.chat.id)
        ] = [];

        saveDB();

        await ctx.reply(
            "• تم مسح الكلمات الممنوعة."
        );
    }
);
// ======================================================
// TORAYF BOT - PART 3
// الهمسات + الأوامر المخصصة + الردود المخصصة
// ======================================================

// ======================================================
// أدوات الحالات الخاصة
// ======================================================

function getState(userId) {
    const key = String(userId);

    if (!db.userStates[key]) {
        db.userStates[key] = null;
    }

    return db.userStates[key];
}

function setState(userId, state) {
    db.userStates[String(userId)] = state;
    saveDB();
}

function clearState(userId) {
    delete db.userStates[String(userId)];
    saveDB();
}

function makeId(prefix = "id") {
    return (
        prefix +
        "_" +
        Date.now().toString(36) +
        "_" +
        Math.random()
            .toString(36)
            .slice(2, 7)
    );
}

// ======================================================
// إرسال محتوى رسالة محفوظة
// ======================================================

async function copySavedMessage(
    ctx,
    sourceChatId,
    sourceMessageId,
    targetChatId
) {
    try {
        return await ctx.telegram.copyMessage(
            targetChatId,
            sourceChatId,
            sourceMessageId
        );
    } catch (err) {
        console.error(
            "copySavedMessage error:",
            err.message
        );

        return null;
    }
}

// ======================================================
// الهمسات
// ======================================================

function getWhisper(id) {
    return db.whispers[String(id)] || null;
}

function createWhisper(data) {
    const id = makeId("w");

    db.whispers[id] = {
        id,
        chatId: Number(data.chatId),

        senderId: Number(data.senderId),
        recipientId: Number(data.recipientId),

        sourceChatId: Number(data.sourceChatId),
        sourceMessageId: Number(data.sourceMessageId),

        seen: false,
        replied: false,

        createdAt: Date.now()
    };

    saveDB();

    return id;
}

// ======================================================
// بدء الهمسة من القروب
// ======================================================

async function startWhisper(ctx) {
    if (!isGroup(ctx)) {
        return;
    }

    const target =
        getReplyTarget(ctx);

    if (!target) {
        await ctx.reply(
            "• يجب عليك عمل ريبلاي على المستخدم الذي تريد إرسال الهمسة له."
        );

        return;
    }

    if (
        target.id ===
        ctx.from.id
    ) {
        await ctx.reply(
            "• لا يمكنك إرسال همسة لنفسك."
        );

        return;
    }

    // البلوك
    if (
        await checkCommunicationBlock(
            ctx,
            target.id
        )
    ) {
        return;
    }

    setState(
        ctx.from.id,
        {
            type: "whisper_prepare",
            chatId: Number(ctx.chat.id),
            senderId: Number(ctx.from.id),
            recipientId: Number(target.id)
        }
    );

    await ctx.reply(
        `• تم تحديد الهمسه لـ ↤ ${mention(target)}\n` +
        `• اضغط الزر لكتابة الهمسة`,
        {
            parse_mode: "HTML",
            reply_markup:
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback(
                            "اهمس هنا",
                            `whisper_write:${ctx.from.id}`
                        )
                    ]
                ]).reply_markup
        }
    );
}

// ======================================================
// أوامر الهمسة
// ======================================================

bot.hears(
    ["اهمس", "همسه", "ه"],
    async ctx => {
        await startWhisper(ctx);
    }
);

// ======================================================
// زر كتابة الهمسة
// ======================================================

bot.action(
    /^whisper_write:(\d+)$/,
    async ctx => {
        try {
            const ownerId =
                Number(ctx.match[1]);

            if (
                ctx.from.id !==
                ownerId
            ) {
                await ctx.answerCbQuery(
                    "هذا الزر ليس لك.",
                    {
                        show_alert: true
                    }
                );

                return;
            }

            const state =
                getState(
                    ctx.from.id
                );

            if (
                !state ||
                state.type !==
                    "whisper_prepare"
            ) {
                await ctx.answerCbQuery(
                    "انتهت صلاحية الهمسة.",
                    {
                        show_alert: true
                    }
                );

                return;
            }

            // نتأكد مرة ثانية من البلوك
            const blocked =
                hasBlocked(
                    state.chatId,
                    state.recipientId,
                    state.senderId
                );

            if (blocked) {
                clearState(
                    ctx.from.id
                );

                await ctx.answerCbQuery(
                    "هذا العضو قام بحظرك من التواصل عبر البوت.",
                    {
                        show_alert: true
                    }
                );

                return;
            }

            // نتأكد أن المستخدم بدأ البوت في الخاص
            try {
                await ctx.telegram.sendMessage(
                    ctx.from.id,
                    "• أرسل الآن الهمسة\n• يمكنك إرسال نص أو ملصق أو صورة أو قيف\n-"
                );
            } catch {
                await ctx.answerCbQuery(
                    "افتح البوت في الخاص وأرسل /start أولًا.",
                    {
                        show_alert: true
                    }
                );

                return;
            }

            setState(
                ctx.from.id,
                {
                    type: "whisper_content",
                    chatId: state.chatId,
                    senderId: state.senderId,
                    recipientId: state.recipientId
                }
            );

            await ctx.answerCbQuery();

        } catch (err) {
            console.error(
                "whisper button error:",
                err.message
            );
        }
    }
);

// ======================================================
// التحقق من محتوى الهمسة
// ======================================================

function isValidWhisperMessage(
    message
) {
    if (!message) {
        return false;
    }

    return Boolean(
        message.text ||
        message.sticker ||
        message.photo ||
        message.animation
    );
}

// ======================================================
// استقبال الهمسة في الخاص
// ======================================================

bot.on(
    "message",
    async (ctx, next) => {
        try {
            if (
                ctx.chat?.type !==
                "private"
            ) {
                return next();
            }

            const state =
                getState(
                    ctx.from.id
                );

            if (!state) {
                return next();
            }

            if (
                state.type !==
                "whisper_content"
            ) {
                return next();
            }

            if (
                !isValidWhisperMessage(
                    ctx.message
                )
            ) {
                await ctx.reply(
                    "• نوع الرسالة غير مدعوم.\n• أرسل نص أو ملصق أو صورة أو قيف."
                );

                return;
            }

            // التأكد من البلوك قبل إنشاء الهمسة
            if (
                hasBlocked(
                    state.chatId,
                    state.recipientId,
                    state.senderId
                )
            ) {
                clearState(
                    ctx.from.id
                );

                await ctx.reply(
                    "• لا يمكنك إرسال الهمسة لأن هذا العضو قام بحظرك."
                );

                return;
            }

            const whisperId =
                createWhisper({
                    chatId:
                        state.chatId,
                    senderId:
                        state.senderId,
                    recipientId:
                        state.recipientId,
                    sourceChatId:
                        ctx.chat.id,
                    sourceMessageId:
                        ctx.message.message_id
                });

            clearState(
                ctx.from.id
            );

            const sender =
                getUser(
                    state.senderId
                );

            const recipient =
                getUser(
                    state.recipientId
                );

            let sent;

            try {
                sent =
                    await ctx.telegram
                        .sendMessage(
                            state.chatId,
                            `• ياحلو ↤ ${mentionById(
                                state.recipientId,
                                recipient.first_name ||
                                recipient.username ||
                                "المستلم"
                            )}\n` +
                            `• وصلتك همسة سرية من ↤ ${mentionById(
                                state.senderId,
                                sender.first_name ||
                                sender.username ||
                                "المرسل"
                            )}\n` +
                            `• انت وحدك تقدر تشوفها`,
                            {
                                parse_mode:
                                    "HTML",
                                reply_markup:
                                    Markup.inlineKeyboard([
                                        [
                                            Markup.button.callback(
                                                "رؤية الهمسة",
                                                `whisper_view:${whisperId}`
                                            ),
                                            Markup.button.callback(
                                                "رد على الهمسة",
                                                `whisper_reply:${whisperId}`
                                            )
                                        ]
                                    ])
                                        .reply_markup
                            }
                        );
            } catch (err) {
                console.error(
                    "whisper group send error:",
                    err.message
                );

                await ctx.reply(
                    "• تعذر إرسال الهمسة."
                );

                return;
            }

            if (sent) {
                db.whispers[
                    whisperId
                ].groupMessageId =
                    sent.message_id;

                saveDB();
            }

            await ctx.reply(
                "• تم ارسال الهمسة."
            );

        } catch (err) {
            console.error(
                "private whisper error:",
                err.message
            );

            return next();
        }
    }
);

// ======================================================
// رؤية الهمسة
// ======================================================

bot.action(
    /^whisper_view:(.+)$/,
    async ctx => {
        try {
            const id =
                ctx.match[1];

            const whisper =
                getWhisper(id);

            if (!whisper) {
                await ctx.answerCbQuery(
                    "هذه الهمسة غير موجودة.",
                    {
                        show_alert: true
                    }
                );

                return;
            }

            if (
                Number(ctx.from.id) !==
                Number(whisper.recipientId)
            ) {
                await ctx.answerCbQuery(
                    "هذه الهمسة ليست لك.",
                    {
                        show_alert: true
                    }
                );

                return;
            }

            // التأكد من البلوك قبل العرض
            if (
                hasBlocked(
                    whisper.chatId,
                    whisper.senderId,
                    whisper.recipientId
                )
            ) {
                await ctx.answerCbQuery(
                    "لا يمكن عرض هذه الهمسة.",
                    {
                        show_alert: true
                    }
                );

                return;
            }

            try {
                await ctx.telegram.copyMessage(
                    ctx.from.id,
                    whisper.sourceChatId,
                    whisper.sourceMessageId
                );
            } catch {
                await ctx.answerCbQuery(
                    "افتح البوت في الخاص وأرسل /start أولًا.",
                    {
                        show_alert: true
                    }
                );

                return;
            }

            if (!whisper.seen) {
                whisper.seen = true;

                saveDB();

                try {
                    await ctx.telegram.sendMessage(
                        whisper.senderId,
                        "• شاف همستك ."
                    );
                } catch {}
            }

            await ctx.answerCbQuery(
                "تم إرسال الهمسة إلى الخاص."
            );

        } catch (err) {
            console.error(
                "whisper view error:",
                err.message
            );
        }
    }
);

// ======================================================
// الرد على الهمسة
// ======================================================

bot.action(
    /^whisper_reply:(.+)$/,
    async ctx => {
        try {
            const id =
                ctx.match[1];

            const whisper =
                getWhisper(id);

            if (!whisper) {
                await ctx.answerCbQuery(
                    "هذه الهمسة غير موجودة.",
                    {
                        show_alert: true
                    }
                );

                return;
            }

            if (
                Number(ctx.from.id) !==
                Number(whisper.recipientId)
            ) {
                await ctx.answerCbQuery(
                    "هذا الزر ليس لك.",
                    {
                        show_alert: true
                    }
                );

                return;
            }

            if (
                hasBlocked(
                    whisper.chatId,
                    whisper.senderId,
                    whisper.recipientId
                )
            ) {
                await ctx.answerCbQuery(
                    "لا يمكنك الرد على هذه الهمسة.",
                    {
                        show_alert: true
                    }
                );

                return;
            }

            // نتأكد من الخاص
            try {
                await ctx.telegram.sendMessage(
                    ctx.from.id,
                    "• أرسل الآن ردك على الهمسة."
                );
            } catch {
                await ctx.answerCbQuery(
                    "افتح البوت في الخاص وأرسل /start أولًا.",
                    {
                        show_alert: true
                    }
                );

                return;
            }

            setState(
                ctx.from.id,
                {
                    type: "whisper_reply",
                    chatId:
                        whisper.chatId,
                    senderId:
                        ctx.from.id,
                    recipientId:
                        whisper.senderId,
                    replyTo:
                        whisper.id
                }
            );

            await ctx.answerCbQuery();

        } catch (err) {
            console.error(
                "whisper reply error:",
                err.message
            );
        }
    }
);

// ======================================================
// استقبال رد الهمسة
// ======================================================

bot.on(
    "message",
    async (ctx, next) => {
        try {
            if (
                ctx.chat?.type !==
                "private"
            ) {
                return next();
            }

            const state =
                getState(
                    ctx.from.id
                );

            if (
                !state ||
                state.type !==
                    "whisper_reply"
            ) {
                return next();
            }

            if (
                !isValidWhisperMessage(
                    ctx.message
                )
            ) {
                await ctx.reply(
                    "• نوع الرسالة غير مدعوم."
                );

                return;
            }

            if (
                hasBlocked(
                    state.chatId,
                    state.recipientId,
                    state.senderId
                )
            ) {
                clearState(
                    ctx.from.id
                );

                await ctx.reply(
                    "• لا يمكنك إرسال الرد لأن هذا العضو قام بحظرك."
                );

                return;
            }

            const whisperId =
                createWhisper({
                    chatId:
                        state.chatId,
                    senderId:
                        state.senderId,
                    recipientId:
                        state.recipientId,
                    sourceChatId:
                        ctx.chat.id,
                    sourceMessageId:
                        ctx.message.message_id
                });

            db.whispers[
                whisperId
            ].replied = true;

            db.whispers[
                whisperId
            ].replyTo =
                state.replyTo;

            saveDB();

            clearState(
                ctx.from.id
            );

            const sender =
                getUser(
                    state.senderId
                );

            const recipient =
                getUser(
                    state.recipientId
                );

            let sent;

            try {
                sent =
                    await ctx.telegram
                        .sendMessage(
                            state.chatId,
                            `• ياحلو ↤ ${mentionById(
                                state.recipientId,
                                recipient.first_name ||
                                recipient.username ||
                                "المستلم"
                            )}\n` +
                            `• وصلتك همسة سرية من ↤ ${mentionById(
                                state.senderId,
                                sender.first_name ||
                                sender.username ||
                                "المرسل"
                            )}\n` +
                            `• انت وحدك تقدر تشوفها`,
                            {
                                parse_mode:
                                    "HTML",
                                reply_markup:
                                    Markup.inlineKeyboard([
                                        [
                                            Markup.button.callback(
                                                "رؤية الهمسة",
                                                `whisper_view:${whisperId}`
                                            ),
                                            Markup.button.callback(
                                                "رد على الهمسة",
                                                `whisper_reply:${whisperId}`
                                            )
                                        ]
                                    ])
                                        .reply_markup
                            }
                        );
            } catch (err) {
                console.error(
                    "whisper reply group error:",
                    err.message
                );
            }

            if (sent) {
                db.whispers[
                    whisperId
                ].groupMessageId =
                    sent.message_id;

                saveDB();
            }

            await ctx.reply(
                "• تم ارسال الهمسة."
            );

        } catch (err) {
            console.error(
                "whisper reply message error:",
                err.message
            );

            return next();
        }
    }
);

// ======================================================
// الأوامر المخصصة
// ======================================================

function getCustomCommands(
    chatId
) {
    const id =
        String(chatId);

    if (!db.customCommands[id]) {
        db.customCommands[id] = {};
    }

    return db.customCommands[id];
}

function getCustomReplies(
    chatId
) {
    const id =
        String(chatId);

    if (!db.customReplies[id]) {
        db.customReplies[id] = {};
    }

    return db.customReplies[id];
}

// ======================================================
// إضافة أمر مخصص
// ======================================================

bot.hears(
    /^اضف امر(?: (.+))?$/i,
    async ctx => {
        if (!isGroup(ctx)) return;

        if (
            !await requireRank(
                ctx,
                "Dev²🎖️"
            )
        ) {
            return;
        }

        const target =
            getReplyTarget(ctx);

        if (!target) {
            await ctx.reply(
                "• يجب عليك عمل ريبلاي على الرسالة التي تريد ربط الأمر بها."
            );

            return;
        }

        const name =
            ctx.message.text
                .replace(
                    /^اضف امر\s*/i,
                    ""
                )
                .trim();

        if (!name) {
            await ctx.reply(
                "• اكتب اسم الأمر بعد اضف امر."
            );

            return;
        }

        setState(
            ctx.from.id,
            {
                type:
                    "custom_command",
                chatId:
                    Number(ctx.chat.id),
                name:
                    normalize(name),
                sourceChatId:
                    Number(ctx.chat.id),
                sourceMessageId:
                    Number(
                        target.message_id ||
                        ctx.message
                            .reply_to_message
                            .message_id
                    )
            }
        );

        await ctx.reply(
            "• أرسل الآن رد الأمر."
        );
    }
);

// ======================================================
// إضافة رد مخصص
// ======================================================

bot.hears(
    /^اضف رد (.+)$/i,
    async ctx => {
        if (!isGroup(ctx)) return;

        if (
            !await requireRank(
                ctx,
                "Dev²🎖️"
            )
        ) {
            return;
        }

        const word =
            ctx.message.text
                .replace(
                    /^اضف رد\s+/i,
                    ""
                )
                .trim();

        if (!word) {
            await ctx.reply(
                "• اكتب الكلمة بعد الأمر."
            );

            return;
        }

        setState(
            ctx.from.id,
            {
                type:
                    "custom_reply",
                chatId:
                    Number(ctx.chat.id),
                word:
                    normalize(word)
            }
        );

        await ctx.reply(
            "• أرسل الآن رد الأمر."
        );
    }
);

// ======================================================
// استقبال رد الأمر المخصص
// ======================================================

bot.on(
    "message",
    async (ctx, next) => {
        try {
            if (
                !isGroup(ctx)
            ) {
                return next();
            }

            const state =
                getState(
                    ctx.from.id
                );

            if (
                !state
            ) {
                return next();
            }

            if (
                state.type ===
                "custom_command"
            ) {
                if (
                    Number(ctx.chat.id) !==
                    Number(state.chatId)
                ) {
                    return next();
                }

                if (
                    !ctx.message
                        .message_id
                ) {
                    return next();
                }

                getCustomCommands(
                    state.chatId
                )[state.name] = {
                    sourceChatId:
                        Number(
                            ctx.chat.id
                        ),
                    sourceMessageId:
                        Number(
                            ctx.message
                                .message_id
                        ),
                    createdBy:
                        Number(
                            ctx.from.id
                        ),
                    createdAt:
                        Date.now()
                };

                clearState(
                    ctx.from.id
                );

                saveDB();

                await ctx.reply(
                    "• تم إضافة الأمر بنجاح."
                );

                return;
            }

            if (
                state.type ===
                "custom_reply"
            ) {
                if (
                    Number(ctx.chat.id) !==
                    Number(state.chatId)
                ) {
                    return next();
                }

                getCustomReplies(
                    state.chatId
                )[state.word] = {
                    sourceChatId:
                        Number(
                            ctx.chat.id
                        ),
                    sourceMessageId:
                        Number(
                            ctx.message
                                .message_id
                        ),
                    createdBy:
                        Number(
                            ctx.from.id
                        ),
                    createdAt:
                        Date.now()
                };

                clearState(
                    ctx.from.id
                );

                saveDB();

                await ctx.reply(
                    "• تم إضافة الرد بنجاح."
                );

                return;
            }

            return next();

        } catch (err) {
            console.error(
                "custom state error:",
                err.message
            );

            return next();
        }
    }
);

// ======================================================
// حذف أمر مخصص
// ======================================================

bot.hears(
    /^حذف امر (.+)$/i,
    async ctx => {
        if (!isGroup(ctx)) return;

        if (
            !await requireRank(
                ctx,
                "Dev²🎖️"
            )
        ) {
            return;
        }

        const name =
            normalize(
                ctx.message.text
                    .replace(
                        /^حذف امر\s+/i,
                        ""
                    )
            );

        const commands =
            getCustomCommands(
                ctx.chat.id
            );

        if (!commands[name]) {
            await ctx.reply(
                "• هذا الأمر غير موجود."
            );

            return;
        }

        delete commands[name];

        saveDB();

        await ctx.reply(
            "• تم حذف الأمر بنجاح."
        );
    }
);

// ======================================================
// حذف رد
// ======================================================

bot.hears(
    /^حذف رد (.+)$/i,
    async ctx => {
        if (!isGroup(ctx)) return;

        if (
            !await requireRank(
                ctx,
                "Dev²🎖️"
            )
        ) {
            return;
        }

        const word =
            normalize(
                ctx.message.text
                    .replace(
                        /^حذف رد\s+/i,
                        ""
                    )
            );

        const replies =
            getCustomReplies(
                ctx.chat.id
            );

        if (!replies[word]) {
            await ctx.reply(
                "• هذا الرد غير موجود."
            );

            return;
            // ======================================================
// TORAYF BOT - PART 4
// البنك + الفلوس + التحويل + الزواج
// ======================================================

// ======================================================
// نظام الفلوس
// ======================================================

function getBalance(userId) {
    const user = getUser(userId);

    return Number(user.balance || 0);
}

function addBalance(userId, amount) {
    const user = getUser(userId);

    user.balance =
        Number(user.balance || 0) +
        Number(amount || 0);

    saveDB();
}

function removeBalance(userId, amount) {
    const user = getUser(userId);

    const value =
        Number(amount || 0);

    if (
        Number(user.balance || 0) <
        value
    ) {
        return false;
    }

    user.balance -= value;

    saveDB();

    return true;
}

// ======================================================
// فلوسي
// ======================================================

bot.hears(
    "فلوسي",
    async ctx => {
        const balance =
            getBalance(
                ctx.from.id
            );

        await ctx.reply(
            `• رصيدك الحالي ↤ ${balance} ريال`
        );
    }
);

// ======================================================
// فلوسه
// ======================================================

bot.hears(
    "فلوسه",
    async ctx => {
        if (!isGroup(ctx)) return;

        const target =
            await requireReply(ctx);

        if (!target) return;

        if (
            await checkCommunicationBlock(
                ctx,
                target.id
            )
        ) {
            return;
        }

        const balance =
            getBalance(
                target.id
            );

        await ctx.reply(
            `${mention(target)}\n• رصيده ↤ ${balance} ريال`,
            replyOptions()
        );
    }
);

// ======================================================
// المتجر
// ======================================================

bot.hears(
    "المتجر",
    async ctx => {
        await ctx.reply(
            "• المتجر\n" +
            "━━━━━━━━━━━━━━\n" +
            "• لا توجد منتجات متاحة حاليًا."
        );
    }
);

// ======================================================
// رقم الحساب البنكي
// ======================================================

function generateAccountNumber() {
    return (
        String(
            Math.floor(
                1000000000 +
                Math.random() *
                9000000000
            )
        )
    );
}

// ======================================================
// إنشاء حساب بنكي
// ======================================================

bot.hears(
    "انشاء حساب بنكي",
    async ctx => {
        if (
            !settingEnabled(
                ctx,
                "bank"
            )
        ) {
            await ctx.reply(
                "• البنك غير مفعل حاليًا."
            );

            return;
        }

        const user =
            getUser(
                ctx.from.id
            );

        if (
            user.bank?.active
        ) {
            await ctx.reply(
                "• لديك حساب بنكي بالفعل.\n• استخدم حسابي لعرض بيانات حسابك."
            );

            return;
        }

        await ctx.reply(
            "• اختر البنك الذي تريد إنشاء الحساب فيه.",
            {
                reply_markup:
                    Markup.inlineKeyboard([
                        [
                            Markup.button.callback(
                                "الراجحي",
                                "bank_create:bank1"
                            ),
                            Markup.button.callback(
                                "الأهلي",
                                "bank_create:bank2"
                            )
                        ],
                        [
                            Markup.button.callback(
                                "البنك الثالث",
                                "bank_create:bank3"
                            )
                        ]
                    ]).reply_markup
            }
        );
    }
);

// ======================================================
// اختيار البنك
// ======================================================

bot.action(
    /^bank_create:(bank1|bank2|bank3)$/,
    async ctx => {
        try {
            if (
                !settingEnabled(
                    ctx,
                    "bank"
                )
            ) {
                await ctx.answerCbQuery(
                    "البنك غير مفعل.",
                    {
                        show_alert: true
                    }
                );

                return;
            }

            const bankKey =
                ctx.match[1];

            const user =
                getUser(
                    ctx.from.id
                );

            if (
                user.bank?.active
            ) {
                await ctx.answerCbQuery(
                    "لديك حساب بنكي بالفعل.",
                    {
                        show_alert: true
                    }
                );

                return;
            }

            const names =
                getSettings(ctx)
                    .bankNames;

            user.bank = {
                active: true,
                name:
                    names[bankKey] ||
                    bankKey,
                accountNumber:
                    generateAccountNumber()
            };

            saveDB();

            await ctx.answerCbQuery(
                "تم إنشاء الحساب."
            );

            await ctx.reply(
                `• تم إنشاء حسابك البنكي بنجاح.\n` +
                `━━━━━━━━━━━━━━\n` +
                `• البنك: ${escapeHTML(user.bank.name)}\n` +
                `• رقم الحساب: ${escapeHTML(user.bank.accountNumber)}`
            );

        } catch (err) {
            console.error(
                "bank create error:",
                err.message
            );
        }
    }
);

// ======================================================
// حسابي
// ======================================================

bot.hears(
    "حسابي",
    async ctx => {
        const user =
            getUser(
                ctx.from.id
            );

        if (
            !user.bank?.active
        ) {
            await ctx.reply(
                "• لا يوجد لديك حساب بنكي.\n• استخدم انشاء حساب بنكي لإنشاء حساب."
            );

            return;
        }

        await ctx.reply(
            `• حسابك البنكي\n` +
            `━━━━━━━━━━━━━━\n` +
            `• البنك: ${escapeHTML(user.bank.name)}\n` +
            `• رقم الحساب: ${escapeHTML(user.bank.accountNumber)}\n` +
            `• الرصيد: ${getBalance(ctx.from.id)} ريال`
        );
    }
);

// ======================================================
// حذف حسابي
// ======================================================

bot.hears(
    "حذف حسابي",
    async ctx => {
        const user =
            getUser(
                ctx.from.id
            );

        if (
            !user.bank?.active
        ) {
            await ctx.reply(
                "• لا يوجد لديك حساب بنكي."
            );

            return;
        }

        user.bank = {
            active: false,
            name: "",
            accountNumber: ""
        };

        saveDB();

        await ctx.reply(
            "• تم حذف حسابك البنكي.\n• رصيدك وبياناتك الأساسية لم يتم حذفها."
        );
    }
);

// ======================================================
// الإهداء / التحويل
// ======================================================

bot.hears(
    /^اهداء\s+(\d+)$/i,
    async ctx => {
        if (!isGroup(ctx)) return;

        const amount =
            Number(
                ctx.match[1]
            );

        if (
            !Number.isSafeInteger(
                amount
            ) ||
            amount <= 0
        ) {
            await ctx.reply(
                "• اكتب مبلغًا صحيحًا."
            );

            return;
        }

        const target =
            await requireReply(ctx);

        if (!target) return;

        if (
            target.id ===
            ctx.from.id
        ) {
            await ctx.reply(
                "• لا يمكنك إهداء نفسك."
            );

            return;
        }

        // البلوك
        if (
            await checkCommunicationBlock(
                ctx,
                target.id
            )
        ) {
            return;
        }

        const balance =
            getBalance(
                ctx.from.id
            );

        if (
            balance < amount
        ) {
            await ctx.reply(
                "رصيدك لا يكفي لإتمام العملية."
            );

            return;
        }

        const removed =
            removeBalance(
                ctx.from.id,
                amount
            );

        if (!removed) {
            await ctx.reply(
                "رصيدك لا يكفي لإتمام العملية."
            );

            return;
        }

        addBalance(
            target.id,
            amount
        );

        const targetName =
            target.username
                ? `@${escapeHTML(target.username)}`
                : mention(target);

        await ctx.reply(
            `تم إهداء ${amount} ريال إلى ${targetName}`,
            replyOptions()
        );

        const sender =
            getUser(
                ctx.from.id
            );

        const receiver =
            getUser(
                target.id
            );

        if (!sender.transferHistory) {
            sender.transferHistory = [];
        }

        if (!receiver.transferHistory) {
            receiver.transferHistory = [];
        }

        sender.transferHistory.push({
            type: "sent",
            amount,
            targetId:
                target.id,
            timestamp:
                Date.now()
        });

        receiver.transferHistory.push({
            type: "received",
            amount,
            targetId:
                ctx.from.id,
            timestamp:
                Date.now()
        });

        saveDB();
    }
);

// ======================================================
// الزواج
// ======================================================

function getMarriageData(
    chatId,
    userId
) {
    const chatKey =
        String(chatId);

    const userKey =
        String(userId);

    if (
        !db.marriage[chatKey]
    ) {
        db.marriage[chatKey] = {};
    }

    if (
        !db.marriage[chatKey][userKey]
    ) {
        db.marriage[chatKey][userKey] = {
            husbandId:
                Number(userId),
            wives: []
        };
    }

    return db.marriage[
        chatKey
    ][userKey];
}

function findMarriage(
    chatId,
    husbandId,
    wifeId
) {
    const data =
        getMarriageData(
            chatId,
            husbandId
        );

    return data.wives.find(
        wife =>
            Number(wife.id) ===
            Number(wifeId)
    );
}

function isMarriedToAnyone(
    chatId,
    userId
) {
    const chatKey =
        String(chatId);

    const users =
        db.marriage[chatKey] || {};

    for (
        const data of
        Object.values(users)
    ) {
        if (
            Number(
                data.husbandId
            ) ===
            Number(userId) &&
            data.wives.length
        ) {
            return true;
        }

        if (
            data.wives.some(
                wife =>
                    Number(wife.id) ===
                    Number(userId)
            )
        ) {
            return true;
        }
    }

    return false;
}

function getWives(
    chatId,
    husbandId
) {
    return getMarriageData(
        chatId,
        husbandId
    ).wives;
}

// ======================================================
// تنفيذ الزواج
// ======================================================

async function performMarriage(
    ctx,
    target,
    amount
) {
    if (!isGroup(ctx)) return;

    if (
        target.id ===
        ctx.from.id
    ) {
        await ctx.reply(
            "• لا يمكنك الزواج من نفسك."
        );

        return;
    }

    if (
        await checkCommunicationBlock(
            ctx,
            target.id
        )
    ) {
        return;
    }

    const husbandId =
        ctx.from.id;

    const wifeId =
        target.id;

    const wives =
        getWives(
            ctx.chat.id,
            husbandId
        );

    if (
        wives.some(
            wife =>
                Number(wife.id) ===
                Number(wifeId)
        )
    ) {
        await ctx.reply(
            "• أنتما متزوجان بالفعل."
        );

        return;
    }

    if (
        wives.length >= 4
    ) {
        await ctx.reply(
            "• لا يمكنك الزواج بأكثر من أربع زوجات."
        );

        return;
    }

    // الزوجة لا تكون زوجة لرجل آخر
    if (
        isMarriedToAnyone(
            ctx.chat.id,
            wifeId
        )
    ) {
        await ctx.reply(
            "• هذا العضو متزوج بالفعل."
        );

        return;
    }

    // الزوج نفسه لا يدخل كزوج لامرأة أخرى
    if (
        isMarriedToAnyone(
            ctx.chat.id,
            husbandId
        )
    ) {
        const own =
            getMarriageData(
                ctx.chat.id,
                husbandId
            );

        if (
            own.wives.length === 0
        ) {
            // يسمح له بالاستمرار
        }
    }

    if (
        getBalance(
            husbandId
        ) < amount
    ) {
        await ctx.reply(
            "رصيدك لا يكفي لإتمام العملية."
        );

        return;
    }

    const removed =
        removeBalance(
            husbandId,
            amount
        );

    if (!removed) {
        await ctx.reply(
            "رصيدك لا يكفي لإتمام العملية."
        );

        return;
    }

    wives.push({
        id:
            Number(wifeId),
        username:
            target.username || "",
        first_name:
            target.first_name || "",
        dowry:
            Number(amount),
        createdAt:
            Date.now()
    });

    saveDB();

    await ctx.reply(
        `مبروك زوجتكم 💍\n` +
        `الزوج: ${mention(ctx.from)}\n` +
        `الزوجة: ${mention(target)}\n` +
        `المهر: ${amount}`,
        replyOptions()
    );
}

// ======================================================
// أوامر الزواج
// ======================================================

bot.hears(
    /^زواج\s+(\d+)$/i,
    async ctx => {
        if (!isGroup(ctx)) return;

        if (
            !getSettings(ctx).games
        ) {
            await ctx.reply(
                "• الألعاب والتسلية مقفلة حاليًا."
            );

            return;
        }

        const amount =
            Number(
                ctx.match[1]
            );

        const wives =
            getWives(
                ctx.chat.id,
                ctx.from.id
            );

        const nextNumber =
            wives.length + 1;

        if (
            nextNumber > 4
        ) {
            await ctx.reply(
                "• وصلت للحد الأقصى للزواج."
            );

            return;
        }

        const expected =
            nextNumber * 1000;

        if (
            amount !== expected
        ) {
            await ctx.reply(
                `• مهر الزوجة رقم ${nextNumber} هو ${expected} ريال.`
            );

            return;
        }

        const target =
            await requireReply(ctx);

        if (!target) return;

        if (
            nextNumber > 1
        ) {
            await ctx.reply(
                `${mention(target)}\n• الحقي زوجك بيتزوج عليك`,
                replyOptions()
            );
        }

        await performMarriage(
            ctx,
            target,
            amount
        );
    }
);

// ======================================================
// أوامر الزواج المحددة
// ======================================================

bot.hears(
    ["زواج الثانيه 2000"],
    async ctx => {
        await marriageNumberCommand(
            ctx,
            2,
            2000
        );
    }
);

bot.hears(
    ["زواج الثالثه 3000"],
    async ctx => {
        await marriageNumberCommand(
            ctx,
            3,
            3000
        );
    }
);

bot.hears(
    ["زواج الرابعه 4000"],
    async ctx => {
        await marriageNumberCommand(
            ctx,
            4,
            4000
        );
    }
);

async function marriageNumberCommand(
    ctx,
    number,
    amount
) {
    if (!isGroup(ctx)) return;

    if (
        !getSettings(ctx).games
    ) {
        await ctx.reply(
            "• الألعاب والتسلية مقفلة حاليًا."
        );

        return;
    }

    const wives =
        getWives(
            ctx.chat.id,
            ctx.from.id
        );

    if (
        wives.length !==
        number - 1
    ) {
        await ctx.reply(
            `• يجب أن تكون هذه الزوجة رقم ${number}.`
        );

        return;
    }

    const target =
        await requireReply(ctx);

    if (!target) return;

    if (
        await checkCommunicationBlock(
            ctx,
            target.id
        )
    ) {
        return;
    }

    await ctx.reply(
        `${mention(target)}\n• الحقي زوجك بيتزوج عليك`,
        replyOptions()
    );

    await performMarriage(
        ctx,
        target,
        amount
    );
}

// ======================================================
// زواجي
// ======================================================

bot.hears(
    "زواجي",
    async ctx => {
        if (!isGroup(ctx)) return;

        const data =
            getMarriageData(
                ctx.chat.id,
                ctx.from.id
            );

        const wives =
            data.wives || [];

        if (!wives.length) {
            await ctx.reply(
                "• لا يوجد لديك زواج حاليًا."
            );

            return;
        }

        let text =
            "• زواجي\n" +
            "━━━━━━━━━━━━━━\n";

        wives.forEach(
            (wife, index) => {
                const name =
                    wife.username
                        ? `@${escapeHTML(wife.username)}`
                        : mentionById(
                            wife.id,
                            wife.first_name ||
                            "زوجة"
                        );

                text +=
                    `• الزوجة ${index + 1}: ${name}\n` +
                    `• المهر: ${Number(wife.dowry || 0)} ريال\n\n`;
            }
        );

        await ctx.reply(
            text,
            replyOptions()
        );
    }
);

// ======================================================
// توب المتزوجين
// ======================================================

bot.hears(
    "توب المتزوجين",
    async ctx => {
        if (!isGroup(ctx)) return;

        const chatData =
            db.marriage[
                String(ctx.chat.id)
            ] || {};

        const list =
            Object.values(
                chatData
            )
                .map(data => ({
                    husbandId:
                        data.husbandId,
                    wives:
                        data.wives || [],
                    total:
                        (data.wives || [])
                            .reduce(
                                (
                                    sum,
                                    wife
                                ) =>
                                    sum +
                                    Number(
                                        wife.dowry ||
                                        0
                                    ),
                                0
                            )
                }))
                .filter(
                    x =>
                        x.wives.length
                )
                .sort(
                    (a, b) =>
                        b.total -
                        a.total
                )
                .slice(0, 10);

        if (!list.length) {
            await ctx.reply(
                "• لا توجد بيانات زواج."
            );

            return;
        }

        let text =
            "• توب المتزوجين\n" +
            "━━━━━━━━━━━━━━\n";

        list.forEach(
            (item, index) => {
                const user =
                    getUser(
                        item.husbandId
                    );

                text +=
                    `${index + 1} - ${mentionById(
                        item.husbandId,
                        user.first_name ||
                        user.username ||
                        "عضو"
                    )}\n` +
                    `• عدد الزوجات: ${item.wives.length}\n` +
                    `• مجموع المهور: ${item.total} ريال\n\n`;
            }
        );

        await ctx.reply(
            text,
            replyOptions()
        );
    }
);
            // ======================================================
// TORAYF BOT - PART 5
// الألعاب + التفاعل + الفعاليات + القروب + المطور
// ======================================================

// ======================================================
// التفاعل
// ======================================================

bot.hears(
    "رتبته",
    async ctx => {
        if (!isGroup(ctx)) return;

        const target =
            await requireReply(ctx);

        if (!target) return;

        await ctx.reply(
            `${mention(target)}\n• الرتبة: ${escapeHTML(getRank(ctx, target.id))}`,
            replyOptions()
        );
    }
);

bot.hears(
    "تفاعله",
    async ctx => {
        if (!isGroup(ctx)) return;

        const target =
            await requireReply(ctx);

        if (!target) return;

        const chat =
            getChat(ctx.chat.id);

        const data =
            chat.users[
                String(target.id)
            ] || {};

        await ctx.reply(
            `${mention(target)}\n` +
            `• الرسائل: ${Number(data.messages || 0)}\n` +
            `• النقاط: ${Number(data.points || 0)}`,
            replyOptions()
        );
    }
);

// ======================================================
// المتفاعلين
// ======================================================

bot.hears(
    "المتفاعلين",
    async ctx => {
        if (!isGroup(ctx)) return;

        const chat =
            getChat(ctx.chat.id);

        const users =
            Object.values(
                chat.users || {}
            )
                .sort(
                    (a, b) =>
                        Number(b.points || 0) -
                        Number(a.points || 0)
                )
                .slice(0, 20);

        if (!users.length) {
            await ctx.reply(
                "• لا توجد بيانات تفاعل."
            );

            return;
        }

        let text =
            "• المتفاعلين\n" +
            "━━━━━━━━━━━━━━\n";

        users.forEach(
            (user, index) => {
                text +=
                    `${index + 1} - ${mentionById(
                        user.id,
                        user.first_name ||
                        user.username ||
                        "عضو"
                    )} ↤ ${Number(
                        user.points || 0
                    )} نقطة\n`;
            }
        );

        await ctx.reply(
            text,
            replyOptions()
        );
    }
);

// ======================================================
// إضافة تفاعل
// ======================================================

bot.hears(
    /^اضف تفاعل (.+)$/i,
    async ctx => {
        if (!isGroup(ctx)) return;

        if (!isTopDev(ctx)) {
            return rankDenied(
                ctx,
                "Dev🎖️"
            );
        }

        const target =
            await requireReply(ctx);

        if (!target) return;

        const amount =
            Number(
                ctx.message.text
                    .replace(
                        /^اضف تفاعل\s+/i,
                        ""
                    )
                    .trim()
            );

        if (
            !Number.isFinite(amount)
        ) {
            await ctx.reply(
                "• اكتب عدد التفاعل بشكل صحيح."
            );

            return;
        }

        const chat =
            getChat(ctx.chat.id);

        const id =
            String(target.id);

        if (!chat.users[id]) {
            chat.users[id] = {
                id:
                    target.id,
                username:
                    target.username || "",
                first_name:
                    target.first_name || "",
                messages: 0,
                points: 0,
                joinedAt:
                    Date.now()
            };
        }

        chat.users[id].points =
            Number(
                chat.users[id].points || 0
            ) + amount;

        saveDB();

        await ctx.reply(
            `• تمت إضافة ${amount} نقطة تفاعل إلى ${mention(target)}.`,
            replyOptions()
        );
    }
);

// ======================================================
// الألعاب
// ======================================================

const GAME_NAMES = [
    "صور",
    "كلمة",
    "ترتيب",
    "مقال",
    "جملة",
    "حروف",
    "خمن",
    "لغز",
    "صح أو خطأ",
    "أكمل",
    "مقلوب",
    "فكك",
    "إيموجي",
    "سرعة",
    "حساب",
    "ذاكرة",
    "من أنا",
    "كلمة السر"
];

const GAME_QUESTIONS = {
    "كلمة": [
        {
            question:
                "ما عكس كلمة: طويل؟",
            answer:
                "قصير"
        },
        {
            question:
                "ما عكس كلمة: كبير؟",
            answer:
                "صغير"
        },
        {
            question:
                "ما جمع كلمة: كتاب؟",
            answer:
                "كتب"
        }
    ],

    "ترتيب": [
        {
            question:
                "رتب الحروف لتكوين كلمة: ب ت ك ا",
            answer:
                "كتاب"
        },
        {
            question:
                "رتب الحروف لتكوين كلمة: م ل ق",
            answer:
                "قلم"
        }
    ],

    "جملة": [
        {
            question:
                "أكمل: العلم نور و ____",
            answer:
                "الجهل ظلام"
        },
        {
            question:
                "أكمل: من جد ____",
            answer:
                "وجد"
        }
    ],

    "حروف": [
        {
            question:
                "اذكر كلمة تبدأ بحرف م",
            answer:
                "م"
        },
        {
            question:
                "اذكر كلمة تبدأ بحرف س",
            answer:
                "س"
        }
    ],

    "لغز": [
        {
            question:
                "شيء له أسنان ولا يعض، ما هو؟",
            answer:
                "المشط"
        },
        {
            question:
                "شيء نراه ولا نستطيع لمسه، ما هو؟",
            answer:
                "الظل"
        }
    ],

    "صح أو خطأ": [
        {
            question:
                "الشمس نجم.",
            answer:
                "صح"
        },
        {
            question:
                "الأرض أكبر من الشمس.",
            answer:
                "خطأ"
        }
    ],

    "أكمل": [
        {
            question:
                "أكمل المثل: الصديق وقت ____",
            answer:
                "الضيق"
        },
        {
            question:
                "أكمل: لكل مجتهد ____",
            answer:
                "نصيب"
        }
    ],

    "مقلوب": [
        {
            question:
                "ما الكلمة الناتجة من قلب: باب؟",
            answer:
                "باب"
        },
        {
            question:
                "اقلب كلمة: قلم",
            answer:
                "ملق"
        }
    ],

    "فكك": [
        {
            question:
                "فكك كلمة: كتاب",
            answer:
                "ك ت ا ب"
        }
    ],

    "حساب": [
        {
            question:
                "كم يساوي 7 + 8؟",
            answer:
                "15"
        },
        {
            question:
                "كم يساوي 9 × 3؟",
            answer:
                "27"
        },
        {
            question:
                "كم يساوي 40 - 17؟",
            answer:
                "23"
        }
    ],

    "كلمة السر": [
        {
            question:
                "ما الكلمة التي تعني مكانًا للتعلم؟",
            answer:
                "مدرسة"
        }
    ],

    "من أنا": [
        {
            question:
                "أنا كوكب نعيش عليه، من أنا؟",
            answer:
                "الارض"
        }
    ]
};

function normalizeGameAnswer(
    text
) {
    return normalize(
        text
    )
        .replace(
            /[\u064B-\u065F]/g,
            ""
        )
        .replace(
            /[\u0640]/g,
            ""
        );
}

function getGame(
    chatId
) {
    return db.games[
        String(chatId)
    ];
}

function stopGame(
    chatId
) {
    delete db.games[
        String(chatId)
    ];

    saveDB();
}

function chooseRandom(
    array
) {
    return array[
        Math.floor(
            Math.random() *
            array.length
        )
    ];
}

// ======================================================
// بدء لعبة
// ======================================================

async function startGame(
    ctx,
    gameName
) {
    if (!isGroup(ctx)) return;

    if (
        !getSettings(ctx).games
    ) {
        await ctx.reply(
            "• الألعاب والتسلية مقفلة حاليًا."
        );

        return;
    }

    const existing =
        getGame(ctx.chat.id);

    if (existing) {
        await ctx.reply(
            "• توجد لعبة قيد التشغيل حاليًا."
        );

        return;
    }

    let questions =
        GAME_QUESTIONS[
            gameName
        ];

    // الألعاب التي تحتاج محتوى خاص
    if (
        !questions ||
        !questions.length
    ) {
        questions = [
            {
                question:
                    `اكتب أي كلمة للعبة ${gameName}.`,
                answer:
                    "*"
            }
        ];
    }

    const item =
        chooseRandom(
            questions
        );

    const startedAt =
        Date.now();

    db.games[
        String(ctx.chat.id)
    ] = {
        type:
            gameName,
        question:
            item.question,
        answer:
            normalizeGameAnswer(
                item.answer
            ),
        startedAt,
        players: [],
        winnerId: null,
        createdBy:
            ctx.from.id
    };

    saveDB();

    await ctx.reply(
        `• بدأت لعبة ${escapeHTML(gameName)}\n` +
        `━━━━━━━━━━━━━━\n` +
        `• السؤال: ${escapeHTML(item.question)}\n` +
        `• أول إجابة صحيحة تفوز بـ 10 ريال.`
    );
}

// ======================================================
// أوامر الألعاب
// ======================================================

bot.hears(
    GAME_NAMES,
    async ctx => {
        const gameName =
            normalize(
                ctx.message.text
            );

        if (
            GAME_NAMES.includes(
                gameName
            )
        ) {
            await startGame(
                ctx,
                gameName
            );
        }
    }
);

// ======================================================
// الإجابات
// ======================================================

bot.on(
    "text",
    async (ctx, next) => {
        try {
            if (!isGroup(ctx)) {
                return next();
            }

            const game =
                getGame(
                    ctx.chat.id
                );

            if (!game) {
                return next();
            }

            const answer =
                normalizeGameAnswer(
                    ctx.message.text
                );

            if (
                game.answer !== "*" &&
                answer !== game.answer
            ) {
                return next();
            }

            if (
                game.answer === "*"
            ) {
                return next();
            }

            if (
                game.winnerId
            ) {
                return next();
            }

            const finishedAt =
                Date.now();

            const seconds =
                (
                    finishedAt -
                    game.startedAt
                ) / 1000;

            game.winnerId =
                ctx.from.id;

            const user =
                getUser(
                    ctx.from.id
                );

            addBalance(
                ctx.from.id,
                10
            );

            if (!user.gameStats) {
                user.gameStats = {
                    played: 0,
                    wins: 0,
                    correct: 0,
                    bestSpeed: null
                };
            }

            user.gameStats.played++;
            user.gameStats.wins++;
            user.gameStats.correct++;

            if (
                user.gameStats.bestSpeed === null ||
                seconds <
                    user.gameStats.bestSpeed
            ) {
                user.gameStats.bestSpeed =
                    seconds;
            }

            let speed =
                "بطيء";

            if (seconds <= 3) {
                speed = "سريع";
            } else if (
                seconds <= 8
            ) {
                speed = "متوسط";
            }

            saveDB();

            await ctx.reply(
                `كفو عليك👏🏻\n` +
                `الوقت: ${seconds.toFixed(2)} ثانية\n` +
                `السرعه: ${speed}\n` +
                `فلوسك: ${getBalance(
                    ctx.from.id
                )} ريال`
            );

            stopGame(
                ctx.chat.id
            );

            return;

        } catch (err) {
            console.error(
                "game answer error:",
                err.message
            );

            return next();
        }
    }
);

// ======================================================
// قفل الألعاب
// ======================================================

bot.hears(
    "قفل الالعاب",
    async ctx => {
        if (!isGroup(ctx)) return;

        if (!isTopDev(ctx)) {
            return rankDenied(
                ctx,
                "Dev🎖️"
            );
        }

        setSetting(
            ctx,
            "games",
            false
        );

        stopGame(
            ctx.chat.id
        );

        await ctx.reply(
            "• تم قفل الألعاب والتسلية."
        );
    }
);

// ======================================================
// فتح الألعاب
// ======================================================

bot.hears(
    "فتح الالعاب",
    async ctx => {
        if (!isGroup(ctx)) return;

        if (!isTopDev(ctx)) {
            return rankDenied(
                ctx,
                "Dev🎖️"
            );
        }

        setSetting(
            ctx,
            "games",
            true
        );

        await ctx.reply(
            "• تم فتح الألعاب والتسلية."
        );
    }
);

// ======================================================
// الفعاليات
// ======================================================

bot.hears(
    "فعالية",
    async ctx => {
        if (!isGroup(ctx)) return;

        if (!getSettings(ctx).games) {
            await ctx.reply(
                "• الألعاب والفعاليات مقفلة حاليًا."
            );

            return;
        }

        await ctx.reply(
            "• الفعاليات المتاحة\n" +
            "━━━━━━━━━━━━━━\n" +
            "• فعالية سرعة\n" +
            "• فعالية أسئلة\n" +
            "• فعالية حروف\n" +
            "• فعالية تخمين"
        );
    }
);

bot.hears(
    "ابدأ فعالية",
    async ctx => {
        if (!isGroup(ctx)) return;

        if (!isTopDev(ctx)) {
            return rankDenied(
                ctx,
                "Dev🎖️"
            );
        }

        if (!getSettings(ctx).games) {
            await ctx.reply(
                "• الألعاب والفعاليات مقفلة حاليًا."
            );

            return;
        }

        await startGame(
            ctx,
            "سرعة"
        );
    }
);

// ======================================================
// @all
// ======================================================

bot.hears(
    "@all",
    async ctx => {
        if (!isGroup(ctx)) return;

        if (
            !getSettings(ctx)
                .mentionOpen
        ) {
            return;
        }

        const chat =
            getChat(
                ctx.chat.id
            );

        const users =
            Object.values(
                chat.users || {}
            );

        if (!users.length) {
            await ctx.reply(
                "• لا يوجد أعضاء محفوظون للمنشن."
            );

            return;
        }

        let text = "";

        for (
            const user of users
        ) {
            if (!user.id) continue;

            text +=
                `${mentionById(
                    user.id,
                    user.first_name ||
                    user.username ||
                    "عضو"
                )} `;
        }

        const chunks = [];

        while (
            text.length > 3500
        ) {
            chunks.push(
                text.slice(
                    0,
                    3500
                )
            );

            text =
                text.slice(
                    3500
                );
        }

        if (text.length) {
            chunks.push(text);
        }

        for (
            const chunk of chunks
        ) {
            await ctx.reply(
                chunk,
                {
                    parse_mode:
                        "HTML",
                    disable_web_page_preview:
                        true
                }
            );
        }
    }
);

// ======================================================
// فتح / غلق المنشن
// ======================================================

bot.hears(
    ["فتح المنشن", "غلق المنشن"],
    async ctx => {
        if (!isGroup(ctx)) return;

        if (!isTopDev(ctx)) {
            return rankDenied(
                ctx,
                "Dev🎖️"
            );
        }

        const open =
            normalize(
                ctx.message.text
            ) ===
            "فتح المنشن";

        setSetting(
            ctx,
            "mentionOpen",
            open
        );

        await ctx.reply(
            `• تم ${open ? "فتح" : "غلق"} المنشن.`
        );
    }
);

// ======================================================
// القروب
// ======================================================

bot.hears(
    "قروب",
    async ctx => {
        if (!isGroup(ctx)) return;

        const chat =
            getChat(
                ctx.chat.id
            );

        let memberCount =
            "غير معروف";

        try {
            memberCount =
                await ctx.telegram
                    .getChatMemberCount(
                        ctx.chat.id
                    );
        } catch {}

        await ctx.reply(
            `• معلومات القروب\n` +
            `━━━━━━━━━━━━━━\n` +
            `• الاسم: ${escapeHTML(
                chat.title ||
                ctx.chat.title ||
                "بدون اسم"
            )}\n` +
            `• الأعضاء: ${memberCount}\n` +
            `• الحماية: ${
                chat.settings.protection
                    ? "مفعلة"
                    : "معطلة"
            }`
        );
    }
);

// ======================================================
// القوانين
// ======================================================

bot.hears(
    "القوانين",
    async ctx => {
        if (!isGroup(ctx)) return;

        const chat =
            getChat(
                ctx.chat.id
            );

        if (!chat.rules) {
            await ctx.reply(
                "• لم يتم تعيين قوانين للقروب."
            );

            return;
        }

        await ctx.reply(
            chat.rules
        );
    }
);

// ======================================================
// تعيين القوانين
// ======================================================

bot.hears(
    /^تعيين القوانين (.+)$/i,
    async ctx => {
        if (!isGroup(ctx)) return;

        if (!isTopDev(ctx)) {
            return rankDenied(
                ctx,
                "Dev🎖️"
            );
        }

        const rules =
            ctx.message.text
                .replace(
                    /^تعيين القوانين\s+/i,
                    ""
                )
                .trim();

        const chat =
            getChat(
                ctx.chat.id
            );

        chat.rules =
            rules;

        saveDB();

        await ctx.reply(
            "• تم تعيين قوانين القروب."
        );
    }
);

// ======================================================
// معلومات المستخدم للمطور
// ======================================================

bot.hears(
    "ا",
    async ctx => {
        if (!isGroup(ctx)) return;

        if (!isDev(ctx)) {
            return rankDenied(
                ctx,
                "Dev²🎖️"
            );
        }

        const target =
            getReplyTarget(ctx) ||
            ctx.from;

        const user =
            getUser(
                target.id
            );

        await ctx.reply(
            `• معلومات المستخدم\n` +
            `━━━━━━━━━━━━━━\n` +
            `• الاسم: ${mention(target)}\n` +
            `• المعرف: ${
                target.username
                    ? "@" +
                      escapeHTML(
                          target.username
                      )
                    : "غير موجود"
            }\n` +
            `• الآيدي: ${target.id}\n` +
            `• الرتبة: ${escapeHTML(
                getRank(
                    ctx,
                    target.id
                )
            )}\n` +
            `• الرصيد: ${Number(
                user.balance || 0
            )}`,
            replyOptions()
        );
    }
);

// ======================================================
// حالة البوت
// ======================================================

bot.hears(
    "حالة البوت",
    async ctx => {
        if (!isDev(ctx)) {
            return rankDenied(
                ctx,
                "Dev²🎖️"
            );
        }

        await ctx.reply(
            "• البوت يعمل حاليًا بشكل طبيعي."
        );
    }
);

// ======================================================
// احصائيات البوت
// ======================================================

bot.hears(
    "احصائيات البوت",
    async ctx => {
        if (!isDev(ctx)) {
            return rankDenied(
                ctx,
                "Dev²🎖️"
            );
        }

        const users =
            Object.keys(
                db.users || {}
            ).length;

        const chats =
            Object.keys(
                db.chats || {}
            ).length;

        const subscribers =
            Array.isArray(
                db.subscribers
            )
                ? db.subscribers.length
                : 0;

        await ctx.reply(
            `• احصائيات البوت\n` +
            `━━━━━━━━━━━━━━\n` +
            `• المستخدمين: ${users}\n` +
            `• القروبات: ${chats}\n` +
            `• المشتركين: ${subscribers}`
        );
    }
);

// ======================================================
// قائمة المطورين
// ======================================================

bot.hears(
    "قائمة المطورين",
    async ctx => {
        if (!isTopDev(ctx)) {
            return rankDenied(
                ctx,
                "Dev🎖️"
            );
        }

        const dev =
            db.developers.dev || [];

        const dev2 =
            db.developers.dev2 || [];

        let text =
            "• قائمة المطورين\n" +
            "━━━━━━━━━━━━━━\n" +
            "• Dev🎖️:\n";

        if (!dev.length) {
            text +=
                "لا يوجد\n";
        } else {
            dev.forEach(
                id => {
                    const user =
                        getUser(id);

                    text +=
                        `- ${mentionById(
                            id,
                            user.first_name ||
                            user.username ||
                            "مطور"
                        )}\n`;
                }
            );
        }

        text +=
            "\n• Dev²🎖️:\n";

        if (!dev2.length) {
            text +=
                "لا يوجد";
        } else {
            dev2.forEach(
                id => {
                    const user =
                        getUser(id);

                    text +=
                        `- ${mentionById(
                            id,
                            user.first_name ||
                            user.username ||
                            "مطور"
                        )}\n`;
                }
            );
        }

        await ctx.reply(
            text,
            replyOptions()
        );
    }
);

// ======================================================
// مسح المطورين
// ======================================================

bot.hears(
    "مسح المطورين",
    async ctx => {
        if (!isTopDev(ctx)) {
            return rankDenied(
                ctx,
                "Dev🎖️"
            );
        }

        db.developers.dev = [];
        db.developers.dev2 = [];

        saveDB();

        await ctx.reply(
            "• تم مسح قائمة المطورين."
        );
    }
);
            // ======================================================
// TORAYF BOT - PART 6
// الحماية + المشرفين + المطور + القوائم + التشغيل
// ======================================================

// ======================================================
// أدوات الحماية
// ======================================================

function messageHasLink(text = "") {
    return /(https?:\/\/|www\.|t\.me\/|telegram\.me\/)/i.test(text);
}

function messageHasMention(text = "") {
    return /(^|\s)@\w+/i.test(text);
}

function messageHasPhone(text = "") {
    return /(?:\+?966|05)\s*\d{3}\s*\d{4}/.test(text);
}

function messageHasEnglish(text = "") {
    return /[A-Za-z]{3,}/.test(text);
}

function messageLooksLikeAd(text = "") {
    return /(للبيع|للاشتراك|اعلان|إعلان|تواصل معنا|خصم|عرض خاص|متوفر|متوفره|متوفرة|واتساب|واتس|سناب|انستا|انستقرام)/i.test(text);
}

function isRepeatedMessage(chatId, userId, text) {
    const chat = getChat(chatId);

    if (!chat.recentMessages) {
        chat.recentMessages = [];
    }

    const normalizedText = normalize(text);

    const recent = chat.recentMessages
        .filter(x => x.userId === userId)
        .slice(-5);

    return recent.some(
        x => normalize(x.text || "") === normalizedText
    );
}

function rememberProtectionMessage(chatId, userId, text) {
    const chat = getChat(chatId);

    if (!chat.recentMessages) {
        chat.recentMessages = [];
    }

    chat.recentMessages.push({
        userId,
        text,
        time: Date.now()
    });

    if (chat.recentMessages.length > 100) {
        chat.recentMessages =
            chat.recentMessages.slice(-100);
    }
}

async function sendProtectionWarning(
    ctx,
    reason
) {
    const user = ctx.from;

    const messages = {
        edits:
            "منشن الحساب، ممنوع إرسال تعديل الرسائل.",
        links:
            "منشن الحساب، ممنوع إرسال الروابط.",
        repeat:
            "منشن الحساب، ممنوع تكرار الرسائل.",
        ads:
            "منشن الحساب، ممنوع إرسال الإعلانات.",
        mentions:
            "منشن الحساب، ممنوع إرسال المنشنات.",
        forwards:
            "منشن الحساب، ممنوع إرسال الفوروارد.",
        photos:
            "منشن الحساب، ممنوع إرسال الصور.",
        videos:
            "منشن الحساب، ممنوع إرسال الفيديوهات.",
        files:
            "منشن الحساب، ممنوع إرسال الملفات.",
        stickers:
            "منشن الحساب، ممنوع إرسال الملصقات.",
        english:
            "منشن الحساب، ممنوع إرسال الكلام الإنجليزي.",
        phone:
            "منشن الحساب، ممنوع إرسال أرقام الجوال."
    };

    await ctx.reply(
        messages[reason] ||
        "منشن الحساب، هذه الرسالة مخالفة."
    );

    addViolation(
        ctx,
        user.id,
        reason
    );
}

// ======================================================
// المخالفات
// ======================================================

function addViolation(
    ctx,
    userId,
    reason
) {
    const chat = getChat(ctx.chat.id);

    if (!chat.violations) {
        chat.violations = {};
    }

    const id = String(userId);

    if (!chat.violations[id]) {
        chat.violations[id] = {
            count: 0,
            reasons: []
        };
    }

    chat.violations[id].count++;

    chat.violations[id].reasons.push({
        reason,
        time: Date.now()
    });

    const settings =
        getSettings(ctx);

    const count =
        chat.violations[id].count;

    saveDB();

    if (
        settings.autoMute &&
        count >= Number(settings.warningLimit || 3)
    ) {
        muteUser(
            ctx,
            userId,
            settings.autoMuteDuration || 3600
        ).catch(() => {});
    }

    if (
        settings.autoBan &&
        count >= Number(settings.warningLimit || 3) * 2
    ) {
        banUser(
            ctx,
            userId
        ).catch(() => {});
    }
}

function getUserViolationCount(
    ctx,
    userId
) {
    const chat =
        getChat(ctx.chat.id);

    return Number(
        chat.violations?.[String(userId)]?.count || 0
    );
}

// ======================================================
// مسح المخالفات
// ======================================================

bot.hears(
    "مسح المخالفات",
    async ctx => {
        if (!isGroup(ctx)) return;

        if (!isDev(ctx)) {
            return rankDenied(
                ctx,
                "Dev²🎖️"
            );
        }

        const chat =
            getChat(ctx.chat.id);

        chat.violations = {};

        saveDB();

        await ctx.reply(
            "• تم مسح جميع مخالفات القروب."
        );
    }
);

// ======================================================
// مسح إنذارات عضو
// ======================================================

bot.hears(
    "مسح الانذارات",
    async ctx => {
        if (!isGroup(ctx)) return;

        if (!hasRank(ctx, 3)) {
            return rankDenied(
                ctx,
                "مالك أساسي"
            );
        }

        const target =
            await requireReply(ctx);

        if (!target) return;

        const chat =
            getChat(ctx.chat.id);

        delete chat.violations[
            String(target.id)
        ];

        saveDB();

        await ctx.reply(
            `• تم مسح إنذارات ${mention(target)}.`,
            replyOptions()
        );
    }
);

// ======================================================
// إعدادات الحماية
// ======================================================

const PROTECTION_SETTINGS = {
    "الحماية": "protection",
    "الحماية التلقائية": "autoProtection",
    "منع الروابط": "antiLinks",
    "التعديل": "antiEdits",
    "التكرار": "antiRepeat",
    "الإعلانات": "antiAds",
    "المنشن": "antiMentions",
    "الفوروارد": "antiForwards",
    "الصور": "antiPhotos",
    "الفيديوهات": "antiVideos",
    "الملفات": "antiFiles",
    "الملصقات": "antiStickers",
    "الكلام الإنجليزي": "antiEnglish",
    "أرقام الجوال": "antiPhones",
    "الإنذارات": "warnings",
    "الكتم التلقائي": "autoMute",
    "الحظر التلقائي": "autoBan"
};

bot.hears(
    /^(تفعيل|تعطيل) (الحماية|الحماية التلقائية|منع الروابط|التعديل|التكرار|الإعلانات|المنشن|الفوروارد|الصور|الفيديوهات|الملفات|الملصقات|الكلام الإنجليزي|أرقام الجوال|الإنذارات|الكتم التلقائي|الحظر التلقائي)$/i,
    async ctx => {
        if (!isGroup(ctx)) return;

        if (!isTopDev(ctx)) {
            return rankDenied(
                ctx,
                "Dev🎖️"
            );
        }

        const match =
            ctx.message.text.match(
                /^(تفعيل|تعطيل)\s+(.+)$/i
            );

        if (!match) return;

        const action =
            match[1];

        const name =
            normalize(match[2]);

        const key =
            PROTECTION_SETTINGS[name];

        if (!key) return;

        setSetting(
            ctx,
            key,
            action === "تفعيل"
        );

        await ctx.reply(
            `• تم ${action} ${match[2]}.`
        );
    }
);

// ======================================================
// حالة الحماية
// ======================================================

bot.hears(
    "حالة الحماية",
    async ctx => {
        if (!isGroup(ctx)) return;

        const settings =
            getSettings(ctx);

        await ctx.reply(
            `• حالة الحماية\n` +
            `━━━━━━━━━━━━━━\n` +
            `• الحماية: ${settings.protection ? "مفعلة" : "معطلة"}\n` +
            `• الحماية التلقائية: ${settings.autoProtection ? "مفعلة" : "معطلة"}\n` +
            `• منع الروابط: ${settings.antiLinks ? "مفعل" : "معطل"}\n` +
            `• التعديل: ${settings.antiEdits ? "مفعل" : "معطل"}\n` +
            `• التكرار: ${settings.antiRepeat ? "مفعل" : "معطل"}\n` +
            `• الإعلانات: ${settings.antiAds ? "مفعلة" : "معطلة"}\n` +
            `• المنشن: ${settings.antiMentions ? "مفعل" : "معطل"}\n` +
            `• الفوروارد: ${settings.antiForwards ? "مفعل" : "معطل"}\n` +
            `• الصور: ${settings.antiPhotos ? "مفعلة" : "معطلة"}\n` +
            `• الفيديوهات: ${settings.antiVideos ? "مفعلة" : "معطلة"}\n` +
            `• الملفات: ${settings.antiFiles ? "مفعلة" : "معطلة"}\n` +
            `• الملصقات: ${settings.antiStickers ? "مفعلة" : "معطلة"}`
        );
    }
);

// ======================================================
// حماية الرسائل
// ======================================================

bot.on(
    "message",
    async (ctx, next) => {
        try {
            if (!isGroup(ctx)) {
                return next();
            }

            const settings =
                getSettings(ctx);

            if (!settings.protection) {
                return next();
            }

            const userId =
                ctx.from.id;

            const rank =
                getRankLevel(
                    ctx,
                    userId
                );

            // أصحاب الرتب مستثنون من الحماية
            if (rank >= 1) {
                return next();
            }

            const message =
                ctx.message;

            const text =
                message.text ||
                message.caption ||
                "";

            let reason = null;

            if (
                settings.antiLinks &&
                messageHasLink(text)
            ) {
                reason = "links";
            }

            else if (
                settings.antiMentions &&
                messageHasMention(text)
            ) {
                reason = "mentions";
            }

            else if (
                settings.antiPhones &&
                messageHasPhone(text)
            ) {
                reason = "phone";
            }

            else if (
                settings.antiAds &&
                messageLooksLikeAd(text)
            ) {
                reason = "ads";
            }

            else if (
                settings.antiEnglish &&
                messageHasEnglish(text)
            ) {
                reason = "english";
            }

            else if (
                settings.antiRepeat &&
                text &&
                isRepeatedMessage(
                    ctx.chat.id,
                    userId,
                    text
                )
            ) {
                reason = "repeat";
            }

            else if (
                settings.antiForwards &&
                (
                    message.forward_origin ||
                    message.forward_from ||
                    message.forward_from_chat
                )
            ) {
                reason = "forwards";
            }

            else if (
                settings.antiPhotos &&
                message.photo
            ) {
                reason = "photos";
            }

            else if (
                settings.antiVideos &&
                message.video
            ) {
                reason = "videos";
            }

            else if (
                settings.antiFiles &&
                message.document
            ) {
                reason = "files";
            }

            else if (
                settings.antiStickers &&
                message.sticker
            ) {
                reason = "stickers";
            }

            if (text) {
                rememberProtectionMessage(
                    ctx.chat.id,
                    userId,
                    text
                );
            }

            if (!reason) {
                return next();
            }

            try {
                await ctx.deleteMessage();
            } catch {}

            await sendProtectionWarning(
                ctx,
                reason
            );

        } catch (err) {
            console.error(
                "protection error:",
                err.message
            );

            return next();
        }
    }
);

// ======================================================
// تعديل الرسائل
// ======================================================

bot.on(
    "edited_message",
    async ctx => {
        try {
            if (!isGroup(ctx)) return;

            const settings =
                getSettings(ctx);

            if (
                !settings.protection ||
                !settings.antiEdits
            ) {
                return;
            }

            const userId =
                ctx.from?.id;

            if (!userId) return;

            if (
                getRankLevel(
                    ctx,
                    userId
                ) >= 1
            ) {
                return;
            }

            try {
                await ctx.deleteMessage();
            } catch {}

            await ctx.reply(
                "منشن الحساب، ممنوع إرسال تعديل الرسائل."
            );

            addViolation(
                ctx,
                userId,
                "edits"
            );

        } catch (err) {
            console.error(
                "edited message error:",
                err.message
            );
        }
    }
);

// ======================================================
// رفع مشرف / ترقيه
// ======================================================

function getAdminPermissionList() {
    return [
        ["can_delete_messages", "حذف الرسائل"],
        ["can_pin_messages", "تثبيت الرسائل"],
        ["can_restrict_members", "تقييد المستخدمين"],
        ["can_invite_users", "دعوة المستخدمين"],
        ["can_promote_members", "إضافة مشرفين"],
        ["can_change_info", "تعديل معلومات المجموعة"],
        ["can_manage_topics", "إدارة المواضيع"],
        ["can_manage_video_chats", "إدارة المكالمات"],
        ["can_manage_stories", "إدارة القصص"]
    ];
}

async function showPromotionPermissions(
    ctx,
    target
) {
    const permissions = {};

    getAdminPermissionList().forEach(
        ([key]) => {
            permissions[key] = false;
        }
    );

    const token =
        makeId();

    if (!db.tempPerms) {
        db.tempPerms = {};
    }

    db.tempPerms[token] = {
        chatId:
            ctx.chat.id,
        targetId:
            target.id,
        permissions,
        createdBy:
            ctx.from.id
    };

    const rows = [];

    getAdminPermissionList()
        .forEach(
            ([key, name]) => {
                rows.push([
                    Markup.button.callback(
                        `${name}: لا`,
                        `perm:${token}:${key}`
                    )
                ]);
            }
        );

    rows.push([
        Markup.button.callback(
            "حفظ الصلاحيات",
            `perm_save:${token}`
        )
    ]);

    rows.push([
        Markup.button.callback(
            "إخفاء الأمر",
            `perm_hide:${token}`
        )
    ]);

    await ctx.reply(
        `• صلاحيات المستخدم\n\n${mention(target)}`,
        {
            parse_mode: "HTML",
            reply_markup:
                Markup.inlineKeyboard(
                    rows
                ).reply_markup
        }
    );

    saveDB();
}

bot.hears(
    ["رفع مشرف", "ترقيه"],
    async ctx => {
        if (!isGroup(ctx)) return;

        if (!isDev(ctx)) {
            return rankDenied(
                ctx,
                "Dev²🎖️"
            );
        }

        const target =
            await requireReply(ctx);

        if (!target) return;

        if (
            !canControlUser(
                ctx,
                target.id
            )
        ) {
            await ctx.reply(
                "• لا يمكنك تعديل صلاحيات هذا المستخدم."
            );

            return;
        }

        await showPromotionPermissions(
            ctx,
            target
        );
    }
);

bot.action(
    /^perm:([^:]+):(.+)$/,
    async ctx => {
        try {
            const token =
                ctx.match[1];

            const key =
                ctx.match[2];

            const data =
                db.tempPerms?.[token];

            if (!data) {
                await ctx.answerCbQuery(
                    "انتهت صلاحية الأمر."
                );

                return;
            }

            if (
                data.createdBy !==
                ctx.from.id
            ) {
                await ctx.answerCbQuery(
                    "هذا الزر ليس لك."
                );

                return;
            }

            data.permissions[key] =
                !data.permissions[key];

            const rows = [];

            getAdminPermissionList()
                .forEach(
                    ([permissionKey, name]) => {
                        rows.push([
                            Markup.button.callback(
                                `${name}: ${
                                    data.permissions[
                                        permissionKey
                                    ]
                                        ? "نعم"
                                        : "لا"
                                }`,
                                `perm:${token}:${permissionKey}`
                            )
                        ]);
                    }
                );

            rows.push([
                Markup.button.callback(
                    "حفظ الصلاحيات",
                    `perm_save:${token}`
                )
            ]);

            rows.push([
                Markup.button.callback(
                    "إخفاء الأمر",
                    `perm_hide:${token}`
                )
            ]);

            await ctx.editMessageReplyMarkup(
                Markup.inlineKeyboard(
                    rows
                ).reply_markup
            );
            // ==============================
// PART 6 — الحماية + المشرفين + الإذاعة + القنوات + المطور + القائمة
// ==============================

// ---------- أدوات الحماية ----------

function protectionContainsLink(text = "") {
    return /(https?:\/\/|www\.|t\.me\/|telegram\.me\/|bit\.ly\/|discord\.gg\/)/i.test(text);
}

function protectionContainsMention(text = "") {
    return /(^|\s)@[A-Za-z0-9_]{3,}/.test(text);
}

function protectionContainsPhone(text = "") {
    return /(?:\+?\d[\d\s\-()]{7,}\d)/.test(text);
}

function protectionContainsEnglish(text = "") {
    return /[A-Za-z]{3,}/.test(text);
}

function protectionLooksLikeAd(text = "") {
    return /(للبيع|متوفر|عرض|خصم|اطلب|تواصل|واتساب|متجر|اعلان|إعلان|سعر خاص|تخفيض)/i.test(text);
}

function protectionIsRepeated(chatId, userId, text) {
    const chat = getChat(chatId);
    if (!chat.recentMessages) chat.recentMessages = {};

    if (!chat.recentMessages[userId]) {
        chat.recentMessages[userId] = [];
    }

    const list = chat.recentMessages[userId];
    const normalizedText = normalize(text);

    const repeated = list.some(x => x === normalizedText);

    list.push(normalizedText);

    if (list.length > 5) {
        list.shift();
    }

    saveDB();
    return repeated;
}

function protectionMediaType(message) {
    if (!message) return null;

    if (message.photo) return "photos";
    if (message.video) return "videos";
    if (message.document) return "files";
    if (message.sticker) return "stickers";
    if (message.animation) return "gifs";
    if (message.audio) return "audio";
    if (message.voice) return "voice";

    return null;
}

function protectionWarningText(type, user) {
    const m = mention(user);

    const messages = {
        edit: `${m}، ممنوع إرسال تعديل الرسائل.`,
        link: `${m}، ممنوع إرسال الروابط.`,
        repeat: `${m}، ممنوع تكرار الرسائل.`,
        ad: `${m}، ممنوع إرسال الإعلانات.`,
        mention: `${m}، ممنوع إرسال المنشنات.`,
        forward: `${m}، ممنوع إرسال الفوروارد.`,
        photos: `${m}، ممنوع إرسال الصور.`,
        videos: `${m}، ممنوع إرسال الفيديوهات.`,
        files: `${m}، ممنوع إرسال الملفات.`,
        stickers: `${m}، ممنوع إرسال الملصقات.`,
        gifs: `${m}، ممنوع إرسال القيف.`,
        audio: `${m}، ممنوع إرسال الملفات الصوتية.`,
        voice: `${m}، ممنوع إرسال البصمات.`,
        phone: `${m}، ممنوع إرسال أرقام التواصل.`,
        english: `${m}، ممنوع إرسال الكلام بالإنجليزي.`,
        forbidden: `${m}، الرسالة تحتوي على كلمة ممنوعة.`
    };

    return messages[type] || `${m}، هذه الرسالة مخالفة.`;
}

async function protectionPunish(ctx, userId, type) {
    const chatId = ctx.chat.id;
    const user = getUser(userId);

    const chat = getChat(chatId);
    if (!chat.violations) chat.violations = {};

    if (!chat.violations[userId]) {
        chat.violations[userId] = {
            total: 0,
            types: {}
        };
    }

    const data = chat.violations[userId];

    data.total++;
    data.types[type] = (data.types[type] || 0) + 1;

    saveDB();

    const settings = getSettings(ctx);

    await ctx.reply(protectionWarningText(type, user)).catch(() => {});

    if (settings.autoMute && data.total >= Number(settings.warningLimit || 3)) {
        await muteUser(ctx, userId, "تجاوز عدد الإنذارات المسموح");

        await ctx.reply(
            `${mention(user)}\nتم كتمه تلقائيًا بسبب تجاوز عدد الإنذارات.`
        ).catch(() => {});
    }

    if (settings.autoBan && data.total >= Number(settings.warningLimit || 3) + 2) {
        await banUser(ctx, userId, "تجاوز المخالفات");

        await ctx.reply(
            `${mention(user)}\nتم حظره تلقائيًا بسبب تكرار المخالفات.`
        ).catch(() => {});
    }
}

function protectionUserExempt(ctx, userId) {
    return getRankLevel(ctx.chat.id, userId) >= 1;
}


// ---------- حماية الرسائل ----------

bot.on("edited_message", async (ctx) => {
    try {
        if (!isGroup(ctx)) return;

        const userId = ctx.from.id;
        const settings = getSettings(ctx);

        if (!settings.protection || !settings.preventEdits) return;
        if (protectionUserExempt(ctx, userId)) return;

        await ctx.deleteMessage().catch(() => {});

        await ctx.reply(
            `${mention(getUser(userId))}، ممنوع إرسال تعديل الرسائل.`
        ).catch(() => {});
    } catch (e) {
        console.log("edited_message protection error:", e.message);
    }
});


bot.on("message", async (ctx, next) => {
    try {
        if (!isGroup(ctx)) return next();

        const userId = ctx.from.id;
        const settings = getSettings(ctx);

        if (!settings.protection) return next();
        if (protectionUserExempt(ctx, userId)) return next();

        const message = ctx.message;
        const text = message.text || message.caption || "";

        let violation = null;

        // الروابط
        if (settings.antiLinks && protectionContainsLink(text)) {
            violation = "link";
        }

        // المنشنات
        if (!violation && settings.antiMentions && protectionContainsMention(text)) {
            violation = "mention";
        }

        // أرقام التواصل
        if (!violation && settings.antiPhones && protectionContainsPhone(text)) {
            violation = "phone";
        }

        // الإنجليزي
        if (!violation && settings.antiEnglish && protectionContainsEnglish(text)) {
            violation = "english";
        }

        // الإعلانات
        if (!violation && settings.antiAds && text && protectionLooksLikeAd(text)) {
            violation = "ad";
        }

        // الفوروارد
        if (!violation && settings.antiForwards && message.forward_origin) {
            violation = "forward";
        }

        // الوسائط
        if (!violation) {
            const mediaType = protectionMediaType(message);

            if (mediaType && settings[`anti${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}`]) {
                violation = mediaType;
            }
        }

        // التكرار
        if (!violation && settings.antiRepeat && text) {
            if (protectionIsRepeated(ctx.chat.id, userId, text)) {
                violation = "repeat";
            }
        }

        // الكلمات الممنوعة
        if (!violation && text) {
            const chat = getChat(ctx.chat.id);

            const forbidden = Array.isArray(chat.forbiddenWords)
                ? chat.forbiddenWords
                : [];

            const normalizedText = normalize(text);

            if (forbidden.some(word =>
                normalizedText.includes(normalize(word))
            )) {
                violation = "forbidden";
            }
        }

        if (!violation) return next();

        await ctx.deleteMessage().catch(() => {});
        await protectionPunish(ctx, userId, violation);

    } catch (e) {
        console.log("protection message error:", e.message);
        return next();
    }
});


// ---------- مسح المخالفات ----------

bot.hears(/^مسح المخالفات$/i, async (ctx) => {
    if (!isGroup(ctx)) return;

    if (!hasRank(ctx, 5)) {
        return ctx.reply(rankDenied("Myth🎖️"));
    }

    const chat = getChat(ctx.chat.id);
    chat.violations = {};

    saveDB();

    await ctx.reply("تم مسح جميع مخالفات القروب.");
});


bot.hears(/^مسح الإنذارات$/i, async (ctx) => {
    if (!isGroup(ctx)) return;

    if (!hasRank(ctx, 5)) {
        return ctx.reply(rankDenied("Myth🎖️"));
    }

    const chat = getChat(ctx.chat.id);
    chat.violations = {};

    saveDB();

    await ctx.reply("تم مسح جميع الإنذارات.");
});


// ---------- إعدادات الحماية ----------

const protectionToggleMap = {
    "الحماية": "protection",
    "الحماية التلقائية": "automaticProtection",
    "منع الروابط": "antiLinks",
    "التعديل": "preventEdits",
    "التكرار": "antiRepeat",
    "الإعلانات": "antiAds",
    "المنشن": "antiMentions",
    "الفوروارد": "antiForwards",
    "الصور": "antiPhotos",
    "الفيديوهات": "antiVideos",
    "الملفات": "antiFiles",
    "الملصقات": "antiStickers",
    "القيف": "antiGifs",
    "الصوت": "antiAudio",
    "البصمات": "antiVoice",
    "الأرقام": "antiPhones",
    "الإنجليزي": "antiEnglish",
    "الإنذارات": "warnings",
    "الكتم التلقائي": "autoMute",
    "الحظر التلقائي": "autoBan"
};

for (const [label, key] of Object.entries(protectionToggleMap)) {
    bot.hears(new RegExp(`^(تفعيل|تعطيل) ${label}$`, "i"), async (ctx) => {
        if (!isGroup(ctx)) return;

        if (!hasRank(ctx, 5)) {
            return ctx.reply(rankDenied("Myth🎖️"));
        }

        const enabled = normalize(ctx.match[1]) === "تفعيل";

        setSetting(ctx, key, enabled);

        await ctx.reply(
            `تم ${enabled ? "تفعيل" : "تعطيل"} ${label}.`
        );
    });
}


bot.hears(/^حالة الحماية$/i, async (ctx) => {
    if (!isGroup(ctx)) return;

    if (!hasRank(ctx, 5)) {
        return ctx.reply(rankDenied("Myth🎖️"));
    }

    const s = getSettings(ctx);

    const yes = v => v ? "مفتوح" : "مغلق";

    await ctx.reply(
        `• حالة الحماية

` +
        `الحماية: ${yes(s.protection)}
` +
        `الحماية التلقائية: ${yes(s.automaticProtection)}
` +
        `منع الروابط: ${yes(s.antiLinks)}
` +
        `منع التعديل: ${yes(s.preventEdits)}
` +
        `منع التكرار: ${yes(s.antiRepeat)}
` +
        `منع الإعلانات: ${yes(s.antiAds)}
` +
        `منع المنشن: ${yes(s.antiMentions)}
` +
        `منع الفوروارد: ${yes(s.antiForwards)}
` +
        `منع الأرقام: ${yes(s.antiPhones)}
` +
        `منع الإنجليزي: ${yes(s.antiEnglish)}
` +
        `الكتم التلقائي: ${yes(s.autoMute)}
` +
        `الحظر التلقائي: ${yes(s.autoBan)}`
    );
}


bot.hears(/^عدد الإنذارات (\d+)$/i, async (ctx) => {
    if (!isGroup(ctx)) return;

    if (!hasRank(ctx, 5)) {
        return ctx.reply(rankDenied("Myth🎖️"));
    }

    const amount = Number(ctx.match[1]);

    if (amount < 1 || amount > 20) {
        return ctx.reply("عدد الإنذارات يجب أن يكون بين 1 و20.");
    }

    setSetting(ctx, "warningLimit", amount);

    await ctx.reply(`تم تعيين عدد الإنذارات إلى ${amount}.`);
});


// ---------- المنشن ----------

bot.hears(/^فتح المنشن$/i, async (ctx) => {
    if (!isGroup(ctx)) return;

    if (!hasRank(ctx, 7)) {
        return ctx.reply(rankDenied("Dev🎖️"));
    }

    setSetting(ctx, "mentionOpen", true);

    await ctx.reply("تم فتح المنشن.");
});


bot.hears(/^غلق المنشن$/i, async (ctx) => {
    if (!isGroup(ctx)) return;

    if (!hasRank(ctx, 7)) {
        return ctx.reply(rankDenied("Dev🎖️"));
    }

    setSetting(ctx, "mentionOpen", false);

    await ctx.reply("تم غلق المنشن.");
});


// ---------- تنظيف المكتومين ----------

bot.hears(/^مم مسح المكتومين$/i, async (ctx) => {
    if (!isGroup(ctx)) return;

    if (!hasRank(ctx, 4)) {
        return ctx.reply(rankDenied("Myth"));
    }

    const chat = getChat(ctx.chat.id);

    chat.mutedUsers = {};

    saveDB();

    await ctx.reply("تم مسح المكتومين.");
});


bot.hears(/^خخ مسح المكتومين عام$/i, async (ctx) => {
    if (!isGroup(ctx)) return;

    if (!hasRank(ctx, 5)) {
        return ctx.reply(rankDenied("Myth🎖️"));
    }

    const chat = getChat(ctx.chat.id);

    chat.globalMutedUsers = {};

    saveDB();

    await ctx.reply("تم مسح المكتومين عام.");
});


// ==============================
// نظام رفع المشرف وتعديل الصلاحيات
// ==============================

const telegramAdminPermissions = [
    ["can_delete_messages", "حذف الرسائل"],
    ["can_restrict_members", "تقييد المستخدمين"],
    ["can_invite_users", "دعوة المستخدمين"],
    ["can_pin_messages", "تثبيت الرسائل"],
    ["can_manage_topics", "إدارة المواضيع"],
    ["can_manage_video_chats", "إدارة المكالمات"],
    ["can_promote_members", "إضافة مشرفين"],
    ["can_change_info", "تعديل معلومات المجموعة"],
    ["can_manage_chat", "إدارة المجموعة"]
];

function getAdminPermissionData(chatId, userId) {
    const chat = getChat(chatId);

    if (!chat.adminPermissions) {
        chat.adminPermissions = {};
    }

    if (!chat.adminPermissions[userId]) {
        chat.adminPermissions[userId] = {};

        for (const [key] of telegramAdminPermissions) {
            chat.adminPermissions[userId][key] = false;
        }
    }

    return chat.adminPermissions[userId];
}

function adminPermissionKeyboard(chatId, userId) {
    const permissions = getAdminPermissionData(chatId, userId);

    const rows = [];

    for (const [key, label] of telegramAdminPermissions) {
        rows.push([
            Markup.button.callback(
                `${label}: ${permissions[key] ? "نعم" : "لا"}`,
                `adminperm:${userId}:${key}`
            )
        ]);
    }

    rows.push([
        Markup.button.callback(
            "حفظ الصلاحيات",
            `adminsave:${userId}`
        )
    ]);

    rows.push([
        Markup.button.callback(
            "إخفاء الأمر",
            `adminhide`
        )
    ]);

    return Markup.inlineKeyboard(rows);
}


async function openAdminPermissions(ctx, targetId) {
    const chatId = ctx.chat.id;

    getAdminPermissionData(chatId, targetId);

    const target = getUser(targetId);

    return ctx.reply(
        `صلاحيات المستخدم\n\n${mention(target)}\n\nاختر الصلاحيات المطلوبة:`,
        adminPermissionKeyboard(chatId, targetId)
    );
}


bot.hears(/^(رفع مشرف|ترقيه)$/i, async (ctx) => {
    if (!isGroup(ctx)) return;

    if (!hasRank(ctx, 3)) {
        return ctx.reply(rankDenied("مالك أساسي"));
    }

    const target = getReplyTarget(ctx);

    if (!target) {
        return ctx.reply("يجب استخدام الأمر بالرد على المستخدم.");
    }

    if (target.id === ctx.from.id) {
        return ctx.reply("لا يمكنك رفع نفسك.");
    }

    if (getRankLevel(ctx.chat.id, target.id) >= getRankLevel(ctx.chat.id, ctx.from.id)) {
        return ctx.reply("لا يمكنك تعديل رتبة مستخدم أعلى منك أو مساوية لك.");
    }

    await openAdminPermissions(ctx, target.id);
});


bot.action(/^adminperm:(\d+):(.+)$/i, async (ctx) => {
    try {
        const targetId = Number(ctx.match[1]);
        const key = ctx.match[2];

        if (!ctx.chat) {
            return ctx.answerCbQuery("تعذر معرفة القروب.");
        }

        if (!hasRank(ctx, 3)) {
            return ctx.answerCbQuery("ليس لديك صلاحية.", { show_alert: true });
        }

        const permissions = getAdminPermissionData(ctx.chat.id, targetId);

        if (!(key in permissions)) {
            return ctx.answerCbQuery("الصلاحية غير موجودة.");
        }

        permissions[key] = !permissions[key];

        saveDB();

        await ctx.answerCbQuery(
            permissions[key] ? "تم التفعيل" : "تم التعطيل"
        );

        await ctx.editMessageReplyMarkup(
            adminPermissionKeyboard(ctx.chat.id, targetId).reply_markup
        );
    } catch (e) {
        console.log("admin permission error:", e.message);
    }
});


bot.action(/^adminsave:(\d+)$/i, async (ctx) => {
    try {
        const targetId = Number(ctx.match[1]);

        if (!hasRank(ctx, 3)) {
            return ctx.answerCbQuery("ليس لديك صلاحية.", { show_alert: true });
        }

        const permissions = getAdminPermissionData(ctx.chat.id, targetId);

        await ctx.telegram.promoteChatMember(
            ctx.chat.id,
            targetId,
            {
                is_anonymous: false,
                can_manage_chat: !!permissions.can_manage_chat,
                can_delete_messages: !!permissions.can_delete_messages,
                can_manage_video_chats: !!permissions.can_manage_video_chats,
                can_restrict_members: !!permissions.can_restrict_members,
                can_promote_members: !!permissions.can_promote_members,
                can_change_info: !!permissions.can_change_info,
                can_invite_users: !!permissions.can_invite_users,
                can_pin_messages: !!permissions.can_pin_messages,
                can_manage_topics: !!permissions.can_manage_topics
            }
        );

        await ctx.answerCbQuery("تم حفظ الصلاحيات.");

        await ctx.editMessageText(
            "تم رفع المستخدم مشرفًا وحفظ الصلاحيات."
        );
    } catch (e) {
        console.log("admin save error:", e.message);

        await ctx.answerCbQuery(
            "تعذر تعديل صلاحيات المشرف. تأكد أن البوت يملك صلاحية إضافة المشرفين.",
            { show_alert: true }
        ).catch(() => {});
    }
});


bot.action(/^adminhide$/i, async (ctx) => {
    await ctx.answerCbQuery("تم إخفاء الأمر.");

    await ctx.deleteMessage().catch(() => {});
});


// ==============================
// الإذاعة
// ==============================

bot.hears(/^إذاعة$/i, async (ctx) => {
    if (!hasRank(ctx, 7)) {
        return ctx.reply(rankDenied("Dev🎖️"));
    }

    setState(ctx.from.id, {
        type: "broadcast_content"
    });

    await ctx.reply(
        `• أرسل الآن رسالة الإذاعة.\n\n` +
        `يدعم النص والصور والفيديو والملفات والملصقات والقيف.`
    );
});


bot.on("message", async (ctx, next) => {
    try {
        const state = getState(ctx.from.id);

        if (!state || state.type !== "broadcast_content") {
            return next();
        }

        if (!hasRank(ctx, 7)) {
            clearState(ctx.from.id);
            return next();
        }

        if (!ctx.message) return next();

        clearState(ctx.from.id);

        const subscribers = Array.isArray(db.subscribers)
            ? db.subscribers
            : [];

        const sourceChatId = ctx.chat.id;
        const sourceMessageId = ctx.message.message_id;

        setState(ctx.from.id, {
            type: "broadcast_confirm",
            sourceChatId,
            sourceMessageId
        });

        await ctx.reply(
            `• معاينة الإذاعة جاهزة\n\n` +
            `• عدد المستلمين المتوقع: ${subscribers.length}\n\n` +
            `هل تريد تأكيد الإذاعة؟`,
            Markup.inlineKeyboard([
                [
                    Markup.button.callback(
                        "تأكيد الإذاعة",
                        "broadcast_confirm"
                    )
                ],
                [
                    Markup.button.callback(
                        "إلغاء",
                        "broadcast_cancel"
                    )
                ]
            ])
        );

    } catch (e) {
        console.log("broadcast content error:", e.message);
        return next();
    }
});


bot.action(/^broadcast_cancel$/i, async (ctx) => {
    if (!hasRank(ctx, 7)) {
        return ctx.answerCbQuery("ليس لديك صلاحية.", { show_alert: true });
    }

    clearState(ctx.from.id);

    await ctx.answerCbQuery("تم إلغاء الإذاعة.");

    await ctx.editMessageText("تم إلغاء الإذاعة.");
});


bot.action(/^broadcast_confirm$/i, async (ctx) => {
    try {
        if (!hasRank(ctx, 7)) {
            return ctx.answerCbQuery("ليس لديك صلاحية.", { show_alert: true });
        }

        const state = getState(ctx.from.id);

        if (!state || state.type !== "broadcast_confirm") {
            return ctx.answerCbQuery("لا توجد إذاعة معلقة.", {
                show_alert: true
            });
        }

        clearState(ctx.from.id);

        const subscribers = Array.isArray(db.subscribers)
            ? [...new Set(db.subscribers.map(Number))]
            : [];

        let success = 0;
        let failed = 0;

        await ctx.answerCbQuery("بدأت الإذاعة.");

        await ctx.editMessageText("• جاري إرسال الإذاعة...");

        for (const userId of subscribers) {
            try {
                await ctx.telegram.copyMessage(
                    userId,
                    state.sourceChatId,
                    state.sourceMessageId
                );

                success++;

                await new Promise(resolve =>
                    setTimeout(resolve, 35)
                );

            } catch (e) {
                failed++;
            }
        }

        await ctx.reply(
            `• تمت الإذاعة بنجاح\n` +
            `• تم الإرسال لـ ↤ ${success}\n` +
            `• تعذر الإرسال لـ ↤ ${failed}`
        );

    } catch (e) {
        console.log("broadcast error:", e.message);
    }
});


// ==============================
// القنوات
// ==============================

bot.hears(/^اضف قناة$/i, async (ctx) => {
    if (!hasRank(ctx, 6)) {
        return ctx.reply(rankDenied("Dev²🎖️"));
    }

    setState(ctx.from.id, {
        type: "add_channel"
    });

    await ctx.reply("• أرسل رابط القناة.");
});


bot.on("text", async (ctx, next) => {
    try {
        const state = getState(ctx.from.id);

        if (!state || state.type !== "add_channel") {
            return next();
        }

        if (!hasRank(ctx, 6)) {
            clearState(ctx.from.id);
            return next();
        }

        const link = ctx.message.text.trim();

        if (!/^https?:\/\/t\.me\//i.test(link) && !/^@/.test(link)) {
            return ctx.reply("أرسل رابط قناة صحيح.");
        }

        if (!db.channels) db.channels = {};

        const id = makeId();

        db.channels[id] = {
            id,
            link,
            addedBy: ctx.from.id,
            createdAt: Date.now()
        };

        clearState(ctx.from.id);
        saveDB();

        await ctx.reply(
            `تمت إضافة القناة بنجاح.\n${escapeHTML(link)}`
        );

    } catch (e) {
        console.log("add channel error:", e.message);
        return next();
    }
});


bot.hears(/^قناتي$/i, async (ctx) => {
    if (!hasRank(ctx, 6)) {
        return ctx.reply(rankDenied("Dev²🎖️"));
    }

    const channels = Object.values(db.channels || {})
        .filter(x => x.addedBy === ctx.from.id);

    if (!channels.length) {
        return ctx.reply("لا توجد قناة مضافة.");
    }

    const text = channels.map((channel, index) =>
        `${index + 1}. ${channel.link}`
    ).join("\n");

    await ctx.reply(`• قنواتك:\n\n${text}`);
});


bot.hears(/^حذف قناتي$/i, async (ctx) => {
    if (!hasRank(ctx, 6)) {
        return ctx.reply(rankDenied("Dev²🎖️"));
    }

    const channels = Object.entries(db.channels || {})
        .filter(([id, x]) => x.addedBy === ctx.from.id);

    if (!channels.length) {
        return ctx.reply("لا توجد قناة مضافة.");
    }

    const rows = channels.map(([id, channel]) => [
        Markup.button.callback(
            `حذف ${channel.link}`,
            `deletechannel:${id}`
        )
    ]);

    await ctx.reply(
        "اختر القناة التي تريد حذفها:",
        Markup.inlineKeyboard(rows)
    );
});


bot.action(/^deletechannel:(.+)$/i, async (ctx) => {
    if (!hasRank(ctx, 6)) {
        return ctx.answerCbQuery("ليس لديك صلاحية.", {
            show_alert: true
        });
    }

    const id = ctx.match[1];
    const channel = db.channels?.[id];

    if (!channel || channel.addedBy !== ctx.from.id) {
        return ctx.answerCbQuery("القناة غير موجودة.", {
            show_alert: true
        });
    }

    delete db.channels[id];

    saveDB();

    await ctx.answerCbQuery("تم حذف القناة.");

    await ctx.editMessageText("تم حذف القناة.");
});


bot.hears(/^تعديل قناتي$/i, async (ctx) => {
    if (!hasRank(ctx, 6)) {
        return ctx.reply(rankDenied("Dev²🎖️"));
    }

    await ctx.reply(
        "لتعديل قناتك احذف القناة الحالية ثم أضف الرابط الجديد."
    );
});


// ==============================
// المالك
// ==============================

bot.hears(/^المالك$/i, async (ctx) => {
    const ownerId = MAIN_OWNER_ID;

    const owner = getUser(ownerId);

    let text =
        `• معلومات المالك\n\n` +
        `الاسم: ${escapeHTML(owner.first_name || "غير محدد")}\n`;

    if (owner.username) {
        text += `اليوزر: @${escapeHTML(owner.username)}\n`;
    }

    if (owner.bio) {
        text += `النبذة: ${escapeHTML(owner.bio)}\n`;
    }

    text += `الرتبة: مالك أساسي`;

    await ctx.reply(text, {
        parse_mode: "HTML"
    });
});


// ==============================
// أوامر المطور الإضافية
// ==============================

bot.hears(/^تفعيل البوت$/i, async (ctx) => {
    if (!hasRank(ctx, 7)) {
        return ctx.reply(rankDenied("Dev🎖️"));
    }

    setSetting(ctx, "botEnabled", true);
    await ctx.reply("تم تفعيل البوت.");
});


bot.hears(/^تعطيل البوت$/i, async (ctx) => {
    if (!hasRank(ctx, 7)) {
        return ctx.reply(rankDenied("Dev🎖️"));
    }

    setSetting(ctx, "botEnabled", false);
    await ctx.reply("تم تعطيل البوت.");
});


bot.hears(/^تعيين عدد الاعضاء (\d+)$/i, async (ctx) => {
    if (!hasRank(ctx, 7)) {
        return ctx.reply(rankDenied("Dev🎖️"));
    }

    const amount = Number(ctx.match[1]);

    setSetting(ctx, "membersCount", amount);

    await ctx.reply(`تم تعيين عدد الأعضاء إلى ${amount}.`);
});


const developerToggleSettings = [
    ["الردود", "replies"],
    ["البنك", "bank"],
    ["التواصل", "communication"],
    ["الاشتراك الاجباري", "forcedSubscription"],
    ["بوت الخدمة", "serviceBot"],
    ["الاحصائيات", "statistics"],
    ["الزاجل", "zaajel"],
    ["التنسيقات", "formats"]
];

for (const [label, key] of developerToggleSettings) {
    bot.hears(new RegExp(`^(تفعيل|تعطيل) ${label}$`, "i"), async (ctx) => {
        if (!hasRank(ctx, 7)) {
            return ctx.reply(rankDenied("Dev🎖️"));
        }

        const enabled = normalize(ctx.match[1]) === "تفعيل";

        setSetting(ctx, key, enabled);

        await ctx.reply(
            `تم ${enabled ? "تفعيل" : "تعطيل"} ${label}.`
        );
    });
}


bot.hears(/^تفعيل وضع المطور$/i, async (ctx) => {
    if (!hasRank(ctx, 7)) {
        return ctx.reply(rankDenied("Dev🎖️"));
    }

    setSetting(ctx, "developerMode", true);

    await ctx.reply("تم تفعيل وضع المطور.");
});


bot.hears(/^تعطيل وضع المطور$/i, async (ctx) => {
    if (!hasRank(ctx, 7)) {
        return ctx.reply(rankDenied("Dev🎖️"));
    }

    setSetting(ctx, "developerMode", false);

    await ctx.reply("تم تعطيل وضع المطور.");
});


bot.hears(/^تحديث البيانات$/i, async (ctx) => {
    if (!hasRank(ctx, 7)) {
        return ctx.reply(rankDenied("Dev🎖️"));
    }

    saveDB();

    await ctx.reply("تم تحديث وحفظ البيانات.");
});


bot.hears(/^نسخة احتياطية$/i, async (ctx) => {
    if (!hasRank(ctx, 7)) {
        return ctx.reply(rankDenied("Dev🎖️"));
    }

    const backupDir = path.join(__dirname, "backups");

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const filename =
        `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

    const backupPath = path.join(backupDir, filename);

    fs.writeFileSync(
        backupPath,
        JSON.stringify(db, null, 2),
        "utf8"
    );

    await ctx.replyWithDocument({
        source: backupPath,
        filename
    });
});


bot.hears(/^سجل البوت$/i, async (ctx) => {
    if (!hasRank(ctx, 7)) {
        return ctx.reply(rankDenied("Dev🎖️"));
    }

    const logs = Array.isArray(db.logs)
        ? db.logs.slice(-20)
        : [];

    if (!logs.length) {
        return ctx.reply("لا يوجد سجل حالي.");
    }

    const text = logs.map((log, index) =>
        `${index + 1}. ${log.action || "حدث"}`
    ).join("\n");

    await ctx.reply(
        `• آخر العمليات:\n\n${text}`
    );
});


// ==============================
// القائمة الرئيسية
// ==============================

function mainCommandsKeyboard() {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback("المطور", "menu:developer"),
            Markup.button.callback("الرتب", "menu:ranks")
        ],
        [
            Markup.button.callback("الحماية", "menu:protection"),
            Markup.button.callback(
                "التفاعل والألعاب والفعاليات",
                "menu:games"
            )
        ],
        [
            Markup.button.callback(
                "الهمسات والأغاني",
                "menu:music"
            ),
            Markup.button.callback(
                "الأوامر المخصصة",
                "menu:custom"
            )
        ],
        [
            Markup.button.callback("القروب", "menu:group")
        ]
    ]);
}


function developerMenuText() {
    return `• قسم المطور

تعيين عدد الاعضاء + العدد
تفعيل الردود
تعطيل الردود
تفعيل البنك
تعطيل البنك
تفعيل التواصل
تعطيل التواصل
تفعيل الاشتراك الاجباري
تعطيل الاشتراك الاجباري
تفعيل بوت الخدمة
تعطيل بوت الخدمة
تفعيل الاحصائيات
تعطيل الاحصائيات
تفعيل الزاجل
تعطيل الزاجل
تفعيل التنسيقات
تعطيل التنسيقات

تفعيل البوت
تعطيل البوت
تحديث البيانات
نسخة احتياطية
سجل البوت`;
}


function ranksMenuText() {
    return `• قسم الرتب

عضو
مميز
مالك
مالك أساسي
Myth
Myth🎖️
Dev²🎖️
Dev🎖️

رفع مميز
رفع مالك
رفع مالك اساسي
رفع M
رفع MY
رفع ديف
رفع مطور

تنزيل مميز
تنزيل مالك
تنزيل مالك اساسي
تنزيل M
تنزيل MY
تنزيل ديف
تنزيل مطور

رتبتي
رتبته`;
}


function protectionMenuText() {
    return `• قسم الحماية

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

تفعيل الحماية
تعطيل الحماية
حالة الحماية

تفعيل منع الروابط
تعطيل منع الروابط
تفعيل التعديل
تعطيل التعديل
تفعيل التكرار
تعطيل التكرار
تفعيل الإعلانات
تعطيل الإعلانات
تفعيل المنشن
تعطيل المنشن
تفعيل الفوروارد
تعطيل الفوروارد

مسح الإنذارات
مسح المخالفات
مم مسح المكتومين
خخ مسح المكتومين عام`;
}


function gamesMenuText() {
    return `• التفاعل والألعاب والفعاليات

رتبته
تفاعله
المتفاعلين
اضف تفاعل + العدد

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
احكام

قفل الالعاب
فتح الالعاب`;
}


function musicMenuText() {
    return `• الهمسات والأغاني

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
مسح القائمة`;
}


function customMenuText() {
    return `• الأوامر المخصصة

اضف امر + الاسم
حذف امر + الاسم
اوامري

اضف رد + الكلمة
حذف رد + الكلمة
ردودي`;
}


function groupMenuText() {
    return `• قسم القروب

قروب
القوانين
تعيين القوانين + النص

المالك
@all
فتح المنشن
غلق المنشن`;
}


bot.hears(/^اوامر$/i, async (ctx) => {
    await ctx.reply(
        `• أهلًا بك في قائمة أوامر البوت\n\nاختر القسم المطلوب:`,
        mainCommandsKeyboard()
    );
});


bot.action(/^menu:(.+)$/i, async (ctx) => {
    const section = ctx.match[1];

    const menus = {
        developer: developerMenuText(),
        ranks: ranksMenuText(),
        protection: protectionMenuText(),
        games: gamesMenuText(),
        music: musicMenuText(),
        custom: customMenuText(),
        group: groupMenuText()
    };

    if (!menus[section]) {
        return ctx.answerCbQuery("القسم غير موجود.");
    }

    if (section === "

           
// ======================================================
// ملاحظة
// ======================================================
// لا يوجد bot.launch() هنا.
// التشغيل سيكون في آخر ملف index.cjs بعد
// إضافة جميع الأنظمة.
// ======================================================
