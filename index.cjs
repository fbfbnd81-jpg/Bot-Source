'use strict';

/*
=========================================================
        BOT - index.cjs
        Telegram Group Management Bot
=========================================================

المكتبة المطلوبة:
npm install telegraf

ضع التوكن في:
BOT_TOKEN

المالك الأساسي:
j4xa7

الرتب:
0 عضو
1 مميز
2 مالك
3 مالك أساسي
4 Myth
5 Myth 🎖️
6 Dev²🎖️
7 Dev 🎖️

=========================================================
*/

const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

/* =======================================================
   الإعدادات
======================================================= */

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN غير موجود في متغيرات البيئة');
}

const OWNER_USERNAME = 'j4xa7';

const bot = new Telegraf(BOT_TOKEN);

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* =======================================================
   قاعدة البيانات
======================================================= */

const DEFAULT_DATA = {
  users: {},
  groups: {},
  whispers: {},
  subscribers: [],
  global: {
    repliesEnabled: true,
    bankEnabled: true,
    communicationEnabled: true
  }
};

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(DEFAULT_DATA, null, 2),
        'utf8'
      );
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }

    const raw = fs.readFileSync(DATA_FILE, 'utf8');

    if (!raw.trim()) {
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }

    const parsed = JSON.parse(raw);

    return {
      ...JSON.parse(JSON.stringify(DEFAULT_DATA)),
      ...parsed,
      users: parsed.users || {},
      groups: parsed.groups || {},
      whispers: parsed.whispers || {},
      subscribers: parsed.subscribers || []
    };
  } catch (err) {
    console.error('خطأ في قراءة قاعدة البيانات:', err);

    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

let data = loadData();

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2),
      'utf8'
    );
  } catch (err) {
    console.error('خطأ في حفظ قاعدة البيانات:', err);
  }
}

/* =======================================================
   الرتب
======================================================= */

const RANKS = {
  0: 'عضو',
  1: 'مميز',
  2: 'مالك',
  3: 'مالك أساسي',
  4: 'Myth',
  5: 'Myth 🎖️',
  6: 'Dev²🎖️',
  7: 'Dev 🎖️'
};

function rankName(rank) {
  return RANKS[rank] || RANKS[0];
}

function normalize(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
}

function getUserKey(userId) {
  return String(userId);
}

function ensureUser(user) {
  const id = getUserKey(user.id);

  if (!data.users[id]) {
    data.users[id] = {
      id: user.id,
      username: user.username || '',
      firstName: user.first_name || '',
      rank: 0,
      messages: 0,
      wins: 0,
      answers: 0,
      money: 0,
      warnings: {},
      joinedAt: Date.now()
    };
  }

  data.users[id].username = user.username || data.users[id].username || '';
  data.users[id].firstName = user.first_name || data.users[id].firstName || '';

  if (user.username && user.username.toLowerCase() === OWNER_USERNAME.toLowerCase()) {
    data.users[id].rank = 7;
  }

  return data.users[id];
}

function getRank(user) {
  if (!user) return 0;

  if (
    user.username &&
    user.username.toLowerCase() === OWNER_USERNAME.toLowerCase()
  ) {
    return 7;
  }

  return ensureUser(user).rank || 0;
}

function isOwner(user) {
  return !!(
    user &&
    user.username &&
    user.username.toLowerCase() === OWNER_USERNAME.toLowerCase()
  );
}

/* =======================================================
   تحويل اسم الرتبة إلى رقم
======================================================= */

function parseRank(input) {
  const n = normalize(input);

  if (
    n === 'عضو' ||
    n === 'عضو 0'
  ) return 0;

  if (
    n === 'مميز' ||
    n === 'مميز 1'
  ) return 1;

  if (
    n === 'مالك' ||
    n === 'مالك 2'
  ) return 2;

  if (
    n === 'مالك اساسي' ||
    n === 'مالك أساسي' ||
    n === 'اساسي' ||
    n === 'أساسي' ||
    n === 'مالك اساس'
  ) return 3;

  if (
    n === 'myth' ||
    n === 'm' ||
    n === 'مايث'
  ) return 4;

  if (
    n === 'my' ||
    n === 'myth 🎖️' ||
    n === 'myth 🎖' ||
    n === 'myth medal' ||
    n === 'اكس'
  ) return 5;

  if (
    n === 'dev²' ||
    n === 'dev ²' ||
    n === 'dev2' ||
    n === 'dev 2' ||
    n === 'ديف 2' ||
    n === 'ديف²' ||
    n === 'مطور ثانوي' ||
    n === 'dev²🎖️' ||
    n === 'dev²🎖'
  ) return 6;

  if (
    n === 'dev' ||
    n === 'ديف' ||
    n === 'مطور' ||
    n === 'dev 🎖️' ||
    n === 'dev 🎖'
  ) return 7;

  return null;
}

/* =======================================================
   إعدادات القروبات
======================================================= */

function defaultGroup() {
  return {
    commandLocks: {},
    customCommands: {},
    customReplies: {},

    protection: {
      violations: true,

      links: true,
      mentions: false,
      spam: true,
      ads: true,
      forwards: false,
      edits: false,

      longMessages: true,
      phoneNumbers: true,

      photos: false,
      videos: false,
      documents: false,
      stickers: false,
      animations: false,
      audio: false,
      voice: false,

      forbiddenWords: [],

      warningLimit: 3,
      autoMute: true,
      autoBan: false,

      muteMinutes: 10,

      repeatedMessages: 4,
      repeatedWindow: 15
    },

    warnings: {},
    muted: {},
    globalMuted: {},
    restricted: {},

    interaction: {},
    gamesLocked: false,

    settings: {
      cleaningAuto: false
    }
  };
}

function ensureGroup(chatId) {
  const id = String(chatId);

  if (!data.groups[id]) {
    data.groups[id] = defaultGroup();
  }

  const g = data.groups[id];

  g.commandLocks ||= {};
  g.customCommands ||= {};
  g.customReplies ||= {};
  g.warnings ||= {};
  g.muted ||= {};
  g.globalMuted ||= {};
  g.restricted ||= {};
  g.interaction ||= {};

  g.protection ||= defaultGroup().protection;
  g.settings ||= { cleaningAuto: false };

  return g;
}

/* =======================================================
   حفظ المشتركين
======================================================= */

function addSubscriber(userId) {
  const id = String(userId);

  if (!data.subscribers.includes(id)) {
    data.subscribers.push(id);
    saveData();
  }
}

/* =======================================================
   منشن حقيقي
======================================================= */

function mentionUser(user) {
  if (!user) return 'المستخدم';

  const name =
    user.first_name ||
    user.username ||
    'المستخدم';

  const safeName = String(name)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  /*
    text_mention يعمل حتى مع المستخدم الذي ليس لديه username.
    Telegram يدعم هذا النوع من MessageEntity.
  */

  return `<a href="tg://user?id=${user.id}">${safeName}</a>`;
}

/* =======================================================
   الرد على الرسالة
======================================================= */

function replyOptions(ctx) {
  if (!ctx.message) return {};

  return {
    reply_parameters: {
      message_id: ctx.message.message_id
    }
  };
}

async function reply(ctx, text, extra = {}) {
  try {
    return await ctx.reply(
      text,
      {
        ...replyOptions(ctx),
        ...extra
      }
    );
  } catch (err) {
    console.error('Reply error:', err.message);
  }
}

/* =======================================================
   صلاحيات البوت
======================================================= */

async function getBotMember(ctx) {
  try {
    return await ctx.telegram.getChatMember(
      ctx.chat.id,
      ctx.botInfo.id
    );
  } catch {
    return null;
  }
}

async function botCan(ctx, permission) {
  const member = await getBotMember(ctx);

  if (!member) return false;

  if (member.status === 'creator') return true;

  if (member.status !== 'administrator') return false;

  if (permission === 'delete') {
    return member.can_delete_messages === true;
  }

  if (permission === 'restrict') {
    return member.can_restrict_members === true;
  }

  if (permission === 'promote') {
    return member.can_promote_members === true;
  }

  if (permission === 'invite') {
    return member.can_invite_users === true;
  }

  return true;
}

/* =======================================================
   صلاحية رتبة المستخدم
======================================================= */

function requireRank(ctx, minimum) {
  const rank = getRank(ctx.from);

  return rank >= minimum;
}

function adminOnlyMessage(requiredRank) {
  return `• هذا الامر يخص ↤ ｢ ${rankName(requiredRank)} ｣`;
}

/* =======================================================
   حماية الرتب
======================================================= */

function canActOn(actor, target) {
  const actorRank = getRank(actor);
  const targetRank = getRank(target);

  if (isOwner(target)) {
    return false;
  }

  if (actor.id === target.id) {
    return false;
  }

  return actorRank > targetRank;
}

/* =======================================================
   إجراءات الإدارة
======================================================= */

async function actionMessage(ctx, target, action) {
  return reply(
    ctx,
    `• المستخدم ذا ↤︎「 ${mentionUser(target)} 」\n• ${action}`,
    {
      parse_mode: 'HTML'
    }
  );
}

async function muteUser(ctx, target) {
  if (!await botCan(ctx, 'restrict')) {
    await reply(ctx, '• البوت يحتاج صلاحية تقييد الأعضاء');
    return false;
  }

  try {
    await ctx.telegram.restrictChatMember(
      ctx.chat.id,
      target.id,
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
        can_add_web_page_previews: false
      },
      {
        until_date: Math.floor(Date.now() / 1000) + 600
      }
    );

    return true;
  } catch (err) {
    console.error('mute error:', err.message);
    await reply(ctx, '• تعذر كتم المستخدم، تأكدي من صلاحيات البوت');
    return false;
  }
}

async function unmuteUser(ctx, target) {
  if (!await botCan(ctx, 'restrict')) {
    await reply(ctx, '• البوت يحتاج صلاحية تقييد الأعضاء');
    return false;
  }

  try {
    await ctx.telegram.restrictChatMember(
      ctx.chat.id,
      target.id,
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
        can_invite_users: true,
        can_pin_messages: true,
        can_manage_topics: true
      }
    );

    return true;
  } catch (err) {
    console.error('unmute error:', err.message);
    return false;
  }
}

async function restrictUser(ctx, target) {
  return muteUser(ctx, target);
}

async function unrestrictUser(ctx, target) {
  return unmuteUser(ctx, target);
}

async function banUser(ctx, target) {
  if (!await botCan(ctx, 'restrict')) {
    await reply(ctx, '• البوت يحتاج صلاحية الحظر');
    return false;
  }

  try {
    await ctx.telegram.banChatMember(
      ctx.chat.id,
      target.id
    );

    return true;
  } catch (err) {
    console.error('ban error:', err.message);
    await reply(ctx, '• تعذر حظر المستخدم');
    return false;
  }
}

async function unbanUser(ctx, target) {
  if (!await botCan(ctx, 'restrict')) {
    await reply(ctx, '• البوت يحتاج صلاحية الحظر');
    return false;
  }

  try {
    await ctx.telegram.unbanChatMember(
      ctx.chat.id,
      target.id
    );

    return true;
  } catch (err) {
    console.error('unban error:', err.message);
    return false;
  }
}

async function kickUser(ctx, target) {
  const ok = await banUser(ctx, target);

  if (!ok) return false;

  await unbanUser(ctx, target);

  return true;
}

/* =======================================================
   جلب العضو من الرد
======================================================= */

function getTarget(ctx) {
  return ctx.message &&
    ctx.message.reply_to_message &&
    ctx.message.reply_to_message.from
    ? ctx.message.reply_to_message.from
    : null;
}

/* =======================================================
   قفل الأوامر
======================================================= */

function commandKey(command) {
  return normalize(command)
    .replace(/^\/+/, '')
    .trim();
}

function findLockedCommand(group, command) {
  const key = commandKey(command);

  if (group.commandLocks[key] !== undefined) {
    return group.commandLocks[key];
  }

  return null;
}

async function checkCommandLock(ctx, command) {
  const group = ensureGroup(ctx.chat.id);

  const lock = findLockedCommand(group, command);

  if (lock === null) {
    return true;
  }

  const rank = getRank(ctx.from);

  if (rank >= lock) {
    return true;
  }

  await reply(
    ctx,
    `• الأمر متاح من رتبة ${rankName(lock)} فأعلى`
  );

  return false;
}

/* =======================================================
   نظام المخالفات
======================================================= */

function getWarnings(group, userId) {
  const id = String(userId);

  if (!group.warnings[id]) {
    group.warnings[id] = {
      count: 0,
      reasons: []
    };
  }

  return group.warnings[id];
}

function addWarning(group, user, reason) {
  const w = getWarnings(group, user.id);

  w.count += 1;

  w.reasons.push({
    reason,
    time: Date.now()
  });

  return w.count;
}

function clearWarnings(group, userId) {
  delete group.warnings[String(userId)];
}

async function violation(ctx, reason, target = ctx.from) {
  if (!ctx.chat || !ctx.from) return;

  const group = ensureGroup(ctx.chat.id);

  if (!group.protection.violations) return;

  const rank = getRank(target);

  /*
    لا نعاقب المالك أو أصحاب الرتب العالية.
  */

  if (rank >= 7) return;

  let deleted = false;

  if (await botCan(ctx, 'delete')) {
    try {
      await ctx.deleteMessage();
      deleted = true;
    } catch {}
  }

  const count = addWarning(
    group,
    target,
    reason
  );

  saveData();

  const limit =
    Number(group.protection.warningLimit) || 3;

  /*
    بعد عدد المخالفات المحدد:
    كتم تلقائي.
  */

  if (
    count >= limit &&
    group.protection.autoMute
  ) {
    if (await botCan(ctx, 'restrict')) {
      try {
        await ctx.telegram.restrictChatMember(
          ctx.chat.id,
          target.id,
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
            can_add_web_page_previews: false
          },
          {
            until_date:
              Math.floor(Date.now() / 1000) +
              ((Number(group.protection.muteMinutes) || 10) * 60)
          }
        );

        group.muted[String(target.id)] = {
          until:
            Date.now() +
            ((Number(group.protection.muteMinutes) || 10) * 60 * 1000)
        };

        saveData();

        await ctx.telegram.sendMessage(
          ctx.chat.id,
          `• المستخدم ذا ↤︎「 ${mentionUser(target)} 」\n` +
          `• تم كتمه تلقائيًا بسبب تكرار المخالفات (${count})`,
          {
            parse_mode: 'HTML'
          }
        );

        return;
      } catch (err) {
        console.error('auto mute:', err.message);
      }
    }
  }

  /*
    الحظر التلقائي اختياري.
  */

  if (
    count >= limit + 2 &&
    group.protection.autoBan
  ) {
    try {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        target.id
      );

      await ctx.telegram.sendMessage(
        ctx.chat.id,
        `• المستخدم ذا ↤︎「 ${mentionUser(target)} 」\n` +
        `• تم حظره تلقائيًا بسبب تكرار المخالفات`,
        {
          parse_mode: 'HTML'
        }
      );

      return;
    } catch (err) {
      console.error('auto ban:', err.message);
    }
  }

  /*
    رسالة المخالفة.
  */

  try {
    await ctx.telegram.sendMessage(
      ctx.chat.id,
      `• مخالفة على ↤︎「 ${mentionUser(target)} 」\n` +
      `• السبب ↤ ${reason}\n` +
      `• عدد المخالفات ↤ ${count}/${limit}`,
      {
        parse_mode: 'HTML',
        reply_parameters: {
          message_id: ctx.message.message_id
        }
      }
    );
  } catch {}
}

/* =======================================================
   فحص الروابط
======================================================= */

function containsLink(text) {
  if (!text) return false;

  return (
    /https?:\/\/\S+/i.test(text) ||
    /www\.\S+/i.test(text) ||
    /t\.me\/\S+/i.test(text)
  );
}

/* =======================================================
   فحص المنشن
======================================================= */

function containsMention(ctx, text) {
  if (!text) return false;

  if (/@[a-zA-Z0-9_]{4,}/.test(text)) {
    return true;
  }

  const entities = ctx.message?.entities || [];

  return entities.some(
    e =>
      e.type === 'mention' ||
      e.type === 'text_mention'
  );
}

/* =======================================================
   فحص الهاتف
======================================================= */

function containsPhone(text) {
  if (!text) return false;

  return /(?:\+?\d[\d\s-]{7,}\d)/.test(text);
}

/* =======================================================
   فحص الرسائل الطويلة
======================================================= */

function isLongMessage(text) {
  return !!text && text.length > 1500;
}

/* =======================================================
   فحص التكرار
======================================================= */

function checkRepeated(group, userId, text) {
  if (!text) return false;

  if (!group.__repeat) {
    group.__repeat = {};
  }

  const id = String(userId);

  if (!group.__repeat[id]) {
    group.__repeat[id] = [];
  }

  const arr = group.__repeat[id];

  const now = Date.now();

  arr.push({
    text: normalize(text),
    time: now
  });

  const windowMs =
    (Number(group.protection.repeatedWindow) || 15) *
    1000;

  group.__repeat[id] = arr.filter(
    x => now - x.time <= windowMs
  );

  const recent = group.__repeat[id];

  const same = recent.filter(
    x => x.text === normalize(text)
  );

  return same.length >=
    (Number(group.protection.repeatedMessages) || 4);
}

/* =======================================================
   فحص الإعلانات
======================================================= */

function looksLikeAd(text) {
  if (!text) return false;

  const patterns = [
    /للبيع/i,
    /للبيع\s*والشراء/i,
    /خصم/i,
    /تخفيض/i,
    /متجر/i,
    /سعر/i,
    /اشترك/i,
    /تواصل\s*خاص/i,
    /خاصني/i,
    /خاص/i,
    /اعلان/i,
    /إعلان/i
  ];

  return patterns.some(p => p.test(text));
}

/* =======================================================
   فحص المخالفات قبل الأوامر
======================================================= */

async function checkProtection(ctx) {
  if (!ctx.chat || !ctx.from) return false;

  if (ctx.chat.type === 'private') {
    return false;
  }

  const group = ensureGroup(ctx.chat.id);

  if (!group.protection.violations) {
    return false;
  }

  const text =
    ctx.message?.text ||
    ctx.message?.caption ||
    '';

  /*
    لا نطبق الحماية على أصحاب الرتب العالية.
  */

  if (getRank(ctx.from) >= 7) {
    return false;
  }

  /*
    الأوامر المعروفة لا تعتبر مخالفة.
  */

  if (
    text &&
    (
      text.startsWith('/') ||
      isKnownCommandText(text, ctx)
    )
  ) {
    return false;
  }

  /*
    الكلمات الممنوعة
  */

  for (const word of group.protection.forbiddenWords) {
    if (
      word &&
      normalize(text).includes(normalize(word))
    ) {
      await violation(
        ctx,
        `استخدام كلمة ممنوعة: ${word}`
      );

      return true;
    }
  }

  /*
    الروابط
  */

  if (
    group.protection.links &&
    containsLink(text)
  ) {
    await violation(ctx, 'إرسال رابط ممنوع');
    return true;
  }

  /*
    المنشن
  */

  if (
    group.protection.mentions &&
    containsMention(ctx, text)
  ) {
    await violation(ctx, 'استخدام المنشن');
    return true;
  }

  /*
    أرقام الجوال
  */

  if (
    group.protection.phoneNumbers &&
    containsPhone(text)
  ) {
    await violation(ctx, 'إرسال رقم جوال');
    return true;
  }

  /*
    الرسائل الطويلة
  */

  if (
    group.protection.longMessages &&
    isLongMessage(text)
  ) {
    await violation(ctx, 'رسالة طويلة');
    return true;
  }

  /*
    التكرار
  */

  if (
    group.protection.spam &&
    checkRepeated(group, ctx.from.id, text)
  ) {
    await violation(ctx, 'تكرار الرسائل / سبام');
    return true;
  }

  /*
    الإعلان
  */

  if (
    group.protection.ads &&
    looksLikeAd(text)
  ) {
    await violation(ctx, 'إعلان');
    return true;
  }

  /*
    الفوروارد
  */

  if (
    group.protection.forwards &&
    ctx.message?.forward_origin
  ) {
    await violation(ctx, 'إعادة توجيه ممنوعة');
    return true;
  }

  /*
    أنواع الوسائط
  */

  if (
    group.protection.photos &&
    ctx.message?.photo
  ) {
    await violation(ctx, 'إرسال الصور ممنوع');
    return true;
  }

  if (
    group.protection.videos &&
    ctx.message?.video
  ) {
    await violation(ctx, 'إرسال الفيديو ممنوع');
    return true;
  }

  if (
    group.protection.documents &&
    ctx.message?.document
  ) {
    await violation(ctx, 'إرسال الملفات ممنوع');
    return true;
  }

  if (
    group.protection.stickers &&
    ctx.message?.sticker
  ) {
    await violation(ctx, 'إرسال الملصقات ممنوع');
    return true;
  }

  if (
    group.protection.animations &&
    ctx.message?.animation
  ) {
    await violation(ctx, 'إرسال GIF ممنوع');
    return true;
  }

  if (
    group.protection.audio &&
    ctx.message?.audio
  ) {
    await violation(ctx, 'إرسال المقاطع الصوتية ممنوع');
    return true;
  }

  if (
    group.protection.voice &&
    ctx.message?.voice
  ) {
    await violation(ctx, 'إرسال الرسائل الصوتية ممنوع');
    return true;
  }

  return false;
}

/* =======================================================
   معرفة هل النص أمر معروف
======================================================= */

function isKnownCommandText(text, ctx) {
  const n = normalize(text);

  const known = [
    'اوامر',
    'رتبتي',
    'رتبته',
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
    'رفع القيود',
    'مق',
    'مسح المقيدين',
    'قائمة المقيدين',

    'حظر',
    'فك الحظر',
    'طرد',

    'تحذير',
    'انذار',
    'إنذار',
    'إلغاء التحذير',
    'الغاء التحذير',

    'تنزيل',
    'صلاحياتي',
    'صلاحياته',

    'اضف امر',
    'أضف أمر',
    'اضف رد',
    'أضف رد',

    'فتح المخالفات',
    'غلق المخالفات',
    'قفل المخالفات',
    'حالة الحماية',

    'فتح الروابط',
    'قفل الروابط',
    'فتح المنشن',
    'غلق المنشن',

    'منع الكلمه',
    'منع الكلمة',
    'الغاء منع الكلمه',
    'الغاء منع الكلمة',
    'الكلمات الممنوعه',
    'الكلمات الممنوعة',
    'مسح الكلمات الممنوعه',

    'قفل الالعاب',
    'فتح الالعاب',

    'فلوسي',
    'فلوسه',
    'حسابي',
    'المتجر',

    'دعوة',
    'بدأت المكالمه الصوتيه',
    'بدأت المكالمة الصوتية',
    'انتهت المكالمه الصوتيه',
    'انتهت المكالمة الصوتية',

    'بحث',
    'بحث أغنية',
    'بحث اغنية',
    'اغنية',
    'أغنية',
    'شغل',
    'تشغيل'
  ];

  if (known.includes(n)) return true;

  const prefixes = [
    'رفع ',
    'قفل امر ',
    'فتح امر ',
    'تنظيف',
    'اهمس',
    'همسه',
    'ه ',
    'ضع ',
    'منع الكلمه ',
    'منع الكلمة ',
    'الغاء منع الكلمه ',
    'الغاء منع الكلمة '
  ];

  return prefixes.some(p => n.startsWith(p));
}

/* =======================================================
   تسجيل التفاعل
======================================================= */

function registerInteraction(ctx) {
  if (!ctx.chat || !ctx.from) return;

  const group = ensureGroup(ctx.chat.id);

  const id = String(ctx.from.id);

  if (!group.interaction[id]) {
    group.interaction[id] = {
      messages: 0,
      last: Date.now()
    };
  }

  group.interaction[id].messages += 1;
  group.interaction[id].last = Date.now();

  ensureUser(ctx.from).messages += 1;
}

/* =======================================================
   أمر الرتبة
======================================================= */

bot.on('message', async ctx => {
  if (!ctx.chat || ctx.chat.type === 'private') {
    return;
  }

  if (!ctx.from) return;

  ensureUser(ctx.from);

  /*
    سجل التفاعل أولاً.
  */

  registerInteraction(ctx);

  /*
    الحماية الفعلية.
  */

  const protectedMessage = await checkProtection(ctx);

  if (protectedMessage) {
    saveData();
    return;
  }

  saveData();
});

/* =======================================================
   start
======================================================= */

bot.start(async ctx => {
  ensureUser(ctx.from);
  addSubscriber(ctx.from.id);

  if (ctx.chat.type !== 'private') {
    return;
  }

  const payload = ctx.startPayload || '';

  if (payload.startsWith('whisper_')) {
    const id = payload.substring(8);

    const whisper = data.whispers[id];

    if (!whisper) {
      return ctx.reply('• الهمسة غير موجودة أو انتهت');
    }

    if (String(whisper.to) !== String(ctx.from.id)) {
      return ctx.reply('• هذه الهمسة ليست لك');
    }

    whisper.viewed = true;
    whisper.viewedAt = Date.now();

    saveData();

    try {
      await ctx.telegram.sendMessage(
        whisper.from,
        `• تم فتح همستك بواسطة ↤︎ ${mentionUser(ctx.from)}`,
        {
          parse_mode: 'HTML'
        }
      );
    } catch {}

    return ctx.reply(
      whisper.content,
      {
        parse_mode: 'HTML'
      }
    );
  }

  if (payload.startsWith('whisperreply_')) {
    const id = payload.substring(14);

    const whisper = data.whispers[id];

    if (!whisper) {
      return ctx.reply('• الهمسة غير موجودة أو انتهت');
    }

    if (String(whisper.to) !== String(ctx.from.id)) {
      return ctx.reply('• هذا الرد ليس لك');
    }

    data.whispers[id].replyUser = ctx.from.id;
    saveData();

    return ctx.reply(
      `• ارسل ردك الآن على همسة ${whisper.fromName || 'المستخدم'}`
    );
  }

  return ctx.reply(
    `أهلا بك يا قلبي - منشن الشخص\n\n` +
    `• انا اشغل لك اللي تبي بالمكالمه\n\n` +
    `ادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.`,
    Markup.inlineKeyboard([
      [
        Markup.button.url(
          'اضفني الى مجموعتك',
          `https://t.me/${ctx.botInfo.username}?startgroup=true`
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
});

/* =======================================================
   اوامر عامة
======================================================= */

bot.hears(/^اوامر$/i, async ctx => {
  if (!requireRank(ctx, 7)) {
    return reply(ctx, adminOnlyMessage(7));
  }

  await reply(
    ctx,
    `━━━━━━━━━━━━━━━━
• أوامر البوت
━━━━━━━━━━━━━━━━

• الرتب
رتبتي
رتبته
رفع مميز
رفع مالك
رفع مالك أساسي
رفع Myth
رفع My
رفع Dev²
رفع ديف
تنزيل

• الإدارة
رفع مشرف
ترقيه
تنزيل مشرف
صلاحياتي
صلاحياته

• العقوبات
كتم
كتم عام
فك الكتم
فك الكتم العام
تقييد
الغاء التقييد
حظر
فك الحظر
طرد
تحذير
إلغاء التحذير

• المسح
مم
خخ
مق
مسح المقيدين
تنظيف

• الحماية
فتح المخالفات
غلق المخالفات
حالة الحماية
فتح الروابط
قفل الروابط
فتح المنشن
غلق المنشن
منع الكلمه
الكلمات الممنوعه

• الأوامر المخصصة
اضف امر
اضف رد
قفل امر
فتح امر

• التفاعل
تفاعلي
تفاعله
المتفاعلين
تصفير المتفاعلين

• الألعاب
فتح الالعاب
قفل الالعاب

• الموسيقى
بحث
بحث أغنية
شغل
تشغيل

• الاقتصاد
فلوسي
فلوسه
حسابي
المتجر`
  );
});

/* =======================================================
   رتبتي
======================================================= */

bot.hears(/^رتبتي$/i, async ctx => {
  if (!await checkCommandLock(ctx, 'رتبتي')) return;

  const rank = getRank(ctx.from);

  await reply(
    ctx,
    `• رتبتك هي ↤ ${rankName(rank)}`
  );
});

/* =======================================================
   رتبته
======================================================= */

bot.hears(/^رتبته$/i, async ctx => {
  if (!await checkCommandLock(ctx, 'رتبته')) return;

  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على الشخص');
  }

  await reply(
    ctx,
    `• رتبة المستخدم ↤ ${rankName(getRank(target))}`
  );
});

/* =======================================================
   تفاعلي
======================================================= */

bot.hears(/^تفاعلي$/i, async ctx => {
  const group = ensureGroup(ctx.chat.id);
  const id = String(ctx.from.id);

  const messages =
    group.interaction[id]?.messages || 0;

  const entries = Object.entries(
    group.interaction
  ).sort(
    (a, b) =>
      (b[1]?.messages || 0) -
      (a[1]?.messages || 0)
  );

  const index = entries.findIndex(
    ([uid]) => uid === id
  );

  const rank =
    index === -1
      ? '-'
      : index + 1;

  await reply(
    ctx,
    `• رتبتك هي ↤ ${rankName(getRank(ctx.from))}\n\n` +
    `• رسائلك بالتفاعل  ↤  ${messages}\n` +
    `• ترتيبك بالمتفاعلين ↤ ${rank}\n-`
  );
});

/* =======================================================
   تفاعله
======================================================= */

bot.hears(/^تفاعله$/i, async ctx => {
  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على الشخص');
  }

  const group = ensureGroup(ctx.chat.id);
  const id = String(target.id);

  const messages =
    group.interaction[id]?.messages || 0;

  const entries = Object.entries(
    group.interaction
  ).sort(
    (a, b) =>
      (b[1]?.messages || 0) -
      (a[1]?.messages || 0)
  );

  const index = entries.findIndex(
    ([uid]) => uid === id
  );

  await reply(
    ctx,
    `• رتبة المستخدم ↤ ${rankName(getRank(target))}\n\n` +
    `• رسائله بالتفاعل ↤ ${messages}\n` +
    `• ترتيبه بالمتفاعلين ↤ ${index === -1 ? '-' : index + 1}`
  );
});

/* =======================================================
   المتفاعلين
======================================================= */

bot.hears(/^المتفاعلين$/i, async ctx => {
  const group = ensureGroup(ctx.chat.id);

  const entries = Object.entries(
    group.interaction
  )
    .sort(
      (a, b) =>
        (b[1]?.messages || 0) -
        (a[1]?.messages || 0)
    )
    .slice(0, 20);

  if (!entries.length) {
    return reply(ctx, '• لا يوجد متفاعلين حتى الآن');
  }

  const medals = ['🥇', '🥈', '🥉'];

  let text =
    `توب اكثر 20 متفاعلين بالقروب :\n` +
    `━━━━━━━━━\n\n`;

  entries.forEach(([id, info], index) => {
    const user = data.users[id];

    const name =
      user?.firstName ||
      user?.username ||
      `عضو ${id}`;

    const prefix =
      index < 3
        ? medals[index]
        : `${index + 1}`;

    text +=
      `${prefix} ) ${(info.messages || 0).toLocaleString()}  l ${name}\n`;
  });

  const me = String(ctx.from.id);

  if (
    !entries.some(([id]) => id === me) &&
    group.interaction[me]
  ) {
    text +=
      `\n━━━━━━━━━\n` +
      `• you)  ${(group.interaction[me].messages || 0).toLocaleString()}  l ${ctx.from.first_name || ''}`;
  }

  text += '\n━━━━━━━━━';

  await reply(ctx, text);
});

/* =======================================================
   تصفير المتفاعلين
======================================================= */

bot.hears(/^تصفير المتفاعلين$/i, async ctx => {
  if (!requireRank(ctx, 6)) {
    return reply(ctx, adminOnlyMessage(6));
  }

  const group = ensureGroup(ctx.chat.id);

  group.interaction = {};

  saveData();

  await reply(ctx, '• تم تصفير المتفاعلين');
});

/* =======================================================
   رفع الرتب
======================================================= */

async function promoteRankCommand(ctx, requestedRank) {
  if (!requireRank(ctx, 6)) {
    return reply(ctx, adminOnlyMessage(6));
  }

  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على المستخدم');
  }

  if (!canActOn(ctx.from, target)) {
    return reply(ctx, '• لا يمكنك تعديل رتبة هذا المستخدم');
  }

  if (requestedRank >= getRank(ctx.from)) {
    return reply(ctx, '• لا يمكنك رفع شخص إلى رتبتك أو أعلى');
  }

  const user = ensureUser(target);

  user.rank = requestedRank;

  if (requestedRank === 7) {
    return reply(
      ctx,
      `• لا يمكن إعطاء رتبة Dev 🎖️ إلا للمالك الأساسي`
    );
  }

  saveData();

  await actionMessage(
    ctx,
    target,
    `تم رفعه ${rankName(requestedRank)}`
  );
}

bot.hears(/^رفع مميز$/i, ctx => promoteRankCommand(ctx, 1));
bot.hears(/^رفع مالك$/i, ctx => promoteRankCommand(ctx, 2));
bot.hears(/^رفع مالك (أساسي|اساسي)$/i, ctx => promoteRankCommand(ctx, 3));
bot.hears(/^رفع (Myth|مايث|M)$/i, ctx => promoteRankCommand(ctx, 4));
bot.hears(/^رفع (My|Myth 🎖️|Myth 🎖|اكس)$/i, ctx => promoteRankCommand(ctx, 5));
bot.hears(/^رفع (Dev²|Dev ²|Dev2|ديف 2|ديف²|مطور ثانوي)$/i, ctx => promoteRankCommand(ctx, 6));

/* =======================================================
   رفع ديف - المالك فقط
======================================================= */

bot.hears(/^رفع ديف$/i, async ctx => {
  if (!isOwner(ctx.from)) {
    return reply(ctx, adminOnlyMessage(7));
  }

  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على المستخدم');
  }

  if (isOwner(target)) {
    return reply(ctx, '• هذا المستخدم هو المالك الأساسي');
  }

  ensureUser(target).rank = 7;

  saveData();

  await actionMessage(
    ctx,
    target,
    'تم رفعه Dev 🎖️'
  );
});

/* =======================================================
   تنزيل
======================================================= */

bot.hears(/^تنزيل$/i, async ctx => {
  if (!requireRank(ctx, 6)) {
    return reply(ctx, adminOnlyMessage(6));
  }

  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على المستخدم');
  }

  if (!canActOn(ctx.from, target)) {
    return reply(ctx, '• لا يمكنك تنزيل رتبة هذا المستخدم');
  }

  const targetUser = ensureUser(target);

  targetUser.rank = 0;

  saveData();

  await actionMessage(
    ctx,
    target,
    'تم تنزيل رتبته إلى عضو'
  );
});

/* =======================================================
   كتم
======================================================= */

bot.hears(/^كتم$/i, async ctx => {
  if (!await checkCommandLock(ctx, 'كتم')) return;

  if (!requireRank(ctx, 2)) {
    return reply(ctx, adminOnlyMessage(2));
  }

  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على المستخدم');
  }

  if (!canActOn(ctx.from, target)) {
    return reply(ctx, '• لا يمكنك كتم هذا المستخدم');
  }

  if (await muteUser(ctx, target)) {
    const group = ensureGroup(ctx.chat.id);

    group.muted[String(target.id)] = {
      until: Date.now() + 10 * 60 * 1000
    };

    saveData();

    await actionMessage(
      ctx,
      target,
      'تم كتمه'
    );
  }
});

/* =======================================================
   فك الكتم
======================================================= */

bot.hears(/^فك الكتم$/i, async ctx => {
  if (!requireRank(ctx, 2)) {
    return reply(ctx, adminOnlyMessage(2));
  }

  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على المستخدم');
  }

  if (await unmuteUser(ctx, target)) {
    delete ensureGroup(ctx.chat.id).muted[String(target.id)];

    saveData();

    await actionMessage(
      ctx,
      target,
      'تم فك الكتم عنه'
    );
  }
});

/* =======================================================
   كتم عام
======================================================= */

bot.hears(/^كتم عام$/i, async ctx => {
  if (!requireRank(ctx, 3)) {
    return reply(ctx, adminOnlyMessage(3));
  }

  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على المستخدم');
  }

  if (!canActOn(ctx.from, target)) {
    return reply(ctx, '• لا يمكنك كتم هذا المستخدم');
  }

  if (await muteUser(ctx, target)) {
    const group = ensureGroup(ctx.chat.id);

    group.globalMuted[String(target.id)] = true;

    saveData();

    await actionMessage(
      ctx,
      target,
      'تم كتمه عام'
    );
  }
});

/* =======================================================
   فك الكتم العام
======================================================= */

bot.hears(/^فك الكتم العام$/i, async ctx => {
  if (!requireRank(ctx, 3)) {
    return reply(ctx, adminOnlyMessage(3));
  }

  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على المستخدم');
  }

  await unmuteUser(ctx, target);

  delete ensureGroup(ctx.chat.id).globalMuted[String(target.id)];

  saveData();

  await actionMessage(
    ctx,
    target,
    'تم فك الكتم العام عنه'
  );
});

/* =======================================================
   مم - مسح المكتومين
======================================================= */

bot.hears(/^مم$/i, async ctx => {
  if (!requireRank(ctx, 5)) {
    return reply(ctx, adminOnlyMessage(5));
  }

  const group = ensureGroup(ctx.chat.id);

  const ids = Object.keys(group.muted);

  if (!ids.length) {
    return reply(ctx, '• لا يوجد مكتومين');
  }

  let count = 0;

  for (const id of ids) {
    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        Number(id),
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
          can_add_web_page_previews: true
        }
      );

      delete group.muted[id];

      count++;
    } catch {}
  }

  saveData();

  await reply(
    ctx,
    `• تم مسح ( ${count} ) من المكتومين`
  );
});

/* =======================================================
   خخ - مسح المكتومين عام
======================================================= */

bot.hears(/^خخ$/i, async ctx => {
  if (!requireRank(ctx, 5)) {
    return reply(ctx, adminOnlyMessage(5));
  }

  const group = ensureGroup(ctx.chat.id);

  const ids = Object.keys(group.globalMuted);

  if (!ids.length) {
    return reply(ctx, '• لا يوجد مكتومين');
  }

  let count = 0;

  for (const id of ids) {
    try {
      await ctx.telegram.restrictChatMember(
        ctx.chat.id,
        Number(id),
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
          can_add_web_page_previews: true
        }
      );

      delete group.globalMuted[id];

      count++;
    } catch {}
  }

  saveData();

  await reply(
    ctx,
    `• تم مسح ( ${count} ) من المكتومين عام`
  );
});

/* =======================================================
   تقييد
======================================================= */

bot.hears(/^(تقييد|تق)$/i, async ctx => {
  if (!requireRank(ctx, 2)) {
    return reply(ctx, adminOnlyMessage(2));
  }

  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على المستخدم');
  }

  if (!canActOn(ctx.from, target)) {
    return reply(ctx, '• لا يمكنك تقييد هذا المستخدم');
  }

  if (await restrictUser(ctx, target)) {
    ensureGroup(ctx.chat.id).restricted[String(target.id)] = true;

    saveData();

    await actionMessage(
      ctx,
      target,
      'قيدته'
    );
  }
});

/* =======================================================
   الغاء التقييد
======================================================= */

bot.hears(/^(الغاء التقييد|رفع القيود)$/i, async ctx => {
  if (!requireRank(ctx, 2)) {
    return reply(ctx, adminOnlyMessage(2));
  }

  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على المستخدم');
  }

  if (await unrestrictUser(ctx, target)) {
    delete ensureGroup(ctx.chat.id).restricted[String(target.id)];

    saveData();

    await actionMessage(
      ctx,
      target,
      'تم إلغاء تقييده'
    );
  }
});

/* =======================================================
   مق - قائمة المقيدين
======================================================= */

bot.hears(/^مق$/i, async ctx => {
  if (!requireRank(ctx, 5)) {
    return reply(ctx, adminOnlyMessage(5));
  }

  const group = ensureGroup(ctx.chat.id);

  const ids = Object.keys(group.restricted);

  if (!ids.length) {
    return reply(ctx, '• لا يوجد مقيدين');
  }

  let text = '• المقيدين بالقروب :\n\n';

  ids.forEach((id, index) => {
    const u = data.users[id];

    text +=
      `${index + 1} ) ${u?.firstName || u?.username || id}\n`;
  });

  await reply(ctx, text);
});

/* =======================================================
   مسح المقيدين
======================================================= */

bot.hears(/^مسح المقيدين$/i, async ctx => {
  if (!requireRank(ctx, 5)) {
    return reply(ctx, adminOnlyMessage(5));
  }

  const group = ensureGroup(ctx.chat.id);

  const ids = Object.keys(group.restricted);

  if (!ids.length) {
    return reply(ctx, '• لا يوجد مقيدين');
  }

  let count = 0;

  for (const id of ids) {
    try {
      await unrestrictUser(ctx, {
        id: Number(id)
      });

      delete group.restricted[id];

      count++;
    } catch {}
  }

  saveData();

  await reply(
    ctx,
    `• تم مسح ( ${count} ) من المقيدين`
  );
});

/* =======================================================
   حظر
======================================================= */

bot.hears(/^حظر$/i, async ctx => {
  if (!requireRank(ctx, 3)) {
    return reply(ctx, adminOnlyMessage(3));
  }

  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على المستخدم');
  }

  if (!canActOn(ctx.from, target)) {
    return reply(ctx, '• لا يمكنك حظر هذا المستخدم');
  }

  if (await banUser(ctx, target)) {
    await actionMessage(
      ctx,
      target,
      'تم حظره'
    );
  }
});

/* =======================================================
   فك الحظر
======================================================= */

bot.hears(/^فك الحظر$/i, async ctx => {
  if (!requireRank(ctx, 3)) {
    return reply(ctx, adminOnlyMessage(3));
  }

  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على المستخدم');
  }

  if (await unbanUser(ctx, target)) {
    await actionMessage(
      ctx,
      target,
      'تم فك الحظر عنه'
    );
  }
});

/* =======================================================
   طرد
======================================================= */

bot.hears(/^طرد$/i, async ctx => {
  if (!requireRank(ctx, 3)) {
    return reply(ctx, adminOnlyMessage(3));
  }

  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على المستخدم');
  }

  if (!canActOn(ctx.from, target)) {
    return reply(ctx, '• لا يمكنك طرد هذا المستخدم');
  }

  if (await kickUser(ctx, target)) {
    await actionMessage(
      ctx,
      target,
      'تم طرده'
    );
  }
});

/* =======================================================
   التحذيرات
======================================================= */

async function warnCommand(ctx) {
  if (!requireRank(ctx, 2)) {
    return reply(ctx, adminOnlyMessage(2));
  }

  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على المستخدم');
  }

  if (!canActOn(ctx.from, target)) {
    return reply(ctx, '• لا يمكنك تحذير هذا المستخدم');
  }

  const group = ensureGroup(ctx.chat.id);

  const count = addWarning(
    group,
    target,
    'تحذير إداري'
  );

  saveData();

  await actionMessage(
    ctx,
    target,
    `تم تحذيره (${count})`
  );

  if (
    count >= group.protection.warningLimit &&
    group.protection.autoMute
  ) {
    await muteUser(ctx, target);

    await actionMessage(
      ctx,
      target,
      'تم كتمه بسبب وصول التحذيرات للحد'
    );
  }
}

bot.hears(/^(تحذير|انذار|إنذار)$/i, warnCommand);

/* =======================================================
   إلغاء التحذير
======================================================= */

bot.hears(/^(إلغاء التحذير|الغاء التحذير)$/i, async ctx => {
  if (!requireRank(ctx, 2)) {
    return reply(ctx, adminOnlyMessage(2));
  }

  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على المستخدم');
  }

  const group = ensureGroup(ctx.chat.id);

  const w = getWarnings(group, target.id);

  if (w.count > 0) {
    w.count -= 1;

    if (w.reasons.length) {
      w.reasons.pop();
    }
  }

  saveData();

  await actionMessage(
    ctx,
    target,
    'تم إلغاء تحذير منه'
  );
});

/* =======================================================
   فتح / غلق المخالفات
======================================================= */

bot.hears(/^فتح المخالفات$/i, async ctx => {
  if (!requireRank(ctx, 7)) {
    return reply(ctx, adminOnlyMessage(7));
  }

  ensureGroup(ctx.chat.id).protection.violations = true;

  saveData();

  await reply(ctx, '• تم فتح نظام المخالفات');
});

bot.hears(/^(غلق المخالفات|قفل المخالفات)$/i, async ctx => {
  if (!requireRank(ctx, 7)) {
    return reply(ctx, adminOnlyMessage(7));
  }

  ensureGroup(ctx.chat.id).protection.violations = false;

  saveData();

  await reply(ctx, '• تم غلق نظام المخالفات');
});

/* =======================================================
   حالة الحماية
======================================================= */

bot.hears(/^حالة الحماية$/i, async ctx => {
  if (!requireRank(ctx, 5)) {
    return reply(ctx, adminOnlyMessage(5));
  }

  const p = ensureGroup(ctx.chat.id).protection;

  await reply(
    ctx,
    `• حالة الحماية\n\n` +
    `المخالفات ↤ ${p.violations ? 'مفتوحة' : 'مغلقة'}\n` +
    `الروابط ↤ ${p.links ? 'مفتوحة' : 'مغلقة'}\n` +
    `المنشن ↤ ${p.mentions ? 'مفتوح' : 'مغلق'}\n` +
    `السبام ↤ ${p.spam ? 'مفتوح' : 'مغلق'}\n` +
    `الإعلانات ↤ ${p.ads ? 'مفتوحة' : 'مغلقة'}\n` +
    `الفوروارد ↤ ${p.forwards ? 'مفتوح' : 'مغلق'}\n` +
    `الرسائل الطويلة ↤ ${p.longMessages ? 'مفتوحة' : 'مغلقة'}\n` +
    `أرقام الجوال ↤ ${p.phoneNumbers ? 'مفتوحة' : 'مغلقة'}\n` +
    `الكلمات الممنوعة ↤ ${p.forbiddenWords.length}`
  );
});

/* =======================================================
   الروابط
======================================================= */

bot.hears(/^فتح الروابط$/i, async ctx => {
  if (!requireRank(ctx, 7)) {
    return reply(ctx, adminOnlyMessage(7));
  }

  ensureGroup(ctx.chat.id).protection.links = true;

  saveData();

  await reply(ctx, '• تم فتح حماية الروابط');
});

bot.hears(/^قفل الروابط$/i, async ctx => {
  if (!requireRank(ctx, 7)) {
    return reply(ctx, adminOnlyMessage(7));
  }

  ensureGroup(ctx.chat.id).protection.links = false;

  saveData();

  await reply(ctx, '• تم قفل حماية الروابط');
});

/* =======================================================
   المنشن
======================================================= */

bot.hears(/^فتح المنشن$/i, async ctx => {
  if (!requireRank(ctx, 7)) {
    return reply(ctx, adminOnlyMessage(7));
  }

  ensureGroup(ctx.chat.id).protection.mentions = true;

  saveData();

  await reply(ctx, '• تم فتح حماية المنشن');
});

bot.hears(/^غلق المنشن$/i, async ctx => {
  if (!requireRank(ctx, 7)) {
    return reply(ctx, adminOnlyMessage(7));
  }

  ensureGroup(ctx.chat.id).protection.mentions = false;

  saveData();

  await reply(ctx, '• تم غلق حماية المنشن');
});

/* =======================================================
   الكلمات الممنوعة
======================================================= */

bot.hears(/^(منع الكلمه|منع الكلمة)\s+(.+)$/i, async ctx => {
  if (!requireRank(ctx, 6)) {
    return reply(ctx, adminOnlyMessage(6));
  }

  const match =
    ctx.message.text.match(
      /^(?:منع الكلمه|منع الكلمة)\s+(.+)$/i
    );

  const word = match?.[1]?.trim();

  if (!word) {
    return reply(ctx, '• اكتب الكلمة بعد الأمر');
  }

  const group = ensureGroup(ctx.chat.id);

  if (
    group.protection.forbiddenWords.some(
      x => normalize(x) === normalize(word)
    )
  ) {
    return reply(ctx, '• الكلمة موجودة مسبقًا');
  }

  group.protection.forbiddenWords.push(word);

  saveData();

  await reply(
    ctx,
    `• تم منع الكلمة ↤ ${word}`
  );
});

/* =======================================================
   إلغاء منع كلمة
======================================================= */

bot.hears(/^(الغاء منع الكلمه|الغاء منع الكلمة)\s+(.+)$/i, async ctx => {
  if (!requireRank(ctx, 6)) {
    return reply(ctx, adminOnlyMessage(6));
  }

  const match =
    ctx.message.text.match(
      /^(?:الغاء منع الكلمه|الغاء منع الكلمة)\s+(.+)$/i
    );

  const word = match?.[1]?.trim();

  const group = ensureGroup(ctx.chat.id);

  group.protection.forbiddenWords =
    group.protection.forbiddenWords.filter(
      x => normalize(x) !== normalize(word)
    );

  saveData();

  await reply(
    ctx,
    `• تم إلغاء منع الكلمة ↤ ${word}`
  );
});

/* =======================================================
   عرض الكلمات
======================================================= */

bot.hears(/^(الكلمات الممنوعه|الكلمات الممنوعة)$/i, async ctx => {
  const group = ensureGroup(ctx.chat.id);

  if (!group.protection.forbiddenWords.length) {
    return reply(ctx, '• لا توجد كلمات ممنوعة');
  }

  await reply(
    ctx,
    `• الكلمات الممنوعة:\n\n` +
    group.protection.forbiddenWords
      .map((x, i) => `${i + 1} ) ${x}`)
      .join('\n')
  );
});

/* =======================================================
   مسح الكلمات
======================================================= */

bot.hears(/^مسح الكلمات الممنوعه$/i, async ctx => {
  if (!requireRank(ctx, 6)) {
    return reply(ctx, adminOnlyMessage(6));
  }

  ensureGroup(ctx.chat.id).protection.forbiddenWords = [];

  saveData();

  await reply(ctx, '• تم مسح الكلمات الممنوعة');
});

/* =======================================================
   قفل أمر
======================================================= */

const lockSessions = new Map();

bot.hears(/^قفل امر$/i, async ctx => {
  if (!requireRank(ctx, 7)) {
    return reply(ctx, adminOnlyMessage(7));
  }

  lockSessions.set(
    String(ctx.from.id),
    {
      step: 'command',
      chatId: ctx.chat.id
    }
  );

  await reply(
    ctx,
    '• حسنًا عزيزي قم بإرسال الامر الان :'
  );
});

/* =======================================================
   فتح أمر
======================================================= */

bot.hears(/^فتح امر$/i, async ctx => {
  if (!requireRank(ctx, 7)) {
    return reply(ctx, adminOnlyMessage(7));
  }

  lockSessions.set(
    String(ctx.from.id),
    {
      step: 'unlockCommand',
      chatId: ctx.chat.id
    }
  );

  await reply(
    ctx,
    '• ارسل الامر الذي تريد فتحه'
  );
});

/* =======================================================
   جلسة قفل/فتح الأمر
======================================================= */

bot.on('text', async ctx => {
  if (!ctx.chat || !ctx.from) return;

  const key = String(ctx.from.id);

  const session = lockSessions.get(key);

  if (!session) return;

  if (session.chatId !== ctx.chat.id) return;

  const text = ctx.message.text.trim();

  /*
    قفل أمر - الخطوة الأولى
  */

  if (session.step === 'command') {
    session.command = commandKey(text);
    session.step = 'rank';

    lockSessions.set(key, session);

    return reply(
      ctx,
      '• حسنًا عزيزي قم بإرسال الرتبة الان :'
    );
  }

  /*
    قفل أمر - الخطوة الثانية
  */

  if (session.step === 'rank') {
    const rank = parseRank(text);

    if (rank === null) {
      return reply(
        ctx,
        '• الرتبة غير صحيحة\n• مثال: مميز أو مالك أو Myth أو My أو Dev²'
      );
    }

    const group = ensureGroup(ctx.chat.id);

    group.commandLocks[session.command] = rank;

    lockSessions.delete(key);

    saveData();

    return reply(
      ctx,
      `• تم قفل الامر ↤ ${session.command}\n` +
      `• من رتبة ↤ ${rankName(rank)} فأعلى`
    );
  }

  /*
    فتح أمر
  */

  if (session.step === 'unlockCommand') {
    const command = commandKey(text);

    const group = ensureGroup(ctx.chat.id);

    delete group.commandLocks[command];

    lockSessions.delete(key);

    saveData();

    return reply(
      ctx,
      `• تم فتح الامر ↤ ${command}`
    );
  }
});

/* =======================================================
   إضافة أمر مخصص
======================================================= */

const customCommandSessions = new Map();

bot.hears(/^(اضف امر|أضف أمر)$/i, async ctx => {
  if (!requireRank(ctx, 6)) {
    return reply(ctx, adminOnlyMessage(6));
  }

  customCommandSessions.set(
    String(ctx.from.id),
    {
      chatId: ctx.chat.id,
      step: 'old'
    }
  );

  await reply(
    ctx,
    '• ارسل الامر القديم'
  );
});

/* =======================================================
   إضافة أمر - متابعة
======================================================= */

bot.on('text', async ctx => {
  if (!ctx.chat || !ctx.from) return;

  const key = String(ctx.from.id);
  const session = customCommandSessions.get(key);

  if (!session) return;

  if (session.chatId !== ctx.chat.id) return;

  const text = ctx.message.text.trim();

  if (session.step === 'old') {
    session.oldCommand = commandKey(text);
    session.step = 'new';

    customCommandSessions.set(key, session);

    return reply(
      ctx,
      '• ارسل الامر الجديد عشان احطه مكان القديم'
    );
  }

  if (session.step === 'new') {
    const newCommand = text;

    const group = ensureGroup(ctx.chat.id);

    group.customCommands[normalize(newCommand)] = {
      name: newCommand,
      target: session.oldCommand,
      createdBy: ctx.from.id,
      createdAt: Date.now()
    };

    customCommandSessions.delete(key);

    saveData();

    return reply(
      ctx,
      `• تم حفظ الامر باسم ↤︎ ( ${newCommand} )`
    );
  }
});

/* =======================================================
   تشغيل الأمر المخصص
======================================================= */

bot.on('text', async ctx => {
  if (!ctx.chat || !ctx.from) return;

  const group = ensureGroup(ctx.chat.id);

  const text = ctx.message.text.trim();

  const custom =
    group.customCommands[normalize(text)];

  if (!custom) return;

  const target = custom.target;

  /*
    نحاكي الأوامر الأساسية.
  */

  if (target === 'كتم') {
    if (!requireRank(ctx, 2)) {
      return reply(ctx, adminOnlyMessage(2));
    }

    const user = getTarget(ctx);

    if (!user) {
      return reply(ctx, '• قم بالرد على المستخدم');
    }

    if (!canActOn(ctx.from, user)) {
      return reply(ctx, '• لا يمكنك كتم هذا المستخدم');
    }

    if (await muteUser(ctx, user)) {
      group.muted[String(user.id)] = {
        until: Date.now() + 600000
      };

      saveData();

      return actionMessage(
        ctx,
        user,
        'تم كتمه'
      );
    }

    return;
  }

  /*
    إذا كان الأمر القديم أمرًا آخر،
    يتم تنبيه المستخدم إلى أن الأمر المحفوظ
    مربوط بالأمر القديم.
  */

  return reply(
    ctx,
    `• الامر ↤ ( ${custom.name} )\n` +
    `• مربوط بالامر ↤ ${custom.target}`
  );
});

/* =======================================================
   إضافة رد
======================================================= */

const replySessions = new Map();

bot.hears(/^(اضف رد|أضف رد)$/i, async ctx => {
  if (!requireRank(ctx, 6)) {
    return reply(ctx, adminOnlyMessage(6));
  }

  replySessions.set(
    String(ctx.from.id),
    {
      chatId: ctx.chat.id,
      step: 'trigger'
    }
  );

  await reply(
    ctx,
    '• ارسل الكلمة أو العبارة'
  );
});

/* =======================================================
   متابعة إضافة الرد
======================================================= */

bot.on('text', async ctx => {
  if (!ctx.chat || !ctx.from) return;

  const key = String(ctx.from.id);

  const session = replySessions.get(key);

  if (!session) return;

  if (session.chatId !== ctx.chat.id) return;

  const text = ctx.message.text.trim();

  if (session.step === 'trigger') {
    session.trigger = text;
    session.step = 'response';

    replySessions.set(key, session);

    return reply(
      ctx,
      '• ارسل الرد'
    );
  }

  if (session.step === 'response') {
    const group = ensureGroup(ctx.chat.id);

    group.customReplies[normalize(session.trigger)] = {
      trigger: session.trigger,
      response: text,
      createdBy: ctx.from.id,
      createdAt: Date.now()
    };

    replySessions.delete(key);

    saveData();

    return reply(
      ctx,
      `• تم حفظ الرد باسم ↤︎ ( ${session.trigger} )`
    );
  }
});

/* =======================================================
   تشغيل الردود المخصصة
======================================================= */

bot.on('text', async ctx => {
  if (!ctx.chat || !ctx.from) return;

  const group = ensureGroup(ctx.chat.id);

  if (!data.global.repliesEnabled) {
    return;
  }

  const text = ctx.message.text.trim();

  const custom =
    group.customReplies[normalize(text)];

  if (!custom) return;

  await reply(
    ctx,
    custom.response
  );
});

/* =======================================================
   الهمسة
======================================================= */

bot.hears(/^(اهمس|همسه|ه)$/i, async ctx => {
  const target = getTarget(ctx);

  if (!target) {
    return reply(
      ctx,
      '• لازم ترد على الشخص أولًا عشان ترسل همسة'
    );
  }

  const id =
    `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  data.whispers[id] = {
    from: ctx.from.id,
    fromName: ctx.from.first_name || '',
    to: target.id,
    toName: target.first_name || '',
    content: '',
    viewed: false,
    createdAt: Date.now()
  };

  saveData();

  await reply(
    ctx,
    `• تم تجهيز الهمسة لـ ${mentionUser(target)}\n\n` +
    `• أرسل محتوى الهمسة الآن في الخاص مع البوت.`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            'اهمس هنا',
            `https://t.me/${ctx.botInfo.username}?start=whisper_${id}`
          )
        ]
      ])
    }
  );
});

/* =======================================================
   البحث عن أغنية
======================================================= */

bot.hears(/^(بحث|بحث أغنية|بحث اغنية|اغنية|أغنية|شغل|تشغيل)(?:\s+(.+))?$/i, async ctx => {
  const match =
    ctx.message.text.match(
      /^(?:بحث|بحث أغنية|بحث اغنية|اغنية|أغنية|شغل|تشغيل)(?:\s+(.+))?$/i
    );

  const query = match?.[1]?.trim();

  if (!query) {
    return reply(
      ctx,
      '• اكتب اسم الأغنية بعد الأمر'
    );
  }

  /*
    لا ندعي تشغيلًا حقيقيًا في المكالمة الصوتية
    باستخدام Bot API وحده.
  */

  await reply(
    ctx,
    `• بحث الأغاني\n\n` +
    `• البحث ↤ ${query}\n\n` +
    `• يدعم البوت البحث وتجهيز الاختيار، أما تشغيل الصوت داخل المكالمة فيحتاج نظام Voice/MTProto منفصل.`
  );
});

/* =======================================================
   الألعاب
======================================================= */

bot.hears(/^قفل الالعاب$/i, async ctx => {
  if (!requireRank(ctx, 7)) {
    return reply(ctx, adminOnlyMessage(7));
  }

  ensureGroup(ctx.chat.id).gamesLocked = true;

  saveData();

  await reply(ctx, '• تم قفل الألعاب');
});

bot.hears(/^فتح الالعاب$/i, async ctx => {
  if (!requireRank(ctx, 7)) {
    return reply(ctx, adminOnlyMessage(7));
  }

  ensureGroup(ctx.chat.id).gamesLocked = false;

  saveData();

  await reply(ctx, '• تم فتح الألعاب');
});

/* =======================================================
   الاقتصاد
======================================================= */

bot.hears(/^فلوسي$/i, async ctx => {
  const user = ensureUser(ctx.from);

  await reply(
    ctx,
    `• رصيدك ↤ ${Number(user.money || 0).toLocaleString()} ريال`
  );
});

bot.hears(/^فلوسه$/i, async ctx => {
  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على المستخدم');
  }

  const user = ensureUser(target);

  await reply(
    ctx,
    `• رصيد ${target.first_name || 'المستخدم'} ↤ ${Number(user.money || 0).toLocaleString()} ريال`
  );
});

bot.hears(/^حسابي$/i, async ctx => {
  const user = ensureUser(ctx.from);

  await reply(
    ctx,
    `• حسابك البنكي\n\n` +
    `• الاسم ↤ ${ctx.from.first_name || ''}\n` +
    `• الرصيد ↤ ${Number(user.money || 0).toLocaleString()} ريال`
  );
});

bot.hears(/^المتجر$/i, async ctx => {
  await reply(
    ctx,
    `• المتجر\n\n` +
    `• المتجر الأساسي تحت التطوير`
  );
});

/* =======================================================
   تنظيف
======================================================= */

bot.hears(/^تنظيف(?:\s+(\d+))?$/i, async ctx => {
  if (!requireRank(ctx, 5)) {
    return reply(ctx, adminOnlyMessage(5));
  }

  if (!await botCan(ctx, 'delete')) {
    return reply(ctx, '• البوت يحتاج صلاحية حذف الرسائل');
  }

  const match =
    ctx.message.text.match(/^تنظيف(?:\s+(\d+))?$/i);

  let amount =
    Number(match?.[1] || 10);

  amount = Math.max(1, Math.min(amount, 100));

  let count = 0;

  for (
    let i = 0;
    i < amount;
    i++
  ) {
    try {
      await ctx.telegram.deleteMessage(
        ctx.chat.id,
        ctx.message.message_id - i
      );

      count++;
    } catch {}
  }

  try {
    await ctx.telegram.sendMessage(
      ctx.chat.id,
      `• تم تنظيف ( ${count} ) رسالة`
    );
  } catch {}
});

/* =======================================================
   رفع مشرف
======================================================= */

bot.hears(/^(رفع مشرف|ترقيه)$/i, async ctx => {
  if (!isOwner(ctx.from)) {
    return reply(ctx, adminOnlyMessage(7));
  }

  if (!await botCan(ctx, 'promote')) {
    return reply(
      ctx,
      '• البوت يحتاج صلاحية إضافة المشرفين'
    );
  }

  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على المستخدم');
  }

  if (isOwner(target)) {
    return reply(ctx, '• المستخدم هو المالك الأساسي');
  }

  try {
    await ctx.telegram.promoteChatMember(
      ctx.chat.id,
      target.id,
      {
        can_manage_chat: false,
        can_delete_messages: true,
        can_manage_video_chats: true,
        can_restrict_members: true,
        can_promote_members: false,
        can_change_info: false,
        can_invite_users: true,
        can_pin_messages: true,
        can_manage_topics: true
      }
    );

    await actionMessage(
      ctx,
      target,
      'تم رفعه مشرف'
    );
  } catch (err) {
    console.error('promote:', err.message);

    await reply(
      ctx,
      '• تعذر رفعه مشرف، تأكدي من صلاحيات البوت'
    );
  }
});

/* =======================================================
   تنزيل مشرف
======================================================= */

bot.hears(/^(تنزيل مشرف|تنزيل المشرف)$/i, async ctx => {
  if (!isOwner(ctx.from)) {
    return reply(ctx, adminOnlyMessage(7));
  }

  if (!await botCan(ctx, 'promote')) {
    return reply(
      ctx,
      '• البوت يحتاج صلاحية إدارة المشرفين'
    );
  }

  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على المشرف');
  }

  if (isOwner(target)) {
    return reply(ctx, '• لا يمكن تنزيل المالك الأساسي');
  }

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

    await actionMessage(
      ctx,
      target,
      'تم تنزيله من الإشراف'
    );
  } catch (err) {
    console.error('demote:', err.message);

    await reply(
      ctx,
      '• تعذر تنزيل المشرف'
    );
  }
});

/* =======================================================
   صلاحياتي
======================================================= */

bot.hears(/^صلاحياتي$/i, async ctx => {
  const member = await getBotMember(ctx);

  if (!member) {
    return reply(ctx, '• تعذر معرفة صلاحيات البوت');
  }

  if (member.status !== 'administrator') {
    return reply(ctx, '• البوت ليس مشرفًا');
  }

  await reply(
    ctx,
    `• صلاحيات البوت\n\n` +
    `حذف الرسائل ↤ ${member.can_delete_messages ? 'نعم' : 'لا'}\n` +
    `تقييد الأعضاء ↤ ${member.can_restrict_members ? 'نعم' : 'لا'}\n` +
    `ترقية المشرفين ↤ ${member.can_promote_members ? 'نعم' : 'لا'}\n` +
    `إدارة المكالمات ↤ ${member.can_manage_video_chats ? 'نعم' : 'لا'}\n` +
    `تثبيت الرسائل ↤ ${member.can_pin_messages ? 'نعم' : 'لا'}`
  );
});

/* =======================================================
   صلاحياته
======================================================= */

bot.hears(/^صلاحياته$/i, async ctx => {
  const target = getTarget(ctx);

  if (!target) {
    return reply(ctx, '• قم بالرد على المستخدم');
  }

  try {
    const member =
      await ctx.telegram.getChatMember(
        ctx.chat.id,
        target.id
      );

    if (member.status !== 'administrator') {
      return reply(
        ctx,
        `• ${target.first_name || 'المستخدم'} ليس مشرفًا`
      );
    }

    await reply(
      ctx,
      `• صلاحيات ${target.first_name || 'المستخدم'}\n\n` +
      `حذف ↤ ${member.can_delete_messages ? 'نعم' : 'لا'}\n` +
      `تقييد ↤ ${member.can_restrict_members ? 'نعم' : 'لا'}\n` +
      `ترقية ↤ ${member.can_promote_members ? 'نعم' : 'لا'}\n` +
      `تغيير المعلومات ↤ ${member.can_change_info ? 'نعم' : 'لا'}\n` +
      `دعوة ↤ ${member.can_invite_users ? 'نعم' : 'لا'}\n` +
      `تثبيت ↤ ${member.can_pin_messages ? 'نعم' : 'لا'}`
    );
  } catch {
    await reply(ctx, '• تعذر معرفة صلاحيات المستخدم');
  }
});

/* =======================================================
   دعوة
======================================================= */

bot.hears(/^دعوة$/i, async ctx => {
  const username =
    ctx.botInfo?.username;

  if (!username) {
    return reply(ctx, '• تعذر إنشاء رابط البوت');
  }

  await reply(
    ctx,
    '• اضغط الزر لإضافة البوت إلى مجموعتك',
    Markup.inlineKeyboard([
      [
        Markup.button.url(
          'اضفني إلى مجموعتك',
          `https://t.me/${username}?startgroup=true`
        )
      ]
    ])
  );
});

/* =======================================================
   المكالمة الصوتية
======================================================= */

bot.hears(/^(بدأت المكالمه الصوتيه|بدأت المكالمة الصوتية)$/i, async ctx => {
  await reply(
    ctx,
    '• بدأت المكالمه الصوتيه'
  );
});

bot.hears(/^(انتهت المكالمه الصوتيه|انتهت المكالمة الصوتية)$/i, async ctx => {
  await reply(
    ctx,
    '• انتهت المكالمه الصوتيه'
  );
});

/* =======================================================
   تحديثات المكالمات الصوتية
======================================================= */

bot.on('message', async ctx => {
  const msg = ctx.message;

  if (!msg || !ctx.chat) return;

  if (msg.video_chat_started) {
    try {
      await ctx.telegram.sendMessage(
        ctx.chat.id,
        '• بدأت المكالمه الصوتيه'
      );
    } catch {}
  }

  if (msg.video_chat_ended) {
    try {
      await ctx.telegram.sendMessage(
        ctx.chat.id,
        '• انتهت المكالمه الصوتيه'
      );
    } catch {}
  }
});

/* =======================================================
   الحماية من المكتومين
======================================================= */

bot.on('message', async ctx => {
  if (!ctx.chat || ctx.chat.type === 'private') {
    return;
  }

  if (!ctx.from) return;

  const group = ensureGroup(ctx.chat.id);

  const id = String(ctx.from.id);

  /*
    إذا كان مكتومًا أو مقيدًا، نحذف رسالته
    إذا كانت صلاحية الحذف متاحة.
  */

  if (
    group.muted[id] ||
    group.globalMuted[id]
  ) {
    if (await botCan(ctx, 'delete')) {
      try {
        await ctx.deleteMessage();
      } catch {}
    }
  }
});

/* =======================================================
   حفظ المستخدم عند كل رسالة خاصة
======================================================= */

bot.on('message', async ctx => {
  if (ctx.chat?.type === 'private' && ctx.from) {
    ensureUser(ctx.from);
    addSubscriber(ctx.from.id);
    saveData();
  }
});

/* =======================================================
   أخطاء
======================================================= */

bot.catch((err, ctx) => {
  console.error(
    'BOT ERROR:',
    err?.message || err
  );
});

/* =======================================================
   تشغيل البوت
======================================================= */

(async () => {
  try {
    await bot.launch();

    console.log('================================');
    console.log('BOT STARTED SUCCESSFULLY');
    console.log('Owner:', `@${OWNER_USERNAME}`);
    console.log('================================');
  } catch (err) {
    console.error(
      'فشل تشغيل البوت:',
      err
    );
  }
})();

/* =======================================================
   إيقاف آمن
======================================================= */

process.once(
  'SIGINT',
  () => bot.stop('SIGINT')
);

process.once(
  'SIGTERM',
  () => bot.stop('SIGTERM')
);
