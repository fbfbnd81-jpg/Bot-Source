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
/* =========================================================
   الأوامر المخصصة
========================================================= */

const customPending = new Map();

bot.hears(/^اضف امر(?:\s+(.+))?$/i, async ctx => {
  if (!requireRank(ctx, 6)) return;

  const name = ctx.match[1]?.trim();
  if (!name) {
    return replyCommand(ctx, "• اكتب اسم الأمر بعد اضف امر");
  }

  customPending.set(ctx.from.id, {
    type: "command",
    chatId: ctx.chat.id,
    name
  });

  return replyCommand(ctx, "• أرسل الآن رد الأمر");
});

bot.hears(/^اضف رد(?:\s+(.+))?$/i, async ctx => {
  if (!requireRank(ctx, 6)) return;

  const word = ctx.match[1]?.trim();
  if (!word) {
    return replyCommand(ctx, "• اكتب الكلمة بعد اضف رد");
  }

  customPending.set(ctx.from.id, {
    type: "reply",
    chatId: ctx.chat.id,
    word
  });

  return replyCommand(ctx, "• أرسل الآن رد الكلمة");
});

bot.hears(/^حذف امر(?:\s+(.+))?$/i, async ctx => {
  if (!requireRank(ctx, 6)) return;

  const name = ctx.match[1]?.trim();
  if (!name) return replyCommand(ctx, "• اكتب اسم الأمر");

  const group = ensureGroup(ctx.chat.id);

  if (group.customCommands?.[name]) {
    delete group.customCommands[name];
    saveData();
    return replyCommand(ctx, "• تم حذف الأمر");
  }

  return replyCommand(ctx, "• الأمر غير موجود");
});

bot.hears(/^حذف رد(?:\s+(.+))?$/i, async ctx => {
  if (!requireRank(ctx, 6)) return;

  const word = ctx.match[1]?.trim();
  if (!word) return replyCommand(ctx, "• اكتب الكلمة");

  const group = ensureGroup(ctx.chat.id);

  if (group.customReplies?.[word]) {
    delete group.customReplies[word];
    saveData();
    return replyCommand(ctx, "• تم حذف الرد");
  }

  return replyCommand(ctx, "• الرد غير موجود");
});

bot.hears(/^اوامري$/i, async ctx => {
  if (!requireRank(ctx, 6)) return;

  const group = ensureGroup(ctx.chat.id);
  const commands = Object.keys(group.customCommands || {});

  if (!commands.length) {
    return replyCommand(ctx, "• لا يوجد أوامر مخصصة");
  }

  return replyCommand(
    ctx,
    "• الأوامر المخصصة\n\n" +
    commands.map(x => `• ${x}`).join("\n")
  );
});

bot.hears(/^ردودي$/i, async ctx => {
  if (!requireRank(ctx, 6)) return;

  const group = ensureGroup(ctx.chat.id);
  const replies = Object.keys(group.customReplies || {});

  if (!replies.length) {
    return replyCommand(ctx, "• لا يوجد ردود مخصصة");
  }

  return replyCommand(
    ctx,
    "• الردود المخصصة\n\n" +
    replies.map(x => `• ${x}`).join("\n")
  );
});


/* =========================================================
   استقبال الأوامر والردود المخصصة
========================================================= */

bot.on("text", async (ctx, next) => {
  const pending = customPending.get(ctx.from.id);

  if (
    pending &&
    pending.chatId === ctx.chat.id &&
    !ctx.message.text.match(/^اضف امر/i) &&
    !ctx.message.text.match(/^اضف رد/i)
  ) {
    if (pending.type === "command") {
      const group = ensureGroup(ctx.chat.id);

      if (!group.customCommands) {
        group.customCommands = {};
      }

      group.customCommands[pending.name] = ctx.message.text;

      customPending.delete(ctx.from.id);
      saveData();

      return replyCommand(ctx, "• تم حفظ الأمر المخصص");
    }

    if (pending.type === "reply") {
      const group = ensureGroup(ctx.chat.id);

      if (!group.customReplies) {
        group.customReplies = {};
      }

      group.customReplies[pending.word] = ctx.message.text;

      customPending.delete(ctx.from.id);
      saveData();

      return replyCommand(ctx, "• تم حفظ الرد المخصص");
    }
  }

  const group = ensureGroup(ctx.chat.id);
  const text = ctx.message.text.trim();

  if (group.customCommands?.[text]) {
    return replyCommand(ctx, group.customCommands[text]);
  }

  if (group.customReplies?.[text]) {
    return replyCommand(ctx, group.customReplies[text]);
  }

  return next();
});


/* =========================================================
   الكلمات الممنوعة
========================================================= */

bot.hears(/^منع الكلمه(?:\s+(.+))?$/i, async ctx => {
  if (!requireRank(ctx, 6)) return;

  const word = ctx.match[1]?.trim();

  if (!word) {
    return replyCommand(ctx, "• اكتب الكلمة بعد منع الكلمه");
  }

  const group = ensureGroup(ctx.chat.id);

  if (!group.forbiddenWords) {
    group.forbiddenWords = [];
  }

  if (!group.forbiddenWords.includes(word)) {
    group.forbiddenWords.push(word);
  }

  saveData();

  return replyCommand(ctx, "• تم منع الكلمه");
});

bot.hears(/^الغاء منع الكلمه(?:\s+(.+))?$/i, async ctx => {
  if (!requireRank(ctx, 6)) return;

  const word = ctx.match[1]?.trim();

  if (!word) {
    return replyCommand(ctx, "• اكتب الكلمة");
  }

  const group = ensureGroup(ctx.chat.id);

  group.forbiddenWords =
    (group.forbiddenWords || []).filter(x => x !== word);

  saveData();

  return replyCommand(ctx, "• تم الغاء منع الكلمه");
});

bot.hears(/^الكلمات الممنوعه$/i, async ctx => {
  if (!requireRank(ctx, 6)) return;

  const group = ensureGroup(ctx.chat.id);
  const words = group.forbiddenWords || [];

  if (!words.length) {
    return replyCommand(ctx, "• لا يوجد كلمات ممنوعه");
  }

  return replyCommand(
    ctx,
    "• الكلمات الممنوعه\n\n" +
    words.map(x => `• ${x}`).join("\n")
  );
});

bot.hears(/^مسح الكلمات الممنوعه$/i, async ctx => {
  if (!requireRank(ctx, 6)) return;

  const group = ensureGroup(ctx.chat.id);
  group.forbiddenWords = [];

  saveData();

  return replyCommand(ctx, "• تم مسح الكلمات الممنوعه");
});


/* =========================================================
   الألقاب
========================================================= */

bot.hears(/^ضع(?:\s+(.+))?$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  const target = await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(ctx, "• لازم ترد على المستخدم");
  }

  const title = ctx.match[1]?.trim();

  if (!title) {
    return replyCommand(ctx, "• اكتب اللقب");
  }

  const user = ensureUser(target.id);

  if (!user.titles) {
    user.titles = {};
  }

  user.titles[ctx.chat.id] = title;

  saveData();

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n• تم وضع اللقب`
  );
});

bot.hears(/^لقبي$/i, async ctx => {
  const user = ensureUser(ctx.from.id);
  const title = user.titles?.[ctx.chat.id];

  if (!title) {
    return replyCommand(ctx, "• ما عندك لقب");
  }

  return replyCommand(ctx, `• لقبك ↤︎ ${escapeHtml(title)}`);
});

bot.hears(/^لقبه$/i, async ctx => {
  const target = await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(ctx, "• لازم ترد على المستخدم");
  }

  const user = ensureUser(target.id);
  const title = user.titles?.[ctx.chat.id];

  if (!title) {
    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(target)}\n• ما عنده لقب`
    );
  }

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n• لقبه ↤︎ ${escapeHtml(title)}`
  );
});


/* =========================================================
   الفلوس والبنك
========================================================= */

function ensureBank(user) {
  if (!user.bank) {
    user.bank = {
      created: false,
      name: "",
      balance: 0
    };
  }

  return user.bank;
}

bot.hears(/^فلوسي$/i, async ctx => {
  const user = ensureUser(ctx.from.id);

  return replyCommand(
    ctx,
    `• فلوسك ↤︎ ${Number(user.money || 0)}`
  );
});

bot.hears(/^فلوسه$/i, async ctx => {
  const target = await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(ctx, "• لازم ترد على المستخدم");
  }

  const user = ensureUser(target.id);

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n• فلوسه ↤︎ ${Number(user.money || 0)}`
  );
});

bot.hears(/^انشاء حساب بنكي$/i, async ctx => {
  const user = ensureUser(ctx.from.id);
  const bank = ensureBank(user);

  if (bank.created) {
    return replyCommand(ctx, "• عندك حساب بنكي بالفعل");
  }

  bank.created = true;
  bank.name = "البنك";

  saveData();

  return replyCommand(ctx, "• تم إنشاء حسابك البنكي");
});

bot.hears(/^حسابي$/i, async ctx => {
  const user = ensureUser(ctx.from.id);
  const bank = ensureBank(user);

  if (!bank.created) {
    return replyCommand(ctx, "• ما عندك حساب بنكي\n• استخدم انشاء حساب بنكي");
  }

  return replyCommand(
    ctx,
    `• حسابك البنكي\n\n• البنك ↤︎ ${escapeHtml(bank.name)}\n• الرصيد ↤︎ ${Number(user.money || 0)}`
  );
});

bot.hears(/^اهداء(?:\s+(\d+))?$/i, async ctx => {
  const amount = Number(ctx.match[1] || 0);

  if (!amount || amount <= 0) {
    return replyCommand(ctx, "• اكتب المبلغ");
  }

  const target = await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(ctx, "• لازم ترد على المستخدم");
  }

  const sender = ensureUser(ctx.from.id);
  const receiver = ensureUser(target.id);

  if (Number(sender.money || 0) < amount) {
    return replyCommand(ctx, "• فلوسك ما تكفي");
  }

  sender.money -= amount;
  receiver.money = Number(receiver.money || 0) + amount;

  saveData();

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n• تم اهدائه ${amount}`
  );
});

bot.hears(/^حذف حسابي$/i, async ctx => {
  const user = ensureUser(ctx.from.id);

  user.bank = {
    created: false,
    name: "",
    balance: 0
  };

  saveData();

  return replyCommand(ctx, "• تم حذف حسابك البنكي");
});

bot.hears(/^المتجر$/i, async ctx => {
  return replyCommand(
    ctx,
    "• المتجر\n\n" +
    "• لا توجد منتجات حالياً"
  );
});


/* =========================================================
   الزواج
========================================================= */

function ensureMarriage(user) {
  if (!user.marriages) {
    user.marriages = {};
  }

  return user.marriages;
}

function getMarriageList(groupId) {
  const group = ensureGroup(groupId);

  if (!group.marriages) {
    group.marriages = {};
  }

  return group.marriages;
}

function getSpouseCount(groupId, userId) {
  const marriages = getMarriageList(groupId);

  return Object.values(marriages).filter(
    m => String(m.husbandId) === String(userId)
  ).length;
}

function isMarriedAsWife(groupId, userId) {
  const marriages = getMarriageList(groupId);

  return Object.values(marriages).some(
    m => String(m.wifeId) === String(userId)
  );
}

bot.hears(/^زواج(?:\s+(\d+))?$/i, async ctx => {
  const amount = Number(ctx.match[1] || 0);

  if (!amount || amount <= 0) {
    return replyCommand(ctx, "• اكتب المهر");
  }

  const target = await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(ctx, "• لازم ترد على المستخدم");
  }

  if (target.id === ctx.from.id) {
    return replyCommand(ctx, "• ما تقدر تتزوج نفسك");
  }

  const husband = ensureUser(ctx.from.id);
  const wife = ensureUser(target.id);

  if (isMarriedAsWife(ctx.chat.id, ctx.from.id)) {
    return replyCommand(ctx, "• أنت متزوج بالفعل");
  }

  if (isMarriedAsWife(ctx.chat.id, target.id)) {
    return replyCommand(ctx, "• المستخدم متزوج بالفعل");
  }

  if (getSpouseCount(ctx.chat.id, ctx.from.id) >= 4) {
    return replyCommand(ctx, "• وصلت الحد الأقصى للزواج");
  }

  if (Number(husband.money || 0) < amount) {
    return replyCommand(ctx, "• فلوسك ما تكفي للمهر");
  }

  husband.money -= amount;

  const marriages = getMarriageList(ctx.chat.id);
  const id = `${ctx.from.id}_${target.id}_${Date.now()}`;

  marriages[id] = {
    husbandId: ctx.from.id,
    wifeId: target.id,
    mahr: amount,
    time: Date.now(),
    husbandUsername: ctx.from.username || "",
    wifeUsername: target.username || ""
  };

  ensureMarriage(husband);
  ensureMarriage(wife);

  saveData();

  return replyCommand(
    ctx,
    `• تم الزواج بين ${mention(ctx.from)} و ${mention(target)}\n• المهر ↤︎ ${amount}`
  );
});

bot.hears(/^زواج الثانيه(?:\s+(\d+))?$/i, async ctx => {
  return marriageSlot(ctx, 2);
});

bot.hears(/^زواج الثالثه(?:\s+(\d+))?$/i, async ctx => {
  return marriageSlot(ctx, 3);
});

bot.hears(/^زواج الرابعه(?:\s+(\d+))?$/i, async ctx => {
  return marriageSlot(ctx, 4);
});

async function marriageSlot(ctx, slot) {
  const amount = Number(ctx.match[1] || 0);

  if (!amount || amount <= 0) {
    return replyCommand(ctx, "• اكتب المهر");
  }

  const target = await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(ctx, "• لازم ترد على المستخدم");
  }

  const count = getSpouseCount(ctx.chat.id, ctx.from.id);

  if (count < slot - 1) {
    return replyCommand(ctx, "• لازم تكمل الزواج بالترتيب");
  }

  if (count >= 4) {
    return replyCommand(ctx, "• وصلت الحد الأقصى للزواج");
  }

  if (isMarriedAsWife(ctx.chat.id, target.id)) {
    return replyCommand(ctx, "• المستخدم متزوج بالفعل");
  }

  const husband = ensureUser(ctx.from.id);

  if (Number(husband.money || 0) < amount) {
    return replyCommand(ctx, "• فلوسك ما تكفي للمهر");
  }

  husband.money -= amount;

  const marriages = getMarriageList(ctx.chat.id);
  const id = `${ctx.from.id}_${target.id}_${Date.now()}`;

  marriages[id] = {
    husbandId: ctx.from.id,
    wifeId: target.id,
    slot,
    mahr: amount,
    time: Date.now(),
    husbandUsername: ctx.from.username || "",
    wifeUsername: target.username || ""
  };

  saveData();

  return replyCommand(
    ctx,
    `• تم الزواج بين ${mention(ctx.from)} و ${mention(target)}\n• المهر ↤︎ ${amount}`
  );
}

bot.hears(/^زواجي$/i, async ctx => {
  const marriages = getMarriageList(ctx.chat.id);

  const mine = Object.values(marriages).filter(
    m =>
      String(m.husbandId) === String(ctx.from.id) ||
      String(m.wifeId) === String(ctx.from.id)
  );

  if (!mine.length) {
    return replyCommand(ctx, "• ما عندك زواج");
  }

  const lines = [];

  for (const m of mine) {
    const otherId =
      String(m.husbandId) === String(ctx.from.id)
        ? m.wifeId
        : m.husbandId;

    let other;

    try {
      other = await ctx.telegram.getChatMember(
        ctx.chat.id,
        Number(otherId)
      );
    } catch {
      other = null;
    }

    const name = other?.user
      ? mention(other.user)
      : `المستخدم ${otherId}`;

    lines.push(
      `• الزوج/الزوجة ↤︎ ${name}\n• المهر ↤︎ ${m.mahr}`
    );
  }

  return replyCommand(
    ctx,
    "• زواجك\n\n" + lines.join("\n\n")
  );
});

bot.hears(/^توب المتزوجين$/i, async ctx => {
  const marriages = getMarriageList(ctx.chat.id);

  const counts = {};

  for (const m of Object.values(marriages)) {
    counts[m.husbandId] =
      (counts[m.husbandId] || 0) + 1;
  }

  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  if (!top.length) {
    return replyCommand(ctx, "• لا يوجد متزوجين");
  }

  const lines = [];

  for (let i = 0; i < top.length; i++) {
    const [id, count] = top[i];

    let member;

    try {
      member = await ctx.telegram.getChatMember(
        ctx.chat.id,
        Number(id)
      );
    } catch {
      member = null;
    }

    const name = member?.user
      ? mention(member.user)
      : `المستخدم ${id}`;

    lines.push(
      `${i + 1}. ${name} ↤︎ ${count}`
    );
  }

  return replyCommand(
    ctx,
    "• توب المتزوجين\n\n" + lines.join("\n")
  );
});


/* =========================================================
   أوامر مختصرة Dev
========================================================= */

const shortDevCommands = {
  "ا": "معلومات العضو",
  "ت": "توب المتفاعلين",
  "ق": "قوانين القروب",
  "م": "معلومات القروب",
  "ن": "المنشن والتنبيهات",
  "ح": "حالة القروب",
  "د": "رابط الدعوة"
};

for (const [command, title] of Object.entries(shortDevCommands)) {
  bot.hears(new RegExp(`^${command}$`, "i"), async ctx => {
    if (!requireRank(ctx, 7)) return;

    if (command === "ت") {
      const group = ensureGroup(ctx.chat.id);

      const users = Object.entries(
        group.interactions || {}
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

      if (!users.length) {
        return replyCommand(ctx, "• لا يوجد متفاعلين");
      }

      return replyCommand(
        ctx,
        "• توب المتفاعلين\n\n" +
        users.map(
          ([id, count], i) =>
            `${i + 1}. ${mention({ id, first_name: "مستخدم" })} ↤︎ ${count}`
        ).join("\n")
      );
    }

    if (command === "ق") {
      const group = ensureGroup(ctx.chat.id);

      return replyCommand(
        ctx,
        group.rules ||
        "• لا توجد قوانين مضافة"
      );
    }

    if (command === "م") {
      return replyCommand(
        ctx,
        `• اسم القروب ↤︎ ${escapeHtml(ctx.chat.title || "")}\n• ايدي القروب ↤︎ ${ctx.chat.id}`
      );
    }

    if (command === "ح") {
      const group = ensureGroup(ctx.chat.id);

      return replyCommand(
        ctx,
        `• حالة المخالفات ↤︎ ${group.violationsEnabled ? "مفتوحة" : "مقفلة"}`
      );
    }

    if (command === "ن") {
      const group = ensureGroup(ctx.chat.id);

      return replyCommand(
        ctx,
        `• المنشن ↤︎ ${group.mentionEnabled ? "مفتوح" : "مقفل"}`
      );
    }

    if (command === "د") {
      try {
        const link = await ctx.telegram.exportChatInviteLink(
          ctx.chat.id
        );

        return replyCommand(
          ctx,
          `• رابط القروب\n${escapeHtml(link)}`
        );
      } catch {
        return replyCommand(ctx, "• ما قدرت أجيب رابط القروب");
      }
    }

    return replyCommand(ctx, `• ${title}`);
  });
}


/* =========================================================
   فتح وغلق المنشن
========================================================= */

bot.hears(/^فتح المنشن$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  const group = ensureGroup(ctx.chat.id);
  group.mentionEnabled = true;

  saveData();

  return replyCommand(ctx, "• تم فتح المنشن");
});

bot.hears(/^غلق المنشن$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  const group = ensureGroup(ctx.chat.id);
  group.mentionEnabled = false;

  saveData();

  return replyCommand(ctx, "• تم غلق المنشن");
});


/* =========================================================
   @all
========================================================= */

bot.hears(/^@all$/i, async ctx => {
  const group = ensureGroup(ctx.chat.id);

  if (group.mentionEnabled === false) {
    return replyCommand(ctx, "• المنشن مقفل");
  }

  const members = Object.values(group.seenMembers || {});

  if (!members.length) {
    return replyCommand(
      ctx,
      "• ما عندي أعضاء محفوظين للمنشن"
    );
  }

  const chunks = [];
  let current = "";

  for (const member of members) {
    if (!member?.id) continue;

    const line =
      mention(member) + " ";

    if (
      current.length + line.length > 3500
    ) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current += line;
    }
  }

  if (current) chunks.push(current);

  for (const chunk of chunks) {
    await ctx.reply(chunk, {
      parse_mode: "HTML",
      disable_web_page_preview: true
    });
  }
});


/* =========================================================
   تنظيف الوسائط
========================================================= */

bot.hears(/^تنظيف(?:\s+([0-9]))?$/i, async ctx => {
  if (!requireRank(ctx, 4)) return;

  const type = Number(
    ctx.match[1] ?? 9
  );

  const names = {
    0: "الرسائل",
    1: "الصور",
    2: "الفيديوهات",
    3: "الملفات",
    4: "الملصقات",
    5: "القيفات",
    6: "الصوتيات",
    7: "الفويسات",
    8: "الروابط",
    9: "الوسائط"
  };

  const group = ensureGroup(ctx.chat.id);
  const tracked = group.trackedMessages || [];

  let selected = [];

  for (const msg of tracked) {
    if (msg.chatId !== ctx.chat.id) continue;

    if (type === 9) {
      if (
        msg.photo ||
        msg.video ||
        msg.document ||
        msg.sticker ||
        msg.animation ||
        msg.audio ||
        msg.voice ||
        msg.text
      ) {
        selected.push(msg.messageId);
      }

      continue;
    }

    if (
      type === 0 &&
      msg.text &&
      !msg.text.startsWith("/")
    ) {
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
      /(https?:\/\/|t\.me\/|www\.)/i.test(msg.text)
    ) {
      selected.push(msg.messageId);
    }
  }

  selected = [...new Set(selected)].slice(-100);

  if (!selected.length) {
    return replyCommand(
      ctx,
      `• ${type === 9 ? "لا يوجد وسائط في القروب" : `لا يوجد ${names[type]} في القروب`}`
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
    tracked.filter(
      x => !selected.includes(x.messageId)
    );

  saveData();

  return replyCommand(
    ctx,
    `• بواسطة ${mention(ctx.from)}\n• مسحت ${deleted} من ${names[type]}`
  );
});


/* =========================================================
   حالة البوت
========================================================= */

bot.hears(/^حالة البوت$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  const groupsCount =
    Object.keys(data.groups || {}).length;

  const usersCount =
    Object.keys(data.users || {}).length;

  return replyCommand(
    ctx,
    `• حالة البوت\n\n• القروبات ↤︎ ${groupsCount}\n• المستخدمين ↤︎ ${usersCount}\n• الحالة ↤︎ يعمل`
  );
});


/* =========================================================
   منع تنفيذ أوامر خطرة
========================================================= */

bot.hears(/^تنفيذ(?:\s+(.+))?$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  return replyCommand(
    ctx,
    "• تنفيذ الأكواد المباشرة غير متاح"
  );
});
/* =========================================================
   القوائم والأوامر
========================================================= */

const menuButtons = Markup.inlineKeyboard([
  [
    Markup.button.callback("المطور", "menu_dev"),
    Markup.button.callback("الرتب", "menu_ranks")
  ],
  [
    Markup.button.callback("الحماية", "menu_protection"),
    Markup.button.callback("التفاعل والألعاب والفعاليات", "menu_games")
  ],
  [
    Markup.button.callback("الهمسات والأغاني", "menu_music"),
    Markup.button.callback("الأوامر المخصصة", "menu_custom")
  ],
  [
    Markup.button.callback("القروب", "menu_group")
  ]
]);

const menus = {
  main:
    "• أوامر البوت\n\n" +
    "• اختر القسم من الأزرار بالأسفل",

  dev:
    "• قسم المطور\n\n" +
    "• إعدادات البوت\n" +
    "• إدارة المطورين\n" +
    "• إدارة القروبات\n" +
    "• الإذاعة\n" +
    "• الإحصائيات",

  ranks:
    "• قسم الرتب\n\n" +
    "• رفع مميز\n" +
    "• رفع مالك\n" +
    "• رفع مالك أساسي\n" +
    "• رفع Myth\n" +
    "• رفع Myth 🎖️\n" +
    "• رفع Dev²🎖️\n" +
    "• رفع ديف\n" +
    "• تنزيل\n" +
    "• رفع مشرف\n" +
    "• تنزيل مشرف",

  protection:
    "• قسم الحماية\n\n" +
    "• فتح المخالفات\n" +
    "• غلق المخالفات\n" +
    "• كتم\n" +
    "• فك الكتم\n" +
    "• حظر\n" +
    "• فك الحظر\n" +
    "• طرد\n" +
    "• تقييد\n" +
    "• الغاء التقييد\n" +
    "• كتم عام\n" +
    "• فك الكتم العام\n" +
    "• تنظيف",

  games:
    "• قسم التفاعل والألعاب والفعاليات\n\n" +
    "• تفاعلي\n" +
    "• المتفاعلين\n" +
    "• احكام\n" +
    "• قفل الالعاب\n" +
    "• فتح الالعاب\n" +
    "• صور\n" +
    "• كلمة\n" +
    "• ترتيب\n" +
    "• خمن\n" +
    "• لغز\n" +
    "• صح أو خطأ",

  music:
    "• قسم الهمسات والأغاني\n\n" +
    "• اهمس\n" +
    "• همسه\n" +
    "• ه\n" +
    "• تشغيل\n" +
    "• تخطي\n" +
    "• توقف\n" +
    "• استئناف\n" +
    "• إلغاء",

  custom:
    "• قسم الأوامر المخصصة\n\n" +
    "• اضف امر\n" +
    "• حذف امر\n" +
    "• اضف رد\n" +
    "• حذف رد\n" +
    "• اوامري\n" +
    "• ردودي",

  group:
    "• قسم القروب\n\n" +
    "• رتبتي\n" +
    "• تفاعلي\n" +
    "• رتبته\n" +
    "• تفاعله\n" +
    "• @all\n" +
    "• فتح المنشن\n" +
    "• غلق المنشن\n" +
    "• الكلمات الممنوعه"
};

function backButton() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("رجوع", "menu_back")
    ]
  ]);
}

bot.hears(/^اوامر$/i, async ctx => {
  return ctx.reply(
    menus.main,
    {
      parse_mode: "HTML",
      ...menuButtons
    }
  );
});

bot.action("menu_back", async ctx => {
  await ctx.answerCbQuery();

  return ctx.editMessageText(
    menus.main,
    {
      parse_mode: "HTML",
      ...menuButtons
    }
  );
});

for (const key of [
  "dev",
  "ranks",
  "protection",
  "games",
  "music",
  "custom",
  "group"
]) {
  bot.action(`menu_${key}`, async ctx => {
    await ctx.answerCbQuery();

    return ctx.editMessageText(
      menus[key],
      {
        parse_mode: "HTML",
        ...backButton()
      }
    );
  });
}


/* =========================================================
   إدارة الإعدادات الأساسية
========================================================= */

bot.hears(/^فتح البنك$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  const group = ensureGroup(ctx.chat.id);
  group.bankEnabled = true;

  saveData();

  return replyCommand(ctx, "• تم فتح البنك");
});

bot.hears(/^غلق البنك$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  const group = ensureGroup(ctx.chat.id);
  group.bankEnabled = false;

  saveData();

  return replyCommand(ctx, "• تم غلق البنك");
});

bot.hears(/^فتح الردود$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  const group = ensureGroup(ctx.chat.id);
  group.repliesEnabled = true;

  saveData();

  return replyCommand(ctx, "• تم فتح الردود");
});

bot.hears(/^غلق الردود$/i, async ctx => {
  if (!requireRank(ctx, 7)) return;

  const group = ensureGroup(ctx.chat.id);
  group.repliesEnabled = false;

  saveData();

  return replyCommand(ctx, "• تم غلق الردود");
});


/* =========================================================
   قناة المستخدم
========================================================= */

const channelPending = new Map();

bot.hears(/^اضف قناة$/i, async ctx => {
  if (!requireRank(ctx, 6)) return;

  channelPending.set(ctx.from.id, {
    chatId: ctx.chat.id
  });

  return replyCommand(
    ctx,
    "• أرسل الآن رابط القناة"
  );
});

bot.hears(/^قناتي$/i, async ctx => {
  const user = ensureUser(ctx.from.id);

  if (!user.channel) {
    return replyCommand(ctx, "• ما عندك قناة مضافة");
  }

  return replyCommand(
    ctx,
    `• قناتك ↤︎ ${escapeHtml(user.channel)}`
  );
});

bot.hears(/^تعديل قناتي$/i, async ctx => {
  if (!requireRank(ctx, 6)) return;

  channelPending.set(ctx.from.id, {
    chatId: ctx.chat.id,
    edit: true
  });

  return replyCommand(
    ctx,
    "• أرسل الآن رابط القناة الجديد"
  );
});

bot.hears(/^حذف قناتي$/i, async ctx => {
  if (!requireRank(ctx, 6)) return;

  const user = ensureUser(ctx.from.id);

  if (!user.channel) {
    return replyCommand(ctx, "• ما عندك قناة مضافة");
  }

  delete user.channel;

  saveData();

  return replyCommand(ctx, "• تم حذف قناتك");
});

bot.on("text", async (ctx, next) => {
  const pending = channelPending.get(ctx.from.id);

  if (
    pending &&
    pending.chatId === ctx.chat.id &&
    /^https?:\/\//i.test(ctx.message.text.trim())
  ) {
    const user = ensureUser(ctx.from.id);

    user.channel = ctx.message.text.trim();

    channelPending.delete(ctx.from.id);

    saveData();

    return replyCommand(
      ctx,
      "• تم حفظ رابط القناة"
    );
  }

  return next();
});


/* =========================================================
   الإذاعة
========================================================= */

const broadcastPending = new Map();

bot.hears(/^إذاعة$/i, async ctx => {
  if (ctx.chat.type !== "private") {
    return replyCommand(
      ctx,
      "• استخدم الإذاعة في الخاص مع البوت"
    );
  }

  if (!hasRank(ctx, 7)) {
    return replyCommand(
      ctx,
      "• هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
    );
  }

  broadcastPending.set(ctx.from.id, true);

  return replyCommand(
    ctx,
    "• أرسل الآن رسالة الإذاعة"
  );
});

bot.on("message", async (ctx, next) => {
  if (ctx.chat.type !== "private") {
    return next();
  }

  if (!broadcastPending.get(ctx.from.id)) {
    return next();
  }

  if (!hasRank(ctx, 7)) {
    broadcastPending.delete(ctx.from.id);
    return next();
  }

  broadcastPending.delete(ctx.from.id);

  const subscribers = [
    ...new Set(
      data.subscribers || []
    )
  ];

  let success = 0;
  let failed = 0;

  for (const chatId of subscribers) {
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
   تشغيل البوت
========================================================= */

bot.catch(async (err, ctx) => {
  console.error(
    "BOT ERROR:",
    err
  );

  try {
    await ctx.reply(
      "• حدث خطأ أثناء تنفيذ الأمر"
    );
  } catch {}
});

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
