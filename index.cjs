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
  "مطور ثانوي": "Dev²🎖️",
  "مطور": "Dev🎖️",
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
  } catch (e) {
    console.error("Database load error:", e);
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
  } catch (e) {
    console.error("Database save error:", e);
  }
}

/* =========================================================
   أدوات
========================================================= */

function randomToken() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
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

function botReply(ctx, text, extra = {}) {
  const messageId = ctx.message?.message_id;

  return ctx.reply(text, {
    ...extra,
    ...(messageId
      ? { reply_to_message_id: messageId }
      : {})
  });
}

function getTargetFromReply(ctx) {
  return ctx.message?.reply_to_message?.from || null;
}

function replyRequired(ctx) {
  const target = getTargetFromReply(ctx);

  if (!target) {
    botReply(ctx, "يجب استخدام الأمر بالرد على العضو.");
    return null;
  }

  return target;
}

/* =========================================================
   المستخدم العام
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
      user.username || db.users[id].username || "";

    db.users[id].firstName =
      user.first_name || db.users[id].firstName || "";

    db.users[id].lastName =
      user.last_name || db.users[id].lastName || "";
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
      String(value || "").trim().toLowerCase()
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

function ensureChatUser(chat, user) {
  if (!user?.id) return null;

  const id = String(user.id);
  const username =
    user.username ||
    chat.users[id]?.username ||
    "";

  const automaticDev = isDev(user.id, username);

  if (!chat.users[id]) {
    chat.users[id] = {
      id,
      username,
      firstName: user.first_name || "",
      rank: automaticDev ? "Dev🎖️" : "عضو",
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
    chat.users[id].username = username;
    chat.users[id].firstName =
      user.first_name ||
      chat.users[id].firstName ||
      "";

    if (automaticDev) {
      chat.users[id].rank = "Dev🎖️";
    }
  }

  return chat.users[id];
}

function canTarget(chat, actorId, targetId) {
  const actor = String(actorId);
  const target = String(targetId);

  if (actor === target) return false;

  const actorUser = chat.users[actor];
  const targetUser = chat.users[target];

  const actorDev = isDev(
    actor,
    actorUser?.username || ""
  );

  const targetDev = isDev(
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
  const member = await safeGetMember(ctx, targetId);

  if (member?.status === "creator") {
    return true;
  }

  const chat = ensureChat(ctx.chat.id);

  return !canTarget(
    chat,
    ctx.from.id,
    targetId
  );
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
  const defaults = defaultChatSettings();

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
   الصلاحيات
========================================================= */

function rankPermissionMessage(rank) {
  return `• هذا الامر يخص ↤ ｢ ${rank} ｢`;
}

function requireRank(ctx, requiredRank) {
  if (!ctx.chat) return false;

  const chat = ensureChat(ctx.chat.id);
  const rank = getRank(chat, ctx.from.id);

  if (rankValue(rank) < rankValue(requiredRank)) {
    botReply(
      ctx,
      rankPermissionMessage(requiredRank)
    );
    return false;
  }

  return true;
}

function requireAdminRank(ctx) {
  return requireRank(ctx, "مميز");
}

/* =========================================================
   السجل
========================================================= */

function logAdmin(chat, actorId, action, targetId = null) {
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
    chat.adminLog = chat.adminLog.slice(-500);
  }

  db.botLog.push({
    chatId: chat.id,
    ...item
  });

  if (db.botLog.length > 2000) {
    db.botLog = db.botLog.slice(-2000);
  }

  saveDB();
}

/* =========================================================
   التفاعل
========================================================= */

function addInteraction(chat, userId, points = 1) {
  const id = String(userId);

  if (!chat.interactions[id]) {
    chat.interactions[id] = {
      id,
      messages: 0,
      points: 0
    };
  }

  chat.interactions[id].messages++;
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

  return chat.interactions[id];
}

function getInteractionRanking(chat) {
  return Object.entries(chat.interactions).sort(
    (a, b) => {
      const pa = Number(a[1]?.points || 0);
      const pb = Number(b[1]?.points || 0);

      if (pb !== pa) return pb - pa;

      return (
        Number(b[1]?.messages || 0) -
        Number(a[1]?.messages || 0)
      );
    }
  );
}

function getInteractionPosition(chat, userId) {
  const ranking = getInteractionRanking(chat);

  const index = ranking.findIndex(
    ([id]) => String(id) === String(userId)
  );

  return index === -1 ? 0 : index + 1;
}

/* =========================================================
   Middleware
========================================================= */

bot.use(async (ctx, next) => {
  try {
    if (ctx.from) {
      ensureGlobalUser(ctx.from);
    }

    if (
      ctx.chat &&
      ctx.chat.type !== "private" &&
      ctx.from
    ) {
      const chat = ensureChat(ctx.chat.id);

      ensureChatUser(chat, ctx.from);

      if (ctx.message) {
        addInteraction(
          chat,
          ctx.from.id,
          1
        );

        const user =
          chat.users[String(ctx.from.id)];

        user.messages++;

        const msg = ctx.message;

        chat.messageLog.push({
          messageId: msg.message_id,
          userId: String(ctx.from.id),
          time: Date.now(),
          text:
            msg.text ||
            msg.caption ||
            "",
          photo: !!msg.photo,
          video: !!msg.video,
          document: !!msg.document,
          sticker: !!msg.sticker,
          animation: !!msg.animation,
          audio: !!msg.audio,
          voice: !!msg.voice
        });

        if (chat.messageLog.length > 2000) {
          chat.messageLog =
            chat.messageLog.slice(-2000);
        }
      }

      saveDB();
    }

    return next();
  } catch (e) {
    console.error("MIDDLEWARE ERROR:", e);
    return next();
  }
});

/* =========================================================
   START + الهمسات
========================================================= */

async function handleWhisperStart(ctx, payload) {
  const parts = payload.split("_");

  const mode = parts[0];
  const chatId = parts[1];
  const token = parts.slice(2).join("_");

  const chat = db.chats[String(chatId)];
  const whisper = chat?.whispers?.[token];

  if (!whisper) {
    return ctx.reply(
      "هذه الهمسة غير موجودة أو انتهت."
    );
  }

  if (mode === "whisper") {
    if (
      String(ctx.from.id) !==
      String(whisper.targetId)
    ) {
      return ctx.reply(
        "هذه الهمسة ليست موجهة لك."
      );
    }

    const c = whisper.content;

    if (c.type === "text") {
      return ctx.reply(
        `• الهمسة:\n\n${c.text}`
      );
    }

    if (c.type === "photo") {
      return ctx.telegram.sendPhoto(
        ctx.from.id,
        c.fileId,
        {
          caption: c.caption || "• الهمسة"
        }
      );
    }

    if (c.type === "sticker") {
      return ctx.telegram.sendSticker(
        ctx.from.id,
        c.fileId
      );
    }

    if (c.type === "animation") {
      return ctx.telegram.sendAnimation(
        ctx.from.id,
        c.fileId,
        {
          caption: c.caption || "• الهمسة"
        }
      );
    }

    return ctx.reply("تم فتح الهمسة.");
  }

  if (mode === "reply") {
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

bot.start(async ctx => {
  ensureGlobalUser(ctx.from);

  if (ctx.chat.type !== "private") return;

  if (!db.globalSubscribers.includes(String(ctx.from.id))) {
    db.globalSubscribers.push(String(ctx.from.id));
    saveDB();
  }

  const payload = ctx.startPayload || "";

  if (
    payload.startsWith("whisper_") ||
    payload.startsWith("reply_")
  ) {
    return handleWhisperStart(
      ctx,
      payload
    );
  }

  const botUsername =
    ctx.botInfo?.username || "";

  await ctx.reply(
`اهلا بك يا قلبي - منشن الحساب بس

• انا اشغل لك اللي تبي بالمكالمه

ادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.`,
    {
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            "اضفني إلى مجموعتك",
            `https://t.me/${botUsername}?startgroup=true`
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
});

/* =========================================================
   الرتبة
========================================================= */

bot.hears("رتبتي", async ctx => {
  const chat = ensureChat(ctx.chat.id);

  await botReply(
    ctx,
    `رتبتك: ${getRank(
      chat,
      ctx.from.id
    )}`
  );
});

bot.hears("رتبته", async ctx => {
  const target = replyRequired(ctx);
  if (!target) return;

  const chat = ensureChat(ctx.chat.id);

  await botReply(
    ctx,
    `رتبته: ${getRank(
      chat,
      target.id
    )}`
  );
});

/* =========================================================
   التفاعل - بالشكل المطلوب
========================================================= */

bot.hears("تفاعلي", async ctx => {
  const chat = ensureChat(ctx.chat.id);

  const stats =
    getInteraction(
      chat,
      ctx.from.id
    );

  await botReply(
    ctx,
`• رتبتك هي ↤ ${getRank(
      chat,
      ctx.from.id
    )}

• رسائلك بالتفاعل  ↤  ${stats.messages}
• ترتيبك بالمتفاعلين ↤ ${getInteractionPosition(
      chat,
      ctx.from.id
    )}
-`
  );
});

bot.hears("تفاعله", async ctx => {
  const target = replyRequired(ctx);
  if (!target) return;

  const chat = ensureChat(ctx.chat.id);
  const stats =
    getInteraction(
      chat,
      target.id
    );

  await botReply(
    ctx,
`• رتبته هي ↤ ${getRank(
      chat,
      target.id
    )}

• رسائله بالتفاعل ↤ ${stats.messages}
• ترتيبه بالمتفاعلين ↤ ${getInteractionPosition(
      chat,
      target.id
    )}
-`
  );
});

bot.hears("المتفاعلين", async ctx => {
  const chat = ensureChat(ctx.chat.id);

  const list =
    getInteractionRanking(chat)
      .slice(0, 20);

  let output =
`• المتفاعلين
━━━━━━━━━━━`;

  let number = 1;

  for (
    const [id, item] of list
  ) {
    const user =
      chat.users[id] ||
      db.users[id];

    if (!user) continue;

    const name =
      user.firstName ||
      user.username ||
      "المستخدم";

    output +=
      `\n${number}. ${name} ↤︎ ${item.points || 0}`;

    number++;
  }

  await botReply(
    ctx,
    output
  );
});

/* =========================================================
   الرتب - رفع وتنزيل
========================================================= */

function rankAction(ctx, target, newRank) {
  const chat = ensureChat(ctx.chat.id);

  const actorRank =
    getRank(chat, ctx.from.id);

  const targetRank =
    getRank(chat, target.id);

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

async function setRank(ctx, newRank) {
  const target = replyRequired(ctx);
  if (!target) return;

  const error =
    rankAction(
      ctx,
      target,
      newRank
    );

  if (error) {
    return botReply(ctx, error);
  }

  const chat = ensureChat(ctx.chat.id);

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
`• المستخدم ذا ↤︎「${mentionUser(target)}」
• تم رفعه الرتبه ↤︎ ${newRank}`,
    {
      parse_mode: "MarkdownV2"
    }
  );
}

async function removeRank(ctx) {
  const target = replyRequired(ctx);
  if (!target) return;

  const chat = ensureChat(ctx.chat.id);

  const actorRank =
    getRank(chat, ctx.from.id);

  const targetRank =
    getRank(chat, target.id);

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
`• المستخدم ذا ↤︎「${mentionUser(target)}」
• تم تنزيل رتبته ↤︎ عضو`,
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
  const [command, rank, required] of rankCommands
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
      if (!requireRank(ctx, required)) return;
      await setRank(ctx, rank);
    }
  );
}

bot.hears(
  /^تنزيل\s+(مميز|مالك|اساس|M|My|اكس|ديف|مطور ثانوي)$/i,
  async ctx => {
    const rank =
      normalizeRank(ctx.match[1]);

    if (!rank) return;

    let required = "مميز";

    if (rankValue(rank) >= 6) {
      required = "Dev🎖️";
    } else if (rankValue(rank) >= 5) {
      required = "Dev²🎖️";
    } else if (rankValue(rank) >= 4) {
      required = "Myth";
    } else if (rankValue(rank) >= 3) {
      required = "Myth";
    } else if (rankValue(rank) >= 2) {
      required = "مالك أساسي";
    }

    if (!requireRank(ctx, required)) return;

    await removeRank(ctx);
  }
);

/* =========================================================
   الحماية
========================================================= */

function isProtectedRank(chat, userId) {
  return (
    rankValue(
      getRank(chat, userId)
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
    String(text || "").match(/[A-Za-z]/g);

  return !!letters && letters.length >= 3;
}

function hasAdvertisement(text) {
  const value =
    String(text || "").toLowerCase();

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
    words.some(word =>
      value.includes(word)
    ) &&
    (
      hasLink(text) ||
      /ريال|دولار|خصم|عرض/i.test(text)
    )
  );
}

function isLongMessage(text) {
  return String(text || "").length > 1000;
}

function isDuplicate(chat, userId, text) {
  const id = String(userId);

  chat._lastMessages ||= {};

  const now = Date.now();

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

  if (!previous) return false;

  return (
    previous.text === normalized &&
    now - previous.time <= 8000
  );
}

const protectionMessages = {
  "التعديل": "ممنوع ارسال تعديل الرسائل",
  "الروابط": "ممنوع إرسال الروابط",
  "التكرار": "ممنوع تكرار الرسائل",
  "الإعلانات": "ممنوع إرسال الإعلانات",
  "المنشن": "ممنوع إرسال المنشنات",
  "الفوروارد": "ممنوع إرسال الفوروارد",
  "الصور": "ممنوع إرسال الصور",
  "الفيديوهات": "ممنوع إرسال الفيديوهات",
  "الملفات": "ممنوع إرسال الملفات",
  "الملصقات": "ممنوع إرسال الملصقات",
  "GIF": "ممنوع إرسال الصور المتحركة",
  "الصوتيات": "ممنوع إرسال الصوتيات",
  "الرسائل الطويلة": "ممنوع إرسال الرسائل الطويلة",
  "الإنجليزية": "ممنوع إرسال الرسائل باللغة الإنجليزية",
  "أرقام الهواتف": "ممنوع إرسال أرقام الهواتف",
  "معرفات القنوات": "ممنوع إرسال معرفات القنوات والمجموعات",
  "الأوامر": "ممنوع إرسال الأوامر",
  "الكلمات الممنوعة": "ممنوع إرسال الكلمات الممنوعة",
  "ممنوع إرسال الرسائل": "ممنوع إرسال الرسائل"
};

async function registerProtectionViolation(ctx, reason) {
  const chat = ensureChat(ctx.chat.id);

  if (!chat.settings.warningsEnabled) {
    return 0;
  }

  const id = String(ctx.from.id);

  chat.warnings[id] =
    Number(chat.warnings[id] || 0) + 1;

  const user =
    ensureChatUser(
      chat,
      ctx.from
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
    count >= chat.settings.warningLimit
  ) {
    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        ctx.from.id,
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
    count >= chat.settings.warningLimit
  ) {
    try {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        ctx.from.id
      );

      chat.banned[id] = true;
    } catch {}
  }

  saveDB();

  return count;
}

/*
  الرد أولاً ثم الحذف.
  هذا كان أحد أسباب عدم ظهور رسالة الحماية.
*/
async function protectionDelete(ctx, reason) {
  const text =
    protectionMessages[reason] ||
    reason;

  try {
    await ctx.reply(
      `${mentionUser(ctx.from)}، ${text}`,
      {
        parse_mode: "MarkdownV2",
        reply_to_message_id:
          ctx.message.message_id
      }
    );
  } catch {}

  await registerProtectionViolation(
    ctx,
    reason
  );

  try {
    await ctx.telegram.deleteMessage(
      ctx.chat.id,
      ctx.message.message_id
    );
  } catch {}
}

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

    ensureChat(ctx.chat.id)
      .settings.protection = true;

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

    ensureChat(ctx.chat.id)
      .settings.protection = false;

    saveDB();

    await botReply(
      ctx,
      "تم تعطيل الحماية."
    );
  }
);

bot.hears(
  "فتح المخالفات",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    ensureChat(ctx.chat.id)
      .settings.violationsOpen = true;

    saveDB();

    await botReply(
      ctx,
      "تم فتح المخالفات."
    );
  }
);

bot.hears(
  "غلق المخالفات",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    ensureChat(ctx.chat.id)
      .settings.violationsOpen = false;

    saveDB();

    await botReply(
      ctx,
      "تم غلق المخالفات."
    );
  }
);

bot.hears(
  "تفعيل الحماية التلقائية",
  async ctx => {
    if (!requireAdminRank(ctx)) return;

    ensureChat(ctx.chat.id)
      .settings.automaticProtection = true;

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

    ensureChat(ctx.chat.id)
      .settings.automaticProtection = false;

    saveDB();

    await botReply(
      ctx,
      "تم تعطيل الحماية التلقائية."
    );
  }
);

for (
  const [name, key] of Object.entries(
    protectionSwitches
  )
) {
  bot.hears(
    `تفعيل منع ${name}`,
    async ctx => {
      if (!requireAdminRank(ctx)) return;

      ensureChat(ctx.chat.id)
        .settings[key] = true;

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

      ensureChat(ctx.chat.id)
        .settings[key] = false;

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
      ensureChat(ctx.chat.id).settings;

    await botReply(
      ctx,
`حالة الحماية

الحماية: ${s.protection ? "مفعلة" : "معطلة"}
الحماية التلقائية: ${s.automaticProtection ? "مفعلة" : "معطلة"}
المخالفات: ${s.violationsOpen ? "مفتوحة" : "مقفلة"}

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
   Middleware الحماية
========================================================= */

bot.on("message", async (ctx, next) => {
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
      ensureChat(ctx.chat.id);

    const s = chat.settings;

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

    const msg = ctx.message;

    const text =
      msg.text ||
      msg.caption ||
      "";

    if (s.locks.chat) {
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
      (s.preventMentions ||
        s.locks.mentions) &&
      hasMention(text)
    ) {
      return protectionDelete(
        ctx,
        "المنشن"
      );
    }

    if (
      (s.preventForwards ||
        s.locks.forwards) &&
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
        ctx
