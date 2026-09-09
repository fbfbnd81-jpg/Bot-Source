/**
 * ============================================================================
 * TORAIF BOT
 * Telegram Management / Protection / Ranks / Games / Economy / Whispers
 * ============================================================================
 *
 * Required Replit Secrets:
 * BOT_TOKEN
 * MAIN_OWNER_ID
 * DEVELOPERS_IDS
 *
 * Example:
 * MAIN_OWNER_ID = 123456789
 * DEVELOPERS_IDS = 123456789,987654321
 *
 * DO NOT PUT THE BOT TOKEN DIRECTLY IN THIS FILE.
 * ============================================================================
 */

const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");

const BOT_TOKEN = process.env.BOT_TOKEN;
const MAIN_OWNER_ID = Number(process.env.MAIN_OWNER_ID || 0);

const DEVELOPERS_IDS = (process.env.DEVELOPERS_IDS || "")
    .split(",")
    .map(x => Number(x.trim()))
    .filter(Boolean);

if (!BOT_TOKEN) {
    console.error("BOT_TOKEN is missing.");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

const DB_FILE = path.join(__dirname, "database.json");

/* ============================================================================
   DATABASE
============================================================================ */

const DEFAULT_DB = {
    users: {},
    chats: {},
    globalMutes: {},
    whispers: {},
    bank: {},
    games: {},
    married: {},
    playlists: {},
    customCommands: {},
    customReplies: {},
    forbiddenWords: {},
    subscribers: [],
    developers: [],
    userStates: {},
    tempPerms: {},
    broadcasts: {},
    events: {},
    protectionLogs: {},
    stats: {
        messagesCount: 0,
        activeGroups: 0
    }
};

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function deepMerge(target, source) {
    if (!source || typeof source !== "object") return target;

    for (const key of Object.keys(source)) {
        if (
            source[key] &&
            typeof source[key] === "object" &&
            !Array.isArray(source[key]) &&
            target[key] &&
            typeof target[key] === "object" &&
            !Array.isArray(target[key])
        ) {
            deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }

    return target;
}

let db = clone(DEFAULT_DB);

try {
    if (fs.existsSync(DB_FILE)) {
        const old = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
        db = deepMerge(db, old);
    }
} catch (err) {
    console.error("Database load error:", err);
}

db.developers = Array.from(
    new Set([
        ...(Array.isArray(db.developers) ? db.developers : []),
        ...(MAIN_OWNER_ID ? [MAIN_OWNER_ID] : []),
        ...DEVELOPERS_IDS
    ])
);

function saveDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (err) {
        console.error("Database save error:", err);
    }
}

/* ============================================================================
   RANKS
============================================================================ */

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

function ensureChat(chatId) {
    if (!db.chats[chatId]) {
        db.chats[chatId] = {
            title: "",
            users: {},
            settings: {}
        };
    }

    if (!db.chats[chatId].users) {
        db.chats[chatId].users = {};
    }

    if (!db.chats[chatId].settings) {
        db.chats[chatId].settings = {};
    }

    const defaults = {
        protection: true,
        protectionLocked: false,
        autoProtection: true,

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

        antiPhotos: false,
        antiVideos: false,
        antiFiles: false,
        antiStickers: false,
        antiGif: false,
        antiVoice: false,

        warningsEnabled: true,
        autoMute: true,
        autoBan: false,

        warningLimit: 3,
        muteDuration: 0,
        restrictionDuration: 0,

        games: true,
        gamesLocked: false,

        mentionOpen: true,

        replies: true,
        bank: true,

        botEnabled: true,

        englishAllowed: true,

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

        bankName1: "الراجحي",
        bankName2: "الأهلي",
        bankName3: "البنك الثالث"
    };

    for (const [key, value] of Object.entries(defaults)) {
        if (db.chats[chatId].settings[key] === undefined) {
            db.chats[chatId].settings[key] = value;
        }
    }

    return db.chats[chatId];
}

function ensureUser(chatId, user) {
    const chat = ensureChat(chatId);

    if (!chat.users[user.id]) {
        chat.users[user.id] = {
            id: user.id,
            name: user.first_name || "",
            username: user.username || "",
            rank: "عضو",

            messages: 0,
            points: 0,

            balance: 100,

            warnings: 0,

            gamesPlayed: 0,
            gamesWon: 0,
            correctAnswers: 0,
            bestSpeed: null,

            bankAccount: null,
            bankName: null,
            bankStatus: "inactive",

            transferHistory: [],
            purchases: [],
            gameEarnings: 0,

            joinedAt: Date.now()
        };
    }

    chat.users[user.id].name = user.first_name || chat.users[user.id].name;
    chat.users[user.id].username = user.username || "";

    return chat.users[user.id];
}

function isGlobalDeveloper(userId) {
    return db.developers.includes(Number(userId));
}

function getUserRank(chatId, userId) {
    userId = Number(userId);

    if (MAIN_OWNER_ID && userId === MAIN_OWNER_ID) {
        return "Dev🎖️";
    }

    if (isGlobalDeveloper(userId)) {
        return "Dev²🎖️";
    }

    ensureChat(chatId);

    return db.chats[chatId].users[userId]?.rank || "عضو";
}

function getRank(chatId, userId) {
    return getUserRank(chatId, userId);
}

function getRankValue(chatId, userId) {
    return rankValue(getUserRank(chatId, userId));
}

function canUseRank(chatId, userId, requiredRank) {
    return getRankValue(chatId, userId) >= rankValue(requiredRank);
}

function rankDenied(requiredRank) {
    return `• هذا الامر يخص ↤ ｢ ${requiredRank} ｣`;
}

function isHigherOrEqual(chatId, executorId, targetId) {
    return getRankValue(chatId, targetId) >= getRankValue(chatId, executorId);
}

function canPunish(chatId, executorId, targetId) {
    if (Number(executorId) === Number(targetId)) return false;

    const executorRank = getRankValue(chatId, executorId);
    const targetRank = getRankValue(chatId, targetId);

    if (Number(targetId) === MAIN_OWNER_ID) return false;
    if (targetRank >= executorRank) return false;

    return true;
}

/* ============================================================================
   HELPERS
============================================================================ */

function mention(user) {
    if (!user) return "المستخدم";

    const name = String(user.first_name || user.username || "المستخدم")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    return `<a href="tg://user?id=${user.id}">${name}</a>`;
}

function escapeHtml(text = "") {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function replyOptions(ctx) {
    return {
        reply_to_message_id: ctx.message?.message_id
    };
}

async function deleteMessage(ctx) {
    try {
        await ctx.deleteMessage();
        return true;
    } catch {
        return false;
    }
}

function now() {
    return Date.now();
}

function normalize(text = "") {
    return text
        .toLowerCase()
        .replace(/[ًٌٍَُِّْـ]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

async function isBotAdmin(ctx) {
    try {
        const member = await ctx.telegram.getChatMember(
            ctx.chat.id,
            ctx.botInfo.id
        );

        return ["administrator", "creator"].includes(member.status);
    } catch {
        return false;
    }
}

async function logAction(chatId, executorId, action, targetId = null) {
    db.protectionLogs[chatId] = db.protectionLogs[chatId] || [];

    db.protectionLogs[chatId].push({
        executorId,
        targetId,
        action,
        time: now()
    });

    if (db.protectionLogs[chatId].length > 500) {
        db.protectionLogs[chatId].shift();
    }

    saveDB();
}

/* ============================================================================
   START / PRIVATE
============================================================================ */

bot.start(async ctx => {
    try {
        const userId = ctx.from.id;

        db.users[userId] = {
            ...(db.users[userId] || {}),
            id: userId,
            firstName: ctx.from.first_name || "",
            username: ctx.from.username || ""
        };

        if (!db.subscribers.includes(userId)) {
            db.subscribers.push(userId);
        }

        saveDB();

        const payload = ctx.startPayload || "";

        if (payload.startsWith("whisper_")) {
            const parts = payload.split("_");

            const chatId = parts[1];
            const targetId = Number(parts[2]);

            db.userStates[userId] = {
                action: "awaiting_whisper",
                chatId,
                targetId
            };

            saveDB();

            return ctx.reply(
                "• أرسل الآن الهمسة\n• يمكنك إرسال نص أو ملصق أو صورة أو قيف\n-"
            );
        }

        if (payload.startsWith("wh_view_")) {
            return showWhisper(ctx, payload.replace("wh_view_", ""));
        }

        return ctx.reply(
            "• أهلاً بك في بوت تورايف"
        );
    } catch (err) {
        console.error(err);
    }
});

/* ============================================================================
   WHISPER
============================================================================ */

async function showWhisper(ctx, whisperId) {
    const whisper = db.whispers[whisperId];

    if (!whisper) {
        return ctx.reply("• هذه الهمسة غير موجودة أو انتهت.");
    }

    if (Number(ctx.from.id) !== Number(whisper.targetId)) {
        return ctx.reply("• هذه الهمسة ليست موجهة لك.");
    }

    if (whisper.viewed) {
        return ctx.reply("• تمت قراءة هذه الهمسة مسبقاً.");
    }

    whisper.viewed = true;
    saveDB();

    try {
        await ctx.telegram.sendMessage(
            whisper.senderId,
            "• شاف همستك ."
        );
    } catch {}

    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback(
                "رد على الهمسة",
                `wh_reply_${whisperId}`
            )
        ]
    ]);

    const content = whisper.content;

    if (content.text) {
        await ctx.reply(
            `• محتوى الهمسة:\n\n${escapeHtml(content.text)}`,
            {
                parse_mode: "HTML",
                reply_markup: keyboard
            }
        );
    } else if (content.photo) {
        const fileId = content.photo[content.photo.length - 1].file_id;

        await ctx.replyWithPhoto(fileId, {
            caption: "• محتوى الهمسة",
            reply_markup: keyboard.reply_markup
        });
    } else if (content.sticker) {
        await ctx.replyWithSticker(content.sticker.file_id);

        await ctx.reply(
            "• محتوى الهمسة",
            {
                reply_markup: keyboard.reply_markup
            }
        );
    } else if (content.animation) {
        await ctx.replyWithAnimation(content.animation.file_id, {
            caption: "• محتوى الهمسة",
            reply_markup: keyboard.reply_markup
        });
    } else {
        await ctx.reply(
            "• وصلتك همسة سرية.",
            {
                reply_markup: keyboard.reply_markup
            }
        );
    }
}

bot.on("message", async (ctx, next) => {
    if (ctx.chat.type !== "private") return next();

    const userId = ctx.from.id;
    const state = db.userStates[userId];

    if (!state) return next();

    try {
        /* --------------------------------------------------------------------
           CREATE WHISPER
        -------------------------------------------------------------------- */

        if (state.action === "awaiting_whisper") {
            const whisperId =
                "wh_" +
                Date.now() +
                "_" +
                Math.random().toString(36).slice(2, 8);

            db.whispers[whisperId] = {
                senderId: userId,
                targetId: Number(state.targetId),
                chatId: state.chatId,
                content: ctx.message,
                viewed: false,
                createdAt: now()
            };

            delete db.userStates[userId];

            saveDB();

            await ctx.reply("• تم ارسال الهمسة");

            const me = await ctx.telegram.getMe();

            await ctx.telegram.sendMessage(
                state.targetId,
                `• ياحلو ↤ <a href="tg://user?id=${state.targetId}">المستلم</a>\n` +
                `• وصلتك همسة سرية من ↤ <a href="tg://user?id=${userId}">${escapeHtml(ctx.from.first_name)}</a>\n` +
                "• انت وحدك تقدر تشوفها",
                {
                    parse_mode: "HTML",
                    reply_markup: Markup.inlineKeyboard([
                        [
                            Markup.button.url(
                                "رؤية الهمسة",
                                `https://t.me/${me.username}?start=wh_view_${whisperId}`
                            )
                        ]
                    ])
                }
            );

            return;
        }

        /* --------------------------------------------------------------------
           WHISPER REPLY
        -------------------------------------------------------------------- */

        if (state.action === "awaiting_whisper_reply") {
            const original = db.whispers[state.whisperId];

            delete db.userStates[userId];
            saveDB();

            if (!original) {
                return ctx.reply("• انتهت صلاحية الهمسة.");
            }

            let replyText = ctx.message.text || ctx.message.caption || "";

            if (!replyText) {
                if (ctx.message.sticker) replyText = "[ملصق]";
                else if (ctx.message.photo) replyText = "[صورة]";
                else if (ctx.message.animation) replyText = "[قيف]";
                else replyText = "[محتوى]";
            }

            await ctx.telegram.sendMessage(
                original.senderId,
                `• رد على همستك من ↤ <a href="tg://user?id=${userId}">${escapeHtml(ctx.from.first_name)}</a>\n\n${escapeHtml(replyText)}`,
                { parse_mode: "HTML" }
            );

            return ctx.reply("• تم إرسال الرد على الهمسة");
        }

        /* --------------------------------------------------------------------
           BROADCAST CONTENT
        -------------------------------------------------------------------- */

        if (state.action === "broadcast") {
            const broadcastId = `bc_${Date.now()}_${userId}`;

            db.broadcasts[broadcastId] = {
                ownerId: userId,
                message: ctx.message
            };

            delete db.userStates[userId];

            saveDB();

            return ctx.reply(
                "• هل تريد إرسال هذه الرسالة لجميع المشتركين؟",
                {
                    reply_markup: Markup.inlineKeyboard([
                        [
                            Markup.button.callback(
                                "تأكيد الإذا
