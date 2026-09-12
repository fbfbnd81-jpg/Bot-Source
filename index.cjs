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
  console.log("yt-search غير مثبت.");
}

/* =========================================================
   تشغيل أغاني يوتيوب
========================================================= */

let youtubeClientPromise = null;

async function getYoutubeClient() {
  if (!youtubeClientPromise) {
    youtubeClientPromise = import("youtubei.js").then(
      async ({ Innertube }) => {
        return await Innertube.create();
      }
    );
  }

  return youtubeClientPromise;
}

async function streamToBuffer(stream) {
  if (!stream) {
    throw new Error("لم يتم الحصول على الصوت");
  }

  if (typeof stream.getReader === "function") {
    const reader = stream.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      if (value) {
        chunks.push(Buffer.from(value));
      }
    }

    return Buffer.concat(chunks);
  }

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function downloadYoutubeAudio(videoId) {
  const youtube = await getYoutubeClient();

  const stream = await youtube.download(
    videoId,
    {
      type: "audio",
      quality: "best"
    }
  );

  return streamToBuffer(stream);
}

const musicSearchCache = new Map();

function createMusicSearchId() {
  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2, 10)
  );
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

    const parsed = JSON.parse(
      fs.readFileSync(
        DATA_FILE,
        "utf8"
      )
    );

    return {
      ...DEFAULT_DATA,
      ...parsed,
      users: parsed.users || {},
      groups: parsed.groups || {},
      subscribers:
        parsed.subscribers || []
    };
  } catch (error) {
    console.error(
      "LOAD ERROR:",
      error
    );

    return JSON.parse(
      JSON.stringify(DEFAULT_DATA)
    );
  }
}

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        data,
        null,
        2
      )
    );
  } catch (error) {
    console.error(
      "SAVE ERROR:",
      error
    );
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

const DEV_USERNAME = "j4xa7";

function roleName(level) {
  for (
    const [name, value]
    of Object.entries(ROLES)
  ) {
    if (
      Number(value) ===
      Number(level)
    ) {
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

  const user =
    data.users[id];

  user.id =
    Number(userId);

  user.username ||=
    "";

  user.first_name ||=
    "";

  user.role =
    Number(
      user.role || 0
    );

  user.money =
    Number(
      user.money || 0
    );

  user.title ||=
    "";

  user.channel ||=
    "";

  user.interactions ||=
    {};

  user.whispers ||=
    [];

  return user;
}

/* =========================================================
   القروب
========================================================= */

function ensureGroup(chatId) {
  const id =
    String(chatId);

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

      protection: {
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
        voice: false,
        contacts: false,

        commands: false,
        english: false,
        crossGroupReplies: false
      }
    };
  }

  const group =
    data.groups[id];

  group.users ||=
    {};

  group.muted ||=
    {};

  group.globalMuted ||=
    {};

  group.forbiddenWords ||=
    [];

  group.trackedMessages ||=
    [];

  group.interactions ||=
    {};

  group.customCommands ||=
    {};

  group.customReplies ||=
    {};

  group.marriages ||=
    {};

  group.adminPermissions ||=
    {};

  group.games ||=
    {};

  group.protection ||=
    {};

  group.protection.enabled =
    group.protection.enabled !== false;

  group.protection.auto =
    group.protection.auto !== false;

  const protectionDefaults = {
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
    voice: false,
    contacts: false,

    commands: false,
    english: false,
    crossGroupReplies: false
  };

  for (
    const [key, value]
    of Object.entries(
      protectionDefaults
    )
  ) {
    if (
      group.protection[key] ===
      undefined
    ) {
      group.protection[key] =
        value;
    }
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
   مستوى المستخدم
========================================================= */

function isDeveloper(userId) {
  const user =
    ensureUser(userId);

  return (
    String(
      user.username || ""
    ).toLowerCase() ===
    DEV_USERNAME.toLowerCase()
  );
}

function isDevActor(ctx) {
  return (
    isDeveloper(
      ctx.from.id
    ) ||
    getUserLevel(
      ctx.from.id
    ) >= ROLES["Dev🎖️"]
  );
}

function getUserLevel(userId) {
  if (
    isDeveloper(userId)
  ) {
    return 7;
  }

  return Number(
    ensureUser(userId)
      .role || 0
  );
}

function getChatUser(
  ctx,
  userId
) {
  const group =
    ensureGroup(
      ctx.chat.id
    );

  const user =
    ensureUser(userId);

  const id =
    String(userId);

  group.users[id] ||= {
    id: Number(userId),
    username: "",
    first_name: "",
    role: 0
  };

  const saved =
    group.users[id];

  if (
    ctx.from?.id ===
    userId
  ) {
    saved.username =
      ctx.from.username ||
      saved.username ||
      "";

    saved.first_name =
      ctx.from.first_name ||
      saved.first_name ||
      "";
  }

  if (
    user.username
  ) {
    saved.username =
      user.username;
  }

  if (
    user.first_name
  ) {
    saved.first_name =
      user.first_name;
  }

  if (
    String(
      saved.username || ""
    ).toLowerCase() ===
    DEV_USERNAME.toLowerCase()
  ) {
    saved.role = 7;
  }

  return saved;
}

function getLevel(
  ctx,
  userId
) {
  if (
    isDeveloper(userId)
  ) {
    return 7;
  }

  const globalLevel =
    Number(
      ensureUser(userId)
        .role || 0
    );

  const groupLevel =
    Number(
      getChatUser(
        ctx,
        userId
      ).role || 0
    );

  return Math.max(
    globalLevel,
    groupLevel
  );
}

/* =========================================================
   HTML + المنشن
========================================================= */

function escapeHtml(
  text = ""
) {
  return String(text)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    );
}

function mention(user) {
  if (!user?.id) {
    return "المستخدم";
  }

  const saved =
    ensureUser(
      user.id
    );

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

  const displayName =
    title
      ? `${name}「${title}」`
      : name;

  return `<a href="tg://user?id=${user.id}">${escapeHtml(
    displayName
  )}</a>`;
}

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

        reply_parameters:
          ctx.message
            ?.message_id
            ? {
                message_id:
                  ctx.message
                    .message_id
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
   المستخدم المردود عليه
========================================================= */

async function getRepliedUser(
  ctx
) {
  return (
    ctx.message
      ?.reply_to_message
      ?.from ||
    null
  );
}

/* =========================================================
   الرتب
========================================================= */

function hasRank(
  ctx,
  level
) {
  return (
    getLevel(
      ctx,
      ctx.from.id
    ) >= level
  );
}

function requireRank(
  ctx,
  level
) {
  if (
    hasRank(
      ctx,
      level
    )
  ) {
    return true;
  }

  replyCommand(
    ctx,
    `• هذا الامر يخص ↤ ｢ ${escapeHtml(
      roleName(level)
    )} ｣`
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

  if (
    String(
      target.username || ""
    ).toLowerCase() ===
    DEV_USERNAME.toLowerCase()
  ) {
    replyCommand(
      ctx,
      "• ما تقدر تستخدم الامر على المطور"
    );

    return false;
  }

  const actorLevel =
    getLevel(
      ctx,
      ctx.from.id
    );

  const targetLevel =
    getLevel(
      ctx,
      target.id
    );

  if (
    actorLevel <=
    targetLevel
  ) {
    replyCommand(
      ctx,
      "• لا يمكن استخدام الامر على رتبه نفس رتبتك أو أعلى"
    );

    return false;
  }

  return true;
}

/* =========================================================
   تحديث المستخدم
========================================================= */

bot.use(
  async (
    ctx,
    next
  ) => {
    try {
      if (ctx.from) {
        const user =
          ensureUser(
            ctx.from.id
          );

        user.username =
          ctx.from.username ||
          "";

        user.first_name =
          ctx.from.first_name ||
          "";

        if (
          String(
            ctx.from.username ||
            ""
          ).toLowerCase() ===
          DEV_USERNAME.toLowerCase()
        ) {
          user.role = 7;
        }
      }

      if (
        ctx.chat &&
        ctx.chat.type !==
          "private" &&
        ctx.from
      ) {
        const group =
          ensureGroup(
            ctx.chat.id
          );

        const id =
          String(
            ctx.from.id
          );

        group.users[id] ||= {
          id:
            ctx.from.id,
          username:
            "",
          first_name:
            "",
          role:
            0
        };

        group.users[id]
          .username =
          ctx.from.username ||
          group.users[id]
            .username ||
          "";

        group.users[id]
          .first_name =
          ctx.from.first_name ||
          group.users[id]
            .first_name ||
          "";

        if (
          String(
            ctx.from.username ||
            ""
          ).toLowerCase() ===
          DEV_USERNAME.toLowerCase()
        ) {
          group.users[id]
            .role = 7;
        }
      }
    } catch {}

    return next();
  }
);

/* =========================================================
   التفاعل
========================================================= */

function addInteraction(
  ctx
) {
  if (
    !ctx.from ||
    !ctx.chat
  ) {
    return;
  }

  if (
    ctx.chat.type ===
    "private"
  ) {
    return;
  }

  const group =
    ensureGroup(
      ctx.chat.id
    );

  const id =
    String(
      ctx.from.id
    );

  group.interactions[id] =
    Number(
      group.interactions[id] ||
      0
    ) + 1;

  group.users[id] ||= {
    id:
      ctx.from.id,
    username:
      "",
    first_name:
      "",
    role:
      0
  };

  group.users[id]
    .username =
    ctx.from.username ||
    group.users[id]
      .username ||
    "";

  group.users[id]
    .first_name =
    ctx.from.first_name ||
    group.users[id]
      .first_name ||
    "";
}

/* =========================================================
   أنواع الرسائل
========================================================= */

function getMessageType(
  message
) {
  if (!message) {
    return "unknown";
  }

  if (message.text) {
    return "text";
  }

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
    return "animation";
  }

  if (message.audio) {
    return "audio";
  }

  if (message.voice) {
    return "voice";
  }

  if (message.video_note) {
    return "video_note";
  }

  if (message.contact) {
    return "contact";
  }

  if (message.location) {
    return "location";
  }

  if (message.venue) {
    return "venue";
  }

  if (message.poll) {
    return "poll";
  }

  if (message.dice) {
    return "dice";
  }

  return "unknown";
}

/* =========================================================
   تتبع الرسائل
========================================================= */

function trackMessage(
  ctx
) {
  if (
    !ctx.message ||
    !ctx.chat
  ) {
    return;
  }

  if (
    ctx.chat.type ===
    "private"
  ) {
    return;
  }

  const group =
    ensureGroup(
      ctx.chat.id
    );

  const msg =
    ctx.message;

  const type =
    getMessageType(msg);

  const text =
    msg.text ||
    msg.caption ||
    "";

  const hasLink =
    /(https?:\/\/|www\.|t\.me\/)/i.test(
      text
    );

  group.trackedMessages.push({
    messageId:
      msg.message_id,

    chatId:
      ctx.chat.id,

    userId:
      ctx.from?.id ||
      0,

    type,

    text:
      msg.text ||
      "",

    caption:
      msg.caption ||
      "",

    hasLink,

    date:
      Date.now()
  });

  if (
    group.trackedMessages
      .length > 2000
  ) {
    group.trackedMessages =
      group.trackedMessages
        .slice(-2000);
  }
}

/* =========================================================
   كشف الروابط والإعلانات
========================================================= */

function hasLink(
  text = ""
) {
  return (
    /(https?:\/\/|www\.|t\.me\/)/i.test(
      text
    ) ||
    /\b[a-z0-9.-]+\.(com|net|org|me|io|co|sa|ly|gg|tv)\b/i.test(
      text
    )
  );
}

function hasAd(
  text = ""
) {
  return /(للبيع|بيع|شراء|خصم|متجر|متجرنا|اعلان|إعلان|اعلانات|إعلانات|للتواصل|تواصل معنا|اطلب|سعر خاص|عرض خاص|خدمات|رقم التواصل)/i.test(
    text
  );
}

function hasEnglish(
  text = ""
) {
  return /[A-Za-z]{2,}/.test(
    text
  );
}

function hasMentionEntity(
  ctx
) {
  const entities = [
    ...(ctx.message?.entities ||
      []),

    ...(ctx.message
      ?.caption_entities ||
      [])
  ];

  return entities.some(
    entity =>
      entity.type ===
        "mention" ||
      entity.type ===
        "text_mention"
  );
}

function isForwarded(
  message
) {
  return !!(
    message?.forward_origin ||
    message?.forward_from ||
    message?.forward_from_chat ||
    message?.is_automatic_forward
  );
}

/* =========================================================
   سبب المخالفة
========================================================= */

function getViolationReason(
  ctx,
  group
) {
  const message =
    ctx.message;

  if (!message) {
    return null;
  }

  const p =
    group.protection;

  const text =
    message.text ||
    message.caption ||
    "";

  if (
    p.forwards &&
    isForwarded(message)
  ) {
    return "فوروورد";
  }

  if (
    p.crossGroupReplies &&
    message.reply_to_message &&
    isForwarded(
      message.reply_to_message
    )
  ) {
    return "ردود من قروبات ثانية";
  }

  if (
    p.links &&
    hasLink(text)
  ) {
    return "روابط";
  }

  if (
    p.ads &&
    hasAd(text)
  ) {
    return "إعلانات";
  }

  if (
    p.mentions &&
    hasMentionEntity(ctx)
  ) {
    return "منشن";
  }

  if (
    p.english &&
    hasEnglish(text)
  ) {
    return "إنجليزي";
  }

  if (
    p.commands &&
    /^\/\S+/.test(text)
  ) {
    return "أوامر";
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
    message.audio
  ) {
    return "صوتيات";
  }

  if (
    p.voice &&
    message.voice
  ) {
    return "رسائل صوتية";
  }

  if (
    p.contacts &&
    message.contact
  ) {
    return "جهات اتصال";
  }

  if (
    p.forbiddenWords &&
    group.forbiddenWords.some(
      word =>
        word &&
        text
          .toLowerCase()
          .includes(
            String(
              word
            ).toLowerCase()
          )
    )
  ) {
    return "كلمات ممنوعة";
  }

  return null;
}

/* =========================================================
   السبام
========================================================= */

const spamCache =
  new Map();

function spamReason(
  ctx,
  group
) {
  if (
    !group.protection
      .spam ||
    !ctx.from ||
    !ctx.message
  ) {
    return null;
  }

  const key =
    `${ctx.chat.id}:${ctx.from.id}`;

  const now =
    Date.now();

  const text =
    String(
      ctx.message.text ||
      ctx.message.caption ||
      ""
    )
      .toLowerCase()
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  const old =
    spamCache.get(key) ||
    [];

  const fresh =
    old.filter(
      item =>
        now -
          item.time <
        10000
    );

  fresh.push({
    time: now,
    text
  });

  spamCache.set(
    key,
    fresh.slice(-12)
  );

  if (
    fresh.length >= 9
  ) {
    return "سبام";
  }

  if (
    text &&
    fresh.filter(
      item =>
        item.text ===
        text
    ).length >= 4
  ) {
    return "التكرار والسبام";
  }

  return null;
}

/* =========================================================
   رسالة المخالفة
========================================================= */

async function sendViolation(
  ctx,
  reason
) {
  try {
    await ctx.deleteMessage();
  } catch {}

  try {
    const message =
      await ctx.reply(
        `• المستخدم ذا ↤︎ ${mention(
          ctx.from
        )}\n` +
        `• سبب المخالفة ↤︎ ${escapeHtml(
          reason
        )}`,
        {
          parse_mode:
            "HTML",

          reply_parameters:
            ctx.message?.message_id
              ? {
                  message_id:
                    ctx.message
                      .message_id
                }
              : undefined
        }
      );

    setTimeout(
      () => {
        ctx.telegram
          .deleteMessage(
            ctx.chat.id,
            message.message_id
          )
          .catch(() => {});
      },
      8000
    );
  } catch {}
}

/* =========================================================
   الحماية
========================================================= */

async function handleProtection(
  ctx
) {
  if (
    !ctx.message ||
    !ctx.chat
  ) {
    return false;
  }

  if (
    ctx.chat.type ===
    "private"
  ) {
    return false;
  }

  const group =
    ensureGroup(
      ctx.chat.id
    );

  if (
    !group.violationsEnabled ||
    !group.protection.enabled ||
    !group.protection.auto
  ) {
    return false;
  }

  if (
    getLevel(
      ctx,
      ctx.from.id
    ) > 0
  ) {
    return false;
  }

  let reason =
    getViolationReason(
      ctx,
      group
    );

  if (!reason) {
    reason =
      spamReason(
        ctx,
        group
      );
  }

  if (!reason) {
    return false;
  }

  await sendViolation(
    ctx,
    reason
  );

  return true;
}

/* =========================================================
   حماية التعديل
========================================================= */

bot.on(
  "edited_message",
  async ctx => {
    try {
      if (
        !ctx.chat ||
        !ctx.from ||
        !ctx.message
      ) {
        return;
      }

      if (
        ctx.chat.type ===
        "private"
      ) {
        return;
      }

      const group =
        ensureGroup(
          ctx.chat.id
        );

      if (
        !group.violationsEnabled ||
        !group.protection.enabled ||
        !group.protection.auto ||
        !group.protection.edit
      ) {
        return;
      }

      if (
        getLevel(
          ctx,
          ctx.from.id
        ) > 0
      ) {
        return;
      }

      const member =
        await getMemberStatus(
          ctx,
          ctx.from.id
        );

      if (
        member?.status ===
          "administrator" ||
        member?.status ===
          "creator"
      ) {
        return;
      }

      try {
        await ctx.deleteMessage();
      } catch {}

      try {
        const warning =
          await ctx.reply(
            `• المستخدم ذا ↤︎ ${mention(
              ctx.from
            )}\n` +
            `• سبب المخالفة ↤︎ التعديل`,
            {
              parse_mode:
                "HTML"
            }
          );

        setTimeout(
          () => {
            ctx.telegram
              .deleteMessage(
                ctx.chat.id,
                warning.message_id
              )
              .catch(() => {});
          },
          8000
        );
      } catch {}
    } catch {}
  }
);

/* =========================================================
   مراقبة الرسائل
========================================================= */

bot.on(
  "message",
  async (
    ctx,
    next
  ) => {
    try {
      if (
        ctx.chat?.type !==
        "private"
      ) {
        addInteraction(ctx);

        trackMessage(ctx);

        if (
          await handleProtection(
            ctx
          )
        ) {
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
      }

      saveData();
    } catch (error) {
      console.error(
        "MESSAGE ERROR:",
        error
      );
    }

    return next();
  }
);

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

bot.start(
  async ctx => {
    const payload =
      ctx.startPayload ||
      "";

    if (
      payload.startsWith(
        "whisper_"
      )
    ) {
      const id =
        payload.slice(
          "whisper_".length
        );

      const pending =
        whisperPending.get(
          id
        );

      if (!pending) {
        return replyCommand(
          ctx,
          "• الهمسه غير موجوده أو انتهت"
        );
      }

      if (
        ctx.from.id !==
        pending.senderId
      ) {
        return replyCommand(
          ctx,
          "• فقط صاحب الهمسة يقدر يكتبها"
        );
      }

      whisperStore.set(
        id,
        {
          ...pending,
          createdAt:
            Date.now()
        }
      );

      whisperPending.delete(
        id
      );

      return replyCommand(
        ctx,
        "• أرسل الآن الهمسة\n" +
        "• يمكنك إرسال نص أو ملصق أو صورة أو قيف\n-"
      );
    }

    if (
      payload.startsWith(
        "whisperreply_"
      )
    ) {
      const id =
        payload.slice(
          "whisperreply_".length
        );

      const whisper =
        whisperStore.get(
          id
        );

      if (!whisper) {
        return replyCommand(
          ctx,
          "• الهمسه غير موجوده أو انتهت"
        );
      }

      if (
        ctx.from.id !==
        whisper.recipientId
      ) {
        return replyCommand(
          ctx,
          "• هذه الهمسه ليست لك"
        );
      }

      whisperReplyPending.set(
        ctx.from.id,
        {
          originalId:
            id,

          senderId:
            ctx.from.id,

          recipientId:
            whisper.senderId,

          chatId:
            whisper.chatId
        }
      );

      return replyCommand(
        ctx,
        "• أرسل الآن ردك على الهمسة\n" +
        "• يمكنك إرسال نص أو ملصق أو صورة أو قيف\n-"
      );
    }

    if (
      ctx.chat.type ===
        "private" &&
      !data.subscribers.includes(
        ctx.chat.id
      )
    ) {
      data.subscribers.push(
        ctx.chat.id
      );

      saveData();
    }

    return replyCommand(
      ctx,
      `أهلا بك يا قلبي - ${mention(
        ctx.from
      )}\n\n` +
      `• انا اشغل لك اللي تبي بالمكالمه\n\n` +
      `ادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.`,
      {
        ...Markup.inlineKeyboard(
          [
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
          ]
        )
      }
    );
  }
);

bot.hears(
  /^(?:اهمس|همسه|ه)$/i,
  async ctx => {
    if (
      ctx.chat.type ===
      "private"
    ) {
      return replyCommand(
        ctx,
        "• استخدم الهمسه داخل القروب بالرد على المستخدم"
      );
    }

    const target =
      await getRepliedUser(
        ctx
      );

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
        senderId:
          ctx.from.id,

        sender: {
          id:
            ctx.from.id,

          first_name:
            ctx.from.first_name ||
            "",

          username:
            ctx.from.username ||
            ""
        },

        recipientId:
          target.id,

        recipient: {
          id:
            target.id,

          first_name:
            target.first_name ||
            "",

          username:
            target.username ||
            ""
        },

        chatId:
          ctx.chat.id
      }
    );

    const username =
      ctx.botInfo?.username ||
      "";

    return replyCommand(
      ctx,
      `• تم تحديد الهمسه لـ ↤ ${mention(
        target
      )}\n` +
      `• اضغط «اهمس هنا» لكتابة الهمسة`,
      {
        ...Markup.inlineKeyboard(
          [
            [
              Markup.button.url(
                "اهمس هنا",
                `https://t.me/${username}?start=whisper_${id}`
              )
            ]
          ]
        )
      }
    );
  }
);

async function getWhisperContent(
  message
) {
  if (message.text) {
    return {
      type:
        "text",

      text:
        message.text
    };
  }

  if (message.sticker) {
    return {
      type:
        "sticker",

      file_id:
        message.sticker.file_id
    };
  }

  if (message.photo) {
    return {
      type:
        "photo",

      file_id:
        message.photo[
          message.photo.length -
            1
        ].file_id,

      caption:
        message.caption ||
        ""
    };
  }

  if (message.animation) {
    return {
      type:
        "animation",

      file_id:
        message.animation.file_id,

      caption:
        message.caption ||
        ""
    };
  }

  return null;
}

async function sendWhisperToGroup(
  ctx,
  whisper,
  whisperId
) {
  try {
    await ctx.telegram.sendMessage(
      whisper.chatId,
      `• ياحلو ↤ ${mention(
        whisper.recipient
      )}\n\n` +
      `• وصلتك همسة سرية من ↤ ${mention(
        whisper.sender
      )}\n\n` +
      `• انت وحدك تقدر تشوفها`,
      {
        parse_mode:
          "HTML",

        reply_parameters: {
          message_id:
            whisper.originalMessageId
        },

        ...Markup.inlineKeyboard(
          [
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
          ]
        )
      }
    );
  } catch (error) {
    console.error(
      "SEND WHISPER ERROR:",
      error?.response
        ?.description ||
        error
    );
  }
}

bot.on(
  "message",
  async (
    ctx,
    next
  ) => {
    try {
      if (
        ctx.chat.type !==
        "private"
      ) {
        return next();
      }

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
          return replyCommand(
            ctx,
            "• نوع الرسالة غير مدعوم"
          );
        }

        const id =
          createWhisperId();

        const newWhisper = {
          senderId:
            ctx.from.id,

          sender: {
            id:
              ctx.from.id,

            first_name:
              ctx.from.first_name ||
              "",

            username:
              ctx.from.username ||
              ""
          },

          recipientId:
            replyPending.recipientId,

          recipient: {
            id:
              replyPending.recipientId,

            first_name:
              "",

            username:
              ""
          },

          chatId:
            replyPending.chatId,

          originalMessageId:
            replyPending.originalId,

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

        await replyCommand(
          ctx,
          "• تم ارسال الرد على الهمسة"
        );

        return sendWhisperToGroup(
          ctx,
          newWhisper,
          id
        );
      }

      let foundId =
        null;

      let whisper =
        null;

      for (
        const [
          id,
          item
        ]
        of whisperStore.entries()
      ) {
        if (
          item.senderId ===
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
        return replyCommand(
          ctx,
          "• نوع الرسالة غير مدعوم"
        );
      }

      whisper.content =
        content;

      whisper.originalMessageId =
        ctx.message.message_id;

      whisperStore.set(
        foundId,
        whisper
      );

      try {
        await ctx.deleteMessage();
      } catch {}

      await replyCommand(
        ctx,
        "• تم ارسال الهمسة"
      );

      return sendWhisperToGroup(
        ctx,
        whisper,
        foundId
      );
    } catch (error) {
      console.error(
        "WHISPER PRIVATE ERROR:",
        error
      );

      return next();
    }
  }
);

bot.action(
  /^whisper_view_(.+)$/,
  async ctx => {
    const whisper =
      whisperStore.get(
        ctx.match[1]
      );

    if (!whisper) {
      return ctx.answerCbQuery(
        "• الهمسه غير موجوده",
        {
          show_alert:
            true
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
          show_alert:
            true
        }
      );
    }

    if (
      !whisper.content
    ) {
      return ctx.answerCbQuery(
        "• الهمسه لم يتم إرسال محتواها",
        {
          show_alert:
            true
        }
      );
    }

    const content =
      whisper.content;

    if (
      content.type ===
      "text"
    ) {
      return ctx.answerCbQuery(
        `• الهمسة\n\n${content.text}`.slice(
          0,
          195
        ),
        {
          show_alert:
            true
        }
      );
    }

    return ctx.answerCbQuery(
      content.caption
        ? `• الهمسة:\n${content.caption}`.slice(
            0,
            195
          )
        : `• الهمسة تحتوي على ${
            content.type ===
            "photo"
              ? "صورة"
              : content.type ===
                "sticker"
              ? "ملصق"
              : "قيف"
          }`,
      {
        show_alert:
          true
      }
    );
  }
);

bot.action(
  /^whisper_reply_(.+)$/,
  async ctx => {
    const id =
      ctx.match[1];

    const whisper =
      whisperStore.get(
        id
      );

    if (!whisper) {
      return ctx.answerCbQuery(
        "• الهمسه غير موجوده",
        {
          show_alert:
            true
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
          show_alert:
            true
        }
      );
    }

    await ctx.answerCbQuery();

    whisperReplyPending.set(
      ctx.from.id,
      {
        originalId:
          id,

        senderId:
          ctx.from.id,

        recipientId:
          whisper.senderId,

        chatId:
          whisper.chatId
      }
    );

    return replyCommand(
      ctx,
      "• أرسل الآن ردك على الهمسة\n" +
      "• يمكنك إرسال نص أو ملصق أو صورة أو قيف\n-",
      {
        ...Markup.inlineKeyboard(
          [
            [
              Markup.button.url(
                "إرسال الرد",
                `https://t.me/${ctx.botInfo.username}?start=whisperreply_${id}`
              )
            ]
          ]
        )
      }
    );
  }
);

/* =========================================================
   الرتبة والتفاعل
========================================================= */

bot.hears(
  /^رتبتي$/i,
  async ctx => {
    return replyCommand(
      ctx,
      `• رتبتك ↤︎ ${escapeHtml(
        roleName(
          getLevel(
            ctx,
            ctx.from.id
          )
        )
      )}`
    );
  }
);

bot.hears(
  /^تفاعلي$/i,
  async ctx => {
    const group =
      ensureGroup(
        ctx.chat.id
      );

    const id =
      String(
        ctx.from.id
      );

    const count =
      Number(
        group.interactions[
          id
        ] || 0
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
      `• رتبتك ↤︎ ${escapeHtml(
        roleName(
          getLevel(
            ctx,
            ctx.from.id
          )
        )
      )}\n` +
      `• عدد رسائل التفاعل ↤︎ ${count}\n` +
      `• ترتيبك بين المتفاعلين ↤︎ ${
        ranking >= 0
          ? ranking + 1
          : "-"
      }`
    );
  }
);

bot.hears(
  /^المتفاعلين$/i,
  async ctx => {
    const group =
      ensureGroup(
        ctx.chat.id
      );

    const list =
      Object.entries(
        group.interactions
      )
        .sort(
          (a, b) =>
            Number(b[1]) -
            Number(a[1])
        )
        .slice(
          0,
          20
        );

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
        group.users[id] ||
        {
          id:
            Number(id),

          first_name:
            "مستخدم"
        };

      lines.push(
        `${i + 1}. ${mention(
          member
        )} ↤︎ ${count}`
      );
    }

    return replyCommand(
      ctx,
      "• المتفاعلين\n━━━━━━━━━━━\n" +
      lines.join(
        "\n"
      )
    );
  }
);

bot.hears(
  /^رتبته$/i,
  async ctx => {
    const target =
      await getRepliedUser(
        ctx
      );

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(
        target
      )}\n` +
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

bot.hears(
  /^تفاعله$/i,
  async ctx => {
    const target =
      await getRepliedUser(
        ctx
      );

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    const group =
      ensureGroup(
        ctx.chat.id
      );

    const id =
      String(
        target.id
      );

    const count =
      Number(
        group.interactions[
          id
        ] || 0
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
      `• المستخدم ذا ↤︎ ${mention(
        target
      )}\n` +
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
  [
    /^رفع مميز$/i,
    1,
    "مميز",
    2
  ],

  [
    /^رفع مالك$/i,
    2,
    "مالك",
    3
  ],

  [
    /^رفع مالك أساسي$/i,
    3,
    "مالك أساسي",
    5
  ],

  [
    /^رفع اساس$/i,
    3,
    "مالك أساسي",
    5
  ],

  [
    /^رفع Myth$/i,
    4,
    "Myth",
    5
  ],

  [
    /^رفع M$/i,
    4,
    "Myth",
    5
  ],

  [
    /^رفع Myth ?🎖️$/i,
    5,
    "Myth🎖️",
    6
  ],

  [
    /^رفع My$/i,
    5,
    "Myth🎖️",
    6
  ],

  [
    /^رفع اكس$/i,
    5,
    "Myth🎖️",
    6
  ],

  [
    /^رفع Dev²$/i,
    6,
    "Dev²🎖️",
    7
  ],

  [
    /^رفع مطور ثانوي$/i,
    6,
    "Dev²🎖️",
    7
  ],

  [
    /^رفع ديف$/i,
    7,
    "Dev🎖️",
    7
  ]
];

for (
  const [
    regex,
    level,
    name
  ]
  of promotionCommands
) {
  bot.hears(
    regex,
    async ctx => {
      if (
        !isDevActor(ctx)
      ) {
        return replyCommand(
          ctx,
          "• هذا الأمر يخص ↤ ｢ Dev🎖️ ｢"
        );
      }

      const target =
        await getRepliedUser(
          ctx
        );

      if (!target) {
        return replyCommand(
          ctx,
          "• لازم ترد على المستخدم"
        );
      }

      if (
        Number(
          target.id
        ) ===
        Number(
          ctx.from.id
        )
      ) {
        return replyCommand(
          ctx,
          "• ما تقدر ترفع نفسك"
        );
      }

      if (
        String(
          target.username ||
          ""
        ).toLowerCase() ===
        DEV_USERNAME.toLowerCase()
      ) {
        return replyCommand(
          ctx,
          "• ما تقدر تعدل رتبة المطور"
        );
      }

      const targetMember =
        await getMemberStatus(
          ctx,
          target.id
        );

      if (
        targetMember
          ?.status ===
        "creator"
      ) {
        return replyCommand(
          ctx,
          "• ما تقدر تعدل رتبة مالك القروب"
        );
      }

      const targetLevel =
        getLevel(
          ctx,
          target.id
        );

      if (
        targetLevel >=
        level
      ) {
        return replyCommand(
          ctx,
          "• المستخدم رتبته مساوية أو أعلى"
        );
      }

      const user =
        ensureUser(
          target.id
        );

      user.role =
        level;

      user.username =
        target.username ||
        "";

      user.first_name =
        target.first_name ||
        "";

      const group =
        ensureGroup(
          ctx.chat.id
        );

      group.users[
        String(
          target.id
        )
      ] ||= {
        id:
          target.id,

        username:
          target.username ||
          "",

        first_name:
          target.first_name ||
          "",

        role:
          0
      };

      group.users[
        String(
          target.id
        )
      ].role =
        level;

      saveData();

      return replyCommand(
        ctx,
        `• المستخدم ذا ↤︎ ${mention(
          target
        )}\n` +
        `• تم رفعه (${escapeHtml(
          name
        )})`
      );
    }
  );
}

bot.hears(
  /^تنزيل$/i,
  async ctx => {
    if (
      !isDevActor(ctx)
    ) {
      return replyCommand(
        ctx,
        "• هذا الأمر يخص ↤ ｢ Dev🎖️ ｢"
      );
    }

    const target =
      await getRepliedUser(
        ctx
      );

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    if (
      Number(
        target.id
      ) ===
      Number(
        ctx.from.id
      )
    ) {
      return replyCommand(
        ctx,
        "• ما تقدر تنزل رتبتك"
      );
    }

    if (
      String(
        target.username ||
        ""
      ).toLowerCase() ===
      DEV_USERNAME.toLowerCase()
    ) {
      return replyCommand(
        ctx,
        "• ما تقدر تنزل رتبة المطور"
      );
    }

    const targetMember =
      await getMemberStatus(
        ctx,
        target.id
      );

    if (
      targetMember
        ?.status ===
      "creator"
    ) {
      return replyCommand(
        ctx,
        "• ما تقدر تنزل رتبة مالك القروب"
      );
    }

    const targetLevel =
      getLevel(
        ctx,
        target.id
      );

    if (
      targetLevel >=
      7
    ) {
      return replyCommand(
        ctx,
        "• ما تقدر تنزل رتبة Dev🎖️"
      );
    }

    const oldRole =
      roleName(
        targetLevel
      );

    const group =
      ensureGroup(
        ctx.chat.id
      );

    const wasMuted =
      !!(
        group.muted[
          String(
            target.id
          )
        ] ||
        group.globalMuted[
          String(
            target.id
          )
        ]
      );

    ensureUser(
      target.id
    ).role = 0;

    if (
      group.users[
        String(
          target.id
        )
      ]
    ) {
      group.users[
        String(
          target.id
        )
      ].role = 0;
    }

    saveData();

    if (wasMuted) {
      return replyCommand(
        ctx,
        `• تم تنزيله من الرتب التالية ( ${escapeHtml(
          oldRole
        )} )\n\n` +
        `• المستخدم ذا ↤︎ ${mention(
          target
        )}\n` +
        `• من قبل مكتوم`
      );
    }

    return replyCommand(
      ctx,
      `• تم تنزيله من الرتب التالية ( ${escapeHtml(
        oldRole
      )} )\n\n` +
      `• المستخدم ذا ↤︎ ${mention(
        target
      )}`
    );
  }
);

/* =========================================================
   صلاحيات البوت
========================================================= */

async function getBotMember(
  ctx
) {
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
      error?.response
        ?.description ||
        error
    );

    return null;
  }
}

const permissionNames = {
  can_manage_chat:
    "إدارة القروب",

  can_delete_messages:
    "حذف الرسائل",

  can_manage_video_chats:
    "إدارة المكالمات",

  can_restrict_members:
    "تقييد الأعضاء",

  can_promote_members:
    "إضافة المشرفين",

  can_change_info:
    "تغيير معلومات القروب",

  can_invite_users:
    "إضافة الأعضاء",

  can_pin_messages:
    "تثبيت الرسائل",

  can_manage_topics:
    "إدارة المواضيع",

  can_post_stories:
    "نشر القصص",

  can_edit_stories:
    "تعديل القصص",

  can_delete_stories:
    "حذف القصص"
};

async function checkBotPermission(
  ctx,
  permission
) {
  const member =
    await getBotMember(
      ctx
    );

  if (!member) {
    return {
      ok: false,

      message:
        "• ما قدرت أعرف صلاحيات البوت داخل القروب"
    };
  }

  if (
    member.status !==
    "administrator"
  ) {
    return {
      ok: false,

      message:
        "• البوت ليس مشرفًا في القروب"
    };
  }

  if (
    permission &&
    member[permission] !==
      true
  ) {
    return {
      ok: false,

      message:
        `• البوت مشرف لكن ما عنده صلاحية ${
          permissionNames[
            permission
          ] ||
          permission
        }\n` +
        "• فعّل الصلاحية من إعدادات مشرفي القروب"
    };
  }

  return {
    ok: true,
    member
  };
}

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
      error?.response
        ?.description ||
        error
    );

    return null;
  }
}

/* =========================================================
   الكتم والحظر
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
    await getMemberStatus(
      ctx,
      userId
    );

  if (
    target?.status ===
    "creator"
  ) {
    throw new Error(
      "• لا يمكن تقييد مالك القروب"
    );
  }

  if (
    target?.status ===
    "administrator"
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
        can_send_messages:
          false,

        can_send_audios:
          false,

        can_send_documents:
          false,

        can_send_photos:
          false,

        can_send_videos:
          false,

        can_send_video_notes:
          false,

        can_send_voice_notes:
          false,

        can_send_polls:
          false,

        can_send_other_messages:
          false,

        can_add_web_page_previews:
          false
      }
    }
  );
}

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
        can_send_messages:
          true,

        can_send_audios:
          true,

        can_send_documents:
          true,

        can_send_photos:
          true,

        can_send_videos:
          true,

        can_send_video_notes:
          true,

        can_send_voice_notes:
          true,

        can_send_polls:
          true,

        can_send_other_messages:
          true,

        can_add_web_page_previews:
          true
      }
    }
  );
}

async function muteTarget(
  ctx,
  global = false
) {
  const target =
    await getRepliedUser(
      ctx
    );

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
    return replyCommand(
      ctx,
      error?.message?.startsWith(
        "•"
      )
        ? error.message
        : "• ما قدرت أكتم المستخدم\n• تأكد أن البوت مشرف وعنده صلاحية تقييد الأعضاء"
    );
  }

  const group =
    ensureGroup(
      ctx.chat.id
    );

  const saved = {
    id:
      target.id,

    username:
      target.username ||
      "",

    first_name:
      target.first_name ||
      ""
  };

  if (global) {
    group.globalMuted[
      String(
        target.id
      )
    ] = saved;
  } else {
    group.muted[
      String(
        target.id
      )
    ] = saved;
  }

  saveData();

  return replyCommand(
    ctx,
    `• المستخدم ذا ↤︎ ${mention(
      target
    )}\n` +
    `• ${
      global
        ? "كتمته عام"
        : "كتمته"
    }`
  );
}

function isMuted(ctx) {
  return !!ensureGroup(
    ctx.chat.id
  ).muted[
    String(
      ctx.from.id
    )
  ];
}

function isGlobalMuted(ctx) {
  return !!ensureGroup(
    ctx.chat.id
  ).globalMuted[
    String(
      ctx.from.id
    )
  ];
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
      await getRepliedUser(
        ctx
      );

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
      return replyCommand(
        ctx,
        error?.message?.startsWith(
          "•"
        )
          ? error.message
          : "• ما قدرت أفك الكتم"
      );
    }

    delete ensureGroup(
      ctx.chat.id
    ).muted[
      String(
        target.id
      )
    ];

    saveData();

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(
        target
      )}\n• فكيت الكتم عنه`
    );
  }
);

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
      await getRepliedUser(
        ctx
      );

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
      return replyCommand(
        ctx,
        error?.message?.startsWith(
          "•"
        )
          ? error.message
          : "• ما قدرت أفك الكتم العام"
      );
    }

    delete ensureGroup(
      ctx.chat.id
    ).globalMuted[
      String(
        target.id
      )
    ];

    saveData();

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(
        target
      )}\n• فكيت الكتم العام عنه`
    );
  }
);

/* =========================================================
   مسح المكتومين
========================================================= */

bot.hears(
  /^(?:مم|مسح المكتومين)$/i,
  async ctx => {
    if (
      !requireRank(
        ctx,
        4
      )
    ) {
      return;
    }

    const group =
      ensureGroup(
        ctx.chat.id
      );

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
          String(
            user.id
          )
        ];

        count++;
      } catch {}
    }

    saveData();

    return replyCommand(
      ctx,
      `• تم مسح ( ${count} ) من المكتومين`
    );
  }
);

bot.hears(
  /^(?:خخ|مسح المكتومين عام)$/i,
  async ctx => {
    if (
      !requireRank(
        ctx,
        5
      )
    ) {
      return;
    }

    const group =
      ensureGroup(
        ctx.chat.id
      );

    const muted =
      Object.values(
        group.globalMuted ||
          {}
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
          String(
            user.id
          )
        ];

        count++;
      } catch {}
    }

    saveData();

    return replyCommand(
      ctx,
      `• تم مسح ( ${count} ) من المكتومين عام`
    );
  }
);

/* =========================================================
   التقييد
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
      await getRepliedUser(
        ctx
      );

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
      return replyCommand(
        ctx,
        error?.message?.startsWith(
          "•"
        )
          ? error.message
          : "• ما قدرت أقيد المستخدم"
      );
    }

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(
        target
      )}\n• قيدته`
    );
  }
);

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
      await getRepliedUser(
        ctx
      );

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
      return replyCommand(
        ctx,
        error?.message?.startsWith(
          "•"
        )
          ? error.message
          : "• ما قدرت ألغي التقييد"
      );
    }

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(
        target
      )}\n• تم الغاء التقييد عنه`
    );
  }
);

bot.hears(
  /^رفع القيود$/i,
  async ctx => {
    if (
      !requireRank(
        ctx,
        6
      )
    ) {
      return;
    }

    const target =
      await getRepliedUser(
        ctx
      );

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
      return replyCommand(
        ctx,
        error?.message?.startsWith(
          "•"
        )
          ? error.message
          : "• ما قدرت أرفع القيود"
      );
    }

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(
        target
      )}\n• تم رفع القيود عنه`
    );
  }
);

/* =========================================================
   الحظر والطرد
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
      await getRepliedUser(
        ctx
      );

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
    } catch {
      return replyCommand(
        ctx,
        "• ما قدرت أحظر المستخدم\n• تأكد أن البوت مشرف وعنده صلاحية حظر الأعضاء"
      );
    }

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(
        target
      )}\n• حظرته`
    );
  }
);

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
      await getRepliedUser(
        ctx
      );

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    if (
      String(
        target.username ||
        ""
      ).toLowerCase() ===
      DEV_USERNAME.toLowerCase()
    ) {
      return replyCommand(
        ctx,
        "• ما تقدر تستخدم الامر على المطور"
      );
    }

    try {
      await ctx.telegram.unbanChatMember(
        ctx.chat.id,
        target.id
      );
    } catch {
      return replyCommand(
        ctx,
        "• ما قدرت أفك الحظر"
      );
    }

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(
        target
      )}\n• فكيت الحظر عنه`
    );
  }
);

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
      await getRepliedUser(
        ctx
      );

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
    } catch {
      return replyCommand(
        ctx,
        "• ما قدرت أطرد المستخدم\n• تأكد أن البوت مشرف وعنده صلاحية حظر الأعضاء"
      );
    }

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(
        target
      )}\n• طردته`
    );
  }
);

/* =========================================================
   رفع مشرف - نظام الصلاحيات
========================================================= */

const ADMIN_PROMOTION_PERMISSIONS = [
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

const pendingAdminPromotions =
  new Map();

function createAdminPromotionKey() {
  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2, 9)
  );
}

function promotionText(
  state
) {
  const lines = [
    `• حدد الصلاحيات ↦ ${mention(
      state.target
    )}`,

    "━━━━━━━━━━━"
  ];

  for (
    const [
      key,
      name
    ]
    of ADMIN_PROMOTION_PERMISSIONS
  ) {
    lines.push(
      `• ${name} ↤︎ ${
        state.permissions[key]
          ? "نعم"
          : "لا"
      }`
    );
  }

  return lines.join(
    "\n"
  );
}

function promotionKeyboard(
  state
) {
  const rows = [];

  for (
    const [
      key,
      name
    ]
    of ADMIN_PROMOTION_PERMISSIONS
  ) {
    rows.push([
      Markup.button.callback(
        `${
          state.permissions[key]
            ? "🟢"
            : "⚪"
        } ${name}`,

        `adminprom_set:${state.key}:${key}`
      )
    ]);
  }

  rows.push([
    Markup.button.callback(
      "🔴 إخفاء الأمر",
      `adminprom_done:${state.key}`
    )
  ]);

  return Markup.inlineKeyboard(
    rows
  );
}

bot.hears(
  /^(?:رفع مشرف|ترقيه)$/i,
  async ctx => {
    if (
      !isDevActor(ctx)
    ) {
      return replyCommand(
        ctx,
        "• هذا الأمر يخص ↤ ｢ Dev🎖️ ｢"
      );
    }

    const target =
      await getRepliedUser(
        ctx
      );

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    if (
      Number(
        target.id
      ) ===
      Number(
        ctx.from.id
      )
    ) {
      return replyCommand(
        ctx,
        "• ما تقدر ترفع نفسك مشرف"
      );
    }

    if (
      String(
        target.username ||
        ""
      ).toLowerCase() ===
      DEV_USERNAME.toLowerCase()
    ) {
      return replyCommand(
        ctx,
        "• ما تقدر تعدل المطور"
      );
    }

    const targetMember =
      await getMemberStatus(
        ctx,
        target.id
      );

    if (
      targetMember?.status ===
      "creator"
    ) {
      return replyCommand(
        ctx,
        "• ما تقدر ترفع مالك القروب"
      );
    }

    const permission =
      await checkBotPermission(
        ctx,
        "can_promote_members"
      );

    if (!permission.ok) {
      return replyCommand(
        ctx,
        permission.message
      );
    }

    const key =
      createAdminPromotionKey();

    const state = {
      key,

      chatId:
        ctx.chat.id,

      initiatorId:
        ctx.from.id,

      targetId:
        target.id,

      target: {
        id:
          target.id,

        first_name:
          target.first_name ||
          "",

        username:
          target.username ||
          ""
      },

      commandMessageId:
        ctx.message?.message_id,

      permissions: {
        can_change_info:
          false,

        can_pin_messages:
          false,

        can_restrict_members:
          false,

        can_invite_users:
          false,

        can_delete_messages:
          false,

        can_manage_video_chats:
          false,

        can_promote_members:
          false
      }
    };

    pendingAdminPromotions.set(
      key,
      state
    );

    return replyCommand(
      ctx,
      promotionText(
        state
      ),
      {
        ...promotionKeyboard(
          state
        )
      }
    );
  }
);

/* =========================================================
   Callback - صلاحيات رفع المشرف
========================================================= */

bot.action(
  /^adminprom_(set|done):(.+?)(?::(.+))?$/,
  async ctx => {
    const action =
      ctx.match[1];

    const key =
      ctx.match[2];

    const permission =
      ctx.match[3];

    const state =
      pendingAdminPromotions.get(
        key
      );

    if (!state) {
      return ctx.answerCbQuery(
        "انتهى الأمر"
      );
    }

    if (
      Number(
        ctx.from.id
      ) !==
      Number(
        state.initiatorId
      )
    ) {
      return ctx.answerCbQuery(
        "هذا الأمر مو لك"
      );
    }

    if (
      Number(
        ctx.chat?.id
      ) !==
      Number(
        state.chatId
      )
    ) {
      return ctx.answerCbQuery(
        "هذا الأمر مو لهذا القروب"
      );
    }

    if (
      !isDevActor(ctx)
    ) {
      return ctx.answerCbQuery(
        "ما عندك صلاحية"
      );
    }

    if (
      action ===
      "set"
    ) {
      if (
        !Object.prototype.hasOwnProperty.call(
          state.permissions,
          permission
        )
      ) {
        return ctx.answerCbQuery(
          "صلاحية غير موجودة"
        );
      }

      state.permissions[
        permission
      ] =
        !state.permissions[
          permission
        ];

      try {
        await ctx.editMessageText(
          promotionText(
            state
          ),
          {
            parse_mode:
              "HTML",

            ...promotionKeyboard(
              state
            )
          }
        );

        return ctx.answerCbQuery(
          state.permissions[
            permission
          ]
            ? "تم التفعيل"
            : "تم الإلغاء"
        );
      } catch (error) {
        console.error(
          "ADMIN PROMOTION BUTTON ERROR:",
          error
        );

        return ctx.answerCbQuery(
          "حدث خطأ"
        );
      }
    }

    if (
      action ===
      "done"
    ) {
      try {
        const permission =
          await checkBotPermission(
            ctx,
            "can_promote_members"
          );

        if (!permission.ok) {
          return ctx.answerCbQuery(
            "البوت ما عنده صلاحية"
          );
        }

        const targetMember =
          await getMemberStatus(
            ctx,
            state.targetId
          );

        if (!targetMember) {
          return ctx.answerCbQuery(
            "تعذر معرفة المستخدم"
          );
        }

        if (
          targetMember.status ===
          "creator"
        ) {
          return ctx.answerCbQuery(
            "ما تقدر ترفع المالك"
          );
        }

        if (
          Number(
            state.targetId
          ) ===
          Number(
            state.initiatorId
          )
        ) {
          return ctx.answerCbQuery(
            "ما تقدر ترفع نفسك"
          );
        }

        await ctx.telegram.promoteChatMember(
          state.chatId,
          state.targetId,
          {
            is_anonymous:
              false,

            can_manage_chat:
              true,

            can_change_info:
              state.permissions
                .can_change_info,

            can_post_messages:
              false,

            can_edit_messages:
              false,

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

            can_manage_topics:
              false,

            can_post_stories:
              false,

            can_edit_stories:
              false,

            can_delete_stories:
              false
          }
        );

        const group =
          ensureGroup(
            state.chatId
          );

        group.adminPermissions[
          String(
            state.targetId
          )
        ] = {
          ...state.permissions
        };

        saveData();

        pendingAdminPromotions.delete(
          key
        );

        try {
          await ctx.deleteMessage();
        } catch {}

        await ctx.telegram.sendMessage(
          state.chatId,
          `• المستخدم ذا ↤︎ ${mention(
            state.target
          )}\n• تم رفعه الرتبه`,
          {
            parse_mode:
              "HTML",

            reply_parameters:
              state.commandMessageId
                ? {
                    message_id:
                      state.commandMessageId
                  }
                : undefined
          }
        );

        return ctx.answerCbQuery(
          "تم رفعه مشرف"
        );
      } catch (error) {
        console.error(
          "ADMIN PROMOTION ERROR:",
          error?.response
            ?.description ||
            error
        );

        return ctx.answerCbQuery(
          error?.response
            ?.description ||
          "ما قدرت أرفع المشرف"
        );
      }
    }
  }
);

/* =========================================================
   تنزيل مشرف
========================================================= */

bot.hears(
  /^(?:تنزيل مشرف|تنزيل المشرف)$/i,
  async ctx => {
    if (
      !isDevActor(ctx)
    ) {
      return replyCommand(
        ctx,
        "• هذا الأمر يخص ↤ ｢ Dev🎖️ ｢"
      );
    }

    const target =
      await getRepliedUser(
        ctx
      );

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    if (
      Number(
        target.id
      ) ===
      Number(
        ctx.from.id
      )
    ) {
      return replyCommand(
        ctx,
        "• ما تقدر تنزل نفسك"
      );
    }

    if (
      String(
        target.username ||
        ""
      ).toLowerCase() ===
      DEV_USERNAME.toLowerCase()
    ) {
      return replyCommand(
        ctx,
        "• ما تقدر تنزل المطور"
      );
    }

    const targetMember =
      await getMemberStatus(
        ctx,
        target.id
      );

    if (!targetMember) {
      return replyCommand(
        ctx,
        "• تعذر معرفة حالة المستخدم"
      );
    }

    if (
      targetMember.status ===
      "creator"
    ) {
      return replyCommand(
        ctx,
        "• ما تقدر تنزل مالك القروب"
      );
    }

    if (
      targetMember.status !==
      "administrator"
    ) {
      return replyCommand(
        ctx,
        "• المستخدم مو مشرف"
      );
    }

    const permission =
      await checkBotPermission(
        ctx,
        "can_promote_members"
      );

    if (!permission.ok) {
      return replyCommand(
        ctx,
        permission.message
      );
    }

    try {
      await ctx.telegram.promoteChatMember(
        ctx.chat.id,
        target.id,
        {
          is_anonymous:
            false,

          can_manage_chat:
            false,

          can_delete_messages:
            false,

          can_manage_video_chats:
            false,

          can_restrict_members:
            false,

          can_promote_members:
            false,

          can_change_info:
            false,

          can_invite_users:
            false,

          can_pin_messages:
            false,

          can_manage_topics:
            false,

          can_post_stories:
            false,

          can_edit_stories:
            false,

          can_delete_stories:
            false
        }
      );
    } catch (error) {
      return replyCommand(
        ctx,
        error?.response
          ?.description ||
        "• ما قدرت أنزل المشرف"
      );
    }

    delete ensureGroup(
      ctx.chat.id
    ).adminPermissions[
      String(
        target.id
      )
    ];

    saveData();

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(
        target
      )}\n• تم تنزيله من الإشراف`
    );
  }
);

/* =========================================================
   الصلاحيات الفعلية
========================================================= */

const ADMIN_PERMISSION_NAMES = {
  can_change_info:
    "تغيير المعلومات",

  can_pin_messages:
    "تثبيت الرسائل",

  can_manage_topics:
    "ادارة المواضيع",

  can_invite_users:
    "اضافه مستخدمين",

  can_delete_messages:
    "مسح الرسائل",

  can_restrict_members:
    "حظر المستخدمين",

  can_promote_members:
    "اضافه المشرفين"
};

async function formatActualPermissions(
  ctx,
  userId
) {
  const member =
    await getMemberStatus(
      ctx,
      userId
    );

  if (!member) {
    return null;
  }

  const lines = [];

  if (
    member.status ===
    "creator"
  ) {
    for (
      const [
        ,
        name
      ]
      of Object.entries(
        ADMIN_PERMISSION_NAMES
      )
    ) {
      lines.push(
        `• ${name} ↤︎ نعم`
      );
    }

    return {
      member,
      text:
        lines.join(
          "\n"
        )
    };
  }

  for (
    const [
      key,
      name
    ]
    of Object.entries(
      ADMIN_PERMISSION_NAMES
    )
  ) {
    lines.push(
      `• ${name} ↤︎ ${
        member.status ===
          "administrator" &&
        member[key] ===
          true
          ? "نعم"
          : "لا"
      }`
    );
  }

  return {
    member,

    text:
      lines.join(
        "\n"
      )
  };
}

bot.hears(
  /^صلاحياتي$/i,
  async ctx => {
    if (
      ctx.chat.type !==
        "group" &&
      ctx.chat.type !==
        "supergroup"
    ) {
      return replyCommand(
        ctx,
        "• هذا الامر يستخدم داخل القروب"
      );
    }

    const result =
      await formatActualPermissions(
        ctx,
        ctx.from.id
      );

    if (!result) {
      return replyCommand(
        ctx,
        "• تعذر الحصول على صلاحياتك"
      );
    }

    return replyCommand(
      ctx,
      `• صلاحياتك بالإشراف :\n` +
      "━━━━━━━━━━━\n" +
      result.text
    );
  }
);

bot.hears(
  /^صلاحياته$/i,
  async ctx => {
    const target =
      await getRepliedUser(
        ctx
      );

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    const result =
      await formatActualPermissions(
        ctx,
        target.id
      );

    if (!result) {
      return replyCommand(
        ctx,
        "• تعذر الحصول على صلاحيات المستخدم"
      );
    }

    return replyCommand(
      ctx,
      `• صلاحياته بالإشراف :\n` +
      "━━━━━━━━━━━\n" +
      result.text
    );
  }
);

bot.hears(
  /^صلاحيات المستخدم$/i,
  async ctx => {
    const target =
      await getRepliedUser(
        ctx
      );

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    const result =
      await formatActualPermissions(
        ctx,
        target.id
      );

    if (!result) {
      return replyCommand(
        ctx,
        "• تعذر الحصول على صلاحيات المستخدم"
      );
    }

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(
        target
      )}\n` +
      "• صلاحيات المستخدم\n" +
      "━━━━━━━━━━━\n" +
      result.text
    );
  }
);

/* =========================================================
   المالك
========================================================= */

bot.hears(
  /^المالك$/i,
  async ctx => {
    if (
      ctx.chat.type !==
        "group" &&
      ctx.chat.type !==
        "supergroup"
    ) {
      return replyCommand(
        ctx,
        "• هذا الامر يستخدم داخل القروب"
      );
    }

    try {
      const admins =
        await ctx.telegram.getChatAdministrators(
          ctx.chat.id
        );

      const owner =
        admins.find(
          member =>
            member.status ===
            "creator"
        );

      if (!owner) {
        return replyCommand(
          ctx,
          "• ما قدرت أحدد مالك القروب"
        );
      }

      const user =
        owner.user;

      let bio = "";

      try {
        const chat =
          await ctx.telegram.getChat(
            user.id
          );

        bio =
          chat.bio ||
          chat.description ||
          "";
      } catch {}

      const username =
        user.username
          ? `@${user.username}`
          : "غير موجود";

      let photoFileId =
        null;

      try {
        const photos =
          await ctx.telegram.getUserProfilePhotos(
            user.id,
            {
              limit: 1
            }
          );

        if (
          photos.total_count >
            0 &&
          photos.photos?.[0]
            ?.length
        ) {
          photoFileId =
            photos.photos[0][
              photos.photos[0]
                .length - 1
            ].file_id;
        }
      } catch {}

      const caption =
        `• المالك\n` +
        `• اليوزر ↤︎ ${escapeHtml(
          username
        )}\n` +
        `• البايو ↤︎ ${
          bio
            ? escapeHtml(
                bio
              )
            : "غير موجود"
        }`;

      if (
        photoFileId
      ) {
        return ctx.replyWithPhoto(
          photoFileId,
          {
            caption,

            parse_mode:
              "HTML",

            reply_parameters:
              ctx.message
                ?.message_id
                ? {
                    message_id:
                      ctx.message
                        .message_id
                  }
                : undefined
          }
        );
      }

      return replyCommand(
        ctx,
        caption
      );
    } catch (error) {
      console.error(
        "OWNER ERROR:",
        error?.response
          ?.description ||
          error
      );

      return replyCommand(
        ctx,
        "• ما قدرت أجيب بيانات المالك"
      );
    }
  }
);

/* =========================================================
   حالة الحماية
========================================================= */

function protectionStatusText(
  group
) {
  const p =
    group.protection;

  return (
    "🛡️ حالة الحماية\n\n" +

    `• الحماية ↤︎ ${
      p.enabled
        ? "مفعل ✅"
        : "معطل ❌"
    }\n` +

    `• الحماية التلقائية ↤︎ ${
      p.auto
        ? "مفعل ✅"
        : "معطل ❌"
    }\n` +

    `• الروابط ↤︎ ${
      p.links
        ? "مفعل ✅"
        : "معطل ❌"
    }\n` +

    `• التعديل ↤︎ ${
      p.edit
        ? "مفعل ✅"
        : "معطل ❌"
    }\n` +

    `• السبام والتكرار ↤︎ ${
      p.spam
        ? "مفعل ✅"
        : "معطل ❌"
    }\n` +

    `• الإعلانات ↤︎ ${
      p.ads
        ? "مفعل ✅"
        : "معطل ❌"
    }\n` +

    `• المنشن ↤︎ ${
      p.mentions
        ? "مفعل ✅"
        : "معطل ❌"
    }\n` +

    `• الفوروورد ↤︎ ${
      p.forwards
        ? "مفعل ✅"
        : "معطل ❌"
    }\n` +

    `• الصور ↤︎ ${
      p.photos
        ? "مفعل ✅"
        : "معطل ❌"
    }\n` +

    `• الفيديو ↤︎ ${
      p.videos
        ? "مفعل ✅"
        : "معطل ❌"
    }\n` +

    `• الملفات ↤︎ ${
      p.documents
        ? "مفعل ✅"
        : "معطل ❌"
    }\n` +

    `• الملصقات ↤︎ ${
      p.stickers
        ? "مفعل ✅"
        : "معطل ❌"
    }\n` +

    `• GIF ↤︎ ${
      p.gifs
        ? "مفعل ✅"
        : "معطل ❌"
    }\n` +

    `• الصوتيات ↤︎ ${
      p.audio
        ? "مفعل ✅"
        : "معطل ❌"
    }\n` +

    `• الرسائل الصوتية ↤︎ ${
      p.voice
        ? "مفعل ✅"
        : "معطل ❌"
    }\n` +

    `• جهات الاتصال ↤︎ ${
      p.contacts
        ? "مفعل ✅"
        : "معطل ❌"
    }\n` +

    `• الأوامر ↤︎ ${
      p.commands
        ? "مفعل ✅"
        : "معطل ❌"
    }\n` +

    `• الإنجليزي ↤︎ ${
      p.english
        ? "مفعل ✅"
        : "معطل ❌"
    }\n` +

    `• الكلمات الممنوعة ↤︎ ${
      group.forbiddenWords
        .length
    }\n` +

    `• الردود من القروبات الثانية ↤︎ ${
      p.crossGroupReplies
        ? "مفعل ✅"
        : "معطل ❌"
    }`
  );
}

bot.hears(
  /^حالة الحماية$/i,
  async ctx => {
    if (
      !requireRank(
        ctx,
        4
      )
    ) {
      return;
    }

    return replyCommand(
      ctx,
      protectionStatusText(
        ensureGroup(
          ctx.chat.id
        )
      )
    );
  }
);

/* =========================================================
   فتح / قفل الحماية
========================================================= */

bot.hears(
  /^(?:فتح|تفعيل) الحماية$/i,
  async ctx => {
    if (
      !requireRank(
        ctx,
        4
      )
    ) {
      return;
    }

    const group =
      ensureGroup(
        ctx.chat.id
      );

    group.protection.enabled =
      true;

    group.violationsEnabled =
      true;

    saveData();

    return replyCommand(
      ctx,
      "• تم تفعيل الحماية"
    );
  }
);

bot.hears(
  /^(?:غلق|قفل|تعطيل) الحماية$/i,
  async ctx => {
    if (
      !requireRank(
        ctx,
        4
      )
    ) {
      return;
    }

    const group =
      ensureGroup(
        ctx.chat.id
      );

    group.protection.enabled =
      false;

    group.violationsEnabled =
      false;

    saveData();

    return replyCommand(
      ctx,
      "• تم تعطيل الحماية"
    );
  }
);

bot.hears(
  /^تفعيل الحماية التلقائية$/i,
  async ctx => {
    if (
      !requireRank(
        ctx,
        4
      )
    ) {
      return;
    }

    ensureGroup(
      ctx.chat.id
    ).protection.auto =
      true;

    saveData();

    return replyCommand(
      ctx,
      "• تم تفعيل الحماية التلقائية"
    );
  }
);

bot.hears(
  /^تعطيل الحماية التلقائية$/i,
  async ctx => {
    if (
      !requireRank(
        ctx,
        4
      )
    ) {
      return;
    }

    ensureGroup(
      ctx.chat.id
    ).protection.auto =
      false;

    saveData();

    return replyCommand(
      ctx,
      "• تم تعطيل الحماية التلقائية"
    );
  }
);

/* =========================================================
   أوامر الحماية
========================================================= */

const protectionMap = {
  "الروابط":
    "links",

  "التعديل":
    "edit",

  "السبام":
    "spam",

  "التكرار":
    "spam",

  "الاعلانات":
    "ads",

  "الإعلانات":
    "ads",

  "المنشن":
    "mentions",

  "الفوروورد":
    "forwards",

  "الفوروارد":
    "forwards",

  "الصور":
    "photos",

  "الفيديو":
    "videos",

  "الملفات":
    "documents",

  "الملصقات":
    "stickers",

  "GIF":
    "gifs",

  "gif":
    "gifs",

  "الصوتيات":
    "audio",

  "الرسائل الصوتية":
    "voice",

  "جهات الاتصال":
    "contacts",

  "الأوامر":
    "commands",

  "الإنجليزي":
    "english",

  "الردود من القروبات":
    "crossGroupReplies",

  "الردود من القروبات الثانية":
    "crossGroupReplies"
};

bot.hears(
  /^(?:فتح|قفل|تفعيل|تعطيل)\s+(.+)$/i,
  async ctx => {
    const key =
      protectionMap[
        ctx.match[1]
      ];

    if (!key) {
      return;
    }

    if (
      !requireRank(
        ctx,
        4
      )
    ) {
      return;
    }

    const enabled =
      /^(?:فتح|تفعيل)/i.test(
        ctx.message.text
      );

    const group =
      ensureGroup(
        ctx.chat.id
      );

    group.protection[key] =
      enabled;

    saveData();

    return replyCommand(
      ctx,
      `• ${
        enabled
          ? "تم تفعيل"
          : "تم تعطيل"
      } ${ctx.match[1]}`
    );
  }
);

/* =========================================================
   المخالفات والروابط
========================================================= */

bot.hears(
  /^فتح المخالفات$/i,
  async ctx => {
    if (
      !requireRank(
        ctx,
        7
      )
    ) {
      return;
    }

    ensureGroup(
      ctx.chat.id
    ).violationsEnabled =
      true;

    ensureGroup(
      ctx.chat.id
    ).protection.enabled =
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
    if (
      !requireRank(
        ctx,
        7
      )
    ) {
      return;
    }

    ensureGroup(
      ctx.chat.id
    ).violationsEnabled =
      false;

    saveData();

    return replyCommand(
      ctx,
      "• تم غلق المخالفات"
    );
  }
);

bot.hears(
  /^فتح الروابط$/i,
  async ctx => {
    if (
      !requireRank(
        ctx,
        7
      )
    ) {
      return;
    }

    const group =
      ensureGroup(
        ctx.chat.id
      );

    group.linksEnabled =
      true;

    group.protection.links =
      false;

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
    if (
      !requireRank(
        ctx,
        7
      )
    ) {
      return;
    }

    const group =
      ensureGroup(
        ctx.chat.id
      );

    group.linksEnabled =
      false;

    group.protection.links =
      true;

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
  can_send_messages:
    true,

  can_send_audios:
    true,

  can_send_documents:
    true,

  can_send_photos:
    true,

  can_send_videos:
    true,

  can_send_video_notes:
    true,

  can_send_voice_notes:
    true,

  can_send_polls:
    true,

  can_send_other_messages:
    true,

  can_add_web_page_previews:
    true,

  can_invite_users:
    true
};

bot.hears(
  /^فتح القروب$/i,
  async ctx => {
    if (
      !requireRank(
        ctx,
        7
      )
    ) {
      return;
    }

    const group =
      ensureGroup(
        ctx.chat.id
      );

    group.groupOpen =
      true;

    try {
      await ctx.telegram.setChatPermissions(
        ctx.chat.id,
        CHAT_PERMISSIONS_OPEN
      );
    } catch {}

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
    if (
      !requireRank(
        ctx,
        7
      )
    ) {
      return;
    }

    const group =
      ensureGroup(
        ctx.chat.id
      );

    group.groupOpen =
      false;

    try {
      await ctx.telegram.setChatPermissions(
        ctx.chat.id,
        {
          can_send_messages:
            false
        }
      );
    } catch {}

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

function normalizeTrackedType(
  msg
) {
  if (msg.type) {
    return msg.type;
  }

  if (msg.photo) {
    return "photo";
  }

  if (msg.video) {
    return "video";
  }

  if (msg.document) {
    return "document";
  }

  if (msg.sticker) {
    return "sticker";
  }

  if (msg.animation) {
    return "animation";
  }

  if (msg.audio) {
    return "audio";
  }

  if (msg.voice) {
    return "voice";
  }

  if (msg.video_note) {
    return "video_note";
  }

  if (
    msg.text ||
    msg.caption
  ) {
    return "text";
  }

  return "unknown";
}

function matchesCleanType(
  msg,
  type
) {
  const actual =
    normalizeTrackedType(
      msg
    );

  if (
    type === 0
  ) {
    return actual ===
      "text";
  }

  if (
    type === 1
  ) {
    return actual ===
      "photo";
  }

  if (
    type === 2
  ) {
    return actual ===
      "video";
  }

  if (
    type === 3
  ) {
    return actual ===
      "document";
  }

  if (
    type === 4
  ) {
    return actual ===
      "sticker";
  }

  if (
    type === 5
  ) {
    return actual ===
      "animation";
  }

  if (
    type === 6
  ) {
    return actual ===
      "audio";
  }

  if (
    type === 7
  ) {
    return actual ===
      "voice";
  }

  if (
    type === 8
  ) {
    return (
      msg.hasLink ===
        true ||
      /(https?:\/\/|www\.|t\.me\/)/i.test(
        `${msg.text || ""} ${
          msg.caption || ""
        }`
      )
    );
  }

  if (
    type === 9
  ) {
    return [
      "photo",
      "video",
      "document",
      "sticker",
      "animation",
      "audio",
      "voice",
      "video_note"
    ].includes(
      actual
    );
  }

  return false;
}

async function cleanMessages(
  ctx,
  type
) {
  if (
    !requireRank(
      ctx,
      4
    )
  ) {
    return;
  }

  const group =
    ensureGroup(
      ctx.chat.id
    );

  const currentMessageId =
    ctx.message?.message_id;

  const messages =
    Array.isArray(
      group.trackedMessages
    )
      ? group.trackedMessages
      : [];

  const selected = [];

  for (
    const msg of messages
  ) {
    if (
      Number(
        msg.chatId
      ) !==
      Number(
        ctx.chat.id
      )
    ) {
      continue;
    }

    if (
      Number(
        msg.messageId
      ) ===
      Number(
        currentMessageId
      )
    ) {
      continue;
    }

    if (
      matchesCleanType(
        msg,
        type
      )
    ) {
      selected.push(
        Number(
          msg.messageId
        )
      );
    }
  }

  const unique =
    [
      ...new Set(
        selected
      )
    ]
      .sort(
        (a, b) =>
          a - b
      )
      .slice(
        -100
      );

  if (!unique.length) {
    return replyCommand(
      ctx,
      "• لا توجد رسائل مطابقة"
    );
  }

  let deleted =
    0;

  const failed = [];

  for (
    const messageId of unique
  ) {
    try {
      await ctx.telegram.deleteMessage(
        ctx.chat.id,
        messageId
      );

      deleted++;
    } catch {
      failed.push(
        messageId
      );
    }
  }

  const failedSet =
    new Set(
      failed
    );

  group.trackedMessages =
    messages.filter(
      msg =>
        !(
          Number(
            msg.chatId
          ) ===
            Number(
              ctx.chat.id
            ) &&
          unique.includes(
            Number(
              msg.messageId
            )
          ) &&
          !failedSet.has(
            Number(
              msg.messageId
            )
          )
        )
    );

  saveData();

  return replyCommand(
    ctx,
    `• بواسطة ${mention(
      ctx.from
    )}\n• مسحت ( ${deleted} )`
  );
}

for (
  let i = 0;
  i <= 9;
  i++
) {
  bot.hears(
    new RegExp(
      `^${i}$`
    ),
    async ctx =>
      cleanMessages(
        ctx,
        i
      )
  );
}

/* =========================================================
   التنظيف التلقائي
========================================================= */

bot.hears(
  /^تفعيل التنظيف التلقائي$/i,
  async ctx => {
    if (
      !requireRank(
        ctx,
        4
      )
    ) {
      return;
    }

    ensureGroup(
      ctx.chat.id
    ).autoClean =
      true;

    saveData();

    return replyCommand(
      ctx,
      "• تم تفعيل التنظيف التلقائي\n• يتم تنظيف الملصقات كل دقيقتين"
    );
  }
);

bot.hears(
  /^تعطيل التنظيف التلقائي$/i,
  async ctx => {
    if (
      !requireRank(
        ctx,
        4
      )
    ) {
      return;
    }

    ensureGroup(
      ctx.chat.id
    ).autoClean =
      false;

    saveData();

    return replyCommand(
      ctx,
      "• تم تعطيل التنظيف التلقائي"
    );
  }
);

/* تنظيف الملصقات كل دقيقتين */

setInterval(
  async () => {
    for (
      const [
        chatId,
        group
      ]
      of Object.entries(
        data.groups
      )
    ) {
      if (
        !group.autoClean
      ) {
        continue;
      }

      const messages =
        Array.isArray(
          group.trackedMessages
        )
          ? group.trackedMessages
          : [];

      const stickers =
        messages
          .filter(
            msg =>
              normalizeTrackedType(
                msg
              ) ===
              "sticker"
          )
          .slice(
            -100
          );

      for (
        const msg of stickers
      ) {
        try {
          await bot.telegram.deleteMessage(
            chatId,
            msg.messageId
          );

          group.trackedMessages =
            group.trackedMessages.filter(
              item =>
                Number(
                  item.messageId
                ) !==
                Number(
                  msg.messageId
                )
            );
        } catch {}
      }
    }

    saveData();
  },
  120000
);

/* =========================================================
   المنشن
========================================================= */

bot.hears(
  /^@all$/i,
  async ctx => {
    const group =
      ensureGroup(
        ctx.chat.id
      );

    if (
      !group.mentionEnabled
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

    let current =
      "";

    const messages = [];

    for (
      const user of users
    ) {
      const line =
        mention(user) +
        " ";

      if (
        current.length +
          line.length >
        3500
      ) {
        messages.push(
          current
        );

        current =
          "";
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
          parse_mode:
            "HTML",

          disable_web_page_preview:
            true,

          reply_parameters:
            ctx.message
              ?.message_id
              ? {
                  message_id:
                    ctx.message
                      .message_id
                }
              : undefined
        }
      );
    }
  }
);

bot.hears(
  /^فتح المنشن$/i,
  async ctx => {
    if (
      !requireRank(
        ctx,
        7
      )
    ) {
      return;
    }

    ensureGroup(
      ctx.chat.id
    ).mentionEnabled =
      true;

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
    if (
      !requireRank(
        ctx,
        7
      )
    ) {
      return;
    }

    ensureGroup(
      ctx.chat.id
    ).mentionEnabled =
      false;

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
    if (
      !requireRank(
        ctx,
        6
      )
    ) {
      return;
    }

    const word =
      ctx.match[1]
        ?.trim();

    if (!word) {
      return replyCommand(
        ctx,
        "• اكتب الكلمة"
      );
    }

    const group =
      ensureGroup(
        ctx.chat.id
      );

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
    if (
      !requireRank(
        ctx,
        6
      )
    ) {
      return;
    }

    const word =
      ctx.match[1]
        ?.trim();

    if (!word) {
      return replyCommand(
        ctx,
        "• اكتب الكلمة"
      );
    }

    const group =
      ensureGroup(
        ctx.chat.id
      );

    group.forbiddenWords =
      group.forbiddenWords.filter(
        x =>
          x !==
          word
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
    if (
      !requireRank(
        ctx,
        6
      )
    ) {
      return;
    }

    const group =
      ensureGroup(
        ctx.chat.id
      );

    if (
      !group.forbiddenWords
        .length
    ) {
      return replyCommand(
        ctx,
        "• لا يوجد كلمات ممنوعه"
      );
    }

    return replyCommand(
      ctx,
      "• الكلمات الممنوعه\n━━━━━━━━━━━\n" +
      group.forbiddenWords
        .map(
          (
            x,
            i
          ) =>
            `${i + 1}. ${escapeHtml(
              x
            )}`
        )
        .join(
          "\n"
        )
    );
  }
);

bot.hears(
  /^مسح الكلمات الممنوعه$/i,
  async ctx => {
    if (
      !requireRank(
        ctx,
        6
      )
    ) {
      return;
    }

    ensureGroup(
      ctx.chat.id
    ).forbiddenWords =
      [];

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
    if (
      !requireRank(
        ctx,
        7
      )
    ) {
      return;
    }

    const target =
      await getRepliedUser(
        ctx
      );

    if (!target) {
      return replyCommand(
        ctx,
        "• لازم ترد على المستخدم"
      );
    }

    const title =
      ctx.match[1]
        ?.trim();

    if (!title) {
      return replyCommand(
        ctx,
        "• اكتب اللقب"
      );
    }

    ensureUser(
      target.id
    ).title =
      title;

    saveData();

    return replyCommand(
      ctx,
      `• المستخدم ذا ↤︎ ${mention(
        target
      )}\n• تم وضع اللقب`
    );
  }
);

bot.hears(
  /^
