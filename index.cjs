const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");

/* =========================================================
   الإعدادات
========================================================= */

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

/* =========================================================
   البيانات
========================================================= */

const DEFAULT_DATA = {
  users: {},
  groups: {},
  subscribers: [],
  botSettings: {
    enabled: true,
    repliesEnabled: true,
    bankEnabled: true,
    communicationEnabled: true,
    mandatorySubscription: false,
    subscriptionChannel: "",
    logChannel: "",
    serviceBot: true,
    statisticsEnabled: true,
    zajelEnabled: true,
    formatsEnabled: true,
    memberTarget: 0,
    channels: {},
    logs: [],
    startedAt: Date.now(),
    messages: 0
  }
};

let data = JSON.parse(JSON.stringify(DEFAULT_DATA));

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

    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    data.users ||= {};
    data.groups ||= {};
    data.subscribers ||= [];
    data.botSettings ||= {};

    const defaults = DEFAULT_DATA.botSettings;

    for (const key of Object.keys(defaults)) {
      if (data.botSettings[key] === undefined) {
        data.botSettings[key] =
          Array.isArray(defaults[key])
            ? []
            : typeof defaults[key] === "object" &&
              defaults[key] !== null
            ? {}
            : defaults[key];
      }
    }

    data.botSettings.channels ||= {};
    data.botSettings.logs ||= [];
    data.botSettings.startedAt ||= Date.now();
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
  return String(text).trim().replace(/\s+/g, " ");
}

function getChatId(ctx) {
  return ctx.chat?.id;
}

function defaultProtection() {
  return {
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
    commands: false,
    forbiddenWords: true,
    english: false,
    contacts: false,
    crossGroupReplies: false
  };
}

function getGroup(chatId) {
  const id = String(chatId);

  if (!data.groups[id]) {
    data.groups[id] = {
      id: chatId,
      title: "",
      username: "",
      type: "",
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
      settings: {},
      protection: defaultProtection()
    };
  }

  const group = data.groups[id];

  group.id ??= chatId;
  group.title ??= "";
  group.username ??= "";
  group.type ??= "";
  group.users ||= {};
  group.muted ||= {};
  group.globalMuted ||= {};
  group.violationsEnabled ??= true;
  group.autoClean ??= false;
  group.linksEnabled ??= false;
  group.groupOpen ??= true;
  group.mentionEnabled ??= true;
  group.forbiddenWords ||= [];
  group.trackedMessages ||= {};
  group.interactions ||= {};
  group.customCommands ||= {};
  group.customReplies ||= {};
  group.marriages ||= {};
  group.gamesEnabled ??= true;
  group.games ||= {};
  group.botReplies ??= true;
  group.musicEnabled ??= true;
  group.adminPermissions ||= {};
  group.settings ||= {};

  group.protection ||= defaultProtection();

  const protectionDefaults = defaultProtection();

  for (const key of Object.keys(protectionDefaults)) {
    if (group.protection[key] === undefined) {
      group.protection[key] = protectionDefaults[key];
    }
  }

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
      bank: 0,
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
  stored.bank ||= 0;
  stored.warnings ||= 0;

  return stored;
}

function getUserLevel(userId) {
  const user = data.users[String(userId)];
  if (!user) return 0;
  return ROLES[user.role] ?? 0;
}

function getRoleName(userId) {
  return data.users[String(userId)]?.role || "عضو";
}

function isDeveloper(user) {
  return !!user &&
    String(user.username || "").toLowerCase() ===
      DEV_USERNAME.toLowerCase();
}

async function isDevAccess(ctx) {
  if (!ctx.from) return false;

  if (isDeveloper(ctx.from)) return true;

  return getUserLevel(ctx.from.id) >= 7;
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

async function getLevel(ctx, userId) {
  const member = await getChatUser(ctx, userId);

  if (member?.status === "creator") return 3;

  if (member?.status === "administrator") {
    const internal = getUserLevel(userId);
    return Math.max(2, internal);
  }

  return getUserLevel(userId);
}

function mention(user) {
  if (!user) return "المستخدم";

  ensureUser(user);

  const stored = data.users[String(user.id)];

  const name =
    user.first_name ||
    user.username ||
    stored?.first_name ||
    "المستخدم";

  const title = stored?.title || "";

  const text = title
    ? `${name}「${title}」`
    : name;

  return `<a href="tg://user?id=${user.id}">${escapeHtml(text)}</a>`;
}

function mentionById(userId) {
  const stored = data.users[String(userId)];

  if (!stored) {
    return `<a href="tg://user?id=${userId}">المستخدم</a>`;
  }

  return mention(stored);
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
   سجل البوت
========================================================= */

function addBotLog(type, text) {
  data.botSettings.logs ||= [];

  data.botSettings.logs.unshift({
    type,
    text,
    time: new Date().toISOString()
  });

  if (data.botSettings.logs.length > 200) {
    data.botSettings.logs =
      data.botSettings.logs.slice(0, 200);
  }

  saveData();
}

async function sendLog(text) {
  addBotLog("BOT", text);

  const channel =
    data.botSettings.logChannel;

  if (!channel) return;

  try {
    await bot.telegram.sendMessage(
      channel,
      `• سجل البوت\n━━━━━━━━━━━\n${text}`,
      { parse_mode: "HTML" }
    );
  } catch (err) {
    console.error(
      "log channel:",
      err.message
    );
  }
}

/* =========================================================
   الصلاحيات
========================================================= */

const PERMISSIONS = [
  ["can_change_info", "تغيير المعلومات"],
  ["can_pin_messages", "تثبيت الرسائل"],
  ["can_manage_topics", "ادارة المواضيع"],
  ["can_invite_users", "اضافه مستخدمين"],
  ["can_delete_messages", "مسح الرسائل"],
  ["can_restrict_members", "حظر المستخدمين"],
  ["can_promote_members", "اضافه المشرفين"]
];

function permissionValue(member, key) {
  if (!member) return false;
  if (member.status === "creator") return true;
  if (member.status !== "administrator") return false;
  return member[key] === true;
}

function formatPermissions(member, self = false) {
  const lines = [
    `• ${self ? "صلاحياتك" : "صلاحياته"} بالإشراف :`,
    "━━━━━━━━━━━"
  ];

  for (const [key, name] of PERMISSIONS) {
    lines.push(
      `• ${name} ↤︎ ${
        permissionValue(member, key)
          ? "نعم"
          : "لا"
      }`
    );
  }

  return lines.join("\n");
}

async function getMyPermissions(ctx) {
  const member =
    await getChatUser(ctx, ctx.from.id);

  if (!member) {
    return replyCommand(
      ctx,
      "• ما قدرت أجيب صلاحياتك"
    );
  }

  return replyCommand(
    ctx,
    formatPermissions(member, true)
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
    await getChatUser(ctx, target.id);

  if (!member) {
    return replyCommand(
      ctx,
      "• ما قدرت أجيب صلاحيات المستخدم"
    );
  }

  return replyCommand(
    ctx,
    formatPermissions(member, false)
  );
}

/* =========================================================
   الحماية
========================================================= */

function containsLink(text = "") {
  return /(https?:\/\/|www\.|t\.me\/|telegram\.me\/|@[a-zA-Z0-9_]{4,})/i.test(text);
}

function containsForbiddenWord(text, group) {
  const lower = String(text || "").toLowerCase();

  return (group.forbiddenWords || []).some(word =>
    lower.includes(String(word).toLowerCase())
  );
}

function hasEnglish(text = "") {
  return /[A-Za-z]/.test(String(text));
}

function hasMention(message) {
  const entities = [
    ...(message?.entities || []),
    ...(message?.caption_entities || [])
  ];

  return entities.some(
    entity =>
      entity.type === "mention" ||
      entity.type === "text_mention"
  );
}

function hasForward(message) {
  if (!message) return false;

  return !!(
    message.forward_origin ||
    message.forward_from ||
    message.forward_from_chat ||
    message.forward_date
  );
}

function hasCrossGroupReply(message) {
  if (!message?.reply_to_message) return false;

  const replied =
    message.reply_to_message;

  return !!(
    replied.forward_origin ||
    replied.forward_from ||
    replied.forward_from_chat
  );
}

function isAdvertisement(text = "") {
  const value = String(text).toLowerCase();

  const patterns = [
    /تابعونا/,
    /اشتركوا/,
    /اعلان/,
    /إعلان/,
    /للبيع/,
    /للتواصل/,
    /تواصل معي/,
    /خصم/,
    /خصومات/,
    /متجر/,
    /قناة/,
    /مسابقة/,
    /رابطنا/,
    /join/,
    /subscribe/,
    /sale/,
    /discount/,
    /promo/
  ];

  return patterns.some(pattern =>
    pattern.test(value)
  );
}

function isSpamMessage(ctx, group) {
  const userId =
    String(ctx.from.id);

  const now = Date.now();

  group.settings.spamTracker ||= {};
  group.settings.spamTracker[userId] ||= [];

  const tracker =
    group.settings.spamTracker[userId];

  const text =
    ctx.message?.text ||
    ctx.message?.caption ||
    ctx.message?.sticker?.file_unique_id ||
    "";

  tracker.push({
    text: String(text).slice(0, 300),
    time: now
  });

  while (
    tracker.length &&
    now - tracker[0].time > 7000
  ) {
    tracker.shift();
  }

  const recent =
    tracker.filter(
      x =>
        now - x.time <= 4000 &&
        x.text === String(text).slice(0, 300)
    );

  return recent.length >= 4;
}

function getViolationReason(ctx, group) {
  const message =
    ctx.message || {};

  const text =
    message.text ||
    message.caption ||
    "";

  const p =
    group.protection;

  if (
    p.links &&
    containsLink(text)
  ) {
    return "روابط";
  }

  if (
    p.ads &&
    isAdvertisement(text)
  ) {
    return "إعلانات";
  }

  if (
    p.mentions &&
    hasMention(message)
  ) {
    return "منشن";
  }

  if (
    p.forwards &&
    hasForward(message)
  ) {
    return "فوروورد";
  }

  if (
    p.crossGroupReplies &&
    hasCrossGroupReply(message)
  ) {
    return "رد من قروب ثاني";
  }

  if (
    p.photos &&
    message.photo
  ) {
    return "صور";
  }

  if (
    p.videos &&
    message.video
  ) {
    return "فيديو";
  }

  if (
    p.documents &&
    message.document
  ) {
    return "ملفات";
  }

  if (
    p.stickers &&
    message.sticker
  ) {
    return "ملصقات";
  }

  if (
    p.gifs &&
    message.animation
  ) {
    return "GIF";
  }

  if (
    p.audio &&
    (message.audio || message.voice || message.video_note)
  ) {
    return "صوتيات";
  }

  if (
    p.contacts &&
    message.contact
  ) {
    return "جهات اتصال";
  }

  if (
    p.commands &&
    typeof message.text === "string" &&
    message.text.trim().startsWith("/")
  ) {
    return "أوامر";
  }

  if (
    p.english &&
    hasEnglish(text)
  ) {
    return "إنجليزي";
  }

  if (
    p.spam &&
    isSpamMessage(ctx, group)
  ) {
    return "تكرار وسبام";
  }

  if (
    p.forbiddenWords &&
    containsForbiddenWord(text, group)
  ) {
    return "كلمات ممنوعة";
  }

  return null;
}

async function sendViolation(ctx, reason) {
  try {
    return await safeReply(
      ctx,
      `• مخالفة\n• العضو ↤︎ ${mention(ctx.from)}\n• السبب ↤︎ ${escapeHtml(reason)}`
    );
  } catch {
    return null;
  }
}

async function protection(ctx) {
  if (!ctx.message || !ctx.chat) return false;

  if (
    ctx.chat.type !== "group" &&
    ctx.chat.type !== "supergroup"
  ) {
    return false;
  }

  const user = ctx.from;

  if (!user) return false;

  ensureUser(user);

  const group =
    getGroup(ctx.chat.id);

  /*
    Dev @j4xa7 لا يتأثر بالحماية
  */
  if (isDeveloper(user)) {
    return false;
  }

  const member =
    await getChatUser(ctx, user.id);

  /*
    المشرفين والمالك لا تطبق عليهم الحماية
  */
  if (
    member?.status === "creator" ||
    member?.status === "administrator"
  ) {
    return false;
  }

  /*
    الكتم
  */
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

  /*
    الحماية مقفلة
  */
  if (
    !group.protection?.enabled ||
    !group.protection?.auto
  ) {
    return false;
  }

  /*
    الحماية للمستخدمين رتبة عضو فقط
  */
  if (getUserLevel(user.id) !== 0) {
    return false;
  }

  const reason =
    getViolationReason(ctx, group);

  if (!reason) {
    return false;
  }

  await safeDelete(
    ctx,
    ctx.message.message_id
  );

  await sendViolation(
    ctx,
    reason
  );

  return true;
}

/* =========================================================
   إعدادات الحماية
========================================================= */

async function requireProtectionAdmin(ctx) {
  const level =
    await getLevel(ctx, ctx.from.id);

  if (level < 4 && !(await isDevAccess(ctx))) {
    await replyCommand(
      ctx,
      "• هذا الأمر يحتاج رتبة Myth🎖️ أو أعلى"
    );
    return false;
  }

  return true;
}

async function setProtection(ctx, enabled) {
  if (!(await requireProtectionAdmin(ctx))) return;

  const group =
    getGroup(ctx.chat.id);

  group.protection.enabled =
    enabled;

  group.violationsEnabled =
    enabled;

  saveData();

  return replyCommand(
    ctx,
    `• تم ${enabled ? "تفعيل" : "تعطيل"} الحماية`
  );
}

async function setProtectionAuto(ctx, enabled) {
  if (!(await requireProtectionAdmin(ctx))) return;

  const group =
    getGroup(ctx.chat.id);

  group.protection.auto =
    enabled;

  saveData();

  return replyCommand(
    ctx,
    `• تم ${enabled ? "تفعيل" : "تعطيل"} الحماية التلقائية`
  );
}

const PROTECTION_NAMES = {
  links: "الروابط",
  edit: "التعديل",
  spam: "التكرار والسبام",
  ads: "الإعلانات",
  mentions: "المنشن",
  forwards: "الفوروورد",
  photos: "الصور",
  videos: "الفيديو",
  documents: "الملفات",
  stickers: "الملصقات",
  gifs: "GIF",
  audio: "الصوتيات",
  commands: "الأوامر",
  forbiddenWords: "الكلمات الممنوعة",
  english: "الإنجليزي",
  contacts: "جهات الاتصال",
  crossGroupReplies: "الردود من قروبات ثانية"
};

async function setProtectionOption(ctx, key, enabled) {
  if (!(await requireProtectionAdmin(ctx))) return;

  const group =
    getGroup(ctx.chat.id);

  if (
    !Object.prototype.hasOwnProperty.call(
      group.protection,
      key
    )
  ) {
    return replyCommand(
      ctx,
      "• إعداد الحماية غير موجود"
    );
  }

  group.protection[key] =
    enabled;

  if (key === "links") {
    group.linksEnabled =
      enabled;
  }

  saveData();

  return replyCommand(
    ctx,
    `• تم ${enabled ? "تفعيل" : "تعطيل"} منع ${PROTECTION_NAMES[key]}`
  );
}

async function protectionStatus(ctx) {
  const group =
    getGroup(ctx.chat.id);

  const p =
    group.protection;

  const lines = [
    "• حالة الحماية",
    "━━━━━━━━━━━",
    `• الحماية ↤︎ ${p.enabled ? "مفعلة" : "معطلة"}`,
    `• الحماية التلقائية ↤︎ ${p.auto ? "مفعلة" : "معطلة"}`,
    ""
  ];

  for (const [key, name] of Object.entries(PROTECTION_NAMES)) {
    lines.push(
      `• ${name} ↤︎ ${
        p[key] ? "ممنوع" : "مسموح"
      }`
    );
  }

  return replyCommand(
    ctx,
    lines.join("\n")
  );
}

async function setViolations(ctx, enabled) {
  return setProtection(ctx, enabled);
}

async function setLinks(ctx, enabled) {
  return setProtectionOption(
    ctx,
    "links",
    enabled
  );
}

/* =========================================================
   الاشتراك الإجباري
========================================================= */

function channelUrl(channel) {
  if (!channel) return null;

  const value = String(channel).trim();

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith("@")) {
    return `https://t.me/${value.slice(1)}`;
  }

  return null;
}

async function checkSubscription(ctx) {
  if (!data.botSettings.mandatorySubscription) {
    return true;
  }

  if (!data.botSettings.subscriptionChannel) {
    return true;
  }

  if (await isDevAccess(ctx)) {
    return true;
  }

  try {
    const member =
      await ctx.telegram.getChatMember(
        data.botSettings.subscriptionChannel,
        ctx.from.id
      );

    if (
      ["creator", "administrator", "member"].includes(
        member.status
      )
    ) {
      return true;
    }
  } catch {}

  const url =
    channelUrl(
      data.botSettings.subscriptionChannel
    );

  const buttons = [];

  if (url) {
    buttons.push([
      Markup.button.url(
        "الاشتراك بالقناة",
        url
      )
    ]);
  }

  buttons.push([
    Markup.button.callback(
      "تحقق من الاشتراك",
      "check_subscription"
    )
  ]);

  await safeReply(
    ctx,
    "• لازم تشترك بالقناة أولاً عشان تستخدم البوت",
    {
      ...Markup.inlineKeyboard(buttons)
    }
  );

  return false;
}

/* =========================================================
   فحص الرتب
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

async function canActOnTarget(ctx, targetId) {
  if (ctx.from.id === targetId) return false;

  const actorMember =
    await getChatUser(
      ctx,
      ctx.from.id
    );

  const targetMember =
    await getChatUser(
      ctx,
      targetId
    );

  if (targetMember?.status === "creator") {
    return false;
  }

  if (
    targetMember?.status === "administrator" &&
    actorMember?.status !== "creator"
  ) {
    return false;
  }

  const actorLevel =
    await getLevel(
      ctx,
      ctx.from.id
    );

  const targetLevel =
    await getLevel(
      ctx,
      targetId
    );

  return actorLevel > targetLevel;
}

async function resolveTarget(ctx) {
  const user =
    ctx.message?.reply_to_message?.from;

  if (!user) return null;

  ensureUser(user);
  return user;
}

/* =========================================================
   الكتم
========================================================= */

async function muteTarget(ctx, global = false) {
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
      group.globalMuted[String(target.id)] = true;
    } else {
      group.muted[String(target.id)] = true;
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
  } catch {
    return replyCommand(
      ctx,
      "• ما قدرت أكتم المستخدم، تأكد من صلاحيات البوت"
    );
  }
}

async function unmuteTarget(ctx, global = false) {
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
          can_invite_users: true
        }
      }
    );

    if (global) {
      delete group.globalMuted[String(target.id)];
    } else {
      delete group.muted[String(target.id)];
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
   مسح المكتومين
========================================================= */

async function clearMuted(ctx, global = false) {
  if (!(await requireLevel(
    ctx,
    2,
    "ما عندك صلاحية"
  ))) return;

  const group =
    getGroup(ctx.chat.id);

  const target =
    global
      ? group.globalMuted
      : group.muted;

  const count =
    Object.keys(target || {}).length;

  if (!count) {
    return replyCommand(
      ctx,
      global
        ? "• لا يوجد مكتومين عام"
        : "• لا يوجد مكتومين"
    );
  }

  if (global) {
    group.globalMuted = {};
  } else {
    group.muted = {};
  }

  saveData();

  return replyCommand(
    ctx,
    global
      ? `• تم مسح ( ${count} ) من المكتومين عام`
      : `• تم مسح ( ${count} ) من المكتومين`
  );
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

    await sendLog(
      `تم حظر ${mention(target)} في ${escapeHtml(
        ctx.chat.title || ""
      )}`
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
      { only_if_banned: true }
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
========================================================= */

async function isDevRank(ctx) {
  return isDevAccess(ctx);
}

async function setInternalRole(ctx, role) {
  const target =
    await resolveTarget(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• رد على رسالة المستخدم أولاً"
    );
  }

  if (!(await isDevRank(ctx))) {
    return replyCommand(
      ctx,
      "• فقط Dev🎖️ يقدر يرقي الرتب"
    );
  }

  const targetMember =
    await getChatUser(
      ctx,
      target.id
    );

  if (targetMember?.status === "creator") {
    return replyCommand(
      ctx,
      "• ما تقدر ترقي مالك المجموعة"
    );
  }

  if (ROLES[role] === undefined) {
    return replyCommand(
      ctx,
      "• الرتبة غير موجودة"
    );
  }

  ensureUser(target);
  data.users[String(target.id)].role = role;
  saveData();

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎${mention(target)}\n• تم رفعه الرتبه`
  );
}

async function removeInternalRole(ctx) {
  const target =
    await resolveTarget(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• رد على رسالة المستخدم أولاً"
    );
  }

  if (!(await isDevRank(ctx))) {
    return replyCommand(
      ctx,
      "• فقط Dev🎖️ يقدر ينزل الرتب"
    );
  }

  ensureUser(target);
  data.users[String(target.id)].role = "عضو";
  saveData();

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎${mention(target)}\n• تم تنزيل رتبته`
  );
}

/* =========================================================
   رفع / تنزيل مشرف
========================================================= */

const PROMOTION_PERMISSIONS = [
  ["can_change_info", "تغيير معلومات المجموعة"],
  ["can_pin_messages", "تثبيت الرسائل"],
  ["can_restrict_members", "حظر المستخدمين"],
  ["can_invite_users", "دعوة المستخدمين"],
  ["can_delete_messages", "مسح الرسائل"],
  ["can_manage_video_chats", "إدارة المكالمات"],
  ["can_promote_members", "اضافة مشرفين"]
];

const pendingPromotions = new Map();

function promotionKey() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

function promotionText(state) {
  const lines = [
    `• حدد الصلاحيات ↦${mention(state.target)}`,
    "━━━━━━━━━━━"
  ];

  for (const [key, name] of PROMOTION_PERMISSIONS) {
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
    let i = 0;
    i < PROMOTION_PERMISSIONS.length;
    i += 2
  ) {
    const row = [];

    for (
      let j = i;
      j < Math.min(
        i + 2,
        PROMOTION_PERMISSIONS.length
      );
      j++
    ) {
      const [key, name] =
        PROMOTION_PERMISSIONS[j];

      row.push(
        Markup.button.callback(
          `${state.permissions[key] ? "🟢" : "⚪"} ${name}`,
          `promset:${state.key}:${key}`
        )
      );
    }

    rows.push(row);
  }

  rows.push([
    Markup.button.callback(
      "🔴 تنفيذ",
      `promdone:${state.key}`
    )
  ]);

  return Markup.inlineKeyboard(rows);
}

async function promoteTarget(ctx) {
  const target =
    await resolveTarget(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• رد على رسالة المستخدم أولاً"
    );
  }

  if (!(await isDevRank(ctx))) {
    return replyCommand(
      ctx,
      "• فقط Dev🎖️ يقدر يرفع مشرف"
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
      "• ما تقدر ترفع مالك المجموعة"
    );
  }

  if (
    targetMember?.status ===
    "administrator"
  ) {
    return replyCommand(
      ctx,
      "• المستخدم مشرف بالفعل"
    );
  }

  const botMember =
    await getChatUser(
      ctx,
      bot.botInfo?.id
    );

  if (
    !botMember ||
    botMember.status !==
      "administrator" ||
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

  pendingPromotions.set(
    key,
    state
  );

  return safeReply(
    ctx,
    promotionText(state),
    {
      ...promotionKeyboard(state)
    }
  );
}

async function demoteTarget(ctx) {
  const target =
    await resolveTarget(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• رد على رسالة المستخدم أولاً"
    );
  }

  if (!(await isDevRank(ctx))) {
    return replyCommand(
      ctx,
      "• فقط Dev🎖️ يقدر ينزل المشرف"
    );
  }

  const member =
    await getChatUser(
      ctx,
      target.id
    );

  if (member?.status === "creator") {
    return replyCommand(
      ctx,
      "• ما تقدر تنزل مالك المجموعة"
    );
  }

  if (member?.status !== "administrator") {
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
        can_manage_topics: false
      }
    );

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎${mention(target)}\n• تم تنزيل رتبته`
    );
  } catch {
    return replyCommand(
      ctx,
      "• ما قدرت أنزل المشرف"
    );
  }
}

/* =========================================================
   الهمسات
========================================================= */

const whispers = new Map();
const pendingWhisperReplies = new Map();

function createWhisper(ctx) {
  const replied =
    ctx.message?.reply_to_message;

  if (!replied) {
    replyCommand(
      ctx,
      "• رد على الرسالة اللي تبي ترسلها همسة"
    );
    return null;
  }

  const id =
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8);

  const content = {
    id,
    chatId: ctx.chat.id,
    senderId: ctx.from.id,
    sender: ctx.from,
    messageId: replied.message_id,
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
  } else if (replied.photo?.length) {
    content.type = "photo";
    content.photo =
      replied.photo.at(-1).file_id;
    content.text =
      replied.caption || "";
  } else if (replied.animation) {
    content.type = "animation";
    content.animation =
      replied.animation.file_id;
    content.text =
      replied.caption || "";
  } else if (replied.video) {
    content.type = "video";
    content.video =
      replied.video.file_id;
    content.text =
      replied.caption || "";
  } else if (replied.voice) {
    content.type = "voice";
    content.voice =
      replied.voice.file_id;
  }

  whispers.set(id, content);
  return id;
}

function getWhisperKeyboard(id) {
  const username =
    bot.botInfo?.username ||
    process.env.BOT_USERNAME;

  if (!username) return null;

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
  const id = createWhisper(ctx);
  if (!id) return;

  const whisper =
    whispers.get(id);

  await safeDelete(
    ctx,
    ctx.message.message_id
  );

  try {
    await ctx.telegram.sendMessage(
      ctx.chat.id,
      `• وصلت همسة من ${mention(whisper.sender)}`,
      {
        parse_mode: "HTML",
        ...(getWhisperKeyboard(id) || {})
      }
    );
  } catch (err) {
    console.error(err);
  }
}

async function showWhisper(ctx, id) {
  const whisper =
    whispers.get(id);

  if (!whisper) {
    return safeReply(
      ctx,
      "• الهمسة غير موجودة أو انتهت"
    );
  }

  try {
    if (whisper.type === "sticker")
      return ctx.replyWithSticker(
        whisper.sticker
      );

    if (whisper.type === "photo")
      return ctx.replyWithPhoto(
        whisper.photo,
        {
          caption:
            whisper.text || undefined,
          parse_mode: "HTML"
        }
      );

    if (whisper.type === "animation")
      return ctx.replyWithAnimation(
        whisper.animation,
        {
          caption:
            whisper.text || undefined,
          parse_mode: "HTML"
        }
      );

    if (whisper.type === "video")
      return ctx.replyWithVideo(
        whisper.video,
        {
          caption:
            whisper.text || undefined,
          parse_mode: "HTML"
        }
      );

    if (whisper.type === "voice")
      return ctx.replyWithVoice(
        whisper.voice
      );

    return safeReply(
      ctx,
      whisper.text || "• همسة فارغة"
    );
  } catch {
    return safeReply(
      ctx,
      "• تعذر عرض الهمسة"
    );
  }
}

async function startWhisperReply(ctx, id) {
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
      senderId: whisper.senderId,
      chatId: whisper.chatId
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

async function getDeveloperProfile(ctx) {
  try {
    const chat =
      await ctx.telegram.getChat(
        `@${DEV_USERNAME}`
      );

    if (chat?.id) {
      return chat;
    }
  } catch {}

  try {
    const admins =
      await ctx.telegram.getChatAdministrators(
        ctx.chat.id
      );

    const found =
      admins.find(
        x =>
          String(x.user.username || "").toLowerCase() ===
          DEV_USERNAME.toLowerCase()
      );

    return found?.user || null;
  } catch {
    return null;
  }
}

async function showOwner(ctx) {
  const owner =
    await getDeveloperProfile(ctx);

  if (!owner) {
    return replyCommand(
      ctx,
      `• المالك ↤︎ @${DEV_USERNAME}`
    );
  }

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
        photos.photos[0].at(-1);

      return ctx.replyWithPhoto(
        photo.file_id,
        {
          caption:
            `• المالك ↤︎ @${DEV_USERNAME}`,
          parse_mode: "HTML"
        }
      );
    }
  } catch (err) {
    console.error(
      "owner photo:",
      err.message
    );
  }

  return replyCommand(
    ctx,
    `• المالك ↤︎ @${DEV_USERNAME}`
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
  ) return;

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
  const game =
    getGames(ctx).ahkam;

  if (!game?.active) return;

  if (!game.players.includes(ctx.from.id)) {
    game.players.push(ctx.from.id);
    ensureUser(ctx.from);
    saveData();

    return replyCommand(
      ctx,
      `• ${mention(ctx.from)} دخل احكام`
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
    game.starter !== ctx.from.id &&
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
        Math.random() * players.length
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
          Math.random() * players.length
        )
      ];
  }

  delete games.ahkam;
  saveData();

  return replyCommand(
    ctx,
    `• تم اختيار اللاعبين\n• الأول ↤︎${mentionById(a)}\n• الثاني ↤︎${mentionById(b)}\n\n• اكتبوا «حكم» أو «سؤال»`
  );
}

async function lockGames(ctx) {
  if (!(await requireLevel(ctx, 7, "ما عندك صلاحية"))) return;

  const group =
    getGroup(ctx.chat.id);

  group.gamesEnabled = false;
  group.games = {};

  saveData();

  return replyCommand(
    ctx,
    "• تم قفل الألعاب"
  );
}

async function unlockGames(ctx) {
  if (!(await requireLevel(ctx, 7, "ما عندك صلاحية"))) return;

  const group =
    getGroup(ctx.chat.id);

  group.gamesEnabled = true;

  saveData();

  return replyCommand(
    ctx,
    "• تم فتح الألعاب"
  );
}

/* =========================================================
   النقاط
========================================================= */

function addPoints(userId, amount) {
  ensureUser({ id: userId });

  data.users[String(userId)].points =
    (data.users[String(userId)].points || 0) +
    amount;
}

async function showPoints(ctx) {
  ensureUser(ctx.from);

  return replyCommand(
    ctx,
    `• نقاطك ↤︎ ${
      data.users[String(ctx.from.id)].points || 0
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

  users.forEach((user, index) => {
    lines.push(
      `${index + 1}. ${mention(user)} ↤︎ ${
        user.points || 0
      }`
    );
  });

  return replyCommand(
    ctx,
    lines.join("\n")
  );
}

/* =========================================================
   التفاعل
========================================================= */

function registerInteraction(ctx) {
  const group =
    getGroup(ctx.chat.id);

  const id =
    String(ctx.from.id);

  group.interactions[id] ||= {
    id: ctx.from.id,
    username: ctx.from.username || "",
    first_name: ctx.from.first_name || "",
    messages: 0
  };

  const item =
    group.interactions[id];

  item.username =
    ctx.from.username || item.username || "";

  item.first_name =
    ctx.from.first_name || item.first_name || "";

  item.messages =
    (item.messages || 0) + 1;

  return item;
}

async function showInteractionTop(ctx) {
  const group =
    getGroup(ctx.chat.id);

  const list =
    Object.values(group.interactions || {})
      .sort(
        (a, b) =>
          (b.messages || 0) -
          (a.messages || 0)
      )
      .slice(0, 20);

  if (!list.length) {
    return replyCommand(
      ctx,
      "• ما فيه تفاعل حتى الآن"
    );
  }

  const lines = [
    "• المتفاعلين",
    "━━━━━━━━━━━"
  ];

  list.forEach((user, index) => {
    lines.push(
      `${index + 1}. ${mentionById(user.id)} ↤︎ ${
        user.messages || 0
      }`
    );
  });

  const myId =
    String(ctx.from.id);

  const all =
    Object.values(group.interactions || {})
      .sort(
        (a, b) =>
          (b.messages || 0) -
          (a.messages || 0)
      );

  const rank =
    all.findIndex(
      x => String(x.id) === myId
    ) + 1;

  const mine =
    group.interactions[myId]?.messages || 0;

  lines.push(
    "",
    `• أنت ↤︎ المركز ${rank || "-"} | التفاعل ${mine}`
  );

  return replyCommand(
    ctx,
    lines.join("\n")
  );
}

/* =========================================================
   تصفير التفاعل
========================================================= */

async function resetInteraction(ctx) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  const group =
    getGroup(ctx.chat.id);

  group.interactions = {};

  saveData();

  return replyCommand(
    ctx,
    "• تم تصفير التفاعل\n• التفاعل الآن يبدأ من الصفر"
  );
}

/* =========================================================
   تنظيف رسائل عضو
========================================================= */

function trackMessageForCleaning(ctx) {
  const group =
    getGroup(ctx.chat.id);

  const userId =
    String(ctx.from.id);

  group.trackedMessages[userId] ||= [];

  const list =
    group.trackedMessages[userId];

  if (!list.includes(ctx.message.message_id)) {
    list.push(ctx.message.message_id);
  }

  if (list.length > 200) {
    group.trackedMessages[userId] =
      list.slice(-200);
  }
}

async function cleanMessages(ctx) {
  if (!(await requireLevel(
    ctx,
    2,
    "ما عندك صلاحية تنظيف"
  ))) return;

  const target =
    await resolveTarget(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• رد على رسالة العضو أولاً"
    );
  }

  ensureUser(target);

  if (
    getUserLevel(target.id) !== 0
  ) {
    return replyCommand(
      ctx,
      "• التنظيف للمستخدمين رتبة عضو فقط"
    );
  }

  const group =
    getGroup(ctx.chat.id);

  const parts =
    normalizeText(
      ctx.message.text || ""
    ).split(/\s+/);

  let amount =
    parseInt(parts[1], 10);

  if (!amount || amount < 1) {
    amount = 50;
  }

  amount =
    Math.min(amount, 100);

  const list =
    group.trackedMessages[String(target.id)] || [];

  if (!list.length) {
    return replyCommand(
      ctx,
      "• لا توجد رسائل مسجلة لهذا العضو"
    );
  }

  const selected =
    list.slice(-amount);

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

  group.trackedMessages[String(target.id)] =
    list.filter(
      id => !selected.includes(id)
    );

  saveData();

  return replyCommand(
    ctx,
    `• تم تنظيف ( ${deleted} ) من رسائل ${mention(target)}`
  );
}

/* =========================================================
   الإحصائيات
========================================================= */

async function showStats(ctx) {
  const group =
    getGroup(ctx.chat.id);

  const users =
    Object.keys(group.users || {}).length;

  const messages =
    Object.values(group.users || {})
      .reduce(
        (sum, user) =>
          sum + (user.messages || 0),
        0
      );

  const interactions =
    Object.values(group.interactions || {})
      .reduce(
        (sum, user) =>
          sum + (user.messages || 0),
        0
      );

  return replyCommand(
    ctx,
    `• إحصائيات القروب\n━━━━━━━━━━━\n• الأعضاء المسجلين ↤︎ ${users}\n• الرسائل ↤︎ ${messages}\n• التفاعل ↤︎ ${interactions}\n• الألعاب ↤︎ ${
      group.gamesEnabled ? "مفتوحة" : "مقفلة"
    }\n• الحماية ↤︎ ${
      group.protection.enabled ? "مفعلة" : "معطلة"
    }`
  );
}

/* =========================================================
   ردود البوت
========================================================= */

async function setBotReplies(ctx, enabled) {
  if (!(await requireLevel(
    ctx,
    4,
    "ما عندك صلاحية"
  ))) return;

  const group =
    getGroup(ctx.chat.id);

  group.botReplies =
    enabled;

  saveData();

  return replyCommand(
    ctx,
    `• تم ${enabled ? "فتح" : "قفل"} ردود البوت في القروب`
  );
}

/* =========================================================
   البنك
========================================================= */

async function bankStatus(ctx) {
  if (!data.botSettings.bankEnabled) {
    return replyCommand(
      ctx,
      "• البنك معطل"
    );
  }

  ensureUser(ctx.from);

  const user =
    data.users[String(ctx.from.id)];

  const money =
    user.money || 0;

  const bank =
    user.bank || 0;

  return replyCommand(
    ctx,
    `• رصيدك ↤︎ ${money}\n• البنك ↤︎ ${bank}\n• العملة ↤︎ افتراضية`
  );
}

async function depositMoney(ctx) {
  if (!data.botSettings.bankEnabled) {
    return replyCommand(ctx, "• البنك معطل");
  }

  ensureUser(ctx.from);

  const amount =
    parseInt(
      normalizeText(
        ctx.message.text
      ).split(/\s+/)[1],
      10
    );

  if (!amount || amount <= 0) {
    return replyCommand(
      ctx,
      "• الاستخدام ↤︎ ايداع 100"
    );
  }

  const user =
    data.users[String(ctx.from.id)];

  if ((user.money || 0) < amount) {
    return replyCommand(
      ctx,
      "• رصيدك ما يكفي"
    );
  }

  user.money -= amount;

  user.bank =
    (user.bank || 0) + amount;

  saveData();

  return replyCommand(
    ctx,
    `• تم إيداع ${amount}\n• رصيد البنك ↤︎ ${user.bank}`
  );
}

async function withdrawMoney(ctx) {
  if (!data.botSettings.bankEnabled) {
    return replyCommand(ctx, "• البنك معطل");
  }

  ensureUser(ctx.from);

  const amount =
    parseInt(
      normalizeText(
        ctx.message.text
      ).split(/\s+/)[1],
      10
    );

  if (!amount || amount <= 0) {
    return replyCommand(
      ctx,
      "• الاستخدام ↤︎ سحب 100"
    );
  }

  const user =
    data.users[String(ctx.from.id)];

  if ((user.bank || 0) < amount) {
    return replyCommand(
      ctx,
      "• رصيد البنك ما يكفي"
    );
  }

  user.bank -= amount;
  user.money =
    (user.money || 0) + amount;

  saveData();

  return replyCommand(
    ctx,
    `• تم سحب ${amount}\n• رصيدك ↤︎ ${user.money}`
  );
}

async function transferMoney(ctx) {
  if (!data.botSettings.bankEnabled) {
    return replyCommand(ctx, "• البنك معطل");
  }

  const target =
    await resolveTarget(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• رد على رسالة الشخص\n• مثال ↤︎ تحويل 100"
    );
  }

  const amount =
    parseInt(
      normalizeText(
        ctx.message.text
      ).split(/\s+/)[1],
      10
    );

  if (!amount || amount <= 0) {
    return replyCommand(
      ctx,
      "• الاستخدام ↤︎ تحويل 100"
    );
  }

  ensureUser(ctx.from);
  ensureUser(target);

  const sender =
    data.users[String(ctx.from.id)];

  if ((sender.money || 0) < amount) {
    return replyCommand(
      ctx,
      "• رصيدك ما يكفي"
    );
  }

  sender.money -= amount;

  data.users[String(target.id)].money =
    (data.users[String(target.id)].money || 0) +
    amount;

  saveData();

  return replyCommand(
    ctx,
    `• تم تحويل ${amount} إلى ${mention(target)}\n• رصيدك ↤︎ ${sender.money}`
  );
}

/* =========================================================
   Dev - الإعدادات
========================================================= */

async function setGlobalReplies(ctx, enabled) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  data.botSettings.repliesEnabled =
    enabled;

  saveData();

  return replyCommand(
    ctx,
    `• تم ${enabled ? "تفعيل" : "تعطيل"} ردود البوت`
  );
}

async function setBank(ctx, enabled) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  data.botSettings.bankEnabled =
    enabled;

  saveData();

  return replyCommand(
    ctx,
    `• تم ${enabled ? "تفعيل" : "تعطيل"} البنك`
  );
}

async function setCommunication(ctx, enabled) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  data.botSettings.communicationEnabled =
    enabled;

  saveData();

  return replyCommand(
    ctx,
    `• تم ${enabled ? "تفعيل" : "تعطيل"} التواصل`
  );
}

async function setMandatorySubscription(ctx, enabled) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  data.botSettings.mandatorySubscription =
    enabled;

  saveData();

  return replyCommand(
    ctx,
    `• تم ${
      enabled ? "تفعيل" : "تعطيل"
    } الاشتراك الإجباري`
  );
}

async function setServiceBot(ctx, enabled) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  data.botSettings.serviceBot =
    enabled;

  saveData();

  return replyCommand(
    ctx,
    `• تم ${
      enabled ? "تفعيل" : "تعطيل"
    } بوت الخدمة`
  );
}

async function setZajel(ctx, enabled) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  data.botSettings.zajelEnabled =
    enabled;

  saveData();

  return replyCommand(
    ctx,
    `• تم ${
      enabled ? "تفعيل" : "تعطيل"
    } الزاجل`
  );
}

async function setFormats(ctx, enabled) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  data.botSettings.formatsEnabled =
    enabled;

  saveData();

  return replyCommand(
    ctx,
    `• تم ${
      enabled ? "تفعيل" : "تعطيل"
    } التنسيقات`
  );
}

async function setMemberTarget(ctx) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  const amount =
    parseInt(
      normalizeText(
        ctx.message.text
      ).split(/\s+/)[1],
      10
    );

  if (!amount || amount < 0) {
    return replyCommand(
      ctx,
      "• الاستخدام ↤︎ تعيين عدد الأعضاء 1000"
    );
  }

  data.botSettings.memberTarget =
    amount;

  saveData();

  return replyCommand(
    ctx,
    `• تم تعيين عدد الأعضاء الافتراضي ↤︎ ${amount}`
  );
}

/* =========================================================
   إدارة البوت
========================================================= */

async function botStatus(ctx) {
  const uptime =
    Math.floor(
      (Date.now() -
        data.botSettings.startedAt) /
        1000
    );

  const hours =
    Math.floor(uptime / 3600);

  const minutes =
    Math.floor(
      (uptime % 3600) / 60
    );

  const seconds =
    uptime % 60;

  return replyCommand(
    ctx,
    `• حالة البوت\n━━━━━━━━━━━\n• الحالة ↤︎ ${
      data.botSettings.enabled
        ? "يعمل"
        : "معطل"
    }\n• الردود ↤︎ ${
      data.botSettings.repliesEnabled
        ? "مفعلة"
        : "معطلة"
    }\n• القروبات ↤︎ ${
      Object.keys(data.groups).length
    }\n• القنوات ↤︎ ${
      Object.keys(data.botSettings.channels || {}).length
    }\n• مدة التشغيل ↤︎ ${hours}س ${minutes}د ${seconds}ث`
  );
}

async function botStatistics(ctx) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  const users =
    Object.keys(data.users).length;

  const groups =
    Object.keys(data.groups).length;

  const channels =
    Object.keys(
      data.botSettings.channels || {}
    ).length;

  const messages =
    Object.values(data.users)
      .reduce(
        (sum, x) =>
          sum + (x.messages || 0),
        0
      );

  return replyCommand(
    ctx,
    `• إحصائيات البوت\n━━━━━━━━━━━\n• المستخدمين ↤︎ ${users}\n• القروبات ↤︎ ${groups}\n• القنوات ↤︎ ${channels}\n• الرسائل ↤︎ ${messages}\n• العدد المعين ↤︎ ${
      data.botSettings.memberTarget || 0
    }`
  );
}

async function botLogs(ctx) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  const logs =
    data.botSettings.logs || [];

  if (!logs.length) {
    return replyCommand(
      ctx,
      "• لا يوجد سجل"
    );
  }

  const lines = [
    "• سجل البوت",
    "━━━━━━━━━━━"
  ];

  logs.slice(0, 20).forEach(log => {
    lines.push(
      `• ${escapeHtml(log.text)}`
    );
  });

  return replyCommand(
    ctx,
    lines.join("\n")
  );
}

async function toggleBot(ctx, enabled) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  data.botSettings.enabled =
    enabled;

  saveData();

  addBotLog(
    "SETTING",
    `تم ${
      enabled ? "تفعيل" : "تعطيل"
    } البوت`
  );

  return replyCommand(
    ctx,
    `• تم ${
      enabled ? "تفعيل" : "تعطيل"
    } البوت`
  );
}

async function restartBot(ctx, update = false) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  saveData();

  await replyCommand(
    ctx,
    update
      ? "• جاري تحديث البوت..."
      : "• جاري إعادة تشغيل البوت..."
  );

  addBotLog(
    "SYSTEM",
    update
      ? "طلب تحديث البوت"
      : "طلب إعادة تشغيل البوت"
  );

  setTimeout(() => {
    process.exit(0);
  }, 1200);
}

/* =========================================================
   إدارة القروبات
========================================================= */

async function addGroupCommand(ctx) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  if (
    ctx.chat.type === "group" ||
    ctx.chat.type === "supergroup"
  ) {
    const group =
      getGroup(ctx.chat.id);

    group.id = ctx.chat.id;
    group.title = ctx.chat.title || "";
    group.username = ctx.chat.username || "";
    group.type = ctx.chat.type;

    saveData();

    return replyCommand(
      ctx,
      `• تم إضافة القروب\n• الاسم ↤︎ ${escapeHtml(ctx.chat.title || "")}\n• الايدي ↤︎ <code>${ctx.chat.id}</code>`
    );
  }

  const id =
    normalizeText(
      ctx.message.text
    ).split(/\s+/)[2];

  if (!id) {
    return replyCommand(
      ctx,
      "• الاستخدام داخل القروب ↤︎ اضافة قروب\n• أو اضافة قروب -100xxxxxxxxxx"
    );
  }

  try {
    const chat =
      await ctx.telegram.getChat(id);

    const group =
      getGroup(chat.id);

    group.id = chat.id;
    group.title = chat.title || "";
    group.username = chat.username || "";
    group.type = chat.type;

    saveData();

    return replyCommand(
      ctx,
      `• تمت إضافة القروب ↤︎ ${escapeHtml(chat.title || "")}`
    );
  } catch {
    return replyCommand(
      ctx,
      "• ما قدرت أضيف القروب"
    );
  }
}

async function deleteGroupCommand(ctx) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  let id = ctx.chat.id;

  const arg =
    normalizeText(
      ctx.message.text
    ).split(/\s+/)[2];

  if (arg) id = arg;

  if (!data.groups[String(id)]) {
    return replyCommand(
      ctx,
      "• القروب غير موجود بالسجل"
    );
  }

  delete data.groups[String(id)];
  saveData();

  return replyCommand(
    ctx,
    `• تم حذف بيانات القروب <code>${id}</code>`
  );
}

async function listGroups(ctx) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  const groups =
    Object.values(data.groups);

  if (!groups.length) {
    return replyCommand(
      ctx,
      "• لا توجد قروبات"
    );
  }

  const lines = [
    "• قائمة القروبات",
    "━━━━━━━━━━━"
  ];

  groups.forEach((g, i) => {
    lines.push(
      `${i + 1}. ${escapeHtml(
        g.title || "بدون اسم"
      )} ↤︎ <code>${g.id}</code>`
    );
  });

  return replyCommand(
    ctx,
    lines.join("\n")
  );
}

/* =========================================================
   إدارة القنوات
========================================================= */

async function addChannel(ctx) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  const value =
    normalizeText(
      ctx.message.text
    ).split(/\s+/)[2];

  if (!value) {
    return replyCommand(
      ctx,
      "• الاستخدام ↤︎ اضافة قناة @channel"
    );
  }

  try {
    const channel =
      await ctx.telegram.getChat(value);

    data.botSettings.channels[String(channel.id)] = {
      id: channel.id,
      title: channel.title || "",
      username: channel.username || "",
      type: channel.type
    };

    saveData();

    return replyCommand(
      ctx,
      `• تمت إضافة القناة ↤︎ ${escapeHtml(
        channel.title || channel.username || ""
      )}`
    );
  } catch {
    return replyCommand(
      ctx,
      "• ما قدرت أضيف القناة، تأكد أن البوت قادر يشوفها"
    );
  }
}

async function deleteChannel(ctx) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  const value =
    normalizeText(
      ctx.message.text
    ).split(/\s+/)[2];

  if (!value) {
    return replyCommand(
      ctx,
      "• الاستخدام ↤︎ حذف قناة @channel"
    );
  }

  const found =
    Object.entries(
      data.botSettings.channels || {}
    ).find(
      ([, channel]) =>
        String(channel.id) === String(value) ||
        String(channel.username || "").toLowerCase() ===
          String(value).toLowerCase()
    );

  if (!found) {
    return replyCommand(
      ctx,
      "• القناة غير موجودة"
    );
  }

  delete data.botSettings.channels[
    found[0]
  ];

  saveData();

  return replyCommand(
    ctx,
    "• تم حذف القناة"
  );
}

async function listChannels(ctx) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  const channels =
    Object.values(
      data.botSettings.channels || {}
    );

  if (!channels.length) {
    return replyCommand(
      ctx,
      "• لا توجد قنوات"
    );
  }

  const lines = [
    "• قائمة القنوات",
    "━━━━━━━━━━━"
  ];

  channels.forEach((c, i) => {
    lines.push(
      `${i + 1}. ${escapeHtml(
        c.title ||
          c.username ||
          "بدون اسم"
      )} ↤︎ <code>${c.id}</code>`
    );
  });

  return replyCommand(
    ctx,
    lines.join("\n")
  );
}

async function setLogChannel(ctx) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  const value =
    normalizeText(
      ctx.message.text
    ).split(/\s+/)[3];

  if (!value) {
    return replyCommand(
      ctx,
      "• الاستخدام ↤︎ تعيين قناة السجل @channel"
    );
  }

  data.botSettings.logChannel =
    value;

  saveData();

  return replyCommand(
    ctx,
    `• تم تعيين قناة السجل ↤︎ ${escapeHtml(value)}`
  );
}

async function setSubscriptionChannel(ctx) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  const value =
    normalizeText(
      ctx.message.text
    ).split(/\s+/)[3];

  if (!value) {
    return replyCommand(
      ctx,
      "• الاستخدام ↤︎ تعيين قناة الاشتراك @channel"
    );
  }

  data.botSettings.subscriptionChannel =
    value;

  saveData();

  return replyCommand(
    ctx,
    `• تم تعيين قناة الاشتراك ↤︎ ${escapeHtml(value)}`
  );
}

/* =========================================================
   تنظيف بيانات القروب
========================================================= */

async function cleanGroupData(ctx) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  const group =
    getGroup(ctx.chat.id);

  group.muted = {};
  group.globalMuted = {};
  group.trackedMessages = {};
  group.interactions = {};
  group.customCommands = {};
  group.customReplies = {};
  group.marriages = {};
  group.games = {};

  saveData();

  return replyCommand(
    ctx,
    "• تم تنظيف بيانات القروب مع إبقاء إعداداته الأساسية"
  );
}

async function deleteGroupData(ctx) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  delete data.groups[String(ctx.chat.id)];

  saveData();

  return replyCommand(
    ctx,
    "• تم مسح بيانات القروب بالكامل"
  );
}

/* =========================================================
   حالة الإعدادات
========================================================= */

async function devSettingsStatus(ctx) {
  if (!(await isDevAccess(ctx))) {
    return replyCommand(
      ctx,
      "• هذا الأمر لـ Dev🎖️ فقط"
    );
  }

  const s =
    data.botSettings;

  return replyCommand(
    ctx,
    `• لوحة Dev\n━━━━━━━━━━━\n• البوت ↤︎ ${
      s.enabled ? "مفعل" : "معطل"
    }\n• الردود ↤︎ ${
      s.repliesEnabled ? "مفعلة" : "معطلة"
    }\n• البنك ↤︎ ${
      s.bankEnabled ? "مفعل" : "معطل"
    }\n• التواصل ↤︎ ${
      s.communicationEnabled ? "مفعل" : "معطل"
    }\n• الاشتراك الإجباري ↤︎ ${
      s.mandatorySubscription ? "مفعل" : "معطل"
    }\n• بوت الخدمة ↤︎ ${
      s.serviceBot ? "مفعل" : "معطل"
    }\n• الإحصائيات ↤︎ ${
      s.statisticsEnabled ? "مفعلة" : "معطلة"
    }\n• الزاجل ↤︎ ${
      s.zajelEnabled ? "مفعل" : "معطل"
    }\n• التنسيقات ↤︎ ${
      s.formatsEnabled ? "مفعلة" : "معطلة"
    }\n• قناة الاشتراك ↤︎ ${
      s.subscriptionChannel || "غير معينة"
    }\n• قناة السجل ↤︎ ${
      s.logChannel || "غير معينة"
    }`
  );
}

/* =========================================================
   القائمة
========================================================= */

async function showCommands(ctx) {
  const dev =
    await isDevAccess(ctx);

  const normal = [
    "• أوامر البوت",
    "━━━━━━━━━━━",
    "• اهمس",
    "• المالك",
    "• صلاحياتي",
    "• صلاحياته",
    "• رفع مشرف",
    "• تنزيل مشرف",
    "• كتم",
    "• فك الكتم",
    "• كتم عام",
    "• فك الكتم العام",
    "• مسح المكتومين",
    "• مسح المكتومين عام",
    "• حظر",
    "• فك الحظر",
    "• طرد",
    "• تقييد",
    "• الغاء التقييد",
    "• تنظيف",
    "• فتح المخالفات",
    "• قفل المخالفات",
    "• حالة الحماية",
    "• تفعيل الحماية",
    "• تعطيل الحماية",
    "• تفعيل الحماية التلقائية",
    "• تعطيل الحماية التلقائية",
    "• فتح الروابط",
    "• قفل الروابط",
    "• احكام",
    "• انهاء احكام",
    "• قفل الألعاب",
    "• فتح الألعاب",
    "• نقاطي",
    "• المتصدرين",
    "• المتفاعلين",
    "• احصائيات",
    "• رصيدي",
    "• البنك",
    "• ايداع",
    "• سحب",
    "• تحويل"
  ];

  if (!dev) {
    return replyCommand(
      ctx,
      normal.join("\n")
    );
  }

  const devCommands = [
    ...normal,
    "",
    "• أوامر Dev🎖️",
    "━━━━━━━━━━━━━━━━",
    "• تفعيل البوت",
    "• تعطيل البوت",
    "• تحديث البوت",
    "• اعادة تشغيل البوت",
    "• حالة البوت",
    "• احصائيات البوت",
    "• سجل البوت",
    "• تنظيف بيانات القروب",
    "• مسح بيانات القروب",
    "• تصفير التفاعل",
    "• تعيين عدد الأعضاء 1000",
    "• تفعيل الردود",
    "• تعطيل الردود",
    "• تفعيل البنك",
    "• تعطيل البنك",
    "• تفعيل التواصل",
    "• تعطيل التواصل",
    "• تفعيل الاشتراك الاجباري",
    "• تعطيل الاشتراك الاجباري",
    "• تعيين قناة الاشتراك @channel",
    "• تفعيل بوت الخدمة",
    "• تعطيل بوت الخدمة",
    "• تفعيل الزاجل",
    "• تعطيل الزاجل",
    "• تفعيل التنسيقات",
    "• تعطيل التنسيقات",
    "• اضافة قروب",
    "• حذف قروب",
    "• قائمة القروبات",
    "• اضافة قناة @channel",
    "• حذف قناة @channel",
    "• قائمة القنوات",
    "• تعيين قناة السجل @channel",
    "• تعيين قناة الاشتراك @channel",
    "• حالة إعدادات Dev",
    "",
    "• أوامر الرتب:",
    "• رفع مميز",
    "• رفع مالك",
    "• رفع مالك أساسي",
    "• رفع Myth",
    "• رفع Myth🎖️",
    "• رفع Dev²🎖️",
    "• رفع Dev🎖️",
    "• تنزيل",
    "• رفع مشرف",
    "• تنزيل مشرف"
  ];

  return replyCommand(
    ctx,
    devCommands.join("\n")
  );
}

/* =========================================================
   START
========================================================= */

bot.start(async ctx => {
  ensureUser(ctx.from);
  saveData();

  const payload =
    ctx.startPayload;

  if (
    payload &&
    payload.startsWith("whisper_")
  ) {
    return showWhisper(
      ctx,
      payload.slice(8)
    );
  }

  if (
    payload &&
    payload.startsWith("whisperreply_")
  ) {
    return startWhisperReply(
      ctx,
      payload.slice(13)
    );
  }

  if (!(await checkSubscription(ctx))) {
    return;
  }

  return safeReply(
    ctx,
    `• هلا ${mention(ctx.from)}\n• البوت شغال وجاهز`
  );
});

/* =========================================================
   Callback
========================================================= */

bot.on("callback_query", async ctx => {
  const value =
    ctx.callbackQuery?.data || "";

  if (value === "check_subscription") {
    const ok =
      await checkSubscription(ctx);

    if (ok) {
      try {
        await ctx.answerCbQuery(
          "تم التحقق"
        );
      } catch {}

      try {
        await ctx.editMessageText(
          "• تم التحقق من اشتراكك، تقدر تستخدم البوت الآن"
        );
      } catch {}
    }

    return;
  }

  if (!value.startsWith("prom")) {
    return;
  }

  const parts =
    value.split(":");

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

  if (!(await isDevRank(ctx))) {
    try {
      await ctx.answerCbQuery(
        "فقط Dev🎖️ يقدر يستخدمه"
      );
    } catch {}
    return;
  }

  if (action === "promset") {
    const permission =
      parts[2];

    if (
      !Object.prototype.hasOwnProperty.call(
        state.permissions,
        permission
      )
    ) return;

    state.permissions[permission] =
      !state.permissions[permission];

    try {
      await ctx.editMessageText(
        promotionText(state),
        {
          parse_mode: "HTML",
          ...promotionKeyboard(state)
        }
      );

      await ctx.answerCbQuery(
        state.permissions[permission]
          ? "تم التفعيل"
          : "تم الإلغاء"
      );
    } catch {}

    return;
  }

  if (action === "promdone") {
    try {
      const botMember =
        await ctx.telegram.getChatMember(
          state.chatId,
          bot.botInfo.id
        );

      if (
        botMember.status !==
          "administrator" ||
        !botMember.can_promote_members
      ) {
        await ctx.answerCbQuery(
          "البوت ما عنده صلاحية"
        );
        return;
      }

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
          "ما تقدر ترفع المالك"
        );
        return;
      }

      if (
        targetMember.status ===
        "administrator"
      ) {
        await ctx.answerCbQuery(
          "المستخدم مشرف بالفعل"
        );
        return;
      }

      await ctx.telegram.promoteChatMember(
        state.chatId,
        state.targetId,
        {
          is_anonymous: false,
          can_manage_chat: false,
          can_change_info:
            state.permissions.can_change_info,
          can_post_messages: false,
          can_edit_messages: false,
          can_delete_messages:
            state.permissions.can_delete_messages,
          can_invite_users:
            state.permissions.can_invite_users,
          can_restrict_members:
            state.permissions.can_restrict_members,
          can_pin_messages:
            state.permissions.can_pin_messages,
          can_promote_members:
            state.permissions.can_promote_members,
          can_manage_video_chats:
            state.permissions.can_manage_video_chats,
          can_manage_topics: false
        }
      );

      pendingPromotions.delete(key);

      try {
        await ctx.deleteMessage();
      } catch {}

      await ctx.telegram.sendMessage(
        state.chatId,
        `• المستخدم ذا ↤︎${mention(state.target)}\n• تم رفعه الرتبه`,
        {
          parse_mode: "HTML"
        }
      );

      await ctx.answerCbQuery(
        "تم رفعه مشرف"
      );
    } catch (err) {
      console.error(
        "promotion:",
        err
      );

      try {
        await ctx.answerCbQuery(
          "ما قدرت أرفع المشرف"
        );
      } catch {}
    }
  }
});

/* =========================================================
   رسائل المجموعة
========================================================= */

bot.on("message", async ctx => {
  if (!ctx.from) return;

  ensureUser(ctx.from);

  if (ctx.chat?.type === "private") {
    return;
  }

  const group =
    getGroup(ctx.chat.id);

  group.id = ctx.chat.id;
  group.title =
    ctx.chat.title || group.title || "";
  group.username =
    ctx.chat.username || group.username || "";
  group.type =
    ctx.chat.type || group.type || "";

  const user =
    data.users[String(ctx.from.id)];

  user.messages =
    (user.messages || 0) + 1;

  if (!group.users[String(ctx.from.id)]) {
    group.users[String(ctx.from.id)] = {
      id: ctx.from.id,
      username:
        ctx.from.username || "",
      first_name:
        ctx.from.first_name || "",
      messages: 0
    };
  }

  group.users[String(ctx.from.id)].messages =
    (group.users[String(ctx.from.id)].messages || 0) + 1;

  registerInteraction(ctx);

  trackMessageForCleaning(ctx);

  data.botSettings.messages =
    (data.botSettings.messages || 0) + 1;

  saveData();

  const text =
    ctx.message.text || "";

  const clean =
    normalizeText(text);

  if (
    !data.botSettings.enabled &&
    !(await isDevAccess(ctx))
  ) {
    return;
  }

  if (
    await protection(ctx)
  ) {
    return;
  }

  if (!clean) return;

  /* الهمسة */
  if (/^(اهمس|همسه|همسة|ه)$/i.test(clean)) {
    return sendWhisper(ctx);
  }

  /* المالك */
  if (/^(المالك|مالك البوت)$/i.test(clean)) {
    return showOwner(ctx);
  }

  /* الصلاحيات */
  if (/^صلاحياتي$/i.test(clean)) {
    return getMyPermissions(ctx);
  }

  if (/^صلاحياته$/i.test(clean)) {
    return getTargetPermissions(ctx);
  }

  /* المشرف */
  if (/^رفع مشرف$/i.test(clean)) {
    return promoteTarget(ctx);
  }

  if (/^(تنزيل مشرف|تنزيل المشرف)$/i.test(clean)) {
    return demoteTarget(ctx);
  }

  /* الكتم */
  if (/^كتم$/i.test(clean)) {
    return muteTarget(ctx, false);
  }

  if (/^(فك الكتم|الغاء الكتم|إلغاء الكتم)$/i.test(clean)) {
    return unmuteTarget(ctx, false);
  }

  if (/^(كتم عام|الكتم العام)$/i.test(clean)) {
    return muteTarget(ctx, true);
  }

  if (/^(فك الكتم العام|الغاء الكتم العام|إلغاء الكتم العام)$/i.test(clean)) {
    return unmuteTarget(ctx, true);
  }

  /* مسح المكتومين */
  if (/^(مسح المكتومين|مم)$/i.test(clean)) {
    return clearMuted(ctx, false);
  }

  if (/^(مسح المكتومين عام|خخ)$/i.test(clean)) {
    return clearMuted(ctx, true);
  }

  /* الحظر */
  if (/^(حظر|بلوك)$/i.test(clean)) {
    return banTarget(ctx);
  }

  if (/^(فك حظر|فك الحظر|الغاء الحظر)$/i.test(clean)) {
    return unbanTarget(ctx);
  }

  /* الطرد */
  if (/^(طرد|اطرد)$/i.test(clean)) {
    return kickTarget(ctx);
  }

  /* التقييد */
  if (/^(تقييد|قيد)$/i.test(clean)) {
    return restrictTarget(ctx);
  }

  if (/^(الغاء التقييد|إلغاء التقييد|فك التقييد)$/i.test(clean)) {
    return unrestrictTarget(ctx);
  }

  /* التنظيف */
  if (/^(تنظيف|مسح)(\s+\d+)?$/i.test(clean)) {
    return cleanMessages(ctx);
  }

  /* الحماية */
  if (/^تفعيل الحماية$/i.test(clean)) {
    return setProtection(ctx, true);
  }

  if (/^تعطيل الحماية$/i.test(clean)) {
    return setProtection(ctx, false);
  }

  if (/^حالة الحماية$/i.test(clean)) {
    return protectionStatus(ctx);
  }

  if (/^تفعيل الحماية التلقائية$/i.test(clean)) {
    return setProtectionAuto(ctx, true);
  }

  if (/^تعطيل الحماية التلقائية$/i.test(clean)) {
    return setProtectionAuto(ctx, false);
  }

  /* المخالفات */
  if (/^(فتح المخالفات|فتح مخالفات)$/i.test(clean)) {
    return setViolations(ctx, true);
  }

  if (/^(قفل المخالفات|قفل مخالفات)$/i.test(clean)) {
    return setViolations(ctx, false);
  }

  if (/^(فتح الروابط|فتح روابط)$/i.test(clean)) {
    return setLinks(ctx, true);
  }

  if (/^(قفل الروابط|قفل روابط)$/i.test(clean)) {
    return setLinks(ctx, false);
  }

  /* إعدادات الحماية التفصيلية */
  const protectionCommands = [
    ["منع التعديل", "edit"],
    ["السماح بالتعديل", "edit"],
    ["منع السبام", "spam"],
    ["السماح بالسبام", "spam"],
    ["منع التكرار", "spam"],
    ["السماح بالتكرار", "spam"],
    ["منع الإعلانات", "ads"],
    ["السماح بالإعلانات", "ads"],
    ["منع المنشن", "mentions"],
    ["السماح بالمنشن", "mentions"],
    ["منع الفوروورد", "forwards"],
    ["السماح بالفوروورد", "forwards"],
    ["منع الصور", "photos"],
    ["السماح بالصور", "photos"],
    ["منع الفيديو", "videos"],
    ["السماح بالفيديو", "videos"],
    ["منع الملفات", "documents"],
    ["السماح بالملفات", "documents"],
    ["منع الملصقات", "stickers"],
    ["السماح بالملصقات", "stickers"],
    ["منع GIF", "gifs"],
    ["السماح بـ GIF", "gifs"],
    ["منع الصوتيات", "audio"],
    ["السماح بالصوتيات", "audio"],
    ["منع الأوامر", "commands"],
    ["السماح بالأوامر", "commands"],
    ["منع الإنجليزي", "english"],
    ["السماح بالإنجليزي", "english"],
    ["منع جهات الاتصال", "contacts"],
    ["السماح بجهات الاتصال", "contacts"],
    ["منع الردود من قروبات ثانية", "crossGroupReplies"],
    ["السماح بالردود من قروبات ثانية", "crossGroupReplies"]
  ];

  for (const [command, key] of protectionCommands) {
    if (clean === command) {
      const enabled =
        command.startsWith("منع");

      return setProtectionOption(
        ctx,
        key,
        enabled
      );
    }
  }

  /* الرتب */
  if (/^(رفع|ترقية)\s+مميز$/i.test(clean))
    return setInternalRole(ctx, "مميز");

  if (/^(رفع|ترقية)\s+مالك$/i.test(clean))
    return setInternalRole(ctx, "مالك");

  if (/^(رفع|ترقية)\s+مالك\s+أساسي$/i.test(clean))
    return setInternalRole(ctx, "مالك أساسي");

  if (/^(رفع|ترقية)\s+Myth$/i.test(clean))
    return setInternalRole(ctx, "Myth");

  if (/^(رفع|ترقية)\s+Myth🎖️$/i.test(clean))
    return setInternalRole(ctx, "Myth🎖️");

  if (/^(رفع|ترقية)\s+Dev²🎖️$/i.test(clean))
    return setInternalRole(ctx, "Dev²🎖️");

  if (/^(رفع|ترقية)\s+Dev🎖️$/i.test(clean))
    return setInternalRole(ctx, "Dev🎖️");

  if (/^(تنزيل|خفض|نزول)$/i.test(clean))
    return removeInternalRole(ctx);

  /* الألعاب */
  if (/^(احكام|أحكام)$/i.test(clean))
    return startAhkam(ctx);

  if (/^(أنا|انا)$/i.test(clean))
    return joinAhkam(ctx);

  if (/^(انهاء احكام|إنهاء احكام|انهاء أحكام|إنهاء أحكام)$/i.test(clean))
    return finishAhkam(ctx);

  if (/^(قفل الالعاب|قفل الألعاب)$/i.test(clean))
    return lockGames(ctx);

  if (/^(فتح الالعاب|فتح الألعاب)$/i.test(clean))
    return unlockGames(ctx);

  if (/^(الالعاب|الألعاب)$/i.test(clean))
    return replyCommand(
      ctx,
      `• الألعاب ↤︎ ${
        group.gamesEnabled
          ? "مفتوحة"
          : "مقفلة"
      }`
    );

  /* النقاط */
  if (/^(نقاطي|نقاط)$/i.test(clean))
    return showPoints(ctx);

  if (/^(المتصدرين|المتصدرون|توب)$/i.test(clean))
    return showTop(ctx);

  /* التفاعل */
  if (/^تصفير التفاعل$/i.test(clean)) {
    return resetInteraction(ctx);
  }

  if (
    /^(المتفاعلين|المتفاعلون|توب 20|توب20|توب٢٠)$/i.test(clean)
  ) {
    return showInteractionTop(ctx);
  }

  /* الإحصائيات */
  if (/^(احصائيات|إحصائيات|الاحصائيات|الإحصائيات)$/i.test(clean))
    return showStats(ctx);

  /* الردود */
  if (/^(فتح الردود|فتح ردود البوت)$/i.test(clean))
    return setBotReplies(ctx, true);

  if (/^(قفل الردود|قفل ردود البوت)$/i.test(clean))
    return setBotReplies(ctx, false);

  /* البنك */
  if (/^(رصيدي|فلوسي|البنك)$/i.test(clean))
    return bankStatus(ctx);

  if (/^ايداع\s+\d+$/i.test(clean))
    return depositMoney(ctx);

  if (/^سحب\s+\d+$/i.test(clean))
    return withdrawMoney(ctx);

  if (/^تحويل\s+\d+$/i.test(clean))
    return transferMoney(ctx);

  /* =====================================================
     أوامر Dev
  ===================================================== */

  if (/^تفعيل البوت$/i.test(clean))
    return toggleBot(ctx, true);

  if (/^تعطيل البوت$/i.test(clean))
    return toggleBot(ctx, false);

  if (/^تحديث البوت$/i.test(clean))
    return restartBot(ctx, true);

  if (/^(اعادة تشغيل البوت|إعادة تشغيل البوت)$/i.test(clean))
    return restartBot(ctx, false);

  if (/^حالة البوت$/i.test(clean))
    return botStatus(ctx);

  if (/^احصائيات البوت$/i.test(clean))
    return botStatistics(ctx);

  if (/^سجل البوت$/i.test(clean))
    return botLogs(ctx);

  if (/^تنظيف بيانات القروب$/i.test(clean))
    return cleanGroupData(ctx);

  if (/^مسح بيانات القروب$/i.test(clean))
    return deleteGroupData(ctx);

  if (/^تصفير التفاعل$/i.test(clean))
    return resetInteraction(ctx);

  if (/^تعيين عدد الأعضاء\s+\d+$/i.test(clean))
    return setMemberTarget(ctx);

  if (/^تفعيل الردود$/i.test(clean))
    return setGlobalReplies(ctx, true);

  if (/^تعطيل الردود$/i.test(clean))
    return setGlobalReplies(ctx, false);

  if (/^تفعيل البنك$/i.test(clean))
    return setBank(ctx, true);

  if (/^تعطيل البنك$/i.test(clean))
    return setBank(ctx, false);

  if (/^تفعيل التواصل$/i.test(clean))
    return setCommunication(ctx, true);

  if (/^تعطيل التواصل$/i.test(clean))
    return setCommunication(ctx, false);

  if (/^تفعيل الاشتراك الاجباري$/i.test(clean))
    return setMandatorySubscription(ctx, true);

  if (/^تعطيل الاشتراك الاجباري$/i.test(clean))
    return setMandatorySubscription(ctx, false);

  if (/^تفعيل بوت الخدمة$/i.test(clean))
    return setServiceBot(ctx, true);

  if (/^تعطيل بوت الخدمة$/i.test(clean))
    return setServiceBot(ctx, false);

  if (/^تفعيل الزاجل$/i.test(clean))
    return setZajel(ctx, true);

  if (/^تعطيل الزاجل$/i.test(clean))
    return setZajel(ctx, false);

  if (/^تفعيل التنسيقات$/i.test(clean))
    return setFormats(ctx, true);

  if (/^تعطيل التنسيقات$/i.test(clean))
    return setFormats(ctx, false);

  if (/^اضافة قروب$/i.test(clean))
    return addGroupCommand(ctx);

  if (/^حذف قروب$/i.test(clean))
    return deleteGroupCommand(ctx);

  if (/^(قائمة القروبات|القروبات)$/i.test(clean))
    return listGroups(ctx);

  if (/^اضافة قناة\s+/i.test(clean))
    return addChannel(ctx);

  if (/^حذف قناة\s+/i.test(clean))
    return deleteChannel(ctx);

  if (/^(قائمة القنوات|القنوات)$/i.test(clean))
    return listChannels(ctx);

  if (/^تعيين قناة السجل\s+/i.test(clean))
    return setLogChannel(ctx);

  if (/^تعيين قناة الاشتراك\s+/i.test(clean))
    return setSubscriptionChannel(ctx);

  if (/^(حالة إعدادات Dev|اعدادات Dev|إعدادات Dev)$/i.test(clean))
    return devSettingsStatus(ctx);

  /* الرتبة */
  if (/^(رتبتي|رتبتي؟)$/i.test(clean)) {
    return replyCommand(
      ctx,
      `• رتبتك ↤︎ ${getRoleName(ctx.from.id)}`
    );
  }

  if (/^(ايدي|آيدي|id)$/i.test(clean)) {
    return replyCommand(
      ctx,
      `• ايديك ↤︎ <code>${ctx.from.id}</code>`
    );
  }

  /* الأوامر */
  if (
    /^(اوامر|أوامر|الاوامر|الأوامر|مساعدة|مساعده)$/i.test(clean)
  ) {
    return showCommands(ctx);
  }

  /* أوامر مخصصة */
  if (data.botSettings.repliesEnabled && group.botReplies) {
    const custom =
      group.customCommands[clean];

    if (custom) {
      return replyCommand(
        ctx,
        custom
      );
    }

    const reply =
      group.customReplies[clean];

    if (reply) {
      return replyCommand(
        ctx,
        reply
      );
    }
  }
});

/* =========================================================
   الرسائل الخاصة
========================================================= */

bot.on("text", async ctx => {
  if (ctx.chat?.type !== "private") {
    return;
  }

  ensureUser(ctx.from);

  if (!(await checkSubscription(ctx))) {
    return;
  }

  const text =
    normalizeText(
      ctx.message.text || ""
    );

  if (text.startsWith("/")) {
    return;
  }

  const pending =
    pendingWhisperReplies.get(
      ctx.from.id
    );

  if (!pending) {
    if (
      data.botSettings.communicationEnabled &&
      /^تواصل$/i.test(text)
    ) {
      return safeReply(
        ctx,
        "• أرسل رسالتك للتواصل مع المالك"
      );
    }

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

  try {
    await ctx.telegram.sendMessage(
      pending.chatId,
      `• رد على الهمسة من ${mention(ctx.from)}\n• الرد ↤︎ ${escapeHtml(ctx.message.text)}`,
      {
        parse_mode: "HTML"
      }
    );

    try {
      await ctx.telegram.sendMessage(
        whisper.senderId,
        `• جاءك رد على همستك\n• الرد ↤︎ ${escapeHtml(ctx.message.text)}`,
        {
          parse_mode: "HTML"
        }
      );
    } catch {}

    return safeReply(
      ctx,
      "• تم إرسال ردك"
    );
  } catch {
    return safeReply(
      ctx,
      "• ما قدرت أرسل الرد"
    );
  }
});

/* =========================================================
   القنوات
========================================================= */

bot.on("channel_post", async ctx => {
  try {
    const chat = ctx.chat;

    if (!chat) return;

    data.botSettings.channels[String(chat.id)] ||= {
      id: chat.id,
      title: chat.title || "",
      username: chat.username || "",
      type: chat.type
    };

    data.botSettings.channels[String(chat.id)].title =
      chat.title || "";

    data.botSettings.channels[String(chat.id)].username =
      chat.username || "";

    saveData();

    data.botSettings.messages =
      (data.botSettings.messages || 0) + 1;

    saveData();
  } catch (err) {
    console.error(
      "channel_post:",
      err.message
    );
  }
});

/* =========================================================
   تحديث معلومات القروب تلقائياً
========================================================= */

bot.on("my_chat_member", async ctx => {
  try {
    const chat =
      ctx.chat;

    if (
      chat.type === "group" ||
      chat.type === "supergroup"
    ) {
      const group =
        getGroup(chat.id);

      group.id = chat.id;
      group.title =
        chat.title || "";
      group.username =
        chat.username || "";
      group.type =
        chat.type;

      saveData();
    }
  } catch {}
});

/* =========================================================
   خطأ
========================================================= */

bot.catch((err, ctx) => {
  console.error(
    "BOT ERROR:",
    err
  );
});

/* =========================================================
   التشغيل
========================================================= */

(async () => {
  try {
    const me =
      await bot.telegram.getMe();

    bot.botInfo = me;

    data.botSettings.startedAt =
      Date.now();

    saveData();

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
