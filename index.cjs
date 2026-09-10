const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) throw new Error("BOT_TOKEN غير موجود");

const bot = new Telegraf(TOKEN);
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
  "myth": "Myth",
  "myth 🎖️": "Myth 🎖️",
  "myth🎖️": "Myth 🎖️",
  "dev²": "Dev²🎖️",
  "dev²🎖️": "Dev²🎖️",
  "dev2": "Dev²🎖️",
  "dev": "Dev🎖️",
  "dev🎖️": "Dev🎖️"
};

const DEV_IDS = (process.env.DEV_IDS || "")
  .split(",")
  .map(x => x.trim())
  .filter(Boolean);

const DEV_USERNAMES = (
  process.env.DEV_USERNAMES || "j4xa7"
)
  .split(",")
  .map(x =>
    x.trim().replace(/^@/, "").toLowerCase()
  )
  .filter(Boolean);

const ADMIN_SESSION_TIME = 5 * 60 * 1000;

const adminSessions = new Map();
const pending = new Map();

let BOT_ID = null;
let BOT_USERNAME = "";

/* =========================================================
   قاعدة البيانات
========================================================= */

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const db = JSON.parse(
        fs.readFileSync(DB_FILE, "utf8")
      );

      if (!db.chats) db.chats = {};
      if (!db.users) db.users = {};
      if (!db.globalSubscribers)
        db.globalSubscribers = [];
      if (!db.devIds) db.devIds = [];
      if (!db.whispers) db.whispers = {};
      if (!db.marriages) db.marriages = {};
      if (!db.banks) db.banks = {};

      if (DEV_IDS.length) {
        db.devIds = [
          ...new Set([
            ...db.devIds.map(String),
            ...DEV_IDS.map(String)
          ])
        ];
      }

      return db;
    }
  } catch (e) {
    console.error("DB:", e.message);
  }

  return {
    chats: {},
    users: {},
    globalSubscribers: DEV_IDS.map(String),
    devIds: DEV_IDS.map(String),
    whispers: {},
    marriages: {},
    banks: {}
  };
}

function saveDB(db) {
  try {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(db, null, 2)
    );
  } catch (e) {
    console.error("DB SAVE:", e.message);
  }
}

function getChat(db, chatId) {
  chatId = String(chatId);

  if (!db.chats[chatId]) {
    db.chats[chatId] = {
      users: {},
      settings: {
        allMention: true,
        gamesClosed: false,
        bannedWords: [],
        repliesEnabled: true,
        botReplies: true,
        bankEnabled: true,
        communicationEnabled: true,
        forcedSubscription: false,
        forcedSubscriptionChannel: "",
        serviceBot: true,
        statsEnabled: true,
        zajelEnabled: true,
        formatsEnabled: true,
        memberCount: 0
      },
      customCommands: {},
      customReplies: {},
      channels: {},
      activeAhkam: null,
      games: {},
      stats: {},
      messageLog: []
    };
  }

  const chat = db.chats[chatId];

  if (!chat.users) chat.users = {};
  if (!chat.settings) chat.settings = {};
  if (!chat.customCommands) chat.customCommands = {};
  if (!chat.customReplies) chat.customReplies = {};
  if (!chat.channels) chat.channels = {};
  if (!chat.games) chat.games = {};
  if (!chat.stats) chat.stats = {};
  if (!Array.isArray(chat.messageLog))
    chat.messageLog = [];

  const defaults = {
    allMention: true,
    gamesClosed: false,
    bannedWords: [],
    repliesEnabled: true,
    botReplies: true,
    bankEnabled: true,
    communicationEnabled: true,
    forcedSubscription: false,
    forcedSubscriptionChannel: "",
    serviceBot: true,
    statsEnabled: true,
    zajelEnabled: true,
    formatsEnabled: true,
    memberCount: 0
  };

  for (const [key, value] of Object.entries(defaults)) {
    if (chat.settings[key] === undefined) {
      chat.settings[key] = value;
    }
  }

  if (!Array.isArray(chat.settings.bannedWords)) {
    chat.settings.bannedWords = [];
  }

  return chat;
}

function getGlobalUser(db, userId) {
  userId = String(userId);

  if (!db.users[userId]) {
    db.users[userId] = {
      balance: 0,
      bank: null,
      accountNumber: null,
      bankActive: false,
      purchases: [],
      transfers: []
    };
  }

  const user = db.users[userId];

  if (!Array.isArray(user.purchases))
    user.purchases = [];

  if (!Array.isArray(user.transfers))
    user.transfers = [];

  if (typeof user.balance !== "number")
    user.balance = 0;

  return user;
}

function registerUser(db, chatId, user) {
  if (!user || !user.id) return;

  const chat = getChat(db, chatId);
  const id = String(user.id);

  if (!chat.users[id]) {
    chat.users[id] = {
      rank: "عضو",
      tag: "",
      messages: 0,
      points: 0,
      married: [],
      title: "",
      username: "",
      firstName: ""
    };
  }

  chat.users[id].username =
    user.username ||
    chat.users[id].username ||
    "";

  chat.users[id].firstName =
    user.first_name ||
    chat.users[id].firstName ||
    "";

  getGlobalUser(db, id);
}

/* =========================================================
   المطور والرتب
========================================================= */

function isDev(db, userId, username = null) {
  const id = String(userId);

  if (
    DEV_IDS.map(String).includes(id) ||
    (db.devIds || []).map(String).includes(id)
  ) {
    return true;
  }

  const name =
    username ||
    db.users?.[id]?.username ||
    "";

  return DEV_USERNAMES.includes(
    String(name)
      .replace(/^@/, "")
      .toLowerCase()
  );
}

function rankValue(rank) {
  return RANKS[rank] ?? 0;
}

function getRank(
  db,
  chatId,
  userId,
  username = null
) {
  if (isDev(db, userId, username)) {
    return "Dev🎖️";
  }

  const chat = getChat(db, chatId);

  return (
    chat.users[String(userId)]?.rank ||
    "عضو"
  );
}

function hasRank(
  db,
  chatId,
  userId,
  required
) {
  return (
    rankValue(
      getRank(db, chatId, userId)
    ) >= rankValue(required)
  );
}

function normalizeRank(text) {
  const clean = String(text)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  return RANK_ALIASES[clean] || null;
}

function canTarget(
  db,
  chatId,
  actorId,
  targetId
) {
  actorId = String(actorId);
  targetId = String(targetId);

  if (actorId === targetId) return false;

  if (isDev(db, targetId)) {
    return isDev(db, actorId);
  }

  return (
    rankValue(
      getRank(db, chatId, actorId)
    ) >
    rankValue(
      getRank(db, chatId, targetId)
    )
  );
}

/* =========================================================
   أدوات
========================================================= */

function requireReply(ctx) {
  return !!ctx.message?.reply_to_message?.from;
}

function escapeMarkdown(text) {
  return String(text).replace(
    /([_*\[\]()~`>#+\-=|{}.!])/g,
    "\\$1"
  );
}

function mention(user) {
  return `[${escapeMarkdown(
    user.first_name || "العضو"
  )}](tg://user?id=${user.id})`;
}

function makeReply(ctx) {
  const originalReply = ctx.reply.bind(ctx);

  return async (text, extra = {}) => {
    if (
      ctx.chat &&
      ctx.chat.type !== "private" &&
      ctx.message?.message_id
    ) {
      extra = {
        ...extra,
        reply_parameters: {
          ...(extra.reply_parameters || {}),
          message_id: ctx.message.message_id
        }
      };
    }

    return originalReply(text, extra);
  };
}

async function getBotId(ctx) {
  if (BOT_ID) return BOT_ID;

  try {
    const me = await ctx.telegram.getMe();
    BOT_ID = me.id;
    BOT_USERNAME = me.username || "";
    return BOT_ID;
  } catch {
    return null;
  }
}

function getMessageType(message) {
  if (message.text) return "text";
  if (message.photo) return "photo";
  if (message.video) return "video";
  if (message.sticker) return "sticker";
  if (message.animation) return "animation";
  if (message.audio) return "audio";
  if (message.voice) return "voice";
  if (message.document) return "document";
  if (message.video_note) return "video_note";
  return "other";
}

/* =========================================================
   حماية الرد على البوت
========================================================= */

bot.use(async (ctx, next) => {
  if (ctx.message?.reply_to_message?.from?.is_bot) {
    const botId = await getBotId(ctx);

    if (
      botId &&
      String(ctx.message.reply_to_message.from.id) ===
        String(botId)
    ) {
      ctx.reply = makeReply(ctx);
      return ctx.reply("ياغببي ذا البوت");
    }
  }

  if (ctx.message) {
    ctx.reply = makeReply(ctx);
  }

  return next();
});

/* =========================================================
   تسجيل الرسائل
========================================================= */

bot.on("message", async (ctx, next) => {
  if (!ctx.from) return next();

  const db = loadDB();

  if (ctx.chat.type !== "private") {
    registerUser(
      db,
      ctx.chat.id,
      ctx.from
    );

    const chat = getChat(
      db,
      ctx.chat.id
    );

    const user =
      chat.users[String(ctx.from.id)];

    user.messages =
      (user.messages || 0) + 1;

    user.points =
      (user.points || 0) + 1;

    chat.messageLog.push({
      id: ctx.message.message_id,
      type: getMessageType(ctx.message),
      userId: String(ctx.from.id),
      createdAt: Date.now()
    });

    if (chat.messageLog.length > 1000) {
      chat.messageLog =
        chat.messageLog.slice(-1000);
    }

    saveDB(db);
  }

  if (ctx.chat.type === "private") {
    const id = String(ctx.from.id);

    getGlobalUser(db, id);

    if (!db.globalSubscribers.map(String).includes(id)) {
      db.globalSubscribers.push(id);
      saveDB(db);
    }
  }

  return next();
});

/* =========================================================
   رفع وتنزيل الرتب
========================================================= */

async function changeRank(ctx) {
  if (ctx.chat.type === "private") return;

  if (!requireReply(ctx)) {
    return ctx.reply(
      "يجب استخدام الأمر بالرد على العضو."
    );
  }

  const parts =
    ctx.message.text.trim().split(/\s+/);

  const action = parts.shift();
  const requestedRank =
    normalizeRank(parts.join(" "));

  if (!requestedRank) {
    return ctx.reply("الرتبة غير صحيحة.");
  }

  const db = loadDB();

  registerUser(
    db,
    ctx.chat.id,
    ctx.from
  );

  const target =
    ctx.message.reply_to_message.from;

  const actorId = String(ctx.from.id);
  const targetId = String(target.id);

  if (actorId === targetId) {
    return ctx.reply(
      "لا يمكنك تعديل رتبتك."
    );
  }

  try {
    const member =
      await ctx.telegram.getChatMember(
        ctx.chat.id,
        targetId
      );

    if (member.status === "creator") {
      return ctx.reply(
        "لا يمكن تعديل مالك القروب."
      );
    }
  } catch {}

  const actorRank = getRank(
    db,
    ctx.chat.id,
    actorId,
    ctx.from.username
  );

  const targetRank = getRank(
    db,
    ctx.chat.id,
    targetId,
    target.username
  );

  if (
    !canTarget(
      db,
      ctx.chat.id,
      actorId,
      targetId
    )
  ) {
    return ctx.reply(
      "لا يمكنك تعديل رتبة مساوية أو أعلى منك."
    );
  }

  const actorIsDev = isDev(
    db,
    actorId,
    ctx.from.username
  );

  if (
    (requestedRank === "Dev²🎖️" ||
      requestedRank === "Dev🎖️") &&
    !actorIsDev
  ) {
    return ctx.reply(
      "• هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
    );
  }

  if (
    rankValue(requestedRank) >=
      rankValue(actorRank) &&
    !actorIsDev
  ) {
    return ctx.reply(
      "لا يمكنك إعطاء رتبة مساوية أو أعلى من رتبتك."
    );
  }

  if (requestedRank === targetRank) {
    return ctx.reply(
      "العضو لديه هذه الرتبة بالفعل."
    );
  }

  const chat = getChat(
    db,
    ctx.chat.id
  );

  registerUser(
    db,
    ctx.chat.id,
    target
  );

  chat.users[targetId].rank =
    requestedRank;

  saveDB(db);

  return ctx.reply(
    [
      action === "رفع" || action === "ترقية"
        ? "تم رفع الرتبة"
        : "تم تنزيل الرتبة",
      `• العضو ↤︎ ${target.first_name || "العضو"}`,
      `• الرتبة ↤︎ ${requestedRank}`
    ].join("\n")
  );
}

bot.hears(
  /^(رفع|ترقية) (.+)$/i,
  changeRank
);

bot.hears(
  /^(تنزيل|خفض) (.+)$/i,
  changeRank
);

/* =========================================================
   صلاحيات المشرفين
========================================================= */

const TELEGRAM_GROUP_RIGHTS = [
  ["is_anonymous", "إخفاء هوية المشرف"],
  ["can_manage_chat", "إدارة المجموعة"],
  ["can_delete_messages", "حذف الرسائل"],
  ["can_manage_video_chats", "إدارة المكالمات"],
  ["can_restrict_members", "تقييد المستخدمين"],
  ["can_promote_members", "إضافة مشرفين"],
  ["can_change_info", "تعديل معلومات المجموعة"],
  ["can_invite_users", "دعوة المستخدمين"],
  ["can_pin_messages", "تثبيت الرسائل"],
  ["can_manage_topics", "إدارة الموضوعات"],
  ["can_manage_tags", "إدارة العلامات"],
  ["can_send_welcome_messages", "إدارة رسائل الترحيب"],
  ["can_post_stories", "نشر القصص"],
  ["can_edit_stories", "تعديل القصص"],
  ["can_delete_stories", "حذف القصص"]
];

function defaultAdminRights() {
  const rights = {};

  for (const [key] of TELEGRAM_GROUP_RIGHTS) {
    rights[key] = false;
  }

  return rights;
}

function adminKeyboard(session) {
  const rows = [];

  for (const [key, label] of TELEGRAM_GROUP_RIGHTS) {
    rows.push([
      Markup.button.callback(
        `${label}: ${
          session.permissions[key] ? "نعم" : "لا"
        }`,
        `adm_toggle:${key}`
      )
    ]);
  }

  rows.push([
    Markup.button.callback(
      "حفظ وتطبيق",
      "adm_save"
    )
  ]);

  rows.push([
    Markup.button.callback(
      "إخفاء الأمر",
      "adm_hide"
    )
  ]);

  return Markup.inlineKeyboard(rows);
}

bot.hears(
  /^(رفع مشرف|ترقيه)$/i,
  async ctx => {
    if (ctx.chat.type === "private") return;

    if (!requireReply(ctx)) {
      return ctx.reply(
        "يجب استخدام الأمر بالرد على العضو."
      );
    }

    const db = loadDB();

    const actorId = String(ctx.from.id);
    const target =
      ctx.message.reply_to_message.from;
    const targetId = String(target.id);

    if (actorId === targetId) {
      return ctx.reply(
        "لا يمكنك استهداف نفسك."
      );
    }

    registerUser(
      db,
      ctx.chat.id,
      ctx.from
    );

    registerUser(
      db,
      ctx.chat.id,
      target
    );

    if (
      !canTarget(
        db,
        ctx.chat.id,
        actorId,
        targetId
      )
    ) {
      return ctx.reply(
        "لا يمكنك تعديل رتبة مساوية أو أعلى منك."
      );
    }

    let actorMember;
    let targetMember;

    try {
      actorMember =
        await ctx.telegram.getChatMember(
          ctx.chat.id,
          actorId
        );

      targetMember =
        await ctx.telegram.getChatMember(
          ctx.chat.id,
          targetId
        );
    } catch {
      return ctx.reply(
        "تعذر التحقق من العضو أو صلاحيات المشرف."
      );
    }

    const canPromote =
      actorMember.status === "creator" ||
      (
        actorMember.status === "administrator" &&
        actorMember.can_promote_members === true
      );

    if (!canPromote) {
      return ctx.reply(
        "لا تملك صلاحية إضافة المشرفين."
      );
    }

    if (
      targetMember.status === "left" ||
      targetMember.status === "kicked"
    ) {
      return ctx.reply(
        "العضو غير موجود في القروب."
      );
    }

    if (targetMember.status === "creator") {
      return ctx.reply(
        "لا يمكن تعديل مالك القروب."
      );
    }

    adminSessions.set(ctx.from.id, {
      actorId,
      targetId,
      chatId: String(ctx.chat.id),
      createdAt: Date.now(),
      permissions: defaultAdminRights()
    });

    return ctx.reply(
      "صلاحيات المستخدم",
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "تعديل الصلاحيات",
            "adm_open"
          )
        ],
        [
          Markup.button.callback(
            "إخفاء الأمر",
            "adm_hide"
          )
        ]
      ])
    );
  }
);

async function validateAdminSession(ctx) {
  const session =
    adminSessions.get(ctx.from.id);

  if (!session) {
    await ctx.answerCbQuery(
      "لا توجد جلسة تعديل.",
      { show_alert: true }
    );
    return null;
  }

  if (
    Date.now() - session.createdAt >
    ADMIN_SESSION_TIME
  ) {
    adminSessions.delete(ctx.from.id);

    await ctx.answerCbQuery(
      "انتهت جلسة تعديل الصلاحيات.",
      { show_alert: true }
    );

    return null;
  }

  if (
    String(session.chatId) !==
    String(ctx.chat.id)
  ) {
    await ctx.answerCbQuery(
      "هذه الجلسة ليست لهذا القروب.",
      { show_alert: true }
    );
    return null;
  }

  if (
    String(session.actorId) !==
    String(ctx.from.id)
  ) {
    await ctx.answerCbQuery(
      "هذه الجلسة ليست لك.",
      { show_alert: true }
    );
    return null;
  }

  const db = loadDB();

  if (
    !canTarget(
      db,
      session.chatId,
      session.actorId,
      session.targetId
    )
  ) {
    adminSessions.delete(ctx.from.id);

    await ctx.answerCbQuery(
      "لم تعد تملك صلاحية تعديل هذا العضو.",
      { show_alert: true }
    );

    return null;
  }

  try {
    const actor =
      await ctx.telegram.getChatMember(
        session.chatId,
        session.actorId
      );

    const target =
      await ctx.telegram.getChatMember(
        session.chatId,
        session.targetId
      );

    const canPromote =
      actor.status === "creator" ||
      (
        actor.status === "administrator" &&
        actor.can_promote_members === true
      );

    if (!canPromote) {
      adminSessions.delete(ctx.from.id);

      await ctx.answerCbQuery(
        "لم تعد تملك صلاحية إضافة المشرفين.",
        { show_alert: true }
      );

      return null;
    }

    if (target.status === "creator") {
      adminSessions.delete(ctx.from.id);

      await ctx.answerCbQuery(
        "لا يمكن تعديل مالك القروب.",
        { show_alert: true }
      );

      return null;
    }
  } catch {
    await ctx.answerCbQuery(
      "تعذر التحقق من الصلاحيات.",
      { show_alert: true }
    );
    return null;
  }

  session.createdAt = Date.now();

  return { db, session };
}

bot.action(
  "adm_open",
  async ctx => {
    const check =
      await validateAdminSession(ctx);

    if (!check) return;

    await ctx.editMessageText(
      "صلاحيات المستخدم\n\nاختر الصلاحيات التي تريد إعطاءها:",
      adminKeyboard(check.session)
    );

    await ctx.answerCbQuery();
  }
);

bot.action(
  /^adm_toggle:(.+)$/,
  async ctx => {
    const check =
      await validateAdminSession(ctx);

    if (!check) return;

    const key = ctx.match[1];

    if (
      !Object.prototype.hasOwnProperty.call(
        check.session.permissions,
        key
      )
    ) {
      return ctx.answerCbQuery(
        "هذه الصلاحية غير متاحة.",
        { show_alert: true }
      );
    }

    check.session.permissions[key] =
      !check.session.permissions[key];

    check.session.createdAt = Date.now();

    try {
      await ctx.editMessageReplyMarkup(
        adminKeyboard(check.session).reply_markup
      );
    } catch {}

    await ctx.answerCbQuery();
  }
);

bot.action(
  "adm_save",
  async ctx => {
    const check =
      await validateAdminSession(ctx);

    if (!check) return;

    const session = check.session;

    try {
      await ctx.telegram.promoteChatMember(
        session.chatId,
        session.targetId,
        {
          ...session.permissions
        }
      );

      adminSessions.delete(ctx.from.id);

      await ctx.editMessageText(
        "تم حفظ الصلاحيات وتطبيقها بنجاح."
      );

      return ctx.answerCbQuery(
        "تم التطبيق"
      );
    } catch (e) {
      console.error(
        "promoteChatMember:",
        e?.message || e
      );

      return ctx.answerCbQuery(
        "فشل تطبيق الصلاحيات في Telegram.",
        { show_alert: true }
      );
    }
  }
);

bot.action(
  "adm_hide",
  async ctx => {
    const session =
      adminSessions.get(ctx.from.id);

    if (!session) {
      return ctx.answerCbQuery(
        "انتهت الجلسة.",
        { show_alert: true }
      );
    }

    if (
      String(session.chatId) !==
        String(ctx.chat.id) ||
      String(session.actorId) !==
        String(ctx.from.id)
    ) {
      return ctx.answerCbQuery(
        "غير مسموح.",
        { show_alert: true }
      );
    }

    adminSessions.delete(ctx.from.id);

    await ctx.deleteMessage().catch(() => {});
    await ctx.answerCbQuery();
  }
);

/* =========================================================
   صلاحياتي / صلاحياته
========================================================= */

async function formatTelegramRights(member) {
  if (member.status === "creator") {
    return [
      "• صلاحياتك بالإشراف :",
      "━━━━━━━━━━━",
      "• تغيير المعلومات ↤︎ نعم",
      "• تثبيت الرسائل ↤︎ نعم",
      "• ادارة المواضيع ↤︎ نعم",
      "• اضافه مستخدمين ↤︎ نعم",
      "• مسح الرسائل ↤︎ نعم",
      "• حظر المستخدمين ↤︎ نعم",
      "• اضافه المشرفين ↤︎ نعم"
    ].join("\n");
  }

  const rights = [
    ["can_change_info", "تغيير المعلومات"],
    ["can_pin_messages", "تثبيت الرسائل"],
    ["can_manage_topics", "ادارة المواضيع"],
    ["can_invite_users", "اضافه مستخدمين"],
    ["can_delete_messages", "مسح الرسائل"],
    ["can_restrict_members", "حظر المستخدمين"],
    ["can_promote_members", "اضافه المشرفين"]
  ];

  return [
    "• صلاحياتك بالإشراف :",
    "━━━━━━━━━━━",
    ...rights.map(
      ([key, label]) =>
        `• ${label} ↤︎ ${
          member[key] === true ? "نعم" : "لا"
        }`
    )
  ].join("\n");
}

bot.hears(
  /^صلاحياتي$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    try {
      const member =
        await ctx.telegram.getChatMember(
          ctx.chat.id,
          ctx.from.id
        );

      if (
        member.status !== "administrator" &&
        member.status !== "creator"
      ) {
        return ctx.reply(
          "• صلاحياتك بالإشراف :\n━━━━━━━━━━━\n• عضو بالقروب"
        );
      }

      return ctx.reply(
        await formatTelegramRights(member)
      );
    } catch {
      return ctx.reply(
        "تعذر جلب صلاحياتك من Telegram."
      );
    }
  }
);

bot.hears(
  /^صلاحياته$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    if (!requireReply(ctx)) {
      return ctx.reply(
        "يجب الرد على العضو."
      );
    }

    const target =
      ctx.message.reply_to_message.from;

    try {
      const member =
        await ctx.telegram.getChatMember(
          ctx.chat.id,
          target.id
        );

      if (
        member.status !== "administrator" &&
        member.status !== "creator"
      ) {
        return ctx.reply(
          "صلاحياته عضو بالقروب"
        );
      }

      return ctx.reply(
        await formatTelegramRights(member)
      );
    } catch {
      return ctx.reply(
        "تعذر جلب صلاحيات العضو."
      );
    }
  }
);

/* =========================================================
   الكتم والحظر والطرد
========================================================= */

async function moderationCheck(
  ctx,
  targetId,
  requiredRank
) {
  const db = loadDB();

  registerUser(
    db,
    ctx.chat.id,
    ctx.from
  );

  if (
    !hasRank(
      db,
      ctx.chat.id,
      ctx.from.id,
      requiredRank
    )
  ) {
    return {
      ok: false,
      message:
        `• هذا الامر يخص ↤ ｢ ${requiredRank} ｣`
    };
  }

  if (
    String(ctx.from.id) ===
    String(targetId)
  ) {
    return {
      ok: false,
      message:
        "• لا يمكنك تنفيذ الأمر على نفسك."
    };
  }

  if (
    !canTarget(
      db,
      ctx.chat.id,
      ctx.from.id,
      targetId
    )
  ) {
    return {
      ok: false,
      message:
        "• لا يمكنك تنفيذ الأمر على رتبة مساوية أو أعلى."
    };
  }

  return {
    ok: true,
    db
  };
}

const OPEN_PERMISSIONS = {
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

bot.hears(
  /^كتم$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    if (!requireReply(ctx)) {
      return ctx.reply(
        "يجب الرد على العضو."
      );
    }

    const targetId =
      ctx.message.reply_to_message.from.id;

    const check =
      await moderationCheck(
        ctx,
        targetId,
        "Myth"
      );

    if (!check.ok)
      return ctx.reply(check.message);

    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        targetId,
        {
          permissions: {
            can_send_messages: false
          },
          use_independent_chat_permissions: true
        }
      );

      const chat =
        getChat(check.db, ctx.chat.id);

      registerUser(
        check.db,
        ctx.chat.id,
        ctx.message.reply_to_message.from
      );

      chat.users[String(targetId)].muted = true;

      saveDB(check.db);

      return ctx.reply(
        "تم كتم العضو."
      );
    } catch {
      return ctx.reply(
        "فشل الكتم، تأكد من صلاحيات البوت."
      );
    }
  }
);

bot.hears(
  /^فك الكتم$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    if (!requireReply(ctx)) {
      return ctx.reply(
        "يجب الرد على العضو."
      );
    }

    const targetId =
      ctx.message.reply_to_message.from.id;

    const check =
      await moderationCheck(
        ctx,
        targetId,
        "Myth"
      );

    if (!check.ok)
      return ctx.reply(check.message);

    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        targetId,
        {
          permissions: OPEN_PERMISSIONS,
          use_independent_chat_permissions: true
        }
      );

      const chat =
        getChat(check.db, ctx.chat.id);

      if (chat.users[String(targetId)]) {
        chat.users[String(targetId)].muted = false;
      }

      saveDB(check.db);

      return ctx.reply(
        "تم فك الكتم."
      );
    } catch {
      return ctx.reply(
        "فشل فك الكتم."
      );
    }
  }
);

bot.hears(
  /^حظر$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    if (!requireReply(ctx)) {
      return ctx.reply(
        "يجب الرد على العضو."
      );
    }

    const targetId =
      ctx.message.reply_to_message.from.id;

    const check =
      await moderationCheck(
        ctx,
        targetId,
        "Myth 🎖️"
      );

    if (!check.ok)
      return ctx.reply(check.message);

    try {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        targetId
      );

      return ctx.reply(
        "تم حظر العضو."
      );
    } catch {
      return ctx.reply(
        "فشل الحظر، تأكد من صلاحيات البوت."
      );
    }
  }
);

bot.hears(
  /^طرد$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    if (!requireReply(ctx)) {
      return ctx.reply(
        "يجب الرد على العضو."
      );
    }

    const targetId =
      ctx.message.reply_to_message.from.id;

    const check =
      await moderationCheck(
        ctx,
        targetId,
        "Myth"
      );

    if (!check.ok)
      return ctx.reply(check.message);

    try {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        targetId
      );

      await ctx.telegram.unbanChatMember(
        ctx.chat.id,
        targetId
      );

      return ctx.reply(
        "تم طرد العضو."
      );
    } catch {
      return ctx.reply(
        "فشل الطرد، تأكد من صلاحيات البوت."
      );
    }
  }
);

bot.hears(
  /^مم$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    if (
      !hasRank(
        db,
        ctx.chat.id,
        ctx.from.id,
        "Myth"
      )
    ) {
      return ctx.reply(
        "• هذا الامر يخص ↤ ｢ Myth ｣"
      );
    }

    const chat =
      getChat(db, ctx.chat.id);

    let count = 0;

    for (const [id, user] of Object.entries(chat.users)) {
      if (!user.muted) continue;

      try {
        await ctx.telegram.restrictChatMember(
          ctx.chat.id,
          id,
          {
            permissions: OPEN_PERMISSIONS,
            use_independent_chat_permissions: true
          }
        );

        user.muted = false;
        count++;
      } catch {}
    }

    saveDB(db);

    return ctx.reply(
      `تم فك كتم ${count} من المكتومين.`
    );
  }
);

/* =========================================================
   المنشن
========================================================= */

bot.hears(
  /^فتح المنشن$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    if (!isDev(db, ctx.from.id, ctx.from.username)) {
      return ctx.reply(
        "• هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
      );
    }

    getChat(db, ctx.chat.id).settings.allMention = true;
    saveDB(db);

    return ctx.reply("تم فتح المنشن.");
  }
);

bot.hears(
  /^غلق المنشن$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    if (!isDev(db, ctx.from.id, ctx.from.username)) {
      return ctx.reply(
        "• هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
      );
    }

    getChat(db, ctx.chat.id).settings.allMention = false;
    saveDB(db);

    return ctx.reply("تم غلق المنشن.");
  }
);

bot.hears(
  /^@all$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();
    const chat = getChat(db, ctx.chat.id);

    if (!chat.settings.allMention) return;

    const users = Object.entries(chat.users);

    if (!users.length) {
      return ctx.reply(
        "لا يوجد أعضاء مسجلون."
      );
    }

    let current = "";

    for (const [id, user] of users) {
      const name =
        escapeMarkdown(user.firstName || "عضو");

      const item =
        `[${name}](tg://user?id=${id}) `;

      if ((current + item).length > 3500) {
        await ctx.reply(current, {
          parse_mode: "Markdown"
        });

        current = "";
      }

      current += item;
    }

    if (current) {
      await ctx.reply(current, {
        parse_mode: "Markdown"
      });
    }
  }
);

/* =========================================================
   الألقاب
========================================================= */

bot.hears(
  /^رتبتي$/,
  async ctx => {
    if (ctx.chat.type === "private") {
      return ctx.reply(
        "هذا الأمر داخل القروب فقط."
      );
    }

    const db = loadDB();

    registerUser(
      db,
      ctx.chat.id,
      ctx.from
    );

    const rank =
      getRank(
        db,
        ctx.chat.id,
        ctx.from.id,
        ctx.from.username
      );

    const user =
      getChat(db, ctx.chat.id).users[
        String(ctx.from.id)
      ];

    return ctx.reply(
      [
        `• رتبتك ↤︎ ${rank}`,
        `• لقبك ↤︎ ${user.title || "لا يوجد"}`
      ].join("\n")
    );
  }
);

bot.hears(
  /^رتبته$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    if (!requireReply(ctx)) {
      return ctx.reply(
        "يجب الرد على العضو."
      );
    }

    const db = loadDB();
    const target =
      ctx.message.reply_to_message.from;

    registerUser(
      db,
      ctx.chat.id,
      target
    );

    const rank =
      getRank(
        db,
        ctx.chat.id,
        target.id,
        target.username
      );

    const user =
      getChat(db, ctx.chat.id).users[
        String(target.id)
      ];

    return ctx.reply(
      [
        `• رتبته ↤︎ ${rank}`,
        `• لقبه ↤︎ ${user.title || "لا يوجد"}`
      ].join("\n")
    );
  }
);

bot.hears(
  /^لقبي$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    registerUser(
      db,
      ctx.chat.id,
      ctx.from
    );

    const user =
      getChat(db, ctx.chat.id).users[
        String(ctx.from.id)
      ];

    return ctx.reply(
      `• لقبك ↤︎ ${user.title || "لا يوجد"}`
    );
  }
);

bot.hears(
  /^لقبه$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    if (!requireReply(ctx)) {
      return ctx.reply(
        "يجب الرد على العضو."
      );
    }

    const db = loadDB();

    const target =
      ctx.message.reply_to_message.from;

    registerUser(
      db,
      ctx.chat.id,
      target
    );

    const user =
      getChat(db, ctx.chat.id).users[
        String(target.id)
      ];

    return ctx.reply(
      `• لقبه ↤︎ ${user.title || "لا يوجد"}`
    );
  }
);

bot.hears(
  /^ضع (.+)$/i,
  async ctx => {
    if (ctx.chat.type === "private") return;

    if (!requireReply(ctx)) {
      return ctx.reply(
        "يجب الرد على العضو."
      );
    }

    const db = loadDB();

    const target =
      ctx.message.reply_to_message.from;

    const actorRank =
      getRank(
        db,
        ctx.chat.id,
        ctx.from.id,
        ctx.from.username
      );

    const targetRank =
      getRank(
        db,
        ctx.chat.id,
        target.id,
        target.username
      );

    if (
      rankValue(actorRank) <=
      rankValue(targetRank)
    ) {
      return ctx.reply(
        "لا يمكنك وضع لقب لعضو رتبته مساوية أو أعلى منك."
      );
    }

    registerUser(
      db,
      ctx.chat.id,
      target
    );

    const title =
      ctx.match[1].trim().slice(0, 50);

    getChat(db, ctx.chat.id).users[
      String(target.id)
    ].title = title;

    saveDB(db);

    return ctx.reply(
      `تم وضع اللقب ↤︎ ${title}`
    );
  }
);

/* =========================================================
   الكلمات الممنوعة
========================================================= */

bot.hears(
  /^اضف كلمة ممنوعة (.+)$/i,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    if (!hasRank(db, ctx.chat.id, ctx.from.id, "Myth")) {
      return ctx.reply(
        "• هذا الامر يخص ↤ ｢ Myth ｣"
      );
    }

    const word = ctx.match[1].trim();
    const chat = getChat(db, ctx.chat.id);

    if (!chat.settings.bannedWords.includes(word)) {
      chat.settings.bannedWords.push(word);
    }

    saveDB(db);

    return ctx.reply(
      `تمت إضافة الكلمة الممنوعة: ${word}`
    );
  }
);

bot.hears(
  /^حذف كلمة ممنوعة (.+)$/i,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    if (!hasRank(db, ctx.chat.id, ctx.from.id, "Myth")) {
      return ctx.reply(
        "• هذا الامر يخص ↤ ｢ Myth ｣"
      );
    }

    const word = ctx.match[1].trim();
    const chat = getChat(db, ctx.chat.id);

    chat.settings.bannedWords =
      chat.settings.bannedWords.filter(
        x => x.toLowerCase() !== word.toLowerCase()
      );

    saveDB(db);

    return ctx.reply(
      `تم حذف الكلمة الممنوعة: ${word}`
    );
  }
);

bot.hears(
  /^الكلمات الممنوعة$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();
    const chat = getChat(db, ctx.chat.id);

    if (!chat.settings.bannedWords.length) {
      return ctx.reply(
        "لا توجد كلمات ممنوعة."
      );
    }

    return ctx.reply(
      [
        "• الكلمات الممنوعة:",
        "",
        ...chat.settings.bannedWords.map(
          (word, i) => `${i + 1}. ${word}`
        )
      ].join("\n")
    );
  }
);

/* =========================================================
   البنك والفلوس
========================================================= */

bot.hears(
  /^فلوسي$/,
  async ctx => {
    const db = loadDB();

    const user =
      getGlobalUser(db, ctx.from.id);

    return ctx.reply(
      `• رصيدك ↤︎ ${user.balance} ريال`
    );
  }
);

bot.hears(
  /^فلوسه$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    if (!requireReply(ctx)) {
      return ctx.reply(
        "يجب الرد على العضو."
      );
    }

    const target =
      ctx.message.reply_to_message.from;

    const db = loadDB();

    const user =
      getGlobalUser(db, target.id);

    return ctx.reply(
      `• رصيد ${target.first_name} ↤︎ ${user.balance} ريال`
    );
  }
);

bot.hears(
  /^اهداء (\d+)$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    if (!requireReply(ctx)) {
      return ctx.reply(
        "يجب الرد على العضو."
      );
    }

    const amount = Number(ctx.match[1]);

    if (!Number.isFinite(amount) || amount <= 0) {
      return ctx.reply(
        "المبلغ غير صحيح."
      );
    }

    const db = loadDB();

    const sender =
      getGlobalUser(db, ctx.from.id);

    const target =
      ctx.message.reply_to_message.from;

    const receiver =
      getGlobalUser(db, target.id);

    if (sender.balance < amount) {
      return ctx.reply(
        "رصيدك لا يكفي."
      );
    }

    sender.balance -= amount;
    receiver.balance += amount;

    sender.transfers.push({
      to: String(target.id),
      amount,
      createdAt: Date.now()
    });

    saveDB(db);

    return ctx.reply(
      `تم إهداء ${amount} ريال إلى ${target.first_name}.`
    );
  }
);

bot.hears(
  /^انشاء حساب بنكي$/,
  async ctx => {
    const db = loadDB();

    const user =
      getGlobalUser(db, ctx.from.id);

    if (user.bankActive) {
      return ctx.reply(
        "لديك حساب بنكي بالفعل."
      );
    }

    user.bankActive = true;

    user.accountNumber =
      String(
        Math.floor(
          100000 +
          Math.random() * 900000
        )
      );

    user.bank = {
      balance: 0,
      createdAt: Date.now()
    };

    saveDB(db);

    return ctx.reply(
      [
        "تم إنشاء حسابك البنكي.",
        `• رقم الحساب ↤︎ ${user.accountNumber}`
      ].join("\n")
    );
  }
);

bot.hears(
  /^حسابي$/,
  async ctx => {
    const db = loadDB();

    const user =
      getGlobalUser(db, ctx.from.id);

    if (!user.bankActive) {
      return ctx.reply(
        "ليس لديك حساب بنكي."
      );
    }

    return ctx.reply(
      [
        "• حسابك البنكي",
        `• رقم الحساب ↤︎ ${user.accountNumber}`,
        `• الرصيد ↤︎ ${user.bank?.balance || 0}`
      ].join("\n")
    );
  }
);

bot.hears(
  /^حذف حسابي$/,
  async ctx => {
    const db = loadDB();

    const user =
      getGlobalUser(db, ctx.from.id);

    if (!user.bankActive) {
      return ctx.reply(
        "ليس لديك حساب بنكي."
      );
    }

    user.bankActive = false;
    user.accountNumber = null;
    user.bank = null;

    saveDB(db);

    return ctx.reply(
      "تم حذف حسابك البنكي."
    );
  }
);

/* =========================================================
   القنوات
========================================================= */

bot.hears(
  /^اضف قناة$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    if (!hasRank(db, ctx.chat.id, ctx.from.id, "مالك")) {
      return ctx.reply(
        "• هذا الامر يخص ↤ ｢ مالك ｣"
      );
    }

    const chat =
      getChat(db, ctx.chat.id);

    chat.channels[String(ctx.from.id)] = {
      username: "",
      title: ""
    };

    pending.set(ctx.from.id, {
      type: "add_channel",
      chatId: String(ctx.chat.id)
    });

    saveDB(db);

    return ctx.reply(
      "أرسل يوزر القناة الآن."
    );
  }
);

bot.hears(
  /^قناتي$/,
  async ctx => {
    const db = loadDB();

    const chat =
      getChat(db, ctx.chat.id);

    const channel =
      chat.channels[String(ctx.from.id)];

    if (!channel) {
      return ctx.reply(
        "لا توجد قناة مضافة."
      );
    }

    return ctx.reply(
      [
        "• قناتك",
        `• اليوزر ↤︎ ${channel.username || "غير محدد"}`,
        `• الاسم ↤︎ ${channel.title || "غير محدد"}`
      ].join("\n")
    );
  }
);

bot.hears(
  /^تعديل قناتي$/,
  async ctx => {
    const db = loadDB();

    const chat =
      getChat(db, ctx.chat.id);

    if (!chat.channels[String(ctx.from.id)]) {
      return ctx.reply(
        "لا توجد قناة مضافة."
      );
    }

    pending.set(ctx.from.id, {
      type: "edit_channel",
      chatId: String(ctx.chat.id)
    });

    return ctx.reply(
      "أرسل يوزر القناة الجديد."
    );
  }
);

bot.hears(
  /^حذف قناتي$/,
  async ctx => {
    const db = loadDB();

    const chat =
      getChat(db, ctx.chat.id);

    delete chat.channels[String(ctx.from.id)];

    saveDB(db);

    return ctx.reply(
      "تم حذف قناتك."
    );
  }
);

/* =========================================================
   الأوامر والردود المخصصة
========================================================= */

bot.hears(
  /^اضف امر (.+)$/i,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    if (!hasRank(db, ctx.chat.id, ctx.from.id, "مالك")) {
      return ctx.reply(
        "• هذا الامر يخص ↤ ｢ مالك ｣"
      );
    }

    const command = ctx.match[1].trim();

    pending.set(ctx.from.id, {
      type: "custom_command",
      chatId: String(ctx.chat.id),
      command
    });

    return ctx.reply(
      `أرسل الآن رد الأمر: ${command}`
    );
  }
);

bot.hears(
  /^حذف امر (.+)$/i,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    if (!hasRank(db, ctx.chat.id, ctx.from.id, "مالك")) {
      return ctx.reply(
        "• هذا الامر يخص ↤ ｢ مالك ｣"
      );
    }

    const command = ctx.match[1].trim();
    const chat = getChat(db, ctx.chat.id);

    delete chat.customCommands[command];

    saveDB(db);

    return ctx.reply(
      `تم حذف الأمر: ${command}`
    );
  }
);

bot.hears(
  /^اوامري$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();
    const chat = getChat(db, ctx.chat.id);

    const commands =
      Object.keys(chat.customCommands);

    if (!commands.length) {
      return ctx.reply(
        "لا توجد أوامر مخصصة."
      );
    }

    return ctx.reply(
      [
        "• أوامرك المخصصة:",
        "",
        ...commands.map(x => `• ${x}`)
      ].join("\n")
    );
  }
);

bot.hears(
  /^اضف رد (.+)$/i,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    if (!hasRank(db, ctx.chat.id, ctx.from.id, "مالك")) {
      return ctx.reply(
        "• هذا الامر يخص ↤ ｢ مالك ｣"
      );
    }

    const trigger = ctx.match[1].trim();

    pending.set(ctx.from.id, {
      type: "custom_reply",
      chatId: String(ctx.chat.id),
      trigger
    });

    return ctx.reply(
      `أرسل الآن الرد الذي سيظهر عند كتابة: ${trigger}`
    );
  }
);

bot.hears(
  /^حذف رد (.+)$/i,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    if (!hasRank(db, ctx.chat.id, ctx.from.id, "مالك")) {
      return ctx.reply(
        "• هذا الامر يخص ↤ ｢ مالك ｣"
      );
    }

    const trigger = ctx.match[1].trim();
    const chat = getChat(db, ctx.chat.id);

    delete chat.customReplies[trigger];

    saveDB(db);

    return ctx.reply(
      `تم حذف الرد: ${trigger}`
    );
  }
);

bot.hears(
  /^ردودي$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();
    const chat = getChat(db, ctx.chat.id);

    const replies =
      Object.keys(chat.customReplies);

    if (!replies.length) {
      return ctx.reply(
        "لا توجد ردود مخصصة."
      );
    }

    return ctx.reply(
      [
        "• ردودك المخصصة:",
        "",
        ...replies.map(x => `• ${x}`)
      ].join("\n")
    );
  }
);

/* =========================================================
   الهمسات
========================================================= */

function whisperId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 9)
  );
}

function whisperUrl(type, id) {
  const prefix =
    type === "view"
      ? "whisper_view_"
      : type === "reply"
      ? "whisper_reply_"
      : "whisper_send_";

  return `https://t.me/${BOT_USERNAME}?start=${prefix}${id}`;
}

async function createWhisper(
  chatId,
  senderId,
  receiverId,
  content,
  parentId = null
) {
  const db = loadDB();

  const id = whisperId();

  db.whispers[id] = {
    id,
    chatId: String(chatId),
    senderId: String(senderId),
    receiverId: String(receiverId),
    content,
    parentId,
    createdAt: Date.now(),
    viewed: false
  };

  saveDB(db);

  return {
    id,
    viewUrl: whisperUrl("view", id),
    replyUrl: whisperUrl("reply", id)
  };
}

async function sendWhisperCard(
  ctx,
  result,
  text = "لديك همسة سرية"
) {
  return ctx.telegram.sendMessage(
    result.chatId || ctx.chat.id,
    text,
    Markup.inlineKeyboard([
      [
        Markup.button.url(
          "رؤية الهمسه",
          result.viewUrl
        )
      ],
      [
        Markup.button.url(
          "رد على الهمسه",
          result.replyUrl
        )
      ]
    ])
  );
}

bot.hears(
  /^(اهمس|همسه|ه)$/i,
  async ctx => {
    if (ctx.chat.type === "private") return;

    if (!requireReply(ctx)) {
      return ctx.reply(
        "استخدم الأمر بالرد على الشخص الذي تريد إرسال الهمسة له."
      );
    }

    const target =
      ctx.message.reply_to_message.from;

    if (target.is_bot) {
      return ctx.reply(
        "لا يمكن إرسال همسة إلى بوت."
      );
    }

    pending.set(ctx.from.id, {
      type: "whisper_send",
      chatId: String(ctx.chat.id),
      targetId: String(target.id)
    });

    return ctx.reply(
      "أرسل محتوى الهمسة الآن.\nالنص أو صورة أو ملصق أو GIF."
    );
  }
);

/* =========================================================
   /start
========================================================= */

bot.start(
  async ctx => {
    await getBotId(ctx);

    const payload =
      ctx.startPayload || "";

    const db = loadDB();

    /* رؤية الهمسة */
    if (payload.startsWith("whisper_view_")) {
      const id =
        payload.replace("whisper_view_", "");

      const whisper =
        db.whispers[id];

      if (!whisper) {
        return ctx.reply(
          "الهمسة غير موجودة أو انتهت."
        );
      }

      const allowed =
        String(ctx.from.id) === String(whisper.receiverId) ||
        String(ctx.from.id) === String(whisper.senderId);

      if (!allowed) {
        return ctx.reply(
          "هذه الهمسة ليست لك."
        );
      }

      whisper.viewed = true;
      saveDB(db);

      const replyButton =
        Markup.inlineKeyboard([
          [
            Markup.button.url(
              "رد على الهمسه",
              whisperUrl("reply", id)
            )
          ]
        ]);

      if (whisper.content.type === "text") {
        return ctx.reply(
          [
            "همستك:",
            "",
            whisper.content.text
          ].join("\n"),
          replyButton
        );
      }

      if (whisper.content.type === "photo") {
        return ctx.replyWithPhoto(
          whisper.content.fileId,
          {
            caption: "همستك:",
            ...replyButton
          }
        );
      }

      if (whisper.content.type === "sticker") {
        await ctx.replyWithSticker(
          whisper.content.fileId
        );

        return ctx.reply(
          "يمكنك الرد على الهمسة:",
          replyButton
        );
      }

      if (whisper.content.type === "animation") {
        return ctx.replyWithAnimation(
          whisper.content.fileId,
          {
            caption: "همستك:",
            ...replyButton
          }
        );
      }

      return ctx.reply(
        "نوع محتوى الهمسة غير مدعوم."
      );
    }

    /* الرد على الهمسة */
    if (payload.startsWith("whisper_reply_")) {
      const id =
        payload.replace("whisper_reply_", "");

      const whisper =
        db.whispers[id];

      if (!whisper) {
        return ctx.reply(
          "الهمسة غير موجودة أو انتهت."
        );
      }

      if (
        String(ctx.from.id) !==
        String(whisper.receiverId)
      ) {
        return ctx.reply(
          "لا يمكنك الرد على هذه الهمسة."
        );
      }

      pending.set(ctx.from.id, {
        type: "whisper_reply",
        whisperId: id,
        chatId: whisper.chatId,
        targetId: whisper.senderId
      });

      return ctx.reply(
        "أرسل ردك على الهمسة الآن."
      );
    }

    /* رابط إرسال همسة */
    if (payload.startsWith("whisper_send_")) {
      return ctx.reply(
        "لإرسال همسة، استخدم الأمر من داخل القروب بالرد على العضو."
      );
    }

    const me =
      await ctx.telegram.getMe();

    BOT_USERNAME =
      me.username || BOT_USERNAME;

    const id = String(ctx.from.id);

    if (!db.globalSubscribers.map(String).includes(id)) {
      db.globalSubscribers.push(id);
      saveDB(db);
    }

    return ctx.reply(
      [
        `اهلا بك يا قلبي - ${mention(ctx.from)}`,
        "",
        "• انا اشغل لك اللي تبي بالمكالمه",
        "",
        "ادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود."
      ].join("\n"),
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.url(
              "اضفني في مجموعتك",
              `https://t.me/${BOT_USERNAME}?startgroup=true`
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
   همسات الصور والملصقات و GIF
========================================================= */

bot.on(
  ["photo", "sticker", "animation"],
  async ctx => {
    if (ctx.chat.type !== "private") return;

    const p =
      pending.get(ctx.from.id);

    if (!p) return;

    if (
      p.type !== "whisper_send" &&
      p.type !== "whisper_reply"
    ) {
      return;
    }

    let content = null;

    if (ctx.message.photo) {
      const file =
        ctx.message.photo[
          ctx.message.photo.length - 1
        ];

      content = {
        type: "photo",
        fileId: file.file_id
      };
    }

    if (ctx.message.sticker) {
      content = {
        type: "sticker",
        fileId:
          ctx.message.sticker.file_id
      };
    }

    if (ctx.message.animation) {
      content = {
        type: "animation",
        fileId:
          ctx.message.animation.file_id
      };
    }

    if (!content) return;

    pending.delete(ctx.from.id);

    const db = loadDB();

    let result;

    if (p.type === "whisper_send") {
      result = await createWhisper(
        p.chatId,
        ctx.from.id,
        p.targetId,
        content
      );
    } else {
      const original =
        db.whispers[p.whisperId];

      if (!original) {
        return ctx.reply(
          "الهمسة غير موجودة."
        );
      }

      result = await createWhisper(
        original.chatId,
        ctx.from.id,
        original.senderId,
        content,
        p.whisperId
      );
    }

    try {
      await ctx.telegram.sendMessage(
        p.chatId,
        p.type === "whisper_send"
          ? "لديك همسة سرية"
          : "وصلك رد على الهمسه",
        Markup.inlineKeyboard([
          [
            Markup.button.url(
              "رؤية الهمسه",
              result.viewUrl
            )
          ],
          [
            Markup.button.url(
              "رد على الهمسه",
              result.replyUrl
            )
          ]
        ])
      );
    } catch {}

    return ctx.reply(
      p.type === "whisper_send"
        ? "تم إرسال الهمسة."
        : "تم إرسال الرد."
    );
  }
);

/* =========================================================
   الإذاعة
========================================================= */

bot.hears(
  /^إذاعة$/,
  async ctx => {
    if (ctx.chat.type !== "private") return;

    const db = loadDB();

    if (!isDev(db, ctx.from.id, ctx.from.username)) {
      return ctx.reply(
        "• هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
      );
    }

    pending.set(ctx.from.id, {
      type: "broadcast"
    });

    return ctx.reply(
      "أرسل الرسالة التي تريد إذاعتها."
    );
  }
);

/* =========================================================
   الأحكام
========================================================= */

bot.hears(
  /^احكام$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    if (!hasRank(db, ctx.chat.id, ctx.from.id, "Myth")) {
      return ctx.reply(
        "• هذا الامر يخص ↤ ｢ Myth ｣"
      );
    }

    const chat =
      getChat(db, ctx.chat.id);

    chat.activeAhkam = {
      userId: String(ctx.from.id),
      startedAt: Date.now()
    };

    saveDB(db);

    return ctx.reply(
      "تم بدء الأحكام."
    );
  }
);

bot.hears(
  /^انهاء احكام$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    if (!hasRank(db, ctx.chat.id, ctx.from.id, "Myth")) {
      return ctx.reply(
        "• هذا الامر يخص ↤ ｢ Myth ｣"
      );
    }

    getChat(db, ctx.chat.id).activeAhkam = null;

    saveDB(db);

    return ctx.reply(
      "تم إنهاء الأحكام."
    );
  }
);

/* =========================================================
   قفل الألعاب
========================================================= */

bot.hears(
  /^قفل الالعاب$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    if (!hasRank(db, ctx.chat.id, ctx.from.id, "Myth")) {
      return ctx.reply(
        "• هذا الامر يخص ↤ ｢ Myth ｣"
      );
    }

    getChat(db, ctx.chat.id).settings.gamesClosed = true;

    saveDB(db);

    return ctx.reply(
      "تم قفل الألعاب."
    );
  }
);

bot.hears(
  /^فتح الالعاب$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    if (!hasRank(db, ctx.chat.id, ctx.from.id, "Myth")) {
      return ctx.reply(
        "• هذا الامر يخص ↤ ｢ Myth ｣"
      );
    }

    getChat(db, ctx.chat.id).settings.gamesClosed = false;

    saveDB(db);

    return ctx.reply(
      "تم فتح الألعاب."
    );
  }
);

/* =========================================================
   التفاعل
========================================================= */

bot.hears(
  /^تفاعلي$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    registerUser(
      db,
      ctx.chat.id,
      ctx.from
    );

    const chat =
      getChat(db, ctx.chat.id);

    const user =
      chat.users[String(ctx.from.id)];

    const sorted =
      Object.entries(chat.users).sort(
        (a, b) =>
          (b[1].messages || 0) -
          (a[1].messages || 0)
      );

    const position =
      sorted.findIndex(
        ([id]) =>
          String(id) ===
          String(ctx.from.id)
      ) + 1;

    return ctx.reply(
      [
        `• رتبتك ↤︎ ${getRank(
          db,
          ctx.chat.id,
          ctx.from.id,
          ctx.from.username
        )}`,
        `• رسائلك ↤︎ ${user.messages || 0}`,
        `• نقاطك ↤︎ ${user.points || 0}`,
        `• ترتيبك ↤︎ ${position || "-"}`,
        `• لقبك ↤︎ ${user.title || "لا يوجد"}`
      ].join("\n")
    );
  }
);

bot.hears(
  /^ترتيبي$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    registerUser(
      db,
      ctx.chat.id,
      ctx.from
    );

    const chat =
      getChat(db, ctx.chat.id);

    const sorted =
      Object.entries(chat.users).sort(
        (a, b) =>
          (b[1].messages || 0) -
          (a[1].messages || 0)
      );

    const position =
      sorted.findIndex(
        ([id]) =>
          String(id) ===
          String(ctx.from.id)
      ) + 1;

    return ctx.reply(
      `• ترتيبك بين المتفاعلين ↤︎ ${position}`
    );
  }
);

bot.hears(
  /^المتفاعلين$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    const chat =
      getChat(db, ctx.chat.id);

    const sorted =
      Object.entries(chat.users)
        .sort(
          (a, b) =>
            (b[1].messages || 0) -
            (a[1].messages || 0)
        )
        .slice(0, 10);

    if (!sorted.length) {
      return ctx.reply(
        "لا يوجد تفاعل مسجل."
      );
    }

    const lines = [
      "• أكثر المتفاعلين:",
      ""
    ];

    sorted.forEach(
      ([id, user], index) => {
        lines.push(
          `${index + 1}. ${
            user.firstName || "عضو"
          } ↤︎ ${user.messages || 0} رسالة`
        );
      }
    );

    return ctx.reply(
      lines.join("\n")
    );
  }
);

bot.hears(
  /^اضف تفاعل$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    if (!requireReply(ctx)) {
      return ctx.reply(
        "يجب الرد على العضو."
      );
    }

    const db = loadDB();

    const target =
      ctx.message.reply_to_message.from;

    registerUser(
      db,
      ctx.chat.id,
      target
    );

    const user =
      getChat(db, ctx.chat.id).users[
        String(target.id)
      ];

    user.messages =
      (user.messages || 0) + 10;

    user.points =
      (user.points || 0) + 10;

    saveDB(db);

    return ctx.reply(
      `تمت إضافة تفاعل لـ ${target.first_name}.`
    );
  }
);

/* =========================================================
   الألعاب
========================================================= */

const GAME_LIST = [
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

function normalizeGameText(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه");
}

function randomItem(arr) {
  return arr[
    Math.floor(Math.random() * arr.length)
  ];
}

function createGame(name) {
  const games = {
    "كلمة": [
      ["موز", "موز"],
      ["قهوة", "قهوة"],
      ["مدرسة", "مدرسة"],
      ["سيارة", "سيارة"]
    ],

    "ترتيب": [
      ["احمر", "احمر"],
      ["برتقال", "برتقال"],
      ["تفاح", "تفاح"]
    ],

    "حروف": [
      ["كتاب", "كتاب"],
      ["قمر", "قمر"],
      ["بحر", "بحر"]
    ],

    "خمن": [
      ["قمر", "قمر"],
      ["شمس", "شمس"],
      ["مفتاح", "مفتاح"]
    ],

    "لغز": [
      [
        "الشيء الذي له أسنان ولا يعض؟",
        "مشط"
      ],
      [
        "شيء نراه في الليل ثلاث مرات وفي النهار مرة؟",
        "حرف اللام"
      ]
    ],

    "صح أو خطأ": [
      ["الشمس نجم", "صح"],
      ["الأرض أكبر من الشمس", "خطأ"],
      ["الماء يتجمد عند صفر مئوية", "صح"]
    ],

    "مقلوب": [
      ["ةوهق", "قهوة"],
      ["باتك", "كتاب"],
      ["رمق", "قمر"]
    ],

    "فكك": [
      ["م د ر س ة", "مدرسة"],
      ["ق ه و ة", "قهوة"],
      ["ك ت ا ب", "كتاب"]
    ],

    "حساب": [
      ["5 + 7", "12"],
      ["9 × 3", "27"],
      ["20 - 8", "12"],
      ["36 ÷ 6", "6"]
    ],

    "كلمة السر": [
      ["البحر", "ماء"],
      ["السماء", "سحاب"],
      ["الشتاء", "برد"]
    ],

    "إيموجي": [
      ["☀️", "شمس"],
      ["🌙", "قمر"],
      ["🍎", "تفاح"]
    ],

    "من أنا": [
      ["أعيش في البحر ولدي ثمانية أذرع", "اخطبوط"],
      ["أضيء في السماء نهاراً", "شمس"]
    ]
  };

  const data = games[name];

  if (!data) {
    return {
      question: `ابدأ لعبة ${name}`,
      answer: null,
      type: "none"
    };
  }

  const selected = randomItem(data);

  return {
    question: selected[0],
    answer: selected[1],
    type: "normalizedExact"
  };
}

bot.hears(
  /^الالعاب$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const rows = [];

    for (let i = 0; i < GAME_LIST.length; i += 2) {
      const row = [];

      row.push(
        Markup.button.callback(
          GAME_LIST[i],
          `game_start:${GAME_LIST[i]}`
        )
      );

      if (GAME_LIST[i + 1]) {
        row.push(
          Markup.button.callback(
            GAME_LIST[i + 1],
            `game_start:${GAME_LIST[i + 1]}`
          )
        );
      }

      rows.push(row);
    }

    return ctx.reply(
      "• قائمة الألعاب:",
      Markup.inlineKeyboard(rows)
    );
  }
);

bot.action(
  /^game_start:(.+)$/,
  async ctx => {
    if (
      !ctx.chat ||
      ctx.chat.type === "private"
    ) {
      return ctx.answerCbQuery(
        "اللعبة داخل القروب."
      );
    }

    const name = ctx.match[1];
    const db = loadDB();

    const chat =
      getChat(db, ctx.chat.id);

    if (chat.settings.gamesClosed) {
      return ctx.answerCbQuery(
        "الألعاب مقفلة.",
        { show_alert: true }
      );
    }

    const game = createGame(name);

    chat.games.active = {
      name,
      question: game.question,
      answer: game.answer,
      type: game.type,
      starterId: String(ctx.from.id),
      startedAt: Date.now()
    };

    saveDB(db);

    await ctx.answerCbQuery(
      "بدأت اللعبة"
    );

    return ctx.editMessageText(
      [
        `• لعبة: ${name}`,
        "",
        `• السؤال: ${game.question}`,
        "",
        "أول شخص يجاوب صح يفوز."
      ].join("\n")
    );
  }
);

/* =========================================================
   المتجر
========================================================= */

bot.hears(
  /^المتجر$/,
  async ctx => {
    return ctx.reply(
      [
        "• المتجر",
        "",
        "1. لقب مميز ↤︎ 100",
        "2. تفاعل إضافي ↤︎ 50",
        "",
        "المتجر الأساسي متاح للتطوير لاحقًا."
      ].join("\n")
    );
  }
);

/* =========================================================
   الزواج
========================================================= */

bot.hears(
  /^زواج$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    if (!requireReply(ctx)) {
      return ctx.reply(
        "يجب الرد على الشخص الذي تريد الزواج منه."
      );
    }

    const db = loadDB();

    const a = String(ctx.from.id);

    const target = String(
      ctx.message.reply_to_message.from.id
    );

    if (a === target) {
      return ctx.reply(
        "لا يمكنك الزواج من نفسك."
      );
    }

    if (
      db.marriages[a] ||
      db.marriages[target]
    ) {
      return ctx.reply(
        "أحد الطرفين متزوج بالفعل."
      );
    }

    db.marriages[a] = {
      partner: target,
      createdAt: Date.now()
    };

    db.marriages[target] = {
      partner: a,
      createdAt: Date.now()
    };

    saveDB(db);

    return ctx.reply(
      "تم تسجيل الزواج."
    );
  }
);

bot.hears(
  /^زواجي$/,
  async ctx => {
    const db = loadDB();

    const marriage =
      db.marriages[String(ctx.from.id)];

    if (!marriage) {
      return ctx.reply(
        "أنت غير متزوج."
      );
    }

    try {
      const chat =
        await ctx.telegram.getChat(
          marriage.partner
        );

      return ctx.reply(
        `• شريكك ↤︎ ${chat.first_name || "عضو"}`
      );
    } catch {
      return ctx.reply(
        "• شريكك مسجل في النظام."
      );
    }
  }
);

bot.hears(
  /^توب المتزوجين$/,
  async ctx => {
    const db = loadDB();

    const seen = new Set();
    const list = [];

    for (
      const [id, marriage] of
      Object.entries(db.marriages)
    ) {
      const partner =
        String(marriage.partner);

      if (
        seen.has(id) ||
        seen.has(partner)
      ) {
        continue;
      }

      seen.add(id);
      seen.add(partner);

      list.push([id, marriage]);
    }

    if (!list.length) {
      return ctx.reply(
        "لا يوجد متزوجون."
      );
    }

    return ctx.reply(
      [
        "• توب المتزوجين",
        "",
        ...list.slice(0, 10).map(
          ([id, marriage], i) =>
            `${i + 1}. ${id} + ${marriage.partner}`
        )
      ].join("\n")
    );
  }
);

/* =========================================================
   بحث الأغاني
========================================================= */

let ytSearch = null;

try {
  ytSearch = require("yt-search");
} catch {
  console.log(
    "yt-search غير مثبت."
  );
}

bot.hears(
  /^(بحث اغاني|بحث الأغاني|اغاني) (.+)$/i,
  async ctx => {
    const query =
      ctx.match[2].trim();

    if (!ytSearch) {
      return ctx.reply(
        "ثبتي مكتبة yt-search أولاً."
      );
    }

    try {
      const result =
        await ytSearch(query);

      const videos =
        result.videos.slice(0, 8);

      if (!videos.length) {
        return ctx.reply(
          "ما لقيت نتائج."
        );
      }

      const buttons =
        videos.map(video => [
          Markup.button.url(
            video.title.slice(0, 45),
            video.url
          )
        ]);

      return ctx.reply(
        `• نتائج البحث عن: ${query}`,
        Markup.inlineKeyboard(buttons)
      );
    } catch (e) {
      console.error(
        "YT SEARCH:",
        e.message
      );

      return ctx.reply(
        "صار خطأ أثناء البحث."
      );
    }
  }
);

/* =========================================================
   تنظيف الرسائل
========================================================= */

const CLEAN_TYPES = {
  1: "text",
  2: "photo",
  3: "video",
  4: "sticker",
  5: "animation",
  6: "audio",
  7: "voice",
  8: "document",
  9: "all"
};

bot.hears(
  /^[1-9]$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    if (!hasRank(db, ctx.chat.id, ctx.from.id, "Myth")) {
      return ctx.reply(
        "• هذا الامر يخص ↤ ｢ Myth ｣"
      );
    }

    const type =
      CLEAN_TYPES[ctx.message.text];

    const chat =
      getChat(db, ctx.chat.id);

    const ids =
      chat.messageLog
        .filter(item =>
          type === "all"
            ? true
            : item.type === type
        )
        .map(item => item.id);

    let deleted = 0;

    for (const messageId of ids) {
      try {
        await ctx.telegram.deleteMessage(
          ctx.chat.id,
          messageId
        );

        deleted++;
      } catch {}
    }

    chat.messageLog =
      chat.messageLog.filter(
        item => !ids.includes(item.id)
      );

    saveDB(db);

    return ctx.reply(
      `تم حذف ${deleted} رسالة.`
    );
  }
);

/* =========================================================
   الذكاء الاصطناعي
========================================================= */

let openai = null;

try {
  const OpenAI = require("openai");

  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
} catch {
  console.log(
    "OpenAI package غير مثبت."
  );
}

async function askAI(question) {
  if (!openai) {
    return "الذكاء الاصطناعي غير مفعل حالياً.";
  }

  try {
    const response =
      await openai.responses.create({
        model:
          process.env.OPENAI_MODEL ||
          "gpt-5.6-luna",
        instructions:
          "أنت مساعد داخل بوت تيليجرام اسمه ايف. جاوب بالعربي وبأسلوب مختصر وواضح وودود.",
        input: question
      });

    return (
      response.output_text ||
      "ما قدرت أطلع لك جواب."
    );
  } catch (error) {
    console.error(
      "AI ERROR:",
      error.message
    );

    return "صار خطأ وأنا أحاول أجاوبك.";
  }
}

/* =========================================================
   معالج النصوص الموحد
========================================================= */

bot.on(
  "text",
  async (ctx, next) => {
    const text =
      ctx.message.text.trim();

    const db = loadDB();

    /* -----------------------------------------------------
       الخاص + الحالات المعلقة
    ----------------------------------------------------- */

    if (ctx.chat.type === "private") {
      const p =
        pending.get(ctx.from.id);

      if (p) {

        /* إذاعة */
        if (p.type === "broadcast") {
          if (
            !isDev(
              db,
              ctx.from.id,
              ctx.from.username
            )
          ) {
            pending.delete(ctx.from.id);

            return ctx.reply(
              "• هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
            );
          }

          pending.delete(ctx.from.id);

          const users =
            Array.isArray(
              db.globalSubscribers
            )
              ? db.globalSubscribers.map(String)
              : [];

          let sent = 0;

          for (const userId of users) {
            try {
              await ctx.telegram.sendMessage(
                userId,
                text
              );

              sent++;

              await new Promise(
                resolve =>
                  setTimeout(resolve, 60)
              );
            } catch {}
          }

          return ctx.reply(
            `تمت الإذاعة إلى ${sent} مستخدم.`
          );
        }

        /* همسة نصية */
        if (p.type === "whisper_send") {
          pending.delete(ctx.from.id);

          const result =
            await createWhisper(
              p.chatId,
              ctx.from.id,
              p.targetId,
              {
                type: "text",
                text
              }
            );

          try {
            await ctx.telegram.sendMessage(
              p.chatId,
              "لديك همسة سرية",
              Markup.inlineKeyboard([
                [
                  Markup.button.url(
                    "رؤية الهمسه",
                    result.viewUrl
                  )
                ],
                [
                  Markup.button.url(
                    "رد على الهمسه",
                    result.replyUrl
                  )
                ]
              ])
            );
          } catch {}

          return ctx.reply(
            "تم إرسال الهمسة."
          );
        }

        /* الرد على همسة */
        if (p.type === "whisper_reply") {
          const original =
            db.whispers[p.whisperId];

          pending.delete(ctx.from.id);

          if (!original) {
            return ctx.reply(
              "الهمسة غير موجودة."
            );
          }

          const result =
            await createWhisper(
              original.chatId,
              ctx.from.id,
              original.senderId,
              {
                type: "text",
                text
              },
              p.whisperId
            );

          try {
            await ctx.telegram.sendMessage(
              original.chatId,
              "وصلك رد على الهمسه",
              Markup.inlineKeyboard([
                [
                  Markup.button.url(
                    "رؤية الرد",
                    result.viewUrl
                  )
                ],
                [
                  Markup.button.url(
                    "رد على الهمسه",
                    result.replyUrl
                  )
                ]
              ])
            );
          } catch {}

          return ctx.reply(
            "تم إرسال الرد."
          );
        }

        /* إضافة قناة */
        if (p.type === "add_channel") {
          const chat =
            getChat(db, p.chatId);

          chat.channels[
            String(ctx.from.id)
          ] = {
            username: text
              .replace(/^@/, "")
              .trim(),
            title: ""
          };

          pending.delete(ctx.from.id);

          saveDB(db);

          return ctx.reply(
            "تمت إضافة القناة."
          );
        }

        /* تعديل قناة */
        if (p.type === "edit_channel") {
          const chat =
            getChat(db, p.chatId);

          if (
            !chat.channels[
              String(ctx.from.id)
            ]
          ) {
            pending.delete(ctx.from.id);

            return ctx.reply(
              "لا توجد قناة."
            );
          }

          chat.channels[
            String(ctx.from.id)
          ].username =
            text.replace(/^@/, "").trim();

          pending.delete(ctx.from.id);

          saveDB(db);

          return ctx.reply(
            "تم تعديل قناتك."
          );
        }

        /* أمر مخصص */
        if (p.type === "custom_command") {
          const chat =
            getChat(db, p.chatId);

          chat.customCommands[p.command] =
            text;

          pending.delete(ctx.from.id);

          saveDB(db);

          return ctx.reply(
            `تم إنشاء الأمر: ${p.command}`
          );
        }

        /* رد مخصص */
        if (p.type === "custom_reply") {
          const chat =
            getChat(db, p.chatId);

          chat.customReplies[p.trigger] =
            text;

          pending.delete(ctx.from.id);

          saveDB(db);

          return ctx.reply(
            `تم إنشاء الرد: ${p.trigger}`
          );
        }
      }

      if (
        !db.globalSubscribers
          .map(String)
          .includes(String(ctx.from.id))
      ) {
        db.globalSubscribers.push(
          String(ctx.from.id)
        );

        saveDB(db);
      }

      return next();
    }

    /* -----------------------------------------------------
       القروب
    ----------------------------------------------------- */

    const chat =
      getChat(db, ctx.chat.id);

    registerUser(
      db,
      ctx.chat.id,
      ctx.from
    );

    /* -----------------------------------------------------
       الذكاء الاصطناعي
    ----------------------------------------------------- */

    if (
      text === "بوت" ||
      text.startsWith("بوت ")
    ) {
      if (
        chat.settings.botReplies === false
      ) {
        return;
      }

      const question =
        text === "بوت"
          ? "كيف حالك؟"
          : text.slice(4).trim();

      if (!question) {
        return ctx.reply(
          "وش تبي تسألني؟"
        );
      }

      const answer =
        await askAI(question);

      return ctx.reply(answer);
    }

    /* -----------------------------------------------------
       اللعبة
    ----------------------------------------------------- */

    if (chat.games?.active) {
      const game =
        chat.games.active;

      if (game.answer) {
        const correct =
          normalizeGameText(text) ===
          normalizeGameText(game.answer);

        if (correct) {
          chat.games.active = null;

          const user =
            chat.users[String(ctx.from.id)];

          user.points =
            (user.points || 0) + 10;

          saveDB(db);

          return ctx.reply(
            `أحسنت ${ctx.from.first_name}! إجابة صحيحة.\n+10 نقاط`
          );
        }
      }
    }

    /* -----------------------------------------------------
       الأوامر المخصصة
    ----------------------------------------------------- */

    const custom =
      chat.customCommands?.[text];

    if (custom) {
      return ctx.reply(custom);
    }

    const customReply =
      chat.customReplies?.[text];

    if (customReply) {
      return ctx.reply(customReply);
    }

    /* -----------------------------------------------------
       الكلمات الممنوعة
    ----------------------------------------------------- */

    const banned =
      Array.isArray(
        chat.settings.bannedWords
      )
        ? chat.settings.bannedWords
        : [];

    const normalized =
      normalizeGameText(text);

    const found =
      banned.find(word =>
        normalized.includes(
          normalizeGameText(word)
        )
      );

    if (found) {
      try {
        await ctx.deleteMessage();
      } catch {}

      return;
    }

    return next();
  }
);

/* =========================================================
   أوامر المطور
========================================================= */

bot.hears(
  /^(ا|ت|ق|م|ن|ح|د)$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();

    if (!isDev(db, ctx.from.id, ctx.from.username)) {
      return ctx.reply(
        "• هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
      );
    }

    const menus = {
      ا: "إدارة القروب",
      ت: "إعدادات البوت",
      ق: "الحماية",
      م: "الرسائل والإذاعة",
      ن: "الرتب والمطورين",
      ح: "الألعاب والتفاعل",
      د: "الإعدادات المتقدمة"
    };

    return ctx.reply(
      `• قائمة ${menus[ctx.match[1]]}`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "القائمة الرئيسية",
            "menu:main"
          )
        ]
      ])
    );
  }
);

/* =========================================================
   أوامر المطور
========================================================= */

bot.hears(
  /^اوامر$/,
  async ctx => {
    const db = loadDB();

    if (!isDev(db, ctx.from.id, ctx.from.username)) {
      return ctx.reply(
        "• هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
      );
    }

    return ctx.reply(
      [
        "• أوامر المطور",
        "",
        "ا",
        "ت",
        "ق",
        "م",
        "ن",
        "ح",
        "د",
        "",
        "رفع",
        "تنزيل",
        "ترقية",
        "خفض",
        "",
        "إذاعة",
        "",
        "رتبتي",
        "رتبته"
      ].join("\n")
    );
  }
);

/* =========================================================
   القائمة الرئيسية
========================================================= */

function mainMenu() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "المطور",
        "menu:dev"
      ),
      Markup.button.callback(
        "الرتب",
        "menu:ranks"
      )
    ],
    [
      Markup.button.callback(
        "الحماية",
        "menu:security"
      ),
      Markup.button.callback(
        "التفاعل والألعاب",
        "menu:games"
      )
    ],
    [
      Markup.button.callback(
        "الهمسات والأغاني",
        "menu:media"
      ),
      Markup.button.callback(
        "القروب",
        "menu:group"
      )
    ]
  ]);
}

bot.hears(
  /^القائمة$/,
  async ctx => {
    return ctx.reply(
      "• القائمة الرئيسية",
      mainMenu()
    );
  }
);

bot.action(
  "menu:main",
  async ctx => {
    await ctx.answerCbQuery();

    return ctx.editMessageText(
      "• القائمة الرئيسية",
      mainMenu()
    );
  }
);

/* =========================================================
   قائمة المطور
========================================================= */

bot.action(
  "menu:dev",
  async ctx => {
    const db = loadDB();

    if (!isDev(db, ctx.from.id, ctx.from.username)) {
      return ctx.answerCbQuery(
        "هذا الأمر للمطور فقط.",
        { show_alert: true }
      );
    }

    await ctx.answerCbQuery();

    return ctx.editMessageText(
      [
        "• لوحة المطور",
        "",
        "ا ↤︎ إدارة القروب",
        "ت ↤︎ إعدادات البوت",
        "ق ↤︎ الحماية",
        "م ↤︎ الرسائل والإذاعة",
        "ن ↤︎ الرتب والمطورين",
        "ح ↤︎ الألعاب والتفاعل",
        "د ↤︎ الإعدادات المتقدمة"
      ].join("\n"),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "رجوع",
            "menu:main"
          )
        ]
      ])
    );
  }
);

/* =========================================================
   القوائم الفرعية
========================================================= */

bot.action(
  /^menu:(ranks|security|games|media|group)$/,
  async ctx => {
    await ctx.answerCbQuery();

    const type =
      ctx.match[1];

    const menus = {
      ranks: [
        "• الرتب",
        "",
        "رتبتي",
        "رتبته",
        "رفع",
        "ترقية",
        "تنزيل",
        "خفض"
      ],

      security: [
        "• الحماية",
        "",
        "كتم",
        "فك الكتم",
        "حظر",
        "طرد",
        "مم"
      ],

      games: [
        "• الألعاب والتفاعل",
        "",
        "الالعاب",
        "تفاعلي",
        "المتفاعلين",
        "ترتيبي"
      ],

      media: [
        "• الهمسات والأغاني",
        "",
        "اهمس",
        "همسه",
        "بحث اغاني <اسم الأغنية>"
      ],

      group: [
        "• أوامر القروب",
        "",
        "رفع مشرف",
        "صلاحياتي",
        "احكام",
        "المتجر"
      ]
    };

    return ctx.editMessageText(
      menus[type].join("\n"),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "رجوع",
            "menu:main"
          )
        ]
      ])
    );
  }
);

/* =========================================================
   أخطاء البوت
========================================================= */

bot.catch((error, ctx) => {
  console.error(
    "BOT ERROR:",
    error
  );
});

/* =========================================================
   التشغيل
========================================================= */

bot.launch()
  .then(() => {
    console.log(
      "ايف Bot is running..."
    );
  })
  .catch(error => {
    console.error(
      "LAUNCH ERROR:",
      error
    );
  });

process.once(
  "SIGINT",
  () => bot.stop("SIGINT")
);

process.once(
  "SIGTERM",
  () => bot.stop("SIGTERM")
);
