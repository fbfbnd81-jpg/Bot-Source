'use strict';

require('dotenv').config();

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

const OWNER_USERNAME = 'j4xa7';
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* =========================================================
   قاعدة البيانات
========================================================= */

const DEFAULT_DATA = {
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
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    data.users ||= {};
    data.groups ||= {};
    data.subscribers ||= [];
    data.settings ||= {};

    return data;
  } catch (e) {
    console.error('خطأ في قراءة قاعدة البيانات:', e);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

let db = loadData();

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('خطأ في حفظ قاعدة البيانات:', e);
  }
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

function getRankName(rank) {
  if (rank >= 7) return 'Dev🎖️';
  if (rank >= 6) return 'Dev²';
  if (rank >= 5) return 'Myth 🎖️';
  if (rank >= 4) return 'Myth';
  if (rank >= 3) return 'مالك أساسي';
  if (rank >= 2) return 'مالك';
  if (rank >= 1) return 'مميز';
  return 'عضو';
}

function normalizeUsername(username) {
  return String(username || '')
    .replace('@', '')
    .toLowerCase();
}

function isOwner(user) {
  return normalizeUsername(user?.username) === OWNER_USERNAME.toLowerCase();
}

function getUserData(userId) {
  const id = String(userId);

  if (!db.users[id]) {
    db.users[id] = {
      id,
      username: '',
      firstName: '',
      rank: 0,
      money: 0,
      interaction: 0,
      warnings: 0,
      wins: 0,
      answers: 0,
      messages: 0,
      createdAt: Date.now()
    };
  }

  return db.users[id];
}

function getRank(user) {
  if (isOwner(user)) return 7;

  return getUserData(user.id).rank || 0;
}

function can(user, rank) {
  return getRank(user) >= rank;
}

function cannotTarget(actor, target) {
  return getRank(target) >= getRank(actor);
}

/* =========================================================
   المجموعات
========================================================= */

function getGroupData(chatId) {
  const id = String(chatId);

  if (!db.groups[id]) {
    db.groups[id] = {
      id,
      title: '',
      enabled: true,

      protection: {
        violations: true,
        links: false,
        mentions: true,
        edits: false,
        spam: false,
        ads: false,
        forwards: false,
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

      warnings: {},
      muted: {},
      globalMuted: {},
      restricted: {},
      banned: {},

      forbiddenWords: [],

      cleaning: {
        enabled: false
      },

      mentions: true,

      games: {
        enabled: true,
        active: null
      },

      customCommands: {},
      customReplies: {},

      whispers: {},

      bank: {},

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
   تحديث بيانات المستخدم
========================================================= */

function registerUser(user) {
  if (!user) return;

  const data = getUserData(user.id);

  data.username = user.username || '';
  data.firstName = user.first_name || '';

  if (!db.subscribers.includes(String(user.id))) {
    db.subscribers.push(String(user.id));
  }

  saveData();
}

/* =========================================================
   إرسال رسالة
========================================================= */

async function safeReply(ctx, text, extra = {}) {
  try {
    return await ctx.reply(text, extra);
  } catch (e) {
    console.log('تعذر إرسال الرسالة:', e.message);
  }
}

/* =========================================================
   الحصول على المستخدم بالرد
========================================================= */

function repliedUser(ctx) {
  return ctx.message?.reply_to_message?.from || null;
}

/* =========================================================
   عرض الرتبة
========================================================= */

function rankText(user) {
  return `• الرتبة : ${getRankName(getRank(user))}`;
}

function userMention(user) {
  if (!user) return 'المستخدم';

  if (user.username) {
    return `@${user.username}`;
  }

  return user.first_name || 'المستخدم';
}

/* =========================================================
   أوامر الرتب
========================================================= */

function rankFromCommand(command) {
  const text = command.trim();

  if (
    text === 'مميز' ||
    text === 'مميـز'
  ) return 1;

  if (text === 'مالك') return 2;

  if (
    text === 'مالك أساسي' ||
    text === 'مالك اساسي' ||
    text === 'اساس'
  ) return 3;

  if (
    text === 'Myth' ||
    text === 'M' ||
    text === 'myth'
  ) return 4;

  if (
    text === 'My' ||
    text === 'my' ||
    text === 'Myth 🎖️' ||
    text === 'اكس'
  ) return 5;

  if (
    text === 'Dev²' ||
    text === 'dev2' ||
    text === 'مطور ثانوي'
  ) return 6;

  if (
    text === 'ديف' ||
    text === 'Dev' ||
    text === 'Dev🎖️'
  ) return 7;

  return null;
}

async function promoteUser(ctx, rank) {
  const actor = ctx.from;
  const target = repliedUser(ctx);

  if (!target) {
    return safeReply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!can(actor, rank)) {
    return safeReply(ctx, '• رتبتك لا تسمح لك بهذا الأمر');
  }

  if (isOwner(target)) {
    return safeReply(ctx, '• لا يمكن تعديل رتبة المالك');
  }

  if (cannotTarget(actor, target)) {
    return safeReply(ctx, '• لا يمكنك تعديل رتبة شخص أعلى منك أو مساوية لك');
  }

  const targetData = getUserData(target.id);

  if (rank >= getRank(actor)) {
    return safeReply(ctx, '• لا يمكنك إعطاء رتبة أعلى من رتبتك');
  }

  targetData.rank = rank;

  saveData();

  return safeReply(
    ctx,
    `• تم رفع رتبة ${userMention(target)} إلى : ${getRankName(rank)}`
  );
}

async function demoteUser(ctx) {
  const actor = ctx.from;
  const target = repliedUser(ctx);

  if (!target) {
    return safeReply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!can(actor, 1)) {
    return safeReply(ctx, '• رتبتك لا تسمح لك بهذا الأمر');
  }

  if (isOwner(target)) {
    return safeReply(ctx, '• لا يمكن تنزيل المالك');
  }

  if (cannotTarget(actor, target)) {
    return safeReply(ctx, '• لا يمكنك تنزيل شخص أعلى منك أو مساوي لك');
  }

  getUserData(target.id).rank = 0;

  saveData();

  return safeReply(
    ctx,
    `• تم تنزيل ${userMention(target)} إلى : عضو`
  );
}

/* =========================================================
   العقوبات
========================================================= */

async function muteUser(ctx, global = false) {
  const actor = ctx.from;
  const target = repliedUser(ctx);

  if (!target) {
    return safeReply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!can(actor, 2)) {
    return safeReply(ctx, '• رتبتك لا تسمح لك');
  }

  if (isOwner(target) || cannotTarget(actor, target)) {
    return safeReply(ctx, '• لا يمكنك معاقبة هذا المستخدم');
  }

  const group = getGroupData(ctx.chat.id);
  const collection = global ? group.globalMuted : group.muted;

  collection[String(target.id)] = {
    userId: String(target.id),
    username: target.username || '',
    time: Date.now()
  };

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

  return safeReply(
    ctx,
    global
      ? `• تم كتم ${userMention(target)} عام`
      : `• تم كتم ${userMention(target)}`
  );
}

async function unmuteUser(ctx, global = false) {
  const target = repliedUser(ctx);

  if (!target) {
    return safeReply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!can(ctx.from, 2)) {
    return safeReply(ctx, '• رتبتك لا تسمح لك');
  }

  const group = getGroupData(ctx.chat.id);

  delete group.muted[String(target.id)];
  delete group.globalMuted[String(target.id)];

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
  } catch {}

  saveData();

  return safeReply(ctx, `• تم فك كتم ${userMention(target)}`);
}

async function restrictUser(ctx) {
  const target = repliedUser(ctx);

  if (!target) {
    return safeReply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!can(ctx.from, 2)) {
    return safeReply(ctx, '• رتبتك لا تسمح لك');
  }

  if (isOwner(target) || cannotTarget(ctx.from, target)) {
    return safeReply(ctx, '• لا يمكنك تقييد هذا المستخدم');
  }

  const group = getGroupData(ctx.chat.id);

  group.restricted[String(target.id)] = {
    userId: String(target.id),
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

  return safeReply(ctx, `• تم تقييد ${userMention(target)}`);
}

async function unrestrictUser(ctx) {
  const target = repliedUser(ctx);

  if (!target) {
    return safeReply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!can(ctx.from, 2)) {
    return safeReply(ctx, '• رتبتك لا تسمح لك');
  }

  const group = getGroupData(ctx.chat.id);

  delete group.restricted[String(target.id)];

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
  } catch {}

  saveData();

  return safeReply(ctx, `• تم إلغاء تقييد ${userMention(target)}`);
}

/* =========================================================
   الحظر والطرد
========================================================= */

async function banUser(ctx) {
  const target = repliedUser(ctx);

  if (!target) {
    return safeReply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!can(ctx.from, 3)) {
    return safeReply(ctx, '• رتبتك لا تسمح لك');
  }

  if (isOwner(target) || cannotTarget(ctx.from, target)) {
    return safeReply(ctx, '• لا يمكنك حظر هذا المستخدم');
  }

  try {
    await ctx.telegram.banChatMember(ctx.chat.id, target.id);
  } catch (e) {
    return safeReply(ctx, '• تعذر تنفيذ الحظر');
  }

  getGroupData(ctx.chat.id).banned[String(target.id)] = Date.now();

  saveData();

  return safeReply(ctx, `• تم حظر ${userMention(target)}`);
}

async function unbanUser(ctx) {
  const target = repliedUser(ctx);

  if (!target) {
    return safeReply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!can(ctx.from, 3)) {
    return safeReply(ctx, '• رتبتك لا تسمح لك');
  }

  try {
    await ctx.telegram.unbanChatMember(ctx.chat.id, target.id);
  } catch {}

  delete getGroupData(ctx.chat.id).banned[String(target.id)];

  saveData();

  return safeReply(ctx, `• تم فك حظر ${userMention(target)}`);
}

async function kickUser(ctx) {
  const target = repliedUser(ctx);

  if (!target) {
    return safeReply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!can(ctx.from, 3)) {
    return safeReply(ctx, '• رتبتك لا تسمح لك');
  }

  if (isOwner(target) || cannotTarget(ctx.from, target)) {
    return safeReply(ctx, '• لا يمكنك طرد هذا المستخدم');
  }

  try {
    await ctx.telegram.banChatMember(ctx.chat.id, target.id);
    await ctx.telegram.unbanChatMember(ctx.chat.id, target.id);
  } catch {
    return safeReply(ctx, '• تعذر تنفيذ الطرد');
  }

  return safeReply(ctx, `• تم طرد ${userMention(target)}`);
}

/* =========================================================
   المسح
========================================================= */

async function clearMuted(ctx, global = false) {
  const group = getGroupData(ctx.chat.id);

  if (!can(ctx.from, 5)) {
    return safeReply(ctx, '• الأمر متاح من رتبة Myth 🎖️ فأعلى');
  }

  const collection = global ? group.globalMuted : group.muted;
  const count = Object.keys(collection).length;

  if (!count) {
    return safeReply(
      ctx,
      global
        ? '• لا يوجد مكتومين عام'
        : '• لا يوجد مكتومين'
    );
  }

  for (const id of Object.keys(collection)) {
    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        Number(id),
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
    } catch {}
  }

  if (global) group.globalMuted = {};
  else group.muted = {};

  saveData();

  return safeReply(
    ctx,
    global
      ? `• تم مسح ( ${count} ) من المكتومين عام`
      : `• تم مسح ( ${count} ) من المكتومين`
  );
}

async function restrictedList(ctx) {
  if (!can(ctx.from, 6)) {
    return safeReply(ctx, '• الأمر متاح من رتبة Dev² فأعلى');
  }

  const group = getGroupData(ctx.chat.id);
  const ids = Object.keys(group.restricted);

  if (!ids.length) {
    return safeReply(ctx, '• لا يوجد مقيدين');
  }

  return safeReply(
    ctx,
    `• المقيدين (${ids.length})\n\n` +
    ids.map((id, i) => `${i + 1}- ${id}`).join('\n')
  );
}

/* =========================================================
   التحذيرات
========================================================= */

async function warning(ctx) {
  const target = repliedUser(ctx);

  if (!target) {
    return safeReply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!can(ctx.from, 2)) {
    return safeReply(ctx, '• رتبتك لا تسمح لك');
  }

  if (isOwner(target) || cannotTarget(ctx.from, target)) {
    return safeReply(ctx, '• لا يمكنك تحذير هذا المستخدم');
  }

  const group = getGroupData(ctx.chat.id);
  const id = String(target.id);

  group.warnings[id] = (group.warnings[id] || 0) + 1;

  const count = group.warnings[id];

  if (count >= 3) {
    group.muted[id] = {
      userId: id,
      time: Date.now(),
      reason: 'ثلاثة تحذيرات'
    };

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

    return safeReply(
      ctx,
      `• تم تحذير ${userMention(target)}\n• عدد التحذيرات: 3\n• تم كتمه تلقائياً`
    );
  }

  saveData();

  return safeReply(
    ctx,
    `• تم تحذير ${userMention(target)}\n• التحذيرات: ${count}/3`
  );
}

async function removeWarning(ctx) {
  const target = repliedUser(ctx);

  if (!target) {
    return safeReply(ctx, '• يجب الرد على المستخدم أولاً');
  }

  if (!can(ctx.from, 2)) {
    return safeReply(ctx, '• رتبتك لا تسمح لك');
  }

  const group = getGroupData(ctx.chat.id);

  delete group.warnings[String(target.id)];

  saveData();

  return safeReply(ctx, `• تم إلغاء تحذيرات ${userMention(target)}`);
}

/* =========================================================
   التفاعل
========================================================= */

async function interaction(ctx, target = null) {
  const user = target || ctx.from;
  const data = getUserData(user.id);

  return safeReply(
    ctx,
    `• التفاعل : ${data.interaction}\n• الرسائل : ${data.messages}\n• الإجابات : ${data.answers}\n• الفوز : ${data.wins}`
  );
}

async function ranks(ctx) {
  const target = repliedUser(ctx) || ctx.from;

  return safeReply(
    ctx,
    `• الاسم : ${userMention(target)}\n• الرتبة : ${getRankName(getRank(target))}`
  );
}

async function activeUsers(ctx) {
  const users = Object.values(db.users)
    .filter(u => u.interaction > 0)
    .sort((a, b) => b.interaction - a.interaction)
    .slice(0, 20);

  if (!users.length) {
    return safeReply(ctx, '• لا يوجد متفاعلين');
  }

  let text = '• المتفاعلين :\n\n';

  users.forEach((u, i) => {
    text += `${i + 1}- ${u.firstName || u.username || u.id} : ${u.interaction}\n`;
  });

  return safeReply(ctx, text);
}

/* =========================================================
   المالك
========================================================= */

async function ownerInfo(ctx) {
  try {
    const photos = await ctx.telegram.getUserProfilePhotos(
      ctx.from.id,
      0,
      1
    );

    if (photos.total_count > 0) {
      const fileId = photos.photos[0][0].file_id;

      return ctx.replyWithPhoto(
        fileId,
        {
          caption:
            '• المالك\n\n' +
            '• اليوزر : @j4xa7\n' +
            '• الرتبة : Dev🎖️'
        }
      );
    }
  } catch {}

  return safeReply(
    ctx,
    '• المالك\n\n• اليوزر : @j4xa7\n• الرتبة : Dev🎖️'
  );
}

/* =========================================================
   الحماية
========================================================= */

function protectionStatus(group) {
  const p = group.protection;

  return (
    '• حالة الحماية\n\n' +
    `• المخالفات : ${p.violations ? 'مفتوحة' : 'مقفلة'}\n` +
    `• الروابط : ${p.links ? 'مقفلة' : 'مفتوحة'}\n` +
    `• المنشن : ${group.mentions ? 'مفتوح' : 'مقفل'}\n` +
    `• التعديل : ${p.edits ? 'مراقب' : 'غير مراقب'}\n` +
    `• التكرار : ${p.spam ? 'مفعل' : 'مقفل'}\n` +
    `• الإعلانات : ${p.ads ? 'مفعلة' : 'مقفلة'}`
  );
}

async function toggleProtection(ctx, type, value) {
  if (!can(ctx.from, 6)) {
    return safeReply(ctx, '• الأمر متاح من رتبة Dev² فأعلى');
  }

  const group = getGroupData(ctx.chat.id);

  if (type === 'violations') {
    group.protection.violations = value;
  } else if (type === 'links') {
    group.protection.links = value;
  } else if (type === 'mentions') {
    group.mentions = value;
  } else if (type === 'edits') {
    group.protection.edits = value;
  } else if (type === 'spam') {
    group.protection.spam = value;
  } else if (type === 'ads') {
    group.protection.ads = value;
  }

  saveData();

  return safeReply(ctx, '• تم تحديث إعداد الحماية');
}

/* =========================================================
   الكلمات الممنوعة
========================================================= */

async function forbiddenWord(ctx, word) {
  if (!can(ctx.from, 6)) {
    return safeReply(ctx, '• الأمر متاح من رتبة Dev² فأعلى');
  }

  if (!word) {
    return safeReply(ctx, '• اكتب الكلمة بعد الأمر');
  }

  const group = getGroupData(ctx.chat.id);

  if (!group.forbiddenWords.includes(word.toLowerCase())) {
    group.forbiddenWords.push(word.toLowerCase());
  }

  saveData();

  return safeReply(ctx, `• تم منع الكلمة : ${word}`);
}

async function removeForbiddenWord(ctx, word) {
  if (!can(ctx.from, 6)) {
    return safeReply(ctx, '• الأمر متاح من رتبة Dev² فأعلى');
  }

  const group = getGroupData(ctx.chat.id);

  group.forbiddenWords = group.forbiddenWords.filter(
    x => x !== word.toLowerCase()
  );

  saveData();

  return safeReply(ctx, `• تم إلغاء منع : ${word}`);
}

async function showForbiddenWords(ctx) {
  const group = getGroupData(ctx.chat.id);

  if (!group.forbiddenWords.length) {
    return safeReply(ctx, '• لا توجد كلمات ممنوعة');
  }

  return safeReply(
    ctx,
    '• الكلمات الممنوعة :\n\n' +
    group.forbiddenWords.map((x, i) => `${i + 1}- ${x}`).join('\n')
  );
}

/* =========================================================
   الألقاب
========================================================= */

async function setTitle(ctx, title) {
  const target = repliedUser(ctx);

  if (!target) {
    return safeReply(ctx, '• يجب الرد على المستخدم');
  }

  if (!can(ctx.from, 2)) {
    return safeReply(ctx, '• رتبتك لا تسمح لك');
  }

  getUserData(target.id).title = title;

  saveData();

  return safeReply(
    ctx,
    `• تم وضع اللقب ${title} لـ ${userMention(target)}`
  );
}

async function showTitle(ctx) {
  const target = repliedUser(ctx) || ctx.from;
  const title = getUserData(target.id).title || 'لا يوجد';

  return safeReply(ctx, `• اللقب : ${title}`);
}

/* =========================================================
   الاقتصاد
========================================================= */

async function money(ctx, target = null) {
  const user = target || ctx.from;
  const data = getUserData(user.id);

  return safeReply(
    ctx,
    `• الرصيد : ${data.money || 0} ريال`
  );
}

async function createBank(ctx) {
  const data = getUserData(ctx.from.id);

  data.bank ||= {
    created: true,
    balance: data.money || 0
  };

  saveData();

  return safeReply(ctx, '• تم إنشاء حسابك البنكي');
}

async function gift(ctx, amount) {
  const target = repliedUser(ctx);

  if (!target) {
    return safeReply(ctx, '• يجب الرد على المستخدم');
  }

  amount = Number(amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return safeReply(ctx, '• المبلغ غير صحيح');
  }

  const sender = getUserData(ctx.from.id);
  const receiver = getUserData(target.id);

  if (sender.money < amount) {
    return safeReply(ctx, '• رصيدك لا يكفي');
  }

  sender.money -= amount;
  receiver.money += amount;

  saveData();

  return safeReply(
    ctx,
    `• تم إهداء ${amount} ريال إلى ${userMention(target)}`
  );
}

/* =========================================================
   الألعاب
========================================================= */

const GAME_QUESTIONS = [
  {
    q: 'كم عدد أيام الأسبوع؟',
    answers: ['7', 'سبعة']
  },
  {
    q: 'ما عاصمة السعودية؟',
    answers: ['الرياض']
  },
  {
    q: 'كم يساوي 5 + 5؟',
    answers: ['10', '١٠']
  },
  {
    q: 'ما لون السماء غالباً؟',
    answers: ['أزرق', 'ازرق']
  }
];

async function startGame(ctx) {
  if (!can(ctx.from, 
