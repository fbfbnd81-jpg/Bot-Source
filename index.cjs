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
} catch (error) {
  console.log("yt-search غير مثبت.");
  console.log("استخدم: npm i yt-search");
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

      return JSON.parse(
        JSON.stringify(DEFAULT_DATA)
      );
    }

    const raw =
      fs.readFileSync(DATA_FILE, "utf8");

    const parsed =
      JSON.parse(raw);

    return {
      ...DEFAULT_DATA,
      ...parsed,
      users: parsed.users || {},
      groups: parsed.groups || {},
      subscribers: parsed.subscribers || []
    };
  } catch (error) {
    console.error("LOAD ERROR:", error);

    return JSON.parse(
      JSON.stringify(DEFAULT_DATA)
    );
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
    if (value === Number(level)) {
      return name;
    }
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
      adminPermissions: {}
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
  group.forbiddenWords ||= [];

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

  group.adminPermissions ||= {};

  return group;
}

/* =========================================================
   المطور j4xa7
========================================================= */

const DEV_USERNAME = "j4xa7";

function isDeveloper(userId) {
  const user = ensureUser(userId);

  return (
    String(user.username || "").toLowerCase() ===
    DEV_USERNAME
  );
}

function getUserLevel(userId) {
  const user = ensureUser(userId);

  if (isDeveloper(userId)) {
    return 7;
  }

  return Number(user.role || 0);
}

function getChatUser(ctx, userId) {
  const group =
    ensureGroup(ctx.chat.id);

  const user =
    ensureUser(userId);

  const id =
    String(userId);

  if (!group.users[id]) {
    group.users[id] = {
      id: Number(userId),
      username: "",
      first_name: "",
      role: 0
    };
  }

  const saved =
    group.users[id];

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

  if (user.username) {
    saved.username =
      user.username;
  }

  if (user.first_name) {
    saved.first_name =
      user.first_name;
  }

  return saved;
}

function getLevel(ctx, userId) {
  if (isDeveloper(userId)) {
    return 7;
  }

  const user =
    ensureUser(userId);

  const globalLevel =
    Number(user.role || 0);

  const groupUser =
    getChatUser(ctx, userId);

  const groupLevel =
    Number(groupUser.role || 0);

  return Math.max(
    globalLevel,
    groupLevel
  );
}

/* =========================================================
   HTML + المنشن
========================================================= */

function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mention(user) {
  if (!user?.id) {
    return "المستخدم";
  }

  const name =
    user.first_name ||
    user.username ||
    "المستخدم";

  return `<a href="tg://user?id=${user.id}">${escapeHtml(name)}</a>`;
}

/* =========================================================
   الرد على الأمر
========================================================= */

async function replyCommand(
  ctx,
  text,
  extra = {}
) {
  try {
    return await ctx.reply(
      text,
      {
        parse_mode: "HTML",
        reply_parameters: ctx.message?.message_id
          ? {
              message_id:
                ctx.message.message_id
            }
          : undefined,
        ...extra
      }
    );
  } catch {
    try {
      return await ctx.reply(
        text,
        {
          parse_mode: "HTML",
          ...extra
        }
      );
    } catch {}
  }
}

/* =========================================================
   المستخدم الذي تم الرد عليه
========================================================= */

async function getRepliedUser(ctx) {
  const reply =
    ctx.message?.reply_to_message;

  if (!reply?.from) {
    return null;
  }

  return reply.from;
}

/* =========================================================
   الصلاحيات
========================================================= */

function hasRank(ctx, level) {
  return (
    getLevel(
      ctx,
      ctx.from.id
    ) >= level
  );
}

function requireRank(ctx, level) {
  if (hasRank(ctx, level)) {
    return true;
  }

  replyCommand(
    ctx,
    "• هذا الامر يخص ↤ ｢ " +
      escapeHtml(roleName(level)) +
      " ｣"
  );

  return false;
}

function canActOnTarget(
  ctx,
  target
) {
  if (!target) {
    return false;
  }

  const actorLevel =
    getLevel(ctx, ctx.from.id);

  const targetLevel =
    getLevel(ctx, target.id);

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
      const user =
        ensureUser(ctx.from.id);

      user.username =
        ctx.from.username || "";

      user.first_name =
        ctx.from.first_name || "";

      if (
        ctx.from.username &&
        ctx.from.username.toLowerCase() ===
          DEV_USERNAME
      ) {
        user.role = 7;
      }
    }

    if (
      ctx.chat &&
      ctx.chat.type !== "private" &&
      ctx.from
    ) {
      const group =
        ensureGroup(ctx.chat.id);

      const id =
        String(ctx.from.id);

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
  if (!ctx.from || !ctx.chat) {
    return;
  }

  if (ctx.chat.type === "private") {
    return;
  }

  const group =
    ensureGroup(ctx.chat.id);

  const id =
    String(ctx.from.id);

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
   تتبع الرسائل
========================================================= */

function trackMessage(ctx) {
  if (!ctx.message || !ctx.chat) {
    return;
  }

  if (ctx.chat.type === "private") {
    return;
  }

  const group =
    ensureGroup(ctx.chat.id);

  const msg =
    ctx.message;

  group.trackedMessages.push({
    messageId: msg.message_id,
    chatId: ctx.chat.id,
    userId: ctx.from?.id || 0,
    text: msg.text || "",
    photo: !!msg.photo,
    video: !!msg.video,
    document: !!msg.document,
    sticker: !!msg.sticker,
    animation: !!msg.animation,
    audio: !!msg.audio,
    voice: !!msg.voice,
    date: Date.now()
  });

  if (
    group.trackedMessages.length > 1500
  ) {
    group.trackedMessages =
      group.trackedMessages.slice(-1500);
  }
}

/* =========================================================
   الحماية
========================================================= */

async function handleProtection(ctx) {
  if (!ctx.message || !ctx.chat) {
    return false;
  }

  if (ctx.chat.type === "private") {
    return false;
  }

  const group =
    ensureGroup(ctx.chat.id);

  if (
    group.violationsEnabled === false
  ) {
    return false;
  }

  const text =
    ctx.message.text ||
    ctx.message.caption ||
    "";

  const level =
    getLevel(
      ctx,
      ctx.from.id
    );

  if (level >= 4) {
    return false;
  }

  if (
    group.linksEnabled === false &&
    /(https?:\/\/|www\.|t\.me\/)/i.test(text)
  ) {
    try {
      await ctx.deleteMessage();
    } catch {}

    return true;
  }

  if (
    group.forbiddenWords?.length &&
    group.forbiddenWords.some(
      word =>
        text
          .toLowerCase()
          .includes(
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
  const group =
    ensureGroup(ctx.chat.id);

  return !!group.muted[
    String(ctx.from.id)
  ];
}

function isGlobalMuted(ctx) {
  const group =
    ensureGroup(ctx.chat.id);

  return !!group.globalMuted[
    String(ctx.from.id)
  ];
}

/* =========================================================
   مراقبة الرسائل
========================================================= */

bot.on("message", async (ctx, next) => {
  try {
    if (
      ctx.chat?.type !== "private"
    ) {
      addInteraction(ctx);
      trackMessage(ctx);

      const protectedMessage =
        await handleProtection(ctx);

      if (protectedMessage) {
        saveData();
        return;
      }

      if (
        isMuted(ctx) ||
        isGlobalMuted(ctx)
      ) {
        try {
          await ctx.deleteMessage();
        } catch {}

        return;
      }

      const group =
        ensureGroup(ctx.chat.id);

      if (
        group.autoClean &&
        ctx.message?.text &&
        /(https?:\/\/|www\.|t\.me\/)/i.test(
          ctx.message.text
        )
      ) {
        try {
          await ctx.deleteMessage();
        } catch {}

        return;
      }
    }

    saveData();
  } catch (error) {
    console.error(
      "MESSAGE ERROR:",
      error
    );
  }

  return next();
});

/* =========================================================
   الهمسات
========================================================= */

const whisperPending =
  new Map();

const whisperStore =
  new Map();

const whisperReplyPending =
  new Map();

function createWhisperId() {
  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2, 9)
  );
}

/* =========================================================
   START
========================================================= */

bot.start(async ctx => {
  const payload =
    ctx.startPayload || "";

  if (
    payload.startsWith("whisper_")
  ) {
    const id =
      payload.substring(
        "whisper_".length
      );

    const pending =
      whisperPending.get(id);

    if (!pending) {
      return ctx.reply(
        "• الهمسه غير موجوده أو انتهت"
      );
    }

    if (
      ctx.from.id !==
      pending.recipientId
    ) {
      return ctx.reply(
        "• هذه الهمسه ليست لك"
      );
    }

    whisperStore.set(
      id,
      {
        ...pending,
        createdAt: Date.now()
      }
    );

    whisperPending.delete(id);

    return ctx.reply(
      "• أرسل الآن الهمسة\n" +
      "• يمكنك إرسال نص أو ملصق أو صورة أو قيف\n" +
      "-"
    );
  }

  if (
    payload.startsWith("whisperreply_")
  ) {
    const id =
      payload.substring(
        "whisperreply_".length
      );

    const whisper =
      whisperStore.get(id);

    if (!whisper) {
      return ctx.reply(
        "• الهمسه غير موجوده أو انتهت"
      );
    }

    if (
      ctx.from.id !==
      whisper.recipientId
    ) {
      return ctx.reply(
        "• هذه الهمسه ليست لك"
      );
    }

    whisperReplyPending.set(
      ctx.from.id,
      {
        originalId: id,
        senderId: ctx.from.id,
        sender: ctx.from,
        recipientId: whisper.senderId,
        chatId: whisper.chatId
      }
    );

    return ctx.reply(
      "• أرسل الآن ردك على الهمسة\n" +
      "• يمكنك إرسال نص أو ملصق أو صورة أو قيف\n" +
      "-"
    );
  }

  if (
    ctx.chat.type === "private" &&
    !data.subscribers.includes(
      ctx.chat.id
    )
  ) {
    data.subscribers.push(
      ctx.chat.id
    );

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

/* =========================================================
   بدء الهمسة من القروب
========================================================= */

bot.hears(
  /^(?:اهمس|همسه|ه)$/i,
  async ctx => {
    if (
      ctx.chat.type === "private"
    ) {
      return replyCommand(
        ctx,
        "• استخدم الهمسه داخل القروب بالرد على المستخدم"
      );
    }

    const target =
      await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم اللي تبي تهمس له"
      );
    }

    const id =
      createWhisperId();

    whisperPending.set(
      id,
      {
        senderId: ctx.from.id,

        sender: {
          id: ctx.from.id,
          first_name:
            ctx.from.first_name || "",
          username:
            ctx.from.username || ""
        },

        recipientId:
          target.id,

        recipient: {
          id: target.id,
          first_name:
            target.first_name || "",
          username:
            target.username || ""
        },

        chatId:
          ctx.chat.id
      }
    );

    const username =
      ctx.botInfo?.username || "";

    return replyCommand(
      ctx,
      `• تم تحديد الهمسه لـ ↤ ${mention(target)}\n` +
      `• اضغط الزر لكتابة الهمسة`,
      {
        ...Markup.inlineKeyboard([
          [
            Markup.button.url(
              "اهمس هنا",
              `https://t.me/${username}?start=whisper_${id}`
            )
          ]
        ])
      }
    );
  }
);

/* =========================================================
   محتوى الهمسة
========================================================= */

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
      file_id:
        message.sticker.file_id
    };
  }

  if (message.photo) {
    return {
      type: "photo",
      file_id:
        message.photo[
          message.photo.length - 1
        ].file_id,
      caption:
        message.caption || ""
    };
  }

  if (message.animation) {
    return {
      type: "animation",
      file_id:
        message.animation.file_id,
      caption:
        message.caption || ""
    };
  }

  return null;
}

/* =========================================================
   إرسال إشعار الهمسة للقروب
========================================================= */

async function sendWhisperToGroup(
  ctx,
  whisper,
  whisperId
) {
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
      error?.response?.description ||
      error
    );
  }
}

/* =========================================================
   استقبال الهمسة من الخاص
========================================================= */

bot.on(
  "message",
  async (ctx, next) => {
    try {
      if (
        ctx.chat.type !== "private"
      ) {
        return next();
      }

      /* -------------------------
         رد على همسة
      ------------------------- */

      const replyPending =
        whisperReplyPending.get(
          ctx.from.id
        );

      if (replyPending) {
        const content =
          await getWhisperContent(
            ctx.message
          );

        if (!content) {
          return ctx.reply(
            "• نوع الرسالة غير مدعوم"
          );
        }

        const id =
          createWhisperId();

        const newWhisper = {
          senderId:
            ctx.from.id,

          sender: {
            id: ctx.from.id,
            first_name:
              ctx.from.first_name || "",
            username:
              ctx.from.username || ""
          },

          recipientId:
            replyPending.recipientId,

          recipient: {
            id:
              replyPending.recipientId,
            first_name: "",
            username: ""
          },

          chatId:
            replyPending.chatId,

          content,

          createdAt:
            Date.now()
        };

        whisperStore.set(
          id,
          newWhisper
        );

        whisperReplyPending.delete(
          ctx.from.id
        );

        try {
          await ctx.deleteMessage();
        } catch {}

        await ctx.reply(
          "• تم ارسال الرد على الهمسة"
        );

        await sendWhisperToGroup(
          ctx,
          newWhisper,
          id
        );

        return;
      }

      /* -------------------------
         همسة عادية
      ------------------------- */

      let foundId = null;
      let whisper = null;

      for (
        const [
          id,
          item
        ] of whisperStore.entries()
      ) {
        if (
          item.recipientId ===
            ctx.from.id &&
          !item.content
        ) {
          foundId = id;
          whisper = item;
          break;
        }
      }

      if (!whisper) {
        return next();
      }

      const content =
        await getWhisperContent(
          ctx.message
        );

      if (!content) {
        return ctx.reply(
          "• نوع الرسالة غير مدعوم"
        );
      }

      whisper.content =
        content;

      whisperStore.set(
        foundId,
        whisper
      );

      try {
        await ctx.deleteMessage();
      } catch {}

      await ctx.reply(
        "• تم ارسال الهمسة"
      );

      await sendWhisperToGroup(
        ctx,
        whisper,
        foundId
      );

      return;

    } catch (error) {
      console.error(
        "WHISPER PRIVATE ERROR:",
        error?.response?.description ||
        error
      );

      return next();
    }
  }
);

/* =========================================================
   رؤية الهمسة
   المحتوى يظهر للمستلم فقط في نافذة خاصة
========================================================= */

bot.action(
  /^whisper_view_(.+)$/,
  async ctx => {
    const id =
      ctx.match[1];

    const whisper =
      whisperStore.get(id);

    if (!whisper) {
      return ctx.answerCbQuery(
        "• الهمسه غير موجوده",
        {
          show_alert: true
        }
      );
    }

    if (
      ctx.from.id !==
      whisper.recipientId
    ) {
      return ctx.answerCbQuery(
        "• هذه الهمسه ليست لك",
        {
          show_alert: true
        }
      );
    }

    if (!whisper.content) {
      return ctx.answerCbQuery(
        "• الهمسه لم يتم إرسال محتواها",
        {
          show_alert: true
        }
      );
    }

    const content =
      whisper.content;

    try {
      /* -------------------------
         النص
      ------------------------- */

      if (
        content.type === "text"
      ) {
        const text =
          `• الهمسة\n\n${content.text}`;

        /*
          show_alert يجعل النص يظهر
          للمستلم الذي ضغط فقط.
          لا يتم تعديل رسالة القروب.
        */

        return ctx.answerCbQuery(
          text.slice(0, 195),
          {
            show_alert: true
          }
        );
      }

      /* -------------------------
         الصور / الملصقات / القيف
         لا يمكن عرض الوسائط داخل
         callback alert.
      ------------------------- */

      if (
        content.type === "photo"
      ) {
        return ctx.answerCbQuery(
          content.caption
            ? `• الهمسة:\n${content.caption}`.slice(0, 195)
            : "• الهمسة تحتوي على صورة",
          {
            show_alert: true
          }
        );
      }

      if (
        content.type === "sticker"
      ) {
        return ctx.answerCbQuery(
          "• الهمسة عبارة عن ملصق",
          {
            show_alert: true
          }
        );
      }

      if (
        content.type === "animation"
      ) {
        return ctx.answerCbQuery(
          content.caption
            ? `• الهمسة:\n${content.caption}`.slice(0, 195)
            : "• الهمسة تحتوي على قيف",
          {
            show_alert: true
          }
        );
      }

    } catch (error) {
      console.error(
        "VIEW WHISPER ERROR:",
        error?.response?.description ||
        error
      );

      return ctx.answerCbQuery(
        "• تعذر عرض الهمسة",
        {
          show_alert: true
        }
      );
    }
  }
);

/* =========================================================
   الرد على الهمسة
========================================================= */

bot.action(
  /^whisper_reply_(.+)$/,
  async ctx => {
    const id =
      ctx.match[1];

    const whisper =
      whisperStore.get(id);

    if (!whisper) {
      return ctx.answerCbQuery(
        "• الهمسه غير موجوده",
        {
          show_alert: true
        }
      );
    }

    if (
      ctx.from.id !==
      whisper.recipientId
    ) {
      return ctx.answerCbQuery(
        "• هذه الهمسه ليست لك",
        {
          show_alert: true
        }
      );
    }

    await ctx.answerCbQuery();

    whisperReplyPending.set(
      ctx.from.id,
      {
        originalId: id,
        senderId: ctx.from.id,
        sender: ctx.from,
        recipientId:
          whisper.senderId,
        chatId:
          whisper.chatId
      }
    );

    return ctx.reply(
      "• أرسل الآن ردك على الهمسة\n" +
      "• يمكنك إرسال نص أو ملصق أو صورة أو قيف\n" +
      "-",
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
   رتبتي
========================================================= */

bot.hears(
  /^رتبتي$/i,
  async ctx => {
    const level =
      getLevel(
        ctx,
        ctx.from.id
      );

    return replyCommand(
      ctx,
      `• رتبتك ↤︎ ${escapeHtml(roleName(level))}`
    );
  }
);

/* =========================================================
   تفاعلي
========================================================= */

bot.hears(
  /^تفاعلي$/i,
  async ctx => {
    const group =
      ensureGroup(ctx.chat.id);

    const id =
      String(ctx.from.id);

    const count =
      Number(
        group.interactions[id] || 0
      );

    const ranking =
      Object.entries(
        group.interactions
      )
        .sort(
          (a, b) =>
            Number(b[1]) -
            Number(a[1])
        )
        .findIndex(
          ([userId]) =>
            userId === id
        );

    return replyCommand(
      ctx,
      `• رتبتك ↤︎ ${escapeHtml(roleName(getLevel(ctx, ctx.from.id)))}\n` +
      `• عدد رسائل التفاعل ↤︎ ${count}\n` +
      `• ترتيبك بين المتفاعلين ↤︎ ${
        ranking >= 0
          ? ranking + 1
          : "-"
      }`
    );
  }
);

/* =========================================================
   المتفاعلين
========================================================= */

bot.hears(
  /^المتفاعلين$/i,
  async ctx => {
    const group =
      ensureGroup(ctx.chat.id);

    const list =
      Object.entries(
        group.interactions
      )
        .sort(
          (a, b) =>
            Number(b[1]) -
            Number(a[1])
        )
        .slice(0, 20);

    if (!list.length) {
      return replyCommand(
        ctx,
        "• لا يوجد متفاعلين"
      );
    }

    const lines = [];

    for (
      let i = 0;
      i < list.length;
      i++
    ) {
      const [
        id,
        count
      ] = list[i];

      const member =
        group.users[id] || {
          id: Number(id),
          first_name: "مستخدم"
        };

      lines.push(
        `${i + 1}. ${mention(member)} ↤︎ ${count}`
      );
    }

    return replyCommand(
      ctx,
      "• المتفاعلين\n" +
      "━━━━━━━━━━━\n" +
      lines.join("\n")
    );
  }
);

/* =========================================================
   رتبته
========================================================= */

bot.hears(
  /^رتبته$/i,
  async ctx => {
    const target =
      await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(target)}\n` +
      `• رتبته ↤︎ ${escapeHtml(
        roleName(
          getLevel(
            ctx,
            target.id
          )
        )
      )}`
    );
  }
);

/* =========================================================
   تفاعله
========================================================= */

bot.hears(
  /^تفاعله$/i,
  async ctx => {
    const target =
      await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    const group =
      ensureGroup(ctx.chat.id);

    const id =
      String(target.id);

    const count =
      Number(
        group.interactions[id] || 0
      );

    const ranking =
      Object.entries(
        group.interactions
      )
        .sort(
          (a, b) =>
            Number(b[1]) -
            Number(a[1])
        )
        .findIndex(
          ([userId]) =>
            userId === id
        );

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(target)}\n` +
      `• عدد رسائل التفاعل ↤︎ ${count}\n` +
      `• ترتيبه بين المتفاعلين ↤︎ ${
        ranking >= 0
          ? ranking + 1
          : "-"
      }`
    );
  }
);

/* =========================================================
   رفع الرتب
========================================================= */

const promotionCommands = [
  {
    regex: /^رفع مميز$/i,
    level: 1,
    name: "مميز",
    required: 2
  },
  {
    regex: /^رفع مالك$/i,
    level: 2,
    name: "مالك",
    required: 3
  },
  {
    regex: /^رفع مالك أساسي$/i,
    level: 3,
    name: "مالك أساسي",
    required: 5
  },
  {
    regex: /^رفع اساس$/i,
    level: 3,
    name: "مالك أساسي",
    required: 5
  },
  {
    regex: /^رفع Myth$/i,
    level: 4,
    name: "Myth",
    required: 5
  },
  {
    regex: /^رفع M$/i,
    level: 4,
    name: "Myth",
    required: 5
  },
  {
    regex: /^رفع Myth 🎖️$/i,
    level: 5,
    name: "Myth🎖️",
    required: 6
  },
  {
    regex: /^رفع My$/i,
    level: 5,
    name: "Myth🎖️",
    required: 6
  },
  {
    regex: /^رفع اكس$/i,
    level: 5,
    name: "Myth🎖️",
    required: 6
  },
  {
    regex: /^رفع Dev²$/i,
    level: 6,
    name: "Dev²🎖️",
    required: 7
  },
  {
    regex: /^رفع مطور ثانوي$/i,
    level: 6,
    name: "Dev²🎖️",
    required: 7
  },
  {
    regex: /^رفع ديف$/i,
    level: 7,
    name: "Dev🎖️",
    required: 7
  }
];

for (
  const item of promotionCommands
) {
  bot.hears(
    item.regex,
    async ctx => {
      if (
        !requireRank(
          ctx,
          item.required
        )
      ) {
        return;
      }

      const target =
        await getRepliedUser(ctx);

      if (!target) {
        return replyCommand(
          ctx,
          "• لازم ترد على المستخدم"
        );
      }

      if (
        !canActOnTarget(
          ctx,
          target
        )
      ) {
        return;
      }

      const targetUser =
        ensureUser(target.id);

      targetUser.role =
        item.level;

      targetUser.username =
        target.username || "";

      targetUser.first_name =
        target.first_name || "";

      const group =
        ensureGroup(ctx.chat.id);

      group.users[
        String(target.id)
      ] ||= {
        id: target.id,
        username:
          target.username || "",
        first_name:
          target.first_name || "",
        role: 0
      };

      group.users[
        String(target.id)
      ].role =
        item.level;

      saveData();

      return replyCommand(
        ctx,
        `• المستخدم ذا ↤︎ ${mention(target)}\n` +
        `• تم رفعه (${escapeHtml(item.name)})`
      );
    }
  );
}

/* =========================================================
   تنزيل الرتبة
========================================================= */

bot.hears(
  /^تنزيل$/i,
  async ctx => {
    if (!requireRank(ctx, 2)) {
      return;
    }

    const target =
      await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    if (
      !canActOnTarget(
        ctx,
        target
      )
    ) {
      return;
    }

    const targetUser =
      ensureUser(target.id);

    targetUser.role = 0;

    const group =
      ensureGroup(ctx.chat.id);

    if (
      group.users[
        String(target.id)
      ]
    ) {
      group.users[
        String(target.id)
      ].role = 0;
    }

    saveData();

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(target)}\n` +
      `• تم تنزيل رتبته`
    );
  }
);

/* =========================================================
   صلاحيات الحماية
========================================================= */

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

function requireModeration(
  ctx,
  key
) {
  return requireRank(
    ctx,
    COMMAND_LEVELS[key]
  );
}

/* =========================================================
   فحص صلاحيات البوت
========================================================= */

async function getBotMember(ctx) {
  try {
    const me =
      await ctx.telegram.getMe();

    return await ctx.telegram.getChatMember(
      ctx.chat.id,
      me.id
    );
  } catch (error) {
    console.error(
      "BOT MEMBER ERROR:",
      error?.response?.description ||
      error
    );

    return null;
  }
}

async function checkBotPermission(
  ctx,
  permission
) {
  const member =
    await getBotMember(ctx);

  if (!member) {
    return {
      ok: false,
      message:
        "• ما قدرت أعرف صلاحيات البوت داخل القروب"
    };
  }

  if (
    member.status !== "administrator"
  ) {
    return {
      ok: false,
      message:
        "• البوت ليس مشرفًا في القروب"
    };
  }

  if (
    permission &&
    member[permission] !== true
  ) {
    return {
      ok: false,
      message:
        `• البوت مشرف لكن ما عنده صلاحية ${permission}`
    };
  }

  return {
    ok: true,
    member
  };
}

async function checkTargetMember(
  ctx,
  userId
) {
  try {
    return await ctx.telegram.getChatMember(
      ctx.chat.id,
      userId
    );
  } catch {
    return null;
  }
}

/* =========================================================
   Telegram Mute
========================================================= */

async function telegramMute(
  ctx,
  userId
) {
  const permission =
    await checkBotPermission(
      ctx,
      "can_restrict_members"
    );

  if (!permission.ok) {
    throw new Error(
      permission.message
    );
  }

  const target =
    await checkTargetMember(
      ctx,
      userId
    );

  if (
    target?.status === "creator"
  ) {
    throw new Error(
      "• لا يمكن تقييد مالك القروب"
    );
  }

  if (
    target?.status === "administrator"
  ) {
    throw new Error(
      "• لا يمكن تقييد مشرف أعلى من البوت"
    );
  }

  return ctx.telegram.restrictChatMember(
    ctx.chat.id,
    userId,
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
}

/* =========================================================
   Telegram Unmute
========================================================= */

async function telegramUnmute(
  ctx,
  userId
) {
  const permission =
    await checkBotPermission(
      ctx,
      "can_restrict_members"
    );

  if (!permission.ok) {
    throw new Error(
      permission.message
    );
  }

  return ctx.telegram.restrictChatMember(
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
        can_send_other_messages: true,
        can_add_web_page_previews: true
      }
    }
  );
}

/* =========================================================
   كتم
========================================================= */

async function muteTarget(
  ctx,
  global = false
) {
  const target =
    await getRepliedUser(ctx);

  if (!target) {
    return replyCommand(
      ctx,
      "• لازم ترد على المستخدم"
    );
  }

  if (
    !canActOnTarget(
      ctx,
      target
    )
  ) {
    return;
  }

  if (
    ctx.chat.type !== "group" &&
    ctx.chat.type !== "supergroup"
  ) {
    return replyCommand(
      ctx,
      "• هذا الامر يستخدم داخل القروب"
    );
  }

  const group =
    ensureGroup(ctx.chat.id);

  try {
    await telegramMute(
      ctx,
      target.id
    );
  } catch (error) {
    console.error(
      "MUTE ERROR:",
      error?.message ||
      error?.response?.description ||
      error
    );

    return replyCommand(
      ctx,
      error?.message?.startsWith("•")
        ? error.message
        : "• ما قدرت أكتم المستخدم\n• تأكد أن البوت مشرف وعنده صلاحية تقييد الأعضاء"
    );
  }

  const savedUser = {
    id: target.id,
    username:
      target.username || "",
    first_name:
      target.first_name || ""
  };

  if (global) {
    group.globalMuted[
      String(target.id)
    ] = savedUser;
  } else {
    group.muted[
      String(target.id)
    ] = savedUser;
  }

  saveData();

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(target)}\n` +
    `• ${global ? "كتمته عام" : "كتمته"}`
  );
}

bot.hears(
  /^كتم$/i,
  async ctx => {
    if (
      !requireModeration(
        ctx,
        "mute"
      )
    ) {
      return;
    }

    return muteTarget(
      ctx,
      false
    );
  }
);

bot.hears(
  /^(?:كتم عام|عام)$/i,
  async ctx => {
    if (
      !requireModeration(
        ctx,
        "globalMute"
      )
    ) {
      return;
    }

    return muteTarget(
      ctx,
      true
    );
  }
);

/* =========================================================
   فك الكتم
========================================================= */

bot.hears(
  /^فك الكتم$/i,
  async ctx => {
    if (
      !requireModeration(
        ctx,
        "unmute"
      )
    ) {
      return;
    }

    const target =
      await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    const group =
      ensureGroup(ctx.chat.id);

    try {
      await telegramUnmute(
        ctx,
        target.id
      );
    } catch (error) {
      console.error(
        "UNMUTE ERROR:",
        error
      );

      return replyCommand(
        ctx,
        error?.message?.startsWith("•")
          ? error.message
          : "• ما قدرت أفك الكتم\n• تأكد أن البوت مشرف وعنده صلاحية تقييد الأعضاء"
      );
    }

    delete group.muted[
      String(target.id)
    ];

    saveData();

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(target)}\n` +
      `• فكيت الكتم عنه`
    );
  }
);

/* =========================================================
   فك الكتم العام
========================================================= */

bot.hears(
  /^فك الكتم العام$/i,
  async ctx => {
    if (
      !requireModeration(
        ctx,
        "globalMute"
      )
    ) {
      return;
    }

    const target =
      await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    const group =
      ensureGroup(ctx.chat.id);

    try {
      await telegramUnmute(
        ctx,
        target.id
      );
    } catch (error) {
      console.error(
        "GLOBAL UNMUTE ERROR:",
        error
      );

      return replyCommand(
        ctx,
        error?.message?.startsWith("•")
          ? error.message
          : "• ما قدرت أفك الكتم العام"
      );
    }

    delete group.globalMuted[
      String(target.id)
    ];

    saveData();

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(target)}\n` +
      `• فكيت الكتم العام عنه`
    );
  }
);

/* =========================================================
   مم
========================================================= */

bot.hears(
  /^مم$/i,
  async ctx => {
    if (!requireRank(ctx, 4)) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    const muted =
      Object.values(
        group.muted || {}
      );

    if (!muted.length) {
      return replyCommand(
        ctx,
        "• لا يوجد مكتومين"
      );
    }

    let count = 0;

    for (
      const user of muted
    ) {
      try {
        await telegramUnmute(
          ctx,
          user.id
        );

        delete group.muted[
          String(user.id)
        ];

        count++;
      } catch (error) {
        console.error(
          "CLEAR MUTE ERROR:",
          error
        );
      }
    }

    saveData();

    return replyCommand(
      ctx,
      `• تم فك الكتم عن ${count} من المكتومين`
    );
  }
);

/* =========================================================
   خخ
========================================================= */

bot.hears(
  /^خخ$/i,
  async ctx => {
    if (!requireRank(ctx, 5)) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    const muted =
      Object.values(
        group.globalMuted || {}
      );

    if (!muted.length) {
      return replyCommand(
        ctx,
        "• لا يوجد مكتومين عام"
      );
    }

    let count = 0;

    for (
      const user of muted
    ) {
      try {
        await telegramUnmute(
          ctx,
          user.id
        );

        delete group.globalMuted[
          String(user.id)
        ];

        count++;
      } catch (error) {
        console.error(
          "CLEAR GLOBAL MUTE ERROR:",
          error
        );
      }
    }

    saveData();

    return replyCommand(
      ctx,
      `• تم فك الكتم العام عن ${count} من المكتومين`
    );
  }
);

/* =========================================================
   تقييد
========================================================= */

bot.hears(
  /^تقييد$/i,
  async ctx => {
    if (
      !requireModeration(
        ctx,
        "restrict"
      )
    ) {
      return;
    }

    const target =
      await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    if (
      !canActOnTarget(
        ctx,
        target
      )
    ) {
      return;
    }

    try {
      await telegramMute(
        ctx,
        target.id
      );
    } catch (error) {
      console.error(
        "RESTRICT ERROR:",
        error?.message ||
        error?.response?.description ||
        error
      );

      return replyCommand(
        ctx,
        error?.message?.startsWith("•")
          ? error.message
          : "• ما قدرت أقيد المستخدم\n• تأكد أن البوت مشرف وعنده صلاحية تقييد الأعضاء"
      );
    }

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(target)}\n` +
      `• قيدته`
    );
  }
);

/* =========================================================
   الغاء التقييد
========================================================= */

bot.hears(
  /^الغاء التقييد$/i,
  async ctx => {
    if (
      !requireModeration(
        ctx,
        "unrestrict"
      )
    ) {
      return;
    }

    const target =
      await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    if (
      !canActOnTarget(
        ctx,
        target
      )
    ) {
      return;
    }

    try {
      await telegramUnmute(
        ctx,
        target.id
      );
    } catch (error) {
      console.error(
        "UNRESTRICT ERROR:",
        error
      );

      return replyCommand(
        ctx,
        error?.message?.startsWith("•")
          ? error.message
          : "• ما قدرت ألغي التقييد"
      );
    }

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(target)}\n` +
      `• تم الغاء التقييد عنه`
    );
  }
);

/* =========================================================
   رفع القيود
========================================================= */

bot.hears(
  /^رفع القيود$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) {
      return;
    }

    const target =
      await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    if (
      !canActOnTarget(
        ctx,
        target
      )
    ) {
      return;
    }

    try {
      await telegramUnmute(
        ctx,
        target.id
      );
    } catch (error) {
      console.error(
        "LIFT RESTRICTIONS ERROR:",
        error
      );

      return replyCommand(
        ctx,
        error?.message?.startsWith("•")
          ? error.message
          : "• ما قدرت أرفع القيود"
      );
    }

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(target)}\n` +
      `• تم رفع القيود عنه`
    );
  }
);

/* =========================================================
   حظر
========================================================= */

bot.hears(
  /^حظر$/i,
  async ctx => {
    if (
      !requireModeration(
        ctx,
        "ban"
      )
    ) {
      return;
    }

    const target =
      await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    if (
      !canActOnTarget(
        ctx,
        target
      )
    ) {
      return;
    }

    const permission =
      await checkBotPermission(
        ctx,
        "can_restrict_members"
      );

    if (!permission.ok) {
      return replyCommand(
        ctx,
        permission.message
      );
    }

    try {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        target.id
      );
    } catch (error) {
      console.error(
        "BAN ERROR:",
        error
      );

      return replyCommand(
        ctx,
        "• ما قدرت أحظر المستخدم\n• تأكد أن البوت مشرف وعنده صلاحية حظر الأعضاء"
      );
    }

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(target)}\n` +
      `• حظرته`
    );
  }
);

/* =========================================================
   فك الحظر
========================================================= */

bot.hears(
  /^فك الحظر$/i,
  async ctx => {
    if (
      !requireModeration(
        ctx,
        "unban"
      )
    ) {
      return;
    }

    const target =
      await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    try {
      await ctx.telegram.unbanChatMember(
        ctx.chat.id,
        target.id
      );
    } catch (error) {
      console.error(
        "UNBAN ERROR:",
        error
      );

      return replyCommand(
        ctx,
        "• ما قدرت أفك الحظر"
      );
    }

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(target)}\n` +
      `• فكيت الحظر عنه`
    );
  }
);

/* =========================================================
   طرد
========================================================= */

bot.hears(
  /^طرد$/i,
  async ctx => {
    if (
      !requireModeration(
        ctx,
        "kick"
      )
    ) {
      return;
    }

    const target =
      await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    if (
      !canActOnTarget(
        ctx,
        target
      )
    ) {
      return;
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
    } catch (error) {
      console.error(
        "KICK ERROR:",
        error
      );

      return replyCommand(
        ctx,
        "• ما قدرت أطرد المستخدم\n• تأكد أن البوت مشرف وعنده صلاحية حظر الأعضاء"
      );
    }

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(target)}\n` +
      `• طردته`
    );
  }
);

/* =========================================================
   رفع مشرف
========================================================= */

const DEFAULT_ADMIN_PERMISSIONS = {
  can_manage_chat: true,
  can_delete_messages: true,
  can_manage_video_chats: true,
  can_restrict_members: true,
  can_promote_members: false,
  can_change_info: true,
  can_invite_users: true,
  can_pin_messages: true,
  can_manage_topics: true
};

async function getMemberStatus(
  ctx,
  userId
) {
  try {
    return await ctx.telegram.getChatMember(
      ctx.chat.id,
      userId
    );
  } catch (error) {
    console.error(
      "GET MEMBER ERROR:",
      error?.response?.description ||
      error
    );

    return null;
  }
}

async function promoteMember(
  ctx,
  target
) {
  const botMember =
    await getBotMember(ctx);

  if (!botMember) {
    throw new Error(
      "• تعذر معرفة صلاحيات البوت"
    );
  }

  if (
    botMember.status !== "administrator"
  ) {
    throw new Error(
      "• البوت ليس مشرفًا في القروب"
    );
  }

  if (
    botMember.can_promote_members !== true
  ) {
    throw new Error(
      "• البوت مشرف لكن ما عنده صلاحية إضافة المشرفين"
    );
  }

  const targetMember =
    await getMemberStatus(
      ctx,
      target.id
    );

  if (!targetMember) {
    throw new Error(
      "• تعذر معرفة حالة المستخدم"
    );
  }

  if (
    targetMember.status === "creator"
  ) {
    throw new Error(
      "• المستخدم مالك القروب"
    );
  }

  return ctx.telegram.promoteChatMember(
    ctx.chat.id,
    target.id,
    DEFAULT_ADMIN_PERMISSIONS
  );
}

bot.hears(
  /^(?:رفع مشرف|ترقيه)$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) {
      return;
    }

    const target =
      await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    if (
      !canActOnTarget(
        ctx,
        target
      )
    ) {
      return;
    }

    try {
      await promoteMember(
        ctx,
        target
      );
    } catch (error) {
      console.error(
        "PROMOTE ERROR:",
        error?.message ||
        error?.response?.description ||
        error
      );

      return replyCommand(
        ctx,
        error?.message?.startsWith("•")
          ? error.message
          : "• ما قدرت أرقّي المستخدم\n• تأكد أن البوت مشرف وعنده صلاحية إضافة المشرفين"
      );
    }

    const group =
      ensureGroup(ctx.chat.id);

    group.adminPermissions[
      String(target.id)
    ] = {
      ...DEFAULT_ADMIN_PERMISSIONS
    };

    saveData();

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(target)}\n` +
      `• تم ترقيته مشرف`
    );
  }
);

/* =========================================================
   تنزيل مشرف
========================================================= */

bot.hears(
  /^(?:تنزيل مشرف|تنزيل المشرف)$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) {
      return;
    }

    const target =
      await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    if (
      !canActOnTarget(
        ctx,
        target
      )
    ) {
      return;
    }

    try {
      const botMember =
        await getBotMember(ctx);

      if (
        !botMember ||
        botMember.status !==
          "administrator" ||
        botMember.can_promote_members !== true
      ) {
        throw new Error(
          "• البوت ما عنده صلاحية تعديل المشرفين"
        );
      }

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

      const group =
        ensureGroup(ctx.chat.id);

      delete group.adminPermissions[
        String(target.id)
      ];

      saveData();

      return replyCommand(
        ctx,
        `• المستخدم ذا ↤︎ ${mention(target)}\n` +
        `• تم تنزيله من الإشراف`
      );

    } catch (error) {
      console.error(
        "DEMOTE ERROR:",
        error?.message ||
        error?.response?.description ||
        error
      );

      return replyCommand(
        ctx,
        error?.message?.startsWith("•")
          ? error.message
          : "• ما قدرت أنزل المشرف"
      );
    }
  }
);

/* =========================================================
   صلاحيات المشرف
========================================================= */

const ADMIN_PERMISSION_NAMES = {
  can_delete_messages: "حذف الرسائل",
  can_restrict_members: "تقييد الأعضاء",
  can_change_info: "تغيير معلومات القروب",
  can_invite_users: "إضافة أعضاء",
  can_pin_messages: "تثبيت الرسائل",
  can_manage_topics: "إدارة المواضيع",
  can_manage_video_chats: "إدارة المكالمات",
  can_promote_members: "إضافة مشرفين"
};

bot.hears(
  /^صلاحيات المستخدم$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) {
      return;
    }

    const target =
      await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    const member =
      await getMemberStatus(
        ctx,
        target.id
      );

    if (!member) {
      return replyCommand(
        ctx,
        "• تعذر الحصول على صلاحيات المستخدم"
      );
    }

    if (
      member.status !== "administrator"
    ) {
      return replyCommand(
        ctx,
        `• المستخدم ذا ↤︎ ${mention(target)}\n• المستخدم ليس مشرف`
      );
    }

    const lines = [];

    for (
      const [
        key,
        name
      ] of Object.entries(
        ADMIN_PERMISSION_NAMES
      )
    ) {
      lines.push(
        `• ${name} ↤︎ ${
          member[key] ? "نعم" : "لا"
        }`
      );
    }

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(target)}\n` +
      "• صلاحيات المستخدم\n" +
      "━━━━━━━━━━━\n" +
      lines.join("\n")
    );
  }
);

/* =========================================================
   فتح وغلق المخالفات
========================================================= */

bot.hears(
  /^فتح المخالفات$/i,
  async ctx => {
    if (!requireRank(ctx, 7)) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    group.violationsEnabled =
      true;

    saveData();

    return replyCommand(
      ctx,
      "• تم فتح المخالفات"
    );
  }
);

bot.hears(
  /^(?:غلق|قفل) المخالفات$/i,
  async ctx => {
    if (!requireRank(ctx, 7)) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    group.violationsEnabled =
      false;

    saveData();

    return replyCommand(
      ctx,
      "• تم غلق المخالفات"
    );
  }
);

/* =========================================================
   الروابط
========================================================= */

bot.hears(
  /^فتح الروابط$/i,
  async ctx => {
    if (!requireRank(ctx, 7)) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    group.linksEnabled = true;

    saveData();

    return replyCommand(
      ctx,
      "• تم فتح الروابط"
    );
  }
);

bot.hears(
  /^قفل الروابط$/i,
  async ctx => {
    if (!requireRank(ctx, 7)) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    group.linksEnabled = false;

    saveData();

    return replyCommand(
      ctx,
      "• تم قفل الروابط"
    );
  }
);

/* =========================================================
   القروب
========================================================= */

const CHAT_PERMISSIONS_OPEN = {
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
};

bot.hears(
  /^فتح القروب$/i,
  async ctx => {
    if (!requireRank(ctx, 7)) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    group.groupOpen = true;

    try {
      await ctx.telegram.setChatPermissions(
        ctx.chat.id,
        CHAT_PERMISSIONS_OPEN
      );
    } catch (error) {
      console.error(
        "OPEN GROUP ERROR:",
        error
      );
    }

    saveData();

    return replyCommand(
      ctx,
      "• تم فتح القروب"
    );
  }
);

bot.hears(
  /^قفل القروب$/i,
  async ctx => {
    if (!requireRank(ctx, 7)) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    group.groupOpen = false;

    try {
      await ctx.telegram.setChatPermissions(
        ctx.chat.id,
        {
          can_send_messages: false
        }
      );
    } catch (error) {
      console.error(
        "LOCK GROUP ERROR:",
        error
      );
    }

    saveData();

    return replyCommand(
      ctx,
      "• تم قفل القروب"
    );
  }
);

/* =========================================================
   التنظيف
========================================================= */

async function cleanMessages(
  ctx,
  type
) {
  if (!requireRank(ctx, 4)) {
    return;
  }

  const group =
    ensureGroup(ctx.chat.id);

  const messages =
    group.trackedMessages || [];

  let selected = [];

  for (
    const msg of messages
  ) {
    if (
      msg.chatId !==
      ctx.chat.id
    ) {
      continue;
    }

    if (type === 0 && msg.text) {
      selected.push(
        msg.messageId
      );
    }

    if (type === 1 && msg.photo) {
      selected.push(
        msg.messageId
      );
    }

    if (type === 2 && msg.video) {
      selected.push(
        msg.messageId
      );
    }

    if (type === 3 && msg.document) {
      selected.push(
        msg.messageId
      );
    }

    if (type === 4 && msg.sticker) {
      selected.push(
        msg.messageId
      );
    }

    if (type === 5 && msg.animation) {
      selected.push(
        msg.messageId
      );
    }

    if (type === 6 && msg.audio) {
      selected.push(
        msg.messageId
      );
    }

    if (type === 7 && msg.voice) {
      selected.push(
        msg.messageId
      );
    }

    if (
      type === 8 &&
      msg.text &&
      /(https?:\/\/|www\.|t\.me\/)/i.test(
        msg.text
      )
    ) {
      selected.push(
        msg.messageId
      );
    }

    if (
      type === 9 &&
      (
        msg.photo ||
        msg.video ||
        msg.document ||
        msg.sticker ||
        msg.animation ||
        msg.audio ||
        msg.voice
      )
    ) {
      selected.push(
        msg.messageId
      );
    }
  }

  selected =
    [...new Set(selected)]
      .slice(-100);

  if (!selected.length) {
    return replyCommand(
      ctx,
      "• لا توجد رسائل مطابقة"
    );
  }

  let deleted = 0;

  for (
    const messageId of selected
  ) {
    try {
      await ctx.telegram.deleteMessage(
        ctx.chat.id,
        messageId
      );

      deleted++;
    } catch {}
  }

  group.trackedMessages =
    messages.filter(
      x =>
        !selected.includes(
          x.messageId
        )
    );

  saveData();

  return replyCommand(
    ctx,
    `• بواسطة ${mention(ctx.from)}\n• مسحت ( ${deleted} )`
  );
}

for (
  let i = 0;
  i <= 9;
  i++
) {
  bot.hears(
    new RegExp(`^${i}$`),
    async ctx => {
      return cleanMessages(
        ctx,
        i
      );
    }
  );
}

/* =========================================================
   التنظيف التلقائي
========================================================= */

bot.hears(
  /^تفعيل التنظيف التلقائي$/i,
  async ctx => {
    if (!requireRank(ctx, 4)) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    group.autoClean = true;

    saveData();

    return replyCommand(
      ctx,
      "• تم تفعيل التنظيف التلقائي"
    );
  }
);

bot.hears(
  /^تعطيل التنظيف التلقائي$/i,
  async ctx => {
    if (!requireRank(ctx, 4)) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    group.autoClean = false;

    saveData();

    return replyCommand(
      ctx,
      "• تم تعطيل التنظيف التلقائي"
    );
  }
);

/* =========================================================
   المنشن العام
========================================================= */

bot.hears(
  /^@all$/i,
  async ctx => {
    const group =
      ensureGroup(ctx.chat.id);

    if (
      group.mentionEnabled === false
    ) {
      return replyCommand(
        ctx,
        "• المنشن مقفل"
      );
    }

    const users =
      Object.values(
        group.users || {}
      );

    if (!users.length) {
      return replyCommand(
        ctx,
        "• لا يوجد أعضاء محفوظين"
      );
    }

    let current = "";
    const messages = [];

    for (
      const user of users
    ) {
      const line =
        mention(user) + " ";

      if (
        current.length +
        line.length >
        3500
      ) {
        messages.push(
          current
        );

        current = "";
      }

      current += line;
    }

    if (current) {
      messages.push(
        current
      );
    }

    for (
      const message of messages
    ) {
      await ctx.reply(
        message,
        {
          parse_mode: "HTML",
          disable_web_page_preview:
            true
        }
      );
    }
  }
);

/* =========================================================
   فتح وغلق المنشن
========================================================= */

bot.hears(
  /^فتح المنشن$/i,
  async ctx => {
    if (!requireRank(ctx, 7)) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    group.mentionEnabled = true;

    saveData();

    return replyCommand(
      ctx,
      "• تم فتح المنشن"
    );
  }
);

bot.hears(
  /^غلق المنشن$/i,
  async ctx => {
    if (!requireRank(ctx, 7)) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    group.mentionEnabled = false;

    saveData();

    return replyCommand(
      ctx,
      "• تم غلق المنشن"
    );
  }
);

/* =========================================================
   الكلمات الممنوعة
========================================================= */

bot.hears(
  /^منع الكلمه(?:\s+(.+))?$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) {
      return;
    }

    const word =
      ctx.match[1]?.trim();

    if (!word) {
      return replyCommand(
        ctx,
        "• اكتب الكلمة"
      );
    }

    const group =
      ensureGroup(ctx.chat.id);

    if (
      !group.forbiddenWords.includes(
        word
      )
    ) {
      group.forbiddenWords.push(
        word
      );
    }

    saveData();

    return replyCommand(
      ctx,
      "• تم منع الكلمه"
    );
  }
);

bot.hears(
  /^الغاء منع الكلمه(?:\s+(.+))?$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) {
      return;
    }

    const word =
      ctx.match[1]?.trim();

    if (!word) {
      return replyCommand(
        ctx,
        "• اكتب الكلمة"
      );
    }

    const group =
      ensureGroup(ctx.chat.id);

    group.forbiddenWords =
      group.forbiddenWords.filter(
        x => x !== word
      );

    saveData();

    return replyCommand(
      ctx,
      "• تم الغاء منع الكلمه"
    );
  }
);

bot.hears(
  /^الكلمات الممنوعه$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    if (
      !group.forbiddenWords.length
    ) {
      return replyCommand(
        ctx,
        "• لا يوجد كلمات ممنوعه"
      );
    }

    return replyCommand(
      ctx,
      "• الكلمات الممنوعه\n" +
      "━━━━━━━━━━━\n" +
      group.forbiddenWords
        .map(
          (x, i) =>
            `${i + 1}. ${escapeHtml(x)}`
        )
        .join("\n")
    );
  }
);

bot.hears(
  /^مسح الكلمات الممنوعه$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    group.forbiddenWords = [];

    saveData();

    return replyCommand(
      ctx,
      "• تم مسح الكلمات الممنوعه"
    );
  }
);

/* =========================================================
   الألقاب
========================================================= */

bot.hears(
  /^ضع(?:\s+(.+))?$/i,
  async ctx => {
    if (!requireRank(ctx, 7)) {
      return;
    }

    const target =
      await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    const title =
      ctx.match[1]?.trim();

    if (!title) {
      return replyCommand(
        ctx,
        "• اكتب اللقب"
      );
    }

    const user =
      ensureUser(target.id);

    user.title =
      title;

    saveData();

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(target)}\n• تم وضع اللقب`
    );
  }
);

bot.hears(
  /^لقبي$/i,
  async ctx => {
    const user =
      ensureUser(ctx.from.id);

    if (!user.title) {
      return replyCommand(
        ctx,
        "• ما عندك لقب"
      );
    }

    return replyCommand(
      ctx,
      `• لقبك ↤︎ ${escapeHtml(user.title)}`
    );
  }
);

bot.hears(
  /^لقبه$/i,
  async ctx => {
    const target =
      await getRepliedUser(ctx);

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    const user =
      ensureUser(target.id);

    if (!user.title) {
      return replyCommand(
        ctx,
        `• المستخدم ذا ↤︎ ${mention(target)}\n• ما عنده لقب`
      );
    }

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(target)}\n• لقبه ↤︎ ${escapeHtml(user.title)}`
    );
  }
);

/* =========================================================
   بحث الأغاني
========================================================= */

bot.hears(
  /^(?:بحث|بحث أغنية|اغنية|أغنية|شغل|تشغيل)\s+(.+)$/i,
  async ctx => {
    const query =
      ctx.match[1]?.trim();

    if (!query) {
      return replyCommand(
        ctx,
        "• اكتب اسم الأغنية"
      );
    }

    if (!ytSearch) {
      return replyCommand(
        ctx,
        "• مكتبة بحث الأغاني غير مثبتة\n" +
        "• نفذ: npm i yt-search\n" +
        "• ثم أعد تشغيل البوت"
      );
    }

    try {
      const result =
        await ytSearch(query);

      const videos =
        (result.videos || [])
          .slice(0, 5);

      if (!videos.length) {
        return replyCommand(
          ctx,
          `• ما لقيت نتائج لـ ↤︎ ${escapeHtml(query)}`
        );
      }

      const buttons =
        videos.map(
          (video, index) => [
            Markup.button.url(
              `${index + 1}. ${video.title.slice(0, 35)}`,
              video.url
            )
          ]
        );

      return replyCommand(
        ctx,
        `• نتائج البحث عن ↤︎ ${escapeHtml(query)}\n` +
        "━━━━━━━━━━━\n" +
        videos
          .map(
            (video, index) =>
              `${index + 1}. ${escapeHtml(video.title)}\n` +
              `   ↤︎ ${escapeHtml(video.timestamp || "-")}`
          )
          .join("\n\n"),
        {
          ...Markup.inlineKeyboard(
            buttons
          )
        }
      );

    } catch (error) {
      console.error(
        "YT SEARCH ERROR:",
        error?.message ||
        error
      );

      return replyCommand(
        ctx,
        "• حدث خطأ أثناء البحث عن الأغنية"
      );
    }
  }
);

/* =========================================================
   الأوامر المخصصة
========================================================= */

const customPending =
  new Map();

bot.hears(
  /^اضف امر(?:\s+(.+))?$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) {
      return;
    }

    const name =
      ctx.match[1]?.trim();

    if (!name) {
      return replyCommand(
        ctx,
        "• اكتب اسم الأمر"
      );
    }

    customPending.set(
      ctx.from.id,
      {
        type: "command",
        chatId: ctx.chat.id,
        name
      }
    );

    return replyCommand(
      ctx,
      "• أرسل الآن رد الأمر"
    );
  }
);

bot.hears(
  /^اضف رد(?:\s+(.+))?$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) {
      return;
    }

    const word =
      ctx.match[1]?.trim();

    if (!word) {
      return replyCommand(
        ctx,
        "• اكتب الكلمة"
      );
    }

    customPending.set(
      ctx.from.id,
      {
        type: "reply",
        chatId: ctx.chat.id,
        word
      }
    );

    return replyCommand(
      ctx,
      "• أرسل الآن رد الكلمة"
    );
  }
);

bot.hears(
  /^حذف امر(?:\s+(.+))?$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) {
      return;
    }

    const name =
      ctx.match[1]?.trim();

    const group =
      ensureGroup(ctx.chat.id);

    if (
      !group.customCommands[name]
    ) {
      return replyCommand(
        ctx,
        "• الأمر غير موجود"
      );
    }

    delete group.customCommands[
      name
    ];

    saveData();

    return replyCommand(
      ctx,
      "• تم حذف الأمر"
    );
  }
);

bot.hears(
  /^حذف رد(?:\s+(.+))?$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) {
      return;
    }

    const word =
      ctx.match[1]?.trim();

    const group =
      ensureGroup(ctx.chat.id);

    if (
      !group.customReplies[word]
    ) {
      return replyCommand(
        ctx,
        "• الرد غير موجود"
      );
    }

    delete group.customReplies[
      word
    ];

    saveData();

    return replyCommand(
      ctx,
      "• تم حذف الرد"
    );
  }
);

bot.hears(
  /^اوامري$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    const list =
      Object.keys(
        group.customCommands
      );

    if (!list.length) {
      return replyCommand(
        ctx,
        "• لا يوجد أوامر مخصصة"
      );
    }

    return replyCommand(
      ctx,
      "• الأوامر المخصصة\n" +
      "━━━━━━━━━━━\n" +
      list
        .map(
          (x, i) =>
            `${i + 1}. ${escapeHtml(x)}`
        )
        .join("\n")
    );
  }
);

bot.hears(
  /^ردودي$/i,
  async ctx => {
    if (!requireRank(ctx, 6)) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    const list =
      Object.keys(
        group.customReplies
      );

    if (!list.length) {
      return replyCommand(
        ctx,
        "• لا يوجد ردود مخصصة"
      );
    }

    return replyCommand(
      ctx,
      "• الردود المخصصة\n" +
      "━━━━━━━━━━━\n" +
      list
        .map(
          (x, i) =>
            `${i + 1}. ${escapeHtml(x)}`
        )
        .join("\n")
    );
  }
);

/* =========================================================
   استقبال الأوامر المخصصة
========================================================= */

bot.on(
  "text",
  async (ctx, next) => {
    if (
      ctx.chat.type === "private"
    ) {
      return next();
    }

    const pending =
      customPending.get(
        ctx.from.id
      );

    if (
      pending &&
      pending.chatId ===
        ctx.chat.id
    ) {
      if (
        pending.type ===
        "command"
      ) {
        const group =
          ensureGroup(
            ctx.chat.id
          );

        group.customCommands[
          pending.name
        ] =
          ctx.message.text;

        customPending.delete(
          ctx.from.id
        );

        saveData();

        return replyCommand(
          ctx,
          "• تم حفظ الأمر المخصص"
        );
      }

      if (
        pending.type ===
        "reply"
      ) {
        const group =
          ensureGroup(
            ctx.chat.id
          );

        group.customReplies[
          pending.word
        ] =
          ctx.message.text;

        customPending.delete(
          ctx.from.id
        );

        saveData();

        return replyCommand(
          ctx,
          "• تم حفظ الرد المخصص"
        );
      }
    }

    const group =
      ensureGroup(
        ctx.chat.id
      );

    const text =
      ctx.message.text.trim();

    if (
      group.customCommands[text]
    ) {
      return replyCommand(
        ctx,
        group.customCommands[text]
      );
    }

    if (
      group.customReplies[text]
    ) {
      return replyCommand(
        ctx,
        group.customReplies[text]
      );
    }

    return next();
  }
);

/* =========================================================
   الألعاب
========================================================= */

bot.hears(
  /^قفل الالعاب$/i,
  async ctx => {
    if (!requireRank(ctx, 7)) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    group.gamesEnabled = false;

    saveData();

    return replyCommand(
      ctx,
      "• تم قفل الالعاب"
    );
  }
);

bot.hears(
  /^فتح الالعاب$/i,
  async ctx => {
    if (!requireRank(ctx, 7)) {
      return;
    }

    const group =
      ensureGroup(ctx.chat.id);

    group.gamesEnabled = true;

    saveData();

    return replyCommand(
      ctx,
      "• تم فتح الالعاب"
    );
  }
);

/* =========================================================
   أوامر المطور
========================================================= */

const developerCommands = {
  "ا":
    "• معلومات العضو\n" +
    "• استخدم الأمر بالرد على المستخدم",

  "ت":
    "• تفاعل العضو\n" +
    "• استخدم الأمر بالرد على المستخدم",

  "ق":
    "• معلومات القروب\n" +
    "• حالة القروب والإعدادات",

  "م":
    "• المنشن والإشعارات\n" +
    "• إعدادات المنشن في القروب",

  "ن":
    "• حالة القروب\n" +
    "• الروابط والمخالفات والتنظيف",

  "ح":
    "• حماية القروب\n" +
    "• إعدادات الحماية",

  "د":
    "• بيانات الدعوة والقروب\n" +
    "• معلومات البوت"
};

for (
  const [
    command,
    description
  ] of Object.entries(
    developerCommands
  )
) {
  bot.hears(
    new RegExp(
      `^${command}$`,
      "i"
    ),
    async ctx => {
      if (!requireRank(ctx, 7)) {
        return;
      }

      if (command === "ا") {
        const target =
          await getRepliedUser(ctx);

        if (!target) {
          return replyCommand(
            ctx,
            "• لازم ترد على المستخدم"
          );
        }

        const user =
          ensureUser(target.id);

        return replyCommand(
          ctx,
          `• المستخدم ذا ↤︎ ${mention(target)}\n` +
          `• الرتبة ↤︎ ${escapeHtml(roleName(getLevel(ctx, target.id)))}\n` +
          `• التفاعل ↤︎ ${ensureGroup(ctx.chat.id).interactions[String(target.id)] || 0}\n` +
          `• اللقب ↤︎ ${user.title ? escapeHtml(user.title) : "-"}`
        );
      }

      if (command === "ت") {
        const target =
          await getRepliedUser(ctx);

        if (!target) {
          return replyCommand(
            ctx,
            "• لازم ترد على المستخدم"
          );
        }

        const group =
          ensureGroup(ctx.chat.id);

        const count =
          group.interactions[
            String(target.id)
          ] || 0;

        return replyCommand(
          ctx,
          `• المستخدم ذا ↤︎ ${mention(target)}\n` +
          `• عدد رسائل التفاعل ↤︎ ${count}`
        );
      }

      if (command === "ق") {
        const group =
          ensureGroup(ctx.chat.id);

        return replyCommand(
          ctx,
          `• معلومات القروب\n` +
          `━━━━━━━━━━━\n` +
          `• الاسم ↤︎ ${escapeHtml(ctx.chat.title || "-")}\n` +
          `• الأعضاء المحفوظين ↤︎ ${Object.keys(group.users).length}\n` +
          `• التفاعل ↤︎ ${Object.values(group.interactions).reduce((a, b) => a + Number(b), 0)}`
        );
      }

      if (command === "م") {
        const group =
          ensureGroup(ctx.chat.id);

        return replyCommand(
          ctx,
          `• المنشن ↤︎ ${group.mentionEnabled ? "مفتوح" : "مغلق"}\n` +
          `• الروابط ↤︎ ${group.linksEnabled ? "مفتوحة" : "مغلقة"}`
        );
      }

      if (command === "ن") {
        const group =
          ensureGroup(ctx.chat.id);

        return replyCommand(
          ctx,
          `• حالة القروب\n` +
          `━━━━━━━━━━━\n` +
          `• القروب ↤︎ ${group.groupOpen ? "مفتوح" : "مغلق"}\n` +
          `• المخالفات ↤︎ ${group.violationsEnabled ? "مفتوحة" : "مغلقة"}\n` +
          `• التنظيف التلقائي ↤︎ ${group.autoClean ? "مفعل" : "معطل"}`
        );
      }

      if (command === "ح") {
        const group =
          ensureGroup(ctx.chat.id);

        return replyCommand(
          ctx,
          `• الحماية\n` +
          `━━━━━━━━━━━\n` +
          `• الروابط ↤︎ ${group.linksEnabled ? "مفتوحة" : "مغلقة"}\n` +
          `• الكلمات الممنوعة ↤︎ ${group.forbiddenWords.length}\n` +
          `• المخالفات ↤︎ ${group.violationsEnabled ? "مفتوحة" : "مغلقة"}`
        );
      }

      if (command === "د") {
        return replyCommand(
          ctx,
          `• بيانات البوت\n` +
          `━━━━━━━━━━━\n` +
          `• القروبات ↤︎ ${Object.keys(data.groups).length}\n` +
          `• المستخدمين ↤︎ ${Object.keys(data.users).length}\n` +
          `• المشتركين ↤︎ ${data.subscribers.length}`
        );
      }

      return replyCommand(
        ctx,
        description
      );
    }
  );
}

/* =========================================================
   الإذاعة
========================================================= */

const broadcastPending =
  new Map();

bot.hears(
  /^إذاعة$/i,
  async ctx => {
    if (
      ctx.chat.type !==
      "private"
    ) {
      return replyCommand(
        ctx,
        "• استخدم الإذاعة في الخاص"
      );
    }

    if (
      !hasRank(ctx, 7)
    ) {
      return replyCommand(
        ctx,
        "• هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
      );
    }

    broadcastPending.set(
      ctx.from.id,
      true
    );

    return replyCommand(
      ctx,
      "• أرسل الآن رسالة الإذاعة"
    );
  }
);

bot.on(
  "message",
  async (ctx, next) => {
    if (
      ctx.chat.type !==
      "private"
    ) {
      return next();
    }

    if (
      !broadcastPending.get(
        ctx.from.id
      )
    ) {
      return next();
    }

    if (
      !hasRank(ctx, 7)
    ) {
      broadcastPending.delete(
        ctx.from.id
      );

      return next();
    }

    broadcastPending.delete(
      ctx.from.id
    );

    let success = 0;
    let failed = 0;

    for (
      const chatId of
        data.subscribers
    ) {
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
      `• تم إرسال الإذاعة\n` +
      `• نجح ↤︎ ${success}\n` +
      `• فشل ↤︎ ${failed}`
    );
  }
);

/* =========================================================
   حالة البوت
========================================================= */

bot.hears(
  /^حالة البوت$/i,
  async ctx => {
    if (!requireRank(ctx, 7)) {
      return;
    }

    return replyCommand(
      ctx,
      `• حالة البوت\n` +
      `━━━━━━━━━━━\n` +
      `• القروبات ↤︎ ${Object.keys(data.groups).length}\n` +
      `• المستخدمين ↤︎ ${Object.keys(data.users).length}\n` +
      `• المشتركين ↤︎ ${data.subscribers.length}\n` +
      `• الحالة ↤︎ يعمل`
    );
  }
);

/* =========================================================
   القائمة
========================================================= */

const mainMenu =
  Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "المطور",
        "menu_dev"
      ),
      Markup.button.callback(
        "الرتب",
        "menu_roles"
      )
    ],
    [
      Markup.button.callback(
        "الحماية",
        "menu_protection"
      ),
      Markup.button.callback(
        "التفاعل والألعاب والفعاليات",
        "menu_games"
      )
    ],
    [
      Markup.button.callback(
        "الهمسات والأغاني",
        "menu_music"
      ),
      Markup.button.callback(
        "الأوامر المخصصة",
        "menu_custom"
      )
    ],
    [
      Markup.button.callback(
        "القروب",
        "menu_group"
      )
    ]
  ]);

const menuText = {
  dev:
    "• المطور\n\n" +
    "• ا\n" +
    "• ت\n" +
    "• ق\n" +
    "• م\n" +
    "• ن\n" +
    "• ح\n" +
    "• د\n" +
    "• إذاعة\n" +
    "• حالة البوت",

  roles:
    "• الرتب\n\n" +
    "• رفع مميز\n" +
    "• رفع مالك\n" +
    "• رفع مالك أساسي\n" +
    "• رفع Myth\n" +
    "• رفع Myth🎖️\n" +
    "• رفع Dev²\n" +
    "• رفع ديف\n" +
    "• تنزيل\n" +
    "• رفع مشرف\n" +
    "• ترقيه",

  protection:
    "• الحماية\n\n" +
    "• كتم\n" +
    "• كتم عام\n" +
    "• حظر\n" +
    "• طرد\n" +
    "• تقييد\n" +
    "• الغاء التقييد\n" +
    "• رفع القيود\n" +
    "• مم\n" +
    "• خخ\n" +
    "• فتح الروابط\n" +
    "• قفل الروابط\n" +
    "• فتح القروب\n" +
    "• قفل القروب\n" +
    "• تفعيل التنظيف التلقائي\n" +
    "• تعطيل التنظيف التلقائي",

  games:
    "• التفاعل والألعاب والفعاليات\n\n" +
    "• تفاعلي\n" +
    "• المتفاعلين\n" +
    "• قفل الالعاب\n" +
    "• فتح الالعاب",

  music:
    "• الهمسات والأغاني\n\n" +
    "• اهمس\n" +
    "• همسه\n" +
    "• ه\n" +
    "• بحث أغنية <اسم الأغنية>",

  custom:
    "• الأوامر المخصصة\n\n" +
    "• اضف امر\n" +
    "• حذف امر\n" +
    "• اضف رد\n" +
    "• حذف رد\n" +
    "• اوامري\n" +
    "• ردودي",

  group:
    "• القروب\n\n" +
    "• رتبتي\n" +
    "• رتبته\n" +
    "• تفاعلي\n" +
    "• تفاعله\n" +
    "• المتفاعلين\n" +
    "• @all"
};

bot.hears(
  /^اوامر$/i,
  async ctx => {
    return ctx.reply(
      "• أوامر البوت",
      {
        ...mainMenu
      }
    );
  }
);

for (
  const key of Object.keys(
    menuText
  )
) {
  bot.action(
    `menu_${key}`,
    async ctx => {
      await ctx.answerCbQuery();

      return ctx.editMessageText(
        menuText[key],
        {
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "رجوع",
                "menu_home"
              )
            ]
          ])
        }
      );
    }
  );
}

bot.action(
  "menu_home",
  async ctx => {
    await ctx.answerCbQuery();

    return ctx.editMessageText(
      "• أوامر البوت",
      {
        ...mainMenu
      }
    );
  }
);

/* =========================================================
   أخطاء
========================================================= */

bot.catch(
  async (error, ctx) => {
    console.error(
      "BOT ERROR:",
      error
    );

    try {
      await ctx.reply(
        "• حدث خطأ أثناء تنفيذ الأمر"
      );
    } catch {}
  }
);

/* =========================================================
   حفظ دوري
========================================================= */

setInterval(
  () => {
    saveData();
  },
  30000
);

/* =========================================================
   التشغيل
========================================================= */

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
