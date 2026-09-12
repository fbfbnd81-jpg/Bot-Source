const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");
const ytSearch = require("yt-search");

/* =========================================================
   الإعدادات
========================================================= */

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const DEV_USERNAME = "j4xa7";

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN غير موجود في متغيرات البيئة");
}

const bot = new Telegraf(BOT_TOKEN);

const DATA_FILE = path.join(__dirname, "data.json");

/* =========================================================
   الرتب
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

/* =========================================================
   الحماية
========================================================= */

const DEFAULT_PROTECTION = {
  enabled: true,
  auto: true,

  links: false,
  edit: false,
  spam: false,
  ads: false,
  mentions: false,
  forwards: false,

  photos: false,
  videos: false,
  documents: false,
  stickers: false,
  gifs: false,
  audio: false,
  voice: false,
  contacts: false,

  commands: false,
  english: false,
  forbiddenWords: true,
  crossGroupReplies: false
};

/* =========================================================
   إعدادات القروب الافتراضية
========================================================= */

const DEFAULT_GROUP = {
  settings: {
    protection: true,
    violationsEnabled: true,

    botReplies: true,
    bank: true,
    communication: true,

    forcedSubscription: false,
    serviceBot: false,

    stats: true,
    zagel: true,
    formats: true,

    autoClean: false,
    music: true,

    groupOpen: true
  },

  protection: {
    ...DEFAULT_PROTECTION
  },

  users: {},

  muted: {},
  globalMuted: {},

  warnings: {},

  customCommands: {},
  customReplies: {},

  forbiddenWords: [],

  messages: [],

  points: {},
  stats: {},

  games: {},

  pendingWhispers: {},
  whispers: {}
};

/* =========================================================
   تحميل البيانات
========================================================= */

let db = {};

try {
  if (fs.existsSync(DATA_FILE)) {
    db = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );
  }
} catch (error) {
  console.error("تعذر تحميل البيانات:", error.message);
  db = {};
}

/* =========================================================
   حفظ البيانات
========================================================= */

function save() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(db, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("تعذر حفظ البيانات:", error.message);
  }
}

setInterval(save, 15000);

/* =========================================================
   إنشاء بيانات القروب
========================================================= */

function ensureGroup(chatId) {
  const id = String(chatId);

  if (!db[id]) {
    db[id] = JSON.parse(
      JSON.stringify(DEFAULT_GROUP)
    );
  }

  const group = db[id];

  group.settings ||= {};
  group.protection ||= {};

  group.users ||= {};

  group.muted ||= {};
  group.globalMuted ||= {};

  group.warnings ||= {};

  group.customCommands ||= {};
  group.customReplies ||= {};

  group.forbiddenWords ||= [];

  group.messages ||= [];

  group.points ||= {};
  group.stats ||= {};

  group.games ||= {};

  group.pendingWhispers ||= {};
  group.whispers ||= {};

  for (const [key, value] of Object.entries(
    DEFAULT_GROUP.settings
  )) {
    if (group.settings[key] === undefined) {
      group.settings[key] = value;
    }
  }

  for (const [key, value] of Object.entries(
    DEFAULT_PROTECTION
  )) {
    if (group.protection[key] === undefined) {
      group.protection[key] = value;
    }
  }

  return group;
}

/* =========================================================
   أدوات عامة
========================================================= */

function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getText(message) {
  return (
    message?.text ||
    message?.caption ||
    ""
  );
}

function mention(user) {
  if (!user) {
    return "المستخدم";
  }

  const name =
    [
      user.first_name,
      user.last_name
    ]
      .filter(Boolean)
      .join(" ") ||
    "المستخدم";

  return `<a href="tg://user?id=${user.id}">${escapeHtml(
    name
  )}</a>`;
}

function status(value) {
  return value
    ? "مفعل ✅"
    : "معطل ❌";
}

/* =========================================================
   الرتب
========================================================= */

function roleOf(userId) {
  let highest = "عضو";
  let highestLevel = 0;

  for (const group of Object.values(db)) {
    const user =
      group.users?.[String(userId)];

    if (!user) continue;

    const role = user.role || "عضو";
    const level = ROLES[role] ?? 0;

    if (level > highestLevel) {
      highestLevel = level;
      highest = role;
    }
  }

  return highest;
}

function levelOf(userId) {
  return ROLES[roleOf(userId)] ?? 0;
}

function setUser(group, user, role = null) {
  const id = String(user.id);

  if (!group.users[id]) {
    group.users[id] = {
      id: user.id,

      username:
        user.username || "",

      name:
        user.first_name || "",

      role:
        role || "عضو",

      messages: 0,

      interactions: 0,

      points: 0,

      title: ""
    };
  }

  group.users[id].username =
    user.username ||
    group.users[id].username ||
    "";

  group.users[id].name =
    user.first_name ||
    group.users[id].name ||
    "";

  if (role) {
    group.users[id].role = role;
  }

  return group.users[id];
}

/* =========================================================
   صلاحيات تيليجرام
========================================================= */

async function getAdmins(ctx) {
  try {
    return await ctx.telegram.getChatAdministrators(
      ctx.chat.id
    );
  } catch {
    return [];
  }
}

async function isTelegramAdmin(
  ctx,
  userId = ctx.from?.id
) {
  const admins = await getAdmins(ctx);

  return admins.some(
    admin =>
      admin.user.id === userId
  );
}

async function isOwner(
  ctx,
  userId = ctx.from?.id
) {
  const admins = await getAdmins(ctx);

  const creator = admins.find(
    admin =>
      admin.status === "creator"
  );

  if (
    creator &&
    creator.user.id === userId
  ) {
    return true;
  }

  if (
    ctx.from?.username &&
    ctx.from.username.toLowerCase() ===
      DEV_USERNAME.toLowerCase()
  ) {
    return true;
  }

  return false;
}

async function canManage(
  ctx,
  requiredLevel = 4
) {
  if (
    !ctx.chat ||
    ctx.chat.type === "private"
  ) {
    return false;
  }

  if (
    await isOwner(ctx)
  ) {
    return true;
  }

  return (
    levelOf(ctx.from.id) >=
    requiredLevel
  );
}

async function canTarget(
  ctx,
  targetId
) {
  if (
    String(targetId) ===
    String(ctx.botInfo?.id)
  ) {
    return false;
  }

  const admins =
    await getAdmins(ctx);

  const targetAdmin =
    admins.find(
      admin =>
        admin.user.id ===
        targetId
    );

  if (
    targetAdmin &&
    (
      targetAdmin.status ===
        "creator" ||
      targetAdmin.status ===
        "administrator"
    )
  ) {
    return false;
  }

  if (
    targetId === ctx.from.id
  ) {
    return false;
  }

  return true;
}

function targetFromReply(ctx) {
  return (
    ctx.message
      ?.reply_to_message
      ?.from || null
  );
}

/* =========================================================
   أنواع الرسائل
========================================================= */

function mediaReason(message) {
  if (message?.sticker) {
    return "ملصقات";
  }

  if (message?.photo) {
    return "صور";
  }

  if (message?.video) {
    return "فيديو";
  }

  if (message?.document) {
    return "ملفات";
  }

  if (message?.animation) {
    return "GIF";
  }

  if (message?.audio) {
    return "صوتيات";
  }

  if (message?.voice) {
    return "رسائل صوتية";
  }

  if (message?.contact) {
    return "جهات اتصال";
  }

  return "نص";
}

/* =========================================================
   كشف المخالفات
========================================================= */

function hasLink(text) {
  return (
    /(https?:\/\/|www\.)\S+/i.test(
      text
    ) ||
    /\b[a-z0-9.-]+\.(com|net|org|me|io|co|sa|ly|gg|tv)\b/i.test(
      text
    )
  );
}

function hasAd(text) {
  return /(للبيع|بيع|شراء|خصم|متجر|متجرنا|اعلان|إعلان|اعلانات|إعلانات|للتواصل|تواصل معنا|اطلب|سعر خاص|عرض خاص|خدمات|رقم التواصل)/i.test(
    text
  );
}

function hasEnglish(text) {
  return /[A-Za-z]{2,}/.test(
    text
  );
}

function hasMention(ctx) {
  const entities = [
    ...(ctx.message?.entities || []),
    ...(ctx.message?.caption_entities || [])
  ];

  return entities.some(
    entity =>
      entity.type ===
        "mention" ||
      entity.type ===
        "text_mention"
  );
}

function isForwarded(message) {
  return !!(
    message?.forward_origin ||
    message?.forward_from ||
    message?.forward_from_chat ||
    message?.is_automatic_forward
  );
}

function violationReason(
  ctx,
  group
) {
  const message = ctx.message;

  if (!message) {
    return null;
  }

  const protection =
    group.protection;

  const text =
    getText(message);

  if (
    protection.forwards &&
    isForwarded(message)
  ) {
    return "فوروورد";
  }

  if (
    protection.crossGroupReplies &&
    message.reply_to_message &&
    isForwarded(
      message.reply_to_message
    )
  ) {
    return "ردود من قروبات ثانية";
  }

  if (
    protection.links &&
    hasLink(text)
  ) {
    return "روابط";
  }

  if (
    protection.ads &&
    hasAd(text)
  ) {
    return "إعلانات";
  }

  if (
    protection.mentions &&
    hasMention(ctx)
  ) {
    return "منشن";
  }

  if (
    protection.english &&
    hasEnglish(text)
  ) {
    return "إنجليزي";
  }

  if (
    protection.commands &&
    /^\/\S+/.test(text)
  ) {
    return "أوامر";
  }

  if (
    protection.forbiddenWords &&
    group.forbiddenWords.some(
      word =>
        word &&
        text
          .toLowerCase()
          .includes(
            String(word)
              .toLowerCase()
          )
    )
  ) {
    return "كلمات ممنوعة";
  }

  if (
    protection.photos &&
    message.photo
  ) {
    return "صور";
  }

  if (
    protection.videos &&
    message.video
  ) {
    return "فيديو";
  }

  if (
    protection.documents &&
    message.document
  ) {
    return "ملفات";
  }

  if (
    protection.stickers &&
    message.sticker
  ) {
    return "ملصقات";
  }

  if (
    protection.gifs &&
    message.animation
  ) {
    return "GIF";
  }

  if (
    protection.audio &&
    message.audio
  ) {
    return "صوتيات";
  }

  if (
    protection.voice &&
    message.voice
  ) {
    return "رسائل صوتية";
  }

  if (
    protection.contacts &&
    message.contact
  ) {
    return "جهات اتصال";
  }

  return null;
}

/* =========================================================
   السبام
========================================================= */

const spamCache = new Map();

function spamReason(ctx, group) {
  if (
    !group.protection.spam ||
    !ctx.from ||
    !ctx.message
  ) {
    return null;
  }

  const key =
    `${ctx.chat.id}:${ctx.from.id}`;

  const now = Date.now();

  const text =
    normalize(
      getText(ctx.message)
    );

  const old =
    spamCache.get(key) || [];

  const fresh =
    old.filter(
      item =>
        now - item.time <
        10000
    );

  fresh.push({
    time: now,
    text
  });

  spamCache.set(
    key,
    fresh.slice(-12)
  );

  if (
    fresh.length >= 9
  ) {
    return "سبام";
  }

  if (
    text &&
    fresh.filter(
      item =>
        item.text === text
    ).length >= 4
  ) {
    return "التكرار والسبام";
  }

  return null;
}

/* =========================================================
   رسالة المخالفة
========================================================= */

async function sendViolation(
  ctx,
  reason
) {
  try {
    await ctx.deleteMessage();
  } catch {}

  try {
    const message =
      await ctx.reply(
        `• المستخدم ذا ↤︎ ${mention(
          ctx.from
        )}\n• سبب المخالفة ↤︎ ${escapeHtml(
          reason
        )}`,
        {
          parse_mode:
            "HTML"
        }
      );

    setTimeout(
      () => {
        ctx.telegram
          .deleteMessage(
            ctx.chat.id,
            message.message_id
          )
          .catch(() => {});
      },
      8000
    );
  } catch {}
}

/* =========================================================
   تسجيل التفاعل
========================================================= */

function trackMessage(ctx) {
  const group =
    ensureGroup(
      ctx.chat.id
    );

  const type =
    mediaReason(
      ctx.message
    );

  group.messages.push({
    id:
      ctx.message.message_id,

    userId:
      ctx.from?.id || 0,

    type,

    text:
      getText(ctx.message),

    time:
      Date.now()
  });

  if (
    group.messages.length >
    3000
  ) {
    group.messages.splice(
      0,
      group.messages.length -
        3000
    );
  }

  if (ctx.from) {
    const user =
      setUser(
        group,
        ctx.from
      );

    user.messages++;

    user.interactions++;

    user.points =
      (user.points || 0) + 1;

    group.points[
      String(ctx.from.id)
    ] =
      user.points;

    group.stats.messages =
      (group.stats.messages || 0) +
      1;
  }
}

/* =========================================================
   حالة الحماية
========================================================= */

function protectionText(
  group
) {
  const p =
    group.protection;

  return [
    "🛡️ حالة الحماية",
    "",
    `• الحماية: ${status(
      p.enabled
    )}`,

    `• الحماية التلقائية: ${status(
      p.auto
    )}`,

    `• الروابط: ${status(
      p.links
    )}`,

    `• التعديل: ${status(
      p.edit
    )}`,

    `• السبام والتكرار: ${status(
      p.spam
    )}`,

    `• الإعلانات: ${status(
      p.ads
    )}`,

    `• المنشن: ${status(
      p.mentions
    )}`,

    `• الفوروورد: ${status(
      p.forwards
    )}`,

    `• الصور: ${status(
      p.photos
    )}`,

    `• الفيديو: ${status(
      p.videos
    )}`,

    `• الملفات: ${status(
      p.documents
    )}`,

    `• الملصقات: ${status(
      p.stickers
    )}`,

    `• GIF: ${status(
      p.gifs
    )}`,

    `• الصوتيات: ${status(
      p.audio
    )}`,

    `• الرسائل الصوتية: ${status(
      p.voice
    )}`,

    `• جهات الاتصال: ${status(
      p.contacts
    )}`,

    `• الأوامر: ${status(
      p.commands
    )}`,

    `• الإنجليزي: ${status(
      p.english
    )}`,

    `• الكلمات الممنوعة: ${status(
      p.forbiddenWords
    )}`,

    `• الردود من القروبات الثانية: ${status(
      p.crossGroupReplies
    )}`
  ].join("\n");
}

/* =========================================================
   الكتم
========================================================= */

async function muteUser(
  ctx,
  user,
  globalMute = false
) {
  if (!user) {
    return false;
  }

  if (
    !(await canTarget(
      ctx,
      user.id
    ))
  ) {
    return false;
  }

  const group =
    ensureGroup(
      ctx.chat.id
    );

  const store =
    globalMute
      ? group.globalMuted
      : group.muted;

  store[
    String(user.id)
  ] = {
    id: user.id,
    name:
      user.first_name || "",
    time: Date.now()
  };

  try {
    await ctx.telegram.restrictChatMember(
      ctx.chat.id,
      user.id,
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
          can_send_other_messages: false
        }
      }
    );
  } catch {}

  return true;
}

async function unmuteUser(
  ctx,
  userId
) {
  const group =
    ensureGroup(
      ctx.chat.id
    );

  delete group.muted[
    String(userId)
  ];

  delete group.globalMuted[
    String(userId)
  ];

  try {
    await ctx.telegram.restrictChatMember(
      ctx.chat.id,
      userId,
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
          can_send_other_messages: true
        }
      }
    );
  } catch {}
}

async function clearMutes(
  ctx,
  globalMute = false
) {
  const group =
    ensureGroup(
      ctx.chat.id
    );

  const store =
    globalMute
      ? group.globalMuted
      : group.muted;

  const ids =
    Object.keys(store);

  for (const id of ids) {
    await unmuteUser(
      ctx,
      Number(id)
    );
  }

  return ids.length;
}

/* =========================================================
   START + الهمسات
========================================================= */

bot.start(
  async ctx => {
    const payload =
      ctx.startPayload || "";

    if (
      payload.startsWith(
        "whisper_"
      )
    ) {
      const id =
        payload.slice(8);

      let found = null;

      for (const group of Object.values(
        db
      )) {
        if (
          group.pendingWhispers?.[id]
        ) {
          found = {
            group,
            data:
              group.pendingWhispers[id]
          };
          break;
        }

        if (
          group.whispers?.[id]
        ) {
          found = {
            group,
            data:
              group.whispers[id]
          };
          break;
        }
      }

      if (!found) {
        return ctx.reply(
          "هذه الهمسة غير موجودة أو انتهت."
        );
      }

      const w =
        found.data;

      if (
        ctx.from.id ===
        w.senderId &&
        found.group.pendingWhispers?.[id]
      ) {
        w.waiting = true;

        return ctx.reply(
          "أرسل الهمسة الآن 💌\n\nيدعم النص والصورة والملصق و GIF."
        );
      }

      if (
        ctx.from.id ===
        w.recipientId
      ) {
        return showWhisperPrivate(
          ctx,
          w
        );
      }

      return ctx.reply(
        "هذه الهمسة ليست لك."
      );
    }

    return ctx.reply(
      "هلا والله 👋\nالبوت شغال."
    );
  }
);

/* =========================================================
   إرسال محتوى الهمسة
========================================================= */

async function sendWhisperContent(
  ctx,
  group,
  whisper,
  message
) {
  whisper.content =
    message;

  whisper.waiting =
    false;

  group.whispers[
    String(whisper.id)
  ] = whisper;

  delete group.pendingWhispers[
    String(whisper.id)
  ];

  const id =
    String(whisper.id);

  const keyboard =
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "رؤية الهمسه",
          `whisper_view_${id}`
        )
      ],
      [
        Markup.button.callback(
          "رد على الهمسه",
          `whisper_reply_${id}`
        )
      ]
    ]);

  await ctx.telegram.sendMessage(
    whisper.chatId,
    `💌 وصلت همسة إلى ${mention({
      id: whisper.recipientId,
      first_name:
        whisper.recipientName
    })}`,
    {
      parse_mode:
        "HTML",
      ...keyboard
    }
  );

  return ctx.reply(
    "تم إرسال الهمسة 💌"
  );
}

/* =========================================================
   عرض الهمسة
========================================================= */

async function showWhisperPrivate(
  ctx,
  whisper
) {
  const content =
    whisper.content;

  if (!content) {
    return ctx.reply(
      "الهمسة غير موجودة."
    );
  }

  try {
    if (content.text) {
      return ctx.reply(
        `💌 ${content.text}`
      );
    }

    if (content.photo) {
      return ctx.replyWithPhoto(
        content.photo[
          content.photo.length - 1
        ].file_id,
        {
          caption:
            "💌 همسة"
        }
      );
    }

    if (content.sticker) {
      return ctx.replyWithSticker(
        content.sticker.file_id
      );
    }

    if (content.animation) {
      return ctx.replyWithAnimation(
        content.animation.file_id,
        {
          caption:
            "💌 همسة"
        }
      );
    }

    if (content.video) {
      return ctx.replyWithVideo(
        content.video.file_id,
        {
          caption:
            "💌 همسة"
        }
      );
    }

    if (content.voice) {
      return ctx.replyWithVoice(
        content.voice.file_id
      );
    }

    return ctx.reply(
      "💌 وصلت الهمسة."
    );
  } catch {
    return ctx.reply(
      "تعذر عرض الهمسة."
    );
  }
}

/* =========================================================
   CALLBACKS
========================================================= */

bot.on(
  "callback_query",
  async ctx => {
    const data =
      ctx.callbackQuery.data ||
      "";

    /* -----------------------------------------
       همسة - رؤية
    ----------------------------------------- */

    if (
      data.startsWith(
        "whisper_view_"
      )
    ) {
      const id =
        data.slice(
          "whisper_view_".length
        );

      const group =
        ensureGroup(
          ctx.callbackQuery
            .message
            .chat.id
        );

      const whisper =
        group.whispers[id];

      if (
        !whisper ||
        ctx.from.id !==
          whisper.recipientId
      ) {
        return ctx.answerCbQuery(
          "هذه الهمسة ليست لك.",
          {
            show_alert: true
          }
        );
      }

      await ctx.answerCbQuery();

      return showWhisperPrivate(
        ctx,
        whisper
      );
    }

    /* -----------------------------------------
       همسة - رد
    ----------------------------------------- */

    if (
      data.startsWith(
        "whisper_reply_"
      )
    ) {
      const id =
        data.slice(
          "whisper_reply_".length
        );

      const group =
        ensureGroup(
          ctx.callbackQuery
            .message
            .chat.id
        );

      const whisper =
        group.whispers[id];

      if (
        !whisper ||
        ctx.from.id !==
          whisper.recipientId
      ) {
        return ctx.answerCbQuery(
          "هذه الهمسة ليست لك.",
          {
            show_alert: true
          }
        );
      }

      whisper.waitingReply =
        true;

      whisper.replyUserId =
        ctx.from.id;

      await ctx.answerCbQuery();

      return ctx.reply(
        "أرسل ردك على الهمسة الآن 💌"
      );
    }

    /* -----------------------------------------
       رفع رتبة
    ----------------------------------------- */

    if (
      data.startsWith(
        "promote_"
      )
    ) {
      if (
        !(await canManage(
          ctx,
          4
        ))
      ) {
        return ctx.answerCbQuery(
          "ما عندك صلاحية.",
          {
            show_alert: true
          }
        );
      }

      const parts =
        data.split("_");

      const userId =
        parts[1];

      const roleIndex =
        Number(parts[2]);

      const roles =
        Object.keys(ROLES);

      const role =
        roles[roleIndex];

      if (!role) {
        return ctx.answerCbQuery(
          "الرتبة غير موجودة."
        );
      }

      const group =
        ensureGroup(
          ctx.chat.id
        );

      const user =
        group.users[
          String(userId)
        ];

      if (!user) {
        return ctx.answerCbQuery(
          "المستخدم غير مسجل."
        );
      }

      user.role =
        role;

      await ctx.answerCbQuery(
        `تم تعيين ${role}`
      );

      await ctx.reply(
        `• تم رفع رتبة ${mention({
          id: Number(userId),
          first_name:
            user.name
        })}\n• الرتبة ↤︎ ${escapeHtml(
          role
        )}`,
        {
          parse_mode:
            "HTML"
        }
      );

      save();
    }
  }
);

/* =========================================================
   الرسائل الخاصة
========================================================= */

bot.on(
  "message",
  async (ctx, next) => {
    if (
      ctx.chat.type !==
      "private"
    ) {
      return next();
    }

    for (const group of Object.values(
      db
    )) {
      /* -----------------------------------------
         محتوى الهمسة
      ----------------------------------------- */

      for (const whisper of Object.values(
        group.pendingWhispers ||
          {}
      )) {
        if (
          whisper.senderId ===
            ctx.from.id &&
          whisper.waiting
        ) {
          return sendWhisperContent(
            ctx,
            group,
            whisper,
            ctx.message
          );
        }
      }

      /* -----------------------------------------
         رد الهمسة
      ----------------------------------------- */

      for (const whisper of Object.values(
        group.whispers ||
          {}
      )) {
        if (
          whisper.waitingReply &&
          whisper.replyUserId ===
            ctx.from.id
        ) {
          whisper.waitingReply =
            false;

          try {
            if (
              ctx.message.text
            ) {
              const text =
                ctx.message.text;

              await ctx.telegram.sendMessage(
                whisper.senderId,
                `💌 رد على همستك:\n${escapeHtml(
                  text
                )}`,
                {
                  parse_mode:
                    "HTML"
                }
              );

              return ctx.reply(
                "تم إرسال الرد 💌"
              );
            }

            if (
              ctx.message.photo
            ) {
              const photo =
                ctx.message.photo[
                  ctx.message.photo
                    .length - 1
                ].file_id;

              await ctx.telegram.sendPhoto(
                whisper.senderId,
                photo,
                {
                  caption:
                    "💌 رد على همستك"
                }
              );

              return ctx.reply(
                "تم إرسال الرد 💌"
              );
            }

            if (
              ctx.message.sticker
            ) {
              await ctx.telegram.sendSticker(
                whisper.senderId,
                ctx.message
                  .sticker.file_id
              );

              return ctx.reply(
                "تم إرسال الرد 💌"
              );
            }

            if (
              ctx.message.animation
            ) {
              await ctx.telegram.sendAnimation(
                whisper.senderId,
                ctx.message
                  .animation.file_id,
                {
                  caption:
                    "💌 رد على همستك"
                }
              );

              return ctx.reply(
                "تم إرسال الرد 💌"
              );
            }

            return ctx.reply(
              "تم إرسال الرد 💌"
            );
          } catch {
            return ctx.reply(
              "تعذر إرسال الرد."
            );
          }
        }
      }
    }

    return next();
  }
);

/* =========================================================
   حماية التعديل
========================================================= */

bot.on(
  "edited_message",
  async ctx => {
    if (
      !ctx.chat ||
      !ctx.from ||
      !ctx.message
    ) {
      return;
    }

    if (
      ctx.chat.type ===
      "private"
    ) {
      return;
    }

    const group =
      ensureGroup(
        ctx.chat.id
      );

    if (
      !group.protection.enabled ||
      !group.protection.auto ||
      !group.protection.edit
    ) {
      return;
    }

    if (
      levelOf(ctx.from.id) >
      0
    ) {
      return;
    }

    if (
      await isTelegramAdmin(
        ctx,
        ctx.from.id
      )
    ) {
      return;
    }

    try {
      await ctx.deleteMessage();
    } catch {}

    try {
      const warning =
        await ctx.reply(
          `• المستخدم ذا ↤︎ ${mention(
            ctx.from
          )}\n• سبب المخالفة ↤︎ التعديل`,
          {
            parse_mode:
              "HTML"
          }
        );

      setTimeout(
        () => {
          ctx.telegram
            .deleteMessage(
              ctx.chat.id,
              warning.message_id
            )
            .catch(() => {});
        },
        8000
      );
    } catch {}
  }
);

/* =========================================================
   معالج القروبات الرئيسي
========================================================= */

bot.on(
  "message",
  async (ctx, next) => {
    if (
      !ctx.chat ||
      ctx.chat.type ===
        "private" ||
      !ctx.from
    ) {
      return next();
    }

    const group =
      ensureGroup(
        ctx.chat.id
      );

    const message =
      ctx.message;

    setUser(
      group,
      ctx.from
    );

    /* -----------------------------------------
       دعوة للمكالمة
    ----------------------------------------- */

    if (
      message
        .video_chat_participants_invited
        ?.users
        ?.length
    ) {
      for (
        const invited of
          message
            .video_chat_participants_invited
            .users
      ) {
        await ctx.reply(
          `• المستخدم ذا ↤︎ ${mention(
            ctx.from
          )}\n• قام بدعوة ↤︎ ${mention(
            invited
          )} للمكالمة`,
          {
            parse_mode:
              "HTML"
          }
        );
      }

      return;
    }

    /* -----------------------------------------
       الحماية
    ----------------------------------------- */

    if (
      group.protection.enabled &&
      group.protection.auto &&
      levelOf(ctx.from.id) ===
        0 &&
      !(await isTelegramAdmin(
        ctx,
        ctx.from.id
      ))
    ) {
      const reason =
        violationReason(
          ctx,
          group
        ) ||
        spamReason(
          ctx,
          group
        );

      if (reason) {
        await sendViolation(
          ctx,
          reason
        );

        return;
      }
    }

    /* -----------------------------------------
       تسجيل الرسالة
    ----------------------------------------- */

    trackMessage(ctx);

    const text =
      getText(message)
        .trim();

    /* =====================================================
       الهمسات
    ===================================================== */

    if (
      /^(اهمس|همسه|همسة|ه)$/.test(
        text
      ) &&
      message.reply_to_message
        ?.from
    ) {
      const target =
        message
          .reply_to_message
          .from;

      const id =
        `${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`;

      group.pendingWhispers[
        id
      ] = {
        id,

        chatId:
          ctx.chat.id,

        senderId:
          ctx.from.id,

        senderName:
          ctx.from.first_name ||
          "",

        recipientId:
          target.id,

        recipientName:
          target.first_name ||
          "",

        waiting: false,

        createdAt:
          Date.now()
      };

      const me =
        await ctx.telegram.getMe();

      const link =
        `https://t.me/${me.username}?start=whisper_${id}`;

      return ctx.reply(
        `💌 ${mention(
          target
        )}\nاضغط «اهمس هنا» لإرسال همسة خاصة.`,
        {
          parse_mode:
            "HTML",

          ...Markup.inlineKeyboard(
            [
              [
                Markup.button.url(
                  "اهمس هنا",
                  link
                )
              ]
            ]
          )
        }
      );
    }

    /* =====================================================
       مسح المكتومين
    ===================================================== */

    if (
      /^(مم|مسح المكتومين)$/.test(
        text
      )
    ) {
      if (
        !(await canManage(
          ctx,
          4
        ))
      ) {
        return;
      }

      const count =
        await clearMutes(
          ctx,
          false
        );

      return ctx.reply(
        count
          ? `• تم مسح ( ${count} ) من المكتومين`
          : "• لا يوجد مكتومين"
      );
    }

    /* =====================================================
       مسح المكتومين عام
    ===================================================== */

    if (
      /^(خخ|مسح المكتومين عام)$/.test(
        text
      )
    ) {
      if (
        !(await canManage(
          ctx,
          4
        ))
      ) {
        return;
      }

      const count =
        await clearMutes(
          ctx,
          true
        );

      return ctx.reply(
        count
          ? `• تم مسح ( ${count} ) من المكتومين عام`
          : "• لا يوجد مكتومين عام"
      );
    }

    /* =====================================================
       التصفير
    ===================================================== */

    if (
      /^(تصفير|تصفير التفاعل)$/.test(
        text
      )
    ) {
      if (
        !(await canManage(
          ctx,
          4
        ))
      ) {
        return;
      }

      const target =
        targetFromReply(ctx);

      if (!target) {
        return ctx.reply(
          "رد على الشخص أول."
        );
      }

      const user =
        setUser(
          group,
          target
        );

      user.messages = 0;
      user.interactions = 0;
      user.points = 0;

      group.points[
        String(target.id)
      ] = 0;

      return ctx.reply(
        `• تم تصفير تفاعل ${mention(
          target
        )}`,
        {
          parse_mode:
            "HTML"
        }
      );
    }

    /* =====================================================
       تنظيف يدوي
    ===================================================== */

    if (
      /^تنظيف(?:\s+(\d+))?$/.test(
        text
      )
    ) {
      /*
        حسب طلبك:
        تنظيف للمستخدمين اللي رتبتهم عضو فقط.
      */

      if (
        levelOf(ctx.from.id) !==
        0
      ) {
        return;
      }

      const match =
        text.match(
          /^تنظيف(?:\s+(\d+))?$/
        );

      const amount =
        Math.min(
          Number(
            match?.[1] || 20
          ),
          100
        );

      const list =
        group.messages
          .slice(-amount);

      let deleted = 0;

      for (
        const item of list
      ) {
        try {
          await ctx.telegram.deleteMessage(
            ctx.chat.id,
            item.id
          );

          deleted++;
        } catch {}
      }

      group.messages =
        group.messages.filter(
          item =>
            !list.includes(item)
        );

      return ctx.reply(
        `• تم تنظيف ( ${deleted} ) من الرسائل`
      );
    }

    /* =====================================================
       حالة الحماية
    ===================================================== */

    if (
      /^حالة الحماية$/.test(
        text
      )
    ) {
      if (
        !(await canManage(
          ctx,
          4
        ))
      ) {
        return;
      }

      return ctx.reply(
        protectionText(
          group
        )
      );
    }

    /* =====================================================
       تفعيل الحماية
    ===================================================== */

    if (
      /^(تفعيل|فتح) الحماية$/.test(
        text
      )
    ) {
      if (
        !(await canManage(
          ctx,
          4
        ))
      ) {
        return;
      }

      group.protection.enabled =
        true;

      group.settings.violationsEnabled =
        true;

      return ctx.reply(
        "• تم تفعيل الحماية"
      );
    }

    /* =====================================================
       تعطيل الحماية
    ===================================================== */

    if (
      /^(تعطيل|قفل) الحماية$/.test(
        text
      )
    ) {
      if (
        !(await canManage(
          ctx,
          4
        ))
      ) {
        return;
      }

      group.protection.enabled =
        false;

      group.settings.violationsEnabled =
        false;

      return ctx.reply(
        "• تم تعطيل الحماية"
      );
    }

    /* =====================================================
       الحماية التلقائية
    ===================================================== */

    if (
      /^تفعيل الحماية التلقائية$/.test(
        text
      )
    ) {
      if (
        !(await canManage(
          ctx,
          4
        ))
      ) {
        return;
      }

      group.protection.auto =
        true;

      return ctx.reply(
        "• تم تفعيل الحماية التلقائية"
      );
    }

    if (
      /^تعطيل الحماية التلقائية$/.test(
        text
      )
    ) {
      if (
        !(await canManage(
          ctx,
          4
        ))
      ) {
        return;
      }

      group.protection.auto =
        false;

      return ctx.reply(
        "• تم تعطيل الحماية التلقائية"
      );
    }

    /* =====================================================
       أنواع الحماية
    ===================================================== */

    const protectionMap = {
      "الروابط":
        "links",

      "التعديل":
        "edit",

      "السبام":
        "spam",

      "الاعلانات":
        "ads",

      "الإعلانات":
        "ads",

      "المنشن":
        "mentions",

      "الفوروورد":
        "forwards",

      "الفوروارد":
        "forwards",

      "الصور":
        "photos",

      "الفيديو":
        "videos",

      "الملفات":
        "documents",

      "الملصقات":
        "stickers",

      "gif":
        "gifs",

      "GIF":
        "gifs",

      "الصوتيات":
        "audio",

      "الرسائل الصوتية":
        "voice",

      "جهات الاتصال":
        "contacts",

      "الأوامر":
        "commands",

      "الإنجليزي":
        "english",

      "الردود من القروبات":
        "crossGroupReplies",

      "الكلمات الممنوعة":
        "forbiddenWords"
    };

    const protectionCommand =
      text.match(
        /^(فتح|قفل|تفعيل|تعطيل)\s+(.+)$/
      );

    if (
      protectionCommand &&
      protectionMap[
        protectionCommand[2]
      ]
    ) {
      if (
        !(await canManage(
          ctx,
          4
        ))
      ) {
        return;
      }

      const key =
        protectionMap[
          protectionCommand[2]
        ];

      const enabled =
        /^(فتح|تفعيل)$/.test(
          protectionCommand[1]
        );

      group.protection[
        key
      ] = enabled;

      return ctx.reply(
        `• ${
          enabled
            ? "تم تفعيل"
            : "تم تعطيل"
        } ${protectionCommand[2]}`
      );
    }

    /* =====================================================
       التنظيف التلقائي
    ===================================================== */

    if (
      /^تفعيل التنظيف التلقائي$/.test(
        text
      )
    ) {
      if (
        !(await canManage(
          ctx,
          4
        ))
      ) {
        return;
      }

      group.settings.autoClean =
        true;

      return ctx.reply(
        "• تم تفعيل التنظيف التلقائي\n• يتم تنظيف الملصقات كل دقيقتين"
      );
    }

    if (
      /^تعطيل التنظيف التلقائي$/.test(
        text
      )
    ) {
      if (
        !(await canManage(
          ctx,
          4
        ))
      ) {
        return;
      }

      group.settings.autoClean =
        false;

      return ctx.reply(
        "• تم تعطيل التنظيف التلقائي"
      );
    }

    /* =====================================================
       الكتم
    ===================================================== */

    const target =
      targetFromReply(ctx);

    if (
      /^(كتم|كتمه)$/.test(
        text
      ) &&
      target
    ) {
      if (
        !(await canManage(
          ctx,
          2
        ))
      ) {
        return;
      }

      const result =
        await muteUser(
          ctx,
          target,
          false
        );

      if (!result) {
        return ctx.reply(
          "ما أقدر أكتم هذا المستخدم."
        );
      }

      return ctx.reply(
        `• تم كتم ${mention(
          target
        )}`,
        {
          parse_mode:
            "HTML"
        }
      );
    }

    /* =====================================================
       الكتم العام
    ===================================================== */

    if (
      /^(كتم عام|كتمه عام)$/.test(
        text
      ) &&
      target
    ) {
      if (
        !(await canManage(
          ctx,
          4
        ))
      ) {
        return;
      }

      const result =
        await muteUser(
          ctx,
          target,
          true
        );

      if (!result) {
        return ctx.reply(
          "ما أقدر أكتم هذا المستخدم."
        );
      }

      return ctx.reply(
        `• تم كتمه عام ${mention(
          target
        )}`,
        {
          parse_mode:
            "HTML"
        }
      );
    }

    /* =====================================================
       فك الكتم
    ===================================================== */

    if (
      /^(فك الكتم|فك كتم|فك)$/.test(
        text
      ) &&
      target
    ) {
      if (
        !(await canManage(
          ctx,
          2
        ))
      ) {
        return;
      }

      await unmuteUser(
        ctx,
        target.id
      );

      return ctx.reply(
        `• تم فك كتم ${mention(
          target
        )}`,
        {
          parse_mode:
            "HTML"
        }
      );
    }

    /* =====================================================
       الطرد
    ===================================================== */

    if (
      /^(طرد|kick)$/i.test(
        text
      ) &&
      target
    ) {
      if (
        !(await canManage(
          ctx,
          2
        ))
      ) {
        return;
      }

      if (
        !(await canTarget(
          ctx,
          target.id
        ))
      ) {
        return ctx.reply(
          "ما أقدر أتعامل مع هذا المستخدم."
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
            only_if_banned:
              true
          }
        );

        return ctx.reply(
          `• تم طرد ${mention(
            target
          )}`,
          {
            parse_mode:
              "HTML"
          }
        );
      } catch {
        return ctx.reply(
          "تعذر الطرد. تأكد من صلاحيات البوت."
        );
      }
    }

    /* =====================================================
       الحظر
    ===================================================== */

    if (
      /^(حظر|ban)$/i.test(
        text
      ) &&
      target
    ) {
      if (
        !(await canManage(
          ctx,
          3
        ))
      ) {
        return;
      }

      if (
        !(await canTarget(
          ctx,
          target.id
        ))
      ) {
        return ctx.reply(
          "ما أقدر أتعامل مع هذا المستخدم."
        );
      }

      try {
        await ctx.telegram.banChatMember(
          ctx.chat.id,
          target.id
        );

        return ctx.reply(
          `• تم حظر ${mention(
            target
          )}`,
          {
            parse_mode:
              "HTML"
          }
        );
      } catch {
        return ctx.reply(
          "تعذر الحظر. تأكد من صلاحيات البوت."
        );
      }
    }

    /* =====================================================
       تنزيل رتبة
    ===================================================== */

    if (
      /^(تنزيل|تنزيل رتبه|تنزيل رتبة|خفض)$/.test(
        text
      ) &&
      target
    ) {
      if (
        !(await canManage(
          ctx,
          3
        ))
      ) {
        return;
      }

      if (
        !(await canTarget(
          ctx,
          target.id
        ))
      ) {
        return ctx.reply(
          "ما أقدر أنزل رتبة هذا المستخدم."
        );
      }

      const user =
        setUser(
          group,
          target
        );

      const oldRole =
        user.role ||
        "عضو";

      const wasMuted =
        !!(
          group.muted[
            String(
              target.id
            )
          ] ||
          group.globalMuted[
            String(
              target.id
            )
          ]
        );

      user.role =
        "عضو";

      try {
        await ctx.telegram.promoteChatMember(
          ctx.chat.id,
          target.id,
          {
            can_manage_chat:
              false,

            can_delete_messages:
              false,

            can_manage_video_chats:
              false,

            can_restrict_members:
              false,

            can_promote_members:
              false,

            can_change_info:
              false,

            can_invite_users:
              false,

            can_pin_messages:
              false
          }
        );
      } catch {}

      let output =
        `• تم تنزيله من الرتب التالية ( ${escapeHtml(
          oldRole
        )} )\n\n• المستخدم ذا ↤︎ ${mention(
          target
        )}`;

      if (wasMuted) {
        output +=
          "\n• من قبل مكتوم";
      }

      return ctx.reply(
        output,
        {
          parse_mode:
            "HTML"
        }
      );
    }

    /* =====================================================
       رفع رتبة
    ===================================================== */

    const rankMatch =
      text.match(
        /^رفع\s+(.+)$/
      );

    if (
      rankMatch &&
      target
    ) {
      if (
        !(await canManage(
          ctx,
          4
        ))
      ) {
        return;
      }

      const role =
        Object.keys(
          ROLES
        ).find(
          item =>
            item.toLowerCase() ===
            rankMatch[1]
              .trim()
              .toLowerCase()
        );

      if (!role) {
        return ctx.reply(
          "الرتبة غير موجودة."
        );
      }

      const user =
        setUser(
          group,
          target,
          role
        );

      return ctx.reply(
        `• تم رفع رتبة ${mention(
          target
        )}\n• الرتبة ↤︎ ${escapeHtml(
          user.role
        )}`,
        {
          parse_mode:
            "HTML"
        }
      );
    }

    /* =====================================================
       المالك
    ===================================================== */

    if (
      /^المالك$/.test(
        text
      )
    ) {
      try {
        const admins =
          await getAdmins(
            ctx
          );

        const owner =
          admins.find(
            admin =>
              admin.status ===
              "creator"
          )?.user;

        if (!owner) {
          return ctx.reply(
            "ما قدرت أحدد مالك القروب."
          );
        }

        const name =
          [
            owner.first_name,
            owner.last_name
          ]
            .filter(Boolean)
            .join(" ");

        const username =
          owner.username
            ? `@${escapeHtml(
                owner.username
              )}`
            : "بدون يوزر";

        const caption =
          `👑 المالك\n\n• الاسم ↤︎ ${escapeHtml(
            name
          )}\n• اليوزر ↤︎ ${username}`;

        const photos =
          await ctx.telegram.getUserProfilePhotos(
            owner.id,
            0,
            1
          );

        if (
          photos.total_count >
          0
        ) {
          const photo =
            photos.photos[0][
              photos.photos[0]
                .length - 1
            ].file_id;

          return ctx.replyWithPhoto(
            photo,
            {
              caption,
              parse_mode:
                "HTML"
            }
          );
        }

        return ctx.reply(
          caption,
          {
            parse_mode:
              "HTML"
          }
        );
      } catch {
        return ctx.reply(
          "تعذر عرض بيانات المالك."
        );
      }
    }

    /* =====================================================
       رتبتي
    ===================================================== */

    if (
      /^(صلاحياتي|رتبتي)$/.test(
        text
      )
    ) {
      return ctx.reply(
        `• رتبتك ↤︎ ${roleOf(
          ctx.from.id
        )}\n• المستوى ↤︎ ${levelOf(
          ctx.from.id
        )}`
      );
    }

    /* =====================================================
       إحصائياتي
    ===================================================== */

    if (
      /^(احصائيات|إحصائيات|احصائياتي|إحصائياتي)$/.test(
        text
      )
    ) {
      const user =
        setUser(
          group,
          ctx.from
        );

      return ctx.reply(
        `📊 إحصائياتك\n\n• الرسائل ↤︎ ${user.messages}\n• التفاعل ↤︎ ${user.interactions}\n• النقاط ↤︎ ${user.points}`
      );
    }

    /* =====================================================
       النقاط
    ===================================================== */

    if (
      /^(نقاطي|نقاط)$/.test(
        text
      )
    ) {
      const user =
        setUser(
          group,
          ctx.from
        );

      return ctx.reply(
        `• نقاطك ↤︎ ${user.points}`
      );
    }

    /* =====================================================
       فتح / قفل القروب
    ===================================================== */

    if (
      /^(فتح|قفل) القروب$/.test(
        text
      )
    ) {
      if (
        !(await canManage(
          ctx,
          2
        ))
      ) {
        return;
      }

      const open =
        text.startsWith(
          "فتح"
        );

      group.settings.groupOpen =
        open;

      try {
        await ctx.telegram.setChatPermissions(
          ctx.chat.id,
          open
            ? {
                can_send_messages:
                  true,

                can_send_audios:
                  true,

                can_send_documents:
                  true,

                can_send_photos:
                  true,

                can_send_videos:
                  true,

                can_send_video_notes:
                  true,

                can_send_voice_notes:
                  true,

                can_send_polls:
                  true,

                can_send_other_messages:
                  true
              }
            : {
                can_send_messages:
                  false
              }
        );
      } catch {}

      return ctx.reply(
        open
          ? "• تم فتح القروب"
          : "• تم قفل القروب"
      );
    }

    /* =====================================================
       منشن الكل
    ===================================================== */

    if (
      /^(منشن الكل|منشن الجميع|@all)$/.test(
        text
      )
    ) {
      if (
        !(await canManage(
          ctx,
          4
        ))
      ) {
        return;
      }

      const users =
        Object.values(
          group.users
        ).slice(
          0,
          50
        );

      if (!users.length) {
        return ctx.reply(
          "ما عندي أعضاء مسجلين."
        );
      }

      return ctx.reply(
        users
          .map(
            user =>
              mention({
                id: user.id,
                first_name:
                  user.name
              })
          )
          .join(" "),
        {
          parse_mode:
            "HTML"
        }
      );
    }

    /* =====================================================
       الكلمات الممنوعة
    ===================================================== */

    const addWord =
      text.match(
        /^(اضف|أضف)\s+كلمة ممنوعة\s+(.+)$/
      );

    if (addWord) {
      if (
        !(await canManage(
          ctx,
          4
        ))
      ) {
        return;
      }

      const word =
        addWord[2].trim();

      if (
        !group.forbiddenWords.includes(
          word
        )
      ) {
        group.forbiddenWords.push(
          word
        );
      }

      return ctx.reply(
        `• تمت إضافة الكلمة الممنوعة: ${word}`
      );
    }

    const deleteWord =
      text.match(
        /^حذف\s+كلمة ممنوعة\s+(.+)$/
      );

    if (deleteWord) {
      if (
        !(await canManage(
          ctx,
          4
        ))
      ) {
        return;
      }

      group.forbiddenWords =
        group.forbiddenWords.filter(
          word =>
            word !==
            deleteWord[1].trim()
        );

      return ctx.reply(
        "• تم حذف الكلمة الممنوعة"
      );
    }

    /* =====================================================
       بحث الأغاني في يوتيوب
    ===================================================== */

    const musicMatch =
      text.match(
        /^(بحث|بحث أغنية|بحث اغنية|أغنية|اغنية|شغل|تشغيل|يوتيوب)\s+(.+)$/i
      );

    if (
      musicMatch &&
      group.settings.music
    ) {
      const query =
        musicMatch[2].trim();

      try {
        const result =
          await ytSearch(
            query
          );

        const videos =
          result.videos
            .slice(0, 5);

        if (!videos.length) {
          return ctx.reply(
            "ما لقيت نتائج."
          );
        }

        const buttons =
          videos.map(
            (video, index) => [
              Markup.button.url(
                `${index + 1} - ${video.title.slice(
                  0,
                  45
                )}`,
                video.url
              )
            ]
          );

        return ctx.reply(
          `🎵 نتائج البحث عن: ${escapeHtml(
            query
          )}`,
          {
            parse_mode:
              "HTML",

            ...Markup.inlineKeyboard(
              buttons
            )
          }
        );
      } catch (error) {
        console.error(
          "YouTube Search Error:",
          error.message
        );

        return ctx.reply(
          "تعذر البحث في يوتيوب حاليًا."
        );
      }
    }

    /* =====================================================
       إضافة رد
    ===================================================== */

    if (
      text.startsWith(
        "اضف رد "
      )
    ) {
      if (
        !(await canManage(
          ctx,
          4
        ))
      ) {
        return;
      }

      const parts =
        text
          .slice(8)
          .split("|");

      if (
        parts.length >= 2
      ) {
        const command =
          parts[0].trim();

        const reply =
          parts
            .slice(1)
            .join("|")
            .trim();

        group.customReplies[
          command
        ] = reply;

        return ctx.reply(
          "• تم إضافة الرد"
        );
      }
    }

    /* =====================================================
       الردود المخصصة
    ===================================================== */

    if (
      group.customReplies[
        text
      ]
    ) {
      return ctx.reply(
        group.customReplies[
          text
        ]
      );
    }

    /* =====================================================
       ردود البوت
    ===================================================== */

    if (
      group.settings.botReplies
    ) {
      if (
        text ===
        "السلام عليكم"
      ) {
        return ctx.reply(
          "وعليكم السلام ورحمة الله وبركاته 🤍"
        );
      }

      if (
        text === "هلا"
      ) {
        return ctx.reply(
          "هلا وغلا 👋"
        );
      }

      if (
        text === "بوت"
      ) {
        return ctx.reply(
          "سمّ 😎"
        );
      }
    }

    return next();
  }
);

/* =========================================================
   التنظيف التلقائي
   كل دقيقتين
========================================================= */

setInterval(
  async () => {
    for (
      const [
        chatId,
        group
      ] of Object.entries(
        db
      )
    ) {
      if (
        !group.settings
          ?.autoClean
      ) {
        continue;
      }

      const now =
        Date.now();

      const recent =
        group.messages.filter(
          item =>
            now - item.time <
            48 *
              60 *
              60 *
              1000
        );

      /*
        المطلوب:
        تنظيف الملصقات كل دقيقتين
      */

      const stickers =
        recent
          .filter(
            item =>
              item.type ===
              "ملصقات"
          )
          .slice(
            -100
          );

      for (
        const item of
          stickers
      ) {
        try {
          await bot.telegram.deleteMessage(
            chatId,
            item.id
          );

          group.messages =
            group.messages.filter(
              message =>
                message.id !==
                item.id
            );
        } catch {}
      }
    }
  },
  120000
);

/* =========================================================
   تنظيف البيانات القديمة
========================================================= */

setInterval(
  () => {
    const limit =
      Date.now() -
      48 *
        60 *
        60 *
        1000;

    for (
      const group of Object.values(
        db
      )
    ) {
      group.messages =
        (group.messages || [])
          .filter(
            message =>
              message.time >
              limit
          );
    }

    save();
  },
  10 *
    60 *
    1000
);

/* =========================================================
   الأخطاء
========================================================= */

bot.catch(
  error => {
    console.error(
      "BOT ERROR:",
      error?.message ||
        error
    );
  }
);

/* =========================================================
   تشغيل البوت
========================================================= */

(async () => {
  try {
    const me =
      await bot.telegram.getMe();

    bot.botInfo =
      me;

    console.log(
      `Bot started: @${me.username}`
    );

    await bot.launch();

    console.log(
      "Telegram bot is running."
    );
  } catch (error) {
    console.error(
      "Failed to start bot:",
      error
    );

    process.exit(1);
  }
})();

/* =========================================================
   إيقاف آمن
========================================================= */

process.once(
  "SIGINT",
  () => {
    save();
    bot.stop(
      "SIGINT"
    );
  }
);

process.once(
  "SIGTERM",
  () => {
    save();
    bot.stop(
      "SIGTERM"
    );
  }
);
