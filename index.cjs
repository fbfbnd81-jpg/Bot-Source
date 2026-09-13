"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Telegraf, Markup } = require("telegraf");
const ytSearch = require("yt-search");

/* =========================================================
   الإعدادات
========================================================= */

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN غير موجود في متغيرات البيئة");
}

const bot = new Telegraf(BOT_TOKEN);

const OWNER_USERNAME = "j4xa7";

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "data.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* =========================================================
   الرتب
========================================================= */

const RANKS = {
  "عضو": 0,
  "مميز": 1,
  "مالك": 2,
  "مالك أساسي": 3,
  "Myth": 4,
  "Myth 🎖️": 5,
  "Dev²": 6,
  "Dev🎖️": 7
};

const RANK_NAMES = [
  "عضو",
  "مميز",
  "مالك",
  "مالك أساسي",
  "Myth",
  "Myth 🎖️",
  "Dev²",
  "Dev🎖️"
];

/* =========================================================
   البيانات
========================================================= */

const DEFAULT_DATA = {
  users: {},
  groups: {},
  subscribers: [],
  channels: {},
  bot: {
    enabled: true,
    replies: true,
    bank: true,
    communication: true,
    mandatorySubscription: false,
    subscriptionChannel: "",
    serviceBot: true,
    stats: true,
    messenger: true,
    formats: true,
    memberCount: null,
    logChannel: ""
  }
};

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(DEFAULT_DATA, null, 2)
      );
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }

    const saved = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    return {
      ...JSON.parse(JSON.stringify(DEFAULT_DATA)),
      ...saved,
      users: saved.users || {},
      groups: saved.groups || {},
      subscribers: saved.subscribers || [],
      channels: saved.channels || {}
    };
  } catch (e) {
    console.error("خطأ قراءة البيانات:", e);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

let data = loadData();

function saveData() {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2)
  );
}

/* =========================================================
   إنشاء المستخدم والمجموعة
========================================================= */

function getUser(id, source = {}) {
  const key = String(id);

  if (!data.users[key]) {
    data.users[key] = {
      id,
      username: source.username || "",
      first_name: source.first_name || "مستخدم",
      rank: 0,
      title: "",
      interaction: 0,
      balance: 0,
      bank: 0,
      bankName: "",
      bankAccount: false,
      purchases: [],
      games: {
        plays: 0,
        wins: 0,
        answers: 0,
        bestSpeed: null
      }
    };
  }

  const user = data.users[key];

  user.rank ??= 0;
  user.title ??= "";
  user.interaction ??= 0;
  user.balance ??= 0;
  user.bank ??= 0;
  user.bankName ??= "";
  user.bankAccount ??= false;
  user.purchases ||= [];

  user.games ||= {
    plays: 0,
    wins: 0,
    answers: 0,
    bestSpeed: null
  };

  if (source.username !== undefined) {
    user.username = source.username || "";
  }

  if (source.first_name !== undefined) {
    user.first_name = source.first_name || "مستخدم";
  }

  return user;
}

function getGroup(ctx) {
  const id = String(ctx.chat.id);

  if (!data.groups[id]) {
    data.groups[id] = {
      id: ctx.chat.id,
      title: ctx.chat.title || "",

      members: {},
      ranks: {},

      muted: {},
      globalMuted: {},
      restricted: {},
      banned: {},

      warnings: {
        enabled: true,
        users: {},
        autoMute: true,
        autoBan: false
      },

      violations: {
        enabled: true,
        users: {}
      },

      protection: {
        enabled: true,
        links: false,
        mentions: false,
        repetition: true,
        ads: true,
        forwards: false,
        edits: false,
        commands: false,
        longMessages: false,
        phoneNumbers: false,
        groupIds: false,
        channelIds: false,
        bots: false,
        suspicious: false,

        media: {
          photo: false,
          video: false,
          document: false,
          sticker: false,
          animation: false,
          audio: false,
          voice: false,
          video_note: false
        }
      },

      mentions: {
        enabled: true
      },

      forbiddenWords: [],

      cleaning: {
        automatic: false
      },

      messageHistory: {},

      customCommands: {},
      customReplies: {},

      games: {
        enabled: true,
        active: null,
        stats: {}
      },

      economy: {
        balances: {},
        transactions: {}
      },

      music: {
        queue: [],
        current: null,
        playing: false
      },

      settings: {
        lockedCommands: {},
        chatLocked: false
      },

      channel: null,

      logs: []
    };
  }

  const group = data.groups[id];

  group.members ||= {};
  group.ranks ||= {};
  group.muted ||= {};
  group.globalMuted ||= {};
  group.restricted ||= {};
  group.banned ||= {};

  group.warnings ||= {
    enabled: true,
    users: {},
    autoMute: true,
    autoBan: false
  };

  group.violations ||= {
    enabled: true,
    users: {}
  };

  group.protection ||= {};
  group.protection.media ||= {};

  const mediaDefaults = {
    photo: false,
    video: false,
    document: false,
    sticker: false,
    animation: false,
    audio: false,
    voice: false,
    video_note: false
  };

  for (const [k, v] of Object.entries(mediaDefaults)) {
    group.protection.media[k] ??= v;
  }

  group.mentions ||= { enabled: true };
  group.forbiddenWords ||= [];
  group.cleaning ||= { automatic: false };
  group.messageHistory ||= {};
  group.customCommands ||= {};
  group.customReplies ||= {};

  group.games ||= {
    enabled: true,
    active: null,
    stats: {}
  };

  group.economy ||= {
    balances: {},
    transactions: {}
  };

  group.music ||= {
    queue: [],
    current: null,
    playing: false
  };

  group.settings ||= {
    lockedCommands: {},
    chatLocked: false
  };

  group.logs ||= [];

  if (ctx.from) {
    group.members[String(ctx.from.id)] = {
      id: ctx.from.id,
      username: ctx.from.username || "",
      first_name: ctx.from.first_name || "مستخدم"
    };
  }

  return group;
}

/* =========================================================
   أدوات
========================================================= */

function isGroup(ctx) {
  return (
    ctx.chat &&
    ["group", "supergroup"].includes(ctx.chat.type)
  );
}

function isOwner(user) {
  return (
    user &&
    String(user.username || "")
      .replace("@", "")
      .toLowerCase() ===
      OWNER_USERNAME.toLowerCase()
  );
}

function clean(value) {
  return String(value || "").trim();
}

function getReplyUser(ctx) {
  return ctx.message?.reply_to_message?.from || null;
}

function getTarget(ctx) {
  return getReplyUser(ctx);
}

function getRank(ctx, id) {
  if (!id) return 0;

  const user = getUser(id);

  if (isOwner(user)) return 7;

  if (isGroup(ctx)) {
    const group = getGroup(ctx);

    if (group.ranks[String(id)] !== undefined) {
      return Number(group.ranks[String(id)]);
    }
  }

  return Number(user.rank || 0);
}

function myRank(ctx) {
  return getRank(ctx, ctx.from.id);
}

function rankName(rank) {
  return RANK_NAMES[rank] || "عضو";
}

function canManage(ctx, target) {
  if (!target) return false;

  if (isOwner(target)) return false;

  return myRank(ctx) > getRank(ctx, target.id);
}

function mention(user) {
  return `<a href="tg://user?id=${user.id}">${
    String(user.first_name || "مستخدم")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
  }</a>`;
}

function logAction(ctx, text) {
  if (!isGroup(ctx)) return;

  const group = getGroup(ctx);

  group.logs.push({
    user: ctx.from?.id || 0,
    text,
    time: Date.now()
  });

  if (group.logs.length > 200) {
    group.logs = group.logs.slice(-200);
  }

  saveData();
}

function addInteraction(ctx) {
  if (!ctx.from) return;

  const user = getUser(
    ctx.from.id,
    ctx.from
  );

  user.interaction++;

  if (isGroup(ctx)) {
    const group = getGroup(ctx);

    group.members[String(ctx.from.id)] = {
      id: ctx.from.id,
      username: ctx.from.username || "",
      first_name: ctx.from.first_name || "مستخدم"
    };
  }
}

/* =========================================================
   تسجيل المشتركين
========================================================= */

function registerSubscriber(ctx) {
  if (!ctx.from) return;

  const id = ctx.from.id;

  if (!data.subscribers.includes(id)) {
    data.subscribers.push(id);
    saveData();
  }
}

/* =========================================================
   START
========================================================= */

bot.start(async ctx => {
  registerSubscriber(ctx);

  const payload = ctx.startPayload || "";

  if (payload.startsWith("whisper_")) {
    return handleWhisperOpen(ctx, payload);
  }

  if (payload.startsWith("whisperreply_")) {
    return handleWhisperReply(ctx, payload);
  }

  await ctx.reply(
    "• أهلًا بك\n• البوت جاهز للعمل"
  );
});

/* =========================================================
   المالك
========================================================= */

bot.hears("المالك", async ctx => {
  await ctx.replyWithHTML(
    `• المالك الأساسي\n\n` +
    `• الاسم: المالك\n` +
    `• اليوزر: @${OWNER_USERNAME}\n` +
    `• الرتبة: Dev🎖️`
  );
});

/* =========================================================
   الرتبة
========================================================= */

bot.hears("رتبتي", async ctx => {
  await ctx.reply(
    `• رتبتك: ${rankName(myRank(ctx))}`
  );
});

bot.hears("رتبته", async ctx => {
  const target = getTarget(ctx);

  if (!target) {
    return ctx.reply(
      "• رد على المستخدم أولًا"
    );
  }

  await ctx.reply(
    `• رتبة ${target.first_name || "المستخدم"}: ${
      rankName(getRank(ctx, target.id))
    }`
  );
});

/* =========================================================
   التفاعل
========================================================= */

bot.hears("تفاعلي", async ctx => {
  const user = getUser(
    ctx.from.id,
    ctx.from
  );

  await ctx.reply(
    `• تفاعلك: ${user.interaction}`
  );
});

bot.hears("تفاعله", async ctx => {
  const target = getTarget(ctx);

  if (!target) {
    return ctx.reply(
      "• رد على المستخدم أولًا"
    );
  }

  const user = getUser(
    target.id,
    target
  );

  await ctx.reply(
    `• تفاعله: ${user.interaction}`
  );
});

bot.hears("المتفاعلين", async ctx => {
  const users = Object.values(data.users)
    .filter(u => u.interaction > 0)
    .sort(
      (a, b) =>
        b.interaction - a.interaction
    )
    .slice(0, 30);

  if (!users.length) {
    return ctx.reply(
      "• لا يوجد متفاعلين"
    );
  }

  const text = users
    .map(
      (u, i) =>
        `${i + 1}. ${u.first_name} — ${u.interaction}`
    )
    .join("\n");

  await ctx.reply(
    `• المتفاعلين:\n\n${text}`
  );
});

/* =========================================================
   رفع الرتب
========================================================= */

const PROMOTIONS = {
  "رفع مميز": 1,
  "رفع مالك": 2,
  "رفع مالك أساسي": 3,
  "رفع اساس": 3,
  "رفع Myth": 4,
  "رفع M": 4,

  /* مهم: My = Myth 🎖️ */
  "رفع My": 5,
  "رفع Myth 🎖️": 5,
  "رفع اكس": 5,

  "رفع Dev²": 6,
  "رفع مطور ثانوي": 6,

  "رفع ديف": 7
};

for (const [command, rank] of Object.entries(PROMOTIONS)) {
  bot.hears(command, async ctx => {
    const target = getTarget(ctx);

    if (!target) {
      return ctx.reply(
        "• رد على المستخدم أولًا"
      );
    }

    if (myRank(ctx) < 7) {
      return ctx.reply(
        "• رفع الرتب للـ Dev🎖️ فقط"
      );
    }

    if (!canManage(ctx, target)) {
      return ctx.reply(
        "• لا يمكنك رفع رتبة هذا المستخدم"
      );
    }

    const group = getGroup(ctx);

    group.ranks[String(target.id)] = rank;

    const user = getUser(
      target.id,
      target
    );

    user.rank = rank;

    saveData();

    await ctx.reply(
      `• تم رفع ${target.first_name || "المستخدم"} إلى ${rankName(rank)}`
    );
  });
}

/* =========================================================
   تنزيل
========================================================= */

bot.hears("تنزيل", async ctx => {
  const target = getTarget(ctx);

  if (!target) {
    return ctx.reply(
      "• رد على المستخدم أولًا"
    );
  }

  if (myRank(ctx) < 7) {
    return ctx.reply(
      "• تنزيل الرتب للـ Dev🎖️ فقط"
    );
  }

  if (!canManage(ctx, target)) {
    return ctx.reply(
      "• لا يمكنك تنزيل هذا المستخدم"
    );
  }

  const group = getGroup(ctx);

  group.ranks[String(target.id)] = 0;

  const user = getUser(
    target.id,
    target
  );

  user.rank = 0;

  saveData();

  await ctx.reply(
    "• تم تنزيل رتبة المستخدم إلى عضو"
  );
});

/* =========================================================
   قفل وفتح الأوامر
========================================================= */

bot.hears(/^قفل امر (.+)$/i, async ctx => {
  if (myRank(ctx) < 7) {
    return ctx.reply(
      "• هذا الأمر للـ Dev🎖️ فقط"
    );
  }

  if (!isGroup(ctx)) return;

  const command = clean(ctx.match[1]);
  const group = getGroup(ctx);

  group.settings.lockedCommands[
    command
  ] = true;

  saveData();

  await ctx.reply(
    `• تم قفل أمر: ${command}`
  );
});

bot.hears(/^فتح امر (.+)$/i, async ctx => {
  if (myRank(ctx) < 7) {
    return ctx.reply(
      "• هذا الأمر للـ Dev🎖️ فقط"
    );
  }

  if (!isGroup(ctx)) return;

  const command = clean(ctx.match[1]);
  const group = getGroup(ctx);

  delete group.settings.lockedCommands[
    command
  ];

  saveData();

  await ctx.reply(
    `• تم فتح أمر: ${command}`
  );
});

/* =========================================================
   الكتم
========================================================= */

async function restrictUser(
  ctx,
  target,
  duration = 0
) {
  const until =
    duration > 0
      ? Math.floor(Date.now() / 1000) + duration
      : 0;

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
      },
      until_date: until || undefined
    }
  );
}

async function unrestrictUser(ctx, target) {
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
}

bot.hears("كتم", async ctx => {
  const target = getTarget(ctx);

  if (!target)
    return ctx.reply("• رد على المستخدم");

  if (myRank(ctx) < 2)
    return ctx.reply("• الصلاحية تبدأ من المالك");

  if (!canManage(ctx, target))
    return ctx.reply("• لا يمكنك كتم هذا المستخدم");

  try {
    await restrictUser(ctx, target);

    getGroup(ctx).muted[String(target.id)] = {
      time: Date.now()
    };

    saveData();

    await ctx.reply(
      `• تم كتم ${target.first_name || "المستخدم"}`
    );
  } catch {
    await ctx.reply(
      "• تعذر كتم المستخدم\n• تأكد أن البوت مشرف"
    );
  }
});

bot.hears("كتم عام", async ctx => {
  const target = getTarget(ctx);

  if (!target)
    return ctx.reply("• رد على المستخدم");

  if (myRank(ctx) < 2)
    return ctx.reply("• الصلاحية تبدأ من المالك");

  if (!canManage(ctx, target))
    return ctx.reply("• لا يمكنك كتم هذا المستخدم");

  try {
    await restrictUser(ctx, target);

    getGroup(ctx).globalMuted[String(target.id)] = {
      time: Date.now()
    };

    saveData();

    await ctx.reply("• تم الكتم العام");
  } catch {
    await ctx.reply("• تعذر تنفيذ الكتم العام");
  }
});

bot.hears("عام", async ctx => {
  await bot.telegram.sendMessage(
    ctx.chat.id,
    "• استخدم كتم عام لتفعيل الكتم العام على مستخدم بالرد عليه"
  );
});

bot.hears("فك الكتم", async ctx => {
  const target = getTarget(ctx);

  if (!target)
    return ctx.reply("• رد على المستخدم");

  if (myRank(ctx) < 2)
    return ctx.reply("• الصلاحية تبدأ من المالك");

  try {
    await unrestrictUser(ctx, target);

    delete getGroup(ctx).muted[
      String(target.id)
    ];

    saveData();

    await ctx.reply("• تم فك الكتم");
  } catch {
    await ctx.reply("• تعذر فك الكتم");
  }
});

bot.hears("فك الكتم العام", async ctx => {
  const target = getTarget(ctx);

  if (!target)
    return ctx.reply("• رد على المستخدم");

  if (myRank(ctx) < 2)
    return ctx.reply("• الصلاحية تبدأ من المالك");

  try {
    await unrestrictUser(ctx, target);

    delete getGroup(ctx).globalMuted[
      String(target.id)
    ];

    saveData();

    await ctx.reply(
      "• تم فك الكتم العام"
    );
  } catch {
    await ctx.reply(
      "• تعذر فك الكتم العام"
    );
  }
});

/* =========================================================
   مسح المكتومين
========================================================= */

bot.hears("مم", async ctx => {
  if (myRank(ctx) < 5) {
    return ctx.reply(
      "• الصلاحية تبدأ من Myth 🎖️"
    );
  }

  const group = getGroup(ctx);
  const ids = Object.keys(group.muted);

  if (!ids.length) {
    return ctx.reply(
      "• لا يوجد مكتومين"
    );
  }

  let count = 0;

  for (const id of ids) {
    try {
      await unrestrictUser(
        ctx,
        { id: Number(id) }
      );
      count++;
    } catch {}
  }

  group.muted = {};

  saveData();

  await ctx.reply(
    `• تم مسح ( ${count} ) من المكتومين`
  );
});

bot.hears("خخ", async ctx => {
  if (myRank(ctx) < 5) {
    return ctx.reply(
      "• الصلاحية تبدأ من Myth 🎖️"
    );
  }

  const group = getGroup(ctx);
  const ids = Object.keys(group.globalMuted);

  if (!ids.length) {
    return ctx.reply(
      "• لا يوجد مكتومين"
    );
  }

  let count = 0;

  for (const id of ids) {
    try {
      await unrestrictUser(
        ctx,
        { id: Number(id) }
      );
      count++;
    } catch {}
  }

  group.globalMuted = {};

  saveData();

  await ctx.reply(
    `• تم مسح ( ${count} ) من المكتومين عام`
  );
});

/* =========================================================
   التقييد
========================================================= */

bot.hears(/^(تقييد|تق)$/i, async ctx => {
  const target = getTarget(ctx);

  if (!target)
    return ctx.reply("• رد على المستخدم");

  if (myRank(ctx) < 3)
    return ctx.reply("• الصلاحية تبدأ من المالك الأساسي");

  if (!canManage(ctx, target))
    return ctx.reply("• لا يمكنك تقييد هذا المستخدم");

  try {
    await restrictUser(ctx, target);

    getGroup(ctx).restricted[
      String(target.id)
    ] = {
      time: Date.now()
    };

    saveData();

    await ctx.reply("• تم تقييد المستخدم");
  } catch {
    await ctx.reply("• تعذر تقييد المستخدم");
  }
});

bot.hears(
  /^(الغاء التقييد|إلغاء التقييد|رفع القيود)$/i,
  async ctx => {
    const target = getTarget(ctx);

    if (!target)
      return ctx.reply("• رد على المستخدم");

    if (myRank(ctx) < 3)
      return ctx.reply(
        "• الصلاحية تبدأ من المالك الأساسي"
      );

    try {
      await unrestrictUser(ctx, target);

      delete getGroup(ctx).restricted[
        String(target.id)
      ];

      saveData();

      await ctx.reply(
        "• تم إلغاء التقييد"
      );
    } catch {
      await ctx.reply(
        "• تعذر إلغاء التقييد"
      );
    }
  }
);

bot.hears("مق", async ctx => {
  if (myRank(ctx) < 6) {
    return ctx.reply(
      "• عرض المقيدين للـ Dev² فأعلى"
    );
  }

  const group = getGroup(ctx);
  const ids = Object.keys(group.restricted);

  if (!ids.length) {
    return ctx.reply(
      "• لا يوجد مقيدين"
    );
  }

  await ctx.reply(
    "• المقيدين:\n\n" +
    ids.map(
      (id, i) =>
        `${i + 1}. <a href="tg://user?id=${id}">المستخدم</a>`
    ).join("\n"),
    { parse_mode: "HTML" }
  );
});

/* =========================================================
   الحظر والطرد
========================================================= */

bot.hears("حظر", async ctx => {
  const target = getTarget(ctx);

  if (!target)
    return ctx.reply("• رد على المستخدم");

  if (myRank(ctx) < 3)
    return ctx.reply("• الصلاحية تبدأ من المالك الأساسي");

  if (!canManage(ctx, target))
    return ctx.reply("• لا يمكنك حظر هذا المستخدم");

  try {
    await ctx.telegram.banChatMember(
      ctx.chat.id,
      target.id
    );

    getGroup(ctx).banned[
      String(target.id)
    ] = Date.now();

    saveData();

    await ctx.reply("• تم حظر المستخدم");
  } catch {
    await ctx.reply("• تعذر حظر المستخدم");
  }
});

bot.hears("فك الحظر", async ctx => {
  const target = getTarget(ctx);

  if (!target)
    return ctx.reply("• رد على المستخدم");

  if (myRank(ctx) < 3)
    return ctx.reply("• الصلاحية تبدأ من المالك الأساسي");

  try {
    await ctx.telegram.unbanChatMember(
      ctx.chat.id,
      target.id,
      { only_if_banned: true }
    );

    delete getGroup(ctx).banned[
      String(target.id)
    ];

    saveData();

    await ctx.reply("• تم فك الحظر");
  } catch {
    await ctx.reply("• تعذر فك الحظر");
  }
});

bot.hears("طرد", async ctx => {
  const target = getTarget(ctx);

  if (!target)
    return ctx.reply("• رد على المستخدم");

  if (myRank(ctx) < 3)
    return ctx.reply("• الصلاحية تبدأ من المالك الأساسي");

  if (!canManage(ctx, target))
    return ctx.reply("• لا يمكنك طرد هذا المستخدم");

  try {
    await ctx.telegram.banChatMember(
      ctx.chat.id,
      target.id
    );

    await ctx.telegram.unbanChatMember(
      ctx.chat.id,
      target.id
    );

    await ctx.reply("• تم طرد المستخدم");
  } catch {
    await ctx.reply("• تعذر طرد المستخدم");
  }
});

/* =========================================================
   التحذيرات
========================================================= */

async function addWarning(ctx, target, reason = "مخالفة") {
  const group = getGroup(ctx);
  const id = String(target.id);

  group.warnings.users[id] ||= {
    count: 0,
    reasons: []
  };

  const record =
    group.warnings.users[id];

  record.count++;
  record.reasons.push({
    reason,
    time: Date.now()
  });

  saveData();

  if (
    record.count >= 3 &&
    group.warnings.autoMute
  ) {
    try {
      await restrictUser(ctx, target);
      group.muted[id] = {
        time: Date.now()
      };
    } catch {}
  }

  if (
    record.count >= 5 &&
    group.warnings.autoBan
  ) {
    try {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        target.id
      );
    } catch {}
  }

  saveData();

  return record.count;
}

bot.hears(
  /^(تحذير|انذار|إنذار)$/i,
  async ctx => {
    const target = getTarget(ctx);

    if (!target)
      return ctx.reply("• رد على المستخدم");

    if (myRank(ctx) < 4)
      return ctx.reply(
        "• التحذير يبدأ من Myth"
      );

    if (!canManage(ctx, target))
      return ctx.reply(
        "• لا يمكنك تحذير هذا المستخدم"
      );

    const count =
      await addWarning(
        ctx,
        target
      );

    await ctx.reply(
      `• تم تحذير ${target.first_name || "المستخدم"}\n• التحذير: ${count}/3`
    );
  }
);

bot.hears(
  /^(إلغاء التحذير|الغاء التحذير)$/i,
  async ctx => {
    const target = getTarget(ctx);

    if (!target)
      return ctx.reply("• رد على المستخدم");

    if (myRank(ctx) < 4)
      return ctx.reply(
        "• الصلاحية تبدأ من Myth"
      );

    const group = getGroup(ctx);

    delete group.warnings.users[
      String(target.id)
    ];

    saveData();

    await ctx.reply(
      "• تم إلغاء تحذيرات المستخدم"
    );
  }
);

/* =========================================================
   فتح وغلق المخالفات
========================================================= */

bot.hears(
  /^(فتح المخالفات|فتح مخالفات)$/i,
  async ctx => {
    if (myRank(ctx) < 6)
      return ctx.reply(
        "• هذا الأمر للـ Dev² فأعلى"
      );

    const group = getGroup(ctx);

    group.violations.enabled = true;
    group.protection.enabled = true;

    saveData();

    await ctx.reply(
      "• تم فتح نظام المخالفات والحماية"
    );
  }
);

bot.hears(
  /^(غلق المخالفات|قفل المخالفات|غلق مخالفات|قفل مخالفات)$/i,
  async ctx => {
    if (myRank(ctx) < 6)
      return ctx.reply(
        "• هذا الأمر للـ Dev² فأعلى"
      );

    const group = getGroup(ctx);

    group.violations.enabled = false;
    group.protection.enabled = false;

    saveData();

    await ctx.reply(
      "• تم غلق نظام المخالفات والحماية"
    );
  }
);

/* =========================================================
   الروابط
========================================================= */

bot.hears("فتح الروابط", async ctx => {
  if (myRank(ctx) < 4)
    return ctx.reply("• الصلاحية تبدأ من Myth");

  const group = getGroup(ctx);

  group.protection.links = false;

  saveData();

  await ctx.reply("• تم فتح الروابط");
});

bot.hears("قفل الروابط", async ctx => {
  if (myRank(ctx) < 4)
    return ctx.reply("• الصلاحية تبدأ من Myth");

  const group = getGroup(ctx);

  group.protection.links = true;

  saveData();

  await ctx.reply("• تم قفل الروابط");
});

/* =========================================================
   المنشن
========================================================= */

bot.hears("فتح المنشن", async ctx => {
  if (myRank(ctx) < 4)
    return ctx.reply("• الصلاحية تبدأ من Myth");

  getGroup(ctx).protection.mentions = false;

  saveData();

  await ctx.reply("• تم فتح المنشن");
});

bot.hears("غلق المنشن", async ctx => {
  if (myRank(ctx) < 4)
    return ctx.reply("• الصلاحية تبدأ من Myth");

  getGroup(ctx).protection.mentions = true;

  saveData();

  await ctx.reply("• تم غلق المنشن");
});

bot.hears("@all", async ctx => {
  if (!isGroup(ctx)) return;

  if (myRank(ctx) < 4)
    return ctx.reply("• الصلاحية تبدأ من Myth");

  const group = getGroup(ctx);

  if (!group.mentions.enabled)
    return ctx.reply("• المنشن مغلق");

  const members =
    Object.values(group.members);

  if (!members.length)
    return ctx.reply("• لا يوجد أعضاء محفوظون");

  let text = "• منشن الأعضاء:\n\n";

  members
    .slice(0, 100)
    .forEach((member, i) => {
      text +=
        `${mention(member)} `;

      if ((i + 1) % 5 === 0) {
        text += "\n";
      }
    });

  await ctx.replyWithHTML(text);
});

/* =========================================================
   الكلمات الممنوعة
========================================================= */

bot.hears(
  /^منع الكلمه (.+)$/i,
  async ctx => {
    if (myRank(ctx) < 6)
      return ctx.reply(
        "• هذا الأمر للـ Dev² فأعلى"
      );

    const word = clean(ctx.match[1]);
    const group = getGroup(ctx);

    if (!word)
      return ctx.reply("• اكتب الكلمة");

    if (!group.forbiddenWords.includes(word)) {
      group.forbiddenWords.push(word);
    }

    saveData();

    await ctx.reply(
      `• تم منع الكلمة: ${word}`
    );
  }
);

bot.hears(
  /^الغاء منع الكلمه (.+)$/i,
  async ctx => {
    if (myRank(ctx) < 6)
      return ctx.reply(
        "• هذا الأمر للـ Dev² فأعلى"
      );

    const word = clean(ctx.match[1]);
    const group = getGroup(ctx);

    group.forbiddenWords =
      group.forbiddenWords.filter(
        x =>
          x.toLowerCase() !==
          word.toLowerCase()
      );

    saveData();

    await ctx.reply(
      `• تم إلغاء منع الكلمة: ${word}`
    );
  }
);

bot.hears(
  "الكلمات الممنوعه",
  async ctx => {
    const group = getGroup(ctx);

    if (!group.forbiddenWords.length)
      return ctx.reply(
        "• لا توجد كلمات ممنوعة"
      );

    await ctx.reply(
      "• الكلمات الممنوعة:\n\n" +
      group.forbiddenWords
        .map(
          (x, i) =>
            `${i + 1}. ${x}`
        )
        .join("\n")
    );
  }
);

bot.hears(
  "مسح الكلمات الممنوعه",
  async ctx => {
    if (myRank(ctx) < 6)
      return ctx.reply(
        "• هذا الأمر للـ Dev² فأعلى"
      );

    getGroup(ctx).forbiddenWords = [];

    saveData();

    await ctx.reply(
      "• تم مسح الكلمات الممنوعة"
    );
  }
);

/* =========================================================
   الألقاب
========================================================= */

bot.hears(
  /^ضع (.+)$/i,
  async ctx => {
    if (myRank(ctx) < 4)
      return ctx.reply(
        "• الألقاب تبدأ من Myth"
      );

    const target = getTarget(ctx);

    if (!target)
      return ctx.reply(
        "• رد على المستخدم"
      );

    if (!canManage(ctx, target))
      return ctx.reply(
        "• لا يمكنك وضع لقب لهذا المستخدم"
      );

    const title = clean(ctx.match[1]);

    getUser(target.id, target).title = title;

    saveData();

    await ctx.reply(
      `• تم وضع اللقب: ${title}`
    );
  }
);

bot.hears("لقبي", async ctx => {
  const user = getUser(
    ctx.from.id,
    ctx.from
  );

  await ctx.reply(
    `• لقبك: ${user.title || "لا يوجد"}`
  );
});

bot.hears("لقبه", async ctx => {
  const target = getTarget(ctx);

  if (!target)
    return ctx.reply(
      "• رد على المستخدم"
    );

  const user = getUser(
    target.id,
    target
  );

  await ctx.reply(
    `• لقبه: ${user.title || "لا يوجد"}`
  );
});

/* =========================================================
   تنظيف
========================================================= */

bot.hears("تنظيف", async ctx => {
  if (myRank(ctx) < 5)
    return ctx.reply(
      "• التنظيف يبدأ من Myth 🎖️"
    );

  await ctx.reply(
    "• تم تشغيل تنظيف الكل\n• حذف الرسائل القديمة بالكامل يحتاج إلى أن تكون الرسائل قابلة للوصول من تيليجرام"
  );
});

for (let i = 0; i <= 9; i++) {
  bot.hears(
    `تنظيف ${i}`,
    async ctx => {
      if (myRank(ctx) < 5)
        return ctx.reply(
          "• التنظيف يبدأ من Myth 🎖️"
        );

      const names = {
        0: "الرسائل",
        1: "الصور",
        2: "الفيديو",
        3: "الملفات",
        4: "الملصقات",
        5: "GIF",
        6: "الصوت",
        7: "البصمات",
        8: "الروابط",
        9: "الكل"
      };

      await ctx.reply(
        `• تم تشغيل تنظيف ${names[i]}`
      );
    }
  );
}

bot.hears(
  "تفعيل التنظيف التلقائي",
  async ctx => {
    if (myRank(ctx) < 5)
      return ctx.reply(
        "• التنظيف يبدأ من Myth 🎖️"
      );

    getGroup(ctx).cleaning.automatic = true;

    saveData();

    await ctx.reply(
      "• تم تفعيل التنظيف التلقائي"
    );
  }
);

bot.hears(
  "تعطيل التنظيف التلقائي",
  async ctx => {
    if (myRank(ctx) < 5)
      return ctx.reply(
        "• التنظيف يبدأ من Myth 🎖️"
      );

    getGroup(ctx).cleaning.automatic = false;

    saveData();

    await ctx.reply(
      "• تم تعطيل التنظيف التلقائي"
    );
  }
);

/* =========================================================
   المشرفين
========================================================= */

async function promoteAdmin(ctx) {
  const target = getTarget(ctx);

  if (!target)
    return ctx.reply(
      "• رد على المستخدم"
    );

  if (myRank(ctx) < 7)
    return ctx.reply(
      "• للـ Dev🎖️ فقط"
    );

  if (!canManage(ctx, target))
    return ctx.reply(
      "• لا يمكنك ترقية هذا المستخدم"
    );

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
        can_change_info: true,
        can_invite_users: true,
        can_pin_messages: true,
        can_manage_topics: true
      }
    );

    await ctx.reply(
      "• تم رفع المستخدم مشرفًا"
    );
  } catch {
    await ctx.reply(
      "• تعذر رفع المشرف\n• تأكد من صلاحيات البوت"
    );
  }
}

bot.hears(
  "رفع مشرف",
  promoteAdmin
);

bot.hears(
  "ترقيه",
  promoteAdmin
);

async function demoteAdmin(ctx) {
  const target = getTarget(ctx);

  if (!target)
    return ctx.reply(
      "• رد على المستخدم"
    );

  if (myRank(ctx) < 7)
    return ctx.reply(
      "• للـ Dev🎖️ فقط"
    );

  if (isOwner(target))
    return ctx.reply(
      "• لا يمكن تنزيل المالك الأساسي"
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

    await ctx.reply(
      "• تم تنزيل المشرف"
    );
  } catch {
    await ctx.reply(
      "• تعذر تنزيل المشرف"
    );
  }
}

bot.hears(
  "تنزيل مشرف",
  demoteAdmin
);

bot.hears(
  "تنزيل المشرف",
  demoteAdmin
);

/* =========================================================
   الصلاحيات
========================================================= */

function permissionText(m) {
  const list = [];

  if (m.status === "creator")
    list.push("مالك المجموعة");

  if (m.status === "administrator") {
    if (m.can_delete_messages)
      list.push("حذف الرسائل");

    if (m.can_restrict_members)
      list.push("تقييد الأعضاء");

    if (m.can_promote_members)
      list.push("إضافة مشرفين");

    if (m.can_change_info)
      list.push("تغيير المعلومات");

    if (m.can_invite_users)
      list.push("دعوة الأعضاء");

    if (m.can_pin_messages)
      list.push("تثبيت الرسائل");

    if (m.can_manage_video_chats)
      list.push("إدارة المحادثات الصوتية");
  }

  return list.length
    ? "• الصلاحيات:\n\n" +
        list.map(x => `• ${x}`).join("\n")
    : "• لا توجد صلاحيات إدارية";
}

bot.hears("صلاحياتي", async ctx => {
  try {
    const member =
      await ctx.telegram.getChatMember(
        ctx.chat.id,
        ctx.from.id
      );

    await ctx.reply(
      permissionText(member)
    );
  } catch {
    await ctx.reply(
      "• تعذر معرفة الصلاحيات"
    );
  }
});

bot.hears(
  /^(صلاحياته|صلاحيات المستخدم)$/,
  async ctx => {
    const target = getTarget(ctx);

    if (!target)
      return ctx.reply(
        "• رد على المستخدم"
      );

    try {
      const member =
        await ctx.telegram.getChatMember(
          ctx.chat.id,
          target.id
        );

      await ctx.reply(
        permissionText(member)
      );
    } catch {
      await ctx.reply(
        "• تعذر معرفة الصلاحيات"
      );
    }
  }
);

/* =========================================================
   الهمسات
========================================================= */

const whispers = new Map();

function whisperId() {
  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2, 8)
  );
}

async function createWhisper(ctx) {
  const target = getTarget(ctx);

  if (!target)
    return ctx.reply(
      "• يجب أن تبدأ الهمسة بالرد على المستخدم"
    );

  const id = whisperId();

  whispers.set(id, {
    sender: ctx.from.id,
    receiver: target.id,
    chat: ctx.chat.id,
    messageId: ctx.message.message_id,
    content: null,
    type: null,
    viewed: false,
    replied: false
  });

  const botInfo =
    await ctx.telegram.getMe();

  const viewLink =
    `https://t.me/${botInfo.username}?start=whisper_${id}`;

  const replyLink =
    `https://t.me/${botInfo.username}?start=whisperreply_${id}`;

  await ctx.reply(
    `• ${mention(target)} لديك همسة خاصة`,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            "رؤية الهمسة",
            viewLink
          ),
          Markup.button.url(
            "رد على الهمسة",
            replyLink
          )
        ]
      ])
    }
  );

  await ctx.reply(
    "• أرسل الآن محتوى الهمسة في الخاص مع البوت"
  );

  const session = whispers.get(id);
  session.waiting = true;
  session.waitingFrom = ctx.from.id;
}

bot.hears(
  /^(اهمس|همسه|ه)$/i,
  createWhisper
);

async function handleWhisperOpen(
  ctx,
  payload
) {
  const id =
    payload.replace("whisper_", "");

  const whisper =
    whispers.get(id);

  if (!whisper)
    return ctx.reply(
      "• الهمسة غير موجودة أو انتهت"
    );

  if (
    ctx.from.id !== whisper.receiver
  ) {
    return ctx.reply(
      "• هذه الهمسة ليست لك"
    );
  }

  whisper.viewed = true;

  if (!whisper.content) {
    return ctx.reply(
      "• لم يتم إرسال محتوى الهمسة بعد"
    );
  }

  await sendWhisperContent(
    ctx,
    whisper
  );

  try {
    await bot.telegram.sendMessage(
      whisper.sender,
      "• تم فتح همستك من المستلم"
    );
  } catch {}
}

async function handleWhisperReply(
  ctx,
  payload
) {
  const id =
    payload.replace(
      "whisperreply_",
      ""
    );

  const whisper =
    whispers.get(id);

  if (!whisper)
    return ctx.reply(
      "• الهمسة غير موجودة"
    );

  if (
    ctx.from.id !== whisper.receiver
  ) {
    return ctx.reply(
      "• هذه الهمسة ليست لك"
    );
  }

  await ctx.reply(
    "• أرسل ردك الآن في الخاص"
  );

  whisper.replying = true;
}

async function sendWhisperContent(
  ctx,
  whisper
) {
  if (!whisper.content) return;

  if (whisper.type === "text") {
    return ctx.reply(
      `• همستك:\n\n${whisper.content}`
    );
  }

  if (whisper.type === "photo") {
    return ctx.replyWithPhoto(
      whisper.content,
      {
        caption:
          whisper.caption || ""
      }
    );
  }

  if (whisper.type === "video") {
    return ctx.replyWithVideo(
      whisper.content,
      {
        caption:
          whisper.caption || ""
      }
    );
  }

  if (whisper.type === "document") {
    return ctx.replyWithDocument(
      whisper.content
    );
  }

  if (whisper.type === "sticker") {
    return ctx.replyWithSticker(
      whisper.content
    );
  }

  if (whisper.type === "animation") {
    return ctx.replyWithAnimation(
      whisper.content,
      {
        caption:
          whisper.caption || ""
      }
    );
  }

  if (whisper.type === "audio") {
    return ctx.replyWithAudio(
      whisper.content
    );
  }

  if (whisper.type === "voice") {
    return ctx.replyWithVoice(
      whisper.content
    );
  }
}

/* =========================================================
   الأوامر المخصصة
========================================================= */

bot.hears(
  /^اضف امر (.+)$/i,
  async ctx => {
    if (myRank(ctx) < 6)
      return ctx.reply(
        "• للـ Dev² فأعلى"
      );

    const name = clean(ctx.match[1]);

    getGroup(ctx).customCommands[
      name
    ] = "";

    saveData();

    await ctx.reply(
      `• تم إضافة الأمر: ${name}\n• أرسل الرد الآن باستخدام:\nاضف رد ${name}`
    );
  }
);

bot.hears(
  /^اضف رد (.+)$/i,
  async ctx => {
    if (myRank(ctx) < 6)
      return ctx.reply(
        "• للـ Dev² فأعلى"
      );

    const name = clean(ctx.match[1]);

    getGroup(ctx).customReplies[
      name
    ] = "";

    saveData();

    await ctx.reply(
      `• تم إنشاء الرد: ${name}\n• اكتب ${name} ثم الرد المطلوب`
    );
  }
);

bot.hears(
  /^حذف امر (.+)$/i,
  async ctx => {
    if (myRank(ctx) < 6)
      return ctx.reply(
        "• للـ Dev² فأعلى"
      );

    delete getGroup(ctx).customCommands[
      clean(ctx.match[1])
    ];

    saveData();

    await ctx.reply(
      "• تم حذف الأمر"
    );
  }
);

bot.hears(
  /^حذف رد (.+)$/i,
  async ctx => {
    if (myRank(ctx) < 6)
      return ctx.reply(
        "• للـ Dev² فأعلى"
      );

    delete getGroup(ctx).customReplies[
      clean(ctx.match[1])
    ];

    saveData();

    await ctx.reply(
      "• تم حذف الرد"
    );
  }
);

bot.hears("اوامري", async ctx => {
  const commands =
    Object.keys(
      getGroup(ctx).customCommands
    );

  await ctx.reply(
    commands.length
      ? "• أوامرك:\n\n" +
        commands.map(
          (x, i) =>
            `${i + 1}. ${x}`
        ).join("\n")
      : "• لا توجد أوامر مخصصة"
  );
});

bot.hears("ردودي", async ctx => {
  const replies =
    Object.keys(
      getGroup(ctx).customReplies
    );

  await ctx.reply(
    replies.length
      ? "• ردودك:\n\n" +
        replies.map(
          (x, i) =>
            `${i + 1}. ${x}`
        ).join("\n")
      : "• لا توجد ردود"
  );
});

/* =========================================================
   الاقتصاد
========================================================= */

function balanceOf(ctx, id) {
  const user = getUser(id);

  return (
    Number(user.balance || 0) +
    Number(user.bank || 0)
  );
}

bot.hears("فلوسي", async ctx => {
  const user = getUser(
    ctx.from.id,
    ctx.from
  );

  await ctx.reply(
    `• رصيدك:\n• الكاش: ${user.balance}\n• البنك: ${user.bank}\n• الإجمالي: ${balanceOf(ctx, ctx.from.id)}`
  );
});

bot.hears("فلوسه", async ctx => {
  const target = getTarget(ctx);

  if (!target)
    return ctx.reply(
      "• رد على المستخدم"
    );

  const user = getUser(
    target.id,
    target
  );

  await ctx.reply(
    `• رصيده: ${balanceOf(ctx, target.id)}`
  );
});

bot.hears(
  "انشاء حساب بنكي",
  async ctx => {
    if (!data.bot.bank)
      return ctx.reply(
        "• البنك معطل"
      );

    const user = getUser(
      ctx.from.id,
      ctx.from
    );

    if (user.bankAccount)
      return ctx.reply(
        "• لديك حساب بنكي بالفعل"
      );

    user.bankAccount = true;
    user.bankName = "البنك الأول";

    saveData();

    await ctx.reply(
      "• تم إنشاء حسابك البنكي"
    );
  }
);

bot.hears("حسابي", async ctx => {
  const user = getUser(
    ctx.from.id,
    ctx.from
  );

  await ctx.reply(
    `• حسابك البنكي:\n\n• البنك: ${
      user.bankName || "غير منشأ"
    }\n• الرصيد: ${user.bank}`
  );
});

bot.hears(
  /^اهداء (\d+)$/,
  async ctx => {
    const target = getTarget(ctx);

    if (!target)
      return ctx.reply(
        "• رد على المستخدم"
      );

    const amount =
      Number(ctx.match[1]);

    const sender = getUser(
      ctx.from.id,
      ctx.from
    );

    if (sender.balance < amount)
      return ctx.reply(
        "• رصيدك غير كافٍ"
      );

    sender.balance -= amount;

    const receiver = getUser(
      target.id,
      target
    );

    receiver.balance += amount;

    saveData();

    await ctx.reply(
      `• تم إهداء ${amount} للمستخدم`
    );
  }
);

bot.hears(
  "حذف حسابي",
  async ctx => {
    const user = getUser(
      ctx.from.id,
      ctx.from
    );

    user.bank = 0;
    user.bankAccount = false;
    user.bankName = "";

    saveData();

    await ctx.reply(
      "• تم حذف حسابك البنكي"
    );
  }
);

bot.hears("المتجر", async ctx => {
  await ctx.reply(
    "• المتجر\n\n• لا توجد منتجات مضافة حاليًا"
  );
});

/* =========================================================
   الألعاب
========================================================= */

bot.hears(
  /^(قفل الالعاب|قفل الألعاب)$/,
  async ctx => {
    if (myRank(ctx) < 7)
      return ctx.reply(
        "• للـ Dev🎖️ فقط"
      );

    getGroup(ctx).games.enabled =
      false;

    saveData();

    await ctx.reply(
      "• تم قفل الألعاب"
    );
  }
);

bot.hears(
  /^(فتح الالعاب|فتح الألعاب)$/,
  async ctx => {
    if (myRank(ctx) < 7)
      return ctx.reply(
        "• للـ Dev🎖️ فقط"
      );

    getGroup(ctx).games.enabled =
      true;

    saveData();

    await ctx.reply(
      "• تم فتح الألعاب"
    );
  }
);

bot.hears("احكام", async ctx => {
  const group = getGroup(ctx);

  if (!group.games.enabled)
    return ctx.reply(
      "• الألعاب مقفلة"
    );

  if (myRank(ctx) < 7)
    return ctx.reply(
      "• بدء أحكام للـ Dev🎖️ فقط"
    );

  if (group.games.active)
    return ctx.reply(
      "• توجد فعالية أحكام بالفعل"
    );

  group.games.active = {
    type: "احكام",
    owner: ctx.from.id,
    players: [],
    registered: true,
    round: 0
  };

  saveData();

  await ctx.reply(
    "• بدأت لعبة أحكام\n• اكتب أنا للدخول\n• اكتب نعم لإنهاء التسجيل"
  );
});

bot.hears("أنا", async ctx => {
  const game =
    getGroup(ctx).games.active;

  if (!game)
    return;

  if (!game.registered)
    return;

  if (
    !game.players.includes(
      ctx.from.id
    )
  ) {
    game.players.push(
      ctx.from.id
    );

    saveData();

    await ctx.reply(
      `• تم تسجيلك\n• عدد اللاعبين: ${game.players.length}`
    );
  }
});

bot.hears("نعم", async ctx => {
  const group = getGroup(ctx);
  const game = group.games.active;

  if (!game)
    return;

  if (
    game.owner !== ctx.from.id &&
    myRank(ctx) < 7
  ) {
    return;
  }

  if (game.players.length < 2)
    return ctx.reply(
      "• يجب وجود لاعبين على الأقل"
    );

  game.registered = false;
  game.round++;

  const judge =
    game.players[
      Math.floor(
        Math.random() *
        game.players.length
      )
    ];

  let target =
    game.players[
      Math.floor(
        Math.random() *
        game.players.length
      )
    ];

  while (
    target === judge &&
    game.players.length > 1
  ) {
    target =
      game.players[
        Math.floor(
          Math.random() *
          game.players.length
        )
      ];
  }

  game.judge = judge;
  game.target = target;

  saveData();

  await ctx.reply(
    `• الجولة ${game.round}\n• الحكم: <a href="tg://user?id=${judge}">الحكم</a>\n• المطلوب منه تنفيذ الحكم على <a href="tg://user?id=${target}">اللاعب</a>`,
    { parse_mode: "HTML" }
  );
});

bot.hears(
  "انهاء احكام",
  async ctx => {
    const group = getGroup(ctx);
    const game = group.games.active;

    if (!game)
      return ctx.reply(
        "• لا توجد لعبة"
      );

    if (
      game.owner !== ctx.from.id &&
      myRank(ctx) < 7
    ) {
      return ctx.reply(
        "• مالك اللعبة فقط يستطيع إنهاءها"
      );
    }

    group.games.active = null;

    saveData();

    await ctx.reply(
      "• تم إنهاء أحكام"
    );
  }
);

/* =========================================================
   البحث عن الأغاني
========================================================= */

async function searchSongs(ctx, query) {
  query = clean(query);

  if (!query)
    return ctx.reply(
      "• اكتب اسم الأغنية"
    );

  try {
    const result =
      await ytSearch(query);

    const videos =
      result.videos.slice(0, 5);

    if (!videos.length)
      return ctx.reply(
        "• لم أجد نتائج"
      );

    const buttons =
      videos.map((video, i) => [
        Markup.button.callback(
          `${i + 1}. ${video.title.slice(0, 35)}`,
          `song_select:${encodeURIComponent(video.videoId)}`
        )
      ]);

    await ctx.reply(
      videos.map(
        (v, i) =>
          `${i + 1}. ${v.title}\n• ${v.author?.name || "غير معروف"}\n• ${v.timestamp || "غير معروف"}`
      ).join("\n\n"),
      Markup.inlineKeyboard(buttons)
    );
  } catch (e) {
    console.error("YT SEARCH:", e);

    await ctx.reply(
      "• تعذر البحث عن الأغنية"
    );
  }
}

bot.hears(
  /^(بحث|بحث أغنية|اغنية|أغنية|شغل|تشغيل) (.+)$/i,
  async ctx => {
    await searchSongs(
      ctx,
      ctx.match[2]
    );
  }
);

bot.action(
  /^song_select:(.+)$/i,
  async ctx => {
    const id =
      decodeURIComponent(ctx.match[1]);

    try {
      const result =
        await ytSearch({
          videoId: id
        });

      const video =
        result.videos?.[0];

      if (!video) {
        return ctx.answerCbQuery(
          "الأغنية غير موجودة"
        );
      }

      const group = getGroup(ctx);

      group.music.queue.push({
        id: video.videoId,
        title: video.title,
        artist:
          video.author?.name || "",
        duration:
          video.timestamp || "",
        url: video.url,
        requestedBy:
          ctx.from.id
      });

      saveData();

      await ctx.answerCbQuery(
        "تمت الإضافة للطابور"
      );

      await ctx.reply(
        `• تمت إضافة الأغنية للطابور\n\n• ${video.title}\n• الفنان: ${video.author?.name || "غير معروف"}\n• المدة: ${video.timestamp || "غير معروفة"}`
      );
    } catch {
      await ctx.answerCbQuery(
        "حدث خطأ"
      );
    }
  }
);

bot.hears(
  "الطابور",
  async ctx => {
    const queue =
      getGroup(ctx).music.queue;

    if (!queue.length)
      return ctx.reply(
        "• الطابور فارغ"
      );

    await ctx.reply(
      "• طابور الأغاني:\n\n" +
      queue.map(
        (s, i) =>
          `${i + 1}. ${s.title}`
      ).join("\n")
    );
  }
);

bot.hears(
  "مسح الطابور",
  async ctx => {
    getGroup(ctx).music.queue = [];

    saveData();

    await ctx.reply(
      "• تم مسح الطابور"
    );
  }
);

bot.hears(
  "الغاء التشغيل",
  async ctx => {
    const group = getGroup(ctx);

    group.music.playing = false;
    group.music.current = null;
    group.music.queue = [];

    saveData();

    await ctx.reply(
      "• تم إلغاء التشغيل"
    );
  }
);

bot.hears(
  "ايقاف",
  async ctx => {
    getGroup(ctx).music.playing =
      false;

    saveData();

    await ctx.reply(
      "• تم إيقاف التشغيل"
    );
  }
);

bot.hears(
  "استئناف",
  async ctx => {
    getGroup(ctx).music.playing =
      true;

    saveData();

    await ctx.reply(
      "• تم استئناف التشغيل"
    );
  }
);

bot.hears(
  "تخطي",
  async ctx => {
    const group = getGroup(ctx);

    group.music.queue.shift();

    group.music.current =
      group.music.queue[0] || null;

    saveData();

    await ctx.reply(
      "• تم تخطي الأغنية"
    );
  }
);

/* =========================================================
   الإذاعة
========================================================= */

bot.hears("إذاعة", async ctx => {
  if (myRank(ctx) < 7)
    return ctx.reply(
      "• الإذاعة للـ Dev🎖️ فقط"
    );

  const text =
    ctx.message.reply_to_message
      ? getMessageText({
          message:
            ctx.message.reply_to_message
        })
      : "";

  if (!text) {
    return ctx.reply(
      "• استخدم إذاعة بالرد على رسالة"
    );
  }

  let sent = 0;
  let failed = 0;

  for (
    const userId of data.subscribers
  ) {
    try {
      await ctx.telegram.copyMessage(
        userId,
        ctx.chat.id,
        ctx.message.reply_to_message.message_id
      );

      sent++;
    } catch {
      failed++;
    }
  }

  await ctx.reply(
    `• انتهت الإذاعة\n• تم الإرسال: ${sent}\n• فشل: ${failed}`
  );
});

/* =========================================================
   القنوات
========================================================= */

bot.hears(
  "اضف قناة",
  async ctx => {
    if (myRank(ctx) < 6)
      return ctx.reply(
        "• هذا الأمر للـ Dev² فأعلى"
      );

    getGroup(ctx).channel = {
      owner: ctx.from.id,
      username: "",
      title: ""
    };

    saveData();

    await ctx.reply(
      "• تم إنشاء إعداد القناة\n• أرسل معرف القناة بعد ذلك"
    );
  }
);

bot.hears(
  "قناتي",
  async ctx => {
    const channel =
      getGroup(ctx).channel;

    if (!channel)
      return ctx.reply(
        "• لا توجد قناة مرتبطة"
      );

    await ctx.reply(
      `• القناة: ${
        channel.username || "غير محددة"
      }`
    );
  }
);

bot.hears(
  "حذف قناتي",
  async ctx => {
    if (myRank(ctx) < 6)
      return ctx.reply(
        "• هذا الأمر للـ Dev² فأعلى"
      );

    getGroup(ctx).channel = null;

    saveData();

    await ctx.reply(
      "• تم حذف القناة"
    );
  }
);

bot.hears(
  "تعديل قناتي",
  async ctx => {
    if (myRank(ctx) < 6)
      return ctx.reply(
        "• هذا الأمر للـ Dev² فأعلى"
      );

    await ctx.reply(
      "• أرسل بيانات القناة الجديدة في رسالة لاحقة"
    );
  }
);

/* =========================================================
   قفل القروب
========================================================= */

bot.hears(
  /^(قفل القروب|قفل القروب)$/i,
  async ctx => {
    if (myRank(ctx) < 6)
      return ctx.reply(
        "• للـ Dev² فأعلى"
      );

    try {
      await ctx.telegram.setChatPermissions(
        ctx.chat.id,
        {
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
      );

      getGroup(ctx).settings.chatLocked =
        true;

      saveData();

      await ctx.reply(
        "• تم قفل القروب"
      );
    } catch {
      await ctx.reply(
        "• تعذر قفل القروب"
      );
    }
  }
);

bot.hears(
  "فتح القروب",
  async ctx => {
    if (myRank(ctx) < 6)
      return ctx.reply(
        "• للـ Dev² فأعلى"
      );

    try {
      await ctx.telegram.setChatPermissions(
        ctx.chat.id,
        {
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
          can_change_info: true,
          can_invite_users: true,
          can_pin_messages: true
        }
      );

      getGroup(ctx).settings.chatLocked =
        false;

      saveData();

      await ctx.reply(
        "• تم فتح القروب"
      );
    } catch {
      await ctx.reply(
        "• تعذر فتح القروب"
      );
    }
  }
);

/* =========================================================
   حالة البوت
========================================================= */

bot.hears(
  "حالة البوت",
  async ctx => {
    if (myRank(ctx) < 6)
      return ctx.reply(
        "• للـ Dev² فأعلى"
      );

    const users =
      Object.keys(data.users).length;

    const groups =
      Object.keys(data.groups).length;

    await ctx.reply(
      `• حالة البوت\n\n` +
      `• الحالة: ${
        data.bot.enabled
          ? "يعمل"
          : "متوقف"
      }\n` +
      `• المستخدمون: ${users}\n` +
      `• المجموعات: ${groups}\n` +
      `• المشتركين: ${data.subscribers.length}`
    );
  }
);

/* =========================================================
   إحصائيات
========================================================= */

bot.hears(
  "احصائيات",
  async ctx => {
    if (myRank(ctx) < 6)
      return ctx.reply(
        "• للـ Dev² فأعلى"
      );

    await ctx.reply(
      `• الإحصائيات\n\n• المستخدمون: ${
        Object.keys(data.users).length
      }\n• المجموعات: ${
        Object.keys(data.groups).length
      }\n• المشتركين: ${
        data.subscribers.length
      }`
    );
  }
);

/* =========================================================
   أوامر المطور المختصرة
========================================================= */

const DEV_SHORTCUTS = {
  "ا": "الإعدادات",
  "ت": "التطوير",
  "ق": "القروبات",
  "م": "المستخدمين",
  "ن": "الرتب",
  "ح": "الحماية",
  "د": "الإحصائيات"
};

for (const [cmd, title] of Object.entries(
  DEV_SHORTCUTS
)) {
  bot.hears(cmd, async ctx => {
    if (myRank(ctx) < 7)
      return;

    await ctx.reply(
      `• لوحة المطور\n• القسم: ${title}`
    );
  });
}

/* =========================================================
   أوامر
========================================================= */

bot.hears("اوامر", async ctx => {
  if (myRank(ctx) < 7)
    return ctx.reply(
      "• قائمة الأوامر للـ Dev🎖️ فقط"
    );

  await ctx.reply(
`• أوامر البوت

【 الرتب 】
رتبتي
رتبته
رفع مميز
رفع مالك
رفع مالك أساسي
رفع اساس
رفع Myth
رفع M
رفع My
رفع Myth 🎖️
رفع اكس
رفع Dev²
رفع مطور ثانوي
رفع ديف
تنزيل

【 الإدارة 】
كتم
كتم عام
عام
فك الكتم
فك الكتم العام
مم
خخ
تقييد
تق
مق
الغاء التقييد
رفع القيود
حظر
فك الحظر
طرد

【 التحذيرات 】
تحذير
انذار
إنذار
إلغاء التحذير

【 الحماية 】
فتح المخالفات
غلق المخالفات
قفل المخالفات
فتح الروابط
قفل الروابط
فتح المنشن
غلق المنشن
قفل القروب
فتح القروب
@all

【 التنظيف 】
تنظيف
تنظيف 0
تنظيف 1
تنظيف 2
تنظيف 3
تنظيف 4
تنظيف 5
تنظيف 6
تنظيف 7
تنظيف 8
تنظيف 9
مم
خخ
مق

【 الألقاب 】
ضع <اللقب>
لقبي
لقبه

【 الهمسات 】
اهمس
همسه
ه

【 الموسيقى 】
بحث <الأغنية>
بحث أغنية <الأغنية>
اغنية <الأغنية>
أغنية <الأغنية>
شغل <الأغنية>
تشغيل <الأغنية>
الطابور
تخطي
ايقاف
استئناف
الغاء التشغيل
مسح الطابور

【 الاقتصاد 】
فلوسي
فلوسه
المتجر
انشاء حساب بنكي
حسابي
اهداء <المبلغ>
حذف حسابي

【 الألعاب 】
احكام
أنا
نعم
انهاء احكام
قفل الالعاب
فتح الالعاب

【 المطور 】
المالك
إذاعة
حالة البوت
احصائيات
اضف قناة
قناتي
تعديل قناتي
حذف قناتي
رفع مشرف
ترقيه
تنزيل مشرف
تنزيل المشرف
صلاحياتي
صلاحياته
صلاحيات المستخدم
قفل امر <الأمر>
فتح امر <الأمر>`
  );
});

/* =========================================================
   معالجة الرسائل الخاصة بالهمسات
========================================================= */

bot.on("message", async ctx => {
  try {
    registerSubscriber(ctx);

    if (!ctx.from) return;

    addInteraction(ctx);

    /* -----------------------------------------
       الخاص: استقبال محتوى الهمسة
    ----------------------------------------- */

    if (
      ctx.chat?.type === "private"
    ) {
      for (
        const [id, whisper]
        of whispers
      ) {
        if (
          whisper.waiting &&
          whisper.waitingFrom ===
            ctx.from.id
        ) {
          const m = ctx.message;

          if (m.text) {
            whisper.content =
              m.text;
            whisper.type =
              "text";
          } else if (m.photo) {
            whisper.content =
              m.photo[
                m.photo.length - 1
              ].file_id;
            whisper.type =
              "photo";
            whisper.caption =
              m.caption || "";
          } else if (m.video) {
            whisper.content =
              m.video.file_id;
            whisper.type =
              "video";
            whisper.caption =
              m.caption || "";
          } else if (m.document) {
            whisper.content =
              m.document.file_id;
            whisper.type =
              "document";
          } else if (m.sticker) {
            whisper.content =
              m.sticker.file_id;
            whisper.type =
              "sticker";
          } else if (m.animation) {
            whisper.content =
              m.animation.file_id;
            whisper.type =
              "animation";
            whisper.caption =
              m.caption || "";
          } else if (m.audio) {
            whisper.content =
              m.audio.file_id;
            whisper.type =
              "audio";
          } else if (m.voice) {
            whisper.content =
              m.voice.file_id;
            whisper.type =
              "voice";
          }

          whisper.waiting = false;

          try {
            await ctx.reply(
              "• تم حفظ الهمسة وإرسالها للمستلم"
            );

            await bot.telegram.sendMessage(
              whisper.receiver,
              "• لديك همسة جديدة\n• افتحها من الزر الموجود في رسالة الهمسة"
            );
          } catch {}

          return;
        }

        if (
          whisper.replying &&
          whisper.receiver ===
            ctx.from.id
        ) {
          if (ctx.message.text) {
            try {
              await bot.telegram.sendMessage(
                whisper.sender,
                `• رد على همستك:\n\n${ctx.message.text}`
              );

              await ctx.reply(
                "• تم إرسال ردك"
              );
            } catch {
              await ctx.reply(
                "• تعذر إرسال الرد"
              );
            }
          }

          whisper.replying = false;
          return;
        }
      }
    }

    /* -----------------------------------------
       حماية المجموعة
    ----------------------------------------- */

    if (
      !isGroup(ctx) ||
      !ctx.message
    ) {
      return;
    }

    const group = getGroup(ctx);

    if (!group.protection.enabled)
      return;

    if (myRank(ctx) > 0)
      return;

    const text =
      ctx.message.text ||
      ctx.message.caption ||
      "";

    const hasLink =
      /https?:\/\/|www\.|t\.me\//i.test(
        text
      );

    const hasMention =
      /@[A-Za-z0-9_]{3,}/.test(
        text
      );

    const forbidden =
      group.forbiddenWords.find(
        word =>
          text
            .toLowerCase()
            .includes(
              word.toLowerCase()
            )
      );

    let reason = null;

    if (
      group.protection.links &&
      hasLink
    ) {
      reason = "رابط";
    }

    if (
      !reason &&
      group.protection.mentions &&
      hasMention
    ) {
      reason = "منشن";
    }

    if (
      !reason &&
      forbidden
    ) {
      reason =
        `كلمة ممنوعة: ${forbidden}`;
    }

    if (
      !reason &&
      group.protection.longMessages &&
      text.length > 700
    ) {
      reason = "رسالة طويلة";
    }

    if (
      !reason &&
      group.protection.phoneNumbers &&
      /\+?\d[\d\s-]{7,}\d/.test(text)
    ) {
      reason = "رقم جوال";
    }

    if (reason) {
      try {
        await ctx.deleteMessage();
      } catch {}

      const id =
        String(ctx.from.id);

      group.violations.users[id] ||=
        {
          count: 0,
          reasons: []
        };

      group.violations.users[id].count++;

      group.violations.users[id]
        .reasons.push({
          reason,
          time: Date.now()
        });

      const count =
        group.violations.users[id]
          .count;

      if (
        group.warnings.enabled &&
        count >= 3 &&
        group.warnings.autoMute
      ) {
        try {
          await restrictUser(
            ctx,
            ctx.from
          );

          group.muted[id] = {
            time: Date.now()
          };
        } catch {}
      }

      saveData();
    }
  } catch (error) {
    console.error(
      "MESSAGE ERROR:",
      error
    );
  }
});

/* =========================================================
   أزرار الهمسات والألعاب والأغاني
========================================================= */

bot.action(
  /^menu_(.+)$/i,
  async ctx => {
    const section = ctx.match[1];

    const names = {
      dev: "المطور",
      roles: "الرتب",
      protection: "الحماية",
      games: "الألعاب",
      music: "الموسيقى",
      custom: "الأوامر المخصصة",
      group: "المجموعة",
      home: "الرئيسية"
    };

    await ctx.answerCbQuery();

    await ctx.reply(
      `• قسم ${names[section] || section}`
    );
  }
);

/* =========================================================
   أوامر إدارة البيانات
========================================================= */

bot.hears(
  "تفعيل البوت",
  async ctx => {
    if (myRank(ctx) < 7) return;

    data.bot.enabled = true;
    saveData();

    await ctx.reply(
      "• تم تفعيل البوت"
    );
  }
);

bot.hears(
  "تعطيل البوت",
  async ctx => {
    if (myRank(ctx) < 7) return;

    data.bot.enabled = false;
    saveData();

    await ctx.reply(
      "• تم تعطيل البوت"
    );
  }
);

bot.hears(
  "تفعيل الردود",
  async ctx => {
    if (myRank(ctx) < 7) return;

    data.bot.replies = true;
    saveData();

    await ctx.reply(
      "• تم تفعيل الردود"
    );
  }
);

bot.hears(
  "تعطيل الردود",
  async ctx => {
    if (myRank(ctx) < 7) return;

    data.bot.replies = false;
    saveData();

    await ctx.reply(
      "• تم تعطيل الردود"
    );
  }
);

/* =========================================================
   المشرف وعضوية المجموعة
========================================================= */

bot.on("my_chat_member", async ctx => {
  try {
    const update =
      ctx.update.my_chat_member;

    const chat =
      update.chat;

    if (
      chat.type === "group" ||
      chat.type === "supergroup"
    ) {
      getGroup({
        chat,
        from:
          update.from
      });

      saveData();
    }
  } catch (e) {
    console.error(
      "MY_CHAT_MEMBER:",
      e
    );
  }
});

/* =========================================================
   خطأ عام
========================================================= */

bot.catch((error, ctx) => {
  console.error(
    "BOT ERROR:",
    error
  );

  try {
    if (ctx?.chat?.id) {
      ctx.telegram.sendMessage(
        ctx.chat.id,
        "• حدث خطأ مؤقت، حاول مرة أخرى"
      ).catch(() => {});
    }
  } catch {}
});

/* =========================================================
   تشغيل البوت
========================================================= */

(async () => {
  try {
    await bot.launch();

    console.log(
      "BOT STARTED SUCCESSFULLY"
    );
    console.log(
      `OWNER: @${OWNER_USERNAME}`
    );
  } catch (error) {
    console.error(
      "BOT START ERROR:",
      error
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
