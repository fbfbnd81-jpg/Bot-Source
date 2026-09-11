const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN غير موجود في متغيرات البيئة");
}

const bot = new Telegraf(BOT_TOKEN);

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "data.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_DATA = {
  users: {},
  groups: {},
  subscribers: []
};

let data = loadData();

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(DEFAULT_DATA, null, 2)
      );
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }

    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);

    return {
      ...DEFAULT_DATA,
      ...parsed,
      users: parsed.users || {},
      groups: parsed.groups || {},
      subscribers: parsed.subscribers || []
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2)
    );
  } catch (e) {
    console.error("SAVE ERROR:", e);
  }
}


/* =========================================================
   الرتب
========================================================= */

const ROLES = {
  عضو: 0,
  مميز: 1,
  مالك: 2,
  "مالك أساسي": 3,
  Myth: 4,
  "Myth🎖️": 5,
  "Dev²🎖️": 6,
  "Dev🎖️": 7
};

function roleName(level) {
  for (const [name, value] of Object.entries(ROLES)) {
    if (value === level) return name;
  }

  return "عضو";
}

function ensureUser(userId) {
  const id = String(userId);

  if (!data.users[id]) {
    data.users[id] = {
      id: Number(userId),
      role: 0,
      money: 0,
      title: "",
      channel: "",
      interactions: {},
      whispers: []
    };
  }

  if (!data.users[id].interactions) {
    data.users[id].interactions = {};
  }

  if (!data.users[id].whispers) {
    data.users[id].whispers = [];
  }

  return data.users[id];
}

function ensureGroup(chatId) {
  const id = String(chatId);

  if (!data.groups[id]) {
    data.groups[id] = {
      id: Number(chatId),

      users: {},

      muted: {},
      globalMuted: {},

      violationsEnabled: true,
      autoClean: false,

      linksEnabled: true,
      groupOpen: true,
      mentionEnabled: true,

      forbiddenWords: [],

      trackedMessages: [],
      interactions: {},

      customCommands: {},
      customReplies: {},

      marriages: {},

      gamesEnabled: true
    };
  }

  const group = data.groups[id];

  group.users ||= {};
  group.muted ||= {};
  group.globalMuted ||= {};
  group.trackedMessages ||= [];
  group.interactions ||= {};
  group.customCommands ||= {};
  group.customReplies ||= {};
  group.forbiddenWords ||= [];
  group.marriages ||= {};

  return group;
}


/* =========================================================
   j4xa7 = Dev🎖️ دائماً
========================================================= */

function getUserLevel(userId) {
  const user = ensureUser(userId);

  if (
    user.username &&
    user.username.toLowerCase() === "j4xa7"
  ) {
    return 7;
  }

  if (String(userId) === "j4xa7") {
    return 7;
  }

  return Number(user.role || 0);
}

function getChatUser(ctx, userId) {
  const group = ensureGroup(ctx.chat.id);
  const user = ensureUser(userId);

  const id = String(userId);

  if (!group.users[id]) {
    group.users[id] = {
      id: Number(userId),
      username: "",
      first_name: "",
      role: 0
    };
  }

  const saved = group.users[id];

  if (
    userId === ctx.from?.id
  ) {
    saved.username = ctx.from.username || saved.username;
    saved.first_name = ctx.from.first_name || saved.first_name;
  }

  return saved;
}

function getLevel(ctx, userId) {
  const user = ensureUser(userId);

  if (
    user.username &&
    user.username.toLowerCase() === "j4xa7"
  ) {
    return 7;
  }

  const globalLevel = Number(user.role || 0);
  const groupUser = getChatUser(ctx, userId);
  const groupLevel = Number(groupUser.role || 0);

  return Math.max(globalLevel, groupLevel);
}


/* =========================================================
   المنشن
========================================================= */

function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mention(user) {
  if (!user?.id) {
    return "المستخدم";
  }

  const name =
    user.first_name ||
    user.username ||
    "المستخدم";

  return `<a href="tg://user?id=${user.id}">${escapeHtml(name)}</a>`;
}

async function getRepliedUser(ctx) {
  const reply = ctx.message?.reply_to_message;

  if (!reply?.from) {
    return null;
  }

  return reply.from;
}


/* =========================================================
   الرد على نفس الأمر
========================================================= */

async function replyCommand(ctx, text, extra = {}) {
  try {
    return await ctx.reply(text, {
      parse_mode: "HTML",
      reply_parameters: {
        message_id: ctx.message.message_id
      },
      ...extra
    });
  } catch {
    return ctx.reply(text, {
      parse_mode: "HTML",
      ...extra
    });
  }
}


/* =========================================================
   الصلاحيات
========================================================= */

function hasRank(ctx, level) {
  return getLevel(ctx, ctx.from.id) >= level;
}

function requireRank(ctx, level) {
  if (hasRank(ctx, level)) {
    return true;
  }

  replyCommand(
    ctx,
    `• هذا الامر يخص ↤ ｢ ${escapeHtml(roleName(level))} وفوق ｣`
  );

  return false;
}

function canActOnTarget(ctx, target) {
  if (!target) return false;

  const actorLevel = getLevel(ctx, ctx.from.id);
  const targetLevel = getLevel(ctx, target.id);

  if (actorLevel <= targetLevel) {
    replyCommand(
      ctx,
      "• لا يمكن استخدام الامر على رتبه نفس رتبتك أو أعلى"
    );

    return false;
  }

  return true;
}


/* =========================================================
   تحديث المستخدمين
========================================================= */

bot.use(async (ctx, next) => {
  if (ctx.from) {
    const user = ensureUser(ctx.from.id);

    user.id = ctx.from.id;
    user.username = ctx.from.username || "";
    user.first_name = ctx.from.first_name || "";

    if (
      ctx.from.username &&
      ctx.from.username.toLowerCase() === "j4xa7"
    ) {
      user.role = 7;
    }
  }

  if (
    ctx.chat &&
    ctx.chat.type !== "private" &&
    ctx.from
  ) {
    const group = ensureGroup(ctx.chat.id);
    const id = String(ctx.from.id);

    group.users[id] ||= {
      id: ctx.from.id,
      username: "",
      first_name: "",
      role: 0
    };

    group.users[id].username =
      ctx.from.username || group.users[id].username;

    group.users[id].first_name =
      ctx.from.first_name || group.users[id].first_name;
  }

  await next();
});


/* =========================================================
   التفاعل
========================================================= */

function addInteraction(ctx) {
  if (!ctx.from || !ctx.chat) return;

  const group = ensureGroup(ctx.chat.id);
  const id = String(ctx.from.id);

  group.interactions[id] =
    Number(group.interactions[id] || 0) + 1;

  group.users[id] ||= {
    id: ctx.from.id,
    username: "",
    first_name: "",
    role: 0
  };

  group.users[id].username =
    ctx.from.username || group.users[id].username;

  group.users[id].first_name =
    ctx.from.first_name || group.users[id].first_name;
}


/* =========================================================
   تتبع الرسائل للتنظيف
========================================================= */

function trackMessage(ctx) {
  if (!ctx.message || !ctx.chat) return;

  if (ctx.chat.type === "private") return;

  const group = ensureGroup(ctx.chat.id);
  const msg = ctx.message;

  const tracked = {
    messageId: msg.message_id,
    chatId: ctx.chat.id,
    userId: ctx.from?.id || 0,
    text: msg.text || "",
    photo: !!msg.photo,
    video: !!msg.video,
    document: !!msg.document,
    sticker: !!msg.sticker,
    animation: !!msg.animation,
    audio: !!msg.audio,
    voice: !!msg.voice,
    date: Date.now()
  };

  group.trackedMessages.push(tracked);

  if (group.trackedMessages.length > 1000) {
    group.trackedMessages =
      group.trackedMessages.slice(-1000);
  }
}


/* =========================================================
   حماية الروابط والكلمات
========================================================= */

async function handleProtection(ctx) {
  if (!ctx.message || !ctx.chat) {
    return false;
  }

  if (ctx.chat.type === "private") {
    return false;
  }

  const group = ensureGroup(ctx.chat.id);
  const text = ctx.message.text || "";

  const level = getLevel(ctx, ctx.from.id);

  if (level >= 4) {
    return false;
  }

  if (
    group.linksEnabled === false &&
    /(https?:\/\/|www\.|t\.me\/)/i.test(text)
  ) {
    try {
      await ctx.deleteMessage();
    } catch {}

    return true;
  }

  if (
    group.forbiddenWords?.length &&
    group.forbiddenWords.some(word =>
      text.toLowerCase().includes(
        String(word).toLowerCase()
      )
    )
  ) {
    try {
      await ctx.deleteMessage();
    } catch {}

    return true;
  }

  return false;
}


/* =========================================================
   الكتم العام
========================================================= */

function isGlobalMuted(ctx) {
  const group = ensureGroup(ctx.chat.id);

  return !!group.globalMuted[String(ctx.from.id)];
}

function isMuted(ctx) {
  const group = ensureGroup(ctx.chat.id);

  return !!group.muted[String(ctx.from.id)];
}


/* =========================================================
   مراقبة الرسائل
========================================================= */

bot.on("message", async (ctx, next) => {
  try {
    if (ctx.chat?.type !== "private") {
      addInteraction(ctx);
      trackMessage(ctx);

      const protectedMessage =
        await handleProtection(ctx);

      if (protectedMessage) {
        saveData();
        return;
      }

      if (
        isMuted(ctx) ||
        isGlobalMuted(ctx)
      ) {
        try {
          await ctx.deleteMessage();
        } catch {}

        return;
      }

      const group = ensureGroup(ctx.chat.id);

      if (
        group.autoClean &&
        ctx.message?.text &&
        /(https?:\/\/|www\.|t\.me\/)/i.test(
          ctx.message.text
        )
      ) {
        try {
          await ctx.deleteMessage();
        } catch {}

        return;
      }
    }

    saveData();
  } catch (e) {
    console.error("MESSAGE ERROR:", e);
  }

  return next();
});


/* =========================================================
   START
========================================================= */

bot.start(async ctx => {
  if (
    ctx.chat.type === "private" &&
    !data.subscribers.includes(ctx.chat.id)
  ) {
    data.subscribers.push(ctx.chat.id);
    saveData();
  }

  const text =
    `أهلا بك يا قلبي - ${mention(ctx.from)}\n\n` +
    `• انا اشغل لك اللي تبي بالمكالمه\n\n` +
    `ادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.`;

  return ctx.reply(
    text,
    {
      parse_mode: "HTML",
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
});


/* =========================================================
   رتبتي
========================================================= */

bot.hears(/^رتبتي$/i, async ctx => {
  const level = getLevel(ctx, ctx.from.id);

  return replyCommand(
    ctx,
    `• رتبتك ↤︎ ${escapeHtml(roleName(level))}`
  );
});


/* =========================================================
   تفاعلي
========================================================= */

bot.hears(/^تفاعلي$/i, async ctx => {
  const group = ensureGroup(ctx.chat.id);
  const id = String(ctx.from.id);

  const count =
    Number(group.interactions[id] || 0);

  const ranking = Object.entries(
    group.interactions
  )
    .sort((a, b) => b[1] - a[1])
    .findIndex(([userId]) =>
      userId === id
    );

  return replyCommand(
    ctx,
    `• رتبتك ↤︎ ${escapeHtml(roleName(getLevel(ctx, ctx.from.id)))}\n` +
    `• عدد رسائل التفاعل ↤︎ ${count}\n` +
    `• ترتيبك بين المتفاعلين ↤︎ ${ranking + 1}`
  );
});


/* =========================================================
   المتفاعلين
========================================================= */

bot.hears(/^المتفاعلين$/i, async ctx => {
  const group = ensureGroup(ctx.chat.id);

  const list = Object.entries(
    group.interactions
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  if (!list.length) {
    return replyCommand(
      ctx,
      "• لا يوجد متفاعلين"
    );
  }

  const lines = [];

  for (let i = 0; i < list.length; i++) {
    const [id, count] = list[i];

    const member =
      group.users[id] || {
        id: Number(id),
        first_name: "مستخدم"
      };

    lines.push(
      `${i + 1}. ${mention(member)} ↤︎ ${count}`
    );
  }

  return replyCommand(
    ctx,
    "• المتفاعلين\n" +
    "━━━━━━━━━━━\n" +
    lines.join("\n")
  );
});


/* =========================================================
   رتبته
========================================================= */

bot.hears(/^رتبته$/i, async ctx => {
  const target = await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• لازم ترد على المستخدم"
    );
  }

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n` +
    `• رتبته ↤︎ ${escapeHtml(roleName(getLevel(ctx, target.id)))}`
  );
});


/* =========================================================
   تفاعله
========================================================= */

bot.hears(/^تفاعله$/i, async ctx => {
  const target = await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• لازم ترد على المستخدم"
    );
  }

  const group = ensureGroup(ctx.chat.id);
  const id = String(target.id);

  const count =
    Number(group.interactions[id] || 0);

  const ranking =
    Object.entries(group.interactions)
      .sort((a, b) => b[1] - a[1])
      .findIndex(([userId]) => userId === id);

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n` +
    `• عدد رسائل التفاعل ↤︎ ${count}\n` +
    `• ترتيبه بين المتفاعلين ↤︎ ${ranking >= 0 ? ranking + 1 : "-"}`
  );
});


/* =========================================================
   رفع الرتب
========================================================= */

const promotionCommands = [
  {
    regex: /^رفع مميز$/i,
    level: 1,
    name: "مميز",
    required: 2
  },
  {
    regex: /^رفع مالك$/i,
    level: 2,
    name: "مالك",
    required: 3
  },
  {
    regex: /^رفع مالك أساسي$/i,
    level: 3,
    name: "مالك أساسي",
    required: 5
  },
  {
    regex: /^رفع اساس$/i,
    level: 3,
    name: "مالك أساسي",
    required: 5
  },
  {
    regex: /^رفع Myth$/i,
    level: 4,
    name: "Myth",
    required: 5
  },
  {
    regex: /^رفع M$/i,
    level: 4,
    name: "Myth",
    required: 5
  },
  {
    regex: /^رفع Myth 🎖️$/i,
    level: 5,
    name: "Myth🎖️",
    required: 6
  },
  {
    regex: /^رفع My$/i,
    level: 5,
    name: "Myth🎖️",
    required: 6
  },
  {
    regex: /^رفع اكس$/i,
    level: 5,
    name: "Myth🎖️",
    required: 6
  },
  {
    regex: /^رفع Dev²$/i,
    level: 6,
    name: "Dev²🎖️",
    required: 7
  },
  {
    regex: /^رفع مطور ثانوي$/i,
    level: 6,
    name: "Dev²🎖️",
    required: 7
  },
  {
    regex: /^رفع ديف$/i,
    level: 7,
    name: "Dev🎖️",
    required: 7
  }
];

for (const item of promotionCommands) {
  bot.hears(item.regex, async ctx => {
    if (!requireRank(ctx, item.required)) {
      return;
    }

    const target =
      await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    if (!canActOnTarget(ctx, target)) {
      return;
    }

    const targetUser =
      ensureUser(target.id);

    targetUser.role = item.level;

    const group =
      ensureGroup(ctx.chat.id);

    group.users[String(target.id)] ||= {
      id: target.id,
      username: target.username || "",
      first_name: target.first_name || "",
      role: 0
    };

    group.users[String(target.id)].role =
      item.level;

    saveData();

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(target)}\n` +
      `• تم رفعه (${escapeHtml(item.name)})`
    );
  });
}


/* =========================================================
   تنزيل
========================================================= */

bot.hears(/^تنزيل$/i, async ctx => {
  if (!requireRank(ctx, 2)) {
    return;
  }

  const target =
    await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• لازم ترد على المستخدم"
    );
  }

  if (!canActOnTarget(ctx, target)) {
    return;
  }

  const targetUser =
    ensureUser(target.id);

  targetUser.role = 0;

  const group =
    ensureGroup(ctx.chat.id);

  if (group.users[String(target.id)]) {
    group.users[String(target.id)].role = 0;
  }

  saveData();

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n` +
    `• تم تنزيل رتبته`
  );
});


/* =========================================================
   الصلاحيات المطلوبة للأوامر
========================================================= */

const COMMAND_LEVELS = {
  mute: 4,
  globalMute: 5,
  restrict: 6,
  unrestrict: 3,
  unmute: 5,
  ban: 7,
  kick: 7,
  unban: 7
};

function requireModeration(ctx, key) {
  return requireRank(
    ctx,
    COMMAND_LEVELS[key]
  );
}


/* =========================================================
   كتم
========================================================= */

async function muteTarget(ctx, global = false) {
  const target =
    await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• لازم ترد على المستخدم"
    );
  }

  if (!canActOnTarget(ctx, target)) {
    return;
  }

  const group =
    ensureGroup(ctx.chat.id);

  if (global) {
    group.globalMuted[String(target.id)] = {
      id: target.id,
      username: target.username || "",
      first_name: target.first_name || ""
    };
  } else {
    group.muted[String(target.id)] = {
      id: target.id,
      username: target.username || "",
      first_name: target.first_name || ""
    };
  }

  saveData();

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n` +
    `• ${global ? "كتمته عام" : "كتمته"}`
  );
}

bot.hears(/^كتم$/i, async ctx => {
  if (!requireModeration(ctx, "mute")) {
    return;
  }

  return muteTarget(ctx, false);
});

bot.hears(/^كتم عام$/i, async ctx => {
  if (!requireModeration(ctx, "globalMute")) {
    return;
  }

  return muteTarget(ctx, true);
});


/* =========================================================
   فك الكتم
========================================================= */

bot.hears(/^فك الكتم$/i, async ctx => {
  if (!requireModeration(ctx, "unmute")) {
    return;
  }

  const target =
    await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• لازم ترد على المستخدم"
    );
  }

  const group =
    ensureGroup(ctx.chat.id);

  delete group.muted[String(target.id)];

  saveData();

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n` +
    `• فكيت الكتم عنه`
  );
});

bot.hears(/^فك الكتم العام$/i, async ctx => {
  if (!requireModeration(ctx, "globalMute")) {
    return;
  }

  const target =
    await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• لازم ترد على المستخدم"
    );
  }

  const group =
    ensureGroup(ctx.chat.id);

  delete group.globalMuted[String(target.id)];

  saveData();

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n` +
    `• فكيت الكتم العام عنه`
  );
});


/* =========================================================
   مم = مسح المكتومين
========================================================= */

bot.hears(/^مم$/i, async ctx => {
  if (!requireModeration(ctx, "mute")) {
    return;
  }

  const group =
    ensureGroup(ctx.chat.id);

  const muted =
    Object.values(group.muted || {});

  if (!muted.length) {
    return replyCommand(
      ctx,
      "• لا يوجد مكتومين"
    );
  }

  let count = 0;

  for (const user of muted) {
    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        user.id,
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
            can_add_web_page_previews: true,
            can_change_info: false,
            can_invite_users: true,
            can_pin_messages: false
          }
        }
      );

      delete group.muted[String(user.id)];
      count++;
    } catch {}
  }

  saveData();

  return replyCommand(
    ctx,
    `• تم فك الكتم عن ${count} من المكتومين`
  );
});


/* =========================================================
   خخ = مسح المكتومين عام
========================================================= */

bot.hears(/^خخ$/i, async ctx => {
  if (!requireModeration(ctx, "globalMute")) {
    return;
  }

  const group =
    ensureGroup(ctx.chat.id);

  const muted =
    Object.values(group.globalMuted || {});

  if (!muted.length) {
    return replyCommand(
      ctx,
      "• لا يوجد مكتومين عام"
    );
  }

  let count = 0;

  for (const user of muted) {
    delete group.globalMuted[String(user.id)];
    count++;
  }

  saveData();

  return replyCommand(
    ctx,
    `• تم فك الكتم العام عن ${count} من المكتومين`
  );
});


/* =========================================================
   تقييد
========================================================= */

bot.hears(/^تقييد$/i, async ctx => {
  if (!requireModeration(ctx, "restrict")) {
    return;
  }

  const target =
    await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• لازم ترد على المستخدم"
    );
  }

  if (!canActOnTarget(ctx, target)) {
    return;
  }

  try {
    await ctx.telegram.restrictChatMember(
      ctx.chat.id,
      target.id,
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
        }
      }
    );
  } catch {}

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n` +
    `• قيدته`
  );
});


/* =========================================================
   الغاء التقييد
========================================================= */

bot.hears(/^الغاء التقييد$/i, async ctx => {
  if (!requireModeration(ctx, "unrestrict")) {
    return;
  }

  const target =
    await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• لازم ترد على المستخدم"
    );
  }

  if (!canActOnTarget(ctx, target)) {
    return;
  }

  try {
    await ctx.telegram.restrictChatMember(
      ctx.chat.id,
      target.id,
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
          can_add_web_page_previews: true,
          can_invite_users: true
        }
      }
    );
  } catch {}

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n` +
    `• تم الغاء التقييد عنه`
  );
});


/* =========================================================
   رفع القيود
========================================================= */

bot.hears(/^رفع القيود$/i, async ctx => {
  if (!requireRank(ctx, 6)) {
    return;
  }

  const target =
    await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• لازم ترد على المستخدم"
    );
  }

  if (!canActOnTarget(ctx, target)) {
    return;
  }

  try {
    await ctx.telegram.restrictChatMember(
      ctx.chat.id,
      target.id,
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
          can_add_web_page_previews: true,
          can_invite_users: true
        }
      }
    );
  } catch {}

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n` +
    `• تم رفع القيود عنه`
  );
});


/* =========================================================
   حظر
========================================================= */

bot.hears(/^حظر$/i, async ctx => {
  if (!requireModeration(ctx, "ban")) {
    return;
  }

  const target =
    await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• لازم ترد على المستخدم"
    );
  }

  if (!canActOnTarget(ctx, target)) {
    return;
  }

  try {
    await ctx.telegram.banChatMember(
      ctx.chat.id,
      target.id
    );
  } catch {}

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n` +
    `• حظرته`
  );
});


/* =========================================================
   فك الحظر
========================================================= */

bot.hears(/^فك الحظر$/i, async ctx => {
  if (!requireModeration(ctx, "unban")) {
    return;
  }

  const target =
    await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• لازم ترد على المستخدم"
    );
  }

  try {
    await ctx.telegram.unbanChatMember(
      ctx.chat.id,
      target.id
    );
  } catch {}

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n` +
    `• فكيت الحظر عنه`
  );
});


/* =========================================================
   طرد
========================================================= */

bot.hears(/^طرد$/i, async ctx => {
  if (!requireModeration(ctx, "kick")) {
    return;
  }

  const target =
    await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• لازم ترد على المستخدم"
    );
  }

  if (!canActOnTarget(ctx, target)) {
    return;
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
  } catch {}

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n` +
    `• طردته`
  );
});


/* =========================================================
   فتح وغلق المخالفات
========================================================= */

bot.hears(/^فتح المخالفات$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  const group =
    ensureGroup(ctx.chat.id);

  group.violationsEnabled = true;

  saveData();

  return replyCommand(
    ctx,
    "• تم فتح المخالفات"
  );
});

bot.hears(/^(?:غلق|قفل) المخالفات$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  const group =
    ensureGroup(ctx.chat.id);

  group.violationsEnabled = false;

  saveData();

  return replyCommand(
    ctx,
    "• تم غلق المخالفات"
  );
});


/* =========================================================
   الروابط
========================================================= */

bot.hears(/^فتح الروابط$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  const group =
    ensureGroup(ctx.chat.id);

  group.linksEnabled = true;

  saveData();

  return replyCommand(
    ctx,
    "• تم فتح الروابط"
  );
});

bot.hears(/^قفل الروابط$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  const group =
    ensureGroup(ctx.chat.id);

  group.linksEnabled = false;

  saveData();

  return replyCommand(
    ctx,
    "• تم قفل الروابط"
  );
});


/* =========================================================
   فتح وقفل القروب
========================================================= */

bot.hears(/^فتح القروب$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  const group =
    ensureGroup(ctx.chat.id);

  group.groupOpen = true;

  try {
    await ctx.telegram.setChatPermissions(
      ctx.chat.id,
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
        can_pin_messages: false
      }
    );
  } catch {}

  saveData();

  return replyCommand(
    ctx,
    "• تم فتح القروب"
  );
});

bot.hears(/^قفل القروب$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  const group =
    ensureGroup(ctx.chat.id);

  group.groupOpen = false;

  try {
    await ctx.telegram.setChatPermissions(
      ctx.chat.id,
      {
        can_send_messages: false
      }
    );
  } catch {}

  saveData();

  return replyCommand(
    ctx,
    "• تم قفل القروب"
  );
});


/* =========================================================
   التنظيف بالأرقام فقط
========================================================= */

async function cleanMessages(ctx, type) {
  if (!requireRank(ctx, 4)) {
    return;
  }

  const group =
    ensureGroup(ctx.chat.id);

  const messages =
    group.trackedMessages || [];

  let selected = [];

  for (const msg of messages) {
    if (msg.chatId !== ctx.chat.id) {
      continue;
    }

    if (type === 0 && msg.text) {
      selected.push(msg.messageId);
    }

    if (type === 1 && msg.photo) {
      selected.push(msg.messageId);
    }

    if (type === 2 && msg.video) {
      selected.push(msg.messageId);
    }

    if (type === 3 && msg.document) {
      selected.push(msg.messageId);
    }

    if (type === 4 && msg.sticker) {
      selected.push(msg.messageId);
    }

    if (type === 5 && msg.animation) {
      selected.push(msg.messageId);
    }

    if (type === 6 && msg.audio) {
      selected.push(msg.messageId);
    }

    if (type === 7 && msg.voice) {
      selected.push(msg.messageId);
    }

    if (
      type === 8 &&
      msg.text &&
      /(https?:\/\/|www\.|t\.me\/)/i.test(msg.text)
    ) {
      selected.push(msg.messageId);
    }

    if (
      type === 9 &&
      (
        msg.photo ||
        msg.video ||
        msg.document ||
        msg.sticker ||
        msg.animation ||
        msg.audio ||
        msg.voice
      )
    ) {
      selected.push(msg.messageId);
    }
  }

  selected =
    [...new Set(selected)].slice(-100);

  if (!selected.length) {
    return replyCommand(
      ctx,
      "• لا توجد رسائل مطابقة"
    );
  }

  let deleted = 0;

  for (const messageId of selected) {
    try {
      await ctx.telegram.deleteMessage(
        ctx.chat.id,
        messageId
      );

      deleted++;
    } catch {}
  }

  group.trackedMessages =
    messages.filter(
      x => !selected.includes(x.messageId)
    );

  saveData();

  return replyCommand(
    ctx,
    `• بواسطة ${mention(ctx.from)}\n• مسحت ( ${deleted} )`
  );
}

for (let i = 0; i <= 9; i++) {
  bot.hears(
    new RegExp(`^${i}$`),
    async ctx => {
      return cleanMessages(ctx, i);
    }
  );
}


/* =========================================================
   التنظيف التلقائي
========================================================= */

bot.hears(/^تفعيل التنظيف التلقائي$/i, async ctx => {
  if (!requireRank(ctx, 4)) return;

  const group =
    ensureGroup(ctx.chat.id);

  group.autoClean = true;

  saveData();

  return replyCommand(
    ctx,
    "• تم تفعيل التنظيف التلقائي"
  );
});

bot.hears(/^تعطيل التنظيف التلقائي$/i, async ctx => {
  if (!requireRank(ctx, 4)) return;

  const group =
    ensureGroup(ctx.chat.id);

  group.autoClean = false;

  saveData();

  return replyCommand(
    ctx,
    "• تم تعطيل التنظيف التلقائي"
  );
});


/* =========================================================
   @all
========================================================= */

bot.hears(/^@all$/i, async ctx => {
  const group =
    ensureGroup(ctx.chat.id);

  if (group.mentionEnabled === false) {
    return replyCommand(
      ctx,
      "• المنشن مقفل"
    );
  }

  const users =
    Object.values(group.users || {});

  if (!users.length) {
    return replyCommand(
      ctx,
      "• لا يوجد أعضاء محفوظين"
    );
  }

  let current = "";
  const messages = [];

  for (const user of users) {
    const line =
      mention(user) + " ";

    if (
      current.length + line.length > 3500
    ) {
      messages.push(current);
      current = "";
    }

    current += line;
  }

  if (current) {
    messages.push(current);
  }

  for (const message of messages) {
    await ctx.reply(
      message,
      {
        parse_mode: "HTML",
        disable_web_page_preview: true
      }
    );
  }
});


/* =========================================================
   فتح وغلق المنشن
========================================================= */

bot.hears(/^فتح المنشن$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  const group =
    ensureGroup(ctx.chat.id);

  group.mentionEnabled = true;

  saveData();

  return replyCommand(
    ctx,
    "• تم فتح المنشن"
  );
});

bot.hears(/^غلق المنشن$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  const group =
    ensureGroup(ctx.chat.id);

  group.mentionEnabled = false;

  saveData();

  return replyCommand(
    ctx,
    "• تم غلق المنشن"
  );
});


/* =========================================================
   الكلمات الممنوعة
========================================================= */

bot.hears(/^منع الكلمه(?:\s+(.+))?$/i, async ctx => {
  if (!requireRank(ctx, 6)) return;

  const word =
    ctx.match[1]?.trim();

  if (!word) {
    return replyCommand(
      ctx,
      "• اكتب الكلمة"
    );
  }

  const group =
    ensureGroup(ctx.chat.id);

  if (!group.forbiddenWords.includes(word)) {
    group.forbiddenWords.push(word);
  }

  saveData();

  return replyCommand(
    ctx,
    "• تم منع الكلمه"
  );
});

bot.hears(/^الغاء منع الكلمه(?:\s+(.+))?$/i, async ctx => {
  if (!requireRank(ctx, 6)) return;

  const word =
    ctx.match[1]?.trim();

  if (!word) {
    return replyCommand(
      ctx,
      "• اكتب الكلمة"
    );
  }

  const group =
    ensureGroup(ctx.chat.id);

  group.forbiddenWords =
    group.forbiddenWords.filter(
      x => x !== word
    );

  saveData();

  return replyCommand(
    ctx,
    "• تم الغاء منع الكلمه"
  );
});

bot.hears(/^الكلمات الممنوعه$/i, async ctx => {
  if (!requireRank(ctx, 6)) return;

  const group =
    ensureGroup(ctx.chat.id);

  if (!group.forbiddenWords.length) {
    return replyCommand(
      ctx,
      "• لا يوجد كلمات ممنوعه"
    );
  }

  return replyCommand(
    ctx,
    "• الكلمات الممنوعه\n━━━━━━━━━━━\n" +
    group.forbiddenWords
      .map((x, i) => `${i + 1}. ${escapeHtml(x)}`)
      .join("\n")
  );
});

bot.hears(/^مسح الكلمات الممنوعه$/i, async ctx => {
  if (!requireRank(ctx, 6)) return;

  const group =
    ensureGroup(ctx.chat.id);

  group.forbiddenWords = [];

  saveData();

  return replyCommand(
    ctx,
    "• تم مسح الكلمات الممنوعه"
  );
});


/* =========================================================
   الألقاب
========================================================= */

bot.hears(/^ضع(?:\s+(.+))?$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  const target =
    await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• لازم ترد على المستخدم"
    );
  }

  const title =
    ctx.match[1]?.trim();

  if (!title) {
    return replyCommand(
      ctx,
      "• اكتب اللقب"
    );
  }

  const user =
    ensureUser(target.id);

  user.title = title;

  saveData();

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n• تم وضع اللقب`
  );
});

bot.hears(/^لقبي$/i, async ctx => {
  const user =
    ensureUser(ctx.from.id);

  if (!user.title) {
    return replyCommand(
      ctx,
      "• ما عندك لقب"
    );
  }

  return replyCommand(
    ctx,
    `• لقبك ↤︎ ${escapeHtml(user.title)}`
  );
});

bot.hears(/^لقبه$/i, async ctx => {
  const target =
    await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• لازم ترد على المستخدم"
    );
  }

  const user =
    ensureUser(target.id);

  if (!user.title) {
    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(target)}\n• ما عنده لقب`
    );
  }

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n• لقبه ↤︎ ${escapeHtml(user.title)}`
  );
});


/* =========================================================
   الهمسات
========================================================= */

const whisperPending = new Map();
const whisperStore = new Map();

function createWhisperId() {
  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2, 8)
  );
}

bot.hears(/^(?:اهمس|همسه|ه)$/i, async ctx => {
  if (ctx.chat.type === "private") {
    return replyCommand(
      ctx,
      "• استخدم الهمسه داخل القروب بالرد على المستخدم"
    );
  }

  const target =
    await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• لازم ترد على المستخدم اللي تبي تهمس له"
    );
  }

  const id =
    createWhisperId();

  whisperPending.set(id, {
    senderId: ctx.from.id,
    sender: ctx.from,
    recipientId: target.id,
    chatId: ctx.chat.id
  });

  const username =
    ctx.botInfo?.username ||
    "";

  return replyCommand(
    ctx,
    `• تم تحديد الهمسه لـ ↤ ${mention(target)}\n` +
    `• اضغط الزر لكتابة الهمسة`,
    {
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            "اهمس هنا",
            `https://t.me/${username}?start=whisper_${id}`
          )
        ]
      ])
    }
  );
});


/* =========================================================
   START للهمسة
========================================================= */

bot.command("start", async ctx => {
  const text =
    ctx.startPayload || "";

  if (
    text.startsWith("whisper_")
  ) {
    const id =
      text.substring("whisper_".length);

    const pending =
      whisperPending.get(id);

    if (!pending) {
      return ctx.reply(
        "• الهمسه غير موجوده أو انتهت"
      );
    }

    if (
      ctx.from.id !==
      pending.recipientId
    ) {
      return ctx.reply(
        "• هذه الهمسه ليست لك"
      );
    }

    whisperStore.set(id, {
      ...pending,
      createdAt: Date.now()
    });

    whisperPending.delete(id);

    return ctx.reply(
      "• أرسل الآن الهمسة\n" +
      "• يمكنك إرسال نص أو ملصق أو صورة أو قيف\n" +
      "-"
    );
  }

  if (
    ctx.chat.type === "private" &&
    !data.subscribers.includes(ctx.chat.id)
  ) {
    data.subscribers.push(ctx.chat.id);
    saveData();
  }

  return ctx.reply(
    `أهلا بك يا قلبي - ${mention(ctx.from)}\n\n` +
    `• انا اشغل لك اللي تبي بالمكالمه\n\n` +
    `ادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.`,
    {
      parse_mode: "HTML",
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
});


/* =========================================================
   استقبال محتوى الهمسة
========================================================= */

bot.on("message", async (ctx, next) => {
  if (ctx.chat.type !== "private") {
    return next();
  }

  let foundId = null;
  let whisper = null;

  for (const [id, item] of whisperStore.entries()) {
    if (
      item.recipientId === ctx.from.id
    ) {
      foundId = id;
      whisper = item;
      break;
    }
  }

  if (!whisper) {
    return next();
  }

  let content = null;

  if (ctx.message.text) {
    content = {
      type: "text",
      text: ctx.message.text
    };
  } else if (ctx.message.sticker) {
    content = {
      type: "sticker",
      file_id: ctx.message.sticker.file_id
    };
  } else if (ctx.message.photo) {
    content = {
      type: "photo",
      file_id:
        ctx.message.photo[
          ctx.message.photo.length - 1
        ].file_id,
      caption:
        ctx.message.caption || ""
    };
  } else if (ctx.message.animation) {
    content = {
      type: "animation",
      file_id:
        ctx.message.animation.file_id,
      caption:
        ctx.message.caption || ""
    };
  }

  if (!content) {
    return ctx.reply(
      "• نوع الرسالة غير مدعوم"
    );
  }

  whisper.content = content;

  whisperStore.set(
    foundId,
    whisper
  );

  try {
    await ctx.deleteMessage();
  } catch {}

  await ctx.reply(
    "• تم ارسال الهمسة"
  );

  try {
    await ctx.telegram.sendMessage(
      whisper.chatId,
      `• ياحلو ↤ ${mention({
        id: whisper.recipientId,
        first_name:
          whisper.recipientId === ctx.from.id
            ? ctx.from.first_name
            : "المستلم"
      })}\n` +
      `• وصلتك همسة سرية من ↤ ${mention(whisper.sender)}\n` +
      `• انت وحدك تقدر تشوفها`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "رؤية الهمسة",
              `whisper_view_${foundId}`
            )
          ],
          [
            Markup.button.callback(
              "رد على الهمسة",
              `whisper_reply_${foundId}`
            )
          ]
        ])
      }
    );
  } catch {}

  return;
});


/* =========================================================
   رؤية الهمسة
========================================================= */

bot.action(
  /^whisper_view_(.+)$/,
  async ctx => {
    await ctx.answerCbQuery();

    const id =
      ctx.match[1];

    const whisper =
      whisperStore.get(id);

    if (!whisper) {
      return ctx.reply(
        "• الهمسه غير موجوده"
      );
    }

    if (
      ctx.from.id !==
      whisper.recipientId
    ) {
      return ctx.reply(
        "• هذه الهمسه ليست لك"
      );
    }

    const content =
      whisper.content;

    try {
      if (content.type === "text") {
        await ctx.reply(
          `• الهمسة\n\n${escapeHtml(content.text)}`,
          {
            parse_mode: "HTML"
          }
        );
      }

      if (content.type === "sticker") {
        await ctx.replyWithSticker(
          content.file_id
        );
      }

      if (content.type === "photo") {
        await ctx.replyWithPhoto(
          content.file_id,
          {
            caption:
              content.caption || ""
          }
        );
      }

      if (content.type === "animation") {
        await ctx.replyWithAnimation(
          content.file_id,
          {
            caption:
              content.caption || ""
          }
        );
      }

      try {
        await ctx.telegram.sendMessage(
          whisper.chatId,
          `• شاف همستك .`,
          {
            parse_mode: "HTML"
          }
        );
      } catch {}
    } catch {
      return ctx.reply(
        "• تعذر عرض الهمسة"
      );
    }
  }
);


/* =========================================================
   الرد على الهمسة
========================================================= */

bot.action(
  /^whisper_reply_(.+)$/,
  async ctx => {
    await ctx.answerCbQuery();

    const id =
      ctx.match[1];

    const whisper =
      whisperStore.get(id);

    if (!whisper) {
      return ctx.reply(
        "• الهمسه غير موجوده"
      );
    }

    if (
      ctx.from.id !==
      whisper.recipientId
    ) {
      return ctx.reply(
        "• هذه الهمسه ليست لك"
      );
    }

    const username =
      ctx.botInfo?.username ||
      "";

    whisperPending.set(
      `reply_${id}`,
      {
        senderId: ctx.from.id,
        sender: ctx.from,
        recipientId: whisper.senderId,
        chatId: whisper.chatId
      }
    );

    return ctx.reply(
      "• أرسل الآن ردك على الهمسة"
    );
  }
);


/* =========================================================
   بحث الأغاني
========================================================= */

bot.hears(
  /^(?:بحث|اغنية|أغنية|شغل|تشغيل)\s+(.+)$/i,
  async ctx => {
    const query =
      ctx.match[1]?.trim();

    if (!query) {
      return replyCommand(
        ctx,
        "• اكتب اسم الأغنية"
      );
    }

    return replyCommand(
      ctx,
      `• بحث الأغاني غير مفعل حالياً\n• البحث عن ↤︎ ${escapeHtml(query)}`
    );
  }
);


/* =========================================================
   إضافة رد
========================================================= */

const customPending =
  new Map();

bot.hears(
  /^اضف امر(?:\s+(.+))?$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) return;

    const name =
      ctx.match[1]?.trim();

    if (!name) {
      return replyCommand(
        ctx,
        "• اكتب اسم الأمر"
      );
    }

    customPending.set(
      ctx.from.id,
      {
        type: "command",
        chatId: ctx.chat.id,
        name
      }
    );

    return replyCommand(
      ctx,
      "• أرسل الآن رد الأمر"
    );
  }
);

bot.hears(
  /^اضف رد(?:\s+(.+))?$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) return;

    const word =
      ctx.match[1]?.trim();

    if (!word) {
      return replyCommand(
        ctx,
        "• اكتب الكلمة"
      );
    }

    customPending.set(
      ctx.from.id,
      {
        type: "reply",
        chatId: ctx.chat.id,
        word
      }
    );

    return replyCommand(
      ctx,
      "• أرسل الآن رد الكلمة"
    );
  }
);

bot.hears(
  /^حذف امر(?:\s+(.+))?$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) return;

    const name =
      ctx.match[1]?.trim();

    const group =
      ensureGroup(ctx.chat.id);

    if (!group.customCommands[name]) {
      return replyCommand(
        ctx,
        "• الأمر غير موجود"
      );
    }

    delete group.customCommands[name];

    saveData();

    return replyCommand(
      ctx,
      "• تم حذف الأمر"
    );
  }
);

bot.hears(
  /^حذف رد(?:\s+(.+))?$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) return;

    const word =
      ctx.match[1]?.trim();

    const group =
      ensureGroup(ctx.chat.id);

    if (!group.customReplies[word]) {
      return replyCommand(
        ctx,
        "• الرد غير موجود"
      );
    }

    delete group.customReplies[word];

    saveData();

    return replyCommand(
      ctx,
      "• تم حذف الرد"
    );
  }
);

bot.hears(
  /^اوامري$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) return;

    const group =
      ensureGroup(ctx.chat.id);

    const list =
      Object.keys(group.customCommands);

    if (!list.length) {
      return replyCommand(
        ctx,
        "• لا يوجد أوامر مخصصة"
      );
    }

    return replyCommand(
      ctx,
      "• الأوامر المخصصة\n━━━━━━━━━━━\n" +
      list.map(
        (x, i) =>
          `${i + 1}. ${escapeHtml(x)}`
      ).join("\n")
    );
  }
);

bot.hears(
  /^ردودي$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) return;

    const group =
      ensureGroup(ctx.chat.id);

    const list =
      Object.keys(group.customReplies);

    if (!list.length) {
      return replyCommand(
        ctx,
        "• لا يوجد ردود مخصصة"
      );
    }

    return replyCommand(
      ctx,
      "• الردود المخصصة\n━━━━━━━━━━━\n" +
      list.map(
        (x, i) =>
          `${i + 1}. ${escapeHtml(x)}`
      ).join("\n")
    );
  }
);


/* =========================================================
   استقبال الأوامر المخصصة
========================================================= */

bot.on("text", async (ctx, next) => {
  if (
    ctx.chat.type !== "private"
  ) {
    const pending =
      customPending.get(
        ctx.from.id
      );

    if (
      pending &&
      pending.chatId === ctx.chat.id
    ) {
      if (
        pending.type === "command"
      ) {
        const group =
          ensureGroup(ctx.chat.id);

        group.customCommands[
          pending.name
        ] = ctx.message.text;

        customPending.delete(
          ctx.from.id
        );

        saveData();

        return replyCommand(
          ctx,
          "• تم حفظ الأمر المخصص"
        );
      }

      if (
        pending.type === "reply"
      ) {
        const group =
          ensureGroup(ctx.chat.id);

        group.customReplies[
          pending.word
        ] = ctx.message.text;

        customPending.delete(
          ctx.from.id
        );

        saveData();

        return replyCommand(
          ctx,
          "• تم حفظ الرد المخصص"
        );
      }
    }

    const group =
      ensureGroup(ctx.chat.id);

    const text =
      ctx.message.text.trim();

    if (
      group.customCommands[text]
    ) {
      return replyCommand(
        ctx,
        group.customCommands[text]
      );
    }

    if (
      group.customReplies[text]
    ) {
      return replyCommand(
        ctx,
        group.customReplies[text]
      );
    }
  }

  return next();
});


/* =========================================================
   قفل الألعاب
========================================================= */

bot.hears(/^قفل الالعاب$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  const group =
    ensureGroup(ctx.chat.id);

  group.gamesEnabled = false;

  saveData();

  return replyCommand(
    ctx,
    "• تم قفل الالعاب"
  );
});

bot.hears(/^فتح الالعاب$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  const group =
    ensureGroup(ctx.chat.id);

  group.gamesEnabled = true;

  saveData();

  return replyCommand(
    ctx,
    "• تم فتح الالعاب"
  );
});


/* =========================================================
   أوامر
========================================================= */

const mainMenu =
  Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "المطور",
        "menu_dev"
      ),
      Markup.button.callback(
        "الرتب",
        "menu_roles"
      )
    ],
    [
      Markup.button.callback(
        "الحماية",
        "menu_protection"
      ),
      Markup.button.callback(
        "التفاعل والألعاب والفعاليات",
        "menu_games"
      )
    ],
    [
      Markup.button.callback(
        "الهمسات والأغاني",
        "menu_music"
      ),
      Markup.button.callback(
        "الأوامر المخصصة",
        "menu_custom"
      )
    ],
    [
      Markup.button.callback(
        "القروب",
        "menu_group"
      )
    ]
  ]);

const menuText = {
  dev:
    "• المطور\n\n" +
    "• حالة البوت\n" +
    "• إذاعة",

  roles:
    "• الرتب\n\n" +
    "• رفع مميز\n" +
    "• رفع مالك\n" +
    "• رفع مالك أساسي\n" +
    "• رفع Myth\n" +
    "• رفع Myth🎖️\n" +
    "• رفع Dev²\n" +
    "• رفع ديف\n" +
    "• تنزيل",

  protection:
    "• الحماية\n\n" +
    "• كتم\n" +
    "• كتم عام\n" +
    "• حظر\n" +
    "• طرد\n" +
    "• تقييد\n" +
    "• الغاء التقييد\n" +
    "• رفع القيود\n" +
    "• مم\n" +
    "• خخ\n" +
    "• فتح الروابط\n" +
    "• قفل الروابط\n" +
    "• فتح القروب\n" +
    "• قفل القروب\n" +
    "• تفعيل التنظيف التلقائي",

  games:
    "• التفاعل والألعاب والفعاليات\n\n" +
    "• تفاعلي\n" +
    "• المتفاعلين\n" +
    "• قفل الالعاب\n" +
    "• فتح الالعاب",

  music:
    "• الهمسات والأغاني\n\n" +
    "• اهمس\n" +
    "• همسه\n" +
    "• ه\n" +
    "• بحث أغنية",

  custom:
    "• الأوامر المخصصة\n\n" +
    "• اضف امر\n" +
    "• حذف امر\n" +
    "• اضف رد\n" +
    "• حذف رد\n" +
    "• اوامري\n" +
    "• ردودي",

  group:
    "• القروب\n\n" +
    "• رتبتي\n" +
    "• رتبته\n" +
    "• تفاعلي\n" +
    "• تفاعله\n" +
    "• المتفاعلين\n" +
    "• @all"
};

bot.hears(/^اوامر$/i, async ctx => {
  return ctx.reply(
    "• أوامر البوت",
    {
      ...mainMenu
    }
  );
});

for (const key of Object.keys(menuText)) {
  bot.action(
    `menu_${key}`,
    async ctx => {
      await ctx.answerCbQuery();

      return ctx.editMessageText(
        menuText[key],
        {
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "رجوع",
                "menu_home"
              )
            ]
          ])
        }
      );
    }
  );
}

bot.action(
  "menu_home",
  async ctx => {
    await ctx.answerCbQuery();

    return ctx.editMessageText(
      "• أوامر البوت",
      {
        ...mainMenu
      }
    );
  }
);


/* =========================================================
   الإذاعة
========================================================= */

const broadcastPending =
  new Map();

bot.hears(/^إذاعة$/i, async ctx => {
  if (ctx.chat.type !== "private") {
    return replyCommand(
      ctx,
      "• استخدم الإذاعة في الخاص"
    );
  }

  if (!hasRank(ctx, 7)) {
    return replyCommand(
      ctx,
      "• هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
    );
  }

  broadcastPending.set(
    ctx.from.id,
    true
  );

  return replyCommand(
    ctx,
    "• أرسل الآن رسالة الإذاعة"
  );
});

bot.on("message", async (ctx, next) => {
  if (
    ctx.chat.type !== "private"
  ) {
    return next();
  }

  if (
    !broadcastPending.get(
      ctx.from.id
    )
  ) {
    return next();
  }

  if (!hasRank(ctx, 7)) {
    broadcastPending.delete(
      ctx.from.id
    );

    return next();
  }

  broadcastPending.delete(
    ctx.from.id
  );

  let success = 0;
  let failed = 0;

  for (
    const chatId of data.subscribers
  ) {
    try {
      await ctx.telegram.copyMessage(
        chatId,
        ctx.chat.id,
        ctx.message.message_id
      );

      success++;
    } catch {
      failed++;
    }
  }

  return ctx.reply(
    `• تم إرسال الإذاعة\n• نجح ↤︎ ${success}\n• فشل ↤︎ ${failed}`
  );
});


/* =========================================================
   حالة البوت
========================================================= */

bot.hears(/^حالة البوت$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  return replyCommand(
    ctx,
    `• حالة البوت\n━━━━━━━━━━━\n• القروبات ↤︎ ${Object.keys(data.groups).length}\n• المستخدمين ↤︎ ${Object.keys(data.users).length}\n• المشتركين ↤︎ ${data.subscribers.length}\n• الحالة ↤︎ يعمل`
  );
});


/* =========================================================
   أخطاء البوت
========================================================= */

bot.catch(async (error, ctx) => {
  console.error(
    "BOT ERROR:",
    error
  );

  try {
    await ctx.reply(
      "• حدث خطأ أثناء تنفيذ الأمر"
    );
  } catch {}
});


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

(async () => {
  try {
    await bot.launch();

    console.log(
      "Bot is running successfully."
    );
  } catch (error) {
    console.error(
      "Failed to start bot:",
      error
    );
  }
})();
