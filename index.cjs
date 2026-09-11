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

  "m": "Myth",
  "myth": "Myth",

  "my": "Myth 🎖️",
  "myth🎖️": "Myth 🎖️",
  "myth 🎖️": "Myth 🎖️",
  "اكس": "Myth 🎖️",

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

/*
  ID حساب المطور الأساسي
*/
const OWNER_ID = "5370959021438146805";

const DEV_IDS = String(process.env.DEV_IDS || "")
  .split(",")
  .map(x => x.trim())
  .filter(Boolean);

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
  chat.ahkam ||= null;
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

  /*
    إصلاح بيانات التفاعل القديمة التي لم تكن تحتوي على id
  */
  for (const [userId, interaction] of Object.entries(
    chat.interactions
  )) {
    if (interaction && !interaction.id) {
      interaction.id = String(userId);
    }
  }

  chat.music ||= {
    enabled: true,
    current: null,
    queue: [],
    playing: false
  };

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
      user.username || chat.users[id].username || "";

    chat.users[id].firstName =
      user.first_name || chat.users[id].firstName || "";
  }

  return chat.users[id];
}

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

function isOwnerMember(member) {
  return member?.status === "creator";
}

function canUseRank(chat, userId, requiredRank) {
  const current = getRank(chat, userId);

  return rankValue(current) >= rankValue(requiredRank);
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

function mentionUser(user) {
  if (!user) return "المستخدم";

  const name =
    user.first_name ||
    user.username ||
    "المستخدم";

  return `[${escapeMarkdown(name)}](tg://user?id=${user.id})`;
}

function escapeMarkdown(text) {
  return String(text || "")
    .replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

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

function logAdmin(
  chat,
  actorId,
  action,
  targetId = null
) {
  chat.adminLog.push({
    actorId: String(actorId),
    targetId: targetId
      ? String(targetId)
      : null,
    action,
    time: Date.now()
  });

  if (chat.adminLog.length > 500) {
    chat.adminLog.splice(
      0,
      chat.adminLog.length - 500
    );
  }

  db.botLog.push({
    chatId: chat.id,
    actorId: String(actorId),
    targetId: targetId
      ? String(targetId)
      : null,
    action,
    time: Date.now()
  });

  if (db.botLog.length > 2000) {
    db.botLog.splice(
      0,
      db.botLog.length - 2000
    );
  }

  saveDB();
}

function requireRank(ctx, requiredRank) {
  const chat = ensureChat(ctx.chat.id);
  const rank = getRank(chat, ctx.from.id);

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
  const chat = ensureChat(ctx.chat.id);
  const rank = getRank(chat, ctx.from.id);

  if (
    rankValue(rank) <
    rankValue("مميز")
  ) {
    ctx.reply(
      rankPermissionMessage("مميز")
    );

    return false;
  }

  return true;
}

function replyRequired(ctx) {
  const target = getTargetFromReply(ctx);

  if (!target) {
    ctx.reply(
      "يجب استخدام الأمر بالرد على العضو."
    );

    return null;
  }

  return target;
}

async function botIsAdmin(ctx) {
  try {
    const me = await ctx.telegram.getMe();

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
    await safeGetMember(
      ctx,
      targetId
    );

  if (!targetMember) {
    return false;
  }

  if (targetMember.status === "creator") {
    return true;
  }

  const chat = ensureChat(ctx.chat.id);

  return !canTarget(
    chat,
    ctx.from.id,
    targetId
  );
}

function ensureSubscriber(userId) {
  const id = String(userId);

  if (!db.globalSubscribers.includes(id)) {
    db.globalSubscribers.push(id);
    saveDB();
  }
}

/*
  نظام التفاعل
  كل رسالة تضيف رسالة واحدة ونقطة واحدة
*/
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

  chat.interactions[id].id = id;

  chat.interactions[id].messages += 1;
  chat.interactions[id].points += points;
}

function getInteraction(chat, userId) {
  const id = String(userId);

  if (!chat.interactions[id]) {
    chat.interactions[id] = {
      id,
      messages: 0,
      points: 0
    };
  }

  chat.interactions[id].id = id;

  return chat.interactions[id];
}

function getInteractionRanking(chat) {
  return Object.entries(chat.interactions)
    .sort((a, b) => {
      const pointsA =
        Number(a[1]?.points || 0);

      const pointsB =
        Number(b[1]?.points || 0);

      if (pointsB !== pointsA) {
        return pointsB - pointsA;
      }

      const messagesA =
        Number(a[1]?.messages || 0);

      const messagesB =
        Number(b[1]?.messages || 0);

      return messagesB - messagesA;
    });
}

function getInteractionPosition(
  chat,
  userId
) {
  const id = String(userId);

  const ranking =
    getInteractionRanking(chat);

  const index =
    ranking.findIndex(
      ([targetId]) =>
        String(targetId) === id
    );

  return index === -1
    ? 0
    : index + 1;
}

function addBalance(userId, amount) {
  const user = ensureGlobalUser({
    id: userId
  });

  user.balance += Number(amount) || 0;

  if (user.balance < 0) {
    user.balance = 0;
  }

  saveDB();

  return user.balance;
}

function getBalance(userId) {
  const user = ensureGlobalUser({
    id: userId
  });

  return user.balance;
}

function adminOnly(ctx, next) {
  if (
    !ctx.chat ||
    ctx.chat.type === "private"
  ) {
    return next();
  }

  if (!requireAdminRank(ctx)) {
    return;
  }

  return next();
}

/*
  Middleware
*/
bot.use(async (ctx, next) => {
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

        time: Date.now()
      });

      if (chat.messageLog.length > 1000) {
        chat.messageLog.shift();
      }
    }

    saveDB();
  }

  return next();
});

/*
  START
*/
bot.start(async ctx => {
  ensureSubscriber(ctx.from.id);

  if (ctx.chat.type !== "private") {
    return;
  }

  await ctx.reply(
    `اهلا بك يا قلبي - ${mentionUser(ctx.from)}\n\n` +
    `• انا اشغل لك اللي تبي بالمكالمه\n\n` +
    `ادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.`,
    Markup.inlineKeyboard([
      [
        Markup.button.url(
          "أضفني في مجموعتك",
          `https://t.me/${ctx.botInfo.username}?startgroup=true`
        )
      ],
      [
        Markup.button.url(
          "المطور  (j4xa7 )",
          "https://t.me/j4xa7"
        )
      ]
    ])
  );
});

/*
  الرتبة
*/
bot.hears("رتبتي", async ctx => {
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
});

/*
  تفاعلي
*/
bot.hears("تفاعلي", async ctx => {
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
});

/*
  المتفاعلين
*/
bot.hears("المتفاعلين", async ctx => {
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

  const users =
    list.map(
      ([id, item], index) => {
        const member =
          chat.users[id];

        return (
          `${index + 1} - ` +
          `${member?.firstName || "المستخدم"}\n` +
          `النقاط: ${item.points || 0}\n` +
          `الرسائل: ${item.messages || 0}`
        );
      }
    );

  await ctx.reply(
    users.join("\n\n")
  );
});

/*
  رتبته
*/
bot.hears("رتبته", async ctx => {
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
});

/*
  تفاعله
*/
bot.hears("تفاعله", async ctx => {
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

  const rank =
    getRank(
      chat,
      target.id
    );

  await ctx.reply(
    `رتبته: ${RANK_DISPLAY[rank] || rank}\n` +
    `عدد رسائله: ${stats.messages}\n` +
    `ترتيبه: ${position}`
  );
});

/*
  الفلوس
*/
bot.hears(/^فلوسي$/i, async ctx => {
  await ctx.reply(
    `فلوسك: ${getBalance(ctx.from.id)} ريال`
  );
});

bot.hears(/^فلوسه$/i, async ctx => {
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
});

bot.hears(/^اهداء\s+(\d+)$/i, async ctx => {
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

  const senderBalance =
    getBalance(ctx.from.id);

  if (senderBalance < amount) {
    return ctx.reply(
      "رصيدك لا يكفي لإتمام العملية."
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

  ensureGlobalUser(
    ctx.from
  ).transfers.push({
    type: "send",
    targetId:
      String(target.id),
    amount,
    time: Date.now()
  });

  ensureGlobalUser(
    target
  ).transfers.push({
    type: "receive",
    userId:
      String(ctx.from.id),
    amount,
    time: Date.now()
  });

  saveDB();

  await ctx.reply(
    `تم إهداء ${amount} ريال إلى ` +
    `${
      target.username
        ? `@${target.username}`
        : target.first_name
    }`
  );
});

/*
  البنك
*/
bot.hears("حسابي", async ctx => {
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
});

bot.hears("حذف حسابي", async ctx => {
  const user =
    ensureGlobalUser(
      ctx.from
    );

  user.bank.active = false;
  user.bank.name = "";
  user.bank.accountNumber = "";

  saveDB();

  await ctx.reply(
    "تم حذف الحساب البنكي مع الحفاظ على بياناتك ورصيدك."
  );
});

bot.hears("المتجر", async ctx => {
  await ctx.reply(
    "المتجر\n\nلا توجد منتجات مضافة حاليًا."
  );
});

/*
  أمر ا
*/
bot.hears("ا", async ctx => {
  if (
    !requireRank(
      ctx,
      "Dev🎖️"
    )
  ) {
    return;
  }

  const target =
    getTargetFromReply(ctx);

  if (!target) {
    return ctx.reply(
      `معرفك: ${ctx.from.id}\n` +
      `اسمك: ${ctx.from.first_name || ""}\n` +
      `يوزرك: ${
        ctx.from.username
          ? `@${ctx.from.username}`
          : "لا يوجد"
      }`
    );
  }

  const chat =
    ensureChat(ctx.chat.id);

  const member =
    ensureChatUser(
      chat,
      target
    );

  const rank =
    getRank(
      chat,
      target.id
    );

  const balance =
    getBalance(target.id);

  await ctx.reply(
    `معلومات العضو\n\n` +
    `الاسم: ${target.first_name || ""}\n` +
    `اليوزر: ${
      target.username
        ? `@${target.username}`
        : "لا يوجد"
    }\n` +
    `المعرف: ${target.id}\n` +
    `الرتبة: ${
      RANK_DISPLAY[rank] || rank
    }\n` +
    `الرصيد: ${balance} ريال\n` +
    `الرسائل: ${member?.messages || 0}`
  );
});

/*
  أمر ت
*/
bot.hears("ت", async ctx => {
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

  const users =
    getInteractionRanking(chat)
      .slice(0, 20);

  if (!users.length) {
    return ctx.reply(
      "لا توجد بيانات تفاعل."
    );
  }

  await ctx.reply(
    users
      .map(
        ([id, item], index) => {
          const user =
            chat.users[id];

          return (
            `${index + 1} - ` +
            `${user?.firstName || "المستخدم"} - ` +
            `${item.points || 0}`
          );
        }
      )
      .join("\n")
  );
});

/*
  أمر ق
*/
bot.hears("ق", async ctx => {
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

  await ctx.reply(
    `حالة الحماية: ${
      chat.settings.protection
        ? "مفعلة"
        : "معطلة"
    }\n` +
    `الحماية التلقائية: ${
      chat.settings.automaticProtection
        ? "مفعلة"
        : "معطلة"
    }\n` +
    `الإنذارات: ${
      chat.settings.warningsEnabled
        ? "مفعلة"
        : "معطلة"
    }`
  );
});

/*
  أمر م
*/
bot.hears("م", async ctx => {
  if (
    !requireRank(
      ctx,
      "Dev🎖️"
    )
  ) {
    return;
  }

  const info =
    await ctx.telegram.getChat(
      ctx.chat.id
    );

  await ctx.reply(
    `اسم القروب: ${info.title || ""}\n` +
    `المعرف: ${info.id}\n` +
    `النوع: ${info.type}`
  );
});

/*
  أمر ح
*/
bot.hears("ح", async ctx => {
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
});

/*
  أمر د
*/
bot.hears("د", async ctx => {
  if (
    !requireRank(
      ctx,
      "Dev🎖️"
    )
  ) {
    return;
  }

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
      "تعذر إنشاء رابط القروب. تأكد من صلاحيات البوت."
    );
  }
});

/*
  المنشن
*/
bot.hears("فتح المنشن", async ctx => {
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
});

bot.hears("غلق المنشن", async ctx => {
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
});

/*
  المخالفات
*/
bot.hears("فتح المخالفات", async ctx => {
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
});

bot.hears("قفل المخالفات", async ctx => {
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
});

/*
  الحماية
*/
bot.hears("تفعيل الحماية", async ctx => {
  if (!requireAdminRank(ctx)) {
    return;
  }

  const chat =
    ensureChat(ctx.chat.id);

  chat.settings.protection = true;

  saveDB();

  await ctx.reply(
    "تم تفعيل الحماية."
  );
});

bot.hears("تعطيل الحماية", async ctx => {
  if (!requireAdminRank(ctx)) {
    return;
  }

  const chat =
    ensureChat(ctx.chat.id);

  chat.settings.protection = false;

  saveDB();

  await ctx.reply(
    "تم تعطيل الحماية."
  );
});

bot.hears("حالة الحماية", async ctx => {
  if (!requireAdminRank(ctx)) {
    return;
  }

  const chat =
    ensureChat(ctx.chat.id);

  await ctx.reply(
    `الحماية: ${
      chat.settings.protection
        ? "مفعلة"
        : "معطلة"
    }\n` +
    `الحماية التلقائية: ${
      chat.settings.automaticProtection
        ? "مفعلة"
        : "معطلة"
    }\n` +
    `منع الروابط: ${
      chat.settings.preventLinks
        ? "مفعل"
        : "معطل"
    }\n` +
    `منع التعديل: ${
      chat.settings.preventEdits
        ? "مفعل"
        : "معطل"
    }\n` +
    `منع التكرار: ${
      chat.settings.preventSpam
        ? "مفعل"
        : "معطل"
    }`
  );
});

bot.hears(
  "تفعيل الحماية التلقائية",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.automaticProtection =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل الحماية التلقائية."
    );
  }
);

bot.hears(
  "تعطيل الحماية التلقائية",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.automaticProtection =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل الحماية التلقائية."
    );
  }
);

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
      if (!requireAdminRank(ctx)) {
        return;
      }

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
      if (!requireAdminRank(ctx)) {
        return;
      }

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

/*
  الإنذارات
*/
bot.hears(
  "تفعيل الإنذارات",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.warningsEnabled =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل الإنذارات."
    );
  }
);

bot.hears(
  "تعطيل الإنذارات",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.warningsEnabled =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل الإنذارات."
    );
  }
);

bot.hears(
  /^عدد الإنذارات(?:\s+(\d+))?$/i,
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

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

    chat.settings.warningLimit =
      count;

    saveDB();

    await ctx.reply(
      `تم تحديد عدد الإنذارات إلى ${count}.`
    );
  }
);

bot.hears(
  "مسح الإنذارات",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.warnings = {};

    for (
      const user
      of Object.values(chat.users)
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
    if (!requireAdminRank(ctx)) {
      return;
    }

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
    if (!requireAdminRank(ctx)) {
      return;
    }

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
    if (!requireAdminRank(ctx)) {
      return;
    }

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
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.autoBan = false;

    saveDB();

    await ctx.reply(
      "تم تعطيل الحظر التلقائي."
    );
  }
);

/*
  الكتم
*/
bot.hears("كتم", async ctx => {
  if (!requireRank(ctx, "Myth")) {
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

    chat.muted[
      String(target.id)
    ] = true;

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
});

bot.hears(
  "فك كتم",
  async ctx => {
    if (!requireRank(ctx, "Myth")) {
      return;
    }

    const target =
      replyRequired(ctx);

    if (!target) return;

    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        target.id,
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
          can_change_info: false,
          can_invite_users: true,
          can_pin_messages: false,
          can_manage_topics: false
        }
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
        "تعذر فك الكتم. تأكد من صلاحيات البوت."
      );
    }
  }
);

/*
  الكتم العام
*/
bot.hears("عام", async ctx => {
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
    ] = true;

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
});

bot.hears("خخ", async ctx => {
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
});

bot.hears("مم", async ctx => {
  if (!requireRank(ctx, "Myth")) {
    return;
  }

  const chat =
    ensureChat(ctx.chat.id);

  chat.muted = {};

  saveDB();

  await ctx.reply(
    "تم مسح المكتومين."
  );
});

bot.hears(
  "مسح المكتومين",
  async ctx => {
    if (!requireRank(ctx, "Myth")) {
      return;
    }

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

/*
  التقييد
*/
bot.hears("تقييد", async ctx => {
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
    ] = true;

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
      "تعذر تقييد العضو. تأكد من صلاحيات البوت."
    );
  }
});

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
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        target.id,
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
          can_invite_users: true
        }
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

/*
  الحظر
*/
bot.hears("حظر", async ctx => {
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
      "تعذر حظر العضو. تأكد من صلاحيات البوت."
    );
  }
});

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

/*
  الطرد
*/
bot.hears("طرد", async ctx => {
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
});

/*
  التحذير
*/
bot.hears(
  "تحذير",
  async ctx => {
    if (!requireRank(ctx, "Myth")) {
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

    const chat =
      ensureChat(ctx.chat.id);

    const id =
      String(target.id);

    chat.warnings[id] =
      Number(chat.warnings[id] || 0) + 1;

    if (!chat.users[id]) {
      ensureChatUser(
        chat,
        target
      );
    }

    chat.users[id].warnings =
      chat.warnings[id];

    logAdmin(
      chat,
      ctx.from.id,
      "تحذير",
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

        chat.muted[id] = true;
      } catch {}
    }

    saveDB();

    await ctx.reply(
      `تم تحذير ${mentionUser(target)}\n` +
      `عدد الإنذارات: ${count}`
    );
  }
);

bot.hears(
  "الغاء التحذير",
  async ctx => {
    if (!requireRank(ctx, "Myth")) {
      return;
    }

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
    if (!requireRank(ctx, "Myth")) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.warnings = {};

    for (
      const user
      of Object.values(chat.users)
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

/*
  حماية الدخول
*/
bot.hears(
  "تفعيل حماية الدخول",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.entryProtection =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل حماية الدخول."
    );
  }
);

bot.hears(
  "تعطيل حماية الدخول",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.entryProtection =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل حماية الدخول."
    );
  }
);

bot.hears(
  "تفعيل حماية البوتات",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.botProtection =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل حماية البوتات."
    );
  }
);

bot.hears(
  "تعطيل حماية البوتات",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.botProtection =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل حماية البوتات."
    );
  }
);

bot.hears(
  "تفعيل حماية الحسابات الجديدة",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.newAccountProtection =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل حماية الحسابات الجديدة."
    );
  }
);

bot.hears(
  "تعطيل حماية الحسابات الجديدة",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.newAccountProtection =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل حماية الحسابات الجديدة."
    );
  }
);

/*
  البوت
*/
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

/*
  الردود
*/
bot.hears(
  "تفعيل الردود",
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

    chat.settings.repliesEnabled =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل الردود."
    );
  }
);

bot.hears(
  "تعطيل الردود",
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

    chat.settings.repliesEnabled =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل الردود."
    );
  }
);

/*
  البنك
*/
bot.hears(
  "تفعيل البنك",
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

    chat.settings.bankEnabled =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل البنك."
    );
  }
);

bot.hears(
  "تعطيل البنك",
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

    chat.settings.bankEnabled =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل البنك."
    );
  }
);

/*
  التواصل
*/
bot.hears(
  "تفعيل التواصل",
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

    chat.settings.communicationEnabled =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل التواصل."
    );
  }
);

bot.hears(
  "تعطيل التواصل",
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

    chat.settings.communicationEnabled =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل التواصل."
    );
  }
);

/*
  الاشتراك الاجباري
*/
bot.hears(
  "تفعيل الاشتراك الاجباري",
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

    chat.settings.forcedSubscription =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل الاشتراك الاجباري."
    );
  }
);

bot.hears(
  "تعطيل الاشتراك الاجباري",
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

    chat.settings.forcedSubscription =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل الاشتراك الاجباري."
    );
  }
);

/*
  بوت الخدمة
*/
bot.hears(
  "تفعيل بوت الخدمة",
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

    chat.settings.serviceBot =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل بوت الخدمة."
    );
  }
);

bot.hears(
  "تعطيل بوت الخدمة",
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

    chat.settings.serviceBot =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل بوت الخدمة."
    );
  }
);

/*
  الاحصائيات
*/
bot.hears(
  "تفعيل الاحصائيات",
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

    chat.settings.statsEnabled =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل الاحصائيات."
    );
  }
);

bot.hears(
  "تعطيل الاحصائيات",
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

    chat.settings.statsEnabled =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل الاحصائيات."
    );
  }
);

/*
  الزاجل
*/
bot.hears(
  "تفعيل الزاجل",
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

    chat.settings.zajelEnabled =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل الزاجل."
    );
  }
);

bot.hears(
  "تعطيل الزاجل",
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

    chat.settings.zajelEnabled =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل الزاجل."
    );
  }
);

/*
  التنسيقات
*/
bot.hears(
  "تفعيل التنسيقات",
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

    chat.settings.formatsEnabled =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل التنسيقات."
    );
  }
);

bot.hears(
  "تعطيل التنسيقات",
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

    chat.settings.formatsEnabled =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل التنسيقات."
    );
  }
);

/*
  الألعاب
*/
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

    chat.settings.gamesClosed =
      true;

    chat.games.active = null;
    chat.ahkam = null;

    saveDB();

    await ctx.reply(
      "• تم قفل الألعاب\n" +
      "• لا يمكن للأعضاء بدء أو المشاركة في الألعاب حاليًا"
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

    chat.settings.gamesClosed =
      false;

    saveDB();

    await ctx.reply(
      "• تم فتح الألعاب\n" +
      "• يمكن للأعضاء اللعب والمشاركة الآن"
    );
  }
);

/*
  صلاحياتي
*/
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

      if (
        member.status ===
        "creator"
      ) {
        return ctx.reply(
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

      await ctx.reply(
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
    } catch {
      await ctx.reply(
        "تعذر جلب صلاحياتك الحالية."
      );
    }
  }
);

/*
  صلاحياته
*/
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
          "صلاحياتك عضو بالقروب"
        );
      }

      if (
        member.status ===
        "creator"
      ) {
        return ctx.reply(
          "• صلاحياته بالإشراف :\n" +
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

      await ctx.reply(
        "• صلاحياته بالإشراف :\n" +
        "━━━━━━━━━━━\n" +
        `• تغيير المعلومات ↤︎ ${yes(member.can_change_info)}\n` +
        `• تثبيت الرسائل ↤︎ ${yes(member.can_pin_messages)}\n` +
        `• ادارة المواضيع ↤︎ ${yes(member.can_manage_topics)}\n` +
        `• اضافه مستخدمين ↤︎ ${yes(member.can_invite_users)}\n` +
        `• مسح الرسائل ↤︎ ${yes(member.can_delete_messages)}\n` +
        `• حظر المستخدمين ↤︎ ${yes(member.can_restrict_members)}\n` +
        `• اضافه المشرفين ↤︎ ${yes(member.can_promote_members)}`
      );
    } catch {
      await ctx.reply(
        "تعذر جلب صلاحيات العضو."
      );
    }
  }
);

/*
  الألقاب
*/
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
      `لقبك علامة السهم المحدده و اللقب ${user?.title || "لا يوجد"}`
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
      `لقبه علامة السهم المحدده و اللقب ${user?.title || "لا يوجد"}`
    );
  }
);

/*
  ضع لقب
*/
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
        "تعذر تغيير اللقب. يجب أن يكون العضو مشرفًا، ويجب أن يملك البوت صلاحية تعديل المشرفين."
      );
    }
  }
);

/*
  الأوامر
*/
bot.hears(
  "اوامر",
  async ctx => {
    await ctx.reply(
      "اختر القسم:",
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "المطور",
            "HELP_DEV"
          ),
          Markup.button.callback(
            "الرتب",
            "HELP_RANKS"
          )
        ],
        [
          Markup.button.callback(
            "الحماية",
            "HELP_PROTECTION"
          ),
          Markup.button.callback(
            "التفاعل والألعاب والفعاليات",
            "HELP_GAMES"
          )
        ],
        [
          Markup.button.callback(
            "الهمسات والأغاني",
            "HELP_MUSIC"
          ),
          Markup.button.callback(
            "الأوامر المخصصة",
            "HELP_CUSTOM"
          )
        ],
        [
          Markup.button.callback(
            "القروب",
            "HELP_GROUP"
          )
        ]
      ])
    );
  }
);

const HELP_SECTIONS = {
  HELP_DEV:
    "المطور\n\n" +
    "ا\n" +
    "ت\n" +
    "ق\n" +
    "م\n" +
    "ن\n" +
    "ح\n" +
    "د\n\n" +
    "أوامر إعدادات البوت وإدارة المطورين والقروبات والقنوات.",

  HELP_RANKS:
    "الرتب\n\n" +
    "مميز\n" +
    "رفع مميز\n" +
    "مالك\n" +
    "رفع مالك\n" +
    "مالك اساسي\n" +
    "رفع اساس\n" +
    "myth\n" +
    "رفع M\n" +
    "Myth🎖️\n" +
    "رفع My\n" +
    "رفع اكس\n" +
    "Dev²\n" +
    "رفع ديف\n" +
    "Dev\n" +
    "رفع مطور ثانوي",

  HELP_PROTECTION:
    "الحماية\n\n" +
    "تفعيل الحماية\n" +
    "تعطيل الحماية\n" +
    "حالة الحماية\n" +
    "تفعيل الحماية التلقائية\n" +
    "تعطيل الحماية التلقائية\n" +
    "كتم\n" +
    "فك كتم\n" +
    "عام\n" +
    "خخ\n" +
    "تقييد\n" +
    "الغاء التقييد\n" +
    "حظر\n" +
    "فك الحظر\n" +
    "طرد\n" +
    "تحذير\n" +
    "الغاء التحذير\n" +
    "تنظيف\n" +
    "تنظيف 10\n" +
    "مسح المخالفات",

  HELP_GAMES:
    "التفاعل والألعاب والفعاليات\n\n" +
    "تفاعلي\n" +
    "المتفاعلين\n" +
    "رتبتي\n" +
    "رتبته\n" +
    "تفاعله\n" +
    "العاب\n" +
    "صور\n" +
    "كلمة\n" +
    "ترتيب\n" +
    "مقال\n" +
    "جملة\n" +
    "حروف\n" +
    "خمن\n" +
    "لغز\n" +
    "صح أو خطأ\n" +
    "أكمل\n" +
    "مقلوب\n" +
    "فكك\n" +
    "إيموجي\n" +
    "سرعة\n" +
    "حساب\n" +
    "ذاكرة\n" +
    "من أنا\n" +
    "كلمة السر\n" +
    "قفل الالعاب\n" +
    "فتح الالعاب\n" +
    "احكام\n" +
    "انهاء احكام",

  HELP_MUSIC:
    "الهمسات والأغاني\n\n" +
    "اهمس\n" +
    "همسه\n" +
    "ه\n" +
    "رؤية الهمسة\n" +
    "رد على الهمسة\n\n" +
    "بحث أغنية + اسم الأغنية\n" +
    "تشغيل + اسم الأغنية\n" +
    "إيقاف\n" +
    "استئناف\n" +
    "تخطي\n" +
    "إلغاء\n" +
    "الأغنية\n" +
    "قائمة التشغيل\n" +
    "مسح القائمة",

  HELP_CUSTOM:
    "الأوامر المخصصة\n\n" +
    "اضف امر\n" +
    "حذف امر\n" +
    "اوامري\n" +
    "اضف رد\n" +
    "حذف رد\n" +
    "ردودي\n" +
    "اضف قناة\n" +
    "قناتي\n" +
    "تعديل قناتي\n" +
    "حذف قناتي\n" +
    "منع الكلمه\n" +
    "الغاء منع الكلمه\n" +
    "الكلمات الممنوعه\n" +
    "مسح الكلمات الممنوعه",

  HELP_GROUP:
    "القروب\n\n" +
    "قروب\n" +
    "القوانين\n" +
    "المالك\n" +
    "صلاحياتي\n" +
    "صلاحياته\n" +
    "لقبي\n" +
    "لقبه"
};

for (
  const [action, text]
  of Object.entries(HELP_SECTIONS)
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
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "المطور",
            "HELP_DEV"
          ),
          Markup.button.callback(
            "الرتب",
            "HELP_RANKS"
          )
        ],
        [
          Markup.button.callback(
            "الحماية",
            "HELP_PROTECTION"
          ),
          Markup.button.callback(
            "التفاعل والألعاب والفعاليات",
            "HELP_GAMES"
          )
        ],
        [
          Markup.button.callback(
            "الهمسات والأغاني",
            "HELP_MUSIC"
          ),
          Markup.button.callback(
            "الأوامر المخصصة",
            "HELP_CUSTOM"
          )
        ],
        [
          Markup.button.callback(
            "القروب",
            "HELP_GROUP"
          )
        ]
      ])
    );
  }
);

/*
  الأخطاء
*/
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

process.once(
  "SIGINT",
  () => bot.stop("SIGINT")
);

process.once(
  "SIGTERM",
  () => bot.stop("SIGTERM")
);

/*
  تشغيل البوت
*/
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

  "m": "Myth",
  "myth": "Myth",

  "my": "Myth 🎖️",
  "myth🎖️": "Myth 🎖️",
  "myth 🎖️": "Myth 🎖️",
  "اكس": "Myth 🎖️",

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

/*
  ID حساب المطور الأساسي
*/
const OWNER_ID = "5370959021438146805";

const DEV_IDS = String(process.env.DEV_IDS || "")
  .split(",")
  .map(x => x.trim())
  .filter(Boolean);

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
  chat.ahkam ||= null;
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

  /*
    إصلاح بيانات التفاعل القديمة التي لم تكن تحتوي على id
  */
  for (const [userId, interaction] of Object.entries(
    chat.interactions
  )) {
    if (interaction && !interaction.id) {
      interaction.id = String(userId);
    }
  }

  chat.music ||= {
    enabled: true,
    current: null,
    queue: [],
    playing: false
  };

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
      user.username || chat.users[id].username || "";

    chat.users[id].firstName =
      user.first_name || chat.users[id].firstName || "";
  }

  return chat.users[id];
}

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

function isOwnerMember(member) {
  return member?.status === "creator";
}

function canUseRank(chat, userId, requiredRank) {
  const current = getRank(chat, userId);

  return rankValue(current) >= rankValue(requiredRank);
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

function mentionUser(user) {
  if (!user) return "المستخدم";

  const name =
    user.first_name ||
    user.username ||
    "المستخدم";

  return `[${escapeMarkdown(name)}](tg://user?id=${user.id})`;
}

function escapeMarkdown(text) {
  return String(text || "")
    .replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

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

function logAdmin(
  chat,
  actorId,
  action,
  targetId = null
) {
  chat.adminLog.push({
    actorId: String(actorId),
    targetId: targetId
      ? String(targetId)
      : null,
    action,
    time: Date.now()
  });

  if (chat.adminLog.length > 500) {
    chat.adminLog.splice(
      0,
      chat.adminLog.length - 500
    );
  }

  db.botLog.push({
    chatId: chat.id,
    actorId: String(actorId),
    targetId: targetId
      ? String(targetId)
      : null,
    action,
    time: Date.now()
  });

  if (db.botLog.length > 2000) {
    db.botLog.splice(
      0,
      db.botLog.length - 2000
    );
  }

  saveDB();
}

function requireRank(ctx, requiredRank) {
  const chat = ensureChat(ctx.chat.id);
  const rank = getRank(chat, ctx.from.id);

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
  const chat = ensureChat(ctx.chat.id);
  const rank = getRank(chat, ctx.from.id);

  if (
    rankValue(rank) <
    rankValue("مميز")
  ) {
    ctx.reply(
      rankPermissionMessage("مميز")
    );

    return false;
  }

  return true;
}

function replyRequired(ctx) {
  const target = getTargetFromReply(ctx);

  if (!target) {
    ctx.reply(
      "يجب استخدام الأمر بالرد على العضو."
    );

    return null;
  }

  return target;
}

async function botIsAdmin(ctx) {
  try {
    const me = await ctx.telegram.getMe();

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
    await safeGetMember(
      ctx,
      targetId
    );

  if (!targetMember) {
    return false;
  }

  if (targetMember.status === "creator") {
    return true;
  }

  const chat = ensureChat(ctx.chat.id);

  return !canTarget(
    chat,
    ctx.from.id,
    targetId
  );
}

function ensureSubscriber(userId) {
  const id = String(userId);

  if (!db.globalSubscribers.includes(id)) {
    db.globalSubscribers.push(id);
    saveDB();
  }
}

/*
  نظام التفاعل
  كل رسالة تضيف رسالة واحدة ونقطة واحدة
*/
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

  chat.interactions[id].id = id;

  chat.interactions[id].messages += 1;
  chat.interactions[id].points += points;
}

function getInteraction(chat, userId) {
  const id = String(userId);

  if (!chat.interactions[id]) {
    chat.interactions[id] = {
      id,
      messages: 0,
      points: 0
    };
  }

  chat.interactions[id].id = id;

  return chat.interactions[id];
}

function getInteractionRanking(chat) {
  return Object.entries(chat.interactions)
    .sort((a, b) => {
      const pointsA =
        Number(a[1]?.points || 0);

      const pointsB =
        Number(b[1]?.points || 0);

      if (pointsB !== pointsA) {
        return pointsB - pointsA;
      }

      const messagesA =
        Number(a[1]?.messages || 0);

      const messagesB =
        Number(b[1]?.messages || 0);

      return messagesB - messagesA;
    });
}

function getInteractionPosition(
  chat,
  userId
) {
  const id = String(userId);

  const ranking =
    getInteractionRanking(chat);

  const index =
    ranking.findIndex(
      ([targetId]) =>
        String(targetId) === id
    );

  return index === -1
    ? 0
    : index + 1;
}

function addBalance(userId, amount) {
  const user = ensureGlobalUser({
    id: userId
  });

  user.balance += Number(amount) || 0;

  if (user.balance < 0) {
    user.balance = 0;
  }

  saveDB();

  return user.balance;
}

function getBalance(userId) {
  const user = ensureGlobalUser({
    id: userId
  });

  return user.balance;
}

function adminOnly(ctx, next) {
  if (
    !ctx.chat ||
    ctx.chat.type === "private"
  ) {
    return next();
  }

  if (!requireAdminRank(ctx)) {
    return;
  }

  return next();
}

/*
  Middleware
*/
bot.use(async (ctx, next) => {
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

        time: Date.now()
      });

      if (chat.messageLog.length > 1000) {
        chat.messageLog.shift();
      }
    }

    saveDB();
  }

  return next();
});

/*
  START
*/
bot.start(async ctx => {
  ensureSubscriber(ctx.from.id);

  if (ctx.chat.type !== "private") {
    return;
  }

  await ctx.reply(
    `اهلا بك يا قلبي - ${mentionUser(ctx.from)}\n\n` +
    `• انا اشغل لك اللي تبي بالمكالمه\n\n` +
    `ادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.`,
    Markup.inlineKeyboard([
      [
        Markup.button.url(
          "أضفني في مجموعتك",
          `https://t.me/${ctx.botInfo.username}?startgroup=true`
        )
      ],
      [
        Markup.button.url(
          "المطور  (j4xa7 )",
          "https://t.me/j4xa7"
        )
      ]
    ])
  );
});

/*
  الرتبة
*/
bot.hears("رتبتي", async ctx => {
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
});

/*
  تفاعلي
*/
bot.hears("تفاعلي", async ctx => {
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
});

/*
  المتفاعلين
*/
bot.hears("المتفاعلين", async ctx => {
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

  const users =
    list.map(
      ([id, item], index) => {
        const member =
          chat.users[id];

        return (
          `${index + 1} - ` +
          `${member?.firstName || "المستخدم"}\n` +
          `النقاط: ${item.points || 0}\n` +
          `الرسائل: ${item.messages || 0}`
        );
      }
    );

  await ctx.reply(
    users.join("\n\n")
  );
});

/*
  رتبته
*/
bot.hears("رتبته", async ctx => {
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
});

/*
  تفاعله
*/
bot.hears("تفاعله", async ctx => {
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

  const rank =
    getRank(
      chat,
      target.id
    );

  await ctx.reply(
    `رتبته: ${RANK_DISPLAY[rank] || rank}\n` +
    `عدد رسائله: ${stats.messages}\n` +
    `ترتيبه: ${position}`
  );
});

/*
  الفلوس
*/
bot.hears(/^فلوسي$/i, async ctx => {
  await ctx.reply(
    `فلوسك: ${getBalance(ctx.from.id)} ريال`
  );
});

bot.hears(/^فلوسه$/i, async ctx => {
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
});

bot.hears(/^اهداء\s+(\d+)$/i, async ctx => {
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

  const senderBalance =
    getBalance(ctx.from.id);

  if (senderBalance < amount) {
    return ctx.reply(
      "رصيدك لا يكفي لإتمام العملية."
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

  ensureGlobalUser(
    ctx.from
  ).transfers.push({
    type: "send",
    targetId:
      String(target.id),
    amount,
    time: Date.now()
  });

  ensureGlobalUser(
    target
  ).transfers.push({
    type: "receive",
    userId:
      String(ctx.from.id),
    amount,
    time: Date.now()
  });

  saveDB();

  await ctx.reply(
    `تم إهداء ${amount} ريال إلى ` +
    `${
      target.username
        ? `@${target.username}`
        : target.first_name
    }`
  );
});

/*
  البنك
*/
bot.hears("حسابي", async ctx => {
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
});

bot.hears("حذف حسابي", async ctx => {
  const user =
    ensureGlobalUser(
      ctx.from
    );

  user.bank.active = false;
  user.bank.name = "";
  user.bank.accountNumber = "";

  saveDB();

  await ctx.reply(
    "تم حذف الحساب البنكي مع الحفاظ على بياناتك ورصيدك."
  );
});

bot.hears("المتجر", async ctx => {
  await ctx.reply(
    "المتجر\n\nلا توجد منتجات مضافة حاليًا."
  );
});

/*
  أمر ا
*/
bot.hears("ا", async ctx => {
  if (
    !requireRank(
      ctx,
      "Dev🎖️"
    )
  ) {
    return;
  }

  const target =
    getTargetFromReply(ctx);

  if (!target) {
    return ctx.reply(
      `معرفك: ${ctx.from.id}\n` +
      `اسمك: ${ctx.from.first_name || ""}\n` +
      `يوزرك: ${
        ctx.from.username
          ? `@${ctx.from.username}`
          : "لا يوجد"
      }`
    );
  }

  const chat =
    ensureChat(ctx.chat.id);

  const member =
    ensureChatUser(
      chat,
      target
    );

  const rank =
    getRank(
      chat,
      target.id
    );

  const balance =
    getBalance(target.id);

  await ctx.reply(
    `معلومات العضو\n\n` +
    `الاسم: ${target.first_name || ""}\n` +
    `اليوزر: ${
      target.username
        ? `@${target.username}`
        : "لا يوجد"
    }\n` +
    `المعرف: ${target.id}\n` +
    `الرتبة: ${
      RANK_DISPLAY[rank] || rank
    }\n` +
    `الرصيد: ${balance} ريال\n` +
    `الرسائل: ${member?.messages || 0}`
  );
});

/*
  أمر ت
*/
bot.hears("ت", async ctx => {
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

  const users =
    getInteractionRanking(chat)
      .slice(0, 20);

  if (!users.length) {
    return ctx.reply(
      "لا توجد بيانات تفاعل."
    );
  }

  await ctx.reply(
    users
      .map(
        ([id, item], index) => {
          const user =
            chat.users[id];

          return (
            `${index + 1} - ` +
            `${user?.firstName || "المستخدم"} - ` +
            `${item.points || 0}`
          );
        }
      )
      .join("\n")
  );
});

/*
  أمر ق
*/
bot.hears("ق", async ctx => {
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

  await ctx.reply(
    `حالة الحماية: ${
      chat.settings.protection
        ? "مفعلة"
        : "معطلة"
    }\n` +
    `الحماية التلقائية: ${
      chat.settings.automaticProtection
        ? "مفعلة"
        : "معطلة"
    }\n` +
    `الإنذارات: ${
      chat.settings.warningsEnabled
        ? "مفعلة"
        : "معطلة"
    }`
  );
});

/*
  أمر م
*/
bot.hears("م", async ctx => {
  if (
    !requireRank(
      ctx,
      "Dev🎖️"
    )
  ) {
    return;
  }

  const info =
    await ctx.telegram.getChat(
      ctx.chat.id
    );

  await ctx.reply(
    `اسم القروب: ${info.title || ""}\n` +
    `المعرف: ${info.id}\n` +
    `النوع: ${info.type}`
  );
});

/*
  أمر ح
*/
bot.hears("ح", async ctx => {
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
});

/*
  أمر د
*/
bot.hears("د", async ctx => {
  if (
    !requireRank(
      ctx,
      "Dev🎖️"
    )
  ) {
    return;
  }

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
      "تعذر إنشاء رابط القروب. تأكد من صلاحيات البوت."
    );
  }
});

/*
  المنشن
*/
bot.hears("فتح المنشن", async ctx => {
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
});

bot.hears("غلق المنشن", async ctx => {
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
});

/*
  المخالفات
*/
bot.hears("فتح المخالفات", async ctx => {
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
});

bot.hears("قفل المخالفات", async ctx => {
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
});

/*
  الحماية
*/
bot.hears("تفعيل الحماية", async ctx => {
  if (!requireAdminRank(ctx)) {
    return;
  }

  const chat =
    ensureChat(ctx.chat.id);

  chat.settings.protection = true;

  saveDB();

  await ctx.reply(
    "تم تفعيل الحماية."
  );
});

bot.hears("تعطيل الحماية", async ctx => {
  if (!requireAdminRank(ctx)) {
    return;
  }

  const chat =
    ensureChat(ctx.chat.id);

  chat.settings.protection = false;

  saveDB();

  await ctx.reply(
    "تم تعطيل الحماية."
  );
});

bot.hears("حالة الحماية", async ctx => {
  if (!requireAdminRank(ctx)) {
    return;
  }

  const chat =
    ensureChat(ctx.chat.id);

  await ctx.reply(
    `الحماية: ${
      chat.settings.protection
        ? "مفعلة"
        : "معطلة"
    }\n` +
    `الحماية التلقائية: ${
      chat.settings.automaticProtection
        ? "مفعلة"
        : "معطلة"
    }\n` +
    `منع الروابط: ${
      chat.settings.preventLinks
        ? "مفعل"
        : "معطل"
    }\n` +
    `منع التعديل: ${
      chat.settings.preventEdits
        ? "مفعل"
        : "معطل"
    }\n` +
    `منع التكرار: ${
      chat.settings.preventSpam
        ? "مفعل"
        : "معطل"
    }`
  );
});

bot.hears(
  "تفعيل الحماية التلقائية",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.automaticProtection =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل الحماية التلقائية."
    );
  }
);

bot.hears(
  "تعطيل الحماية التلقائية",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.automaticProtection =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل الحماية التلقائية."
    );
  }
);

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
      if (!requireAdminRank(ctx)) {
        return;
      }

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
      if (!requireAdminRank(ctx)) {
        return;
      }

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

/*
  الإنذارات
*/
bot.hears(
  "تفعيل الإنذارات",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.warningsEnabled =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل الإنذارات."
    );
  }
);

bot.hears(
  "تعطيل الإنذارات",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.warningsEnabled =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل الإنذارات."
    );
  }
);

bot.hears(
  /^عدد الإنذارات(?:\s+(\d+))?$/i,
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

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

    chat.settings.warningLimit =
      count;

    saveDB();

    await ctx.reply(
      `تم تحديد عدد الإنذارات إلى ${count}.`
    );
  }
);

bot.hears(
  "مسح الإنذارات",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.warnings = {};

    for (
      const user
      of Object.values(chat.users)
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
    if (!requireAdminRank(ctx)) {
      return;
    }

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
    if (!requireAdminRank(ctx)) {
      return;
    }

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
    if (!requireAdminRank(ctx)) {
      return;
    }

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
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.autoBan = false;

    saveDB();

    await ctx.reply(
      "تم تعطيل الحظر التلقائي."
    );
  }
);

/*
  الكتم
*/
bot.hears("كتم", async ctx => {
  if (!requireRank(ctx, "Myth")) {
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

    chat.muted[
      String(target.id)
    ] = true;

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
});

bot.hears(
  "فك كتم",
  async ctx => {
    if (!requireRank(ctx, "Myth")) {
      return;
    }

    const target =
      replyRequired(ctx);

    if (!target) return;

    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        target.id,
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
          can_change_info: false,
          can_invite_users: true,
          can_pin_messages: false,
          can_manage_topics: false
        }
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
        "تعذر فك الكتم. تأكد من صلاحيات البوت."
      );
    }
  }
);

/*
  الكتم العام
*/
bot.hears("عام", async ctx => {
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
    ] = true;

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
});

bot.hears("خخ", async ctx => {
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
});

bot.hears("مم", async ctx => {
  if (!requireRank(ctx, "Myth")) {
    return;
  }

  const chat =
    ensureChat(ctx.chat.id);

  chat.muted = {};

  saveDB();

  await ctx.reply(
    "تم مسح المكتومين."
  );
});

bot.hears(
  "مسح المكتومين",
  async ctx => {
    if (!requireRank(ctx, "Myth")) {
      return;
    }

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

/*
  التقييد
*/
bot.hears("تقييد", async ctx => {
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
    ] = true;

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
      "تعذر تقييد العضو. تأكد من صلاحيات البوت."
    );
  }
});

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
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        target.id,
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
          can_invite_users: true
        }
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

/*
  الحظر
*/
bot.hears("حظر", async ctx => {
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
      "تعذر حظر العضو. تأكد من صلاحيات البوت."
    );
  }
});

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

/*
  الطرد
*/
bot.hears("طرد", async ctx => {
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
});

/*
  التحذير
*/
bot.hears(
  "تحذير",
  async ctx => {
    if (!requireRank(ctx, "Myth")) {
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

    const chat =
      ensureChat(ctx.chat.id);

    const id =
      String(target.id);

    chat.warnings[id] =
      Number(chat.warnings[id] || 0) + 1;

    if (!chat.users[id]) {
      ensureChatUser(
        chat,
        target
      );
    }

    chat.users[id].warnings =
      chat.warnings[id];

    logAdmin(
      chat,
      ctx.from.id,
      "تحذير",
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

        chat.muted[id] = true;
      } catch {}
    }

    saveDB();

    await ctx.reply(
      `تم تحذير ${mentionUser(target)}\n` +
      `عدد الإنذارات: ${count}`
    );
  }
);

bot.hears(
  "الغاء التحذير",
  async ctx => {
    if (!requireRank(ctx, "Myth")) {
      return;
    }

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
    if (!requireRank(ctx, "Myth")) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.warnings = {};

    for (
      const user
      of Object.values(chat.users)
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

/*
  حماية الدخول
*/
bot.hears(
  "تفعيل حماية الدخول",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.entryProtection =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل حماية الدخول."
    );
  }
);

bot.hears(
  "تعطيل حماية الدخول",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.entryProtection =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل حماية الدخول."
    );
  }
);

bot.hears(
  "تفعيل حماية البوتات",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.botProtection =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل حماية البوتات."
    );
  }
);

bot.hears(
  "تعطيل حماية البوتات",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.botProtection =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل حماية البوتات."
    );
  }
);

bot.hears(
  "تفعيل حماية الحسابات الجديدة",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.newAccountProtection =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل حماية الحسابات الجديدة."
    );
  }
);

bot.hears(
  "تعطيل حماية الحسابات الجديدة",
  async ctx => {
    if (!requireAdminRank(ctx)) {
      return;
    }

    const chat =
      ensureChat(ctx.chat.id);

    chat.settings.newAccountProtection =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل حماية الحسابات الجديدة."
    );
  }
);

/*
  البوت
*/
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

/*
  الردود
*/
bot.hears(
  "تفعيل الردود",
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

    chat.settings.repliesEnabled =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل الردود."
    );
  }
);

bot.hears(
  "تعطيل الردود",
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

    chat.settings.repliesEnabled =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل الردود."
    );
  }
);

/*
  البنك
*/
bot.hears(
  "تفعيل البنك",
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

    chat.settings.bankEnabled =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل البنك."
    );
  }
);

bot.hears(
  "تعطيل البنك",
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

    chat.settings.bankEnabled =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل البنك."
    );
  }
);

/*
  التواصل
*/
bot.hears(
  "تفعيل التواصل",
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

    chat.settings.communicationEnabled =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل التواصل."
    );
  }
);

bot.hears(
  "تعطيل التواصل",
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

    chat.settings.communicationEnabled =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل التواصل."
    );
  }
);

/*
  الاشتراك الاجباري
*/
bot.hears(
  "تفعيل الاشتراك الاجباري",
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

    chat.settings.forcedSubscription =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل الاشتراك الاجباري."
    );
  }
);

bot.hears(
  "تعطيل الاشتراك الاجباري",
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

    chat.settings.forcedSubscription =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل الاشتراك الاجباري."
    );
  }
);

/*
  بوت الخدمة
*/
bot.hears(
  "تفعيل بوت الخدمة",
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

    chat.settings.serviceBot =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل بوت الخدمة."
    );
  }
);

bot.hears(
  "تعطيل بوت الخدمة",
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

    chat.settings.serviceBot =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل بوت الخدمة."
    );
  }
);

/*
  الاحصائيات
*/
bot.hears(
  "تفعيل الاحصائيات",
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

    chat.settings.statsEnabled =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل الاحصائيات."
    );
  }
);

bot.hears(
  "تعطيل الاحصائيات",
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

    chat.settings.statsEnabled =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل الاحصائيات."
    );
  }
);

/*
  الزاجل
*/
bot.hears(
  "تفعيل الزاجل",
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

    chat.settings.zajelEnabled =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل الزاجل."
    );
  }
);

bot.hears(
  "تعطيل الزاجل",
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

    chat.settings.zajelEnabled =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل الزاجل."
    );
  }
);

/*
  التنسيقات
*/
bot.hears(
  "تفعيل التنسيقات",
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

    chat.settings.formatsEnabled =
      true;

    saveDB();

    await ctx.reply(
      "تم تفعيل التنسيقات."
    );
  }
);

bot.hears(
  "تعطيل التنسيقات",
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

    chat.settings.formatsEnabled =
      false;

    saveDB();

    await ctx.reply(
      "تم تعطيل التنسيقات."
    );
  }
);

/*
  الألعاب
*/
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

    chat.settings.gamesClosed =
      true;

    chat.games.active = null;
    chat.ahkam = null;

    saveDB();

    await ctx.reply(
      "• تم قفل الألعاب\n" +
      "• لا يمكن للأعضاء بدء أو المشاركة في الألعاب حاليًا"
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

    chat.settings.gamesClosed =
      false;

    saveDB();

    await ctx.reply(
      "• تم فتح الألعاب\n" +
      "• يمكن للأعضاء اللعب والمشاركة الآن"
    );
  }
);

/*
  صلاحياتي
*/
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

      if (
        member.status ===
        "creator"
      ) {
        return ctx.reply(
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

      await ctx.reply(
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
    } catch {
      await ctx.reply(
        "تعذر جلب صلاحياتك الحالية."
      );
    }
  }
);

/*
  صلاحياته
*/
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
          "صلاحياتك عضو بالقروب"
        );
      }

      if (
        member.status ===
        "creator"
      ) {
        return ctx.reply(
          "• صلاحياته بالإشراف :\n" +
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

      await ctx.reply(
        "• صلاحياته بالإشراف :\n" +
        "━━━━━━━━━━━\n" +
        `• تغيير المعلومات ↤︎ ${yes(member.can_change_info)}\n` +
        `• تثبيت الرسائل ↤︎ ${yes(member.can_pin_messages)}\n` +
        `• ادارة المواضيع ↤︎ ${yes(member.can_manage_topics)}\n` +
        `• اضافه مستخدمين ↤︎ ${yes(member.can_invite_users)}\n` +
        `• مسح الرسائل ↤︎ ${yes(member.can_delete_messages)}\n` +
        `• حظر المستخدمين ↤︎ ${yes(member.can_restrict_members)}\n` +
        `• اضافه المشرفين ↤︎ ${yes(member.can_promote_members)}`
      );
    } catch {
      await ctx.reply(
        "تعذر جلب صلاحيات العضو."
      );
    }
  }
);

/*
  الألقاب
*/
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
      `لقبك علامة السهم المحدده و اللقب ${user?.title || "لا يوجد"}`
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
      `لقبه علامة السهم المحدده و اللقب ${user?.title || "لا يوجد"}`
    );
  }
);

/*
  ضع لقب
*/
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
        "تعذر تغيير اللقب. يجب أن يكون العضو مشرفًا، ويجب أن يملك البوت صلاحية تعديل المشرفين."
      );
    }
  }
);

/*
  الأوامر
*/
bot.hears(
  "اوامر",
  async ctx => {
    await ctx.reply(
      "اختر القسم:",
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "المطور",
            "HELP_DEV"
          ),
          Markup.button.callback(
            "الرتب",
            "HELP_RANKS"
          )
        ],
        [
          Markup.button.callback(
            "الحماية",
            "HELP_PROTECTION"
          ),
          Markup.button.callback(
            "التفاعل والألعاب والفعاليات",
            "HELP_GAMES"
          )
        ],
        [
          Markup.button.callback(
            "الهمسات والأغاني",
            "HELP_MUSIC"
          ),
          Markup.button.callback(
            "الأوامر المخصصة",
            "HELP_CUSTOM"
          )
        ],
        [
          Markup.button.callback(
            "القروب",
            "HELP_GROUP"
          )
        ]
      ])
    );
  }
);

const HELP_SECTIONS = {
  HELP_DEV:
    "المطور\n\n" +
    "ا\n" +
    "ت\n" +
    "ق\n" +
    "م\n" +
    "ن\n" +
    "ح\n" +
    "د\n\n" +
    "أوامر إعدادات البوت وإدارة المطورين والقروبات والقنوات.",

  HELP_RANKS:
    "الرتب\n\n" +
    "مميز\n" +
    "رفع مميز\n" +
    "مالك\n" +
    "رفع مالك\n" +
    "مالك اساسي\n" +
    "رفع اساس\n" +
    "myth\n" +
    "رفع M\n" +
    "Myth🎖️\n" +
    "رفع My\n" +
    "رفع اكس\n" +
    "Dev²\n" +
    "رفع ديف\n" +
    "Dev\n" +
    "رفع مطور ثانوي",

  HELP_PROTECTION:
    "الحماية\n\n" +
    "تفعيل الحماية\n" +
    "تعطيل الحماية\n" +
    "حالة الحماية\n" +
    "تفعيل الحماية التلقائية\n" +
    "تعطيل الحماية التلقائية\n" +
    "كتم\n" +
    "فك كتم\n" +
    "عام\n" +
    "خخ\n" +
    "تقييد\n" +
    "الغاء التقييد\n" +
    "حظر\n" +
    "فك الحظر\n" +
    "طرد\n" +
    "تحذير\n" +
    "الغاء التحذير\n" +
    "تنظيف\n" +
    "تنظيف 10\n" +
    "مسح المخالفات",

  HELP_GAMES:
    "التفاعل والألعاب والفعاليات\n\n" +
    "تفاعلي\n" +
    "المتفاعلين\n" +
    "رتبتي\n" +
    "رتبته\n" +
    "تفاعله\n" +
    "العاب\n" +
    "صور\n" +
    "كلمة\n" +
    "ترتيب\n" +
    "مقال\n" +
    "جملة\n" +
    "حروف\n" +
    "خمن\n" +
    "لغز\n" +
    "صح أو خطأ\n" +
    "أكمل\n" +
    "مقلوب\n" +
    "فكك\n" +
    "إيموجي\n" +
    "سرعة\n" +
    "حساب\n" +
    "ذاكرة\n" +
    "من أنا\n" +
    "كلمة السر\n" +
    "قفل الالعاب\n" +
    "فتح الالعاب\n" +
    "احكام\n" +
    "انهاء احكام",

  HELP_MUSIC:
    "الهمسات والأغاني\n\n" +
    "اهمس\n" +
    "همسه\n" +
    "ه\n" +
    "رؤية الهمسة\n" +
    "رد على الهمسة\n\n" +
    "بحث أغنية + اسم الأغنية\n" +
    "تشغيل + اسم الأغنية\n" +
    "إيقاف\n" +
    "استئناف\n" +
    "تخطي\n" +
    "إلغاء\n" +
    "الأغنية\n" +
    "قائمة التشغيل\n" +
    "مسح القائمة",

  HELP_CUSTOM:
    "الأوامر المخصصة\n\n" +
    "اضف امر\n" +
    "حذف امر\n" +
    "اوامري\n" +
    "اضف رد\n" +
    "حذف رد\n" +
    "ردودي\n" +
    "اضف قناة\n" +
    "قناتي\n" +
    "تعديل قناتي\n" +
    "حذف قناتي\n" +
    "منع الكلمه\n" +
    "الغاء منع الكلمه\n" +
    "الكلمات الممنوعه\n" +
    "مسح الكلمات الممنوعه",

  HELP_GROUP:
    "القروب\n\n" +
    "قروب\n" +
    "القوانين\n" +
    "المالك\n" +
    "صلاحياتي\n" +
    "صلاحياته\n" +
    "لقبي\n" +
    "لقبه"
};

for (
  const [action, text]
  of Object.entries(HELP_SECTIONS)
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
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "المطور",
            "HELP_DEV"
          ),
          Markup.button.callback(
            "الرتب",
            "HELP_RANKS"
          )
        ],
        [
          Markup.button.callback(
            "الحماية",
            "HELP_PROTECTION"
          ),
          Markup.button.callback(
            "التفاعل والألعاب والفعاليات",
            "HELP_GAMES"
          )
        ],
        [
          Markup.button.callback(
            "الهمسات والأغاني",
            "HELP_MUSIC"
          ),
          Markup.button.callback(
            "الأوامر المخصصة",
            "HELP_CUSTOM"
          )
        ],
        [
          Markup.button.callback(
            "القروب",
            "HELP_GROUP"
          )
        ]
      ])
    );
  }
);

/*
  الأخطاء
*/
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

process.once(
  "SIGINT",
  () => bot.stop("SIGINT")
);

process.once(
  "SIGTERM",
  () => bot.stop("SIGTERM")
);

/*
  تشغيل البوت
*/
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
