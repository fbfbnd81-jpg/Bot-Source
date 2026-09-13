'use strict';

require('dotenv').config();

const {
  Telegraf,
  Markup
} = require('telegraf');

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
const OWNER_ID = process.env.OWNER_ID || '';

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* =========================================================
   الرتب
========================================================= */

const RANKS = {
  MEMBER: 0,
  VIP: 1,
  OWNER: 2,
  BASIC_OWNER: 3,
  MYTH: 4,
  MYTH_STAR: 5,
  DEV2: 6,
  DEV: 7
};

const RANK_NAMES = {
  0: 'عضو',
  1: 'مميز',
  2: 'مالك',
  3: 'مالك أساسي',
  4: 'Myth',
  5: 'Myth 🎖️',
  6: 'Dev²🎖',
  7: 'Dev 🎖'
};

/* =========================================================
   البيانات
========================================================= */

function defaultData() {
  return {
    users: {},
    groups: {},
    subscribers: [],
    broadcasts: [],
    channels: {},
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
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const data = defaultData();
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
      return data;
    }

    const raw = fs.readFileSync(DATA_FILE, 'utf8');

    if (!raw.trim()) {
      return defaultData();
    }

    const data = JSON.parse(raw);

    return {
      ...defaultData(),
      ...data,
      users: data.users || {},
      groups: data.groups || {},
      subscribers: data.subscribers || [],
      broadcasts: data.broadcasts || [],
      channels: data.channels || {}
    };
  } catch (error) {
    console.error('خطأ في قراءة البيانات:', error);
    return defaultData();
  }
}

const DATA = loadData();

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(DATA, null, 2)
    );
  } catch (error) {
    console.error('خطأ في حفظ البيانات:', error);
  }
}

/* =========================================================
   أدوات عامة
========================================================= */

function cleanText(text) {
  return String(text || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalize(text) {
  return cleanText(text)
    .toLowerCase()
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function userKey(id) {
  return String(id);
}

function groupKey(ctx) {
  return String(ctx.chat.id);
}

function isGroup(ctx) {
  return (
    ctx.chat &&
    (
      ctx.chat.type === 'group' ||
      ctx.chat.type === 'supergroup'
    )
  );
}

function isPrivate(ctx) {
  return ctx.chat && ctx.chat.type === 'private';
}

/* =========================================================
   المستخدمين
========================================================= */

function ensureUser(from) {
  if (!from) return null;

  const id = userKey(from.id);

  if (!DATA.users[id]) {
    DATA.users[id] = {
      id: from.id,
      username: from.username || '',
      firstName: from.first_name || '',
      lastName: from.last_name || '',
      rank: 0,
      money: 0,
      bank: null,
      warnings: {},
      titles: {},
      stats: {
        messages: 0,
        answers: 0,
        wins: 0,
        games: 0,
        bestSpeed: null
      },
      createdAt: Date.now()
    };
  }

  const user = DATA.users[id];

  user.username = from.username || user.username || '';
  user.firstName = from.first_name || user.firstName || '';
  user.lastName = from.last_name || user.lastName || '';

  if (
    normalize(user.username) === normalize(OWNER_USERNAME)
  ) {
    user.rank = RANKS.DEV;
  }

  saveData();

  return user;
}

function getUserById(id) {
  return DATA.users[userKey(id)] || null;
}

function displayName(user) {
  if (!user) return 'غير معروف';

  if (user.firstName) {
    return cleanText(
      `${user.firstName} ${user.lastName || ''}`
    );
  }

  if (user.username) {
    return `@${user.username}`;
  }

  return String(user.id);
}

function mentionUser(user) {
  if (!user) return 'غير معروف';

  return `<a href="tg://user?id=${user.id}">${escapeHtml(
    displayName(user)
  )}</a>`;
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* =========================================================
   الرتب
========================================================= */

function getRank(userId) {
  const user = getUserById(userId);

  if (!user) return 0;

  if (
    normalize(user.username) === normalize(OWNER_USERNAME)
  ) {
    return RANKS.DEV;
  }

  return Number(user.rank || 0);
}

function getRankName(rank) {
  return RANK_NAMES[rank] || 'عضو';
}

function hasRank(userId, required) {
  return getRank(userId) >= required;
}

function isOwner(userId, username = '') {
  if (
    normalize(username) === normalize(OWNER_USERNAME)
  ) {
    return true;
  }

  if (
    OWNER_ID &&
    String(userId) === String(OWNER_ID)
  ) {
    return true;
  }

  return getRank(userId) >= RANKS.DEV;
}

function requestedRank(text) {
  const t = normalize(text);

  if (
    t === 'عضو'
  ) return RANKS.MEMBER;

  if (
    t === 'مميز' ||
    t === 'مميزين'
  ) return RANKS.VIP;

  if (
    t === 'مالك'
  ) return RANKS.OWNER;

  if (
    t === 'مالك اساسي' ||
    t === 'مالك أساسي' ||
    t === 'اساس'
  ) return RANKS.BASIC_OWNER;

  if (
    t === 'myth' ||
    t === 'm'
  ) return RANKS.MYTH;

  /*
     مهم:
     My = Myth 🎖️
  */
  if (
    t === 'my' ||
    t === 'myth 🎖️' ||
    t === 'myth⭐' ||
    t === 'اكس'
  ) return RANKS.MYTH_STAR;

  if (
    t === 'dev²' ||
    t === 'dev2' ||
    t === 'مطور ثانوي' ||
    t === 'ديف 2'
  ) return RANKS.DEV2;

  if (
    t === 'dev' ||
    t === 'ديف' ||
    t === 'dev 🎖'
  ) return RANKS.DEV;

  return null;
}

/* =========================================================
   المجموعات
========================================================= */

function ensureGroup(ctx) {
  if (!isGroup(ctx)) return null;

  const id = groupKey(ctx);

  if (!DATA.groups[id]) {
    DATA.groups[id] = {
      id: ctx.chat.id,
      title: ctx.chat.title || '',
      members: {},
      interactions: {},
      ranks: {},
      muted: {},
      globalMuted: {},
      restricted: {},
      banned: {},
      warnings: {},
      titles: {},
      forbiddenWords: [],
      customCommands: {},
      customReplies: {},
      lockedCommands: {},
      pendingCommandLock: {},
      protection: {
        enabled: false,
        violations: true,
        links: false,
        mentions: false,
        forwards: false,
        edits: false,
        spam: false,
        ads: false,
        commands: false,
        media: false,
        photos: false,
        videos: false,
        files: false,
        stickers: false,
        gifs: false,
        audio: false,
        voice: false,
        longMessages: false,
        phoneNumbers: false,
        channelIds: false,
        bots: false
      },
      cleaning: {
        auto: false
      },
      games: {
        enabled: true,
        active: null
      },
      bank: {},
      music: {
        queue: [],
        playing: false
      },
      voice: {
        active: false,
        startedAt: null
      },
      adminLogs: [],
      settings: {
        botEnabled: true,
        replies: true
      },
      createdAt: Date.now()
    };
  }

  DATA.groups[id].title = ctx.chat.title || DATA.groups[id].title;

  saveData();

  return DATA.groups[id];
}

/* =========================================================
   Reply
========================================================= */

async function reply(ctx, text, extra = {}) {
  if (!ctx || !ctx.reply) return null;

  const options = {
    parse_mode: 'HTML',
    ...extra
  };

  if (
    ctx.message &&
    ctx.message.message_id
  ) {
    options.reply_parameters = {
      message_id: ctx.message.message_id
    };
  }

  try {
    return await ctx.reply(text, options);
  } catch (error) {
    try {
      return await ctx.reply(
        String(text).replace(/<[^>]*>/g, ''),
        extra
      );
    } catch {
      return null;
    }
  }
}

/* =========================================================
   صلاحيات تيليجرام
========================================================= */

async function getMember(ctx, userId) {
  try {
    return await ctx.telegram.getChatMember(
      ctx.chat.id,
      userId
    );
  } catch {
    return null;
  }
}

async function botIsAdmin(ctx) {
  try {
    const me = await ctx.telegram.getMe();

    const member = await ctx.telegram.getChatMember(
      ctx.chat.id,
      me.id
    );

    return (
      member.status === 'administrator' ||
      member.status === 'creator'
    );
  } catch {
    return false;
  }
}

function telegramAdmin(member) {
  if (!member) return false;

  return (
    member.status === 'administrator' ||
    member.status === 'creator'
  );
}

/* =========================================================
   حماية الرتب
========================================================= */

async function targetFromReply(ctx) {
  if (
    !ctx.message ||
    !ctx.message.reply_to_message ||
    !ctx.message.reply_to_message.from
  ) {
    return null;
  }

  const target = ctx.message.reply_to_message.from;

  ensureUser(target);

  return target;
}

async function checkTargetRank(ctx, targetId) {
  const actorRank = getRank(ctx.from.id);
  const targetRank = getRank(targetId);

  if (String(targetId) === String(ctx.from.id)) {
    await reply(
      ctx,
      '• ما تقدر تستخدم الأمر على نفسك.'
    );
    return false;
  }

  if (targetRank >= actorRank) {
    await reply(
      ctx,
      '• ما تقدر تستخدم الأمر على رتبة مساوية أو أعلى من رتبتك.'
    );
    return false;
  }

  return true;
}

/* =========================================================
   صلاحية الأمر
========================================================= */

function commandLockKey(command) {
  return normalize(command)
    .replace(/^[/!#.]+/, '')
    .trim();
}

function commandIsLocked(group, command) {
  if (!group) return null;

  const key = commandLockKey(command);

  if (
    group.lockedCommands &&
    Object.prototype.hasOwnProperty.call(
      group.lockedCommands,
      key
    )
  ) {
    return group.lockedCommands[key];
  }

  return null;
}

async function checkCommandAccess(ctx, command) {
  if (!isGroup(ctx)) return true;

  const group = ensureGroup(ctx);

  const required = commandIsLocked(
    group,
    command
  );

  if (required === null) {
    return true;
  }

  const userRank = getRank(ctx.from.id);

  if (userRank >= required) {
    return true;
  }

  await reply(
    ctx,
    `• الأمر متاح من رتبة ${escapeHtml(
      getRankName(required)
    )} فأعلى`
  );

  return false;
}

/* =========================================================
   قفل الأمر / فتح الأمر
========================================================= */

async function handleLockCommand(ctx, text) {
  if (!isGroup(ctx)) return false;

  if (!hasRank(ctx.from.id, RANKS.DEV)) {
    await reply(
      ctx,
      '• هذا الأمر يخص ↤ ｢ Dev 🎖 ｣'
    );
    return true;
  }

  const match = text.match(/^قفل\s+امر\s+(.+)$/i);

  if (!match) return false;

  const command = cleanText(match[1]);

  if (!command) {
    await reply(
      ctx,
      '• اكتب الأمر الذي تريد قفله.'
    );
    return true;
  }

  const group = ensureGroup(ctx);

  group.pendingCommandLock[userKey(ctx.from.id)] = {
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

async function handlePendingCommandLock(ctx, text) {
  if (!isGroup(ctx)) return false;

  const group = ensureGroup(ctx);

  const pending =
    group.pendingCommandLock &&
    group.pendingCommandLock[userKey(ctx.from.id)];

  if (!pending) {
    return false;
  }

  const rank = requestedRank(text);

  if (rank === null) {
    await reply(
      ctx,
      '• الرتبة غير معروفة.\n\n' +
      'الرتب المتاحة:\n' +
      'عضو\n' +
      'مميز\n' +
      'مالك\n' +
      'مالك أساسي\n' +
      'Myth\n' +
      'My\n' +
      'Dev²\n' +
      'Dev🎖️'
    );

    return true;
  }

  const key = commandLockKey(
    pending.command
  );

  group.lockedCommands[key] = rank;

  delete group.pendingCommandLock[
    userKey(ctx.from.id)
  ];

  saveData();

  await reply(
    ctx,
    `• تم قفل الأمر <b>${escapeHtml(
      pending.command
    )}</b>\n\n` +
    `• متاح من رتبة ${escapeHtml(
      getRankName(rank)
    )} فأعلى`
  );

  return true;
}

async function handleUnlockCommand(ctx, text) {
  if (!isGroup(ctx)) return false;

  if (!hasRank(ctx.from.id, RANKS.DEV)) {
    await reply(
      ctx,
      '• هذا الأمر يخص ↤ ｢ Dev 🎖 ｣'
    );
    return true;
  }

  const match = text.match(/^فتح\s+امر\s+(.+)$/i);

  if (!match) return false;

  const command = cleanText(match[1]);
  const group = ensureGroup(ctx);
  const key = commandLockKey(command);

  if (!group.lockedCommands[key]) {
    await reply(
      ctx,
      '• هذا الأمر غير مقفل.'
    );
    return true;
  }

  delete group.lockedCommands[key];

  saveData();

  await reply(
    ctx,
    `• تم فتح الأمر <b>${escapeHtml(
      command
    )}</b>`
  );

  return true;
}

/* =========================================================
   التفاعل
========================================================= */

function addInteraction(ctx) {
  if (!isGroup(ctx) || !ctx.from) return;

  const group = ensureGroup(ctx);
  const id = userKey(ctx.from.id);

  if (!group.interactions[id]) {
    group.interactions[id] = {
      id: ctx.from.id,
      username: ctx.from.username || '',
      firstName: ctx.from.first_name || '',
      count: 0
    };
  }

  const item = group.interactions[id];

  item.username =
    ctx.from.username || item.username || '';

  item.firstName =
    ctx.from.first_name || item.firstName || '';

  item.count += 1;

  const user = ensureUser(ctx.from);

  if (user) {
    user.stats.messages =
      Number(user.stats.messages || 0) + 1;
  }

  saveData();
}

function interactionList(group) {
  return Object.values(
    group.interactions || {}
  ).sort(
    (a, b) =>
      Number(b.count || 0) -
      Number(a.count || 0)
  );
}

function interactionName(item) {
  if (item.firstName) {
    return item.firstName;
  }

  if (item.username) {
    return `@${item.username}`;
  }

  return String(item.id);
}

async function showMyInteraction(ctx) {
  if (!isGroup(ctx)) return;

  const group = ensureGroup(ctx);
  const id = userKey(ctx.from.id);

  const list = interactionList(group);

  const current =
    group.interactions[id] || {
      count: 0
    };

  const index = list.findIndex(
    x => String(x.id) === String(ctx.from.id)
  );

  const position =
    index === -1 ? '-' : index + 1;

  await reply(
    ctx,
    `• رتبتك هي ↤ ${escapeHtml(
      getRankName(getRank(ctx.from.id))
    )}\n\n` +
    `• رسائلك بالتفاعل  ↤  ${Number(
      current.count || 0
    )}\n` +
    `• ترتيبك بالمتفاعلين ↤ ${position}\n-`
  );
}

async function showReplyInteraction(ctx) {
  if (!isGroup(ctx)) return;

  const target = await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على الشخص أولًا.'
    );
    return;
  }

  const group = ensureGroup(ctx);
  const list = interactionList(group);
  const item = group.interactions[userKey(target.id)] || {
    count: 0
  };

  const index = list.findIndex(
    x => String(x.id) === String(target.id)
  );

  const position =
    index === -1 ? '-' : index + 1;

  await reply(
    ctx,
    `• رتبة ${escapeHtml(
      displayName(target)
    )} هي ↤ ${escapeHtml(
      getRankName(getRank(target.id))
    )}\n\n` +
    `• رسائله بالتفاعل ↤ ${Number(
      item.count || 0
    )}\n` +
    `• ترتيبه بالمتفاعلين ↤ ${position}\n-`
  );
}

async function showTopInteractions(ctx) {
  if (!isGroup(ctx)) return;

  const group = ensureGroup(ctx);

  const list = interactionList(group)
    .slice(0, 20);

  if (!list.length) {
    await reply(
      ctx,
      '• لا يوجد متفاعلين حاليًا.'
    );
    return;
  }

  const medals = [
    '🥇',
    '🥈',
    '🥉'
  ];

  let text =
    'توب اكثر 20 متفاعلين بالقروب :\n' +
    '━━━━━━━━━\n\n';

  list.forEach((item, index) => {
    const prefix =
      medals[index] ||
      `${index + 1}`;

    text +=
      `${prefix} ) ${Number(
        item.count || 0
      ).toLocaleString('en-US')}  l ${escapeHtml(
        interactionName(item)
      )}\n`;
  });

  const mine =
    group.interactions[
      userKey(ctx.from.id)
    ];

  if (mine) {
    text +=
      `\n━━━━━━━━━\n` +
      `• you)  ${Number(
        mine.count || 0
      ).toLocaleString('en-US')}  l ${escapeHtml(
        interactionName(mine)
      )}`;
  }

  await reply(ctx, text);
}

async function resetInteractions(ctx) {
  if (!isGroup(ctx)) return;

  if (!hasRank(ctx.from.id, RANKS.DEV2)) {
    await reply(
      ctx,
      '• هذا الأمر يخص ↤ ｢ Dev²🎖 ｣'
    );
    return;
  }

  const group = ensureGroup(ctx);

  group.interactions = {};

  saveData();

  await reply(
    ctx,
    '• تم تصفير المتفاعلين بنجاح.'
  );
}

/* =========================================================
   الرتبة
========================================================= */

async function showMyRank(ctx) {
  await reply(
    ctx,
    `• رتبتك هي ↤ ${escapeHtml(
      getRankName(getRank(ctx.from.id))
    )}`
  );
}

async function showReplyRank(ctx) {
  const target = await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على الشخص أولًا.'
    );
    return;
  }

  await reply(
    ctx,
    `• رتبة ${escapeHtml(
      displayName(target)
    )} هي ↤ ${escapeHtml(
      getRankName(getRank(target.id))
    )}`
  );
}

/* =========================================================
   رفع الرتب
========================================================= */

function promotionRank(text) {
  const t = normalize(text);

  if (t === 'رفع مميز') return RANKS.VIP;
  if (t === 'رفع مالك') return RANKS.OWNER;

  if (
    t === 'رفع مالك اساسي' ||
    t === 'رفع مالك أساسي' ||
    t === 'رفع اساس'
  ) {
    return RANKS.BASIC_OWNER;
  }

  if (
    t === 'رفع myth' ||
    t === 'رفع m'
  ) {
    return RANKS.MYTH;
  }

  if (
    t === 'رفع my' ||
    t === 'رفع myth 🎖️' ||
    t === 'رفع اكس'
  ) {
    return RANKS.MYTH_STAR;
  }

  if (
    t === 'رفع dev²' ||
    t === 'رفع dev2' ||
    t === 'رفع مطور ثانوي'
  ) {
    return RANKS.DEV2;
  }

  if (
    t === 'رفع ديف' ||
    t === 'رفع dev'
  ) {
    return RANKS.DEV;
  }

  return null;
}

async function promoteUser(ctx, rank) {
  const target = await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو الذي تريد رفع رتبته.'
    );
    return;
  }

  if (!await checkTargetRank(ctx, target.id)) {
    return;
  }

  const actorRank = getRank(ctx.from.id);

  if (rank >= actorRank) {
    await reply(
      ctx,
      '• لا يمكنك إعطاء رتبة مساوية أو أعلى من رتبتك.'
    );
    return;
  }

  if (rank >= RANKS.DEV2 &&
      !isOwner(
        ctx.from.id,
        ctx.from.username
      )) {
    await reply(
      ctx,
      '• هذا الأمر يخص ↤ ｢ Dev 🎖 ｣'
    );
    return;
  }

  ensureUser(target);

  DATA.users[userKey(target.id)].rank = rank;

  saveData();

  await reply(
    ctx,
    `• تم رفع ${escapeHtml(
      displayName(target)
    )}\n` +
    `• الرتبة ↤ ${escapeHtml(
      getRankName(rank)
    )}`
  );
}

async function demoteUser(ctx) {
  const target = await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو الذي تريد تنزيل رتبته.'
    );
    return;
  }

  if (!await checkTargetRank(ctx, target.id)) {
    return;
  }

  const actorRank = getRank(ctx.from.id);

  if (
    actorRank < RANKS.MYTH_STAR &&
    getRank(target.id) >= RANKS.MYTH_STAR
  ) {
    await reply(
      ctx,
      '• هذا الأمر يخص ↤ ｢ Myth 🎖️ ｣ فأعلى'
    );
    return;
  }

  ensureUser(target);

  DATA.users[userKey(target.id)].rank =
    Math.max(
      0,
      getRank(target.id) - 1
    );

  saveData();

  await reply(
    ctx,
    `• تم تنزيل ${escapeHtml(
      displayName(target)
    )}\n` +
    `• الرتبة ↤ ${escapeHtml(
      getRankName(
        getRank(target.id)
      )
    )}`
  );
}

/* =========================================================
   المشرف
========================================================= */

async function promoteAdmin(ctx) {
  if (!isGroup(ctx)) return;

  if (!hasRank(ctx.from.id, RANKS.DEV)) {
    await reply(
      ctx,
      '• هذا الأمر يخص ↤ ｢ Dev 🎖 ｣'
    );
    return;
  }

  if (!await botIsAdmin(ctx)) {
    await reply(
      ctx,
      '• لازم أكون مشرف في القروب أولًا.'
    );
    return;
  }

  const target = await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على الشخص الذي تريد رفعه مشرف.'
    );
    return;
  }

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

    await reply(
      ctx,
      `• تم رفع ${escapeHtml(
        displayName(target)
      )} مشرف بنجاح.`
    );
  } catch (error) {
    console.error(error);

    await reply(
      ctx,
      '• ما قدرت أرفع العضو مشرف، تأكد أن صلاحياتي تسمح بذلك.'
    );
  }
}

async function demoteAdmin(ctx) {
  if (!isGroup(ctx)) return;

  if (!hasRank(ctx.from.id, RANKS.DEV)) {
    await reply(
      ctx,
      '• هذا الأمر يخص ↤ ｢ Dev 🎖 ｣'
    );
    return;
  }

  const target = await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على المشرف.'
    );
    return;
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

    await reply(
      ctx,
      `• تم تنزيل ${escapeHtml(
        displayName(target)
      )} من الإشراف.`
    );
  } catch {
    await reply(
      ctx,
      '• تعذر تنزيل المشرف.'
    );
  }
}

async function showPermissions(ctx) {
  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على المستخدم.'
    );
    return;
  }

  const member =
    await getMember(
      ctx,
      target.id
    );

  if (!member) {
    await reply(
      ctx,
      '• تعذر معرفة صلاحيات المستخدم.'
    );
    return;
  }

  if (member.status === 'creator') {
    await reply(
      ctx,
      '• المستخدم هو مالك القروب.'
    );
    return;
  }

  if (member.status !== 'administrator') {
    await reply(
      ctx,
      '• المستخدم ليس مشرفًا.'
    );
    return;
  }

  const p = member;

  const permissions = [];

  if (p.can_manage_chat) permissions.push('إدارة القروب');
  if (p.can_delete_messages) permissions.push('حذف الرسائل');
  if (p.can_manage_video_chats) permissions.push('المكالمات');
  if (p.can_restrict_members) permissions.push('تقييد الأعضاء');
  if (p.can_promote_members) permissions.push('إضافة مشرفين');
  if (p.can_change_info) permissions.push('تعديل المعلومات');
  if (p.can_invite_users) permissions.push('دعوة الأعضاء');
  if (p.can_pin_messages) permissions.push('تثبيت الرسائل');
  if (p.can_manage_topics) permissions.push('إدارة المواضيع');

  await reply(
    ctx,
    `• صلاحيات ${escapeHtml(
      displayName(target)
    )}:\n\n` +
    (
      permissions.length
        ? permissions.map(
            x => `• ${escapeHtml(x)}`
          ).join('\n')
        : '• لا توجد صلاحيات إضافية.'
    )
  );
}

/* =========================================================
   الكتم
========================================================= */

async function muteUser(ctx, global = false) {
  if (!isGroup(ctx)) return;

  const target = await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  if (!await checkTargetRank(ctx, target.id)) {
    return;
  }

  if (!await botIsAdmin(ctx)) {
    await reply(
      ctx,
      '• لازم أكون مشرف.'
    );
    return;
  }

  const group = ensureGroup(ctx);
  const id = userKey(target.id);

  if (global) {
    group.globalMuted[id] = {
      id: target.id,
      name: displayName(target),
      since: Date.now()
    };
  } else {
    group.muted[id] = {
      id: target.id,
      name: displayName(target),
      since: Date.now()
    };
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
  } catch {}

  saveData();

  await reply(
    ctx,
    global
      ? `• تم كتم ${escapeHtml(
          displayName(target)
        )} عام.`
      : `• تم كتم ${escapeHtml(
          displayName(target)
        )}.`
  );
}

async function unmuteUser(ctx, global = false) {
  if (!isGroup(ctx)) return;

  const target = await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  const group = ensureGroup(ctx);
  const id = userKey(target.id);

  if (global) {
    delete group.globalMuted[id];
  } else {
    delete group.muted[id];
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
  } catch {}

  saveData();

  await reply(
    ctx,
    global
      ? '• تم فك الكتم العام.'
      : '• تم فك الكتم.'
  );
}

async function clearMuted(ctx, global = false) {
  if (!isGroup(ctx)) return;

  const group = ensureGroup(ctx);

  if (!hasRank(ctx.from.id, RANKS.MYTH_STAR)) {
    await reply(
      ctx,
      '• هذا الأمر متاح من رتبة Myth 🎖️ فأعلى.'
    );
    return;
  }

  const object = global
    ? group.globalMuted
    : group.muted;

  const count = Object.keys(object).length;

  if (!count) {
    await reply(
      ctx,
      global
        ? '• لا يوجد مكتومين عام'
        : '• لا يوجد مكتومين'
    );
    return;
  }

  group[global ? 'globalMuted' : 'muted'] = {};

  saveData();

  await reply(
    ctx,
    global
      ? `• تم مسح ( ${count} ) من المكتومين عام`
      : `• تم مسح ( ${count} ) من المكتومين`
  );
}

async function listMuted(ctx) {
  if (!isGroup(ctx)) return;

  const group = ensureGroup(ctx);

  const list = Object.values(
    group.muted || {}
  );

  if (!list.length) {
    await reply(
      ctx,
      '• لا يوجد مكتومين.'
    );
    return;
  }

  let text =
    '• قائمة المكتومين :\n' +
    '━━━━━━━━━\n';

  list.forEach((x, i) => {
    text +=
      `${i + 1} ) ${escapeHtml(
        x.name
      )}\n`;
  });

  text += '━━━━━━━━━';

  await reply(ctx, text);
}

/* =========================================================
   التقييد
========================================================= */

async function restrictUser(ctx) {
  if (!isGroup(ctx)) return;

  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  if (!await checkTargetRank(ctx, target.id)) {
    return;
  }

  const group = ensureGroup(ctx);

  group.restricted[
    userKey(target.id)
  ] = {
    id: target.id,
    name: displayName(target),
    since: Date.now()
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

  await reply(
    ctx,
    `• تم تقييد ${escapeHtml(
      displayName(target)
    )}.`
  );
}

async function unrestrictUser(ctx) {
  if (!isGroup(ctx)) return;

  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  const group = ensureGroup(ctx);

  delete group.restricted[
    userKey(target.id)
  ];

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

  await reply(
    ctx,
    '• تم إلغاء التقييد.'
  );
}

async function listRestricted(ctx) {
  if (!isGroup(ctx)) return;

  const group = ensureGroup(ctx);

  if (!hasRank(ctx.from.id, RANKS.DEV2)) {
    await reply(
      ctx,
      '• هذا الأمر يخص ↤ ｢ Dev²🎖 ｣'
    );
    return;
  }

  const list = Object.values(
    group.restricted || {}
  );

  if (!list.length) {
    await reply(
      ctx,
      '• لا يوجد مقيدين.'
    );
    return;
  }

  let text =
    '• قائمة المقيدين :\n' +
    '━━━━━━━━━\n';

  list.forEach((x, i) => {
    text +=
      `${i + 1} ) ${escapeHtml(
        x.name
      )}\n`;
  });

  text += '━━━━━━━━━';

  await reply(ctx, text);
}

async function clearRestricted(ctx) {
  if (!isGroup(ctx)) return;

  const group = ensureGroup(ctx);

  if (!hasRank(ctx.from.id, RANKS.MYTH_STAR)) {
    await reply(
      ctx,
      '• هذا الأمر متاح من رتبة Myth 🎖️ فأعلى.'
    );
    return;
  }

  const count =
    Object.keys(
      group.restricted || {}
    ).length;

  if (!count) {
    await reply(
      ctx,
      '• لا يوجد مقيدين'
    );
    return;
  }

  group.restricted = {};

  saveData();

  await reply(
    ctx,
    `• تم مسح ( ${count} ) من المقيدين`
  );
}

/* =========================================================
   الحظر والطرد
========================================================= */

async function banUser(ctx) {
  if (!isGroup(ctx)) return;

  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  if (!await checkTargetRank(ctx, target.id)) {
    return;
  }

  const group = ensureGroup(ctx);

  group.banned[
    userKey(target.id)
  ] = {
    id: target.id,
    name: displayName(target),
    since: Date.now()
  };

  try {
    await ctx.telegram.banChatMember(
      ctx.chat.id,
      target.id
    );
  } catch {}

  saveData();

  await reply(
    ctx,
    `• تم حظر ${escapeHtml(
      displayName(target)
    )}.`
  );
}

async function unbanUser(ctx) {
  if (!isGroup(ctx)) return;

  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  const group = ensureGroup(ctx);

  delete group.banned[
    userKey(target.id)
  ];

  try {
    await ctx.telegram.unbanChatMember(
      ctx.chat.id,
      target.id,
      {
        only_if_banned: false
      }
    );
  } catch {}

  saveData();

  await reply(
    ctx,
    '• تم فك الحظر.'
  );
}

async function kickUser(ctx) {
  if (!isGroup(ctx)) return;

  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  if (!await checkTargetRank(ctx, target.id)) {
    return;
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
  } catch {}

  await reply(
    ctx,
    `• تم طرد ${escapeHtml(
      displayName(target)
    )}.`
  );
}

/* =========================================================
   التحذيرات
========================================================= */

async function warnUser(ctx) {
  if (!isGroup(ctx)) return;

  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  if (!await checkTargetRank(ctx, target.id)) {
    return;
  }

  const group = ensureGroup(ctx);
  const id = userKey(target.id);

  group.warnings[id] =
    Number(group.warnings[id] || 0) + 1;

  const count = group.warnings[id];

  saveData();

  if (count >= 3) {
    await muteUser(ctx);
    group.warnings[id] = 0;
    saveData();

    await reply(
      ctx,
      `• وصل ${escapeHtml(
        displayName(target)
      )} إلى 3 إنذارات وتم كتمه تلقائيًا.`
    );

    return;
  }

  await reply(
    ctx,
    `• تم تحذير ${escapeHtml(
      displayName(target)
    )}\n` +
    `• عدد التحذيرات ↤ ${count}/3`
  );
}

async function clearWarning(ctx) {
  if (!isGroup(ctx)) return;

  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  const group = ensureGroup(ctx);

  delete group.warnings[
    userKey(target.id)
  ];

  saveData();

  await reply(
    ctx,
    '• تم إلغاء التحذيرات.'
  );
}

/* =========================================================
   الحماية
========================================================= */

async function protectionToggle(ctx, key, value) {
  if (!isGroup(ctx)) return;

  if (!hasRank(ctx.from.id, RANKS.DEV)) {
    await reply(
      ctx,
      '• هذا الأمر يخص ↤ ｢ Dev 🎖 ｣'
    );
    return;
  }

  const group = ensureGroup(ctx);

  group.protection[key] = value;

  saveData();

  await reply(
    ctx,
    `• تم ${value ? 'فتح' : 'قفل'} ${escapeHtml(
      key
    )}.`
  );
}

async function protectionStatus(ctx) {
  if (!isGroup(ctx)) return;

  const group = ensureGroup(ctx);

  const p = group.protection;

  await reply(
    ctx,
    `• حالة الحماية:\n\n` +
    `• المخالفات ↤ ${p.violations ? 'مفتوحة' : 'مقفلة'}\n` +
    `• الروابط ↤ ${p.links ? 'مفتوحة' : 'مقفلة'}\n` +
    `• المنشن ↤ ${p.mentions ? 'مفتوح' : 'مقفل'}\n` +
    `• التعديلات ↤ ${p.edits ? 'مفتوحة' : 'مقفلة'}\n` +
    `• السبام ↤ ${p.spam ? 'مفتوح' : 'مقفل'}\n` +
    `• الإعلانات ↤ ${p.ads ? 'مفتوحة' : 'مقفلة'}`
  );
}

/* =========================================================
   الكلمات الممنوعة
========================================================= */

async function addForbiddenWord(ctx, word) {
  if (!isGroup(ctx)) return;

  if (!hasRank(ctx.from.id, RANKS.DEV2)) {
    await reply(
      ctx,
      '• هذا الأمر يخص ↤ ｢ Dev²🎖 ｣'
    );
    return;
  }

  const group = ensureGroup(ctx);

  word = cleanText(word);

  if (!word) {
    await reply(
      ctx,
      '• اكتب الكلمة بعد الأمر.'
    );
    return;
  }

  if (!group.forbiddenWords.includes(
    normalize(word)
  )) {
    group.forbiddenWords.push(
      normalize(word)
    );
  }

  saveData();

  await reply(
    ctx,
    `• تمت إضافة الكلمة الممنوعة: ${escapeHtml(
      word
    )}`
  );
}

async function removeForbiddenWord(ctx, word) {
  if (!isGroup(ctx)) return;

  if (!hasRank(ctx.from.id, RANKS.DEV2)) {
    await reply(
      ctx,
      '• هذا الأمر يخص ↤ ｢ Dev²🎖 ｣'
    );
    return;
  }

  const group = ensureGroup(ctx);

  word = normalize(word);

  group.forbiddenWords =
    group.forbiddenWords.filter(
      x => x !== word
    );

  saveData();

  await reply(
    ctx,
    '• تم إلغاء منع الكلمة.'
  );
}

async function listForbiddenWords(ctx) {
  if (!isGroup(ctx)) return;

  const group = ensureGroup(ctx);

  if (!group.forbiddenWords.length) {
    await reply(
      ctx,
      '• لا توجد كلمات ممنوعة.'
    );
    return;
  }

  await reply(
    ctx,
    `• الكلمات الممنوعة:\n\n` +
    group.forbiddenWords
      .map(
        (x, i) =>
          `${i + 1} ) ${escapeHtml(x)}`
      )
      .join('\n')
  );
}

async function clearForbiddenWords(ctx) {
  if (!isGroup(ctx)) return;

  if (!hasRank(ctx.from.id, RANKS.DEV2)) {
    await reply(
      ctx,
      '• هذا الأمر يخص ↤ ｢ Dev²🎖 ｣'
    );
    return;
  }

  const group = ensureGroup(ctx);

  group.forbiddenWords = [];

  saveData();

  await reply(
    ctx,
    '• تم مسح الكلمات الممنوعة.'
  );
}

/* =========================================================
   العناوين
========================================================= */

async function setTitle(ctx, title) {
  if (!isGroup(ctx)) return;

  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  const group = ensureGroup(ctx);

  group.titles[
    userKey(target.id)
  ] = cleanText(title);

  saveData();

  await reply(
    ctx,
    `• تم وضع اللقب على ${escapeHtml(
      displayName(target)
    )}`
  );
}

async function showTitle(ctx, own = true) {
  if (!isGroup(ctx)) return;

  const group = ensureGroup(ctx);

  let id = ctx.from.id;

  if (!own) {
    const target =
      await targetFromReply(ctx);

    if (!target) {
      await reply(
        ctx,
        '• قم بالرد على العضو.'
      );
      return;
    }

    id = target.id;
  }

  const title =
    group.titles[userKey(id)];

  await reply(
    ctx,
    title
      ? `• اللقب ↤ ${escapeHtml(title)}`
      : '• لا يوجد لقب.'
  );
}

/* =========================================================
   تنظيف
========================================================= */

const CLEAN_TYPES = {
  0: 'text',
  1: 'photo',
  2: 'video',
  3: 'document',
  4: 'sticker',
  5: 'animation',
  6: 'audio',
  7: 'voice',
  8: 'links',
  9: 'all'
};

async function cleanMessages(ctx, amount) {
  if (!isGroup(ctx)) return;

  if (!hasRank(ctx.from.id, RANKS.MYTH_STAR)) {
    await reply(
      ctx,
      '• هذا الأمر متاح من رتبة Myth 🎖️ فأعلى.'
    );
    return;
  }

  if (!await botIsAdmin(ctx)) {
    await reply(
      ctx,
      '• لازم أكون مشرف.'
    );
    return;
  }

  amount = Math.min(
    Math.max(
      Number(amount || 10),
      1
    ),
    100
  );

  let messageId =
    ctx.message.message_id;

  let deleted = 0;

  for (
    let i = 0;
    i < amount;
    i++
  ) {
    try {
      await ctx.telegram.deleteMessage(
        ctx.chat.id,
        messageId - i
      );

      deleted++;
    } catch {}
  }

  try {
    await ctx.telegram.sendMessage(
      ctx.chat.id,
      `• تم تنظيف ( ${deleted} ) رسالة`
    );
  } catch {}
}

/* =========================================================
   الأوامر المخصصة
========================================================= */

async function addCustomReply(ctx, word, response) {
  if (!isGroup(ctx)) return;

  if (!hasRank(ctx.from.id, RANKS.MYTH_STAR)) {
    await reply(
      ctx,
      '• هذا الأمر متاح من رتبة Myth 🎖️ فأعلى.'
    );
    return;
  }

  const group = ensureGroup(ctx);

  word = cleanText(word);
  response = cleanText(response);

  if (!word || !response) {
    await reply(
      ctx,
      '• الصيغة:\nاضف رد الكلمة | الرد'
    );
    return;
  }

  group.customReplies[
    normalize(word)
  ] = response;

  saveData();

  await reply(
    ctx,
    `• تم إضافة الرد:\n` +
    `• الكلمة ↤ ${escapeHtml(word)}`
  );
}

async function deleteCustomReply(ctx, word) {
  if (!isGroup(ctx)) return;

  if (!hasRank(ctx.from.id, RANKS.MYTH_STAR)) {
    await reply(
      ctx,
      '• هذا الأمر متاح من رتبة Myth 🎖️ فأعلى.'
    );
    return;
  }

  const group = ensureGroup(ctx);

  delete group.customReplies[
    normalize(word)
  ];

  saveData();

  await reply(
    ctx,
    '• تم حذف الرد.'
  );
}

async function listCustomReplies(ctx) {
  if (!isGroup(ctx)) return;

  const group = ensureGroup(ctx);

  const keys =
    Object.keys(group.customReplies || {});

  if (!keys.length) {
    await reply(
      ctx,
      '• لا توجد ردود مضافة.'
    );
    return;
  }

  let text =
    '• ردودي:\n' +
    '━━━━━━━━━\n';

  keys.forEach((key, index) => {
    text +=
      `${index + 1} ) ${escapeHtml(
        key
      )}\n`;
  });

  text += '━━━━━━━━━';

  await reply(ctx, text);
}

/* =========================================================
   الأوامر المخصصة بنظام "اضف امر"
========================================================= */

async function addCustomCommand(ctx, name, response) {
  if (!isGroup(ctx)) return;

  if (!hasRank(ctx.from.id, RANKS.MYTH_STAR)) {
    await reply(
      ctx,
      '• هذا الأمر متاح من رتبة Myth 🎖️ فأعلى.'
    );
    return;
  }

  const group = ensureGroup(ctx);

  name = cleanText(name);
  response = cleanText(response);

  if (!name || !response) {
    await reply(
      ctx,
      '• الصيغة:\nاضف امر الاسم | الرد'
    );
    return;
  }

  group.customCommands[
    commandLockKey(name)
  ] = response;

  saveData();

  await reply(
    ctx,
    '• تم إضافة الأمر بنجاح.'
  );
}

async function deleteCustomCommand(ctx, name) {
  if (!isGroup(ctx)) return;

  if (!hasRank(ctx.from.id, RANKS.MYTH_STAR)) {
    await reply(
      ctx,
      '• هذا الأمر متاح من رتبة Myth 🎖️ فأعلى.'
    );
    return;
  }

  const group = ensureGroup(ctx);

  delete group.customCommands[
    commandLockKey(name)
  ];

  saveData();

  await reply(
    ctx,
    '• تم حذف الأمر.'
  );
}

async function listCustomCommands(ctx) {
  if (!isGroup(ctx)) return;

  const group = ensureGroup(ctx);

  const keys =
    Object.keys(group.customCommands || {});

  if (!keys.length) {
    await reply(
      ctx,
      '• لا توجد أوامر مضافة.'
    );
    return;
  }

  await reply(
    ctx,
    `• اوامري:\n\n` +
    keys.map(
      (x, i) =>
        `${i + 1} ) ${escapeHtml(x)}`
    ).join('\n')
  );
}

/* =========================================================
   الاقتصاد
========================================================= */

async function money(ctx, targetMode = false) {
  const target = targetMode
    ? await targetFromReply(ctx)
    : ctx.from;

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  const user = ensureUser(target);

  await reply(
    ctx,
    `• رصيد ${escapeHtml(
      displayName(target)
    )} ↤ ${Number(
      user.money || 0
    ).toLocaleString('en-US')} ريال`
  );
}

async function createBank(ctx) {
  const user = ensureUser(ctx.from);

  if (user.bank) {
    await reply(
      ctx,
      '• لديك حساب بنكي بالفعل.'
    );
    return;
  }

  user.bank = {
    number:
      String(ctx.from.id).slice(-6) +
      String(Date.now()).slice(-4),
    createdAt: Date.now()
  };

  saveData();

  await reply(
    ctx,
    '• تم إنشاء حسابك البنكي.'
  );
}

async function account(ctx) {
  const user = ensureUser(ctx.from);

  await reply(
    ctx,
    `• حسابك:\n\n` +
    `• الرصيد ↤ ${Number(
      user.money || 0
    ).toLocaleString('en-US')}\n` +
    `• البنك ↤ ${user.bank ? 'موجود' : 'غير موجود'}`
  );
}

async function giftMoney(ctx, amount) {
  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على الشخص الذي تريد إهداءه.'
    );
    return;
  }

  amount = Number(amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    await reply(
      ctx,
      '• المبلغ غير صحيح.'
    );
    return;
  }

  const sender = ensureUser(ctx.from);
  const receiver = ensureUser(target);

  if (
    Number(sender.money || 0) <
    amount
  ) {
    await reply(
      ctx,
      '• رصيدك لا يكفي.'
    );
    return;
  }

  sender.money -= amount;
  receiver.money += amount;

  saveData();

  await reply(
    ctx,
    `• تم إهداء ${Number(
      amount
    ).toLocaleString('en-US')} ريال إلى ${escapeHtml(
      displayName(target)
    )}.`
  );
}

/* =========================================================
   الألعاب
========================================================= */

async function toggleGames(ctx, enabled) {
  if (!isGroup(ctx)) return;

  if (!hasRank(ctx.from.id, RANKS.DEV)) {
    await reply(
      ctx,
      '• هذا الأمر يخص ↤ ｢ Dev 🎖 ｣'
    );
    return;
  }

  const group = ensureGroup(ctx);

  group.games.enabled = enabled;

  if (!enabled) {
    group.games.active = null;
  }

  saveData();

  await reply(
    ctx,
    enabled
      ? '• تم فتح الألعاب.'
      : '• تم قفل الألعاب.'
  );
}

/* =========================================================
   الهمسة
========================================================= */

function whisperId() {
  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2, 8)
  );
}

async function startWhisper(ctx) {
  if (!isGroup(ctx)) return;

  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• الهمسة تبدأ بالرد على الشخص.'
    );
    return;
  }

  const id = whisperId();

  if (!DATA.whispers) {
    DATA.whispers = {};
  }

  DATA.whispers[id] = {
    id,
    senderId: ctx.from.id,
    senderName: displayName(ctx.from),
    targetId: target.id,
    targetName: displayName(target),
    chatId: ctx.chat.id,
    content: null,
    createdAt: Date.now(),
    viewed: false,
    replied: false
  };

  saveData();

  const botInfo =
    await ctx.telegram.getMe();

  const viewUrl =
    `https://t.me/${botInfo.username}?start=whisper_${id}`;

  const replyUrl =
    `https://t.me/${botInfo.username}?start=whisperreply_${id}`;

  await reply(
    ctx,
    `• 💌 لديك همسة من ${escapeHtml(
      displayName(ctx.from)
    )}\n\n` +
    `• اضغط على الزر لرؤية الهمسة.`,
    {
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            'رؤية الهمسه',
            viewUrl
          ),
          Markup.button.url(
            'رد على الهمسه',
            replyUrl
          )
        ]
      ])
    }
  );
}

/* =========================================================
   المالك
========================================================= */

async function ownerInfo(ctx) {
  const user =
    getUserById(
      OWNER_ID
    );

  let ownerName =
    user
      ? displayName(user)
      : OWNER_USERNAME;

  await reply(
    ctx,
    `• المالك\n\n` +
    `• الاسم ↤ ${escapeHtml(
      ownerName
    )}\n` +
    `• اليوزر ↤ @${OWNER_USERNAME}`,
    {
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            'المطور',
            `https://t.me/${OWNER_USERNAME}`
          )
        ]
      ])
    }
  );
}

/* =========================================================
   /start في الخاص
========================================================= */

async function privateStart(ctx) {
  ensureUser(ctx.from);

  if (
    !DATA.subscribers.includes(
      ctx.from.id
    )
  ) {
    DATA.subscribers.push(
      ctx.from.id
    );

    saveData();
  }

  const botInfo =
    await ctx.telegram.getMe();

  const addUrl =
    `https://t.me/${botInfo.username}?startgroup=true`;

  const developerUrl =
    `https://t.me/${OWNER_USERNAME}`;

  await ctx.reply(
    `أهلا بك يا قلبي - ${mentionUser(
      ctx.from
    )}\n\n` +
    `• انا اشغل لك اللي تبي بالمكالمه\n\n` +
    `ادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            'اضفني الى مجموعتك',
            addUrl
          )
        ],
        [
          Markup.button.url(
            'المطور',
            developerUrl
          )
        ]
      ])
    }
  );
}

/* =========================================================
   الإذاعة
========================================================= */

async function broadcast(ctx, text) {
  if (!isOwner(
    ctx.from.id,
    ctx.from.username
  )) {
    await reply(
      ctx,
      '• هذا الأمر يخص ↤ ｢ Dev 🎖 ｣'
    );
    return;
  }

  text = cleanText(text);

  if (!text) {
    await reply(
      ctx,
      '• اكتب نص الإذاعة بعد الأمر.'
    );
    return;
  }

  await reply(
    ctx,
    `• هل أنت متأكد من إرسال الإذاعة؟\n\n${escapeHtml(
      text
    )}`,
    {
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            'تأكيد الإذاعة',
            'broadcast_confirm'
          ),
          Markup.button.callback(
            'إلغاء',
            'broadcast_cancel'
          )
        ]
      ])
    }
  );

  DATA.pendingBroadcast = {
    userId: ctx.from.id,
    text,
    createdAt: Date.now()
  };

  saveData();
}

bot.action(
  'broadcast_confirm',
  async ctx => {
    try {
      await ctx.answerCbQuery();
    } catch {}

    const pending =
      DATA.pendingBroadcast;

    if (
      !pending ||
      String(pending.userId) !==
      String(ctx.from.id)
    ) {
      return;
    }

    let sent = 0;
    let failed = 0;

    for (
      const id of DATA.subscribers
    ) {
      try {
        await ctx.telegram.sendMessage(
          id,
          pending.text
        );

        sent++;
      } catch {
        failed++;
      }
    }

    DATA.broadcasts.push({
      userId: ctx.from.id,
      text: pending.text,
      sent,
      failed,
      createdAt: Date.now()
    });

    DATA.pendingBroadcast = null;

    saveData();

    try {
      await ctx.editMessageText(
        `• تمت الإذاعة.\n\n` +
        `• تم الإرسال ↤ ${sent}\n` +
        `• فشل ↤ ${failed}`
      );
    } catch {}
  }
);

bot.action(
  'broadcast_cancel',
  async ctx => {
    try {
      await ctx.answerCbQuery();
    } catch {}

    DATA.pendingBroadcast = null;

    saveData();

    try {
      await ctx.editMessageText(
        '• تم إلغاء الإذاعة.'
      );
    } catch {}
  }
);

/* =========================================================
   المكالمات الصوتية
========================================================= */

async function voiceStarted(ctx) {
  if (!isGroup(ctx)) return;

  const group = ensureGroup(ctx);

  group.voice.active = true;
  group.voice.startedAt = Date.now();

  saveData();

  await reply(
    ctx,
    'بدأت المحادثه الصوتيه'
  );
}

async function voiceEnded(ctx) {
  if (!isGroup(ctx)) return;

  const group = ensureGroup(ctx);

  let duration = 0;

  if (group.voice.startedAt) {
    duration =
      Math.floor(
        (Date.now() -
          group.voice.startedAt) /
        1000
      );
  }

  group.voice.active = false;
  group.voice.startedAt = null;

  saveData();

  await reply(
    ctx,
    `انتهت المحادثه الصوتيه\n\n` +
    `• المدة ↤ ${formatDuration(
      duration
    )}`
  );
}

function formatDuration(seconds) {
  seconds = Number(seconds || 0);

  const h = Math.floor(
    seconds / 3600
  );

  const m = Math.floor(
    (seconds % 3600) / 60
  );

  const s = seconds % 60;

  if (h) {
    return `${h} ساعة ${m} دقيقة`;
  }

  if (m) {
    return `${m} دقيقة ${s} ثانية`;
  }

  return `${s} ثانية`;
}

/* =========================================================
   الموسيقى / البحث
========================================================= */

function musicSearchText(text) {
  return cleanText(
    text
      .replace(
        /^(بحث\s+اغنيه|بحث\s+أغنية|بحث|اغنيه|أغنية|شغل|تشغيل)\s*/i,
        ''
      )
  );
}

async function musicSearch(ctx, query) {
  if (!query) {
    await reply(
      ctx,
      '• اكتب اسم الأغنية بعد الأمر.'
    );
    return;
  }

  const safe =
    escapeHtml(query);

  await reply(
    ctx,
    `• نتائج البحث عن: <b>${safe}</b>\n\n` +
    `• YouTube\n` +
    `• Spotify\n` +
    `• Resso\n` +
    `• Apple Music\n` +
    `• SoundCloud\n\n` +
    `• البحث الصوتي يحتاج خدمة تشغيل صوتية خارج Bot API.`,
    {
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🔎 بحث',
            `music_search:${encodeURIComponent(query).slice(0, 50)}`
          )
        ],
        [
          Markup.button.callback(
            'إلغاء',
            'music_cancel'
          )
        ]
      ])
    }
  );
}

bot.action(
  /^music_search:(.+)$/,
  async ctx => {
    try {
      await ctx.answerCbQuery();
    } catch {}

    const query =
      decodeURIComponent(
        ctx.match[1]
      );

    try {
      await ctx.editMessageText(
        `• تم تجهيز البحث عن:\n${escapeHtml(
          query
        )}\n\n` +
        `• التشغيل داخل المكالمة يحتاج مكوّن صوتي MTProto/Userbot.`
      );
    } catch {}
  }
);

bot.action(
  'music_cancel',
  async ctx => {
    try {
      await ctx.answerCbQuery();
    } catch {}

    try {
      await ctx.editMessageText(
        '• تم إلغاء البحث.'
      );
    } catch {}
  }
);

/* =========================================================
   قائمة الأوامر
========================================================= */

function commands() {
  return `
<b>━━━ الأوامر ━━━</b>

<b>الرتب</b>
• رتبتي
• رتبته
• رفع مميز
• رفع مالك
• رفع مالك أساسي
• رفع Myth
• رفع My
• رفع Dev²
• رفع ديف
• تنزيل

<b>الإشراف</b>
• رفع مشرف
• ترقيه
• تنزيل مشرف
• تنزيل المشرف
• صلاحياتي
• صلاحياته
• صلاحيات المستخدم

<b>العقوبات</b>
• كتم
• كتم عام
• فك الكتم
• فك الكتم العام
• عام
• مم
• خخ
• قائمة المكتومين
• تقييد
• تق
• الغاء التقييد
• رفع القيود
• مق
• قائمة المقيدين
• مسح المقيدين
• حظر
• فك الحظر
• طرد

<b>التحذيرات</b>
• تحذير
• انذار
• إلغاء التحذير

<b>التفاعل</b>
• تفاعلي
• تفاعله
• المتفاعلين
• تصفير المتفاعلين

<b>الحماية</b>
• فتح المخالفات
• غلق المخالفات
• فتح الروابط
• قفل الروابط
• فتح المنشن
• غلق المنشن
• حالة الحماية

<b>الكلمات</b>
• منع الكلمه
• الغاء منع الكلمه
• الكلمات الممنوعه
• مسح الكلمات الممنوعه

<b>الأوامر المخصصة</b>
• قفل امر
• فتح امر
• اضف امر
• حذف امر
• اوامري
• اضف رد
• حذف رد
• ردودي

<b>التنظيف</b>
• تنظيف
• تنظيف 10
• تفعيل التنظيف التلقائي
• تعطيل التنظيف التلقائي

<b>الهمسات</b>
• اهمس
• همسه
• ه

<b>الأغاني</b>
• بحث
• بحث أغنية
• اغنية
• أغنية
• شغل
• تشغيل
• وقف
• استئناف
• تخطي
• إلغاء الأغنية
• الطابور
• مسح الطابور

<b>الألعاب</b>
• احكام
• أنا
• نعم
• انهاء احكام
• قفل الالعاب
• فتح الالعاب

<b>الاقتصاد</b>
• فلوسي
• فلوسه
• المتجر
• انشاء حساب بنكي
• حسابي
• اهداء 100
• حذف حسابي

<b>المكالمات</b>
• بدأت المكالمه الصوتيه
• انتهت المكالمه الصوتيه
• دعوة

<b>المطور</b>
• المالك
• إذاعة
• حالة البوت
• تفعيل الردود
• تعطيل الردود
• تفعيل البنك
• تعطيل البنك
`;
}

/* =========================================================
   أوامر المالك / المطور
========================================================= */

async function devStatus(ctx) {
  if (!isOwner(
    ctx.from.id,
    ctx.from.username
  )) {
    await reply(
      ctx,
      '• هذا الأمر يخص ↤ ｢ Dev 🎖 ｣'
    );
    return;
  }

  const groups =
    Object.keys(
      DATA.groups
    ).length;

  const users =
    Object.keys(
      DATA.users
    ).length;

  await reply(
    ctx,
    `• حالة البوت\n\n` +
    `• المستخدمين ↤ ${users}\n` +
    `• القروبات ↤ ${groups}\n` +
    `• المشتركين ↤ ${DATA.subscribers.length}\n` +
    `• الوقت ↤ ${formatDuration(
      process.uptime()
    )}`
  );
}

async function toggleBotReplies(ctx, enabled) {
  if (!isOwner(
    ctx.from.id,
    ctx.from.username
  )) {
    await reply(
      ctx,
      '• هذا الأمر يخص ↤ ｢ Dev 🎖 ｣'
    );
    return;
  }

  DATA.botSettings.replies = enabled;

  saveData();

  await reply(
    ctx,
    enabled
      ? '• تم تفعيل ردود البوت.'
      : '• تم تعطيل ردود البوت.'
  );
}

/* =========================================================
   /start
========================================================= */

bot.start(
  async ctx => {
    ensureUser(ctx.from);

    if (isPrivate(ctx)) {
      await privateStart(ctx);
      return;
    }

    await reply(
      ctx,
      '• أهلًا بك.\n' +
      '• استخدم «اوامر» لعرض الأوامر.'
    );
  }
);

/* =========================================================
   Callback للهمسات
========================================================= */

bot.on(
  'callback_query',
  async ctx => {
    /*
      باقي callback buttons الخاصة
      بالأغاني والإذاعة يتم التعامل معها
      في handlers منفصلة.
    */

    try {
      await ctx.answerCbQuery();
    } catch {}
  }
);

/* =========================================================
   تحديث حالة المكالمات
========================================================= */

bot.on(
  'chat_member',
  async ctx => {
    /*
      Telegram Bot API لا يعطي البوت
      كل أحداث بداية/نهاية المكالمة
      الصوتية بنفس طريقة الرسائل.
      لذلك توجد أوامر يدوية/تكامل صوتي
      للتعامل معها.
    */
  }
);

/* =========================================================
   الرسائل
========================================================= */

bot.on(
  'message',
  async ctx => {
    try {
      ensureUser(ctx.from);

      /*
       * حفظ المشتركين عند الرسائل الخاصة
       */
      if (isPrivate(ctx)) {
        if (
          !DATA.subscribers.includes(
            ctx.from.id
          )
        ) {
          DATA.subscribers.push(
            ctx.from.id
          );

          saveData();
        }

        return;
      }

      if (!isGroup(ctx)) {
        return;
      }

      const group = ensureGroup(ctx);

      /*
       * التفاعل
       */
      addInteraction(ctx);

      /*
       * التحقق من المكتومين/المقيدين
       */
      const uid =
        userKey(ctx.from.id);

      if (
        group.globalMuted[uid] ||
        group.muted[uid]
      ) {
        try {
          await ctx.deleteMessage();
        } catch {}

        return;
      }

      /*
       * حماية الكلمات الممنوعة
       */
      const text =
        cleanText(
          ctx.message &&
          ctx.message.text
        );

      if (text) {
        const normalized =
          normalize(text);

        const forbidden =
          group.forbiddenWords.find(
            word =>
              normalized.includes(word)
          );

        if (
          forbidden &&
          group.protection.violations
        ) {
          try {
            await ctx.deleteMessage();
          } catch {}

          return;
        }
      }

      /*
       * قفل أمر ينتظر الرتبة
       */
      if (text) {
        if (
          await handlePendingCommandLock(
            ctx,
            text
          )
        ) {
          return;
        }
      }

      /*
       * قفل الأمر
       */
      if (text) {
        if (
          await handleLockCommand(
            ctx,
            text
          )
        ) {
          return;
        }

        if (
          await handleUnlockCommand(
            ctx,
            text
          )
        ) {
          return;
        }
      }

      /*
       * الأوامر
       */

      if (
        normalize(text) ===
        'رتبتي'
      ) {
        if (
          !await checkCommandAccess(
            ctx,
            'رتبتي'
          )
        ) return;

        await showMyRank(ctx);
        return;
      }

      if (
        normalize(text) ===
        'رتبته'
      ) {
        if (
          !await checkCommandAccess(
            ctx,
            'رتبته'
          )
        ) return;

        await showReplyRank(ctx);
        return;
      }

      /*
       * تفاعلي
       */
      if (
        normalize(text) ===
        'تفاعلي'
      ) {
        if (
          !await checkCommandAccess(
            ctx,
            'تفاعلي'
          )
        ) return;

        await showMyInteraction(ctx);
        return;
      }

      /*
       * تفاعله
       */
      if (
        normalize(text) ===
        'تفاعله'
      ) {
        if (
          !await checkCommandAccess(
            ctx,
            'تفاعله'
          )
        ) return;

        await showReplyInteraction(ctx);
        return;
      }

      /*
       * المتفاعلين
       */
      if (
        normalize(text) ===
        'المتفاعلين'
      ) {
        if (
          !await checkCommandAccess(
            ctx,
            'المتفاعلين'
          )
        ) return;

        await showTopInteractions(ctx);
        return;
      }

      /*
       * تصفير المتفاعلين
       */
      if (
        normalize(text) ===
        'تصفير المتفاعلين'
      ) {
        await resetInteractions(ctx);
        return;
      }

      /*
       * الرتب
       */
      const rankToPromote =
        promotionRank(text);

      if (rankToPromote !== null) {
        if (
          !await checkCommandAccess(
            ctx,
            text
          )
        ) return;

        await promoteUser(
          ctx,
          rankToPromote
        );

        return;
      }

      if (
        normalize(text) ===
        'تنزيل'
      ) {
        await demoteUser(ctx);
        return;
      }

      /*
       * المشرف
       */
      if (
        normalize(text) ===
        'رفع مشرف' ||
        normalize(text) ===
        'ترقيه'
      ) {
        await promoteAdmin(ctx);
        return;
      }

      if (
        normalize(text) ===
        'تنزيل مشرف' ||
        normalize(text) ===
        'تنزيل المشرف'
      ) {
        await demoteAdmin(ctx);
        return;
      }

      if (
        normalize(text) ===
        'صلاحياتي' ||
        normalize(text) ===
        'صلاحياته' ||
        normalize(text) ===
        'صلاحيات المستخدم'
      ) {
        await showPermissions(ctx);
        return;
      }

      /*
       * الكتم
       */
      if (
        normalize(text) ===
        'كتم'
      ) {
        await muteUser(ctx, false);
        return;
      }

      if (
        normalize(text) ===
        'كتم عام' ||
        normalize(text) ===
        'عام'
      ) {
        await muteUser(ctx, true);
        return;
      }

      if (
        normalize(text) ===
        'فك الكتم'
      ) {
        await unmuteUser(ctx, false);
        return;
      }

      if (
        normalize(text) ===
        'فك الكتم العام'
      ) {
        await unmuteUser(ctx, true);
        return;
      }

      if (
        normalize(text) ===
        'مم'
      ) {
        await clearMuted(ctx, false);
        return;
      }

      if (
        normalize(text) ===
        'خخ'
      ) {
        await clearMuted(ctx, true);
        return;
      }

      if (
        normalize(text) ===
        'قائمة المكتومين' ||
        normalize(text) ===
        'المكتومين'
      ) {
        await listMuted(ctx);
        return;
      }

      /*
       * التقييد
       */
      if (
        normalize(text) ===
        'تقييد' ||
        normalize(text) ===
        'تق'
      ) {
        await restrictUser(ctx);
        return;
      }

      if (
        normalize(text) ===
        'الغاء التقييد' ||
        normalize(text) ===
        'رفع القيود'
      ) {
        await unrestrictUser(ctx);
        return;
      }

      if (
        normalize(text) ===
        'مق' ||
        normalize(text) ===
        'قائمة المقيدين' ||
        normalize(text) ===
        'المقيدين'
      ) {
        await listRestricted(ctx);
        return;
      }

      if (
        normalize(text) ===
        'مسح المقيدين'
      ) {
        await clearRestricted(ctx);
        return;
      }

      /*
       * الحظر والطرد
       */
      if (
        normalize(text) ===
        'حظر'
      ) {
        await banUser(ctx);
        return;
      }

      if (
        normalize(text) ===
        'فك الحظر'
      ) {
        await unbanUser(ctx);
        return;
      }

      if (
        normalize(text) ===
        'طرد'
      ) {
        await kickUser(ctx);
        return;
      }

      /*
       * التحذير
       */
      if (
        normalize(text) ===
        'تحذير' ||
        normalize(text) ===
        'انذار' ||
        normalize(text) ===
        'إنذار'
      ) {
        await warnUser(ctx);
        return;
      }

      if (
        normalize(text) ===
        'الغاء التحذير' ||
        normalize(text) ===
        'إلغاء التحذير'
      ) {
        await clearWarning(ctx);
        return;
      }

      /*
       * الحماية
       */
      if (
        normalize(text) ===
        'فتح المخالفات'
      ) {
        await protectionToggle(
          ctx,
          'violations',
          true
        );
        return;
      }

      if (
        normalize(text) ===
        'غلق المخالفات' ||
        normalize(text) ===
        'قفل المخالفات'
      ) {
        await protectionToggle(
          ctx,
          'violations',
          false
        );
        return;
      }

      if (
        normalize(text) ===
        'فتح الروابط'
      ) {
        await protectionToggle(
          ctx,
          'links',
          true
        );
        return;
      }

      if (
        normalize(text) ===
        'قفل الروابط'
      ) {
        await protectionToggle(
          ctx,
          'links',
          false
        );
        return;
      }

      if (
        normalize(text) ===
        'فتح المنشن'
      ) {
        await protectionToggle(
          ctx,
          'mentions',
          true
        );
        return;
      }

      if (
        normalize(text) ===
        'غلق المنشن'
      ) {
        await protectionToggle(
          ctx,
          'mentions',
          false
        );
        return;
      }

      if (
        normalize(text) ===
        'حالة الحماية'
      ) {
        await protectionStatus(ctx);
        return;
      }

      /*
       * الكلمات الممنوعة
       */
      let match =
        text.match(
          /^منع\s+الكلمه\s+(.+)$/i
        );

      if (match) {
        await addForbiddenWord(
          ctx,
          match[1]
        );
        return;
      }

      match =
        text.match(
          /^الغاء\s+منع\s+الكلمه\s+(.+)$/i
        );

      if (match) {
        await removeForbiddenWord(
          ctx,
          match[1]
        );
        return;
      }

      if (
        normalize(text) ===
        'الكلمات الممنوعه'
      ) {
        await listForbiddenWords(ctx);
        return;
      }

      if (
        normalize(text) ===
        'مسح الكلمات الممنوعه'
      ) {
        await clearForbiddenWords(ctx);
        return;
      }

      /*
       * الألقاب
       */
      match =
        text.match(
          /^ضع\s+(.+)$/i
        );

      if (
        match &&
        ctx.message.reply_to_message
      ) {
        await setTitle(
          ctx,
          match[1]
        );
        return;
      }

      if (
        normalize(text) ===
        'لقبي'
      ) {
        await showTitle(ctx, true);
        return;
      }

      if (
        normalize(text) ===
        'لقبه'
      ) {
        await showTitle(ctx, false);
        return;
      }

      /*
       * التنظيف
       */
      match =
        text.match(
          /^تنظيف(?:\s+(\d+))?$/i
        );

      if (match) {
        await cleanMessages(
          ctx,
          match[1] || 10
        );
        return;
      }

      if (
        normalize(text) ===
        'تفعيل التنظيف التلقائي'
      ) {
        if (
          hasRank(
            ctx.from.id,
            RANKS.MYTH_STAR
          )
        ) {
          group.cleaning.auto = true;
          saveData();

          await reply(
            ctx,
            '• تم تفعيل التنظيف التلقائي.'
          );
        } else {
          await reply(
            ctx,
            '• هذا الأمر متاح من رتبة Myth 🎖️ فأعلى.'
          );
        }

        return;
      }

      if (
        normalize(text) ===
        'تعطيل التنظيف التلقائي'
      ) {
        if (
          hasRank(
            ctx.from.id,
            RANKS.MYTH_STAR
          )
        ) {
          group.cleaning.auto = false;
          saveData();

          await reply(
            ctx,
            '• تم تعطيل التنظيف التلقائي.'
          );
        }

        return;
      }

      /*
       * الهمسة
       */
      if (
        normalize(text) ===
        'اهمس' ||
        normalize(text) ===
        'همسه' ||
        normalize(text) ===
        'ه'
      ) {
        await startWhisper(ctx);
        return;
      }

      /*
       * الأغاني
       */
      if (
        /^(بحث|بحث أغنية|بحث اغنية|اغنية|أغنية|شغل|تشغيل)\s+/i
          .test(text)
      ) {
        const query =
          musicSearchText(text);

        await musicSearch(
          ctx,
          query
        );

        return;
      }

      /*
       * الأوامر الموسيقية
       */
      if (
        normalize(text) ===
        'وقف' ||
        normalize(text) ===
        'إيقاف'
      ) {
        group.music.playing = false;
        saveData();

        await reply(
          ctx,
          '• تم إيقاف التشغيل.'
        );
        return;
      }

      if (
        normalize(text) ===
        'استئناف'
      ) {
        group.music.playing = true;
        saveData();

        await reply(
          ctx,
          '• تم استئناف التشغيل.'
        );
        return;
      }

      if (
        normalize(text) ===
        'تخطي'
      ) {
        if (group.music.queue.length) {
          group.music.queue.shift();
        }

        saveData();

        await reply(
          ctx,
          '• تم تخطي الأغنية.'
        );
        return;
      }

      if (
        normalize(text) ===
        'إلغاء الأغنية'
      ) {
        group.music.playing = false;
        group.music.queue = [];

        saveData();

        await reply(
          ctx,
          '• تم إلغاء الأغنية والطابور.'
        );
        return;
      }

      if (
        normalize(text) ===
        'الطابور'
      ) {
        if (!group.music.queue.length) {
          await reply(
            ctx,
            '• الطابور فارغ.'
          );
        } else {
          await reply(
            ctx,
            `• الطابور:\n\n` +
            group.music.queue
              .map(
                (x, i) =>
                  `${i + 1} ) ${escapeHtml(x.title || x)}`
              )
              .join('\n')
          );
        }

        return;
      }

      if (
        normalize(text) ===
        'مسح الطابور'
      ) {
        group.music.queue = [];

        saveData();

        await reply(
          ctx,
          '• تم مسح الطابور.'
        );
        return;
      }

      /*
       * الألعاب
       */
      if (
        normalize(text) ===
        'قفل الالعاب'
      ) {
        await toggleGames(ctx, false);
        return;
      }

      if (
        normalize(text) ===
        'فتح الالعاب'
      ) {
        await toggleGames(ctx, true);
        return;
      }

      if (
        normalize(text) ===
        'احكام'
      ) {
        if (!group.games.enabled) {
          await reply(
            ctx,
            '• الألعاب مقفلة.'
          );
          return;
        }

        if (
          !hasRank(
            ctx.from.id,
            RANKS.DEV
          )
        ) {
          await reply(
            ctx,
            '• هذا الأمر يخص ↤ ｢ Dev 🎖 ｣'
          );
          return;
        }

        group.games.active = {
          type: 'ahkam',
          owner: ctx.from.id,
          players: [],
          startedAt: Date.now()
        };

        saveData();

        await reply(
          ctx,
          '• بدأت فعالية الأحكام.\n\n' +
          '• اللي يبي يدخل يرسل: أنا'
        );

        return;
      }

      if (
        normalize(text) ===
        'أنا'
      ) {
        if (
          group.games.active &&
          group.games.active.type ===
          'ahkam'
        ) {
          if (
            !group.games.active.players
              .includes(ctx.from.id)
          ) {
            group.games.active.players.push(
              ctx.from.id
            );

            saveData();

            await reply(
              ctx,
              `• تم تسجيل ${escapeHtml(
                displayName(ctx.from)
              )}.`
            );
          }

          return;
        }
      }

      if (
        normalize(text) ===
        'نعم'
      ) {
        if (
          group.games.active &&
          group.games.active.type ===
          'ahkam'
        ) {
          if (
            group.games.active.owner !==
            ctx.from.id
          ) {
            await reply(
              ctx,
              '• صاحب الفعالية فقط يقدر يبدأ الجولة.'
            );
            return;
          }

          const players =
            group.games.active.players || [];

          if (players.length < 2) {
            await reply(
              ctx,
              '• تحتاج لاعبين على الأقل.'
            );
            return;
          }

          const random =
            players[
              Math.floor(
                Math.random() *
                players.length
              )
            ];

          await reply(
            ctx,
            `• بدأت الجولة!\n\n` +
            `• المختار عشوائيًا ↤ ${random}`
          );

          return;
        }
      }

      if (
        normalize(text) ===
        'انهاء احكام'
      ) {
        if (
          group.games.active &&
          group.games.active.owner ===
          ctx.from.id
        ) {
          group.games.active = null;

          saveData();

          await reply(
            ctx,
            '• تم إنهاء الأحكام.'
          );
        }

        return;
      }

      /*
       * الاقتصاد
       */
      if (
        normalize(text) ===
        'فلوسي'
      ) {
        await money(ctx, false);
        return;
      }

      if (
        normalize(text) ===
        'فلوسه'
      ) {
        await money(ctx, true);
        return;
      }

      if (
        normalize(text) ===
        'انشاء حساب بنكي'
      ) {
        await createBank(ctx);
        return;
      }

      if (
        normalize(text) ===
        'حسابي'
      ) {
        await account(ctx);
        return;
      }

      match =
        text.match(
          /^اهداء\s+(\d+)$/i
        );

      if (match) {
        await giftMoney(
          ctx,
          match[1]
        );
        return;
      }

      /*
       * المكالمات
       */
      if (
        normalize(text) ===
        'بدأت المكالمه الصوتيه'
      ) {
        await voiceStarted(ctx);
        return;
      }

      if (
        normalize(text) ===
        'انتهت المكالمه الصوتيه'
      ) {
        await voiceEnded(ctx);
        return;
      }

      if (
        normalize(text) ===
        'دعوة'
      ) {
        const me =
          await ctx.telegram.getMe();

        const url =
          `https://t.me/${me.username}?startgroup=true`;

        await reply(
          ctx,
          '• دعوة البوت إلى مجموعة:',
          {
            ...Markup.inlineKeyboard([
              [
                Markup.button.url(
                  'اضفني الى مجموعتك',
                  url
                )
              ]
            ])
          }
        );

        return;
      }

      /*
       * المالك
       */
      if (
        normalize(text) ===
        'المالك'
      ) {
        await ownerInfo(ctx);
        return;
      }

      /*
       * الإذاعة
       */
      if (
        normalize(text).startsWith(
          'إذاعة '
        ) ||
        normalize(text).startsWith(
          'اذاعه '
        )
      ) {
        const broadcastText =
          text.replace(
            /^(إذاعة|اذاعه)\s*/i,
            ''
          );

        await broadcast(
          ctx,
          broadcastText
        );

        return;
      }

      /*
       * حالة البوت
       */
      if (
        normalize(text) ===
        'حالة البوت'
      ) {
        await devStatus(ctx);
        return;
      }

      /*
       * تفعيل/تعطيل الردود
       */
      if (
        normalize(text) ===
        'تفعيل الردود'
      ) {
        await toggleBotReplies(
          ctx,
          true
        );
        return;
      }

      if (
        normalize(text) ===
        'تعطيل الردود'
      ) {
        await toggleBotReplies(
          ctx,
          false
        );
        return;
      }

      /*
       * إضافة رد
       *
       * الصيغة:
       * اضف رد الكلمة | الرد
       */
      match =
        text.match(
          /^اضف\s+رد\s+(.+?)\s*\|\s*(.+)$/i
        );

      if (match) {
        await addCustomReply(
          ctx,
          match[1],
          match[2]
        );
        return;
      }

      /*
       * حذف رد
       */
      match =
        text.match(
          /^حذف\s+رد\s+(.+)$/i
        );

      if (match) {
        await deleteCustomReply(
          ctx,
          match[1]
        );
        return;
      }

      /*
       * ردودي
       */
      if (
        normalize(text) ===
        'ردودي'
      ) {
        await listCustomReplies(ctx);
        return;
      }

      /*
       * إضافة أمر
       */
      match =
        text.match(
          /^اضف\s+امر\s+(.+?)\s*\|\s*(.+)$/i
        );

      if (match) {
        await addCustomCommand(
          ctx,
          match[1],
          match[2]
        );
        return;
      }

      /*
       * حذف أمر
       */
      match =
        text.match(
          /^حذف\s+امر\s+(.+)$/i
        );

      if (match) {
        await deleteCustomCommand(
          ctx,
          match[1]
        );
        return;
      }

      /*
       * اوامري
       */
      if (
        normalize(text) ===
        'اوامري'
      ) {
        await listCustomCommands(ctx);
        return;
      }

      /*
       * الأمر "اوامر"
       */
      if (
        normalize(text) ===
        'اوامر'
      ) {
        if (
          !hasRank(
            ctx.from.id,
            RANKS.DEV
          )
        ) {
          await reply(
            ctx,
            '• هذا الأمر يخص ↤ ｢ Dev 🎖 ｣'
          );
          return;
        }

        await reply(
          ctx,
          commands()
        );

        return;
      }

      /*
       * الردود المخصصة
       */
      if (
        text &&
        group.customReplies &&
        group.customReplies[
          normalize(text)
        ]
      ) {
        await reply(
          ctx,
          escapeHtml(
            group.customReplies[
              normalize(text)
            ]
          )
        );

        return;
      }

      /*
       * الأوامر المخصصة
       */
      const customKey =
        commandLockKey(text);

      if (
        text &&
        group.customCommands &&
        group.customCommands[
          customKey
        ]
      ) {
        await reply(
          ctx,
          escapeHtml(
            group.customCommands[
              customKey
            ]
          )
        );

        return;
      }

    } catch (error) {
      console.error(
        'MESSAGE ERROR:',
        error
      );
    }
  }
);

/* =========================================================
   معالجة أخطاء البوت
========================================================= */

bot.catch(
  (error, ctx) => {
    console.error(
      'BOT ERROR:',
      error
    );

    try {
      if (
        ctx &&
        ctx.chat
      ) {
        ctx.telegram.sendMessage(
          ctx.chat.id,
          '• حدث خطأ مؤقت في البوت.'
        ).catch(() => {});
      }
    } catch {}
  }
);

/* =========================================================
   التشغيل
========================================================= */

process.on(
  'unhandledRejection',
  error => {
    console.error(
      'UNHANDLED REJECTION:',
      error
    );
  }
);

process.on(
  'uncaughtException',
  error => {
    console.error(
      'UNCAUGHT EXCEPTION:',
      error
    );
  }
);

bot.launch({
  dropPendingUpdates: true
})
.then(() => {
  console.log(
    'البوت اشتغل بنجاح ✅'
  );
})
.catch(error => {
  console.error(
    'فشل تشغيل البوت:',
    error
  );
});

process.once(
  'SIGINT',
  () => bot.stop('SIGINT')
);

process.once(
  'SIGTERM',
  () => bot.stop('SIGTERM')
);
