const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");

/* =========================================================
   CONFIG
========================================================= */

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN غير موجود في Secrets");
}

const bot = new Telegraf(BOT_TOKEN);

const OWNER_USERNAME = "j4xa7";
const DATA_FILE = path.join(__dirname, "data.json");

/* =========================================================
   ROLES
========================================================= */

const ROLES = {
  MEMBER: {
    key: "MEMBER",
    name: "عضو",
    level: 0
  },
  VIP: {
    key: "VIP",
    name: "مميز",
    level: 1
  },
  OWNER: {
    key: "OWNER",
    name: "مالك",
    level: 2
  },
  MAIN_OWNER: {
    key: "MAIN_OWNER",
    name: "مالك أساسي",
    level: 3
  },
  MYTH: {
    key: "MYTH",
    name: "Myth",
    level: 4
  },
  MYTH2: {
    key: "MYTH2",
    name: "Myth 🎖️",
    level: 5
  },
  DEV2: {
    key: "DEV2",
    name: "Dev²🎖️",
    level: 6
  },
  DEV: {
    key: "DEV",
    name: "Dev🎖️",
    level: 7
  }
};

/* =========================================================
   DATA
========================================================= */

let data = {
  users: {},
  chats: {},
  customCommands: {},
  customReplies: {},
  whispers: {},
  nextWhisperId: 1,
  ownerProfile: {
    username: "j4xa7"
  }
};

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      saveData();
      return;
    }

    const saved = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    data = {
      ...data,
      ...saved,
      users: saved.users || {},
      chats: saved.chats || {},
      customCommands: saved.customCommands || {},
      customReplies: saved.customReplies || {},
      whispers: saved.whispers || {},
      ownerProfile: saved.ownerProfile || {
        username: OWNER_USERNAME
      }
    };
  } catch (err) {
    console.error("DATA LOAD ERROR:", err);
  }
}

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2),
      "utf8"
    );
  } catch (err) {
    console.error("DATA SAVE ERROR:", err);
  }
}

loadData();

/* =========================================================
   BASIC
========================================================= */

function isGroup(ctx) {
  return (
    ctx.chat &&
    (ctx.chat.type === "group" ||
      ctx.chat.type === "supergroup")
  );
}

function userId(ctx) {
  return String(ctx.from?.id || "");
}

function username(ctx) {
  return String(ctx.from?.username || "");
}

function isDev(ctx) {
  return (
    username(ctx).toLowerCase() ===
    OWNER_USERNAME.toLowerCase()
  );
}

function ensureUser(ctx) {
  const id = userId(ctx);

  if (!id) return null;

  if (!data.users[id]) {
    data.users[id] = {
      id,
      username: username(ctx),
      firstName: ctx.from?.first_name || "",
      role: "MEMBER",
      messages: 0
    };
  }

  data.users[id].username =
    username(ctx) || data.users[id].username;

  data.users[id].firstName =
    ctx.from?.first_name ||
    data.users[id].firstName;

  if (
    String(data.users[id].username).toLowerCase() ===
    OWNER_USERNAME.toLowerCase()
  ) {
    data.users[id].role = "DEV";
  }

  saveData();

  return data.users[id];
}

function roleOfUser(id) {
  const user = data.users[String(id)];

  if (!user) return ROLES.MEMBER;

  if (
    String(user.username || "").toLowerCase() ===
    OWNER_USERNAME.toLowerCase()
  ) {
    return ROLES.DEV;
  }

  return ROLES[user.role] || ROLES.MEMBER;
}

function roleOf(ctx) {
  const user = ensureUser(ctx);

  if (!user) return ROLES.MEMBER;

  if (isDev(ctx)) {
    return ROLES.DEV;
  }

  return ROLES[user.role] || ROLES.MEMBER;
}

function hasLevel(ctx, level) {
  return roleOf(ctx).level >= level;
}

function ensureChat(ctx) {
  const id = String(ctx.chat.id);

  if (!data.chats[id]) {
    data.chats[id] = {
      violations: true,
      protection: true,
      messages: [],
      editedMessages: [],
      muted: {},
      globalMuted: {},
      admins: {}
    };
  }

  const chat = data.chats[id];

  chat.messages ||= [];
  chat.editedMessages ||= [];
  chat.muted ||= {};
  chat.globalMuted ||= {};
  chat.admins ||= {};

  return chat;
}

/* =========================================================
   MARKDOWN / MENTIONS
========================================================= */

function escapeMarkdown(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

function mention(user) {
  if (!user) return "المستخدم";

  const name =
    user.first_name ||
    user.firstName ||
    user.username ||
    "المستخدم";

  return `[${escapeMarkdown(name)}](tg://user?id=${user.id})`;
}

function mentionCtx(ctx) {
  return mention({
    id: ctx.from.id,
    first_name: ctx.from.first_name,
    username: ctx.from.username
  });
}

/* =========================================================
   REPLY SYSTEM
========================================================= */

async function reply(ctx, text, extra = {}) {
  return ctx.reply(text, {
    reply_to_message_id: ctx.message?.message_id,
    ...extra
  });
}

/* =========================================================
   MESSAGE TRACKING
========================================================= */

function messageType(message) {
  if (message.photo) return "photo";
  if (message.video) return "video";
  if (message.animation) return "gif";
  if (message.sticker) return "sticker";
  if (message.voice) return "voice";
  if (message.audio) return "audio";
  if (message.video_note) return "video_note";
  if (message.document) return "document";
  if (message.text) return "text";
  return "other";
}

function trackMessage(ctx) {
  if (!isGroup(ctx) || !ctx.message) return;

  const chat = ensureChat(ctx);

  const m = ctx.message;

  chat.messages.push({
    id: m.message_id,
    userId: String(m.from?.id || ""),
    type: messageType(m),
    bot: Boolean(m.from?.is_bot),
    date: Date.now()
  });

  if (chat.messages.length > 5000) {
    chat.messages =
      chat.messages.slice(-5000);
  }

  const user = ensureUser(ctx);

  if (user && !m.from?.is_bot) {
    user.messages =
      Number(user.messages || 0) + 1;
  }

  saveData();
}

function trackEdited(ctx) {
  if (!isGroup(ctx) || !ctx.editedMessage) return;

  const chat = ensureChat(ctx);

  chat.editedMessages.push({
    id: ctx.editedMessage.message_id,
    userId: String(
      ctx.editedMessage.from?.id || ""
    ),
    date: Date.now()
  });

  if (chat.editedMessages.length > 3000) {
    chat.editedMessages =
      chat.editedMessages.slice(-3000);
  }

  saveData();
}

/* =========================================================
   TARGET
========================================================= */

function getArgs(ctx) {
  return String(ctx.message?.text || "")
    .trim()
    .split(/\s+/)
    .slice(1);
}

function getTargetFromReply(ctx) {
  return ctx.message?.reply_to_message?.from || null;
}

function findSavedUserByUsername(value) {
  const clean = String(value || "")
    .replace("@", "")
    .toLowerCase();

  return Object.values(data.users).find(
    user =>
      String(user.username || "").toLowerCase() ===
      clean
  );
}

function getTarget(ctx) {
  const replyUser =
    getTargetFromReply(ctx);

  if (replyUser) {
    return replyUser;
  }

  const args = getArgs(ctx);

  if (!args.length) return null;

  const saved =
    findSavedUserByUsername(args[0]);

  if (!saved) return null;

  return {
    id: Number(saved.id),
    username: saved.username,
    first_name: saved.firstName
  };
}

/* =========================================================
   HIERARCHY
========================================================= */

function canActOn(ctx, targetId) {
  if (isDev(ctx)) return true;

  return (
    roleOf(ctx).level >
    roleOfUser(targetId).level
  );
}

function ownerRequired(ctx) {
  if (!hasLevel(ctx, ROLES.OWNER.level)) {
    return false;
  }

  return true;
}

/* =========================================================
   BOT ADMIN
========================================================= */

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

/* =========================================================
   PROTECTION
   يعمل قبل الأوامر
========================================================= */

function hasLink(text) {
  return /(https?:\/\/|www\.|t\.me\/|telegram\.me\/)/i
    .test(text || "");
}

async function runProtection(ctx) {
  if (!isGroup(ctx)) return false;

  const chat = ensureChat(ctx);

  if (!chat.protection) return false;
  if (!chat.violations) return false;

  if (!ctx.message) return false;

  const user = ensureUser(ctx);

  if (!user) return false;

  if (roleOf(ctx).level >= ROLES.VIP.level) {
    return false;
  }

  const text =
    ctx.message.text ||
    ctx.message.caption ||
    "";

  if (hasLink(text)) {
    try {
      await ctx.telegram.deleteMessage(
        ctx.chat.id,
        ctx.message.message_id
      );
    } catch {}

    return true;
  }

  return false;
}

/* =========================================================
   GLOBAL MIDDLEWARE
========================================================= */

bot.use(async (ctx, next) => {
  try {
    if (ctx.message) {
      ensureUser(ctx);

      if (isGroup(ctx)) {
        const blocked =
          await runProtection(ctx);

        if (blocked) return;

        trackMessage(ctx);
      }
    }

    await next();
  } catch (err) {
    console.error("MIDDLEWARE:", err);
  }
});

bot.on("edited_message", async ctx => {
  try {
    trackEdited(ctx);

    if (!isGroup(ctx)) return;

    const chat = ensureChat(ctx);

    if (!chat.protection) return;
    if (!chat.violations) return;

    const text =
      ctx.editedMessage?.text ||
      ctx.editedMessage?.caption ||
      "";

    if (
      hasLink(text) &&
      roleOfUser(
        ctx.editedMessage?.from?.id
      ).level < ROLES.VIP.level
    ) {
      try {
        await ctx.telegram.deleteMessage(
          ctx.chat.id,
          ctx.editedMessage.message_id
        );
      } catch {}
    }
  } catch (err) {
    console.error("EDITED:", err);
  }
});

/* =========================================================
   START
========================================================= */

bot.start(async ctx => {
  ensureUser(ctx);

  if (ctx.chat.type !== "private") {
    return reply(
      ctx,
      "• استخدم /start في الخاص"
    );
  }

  const me =
    await ctx.telegram.getMe();

  const addUrl =
    `https://t.me/${me.username}?startgroup=true`;

  const developerUrl =
    `tg://user?id=${ctx.from.id}`;

  await ctx.reply(
    `أهلا بك يا قلبي ${mentionCtx(ctx)} 🤍

🎵 أقدر أشغل لك الأغاني بالمكالمة الصوتية.

المنصات:
• YouTube
• Spotify
• Resso
• Apple Music
• SoundCloud`,
    {
      parse_mode: "MarkdownV2",
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            "أضفني إلى مجموعتك",
            addUrl
          )
        ],
        [
          Markup.button.url(
            "المطور",
            developerUrl
          )
        ]
      ])
    }
  );
});

/* =========================================================
   رتبتي
========================================================= */

bot.hears(
  /^رتبتي$/i,
  async ctx => {
    const role = roleOf(ctx);

    await reply(
      ctx,
      `• رتبتك ↤︎ ${role.name}`
    );
  }
);

/* =========================================================
   تفاعلي
========================================================= */

bot.hears(
  /^تفاعلي$/i,
  async ctx => {
    const user = ensureUser(ctx);

    const list =
      Object.values(data.users)
        .filter(
          u =>
            Number(u.messages || 0) > 0
        )
        .sort(
          (a, b) =>
            Number(b.messages || 0) -
            Number(a.messages || 0)
        );

    const index =
      list.findIndex(
        u =>
          String(u.id) ===
          String(user.id)
      );

    const rank =
      index === -1
        ? 0
        : index + 1;

    await reply(
      ctx,
      `• رتبتك ↤︎ ${roleOf(ctx).name}
• عدد رسائل التفاعل ↤︎ ${user.messages || 0}
• ترتيبك بين المتفاعلين ↤︎ ${rank}`
    );
  }
);

/* =========================================================
   المتفاعلين
========================================================= */

bot.hears(
  /^المتفاعلين$/i,
  async ctx => {
    const list =
      Object.values(data.users)
        .filter(
          u =>
            Number(u.messages || 0) > 0
        )
        .sort(
          (a, b) =>
            Number(b.messages || 0) -
            Number(a.messages || 0)
        )
        .slice(0, 50);

    if (!list.length) {
      return reply(
        ctx,
        "• لا يوجد متفاعلين"
      );
    }

    const lines =
      list.map(
        (u, i) =>
          `${i + 1}\\. ${mention({
            id: u.id,
            first_name: u.firstName,
            username: u.username
          })} ↤︎ ${u.messages || 0}`
      );

    await reply(
      ctx,
      `• المتفاعلين:\n\n${lines.join("\n")}`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }
);

/* =========================================================
   فتح / غلق المخالفات
========================================================= */

bot.hears(
  /^فتح المخالفات$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (!hasLevel(ctx, ROLES.MYTH.level)) {
      return reply(
        ctx,
        "• ماتقدر تستخدم الامر على ↤ ｢ لازم تكون الرتبه Myth وفوق ｣"
      );
    }

    const chat = ensureChat(ctx);
    chat.violations = true;
    saveData();

    await reply(
      ctx,
      "• تم فتح المخالفات"
    );
  }
);

bot.hears(
  /^(غلق المخالفات|قفل المخالفات)$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (!hasLevel(ctx, ROLES.MYTH.level)) {
      return reply(
        ctx,
        "• ماتقدر تستخدم الامر على ↤ ｢ لازم تكون الرتبه Myth وفوق ｣"
      );
    }

    const chat = ensureChat(ctx);
    chat.violations = false;
    saveData();

    await reply(
      ctx,
      "• تم غلق المخالفات"
    );
  }
);

/* =========================================================
   MUTE
========================================================= */

async function doMute(ctx, target) {
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

    const chat = ensureChat(ctx);

    chat.muted[String(target.id)] = {
      id: String(target.id),
      username: target.username || "",
      firstName:
        target.first_name || "",
      date: Date.now()
    };

    saveData();

    return true;
  } catch {
    return false;
  }
}

async function doUnmute(ctx, target) {
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
          can_add_web_page_previews: true
        }
      }
    );

    const chat = ensureChat(ctx);

    delete chat.muted[
      String(target.id)
    ];

    saveData();

    return true;
  } catch {
    return false;
  }
}

bot.hears(
  /^(كتم|كتمه)$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (!ownerRequired(ctx)) {
      return reply(
        ctx,
        "• ماتقدر تستخدم الامر على ↤ ｢ لازم تكون الرتبه مالك وفوق ｣"
      );
    }

    const target = getTarget(ctx);

    if (!target) {
      return reply(
        ctx,
        "• قم بالرد على المستخدم أو منشن الحساب"
      );
    }

    if (!canActOn(ctx, target.id)) {
      return reply(
        ctx,
        "• لا يمكن كتم رتبه نفس رتبتك ولا اعلى من رتبتك"
      );
    }

    const ok =
      await doMute(ctx, target);

    if (!ok) {
      return reply(
        ctx,
        "• ماقدرت أكتم المستخدم"
      );
    }

    await reply(
      ctx,
      `• المستخدم ذا ↤︎「${mention(target)}」
• كتمته`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }
);

/* =========================================================
   فك الكتم
========================================================= */

bot.hears(
  /^(فك الكتم|الغاء الكتم)$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (!ownerRequired(ctx)) {
      return reply(
        ctx,
        "• ماتقدر تستخدم الامر على ↤ ｢ لازم تكون الرتبه مالك وفوق ｣"
      );
    }

    const target = getTarget(ctx);

    if (!target) {
      return reply(
        ctx,
        "• قم بالرد على المستخدم"
      );
    }

    if (!canActOn(ctx, target.id)) {
      return reply(
        ctx,
        "• لا يمكن تنزيل رتبه نفس رتبتك ولا اعلى من رتبتك"
      );
    }

    const ok =
      await doUnmute(ctx, target);

    if (!ok) {
      return reply(
        ctx,
        "• ماقدرت أفك كتم المستخدم"
      );
    }

    await reply(
      ctx,
      `• المستخدم ذا ↤︎「${mention(target)}」
• فكيت كتمه`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }
);

/* =========================================================
   BAN
========================================================= */

bot.hears(
  /^حظر$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (!ownerRequired(ctx)) {
      return reply(
        ctx,
        "• ماتقدر تستخدم الامر على ↤ ｢ لازم تكون الرتبه مالك وفوق ｣"
      );
    }

    const target = getTarget(ctx);

    if (!target) {
      return reply(
        ctx,
        "• قم بالرد على المستخدم"
      );
    }

    if (!canActOn(ctx, target.id)) {
      return reply(
        ctx,
        "• لا يمكن حظر رتبه نفس رتبتك ولا اعلى من رتبتك"
      );
    }

    try {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        target.id
      );

      await reply(
        ctx,
        `• المستخدم ذا ↤︎「${mention(target)}」
• حظرته`,
        {
          parse_mode: "MarkdownV2"
        }
      );
    } catch {
      await reply(
        ctx,
        "• ماقدرت أحظر المستخدم"
      );
    }
  }
);

/* =========================================================
   KICK
========================================================= */

bot.hears(
  /^طرد$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (!ownerRequired(ctx)) {
      return reply(
        ctx,
        "• ماتقدر تستخدم الامر على ↤ ｢ لازم تكون الرتبه مالك وفوق ｣"
      );
    }

    const target = getTarget(ctx);

    if (!target) {
      return reply(
        ctx,
        "• قم بالرد على المستخدم"
      );
    }

    if (!canActOn(ctx, target.id)) {
      return reply(
        ctx,
        "• لا يمكن طرد رتبه نفس رتبتك ولا اعلى من رتبتك"
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

      await reply(
        ctx,
        `• المستخدم ذا ↤︎「${mention(target)}」
• طردته`,
        {
          parse_mode: "MarkdownV2"
        }
      );
    } catch {
      await reply(
        ctx,
        "• ماقدرت أطرد المستخدم"
      );
    }
  }
);

/* =========================================================
   RESTRICT
========================================================= */

bot.hears(
  /^تقييد$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (!ownerRequired(ctx)) {
      return reply(
        ctx,
        "• ماتقدر تستخدم الامر على ↤ ｢ لازم تكون الرتبه مالك وفوق ｣"
      );
    }

    const target = getTarget(ctx);

    if (!target) {
      return reply(
        ctx,
        "• قم بالرد على المستخدم"
      );
    }

    if (!canActOn(ctx, target.id)) {
      return reply(
        ctx,
        "• لا يمكن تقييد رتبه نفس رتبتك ولا اعلى من رتبتك"
      );
    }

    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        target.id,
        {
          permissions: {
            can_send_messages: true,
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

      await reply(
        ctx,
        `• المستخدم ذا ↤︎「${mention(target)}」
• قيدته`,
        {
          parse_mode: "MarkdownV2"
        }
      );
    } catch {
      await reply(
        ctx,
        "• ماقدرت أقيد المستخدم"
      );
    }
  }
);

/* =========================================================
   UNRESTRICT
========================================================= */

bot.hears(
  /^(فك التقييد|الغاء التقييد)$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (!ownerRequired(ctx)) {
      return reply(
        ctx,
        "• ماتقدر تستخدم الامر على ↤ ｢ لازم تكون الرتبه مالك وفوق ｣"
      );
    }

    const target = getTarget(ctx);

    if (!target) {
      return reply(
        ctx,
        "• قم بالرد على المستخدم"
      );
    }

    if (!canActOn(ctx, target.id)) {
      return reply(
        ctx,
        "• لا يمكن فك تقييد رتبه نفس رتبتك ولا اعلى من رتبتك"
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
            can_add_web_page_previews: true
          }
        }
      );

      await reply(
        ctx,
        `• المستخدم ذا ↤︎「${mention(target)}」
• فكيت تقييده`,
        {
          parse_mode: "MarkdownV2"
        }
      );
    } catch {
      await reply(
        ctx,
        "• ماقدرت أفك تقييد المستخدم"
      );
    }
  }
);

/* =========================================================
   GLOBAL MUTE
========================================================= */

bot.hears(
  /^كتم عام$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (!ownerRequired(ctx)) {
      return reply(
        ctx,
        "• ماتقدر تستخدم الامر على ↤ ｢ لازم تكون الرتبه مالك وفوق ｣"
      );
    }

    const target = getTarget(ctx);

    if (!target) {
      return reply(
        ctx,
        "• قم بالرد على المستخدم"
      );
    }

    if (!canActOn(ctx, target.id)) {
      return reply(
        ctx,
        "• لا يمكن كتم عام رتبه نفس رتبتك ولا اعلى من رتبتك"
      );
    }

    const ok =
      await doMute(ctx, target);

    if (!ok) {
      return reply(
        ctx,
        "• ماقدرت أكتم المستخدم"
      );
    }

    const chat = ensureChat(ctx);

    chat.globalMuted[
      String(target.id)
    ] = {
      id: String(target.id),
      username: target.username || "",
      firstName:
        target.first_name || "",
      date: Date.now()
    };

    saveData();

    await reply(
      ctx,
      `• المستخدم ذا ↤︎「${mention(target)}」
• كتمته عام`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }
);

/* =========================================================
   MUTED LIST
========================================================= */

bot.hears(
  /^مم$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    const chat = ensureChat(ctx);
    const users =
      Object.values(chat.muted);

    if (!users.length) {
      return reply(
        ctx,
        "• لا يوجد مكتومين"
      );
    }

    const lines =
      users.map(
        (u, i) =>
          `${i + 1}\\. ${mention({
            id: u.id,
            first_name: u.firstName,
            username: u.username
          })}`
      );

    await reply(
      ctx,
      `• المكتومين:\n\n${lines.join("\n")}`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }
);

bot.hears(
  /^خخ$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    const chat = ensureChat(ctx);
    const users =
      Object.values(chat.globalMuted);

    if (!users.length) {
      return reply(
        ctx,
        "• لا يوجد مكتومين عام"
      );
    }

    const lines =
      users.map(
        (u, i) =>
          `${i + 1}\\. ${mention({
            id: u.id,
            first_name: u.firstName,
            username: u.username
          })}`
      );

    await reply(
      ctx,
      `• المكتومين عام:\n\n${lines.join("\n")}
