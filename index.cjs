'use strict';

/*
===========================================================
 EILAF BOT - index.cjs
 Telegram Group Management Bot
 Node.js + Telegraf
===========================================================
*/

require('dotenv').config();

const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

let ytSearch = null;

try {
  ytSearch = require('yt-search');
} catch {
  console.log('⚠️ yt-search غير مثبت');
  console.log('npm install yt-search');
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

  owner: {
    username: OWNER_USERNAME,
    id: null,
    firstName: ''
  },

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

function cloneDefault() {
  return JSON.parse(JSON.stringify(defaultData));
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(defaultData, null, 2)
      );

      return cloneDefault();
    }

    const raw = fs.readFileSync(DATA_FILE, 'utf8');

    if (!raw.trim()) {
      return cloneDefault();
    }

    const parsed = JSON.parse(raw);

    return {
      ...cloneDefault(),
      ...parsed,
      groups: parsed.groups || {},
      users: parsed.users || {},
      whispers: parsed.whispers || {},
      subscribers: parsed.subscribers || [],
      owner: {
        ...cloneDefault().owner,
        ...(parsed.owner || {})
      }
    };
  } catch (err) {
    console.error('❌ خطأ في قاعدة البيانات:', err.message);
    return cloneDefault();
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
    console.error('❌ خطأ في الحفظ:', err.message);
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
  return ctx.chat?.type === 'private';
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
      pendingLock: null,

      forbiddenWords: [],

      customReplies: {},
      pendingReply: null,

      customCommands: {},
      titles: {},

      adminSessions: {},

      protection: {
        enabled: false,

        links: true,
        mentions: true,
        phoneNumbers: true,
        ads: true,
        repetition: true,
        longMessages: true,
        forwards: true,
        english: false,

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

      repetition: {},

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

  db.users[id].username =
    user.username || db.users[id].username;

  db.users[id].firstName =
    user.first_name || db.users[id].firstName;

  /*
    حفظ ID المالك أول ما يتعامل معه البوت.
  */

  if (
    user.username &&
    user.username.toLowerCase() ===
      OWNER_USERNAME.toLowerCase()
  ) {
    db.owner.id = user.id;
    db.owner.firstName =
      user.first_name || db.owner.firstName;

    saveData();
  }

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

async function reply(ctx, text, extra = {}) {
  try {
    return await ctx.reply(text, {
      ...extra,
      ...(ctx.message?.message_id
        ? {
            reply_parameters: {
              message_id: ctx.message.message_id
            }
          }
        : {})
    });
  } catch (err) {
    console.error('reply error:', err.message);
  }
}

async function getTarget(ctx) {
  return ctx.message?.reply_to_message?.from || null;
}

function formatNumber(num) {
  return Number(num || 0).toLocaleString('en-US');
}

function cleanText(text) {
  return String(text || '').trim();
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
    if (rank.level === Number(level)) {
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
    مهم:
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
    value === 'مطور ثانوي' ||
    value === 'مطوّر ثانوي'
  ) {
    return 6;
  }

  if (
    value === 'dev' ||
    value === 'ديف' ||
    value === 'مطور' ||
    value === 'مطوّر'
  ) {
    return 7;
  }

  return null;
}

function getRank(ctx, userId = null) {
  if (!ctx.chat) return 0;

  const group = getGroup(ctx.chat.id);

  const id = String(
    userId ?? ctx.from?.id
  );

  const user = db.users[id];

  /*
    المالك الثابت:
    j4xa7
  */

  if (
    user?.username &&
    user.username.toLowerCase() ===
      OWNER_USERNAME.toLowerCase()
  ) {
    return 7;
  }

  /*
    لو حفظنا ID المالك مسبقًا
  */

  if (
    db.owner.id &&
    Number(id) === Number(db.owner.id)
  ) {
    return 7;
  }

  const saved = group.ranks[id];

  return Number.isInteger(saved)
    ? saved
    : 0;
}

function isProtectedUser(ctx, userId) {
  return getRank(ctx, userId) >= 3;
}

function requiredRankMessage(level) {
  return `• الأمر متاح من رتبة ${rankName(level)} فأعلى`;
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
  'رفع dev2',
  'رفع مطور ثانوي',
  'رفع ديف',
  'رفع dev',

  'تنزيل',

  'تفاعلي',
  'تفاعله',
  'المتفاعلين',
  'تصفير المتفاعلين',
  'اضف تفاعل',

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
  'تفعيل المنشن',
  'تعطيل المنشن',

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

  'اضف رد',
  'مسح رد',
  'الردود',

  'المالك',

  'بحث',
  'بحث أغنية',
  'بحث اغنية',
  'اغنية',
  'أغنية',
  'شغل',
  'تشغيل',

  'فلوسي',
  'فلوسه',
  'انشاء حساب بنكي',
  'حسابي',
  'حذف حسابي',

  'حالة البوت',
  'دعوة',

  'حذف'
]);

function isKnownCommandText(text) {
  const clean = cleanText(text);

  if (!clean) return false;

  for (const command of KNOWN_COMMANDS) {
    if (
      clean === command ||
      clean.toLowerCase() === command.toLowerCase() ||
      clean.startsWith(command + ' ')
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
    await reply(
      ctx,
      `• رتبتك هي ↤ ${rankName(getRank(ctx))}`
    );

    return true;
  }

  if (text === 'رتبته') {
    const target = await getTarget(ctx);

    if (!target) {
      await reply(ctx, '• قم بالرد على المستخدم أولًا');
      return true;
    }

    await reply(
      ctx,
      `• رتبة المستخدم هي ↤ ${rankName(
        getRank(ctx, target.id)
      )}`
    );

    return true;
  }

  if (text === 'تنزيل') {
    const target = await getTarget(ctx);

    if (!target) {
      await reply(ctx, '• قم بالرد على المستخدم أولًا');
      return true;
    }

    const myRank = getRank(ctx);
    const targetRank = getRank(ctx, target.id);

    if (myRank < 6) {
      await reply(
        ctx,
        '• هذا الأمر متاح من رتبة Dev²🎖 فأعلى'
      );
      return true;
    }

    if (target.id === ctx.from.id) {
      await reply(ctx, '• لا يمكنك تنزيل رتبتك بنفسك');
      return true;
    }

    if (targetRank >= myRank) {
      await reply(
        ctx,
        '• لا يمكنك تنزيل رتبة أعلى أو مساوية لرتبتك'
      );
      return true;
    }

    const newRank = Math.max(
      0,
      targetRank - 1
    );

    getGroup(ctx.chat.id).ranks[
      String(target.id)
    ] = newRank;

    saveData();

    await reply(
      ctx,
      `• تم تنزيل رتبة ↤ ${target.first_name || 'المستخدم'}
• الرتبة الجديدة ↤ ${rankName(newRank)}`
    );

    return true;
  }

  if (!text.startsWith('رفع ')) {
    return false;
  }

  const requestedRank = parseRank(
    text.slice(4)
  );

  if (requestedRank === null) {
    return false;
  }

  const target = await getTarget(ctx);

  if (!target) {
    await reply(ctx, '• قم بالرد على المستخدم أولًا');
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

  const targetRank =
    getRank(ctx, target.id);

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
    `• تم رفع رتبة ↤ ${target.first_name || 'المستخدم'}
• الرتبة ↤ ${rankName(requestedRank)}`
  );

  return true;
}

/* =========================================================
   التفاعل
========================================================= */

async function handleInteraction(ctx, text) {
  if (!isGroup(ctx)) return false;

  const group =
    getGroup(ctx.chat.id);

  if (text === 'تفاعلي') {
    const uid =
      String(ctx.from.id);

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

• رسائلك بالتفاعل ↤ ${formatNumber(count)}
• ترتيبك بالمتفاعلين ↤ ${position || '-'}`
    );

    return true;
  }

  if (text === 'تفاعله') {
    const target =
      await getTarget(ctx);

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

  /*
    اضف تفاعل 1000
    على المستخدم الذي تم الرد على رسالته.
  */

  if (
    text.startsWith('اضف تفاعل ')
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

    const amountText =
      text.slice('اضف تفاعل '.length).trim();

    const amount =
      Number(
        amountText.replace(/,/g, '')
      );

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isInteger(amount)
    ) {
      await reply(
        ctx,
        '• اكتب عدد التفاعل بشكل صحيح\nمثال: اضف تفاعل 1000'
      );

      return true;
    }

    if (amount > 1000000) {
      await reply(
        ctx,
        '• الحد الأقصى 1,000,000'
      );

      return true;
    }

    const id =
      String(target.id);

    group.interactions[id] =
      (group.interactions[id] || 0) +
      amount;

    saveData();

    await reply(
      ctx,
      `• تم إضافة ↤ ${formatNumber(amount)} تفاعل
• المستخدم ↤ ${target.first_name || 'المستخدم'}
• مجموع تفاعله ↤ ${formatNumber(group.interactions[id])}`
    );

    return true;
  }

  if (text === 'المتفاعلين') {
    const sorted =
      Object.entries(
        group.interactions
      )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    let message =
      'توب اكثر 20 متفاعلين بالقروب :\n━━━━━━━━━\n\n';

    const medals =
      ['🥇', '🥈', '🥉'];

    for (
      let i = 0;
      i < sorted.length;
      i++
    ) {
      const [uid, count] =
        sorted[i];

      const user =
        db.users[uid];

      const name =
        user?.firstName ||
        user?.username ||
        uid;

      message +=
        `${medals[i] || `${i + 1}`} ) ${formatNumber(count)} l ${name}\n`;
    }

    await reply(ctx, message);

    return true;
  }

  if (text === 'تصفير المتفاعلين') {
    if (getRank(ctx) < 6) {
      await reply(
        ctx,
        requiredRankMessage(6)
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
   العقوبات
========================================================= */

async function restorePermissions(ctx, userId) {
  try {
    await ctx.telegram.restrictChatMember(
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
          can_add_web_page_previews: true,
          can_invite_users: true
        }
      }
    );

    return true;
  } catch {
    return false;
  }
}

async function handlePunishments(ctx, text) {
  if (!isGroup(ctx)) return false;

  const group =
    getGroup(ctx.chat.id);

  const target =
    await getTarget(ctx);

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

  if (
    needTarget.includes(text) &&
    !target
  ) {
    await reply(
      ctx,
      '• قم بالرد على المستخدم أولًا'
    );

    return true;
  }

  const protectedCommands = [
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
  ];

  if (
    target &&
    protectedCommands.includes(text) &&
    isProtectedUser(ctx, target.id) &&
    getRank(ctx) <= getRank(ctx, target.id)
  ) {
    await reply(
      ctx,
      '• لا يمكنك تنفيذ الأمر على رتبة أعلى أو مساوية لرتبتك'
    );

    return true;
  }

  /* كتم */

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

      group.muted[
        String(target.id)
      ] = true;

      saveData();

      await reply(
        ctx,
        `• تم كتم ↤ ${target.first_name || 'المستخدم'}`
      );
    } catch {
      await reply(
        ctx,
        '• تأكد أن البوت مشرف وعنده صلاحية تقييد الأعضاء'
      );
    }

    return true;
  }

  /* فك الكتم */

  if (text === 'فك الكتم') {
    if (getRank(ctx) < 3) {
      await reply(
        ctx,
        requiredRankMessage(3)
      );

      return true;
    }

    if (
      await restorePermissions(
        ctx,
        target.id
      )
    ) {
      delete group.muted[
        String(target.id)
      ];

      saveData();

      await reply(
        ctx,
        `• تم فك الكتم عن ↤ ${target.first_name || 'المستخدم'}`
      );
    } else {
      await reply(
        ctx,
        '• تعذر فك الكتم'
      );
    }

    return true;
  }

  /* كتم عام */

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

  /* فك الكتم العام */

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

    await restorePermissions(
      ctx,
      target.id
    );

    saveData();

    await reply(
      ctx,
      `• تم فك الكتم العام عن ↤ ${target.first_name || 'المستخدم'}`
    );

    return true;
  }

  /* تقييد */

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

  /* إلغاء التقييد */

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

    if (
      await restorePermissions(
        ctx,
        target.id
      )
    ) {
      delete group.restricted[
        String(target.id)
      ];

      saveData();

      await reply(
        ctx,
        `• تم إلغاء تقييد ↤ ${target.first_name || 'المستخدم'}`
      );
    } else {
      await reply(
        ctx,
        '• تعذر إلغاء التقييد'
      );
    }

    return true;
  }

  /* قائمة المقيدين */

  if (text === 'قائمة المقيدين') {
    if (getRank(ctx) < 6) {
      await reply(
        ctx,
        requiredRankMessage(6)
      );

      return true;
    }

    const ids =
      Object.keys(
        group.restricted
      );

    if (!ids.length) {
      await reply(
        ctx,
        '• لا يوجد مقيدين'
      );

      return true;
    }

    let message =
      '• قائمة المقيدين :\n\n';

    ids.forEach(
      (id, index) => {
        const user =
          db.users[id];

        message +=
          `${index + 1} ) ${user?.firstName || id}\n`;
      }
    );

    await reply(ctx, message);

    return true;
  }

  /* مسح المقيدين */

  if (
    text === 'مق' ||
    text === 'مسح المقيدين'
  ) {
    if (getRank(ctx) < 5) {
      await reply(
        ctx,
        requiredRankMessage(5)
      );

      return true;
    }

    const ids =
      Object.keys(
        group.restricted
      );

    for (const id of ids) {
      await restorePermissions(
        ctx,
        Number(id)
      );
    }

    const count =
      ids.length;

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

  /* حظر */

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

  /* فك الحظر */

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

  /* طرد */

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

  /* الإنذار */

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

        group.muted[id] = true;
      } catch {}

      await reply(
        ctx,
        `• ${target.first_name || 'المستخدم'} وصل إلى 3 إنذارات
• تم تنفيذ العقوبة تلقائيًا`
      );
    } else {
      await reply(
        ctx,
        `• تم إعطاء إنذار لـ ↤ ${target.first_name || 'المستخدم'}
• عدد الإنذارات ↤ ${count}/3`
      );
    }

    saveData();

    return true;
  }

  /* إلغاء الإنذار */

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

  /* مسح المكتومين */

  if (text === 'مم') {
    if (getRank(ctx) < 5) {
      await reply(
        ctx,
        requiredRankMessage(5)
      );

      return true;
    }

    const ids =
      Object.keys(
        group.muted
      );

    for (const id of ids) {
      await restorePermissions(
        ctx,
        Number(id)
      );
    }

    const count =
      ids.length;

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

  /* مسح المكتومين عام */

  if (text === 'خخ') {
    if (getRank(ctx) < 5) {
      await reply(
        ctx,
        requiredRankMessage(5)
      );

      return true;
    }

    const ids =
      Object.keys(
        group.globalMuted
      );

    for (const id of ids) {
      await restorePermissions(
        ctx,
        Number(id)
      );
    }

    const count =
      ids.length;

    group.globalMuted = {};

    saveData();

    await reply(
      ctx,
      count
        ? `• تم مسح ( ${count} ) من المكتومين عام`
        : '• لا يوجد مكتومين عام'
    );

    return true;
  }

  return false;
}

/* =========================================================
   الحماية
========================================================= */

function protectionCard(locked) {
  if (!locked) {
    return '🔓 تم فتح المخالفات بنجاح';
  }

  return `🔒 تم قفل المخالفات بنجاح

المحتوى المحمي:

• الروابط
• المنشن
• الإعلانات
• أرقام الجوال
• التكرار والسبام
• الرسائل الطويلة
• الكلمات الممنوعة
• إعادة التوجيه
• الإنجليزية حسب الإعداد
• الصور والفيديو والملفات حسب الإعداد

⚠️ المخالفات تسجل على العضو
٣ مخالفات → العقوبة التلقائية`;
}

async function handleProtectionSettings(ctx, text) {
  if (!isGroup(ctx)) return false;

  const group =
    getGroup(ctx.chat.id);

  if (
    text === 'قفل المخالفات' ||
    text === 'غلق المخالفات'
  ) {
    if (getRank(ctx) < 6) {
      await reply(
        ctx,
        '• هذا الأمر يخص ↤ ｢ Dev²🎖 ｢'
      );

      return true;
    }

    group.protection.enabled =
      true;

    saveData();

    await reply(
      ctx,
      protectionCard(true)
    );

    return true;
  }

  if (text === 'فتح المخالفات') {
    if (getRank(ctx) < 6) {
      await reply(
        ctx,
        '• هذا الأمر يخص ↤ ｢ Dev²🎖 ｢'
      );

      return true;
    }

    group.protection.enabled =
      false;

    saveData();

    await reply(
      ctx,
      protectionCard(false)
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
        requiredRankMessage(6)
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
    text === 'فتح المنشن' ||
    text === 'تفعيل المنشن' ||
    text === 'تعطيل المنشن'
  ) {
    if (getRank(ctx) < 6) {
      await reply(
        ctx,
        requiredRankMessage(6)
      );

      return true;
    }

    const enabled =
      text === 'قفل المنشن' ||
      text === 'تفعيل المنشن';

    group.protection.mentions =
      enabled;

    saveData();

    await reply(
      ctx,
      enabled
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
        requiredRankMessage(7)
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
   فحص الحماية
========================================================= */

function messageHasLink(text) {
  return /(https?:\/\/|www\.|t\.me\/|telegram\.me\/)/i.test(
    text
  );
}

function messageHasMention(text) {
  return /@\w+/i.test(text);
}

function messageHasPhone(text) {
  return /(?:\+?\d[\d\s-]{7,}\d)/.test(text);
}

function messageLooksLikeAd(text) {
  return /(للبيع|متوفر|سارع|خصم|تواصل معنا|اعلان|إعلان|للتواصل|واتساب|رابط القناة|اشترك)/i.test(
    text
  );
}

function messageHasEnglish(text) {
  return /[A-Za-z]{3,}/.test(text);
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

  return badWords.some(
    word =>
      text
        .toLowerCase()
        .includes(
          word.toLowerCase()
        )
  );
}

function getMediaViolation(group, message) {
  if (
    message.photo &&
    group.protection.photos
  ) {
    return 'الصور';
  }

  if (
    message.video &&
    group.protection.videos
  ) {
    return 'الفيديوهات';
  }

  if (
    message.document &&
    group.protection.documents
  ) {
    return 'الملفات';
  }

  if (
    message.sticker &&
    group.protection.stickers
  ) {
    return 'الملصقات';
  }

  if (
    message.animation &&
    group.protection.gifs
  ) {
    return 'GIF';
  }

  if (
    message.audio &&
    group.protection.audio
  ) {
    return 'الصوتيات';
  }

  if (
    message.voice &&
    group.protection.voice
  ) {
    return 'الرسائل الصوتية';
  }

  return null;
}

function getRepetitionKey(ctx) {
  const message =
    ctx.message;

  const text =
    message?.text ||
    message?.caption ||
    '';

  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isRepeatedMessage(ctx) {
  if (!isGroup(ctx)) return false;

  const group =
    getGroup(ctx.chat.id);

  const text =
    getRepetitionKey(ctx);

  if (!text) return false;

  const userId =
    String(ctx.from.id);

  if (!group.repetition[userId]) {
    group.repetition[userId] = {
      text: '',
      count: 0,
      time: 0
    };
  }

  const record =
    group.repetition[userId];

  const now =
    Date.now();

  if (
    record.text === text &&
    now - record.time < 30000
  ) {
    record.count++;
  } else {
    record.text = text;
    record.count = 1;
  }

  record.time = now;

  return (
    record.count >=
    group.protection.repeatLimit
  );
}

async function registerViolation(ctx, reason) {
  if (!isGroup(ctx)) return;

  const group =
    getGroup(ctx.chat.id);

  const userId =
    String(ctx.from.id);

  group.warnings[userId] =
    (group.warnings[userId] || 0) + 1;

  const count =
    group.warnings[userId];

  /*
    حذف الرسالة المخالفة
  */

  try {
    if (ctx.message?.message_id) {
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

• العضو ↤ ${ctx.from.first_name || 'المستخدم'}
• السبب ↤ ${reason}
• الإنذار ↤ ${count}/3`
      );
    } catch {}
  }

  /*
    العقوبة بعد 3 مخالفات
  */

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
  if (!isGroup(ctx)) {
    return false;
  }

  const group =
    getGroup(ctx.chat.id);

  if (!group.protection.enabled) {
    return false;
  }

  /*
    الرتب المحمية
  */

  if (getRank(ctx) >= 3) {
    return false;
  }

  const message =
    ctx.message || {};

  const text =
    message.text ||
    message.caption ||
    '';

  /*
    لا تفحص أوامر البوت
  */

  if (isKnownCommandText(text)) {
    return false;
  }

  /*
    الروابط
  */

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

  /*
    المنشن
  */

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

  /*
    أرقام الجوال
  */

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

  /*
    الإعلانات
  */

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

  /*
    الرسائل الطويلة
  */

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

  /*
    الإنجليزية
  */

  if (
    group.protection.english &&
    messageHasEnglish(text)
  ) {
    await registerViolation(
      ctx,
      'الرسائل الإنجليزية'
    );

    return true;
  }

  /*
    الكلمات الممنوعة
  */

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
    group.forbiddenWords.find(
      word =>
        text
          .toLowerCase()
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

  /*
    إعادة التوجيه
  */

  if (
    message.forward_origin &&
    group.protection.forwards
  ) {
    await registerViolation(
      ctx,
      'إعادة التوجيه'
    );

    return true;
  }

  /*
    الميديا
  */

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

  /*
    التكرار
  */

  if (
    group.protection.repetition &&
    isRepeatedMessage(ctx)
  ) {
    await registerViolation(
      ctx,
      'التكرار والسبام'
    );

    return true;
  }

  return false;
}

/* =========================================================
   edited_message
========================================================= */

async function handleEditedMessage(ctx) {
  if (!isGroup(ctx)) {
    return false;
  }

  /*
    تيليجرام يرسل edited_message كنوع تحديث منفصل.
    لذلك نفحصه هنا بشكل مستقل.
  */

  if (
    await checkProtection(ctx)
  ) {
    return true;
  }

  return false;
}

/* =========================================================
   الكلمات الممنوعة
========================================================= */

async function handleForbiddenWords(ctx, text) {
  if (!isGroup(ctx)) return false;

  const group =
    getGroup(ctx.chat.id);

  if (
    text.startsWith(
      'منع الكلمه '
    )
  ) {
    if (getRank(ctx) < 6) {
      await reply(
        ctx,
        requiredRankMessage(6)
      );

      return true;
    }

    const word =
      text
        .slice(
          'منع الكلمه '.length
        )
        .trim();

    if (!word) {
      await reply(
        ctx,
        '• اكتب الكلمة بعد الأمر'
      );

      return true;
    }

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

    await reply(
      ctx,
      `• تم منع الكلمة ↤ ${word}`
    );

    return true;
  }

  if (
    text.startsWith(
      'الغاء منع الكلمه '
    )
  ) {
    if (getRank(ctx) < 6) {
      await reply(
        ctx,
        requiredRankMessage(6)
      );

      return true;
    }

    const word =
      text
        .slice(
          'الغاء منع الكلمه '.length
        )
        .trim();

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

  if (
    text === 'الكلمات الممنوعه'
  ) {
    await reply(
      ctx,
      group.forbiddenWords.length
        ? `• الكلمات الممنوعة:\n\n${group.forbiddenWords
            .map(
              (x, i) =>
                `${i + 1} ) ${x}`
            )
            .join('\n')}`
        : '• لا توجد كلمات ممنوعة'
    );

    return true;
  }

  if (
    text === 'مسح الكلمات الممنوعه'
  ) {
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

async function handleCommandLock(ctx, text) {
  if (!isGroup(ctx)) return false;

  const group =
    getGroup(ctx.chat.id);

  if (
    group.pendingLock &&
    group.pendingLock.userId ===
      ctx.from.id
  ) {
    const pending =
      group.pendingLock;

    if (!pending.command) {
      pending.command =
        normalizeCommandName(text);

      saveData();

      await reply(
        ctx,
        '• حسنًا عزيزي قم بإرسال الرتبة الان :'
      );

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
      group.commandLocks[
        command
      ] = level;

      await reply(
        ctx,
        `🔒 تم قفل الأمر بنجاح

• الأمر ↤ ${command}
• متاح من رتبة ↤ ${rankName(level)} فأعلى`
      );
    } else {
      delete group.commandLocks[
        command
      ];

      await reply(
        ctx,
        `🔓 تم فتح الأمر ↤ ${command}`
      );
    }

    group.pendingLock = null;

    saveData();

    return true;
  }

  if (text === 'قفل امر') {
    if (getRank(ctx) < 7) {
      await reply(
        ctx,
        requiredRankMessage(7)
      );

      return true;
    }

    group.pendingLock = {
      userId: ctx.from.id,
      action: 'lock-command',
      command: null
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
        requiredRankMessage(7)
      );

      return true;
    }

    group.pendingLock = {
      userId: ctx.from.id,
      action: 'unlock-command',
      command: null
    };

    saveData();

    await reply(
      ctx,
      '• حسنًا عزيزي قم بإرسال الأمر الان :'
    );

    return true;
  }

  return false;
}

async function checkCommandLock(ctx, text) {
  if (!isGroup(ctx)) return false;

  const group =
    getGroup(ctx.chat.id);

  const normalized =
    normalizeCommandName(text);

  let required = null;

  for (
    const [command, level] of
      Object.entries(
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

  if (getRank(ctx) >= required) {
    return false;
  }

  await reply(
    ctx,
    `• الأمر متاح من رتبة ${rankName(required)} فأعلى`
  );

  return true;
}

/* =========================================================
   رفع مشرف
========================================================= */

const ADMIN_RIGHTS = [
  {
    key: 'can_change_info',
    label: 'تغيير المعلومات'
  },
  {
    key: 'can_delete_messages',
    label: 'مسح الرسائل'
  },
  {
    key: 'can_restrict_members',
    label: 'حظر المستخدمين'
  },
  {
    key: 'can_invite_users',
    label: 'إضافة مستخدمين'
  },
  {
    key: 'can_pin_messages',
    label: 'تثبيت الرسائل'
  },
  {
    key: 'can_manage_topics',
    label: 'إدارة المواضيع'
  },
  {
    key: 'can_manage_video_chats',
    label: 'إدارة المكالمات'
  },
  {
    key: 'can_promote_members',
    label: 'إضافة المشرفين'
  }
];

function adminKeyboard(chatId, userId) {
  const group =
    getGroup(chatId);

  const session =
    group.adminSessions?.[
      String(userId)
    ];

  if (!session) {
    return Markup.inlineKeyboard([]);
  }

  const rows = [];

  for (const right of ADMIN_RIGHTS) {
    const enabled =
      session[right.key] === true;

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

  return Markup.inlineKeyboard(
    rows
  );
}

async function handlePromoteAdmin(ctx, text) {
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
      requiredRankMessage(7)
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

  if (
    getRank(ctx, target.id) >= 3
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
          can_manage_topics: false,
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

  group.adminSessions[
    String(ctx.from.id)
  ] = {
    targetId: target.id,
    targetName:
      target.first_name ||
      'المستخدم',

    can_change_info: true,
    can_delete_messages: true,
    can_restrict_members: true,
    can_invite_users: true,
    can_pin_messages: true,
    can_manage_topics: false,
    can_manage_video_chats: false,
    can_promote_members: true
  };

  saveData();

  await reply(
    ctx,
    `• صلاحيات المستخدم ↤ ${target.first_name || 'المستخدم'}

• اضغط «تعديل الصلاحيات» لاختيار الصلاحيات`,
    Markup.inlineKeyboard([
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
  );

  return true;
}

/* =========================================================
   الصلاحيات
========================================================= */

async function handlePermissions(ctx, text) {
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
      member.status !== 'administrator' &&
      member.status !== 'creator'
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
            can_manage_topics: true,
            can_manage_video_chats: true,
            can_promote_members: true
          }
        : member;

    await reply(
      ctx,
      `• صلاحياتك بالإشراف :
━━━━━━━━━━━
• تغيير المعلومات ↤︎ ${p.can_change_info ? 'نعم' : 'لا'}
• تثبيت الرسائل ↤︎ ${p.can_pin_messages ? 'نعم' : 'لا'}
• ادارة المواضيع ↤︎ ${p.can_manage_topics ? 'نعم' : 'لا'}
• اضافه مستخدمين ↤︎ ${p.can_invite_users ? 'نعم' : 'لا'}
• مسح الرسائل ↤︎ ${p.can_delete_messages ? 'نعم' : 'لا'}
• حظر المستخدمين ↤︎ ${p.can_restrict_members ? 'نعم' : 'لا'}
• اضافه المشرفين ↤︎ ${p.can_promote_members ? 'نعم' : 'لا'}`
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
   الردود المخصصة
========================================================= */

async function handleCustomReplies(ctx, text) {
  if (!isGroup(ctx)) return false;

  const group =
    getGroup(ctx.chat.id);

  /*
    جلسة إضافة رد
  */

  if (
    group.pendingReply &&
    group.pendingReply.userId ===
      ctx.from.id
  ) {
    const pending =
      group.pendingReply;

    if (!pending.word) {
      pending.word =
        text.trim();

      saveData();

      await reply(
        ctx,
        '• حسنًا، الآن أرسل الرد الذي تريده لهذه الكلمة :'
      );

      return true;
    }

    group.customReplies[
      pending.word.toLowerCase()
    ] = text;

    group.pendingReply = null;

    saveData();

    await reply(
      ctx,
      `• تم إضافة الرد بنجاح

• الكلمة ↤ ${pending.word}
• الرد ↤ ${text}`
    );

    return true;
  }

  /*
    اضف رد
  */

  if (text === 'اضف رد') {
    if (getRank(ctx) < 5) {
      await reply(
        ctx,
        requiredRankMessage(5)
      );

      return true;
    }

    group.pendingReply = {
      userId: ctx.from.id,
      word: null
    };

    saveData();

    await reply(
      ctx,
      '• حسنًا عزيزي قم بإرسال الكلمة الان :'
    );

    return true;
  }

  /*
    مسح رد
  */

  if (
    text.startsWith('مسح رد ')
  ) {
    if (getRank(ctx) < 5) {
      await reply(
        ctx,
        requiredRankMessage(5)
      );

      return true;
    }

    const word =
      text
        .slice('مسح رد '.length)
        .trim()
        .toLowerCase();

    if (
      !group.customReplies[word]
    ) {
      await reply(
        ctx,
        '• لا يوجد رد محفوظ لهذه الكلمة'
      );

      return true;
    }

    delete group.customReplies[
      word
    ];

    saveData();

    await reply(
      ctx,
      `• تم مسح الرد ↤ ${word}`
    );

    return true;
  }

  /*
    الردود
  */

  if (text === 'الردود') {
    const entries =
      Object.entries(
        group.customReplies
      );

    if (!entries.length) {
      await reply(
        ctx,
        '• لا توجد ردود مخصصة'
      );

      return true;
    }

    let message =
      '• الردود المخصصة :\n\n';

    entries.forEach(
      ([word, response], i) => {
        message +=
          `${i + 1} ) ${word} ↤ ${response}\n`;
      }
    );

    await reply(ctx, message);

    return true;
  }

  /*
    تشغيل الرد المخصص
  */

  if (
    group.customReplies[
      text.toLowerCase()
    ]
  ) {
    if (
      db.botSettings.replies
    ) {
      await reply(
        ctx,
        group.customReplies[
          text.toLowerCase()
        ]
      );

      /*
        حذف الرسالة التي كانت Reply
        إذا كانت الكلمة نفسها ردًا على رسالة.
      */

      if (
        ctx.message.reply_to_message
      ) {
        try {
          await ctx.telegram.deleteMessage(
            ctx.chat.id,
            ctx.message.message_id
          );
        } catch {}
      }
    }

    return true;
  }

  return false;
}

/* =========================================================
   حذف رسالة عند الرد
========================================================= */

async function handleDeleteReply(ctx, text) {
  if (!isGroup(ctx)) return false;

  if (text !== 'حذف') {
    return false;
  }

  if (!ctx.message.reply_to_message) {
    await reply(
      ctx,
      '• قم بالرد على الرسالة التي تريد حذفها'
    );

    return true;
  }

  if (getRank(ctx) < 3) {
    await reply(
      ctx,
      requiredRankMessage(3)
    );

    return true;
  }

  try {
    await ctx.telegram.deleteMessage(
      ctx.chat.id,
      ctx.message.reply_to_message.message_id
    );

    await ctx.telegram.deleteMessage(
      ctx.chat.id,
      ctx.message.message_id
    );
  } catch {
    await reply(
      ctx,
      '• تعذر حذف الرسالة، تأكد من صلاحيات البوت'
    );
  }

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

async function handleWhisper(ctx, text) {
  if (!isGroup(ctx)) return false;

  if (
    text !== 'اهمس' &&
    text !== 'همسه' &&
    text !== 'ه'
  ) {
    return false;
  }

  /*
    الهمسة تبدأ فقط بالرد
  */

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

    chatId:
      ctx.chat.id,

    senderId:
      ctx.from.id,

    senderName:
      ctx.from.first_name ||
      'المستخدم',

    receiverId:
      target.id,

    receiverName:
      target.first_name ||
      'المستخدم',

    content: null,
    contentType: null,

    waitingForContent: false,
    waitingForReply: false,

    viewed: false,

    createdAt:
      Date.now()
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
    Markup.inlineKeyboard([
      [
        Markup.button.url(
          'اهمس هنا',
          deepLink
        )
      ]
    ])
  );

  return true;
}

async function sendWhisperContent(
  ctx,
  whisper
) {
  if (
    ctx.from.id !==
      whisper.receiverId ||
    !whisper.content
  ) {
    return;
  }

  const caption =
    `• همسة من ↤ ${whisper.senderName}`;

  try {
    if (
      whisper.contentType ===
      'text'
    ) {
      await ctx.reply(
        `${caption}\n\n${whisper.content}`
      );
    }

    if (
      whisper.contentType ===
      'photo'
    ) {
      await ctx.replyWithPhoto(
        whisper.content,
        { caption }
      );
    }

    if (
      whisper.contentType ===
      'video'
    ) {
      await ctx.replyWithVideo(
        whisper.content,
        { caption }
      );
    }

    if (
      whisper.contentType ===
      'document'
    ) {
      await ctx.replyWithDocument(
        whisper.content
      );
    }

    if (
      whisper.contentType ===
      'sticker'
    ) {
      await ctx.replyWithSticker(
        whisper.content
      );
    }

    if (
      whisper.contentType ===
      'animation'
    ) {
      await ctx.replyWithAnimation(
        whisper.content
      );
    }

    if (
      whisper.contentType ===
      'audio'
    ) {
      await ctx.replyWithAudio(
        whisper.content
      );
    }

    if (
      whisper.contentType ===
      'voice'
    ) {
      await ctx.replyWithVoice(
        whisper.content
      );
    }

    whisper.viewed =
      true;

    saveData();

    try {
      await ctx.telegram.sendMessage(
        whisper.senderId,
        `• تم فتح الهمسة من ↤ ${whisper.receiverName}`
      );
    } catch {}
  } catch (err) {
    console.error(
      'whisper:',
      err.message
    );
  }
}

async function handlePrivateMessage(ctx) {
  if (!isPrivate(ctx)) {
    return false;
  }

  const message =
    ctx.message;

  /*
    محتوى الهمسة
  */

  const waitingContent =
    Object.values(
      db.whispers
    ).find(
      w =>
        w.waitingForContent ===
          ctx.from.id &&
        !w.content
    );

  if (waitingContent) {
    if (message.text) {
      waitingContent.content =
        message.text;

      waitingContent.contentType =
        'text';
    } else if (message.photo) {
      waitingContent.content =
        message.photo[
          message.photo.length - 1
        ].file_id;

      waitingContent.contentType =
        'photo';
    } else if (message.video) {
      waitingContent.content =
        message.video.file_id;

      waitingContent.contentType =
        'video';
    } else if (message.document) {
      waitingContent.content =
        message.document.file_id;

      waitingContent.contentType =
        'document';
    } else if (message.sticker) {
      waitingContent.content =
        message.sticker.file_id;

      waitingContent.contentType =
        'sticker';
    } else if (message.animation) {
      waitingContent.content =
        message.animation.file_id;

      waitingContent.contentType =
        'animation';
    } else if (message.audio) {
      waitingContent.content =
        message.audio.file_id;

      waitingContent.contentType =
        'audio';
    } else if (message.voice) {
      waitingContent.content =
        message.voice.file_id;

      waitingContent.contentType =
        'voice';
    } else {
      await ctx.reply(
        '• هذا النوع من المحتوى غير مدعوم للهمسة'
      );

      return true;
    }

    delete waitingContent.waitingForContent;

    saveData();

    const username =
      await getBotUsername();

    const viewLink =
      `https://t.me/${username}?start=whisper_${waitingContent.id}`;

    const replyLink =
      `https://t.me/${username}?start=whisperreply_${waitingContent.id}`;

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

    /*
      إرسال للمستلم بالخاص
    */

    try {
      await ctx.telegram.sendMessage(
        waitingContent.receiverId,
        `• وصلتك همسة سرية من ↤ ${waitingContent.senderName}

• أنت وحدك تقدر تشوفها`,
        Markup.inlineKeyboard([
          [
            Markup.button.url(
              'رؤية الهمسة',
              viewLink
            )
          ],
          [
            Markup.button.url(
              'رد على الهمسة',
              replyLink
            )
          ]
        ])
      );
    } catch {}

    /*
      تنبيه القروب
      بدون إرسال محتوى الهمسة
    */

    try {
      await ctx.telegram.sendMessage(
        waitingContent.chatId,
        `• وصلت همسة سرية من ↤ ${waitingContent.senderName} إلى ↤ ${waitingContent.receiverName}`
      );
    } catch {}

    return true;
  }

  /*
    رد الهمسة
  */

  const waitingReply =
    Object.values(
      db.whispers
    ).find(
      w =>
        w.waitingForReply ===
        ctx.from.id
    );

  if (
    waitingReply &&
    message.text
  ) {
    delete waitingReply.waitingForReply;

    saveData();

    try {
      await ctx.telegram.sendMessage(
        waitingReply.senderId,
        `• وصلك رد على الهمسة من ↤ ${ctx.from.first_name || 'المستخدم'}

${message.text}`
      );

      await ctx.reply(
        '• تم إرسال ردك على الهمسة بنجاح'
      );
    } catch {
      await ctx.reply(
        '• تعذر إرسال الرد'
      );
    }

    return true;
  }

  return false;
}

/* =========================================================
   أمر المالك
========================================================= */

async function handleOwnerCommand(ctx, text) {
  if (!isGroup(ctx)) return false;

  if (text !== 'المالك') {
    return false;
  }

  /*
    أي شخص يكتب "المالك"
    وليس المالك نفسه فقط.
  */

  if (!db.owner.id) {
    await reply(
      ctx,
      `• المالك الأساسي هو ↤ @${OWNER_USERNAME}

• لازم حساب المالك @${OWNER_USERNAME} يتعامل مع البوت مرة واحدة حتى أقدر أحفظ ID الحساب وجلب صورته.`
    );

    return true;
  }

  try {
    const photos =
      await ctx.telegram.getUserProfilePhotos(
        db.owner.id,
        0,
        1
      );

    if (
      photos.total_count > 0
    ) {
      await ctx.replyWithPhoto(
        photos.photos[0][
          photos.photos[0].length - 1
        ].file_id,
        {
          caption:
            `• المالك الأساسي

• الاسم ↤ ${db.owner.firstName || 'غير معروف'}
• اليوزر ↤ @${OWNER_USERNAME}`
        }
      );

      return true;
    }
  } catch (err) {
    console.log(
      'owner photo:',
      err.message
    );
  }

  await reply(
    ctx,
    `• المالك الأساسي

• الاسم ↤ ${db.owner.firstName || 'غير معروف'}
• اليوزر ↤ @${OWNER_USERNAME}`
  );

  return true;
}

/* =========================================================
   الألقاب
========================================================= */

async function handleTitles(ctx, text) {
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

  if (text.startsWith('ضع ')) {
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

async function handleEconomy(ctx, text) {
  if (!isGroup(ctx)) return false;

  const user =
    ensureUser(ctx.from);

  if (text === 'فلوسي') {
    await reply(
      ctx,
      `• رصيدك ↤ ${formatNumber(user.balance)} ريال`
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
      `• رصيد ${target.first_name || 'المستخدم'} ↤ ${formatNumber(targetUser.balance)} ريال`
    );

    return true;
  }

  if (
    text === 'انشاء حساب بنكي'
  ) {
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

  if (
    text === 'حذف حسابي'
  ) {
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
   بحث الأغاني
========================================================= */

async function searchSongs(query) {
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
      err.message
    );

    return [];
  }
}

async function handleMusic(ctx, text) {
  if (!isGroup(ctx)) return false;

  const prefixes = [
    'بحث أغنية ',
    'بحث اغنية ',
    'بحث ',
    'اغنية ',
    'أغنية ',
    'شغل ',
    'تشغيل '
  ];

  let query = null;

  for (const prefix of prefixes) {
    if (
      text
        .toLowerCase()
        .startsWith(
          prefix.toLowerCase()
        )
    ) {
      query =
        text
          .slice(prefix.length)
          .trim();

      break;
    }
  }

  if (!query) {
    return false;
  }

  if (!ytSearch) {
    await reply(
      ctx,
      '• بحث الأغاني يحتاج مكتبة yt-search\n\nnpm install yt-search'
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

  let message =
    '🎵 نتائج البحث\n\n';

  const buttons = [];

  results.forEach(
    (song, index) => {
      message +=
        `${index + 1} ) ${song.title}\n` +
        `• الفنان ↤ ${song.author}\n` +
        `• المدة ↤ ${song.duration}\n\n`;

      buttons.push([
        Markup.button.callback(
          `${index + 1} • ${song.title.slice(0, 35)}`,
          `song:${song.id}`
        )
      ]);
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

/* =========================================================
   التنظيف
========================================================= */

async function handleCleaning(ctx, text) {
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

  return true;
}

/* =========================================================
   الدعوة
========================================================= */

async function handleInvite(ctx, text) {
  if (!isGroup(ctx)) return false;

  if (text !== 'دعوة') {
    return false;
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

  return true;
}

/* =========================================================
   /start
========================================================= */

bot.start(
  async ctx => {
    ensureUser(ctx.from);

    const payload =
      ctx.startPayload || '';

    /*
      همسة
    */

    if (
      payload.startsWith(
        'whisper_'
      )
    ) {
      const id =
        payload.slice(
          'whisper_'.length
        );

      const whisper =
        db.whispers[id];

      if (!whisper) {
        await ctx.reply(
          '• الهمسة غير موجودة أو انتهت'
        );

        return;
      }

      if (
        ctx.from.id !==
        whisper.receiverId
      ) {
        await ctx.reply(
          '• هذه الهمسة ليست موجهة لك'
        );

        return;
      }

      if (!whisper.content) {
        whisper.waitingForContent =
          ctx.from.id;

        saveData();

        await ctx.reply(
          '• أرسل الآن محتوى الهمسة هنا بالخاص\n\nيمكنك إرسال نص أو صورة أو فيديو أو ملف أو ملصق أو GIF أو صوت.'
        );

        return;
      }

      await sendWhisperContent(
        ctx,
        whisper
      );

      return;
    }

    /*
      رد الهمسة
    */

    if (
      payload.startsWith(
        'whisperreply_'
      )
    ) {
      const id =
        payload.slice(
          'whisperreply_'.length
        );

      const whisper =
        db.whispers[id];

      if (!whisper) {
        await ctx.reply(
          '• الهمسة غير موجودة'
        );

        return;
      }

      if (
        ctx.from.id !==
        whisper.receiverId
      ) {
        await ctx.reply(
          '• هذا الرد غير مخصص لك'
        );

        return;
      }

      whisper.waitingForReply =
        ctx.from.id;

      saveData();

      await ctx.reply(
        '• ارسل الآن ردك على الهمسة'
      );

      return;
    }

    /*
      start عادي
    */

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

    const username =
      await getBotUsername();

    await ctx.reply(
      `أهلا بك يا قلبي

• انا اشغل لك اللي تبي بالمكالمه

ادعم هالمنصات كلها :
يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.`,
      Markup.inlineKeyboard([
        [
          Markup.button.url(
            'اضفني الى مجموعتك',
            `https://t.me/${username}?startgroup=true`
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
  }
);

/* =========================================================
   CALLBACKS - رفع المشرف
========================================================= */

bot.action(
  /^admin_edit:(\d+)$/,
  async ctx => {
    const ownerId =
      Number(ctx.match[1]);

    if (
      ctx.from.id !==
      ownerId
    ) {
      await ctx.answerCbQuery(
        'هذه القائمة ليست لك',
        { show_alert: true }
      );

      return;
    }

    const group =
      getGroup(ctx.chat.id);

    if (
      !group.adminSessions?.[
        String(ownerId)
      ]
    ) {
      await ctx.answerCbQuery(
        'انتهت العملية',
        { show_alert: true }
      );

      return;
    }

    await ctx.answerCbQuery();

    await ctx.editMessageReplyMarkup(
      adminKeyboard(
        ctx.chat.id,
        ownerId
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
      ctx.from.id !==
      ownerId
    ) {
      await ctx.answerCbQuery(
        'ليست لك',
        { show_alert: true }
      );

      return;
    }

    const group =
      getGroup(ctx.chat.id);

    const session =
      group.adminSessions?.[
        String(ownerId)
      ];

    if (!session) {
      await ctx.answerCbQuery(
        'انتهت العملية',
        { show_alert: true }
      );

      return;
    }

    if (
      !ADMIN_RIGHTS.some(
        x => x.key === key
      )
    ) {
      await ctx.answerCbQuery(
        'صلاحية غير معروفة',
        { show_alert: true }
      );

      return;
    }

    session[key] =
      !session[key];

    saveData();

    await ctx.answerCbQuery();

    await ctx.editMessageReplyMarkup(
      adminKeyboard(
        ctx.chat.id,
        ownerId
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
      ctx.from.id !==
      ownerId
    ) {
      await ctx.answerCbQuery(
        'ليست لك',
        { show_alert: true }
      );

      return;
    }

    const group =
      getGroup(ctx.chat.id);

    const session =
      group.adminSessions?.[
        String(ownerId)
      ];

    if (!session) {
      await ctx.answerCbQuery(
        'انتهت العملية',
        { show_alert: true }
      );

      return;
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

          can_manage_topics:
            !!session.can_manage_topics,

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
        err.message
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
      ctx.from.id !==
      ownerId
    ) {
      await ctx.answerCbQuery(
        'ليست لك',
        { show_alert: true }
      );

      return;
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
   CALLBACKS - الأغاني
========================================================= */

bot.action(
  /^song:(.+)$/,
  async ctx => {
    const videoId =
      ctx.match[1];

    if (!ytSearch) {
      await ctx.answerCbQuery(
        'yt-search غير مثبت',
        {
          show_alert: true
        }
      );

      return;
    }

    try {
      const result =
        await ytSearch(videoId);

      let song =
        result.videos.find(
          x =>
            x.videoId ===
            videoId
        );

      if (!song) {
        song =
          result.videos[0];
      }

      if (!song) {
        await ctx.answerCbQuery(
          'الأغنية غير موجودة',
          {
            show_alert: true
          }
        );

        return;
      }

      await ctx.answerCbQuery(
        'تم اختيار الأغنية'
      );

      await ctx.reply(
        `🎵 ${song.title}

• الفنان ↤ ${song.author?.name || 'غير معروف'}
• المدة ↤ ${song.timestamp || 'غير معروف'}

• ${song.url}

⚠️ التشغيل الفعلي داخل المكالمة يحتاج نظام تشغيل صوتي إضافي.`
      );
    } catch (err) {
      console.error(
        'song callback:',
        err.message
      );

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
   CALLBACK - همسة رد
========================================================= */

bot.action(
  /^whisper_reply:(.+)$/,
  async ctx => {
    const id =
      ctx.match[1];

    const whisper =
      db.whispers[id];

    if (!whisper) {
      await ctx.answerCbQuery(
        'الهمسة غير موجودة',
        {
          show_alert: true
        }
      );

      return;
    }

    if (
      ctx.from.id !==
      whisper.receiverId
    ) {
      await ctx.answerCbQuery(
        'هذه الهمسة ليست لك',
        {
          show_alert: true
        }
      );

      return;
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
   معالج القروب
========================================================= */

async function handleGroupText(ctx) {
  if (!isGroup(ctx)) {
    return false;
  }

  const text =
    ctx.message?.text?.trim();

  if (!text) {
    return false;
  }

  console.log(
    `📩 GROUP | ${ctx.chat.id} | @${ctx.from?.username || 'no_username'} | ${text}`
  );

  touchUser(ctx);

  /*
    الحماية أولًا
  */

  if (
    await checkProtection(ctx)
  ) {
    return true;
  }

  /*
    قفل الأوامر
  */

  if (
    await handleCommandLock(
      ctx,
      text
    )
  ) {
    return true;
  }

  if (
    await checkCommandLock(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
    المالك
  */

  if (
    await handleOwnerCommand(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
    الردود المخصصة
  */

  if (
    await handleCustomReplies(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
    حذف Reply
  */

  if (
    await handleDeleteReply(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
    الرتب
  */

  if (
    await handleRankCommand(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
    التفاعل
  */

  if (
    await handleInteraction(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
    العقوبات
  */

  if (
    await handlePunishments(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
    الحماية
  */

  if (
    await handleProtectionSettings(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
    الكلمات الممنوعة
  */

  if (
    await handleForbiddenWords(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
    رفع مشرف
  */

  if (
    await handlePromoteAdmin(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
    الصلاحيات
  */

  if (
    await handlePermissions(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
    الهمسات
  */

  if (
    await handleWhisper(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
    الأغاني
  */

  if (
    await handleMusic(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
    الألقاب
  */

  if (
    await handleTitles(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
    الاقتصاد
  */

  if (
    await handleEconomy(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
    التنظيف
  */

  if (
    await handleCleaning(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
    الدعوة
  */

  if (
    await handleInvite(
      ctx,
      text
    )
  ) {
    return true;
  }

  return false;
}

/* =========================================================
   رسائل القروب
========================================================= */

bot.on(
  'message',
  async ctx => {
    try {
      if (isGroup(ctx)) {
        /*
          النصوص
        */

        if (ctx.message.text) {
          await handleGroupText(ctx);
          return;
        }

        /*
          الميديا والحماية
        */

        if (
          await checkProtection(ctx)
        ) {
          return;
        }

        /*
          مكالمة صوتية
        */

        if (
          ctx.message.video_chat_started
        ) {
          await reply(
            ctx,
            '• بدأت المكالمه الصوتيه 🎙️'
          );

          return;
        }

        if (
          ctx.message.video_chat_ended
        ) {
          await reply(
            ctx,
            '• انتهت المكالمه الصوتيه'
          );

          return;
        }

        return;
      }

      /*
        الخاص
      */

      if (isPrivate(ctx)) {
        await handlePrivateMessage(ctx);
      }
    } catch (err) {
      console.error(
        'message handler:',
        err.message
      );
    }
  }
);

/* =========================================================
   edited_message
   مهم جدًا للحماية
========================================================= */

bot.on(
  'edited_message',
  async ctx => {
    try {
      await handleEditedMessage(ctx);
    } catch (err) {
      console.error(
        'edited message:',
        err.message
      );
    }
  }
);

/* =========================================================
   أخطاء البوت
========================================================= */

bot.catch(
  (err, ctx) => {
    console.error(
      '❌ BOT ERROR:',
      err
    );

    try {
      if (ctx?.callbackQuery) {
        ctx.answerCbQuery(
          'حدث خطأ',
          {
            show_alert: true
          }
        );
      }
    } catch {}
  }
);

/* =========================================================
   تشغيل البوت
========================================================= */

(async () => {
  try {
    try {
      await bot.telegram.deleteWebhook({
        drop_pending_updates: false
      });

      console.log(
        '✅ Webhook check completed'
      );
    } catch (err) {
      console.log(
        '⚠️ Webhook cleanup:',
        err.message
      );
    }

    const me =
      await bot.telegram.getMe();

    console.log(
      `✅ Bot started: @${me.username}`
    );

    console.log(
      '📡 Starting Telegram long polling...'
    );

    await bot.launch();

    console.log(
      '✅ Telegram bot is running...'
    );
  } catch (err) {
    console.error(
      '❌ Failed to start bot:',
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
