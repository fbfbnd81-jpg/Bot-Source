// ============================================================
// EIF BOT - index.cjs
// Node.js + Telegraf + MongoDB
// ============================================================

const { Telegraf, Markup } = require("telegraf");
const mongoose = require("mongoose");
const crypto = require("crypto");

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URL = process.env.MONGO_URL;

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN غير موجود في Secrets");
  process.exit(1);
}

if (!MONGO_URL) {
  console.error("MONGO_URL غير موجود في Secrets");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const OWNER_USERNAME = "j4xa7";

// ============================================================
// DATABASE
// ============================================================

mongoose.connect(MONGO_URL)
  .then(() => console.log("تم الاتصال بقاعدة البيانات بنجاح"))
  .catch(err => {
    console.error("فشل الاتصال بقاعدة البيانات:", err);
    process.exit(1);
  });

// ============================================================
// SCHEMAS
// ============================================================

const userSchema = new mongoose.Schema({
  userId: { type: Number, unique: true, index: true },
  username: String,
  firstName: String,

  balance: { type: Number, default: 0 },

  gamesPlayed: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  correctAnswers: { type: Number, default: 0 },
  bestSpeed: { type: Number, default: 99999 },

  bank: {
    name: { type: String, default: null },
    accountNumber: { type: String, default: null },
    active: { type: Boolean, default: false }
  },

  subscribers: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);

const rankSchema = new mongoose.Schema({
  userId: Number,
  chatId: Number,
  rank: { type: String, default: "عضو" }
});

rankSchema.index({ userId: 1, chatId: 1 }, { unique: true });

const Rank = mongoose.model("Rank", rankSchema);

const titleSchema = new mongoose.Schema({
  userId: Number,
  chatId: Number,
  title: String
});

titleSchema.index({ userId: 1, chatId: 1 }, { unique: true });

const Title = mongoose.model("Title", titleSchema);

const channelSchema = new mongoose.Schema({
  userId: Number,
  chatId: Number,
  channelUrl: String
});

channelSchema.index({ userId: 1, chatId: 1 }, { unique: true });

const Channel = mongoose.model("Channel", channelSchema);

const customCommandSchema = new mongoose.Schema({
  chatId: Number,
  type: { type: String, enum: ["cmd", "reply"] },
  key: String,
  value: String,
  createdBy: Number,
  createdAt: { type: Date, default: Date.now }
});

customCommandSchema.index({ chatId: 1, type: 1, key: 1 }, { unique: true });

const CustomCommand = mongoose.model(
  "CustomCommand",
  customCommandSchema
);

const bannedWordSchema = new mongoose.Schema({
  chatId: Number,
  word: String,
  createdBy: Number,
  createdAt: { type: Date, default: Date.now }
});

bannedWordSchema.index({ chatId: 1, word: 1 }, { unique: true });

const BannedWord = mongoose.model(
  "BannedWord",
  bannedWordSchema
);

const groupSettingsSchema = new mongoose.Schema({
  chatId: { type: Number, unique: true },

  allMention: { type: Boolean, default: true },

  gamesLocked: { type: Boolean, default: false },

  protectionLocked: { type: Boolean, default: false },

  musicEnabled: { type: Boolean, default: true },

  gameActive: { type: Boolean, default: false },

  marriageEnabled: { type: Boolean, default: true }
});

const GroupSettings = mongoose.model(
  "GroupSettings",
  groupSettingsSchema
);

const interactionSchema = new mongoose.Schema({
  userId: Number,
  chatId: Number,

  messages: { type: Number, default: 0 },
  points: { type: Number, default: 0 }
});

interactionSchema.index({ userId: 1, chatId: 1 }, { unique: true });

const Interaction = mongoose.model(
  "Interaction",
  interactionSchema
);

const marriageSchema = new mongoose.Schema({
  chatId: Number,

  husbandId: Number,
  husbandUsername: String,

  wives: [{
    slot: Number,
    userId: Number,
    username: String,
    firstName: String,
    dowry: Number,
    date: Date
  }]
});

marriageSchema.index({ chatId: 1, husbandId: 1 }, { unique: true });

const Marriage = mongoose.model(
  "Marriage",
  marriageSchema
);

const transferSchema = new mongoose.Schema({
  from: Number,
  to: Number,
  amount: Number,
  date: { type: Date, default: Date.now }
});

const Transfer = mongoose.model(
  "Transfer",
  transferSchema
);

const whisperSchema = new mongoose.Schema({
  whisperId: { type: String, unique: true },

  chatId: Number,

  senderId: Number,
  receiverId: Number,

  type: {
    type: String,
    enum: ["text", "photo", "sticker", "animation", "video"]
  },

  text: String,
  caption: String,
  fileId: String,

  status: {
    type: String,
    default: "pending"
  },

  parentId: {
    type: String,
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Whisper = mongoose.model(
  "Whisper",
  whisperSchema
);

// ============================================================
// RANKS
// ============================================================

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

const RANK_NAMES = [
  "مميز",
  "مالك",
  "مالك أساسي",
  "Myth",
  "Myth 🎖️",
  "Dev²🎖️",
  "Dev🎖️"
];

function rankLevel(rank) {
  return RANKS[rank] ?? 0;
}

async function getUserRank(userId, chatId) {
  const globalDev = await Rank.findOne({
    userId,
    rank: "Dev🎖️"
  });

  if (globalDev) return "Dev🎖️";

  const rank = await Rank.findOne({
    userId,
    chatId
  });

  return rank ? rank.rank : "عضو";
}

async function hasRank(userId, chatId, required) {
  const rank = await getUserRank(userId, chatId);
  return rankLevel(rank) >= rankLevel(required);
}

function rankError(rank) {
  return `• هذا الامر يخص ↤ ｢ ${rank} ｣`;
}

// ============================================================
// USERS
// ============================================================

async function ensureUser(user) {
  if (!user) return null;

  return User.findOneAndUpdate(
    { userId: user.id },
    {
      username: user.username,
      firstName: user.first_name
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );
}

// ============================================================
// GROUP SETTINGS
// ============================================================

async function getSettings(chatId) {
  let settings = await GroupSettings.findOne({ chatId });

  if (!settings) {
    settings = await GroupSettings.create({
      chatId,
      allMention: true,
      gamesLocked: false,
      protectionLocked: false,
      musicEnabled: true
    });
  }

  return settings;
}

// ============================================================
// TRACK USERS WHO APPEAR IN THE GROUP
// ============================================================

const knownGroupMembers = new Map();

function rememberMember(chatId, user) {
  if (!user) return;

  if (!knownGroupMembers.has(chatId)) {
    knownGroupMembers.set(chatId, new Map());
  }

  knownGroupMembers
    .get(chatId)
    .set(user.id, {
      id: user.id,
      username: user.username,
      firstName: user.first_name
    });
}

// ============================================================
// GENERAL MIDDLEWARE
// ============================================================

bot.use(async (ctx, next) => {
  try {
    if (ctx.from) {
      await ensureUser(ctx.from);
    }

    if (ctx.chat && ctx.chat.type !== "private") {
      rememberMember(ctx.chat.id, ctx.from);

      if (ctx.message?.reply_to_message?.from) {
        rememberMember(
          ctx.chat.id,
          ctx.message.reply_to_message.from
        );
      }

      if (ctx.message?.text) {
        await Interaction.updateOne(
          {
            userId: ctx.from.id,
            chatId: ctx.chat.id
          },
          {
            $inc: {
              messages: 1,
              points: 1
            }
          },
          {
            upsert: true
          }
        );
      }
    }
  } catch (e) {
    console.error("Middleware:", e.message);
  }

  return next();
});

// ============================================================
// HELPERS
// ============================================================

function isGroup(ctx) {
  return (
    ctx.chat &&
    ["group", "supergroup"].includes(ctx.chat.type)
  );
}

function isPrivate(ctx) {
  return ctx.chat?.type === "private";
}

function mention(user) {
  if (!user) return "المستخدم";

  const name = user.first_name || "المستخدم";

  return `[${escapeMarkdown(name)}](tg://user?id=${user.id})`;
}

function escapeMarkdown(text) {
  return String(text)
    .replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

function randomId() {
  return crypto.randomBytes(12).toString("hex");
}

async function requireReply(ctx) {
  if (!ctx.message?.reply_to_message?.from) {
    await ctx.reply("يجب الرد على العضو لتنفيذ الأمر.");
    return null;
  }

  return ctx.message.reply_to_message.from;
}

async function botAdmin(ctx) {
  try {
    return await ctx.telegram.getChatMember(
      ctx.chat.id,
      ctx.botInfo.id
    );
  } catch {
    return null;
  }
}

async function actualMember(ctx, userId) {
  return ctx.telegram.getChatMember(
    ctx.chat.id,
    userId
  );
}

// ============================================================
// REAL TELEGRAM ADMIN RIGHTS
// ============================================================

const TELEGRAM_RIGHTS = [
  ["can_delete_messages", "حذف الرسائل"],
  ["can_pin_messages", "تثبيت الرسائل"],
  ["can_restrict_members", "تقييد المستخدمين"],
  ["can_invite_users", "إضافة أعضاء"],
  ["can_promote_members", "إضافة مشرفين"],
  ["can_change_info", "تعديل معلومات المجموعة"],
  ["can_manage_topics", "إدارة الموضوعات"],
  ["can_manage_video_chats", "إدارة المكالمات الصوتية"],
  ["can_manage_stories", "إدارة القصص"]
];

function permissionValue(member, key) {
  if (!member) return false;

  if (member.status === "creator") {
    return true;
  }

  return Boolean(member[key]);
}

function permissionText(member) {
  if (!member) {
    return "تعذر جلب صلاحيات العضو.";
  }

  if (
    member.status !== "administrator" &&
    member.status !== "creator"
  ) {
    return "صلاحياتك عضو بالقروب";
  }

  let text = "• صلاحياتك بالإشراف :\n";
  text += "━━━━━━━━━━━━━━━━━━━━\n";

  for (const [key, name] of TELEGRAM_RIGHTS) {
    text += `• ${name} ↤︎ ${
      permissionValue(member, key) ? "نعم" : "لا"
    }\n`;
  }

  return text;
}

// ============================================================
// صلاحياتي
// ============================================================

bot.hears(/^صلاحياتي$/, async ctx => {
  if (!isGroup(ctx)) return;

  try {
    const member = await actualMember(
      ctx,
      ctx.from.id
    );

    await ctx.reply(permissionText(member));
  } catch {
    await ctx.reply(
      "حدث خطأ أثناء جلب الصلاحيات."
    );
  }
});

// ============================================================
// صلاحياته
// ============================================================

bot.hears(/^صلاحياته$/, async ctx => {
  if (!isGroup(ctx)) return;

  const target = await requireReply(ctx);
  if (!target) return;

  try {
    const member = await actualMember(
      ctx,
      target.id
    );

    if (
      member.status !== "administrator" &&
      member.status !== "creator"
    ) {
      await ctx.reply("صلاحياتك عضو بالقروب");
      return;
    }

    let text =
      `• صلاحيات ${target.first_name || "المستخدم"} بالإشراف :\n`;

    text += "━━━━━━━━━━━━━━━━━━━━\n";

    for (const [key, name] of TELEGRAM_RIGHTS) {
      text += `• ${name} ↤︎ ${
        permissionValue(member, key) ? "نعم" : "لا"
      }\n`;
    }

    await ctx.reply(text);
  } catch {
    await ctx.reply(
      "تعذر جلب صلاحيات العضو."
    );
  }
});

// ============================================================
// PROMOTION SESSIONS
// ============================================================

const promotionSessions = new Map();

async function validatePromotion(ctx, session = null) {
  if (!isGroup(ctx)) {
    return {
      ok: false,
      message: "هذا الأمر داخل القروب فقط."
    };
  }

  const executorId = ctx.from.id;
  const chatId = ctx.chat.id;

  let targetId;

  if (session) {
    targetId = session.targetId;
  } else {
    targetId =
      ctx.message?.reply_to_message?.from?.id;
  }

  if (!targetId) {
    return {
      ok: false,
      message: "يجب الرد على العضو."
    };
  }

  if (executorId === targetId) {
    return {
      ok: false,
      message: "لا يمكنك استهداف نفسك."
    };
  }

  const executorRank =
    await getUserRank(executorId, chatId);

  if (
    rankLevel(executorRank) <
    rankLevel("Dev²🎖️")
  ) {
    return {
      ok: false,
      message: rankError("Dev²🎖️")
    };
  }

  let executorMember;
  let targetMember;
  let botMember;

  try {
    executorMember =
      await actualMember(ctx, executorId);

    targetMember =
      await actualMember(ctx, targetId);

    botMember = await botAdmin(ctx);
  } catch {
    return {
      ok: false,
      message: "تعذر التحقق من صلاحيات Telegram."
    };
  }

  if (!botMember) {
    return {
      ok: false,
      message: "تعذر معرفة صلاحيات البوت."
    };
  }

  if (
    botMember.status !== "creator" &&
    !botMember.can_promote_members
  ) {
    return {
      ok: false,
      message:
        "البوت لا يملك صلاحية إضافة المشرفين."
    };
  }

  if (
    executorMember.status !== "creator" &&
    !executorMember.can_promote_members
  ) {
    return {
      ok: false,
      message:
        "لا تملك صلاحية Telegram الفعلية لإضافة المشرفين."
    };
  }

  if (
    targetMember.status === "creator"
  ) {
    return {
      ok: false,
      message: "لا يمكن تعديل مالك المجموعة."
    };
  }

  const targetRank =
    await getUserRank(targetId, chatId);

  if (
    rankLevel(targetRank) >=
    rankLevel(executorRank)
  ) {
    return {
      ok: false,
      message:
        "لا يمكنك تعديل عضو رتبته مساوية أو أعلى من رتبتك."
    };
  }

  if (
    targetRank === "Dev🎖️" &&
    executorRank !== "Dev🎖️"
  ) {
    return {
      ok: false,
      message:
        "لا يمكنك تعديل رتبة Dev🎖️."
    };
  }

  return {
    ok: true,
    executorRank,
    targetRank,
    targetMember
  };
}

// ============================================================
// PROMOTION KEYBOARD
// ============================================================

function promotionKeyboard(sessionId, session) {
  const rows = [];

  for (const [key, name] of TELEGRAM_RIGHTS) {
    rows.push([
      Markup.button.callback(
        `${name} ↤ ${session.rights[key] ? "نعم" : "لا"}`,
        `pt:${sessionId}:${key}`
      )
    ]);
  }

  rows.push([
    Markup.button.callback(
      "حفظ وتطبيق",
      `ps:${sessionId}`
    )
  ]);

  rows.push([
    Markup.button.callback(
      "إخفاء الأمر",
      `ph:${sessionId}`
    )
  ]);

  return Markup.inlineKeyboard(rows);
}

// ============================================================
// رفع مشرف / ترقيه
// ============================================================

bot.hears(/^(رفع مشرف|ترقيه)$/, async ctx => {
  if (!isGroup(ctx)) return;

  const target = await requireReply(ctx);
  if (!target) return;

  const validation =
    await validatePromotion(ctx);

  if (!validation.ok) {
    await ctx.reply(validation.message);
    return;
  }

  const sessionId = randomId();

  const rights = {};

  for (const [key] of TELEGRAM_RIGHTS) {
    rights[key] = false;
  }

  promotionSessions.set(sessionId, {
    ownerId: ctx.from.id,
    chatId: ctx.chat.id,
    targetId: target.id,
    rights,
    createdAt: Date.now()
  });

  await ctx.reply(
    `صلاحيات المستخدم ${target.first_name || "المستخدم"}`,
    promotionKeyboard(
      sessionId,
      promotionSessions.get(sessionId)
    )
  );
});

// ============================================================
// PROMOTION TOGGLE
// ============================================================

bot.action(/^pt:([^:]+):(.+)$/, async ctx => {
  const sessionId = ctx.match[1];
  const key = ctx.match[2];

  const session =
    promotionSessions.get(sessionId);

  if (!session) {
    await ctx.answerCbQuery(
      "انتهت الجلسة."
    );
    return;
  }

  if (ctx.from.id !== session.ownerId) {
    await ctx.answerCbQuery(
      "هذه الجلسة ليست لك."
    );
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(
    session.rights,
    key
  )) {
    await ctx.answerCbQuery(
      "صلاحية غير صالحة."
    );
    return;
  }

  const validation =
    await validatePromotion(ctx, session);

  if (!validation.ok) {
    promotionSessions.delete(sessionId);

    await ctx.answerCbQuery(
      validation.message,
      { show_alert: true }
    );

    try {
      await ctx.deleteMessage();
    } catch {}

    return;
  }

  session.rights[key] =
    !session.rights[key];

  await ctx.editMessageReplyMarkup(
    promotionKeyboard(
      sessionId,
      session
    ).reply_markup
  );

  await ctx.answerCbQuery();
});

// ============================================================
// SAVE PROMOTION
// ============================================================

bot.action(/^ps:(.+)$/, async ctx => {
  const sessionId = ctx.match[1];

  const session =
    promotionSessions.get(sessionId);

  if (!session) {
    await ctx.answerCbQuery(
      "انتهت الجلسة.",
      { show_alert: true }
    );
    return;
  }

  if (ctx.from.id !== session.ownerId) {
    await ctx.answerCbQuery(
      "هذه الجلسة ليست لك.",
      { show_alert: true }
    );
    return;
  }

  const validation =
    await validatePromotion(ctx, session);

  if (!validation.ok) {
    promotionSessions.delete(sessionId);

    await ctx.answerCbQuery(
      validation.message,
      { show_alert: true }
    );

    return;
  }

  try {
    const telegramRights = {};

    for (const [key] of TELEGRAM_RIGHTS) {
      telegramRights[key] =
        Boolean(session.rights[key]);
    }

    await ctx.telegram.promoteChatMember(
      session.chatId,
      session.targetId,
      telegramRights
    );

    promotionSessions.delete(sessionId);

    await ctx.editMessageText(
      "تم حفظ الصلاحيات وتطبيقها بنجاح."
    );
  } catch (error) {
    console.error(
      "PROMOTION ERROR:",
      error
    );

    await ctx.answerCbQuery(
      "فشل تطبيق الصلاحيات في Telegram.",
      { show_alert: true }
    );
  }
});

// ============================================================
// HIDE PROMOTION
// ============================================================

bot.action(/^ph:(.+)$/, async ctx => {
  const sessionId = ctx.match[1];

  const session =
    promotionSessions.get(sessionId);

  if (!session) {
    await ctx.answerCbQuery(
      "انتهت الجلسة."
    );
    return;
  }

  if (ctx.from.id !== session.ownerId) {
    await ctx.answerCbQuery(
      "هذه الجلسة ليست لك."
    );
    return;
  }

  promotionSessions.delete(sessionId);

  try {
    await ctx.deleteMessage();
  } catch {
    await ctx.editMessageText(
      "تم إخفاء الأمر."
    );
  }
});

// ============================================================
// RANK COMMAND HELPERS
// ============================================================

async function changeRank(
  ctx,
  target,
  newRank
) {
  const chatId = ctx.chat.id;

  if (!target) return;

  if (ctx.from.id === target.id) {
    await ctx.reply(
      "لا يمكنك تغيير رتبتك بنفسك."
    );
    return;
  }

  const executorRank =
    await getUserRank(
      ctx.from.id,
      chatId
    );

  const targetRank =
    await getUserRank(
      target.id,
      chatId
    );

  if (
    rankLevel(targetRank) >=
    rankLevel(executorRank)
  ) {
    await ctx.reply(
      "لا يمكنك تعديل عضو رتبته مساوية أو أعلى من رتبتك."
    );
    return;
  }

  if (
    targetRank === "Dev🎖️" &&
    executorRank !== "Dev🎖️"
  ) {
    await ctx.reply(
      "لا يمكنك تعديل رتبة Dev🎖️."
    );
    return;
  }

  if (
    rankLevel(newRank) >=
    rankLevel(executorRank) &&
    executorRank !== "Dev🎖️"
  ) {
    await ctx.reply(
      "لا يمكنك منح رتبة مساوية أو أعلى من رتبتك."
    );
    return;
  }

  await Rank.updateOne(
    {
      userId: target.id,
      chatId
    },
    {
      rank: newRank
    },
    {
      upsert: true
    }
  );

  await ctx.reply(
    `تم تعيين رتبة ${newRank} لـ ${target.first_name || "المستخدم"}.`
  );
}

// ============================================================
// RANK PROMOTION COMMANDS
// ============================================================

bot.hears(/^رفع مميز$/, async ctx => {
  if (!isGroup(ctx)) return;

  const target = await requireReply(ctx);
  if (!target) return;

  const rank =
    await getUserRank(ctx.from.id, ctx.chat.id);

  if (rankLevel(rank) < rankLevel("مالك أساسي")) {
    await ctx.reply(rankError("مالك أساسي"));
    return;
  }

  await changeRank(ctx, target, "مميز");
});

bot.hears(/^رفع مالك$/, async ctx => {
  if (!isGroup(ctx)) return;

  const target = await requireReply(ctx);
  if (!target) return;

  const rank =
    await getUserRank(ctx.from.id, ctx.chat.id);

  if (rankLevel(rank) < rankLevel("مالك أساسي")) {
    await ctx.reply(rankError("مالك أساسي"));
    return;
  }

  await changeRank(ctx, target, "مالك");
});

bot.hears(/^رفع مالك أساسي$/, async ctx => {
  if (!isGroup(ctx)) return;

  const target = await requireReply(ctx);
  if (!target) return;

  const rank =
    await getUserRank(ctx.from.id, ctx.chat.id);

  if (rankLevel(rank) < rankLevel("Myth")) {
    await ctx.reply(rankError("Myth"));
    return;
  }

  await changeRank(ctx, target, "مالك أساسي");
});

bot.hears(/^رفع Myth$/, async ctx => {
  if (!isGroup(ctx)) return;

  const target = await requireReply(ctx);
  if (!target) return;

  const rank =
    await getUserRank(ctx.from.id, ctx.chat.id);

  if (rankLevel(rank) < rankLevel("Dev²🎖️")) {
    await ctx.reply(rankError("Dev²🎖️"));
    return;
  }

  await changeRank(ctx, target, "Myth");
});

bot.hears(/^رفع Myth 🎖️$/, async ctx => {
  if (!isGroup(ctx)) return;

  const target = await requireReply(ctx);
  if (!target) return;

  const rank =
    await getUserRank(ctx.from.id, ctx.chat.id);

  if (rank !== "Dev🎖️") {
    await ctx.reply(rankError("Dev🎖️"));
    return;
  }

  await changeRank(ctx, target, "Myth 🎖️");
});

bot.hears(/^رفع Dev²🎖️$/, async ctx => {
  if (!isGroup(ctx)) return;

  const target = await requireReply(ctx);
  if (!target) return;

  const rank =
    await getUserRank(ctx.from.id, ctx.chat.id);

  if (rank !== "Dev🎖️") {
    await ctx.reply(rankError("Dev🎖️"));
    return;
  }

  await changeRank(ctx, target, "Dev²🎖️");
});

// ============================================================
// REMOVE / DEMOTE RANK
// ============================================================

bot.hears(/^تنزيل$/, async ctx => {
  if (!isGroup(ctx)) return;

  const target = await requireReply(ctx);
  if (!target) return;

  const executor =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  const targetRank =
    await getUserRank(
      target.id,
      ctx.chat.id
    );

  if (targetRank === "عضو") {
    await ctx.reply(
      "العضو ليس لديه رتبة."
    );
    return;
  }

  if (
    rankLevel(targetRank) >=
    rankLevel(executor)
  ) {
    await ctx.reply(
      "لا يمكنك تنزيل رتبة مساوية أو أعلى من رتبتك."
    );
    return;
  }

  await Rank.deleteOne({
    userId: target.id,
    chatId: ctx.chat.id
  });

  await ctx.reply(
    `تم تنزيل رتبة ${target.first_name || "المستخدم"}.`
  );
});

// ============================================================
// TITLES
// ============================================================

bot.hears(/^ضع (.+)$/s, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(ctx.from.id, ctx.chat.id);

  if (rank !== "Dev🎖️") {
    await ctx.reply(
      "لا يستطيع غير Dev🎖️ تغيير الألقاب."
    );
    return;
  }

  const target = await requireReply(ctx);
  if (!target) return;

  const title =
    ctx.match[1].trim();

  if (!title) return;

  await Title.updateOne(
    {
      userId: target.id,
      chatId: ctx.chat.id
    },
    {
      title
    },
    {
      upsert: true
    }
  );

  await ctx.reply(
    `تم تعيين اللقب بنجاح إلى: ${title}`
  );
});

bot.hears(/^لقبي$/, async ctx => {
  if (!isGroup(ctx)) return;

  const doc =
    await Title.findOne({
      userId: ctx.from.id,
      chatId: ctx.chat.id
    });

  await ctx.reply(
    `لقبك ↤ ${doc?.title || "بدون لقب"}`
  );
});

bot.hears(/^لقبه$/, async ctx => {
  if (!isGroup(ctx)) return;

  const target = await requireReply(ctx);
  if (!target) return;

  const doc =
    await Title.findOne({
      userId: target.id,
      chatId: ctx.chat.id
    });

  await ctx.reply(
    `لقبه ↤ ${doc?.title || "بدون لقب"}`
  );
});

// ============================================================
// OWNER PROFILE
// ============================================================

bot.hears(/^المالك$/, async ctx => {
  if (!isGroup(ctx)) return;

  try {
    const owner =
      await ctx.telegram.getChat(
        `@${OWNER_USERNAME}`
      );

    let caption =
      "المالك\n\n";

    caption +=
      `${owner.first_name || ""}`;

    if (owner.last_name) {
      caption += ` ${owner.last_name}`;
    }

    if (owner.username) {
      caption += `\n@${owner.username}`;
    }

    if (owner.bio) {
      caption += `\n\nالبايو\n${owner.bio}`;
    }

    caption +=
      "\n\nرتبة المالك\nDev🎖️";

    const photos =
      await ctx.telegram.getUserProfilePhotos(
        owner.id,
        0,
        1
      );

    if (
      photos &&
      photos.total_count > 0
    ) {
      const fileId =
        photos.photos[0][
          photos.photos[0].length - 1
        ].file_id;

      await ctx.replyWithPhoto(
        fileId,
        {
          caption
        }
      );
    } else {
      await ctx.reply(caption);
    }
  } catch {
    await ctx.reply(
      "تعذر جلب معلومات المالك الحالية."
    );
  }
});

// ============================================================
// @ALL
// ============================================================

bot.hears(/^@all$/, async ctx => {
  if (!isGroup(ctx)) return;

  const settings =
    await getSettings(ctx.chat.id);

  if (!settings.allMention) return;

  const members =
    knownGroupMembers.get(ctx.chat.id);

  if (!members || members.size === 0) {
    await ctx.reply(
      "لا توجد قائمة أعضاء معروفة للمنشن."
    );
    return;
  }

  const users =
    [...members.values()];

  const chunks = [];
  let current = "";

  for (const user of users) {
    const item =
      mention(user) + " ";

    if (
      current.length + item.length > 3500
    ) {
      chunks.push(current);
      current = "";
    }

    current += item;
  }

  if (current) {
    chunks.push(current);
  }

  for (const chunk of chunks) {
    try {
      await ctx.reply(
        chunk,
        {
          parse_mode: "MarkdownV2"
        }
      );
    } catch {
      await ctx.reply(
        chunk.replace(/\\/g, "")
      );
    }
  }
});

bot.hears(/^فتح المنشن$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(ctx.from.id, ctx.chat.id);

  if (rank !== "Dev🎖️") {
    await ctx.reply(
      rankError("Dev🎖️")
    );
    return;
  }

  await GroupSettings.updateOne(
    { chatId: ctx.chat.id },
    { allMention: true },
    { upsert: true }
  );

  await ctx.reply(
    "تم فتح المنشن."
  );
});

bot.hears(/^غلق المنشن$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(ctx.from.id, ctx.chat.id);

  if (rank !== "Dev🎖️") {
    await ctx.reply(
      rankError("Dev🎖️")
    );
    return;
  }

  await GroupSettings.updateOne(
    { chatId: ctx.chat.id },
    { allMention: false },
    { upsert: true }
  );

  await ctx.reply(
    "تم غلق المنشن."
  );
});

// ============================================================
// PROTECTION
// ============================================================

async function hierarchyProtection(
  ctx,
  targetId
) {
  const executorRank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  const targetRank =
    await getUserRank(
      targetId,
      ctx.chat.id
    );

  if (ctx.from.id === targetId) {
    return {
      ok: false,
      message: "لا يمكنك استهداف نفسك."
    };
  }

  if (
    rankLevel(targetRank) >=
    rankLevel(executorRank)
  ) {
    return {
      ok: false,
      message:
        "لا يمكنك تنفيذ الإجراء على عضو رتبته مساوية أو أعلى من رتبتك."
    };
  }

  if (
    targetRank === "Dev🎖️" &&
    executorRank !== "Dev🎖️"
  ) {
    return {
      ok: false,
      message:
        "لا يمكنك تنفيذ الإجراء على Dev🎖️."
    };
  }

  return { ok: true };
}

bot.hears(/^(كتم|مم|تقييد|حظر|طرد)$/, async ctx => {
  if (!isGroup(ctx)) return;

  const target =
    await requireReply(ctx);

  if (!target) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Myth")
  ) {
    await ctx.reply(
      rankError("Myth")
    );
    return;
  }

  const hierarchy =
    await hierarchyProtection(
      ctx,
      target.id
    );

  if (!hierarchy.ok) {
    await ctx.reply(
      hierarchy.message
    );
    return;
  }

  const cmd =
    ctx.message.text.trim();

  try {
    if (
      cmd === "كتم" ||
      cmd === "مم"
    ) {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        target.id,
        {
          permissions: {
            can_send_messages: false
          }
        }
      );

      await ctx.reply(
        "تم كتم العضو بنجاح."
      );
    }

    if (cmd === "تقييد") {
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

      await ctx.reply(
        "تم تقييد العضو بنجاح."
      );
    }

    if (cmd === "حظر") {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        target.id
      );

      await ctx.reply(
        "تم حظر العضو بنجاح."
      );
    }

    if (cmd === "طرد") {
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
        "تم طرد العضو بنجاح."
      );
    }
  } catch (e) {
    console.error(
      "PROTECTION:",
      e.message
    );

    await ctx.reply(
      "فشل تنفيذ الإجراء في Telegram."
    );
  }
});

// ============================================================
// فك الكتم / التقييد
// ============================================================

bot.hears(/^(فك الكتم|الغاء التقييد|إلغاء التقييد)$/, async ctx => {
  if (!isGroup(ctx)) return;

  const target =
    await requireReply(ctx);

  if (!target) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Myth")
  ) {
    await ctx.reply(
      rankError("Myth")
    );
    return;
  }

  const hierarchy =
    await hierarchyProtection(
      ctx,
      target.id
    );

  if (!hierarchy.ok) {
    await ctx.reply(
      hierarchy.message
    );
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
          can_add_web_page_previews: true
        }
      }
    );

    await ctx.reply(
      "تم إلغاء التقييد."
    );
  } catch {
    await ctx.reply(
      "فشل إلغاء التقييد."
    );
  }
});

// ============================================================
// PROTECTION LOCK
// ============================================================

bot.hears(/^قفل الحماية$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Myth 🎖️")
  ) {
    await ctx.reply(
      rankError("Myth 🎖️")
    );
    return;
  }

  await GroupSettings.updateOne(
    { chatId: ctx.chat.id },
    { protectionLocked: true },
    { upsert: true }
  );

  await ctx.reply(
    "تم قفل الحماية."
  );
});

bot.hears(/^فتح الحماية$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Myth 🎖️")
  ) {
    await ctx.reply(
      rankError("Myth 🎖️")
    );
    return;
  }

  await GroupSettings.updateOne(
    { chatId: ctx.chat.id },
    { protectionLocked: false },
    { upsert: true }
  );

  await ctx.reply(
    "تم فتح الحماية."
  );
});

// ============================================================
// BANNED WORDS
// ============================================================

bot.hears(/^منع الكلمه (.+)$/s, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Dev²🎖️")
  ) {
    await ctx.reply(
      rankError("Dev²🎖️")
    );
    return;
  }

  const word =
    ctx.match[1].trim();

  if (!word) return;

  try {
    await BannedWord.updateOne(
      {
        chatId: ctx.chat.id,
        word
      },
      {
        chatId: ctx.chat.id,
        word,
        createdBy: ctx.from.id
      },
      {
        upsert: true
      }
    );

    await ctx.reply(
      "تم منع الكلمة."
    );
  } catch {
    await ctx.reply(
      "تعذر إضافة الكلمة."
    );
  }
});

bot.hears(/^الغاء منع الكلمه (.+)$/s, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Dev²🎖️")
  ) {
    await ctx.reply(
      rankError("Dev²🎖️")
    );
    return;
  }

  const word =
    ctx.match[1].trim();

  await BannedWord.deleteOne({
    chatId: ctx.chat.id,
    word
  });

  await ctx.reply(
    "تم إلغاء منع الكلمة."
  );
});

bot.hears(/^الكلمات الممنوعه$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Dev²🎖️")
  ) {
    await ctx.reply(
      rankError("Dev²🎖️")
    );
    return;
  }

  const words =
    await BannedWord.find({
      chatId: ctx.chat.id
    });

  if (!words.length) {
    await ctx.reply(
      "لا توجد كلمات ممنوعة."
    );
    return;
  }

  await ctx.reply(
    "الكلمات الممنوعة:\n\n" +
    words.map(
      (x, i) => `${i + 1}. ${x.word}`
    ).join("\n")
  );
});

bot.hears(/^مسح الكلمات الممنوعه$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Dev²🎖️")
  ) {
    await ctx.reply(
      rankError("Dev²🎖️")
    );
    return;
  }

  await BannedWord.deleteMany({
    chatId: ctx.chat.id
  });

  await ctx.reply(
    "تم مسح الكلمات الممنوعة."
  );
});

// ============================================================
// CUSTOM COMMANDS
// ============================================================

const customSessions = new Map();

bot.hears(/^اضف امر$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Dev²🎖️")
  ) {
    await ctx.reply(
      rankError("Dev²🎖️")
    );
    return;
  }

  customSessions.set(
    ctx.from.id,
    {
      type: "cmd",
      chatId: ctx.chat.id
    }
  );

  await ctx.reply(
    "• أرسل الآن اسم الأمر"
  );
});

bot.hears(/^اضف رد (.+)$/s, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Dev²🎖️")
  ) {
    await ctx.reply(
      rankError("Dev²🎖️")
    );
    return;
  }

  const key =
    ctx.match[1].trim();

  customSessions.set(
    ctx.from.id,
    {
      type: "reply",
      chatId: ctx.chat.id,
      key
    }
  );

  await ctx.reply(
    "• أرسل الآن رد الأمر"
  );
});

bot.hears(/^حذف امر (.+)$/s, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Dev²🎖️")
  ) {
    await ctx.reply(
      rankError("Dev²🎖️")
    );
    return;
  }

  await CustomCommand.deleteOne({
    chatId: ctx.chat.id,
    type: "cmd",
    key: ctx.match[1].trim()
  });

  await ctx.reply(
    "تم حذف الأمر."
  );
});

bot.hears(/^حذف رد (.+)$/s, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Dev²🎖️")
  ) {
    await ctx.reply(
      rankError("Dev²🎖️")
    );
    return;
  }

  await CustomCommand.deleteOne({
    chatId: ctx.chat.id,
    type: "reply",
    key: ctx.match[1].trim()
  });

  await ctx.reply(
    "تم حذف الرد."
  );
});

bot.hears(/^اوامري$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Dev²🎖️")
  ) {
    await ctx.reply(
      rankError("Dev²🎖️")
    );
    return;
  }

  const commands =
    await CustomCommand.find({
      chatId: ctx.chat.id,
      type: "cmd"
    });

  if (!commands.length) {
    await ctx.reply(
      "لا توجد أوامر مخصصة."
    );
    return;
  }

  await ctx.reply(
    "أوامرك:\n\n" +
    commands.map(
      x => `• ${x.key}`
    ).join("\n")
  );
});

bot.hears(/^ردودي$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Dev²🎖️")
  ) {
    await ctx.reply(
      rankError("Dev²🎖️")
    );
    return;
  }

  const replies =
    await CustomCommand.find({
      chatId: ctx.chat.id,
      type: "reply"
    });

  if (!replies.length) {
    await ctx.reply(
      "لا توجد ردود مخصصة."
    );
    return;
  }

  await ctx.reply(
    "ردودك:\n\n" +
    replies.map(
      x => `• ${x.key}`
    ).join("\n")
  );
});

// ============================================================
// CHANNELS
// ============================================================

const channelSessions = new Map();

bot.hears(/^اضف قناة$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Dev²🎖️")
  ) {
    await ctx.reply(
      rankError("Dev²🎖️")
    );
    return;
  }

  channelSessions.set(
    ctx.from.id,
    {
      chatId: ctx.chat.id
    }
  );

  await ctx.reply(
    "• أرسل رابط القناة"
  );
});

bot.hears(/^تعديل قناتي$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Dev²🎖️")
  ) {
    await ctx.reply(
      rankError("Dev²🎖️")
    );
    return;
  }

  channelSessions.set(
    ctx.from.id,
    {
      chatId: ctx.chat.id,
      edit: true
    }
  );

  await ctx.reply(
    "• أرسل رابط القناة الجديد"
  );
});

bot.hears(/^حذف قناتي$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Dev²🎖️")
  ) {
    await ctx.reply(
      rankError("Dev²🎖️")
    );
    return;
  }

  await Channel.deleteOne({
    userId: ctx.from.id,
    chatId: ctx.chat.id
  });

  await ctx.reply(
    "تم حذف قناتك."
  );
});

bot.hears(/^قناتي$/, async ctx => {
  if (!isGroup(ctx)) return;

  const channel =
    await Channel.findOne({
      userId: ctx.from.id,
      chatId: ctx.chat.id
    });

  if (!channel) {
    await ctx.reply(
      "لم تقم بإضافة قناة."
    );
    return;
  }

  await ctx.reply(
    `• قناتك\n${channel.channelUrl}`
  );
});

// ============================================================
// MARRIAGE
// ============================================================

async function isMarried(chatId, userId) {
  const husband =
    await Marriage.findOne({
      chatId,
      husbandId: userId
    });

  if (
    husband &&
    husband.wives.some(
      wife => wife.userId === userId
    )
  ) {
    return true;
  }

  const wife =
    await Marriage.findOne({
      chatId,
      "wives.userId": userId
    });

  return Boolean(wife);
}

async function findMarriageAsWife(
  chatId,
  wifeId
) {
  return Marriage.findOne({
    chatId,
    "wives.userId": wifeId
  });
}

bot.hears(/^زواج (\d+)$/, async ctx => {
  if (!isGroup(ctx)) return;

  const settings =
    await getSettings(ctx.chat.id);

  if (settings.gamesLocked) {
    await ctx.reply(
      "الألعاب والفعاليات مقفلة حالياً."
    );
    return;
  }

  const target =
    await requireReply(ctx);

  if (!target) return;

  const husbandId =
    ctx.from.id;

  const wifeId =
    target.id;

  if (husbandId === wifeId) {
    await ctx.reply(
      "لا يمكنك الزواج من نفسك."
    );
    return;
  }

  const dowry =
    Number(ctx.match[1]);

  if (!Number.isFinite(dowry) || dowry < 0) {
    await ctx.reply(
      "المهر غير صحيح."
    );
    return;
  }

  const existingWife =
    await findMarriageAsWife(
      ctx.chat.id,
      wifeId
    );

  if (existingWife) {
    await ctx.reply(
      "لاتقرب للمتزوجين"
    );
    return;
  }

  let marriage =
    await Marriage.findOne({
      chatId: ctx.chat.id,
      husbandId
    });

  if (!marriage) {
    marriage =
      new Marriage({
        chatId: ctx.chat.id,
        husbandId,
        husbandUsername:
          ctx.from.username || null,
        wives: []
      });
  }

  if (marriage.wives.length >= 4) {
    await ctx.reply(
      "لا يمكنك الزواج بأكثر من أربع زوجات."
    );
    return;
  }

  const slot =
    marriage.wives.length + 1;

  if (slot > 1) {
    const previous =
      marriage.wives[slot - 2];

    try {
      await ctx.reply(
        `${mention({
          id: previous.userId,
          first_name: previous.firstName
        })}\nالحقي زوجك بيتزوج عليك`,
        {
          parse_mode: "MarkdownV2"
        }
      );
    } catch {}
  }

  marriage.wives.push({
    slot,
    userId: wifeId,
    username:
      target.username || null,
    firstName:
      target.first_name || "المستخدم",
    dowry,
    date: new Date()
  });

  await marriage.save();

  await ctx.reply(
    `تم الزواج.\nالزوج: ${ctx.from.first_name}\nالزوجة: ${target.first_name}\nالمهر: ${dowry} ريال`
  );
});

bot.hears(/^زواج (الثانيه|الثالثه|الرابعه) (\d+)$/, async ctx => {
  if (!isGroup(ctx)) return;

  const settings =
    await getSettings(ctx.chat.id);

  if (settings.gamesLocked) {
    await ctx.reply(
      "الألعاب والفعاليات مقفلة حالياً."
    );
    return;
  }

  const target =
    await requireReply(ctx);

  if (!target) return;

  const name =
    ctx.match[1];

  const dowry =
    Number(ctx.match[2]);

  const slots = {
    "الثانيه": 2,
    "الثالثه": 3,
    "الرابعه": 4
  };

  const slot =
    slots[name];

  let marriage =
    await Marriage.findOne({
      chatId: ctx.chat.id,
      husbandId: ctx.from.id
    });

  if (!marriage) {
    await ctx.reply(
      "ابدأ بالزواج الأول أولاً."
    );
    return;
  }

  if (
    marriage.wives.some(
      x => x.slot === slot
    )
  ) {
    await ctx.reply(
      "هذه الخانة متزوجة بالفعل."
    );
    return;
  }

  if (marriage.wives.length !== slot - 1) {
    await ctx.reply(
      "يجب ترتيب الزوجات بدون تخطي الخانات."
    );
    return;
  }

  const existing =
    await findMarriageAsWife(
      ctx.chat.id,
      target.id
    );

  if (existing) {
    await ctx.reply(
      "لاتقرب للمتزوجين"
    );
    return;
  }

  const previous =
    marriage.wives[
      marriage.wives.length - 1
    ];

  try {
    await ctx.reply(
      `${mention({
        id: previous.userId,
        first_name: previous.firstName
      })}\nالحقي زوجك بيتزوج عليك`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  } catch {}

  marriage.wives.push({
    slot,
    userId: target.id,
    username:
      target.username || null,
    firstName:
      target.first_name || "المستخدم",
    dowry,
    date: new Date()
  });

  await marriage.save();

  await ctx.reply(
    `تم تسجيل الزوجة رقم ${slot}.\nالزوجة: ${target.first_name}\nالمهر: ${dowry} ريال`
  );
});

bot.hears(/^زواجي$/, async ctx => {
  if (!isGroup(ctx)) return;

  const marriage =
    await Marriage.findOne({
      chatId: ctx.chat.id,
      husbandId: ctx.from.id
    });

  if (
    !marriage ||
    !marriage.wives.length
  ) {
    await ctx.reply(
      "ليس لديك أي زيجات مسجلة."
    );
    return;
  }

  let text =
    "زيجاتك\n━━━━━━━━━━━━━━\n";

  for (const wife of marriage.wives) {
    text +=
      `${wife.slot}. ${wife.firstName} ↤ ${wife.dowry} ريال\n`;
  }

  await ctx.reply(text);
});

bot.hears(/^توب المتزوجين$/, async ctx => {
  if (!isGroup(ctx)) return;

  const records =
    await Marriage.find({
      chatId: ctx.chat.id
    });

  const top =
    records
      .map(record => ({
        record,
        total: record.wives.reduce(
          (sum, wife) =>
            sum + wife.dowry,
          0
        )
      }))
      .sort(
        (a, b) =>
          b.total - a.total
      )
      .slice(0, 20);

  if (!top.length) {
    await ctx.reply(
      "لا توجد زيجات."
    );
    return;
  }

  let text =
    "توب المتزوجين\n━━━━━━━━━━━━━━\n";

  top.forEach((item, index) => {
    text +=
      `${index + 1}. ${item.record.husbandUsername ? "@" + item.record.husbandUsername : item.record.husbandId} ↤ ${item.total} ريال\n`;
  });

  await ctx.reply(text);
});

// ============================================================
// BANK
// ============================================================

const BANKS = [
  "الراجحي",
  "الأهلي",
  "البنك الثالث"
];

function generateAccountNumber() {
  return String(
    Math.floor(
      1000000000 +
      Math.random() * 9000000000
    )
  );
}

bot.hears(/^فلوسي$/, async ctx => {
  if (!isGroup(ctx)) return;

  const user =
    await User.findOne({
      userId: ctx.from.id
    });

  await ctx.reply(
    `فلوسك: ${user?.balance || 0} ريال`
  );
});

bot.hears(/^فلوسه$/, async ctx => {
  if (!isGroup(ctx)) return;

  const target =
    await requireReply(ctx);

  if (!target) return;

  const user =
    await User.findOne({
      userId: target.id
    });

  await ctx.reply(
    `فلوس ${target.first_name}: ${user?.balance || 0} ريال`
  );
});

bot.hears(/^انشاء حساب بنكي$/, async ctx => {
  if (!isGroup(ctx)) return;

  await ctx.reply(
    "اختر البنك:",
    Markup.inlineKeyboard(
      BANKS.map(bank => [
        Markup.button.callback(
          bank,
          `bank:${bank}`
        )
      ])
    )
  );
});

bot.action(/^bank:(.+)$/, async ctx => {
  const bank =
    ctx.match[1];

  if (!BANKS.includes(bank)) {
    await ctx.answerCbQuery(
      "البنك غير صحيح."
    );
    return;
  }

  let user =
    await User.findOne({
      userId: ctx.from.id
    });

  if (!user) {
    user =
      await ensureUser(ctx.from);
  }

  const accountNumber =
    user.bank?.accountNumber ||
    generateAccountNumber();

  user.bank = {
    name: bank,
    accountNumber,
    active: true
  };

  await user.save();

  await ctx.editMessageText(
    `تم إنشاء حسابك البنكي.\n\nالبنك: ${bank}\nرقم الحساب: ${accountNumber}\nالرصيد: ${user.balance} ريال`
  );
});

bot.hears(/^حسابي$/, async ctx => {
  if (!isGroup(ctx)) return;

  const user =
    await User.findOne({
      userId: ctx.from.id
    });

  if (
    !user?.bank?.active
  ) {
    await ctx.reply(
      "ليس لديك حساب بنكي."
    );
    return;
  }

  await ctx.reply(
    `حسابك البنكي\n━━━━━━━━━━━━━━\nالبنك: ${user.bank.name}\nرقم الحساب: ${user.bank.accountNumber}\nالرصيد: ${user.balance} ريال`
  );
});

bot.hears(/^حذف حسابي$/, async ctx => {
  if (!isGroup(ctx)) return;

  await User.updateOne(
    { userId: ctx.from.id },
    {
      "bank.active": false
    }
  );

  await ctx.reply(
    "تم تعطيل الحساب البنكي مع الاحتفاظ برصيدك."
  );
});

bot.hears(/^اهداء (\d+)$/, async ctx => {
  if (!isGroup(ctx)) return;

  const target =
    await requireReply(ctx);

  if (!target) return;

  const amount =
    Number(ctx.match[1]);

  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0
  ) {
    await ctx.reply(
      "المبلغ غير صحيح."
    );
    return;
  }

  if (
    ctx.from.id === target.id
  ) {
    await ctx.reply(
      "لا يمكنك تحويل المال لنفسك."
    );
    return;
  }

  const sender =
    await User.findOne({
      userId: ctx.from.id
    });

  if (
    !sender ||
    sender.balance < amount
  ) {
    await ctx.reply(
      "رصيدك لا يكفي."
    );
    return;
  }

  const receiver =
    await ensureUser(target);

  sender.balance -= amount;
  receiver.balance += amount;

  await sender.save();
  await receiver.save();

  await Transfer.create({
    from: ctx.from.id,
    to: target.id,
    amount
  });

  await ctx.reply(
    `تم تحويل ${amount} ريال إلى ${target.first_name}.`
  );
});

// ============================================================
// STORE
// ============================================================

bot.hears(/^المتجر$/, async ctx => {
  if (!isGroup(ctx)) return;

  await ctx.reply(
    "المتجر\n━━━━━━━━━━━━━━\nالمتجر قابل للتوسعة وإضافة المنتجات من نظام البوت."
  );
});

// ============================================================
// INTERACTION
// ============================================================

function interactionLevel(points) {
  return Math.floor(
    Math.sqrt(Math.max(points, 0) / 10)
  ) + 1;
}

bot.hears(/^تفاعلي$/, async ctx => {
  if (!isGroup(ctx)) return;

  const data =
    await Interaction.findOne({
      userId: ctx.from.id,
      chatId: ctx.chat.id
    });

  const points =
    data?.points || 0;

  await ctx.reply(
    `تفاعلك\n━━━━━━━━━━━━━━\nالمستوى: ${interactionLevel(points)}\nالرسائل: ${data?.messages || 0}\nالنقاط: ${points}`
  );
});

bot.hears(/^رتبتي$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  await ctx.reply(
    `رتبتك ↤ ${rank}`
  );
});

bot.hears(/^المتفاعلين$/, async ctx => {
  if (!isGroup(ctx)) return;

  const list =
    await Interaction.find({
      chatId: ctx.chat.id
    })
      .sort({ points: -1 })
      .limit(20);

  if (!list.length) {
    await ctx.reply(
      "لا توجد بيانات تفاعل."
    );
    return;
  }

  let text =
    "المتفاعلين\n━━━━━━━━━━━━━━\n";

  for (let i = 0; i < list.length; i++) {
    const user =
      await User.findOne({
        userId: list[i].userId
      });

    text +=
      `${i + 1}. ${user?.firstName || list[i].userId} ↤ ${list[i].points}\n`;
  }

  await ctx.reply(text);
});

bot.hears(/^رتبته$/, async ctx => {
  if (!isGroup(ctx)) return;

  const target =
    await requireReply(ctx);

  if (!target) return;

  const rank =
    await getUserRank(
      target.id,
      ctx.chat.id
    );

  await ctx.reply(
    `رتبته ↤ ${rank}`
  );
});

bot.hears(/^تفاعله$/, async ctx => {
  if (!isGroup(ctx)) return;

  const target =
    await requireReply(ctx);

  if (!target) return;

  const data =
    await Interaction.findOne({
      userId: target.id,
      chatId: ctx.chat.id
    });

  await ctx.reply(
    `تفاعل ${target.first_name}\n━━━━━━━━━━━━━━\nالمستوى: ${interactionLevel(data?.points || 0)}\nالرسائل: ${data?.messages || 0}\nالنقاط: ${data?.points || 0}`
  );
});

bot.hears(/^اضف تفاعل (\d+)$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Dev🎖️")
  ) {
    await ctx.reply(
      rankError("Dev🎖️")
    );
    return;
  }

  const target =
    await requireReply(ctx);

  if (!target) return;

  const amount =
    Number(ctx.match[1]);

  await Interaction.updateOne(
    {
      userId: target.id,
      chatId: ctx.chat.id
    },
    {
      $inc: {
        points: amount
      }
    },
    {
      upsert: true
    }
  );

  await ctx.reply(
    "تم إضافة التفاعل بنجاح."
  );
});

// ============================================================
// GAMES
// ============================================================

const activeGames = new Map();

const GAME_NAMES = [
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

const GAME_DATA = {
  "لغز": [
    ["ما هو الشيء الذي له أسنان ولا يعض؟", "مشط"]
  ],

  "حساب": [
    ["5 + 7 = ؟", "12"],
    ["10 × 3 = ؟", "30"],
    ["20 - 8 = ؟", "12"]
  ],

  "صح أو خطأ": [
    ["الشمس نجم.", "صح"],
    ["القمر كوكب.", "خطأ"]
  ],

  "من أنا": [
    ["أنا كوكب أحمر.", "المريخ"]
  ],

  "كلمة السر": [
    ["أول شهر في السنة الميلادية؟", "يناير"]
  ],

  "حروف": [
    ["رتب الحروف: ب ت ك ا", "كتاب"]
  ],

  "ترتيب": [
    ["رتب: تفاحة - موز - برتقال", "تفاحة موز برتقال"]
  ],

  "جملة": [
    ["أكمل: العلم نور و...", "الجهل ظلام"]
  ],

  "أكمل": [
    ["أكمل: من جد...", "وجد"]
  ],

  "مقلوب": [
    ["اعكس الكلمة: باب", "باب"]
  ],

  "فكك": [
    ["ما الكلمة؟ ح + ا + س + ب", "حاسب"]
  ]
};

function normalizeAnswer(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[؟?!.,،]/g, "");
}

async function startGame(
  ctx,
  gameName
) {
  const settings =
    await getSettings(ctx.chat.id);

  if (settings.gamesLocked) {
    await ctx.reply(
      "الألعاب مقفلة حالياً."
    );
    return;
  }

  if (activeGames.has(ctx.chat.id)) {
    await ctx.reply(
      "هناك لعبة قائمة بالفعل."
    );
    return;
  }

  const questions =
    GAME_DATA[gameName];

  if (!questions?.length) {
    await ctx.reply(
      `لعبة ${gameName} تحتاج محتوى أسئلة إضافي قبل تشغيلها.`
    );
    return;
  }

  const selected =
    questions[
      Math.floor(
        Math.random() *
        questions.length
      )
    ];

  const startedAt =
    Date.now();

  activeGames.set(
    ctx.chat.id,
    {
      gameName,
      question: selected[0],
      answer: selected[1],
      startedAt
    }
  );

  await ctx.reply(
    `لعبة ${gameName}\n\n${selected[0]}`
  );
}

for (const game of GAME_NAMES) {
  bot.hears(
    new RegExp(
      `^${game.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`
    ),
    async ctx => {
      if (!isGroup(ctx)) return;

      await startGame(
        ctx,
        game
      );
    }
  );
}

// ============================================================
// GAME ANSWER CHECK
// ============================================================

bot.on("text", async ctx => {
  if (!isGroup(ctx)) return;

  const active =
    activeGames.get(
      ctx.chat.id
    );

  if (!active) return;

  const settings =
    await getSettings(ctx.chat.id);

  if (settings.gamesLocked) {
    activeGames.delete(
      ctx.chat.id
    );
    return;
  }

  const answer =
    normalizeAnswer(
      ctx.message.text
    );

  const correct =
    normalizeAnswer(
      active.answer
    );

  if (answer !== correct) {
    return;
  }

  const elapsed =
    (Date.now() -
      active.startedAt) /
    1000;

  const user =
    await ensureUser(ctx.from);

  const speed =
    elapsed <= 5
      ? "سريع"
      : elapsed <= 15
        ? "متوسط"
        : "بطيء";

  user.balance += 10;
  user.gamesPlayed += 1;
  user.wins += 1;
  user.correctAnswers += 1;

  if (
    elapsed <
    user.bestSpeed
  ) {
    user.bestSpeed =
      elapsed;
  }

  await user.save();

  activeGames.delete(
    ctx.chat.id
  );

  await ctx.reply(
    `كفو عليك\nالوقت: ${elapsed.toFixed(2)} ثانية\nالسرعه: ${speed}\nفلوسك: ${user.balance} ريال`
  );
});

// ============================================================
// GAME LOCK
// ============================================================

bot.hears(/^قفل الالعاب$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Dev🎖️")
  ) {
    await ctx.reply(
      rankError("Dev🎖️")
    );
    return;
  }

  activeGames.delete(
    ctx.chat.id
  );

  await GroupSettings.updateOne(
    { chatId: ctx.chat.id },
    { gamesLocked: true },
    { upsert: true }
  );

  await ctx.reply(
    "تم قفل الألعاب."
  );
});

bot.hears(/^فتح الالعاب$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("Dev🎖️")
  ) {
    await ctx.reply(
      rankError("Dev🎖️")
    );
    return;
  }

  await GroupSettings.updateOne(
    { chatId: ctx.chat.id },
    { gamesLocked: false },
    { upsert: true }
  );

  await ctx.reply(
    "تم فتح الألعاب."
  );
});

// ============================================================
// AHKAM
// ============================================================

const ahkamSessions = new Map();

bot.hears(/^احكام$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (rank !== "Dev🎖️") {
    await ctx.reply(
      rankError("Dev🎖️")
    );
    return;
  }

  const settings =
    await getSettings(ctx.chat.id);

  if (settings.gamesLocked) {
    await ctx.reply(
      "الألعاب مقفلة حالياً."
    );
    return;
  }

  ahkamSessions.set(
    ctx.chat.id,
    {
      starterId: ctx.from.id,
      participants: new Map()
    }
  );

  await ctx.reply(
    "• بدأت لعبة الأحكام\n• اللي يبي يشارك يكتب أنا"
  );
});

bot.hears(/^أنا$/, async ctx => {
  if (!isGroup(ctx)) return;

  const session =
    ahkamSessions.get(
      ctx.chat.id
    );

  if (!session) return;

  session.participants.set(
    ctx.from.id,
    ctx.from
  );

  await ctx.reply(
    "تم تسجيل مشاركتك."
  );
});

bot.hears(/^نعم$/, async ctx => {
  if (!isGroup(ctx)) return;

  const session =
    ahkamSessions.get(
      ctx.chat.id
    );

  if (!session) return;

  if (
    ctx.from.id !==
    session.starterId
  ) {
    return;
  }

  const participants =
    [...session.participants.values()];

  if (participants.length < 2) {
    await ctx.reply(
      "يجب وجود مشاركين اثنين على الأقل."
    );
    return;
  }

  const shuffled =
    participants.sort(
      () => Math.random() - 0.5
    );

  const judge =
    shuffled[0];

  const judged =
    shuffled[1];

  await ctx.reply(
    `الحاكم: ${judge.first_name}\nالمحكوم عليه: ${judged.first_name}\n\nالتحدي: اختر له تحدياً آمناً داخل القروب.`
  );
});

bot.hears(/^انهاء احكام$/, async ctx => {
  if (!isGroup(ctx)) return;

  const session =
    ahkamSessions.get(
      ctx.chat.id
    );

  if (!session) return;

  if (
    session.starterId !==
    ctx.from.id
  ) {
    return;
  }

  ahkamSessions.delete(
    ctx.chat.id
  );

  await ctx.reply(
    "تم إنهاء لعبة الأحكام."
  );
});

// ============================================================
// WHISPERS
// ============================================================

const whisperSessions = new Map();

bot.hears(/^(اهمس|همسه|ه)$/, async ctx => {
  if (!isGroup(ctx)) return;

  const target =
    await requireReply(ctx);

  if (!target) return;

  if (
    target.id ===
    ctx.from.id
  ) {
    await ctx.reply(
      "لا يمكنك إرسال همسة لنفسك."
    );
    return;
  }

  const whisperId =
    randomId();

  await Whisper.create({
    whisperId,
    chatId: ctx.chat.id,
    senderId: ctx.from.id,
    receiverId: target.id,
    status: "pending"
  });

  const username =
    ctx.botInfo?.username;

  if (!username) {
    await ctx.reply(
      "تعذر إنشاء رابط الهمسة."
    );
    return;
  }

  const url =
    `https://t.me/${username}?start=whisper_${whisperId}`;

  await ctx.reply(
    `• تم تحديد الهمسه لـ ↤ ${target.first_name}`,
    Markup.inlineKeyboard([
      [
        Markup.button.url(
          "اهمس هنا",
          url
        )
      ]
    ])
  );
});

// ============================================================
// /start WHISPER
// ============================================================

bot.start(async ctx => {
  if (isPrivate(ctx)) {
    await ensureUser(ctx.from);

    const payload =
      ctx.startPayload;

    if (
      payload &&
      payload.startsWith("whisper_")
    ) {
      const whisperId =
        payload.slice(
          "whisper_".length
        );

      const whisper =
        await Whisper.findOne({
          whisperId
        });

      if (!whisper) {
        await ctx.reply(
          "انتهت صلاحية الهمسة."
        );
        return;
      }

      if (
        ctx.from.id !==
        whisper.senderId
      ) {
        await ctx.reply(
          "هذه الهمسة ليست لك."
        );
        return;
      }

      whisperSessions.set(
        ctx.from.id,
        whisperId
      );

      await ctx.reply(
        "• أرسل الآن الهمسة\n• يمكنك إرسال نص أو ملصق أو صورة أو قيف\n-"
      );

      return;
    }

    await ctx.reply(
      "أهلاً بك في بوت ايف."
    );
  }
});

// ============================================================
// WHISPER CONTENT
// ============================================================

bot.on(
  ["text", "photo", "sticker", "animation", "video"],
  async ctx => {
    if (!isPrivate(ctx)) return;

    const whisperId =
      whisperSessions.get(
        ctx.from.id
      );

    if (!whisperId) return;

    const whisper =
      await Whisper.findOne({
        whisperId
      });

    if (!whisper) {
      whisperSessions.delete(
        ctx.from.id
      );

      await ctx.reply(
        "انتهت صلاحية الهمسة."
      );

      return;
    }

    if (
      whisper.senderId !==
      ctx.from.id
    ) {
      return;
    }

    try {
      let type;
      let fileId = null;
      let text = null;
      let caption = null;

      if (ctx.message.text) {
        type = "text";
        text =
          ctx.message.text;
      }

      else if (
        ctx.message.photo
      ) {
        type = "photo";

        const photo =
          ctx.message.photo[
            ctx.message.photo.length - 1
          ];

        fileId =
          photo.file_id;

        caption =
          ctx.message.caption || null;
      }

      else if (
        ctx.message.sticker
      ) {
        type = "sticker";

        fileId =
          ctx.message.sticker.file_id;
      }

      else if (
        ctx.message.animation
      ) {
        type = "animation";

        fileId =
          ctx.message.animation.file_id;

        caption =
          ctx.message.caption || null;
      }

      else if (
        ctx.message.video
      ) {
        type = "video";

        fileId =
          ctx.message.video.file_id;

        caption =
          ctx.message.caption || null;
      }

      if (!type) return;

      whisper.type = type;
      whisper.fileId = fileId;
      whisper.text = text;
      whisper.caption = caption;
      whisper.status = "sent";

      await whisper.save();

      whisperSessions.delete(
        ctx.from.id
      );

      await ctx.reply(
        "• تم ارسال الهمسة"
      );

      const senderMention =
        mention(ctx.from);

      let notification =
        `• ياحلو ↤ ${mention({
          id: whisper.receiverId,
          first_name: "المستلم"
        })}\n`;

      notification +=
        `• وصلتك همسة سرية من ↤ ${senderMention}\n`;
      notification +=
        "• انت وحدك تقدر تشوفها";

      const receiverButtons =
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "رؤية الهمسة",
              `wv:${whisper.whisperId}`
            )
          ],
          [
            Markup.button.callback(
              "رد على الهمسة",
              `wr:${whisper.whisperId}`
            )
          ]
        ]);

      await ctx.telegram.sendMessage(
        whisper.receiverId,
        notification,
        {
          parse_mode: "MarkdownV2",
          ...receiverButtons
        }
      );

    } catch (e) {
      console.error(
        "WHISPER:",
        e.message
      );

      await ctx.reply(
        "تعذر إرسال الهمسة."
      );
    }
  }
);

// ============================================================
// VIEW WHISPER
// ============================================================

bot.action(/^wv:(.+)$/, async ctx => {
  const whisper =
    await Whisper.findOne({
      whisperId: ctx.match[1]
    });

  if (!whisper) {
    await ctx.answerCbQuery(
      "الهمسة غير موجودة.",
      { show_alert: true }
    );
    return;
  }

  if (
    ctx.from.id !==
    whisper.receiverId
  ) {
    await ctx.answerCbQuery(
      "هذه الهمسة ليست لك.",
      { show_alert: true }
    );
    return;
  }

  try {
    if (whisper.type === "text") {
      await ctx.reply(
        `الهمسة:\n\n${whisper.text || ""}`
      );
    }

    if (whisper.type === "photo") {
      await ctx.replyWithPhoto(
        whisper.fileId,
        {
          caption:
            whisper.caption || ""
        }
      );
    }

    if (whisper.type === "sticker") {
      await ctx.replyWithSticker(
        whisper.fileId
      );
    }

    if (whisper.type === "animation") {
      await ctx.replyWithAnimation(
        whisper.fileId,
        {
          caption:
            whisper.caption || ""
        }
      );
    }

    if (whisper.type === "video") {
      await ctx.replyWithVideo(
        whisper.fileId,
        {
          caption:
            whisper.caption || ""
        }
      );
    }

    whisper.status = "viewed";

    await whisper.save();

    try {
      await ctx.telegram.sendMessage(
        whisper.senderId,
        "• شاف همستك ."
      );
    } catch {}

    await ctx.answerCbQuery();
  } catch {
    await ctx.answerCbQuery(
      "تعذر عرض الهمسة.",
      { show_alert: true }
    );
  }
});

// ============================================================
// WHISPER REPLY
// ============================================================

bot.action(/^wr:(.+)$/, async ctx => {
  const whisper =
    await Whisper.findOne({
      whisperId: ctx.match[1]
    });

  if (!whisper) {
    await ctx.answerCbQuery(
      "الهمسة غير موجودة.",
      { show_alert: true }
    );
    return;
  }

  if (
    ctx.from.id !==
    whisper.receiverId
  ) {
    await ctx.answerCbQuery(
      "هذه الهمسة ليست لك.",
      { show_alert: true }
    );
    return;
  }

  const replyId =
    randomId();

  await Whisper.create({
    whisperId: replyId,
    parentId: whisper.whisperId,
    chatId: whisper.chatId,
    senderId: whisper.receiverId,
    receiverId: whisper.senderId,
    status: "pending"
  });

  whisperSessions.set(
    ctx.from.id,
    replyId
  );

  await ctx.answerCbQuery();

  await ctx.reply(
    "• أرسل الآن رد الهمسة\n• يمكنك إرسال نص أو ملصق أو صورة أو قيف\n-"
  );
});

// ============================================================
// BROADCAST
// ============================================================

const broadcastSessions = new Map();

bot.hears(/^إذاعة$/, async ctx => {
  if (!isPrivate(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      0
    );

  if (rank !== "Dev🎖️") {
    await ctx.reply(
      rankError("Dev🎖️")
    );
    return;
  }

  broadcastSessions.set(
    ctx.from.id,
    {
      waiting: true
    }
  );

  await ctx.reply(
    "• أرسل الآن محتوى الإذاعة"
  );
});

// ============================================================
// BROADCAST CONTENT
// ============================================================

bot.on(
  ["text", "photo", "sticker", "animation", "video"],
  async ctx => {
    if (!isPrivate(ctx)) return;

    const session =
      broadcastSessions.get(
        ctx.from.id
      );

    if (
      !session ||
      !session.waiting
    ) {
      return;
    }

    const rank =
      await getUserRank(
        ctx.from.id,
        0
      );

    if (rank !== "Dev🎖️") {
      broadcastSessions.delete(
        ctx.from.id
      );
      return;
    }

    session.waiting = false;
    session.message = ctx.message;

    await ctx.reply(
      "• هل تريد إرسال هذه الرسالة لجميع المشتركين؟",
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "تأكيد الإذاعة",
            `bc_yes:${ctx.from.id}`
          ),
          Markup.button.callback(
            "إلغاء",
            `bc_no:${ctx.from.id}`
          )
        ]
      ])
    );
  }
);

// ============================================================
// BROADCAST CONFIRM
// ============================================================

bot.action(/^bc_yes:(\d+)$/, async ctx => {
  const ownerId =
    Number(ctx.match[1]);

  if (
    ctx.from.id !== ownerId
  ) {
    await ctx.answerCbQuery(
      "هذه الإذاعة ليست لك."
    );
    return;
  }

  const rank =
    await getUserRank(
      ctx.from.id,
      0
    );

  if (rank !== "Dev🎖️") {
    await ctx.answerCbQuery(
      "ليس لديك الصلاحية.",
      { show_alert: true }
    );
    return;
  }

  const session =
    broadcastSessions.get(
      ownerId
    );

  if (!session?.message) {
    await ctx.answerCbQuery(
      "انتهت جلسة الإذاعة.",
      { show_alert: true }
    );
    return;
  }

  const users =
    await User.find({
      subscribers: true
    });

  let sent = 0;
  let failed = 0;

  await ctx.editMessageText(
    "جاري تنفيذ الإذاعة..."
  );

  for (const user of users) {
    try {
      await ctx.telegram.copyMessage(
        user.userId,
        ctx.chat.id,
        session.message.message_id
      );

      sent++;
    } catch {
      failed++;
    }
  }

  broadcastSessions.delete(
    ownerId
  );

  await ctx.reply(
    `• تمت الإذاعة بنجاح\n• تم الإرسال لـ ↤ ${sent}\n• تعذر الإرسال لـ ↤ ${failed}`
  );
});

bot.action(/^bc_no:(\d+)$/, async ctx => {
  if (
    ctx.from.id !==
    Number(ctx.match[1])
  ) {
    await ctx.answerCbQuery(
      "هذه الإذاعة ليست لك."
    );
    return;
  }

  broadcastSessions.delete(
    ctx.from.id
  );

  await ctx.editMessageText(
    "تم إلغاء الإذاعة."
  );
});

// ============================================================
// DEV COMMANDS
// ============================================================

const DEV_COMMANDS = [
  "ا",
  "ت",
  "ق",
  "م",
  "ن",
  "ح",
  "د"
];

for (const command of DEV_COMMANDS) {
  bot.hears(
    new RegExp(
      `^${command}$`
    ),
    async ctx => {
      if (!isGroup(ctx)) return;

      const rank =
        await getUserRank(
          ctx.from.id,
          ctx.chat.id
        );

      if (rank !== "Dev🎖️") {
        await ctx.reply(
          rankError("Dev🎖️")
        );
        return;
      }

      const responses = {
        "ا": "معلومات الحساب",
        "ت": "التوب",
        "ق": "القوانين",
        "م": "معلومات القروب",
        "ن": "المنشنات",
        "ح": "حالة القروب",
        "د": "رابط القروب"
      };

      await ctx.reply(
        `• ${responses[command]}`
      );
    }
  );
}

// ============================================================
// MAIN MENU
// ============================================================

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
        "menu:protect"
      ),
      Markup.button.callback(
        "التفاعل والألعاب والفعاليات",
        "menu:games"
      )
    ],
    [
      Markup.button.callback(
        "الهمسات والأغاني",
        "menu:music"
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
  await ctx.reply(
    "قائمة أوامر البوت الرئيسية:",
    mainMenu()
  );
});

const MENU_TEXT = {
  dev:
    "أوامر المطور:\n\nا\nت\nق\nم\nن\nح\nد",

  ranks:
    "أوامر الرتب:\n\nرفع مميز\nرفع مالك\nرفع مالك أساسي\nرفع Myth\nرفع Myth 🎖️\nرفع Dev²🎖️\nتنزيل\nرتبتي\nرتبته",

  protect:
    "أوامر الحماية:\n\nكتم\nتقييد\nحظر\nطرد\nفك الكتم\nالغاء التقييد\nقفل الحماية\nفتح الحماية\nمنع الكلمه\nالغاء منع الكلمه\nالكلمات الممنوعه",

  games:
    "التفاعل والألعاب والفعاليات:\n\nتفاعلي\nرتبتي\nالمتفاعلين\nرتبته\nتفاعله\nصور\nكلمة\nترتيب\nمقال\nجملة\nحروف\nخمن\nلغز\nصح أو خطأ\nأكمل\nمقلوب\nفكك\nإيموجي\nسرعة\nحساب\nذاكرة\nمن أنا\nكلمة السر\nاحكام",

  music:
    "الهمسات والأغاني:\n\nاهمس\nهمسه\nه\nبحث أغنية\nتشغيل\nإيقاف\nاستئناف\nتخطي\nإلغاء\nالأغنية\nقائمة التشغيل\nمسح القائمة",

  custom:
    "الأوامر المخصصة:\n\nاضف امر\nاضف رد\nحذف امر\nحذف رد\nاوامري\nردودي",

  group:
    "أوامر القروب:\n\nالمالك\nصلاحياتي\nصلاحياته\nقناتي\nاضف قناة\nتعديل قناتي\nحذف قناتي\n@all\nفتح المنشن\nغلق المنشن"
};

for (const key of Object.keys(MENU_TEXT)) {
  bot.action(
    `menu:${key}`,
    async ctx => {
      await ctx.editMessageText(
        MENU_TEXT[key],
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
    }
  );
}

bot.action(
  "menu:back",
  async ctx => {
    await ctx.editMessageText(
      "قائمة أوامر البوت الرئيسية:",
      mainMenu()
    );

    await ctx.answerCbQuery();
  }
);

// ============================================================
// CUSTOM SESSION HANDLER
// ============================================================

bot.on("text", async ctx => {
  if (!isGroup(ctx)) return;

  const session =
    customSessions.get(
      ctx.from.id
    );

  if (!session) return;

  if (
    session.chatId !==
    ctx.chat.id
  ) {
    return;
  }

  const text =
    ctx.message.text.trim();

  if (
    session.type === "cmd"
  ) {
    customSessions.set(
      ctx.from.id,
      {
        type: "cmd_response",
        chatId: ctx.chat.id,
        key: text
      }
    );

    await ctx.reply(
      "• أرسل الآن رد الأمر"
    );

    return;
  }

  if (
    session.type === "cmd_response"
  ) {
    await CustomCommand.updateOne(
      {
        chatId: ctx.chat.id,
        type: "cmd",
        key: session.key
      },
      {
        chatId: ctx.chat.id,
        type: "cmd",
        key: session.key,
        value: text,
        createdBy: ctx.from.id
      },
      {
        upsert: true
      }
    );

    customSessions.delete(
      ctx.from.id
    );

    await ctx.reply(
      "• تم إضافة الأمر بنجاح"
    );

    return;
  }

  if (
    session.type === "reply"
  ) {
    await CustomCommand.updateOne(
      {
        chatId: ctx.chat.id,
        type: "reply",
        key: session.key
      },
      {
        chatId: ctx.chat.id,
        type: "reply",
        key: session.key,
        value: text,
        createdBy: ctx.from.id
      },
      {
        upsert: true
      }
    );

    customSessions.delete(
      ctx.from.id
    );

    await ctx.reply(
      "• تم إضافة الرد بنجاح"
    );
  }
});

// ============================================================
// CHANNEL SESSION HANDLER
// ============================================================

bot.on("text", async ctx => {
  if (!isGroup(ctx)) return;

  const session =
    channelSessions.get(
      ctx.from.id
    );

  if (!session) return;

  if (
    session.chatId !==
    ctx.chat.id
  ) {
    return;
  }

  const url =
    ctx.message.text.trim();

  if (
    !/^https?:\/\/t\.me\//i.test(url) &&
    !/^@/.test(url)
  ) {
    await ctx.reply(
      "يرجى إرسال رابط قناة Telegram صحيح."
    );
    return;
  }

  await Channel.updateOne(
    {
      userId: ctx.from.id,
      chatId: ctx.chat.id
    },
    {
      userId: ctx.from.id,
      chatId: ctx.chat.id,
      channelUrl: url
    },
    {
      upsert: true
    }
  );

  channelSessions.delete(
    ctx.from.id
  );

  await ctx.reply(
    "تم حفظ قناتك بنجاح."
  );
});

// ============================================================
// BANNED WORD PROTECTION
// ============================================================

bot.on("text", async ctx => {
  if (!isGroup(ctx)) return;

  const settings =
    await getSettings(ctx.chat.id);

  if (settings.protectionLocked) {
    return;
  }

  const text =
    ctx.message.text
      .toLowerCase();

  const banned =
    await BannedWord.find({
      chatId: ctx.chat.id
    });

  if (!banned.length) return;

  const matched =
    banned.find(item =>
      text.includes(
        item.word.toLowerCase()
      )
    );

  if (!matched) return;

  const userRank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(userRank) >=
    rankLevel("Myth")
  ) {
    return;
  }

  try {
    await ctx.deleteMessage();

    await ctx.telegram.restrictChatMember(
      ctx.chat.id,
      ctx.from.id,
      {
        permissions: {
          can_send_messages: false
        },
        until_date:
          Math.floor(
            Date.now() / 1000
          ) + 60
      }
    );
  } catch {}
});

// ============================================================
// MUSIC SEARCH
// ============================================================

let ytSearch = null;

try {
  ytSearch =
    require("yt-search");
} catch {
  console.log(
    "yt-search غير مثبت؛ بحث الأغاني لن يعمل حتى يتم تثبيته."
  );
}

const musicQueues = new Map();

bot.hears(/^بحث أغنية (.+)$/s, async ctx => {
  if (!isGroup(ctx)) return;

  if (!ytSearch) {
    await ctx.reply(
      "ميزة بحث الأغاني تحتاج تثبيت yt-search."
    );
    return;
  }

  const query =
    ctx.match[1].trim();

  if (!query) return;

  try {
    const result =
      await ytSearch(query);

    const videos =
      result.videos.slice(0, 5);

    if (!videos.length) {
      await ctx.reply(
        "لم يتم العثور على نتائج."
      );
      return;
    }

    const buttons =
      videos.map((video, index) => [
        Markup.button.callback(
          `${index + 1}. ${video.title.slice(0, 45)}`,
          `song:${ctx.chat.id}:${index}`
        )
      ]);

    const key =
      `${ctx.chat.id}:${ctx.from.id}`;

    musicQueues.set(
      key,
      {
        search: videos,
        createdAt: Date.now()
      }
    );

    let text =
      "نتائج البحث:\n\n";

    videos.forEach(
      (video, index) => {
        text +=
          `${index + 1}. ${video.title}\n`;
        text +=
          `الفنان: ${video.author?.name || "غير محدد"}\n`;
        text +=
          `المدة: ${video.timestamp || "غير محددة"}\n\n`;
      }
    );

    await ctx.reply(
      text,
      Markup.inlineKeyboard(buttons)
    );

  } catch {
    await ctx.reply(
      "فشل البحث عن الأغنية."
    );
  }
});

bot.action(
  /^song:(-?\d+):(\d+)$/,
  async ctx => {
    const chatId =
      Number(ctx.match[1]);

    const index =
      Number(ctx.match[2]);

    if (
      ctx.chat.type !== "group" &&
      ctx.chat.type !== "supergroup"
    ) {
      await ctx.answerCbQuery();
      return;
    }

    if (
      ctx.chat.id !== chatId
    ) {
      await ctx.answerCbQuery(
        "الجلسة ليست لهذا القروب."
      );
      return;
    }

    const key =
      `${chatId}:${ctx.from.id}`;

    const data =
      musicQueues.get(key);

    if (!data) {
      await ctx.answerCbQuery(
        "انتهت نتائج البحث.",
        { show_alert: true }
      );
      return;
    }

    const video =
      data.search[index];

    if (!video) {
      await ctx.answerCbQuery(
        "الأغنية غير موجودة.",
        { show_alert: true }
      );
      return;
    }

    if (
      !musicQueues.has(
        String(chatId)
      )
    ) {
      musicQueues.set(
        String(chatId),
        []
      );
    }

    const queue =
      musicQueues.get(
        String(chatId)
      );

    if (!Array.isArray(queue)) {
      musicQueues.set(
        String(chatId),
        []
      );
    }

    const groupQueue =
      musicQueues.get(
        String(chatId)
      );

    groupQueue.push({
      title: video.title,
      artist:
        video.author?.name ||
        "غير محدد",
      duration:
        video.timestamp ||
        "غير محددة",
      url: video.url,
      requester:
        ctx.from.first_name,
      requesterId:
        ctx.from.id
    });

    await ctx.answerCbQuery(
      "تمت إضافة الأغنية للقائمة."
    );

    await ctx.reply(
      `تمت إضافة الأغنية إلى قائمة الانتظار.\n\n${video.title}\nالفنان: ${video.author?.name || "غير محدد"}\nالمدة: ${video.timestamp || "غير محددة"}`
    );
  }
);

// ============================================================
// MUSIC QUEUE COMMANDS
// ============================================================

bot.hears(/^قائمة التشغيل$/, async ctx => {
  if (!isGroup(ctx)) return;

  const queue =
    musicQueues.get(
      String(ctx.chat.id)
    ) || [];

  if (!queue.length) {
    await ctx.reply(
      "قائمة التشغيل فارغة."
    );
    return;
  }

  let text =
    "قائمة التشغيل\n━━━━━━━━━━━━━━\n";

  queue.forEach(
    (song, index) => {
      text +=
        `${index + 1}. ${song.title}\n`;
    }
  );

  await ctx.reply(text);
});

bot.hears(/^مسح القائمة$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("مالك")
  ) {
    await ctx.reply(
      rankError("مالك")
    );
    return;
  }

  musicQueues.delete(
    String(ctx.chat.id)
  );

  await ctx.reply(
    "تم مسح قائمة التشغيل."
  );
});

bot.hears(/^إلغاء$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("مالك")
  ) {
    await ctx.reply(
      rankError("مالك")
    );
    return;
  }

  musicQueues.delete(
    String(ctx.chat.id)
  );

  await ctx.reply(
    "تم إلغاء قائمة التشغيل."
  );
});

bot.hears(/^إيقاف$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("مميز")
  ) {
    await ctx.reply(
      rankError("مميز")
    );
    return;
  }

  await ctx.reply(
    "تم إيقاف التشغيل."
  );
});

bot.hears(/^استئناف$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("مميز")
  ) {
    await ctx.reply(
      rankError("مميز")
    );
    return;
  }

  await ctx.reply(
    "تم استئناف التشغيل."
  );
});

bot.hears(/^تخطي$/, async ctx => {
  if (!isGroup(ctx)) return;

  const rank =
    await getUserRank(
      ctx.from.id,
      ctx.chat.id
    );

  if (
    rankLevel(rank) <
    rankLevel("مميز")
  ) {
    await ctx.reply(
      rankError("مميز")
    );
    return;
  }

  const queue =
    musicQueues.get(
      String(ctx.chat.id)
    ) || [];

  if (queue.length) {
    queue.shift();
  }

  await ctx.reply(
    "تم تخطي الأغنية."
  );
});

bot.hears(/^الأغنية$/, async ctx => {
  if (!isGroup(ctx)) return;

  const queue =
    musicQueues.get(
      String(ctx.chat.id)
    ) || [];

  if (!queue.length) {
    await ctx.reply(
      "لا توجد أغنية حالية."
    );
    return;
  }

  const song =
    queue[0];

  await ctx.reply(
    `الأغنية الحالية\n━━━━━━━━━━━━━━\nالعنوان: ${song.title}\nالفنان: ${song.artist}\nالمدة: ${song.duration}\nالطلب بواسطة: ${song.requester}`
  );
});

// ============================================================
// FINAL ERROR HANDLER
// ============================================================

bot.catch(
  (err, ctx) => {
    console.error(
      "BOT ERROR:",
      err
    );

    try {
      ctx.reply(
        "حدث خطأ غير متوقع."
      );
    } catch {}
  }
);

// ============================================================
// LAUNCH
// ============================================================

bot.launch()
  .then(() => {
    console.log(
      "تم تشغيل بوت ايف بنجاح"
    );
  })
  .catch(err => {
    console.error(
      "فشل تشغيل البوت:",
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
