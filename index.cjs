const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN غير موجود في متغيرات البيئة");
}

const bot = new Telegraf(BOT_TOKEN);

/* =========================================================
   الإعدادات
========================================================= */

const DEV_USERNAME = "j4xa7";

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "data.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* =========================================================
   البيانات
========================================================= */

const DEFAULT_DATA = {
  users: {},
  groups: {},
  subscribers: []
};

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

    if (!raw.trim()) {
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }

    const data = JSON.parse(raw);

    data.users ||= {};
    data.groups ||= {};
    data.subscribers ||= [];

    return data;
  } catch (err) {
    console.error("خطأ في قراءة البيانات:", err);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

const data = loadData();

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2)
    );
  } catch (err) {
    console.error("خطأ في حفظ البيانات:", err);
  }
}

/* =========================================================
   الرتب الداخلية للبوت
========================================================= */

const ROLES = {
  "عضو": 0,
  "مميز": 1,
  "مالك": 2,
  "مالك أساسي": 3,
  "Myth": 4,
  "Myth🎖️": 5,
  "Dev²🎖️": 6,
  "Dev🎖️": 7
};

const LEVEL_NAMES = {
  0: "عضو",
  1: "مميز",
  2: "مالك",
  3: "مالك أساسي",
  4: "Myth",
  5: "Myth🎖️",
  6: "Dev²🎖️",
  7: "Dev🎖️"
};

/* =========================================================
   المجموعات
========================================================= */

function ensureGroup(chatId) {
  const id = String(chatId);

  if (!data.groups[id]) {
    data.groups[id] = {
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
      gamesEnabled: true,
      games: {},
      botReplies: true,
      musicEnabled: true,
      adminPermissions: {}
    };
  }

  const g = data.groups[id];

  g.users ||= {};
  g.muted ||= {};
  g.globalMuted ||= {};
  g.violationsEnabled ??= true;
  g.autoClean ??= false;
  g.linksEnabled ??= true;
  g.groupOpen ??= true;
  g.mentionEnabled ??= true;
  g.forbiddenWords ||= [];
  g.trackedMessages ||= [];
  g.interactions ||= {};
  g.customCommands ||= {};
  g.customReplies ||= {};
  g.marriages ||= {};
  g.gamesEnabled ??= true;
  g.games ||= {};
  g.botReplies ??= true;
  g.musicEnabled ??= true;
  g.adminPermissions ||= {};

  return g;
}

function ensureUser(user) {
  if (!user || !user.id) return null;

  const id = String(user.id);

  if (!data.users[id]) {
    data.users[id] = {
      id: user.id,
      username: user.username || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      role: "عضو",
      title: "",
      messages: 0
    };
  }

  const u = data.users[id];

  u.id = user.id;
  u.username = user.username || u.username || "";
  u.first_name = user.first_name || u.first_name || "";
  u.last_name = user.last_name || u.last_name || "";
  u.role ||= "عضو";
  u.title ||= "";
  u.messages ||= 0;

  return u;
}

/* =========================================================
   الرتب
========================================================= */

function isDeveloper(user) {
  return (
    user &&
    String(user.username || "").toLowerCase() ===
      DEV_USERNAME.toLowerCase()
  );
}

function getUserLevel(userId) {
  const user = data.users[String(userId)];

  if (!user) return 0;

  if (
    String(user.username || "").toLowerCase() ===
    DEV_USERNAME.toLowerCase()
  ) {
    return 7;
  }

  return ROLES[user.role] ?? 0;
}

function getLevelName(level) {
  return LEVEL_NAMES[level] || "عضو";
}

async function getChatUser(ctx, userId) {
  try {
    return await ctx.telegram.getChatMember(
      ctx.chat.id,
      userId
    );
  } catch {
    return null;
  }
}

/*
   مهم:
   رتبة البوت الداخلية منفصلة عن "رفع مشرف".
   المشرف في تيليجرام لا يتحول تلقائيًا إلى مالك داخل البوت.
*/

async function getLevel(ctx, userId) {
  const member = await getChatUser(ctx, userId);

  /*
     مالك القروب له صلاحية المالك الأساسية
     داخل أوامر الإدارة، لكن المشرف العادي
     لا يتحول تلقائيًا إلى "مالك".
  */

  if (
    member &&
    member.status === "creator"
  ) {
    return Math.max(
      3,
      getUserLevel(userId)
    );
  }

  return getUserLevel(userId);
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
  if (!user) {
    return "المستخدم";
  }

  const id = user.id;

  const name =
    user.first_name ||
    user.username ||
    "المستخدم";

  const stored = data.users[String(id)];

  const title =
    stored?.title ||
    "";

  const text = title
    ? `${name}「${title}」`
    : name;

  return `<a href="tg://user?id=${id}">${escapeHtml(text)}</a>`;
}

/* =========================================================
   الردود
========================================================= */

async function safeReply(ctx, text, extra = {}) {
  try {
    const options = {
      parse_mode: "HTML",
      ...extra
    };

    /*
       أي رد يرسله البوت من أمر داخل رسالة
       يصير Reply على نفس رسالة الأمر تلقائيًا.
    */

    if (
      ctx?.message?.message_id &&
      !options.reply_parameters
    ) {
      options.reply_parameters = {
        message_id: ctx.message.message_id
      };
    }

    return await ctx.reply(text, options);
  } catch (err) {
    console.error("Reply error:", err.message);
    return null;
  }
}

async function replyCommand(ctx, text, extra = {}) {
  return safeReply(ctx, text, {
    ...extra,
    reply_parameters: {
      message_id: ctx.message?.message_id
    }
  });
}

/* =========================================================
   المستخدم المستهدف
========================================================= */

async function getRepliedUser(ctx) {
  const reply = ctx.message?.reply_to_message;

  if (!reply?.from) {
    return null;
  }

  ensureUser(reply.from);

  return reply.from;
}

async function hasRank(ctx, required) {
  const level = await getLevel(
    ctx,
    ctx.from.id
  );

  return level >= required;
}

async function requireRank(ctx, required) {
  const ok = await hasRank(ctx, required);

  if (!ok) {
    await replyCommand(
      ctx,
      `• هذا الأمر يحتاج رتبة ${escapeHtml(
        getLevelName(required)
      )}`
    );
  }

  return ok;
}

async function canActOnTarget(ctx, targetId) {
  const actorLevel = await getLevel(
    ctx,
    ctx.from.id
  );

  const targetLevel = await getLevel(
    ctx,
    targetId
  );

  /*
     حماية إضافية:
     لا يمكن التصرف على مالك القروب.
  */

  const targetMember =
    await getChatUser(ctx, targetId);

  if (
    targetMember?.status === "creator"
  ) {
    return false;
  }

  return actorLevel > targetLevel;
}

/* =========================================================
   تحديث المستخدم
========================================================= */

bot.use(async (ctx, next) => {
  if (ctx.from) {
    const user = ensureUser(ctx.from);

    if (isDeveloper(ctx.from)) {
      user.role = "Dev🎖️";
    }
  }

  if (ctx.chat?.type !== "private") {
    ensureGroup(ctx.chat.id);
  }

  saveData();

  return next();
});

/* =========================================================
   الإحصائيات
========================================================= */

function classifyMessage(message) {
  if (!message) return 0;

  if (message.photo) return 1;
  if (message.video) return 2;
  if (message.document) return 3;
  if (message.sticker) return 4;
  if (message.animation) return 5;
  if (message.audio) return 6;
  if (message.voice) return 7;

  if (
    message.text &&
    /https?:\/\/|www\.|t\.me\/|telegram\.me\//i.test(
      message.text
    )
  ) {
    return 8;
  }

  if (
    message.text ||
    message.caption
  ) {
    return 0;
  }

  return 9;
}

function trackMessage(ctx) {
  if (
    !ctx.chat ||
    ctx.chat.type === "private" ||
    !ctx.message?.message_id
  ) {
    return;
  }

  const g = ensureGroup(ctx.chat.id);

  g.trackedMessages.push({
    id: ctx.message.message_id,
    userId: ctx.from?.id || 0,
    type: classifyMessage(ctx.message),
    date: Date.now()
  });

  if (g.trackedMessages.length > 1000) {
    g.trackedMessages =
      g.trackedMessages.slice(-1000);
  }
}

/* =========================================================
   حماية
========================================================= */

function containsLink(text = "") {
  return /https?:\/\/|www\.|t\.me\/|telegram\.me\//i.test(
    text
  );
}

function containsForbiddenWord(text, words) {
  if (!text || !Array.isArray(words)) {
    return false;
  }

  const lower = text.toLowerCase();

  return words.some(word =>
    word &&
    lower.includes(String(word).toLowerCase())
  );
}

async function protection(ctx) {
  if (
    !ctx.chat ||
    ctx.chat.type === "private" ||
    !ctx.message
  ) {
    return false;
  }

  const g = ensureGroup(ctx.chat.id);

  if (!g.violationsEnabled) {
    return false;
  }

  if (!ctx.from) {
    return false;
  }

  const level = await getLevel(
    ctx,
    ctx.from.id
  );

  if (level >= 4) {
    return false;
  }

  const text =
    ctx.message.text ||
    ctx.message.caption ||
    "";

  if (
    g.linksEnabled &&
    containsLink(text)
  ) {
    try {
      await ctx.deleteMessage();
    } catch {}

    return true;
  }

  if (
    containsForbiddenWord(
      text,
      g.forbiddenWords
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
   الكتم
========================================================= */

async function isMuted(ctx) {
  if (
    !ctx.chat ||
    !ctx.from ||
    ctx.chat.type === "private"
  ) {
    return false;
  }

  const g = ensureGroup(ctx.chat.id);

  const id = String(ctx.from.id);

  if (g.globalMuted[id]) {
    return true;
  }

  const mutedUntil = g.muted[id];

  if (!mutedUntil) {
    return false;
  }

  if (
    mutedUntil !== true &&
    Number(mutedUntil) <= Date.now()
  ) {
    delete g.muted[id];
    saveData();
    return false;
  }

  return true;
}

/* =========================================================
   الهمسات
========================================================= */

const whisperStore = {};

function randomId() {
  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2, 8)
  );
}

function getWhisperButton(id) {
  const username =
    String(
      bot.botInfo?.username ||
      process.env.BOT_USERNAME ||
      ""
    ).replace(/^@/, "");

  if (!username) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "رؤية الهمسه",
          `view_whisper_${id}`
        )
      ],
      [
        Markup.button.callback(
          "رد على الهمسه",
          `reply_whisper_${id}`
        )
      ]
    ]);
  }

  return Markup.inlineKeyboard([
    [
      Markup.button.url(
        "رؤية الهمسه",
        `https://t.me/${username}?start=whisper_${id}`
      )
    ],
    [
      Markup.button.url(
        "رد على الهمسه",
        `https://t.me/${username}?start=whisperreply_${id}`
      )
    ]
  ]);
}

async function createWhisper(ctx) {
  if (
    ctx.chat?.type === "private"
  ) {
    return;
  }

  const id = randomId();

  let content = null;

  if (ctx.message.reply_to_message) {
    const msg =
      ctx.message.reply_to_message;

    if (msg.text) {
      content = {
        type: "text",
        text: msg.text
      };
    } else if (msg.sticker) {
      content = {
        type: "sticker",
        file_id: msg.sticker.file_id
      };
    } else if (msg.photo) {
      content = {
        type: "photo",
        file_id:
          msg.photo[msg.photo.length - 1]
            .file_id,
        caption: msg.caption || ""
      };
    } else if (msg.animation) {
      content = {
        type: "animation",
        file_id: msg.animation.file_id,
        caption: msg.caption || ""
      };
    }
  }

  if (!content) {
    await replyCommand(
      ctx,
      "• رد على رسالة ثم اكتب اهمس"
    );
    return;
  }

  whisperStore[id] = {
    from: ctx.from.id,
    chatId: ctx.chat.id,
    content,
    createdAt: Date.now()
  };

  const username =
    ctx.from.username
      ? `@${ctx.from.username}`
      : ctx.from.first_name;

  await replyCommand(
    ctx,
    `• وصلت همسة من ${escapeHtml(username)}`,
    getWhisperButton(id)
  );
}

/* =========================================================
   START + الهمسات
========================================================= */

bot.start(async ctx => {
  const payload =
    ctx.startPayload || "";

  if (
    payload.startsWith("whisper_")
  ) {
    const id =
      payload.replace("whisper_", "");

    const whisper =
      whisperStore[id];

    if (!whisper) {
      return safeReply(
        ctx,
        "• الهمسة غير موجودة أو انتهت"
      );
    }

    const fromUser =
      data.users[String(whisper.from)];

    await safeReply(
      ctx,
      `• همسة من ${escapeHtml(
        fromUser?.first_name || "مستخدم"
      )}`
    );

    if (
      whisper.content.type === "text"
    ) {
      await ctx.reply(
        whisper.content.text
      );
    } else if (
      whisper.content.type === "sticker"
    ) {
      await ctx.replyWithSticker(
        whisper.content.file_id
      );
    } else if (
      whisper.content.type === "photo"
    ) {
      await ctx.replyWithPhoto(
        whisper.content.file_id,
        {
          caption:
            whisper.content.caption || ""
        }
      );
    } else if (
      whisper.content.type === "animation"
    ) {
      await ctx.replyWithAnimation(
        whisper.content.file_id,
        {
          caption:
            whisper.content.caption || ""
        }
      );
    }

    return;
  }

  if (
    payload.startsWith(
      "whisperreply_"
    )
  ) {
    const id =
      payload.replace(
        "whisperreply_",
        ""
      );

    const whisper =
      whisperStore[id];

    if (!whisper) {
      return safeReply(
        ctx,
        "• الهمسة غير موجودة أو انتهت"
      );
    }

    await safeReply(
      ctx,
      "• ارسل ردك الآن"
    );

    whisperStore[
      `reply_${ctx.from.id}`
    ] = {
      whisperId: id
    };

    return;
  }

  await safeReply(
    ctx,
    "• أهلًا بك في بوت ايف"
  );
});

/* =========================================================
   التفاعل
========================================================= */

async function handleInteraction(ctx) {
  if (
    !ctx.chat ||
    ctx.chat.type === "private"
  ) {
    return;
  }

  const g = ensureGroup(ctx.chat.id);
  const uid = String(ctx.from.id);

  g.interactions[uid] =
    (g.interactions[uid] || 0) + 1;

  const user = ensureUser(ctx.from);

  user.messages =
    (user.messages || 0) + 1;

  trackMessage(ctx);

  saveData();
}

/* =========================================================
   الصلاحيات الفعلية للمشرف
========================================================= */

const ACTUAL_PERMISSIONS = [
  [
    "can_change_info",
    "تغيير المعلومات"
  ],
  [
    "can_pin_messages",
    "تثبيت الرسائل"
  ],
  [
    "can_manage_topics",
    "ادارة المواضيع"
  ],
  [
    "can_invite_users",
    "اضافه مستخدمين"
  ],
  [
    "can_delete_messages",
    "مسح الرسائل"
  ],
  [
    "can_restrict_members",
    "حظر المستخدمين"
  ],
  [
    "can_promote_members",
    "اضافه المشرفين"
  ]
];

function formatActualPermissions(
  member,
  self = false
) {
  if (!member) {
    return "• تعذر جلب صلاحيات المستخدم";
  }

  const title = self
    ? "• صلاحياتك بالإشراف :"
    : "• صلاحياته بالإشراف :";

  /*
     مالك القروب:
     تيليجرام لا يعرض نفس حقول الصلاحيات للمستخدم
     creator، لذلك نعتبر كل الصلاحيات نعم.
  */

  if (
    member.status === "creator"
  ) {
    return [
      title,
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

  if (
    member.status !== "administrator"
  ) {
    return [
      title,
      "━━━━━━━━━━━",
      "• تغيير المعلومات ↤︎ لا",
      "• تثبيت الرسائل ↤︎ لا",
      "• ادارة المواضيع ↤︎ لا",
      "• اضافه مستخدمين ↤︎ لا",
      "• مسح الرسائل ↤︎ لا",
      "• حظر المستخدمين ↤︎ لا",
      "• اضافه المشرفين ↤︎ لا"
    ].join("\n");
  }

  const lines = [
    title,
    "━━━━━━━━━━━"
  ];

  for (
    const [key, label] of ACTUAL_PERMISSIONS
  ) {
    lines.push(
      `• ${label} ↤︎ ${
        member[key] === true
          ? "نعم"
          : "لا"
      }`
    );
  }

  return lines.join("\n");
}

/* =========================================================
   المالك الخاص بـ j4xa7
========================================================= */

async function findDeveloper(ctx) {
  const username =
    DEV_USERNAME.toLowerCase();

  try {
    const admins =
      await ctx.telegram.getChatAdministrators(
        ctx.chat.id
      );

    const found =
      admins.find(
        member =>
          String(
            member.user.username || ""
          ).toLowerCase() === username
      );

    if (found) {
      ensureUser(found.user);
      return found.user;
    }
  } catch {}

  const stored =
    Object.values(data.users).find(
      user =>
        String(
          user.username || ""
        ).toLowerCase() === username
    );

  if (stored) {
    return stored;
  }

  return null;
}

async function showOwner(ctx) {
  const owner =
    await findDeveloper(ctx);

  if (!owner) {
    return safeReply(
      ctx,
      "• ما قدرت ألقى حساب المالك"
    );
  }

  let bio = "غير متوفر";

  let username = owner.username
    ? `@${owner.username}`
    : "غير متوفر";

  try {
    const chat =
      await ctx.telegram.getChat(
        owner.id
      );

    if (chat.bio) {
      bio = chat.bio;
    }

    if (chat.username) {
      username = `@${chat.username}`;
    }
  } catch {}

  try {
    const photos =
      await ctx.telegram.getUserProfilePhotos(
        owner.id,
        {
          offset: 0,
          limit: 1
        }
      );

    const photosList =
      photos?.photos || [];

    if (
      photosList.length > 0
    ) {
      const sizes =
        photosList[0];

      const photo =
        sizes[sizes.length - 1];

      return ctx.replyWithPhoto(
        photo.file_id,
        {
          caption:
            `• ${escapeHtml(username)}\n` +
            `• ${escapeHtml(bio)}`,
          parse_mode: "HTML",
          reply_parameters: {
            message_id:
              ctx.message?.message_id
          }
        }
      );
    }
  } catch {}

  return safeReply(
    ctx,
    `• ${escapeHtml(username)}\n• ${escapeHtml(bio)}`
  );
}

/* =========================================================
   تنظيف
========================================================= */

async function cleanMessages(
  ctx,
  type
) {
  if (
    !(await requireRank(ctx, 5))
  ) {
    return;
  }

  const g =
    ensureGroup(ctx.chat.id);

  const targetType =
    Number(type);

  if (
    !Number.isInteger(targetType) ||
    targetType < 0 ||
    targetType > 9
  ) {
    return replyCommand(
      ctx,
      "• اختر نوع التنظيف من 0 إلى 9"
    );
  }

  const messages =
    [...g.trackedMessages]
      .reverse()
      .filter(
        item =>
          Number(item.type) ===
          targetType
      )
      .slice(0, 100);

  let deleted = 0;

  for (const item of messages) {
    try {
      await ctx.telegram.deleteMessage(
        ctx.chat.id,
        item.id
      );

      deleted++;

      const index =
        g.trackedMessages.findIndex(
          x =>
            Number(x.id) ===
            Number(item.id)
        );

      if (index !== -1) {
        g.trackedMessages.splice(
          index,
          1
        );
      }
    } catch {}
  }

  saveData();

  await replyCommand(
    ctx,
    `• تم تنظيف ${deleted} رسالة`
  );
}

/* =========================================================
   الكتم
========================================================= */

async function muteTarget(
  ctx,
  target,
  global = false
) {
  if (!target) {
    return replyCommand(
      ctx,
      "• رد على المستخدم"
    );
  }

  if (
    !(await canActOnTarget(
      ctx,
      target.id
    ))
  ) {
    return replyCommand(
      ctx,
      "• ما تقدر تتصرف على هذا المستخدم"
    );
  }

  const g =
    ensureGroup(ctx.chat.id);

  const id =
    String(target.id);

  if (global) {
    g.globalMuted[id] = true;
  } else {
    g.muted[id] =
      Date.now() +
      24 * 60 * 60 * 1000;
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
          can_add_web_page_previews: false,
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false,
          can_manage_topics: false
        }
      }
    );
  } catch (err) {
    console.error(
      "Mute error:",
      err.message
    );
  }

  saveData();

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎${mention(target)}\n• ${
      global
        ? "كتمته كتم عام"
        : "كتمته"
    }`
  );
}

async function unmuteTarget(
  ctx,
  target,
  global = false
) {
  if (!target) {
    return replyCommand(
      ctx,
      "• رد على المستخدم"
    );
  }

  if (
    !(await canActOnTarget(
      ctx,
      target.id
    ))
  ) {
    return replyCommand(
      ctx,
      "• ما تقدر تتصرف على هذا المستخدم"
    );
  }

  const g =
    ensureGroup(ctx.chat.id);

  const id =
    String(target.id);

  delete g.muted[id];

  if (global) {
    delete g.globalMuted[id];
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
          can_change_info: false,
          can_invite_users: true,
          can_pin_messages: false,
          can_manage_topics: false
        }
      }
    );
  } catch {}

  saveData();

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎${mention(target)}\n• ${
      global
        ? "فكيت الكتم العام عنه"
        : "فكيت كتمه"
    }`
  );
}

/* =========================================================
   الحظر والطرد
========================================================= */

async function banTarget(
  ctx,
  target
) {
  if (!target) {
    return replyCommand(
      ctx,
      "• رد على المستخدم"
    );
  }

  if (
    !(await canActOnTarget(
      ctx,
      target.id
    ))
  ) {
    return replyCommand(
      ctx,
      "• ما تقدر تتصرف على هذا المستخدم"
    );
  }

  try {
    await ctx.telegram.banChatMember(
      ctx.chat.id,
      target.id
    );

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎${mention(target)}\n• حظرته`
    );
  } catch (err) {
    return replyCommand(
      ctx,
      `• ما قدرت أحظره\n• ${escapeHtml(err.message)}`
    );
  }
}

async function unbanTarget(
  ctx,
  target
) {
  if (!target) {
    return replyCommand(
      ctx,
      "• رد على المستخدم"
    );
  }

  try {
    await ctx.telegram.unbanChatMember(
      ctx.chat.id,
      target.id,
      {
        only_if_banned: false
      }
    );

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎${mention(target)}\n• فكيت الحظر عنه`
    );
  } catch (err) {
    return replyCommand(
      ctx,
      `• ما قدرت أفك الحظر\n• ${escapeHtml(err.message)}`
    );
  }
}

async function kickTarget(
  ctx,
  target
) {
  if (!target) {
    return replyCommand(
      ctx,
      "• رد على المستخدم"
    );
  }

  if (
    !(await canActOnTarget(
      ctx,
      target.id
    ))
  ) {
    return replyCommand(
      ctx,
      "• ما تقدر تتصرف على هذا المستخدم"
    );
  }

  try {
    await ctx.telegram.banChatMember(
      ctx.chat.id,
      target.id
    );

    await ctx.telegram.unbanChatMember(
      ctx.chat.id,
      target.id,
      {
        only_if_banned: true
      }
    );

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎${mention(target)}\n• طردته`
    );
  } catch (err) {
    return replyCommand(
      ctx,
      `• ما قدرت أطرده\n• ${escapeHtml(err.message)}`
    );
  }
}

/* =========================================================
   رفع مشرف
========================================================= */

const PROMOTABLE_RIGHTS = [
  "can_delete_messages",
  "can_manage_video_chats",
  "can_restrict_members",
  "can_change_info",
  "can_invite_users",
  "can_pin_messages",
  "can_manage_topics"
];

async function promoteTarget(
  ctx,
  target
) {
  if (!target) {
    return replyCommand(
      ctx,
      "• رد على المستخدم"
    );
  }

  if (
    !(await requireRank(ctx, 2))
  ) {
    return;
  }

  if (
    target.id === ctx.from.id
  ) {
    return replyCommand(
      ctx,
      "• ما تقدر ترفع نفسك"
    );
  }

  const actorLevel =
    await getLevel(
      ctx,
      ctx.from.id
    );

  const targetLevel =
    await getLevel(
      ctx,
      target.id
    );

  if (
    actorLevel <= targetLevel
  ) {
    return replyCommand(
      ctx,
      "• ما تقدر ترفع هذا المستخدم"
    );
  }

  let botMember;

  try {
    const botId =
      bot.botInfo?.id ||
      ctx.botInfo?.id;

    botMember =
      await ctx.telegram.getChatMember(
        ctx.chat.id,
        botId
      );
  } catch (err) {
    return replyCommand(
      ctx,
      "• ما قدرت أعرف صلاحيات البوت"
    );
  }

  if (
    botMember.status !==
    "administrator"
  ) {
    return replyCommand(
      ctx,
      "• لازم البوت يكون مشرف في القروب"
    );
  }

  if (
    botMember.can_promote_members !== true
  ) {
    return replyCommand(
      ctx,
      "• البوت ما عنده صلاحية إضافة مشرفين"
    );
  }

  let targetMember;

  try {
    targetMember =
      await ctx.telegram.getChatMember(
        ctx.chat.id,
        target.id
      );
  } catch {
    return replyCommand(
      ctx,
      "• ما قدرت أجيب حالة المستخدم"
    );
  }

  if (
    targetMember.status === "creator"
  ) {
    return replyCommand(
      ctx,
      "• ما تقدر ترفع مالك القروب"
    );
  }

  if (
    targetMember.status ===
      "administrator" &&
    targetMember.can_be_edited === false
  ) {
    return replyCommand(
      ctx,
      "• ما أقدر أعدل على صلاحيات هذا المشرف"
    );
  }

  const rights = {};

  for (
    const key of PROMOTABLE_RIGHTS
  ) {
    if (botMember[key] === true) {
      rights[key] = true;
    }
  }

  try {
    await ctx.telegram.promoteChatMember(
      ctx.chat.id,
      target.id,
      rights
    );

    /*
       مهم جدًا:
       لا نعطيه رتبة "مالك" داخل البوت.
       رفع مشرف = مشرف تيليجرام فقط.
    */

    ensureUser(target);

    saveData();

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎${mention(target)}\n• تم رفعه الرتبه`
    );
  } catch (err) {
    console.error(
      "PROMOTE ERROR:",
      err
    );

    if (
      String(err.message).includes(
        "RIGHT_FORBIDDEN"
      )
    ) {
      return replyCommand(
        ctx,
        "• ما قدرت أرقّي المستخدم\n• صلاحيات البوت لا تسمح بمنح هذه الصلاحيات"
      );
    }

    return replyCommand(
      ctx,
      `• ما قدرت أرقّي المستخدم\n• ${escapeHtml(err.message)}`
    );
  }
}

async function demoteTarget(
  ctx,
  target
) {
  if (!target) {
    return replyCommand(
      ctx,
      "• رد على المستخدم"
    );
  }

  if (
    !(await canActOnTarget(
      ctx,
      target.id
    ))
  ) {
    return replyCommand(
      ctx,
      "• ما تقدر تنزل هذا المستخدم"
    );
  }

  try {
    await ctx.telegram.promoteChatMember(
      ctx.chat.id,
      target.id,
      {
        can_delete_messages: false,
        can_manage_video_chats: false,
        can_restrict_members: false,
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false,
        can_manage_topics: false
      }
    );

    saveData();

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎${mention(target)}\n• تم تنزيل رتبته`
    );
  } catch (err) {
    return replyCommand(
      ctx,
      `• ما قدرت أنزل رتبته\n• ${escapeHtml(err.message)}`
    );
  }
}

/* =========================================================
   التقييد
========================================================= */

async function restrictTarget(
  ctx,
  target
) {
  if (!target) {
    return replyCommand(
      ctx,
      "• رد على المستخدم"
    );
  }

  if (
    !(await canActOnTarget(
      ctx,
      target.id
    ))
  ) {
    return replyCommand(
      ctx,
      "• ما تقدر تقيد هذا المستخدم"
    );
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

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎${mention(target)}\n• قيدته`
    );
  } catch (err) {
    return replyCommand(
      ctx,
      `• ما قدرت أقيده\n• ${escapeHtml(err.message)}`
    );
  }
}

async function unrestrictTarget(
  ctx,
  target
) {
  if (!target) {
    return replyCommand(
      ctx,
      "• رد على المستخدم"
    );
  }

  if (
    !(await canActOnTarget(
      ctx,
      target.id
    ))
  ) {
    return replyCommand(
      ctx,
      "• ما تقدر تفك تقييد هذا المستخدم"
    );
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

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎${mention(target)}\n• الغيت تقييده`
    );
  } catch (err) {
    return replyCommand(
      ctx,
      `• ما قدرت أفك تقييده\n• ${escapeHtml(err.message)}`
    );
  }
}

/* =========================================================
   لعبة الأحكام
========================================================= */

function getGame(ctx) {
  const g =
    ensureGroup(ctx.chat.id);

  g.games ||= {};

  if (!g.games.ahkam) {
    g.games.ahkam = {
      active: false,
      registering: false,
      starter: null,
      participants: [],
      usedPairs: [],
      round: 0
    };
  }

  return g.games.ahkam;
}

function pairKey(a, b) {
  return `${a}:${b}`;
}

function randomItem(arr) {
  if (!arr.length) return null;

  return arr[
    Math.floor(
      Math.random() * arr.length
    )
  ];
}

function chooseJudgmentPair(game) {
  const participants =
    [...game.participants];

  if (participants.length < 2) {
    return null;
  }

  const possible = [];

  for (const judge of participants) {
    for (const target of participants) {
      if (judge === target) {
        continue;
      }

      const key =
        pairKey(judge, target);

      const reverse =
        pairKey(target, judge);

      if (
        !game.usedPairs.includes(key)
      ) {
        possible.push({
          judge,
          target
        });
      }

      if (
        !game.usedPairs.includes(
          reverse
        )
      ) {
        possible.push({
          judge,
          target
        });
      }
    }
  }

  if (!possible.length) {
    game.usedPairs = [];
    return chooseJudgmentPair(game);
  }

  return randomItem(possible);
}

async function startAhkam(
  ctx
) {
  if (
    !(await requireRank(ctx, 7))
  ) {
    return;
  }

  const game = getGame(ctx);

  if (
    !ensureGroup(ctx.chat.id)
      .gamesEnabled
  ) {
    return replyCommand(
      ctx,
      "• الألعاب مقفلة"
    );
  }

  if (game.active) {
    return replyCommand(
      ctx,
      "• لعبة الأحكام شغالة بالفعل"
    );
  }

  game.active = true;
  game.registering = true;
  game.starter = ctx.from.id;
  game.participants = [];
  game.usedPairs = [];
  game.round = 0;

  saveData();

  await replyCommand(
    ctx,
    "• بدأت لعبة الأحكام\n• اللي يبي يشارك يكتب أنا\n• لإنهاء التسجيل اكتب نعم"
  );
}

async function joinAhkam(
  ctx
) {
  const game = getGame(ctx);

  if (
    !game.active ||
    !game.registering
  ) {
    return false;
  }

  const id =
    ctx.from.id;

  if (
    !game.participants.includes(id)
  ) {
    game.participants.push(id);
    saveData();

    await replyCommand(
      ctx,
      `• تم تسجيل ${escapeHtml(
        ctx.from.first_name || "المستخدم"
      )}`
    );
  }

  return true;
}

async function endAhkamRegistration(
  ctx
) {
  const game = getGame(ctx);

  if (
    !game.active ||
    !game.registering
  ) {
    return false;
  }

  if (
    game.starter !== ctx.from.id
  ) {
    return false;
  }

  if (
    game.participants.length < 2
  ) {
    await replyCommand(
      ctx,
      "• لازم يشاركون شخصين على الأقل"
    );

    return true;
  }

  game.registering = false;
  game.round++;

  const pair =
    chooseJudgmentPair(game);

  if (!pair) {
    return true;
  }

  game.usedPairs.push(
    pairKey(
      pair.judge,
      pair.target
    )
  );

  saveData();

  const judgeUser =
    data.users[
      String(pair.judge)
    ];

  const targetUser =
    data.users[
      String(pair.target)
    ];

  await replyCommand(
    ctx,
    `• الحكم ↤︎${mention(judgeUser)}\n• المحكوم عليه ↤︎${mention(targetUser)}\n• الحكم: اكتب حكمًا ترفيهيًا آمنًا على المحكوم عليه`
  );

  return true;
}

async function nextAhkamRound(
  ctx
) {
  const game = getGame(ctx);

  if (
    !game.active ||
    game.registering
  ) {
    return;
  }

  if (
    game.participants.length < 2
  ) {
    return;
  }

  const pair =
    chooseJudgmentPair(game);

  if (!pair) return;

  game.round++;

  game.usedPairs.push(
    pairKey(
      pair.judge,
      pair.target
    )
  );

  saveData();

  const judgeUser =
    data.users[
      String(pair.judge)
    ];

  const targetUser =
    data.users[
      String(pair.target)
    ];

  await replyCommand(
    ctx,
    `• الحكم ↤︎${mention(judgeUser)}\n• المحكوم عليه ↤︎${mention(targetUser)}\n• الحكم: اكتب حكمًا ترفيهيًا آمنًا على المحكوم عليه`
  );
}

/*
   انهاء احكام:
   - صاحب اللعبة يقدر ينهيها.
   - Myth فما فوق يقدر ينهيها أيضًا.
*/

async function endAhkam(
  ctx
) {
  const game = getGame(ctx);

  if (
    !game.active
  ) {
    return false;
  }

  const level =
    await getLevel(
      ctx,
      ctx.from.id
    );

  if (
    game.starter !== ctx.from.id &&
    level < 4
  ) {
    return false;
  }

  game.active = false;
  game.registering = false;
  game.starter = null;
  game.participants = [];
  game.usedPairs = [];
  game.round = 0;

  saveData();

  await replyCommand(
    ctx,
    "• انتهت لعبة الأحكام"
  );

  return true;
}

async function closeGames(
  ctx
) {
  if (
    !(await requireRank(ctx, 7))
  ) {
    return;
  }

  const g =
    ensureGroup(ctx.chat.id);

  g.gamesEnabled = false;

  if (g.games?.ahkam) {
    g.games.ahkam.active = false;
    g.games.ahkam.registering = false;
    g.games.ahkam.starter = null;
    g.games.ahkam.participants = [];
    g.games.ahkam.usedPairs = [];
    g.games.ahkam.round = 0;
  }

  saveData();

  await replyCommand(
    ctx,
    "• تم قفل الألعاب"
  );
}

async function openGames(
  ctx
) {
  if (
    !(await requireRank(ctx, 7))
  ) {
    return;
  }

  const g =
    ensureGroup(ctx.chat.id);

  g.gamesEnabled = true;

  saveData();

  await replyCommand(
    ctx,
    "• تم فتح الألعاب"
  );
}

/* =========================================================
   الأوامر
========================================================= */

bot.on("message", async ctx => {
  if (
    !ctx.message ||
    !ctx.from
  ) {
    return;
  }

  await handleInteraction(ctx);

  if (
    ctx.chat?.type !== "private" &&
    await isMuted(ctx)
  ) {
    try {
      await ctx.deleteMessage();
    } catch {}

    return;
  }

  const blocked =
    await protection(ctx);

  if (blocked) {
    return;
  }

  if (
    ctx.message.text
  ) {
    const text =
      ctx.message.text.trim();

    /* -------------------------
       الهمسة
    ------------------------- */

    if (
      /^(اهمس|همسه|همسة|ه)$/i.test(
        text
      )
    ) {
      return createWhisper(ctx);
    }

    /* -------------------------
       لعبة الأحكام
    ------------------------- */

    if (
      /^احكام$/i.test(text)
    ) {
      return startAhkam(ctx);
    }

    if (
      /^أنا$/i.test(text)
    ) {
      const joined =
        await joinAhkam(ctx);

      if (joined) return;
    }

    if (
      /^نعم$/i.test(text)
    ) {
      const ended =
        await endAhkamRegistration(
          ctx
        );

      if (ended) return;
    }

    if (
      /^انهاء احكام$/i.test(text)
    ) {
      const ended =
        await endAhkam(ctx);

      if (ended) return;

      /*
         إذا اللعبة موجودة لكن المستخدم
         ما عنده صلاحية إيقافها، ما نخلي
         الأمر يكمل لباقي الأوامر.
      */

      const game = getGame(ctx);

      if (game.active) {
        return replyCommand(
          ctx,
          "• ما تقدر تنهي لعبة الأحكام"
        );
      }
    }

    if (
      /^قفل الالعاب$/i.test(text)
    ) {
      return closeGames(ctx);
    }

    if (
      /^فتح الالعاب$/i.test(text)
    ) {
      return openGames(ctx);
    }

    /* -------------------------
       الصلاحيات
    ------------------------- */

    if (
      /^صلاحياتي$/i.test(text)
    ) {
      try {
        const member =
          await ctx.telegram.getChatMember(
            ctx.chat.id,
            ctx.from.id
          );

        return replyCommand(
          ctx,
          formatActualPermissions(
            member,
            true
          )
        );
      } catch {
        return replyCommand(
          ctx,
          "• تعذر جلب صلاحياتك"
        );
      }
    }

    if (
      /^صلاحياته$/i.test(text) ||
      /^صلاحيات المستخدم$/i.test(text)
    ) {
      const target =
        await getRepliedUser(ctx);

      if (!target) {
        return replyCommand(
          ctx,
          "• رد على المستخدم"
        );
      }

      try {
        const member =
          await ctx.telegram.getChatMember(
            ctx.chat.id,
            target.id
          );

        return replyCommand(
          ctx,
          formatActualPermissions(
            member,
            false
          )
        );
      } catch {
        return replyCommand(
          ctx,
          "• تعذر جلب صلاحيات المستخدم"
        );
      }
    }

    /* -------------------------
       المالك
    ------------------------- */

    if (
      /^المالك$/i.test(text)
    ) {
      return showOwner(ctx);
    }

    /* -------------------------
       الكتم
    ------------------------- */

    if (
      /^كتم$/i.test(text)
    ) {
      const target =
        await getRepliedUser(ctx);

      return muteTarget(
        ctx,
        target,
        false
      );
    }

    if (
      /^كتم عام$/i.test(text)
    ) {
      const target =
        await getRepliedUser(ctx);

      return muteTarget(
        ctx,
        target,
        true
      );
    }

    if (
      /^(فك الكتم|فك كتم|الغاء الكتم)$/i.test(
        text
      )
    ) {
      const target =
        await getRepliedUser(ctx);

      return unmuteTarget(
        ctx,
        target,
        false
      );
    }

    if (
      /^(فك الكتم العام|الغاء الكتم العام)$/i.test(
        text
      )
    ) {
      const target =
        await getRepliedUser(ctx);

      return unmuteTarget(
        ctx,
        target,
        true
      );
    }

    if (
      /^مسح المكتومين عام$/i.test(text)
    ) {
      if (
        !(await requireRank(ctx, 5))
      ) {
        return;
      }

      const g =
        ensureGroup(ctx.chat.id);

      g.globalMuted = {};

      saveData();

      return replyCommand(
        ctx,
        "• تم مسح المكتومين عام"
      );
    }

    /* -------------------------
       الحظر
    ------------------------- */

    if (
      /^حظر$/i.test(text)
    ) {
      const target =
        await getRepliedUser(ctx);

      return banTarget(
        ctx,
        target
      );
    }

    if (
      /^فك الحظر$/i.test(text)
    ) {
      const target =
        await getRepliedUser(ctx);

      return unbanTarget(
        ctx,
        target
      );
    }

    /* -------------------------
       الطرد
    ------------------------- */

    if (
      /^طرد$/i.test(text)
    ) {
      const target =
        await getRepliedUser(ctx);

      return kickTarget(
        ctx,
        target
      );
    }

    /* -------------------------
       التقييد
    ------------------------- */

    if (
      /^(تقييد|قيد)$/i.test(text)
    ) {
      const target =
        await getRepliedUser(ctx);

      return restrictTarget(
        ctx,
        target
      );
    }

    if (
      /^(الغاء التقييد|إلغاء التقييد|فك التقييد)$/i.test(
        text
      )
    ) {
      const target =
        await getRepliedUser(ctx);

      return unrestrictTarget(
        ctx,
        target
      );
    }

    /* -------------------------
       رفع مشرف
    ------------------------- */

    if (
      /^رفع مشرف$/i.test(text)
    ) {
      const target =
        await getRepliedUser(ctx);

      return promoteTarget(
        ctx,
        target
      );
    }

    /* -------------------------
       تنزيل مشرف
    ------------------------- */

    if (
      /^(تنزيل|تنزيل مشرف|نزل)$/i.test(
        text
      )
    ) {
      const target =
        await getRepliedUser(ctx);

      return demoteTarget(
        ctx,
        target
      );
    }

    /* -------------------------
       تنظيف
    ------------------------- */

    const cleanMatch =
      text.match(
        /^(تنظيف|تنظيف\s+)([0-9])$/i
      );

    if (cleanMatch) {
      return cleanMessages(
        ctx,
        Number(cleanMatch[2])
      );
    }

    if (
      /^تنظيف$/i.test(text)
    ) {
      return replyCommand(
        ctx,
        "• اكتب تنظيف ثم النوع من 0 إلى 9"
      );
    }

    /* -------------------------
       فتح وإغلاق المخالفات
    ------------------------- */

    if (
      /^(فتح المخالفات|فتح مخالفات)$/i.test(
        text
      )
    ) {
      if (
        !(await requireRank(ctx, 4))
      ) {
        return;
      }

      const g =
        ensureGroup(ctx.chat.id);

      g.violationsEnabled = true;

      saveData();

      return replyCommand(
        ctx,
        "• تم فتح المخالفات"
      );
    }

    if (
      /^(قفل المخالفات|قفل مخالفات)$/i.test(
        text
      )
    ) {
      if (
        !(await requireRank(ctx, 4))
      ) {
        return;
      }

      const g =
        ensureGroup(ctx.chat.id);

      g.violationsEnabled = false;

      saveData();

      return replyCommand(
        ctx,
        "• تم قفل المخالفات"
      );
    }

    /* -------------------------
       معلومات الرتبة
    ------------------------- */

    if (
      /^رتبتي$/i.test(text)
    ) {
      const level =
        await getLevel(
          ctx,
          ctx.from.id
        );

      return replyCommand(
        ctx,
        `• رتبتك ↤︎ ${escapeHtml(
          getLevelName(level)
        )}`
      );
    }

    if (
      /^رتبته$/i.test(text)
    ) {
      const target =
        await getRepliedUser(ctx);

      if (!target) {
        return replyCommand(
          ctx,
          "• رد على المستخدم"
        );
      }

      const level =
        await getLevel(
          ctx,
          target.id
        );

      return replyCommand(
        ctx,
        `• المستخدم ذا ↤︎${mention(target)}\n• رتبته ↤︎ ${escapeHtml(
          getLevelName(level)
        )}`
      );
    }

    /* -------------------------
       رفع رتبة داخل البوت
    ------------------------- */

    if (
      /^رفع (مميز|مالك|مالك أساسي|Myth|Myth🎖️|Dev²🎖️|Dev🎖️)$/i.test(
        text
      )
    ) {
      const match =
        text.match(
          /^رفع (.+)$/i
        );

      const role =
        match?.[1];

      const target =
        await getRepliedUser(ctx);

      if (!target) {
        return replyCommand(
          ctx,
          "• رد على المستخدم"
        );
      }

      const newLevel =
        ROLES[role];

      if (
        newLevel === undefined
      ) {
        return;
      }

      const actorLevel =
        await getLevel(
          ctx,
          ctx.from.id
        );

      if (
        actorLevel <= newLevel
      ) {
        return replyCommand(
          ctx,
          "• ما تقدر تعطي هذه الرتبة"
        );
      }

      const targetLevel =
        await getLevel(
          ctx,
          target.id
        );

      if (
        actorLevel <= targetLevel
      ) {
        return replyCommand(
          ctx,
          "• ما تقدر ترفع هذا المستخدم"
        );
      }

      ensureUser(target);

      data.users[
        String(target.id)
      ].role = role;

      saveData();

      return replyCommand(
        ctx,
        `• المستخدم ذا ↤︎${mention(target)}\n• تم رفعه الرتبه`
      );
    }

    /* -------------------------
       تنزيل رتبة داخل البوت
    ------------------------- */

    if (
      /^تنزيل (مميز|مالك|مالك أساسي|Myth|Myth🎖️|Dev²🎖️|Dev🎖️)$/i.test(
        text
      )
    ) {
      const match =
        text.match(
          /^تنزيل (.+)$/i
        );

      const role =
        match?.[1];

      const target =
        await getRepliedUser(ctx);

      if (!target) {
        return replyCommand(
          ctx,
          "• رد على المستخدم"
        );
      }

      const newLevel =
        ROLES[role];

      if (
        newLevel === undefined
      ) {
        return;
      }

      const actorLevel =
        await getLevel(
          ctx,
          ctx.from.id
        );

      if (
        actorLevel <= newLevel
      ) {
        return replyCommand(
          ctx,
          "• ما تقدر تعطي هذه الرتبة"
        );
      }

      const targetLevel =
        await getLevel(
          ctx,
          target.id
        );

      if (
        actorLevel <= targetLevel
      ) {
        return replyCommand(
          ctx,
          "• ما تقدر تنزل هذا المستخدم"
        );
      }

      ensureUser(target);

      data.users[
        String(target.id)
      ].role = role;

      saveData();

      return replyCommand(
        ctx,
        `• المستخدم ذا ↤︎${mention(target)}\n• تم تنزيل رتبته`
      );
    }

    /* -------------------------
       لقب
    ------------------------- */

    if (
      /^لقب\s+(.+)$/i.test(text)
    ) {
      if (
        !(await requireRank(ctx, 2))
      ) {
        return;
      }

      const match =
        text.match(
          /^لقب\s+(.+)$/i
        );

      const title =
        match?.[1]?.trim();

      const target =
        await getRepliedUser(ctx);

      if (!target) {
        return replyCommand(
          ctx,
          "• رد على المستخدم"
        );
      }

      if (
        !(await canActOnTarget(
          ctx,
          target.id
        ))
      ) {
        return replyCommand(
          ctx,
          "• ما تقدر تغير لقب هذا المستخدم"
        );
      }

      ensureUser(target);

      data.users[
        String(target.id)
      ].title = title;

      saveData();

      return replyCommand(
        ctx,
        `• المستخدم ذا ↤︎${mention(target)}\n• تم تغيير لقبه`
      );
    }

    /* -------------------------
       مسح لقب
    ------------------------- */

    if (
      /^(مسح اللقب|حذف اللقب)$/i.test(
        text
      )
    ) {
      if (
        !(await requireRank(ctx, 2))
      ) {
        return;
      }

      const target =
        await getRepliedUser(ctx);

      if (!target) {
        return replyCommand(
          ctx,
          "• رد على المستخدم"
        );
      }

      if (
        !(await canActOnTarget(
          ctx,
          target.id
        ))
      ) {
        return replyCommand(
          ctx,
          "• ما تقدر تغير لقب هذا المستخدم"
        );
      }

      ensureUser(target);

      data.users[
        String(target.id)
      ].title = "";

      saveData();

      return replyCommand(
        ctx,
        `• المستخدم ذا ↤︎${mention(target)}\n• تم حذف لقبه`
      );
    }

    /* -------------------------
       معلومات المستخدم
    ------------------------- */

    if (
      /^(معلوماته|معلومات المستخدم)$/i.test(
        text
      )
    ) {
      const target =
        await getRepliedUser(ctx);

      if (!target) {
        return replyCommand(
          ctx,
          "• رد على المستخدم"
        );
      }

      const level =
        await getLevel(
          ctx,
          target.id
        );

      return replyCommand(
        ctx,
        `• المستخدم ذا ↤︎${mention(target)}\n• الرتبة ↤︎ ${escapeHtml(
          getLevelName(level)
        )}\n• اليوزر ↤︎ ${
          target.username
            ? `@${escapeHtml(
                target.username
              )}`
            : "لا يوجد"
        }\n• الآيدي ↤︎ <code>${target.id}</code>`
      );
    }

    /* -------------------------
       حذف الرسالة
    ------------------------- */

    if (
      /^(حذف|مسح)$/i.test(text)
    ) {
      if (
        !(await requireRank(ctx, 2))
      ) {
        return;
      }

      if (
        !ctx.message.reply_to_message
      ) {
        return replyCommand(
          ctx,
          "• رد على الرسالة"
        );
      }

      try {
        await ctx.deleteMessage();

        await ctx.telegram.deleteMessage(
          ctx.chat.id,
          ctx.message
            .reply_to_message
            .message_id
        );
      } catch {}

      return;
    }

    /* -------------------------
       تثبيت
    ------------------------- */

    if (
      /^تثبيت$/i.test(text)
    ) {
      if (
        !(await requireRank(ctx, 2))
      ) {
        return;
      }

      const reply =
        ctx.message.reply_to_message;

      if (!reply) {
        return replyCommand(
          ctx,
          "• رد على الرسالة"
        );
      }

      try {
        await ctx.telegram.pinChatMessage(
          ctx.chat.id,
          reply.message_id,
          {
            disable_notification: false
          }
        );

        return replyCommand(
          ctx,
          "• تم تثبيت الرسالة"
        );
      } catch (err) {
        return replyCommand(
          ctx,
          `• ما قدرت أثبت الرسالة\n• ${escapeHtml(err.message)}`
        );
      }
    }

    /* -------------------------
       إلغاء التثبيت
    ------------------------- */

    if (
      /^(الغاء التثبيت|إلغاء التثبيت|فك التثبيت)$/i.test(
        text
      )
    ) {
      if (
        !(await requireRank(ctx, 2))
      ) {
        return;
      }

      try {
        await ctx.telegram.unpinChatMessage(
          ctx.chat.id
        );

        return replyCommand(
          ctx,
          "• تم إلغاء التثبيت"
        );
      } catch (err) {
        return replyCommand(
          ctx,
          `• ما قدرت ألغي التثبيت\n• ${escapeHtml(err.message)}`
        );
      }
    }

    /* -------------------------
       قفل / فتح المجموعة
    ------------------------- */

    if (
      /^قفل القروب$/i.test(text)
    ) {
      if (
        !(await requireRank(ctx, 3))
      ) {
        return;
      }

      const g =
        ensureGroup(ctx.chat.id);

      g.groupOpen = false;

      saveData();

      return replyCommand(
        ctx,
        "• تم قفل القروب"
      );
    }

    if (
      /^فتح القروب$/i.test(text)
    ) {
      if (
        !(await requireRank(ctx, 3))
      ) {
        return;
      }

      const g =
        ensureGroup(ctx.chat.id);

      g.groupOpen = true;

      saveData();

      return replyCommand(
        ctx,
        "• تم فتح القروب"
      );
    }

    /* -------------------------
       إحصائياتي
    ------------------------- */

    if (
      /^إحصائياتي$/i.test(text) ||
      /^احصائياتي$/i.test(text)
    ) {
      const user =
        ensureUser(ctx.from);

      return replyCommand(
        ctx,
        `• إحصائياتك\n• الرسائل ↤︎ ${
          user.messages || 0
        }\n• التفاعل ↤︎ ${
          ensureGroup(
            ctx.chat.id
          ).interactions[
            String(ctx.from.id)
          ] || 0
        }`
      );
    }

    /* -------------------------
       الألعاب
    ------------------------- */

    if (
      /^(الالعاب|الألعاب)$/i.test(text)
    ) {
      return replyCommand(
        ctx,
        "• الألعاب المتوفرة\n• الأحكام\n• لبدء اللعبة اكتب احكام\n• لإيقافها اكتب انهاء احكام"
      );
    }

    /* -------------------------
       المساعدة
    ------------------------- */

    if (
      /^(اوامر|أوامر|مساعدة)$/i.test(text)
    ) {
      return replyCommand(
        ctx,
        [
          "• أوامر ايف",
          "• اهمس",
          "• احكام",
          "• انهاء احكام",
          "• صلاحياتي",
          "• صلاحياته",
          "• المالك",
          "• كتم",
          "• كتم عام",
          "• حظر",
          "• طرد",
          "• تقييد",
          "• رفع مشرف",
          "• تنزيل مشرف",
          "• تنظيف 0",
          "• رتبتي",
          "• رتبته",
          "• معلوماته",
          "• الألعاب"
        ].join("\n")
      );
    }

    /* -------------------------
       الأوامر المخصصة
    ------------------------- */

    const g =
      ensureGroup(ctx.chat.id);

    const custom =
      g.customCommands[text];

    if (custom) {
      return replyCommand(
        ctx,
        String(custom)
      );
    }
  }

  /* =======================================================
     رد الحكم بعد رسالة الحكم
  ======================================================= */

  if (
    ctx.message.text &&
    ctx.chat?.type !== "private"
  ) {
    const game =
      getGame(ctx);

    if (
      game.active &&
      !game.registering &&
      game.participants.includes(
        ctx.from.id
      )
    ) {
      const lastPair =
        game.usedPairs[
          game.usedPairs.length - 1
        ];

      if (lastPair) {
        const [
          judgeId,
          targetId
        ] = lastPair
          .split(":")
          .map(Number);

        if (
          ctx.from.id === judgeId
        ) {
          const text =
            ctx.message.text.trim();

          const targetUser =
            data.users[
              String(targetId)
            ];

          const targetMention =
            targetUser
              ? mention(targetUser)
              : `<a href="tg://user?id=${targetId}">المستخدم</a>`;

          const mentionsTarget =
            text.includes(
              `tg://user?id=${targetId}`
            ) ||
            text.includes(
              String(targetId)
            ) ||
            (
              targetUser?.username &&
              text.toLowerCase().includes(
                `@${targetUser.username.toLowerCase()}`
              )
            );

          const isReplyToTarget =
            ctx.message
              .reply_to_message
              ?.from?.id ===
            targetId;

          if (
            !mentionsTarget &&
            !isReplyToTarget
          ) {
            return replyCommand(
              ctx,
              `• لازم يكون الحكم على ${targetMention} أو يكون ردًا على رسالته`
            );
          }

          await replyCommand(
            ctx,
            `• تم تسجيل الحكم على ${targetMention}`
          );

          await nextAhkam(ctx);

          return;
        }
      }
    }
  }
});

/* =========================================================
   التعامل مع ردود الهمسات في الخاص
========================================================= */

bot.on("text", async ctx => {
  if (
    ctx.chat?.type !== "private"
  ) {
    return;
  }

  const key =
    `reply_${ctx.from.id}`;

  const pending =
    whisperStore[key];

  if (!pending) {
    return;
  }

  const whisper =
    whisperStore[
      pending.whisperId
    ];

  if (!whisper) {
    delete whisperStore[key];

    return safeReply(
      ctx,
      "• الهمسة غير موجودة"
    );
  }

  const originalUser =
    data.users[
      String(whisper.from)
    ];

  const replyText =
    ctx.message.text;

  try {
    await ctx.telegram.sendMessage(
      whisper.chatId,
      `• رد على الهمسة من ${escapeHtml(
        ctx.from.first_name || "مستخدم"
      )}\n• ${escapeHtml(replyText)}`
    );

    if (originalUser) {
      try {
        await ctx.telegram.sendMessage(
          whisper.from,
          `• وصلك رد على همستك من ${escapeHtml(
            ctx.from.first_name || "مستخدم"
          )}\n• ${escapeHtml(replyText)}`
        );
      } catch {}
    }

    delete whisperStore[key];

    return safeReply(
      ctx,
      "• تم إرسال الرد"
    );
  } catch (err) {
    return safeReply(
      ctx,
      "• ما قدرت أرسل الرد"
    );
  }
});

/* =========================================================
   الأخطاء
========================================================= */

bot.catch((err, ctx) => {
  console.error(
    "BOT ERROR:",
    err
  );

  try {
    if (ctx) {
      console.error(
        "CHAT:",
        ctx.chat?.id,
        "USER:",
        ctx.from?.id
      );
    }
  } catch {}
});

/* =========================================================
   تشغيل البوت
========================================================= */

(async () => {
  try {
    const me =
      await bot.telegram.getMe();

    bot.botInfo = me;

    console.log(
      `Bot started: @${me.username}`
    );

    await bot.launch();

    console.log(
      "ايف يعمل الآن"
    );
  } catch (err) {
    console.error(
      "فشل تشغيل البوت:",
      err
    );
  }
})();

process.once(
  "SIGINT",
  () => bot.stop("SIGINT")
);

process.once(
  "SIGTERM",
  () => bot.stop("SIGTERM")
);
