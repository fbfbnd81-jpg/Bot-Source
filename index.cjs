'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');

/* =========================================================
   الإعدادات
========================================================= */

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_USERNAME = 'j4xa7';

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN غير موجود في Environment Variables');
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

const RANKS = {
  عضو: 0,
  مميز: 1,
  مالك: 2,
  'مالك أساسي': 3,
  Myth: 4,
  'Myth 🎖️': 5,
  'Dev²': 6,
  'Dev🎖️': 7
};

function rankName(rank) {
  if (rank >= 7) return 'Dev🎖️';
  if (rank >= 6) return 'Dev²';
  if (rank >= 5) return 'Myth 🎖️';
  if (rank >= 4) return 'Myth';
  if (rank >= 3) return 'مالك أساسي';
  if (rank >= 2) return 'مالك';
  if (rank >= 1) return 'مميز';
  return 'عضو';
}

/* =========================================================
   قاعدة البيانات
========================================================= */

const EMPTY_DATA = {
  users: {},
  groups: {},
  subscribers: [],
  settings: {
    replies: true,
    bank: true,
    communication: true,
    stats: true,
    messenger: true,
    formats: true,
    serviceBot: true
  }
};

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(EMPTY_DATA, null, 2),
        'utf8'
      );

      return JSON.parse(JSON.stringify(EMPTY_DATA));
    }

    const data = JSON.parse(
      fs.readFileSync(DATA_FILE, 'utf8')
    );

    data.users ||= {};
    data.groups ||= {};
    data.subscribers ||= [];
    data.settings ||= {};

    return data;
  } catch (error) {
    console.error('خطأ في قاعدة البيانات:', error.message);
    return JSON.parse(JSON.stringify(EMPTY_DATA));
  }
}

let db = loadData();

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(db, null, 2),
      'utf8'
    );
  } catch (error) {
    console.error('خطأ في حفظ البيانات:', error.message);
  }
}

/* =========================================================
   بيانات المستخدم
========================================================= */

function getUser(userId) {
  const id = String(userId);

  if (!db.users[id]) {
    db.users[id] = {
      id,
      username: '',
      firstName: '',
      rank: 0,
      title: '',
      money: 0,
      interaction: 0,
      messages: 0,
      answers: 0,
      wins: 0,
      warnings: 0,
      bank: null,
      createdAt: Date.now()
    };
  }

  return db.users[id];
}

function registerUser(user) {
  if (!user) return;

  const data = getUser(user.id);

  data.username = user.username || '';
  data.firstName = user.first_name || '';

  const id = String(user.id);

  if (!db.subscribers.includes(id)) {
    db.subscribers.push(id);
  }

  saveData();
}

function normalizedUsername(username) {
  return String(username || '')
    .replace(/^@/, '')
    .toLowerCase();
}

function isOwner(user) {
  return normalizedUsername(user?.username) ===
    OWNER_USERNAME.toLowerCase();
}

function getRank(user) {
  if (!user) return 0;

  if (isOwner(user)) {
    return 7;
  }

  return getUser(user.id).rank || 0;
}

function hasRank(user, required) {
  return getRank(user) >= required;
}

function mention(user) {
  if (!user) return 'المستخدم';

  if (user.username) {
    return `@${user.username}`;
  }

  return user.first_name || 'المستخدم';
}

function replyUser(ctx) {
  return ctx.message?.reply_to_message?.from || null;
}

/* =========================================================
   بيانات القروب
========================================================= */

function getGroup(chatId) {
  const id = String(chatId);

  if (!db.groups[id]) {
    db.groups[id] = {
      id,
      title: '',
      enabled: true,

      protection: {
        violations: true,
        links: false,
        edits: false,
        spam: false,
        ads: false,
        forwards: false,
        mentions: true,
        photos: false,
        videos: false,
        files: false,
        stickers: false,
        gifs: false,
        audio: false,
        commands: false,
        phoneNumbers: false,
        longMessages: false
      },

      forbiddenWords: [],

      muted: {},
      globalMuted: {},
      restricted: {},
      banned: {},
      warnings: {},

      cleaning: {
        enabled: false
      },

      games: {
        enabled: true,
        active: null
      },

      whispers: {},

      customCommands: {},
      customReplies: {},

      music: {
        queue: [],
        current: null,
        playing: false
      },

      channel: null,
      logChannel: null,
      subscriptionChannel: null
    };
  }

  return db.groups[id];
}

/* =========================================================
   الرد الآمن
========================================================= */

async function reply(ctx, text, extra = {}) {
  try {
    return await ctx.reply(text, extra);
  } catch (error) {
    console.log('تعذر إرسال الرسالة:', error.message);
    return null;
  }
}

/* =========================================================
   التحقق من صلاحيات البوت
========================================================= */

async function botAdmin(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(
      ctx.chat.id,
      ctx.botInfo?.id
    );

    return member.status === 'administrator' ||
      member.status === 'creator';
  } catch {
    return false;
  }
}

/* =========================================================
   الرتب
========================================================= */

function requestedRank(value) {
  const text = String(value || '').trim();

  if (text === 'مميز') return 1;

  if (text === 'مالك') return 2;

  if (
    text === 'مالك أساسي' ||
    text === 'مالك اساسي' ||
    text === 'اساس'
  ) {
    return 3;
  }

  if (
    text === 'Myth' ||
    text === 'myth' ||
    text === 'M'
  ) {
    return 4;
  }

  /*
     مهم:
     My = Myth 🎖️
  */

  if (
    text === 'My' ||
    text === 'my' ||
    text === 'Myth 🎖️' ||
    text === 'اكس'
  ) {
    return 5;
  }

  if (
    text === 'Dev²' ||
    text === 'مطور ثانوي' ||
    text === 'dev2'
  ) {
    return 6;
  }

  if (
    text === 'ديف' ||
    text === 'Dev' ||
    text === 'Dev🎖️'
  ) {
    return 7;
  }

  return null;
}

async function promote(ctx, wantedRank) {
  const actor = ctx.from;
  const target = replyUser(ctx);

  if (!target) {
    return reply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!hasRank(actor, 1)) {
    return reply(ctx, '• رتبتك لا تسمح لك');
  }

  if (isOwner(target)) {
    return reply(ctx, '• لا يمكن تعديل رتبة المالك');
  }

  if (getRank(target) >= getRank(actor)) {
    return reply(
      ctx,
      '• لا يمكنك تعديل رتبة شخص أعلى منك أو مساوية لك'
    );
  }

  if (wantedRank >= getRank(actor)) {
    return reply(
      ctx,
      '• لا يمكنك إعطاء رتبة مساوية أو أعلى من رتبتك'
    );
  }

  getUser(target.id).rank = wantedRank;

  saveData();

  return reply(
    ctx,
    `• تم رفع رتبة ${mention(target)} إلى : ${rankName(wantedRank)}`
  );
}

async function demote(ctx) {
  const actor = ctx.from;
  const target = replyUser(ctx);

  if (!target) {
    return reply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!hasRank(actor, 1)) {
    return reply(ctx, '• رتبتك لا تسمح لك');
  }

  if (isOwner(target)) {
    return reply(ctx, '• لا يمكن تنزيل المالك');
  }

  if (getRank(target) >= getRank(actor)) {
    return reply(
      ctx,
      '• لا يمكنك تنزيل شخص أعلى منك أو مساوي لك'
    );
  }

  getUser(target.id).rank = 0;

  saveData();

  return reply(
    ctx,
    `• تم تنزيل ${mention(target)} إلى : عضو`
  );
}

/* =========================================================
   الكتم
========================================================= */

const OPEN_PERMISSIONS = {
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

const MUTED_PERMISSIONS = {
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

async function mute(ctx, globalMute = false) {
  const target = replyUser(ctx);

  if (!target) {
    return reply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!hasRank(ctx.from, 2)) {
    return reply(ctx, '• رتبتك لا تسمح لك');
  }

  if (
    isOwner(target) ||
    getRank(target) >= getRank(ctx.from)
  ) {
    return reply(ctx, '• لا يمكنك معاقبة هذا المستخدم');
  }

  const group = getGroup(ctx.chat.id);

  const list = globalMute
    ? group.globalMuted
    : group.muted;

  list[String(target.id)] = {
    id: target.id,
    username: target.username || '',
    name: target.first_name || '',
    time: Date.now()
  };

  try {
    await ctx.telegram.restrictChatMember(
      ctx.chat.id,
      target.id,
      {
        permissions: MUTED_PERMISSIONS
      }
    );
  } catch {}

  saveData();

  return reply(
    ctx,
    globalMute
      ? `• تم كتم ${mention(target)} عام`
      : `• تم كتم ${mention(target)}`
  );
}

async function unmute(ctx) {
  const target = replyUser(ctx);

  if (!target) {
    return reply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!hasRank(ctx.from, 2)) {
    return reply(ctx, '• رتبتك لا تسمح لك');
  }

  const group = getGroup(ctx.chat.id);

  delete group.muted[String(target.id)];
  delete group.globalMuted[String(target.id)];

  try {
    await ctx.telegram.restrictChatMember(
      ctx.chat.id,
      target.id,
      {
        permissions: OPEN_PERMISSIONS
      }
    );
  } catch {}

  saveData();

  return reply(
    ctx,
    `• تم فك كتم ${mention(target)}`
  );
}

/* =========================================================
   مسح المكتومين
========================================================= */

async function clearMuted(ctx, globalMute = false) {
  if (!hasRank(ctx.from, 5)) {
    return reply(
      ctx,
      '• الأمر متاح من رتبة Myth 🎖️ فأعلى'
    );
  }

  const group = getGroup(ctx.chat.id);

  const list = globalMute
    ? group.globalMuted
    : group.muted;

  const ids = Object.keys(list);

  if (ids.length === 0) {
    return reply(
      ctx,
      globalMute
        ? '• لا يوجد مكتومين'
        : '• لا يوجد مكتومين'
    );
  }

  for (const id of ids) {
    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        Number(id),
        {
          permissions: OPEN_PERMISSIONS
        }
      );
    } catch {}
  }

  if (globalMute) {
    group.globalMuted = {};
  } else {
    group.muted = {};
  }

  saveData();

  return reply(
    ctx,
    globalMute
      ? `• تم مسح ( ${ids.length} ) من المكتومين عام`
      : `• تم مسح ( ${ids.length} ) من المكتومين`
  );
}

/* =========================================================
   التقييد
========================================================= */

async function restrict(ctx) {
  const target = replyUser(ctx);

  if (!target) {
    return reply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!hasRank(ctx.from, 2)) {
    return reply(ctx, '• رتبتك لا تسمح لك');
  }

  if (
    isOwner(target) ||
    getRank(target) >= getRank(ctx.from)
  ) {
    return reply(ctx, '• لا يمكنك تقييد هذا المستخدم');
  }

  const group = getGroup(ctx.chat.id);

  group.restricted[String(target.id)] = {
    id: target.id,
    time: Date.now()
  };

  try {
    await ctx.telegram.restrictChatMember(
      ctx.chat.id,
      target.id,
      {
        permissions: {
          can_send_messages: true,
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
  } catch {}

  saveData();

  return reply(
    ctx,
    `• تم تقييد ${mention(target)}`
  );
}

async function unrestrict(ctx) {
  const target = replyUser(ctx);

  if (!target) {
    return reply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!hasRank(ctx.from, 2)) {
    return reply(ctx, '• رتبتك لا تسمح لك');
  }

  const group = getGroup(ctx.chat.id);

  delete group.restricted[String(target.id)];

  try {
    await ctx.telegram.restrictChatMember(
      ctx.chat.id,
      target.id,
      {
        permissions: OPEN_PERMISSIONS
      }
    );
  } catch {}

  saveData();

  return reply(
    ctx,
    `• تم إلغاء تقييد ${mention(target)}`
  );
}

async function restrictedList(ctx) {
  if (!hasRank(ctx.from, 6)) {
    return reply(
      ctx,
      '• الأمر متاح من رتبة Dev² فأعلى'
    );
  }

  const group = getGroup(ctx.chat.id);
  const ids = Object.keys(group.restricted);

  if (!ids.length) {
    return reply(ctx, '• لا يوجد مقيدين');
  }

  return reply(
    ctx,
    '• المقيدين :\n\n' +
      ids.map((id, i) => `${i + 1}- ${id}`).join('\n')
  );
}

/* =========================================================
   الحظر والطرد
========================================================= */

async function ban(ctx) {
  const target = replyUser(ctx);

  if (!target) {
    return reply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!hasRank(ctx.from, 3)) {
    return reply(ctx, '• رتبتك لا تسمح لك');
  }

  if (
    isOwner(target) ||
    getRank(target) >= getRank(ctx.from)
  ) {
    return reply(ctx, '• لا يمكنك حظر هذا المستخدم');
  }

  try {
    await ctx.telegram.banChatMember(
      ctx.chat.id,
      target.id
    );
  } catch {
    return reply(ctx, '• تعذر تنفيذ الحظر');
  }

  getGroup(ctx.chat.id).banned[String(target.id)] = {
    time: Date.now()
  };

  saveData();

  return reply(
    ctx,
    `• تم حظر ${mention(target)}`
  );
}

async function unban(ctx) {
  const target = replyUser(ctx);

  if (!target) {
    return reply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!hasRank(ctx.from, 3)) {
    return reply(ctx, '• رتبتك لا تسمح لك');
  }

  try {
    await ctx.telegram.unbanChatMember(
      ctx.chat.id,
      target.id
    );
  } catch {}

  delete getGroup(ctx.chat.id).banned[String(target.id)];

  saveData();

  return reply(
    ctx,
    `• تم فك حظر ${mention(target)}`
  );
}

async function kick(ctx) {
  const target = replyUser(ctx);

  if (!target) {
    return reply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!hasRank(ctx.from, 3)) {
    return reply(ctx, '• رتبتك لا تسمح لك');
  }

  if (
    isOwner(target) ||
    getRank(target) >= getRank(ctx.from)
  ) {
    return reply(ctx, '• لا يمكنك طرد هذا المستخدم');
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
    return reply(ctx, '• تعذر تنفيذ الطرد');
  }

  return reply(
    ctx,
    `• تم طرد ${mention(target)}`
  );
}

/* =========================================================
   التحذيرات
========================================================= */

async function warn(ctx) {
  const target = replyUser(ctx);

  if (!target) {
    return reply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!hasRank(ctx.from, 2)) {
    return reply(ctx, '• رتبتك لا تسمح لك');
  }

  if (
    isOwner(target) ||
    getRank(target) >= getRank(ctx.from)
  ) {
    return reply(ctx, '• لا يمكنك تحذير هذا المستخدم');
  }

  const group = getGroup(ctx.chat.id);
  const id = String(target.id);

  group.warnings[id] =
    (group.warnings[id] || 0) + 1;

  const count = group.warnings[id];

  getUser(target.id).warnings = count;

  if (count >= 3) {
    group.muted[id] = {
      id: target.id,
      time: Date.now(),
      reason: '3 تحذيرات'
    };

    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        target.id,
        {
          permissions: MUTED_PERMISSIONS
        }
      );
    } catch {}

    saveData();

    return reply(
      ctx,
      `• تم تحذير ${mention(target)}\n• التحذيرات: 3/3\n• تم كتمه تلقائياً`
    );
  }

  saveData();

  return reply(
    ctx,
    `• تم تحذير ${mention(target)}\n• التحذيرات: ${count}/3`
  );
}

async function removeWarn(ctx) {
  const target = replyUser(ctx);

  if (!target) {
    return reply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!hasRank(ctx.from, 2)) {
    return reply(ctx, '• رتبتك لا تسمح لك');
  }

  const group = getGroup(ctx.chat.id);

  delete group.warnings[String(target.id)];

  getUser(target.id).warnings = 0;

  saveData();

  return reply(
    ctx,
    `• تم إلغاء تحذيرات ${mention(target)}`
  );
}

/* =========================================================
   التفاعل
========================================================= */

async function interaction(ctx, target = null) {
  const user = target || ctx.from;

  if (!user) {
    return reply(ctx, '• المستخدم غير موجود');
  }

  const data = getUser(user.id);

  return reply(
    ctx,
    `• التفاعل : ${data.interaction}\n` +
    `• الرسائل : ${data.messages}\n` +
    `• الإجابات : ${data.answers}\n` +
    `• الفوز : ${data.wins}`
  );
}

async function topInteractions(ctx) {
  const list = Object.values(db.users)
    .filter(user => user.interaction > 0)
    .sort((a, b) => b.interaction - a.interaction)
    .slice(0, 20);

  if (!list.length) {
    return reply(ctx, '• لا يوجد متفاعلين');
  }

  let text = '• المتفاعلين :\n\n';

  list.forEach((user, index) => {
    text +=
      `${index + 1}- ` +
      `${user.firstName || user.username || user.id}` +
      ` : ${user.interaction}\n`;
  });

  return reply(ctx, text);
}

/* =========================================================
   الرتبة
========================================================= */

async function myRank(ctx) {
  return reply(
    ctx,
    `• رتبتك : ${rankName(getRank(ctx.from))}`
  );
}

async function repliedRank(ctx) {
  const target = replyUser(ctx);

  if (!target) {
    return reply(ctx, '• يجب الرد على المستخدم');
  }

  return reply(
    ctx,
    `• رتبة ${mention(target)} : ${rankName(getRank(target))}`
  );
}

/* =========================================================
   الحماية
========================================================= */

async function protectionToggle(
  ctx,
  property,
  value
) {
  if (!hasRank(ctx.from, 6)) {
    return reply(
      ctx,
      '• الأمر متاح من رتبة Dev² فأعلى'
    );
  }

  const group = getGroup(ctx.chat.id);

  if (property === 'mentions') {
    group.protection.mentions = value;
  } else {
    group.protection[property] = value;
  }

  saveData();

  return reply(
    ctx,
    '• تم تحديث إعداد الحماية'
  );
}

async function protectionStatus(ctx) {
  const group = getGroup(ctx.chat.id);
  const p = group.protection;

  return reply(
    ctx,
    '• حالة الحماية\n\n' +
    `• المخالفات : ${p.violations ? 'مفتوحة' : 'مقفلة'}\n` +
    `• الروابط : ${p.links ? 'مقفلة' : 'مفتوحة'}\n` +
    `• المنشن : ${p.mentions ? 'مفتوح' : 'مقفل'}\n` +
    `• التعديل : ${p.edits ? 'مفعل' : 'مقفل'}\n` +
    `• التكرار : ${p.spam ? 'مفعل' : 'مقفل'}\n` +
    `• الإعلانات : ${p.ads ? 'مفعلة' : 'مقفلة'}\n` +
    `• التحويلات : ${p.forwards ? 'مقفلة' : 'مفتوحة'}`
  );
}

/* =========================================================
   الكلمات الممنوعة
========================================================= */

async function addForbidden(ctx, word) {
  if (!hasRank(ctx.from, 6)) {
    return reply(ctx, '• رتبتك لا تسمح لك');
  }

  if (!word) {
    return reply(ctx, '• اكتب الكلمة بعد الأمر');
  }

  const group = getGroup(ctx.chat.id);
  const value = word.toLowerCase();

  if (!group.forbiddenWords.includes(value)) {
    group.forbiddenWords.push(value);
  }

  saveData();

  return reply(
    ctx,
    `• تم منع الكلمة : ${word}`
  );
}

async function removeForbidden(ctx, word) {
  if (!hasRank(ctx.from, 6)) {
    return reply(ctx, '• رتبتك لا تسمح لك');
  }

  const group = getGroup(ctx.chat.id);
  const value = word.toLowerCase();

  group.forbiddenWords =
    group.forbiddenWords.filter(
      item => item !== value
    );

  saveData();

  return reply(
    ctx,
    `• تم إلغاء منع الكلمة : ${word}`
  );
}

async function forbiddenList(ctx) {
  const group = getGroup(ctx.chat.id);

  if (!group.forbiddenWords.length) {
    return reply(ctx, '• لا توجد كلمات ممنوعة');
  }

  return reply(
    ctx,
    '• الكلمات الممنوعة :\n\n' +
      group.forbiddenWords
        .map((word, index) =>
          `${index + 1}- ${word}`
        )
        .join('\n')
  );
}

/* =========================================================
   الألقاب
========================================================= */

async function setTitle(ctx, title) {
  const target = replyUser(ctx);

  if (!target) {
    return reply(ctx, '• يجب الرد على المستخدم');
  }

  if (!hasRank(ctx.from, 2)) {
    return reply(ctx, '• رتبتك لا تسمح لك');
  }

  if (!title) {
    return reply(ctx, '• اكتب اللقب');
  }

  getUser(target.id).title = title;

  saveData();

  return reply(
    ctx,
    `• تم وضع اللقب ${title} لـ ${mention(target)}`
  );
}

async function showTitle(ctx) {
  const target =
    replyUser(ctx) || ctx.from;

  const title =
    getUser(target.id).title || 'لا يوجد';

  return reply(
    ctx,
    `• اللقب : ${title}`
  );
}

/* =========================================================
   الاقتصاد
========================================================= */

async function money(ctx, target = null) {
  const user = target || ctx.from;
  const data = getUser(user.id);

  return reply(
    ctx,
    `• الرصيد : ${data.money} ريال`
  );
}

async function createBank(ctx) {
  if (!db.settings.bank) {
    return reply(ctx, '• البنك مقفل حالياً');
  }

  const data = getUser(ctx.from.id);

  if (data.bank) {
    return reply(ctx, '• لديك حساب بنكي بالفعل');
  }

  data.bank = {
    createdAt: Date.now(),
    balance: data.money
  };

  saveData();

  return reply(
    ctx,
    '• تم إنشاء حسابك البنكي'
  );
}

async function giftMoney(ctx, amountText) {
  const target = replyUser(ctx);

  if (!target) {
    return reply(ctx, '• يجب الرد على المستخدم');
  }

  const amount = Number(amountText);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return reply(ctx, '• المبلغ غير صحيح');
  }

  const sender = getUser(ctx.from.id);
  const receiver = getUser(target.id);

  if (sender.money < amount) {
    return reply(ctx, '• رصيدك لا يكفي');
  }

  sender.money -= amount;
  receiver.money += amount;

  saveData();

  return reply(
    ctx,
    `• تم إهداء ${amount} ريال إلى ${mention(target)}`
  );
}

/* =========================================================
   الألعاب
========================================================= */

const QUESTIONS = [
  {
    question: 'كم عدد أيام الأسبوع؟',
    answers: ['7', '٧', 'سبعة']
  },
  {
    question: 'ما عاصمة المملكة العربية السعودية؟',
    answers: ['الرياض']
  },
  {
    question: 'كم يساوي 5 + 5؟',
    answers: ['10', '١٠']
  },
  {
    question: 'كم عدد أشهر السنة؟',
    answers: ['12', '١٢', 'اثنا عشر', 'اثنا عشر شهرا']
  },
  {
    question: 'ما لون العشب غالباً؟',
    answers: ['أخضر', 'اخضر']
  }
];

async function startGame(ctx) {
  if (!hasRank(ctx.from, 7)) {
    return reply(
      ctx,
      '• بدء اللعبة متاح للـ Dev🎖️'
    );
  }

  const group = getGroup(ctx.chat.id);

  if (!group.games.enabled) {
    return reply(ctx, '• الألعاب مقفلة');
  }

  if (group.games.active) {
    return reply(ctx, '• توجد لعبة قائمة بالفعل');
  }

  const question =
    QUESTIONS[
      Math.floor(
        Math.random() * QUESTIONS.length
      )
    ];

  group.games.active = {
    owner: ctx.from.id,
    question,
    startedAt: Date.now()
  };

  saveData();

  return reply(
    ctx,
    `🎮 بدأت اللعبة\n\n` +
    `❓ ${question.question}\n\n` +
    `• أول إجابة صحيحة تفوز\n` +
    `• المكافأة : +10 ريال`
  );
}

async function endGame(ctx) {
  const group = getGroup(ctx.chat.id);

  if (!group.games.active) {
    return reply(ctx, '• لا توجد لعبة');
  }

  if (
    group.games.active.owner !== ctx.from.id &&
    !hasRank(ctx.from, 7)
  ) {
    return reply(
      ctx,
      '• صاحب اللعبة فقط يستطيع إنهاءها'
    );
  }

  group.games.active = null;

  saveData();

  return reply(ctx, '• تم إنهاء اللعبة');
}

/* =========================================================
   تنظيف
========================================================= */

async function clean(ctx, type = 9) {
  if (!hasRank(ctx.from, 5)) {
    return reply(
      ctx,
      '• التنظيف متاح من رتبة Myth 🎖️ فأعلى'
    );
  }

  if (
    !Number.isInteger(type) ||
    type < 0 ||
    type > 9
  ) {
    return reply(
      ctx,
      '• نوع التنظيف من 0 إلى 9'
    );
  }

  const names = {
    0: 'النصوص',
    1: 'الصور',
    2: 'الفيديو',
    3: 'الملفات',
    4: 'الملصقات',
    5: 'GIF',
    6: 'الصوت',
    7: 'الرسائل الصوتية',
    8: 'الروابط',
    9: 'الكل'
  };

  return reply(
    ctx,
    `• تم بدء تنظيف : ${names[type]}`
  );
}

/* =========================================================
   الهمسات
========================================================= */

function whisperId() {
  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2, 9)
  );
}

async function createWhisper(ctx) {
  const target = replyUser(ctx);

  if (!target) {
    return reply(
      ctx,
      '• الهمسة تبدأ بالرد على المستخدم فقط'
    );
  }

  const id = whisperId();
  const group = getGroup(ctx.chat.id);

  group.whispers[id] = {
    id,
    sender: ctx.from.id,
    receiver: target.id,
    chatId: ctx.chat.id,
    sourceMessageId: ctx.message.message_id,
    createdAt: Date.now()
  };

  saveData();

  let me;

  try {
    me = await ctx.telegram.getMe();
  } catch {
    return reply(
      ctx,
      '• تعذر إنشاء رابط الهمسة'
    );
  }

  const viewUrl =
    `https://t.me/${me.username}?start=whisper_${id}`;

  const replyUrl =
    `https://t.me/${me.username}?start=whisperreply_${id}`;

  return reply(
    ctx,
    `• همسة إلى ${mention(target)} 🔐`,
    Markup.inlineKeyboard([
      [
        Markup.button.url(
          'رؤية الهمسة 👁',
          viewUrl
        ),
        Markup.button.url(
          'رد على الهمسة 💬',
          replyUrl
        )
      ]
    ])
  );
}

/* =========================================================
   المالك
========================================================= */

async function ownerInfo(ctx) {
  let photos;

  try {
    photos =
      await ctx.telegram.getUserProfilePhotos(
        ctx.from.id,
        0,
        1
      );
  } catch {
    photos = null;
  }

  if (
    photos &&
    photos.total_count > 0
  ) {
    return ctx.replyWithPhoto(
      photos.photos[0][0].file_id,
      {
        caption:
          '• المالك\n\n' +
          '• اليوزر : @j4xa7\n' +
          '• الرتبة : Dev🎖️'
      }
    );
  }

  return reply(
    ctx,
    '• المالك\n\n' +
    '• اليوزر : @j4xa7\n' +
    '• الرتبة : Dev🎖️'
  );
}

/* =========================================================
   أوامر المطور
========================================================= */

async function developerPanel(ctx) {
  if (!hasRank(ctx.from, 7)) {
    return reply(
      ctx,
      '• هذا القسم للـ Dev🎖️ فقط'
    );
  }

  return reply(
    ctx,
    [
      '╭──〔 لوحة المطور 〕──╮',
      '',
      'ا — الرئيسية',
      'ت — الإعدادات',
      'ق — القروبات',
      'م — المشرفين',
      'ن — الإحصائيات',
      'ح — الحماية',
      'د — المطور',
      '',
      'حالة البوت',
      'إذاعة',
      'تفعيل الردود',
      'تعطيل الردود',
      'تفعيل البنك',
      'تعطيل البنك',
      'تفعيل التواصل',
      'تعطيل التواصل',
      'تفعيل الإحصائيات',
      'تعطيل الإحصائيات',
      '',
      '╰────────────────╯'
    ].join('\n')
  );
}

/* =========================================================
   قائمة الأوامر
========================================================= */

async function commands(ctx) {
  if (!hasRank(ctx.from, 7)) {
    return reply(
      ctx,
      '• قائمة الأوامر للـ Dev🎖️ فقط'
    );
  }

  return reply(
    ctx,
    [
      '╭────〔 أوامر البوت 〕────╮',
      '',
      '• الرتب',
      'رتبتي',
      'رتبته',
      'رفع مميز',
      'رفع مالك',
      'رفع مالك أساسي',
      'رفع Myth',
      'رفع My',
      'رفع Dev²',
      'رفع ديف',
      'تنزيل',
      '',
      '• العقوبات',
      'كتم',
      'كتم عام',
      'فك الكتم',
      'فك الكتم العام',
      'مم',
      'خخ',
      'تقييد',
      'تق',
      'الغاء التقييد',
      'رفع القيود',
      'مق',
      'حظر',
      'فك الحظر',
      'طرد',
      '',
      '• التحذيرات',
      'تحذير',
      'انذار',
      'إلغاء التحذير',
      'الغاء التحذير',
      '',
      '• الحماية',
      'فتح المخالفات',
      'غلق المخالفات',
      'قفل المخالفات',
      'فتح الروابط',
      'قفل الروابط',
      'فتح المنشن',
      'غلق المنشن',
      'حالة الحماية',
      '',
      '• التنظيف',
      'تنظيف',
      'تنظيف 0',
      'تنظيف 1',
      'تنظيف 2',
      'تنظيف 3',
      'تنظيف 4',
      'تنظيف 5',
      'تنظيف 6',
      'تنظيف 7',
      'تنظيف 8',
      'تنظيف 9',
      'تفعيل التنظيف التلقائي',
      'تعطيل التنظيف التلقائي',
      '',
      '• التفاعل',
      'تفاعلي',
      'تفاعله',
      'المتفاعلين',
      '',
      '• الألقاب',
      'ضع <اللقب>',
      'لقبي',
      'لقبه',
      '',
      '• الاقتصاد',
      'فلوسي',
      'فلوسه',
      'انشاء حساب بنكي',
      'حسابي',
      'اهداء 100',
      'حذف حسابي',
      '',
      '• الألعاب',
      'ابدأ لعبة',
      'انهاء اللعبة',
      'قفل الالعاب',
      'فتح الالعاب',
      '',
      '• الهمسات',
      'اهمس',
      'همسه',
      'همسة',
      'ه',
      '',
      '• الكلمات الممنوعة',
      'منع الكلمه <الكلمة>',
      'الغاء منع الكلمه <الكلمة>',
      'الكلمات الممنوعه',
      'مسح الكلمات الممنوعه',
      '',
      '• المطور',
      'المالك',
      'اوامر',
      'حالة البوت',
      'إذاعة',
      'ا',
      'ت',
      'ق',
      'م',
      'ن',
      'ح',
      'د',
      '',
      '╰────────────────────╯'
    ].join('\n')
  );
}

/* =========================================================
   START
========================================================= */

bot.start(async ctx => {
  registerUser(ctx.from);

  const payload =
    ctx.startPayload || '';

  if (payload.startsWith('whisper_')) {
    const id =
      payload.slice('whisper_'.length);

    let found = null;

    for (const group of Object.values(db.groups)) {
      if (group.whispers?.[id]) {
        found = group.whispers[id];
        break;
      }
    }

    if (!found) {
      return reply(
        ctx,
        '• الهمسة غير موجودة أو انتهت'
      );
    }

    if (
      String(ctx.from.id) !==
      String(found.receiver)
    ) {
      return reply(
        ctx,
        '• هذه الهمسة ليست لك'
      );
    }

    return reply(
      ctx,
      '• تم فتح الهمسة الخاصة بك 🔐\n' +
      '• محتوى الهمسة لا يظهر في القروب.'
    );
  }

  if (
    payload.startsWith(
      'whisperreply_'
    )
  ) {
    const id =
      payload.slice(
        'whisperreply_'.length
      );

    return reply(
      ctx,
      `• تم فتح الرد على الهمسة 💬\n• رقم الهمسة: ${id}\n• أرسل ردك هنا.`
    );
  }

  return reply(
    ctx,
    'أهلاً بك 🤍\n\n' +
    '• البوت يعمل بنجاح\n' +
    '• اكتب «اوامر» لعرض الأوامر.'
  );
});

/* =========================================================
   معالجة الرسائل
========================================================= */

bot.on('message', async ctx => {
  try {
    if (!ctx.from) return;

    registerUser(ctx.from);

    const user = getUser(ctx.from.id);

    user.messages += 1;
    user.interaction += 1;

    const isPrivate =
      ctx.chat.type === 'private';

    const group =
      isPrivate
        ? null
        : getGroup(ctx.chat.id);

    if (group) {
      group.title =
        ctx.chat.title || '';
    }

    saveData();

    /* ==========================================
       إجابات اللعبة
    ========================================== */

    if (
      group &&
      group.games.active &&
      typeof ctx.message.text === 'string'
    ) {
      const answer =
        ctx.message.text
          .trim()
          .toLowerCase();

      const question =
        group.games.active.question;

      const correct =
        question.answers.some(
          item =>
            item.toLowerCase() ===
            answer
        );

      if (correct) {
        const winner =
          getUser(ctx.from.id);

        winner.money += 10;
        winner.wins += 1;
        winner.answers += 1;

        const elapsed =
          Date.now() -
          group.games.active.startedAt;

        group.games.active = null;

        saveData();

        return reply(
          ctx,
          `🏆 الفائز : ${mention(ctx.from)}\n` +
          `• المكافأة : +10 ريال\n` +
          `• الوقت : ${Math.floor(elapsed / 1000)} ثانية`
        );
      }
    }

    /* ==========================================
       الرسائل غير النصية
    ========================================== */

    if (!ctx.message.text) {
      return;
    }

    const raw =
      ctx.message.text.trim();

    const text =
      raw.toLowerCase();

    /* ==========================================
       الأوامر العامة
    ========================================== */

    if (text === 'اوامر') {
      return commands(ctx);
    }

    if (text === 'المالك') {
      return ownerInfo(ctx);
    }

    if (text === 'رتبتي') {
      return myRank(ctx);
    }

    if (text === 'رتبته') {
      return repliedRank(ctx);
    }

    if (text === 'تفاعلي') {
      return interaction(ctx);
    }

    if (text === 'تفاعله') {
      const target =
        replyUser(ctx);

      if (!target) {
        return reply(
          ctx,
          '• يجب الرد على المستخدم'
        );
      }

      return interaction(
        ctx,
        target
      );
    }

    if (text === 'المتفاعلين') {
      return topInteractions(ctx);
    }

    /* ==========================================
       الرتب
    ========================================== */

    if (text.startsWith('رفع ')) {
      const value =
        raw.slice(4).trim();

      const rank =
        requestedRank(value);

      if (rank === null) {
        return reply(
          ctx,
          '• الرتبة غير معروفة'
        );
      }

      return promote(
        ctx,
        rank
      );
    }

    if (text === 'تنزيل') {
      return demote(ctx);
    }

    /* ==========================================
       العقوبات
    ========================================== */

    if (text === 'كتم') {
      return mute(ctx, false);
    }

    if (
      text === 'كتم عام' ||
      text === 'عام'
    ) {
      return mute(ctx, true);
    }

    if (
      text === 'فك الكتم' ||
      text === 'فك كتم'
    ) {
      return unmute(ctx);
    }

    if (
      text === 'فك الكتم العام'
    ) {
      return unmute(ctx);
    }

    if (text === 'مم') {
      return clearMuted(
        ctx,
        false
      );
    }

    if (text === 'خخ') {
      return clearMuted(
        ctx,
        true
      );
    }

    if (
      text === 'تقييد' ||
      text === 'تق'
    ) {
      return restrict(ctx);
    }

    if (
      text === 'الغاء التقييد' ||
      text === 'إلغاء التقييد' ||
      text === 'رفع القيود'
    ) {
      return unrestrict(ctx);
    }

    if (text === 'مق') {
      return restrictedList(ctx);
    }

    if (text === 'حظر') {
      return ban(ctx);
    }

    if (
      text === 'فك الحظر' ||
      text === 'الغاء الحظر'
    ) {
      return unban(ctx);
    }

    if (text === 'طرد') {
      return kick(ctx);
    }

    /* ==========================================
       التحذيرات
    ========================================== */

    if (
      text === 'تحذير' ||
      text === 'انذار' ||
      text === 'إنذار'
    ) {
      return warn(ctx);
    }

    if (
      text === 'إلغاء التحذير' ||
      text === 'الغاء التحذير'
    ) {
      return removeWarn(ctx);
    }

    /* ==========================================
       الحماية
    ========================================== */

    if (text === 'فتح المخالفات') {
      return protectionToggle(
        ctx,
        'violations',
        true
      );
    }

    if (
      text === 'غلق المخالفات' ||
      text === 'قفل المخالفات'
    ) {
      return protectionToggle(
        ctx,
        'violations',
        false
      );
    }

    if (text === 'فتح الروابط') {
      return protectionToggle(
        ctx,
        'links',
        false
      );
    }

    if (text === 'قفل الروابط') {
      return protectionToggle(
        ctx,
        'links',
        true
      );
    }

    if (text === 'فتح المنشن') {
      return protectionToggle(
        ctx,
        'mentions',
        true
      );
    }

    if (text === 'غلق المنشن') {
      return protectionToggle(
        ctx,
        'mentions',
        false
      );
    }

    if (
      text === 'حالة الحماية' ||
      text === 'الحماية' ||
      text === 'حمايه'
    ) {
      return protectionStatus(ctx);
    }

    /* ==========================================
       الكلمات الممنوعة
    ========================================== */

    if (
      text.startsWith(
        'منع الكلمه '
      )
    ) {
      return addForbidden(
        ctx,
        raw.slice(
          'منع الكلمه '.length
        ).trim()
      );
    }

    if (
      text.startsWith(
        'منع الكلمة '
      )
    ) {
      return addForbidden(
        ctx,
        raw.slice(
          'منع الكلمة '.length
        ).trim()
      );
    }

    if (
      text.startsWith(
        'الغاء منع الكلمه '
      )
    ) {
      return removeForbidden(
        ctx,
        raw.slice(
          'الغاء منع الكلمه '.length
        ).trim()
      );
    }

    if (
      text.startsWith(
        'الغاء منع الكلمة '
      )
    ) {
      return removeForbidden(
        ctx,
        raw.slice(
          'الغاء منع الكلمة '.length
        ).trim()
      );
    }

    if (
      text === 'الكلمات الممنوعه' ||
      text === 'الكلمات الممنوعة'
    ) {
      return forbiddenList(ctx);
    }

    if (
      text ===
        'مسح الكلمات الممنوعه' ||
      text ===
        'مسح الكلمات الممنوعة'
    ) {
      if (!hasRank(ctx.from, 6)) {
        return reply(
          ctx,
          '• رتبتك لا تسمح لك'
        );
      }

      group.forbiddenWords = [];

      saveData();

      return reply(
        ctx,
        '• تم مسح الكلمات الممنوعة'
      );
    }

    /* ==========================================
       الألقاب
    ========================================== */

    if (
      text.startsWith('ضع ')
    ) {
      return setTitle(
        ctx,
        raw.slice(3).trim()
      );
    }

    if (text === 'لقبي') {
      return showTitle(ctx);
    }

    if (text === 'لقبه') {
      return showTitle(ctx);
    }

    /* ==========================================
       الاقتصاد
    ========================================== */

    if (text === 'فلوسي') {
      return money(ctx);
    }

    if (text === 'فلوسه') {
      const target =
        replyUser(ctx);

      if (!target) {
        return reply(
          ctx,
          '• يجب الرد على المستخدم'
        );
      }

      return money(
        ctx,
        target
      );
    }

    if (
      text ===
        'انشاء حساب بنكي' ||
      text ===
        'إنشاء حساب بنكي'
    ) {
      return createBank(ctx);
    }

    if (text === 'حسابي') {
      return money(ctx);
    }

    if (
      text.startsWith('اهداء ')
    ) {
      return giftMoney(
        ctx,
        raw.slice(6).trim()
      );
    }

    if (text === 'حذف حسابي') {
      const data =
        getUser(ctx.from.id);

      data.bank = null;
      data.money = 0;

      saveData();

      return reply(
        ctx,
        '• تم حذف حسابك البنكي'
      );
    }

    /* ==========================================
       الألعاب
    ========================================== */

    if (
      text === 'ابدأ لعبة' ||
      text === 'ابدأ فعالية'
    ) {
      return startGame(ctx);
    }

    if (
      text === 'انهاء اللعبة' ||
      text === 'إنهاء اللعبة'
    ) {
      return endGame(ctx);
    }

    if (
      text === 'قفل الالعاب' ||
      text === 'قفل الألعاب'
    ) {
      if (!hasRank(ctx.from, 6)) {
        return reply(
          ctx,
          '• رتبتك لا تسمح لك'
        );
      }

      group.games.enabled = false;
      group.games.active = null;

      saveData();

      return reply(
        ctx,
        '• تم قفل الألعاب'
      );
    }

    if (
      text === 'فتح الالعاب' ||
      text === 'فتح الألعاب'
    ) {
      if (!hasRank(ctx.from, 6)) {
        return reply(
          ctx,
          '• رتبتك لا تسمح لك'
        );
      }

      group.games.enabled = true;

      saveData();

      return reply(
        ctx,
        '• تم فتح الألعاب'
      );
    }

    /* ==========================================
       الهمسات
    ========================================== */

    if (
      text === 'اهمس' ||
      text === 'همسه' ||
      text === 'همسة' ||
      text === 'ه'
    ) {
      return createWhisper(ctx);
    }

    /* ==========================================
       التنظيف
    ========================================== */

    if (text === 'تنظيف') {
      return clean(ctx, 9);
    }

    if (
      text.startsWith('تنظيف ')
    ) {
      const number =
        Number(
          raw.slice(7).trim()
        );

      return clean(
        ctx,
        number
      );
    }

    if (
      text ===
        'تفعيل التنظيف التلقائي'
    ) {
      if (!hasRank(ctx.from, 5)) {
        return reply(
          ctx,
          '• رتبتك لا تسمح لك'
        );
      }

      group.cleaning.enabled =
        true;

      saveData();

      return reply(
        ctx,
        '• تم تفعيل التنظيف التلقائي'
      );
    }

    if (
      text ===
        'تعطيل التنظيف التلقائي'
    ) {
      if (!hasRank(ctx.from, 5)) {
        return reply(
          ctx,
          '• رتبتك لا تسمح لك'
        );
      }

      group.cleaning.enabled =
        false;

      saveData();

      return reply(
        ctx,
        '• تم تعطيل التنظيف التلقائي'
      );
    }

    /* ==========================================
       المطور
    ========================================== */

    if (
      text === 'ا' ||
      text === 'ت' ||
      text === 'ق' ||
      text === 'م' ||
      text === 'ن' ||
      text === 'ح' ||
      text === 'د'
    ) {
      return developerPanel(ctx);
    }

    if (text === 'حالة البوت') {
      if (!hasRank(ctx.from, 7)) {
        return reply(
          ctx,
          '• هذا الأمر للـ Dev🎖️ فقط'
        );
      }

      return reply(
        ctx,
        '• البوت يعمل بنجاح\n\n' +
        `• المستخدمين : ${Object.keys(db.users).length}\n` +
        `• القروبات : ${Object.keys(db.groups).length}\n` +
        `• المالك : @${OWNER_USERNAME}`
      );
    }

    if (text === 'تفعيل الردود') {
      if (!hasRank(ctx.from, 7)) {
        return reply(
          ctx,
          '• هذا الأمر للـ Dev🎖️ فقط'
        );
      }

      db.settings.replies = true;

      saveData();

      return reply(
        ctx,
        '• تم تفعيل الردود'
      );
    }

    if (text === 'تعطيل الردود') {
      if (!hasRank(ctx.from, 7)) {
        return reply(
          ctx,
          '• هذا الأمر للـ Dev🎖️ فقط'
        );
      }

      db.settings.replies = false;

      saveData();

      return reply(
        ctx,
        '• تم تعطيل الردود'
      );
    }

    /* ==========================================
       الردود المخصصة
    ========================================== */

    if (
      text.startsWith('اضف رد ')
    ) {
      if (!hasRank(ctx.from, 4)) {
        return reply(
          ctx,
          '• رتبتك لا تسمح لك'
        );
      }

      const value =
        raw.slice(7).trim();

      if (!value) {
        return reply(
          ctx,
          '• اكتب الرد'
        );
      }

      group.customReplies[
        value.toLowerCase()
      ] = value;

      saveData();

      return reply(
        ctx,
        `• تم إضافة الرد : ${value}`
      );
    }

    if (
      text.startsWith('حذف رد ')
    ) {
      if (!hasRank(ctx.from, 4)) {
        return reply(
          ctx,
          '• رتبتك لا تسمح لك'
        );
      }

      const value =
        raw.slice(7)
          .trim()
          .toLowerCase();

      delete group.customReplies[value];

      saveData();

      return reply(
        ctx,
        '• تم حذف الرد'
      );
    }

    if (
      group &&
      group.customReplies[text]
    ) {
      return reply(
        ctx,
        group.customReplies[text]
      );
    }

    /* ==========================================
       الحماية من الكلمات
    ========================================== */

    if (
      group &&
      group.protection.violations &&
      group.forbiddenWords.length
    ) {
      const found =
        group.forbiddenWords.find(
          word =>
            text.includes(word)
        );

      if (found) {
        try {
          await ctx.deleteMessage();
        } catch {}

        return;
      }
    }

  } catch (error) {
    console.error(
      'MESSAGE ERROR:',
      error
    );
  }
});

/* =========================================================
   معالجة الأخطاء
========================================================= */

bot.catch((error, ctx) => {
  console.error(
    'BOT ERROR:',
    error?.message || error,
    'UPDATE:',
    ctx?.update?.update_id
  );
});

/* =========================================================
   تشغيل البوت
========================================================= */

async function startBot() {
  try {
    await bot.launch();

    console.log('================================');
    console.log('BOT STARTED');
    console.log('OWNER: @j4xa7');
    console.log('My = Myth 🎖️');
    console.log('FILE: index.cjs');
    console.log('================================');
  } catch (error) {
    console.error(
      'FAILED TO START:',
      error
    );
  }
}

startBot();

process.once(
  'SIGINT',
  () => bot.stop('SIGINT')
);

process.once(
  'SIGTERM',
  () => bot.stop('SIGTERM')
);
