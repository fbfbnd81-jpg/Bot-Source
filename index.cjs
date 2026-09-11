const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN غير موجود في متغيرات البيئة");
}

const bot = new Telegraf(BOT_TOKEN);

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "database.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* ======================================================
   الرتب
====================================================== */

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
  "مطور ثانوي": "Dev🎖️",
  "dev": "Dev🎖️",
  "dev🎖️": "Dev🎖️"
};

const RANK_DISPLAY = {
  "عضو": "عضو",
  "مميز": "مميز",
  "مالك": "مالك",
  "مالك أساسي": "مالك اساسي",
  "Myth": "Myth",
  "Myth 🎖️": "Myth 🎖️",
  "Dev²🎖️": "Dev²🎖️",
  "Dev🎖️": "Dev🎖️"
};

const OWNER_USERNAME = "j4xa7";
const OWNER_ID = "5370959021438146805";

const DEV_IDS = String(process.env.DEV_IDS || "")
  .split(",")
  .map(x => x.trim())
  .filter(Boolean);

/* ======================================================
   قاعدة البيانات
====================================================== */

const dbDefault = {
  users: {},
  chats: {},
  globalSubscribers: [],
  devIds: DEV_IDS,
  botLog: [],
  groups: [],
  channels: []
};

function loadDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(
        DB_FILE,
        JSON.stringify(dbDefault, null, 2),
        "utf8"
      );

      return structuredClone(dbDefault);
    }

    const raw = fs.readFileSync(DB_FILE, "utf8");

    if (!raw.trim()) {
      return structuredClone(dbDefault);
    }

    const data = JSON.parse(raw);

    return {
      ...structuredClone(dbDefault),
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
    return structuredClone(dbDefault);
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

/* ======================================================
   المستخدمين
====================================================== */

function ensureGlobalUser(user) {
  if (!user || !user.id) return null;

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
      user.username || db.users[id].username || "";

    db.users[id].firstName =
      user.first_name || db.users[id].firstName || "";

    db.users[id].lastName =
      user.last_name || db.users[id].lastName || "";
  }

  return db.users[id];
}

/* ======================================================
   إعدادات الحماية
====================================================== */

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
    preventMessageDeletion: false,

    warningsEnabled: true,
    warningLimit: 3,

    autoMute: true,
    autoBan: false,

    muteDuration: 3600,
    restrictDuration: 3600,

    entryProtection: false,
    botProtection: false,
    newAccountProtection: false,
    suspiciousAccountProtection: false,

    violationsOpen: true,

    allMention: true,

    gamesClosed: false,

    repliesEnabled: true,
    bankEnabled: true,
    communicationEnabled: true,

    forcedSubscription: false,
    forcedSubscriptionChannel: "",

    serviceBot: true,
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

/* ======================================================
   القروبات
====================================================== */

function ensureChat(chatId) {
  const id = String(chatId);

  if (!db.chats[id]) {
    db.chats[id] = {
      id,

      settings: defaultChatSettings(),

      users: {},
      customCommands: {},
      customReplies: {},
      channels: {},
      marriages: {},

      games: {
        active: null,
        stats: {}
      },

      ahkam: null,

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

  const chat = db.chats[id];

  chat.settings = {
    ...defaultChatSettings(),
    ...(chat.settings || {}),
    locks: {
      ...defaultChatSettings().locks,
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

  for (const [userId, interaction] of Object.entries(
    chat.interactions
  )) {
    if (interaction && !interaction.id) {
      interaction.id = String(userId);
    }
  }

  return chat;
}

function ensureChatUser(chat, user) {
  if (!user || !user.id) return null;

  const id = String(user.id);

  if (!chat.users[id]) {
    chat.users[id] = {
      id,
      username: user.username || "",
      firstName: user.first_name || "",
      rank: "عضو",

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
      user.username ||
      chat.users[id].username ||
      "";

    chat.users[id].firstName =
      user.first_name ||
      chat.users[id].firstName ||
      "";
  }

  return chat.users[id];
}

/* ======================================================
   الرتب
====================================================== */

function rankValue(rank) {
  return RANKS[rank] ?? 0;
}

function normalizeRank(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase();

  return RANK_ALIASES[key] || null;
}

function isDev(userId) {
  const id = String(userId);

  return (
    id === OWNER_ID ||
    DEV_IDS.includes(id) ||
    (db.devIds || []).map(String).includes(id)
  );
}

function getRank(chat, userId) {
  const id = String(userId);

  if (isDev(id)) {
    return "Dev🎖️";
  }

  return chat.users[id]?.rank || "عضو";
}

function canUseRank(chat, userId, requiredRank) {
  return (
    rankValue(getRank(chat, userId)) >=
    rankValue(requiredRank)
  );
}

function canTarget(chat, actorId, targetId) {
  const actor = String(actorId);
  const target = String(targetId);

  if (actor === target) {
    return false;
  }

  if (isDev(target)) {
    return isDev(actor);
  }

  return (
    rankValue(getRank(chat, actor)) >
    rankValue(getRank(chat, target))
  );
}

function rankPermissionMessage(rank) {
  return `• هذا الامر يخص ↤ ｢ ${rank} ｣`;
}

/* ======================================================
   المنشن
====================================================== */

function escapeMarkdown(text) {
  return String(text || "")
    .replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

function mentionUser(user) {
  if (!user) return "المستخدم";

  const name =
    user.first_name ||
    user.username ||
    "المستخدم";

  return `[${escapeMarkdown(name)}](tg://user?id=${user.id})`;
}

/* ======================================================
   الاستهداف
====================================================== */

function getTargetFromReply(ctx) {
  const reply = ctx.message?.reply_to_message;

  if (!reply?.from) {
    return null;
  }

  return reply.from;
}

async function getMember(chatId, userId) {
  try {
    return await bot.telegram.getChatMember(
      chatId,
      userId
    );
  } catch {
    return null;
  }
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
  const targetMember =
    await safeGetMember(ctx, targetId);

  if (
    targetMember?.status === "creator"
  ) {
    return true;
  }

  const chat = ensureChat(ctx.chat.id);

  return !canTarget(
    chat,
    ctx.from.id,
    targetId
  );
}

/* ======================================================
   السجل
====================================================== */

function logAdmin(
  chat,
  actorId,
  action,
  targetId = null
) {
  const item = {
    actorId: String(actorId),
    targetId: targetId
      ? String(targetId)
      : null,
    action,
    time: Date.now()
  };

  chat.adminLog.push(item);

  if (chat.adminLog.length > 500) {
    chat.adminLog.splice(
      0,
      chat.adminLog.length - 500
    );
  }

  db.botLog.push({
    chatId: chat.id,
    ...item
  });

  if (db.botLog.length > 2000) {
    db.botLog.splice(
      0,
      db.botLog.length - 2000
    );
  }

  saveDB();
}

/* ======================================================
   الصلاحيات
====================================================== */

function requireRank(ctx, requiredRank) {
  const chat = ensureChat(ctx.chat.id);

  const rank =
    getRank(
      chat,
      ctx.from.id
    );

  if (
    rankValue(rank) <
    rankValue(requiredRank)
  ) {
    ctx.reply(
      rankPermissionMessage(requiredRank)
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

function replyRequired(ctx) {
  const target =
    getTargetFromReply(ctx);

  if (!target) {
    ctx.reply(
      "يجب استخدام الأمر بالرد على العضو."
    );

    return null;
  }

  return target;
}

/* ======================================================
   البوت
====================================================== */

async function botIsAdmin(ctx) {
  try {
    const me =
      await ctx.telegram.getMe();

    const member =
      await ctx.telegram.getChatMember(
        ctx.chat.id,
        me.id
      );

    return (
      member.status === "administrator" ||
      member.status === "creator"
    );
  } catch {
    return false;
  }
}

async function safeDelete(ctx, messageId) {
  try {
    await ctx.telegram.deleteMessage(
      ctx.chat.id,
      messageId
    );

    return true;
  } catch {
    return false;
  }
}

function ensureSubscriber(userId) {
  const id = String(userId);

  if (
    !db.globalSubscribers.includes(id)
  ) {
    db.globalSubscribers.push(id);
    saveDB();
  }
}

/* ======================================================
   التفاعل
====================================================== */

function addInteraction(
  chat,
  userId,
  points = 1
) {
  const id = String(userId);

  if (!chat.interactions[id]) {
    chat.interactions[id] = {
      id,
      messages: 0,
      points: 0
    };
  }

  chat.interactions[id].messages += 1;
  chat.interactions[id].points += points;
}

function getInteraction(
  chat,
  userId
) {
  const id = String(userId);

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
    const pointsA =
      Number(a[1]?.points || 0);

    const pointsB =
      Number(b[1]?.points || 0);

    if (pointsB !== pointsA) {
      return pointsB - pointsA;
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

/* ======================================================
   البنك
====================================================== */

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

/* ======================================================
   Middleware
====================================================== */

bot.use(
  async (ctx, next) => {
    if (ctx.from) {
      ensureGlobalUser(ctx.from);
    }

    if (
      ctx.chat &&
      ctx.chat.type !== "private" &&
      ctx.from
    ) {
      const chat =
        ensureChat(ctx.chat.id);

      ensureChatUser(
        chat,
        ctx.from
      );

      addInteraction(
        chat,
        ctx.from.id,
        1
      );

      if (ctx.message) {
        chat.users[
          String(ctx.from.id)
        ].messages += 1;

        chat.messageLog.push({
          messageId:
            ctx.message.message_id,

          userId:
            String(ctx.from.id),

          time: Date.now(),

          text:
            ctx.message.text ||
            ctx.message.caption ||
            ""
        });

        if (
          chat.messageLog.length >
          2000
        ) {
          chat.messageLog.shift();
        }
      }

      saveDB();
    }

    return next();
  }
);

/* ======================================================
   START
====================================================== */

bot.start(
  async ctx => {
    ensureSubscriber(
      ctx.from.id
    );

    if (
      ctx.chat.type !== "private"
    ) {
      return;
    }

    await ctx.reply(
      `اهلا بك - ${mentionUser(ctx.from)}\n\n` +
      `انا ايف، البوت الخاص بالقروبات.\n\n` +
      `اضفني إلى مجموعتك وابدأ التحكم.`,
      Markup.inlineKeyboard([
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
    );
  }
);

/* ======================================================
   التفاعل والرتب الشخصية
====================================================== */

bot.hears(
  "رتبتي",
  async ctx => {
    const chat =
      ensureChat(ctx.chat.id);

    const rank =
      getRank(
        chat,
        ctx.from.id
      );

    await ctx.reply(
      `رتبتك: ${RANK_DISPLAY[rank] || rank}`
    );
  }
);

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

    const position =
      getInteractionPosition(
        chat,
        ctx.from.id
      );

    const rank =
      getRank(
        chat,
        ctx.from.id
      );

    await ctx.reply(
      `رتبتك: ${RANK_DISPLAY[rank] || rank}\n` +
      `عدد رسائلك: ${stats.messages}\n` +
      `ترتيبك: ${position}`
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
      return ctx.reply(
        "لا توجد بيانات تفاعل حتى الآن."
      );
    }

    await ctx.reply(
      list.map(
        ([id, item], index) => {
          const user =
            chat.users[id];

          return (
            `${index + 1} - ` +
            `${user?.firstName || "المستخدم"}\n` +
            `النقاط: ${item.points || 0}\n` +
            `الرسائل: ${item.messages || 0}`
          );
        }
      ).join("\n\n")
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

    const rank =
      getRank(
        chat,
        target.id
      );

    await ctx.reply(
      `رتبته: ${RANK_DISPLAY[rank] || rank}`
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

    const position =
      getInteractionPosition(
        chat,
        target.id
      );

    await ctx.reply(
      `رتبته: ${
        RANK_DISPLAY[
          getRank(chat, target.id)
        ]
      }\n` +
      `عدد رسائله: ${stats.messages}\n` +
      `ترتيبه: ${position}`
    );
  }
);

/* ======================================================
   الفلوس
====================================================== */

bot.hears(
  /^فلوسي$/i,
  async ctx => {
    await ctx.reply(
      `فلوسك: ${getBalance(ctx.from.id)} ريال`
    );
  }
);

bot.hears(
  /^فلوسه$/i,
  async ctx => {
    const target =
      replyRequired(ctx);

    if (!target) return;

    await ctx.reply(
      `فلوس ${
        target.username
          ? `@${target.username}`
          : target.first_name
      }: ${getBalance(target.id)} ريال`
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
      return ctx.reply(
        "المبلغ غير صحيح."
      );
    }

    if (
      String(target.id) ===
      String(ctx.from.id)
    ) {
      return ctx.reply(
        "لا يمكنك إهداء نفسك."
      );
    }

    const balance =
      getBalance(ctx.from.id);

    if (balance < amount) {
      return ctx.reply(
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

    saveDB();

    await ctx.reply(
      `تم إهداء ${amount} ريال إلى ${
        target.username
          ? `@${target.username}`
          : target.first_name
      }`
    );
  }
);

/* ======================================================
   حماية الرتب
====================================================== */

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

  const actorValue =
    rankValue(actorRank);

  const targetValue =
    rankValue(targetRank);

  const newValue =
    rankValue(newRank);

  if (
    String(ctx.from.id) ===
    String(target.id)
  ) {
    return "لا يمكنك تعديل رتبتك بنفسك.";
  }

  if (
    targetValue >= actorValue
  ) {
    return "لا يمكنك تعديل رتبة مساوية أو أعلى منك.";
  }

  if (
    newValue >= actorValue
  ) {
    return "لا يمكنك إعطاء رتبة مساوية أو أعلى من رتبتك.";
  }

  if (isDev(target.id) && !isDev(ctx.from.id)) {
    return "لا يمكنك تعديل رتبة المطور.";
  }

  return null;
}

async function setRank(
  ctx,
  newRank
) {
  if (
    !ctx.chat ||
    ctx.chat.type === "private"
  ) {
    return ctx.reply(
      "هذا الأمر داخل القروب فقط."
    );
  }

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
    return ctx.reply(error);
  }

  const chat =
    ensureChat(ctx.chat.id);

  const user =
    ensureChatUser(
      chat,
      target
    );

  user.rank = newRank;

  logAdmin(
    chat,
    ctx.from.id,
    `رفع رتبة إلى ${newRank}`,
    target.id
  );

  await ctx.reply(
    `تم رفع ${mentionUser(target)} إلى رتبة ${newRank}.`
  );
}

async function removeRank(
  ctx,
  expectedRank
) {
  if (
    !ctx.chat ||
    ctx.chat.type === "private"
  ) {
    return;
  }

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
    return ctx.reply(
      "لا يمكنك تعديل رتبتك بنفسك."
    );
  }

  if (
    rankValue(targetRank) >=
    rankValue(actorRank)
  ) {
    return ctx.reply(
      "لا يمكنك تنزيل رتبة مساوية أو أعلى منك."
    );
  }

  if (
    expectedRank &&
    targetRank !== expectedRank
  ) {
    return ctx.reply(
      `رتبة العضو الحالية ليست ${expectedRank}.`
    );
  }

  const user =
    ensureChatUser(
      chat,
      target
    );

  user.rank = "عضو";

  logAdmin(
    chat,
    ctx.from.id,
    `تنزيل الرتبة ${targetRank}`,
    target.id
  );

  await ctx.reply(
    `تم تنزيل رتبة ${mentionUser(target)}.`
  );
}

/* ======================================================
   أوامر رفع الرتب
====================================================== */

const rankCommands = [
  ["رفع مميز", "مميز", "مميز"],
  ["رفع مالك", "مالك", "مالك"],
  ["رفع اساس", "مالك أساسي", "مالك أساسي"],
  ["رفع M", "Myth", "Myth"],
  ["رفع My", "Myth 🎖️", "Myth 🎖️"],
  ["رفع اكس", "Myth 🎖️", "Myth 🎖️"],
  ["رفع ديف", "Dev²🎖️", "Dev²🎖️"],
  ["رفع مطور ثانوي", "Dev🎖️", "Dev🎖️"]
];

for (
  const [command, rank] of rankCommands
) {
  bot.hears(
    new RegExp(
      `^${command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      "i"
    ),
    async ctx => {
      const required =
        rankValue(rank) >= 6
          ? "Dev🎖️"
          : rankValue(rank) >= 5
            ? "Dev²🎖️"
            : rankValue(rank) >= 4
              ? "Myth 🎖️"
              : rankValue(rank) >= 3
                ? "Myth"
                : rankValue(rank) >= 2
                  ? "مالك أساسي"
                  : "مميز";

      if (
        !requireRank(
          ctx,
          required
        )
      ) {
        return;
      }

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
    const value =
      normalizeRank(
        ctx.match[1]
      );

    if (!value) return;

    const required =
      rankValue(value) >= 6
        ? "Dev🎖️"
        : rankValue(value) >= 5
          ? "Dev²🎖️"
          : rankValue(value) >= 4
            ? "Myth 🎖️"
            : "مالك أساسي";

    if (
      !requireRank(
        ctx,
        required
      )
    ) {
      return;
    }

    await removeRank(
      ctx,
      value
    );
  }
);

/* ======================================================
   الحماية - أوامر التشغيل
====================================================== */

bot.hears(
  "تفعيل الحماية",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.protection = true;

    logAdmin(
      chat,
      ctx.from.id,
      "تفعيل الحماية"
    );

    saveDB();

    await ctx.reply(
      "تم تفعيل الحماية."
    );
  }
);

bot.hears(
  "تعطيل الحماية",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.protection = false;

    logAdmin(
      chat,
      ctx.from.id,
      "تعطيل الحماية"
    );

    saveDB();

    await ctx.reply(
      "تم تعطيل الحماية."
    );
  }
);

bot.hears(
  "تفعيل الحماية التلقائية",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.automaticProtection = true;

    saveDB();

    await ctx.reply(
      "تم تفعيل الحماية التلقائية."
    );
  }
);

bot.hears(
  "تعطيل الحماية التلقائية",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.automaticProtection = false;

    saveDB();

    await ctx.reply(
      "تم تعطيل الحماية التلقائية."
    );
  }
);

bot.hears(
  "حالة الحماية",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    const chat =
      ensureChat(ctx.chat.id);

    const s =
      chat.settings;

    await ctx.reply(
`حالة الحماية

الحماية: ${s.protection ? "مفعلة" : "معطلة"}
الحماية التلقائية: ${s.automaticProtection ? "مفعلة" : "معطلة"}

منع الروابط: ${s.preventLinks ? "مفعل" : "معطل"}
منع التعديل: ${s.preventEdits ? "مفعل" : "معطل"}
منع التكرار: ${s.preventSpam ? "مفعل" : "معطل"}
منع الإعلانات: ${s.preventAds ? "مفعل" : "معطل"}
منع المنشن: ${s.preventMentions ? "مفعل" : "معطل"}
منع الفوروارد: ${s.preventForwards ? "مفعل" : "معطل"}
منع الأوامر: ${s.preventCommands ? "مفعل" : "معطل"}
منع الكلمات الممنوعة: ${s.preventBannedWords ? "مفعل" : "معطل"}
منع الرسائل الطويلة: ${s.preventLongMessages ? "مفعل" : "معطل"}
منع الإنجليزية: ${s.preventEnglish ? "مفعل" : "معطل"}
منع أرقام الهواتف: ${s.preventPhoneNumbers ? "مفعل" : "معطل"}
منع معرفات القنوات: ${s.preventChannelIds ? "مفعل" : "معطل"}

الإنذارات: ${s.warningsEnabled ? "مفعلة" : "معطلة"}
الكتم التلقائي: ${s.autoMute ? "مفعل" : "معطل"}
الحظر التلقائي: ${s.autoBan ? "مفعل" : "معطل"}

حماية البوتات: ${s.botProtection ? "مفعلة" : "معطلة"}
حماية الحسابات الجديدة: ${s.newAccountProtection ? "مفعلة" : "معطلة"}
حماية الدخول: ${s.entryProtection ? "مفعلة" : "معطلة"}`
    );
  }
);

/* ======================================================
   حماية الرسائل
====================================================== */

const protectionSwitches = {
  "الروابط": "preventLinks",
  "التعديل": "preventEdits",
  "التكرار": "preventSpam",
  "الإعلانات": "preventAds",
  "المنشن": "preventMentions",
  "الفوروارد": "preventForwards"
};

for (
  const [name, key]
  of Object.entries(protectionSwitches)
) {
  bot.hears(
    `تفعيل منع ${name}`,
    async ctx => {
      if (!requireAdminRank(ctx)) return;

      const chat =
        ensureChat(ctx.chat.id);

      chat.settings[key] = true;

      saveDB();

      await ctx.reply(
        `تم تفعيل منع ${name}.`
      );
    }
  );

  bot.hears(
    `تعطيل منع ${name}`,
    async ctx => {
      if (!requireAdminRank(ctx)) return;

      const chat =
        ensureChat(ctx.chat.id);

      chat.settings[key] = false;

      saveDB();

      await ctx.reply(
        `تم تعطيل منع ${name}.`
      );
    }
  );
}

/* ======================================================
   المخالفات
====================================================== */

bot.hears(
  "فتح المخالفات",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev🎖️"
      )
    ) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.violationsOpen = true;

    saveDB();

    await ctx.reply(
      "تم فتح المخالفات."
    );
  }
);

bot.hears(
  "قفل المخالفات",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev🎖️"
      )
    ) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.violationsOpen = false;

    saveDB();

    await ctx.reply(
      "تم قفل المخالفات."
    );
  }
);

bot.hears(
  "تفعيل الإنذارات",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.warningsEnabled = true;

    saveDB();

    await ctx.reply(
      "تم تفعيل الإنذارات."
    );
  }
);

bot.hears(
  "تعطيل الإنذارات",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.warningsEnabled = false;

    saveDB();

    await ctx.reply(
      "تم تعطيل الإنذارات."
    );
  }
);

bot.hears(
  /^عدد الإنذارات(?:\s+(\d+))?$/i,
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    const chat =
      ensureChat(ctx.chat.id);

    if (!ctx.match[1]) {
      return ctx.reply(
        `عدد الإنذارات الحالي: ${chat.settings.warningLimit}`
      );
    }

    const count =
      Number(ctx.match[1]);

    if (count < 1) {
      return ctx.reply(
        "عدد الإنذارات غير صحيح."
      );
    }

    chat.settings.warningLimit = count;

    saveDB();

    await ctx.reply(
      `تم تحديد عدد الإنذارات إلى ${count}.`
    );
  }
);

bot.hears(
  "مسح الإنذارات",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    const chat =
      ensureChat(ctx.chat.id);

    chat.warnings = {};

    for (
      const user of Object.values(
        chat.users
      )
    ) {
      user.warnings = 0;
      user.violations = [];
    }

    saveDB();

    await ctx.reply(
      "تم مسح الإنذارات."
    );
  }
);

bot.hears(
  "تفعيل الكتم التلقائي",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.autoMute = true;

    saveDB();

    await ctx.reply(
      "تم تفعيل الكتم التلقائي."
    );
  }
);

bot.hears(
  "تعطيل الكتم التلقائي",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.autoMute = false;

    saveDB();

    await ctx.reply(
      "تم تعطيل الكتم التلقائي."
    );
  }
);

bot.hears(
  "تفعيل الحظر التلقائي",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.autoBan = true;

    saveDB();

    await ctx.reply(
      "تم تفعيل الحظر التلقائي."
    );
  }
);

bot.hears(
  "تعطيل الحظر التلقائي",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.autoBan = false;

    saveDB();

    await ctx.reply(
      "تم تعطيل الحظر التلقائي."
    );
  }
);

/* ======================================================
   العقوبات
====================================================== */

async function restoreMember(ctx, targetId) {
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

bot.hears(
  "كتم",
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
      return ctx.reply(
        "لا يمكنك معاقبة هذا العضو."
      );
    }

    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        target.id,
        {
          can_send_messages: false
        }
      );

      const chat =
        ensureChat(ctx.chat.id);

      chat.muted[
        String(target.id)
      ] = {
        time: Date.now()
      };

      logAdmin(
        chat,
        ctx.from.id,
        "كتم",
        target.id
      );

      await ctx.reply(
        `تم كتم ${mentionUser(target)}`
      );
    } catch {
      await ctx.reply(
        "تعذر كتم العضو. تأكد من صلاحيات البوت."
      );
    }
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

      logAdmin(
        chat,
        ctx.from.id,
        "فك كتم",
        target.id
      );

      await ctx.reply(
        `تم فك كتم ${mentionUser(target)}`
      );
    } catch {
      await ctx.reply(
        "تعذر فك الكتم."
      );
    }
  }
);

bot.hears(
  "عام",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Myth 🎖️"
      )
    ) {
      return;
    }

    const target =
      replyRequired(ctx);

    if (!target) return;

    if (
      await targetProtected(
        ctx,
        target.id
      )
    ) {
      return ctx.reply(
        "لا يمكنك معاقبة هذا العضو."
      );
    }

    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        target.id,
        {
          can_send_messages: false
        }
      );

      const chat =
        ensureChat(ctx.chat.id);

      chat.globalMuted[
        String(target.id)
      ] = {
        time: Date.now()
      };

      logAdmin(
        chat,
        ctx.from.id,
        "كتم عام",
        target.id
      );

      await ctx.reply(
        `تم الكتم العام لـ ${mentionUser(target)}`
      );
    } catch {
      await ctx.reply(
        "تعذر تنفيذ الكتم العام."
      );
    }
  }
);

bot.hears(
  "فك الكتم العام",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Myth 🎖️"
      )
    ) {
      return;
    }

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

      delete chat.globalMuted[
        String(target.id)
      ];

      logAdmin(
        chat,
        ctx.from.id,
        "فك الكتم العام",
        target.id
      );

      await ctx.reply(
        `تم فك الكتم العام عن ${mentionUser(target)}`
      );
    } catch {
      await ctx.reply(
        "تعذر فك الكتم العام."
      );
    }
  }
);

bot.hears(
  "خخ",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Myth 🎖️"
      )
    ) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.globalMuted = {};

    saveDB();

    await ctx.reply(
      "تم مسح المكتومين عام."
    );
  }
);

bot.hears(
  /^(مم|مسح المكتومين)$/,
  async ctx => {
    if (!requireRank(ctx, "Myth")) return;

    const chat =
      ensureChat(ctx.chat.id);

    chat.muted = {};

    saveDB();

    await ctx.reply(
      "تم مسح المكتومين."
    );
  }
);

bot.hears(
  "مسح المكتومين عام",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Myth 🎖️"
      )
    ) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.globalMuted = {};

    saveDB();

    await ctx.reply(
      "تم مسح المكتومين عام."
    );
  }
);

bot.hears(
  "تقييد",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev²🎖️"
      )
    ) {
      return;
    }

    const target =
      replyRequired(ctx);

    if (!target) return;

    if (
      await targetProtected(
        ctx,
        target.id
      )
    ) {
      return ctx.reply(
        "لا يمكنك معاقبة هذا العضو."
      );
    }

    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        target.id,
        {
          can_send_messages: false
        }
      );

      const chat =
        ensureChat(ctx.chat.id);

      chat.restricted[
        String(target.id)
      ] = {
        time: Date.now()
      };

      logAdmin(
        chat,
        ctx.from.id,
        "تقييد",
        target.id
      );

      await ctx.reply(
        `تم تقييد ${mentionUser(target)}`
      );
    } catch {
      await ctx.reply(
        "تعذر تقييد العضو."
      );
    }
  }
);

bot.hears(
  "الغاء التقييد",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "مالك أساسي"
      )
    ) {
      return;
    }

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

      delete chat.restricted[
        String(target.id)
      ];

      logAdmin(
        chat,
        ctx.from.id,
        "الغاء التقييد",
        target.id
      );

      await ctx.reply(
        `تم الغاء التقييد عن ${mentionUser(target)}`
      );
    } catch {
      await ctx.reply(
        "تعذر الغاء التقييد."
      );
    }
  }
);

bot.hears(
  "حظر",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Myth 🎖️"
      )
    ) {
      return;
    }

    const target =
      replyRequired(ctx);

    if (!target) return;

    if (
      await targetProtected(
        ctx,
        target.id
      )
    ) {
      return ctx.reply(
        "لا يمكنك معاقبة هذا العضو."
      );
    }

    try {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        target.id
      );

      const chat =
        ensureChat(ctx.chat.id);

      chat.banned[
        String(target.id)
      ] = true;

      logAdmin(
        chat,
        ctx.from.id,
        "حظر",
        target.id
      );

      await ctx.reply(
        `تم حظر ${mentionUser(target)}`
      );
    } catch {
      await ctx.reply(
        "تعذر حظر العضو."
      );
    }
  }
);

bot.hears(
  "فك الحظر",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Myth 🎖️"
      )
    ) {
      return;
    }

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

      const chat =
        ensureChat(ctx.chat.id);

      delete chat.banned[
        String(target.id)
      ];

      logAdmin(
        chat,
        ctx.from.id,
        "فك الحظر",
        target.id
      );

      await ctx.reply(
        `تم فك الحظر عن ${mentionUser(target)}`
      );
    } catch {
      await ctx.reply(
        "تعذر فك الحظر."
      );
    }
  }
);

bot.hears(
  "طرد",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Myth 🎖️"
      )
    ) {
      return;
    }

    const target =
      replyRequired(ctx);

    if (!target) return;

    if (
      await targetProtected(
        ctx,
        target.id
      )
    ) {
      return ctx.reply(
        "لا يمكنك معاقبة هذا العضو."
      );
    }

    try {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        target.id
      );

      await ctx.telegram.unbanChatMember(
        ctx.chat.id,
        target.id
      );

      const chat =
        ensureChat(ctx.chat.id);

      logAdmin(
        chat,
        ctx.from.id,
        "طرد",
        target.id
      );

      await ctx.reply(
        `تم طرد ${mentionUser(target)}`
      );
    } catch {
      await ctx.reply(
        "تعذر طرد العضو."
      );
    }
  }
);

/* ======================================================
   التحذيرات
====================================================== */

async function addWarning(
  ctx,
  target,
  reason = "مخالفة"
) {
  const chat =
    ensureChat(ctx.chat.id);

  const id =
    String(target.id);

  chat.warnings[id] =
    Number(chat.warnings[id] || 0) + 1;

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

  logAdmin(
    chat,
    ctx.from.id,
    `تحذير: ${reason}`,
    target.id
  );

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

      chat.muted[id] = {
        time: Date.now()
      };
    } catch {}
  }

  if (
    chat.settings.autoBan &&
    count >=
      chat.settings.warningLimit + 1
  ) {
    try {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        target.id
      );

      chat.banned[id] = true;
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
      return ctx.reply(
        "لا يمكنك معاقبة هذا العضو."
      );
    }

    const count =
      await addWarning(
        ctx,
        target
      );

    await ctx.reply(
      `تم تحذير ${mentionUser(target)}\n` +
      `عدد الإنذارات: ${count}`
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
      ensureChat(ctx.chat.id);

    const id =
      String(target.id);

    delete chat.warnings[id];

    if (chat.users[id]) {
      chat.users[id].warnings = 0;
      chat.users[id].violations = [];
    }

    saveDB();

    await ctx.reply(
      `تم الغاء تحذيرات ${mentionUser(target)}`
    );
  }
);

bot.hears(
  "مسح المخالفات",
  async ctx => {
    if (!requireRank(ctx, "Myth")) return;

    const chat =
      ensureChat(ctx.chat.id);

    chat.warnings = {};

    for (
      const user of Object.values(
        chat.users
      )
    ) {
      user.warnings = 0;
      user.violations = [];
    }

    saveDB();

    await ctx.reply(
      "تم مسح سجل المخالفات."
    );
  }
);

/* ======================================================
   حماية الحسابات والدخول
====================================================== */

const accountProtection = {
  "تفعيل حماية الدخول": [
    "entryProtection",
    true
  ],

  "تعطيل حماية الدخول": [
    "entryProtection",
    false
  ],

  "تفعيل حماية البوتات": [
    "botProtection",
    true
  ],

  "تعطيل حماية البوتات": [
    "botProtection",
    false
  ],

  "تفعيل حماية الحسابات الجديدة": [
    "newAccountProtection",
    true
  ],

  "تعطيل حماية الحسابات الجديدة": [
    "newAccountProtection",
    false
  ]
};

for (
  const [command, [key, value]]
  of Object.entries(accountProtection)
) {
  bot.hears(
    command,
    async ctx => {
      if (!requireAdminRank(ctx)) return;

      const chat =
        ensureChat(ctx.chat.id);

      chat.settings[key] = value;

      saveDB();

      await ctx.reply(
        value
          ? `تم تفعيل ${command.replace("تفعيل ", "")}.`
          : `تم تعطيل ${command.replace("تعطيل ", "")}.`
      );
    }
  );
}

/* ======================================================
   الحماية الفعلية
====================================================== */

function isProtectedRank(
  chat,
  userId
) {
  return (
    rankValue(
      getRank(chat, userId)
    ) >= 1
  );
}

function hasLink(text) {
  return /(https?:\/\/|www\.|t\.me\/|telegram\.me\/)/i.test(
    text
  );
}

function hasMention(text) {
  return /@[A-Za-z0-9_]{3,}/.test(
    text
  );
}

function hasPhoneNumber(text) {
  return /(?:\+?\d[\d\s\-()]{7,}\d)/.test(
    text
  );
}

function hasChannelId(text) {
  return /(?:t\.me\/|telegram\.me\/|@)[A-Za-z0-9_]{5,}/i.test(
    text
  );
}

function hasEnglish(text) {
  const letters =
    String(text).match(
      /[A-Za-z]/g
    );

  return (
    letters &&
    letters.length >= 3
  );
}

function hasAdvertisement(text) {
  const value =
    String(text).toLowerCase();

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
    "رابط",
    "سحب",
    "مسابقة"
  ];

  return words.some(
    word =>
      value.includes(
        word
      )
  ) && (
    hasLink(text) ||
    /ريال|دولار|خصم|عرض/i.test(text)
  );
}

function isLongMessage(text) {
  return (
    String(text).length >
    1000
  );
}

function isDuplicate(
  chat,
  userId,
  text
) {
  const id =
    String(userId);

  chat._lastMessages ||=
    {};

  const now =
    Date.now();

  const normalized =
    String(text)
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
    now - previous.time <=
      8000
  );
}

async function protectionDelete(
  ctx,
  reason
) {
  try {
    await safeDelete(
      ctx,
      ctx.message?.message_id
    );
  } catch {}

  const user =
    ctx.from;

  const messages = {
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
      "ممنوع إرسال الكلمات الممنوعة"
  };

  try {
    await ctx.reply(
      `${mentionUser(user)}، ${
        messages[reason] ||
        reason
      }`
    );
  } catch {}
}

bot.on(
  "message",
  async ctx => {
    try {
      if (
        !ctx.chat ||
        ctx.chat.type === "private" ||
        !ctx.from ||
        !ctx.message
      ) {
        return;
      }

      const chat =
        ensureChat(ctx.chat.id);

      const s =
        chat.settings;

      if (
        !s.protection ||
        !s.automaticProtection ||
        !s.violationsOpen
      ) {
        return;
      }

      /*
        الرتب من مميز فما فوق تتجاوز
        حماية الرسائل.
      */
      if (
        isProtectedRank(
          chat,
          ctx.from.id
        )
      ) {
        return;
      }

      const msg =
        ctx.message;

      const text =
        msg.text ||
        msg.caption ||
        "";

      /* قفل المحادثة */
      if (
        s.locks.chat &&
        text
      ) {
        await protectionDelete(
          ctx,
          "ممنوع إرسال الرسائل"
        );
        return;
      }

      /* منع الأوامر */
      if (
        s.preventCommands &&
        text.startsWith("/")
      ) {
        await protectionDelete(
          ctx,
          "الأوامر"
        );
        return;
      }

      /* الروابط */
      if (
        s.preventLinks &&
        hasLink(text)
      ) {
        await protectionDelete(
          ctx,
          "الروابط"
        );
        return;
      }

      /* الإعلانات */
      if (
        s.preventAds &&
        hasAdvertisement(text)
      ) {
        await protectionDelete(
          ctx,
          "الإعلانات"
        );
        return;
      }

      /* المنشن */
      if (
        s.preventMentions &&
        hasMention(text)
      ) {
        await protectionDelete(
          ctx,
          "المنشن"
        );
        return;
      }

      /* الفوروارد */
      if (
        s.preventForwards &&
        (
          msg.forward_origin ||
          msg.forward_from ||
          msg.forward_from_chat
        )
      ) {
        await protectionDelete(
          ctx,
          "الفوروارد"
        );
        return;
      }

      /* التكرار */
      if (
        s.preventSpam &&
        text &&
        isDuplicate(
          chat,
          ctx.from.id,
          text
        )
      ) {
        await protectionDelete(
          ctx,
          "التكرار"
        );
        return;
      }

      /* الإنجليزية */
      if (
        s.preventEnglish &&
        text &&
        hasEnglish(text)
      ) {
        await protectionDelete(
          ctx,
          "الإنجليزية"
        );
        return;
      }

      /* الرسائل الطويلة */
      if (
        s.preventLongMessages &&
        text &&
        isLongMessage(text)
      ) {
        await protectionDelete(
          ctx,
          "الرسائل الطويلة"
        );
        return;
      }

      /* أرقام الهواتف */
      if (
        s.preventPhoneNumbers &&
        text &&
        hasPhoneNumber(text)
      ) {
        await protectionDelete(
          ctx,
          "أرقام الهواتف"
        );
        return;
      }

      /* معرفات القنوات */
      if (
        s.preventChannelIds &&
        text &&
        hasChannelId(text)
      ) {
        await protectionDelete(
          ctx,
          "معرفات القنوات"
        );
        return;
      }

      /* الكلمات الممنوعة */
      if (
        s.preventBannedWords &&
        Array.isArray(
          s.bannedWords
        ) &&
        s.bannedWords.some(
          word =>
            text
              .toLowerCase()
              .includes(
                String(word).toLowerCase()
              )
        )
      ) {
        await protectionDelete(
          ctx,
          "الكلمات الممنوعة"
        );
        return;
      }

      /* الصور */
      if (
        (
          s.locks.media ||
          s.locks.photos
        ) &&
        msg.photo
      ) {
        await protectionDelete(
          ctx,
          "الصور"
        );
        return;
      }

      /* الفيديو */
      if (
        (
          s.locks.media ||
          s.locks.videos
        ) &&
        msg.video
      ) {
        await protectionDelete(
          ctx,
          "الفيديوهات"
        );
        return;
      }

      /* الملفات */
      if (
        (
          s.locks.media ||
          s.locks.files
        ) &&
        msg.document
      ) {
        await protectionDelete(
          ctx,
          "الملفات"
        );
        return;
      }

      /* الملصقات */
      if (
        (
          s.locks.media ||
          s.locks.stickers
        ) &&
        msg.sticker
      ) {
        await protectionDelete(
          ctx,
          "الملصقات"
        );
        return;
      }

      /* GIF */
      if (
        (
          s.locks.media ||
          s.locks.gifs
        ) &&
        msg.animation
      ) {
        await protectionDelete(
          ctx,
          "GIF"
        );
        return;
      }

      /* الصوت */
      if (
        (
          s.locks.media ||
          s.locks.audio
        ) &&
        (
          msg.audio ||
          msg.voice
        )
      ) {
        await protectionDelete(
          ctx,
          "الصوتيات"
        );
        return;
      }

      /* قفل الروابط */
      if (
        s.locks.links &&
        hasLink(text)
      ) {
        await protectionDelete(
          ctx,
          "الروابط"
        );
      }

    } catch (error) {
      console.error(
        "Protection error:",
        error
      );
    }
  }
);

/* ======================================================
   حماية تعديل الرسائل
====================================================== */

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
        ensureChat(ctx.chat.id);

      const s =
        chat.settings;

      if (
        !s.protection ||
        !s.automaticProtection ||
        !s.violationsOpen ||
        !s.preventEdits
      ) {
        return;
      }

      if (
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

      try {
        await ctx.reply(
          `${mentionUser(ctx.from)}، ممنوع ارسال تعديل الرسائل`
        );
      } catch {}

    } catch (error) {
      console.error(
        "Edit protection error:",
        error
      );
    }
  }
);

/* ======================================================
   دخول الأعضاء والبوتات
====================================================== */

bot.on(
  "new_chat_members",
  async ctx => {
    try {
      const chat =
        ensureChat(ctx.chat.id);

      const s =
        chat.settings;

      for (
        const member of
        ctx.message.new_chat_members || []
      ) {
        if (
          member.is_bot &&
          s.botProtection
        ) {
          try {
            await ctx.telegram.banChatMember(
              ctx.chat.id,
              member.id
            );

            await ctx.reply(
              `تم منع دخول البوت ${mentionUser(member)}.`
            );
          } catch {}
        }
      }

      if (
        s.entryProtection
      ) {
        try {
          await safeDelete(
            ctx,
            ctx.message.message_id
          );
        } catch {}
      }

    } catch (error) {
      console.error(
        "Entry protection error:",
        error
      );
    }
  }
);

/* ======================================================
   التنظيف
====================================================== */

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
      return Boolean(
        text
      );

    case 1:
      return Boolean(
        item.photo
      );

    case 2:
      return Boolean(
        item.video
      );

    case 3:
      return Boolean(
        item.document
      );

    case 4:
      return Boolean(
        item.sticker
      );

    case 5:
      return Boolean(
        item.animation
      );

    case 6:
      return Boolean(
        item.audio
      );

    case 7:
      return Boolean(
        item.voice
      );

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
    if (
      !requireRank(
        ctx,
        "Myth"
      )
    ) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    const value =
      ctx.match[1];

    let count = 50;

    if (
      value &&
      !CLEAN_TYPES[
        Number(value)
      ]
    ) {
      count =
        Math.min(
          100,
          Math.max(
            1,
            Number(value)
          )
        );
    }

    const type =
      value &&
      CLEAN_TYPES[
        Number(value)
      ]
        ? Number(value)
        : 9;

    const messages =
      chat.messageLog
        .slice(-count)
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

      const ok =
        await safeDelete(
          ctx,
          item.messageId
        );

      if (ok) {
        deleted++;
      }
    }

    logAdmin(
      chat,
      ctx.from.id,
      `تنظيف ${value || ""}`
    );

    await ctx.reply(
      `تم تنظيف ${deleted} رسالة.`
    );
  }
);

/* ======================================================
   @all
====================================================== */

async function mentionAllMembers(ctx) {
  const chat =
    ensureChat(ctx.chat.id);

  if (
    !chat.settings.allMention
  ) {
    return;
  }

  if (
    !ctx.chat ||
    ctx.chat.type === "private"
  ) {
    return;
  }

  const members =
    Object.values(
      chat.users
    );

  if (!members.length) {
    return ctx.reply(
      "لا يوجد أعضاء مسجلون."
    );
  }

  const chunks = [];

  let current = "";

  for (
    const user of members
  ) {
    const mention =
      mentionUser(user);

    if (
      current.length +
      mention.length +
      2 >
      3500
    ) {
      if (current) {
        chunks.push(current);
      }

      current = mention;
    } else {
      current +=
        (current ? "\n" : "") +
        mention;
    }
  }

  if (current) {
    chunks.push(current);
  }

  for (
    const chunk of chunks
  ) {
    await ctx.reply(
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
    const chat =
      ensureChat(ctx.chat.id);

    if (
      !chat.settings.allMention
    ) {
      return;
    }

    await mentionAllMembers(ctx);
  }
);

bot.hears(
  "فتح المنشن",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev🎖️"
      )
    ) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.allMention = true;

    saveDB();

    await ctx.reply(
      "تم تفعيل المنشن."
    );
  }
);

bot.hears(
  "غلق المنشن",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev🎖️"
      )
    ) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.allMention = false;

    saveDB();

    await ctx.reply(
      "تم تعطيل المنشن."
    );
  }
);

/* ======================================================
   رفع مشرف + صلاحيات Telegram
====================================================== */

const promotionSessions = new Map();

const ADMIN_PERMISSIONS = [
  ["can_change_info", "تعديل معلومات المجموعة"],
  ["can_delete_messages", "حذف الرسائل"],
  ["can_invite_users", "إضافة أعضاء"],
  ["can_restrict_members", "حظر وتقييد المستخدمين"],
  ["can_pin_messages", "تثبيت الرسائل"],
  ["can_manage_topics", "إدارة الموضوعات"],
  ["can_promote_members", "إضافة مشرفين"],
  ["can_manage_video_chats", "إدارة المكالمات"],
  ["can_post_stories", "إدارة القصص"],
  ["can_edit_stories", "تعديل القصص"],
  ["can_delete_stories", "حذف القصص"]
];

function promotionKeyboard(
  session
) {
  const rows = [];

  for (
    const [key, name] of
    ADMIN_PERMISSIONS
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
    if (!requireRank(ctx, "مالك أساسي")) {
      return;
    }

    const target =
      replyRequired(ctx);

    if (!target) return;

    const chat =
      ensureChat(ctx.chat.id);

    if (
      await targetProtected(
        ctx,
        target.id
      )
    ) {
      return ctx.reply(
        "لا يمكنك ترقية هذا العضو."
      );
    }

    const sessionId =
      `${ctx.chat.id}:${ctx.from.id}:${target.id}`;

    const session = {
      id: sessionId,
      chatId: ctx.chat.id,
      actorId: ctx.from.id,
      targetId: target.id,

      permissions: {}
    };

    for (
      const [key] of
      ADMIN_PERMISSIONS
    ) {
      session.permissions[key] = false;
    }

    promotionSessions.set(
      sessionId,
      session
    );

    await ctx.reply(
      `صلاحيات المستخدم\n\n` +
      `${mentionUser(target)}\n\n` +
      `حدد الصلاحيات المطلوبة:`,
      promotionKeyboard(
        session
      )
    );
  }
);

bot.action(
  /^PROMOTE_TOGGLE:(.+):(.+)$/,
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
        !Object.prototype.hasOwnProperty.call(
          session.permissions,
          key
        )
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
    } catch {
      await ctx.answerCbQuery();
    }
  }
);

bot.action(
  /^PROMOTE_SAVE:(.+)$/,
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

      const permissions =
        session.permissions;

      await ctx.telegram.promoteChatMember(
        session.chatId,
        session.targetId,
        {
          can_change_info:
            !!permissions.can_change_info,

          can_delete_messages:
            !!permissions.can_delete_messages,

          can_invite_users:
            !!permissions.can_invite_users,

          can_restrict_members:
            !!permissions.can_restrict_members,

          can_pin_messages:
            !!permissions.can_pin_messages,

          can_manage_topics:
            !!permissions.can_manage_topics,

          can_promote_members:
            !!permissions.can_promote_members,

          can_manage_video_chats:
            !!permissions.can_manage_video_chats,

          can_post_stories:
            !!permissions.can_post_stories,

          can_edit_stories:
            !!permissions.can_edit_stories,

          can_delete_stories:
            !!permissions.can_delete_stories
        }
      );

      const chat =
        ensureChat(
          session.chatId
        );

      logAdmin(
        chat,
        session.actorId,
        "رفع مشرف بصلاحيات Telegram",
        session.targetId
      );

      promotionSessions.delete(
        session.id
      );

      await ctx.answerCbQuery(
        "تم حفظ الصلاحيات."
      );

      await ctx.editMessageText(
        "تم رفع العضو كمشرف وحفظ الصلاحيات المحددة."
      );
    } catch (error) {
      console.error(
        "Promote error:",
        error
      );

      await ctx.answerCbQuery(
        "تعذر رفع المشرف. تأكد أن البوت يملك صلاحية إضافة المشرفين."
      );
    }
  }
);

bot.action(
  /^PROMOTE_HIDE:(.+)$/,
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

/* ======================================================
   صلاحياتي
====================================================== */

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
    if (
      !ctx.chat ||
      ctx.chat.type === "private"
    ) {
      return;
    }

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
        return ctx.reply(
          "صلاحياتك عضو بالقروب"
        );
      }

      await ctx.reply(
        adminPermissionText(
          member
        )
      );
    } catch {
      await ctx.reply(
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
        return ctx.reply(
          "صلاحياته عضو بالقروب"
        );
      }

      await ctx.reply(
        adminPermissionText(
          member
        )
      );
    } catch {
      await ctx.reply(
        "تعذر جلب صلاحيات العضو."
      );
    }
  }
);

/* ======================================================
   Dev - إعدادات البوت
====================================================== */

const DEV_SETTINGS = {
  "تفعيل الردود": [
    "repliesEnabled",
    true
  ],
  "تعطيل الردود": [
    "repliesEnabled",
    false
  ],

  "تفعيل البنك": [
    "bankEnabled",
    true
  ],
  "تعطيل البنك": [
    "bankEnabled",
    false
  ],

  "تفعيل التواصل": [
    "communicationEnabled",
    true
  ],
  "تعطيل التواصل": [
    "communicationEnabled",
    false
  ],

  "تفعيل الاشتراك الاجباري": [
    "forcedSubscription",
    true
  ],
  "تعطيل الاشتراك الاجباري": [
    "forcedSubscription",
    false
  ],

  "تفعيل بوت الخدمة": [
    "serviceBot",
    true
  ],
  "تعطيل بوت الخدمة": [
    "serviceBot",
    false
  ],

  "تفعيل الاحصائيات": [
    "statsEnabled",
    true
  ],
  "تعطيل الاحصائيات": [
    "statsEnabled",
    false
  ],

  "تفعيل الزاجل": [
    "zajelEnabled",
    true
  ],
  "تعطيل الزاجل": [
    "zajelEnabled",
    false
  ],

  "تفعيل التنسيقات": [
    "formatsEnabled",
    true
  ],
  "تعطيل التنسيقات": [
    "formatsEnabled",
    false
  ]
};

for (
  const [command, [key, value]]
  of Object.entries(DEV_SETTINGS)
) {
  bot.hears(
    command,
    async ctx => {
      if (
        !requireRank(
          ctx,
          "Dev🎖️"
        )
      ) {
        return;
      }

      const chat =
        ensureChat(ctx.chat.id);

      chat.settings[key] = value;

      saveDB();

      await ctx.reply(
        value
          ? `تم ${command.replace("تفعيل ", "تفعيل ")}.`
          : `تم ${command.replace("تعطيل ", "تعطيل ")}.`
      );
    }
  );
}

bot.hears(
  /^تعيين عدد الاعضاء\s+(\d+)$/i,
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev🎖️"
      )
    ) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.memberCount =
      Number(ctx.match[1]);

    saveDB();

    await ctx.reply(
      `تم تعيين عدد الاعضاء إلى ${chat.settings.memberCount}.`
    );
  }
);

/* ======================================================
   الاشتراك الإجباري
====================================================== */

bot.hears(
  "تغيير الاشتراك الاجباري",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev🎖️"
      )
    ) {
      return;
    }

    const channel =
      ctx.message?.reply_to_message?.text ||
      "";

    if (!channel) {
      return ctx.reply(
        "اكتب معرف قناة الاشتراك بعد الأمر.\nمثال: تغيير الاشتراك الاجباري @channel"
      );
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.forcedSubscriptionChannel =
      channel.trim();

    saveDB();

    await ctx.reply(
      `تم تغيير قناة الاشتراك إلى ${channel.trim()}`
    );
  }
);

/* ======================================================
   البوت والألعاب
====================================================== */

bot.hears(
  "تفعيل البوت",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev🎖️"
      )
    ) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.serviceBot = true;

    saveDB();

    await ctx.reply(
      "تم تفعيل البوت."
    );
  }
);

bot.hears(
  "تعطيل البوت",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev🎖️"
      )
    ) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.serviceBot = false;

    saveDB();

    await ctx.reply(
      "تم تعطيل البوت."
    );
  }
);

bot.hears(
  "قفل الالعاب",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev🎖️"
      )
    ) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.gamesClosed = true;
    chat.games.active = null;
    chat.ahkam = null;

    saveDB();

    await ctx.reply(
      "تم قفل الألعاب."
    );
  }
);

bot.hears(
  "فتح الالعاب",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev🎖️"
      )
    ) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.gamesClosed = false;

    saveDB();

    await ctx.reply(
      "تم فتح الألعاب."
    );
  }
);

/* ======================================================
   الألقاب
====================================================== */

bot.hears(
  "لقبي",
  async ctx => {
    const chat =
      ensureChat(ctx.chat.id);

    const user =
      chat.users[
        String(ctx.from.id)
      ];

    await ctx.reply(
      `لقبك: ${user?.title || "لا يوجد"}`
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
      ensureChat(ctx.chat.id);

    const user =
      chat.users[
        String(target.id)
      ];

    await ctx.reply(
      `لقبه: ${user?.title || "لا يوجد"}`
    );
  }
);

bot.hears(
  /^ضع(?:\s+(.+))?$/i,
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev🎖️"
      )
    ) {
      return;
    }

    const target =
      replyRequired(ctx);

    if (!target) return;

    const title =
      String(
        ctx.match[1] || ""
      ).trim();

    if (!title) {
      return ctx.reply(
        "اكتب اللقب بعد الأمر."
      );
    }

    if (title.length > 16) {
      return ctx.reply(
        "اللقب يجب ألا يتجاوز 16 حرفًا."
      );
    }

    try {
      await ctx.telegram.setChatAdministratorCustomTitle(
        ctx.chat.id,
        target.id,
        title
      );

      const chat =
        ensureChat(ctx.chat.id);

      ensureChatUser(
        chat,
        target
      ).title = title;

      saveDB();

      await ctx.reply(
        `تم تغيير لقب ${mentionUser(target)} إلى ${title}`
      );
    } catch {
      await ctx.reply(
        "تعذر تغيير اللقب. تأكد أن العضو مشرف وأن البوت يملك الصلاحيات."
      );
    }
  }
);

/* ======================================================
   سجل الحماية
====================================================== */

bot.hears(
  "سجل الحماية",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev🎖️"
      )
    ) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    const logs =
      chat.adminLog
        .slice(-20)
        .reverse();

    if (!logs.length) {
      return ctx.reply(
        "لا يوجد سجل إداري."
      );
    }

    await ctx.reply(
      logs.map(
        (log, index) =>
          `${index + 1}. ${log.action}\n` +
          `المنفذ: ${log.actorId}\n` +
          `المستهدف: ${log.targetId || "-"}`
      ).join("\n\n")
    );
  }
);

/* ======================================================
   أوامر Dev المختصرة
====================================================== */

bot.hears(
  "ق",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev🎖️"
      )
    ) return;

    const chat =
      ensureChat(ctx.chat.id);

    await ctx.reply(
      `الحماية: ${
        chat.settings.protection
          ? "مفعلة"
          : "معطلة"
      }\n` +
      `المخالفات: ${
        chat.settings.violationsOpen
          ? "مفتوحة"
          : "مقفلة"
      }\n` +
      `الألعاب: ${
        chat.settings.gamesClosed
          ? "مقفلة"
          : "مفتوحة"
      }`
    );
  }
);

bot.hears(
  "م",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev🎖️"
      )
    ) return;

    try {
      const info =
        await ctx.telegram.getChat(
          ctx.chat.id
        );

      await ctx.reply(
        `اسم القروب: ${info.title || ""}\n` +
        `المعرف: ${info.id}\n` +
        `النوع: ${info.type}`
      );
    } catch {
      await ctx.reply(
        "تعذر جلب معلومات القروب."
      );
    }
  }
);

bot.hears(
  "د",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev🎖️"
      )
    ) return;

    try {
      const link =
        await ctx.telegram.exportChatInviteLink(
          ctx.chat.id
        );

      await ctx.reply(
        `رابط القروب:\n${link}`
      );
    } catch {
      await ctx.reply(
        "تعذر إنشاء رابط القروب."
      );
    }
  }
);

/* ======================================================
   أوامر المساعدة
====================================================== */

const HELP_SECTIONS = {
  HELP_PROTECTION:
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

تفعيل الإنذارات
تعطيل الإنذارات
عدد الإنذارات
مسح الإنذارات
تفعيل الكتم التلقائي
تعطيل الكتم التلقائي
تفعيل الحظر التلقائي
تعطيل الحظر التلقائي

كتم
فك كتم
عام
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
مم
مسح المكتومين
خخ
مسح المكتومين عام
مسح المخالفات`,

  HELP_RANKS:
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

التعديل على الرتب يكون بالرد على العضو.`,

  HELP_DEV:
`أوامر Dev

تفعيل البوت
تعطيل البوت
تعيين عدد الاعضاء

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

فتح المخالفات
قفل المخالفات
فتح المنشن
غلق المنشن

سجل الحماية`,

  HELP_ADMIN:
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
تحذير
الغاء التحذير`,

  HELP_GROUP:
`القروب

@all
فتح المنشن
غلق المنشن

لقبي
لقبه
ضع
رتبتي
رتبته
تفاعلي
تفاعله
المتفاعلين`
};

function helpKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "الحماية",
        "HELP_PROTECTION"
      ),
      Markup.button.callback(
        "الرتب",
        "HELP_RANKS"
      )
    ],
    [
      Markup.button.callback(
        "Dev",
        "HELP_DEV"
      ),
      Markup.button.callback(
        "الإدارة",
        "HELP_ADMIN"
      )
    ],
    [
      Markup.button.callback(
        "القروب",
        "HELP_GROUP"
      )
    ]
  ]);
}

bot.hears(
  "اوامر",
  async ctx => {
    await ctx.reply(
      "اختر القسم:",
      helpKeyboard()
    );
  }
);

for (
  const [action, text]
  of Object.entries(
    HELP_SECTIONS
  )
) {
  bot.action(
    action,
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

/* ======================================================
   أمر حسابي
====================================================== */

bot.hears(
  "حسابي",
  async ctx => {
    const user =
      ensureGlobalUser(
        ctx.from
      );

    await ctx.reply(
      `اسم البنك: ${
        user.bank.active
          ? user.bank.name
          : "غير مفعل"
      }\n` +
      `رقم الحساب: ${
        user.bank.accountNumber ||
        "لا يوجد"
      }\n` +
      `الرصيد: ${user.balance} ريال`
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

    user.bank.active = false;
    user.bank.name = "";
    user.bank.accountNumber = "";

    saveDB();

    await ctx.reply(
      "تم حذف الحساب البنكي."
    );
  }
);

bot.hears(
  "المتجر",
  async ctx => {
    await ctx.reply(
      "المتجر\n\nلا توجد منتجات مضافة حاليًا."
    );
  }
);

/* ======================================================
   أوامر قفل القروب والوسائط
====================================================== */

const LOCKS = {
  "قفل المحادثة": "chat",
  "قفل الوسائط": "media",
  "قفل الروابط": "links",
  "قفل الصور": "photos",
  "قفل الفيديو": "videos",
  "قفل الملفات": "files",
  "قفل الملصقات": "stickers",
  "قفل GIF": "gifs",
  "قفل الصوتيات": "audio",
  "قفل الفوروارد": "forwards",
  "قفل المنشن": "mentions"
};

for (
  const [command, key]
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
      ) {
        return;
      }

      const chat =
        ensureChat(ctx.chat.id);

      chat.settings.locks[key] =
        true;

      saveDB();

      await ctx.reply(
        `تم ${command}.`
      );
    }
  );

  const unlock =
    command.replace(
      "قفل",
      "فتح"
    );

  bot.hears(
    unlock,
    async ctx => {
      if (
        !requireRank(
          ctx,
          "Dev²🎖️"
        )
      ) {
        return;
      }

      const chat =
        ensureChat(ctx.chat.id);

      chat.settings.locks[key] =
        false;

      saveDB();

      await ctx.reply(
        `تم ${unlock}.`
      );
    }
  );
}

/* ======================================================
   إحصائيات البوت
====================================================== */

bot.hears(
  "احصائيات البوت",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev🎖️"
      )
    ) return;

    const users =
      Object.keys(
        db.users
      ).length;

    const chats =
      Object.keys(
        db.chats
      ).length;

    const logs =
      db.botLog.length;

    await ctx.reply(
      `إحصائيات البوت

المستخدمون: ${users}
القروبات: ${chats}
السجلات: ${logs}`
    );
  }
);

bot.hears(
  "حالة البوت",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev🎖️"
      )
    ) return;

    await ctx.reply(
      "البوت يعمل بنجاح."
    );
  }
);

/* ======================================================
   نسخة احتياطية للبيانات
====================================================== */

bot.hears(
  "نسخة احتياطية",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev🎖️"
      )
    ) return;

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

      await ctx.reply(
        "تم إنشاء نسخة احتياطية من البيانات."
      );
    } catch {
      await ctx.reply(
        "تعذر إنشاء النسخة الاحتياطية."
      );
    }
  }
);

/* ======================================================
   حذف بيانات القروب
====================================================== */

bot.hears(
  "مسح بيانات القروب",
  async ctx => {
    if (
      !requireRank(
        ctx,
        "Dev🎖️"
      )
    ) return;

    const chatId =
      String(ctx.chat.id);

    db.chats[chatId] = {
      id: chatId,
      settings: defaultChatSettings(),
      users: {},
      customCommands: {},
      customReplies: {},
      channels: {},
      marriages: {},
      games: {
        active: null,
        stats: {}
      },
      ahkam: null,
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

    await ctx.reply(
      "تم مسح بيانات القروب."
    );
  }
);

/* ======================================================
   معالجة الأخطاء
====================================================== */

bot.catch(
  (error, ctx) => {
    console.error(
      "BOT ERROR:",
      error
    );

    try {
      if (ctx?.chat) {
        ctx.reply(
          "حدث خطأ أثناء تنفيذ الأمر."
        ).catch(() => {});
      }
    } catch {}
  }
);

/* ======================================================
   تشغيل البوت
====================================================== */

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
      "Bot started successfully"
    );
  })
  .catch(error => {
    console.error(
      "Failed to start bot:",
      error
    );
  });
