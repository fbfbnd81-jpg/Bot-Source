const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN غير موجود في متغيرات البيئة");
}

const bot = new Telegraf(BOT_TOKEN);

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "data.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_DATA = {
  roles: {},
  stats: {},
  chats: {},
  whispers: {},
  pendingWhispers: {},
  pendingReplies: {},
  customCommands: {},
  customReplies: {},
  settings: {},
  warnings: {},
  muted: {},
  globalMuted: {},
  activeGames: {},
  money: {}
};

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(DEFAULT_DATA, null, 2),
        "utf8"
      );
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }

    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);

    return {
      ...JSON.parse(JSON.stringify(DEFAULT_DATA)),
      ...parsed
    };
  } catch (err) {
    console.error("خطأ قراءة البيانات:", err);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

let data = loadData();

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2),
      "utf8"
    );
  } catch (err) {
    console.error("خطأ حفظ البيانات:", err);
  }
}

const ROLES = {
  "عضو": 0,
  "مميز": 1,
  "مالك": 2,
  "مالك أساسي": 3,
  "Myth": 4,
  "Myth 🎖️": 5,
  "Dev²🎖️": 6,
  "Dev🎖️": 7
};

const ROLE_NAMES = [
  "عضو",
  "مميز",
  "مالك",
  "مالك أساسي",
  "Myth",
  "Myth 🎖️",
  "Dev²🎖️",
  "Dev🎖️"
];

const DEV_USERNAME = "j4xa7";

function ensureUser(user) {
  if (!user) return;

  const id = String(user.id);

  if (!data.roles[id]) {
    data.roles[id] = {
      role: "عضو",
      username: user.username || "",
      firstName: user.first_name || "مستخدم"
    };
  }

  data.roles[id].username =
    user.username || data.roles[id].username || "";

  data.roles[id].firstName =
    user.first_name ||
    data.roles[id].firstName ||
    "مستخدم";

  if (
    (user.username || "").toLowerCase() ===
    DEV_USERNAME.toLowerCase()
  ) {
    data.roles[id].role = "Dev🎖️";
  }
}

function getRole(userId, username = "") {
  if (
    String(username || "").toLowerCase() ===
    DEV_USERNAME.toLowerCase()
  ) {
    return "Dev🎖️";
  }

  const role = data.roles[String(userId)];

  if (!role) return "عضو";

  return role.role || "عضو";
}

function getLevel(userId, username = "") {
  return ROLES[getRole(userId, username)] ?? 0;
}

function roleName(userId, username = "") {
  return getRole(userId, username);
}

function isGroup(ctx) {
  return (
    ctx.chat &&
    ["group", "supergroup"].includes(ctx.chat.type)
  );
}

function ensureChat(ctx) {
  const id = String(ctx.chat.id);

  if (!data.chats[id]) {
    data.chats[id] = {
      violations: true,
      botReplies: true,
      bank: true,
      communication: true,
      forcedSubscription: false,
      serviceBot: false,
      stats: true,
      zagel: false,
      formats: true
    };
  }

  return data.chats[id];
}

function ensureStats(ctx, user = ctx.from) {
  if (!user) return;

  const chatId = String(ctx.chat.id);

  if (!data.stats[chatId]) {
    data.stats[chatId] = {};
  }

  const userId = String(user.id);

  if (!data.stats[chatId][userId]) {
    data.stats[chatId][userId] = {
      id: user.id,
      username: user.username || "",
      firstName: user.first_name || "مستخدم",
      messages: 0
    };
  }

  data.stats[chatId][userId].username =
    user.username ||
    data.stats[chatId][userId].username ||
    "";

  data.stats[chatId][userId].firstName =
    user.first_name ||
    data.stats[chatId][userId].firstName ||
    "مستخدم";
}

function addMessageStat(ctx) {
  if (!isGroup(ctx)) return;

  const chat = ensureChat(ctx);

  if (chat.stats === false) return;

  ensureStats(ctx);

  const chatId = String(ctx.chat.id);
  const userId = String(ctx.from.id);

  data.stats[chatId][userId].messages++;
}

function mention(user) {
  if (!user) return "المستخدم";

  const name =
    user.first_name ||
    user.firstName ||
    user.username ||
    "المستخدم";

  return `[${escapeMarkdown(String(name))}](tg://user?id=${user.id})`;
}

function escapeMarkdown(text) {
  return String(text).replace(
    /([_*\[\]()~`>#+\-=|{}.!\\])/g,
    "\\$1"
  );
}

async function reply(ctx, text, extra = {}) {
  try {
    return await ctx.reply(text, {
      reply_to_message_id:
        ctx.message?.message_id,
      ...extra
    });
  } catch (err) {
    try {
      return await ctx.reply(
        String(text).replace(/\\/g, ""),
        {
          reply_to_message_id:
            ctx.message?.message_id
        }
      );
    } catch (_) {
      return null;
    }
  }
}

function targetFromMessage(ctx) {
  if (!ctx.message?.reply_to_message?.from) {
    return null;
  }

  return ctx.message.reply_to_message.from;
}

function targetFromReplyOrMention(ctx) {
  const target = targetFromMessage(ctx);

  if (target) return target;

  const entities =
    ctx.message?.entities ||
    [];

  const text = ctx.message?.text || "";

  for (const entity of entities) {
    if (entity.type === "text_mention") {
      return entity.user;
    }
  }

  const usernameMatch = text.match(
    /@([A-Za-z0-9_]{5,32})/
  );

  if (usernameMatch) {
    return {
      id: null,
      username: usernameMatch[1],
      first_name: usernameMatch[1]
    };
  }

  return null;
}

async function resolveTarget(ctx) {
  const target = targetFromReplyOrMention(ctx);

  if (!target) return null;

  if (target.id) return target;

  if (target.username) {
    try {
      const member =
        await ctx.telegram.getChatMember(
          ctx.chat.id,
          `@${target.username}`
        );

      if (member?.user) return member.user;
    } catch (_) {}
  }

  return target;
}

function canActOn(ctx, target) {
  if (!target?.id) return false;

  const actorLevel = getLevel(
    ctx.from.id,
    ctx.from.username
  );

  const targetLevel = getLevel(
    target.id,
    target.username
  );

  return actorLevel > targetLevel;
}

function requireLevel(ctx, level) {
  const current = getLevel(
    ctx.from.id,
    ctx.from.username
  );

  if (current < level) {
    return reply(
      ctx,
      "• ماتقدر تستخدم الامر على ↤ ｢ لازم تكون الرتبه مالك وفوق ｣"
    ).then(() => false);
  }

  return Promise.resolve(true);
}

function getMuteStore(chatId) {
  const id = String(chatId);

  if (!data.muted[id]) {
    data.muted[id] = {};
  }

  return data.muted[id];
}

function getGlobalMuteStore() {
  if (!data.globalMuted) {
    data.globalMuted = {};
  }

  return data.globalMuted;
}

async function isAdmin(ctx, userId) {
  try {
    const member =
      await ctx.telegram.getChatMember(
        ctx.chat.id,
        userId
      );

    return (
      member.status === "creator" ||
      member.status === "administrator"
    );
  } catch (_) {
    return false;
  }
}

async function botIsAdmin(ctx) {
  try {
    const member =
      await ctx.telegram.getChatMember(
        ctx.chat.id,
        ctx.botInfo.id
      );

    return (
      member.status === "administrator" ||
      member.status === "creator"
    );
  } catch (_) {
    return false;
  }
}

async function restrictUser(ctx, userId, untilDate = 0) {
  return ctx.telegram.restrictChatMember(
    ctx.chat.id,
    userId,
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
      },
      until_date: untilDate
    }
  );
}

async function unrestrictUser(ctx, userId) {
  return ctx.telegram.restrictChatMember(
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
        can_add_web_page_previews: true
      }
    }
  );
}

async function banUser(ctx, userId) {
  return ctx.telegram.banChatMember(
    ctx.chat.id,
    userId
  );
}

async function unbanUser(ctx, userId) {
  return ctx.telegram.unbanChatMember(
    ctx.chat.id,
    userId,
    {
      only_if_banned: true
    }
  );
}

async function kickUser(ctx, userId) {
  await ctx.telegram.banChatMember(
    ctx.chat.id,
    userId
  );

  await ctx.telegram.unbanChatMember(
    ctx.chat.id,
    userId,
    {
      only_if_banned: true
    }
  );
}

function saveUserInMuteStore(store, user) {
  store[String(user.id)] = {
    id: user.id,
    username: user.username || "",
    firstName:
      user.first_name ||
      user.firstName ||
      "مستخدم",
    createdAt: Date.now()
  };
}

function deleteFromMuteStore(store, userId) {
  delete store[String(userId)];
}

function getCommandText(ctx) {
  return (
    ctx.message?.text ||
    ctx.message?.caption ||
    ""
  ).trim();
}

function commandArgs(ctx) {
  return getCommandText(ctx)
    .split(/\s+/)
    .slice(1);
}

function commandName(ctx) {
  const text = getCommandText(ctx);

  if (!text.startsWith("/")) return "";

  return text
    .split(/\s+/)[0]
    .split("@")[0]
    .toLowerCase();
}

function isTextMessage(ctx) {
  return Boolean(ctx.message?.text);
}

function containsLink(text) {
  return /https?:\/\/|www\.|t\.me\/|telegram\.me\//i.test(
    text || ""
  );
}

function getCustomKey(text) {
  return String(text || "")
    .trim()
    .toLowerCase();
}

async function deleteMessageSafe(ctx) {
  try {
    await ctx.deleteMessage();
    return true;
  } catch (_) {
    return false;
  }
}

async function handleViolations(ctx) {
  if (!isGroup(ctx)) return false;
  if (!ctx.message) return false;

  const chat = ensureChat(ctx);

  if (!chat.violations) return false;

  const text =
    ctx.message.text ||
    ctx.message.caption ||
    "";

  if (!text) return false;

  if (
    containsLink(text) &&
    getLevel(
      ctx.from.id,
      ctx.from.username
    ) < ROLES["مميز"]
  ) {
    await deleteMessageSafe(ctx);

    const key = String(ctx.chat.id);

    if (!data.warnings[key]) {
      data.warnings[key] = {};
    }

    const uid = String(ctx.from.id);

    data.warnings[key][uid] =
      (data.warnings[key][uid] || 0) + 1;

    const count =
      data.warnings[key][uid];

    if (count >= 3) {
      try {
        await restrictUser(
          ctx,
          ctx.from.id
        );

        saveUserInMuteStore(
          getMuteStore(ctx.chat.id),
          ctx.from
        );
      } catch (_) {}

      data.warnings[key][uid] = 0;

      await reply(
        ctx,
        `• المستخدم ذا ↤︎「${mention(ctx.from)}」
• تم كتمه بسبب المخالفات`
      );
    } else {
      await reply(
        ctx,
        `• المستخدم ذا ↤︎「${mention(ctx.from)}」
• مخالفة رقم ${count} من 3`
      );
    }

    saveData();
    return true;
  }

  return false;
}

/* =========================================================
   START
========================================================= */

bot.start(async ctx => {
  const payload =
    ctx.startPayload || "";

  ensureUser(ctx.from);

  if (payload.startsWith("whisper_")) {
    const id = payload.replace(
      "whisper_",
      ""
    );

    const whisper =
      data.whispers[id];

    if (!whisper) {
      return ctx.reply(
        "• الهمسه غير موجوده أو انتهت"
      );
    }

    const buttons = [];

    if (whisper.type === "text") {
      buttons.push([
        Markup.button.callback(
          "رؤية الهمسه",
          `see_whisper_${id}`
        )
      ]);
    } else {
      buttons.push([
        Markup.button.callback(
          "رؤية الهمسه",
          `see_whisper_${id}`
        )
      ]);
    }

    buttons.push([
      Markup.button.callback(
        "رد على الهمسه",
        `reply_whisper_${id}`
      )
    ]);

    return ctx.reply(
      "• وصلت لك همسه جديدة",
      Markup.inlineKeyboard(buttons)
    );
  }

  return ctx.reply(
    `أهلا بك يا قلبي ${mention(ctx.from)}

• بوت متخصص للمجموعات
• إدارة وحماية وترفيه
• همسات وألعاب وإحصائيات

• يمكن استخدامه لإدارة مجموعتك وتنظيمها`,
    {
      parse_mode: "MarkdownV2",
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            "أضفني إلى مجموعتك",
            `https://t.me/${ctx.botInfo.username}?startgroup=true`
          )
        ],
        [
          Markup.button.url(
            "المطور",
            "https://t.me/j4xa7"
          )
        ]
      ])
    }
  );
});

/* =========================================================
   MESSAGE STATS + PROTECTION
========================================================= */

bot.on("message", async ctx => {
  ensureUser(ctx.from);

  if (isGroup(ctx)) {
    addMessageStat(ctx);

    if (await handleViolations(ctx)) {
      saveData();
      return;
    }

    const store =
      getGlobalMuteStore();

    if (
      store[String(ctx.from.id)] &&
      !(
        ctx.message?.text &&
        /^فك الكتم العام$/i.test(
          ctx.message.text.trim()
        )
      )
    ) {
      try {
        await deleteMessageSafe(ctx);
      } catch (_) {}
    }
  }

  saveData();
});

/* =========================================================
   RANK
========================================================= */

bot.hears(
  /^رتبتي$/i,
  async ctx => {
    ensureUser(ctx.from);

    await reply(
      ctx,
      `• رتبتك ↤︎ ${roleName(
        ctx.from.id,
        ctx.from.username
      )}`
    );
  }
);

bot.hears(
  /^تفاعلي$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    ensureStats(ctx);

    const chatId = String(ctx.chat.id);
    const userId = String(ctx.from.id);

    const users = Object.values(
      data.stats[chatId] || {}
    ).sort(
      (a, b) =>
        (b.messages || 0) -
        (a.messages || 0)
    );

    const index =
      users.findIndex(
        u => String(u.id) === userId
      );

    const count =
      data.stats[chatId]?.[userId]
        ?.messages || 0;

    await reply(
      ctx,
      `• رتبتك ↤︎ ${roleName(
        ctx.from.id,
        ctx.from.username
      )}
• عدد رسائل التفاعل ↤︎ ${count}
• ترتيبك بين المتفاعلين ↤︎ ${
        index === -1 ? 0 : index + 1
      }`
    );
  }
);

bot.hears(
  /^المتفاعلين$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    const chatId = String(ctx.chat.id);

    const users = Object.values(
      data.stats[chatId] || {}
    )
      .sort(
        (a, b) =>
          (b.messages || 0) -
          (a.messages || 0)
      )
      .slice(0, 20);

    if (!users.length) {
      return reply(
        ctx,
        "• لا يوجد متفاعلين"
      );
    }

    const lines = users.map(
      (u, i) =>
        `${i + 1}. ${mention({
          id: u.id,
          first_name: u.firstName,
          username: u.username
        })} ↤︎ ${u.messages || 0}`
    );

    await reply(
      ctx,
      `• المتفاعلين:\n\n${lines.join("\n")}`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }
);

/* =========================================================
   RANK MANAGEMENT
========================================================= */

async function promoteCommand(
  ctx,
  newRole
) {
  if (!isGroup(ctx)) return;

  if (
    !(await requireLevel(
      ctx,
      ROLES["مالك"]
    ))
  ) {
    return;
  }

  const target =
    await resolveTarget(ctx);

  if (!target?.id) {
    return reply(
      ctx,
      "• رد على الشخص أو منشنه"
    );
  }

  if (!canActOn(ctx, target)) {
    return reply(
      ctx,
      "• لا يمكن رفع رتبه نفس رتبتك ولا اعلى من رتبتك"
    );
  }

  ensureUser(target);

  data.roles[String(target.id)] = {
    role: newRole,
    username: target.username || "",
    firstName:
      target.first_name || "مستخدم"
  };

  saveData();

  await reply(
    ctx,
    `• المستخدم ذا ↤︎「${mention(target)}」
• تم رفعه الرتبه`
  );
}

bot.hears(
  /^رفع مميز$/i,
  ctx => promoteCommand(ctx, "مميز")
);

bot.hears(
  /^رفع مالك$/i,
  ctx => promoteCommand(ctx, "مالك")
);

bot.hears(
  /^رفع مالك أساسي$/i,
  ctx =>
    promoteCommand(
      ctx,
      "مالك أساسي"
    )
);

bot.hears(
  /^رفع myth$/i,
  ctx => promoteCommand(ctx, "Myth")
);

bot.hears(
  /^رفع myth 🎖️$/i,
  ctx =>
    promoteCommand(
      ctx,
      "Myth 🎖️"
    )
);

bot.hears(
  /^رفع dev²$/i,
  ctx =>
    promoteCommand(
      ctx,
      "Dev²🎖️"
    )
);

bot.hears(
  /^رفع Dev²$/i,
  ctx =>
    promoteCommand(
      ctx,
      "Dev²🎖️"
    )
);

bot.hears(
  /^تنزيل$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["مالك"]
      ))
    ) {
      return;
    }

    const target =
      await resolveTarget(ctx);

    if (!target?.id) {
      return reply(
        ctx,
        "• رد على الشخص أو منشنه"
      );
    }

    if (!canActOn(ctx, target)) {
      return reply(
        ctx,
        "• لا يمكن تنزيل رتبه نفس رتبتك ولا اعلى من رتبتك"
      );
    }

    ensureUser(target);

    data.roles[String(target.id)].role =
      "عضو";

    saveData();

    await reply(
      ctx,
      `• المستخدم ذا ↤︎「${mention(target)}」
• تم تنزيل رتبته`
    );
  }
);

/* =========================================================
   TELEGRAM ADMIN PROMOTION
========================================================= */

bot.hears(
  /^رفع مشرف$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["مالك"]
      ))
    ) {
      return;
    }

    if (!(await botIsAdmin(ctx))) {
      return reply(
        ctx,
        "• البوت ليس مشرف في القروب"
      );
    }

    const target =
      await resolveTarget(ctx);

    if (!target?.id) {
      return reply(
        ctx,
        "• رد على الشخص أو منشنه"
      );
    }

    if (!canActOn(ctx, target)) {
      return reply(
        ctx,
        "• لا يمكن رفع مشرف على نفس رتبتك أو أعلى"
      );
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
        `• المستخدم ذا ↤︎「${mention(target)}」
• تم رفعه مشرف`
      );
    } catch (_) {
      await reply(
        ctx,
        "• تعذر رفعه مشرف"
      );
    }
  }
);

bot.hears(
  /^تنزيل مشرف$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["مالك"]
      ))
    ) {
      return;
    }

    const target =
      await resolveTarget(ctx);

    if (!target?.id) {
      return reply(
        ctx,
        "• رد على الشخص أو منشنه"
      );
    }

    if (!canActOn(ctx, target)) {
      return reply(
        ctx,
        "• لا يمكن تنزيل مشرف بنفس رتبتك أو أعلى"
      );
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
        `• المستخدم ذا ↤︎「${mention(target)}」
• تم تنزيله من الإشراف`
      );
    } catch (_) {
      await reply(
        ctx,
        "• تعذر تنزيله من الإشراف"
      );
    }
  }
);

/* =========================================================
   MUTE
========================================================= */

bot.hears(
  /^كتم$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["مالك"]
      ))
    ) {
      return;
    }

    const target =
      await resolveTarget(ctx);

    if (!target?.id) {
      return reply(
        ctx,
        "• رد على الشخص أو منشنه"
      );
    }

    if (!canActOn(ctx, target)) {
      return reply(
        ctx,
        "• لا يمكن كتم نفس رتبتك أو رتبه أعلى"
      );
    }

    try {
      await restrictUser(
        ctx,
        target.id
      );

      saveUserInMuteStore(
        getMuteStore(ctx.chat.id),
        target
      );

      saveData();

      await reply(
        ctx,
        `• المستخدم ذا ↤︎「${mention(target)}」
• كتمته`
      );
    } catch (_) {
      await reply(
        ctx,
        "• تعذر كتم المستخدم"
      );
    }
  }
);

bot.hears(
  /^فك الكتم$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["مالك"]
      ))
    ) {
      return;
    }

    const target =
      await resolveTarget(ctx);

    if (!target?.id) {
      return reply(
        ctx,
        "• رد على الشخص أو منشنه"
      );
    }

    try {
      await unrestrictUser(
        ctx,
        target.id
      );

      deleteFromMuteStore(
        getMuteStore(ctx.chat.id),
        target.id
      );

      saveData();

      await reply(
        ctx,
        `• المستخدم ذا ↤︎「${mention(target)}」
• فكيت كتمه`
      );
    } catch (_) {
      await reply(
        ctx,
        "• تعذر فك الكتم"
      );
    }
  }
);

/* =========================================================
   BAN
========================================================= */

bot.hears(
  /^حظر$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["مالك"]
      ))
    ) {
      return;
    }

    const target =
      await resolveTarget(ctx);

    if (!target?.id) {
      return reply(
        ctx,
        "• رد على الشخص أو منشنه"
      );
    }

    if (!canActOn(ctx, target)) {
      return reply(
        ctx,
        "• لا يمكن حظر نفس رتبتك أو رتبه أعلى"
      );
    }

    try {
      await banUser(
        ctx,
        target.id
      );

      await reply(
        ctx,
        `• المستخدم ذا ↤︎「${mention(target)}」
• حظرته`
      );
    } catch (_) {
      await reply(
        ctx,
        "• تعذر حظر المستخدم"
      );
    }
  }
);

/* =========================================================
   UNBAN
========================================================= */

bot.hears(
  /^فك الحظر$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["مالك"]
      ))
    ) {
      return;
    }

    const target =
      await resolveTarget(ctx);

    if (!target?.id) {
      return reply(
        ctx,
        "• رد على الشخص أو منشنه"
      );
    }

    try {
      await unbanUser(
        ctx,
        target.id
      );

      await reply(
        ctx,
        `• المستخدم ذا ↤︎「${mention(target)}」
• فكيت حظره`
      );
    } catch (_) {
      await reply(
        ctx,
        "• تعذر فك الحظر"
      );
    }
  }
);

/* =========================================================
   KICK
========================================================= */

bot.hears(
  /^طرد$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["مالك"]
      ))
    ) {
      return;
    }

    const target =
      await resolveTarget(ctx);

    if (!target?.id) {
      return reply(
        ctx,
        "• رد على الشخص أو منشنه"
      );
    }

    if (!canActOn(ctx, target)) {
      return reply(
        ctx,
        "• لا يمكن طرد نفس رتبتك أو رتبه أعلى"
      );
    }

    try {
      await kickUser(
        ctx,
        target.id
      );

      await reply(
        ctx,
        `• المستخدم ذا ↤︎「${mention(target)}」
• طردته`
      );
    } catch (_) {
      await reply(
        ctx,
        "• تعذر طرد المستخدم"
      );
    }
  }
);

/* =========================================================
   RESTRICT
========================================================= */

bot.hears(
  /^تقييد$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["مالك"]
      ))
    ) {
      return;
    }

    const target =
      await resolveTarget(ctx);

    if (!target?.id) {
      return reply(
        ctx,
        "• رد على الشخص أو منشنه"
      );
    }

    if (!canActOn(ctx, target)) {
      return reply(
        ctx,
        "• لا يمكن تقييد نفس رتبتك أو رتبه أعلى"
      );
    }

    try {
      await restrictUser(
        ctx,
        target.id
      );

      await reply(
        ctx,
        `• المستخدم ذا ↤︎「${mention(target)}」
• قيدته`
      );
    } catch (_) {
      await reply(
        ctx,
        "• تعذر تقييد المستخدم"
      );
    }
  }
);

bot.hears(
  /^فك التقييد$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["مالك"]
      ))
    ) {
      return;
    }

    const target =
      await resolveTarget(ctx);

    if (!target?.id) {
      return reply(
        ctx,
        "• رد على الشخص أو منشنه"
      );
    }

    try {
      await unrestrictUser(
        ctx,
        target.id
      );

      await reply(
        ctx,
        `• المستخدم ذا ↤︎「${mention(target)}」
• فكيت تقييده`
      );
    } catch (_) {
      await reply(
        ctx,
        "• تعذر فك التقييد"
      );
    }
  }
);

/* =========================================================
   GLOBAL MUTE
========================================================= */

bot.hears(
  /^كتم عام$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["مالك"]
      ))
    ) {
      return;
    }

    const target =
      await resolveTarget(ctx);

    if (!target?.id) {
      return reply(
        ctx,
        "• رد على الشخص أو منشنه"
      );
    }

    if (!canActOn(ctx, target)) {
      return reply(
        ctx,
        "• لا يمكن كتم نفس رتبتك أو رتبه أعلى"
      );
    }

    try {
      await restrictUser(
        ctx,
        target.id
      );

      saveUserInMuteStore(
        getGlobalMuteStore(),
        target
      );

      saveData();

      await reply(
        ctx,
        `• المستخدم ذا ↤︎「${mention(target)}」
• كتمته كتم عام`
      );
    } catch (_) {
      await reply(
        ctx,
        "• تعذر تنفيذ الكتم العام"
      );
    }
  }
);

bot.hears(
  /^فك الكتم العام$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["مالك"]
      ))
    ) {
      return;
    }

    const target =
      await resolveTarget(ctx);

    if (!target?.id) {
      return reply(
        ctx,
        "• رد على الشخص أو منشنه"
      );
    }

    try {
      await unrestrictUser(
        ctx,
        target.id
      );

      deleteFromMuteStore(
        getGlobalMuteStore(),
        target.id
      );

      saveData();

      await reply(
        ctx,
        `• المستخدم ذا ↤︎「${mention(target)}」
• فكيت الكتم العام عنه`
      );
    } catch (_) {
      await reply(
        ctx,
        "• تعذر فك الكتم العام"
      );
    }
  }
);

/* =========================================================
   MUTED LIST
========================================================= */

bot.hears(
  /^مم$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    const users = Object.values(
      getMuteStore(ctx.chat.id)
    );

    if (!users.length) {
      return reply(
        ctx,
        "• لا يوجد مكتومين"
      );
    }

    const lines = users.map(
      (u, i) =>
        `${i + 1}. ${mention({
          id: u.id,
          first_name: u.firstName,
          username: u.username
        })}`
    );

    await reply(
      ctx,
      `• المكتومين:\n\n${lines.join("\n")}`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }
);

/* =========================================================
   GLOBAL MUTED LIST
========================================================= */

bot.hears(
  /^خخ$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    const users = Object.values(
      getGlobalMuteStore()
    );

    if (!users.length) {
      return reply(
        ctx,
        "• لا يوجد مكتومين عام"
      );
    }

    const lines = users.map(
      (u, i) =>
        `${i + 1}. ${mention({
          id: u.id,
          first_name: u.firstName,
          username: u.username
        })}`
    );

    await reply(
      ctx,
      `• المكتومين عام:\n\n${lines.join("\n")}`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }
);

/* =========================================================
   VIOLATIONS
========================================================= */

bot.hears(
  /^فتح المخالفات$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["Myth"]
      ))
    ) {
      return;
    }

    const chat = ensureChat(ctx);
    chat.violations = true;

    saveData();

    await reply(
      ctx,
      "• تم فتح المخالفات"
    );
  }
);

bot.hears(
  /^غلق المخالفات$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["Myth"]
      ))
    ) {
      return;
    }

    const chat = ensureChat(ctx);
    chat.violations = false;

    saveData();

    await reply(
      ctx,
      "• تم غلق المخالفات"
    );
  }
);

/* =========================================================
   CLEANING
========================================================= */

async function cleanMessages(
  ctx,
  predicate,
  title
) {
  if (!isGroup(ctx)) return;

  if (
    !(await requireLevel(
      ctx,
      ROLES["Myth"]
    ))
  ) {
    return;
  }

  if (!(await botIsAdmin(ctx))) {
    return reply(
      ctx,
      "• البوت يحتاج صلاحية حذف الرسائل"
    );
  }

  const messageId =
    ctx.message.message_id;

  await reply(
    ctx,
    "• انتظر ابحث لك عن الرسائل المعدله"
  );

  let deleted = 0;

  for (
    let i = 1;
    i <= 200;
    i++
  ) {
    const id =
      messageId - i;

    if (id <= 0) break;

    try {
      const fakeCtx = {
        chat: ctx.chat,
        message: {
          message_id: id
        }
      };

      if (await predicate(fakeCtx)) {
        await ctx.telegram.deleteMessage(
          ctx.chat.id,
          id
        );

        deleted++;
      }
    } catch (_) {}
  }

  if (!deleted) {
    await reply(
      ctx,
      `• ${title}\n• لا يوجد ${title} في القروب`
    );
    return;
  }

  await reply(
    ctx,
    `• ${title}\n• مسحت ( ${deleted} ) من الرسائل`
  );
}

async function inspectMessage(
  ctx,
  messageId
) {
  try {
    const chatId = ctx.chat.id;

    const result =
      await ctx.telegram.forwardMessage(
        ctx.from.id,
        chatId,
        messageId
      );

    if (!result) return null;

    return result;
  } catch (_) {
    return null;
  }
}

/*
  Telegram Bot API لا يوفر للبوت طريقة للحصول على
  الرسائل القديمة بمجرد رقم الرسالة، لذلك التنظيف الحقيقي
  يعتمد على الرسائل التي يستطيع البوت التعامل معها.
*/

bot.hears(
  /^تنظيف$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["Myth"]
      ))
    ) {
      return;
    }

    await reply(
      ctx,
      "• التنظيف بالأرقام:\n\n1 - صور\n2 - فيديوهات\n3 - صوتيات\n4 - فويسات\n5 - قيفات\n6 - ملصقات\n7 - وسائط\n8 - رسائل البوت\n9 - رسائل معدله"
    );
  }
);

/* =========================================================
   PIN / UNPIN
========================================================= */

bot.hears(
  /^تثبيت$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["Myth"]
      ))
    ) {
      return;
    }

    const target =
      ctx.message?.reply_to_message;

    if (!target) {
      return reply(
        ctx,
        "• رد على الرسالة المراد تثبيتها"
      );
    }

    try {
      await ctx.telegram.pinChatMessage(
        ctx.chat.id,
        target.message_id,
        {
          disable_notification: false
        }
      );

      await reply(
        ctx,
        "• تم تثبيت الرسالة"
      );
    } catch (_) {
      await reply(
        ctx,
        "• تعذر تثبيت الرسالة"
      );
    }
  }
);

bot.hears(
  /^الغاء التثبيت$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["Myth"]
      ))
    ) {
      return;
    }

    try {
      await ctx.telegram.unpinChatMessage(
        ctx.chat.id
      );

      await reply(
        ctx,
        "• تم الغاء تثبيت الرسالة"
      );
    } catch (_) {
      await reply(
        ctx,
        "• تعذر الغاء التثبيت"
      );
    }
  }
);

/* =========================================================
   DELETE
========================================================= */

bot.hears(
  /^حذف$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["Myth"]
      ))
    ) {
      return;
    }

    const target =
      ctx.message?.reply_to_message;

    if (!target) {
      return reply(
        ctx,
        "• رد على الرسالة المراد حذفها"
      );
    }

    try {
      await ctx.telegram.deleteMessage(
        ctx.chat.id,
        target.message_id
      );

      await reply(
        ctx,
        "• تم حذف الرسالة"
      );
    } catch (_) {
      await reply(
        ctx,
        "• تعذر حذف الرسالة"
      );
    }
  }
);

/* =========================================================
   WHISPERS
========================================================= */

function createWhisperId() {
  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2, 8)
  );
}

function saveWhisper(whisper) {
  data.whispers[whisper.id] =
    whisper;

  saveData();
}

async function sendWhisper(
  ctx,
  target,
  sourceMessage
) {
  if (!target?.id) {
    return reply(
      ctx,
      "• رد على الشخص أو منشنه"
    );
  }

  const id = createWhisperId();

  let whisper = {
    id,
    from: {
      id: ctx.from.id,
      username:
        ctx.from.username || "",
      firstName:
        ctx.from.first_name || "مستخدم"
    },
    to: {
      id: target.id,
      username:
        target.username || "",
      firstName:
        target.first_name || "مستخدم"
    },
    chatId: ctx.chat.id,
    type: "text",
    text: "",
    createdAt: Date.now()
  };

  if (sourceMessage?.text) {
    whisper.type = "text";
    whisper.text =
      sourceMessage.text;
  } else if (sourceMessage?.photo) {
    whisper.type = "photo";
    whisper.fileId =
      sourceMessage.photo[
        sourceMessage.photo.length - 1
      ].file_id;
    whisper.caption =
      sourceMessage.caption || "";
  } else if (sourceMessage?.animation) {
    whisper.type = "animation";
    whisper.fileId =
      sourceMessage.animation.file_id;
    whisper.caption =
      sourceMessage.caption || "";
  } else if (sourceMessage?.sticker) {
    whisper.type = "sticker";
    whisper.fileId =
      sourceMessage.sticker.file_id;
  } else {
    return reply(
      ctx,
      "• نوع الرسالة غير مدعوم للهمسة"
    );
  }

  saveWhisper(whisper);

  const link =
    `https://t.me/${ctx.botInfo.username}?start=whisper_${id}`;

  try {
    await ctx.telegram.sendMessage(
      ctx.chat.id,
      `• وصلت همسه لـ ${mention(target)}`,
      {
        parse_mode: "MarkdownV2",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "رؤية الهمسه",
                url: link
              },
              {
                text: "رد على الهمسه",
                url:
                  `https://t.me/${ctx.botInfo.username}?start=reply_${id}`
              }
            ]
          ]
        }
      }
    );

    await reply(
      ctx,
      "• تم إرسال الهمسه"
    );
  } catch (_) {
    await reply(
      ctx,
      "• تعذر إرسال الهمسه"
    );
  }
}

bot.hears(
  /^همسه$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    const target =
      await resolveTarget(ctx);

    if (!target?.id) {
      return reply(
        ctx,
        "• رد على الشخص الذي تريد إرسال الهمسه له"
      );
    }

    if (
      !ctx.message?.reply_to_message
    ) {
      return reply(
        ctx,
        "• رد على الرسالة التي تريد إرسالها كهمسه"
      );
    }

    await sendWhisper(
      ctx,
      target,
      ctx.message.reply_to_message
    );
  }
);

bot.action(
  /^see_whisper_(.+)$/,
  async ctx => {
    const id = ctx.match[1];
    const whisper =
      data.whispers[id];

    if (!whisper) {
      return ctx.answerCbQuery(
        "الهمسه غير موجوده",
        { show_alert: true }
      );
    }

    if (
      String(ctx.from.id) !==
      String(whisper.to.id)
    ) {
      return ctx.answerCbQuery(
        "هذه الهمسه ليست لك",
        { show_alert: true }
      );
    }

    try {
      if (whisper.type === "text") {
        await ctx.reply(
          `• الهمسه:\n\n${whisper.text}`
        );
      } else if (
        whisper.type === "photo"
      ) {
        await ctx.replyWithPhoto(
          whisper.fileId,
          {
            caption:
              whisper.caption || ""
          }
        );
      } else if (
        whisper.type === "animation"
      ) {
        await ctx.replyWithAnimation(
          whisper.fileId,
          {
            caption:
              whisper.caption || ""
          }
        );
      } else if (
        whisper.type === "sticker"
      ) {
        await ctx.replyWithSticker(
          whisper.fileId
        );
      }

      await ctx.answerCbQuery();
    } catch (_) {
      await ctx.answerCbQuery(
        "تعذر عرض الهمسه",
        { show_alert: true }
      );
    }
  }
);

bot.action(
  /^reply_whisper_(.+)$/,
  async ctx => {
    const id = ctx.match[1];
    const whisper =
      data.whispers[id];

    if (!whisper) {
      return ctx.answerCbQuery(
        "الهمسه غير موجوده",
        { show_alert: true }
      );
    }

    if (
      String(ctx.from.id) !==
      String(whisper.to.id)
    ) {
      return ctx.answerCbQuery(
        "هذه الهمسه ليست لك",
        { show_alert: true }
      );
    }

    data.pendingReplies[
      String(ctx.from.id)
    ] = id;

    saveData();

    await ctx.answerCbQuery();

    await ctx.reply(
      "• ارسل ردك الآن، وسيتم إرساله لصاحب الهمسه"
    );
  }
);

/* =========================================================
   ADD CUSTOM COMMAND
========================================================= */

bot.hears(
  /^اضف امر$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["Myth"]
      ))
    ) {
      return;
    }

    data.pendingWhispers[
      String(ctx.from.id)
    ] = {
      type: "command",
      chatId: ctx.chat.id
    };

    saveData();

    await reply(
      ctx,
      "• ارسل الأمر والرد بهذا الشكل:\n\nالأمر = الرد"
    );
  }
);

/* =========================================================
   ADD CUSTOM REPLY
========================================================= */

bot.hears(
  /^اضف رد$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["Myth"]
      ))
    ) {
      return;
    }

    data.pendingWhispers[
      String(ctx.from.id)
    ] = {
      type: "reply",
      chatId: ctx.chat.id
    };

    saveData();

    await reply(
      ctx,
      "• ارسل الأمر والرد بهذا الشكل:\n\nالكلمة = الرد"
    );
  }
);

/* =========================================================
   CUSTOM COMMANDS / REPLIES
========================================================= */

bot.on("text", async ctx => {
  if (!isGroup(ctx)) return;

  const text =
    ctx.message.text.trim();

  const pending =
    data.pendingWhispers[
      String(ctx.from.id)
    ];

  if (
    pending &&
    pending.chatId === ctx.chat.id &&
    pending.type === "command"
  ) {
    const parts =
      text.split("=");

    if (parts.length >= 2) {
      const key =
        getCustomKey(parts[0]);

      const value =
        parts
          .slice(1)
          .join("=")
          .trim();

      if (key && value) {
        const chatId =
          String(ctx.chat.id);

        if (!data.customCommands[chatId]) {
          data.customCommands[chatId] = {};
        }

        data.customCommands[chatId][key] =
          value;

        delete data.pendingWhispers[
          String(ctx.from.id)
        ];

        saveData();

        await reply(
          ctx,
          "• تم إضافة الأمر والرد"
        );

        return;
      }
    }
  }

  if (
    pending &&
    pending.chatId === ctx.chat.id &&
    pending.type === "reply"
  ) {
    const parts =
      text.split("=");

    if (parts.length >= 2) {
      const key =
        getCustomKey(parts[0]);

      const value =
        parts
          .slice(1)
          .join("=")
          .trim();

      if (key && value) {
        const chatId =
          String(ctx.chat.id);

        if (!data.customReplies[chatId]) {
          data.customReplies[chatId] = {};
        }

        data.customReplies[chatId][key] =
          value;

        delete data.pendingWhispers[
          String(ctx.from.id)
        ];

        saveData();

        await reply(
          ctx,
          "• تم إضافة الرد"
        );

        return;
      }
    }
  }

  const pendingReplyId =
    data.pendingReplies[
      String(ctx.from.id)
    ];

  if (pendingReplyId) {
    const whisper =
      data.whispers[pendingReplyId];

    if (whisper) {
      try {
        await ctx.telegram.sendMessage(
          whisper.from.id,
          `• وصلك رد على الهمسه:\n\n${text}`
        );

        await reply(
          ctx,
          "• تم إرسال ردك"
        );
      } catch (_) {
        await reply(
          ctx,
          "• تعذر إرسال الرد"
        );
      }
    }

    delete data.pendingReplies[
      String(ctx.from.id)
    ];

    saveData();

    return;
  }

  const chatId =
    String(ctx.chat.id);

  const customCommand =
    data.customCommands[chatId]?.[
      getCustomKey(text)
    ];

  if (customCommand) {
    await reply(
      ctx,
      customCommand
    );

    return;
  }

  const customReply =
    data.customReplies[chatId]?.[
      getCustomKey(text)
    ];

  if (customReply) {
    await reply(
      ctx,
      customReply
    );
  }
});

/* =========================================================
   OWNER
========================================================= */

bot.hears(
  /^المالك$/i,
  async ctx => {
    await reply(
      ctx,
      `• مالك البوت ↤︎ ${mention({
        id: 0,
        first_name: "j4xa7"
      })}`,
      {
        parse_mode: "MarkdownV2"
      }
    );
  }
);

/* =========================================================
   BOT INFO
========================================================= */

bot.command(
  "id",
  async ctx => {
    await reply(
      ctx,
      `• ايديك ↤︎ ${ctx.from.id}`
    );
  }
);

bot.command(
  "chatid",
  async ctx => {
    if (!ctx.chat) return;

    await reply(
      ctx,
      `• ايدي القروب ↤︎ ${ctx.chat.id}`
    );
  }
);

/* =========================================================
   ADMIN COMMANDS
========================================================= */

bot.hears(
  /^عدد الاعضاء$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["Dev²🎖️"]
      ))
    ) {
      return;
    }

    try {
      const count =
        await ctx.telegram.getChatMemberCount(
          ctx.chat.id
        );

      await reply(
        ctx,
        `• عدد أعضاء القروب ↤︎ ${count}`
      );
    } catch (_) {
      await reply(
        ctx,
        "• تعذر معرفة عدد الأعضاء"
      );
    }
  }
);

bot.hears(
  /^البوت$/i,
  async ctx => {
    await reply(
      ctx,
      `• رتبتك ↤︎ ${roleName(
        ctx.from.id,
        ctx.from.username
      )}
• البوت يعمل بنجاح`
    );
  }
);

/* =========================================================
   SETTINGS
========================================================= */

bot.hears(
  /^البوت يرد$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["Myth"]
      ))
    ) {
      return;
    }

    ensureChat(ctx).botReplies =
      true;

    saveData();

    await reply(
      ctx,
      "• تم تشغيل ردود البوت"
    );
  }
);

bot.hears(
  /^البوت ما يرد$/i,
  async ctx => {
    if (!isGroup(ctx)) return;

    if (
      !(await requireLevel(
        ctx,
        ROLES["Myth"]
      ))
    ) {
      return;
    }

    ensureChat(ctx).botReplies =
      false;

    saveData();

    await reply(
      ctx,
      "• تم إيقاف ردود البوت"
    );
  }
);

/* =========================================================
   ERROR HANDLING
========================================================= */

bot.catch((err, ctx) => {
  console.error(
    "BOT ERROR:",
    err
  );

  try {
    if (ctx?.chat) {
      ctx.reply(
        "• حدث خطأ بسيط، حاول مرة ثانية"
      ).catch(() => {});
    }
  } catch (_) {}
});

/* =========================================================
   LAUNCH
========================================================= */

bot.launch()
  .then(() => {
    console.log(
      "Bot started successfully"
    );
  })
  .catch(err => {
    console.error(
      "Failed to start bot:",
      err
    );
  });

process.once(
  "SIGINT",
  () => bot.stop("SIGINT")
);

process.once(
  "SIGTERM",
  () => bot.stop("SIGTERM")
);
