const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN غير موجود في متغيرات البيئة");
}

const bot = new Telegraf(BOT_TOKEN);

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "database.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* =========================================================
   الرتب
========================================================= */

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

const RANK_ALIASES = {
  "عضو": "عضو",
  "مميز": "مميز",
  "مالك": "مالك",
  "مالك اساسي": "مالك أساسي",
  "مالك أساسي": "مالك أساسي",
  "اساس": "مالك أساسي",

  "m": "Myth",
  "myth": "Myth",

  "my": "Myth 🎖️",
  "اكس": "Myth 🎖️",
  "myth🎖️": "Myth 🎖️",
  "myth 🎖️": "Myth 🎖️",

  "ديف": "Dev²🎖️",
  "dev2": "Dev²🎖️",
  "dev²": "Dev²🎖️",
  "dev²🎖️": "Dev²🎖️",

  "مطور": "Dev🎖️",
  "مطور ثانوي": "Dev²🎖️",
  "dev": "Dev🎖️",
  "dev🎖️": "Dev🎖️"
};

const OWNER_USERNAME = "j4xa7";
const OWNER_ID = "5370959021438146805";

const DEV_IDS = String(process.env.DEV_IDS || "")
  .split(",")
  .map(x => x.trim())
  .filter(Boolean);

/* =========================================================
   قاعدة البيانات
========================================================= */

const dbDefault = {
  users: {},
  chats: {},
  globalSubscribers: [],
  devIds: DEV_IDS,
  botLog: [],
  groups: [],
  channels: []
};

function cloneDefault() {
  return JSON.parse(JSON.stringify(dbDefault));
}

function loadDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(
        DB_FILE,
        JSON.stringify(dbDefault, null, 2),
        "utf8"
      );

      return cloneDefault();
    }

    const raw = fs.readFileSync(DB_FILE, "utf8");

    if (!raw.trim()) {
      return cloneDefault();
    }

    const data = JSON.parse(raw);

    return {
      ...cloneDefault(),
      ...data,
      users: data.users || {},
      chats: data.chats || {},
      globalSubscribers: data.globalSubscribers || [],
      devIds: data.devIds || DEV_IDS,
      botLog: data.botLog || [],
      groups: data.groups || [],
      channels: data.channels || []
    };
  } catch (error) {
    console.error("Database load error:", error);
    return cloneDefault();
  }
}

let db = loadDB();

function saveDB() {
  try {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(db, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("Database save error:", error);
  }
}

/* =========================================================
   أدوات عامة
========================================================= */

function randomToken() {
  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2, 10)
  );
}

function escapeMarkdown(text) {
  return String(text || "")
    .replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

function mentionUser(user) {
  if (!user) return "المستخدم";

  const name =
    user.first_name ||
    user.firstName ||
    user.username ||
    "المستخدم";

  return `[${escapeMarkdown(name)}](tg://user?id=${user.id})`;
}

/*
  كل ردود الأوامر داخل القروب تصبح Reply
*/
function botReply(ctx, text, extra = {}) {
  const messageId =
    ctx.message?.message_id;

  return ctx.reply(text, {
    ...extra,
    ...(messageId
      ? {
          reply_to_message_id: messageId
        }
      : {})
  });
}

/* =========================================================
   المستخدمين
========================================================= */

function ensureGlobalUser(user) {
  if (!user?.id) return null;

  const id = String(user.id);

  if (!db.users[id]) {
    db.users[id] = {
      id,
      username: user.username || "",
      firstName: user.first_name || "",
      lastName: user.last_name || "",

      balance: 0,

      bank: {
        active: false,
        name: "",
        accountNumber: ""
      },

      transfers: [],
      purchases: [],
      gameEarnings: 0
    };
  } else {
    db.users[id].username =
      user.username ||
      db.users[id].username ||
      "";

    db.users[id].firstName =
      user.first_name ||
      db.users[id].firstName ||
      "";

    db.users[id].lastName =
      user.last_name ||
      db.users[id].lastName ||
      "";
  }

  return db.users[id];
}

/* =========================================================
   الرتب
========================================================= */

function rankValue(rank) {
  return RANKS[rank] ?? 0;
}

function normalizeRank(value) {
  return (
    RANK_ALIASES[
      String(value || "")
        .trim()
        .toLowerCase()
    ] || null
  );
}

function isDev(userId, username = "") {
  const id = String(userId || "");

  const name = String(username || "")
    .replace(/^@/, "")
    .toLowerCase();

  return (
    id === OWNER_ID ||
    name === OWNER_USERNAME.toLowerCase() ||
    name === "j4xa7" ||
    DEV_IDS.includes(id) ||
    (db.devIds || []).map(String).includes(id)
  );
}

function getRank(chat, userId) {
  const id = String(userId);
  const user = chat.users[id];

  if (
    isDev(
      id,
      user?.username || ""
    )
  ) {
    return "Dev🎖️";
  }

  return user?.rank || "عضو";
}

function canTarget(chat, actorId, targetId) {
  const actor = String(actorId);
  const target = String(targetId);

  if (actor === target) {
    return false;
  }

  const actorUser =
    chat.users[actor];

  const targetUser =
    chat.users[target];

  const actorDev =
    isDev(
      actor,
      actorUser?.username || ""
    );

  const targetDev =
    isDev(
      target,
      targetUser?.username || ""
    );

  if (targetDev) {
    return actorDev;
  }

  return (
    rankValue(getRank(chat, actor)) >
    rankValue(getRank(chat, target))
  );
}

function rankPermissionMessage(rank) {
  return `• هذا الامر يخص ↤ ｢ ${rank} ｢`;
}

/* =========================================================
   مستخدم القروب
========================================================= */

function ensureChatUser(chat, user) {
  if (!user?.id) return null;

  const id = String(user.id);

  const username =
    user.username ||
    chat.users[id]?.username ||
    "";

  const automaticDev =
    isDev(
      user.id,
      username
    );

  if (!chat.users[id]) {
    chat.users[id] = {
      id,
      username,
      firstName: user.first_name || "",
      rank: automaticDev
        ? "Dev🎖️"
        : "عضو",

      messages: 0,
      points: 0,

      title: "",
      tag: "",

      warnings: 0,
      violations: [],

      married: false,

      muted: false,
      globalMuted: false,
      restricted: false
    };
  } else {
    chat.users[id].username =
      username;

    chat.users[id].firstName =
      user.first_name ||
      chat.users[id].firstName ||
      "";

    if (automaticDev) {
      chat.users[id].rank =
        "Dev🎖️";
    }
  }

  return chat.users[id];
}

/* =========================================================
   إعدادات القروب
========================================================= */

function defaultChatSettings() {
  return {
    protection: true,
    automaticProtection: true,

    preventLinks: true,
    preventEdits: true,
    preventSpam: true,
    preventAds: true,
    preventMentions: false,
    preventForwards: false,
    preventCommands: false,
    preventBannedWords: true,
    preventLongMessages: false,
    preventPhoneNumbers: false,
    preventChannelIds: false,
    preventEnglish: false,

    warningsEnabled: true,
    warningLimit: 3,

    autoMute: true,
    autoBan: false,

    violationsOpen: true,

    allMention: true,

    gamesClosed: false,

    repliesEnabled: true,
    bankEnabled: true,
    communicationEnabled: true,

    forcedSubscription: false,
    forcedSubscriptionChannel: "",

    serviceBot: true,
    botProtection: true,
    entryProtection: true,

    statsEnabled: true,
    zajelEnabled: true,
    formatsEnabled: true,

    memberCount: 0,

    bannedWords: [],

    locks: {
      chat: false,
      media: false,
      links: false,
      photos: false,
      videos: false,
      files: false,
      stickers: false,
      gifs: false,
      audio: false,
      forwards: false,
      mentions: false
    },

    adminLogChannel: "",

    banks: [
      "الراجحي",
      "الأهلي",
      "البنك الثالث"
    ]
  };
}

function ensureChat(chatId) {
  const id = String(chatId);

  if (!db.chats[id]) {
    db.chats[id] = {
      id,

      settings:
        defaultChatSettings(),

      users: {},

      customCommands: {},
      customReplies: {},

      channels: {},
      marriages: {},

      games: {
        active: null,
        stats: {}
      },

      messageLog: [],
      adminLog: [],

      muted: {},
      globalMuted: {},
      restricted: {},
      banned: {},
      warnings: {},

      interactions: {},

      tags: {},

      whispers: {},

      music: {
        enabled: true,
        current: null,
        queue: [],
        playing: false
      }
    };
  }

  const chat =
    db.chats[id];

  const defaults =
    defaultChatSettings();

  chat.settings = {
    ...defaults,
    ...(chat.settings || {}),
    locks: {
      ...defaults.locks,
      ...(chat.settings?.locks || {})
    }
  };

  chat.users ||= {};
  chat.customCommands ||= {};
  chat.customReplies ||= {};
  chat.channels ||= {};
  chat.marriages ||= {};

  chat.games ||= {
    active: null,
    stats: {}
  };

  chat.games.stats ||= {};

  chat.messageLog ||= [];
  chat.adminLog ||= [];

  chat.muted ||= {};
  chat.globalMuted ||= {};
  chat.restricted ||= {};
  chat.banned ||= {};
  chat.warnings ||= {};

  chat.interactions ||= {};
  chat.tags ||= {};
  chat.whispers ||= {};

  chat.music ||= {
    enabled: true,
    current: null,
    queue: [],
    playing: false
  };

  return chat;
}

/* =========================================================
   الاستهداف
========================================================= */

function getTargetFromReply(ctx) {
  return ctx.message?.reply_to_message?.from || null;
}

function replyRequired(ctx) {
  const target =
    getTargetFromReply(ctx);

  if (!target) {
    botReply(
      ctx,
      "يجب استخدام الأمر بالرد على العضو."
    );

    return null;
  }

  return target;
}

async function safeGetMember(ctx, userId) {
  try {
    return await ctx.telegram.getChatMember(
      ctx.chat.id,
      userId
    );
  } catch {
    return null;
  }
}

async function targetProtected(ctx, targetId) {
  const member =
    await safeGetMember(
      ctx,
      targetId
    );

  if (member?.status === "creator") {
    return true;
  }

  const chat =
    ensureChat(ctx.chat.id);

  return !canTarget(
    chat,
    ctx.from.id,
    targetId
  );
}

/* =========================================================
   السجل
========================================================= */

function logAdmin(
  chat,
  actorId,
  action,
  targetId = null
) {
  const item = {
    actorId: String(actorId),
    targetId:
      targetId !== null
        ? String(targetId)
        : null,
    action,
    time: Date.now()
  };

  chat.adminLog.push(item);

  if (chat.adminLog.length > 500) {
    chat.adminLog =
      chat.adminLog.slice(-500);
  }

  db.botLog.push({
    chatId: chat.id,
    ...item
  });

  if (db.botLog.length > 2000) {
    db.botLog =
      db.botLog.slice(-2000);
  }

  saveDB();
}

/* =========================================================
   الصلاحيات
========================================================= */

function requireRank(ctx, requiredRank) {
  if (!ctx.chat) {
    return false;
  }

  const chat =
    ensureChat(ctx.chat.id);

  const rank =
    getRank(
      chat,
      ctx.from.id
    );

  if (
    rankValue(rank) <
    rankValue(requiredRank)
  ) {
    botReply(
      ctx,
      rankPermissionMessage(
        requiredRank
      )
    );

    return false;
  }

  return true;
}

function requireAdminRank(ctx) {
  return requireRank(
    ctx,
    "مميز"
  );
}

/* =========================================================
   التفاعل
========================================================= */

function addInteraction(
  chat,
  userId,
  points = 1
) {
  const id =
    String(userId);

  if (!chat.interactions[id]) {
    chat.interactions[id] = {
      id,
      messages: 0,
      points: 0
    };
  }

  chat.interactions[id].messages++;
  chat.interactions[id].points +=
    points;
}

function getInteraction(
  chat,
  userId
) {
  const id =
    String(userId);

  if (!chat.interactions[id]) {
    chat.interactions[id] = {
      id,
      messages: 0,
      points: 0
    };
  }

  return chat.interactions[id];
}

function getInteractionRanking(chat) {
  return Object.entries(
    chat.interactions
  ).sort((a, b) => {
    const pa =
      Number(a[1]?.points || 0);

    const pb =
      Number(b[1]?.points || 0);

    if (pb !== pa) {
      return pb - pa;
    }

    return (
      Number(b[1]?.messages || 0) -
      Number(a[1]?.messages || 0)
    );
  });
}

function getInteractionPosition(
  chat,
  userId
) {
  const ranking =
    getInteractionRanking(chat);

  const index =
    ranking.findIndex(
      ([id]) =>
        String(id) ===
        String(userId)
    );

  return index === -1
    ? 0
    : index + 1;
}

/* =========================================================
   Middleware الأساسي
========================================================= */

bot.use(
  async (ctx, next) => {
    try {
      if (ctx.from) {
        ensureGlobalUser(
          ctx.from
        );
      }

      if (
        ctx.chat &&
        ctx.chat.type !== "private" &&
        ctx.from
      ) {
        const chat =
          ensureChat(
            ctx.chat.id
          );

        ensureChatUser(
          chat,
          ctx.from
        );

        /*
          لا نحسب الأوامر الخاصة والبوتات
          داخل حماية التكرار وغيرها
        */
        if (ctx.message) {
          addInteraction(
            chat,
            ctx.from.id,
            1
          );

          const user =
            chat.users[
              String(ctx.from.id)
            ];

          user.messages++;

          const msg =
            ctx.message;

          chat.messageLog.push({
            messageId:
              msg.message_id,

            userId:
              String(ctx.from.id),

            time:
              Date.now(),

            text:
              msg.text ||
              msg.caption ||
              "",

            photo:
              !!msg.photo,

            video:
              !!msg.video,

            document:
              !!msg.document,

            sticker:
              !!msg.sticker,

            animation:
              !!msg.animation,

            audio:
              !!msg.audio,

            voice:
              !!msg.voice
          });

          if (
            chat.messageLog.length >
            2000
          ) {
            chat.messageLog =
              chat.messageLog.slice(-2000);
          }
        }

        saveDB();
      }

      return next();
    } catch (error) {
      console.error(
        "MIDDLEWARE ERROR:",
        error
      );

      return next();
    }
  }
);

/* =========================================================
   START
========================================================= */

bot.start(
  async ctx => {
    ensureGlobalUser(
      ctx.from
    );

    const payload =
      ctx.startPayload || "";

    if (
      payload.startsWith("whisper_") ||
      payload.startsWith("reply_")
    ) {
      return handleWhisperStart(
        ctx,
        payload
      );
    }

    if (
      ctx.chat.type !== "private"
    ) {
      return;
    }

    await ctx.reply(
      `اهلا بك - ${mentionUser(ctx.from)}\n\n` +
      `انا ايف، البوت الخاص بالقروبات.\n\n` +
      `اضفني إلى مجموعتك وابدأ التحكم.`,
      {
        parse_mode: "MarkdownV2",
        ...Markup.inlineKeyboard([
          [
            Markup.button.url(
              "أضفني في مجموعتك",
              `https://t.me/${ctx.botInfo.username}?startgroup=true`
            )
          ],
          [
            Markup.button.url(
              "المطور",
              "https://t.me/j4xa7"
            )
          ]
        ])
      }
    );
  }
);

/* =========================================================
   الرتبة
========================================================= */

bot.hears(
  "رتبتي",
  async ctx => {
    const chat =
      ensureChat(ctx.chat.id);

    await botReply(
      ctx,
      `رتبتك: ${getRank(
        chat,
        ctx.from.id
      )}`
    );
  }
);

bot.hears(
  "رتبته",
  async ctx => {
    const target =
      replyRequired(ctx);

    if (!target) return;

    const chat =
      ensureChat(ctx.chat.id);

    await botReply(
      ctx,
      `رتبته: ${getRank(
        chat,
        target.id
      )}`
    );
  }
);

/* =========================================================
   التفاعل
========================================================= */

bot.hears(
  "تفاعلي",
  async ctx => {
    const chat =
      ensureChat(ctx.chat.id);

    const stats =
      getInteraction(
        chat,
        ctx.from.id
      );

    await botReply(
      ctx,
      `رتبتك: ${getRank(
        chat,
        ctx.from.id
      )}\n` +
      `عدد رسائلك: ${stats.messages}\n` +
      `ترتيبك: ${getInteractionPosition(
        chat,
        ctx.from.id
      )}`
    );
  }
);

bot.hears(
  "تفاعله",
  async ctx => {
    const target =
      replyRequired(ctx);

    if (!target) return;

    const chat =
      ensureChat(ctx.chat.id);

    const stats =
      getInteraction(
        chat,
        target.id
      );

    await botReply(
      ctx,
      `رتبته: ${getRank(
        chat,
        target.id
      )}\n` +
      `عدد رسائله: ${stats.messages}\n` +
      `ترتيبه: ${getInteractionPosition(
        chat,
        target.id
      )}`
    );
  }
);

bot.hears(
  "المتفاعلين",
  async ctx => {
    const chat =
      ensureChat(ctx.chat.id);

    const list =
      getInteractionRanking(chat)
        .slice(0, 20);

    if (!list.length) {
      return botReply(
        ctx,
        "لا توجد بيانات تفاعل حتى الآن."
      );
    }

    const lines = [];

    for (
      const [id, item]
      of list
    ) {
      const user =
        chat.users[id] ||
        db.users[id];

      if (!user) continue;

      lines.push(
        `• ${mentionUser({
          id,
          first_name:
            user.firstName ||
            user.first_name ||
            user.username ||
            "المستخدم"
        })} ↤︎ ${
          item.points || 0
        }`
      );
    }

    await botReply(
      ctx,
      lines.join("\n"),
      {
        parse_mode: "MarkdownV2"
      }
    );
  }
);

/* =========================================================
   الفلوس
========================================================= */

function addBalance(
  userId,
  amount
) {
  const user =
    ensureGlobalUser({
      id: userId
    });

  user.balance +=
    Number(amount) || 0;

  if (user.balance < 0) {
    user.balance = 0;
  }

  saveDB();

  return user.balance;
}

function getBalance(userId) {
  return ensureGlobalUser({
    id: userId
  }).balance;
}

bot.hears(
  /^فلوسي$/i,
  async ctx => {
    await botReply(
      ctx,
      `فلوسك: ${getBalance(
        ctx.from.id
      )} ريال`
    );
  }
);

bot.hears(
  /^فلوسه$/i,
  async ctx => {
    const target =
      replyRequired(ctx);

    if (!target) return;

    await botReply(
      ctx,
      `فلوسه: ${getBalance(
        target.id
      )} ريال`
    );
  }
);

bot.hears(
  /^اهداء\s+(\d+)$/i,
  async ctx => {
    const target =
      replyRequired(ctx);

    if (!target) return;

    const amount =
      Number(ctx.match[1]);

    if (amount <= 0) {
      return botReply(
        ctx,
        "المبلغ غير صحيح."
      );
    }

    if (
      String(target.id) ===
      String(ctx.from.id)
    ) {
      return botReply(
        ctx,
        "لا يمكنك إهداء نفسك."
      );
    }

    if (
      getBalance(
        ctx.from.id
      ) < amount
    ) {
      return botReply(
        ctx,
        "رصيدك لا يكفي."
      );
    }

    addBalance(
      ctx.from.id,
      -amount
    );

    addBalance(
      target.id,
      amount
    );

    await botReply(
      ctx,
      `تم إهداء ${amount} ريال إلى ${mentionUser(target)}`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }
);

/* =========================================================
   الرتب - رفع وتنزيل
========================================================= */

function rankAction(
  ctx,
  target,
  newRank
) {
  const chat =
    ensureChat(ctx.chat.id);

  const actorRank =
    getRank(
      chat,
      ctx.from.id
    );

  const targetRank =
    getRank(
      chat,
      target.id
    );

  if (
    String(ctx.from.id) ===
    String(target.id)
  ) {
    return "لا يمكنك تعديل رتبتك بنفسك.";
  }

  if (
    rankValue(targetRank) >=
    rankValue(actorRank)
  ) {
    return "لا يمكنك تعديل رتبة مساوية أو أعلى منك.";
  }

  if (
    rankValue(newRank) >=
    rankValue(actorRank)
  ) {
    return "لا يمكنك إعطاء رتبة مساوية أو أعلى من رتبتك.";
  }

  if (
    isDev(
      target.id,
      target.username
    ) &&
    !isDev(
      ctx.from.id,
      ctx.from.username
    )
  ) {
    return "لا يمكنك تعديل رتبة المطور.";
  }

  return null;
}

async function setRank(
  ctx,
  newRank
) {
  const target =
    replyRequired(ctx);

  if (!target) return;

  const error =
    rankAction(
      ctx,
      target,
      newRank
    );

  if (error) {
    return botReply(
      ctx,
      error
    );
  }

  const chat =
    ensureChat(ctx.chat.id);

  ensureChatUser(
    chat,
    target
  ).rank = newRank;

  logAdmin(
    chat,
    ctx.from.id,
    `رفع رتبة إلى ${newRank}`,
    target.id
  );

  saveDB();

  await botReply(
    ctx,
    `تم رفع ${mentionUser(target)} إلى رتبة ${newRank}.`,
    {
      parse_mode: "MarkdownV2"
    }
  );
}

async function removeRank(ctx) {
  const target =
    replyRequired(ctx);

  if (!target) return;

  const chat =
    ensureChat(ctx.chat.id);

  const actorRank =
    getRank(
      chat,
      ctx.from.id
    );

  const targetRank =
    getRank(
      chat,
      target.id
    );

  if (
    String(ctx.from.id) ===
    String(target.id)
  ) {
    return botReply(
      ctx,
      "لا يمكنك تعديل رتبتك بنفسك."
    );
  }

  if (
    rankValue(targetRank) >=
    rankValue(actorRank)
  ) {
    return botReply(
      ctx,
      "لا يمكنك تنزيل رتبة مساوية أو أعلى منك."
    );
  }

  ensureChatUser(
    chat,
    target
  ).rank = "عضو";

  logAdmin(
    chat,
    ctx.from.id,
    `تنزيل الرتبة ${targetRank}`,
    target.id
  );

  saveDB();

  await botReply(
    ctx,
    `تم تنزيل رتبة ${mentionUser(target)}.`,
    {
      parse_mode: "MarkdownV2"
    }
  );
}

const rankCommands = [
  ["رفع مميز", "مميز", "مميز"],
  ["رفع مالك", "مالك", "مالك أساسي"],
  ["رفع اساس", "مالك أساسي", "مالك أساسي"],
  ["رفع M", "Myth", "Myth"],
  ["رفع My", "Myth 🎖️", "Myth 🎖️"],
  ["رفع اكس", "Myth 🎖️", "Myth 🎖️"],
  ["رفع ديف", "Dev²🎖️", "Dev🎖️"],
  ["رفع مطور ثانوي", "Dev²🎖️", "Dev🎖️"]
];

for (
  const [command, rank, required]
  of rankCommands
) {
  bot.hears(
    new RegExp(
      `^${command.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      )}$`,
      "i"
    ),
    async ctx => {
      if (
        !requireRank(
          ctx,
          required
        )
      ) return;

      await setRank(
        ctx,
        rank
      );
    }
  );
}

bot.hears(
  /^تنزيل\s+(مميز|مالك|اساس|M|My|اكس|ديف|مطور ثانوي)$/i,
  async ctx => {
    const rank =
      normalizeRank(
        ctx.match[1]
      );

    if (!rank) return;

    let required =
      "مميز";

    if (
      rankValue(rank) >= 6
    ) {
      required = "Dev🎖️";
    } else if (
      rankValue(rank) >= 5
    ) {
      required = "Dev²🎖️";
    } else if (
      rankValue(rank) >= 4
    ) {
      required = "Myth";
    } else if (
      rankValue(rank) >= 3
    ) {
      required = "Myth";
    } else if (
      rankValue(rank) >= 2
    ) {
      required = "مالك أساسي";
    }

    if (
      !requireRank(
        ctx,
        required
      )
    ) return;

    await removeRank(ctx);
  }
);

/* =========================================================
   الحماية - الإعدادات
========================================================= */

const protectionSwitches = {
  "الروابط": "preventLinks",
  "التعديل": "preventEdits",
  "التكرار": "preventSpam",
  "الإعلانات": "preventAds",
  "المنشن": "preventMentions",
  "الفوروارد": "preventForwards"
};

bot.hears(
  "تفعيل الحماية",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    ensureChat(
      ctx.chat.id
    ).settings.protection = true;

    saveDB();

    await botReply(
      ctx,
      "تم تفعيل الحماية."
    );
  }
);

bot.hears(
  "تعطيل الحماية",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    ensureChat(
      ctx.chat.id
    ).settings.protection = false;

    saveDB();

    await botReply(
      ctx,
      "تم تعطيل الحماية."
    );
  }
);

bot.hears(
  "تفعيل الحماية التلقائية",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    ensureChat(
      ctx.chat.id
    ).settings.automaticProtection = true;

    saveDB();

    await botReply(
      ctx,
      "تم تفعيل الحماية التلقائية."
    );
  }
);

bot.hears(
  "تعطيل الحماية التلقائية",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    ensureChat(
      ctx.chat.id
    ).settings.automaticProtection = false;

    saveDB();

    await botReply(
      ctx,
      "تم تعطيل الحماية التلقائية."
    );
  }
);

for (
  const [name, key]
  of Object.entries(
    protectionSwitches
  )
) {
  bot.hears(
    `تفعيل منع ${name}`,
    async ctx => {
      if (!requireAdminRank(ctx)) return;

      ensureChat(
        ctx.chat.id
      ).settings[key] = true;

      saveDB();

      await botReply(
        ctx,
        `تم تفعيل منع ${name}.`
      );
    }
  );

  bot.hears(
    `تعطيل منع ${name}`,
    async ctx => {
      if (!requireAdminRank(ctx)) return;

      ensureChat(
        ctx.chat.id
      ).settings[key] = false;

      saveDB();

      await botReply(
        ctx,
        `تم تعطيل منع ${name}.`
      );
    }
  );
}

bot.hears(
  "حالة الحماية",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    const s =
      ensureChat(
        ctx.chat.id
      ).settings;

    await botReply(
      ctx,
`حالة الحماية

الحماية: ${s.protection ? "مفعلة" : "معطلة"}
الحماية التلقائية: ${s.automaticProtection ? "مفعلة" : "معطلة"}

منع الروابط: ${s.preventLinks ? "مفعل" : "معطل"}
منع التعديل: ${s.preventEdits ? "مفعل" : "معطل"}
منع التكرار: ${s.preventSpam ? "مفعل" : "معطل"}
منع الإعلانات: ${s.preventAds ? "مفعل" : "معطل"}
منع المنشن: ${s.preventMentions ? "مفعل" : "معطل"}
منع الفوروارد: ${s.preventForwards ? "مفعل" : "معطل"}

الإنذارات: ${s.warningsEnabled ? "مفعلة" : "معطلة"}
الكتم التلقائي: ${s.autoMute ? "مفعل" : "معطل"}
الحظر التلقائي: ${s.autoBan ? "مفعل" : "معطل"}`
    );
  }
);

/* =========================================================
   الحماية الفعلية
========================================================= */

function isProtectedRank(
  chat,
  userId
) {
  return (
    rankValue(
      getRank(
        chat,
        userId
      )
    ) >= 1
  );
}

function hasLink(text) {
  return /(https?:\/\/|www\.|t\.me\/|telegram\.me\/)/i.test(
    String(text || "")
  );
}

function hasMention(text) {
  return /@[A-Za-z0-9_]{3,}/.test(
    String(text || "")
  );
}

function hasPhoneNumber(text) {
  return /(?:\+?\d[\d\s\-()]{7,}\d)/.test(
    String(text || "")
  );
}

function hasChannelId(text) {
  return /(?:t\.me\/|telegram\.me\/|@)[A-Za-z0-9_]{5,}/i.test(
    String(text || "")
  );
}

function hasEnglish(text) {
  const letters =
    String(text || "").match(
      /[A-Za-z]/g
    );

  return (
    !!letters &&
    letters.length >= 3
  );
}

function hasAdvertisement(text) {
  const value =
    String(text || "")
      .toLowerCase();

  const words = [
    "للبيع",
    "بيع",
    "شراء",
    "خصم",
    "عرض",
    "متجر",
    "تواصل خاص",
    "راسلني",
    "اعلان",
    "إعلان",
    "سحب",
    "مسابقة"
  ];

  return (
    words.some(
      word =>
        value.includes(word)
    ) &&
    (
      hasLink(text) ||
      /ريال|دولار|خصم|عرض/i.test(
        text
      )
    )
  );
}

function isLongMessage(text) {
  return String(text || "")
    .length > 1000;
}

function isDuplicate(
  chat,
  userId,
  text
) {
  const id =
    String(userId);

  chat._lastMessages ||= {};

  const now =
    Date.now();

  const normalized =
    String(text || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const previous =
    chat._lastMessages[id];

  chat._lastMessages[id] = {
    text: normalized,
    time: now
  };

  if (!previous) {
    return false;
  }

  return (
    previous.text === normalized &&
    now - previous.time <= 8000
  );
}

const protectionMessages = {
  "التعديل":
    "ممنوع ارسال تعديل الرسائل",

  "الروابط":
    "ممنوع إرسال الروابط",

  "التكرار":
    "ممنوع تكرار الرسائل",

  "الإعلانات":
    "ممنوع إرسال الإعلانات",

  "المنشن":
    "ممنوع إرسال المنشنات",

  "الفوروارد":
    "ممنوع إرسال الفوروارد",

  "الصور":
    "ممنوع إرسال الصور",

  "الفيديوهات":
    "ممنوع إرسال الفيديوهات",

  "الملفات":
    "ممنوع إرسال الملفات",

  "الملصقات":
    "ممنوع إرسال الملصقات",

  "GIF":
    "ممنوع إرسال الصور المتحركة",

  "الصوتيات":
    "ممنوع إرسال الصوتيات",

  "الرسائل الطويلة":
    "ممنوع إرسال الرسائل الطويلة",

  "الإنجليزية":
    "ممنوع إرسال الرسائل باللغة الإنجليزية",

  "أرقام الهواتف":
    "ممنوع إرسال أرقام الهواتف",

  "معرفات القنوات":
    "ممنوع إرسال معرفات القنوات والمجموعات",

  "الأوامر":
    "ممنوع إرسال الأوامر",

  "الكلمات الممنوعة":
    "ممنوع إرسال الكلمات الممنوعة",

  "ممنوع إرسال الرسائل":
    "ممنوع إرسال الرسائل"
};

async function protectionDelete(
  ctx,
  reason
) {
  try {
    await ctx.telegram.deleteMessage(
      ctx.chat.id,
      ctx.message.message_id
    );
  } catch {}

  const text =
    protectionMessages[reason] ||
    reason;

  try {
    await botReply(
      ctx,
      `${mentionUser(ctx.from)}، ${text}`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  } catch {}
}

/*
  مهم:
  هذا middleware يستخدم next
  حتى لا يمنع bot.hears من العمل.
*/
bot.on(
  "message",
  async (ctx, next) => {
    try {
      if (
        !ctx.chat ||
        ctx.chat.type === "private" ||
        !ctx.from ||
        !ctx.message
      ) {
        return next();
      }

      const chat =
        ensureChat(
          ctx.chat.id
        );

      const s =
        chat.settings;

      if (
        !s.protection ||
        !s.automaticProtection ||
        !s.violationsOpen
      ) {
        return next();
      }

      if (
        isProtectedRank(
          chat,
          ctx.from.id
        )
      ) {
        return next();
      }

      const msg =
        ctx.message;

      const text =
        msg.text ||
        msg.caption ||
        "";

      if (
        s.locks.chat &&
        text
      ) {
        return protectionDelete(
          ctx,
          "ممنوع إرسال الرسائل"
        );
      }

      if (
        s.preventCommands &&
        text.startsWith("/")
      ) {
        return protectionDelete(
          ctx,
          "الأوامر"
        );
      }

      if (
        s.preventLinks &&
        hasLink(text)
      ) {
        return protectionDelete(
          ctx,
          "الروابط"
        );
      }

      if (
        s.preventAds &&
        hasAdvertisement(text)
      ) {
        return protectionDelete(
          ctx,
          "الإعلانات"
        );
      }

      if (
        s.preventMentions &&
        hasMention(text)
      ) {
        return protectionDelete(
          ctx,
          "المنشن"
        );
      }

      if (
        s.preventForwards &&
        (
          msg.forward_origin ||
          msg.forward_from ||
          msg.forward_from_chat
        )
      ) {
        return protectionDelete(
          ctx,
          "الفوروارد"
        );
      }

      if (
        s.preventSpam &&
        text &&
        isDuplicate(
          chat,
          ctx.from.id,
          text
        )
      ) {
        return protectionDelete(
          ctx,
          "التكرار"
        );
      }

      if (
        s.preventEnglish &&
        text &&
        hasEnglish(text)
      ) {
        return protectionDelete(
          ctx,
          "الإنجليزية"
        );
      }

      if (
        s.preventLongMessages &&
        text &&
        isLongMessage(text)
      ) {
        return protectionDelete(
          ctx,
          "الرسائل الطويلة"
        );
      }

      if (
        s.preventPhoneNumbers &&
        text &&
        hasPhoneNumber(text)
      ) {
        return protectionDelete(
          ctx,
          "أرقام الهواتف"
        );
      }

      if (
        s.preventChannelIds &&
        text &&
        hasChannelId(text)
      ) {
        return protectionDelete(
          ctx,
          "معرفات القنوات"
        );
      }

      if (
        s.preventBannedWords &&
        s.bannedWords.some(
          word =>
            text
              .toLowerCase()
              .includes(
                String(word)
                  .toLowerCase()
              )
        )
      ) {
        return protectionDelete(
          ctx,
          "الكلمات الممنوعة"
        );
      }

      const mediaChecks = [
        [
          s.locks.photos,
          msg.photo,
          "الصور"
        ],
        [
          s.locks.videos,
          msg.video,
          "الفيديوهات"
        ],
        [
          s.locks.files,
          msg.document,
          "الملفات"
        ],
        [
          s.locks.stickers,
          msg.sticker,
          "الملصقات"
        ],
        [
          s.locks.gifs,
          msg.animation,
          "GIF"
        ],
        [
          s.locks.audio,
          msg.audio || msg.voice,
          "الصوتيات"
        ]
      ];

      for (
        const [
          enabled,
          exists,
          reason
        ] of mediaChecks
      ) {
        if (
          (s.locks.media || enabled) &&
          exists
        ) {
          return protectionDelete(
            ctx,
            reason
          );
        }
      }

      if (
        s.locks.links &&
        hasLink(text)
      ) {
        return protectionDelete(
          ctx,
          "الروابط"
        );
      }

      if (
        s.locks.forwards &&
        (
          msg.forward_origin ||
          msg.forward_from ||
          msg.forward_from_chat
        )
      ) {
        return protectionDelete(
          ctx,
          "الفوروارد"
        );
      }

      return next();

    } catch (error) {
      console.error(
        "Protection error:",
        error
      );

      return next();
    }
  }
);

/* =========================================================
   حماية التعديل
========================================================= */

bot.on(
  "edited_message",
  async ctx => {
    try {
      if (
        !ctx.chat ||
        ctx.chat.type === "private" ||
        !ctx.from
      ) {
        return;
      }

      const chat =
        ensureChat(
          ctx.chat.id
        );

      if (
        !chat.settings.protection ||
        !chat.settings.preventEdits ||
        isProtectedRank(
          chat,
          ctx.from.id
        )
      ) {
        return;
      }

      try {
        await ctx.telegram.deleteMessage(
          ctx.chat.id,
          ctx.editedMessage.message_id
        );
      } catch {}

      await ctx.reply(
        `${mentionUser(ctx.from)}، ممنوع ارسال تعديل الرسائل`,
        {
          parse_mode: "MarkdownV2",
          reply_to_message_id:
            ctx.editedMessage.message_id
        }
      );
    } catch {}
  }
);

/* =========================================================
   العقوبات
========================================================= */

async function restoreMember(
  ctx,
  targetId
) {
  return ctx.telegram.restrictChatMember(
    ctx.chat.id,
    targetId,
    {
      can_send_messages: true,
      can_send_audios: true,
      can_send_documents: true,
      can_send_photos: true,
      can_send_videos: true,
      can_send_video_notes: true,
      can_send_voice_notes: true,
      can_send_polls: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
      can_invite_users: true,
      can_change_info: false,
      can_pin_messages: false,
      can_manage_topics: false
    }
  );
}

async function punish(
  ctx,
  type
) {
  const target =
    replyRequired(ctx);

  if (!target) return;

  if (
    await targetProtected(
      ctx,
      target.id
    )
  ) {
    return botReply(
      ctx,
      "لا يمكنك معاقبة هذا العضو."
    );
  }

  try {
    const chat =
      ensureChat(
        ctx.chat.id
      );

    if (type === "mute") {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        target.id,
        {
          can_send_messages: false
        }
      );

      chat.muted[
        String(target.id)
      ] = {
        time: Date.now()
      };
    }

    if (type === "globalMute") {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        target.id,
        {
          can_send_messages: false
        }
      );

      chat.globalMuted[
        String(target.id)
      ] = {
        time: Date.now()
      };
    }

    if (type === "restrict") {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        target.id,
        {
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
      );

      chat.restricted[
        String(target.id)
      ] = {
        time: Date.now()
      };
    }

    if (type === "ban") {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        target.id
      );

      chat.banned[
        String(target.id)
      ] = true;
    }

    if (type === "kick") {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        target.id
      );

      await ctx.telegram.unbanChatMember(
        ctx.chat.id,
        target.id
      );
    }

    logAdmin(
      chat,
      ctx.from.id,
      type,
      target.id
    );

    saveDB();

    await botReply(
      ctx,
      `تم تنفيذ ${type} على ${mentionUser(target)}`,
      {
        parse_mode: "MarkdownV2"
      }
    );

  } catch (error) {
    console.error(
      "Punishment error:",
      error
    );

    await botReply(
      ctx,
      `تعذر تنفيذ الأمر.\n${
        error?.description ||
        "تأكد من صلاحيات البوت."
      }`
    );
  }
}

bot.hears(
  "كتم",
  async ctx => {
    if (!requireRank(ctx, "Myth")) return;
    await punish(ctx, "mute");
  }
);

bot.hears(
  "فك كتم",
  async ctx => {
    if (!requireRank(ctx, "Myth")) return;

    const target =
      replyRequired(ctx);

    if (!target) return;

    try {
      await restoreMember(
        ctx,
        target.id
      );

      const chat =
        ensureChat(ctx.chat.id);

      delete chat.muted[
        String(target.id)
      ];

      saveDB();

      await botReply(
        ctx,
        `تم فك كتم ${mentionUser(target)}`,
        {
          parse_mode: "MarkdownV2"
        }
      );
    } catch {
      await botReply(
        ctx,
        "تعذر فك الكتم."
      );
    }
  }
);

bot.hears(
  "عام",
  async ctx => {
    if (!requireRank(ctx, "Myth 🎖️")) return;
    await punish(ctx, "globalMute");
  }
);

bot.hears(
  "فك الكتم العام",
  async ctx => {
    if (!requireRank(ctx, "Myth 🎖️")) return;

    const target =
      replyRequired(ctx);

    if (!target) return;

    try {
      await restoreMember(
        ctx,
        target.id
      );

      delete ensureChat(
        ctx.chat.id
      ).globalMuted[
        String(target.id)
      ];

      saveDB();

      await botReply(
        ctx,
        `تم فك الكتم العام عن ${mentionUser(target)}`,
        {
          parse_mode: "MarkdownV2"
        }
      );
    } catch {
      await botReply(
        ctx,
        "تعذر فك الكتم العام."
      );
    }
  }
);

bot.hears(
  "تقييد",
  async ctx => {
    if (!requireRank(ctx, "Dev²🎖️")) return;
    await punish(ctx, "restrict");
  }
);

bot.hears(
  "الغاء التقييد",
  async ctx => {
    if (!requireRank(ctx, "مالك أساسي")) return;

    const target =
      replyRequired(ctx);

    if (!target) return;

    try {
      await restoreMember(
        ctx,
        target.id
      );

      delete ensureChat(
        ctx.chat.id
      ).restricted[
        String(target.id)
      ];

      saveDB();

      await botReply(
        ctx,
        `تم الغاء التقييد عن ${mentionUser(target)}`,
        {
          parse_mode: "MarkdownV2"
        }
      );
    } catch {
      await botReply(
        ctx,
        "تعذر الغاء التقييد."
      );
    }
  }
);

bot.hears(
  "حظر",
  async ctx => {
    if (!requireRank(ctx, "Myth 🎖️")) return;
    await punish(ctx, "ban");
  }
);

bot.hears(
  "فك الحظر",
  async ctx => {
    if (!requireRank(ctx, "Myth 🎖️")) return;

    const target =
      replyRequired(ctx);

    if (!target) return;

    try {
      await ctx.telegram.unbanChatMember(
        ctx.chat.id,
        target.id,
        {
          only_if_banned: true
        }
      );

      delete ensureChat(
        ctx.chat.id
      ).banned[
        String(target.id)
      ];

      saveDB();

      await botReply(
        ctx,
        `تم فك الحظر عن ${mentionUser(target)}`,
        {
          parse_mode: "MarkdownV2"
        }
      );
    } catch {
      await botReply(
        ctx,
        "تعذر فك الحظر."
      );
    }
  }
);

bot.hears(
  "طرد",
  async ctx => {
    if (!requireRank(ctx, "Myth 🎖️")) return;
    await punish(ctx, "kick");
  }
);

bot.hears(
  "مم",
  async ctx => {
    if (!requireRank(ctx, "Myth")) return;

    ensureChat(
      ctx.chat.id
    ).muted = {};

    saveDB();

    await botReply(
      ctx,
      "تم مسح المكتومين."
    );
  }
);

bot.hears(
  "خخ",
  async ctx => {
    if (!requireRank(ctx, "Myth 🎖️")) return;

    ensureChat(
      ctx.chat.id
    ).globalMuted = {};

    saveDB();

    await botReply(
      ctx,
      "تم مسح المكتومين عام."
    );
  }
);

bot.hears(
  "مسح المكتومين",
  async ctx => {
    if (!requireRank(ctx, "Myth")) return;

    ensureChat(
      ctx.chat.id
    ).muted = {};

    saveDB();

    await botReply(
      ctx,
      "تم مسح المكتومين."
    );
  }
);

bot.hears(
  "مسح المكتومين عام",
  async ctx => {
    if (!requireRank(ctx, "Myth 🎖️")) return;

    ensureChat(
      ctx.chat.id
    ).globalMuted = {};

    saveDB();

    await botReply(
      ctx,
      "تم مسح المكتومين عام."
    );
  }
);

/* =========================================================
   التحذيرات
========================================================= */

async function addWarning(
  ctx,
  target,
  reason = "مخالفة"
) {
  const chat =
    ensureChat(
      ctx.chat.id
    );

  const id =
    String(target.id);

  chat.warnings[id] =
    Number(
      chat.warnings[id] || 0
    ) + 1;

  const user =
    ensureChatUser(
      chat,
      target
    );

  user.warnings =
    chat.warnings[id];

  user.violations.push({
    reason,
    time: Date.now()
  });

  const count =
    chat.warnings[id];

  if (
    chat.settings.autoMute &&
    count >=
      chat.settings.warningLimit
  ) {
    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        target.id,
        {
          can_send_messages: false
        }
      );
    } catch {}
  }

  saveDB();

  return count;
}

bot.hears(
  "تحذير",
  async ctx => {
    if (!requireRank(ctx, "Myth")) return;

    const target =
      replyRequired(ctx);

    if (!target) return;

    if (
      await targetProtected(
        ctx,
        target.id
      )
    ) {
      return botReply(
        ctx,
        "لا يمكنك معاقبة هذا العضو."
      );
    }

    const count =
      await addWarning(
        ctx,
        target
      );

    await botReply(
      ctx,
      `تم تحذير ${mentionUser(target)}\nعدد الإنذارات: ${count}`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }
);

bot.hears(
  "الغاء التحذير",
  async ctx => {
    if (!requireRank(ctx, "Myth")) return;

    const target =
      replyRequired(ctx);

    if (!target) return;

    const chat =
      ensureChat(
        ctx.chat.id
      );

    delete chat.warnings[
      String(target.id)
    ];

    if (
      chat.users[
        String(target.id)
      ]
    ) {
      chat.users[
        String(target.id)
      ].warnings = 0;

      chat.users[
        String(target.id)
      ].violations = [];
    }

    saveDB();

    await botReply(
      ctx,
      `تم الغاء تحذيرات ${mentionUser(target)}`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }
);

bot.hears(
  "مسح المخالفات",
  async ctx => {
    if (!requireRank(ctx, "Myth")) return;

    const chat =
      ensureChat(
        ctx.chat.id
      );

    chat.warnings = {};

    for (
      const user
      of Object.values(chat.users)
    ) {
      user.warnings = 0;
      user.violations = [];
    }

    saveDB();

    await botReply(
      ctx,
      "تم مسح سجل المخالفات."
    );
  }
);

/* =========================================================
   تنظيف - للعضو فقط
========================================================= */

const CLEAN_TYPES = {
  0: "text",
  1: "photo",
  2: "video",
  3: "document",
  4: "sticker",
  5: "animation",
  6: "audio",
  7: "voice",
  8: "link",
  9: "all"
};

function messageMatchesType(
  item,
  type
) {
  if (!item) return false;

  const text =
    item.text || "";

  switch (type) {
    case 0:
      return !!text;

    case 1:
      return !!item.photo;

    case 2:
      return !!item.video;

    case 3:
      return !!item.document;

    case 4:
      return !!item.sticker;

    case 5:
      return !!item.animation;

    case 6:
      return !!item.audio;

    case 7:
      return !!item.voice;

    case 8:
      return hasLink(text);

    case 9:
      return true;

    default:
      return false;
  }
}

bot.hears(
  /^تنظيف(?:\s+(\d+))?$/i,
  async ctx => {
    const chat =
      ensureChat(
        ctx.chat.id
      );

    if (
      getRank(
        chat,
        ctx.from.id
      ) !== "عضو"
    ) {
      return botReply(
        ctx,
        "• هذا الامر مخصص لـ ↤ العضو"
      );
    }

    const value =
      ctx.match[1];

    let amount = 50;
    let type = 9;

    if (value) {
      const number =
        Number(value);

      if (
        CLEAN_TYPES[number] !==
        undefined
      ) {
        type = number;
      } else {
        amount =
          Math.min(
            100,
            Math.max(
              1,
              number
            )
          );
      }
    }

    const messages =
      chat.messageLog
        .slice(-amount)
        .reverse();

    let deleted = 0;

    for (
      const item of messages
    ) {
      if (
        !messageMatchesType(
          item,
          type
        )
      ) {
        continue;
      }

      try {
        await ctx.telegram.deleteMessage(
          ctx.chat.id,
          item.messageId
        );

        deleted++;
      } catch {}
    }

    await botReply(
      ctx,
      `تم تنظيف ${deleted} رسالة.`
    );
  }
);

/* =========================================================
   الهمسات
========================================================= */

async function sendWhisper(
  ctx,
  target,
  content
) {
  const token =
    randomToken();

  const chat =
    ensureChat(
      ctx.chat.id
    );

  chat.whispers[token] = {
    token,
    chatId:
      String(ctx.chat.id),

    senderId:
      String(ctx.from.id),

    targetId:
      String(target.id),

    content,

    createdAt:
      Date.now(),

    replied: false,

    waitingReply: null
  };

  saveDB();

  const botUsername =
    ctx.botInfo.username;

  await botReply(
    ctx,
    `• همسة من ${mentionUser(ctx.from)} إلى ${mentionUser(target)}`,
    {
      parse_mode: "MarkdownV2",
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            "رؤية الهمسه",
            `https://t.me/${botUsername}?start=whisper_${ctx.chat.id}_${token}`
          ),
          Markup.button.url(
            "رد على الهمسه",
            `https://t.me/${botUsername}?start=reply_${ctx.chat.id}_${token}`
          )
        ]
      ])
    }
  );
}

async function handleWhisperStart(
  ctx,
  payload
) {
  const parts =
    payload.split("_");

  const mode =
    parts[0];

  const chatId =
    parts[1];

  const token =
    parts.slice(2).join("_");

  const chat =
    db.chats[
      String(chatId)
    ];

  const whisper =
    chat?.whispers?.[token];

  if (!whisper) {
    return ctx.reply(
      "هذه الهمسة غير موجودة أو انتهت."
    );
  }

  if (
    mode === "whisper"
  ) {
    if (
      String(ctx.from.id) !==
      String(whisper.targetId)
    ) {
      return ctx.reply(
        "هذه الهمسة ليست موجهة لك."
      );
    }

    const c =
      whisper.content;

    if (
      c.type === "text"
    ) {
      return ctx.reply(
        `• الهمسة:\n\n${c.text}`
      );
    }

    if (
      c.type === "photo"
    ) {
      return ctx.telegram.sendPhoto(
        ctx.from.id,
        c.fileId,
        {
          caption:
            c.caption ||
            "• الهمسة"
        }
      );
    }

    if (
      c.type === "sticker"
    ) {
      return ctx.telegram.sendSticker(
        ctx.from.id,
        c.fileId
      );
    }

    if (
      c.type === "animation"
    ) {
      return ctx.telegram.sendAnimation(
        ctx.from.id,
        c.fileId,
        {
          caption:
            c.caption ||
            "• الهمسة"
        }
      );
    }

    return ctx.reply(
      "تم فتح الهمسة."
    );
  }

  if (
    mode === "reply"
  ) {
    if (
      String(ctx.from.id) !==
      String(whisper.targetId)
    ) {
      return ctx.reply(
        "لا يمكنك الرد على هذه الهمسة."
      );
    }

    whisper.waitingReply =
      String(ctx.from.id);

    saveDB();

    return ctx.reply(
      "أرسل الآن ردك على الهمسة في الخاص."
    );
  }
}

bot.hears(
  /^همسة$/i,
  async ctx => {
    const target =
      replyRequired(ctx);

    if (!target) return;

    if (
      String(target.id) ===
      String(ctx.from.id)
    ) {
      return botReply(
        ctx,
        "لا يمكنك إرسال همسة لنفسك."
      );
    }

    const replied =
      ctx.message.reply_to_message;

    if (replied.text) {
      return sendWhisper(
        ctx,
        target,
        {
          type: "text",
          text: replied.text
        }
      );
    }

    if (
      replied.photo
    ) {
      const photo =
        replied.photo[
          replied.photo.length - 1
        ];

      return sendWhisper(
        ctx,
        target,
        {
          type: "photo",
          fileId: photo.file_id,
          caption:
            replied.caption || ""
        }
      );
    }

    if (
      replied.sticker
    ) {
      return sendWhisper(
        ctx,
        target,
        {
          type: "sticker",
          fileId:
            replied.sticker.file_id
        }
      );
    }

    if (
      replied.animation
    ) {
      return sendWhisper(
        ctx,
        target,
        {
          type: "animation",
          fileId:
            replied.animation.file_id,
          caption:
            replied.caption || ""
        }
      );
    }

    return botReply(
      ctx,
      "نوع الرسالة غير مدعوم في الهمسة."
    );
  }
);

/* =========================================================
   استقبال رد الهمسة بالخاص
========================================================= */

bot.on(
  "message",
  async (ctx, next) => {
    if (
      ctx.chat?.type !== "private" ||
      !ctx.from ||
      !ctx.message ||
      ctx.message.text?.startsWith("/")
    ) {
      return next();
    }

    let whisper = null;
    let sourceChat = null;

    for (
      const chat
      of Object.values(db.chats)
    ) {
      const found =
        Object.values(
          chat.whispers || {}
        ).find(
          item =>
            String(
              item.targetId
            ) ===
              String(ctx.from.id) &&
            String(
              item.waitingReply
            ) ===
              String(ctx.from.id)
        );

      if (found) {
        whisper = found;
        sourceChat = chat;
        break;
      }
    }

    if (
      !whisper ||
      !sourceChat
    ) {
      return next();
    }

    try {
      const msg =
        ctx.message;

      const text =
        msg.text ||
        msg.caption ||
        "";

      if (text) {
        await ctx.telegram.sendMessage(
          whisper.senderId,
          `• رد على همستك:\n\n${text}`
        );
      } else if (
        msg.photo
      ) {
        const photo =
          msg.photo[
            msg.photo.length - 1
          ];

        await ctx.telegram.sendPhoto(
          whisper.senderId,
          photo.file_id,
          {
            caption:
              "• رد على همستك"
          }
        );
      } else if (
        msg.sticker
      ) {
        await ctx.telegram.sendSticker(
          whisper.senderId,
          msg.sticker.file_id
        );
      } else if (
        msg.animation
      ) {
        await ctx.telegram.sendAnimation(
          whisper.senderId,
          msg.animation.file_id,
          {
            caption:
              "• رد على همستك"
          }
        );
      } else {
        return next();
      }

      whisper.waitingReply =
        null;

      whisper.replied =
        true;

      saveDB();

      await ctx.reply(
        "تم إرسال ردك على الهمسة."
      );

      return;
    } catch (error) {
      console.error(
        "WHISPER REPLY ERROR:",
        error
      );

      await ctx.reply(
        "تعذر إرسال الرد."
      );

      return;
    }
  }
);

/* =========================================================
   الإذاعة
========================================================= */

function ensureSubscriber(
  userId
) {
  const id =
    String(userId);

  if (
    !db.globalSubscribers.includes(id)
  ) {
    db.globalSubscribers.push(id);
    saveDB();
  }
}

bot.command(
  "start",
  async ctx => {
    if (
      ctx.chat.type === "private"
    ) {
      ensureSubscriber(
        ctx.from.id
      );
    }
  }
);

bot.hears(
  /^اذاعة(?:\s+(.+))?$/i,
  async ctx => {
    if (!requireRank(ctx, "Dev🎖️")) return;

    const replied =
      ctx.message.reply_to_message;

    const text =
      replied?.text ||
      replied?.caption ||
      ctx.match[1]?.trim();

    if (!text) {
      return botReply(
        ctx,
        "استخدم الأمر بالرد على الرسالة المراد إذاعتها."
      );
    }

    let sent = 0;
    let failed = 0;

    for (
      const userId
      of db.globalSubscribers
    ) {
      try {
        await ctx.telegram.sendMessage(
          userId,
          `• إذاعة من إدارة البوت\n\n${text}`
        );

        sent++;
      } catch {
        failed++;
      }
    }

    await botReply(
      ctx,
      `تمت الإذاعة.\n\n` +
      `تم الإرسال: ${sent}\n` +
      `فشل الإرسال: ${failed}`
    );
  }
);

/* =========================================================
   @all
========================================================= */

async function mentionAllMembers(ctx) {
  const chat =
    ensureChat(
      ctx.chat.id
    );

  if (
    !chat.settings.allMention
  ) {
    return botReply(
      ctx,
      "المنشن مغلق."
    );
  }

  const members =
    Object.values(
      chat.users
    );

  if (!members.length) {
    return botReply(
      ctx,
      "لا يوجد أعضاء مسجلون."
    );
  }

  let current = "";
  const chunks = [];

  for (
    const user
    of members
  ) {
    const mention =
      mentionUser({
        id: user.id,
        first_name:
          user.firstName ||
          user.username ||
          "المستخدم"
      });

    if (
      current.length +
        mention.length +
        2 >
      3500
    ) {
      chunks.push(current);
      current = mention;
    } else {
      current +=
        (current
          ? "\n"
          : "") +
        mention;
    }
  }

  if (current) {
    chunks.push(current);
  }

  for (
    const chunk
    of chunks
  ) {
    await botReply(
      ctx,
      chunk,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }
}

bot.hears(
  "@all",
  async ctx => {
    await mentionAllMembers(ctx);
  }
);

bot.hears(
  "فتح المنشن",
  async ctx => {
    if (!requireRank(ctx, "Dev🎖️")) return;

    ensureChat(
      ctx.chat.id
    ).settings.allMention = true;

    saveDB();

    await botReply(
      ctx,
      "تم تفعيل المنشن."
    );
  }
);

bot.hears(
  "غلق المنشن",
  async ctx => {
    if (!requireRank(ctx, "Dev🎖️")) return;

    ensureChat(
      ctx.chat.id
    ).settings.allMention = false;

    saveDB();

    await botReply(
      ctx,
      "تم تعطيل المنشن."
    );
  }
);

/* =========================================================
   رفع مشرف + لوحة الصلاحيات
========================================================= */

const promotionSessions =
  new Map();

const ADMIN_PERMISSIONS = [
  [
    "can_change_info",
    "تعديل معلومات المجموعة"
  ],
  [
    "can_delete_messages",
    "حذف الرسائل"
  ],
  [
    "can_invite_users",
    "إضافة أعضاء"
  ],
  [
    "can_restrict_members",
    "حظر وتقييد المستخدمين"
  ],
  [
    "can_pin_messages",
    "تثبيت الرسائل"
  ],
  [
    "can_manage_topics",
    "إدارة الموضوعات"
  ],
  [
    "can_promote_members",
    "إضافة مشرفين"
  ],
  [
    "can_manage_video_chats",
    "إدارة المكالمات"
  ]
];

function promotionKeyboard(
  session
) {
  const rows = [];

  for (
    const [
      key,
      name
    ]
    of ADMIN_PERMISSIONS
  ) {
    rows.push([
      Markup.button.callback(
        `${name} ↤ ${session.permissions[key] ? "نعم" : "لا"}`,
        `PROMOTE_TOGGLE:${session.id}:${key}`
      )
    ]);
  }

  rows.push([
    Markup.button.callback(
      "حفظ الصلاحيات",
      `PROMOTE_SAVE:${session.id}`
    )
  ]);

  rows.push([
    Markup.button.callback(
      "إخفاء الأمر",
      `PROMOTE_HIDE:${session.id}`
    )
  ]);

  return Markup.inlineKeyboard(
    rows
  );
}

bot.hears(
  /^(رفع مشرف|ترقيه)$/i,
  async ctx => {
    if (
      !requireRank(
        ctx,
        "مالك أساسي"
      )
    ) return;

    const target =
      replyRequired(ctx);

    if (!target) return;

    if (
      await targetProtected(
        ctx,
        target.id
      )
    ) {
      return botReply(
        ctx,
        "لا يمكنك ترقية هذا العضو."
      );
    }

    const id =
      randomToken();

    const session = {
      id,
      chatId:
        ctx.chat.id,

      actorId:
        ctx.from.id,

      targetId:
        target.id,

      permissions: {}
    };

    for (
      const [key]
      of ADMIN_PERMISSIONS
    ) {
      session.permissions[key] =
        false;
    }

    promotionSessions.set(
      id,
      session
    );

    await botReply(
      ctx,
      `صلاحيات المستخدم\n\n` +
      `${mentionUser(target)}\n\n` +
      `حدد الصلاحيات المطلوبة:`,
      {
        parse_mode: "MarkdownV2",
        ...promotionKeyboard(
          session
        )
      }
    );
  }
);

bot.action(
  /^PROMOTE_TOGGLE:([^:]+):([a-z_]+)$/,
  async ctx => {
    try {
      const session =
        promotionSessions.get(
          ctx.match[1]
        );

      if (!session) {
        return ctx.answerCbQuery(
          "انتهت العملية."
        );
      }

      if (
        String(ctx.from.id) !==
        String(session.actorId)
      ) {
        return ctx.answerCbQuery(
          "هذه القائمة ليست لك."
        );
      }

      const key =
        ctx.match[2];

      if (
        session.permissions[key] ===
        undefined
      ) {
        return ctx.answerCbQuery();
      }

      session.permissions[key] =
        !session.permissions[key];

      await ctx.answerCbQuery();

      await ctx.editMessageReplyMarkup(
        promotionKeyboard(
          session
        ).reply_markup
      );
    } catch (error) {
      console.error(
        "PROMOTE TOGGLE ERROR:",
        error
      );

      await ctx.answerCbQuery(
        "حدث خطأ."
      ).catch(() => {});
    }
  }
);

bot.action(
  /^PROMOTE_SAVE:([^:]+)$/,
  async ctx => {
    const session =
      promotionSessions.get(
        ctx.match[1]
      );

    if (!session) {
      return ctx.answerCbQuery(
        "انتهت العملية."
      );
    }

    if (
      String(ctx.from.id) !==
      String(session.actorId)
    ) {
      return ctx.answerCbQuery(
        "هذه القائمة ليست لك."
      );
    }

    try {
      const botMember =
        await ctx.telegram.getChatMember(
          session.chatId,
          ctx.botInfo.id
        );

      if (
        botMember.status !==
          "administrator" ||
        !botMember.can_promote_members
      ) {
        return ctx.answerCbQuery(
          "البوت يحتاج صلاحية إضافة المشرفين."
        );
      }

      const p =
        session.permissions;

      await ctx.telegram.promoteChatMember(
        session.chatId,
        session.targetId,
        {
          can_change_info:
            !!p.can_change_info,

          can_delete_messages:
            !!p.can_delete_messages,

          can_invite_users:
            !!p.can_invite_users,

          can_restrict_members:
            !!p.can_restrict_members,

          can_pin_messages:
            !!p.can_pin_messages,

          can_manage_topics:
            !!p.can_manage_topics,

          can_promote_members:
            !!p.can_promote_members,

          can_manage_video_chats:
            !!p.can_manage_video_chats
        }
      );

      promotionSessions.delete(
        session.id
      );

      logAdmin(
        ensureChat(
          session.chatId
        ),
        session.actorId,
        "رفع مشرف",
        session.targetId
      );

      await ctx.answerCbQuery(
        "تم حفظ الصلاحيات."
      );

      await ctx.editMessageText(
        "تم رفع العضو كمشرف وحفظ الصلاحيات المحددة."
      );

    } catch (error) {
      console.error(
        "PROMOTION ERROR:",
        error
      );

      await ctx.answerCbQuery(
        "تعذر رفع المشرف."
      ).catch(() => {});

      try {
        await ctx.reply(
          `تعذر رفع المشرف.\n\nالسبب: ${
            error?.description ||
            error?.message ||
            "خطأ غير معروف"
          }`
        );
      } catch {}
    }
  }
);

bot.action(
  /^PROMOTE_HIDE:([^:]+)$/,
  async ctx => {
    const session =
      promotionSessions.get(
        ctx.match[1]
      );

    if (
      session &&
      String(ctx.from.id) ===
        String(session.actorId)
    ) {
      promotionSessions.delete(
        session.id
      );
    }

    await ctx.answerCbQuery();

    try {
      await ctx.deleteMessage();
    } catch {}
  }
);

/* =========================================================
   صلاحياتي
========================================================= */

function adminPermissionText(
  member
) {
  if (
    member.status ===
    "creator"
  ) {
    return (
      "• صلاحياتك بالإشراف :\n" +
      "━━━━━━━━━━━\n" +
      "• تغيير المعلومات ↤︎ نعم\n" +
      "• تثبيت الرسائل ↤︎ نعم\n" +
      "• ادارة المواضيع ↤︎ نعم\n" +
      "• اضافه مستخدمين ↤︎ نعم\n" +
      "• مسح الرسائل ↤︎ نعم\n" +
      "• حظر المستخدمين ↤︎ نعم\n" +
      "• اضافه المشرفين ↤︎ نعم"
    );
  }

  const yes =
    value =>
      value
        ? "نعم"
        : "لا";

  return (
    "• صلاحياتك بالإشراف :\n" +
    "━━━━━━━━━━━\n" +
    `• تغيير المعلومات ↤︎ ${yes(member.can_change_info)}\n` +
    `• تثبيت الرسائل ↤︎ ${yes(member.can_pin_messages)}\n` +
    `• ادارة المواضيع ↤︎ ${yes(member.can_manage_topics)}\n` +
    `• اضافه مستخدمين ↤︎ ${yes(member.can_invite_users)}\n` +
    `• مسح الرسائل ↤︎ ${yes(member.can_delete_messages)}\n` +
    `• حظر المستخدمين ↤︎ ${yes(member.can_restrict_members)}\n` +
    `• اضافه المشرفين ↤︎ ${yes(member.can_promote_members)}`
  );
}

bot.hears(
  "صلاحياتي",
  async ctx => {
    try {
      const member =
        await ctx.telegram.getChatMember(
          ctx.chat.id,
          ctx.from.id
        );

      if (
        member.status !==
          "administrator" &&
        member.status !==
          "creator"
      ) {
        return botReply(
          ctx,
          "صلاحياتك عضو بالقروب"
        );
      }

      await botReply(
        ctx,
        adminPermissionText(
          member
        )
      );
    } catch {
      await botReply(
        ctx,
        "تعذر جلب صلاحياتك الحالية."
      );
    }
  }
);

bot.hears(
  "صلاحياته",
  async ctx => {
    const target =
      replyRequired(ctx);

    if (!target) return;

    try {
      const member =
        await ctx.telegram.getChatMember(
          ctx.chat.id,
          target.id
        );

      if (
        member.status !==
          "administrator" &&
        member.status !==
          "creator"
      ) {
        return botReply(
          ctx,
          "صلاحياته عضو بالقروب"
        );
      }

      await botReply(
        ctx,
        adminPermissionText(
          member
        )
      );
    } catch {
      await botReply(
        ctx,
        "تعذر جلب صلاحيات العضو."
      );
    }
  }
);

/* =========================================================
   اضف رد + اضف امر
========================================================= */

bot.hears(
  /^اضف رد(?:\s+(.+?))?(?:\s+(.+))?$/i,
  async ctx => {
    if (!requireRank(ctx, "Myth")) return;

    const chat =
      ensureChat(
        ctx.chat.id
      );

    const trigger =
      String(
        ctx.match[1] || ""
      ).trim();

    let response =
      String(
        ctx.match[2] || ""
      ).trim();

    const replied =
      ctx.message.reply_to_message;

    if (!trigger) {
      return botReply(
        ctx,
        "الصيغة:\nاضف رد الكلمة الرد"
      );
    }

    if (
      !response &&
      replied
    ) {
      response =
        replied.text ||
        replied.caption ||
        "";
    }

    if (!response) {
      return botReply(
        ctx,
        "اكتب الرد أو استخدم الأمر بالرد على الرسالة."
      );
    }

    chat.customReplies[
      trigger.toLowerCase()
    ] = {
      text: response,
      addedBy:
        String(ctx.from.id),
      time: Date.now()
    };

    saveDB();

    await botReply(
      ctx,
      `تمت إضافة الرد:\n${trigger} ↤︎ ${response}`
    );
  }
);

bot.hears(
  /^حذف رد\s+(.+)$/i,
  async ctx => {
    if (!requireRank(ctx, "Myth")) return;

    const chat =
      ensureChat(
        ctx.chat.id
      );

    const trigger =
      ctx.match[1]
        .trim()
        .toLowerCase();

    if (
      !chat.customReplies[
        trigger
      ]
    ) {
      return botReply(
        ctx,
        "هذا الرد غير موجود."
      );
    }

    delete chat.customReplies[
      trigger
    ];

    saveDB();

    await botReply(
      ctx,
      "تم حذف الرد."
    );
  }
);

bot.hears(
  /^اضف امر(?:\s+(.+?))?(?:\s+(.+))?$/i,
  async ctx => {
    if (!requireRank(ctx, "Myth")) return;

    const chat =
      ensureChat(
        ctx.chat.id
      );

    const command =
      String(
        ctx.match[1] || ""
      )
        .trim()
        .replace(/^\//, "");

    let response =
      String(
        ctx.match[2] || ""
      ).trim();

    const replied =
      ctx.message.reply_to_message;

    if (!command) {
      return botReply(
        ctx,
        "الصيغة:\nاضف امر الامر الرد"
      );
    }

    if (
      !response &&
      replied
    ) {
      response =
        replied.text ||
        replied.caption ||
        "";
    }

    if (!response) {
      return botReply(
        ctx,
        "اكتب الرد أو استخدم الأمر بالرد على الرسالة."
      );
    }

    chat.customCommands[
      command.toLowerCase()
    ] = {
      text: response,
      addedBy:
        String(ctx.from.id),
      time: Date.now()
    };

    saveDB();

    await botReply(
      ctx,
      `تمت إضافة الأمر:\n${command} ↤︎ ${response}`
    );
  }
);

bot.hears(
  /^حذف امر\s+(.+)$/i,
  async ctx => {
    if (!requireRank(ctx, "Myth")) return;

    const chat =
      ensureChat(
        ctx.chat.id
      );

    const command =
      ctx.match[1]
        .trim()
        .replace(/^\//, "")
        .toLowerCase();

    if (
      !chat.customCommands[
        command
      ]
    ) {
      return botReply(
        ctx,
        "هذا الأمر غير موجود."
      );
    }

    delete chat.customCommands[
      command
    ];

    saveDB();

    await botReply(
      ctx,
      "تم حذف الأمر."
    );
  }
);

/* =========================================================
   تنفيذ الردود والأوامر المخصصة
========================================================= */

bot.on(
  "text",
  async (ctx, next) => {
    if (
      !ctx.chat ||
      ctx.chat.type === "private" ||
      !ctx.message?.text
    ) {
      return next();
    }

    const chat =
      ensureChat(
        ctx.chat.id
      );

    const text =
      ctx.message.text.trim();

    const lower =
      text.toLowerCase();

    if (
      lower.startsWith("/")
    ) {
      const command =
        lower
          .slice(1)
          .split(/\s+/)[0];

      const custom =
        chat.customCommands[
          command
        ];

      if (custom) {
        return botReply(
          ctx,
          custom.text
        );
      }
    }

    const customReply =
      chat.customReplies[
        lower
      ];

    if (customReply) {
      return botReply(
        ctx,
        customReply.text
      );
    }

    return next();
  }
);

/* =========================================================
   الألعاب
========================================================= */

bot.hears(
  "الالعاب",
  async ctx => {
    await botReply(
      ctx,
`قائمة الألعاب

1 - حجر ورق مقص
2 - نرد
3 - تخمين الرقم
4 - تحدي
5 - صح أو خطأ

الأوامر:

حجر
ورق
مقص
نرد
تخمين 1-10
تحدي
صح
خطأ`
    );
  }
);

bot.hears(
  "قائمة الالعاب",
  async ctx => {
    await botReply(
      ctx,
`الألعاب المتوفرة

• حجر ورق مقص
• نرد
• تخمين الرقم
• تحدي
• صح أو خطأ`
    );
  }
);

bot.hears(
  /^(حجر|ورق|مقص)$/i,
  async ctx => {
    const chat =
      ensureChat(
        ctx.chat.id
      );

    if (
      chat.settings.gamesClosed
    ) {
      return botReply(
        ctx,
        "الألعاب مقفلة."
      );
    }

    const choices = [
      "حجر",
      "ورق",
      "مقص"
    ];

    const botChoice =
      choices[
        Math.floor(
          Math.random() *
          choices.length
        )
      ];

    const player =
      ctx.match[1];

    let result;

    if (
      player === botChoice
    ) {
      result = "تعادل.";
    } else if (
      (
        player === "حجر" &&
        botChoice === "مقص"
      ) ||
      (
        player === "ورق" &&
        botChoice === "حجر"
      ) ||
      (
        player === "مقص" &&
        botChoice === "ورق"
      )
    ) {
      result = "فزت.";
    } else {
      result = "فزت عليك.";
    }

    await botReply(
      ctx,
      `اختيارك: ${player}\n` +
      `اختياري: ${botChoice}\n\n` +
      result
    );
  }
);

bot.hears(
  "نرد",
  async ctx => {
    const number =
      Math.floor(
        Math.random() * 6
      ) + 1;

    await botReply(
      ctx,
      `النرد: ${number}`
    );
  }
);

bot.hears(
  /^تخمين\s+([1-9]|10)$/i,
  async ctx => {
    const user =
      Number(ctx.match[1]);

    const answer =
      Math.floor(
        Math.random() * 10
      ) + 1;

    if (
      user === answer
    ) {
      addBalance(
        ctx.from.id,
        10
      );

      return botReply(
        ctx,
        `صح! ربحت 10 ريال.\nالرقم كان: ${answer}`
      );
    }

    await botReply(
      ctx,
      `خطأ.\nالرقم كان: ${answer}`
    );
  }
);

bot.hears(
  "تحدي",
  async ctx => {
    const target =
      getTargetFromReply(ctx);

    if (!target) {
      return botReply(
        ctx,
        "استخدم الأمر بالرد على عضو."
      );
    }

    if (
      String(target.id) ===
      String(ctx.from.id)
    ) {
      return botReply(
        ctx,
        "لا يمكنك تحدي نفسك."
      );
    }

    const winner =
      Math.random() < 0.5
        ? ctx.from
        : target;

    addBalance(
      winner.id,
      5
    );

    await botReply(
      ctx,
      `الفائز بالتحدي: ${mentionUser(winner)}\nربح 5 ريال.`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }
);

bot.hears(
  "صح أو خطأ",
  async ctx => {
    const questions = [
      {
        q: "الشمس نجم.",
        a: true
      },
      {
        q: "الماء يغلي عند 50 درجة مئوية في الظروف العادية.",
        a: false
      },
      {
        q: "الأرض تدور حول الشمس.",
        a: true
      }
    ];

    const item =
      questions[
        Math.floor(
          Math.random() *
          questions.length
        )
      ];

    ensureChat(
      ctx.chat.id
    ).games.active = {
      type: "truefalse",
      answer: item.a
    };

    await botReply(
      ctx,
      `${item.q}\n\nاكتب: صح أو خطأ`
    );
  }
);

bot.hears(
  /^(صح|خطأ)$/i,
  async ctx => {
    const chat =
      ensureChat(
        ctx.chat.id
      );

    if (
      chat.games.active?.type !==
      "truefalse"
    ) {
      return;
    }

    const answer =
      ctx.match[1] === "صح";

    if (
      answer ===
      chat.games.active.answer
    ) {
      addBalance(
        ctx.from.id,
        5
      );

      await botReply(
        ctx,
        "إجابة صحيحة! ربحت 5 ريال."
      );
    } else {
      await botReply(
        ctx,
        "إجابة خاطئة."
      );
    }

    chat.games.active = null;

    saveDB();
  }
);

bot.hears(
  "قفل الالعاب",
  async ctx => {
    if (!requireRank(ctx, "Dev🎖️")) return;

    const chat =
      ensureChat(
        ctx.chat.id
      );

    chat.settings.gamesClosed =
      true;

    chat.games.active =
      null;

    saveDB();

    await botReply(
      ctx,
      "تم قفل الألعاب."
    );
  }
);

bot.hears(
  "فتح الالعاب",
  async ctx => {
    if (!requireRank(ctx, "Dev🎖️")) return;

    ensureChat(
      ctx.chat.id
    ).settings.gamesClosed =
      false;

    saveDB();

    await botReply(
      ctx,
      "تم فتح الألعاب."
    );
  }
);

/* =========================================================
   الذكاء الاصطناعي
========================================================= */

async function askAI(prompt) {
  if (!OPENAI_API_KEY) {
    return "الذكاء الاصطناعي غير مفعل حاليًا. أضف OPENAI_API_KEY في متغيرات البيئة.";
  }

  try {
    const response =
      await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${OPENAI_API_KEY}`
          },

          body: JSON.stringify({
            model:
              process.env.OPENAI_MODEL ||
              "gpt-5-mini",

            input: [
              {
                role: "system",
                content:
                  "أنت مساعد عربي مختصر وودود داخل بوت تيليجرام."
              },
              {
                role: "user",
                content:
                  String(prompt)
              }
            ]
          })
        }
      );

    if (!response.ok) {
      console.error(
        "AI ERROR:",
        await response.text()
      );

      return "تعذر الاتصال بالذكاء الاصطناعي.";
    }

    const data =
      await response.json();

    return (
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text ||
      "لم أستطع استخراج الرد."
    );
  } catch (error) {
    console.error(
      "AI FETCH ERROR:",
      error
    );

    return "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.";
  }
}

bot.hears(
  /^ذكاء(?:\s+(.+))?$/i,
  async ctx => {
    const prompt =
      ctx.match[1]?.trim();

    if (!prompt) {
      return botReply(
        ctx,
        "اكتب سؤالك بعد كلمة ذكاء."
      );
    }

    const answer =
      await askAI(prompt);

    await botReply(
      ctx,
      answer
    );
  }
);

bot.hears(
  /^ai(?:\s+(.+))?$/i,
  async ctx => {
    const prompt =
      ctx.match[1]?.trim();

    if (!prompt) {
      return botReply(
        ctx,
        "اكتب سؤالك بعد ai."
      );
    }

    const answer =
      await askAI(prompt);

    await botReply(
      ctx,
      answer
    );
  }
);

/* =========================================================
   الألقاب
========================================================= */

bot.hears(
  "لقبي",
  async ctx => {
    const chat =
      ensureChat(
        ctx.chat.id
      );

    const user =
      chat.users[
        String(ctx.from.id)
      ];

    await botReply(
      ctx,
      `لقبك: ${
        user?.title ||
        "لا يوجد"
      }`
    );
  }
);

bot.hears(
  "لقبه",
  async ctx => {
    const target =
      replyRequired(ctx);

    if (!target) return;

    const chat =
      ensureChat(
        ctx.chat.id
      );

    const user =
      chat.users[
        String(target.id)
      ];

    await botReply(
      ctx,
      `لقبه: ${
        user?.title ||
        "لا يوجد"
      }`
    );
  }
);

bot.hears(
  /^ضع(?:\s+(.+))?$/i,
  async ctx => {
    if (!requireRank(ctx, "Dev🎖️")) return;

    const target =
      replyRequired(ctx);

    if (!target) return;

    const title =
      String(
        ctx.match[1] || ""
      ).trim();

    if (!title) {
      return botReply(
        ctx,
        "اكتب اللقب بعد الأمر."
      );
    }

    if (
      title.length > 16
    ) {
      return botReply(
        ctx,
        "اللقب يجب ألا يتجاوز 16 حرفًا."
      );
    }

    try {
      await ctx.telegram.setChatAdministratorCustomTitle(
        ctx.chat.id,
        target.id,
        title
      );

      ensureChatUser(
        ensureChat(
          ctx.chat.id
        ),
        target
      ).title = title;

      saveDB();

      await botReply(
        ctx,
        `تم تغيير اللقب إلى ${title}`
      );
    } catch {
      await botReply(
        ctx,
        "تعذر تغيير اللقب. تأكد أن العضو مشرف."
      );
    }
  }
);

/* =========================================================
   إعدادات المطور
========================================================= */

const DEV_SETTINGS = {
  "تفعيل الردود":
    ["repliesEnabled", true],

  "تعطيل الردود":
    ["repliesEnabled", false],

  "تفعيل البنك":
    ["bankEnabled", true],

  "تعطيل البنك":
    ["bankEnabled", false],

  "تفعيل التواصل":
    ["communicationEnabled", true],

  "تعطيل التواصل":
    ["communicationEnabled", false],

  "تفعيل الاشتراك الاجباري":
    ["forcedSubscription", true],

  "تعطيل الاشتراك الاجباري":
    ["forcedSubscription", false],

  "تفعيل بوت الخدمة":
    ["serviceBot", true],

  "تعطيل بوت الخدمة":
    ["serviceBot", false],

  "تفعيل الاحصائيات":
    ["statsEnabled", true],

  "تعطيل الاحصائيات":
    ["statsEnabled", false],

  "تفعيل الزاجل":
    ["zajelEnabled", true],

  "تعطيل الزاجل":
    ["zajelEnabled", false],

  "تفعيل التنسيقات":
    ["formatsEnabled", true],

  "تعطيل التنسيقات":
    ["formatsEnabled", false]
};

for (
  const [
    command,
    [key, value]
  ]
  of Object.entries(
    DEV_SETTINGS
  )
) {
  bot.hears(
    command,
    async ctx => {
      if (!requireRank(ctx, "Dev🎖️")) return;

      ensureChat(
        ctx.chat.id
      ).settings[key] =
        value;

      saveDB();

      await botReply(
        ctx,
        `تم ${
          value
            ? "تفعيل"
            : "تعطيل"
        } ${key}.`
      );
    }
  );
}

bot.hears(
  /^تعيين عدد الاعضاء\s+(\d+)$/i,
  async ctx => {
    if (!requireRank(ctx, "Dev🎖️")) return;

    const chat =
      ensureChat(
        ctx.chat.id
      );

    chat.settings.memberCount =
      Number(ctx.match[1]);

    saveDB();

    await botReply(
      ctx,
      `تم تعيين عدد الاعضاء إلى ${chat.settings.memberCount}.`
    );
  }
);

bot.hears(
  /^تغيير الاشتراك الاجباري\s+(.+)$/i,
  async ctx => {
    if (!requireRank(ctx, "Dev🎖️")) return;

    const channel =
      ctx.match[1].trim();

    ensureChat(
      ctx.chat.id
    ).settings
      .forcedSubscriptionChannel =
      channel;

    saveDB();

    await botReply(
      ctx,
      `تم تغيير قناة الاشتراك إلى ${channel}`
    );
  }
);

/* =========================================================
   أوامر المطور المختصرة
========================================================= */

bot.hears(
  "ا",
  async ctx => {
    if (!requireRank(ctx, "Dev🎖️")) return;

    await botReply(
      ctx,
      "اوامر البوت:",
      helpKeyboard()
    );
  }
);

bot.hears(
  "ت",
  async ctx => {
    const chat =
      ensureChat(
        ctx.chat.id
      );

    const stats =
      getInteraction(
        chat,
        ctx.from.id
      );

    await botReply(
      ctx,
      `تفاعلك: ${stats.points}\n` +
      `رسائلك: ${stats.messages}\n` +
      `ترتيبك: ${getInteractionPosition(
        chat,
        ctx.from.id
      )}`
    );
  }
);

bot.hears(
  "ق",
  async ctx => {
    if (!requireRank(ctx, "Dev🎖️")) return;

    const s =
      ensureChat(
        ctx.chat.id
      ).settings;

    await botReply(
      ctx,
      `الحماية: ${
        s.protection
          ? "مفعلة"
          : "معطلة"
      }\n` +
      `المخالفات: ${
        s.violationsOpen
          ? "مفتوحة"
          : "مقفلة"
      }\n` +
      `الألعاب: ${
        s.gamesClosed
          ? "مقفلة"
          : "مفتوحة"
      }`
    );
  }
);

bot.hears(
  "ح",
  async ctx => {
    if (!requireRank(ctx, "Dev🎖️")) return;

    await botReply(
      ctx,
      "البوت يعمل بنجاح."
    );
  }
);

bot.hears(
  "م",
  async ctx => {
    if (!requireRank(ctx, "Dev🎖️")) return;

    try {
      const info =
        await ctx.telegram.getChat(
          ctx.chat.id
        );

      await botReply(
        ctx,
        `اسم القروب: ${info.title || ""}\n` +
        `المعرف: ${info.id}\n` +
        `النوع: ${info.type}`
      );
    } catch {
      await botReply(
        ctx,
        "تعذر جلب معلومات القروب."
      );
    }
  }
);

bot.hears(
  "د",
  async ctx => {
    if (!requireRank(ctx, "Dev🎖️")) return;

    try {
      const link =
        await ctx.telegram.exportChatInviteLink(
          ctx.chat.id
        );

      await botReply(
        ctx,
        `رابط القروب:\n${link}`
      );
    } catch {
      await botReply(
        ctx,
        "تعذر إنشاء رابط القروب."
      );
    }
  }
);

/* =========================================================
   المساعدة
========================================================= */

const HELP_SECTIONS = {
  protection:
`الحماية

تفعيل الحماية
تعطيل الحماية
حالة الحماية
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
عام
فك الكتم العام
مم
خخ
تقييد
الغاء التقييد
حظر
فك الحظر
طرد
تحذير
الغاء التحذير

تنظيف 0-9`,

  ranks:
`الرتب

عضو
مميز
مالك
مالك أساسي
Myth
Myth 🎖️
Dev²🎖️
Dev🎖️

رفع مميز
رفع مالك
رفع اساس
رفع M
رفع My
رفع اكس
رفع ديف
رفع مطور ثانوي

تنزيل
استخدم الأوامر بالرد على العضو.`,

  admin:
`الإدارة

صلاحياتي
صلاحياته
رفع مشرف
ترقيه

كتم
فك كتم
عام
فك الكتم العام
تقييد
الغاء التقييد
حظر
فك الحظر
طرد

اضف رد
حذف رد
اضف امر
حذف امر`,

  games:
`الألعاب

الالعاب
قائمة الالعاب
حجر
ورق
مقص
نرد
تخمين 1-10
تحدي
صح أو خطأ`,

  dev:
`المطور

ا
ق
ح
م
د

اذاعة
ذكاء
ai

فتح المنشن
غلق المنشن
فتح الالعاب
قفل الالعاب
سجل الحماية
احصائيات البوت
حالة البوت`
};

function helpKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "الحماية",
        "HELP_protection"
      ),
      Markup.button.callback(
        "الرتب",
        "HELP_ranks"
      )
    ],
    [
      Markup.button.callback(
        "الإدارة",
        "HELP_admin"
      ),
      Markup.button.callback(
        "الألعاب",
        "HELP_games"
      )
    ],
    [
      Markup.button.callback(
        "Dev",
        "HELP_dev"
      )
    ]
  ]);
}

bot.hears(
  "اوامر",
  async ctx => {
    await botReply(
      ctx,
      "اختر القسم:",
      helpKeyboard()
    );
  }
);

for (
  const [
    key,
    text
  ]
  of Object.entries(
    HELP_SECTIONS
  )
) {
  bot.action(
    `HELP_${key}`,
    async ctx => {
      await ctx.answerCbQuery();

      await ctx.editMessageText(
        text,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "رجوع",
              "HELP_MAIN"
            )
          ]
        ])
      );
    }
  );
}

bot.action(
  "HELP_MAIN",
  async ctx => {
    await ctx.answerCbQuery();

    await ctx.editMessageText(
      "اختر القسم:",
      helpKeyboard()
    );
  }
);

/* =========================================================
   القفل والفتح
========================================================= */

const LOCKS = {
  "قفل المحادثة":
    "chat",

  "قفل الوسائط":
    "media",

  "قفل الروابط":
    "links",

  "قفل الصور":
    "photos",

  "قفل الفيديو":
    "videos",

  "قفل الملفات":
    "files",

  "قفل الملصقات":
    "stickers",

  "قفل GIF":
    "gifs",

  "قفل الصوتيات":
    "audio",

  "قفل الفوروارد":
    "forwards",

  "قفل المنشن":
    "mentions"
};

for (
  const [
    command,
    key
  ]
  of Object.entries(LOCKS)
) {
  bot.hears(
    command,
    async ctx => {
      if (
        !requireRank(
          ctx,
          "Dev²🎖️"
        )
      ) return;

      ensureChat(
        ctx.chat.id
      ).settings.locks[key] =
        true;

      saveDB();

      await botReply(
        ctx,
        `تم ${command}.`
      );
    }
  );

  const open =
    command.replace(
      "قفل",
      "فتح"
    );

  bot.hears(
    open,
    async ctx => {
      if (
        !requireRank(
          ctx,
          "Dev²🎖️"
        )
      ) return;

      ensureChat(
        ctx.chat.id
      ).settings.locks[key] =
        false;

      saveDB();

      await botReply(
        ctx,
        `تم ${open}.`
      );
    }
  );
}

/* =========================================================
   سجل الحماية
========================================================= */

bot.hears(
  "سجل الحماية",
  async ctx => {
    if (!requireRank(ctx, "Dev🎖️")) return;

    const logs =
      ensureChat(
        ctx.chat.id
      ).adminLog
        .slice(-20)
        .reverse();

    if (!logs.length) {
      return botReply(
        ctx,
        "لا يوجد سجل إداري."
      );
    }

    await botReply(
      ctx,
      logs
        .map(
          (log, i) =>
            `${i + 1}. ${log.action}\n` +
            `المنفذ: ${log.actorId}\n` +
            `المستهدف: ${
              log.targetId || "-"
            }`
        )
        .join("\n\n")
    );
  }
);

/* =========================================================
   الحساب البنكي
========================================================= */

bot.hears(
  "حسابي",
  async ctx => {
    const user =
      ensureGlobalUser(
        ctx.from
      );

    await botReply(
      ctx,
      `اسم البنك: ${
        user.bank.active
          ? user.bank.name
          : "غير مفعل"
      }\n` +
      `رقم الحساب: ${
        user.bank.accountNumber ||
        "لا يوجد"
      }\n` +
      `الرصيد: ${
        user.balance
      } ريال`
    );
  }
);

bot.hears(
  "حذف حسابي",
  async ctx => {
    const user =
      ensureGlobalUser(
        ctx.from
      );

    user.bank.active =
      false;

    user.bank.name = "";

    user.bank.accountNumber =
      "";

    saveDB();

    await botReply(
      ctx,
      "تم حذف الحساب البنكي."
    );
  }
);

bot.hears(
  "المتجر",
  async ctx => {
    await botReply(
      ctx,
      "المتجر\n\nلا توجد منتجات مضافة حاليًا."
    );
  }
);

/* =========================================================
   إحصائيات البوت
========================================================= */

bot.hears(
  "احصائيات البوت",
  async ctx => {
    if (!requireRank(ctx, "Dev🎖️")) return;

    await botReply(
      ctx,
`إحصائيات البوت

المستخدمون: ${
        Object.keys(db.users).length
      }
القروبات: ${
        Object.keys(db.chats).length
      }
السجلات: ${
        db.botLog.length
      }
المشتركون: ${
        db.globalSubscribers.length
      }`
    );
  }
);

bot.hears(
  "حالة البوت",
  async ctx => {
    if (!requireRank(ctx, "Dev🎖️")) return;

    await botReply(
      ctx,
      "البوت يعمل بنجاح."
    );
  }
);

/* =========================================================
   النسخة الاحتياطية
========================================================= */

bot.hears(
  "نسخة احتياطية",
  async ctx => {
    if (!requireRank(ctx, "Dev🎖️")) return;

    try {
      const backup =
        path.join(
          DATA_DIR,
          `backup-${Date.now()}.json`
        );

      fs.copyFileSync(
        DB_FILE,
        backup
      );

      await botReply(
        ctx,
        "تم إنشاء نسخة احتياطية من البيانات."
      );
    } catch {
      await botReply(
        ctx,
        "تعذر إنشاء النسخة الاحتياطية."
      );
    }
  }
);

/* =========================================================
   مسح بيانات القروب
========================================================= */

bot.hears(
  "مسح بيانات القروب",
  async ctx => {
    if (!requireRank(ctx, "Dev🎖️")) return;

    const chatId =
      String(ctx.chat.id);

    db.chats[chatId] = {
      id: chatId,

      settings:
        defaultChatSettings(),

      users: {},

      customCommands: {},
      customReplies: {},

      channels: {},
      marriages: {},

      games: {
        active: null,
        stats: {}
      },

      messageLog: [],
      adminLog: [],

      muted: {},
      globalMuted: {},
      restricted: {},
      banned: {},
      warnings: {},

      interactions: {},

      tags: {},

      whispers: {},

      music: {
        enabled: true,
        current: null,
        queue: [],
        playing: false
      }
    };

    saveDB();

    await botReply(
      ctx,
      "تم مسح بيانات القروب."
    );
  }
);

/* =========================================================
   دخول الأعضاء
========================================================= */

bot.on(
  "new_chat_members",
  async ctx => {
    const chat =
      ensureChat(
        ctx.chat.id
      );

    for (
      const member
      of ctx.message
        .new_chat_members || []
    ) {
      ensureChatUser(
        chat,
        member
      );

      if (
        member.is_bot &&
        chat.settings
          .botProtection
      ) {
        try {
          await ctx.telegram.banChatMember(
            ctx.chat.id,
            member.id
          );
        } catch {}
      }
    }

    if (
      chat.settings
        .entryProtection
    ) {
      try {
        await ctx.telegram.deleteMessage(
          ctx.chat.id,
          ctx.message.message_id
        );
      } catch {}
    }

    saveDB();
  }
);

/* =========================================================
   إصلاح بيانات المستخدمين القدامى
========================================================= */

for (
  const chat
  of Object.values(db.chats)
) {
  for (
    const user
    of Object.values(
      chat.users || {}
    )
  ) {
    if (
      isDev(
        user.id,
        user.username
      )
    ) {
      user.rank =
        "Dev🎖️";
    }
  }
}

saveDB();

/* =========================================================
   معالجة الأخطاء
========================================================= */

bot.catch(
  (error, ctx) => {
    console.error(
      "BOT ERROR:",
      error
    );

    /*
      لا نرسل "حدث خطأ" تلقائيًا لكل شيء،
      لأن بعض أخطاء Telegram تحدث بعد إرسال الرد
      أو داخل callback.
    */
  }
);

/* =========================================================
   التشغيل
========================================================= */

process.once(
  "SIGINT",
  () => bot.stop("SIGINT")
);

process.once(
  "SIGTERM",
  () => bot.stop("SIGTERM")
);

bot.launch()
  .then(() => {
    console.log(
      "================================="
    );

    console.log(
      "EILAF BOT STARTED SUCCESSFULLY"
    );

    console.log(
      "Developer: @j4xa7"
    );

    console.log(
      "================================="
    );
  })
  .catch(error => {
    console.error(
      "FAILED TO START BOT:",
      error
    );
  });
