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
  subscribers: [],
  whisperSessions: {},
  settings: {
    replies: true
  }
};

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(DEFAULT_DATA, null, 2),
        "utf8"
      );

      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }

    const file = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(file);

    return {
      users: parsed.users || {},
      groups: parsed.groups || {},
      subscribers: parsed.subscribers || [],
      whisperSessions: parsed.whisperSessions || {},
      settings: {
        ...DEFAULT_DATA.settings,
        ...(parsed.settings || {})
      }
    };
  } catch (error) {
    console.error("DATA LOAD ERROR:", error.message);

    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

let db = loadData();

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(db, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("DATA SAVE ERROR:", error.message);
  }
}

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

function getRoleLevel(role) {
  return ROLES[role] ?? 0;
}

function getRoleName(level) {
  for (const [name, value] of Object.entries(ROLES)) {
    if (value === level) {
      return name;
    }
  }

  return "عضو";
}

/* =========================================================
   المستخدم
========================================================= */

function ensureUser(id, from = {}) {
  const key = String(id);

  if (!db.users[key]) {
    db.users[key] = {
      id: id,
      username: from.username || "",
      first_name: from.first_name || "",
      role: "عضو",
      title: "",
      messages: 0,
      balance: 0,
      bank: null,
      channel: "",
      wives: [],
      warnings: 0
    };
  }

  const user = db.users[key];

  if (from.username) {
    user.username = from.username;
  }

  if (from.first_name) {
    user.first_name = from.first_name;
  }

  /*
    j4xa7 مطور أساسي دائمًا
  */

  if (
    user.username &&
    user.username.toLowerCase() === "j4xa7"
  ) {
    user.role = "Dev🎖️";
  }

  return user;
}

/* =========================================================
   القروب
========================================================= */

function ensureGroup(chatId) {
  const key = String(chatId);

  if (!db.groups[key]) {
    db.groups[key] = {
      roles: {},
      messages: {},
      trackedMessages: [],
      muted: {},
      globalMuted: {},
      warnings: {},
      violations: true,
      gamesLocked: false,
      mentionsEnabled: true,
      repliesEnabled: true,
      bankEnabled: true,

      customCommands: {},
      customReplies: {},

      forbiddenWords: [],

      titles: {},

      marriages: [],

      whispers: {},

      music: {
        queue: [],
        current: null,
        playing: false
      },

      settings: {}
    };
  }

  return db.groups[key];
}

/* =========================================================
   مستوى المستخدم
========================================================= */

function getUserLevel(user) {
  if (!user) {
    return 0;
  }

  if (
    user.username &&
    user.username.toLowerCase() === "j4xa7"
  ) {
    return 7;
  }

  return getRoleLevel(user.role);
}

function getGroupUser(ctx) {
  const user = ensureUser(
    ctx.from.id,
    ctx.from
  );

  if (ctx.chat && ctx.chat.type !== "private") {
    const group = ensureGroup(ctx.chat.id);

    const savedRole =
      group.roles[String(ctx.from.id)];

    if (
      savedRole &&
      getRoleLevel(savedRole) > getUserLevel(user)
    ) {
      user.role = savedRole;
    }
  }

  if (
    user.username &&
    user.username.toLowerCase() === "j4xa7"
  ) {
    user.role = "Dev🎖️";
  }

  return user;
}

/* =========================================================
   HTML
========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* =========================================================
   منشن
========================================================= */

function mention(user) {
  if (!user) {
    return "المستخدم";
  }

  const name =
    user.first_name ||
    user.username ||
    "المستخدم";

  return `<a href="tg://user?id=${user.id}">${escapeHtml(name)}</a>`;
}

/* =========================================================
   الرد على رسالة الأمر
========================================================= */

async function replyCommand(ctx, text) {
  try {
    if (ctx.message?.message_id) {
      return await ctx.reply(text, {
        parse_mode: "HTML",
        reply_parameters: {
          message_id: ctx.message.message_id
        }
      });
    }

    return await ctx.reply(text, {
      parse_mode: "HTML"
    });
  } catch (error) {
    console.error("REPLY ERROR:", error.message);
  }
}

/* =========================================================
   المستخدم المردود عليه
========================================================= */

function getRepliedUser(ctx) {
  return ctx.message?.reply_to_message?.from || null;
}

/* =========================================================
   صلاحيات الرتب
========================================================= */

function hasRank(ctx, requiredLevel) {
  const user = getGroupUser(ctx);

  return getUserLevel(user) >= requiredLevel;
}

async function requireRank(
  ctx,
  requiredLevel,
  requiredName
) {
  if (!hasRank(ctx, requiredLevel)) {
    await replyCommand(
      ctx,
      `• هذا الامر يخص ↤ ｢ ${escapeHtml(requiredName)} ｢`
    );

    return false;
  }

  return true;
}

/* =========================================================
   حماية الرتب
========================================================= */

function canActOnTarget(ctx, targetId) {
  const actor = getGroupUser(ctx);
  const target = ensureUser(targetId);

  return (
    getUserLevel(actor) >
    getUserLevel(target)
  );
}

/* =========================================================
   المشرف
========================================================= */

async function isBotAdmin(ctx) {
  if (!ctx.chat) {
    return false;
  }

  if (ctx.chat.type === "private") {
    return true;
  }

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

/* =========================================================
   تتبع الرسائل
========================================================= */

function getMessageType(message) {
  if (message.photo) {
    return "photo";
  }

  if (message.video) {
    return "video";
  }

  if (message.document) {
    return "document";
  }

  if (message.sticker) {
    return "sticker";
  }

  if (message.animation) {
    return "gif";
  }

  if (message.audio) {
    return "audio";
  }

  if (message.voice) {
    return "voice";
  }

  if (
    message.text &&
    /https?:\/\/|www\.|t\.me\//i.test(
      message.text
    )
  ) {
    return "link";
  }

  return "text";
}

function trackMessage(ctx) {
  if (
    !ctx.chat ||
    ctx.chat.type === "private" ||
    !ctx.message
  ) {
    return;
  }

  const group = ensureGroup(ctx.chat.id);

  group.trackedMessages.push({
    message_id: ctx.message.message_id,
    type: getMessageType(ctx.message),
    user_id: ctx.from?.id || 0,
    created_at: Date.now()
  });

  if (group.trackedMessages.length > 1000) {
    group.trackedMessages =
      group.trackedMessages.slice(-1000);
  }
}

/* =========================================================
   التفاعل
========================================================= */

function addInteraction(ctx) {
  if (
    !ctx.chat ||
    ctx.chat.type === "private" ||
    !ctx.from
  ) {
    return;
  }

  const user = ensureUser(
    ctx.from.id,
    ctx.from
  );

  const group = ensureGroup(ctx.chat.id);

  user.messages += 1;

  const id = String(ctx.from.id);

  group.messages[id] =
    (group.messages[id] || 0) + 1;

  trackMessage(ctx);
}

/* =========================================================
   الاشتراك الخاص
========================================================= */

function addSubscriber(id) {
  if (!db.subscribers.includes(id)) {
    db.subscribers.push(id);
    saveData();
  }
}

/* =========================================================
   حماية الأعضاء المكتومين عام
========================================================= */

async function handleGlobalMute(ctx) {
  if (
    !ctx.chat ||
    ctx.chat.type === "private" ||
    !ctx.from
  ) {
    return false;
  }

  const group = ensureGroup(ctx.chat.id);
  const user = getGroupUser(ctx);

  if (
    group.globalMuted[String(ctx.from.id)] &&
    getUserLevel(user) < 1
  ) {
    try {
      await ctx.deleteMessage();
    } catch {}

    return true;
  }

  return false;
}

/* =========================================================
   حماية المخالفات
========================================================= */

async function handleViolations(ctx) {
  if (
    !ctx.chat ||
    ctx.chat.type === "private" ||
    !ctx.message
  ) {
    return false;
  }

  const group = ensureGroup(ctx.chat.id);

  if (!group.violations) {
    return false;
  }

  const user = getGroupUser(ctx);

  if (getUserLevel(user) >= 4) {
    return false;
  }

  const text =
    ctx.message.text ||
    ctx.message.caption ||
    "";

  if (!text) {
    return false;
  }

  const hasLink =
    /https?:\/\/|www\.|t\.me\//i.test(text);

  const hasPhone =
    /(?:05|5)\d{8}/.test(text);

  const forbidden =
    group.forbiddenWords.some(word =>
      word &&
      text
        .toLowerCase()
        .includes(word.toLowerCase())
    );

  if (
    hasLink ||
    hasPhone ||
    forbidden
  ) {
    try {
      await ctx.deleteMessage();
    } catch {}

    return true;
  }

  return false;
}

/* =========================================================
   Middleware أساسي
========================================================= */

bot.use(async (ctx, next) => {
  if (ctx.from) {
    ensureUser(
      ctx.from.id,
      ctx.from
    );
  }

  if (
    ctx.chat &&
    ctx.chat.type !== "private"
  ) {
    ensureGroup(ctx.chat.id);
  }

  if (
    ctx.chat?.type === "private" &&
    ctx.from
  ) {
    addSubscriber(ctx.from.id);
  }

  await next();
});

/* =========================================================
   START
========================================================= */

bot.start(async ctx => {
  const user = ensureUser(
    ctx.from.id,
    ctx.from
  );

  addSubscriber(ctx.from.id);

  const me =
    await ctx.telegram.getMe();

  const botUsername =
    me.username;

  const addUrl =
    `https://t.me/${botUsername}?startgroup=true`;

  const text =
    `أهلا بك يا قلبي - ${mention(user)}\n\n` +
    `• انا اشغل لك اللي تبي بالمكالمه\n\n` +
    `ادعم هالمنصات كلها : ` +
    `يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.`;

  await ctx.reply(
    text,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            "أضفني في مجموعتك",
            addUrl
          )
        ],
        [
          Markup.button.url(
            "المطور",
            "tg://user?id=0"
          )
        ]
      ])
    }
  );
});

/* =========================================================
   TRACK + PROTECTION
========================================================= */

bot.on("message", async (ctx, next) => {
  if (
    ctx.chat?.type !== "private"
  ) {
    addInteraction(ctx);

    const stopped =
      await handleGlobalMute(ctx);

    if (stopped) {
      return;
    }

    const violation =
      await handleViolations(ctx);

    if (violation) {
      return;
    }
  }

  await next();
});

/* =========================================================
   رتبتي
========================================================= */

bot.hears(/^رتبتي$/i, async ctx => {
  const user =
    getGroupUser(ctx);

  return replyCommand(
    ctx,
    `• رتبتك ↤︎ ${escapeHtml(user.role)}`
  );
});

/* =========================================================
   تفاعلي
========================================================= */

bot.hears(/^تفاعلي$/i, async ctx => {
  const user =
    getGroupUser(ctx);

  const group =
    ensureGroup(ctx.chat.id);

  const rows =
    Object.entries(group.messages)
      .sort((a, b) => b[1] - a[1]);

  const position =
    rows.findIndex(
      ([id]) =>
        id === String(ctx.from.id)
    );

  return replyCommand(
    ctx,
    `• رتبتك ↤︎ ${escapeHtml(user.role)}\n` +
    `• عدد رسائل التفاعل ↤︎ ${user.messages}\n` +
    `• ترتيبك بين المتفاعلين ↤︎ ${position >= 0 ? position + 1 : "-"}`
  );
});

/* =========================================================
   المتفاعلين
========================================================= */

bot.hears(/^المتفاعلين$/i, async ctx => {
  const group =
    ensureGroup(ctx.chat.id);

  const rows =
    Object.entries(group.messages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

  if (!rows.length) {
    return replyCommand(
      ctx,
      "• لا يوجد متفاعلين"
    );
  }

  let text =
    "• المتفاعلين\n\n";

  for (let i = 0; i < rows.length; i++) {
    const user =
      ensureUser(
        Number(rows[i][0])
      );

    text +=
      `${i + 1} - ${mention(user)} ↤︎ ${rows[i][1]}\n`;
  }

  return replyCommand(
    ctx,
    text
  );
});

/* =========================================================
   رتبته
========================================================= */

bot.hears(/^رتبته$/i, async ctx => {
  const replied =
    getRepliedUser(ctx);

  if (!replied) {
    return replyCommand(
      ctx,
      "• رد على المستخدم"
    );
  }

  const user =
    ensureUser(
      replied.id,
      replied
    );

  return replyCommand(
    ctx,
    `• رتبته ↤︎ ${escapeHtml(user.role)}`
  );
});

/* =========================================================
   تفاعله
========================================================= */

bot.hears(/^تفاعله$/i, async ctx => {
  const replied =
    getRepliedUser(ctx);

  if (!replied) {
    return replyCommand(
      ctx,
      "• رد على المستخدم"
    );
  }

  const group =
    ensureGroup(ctx.chat.id);

  const count =
    group.messages[
      String(replied.id)
    ] || 0;

  const rows =
    Object.entries(group.messages)
      .sort((a, b) => b[1] - a[1]);

  const position =
    rows.findIndex(
      ([id]) =>
        id === String(replied.id)
    );

  const user =
    ensureUser(
      replied.id,
      replied
    );

  return replyCommand(
    ctx,
    `• رتبته ↤︎ ${escapeHtml(user.role)}\n` +
    `• عدد رسائل التفاعل ↤︎ ${count}\n` +
    `• ترتيبه بين المتفاعلين ↤︎ ${position >= 0 ? position + 1 : "-"}`
  );
});
/* =========================================================
   رفع الرتب
========================================================= */

const PROMOTION_COMMANDS = [
  {
    commands: ["رفع مميز"],
    role: "مميز",
    level: 1
  },
  {
    commands: ["رفع مالك"],
    role: "مالك",
    level: 2
  },
  {
    commands: ["رفع مالك أساسي", "رفع اساس"],
    role: "مالك أساسي",
    level: 3
  },
  {
    commands: ["رفع Myth", "رفع M"],
    role: "Myth",
    level: 4
  },
  {
    commands: ["رفع Myth 🎖️", "رفع My", "رفع اكس"],
    role: "Myth🎖️",
    level: 5
  },
  {
    commands: ["رفع Dev²", "رفع ديف", "رفع مطور ثانوي"],
    role: "Dev²🎖️",
    level: 6
  }
];

for (const item of PROMOTION_COMMANDS) {
  for (const command of item.commands) {
    bot.hears(
      new RegExp(
        `^${command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i"
      ),
      async ctx => {
        const replied =
          getRepliedUser(ctx);

        if (!replied) {
          return replyCommand(
            ctx,
            "• رد على المستخدم"
          );
        }

        const actorUser =
          getGroupUser(ctx);

        const target =
          ensureUser(
            replied.id,
            replied
          );

        if (
          getUserLevel(actorUser) <=
          getRoleLevel(item.role)
        ) {
          return replyCommand(
            ctx,
            `• ماتقدر تستخدم الامر على ↤ ｢ لازم تكون ${escapeHtml(
              getRoleName(item.level + 1)
            )} وفوق ｣`
          );
        }

        if (
          !canActOnTarget(
            ctx,
            target.id
          )
        ) {
          return replyCommand(
            ctx,
            "• لا يمكن رفع رتبه نفس رتبتك ولا اعلى من رتبتك"
          );
        }

        target.role =
          item.role;

        const group =
          ensureGroup(ctx.chat.id);

        group.roles[
          String(target.id)
        ] = item.role;

        saveData();

        return replyCommand(
          ctx,
          `• المستخدم ذا ↤︎「${mention(target)}」\n` +
          `• تم رفعه الرتبه`
        );
      }
    );
  }
}

/* =========================================================
   تنزيل الرتبة
========================================================= */

bot.hears(/^تنزيل$/i, async ctx => {
  const replied =
    getRepliedUser(ctx);

  if (!replied) {
    return replyCommand(
      ctx,
      "• رد على المستخدم"
    );
  }

  const actorUser =
    getGroupUser(ctx);

  const target =
    ensureUser(
      replied.id,
      replied
    );

  if (
    !canActOnTarget(
      ctx,
      target.id
    )
  ) {
    return replyCommand(
      ctx,
      "• لا يمكن تنزيل رتبه نفس رتبتك ولا اعلى من رتبتك"
    );
  }

  target.role =
    "عضو";

  const group =
    ensureGroup(ctx.chat.id);

  delete group.roles[
    String(target.id)
  ];

  saveData();

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎「${mention(target)}」\n` +
    `• تم تنزيل رتبته`
  );
});

/* =========================================================
   رفع مشرف
========================================================= */

bot.hears(
  /^(رفع مشرف|ترقيه)$/i,
  async ctx => {
    const replied =
      getRepliedUser(ctx);

    if (!replied) {
      return replyCommand(
        ctx,
        "• رد على المستخدم"
      );
    }

    if (
      !(await requireRank(
        ctx,
        2,
        "مالك وفوق"
      ))
    ) {
      return;
    }

    if (
      !(await isBotAdmin(ctx))
    ) {
      return replyCommand(
        ctx,
        "• البوت ليس مشرف"
      );
    }

    const target =
      ensureUser(
        replied.id,
        replied
      );

    if (
      !canActOnTarget(
        ctx,
        target.id
      )
    ) {
      return replyCommand(
        ctx,
        "• لا يمكن استخدام الامر على نفس رتبتك او اعلى"
      );
    }

    try {
      await ctx.telegram.promoteChatMember(
        ctx.chat.id,
        target.id,
        {
          can_manage_chat: true,
          can_delete_messages: true,
          can_manage_video_chats: true,
          can_restrict_members: true,
          can_promote_members: false,
          can_change_info: false,
          can_invite_users: true,
          can_pin_messages: true,
          can_manage_topics: true
        }
      );

      return replyCommand(
        ctx,
        `• المستخدم ذا ↤︎「${mention(target)}」\n` +
        `• تم رفعه مشرف`
      );
    } catch (error) {
      console.error(
        "PROMOTE ERROR:",
        error.message
      );

      return replyCommand(
        ctx,
        "• تعذر رفعه مشرف"
      );
    }
  }
);

/* =========================================================
   تنزيل مشرف
========================================================= */

bot.hears(
  /^تنزيل مشرف$/i,
  async ctx => {
    const replied =
      getRepliedUser(ctx);

    if (!replied) {
      return replyCommand(
        ctx,
        "• رد على المستخدم"
      );
    }

    if (
      !(await requireRank(
        ctx,
        2,
        "مالك وفوق"
      ))
    ) {
      return;
    }

    const target =
      ensureUser(
        replied.id,
        replied
      );

    try {
      await ctx.telegram.promoteChatMember(
        ctx.chat.id,
        target.id,
        {
          can_manage_chat: false,
          can_delete_messages: false,
          can_manage_video_chats: false,
          can_restrict_members: false,
          can_promote_members: false,
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false,
          can_manage_topics: false
        }
      );

      return replyCommand(
        ctx,
        `• المستخدم ذا ↤︎「${mention(target)}」\n` +
        `• تم تنزيله من المشرفين`
      );
    } catch (error) {
      console.error(
        "DEMOTE ERROR:",
        error.message
      );

      return replyCommand(
        ctx,
        "• تعذر تنزيل المشرف"
      );
    }
  }
);

/* =========================================================
   الكتم
========================================================= */

async function muteTarget(
  ctx,
  targetId
) {
  await ctx.telegram.restrictChatMember(
    ctx.chat.id,
    targetId,
    {
      permissions: {
        can_send_messages: false
      }
    }
  );
}

/* =========================================================
   فك الكتم
========================================================= */

async function unmuteTarget(
  ctx,
  targetId
) {
  await ctx.telegram.restrictChatMember(
    ctx.chat.id,
    targetId,
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
}

/* =========================================================
   أوامر العقوبات
========================================================= */

async function moderationAction(
  ctx,
  action
) {
  const replied =
    getRepliedUser(ctx);

  if (!replied) {
    return replyCommand(
      ctx,
      "• رد على المستخدم"
    );
  }

  if (
    !(await requireRank(
      ctx,
      2,
      "مالك وفوق"
    ))
  ) {
    return;
  }

  const target =
    ensureUser(
      replied.id,
      replied
    );

  if (
    !canActOnTarget(
      ctx,
      target.id
    )
  ) {
    return replyCommand(
      ctx,
      "• لا يمكن استخدام الامر على نفس رتبتك او اعلى"
    );
  }

  if (
    !(await isBotAdmin(ctx))
  ) {
    return replyCommand(
      ctx,
      "• البوت ليس مشرف"
    );
  }

  const group =
    ensureGroup(ctx.chat.id);

  try {
    if (action === "mute") {
      await muteTarget(
        ctx,
        target.id
      );

      group.muted[
        String(target.id)
      ] = true;
    }

    if (action === "unmute") {
      await unmuteTarget(
        ctx,
        target.id
      );

      delete group.muted[
        String(target.id)
      ];
    }

    if (action === "ban") {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        target.id
      );
    }

    if (action === "unban") {
      await ctx.telegram.unbanChatMember(
        ctx.chat.id,
        target.id,
        {
          only_if_banned: true
        }
      );
    }

    if (action === "kick") {
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
    }

    if (action === "restrict") {
      await muteTarget(
        ctx,
        target.id
      );

      group.muted[
        String(target.id)
      ] = true;
    }

    if (action === "unrestrict") {
      await unmuteTarget(
        ctx,
        target.id
      );

      delete group.muted[
        String(target.id)
      ];
    }

    saveData();

    const responses = {
      mute: "كتمته",
      unmute: "فكيت كتمه",
      ban: "حظرته",
      unban: "فكيت حظره",
      kick: "طردته",
      restrict: "قيدته",
      unrestrict: "الغيت تقييده"
    };

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎「${mention(target)}」\n` +
      `• ${responses[action]}`
    );
  } catch (error) {
    console.error(
      "MODERATION ERROR:",
      error.message
    );

    return replyCommand(
      ctx,
      "• تعذر تنفيذ الامر"
    );
  }
}

bot.hears(
  /^كتم$/i,
  ctx => moderationAction(ctx, "mute")
);

bot.hears(
  /^فك الكتم$/i,
  ctx => moderationAction(ctx, "unmute")
);

bot.hears(
  /^حظر$/i,
  ctx => moderationAction(ctx, "ban")
);

bot.hears(
  /^فك الحظر$/i,
  ctx => moderationAction(ctx, "unban")
);

bot.hears(
  /^طرد$/i,
  ctx => moderationAction(ctx, "kick")
);

bot.hears(
  /^تقييد$/i,
  ctx => moderationAction(ctx, "restrict")
);

bot.hears(
  /^الغاء التقييد$/i,
  ctx => moderationAction(ctx, "unrestrict")
);

/* =========================================================
   الكتم العام
========================================================= */

bot.hears(
  /^كتم عام$/i,
  async ctx => {
    const replied =
      getRepliedUser(ctx);

    if (!replied) {
      return replyCommand(
        ctx,
        "• رد على المستخدم"
      );
    }

    if (
      !(await requireRank(
        ctx,
        2,
        "مالك وفوق"
      ))
    ) {
      return;
    }

    const target =
      ensureUser(
        replied.id,
        replied
      );

    if (
      !canActOnTarget(
        ctx,
        target.id
      )
    ) {
      return replyCommand(
        ctx,
        "• لا يمكن استخدام الامر على نفس رتبتك او اعلى"
      );
    }

    const group =
      ensureGroup(ctx.chat.id);

    group.globalMuted[
      String(target.id)
    ] = true;

    saveData();

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎「${mention(target)}」\n` +
      `• كتمته عام`
    );
  }
);

/* =========================================================
   فك الكتم العام
========================================================= */

bot.hears(
  /^فك الكتم العام$/i,
  async ctx => {
    const replied =
      getRepliedUser(ctx);

    if (!replied) {
      return replyCommand(
        ctx,
        "• رد على المستخدم"
      );
    }

    if (
      !(await requireRank(
        ctx,
        2,
        "مالك وفوق"
      ))
    ) {
      return;
    }

    const target =
      ensureUser(
        replied.id,
        replied
      );

    const group =
      ensureGroup(ctx.chat.id);

    delete group.globalMuted[
      String(target.id)
    ];

    saveData();

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎「${mention(target)}」\n` +
      `• فكيت عنه الكتم العام`
    );
  }
);

/* =========================================================
   قائمة المكتومين
========================================================= */

bot.hears(/^مم$/i, async ctx => {
  const group =
    ensureGroup(ctx.chat.id);

  const ids =
    Object.keys(group.muted);

  if (!ids.length) {
    return replyCommand(
      ctx,
      "• لا يوجد مكتومين"
    );
  }

  let text =
    "• المكتومين\n\n";

  for (const id of ids) {
    const user =
      ensureUser(Number(id));

    text +=
      `• ${mention(user)}\n`;
  }

  return replyCommand(
    ctx,
    text
  );
});

/* =========================================================
   قائمة المكتومين عام
========================================================= */

bot.hears(/^خخ$/i, async ctx => {
  const group =
    ensureGroup(ctx.chat.id);

  const ids =
    Object.keys(
      group.globalMuted
    );

  if (!ids.length) {
    return replyCommand(
      ctx,
      "• لا يوجد مكتومين عام"
    );
  }

  let text =
    "• المكتومين عام\n\n";

  for (const id of ids) {
    const user =
      ensureUser(Number(id));

    text +=
      `• ${mention(user)}\n`;
  }

  return replyCommand(
    ctx,
    text
  );
});

/* =========================================================
   فتح وإغلاق المخالفات
========================================================= */

bot.hears(
  /^فتح المخالفات$/i,
  async ctx => {
    if (
      !(await requireRank(
        ctx,
        7,
        "Dev🎖️"
      ))
    ) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    group.violations = true;

    saveData();

    return replyCommand(
      ctx,
      "• تم فتح المخالفات"
    );
  }
);

bot.hears(
  /^(غلق|قفل) المخالفات$/i,
  async ctx => {
    if (
      !(await requireRank(
        ctx,
        7,
        "Dev🎖️"
      ))
    ) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    group.violations = false;

    saveData();

    return replyCommand(
      ctx,
      "• تم غلق المخالفات"
    );
  }
);

/* =========================================================
   حذف الرسائل
========================================================= */

async function deleteTrackedMessages(
  ctx,
  type
) {
  const group =
    ensureGroup(ctx.chat.id);

  let messages =
    group.trackedMessages;

  if (type) {
    messages =
      messages.filter(
        message =>
          message.type === type
      );
  }

  let deleted = 0;

  for (const message of messages) {
    try {
      await ctx.telegram.deleteMessage(
        ctx.chat.id,
        message.message_id
      );

      deleted++;
    } catch {}
  }

  group.trackedMessages =
    group.trackedMessages.filter(
      message =>
        !messages.includes(message)
    );

  saveData();

  return deleted;
}
