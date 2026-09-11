const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");

/* =========================================================
   إعدادات البوت
========================================================= */

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN غير موجود في Secrets");
}

const bot = new Telegraf(BOT_TOKEN);

const DEV_USERNAME = "j4xa7";
const DATA_FILE = path.join(__dirname, "data.json");

/* =========================================================
   الرتب
========================================================= */

const ROLES = {
  MEMBER: { name: "عضو", level: 0 },
  VIP: { name: "مميز", level: 1 },
  OWNER: { name: "مالك", level: 2 },
  MAIN_OWNER: { name: "مالك أساسي", level: 3 },
  MYTH: { name: "Myth", level: 4 },
  MYTH2: { name: "Myth 🎖️", level: 5 },
  DEV2: { name: "Dev²🎖️", level: 6 },
  DEV: { name: "Dev🎖️", level: 7 }
};

/* =========================================================
   البيانات
========================================================= */

let data = {
  users: {},
  chats: {},
  whispers: {},
  nextWhisperId: 1
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const saved = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      data = {
        ...data,
        ...saved,
        users: saved.users || {},
        chats: saved.chats || {},
        whispers: saved.whispers || {},
        nextWhisperId: saved.nextWhisperId || 1
      };
    }
  } catch (e) {
    console.error("خطأ قراءة البيانات:", e);
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("خطأ حفظ البيانات:", e);
  }
}

loadData();

/* =========================================================
   أدوات عامة
========================================================= */

function getUserId(ctx) {
  return String(ctx.from?.id || "");
}

function getUsername(ctx) {
  return ctx.from?.username || "";
}

function isDeveloper(ctx) {
  return getUsername(ctx).toLowerCase() === DEV_USERNAME.toLowerCase();
}

function ensureUser(ctx) {
  const id = getUserId(ctx);

  if (!id) return null;

  if (!data.users[id]) {
    data.users[id] = {
      id,
      username: ctx.from?.username || "",
      firstName: ctx.from?.first_name || "مستخدم",
      role: "MEMBER",
      messages: 0
    };
  }

  data.users[id].username = ctx.from?.username || data.users[id].username;
  data.users[id].firstName =
    ctx.from?.first_name || data.users[id].firstName;

  // j4xa7 دائمًا مطور
  if (
    String(data.users[id].username || "").toLowerCase() ===
    DEV_USERNAME.toLowerCase()
  ) {
    data.users[id].role = "DEV";
  }

  saveData();
  return data.users[id];
}

function getRole(ctx) {
  const user = ensureUser(ctx);

  if (!user) return ROLES.MEMBER;

  if (user.username?.toLowerCase() === DEV_USERNAME.toLowerCase()) {
    return ROLES.DEV;
  }

  return ROLES[user.role] || ROLES.MEMBER;
}

function getRoleByUserId(userId) {
  const user = data.users[String(userId)];

  if (!user) return ROLES.MEMBER;

  if (
    String(user.username || "").toLowerCase() ===
    DEV_USERNAME.toLowerCase()
  ) {
    return ROLES.DEV;
  }

  return ROLES[user.role] || ROLES.MEMBER;
}

function roleName(roleKey) {
  return ROLES[roleKey]?.name || "عضو";
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

function escapeMarkdown(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

function mentionFromCtx(ctx) {
  return `[${escapeMarkdown(
    ctx.from?.first_name || ctx.from?.username || "المستخدم"
  )}](tg://user?id=${ctx.from.id})`;
}

function isGroup(ctx) {
  return ["group", "supergroup"].includes(ctx.chat?.type);
}

async function safeDelete(ctx, messageId) {
  try {
    await ctx.telegram.deleteMessage(ctx.chat.id, messageId);
    return true;
  } catch {
    return false;
  }
}

async function isAdmin(ctx, userId = ctx.from?.id) {
  try {
    const member = await ctx.telegram.getChatMember(
      ctx.chat.id,
      userId
    );

    return ["administrator", "creator"].includes(member.status);
  } catch {
    return false;
  }
}

async function botCanDelete(ctx) {
  try {
    const me = await ctx.telegram.getMe();
    return await isAdmin(ctx, me.id);
  } catch {
    return false;
  }
}

/* =========================================================
   بيانات القروب
========================================================= */

function ensureChat(ctx) {
  const id = String(ctx.chat.id);

  if (!data.chats[id]) {
    data.chats[id] = {
      violations: true,
      messages: [],
      editedMessages: [],
      muted: {},
      globalMuted: {},
      settings: {
        protection: true
      }
    };
  }

  if (!data.chats[id].messages) {
    data.chats[id].messages = [];
  }

  if (!data.chats[id].editedMessages) {
    data.chats[id].editedMessages = [];
  }

  if (!data.chats[id].muted) {
    data.chats[id].muted = {};
  }

  if (!data.chats[id].globalMuted) {
    data.chats[id].globalMuted = {};
  }

  saveData();

  return data.chats[id];
}

function rememberMessage(ctx) {
  if (!isGroup(ctx) || !ctx.message) return;

  const chat = ensureChat(ctx);

  const m = ctx.message;

  chat.messages.push({
    id: m.message_id,
    userId: String(m.from?.id || ""),
    type: getMessageType(m),
    bot: Boolean(m.from?.is_bot),
    date: Date.now()
  });

  // نخلي آخر 3000 رسالة فقط
  if (chat.messages.length > 3000) {
    chat.messages.splice(0, chat.messages.length - 3000);
  }

  saveData();
}

function rememberEdited(ctx) {
  if (!isGroup(ctx) || !ctx.editedMessage) return;

  const chat = ensureChat(ctx);

  chat.editedMessages.push({
    id: ctx.editedMessage.message_id,
    userId: String(ctx.editedMessage.from?.id || ""),
    date: Date.now()
  });

  if (chat.editedMessages.length > 1000) {
    chat.editedMessages.splice(0, chat.editedMessages.length - 1000);
  }

  saveData();
}

function getMessageType(m) {
  if (m.photo) return "photo";
  if (m.video) return "video";
  if (m.animation) return "gif";
  if (m.sticker) return "sticker";
  if (m.voice) return "voice";
  if (m.audio) return "audio";
  if (m.document) return "document";
  if (m.video_note) return "video_note";
  if (m.text) return "text";
  return "other";
}

/* =========================================================
   التفاعل
========================================================= */

function addInteraction(ctx) {
  if (!isGroup(ctx) || !ctx.from) return;

  const user = ensureUser(ctx);

  if (!user) return;

  user.messages = Number(user.messages || 0) + 1;

  saveData();
}

function getInteractionUsers() {
  return Object.values(data.users)
    .filter(u => Number(u.messages || 0) > 0)
    .sort((a, b) => {
      return Number(b.messages || 0) - Number(a.messages || 0);
    });
}

/* =========================================================
   الصلاحيات
========================================================= */

function hasLevel(ctx, level) {
  return getRole(ctx).level >= level;
}

function hasUserLevel(userId, level) {
  return getRoleByUserId(userId).level >= level;
}

function permissionMessage(required) {
  return `• ماتقدر تستخدم الامر على ↤ ｢ لازم تكون الرتبه ${required} وفوق ｣`;
}

/* =========================================================
   استخراج المستخدم المستهدف
========================================================= */

async function getTarget(ctx, args = []) {
  if (ctx.message?.reply_to_message?.from) {
    return ctx.message.reply_to_message.from;
  }

  const text = args.join(" ").trim();

  if (!text) return null;

  const username = text.replace(/^@/, "").toLowerCase();

  if (username) {
    for (const user of Object.values(data.users)) {
      if (
        String(user.username || "").toLowerCase() === username
      ) {
        return {
          id: Number(user.id),
          username: user.username,
          first_name: user.firstName
        };
      }
    }
  }

  return null;
}

/* =========================================================
   حماية المستخدمين من أصحاب الرتب الأعلى
========================================================= */

function hierarchyAllows(ctx, targetId) {
  if (isDeveloper(ctx)) return true;

  const actorLevel = getRole(ctx).level;
  const targetLevel = getRoleByUserId(targetId).level;

  return actorLevel > targetLevel;
}

/* =========================================================
   نظام الكتم
========================================================= */

async function muteUser(ctx, target) {
  const chat = ensureChat(ctx);

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

    chat.muted[String(target.id)] = {
      id: String(target.id),
      username: target.username || "",
      firstName: target.first_name || "",
      date: Date.now()
    };

    saveData();

    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

async function unmuteUser(ctx, target) {
  const chat = ensureChat(ctx);

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

    delete chat.muted[String(target.id)];

    saveData();

    return true;
  } catch {
    return false;
  }
}

/* =========================================================
   الحماية
========================================================= */

function containsLink(text) {
  if (!text) return false;

  return /(https?:\/\/|www\.|t\.me\/|telegram\.me\/)/i.test(
    text
  );
}

async function protection(ctx) {
  if (!isGroup(ctx) || !ctx.message) return false;

  const chat = ensureChat(ctx);

  if (!chat.settings.protection) return false;

  if (!chat.violations) return false;

  const user = ensureUser(ctx);

  if (!user) return false;

  // أصحاب الرتب لا تطبق عليهم حماية المخالفات
  if (getRole(ctx).level >= ROLES.VIP.level) {
    return false;
  }

  const text = ctx.message.text || ctx.message.caption || "";

  if (containsLink(text)) {
    await safeDelete(ctx, ctx.message.message_id);
    return true;
  }

  return false;
}

/* =========================================================
   MIDDLEWARE
========================================================= */

bot.use(async (ctx, next) => {
  try {
    if (ctx.message) {
      ensureUser(ctx);

      if (isGroup(ctx)) {
        rememberMessage(ctx);
        addInteraction(ctx);

        // الحماية قبل الأوامر العادية
        const handled = await protection(ctx);

        if (handled) return;
      }
    }

    await next();
  } catch (e) {
    console.error("Middleware:", e);
  }
});

bot.on("edited_message", async ctx => {
  try {
    rememberEdited(ctx);

    if (!isGroup(ctx)) return;

    const chat = ensureChat(ctx);

    if (
      chat.settings.protection &&
      chat.violations &&
      ctx.editedMessage
    ) {
      const text =
        ctx.editedMessage.text ||
        ctx.editedMessage.caption ||
        "";

      if (containsLink(text)) {
        await safeDelete(
          ctx,
          ctx.editedMessage.message_id
        );
      }
    }
  } catch (e) {
    console.error("Edited message:", e);
  }
});

/* =========================================================
   /START
========================================================= */

bot.start(async ctx => {
  ensureUser(ctx);

  if (ctx.chat.type !== "private") {
    return ctx.reply("• استخدم /start في الخاص");
  }

  const me = await bot.telegram.getMe();

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.url(
        "أضفني إلى مجموعتك",
        `https://t.me/${me.username}?startgroup=true`
      )
    ],
    [
      Markup.button.url(
        "المطور",
        "tg://user?id=000000000"
      )
    ]
  ]);

  await ctx.reply(
    `أهلا بك يا قلبي ${mentionFromCtx(ctx)} 🤍

🎵 أقدر أشغل لك الأغاني داخل المكالمة الصوتية.

المنصات المدعومة:
• YouTube
• Spotify
• Resso
• Apple Music
• SoundCloud

أضفني إلى مجموعتك وابدأ الاستخدام 🤍`,
    {
      parse_mode: "MarkdownV2",
      ...keyboard
    }
  );
});

/* =========================================================
   الرتبة
========================================================= */

bot.hears(
  ["رتبتي", "رتبتي؟"],
  async ctx => {
    const role = getRole(ctx);
    const user = ensureUser(ctx);

    await ctx.reply(
      `• المستخدم ذا ↤︎「${mentionFromCtx(ctx)}」
• رتبتك ↤︎ ${role.name}
• عدد رسائل التفاعل ↤︎ ${user.messages || 0}`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }
);

/* =========================================================
   التفاعل
========================================================= */

bot.hears(
  ["تفاعلي", "تفاعل"],
  async ctx => {
    const user = ensureUser(ctx);
    const list = getInteractionUsers();

    const index = list.findIndex(
      u => String(u.id) === String(user.id)
    );

    const rank = index === -1 ? 0 : index + 1;

    await ctx.reply(
      `• المستخدم ذا ↤︎「${mentionFromCtx(ctx)}」
• رتبتك ↤︎ ${getRole(ctx).name}
• عدد رسائل التفاعل ↤︎ ${user.messages || 0}
• ترتيبك بين المتفاعلين ↤︎ ${rank || "غير موجود"}`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }
);

bot.hears(
  ["المتفاعلين", "المتفاعلين بالقائمة", "ترتيب المتفاعلين"],
  async ctx => {
    const list = getInteractionUsers();

    if (!list.length) {
      return ctx.reply("• لا يوجد متفاعلين");
    }

    const lines = list.slice(0, 50).map((user, i) => {
      return `${i + 1}\\. ${mentionUser(user)} ↤︎ ${
        user.messages || 0
      } رسالة`;
    });

    await ctx.reply(
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
  ["فتح المخالفات", "فتح مخالفات"],
  async ctx => {
    if (!isGroup(ctx)) return;

    if (!hasLevel(ctx, ROLES.MYTH.level)) {
      return ctx.reply(permissionMessage("Myth"));
    }

    const chat = ensureChat(ctx);
    chat.violations = true;

    saveData();

    await ctx.reply("• تم فتح المخالفات");
  }
);

bot.hears(
  ["غلق المخالفات", "قفل المخالفات", "اغلاق المخالفات"],
  async ctx => {
    if (!isGroup(ctx)) return;

    if (!hasLevel(ctx, ROLES.MYTH.level)) {
      return ctx.reply(permissionMessage("Myth"));
    }

    const chat = ensureChat(ctx);
    chat.violations = false;

    saveData();

    await ctx.reply("• تم غلق المخالفات");
  }
);

/* =========================================================
   كتم
========================================================= */

bot.hears(
  ["كتم", "كتمه"],
  async ctx => {
    if (!isGroup(ctx)) return;

    if (!hasLevel(ctx, ROLES.OWNER.level)) {
      return ctx.reply(permissionMessage("مالك"));
    }

    const args = ctx.message.text.split(/\s+/).slice(1);
    const target = await getTarget(ctx, args);

    if (!target) {
      return ctx.reply("• قم بالرد على المستخدم أو منشن الحساب");
    }

    if (!hierarchyAllows(ctx, target.id)) {
      return ctx.reply(
        "• لا يمكن كتم رتبه نفس رتبتك ولا اعلى من رتبتك"
      );
    }

    const ok = await muteUser(ctx, target);

    if (!ok) {
      return ctx.reply("• ماقدرت أكتم المستخدم");
    }

    await ctx.reply(
      `• المستخدم ذا ↤︎「${mentionUser(target)}」
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
  ["فك الكتم", "فككتم", "الغاء الكتم"],
  async ctx => {
    if (!isGroup(ctx)) return;

    if (!hasLevel(ctx, ROLES.OWNER.level)) {
      return ctx.reply(permissionMessage("مالك"));
    }

    const args = ctx.message.text.split(/\s+/).slice(1);
    const target = await getTarget(ctx, args);

    if (!target) {
      return ctx.reply("• قم بالرد على المستخدم");
    }

    if (!hierarchyAllows(ctx, target.id)) {
      return ctx.reply(
        "• لا يمكن تنزيل رتبه نفس رتبتك ولا اعلى من رتبتك"
      );
    }

    const ok = await unmuteUser(ctx, target);

    if (!ok) {
      return ctx.reply("• ماقدرت أفك كتم المستخدم");
    }

    await ctx.reply(
      `• المستخدم ذا ↤︎「${mentionUser(target)}」
• فكيت كتمه`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }
);

/* =========================================================
   الحظر
========================================================= */

bot.hears(
  ["حظر", "بلوك"],
  async ctx => {
    if (!isGroup(ctx)) return;

    if (!hasLevel(ctx, ROLES.OWNER.level)) {
      return ctx.reply(permissionMessage("مالك"));
    }

    const args = ctx.message.text.split(/\s+/).slice(1);
    const target = await getTarget(ctx, args);

    if (!target) {
      return ctx.reply("• قم بالرد على المستخدم أو منشن الحساب");
    }

    if (!hierarchyAllows(ctx, target.id)) {
      return ctx.reply(
        "• لا يمكن حظر رتبه نفس رتبتك ولا اعلى من رتبتك"
      );
    }

    try {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        target.id
      );

      await ctx.reply(
        `• المستخدم ذا ↤︎「${mentionUser(target)}」
• حظرته`,
        {
          parse_mode: "MarkdownV2"
        }
      );
    } catch {
      await ctx.reply("• ماقدرت أحظر المستخدم");
    }
  }
);

/* =========================================================
   الطرد
========================================================= */

bot.hears(
  ["طرد", "اطرد"],
  async ctx => {
    if (!isGroup(ctx)) return;

    if (!hasLevel(ctx, ROLES.OWNER.level)) {
      return ctx.reply(permissionMessage("مالك"));
    }

    const args = ctx.message.text.split(/\s+/).slice(1);
    const target = await getTarget(ctx, args);

    if (!target) {
      return ctx.reply("• قم بالرد على المستخدم أو منشن الحساب");
    }

    if (!hierarchyAllows(ctx, target.id)) {
      return ctx.reply(
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

      await ctx.reply(
        `• المستخدم ذا ↤︎「${mentionUser(target)}」
• طردته`,
        {
          parse_mode: "MarkdownV2"
        }
      );
    } catch {
      await ctx.reply("• ماقدرت أطرد المستخدم");
    }
  }
);

/* =========================================================
   الكتم العام
========================================================= */

bot.hears(
  ["كتم عام", "كتمه عام"],
  async ctx => {
    if (!isGroup(ctx)) return;

    if (!hasLevel(ctx, ROLES.OWNER.level)) {
      return ctx.reply(permissionMessage("مالك"));
    }

    const args = ctx.message.text.split(/\s+/).slice(2);
    const target = await getTarget(ctx, args);

    if (!target) {
      return ctx.reply("• قم بالرد على المستخدم أو منشن الحساب");
    }

    if (!hierarchyAllows(ctx, target.id)) {
      return ctx.reply(
        "• لا يمكن كتم عام رتبه نفس رتبتك ولا اعلى من رتبتك"
      );
    }

    const chat = ensureChat(ctx);

    chat.globalMuted[String(target.id)] = {
      id: String(target.id),
      username: target.username || "",
      firstName: target.first_name || "",
      date: Date.now()
    };

    await muteUser(ctx, target);

    saveData();

    await ctx.reply(
      `• المستخدم ذا ↤︎「${mentionUser(target)}」
• كتمته عام`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }
);

/* =========================================================
   المكتومين
========================================================= */

bot.hears("مم", async ctx => {
  if (!isGroup(ctx)) return;

  const chat = ensureChat(ctx);
  const users = Object.values(chat.muted);

  if (!users.length) {
    return ctx.reply("• لا يوجد مكتومين");
  }

  const lines = users.map((u, i) => {
    return `${i + 1}\\. ${mentionUser({
      id: u.id,
      first_name: u.firstName,
      username: u.username
    })}`;
  });

  await ctx.reply(
    `• المكتومين:\n\n${lines.join("\n")}`,
    {
      parse_mode: "MarkdownV2"
    }
  );
});

bot.hears("خخ", async ctx => {
  if (!isGroup(ctx)) return;

  const chat = ensureChat(ctx);
  const users = Object.values(chat.globalMuted);

  if (!users.length) {
    return ctx.reply("• لا يوجد مكتومين عام");
  }

  const lines = users.map((u, i) => {
    return `${i + 1}\\. ${mentionUser({
      id: u.id,
      first_name: u.firstName,
      username: u.username
    })}`;
  });

  await ctx.reply(
    `• المكتومين عام:\n\n${lines.join("\n")}`,
    {
      parse_mode: "MarkdownV2"
    }
  );
});

/* =========================================================
   الرتب
========================================================= */

const promotionMap = {
  "رفع مميز": "VIP",
  "رفع مالك": "OWNER",
  "رفع مالك أساسي": "MAIN_OWNER",
  "رفع مالك اساسي": "MAIN_OWNER",
  "رفع Myth": "MYTH",
  "رفع myth": "MYTH",
  "رفع Myth 🎖️": "MYTH2",
  "رفع Dev²": "DEV2",
  "رفع Dev²🎖️": "DEV2"
};

async function changeRank(ctx, newRole) {
  if (!isGroup(ctx)) return;

  const actor = getRole(ctx);

  if (actor.level < ROLES.MAIN_OWNER.level) {
    return ctx.reply(permissionMessage("مالك وفوق"));
  }

  const args = ctx.message.text.split(/\s+/).slice(2);
  const target = await getTarget(ctx, args);

  if (!target) {
    return ctx.reply("• قم بالرد على المستخدم أو منشن الحساب");
  }

  const targetRole = getRoleByUserId(target.id);

  if (targetRole.level >= actor.level) {
    return ctx.reply(
      "• لا يمكن رفع رتبه نفس رتبتك ولا اعلى من رتبتك"
    );
  }

  const desired = ROLES[newRole];

  if (!desired) {
    return ctx.reply("• الرتبه غير موجوده");
  }

  if (desired.level >= actor.level && !isDeveloper(ctx)) {
    return ctx.reply(
      "• لا يمكنك إعطاء رتبه مساوية أو أعلى من رتبتك"
    );
  }

  const id = String(target.id);

  if (!data.users[id]) {
    data.users[id] = {
      id,
      username: target.username || "",
      firstName: target.first_name || "مستخدم",
      role: "MEMBER",
      messages: 0
    };
  }

  data.users[id].role = newRole;
  data.users[id].username =
    target.username || data.users[id].username;
  data.users[id].firstName =
    target.first_name || data.users[id].firstName;

  saveData();

  await ctx.reply(
    `• المستخدم ذا ↤︎「${mentionUser(target)}」
• تم رفعه الرتبه ${desired.name}`,
    {
      parse_mode: "MarkdownV2"
    }
  );
}

async function lowerRank(ctx) {
  if (!isGroup(ctx)) return;

  const actor = getRole(ctx);

  if (actor.level < ROLES.MAIN_OWNER.level) {
    return ctx.reply(permissionMessage("مالك وفوق"));
  }

  const args = ctx.message.text.split(/\s+/).slice(1);
  const target = await getTarget(ctx, args);

  if (!target) {
    return ctx.reply("• قم بالرد على المستخدم أو منشن الحساب");
  }

  const targetRole = getRoleByUserId(target.id);

  if (targetRole.level >= actor.level) {
    return ctx.reply(
      "• لا يمكن تنزيل رتبه نفس رتبتك ولا اعلى من رتبتك"
    );
  }

  const id = String(target.id);

  if (!data.users[id]) return;

  const levels = Object.entries(ROLES)
    .sort((a, b) => b[1].level - a[1].level);

  const currentIndex = levels.findIndex(
    ([key]) => key === data.users[id].role
  );

  const next = levels[currentIndex + 1];

  data.users[id].role = next ? next[0] : "MEMBER";

  saveData();

  await ctx.reply(
    `• المستخدم ذا ↤︎「${mentionUser(target)}」
• تم تنزيله الرتبه`,
    {
      parse_mode: "MarkdownV2"
    }
  );
}

for (const [command, role] of Object.entries(promotionMap)) {
  bot.hears(command, ctx => changeRank(ctx, role));
}

bot.hears(
  ["تنزيل", "تنزيل رتبه", "خفض"],
  lowerRank
);

/* =========================================================
   التنظيف
========================================================= */

const CLEAN_TYPES = {
  "تنظيف صور": "photo",
  "تنظيف الصور": "photo",
  "تنظيف فويسات": "voice",
  "تنظيف الفويسات": "voice",
  "تنظيف صوتيات": "audio",
  "تنظيف الصوتيات": "audio",
  "تنظيف قيفات": "gif",
  "تنظيف القيفات": "gif",
  "تنظيف ملصقات": "sticker",
  "تنظيف الملصقات": "sticker",
  "تنظيف وسائط": "media",
  "تنظيف وسائط البوت": "botmedia",
  "تنظيف معدلة": "edited",
  "تنظيف الرسائل المعدلة": "edited"
};

async function cleanMessages(ctx, type) {
  if (!isGroup(ctx)) return;

  if (!hasLevel(ctx, ROLES.MYTH.level)) {
    return ctx.reply(permissionMessage("Myth"));
  }

  const chat = ensureChat(ctx);

  if (!(await botCanDelete(ctx))) {
    return ctx.reply(
      "• لازم أعطيني صلاحية حذف الرسائل عشان أقدر أنظف"
    );
  }

  if (type === "edited") {
    await ctx.reply(
      "• انتظر ابحث لك عن الرسائل المعدله"
    );

    let count = 0;

    for (const item of [...chat.editedMessages]) {
      if (
        await safeDelete(ctx, item.id)
      ) {
        count++;
      }
    }

    chat.editedMessages = [];
    saveData();

    if (!count) {
      return ctx.reply(
        `• حذفت ( 0 ) من الرسائل المعدلة`
      );
    }

    return ctx.reply(
      `• حذفت ( ${count} ) من الرسائل المعدلة`
    );
  }

  let messages = chat.messages.filter(
    m => m.type === type
  );

  if (type === "media") {
    messages = chat.messages.filter(m =>
      [
        "photo",
        "video",
        "gif",
        "sticker",
        "voice",
        "audio",
        "document",
        "video_note"
      ].includes(m.type)
    );
  }

  if (type === "botmedia") {
    messages = chat.messages.filter(
      m =>
        m.bot &&
        [
          "photo",
          "video",
          "gif",
          "sticker",
          "voice",
          "audio",
          "document",
          "video_note"
        ].includes(m.type)
    );
  }

  if (!messages.length) {
    const names = {
      photo: "صور",
      voice: "فويسات",
      audio: "صوتيات",
      gif: "قيفات",
      sticker: "ملصقات"
    };

    return ctx.reply(
      `• من ${mentionFromCtx(ctx)}
• لا يوجد ${names[type] || "رسائل"} في القروب`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }

  let count = 0;

  for (const message of messages) {
    if (await safeDelete(ctx, message.id)) {
      count++;
    }
  }

  chat.messages = chat.messages.filter(
    m => !messages.some(x => x.id === m.id)
  );

  saveData();

  if (type === "sticker") {
    return ctx.reply(
      `• بواسطة ${mentionFromCtx(ctx)}
• مسحت ( ${count} ) من الملصقات`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }

  if (type === "media") {
    return ctx.reply(
      `• مسحت ${count} من الوسائط`
    );
  }

  if (type === "botmedia") {
    return ctx.reply(
      `• مسحت ${count} من وسائط البوت`
    );
  }

  const names = {
    photo: "صور",
    voice: "فويسات",
    audio: "صوتيات",
    gif: "قيفات"
  };

  return ctx.reply(
    `• من ${mentionFromCtx(ctx)}
• مسحت ( ${count} ) من ${names[type]}`,
    {
      parse_mode: "MarkdownV2"
    }
  );
}

for (const [command, type] of Object.entries(CLEAN_TYPES)) {
  bot.hears(command, ctx => cleanMessages(ctx, type));
}

/* =========================================================
   تنظيف بالأرقام
   مثال:
   تنظيف 20
========================================================= */

bot.hears(/^تنظيف\s+(\d+)$/i, async ctx => {
  if (!isGroup(ctx)) return;

  if (!hasLevel(ctx, ROLES.MYTH.level)) {
    return ctx.reply(permissionMessage("Myth"));
  }

  if (!(await botCanDelete(ctx))) {
    return ctx.reply(
      "• لازم أعطيني صلاحية حذف الرسائل عشان أقدر أنظف"
    );
  }

  const count = Number(ctx.match[1]);

  if (count <= 0) {
    return ctx.reply("• اكتب عدد صحيح");
  }

  const chat = ensureChat(ctx);

  const messages = [...chat.messages]
    .sort((a, b) => b.id - a.id)
    .slice(0, Math.min(count, 100));

  let deleted = 0;

  for (const message of messages) {
    if (await safeDelete(ctx, message.id)) {
      deleted++;
    }
  }

  chat.messages = chat.messages.filter(
    m => !messages.some(x => x.id === m.id)
  );

  saveData();

  await ctx.reply(
    `• بواسطة ${mentionFromCtx(ctx)}
• مسحت ( ${deleted} ) من الرسائل`,
    {
      parse_mode: "MarkdownV2"
    }
  );
});

/* =========================================================
   مسح المكتومين
========================================================= */

bot.hears(
  ["مسح المكتومين", "مسح المكتومين عام"],
  async ctx => {
    if (!isGroup(ctx)) return;

    if (!hasLevel(ctx, ROLES.MAIN_OWNER.level)) {
      return ctx.reply(permissionMessage("مالك أساسي"));
    }

    const chat = ensureChat(ctx);

    if (ctx.message.text === "مسح المكتومين عام") {
      chat.globalMuted = {};
    } else {
      chat.muted = {};
    }

    saveData();

    await ctx.reply("• تم المسح");
  }
);

/* =========================================================
   همسات
========================================================= */

function whisperButton(id) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "رؤية الهمسه",
        `whisper_view_${id}`
      ),
      Markup.button.callback(
        "رد على الهمسه",
        `whisper_reply_${id}`
      )
    ]
  ]);
}

bot.command("همسه", async ctx => {
  if (!isGroup(ctx)) return;

  const text = ctx.message.text
    .replace(/^\/همسه\s*/i, "")
    .trim();

  if (!text && !ctx.message.reply_to_message) {
    return ctx.reply(
      "• اكتب الهمسه بعد الأمر أو قم بالرد على الرسالة"
    );
  }

  const id = String(data.nextWhisperId++);

  data.whispers[id] = {
    id,
    senderId: String(ctx.from.id),
    senderName: ctx.from.first_name || "مستخدم",
    text,
    chatId: String(ctx.chat.id),
    created: Date.now()
  };

  saveData();

  await ctx.reply(
    `• وصلت همسه من ${mentionFromCtx(ctx)}`,
    {
      parse_mode: "MarkdownV2",
      ...whisperButton(id)
    }
  );
});

bot.action(/^whisper_view_(.+)$/, async ctx => {
  const id = ctx.match[1];
  const whisper = data.whispers[id];

  if (!whisper) {
    return ctx.answerCbQuery("الهمسه غير موجوده", {
      show_alert: true
    });
  }

  await ctx.answerCbQuery();

  await ctx.reply(
    `• الهمسه:\n\n${whisper.text || "محتوى مرفق"}`
  );
});

bot.action(/^whisper_reply_(.+)$/, async ctx => {
  const id = ctx.match[1];
  const whisper = data.whispers[id];

  if (!whisper) {
    return ctx.answerCbQuery("الهمسه غير موجوده", {
      show_alert: true
    });
  }

  await ctx.answerCbQuery(
    "ارسل ردك برسالة تبدأ بـ: رد " + id
  );
});

/* =========================================================
   معلومات البوت
========================================================= */

bot.command("الاوامر", async ctx => {
  await ctx.reply(
`• أوامر البوت الأساسية:

• رتبتي
• تفاعلي
• المتفاعلين
• فتح المخالفات
• غلق المخالفات

• كتم
• فك الكتم
• حظر
• طرد
• كتم عام

• مم
• خخ

• تنظيف 10
• تنظيف الصور
• تنظيف الفويسات
• تنظيف الصوتيات
• تنظيف القيفات
• تنظيف الملصقات
• تنظيف وسائط
• تنظيف وسائط البوت
• تنظيف الرسائل المعدلة

• رفع مميز
• رفع مالك
• رفع مالك أساسي
• رفع Myth
• رفع Myth 🎖️
• رفع Dev²
• تنزيل`
  );
});

/* =========================================================
   تسجيل الأخطاء
========================================================= */

bot.catch((err, ctx) => {
  console.error(
    `خطأ للبوت في ${ctx?.chat?.id || "unknown"}:`,
    err
  );
});

/* =========================================================
   تشغيل البوت
========================================================= */

bot.launch()
  .then(() => {
    console.log("✅ البوت اشتغل بنجاح");
    console.log("✅ j4xa7 = Dev🎖️");
  })
  .catch(err => {
    console.error("❌ فشل تشغيل البوت:", err);
  });

process.once("SIGINT", () => {
  bot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
});
