const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");

/* =========================================================
   الإعدادات
========================================================= */

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

/* =========================================================
   بحث الأغاني
========================================================= */

let ytSearch = null;

try {
  ytSearch = require("yt-search");
  console.log("yt-search loaded successfully.");
} catch {
  console.log("yt-search غير مثبت. استخدم: npm i yt-search");
}

/* =========================================================
   البيانات
========================================================= */

const DEFAULT_DATA = {
  users: {},
  groups: {},
  subscribers: []
};

let data = loadData();

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(DEFAULT_DATA, null, 2)
      );

      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }

    const parsed = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    return {
      ...DEFAULT_DATA,
      ...parsed,
      users: parsed.users || {},
      groups: parsed.groups || {},
      subscribers: parsed.subscribers || []
    };
  } catch (error) {
    console.error("LOAD ERROR:", error);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2)
    );
  } catch (error) {
    console.error("SAVE ERROR:", error);
  }
}

/* =========================================================
   الرتب
========================================================= */

const ROLES = {
  عضو: 0,
  مميز: 1,
  مالك: 2,
  "مالك أساسي": 3,
  Myth: 4,
  "Myth🎖️": 5,
  "Dev²🎖️": 6,
  "Dev🎖️": 7
};

function roleName(level) {
  for (const [name, value] of Object.entries(ROLES)) {
    if (value === Number(level)) return name;
  }

  return "عضو";
}

/* =========================================================
   المستخدم
========================================================= */

function ensureUser(userId) {
  const id = String(userId);

  if (!data.users[id]) {
    data.users[id] = {
      id: Number(userId),
      username: "",
      first_name: "",
      role: 0,
      money: 0,
      title: "",
      channel: "",
      interactions: {},
      whispers: []
    };
  }

  const user = data.users[id];

  user.id = Number(userId);
  user.role = Number(user.role || 0);
  user.money = Number(user.money || 0);
  user.username ||= "";
  user.first_name ||= "";
  user.title ||= "";
  user.channel ||= "";
  user.interactions ||= {};
  user.whispers ||= [];

  return user;
}

/* =========================================================
   القروب
========================================================= */

function ensureGroup(chatId) {
  const id = String(chatId);

  if (!data.groups[id]) {
    data.groups[id] = {
      id: Number(chatId),
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
      botReplies: true,
      musicEnabled: true,
      adminPermissions: {},
      games: {},
      judgments: {}
    };
  }

  const group = data.groups[id];

  group.users ||= {};
  group.muted ||= {};
  group.globalMuted ||= {};
  group.trackedMessages ||= [];
  group.interactions ||= {};
  group.customCommands ||= {};
  group.customReplies ||= {};
  group.marriages ||= {};
  group.forbiddenWords ||= {};
  group.adminPermissions ||= {};
  group.games ||= {};
  group.judgments ||= {};

  if (!Array.isArray(group.forbiddenWords)) {
    group.forbiddenWords = [];
  }

  group.violationsEnabled =
    group.violationsEnabled !== false;

  group.autoClean =
    group.autoClean === true;

  group.linksEnabled =
    group.linksEnabled !== false;

  group.groupOpen =
    group.groupOpen !== false;

  group.mentionEnabled =
    group.mentionEnabled !== false;

  group.gamesEnabled =
    group.gamesEnabled !== false;

  group.botReplies =
    group.botReplies !== false;

  group.musicEnabled =
    group.musicEnabled !== false;

  return group;
}

/* =========================================================
   المطور
========================================================= */

const DEV_USERNAME = "j4xa7";

function isDeveloper(userId) {
  const user = ensureUser(userId);

  return String(user.username || "").toLowerCase() ===
    DEV_USERNAME.toLowerCase();
}

function getUserLevel(userId) {
  const user = ensureUser(userId);

  if (isDeveloper(userId)) return 7;

  return Number(user.role || 0);
}

function getChatUser(ctx, userId) {
  const group = ensureGroup(ctx.chat.id);
  const user = ensureUser(userId);
  const id = String(userId);

  group.users[id] ||= {
    id: Number(userId),
    username: "",
    first_name: "",
    role: 0
  };

  const saved = group.users[id];

  if (ctx.from?.id === userId) {
    saved.username =
      ctx.from.username ||
      saved.username ||
      "";

    saved.first_name =
      ctx.from.first_name ||
      saved.first_name ||
      "";
  }

  if (user.username) saved.username = user.username;
  if (user.first_name) saved.first_name = user.first_name;

  return saved;
}

function getLevel(ctx, userId) {
  if (isDeveloper(userId)) return 7;

  const user = ensureUser(userId);
  const groupUser = getChatUser(ctx, userId);

  return Math.max(
    Number(user.role || 0),
    Number(groupUser.role || 0)
  );
}

/* =========================================================
   HTML + المنشن + اللقب
========================================================= */

function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mention(user) {
  if (!user?.id) return "المستخدم";

  const saved = ensureUser(user.id);

  const name =
    user.first_name ||
    user.username ||
    saved.first_name ||
    saved.username ||
    "المستخدم";

  const title =
    saved.title ||
    user.title ||
    "";

  const displayName = title
    ? `${name}「${title}」`
    : name;

  return `<a href="tg://user?id=${user.id}">${escapeHtml(
    displayName
  )}</a>`;
}

/* =========================================================
   الرد
========================================================= */

async function replyCommand(ctx, text, extra = {}) {
  try {
    return await ctx.reply(text, {
      parse_mode: "HTML",
      reply_parameters: ctx.message?.message_id
        ? { message_id: ctx.message.message_id }
        : undefined,
      ...extra
    });
  } catch {
    try {
      return await ctx.reply(text, {
        parse_mode: "HTML",
        ...extra
      });
    } catch {}
  }
}

/* =========================================================
   المستخدم الذي تم الرد عليه
========================================================= */

async function getRepliedUser(ctx) {
  return ctx.message?.reply_to_message?.from || null;
}

/* =========================================================
   الرتب والصلاحيات
========================================================= */

function hasRank(ctx, level) {
  return getLevel(ctx, ctx.from.id) >= level;
}

function requireRank(ctx, level) {
  if (hasRank(ctx, level)) return true;

  replyCommand(
    ctx,
    `• هذا الامر يخص ↤ ｢ ${escapeHtml(
      roleName(level)
    )} ｣`
  );

  return false;
}

function canActOnTarget(ctx, target) {
  if (!target) return false;

  const actorLevel = getLevel(ctx, ctx.from.id);
  const targetLevel = getLevel(ctx, target.id);

  if (actorLevel <= targetLevel) {
    replyCommand(
      ctx,
      "• لا يمكن استخدام الامر على رتبه نفس رتبتك أو أعلى"
    );

    return false;
  }

  return true;
}

/* =========================================================
   تحديث بيانات المستخدم
========================================================= */

bot.use(async (ctx, next) => {
  try {
    if (ctx.from) {
      const user = ensureUser(ctx.from.id);

      user.username = ctx.from.username || "";
      user.first_name = ctx.from.first_name || "";

      if (
        String(ctx.from.username || "").toLowerCase() ===
        DEV_USERNAME.toLowerCase()
      ) {
        user.role = 7;
      }
    }

    if (
      ctx.chat &&
      ctx.chat.type !== "private" &&
      ctx.from
    ) {
      const group = ensureGroup(ctx.chat.id);
      const id = String(ctx.from.id);

      group.users[id] ||= {
        id: ctx.from.id,
        username: "",
        first_name: "",
        role: 0
      };

      group.users[id].username =
        ctx.from.username ||
        group.users[id].username ||
        "";

      group.users[id].first_name =
        ctx.from.first_name ||
        group.users[id].first_name ||
        "";
    }
  } catch {}

  return next();
});

/* =========================================================
   التفاعل
========================================================= */

function addInteraction(ctx) {
  if (!ctx.from || !ctx.chat) return;
  if (ctx.chat.type === "private") return;

  const group = ensureGroup(ctx.chat.id);
  const id = String(ctx.from.id);

  group.interactions[id] =
    Number(group.interactions[id] || 0) + 1;

  group.users[id] ||= {
    id: ctx.from.id,
    username: "",
    first_name: "",
    role: 0
  };

  group.users[id].username =
    ctx.from.username ||
    group.users[id].username ||
    "";

  group.users[id].first_name =
    ctx.from.first_name ||
    group.users[id].first_name ||
    "";
}

/* =========================================================
   نوع الرسالة
========================================================= */

function getMessageType(message) {
  if (!message) return "unknown";
  if (message.text) return "text";
  if (message.photo) return "photo";
  if (message.video) return "video";
  if (message.document) return "document";
  if (message.sticker) return "sticker";
  if (message.animation) return "animation";
  if (message.audio) return "audio";
  if (message.voice) return "voice";
  if (message.video_note) return "video_note";
  if (message.contact) return "contact";
  if (message.location) return "location";
  if (message.venue) return "venue";
  if (message.poll) return "poll";
  if (message.dice) return "dice";

  return "unknown";
}

function messageHasLink(message) {
  const text =
    message?.text ||
    message?.caption ||
    "";

  return /(https?:\/\/|www\.|t\.me\/)/i.test(text);
}

/* =========================================================
   تتبع الرسائل
========================================================= */

function trackMessage(ctx) {
  if (!ctx.message || !ctx.chat) return;
  if (ctx.chat.type === "private") return;

  const group = ensureGroup(ctx.chat.id);
  const msg = ctx.message;
  const type = getMessageType(msg);

  group.trackedMessages.push({
    messageId: msg.message_id,
    chatId: ctx.chat.id,
    userId: ctx.from?.id || 0,
    type,
    hasLink: messageHasLink(msg),
    date: Date.now()
  });

  if (group.trackedMessages.length > 2000) {
    group.trackedMessages =
      group.trackedMessages.slice(-2000);
  }
}

/* =========================================================
   الحماية
========================================================= */

async function handleProtection(ctx) {
  if (!ctx.message || !ctx.chat) return false;
  if (ctx.chat.type === "private") return false;

  const group = ensureGroup(ctx.chat.id);

  if (!group.violationsEnabled) return false;

  const text =
    ctx.message.text ||
    ctx.message.caption ||
    "";

  const level = getLevel(ctx, ctx.from.id);

  if (level >= 4) return false;

  if (
    !group.linksEnabled &&
    /(https?:\/\/|www\.|t\.me\/)/i.test(text)
  ) {
    try {
      await ctx.deleteMessage();
    } catch {}

    return true;
  }

  if (
    group.forbiddenWords.some(word =>
      text.toLowerCase().includes(
        String(word).toLowerCase()
      )
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

function isMuted(ctx) {
  const group = ensureGroup(ctx.chat.id);

  return !!group.muted[String(ctx.from.id)];
}

function isGlobalMuted(ctx) {
  const group = ensureGroup(ctx.chat.id);

  return !!group.globalMuted[String(ctx.from.id)];
}

/* =========================================================
   مراقبة الرسائل
========================================================= */

bot.on("message", async (ctx, next) => {
  try {
    if (ctx.chat?.type !== "private") {
      addInteraction(ctx);
      trackMessage(ctx);

      const blocked = await handleProtection(ctx);

      if (blocked) {
        saveData();
        return;
      }

      if (isMuted(ctx) || isGlobalMuted(ctx)) {
        try {
          await ctx.deleteMessage();
        } catch {}

        return;
      }

      const group = ensureGroup(ctx.chat.id);

      if (
        group.autoClean &&
        ctx.message &&
        messageHasLink(ctx.message)
      ) {
        try {
          await ctx.deleteMessage();
        } catch {}

        return;
      }
    }

    saveData();
  } catch (error) {
    console.error("MESSAGE ERROR:", error);
  }

  return next();
});

/* =========================================================
   الهمسات
========================================================= */

const whisperPending = new Map();
const whisperStore = new Map();
const whisperReplyPending = new Map();

function createWhisperId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 9)
  );
}

bot.start(async ctx => {
  const payload = ctx.startPayload || "";

  if (payload.startsWith("whisper_")) {
    const id = payload.substring(8);
    const pending = whisperPending.get(id);

    if (!pending) {
      return ctx.reply("• الهمسه غير موجوده أو انتهت");
    }

    if (ctx.from.id !== pending.senderId) {
      return ctx.reply("• فقط صاحب الهمسة يقدر يكتبها");
    }

    whisperStore.set(id, {
      ...pending,
      createdAt: Date.now()
    });

    whisperPending.delete(id);

    return ctx.reply(
      "• أرسل الآن الهمسة\n" +
      "• يمكنك إرسال نص أو ملصق أو صورة أو قيف\n-"
    );
  }

  if (payload.startsWith("whisperreply_")) {
    const id = payload.substring(14);
    const whisper = whisperStore.get(id);

    if (!whisper) {
      return ctx.reply("• الهمسه غير موجوده أو انتهت");
    }

    if (ctx.from.id !== whisper.recipientId) {
      return ctx.reply("• هذه الهمسه ليست لك");
    }

    whisperReplyPending.set(ctx.from.id, {
      originalId: id,
      recipientId: whisper.senderId,
      chatId: whisper.chatId
    });

    return ctx.reply(
      "• أرسل الآن ردك على الهمسة\n" +
      "• يمكنك إرسال نص أو ملصق أو صورة أو قيف\n-"
    );
  }

  if (
    ctx.chat.type === "private" &&
    !data.subscribers.includes(ctx.chat.id)
  ) {
    data.subscribers.push(ctx.chat.id);
    saveData();
  }

  return ctx.reply(
    `أهلا بك يا قلبي - ${mention(ctx.from)}\n\n` +
    `• انا اشغل لك اللي تبي بالمكالمه\n\n` +
    `ادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.`,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            "أضفني في مجموعتك",
            `https://t.me/${ctx.botInfo.username}?startgroup=true`
          )
        ],
        [
          Markup.button.url(
            "المطور",
            "https://t.me/j4xa7"
          )
        ]
      ])
    }
  );
});

bot.hears(
  /^(?:اهمس|همسه|ه)$/i,
  async ctx => {
    if (ctx.chat.type === "private") {
      return replyCommand(
        ctx,
        "• استخدم الهمسه داخل القروب بالرد على المستخدم"
      );
    }

    const target = await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم اللي تبي تهمس له"
      );
    }

    const id = createWhisperId();

    whisperPending.set(id, {
      senderId: ctx.from.id,
      sender: {
        id: ctx.from.id,
        first_name: ctx.from.first_name || "",
        username: ctx.from.username || ""
      },
      recipientId: target.id,
      recipient: {
        id: target.id,
        first_name: target.first_name || "",
        username: target.username || ""
      },
      chatId: ctx.chat.id
    });

    return replyCommand(
      ctx,
      `• تم تحديد الهمسه لـ ↤ ${mention(target)}\n` +
      `• اضغط «اهمس هنا» لكتابة الهمسة`,
      {
        ...Markup.inlineKeyboard([
          [
            Markup.button.url(
              "اهمس هنا",
              `https://t.me/${ctx.botInfo.username}?start=whisper_${id}`
            )
          ]
        ])
      }
    );
  }
);

async function getWhisperContent(message) {
  if (message.text) {
    return {
      type: "text",
      text: message.text
    };
  }

  if (message.sticker) {
    return {
      type: "sticker",
      file_id: message.sticker.file_id
    };
  }

  if (message.photo) {
    return {
      type: "photo",
      file_id:
        message.photo[message.photo.length - 1].file_id,
      caption: message.caption || ""
    };
  }

  if (message.animation) {
    return {
      type: "animation",
      file_id: message.animation.file_id,
      caption: message.caption || ""
    };
  }

  return null;
}

async function sendWhisperToGroup(ctx, whisper, whisperId) {
  try {
    await ctx.telegram.sendMessage(
      whisper.chatId,
      `• ياحلو ↤ ${mention(whisper.recipient)}\n\n` +
      `• وصلتك همسة سرية من ↤ ${mention(whisper.sender)}\n\n` +
      `• انت وحدك تقدر تشوفها`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "رؤية الهمسة",
              `whisper_view_${whisperId}`
            )
          ],
          [
            Markup.button.callback(
              "رد على الهمسة",
              `whisper_reply_${whisperId}`
            )
          ]
        ])
      }
    );
  } catch (error) {
    console.error(
      "SEND WHISPER ERROR:",
      error?.response?.description || error
    );
  }
}

bot.on("message", async (ctx, next) => {
  try {
    if (ctx.chat.type !== "private") {
      return next();
    }

    const replyPending =
      whisperReplyPending.get(ctx.from.id);

    if (replyPending) {
      const content =
        await getWhisperContent(ctx.message);

      if (!content) {
        return ctx.reply("• نوع الرسالة غير مدعوم");
      }

      const id = createWhisperId();

      const newWhisper = {
        senderId: ctx.from.id,
        sender: ctx.from,
        recipientId: replyPending.recipientId,
        recipient: {
          id: replyPending.recipientId,
          first_name: "",
          username: ""
        },
        chatId: replyPending.chatId,
        content,
        createdAt: Date.now()
      };

      whisperStore.set(id, newWhisper);
      whisperReplyPending.delete(ctx.from.id);

      try {
        await ctx.deleteMessage();
      } catch {}

      await ctx.reply("• تم ارسال الرد على الهمسة");

      await sendWhisperToGroup(
        ctx,
        newWhisper,
        id
      );

      return;
    }

    let foundId = null;
    let whisper = null;

    for (const [id, item] of whisperStore.entries()) {
      if (
        item.senderId === ctx.from.id &&
        !item.content
      ) {
        foundId = id;
        whisper = item;
        break;
      }
    }

    if (!whisper) return next();

    const content =
      await getWhisperContent(ctx.message);

    if (!content) {
      return ctx.reply("• نوع الرسالة غير مدعوم");
    }

    whisper.content = content;
    whisperStore.set(foundId, whisper);

    try {
      await ctx.deleteMessage();
    } catch {}

    await ctx.reply("• تم ارسال الهمسة");

    await sendWhisperToGroup(
      ctx,
      whisper,
      foundId
    );
  } catch (error) {
    console.error(
      "WHISPER PRIVATE ERROR:",
      error?.response?.description || error
    );

    return next();
  }
});

bot.action(
  /^whisper_view_(.+)$/,
  async ctx => {
    const whisper = whisperStore.get(ctx.match[1]);

    if (!whisper) {
      return ctx.answerCbQuery(
        "• الهمسه غير موجوده",
        { show_alert: true }
      );
    }

    if (ctx.from.id !== whisper.recipientId) {
      return ctx.answerCbQuery(
        "• هذه الهمسه ليست لك",
        { show_alert: true }
      );
    }

    if (!whisper.content) {
      return ctx.answerCbQuery(
        "• الهمسه لم يتم إرسال محتواها",
        { show_alert: true }
      );
    }

    const content = whisper.content;

    let text = "• الهمسة";

    if (content.type === "text") {
      text += `\n\n${content.text}`;
    } else if (content.type === "photo") {
      text += content.caption
        ? `\n\n${content.caption}`
        : "\n\n• الهمسة تحتوي على صورة";
    } else if (content.type === "sticker") {
      text += "\n\n• الهمسة عبارة عن ملصق";
    } else if (content.type === "animation") {
      text += content.caption
        ? `\n\n${content.caption}`
        : "\n\n• الهمسة تحتوي على قيف";
    }

    return ctx.answerCbQuery(
      text.slice(0, 195),
      { show_alert: true }
    );
  }
);

bot.action(
  /^whisper_reply_(.+)$/,
  async ctx => {
    const id = ctx.match[1];
    const whisper = whisperStore.get(id);

    if (!whisper) {
      return ctx.answerCbQuery(
        "• الهمسه غير موجوده",
        { show_alert: true }
      );
    }

    if (ctx.from.id !== whisper.recipientId) {
      return ctx.answerCbQuery(
        "• هذه الهمسه ليست لك",
        { show_alert: true }
      );
    }

    await ctx.answerCbQuery();

    whisperReplyPending.set(ctx.from.id, {
      originalId: id,
      recipientId: whisper.senderId,
      chatId: whisper.chatId
    });

    return ctx.reply(
      "• أرسل الآن ردك على الهمسة\n" +
      "• يمكنك إرسال نص أو ملصق أو صورة أو قيف\n-",
      {
        ...Markup.inlineKeyboard([
          [
            Markup.button.url(
              "إرسال الرد",
              `https://t.me/${ctx.botInfo.username}?start=whisperreply_${id}`
            )
          ]
        ])
      }
    );
  }
);

/* =========================================================
   التفاعل
========================================================= */

bot.hears(/^رتبتي$/i, async ctx => {
  return replyCommand(
    ctx,
    `• رتبتك ↤︎ ${escapeHtml(
      roleName(getLevel(ctx, ctx.from.id))
    )}`
  );
});

bot.hears(/^تفاعلي$/i, async ctx => {
  const group = ensureGroup(ctx.chat.id);
  const id = String(ctx.from.id);
  const count = Number(group.interactions[id] || 0);

  const ranking =
    Object.entries(group.interactions)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .findIndex(([userId]) => userId === id);

  return replyCommand(
    ctx,
    `• رتبتك ↤︎ ${escapeHtml(
      roleName(getLevel(ctx, ctx.from.id))
    )}\n` +
    `• عدد رسائل التفاعل ↤︎ ${count}\n` +
    `• ترتيبك بين المتفاعلين ↤︎ ${
      ranking >= 0 ? ranking + 1 : "-"
    }`
  );
});

bot.hears(/^المتفاعلين$/i, async ctx => {
  const group = ensureGroup(ctx.chat.id);

  const list =
    Object.entries(group.interactions)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 20);

  if (!list.length) {
    return replyCommand(ctx, "• لا يوجد متفاعلين");
  }

  const lines = list.map(([id, count], i) => {
    const member =
      group.users[id] || {
        id: Number(id),
        first_name: "مستخدم"
      };

    return `${i + 1}. ${mention(member)} ↤︎ ${count}`;
  });

  return replyCommand(
    ctx,
    "• المتفاعلين\n━━━━━━━━━━━\n" +
    lines.join("\n")
  );
});

bot.hears(/^رتبته$/i, async ctx => {
  const target = await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(ctx, "• لازم ترد على المستخدم");
  }

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n` +
    `• رتبته ↤︎ ${escapeHtml(
      roleName(getLevel(ctx, target.id))
    )}`
  );
});

bot.hears(/^تفاعله$/i, async ctx => {
  const target = await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(ctx, "• لازم ترد على المستخدم");
  }

  const group = ensureGroup(ctx.chat.id);
  const id = String(target.id);
  const count = Number(group.interactions[id] || 0);

  const ranking =
    Object.entries(group.interactions)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .findIndex(([userId]) => userId === id);

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n` +
    `• عدد رسائل التفاعل ↤︎ ${count}\n` +
    `• ترتيبه بين المتفاعلين ↤︎ ${
      ranking >= 0 ? ranking + 1 : "-"
    }`
  );
});

/* =========================================================
   رفع الرتب
========================================================= */

const promotionCommands = [
  [/^رفع مميز$/i, 1, "مميز", 2],
  [/^رفع مالك$/i, 2, "مالك", 3],
  [/^رفع مالك أساسي$/i, 3, "مالك أساسي", 5],
  [/^رفع اساس$/i, 3, "مالك أساسي", 5],
  [/^رفع Myth$/i, 4, "Myth", 5],
  [/^رفع M$/i, 4, "Myth", 5],
  [/^رفع Myth ?🎖️$/i, 5, "Myth🎖️", 6],
  [/^رفع My$/i, 5, "Myth🎖️", 6],
  [/^رفع اكس$/i, 5, "Myth🎖️", 6],
  [/^رفع Dev²$/i, 6, "Dev²🎖️", 7],
  [/^رفع مطور ثانوي$/i, 6, "Dev²🎖️", 7],
  [/^رفع ديف$/i, 7, "Dev🎖️", 7]
];

for (const [regex, level, name, required] of promotionCommands) {
  bot.hears(regex, async ctx => {
    if (!requireRank(ctx, required)) return;

    const target = await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(ctx, "• لازم ترد على المستخدم");
    }

    if (!canActOnTarget(ctx, target)) return;

    const user = ensureUser(target.id);

    user.role = level;
    user.username = target.username || "";
    user.first_name = target.first_name || "";

    const group = ensureGroup(ctx.chat.id);

    group.users[String(target.id)] ||= {
      id: target.id,
      username: target.username || "",
      first_name: target.first_name || "",
      role: 0
    };

    group.users[String(target.id)].role = level;

    saveData();

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(target)}\n` +
      `• تم رفعه (${escapeHtml(name)})`
    );
  });
}

bot.hears(/^تنزيل$/i, async ctx => {
  if (!requireRank(ctx, 2)) return;

  const target = await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(ctx, "• لازم ترد على المستخدم");
  }

  if (!canActOnTarget(ctx, target)) return;

  ensureUser(target.id).role = 0;

  const group = ensureGroup(ctx.chat.id);

  if (group.users[String(target.id)]) {
    group.users[String(target.id)].role = 0;
  }

  saveData();

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n` +
    `• تم تنزيل رتبته`
  );
});

/* =========================================================
   صلاحيات البوت
========================================================= */

async function getBotMember(ctx) {
  try {
    const me = await ctx.telegram.getMe();

    return await ctx.telegram.getChatMember(
      ctx.chat.id,
      me.id
    );
  } catch (error) {
    console.error(
      "BOT MEMBER ERROR:",
      error?.response?.description || error
    );

    return null;
  }
}

async function checkBotPermission(ctx, permission) {
  const member = await getBotMember(ctx);

  if (!member) {
    return {
      ok: false,
      message: "• ما قدرت أعرف صلاحيات البوت داخل القروب"
    };
  }

  if (
    member.status !== "administrator" &&
    member.status !== "creator"
  ) {
    return {
      ok: false,
      message: "• البوت ليس مشرفًا في القروب"
    };
  }

  if (
    permission &&
    member.status !== "creator" &&
    member[permission] !== true
  ) {
    const names = {
      can_restrict_members: "تقييد الأعضاء",
      can_promote_members: "إضافة المشرفين",
      can_delete_messages: "حذف الرسائل",
      can_change_info: "تغيير معلومات القروب",
      can_invite_users: "إضافة الأعضاء"
    };

    return {
      ok: false,
      message:
        `• البوت مشرف لكن ما عنده صلاحية ${names[permission] || permission}\n` +
        "• فعّل الصلاحية من إعدادات مشرفي القروب"
    };
  }

  return {
    ok: true,
    member
  };
}

async function getMemberStatus(ctx, userId) {
  try {
    return await ctx.telegram.getChatMember(
      ctx.chat.id,
      userId
    );
  } catch (error) {
    console.error(
      "GET MEMBER ERROR:",
      error?.response?.description || error
    );

    return null;
  }
}

/* =========================================================
   الكتم والتقييد
========================================================= */

const FULL_RESTRICT_PERMISSIONS = {
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
};

const FULL_OPEN_PERMISSIONS = {
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
};

async function telegramMute(ctx, userId) {
  const permission =
    await checkBotPermission(
      ctx,
      "can_restrict_members"
    );

  if (!permission.ok) {
    throw new Error(permission.message);
  }

  const target =
    await getMemberStatus(ctx, userId);

  if (target?.status === "creator") {
    throw new Error("• لا يمكن تقييد مالك القروب");
  }

  if (target?.status === "administrator") {
    throw new Error("• لا يمكن تقييد مشرف");
  }

  return ctx.telegram.restrictChatMember(
    ctx.chat.id,
    userId,
    { permissions: FULL_RESTRICT_PERMISSIONS }
  );
}

async function telegramUnmute(ctx, userId) {
  const permission =
    await checkBotPermission(
      ctx,
      "can_restrict_members"
    );

  if (!permission.ok) {
    throw new Error(permission.message);
  }

  return ctx.telegram.restrictChatMember(
    ctx.chat.id,
    userId,
    { permissions: FULL_OPEN_PERMISSIONS }
  );
}

const COMMAND_LEVELS = {
  mute: 4,
  globalMute: 5,
  restrict: 6,
  unrestrict: 3,
  unmute: 4,
  ban: 7,
  kick: 7,
  unban: 7
};

function requireModeration(ctx, key) {
  return requireRank(ctx, COMMAND_LEVELS[key]);
}

async function muteTarget(ctx, global = false) {
  const target = await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(ctx, "• لازم ترد على المستخدم");
  }

  if (!canActOnTarget(ctx, target)) return;

  const group = ensureGroup(ctx.chat.id);

  try {
    await telegramMute(ctx, target.id);
  } catch (error) {
    return replyCommand(
      ctx,
      error?.message?.startsWith("•")
        ? error.message
        : "• ما قدرت أكتم المستخدم\n• تأكد أن البوت مشرف وعنده صلاحية تقييد الأعضاء"
    );
  }

  const saved = {
    id: target.id,
    username: target.username || "",
    first_name: target.first_name || ""
  };

  if (global) {
    group.globalMuted[String(target.id)] = saved;
  } else {
    group.muted[String(target.id)] = saved;
  }

  saveData();

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n` +
    `• ${global ? "كتمته عام" : "كتمته"}`
  );
}

bot.hears(/^كتم$/i, async ctx => {
  if (!requireModeration(ctx, "mute")) return;
  return muteTarget(ctx, false);
});

bot.hears(/^(?:كتم عام|عام)$/i, async ctx => {
  if (!requireModeration(ctx, "globalMute")) return;
  return muteTarget(ctx, true);
});

bot.hears(/^فك الكتم$/i, async ctx => {
  if (!requireModeration(ctx, "unmute")) return;

  const target = await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(ctx, "• لازم ترد على المستخدم");
  }

  const group = ensureGroup(ctx.chat.id);

  try {
    await telegramUnmute(ctx, target.id);
  } catch (error) {
   
