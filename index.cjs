const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

/* =========================================================
   الإعدادات
========================================================= */

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN غير موجود في متغيرات البيئة');
}

const bot = new Telegraf(BOT_TOKEN);

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* =========================================================
   الرتب
========================================================= */

const ROLE_LEVEL = {
  'عضو': 0,
  'مميز': 1,
  'مالك': 2,
  'مالك أساسي': 3,
  'Myth': 4,
  'Myth🎖️': 5,
  'Dev²🎖️': 6,
  'Dev🎖️': 7
};

const DEV_USERNAME = 'j4xa7';

const DEFAULT = {
  users: {},
  groups: {},
  subscribers: [],
  settings: {
    botEnabled: true,
    repliesEnabled: true,
    bankEnabled: true,
    communicationEnabled: true,
    forcedSubscription: false,
    forcedSubscriptionChannel: '',
    serviceBotEnabled: true,
    statisticsEnabled: true,
    zajeelEnabled: true,
    formatsEnabled: true,
    logsChannel: '',
    channels: {},
    registeredGroups: {},
    botMemberCount: 0,
    botLogs: []
  }
};

let db = load();

/* =========================================================
   قاعدة البيانات
========================================================= */

function load() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return structuredClone(DEFAULT);
    }

    const x = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    return {
      users: x.users || {},
      groups: x.groups || {},
      subscribers: x.subscribers || [],
      settings: {
        ...structuredClone(DEFAULT.settings),
        ...(x.settings || {}),
        channels: x.settings?.channels || {},
        registeredGroups: x.settings?.registeredGroups || {},
        botLogs: x.settings?.botLogs || []
      }
    };
  } catch {
    return structuredClone(DEFAULT);
  }
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

/* =========================================================
   أدوات عامة
========================================================= */

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mention(u) {
  if (!u) return 'المستخدم';

  const name = u.first_name || u.username || 'المستخدم';

  return `<a href="tg://user?id=${u.id}">${esc(
    name + (u.title ? `「${u.title}」` : '')
  )}</a>`;
}

function user(id, from = {}) {
  const k = String(id);

  if (!db.users[k]) {
    db.users[k] = {
      id,
      username: '',
      first_name: '',
      role: 'عضو',
      title: '',
      messages: 0,

      /* الرصيد الحالي للنظام */
      balance: 0,

      bank: false,
      channel: '',
      wives: []
    };
  }

  const u = db.users[k];

  if (from.username) u.username = from.username;
  if (from.first_name) u.first_name = from.first_name;

  if ((u.username || '').toLowerCase() === DEV_USERNAME.toLowerCase()) {
    u.role = 'Dev🎖️';
  }

  return u;
}

function group(id) {
  const k = String(id);

  if (!db.groups[k]) {
    db.groups[k] = {
      roles: {},
      messages: {},
      seen: {},
      tracked: [],
      muted: {},
      globalMuted: {},
      warnings: {},
      violations: true,
      mentions: true,
      gamesLocked: false,
      forbidden: [],
      customCommands: {},
      customReplies: {},
      titles: {},
      marriages: [],
      whisper: {},

      /* الإضافات الجديدة */
      botEnabled: true,
      repliesEnabled: true,
      communicationEnabled: true,
      serviceBotEnabled: true,
      statisticsEnabled: true,
      zajeelEnabled: true,
      formatsEnabled: true,
      forcedSubscription: false,
      forcedSubscriptionChannel: '',
      memberCount: 0,
      logsChannel: ''
    };
  }

  const g = db.groups[k];

  if (!g.messages) g.messages = {};
  if (!g.seen) g.seen = {};
  if (!g.tracked) g.tracked = [];
  if (!g.muted) g.muted = {};
  if (!g.globalMuted) g.globalMuted = {};
  if (!g.forbidden) g.forbidden = [];
  if (!g.marriages) g.marriages = [];

  return g;
}

function level(u) {
  if ((u?.username || '').toLowerCase() === DEV_USERNAME.toLowerCase()) {
    return 7;
  }

  return ROLE_LEVEL[u?.role] ?? 0;
}

function actor(ctx) {
  const u = user(ctx.from.id, ctx.from);

  if (ctx.chat && ctx.chat.type !== 'private') {
    const g = group(ctx.chat.id);
    const r = g.roles[String(ctx.from.id)];

    if (r && level(u) < (ROLE_LEVEL[r] ?? 0)) {
      u.role = r;
    }
  }

  return u;
}

function reply(ctx, text, extra = {}) {
  return ctx.reply(text, {
    parse_mode: 'HTML',
    reply_parameters: ctx.message?.message_id
      ? { message_id: ctx.message.message_id }
      : undefined,
    ...extra
  });
}

function target(ctx) {
  const r = ctx.message?.reply_to_message?.from;

  if (!r) return null;

  return user(r.id, r);
}

function need(ctx, n, name) {
  if (level(actor(ctx)) < n) {
    reply(ctx, `• هذا الامر يخص ↤ ｢ ${name} ｢`);
    return false;
  }

  return true;
}

function canUseOn(ctx, t) {
  return level(actor(ctx)) > level(t);
}

function addSubscriber(id) {
  if (!db.subscribers.includes(id)) {
    db.subscribers.push(id);
    save();
  }
}

function botLog(type, data = {}) {
  db.settings.botLogs.push({
    type,
    data,
    time: Date.now()
  });

  if (db.settings.botLogs.length > 500) {
    db.settings.botLogs.shift();
  }

  save();
}

/* =========================================================
   تتبع الرسائل والتفاعل
========================================================= */

function track(ctx) {
  if (!ctx.chat || ctx.chat.type === 'private') return;

  const g = group(ctx.chat.id);
  const m = ctx.message;

  if (!m?.message_id) return;

  g.seen[String(ctx.from.id)] = true;

  g.tracked.push({
    id: m.message_id,
    type: typeOf(m)
  });

  if (g.tracked.length > 1500) {
    g.tracked.shift();
  }
}

function typeOf(m) {
  if (m.photo) return 'photo';
  if (m.video) return 'video';
  if (m.document) return 'document';
  if (m.sticker) return 'sticker';
  if (m.animation) return 'gif';
  if (m.audio) return 'audio';
  if (m.voice) return 'voice';

  if (
    m.text &&
    /https?:\/\/|t\.me\//i.test(m.text)
  ) {
    return 'link';
  }

  return 'text';
}

/* =========================================================
   صلاحيات البوت
========================================================= */

async function isAdmin(ctx) {
  try {
    const me = await ctx.telegram.getMe();

    const x = await ctx.telegram.getChatMember(
      ctx.chat.id,
      me.id
    );

    return ['administrator', 'creator'].includes(x.status);
  } catch {
    return false;
  }
}

async function mute(ctx, id) {
  return ctx.telegram.restrictChatMember(
    ctx.chat.id,
    id,
    {
      permissions: {
        can_send_messages: false
      }
    }
  );
}

async function unmute(ctx, id) {
  return ctx.telegram.restrictChatMember(
    ctx.chat.id,
    id,
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

async function punish(ctx, kind) {
  const t = target(ctx);

  if (!t) {
    return reply(ctx, '• رد على المستخدم');
  }

  if (!need(ctx, 2, 'مالك وفوق')) {
    return;
  }

  const u = user(t.id, t);

  if (!canUseOn(ctx, u)) {
    return reply(
      ctx,
      '• لا يمكن استخدام الامر على نفس رتبتك او اعلى'
    );
  }

  if (!(await isAdmin(ctx))) {
    return reply(ctx, '• البوت ليس مشرف');
  }

  try {
    if (kind === 'mute' || kind === 'restrict') {
      await mute(ctx, u.id);
    }

    if (kind === 'unmute' || kind === 'unrestrict') {
      await unmute(ctx, u.id);
    }

    if (kind === 'ban') {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        u.id
      );
    }

    if (kind === 'unban') {
      await ctx.telegram.unbanChatMember(
        ctx.chat.id,
        u.id,
        { only_if_banned: true }
      );
    }

    if (kind === 'kick') {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        u.id
      );

      await ctx.telegram.unbanChatMember(
        ctx.chat.id,
        u.id,
        { only_if_banned: true }
      );
    }

    const g = group(ctx.chat.id);

    if (
      kind === 'mute' ||
      kind === 'restrict'
    ) {
      g.muted[String(u.id)] = true;
    } else {
      delete g.muted[String(u.id)];
    }

    save();

    const a = {
      mute: 'كتمته',
      unmute: 'فكيت كتمه',
      ban: 'حظرته',
      unban: 'فكيت حظره',
      kick: 'طردته',
      restrict: 'قيدته',
      unrestrict: 'الغيت تقييده'
    }[kind];

    return reply(
      ctx,
      `• المستخدم ذا ↤︎「${mention(u)}」\n• ${a}`
    );
  } catch {
    return reply(ctx, '• تعذر تنفيذ الامر');
  }
}

/* =========================================================
   Middleware
========================================================= */

bot.use(async (ctx, next) => {
  if (ctx.from) {
    user(ctx.from.id, ctx.from);
  }

  if (ctx.chat?.type === 'private') {
    addSubscriber(ctx.from.id);
  } else {
    const g = group(ctx.chat.id);

    if (ctx.message) {
      g.messages[String(ctx.from.id)] =
        (g.messages[String(ctx.from.id)] || 0) + 1;

      const u = user(ctx.from.id, ctx.from);

      /* العداد مستقل لكل قروب */
      u.messages = (u.messages || 0) + 1;

      track(ctx);
    }
  }

  try {
    await next();
  } finally {
    save();
  }
});

/* =========================================================
   START
========================================================= */

bot.start(async ctx => {
  addSubscriber(ctx.from.id);

  const me = await ctx.telegram.getMe();

  return ctx.reply(
    `أهلا بك يا قلبي - ${mention(
      user(ctx.from.id, ctx.from)
    )}\n\n• انا اشغل لك اللي تبي بالمكالمه\n\nادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.`,
    {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [
          Markup.button.url(
            'أضفني في مجموعتك',
            `https://t.me/${me.username}?startgroup=true`
          )
        ],
        [
          Markup.button.url(
            'المطور',
            'tg://user?id=0'
          )
        ]
      ]).reply_markup
    }
  );
});

/* =========================================================
   الرتبة والتفاعل
========================================================= */

bot.hears(/^رتبتي$/i, ctx =>
  reply(
    ctx,
    `• رتبتك ↤︎ ${esc(actor(ctx).role)}`
  )
);

bot.hears(/^تفاعلي$/i, ctx => {
  const u = actor(ctx);
  const g = group(ctx.chat.id);

  const rows = Object.entries(g.messages)
    .sort((a, b) => b[1] - a[1]);

  const index = rows.findIndex(
    x => x[0] === String(ctx.from.id)
  );

  const p = index === -1 ? 0 : index + 1;

  return reply(
    ctx,
    `• رتبتك ↤︎ ${esc(u.role)}
• عدد رسائل التفاعل ↤︎ ${g.messages[String(u.id)] || 0}
• ترتيبك بين المتفاعلين ↤︎ ${p || 'غير موجود'}`
  );
});

bot.hears(/^المتفاعلين$/i, ctx => {
  const g = group(ctx.chat.id);

  const rows = Object.entries(g.messages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  if (!rows.length) {
    return reply(ctx, '• لا يوجد متفاعلين');
  }

  const me = String(ctx.from.id);

  const list = rows.map((x, i) => {
    const mark = x[0] === me ? ' (you)' : '';

    return `${i + 1} - ${mention(
      user(Number(x[0]))
    )}${mark} ↤︎ ${x[1]}`;
  }).join('\n');

  return reply(
    ctx,
    `• توب المتفاعلين 20\n\n${list}`
  );
});

bot.hears(/^توب المتفاعلين$/i, ctx => {
  return bot.handleUpdate({
    ...ctx.update,
    message: {
      ...ctx.message,
      text: 'المتفاعلين'
    }
  });
});

bot.hears(/^رتبته$/i, ctx => {
  const t = target(ctx);

  return t
    ? reply(
        ctx,
        `• رتبته ↤︎ ${esc(user(t.id, t).role)}`
      )
    : reply(ctx, '• رد على المستخدم');
});

bot.hears(/^تفاعله$/i, ctx => {
  const t = target(ctx);

  if (!t) {
    return reply(ctx, '• رد على المستخدم');
  }

  const g = group(ctx.chat.id);

  const n =
    g.messages[String(t.id)] || 0;

  const rows = Object.entries(g.messages)
    .sort((a, b) => b[1] - a[1]);

  const index = rows.findIndex(
    x => x[0] === String(t.id)
  );

  const p = index === -1 ? 0 : index + 1;

  return reply(
    ctx,
    `• رتبته ↤︎ ${esc(user(t.id, t).role)}
• عدد رسائل التفاعل ↤︎ ${n}
• ترتيبه بين المتفاعلين ↤︎ ${p || 'غير موجود'}`
  );
});

/* =========================================================
   الرتب
========================================================= */

const ranks = [
  ['مميز', 1],
  ['مالك', 2],
  ['مالك أساسي', 3],
  ['Myth', 4],
  ['Myth🎖️', 5],
  ['Dev²🎖️', 6]
];

for (const [r, l] of ranks) {
  const names = {
    مميز: ['رفع مميز'],
    مالك: ['رفع مالك'],
    'مالك أساسي': ['رفع مالك أساسي', 'رفع اساس'],
    Myth: ['رفع Myth', 'رفع M'],
    'Myth🎖️': ['رفع Myth 🎖️', 'رفع My', 'رفع اكس'],
    'Dev²🎖️': [
      'رفع Dev²',
      'رفع ديف',
      'رفع مطور ثانوي'
    ]
  }[r];

  for (const n of names) {
    bot.hears(
      new RegExp(
        '^' +
        n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '$',
        'i'
      ),
      ctx => {
        const t = target(ctx);

        if (!t) {
          return reply(ctx, '• رد على المستخدم');
        }

        if (!need(ctx, l + 1, `رتبة ${l + 1} وفوق`)) {
          return;
        }

        const u = user(t.id, t);

        if (!canUseOn(ctx, u)) {
          return reply(
            ctx,
            '• لا يمكن رفع رتبه نفس رتبتك ولا اعلى من رتبتك'
          );
        }

        u.role = r;

        group(ctx.chat.id).roles[String(u.id)] = r;

        save();

        return reply(
          ctx,
          `• المستخدم ذا ↤︎「${mention(u)}」
• تم رفعه الرتبه`
        );
      }
    );
  }
}

bot.hears(/^تنزيل$/i, ctx => {
  const t = target(ctx);

  if (!t) {
    return reply(ctx, '• رد على المستخدم');
  }

  const u = user(t.id, t);

  if (!canUseOn(ctx, u)) {
    return reply(
      ctx,
      '• لا يمكن تنزيل رتبه نفس رتبتك ولا اعلى من رتبتك'
    );
  }

  u.role = 'عضو';

  group(ctx.chat.id).roles[String(u.id)] =
    'عضو';

  save();

  return reply(
    ctx,
    `• المستخدم ذا ↤︎「${mention(u)}」
• تم تنزيل رتبته`
  );
});

/* =========================================================
   الكتم والحظر
========================================================= */

for (
  const [cmd, kind] of [
    ['كتم', 'mute'],
    ['فك الكتم', 'unmute'],
    ['حظر', 'ban'],
    ['فك الحظر', 'unban'],
    ['طرد', 'kick'],
    ['تقييد', 'restrict'],
    ['الغاء التقييد', 'unrestrict']
  ]
) {
  bot.hears(
    new RegExp(
      '^' +
      cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '$',
      'i'
    ),
    ctx => punish(ctx, kind)
  );
}

bot.hears(/^كتم عام$/i, ctx => {
  const t = target(ctx);

  if (!t) {
    return reply(ctx, '• رد على المستخدم');
  }

  if (!need(ctx, 2, 'مالك وفوق')) return;

  const u = user(t.id, t);

  if (!canUseOn(ctx, u)) {
    return reply(
      ctx,
      '• لا يمكن استخدام الامر على نفس رتبتك او اعلى'
    );
  }

  group(ctx.chat.id).globalMuted[String(u.id)] =
    true;

  save();

  return reply(
    ctx,
    `• المستخدم ذا ↤︎「${mention(u)}」
• كتمته عام`
  );
});

bot.hears(/^فك الكتم العام$/i, ctx => {
  const t = target(ctx);

  if (!t) {
    return reply(ctx, '• رد على المستخدم');
  }

  if (!need(ctx, 2, 'مالك وفوق')) return;

  const u = user(t.id, t);

  delete group(ctx.chat.id).globalMuted[
    String(u.id)
  ];

  save();

  return reply(
    ctx,
    `• المستخدم ذا ↤︎「${mention(u)}」
• فكيت عنه الكتم العام`
  );
});

bot.hears(/^مم$/i, ctx => {
  const ids = Object.keys(
    group(ctx.chat.id).muted
  );

  return reply(
    ctx,
    ids.length
      ? '• المكتومين\n\n' +
          ids.map(x =>
            `• ${mention(user(Number(x)))}`
          ).join('\n')
      : '• لا يوجد مكتومين'
  );
});

bot.hears(/^خخ$/i, ctx => {
  const ids = Object.keys(
    group(ctx.chat.id).globalMuted
  );

  return reply(
    ctx,
    ids.length
      ? '• المكتومين عام\n\n' +
          ids.map(x =>
            `• ${mention(user(Number(x)))}`
          ).join('\n')
      : '• لا يوجد مكتومين عام'
  );
});

/* =========================================================
   المخالفات
========================================================= */

bot.hears(/^فتح المخالفات$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  group(ctx.chat.id).violations = true;

  save();

  return reply(ctx, '• تم فتح المخالفات');
});

bot.hears(/^(غلق|قفل) المخالفات$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  group(ctx.chat.id).violations = false;

  save();

  return reply(ctx, '• تم غلق المخالفات');
});

/* =========================================================
   التنظيف
========================================================= */

const CT = {
  0: 'text',
  1: 'photo',
  2: 'video',
  3: 'document',
  4: 'sticker',
  5: 'gif',
  6: 'audio',
  7: 'voice',
  8: 'link'
};

bot.hears(
  /^تنظيف(?:\s+([0-9]))?$/i,
  async ctx => {
    if (!need(ctx, 4, 'Myth')) return;

    const g = group(ctx.chat.id);

    const n =
      ctx.match[1] === undefined
        ? 9
        : Number(ctx.match[1]);

    const want = CT[n];

    const list = want
      ? g.tracked.filter(x => x.type === want)
      : g.tracked.slice();

    let c = 0;

    for (const x of list) {
      try {
        await ctx.telegram.deleteMessage(
          ctx.chat.id,
          x.id
        );

        c++;
      } catch {}
    }

    g.tracked = g.tracked.filter(
      x => !list.includes(x)
    );

    save();

    if (!c && n === 1) {
      return reply(
        ctx,
        `• ${mention(ctx.from)}
• لا يوجد صور في القروب`
      );
    }

    if (!c && n === 6) {
      return reply(
        ctx,
        `• ${mention(ctx.from)}
• لا يوجد صوتيات في القروب`
      );
    }

    if (!c && n === 7) {
      return reply(
        ctx,
        `• ${mention(ctx.from)}
• لا يوجد فويسات في القروب`
      );
    }

    if (!c && n === 5) {
      return reply(
        ctx,
        `• ${mention(ctx.from)}
• لا يوجد قيفات في القروب`
      );
    }

    return reply(
      ctx,
      `• مسحت ${c} من الرسائل`
    );
  }
);

/* =========================================================
   التفاعل
========================================================= */

bot.hears(/^اضف تفاعل (\d+)$/i, ctx => {
  const t = target(ctx);
  const n = Number(ctx.match[1]);

  if (!t) {
    return reply(ctx, '• رد على المستخدم');
  }

  if (!need(ctx, 7, 'Dev🎖️')) return;

  const u = user(t.id, t);
  const g = group(ctx.chat.id);

  u.messages += n;

  g.messages[String(u.id)] =
    (g.messages[String(u.id)] || 0) + n;

  save();

  return reply(
    ctx,
    `• تمت إضافة ${n} من التفاعل لـ ${mention(u)}`
  );
});

/* =========================================================
   الألقاب
========================================================= */

bot.hears(/^ضع (.+)$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  const t = target(ctx);

  if (!t) {
    return reply(ctx, '• رد على المستخدم');
  }

  const title = ctx.match[1].trim();
  const u = user(t.id, t);

  u.title = title;

  group(ctx.chat.id).titles[String(u.id)] =
    title;

  save();

  return reply(
    ctx,
    `• المستخدم ذا ↤︎「${mention(u)}」
• تم وضع اللقب`
  );
});

bot.hears(/^لقبي$/i, ctx =>
  reply(
    ctx,
    `• لقبك ↤︎ ${esc(
      actor(ctx).title || 'لا يوجد'
    )}`
  )
);

bot.hears(/^لقبه$/i, ctx => {
  const t = target(ctx);

  return t
    ? reply(
        ctx,
        `• لقبه ↤︎ ${esc(
          user(t.id, t).title || 'لا يوجد'
        )}`
      )
    : reply(ctx, '• رد على المستخدم');
});

/* =========================================================
   الكلمات الممنوعة
========================================================= */

bot.hears(/^منع الكلمه (.+)$/i, ctx => {
  if (!need(ctx, 6, 'Dev²🎖️')) return;

  const g = group(ctx.chat.id);
  const w = ctx.match[1].trim();

  if (!g.forbidden.includes(w)) {
    g.forbidden.push(w);
  }

  save();

  return reply(ctx, '• تم منع الكلمه');
});

bot.hears(/^الغاء منع الكلمه (.+)$/i, ctx => {
  if (!need(ctx, 6, 'Dev²🎖️')) return;

  const g = group(ctx.chat.id);

  const w = ctx.match[1]
    .trim()
    .toLowerCase();

  g.forbidden =
    g.forbidden.filter(
      x => x.toLowerCase() !== w
    );

  save();

  return reply(
    ctx,
    '• تم الغاء منع الكلمه'
  );
});

bot.hears(/^الكلمات الممنوعه$/i, ctx => {
  const a = group(ctx.chat.id).forbidden;

  return reply(
    ctx,
    a.length
      ? '• الكلمات الممنوعه\n\n' +
          a.map(x => `• ${esc(x)}`).join('\n')
      : '• لا يوجد كلمات ممنوعه'
  );
});

bot.hears(/^مسح الكلمات الممنوعه$/i, ctx => {
  if (!need(ctx, 6, 'Dev²🎖️')) return;

  group(ctx.chat.id).forbidden = [];

  save();

  return reply(
    ctx,
    '• تم مسح الكلمات الممنوعه'
  );
});

/* =========================================================
   الرصيد الحالي للنظام
   العملة افتراضية فقط
========================================================= */

bot.hears(/^فلوسي$/i, ctx => {
  const u = actor(ctx);

  return reply(
    ctx,
    `• فلوسك ↤︎ ${u.balance}
• العملة ↤︎ افتراضية`
  );
});

bot.hears(/^فلوسه$/i, ctx => {
  const t = target(ctx);

  if (!t) {
    return reply(ctx, '• رد على المستخدم');
  }

  return reply(
    ctx,
    `• فلوسه ↤︎ ${user(t.id, t).balance}
• العملة ↤︎ افتراضية`
  );
});

bot.hears(/^انشاء حساب بنكي$/i, ctx => {
  if (!db.settings.bankEnabled) {
    return reply(ctx, '• البنك معطل');
  }

  const u = actor(ctx);

  if (u.bank) {
    return reply(
      ctx,
      '• عندك حساب بنكي بالفعل'
    );
  }

  u.bank = true;

  save();

  return reply(
    ctx,
    '• تم انشاء حسابك البنكي'
  );
});

bot.hears(/^حسابي$/i, ctx => {
  const u = actor(ctx);

  return reply(
    ctx,
    `• اسم الحساب ↤︎ ${esc(u.first_name)}
• الرصيد ↤︎ ${u.balance}
• البنك ↤︎ ${u.bank ? 'موجود' : 'لا يوجد'}
• العملة ↤︎ افتراضية`
  );
});

bot.hears(/^اهداء (\d+)$/i, ctx => {
  const t = target(ctx);

  if (!t) {
    return reply(ctx, '• رد على المستخدم');
  }

  const n = Number(ctx.match[1]);

  const me = actor(ctx);
  const to = user(t.id, t);

  if (n <= 0 || me.balance < n) {
    return reply(ctx, '• رصيدك لا يكفي');
  }

  me.balance -= n;
  to.balance += n;

  save();

  return reply(
    ctx,
    `• تم اهداء ${n} للمستخدم ↤︎ ${mention(to)}`
  );
});

bot.hears(/^حذف حسابي$/i, ctx => {
  actor(ctx).bank = false;

  save();

  return reply(
    ctx,
    '• تم حذف حسابك البنكي مع الحفاظ على بياناتك'
  );
});

/* =========================================================
   الزواج
========================================================= */

async function marry(ctx, n) {
  const t = target(ctx);

  if (!t) {
    return reply(ctx, '• رد على المستخدم');
  }

  const me = actor(ctx);
  const to = user(t.id, t);
  const g = group(ctx.chat.id);

  if (
    g.marriages.filter(
      x => x.husband === me.id
    ).length >= 4
  ) {
    return reply(
      ctx,
      '• وصلت للحد الأقصى من الزيجات'
    );
  }

  if (
    g.marriages.some(
      x => x.wife === to.id
    )
  ) {
    return reply(
      ctx,
      '• المستخدم متزوج بالفعل'
    );
  }

  if (me.balance < n) {
    return reply(
      ctx,
      '• رصيدك لا يكفي'
    );
  }

  me.balance -= n;

  g.marriages.push({
    husband: me.id,
    wife: to.id,
    mahr: n,
    time: Date.now()
  });

  save();

  return reply(
    ctx,
    `• تم الزواج من ${mention(to)}
• المهر ↤︎ ${n}`
  );
}

bot.hears(/^زواجي$/i, ctx => {
  const me = actor(ctx);

  const a = group(ctx.chat.id)
    .marriages
    .filter(
      x =>
        x.husband === me.id ||
        x.wife === me.id
    );

  return reply(
    ctx,
    a.length
      ? '• زواجي\n\n' +
          a.map(
            x =>
              `• ${mention(
                user(
                  x.husband === me.id
                    ? x.wife
                    : x.husband
                )
              )} ↤︎ المهر ${x.mahr}`
          ).join('\n')
      : '• ما عندك زواج'
  );
});

bot.hears(/^زواج (\d+)$/i, ctx =>
  marry(
    ctx,
    Number(ctx.match[1])
  )
);

bot.hears(/^زواج$/i, ctx =>
  marry(ctx, 1000)
);

bot.hears(/^توب المتزوجين$/i, ctx => {
  const c = {};

  for (
    const x of group(ctx.chat.id).marriages
  ) {
    c[x.husband] =
      (c[x.husband] || 0) + 1;
  }

  const a = Object.entries(c)
    .sort((x, y) => y[1] - x[1]);

  return reply(
    ctx,
    a.length
      ? '• توب المتزوجين\n\n' +
          a.slice(0, 10).map(
            (x, i) =>
              `${i + 1} - ${mention(
                user(Number(x[0]))
              )} ↤︎ ${x[1]}`
          ).join('\n')
      : '• لا يوجد متزوجين'
  );
});

/* =========================================================
   المنشن
========================================================= */

bot.hears(/^@all$/i, async ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  const g = group(ctx.chat.id);
  const ids = Object.keys(g.seen);

  if (!ids.length) {
    return reply(
      ctx,
      '• لا يوجد أعضاء معروفين للمنشن'
    );
  }

  let s = '';

  for (const id of ids) {
    const x = mention(
      user(Number(id))
    );

    if ((s + x).length > 3500) {
      await ctx.reply(s, {
        parse_mode: 'HTML'
      });

      s = '';
    }

    s += x + ' ';
  }

  if (s) {
    await ctx.reply(s, {
      parse_mode: 'HTML'
    });
  }
});

bot.hears(/^فتح المنشن$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  group(ctx.chat.id).mentions = true;

  save();

  return reply(
    ctx,
    '• تم فتح المنشن'
  );
});

bot.hears(/^غلق المنشن$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  group(ctx.chat.id).mentions = false;

  save();

  return reply(
    ctx,
    '• تم غلق المنشن'
  );
});

/* =========================================================
   قناة المستخدم
========================================================= */

bot.hears(/^قناتي$/i, ctx =>
  reply(
    ctx,
    actor(ctx).channel
      ? `• قناتك ↤︎ ${esc(
          actor(ctx).channel
        )}`
      : '• لا توجد قناة محفوظة'
  )
);

bot.hears(/^حذف قناتي$/i, ctx => {
  if (!need(ctx, 6, 'Dev²🎖️')) return;

  actor(ctx).channel = '';

  save();

  return reply(
    ctx,
    '• تم حذف قناتك'
  );
});

/* =========================================================
   إدارة البوت - Dev
========================================================= */

/* تفعيل البوت */

bot.hears(/^تفعيل البوت$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  db.settings.botEnabled = true;

  if (ctx.chat?.type !== 'private') {
    group(ctx.chat.id).botEnabled = true;
  }

  botLog('enable_bot', {
    by: ctx.from.id,
    chat: ctx.chat?.id
  });

  save();

  return reply(
    ctx,
    '• تم تفعيل البوت'
  );
});

/* تعطيل البوت */

bot.hears(/^تعطيل البوت$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  db.settings.botEnabled = false;

  if (ctx.chat?.type !== 'private') {
    group(ctx.chat.id).botEnabled = false;
  }

  botLog('disable_bot', {
    by: ctx.from.id,
    chat: ctx.chat?.id
  });

  save();

  return reply(
    ctx,
    '• تم تعطيل البوت'
  );
});

/* حالة البوت */

bot.hears(/^حالة البوت$/i, async ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  let username = '';

  try {
    const me = await ctx.telegram.getMe();
    username = me.username
      ? `@${me.username}`
      : 'بدون يوزر';
  } catch {}

  return reply(
    ctx,
    `• حالة البوت

• التشغيل ↤︎ ${
      db.settings.botEnabled
        ? 'مفعل'
        : 'معطل'
    }

• الردود ↤︎ ${
      db.settings.repliesEnabled
        ? 'مفعلة'
        : 'معطلة'
    }

• البنك ↤︎ ${
      db.settings.bankEnabled
        ? 'مفعل'
        : 'معطل'
    }

• التواصل ↤︎ ${
      db.settings.communicationEnabled
        ? 'مفعل'
        : 'معطل'
    }

• الاشتراك الإجباري ↤︎ ${
      db.settings.forcedSubscription
        ? 'مفعل'
        : 'معطل'
    }

• بوت الخدمة ↤︎ ${
      db.settings.serviceBotEnabled
        ? 'مفعل'
        : 'معطل'
    }

• الإحصائيات ↤︎ ${
      db.settings.statisticsEnabled
        ? 'مفعلة'
        : 'معطلة'
    }

• الزاجل ↤︎ ${
      db.settings.zajeelEnabled
        ? 'مفعل'
        : 'معطل'
    }

• التنسيقات ↤︎ ${
      db.settings.formatsEnabled
        ? 'مفعلة'
        : 'معطلة'
    }

• الحساب ↤︎ ${username}`
  );
});

/* إحصائيات البوت */

bot.hears(/^إحصائيات البوت$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  const users =
    Object.keys(db.users).length;

  const groups =
    Object.keys(db.groups).length;

  const channels =
    Object.keys(
      db.settings.channels || {}
    ).length;

  return reply(
    ctx,
    `• إحصائيات البوت

• المستخدمين ↤︎ ${users}
• القروبات ↤︎ ${groups}
• القنوات ↤︎ ${channels}
• المشتركين ↤︎ ${db.subscribers.length}
• السجل ↤︎ ${db.settings.botLogs.length}
• عدد الأعضاء المحدد ↤︎ ${
      db.settings.botMemberCount || 0
    }`
  );
});

/* سجل البوت */

bot.hears(/^سجل البوت$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  const logs =
    db.settings.botLogs
      .slice(-20)
      .reverse();

  if (!logs.length) {
    return reply(
      ctx,
      '• لا يوجد سجل للبوت'
    );
  }

  return reply(
    ctx,
    '• سجل البوت\n\n' +
      logs.map(
        (x, i) =>
          `${i + 1} - ${esc(
            x.type
          )} ↤︎ ${new Date(
            x.time
          ).toLocaleString('ar-SA')}`
      ).join('\n')
  );
});

/* تحديث البوت */

bot.hears(/^تحديث البوت$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  botLog('update_bot', {
    by: ctx.from.id
  });

  save();

  return reply(
    ctx,
    '• تم تحديث بيانات البوت'
  );
});

/* إعادة تشغيل */

bot.hears(/^إعادة تشغيل البوت$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  save();

  botLog('restart_bot', {
    by: ctx.from.id
  });

  save();

  reply(
    ctx,
    '• جاري إعادة تشغيل البوت...'
  ).then(() => {
    setTimeout(() => {
      process.exit(0);
    }, 500);
  });
});

/* =========================================================
   Dev - إعدادات النظام
========================================================= */

/* عدد الأعضاء */

bot.hears(/^تعيين عدد الأعضاء (\d+)$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  const n = Number(ctx.match[1]);

  db.settings.botMemberCount = n;

  save();

  return reply(
    ctx,
    `• تم تعيين عدد الأعضاء ↤︎ ${n}`
  );
});

/* الردود */

bot.hears(/^تفعيل الردود$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  db.settings.repliesEnabled = true;

  save();

  return reply(
    ctx,
    '• تم تفعيل الردود'
  );
});

bot.hears(/^تعطيل الردود$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  db.settings.repliesEnabled = false;

  save();

  return reply(
    ctx,
    '• تم تعطيل الردود'
  );
});

/* البنك */

bot.hears(/^تفعيل البنك$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  db.settings.bankEnabled = true;

  save();

  return reply(
    ctx,
    '• تم تفعيل البنك'
  );
});

bot.hears(/^تعطيل البنك$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  db.settings.bankEnabled = false;

  save();

  return reply(
    ctx,
    '• تم تعطيل البنك'
  );
});

/* التواصل */

bot.hears(/^تفعيل التواصل$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  db.settings.communicationEnabled = true;

  save();

  return reply(
    ctx,
    '• تم تفعيل التواصل'
  );
});

bot.hears(/^تعطيل التواصل$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  db.settings.communicationEnabled = false;

  save();

  return reply(
    ctx,
    '• تم تعطيل التواصل'
  );
});

/* الاشتراك الإجباري */

bot.hears(/^تفعيل الاشتراك الإجباري$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  db.settings.forcedSubscription = true;

  save();

  return reply(
    ctx,
    '• تم تفعيل الاشتراك الإجباري'
  );
});

bot.hears(/^تعطيل الاشتراك الإجباري$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  db.settings.forcedSubscription = false;

  save();

  return reply(
    ctx,
    '• تم تعطيل الاشتراك الإجباري'
  );
});

bot.hears(/^تغيير الاشتراك الإجباري (.+)$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  const channel = ctx.match[1].trim();

  db.settings.forcedSubscriptionChannel =
    channel;

  db.settings.forcedSubscription = true;

  save();

  return reply(
    ctx,
    `• تم تغيير قناة الاشتراك الإجباري ↤︎ ${esc(
      channel
    )}`
  );
});

/* بوت الخدمة */

bot.hears(/^تفعيل بوت الخدمة$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  db.settings.serviceBotEnabled = true;

  save();

  return reply(
    ctx,
    '• تم تفعيل بوت الخدمة'
  );
});

bot.hears(/^تعطيل بوت الخدمة$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  db.settings.serviceBotEnabled = false;

  save();

  return reply(
    ctx,
    '• تم تعطيل بوت الخدمة'
  );
});

/* الإحصائيات */

bot.hears(/^تفعيل الإحصائيات$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  db.settings.statisticsEnabled = true;

  save();

  return reply(
    ctx,
    '• تم تفعيل الإحصائيات'
  );
});

bot.hears(/^تعطيل الإحصائيات$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  db.settings.statisticsEnabled = false;

  save();

  return reply(
    ctx,
    '• تم تعطيل الإحصائيات'
  );
});

/* الزاجل */

bot.hears(/^تفعيل الزاجل$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  db.settings.zajeelEnabled = true;

  save();

  return reply(
    ctx,
    '• تم تفعيل الزاجل'
  );
});

bot.hears(/^تعطيل الزاجل$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  db.settings.zajeelEnabled = false;

  save();

  return reply(
    ctx,
    '• تم تعطيل الزاجل'
  );
});

/* التنسيقات */

bot.hears(/^تفعيل التنسيقات$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  db.settings.formatsEnabled = true;

  save();

  return reply(
    ctx,
    '• تم تفعيل التنسيقات'
  );
});

bot.hears(/^تعطيل التنسيقات$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  db.settings.formatsEnabled = false;

  save();

  return reply(
    ctx,
    '• تم تعطيل التنسيقات'
  );
});

/* =========================================================
   تنظيف ومسح بيانات القروب
========================================================= */

bot.hears(/^تنظيف بيانات القروب$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  const g = group(ctx.chat.id);

  g.tracked = [];
  g.seen = {};
  g.messages = {};
  g.warnings = {};
  g.muted = {};
  g.globalMuted = {};

  save();

  return reply(
    ctx,
    '• تم تنظيف بيانات القروب'
  );
});

bot.hears(/^مسح بيانات القروب$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  const id = String(ctx.chat.id);

  delete db.groups[id];

  save();

  return reply(
    ctx,
    '• تم مسح بيانات القروب'
  );
});

/* =========================================================
   القروبات
========================================================= */

bot.hears(/^إضافة قروب$/i, async ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  if (ctx.chat.type === 'private') {
    return reply(
      ctx,
      '• استخدم الأمر داخل القروب المطلوب'
    );
  }

  const g = group(ctx.chat.id);

  db.settings.registeredGroups[
    String(ctx.chat.id)
  ] = {
    id: ctx.chat.id,
    title: ctx.chat.title || '',
    addedAt: Date.now()
  };

  g.botEnabled = true;

  botLog('add_group', {
    id: ctx.chat.id,
    title: ctx.chat.title
  });

  save();

  return reply(
    ctx,
    `• تمت إضافة القروب\n• الاسم ↤︎ ${esc(
      ctx.chat.title || 'بدون اسم'
    )}`
  );
});

bot.hears(/^حذف قروب$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  const id = String(ctx.chat.id);

  delete db.settings.registeredGroups[id];

  save();

  return reply(
    ctx,
    '• تم حذف القروب من قائمة القروبات'
  );
});

bot.hears(/^قائمة القروبات$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  const list =
    Object.values(
      db.settings.registeredGroups
    );

  if (!list.length) {
    return reply(
      ctx,
      '• لا توجد قروبات'
    );
  }

  return reply(
    ctx,
    '• قائمة القروبات\n\n' +
      list.map(
        (x, i) =>
          `${i + 1} - ${esc(
            x.title || 'بدون اسم'
          )}\n↤︎ ${x.id}`
      ).join('\n\n')
  );
});

/* =========================================================
   القنوات
========================================================= */

bot.hears(/^إضافة قناة (.+)$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  const channel = ctx.match[1].trim();

  db.settings.channels[channel] = {
    name: channel,
    addedAt: Date.now()
  };

  save();

  return reply(
    ctx,
    `• تمت إضافة القناة ↤︎ ${esc(channel)}`
  );
});

bot.hears(/^حذف قناة (.+)$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  const channel = ctx.match[1].trim();

  delete db.settings.channels[channel];

  save();

  return reply(
    ctx,
    `• تم حذف القناة ↤︎ ${esc(channel)}`
  );
});

bot.hears(/^قائمة القنوات$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  const list =
    Object.keys(
      db.settings.channels
    );

  return reply(
    ctx,
    list.length
      ? '• قائمة القنوات\n\n' +
          list.map(
            (x, i) =>
              `${i + 1} - ${esc(x)}`
          ).join('\n')
      : '• لا توجد قنوات'
  );
});

/* قناة السجل */

bot.hears(/^تعيين قناة السجل (.+)$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  const channel = ctx.match[1].trim();

  db.settings.logsChannel = channel;

  save();

  return reply(
    ctx,
    `• تم تعيين قناة السجل ↤︎ ${esc(
      channel
    )}`
  );
});

/* قناة الاشتراك */

bot.hears(/^تعيين قناة الاشتراك (.+)$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  const channel = ctx.match[1].trim();

  db.settings.forcedSubscriptionChannel =
    channel;

  save();

  return reply(
    ctx,
    `• تم تعيين قناة الاشتراك ↤︎ ${esc(
      channel
    )}`
  );
});

/* =========================================================
   المالك
========================================================= */

bot.hears(/^المالك$/i, async ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  let profileText =
    '• المالك\n\n' +
    '• الاسم ↤︎ إيلاف\n' +
    '• اليوزر ↤︎ @j4xa7';

  try {
    const photos =
      await ctx.telegram.getUserProfilePhotos(
        ctx.from.id,
        0,
        1
      );

    if (photos.total_count > 0) {
      profileText +=
        '\n• الافاتار ↤︎ موجود';
    } else {
      profileText +=
        '\n• الافاتار ↤︎ لا يوجد';
    }
  } catch {
    profileText +=
      '\n• الافاتار ↤︎ غير متاح';
  }

  return reply(ctx, profileText);
});

/* =========================================================
   رفع مشرف / تنزيل مشرف
========================================================= */

bot.hears(/^رفع مشرف$/i, async ctx => {
  const t = target(ctx);

  if (!t) {
    return reply(ctx, '• رد على المستخدم');
  }

  if (!need(ctx, 2, 'مالك وفوق')) return;

  const u = user(t.id, t);

  if (!canUseOn(ctx, u)) {
    return reply(
      ctx,
      '• لا يمكن استخدام الامر على نفس رتبتك او اعلى'
    );
  }

  try {
    await ctx.telegram.promoteChatMember(
      ctx.chat.id,
      u.id,
      {
        can_delete_messages: true,
        can_restrict_members: true,
        can_invite_users: true,
        can_pin_messages: true,
        can_change_info: false,
        can_promote_members: false
      }
    );

    return reply(
      ctx,
      `• المستخدم ذا ↤︎「${mention(u)}」
• تم رفعه مشرف`
    );
  } catch {
    return reply(
      ctx,
      '• تعذر رفعه مشرف'
    );
  }
});

bot.hears(/^تنزيل مشرف$/i, async ctx => {
  const t = target(ctx);

  if (!t) {
    return reply(ctx, '• رد على المستخدم');
  }

  if (!need(ctx, 2, 'مالك وفوق')) return;

  try {
    await ctx.telegram.promoteChatMember(
      ctx.chat.id,
      t.id,
      {
        can_delete_messages: false,
        can_restrict_members: false,
        can_invite_users: false,
        can_pin_messages: false,
        can_change_info: false,
        can_promote_members: false
      }
    );

    return reply(
      ctx,
      `• المستخدم ذا ↤︎「${mention(
        user(t.id, t)
      )}」
• تم تنزيله من المشرفين`
    );
  } catch {
    return reply(
      ctx,
      '• تعذر تنزيل المشرف'
    );
  }
});

/* =========================================================
   حماية الرسائل
========================================================= */

bot.on('message', async ctx => {
  if (ctx.chat?.type === 'private') {
    return;
  }

  const g = group(ctx.chat.id);

  if (g.botEnabled === false) {
    return;
  }

  const text =
    ctx.message?.text ||
    ctx.message?.caption ||
    '';

  const u = actor(ctx);

  if (
    g.violations &&
    level(u) < 4 &&
    text
  ) {
    const hasLink =
      /(https?:\/\/|www\.|t\.me\/)/i.test(
        text
      );

    const hasPhone =
      /\b(?:05|5)\d{8}\b/.test(text);

    const forbidden =
      g.forbidden.some(w =>
        text
          .toLowerCase()
          .includes(
            w.toLowerCase()
          )
      );

    if (
      hasLink ||
      hasPhone ||
      forbidden
    ) {
      try {
        await ctx.telegram.deleteMessage(
          ctx.chat.id,
          ctx.message.message_id
        );
      } catch {}
    }
  }

  if (
    g.globalMuted[String(ctx.from.id)] &&
    level(u) < 1
  ) {
    try {
      await ctx.telegram.deleteMessage(
        ctx.chat.id,
        ctx.message.message_id
      );
    } catch {}
  }
});

/* =========================================================
   قائمة الأوامر - Dev فقط
========================================================= */

const HELP = {
  dev:
`• 🛠️ أوامر Dev

• تعيين عدد الأعضاء
• تفعيل الردود
• تعطيل الردود
• تفعيل البنك
• تعطيل البنك
• تفعيل التواصل
• تعطيل التواصل
• تفعيل الاشتراك الإجباري
• تعطيل الاشتراك الإجباري
• تغيير الاشتراك الإجباري
• تفعيل بوت الخدمة
• تعطيل بوت الخدمة
• تفعيل الإحصائيات
• تعطيل الإحصائيات
• تفعيل الزاجل
• تعطيل الزاجل
• تفعيل التنسيقات
• تعطيل التنسيقات
• إضافة تفاعل
• رفع الرتب
• تنزيل الرتب`,

  bot:
`• 🤖 إدارة البوت

• تفعيل البوت
• تعطيل البوت
• تحديث البوت
• إعادة تشغيل البوت
• حالة البوت
• إحصائيات البوت
• سجل البوت
• تنظيف بيانات القروب
• مسح بيانات القروب`,

  groups:
`• 👥 القروبات والقنوات

• إضافة قروب
• حذف قروب
• قائمة القروبات
• إضافة قناة
• حذف قناة
• قائمة القنوات
• تعيين قناة السجل
• تعيين قناة الاشتراك`,

  interaction:
`• 🏆 التفاعل

• تفاعلي
• المتفاعلين
• توب المتفاعلين
• تفاعله
• اضف تفاعل

• الترتيب مستقل لكل قروب
• القائمة تعرض Top 20
• يظهر (you) عند طالب القائمة`,

  owner:
`• 👑 المالك

• المالك
• بروفايل المالك
• الافاتار
• اليوزر: @j4xa7`,

  ranks:
`• الرتب

• رفع مميز
• رفع مالك
• رفع مالك أساسي
• رفع Myth
• رفع Myth 🎖️
• رفع Dev²
• تنزيل
• رفع مشرف
• تنزيل مشرف`,

  protection:
`• 🛡️ الحماية

• فتح المخالفات
• غلق المخالفات
• فتح المنشن
• غلق المنشن
• منع الكلمه
• الغاء منع الكلمه
• الكلمات الممنوعه
• مسح الكلمات الممنوعه
• تنظيف`,

  money:
`• 🪙 النظام المالي

• فلوسي
• فلوسه
• انشاء حساب بنكي
• حسابي
• اهداء
• حذف حسابي
• زواج
• زواجي
• توب المتزوجين

• العملة افتراضية
• الرصيد يستخدم من النظام الحالي`
};

bot.hears(/^اوامر$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  return ctx.reply(
    '• اختر القسم',
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          '🛠️ Dev',
          'help:dev'
        ),
        Markup.button.callback(
          '🤖 إدارة البوت',
          'help:bot'
        )
      ],
      [
        Markup.button.callback(
          '👥 القروبات والقنوات',
          'help:groups'
        )
      ],
      [
        Markup.button.callback(
          '🏆 التفاعل',
          'help:interaction'
        ),
        Markup.button.callback(
          '👑 المالك',
          'help:owner'
        )
      ],
      [
        Markup.button.callback(
          '👑 الرتب',
          'help:ranks'
        ),
        Markup.button.callback(
          '🛡️ الحماية',
          'help:protection'
        )
      ],
      [
        Markup.button.callback(
          '🪙 النظام المالي',
          'help:money'
        )
      ]
    ])
  );
});

for (const key of Object.keys(HELP)) {
  bot.action(
    `help:${key}`,
    async ctx => {
      if (
        (ctx.from.username || '')
          .toLowerCase() !==
        DEV_USERNAME.toLowerCase()
      ) {
        return ctx.answerCbQuery(
          'هذا القسم خاص بـ Dev🎖️ فقط',
          { show_alert: true }
        );
      }

      await ctx.answerCbQuery();

      return ctx.editMessageText(
        HELP[key],
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                'رجوع',
                'help:root'
              )
            ]
          ])
        }
      );
    }
  );
}

bot.action('help:root', async ctx => {
  if (
    (ctx.from.username || '')
      .toLowerCase() !==
    DEV_USERNAME.toLowerCase()
  ) {
    return ctx.answerCbQuery(
      'هذا القسم خاص بـ Dev🎖️ فقط',
      { show_alert: true }
    );
  }

  await ctx.answerCbQuery();

  return ctx.editMessageText(
    '• اختر القسم',
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          '🛠️ Dev',
          'help:dev'
        ),
        Markup.button.callback(
          '🤖 إدارة البوت',
          'help:bot'
        )
      ],
      [
        Markup.button.callback(
          '👥 القروبات والقنوات',
          'help:groups'
        )
      ],
      [
        Markup.button.callback(
          '🏆 التفاعل',
          'help:interaction'
        ),
        Markup.button.callback(
          '👑 المالك',
          'help:owner'
        )
      ],
      [
        Markup.button.callback(
          '👑 الرتب',
          'help:ranks'
        ),
        Markup.button.callback(
          '🛡️ الحماية',
          'help:protection'
        )
      ],
      [
        Markup.button.callback(
          '🪙 النظام المالي',
          'help:money'
        )
      ]
    ])
  );
});

/* =========================================================
   تشغيل الأغاني / البحث
========================================================= */

bot.hears(
  /^تشغيل(?:\s+(.+))?$/i,
  ctx =>
    reply(
      ctx,
      '• تشغيل الأغاني في المكالمات يحتاج خدمة Voice Chat خارج Telegram Bot API، لذلك لم يتم اختلاق تشغيل صوتي غير مدعوم.'
    )
);

bot.hears(
  /^بحث(?: عن)? أغنية (.+)$/i,
  ctx =>
    reply(
      ctx,
      `• بحث الأغنية ↤︎ ${esc(
        ctx.match[1]
      )}\n• يلزم ربط مصدر بحث موسيقي لإرجاع النتائج.`
    )
);

/* =========================================================
   تنظيف بيانات القروب تلقائياً
========================================================= */

bot.hears(/^حالة الحماية$/i, ctx => {
  if (!need(ctx, 7, 'Dev🎖️')) return;

  const g = group(ctx.chat.id);

  return reply(
    ctx,
    `• حالة الحماية

• المخالفات ↤︎ ${
      g.violations
        ? 'مفتوحة'
        : 'مغلقة'
    }

• المنشن ↤︎ ${
      g.mentions
        ? 'مفتوح'
        : 'مغلق'
    }

• البوت ↤︎ ${
      g.botEnabled
        ? 'مفعل'
        : 'معطل'
    }`
  );
});

/* =========================================================
   أخطاء
========================================================= */

bot.catch(err => {
  console.error(
    'BOT ERROR:',
    err
  );

  try {
    botLog('error', {
      message: String(
        err?.message || err
      )
    });
  } catch {}
});

/* =========================================================
   الحفظ
========================================================= */

setInterval(() => {
  try {
    save();
  } catch {}
}, 10000);

process.once(
  'SIGINT',
  () => {
    save();
    bot.stop('SIGINT');
  }
);

process.once(
  'SIGTERM',
  () => {
    save();
    bot.stop('SIGTERM');
  }
);

/* =========================================================
   تشغيل البوت
========================================================= */

bot.launch({
  dropPendingUpdates: true
})
.then(() => {
  console.log('Bot started');
})
.catch(err => {
  console.error(err);
  process.exit(1);
});
