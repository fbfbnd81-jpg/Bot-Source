cd /app
cat > index.cjs <<'EOF'
const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN غير موجود في متغيرات البيئة");
}

const bot = new Telegraf(BOT_TOKEN);

const DATA_FILE = path.join(__dirname, "bot-data.json");

const RANKS = {
  "عضو": 0,
  "مميز": 1,
  "مالك": 2,
  "مالك أساسي": 3,
  "Myth": 4,
  "Myth 🎖️": 5,
  "Dev²🎖️": 6,
  "Dev🎖️": 7
};

const RANK_NAMES = [
  "عضو",
  "مميز",
  "مالك",
  "مالك أساسي",
  "Myth",
  "Myth 🎖️",
  "Dev²🎖️",
  "Dev🎖️"
];

const DEV_USERNAME = "j4xa7";

const DEFAULT_DB = {
  users: {},
  chats: {},
  subscribers: [],
  globalRoles: {
    j4xa7: 7
  },
  broadcasts: {},
  whispers: {},
  pendingWhispers: {},
  pendingReplies: {},
  bank: {},
  marriages: {},
  games: {},
  customCommands: {},
  customReplies: {},
  channels: {},
  botSettings: {
    enabled: true,
    replies: true,
    bank: true,
    communication: true,
    forcedSubscription: false,
    serviceBot: true,
    statistics: true,
    zaajel: true,
    formats: true,
    games: true,
    mentions: true
  }
};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function loadDB() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DB, null, 2));
      return clone(DEFAULT_DB);
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    for (const key of Object.keys(DEFAULT_DB)) {
      if (data[key] === undefined) {
        data[key] = clone(DEFAULT_DB[key]);
      }
    }

    return data;
  } catch (e) {
    console.error("DATABASE LOAD ERROR:", e);
    return clone(DEFAULT_DB);
  }
}

let db = loadDB();

function saveDB() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error("DATABASE SAVE ERROR:", e);
  }
}

function id(value) {
  return String(value);
}

function isGroup(ctx) {
  return (
    ctx.chat &&
    (ctx.chat.type === "group" || ctx.chat.type === "supergroup")
  );
}

function isPrivate(ctx) {
  return ctx.chat && ctx.chat.type === "private";
}

function ensureUser(user) {
  if (!user) return null;

  const key = id(user.id);

  if (!db.users[key]) {
    db.users[key] = {
      id: user.id,
      username: user.username || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      balance: 0,
      warnings: {},
      globalMuted: {},
      bank: {
        active: false,
        name: "",
        account: ""
      },
      title: "",
      stats: {
        messages: 0,
        points: 0,
        wins: 0,
        games: 0,
        bestSpeed: null
      }
    };
  } else {
    db.users[key].username = user.username || db.users[key].username;
    db.users[key].first_name = user.first_name || db.users[key].first_name;
    db.users[key].last_name = user.last_name || db.users[key].last_name;
  }

  return db.users[key];
}

function ensureChat(chat) {
  const key = id(chat.id);

  if (!db.chats[key]) {
    db.chats[key] = {
      id: chat.id,
      title: chat.title || "",

      roles: {},

      stats: {},

      muted: {},
      globalMuted: {},
      warnings: {},

      forbiddenWords: [],

      customCommands: {},
      customReplies: {},

      channels: {},

      settings: {
        protection: true,
        violations: true,
        autoProtection: true,

        links: true,
        edits: true,
        repeats: true,
        ads: true,
        mentions: true,
        forwards: true,

        warnings: true,
        autoMute: true,
        autoBan: false,

        english: false,
        longMessages: true,
        phoneNumbers: true,
        channelIds: true,

        botProtection: true,
        newAccounts: true,
        suspiciousAccounts: true,

        chatLock: false,
        mediaLock: false,

        photos: false,
        videos: false,
        files: false,
        stickers: false,
        gifs: false,
        audios: false,
        voices: false,
        forwardsLock: false,
        mentionsLock: false,

        games: true,
        mentionsAll: true
      },

      games: {
        active: null,
        locked: false
      },

      laws: "",

      logChannel: null,
      subscriptionChannel: null
    };
  }

  return db.chats[key];
}

function getRank(userId, ctx = null) {
  const key = id(userId);

  const user = db.users[key];

  if (
    user &&
    String(user.username || "").toLowerCase() === DEV_USERNAME.toLowerCase()
  ) {
    return 7;
  }

  if (
    ctx &&
    ctx.from &&
    String(ctx.from.id) === key &&
    String(ctx.from.username || "").toLowerCase() ===
      DEV_USERNAME.toLowerCase()
  ) {
    return 7;
  }

  if (db.globalRoles[key] !== undefined) {
    return Number(db.globalRoles[key]);
  }

  if (ctx && isGroup(ctx)) {
    const chat = ensureChat(ctx.chat);
    return Number(chat.roles[key] || 0);
  }

  return 0;
}

function rankName(level) {
  return RANK_NAMES[level] || "عضو";
}

function mention(user) {
  if (!user) return "المستخدم";

  const name = String(
    user.first_name ||
      user.username ||
      "المستخدم"
  )
    .replace(/</g, "")
    .replace(/>/g, "")
    .replace(/"/g, "");

  return `<a href="tg://user?id=${user.id}">${name}</a>`;
}

function replyMention(ctx) {
  if (!ctx.message || !ctx.message.reply_to_message) {
    return null;
  }

  const user = ctx.message.reply_to_message.from;

  if (!user) return null;

  return user;
}

function commandText(ctx) {
  return (
    ctx.message?.text ||
    ctx.message?.caption ||
    ""
  ).trim();
}

async function reply(ctx, text, extra = {}) {
  try {
    return await ctx.reply(text, {
      parse_mode: "HTML",
      ...extra
    });
  } catch (e) {
    console.error("REPLY ERROR:", e.message);
  }
}

async function permissionMessage(ctx, level) {
  return reply(
    ctx,
    `• هذا الامر يخص ↤ ｢ ${rankName(level)} ｣`
  );
}

function requireRank(ctx, level) {
  const current = getRank(ctx.from.id, ctx);

  if (current < level) {
    permissionMessage(ctx, level);
    return false;
  }

  return true;
}

function requireOwner(ctx) {
  const current = getRank(ctx.from.id, ctx);

  if (current < 2) {
    reply(
      ctx,
      "• ماتقدر تستخدم الامر على ↤ ｢ لازم تكون الرتبه مالك وفوق ｣"
    );
    return false;
  }

  return true;
}

function canActOn(ctx, targetId) {
  return getRank(ctx.from.id, ctx) > getRank(targetId, ctx);
}

function cannotActMessage(ctx) {
  return reply(
    ctx,
    "• لا يمكن تنزيل رتبه نفس رتبتك ولا اعلى من رتبتك"
  );
}

async function adminLog(ctx, text) {
  if (!isGroup(ctx)) return;

  const chat = ensureChat(ctx.chat);

  if (!chat.logChannel) return;

  try {
    await bot.telegram.sendMessage(
      chat.logChannel,
      `• سجل الحماية\n• القروب: ${chat.title}\n• بواسطة: ${mention(ctx.from)}\n• العملية: ${text}`,
      {
        parse_mode: "HTML"
      }
    );
  } catch {}
}

async function punish(ctx, target, action) {
  return reply(
    ctx,
    `• المستخدم ذا ↤︎「${mention(target)}」\n• ${action}`,
    {
      reply_parameters: {
        message_id: ctx.message.message_id
      }
    }
  );
}

async function promotion(ctx, target, action) {
  return reply(
    ctx,
    `• المستخدم ذا ↤︎「${mention(target)}」\n• ${action}`,
    {
      reply_parameters: {
        message_id: ctx.message.message_id
      }
    }
  );
}

async function botCanAdmin(ctx) {
  try {
    const me = await bot.telegram.getMe();
    const member = await bot.telegram.getChatMember(
      ctx.chat.id,
      me.id
    );

    return member.status === "administrator" ||
      member.status === "creator";
  } catch {
    return false;
  }
}

async function protectedTelegramAdmin(ctx, targetId) {
  try {
    const member = await bot.telegram.getChatMember(
      ctx.chat.id,
      targetId
    );

    if (member.status === "creator") {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function hasLink(text) {
  return /(https?:\/\/|www\.|t\.me\/|telegram\.me\/)/i.test(
    text
  );
}

function hasMention(text) {
  return /(^|\s)@\w+/u.test(text);
}

function hasPhone(text) {
  return /(?:\+?\d[\d\s-]{7,}\d)/.test(text);
}

function isAdvertisement(text) {
  return /(اشترك|إعلان|اعلان|خصم|بيع|شراء|متجر|قناة).{0,100}(@|https?:\/\/|t\.me)/i.test(
    text
  );
}

function isLong(text) {
  return text.length > 700;
}

function containsForbiddenWord(chat, text) {
  return chat.forbiddenWords.some((word) => {
    if (!word) return false;
    return text.toLowerCase().includes(
      String(word).toLowerCase()
    );
  });
}

function isRepeated(chat, userId, text) {
  if (!chat._repeat) {
    chat._repeat = {};
  }

  const key = id(userId);
  const now = Date.now();

  const old = chat._repeat[key];

  chat._repeat[key] = {
    text,
    time: now
  };

  if (!old) return false;

  return (
    old.text === text &&
    now - old.time < 15000
  );
}

async function deleteCurrent(ctx) {
  try {
    await ctx.deleteMessage();
    return true;
  } catch {
    return false;
  }
}

async function protection(ctx) {
  if (!isGroup(ctx)) return true;

  if (!ctx.message) return true;

  const chat = ensureChat(ctx.chat);

  if (!chat.settings.protection) {
    return true;
  }

  if (!chat.settings.violations) {
    return true;
  }

  if (ctx.from?.is_bot) {
    return true;
  }

  const level = getRank(ctx.from.id, ctx);

  if (level > 0) {
    return true;
  }

  const message = ctx.message;

  if (message.edited) {
    return true;
  }

  const text =
    message.text ||
    message.caption ||
    "";

  let reason = null;

  if (
    chat.settings.links &&
    text &&
    hasLink(text)
  ) {
    reason = "ممنوع إرسال الروابط";
  }

  if (
    !reason &&
    chat.settings.ads &&
    text &&
    isAdvertisement(text)
  ) {
    reason = "ممنوع إرسال الإعلانات";
  }

  if (
    !reason &&
    chat.settings.mentions &&
    text &&
    hasMention(text) &&
    (text.match(/@\w+/g) || []).length >= 3
  ) {
    reason = "ممنوع إرسال المنشنات";
  }

  if (
    !reason &&
    chat.settings.phoneNumbers &&
    text &&
    hasPhone(text)
  ) {
    reason = "ممنوع إرسال أرقام الهواتف";
  }

  if (
    !reason &&
    chat.settings.longMessages &&
    text &&
    isLong(text)
  ) {
    reason = "ممنوع إرسال الرسائل الطويلة";
  }

  if (
    !reason &&
    chat.settings.repeats &&
    text &&
    isRepeated(chat, ctx.from.id, text)
  ) {
    reason = "ممنوع تكرار الرسائل";
  }

  if (
    !reason &&
    chat.settings.forwards &&
    message.forward_origin
  ) {
    reason = "ممنوع إرسال الفوروارد";
  }

  if (
    !reason &&
    chat.settings.photos &&
    message.photo
  ) {
    reason = "ممنوع إرسال الصور";
  }

  if (
    !reason &&
    chat.settings.videos &&
    message.video
  ) {
    reason = "ممنوع إرسال الفيديوهات";
  }

  if (
    !reason &&
    chat.settings.files &&
    message.document
  ) {
    reason = "ممنوع إرسال الملفات";
  }

  if (
    !reason &&
    chat.settings.stickers &&
    message.sticker
  ) {
    reason = "ممنوع إرسال الملصقات";
  }

  if (
    !reason &&
    chat.settings.gifs &&
    message.animation
  ) {
    reason = "ممنوع إرسال القيفات";
  }

  if (
    !reason &&
    chat.settings.audios &&
    message.audio
  ) {
    reason = "ممنوع إرسال الصوتيات";
  }

  if (
    !reason &&
    chat.settings.voices &&
    message.voice
  ) {
    reason = "ممنوع إرسال الفويسات";
  }

  if (
    !reason &&
    containsForbiddenWord(chat, text)
  ) {
    reason = "هذه الكلمة ممنوعة";
  }

  if (!reason) {
    return true;
  }

  await deleteCurrent(ctx);

  await reply(
    ctx,
    `• ${mention(ctx.from)}، ${reason}`
  );

  await addWarning(ctx, ctx.from.id);

  return false;
}

async function addWarning(ctx, userId) {
  const chat = ensureChat(ctx.chat);

  if (!chat.settings.warnings) {
    return;
  }

  const key = id(userId);

  chat.warnings[key] =
    Number(chat.warnings[key] || 0) + 1;

  const count = chat.warnings[key];

  if (
    count >= 3 &&
    chat.settings.autoMute
  ) {
    try {
      await bot.telegram.restrictChatMember(
        ctx.chat.id,
        userId,
        {
          permissions: {
            can_send_messages: false
          }
        }
      );

      chat.muted[key] = {
        until: null,
        reason: "إنذار ثالث"
      };
    } catch {}
  }

  if (
    count >= 5 &&
    chat.settings.autoBan
  ) {
    try {
      await bot.telegram.banChatMember(
        ctx.chat.id,
        userId
      );
    } catch {}
  }

  saveDB();
}

bot.use(async (ctx, next) => {
  if (ctx.from) {
    ensureUser(ctx.from);

    if (
      String(ctx.from.username || "").toLowerCase() ===
      DEV_USERNAME
    ) {
      db.globalRoles.j4xa7 = 7;
    }
  }

  if (isGroup(ctx)) {
    ensureChat(ctx.chat);

    const chat = ensureChat(ctx.chat);

    if (!chat.stats) {
      chat.stats = {};
    }

    const userId = id(ctx.from.id);

    if (
      ctx.message &&
      !ctx.message.new_chat_members &&
      !ctx.message.left_chat_member
    ) {
      chat.stats[userId] =
        Number(chat.stats[userId] || 0) + 1;

      ensureUser(ctx.from).stats.messages++;

      saveDB();
    }

    const protectedResult =
      await protection(ctx);

    if (!protectedResult) {
      return;
    }
  }

  if (isPrivate(ctx)) {
    ensureUser(ctx.from);

    if (!db.subscribers.includes(ctx.from.id)) {
      db.subscribers.push(ctx.from.id);
      saveDB();
    }
  }

  return next();
});

/* =========================================================
   START
========================================================= */

bot.start(async (ctx) => {
  const payload =
    ctx.startPayload || "";

  ensureUser(ctx.from);
  saveDB();

  if (payload.startsWith("whisper_view_")) {
    return showWhisper(
      ctx,
      payload.replace("whisper_view_", "")
    );
  }

  if (payload.startsWith("whisper_reply_")) {
    return prepareWhisperReply(
      ctx,
      payload.replace("whisper_reply_", "")
    );
  }

  const me = await bot.telegram.getMe();

  const addUrl =
    `https://t.me/${me.username}?startgroup=true`;

  return ctx.reply(
    `أهلا بك يا قلبي - ${mention(ctx.from)}

• انا اشغل لك اللي تبي بالمكالمه

ادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "أضفني في مجموعتك",
              url: addUrl
            }
          ],
          [
            {
              text: "المطور",
              url: "https://t.me/j4xa7"
            }
          ]
        ]
      }
    }
  );
});

/* =========================================================
   RANK
========================================================= */

bot.hears(/^رتبتي$/i, async (ctx) => {
  return reply(
    ctx,
    `• رتبتك ↤︎ ${rankName(
      getRank(ctx.from.id, ctx)
    )}`
  );
});

bot.hears(/^رتبته$/i, async (ctx) => {
  if (!isGroup(ctx)) return;

  const target = replyMention(ctx);

  if (!target) {
    return reply(
      ctx,
      "• يجب الرد على العضو"
    );
  }

  return reply(
    ctx,
    `• رتبة ${mention(target)} ↤︎ ${rankName(
      getRank(target.id, ctx)
    )}`
  );
});

/* =========================================================
   INTERACTION
========================================================= */

bot.hears(/^تفاعلي$/i, async (ctx) => {
  if (!isGroup(ctx)) return;

  const chat = ensureChat(ctx.chat);

  const count =
    Number(chat.stats[id(ctx.from.id)] || 0);

  const sorted =
    Object.entries(chat.stats || {})
      .sort((a, b) => b[1] - a[1]);

  const index =
    sorted.findIndex(
      (item) =>
        item[0] === id(ctx.from.id)
    );

  return reply(
    ctx,
    `• رتبتك ↤︎ ${rankName(
      getRank(ctx.from.id, ctx)
    )}
• عدد رسائل التفاعل ↤︎ ${count}
• ترتيبك بين المتفاعلين ↤︎ ${
      index === -1 ? "-" : index + 1
    }`
  );
});

bot.hears(/^المتفاعلين$/i, async (ctx) => {
  if (!isGroup(ctx)) return;

  const chat = ensureChat(ctx.chat);

  const sorted =
    Object.entries(chat.stats || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

  if (!sorted.length) {
    return reply(
      ctx,
      "• لا يوجد متفاعلين"
    );
  }

  const lines = [];

  for (let i = 0; i < sorted.length; i++) {
    const [userId, count] =
      sorted[i];

    let name = userId;

    try {
      const member =
        await bot.telegram.getChatMember(
          ctx.chat.id,
          Number(userId)
        );

      if (member.user) {
        name = mention(member.user);
      }
    } catch {}

    lines.push(
      `${i + 1} - ${name}\n• الرسائل: ${count}`
    );
  }

  return reply(
    ctx,
    `• المتفاعلين\n\n${lines.join("\n")}`
  );
});

bot.hears(/^تفاعله$/i, async (ctx) => {
  if (!isGroup(ctx)) return;

  const target =
    replyMention(ctx);

  if (!target) {
    return reply(
      ctx,
      "• يجب الرد على العضو"
    );
  }

  const chat =
    ensureChat(ctx.chat);

  const count =
    Number(chat.stats[id(target.id)] || 0);

  const sorted =
    Object.entries(chat.stats || {})
      .sort((a, b) => b[1] - a[1]);

  const index =
    sorted.findIndex(
      (x) => x[0] === id(target.id)
    );

  return reply(
    ctx,
    `• العضو ↤︎ ${mention(target)}
• عدد رسائل التفاعل ↤︎ ${count}
• ترتيبه بين المتفاعلين ↤︎ ${
      index === -1 ? "-" : index + 1
    }`
  );
});

/* =========================================================
   MUTE / BAN / KICK / RESTRICT
========================================================= */

bot.hears(/^كتم$/i, async (ctx) => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 4)) return;

  const target =
    replyMention(ctx);

  if (!target) {
    return reply(
      ctx,
      "• يجب الرد على العضو"
    );
  }

  if (!canActOn(ctx, target.id)) {
    return cannotActMessage(ctx);
  }

  if (
    await protectedTelegramAdmin(
      ctx,
      target.id
    )
  ) {
    return cannotActMessage(ctx);
  }

  try {
    await bot.telegram.restrictChatMember(
      ctx.chat.id,
      target.id,
      {
        permissions: {
          can_send_messages: false
        }
      }
    );

    const chat =
      ensureChat(ctx.chat);

    chat.muted[id(target.id)] = {
      time: Date.now()
    };

    saveDB();

    await adminLog(
      ctx,
      `كتم ${target.id}`
    );

    return punish(
      ctx,
      target,
      "كتمته"
    );
  } catch {
    return reply(
      ctx,
      "• تعذر تنفيذ الأمر، تأكد من صلاحيات البوت"
    );
  }
});

bot.hears(/^فك كتم$/i, async (ctx) => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 4)) return;

  const target =
    replyMention(ctx);

  if (!target) {
    return reply(
      ctx,
      "• يجب الرد على العضو"
    );
  }

  if (!canActOn(ctx, target.id)) {
    return cannotActMessage(ctx);
