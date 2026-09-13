'use strict';

/*
===========================================================
  BOT - index.cjs
  Telegram Group Management Bot
===========================================================
*/

const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

let ytSearch = null;

try {
  ytSearch = require('yt-search');
} catch {
  console.log('yt-search غير مثبت. شغلي: npm install yt-search');
}

/* =========================================================
   الإعدادات
========================================================= */

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN غير موجود في متغيرات البيئة');
}

const bot = new Telegraf(BOT_TOKEN);

const OWNER_USERNAME = 'j4xa7';

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* =========================================================
   قاعدة البيانات
========================================================= */

const defaultData = {
  groups: {},
  users: {},
  whispers: {},
  subscribers: [],
  botSettings: {
    replies: true,
    bank: true,
    communication: true,
    forcedSubscription: false,
    subscriptionChannel: '',
    serviceBot: true,
    stats: true,
    messenger: true,
    formats: true
  }
};

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(defaultData, null, 2)
      );
      return structuredClone(defaultData);
    }

    const raw = fs.readFileSync(DATA_FILE, 'utf8');

    if (!raw.trim()) {
      return structuredClone(defaultData);
    }

    const parsed = JSON.parse(raw);

    return {
      ...structuredClone(defaultData),
      ...parsed,
      groups: parsed.groups || {},
      users: parsed.users || {},
      whispers: parsed.whispers || {},
      subscribers: parsed.subscribers || []
    };
  } catch (err) {
    console.error('خطأ في قراءة قاعدة البيانات:', err);
    return structuredClone(defaultData);
  }
}

let db = loadData();

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(db, null, 2)
    );
  } catch (err) {
    console.error('خطأ في حفظ قاعدة البيانات:', err);
  }
}

/* =========================================================
   أدوات عامة
========================================================= */

function isGroup(ctx) {
  return (
    ctx.chat &&
    ['group', 'supergroup'].includes(ctx.chat.type)
  );
}

function isPrivate(ctx) {
  return ctx.chat && ctx.chat.type === 'private';
}

function getUser(ctx) {
  return ctx.from;
}

function getGroup(chatId) {
  const id = String(chatId);

  if (!db.groups[id]) {
    db.groups[id] = {
      ranks: {},
      interactions: {},
      warnings: {},
      muted: {},
      globalMuted: {},
      restricted: {},
      commandLocks: {},
      forbiddenWords: [],
      customReplies: {},
      customCommands: {},
      titles: {},
      protection: {
        enabled: false,
        links: true,
        mentions: true,
        forwards: true,
        ads: true,
        repetition: true,
        phoneNumbers: true,
        longMessages: true,

        photos: false,
        videos: false,
        documents: false,
        stickers: false,
        gifs: false,
        audio: false,
        voice: false,

        forbiddenWords: true,

        maxMessageLength: 1000,
        repeatLimit: 3,
        warningsEnabled: true,
        autoMute: true,
        autoBan: false
      },
      gamesLocked: false,
      cleaningAuto: false,
      economy: {},
      music: {
        queue: [],
        current: null
      }
    };
  }

  return db.groups[id];
}

function ensureUser(user) {
  if (!user) return null;

  const id = String(user.id);

  if (!db.users[id]) {
    db.users[id] = {
      id: user.id,
      username: user.username || '',
      firstName: user.first_name || '',
      balance: 0,
      bank: null,
      createdBank: false,
      messages: 0,
      wins: 0,
      answers: 0
    };
  }

  db.users[id].username = user.username || db.users[id].username;
  db.users[id].firstName =
    user.first_name || db.users[id].firstName;

  return db.users[id];
}

function touchUser(ctx) {
  const user = ensureUser(ctx.from);

  if (isGroup(ctx)) {
    const group = getGroup(ctx.chat.id);

    const uid = String(ctx.from.id);

    group.interactions[uid] =
      (group.interactions[uid] || 0) + 1;

    user.messages =
      (user.messages || 0) + 1;
  }

  saveData();

  return user;
}

/* =========================================================
   الرتب
========================================================= */

const RANKS = {
  member: {
    name: 'عضو',
    level: 0
  },

  vip: {
    name: 'مميز',
    level: 1
  },

  owner: {
    name: 'مالك',
    level: 2
  },

  basicOwner: {
    name: 'مالك أساسي',
    level: 3
  },

  myth: {
    name: 'Myth',
    level: 4
  },

  myth5: {
    name: 'Myth 🎖️',
    level: 5
  },

  dev2: {
    name: 'Dev²🎖',
    level: 6
  },

  dev: {
    name: 'Dev 🎖',
    level: 7
  }
};

function rankName(level) {
  for (const rank of Object.values(RANKS)) {
    if (rank.level === level) {
      return rank.name;
    }
  }

  return 'عضو';
}

function normalizeRank(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/ـ/g, '');
}

function parseRank(text) {
  const value = normalizeRank(text);

  if (
    value === 'مميز' ||
    value === 'vip'
  ) {
    return 1;
  }

  if (
    value === 'مالك' ||
    value === 'owner'
  ) {
    return 2;
  }

  if (
    value === 'مالك اساسي' ||
    value === 'مالك أساسي' ||
    value === 'اساس'
  ) {
    return 3;
  }

  if (
    value === 'myth' ||
    value === 'm'
  ) {
    return 4;
  }

  /*
    مهم جدًا:
    My = Myth 🎖️
  */

  if (
    value === 'my' ||
    value === 'myth 🎖️' ||
    value === 'myth 🎖' ||
    value === 'اكس'
  ) {
    return 5;
  }

  if (
    value === 'dev²' ||
    value === 'dev2' ||
    value === 'مطور ثانوي' ||
    value === 'مطوّر ثانوي'
  ) {
    return 6;
  }

  if (
    value === 'dev' ||
    value === 'ديف' ||
    value === 'مطور'
  ) {
    return 7;
  }

  return null;
}

function getRank(ctx, userId = null) {
  const group = getGroup(ctx.chat.id);

  const id = String(
    userId || ctx.from.id
  );

  const user = db.users[id];

  /*
    المالك الأساسي الثابت
  */

  if (
    user &&
    user.username &&
    user.username.toLowerCase() ===
      OWNER_USERNAME.toLowerCase()
  ) {
    return 7;
  }

  const saved = group.ranks[id];

  return Number.isInteger(saved)
    ? saved
    : 0;
}

function canUse(ctx, requiredLevel) {
  return getRank(ctx) >= requiredLevel;
}

function isProtectedUser(ctx, userId) {
  return getRank(ctx, userId) >= 3;
}

/* =========================================================
   الرد على الرسالة
========================================================= */

function replyOptions(ctx) {
  if (!ctx.message) return {};

  return {
    reply_parameters: {
      message_id: ctx.message.message_id
    }
  };
}

async function reply(ctx, text, extra = {}) {
  return ctx.reply(
    text,
    {
      ...replyOptions(ctx),
      ...extra
    }
  );
}

/* =========================================================
   رتبة مطلوبة للأمر
========================================================= */

function requiredRankMessage(level) {
  return `• الأمر متاح من رتبة ${rankName(level)} فأعلى`;
}

function devOnly(ctx) {
  if (getRank(ctx) < 7) {
    return reply(
      ctx,
      '• هذا الامر يخص ↤ ｢ Dev 🎖 ｣'
    ).then(() => false);
  }

  return Promise.resolve(true);
}

/* =========================================================
   الأوامر المعروفة
========================================================= */

const KNOWN_COMMANDS = new Set([
  'رتبتي',
  'رتبته',

  'رفع مميز',
  'رفع مالك',
  'رفع مالك أساسي',
  'رفع اساس',
  'رفع myth',
  'رفع m',
  'رفع my',
  'رفع myth 🎖️',
  'رفع myth 🎖',
  'رفع اكس',
  'رفع dev²',
  'رفع مطور ثانوي',
  'رفع ديف',

  'تنزيل',

  'تفاعلي',
  'تفاعله',
  'المتفاعلين',
  'تصفير المتفاعلين',

  'كتم',
  'كتم عام',
  'عام',
  'فك الكتم',
  'فك الكتم العام',
  'مم',
  'خخ',

  'تقييد',
  'تق',
  'الغاء التقييد',
  'إلغاء التقييد',
  'رفع القيود',
  'مق',
  'قائمة المقيدين',
  'مسح المقيدين',

  'حظر',
  'فك الحظر',
  'طرد',

  'تحذير',
  'انذار',
  'إنذار',
  'إلغاء التحذير',
  'الغاء التحذير',

  'قفل المخالفات',
  'فتح المخالفات',
  'غلق المخالفات',

  'قفل الروابط',
  'فتح الروابط',

  'قفل المنشن',
  'فتح المنشن',

  'قفل الالعاب',
  'فتح الالعاب',

  'تفعيل التنظيف التلقائي',
  'تعطيل التنظيف التلقائي',

  'تنظيف',

  'منع الكلمه',
  'الغاء منع الكلمه',
  'الكلمات الممنوعه',
  'مسح الكلمات الممنوعه',

  'قفل امر',
  'فتح امر',

  'رفع مشرف',
  'ترقيه',
  'تنزيل مشرف',
  'تنزيل المشرف',

  'صلاحياتي',
  'صلاحياته',
  'صلاحيات المستخدم',

  'لقبي',
  'لقبه',

  'اهمس',
  'همسه',
  'ه',

  'بحث',
  'بحث أغنية',
  'بحث اغنية',
  'اغنية',
  'أغنية',
  'شغل',
  'تشغيل',

  'فلوسي',
  'فلوسه',
  'المتجر',
  'انشاء حساب بنكي',
  'حسابي',
  'حذف حسابي',

  'إذاعة',
  'حالة البوت',

  'بدأت المكالمه الصوتيه',
  'انتهت المكالمه الصوتيه',
  'دعوة'
]);

function commandBase(text) {
  const value = String(text || '')
    .trim()
    .replace(/^\/+/, '')
    .split(/\s+/)[0];

  return value.toLowerCase();
}

function isKnownCommandText(text) {
  const clean = String(text || '')
    .trim();

  if (!clean) return false;

  for (const cmd of KNOWN_COMMANDS) {
    if (
      clean === cmd ||
      clean.toLowerCase() === cmd.toLowerCase() ||
      clean.startsWith(cmd + ' ')
    ) {
      return true;
    }
  }

  return false;
}

/* =========================================================
   الرتب
========================================================= */

async function handleRankCommand(ctx, text) {
  if (!isGroup(ctx)) return false;

  if (text === 'رتبتي') {
    const level = getRank(ctx);

    return reply(
      ctx,
      `• رتبتك هي ↤ ${rankName(level)}`
    ).then(() => true);
  }

  if (text === 'رتبته') {
    const target = ctx.message.reply_to_message?.from;

    if (!target) {
      await reply(
        ctx,
        '• قم بالرد على المستخدم أولًا'
      );

      return true;
    }

    return reply(
      ctx,
      `• رتبة المستخدم هي ↤ ${rankName(
        getRank(ctx, target.id)
      )}`
    ).then(() => true);
  }

  if (!text.startsWith('رفع ')) {
    if (text === 'تنزيل') {
      const target =
        ctx.message.reply_to_message?.from;

      if (!target) {
        await reply(
          ctx,
          '• قم بالرد على المستخدم أولًا'
        );

        return true;
      }

      const me = getRank(ctx);
      const targetRank = getRank(ctx, target.id);

      if (me < 6) {
        await reply(
          ctx,
          '• هذا الأمر متاح من رتبة Dev²🎖 فأعلى'
        );

        return true;
      }

      if (target.id === ctx.from.id) {
        await reply(
          ctx,
          '• لا يمكنك تنزيل رتبتك بنفسك'
        );

        return true;
      }

      if (targetRank >= me) {
        await reply(
          ctx,
          '• لا يمكنك تنزيل رتبة أعلى أو مساوية لرتبتك'
        );

        return true;
      }

      getGroup(ctx.chat.id).ranks[
        String(target.id)
      ] = Math.max(0, targetRank - 1);

      saveData();

      await reply(
        ctx,
        `• تم تنزيل رتبة ↤ ${target.first_name || 'المستخدم'}\n• الرتبة الجديدة ↤ ${rankName(
          Math.max(0, targetRank - 1)
        )}`
      );

      return true;
    }

    return false;
  }

  const requestedRank = parseRank(
    text.slice(4)
  );

  if (requestedRank === null) {
    return false;
  }

  const target =
    ctx.message.reply_to_message?.from;

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على المستخدم أولًا'
    );

    return true;
  }

  const myRank = getRank(ctx);

  if (myRank < 6) {
    await reply(
      ctx,
      '• هذا الأمر متاح من رتبة Dev²🎖 فأعلى'
    );

    return true;
  }

  if (target.id === ctx.from.id) {
    await reply(
      ctx,
      '• لا يمكنك رفع رتبتك بنفسك'
    );

    return true;
  }

  const targetRank = getRank(ctx, target.id);

  if (targetRank >= myRank) {
    await reply(
      ctx,
      '• لا يمكنك رفع رتبة أعلى أو مساوية لرتبتك'
    );

    return true;
  }

  if (requestedRank >= myRank) {
    await reply(
      ctx,
      '• لا يمكنك إعطاء رتبة مساوية أو أعلى من رتبتك'
    );

    return true;
  }

  getGroup(ctx.chat.id).ranks[
    String(target.id)
  ] = requestedRank;

  saveData();

  await reply(
    ctx,
    `• تم رفع رتبة ↤ ${target.first_name || 'المستخدم'}\n• الرتبة ↤ ${rankName(requestedRank)}`
  );

  return true;
}

/* =========================================================
   التفاعل
========================================================= */

function formatNumber(num) {
  return Number(num || 0)
    .toLocaleString('en-US');
}

async function handleInteraction(ctx, text) {
  if (!isGroup(ctx)) return false;

  const group = getGroup(ctx.chat.id);

  if (text === 'تفاعلي') {
    const uid = String(ctx.from.id);

    const count =
      group.interactions[uid] || 0;

    const sorted =
      Object.entries(group.interactions)
        .sort((a, b) => b[1] - a[1]);

    const position =
      sorted.findIndex(
        x => x[0] === uid
      ) + 1;

    await reply(
      ctx,
      `• رتبتك هي ↤ ${rankName(getRank(ctx))}

• رسائلك بالتفاعل  ↤  ${formatNumber(count)}
• ترتيبك بالمتفاعلين ↤ ${position || '-'}
-
`
    );

    return true;
  }

  if (text === 'تفاعله') {
    const target =
      ctx.message.reply_to_message?.from;

    if (!target) {
      await reply(
        ctx,
        '• قم بالرد على المستخدم أولًا'
      );

      return true;
    }

    const count =
      group.interactions[
        String(target.id)
      ] || 0;

    await reply(
      ctx,
      `• رتبة المستخدم ↤ ${rankName(
        getRank(ctx, target.id)
      )}

• رسائله بالتفاعل ↤ ${formatNumber(count)}`
    );

    return true;
  }

  if (text === 'المتفاعلين') {
    const sorted =
      Object.entries(group.interactions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

    let message =
      'توب اكثر 20 متفاعلين بالقروب :\n' +
      '━━━━━━━━━\n\n';

    const medals = ['🥇', '🥈', '🥉'];

    for (let i = 0; i < sorted.length; i++) {
      const [uid, count] = sorted[i];

      const user =
        db.users[uid];

      const name =
        user?.firstName ||
        user?.username ||
        uid;

      const prefix =
        medals[i] || `${i + 1}`;

      message +=
        `${prefix} ) ${formatNumber(count)}  l ${name}\n`;
    }

    const me =
      String(ctx.from.id);

    if (
      !sorted.some(
        x => x[0] === me
      )
    ) {
      const myCount =
        group.interactions[me] || 0;

      message +=
        `\n━━━━━━━━━\n• you)  ${formatNumber(myCount)}  l ${ctx.from.first_name || 'أنت'}`;
    }

    await reply(ctx, message);

    return true;
  }

  if (text === 'تصفير المتفاعلين') {
    if (getRank(ctx) < 6) {
      await reply(
        ctx,
        '• هذا الأمر متاح من رتبة Dev²🎖 فأعلى'
      );

      return true;
    }

    group.interactions = {};

    saveData();

    await reply(
      ctx,
      '• تم تصفير المتفاعلين بنجاح'
    );

    return true;
  }

  return false;
}

/* =========================================================
   الكتم والتقييد والحظر
========================================================= */

async function getTarget(ctx) {
  return ctx.message?.reply_to_message?.from || null;
}

async function handlePunishments(ctx, text) {
  if (!isGroup(ctx)) return false;

  const group = getGroup(ctx.chat.id);

  const target = await getTarget(ctx);

  const needTarget = [
    'كتم',
    'كتم عام',
    'فك الكتم',
    'فك الكتم العام',
    'تقييد',
    'تق',
    'الغاء التقييد',
    'إلغاء التقييد',
    'رفع القيود',
    'حظر',
    'فك الحظر',
    'طرد',
    'تحذير',
    'انذار',
    'إنذار',
    'إلغاء التحذير',
    'الغاء التحذير'
  ];

  if (needTarget.includes(text) && !target) {
    await reply(
      ctx,
      '• قم بالرد على المستخدم أولًا'
    );

    return true;
  }

  if (
    target &&
    isProtectedUser(ctx, target.id) &&
    getRank(ctx) <= getRank(ctx, target.id)
  ) {
    if (
      [
        'كتم',
        'كتم عام',
        'فك الكتم',
        'فك الكتم العام',
        'تقييد',
        'تق',
        'الغاء التقييد',
        'إلغاء التقييد',
        'رفع القيود',
        'حظر',
        'فك الحظر',
        'طرد',
        'تحذير',
        'انذار',
        'إنذار'
      ].includes(text)
    ) {
      await reply(
        ctx,
        '• لا يمكنك تنفيذ الأمر على رتبة أعلى أو مساوية لرتبتك'
      );

      return true;
    }
  }

  if (text === 'كتم') {
    if (getRank(ctx) < 3) {
      await reply(
        ctx,
        requiredRankMessage(3)
      );

      return true;
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

      group.muted[String(target.id)] = true;

      saveData();

      await reply(
        ctx,
        `• تم كتم ↤ ${target.first_name || 'المستخدم'}`
      );
    } catch {
      await reply(
        ctx,
        '• ما قدرت أكتم المستخدم، تأكد أن البوت مشرف وعنده صلاحية تقييد الأعضاء'
      );
    }

    return true;
  }

  if (text === 'فك الكتم') {
    if (getRank(ctx) < 3) {
      await reply(
        ctx,
        requiredRankMessage(3)
      );

      return true;
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
            can_add_web_page_previews: true,
            can_change_info: false,
            can_invite_users: true,
            can_pin_messages: false,
            can_manage_topics: false
          }
        }
      );

      delete group.muted[String(target.id)];

      saveData();

      await reply(
        ctx,
        `• تم فك الكتم عن ↤ ${target.first_name || 'المستخدم'}`
      );
    } catch {
      await reply(
        ctx,
        '• تعذر فك الكتم'
      );
    }

    return true;
  }

  if (text === 'كتم عام') {
    if (getRank(ctx) < 3) {
      await reply(
        ctx,
        requiredRankMessage(3)
      );

      return true;
    }

    group.globalMuted[
      String(target.id)
    ] = true;

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
    } catch {}

    saveData();

    await reply(
      ctx,
      `• تم الكتم العام لـ ↤ ${target.first_name || 'المستخدم'}`
    );

    return true;
  }

  if (
    text === 'عام' ||
    text === 'فك الكتم العام'
  ) {
    if (getRank(ctx) < 3) {
      await reply(
        ctx,
        requiredRankMessage(3)
      );

      return true;
    }

    delete group.globalMuted[
      String(target.id)
    ];

    saveData();

    await reply(
      ctx,
      `• تم فك الكتم العام عن ↤ ${target.first_name || 'المستخدم'}`
    );

    return true;
  }

  if (
    text === 'تقييد' ||
    text === 'تق'
  ) {
    if (getRank(ctx) < 3) {
      await reply(
        ctx,
        requiredRankMessage(3)
      );

      return true;
    }

    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        target.id,
        {
          permissions: {
            can_send_messages: false,
            can_send_photos: false,
            can_send_videos: false,
            can_send_audios: false,
            can_send_documents: false,
            can_send_other_messages: false
          }
        }
      );

      group.restricted[
        String(target.id)
      ] = true;

      saveData();

      await reply(
        ctx,
        `• تم تقييد ↤ ${target.first_name || 'المستخدم'}`
      );
    } catch {
      await reply(
        ctx,
        '• تأكد أن البوت مشرف وعنده صلاحية تقييد الأعضاء'
      );
    }

    return true;
  }

  if (
    text === 'الغاء التقييد' ||
    text === 'إلغاء التقييد' ||
    text === 'رفع القيود'
  ) {
    if (getRank(ctx) < 3) {
      await reply(
        ctx,
        requiredRankMessage(3)
      );

      return true;
    }

    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        target.id,
        {
          permissions: {
            can_send_messages: true,
            can_send_photos: true,
            can_send_videos: true,
            can_send_audios: true,
            can_send_documents: true,
            can_send_other_messages: true,
            can_add_web_page_previews: true,
            can_invite_users: true
          }
        }
      );

      delete group.restricted[
        String(target.id)
      ];

      saveData();

      await reply(
        ctx,
        `• تم إلغاء تقييد ↤ ${target.first_name || 'المستخدم'}`
      );
    } catch {
      await reply(
        ctx,
        '• تعذر إلغاء التقييد'
      );
    }

    return true;
  }

  if (text === 'مق' || text === 'قائمة المقيدين') {
    if (getRank(ctx) < 6) {
      await reply(
        ctx,
        requiredRankMessage(6)
      );

      return true;
    }

    const ids =
      Object.keys(group.restricted);

    if (!ids.length) {
      await reply(
        ctx,
        '• لا يوجد مقيدين'
      );

      return true;
    }

    let message =
      '• قائمة المقيدين :\n\n';

    ids.forEach((id, index) => {
      const user =
        db.users[id];

      message +=
        `${index + 1} ) ${user?.firstName || id}\n`;
    });

    await reply(ctx, message);

    return true;
  }

  if (text === 'مسح المقيدين') {
    if (getRank(ctx) < 5) {
      await reply(
        ctx,
        requiredRankMessage(5)
      );

      return true;
    }

    const ids =
      Object.keys(group.restricted);

    for (const id of ids) {
      try {
        await ctx.telegram.restrictChatMember(
          ctx.chat.id,
          Number(id),
          {
            permissions: {
              can_send_messages: true,
              can_send_photos: true,
              can_send_videos: true,
              can_send_audios: true,
              can_send_documents: true,
              can_send_other_messages: true,
              can_add_web_page_previews: true,
              can_invite_users: true
            }
          }
        );
      } catch {}
    }

    const count = ids.length;

    group.restricted = {};

    saveData();

    await reply(
      ctx,
      count
        ? `• تم مسح ( ${count} ) من المقيدين`
        : '• لا يوجد مقيدين'
    );

    return true;
  }

  if (text === 'حظر') {
    if (getRank(ctx) < 3) {
      await reply(
        ctx,
        requiredRankMessage(3)
      );

      return true;
    }

    try {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        target.id
      );

      await reply(
        ctx,
        `• تم حظر ↤ ${target.first_name || 'المستخدم'}`
      );
    } catch {
      await reply(
        ctx,
        '• تعذر حظر المستخدم'
      );
    }

    return true;
  }

  if (text === 'فك الحظر') {
    if (getRank(ctx) < 3) {
      await reply(
        ctx,
        requiredRankMessage(3)
      );

      return true;
    }

    try {
      await ctx.telegram.unbanChatMember(
        ctx.chat.id,
        target.id,
        {
          only_if_banned: true
        }
      );

      await reply(
        ctx,
        `• تم فك الحظر عن ↤ ${target.first_name || 'المستخدم'}`
      );
    } catch {
      await reply(
        ctx,
        '• تعذر فك الحظر'
      );
    }

    return true;
  }

  if (text === 'طرد') {
    if (getRank(ctx) < 3) {
      await reply(
        ctx,
        requiredRankMessage(3)
      );

      return true;
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

      await reply(
        ctx,
        `• تم طرد ↤ ${target.first_name || 'المستخدم'}`
      );
    } catch {
      await reply(
        ctx,
        '• تعذر طرد المستخدم'
      );
    }

    return true;
  }

  if (
    text === 'تحذير' ||
    text === 'انذار' ||
    text === 'إنذار'
  ) {
    if (getRank(ctx) < 3) {
      await reply(
        ctx,
        requiredRankMessage(3)
      );

      return true;
    }

    const id =
      String(target.id);

    group.warnings[id] =
      (group.warnings[id] || 0) + 1;

    const count =
      group.warnings[id];

    if (count >= 3) {
      group.warnings[id] = 0;

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
      } catch {}

      await reply(
        ctx,
        `• ${target.first_name || 'المستخدم'} وصل إلى 3 إنذارات\n• تم تنفيذ العقوبة تلقائيًا`
      );
    } else {
      await reply(
        ctx,
        `• تم إعطاء إنذار لـ ↤ ${target.first_name || 'المستخدم'}\n• عدد الإنذارات ↤ ${count}/3`
      );
    }

    saveData();

    return true;
  }

  if (
    text === 'إلغاء التحذير' ||
    text === 'الغاء التحذير'
  ) {
    if (getRank(ctx) < 3) {
      await reply(
        ctx,
        requiredRankMessage(3)
      );

      return true;
    }

    group.warnings[
      String(target.id)
    ] = 0;

    saveData();

    await reply(
      ctx,
      `• تم إلغاء إنذارات ↤ ${target.first_name || 'المستخدم'}`
    );

    return true;
  }

  if (text === 'مم') {
    if (getRank(ctx) < 5) {
      await reply(
        ctx,
        requiredRankMessage(5)
      );

      return true;
    }

    const ids =
      Object.keys(group.muted);

    for (const id of ids) {
      try {
        await ctx.telegram.restrictChatMember(
          ctx.chat.id,
          Number(id),
          {
            permissions: {
              can_send_messages: true,
              can_send_photos: true,
              can_send_videos: true,
              can_send_audios: true,
              can_send_documents: true,
              can_send_other_messages: true,
              can_add_web_page_previews: true,
              can_invite_users: true
            }
          }
        );
      } catch {}
    }

    const count = ids.length;

    group.muted = {};

    saveData();

    await reply(
      ctx,
      count
        ? `• تم مسح ( ${count} ) من المكتومين`
        : '• لا يوجد مكتومين'
    );

    return true;
  }

  if (text === 'خخ') {
    if (getRank(ctx) < 5) {
      await reply(
        ctx,
        requiredRankMessage(5)
      );

      return true;
    }

    const count =
      Object.keys(group.globalMuted).length;

    group.globalMuted = {};

    saveData();

    await reply(
      ctx,
      count
        ? `• تم مسح ( ${count} ) من المكتومين عام`
        : '• لا يوجد مكتومين'
    );

    return true;
  }

  return false;
}

/* =========================================================
   نظام الحماية
========================================================= */

function protectionCard(group, locked) {
  const status = locked
    ? '🔒 تم قفل المخالفات بنجاح'
    : '🔓 تم فتح المخالفات بنجاح';

  return `${status}

المحتوى الممنوع في المجموعة:

• المخدرات وأي شكل من أشكال التعاطي
• العنف الدموي والمشاهد المروعة
• الأسلحة النارية أو التهديد بها
• الإعلانات والروابط المزعجة
• المنشن الجماعي
• التكرار والسبام
• أرقام الجوال
• الرسائل الطويلة
• التوجيهات أو المحتوى المزعج

سيتم حذف المحتوى المخالف تلقائيًا مع
نظام إنذارات (٣ إنذارات → عقوبة).`;
}

async function handleProtectionSettings(ctx, text) {
  if (!isGroup(ctx)) return false;

  const group = getGroup(ctx.chat.id);

  if (
    text === 'قفل المخالفات' ||
    text === 'غلق المخالفات'
  ) {
    if (getRank(ctx) < 6) {
      await reply(
        ctx,
        '• هذا الامر يخص ↤ ｢ Dev²🎖 ｣'
      );

      return true;
    }

    group.protection.enabled = true;

    saveData();

    await reply(
      ctx,
      protectionCard(group, true)
    );

    return true;
  }

  if (text === 'فتح المخالفات') {
    if (getRank(ctx) < 6) {
      await reply(
        ctx,
        '• هذا الامر يخص ↤ ｢ Dev²🎖 ｣'
      );

      return true;
    }

    group.protection.enabled = false;

    saveData();

    await reply(
      ctx,
      protectionCard(group, false)
    );

    return true;
  }

  if (
    text === 'قفل الروابط' ||
    text === 'فتح الروابط'
  ) {
    if (getRank(ctx) < 6) {
      await reply(
        ctx,
        '• هذا الامر يخص ↤ ｢ Dev²🎖 ｣'
      );

      return true;
    }

    group.protection.links =
      text === 'قفل الروابط';

    saveData();

    await reply(
      ctx,
      group.protection.links
        ? '🔒 تم قفل الروابط'
        : '🔓 تم فتح الروابط'
    );

    return true;
  }

  if (
    text === 'قفل المنشن' ||
    text === 'فتح المنشن'
  ) {
    if (getRank(ctx) < 6) {
      await reply(
        ctx,
        '• هذا الامر يخص ↤ ｢ Dev²🎖 ｣'
      );

      return true;
    }

    group.protection.mentions =
      text === 'قفل المنشن';

    saveData();

    await reply(
      ctx,
      group.protection.mentions
        ? '🔒 تم قفل المنشن'
        : '🔓 تم فتح المنشن'
    );

    return true;
  }

  if (
    text === 'قفل الالعاب' ||
    text === 'فتح الالعاب'
  ) {
    if (getRank(ctx) < 7) {
      await reply(
        ctx,
        '• هذا الامر يخص ↤ ｢ Dev 🎖 ｣'
      );

      return true;
    }

    group.gamesLocked =
      text === 'قفل الالعاب';

    saveData();

    await reply(
      ctx,
      group.gamesLocked
        ? '🔒 تم قفل الألعاب'
        : '🔓 تم فتح الألعاب'
    );

    return true;
  }

  return false;
}

/* =========================================================
   فحص المخالفات
========================================================= */

function messageHasLink(text) {
  return /(https?:\/\/|www\.|t\.me\/|telegram\.me\/)/i
    .test(text);
}

function messageHasMention(text) {
  return /@\w+/i.test(text);
}

function messageHasPhone(text) {
  return /(?:\+?\d[\d\s-]{7,}\d)/.test(text);
}

function messageLooksLikeAd(text) {
  return /(للبيع|متوفر|سارع|خصم|تواصل معنا|اعلان|إعلان|للتواصل|واتساب)/i
    .test(text);
}

function messageLooksLikeForbidden(text) {
  const badWords = [
    'مخدر',
    'مخدرات',
    'تهديد',
    'قتل',
    'سلاح',
    'تفجير'
  ];

  return badWords.some(word =>
    text.toLowerCase().includes(
      word.toLowerCase()
    )
  );
}

function isMediaMessage(message) {
  return Boolean(
    message.photo ||
    message.video ||
    message.document ||
    message.sticker ||
    message.animation ||
    message.audio ||
    message.voice ||
    message.video_note
  );
}

function getMediaViolation(group, message) {
  if (message.photo && group.protection.photos)
    return 'الصور';

  if (message.video && group.protection.videos)
    return 'الفيديوهات';

  if (message.document && group.protection.documents)
    return 'الملفات';

  if (message.sticker && group.protection.stickers)
    return 'الملصقات';

  if (message.animation && group.protection.gifs)
    return 'GIF';

  if (message.audio && group.protection.audio)
    return 'الصوتيات';

  if (message.voice && group.protection.voice)
    return 'الرسائل الصوتية';

  return null;
}

async function registerViolation(
  ctx,
  reason
) {
  if (!isGroup(ctx)) return;

  const group =
    getGroup(ctx.chat.id);

  const userId =
    String(ctx.from.id);

  group.warnings[userId] =
    (group.warnings[userId] || 0) + 1;

  const count =
    group.warnings[userId];

  try {
    if (
      group.protection.enabled &&
      ctx.message?.message_id
    ) {
      await ctx.telegram.deleteMessage(
        ctx.chat.id,
        ctx.message.message_id
      );
    }
  } catch {}

  if (
    group.protection.warningsEnabled
  ) {
    try {
      await reply(
        ctx,
        `⚠️ مخالفة

• السبب ↤ ${reason}
• الإنذار ↤ ${count}/3`
      );
    } catch {}
  }

  if (
    count >= 3 &&
    group.protection.autoMute
  ) {
    group.warnings[userId] = 0;

    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        ctx.from.id,
        {
          permissions: {
            can_send_messages: false
          }
        }
      );

      group.muted[userId] = true;
    } catch {}
  }

  if (
    count >= 3 &&
    group.protection.autoBan
  ) {
    try {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        ctx.from.id
      );
    } catch {}
  }

  saveData();
}

async function checkProtection(ctx) {
  if (!isGroup(ctx)) return false;

  const group =
    getGroup(ctx.chat.id);

  if (!group.protection.enabled) {
    return false;
  }

  const userRank =
    getRank(ctx);

  /*
    الرتب الإدارية لا تدخل تحت المخالفات
  */

  if (userRank >= 3) {
    return false;
  }

  const message =
    ctx.message;

  const text =
    message?.text ||
    message?.caption ||
    '';

  /*
    لا نفحص أوامر البوت هنا.
    هذا يمنع المشكلة القديمة:
    أي كلام عادي لا يحصل على رسالة
    "هذا الأمر يخص Dev".
  */

  if (
    isKnownCommandText(text)
  ) {
    return false;
  }

  if (
    group.protection.links &&
    messageHasLink(text)
  ) {
    await registerViolation(
      ctx,
      'الروابط'
    );

    return true;
  }

  if (
    group.protection.mentions &&
    messageHasMention(text)
  ) {
    await registerViolation(
      ctx,
      'المنشن'
    );

    return true;
  }

  if (
    group.protection.phoneNumbers &&
    messageHasPhone(text)
  ) {
    await registerViolation(
      ctx,
      'أرقام الجوال'
    );

    return true;
  }

  if (
    group.protection.ads &&
    messageLooksLikeAd(text)
  ) {
    await registerViolation(
      ctx,
      'الإعلانات'
    );

    return true;
  }

  if (
    group.protection.longMessages &&
    text.length >
      group.protection.maxMessageLength
  ) {
    await registerViolation(
      ctx,
      'رسالة طويلة'
    );

    return true;
  }

  if (
    group.protection.forbiddenWords &&
    messageLooksLikeForbidden(text)
  ) {
    await registerViolation(
      ctx,
      'محتوى ممنوع'
    );

    return true;
  }

  const customBadWord =
    group.forbiddenWords.find(word =>
      text.toLowerCase()
        .includes(
          String(word).toLowerCase()
        )
    );

  if (customBadWord) {
    await registerViolation(
      ctx,
      `الكلمة الممنوعة: ${customBadWord}`
    );

    return true;
  }

  if (message.forward_origin &&
      group.protection.forwards) {
    await registerViolation(
      ctx,
      'إعادة التوجيه'
    );

    return true;
  }

  const mediaViolation =
    getMediaViolation(
      group,
      message
    );

  if (mediaViolation) {
    await registerViolation(
      ctx,
      mediaViolation
    );

    return true;
  }

  return false;
}

/* =========================================================
   الكلمات الممنوعة
========================================================= */

async function handleForbiddenWords(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  const group =
    getGroup(ctx.chat.id);

  if (
    text.startsWith('منع الكلمه ')
  ) {
    if (getRank(ctx) < 6) {
      await reply(
        ctx,
        requiredRankMessage(6)
      );

      return true;
    }

    const word =
      text.slice(
        'منع الكلمه '.length
      ).trim();

    if (!word) {
      await reply(
        ctx,
        '• اكتب الكلمة بعد الأمر'
      );

      return true;
    }

    if (
      !group.forbiddenWords.includes(word)
    ) {
      group.forbiddenWords.push(word);
    }

    saveData();

    await reply(
      ctx,
      `• تم منع الكلمة ↤ ${word}`
    );

    return true;
  }

  if (
    text.startsWith('الغاء منع الكلمه ')
  ) {
    if (getRank(ctx) < 6) {
      await reply(
        ctx,
        requiredRankMessage(6)
      );

      return true;
    }

    const word =
      text.slice(
        'الغاء منع الكلمه '.length
      ).trim();

    group.forbiddenWords =
      group.forbiddenWords.filter(
        x => x !== word
      );

    saveData();

    await reply(
      ctx,
      `• تم إلغاء منع ↤ ${word}`
    );

    return true;
  }

  if (text === 'الكلمات الممنوعه') {
    const words =
      group.forbiddenWords;

    await reply(
      ctx,
      words.length
        ? `• الكلمات الممنوعة:\n\n${words.map((x, i) => `${i + 1} ) ${x}`).join('\n')}`
        : '• لا توجد كلمات ممنوعة'
    );

    return true;
  }

  if (text === 'مسح الكلمات الممنوعه') {
    if (getRank(ctx) < 6) {
      await reply(
        ctx,
        requiredRankMessage(6)
      );

      return true;
    }

    group.forbiddenWords = [];

    saveData();

    await reply(
      ctx,
      '• تم مسح الكلمات الممنوعة'
    );

    return true;
  }

  return false;
}

/* =========================================================
   قفل الأوامر
========================================================= */

function normalizeCommandName(text) {
  return String(text || '')
    .trim()
    .toLowerCase();
}

async function handleCommandLock(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  const group =
    getGroup(ctx.chat.id);

  if (text === 'قفل امر') {
    if (getRank(ctx) < 7) {
      await reply(
        ctx,
        '• هذا الامر يخص ↤ ｢ Dev 🎖 ｣'
      );

      return true;
    }

    group.pendingLock = {
      userId: ctx.from.id,
      action: 'lock-command'
    };

    saveData();

    await reply(
      ctx,
      '• حسنًا عزيزي قم بإرسال الأمر الان :'
    );

    return true;
  }

  if (text === 'فتح امر') {
    if (getRank(ctx) < 7) {
      await reply(
        ctx,
        '• هذا الامر يخص ↤ ｢ Dev 🎖 ｣'
      );

      return true;
    }

    group.pendingLock = {
      userId: ctx.from.id,
      action: 'unlock-command'
    };

    saveData();

    await reply(
      ctx,
      '• حسنًا عزيزي قم بإرسال الأمر الان :'
    );

    return true;
  }

  if (
    group.pendingLock &&
    group.pendingLock.userId === ctx.from.id
  ) {
    const pending =
      group.pendingLock;

    if (
      !pending.command
    ) {
      pending.command =
        normalizeCommandName(text);

      await reply(
        ctx,
        '• حسنًا عزيزي قم بإرسال الرتبة الان :'
      );

      saveData();

      return true;
    }

    const level =
      parseRank(text);

    if (level === null) {
      await reply(
        ctx,
        '• الرتبة غير معروفة'
      );

      return true;
    }

    const command =
      pending.command;

    if (
      pending.action ===
      'lock-command'
    ) {
      group.commandLocks[command] =
        level;

      await reply(
        ctx,
        `🔒 تم قفل الأمر بنجاح

• الأمر ↤ ${command}
• متاح من رتبة ↤ ${rankName(level)} فأعلى`
      );
    } else {
      delete group.commandLocks[command];

      await reply(
        ctx,
        `🔓 تم فتح الأمر ↤ ${command}`
      );
    }

    delete group.pendingLock;

    saveData();

    return true;
  }

  return false;
}

async function checkCommandLock(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  const group =
    getGroup(ctx.chat.id);

  const normalized =
    normalizeCommandName(text);

  let required = null;

  for (
    const [command, level]
    of Object.entries(
      group.commandLocks
    )
  ) {
    if (
      normalized === command ||
      normalized.startsWith(
        command + ' '
      )
    ) {
      required = level;
      break;
    }
  }

  if (required === null) {
    return false;
  }

  if (
    getRank(ctx) >= required
  ) {
    return false;
  }

  await reply(
    ctx,
    `• الأمر متاح من رتبة ${rankName(required)} فأعلى`
  );

  return true;
}

/* =========================================================
   رفع مشرف + الصلاحيات
========================================================= */

const ADMIN_RIGHTS = [
  {
    key: 'can_change_info',
    label: 'تغيير معلومات المجموعة'
  },
  {
    key: 'can_delete_messages',
    label: 'مسح الرسائل'
  },
  {
    key: 'can_restrict_members',
    label: 'حظر / تقييد المستخدمين'
  },
  {
    key: 'can_invite_users',
    label: 'دعوة المستخدمين'
  },
  {
    key: 'can_pin_messages',
    label: 'تثبيت الرسائل'
  },
  {
    key: 'can_manage_video_chats',
    label: 'إدارة المكالمات'
  },
  {
    key: 'can_promote_members',
    label: 'إضافة مشرفين'
  }
];

async function adminKeyboard(
  chatId,
  userId
) {
  const group =
    getGroup(chatId);

  if (!group.adminSessions) {
    group.adminSessions = {};
  }

  if (!group.adminSessions[String(userId)]) {
    group.adminSessions[String(userId)] = {};
  }

  const current =
    group.adminSessions[String(userId)];

  const rows = [];

  for (const right of ADMIN_RIGHTS) {
    const enabled =
      current[right.key] === true;

    rows.push([
      Markup.button.callback(
        `${enabled ? '☑️' : '⬜️'} ${right.label}`,
        `admin_toggle:${userId}:${right.key}`
      )
    ]);
  }

  rows.push([
    Markup.button.callback(
      '✅ تأكيد رفع المشرف',
      `admin_confirm:${userId}`
    )
  ]);

  rows.push([
    Markup.button.callback(
      '❌ إلغاء',
      `admin_cancel:${userId}`
    )
  ]);

  return Markup.inlineKeyboard(rows);
}

async function handlePromoteAdmin(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  if (
    text !== 'رفع مشرف' &&
    text !== 'ترقيه' &&
    text !== 'تنزيل مشرف' &&
    text !== 'تنزيل المشرف'
  ) {
    return false;
  }

  if (getRank(ctx) < 7) {
    await reply(
      ctx,
      '• هذا الامر يخص ↤ ｢ Dev 🎖 ｣'
    );

    return true;
  }

  const target =
    await getTarget(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على المستخدم أولًا'
    );

    return true;
  }

  const targetRank =
    getRank(ctx, target.id);

  if (
    targetRank >= 3
  ) {
    await reply(
      ctx,
      '• لا يمكن رفع مالك أو رتبة أعلى كمشرف بهذه الطريقة'
    );

    return true;
  }

  if (
    text === 'تنزيل مشرف' ||
    text === 'تنزيل المشرف'
  ) {
    try {
      await ctx.telegram.promoteChatMember(
        ctx.chat.id,
        target.id,
        {
          is_anonymous: false,
          can_manage_chat: false,
          can_delete_messages: false,
          can_restrict_members: false,
          can_promote_members: false,
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false,
          can_manage_video_chats: false
        }
      );

      await reply(
        ctx,
        `• تم تنزيل المشرف ↤ ${target.first_name || 'المستخدم'}`
      );
    } catch {
      await reply(
        ctx,
        '• تعذر تنزيل المشرف، تأكد من صلاحيات البوت'
      );
    }

    return true;
  }

  const group =
    getGroup(ctx.chat.id);

  if (!group.adminSessions) {
    group.adminSessions = {};
  }

  group.adminSessions[
    String(ctx.from.id)
  ] = {
    targetId: target.id,
    targetName:
      target.first_name || 'المستخدم',
    can_change_info: false,
    can_delete_messages: true,
    can_restrict_members: false,
    can_invite_users: false,
    can_pin_messages: false,
    can_manage_video_chats: false,
    can_promote_members: false
  };

  saveData();

  await reply(
    ctx,
    `• صلاحيات المستخدم ↤ ${target.first_name || 'المستخدم'}

• اضغط «تعديل الصلاحيات» لاختيار الصلاحيات`,
    {
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            'تعديل الصلاحيات',
            `admin_edit:${ctx.from.id}`
          )
        ],
        [
          Markup.button.callback(
            'إلغاء',
            `admin_cancel:${ctx.from.id}`
          )
        ]
      ])
    }
  );

  return true;
}

/* =========================================================
   الهمسات
========================================================= */

function makeId(prefix = 'w') {
  return (
    prefix +
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2, 8)
  );
}

async function getBotUsername() {
  const me =
    await bot.telegram.getMe();

  return me.username;
}

async function handleWhisper(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  if (
    text !== 'اهمس' &&
    text !== 'همسه' &&
    text !== 'ه'
  ) {
    return false;
  }

  const target =
    await getTarget(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على الشخص الذي تريد إرسال الهمسة له أولًا'
    );

    return true;
  }

  if (
    target.id === ctx.from.id
  ) {
    await reply(
      ctx,
      '• ما تقدر ترسل همسة لنفسك'
    );

    return true;
  }

  const id =
    makeId();

  db.whispers[id] = {
    id,
    chatId: ctx.chat.id,
    senderId: ctx.from.id,
    senderName:
      ctx.from.first_name || 'المستخدم',
    receiverId: target.id,
    receiverName:
      target.first_name || 'المستخدم',
    content: null,
    contentType: null,
    createdAt: Date.now(),
    viewed: false
  };

  const username =
    await getBotUsername();

  const deepLink =
    `https://t.me/${username}?start=whisper_${id}`;

  saveData();

  await reply(
    ctx,
    `• تم تحديد الهمسة لـ ↤ ${target.first_name || 'المستخدم'}
• اضغط الزر لكتابة الهمسة`,
    {
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            'اهمس هنا',
            deepLink
          )
        ]
      ])
    }
  );

  return true;
}

/* =========================================================
   /start والهمسة الخاصة
========================================================= */

bot.start(async ctx => {
  ensureUser(ctx.from);

  const payload =
    ctx.startPayload || '';

  if (
    payload.startsWith('whisper_')
  ) {
    const id =
      payload.slice('whisper_'.length);

    const whisper =
      db.whispers[id];

    if (!whisper) {
      return ctx.reply(
        '• الهمسة غير موجودة أو انتهت'
      );
    }

    if (
      ctx.from.id !==
      whisper.receiverId
    ) {
      return ctx.reply(
        '• هذه الهمسة ليست موجهة لك'
      );
    }

    if (!whisper.content) {
      db.whispers[id].waitingForContent =
        ctx.from.id;

      saveData();

      return ctx.reply(
        '• أرسل الآن محتوى الهمسة هنا بالخاص\n\nيمكنك إرسال نص أو صورة أو ملصق أو GIF أو فيديو أو ملف أو صوت.'
      );
    }

    await sendWhisperContent(
      ctx,
      whisper
    );

    return;
  }

  await ctx.reply(
    `أهلا بك يا قلبي

• انا اشغل لك اللي تبي بالمكالمه

ادعم هالمنصات كلها :
يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.`,
    Markup.inlineKeyboard([
      [
        Markup.button.url(
          'اضفني الى مجموعتك',
          `https://t.me/${(await getBotUsername())}?startgroup=true`
        )
      ],
      [
        Markup.button.url(
          'المطور',
          'https://t.me/j4xa7'
        )
      ]
    ])
  );

  if (
    !db.subscribers.includes(
      ctx.from.id
    )
  ) {
    db.subscribers.push(
      ctx.from.id
    );

    saveData();
  }
});

/* =========================================================
   إرسال محتوى الهمسة
========================================================= */

async function sendWhisperContent(
  ctx,
  whisper
) {
  if (
    ctx.from.id !==
    whisper.receiverId
  ) {
    return;
  }

  if (!whisper.content) {
    return;
  }

  if (
    whisper.contentType === 'text'
  ) {
    await ctx.reply(
      `• همسة من ↤ ${whisper.senderName}

${whisper.content}`
    );
  } else if (
    whisper.contentType === 'photo'
  ) {
    await ctx.replyWithPhoto(
      whisper.content,
      {
        caption:
          `• همسة من ↤ ${whisper.senderName}`
      }
    );
  } else if (
    whisper.contentType === 'video'
  ) {
    await ctx.replyWithVideo(
      whisper.content,
      {
        caption:
          `• همسة من ↤ ${whisper.senderName}`
      }
    );
  } else if (
    whisper.contentType === 'document'
  ) {
    await ctx.replyWithDocument(
      whisper.content
    );
  } else if (
    whisper.contentType === 'sticker'
  ) {
    await ctx.replyWithSticker(
      whisper.content
    );
  } else if (
    whisper.contentType === 'animation'
  ) {
    await ctx.replyWithAnimation(
      whisper.content
    );
  } else if (
    whisper.contentType === 'audio'
  ) {
    await ctx.replyWithAudio(
      whisper.content
    );
  } else if (
    whisper.contentType === 'voice'
  ) {
    await ctx.replyWithVoice(
      whisper.content
    );
  }

  whisper.viewed = true;

  saveData();

  try {
    await ctx.telegram.sendMessage(
      whisper.senderId,
      `• تم فتح الهمسة من ↤ ${whisper.receiverName}`
    );
  } catch {}
}

/* =========================================================
   استقبال محتوى الهمسة في الخاص
========================================================= */

bot.on('message', async ctx => {
  if (!isPrivate(ctx)) return;

  const waiting =
    Object.values(
      db.whispers
    ).find(
      w =>
        w.waitingForContent ===
          ctx.from.id &&
        !w.content
    );

  if (!waiting) return;

  const message =
    ctx.message;

  if (message.text) {
    waiting.content =
      message.text;

    waiting.contentType =
      'text';
  } else if (
    message.photo
  ) {
    waiting.content =
      message.photo[
        message.photo.length - 1
      ].file_id;

    waiting.contentType =
      'photo';
  } else if (
    message.video
  ) {
    waiting.content =
      message.video.file_id;

    waiting.contentType =
      'video';
  } else if (
    message.document
  ) {
    waiting.content =
      message.document.file_id;

    waiting.contentType =
      'document';
  } else if (
    message.sticker
  ) {
    waiting.content =
      message.sticker.file_id;

    waiting.contentType =
      'sticker';
  } else if (
    message.animation
  ) {
    waiting.content =
      message.animation.file_id;

    waiting.contentType =
      'animation';
  } else if (
    message.audio
  ) {
    waiting.content =
      message.audio.file_id;

    waiting.contentType =
      'audio';
  } else if (
    message.voice
  ) {
    waiting.content =
      message.voice.file_id;

    waiting.contentType =
      'voice';
  } else {
    return ctx.reply(
      '• هذا النوع من المحتوى غير مدعوم للهمسة'
    );
  }

  delete waiting.waitingForContent;

  saveData();

  const username =
    await getBotUsername();

  const viewLink =
    `https://t.me/${username}?start=whisper_${waiting.id}`;

  await ctx.reply(
    '• تم إرسال الهمسة بنجاح',
    Markup.inlineKeyboard([
      [
        Markup.button.url(
          'رؤية الهمسة',
          viewLink
        )
      ]
    ])
  );

  try {
    await ctx.telegram.sendMessage(
      waiting.receiverId,
      `• وصلتك همسة سرية من ↤ ${waiting.senderName}

• أنت وحدك تقدر تشوفها`,
      Markup.inlineKeyboard([
        [
          Markup.button.url(
            'رؤية الهمسة',
            viewLink
          )
        ]
      ])
    );
  } catch {}

  try {
    await ctx.telegram.sendMessage(
      waiting.chatId,
      `• وصلت همسة سرية من ↤ ${waiting.senderName} إلى ↤ ${waiting.receiverName}`
    );
  } catch {}
});

/* =========================================================
   الرد على الهمسة
========================================================= */

bot.action(
  /^whisper_reply:(.+)$/,
  async ctx => {
    const id =
      ctx.match[1];

    const whisper =
      db.whispers[id];

    if (!whisper) {
      return ctx.answerCbQuery(
        'الهمسة غير موجودة'
      );
    }

    if (
      ctx.from.id !==
      whisper.receiverId
    ) {
      return ctx.answerCbQuery(
        'هذه الهمسة ليست لك',
        {
          show_alert: true
        }
      );
    }

    const username =
      await getBotUsername();

    const link =
      `https://t.me/${username}?start=whisperreply_${id}`;

    await ctx.answerCbQuery();

    await ctx.reply(
      '• اضغط الزر لإرسال ردك على الهمسة',
      Markup.inlineKeyboard([
        [
          Markup.button.url(
            'رد على الهمسة',
            link
          )
        ]
      ])
    );
  }
);

/* =========================================================
   أزرار الهمسة
========================================================= */

bot.action(
  /^whisper_view:(.+)$/,
  async ctx => {
    const id =
      ctx.match[1];

    const whisper =
      db.whispers[id];

    if (!whisper) {
      return ctx.answerCbQuery(
        'الهمسة غير موجودة',
        {
          show_alert: true
        }
      );
    }

    if (
      ctx.from.id !==
      whisper.receiverId
    ) {
      return ctx.answerCbQuery(
        'هذه الهمسة ليست لك',
        {
          show_alert: true
        }
      );
    }

    await ctx.answerCbQuery();

    await sendWhisperContent(
      ctx,
      whisper
    );
  }
);

/* =========================================================
   الرد على الهمسة عبر /start
========================================================= */

bot.start(async ctx => {
  const payload =
    ctx.startPayload || '';

  if (
    !payload.startsWith(
      'whisperreply_'
    )
  ) {
    return;
  }

  const id =
    payload.slice(
      'whisperreply_'.length
    );

  const whisper =
    db.whispers[id];

  if (!whisper) {
    return ctx.reply(
      '• الهمسة غير موجودة'
    );
  }

  if (
    ctx.from.id !==
    whisper.receiverId
  ) {
    return ctx.reply(
      '• هذا الرد غير مخصص لك'
    );
  }

  db.whispers[id].waitingForReply =
    ctx.from.id;

  saveData();

  await ctx.reply(
    '• ارسل الآن ردك على الهمسة'
  );
});

/* =========================================================
   استقبال رد الهمسة
========================================================= */

bot.on('text', async ctx => {
  if (!isPrivate(ctx)) return;

  const waiting =
    Object.values(
      db.whispers
    ).find(
      w =>
        w.waitingForReply ===
        ctx.from.id
    );

  if (!waiting) return;

  delete waiting.waitingForReply;

  saveData();

  try {
    await ctx.telegram.sendMessage(
      waiting.senderId,
      `• وصلك رد على الهمسة من ↤ ${ctx.from.first_name || 'المستخدم'}

${ctx.message.text}`
    );

    await ctx.reply(
      '• تم إرسال ردك على الهمسة بنجاح'
    );
  } catch {
    await ctx.reply(
      '• تعذر إرسال الرد'
    );
  }
});

/* =========================================================
   أزرار رفع المشرف
========================================================= */

bot.action(
  /^admin_edit:(\d+)$/,
  async ctx => {
    const ownerId =
      Number(ctx.match[1]);

    if (
      ctx.from.id !== ownerId
    ) {
      return ctx.answerCbQuery(
        'هذه القائمة ليست لك',
        {
          show_alert: true
        }
      );
    }

    const group =
      getGroup(ctx.chat.id);

    if (
      !group.adminSessions ||
      !group.adminSessions[
        String(ownerId)
      ]
    ) {
      return ctx.answerCbQuery(
        'انتهت العملية',
        {
          show_alert: true
        }
      );
    }

    await ctx.answerCbQuery();

    await ctx.editMessageReplyMarkup(
      (
        await adminKeyboard(
          ctx.chat.id,
          ownerId
        )
      ).reply_markup
    );
  }
);

bot.action(
  /^admin_toggle:(\d+):(.+)$/,
  async ctx => {
    const ownerId =
      Number(ctx.match[1]);

    const key =
      ctx.match[2];

    if (
      ctx.from.id !== ownerId
    ) {
      return ctx.answerCbQuery(
        'ليست لك',
        {
          show_alert: true
        }
      );
    }

    const group =
      getGroup(ctx.chat.id);

    const session =
      group.adminSessions?.[
        String(ownerId)
      ];

    if (!session) {
      return ctx.answerCbQuery(
        'انتهت العملية',
        {
          show_alert: true
        }
      );
    }

    session[key] =
      !session[key];

    saveData();

    await ctx.answerCbQuery();

    await ctx.editMessageReplyMarkup(
      (
        await adminKeyboard(
          ctx.chat.id,
          ownerId
        )
      ).reply_markup
    );
  }
);

bot.action(
  /^admin_confirm:(\d+)$/,
  async ctx => {
    const ownerId =
      Number(ctx.match[1]);

    if (
      ctx.from.id !== ownerId
    ) {
      return ctx.answerCbQuery(
        'ليست لك',
        {
          show_alert: true
        }
      );
    }

    const group =
      getGroup(ctx.chat.id);

    const session =
      group.adminSessions?.[
        String(ownerId)
      ];

    if (!session) {
      return ctx.answerCbQuery(
        'انتهت العملية',
        {
          show_alert: true
        }
      );
    }

    try {
      await ctx.telegram.promoteChatMember(
        ctx.chat.id,
        session.targetId,
        {
          is_anonymous: false,

          can_change_info:
            !!session.can_change_info,

          can_delete_messages:
            !!session.can_delete_messages,

          can_restrict_members:
            !!session.can_restrict_members,

          can_invite_users:
            !!session.can_invite_users,

          can_pin_messages:
            !!session.can_pin_messages,

          can_manage_video_chats:
            !!session.can_manage_video_chats,

          can_promote_members:
            !!session.can_promote_members
        }
      );

      delete group.adminSessions[
        String(ownerId)
      ];

      saveData();

      await ctx.answerCbQuery(
        'تم رفع المشرف بنجاح'
      );

      await ctx.editMessageText(
        `• تم رفع مشرف بنجاح

• المستخدم ↤ ${session.targetName}

• تم تطبيق الصلاحيات المحددة`
      );
    } catch (err) {
      console.error(
        'promoteChatMember:',
        err
      );

      await ctx.answerCbQuery(
        'تعذر رفع المشرف',
        {
          show_alert: true
        }
      );
    }
  }
);

bot.action(
  /^admin_cancel:(\d+)$/,
  async ctx => {
    const ownerId =
      Number(ctx.match[1]);

    if (
      ctx.from.id !== ownerId
    ) {
      return ctx.answerCbQuery(
        'ليست لك',
        {
          show_alert: true
        }
      );
    }

    const group =
      getGroup(ctx.chat.id);

    if (group.adminSessions) {
      delete group.adminSessions[
        String(ownerId)
      ];
    }

    saveData();

    await ctx.answerCbQuery(
      'تم الإلغاء'
    );

    try {
      await ctx.deleteMessage();
    } catch {}
  }
);

/* =========================================================
   صلاحياتي
========================================================= */

async function handlePermissions(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  if (
    text !== 'صلاحياتي' &&
    text !== 'صلاحياته' &&
    text !== 'صلاحيات المستخدم'
  ) {
    return false;
  }

  const target =
    text === 'صلاحياتي'
      ? ctx.from
      : await getTarget(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على المستخدم أولًا'
    );

    return true;
  }

  try {
    const member =
      await ctx.telegram.getChatMember(
        ctx.chat.id,
        target.id
      );

    if (
      member.status !==
        'administrator' &&
      member.status !==
        'creator'
    ) {
      await reply(
        ctx,
        '• المستخدم ليس مشرفًا'
      );

      return true;
    }

    const p =
      member.status === 'creator'
        ? {
            can_change_info: true,
            can_delete_messages: true,
            can_restrict_members: true,
            can_invite_users: true,
            can_pin_messages: true,
            can_manage_video_chats: true,
            can_promote_members: true
          }
        : member;

    const lines = [
      `• صلاحيات ↤ ${target.first_name || 'المستخدم'}`,
      '',
      `• تغيير معلومات المجموعة ↤ ${p.can_change_info ? 'نعم' : 'لا'}`,
      `• مسح الرسائل ↤ ${p.can_delete_messages ? 'نعم' : 'لا'}`,
      `• حظر المستخدمين ↤ ${p.can_restrict_members ? 'نعم' : 'لا'}`,
      `• دعوة المستخدمين ↤ ${p.can_invite_users ? 'نعم' : 'لا'}`,
      `• تثبيت الرسائل ↤ ${p.can_pin_messages ? 'نعم' : 'لا'}`,
      `• إدارة المكالمات ↤ ${p.can_manage_video_chats ? 'نعم' : 'لا'}`,
      `• إضافة مشرفين ↤ ${p.can_promote_members ? 'نعم' : 'لا'}`
    ];

    await reply(
      ctx,
      lines.join('\n')
    );
  } catch {
    await reply(
      ctx,
      '• تعذر جلب صلاحيات المستخدم'
    );
  }

  return true;
}

/* =========================================================
   بحث الأغاني
========================================================= */

async function searchSongs(
  query
) {
  if (!ytSearch) {
    return [];
  }

  try {
    const result =
      await ytSearch(query);

    return result.videos
      .slice(0, 8)
      .map(video => ({
        id: video.videoId,
        title: video.title,
        author:
          video.author?.name ||
          'Unknown',
        duration:
          video.timestamp ||
          'غير معروف',
        url: video.url
      }));
  } catch (err) {
    console.error(
      'music search:',
      err
    );

    return [];
  }
}

async function handleMusic(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  let query = null;

  const prefixes = [
    'بحث أغنية ',
    'بحث اغنية ',
    'بحث ',
    'اغنية ',
    'أغنية ',
    'شغل ',
    'تشغيل '
  ];

  for (const prefix of prefixes) {
    if (
      text.toLowerCase()
        .startsWith(
          prefix.toLowerCase()
        )
    ) {
      query =
        text.slice(
          prefix.length
        ).trim();

      break;
    }
  }

  if (!query) {
    return false;
  }

  if (!ytSearch) {
    await reply(
      ctx,
      '• بحث الأغاني يحتاج تثبيت مكتبة yt-search\n\nnpm install yt-search'
    );

    return true;
  }

  await reply(
    ctx,
    `🎵 جاري البحث عن:\n${query}`
  );

  const results =
    await searchSongs(query);

  if (!results.length) {
    await reply(
      ctx,
      '• ما حصلت نتيجة'
    );

    return true;
  }

  const buttons =
    results.map(
      (song, index) => [
        Markup.button.callback(
          `${index + 1} • ${song.title.slice(0, 35)}`,
          `song:${song.id}`
        )
      ]
    );

  let message =
    '🎵 نتائج البحث\n\n';

  results.forEach(
    (song, index) => {
      message +=
        `${index + 1} ) ${song.title}\n` +
        `• الفنان ↤ ${song.author}\n` +
        `• المدة ↤ ${song.duration}\n\n`;
    }
  );

  await reply(
    ctx,
    message,
    Markup.inlineKeyboard(
      buttons
    )
  );

  return true;
}

bot.action(
  /^song:(.+)$/,
  async ctx => {
    const videoId =
      ctx.match[1];

    if (!ytSearch) {
      return ctx.answerCbQuery(
        'yt-search غير مثبت',
        {
          show_alert: true
        }
      );
    }

    try {
      const result =
        await ytSearch({
          query:
            videoId
        });

      let song =
        result.videos.find(
          x =>
            x.videoId ===
            videoId
        );

      if (!song) {
        song = result.videos[0];
      }

      if (!song) {
        return ctx.answerCbQuery(
          'الأغنية غير موجودة',
          {
            show_alert: true
          }
        );
      }

      await ctx.answerCbQuery(
        'تم اختيار الأغنية'
      );

      await ctx.reply(
        `🎵 ${song.title}

• الفنان ↤ ${song.author?.name || 'غير معروف'}
• المدة ↤ ${song.timestamp || 'غير معروف'}

• ${song.url}

⚠️ التشغيل الفعلي داخل المكالمة الصوتية يحتاج عميل MTProto/حساب مستخدم، أما البوت وحده فيستطيع البحث وإرسال معلومات الأغنية.`
      );
    } catch {
      await ctx.answerCbQuery(
        'حدث خطأ',
        {
          show_alert: true
        }
      );
    }
  }
);

/* =========================================================
   الألقاب
========================================================= */

async function handleTitles(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  const group =
    getGroup(ctx.chat.id);

  if (text === 'لقبي') {
    const title =
      group.titles[
        String(ctx.from.id)
      ];

    await reply(
      ctx,
      `• لقبك ↤ ${title || 'لا يوجد'}`
    );

    return true;
  }

  if (text === 'لقبه') {
    const target =
      await getTarget(ctx);

    if (!target) {
      await reply(
        ctx,
        '• قم بالرد على المستخدم أولًا'
      );

      return true;
    }

    const title =
      group.titles[
        String(target.id)
      ];

    await reply(
      ctx,
      `• لقب المستخدم ↤ ${title || 'لا يوجد'}`
    );

    return true;
  }

  if (
    text.startsWith('ضع ')
  ) {
    if (getRank(ctx) < 5) {
      await reply(
        ctx,
        requiredRankMessage(5)
      );

      return true;
    }

    const target =
      await getTarget(ctx);

    if (!target) {
      await reply(
        ctx,
        '• قم بالرد على المستخدم أولًا'
      );

      return true;
    }

    const title =
      text.slice(3).trim();

    group.titles[
      String(target.id)
    ] = title;

    saveData();

    await reply(
      ctx,
      `• تم وضع اللقب ↤ ${title}`
    );

    return true;
  }

  return false;
}

/* =========================================================
   الاقتصاد
========================================================= */

async function handleEconomy(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  const user =
    ensureUser(ctx.from);

  if (text === 'فلوسي') {
    await reply(
      ctx,
      `• رصيدك ↤ ${formatNumber(
        user.balance
      )} ريال`
    );

    return true;
  }

  if (text === 'فلوسه') {
    const target =
      await getTarget(ctx);

    if (!target) {
      await reply(
        ctx,
        '• قم بالرد على المستخدم أولًا'
      );

      return true;
    }

    const targetUser =
      ensureUser(target);

    await reply(
      ctx,
      `• رصيد ${target.first_name || 'المستخدم'} ↤ ${formatNumber(
        targetUser.balance
      )} ريال`
    );

    return true;
  }

  if (text === 'انشاء حساب بنكي') {
    if (user.createdBank) {
      await reply(
        ctx,
        '• لديك حساب بنكي بالفعل'
      );

      return true;
    }

    user.createdBank = true;
    user.bank = 'basic';

    saveData();

    await reply(
      ctx,
      '• تم إنشاء حسابك البنكي بنجاح'
    );

    return true;
  }

  if (text === 'حسابي') {
    await reply(
      ctx,
      `• معلومات حسابك

• الرصيد ↤ ${formatNumber(user.balance)}
• البنك ↤ ${user.bank || 'لا يوجد'}
• الرسائل ↤ ${formatNumber(user.messages)}
• الانتصارات ↤ ${formatNumber(user.wins)}`
    );

    return true;
  }

  if (text === 'حذف حسابي') {
    user.createdBank = false;
    user.bank = null;

    saveData();

    await reply(
      ctx,
      '• تم حذف حسابك البنكي'
    );

    return true;
  }

  return false;
}

/* =========================================================
   تنظيف
========================================================= */

async function handleCleaning(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  if (
    !(
      text === 'تنظيف' ||
      /^تنظيف\s+\d+$/.test(text)
    )
  ) {
    return false;
  }

  if (getRank(ctx) < 5) {
    await reply(
      ctx,
      requiredRankMessage(5)
    );

    return true;
  }

  const parts =
    text.split(/\s+/);

  const type =
    parts.length > 1
      ? Number(parts[1])
      : 9;

  const names = {
    0: 'النصوص',
    1: 'الصور',
    2: 'الفيديو',
    3: 'الملفات',
    4: 'الملصقات',
    5: 'GIF',
    6: 'الصوتيات',
    7: 'الرسائل الصوتية',
    8: 'الروابط',
    9: 'الكل'
  };

  if (
    !Object.prototype.hasOwnProperty.call(
      names,
      type
    )
  ) {
    await reply(
      ctx,
      '• اختر رقم من 0 إلى 9'
    );

    return true;
  }

  await reply(
    ctx,
    `• تم بدء تنظيف ${names[type]}`
  );

  /*
    Telegram لا يوفر للبوت قائمة تاريخية كاملة
    للرسائل؛ لذلك التنظيف يعتمد على الرسائل
    التي يستطيع البوت الوصول لها، وليس على تخمين
    معرفات عشوائية.
  */

  return true;
}

/* =========================================================
   المكالمات الصوتية
========================================================= */

bot.on('message', async ctx => {
  if (!isGroup(ctx)) return;

  if (
    ctx.message.video_chat_started
  ) {
    await reply(
      ctx,
      '• بدأت المكالمه الصوتيه 🎙️'
    );
  }

  if (
    ctx.message.video_chat_ended
  ) {
    await reply(
      ctx,
      '• انتهت المكالمه الصوتيه'
    );
  }
});

/* =========================================================
   دعوة البوت
========================================================= */

bot.on('text', async ctx => {
  if (
    !isGroup(ctx) ||
    ctx.message.text !== 'دعوة'
  ) {
    return;
  }

  const username =
    await getBotUsername();

  await reply(
    ctx,
    '• تقدر تضيفني لمجموعتك من الزر',
    Markup.inlineKeyboard([
      [
        Markup.button.url(
          '➕ إضافة البوت',
          `https://t.me/${username}?startgroup=true`
        )
      ]
    ])
  );
});

/* =========================================================
   التعامل الرئيسي مع أوامر القروب
========================================================= */

bot.on('text', async ctx => {
  if (!isGroup(ctx)) return;

  const text =
    ctx.message.text.trim();

  if (!text) return;

  touchUser(ctx);

  /*
    مهم:
    الحماية أولًا، لكن لا تفحص الأوامر.
  */

  const violated =
    await checkProtection(ctx);

  if (violated) return;

  /*
    جلسة قفل الأوامر
  */

  const lockHandled =
    await handleCommandLock(
      ctx,
      text
    );

  if (lockHandled) return;

  /*
    فحص قفل الأمر
  */

  const commandLocked =
    await checkCommandLock(
      ctx,
      text
    );

  if (commandLocked) return;

  /*
    الأوامر الأساسية
  */

  if (
    await handleRankCommand(
      ctx,
      text
    )
  ) return;

  if (
    await handleInteraction(
      ctx,
      text
    )
  ) return;

  if (
    await handlePunishments(
      ctx,
      text
    )
  ) return;

  if (
    await handleProtectionSettings(
      ctx,
      text
    )
  ) return;

  if (
    await handleForbiddenWords(
      ctx,
      text
    )
  ) return;

  if (
    await handlePromoteAdmin(
      ctx,
      text
    )
  ) return;

  if (
    await handlePermissions(
      ctx,
      text
    )
  ) return;

  if (
    await handleWhisper(
      ctx,
      text
    )
  ) return;

  if (
    await handleMusic(
      ctx,
      text
    )
  ) return;

  if (
    await handleTitles(
      ctx,
      text
    )
  ) return;

  if (
    await handleEconomy(
      ctx,
      text
    )
  ) return;

  if (
    await handleCleaning(
      ctx,
      text
    )
  ) return;

  /*
    لا يوجد هنا أي رد افتراضي.
    الكلام العادي يمر بدون رد.
  */
});

/* =========================================================
   أخطاء
========================================================= */

bot.catch((err, ctx) => {
  console.error(
    'BOT ERROR:',
    err
  );

  try {
    if (
      ctx &&
      ctx.callbackQuery
    ) {
      ctx.answerCbQuery(
        'حدث خطأ',
        {
          show_alert: true
        }
      );
    }
  } catch {}
});

/* =========================================================
   تشغيل البوت
========================================================= */

(async () => {
  try {
    const me =
      await bot.telegram.getMe();

    console.log(
      `Bot started: @${me.username}`
    );

    await bot.launch();

    console.log(
      'Telegram bot is running...'
    );
  } catch (err) {
    console.error(
      'Failed to start bot:',
      err
    );
  }
})();

/* =========================================================
   إغلاق آمن
========================================================= */

process.once(
  'SIGINT',
  () => bot.stop('SIGINT')
);

process.once(
  'SIGTERM',
  () => bot.stop('SIGTERM')
);
