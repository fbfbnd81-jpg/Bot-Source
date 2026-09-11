cd /app
cat > index.cjs <<'EOF'
const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN غير موجود في متغيرات البيئة");
}

const bot = new Telegraf(BOT_TOKEN);

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "database.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

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

const DEV_USERNAME = "j4xa7";

const DEFAULT_DB = {
  users: {},
  chats: {},
  globalRoles: {},
  subscribers: [],
  settings: {
    enabled: true,
    replies: true,
    bank: true,
    communication: true,
    forcedSubscription: false,
    serviceBot: true,
    statistics: true,
    zajal: true,
    formats: true
  }
};

function loadDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(
        DB_FILE,
        JSON.stringify(DEFAULT_DB, null, 2)
      );
      return JSON.parse(JSON.stringify(DEFAULT_DB));
    }

    const data = JSON.parse(
      fs.readFileSync(DB_FILE, "utf8")
    );

    for (const key of Object.keys(DEFAULT_DB)) {
      if (data[key] === undefined) {
        data[key] = JSON.parse(
          JSON.stringify(DEFAULT_DB[key])
        );
      }
    }

    return data;
  } catch (e) {
    console.error(e);
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

let db = loadDB();

function saveDB() {
  try {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(db, null, 2)
    );
  } catch (e) {
    console.error("SAVE ERROR:", e.message);
  }
}

function ensureUser(user) {
  const uid = String(user.id);

  if (!db.users[uid]) {
    db.users[uid] = {
      id: user.id,
      username: user.username || "",
      firstName: user.first_name || "",
      balance: 0,
      title: "",
      stats: {
        messages: 0,
        wins: 0,
        correct: 0,
        bestSpeed: null
      },
      bank: {
        active: false,
        name: "",
        account: ""
      }
    };
  }

  db.users[uid].username =
    user.username || db.users[uid].username;

  db.users[uid].firstName =
    user.first_name || db.users[uid].firstName;

  return db.users[uid];
}

function ensureChat(chat) {
  const cid = String(chat.id);

  if (!db.chats[cid]) {
    db.chats[cid] = {
      id: chat.id,
      title: chat.title || "",
      roles: {},
      stats: {},
      muted: {},
      globalMuted: {},
      warnings: {},
      forbiddenWords: [],
      customCommands: {},
      customReplies: {},
      channels: {},
      log: [],
      settings: {
        protection: true,
        violations: true,
        autoProtection: true,
        links: true,
        edits: true,
        repetition: true,
        ads: true,
        mentions: true,
        forwards: true,
        warnings: true,
        autoMute: true,
        autoBan: false,
        english: false,
        longMessages: true,
        phoneNumbers: true,
        channelIds: true,
        botProtection: true,
        newAccounts: true,
        suspiciousAccounts: true,
        chatLock: false,
        mediaLock: false,
        photos: false,
        videos: false,
        files: false,
        stickers: false,
        gifs: false,
        audios: false,
        voices: false,
        forwardsLock: false,
        mentionsLock: false,
        games: true,
        allMention: true
      },
      games: {
        locked: false,
        active: null
      },
      marriages: {},
      bankNames: [
        "الراجحي",
        "الأهلي",
        "البنك الثالث"
      ],
      laws: ""
    };
  }

  return db.chats[cid];
}

function isGroup(ctx) {
  return !!(
    ctx.chat &&
    (
      ctx.chat.type === "group" ||
      ctx.chat.type === "supergroup"
    )
  );
}

function escapeHTML(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mention(user) {
  if (!user) return "العضو";

  const name = escapeHTML(
    user.first_name ||
    user.username ||
    "العضو"
  );

  return `<a href="tg://user?id=${user.id}">${name}</a>`;
}

function getReplyTarget(ctx) {
  if (
    !ctx.message ||
    !ctx.message.reply_to_message ||
    !ctx.message.reply_to_message.from
  ) {
    return null;
  }

  return ctx.message.reply_to_message.from;
}

function getRank(ctx, userId) {
  const uid = String(userId);
  const user = db.users[uid];

  if (
    user &&
    String(user.username || "").toLowerCase() ===
      DEV_USERNAME.toLowerCase()
  ) {
    return "Dev🎖️";
  }

  if (db.globalRoles[uid]) {
    return db.globalRoles[uid];
  }

  if (isGroup(ctx)) {
    const chat = ensureChat(ctx.chat);
    return chat.roles[uid] || "عضو";
  }

  return "عضو";
}

function getLevel(ctx, userId) {
  return RANKS[getRank(ctx, userId)] ?? 0;
}

function rankFromLevel(level) {
  for (const [name, value] of Object.entries(RANKS)) {
    if (value === level) return name;
  }

  return "عضو";
}

function reply(ctx, text, extra = {}) {
  return ctx.reply(text, {
    parse_mode: "HTML",
    ...extra
  });
}

function requireRank(ctx, level) {
  if (getLevel(ctx, ctx.from.id) < level) {
    reply(
      ctx,
      `• هذا الامر يخص ↤ ｢ ${escapeHTML(
        rankFromLevel(level)
      )} ｣`
    );

    return false;
  }

  return true;
}

function requireOwner(ctx) {
  if (getLevel(ctx, ctx.from.id) < 2) {
    reply(
      ctx,
      "• ماتقدر تستخدم الامر على ↤ ｢ لازم تكون الرتبه مالك وفوق ｣"
    );

    return false;
  }

  return true;
}

function checkTarget(ctx, target) {
  if (!target) {
    return {
      ok: false,
      message: "• لازم تستخدم الامر بالرد على العضو"
    };
  }

  const actor = getLevel(ctx, ctx.from.id);
  const targetLevel = getLevel(ctx, target.id);

  if (target.id === ctx.from.id) {
    return {
      ok: false,
      message: "• ما تقدر تستخدم الامر على نفسك"
    };
  }

  if (targetLevel >= actor) {
    return {
      ok: false,
      message:
        "• لا يمكن تنزيل رتبه نفس رتبتك ولا اعلى من رتبتك"
    };
  }

  return { ok: true };
}

function logAction(ctx, action) {
  if (!isGroup(ctx)) return;

  const chat = ensureChat(ctx.chat);

  chat.log.push({
    time: Date.now(),
    user: ctx.from.id,
    action
  });

  if (chat.log.length > 500) {
    chat.log.shift();
  }

  saveDB();
}

async function punish(ctx, target, action) {
  return reply(
    ctx,
    `• المستخدم ذا ↤︎「${mention(target)}」\n• ${action}`
  );
}

async function promoteMessage(ctx, target) {
  return reply(
    ctx,
    `• المستخدم ذا ↤︎「${mention(target)}」\n• تم رفعه الرتبه`
  );
}

/* =========================================================
   START
========================================================= */

bot.start(async ctx => {
  ensureUser(ctx.from);

  if (
    !db.subscribers.includes(ctx.from.id)
  ) {
    db.subscribers.push(ctx.from.id);
  }

  saveDB();

  const me = await bot.telegram.getMe();

  const addURL =
    `https://t.me/${me.username}?startgroup=true`;

  return reply(
    ctx,
    `أهلا بك يا قلبي - ${mention(ctx.from)}

• انا اشغل لك اللي تبي بالمكالمه

ادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.`,
    {
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            "أضفني في مجموعتك",
            addURL
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
   BASIC TEST
========================================================= */

bot.hears(/^اختبار$/i, ctx => {
  return reply(ctx, "• البوت يعمل");
});

/* =========================================================
   RANKS
========================================================= */

bot.hears(/^رتبتي$/i, ctx => {
  if (!isGroup(ctx)) return;

  return reply(
    ctx,
    `• رتبتك ↤︎ ${escapeHTML(
      getRank(ctx, ctx.from.id)
    )}`
  );
});

bot.hears(/^رتبته$/i, ctx => {
  if (!isGroup(ctx)) return;

  const target = getReplyTarget(ctx);

  if (!target) {
    return reply(
      ctx,
      "• لازم تستخدم الامر بالرد على العضو"
    );
  }

  return reply(
    ctx,
    `• رتبة ${mention(target)} ↤︎ ${escapeHTML(
      getRank(ctx, target.id)
    )}`
  );
});

/* =========================================================
   INTERACTION
========================================================= */

bot.hears(/^تفاعلي$/i, ctx => {
  if (!isGroup(ctx)) return;

  const chat = ensureChat(ctx.chat);
  const uid = String(ctx.from.id);

  const count =
    Number(chat.stats[uid] || 0);

  const sorted =
    Object.entries(chat.stats)
      .sort((a, b) => b[1] - a[1]);

  const position =
    sorted.findIndex(
      item => item[0] === uid
    ) + 1;

  return reply(
    ctx,
    `• رتبتك ↤︎ ${escapeHTML(
      getRank(ctx, ctx.from.id)
    )}
• عدد رسائل التفاعل ↤︎ ${count}
• ترتيبك بين المتفاعلين ↤︎ ${
      position || "-"
    }`
  );
});

bot.hears(/^المتفاعلين$/i, async ctx => {
  if (!isGroup(ctx)) return;

  const chat = ensureChat(ctx.chat);

  const list =
    Object.entries(chat.stats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

  if (!list.length) {
    return reply(
      ctx,
      "• لا يوجد متفاعلين"
    );
  }

  const result = [];

  for (let i = 0; i < list.length; i++) {
    const [uid, count] = list[i];

    let user;

    try {
      const member =
        await ctx.telegram.getChatMember(
          ctx.chat.id,
          Number(uid)
        );

      user = member.user;
    } catch {}

    result.push(
      `${i + 1} - ${
        user ? mention(user) : uid
      }\n• عدد الرسائل ↤︎ ${count}`
    );
  }

  return reply(
    ctx,
    `• المتفاعلين\n\n${result.join("\n\n")}`
  );
});

bot.hears(/^تفاعله$/i, ctx => {
  if (!isGroup(ctx)) return;

  const target = getReplyTarget(ctx);

  if (!target) {
    return reply(
      ctx,
      "• لازم تستخدم الامر بالرد على العضو"
    );
  }

  const chat = ensureChat(ctx.chat);
  const uid = String(target.id);

  const count =
    Number(chat.stats[uid] || 0);

  const sorted =
    Object.entries(chat.stats)
      .sort((a, b) => b[1] - a[1]);

  const position =
    sorted.findIndex(
      item => item[0] === uid
    ) + 1;

  return reply(
    ctx,
    `• المستخدم ↤︎ ${mention(target)}
• عدد رسائل التفاعل ↤︎ ${count}
• ترتيبه بين المتفاعلين ↤︎ ${
      position || "-"
    }`
  );
});

/* =========================================================
   MUTE
========================================================= */

bot.hears(/^كتم$/i, async ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 4)) return;

  const target = getReplyTarget(ctx);
  const check = checkTarget(ctx, target);

  if (!check.ok) {
    return reply(ctx, check.message);
  }

  try {
    await ctx.telegram.restrictChatMember(
      ctx.chat.id,
      target.id,
      {
        permissions: {
          can_send_messages: false
        }
      }
    );

    const chat = ensureChat(ctx.chat);

    chat.muted[String(target.id)] = {
      time: Date.now()
    };

    saveDB();
    logAction(ctx, `كتم ${target.id}`);

    return punish(ctx, target, "كتمته");
  } catch {
    return reply(
      ctx,
      "• تعذر تنفيذ الأمر، تأكد من صلاحيات البوت"
    );
  }
});

bot.hears(/^فك كتم$/i, async ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 4)) return;

  const target = getReplyTarget(ctx);

  if (!target) {
    return reply(
      ctx,
      "• لازم تستخدم الامر بالرد على العضو"
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

    delete ensureChat(ctx.chat).muted[
      String(target.id)
    ];

    saveDB();

    return punish(
      ctx,
      target,
      "فكيت كتمه"
    );
  } catch {
    return reply(
      ctx,
      "• تعذر فك الكتم"
    );
  }
});

/* =========================================================
   GLOBAL MUTE
========================================================= */

bot.hears(/^كتم عام$/i, async ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 5)) return;

  const target = getReplyTarget(ctx);
  const check = checkTarget(ctx, target);

  if (!check.ok) {
    return reply(ctx, check.message);
  }

  try {
    await ctx.telegram.restrictChatMember(
      ctx.chat.id,
      target.id,
      {
        permissions: {
          can_send_messages: false
        }
      }
    );

    ensureChat(ctx.chat)
      .globalMuted[String(target.id)] = true;

    saveDB();

    return punish(
      ctx,
      target,
      "كتمته عام"
    );
  } catch {
    return reply(
      ctx,
      "• تعذر تنفيذ الكتم العام"
    );
  }
});

bot.hears(/^فك الكتم العام$/i, async ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 5)) return;

  const target = getReplyTarget(ctx);

  if (!target) {
    return reply(
      ctx,
      "• لازم تستخدم الامر بالرد على العضو"
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

    delete ensureChat(ctx.chat)
      .globalMuted[String(target.id)];

    saveDB();

    return punish(
      ctx,
      target,
      "فكيت الكتم العام عنه"
    );
  } catch {
    return reply(
      ctx,
      "• تعذر فك الكتم العام"
    );
  }
});

/* =========================================================
   مم / خخ
========================================================= */

bot.hears(/^مم$/i, async ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 4)) return;

  const chat = ensureChat(ctx.chat);

  const ids =
    Object.keys(chat.muted);

  if (!ids.length) {
    return reply(
      ctx,
      "• لا يوجد مكتومين"
    );
  }

  const lines = [];

  for (const uid of ids) {
    try {
      const member =
        await ctx.telegram.getChatMember(
          ctx.chat.id,
          Number(uid)
        );

      lines.push(
        `• ${mention(member.user)}`
      );
    } catch {
      lines.push(`• ${uid}`);
    }
  }

  return reply(
    ctx,
    `• المكتومين:\n\n${lines.join("\n")}`
  );
});

bot.hears(/^خخ$/i, async ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 5)) return;

  const chat = ensureChat(ctx.chat);

  const ids =
    Object.keys(chat.globalMuted);

  if (!ids.length) {
    return reply(
      ctx,
      "• لا يوجد مكتومين عام"
    );
  }

  const lines = [];

  for (const uid of ids) {
    try {
      const member =
        await ctx.telegram.getChatMember(
          ctx.chat.id,
          Number(uid)
        );

      lines.push(
        `• ${mention(member.user)}`
      );
    } catch {
      lines.push(`• ${uid}`);
    }
  }

  return reply(
    ctx,
    `• المكتومين عام:\n\n${lines.join("\n")}`
  );
});

/* =========================================================
   BAN
========================================================= */

bot.hears(/^حظر$/i, async ctx => {
  if (!isGroup(ctx)) return;

  if (!requireOwner(ctx)) return;

  const target = getReplyTarget(ctx);
  const check = checkTarget(ctx, target);

  if (!check.ok) {
    return reply(ctx, check.message);
  }

  try {
    await ctx.telegram.banChatMember(
      ctx.chat.id,
      target.id
    );

    logAction(
      ctx,
      `حظر ${target.id}`
    );

    return punish(
      ctx,
      target,
      "حظرته"
    );
  } catch {
    return reply(
      ctx,
      "• تعذر تنفيذ الحظر"
    );
  }
});

bot.hears(/^فك الحظر$/i, async ctx => {
  if (!isGroup(ctx)) return;

  if (!requireOwner(ctx)) return;

  const target = getReplyTarget(ctx);

  if (!target) {
    return reply(
      ctx,
      "• لازم تستخدم الامر بالرد على العضو"
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

    return punish(
      ctx,
      target,
      "فكيت الحظر عنه"
    );
  } catch {
    return reply(
      ctx,
      "• تعذر فك الحظر"
    );
  }
});

/* =========================================================
   KICK
========================================================= */

bot.hears(/^طرد$/i, async ctx => {
  if (!isGroup(ctx)) return;

  if (!requireOwner(ctx)) return;

  const target = getReplyTarget(ctx);
  const check = checkTarget(ctx, target);

  if (!check.ok) {
    return reply(ctx, check.message);
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

    return punish(
      ctx,
      target,
      "طردته"
    );
  } catch {
    return reply(
      ctx,
      "• تعذر تنفيذ الطرد"
    );
  }
});

/* =========================================================
   RESTRICT
========================================================= */

bot.hears(/^تقييد$/i, async ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 6)) return;

  const target = getReplyTarget(ctx);
  const check = checkTarget(ctx, target);

  if (!check.ok) {
    return reply(ctx, check.message);
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

    return punish(
      ctx,
      target,
      "قيدته"
    );
  } catch {
    return reply(
      ctx,
      "• تعذر تنفيذ التقييد"
    );
  }
});

bot.hears(/^الغاء التقييد$/i, async ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 3)) return;

  const target = getReplyTarget(ctx);

  if (!target) {
    return reply(
      ctx,
      "• لازم تستخدم الامر بالرد على العضو"
    );
  }

  if (
    getLevel(ctx, target.id) >=
    getLevel(ctx, ctx.from.id)
  ) {
    return reply(
      ctx,
      "• لا يمكن تنزيل رتبه نفس رتبتك ولا اعلى من رتبتك"
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

    return punish(
      ctx,
      target,
      "الغيت تقييده"
    );
  } catch {
    return reply(
      ctx,
      "• تعذر إلغاء التقييد"
    );
  }
});

/* =========================================================
   WARNINGS
========================================================= */

bot.hears(/^تحذير$/i, async ctx => {
  if (!isGroup(ctx)) return;

  if (!requireOwner(ctx)) return;

  const target = getReplyTarget(ctx);
  const check = checkTarget(ctx, target);

  if (!check.ok) {
    return reply(ctx, check.message);
  }

  const chat = ensureChat(ctx.chat);
  const uid = String(target.id);

  chat.warnings[uid] =
    Number(chat.warnings[uid] || 0) + 1;

  const count = chat.warnings[uid];

  saveDB();

  if (
    count >= 3 &&
    chat.settings.autoMute
  ) {
    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        target.id,
        {
          permissions: {
            can_send_messages: false
          }
        }
      );

      chat.muted[uid] = {
        time: Date.now()
      };
    } catch {}
  }

  return punish(
    ctx,
    target,
    `حذرته\n• عدد الإنذارات ↤︎ ${count}`
  );
});

bot.hears(/^الغاء التحذير$/i, async ctx => {
  if (!isGroup(ctx)) return;

  if (!requireOwner(ctx)) return;

  const target = getReplyTarget(ctx);

  if (!target) {
    return reply(
      ctx,
      "• لازم تستخدم الامر بالرد على العضو"
    );
  }

  delete ensureChat(ctx.chat)
    .warnings[String(target.id)];

  saveDB();

  return punish(
    ctx,
    target,
    "الغيت تحذيره"
  );
});

/* =========================================================
   VIOLATIONS
========================================================= */

bot.hears(/^فتح المخالفات$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 7)) return;

  ensureChat(ctx.chat)
    .settings.violations = true;

  saveDB();

  return reply(
    ctx,
    "• تم فتح المخالفات"
  );
});

bot.hears(/^غلق المخالفات$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 7)) return;

  ensureChat(ctx.chat)
    .settings.violations = false;

  saveDB();

  return reply(
    ctx,
    "• تم غلق المخالفات"
  );
});

bot.hears(/^تفعيل الحماية$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 2)) return;

  ensureChat(ctx.chat)
    .settings.protection = true;

  saveDB();

  return reply(
    ctx,
    "• تم تفعيل الحماية"
  );
});

bot.hears(/^تعطيل الحماية$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 2)) return;

  ensureChat(ctx.chat)
    .settings.protection = false;

  saveDB();

  return reply(
    ctx,
    "• تم تعطيل الحماية"
  );
});

bot.hears(/^حالة الحماية$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 2)) return;

  const chat = ensureChat(ctx.chat);

  return reply(
    ctx,
    `• حالة الحماية ↤︎ ${
      chat.settings.protection
        ? "مفعلة"
        : "معطلة"
    }
• حالة المخالفات ↤︎ ${
      chat.settings.violations
        ? "مفعلة"
        : "معطلة"
    }`
  );
});

const protectionSwitches = [
  ["تفعيل منع الروابط", "links", true],
  ["تعطيل منع الروابط", "links", false],
  ["تفعيل منع التعديل", "edits", true],
  ["تعطيل منع التعديل", "edits", false],
  ["تفعيل منع التكرار", "repetition", true],
  ["تعطيل منع التكرار", "repetition", false],
  ["تفعيل منع الإعلانات", "ads", true],
  ["تعطيل منع الإعلانات", "ads", false],
  ["تفعيل منع المنشن", "mentions", true],
  ["تعطيل منع المنشن", "mentions", false],
  ["تفعيل منع الفوروارد", "forwards", true],
  ["تعطيل منع الفوروارد", "forwards", false]
];

for (const [text, key, value] of protectionSwitches) {
  bot.hears(new RegExp(`^${text}$`, "i"), ctx => {
    if (!isGroup(ctx)) return;
    if (!requireRank(ctx, 2)) return;

    const chat = ensureChat(ctx.chat);

    const map = {
      links: "links",
      edits: "edits",
      repetition: "repetition",
      ads: "ads",
      mentions: "mentions",
      forwards: "forwards"
    };

    chat.settings[map[key]] = value;

    saveDB();

    return reply(
      ctx,
      `• تم ${value ? "تفعيل" : "تعطيل"} ${escapeHTML(text.replace(/^تفعيل |^تعطيل /, ""))}`
    );
  });
}

/* =========================================================
   CLEANING
========================================================= */

async function cleanMessages(ctx, type) {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 4)) return;

  const chatId = ctx.chat.id;

  const messages = [];

  for (let i = 1; i <= 100; i++) {
    messages.push(ctx.message.message_id - i);
  }

  let deleted = 0;

  for (const messageId of messages) {
    try {
      await ctx.telegram.deleteMessage(
        chatId,
        messageId
      );

      deleted++;
    } catch {}
  }

  const names = {
    0: "الرسائل النصية",
    1: "الصور",
    2: "الفيديوهات",
    3: "الملفات",
    4: "الملصقات",
    5: "القيفات",
    6: "الصوتيات",
    7: "الفويسات",
    8: "الرسائل التي تحتوي على روابط",
    9: "الوسائط"
  };

  if (deleted === 0) {
    if (type === 1) {
      return reply(
        ctx,
        `• من ${mention(ctx.from)}\n• لا يوجد صور في القروب`
      );
    }

    if (type === 7) {
      return reply(
        ctx,
        `• من ${mention(ctx.from)}\n• لا يوجد فويسات في القروب`
      );
    }

    if (type === 6) {
      return reply(
        ctx,
        `• من ${mention(ctx.from)}\n• لا يوجد صوتيات في القروب`
      );
    }

    if (type === 5) {
      return reply(
        ctx,
        `• من ${mention(ctx.from)}\n• لا يوجد قيفات في القروب`
      );
    }

    if (type === 4) {
      return reply(
        ctx,
        `• بواسطة ${mention(ctx.from)}\n• مسحت ( 0 ) من الملصقات`
      );
    }

    return reply(
      ctx,
      `• لم يتم العثور على ${names[type]}`
    );
  }

  if (type === 4) {
    return reply(
      ctx,
      `• بواسطة ${mention(ctx.from)}\n• مسحت ( ${deleted} ) من الملصقات`
    );
  }

  return reply(
    ctx,
    `• مسحت ${deleted} من ${names[type]}`
  );
}

for (let i = 0; i <= 9; i++) {
  bot.hears(
    new RegExp(`^تنظيف ${i}$`, "i"),
    ctx => cleanMessages(ctx, i)
  );
}

bot.hears(/^تنظيف$/i, ctx => {
  return cleanMessages(ctx, 9);
});

/* =========================================================
   RANK MANAGEMENT
========================================================= */

const rankCommands = [
  [/^(?:رفع مميز)$/i, "مميز", 3],
  [/^(?:رفع مالك)$/i, "مالك", 3],
  [/^(?:رفع اساس|رفع مالك اساسي)$/i, "مالك أساسي", 4],
  [/^(?:رفع M|رفع myth)$/i, "Myth", 5],
  [/^(?:رفع My|رفع اكس)$/i, "Myth 🎖️", 6],
  [/^(?:رفع ديف|رفع Dev²)$/i, "Dev²🎖️", 7]
];

for (const [regex, rank, required] of rankCommands) {
  bot.hears(regex, ctx => {
    if (!isGroup(ctx)) return;

    if (!requireRank(ctx, required)) {
      return;
    }

    const target = getReplyTarget(ctx);
    const check = checkTarget(ctx, target);

    if (!check.ok) {
      return reply(ctx, check.message);
    }

    const targetLevel = RANKS[rank];
    const actorLevel = getLevel(
      ctx,
      ctx.from.id
    );

    if (targetLevel >= actorLevel) {
      return reply(
        ctx,
        "• لا يمكن تنزيل رتبه نفس رتبتك ولا اعلى من رتبتك"
      );
    }

    ensureChat(ctx.chat)
      .roles[String(target.id)] = rank;

    saveDB();

    return promoteMessage(
      ctx,
      target
    );
  });
}

bot.hears(/^تنزيل$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 2)) return;

  const target = getReplyTarget(ctx);
  const check = checkTarget(ctx, target);

  if (!check.ok) {
    return reply(ctx, check.message);
  }

  delete ensureChat(ctx.chat)
    .roles[String(target.id)];

  saveDB();

  return reply(
    ctx,
    `• المستخدم ذا ↤︎「${mention(target)}」\n• تم تنزيله الرتبه`
  );
});

/* =========================================================
   ADD INTERACTION
========================================================= */

bot.hears(/^اضف تفاعل(?:\s+(\d+))?$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 7)) return;

  const target = getReplyTarget(ctx);

  if (!target) {
    return reply(
      ctx,
      "• لازم تستخدم الامر بالرد على العضو"
    );
  }

  const match =
    ctx.message.text.match(
      /^اضف تفاعل\s+(\d+)$/i
    );

  if (!match) {
    return reply(
      ctx,
      "• اكتب العدد بعد الأمر"
    );
  }

  const amount =
    Number(match[1]);

  const chat = ensureChat(ctx.chat);
  const uid = String(target.id);

  chat.stats[uid] =
    Number(chat.stats[uid] || 0) + amount;

  saveDB();

  return reply(
    ctx,
    `• المستخدم ذا ↤︎「${mention(target)}」\n• تم إضافة ${amount} تفاعل`
  );
});

/* =========================================================
   BANK
========================================================= */

bot.hears(/^فلوسي$/i, ctx => {
  const user = ensureUser(ctx.from);

  return reply(
    ctx,
    `• فلوسك: ${user.balance} ريال`
  );
});

bot.hears(/^فلوسه$/i, ctx => {
  if (!isGroup(ctx)) return;

  const target = getReplyTarget(ctx);

  if (!target) {
    return reply(
      ctx,
      "• لازم تستخدم الامر بالرد على العضو"
    );
  }

  const user =
    ensureUser(target);

  return reply(
    ctx,
    `• فلوس ${mention(target)}: ${user.balance} ريال`
  );
});

bot.hears(/^اهداء(?:\s+(\d+))?$/i, ctx => {
  if (!isGroup(ctx)) return;

  const target = getReplyTarget(ctx);

  if (!target) {
    return reply(
      ctx,
      "• لازم تستخدم الامر بالرد على العضو"
    );
  }

  const match =
    ctx.message.text.match(
      /^اهداء\s+(\d+)$/i
    );

  if (!match) {
    return reply(
      ctx,
      "• اكتب المبلغ"
    );
  }

  const amount =
    Number(match[1]);

  const sender =
    ensureUser(ctx.from);

  const receiver =
    ensureUser(target);

  if (sender.balance < amount) {
    return reply(
      ctx,
      "• رصيدك لا يكفي لإتمام العملية."
    );
  }

  sender.balance -= amount;
  receiver.balance += amount;

  saveDB();

  return reply(
    ctx,
    `• تم إهداء ${amount} ريال إلى ${mention(target)}`
  );
});

bot.hears(/^المتجر$/i, ctx => {
  return reply(
    ctx,
    `• المتجر

لا توجد منتجات مضافة حاليًا`
  );
});

bot.hears(/^حسابي$/i, ctx => {
  const user = ensureUser(ctx.from);

  if (!user.bank.active) {
    return reply(
      ctx,
      "• لا يوجد لديك حساب بنكي"
    );
  }

  return reply(
    ctx,
    `• اسم البنك: ${escapeHTML(user.bank.name)}
• رقم الحساب: ${escapeHTML(user.bank.account)}
• الرصيد: ${user.balance} ريال`
  );
});

bot.hears(/^انشاء حساب بنكي$/i, ctx => {
  const user = ensureUser(ctx.from);

  if (user.bank.active) {
    return reply(
      ctx,
      "• لديك حساب بنكي بالفعل"
    );
  }

  const buttons =
    DEFAULT_DB
      ? [
          ["الراجحي"],
          ["الأهلي"],
          ["البنك الثالث"]
        ]
      : [];

  return reply(
    ctx,
    "• اختر البنك",
    Markup.inlineKeyboard(
      buttons.map(item =>
        [Markup.button.callback(
          item[0],
          `bank:${item[0]}`
        )]
      )
    )
  );
});

bot.action(/^bank:(.+)$/i, async ctx => {
  const bank =
    ctx.match[1];

  const user =
    ensureUser(ctx.from);

  if (user.bank.active) {
    return ctx.answerCbQuery(
      "لديك حساب بنكي"
    );
  }

  const account =
    String(Date.now()).slice(-10);

  user.bank = {
    active: true,
    name: bank,
    account
  };

  saveDB();

  await ctx.answerCbQuery(
    "تم إنشاء الحساب"
  );

  return ctx.editMessageText(
    `• تم إنشاء الحساب البنكي\n• اسم البنك: ${escapeHTML(bank)}\n• رقم الحساب: ${account}`,
    {
      parse_mode: "HTML"
    }
  );
});

bot.hears(/^حذف حسابي$/i, ctx => {
  const user = ensureUser(ctx.from);

  user.bank = {
    active: false,
    name: "",
    account: ""
  };

  saveDB();

  return reply(
    ctx,
    "• تم حذف الحساب البنكي\n• الرصيد محفوظ"
  );
});

/* =========================================================
   FORBIDDEN WORDS
========================================================= */

bot.hears(/^منع الكلمه (.+)$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 6)) return;

  const word =
    ctx.match[1].trim();

  const chat =
    ensureChat(ctx.chat);

  if (
    !chat.forbiddenWords.includes(word)
  ) {
    chat.forbiddenWords.push(word);
  }

  saveDB();

  return reply(
    ctx,
    "• تم إضافة الكلمة الممنوعة"
  );
});

bot.hears(/^الغاء منع الكلمه (.+)$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 6)) return;

  const word =
    ctx.match[1].trim();

  const chat =
    ensureChat(ctx.chat);

  chat.forbiddenWords =
    chat.forbiddenWords.filter(
      x => x.toLowerCase() !== word.toLowerCase()
    );

  saveDB();

  return reply(
    ctx,
    "• تم إلغاء منع الكلمة"
  );
});

bot.hears(/^الكلمات الممنوعه$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 6)) return;

  const chat =
    ensureChat(ctx.chat);

  if (!chat.forbiddenWords.length) {
    return reply(
      ctx,
      "• لا توجد كلمات ممنوعة"
    );
  }

  return reply(
    ctx,
    `• الكلمات الممنوعة\n\n${chat.forbiddenWords
      .map(x => `• ${escapeHTML(x)}`)
      .join("\n")}`
  );
});

bot.hears(/^مسح الكلمات الممنوعه$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 6)) return;

  ensureChat(ctx.chat)
    .forbiddenWords = [];

  saveDB();

  return reply(
    ctx,
    "• تم مسح الكلمات الممنوعة"
  );
});

/* =========================================================
   CUSTOM COMMANDS
========================================================= */

const customFlow = {};

bot.hears(/^اضف امر(?:\s+(.+))?$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 6)) return;

  const name =
    (ctx.match[1] || "").trim();

  if (!name) {
    return reply(
      ctx,
      "• اكتب اسم الأمر"
    );
  }

  customFlow[ctx.from.id] = {
    type: "command",
    chat: ctx.chat.id,
    name
  };

  return reply(
    ctx,
    "• أرسل الآن رد الأمر"
  );
});

bot.hears(/^اضف رد(?:\s+(.+))?$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 6)) return;

  const word =
    (ctx.match[1] || "").trim();

  if (!word) {
    return reply(
      ctx,
      "• اكتب الكلمة"
    );
  }

  customFlow[ctx.from.id] = {
    type: "reply",
    chat: ctx.chat.id,
    word
  };

  return reply(
    ctx,
    "• أرسل الآن الرد"
  );
});

bot.hears(/^حذف امر (.+)$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 6)) return;

  const chat =
    ensureChat(ctx.chat);

  delete chat.customCommands[
    ctx.match[1].trim()
  ];

  saveDB();

  return reply(
    ctx,
    "• تم حذف الأمر"
  );
});

bot.hears(/^حذف رد (.+)$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 6)) return;

  const chat =
    ensureChat(ctx.chat);

  delete chat.customReplies[
    ctx.match[1].trim()
  ];

  saveDB();

  return reply(
    ctx,
    "• تم حذف الرد"
  );
});

bot.hears(/^اوامري$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 6)) return;

  const chat =
    ensureChat(ctx.chat);

  const commands =
    Object.keys(chat.customCommands);

  if (!commands.length) {
    return reply(
      ctx,
      "• لا توجد أوامر مخصصة"
    );
  }

  return reply(
    ctx,
    `• الأوامر المخصصة\n\n${commands
      .map(x => `• ${escapeHTML(x)}`)
      .join("\n")}`
  );
});

bot.hears(/^ردودي$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 6)) return;

  const chat =
    ensureChat(ctx.chat);

  const replies =
    Object.keys(chat.customReplies);

  if (!replies.length) {
    return reply(
      ctx,
      "• لا توجد ردود مخصصة"
    );
  }

  return reply(
    ctx,
    `• الردود المخصصة\n\n${replies
      .map(x => `• ${escapeHTML(x)}`)
      .join("\n")}`
  );
});

/* =========================================================
   CUSTOM FLOW
========================================================= */

bot.on("text", async (ctx, next) => {
  const flow =
    customFlow[ctx.from.id];

  if (
    flow &&
    isGroup(ctx) &&
    flow.chat === ctx.chat.id
  ) {
    const text =
      ctx.message.text.trim();

    if (flow.type === "command") {
      const chat =
        ensureChat(ctx.chat);

      chat.customCommands[
        flow.name
      ] = text;

      delete customFlow[ctx.from.id];

      saveDB();

      await reply(
        ctx,
        "• تم إضافة الأمر بنجاح"
      );

      return;
    }

    if (flow.type === "reply") {
      const chat =
        ensureChat(ctx.chat);

      chat.customReplies[
        flow.word
      ] = text;

      delete customFlow[ctx.from.id];

      saveDB();

      await reply(
        ctx,
        "• تم إضافة الرد بنجاح"
      );

      return;
    }
  }

  if (isGroup(ctx)) {
    const chat =
      ensureChat(ctx.chat);

    const text =
      ctx.message.text.trim();

    if (
      chat.customCommands[text]
    ) {
      await reply(
        ctx,
        escapeHTML(
          chat.customCommands[text]
        )
      );

      return;
    }

    if (
      chat.customReplies[text]
    ) {
      await reply(
        ctx,
        escapeHTML(
          chat.customReplies[text]
        )
      );

      return;
    }
  }

  return next();
});

/* =========================================================
   TITLES
========================================================= */

bot.hears(/^ضع (.+)$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 7)) return;

  const target =
    getReplyTarget(ctx);

  if (!target) {
    return reply(
      ctx,
      "• لازم تستخدم الامر بالرد على العضو"
    );
  }

  const title =
    ctx.match[1].trim();

  ensureUser(target).title =
    title;

  saveDB();

  return reply(
    ctx,
    `• تم وضع اللقب لـ ${mention(target)}`
  );
});

bot.hears(/^لقبي$/i, ctx => {
  const user =
    ensureUser(ctx.from);

  return reply(
    ctx,
    `• لقبك ↤︎ ${escapeHTML(
      user.title || "لا يوجد"
    )}`
  );
});

bot.hears(/^لقبه$/i, ctx => {
  const target =
    getReplyTarget(ctx);

  if (!target) {
    return reply(
      ctx,
      "• لازم تستخدم الامر بالرد على العضو"
    );
  }

  const user =
    ensureUser(target);

  return reply(
    ctx,
    `• لقبه ↤︎ ${escapeHTML(
      user.title || "لا يوجد"
    )}`
  );
});

/* =========================================================
   OWNER
========================================================= */

bot.hears(/^المالك$/i, async ctx => {
  return reply(
    ctx,
    `• المالك

• اليوزر ↤︎ @j4xa7
• الرتبة ↤︎ Dev🎖️`,
    Markup.inlineKeyboard([
      [
        Markup.button.url(
          "فتح حساب المالك",
          "https://t.me/j4xa7"
        )
      ]
    ])
  );
});

/* =========================================================
   صلاحياتي
========================================================= */

async function getTelegramPermissions(
  ctx,
  userId
) {
  try {
    const member =
      await ctx.telegram.getChatMember(
        ctx.chat.id,
        userId
      );

    if (
      member.status !== "administrator" &&
      member.status !== "creator"
    ) {
      return null;
    }

    return member;
  } catch {
    return null;
  }
}

function permissionText(value) {
  return value ? "نعم" : "لا";
}

async function permissionsMessage(
  ctx,
  target
) {
  const member =
    await getTelegramPermissions(
      ctx,
      target.id
    );

  if (!member) {
    return reply(
      ctx,
      `صلاحياتك ${escapeHTML(
        getRank(ctx, target.id)
      )} بالقروب`
    );
  }

  const p =
    member.status === "creator"
      ? {
          can_change_info: true,
          can_pin_messages: true,
          can_manage_topics: true,
          can_invite_users: true,
          can_delete_messages: true,
          can_restrict_members: true,
          can_promote_members: true
        }
      : member;

  return reply(
    ctx,
    `• صلاحياتك بالإشراف :
━━━━━━━━━━━
• تغيير المعلومات ↤︎ ${permissionText(
      p.can_change_info
    )}
• تثبيت الرسائل ↤︎ ${permissionText(
      p.can_pin_messages
    )}
• ادارة المواضيع ↤︎ ${permissionText(
      p.can_manage_topics
    )}
• اضافه مستخدمين ↤︎ ${permissionText(
      p.can_invite_users
    )}
• مسح الرسائل ↤︎ ${permissionText(
      p.can_delete_messages
    )}
• حظر المستخدمين ↤︎ ${permissionText(
      p.can_restrict_members
    )}
• اضافه المشرفين ↤︎ ${permissionText(
      p.can_promote_members
    )}`
  );
}

bot.hears(/^صلاحياتي$/i, async ctx => {
  if (!isGroup(ctx)) return;

  return permissionsMessage(
    ctx,
    ctx.from
  );
});

bot.hears(/^صلاحياته$/i, async ctx => {
  if (!isGroup(ctx)) return;

  const target =
    getReplyTarget(ctx);

  if (!target) {
    return reply(
      ctx,
      "• لازم تستخدم الامر بالرد على العضو"
    );
  }

  return permissionsMessage(
    ctx,
    target
  );
});

/* =========================================================
   ADMIN PROMOTION
========================================================= */

bot.hears(/^رفع مشرف$/i, async ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 7)) return;

  const target =
    getReplyTarget(ctx);

  if (!target) {
    return reply(
      ctx,
      "• لازم تستخدم الامر بالرد على العضو"
    );
  }

  return reply(
    ctx,
    `• صلاحيات المستخدم\n• المستخدم ↤︎ ${mention(target)}`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "تعديل الصلاحيات",
          `admin_edit:${target.id}`
        )
      ]
    ])
  );
});

bot.hears(/^ترقيه$/i, async ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 7)) return;

  const target =
    getReplyTarget(ctx);

  if (!target) {
    return reply(
      ctx,
      "• لازم تستخدم الامر بالرد على العضو"
    );
  }

  return reply(
    ctx,
    `• صلاحيات المستخدم\n• المستخدم ↤︎ ${mention(target)}`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "تعديل الصلاحيات",
          `admin_edit:${target.id}`
        )
      ]
    ])
  );
});

const adminStates = {};

bot.action(
  /^admin_edit:(\d+)$/,
  async ctx => {
    if (
      getLevel(ctx, ctx.from.id) < 7
    ) {
      return ctx.answerCbQuery(
        "لا تملك الصلاحية"
      );
    }

    const targetId =
      Number(ctx.match[1]);

    adminStates[
      `${ctx.from.id}:${targetId}`
    ] = {
      can_delete_messages: false,
      can_pin_messages: false,
      can_restrict_members: false,
      can_invite_users: false,
      can_promote_members: false,
      can_change_info: false,
      can_manage_topics: false
    };

    return ctx.editMessageText(
      "صلاحيات المستخدم\n\nاختر الصلاحيات المطلوبة:",
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "حذف الرسائل: لا",
            `perm:${targetId}:can_delete_messages`
          )
        ],
        [
          Markup.button.callback(
            "تثبيت الرسائل: لا",
            `perm:${targetId}:can_pin_messages`
          )
        ],
        [
          Markup.button.callback(
            "حظر المستخدمين: لا",
            `perm:${targetId}:can_restrict_members`
          )
        ],
        [
          Markup.button.callback(
            "تقييد المستخدمين: لا",
            `perm:${targetId}:can_restrict_members`
          )
        ],
        [
          Markup.button.callback(
            "إضافة أعضاء: لا",
            `perm:${targetId}:can_invite_users`
          )
        ],
        [
          Markup.button.callback(
            "إضافة مشرفين: لا",
            `perm:${targetId}:can_promote_members`
          )
        ],
        [
          Markup.button.callback(
            "تعديل معلومات المجموعة: لا",
            `perm:${targetId}:can_change_info`
          )
        ],
        [
          Markup.button.callback(
            "إدارة الموضوعات: لا",
            `perm:${targetId}:can_manage_topics`
          )
        ],
        [
          Markup.button.callback(
            "حفظ الصلاحيات",
            `admin_save:${targetId}`
          )
        ],
        [
          Markup.button.callback(
            "إخفاء الأمر",
            "admin_hide"
          )
        ]
      ])
    );
  }
);

bot.action(
  /^perm:(\d+):(.+)$/,
  async ctx => {
    if (
      getLevel(ctx, ctx.from.id) < 7
    ) {
      return ctx.answerCbQuery(
        "لا تملك الصلاحية"
      );
    }

    const targetId =
      Number(ctx.match[1]);

    const permission =
      ctx.match[2];

    const key =
      `${ctx.from.id}:${targetId}`;

    if (!adminStates[key]) {
      adminStates[key] = {};
    }

    adminStates[key][permission] =
      !adminStates[key][permission];

    await ctx.answerCbQuery(
      adminStates[key][permission]
        ? "نعم"
        : "لا"
    );

    return;
  }
);

bot.action(/^admin_hide$/, async ctx => {
  return ctx.deleteMessage();
});

bot.action(
  /^admin_save:(\d+)$/,
  async ctx => {
    if (
      getLevel(ctx, ctx.from.id) < 7
    ) {
      return ctx.answerCbQuery(
        "لا تملك الصلاحية"
      );
    }

    const targetId =
      Number(ctx.match[1]);

    const key =
      `${ctx.from.id}:${targetId}`;

    const permissions =
      adminStates[key] || {};

    try {
      await ctx.telegram.promoteChatMember(
        ctx.chat.id,
        targetId,
        {
          can_delete_messages:
            !!permissions.can_delete_messages,
          can_pin_messages:
            !!permissions.can_pin_messages,
          can_restrict_members:
            !!permissions.can_restrict_members,
          can_invite_users:
            !!permissions.can_invite_users,
          can_promote_members:
            !!permissions.can_promote_members,
          can_change_info:
            !!permissions.can_change_info,
          can_manage_topics:
            !!permissions.can_manage_topics
        }
      );

      delete adminStates[key];

      await ctx.answerCbQuery(
        "تم حفظ الصلاحيات"
      );

      return ctx.editMessageText(
        "• تم حفظ الصلاحيات ورفع المستخدم كمشرف"
      );
    } catch {
      return ctx.answerCbQuery(
        "تأكد أن البوت يملك صلاحية إضافة المشرفين"
      );
    }
  }
);

/* =========================================================
   @ALL
========================================================= */

bot.hears(/^@all$/i, async ctx => {
  if (!isGroup(ctx)) return;

  const chat =
    ensureChat(ctx.chat);

  if (!chat.settings.allMention) {
    return;
  }

  if (
    getLevel(ctx, ctx.from.id) === 0
  ) {
    return;
  }

  try {
    const members =
      await ctx.telegram.getChatAdministrators(
        ctx.chat.id
      );

    const lines =
      members.map(
        m => mention(m.user)
      );

    for (
      let i = 0;
      i < lines.length;
      i += 20
    ) {
      await reply(
        ctx,
        lines.slice(i, i + 20).join(" ")
      );
    }
  } catch {
    return reply(
      ctx,
      "• تعذر تنفيذ المنشن"
    );
  }
});

bot.hears(/^فتح المنشن$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 7)) return;

  ensureChat(ctx.chat)
    .settings.allMention = true;

  saveDB();

  return reply(
    ctx,
    "• تم فتح المنشن"
  );
});

bot.hears(/^غلق المنشن$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 7)) return;

  ensureChat(ctx.chat)
    .settings.allMention = false;

  saveDB();

  return reply(
    ctx,
    "• تم غلق المنشن"
  );
});

/* =========================================================
   GAMES LOCK
========================================================= */

bot.hears(/^قفل الالعاب$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 7)) return;

  ensureChat(ctx.chat)
    .games.locked = true;

  ensureChat(ctx.chat)
    .games.active = null;

  saveDB();

  return reply(
    ctx,
    "• تم قفل الألعاب\n• لا يمكن للأعضاء بدء أو المشاركة في الألعاب حاليًا"
  );
});

bot.hears(/^فتح الالعاب$/i, ctx => {
  if (!isGroup(ctx)) return;

  if (!requireRank(ctx, 7)) return;

  ensureChat(ctx.chat)
    .games.locked = false;

  saveDB();

  return reply(
    ctx,
    "• تم فتح الألعاب\n• يمكن للأعضاء اللعب والمشاركة الآن"
  );
});

/* =========================================================
   SIMPLE GAME
========================================================= */

const gameQuestions = [
  {
    question: "ما عاصمة السعودية؟",
    answer: "الرياض"
  },
  {
    question: "كم يساوي 5 + 5؟",
    answer: "10"
  },
  {
    question: "ما لون السماء غالبًا؟",
    answer: "ازرق"
  },
  {
    question: "كم عدد أيام الأسبوع؟",
    answer: "7"
  }
];

bot.hears(/^حساب$/i, async ctx => {
  if (!isGroup(ctx)) return;

  const chat =
    ensureChat(ctx.chat);

  if (chat.games.locked) {
    return;
  }

  const a =
    Math.floor(Math.random() * 20) + 1;

  const b =
    Math.floor(Math.random() * 20) + 1;

  chat.games.active = {
    type: "حساب",
    answer: String(a + b),
    started: Date.now()
  };

  saveDB();

  return reply(
    ctx,
    `• السؤال\n• كم يساوي ${a} + ${b}؟`
  );
});

bot.on("text", async (ctx, next) => {
  if (!isGroup(ctx)) {
    return next();
  }

  const chat =
    ensureChat(ctx.chat);

  const game =
    chat.games.active;

  if (
    !game ||
    game.type !== "حساب"
  ) {
    return next();
  }

  if (
    ctx.message.text.trim() !==
    String(game.answer)
  ) {
    return next();
  }

  const elapsed =
    (Date.now() - game.started) /
    1000;

  const user =
    ensureUser(ctx.from);

  user.balance += 10;
  user.stats.wins++;
  user.stats.correct++;

  if (
    user.stats.bestSpeed === null ||
    elapsed < user.stats.bestSpeed
  ) {
    user.stats.bestSpeed = elapsed;
  }

  chat.games.active = null;

  saveDB();

  let speed = "بطيء";

  if (elapsed <= 3) {
    speed = "سريع";
  } else if (elapsed <= 7) {
    speed = "متوسط";
  }

  return reply(
    ctx,
    `كفو عليك\n• الوقت: ${elapsed.toFixed(1)} ثانية\n• السرعه: ${speed}\n• فلوسك: ${user.balance} ريال`
  );
});

/* =========================================================
   MARRIAGE
========================================================= */

function getMarriageData(chat, userId) {
  const uid = String(userId);

  if (!chat.marriages[uid]) {
    chat.marriages[uid] = {
      spouses: []
    };
  }

  return chat.marriages[uid];
}

bot.hears(
  /^زواج(?: (الثانيه|الثالثه|الرابعه))? (\d+)$/i,
  ctx => {
    if (!isGroup(ctx)) return;

    const target =
      getReplyTarget(ctx);

    if (!target) {
      return reply(
        ctx,
        "• لازم تستخدم الزواج بالرد على العضو"
      );
    }

    const chat =
      ensureChat(ctx.chat);

    const actor =
      getMarriageData(
        chat,
        ctx.from.id
      );

    const targetData =
      getMarriageData(
        chat,
        target.id
      );

    if (
      targetData.spouses.length > 0
    ) {
      return reply(
        ctx,
        "• لاتقرب للمتزوجين"
      );
    }

    const number =
      ctx.match[1] || "";

    let slot = 0;

    if (number === "الثانيه") slot = 1;
    if (number === "الثالثه") slot = 2;
    if (number === "الرابعه") slot = 3;

    if (
      actor.spouses.length >= 4 ||
      slot >= 4
    ) {
      return reply(
        ctx,
        "• ما تقدر تتزوج أكثر من أربع زوجات"
      );
    }

    if (
      actor.spouses.some(
        x => x.userId === target.id
      )
    ) {
      return reply(
        ctx,
        "• لا يمكن تسجيل زواج مكرر"
      );
    }

    const dowry =
      Number(ctx.match[2]);

    actor.spouses[slot] = {
      userId: target.id,
      dowry,
      time: Date.now(),
      username:
        target.username || ""
    };

    targetData.husband =
      ctx.from.id;

    saveDB();

    return reply(
      ctx,
      `• مبروك زوجتكم\n• الزوج: ${mention(ctx.from)}\n• الزوجة: ${mention(target)}\n• المهر: ${dowry}`
    );
  }
);

bot.hears(/^زواجي$/i, async ctx => {
  if (!isGroup(ctx)) return;

  const chat =
    ensureChat(ctx.chat);

  const data =
    getMarriageData(
      chat,
      ctx.from.id
    );

  if (!data.spouses.length) {
    return reply(
      ctx,
      "• لا يوجد لديك زواج"
    );
  }

  const lines = [];

  for (
    let i = 0;
    i < data.spouses.length;
    i++
  ) {
    const marriage =
      data.spouses[i];

    let user;

    try {
      const member =
        await ctx.telegram.getChatMember(
          ctx.chat.id,
          marriage.userId
        );

      user = member.user;
    } catch {}

    lines.push(
      `• ${["الأولى","الثانية","الثالثة","الرابعة"][i]}: ${
        user
          ? mention(user)
          : marriage.userId
      }\n• المهر: ${marriage.dowry}`
    );
  }

  return reply(
    ctx,
    `• زواجك\n${lines.join("\n")}`
  );
});

bot.hears(/^توب المتزوجين$/i, ctx => {
  if (!isGroup(ctx)) return;

  const chat =
    ensureChat(ctx.chat);

  const list =
    Object.entries(chat.marriages)
      .map(([uid, data]) => ({
        uid,
        total:
          (data.spouses || [])
            .reduce(
              (sum, x) =>
                sum + Number(x.dowry || 0),
              0
            )
      }))
      .sort(
        (a, b) => b.total - a.total
      )
      .slice(0, 20);

  if (!list.length) {
    return reply(
      ctx,
      "• لا يوجد متزوجين"
    );
  }

  return reply(
    ctx,
    `• توب المتزوجين\n\n${list
      .map(
        (x, i) =>
          `${i + 1} - <a href="tg://user?id=${x.uid}">العضو</a>\n• إجمالي المهور: ${x.total}`
      )
      .join("\n\n")}`
  );
});

/* =========================================================
   DEV SHORT COMMANDS
========================================================= */

const devCommands = {
  "ا": "معلومات العضو",
  "ت": "التوب",
  "ق": "قوانين القروب",
  "م": "معلومات القروب",
  "ن": "المنشنات أو التنبيهات",
  "ح": "حالة القروب",
  "د": "دعوة / رابط القروب"
};

for (const [command, description] of Object.entries(
  devCommands
)) {
  bot.hears(
    new RegExp(`^${command}$`),
    async ctx => {
      if (!isGroup(ctx)) return;

      if (!requireRank(ctx, 7)) return;

      if (command === "ق") {
        const chat =
          ensureChat(ctx.chat);

        return reply(
          ctx,
          chat.laws
            ? escapeHTML(chat.laws)
            : "• لا توجد قوانين مضافة"
        );
      }

      if (command === "م") {
        return reply(
          ctx,
          `• معلومات القروب\n• الاسم: ${escapeHTML(
            ctx.chat.title || ""
          )}\n• المعرف: ${ctx.chat.id}`
        );
      }

      if (command === "ح") {
        const chat =
          ensureChat(ctx.chat);

        return reply(
          ctx,
          `• حالة القروب\n• الحماية: ${
            chat.settings.protection
              ? "مفعلة"
              : "معطلة"
          }\n• المخالفات: ${
            chat.settings.violations
              ? "مفعلة"
              : "معطلة"
          }`
        );
      }

      if (command === "د") {
        try {
          const link =
            await ctx.telegram.exportChatInviteLink(
              ctx.chat.id
            );

          return reply(
            ctx,
            `• رابط القروب\n${escapeHTML(link)}`
          );
        } catch {
          return reply(
            ctx,
            "• تعذر جلب رابط القروب"
          );
        }
      }

      if (command === "ت") {
        return bot.handleUpdate({
          update_id: Date.now(),
          message: {
            ...ctx.message,
            text: "المتفاعلين"
          }
        });
      }

      return reply(
        ctx,
        `• ${description}`
      );
    }
  );
}

/* =========================================================
   HELP
========================================================= */

const HELP = {
  developer: [
    "فتح المخالفات",
    "غلق المخالفات",
    "رفع مطور ثانوي",
    "تنزيل مطور ثانوي",
    "قفل الالعاب",
    "فتح الالعاب",
    "فتح المنشن",
    "غلق المنشن"
  ],
  ranks: [
    "رتبتي",
    "رتبته",
    "رفع مميز",
    "رفع مالك",
    "رفع اساس",
    "رفع M",
    "رفع My",
    "رفع ديف",
    "تنزيل"
  ],
  protection: [
    "تفعيل الحماية",
    "تعطيل الحماية",
    "حالة الحماية",
    "فتح المخالفات",
    "غلق المخالفات",
    "كتم",
    "فك كتم",
    "كتم عام",
    "فك الكتم العام",
    "مم",
    "خخ",
    "تقييد",
    "الغاء التقييد",
    "حظر",
    "فك الحظر",
    "طرد",
    "تحذير",
    "الغاء التحذير",
    "تنظيف 0 - 9"
  ],
  interaction: [
    "تفاعلي",
    "المتفاعلين",
    "رتبتي",
    "رتبته",
    "تفاعله",
    "اضف تفاعل"
  ],
  whispers: [
    "اهمس",
    "همسه",
    "ه"
  ],
  music: [
    "بحث أغنية",
    "تشغيل",
    "إيقاف",
    "استئناف",
    "تخطي",
    "إلغاء",
    "الأغنية",
    "قائمة التشغيل",
    "مسح القائمة"
  ],
  custom: [
    "اضف امر",
    "حذف امر",
    "اوامري",
    "اضف رد",
    "حذف رد",
    "ردودي"
  ],
  group: [
    "قروب",
    "القوانين",
    "المالك",
    "صلاحياتي",
    "صلاحياته",
    "لقبي",
    "لقبه"
  ]
};

function helpKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "المطور",
        "help:developer"
      ),
      Markup.button.callback(
        "الرتب",
        "help:ranks"
      )
    ],
    [
      Markup.button.callback(
        "الحماية",
        "help:protection"
      ),
      Markup.button.callback(
        "التفاعل والألعاب والفعاليات",
        "help:interaction"
      )
    ],
    [
      Markup.button.callback(
        "الهمسات والأغاني",
        "help:whispers"
      ),
      Markup.button.callback(
        "الأوامر المخصصة",
        "help:custom"
      )
    ],
    [
      Markup.button.callback(
        "القروب",
        "help:group"
      )
    ]
  ]);
}

bot.hears(/^اوامر$/i, ctx => {
  return reply(
    ctx,
    "• قائمة أوامر البوت\n\nاختر القسم:",
    helpKeyboard()
  );
});

bot.action(
  /^help:(.+)$/i,
  async ctx => {
    const section =
      ctx.match[1];

    const commands =
      HELP[section];

    if (!commands) {
      return ctx.answerCbQuery();
    }

    await ctx.answerCbQuery();

    return ctx.editMessageText(
      `• ${section}\n\n${commands
        .map(x => `• ${x}`)
        .join("\n")}`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "رجوع",
              "help:main"
            )
          ]
        ])
      }
    );
  }
);

bot.action(/^help:main$/i, async ctx => {
  await ctx.answerCbQuery();

  return ctx.editMessageText(
    "• قائمة أوامر البوت\n\nاختر القسم:",
    {
      ...helpKeyboard()
    }
  );
});

/* =========================================================
   GENERAL STATS
========================================================= */

bot.hears(/^حالة البوت$/i, ctx => {
  if (!requireRank(ctx, 7)) return;

  return reply(
    ctx,
    `• حالة البوت ↤︎ يعمل
• المستخدمين ↤︎ ${Object.keys(db.users).length}
• القروبات ↤︎ ${Object.keys(db.chats).length}`
  );
});

bot.hears(/^احصائيات البوت$/i, ctx => {
  if (!requireRank(ctx, 7)) return;

  return reply(
    ctx,
    `• احصائيات البوت
• المستخدمين ↤︎ ${Object.keys(db.users).length}
• القروبات ↤︎ ${Object.keys(db.chats).length}
• المشتركين ↤︎ ${db.subscribers.length}`
  );
});

/* =========================================================
   NEW PRIVATE SUBSCRIBERS
========================================================= */

bot.on("my_chat_member", ctx => {
  try {
    const user =
      ctx.from;

    if (user) {
      ensureUser(user);

      if (
        !db.subscribers.includes(user.id)
      ) {
        db.subscribers.push(user.id);
      }

      saveDB();
    }
  } catch {}
});

/* =========================================================
   MESSAGE STATS
========================================================= */

bot.on("message", async (ctx, next) => {
  if (
    isGroup(ctx) &&
    ctx.from &&
    !ctx.from.is_bot
  ) {
    const chat =
      ensureChat(ctx.chat);

    const uid =
      String(ctx.from.id);

    chat.stats[uid] =
      Number(chat.stats[uid] || 0) + 1;

    ensureUser(ctx.from)
      .stats.messages++;

    if (
      !chat.stats[uid]
    ) {
      chat.stats[uid] = 1;
    }

    saveDB();
  }

  return next();
});

/* =========================================================
   ERROR HANDLER
========================================================= */

bot.catch((err, ctx) => {
  console.error(
    "BOT ERROR:",
    err
  );

  try {
    if (ctx) {
      ctx.reply(
        "• حدث خطأ أثناء تنفيذ الأمر"
      ).catch(() => {});
    }
  } catch {}
});

/* =========================================================
   LAUNCH
========================================================= */

(async () => {
  try {
    db.globalRoles = db.globalRoles || {};

    const me =
      await bot.telegram.getMe();

    db.globalRoles[String(me.id)] =
      db.globalRoles[String(me.id)] || null;

    saveDB();

    await bot.telegram.deleteWebhook({
      drop_pending_updates: true
    });

    await bot.launch({
      dropPendingUpdates: true
    });

    console.log(
      `BOT STARTED: @${me.username}`
    );
    console.log(
      "DEV: @j4xa7 = Dev🎖️"
    );
    console.log(
      "DATABASE:",
      DB_FILE
    );
  } catch (error) {
    console.error(
      "LAUNCH ERROR:",
      error
    );

    process.exit(1);
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
EOF

node --check index.cjs
node index.cjs
