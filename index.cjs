'use strict';
/* ==========================================================================
   بوت تيليجرام كامل لإدارة المجموعات - ملف واحد شامل
   Node.js + Telegraf
   ========================================================================== */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('خطأ: يجب ضبط BOT_TOKEN في ملف .env قبل التشغيل.');
  process.exit(1);
}

const DEV_ID = process.env.DEV_ID ? String(process.env.DEV_ID) : null;
const DEV_USERNAME = (process.env.DEV_USERNAME || 'j4xa7').replace('@', '');

const bot = new Telegraf(BOT_TOKEN);

/* ==========================================================================
   1) طبقة حفظ البيانات (JSON على القرص - Atomic Write)
   ========================================================================== */

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const GROUPS_DIR = path.join(DATA_DIR, 'groups');
const GLOBAL_FILE = path.join(DATA_DIR, 'global.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(GROUPS_DIR)) fs.mkdirSync(GROUPS_DIR, { recursive: true });

function writeJsonAtomic(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error('خطأ في قراءة ملف البيانات:', filePath, e.message);
    return fallback;
  }
}

function deepMergeDefaults(defaults, current) {
  if (Array.isArray(defaults)) return Array.isArray(current) ? current : defaults;
  if (defaults !== null && typeof defaults === 'object') {
    const out = {};
    const keys = new Set([...Object.keys(defaults), ...Object.keys(current || {})]);
    for (const k of keys) {
      if (current && Object.prototype.hasOwnProperty.call(current, k)) {
        if (defaults[k] !== null && typeof defaults[k] === 'object' && !Array.isArray(defaults[k])) {
          out[k] = deepMergeDefaults(defaults[k], current[k]);
        } else {
          out[k] = current[k];
        }
      } else {
        out[k] = defaults[k];
      }
    }
    return out;
  }
  return current !== undefined ? current : defaults;
}

function defaultGroupData() {
  return {
    roles: {},
    stats: {},               // userId: { messages, violations, gamePoints, gameWins }
    titles: {},
    muted: [],                // من كتمهم البوت فعليًا عبر restrictChatMember
    globalMuted: [],          // "كتم عام" على مستوى البوت (حذف رسائلهم دون تقييد تيليجرام)
    money: {},
    activeGames: {},
    warnings: {},
    violationsLog: {},
    violationsSettings: {
      enabled: false,
      autoProtection: false,
      links: false, edit: false, spam: false, ads: false, mention: false,
      forward: false, photo: false, video: false, file: false, sticker: false,
      gif: false, audio: false, contact: false, commands: false, badwords: false,
      english: false, crossGroupReply: false, longMessages: false,
      badwordsList: [], longMessageLimit: 1500
    },
    marriages: {},
    customCommands: {},
    customCommandsEnabled: true,
    commandLocks: {},
    pendingLock: {},          // userId -> commandKey
    pendingReply: {},         // userId -> { whisperId }
    settings: {
      bankEnabled: true,
      statsEnabled: true,
      botRepliesEnabled: true,
      communicationEnabled: true,
      forceSubEnabled: false,
      forceSubChannel: null,
      serviceBotEnabled: false,
      formattingEnabled: true,
      zajelEnabled: true,
      antiEditExemptRoles: ['مالك المجموعه', 'مالك اساسي', 'مالك', 'منشئ اساسي', 'منشئ', 'مدير', 'ادمن'],
      warnLimit: 3,
      warnPunishment: 'mute',
      defaultGameReward: 10
    },
    createdAt: Date.now()
  };
}

function defaultGlobalData() {
  return {
    whispers: {},
    pendingWhispers: {},
    pendingReplies: {},
    developer: { membersLimitOverride: null },
    forceSub: { enabled: false, channel: process.env.FORCE_SUB_CHANNEL || null }
  };
}

const groupCache = new Map();
let globalCacheData = null;

function groupFile(chatId) { return path.join(GROUPS_DIR, `${chatId}.json`); }

function getGroup(chatId) {
  const key = String(chatId);
  if (groupCache.has(key)) return groupCache.get(key);
  const data = readJsonSafe(groupFile(key), null) || defaultGroupData();
  const merged = deepMergeDefaults(defaultGroupData(), data);
  groupCache.set(key, merged);
  return merged;
}

function saveGroup(chatId) {
  const key = String(chatId);
  const data = groupCache.get(key);
  if (!data) return;
  writeJsonAtomic(groupFile(key), data);
}

function getGlobal() {
  if (globalCacheData) return globalCacheData;
  const data = readJsonSafe(GLOBAL_FILE, null) || defaultGlobalData();
  globalCacheData = deepMergeDefaults(defaultGlobalData(), data);
  return globalCacheData;
}

function saveGlobalData() {
  if (!globalCacheData) return;
  writeJsonAtomic(GLOBAL_FILE, globalCacheData);
}

/* ==========================================================================
   2) نظام الرتب الهرمي
   ========================================================================== */

const RANKS = [
  'مالك المجموعه', 'مالك اساسي', 'مالك', 'منشئ اساسي',
  'منشئ', 'مدير', 'ادمن', 'مميز', 'عضو'
];
const RANK_INDEX = {};
RANKS.forEach((r, i) => { RANK_INDEX[r] = i; });

function isValidRank(name) { return RANK_INDEX[name] !== undefined; }
function rankIndex(name) { return isValidRank(name) ? RANK_INDEX[name] : RANKS.length - 1; }
function isHigherOrEqual(a, b) { return rankIndex(a) <= rankIndex(b); }
function isStrictlyHigher(a, b) { return rankIndex(a) < rankIndex(b); }
function canActOn(actingRank, targetRank) { return isStrictlyHigher(actingRank, targetRank); }

async function getUserRole(ctx, groupData, userId) {
  try {
    const member = await ctx.telegram.getChatMember(ctx.chat.id, userId);
    if (member && member.status === 'creator') return 'مالك المجموعه';
    const custom = groupData.roles[String(userId)];
    if (custom && isValidRank(custom)) return custom;
    if (member && member.status === 'administrator') return 'ادمن';
    return 'عضو';
  } catch (e) {
    const custom = groupData.roles[String(userId)];
    if (custom && isValidRank(custom)) return custom;
    return 'عضو';
  }
}

function setUserRole(groupData, userId, rank) {
  if (!isValidRank(rank)) return false;
  groupData.roles[String(userId)] = rank;
  return true;
}

function isDeveloper(ctx) {
  const from = ctx.from;
  if (!from) return false;
  if (DEV_ID && String(from.id) === DEV_ID) return true;
  if (from.username && from.username.toLowerCase() === DEV_USERNAME.toLowerCase()) return true;
  return false;
}

/* ==========================================================================
   3) سجل الأوامر القابلة للقفل بالرتبة
   ========================================================================== */

const COMMANDS = {
  activate_fun:    { name: 'تفعيل التسليه', defaultRank: 'مدير' },
  games_menu:      { name: 'الألعاب', defaultRank: 'عضو' },
  play_game:       { name: 'لعبة', defaultRank: 'عضو' },
  start_game:      { name: 'ابدأ لعبة', defaultRank: 'عضو' },
  cancel_game:     { name: 'إلغاء اللعبة', defaultRank: 'مميز' },
  leaderboard:     { name: 'المتصدرين', defaultRank: 'عضو' },
  my_points:       { name: 'نقاطي', defaultRank: 'عضو' },
  ranking:         { name: 'الترتيب', defaultRank: 'عضو' },
  challenge:       { name: 'تحدي', defaultRank: 'عضو' },
  winners:         { name: 'الفائزين', defaultRank: 'عضو' },
  bank:            { name: 'البنك', defaultRank: 'عضو' },
  transfer:        { name: 'تحويل', defaultRank: 'عضو' },
  whispers:        { name: 'الهمسات', defaultRank: 'عضو' },
  cleanup:         { name: 'التنظيف', defaultRank: 'ادمن' },
  stats:           { name: 'الإحصائيات', defaultRank: 'عضو' },
  events:          { name: 'الفعاليات', defaultRank: 'مميز' },
  search_song:     { name: 'بحث', defaultRank: 'عضو' },
  play_song:       { name: 'تشغيل', defaultRank: 'عضو' },
  protection_toggle:{ name: 'الحماية', defaultRank: 'مالك' },
  warn_cmd:        { name: 'تحذير', defaultRank: 'ادمن' },
  ban_cmd:         { name: 'حظر', defaultRank: 'مدير' },
  mute_cmd:        { name: 'كتم', defaultRank: 'ادمن' },
  custom_commands: { name: 'الردود المخصصة', defaultRank: 'مدير' }
};

function findCommandByDisplayName(name) {
  const clean = name.trim();
  for (const [key, def] of Object.entries(COMMANDS)) if (def.name === clean) return key;
  return null;
}
function getCommandDefaultRank(key) { return COMMANDS[key] ? COMMANDS[key].defaultRank : 'عضو'; }
function getCommandDisplayName(key) { return COMMANDS[key] ? COMMANDS[key].name : key; }
function requiredRankFor(groupData, key) { return groupData.commandLocks[key] || getCommandDefaultRank(key); }

async function checkAllowed(ctx, groupData, commandKey) {
  const required = requiredRankFor(groupData, commandKey);
  const role = await getUserRole(ctx, groupData, ctx.from.id);
  return isHigherOrEqual(role, required);
}

/* ==========================================================================
   4) أدوات مساعدة عامة
   ========================================================================== */

function isGroupChat(ctx) {
  return ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup');
}

function mentionHtml(user) {
  const name = escapeHtml(user.first_name || 'مستخدم');
  return `<a href="tg://user?id=${user.id}">${name}</a>`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * محاولة استخراج المستخدم الهدف من رسالة (رد أو text_mention).
 * ملاحظة: تيليجرام Bot API لا يسمح بحل @username إلى ID مباشرة إلا عبر
 * كيان text_mention (يظهر فقط عند منشن مستخدم بدون يوزرنيم عبر تطبيقات تيليجرام)
 * أو عبر الرد على رسالته. لذلك ننصح دائمًا بالرد على رسالة العضو لأفضل دقة.
 */
function resolveTargetUser(ctx) {
  const msg = ctx.message;
  if (msg && msg.reply_to_message && msg.reply_to_message.from) {
    return msg.reply_to_message.from;
  }
  if (msg && msg.entities) {
    for (const ent of msg.entities) {
      if (ent.type === 'text_mention' && ent.user) return ent.user;
    }
  }
  return null;
}

async function safeCall(fn) {
  try { await fn(); return { ok: true }; }
  catch (e) { return { ok: false, error: e.description || e.message }; }
}

/* ==========================================================================
   5) العقوبات (ban/kick/mute/...) مع فرض الهرمية
   ========================================================================== */

async function canPunish(ctx, groupData, actingUserId, targetUserId) {
  if (String(actingUserId) === String(targetUserId)) {
    return { ok: false, reason: 'لا يمكنك تنفيذ هذا الإجراء على نفسك.' };
  }
  const actingRole = await getUserRole(ctx, groupData, actingUserId);
  const targetRole = await getUserRole(ctx, groupData, targetUserId);
  if (targetRole === 'مالك المجموعه') {
    return { ok: false, reason: 'لا يمكن اتخاذ أي إجراء بحق مالك المجموعة الأساسي.' };
  }
  if (!canActOn(actingRole, targetRole)) {
    return { ok: false, reason: 'رتبتك لا تسمح لك بالتحكم بشخص برتبة مساوية أو أعلى من رتبتك.' };
  }
  return { ok: true, actingRole, targetRole };
}

const FULL_RESTRICT = {
  can_send_messages: false, can_send_audios: false, can_send_documents: false,
  can_send_photos: false, can_send_videos: false, can_send_video_notes: false,
  can_send_voice_notes: false, can_send_polls: false, can_send_other_messages: false,
  can_add_web_page_previews: false
};
const FULL_UNRESTRICT = {
  can_send_messages: true, can_send_audios: true, can_send_documents: true,
  can_send_photos: true, can_send_videos: true, can_send_video_notes: true,
  can_send_voice_notes: true, can_send_polls: true, can_send_other_messages: true,
  can_add_web_page_previews: true
};

/* ==========================================================================
   6) نظام الحماية والمخالفات
   ========================================================================== */

const LINK_REGEX = /(https?:\/\/|t\.me\/|www\.)/i;
const ENGLISH_REGEX = /[a-zA-Z]{3,}/;

async function reportViolation(ctx, groupData, reasonLabel) {
  const user = ctx.from;
  const key = String(user.id);
  if (!groupData.violationsLog[key]) groupData.violationsLog[key] = [];
  groupData.violationsLog[key].push({ type: reasonLabel, date: Date.now() });
  if (!groupData.stats[key]) groupData.stats[key] = { messages: 0, violations: 0, gamePoints: 0, gameWins: 0 };
  groupData.stats[key].violations = (groupData.stats[key].violations || 0) + 1;

  if (ctx.message) {
    await safeCall(() => ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id));
  }
  await safeCall(() => ctx.reply(
    `⚠️ | مخالفة\n\nالعضو: ${mentionHtml(user)}\nالسبب: ${reasonLabel}`,
    { parse_mode: 'HTML' }
  ));
  saveGroup(ctx.chat.id);
}

/**
 * فحص رسالة نصية/وسائط ضد إعدادات الحماية المفعّلة.
 * يعيد true إذا تمت معالجة مخالفة (توقف عن أي معالجة أخرى للرسالة).
 */
async function runProtectionChecks(ctx, groupData, role) {
  const vs = groupData.violationsSettings;
  if (!vs.enabled) return false;
  // الرتب الإدارية فما فوق مستثناة من الحماية
  if (isHigherOrEqual(role, 'مميز')) return false;

  const msg = ctx.message;
  const text = msg.text || msg.caption || '';

  if (vs.links && LINK_REGEX.test(text)) { await reportViolation(ctx, groupData, 'روابط'); return true; }
  if (vs.mention && msg.entities && msg.entities.some((e) => e.type === 'mention' || e.type === 'text_mention')) {
    await reportViolation(ctx, groupData, 'منشن'); return true;
  }
  if (vs.forward && (msg.forward_date || msg.forward_origin)) { await reportViolation(ctx, groupData, 'فوروارد'); return true; }
  if (vs.photo && msg.photo) { await reportViolation(ctx, groupData, 'صور'); return true; }
  if (vs.video && msg.video) { await reportViolation(ctx, groupData, 'فيديو'); return true; }
  if (vs.file && msg.document) { await reportViolation(ctx, groupData, 'ملفات'); return true; }
  if (vs.sticker && msg.sticker) { await reportViolation(ctx, groupData, 'ملصقات'); return true; }
  if (vs.gif && msg.animation) { await reportViolation(ctx, groupData, 'GIF'); return true; }
  if (vs.audio && (msg.voice || msg.audio)) { await reportViolation(ctx, groupData, 'صوتيات'); return true; }
  if (vs.contact && msg.contact) { await reportViolation(ctx, groupData, 'جهات اتصال'); return true; }
  if (vs.commands && text.startsWith('/')) { await reportViolation(ctx, groupData, 'أوامر'); return true; }
  if (vs.english && ENGLISH_REGEX.test(text)) { await reportViolation(ctx, groupData, 'الإنجليزي'); return true; }
  if (vs.longMessages && text.length > vs.longMessageLimit) { await reportViolation(ctx, groupData, 'رسائل طويلة'); return true; }
  if (vs.badwords && vs.badwordsList.some((w) => w && text.includes(w))) { await reportViolation(ctx, groupData, 'كلمات ممنوعة'); return true; }

  // منع التكرار/السبام: تتبع بسيط في الذاكرة لآخر رسالة لكل مستخدم
  if (vs.spam) {
    const spamKey = `${ctx.chat.id}:${ctx.from.id}`;
    const now = Date.now();
    const prev = spamTracker.get(spamKey);
    if (prev && prev.text === text && now - prev.time < 8000) {
      await reportViolation(ctx, groupData, 'تكرار وسبام');
      return true;
    }
    spamTracker.set(spamKey, { text, time: now });
  }

  return false;
}
const spamTracker = new Map();

/* ==========================================================================
   7) الهمسات (Whispers)
   ========================================================================== */

function newId(prefix) { return `${prefix}${Date.now()}${Math.floor(Math.random() * 10000)}`; }

async function createWhisper(ctx, fromUser, targetUser, content) {
  const g = getGlobal();
  const id = newId('w');
  g.whispers[id] = {
    id,
    chatId: ctx.chat.id,
    fromId: fromUser.id,
    fromName: fromUser.first_name,
    targetId: targetUser ? targetUser.id : null,
    targetName: targetUser ? targetUser.first_name : null,
    content, // { type: 'text'|'sticker'|'photo'|'animation', data }
    createdAt: Date.now(),
    revealed: false
  };
  saveGlobalData();
  return id;
}

/* ==========================================================================
   8) الألعاب (Games)
   ========================================================================== */

const TRIVIA_BANK = [
  { q: 'ما هي عاصمة السعودية؟', a: ['الرياض'] },
  { q: 'كم عدد أيام الأسبوع؟', a: ['7', 'سبعة'] },
  { q: 'ما هو أكبر كوكب في المجموعة الشمسية؟', a: ['المشتري'] },
  { q: 'كم عدد قارات العالم؟', a: ['7', 'سبعة'] },
  { q: 'ما هي عملة اليابان؟', a: ['ين', 'الين'] },
  { q: 'من مؤلف رواية الأمير الصغير؟', a: ['سانت اكزوبيري', 'أنطوان دو سانت إكزوبيري'] },
  { q: 'ما ناتج 12 × 8؟', a: ['96'] },
  { q: 'ما هي أطول نهر في العالم؟', a: ['النيل'] }
];

function normalizeAnswer(s) {
  return String(s).trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
}

function startTrivia(ctx, groupData) {
  const chatKey = String(ctx.chat.id);
  if (groupData.activeGames[chatKey]) return null;
  const q = TRIVIA_BANK[Math.floor(Math.random() * TRIVIA_BANK.length)];
  const game = {
    id: newId('g'),
    type: 'trivia',
    question: q.q,
    answers: q.a.map(normalizeAnswer),
    startedAt: Date.now(),
    answered: false,
    timeout: null
  };
  groupData.activeGames[chatKey] = game;
  return game;
}

function endGame(groupData, chatId) {
  delete groupData.activeGames[String(chatId)];
}

function ensureStats(groupData, userId) {
  const key = String(userId);
  if (!groupData.stats[key]) groupData.stats[key] = { messages: 0, violations: 0, gamePoints: 0, gameWins: 0 };
  return groupData.stats[key];
}

function addMoney(groupData, userId, amount) {
  const key = String(userId);
  groupData.money[key] = (groupData.money[key] || 0) + amount;
  return groupData.money[key];
}

function getMoney(groupData, userId) {
  return groupData.money[String(userId)] || 0;
}

/* ==========================================================================
   9) الفعاليات (Events)
   ========================================================================== */

const EVENTS_BANK = [
  { name: 'سباق المعلومات', desc: 'أول من يجيب صح يفوز بجائزة!' },
  { name: 'تحدي السرعة', desc: 'أرسل "هنا" بأسرع وقت لتفوز!' }
];

/* ==========================================================================
   10) بحث الأغاني
   ========================================================================== */

let YouTube = null;
try { YouTube = require('youtube-sr').default; } catch (e) { /* اختياري */ }

async function searchSongs(query) {
  if (!YouTube) return [];
  try {
    const results = await YouTube.search(query, { limit: 5, type: 'video' });
    return results.map((r) => ({
      title: r.title,
      channel: r.channel ? r.channel.name : 'غير معروف',
      url: r.url,
      id: r.id
    }));
  } catch (e) {
    console.error('خطأ في بحث الأغاني:', e.message);
    return [];
  }
}

/* ==========================================================================
   11) لوحة المطور والاشتراك الإجباري
   ========================================================================== */

async function isSubscribed(ctx, channel) {
  try {
    const member = await ctx.telegram.getChatMember(channel, ctx.from.id);
    return ['creator', 'administrator', 'member'].includes(member.status);
  } catch (e) {
    return false;
  }
}

/* ==========================================================================
   12) أمر المالك (بطاقة المالك)
   ========================================================================== */

async function sendOwnerCard(ctx) {
  try {
    const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
    const creator = admins.find((a) => a.status === 'creator');
    if (!creator) {
      return ctx.reply('تعذر العثور على مالك المجموعة حاليًا.');
    }
    const user = creator.user;
    const username = user.username ? `@${user.username}` : 'لا يوجد';
    const caption =
      `👤 مالك المجموعة\n\n` +
      `الاسم ↤ ${escapeHtml(user.first_name || '')}\n` +
      `اليوزر ↤ ${escapeHtml(username)}\n` +
      `المنشن ↤ ${mentionHtml(user)}\n` +
      `الرتبة ↤ مالك المجموعه`;

    let photoFileId = null;
    try {
      const photos = await ctx.telegram.getUserProfilePhotos(user.id, 0, 1);
      if (photos && photos.total_count > 0) {
        photoFileId = photos.photos[0][photos.photos[0].length - 1].file_id;
      }
    } catch (e) { /* تجاهل، سنرسل بدون صورة */ }

    if (photoFileId) {
      await ctx.telegram.sendPhoto(ctx.chat.id, photoFileId, { caption, parse_mode: 'HTML' });
    } else {
      await ctx.reply(caption, { parse_mode: 'HTML' });
    }
  } catch (e) {
    console.error('خطأ في بطاقة المالك:', e.message);
    await ctx.reply('حدث خطأ أثناء جلب بيانات المالك، حاول لاحقًا.');
  }
}

/* ==========================================================================
   13) الوسيط العام (middleware): تتبع الرسائل + الاشتراك الإجباري + الحماية
   ========================================================================== */

// سجل رسائل حديث في الذاكرة (لاستخدامه في أمر "تنظيف")
const recentMessages = new Map(); // chatId -> [{userId, messageId, type, date}]
const MAX_RECENT = 500;

function pushRecent(chatId, entry) {
  const key = String(chatId);
  if (!recentMessages.has(key)) recentMessages.set(key, []);
  const arr = recentMessages.get(key);
  arr.push(entry);
  if (arr.length > MAX_RECENT) arr.shift();
}

bot.on('message', async (ctx, next) => {
  if (!isGroupChat(ctx)) return next();
  const groupData = getGroup(ctx.chat.id);
  const userId = ctx.from.id;

  // كتم عام (globalMuted) - حذف رسائل من في القائمة دون الحاجة لصلاحية تقييد تيليجرام
  if (groupData.globalMuted.includes(String(userId))) {
    await safeCall(() => ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id));
    return; // لا نكمل أي معالجة أخرى
  }

  const role = await getUserRole(ctx, groupData, userId);

  // تتبع للإحصائيات
  if (groupData.settings.statsEnabled) {
    const s = ensureStats(groupData, userId);
    s.messages = (s.messages || 0) + 1;
  }

  // تتبع للتنظيف لاحقًا
  let msgType = 'text';
  const m = ctx.message;
  if (m.photo) msgType = 'photo';
  else if (m.video) msgType = 'video';
  else if (m.document) msgType = 'file';
  else if (m.sticker) msgType = 'sticker';
  else if (m.animation) msgType = 'gif';
  else if (m.voice || m.audio) msgType = 'audio';
  else if (m.contact) msgType = 'contact';
  else if (m.forward_date || m.forward_origin) msgType = 'forward';

  pushRecent(ctx.chat.id, { userId, messageId: m.message_id, type: msgType, date: Date.now(), role });

  // فحص الحماية (يتم تجاوزه للرتب مميز فما فوق داخل الدالة نفسها)
  const violated = await runProtectionChecks(ctx, groupData, role);
  if (violated) { saveGroup(ctx.chat.id); return; }

  // الاشتراك الإجباري
  if (groupData.settings.forceSubEnabled && groupData.settings.forceSubChannel) {
    if (!isHigherOrEqual(role, 'ادمن')) {
      const subscribed = await isSubscribed(ctx, groupData.settings.forceSubChannel);
      if (!subscribed) {
        await ctx.reply('يجب عليك الاشتراك في القناة أولًا لاستخدام البوت 👇', {
          reply_markup: {
            inline_keyboard: [[{ text: 'اشتراك 📢', url: `https://t.me/${String(groupData.settings.forceSubChannel).replace('@', '')}` }]]
          }
        });
        return;
      }
    }
  }

  saveGroup(ctx.chat.id);
  return next();
});

// حماية التعديل (Anti-Edit)
bot.on('edited_message', async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!groupData.violationsSettings.edit) return;
  const role = await getUserRole(ctx, groupData, ctx.from.id);
  if (groupData.settings.antiEditExemptRoles.includes(role)) return;
  await safeCall(() => ctx.telegram.deleteMessage(ctx.chat.id, ctx.editedMessage.message_id));
  await ctx.reply(`⚠️ | مخالفة\n\nالعضو: ${mentionHtml(ctx.from)}\nالسبب: التعديل`, { parse_mode: 'HTML' });
});

/* ==========================================================================
   14) موجّه الأوامر النصية العربية (Text Router)
   ========================================================================== */

bot.hears(/^المالك$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  await sendOwnerCard(ctx);
});

// ---- قفل/فتح الأوامر ----
bot.hears(/^قفل امر (.+)$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const role = await getUserRole(ctx, groupData, ctx.from.id);
  if (!isHigherOrEqual(role, 'مالك')) {
    return ctx.reply('هذا الأمر متاح فقط لرتبة مالك فأعلى.');
  }
  const displayName = ctx.match[1].trim();
  const key = findCommandByDisplayName(displayName);
  if (!key) {
    return ctx.reply(`لم أجد أمرًا باسم "${displayName}" في قائمة الأوامر القابلة للقفل.`);
  }
  groupData.pendingLock[String(ctx.from.id)] = key;
  saveGroup(ctx.chat.id);
  await ctx.reply(
    `• حسنًا عزيزي قم بإرسال الرتبة الان :\n━━━━━━━━\n${RANKS.slice(0, 8).map((r) => `* ${r}`).join('\n')}\n━━━━━━━━\n` +
    `• سيتم وضع الأمر ↤ ${displayName} للرتبة المحددة فقط`
  );
});

bot.hears(/^فتح امر (.+)$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const role = await getUserRole(ctx, groupData, ctx.from.id);
  if (!isHigherOrEqual(role, 'مالك')) {
    return ctx.reply('هذا الأمر متاح فقط لرتبة مالك فأعلى.');
  }
  const displayName = ctx.match[1].trim();
  const key = findCommandByDisplayName(displayName);
  if (!key) return ctx.reply(`لم أجد أمرًا باسم "${displayName}".`);
  delete groupData.commandLocks[key];
  saveGroup(ctx.chat.id);
  await ctx.reply(`تم فتح الأمر "${displayName}" وإرجاعه للوضع الافتراضي ✅`);
});

// معالجة انتظار استلام الرتبة بعد "قفل امر"
bot.on('text', async (ctx, next) => {
  if (!isGroupChat(ctx)) return next();
  const groupData = getGroup(ctx.chat.id);
  const uidKey = String(ctx.from.id);
  const pendingKey = groupData.pendingLock[uidKey];
  if (!pendingKey) return next();

  const rankInput = ctx.message.text.trim();
  if (!isValidRank(rankInput) || rankInput === 'عضو') {
    await ctx.reply('الرتبة غير صحيحة، الرجاء إرسال اسم رتبة صحيح من القائمة المرسلة.');
    return; // لا ننتقل للـ next حتى لا تعالج كأمر آخر
  }
  groupData.commandLocks[pendingKey] = rankInput;
  delete groupData.pendingLock[uidKey];
  saveGroup(ctx.chat.id);
  await ctx.reply(
    `• تم تحديد رتبة الأمر بنجاح\n• الأمر ↤ ${getCommandDisplayName(pendingKey)}\n• الرتبة ↤ ${rankInput}`
  );
});

// ---- تعيين الرتب ----
bot.hears(/^ترقية (.+)$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const target = resolveTargetUser(ctx);
  const rank = ctx.match[1].trim();
  if (!target) return ctx.reply('الرجاء الرد على رسالة العضو المراد ترقيته.');
  if (!isValidRank(rank)) return ctx.reply('اسم الرتبة غير صحيح.');
  const actingRole = await getUserRole(ctx, groupData, ctx.from.id);
  const targetCurrentRole = await getUserRole(ctx, groupData, target.id);
  if (!isStrictlyHigher(actingRole, rank)) {
    return ctx.reply('لا يمكنك منح رتبة مساوية أو أعلى من رتبتك.');
  }
  if (!canActOn(actingRole, targetCurrentRole)) {
    return ctx.reply('لا يمكنك تعديل رتبة شخص يساويك أو أعلى منك.');
  }
  setUserRole(groupData, target.id, rank);
  saveGroup(ctx.chat.id);
  await ctx.reply(`تم تعيين رتبة "${rank}" للعضو ${mentionHtml(target)} ✅`, { parse_mode: 'HTML' });
});

bot.hears(/^تنزيل رتبة$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const target = resolveTargetUser(ctx);
  if (!target) return ctx.reply('الرجاء الرد على رسالة العضو.');
  const actingRole = await getUserRole(ctx, groupData, ctx.from.id);
  const targetRole = await getUserRole(ctx, groupData, target.id);
  if (!canActOn(actingRole, targetRole)) return ctx.reply('لا تملك صلاحية كافية.');
  delete groupData.roles[String(target.id)];
  saveGroup(ctx.chat.id);
  await ctx.reply(`تم إرجاع رتبة ${mentionHtml(target)} إلى عضو ✅`, { parse_mode: 'HTML' });
});

// ---- الحماية ----
bot.hears(/^تفعيل الحماية$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'protection_toggle'))) return ctx.reply('لا تملك صلاحية كافية.');
  groupData.violationsSettings.enabled = true;
  saveGroup(ctx.chat.id);
  await ctx.reply('تم تفعيل الحماية ✅');
});
bot.hears(/^تعطيل الحماية$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'protection_toggle'))) return ctx.reply('لا تملك صلاحية كافية.');
  groupData.violationsSettings.enabled = false;
  saveGroup(ctx.chat.id);
  await ctx.reply('تم تعطيل الحماية 🚫');
});
bot.hears(/^حالة الحماية$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const vs = getGroup(ctx.chat.id).violationsSettings;
  const list = ['links','edit','spam','ads','mention','forward','photo','video','file','sticker','gif','audio','contact','commands','badwords','english','longMessages']
    .map((k) => `${k}: ${vs[k] ? '✅' : '❌'}`).join('\n');
  await ctx.reply(`حالة الحماية العامة: ${vs.enabled ? '✅ مفعلة' : '❌ معطلة'}\n\n${list}`);
});
bot.hears(/^الحماية التلقائية$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'protection_toggle'))) return ctx.reply('لا تملك صلاحية كافية.');
  groupData.violationsSettings.autoProtection = !groupData.violationsSettings.autoProtection;
  saveGroup(ctx.chat.id);
  await ctx.reply(`الحماية التلقائية الآن: ${groupData.violationsSettings.autoProtection ? '✅ مفعلة' : '❌ معطلة'}`);
});

const PROTECTION_TYPES = {
  'الروابط': 'links', 'التعديل': 'edit', 'التكرار': 'spam', 'السبام': 'spam',
  'الإعلانات': 'ads', 'المنشن': 'mention', 'الفوروارد': 'forward', 'الصور': 'photo',
  'الفيديو': 'video', 'الملفات': 'file', 'الملصقات': 'sticker', 'GIF': 'gif',
  'الصوتيات': 'audio', 'جهات الاتصال': 'contact', 'الأوامر': 'commands',
  'الكلمات الممنوعة': 'badwords', 'الإنجليزي': 'english', 'الرسائل الطويلة': 'longMessages'
};

bot.hears(/^(تفعيل|تعطيل) منع (.+)$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'protection_toggle'))) return ctx.reply('لا تملك صلاحية كافية.');
  const action = ctx.match[1];
  const label = ctx.match[2].trim();
  const field = PROTECTION_TYPES[label];
  if (!field) return ctx.reply(`نوع الحماية "${label}" غير معروف.`);
  groupData.violationsSettings[field] = action === 'تفعيل';
  saveGroup(ctx.chat.id);
  await ctx.reply(`تم ${action} منع ${label} ${action === 'تفعيل' ? '✅' : '🚫'}`);
});

// ---- التحذيرات ----
async function applyWarnPunishmentIfNeeded(ctx, groupData, target) {
  const count = groupData.warnings[String(target.id)] || 0;
  if (count >= groupData.settings.warnLimit) {
    const type = groupData.settings.warnPunishment;
    if (type === 'mute') {
      await safeCall(() => ctx.telegram.restrictChatMember(ctx.chat.id, target.id, { permissions: FULL_RESTRICT }));
      if (!groupData.muted.includes(String(target.id))) groupData.muted.push(String(target.id));
      await ctx.reply(`تم كتم ${mentionHtml(target)} تلقائيًا بعد الوصول إلى ${count} تحذيرات.`, { parse_mode: 'HTML' });
    } else if (type === 'kick') {
      await safeCall(() => ctx.telegram.banChatMember(ctx.chat.id, target.id));
      await safeCall(() => ctx.telegram.unbanChatMember(ctx.chat.id, target.id, { only_if_banned: true }));
      await ctx.reply(`تم طرد ${mentionHtml(target)} تلقائيًا بعد الوصول إلى ${count} تحذيرات.`, { parse_mode: 'HTML' });
    } else if (type === 'ban') {
      await safeCall(() => ctx.telegram.banChatMember(ctx.chat.id, target.id));
      await ctx.reply(`تم حظر ${mentionHtml(target)} تلقائيًا بعد الوصول إلى ${count} تحذيرات.`, { parse_mode: 'HTML' });
    }
  }
}

bot.hears(/^تحذير$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'warn_cmd'))) return ctx.reply('لا تملك صلاحية كافية.');
  const target = resolveTargetUser(ctx);
  if (!target) return ctx.reply('الرجاء الرد على رسالة العضو لتحذيره.');
  const perm = await canPunish(ctx, groupData, ctx.from.id, target.id);
  if (!perm.ok) return ctx.reply(perm.reason);
  groupData.warnings[String(target.id)] = (groupData.warnings[String(target.id)] || 0) + 1;
  saveGroup(ctx.chat.id);
  await ctx.reply(`تم تحذير ${mentionHtml(target)} (${groupData.warnings[String(target.id)]}/${groupData.settings.warnLimit})`, { parse_mode: 'HTML' });
  await applyWarnPunishmentIfNeeded(ctx, groupData, target);
  saveGroup(ctx.chat.id);
});

bot.hears(/^إزالة تحذير$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'warn_cmd'))) return ctx.reply('لا تملك صلاحية كافية.');
  const target = resolveTargetUser(ctx);
  if (!target) return ctx.reply('الرجاء الرد على رسالة العضو.');
  const key = String(target.id);
  groupData.warnings[key] = Math.max(0, (groupData.warnings[key] || 0) - 1);
  saveGroup(ctx.chat.id);
  await ctx.reply(`تم إزالة تحذير عن ${mentionHtml(target)} (${groupData.warnings[key]}/${groupData.settings.warnLimit})`, { parse_mode: 'HTML' });
});

bot.hears(/^عرض تحذيرات$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const target = resolveTargetUser(ctx) || ctx.from;
  const count = groupData.warnings[String(target.id)] || 0;
  await ctx.reply(`تحذيرات ${mentionHtml(target)}: ${count}/${groupData.settings.warnLimit}`, { parse_mode: 'HTML' });
});

bot.hears(/^مسح تحذيرات$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'warn_cmd'))) return ctx.reply('لا تملك صلاحية كافية.');
  const target = resolveTargetUser(ctx);
  if (!target) return ctx.reply('الرجاء الرد على رسالة العضو.');
  delete groupData.warnings[String(target.id)];
  saveGroup(ctx.chat.id);
  await ctx.reply(`تم مسح تحذيرات ${mentionHtml(target)} ✅`, { parse_mode: 'HTML' });
});

bot.hears(/^مسح جميع التحذيرات$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const role = await getUserRole(ctx, groupData, ctx.from.id);
  if (!isHigherOrEqual(role, 'مدير')) return ctx.reply('لا تملك صلاحية كافية.');
  groupData.warnings = {};
  saveGroup(ctx.chat.id);
  await ctx.reply('تم مسح جميع التحذيرات في المجموعة ✅');
});

// ---- المكتومين ----
bot.hears(/^مسح المكتومين$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const role = await getUserRole(ctx, groupData, ctx.from.id);
  if (!isHigherOrEqual(role, 'ادمن')) return ctx.reply('لا تملك صلاحية كافية.');
  const list = groupData.muted.slice();
  if (list.length === 0) return ctx.reply('• لا يوجد مكتومين');
  let cleared = 0;
  for (const uid of list) {
    const res = await safeCall(() => ctx.telegram.restrictChatMember(ctx.chat.id, uid, { permissions: FULL_UNRESTRICT }));
    if (res.ok) cleared++;
  }
  groupData.muted = [];
  saveGroup(ctx.chat.id);
  await ctx.reply(`• تم مسح ( ${cleared} ) من المكتومين`);
});

bot.hears(/^مسح المكتومين عام$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const role = await getUserRole(ctx, groupData, ctx.from.id);
  if (!isHigherOrEqual(role, 'ادمن')) return ctx.reply('لا تملك صلاحية كافية.');
  const count = groupData.globalMuted.length;
  if (count === 0) return ctx.reply('• لا يوجد مكتومين عام');
  groupData.globalMuted = [];
  saveGroup(ctx.chat.id);
  await ctx.reply(`• تم مسح ( ${count} ) من المكتومين عام`);
});

// ---- التنظيف ----
bot.hears(/^تنظيف(?:\s+(.+))?$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'cleanup'))) return ctx.reply('لا تملك صلاحية كافية.');
  const filterLabelMap = {
    'نصوص': 'text', 'صور': 'photo', 'فيديو': 'video', 'ملفات': 'file',
    'ملصقات': 'sticker', 'صوتيات': 'audio', 'جهات اتصال': 'contact', 'فوروارد': 'forward', 'GIF': 'gif'
  };
  const filterArg = ctx.match[1] ? ctx.match[1].trim() : null;
  const filterType = filterArg ? filterLabelMap[filterArg] : null;

  const list = recentMessages.get(String(ctx.chat.id)) || [];
  let deleted = 0;
  for (const entry of list) {
    if (entry.role !== 'عضو') continue; // فقط رتبة عضو
    if (filterType && entry.type !== filterType) continue;
    const res = await safeCall(() => ctx.telegram.deleteMessage(ctx.chat.id, entry.messageId));
    if (res.ok) deleted++;
  }
  recentMessages.set(String(ctx.chat.id), []);
  await ctx.reply(`تم تنظيف ( ${deleted} ) رسالة من الأعضاء 🧹`);
});

/* ==========================================================================
   15) البنك والفلوس
   ========================================================================== */

bot.hears(/^(فلوسي|رصيدي)$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!groupData.settings.bankEnabled) return ctx.reply('نظام البنك معطل حاليًا في هذه المجموعة.');
  const balance = getMoney(groupData, ctx.from.id);
  await ctx.reply(`💰 رصيدك الحالي: ${balance} ريال`);
});

bot.hears(/^تحويل\s+(\d+)$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!groupData.settings.bankEnabled) return ctx.reply('نظام البنك معطل حاليًا.');
  const amount = parseInt(ctx.match[1], 10);
  const target = resolveTargetUser(ctx);
  if (!target) return ctx.reply('الرجاء الرد على رسالة العضو المراد التحويل له.');
  if (target.id === ctx.from.id) return ctx.reply('لا يمكنك التحويل لنفسك.');
  const senderBalance = getMoney(groupData, ctx.from.id);
  if (senderBalance < amount || amount <= 0) return ctx.reply('رصيدك غير كافٍ لإتمام هذا التحويل.');
  addMoney(groupData, ctx.from.id, -amount);
  addMoney(groupData, target.id, amount);
  saveGroup(ctx.chat.id);
  await ctx.reply(`تم تحويل ${amount} ريال إلى ${mentionHtml(target)} بنجاح ✅`, { parse_mode: 'HTML' });
});

bot.hears(/^المتصدرين$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const entries = Object.entries(groupData.money).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (entries.length === 0) return ctx.reply('لا يوجد بيانات كافية بعد.');
  let text = '🏆 المتصدرين في الرصيد:\n\n';
  for (let i = 0; i < entries.length; i++) {
    text += `${i + 1}. ${entries[i][0]} — ${entries[i][1]} ريال\n`;
  }
  await ctx.reply(text);
});

bot.hears(/^(تفعيل|تعطيل) البنك$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const role = await getUserRole(ctx, groupData, ctx.from.id);
  if (!isHigherOrEqual(role, 'مالك')) return ctx.reply('لا تملك صلاحية كافية.');
  groupData.settings.bankEnabled = ctx.match[1] === 'تفعيل';
  saveGroup(ctx.chat.id);
  await ctx.reply(`تم ${ctx.match[1]} نظام البنك ${groupData.settings.bankEnabled ? '✅' : '🚫'}`);
});

/* ==========================================================================
   16) الألعاب
   ========================================================================== */

bot.hears(/^(الألعاب|ابدأ لعبة|لعبة)$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'start_game'))) return ctx.reply('لا تملك صلاحية كافية لبدء لعبة.');
  const game = startTrivia(ctx, groupData);
  if (!game) return ctx.reply('يوجد لعبة قائمة بالفعل، انتظر حتى تنتهي أو ألغِها.');
  saveGroup(ctx.chat.id);
  await ctx.reply(`🎮 سؤال:\n\n${game.question}\n\nأول إجابة صحيحة تفوز بمكافأة!`);
  const chatId = ctx.chat.id;
  setTimeout(() => {
    const g = getGroup(chatId);
    const current = g.activeGames[String(chatId)];
    if (current && current.id === game.id && !current.answered) {
      endGame(g, chatId);
      saveGroup(chatId);
      bot.telegram.sendMessage(chatId, '⏱ انتهى الوقت! لم يُجب أحد بشكل صحيح.').catch(() => {});
    }
  }, 30000);
});

bot.hears(/^إلغاء اللعبة$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'cancel_game'))) return ctx.reply('لا تملك صلاحية كافية.');
  if (!groupData.activeGames[String(ctx.chat.id)]) return ctx.reply('لا توجد لعبة قائمة حاليًا.');
  endGame(groupData, ctx.chat.id);
  saveGroup(ctx.chat.id);
  await ctx.reply('تم إلغاء اللعبة ❌');
});

bot.hears(/^نقاطي$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const s = ensureStats(groupData, ctx.from.id);
  await ctx.reply(`نقاطك: ${s.gamePoints}\nعدد مرات الفوز: ${s.gameWins}`);
});

bot.hears(/^(الترتيب|المتصدرين في الالعاب)$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const entries = Object.entries(groupData.stats)
    .map(([id, s]) => [id, s.gamePoints || 0])
    .sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (entries.length === 0) return ctx.reply('لا يوجد بيانات كافية بعد.');
  let text = '🏆 ترتيب اللاعبين:\n\n';
  entries.forEach(([id, pts], i) => { text += `${i + 1}. ${id} — ${pts} نقطة\n`; });
  await ctx.reply(text);
});

// معالجة إجابات الألعاب (يجب أن تكون بعد باقي المطابقات النصية الدقيقة)
bot.on('text', async (ctx, next) => {
  if (!isGroupChat(ctx)) return next();
  const groupData = getGroup(ctx.chat.id);
  const game = groupData.activeGames[String(ctx.chat.id)];
  if (!game || game.answered) return next();
  const guess = normalizeAnswer(ctx.message.text);
  if (game.answers.includes(guess)) {
    game.answered = true;
    const seconds = Math.max(1, Math.round((Date.now() - game.startedAt) / 1000));
    const reward = groupData.settings.defaultGameReward;
    addMoney(groupData, ctx.from.id, reward);
    const s = ensureStats(groupData, ctx.from.id);
    s.gamePoints = (s.gamePoints || 0) + 1;
    s.gameWins = (s.gameWins || 0) + 1;
    endGame(groupData, ctx.chat.id);
    saveGroup(ctx.chat.id);
    await ctx.reply(
      `• كفو اجابتك صح\n• تمت اضافة ${reward} ريال لك\n• عدد الثواني ↤ ${seconds}\n• فلوسك الان ↤ ${getMoney(groupData, ctx.from.id)} 💸`
    );
    return;
  }
  return next();
});

/* ==========================================================================
   17) الفعاليات
   ========================================================================== */

bot.hears(/^فعالية$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const list = EVENTS_BANK.map((e, i) => `${i + 1}. ${e.name} — ${e.desc}`).join('\n');
  await ctx.reply(`📅 الفعاليات المتاحة:\n\n${list}`);
});

bot.hears(/^ابدأ فعالية$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'events'))) return ctx.reply('لا تملك صلاحية كافية.');
  const ev = EVENTS_BANK[Math.floor(Math.random() * EVENTS_BANK.length)];
  await ctx.reply(`🎉 بدأت فعالية: ${ev.name}\n${ev.desc}`);
});

bot.hears(/^فعالية (.+)$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'events'))) return ctx.reply('لا تملك صلاحية كافية.');
  const name = ctx.match[1].trim();
  const ev = EVENTS_BANK.find((e) => e.name === name);
  if (!ev) return ctx.reply(`لم أجد فعالية باسم "${name}".`);
  await ctx.reply(`🎉 بدأت فعالية: ${ev.name}\n${ev.desc}`);
});

/* ==========================================================================
   18) الإحصائيات
   ========================================================================== */

bot.hears(/^(إحصائياتي|احصائياتي)$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const s = ensureStats(groupData, ctx.from.id);
  await ctx.reply(
    `📊 إحصائياتك:\n\nالرسائل: ${s.messages || 0}\nالمخالفات: ${s.violations || 0}\n` +
    `التحذيرات: ${groupData.warnings[String(ctx.from.id)] || 0}\nنقاط الألعاب: ${s.gamePoints || 0}\n` +
    `الرصيد: ${getMoney(groupData, ctx.from.id)} ريال`
  );
});

bot.hears(/^إحصائيات العضو$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const target = resolveTargetUser(ctx);
  if (!target) return ctx.reply('الرجاء الرد على رسالة العضو.');
  const s = ensureStats(groupData, target.id);
  await ctx.reply(
    `📊 إحصائيات ${mentionHtml(target)}:\n\nالرسائل: ${s.messages || 0}\nالمخالفات: ${s.violations || 0}\n` +
    `التحذيرات: ${groupData.warnings[String(target.id)] || 0}\nنقاط الألعاب: ${s.gamePoints || 0}\n` +
    `الرصيد: ${getMoney(groupData, target.id)} ريال`,
    { parse_mode: 'HTML' }
  );
});

bot.hears(/^إحصائيات$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const totalMsgs = Object.values(groupData.stats).reduce((a, s) => a + (s.messages || 0), 0);
  const totalViolations = Object.values(groupData.stats).reduce((a, s) => a + (s.violations || 0), 0);
  await ctx.reply(`📊 إحصائيات المجموعة:\n\nإجمالي الرسائل: ${totalMsgs}\nإجمالي المخالفات: ${totalViolations}\nعدد الأعضاء المسجلين: ${Object.keys(groupData.stats).length}`);
});

/* ==========================================================================
   19) الردود المخصصة (Custom Commands)
   ========================================================================== */

bot.hears(/^إضافة رد (\S+) (.+)$/s, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'custom_commands'))) return ctx.reply('لا تملك صلاحية كافية.');
  const [, trigger, reply] = ctx.match;
  groupData.customCommands[trigger] = reply;
  saveGroup(ctx.chat.id);
  await ctx.reply(`تم إضافة الرد على "${trigger}" ✅`);
});

bot.hears(/^حذف رد (\S+)$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'custom_commands'))) return ctx.reply('لا تملك صلاحية كافية.');
  const trigger = ctx.match[1];
  if (!groupData.customCommands[trigger]) return ctx.reply('لا يوجد رد بهذا الاسم.');
  delete groupData.customCommands[trigger];
  saveGroup(ctx.chat.id);
  await ctx.reply(`تم حذف الرد "${trigger}" ✅`);
});

bot.hears(/^تعديل رد (\S+) (.+)$/s, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'custom_commands'))) return ctx.reply('لا تملك صلاحية كافية.');
  const [, trigger, reply] = ctx.match;
  if (!groupData.customCommands[trigger]) return ctx.reply('لا يوجد رد بهذا الاسم لتعديله.');
  groupData.customCommands[trigger] = reply;
  saveGroup(ctx.chat.id);
  await ctx.reply(`تم تعديل الرد "${trigger}" ✅`);
});

bot.hears(/^عرض الردود$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const keys = Object.keys(groupData.customCommands);
  if (keys.length === 0) return ctx.reply('لا توجد ردود مخصصة بعد.');
  await ctx.reply(`الردود المخصصة:\n\n${keys.map((k) => `• ${k}`).join('\n')}`);
});

// تنفيذ الردود المخصصة (يجب أن يكون آخر مطابقة نصية عامة)
bot.on('text', async (ctx, next) => {
  if (!isGroupChat(ctx)) return next();
  const groupData = getGroup(ctx.chat.id);
  if (!groupData.customCommandsEnabled) return next();
  const reply = groupData.customCommands[ctx.message.text.trim()];
  if (reply) { await ctx.reply(reply); return; }
  return next();
});

/* ==========================================================================
   20) الهمسات - إنشاء واستقبال
   ========================================================================== */

bot.hears(/^همسة (.+)$/s, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'whispers'))) return ctx.reply('لا تملك صلاحية كافية.');
  const target = resolveTargetUser(ctx);
  const content = { type: 'text', data: ctx.match[1].trim() };
  const id = await createWhisper(ctx, ctx.from, target, content);
  const me = await ctx.telegram.getMe();
  await ctx.reply(
    target ? `🤫 همسة من ${mentionHtml(ctx.from)} إلى ${mentionHtml(target)}` : `🤫 همسة جديدة من ${mentionHtml(ctx.from)}`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'رؤية الهمسه 👁', url: `https://t.me/${me.username}?start=whisper_${id}` }],
          [{ text: 'رد على الهمسه ✍️', callback_data: `wreply_${id}` }]
        ]
      }
    }
  );
});

// إذا أرسل المستخدم ملصق/صورة/GIF كرد على "همسة" - نظام مبسط عبر الرد على رسالة تحوي كلمة "همسة"
bot.on(['sticker', 'photo', 'animation'], async (ctx, next) => {
  if (!isGroupChat(ctx)) return next();
  const reply = ctx.message.reply_to_message;
  if (!reply || !reply.text || !reply.text.startsWith('اصنع همسة')) return next();
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'whispers'))) return next();
  let content;
  if (ctx.message.sticker) content = { type: 'sticker', data: ctx.message.sticker.file_id };
  else if (ctx.message.photo) content = { type: 'photo', data: ctx.message.photo[ctx.message.photo.length - 1].file_id };
  else if (ctx.message.animation) content = { type: 'animation', data: ctx.message.animation.file_id };
  const id = await createWhisper(ctx, ctx.from, null, content);
  const me = await ctx.telegram.getMe();
  await ctx.reply('🤫 تم إنشاء همسة', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'رؤية الهمسه 👁', url: `https://t.me/${me.username}?start=whisper_${id}` }],
        [{ text: 'رد على الهمسه ✍️', callback_data: `wreply_${id}` }]
      ]
    }
  });
});

// استقبال /start مع payload الهمسة (في الخاص)
bot.start(async (ctx) => {
  const payload = ctx.startPayload;
  if (payload && payload.startsWith('whisper_')) {
    const id = payload.replace('whisper_', '');
    const g = getGlobal();
    const whisper = g.whispers[id];
    if (!whisper) return ctx.reply('هذه الهمسة لم تعد متاحة.');
    if (whisper.targetId && String(whisper.targetId) !== String(ctx.from.id) && String(whisper.fromId) !== String(ctx.from.id)) {
      return ctx.reply('هذه الهمسة ليست موجهة إليك 🤐');
    }
    whisper.revealed = true;
    saveGlobalData();
    if (whisper.content.type === 'text') await ctx.reply(`🤫 محتوى الهمسة:\n\n${whisper.content.data}`);
    else if (whisper.content.type === 'sticker') await ctx.replyWithSticker(whisper.content.data);
    else if (whisper.content.type === 'photo') await ctx.replyWithPhoto(whisper.content.data);
    else if (whisper.content.type === 'animation') await ctx.replyWithAnimation(whisper.content.data);
    return;
  }
  return ctx.reply('أهلًا بك! أضفني إلى مجموعتك وامنحني صلاحيات المشرف للاستفادة من جميع الميزات.');
});

bot.action(/^wreply_(.+)$/, async (ctx) => {
  const id = ctx.match[1];
  const g = getGlobal();
  const whisper = g.whispers[id];
  if (!whisper) return ctx.answerCbQuery('هذه الهمسة لم تعد متاحة.', { show_alert: true });
  g.pendingReplies[String(ctx.from.id)] = { whisperId: id };
  saveGlobalData();
  await ctx.answerCbQuery();
  await safeCall(() => ctx.telegram.sendMessage(ctx.from.id, 'أرسل ردك الآن وسيتم توصيله لصاحب الهمسة 📩'));
});

// التقاط رد الهمسة في الخاص
bot.on('text', async (ctx, next) => {
  if (ctx.chat.type !== 'private') return next();
  const g = getGlobal();
  const pending = g.pendingReplies[String(ctx.from.id)];
  if (!pending) return next();
  const whisper = g.whispers[pending.whisperId];
  delete g.pendingReplies[String(ctx.from.id)];
  saveGlobalData();
  if (!whisper) return ctx.reply('انتهت صلاحية هذه الهمسة.');
  const res = await safeCall(() => ctx.telegram.sendMessage(whisper.fromId, `✍️ رد على همستك:\n\n${ctx.message.text}`));
  if (res.ok) await ctx.reply('تم إرسال ردك بنجاح ✅');
  else await ctx.reply('تعذر إيصال الرد (ربما لم يبدأ المستخدم محادثة مع البوت).');
});

/* ==========================================================================
   21) بحث الأغاني والتشغيل
   ========================================================================== */

bot.hears(/^بحث (.+)$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'search_song'))) return ctx.reply('لا تملك صلاحية كافية.');
  const query = ctx.match[1].trim();
  const results = await searchSongs(query);
  if (results.length === 0) return ctx.reply('لم يتم العثور على نتائج، أو تعذر الاتصال بمصدر البحث حاليًا.');
  const text = `🎵 نتائج البحث عن "${query}":\n\n` + results.map((r, i) => `${i + 1}. ${r.title} - ${r.channel}`).join('\n');
  const buttons = results.map((r, i) => [{ text: `تشغيل 🎵 ${i + 1}`, callback_data: `song_${r.id}` }]);
  await ctx.reply(text, { reply_markup: { inline_keyboard: buttons } });
});

bot.action(/^song_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery('جاري التحضير...');
  const videoId = ctx.match[1];
  await ctx.reply(
    `🎵 تم اختيار المقطع.\nرابط المصدر: https://www.youtube.com/watch?v=${videoId}\n\n` +
    `ملاحظة: تشغيل الصوت مباشرة داخل مكالمة صوتية بالمجموعة (Voice Chat) يتطلب مكوّنًا إضافيًا (userbot) خارج نطاق توكن البوت العادي - راجع ملاحظات التشغيل في نهاية الرد.`
  );
});

bot.hears(/^تشغيل (.+)$/, async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'play_song'))) return ctx.reply('لا تملك صلاحية كافية.');
  const query = ctx.match[1].trim();
  const results = await searchSongs(query);
  if (results.length === 0) return ctx.reply('لم يتم العثور على أغنية بهذا الاسم.');
  const top = results[0];
  await ctx.reply(
    `▶️ جاري تجهيز: ${top.title} - ${top.channel}\nرابط المصدر: ${top.url}\n\n` +
    `ملاحظة: يتطلب البث داخل Voice Chat الحقيقي إعداد إضافي (راجع نهاية التعليمات).`
  );
});

/* ==========================================================================
   22) لوحة المطور
   ========================================================================== */

function requireDev(ctx) {
  if (!isDeveloper(ctx)) { ctx.reply('هذا الأمر متاح فقط للمطور.'); return false; }
  return true;
}

bot.hears(/^تحديد عدد الأعضاء (\d+)$/, async (ctx) => {
  if (!requireDev(ctx)) return;
  const g = getGlobal();
  g.developer.membersLimitOverride = parseInt(ctx.match[1], 10);
  saveGlobalData();
  await ctx.reply(`تم تحديد الحد الأقصى المعروض للأعضاء: ${g.developer.membersLimitOverride}`);
});

const DEV_TOGGLES = {
  'ردود البوت': 'botRepliesEnabled',
  'البنك': 'bankEnabled',
  'التواصل': 'communicationEnabled',
  'الاشتراك الإجباري': 'forceSubEnabled',
  'بوت الخدمة': 'serviceBotEnabled',
  'الإحصائيات': 'statsEnabled',
  'زاجل': 'zajelEnabled',
  'التنسيقات': 'formattingEnabled'
};

bot.hears(/^(تفعيل|تعطيل) (.+)$/, async (ctx, next) => {
  const label = ctx.match[2].trim();
  const field = DEV_TOGGLES[label];
  if (!field) return next(); // ليست أمر مطور، مرر لباقي المعالجات (مثل تفعيل الحماية إلخ أعلاه)
  if (!requireDev(ctx)) return;
  if (!isGroupChat(ctx)) return ctx.reply('استخدم هذا الأمر داخل المجموعة المستهدفة.');
  const groupData = getGroup(ctx.chat.id);
  groupData.settings[field] = ctx.match[1] === 'تفعيل';
  saveGroup(ctx.chat.id);
  await ctx.reply(`تم ${ctx.match[1]} "${label}" ${groupData.settings[field] ? '✅' : '🚫'}`);
});

bot.hears(/^تغيير الاشتراك الإجباري (.+)$/, async (ctx) => {
  if (!requireDev(ctx)) return;
  if (!isGroupChat(ctx)) return ctx.reply('استخدم هذا الأمر داخل المجموعة المستهدفة.');
  const groupData = getGroup(ctx.chat.id);
  groupData.settings.forceSubChannel = ctx.match[1].trim();
  saveGroup(ctx.chat.id);
  await ctx.reply(`تم تعيين قناة الاشتراك الإجباري: ${groupData.settings.forceSubChannel}`);
});

/* ==========================================================================
   23) الأوامر الإدارية (Slash Commands)
   ========================================================================== */

bot.command('ban', async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'ban_cmd'))) return ctx.reply('لا تملك صلاحية كافية.');
  const target = resolveTargetUser(ctx);
  if (!target) return ctx.reply('الرجاء الرد على رسالة العضو المراد حظره.');
  const perm = await canPunish(ctx, groupData, ctx.from.id, target.id);
  if (!perm.ok) return ctx.reply(perm.reason);
  const res = await safeCall(() => ctx.telegram.banChatMember(ctx.chat.id, target.id));
  if (!res.ok) return ctx.reply(`تعذر تنفيذ الحظر: ${res.error}`);
  await ctx.reply(`تم حظر ${mentionHtml(target)} ✅`, { parse_mode: 'HTML' });
});

bot.command('unban', async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const target = resolveTargetUser(ctx);
  if (!target) return ctx.reply('الرجاء الرد على رسالة العضو أو تزويد آيدي في حال عدم توفره.');
  const res = await safeCall(() => ctx.telegram.unbanChatMember(ctx.chat.id, target.id));
  if (!res.ok) return ctx.reply(`تعذر تنفيذ فك الحظر: ${res.error}`);
  await ctx.reply(`تم فك الحظر عن ${mentionHtml(target)} ✅`, { parse_mode: 'HTML' });
});

bot.command('kick', async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const target = resolveTargetUser(ctx);
  if (!target) return ctx.reply('الرجاء الرد على رسالة العضو المراد طرده.');
  const perm = await canPunish(ctx, groupData, ctx.from.id, target.id);
  if (!perm.ok) return ctx.reply(perm.reason);
  const res = await safeCall(() => ctx.telegram.banChatMember(ctx.chat.id, target.id));
  if (res.ok) await safeCall(() => ctx.telegram.unbanChatMember(ctx.chat.id, target.id, { only_if_banned: true }));
  if (!res.ok) return ctx.reply(`تعذر تنفيذ الطرد: ${res.error}`);
  await ctx.reply(`تم طرد ${mentionHtml(target)} ✅`, { parse_mode: 'HTML' });
});

bot.command('mute', async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  if (!(await checkAllowed(ctx, groupData, 'mute_cmd'))) return ctx.reply('لا تملك صلاحية كافية.');
  const target = resolveTargetUser(ctx);
  if (!target) return ctx.reply('الرجاء الرد على رسالة العضو المراد كتمه.');
  const perm = await canPunish(ctx, groupData, ctx.from.id, target.id);
  if (!perm.ok) return ctx.reply(perm.reason);
  const res = await safeCall(() => ctx.telegram.restrictChatMember(ctx.chat.id, target.id, { permissions: FULL_RESTRICT }));
  if (!res.ok) return ctx.reply(`تعذر تنفيذ الكتم: ${res.error}`);
  if (!groupData.muted.includes(String(target.id))) groupData.muted.push(String(target.id));
  saveGroup(ctx.chat.id);
  await ctx.reply(`تم كتم ${mentionHtml(target)} ✅`, { parse_mode: 'HTML' });
});

bot.command('unmute', async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const target = resolveTargetUser(ctx);
  if (!target) return ctx.reply('الرجاء الرد على رسالة العضو المراد فك كتمه.');
  const res = await safeCall(() => ctx.telegram.restrictChatMember(ctx.chat.id, target.id, { permissions: FULL_UNRESTRICT }));
  if (!res.ok) return ctx.reply(`تعذر فك الكتم: ${res.error}`);
  groupData.muted = groupData.muted.filter((id) => id !== String(target.id));
  saveGroup(ctx.chat.id);
  await ctx.reply(`تم فك الكتم عن ${mentionHtml(target)} ✅`, { parse_mode: 'HTML' });
});

bot.command('restrict', async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const target = resolveTargetUser(ctx);
  if (!target) return ctx.reply('الرجاء الرد على رسالة العضو.');
  const perm = await canPunish(ctx, groupData, ctx.from.id, target.id);
  if (!perm.ok) return ctx.reply(perm.reason);
  const res = await safeCall(() => ctx.telegram.restrictChatMember(ctx.chat.id, target.id, {
    permissions: { ...FULL_UNRESTRICT, can_send_other_messages: false, can_add_web_page_previews: false }
  }));
  if (!res.ok) return ctx.reply(`تعذر التقييد: ${res.error}`);
  await ctx.reply(`تم تقييد ${mentionHtml(target)} (نص فقط) ✅`, { parse_mode: 'HTML' });
});

bot.command('unrestrict', async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const target = resolveTargetUser(ctx);
  if (!target) return ctx.reply('الرجاء الرد على رسالة العضو.');
  const res = await safeCall(() => ctx.telegram.restrictChatMember(ctx.chat.id, target.id, { permissions: FULL_UNRESTRICT }));
  if (!res.ok) return ctx.reply(`تعذر إلغاء التقييد: ${res.error}`);
  await ctx.reply(`تم إلغاء تقييد ${mentionHtml(target)} ✅`, { parse_mode: 'HTML' });
});

bot.command('warn', async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const target = resolveTargetUser(ctx);
  if (!target) return ctx.reply('الرجاء الرد على رسالة العضو.');
  const perm = await canPunish(ctx, groupData, ctx.from.id, target.id);
  if (!perm.ok) return ctx.reply(perm.reason);
  groupData.warnings[String(target.id)] = (groupData.warnings[String(target.id)] || 0) + 1;
  saveGroup(ctx.chat.id);
  await ctx.reply(`تم تحذير ${mentionHtml(target)} (${groupData.warnings[String(target.id)]}/${groupData.settings.warnLimit})`, { parse_mode: 'HTML' });
  await applyWarnPunishmentIfNeeded(ctx, groupData, target);
  saveGroup(ctx.chat.id);
});

bot.command('unwarn', async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const target = resolveTargetUser(ctx);
  if (!target) return ctx.reply('الرجاء الرد على رسالة العضو.');
  const key = String(target.id);
  groupData.warnings[key] = Math.max(0, (groupData.warnings[key] || 0) - 1);
  saveGroup(ctx.chat.id);
  await ctx.reply(`تحذيرات ${mentionHtml(target)} الآن: ${groupData.warnings[key]}`, { parse_mode: 'HTML' });
});

bot.command('delete', async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const reply = ctx.message.reply_to_message;
  if (!reply) return ctx.reply('الرجاء الرد على الرسالة المراد حذفها.');
  const res = await safeCall(() => ctx.telegram.deleteMessage(ctx.chat.id, reply.message_id));
  if (!res.ok) return ctx.reply(`تعذر حذف الرسالة: ${res.error}`);
});

bot.command('pin', async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const reply = ctx.message.reply_to_message;
  if (!reply) return ctx.reply('الرجاء الرد على الرسالة المراد تثبيتها.');
  const res = await safeCall(() => ctx.telegram.pinChatMessage(ctx.chat.id, reply.message_id));
  if (!res.ok) return ctx.reply(`تعذر التثبيت: ${res.error}`);
  await ctx.reply('تم تثبيت الرسالة 📌');
});

bot.command('unpin', async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const reply = ctx.message.reply_to_message;
  const res = reply
    ? await safeCall(() => ctx.telegram.unpinChatMessage(ctx.chat.id, reply.message_id))
    : await safeCall(() => ctx.telegram.unpinAllChatMessages(ctx.chat.id));
  if (!res.ok) return ctx.reply(`تعذر إلغاء التثبيت: ${res.error}`);
  await ctx.reply('تم إلغاء التثبيت ✅');
});

// /lock و /unlock: قفل/فتح إرسال الرسائل للجميع في المجموعة (وليس نظام "قفل امر")
bot.command('lock', async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const role = await getUserRole(ctx, groupData, ctx.from.id);
  if (!isHigherOrEqual(role, 'ادمن')) return ctx.reply('لا تملك صلاحية كافية.');
  const res = await safeCall(() => ctx.telegram.setChatPermissions(ctx.chat.id, {
    can_send_messages: false, can_send_audios: false, can_send_documents: false,
    can_send_photos: false, can_send_videos: false, can_send_video_notes: false,
    can_send_voice_notes: false, can_send_polls: false, can_send_other_messages: false,
    can_add_web_page_previews: false, can_change_info: false, can_invite_users: true, can_pin_messages: false
  }));
  if (!res.ok) return ctx.reply(`تعذر قفل المجموعة: ${res.error}`);
  await ctx.reply('تم قفل المجموعة 🔒 (لا يمكن لغير المشرفين الإرسال)');
});

bot.command('unlock', async (ctx) => {
  if (!isGroupChat(ctx)) return;
  const groupData = getGroup(ctx.chat.id);
  const role = await getUserRole(ctx, groupData, ctx.from.id);
  if (!isHigherOrEqual(role, 'ادمن')) return ctx.reply('لا تملك صلاحية كافية.');
  const res = await safeCall(() => ctx.telegram.setChatPermissions(ctx.chat.id, FULL_UNRESTRICT));
  if (!res.ok) return ctx.reply(`تعذر فتح المجموعة: ${res.error}`);
  await ctx.reply('تم فتح المجموعة 🔓');
});

/* ==========================================================================
   24) بدء تشغيل البوت
   ========================================================================== */

bot.catch((err, ctx) => {
  console.error(`خطأ غير متوقع أثناء معالجة تحديث [${ctx.updateType}]:`, err);
});

bot.launch().then(() => {
  console.log('✅ البوت يعمل الآن...');
}).catch((e) => {
  console.error('فشل تشغيل البوت:', e);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
