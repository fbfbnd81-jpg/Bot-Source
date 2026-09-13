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
const OWNER_ID = process.env.OWNER_ID || '';

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN غير موجود في .env');
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

const RANK = {
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
    whispers: {},
    pendingWhispers: {},
    broadcasts: [],
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
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(data, null, 2)
      );
      return data;
    }

    const raw = fs.readFileSync(DATA_FILE, 'utf8');

    if (!raw.trim()) {
      return defaultData();
    }

    const parsed = JSON.parse(raw);
    const base = defaultData();

    return {
      ...base,
      ...parsed,
      users: parsed.users || {},
      groups: parsed.groups || {},
      subscribers: parsed.subscribers || [],
      whispers: parsed.whispers || {},
      pendingWhispers: parsed.pendingWhispers || {},
      broadcasts: parsed.broadcasts || []
    };
  } catch (error) {
    console.error('DATA ERROR:', error);
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
    console.error('SAVE ERROR:', error);
  }
}

/* =========================================================
   أدوات
========================================================= */

function clean(text) {
  return String(text || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function norm(text) {
  return clean(text)
    .toLowerCase()
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

function html(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function idOf(id) {
  return String(id);
}

function isGroup(ctx) {
  return !!(
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
   المستخدم
========================================================= */

function ensureUser(from) {
  if (!from) return null;

  const id = idOf(from.id);

  if (!DATA.users[id]) {
    DATA.users[id] = {
      id: from.id,
      username: from.username || '',
      firstName: from.first_name || '',
      lastName: from.last_name || '',
      rank: 0,
      money: 0,
      bank: null,
      stats: {
        messages: 0,
        wins: 0,
        answers: 0,
        games: 0,
        bestSpeed: null
      },
      createdAt: Date.now()
    };
  }

  const user = DATA.users[id];

  user.username =
    from.username || user.username || '';

  user.firstName =
    from.first_name || user.firstName || '';

  user.lastName =
    from.last_name || user.lastName || '';

  if (
    norm(user.username) ===
    norm(OWNER_USERNAME)
  ) {
    user.rank = RANK.DEV;
  }

  return user;
}

function getUser(id) {
  return DATA.users[idOf(id)] || null;
}

function displayName(user) {
  if (!user) return 'غير معروف';

  if (user.firstName) {
    return clean(
      `${user.firstName} ${user.lastName || ''}`
    );
  }

  if (user.username) {
    return `@${user.username}`;
  }

  return String(user.id);
}

function mention(user) {
  return `<a href="tg://user?id=${user.id}">${html(
    displayName(user)
  )}</a>`;
}

/* =========================================================
   الرتب
========================================================= */

function getRank(userId) {
  const user = getUser(userId);

  if (!user) return RANK.MEMBER;

  if (
    norm(user.username) ===
    norm(OWNER_USERNAME)
  ) {
    return RANK.DEV;
  }

  return Number(user.rank || 0);
}

function rankName(rank) {
  return RANK_NAMES[rank] || 'عضو';
}

function hasRank(userId, rank) {
  return getRank(userId) >= rank;
}

function isOwner(userId, username) {
  if (
    username &&
    norm(username) === norm(OWNER_USERNAME)
  ) {
    return true;
  }

  if (
    OWNER_ID &&
    String(userId) === String(OWNER_ID)
  ) {
    return true;
  }

  return getRank(userId) >= RANK.DEV;
}

function parseRank(text) {
  const t = norm(text);

  if (t === 'عضو') return RANK.MEMBER;
  if (t === 'مميز') return RANK.VIP;
  if (t === 'مالك') return RANK.OWNER;

  if (
    t === 'مالك اساسي' ||
    t === 'اساس'
  ) {
    return RANK.BASIC_OWNER;
  }

  if (
    t === 'myth' ||
    t === 'm'
  ) {
    return RANK.MYTH;
  }

  /*
     My = Myth 🎖️
  */
  if (
    t === 'my' ||
    t === 'اكس'
  ) {
    return RANK.MYTH_STAR;
  }

  if (
    t === 'dev2' ||
    t === 'dev²' ||
    t === 'ديف 2' ||
    t === 'مطور ثانوي'
  ) {
    return RANK.DEV2;
  }

  if (
    t === 'dev' ||
    t === 'ديف'
  ) {
    return RANK.DEV;
  }

  return null;
}

/* =========================================================
   المجموعة
========================================================= */

function ensureGroup(ctx) {
  if (!isGroup(ctx)) return null;

  const id = idOf(ctx.chat.id);

  if (!DATA.groups[id]) {
    DATA.groups[id] = {
      id: ctx.chat.id,
      title: ctx.chat.title || '',

      interactions: {},

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
        violations: true,
        links: false,
        mentions: false,
        edits: false,
        spam: false,
        ads: false,
        forwards: false
      },

      cleaning: {
        auto: false
      },

      games: {
        enabled: true,
        active: null
      },

      music: {
        queue: [],
        playing: false
      },

      voice: {
        active: false,
        startedAt: null
      }
    };
  }

  return DATA.groups[id];
}

/* =========================================================
   Reply موحد
========================================================= */

async function reply(ctx, text, extra = {}) {
  if (!ctx || !ctx.reply) return;

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
    return await ctx.reply(
      text,
      options
    );
  } catch (error) {
    try {
      return await ctx.reply(
        String(text).replace(
          /<[^>]*>/g,
          ''
        )
      );
    } catch {}
  }
}

/* =========================================================
   حماية الأمر المقفول
========================================================= */

function lockKey(command) {
  return norm(command)
    .replace(/^[/!#.]+/, '')
    .trim();
}

function lockedRank(group, command) {
  const key = lockKey(command);

  if (
    Object.prototype.hasOwnProperty.call(
      group.lockedCommands || {},
      key
    )
  ) {
    return group.lockedCommands[key];
  }

  return null;
}

async function commandAllowed(ctx, command) {
  if (!isGroup(ctx)) return true;

  const group = ensureGroup(ctx);
  const required =
    lockedRank(group, command);

  if (required === null) {
    return true;
  }

  if (
    getRank(ctx.from.id) >=
    required
  ) {
    return true;
  }

  await reply(
    ctx,
    `• الأمر متاح من رتبة ${html(
      rankName(required)
    )} فأعلى`
  );

  return false;
}

/* =========================================================
   قفل أمر
========================================================= */

async function lockCommand(ctx, text) {
  if (!isGroup(ctx)) return false;

  if (
    !/^قفل\s+امر(?:\s+|$)/i.test(text)
  ) {
    return false;
  }

  if (
    !hasRank(
      ctx.from.id,
      RANK.DEV
    )
  ) {
    await reply(
      ctx,
      '• هذا الامر يخص ↤ ｢ Dev 🎖 ｣'
    );
    return true;
  }

  const command =
    clean(
      text.replace(
        /^قفل\s+امر\s*/i,
        ''
      )
    );

  if (!command) {
    await reply(
      ctx,
      '• اكتب الأمر الذي تريد قفله.'
    );
    return true;
  }

  const group = ensureGroup(ctx);

  group.pendingCommandLock[
    idOf(ctx.from.id)
  ] = {
    command,
    time: Date.now()
  };

  saveData();

  await reply(
    ctx,
    '• حسنًا عزيزي قم بإرسال الرتبة الان :'
  );

  return true;
}

async function pendingLockRank(ctx, text) {
  if (!isGroup(ctx)) return false;

  const group = ensureGroup(ctx);

  const pending =
    group.pendingCommandLock[
      idOf(ctx.from.id)
    ];

  if (!pending) {
    return false;
  }

  /*
    إذا كانت الرسالة أمرًا جديدًا،
    لا نعتبرها رتبة.
  */
  const rank = parseRank(text);

  if (rank === null) {
    return false;
  }

  group.lockedCommands[
    lockKey(pending.command)
  ] = rank;

  delete group.pendingCommandLock[
    idOf(ctx.from.id)
  ];

  saveData();

  await reply(
    ctx,
    `• تم قفل الأمر <b>${html(
      pending.command
    )}</b>\n\n` +
    `• متاح من رتبة ${html(
      rankName(rank)
    )} فأعلى`
  );

  return true;
}

async function unlockCommand(ctx, text) {
  if (!isGroup(ctx)) return false;

  if (
    !/^فتح\s+امر(?:\s+|$)/i.test(text)
  ) {
    return false;
  }

  if (
    !hasRank(
      ctx.from.id,
      RANK.DEV
    )
  ) {
    await reply(
      ctx,
      '• هذا الامر يخص ↤ ｢ Dev 🎖 ｣'
    );
    return true;
  }

  const command =
    clean(
      text.replace(
        /^فتح\s+امر\s*/i,
        ''
      )
    );

  if (!command) {
    await reply(
      ctx,
      '• اكتب الأمر الذي تريد فتحه.'
    );
    return true;
  }

  const group = ensureGroup(ctx);
  const key = lockKey(command);

  if (
    !Object.prototype.hasOwnProperty.call(
      group.lockedCommands,
      key
    )
  ) {
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
    `• تم فتح الأمر <b>${html(
      command
    )}</b>`
  );

  return true;
}

/* =========================================================
   التفاعل
========================================================= */

function addInteraction(ctx) {
  if (!isGroup(ctx)) return;

  const group = ensureGroup(ctx);
  const id = idOf(ctx.from.id);

  if (!group.interactions[id]) {
    group.interactions[id] = {
      id: ctx.from.id,
      username: ctx.from.username || '',
      firstName: ctx.from.first_name || '',
      count: 0
    };
  }

  const item =
    group.interactions[id];

  item.username =
    ctx.from.username ||
    item.username ||
    '';

  item.firstName =
    ctx.from.first_name ||
    item.firstName ||
    '';

  item.count++;

  const user =
    ensureUser(ctx.from);

  user.stats.messages++;

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
  return (
    item.firstName ||
    (
      item.username
        ? `@${item.username}`
        : String(item.id)
    )
  );
}

async function myInteraction(ctx) {
  const group = ensureGroup(ctx);
  const list =
    interactionList(group);

  const mine =
    group.interactions[
      idOf(ctx.from.id)
    ] || {
      count: 0
    };

  const index =
    list.findIndex(
      x =>
        String(x.id) ===
        String(ctx.from.id)
    );

  const position =
    index === -1
      ? '-'
      : index + 1;

  await reply(
    ctx,
    `• رتبتك هي ↤ ${html(
      rankName(
        getRank(ctx.from.id)
      )
    )}\n\n` +
    `• رسائلك بالتفاعل  ↤  ${Number(
      mine.count || 0
    ).toLocaleString('en-US')}\n` +
    `• ترتيبك بالمتفاعلين ↤ ${position}\n-`
  );
}

async function replyInteraction(ctx) {
  const target =
    ctx.message &&
    ctx.message.reply_to_message &&
    ctx.message.reply_to_message.from;

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على الشخص أولًا.'
    );
    return;
  }

  ensureUser(target);

  const group = ensureGroup(ctx);
  const list =
    interactionList(group);

  const item =
    group.interactions[
      idOf(target.id)
    ] || {
      count: 0
    };

  const index =
    list.findIndex(
      x =>
        String(x.id) ===
        String(target.id)
    );

  const position =
    index === -1
      ? '-'
      : index + 1;

  await reply(
    ctx,
    `• رتبة ${html(
      displayName(target)
    )} هي ↤ ${html(
      rankName(
        getRank(target.id)
      )
    )}\n\n` +
    `• رسائله بالتفاعل ↤ ${Number(
      item.count || 0
    ).toLocaleString('en-US')}\n` +
    `• ترتيبه بالمتفاعلين ↤ ${position}\n-`
  );
}

async function topInteractions(ctx) {
  const group = ensureGroup(ctx);
  const list =
    interactionList(group)
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

  list.forEach(
    (item, index) => {
      const number =
        medals[index] ||
        String(index + 1);

      text +=
        `${number} ) ${Number(
          item.count || 0
        ).toLocaleString('en-US')}  l ${html(
          interactionName(item)
        )}\n`;
    }
  );

  const mine =
    group.interactions[
      idOf(ctx.from.id)
    ];

  if (mine) {
    text +=
      `━━━━━━━━━\n` +
      `• you)  ${Number(
        mine.count || 0
      ).toLocaleString('en-US')}  l ${html(
        interactionName(mine)
      )}`;
  }

  await reply(ctx, text);
}

async function resetInteractions(ctx) {
  if (
    !hasRank(
      ctx.from.id,
      RANK.DEV2
    )
  ) {
    await reply(
      ctx,
      '• هذا الامر يخص ↤ ｢ Dev²🎖 ｣'
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
   رتبتي / رتبته
========================================================= */

async function myRank(ctx) {
  await reply(
    ctx,
    `• رتبتك هي ↤ ${html(
      rankName(
        getRank(ctx.from.id)
      )
    )}`
  );
}

async function replyRank(ctx) {
  const target =
    ctx.message &&
    ctx.message.reply_to_message &&
    ctx.message.reply_to_message.from;

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على الشخص أولًا.'
    );
    return;
  }

  ensureUser(target);

  await reply(
    ctx,
    `• رتبة ${html(
      displayName(target)
    )} هي ↤ ${html(
      rankName(
        getRank(target.id)
      )
    )}`
  );
}

/* =========================================================
   الرتب: رفع وتنزيل
========================================================= */

function promotionRank(text) {
  const t = norm(text);

  if (t === 'رفع مميز')
    return RANK.VIP;

  if (t === 'رفع مالك')
    return RANK.OWNER;

  if (
    t === 'رفع مالك اساسي' ||
    t === 'رفع اساس'
  )
    return RANK.BASIC_OWNER;

  if (
    t === 'رفع myth' ||
    t === 'رفع m'
  )
    return RANK.MYTH;

  /*
    مهم جدًا:
    My = Myth 🎖️
  */
  if (
    t === 'رفع my' ||
    t === 'رفع اكس'
  )
    return RANK.MYTH_STAR;

  if (
    t === 'رفع dev2' ||
    t === 'رفع dev²' ||
    t === 'رفع مطور ثانوي'
  )
    return RANK.DEV2;

  if (
    t === 'رفع ديف' ||
    t === 'رفع dev'
  )
    return RANK.DEV;

  return null;
}

async function promote(ctx, newRank) {
  const target =
    ctx.message &&
    ctx.message.reply_to_message &&
    ctx.message.reply_to_message.from;

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو الذي تريد رفع رتبته.'
    );
    return;
  }

  ensureUser(target);

  if (
    String(target.id) ===
    String(ctx.from.id)
  ) {
    await reply(
      ctx,
      '• ما تقدر ترفع رتبتك بنفسك.'
    );
    return;
  }

  const actorRank =
    getRank(ctx.from.id);

  const targetRank =
    getRank(target.id);

  if (targetRank >= actorRank) {
    await reply(
      ctx,
      '• ما تقدر تعدل على رتبة مساوية أو أعلى من رتبتك.'
    );
    return;
  }

  if (newRank >= actorRank) {
    await reply(
      ctx,
      '• لا يمكنك إعطاء رتبة مساوية أو أعلى من رتبتك.'
    );
    return;
  }

  if (
    newRank >= RANK.DEV2 &&
    !isOwner(
      ctx.from.id,
      ctx.from.username
    )
  ) {
    await reply(
      ctx,
      '• هذا الامر يخص ↤ ｢ Dev 🎖 ｣'
    );
    return;
  }

  DATA.users[
    idOf(target.id)
  ].rank = newRank;

  saveData();

  await reply(
    ctx,
    `• تم رفع ${html(
      displayName(target)
    )}\n` +
    `• الرتبة ↤ ${html(
      rankName(newRank)
    )}`
  );
}

async function demote(ctx) {
  const target =
    ctx.message &&
    ctx.message.reply_to_message &&
    ctx.message.reply_to_message.from;

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  ensureUser(target);

  if (
    String(target.id) ===
    String(ctx.from.id)
  ) {
    await reply(
      ctx,
      '• ما تقدر تنزل رتبتك بنفسك.'
    );
    return;
  }

  if (
    getRank(target.id) >=
    getRank(ctx.from.id)
  ) {
    await reply(
      ctx,
      '• ما تقدر تنزل رتبة مساوية أو أعلى منك.'
    );
    return;
  }

  DATA.users[
    idOf(target.id)
  ].rank =
    Math.max(
      0,
      getRank(target.id) - 1
    );

  saveData();

  await reply(
    ctx,
    `• تم تنزيل ${html(
      displayName(target)
    )}\n` +
    `• الرتبة ↤ ${html(
      rankName(
        getRank(target.id)
      )
    )}`
  );
}

/* =========================================================
   رفع مشرف
========================================================= */

async function botAdmin(ctx) {
  try {
    const me =
      await ctx.telegram.getMe();

    const member =
      await ctx.telegram.getChatMember(
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

async function promoteAdmin(ctx) {
  if (
    !hasRank(
      ctx.from.id,
      RANK.DEV
    )
  ) {
    await reply(
      ctx,
      '• هذا الامر يخص ↤ ｢ Dev 🎖 ｣'
    );
    return;
  }

  if (!await botAdmin(ctx)) {
    await reply(
      ctx,
      '• لازم أكون مشرف في القروب.'
    );
    return;
  }

  const target =
    ctx.message &&
    ctx.message.reply_to_message &&
    ctx.message.reply_to_message.from;

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
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
        can_change_info: true,
        can_invite_users: true,
        can_pin_messages: true,
        can_manage_topics: true,
        can_promote_members: false
      }
    );

    await reply(
      ctx,
      `• تم رفع ${html(
        displayName(target)
      )} مشرف بنجاح.`
    );
  } catch (error) {
    console.error(error);

    await reply(
      ctx,
      '• ما قدرت أرفع العضو مشرف. تأكد من صلاحياتي.'
    );
  }
}

async function demoteAdmin(ctx) {
  if (
    !hasRank(
      ctx.from.id,
      RANK.DEV
    )
  ) {
    await reply(
      ctx,
      '• هذا الامر يخص ↤ ｢ Dev 🎖 ｣'
    );
    return;
  }

  const target =
    ctx.message &&
    ctx.message.reply_to_message &&
    ctx.message.reply_to_message.from;

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
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false,
        can_manage_topics: false,
        can_promote_members: false
      }
    );

    await reply(
      ctx,
      '• تم تنزيل المشرف.'
    );
  } catch {
    await reply(
      ctx,
      '• تعذر تنزيل المشرف.'
    );
  }
}

/* =========================================================
   الكتم
========================================================= */

async function targetFromReply(ctx) {
  if (
    !ctx.message ||
    !ctx.message.reply_to_message ||
    !ctx.message.reply_to_message.from
  ) {
    return null;
  }

  return ctx.message.reply_to_message.from;
}

async function targetAllowed(ctx, target) {
  if (!target) return false;

  ensureUser(target);

  if (
    String(target.id) ===
    String(ctx.from.id)
  ) {
    await reply(
      ctx,
      '• ما تقدر تستخدم الأمر على نفسك.'
    );
    return false;
  }

  if (
    getRank(target.id) >=
    getRank(ctx.from.id)
  ) {
    await reply(
      ctx,
      '• ما تقدر تستخدم الأمر على رتبة مساوية أو أعلى من رتبتك.'
    );
    return false;
  }

  return true;
}

async function mute(ctx, global = false) {
  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  if (!await targetAllowed(ctx, target)) {
    return;
  }

  const group =
    ensureGroup(ctx);

  group[
    global
      ? 'globalMuted'
      : 'muted'
  ] ||= {};

  group[
    global
      ? 'globalMuted'
      : 'muted'
  ][idOf(target.id)] = {
    id: target.id,
    name: displayName(target),
    time: Date.now()
  };

  if (await botAdmin(ctx)) {
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
  }

  saveData();

  await reply(
    ctx,
    global
      ? `• تم كتم ${html(
          displayName(target)
        )} عام.`
      : `• تم كتم ${html(
          displayName(target)
        )}.`
  );
}

async function unmute(ctx, global = false) {
  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  const group =
    ensureGroup(ctx);

  const key =
    global
      ? 'globalMuted'
      : 'muted';

  delete group[key][
    idOf(target.id)
  ];

  if (await botAdmin(ctx)) {
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
  }

  saveData();

  await reply(
    ctx,
    global
      ? '• تم فك الكتم العام.'
      : '• تم فك الكتم.'
  );
}

async function clearMuted(ctx, global = false) {
  if (
    !hasRank(
      ctx.from.id,
      RANK.MYTH_STAR
    )
  ) {
    await reply(
      ctx,
      '• هذا الأمر متاح من رتبة Myth 🎖️ فأعلى.'
    );
    return;
  }

  const group =
    ensureGroup(ctx);

  const key =
    global
      ? 'globalMuted'
      : 'muted';

  const count =
    Object.keys(
      group[key] || {}
    ).length;

  if (!count) {
    await reply(
      ctx,
      global
        ? '• لا يوجد مكتومين عام'
        : '• لا يوجد مكتومين'
    );
    return;
  }

  group[key] = {};

  saveData();

  await reply(
    ctx,
    global
      ? `• تم مسح ( ${count} ) من المكتومين عام`
      : `• تم مسح ( ${count} ) من المكتومين`
  );
}

async function listMuted(ctx) {
  const group =
    ensureGroup(ctx);

  const list =
    Object.values(
      group.muted || {}
    );

  if (!list.length) {
    await reply(
      ctx,
      '• لا يوجد مكتومين'
    );
    return;
  }

  let text =
    '• قائمة المكتومين\n' +
    '━━━━━━━━━\n';

  list.forEach(
    (item, index) => {
      text +=
        `${index + 1} ) ${html(
          item.name
        )}\n`;
    }
  );

  text += '━━━━━━━━━';

  await reply(ctx, text);
}

/* =========================================================
   التقييد
========================================================= */

async function restrict(ctx) {
  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  if (!await targetAllowed(ctx, target)) {
    return;
  }

  const group =
    ensureGroup(ctx);

  group.restricted[
    idOf(target.id)
  ] = {
    id: target.id,
    name: displayName(target),
    time: Date.now()
  };

  if (await botAdmin(ctx)) {
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
  }

  saveData();

  await reply(
    ctx,
    `• تم تقييد ${html(
      displayName(target)
    )}.`
  );
}

async function unrestrict(ctx) {
  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  const group =
    ensureGroup(ctx);

  delete group.restricted[
    idOf(target.id)
  ];

  if (await botAdmin(ctx)) {
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
  }

  saveData();

  await reply(
    ctx,
    '• تم إلغاء التقييد.'
  );
}

async function listRestricted(ctx) {
  if (
    !hasRank(
      ctx.from.id,
      RANK.DEV2
    )
  ) {
    await reply(
      ctx,
      '• هذا الامر يخص ↤ ｢ Dev²🎖 ｣'
    );
    return;
  }

  const group =
    ensureGroup(ctx);

  const list =
    Object.values(
      group.restricted || {}
    );

  if (!list.length) {
    await reply(
      ctx,
      '• لا يوجد مقيدين'
    );
    return;
  }

  let text =
    '• قائمة المقيدين\n' +
    '━━━━━━━━━\n';

  list.forEach(
    (item, index) => {
      text +=
        `${index + 1} ) ${html(
          item.name
        )}\n`;
    }
  );

  text += '━━━━━━━━━';

  await reply(ctx, text);
}

async function clearRestricted(ctx) {
  if (
    !hasRank(
      ctx.from.id,
      RANK.MYTH_STAR
    )
  ) {
    await reply(
      ctx,
      '• هذا الأمر متاح من رتبة Myth 🎖️ فأعلى.'
    );
    return;
  }

  const group =
    ensureGroup(ctx);

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

async function ban(ctx) {
  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  if (!await targetAllowed(ctx, target)) {
    return;
  }

  const group =
    ensureGroup(ctx);

  group.banned[
    idOf(target.id)
  ] = {
    id: target.id,
    name: displayName(target)
  };

  if (await botAdmin(ctx)) {
    try {
      await ctx.telegram.banChatMember(
        ctx.chat.id,
        target.id
      );
    } catch {}
  }

  saveData();

  await reply(
    ctx,
    `• تم حظر ${html(
      displayName(target)
    )}.`
  );
}

async function unban(ctx) {
  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  const group =
    ensureGroup(ctx);

  delete group.banned[
    idOf(target.id)
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

async function kick(ctx) {
  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  if (!await targetAllowed(ctx, target)) {
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
    `• تم طرد ${html(
      displayName(target)
    )}.`
  );
}

/* =========================================================
   التحذيرات
========================================================= */

async function warn(ctx) {
  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  if (!await targetAllowed(ctx, target)) {
    return;
  }

  const group =
    ensureGroup(ctx);

  const id =
    idOf(target.id);

  group.warnings[id] =
    Number(group.warnings[id] || 0) + 1;

  const count =
    group.warnings[id];

  saveData();

  if (count >= 3) {
    await mute(ctx);
    group.warnings[id] = 0;
    saveData();

    await reply(
      ctx,
      `• وصل ${html(
        displayName(target)
      )} إلى 3 إنذارات وتم كتمه.`
    );

    return;
  }

  await reply(
    ctx,
    `• تم تحذير ${html(
      displayName(target)
    )}\n` +
    `• التحذيرات ↤ ${count}/3`
  );
}

async function clearWarning(ctx) {
  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  const group =
    ensureGroup(ctx);

  delete group.warnings[
    idOf(target.id)
  ];

  saveData();

  await reply(
    ctx,
    '• تم إلغاء التحذيرات.'
  );
}

/* =========================================================
   الكلمات الممنوعة
========================================================= */

async function addForbidden(ctx, word) {
  if (
    !hasRank(
      ctx.from.id,
      RANK.DEV2
    )
  ) {
    await reply(
      ctx,
      '• هذا الامر يخص ↤ ｢ Dev²🎖 ｣'
    );
    return;
  }

  const group =
    ensureGroup(ctx);

  word = norm(word);

  if (!word) return;

  if (
    !group.forbiddenWords.includes(word)
  ) {
    group.forbiddenWords.push(word);
  }

  saveData();

  await reply(
    ctx,
    `• تم منع الكلمة: ${html(word)}`
  );
}

async function removeForbidden(ctx, word) {
  if (
    !hasRank(
      ctx.from.id,
      RANK.DEV2
    )
  ) {
    await reply(
      ctx,
      '• هذا الامر يخص ↤ ｢ Dev²🎖 ｣'
    );
    return;
  }

  const group =
    ensureGroup(ctx);

  group.forbiddenWords =
    group.forbiddenWords.filter(
      x => x !== norm(word)
    );

  saveData();

  await reply(
    ctx,
    '• تم إلغاء منع الكلمة.'
  );
}

async function listForbidden(ctx) {
  const group =
    ensureGroup(ctx);

  if (!group.forbiddenWords.length) {
    await reply(
      ctx,
      '• لا توجد كلمات ممنوعة.'
    );
    return;
  }

  await reply(
    ctx,
    '• الكلمات الممنوعة:\n\n' +
    group.forbiddenWords
      .map(
        (x, i) =>
          `${i + 1} ) ${html(x)}`
      )
      .join('\n')
  );
}

async function clearForbidden(ctx) {
  if (
    !hasRank(
      ctx.from.id,
      RANK.DEV2
    )
  ) {
    await reply(
      ctx,
      '• هذا الامر يخص ↤ ｢ Dev²🎖 ｣'
    );
    return;
  }

  const group =
    ensureGroup(ctx);

  group.forbiddenWords = [];

  saveData();

  await reply(
    ctx,
    '• تم مسح الكلمات الممنوعة.'
  );
}

/* =========================================================
   الحماية
========================================================= */

async function protection(ctx, key, value) {
  if (
    !hasRank(
      ctx.from.id,
      RANK.DEV
    )
  ) {
    await reply(
      ctx,
      '• هذا الامر يخص ↤ ｢ Dev 🎖 ｣'
    );
    return;
  }

  const group =
    ensureGroup(ctx);

  group.protection[key] = value;

  saveData();

  await reply(
    ctx,
    value
      ? '• تم فتح الحماية المطلوبة.'
      : '• تم قفل الحماية المطلوبة.'
  );
}

async function protectionStatus(ctx) {
  const group =
    ensureGroup(ctx);

  const p =
    group.protection;

  await reply(
    ctx,
    `• حالة الحماية\n\n` +
    `• المخالفات ↤ ${p.violations ? 'مفتوحة' : 'مقفلة'}\n` +
    `• الروابط ↤ ${p.links ? 'مفتوحة' : 'مقفلة'}\n` +
    `• المنشن ↤ ${p.mentions ? 'مفتوح' : 'مقفل'}\n` +
    `• التعديلات ↤ ${p.edits ? 'مفتوحة' : 'مقفلة'}\n` +
    `• السبام ↤ ${p.spam ? 'مفتوح' : 'مقفل'}`
  );
}

/* =========================================================
   الردود المخصصة
========================================================= */

async function addReply(ctx, word, response) {
  if (
    !hasRank(
      ctx.from.id,
      RANK.MYTH_STAR
    )
  ) {
    await reply(
      ctx,
      '• هذا الأمر متاح من رتبة Myth 🎖️ فأعلى.'
    );
    return;
  }

  const group =
    ensureGroup(ctx);

  word = clean(word);
  response = clean(response);

  if (!word || !response) {
    await reply(
      ctx,
      '• الصيغة:\nاضف رد الكلمة | الرد'
    );
    return;
  }

  group.customReplies[
    norm(word)
  ] = response;

  saveData();

  await reply(
    ctx,
    `• تم إضافة الرد\n` +
    `• الكلمة ↤ ${html(word)}`
  );
}

async function deleteReply(ctx, word) {
  if (
    !hasRank(
      ctx.from.id,
      RANK.MYTH_STAR
    )
  ) {
    await reply(
      ctx,
      '• هذا الأمر متاح من رتبة Myth 🎖️ فأعلى.'
    );
    return;
  }

  const group =
    ensureGroup(ctx);

  delete group.customReplies[
    norm(word)
  ];

  saveData();

  await reply(
    ctx,
    '• تم حذف الرد.'
  );
}

async function listReplies(ctx) {
  const group =
    ensureGroup(ctx);

  const keys =
    Object.keys(
      group.customReplies || {}
    );

  if (!keys.length) {
    await reply(
      ctx,
      '• لا توجد ردود.'
    );
    return;
  }

  await reply(
    ctx,
    '• ردودي:\n\n' +
    keys.map(
      (x, i) =>
        `${i + 1} ) ${html(x)}`
    ).join('\n')
  );
}

/* =========================================================
   الأوامر المخصصة
========================================================= */

async function addCommand(ctx, name, response) {
  if (
    !hasRank(
      ctx.from.id,
      RANK.MYTH_STAR
    )
  ) {
    await reply(
      ctx,
      '• هذا الأمر متاح من رتبة Myth 🎖️ فأعلى.'
    );
    return;
  }

  const group =
    ensureGroup(ctx);

  group.customCommands[
    lockKey(name)
  ] = clean(response);

  saveData();

  await reply(
    ctx,
    '• تم إضافة الأمر.'
  );
}

async function deleteCommand(ctx, name) {
  if (
    !hasRank(
      ctx.from.id,
      RANK.MYTH_STAR
    )
  ) {
    await reply(
      ctx,
      '• هذا الأمر متاح من رتبة Myth 🎖️ فأعلى.'
    );
    return;
  }

  const group =
    ensureGroup(ctx);

  delete group.customCommands[
    lockKey(name)
  ];

  saveData();

  await reply(
    ctx,
    '• تم حذف الأمر.'
  );
}

async function listCommands(ctx) {
  const group =
    ensureGroup(ctx);

  const keys =
    Object.keys(
      group.customCommands || {}
    );

  if (!keys.length) {
    await reply(
      ctx,
      '• لا توجد أوامر مضافة.'
    );
    return;
  }

  await reply(
    ctx,
    '• اوامري:\n\n' +
    keys.map(
      (x, i) =>
        `${i + 1} ) ${html(x)}`
    ).join('\n')
  );
}

/* =========================================================
   المالك
========================================================= */

async function owner(ctx) {
  await reply(
    ctx,
    `• المالك\n\n` +
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
   /start بالخاص
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

  const me =
    await ctx.telegram.getMe();

  const addUrl =
    `https://t.me/${me.username}?startgroup=true`;

  await ctx.reply(
    `أهلا بك يا قلبي - ${mention(
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
            `https://t.me/${OWNER_USERNAME}`
          )
        ]
      ])
    }
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
      .slice(2, 8)
  );
}

async function whisper(ctx) {
  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• الهمسة تبدأ بالرد على الشخص.'
    );
    return;
  }

  const id =
    whisperId();

  DATA.whispers[id] = {
    id,
    senderId: ctx.from.id,
    senderName: displayName(ctx.from),
    targetId: target.id,
    targetName: displayName(target),
    chatId: ctx.chat.id,
    content: null,
    createdAt: Date.now(),
    viewed: false
  };

  DATA.pendingWhispers[
    idOf(ctx.from.id)
  ] = id;

  saveData();

  const me =
    await ctx.telegram.getMe();

  const view =
    `https://t.me/${me.username}?start=whisper_${id}`;

  const response =
    `https://t.me/${me.username}?start=whisperreply_${id}`;

  await reply(
    ctx,
    `• 💌 همسة إلى ${mention(target)}\n\n` +
    `• أرسل محتوى الهمسة في الخاص للبوت.`,
    {
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            'رؤية الهمسه',
            view
          ),
          Markup.button.url(
            'رد على الهمسه',
            response
          )
        ]
      ])
    }
  );
}

/* =========================================================
   المكالمة
========================================================= */

function duration(seconds) {
  seconds = Math.floor(seconds || 0);

  const m =
    Math.floor(seconds / 60);

  const s =
    seconds % 60;

  return `${m} دقيقة ${s} ثانية`;
}

async function voiceStart(ctx) {
  const group =
    ensureGroup(ctx);

  group.voice.active = true;
  group.voice.startedAt =
    Date.now();

  saveData();

  await reply(
    ctx,
    'بدأت المكالمه الصوتيه'
  );
}

async function voiceEnd(ctx) {
  const group =
    ensureGroup(ctx);

  let seconds = 0;

  if (group.voice.startedAt) {
    seconds =
      (
        Date.now() -
        group.voice.startedAt
      ) / 1000;
  }

  group.voice.active = false;
  group.voice.startedAt = null;

  saveData();

  await reply(
    ctx,
    `انتهت المكالمه الصوتيه\n\n` +
    `• مدة المكالمة ↤ ${duration(
      seconds
    )}`
  );
}

async function invite(ctx) {
  const me =
    await ctx.telegram.getMe();

  await reply(
    ctx,
    '• دعوة البوت:',
    {
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            'اضفني الى مجموعتك',
            `https://t.me/${me.username}?startgroup=true`
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
  if (
    !isOwner(
      ctx.from.id,
      ctx.from.username
    )
  ) {
    await reply(
      ctx,
      '• هذا الامر يخص ↤ ｢ Dev 🎖 ｣'
    );
    return;
  }

  if (!text) {
    await reply(
      ctx,
      '• اكتب نص الإذاعة.'
    );
    return;
  }

  DATA.broadcastPending = {
    userId: ctx.from.id,
    text
  };

  saveData();

  await reply(
    ctx,
    `• تأكيد الإذاعة:\n\n${html(text)}`,
    {
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            'تأكيد',
            'broadcast_yes'
          ),
          Markup.button.callback(
            'إلغاء',
            'broadcast_no'
          )
        ]
      ])
    }
  );
}

bot.action(
  'broadcast_yes',
  async ctx => {
    try {
      await ctx.answerCbQuery();
    } catch {}

    const pending =
      DATA.broadcastPending;

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
      const userId of DATA.subscribers
    ) {
      try {
        await ctx.telegram.sendMessage(
          userId,
          pending.text
        );

        sent++;
      } catch {
        failed++;
      }
    }

    DATA.broadcasts.push({
      text: pending.text,
      sent,
      failed,
      time: Date.now()
    });

    DATA.broadcastPending = null;

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
  'broadcast_no',
  async ctx => {
    try {
      await ctx.answerCbQuery();
    } catch {}

    DATA.broadcastPending = null;
    saveData();

    try {
      await ctx.editMessageText(
        '• تم إلغاء الإذاعة.'
      );
    } catch {}
  }
);

/* =========================================================
   البحث عن الأغاني
========================================================= */

function musicQuery(text) {
  return clean(
    text.replace(
      /^(بحث\s+اغنية|بحث\s+أغنية|بحث|اغنيه|أغنية|شغل|تشغيل)\s*/i,
      ''
    )
  );
}

async function searchMusic(ctx, query) {
  if (!query) {
    await reply(
      ctx,
      '• اكتب اسم الأغنية.'
    );
    return;
  }

  await reply(
    ctx,
    `• نتائج البحث عن: <b>${html(
      query
    )}</b>\n\n` +
    `• يوتيوب\n` +
    `• سبوتيفاي\n` +
    `• ريسو\n` +
    `• ابل ميوزك\n` +
    `• ساوند كلاود\n\n` +
    `• تشغيل الصوت داخل المكالمة يحتاج مكوّن صوتي MTProto/Userbot.`
  );
}

/* =========================================================
   تنظيف
========================================================= */

async function cleanMessages(ctx, amount) {
  if (
    !hasRank(
      ctx.from.id,
      RANK.MYTH_STAR
    )
  ) {
    await reply(
      ctx,
      '• هذا الأمر متاح من رتبة Myth 🎖️ فأعلى.'
    );
    return;
  }

  if (!await botAdmin(ctx)) {
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

  let deleted = 0;

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
   الألعاب
========================================================= */

async function toggleGames(ctx, enabled) {
  if (
    !hasRank(
      ctx.from.id,
      RANK.DEV
    )
  ) {
    await reply(
      ctx,
      '• هذا الامر يخص ↤ ｢ Dev 🎖 ｣'
    );
    return;
  }

  const group =
    ensureGroup(ctx);

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
   الاقتصاد
========================================================= */

async function money(ctx) {
  const user =
    ensureUser(ctx.from);

  await reply(
    ctx,
    `• فلوسك ↤ ${Number(
      user.money || 0
    ).toLocaleString('en-US')}`
  );
}

async function moneyReply(ctx) {
  const target =
    await targetFromReply(ctx);

  if (!target) {
    await reply(
      ctx,
      '• قم بالرد على العضو.'
    );
    return;
  }

  const user =
    ensureUser(target);

  await reply(
    ctx,
    `• فلوس ${html(
      displayName(target)
    )} ↤ ${Number(
      user.money || 0
    ).toLocaleString('en-US')}`
  );
}

async function bank(ctx) {
  const user =
    ensureUser(ctx.from);

  if (user.bank) {
    await reply(
      ctx,
      '• لديك حساب بنكي بالفعل.'
    );
    return;
  }

  user.bank = {
    createdAt: Date.now()
  };

  saveData();

  await reply(
    ctx,
    '• تم إنشاء حسابك البنكي.'
  );
}

async function account(ctx) {
  const user =
    ensureUser(ctx.from);

  await reply(
    ctx,
    `• حسابك\n\n` +
    `• الرصيد ↤ ${Number(
      user.money || 0
    ).toLocaleString('en-US')}\n` +
    `• البنك ↤ ${user.bank ? 'موجود' : 'غير موجود'}`
  );
}

/* =========================================================
   أوامر المطور
========================================================= */

async function botStatus(ctx) {
  if (
    !isOwner(
      ctx.from.id,
      ctx.from.username
    )
  ) {
    await reply(
      ctx,
      '• هذا الامر يخص ↤ ｢ Dev 🎖 ｣'
    );
    return;
  }

  await reply(
    ctx,
    `• حالة البوت\n\n` +
    `• المستخدمين ↤ ${Object.keys(
      DATA.users
    ).length}\n` +
    `• القروبات ↤ ${Object.keys(
      DATA.groups
    ).length}\n` +
    `• المشتركين ↤ ${DATA.subscribers.length}`
  );
}

/* =========================================================
   قائمة الأوامر
========================================================= */

function commandList() {
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
• عام
• فك الكتم
• فك الكتم العام
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

<b>الردود والأوامر</b>
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
• انشاء حساب بنكي
• حسابي

<b>المكالمة</b>
• بدأت المكالمه الصوتيه
• انتهت المكالمه الصوتيه
• دعوة

<b>المطور</b>
• المالك
• إذاعة
• حالة البوت
`;
}

/* =========================================================
   /start
========================================================= */

bot.start(async ctx => {
  ensureUser(ctx.from);

  if (isPrivate(ctx)) {
    await privateStart(ctx);
    return;
  }

  await reply(
    ctx,
    '• أهلًا بك.\n• استخدم «اوامر» لعرض الأوامر.'
  );
});

/* =========================================================
   الرسائل
========================================================= */

bot.on('message', async ctx => {
  try {
    ensureUser(ctx.from);

    /* ================================================
       الخاص
    ================================================= */

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

      /*
        معالجة محتوى الهمسة في الخاص
      */

      const privateText =
        ctx.message.text || '';

      if (
        DATA.pendingWhispers[
          idOf(ctx.from.id)
        ]
      ) {
        const whisperId =
          DATA.pendingWhispers[
            idOf(ctx.from.id)
          ];

        const whisperData =
          DATA.whispers[whisperId];

        if (
          whisperData &&
          String(
            whisperData.targetId
          ) ===
          String(ctx.from.id)
        ) {
          whisperData.content =
            privateText ||
            '[محتوى غير نصي]';

          delete DATA.pendingWhispers[
            idOf(ctx.from.id)
          ];

          saveData();

          try {
            await ctx.telegram.sendMessage(
              whisperData.chatId,
              `• 💌 تم إرسال الهمسة إلى ${html(
                whisperData.targetName
              )}`
            );
          } catch {}

          await ctx.reply(
            '• تم إرسال الهمسة بنجاح.'
          );

          return;
        }
      }

      return;
    }

    if (!isGroup(ctx)) {
      return;
    }

    const text =
      clean(
        ctx.message.text || ''
      );

    const group =
      ensureGroup(ctx);

    /*
      ==================================================
      مهم جدًا:
      التفاعل يسجل أي رسالة،
      لكنه لا يعني أن البوت يرد.
      ==================================================
    */

    addInteraction(ctx);

    /*
      الرسائل العادية التي لا تحتوي أمرًا
      ستصل إلى نهاية المعالج بدون أي رد.
    */

    if (!text) {
      return;
    }

    /*
      الكلمات الممنوعة
    */

    if (
      group.protection.violations &&
      group.forbiddenWords.length
    ) {
      const found =
        group.forbiddenWords.find(
          word =>
            norm(text).includes(word)
        );

      if (found) {
        try {
          await ctx.deleteMessage();
        } catch {}

        return;
      }
    }

    /*
      ==================================================
      قفل الأمر ينتظر رتبة
      ==================================================
    */

    const pending =
      group.pendingCommandLock[
        idOf(ctx.from.id)
      ];

    if (pending) {
      const rank =
        parseRank(text);

      /*
        فقط إذا كانت الرسالة رتبة فعلًا.
        الكلام العادي لا ينفذ أي شيء.
      */

      if (rank !== null) {
        await pendingLockRank(
          ctx,
          text
        );
        return;
      }
    }

    /*
      ==================================================
      قفل / فتح أمر
      ==================================================
    */

    if (
      await lockCommand(
        ctx,
        text
      )
    ) {
      return;
    }

    if (
      await unlockCommand(
        ctx,
        text
      )
    ) {
      return;
    }

    /*
      ==================================================
      رتبتي
      ==================================================
    */

    if (
      norm(text) ===
      'رتبتي'
    ) {
      if (
        await commandAllowed(
          ctx,
          'رتبتي'
        )
      ) {
        await myRank(ctx);
      }

      return;
    }

    /*
      رتبته
    */

    if (
      norm(text) ===
      'رتبته'
    ) {
      if (
        await commandAllowed(
          ctx,
          'رتبته'
        )
      ) {
        await replyRank(ctx);
      }

      return;
    }

    /*
      ==================================================
      التفاعل
      ==================================================
    */

    if (
      norm(text) ===
      'تفاعلي'
    ) {
      if (
        await commandAllowed(
          ctx,
          'تفاعلي'
        )
      ) {
        await myInteraction(ctx);
      }

      return;
    }

    if (
      norm(text) ===
      'تفاعله'
    ) {
      if (
        await commandAllowed(
          ctx,
          'تفاعله'
        )
      ) {
        await replyInteraction(ctx);
      }

      return;
    }

    if (
      norm(text) ===
      'المتفاعلين'
    ) {
      if (
        await commandAllowed(
          ctx,
          'المتفاعلين'
        )
      ) {
        await topInteractions(ctx);
      }

      return;
    }

    if (
      norm(text) ===
      'تصفير المتفاعلين'
    ) {
      await resetInteractions(ctx);
      return;
    }

    /*
      ==================================================
      رفع الرتب
      ==================================================
    */

    const promotion =
      promotionRank(text);

    if (promotion !== null) {
      if (
        await commandAllowed(
          ctx,
          text
        )
      ) {
        await promote(
          ctx,
          promotion
        );
      }

      return;
    }

    if (
      norm(text) ===
      'تنزيل'
    ) {
      if (
        await commandAllowed(
          ctx,
          'تنزيل'
        )
      ) {
        await demote(ctx);
      }

      return;
    }

    /*
      ==================================================
      رفع مشرف
      ==================================================
    */

    if (
      norm(text) ===
      'رفع مشرف' ||
      norm(text) ===
      'ترقيه'
    ) {
      if (
        await commandAllowed(
          ctx,
          text
        )
      ) {
        await promoteAdmin(ctx);
      }

      return;
    }

    if (
      norm(text) ===
      'تنزيل مشرف' ||
      norm(text) ===
      'تنزيل المشرف'
    ) {
      if (
        await commandAllowed(
          ctx,
          text
        )
      ) {
        await demoteAdmin(ctx);
      }

      return;
    }

    /*
      ==================================================
      الكتم
      ==================================================
    */

    if (
      norm(text) ===
      'كتم'
    ) {
      if (
        await commandAllowed(
          ctx,
          'كتم'
        )
      ) {
        await mute(ctx);
      }

      return;
    }

    if (
      norm(text) ===
      'كتم عام' ||
      norm(text) ===
      'عام'
    ) {
      if (
        await commandAllowed(
          ctx,
          text
        )
      ) {
        await mute(
          ctx,
          true
        );
      }

      return;
    }

    if (
      norm(text) ===
      'فك الكتم'
    ) {
      await unmute(ctx);
      return;
    }

    if (
      norm(text) ===
      'فك الكتم العام'
    ) {
      await unmute(
        ctx,
        true
      );
      return;
    }

    if (
      norm(text) ===
      'مم'
    ) {
      await clearMuted(ctx);
      return;
    }

    if (
      norm(text) ===
      'خخ'
    ) {
      await clearMuted(
        ctx,
        true
      );
      return;
    }

    if (
      norm(text) ===
      'قائمة المكتومين' ||
      norm(text) ===
      'المكتومين'
    ) {
      await listMuted(ctx);
      return;
    }

    /*
      ==================================================
      التقييد
      ==================================================
    */

    if (
      norm(text) ===
      'تقييد' ||
      norm(text) ===
      'تق'
    ) {
      await restrict(ctx);
      return;
    }

    if (
      norm(text) ===
      'الغاء التقييد' ||
      norm(text) ===
      'رفع القيود'
    ) {
      await unrestrict(ctx);
      return;
    }

    if (
      norm(text) ===
      'مق' ||
      norm(text) ===
      'قائمة المقيدين' ||
      norm(text) ===
      'المقيدين'
    ) {
      await listRestricted(ctx);
      return;
    }

    if (
      norm(text) ===
      'مسح المقيدين'
    ) {
      await clearRestricted(ctx);
      return;
    }

    /*
      ==================================================
      الحظر والطرد
      ==================================================
    */

    if (
      norm(text) ===
      'حظر'
    ) {
      await ban(ctx);
      return;
    }

    if (
      norm(text) ===
      'فك الحظر'
    ) {
      await unban(ctx);
      return;
    }

    if (
      norm(text) ===
      'طرد'
    ) {
      await kick(ctx);
      return;
    }

    /*
      ==================================================
      التحذيرات
      ==================================================
    */

    if (
      norm(text) ===
      'تحذير' ||
      norm(text) ===
      'انذار' ||
      norm(text) ===
      'إنذار'
    ) {
      await warn(ctx);
      return;
    }

    if (
      norm(text) ===
      'الغاء التحذير' ||
      norm(text) ===
      'إلغاء التحذير'
    ) {
      await clearWarning(ctx);
      return;
    }

    /*
      ==================================================
      الحماية
      ==================================================
    */

    if (
      norm(text) ===
      'فتح المخالفات'
    ) {
      await protection(
        ctx,
        'violations',
        true
      );
      return;
    }

    if (
      norm(text) ===
      'غلق المخالفات' ||
      norm(text) ===
      'قفل المخالفات'
    ) {
      await protection(
        ctx,
        'violations',
        false
      );
      return;
    }

    if (
      norm(text) ===
      'فتح الروابط'
    ) {
      await protection(
        ctx,
        'links',
        true
      );
      return;
    }

    if (
      norm(text) ===
      'قفل الروابط'
    ) {
      await protection(
        ctx,
        'links',
        false
      );
      return;
    }

    if (
      norm(text) ===
      'فتح المنشن'
    ) {
      await protection(
        ctx,
        'mentions',
        true
      );
      return;
    }

    if (
      norm(text) ===
      'غلق المنشن'
    ) {
      await protection(
        ctx,
        'mentions',
        false
      );
      return;
    }

    if (
      norm(text) ===
      'حالة الحماية'
    ) {
      await protectionStatus(ctx);
      return;
    }

    /*
      ==================================================
      الكلمات الممنوعة
      ==================================================
    */

    let match =
      text.match(
        /^منع\s+الكلمه\s+(.+)$/i
      );

    if (match) {
      await addForbidden(
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
      await removeForbidden(
        ctx,
        match[1]
      );
      return;
    }

    if (
      norm(text) ===
      'الكلمات الممنوعه'
    ) {
      await listForbidden(ctx);
      return;
    }

    if (
      norm(text) ===
      'مسح الكلمات الممنوعه'
    ) {
      await clearForbidden(ctx);
      return;
    }

    /*
      ==================================================
      تنظيف
      ==================================================
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
      norm(text) ===
      'تفعيل التنظيف التلقائي'
    ) {
      if (
        !hasRank(
          ctx.from.id,
          RANK.MYTH_STAR
        )
      ) {
        await reply(
          ctx,
          '• هذا الأمر متاح من رتبة Myth 🎖️ فأعلى.'
        );
        return;
      }

      group.cleaning.auto = true;
      saveData();

      await reply(
        ctx,
        '• تم تفعيل التنظيف التلقائي.'
      );

      return;
    }

    if (
      norm(text) ===
      'تعطيل التنظيف التلقائي'
    ) {
      if (
        !hasRank(
          ctx.from.id,
          RANK.MYTH_STAR
        )
      ) {
        await reply(
          ctx,
          '• هذا الأمر متاح من رتبة Myth 🎖️ فأعلى.'
        );
        return;
      }

      group.cleaning.auto = false;
      saveData();

      await reply(
        ctx,
        '• تم تعطيل التنظيف التلقائي.'
      );

      return;
    }

    /*
      ==================================================
      الهمسة
      ==================================================
    */

    if (
      norm(text) ===
      'اهمس' ||
      norm(text) ===
      'همسه' ||
      norm(text) ===
      'ه'
    ) {
      await whisper(ctx);
      return;
    }

    /*
      ==================================================
      بحث الأغاني
      ==================================================
    */

    if (
      /^(بحث|بحث\s+أغنية|بحث\s+اغنية|اغنيه|أغنية|شغل|تشغيل)\s+/i
        .test(text)
    ) {
      await searchMusic(
        ctx,
        musicQuery(text)
      );
      return;
    }

    /*
      ==================================================
      الموسيقى
      ==================================================
    */

    if (
      norm(text) ===
      'وقف'
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
      norm(text) ===
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
      norm(text) ===
      'تخطي'
    ) {
      if (
        group.music.queue.length
      ) {
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
      norm(text) ===
      'إلغاء الأغنية'
    ) {
      group.music.queue = [];
      group.music.playing = false;

      saveData();

      await reply(
        ctx,
        '• تم إلغاء الأغنية والطابور.'
      );

      return;
    }

    if (
      norm(text) ===
      'الطابور'
    ) {
      if (
        !group.music.queue.length
      ) {
        await reply(
          ctx,
          '• الطابور فارغ.'
        );
        return;
      }

      await reply(
        ctx,
        group.music.queue
          .map(
            (x, i) =>
              `${i + 1} ) ${html(
                x.title || x
              )}`
          )
          .join('\n')
      );

      return;
    }

    if (
      norm(text) ===
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
      ==================================================
      الألعاب
      ==================================================
    */

    if (
      norm(text) ===
      'قفل الالعاب'
    ) {
      await toggleGames(
        ctx,
        false
      );
      return;
    }

    if (
      norm(text) ===
      'فتح الالعاب'
    ) {
      await toggleGames(
        ctx,
        true
      );
      return;
    }

    /*
      ==================================================
      الاقتصاد
      ==================================================
    */

    if (
      norm(text) ===
      'فلوسي'
    ) {
      await money(ctx);
      return;
    }

    if (
      norm(text) ===
      'فلوسه'
    ) {
      await moneyReply(ctx);
      return;
    }

    if (
      norm(text) ===
      'انشاء حساب بنكي'
    ) {
      await bank(ctx);
      return;
    }

    if (
      norm(text) ===
      'حسابي'
    ) {
      await account(ctx);
      return;
    }

    /*
      ==================================================
      المكالمات
      ==================================================
    */

    if (
      norm(text) ===
      'بدأت المكالمه الصوتيه'
    ) {
      await voiceStart(ctx);
      return;
    }

    if (
      norm(text) ===
      'انتهت المكالمه الصوتيه'
    ) {
      await voiceEnd(ctx);
      return;
    }

    if (
      norm(text) ===
      'دعوة'
    ) {
      await invite(ctx);
      return;
    }

    /*
      ==================================================
      المالك
      ==================================================
    */

    if (
      norm(text) ===
      'المالك'
    ) {
      await owner(ctx);
      return;
    }

    /*
      ==================================================
      الإذاعة
      ==================================================
    */

    match =
      text.match(
        /^(إذاعة|اذاعه)\s+(.+)$/i
      );

    if (match) {
      await broadcast(
        ctx,
        match[2]
      );
      return;
    }

    /*
      ==================================================
      حالة البوت
      ==================================================
    */

    if (
      norm(text) ===
      'حالة البوت'
    ) {
      await botStatus(ctx);
      return;
    }

    /*
      ==================================================
      إضافة رد
      ==================================================
    */

    match =
      text.match(
        /^اضف\s+رد\s+(.+?)\s*\|\s*(.+)$/i
      );

    if (match) {
      await addReply(
        ctx,
        match[1],
        match[2]
      );
      return;
    }

    /*
      حذف رد
      ==================================================
    */

    match =
      text.match(
        /^حذف\s+رد\s+(.+)$/i
      );

    if (match) {
      await deleteReply(
        ctx,
        match[1]
      );
      return;
    }

    /*
      ردودي
      ==================================================
    */

    if (
      norm(text) ===
      'ردودي'
    ) {
      await listReplies(ctx);
      return;
    }

    /*
      ==================================================
      إضافة أمر
      ==================================================
    */

    match =
      text.match(
        /^اضف\s+امر\s+(.+?)\s*\|\s*(.+)$/i
      );

    if (match) {
      await addCommand(
        ctx,
        match[1],
        match[2]
      );
      return;
    }

    /*
      حذف أمر
      ==================================================
    */

    match =
      text.match(
        /^حذف\s+امر\s+(.+)$/i
      );

    if (match) {
      await deleteCommand(
        ctx,
        match[1]
      );
      return;
    }

    /*
      اوامري
      ==================================================
    */

    if (
      norm(text) ===
      'اوامري'
    ) {
      await listCommands(ctx);
      return;
    }

    /*
      ==================================================
      قائمة الأوامر
      ==================================================
    */

    if (
      norm(text) ===
      'اوامر'
    ) {
      if (
        !hasRank(
          ctx.from.id,
          RANK.DEV
        )
      ) {
        await reply(
          ctx,
          '• هذا الامر يخص ↤ ｢ Dev 🎖 ｣'
        );
        return;
      }

      await reply(
        ctx,
        commandList()
      );

      return;
    }

    /*
      ==================================================
      الردود المخصصة
      ==================================================
    */

    const customReply =
      group.customReplies[
        norm(text)
      ];

    if (customReply) {
      await reply(
        ctx,
        html(customReply)
      );
      return;
    }

    /*
      ==================================================
      الأوامر المخصصة
      ==================================================
    */

    const customCommand =
      group.customCommands[
        lockKey(text)
      ];

    if (customCommand) {
      if (
        await commandAllowed(
          ctx,
          text
        )
      ) {
        await reply(
          ctx,
          html(customCommand)
        );
      }

      return;
    }

    /*
      ==================================================
      مهم جدًا:
      نهاية المعالج = لا رد.
      أي كلام عادي يوصل هنا وينتهي.
      ==================================================
    */

    return;

  } catch (error) {
    console.error(
      'MESSAGE ERROR:',
      error
    );
  }
});

/* =========================================================
   أخطاء
========================================================= */

bot.catch(
  (error) => {
    console.error(
      'BOT ERROR:',
      error
    );
  }
);

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

/* =========================================================
   تشغيل البوت
========================================================= */

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
    'LAUNCH ERROR:',
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
