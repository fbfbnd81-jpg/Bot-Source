const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) throw new Error("BOT_TOKEN غير موجود");

const bot = new Telegraf(TOKEN);
const DB_FILE = "./database.json";

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

const DEV_IDS = (process.env.DEV_IDS || "")
  .split(",")
  .map(x => x.trim())
  .filter(Boolean);

const ADMIN_SESSION_TIME = 5 * 60 * 1000;
const adminSessions = new Map();
const pending = new Map();

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

      if (!db.chats) db.chats = {};
      if (!db.users) db.users = {};
      if (!db.globalSubscribers) db.globalSubscribers = [];
      if (!db.devIds) db.devIds = DEV_IDS;

      return db;
    }
  } catch (e) {
    console.error("DB:", e.message);
  }

  return {
    chats: {},
    users: {},
    globalSubscribers: [],
    devIds: DEV_IDS,
    whispers: {},
    marriages: {},
    banks: {}
  };
}

function saveDB(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
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
        bannedWords: []
      },
      customCommands: {},
      customReplies: {},
      channels: {},
      activeAhkam: null,
      games: {},
      stats: {}
    };
  }

  return db.chats[chatId];
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

  return db.users[userId];
}

function registerUser(db, chatId, user) {
  const chat = getChat(db, chatId);
  const id = String(user.id);

  if (!chat.users[id]) {
    chat.users[id] = {
      rank: "عضو",
      tag: "",
      messages: 0,
      points: 0,
      married: [],
      title: ""
    };
  }

  chat.users[id].username = user.username || "";
  chat.users[id].firstName = user.first_name || "";

  getGlobalUser(db, id);
}

function isDev(db, userId) {
  return (db.devIds || DEV_IDS).includes(String(userId));
}

function rankValue(rank) {
  return RANKS[rank] ?? 0;
}

function getRank(db, chatId, userId) {
  if (isDev(db, userId)) return "Dev🎖️";

  const chat = getChat(db, chatId);
  return chat.users[String(userId)]?.rank || "عضو";
}

function hasRank(db, chatId, userId, required) {
  return rankValue(getRank(db, chatId, userId)) >= rankValue(required);
}

function canTarget(db, chatId, actorId, targetId) {
  actorId = String(actorId);
  targetId = String(targetId);

  if (actorId === targetId) return false;

  const actorDev = isDev(db, actorId);
  const targetDev = isDev(db, targetId);

  if (targetDev) return false;

  return rankValue(getRank(db, chatId, actorId)) >
    rankValue(getRank(db, chatId, targetId));
}

function requireReply(ctx) {
  return !!ctx.message?.reply_to_message?.from;
}

function mention(user) {
  return `[${escapeMarkdown(user.first_name || "العضو")}](tg://user?id=${user.id})`;
}

function escapeMarkdown(text) {
  return String(text)
    .replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

async function getMember(ctx, userId) {
  return ctx.telegram.getChatMember(ctx.chat.id, userId);
}

/* =========================================================
   التسجيل والإحصائيات
========================================================= */

bot.on("message", async (ctx, next) => {
  if (!ctx.from) return next();

  const db = loadDB();

  if (ctx.chat.type !== "private") {
    registerUser(db, ctx.chat.id, ctx.from);

    const chat = getChat(db, ctx.chat.id);
    const user = chat.users[String(ctx.from.id)];

    user.messages = (user.messages || 0) + 1;
    user.points = (user.points || 0) + 1;

    saveDB(db);
  }

  if (ctx.chat.type === "private") {
    const id = String(ctx.from.id);

    getGlobalUser(db, id);

    if (!db.globalSubscribers.includes(id)) {
      db.globalSubscribers.push(id);
      saveDB(db);
    }
  }

  return next();
});

/* =========================================================
   صلاحيات Telegram
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
        `${label}: ${session.permissions[key] ? "نعم" : "لا"}`,
        `adm_toggle:${key}`
      )
    ]);
  }

  rows.push([
    Markup.button.callback("حفظ وتطبيق", "adm_save")
  ]);

  rows.push([
    Markup.button.callback("إخفاء الأمر", "adm_hide")
  ]);

  return Markup.inlineKeyboard(rows);
}

async function validateAdminSession(ctx) {
  const session = adminSessions.get(ctx.from.id);

  if (!session) {
    await ctx.answerCbQuery("لا توجد جلسة تعديل.", {
      show_alert: true
    });
    return null;
  }

  if (Date.now() - session.createdAt > ADMIN_SESSION_TIME) {
    adminSessions.delete(ctx.from.id);

    await ctx.answerCbQuery("انتهت جلسة تعديل الصلاحيات.", {
      show_alert: true
    });

    return null;
  }

  if (String(ctx.chat.id) !== String(session.chatId)) {
    await ctx.answerCbQuery("هذه الجلسة ليست لهذا القروب.", {
      show_alert: true
    });

    return null;
  }

  const db = loadDB();

  registerUser(db, session.chatId, ctx.from);
  registerUser(db, session.chatId, {
    id: session.targetId,
    first_name: "target"
  });

  const actorRank = getRank(
    db,
    session.chatId,
    session.actorId
  );

  const targetRank = getRank(
    db,
    session.chatId,
    session.targetId
  );

  if (!canTarget(
    db,
    session.chatId,
    session.actorId,
    session.targetId
  )) {
    await ctx.answerCbQuery(
      "لم تعد تملك صلاحية تعديل هذا العضو.",
      { show_alert: true }
    );

    adminSessions.delete(ctx.from.id);
    return null;
  }

  let actorMember;

  try {
    actorMember = await getMember(
      ctx,
      session.actorId
    );
  } catch {
    await ctx.answerCbQuery(
      "تعذر التحقق من صلاحياتك في Telegram.",
      { show_alert: true }
    );
    return null;
  }

  if (
    actorMember.status !== "creator" &&
    !(
      actorMember.status === "administrator" &&
      actorMember.can_promote_members === true
    )
  ) {
    await ctx.answerCbQuery(
      "لم تعد تملك صلاحية إضافة المشرفين.",
      { show_alert: true }
    );

    adminSessions.delete(ctx.from.id);
    return null;
  }

  return {
    db,
    session,
    actorRank,
    targetRank,
    actorMember
  };
}

/* =========================================================
   رفع مشرف / ترقيه
========================================================= */

async function openAdminPanel(ctx) {
  if (ctx.chat.type === "private") return;

  if (!requireReply(ctx)) {
    return ctx.reply("يجب استخدام الأمر بالرد على العضو.");
  }

  const actorId = String(ctx.from.id);
  const targetId = String(
    ctx.message.reply_to_message.from.id
  );

  if (actorId === targetId) {
    return ctx.reply("لا يمكنك استهداف نفسك.");
  }

  const db = loadDB();

  registerUser(db, ctx.chat.id, ctx.from);
  registerUser(
    db,
    ctx.chat.id,
    ctx.message.reply_to_message.from
  );

  let actorMember;
  let targetMember;

  try {
    actorMember = await getMember(ctx, actorId);
    targetMember = await getMember(ctx, targetId);
  } catch {
    return ctx.reply(
      "تعذر التحقق من العضو أو صلاحيات المشرف."
    );
  }

  if (
    actorMember.status !== "creator" &&
    !(
      actorMember.status === "administrator" &&
      actorMember.can_promote_members === true
    )
  ) {
    return ctx.reply(
      "لا تملك صلاحية Telegram لإضافة المشرفين."
    );
  }

  if (
    targetMember.status === "left" ||
    targetMember.status === "kicked"
  ) {
    return ctx.reply(
      "العضو غير موجود أو لم يعد عضوًا في القروب."
    );
  }

  if (!canTarget(db, ctx.chat.id, actorId, targetId)) {
    return ctx.reply(
      "لا يمكنك تعديل رتبة مساوية أو أعلى منك."
    );
  }

  const session = {
    actorId,
    targetId,
    chatId: String(ctx.chat.id),
    createdAt: Date.now(),
    permissions: defaultAdminRights()
  };

  adminSessions.set(ctx.from.id, session);

  await ctx.reply(
    "صلاحيات المستخدم",
    adminKeyboard(session)
  );
}

bot.hears(
  /^(رفع مشرف|ترقيه)$/,
  openAdminPanel
);

/* =========================================================
   أزرار صلاحيات المشرف
========================================================= */

bot.action(/^adm_toggle:(.+)$/, async ctx => {
  const check = await validateAdminSession(ctx);
  if (!check) return;

  const key = ctx.match[1];

  if (!Object.prototype.hasOwnProperty.call(
    check.session.permissions,
    key
  )) {
    return ctx.answerCbQuery(
      "هذه الصلاحية غير متاحة.",
      { show_alert: true }
    );
  }

  check.session.permissions[key] =
    !check.session.permissions[key];

  check.session.createdAt = Date.now();

  await ctx.editMessageReplyMarkup(
    adminKeyboard(check.session).reply_markup
  );

  await ctx.answerCbQuery();
});

bot.action("adm_save", async ctx => {
  const check = await validateAdminSession(ctx);
  if (!check) return;

  const {
    session
  } = check;

  let targetMember;

  try {
    targetMember = await getMember(
      ctx,
      session.targetId
    );
  } catch {
    return ctx.answerCbQuery(
      "العضو غير موجود.",
      { show_alert: true }
    );
  }

  if (
    targetMember.status === "left" ||
    targetMember.status === "kicked"
  ) {
    adminSessions.delete(ctx.from.id);

    return ctx.answerCbQuery(
      "العضو لم يعد موجودًا في القروب.",
      { show_alert: true }
    );
  }

  const rights = {
    ...session.permissions
  };

  /*
   * هذه الصلاحيات خاصة بالقنوات ولا نعطيها
   * لمشرف مجموعة/سوبرغروب.
   */
  delete rights.can_post_messages;
  delete rights.can_edit_messages;

  try {
    await ctx.telegram.promoteChatMember(
      session.chatId,
      session.targetId,
      rights
    );

    adminSessions.delete(ctx.from.id);

    await ctx.editMessageText(
      "تم حفظ وتطبيق الصلاحيات بنجاح."
    );

    await ctx.answerCbQuery(
      "تم التطبيق"
    );
  } catch (e) {
    console.error("promoteChatMember:", e);

    await ctx.answerCbQuery(
      "فشل التطبيق في Telegram.",
      { show_alert: true }
    );
  }
});

bot.action("adm_hide", async ctx => {
  const session = adminSessions.get(ctx.from.id);

  if (!session) {
    return ctx.answerCbQuery(
      "انتهت الجلسة.",
      { show_alert: true }
    );
  }

  if (
    String(session.chatId) !== String(ctx.chat.id)
  ) {
    return ctx.answerCbQuery(
      "غير مسموح.",
      { show_alert: true }
    );
  }

  adminSessions.delete(ctx.from.id);

  await ctx.deleteMessage().catch(() => {});
  await ctx.answerCbQuery();
});

/* =========================================================
   صلاحياتي
========================================================= */

async function formatTelegramRights(member) {
  if (member.status === "creator") {
    return [
      "• صلاحياتك بالإشراف :",
      "━━━━━━━━━━━",
      "• رتبتك ↤︎ مالك المجموعة",
      "• جميع صلاحيات الإدارة متاحة للمالك."
    ].join("\n");
  }

  const lines = [
    "• صلاحياتك بالإشراف :",
    "━━━━━━━━━━━"
  ];

  const rights = [
    ["can_change_info", "تغيير المعلومات"],
    ["can_pin_messages", "تثبيت الرسائل"],
    ["can_manage_topics", "ادارة المواضيع"],
    ["can_invite_users", "اضافه مستخدمين"],
    ["can_delete_messages", "مسح الرسائل"],
    ["can_restrict_members", "حظر / تقييد المستخدمين"],
    ["can_promote_members", "اضافه المشرفين"],
    ["can_manage_video_chats", "إدارة المكالمات"],
    ["can_manage_tags", "إدارة العلامات"]
  ];

  for (const [key, label] of rights) {
    lines.push(
      `• ${label} ↤︎ ${member[key] ? "نعم" : "لا"}`
    );
  }

  return lines.join("\n");
}

bot.hears(/^صلاحياتي$/, async ctx => {
  if (ctx.chat.type === "private") return;

  try {
    const member = await getMember(
      ctx,
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
});

/* =========================================================
   صلاحياته
========================================================= */

bot.hears(/^صلاحياته$/, async ctx => {
  if (ctx.chat.type === "private") return;

  if (!requireReply(ctx)) {
    return ctx.reply(
      "يجب الرد على العضو."
    );
  }

  const targetId =
    ctx.message.reply_to_message.from.id;

  try {
    const member = await getMember(
      ctx,
      targetId
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
});

/* =========================================================
   الحماية
========================================================= */

async function moderationCheck(
  ctx,
  targetId,
  requiredRank
) {
  const db = loadDB();
  const chatId = String(ctx.chat.id);
  const actorId = String(ctx.from.id);

  registerUser(db, chatId, ctx.from);

  if (!hasRank(
    db,
    chatId,
    actorId,
    requiredRank
  )) {
    return {
      ok: false,
      message:
        `• هذا الامر يخص ↤ ｢ ${requiredRank} ｣`
    };
  }

  registerUser(db, chatId, {
    id: targetId,
    first_name: "target"
  });

  if (!canTarget(
    db,
    chatId,
    actorId,
    targetId
  )) {
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

bot.hears(/^كتم$/, async ctx => {
  if (ctx.chat.type === "private") return;

  if (!requireReply(ctx)) {
    return ctx.reply("يجب الرد على العضو.");
  }

  const targetId =
    ctx.message.reply_to_message.from.id;

  const check = await moderationCheck(
    ctx,
    targetId,
    "Myth"
  );

  if (!check.ok) {
    return ctx.reply(check.message);
  }

  try {
    await ctx.telegram.restrictChatMember(
      ctx.chat.id,
      targetId,
      {
        permissions: {
          can_send_messages: false
        }
      }
    );

    return ctx.reply("تم كتم العضو.");
  } catch {
    return ctx.reply(
      "فشل الكتم، تأكد من صلاحيات البوت."
    );
  }
});

bot.hears(/^حظر$/, async ctx => {
  if (ctx.chat.type === "private") return;

  if (!requireReply(ctx)) {
    return ctx.reply("يجب الرد على العضو.");
  }

  const targetId =
    ctx.message.reply_to_message.from.id;

  const check = await moderationCheck(
    ctx,
    targetId,
    "Myth 🎖️"
  );

  if (!check.ok) {
    return ctx.reply(check.message);
  }

  try {
    await ctx.telegram.banChatMember(
      ctx.chat.id,
      targetId
    );

    return ctx.reply("تم حظر العضو.");
  } catch {
    return ctx.reply(
      "فشل الحظر، تأكد من صلاحيات البوت."
    );
  }
});

bot.hears(/^طرد$/, async ctx => {
  if (ctx.chat.type === "private") return;

  if (!requireReply(ctx)) {
    return ctx.reply("يجب الرد على العضو.");
  }

  const targetId =
    ctx.message.reply_to_message.from.id;

  const check = await moderationCheck(
    ctx,
    targetId,
    "Myth"
  );

  if (!check.ok) {
    return ctx.reply(check.message);
  }

  try {
    await ctx.telegram.banChatMember(
      ctx.chat.id,
      targetId
    );

    await ctx.telegram.unbanChatMember(
      ctx.chat.id,
      targetId
    );

    return ctx.reply("تم طرد العضو.");
  } catch {
    return ctx.reply(
      "فشل الطرد، تأكد من صلاحيات البوت."
    );
  }
});

bot.hears(/^فك الكتم$/, async ctx => {
  if (!requireReply(ctx)) {
    return ctx.reply("يجب الرد على العضو.");
  }

  const targetId =
    ctx.message.reply_to_message.from.id;

  const check = await moderationCheck(
    ctx,
    targetId,
    "Myth"
  );

  if (!check.ok) return ctx.reply(check.message);

  try {
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

    return ctx.reply("تم فك الكتم.");
  } catch {
    return ctx.reply("فشل فك الكتم.");
  }
});

/* =========================================================
   المنشن
========================================================= */

bot.hears(/^فتح المنشن$/, async ctx => {
  if (ctx.chat.type === "private") return;

  const db = loadDB();

  if (!isDev(db, ctx.from.id)) {
    return ctx.reply(
      "• هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
    );
  }

  const chat = getChat(db, ctx.chat.id);
  chat.settings.allMention = true;

  saveDB(db);

  return ctx.reply("تم فتح المنشن.");
});

bot.hears(/^غلق المنشن$/, async ctx => {
  if (ctx.chat.type === "private") return;

  const db = loadDB();

  if (!isDev(db, ctx.from.id)) {
    return ctx.reply(
      "• هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
    );
  }

  const chat = getChat(db, ctx.chat.id);
  chat.settings.allMention = false;

  saveDB(db);

  return ctx.reply("تم غلق المنشن.");
});

bot.hears(/^@all$/, async ctx => {
  if (ctx.chat.type === "private") return;

  const db = loadDB();
  const chat = getChat(db, ctx.chat.id);

  if (!chat.settings.allMention) return;

  const users = Object.entries(chat.users);

  if (!users.length) {
    return ctx.reply("لا يوجد أعضاء مسجلون.");
  }

  let current = "";

  for (const [id, user] of users) {
    const name = escapeMarkdown(
      user.firstName || "عضو"
    );

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
});

/* =========================================================
   الرتب
========================================================= */

bot.hears(/^رتبتي$/, async ctx => {
  if (ctx.chat.type === "private") return;

  const db = loadDB();
  const rank = getRank(
    db,
    ctx.chat.id,
    ctx.from.id
  );

  return ctx.reply(
    `• رتبتك ↤︎ ${rank}`
  );
});

bot.hears(/^رتبته$/, async ctx => {
  if (ctx.chat.type === "private") return;

  if (!requireReply(ctx)) {
    return ctx.reply("يجب الرد على العضو.");
  }

  const db = loadDB();

  const target =
    ctx.message.reply_to_message.from;

  return ctx.reply(
    `• رتبته ↤︎ ${getRank(
      db,
      ctx.chat.id,
      target.id
    )}`
  );
});

/* =========================================================
   الألقاب
========================================================= */

bot.hears(/^لقبي$/, async ctx => {
  if (ctx.chat.type === "private") return;

  const db = loadDB();
  const chat = getChat(db, ctx.chat.id);
  const user =
    chat.users[String(ctx.from.id)];

  return ctx.reply(
    `• لقبك ↤︎ ${user?.title || "لا يوجد لقب"}`
  );
});

bot.hears(/^لقبه$/, async ctx => {
  if (!requireReply(ctx)) {
    return ctx.reply("يجب الرد على العضو.");
  }

  const db = loadDB();
  const chat = getChat(db, ctx.chat.id);

  const target =
    ctx.message.reply_to_message.from;

  const user =
    chat.users[String(target.id)];

  return ctx.reply(
    `• لقبه ↤︎ ${user?.title || "لا يوجد لقب"}`
  );
});

bot.hears(/^ضع (.+)$/, async ctx => {
  if (!requireReply(ctx)) {
    return ctx.reply("يجب الرد على العضو.");
  }

  const db = loadDB();

  if (!isDev(db, ctx.from.id)) {
    return ctx.reply(
      "• هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
    );
  }

  const title = ctx.match[1].trim();
  const target =
    ctx.message.reply_to_message.from;

  const chat = getChat(db, ctx.chat.id);

  registerUser(db, ctx.chat.id, target);

  chat.users[String(target.id)].title = title;

  saveDB(db);

  return ctx.reply("تم وضع اللقب.");
});

/* =========================================================
   الكلمات الممنوعة
========================================================= */

bot.hears(/^منع الكلمه (.+)$/, async ctx => {
  const db = loadDB();

  if (!hasRank(
    db,
    ctx.chat.id,
    ctx.from.id,
    "Dev²🎖️"
  )) {
    return ctx.reply(
      "• هذا الامر يخص ↤ ｢ Dev²🎖️ ｣"
    );
  }

  const word = ctx.match[1].trim();
  const chat = getChat(db, ctx.chat.id);

  if (!chat.settings.bannedWords.includes(word)) {
    chat.settings.bannedWords.push(word);
  }

  saveDB(db);

  return ctx.reply("تم منع الكلمة.");
});

bot.hears(/^الغاء منع الكلمه (.+)$/, async ctx => {
  const db = loadDB();

  if (!hasRank(
    db,
    ctx.chat.id,
    ctx.from.id,
    "Dev²🎖️"
  )) {
    return ctx.reply(
      "• هذا الامر يخص ↤ ｢ Dev²🎖️ ｣"
    );
  }

  const word = ctx.match[1].trim();
  const chat = getChat(db, ctx.chat.id);

  chat.settings.bannedWords =
    chat.settings.bannedWords.filter(
      x => x !== word
    );

  saveDB(db);

  return ctx.reply("تم إلغاء منع الكلمة.");
});

bot.hears(/^الكلمات الممنوعه$/, async ctx => {
  const db = loadDB();

  if (!hasRank(
    db,
    ctx.chat.id,
    ctx.from.id,
    "Dev²🎖️"
  )) {
    return ctx.reply(
      "• هذا الامر يخص ↤ ｢ Dev²🎖️ ｣"
    );
  }

  const chat = getChat(db, ctx.chat.id);

  if (!chat.settings.bannedWords.length) {
    return ctx.reply("لا توجد كلمات ممنوعة.");
  }

  return ctx.reply(
    "• الكلمات الممنوعة :\n" +
    chat.settings.bannedWords.join("\n")
  );
});

bot.hears(/^مسح الكلمات الممنوعه$/, async ctx => {
  const db = loadDB();

  if (!hasRank(
    db,
    ctx.chat.id,
    ctx.from.id,
    "Dev²🎖️"
  )) {
    return ctx.reply(
      "• هذا الامر يخص ↤ ｢ Dev²🎖️ ｣"
    );
  }

  const chat = getChat(db, ctx.chat.id);
  chat.settings.bannedWords = [];

  saveDB(db);

  return ctx.reply(
    "تم مسح الكلمات الممنوعة."
  );
});

/* =========================================================
   فلوسي / البنك
========================================================= */

bot.hears(/^فلوسي$/, async ctx => {
  const db = loadDB();
  const user = getGlobalUser(
    db,
    ctx.from.id
  );

  saveDB(db);

  return ctx.reply(
    `• فلوسك ↤︎ ${user.balance} ريال`
  );
});

bot.hears(/^فلوسه$/, async ctx => {
  if (!requireReply(ctx)) {
    return ctx.reply("يجب الرد على العضو.");
  }

  const db = loadDB();

  const target =
    ctx.message.reply_to_message.from;

  const user =
    getGlobalUser(db, target.id);

  saveDB(db);

  return ctx.reply(
    `• فلوسه ↤︎ ${user.balance} ريال`
  );
});

bot.hears(/^اهداء (\d+)$/, async ctx => {
  if (!requireReply(ctx)) {
    return ctx.reply("يجب الرد على العضو.");
  }

  const amount = Number(ctx.match[1]);

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return ctx.reply("المبلغ غير صحيح.");
  }

  const target =
    ctx.message.reply_to_message.from;

  if (target.id === ctx.from.id) {
    return ctx.reply(
      "لا يمكنك إهداء نفسك."
    );
  }

  const db = loadDB();

  const sender =
    getGlobalUser(db, ctx.from.id);

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
    time: Date.now()
  });

  receiver.transfers.push({
    from: String(ctx.from.id),
    amount,
    time: Date.now()
  });

  saveDB(db);

  return ctx.reply(
    `تم تحويل ${amount} ريال.`
  );
});

bot.hears(/^انشاء حساب بنكي$/, async ctx => {
  const db = loadDB();
  const user =
    getGlobalUser(db, ctx.from.id);

  if (user.bankActive) {
    return ctx.reply(
      "لديك حساب بنكي بالفعل."
    );
  }

  pending.set(ctx.from.id, {
    type: "bank",
    step: "choose"
  });

  return ctx.reply(
    "اختر البنك:",
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "الراجحي",
          "bank:الراجحي"
        )
      ],
      [
        Markup.button.callback(
          "الأهلي",
          "bank:الأهلي"
        )
      ],
      [
        Markup.button.callback(
          "البنك الثالث",
          "bank:البنك الثالث"
        )
      ]
    ])
  );
});

bot.action(/^bank:(.+)$/, async ctx => {
  const p = pending.get(ctx.from.id);

  if (!p || p.type !== "bank") {
    return ctx.answerCbQuery(
      "انتهت العملية.",
      { show_alert: true }
    );
  }

  const bank = ctx.match[1];

  const db = loadDB();
  const user =
    getGlobalUser(db, ctx.from.id);

  if (user.bankActive) {
    pending.delete(ctx.from.id);

    return ctx.answerCbQuery(
      "لديك حساب بالفعل.",
      { show_alert: true }
    );
  }

  user.bank = bank;
  user.bankActive = true;

  if (!user.accountNumber) {
    user.accountNumber =
      String(
        Math.floor(
          10000000 +
          Math.random() * 89999999
        )
      );
  }

  pending.delete(ctx.from.id);
  saveDB(db);

  await ctx.editMessageText(
    `تم إنشاء حسابك البنكي.\nالبنك: ${bank}\nرقم الحساب: ${user.accountNumber}`
  );

  await ctx.answerCbQuery();
});

bot.hears(/^حسابي$/, async ctx => {
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
      "━━━━━━━━━━━",
      `• البنك ↤︎ ${user.bank}`,
      `• رقم الحساب ↤︎ ${user.accountNumber}`,
      `• الرصيد ↤︎ ${user.balance} ريال`
    ].join("\n")
  );
});

bot.hears(/^حذف حسابي$/, async ctx => {
  const db = loadDB();
  const user =
    getGlobalUser(db, ctx.from.id);

  if (!user.bankActive) {
    return ctx.reply(
      "ليس لديك حساب بنكي."
    );
  }

  user.bankActive = false;
  user.bank = null;
  user.accountNumber = null;

  saveDB(db);

  return ctx.reply(
    "تم حذف الحساب البنكي، ورصيدك محفوظ."
  );
});

/* =========================================================
   القنوات
========================================================= */

bot.hears(/^اضف قناة$/, async ctx => {
  const db = loadDB();

  if (!hasRank(
    db,
    ctx.chat.id,
    ctx.from.id,
    "Dev²🎖️"
  )) {
    return ctx.reply(
      "• هذا الامر يخص ↤ ｢ Dev²🎖️ ｣"
    );
  }

  pending.set(ctx.from.id, {
    type: "channel",
    chatId: String(ctx.chat.id)
  });

  return ctx.reply(
    "• أرسل رابط القناة الآن"
  );
});

bot.hears(/^تعديل قناتي$/, async ctx => {
  pending.set(ctx.from.id, {
    type: "channel_edit",
    chatId: String(ctx.chat.id)
  });

  return ctx.reply(
    "• أرسل رابط القناة الجديد"
  );
});

bot.hears(/^حذف قناتي$/, async ctx => {
  const db = loadDB();
  const chat = getChat(db, ctx.chat.id);

  delete chat.channels[String(ctx.from.id)];

  saveDB(db);

  return ctx.reply(
    "تم حذف قناتك."
  );
});

bot.hears(/^قناتي$/, async ctx => {
  const db = loadDB();
  const chat = getChat(db, ctx.chat.id);

  const channel =
    chat.channels[String(ctx.from.id)];

  if (!channel) {
    return ctx.reply(
      "لا توجد قناة محفوظة."
    );
  }

  return ctx.reply(
    `• قناتك ↤︎ ${channel}`
  );
});

/* =========================================================
   الأوامر المخصصة
========================================================= */

bot.hears(/^اضف امر$/, async ctx => {
  const db = loadDB();

  if (!hasRank(
    db,
    ctx.chat.id,
    ctx.from.id,
    "Dev²🎖️"
  )) {
    return ctx.reply(
      "• هذا الامر يخص ↤ ｢ Dev²🎖️ ｣"
    );
  }

  if (!requireReply(ctx)) {
    return ctx.reply(
      "يجب الرد على الرسالة التي تريد جعلها أمرًا."
    );
  }

  pending.set(ctx.from.id, {
    type: "customCommand",
    chatId: String(ctx.chat.id),
    sourceMessage:
      ctx.message.reply_to_message
  });

  return ctx.reply(
    "• أرسل الآن اسم الأمر"
  );
});

bot.hears(/^اضف رد$/, async ctx => {
  const db = loadDB();

  if (!hasRank(
    db,
    ctx.chat.id,
    ctx.from.id,
    "Dev²🎖️"
  )) {
    return ctx.reply(
      "• هذا الامر يخص ↤ ｢ Dev²🎖️ ｣"
    );
  }

  pending.set(ctx.from.id, {
    type: "customReply",
    chatId: String(ctx.chat.id)
  });

  return ctx.reply(
    "• أرسل الآن الكلمة التي تريد ربط الرد بها"
  );
});

bot.hears(/^حذف امر (.+)$/, async ctx => {
  const db = loadDB();

  if (!hasRank(
    db,
    ctx.chat.id,
    ctx.from.id,
    "Dev²🎖️"
  )) {
    return ctx.reply(
      "• هذا الامر يخص ↤ ｢ Dev²🎖️ ｣"
    );
  }

  const chat = getChat(db, ctx.chat.id);
  const name = ctx.match[1].trim();

  delete chat.customCommands[name];

  saveDB(db);

  return ctx.reply("تم حذف الأمر.");
});

bot.hears(/^حذف رد (.+)$/, async ctx => {
  const db = loadDB();

  if (!hasRank(
    db,
    ctx.chat.id,
    ctx.from.id,
    "Dev²🎖️"
  )) {
    return ctx.reply(
      "• هذا الامر يخص ↤ ｢ Dev²🎖️ ｣"
    );
  }

  const chat = getChat(db, ctx.chat.id);
  const word = ctx.match[1].trim();

  delete chat.customReplies[word];

  saveDB(db);

  return ctx.reply("تم حذف الرد.");
});

bot.hears(/^اوامري$/, async ctx => {
  const db = loadDB();
  const chat = getChat(db, ctx.chat.id);

  const items =
    Object.keys(chat.customCommands);

  if (!items.length) {
    return ctx.reply(
      "لا توجد أوامر مخصصة."
    );
  }

  return ctx.reply(
    "• أوامري :\n" + items.join("\n")
  );
});

bot.hears(/^ردودي$/, async ctx => {
  const db = loadDB();
  const chat = getChat(db, ctx.chat.id);

  const items =
    Object.keys(chat.customReplies);

  if (!items.length) {
    return ctx.reply(
      "لا توجد ردود مخصصة."
    );
  }

  return ctx.reply(
    "• ردودي :\n" + items.join("\n")
  );
});

/* =========================================================
   الهمسات
========================================================= */

function createWhisper(db, chatId, senderId, receiverId) {
  const id =
    `${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;

  if (!db.whispers) db.whispers = {};

  db.whispers[id] = {
    id,
    chatId: String(chatId),
    senderId: String(senderId),
    receiverId: String(receiverId),
    content: null,
    type: null,
    parentId: null,
    createdAt: Date.now(),
    viewed: false
  };

  return id;
}

bot.hears(/^(اهمس|همسه|ه)$/, async ctx => {
  if (ctx.chat.type === "private") return;

  if (!requireReply(ctx)) {
    return ctx.reply(
      "يجب الرد على العضو."
    );
  }

  const db = loadDB();

  const receiver =
    ctx.message.reply_to_message.from;

  if (receiver.id === ctx.from.id) {
    return ctx.reply(
      "لا يمكنك إرسال همسة لنفسك."
    );
  }

  const whisperId = createWhisper(
    db,
    ctx.chat.id,
    ctx.from.id,
    receiver.id
  );

  saveDB(db);

  const link =
    `https://t.me/${ctx.botInfo.username}?start=whisper_${whisperId}`;

  return ctx.reply(
    `• تم تحديد الهمسه لـ ${receiver.first_name}\n\n• أرسل الهمسة من الخاص:\n${link}`
  );
});

bot.start(async ctx => {
  const payload =
    ctx.startPayload;

  if (!payload?.startsWith("whisper_")) {
    return ctx.reply(
      "مرحباً بك في البوت."
    );
  }

  const whisperId =
    payload.slice("whisper_".length);

  const db = loadDB();
  const whisper =
    db.whispers?.[whisperId];

  if (!whisper) {
    return ctx.reply(
      "هذه الهمسة غير موجودة أو انتهت."
    );
  }

  const userId =
    String(ctx.from.id);

  if (
    userId !== whisper.senderId &&
    userId !== whisper.receiverId
  ) {
    return ctx.reply(
      "هذه الهمسة ليست مخصصة لك."
    );
  }

  if (userId === whisper.receiverId) {
    if (!whisper.content) {
      return ctx.reply(
        "لم يتم إرسال الهمسة بعد."
      );
    }

    whisper.viewed = true;
    saveDB(db);

    if (whisper.type === "text") {
      await ctx.reply(
        `• الهمسة:\n${whisper.content}`
      );
    } else if (whisper.type === "photo") {
      await ctx.replyWithPhoto(
        whisper.content,
        {
          caption: whisper.caption || ""
        }
      );
    } else if (whisper.type === "sticker") {
      await ctx.replyWithSticker(
        whisper.content
      );
    } else if (whisper.type === "animation") {
      await ctx.replyWithAnimation(
        whisper.content,
        {
          caption: whisper.caption || ""
        }
      );
    }

    return ctx.reply(
      "• تمت مشاهدة الهمسة."
    );
  }

  pending.set(ctx.from.id, {
    type: "whisper",
    whisperId
  });

  return ctx.reply(
    "• أرسل الآن الهمسة\n• يمكنك إرسال نص أو ملصق أو صورة أو قيف"
  );
});

/* =========================================================
   الإذاعة
========================================================= */

bot.hears(/^إذاعة$/, async ctx => {
  if (ctx.chat.type !== "private") return;

  const db = loadDB();

  if (!isDev(db, ctx.from.id)) {
    return ctx.reply(
      "• هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
    );
  }

  pending.set(ctx.from.id, {
    type: "broadcast"
  });

  return ctx.reply(
    "• أرسل الآن محتوى الإذاعة."
  );
});

/* =========================================================
   الأحكام
========================================================= */

bot.hears(/^احكام$/, async ctx => {
  if (ctx.chat.type === "private") return;

  const db = loadDB();

  if (!hasRank(
    db,
    ctx.chat.id,
    ctx.from.id,
    "Dev🎖️"
  )) {
    return ctx.reply(
      "• هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
    );
  }

  const chat = getChat(db, ctx.chat.id);

  if (chat.settings.gamesClosed) {
    return ctx.reply(
      "الألعاب مقفلة."
    );
  }

  chat.activeAhkam = {
    active: true,
    starterId: String(ctx.from.id),
    participants: []
  };

  saveDB(db);

  return ctx.reply(
    [
      "• بدأت لعبة الأحكام",
      "• اللي يبي يشارك يكتب أنا"
    ].join("\n")
  );
});

bot.hears(/^انهاء احكام$/, async ctx => {
  const db = loadDB();
  const chat = getChat(db, ctx.chat.id);

  if (!chat.activeAhkam) {
    return ctx.reply(
      "لا توجد لعبة أحكام."
    );
  }

  if (
    String(chat.activeAhkam.starterId) !==
    String(ctx.from.id)
  ) {
    return ctx.reply(
      "فقط من بدأ الأحكام يستطيع إنهاءها."
    );
  }

  chat.activeAhkam = null;
  saveDB(db);

  return ctx.reply(
    "تم إنهاء الأحكام."
  );
});

/* =========================================================
   قفل الألعاب
========================================================= */

bot.hears(/^قفل الالعاب$/, async ctx => {
  const db = loadDB();

  if (!hasRank(
    db,
    ctx.chat.id,
    ctx.from.id,
    "Dev🎖️"
  )) {
    return ctx.reply(
      "• هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
    );
  }

  const chat = getChat(db, ctx.chat.id);

  chat.settings.gamesClosed = true;
  chat.activeAhkam = null;
  chat.games = {};

  saveDB(db);

  return ctx.reply(
    "تم قفل الألعاب."
  );
});

bot.hears(/^فتح الالعاب$/, async ctx => {
  const db = loadDB();

  if (!hasRank(
    db,
    ctx.chat.id,
    ctx.from.id,
    "Dev🎖️"
  )) {
    return ctx.reply(
      "• هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
    );
  }

  const chat = getChat(db, ctx.chat.id);

  chat.settings.gamesClosed = false;

  saveDB(db);

  return ctx.reply(
    "تم فتح الألعاب."
  );
});

/* =========================================================
   التفاعل
========================================================= */

bot.hears(/^تفاعلي$/, async ctx => {
  if (ctx.chat.type === "private") return;

  const db = loadDB();
  const chat = getChat(db, ctx.chat.id);

  const user =
    chat.users[String(ctx.from.id)];

  return ctx.reply(
    [
      "• تفاعلك",
      "━━━━━━━━━━━",
      `• الرسائل ↤︎ ${user?.messages || 0}`,
      `• النقاط ↤︎ ${user?.points || 0}`,
      `• الرتبة ↤︎ ${user?.rank || "عضو"}`
    ].join("\n")
  );
});

bot.hears(/^المتفاعلين$/, async ctx => {
  if (ctx.chat.type === "private") return;

  const db = loadDB();
  const chat = getChat(db, ctx.chat.id);

  const users =
    Object.entries(chat.users)
      .sort(
        (a, b) =>
          (b[1].points || 0) -
          (a[1].points || 0)
      )
      .slice(0, 20);

  if (!users.length) {
    return ctx.reply(
      "لا يوجد تفاعل."
    );
  }

  let text =
    "• المتفاعلين\n━━━━━━━━━━━\n";

  users.forEach(([id, user], index) => {
    text +=
      `${index + 1}. ${user.firstName || "عضو"} ↤︎ ${user.points || 0}\n`;
  });

  return ctx.reply(text);
});

bot.hears(/^اضف تفاعل (\d+)$/, async ctx => {
  const db = loadDB();

  if (!hasRank(
    db,
    ctx.chat.id,
    ctx.from.id,
    "Myth"
  )) {
    return ctx.reply(
      "• هذا الامر يخص ↤ ｢ Myth ｣"
    );
  }

  if (!requireReply(ctx)) {
    return ctx.reply("يجب الرد على العضو.");
  }

  const amount = Number(ctx.match[1]);
  const target =
    ctx.message.reply_to_message.from;

  registerUser(db, ctx.chat.id, target);

  const user =
    getChat(db, ctx.chat.id)
      .users[String(target.id)];

  user.points =
    (user.points || 0) + amount;

  saveDB(db);

  return ctx.reply(
    `تمت إضافة ${amount} تفاعل.`
  );
});

/* =========================================================
   الألعاب الأساسية
========================================================= */

const games = [
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

bot.hears(
  new RegExp(
    `^(${games
      .map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})$`
  ),
  async ctx => {
    if (ctx.chat.type === "private") return;

    const db = loadDB();
    const chat = getChat(db, ctx.chat.id);

    if (chat.settings.gamesClosed) {
      return ctx.reply(
        "الألعاب مقفلة."
      );
    }

    const gameName = ctx.message.text;

    const questions = {
      "لغز": {
        q: "شيء له أسنان ولا يعض، ما هو؟",
        a: "المشط"
      },
      "حساب": {
        q: "كم يساوي 7 + 8 ؟",
        a: "15"
      },
      "صح أو خطأ": {
        q: "الشمس نجم.",
        a: "صح"
      },
      "كلمة": {
        q: "اذكر كلمة تبدأ بحرف م.",
        a: null
      }
    };

    const game =
      questions[gameName] || {
        q: `بدأت لعبة ${gameName}. أرسل إجابتك.`,
        a: null
      };

    chat.games.active = {
      name: gameName,
      answer: game.a,
      startedAt: Date.now()
    };

    saveDB(db);

    return ctx.reply(
      `• لعبة ${gameName}\n• ${game.q}`
    );
  }
);

/* =========================================================
   المتجر
========================================================= */

bot.hears(/^المتجر$/, async ctx => {
  return ctx.reply(
    [
      "• المتجر",
      "━━━━━━━━━━━",
      "• لا توجد منتجات مضافة حاليًا."
    ].join("\n")
  );
});

/* =========================================================
   الزواج
========================================================= */

function marriageKey(a, b) {
  return `${a}:${b}`;
}

bot.hears(
  /^زواج(?: الثانيه| الثالثه| الرابعه)?(?: (\d+))?$/,
  async ctx => {
    if (ctx.chat.type === "private") return;

    if (!requireReply(ctx)) {
      return ctx.reply(
        "يجب الرد على العضو."
      );
    }

    const db = loadDB();
    const chat = getChat(db, ctx.chat.id);

    if (chat.settings.gamesClosed) {
      return ctx.reply(
        "الألعاب مقفلة."
      );
    }

    const husband =
      String(ctx.from.id);

    const wife =
      String(
        ctx.message.reply_to_message.from.id
      );

    if (husband === wife) {
      return ctx.reply(
        "لا يمكنك الزواج من نفسك."
      );
    }

    if (isDev(db, wife)) {
      return ctx.reply(
        "لا يمكن تنفيذ الزواج على المطور."
      );
    }

    const amount =
      Number(ctx.match[1] || 0);

    const existing =
      Object.values(
        db.marriages?.[String(ctx.chat.id)] || {}
      ).filter(
        m =>
          m.husband === husband &&
          m.wife === wife
      );

    if (existing.length) {
      return ctx.reply(
        "لاتقرب للمتزوجين."
      );
    }

    if (!db.marriages[String(ctx.chat.id)]) {
      db.marriages[String(ctx.chat.id)] = {};
    }

    const marriages =
      db.marriages[String(ctx.chat.id)];

    const husbandMarriages =
      Object.values(marriages)
        .filter(
          m => m.husband === husband
        );

    if (husbandMarriages.length >= 4) {
      return ctx.reply(
        "وصلت للحد الأقصى من الزيجات."
      );
    }

    const key =
      marriageKey(husband, wife);

    marriages[key] = {
      husband,
      wife,
      dowry: amount,
      createdAt: Date.now()
    };

    saveDB(db);

    return ctx.reply(
      `تم الزواج بنجاح.\nالمهر: ${amount} ريال`
    );
  }
);

bot.hears(/^زواجي$/, async ctx => {
  if (ctx.chat.type === "private") return;

  const db = loadDB();
  const marriages =
    db.marriages[String(ctx.chat.id)] || {};

  const list =
    Object.values(marriages)
      .filter(
        m =>
          m.husband ===
          String(ctx.from.id)
      );

  if (!list.length) {
    return ctx.reply(
      "لا توجد زيجات."
    );
  }

  let text =
    "• زيجاتك\n━━━━━━━━━━━\n";

  list.forEach((m, i) => {
    text +=
      `${i + 1}. الزوجة: ${m.wife}\nالمهر: ${m.dowry} ريال\n`;
  });

  return ctx.reply(text);
});

bot.hears(/^توب المتزوجين$/, async ctx => {
  if (ctx.chat.type === "private") return;

  const db = loadDB();
  const marriages =
    db.marriages[String(ctx.chat.id)] || {};

  const list =
    Object.values(marriages)
      .sort(
        (a, b) =>
          (b.dowry || 0) -
          (a.dowry || 0)
      )
      .slice(0, 10);

  if (!list.length) {
    return ctx.reply(
      "لا توجد زيجات."
    );
  }

  let text =
    "• توب المتزوجين\n━━━━━━━━━━━\n";

  list.forEach((m, i) => {
    text +=
      `${i + 1}. ${m.husband} ↤︎ ${m.dowry} ريال\n`;
  });

  return ctx.reply(text);
});

/* =========================================================
   معالجة الرسائل النصية المعلقة
========================================================= */

bot.on("text", async ctx => {
  if (ctx.chat.type === "private") {
    const db = loadDB();
    const p = pending.get(ctx.from.id);

    if (!p) return;

    if (p.type === "broadcast") {
      pending.delete(ctx.from.id);

      const subscribers =
        db.globalSubscribers || [];

      let success = 0;
      let failed = 0;

      for (const id of subscribers) {
        try {
          await ctx.telegram.sendMessage(
            id,
            ctx.message.text
          );

          success++;
        } catch {
          failed++;
        }
      }

      return ctx.reply(
        [
          "• تمت الإذاعة بنجاح",
          `• تم الإرسال لـ ↤ ${success}`,
          `• تعذر الإرسال لـ ↤ ${failed}`
        ].join("\n")
      );
    }

    if (p.type === "whisper") {
      const whisper =
        db.whispers?.[p.whisperId];

      if (!whisper) {
        pending.delete(ctx.from.id);

        return ctx.reply(
          "انتهت الهمسة."
        );
      }

      if (
        String(ctx.from.id) !==
        whisper.senderId
      ) {
        pending.delete(ctx.from.id);

        return ctx.reply(
          "غير مسموح."
        );
      }

      whisper.content =
        ctx.message.text;

      whisper.type = "text";

      pending.delete(ctx.from.id);
      saveDB(db);

      return ctx.reply(
        "• تم ارسال الهمسة."
      );
    }

    if (
      p.type === "channel" ||
      p.type === "channel_edit"
    ) {
      const chat =
        getChat(db, p.chatId);

      chat.channels[
        String(ctx.from.id)
      ] = ctx.message.text.trim();

      pending.delete(ctx.from.id);
      saveDB(db);

      return ctx.reply(
        "تم حفظ القناة."
      );
    }

    if (p.type === "customCommand") {
      const chat =
        getChat(db, p.chatId);

      chat.customCommands[
        ctx.message.text.trim()
      ] =
        p.sourceMessage.text || "";

      pending.delete(ctx.from.id);
      saveDB(db);

      return ctx.reply(
        "تم إضافة الأمر."
      );
    }

    if (p.type === "customReply") {
      pending.set(ctx.from.id, {
        type: "customReplyContent",
        chatId: p.chatId,
        keyword: ctx.message.text.trim()
      });

      return ctx.reply(
        "• أرسل الآن رد الأمر"
      );
    }

    if (p.type === "customReplyContent") {
      const chat =
        getChat(db, p.chatId);

      chat.customReplies[p.keyword] =
        ctx.message.text;

      pending.delete(ctx.from.id);
      saveDB(db);

      return ctx.reply(
        "تم إضافة الرد."
      );
    }

    return;
  }

  const db = loadDB();
  const chat = getChat(db, ctx.chat.id);
  const text = ctx.message.text;

  /* الكلمات الممنوعة */
  for (const word of chat.settings.bannedWords) {
    if (
      word &&
      text.toLowerCase()
        .includes(word.toLowerCase())
    ) {
      await ctx.deleteMessage().catch(() => {});
      return;
    }
  }

  /* الأحكام */
  if (
    chat.activeAhkam?.active &&
    text === "أنا"
  ) {
    const id =
      String(ctx.from.id);

    if (
      !chat.activeAhkam.participants.includes(id)
    ) {
      chat.activeAhkam.participants.push(id);
      saveDB(db);

      return ctx.reply(
        "تم تسجيلك في الأحكام."
      );
    }
  }

  /* ألعاب */
  if (chat.games?.active) {
    const game = chat.games.active;

    if (
      game.answer &&
      text.trim().toLowerCase() ===
      String(game.answer)
        .trim()
        .toLowerCase()
    ) {
      const seconds =
        Math.max(
          0,
          Math.floor(
            (Date.now() - game.startedAt) /
            1000
          )
        );

      const user =
        getGlobalUser(
          db,
          ctx.from.id
        );

      user.balance += 10;

      delete chat.games.active;

      saveDB(db);

      return ctx.reply(
        [
          "كفو عليك",
          `الوقت: ${seconds} ثانية`,
          `السرعه: ${
            seconds <= 5
              ? "سريع"
              : seconds <= 12
                ? "متوسط"
                : "بطيء"
          }`,
          `فلوسك: ${user.balance} ريال`
        ].join("\n")
      );
    }
  }

  /* الأوامر المخصصة */
  if (
    chat.customCommands[text]
  ) {
    return ctx.reply(
      chat.customCommands[text]
    );
  }

  if (
    chat.customReplies[text]
  ) {
    return ctx.reply(
      chat.customReplies[text]
    );
  }
});

/* =========================================================
   قائمة الأوامر
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
        "menu:protection"
      ),
      Markup.button.callback(
        "التفاعل والألعاب والفعاليات",
        "menu:games"
      )
    ],
    [
      Markup.button.callback(
        "الهمسات والأغاني",
        "menu:media"
      ),
      Markup.button.callback(
        "الأوامر المخصصة",
        "menu:custom"
      )
    ],
    [
      Markup.button.callback(
        "القروب",
        "menu:group"
      )
    ]
  ]);
}

bot.hears(/^اوامر$/, async ctx => {
  return ctx.reply(
    "• قائمة الأوامر",
    mainMenu()
  );
});

const menuTexts = {
  dev: [
    "• أوامر المطور",
    "━━━━━━━━━━━",
    "ا",
    "ت",
    "ق",
    "م",
    "ن",
    "ح",
    "د",
    "إذاعة"
  ],

  ranks: [
    "• أوامر الرتب",
    "━━━━━━━━━━━",
    "رفع مشرف",
    "ترقيه",
    "صلاحياتي",
    "صلاحياته",
    "رتبتي",
    "رتبته",
    "لقبي",
    "لقبه"
  ],

  protection: [
    "• أوامر الحماية",
    "━━━━━━━━━━━",
    "كتم",
    "فك الكتم",
    "حظر",
    "طرد",
    "تنظيف",
    "فتح المنشن",
    "غلق المنشن",
    "منع الكلمه",
    "الغاء منع الكلمه",
    "الكلمات الممنوعه",
    "مسح الكلمات الممنوعه"
  ],

  games: [
    "• التفاعل والألعاب والفعاليات",
    "━━━━━━━━━━━",
    "تفاعلي",
    "المتفاعلين",
    "فلوسي",
    "المتجر",
    "احكام",
    "انهاء احكام",
    "قفل الالعاب",
    "فتح الالعاب",
    ...games
  ],

  media: [
    "• الهمسات والأغاني",
    "━━━━━━━━━━━",
    "اهمس",
    "همسه",
    "ه"
  ],

  custom: [
    "• الأوامر المخصصة",
    "━━━━━━━━━━━",
    "اضف امر",
    "اضف رد",
    "حذف امر",
    "حذف رد",
    "اوامري",
    "ردودي"
  ],

  group: [
    "• أوامر القروب",
    "━━━━━━━━━━━",
    "قناتي",
    "اضف قناة",
    "تعديل قناتي",
    "حذف قناتي",
    "زواجي",
    "توب المتزوجين"
  ]
};

for (const [key, lines] of Object.entries(menuTexts)) {
  bot.action(`menu:${key}`, async ctx => {
    await ctx.editMessageText(
      lines.join("\n"),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "رجوع",
            "menu:back"
          )
        ]
      ])
    );

    await ctx.answerCbQuery();
  });
}

bot.action("menu:back", async ctx => {
  await ctx.editMessageText(
    "• قائمة الأوامر",
    mainMenu()
  );

  await ctx.answerCbQuery();
});

/* =========================================================
   أوامر المطور
========================================================= */

const DEV_COMMANDS = [
  "ا",
  "ت",
  "ق",
  "م",
  "ن",
  "ح",
  "د"
];

bot.hears(
  new RegExp(
    `^(${DEV_COMMANDS.join("|")})$`
  ),
  async ctx => {
    const db = loadDB();

    if (!isDev(db, ctx.from.id)) {
      return ctx.reply(
        "• هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
      );
    }

    return ctx.reply(
      `تم تنفيذ أمر المطور: ${ctx.message.text}`
    );
  }
);

/* =========================================================
   تنظيف
========================================================= */

bot.hears(/^تنظيف$/, async ctx => {
  if (ctx.chat.type === "private") return;

  const db = loadDB();

  if (!hasRank(
    db,
    ctx.chat.id,
    ctx.from.id,
    "Myth"
  )) {
    return ctx.reply(
      "• هذا الامر يخص ↤ ｢ Myth ｣"
    );
  }

  try {
    await ctx.deleteMessage();

    if (ctx.message.reply_to_message) {
      await ctx.telegram.deleteMessage(
        ctx.chat.id,
        ctx.message.reply_to_message.message_id
      );
    }

    return ctx.reply(
      "تم التنظيف بنجاح."
    );
  } catch {
    return ctx.reply(
      "فشل التنظيف، تأكد من صلاحيات البوت."
    );
  }
});

/* =========================================================
   تشغيل البوت
========================================================= */

bot.catch((err, ctx) => {
  console.error(
    "BOT ERROR:",
    err?.message || err
  );
});

bot.launch()
  .then(() => {
    console.log("Bot started successfully.");
  })
  .catch(err => {
    console.error(
      "Failed to start bot:",
      err
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
