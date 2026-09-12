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
const DATA_FILE = path.join(DATA_DIR, "data.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_DATA = {
  users: {},
  groups: {},
  subscribers: []
};

let data = DEFAULT_DATA;

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(DEFAULT_DATA, null, 2),
        "utf8"
      );
      data = JSON.parse(JSON.stringify(DEFAULT_DATA));
      return;
    }

    data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    data.users ||= {};
    data.groups ||= {};
    data.subscribers ||= [];
  } catch (err) {
    console.error("خطأ تحميل البيانات:", err);
    data = JSON.parse(JSON.stringify(DEFAULT_DATA));
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
    console.error("خطأ حفظ البيانات:", err);
  }
}

loadData();

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

const DEV_USERNAME = "j4xa7";

/* =========================================================
   أدوات عامة
========================================================= */

function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeText(text = "") {
  return String(text)
    .trim()
    .replace(/\s+/g, " ");
}

function getGroup(chatId) {
  const id = String(chatId);

  if (!data.groups[id]) {
    data.groups[id] = {
      users: {},
      muted: {},
      globalMuted: {},
      violationsEnabled: true,
      autoClean: false,
      linksEnabled: false,
      groupOpen: true,
      mentionEnabled: true,
      forbiddenWords: [],
      trackedMessages: {},
      interactions: {},
      customCommands: {},
      customReplies: {},
      marriages: {},
      gamesEnabled: true,
      games: {},
      botReplies: true,
      musicEnabled: true,
      adminPermissions: {},
      settings: {}
    };
  }

  const group = data.groups[id];

  group.users ||= {};
  group.muted ||= {};
  group.globalMuted ||= {};
  group.forbiddenWords ||= [];
  group.trackedMessages ||= {};
  group.interactions ||= {};
  group.customCommands ||= {};
  group.customReplies ||= {};
  group.marriages ||= {};
  group.games ||= {};
  group.adminPermissions ||= {};
  group.settings ||= {};

  return group;
}

function ensureUser(user) {
  if (!user) return null;

  const id = String(user.id);

  if (!data.users[id]) {
    data.users[id] = {
      id: user.id,
      username: user.username || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      role: "عضو",
      title: "",
      messages: 0,
      points: 0,
      money: 0,
      warnings: 0
    };
  }

  const stored = data.users[id];

  stored.id = user.id;
  stored.username = user.username || stored.username || "";
  stored.first_name = user.first_name || stored.first_name || "";
  stored.last_name = user.last_name || stored.last_name || "";
  stored.role ||= "عضو";
  stored.title ||= "";
  stored.messages ||= 0;
  stored.points ||= 0;
  stored.money ||= 0;
  stored.warnings ||= 0;

  return stored;
}

function getUserLevel(userId) {
  const user = data.users[String(userId)];
  if (!user) return 0;

  return ROLES[user.role] ?? 0;
}

function getRoleName(userId) {
  return (
    data.users[String(userId)]?.role ||
    "عضو"
  );
}

function isDeveloper(user) {
  return (
    !!user &&
    String(user.username || "").toLowerCase() ===
      DEV_USERNAME.toLowerCase()
  );
}

async function getChatUser(ctx, userId) {
  try {
    if (!ctx.chat?.id) return null;

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
  المشرف العادي في تيليجرام لا يتحول إلى رتبة
  "مالك" داخل نظام البوت.
  المالك الحقيقي فقط status=creator.
*/
async function getLevel(ctx, userId) {
  const member = await getChatUser(ctx, userId);

  if (member?.status === "creator") {
    return 3;
  }

  return getUserLevel(userId);
}

function mention(user) {
  if (!user) return "المستخدم";

  ensureUser(user);

  const stored =
    data.users[String(user.id)];

  const name =
    user.first_name ||
    user.username ||
    stored?.first_name ||
    "المستخدم";

  const title = stored?.title || "";

  const text = title
    ? `${name}「${title}」`
    : name;

  return `<a href="tg://user?id=${user.id}">${escapeHtml(
    text
  )}</a>`;
}

function mentionById(userId) {
  const stored =
    data.users[String(userId)];

  if (!stored) {
    return `<a href="tg://user?id=${userId}">المستخدم</a>`;
  }

  return mention({
    id: stored.id,
    first_name: stored.first_name,
    username: stored.username
  });
}

/* =========================================================
   الردود - كل رد يكون Reply على الأمر
========================================================= */

async function safeReply(ctx, text, extra = {}) {
  try {
    const options = {
      parse_mode: "HTML",
      ...extra
    };

    if (
      ctx.message?.message_id &&
      !options.reply_parameters
    ) {
      options.reply_parameters = {
        message_id: ctx.message.message_id
      };
    }

    return await ctx.reply(text, options);
  } catch (err) {
    console.error("safeReply:", err.message);
    return null;
  }
}

async function replyCommand(ctx, text) {
  return safeReply(ctx, text);
}

async function safeDelete(ctx, messageId) {
  try {
    if (ctx.chat?.id && messageId) {
      await ctx.telegram.deleteMessage(
        ctx.chat.id,
        messageId
      );
    }
  } catch {}
}

/* =========================================================
   الصلاحيات الفعلية بالقروب
========================================================= */

const ACTUAL_PERMISSIONS = [
  ["can_change_info", "تغيير معلومات المجموعة"],
  ["can_pin_messages", "تثبيت الرسائل"],
  ["can_restrict_members", "حظر المستخدمين"],
  ["can_invite_users", "دعوة المستخدمين"],
  ["can_delete_messages", "مسح الرسائل"],
  ["can_manage_video_chats", "إدارة المكالمات"],
  ["can_promote_members", "اضافة مشرفين"]
];

function actualPermission(member, key) {
  if (!member) return false;

  if (member.status === "creator") {
    return true;
  }

  if (member.status !== "administrator") {
    return false;
  }

  return member[key] === true;
}

function formatActualPermissions(
  member,
  self = false
) {
  const title = self
    ? "صلاحياتك بالإشراف :"
    : "صلاحياته بالإشراف :";

  const lines = [
    `• ${title}`,
    "━━━━━━━━━━━"
  ];

  for (const [key, name] of ACTUAL_PERMISSIONS) {
    lines.push(
      `• ${name} ↤︎ ${
        actualPermission(member, key)
          ? "نعم"
          : "لا"
      }`
    );
  }

  return lines.join("\n");
}

/* =========================================================
   الحماية
========================================================= */

function containsLink(text = "") {
  return /(https?:\/\/|www\.|t\.me\/|telegram\.me\/|@[a-zA-Z0-9_]{4,})/i.test(
    text
  );
}

function isEnglishMessage(text = "") {
  const hasEnglish = /[A-Za-z]/.test(text);
  const hasArabic = /[\u0600-\u06FF]/.test(text);

  return hasEnglish && !hasArabic;
}

function containsForbiddenWord(text, group) {
  const lower =
    String(text || "").toLowerCase();

  return group.forbiddenWords.some(word =>
    lower.includes(
      String(word).toLowerCase()
    )
  );
}

async function protection(ctx) {
  if (!ctx.message || !ctx.chat) {
    return false;
  }

  if (
    ctx.chat.type !== "group" &&
    ctx.chat.type !== "supergroup"
  ) {
    return false;
  }

  const user = ctx.from;
  ensureUser(user);

  const group =
    getGroup(ctx.chat.id);

  const member =
    await getChatUser(
      ctx,
      user.id
    );

  /*
    المشرفين والمالك الحقيقيين لا تطبق عليهم الحماية.
  */
  if (
    member?.status === "creator" ||
    member?.status === "administrator"
  ) {
    return false;
  }

  /*
    أصحاب رتب Myth و Dev فوق الحماية.
  */
  if (
    getUserLevel(user.id) >= 4
  ) {
    return false;
  }

  if (
    group.muted[String(user.id)] ||
    group.globalMuted[String(user.id)]
  ) {
    await safeDelete(
      ctx,
      ctx.message.message_id
    );
    return true;
  }

  if (!group.violationsEnabled) {
    return false;
  }

  const msg = ctx.message;

  /*
    الملصقات
  */
  if (msg.sticker) {
    await safeDelete(
      ctx,
      msg.message_id
    );

    await safeReply(
      ctx,
      `• عذراً عزيزي ↤︎${mention(user)}\n• ممنوع الملصقات`
    );

    return true;
  }

  /*
    جهات الاتصال
  */
  if (msg.contact) {
    await safeDelete(
      ctx,
      msg.message_id
    );

    await safeReply(
      ctx,
      `• عذراً عزيزي ↤︎${mention(user)}\n• ممنوع جهات الاتصال`
    );

    return true;
  }

  /*
    التحويل من قروب / قناة
  */
  const forwarded =
    msg.forward_origin ||
    msg.forward_from_chat ||
    msg.forward_from;

  if (forwarded) {
    await safeDelete(
      ctx,
      msg.message_id
    );

    await safeReply(
      ctx,
      `• عذراً عزيزي ↤︎${mention(user)}\n• ممنوع التحويل من قروب لقروب`
    );

    return true;
  }

  const text =
    msg.text ||
    msg.caption ||
    "";

  /*
    الرسائل الإنجليزية
  */
  if (
    text &&
    isEnglishMessage(text)
  ) {
    await safeDelete(
      ctx,
      msg.message_id
    );

    await safeReply(
      ctx,
      `• عذراً عزيزي ↤︎${mention(user)}\n• ممنوعه هذي`
    );

    return true;
  }

  /*
    الروابط
  */
  if (
    group.linksEnabled &&
    containsLink(text)
  ) {
    await safeDelete(
      ctx,
      msg.message_id
    );

    await safeReply(
      ctx,
      `• عذراً عزيزي ↤︎${mention(user)}\n• ممنوعه هذي`
    );

    return true;
  }

  /*
    الكلمات الممنوعة
  */
  if (
    containsForbiddenWord(
      text,
      group
    )
  ) {
    await safeDelete(
      ctx,
      msg.message_id
    );

    await safeReply(
      ctx,
      `• عذراً عزيزي ↤︎${mention(user)}\n• ممنوعه هذي`
    );

    return true;
  }

  return false;
}

/* =========================================================
   التحقق من الصلاحيات
========================================================= */

async function requireLevel(
  ctx,
  level,
  message = "ما تقدر تستخدم هذا الأمر"
) {
  const current =
    await getLevel(
      ctx,
      ctx.from.id
    );

  if (current < level) {
    await replyCommand(
      ctx,
      `• ${message}`
    );
    return false;
  }

  return true;
}

/*
  منع التصرف على:
  - نفسه
  - مالك القروب
  - المشرفين من غير المالك
  - أي شخص أعلى منه
*/
async function canActOnTarget(
  ctx,
  targetId
) {
  const actorId =
    ctx.from.id;

  if (actorId === targetId) {
    return false;
  }

  const actorMember =
    await getChatUser(
      ctx,
      actorId
    );

  const targetMember =
    await getChatUser(
      ctx,
      targetId
    );

  if (
    targetMember?.status ===
    "creator"
  ) {
    return false;
  }

  if (
    targetMember?.status ===
      "administrator" &&
    actorMember?.status !==
      "creator"
  ) {
    return false;
  }

  const actorLevel =
    await getLevel(
      ctx,
      actorId
    );

  const targetLevel =
    await getLevel(
      ctx,
      targetId
    );

  return actorLevel > targetLevel;
}

function getTargetUser(ctx) {
  if (
    ctx.message?.reply_to_message
      ?.from
  ) {
    return ctx.message
      .reply_to_message
      .from;
  }

  return null;
}

async function resolveTarget(ctx) {
  const target =
    getTargetUser(ctx);

  if (target) {
    ensureUser(target);
    return target;
  }

  return null;
}

/* =========================================================
   الكتم
========================================================= */

async function muteTarget(
  ctx,
  global = false
) {
  const target =
    await resolveTarget(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• رد على رسالة المستخدم أولاً"
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

  const group =
    getGroup(ctx.chat.id);

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
          can_pin_messages: false
        }
      }
    );

    if (global) {
      group.globalMuted[
        String(target.id)
      ] = true;
    } else {
      group.muted[
        String(target.id)
      ] = true;
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
  } catch (err) {
    console.error(err);

    return replyCommand(
      ctx,
      "• ما قدرت أكتم المستخدم، تأكد من صلاحيات البوت"
    );
  }
}

async function unmuteTarget(
  ctx,
  global = false
) {
  const target =
    await resolveTarget(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• رد على رسالة المستخدم أولاً"
    );
  }

  const group =
    getGroup(ctx.chat.id);

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
          can_pin_messages: false
        }
      }
    );

    if (global) {
      delete group.globalMuted[
        String(target.id)
      ];
    } else {
      delete group.muted[
        String(target.id)
      ];
    }

    saveData();

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎${mention(target)}\n• ${
        global
          ? "فكيت عنه الكتم العام"
          : "فكيت عنه الكتم"
      }`
    );
  } catch {
    return replyCommand(
      ctx,
      "• ما قدرت أفك الكتم"
    );
  }
}

/* =========================================================
   الحظر والطرد
========================================================= */

async function banTarget(ctx) {
  const target =
    await resolveTarget(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• رد على رسالة المستخدم أولاً"
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
  } catch {
    return replyCommand(
      ctx,
      "• ما قدرت أحظر المستخدم"
    );
  }
}

async function unbanTarget(ctx) {
  const target =
    await resolveTarget(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• رد على رسالة المستخدم أولاً"
    );
  }

  try {
    await ctx.telegram.unbanChatMember(
      ctx.chat.id,
      target.id,
      {
        only_if_banned: true
      }
    );

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎${mention(target)}\n• فكيت حظره`
    );
  } catch {
    return replyCommand(
      ctx,
      "• ما قدرت أفك حظر المستخدم"
    );
  }
}

async function kickTarget(ctx) {
  const target =
    await resolveTarget(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• رد على رسالة المستخدم أولاً"
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
      target.id
    );

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎${mention(target)}\n• طردته`
    );
  } catch {
    return replyCommand(
      ctx,
      "• ما قدرت أطرد المستخدم"
    );
  }
}

/* =========================================================
   التقييد
========================================================= */

async function restrictTarget(ctx) {
  const target =
    await resolveTarget(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• رد على رسالة المستخدم أولاً"
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
  } catch {
    return replyCommand(
      ctx,
      "• ما قدرت أقيد المستخدم"
    );
  }
}

async function unrestrictTarget(ctx) {
  const target =
    await resolveTarget(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• رد على رسالة المستخدم أولاً"
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

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎${mention(target)}\n• الغيت تقييده`
    );
  } catch {
    return replyCommand(
      ctx,
      "• ما قدرت ألغي التقييد"
    );
  }
}

/* =========================================================
   الرتب الداخلية
   فقط Dev🎖️ يقدر يرفع / يرقي
========================================================= */

async function canManageRanks(ctx) {
  const user =
    ctx.from;

  /*
    المطور المحدد هو Dev🎖️ الأساسي.
  */
  if (isDeveloper(user)) {
    return true;
  }

  /*
    وحتى لو عنده رتبة عالية، ما يقدر يرقّي.
  */
  const stored =
    data.users[String(user.id)];

  if (
    stored?.role === "Dev🎖️"
  ) {
    return true;
  }

  return false;
}

async function setInternalRole(
  ctx,
  role
) {
  if (
    !(await canManageRanks(ctx))
  ) {
    return replyCommand(
      ctx,
      "• فقط Dev🎖️ يقدر يرفع أو يرقي الرتب"
    );
  }

  const target =
    await resolveTarget(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• رد على رسالة المستخدم أولاً"
    );
  }

  const targetMember =
    await getChatUser(
      ctx,
      target.id
    );

  /*
    المالك الحقيقي لا يتم العبث برتبته.
  */
  if (
    targetMember?.status ===
    "creator"
  ) {
    return replyCommand(
      ctx,
      "• هذا مالك القروب وما تقدر ترقيه"
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

async function removeInternalRole(ctx) {
  if (
    !(await canManageRanks(ctx))
  ) {
    return replyCommand(
      ctx,
      "• فقط Dev🎖️ يقدر ينزل أو يرقي الرتب"
    );
  }

  const target =
    await resolveTarget(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• رد على رسالة المستخدم أولاً"
    );
  }

  const targetMember =
    await getChatUser(
      ctx,
      target.id
    );

  if (
    targetMember?.status ===
    "creator"
  ) {
    return replyCommand(
      ctx,
      "• هذا مالك القروب"
    );
  }

  ensureUser(target);

  data.users[
    String(target.id)
  ].role = "عضو";

  saveData();

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎${mention(target)}\n• تم تنزيل رتبته`
  );
}

/* =========================================================
   رفع مشرف - الصلاحيات
========================================================= */

const PROMOTION_PERMISSIONS = [
  [
    "can_change_info",
    "تغيير معلومات المجموعة"
  ],
  [
    "can_pin_messages",
    "تثبيت الرسائل"
  ],
  [
    "can_restrict_members",
    "حظر المستخدمين"
  ],
  [
    "can_invite_users",
    "دعوة المستخدمين"
  ],
  [
    "can_delete_messages",
    "مسح الرسائل"
  ],
  [
    "can_manage_video_chats",
    "إدارة المكالمات"
  ],
  [
    "can_promote_members",
    "اضافة مشرفين"
  ]
];

const pendingPromotions =
  new Map();

function promotionKey() {
  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2, 8)
  );
}

function promotionText(state) {
  const lines = [
    `• حدد الصلاحيات ↦ ${mention(
      state.target
    )}`,
    "━━━━━━━━━━━"
  ];

  for (
    const [key, name] of
    PROMOTION_PERMISSIONS
  ) {
    lines.push(
      `• ${name} ↤︎ ${
        state.permissions[key]
          ? "نعم"
          : "لا"
      }`
    );
  }

  return lines.join("\n");
}

function promotionKeyboard(state) {
  const rows = [];

  for (
    const [key, name] of
    PROMOTION_PERMISSIONS
  ) {
    rows.push([
      Markup.button.callback(
        `${name} ↤︎ ${
          state.permissions[key]
            ? "نعم"
            : "لا"
        }`,
        `promset:${state.key}:${key}`
      )
    ]);
  }

  rows.push([
    Markup.button.callback(
      "🔴 إخفاء الأمر",
      `promdone:${state.key}`
    )
  ]);

  return Markup.inlineKeyboard(
    rows
  );
}

async function promoteTarget(ctx) {
  /*
    رفع مشرف / ترقيه مشرف
    فقط Dev🎖️
  */
  if (
    !(await canManageRanks(ctx))
  ) {
    return replyCommand(
      ctx,
      "• فقط Dev🎖️ يقدر يرفع مشرف أو يرقي مشرف"
    );
  }

  const target =
    await resolveTarget(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• رد على رسالة المستخدم أولاً"
    );
  }

  const targetMember =
    await getChatUser(
      ctx,
      target.id
    );

  if (
    targetMember?.status ===
    "creator"
  ) {
    return replyCommand(
      ctx,
      "• هذا مالك القروب وما تقدر ترفعه"
    );
  }

  /*
    إذا كان مشرف فعلاً، نستخدم نفس اللوحة
    لتعديل / ترقيته.
  */
  if (
    targetMember?.status ===
    "administrator"
  ) {
    /*
      نسمح لـ Dev🎖️ فقط بتعديل صلاحياته.
    */
  }

  const botMember =
    await getChatUser(
      ctx,
      ctx.botInfo?.id ||
        bot.botInfo?.id
    );

  if (
    !botMember ||
    botMember.status !==
      "administrator"
  ) {
    return replyCommand(
      ctx,
      "• لازم البوت يكون مشرف"
    );
  }

  if (
    !botMember.can_promote_members
  ) {
    return replyCommand(
      ctx,
      "• البوت ما عنده صلاحية إضافة المشرفين"
    );
  }

  const key =
    promotionKey();

  const state = {
    key,
    chatId: ctx.chat.id,
    initiatorId: ctx.from.id,
    targetId: target.id,
    target,
    commandMessageId:
      ctx.message.message_id,

    permissions: {
      can_change_info: false,
      can_pin_messages: false,
      can_restrict_members: false,
      can_invite_users: false,
      can_delete_messages: false,
      can_manage_video_chats: false,
      can_promote_members: false
    }
  };

  /*
    إذا الشخص مشرف من قبل،
    نخلي اللوحة تبدأ بصلاحياته الفعلية.
  */
  if (
    targetMember?.status ===
    "administrator"
  ) {
    for (
      const [keyName] of
      PROMOTION_PERMISSIONS
    ) {
      state.permissions[keyName] =
        targetMember[keyName] === true;
    }
  }

  pendingPromotions.set(
    key,
    state
  );

  return safeReply(
    ctx,
    promotionText(state),
    promotionKeyboard(state)
  );
}

/* =========================================================
   Callback رفع المشرف
========================================================= */

bot.on(
  "callback_query",
  async ctx => {
    const callbackData =
      ctx.callbackQuery?.data ||
      "";

    if (
      !callbackData.startsWith(
        "prom"
      )
    ) {
      return;
    }

    const parts =
      callbackData.split(":");

    const action = parts[0];
    const key = parts[1];

    const state =
      pendingPromotions.get(key);

    if (!state) {
      try {
        await ctx.answerCbQuery(
          "انتهى الأمر"
        );
      } catch {}

      return;
    }

    if (
      ctx.from.id !==
      state.initiatorId
    ) {
      try {
        await ctx.answerCbQuery(
          "هذا الأمر مو لك"
        );
      } catch {}

      return;
    }

    /*
      تبديل نعم / لا
    */
    if (
      action === "promset"
    ) {
      const permission =
        parts[2];

      if (
        !Object.prototype.hasOwnProperty.call(
          state.permissions,
          permission
        )
      ) {
        return;
      }

      state.permissions[
        permission
      ] =
        !state.permissions[
          permission
        ];

      try {
        await ctx.editMessageText(
          promotionText(state),
          {
            parse_mode: "HTML",
            ...promotionKeyboard(
              state
            )
          }
        );

        await ctx.answerCbQuery(
          state.permissions[
            permission
          ]
            ? "تم اختيار نعم"
            : "تم اختيار لا"
        );
      } catch (err) {
        console.error(err);
      }

      return;
    }

    /*
      إخفاء الأمر = تنفيذ الرفع
    */
    if (
      action === "promdone"
    ) {
      try {
        /*
          التأكد أن الشخص لا يزال Dev🎖️
        */
        const initiator =
          await ctx.telegram.getChatMember(
            state.chatId,
            state.initiatorId
          );

        const initiatorStored =
          data.users[
            String(
              state.initiatorId
            )
          ];

        const isDev =
          String(
            initiator.user
              ?.username || ""
          ).toLowerCase() ===
            DEV_USERNAME.toLowerCase() ||
          initiatorStored?.role ===
            "Dev🎖️";

        if (!isDev) {
          await ctx.answerCbQuery(
            "فقط Dev🎖️ يقدر ينفذ الأمر"
          );
          return;
        }

        /*
          التأكد من صلاحية البوت
        */
        const botMember =
          await ctx.telegram.getChatMember(
            state.chatId,
            ctx.botInfo.id
          );

        if (
          botMember.status !==
            "administrator" ||
          !botMember.can_promote_members
        ) {
          await ctx.answerCbQuery(
            "البوت ما عنده صلاحية إضافة المشرفين"
          );
          return;
        }

        /*
          المالك لا يمكن رفعه
        */
        const targetMember =
          await ctx.telegram.getChatMember(
            state.chatId,
            state.targetId
          );

        if (
          targetMember.status ===
          "creator"
        ) {
          await ctx.answerCbQuery(
            "هذا مالك القروب"
          );
          return;
        }

        /*
          تنفيذ الصلاحيات المحددة
        */
        await ctx.telegram.promoteChatMember(
          state.chatId,
          state.targetId,
          {
            is_anonymous: false,

            can_manage_chat: false,

            can_change_info:
              state.permissions
                .can_change_info,

            can_post_messages: false,

            can_edit_messages: false,

            can_delete_messages:
              state.permissions
                .can_delete_messages,

            can_invite_users:
              state.permissions
                .can_invite_users,

            can_restrict_members:
              state.permissions
                .can_restrict_members,

            can_pin_messages:
              state.permissions
                .can_pin_messages,

            can_promote_members:
              state.permissions
                .can_promote_members,

            can_manage_video_chats:
              state.permissions
                .can_manage_video_chats,

            can_manage_topics: false,

            can_post_stories: false,

            can_edit_stories: false,

            can_delete_stories: false
          }
        );

        pendingPromotions.delete(
          key
        );

        /*
          حذف لوحة الصلاحيات
        */
        try {
          await ctx.deleteMessage();
        } catch {}

        /*
          النتيجة Reply على أمر
          "رفع مشرف"
        */
        await ctx.telegram.sendMessage(
          state.chatId,
          `• المستخدم ذا ↤︎${mention(
            state.target
          )}\n• تم رفعه الرتبه`,
          {
            parse_mode: "HTML",
            reply_parameters: {
              message_id:
                state.commandMessageId
            }
          }
        );

        await ctx.answerCbQuery(
          "تم رفعه مشرف"
        );
      } catch (err) {
        console.error(
          "PROMOTION ERROR:",
          err
        );

        try {
          await ctx.answerCbQuery(
            "ما قدرت أرفع المشرف"
          );
        } catch {}
      }
    }
  }
);

/* =========================================================
   تنزيل مشرف
========================================================= */

async function demoteTarget(ctx) {
  if (
    !(await canManageRanks(ctx))
  ) {
    return replyCommand(
      ctx,
      "• فقط Dev🎖️ يقدر ينزل مشرف"
    );
  }

  const target =
    await resolveTarget(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• رد على رسالة المستخدم أولاً"
    );
  }

  const targetMember =
    await getChatUser(
      ctx,
      target.id
    );

  if (
    targetMember?.status ===
    "creator"
  ) {
    return replyCommand(
      ctx,
      "• ما تقدر تنزل مالك القروب"
    );
  }

  if (
    targetMember?.status !==
    "administrator"
  ) {
    return replyCommand(
      ctx,
      "• المستخدم مو مشرف"
    );
  }

  try {
    await ctx.telegram.promoteChatMember(
      ctx.chat.id,
      target.id,
      {
        is_anonymous: false,
        can_manage_chat: false,
        can_change_info: false,
        can_post_messages: false,
        can_edit_messages: false,
        can_delete_messages: false,
        can_invite_users: false,
        can_restrict_members: false,
        can_pin_messages: false,
        can_promote_members: false,
        can_manage_video_chats: false,
        can_manage_topics: false,
        can_post_stories: false,
        can_edit_stories: false,
        can_delete_stories: false
      }
    );

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎${mention(
        target
      )}\n• تم تنزيل رتبته`
    );
  } catch (err) {
    console.error(err);

    return replyCommand(
      ctx,
      "• ما قدرت أنزل المشرف"
    );
  }
}

/* =========================================================
   صلاحياتي / صلاحياته
========================================================= */

async function getMyPermissions(ctx) {
  const member =
    await getChatUser(
      ctx,
      ctx.from.id
    );

  return replyCommand(
    ctx,
    formatActualPermissions(
      member,
      true
    )
  );
}

async function getTargetPermissions(ctx) {
  const target =
    await resolveTarget(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• رد على رسالة المستخدم أولاً"
    );
  }

  const member =
    await getChatUser(
      ctx,
      target.id
    );

  return replyCommand(
    ctx,
    formatActualPermissions(
      member,
      false
    )
  );
}

/* =========================================================
   الهمسات
========================================================= */

const whispers =
  new Map();

const pendingWhisperReplies =
  new Map();

function createWhisper(ctx) {
  const replied =
    ctx.message?.reply_to_message;

  if (!replied) {
    return null;
  }

  const id =
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2, 8);

  const content = {
    id,
    chatId: ctx.chat.id,
    senderId: ctx.from.id,
    sender: ctx.from,
    messageId:
      replied.message_id,
    createdAt: Date.now(),
    type: "text",
    text:
      replied.text ||
      replied.caption ||
      "",
    sticker: null,
    photo: null,
    animation: null,
    video: null,
    voice: null
  };

  if (replied.sticker) {
    content.type = "sticker";
    content.sticker =
      replied.sticker.file_id;
  } else if (
    replied.photo?.length
  ) {
    content.type = "photo";
    content.photo =
      replied.photo[
        replied.photo.length - 1
      ].file_id;
    content.text =
      replied.caption || "";
  } else if (
    replied.animation
  ) {
    content.type =
      "animation";
    content.animation =
      replied.animation.file_id;
    content.text =
      replied.caption || "";
  } else if (
    replied.video
  ) {
    content.type = "video";
    content.video =
      replied.video.file_id;
    content.text =
      replied.caption || "";
  } else if (
    replied.voice
  ) {
    content.type = "voice";
    content.voice =
      replied.voice.file_id;
  }

  whispers.set(
    id,
    content
  );

  return id;
}

function getWhisperKeyboard(id) {
  const username =
    bot.botInfo?.username ||
    process.env.BOT_USERNAME;

  if (!username) {
    return null;
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

async function sendWhisper(ctx) {
  const replied =
    ctx.message?.reply_to_message;

  if (!replied) {
    return replyCommand(
      ctx,
      "• رد على الرسالة اللي تبي ترسلها همسة"
    );
  }

  const id =
    createWhisper(ctx);

  if (!id) return;

  const whisper =
    whispers.get(id);

  const keyboard =
    getWhisperKeyboard(id);

  await safeDelete(
    ctx,
    ctx.message.message_id
  );

  try {
    await ctx.telegram.sendMessage(
      ctx.chat.id,
      `• وصلت همسة من ${mention(
        whisper.sender
      )}`,
      {
        parse_mode: "HTML",
        ...(keyboard || {})
      }
    );
  } catch (err) {
    console.error(err);
  }
}

async function showWhisper(
  ctx,
  id
) {
  const whisper =
    whispers.get(id);

  if (!whisper) {
    return safeReply(
      ctx,
      "• الهمسة غير موجودة أو انتهت"
    );
  }

  try {
    if (
      whisper.type ===
      "sticker"
    ) {
      return ctx.replyWithSticker(
        whisper.sticker,
        {
          reply_parameters: {
            message_id:
              ctx.message?.message_id
          }
        }
      );
    }

    if (
      whisper.type ===
      "photo"
    ) {
      return ctx.replyWithPhoto(
        whisper.photo,
        {
          caption:
            whisper.text ||
            undefined,
          parse_mode: "HTML",
          reply_parameters: {
            message_id:
              ctx.message?.message_id
          }
        }
      );
    }

    if (
      whisper.type ===
      "animation"
    ) {
      return ctx.replyWithAnimation(
        whisper.animation,
        {
          caption:
            whisper.text ||
            undefined,
          parse_mode: "HTML",
          reply_parameters: {
            message_id:
              ctx.message?.message_id
          }
        }
      );
    }

    if (
      whisper.type ===
      "video"
    ) {
      return ctx.replyWithVideo(
        whisper.video,
        {
          caption:
            whisper.text ||
            undefined,
          parse_mode: "HTML",
          reply_parameters: {
            message_id:
              ctx.message?.message_id
          }
        }
      );
    }

    if (
      whisper.type ===
      "voice"
    ) {
      return ctx.replyWithVoice(
        whisper.voice,
        {
          reply_parameters: {
            message_id:
              ctx.message?.message_id
          }
        }
      );
    }

    return safeReply(
      ctx,
      whisper.text ||
        "• همسة فارغة"
    );
  } catch {
    return safeReply(
      ctx,
      "• تعذر عرض الهمسة"
    );
  }
}

async function startWhisperReply(
  ctx,
  id
) {
  const whisper =
    whispers.get(id);

  if (!whisper) {
    return safeReply(
      ctx,
      "• الهمسة غير موجودة أو انتهت"
    );
  }

  pendingWhisperReplies.set(
    ctx.from.id,
    {
      whisperId: id,
      senderId:
        whisper.senderId,
      chatId:
        whisper.chatId
    }
  );

  return safeReply(
    ctx,
    "• أرسل ردك الآن"
  );
}

/* =========================================================
   المالك
========================================================= */

async function getDeveloperProfile(
  ctx
) {
  try {
    return await ctx.telegram.getChat(
      `@${DEV_USERNAME}`
    );
  } catch {}

  try {
    const admins =
      await ctx.telegram.getChatAdministrators(
        ctx.chat.id
      );

    const found =
      admins.find(
        x =>
          String(
            x.user.username || ""
          ).toLowerCase() ===
          DEV_USERNAME.toLowerCase()
      );

    if (found) {
      return found.user;
    }
  } catch {}

  return null;
}

async function showOwner(ctx) {
  const owner =
    await getDeveloperProfile(
      ctx
    );

  if (!owner) {
    return replyCommand(
      ctx,
      `• المالك ↤︎ @${DEV_USERNAME}`
    );
  }

  const bio =
    owner.bio ||
    "ما فيه نبذة";

  try {
    const photos =
      await ctx.telegram.getUserProfilePhotos(
        owner.id,
        0,
        1
      );

    if (
      photos.total_count > 0 &&
      photos.photos?.[0]?.length
    ) {
      const photo =
        photos.photos[0][
          photos.photos[0].length - 1
        ];

      return ctx.replyWithPhoto(
        photo.file_id,
        {
          caption:
            `• المالك ↤︎ ${mention(
              owner
            )}\n• النبذة ↤︎ ${escapeHtml(
              bio
            )}`,
          parse_mode: "HTML",
          reply_parameters: {
            message_id:
              ctx.message?.message_id
          }
        }
      );
    }
  } catch {}

  return replyCommand(
    ctx,
    `• المالك ↤︎ ${mention(
      owner
    )}\n• النبذة ↤︎ ${escapeHtml(
      bio
    )}`
  );
}

/* =========================================================
   الألعاب
========================================================= */

function getGames(ctx) {
  const group =
    getGroup(ctx.chat.id);

  group.games ||= {};

  return group.games;
}

async function startAhkam(ctx) {
  if (
    !(await requireLevel(
      ctx,
      7,
      "ما عندك صلاحية تبدأ احكام"
    ))
  ) {
    return;
  }

  const group =
    getGroup(ctx.chat.id);

  if (!group.gamesEnabled) {
    return replyCommand(
      ctx,
      "• الألعاب مقفلة"
    );
  }

  const games =
    getGames(ctx);

  if (games.ahkam) {
    return replyCommand(
      ctx,
      "• فيه لعبة احكام شغالة"
    );
  }

  games.ahkam = {
    starter: ctx.from.id,
    players: [],
    active: true,
    startedAt: Date.now()
  };

  saveData();

  return replyCommand(
    ctx,
    "• بدأت لعبة احكام\n• اللي يبي يدخل يكتب «أنا»"
  );
}

async function joinAhkam(ctx) {
  const games =
    getGames(ctx);

  const game =
    games.ahkam;

  if (!game?.active) {
    return;
  }

  if (
    !game.players.includes(
      ctx.from.id
    )
  ) {
    game.players.push(
      ctx.from.id
    );

    ensureUser(ctx.from);

    saveData();

    return replyCommand(
      ctx,
      `• ${mention(
        ctx.from
      )} دخل احكام`
    );
  }
}

async function finishAhkam(ctx) {
  const games =
    getGames(ctx);

  const game =
    games.ahkam;

  if (!game?.active) {
    return replyCommand(
      ctx,
      "• ما فيه احكام شغالة"
    );
  }

  const level =
    await getLevel(
      ctx,
      ctx.from.id
    );

  if (
    game.starter !==
      ctx.from.id &&
    level < 7
  ) {
    return replyCommand(
      ctx,
      "• فقط صاحب اللعبة أو Dev يقدر ينهي احكام"
    );
  }

  const players =
    game.players || [];

  if (players.length < 2) {
    delete games.ahkam;

    saveData();

    return replyCommand(
      ctx,
      "• انتهت احكام"
    );
  }

  const a =
    players[
      Math.floor(
        Math.random() *
          players.length
      )
    ];

  let b = a;

  while (
    b === a &&
    players.length > 1
  ) {
    b =
      players[
        Math.floor(
          Math.random() *
            players.length
        )
      ];
  }

  delete games.ahkam;

  saveData();

  return replyCommand(
    ctx,
    `• تم اختيار اللاعبين\n• الأول ↤︎${mentionById(
      a
    )}\n• الثاني ↤︎${mentionById(
      b
    )}\n\n• اكتبوا «حكم» أو «سؤال»`
  );
}

async function lockGames(ctx) {
  if (
    !(await requireLevel(
      ctx,
      7,
      "ما عندك صلاحية"
    ))
  ) {
    return;
  }

  const group =
    getGroup(ctx.chat.id);

  group.gamesEnabled =
    false;

  group.games = {};

  saveData();

  return replyCommand(
    ctx,
    "• تم قفل الألعاب"
  );
}

async function unlockGames(ctx) {
  if (
    !(await requireLevel(
      ctx,
      7,
      "ما عندك صلاحية"
    ))
  ) {
    return;
  }

  const group =
    getGroup(ctx.chat.id);

  group.gamesEnabled =
    true;

  saveData();

  return replyCommand(
    ctx,
    "• تم فتح الألعاب"
  );
}

/* =========================================================
   النقاط
========================================================= */

async function showPoints(ctx) {
  ensureUser(ctx.from);

  return replyCommand(
    ctx,
    `• نقاطك ↤︎ ${
      data.users[
        String(ctx.from.id)
      ].points || 0
    }`
  );
}

async function showTop(ctx) {
  const users =
    Object.values(data.users)
      .sort(
        (a, b) =>
          (b.points || 0) -
          (a.points || 0)
      )
      .slice(0, 10);

  if (!users.length) {
    return replyCommand(
      ctx,
      "• ما فيه نقاط"
    );
  }

  const lines = [
    "• المتصدرين",
    "━━━━━━━━━━━"
  ];

  users.forEach(
    (user, index) => {
      lines.push(
        `${index + 1}. ${mention(
          user
        )} ↤︎ ${
          user.points || 0
        }`
      );
    }
  );

  return replyCommand(
    ctx,
    lines.join("\n")
  );
}

/* =========================================================
   تنظيف
========================================================= */

async function cleanMessages(ctx) {
  if (
    !(await requireLevel(
      ctx,
      4,
      "ما عندك صلاحية للتنظيف"
    ))
  ) {
    return;
  }

  const args =
    normalizeText(
      ctx.message.text
    ).split(/\s+/);

  const amount =
    Math.min(
      Math.max(
        parseInt(
          args[1],
          10
        ) || 10,
        1
      ),
      100
    );

  let deleted = 0;

  /*
    تنظيف أرقام:
    يحذف رسائل الأعضاء فقط.
  */
  for (
    let i = 1;
    i <= amount;
    i++
  ) {
    const messageId =
      ctx.message.message_id -
      i;

    try {
      const message =
        await ctx.telegram.forwardMessage(
          ctx.chat.id,
          ctx.chat.id,
          messageId
        );

      /*
        لا نحتاج فعلياً للنسخة،
        فقط نستفيد من الرسالة الأصلية
        إذا كانت متاحة في API.
      */
      if (message?.from) {
        const level =
          getUserLevel(
            message.from.id
          );

        if (level === 0) {
          await safeDelete(
            ctx,
            messageId
          );

          deleted++;
        }

        await safeDelete(
          ctx,
          message.message_id
        );
      }
    } catch {
      /*
        إذا لم نستطع معرفة صاحب الرسالة
        نتركها حتى لا نحذف رسالة صاحب رتبة.
      */
    }
  }

  return replyCommand(
    ctx,
    `• تم تنظيف ${deleted} رسالة من الأعضاء`
  );
}

/* =========================================================
   المخالفات
========================================================= */

async function setViolations(
  ctx,
  enabled
) {
  if (
    !(await requireLevel(
      ctx,
      4,
      "ما عندك صلاحية"
    ))
  ) {
    return;
  }

  const group =
    getGroup(ctx.chat.id);

  group.violationsEnabled =
    enabled;

  saveData();

  return replyCommand(
    ctx,
    `• تم ${
      enabled
        ? "فتح"
        : "قفل"
    } المخالفات`
  );
}

async function setLinks(
  ctx,
  enabled
) {
  if (
    !(await requireLevel(
      ctx,
      4,
      "ما عندك صلاحية"
    ))
  ) {
    return;
  }

  const group =
    getGroup(ctx.chat.id);

  group.linksEnabled =
    enabled;

  saveData();

  return replyCommand(
    ctx,
    `• تم ${
      enabled
        ? "فتح"
        : "قفل"
    } الروابط`
  );
}

/* =========================================================
   ردود البوت
========================================================= */

async function setBotReplies(
  ctx,
  enabled
) {
  if (
    !(await requireLevel(
      ctx,
      3,
      "ما عندك صلاحية"
    ))
  ) {
    return;
  }

  const group =
    getGroup(ctx.chat.id);

  group.botReplies =
    enabled;

  saveData();

  return replyCommand(
    ctx,
    `• تم ${
      enabled
        ? "تفعيل"
        : "تعطيل"
    } ردود البوت`
  );
}

/* =========================================================
   حالة الألعاب
========================================================= */

async function gamesStatus(ctx) {
  const group =
    getGroup(ctx.chat.id);

  return replyCommand(
    ctx,
    `• الألعاب ↤︎ ${
      group.gamesEnabled
        ? "مفتوحة"
        : "مقفلة"
    }`
  );
}

/* =========================================================
   الإحصائيات
========================================================= */

async function showStats(ctx) {
  const group =
    getGroup(ctx.chat.id);

  const users =
    Object.keys(
      group.users || {}
    ).length;

  const messages =
    Object.values(
      data.users
    ).reduce(
      (sum, user) =>
        sum +
        (user.messages || 0),
      0
    );

  return replyCommand(
    ctx,
    `• الإحصائيات\n━━━━━━━━━━━\n• الأعضاء ↤︎ ${users}\n• الرسائل ↤︎ ${messages}`
  );
}

/* =========================================================
   START + الهمسات
========================================================= */

bot.start(
  async ctx => {
    const payload =
      ctx.startPayload;

    ensureUser(ctx.from);
    saveData();

    if (
      payload &&
      payload.startsWith(
        "whisper_"
      )
    ) {
      return showWhisper(
        ctx,
        payload.slice(
          "whisper_".length
        )
      );
    }

    if (
      payload &&
      payload.startsWith(
        "whisperreply_"
      )
    ) {
      return startWhisperReply(
        ctx,
        payload.slice(
          "whisperreply_".length
        )
      );
    }

    return safeReply(
      ctx,
      `• هلا ${mention(
        ctx.from
      )}\n• البوت شغال وجاهز`
    );
  }
);

/* =========================================================
   الرسائل
========================================================= */

bot.on(
  "message",
  async ctx => {
    if (!ctx.from) return;

    ensureUser(ctx.from);

    if (
      ctx.chat?.type ===
      "private"
    ) {
      return;
    }

    const group =
      getGroup(ctx.chat.id);

    const user =
      data.users[
        String(ctx.from.id)
      ];

    user.messages =
      (user.messages || 0) + 1;

    if (
      !group.users[
        String(ctx.from.id)
      ]
    ) {
      group.users[
        String(ctx.from.id)
      ] = {
        id: ctx.from.id,
        username:
          ctx.from.username || "",
        first_name:
          ctx.from.first_name || "",
        messages: 0
      };
    }

    group.users[
      String(ctx.from.id)
    ].messages =
      (group.users[
        String(ctx.from.id)
      ].messages || 0) + 1;

    /*
      تخزين الرسائل لتنظيف الأعضاء
    */
    group.trackedMessages[
      String(ctx.message.message_id)
    ] = {
      message_id:
        ctx.message.message_id,
      user_id:
        ctx.from.id,
      created_at:
        Date.now()
    };

    /*
      الاحتفاظ بعدد معقول
    */
    const trackedKeys =
      Object.keys(
        group.trackedMessages
      );

    if (
      trackedKeys.length > 1000
    ) {
      delete group.trackedMessages[
        trackedKeys[0]
      ];
    }

    saveData();

    /*
      الحماية قبل الأوامر
    */
    if (
      await protection(ctx)
    ) {
      return;
    }

    const text =
      ctx.message.text || "";

    if (!text) return;

    const clean =
      normalizeText(text);

    /* الهمسة */
    if (
      /^(اهمس|همسه|همسة|ه)$/i.test(
        clean
      )
    ) {
      return sendWhisper(ctx);
    }

    /* المالك */
    if (
      /^(المالك|مالك البوت)$/i.test(
        clean
      )
    ) {
      return showOwner(ctx);
    }

    /* صلاحياتي */
    if (
      /^صلاحياتي$/i.test(clean)
    ) {
      return getMyPermissions(
        ctx
      );
    }

    /* صلاحياته */
    if (
      /^صلاحياته$/i.test(clean)
    ) {
      return getTargetPermissions(
        ctx
      );
    }

    /* رفع مشرف */
    if (
      /^(رفع مشرف|رفع مشرف)$/i.test(
        clean
      )
    ) {
      return promoteTarget(ctx);
    }

    /* ترقيه مشرف */
    if (
      /^(ترقية مشرف|ترقيه مشرف|ترقيه المشرف|ترقية المشرف)$/i.test(
        clean
      )
    ) {
      return promoteTarget(ctx);
    }

    /* تنزيل مشرف */
    if (
      /^(تنزيل مشرف|تنزيل المشرف)$/i.test(
        clean
      )
    ) {
      return demoteTarget(ctx);
    }

    /* كتم */
    if (
      /^كتم$/i.test(clean)
    ) {
      return muteTarget(
        ctx,
        false
      );
    }

    /* فك الكتم */
    if (
      /^(فك الكتم|الغاء الكتم|إلغاء الكتم)$/i.test(
        clean
      )
    ) {
      return unmuteTarget(
        ctx,
        false
      );
    }

    /* كتم عام */
    if (
      /^(كتم عام|الكتم العام)$/i.test(
        clean
      )
    ) {
      return muteTarget(
        ctx,
        true
      );
    }

    /* فك الكتم العام */
    if (
      /^(فك الكتم العام|الغاء الكتم العام|إلغاء الكتم العام)$/i.test(
        clean
      )
    ) {
      return unmuteTarget(
        ctx,
        true
      );
    }

    /* حظر */
    if (
      /^(حظر|بلوك)$/i.test(
        clean
      )
    ) {
      return banTarget(ctx);
    }

    /* فك الحظر */
    if (
      /^(فك حظر|فك الحظر|الغاء الحظر)$/i.test(
        clean
      )
    ) {
      return unbanTarget(ctx);
    }

    /* طرد */
    if (
      /^(طرد|اطرد)$/i.test(
        clean
      )
    ) {
      return kickTarget(ctx);
    }

    /* تقييد */
    if (
      /^(تقييد|قيد)$/i.test(
        clean
      )
    ) {
      return restrictTarget(
        ctx
      );
    }

    /* الغاء التقييد */
    if (
      /^(الغاء التقييد|إلغاء التقييد|فك التقييد)$/i.test(
        clean
      )
    ) {
      return unrestrictTarget(
        ctx
      );
    }

    /* تنظيف */
    if (
      /^(تنظيف|مسح)$/i.test(
        clean.split(/\s+/)[0]
      )
    ) {
      return cleanMessages(ctx);
    }

    /* فتح المخالفات */
    if (
      /^(فتح المخالفات|فتح مخالفات)$/i.test(
        clean
      )
    ) {
      return setViolations(
        ctx,
        true
      );
    }

    /* قفل المخالفات */
    if (
      /^(قفل المخالفات|قفل مخالفات)$/i.test(
        clean
      )
    ) {
      return setViolations(
        ctx,
        false
      );
    }

    /* فتح الروابط */
    if (
      /^(فتح الروابط|فتح روابط)$/i.test(
        clean
      )
    ) {
      return setLinks(
        ctx,
        true
      );
    }

    /* قفل الروابط */
    if (
      /^(قفل الروابط|قفل روابط)$/i.test(
        clean
      )
    ) {
      return setLinks(
        ctx,
        false
      );
    }

    /*
      الرتب الداخلية
      كلها Dev🎖️ فقط
    */

    if (
      /^(رفع|ترقية)\s+مميز$/i.test(
        clean
      )
    ) {
      return setInternalRole(
        ctx,
        "مميز"
      );
    }

    if (
      /^(رفع|ترقية)\s+مالك$/i.test(
        clean
      )
    ) {
      return setInternalRole(
        ctx,
        "مالك"
      );
    }

    if (
      /^(رفع|ترقية)\s+مالك\s+أساسي$/i.test(
        clean
      )
    ) {
      return setInternalRole(
        ctx,
        "مالك أساسي"
      );
    }

    if (
      /^(رفع|ترقية)\s+Myth$/i.test(
        clean
      )
    ) {
      return setInternalRole(
        ctx,
        "Myth"
      );
    }

    if (
      /^(رفع|ترقية)\s+Myth🎖️$/i.test(
        clean
      )
    ) {
      return setInternalRole(
        ctx,
        "Myth🎖️"
      );
    }

    if (
      /^(رفع|ترقية)\s+Dev²🎖️$/i.test(
        clean
      )
    ) {
      return setInternalRole(
        ctx,
        "Dev²🎖️"
      );
    }

    if (
      /^(رفع|ترقية)\s+Dev🎖️$/i.test(
        clean
      )
    ) {
      return setInternalRole(
        ctx,
        "Dev🎖️"
      );
    }

    /* تنزيل رتبة */
    if (
      /^(تنزيل|خفض|نزول)$/i.test(
        clean
      )
    ) {
      return removeInternalRole(
        ctx
      );
    }

    /* احكام */
    if (
      /^(احكام|أحكام)$/i.test(
        clean
      )
    ) {
      return startAhkam(ctx);
    }

    /* دخول احكام */
    if (
      /^(أنا|انا)$/i.test(
        clean
      )
    ) {
      return joinAhkam(ctx);
    }

    /* انهاء احكام */
    if (
      /^(انهاء احكام|إنهاء احكام|انهاء أحكام|إنهاء أحكام)$/i.test(
        clean
      )
    ) {
      return finishAhkam(ctx);
    }

    /* قفل الألعاب */
    if (
      /^(قفل الالعاب|قفل الألعاب)$/i.test(
        clean
      )
    ) {
      return lockGames(ctx);
    }

    /* فتح الألعاب */
    if (
      /^(فتح الالعاب|فتح الألعاب)$/i.test(
        clean
      )
    ) {
      return unlockGames(ctx);
    }

    /* الألعاب */
    if (
      /^(الالعاب|الألعاب)$/i.test(
        clean
      )
    ) {
      return gamesStatus(ctx);
    }

    /* النقاط */
    if (
      /^(نقاطي|نقاط)$/i.test(
        clean
      )
    ) {
      return showPoints(ctx);
    }

    /* المتصدرين */
    if (
      /^(المتصدرين|المتصدرون|توب)$/i.test(
        clean
      )
    ) {
      return showTop(ctx);
    }

    /* الإحصائيات */
    if (
      /^(احصائيات|إحصائيات|الاحصائيات|الإحصائيات)$/i.test(
        clean
      )
    ) {
      return showStats(ctx);
    }

    /* فتح ردود البوت */
    if (
      /^(فتح الردود|فتح ردود البوت)$/i.test(
        clean
      )
    ) {
      return setBotReplies(
        ctx,
        true
      );
    }

    /* قفل ردود البوت */
    if (
      /^(قفل الردود|قفل ردود البوت)$/i.test(
        clean
      )
    ) {
      return setBotReplies(
        ctx,
        false
      );
    }

    /* رتبتي */
    if (
      /^(رتبتي|رتبتي؟)$/i.test(
        clean
      )
    ) {
      return replyCommand(
        ctx,
        `• رتبتك ↤︎ ${getRoleName(
          ctx.from.id
        )}`
      );
    }

    /* آيدي */
    if (
      /^(ايدي|آيدي|id)$/i.test(
        clean
      )
    ) {
      return replyCommand(
        ctx,
        `• ايديك ↤︎ <code>${ctx.from.id}</code>`
      );
    }

    /* الأوامر */
    if (
      /^(اوامر|أوامر|الاوامر|الأوامر|مساعدة|مساعده)$/i.test(
        clean
      )
    ) {
      return replyCommand(
        ctx,
        [
          "• أوامر البوت",
          "━━━━━━━━━━━",
          "• اهمس",
          "• المالك",
          "• صلاحياتي",
          "• صلاحياته",
          "• رفع مشرف",
          "• ترقيه مشرف",
          "• تنزيل مشرف",
          "• كتم",
          "• فك الكتم",
          "• كتم عام",
          "• فك الكتم العام",
          "• حظر",
          "• فك الحظر",
          "• طرد",
          "• تقييد",
          "• الغاء التقييد",
          "• تنظيف",
          "• فتح المخالفات",
          "• قفل المخالفات",
          "• فتح الروابط",
          "• قفل الروابط",
          "• احكام",
          "• انهاء احكام",
          "• قفل الألعاب",
          "• فتح الألعاب",
          "• نقاطي",
          "• المتصدرين",
          "• احصائيات"
        ].join("\n")
      );
    }

    /* الأوامر المخصصة */
    const custom =
      group.customCommands[
        clean
      ];

    if (custom) {
      return replyCommand(
        ctx,
        custom
      );
    }

    const customReply =
      group.customReplies[
        clean
      ];

    if (customReply) {
      return replyCommand(
        ctx,
        customReply
      );
    }
  }
);

/* =========================================================
   رسائل الخاص - ردود الهمسات
========================================================= */

bot.on(
  "text",
  async ctx => {
    if (
      ctx.chat?.type !==
      "private"
    ) {
      return;
    }

    if (
      String(
        ctx.message.text || ""
      ).startsWith("/")
    ) {
      return;
    }

    const pending =
      pendingWhisperReplies.get(
        ctx.from.id
      );

    if (!pending) {
      return;
    }

    const whisper =
      whispers.get(
        pending.whisperId
      );

    if (!whisper) {
      pendingWhisperReplies.delete(
        ctx.from.id
      );

      return safeReply(
        ctx,
        "• الهمسة غير موجودة"
      );
    }

    pendingWhisperReplies.delete(
      ctx.from.id
    );

    const replyText =
      ctx.message.text;

    try {
      await ctx.telegram.sendMessage(
        pending.chatId,
        `• رد على الهمسة من ${mention(
          ctx.from
        )}\n• الرد ↤︎ ${escapeHtml(
          replyText
        )}`,
        {
          parse_mode: "HTML",
          reply_parameters: {
            message_id:
              whisper.messageId
          }
        }
      );

      try {
        await ctx.telegram.sendMessage(
          whisper.senderId,
          `• جاءك رد على همستك\n• الرد ↤︎ ${escapeHtml(
            replyText
          )}`,
          {
            parse_mode: "HTML"
          }
        );
      } catch {}

      return safeReply(
        ctx,
        "• تم إرسال ردك"
      );
    } catch (err) {
      console.error(err);

      return safeReply(
        ctx,
        "• ما قدرت أرسل الرد"
      );
    }
  }
);

/* =========================================================
   أخطاء
========================================================= */

bot.catch(
  (err, ctx) => {
    console.error(
      "BOT ERROR:",
      err
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

    bot.botInfo = me;

    console.log(
      `البوت يعمل باسم @${me.username}`
    );

    await bot.launch();

    console.log(
      "البوت اشتغل بنجاح"
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
