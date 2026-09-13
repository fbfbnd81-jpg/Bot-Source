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
const DATA_FILE = path.join(DATA_DIR, 'database.json');

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
  subscribers: {},
  owner: {
    username: OWNER_USERNAME,
    id: null
  },
  botSettings: {
    replies: true,
    bank: true,
    communication: true,
    forcedSubscription: false,
    serviceBot: true,
    stats: true,
    zajeel: true,
    formats: true
  }
};

let db = null;

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      db = clone(defaultData);
      saveData();
      return;
    }

    const raw = fs.readFileSync(DATA_FILE, 'utf8');

    if (!raw.trim()) {
      db = clone(defaultData);
      saveData();
      return;
    }

    db = JSON.parse(raw);

    if (!db.groups) db.groups = {};
    if (!db.users) db.users = {};
    if (!db.whispers) db.whispers = {};
    if (!db.subscribers) db.subscribers = {};
    if (!db.owner) db.owner = clone(defaultData.owner);
    if (!db.botSettings) {
      db.botSettings = clone(defaultData.botSettings);
    }

  } catch (err) {
    console.error('❌ خطأ في تحميل قاعدة البيانات:', err);

    db = clone(defaultData);
    saveData();
  }
}

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(db, null, 2),
      'utf8'
    );
  } catch (err) {
    console.error('❌ خطأ في حفظ قاعدة البيانات:', err);
  }
}

loadData();

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

  mainOwner: {
    name: 'مالك أساسي',
    level: 3
  },

  myth: {
    name: 'Myth',
    level: 4
  },

  mythStar: {
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

function parseRank(text) {
  if (!text) return null;

  const value = String(text)
    .trim()
    .toLowerCase();

  const ranks = {
    'عضو': RANKS.member,
    'مميز': RANKS.vip,
    'مالك': RANKS.owner,
    'مالك اساسي': RANKS.mainOwner,
    'مالك أساسي': RANKS.mainOwner,

    'myth': RANKS.myth,
    'm': RANKS.myth,

    'my': RANKS.mythStar,
    'myth 🎖️': RANKS.mythStar,
    'myth🎖️': RANKS.mythStar,

    'dev²🎖': RANKS.dev2,
    'dev2': RANKS.dev2,

    'dev 🎖': RANKS.dev,
    'dev🎖': RANKS.dev,
    'dev': RANKS.dev
  };

  return ranks[value] || null;
}

/* =========================================================
   التسلية - منفصلة عن الرتب
========================================================= */

const FUN_TITLES = {
  'اميره': 'أميرة',
  'أميرة': 'أميرة',

  'ملكه': 'ملكة',
  'ملكة': 'ملكة',

  'امير': 'أمير',
  'أمير': 'أمير',

  'ملك': 'ملك'
};

/* =========================================================
   الحماية الافتراضية
========================================================= */

const DEFAULT_PROTECTION = {
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
  stickers: true,
  gifs: false,
  audio: false,
  voice: false,

  forbiddenWords: true,

  maxMessageLength: 1000,
  repeatLimit: 3,

  warningsEnabled: true,
  autoMute: true,
  autoBan: false
};

/* =========================================================
   أنواع التنظيف
========================================================= */

const CLEANING_TYPES = {
  1: 'stickers',
  2: 'photos',
  3: 'videos',
  4: 'documents',
  5: 'gifs',
  6: 'audio',
  7: 'voice',
  8: 'links'
};

const CLEANING_NAMES = {
  stickers: 'الملصقات',
  photos: 'الصور',
  videos: 'الفيديوهات',
  documents: 'الملفات',
  gifs: 'GIF',
  audio: 'الصوتيات',
  voice: 'التسجيلات الصوتية',
  links: 'الروابط'
};

const ALL_CLEANING_TYPES = Object.values(CLEANING_TYPES);

const DEFAULT_AUTO_CLEANING = {
  stickers: true,
  photos: true,
  videos: true,
  documents: true,
  gifs: true,
  audio: true,
  voice: true,
  links: true
};

function createCleanupQueue() {
  return {
    stickers: [],
    photos: [],
    videos: [],
    documents: [],
    gifs: [],
    audio: [],
    voice: [],
    links: []
  };
}

/* =========================================================
   تجهيز بيانات المجموعة
========================================================= */

function normalizeGroup(group) {
  if (!group.ranks) group.ranks = {};
  if (!group.interactions) group.interactions = {};
  if (!group.warnings) group.warnings = {};
  if (!group.muted) group.muted = {};
  if (!group.globalMuted) group.globalMuted = {};
  if (!group.restricted) group.restricted = {};

  if (!group.commandLocks) group.commandLocks = {};

  if (!group.forbiddenWords) {
    group.forbiddenWords = [];
  }

  if (!group.customReplies) {
    group.customReplies = {};
  }

  if (!group.customCommands) {
    group.customCommands = {};
  }

  if (!group.titles) {
    group.titles = {};
  }

  /*
  التسلية منفصلة تمامًا عن الرتبة
  */
  if (!group.funTitles) {
    group.funTitles = {};
  }

  if (!group.adminSessions) {
    group.adminSessions = {};
  }

  if (!group.repetition) {
    group.repetition = {};
  }

  if (!group.economy) {
    group.economy = {};
  }

  if (!group.protection) {
    group.protection = clone(DEFAULT_PROTECTION);
  } else {
    group.protection = {
      ...clone(DEFAULT_PROTECTION),
      ...group.protection
    };
  }

  /*
  نضمن أن الملصقات مفعلة في الحماية
  */
  if (typeof group.protection.stickers !== 'boolean') {
    group.protection.stickers = true;
  }

  if (!group.cleanupQueue) {
    group.cleanupQueue = createCleanupQueue();
  } else {
    group.cleanupQueue = {
      ...createCleanupQueue(),
      ...group.cleanupQueue
    };
  }

  if (!group.autoCleaningTypes) {
    group.autoCleaningTypes = clone(DEFAULT_AUTO_CLEANING);
  } else {
    group.autoCleaningTypes = {
      ...clone(DEFAULT_AUTO_CLEANING),
      ...group.autoCleaningTypes
    };
  }

  if (typeof group.cleaningAuto !== 'boolean') {
    group.cleaningAuto = false;
  }

  return group;
}

/* =========================================================
   المجموعات والمستخدمين
========================================================= */

function isGroup(ctx) {
  return Boolean(
    ctx.chat &&
    (ctx.chat.type === 'group' ||
      ctx.chat.type === 'supergroup')
  );
}

function isPrivate(ctx) {
  return Boolean(
    ctx.chat &&
    ctx.chat.type === 'private'
  );
}

function getGroup(chatId) {
  const id = String(chatId);

  if (!db.groups[id]) {
    db.groups[id] = {
      id: chatId,
      title: '',
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
      funTitles: {},
      adminSessions: {},
      repetition: {},
      economy: {},
      protection: clone(DEFAULT_PROTECTION),
      cleanupQueue: createCleanupQueue(),
      autoCleaningTypes: clone(DEFAULT_AUTO_CLEANING),
      cleaningAuto: false,
      stats: {
        messages: 0,
        commands: 0
      }
    };
  }

  return normalizeGroup(db.groups[id]);
}

function ensureUser(user) {
  if (!user || !user.id) return null;

  const id = String(user.id);

  if (!db.users[id]) {
    db.users[id] = {
      id: user.id,
      username: user.username || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      money: 0,
      stats: {
        messages: 0,
        commands: 0
      }
    };
  }

  db.users[id].username = user.username || db.users[id].username || '';
  db.users[id].first_name =
    user.first_name || db.users[id].first_name || '';

  db.users[id].last_name =
    user.last_name || db.users[id].last_name || '';

  return db.users[id];
}

function touchUser(ctx) {
  if (!ctx.from) return null;

  const user = ensureUser(ctx.from);

  if (user) {
    user.stats.messages++;
  }

  if (isGroup(ctx)) {
    const group = getGroup(ctx.chat.id);

    group.stats.messages++;

    const id = String(ctx.from.id);

    if (!group.interactions[id]) {
      group.interactions[id] = {
        messages: 0,
        lastMessage: 0
      };
    }

    group.interactions[id].messages++;
    group.interactions[id].lastMessage = Date.now();
  }

  return user;
}

/* =========================================================
   الرسالة الحالية
   مهم للرسائل المعدلة
========================================================= */

function getCurrentMessage(ctx) {
  return (
    ctx.message ||
    ctx.update?.edited_message ||
    ctx.update?.channel_post ||
    {}
  );
}

/* =========================================================
   الرد
========================================================= */

async function reply(ctx, text, extra = {}) {
  try {
    const message = getCurrentMessage(ctx);

    const options = {
      ...extra
    };

    if (message?.message_id) {
      options.reply_parameters = {
        message_id: message.message_id
      };
    }

    return await ctx.reply(text, options);

  } catch (err) {
    try {
      return await ctx.telegram.sendMessage(
        ctx.chat.id,
        text,
        extra
      );
    } catch {
      return null;
    }
  }
}

/* =========================================================
   تنسيق الأرقام
========================================================= */

function formatNumber(number) {
  return Number(number || 0).toLocaleString('en-US');
}

/* =========================================================
   تنظيف النص
========================================================= */

function cleanText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* =========================================================
   رتبة المستخدم
========================================================= */

function getRank(ctx, userId = null) {
  if (!isGroup(ctx)) {
    return RANKS.member;
  }

  const group = getGroup(ctx.chat.id);

  const id = String(
    userId ||
    ctx.from?.id ||
    ''
  );

  /*
  المالك الثابت
  */
  if (
    ctx.from?.username &&
    ctx.from.username.toLowerCase() ===
      OWNER_USERNAME.toLowerCase() &&
    !userId
  ) {
    return RANKS.dev;
  }

  const rankName = group.ranks[id];

  if (!rankName) {
    /*
    نتحقق من المالك الأساسي المحفوظ
    */
    if (
      db.owner?.id &&
      String(db.owner.id) === id
    ) {
      return RANKS.dev;
    }

    return RANKS.member;
  }

  return parseRank(rankName) || RANKS.member;
}

/* =========================================================
   مستوى الرتبة
========================================================= */

function getRankLevel(ctx, userId = null) {
  return getRank(ctx, userId).level;
}

/* =========================================================
   التحقق من الرتبة
========================================================= */

function hasRank(ctx, level) {
  return getRankLevel(ctx) >= level;
}

/* =========================================================
   المستخدم المحمي
========================================================= */

function isProtectedUser(ctx, userId) {
  if (!isGroup(ctx)) return false;

  const id = String(userId);

  if (
    db.owner?.id &&
    String(db.owner.id) === id
  ) {
    return true;
  }

  const group = getGroup(ctx.chat.id);

  const targetLevel = getRankLevel(ctx, id);
  const myLevel = getRankLevel(ctx);

  return targetLevel >= myLevel;
}

/* =========================================================
   الهدف بالرد
========================================================= */

async function getTarget(ctx) {
  const message = getCurrentMessage(ctx);

  const replied =
    message?.reply_to_message?.from;

  if (!replied) {
    return null;
  }

  return replied;
}

/* =========================================================
   هل الرسالة تحتوي رابط؟
========================================================= */

function messageHasLink(text) {
  return /https?:\/\/|www\.|t\.me\/|telegram\.me\//i.test(
    String(text || '')
  );
}

/* =========================================================
   نوع محتوى الرسالة للتنظيف
========================================================= */

function getCleanupType(message) {
  if (!message) return null;

  if (message.sticker) {
    return 'stickers';
  }

  if (message.photo) {
    return 'photos';
  }

  if (message.video) {
    return 'videos';
  }

  if (message.document) {
    return 'documents';
  }

  if (message.animation) {
    return 'gifs';
  }

  if (message.audio) {
    return 'audio';
  }

  if (message.voice) {
    return 'voice';
  }

  const text =
    message.text ||
    message.caption ||
    '';

  if (messageHasLink(text)) {
    return 'links';
  }

  return null;
}

/* =========================================================
   تسجيل الرسائل للتنظيف التلقائي
========================================================= */

function trackMessageForCleaning(ctx) {
  if (!isGroup(ctx)) return;

  const message = getCurrentMessage(ctx);

  if (!message?.message_id) return;

  const type = getCleanupType(message);

  if (!type) return;

  const group = getGroup(ctx.chat.id);

  if (!group.cleanupQueue[type]) {
    group.cleanupQueue[type] = [];
  }

  if (
    !group.cleanupQueue[type].includes(
      message.message_id
    )
  ) {
    group.cleanupQueue[type].push(
      message.message_id
    );
  }

  /*
  لا نخلي الذاكرة تكبر بلا نهاية
  */
  if (
    group.cleanupQueue[type].length > 1000
  ) {
    group.cleanupQueue[type].splice(
      0,
      group.cleanupQueue[type].length - 1000
    );
  }
}

/* =========================================================
   تنظيف نوع معين
========================================================= */

async function cleanQueue(chatId, type) {
  const group = getGroup(chatId);

  const ids =
    group.cleanupQueue[type] || [];

  if (!ids.length) {
    return 0;
  }

  let deleted = 0;

  for (const messageId of ids) {
    try {
      await bot.telegram.deleteMessage(
        chatId,
        messageId
      );

      deleted++;

    } catch {
      /*
      ممكن الرسالة تكون انحذفت مسبقًا
      أو البوت ما عنده صلاحية
      */
    }
  }

  group.cleanupQueue[type] = [];

  saveData();

  return deleted;
}

/* =========================================================
   تنظيف جميع الأنواع
========================================================= */

async function cleanAll(chatId) {
  let total = 0;

  for (const type of ALL_CLEANING_TYPES) {
    total += await cleanQueue(
      chatId,
      type
    );
  }

  return total;
}

/* =========================================================
   الأوامر المعروفة
========================================================= */

const KNOWN_COMMANDS = new Set([
  'رتبتي',
  'رتبته',

  'رفع',
  'تنزيل',

  'رفع اميره',
  'رفع أميرة',
  'رفع ملكه',
  'رفع ملكة',
  'رفع امير',
  'رفع أمير',
  'رفع ملك',

  'تسلية',

  'مق',
  'مم',
  'خخ',

  'تنظيف',
  'تنظيف 1',
  'تنظيف 2',
  'تنظيف 3',
  'تنظيف 4',
  'تنظيف 5',
  'تنظيف 6',
  'تنظيف 7',
  'تنظيف 8',
  'تنظيف 9',

  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',

  'تفعيل التنظيف التلقائي',
  'تعطيل التنظيف التلقائي',

  'تفعيل الحماية',
  'تعطيل الحماية',

  'قفل الروابط',
  'فتح الروابط',

  'قفل الملصقات',
  'فتح الملصقات',

  'قفل الصور',
  'فتح الصور',

  'قفل الفيديو',
  'فتح الفيديو',

  'قفل الملفات',
  'فتح الملفات',

  'قفل GIF',
  'فتح GIF',

  'قفل الصوتيات',
  'فتح الصوتيات',

  'قفل التسجيلات',
  'فتح التسجيلات',

  'قفل المخالفات',
  'فتح المخالفات',

  'قفل التكرار',
  'فتح التكرار',

  'قفل التوجيه',
  'فتح التوجيه',

  'قفل المنشن',
  'فتح المنشن',

  'قفل الأرقام',
  'فتح الأرقام',

  'قفل الاعلانات',
  'فتح الاعلانات',

  'قفل الانجليزي',
  'فتح الانجليزي',

  'قفل امر',
  'فتح امر',

  'مسح المكتومين',
  'مسح المكتومين عام',
  'مسح المقيدين',

  'ميوت',
  'فك الميوت',

  'تقييد',
  'الغاء التقييد',

  'حظر',
  'طرد',

  'تحذير',
  'إزالة تحذير',

  'لقبي',
  'لقبه',

  'بنك',
  'فلوسي',
  'تحويل',

  'فعالية',
  'ابدأ فعالية',

  'العاب',
  'الألعاب',

  'احصائياتي',
  'احصائيات',

  'همسة',
  'رد',
  'حذف'
]);

function isKnownCommandText(text) {
  const value = cleanText(text);

  if (KNOWN_COMMANDS.has(value)) {
    return true;
  }

  if (
    /^تنظيف\s+[1-9]$/.test(value)
  ) {
    return true;
  }

  if (
    /^رفع\s+(اميره|أميرة|ملكه|ملكة|امير|أمير|ملك)$/.test(value)
  ) {
    return true;
  }

  return false;
}
/* =========================================================
   الرتب المطلوبة للأوامر
========================================================= */

function requiredRankMessage(level) {
  const rank = Object.values(RANKS).find(
    r => r.level === level
  );

  return rank
    ? `⚠️ هذا الأمر يحتاج رتبة ${rank.name}`
    : '⚠️ لا تملك الصلاحية لهذا الأمر';
}

async function requireRank(ctx, level) {
  if (!hasRank(ctx, level)) {
    await reply(
      ctx,
      requiredRankMessage(level)
    );

    return false;
  }

  return true;
}

/* =========================================================
   التحقق من المستخدم المستهدف
========================================================= */

function canManageTarget(ctx, targetId) {
  if (!targetId) return false;

  const myLevel = getRankLevel(ctx);
  const targetLevel = getRankLevel(
    ctx,
    targetId
  );

  /*
  لا يمكن معاقبة شخص أعلى أو مساوي للرتبة
  */
  if (targetLevel >= myLevel) {
    return false;
  }

  /*
  المالك الأساسي محمي
  */
  if (
    db.owner?.id &&
    String(db.owner.id) ===
      String(targetId)
  ) {
    return false;
  }

  return true;
}

/* =========================================================
   مخالفة الرسالة
========================================================= */

async function registerViolation(
  ctx,
  reason = 'مخالفة'
) {
  if (!isGroup(ctx)) return;

  const message =
    getCurrentMessage(ctx);

  const user = message.from || ctx.from;

  if (!user) return;

  const group = getGroup(ctx.chat.id);

  const userId = String(user.id);

  if (!group.warnings[userId]) {
    group.warnings[userId] = 0;
  }

  /*
  حذف الرسالة المخالفة أولًا
  */
  if (message.message_id) {
    try {
      await ctx.telegram.deleteMessage(
        ctx.chat.id,
        message.message_id
      );
    } catch {}
  }

  /*
  زيادة التحذير
  */
  if (group.protection.warningsEnabled) {
    group.warnings[userId]++;
  }

  let warningText =
    `⚠️ مخالفة من ${user.first_name || 'المستخدم'}\n` +
    `• السبب: ${reason}`;

  if (group.protection.warningsEnabled) {
    warningText +=
      `\n• التحذيرات: ${group.warnings[userId]}`;
  }

  /*
  مهم:
  لا نستخدم reply على الرسالة المحذوفة
  */
  try {
    await ctx.telegram.sendMessage(
      ctx.chat.id,
      warningText
    );
  } catch {}

  /*
  3 تحذيرات = كتم
  */
  if (
    group.protection.autoMute &&
    group.warnings[userId] >= 3
  ) {
    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        user.id,
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

      group.muted[userId] = true;

      try {
        await ctx.telegram.sendMessage(
          ctx.chat.id,
          `🔇 تم كتم ${user.first_name || 'المستخدم'} بعد وصوله إلى 3 تحذيرات`
        );
      } catch {}

    } catch {}
  }

  /*
  الحظر التلقائي إذا كان مفعلًا
  */
  if (
    group.protection.autoBan &&
    group.warnings[userId] >= 3
  ) {
    try {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        user.id
      );

      try {
        await ctx.telegram.sendMessage(
          ctx.chat.id,
          `⛔ تم حظر ${user.first_name || 'المستخدم'} بسبب تكرار المخالفات`
        );
      } catch {}

    } catch {}
  }

  saveData();
}

/* =========================================================
   فحص محتوى الرسالة
========================================================= */

function getMediaViolation(
  message,
  protection
) {
  if (!message) return null;

  if (
    message.sticker &&
    protection.stickers
  ) {
    return 'الملصقات';
  }

  if (
    message.photo &&
    protection.photos
  ) {
    return 'الصور';
  }

  if (
    message.video &&
    protection.videos
  ) {
    return 'الفيديوهات';
  }

  if (
    message.document &&
    protection.documents
  ) {
    return 'الملفات';
  }

  if (
    message.animation &&
    protection.gifs
  ) {
    return 'GIF';
  }

  if (
    message.audio &&
    protection.audio
  ) {
    return 'الصوتيات';
  }

  if (
    message.voice &&
    protection.voice
  ) {
    return 'التسجيلات الصوتية';
  }

  return null;
}

/* =========================================================
   التكرار
========================================================= */

function getRepetitionKey(ctx) {
  const message =
    getCurrentMessage(ctx);

  const text =
    message.text ||
    message.caption ||
    '';

  return cleanText(text)
    .toLowerCase();
}

function checkRepetition(ctx) {
  const group =
    getGroup(ctx.chat.id);

  const message =
    getCurrentMessage(ctx);

  const text =
    message.text ||
    message.caption ||
    '';

  if (!text) return false;

  const key = getRepetitionKey(ctx);

  if (!key) return false;

  const userId =
    String(
      message.from?.id ||
      ctx.from?.id ||
      ''
    );

  if (!userId) return false;

  if (!group.repetition[userId]) {
    group.repetition[userId] = {};
  }

  const now = Date.now();

  if (
    !group.repetition[userId][key]
  ) {
    group.repetition[userId][key] = {
      count: 1,
      last: now
    };

    return false;
  }

  const item =
    group.repetition[userId][key];

  /*
  إذا مر أكثر من دقيقة نبدأ العد من جديد
  */
  if (
    now - item.last >
    60 * 1000
  ) {
    item.count = 1;
    item.last = now;

    return false;
  }

  item.count++;
  item.last = now;

  return (
    item.count >=
    group.protection.repeatLimit
  );
}

/* =========================================================
   فحص الحماية
========================================================= */

async function checkProtection(ctx) {
  if (!isGroup(ctx)) return false;

  const group =
    getGroup(ctx.chat.id);

  if (!group.protection.enabled) {
    return false;
  }

  const message =
    getCurrentMessage(ctx);

  if (!message) return false;

  /*
  تجاهل رسائل البوت
  */
  if (
    message.from?.is_bot
  ) {
    return false;
  }

  const text =
    message.text ||
    message.caption ||
    '';

  /*
  المحتوى الإعلامي
  */
  const mediaViolation =
    getMediaViolation(
      message,
      group.protection
    );

  if (mediaViolation) {
    await registerViolation(
      ctx,
      `إرسال ${mediaViolation}`
    );

    return true;
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
      'إرسال روابط'
    );

    return true;
  }

  /*
  المنشن
  */
  if (
    group.protection.mentions &&
    /@\w{3,}/.test(text)
  ) {
    await registerViolation(
      ctx,
      'منشن'
    );

    return true;
  }

  /*
  أرقام الهاتف
  */
  if (
    group.protection.phoneNumbers &&
    /(?:\+?966|05)\s?\d{8,9}/.test(
      text
    )
  ) {
    await registerViolation(
      ctx,
      'رقم هاتف'
    );

    return true;
  }

  /*
  الإعلانات
  */
  if (
    group.protection.ads &&
    /(للبيع|للشراء|اعلان|إعلان|خصم|متجر|تواصل خاص)/i.test(
      text
    )
  ) {
    await registerViolation(
      ctx,
      'إعلان'
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
  إعادة التوجيه
  */
  if (
    group.protection.forwards &&
    (
      message.forward_origin ||
      message.is_automatic_forward
    )
  ) {
    await registerViolation(
      ctx,
      'رسالة معاد توجيهها'
    );

    return true;
  }

  /*
  اللغة الإنجليزية
  */
  if (
    group.protection.english &&
    text &&
    /[A-Za-z]{4,}/.test(text)
  ) {
    await registerViolation(
      ctx,
      'اللغة الإنجليزية'
    );

    return true;
  }

  /*
  الكلمات الممنوعة
  */
  if (
    group.protection.forbiddenWords &&
    Array.isArray(
      group.forbiddenWords
    ) &&
    text
  ) {
    const lower =
      text.toLowerCase();

    const found =
      group.forbiddenWords.find(
        word =>
          lower.includes(
            String(word).toLowerCase()
          )
      );

    if (found) {
      await registerViolation(
        ctx,
        'كلمة ممنوعة'
      );

      return true;
    }
  }

  /*
  التكرار
  */
  if (
    group.protection.repetition &&
    checkRepetition(ctx)
  ) {
    await registerViolation(
      ctx,
      'تكرار الرسائل'
    );

    return true;
  }

  return false;
}

/* =========================================================
   إعدادات الحماية
========================================================= */

const PROTECTION_SETTINGS = {
  'الروابط': 'links',
  'الصور': 'photos',
  'الفيديو': 'videos',
  'الفيديوهات': 'videos',
  'الملفات': 'documents',
  'الملصقات': 'stickers',
  'GIF': 'gifs',
  'gif': 'gifs',
  'الصوتيات': 'audio',
  'التسجيلات': 'voice',
  'المنشن': 'mentions',
  'الأرقام': 'phoneNumbers',
  'الاعلانات': 'ads',
  'الإعلانات': 'ads',
  'الانجليزي': 'english',
  'الإنجليزي': 'english',
  'التكرار': 'repetition',
  'التوجيه': 'forwards'
};

/* =========================================================
   أوامر قفل وفتح الحماية
========================================================= */

async function handleProtectionSetting(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  const match =
    text.match(
      /^(قفل|فتح)\s+(.+)$/
    );

  if (!match) {
    return false;
  }

  const action = match[1];
  const name = match[2].trim();

  /*
  أمر قفل/فتح أمر له نظام منفصل
  */
  if (name === 'امر') {
    return false;
  }

  if (
    ![
      'الروابط',
      'الصور',
      'الفيديو',
      'الفيديوهات',
      'الملفات',
      'الملصقات',
      'GIF',
      'gif',
      'الصوتيات',
      'التسجيلات',
      'المنشن',
      'الأرقام',
      'الاعلانات',
      'الإعلانات',
      'الانجليزي',
      'الإنجليزي',
      'التكرار',
      'التوجيه'
    ].includes(name)
  ) {
    return false;
  }

  if (
    !(await requireRank(ctx, 6))
  ) {
    return true;
  }

  const key =
    PROTECTION_SETTINGS[name];

  const group =
    getGroup(ctx.chat.id);

  group.protection[key] =
    action === 'قفل';

  saveData();

  const state =
    action === 'قفل'
      ? 'تم قفل'
      : 'تم فتح';

  await reply(
    ctx,
    `• ${state} ${name}`
  );

  return true;
}

/* =========================================================
   تفعيل وتعطيل الحماية
========================================================= */

async function handleProtectionCommand(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  if (
    text !== 'تفعيل الحماية' &&
    text !== 'تعطيل الحماية'
  ) {
    return false;
  }

  if (
    !(await requireRank(ctx, 6))
  ) {
    return true;
  }

  const group =
    getGroup(ctx.chat.id);

  if (
    text === 'تفعيل الحماية'
  ) {
    group.protection.enabled = true;

    /*
    الملصقات ضمن الحماية
    */
    group.protection.stickers = true;

    saveData();

    await reply(
      ctx,
      '• تم تفعيل الحماية بنجاح'
    );

  } else {
    group.protection.enabled = false;

    saveData();

    await reply(
      ctx,
      '• تم تعطيل الحماية'
    );
  }

  return true;
}

/* =========================================================
   تفعيل قفل المخالفات
========================================================= */

async function handleWarningsCommand(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  if (
    text !== 'قفل المخالفات' &&
    text !== 'فتح المخالفات'
  ) {
    return false;
  }

  if (
    !(await requireRank(ctx, 6))
  ) {
    return true;
  }

  const group =
    getGroup(ctx.chat.id);

  group.protection.warningsEnabled =
    text === 'فتح المخالفات';

  saveData();

  await reply(
    ctx,
    text === 'قفل المخالفات'
      ? '• تم قفل نظام المخالفات'
      : '• تم فتح نظام المخالفات'
  );

  return true;
}

/* =========================================================
   تنظيف المقيدين
========================================================= */

async function handleClearRestricted(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  if (
    text !== 'مق' &&
    text !== 'مسح المقيدين'
  ) {
    return false;
  }

  if (
    !(await requireRank(ctx, 3))
  ) {
    return true;
  }

  const group =
    getGroup(ctx.chat.id);

  let count = 0;

  for (
    const userId of Object.keys(
      group.restricted
    )
  ) {
    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        Number(userId),
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
            can_pin_messages: false
          }
        }
      );

      delete group.restricted[userId];

      count++;

    } catch {}
  }

  saveData();

  await reply(
    ctx,
    `• تم مسح المقيدين\n• العدد: ${count}`
  );

  return true;
}

/* =========================================================
   مسح المكتومين
========================================================= */

async function handleClearMuted(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  if (
    text !== 'مم' &&
    text !== 'مسح المكتومين' &&
    text !== 'خخ' &&
    text !== 'مسح المكتومين عام'
  ) {
    return false;
  }

  if (
    !(await requireRank(ctx, 3))
  ) {
    return true;
  }

  const group =
    getGroup(ctx.chat.id);

  let count = 0;

  for (
    const userId of Object.keys(
      group.muted
    )
  ) {
    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        Number(userId),
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
            can_pin_messages: false
          }
        }
      );

      delete group.muted[userId];

      count++;

    } catch {}
  }

  saveData();

  await reply(
    ctx,
    `• تم مسح المكتومين\n• العدد: ${count}`
  );

  return true;
}

/* =========================================================
   الترفيع إلى رتبة تسلية
   ليست رتبة إدارية
========================================================= */

async function handleFunTitle(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  const match =
    text.match(
      /^رفع\s+(اميره|أميرة|ملكه|ملكة|امير|أمير|ملك)$/
    );

  if (!match) {
    return false;
  }

  if (
    !(await requireRank(ctx, 5))
  ) {
    return true;
  }

  const title =
    FUN_TITLES[match[1]];

  const target =
    await getTarget(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على الشخص المراد رفعه أولًا'
    );

    return true;
  }

  if (
    !canManageTarget(
      ctx,
      target.id
    )
  ) {
    await reply(
      ctx,
      '⚠️ لا يمكنك رفع هذا المستخدم'
    );

    return true;
  }

  const group =
    getGroup(ctx.chat.id);

  /*
  هنا نحفظ التسلية فقط
  ولا نلمس group.ranks
  */
  group.funTitles[
    String(target.id)
  ] = title;

  saveData();

  await reply(
    ctx,
    `• تم رفع التسلية ↤ ${title}\n• لـ ↤ ${target.first_name || 'المستخدم'}`
  );

  return true;
}

/* =========================================================
   عرض التسلية
========================================================= */

async function handleShowFunTitle(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  if (
    text !== 'تسلية'
  ) {
    return false;
  }

  const group =
    getGroup(ctx.chat.id);

  const title =
    group.funTitles[
      String(ctx.from.id)
    ];

  if (!title) {
    await reply(
      ctx,
      '• ما عندك رتبة تسلية'
    );

    return true;
  }

  await reply(
    ctx,
    `• تسليتك هي ↤ ${title}`
  );

  return true;
}
/* =========================================================
   عرض الرتبة
========================================================= */

async function handleMyRank(ctx, text) {
  if (!isGroup(ctx)) return false;

  if (
    text !== 'رتبتي' &&
    text !== 'رتبته'
  ) {
    return false;
  }

  const group =
    getGroup(ctx.chat.id);

  let targetId = ctx.from.id;
  let targetName =
    ctx.from.first_name || 'المستخدم';

  if (text === 'رتبته') {
    const target =
      await getTarget(ctx);

    if (!target) {
      await reply(
        ctx,
        '• قم بالرد على الشخص أولًا'
      );

      return true;
    }

    targetId = target.id;
    targetName =
      target.first_name || 'المستخدم';
  }

  const rank =
    getRank(ctx, targetId);

  /*
  مهم:
  لا نقرأ funTitles هنا.
  التسلية ليست رتبة.
  */
  if (text === 'رتبتي') {
    await reply(
      ctx,
      `• رتبتك هي ↤ ${rank.name}`
    );
  } else {
    await reply(
      ctx,
      `• رتبة ${targetName} هي ↤ ${rank.name}`
    );
  }

  return true;
}

/* =========================================================
   الترفيع والتنزيل
========================================================= */

async function handleRankCommand(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  const match =
    text.match(
      /^(رفع|تنزيل)\s+(.+)$/
    );

  if (!match) return false;

  /*
  أوامر التسلية يتم التعامل معها منفصلة
  */
  if (
    FUN_TITLES[match[2].trim()]
  ) {
    return false;
  }

  const action = match[1];
  const rankText =
    match[2].trim();

  const rank =
    parseRank(rankText);

  if (!rank) {
    return false;
  }

  /*
  رفع وتنزيل الرتب يحتاج Dev²
  */
  if (
    !(await requireRank(ctx, 6))
  ) {
    return true;
  }

  const target =
    await getTarget(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على الشخص أولًا'
    );

    return true;
  }

  if (
    !canManageTarget(
      ctx,
      target.id
    )
  ) {
    await reply(
      ctx,
      '⚠️ لا يمكنك تعديل رتبة هذا المستخدم'
    );

    return true;
  }

  /*
  لا يمكن إعطاء رتبة مساوية أو أعلى
  */
  if (
    rank.level >=
    getRankLevel(ctx)
  ) {
    await reply(
      ctx,
      '⚠️ لا يمكنك إعطاء رتبة مساوية أو أعلى من رتبتك'
    );

    return true;
  }

  const group =
    getGroup(ctx.chat.id);

  const targetId =
    String(target.id);

  if (action === 'رفع') {
    group.ranks[targetId] =
      rank.name;

    saveData();

    await reply(
      ctx,
      `• تم رفع ${target.first_name || 'المستخدم'} إلى ↤ ${rank.name}`
    );

  } else {
    /*
    التنزيل هنا يعني إزالة الرتبة
    */
    group.ranks[targetId] =
      RANKS.member.name;

    saveData();

    await reply(
      ctx,
      `• تم تنزيل ${target.first_name || 'المستخدم'} إلى ↤ ${RANKS.member.name}`
    );
  }

  return true;
}

/* =========================================================
   التحذير
========================================================= */

async function handleWarnCommand(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  if (
    text !== 'تحذير' &&
    text !== 'إزالة تحذير'
  ) {
    return false;
  }

  if (
    !(await requireRank(ctx, 3))
  ) {
    return true;
  }

  const target =
    await getTarget(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على الشخص أولًا'
    );

    return true;
  }

  if (
    !canManageTarget(
      ctx,
      target.id
    )
  ) {
    await reply(
      ctx,
      '⚠️ لا يمكنك تعديل مخالفات هذا المستخدم'
    );

    return true;
  }

  const group =
    getGroup(ctx.chat.id);

  const id =
    String(target.id);

  if (!group.warnings[id]) {
    group.warnings[id] = 0;
  }

  if (text === 'تحذير') {
    group.warnings[id]++;

    saveData();

    await reply(
      ctx,
      `⚠️ تم تحذير ${target.first_name || 'المستخدم'}\n• التحذيرات: ${group.warnings[id]}`
    );

  } else {
    group.warnings[id] =
      Math.max(
        0,
        group.warnings[id] - 1
      );

    saveData();

    await reply(
      ctx,
      `• تم إزالة تحذير\n• التحذيرات: ${group.warnings[id]}`
    );
  }

  return true;
}

/* =========================================================
   الكتم
========================================================= */

async function handleMuteCommand(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  if (
    text !== 'ميوت' &&
    text !== 'فك الميوت'
  ) {
    return false;
  }

  if (
    !(await requireRank(ctx, 3))
  ) {
    return true;
  }

  const target =
    await getTarget(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على الشخص أولًا'
    );

    return true;
  }

  if (
    !canManageTarget(
      ctx,
      target.id
    )
  ) {
    await reply(
      ctx,
      '⚠️ لا يمكنك كتم هذا المستخدم'
    );

    return true;
  }

  const group =
    getGroup(ctx.chat.id);

  const id =
    String(target.id);

  if (text === 'ميوت') {
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

      saveData();

      await reply(
        ctx,
        `🔇 تم كتم ${target.first_name || 'المستخدم'}`
      );

    } catch {
      await reply(
        ctx,
        '⚠️ تعذر كتم المستخدم، تأكد أن البوت مشرف'
      );
    }

  } else {
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

      delete group.muted[id];

      saveData();

      await reply(
        ctx,
        `🔊 تم فك كتم ${target.first_name || 'المستخدم'}`
      );

    } catch {
      await reply(
        ctx,
        '⚠️ تعذر فك الكتم'
      );
    }
  }

  return true;
}

/* =========================================================
   التقييد
========================================================= */

async function handleRestrictCommand(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  if (
    text !== 'تقييد' &&
    text !== 'الغاء التقييد'
  ) {
    return false;
  }

  if (
    !(await requireRank(ctx, 3))
  ) {
    return true;
  }

  const target =
    await getTarget(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على الشخص أولًا'
    );

    return true;
  }

  if (
    !canManageTarget(
      ctx,
      target.id
    )
  ) {
    await reply(
      ctx,
      '⚠️ لا يمكنك تقييد هذا المستخدم'
    );

    return true;
  }

  const group =
    getGroup(ctx.chat.id);

  const id =
    String(target.id);

  try {
    if (text === 'تقييد') {
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

      group.restricted[id] = true;

      saveData();

      await reply(
        ctx,
        `🔒 تم تقييد ${target.first_name || 'المستخدم'}`
      );

    } else {
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

      delete group.restricted[id];

      saveData();

      await reply(
        ctx,
        `🔓 تم إلغاء تقييد ${target.first_name || 'المستخدم'}`
      );
    }

  } catch {
    await reply(
      ctx,
      '⚠️ تأكد أن البوت مشرف ولديه صلاحية تقييد الأعضاء'
    );
  }

  return true;
}

/* =========================================================
   الحظر
========================================================= */

async function handleBanCommand(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  if (text !== 'حظر') {
    return false;
  }

  if (
    !(await requireRank(ctx, 4))
  ) {
    return true;
  }

  const target =
    await getTarget(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على الشخص أولًا'
    );

    return true;
  }

  if (
    !canManageTarget(
      ctx,
      target.id
    )
  ) {
    await reply(
      ctx,
      '⚠️ لا يمكنك حظر هذا المستخدم'
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
      `⛔ تم حظر ${target.first_name || 'المستخدم'}`
    );

  } catch {
    await reply(
      ctx,
      '⚠️ تعذر حظر المستخدم'
    );
  }

  return true;
}

/* =========================================================
   الطرد
========================================================= */

async function handleKickCommand(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  if (text !== 'طرد') {
    return false;
  }

  if (
    !(await requireRank(ctx, 4))
  ) {
    return true;
  }

  const target =
    await getTarget(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على الشخص أولًا'
    );

    return true;
  }

  if (
    !canManageTarget(
      ctx,
      target.id
    )
  ) {
    await reply(
      ctx,
      '⚠️ لا يمكنك طرد هذا المستخدم'
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
      `🚪 تم طرد ${target.first_name || 'المستخدم'}`
    );

  } catch {
    await reply(
      ctx,
      '⚠️ تعذر طرد المستخدم'
    );
  }

  return true;
}

/* =========================================================
   قفل أمر معين
========================================================= */

async function handleCommandLock(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  const match =
    text.match(
      /^(قفل امر|فتح امر)\s+(.+)$/
    );

  if (!match) {
    return false;
  }

  if (
    !(await requireRank(ctx, 6))
  ) {
    return true;
  }

  const action = match[1];
  const command =
    cleanText(match[2]);

  const group =
    getGroup(ctx.chat.id);

  if (action === 'قفل امر') {
    /*
    نحتاج الرتبة التي سيطبق عليها القفل
    */
    group.adminSessions[
      String(ctx.from.id)
    ] = {
      type: 'lockCommand',
      command,
      createdAt: Date.now()
    };

    saveData();

    await reply(
      ctx,
      '• حسنًا عزيزي قم بإرسال الرتبة الان :'
    );

    return true;
  }

  delete group.commandLocks[command];

  saveData();

  await reply(
    ctx,
    `• تم فتح الأمر ↤ ${command}`
  );

  return true;
}

/* =========================================================
   استقبال الرتبة بعد "قفل امر"
========================================================= */

async function handleCommandLockRank(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  const group =
    getGroup(ctx.chat.id);

  const session =
    group.adminSessions[
      String(ctx.from.id)
    ];

  if (
    !session ||
    session.type !== 'lockCommand'
  ) {
    return false;
  }

  const rank =
    parseRank(text);

  if (!rank) {
    await reply(
      ctx,
      '⚠️ الرتبة غير صحيحة'
    );

    return true;
  }

  group.commandLocks[
    session.command
  ] = rank.level;

  delete group.adminSessions[
    String(ctx.from.id)
  ];

  saveData();

  await reply(
    ctx,
    `• تم قفل الأمر ↤ ${session.command}\n• الرتبة المطلوبة ↤ ${rank.name}`
  );

  return true;
}
/* =========================================================
   نظام التنظيف
========================================================= */

async function handleCleaning(ctx, text) {
  if (!isGroup(ctx)) return false;

  let type = null;

  /*
  الأرقام الجديدة:
  1 ملصقات
  2 صور
  3 فيديو
  4 ملفات
  5 GIF
  6 صوتيات
  7 تسجيلات
  8 روابط
  9 الكل
  */

  if (/^[1-9]$/.test(text)) {
    const number = Number(text);

    if (number === 9) {
      type = 'all';
    } else {
      type = CLEANING_TYPES[number];
    }
  }

  /*
  دعم:
  تنظيف
  تنظيف 1
  ...
  تنظيف 9
  */

  const cleaningMatch =
    text.match(/^تنظيف(?:\s+([1-9]))?$/);

  if (cleaningMatch) {
    const number = cleaningMatch[1]
      ? Number(cleaningMatch[1])
      : 9;

    if (number === 9) {
      type = 'all';
    } else {
      type = CLEANING_TYPES[number];
    }
  }

  if (!type) {
    return false;
  }

  /*
  التنظيف يحتاج Myth 🎖️
  */
  if (!(await requireRank(ctx, 5))) {
    return true;
  }

  let deleted = 0;

  if (type === 'all') {
    deleted = await cleanAll(ctx.chat.id);

    await reply(
      ctx,
      `• تم تنظيف الكل\n• عدد الرسائل المحذوفة: ${deleted}`
    );

    return true;
  }

  deleted = await cleanQueue(
    ctx.chat.id,
    type
  );

  await reply(
    ctx,
    `• تم تنظيف ${CLEANING_NAMES[type]}\n• عدد الرسائل المحذوفة: ${deleted}`
  );

  return true;
}

/* =========================================================
   التنظيف التلقائي
========================================================= */

async function handleAutoCleaning(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  if (
    text !== 'تفعيل التنظيف التلقائي' &&
    text !== 'تعطيل التنظيف التلقائي'
  ) {
    return false;
  }

  if (!(await requireRank(ctx, 5))) {
    return true;
  }

  const group =
    getGroup(ctx.chat.id);

  if (
    text === 'تفعيل التنظيف التلقائي'
  ) {
    group.cleaningAuto = true;

    /*
    جميع الأنواع مفعلة افتراضيًا
    */
    group.autoCleaningTypes = {
      ...DEFAULT_AUTO_CLEANING
    };

    saveData();

    await reply(
      ctx,
      `• تم تفعيل التنظيف التلقائي\n• يتم التنظيف كل دقيقتين\n• الأنواع: ${Object.values(CLEANING_NAMES).join('، ')}`
    );

  } else {
    group.cleaningAuto = false;

    saveData();

    await reply(
      ctx,
      '• تم تعطيل التنظيف التلقائي'
    );
  }

  return true;
}

/* =========================================================
   التنظيف التلقائي - كل دقيقتين
========================================================= */

setInterval(async () => {
  try {
    for (
      const [chatId, groupData]
      of Object.entries(db.groups)
    ) {
      const group =
        normalizeGroup(groupData);

      if (!group.cleaningAuto) {
        continue;
      }

      for (
        const type
        of ALL_CLEANING_TYPES
      ) {
        if (
          group.autoCleaningTypes[type]
        ) {
          await cleanQueue(
            chatId,
            type
          );
        }
      }
    }

    saveData();

  } catch (err) {
    console.error(
      '⚠️ خطأ في التنظيف التلقائي:',
      err.message
    );
  }
}, 120000);

/* =========================================================
   الألقاب
========================================================= */

async function handleTitles(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  if (
    text !== 'لقبي' &&
    text !== 'لقبه'
  ) {
    return false;
  }

  const group =
    getGroup(ctx.chat.id);

  if (text === 'لقبي') {
    const title =
      group.titles[
        String(ctx.from.id)
      ];

    if (!title) {
      await reply(
        ctx,
        '• ما عندك لقب'
      );

    } else {
      await reply(
        ctx,
        `• لقبك هو ↤ ${title}`
      );
    }

    return true;
  }

  const target =
    await getTarget(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على الشخص أولًا'
    );

    return true;
  }

  const title =
    group.titles[
      String(target.id)
    ];

  await reply(
    ctx,
    title
      ? `• لقب ${target.first_name || 'المستخدم'} ↤ ${title}`
      : '• هذا المستخدم لا يملك لقب'
  );

  return true;
}

/* =========================================================
   حذف الرسائل
========================================================= */

async function handleDelete(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  if (
    text !== 'حذف' &&
    text !== 'حذف الرسالة'
  ) {
    return false;
  }

  if (!(await requireRank(ctx, 2))) {
    return true;
  }

  const message =
    getCurrentMessage(ctx);

  if (!message.reply_to_message) {
    await reply(
      ctx,
      '• قم بالرد على الرسالة المراد حذفها'
    );

    return true;
  }

  try {
    await ctx.telegram.deleteMessage(
      ctx.chat.id,
      message.reply_to_message.message_id
    );

    await ctx.telegram.deleteMessage(
      ctx.chat.id,
      message.message_id
    );

  } catch {
    await reply(
      ctx,
      '⚠️ تعذر حذف الرسالة'
    );
  }

  return true;
}

/* =========================================================
   الهمسات
========================================================= */

function createWhisperId() {
  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2, 10)
  );
}

async function handleWhisper(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  if (
    text !== 'همسة' &&
    !text.startsWith('همسة ')
  ) {
    return false;
  }

  const message =
    getCurrentMessage(ctx);

  /*
  الهمسة تبدأ فقط بالرد
  */
  if (!message.reply_to_message) {
    await reply(
      ctx,
      '• قم بالرد على رسالة الشخص المراد إرسال الهمسة له'
    );

    return true;
  }

  const target =
    message.reply_to_message.from;

  if (!target) {
    await reply(
      ctx,
      '⚠️ تعذر تحديد صاحب الرسالة'
    );

    return true;
  }

  const whisperId =
    createWhisperId();

  const textAfter =
    text.startsWith('همسة ')
      ? text.slice(5).trim()
      : '';

  const original =
    message.reply_to_message;

  db.whispers[whisperId] = {
    id: whisperId,
    chatId: ctx.chat.id,
    senderId: ctx.from.id,
    targetId: target.id,
    senderName:
      ctx.from.first_name || 'المستخدم',
    targetName:
      target.first_name || 'المستخدم',
    text: textAfter,
    createdAt: Date.now(),
    replied: false
  };

  saveData();

  /*
  رابط رؤية الهمسة
  */
  const viewLink =
    `https://t.me/${ctx.botInfo?.username || ''}?start=whisper_${whisperId}`;

  const keyboard =
    Markup.inlineKeyboard([
      [
        Markup.button.url(
          '👁 رؤية الهمسة',
          viewLink
        )
      ],
      [
        Markup.button.url(
          '↩️ رد على الهمسة',
          viewLink
        )
      ]
    ]);

  try {
    await ctx.telegram.sendMessage(
      ctx.chat.id,
      `💌 همسة من ${ctx.from.first_name || 'المستخدم'} إلى ${target.first_name || 'المستخدم'}`,
      keyboard
    );

    await reply(
      ctx,
      '• تم إرسال الهمسة'
    );

  } catch {
    await reply(
      ctx,
      '⚠️ تعذر إرسال الهمسة'
    );
  }

  return true;
}

/* =========================================================
   /start - فتح الهمسة
========================================================= */

bot.start(async ctx => {
  const payload =
    ctx.startPayload;

  if (
    !payload ||
    !payload.startsWith('whisper_')
  ) {
    await ctx.reply(
      '• أهلًا بك في بوت إيف 🤍'
    );

    return;
  }

  const whisperId =
    payload.slice('whisper_'.length);

  const whisper =
    db.whispers[whisperId];

  if (!whisper) {
    await ctx.reply(
      '⚠️ الهمسة غير موجودة أو انتهت'
    );

    return;
  }

  const currentUserId =
    ctx.from.id;

  /*
  صاحب الهمسة أو الشخص المرسل إليه
  */
  if (
    currentUserId !== whisper.targetId &&
    currentUserId !== whisper.senderId
  ) {
    await ctx.reply(
      '⚠️ هذه الهمسة ليست موجهة لك'
    );

    return;
  }

  await ctx.reply(
    `💌 الهمسة:\n\n${whisper.text || 'تم إرسال همسة خاصة بدون نص'}`
  );

  /*
  إذا كان الشخص هو المستلم نسمح له بالرد
  */
  if (
    currentUserId === whisper.targetId
  ) {
    const replyKeyboard =
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '↩️ الرد على الهمسة',
            `whisper_reply:${whisperId}`
          )
        ]
      ]);

    await ctx.reply(
      'يمكنك الرد على الهمسة من الزر التالي:',
      replyKeyboard
    );
  }
});

/* =========================================================
   رد الهمسة
========================================================= */

bot.action(
  /^whisper_reply:(.+)$/,
  async ctx => {
    try {
      const whisperId =
        ctx.match[1];

      const whisper =
        db.whispers[whisperId];

      if (!whisper) {
        await ctx.answerCbQuery(
          'الهمسة غير موجودة'
        );

        return;
      }

      if (
        ctx.from.id !==
        whisper.targetId
      ) {
        await ctx.answerCbQuery(
          'هذه الهمسة ليست لك'
        );

        return;
      }

      /*
      نخزن جلسة الرد
      */
      if (!db.whisperReplies) {
        db.whisperReplies = {};
      }

      db.whisperReplies[
        String(ctx.from.id)
      ] = {
        whisperId,
        chatId: whisper.chatId,
        senderId: whisper.senderId,
        targetId: whisper.targetId,
        createdAt: Date.now()
      };

      saveData();

      await ctx.answerCbQuery();

      await ctx.reply(
        '• أرسل ردك الآن، وسيتم إرساله إلى صاحب الهمسة'
      );

    } catch {
      try {
        await ctx.answerCbQuery(
          'حدث خطأ'
        );
      } catch {}
    }
  }
);

/* =========================================================
   استقبال رد الهمسة من الخاص
========================================================= */

async function handleWhisperReply(
  ctx,
  text
) {
  if (!isPrivate(ctx)) {
    return false;
  }

  if (!db.whisperReplies) {
    db.whisperReplies = {};
  }

  const session =
    db.whisperReplies[
      String(ctx.from.id)
    ];

  if (!session) {
    return false;
  }

  const whisper =
    db.whispers[
      session.whisperId
    ];

  if (!whisper) {
    delete db.whisperReplies[
      String(ctx.from.id)
    ];

    saveData();

    await reply(
      ctx,
      '⚠️ الهمسة غير موجودة'
    );

    return true;
  }

  const responseText =
    text ||
    'رد على الهمسة';

  /*
  الرد يصل إلى القروب
  */
  try {
    await ctx.telegram.sendMessage(
      whisper.chatId,
      `💌 رد على الهمسة من ${ctx.from.first_name || 'المستخدم'}:\n\n${responseText}`
    );

    whisper.replied = true;

    delete db.whisperReplies[
      String(ctx.from.id)
    ];

    saveData();

    await reply(
      ctx,
      '• تم إرسال ردك إلى القروب'
    );

  } catch {
    await reply(
      ctx,
      '⚠️ تعذر إرسال الرد إلى القروب'
    );
  }

  return true;
}

/* =========================================================
   الموسيقى - البحث
========================================================= */

async function handleMusic(
  ctx,
  text
) {
  if (!isGroup(ctx)) return false;

  if (
    !text.startsWith('بحث ')
  ) {
    return false;
  }

  if (!ytSearch) {
    await reply(
      ctx,
      '⚠️ خدمة بحث الأغاني غير مثبتة.\n\nnpm install yt-search'
    );

    return true;
  }

  const query =
    text.slice(5).trim();

  if (!query) {
    await reply(
      ctx,
      '• اكتب اسم الأغنية بعد كلمة بحث'
    );

    return true;
  }

  try {
    const result =
      await ytSearch(query);

    const videos =
      result.videos.slice(0, 5);

    if (!videos.length) {
      await reply(
        ctx,
        '⚠️ لم أجد نتائج'
      );

      return true;
    }

    const buttons =
      videos.map((video, index) => [
        Markup.button.callback(
          `${index + 1} - ${video.title.slice(0, 35)}`,
          `song:${Buffer.from(video.url).toString('base64')}`
        )
      ]);

    await ctx.reply(
      `🎵 نتائج البحث عن:\n${query}`,
      Markup.inlineKeyboard(buttons)
    );

  } catch (err) {
    console.error(
      'Music search error:',
      err
    );

    await reply(
      ctx,
      '⚠️ حدث خطأ أثناء البحث'
    );
  }

  return true;
}

/* =========================================================
   زر الأغنية
========================================================= */

bot.action(
  /^song:(.+)$/,
  async ctx => {
    try {
      const url =
        Buffer.from(
          ctx.match[1],
          'base64'
        ).toString('utf8');

      await ctx.answerCbQuery();

      await ctx.reply(
        `🎵 رابط الأغنية:\n${url}`
      );

    } catch {
      try {
        await ctx.answerCbQuery(
          'تعذر فتح الأغنية'
        );
      } catch {}
    }
  }
);
/* =========================================================
   معالجة نص القروب
========================================================= */

async function handleGroupText(
  ctx,
  text
) {
  if (!isGroup(ctx)) {
    return false;
  }

  text = cleanText(text);

  if (!text) {
    return false;
  }

  /*
  =========================================================
  مهم جدًا:
  الأوامر الإدارية والتنظيف قبل الحماية
  =========================================================
  */

  if (
    await handleAutoCleaning(
      ctx,
      text
    )
  ) {
    return true;
  }

  if (
    await handleCleaning(
      ctx,
      text
    )
  ) {
    return true;
  }

  if (
    await handleCommandLockRank(
      ctx,
      text
    )
  ) {
    return true;
  }

  if (
    await handleCommandLock(
      ctx,
      text
    )
  ) {
    return true;
  }

  if (
    await handleProtectionCommand(
      ctx,
      text
    )
  ) {
    return true;
  }

  if (
    await handleProtectionSetting(
      ctx,
      text
    )
  ) {
    return true;
  }

  if (
    await handleWarningsCommand(
      ctx,
      text
    )
  ) {
    return true;
  }

  if (
    await handleClearRestricted(
      ctx,
      text
    )
  ) {
    return true;
  }

  if (
    await handleClearMuted(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
  =========================================================
  التسلية قبل الرتب
  =========================================================
  */

  if (
    await handleFunTitle(
      ctx,
      text
    )
  ) {
    return true;
  }

  if (
    await handleShowFunTitle(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
  =========================================================
  الرتبة
  =========================================================
  */

  if (
    await handleMyRank(
      ctx,
      text
    )
  ) {
    return true;
  }

  if (
    await handleRankCommand(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
  =========================================================
  العقوبات
  =========================================================
  */

  if (
    await handleWarnCommand(
      ctx,
      text
    )
  ) {
    return true;
  }

  if (
    await handleMuteCommand(
      ctx,
      text
    )
  ) {
    return true;
  }

  if (
    await handleRestrictCommand(
      ctx,
      text
    )
  ) {
    return true;
  }

  if (
    await handleBanCommand(
      ctx,
      text
    )
  ) {
    return true;
  }

  if (
    await handleKickCommand(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
  =========================================================
  الحذف
  =========================================================
  */

  if (
    await handleDelete(
      ctx,
      text
    )
  ) {
    return true;
  }

  /*
  =========================================================
  الألقاب
  =========================================================
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
  =========================================================
  الموسيقى
  =========================================================
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
  =========================================================
  الهمسة
  =========================================================
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
  =========================================================
  الردود المخصصة
  =========================================================
  */

  const group =
    getGroup(ctx.chat.id);

  /*
  التحقق من الأوامر المقفلة
  */
  const lockedLevel =
    group.commandLocks[text];

  if (
    typeof lockedLevel === 'number'
  ) {
    if (
      getRankLevel(ctx) <
      lockedLevel
    ) {
      await reply(
        ctx,
        `⚠️ هذا الأمر مقفول إلا لرتبة ${Object.values(RANKS).find(
          r => r.level === lockedLevel
        )?.name || 'محددة'}`
      );

      return true;
    }
  }

  /*
  الردود المخصصة
  */
  if (
    group.customReplies &&
    group.customReplies[text]
  ) {
    await reply(
      ctx,
      group.customReplies[text]
    );

    return true;
  }

  /*
  الأوامر المخصصة
  */
  if (
    group.customCommands &&
    group.customCommands[text]
  ) {
    await reply(
      ctx,
      group.customCommands[text]
    );

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
      if (!ctx.message) {
        return;
      }

      /*
      تسجيل الرسالة للتنظيف التلقائي
      قبل أي معالجة أخرى
      */
      if (isGroup(ctx)) {
        trackMessageForCleaning(ctx);
      }

      touchUser(ctx);

      /*
      رسائل الخاص
      */
      if (isPrivate(ctx)) {
        const text =
          ctx.message.text ||
          ctx.message.caption ||
          '';

        if (text) {
          if (
            await handleWhisperReply(
              ctx,
              text
            )
          ) {
            return;
          }
        }

        return;
      }

      /*
      القروبات
      */
      if (!isGroup(ctx)) {
        return;
      }

      /*
      النصوص
      */
      if (
        typeof ctx.message.text ===
        'string'
      ) {
        const handled =
          await handleGroupText(
            ctx,
            ctx.message.text
          );

        if (handled) {
          return;
        }
      }

      /*
      الحماية لجميع أنواع الرسائل
      */
      await checkProtection(ctx);

    } catch (err) {
      console.error(
        '❌ message handler:',
        err
      );
    }
  }
);

/* =========================================================
   الرسائل المعدلة
========================================================= */

bot.on(
  'edited_message',
  async ctx => {
    try {
      if (!isGroup(ctx)) {
        return;
      }

      /*
      نفحص الرسالة المعدلة بنفس الحماية
      */
      await checkProtection(ctx);

    } catch (err) {
      console.error(
        '❌ edited_message:',
        err
      );
    }
  }
);

/* =========================================================
   تسجيل المالك
========================================================= */

bot.on(
  'message',
  async ctx => {
    try {
      if (!ctx.from) {
        return;
      }

      if (
        ctx.from.username &&
        ctx.from.username.toLowerCase() ===
          OWNER_USERNAME.toLowerCase()
      ) {
        db.owner.username =
          OWNER_USERNAME;

        db.owner.id =
          ctx.from.id;

        saveData();
      }

    } catch {}
  }
);

/* =========================================================
   معالجة أخطاء البوت
========================================================= */

bot.catch(
  (err, ctx) => {
    console.error(
      '❌ BOT ERROR:',
      err
    );

    console.error(
      'Update:',
      ctx?.update?.update_id
    );
  }
);

/* =========================================================
   تشغيل البوت
========================================================= */

(async () => {
  try {
    console.log(
      '========================================'
    );

    console.log(
      '🤖 EILAF BOT'
    );

    console.log(
      '========================================'
    );

    console.log(
      '👑 Owner:',
      OWNER_USERNAME
    );

    console.log(
      '🧹 Auto cleaning: every 2 minutes'
    );

    console.log(
      '🛡️ Protection: enabled system'
    );

    console.log(
      '🎵 YouTube search:',
      ytSearch
        ? 'ON'
        : 'OFF'
    );

    await bot.launch();

    console.log(
      '✅ Bot started successfully'
    );

  } catch (err) {
    console.error(
      '❌ Failed to start bot:',
      err
    );

    process.exit(1);
  }
})();

/* =========================================================
   إيقاف آمن
========================================================= */

process.once(
  'SIGINT',
  () => {
    console.log(
      '🛑 Stopping bot...'
    );

    bot.stop('SIGINT');
  }
);

process.once(
  'SIGTERM',
  () => {
    console.log(
      '🛑 Stopping bot...'
    );

    bot.stop('SIGTERM');
  }
);
