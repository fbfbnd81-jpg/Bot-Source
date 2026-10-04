require("dotenv").config();

const {
  Telegraf,
  Markup
} = require("telegraf");

const fs = require("fs");
const path = require("path");

// ======================================================
// إيف — Eif
// نظام بوت تيليجرام من الصفر
// ======================================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const DEVELOPER_ID = String(process.env.DEVELOPER_ID || "");

if (!BOT_TOKEN) {
  throw new Error("ضع BOT_TOKEN داخل ملف .env");
}

if (!DEVELOPER_ID) {
  throw new Error("ضع DEVELOPER_ID داخل ملف .env");
}

const bot = new Telegraf(BOT_TOKEN);

const DATA_FILE = path.join(__dirname, "data.json");

// ======================================================
// قاعدة البيانات
// ======================================================

const defaultDatabase = {
  groups: {},
  users: {},
  global: {
    muted: {},
    banned: {}
  }
};

function loadDatabase() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(defaultDatabase, null, 2)
      );

      return JSON.parse(
        JSON.stringify(defaultDatabase)
      );
    }

    return JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );
  } catch (error) {
    console.error("Database error:", error);

    return JSON.parse(
      JSON.stringify(defaultDatabase)
    );
  }
}

let db = loadDatabase();

let saveTimer = null;

function saveDatabase() {
  clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(db, null, 2)
    );
  }, 150);
}

// ======================================================
// الرتب
// ======================================================

const RANKS = {
  "عضو": 0,
  "مميز": 1,
  "مدير": 2,
  "مالك": 3,
  "مالك اساسي": 4,
  "Myth": 5,
  "Myth🎖": 6,
  "Dev": 7,
  "Dev²": 8,
  "Dev🎖️": 9
};

function rankLevel(rank) {
  return RANKS[rank] ?? 0;
}

function getRank(group, userId) {

  if (
    String(userId) ===
    String(DEVELOPER_ID)
  ) {
    return "Dev🎖️";
  }

  return (
    group.ranks[String(userId)] ||
    "عضو"
  );
}

function hasRank(
  group,
  userId,
  required
) {
  return (
    rankLevel(
      getRank(group, userId)
    ) >=
    rankLevel(required)
  );
}

// ======================================================
// بيانات القروب
// ======================================================

function createGroup(chat) {

  return {
    id: String(chat.id),

    title:
      chat.title ||
      "بدون اسم",

    owners: [],

    ranks: {},

    muted: {},
    banned: {},
    restricted: {},

    warnings: {},

    interaction: {},
    xp: {},

    badges: {},

    customReplies: {},
    customCommands: {},

    whispers: {},

    settings: {

      protection: false,

      strictProtection: false,

      welcome: false,

      farewell: false,

      bank: true,

      games: true,

      events: true,

      whispers: true,

      stickers: true,

      links: true,

      forwards: true,

      longMessages: true,

      mentions: true,

      files: true,

      photos: true
    },

    welcomeText:
      "أهلًا {name}، نورت القروب.",

    farewellText:
      "مع السلامة {name}.",

    bank: {},

    marriages: {},

    events: {},

    backups: [],

    lockedCommands: {},

    pending: {}
  };
}

function getGroup(ctx) {

  if (!ctx.chat) {
    return null;
  }

  const id =
    String(ctx.chat.id);

  if (!db.groups[id]) {

    db.groups[id] =
      createGroup(ctx.chat);

    saveDatabase();
  }

  return db.groups[id];
}

// ======================================================
// المستخدم
// ======================================================

function getUser(user) {

  const id =
    String(user.id);

  if (!db.users[id]) {

    db.users[id] = {

      id,

      username:
        user.username || "",

      firstName:
        user.first_name || "",

      lastName:
        user.last_name || "",

      messages: 0,

      commands: 0,

      createdAt:
        Date.now()
    };
  }

  db.users[id].username =
    user.username || "";

  db.users[id].firstName =
    user.first_name || "";

  db.users[id].lastName =
    user.last_name || "";

  return db.users[id];
}

// ======================================================
// تنسيق رسائل إيف
// ======================================================

function header(title = "إيف") {

  return `୨୧ ─── ${title} ─── ୨୧`;
}

function footer() {

  return "୨୧ ───────────────── ୨୧";
}

function eveMessage(
  title,
  lines = []
) {

  return [

    header(title),

    "",

    ...lines,

    "",

    footer()

  ].join("\n");
}

// ======================================================
// أسماء المستخدمين
// ======================================================

function displayName(user) {

  return [
    user.first_name,
    user.last_name
  ]
    .filter(Boolean)
    .join(" ") ||
    "بدون اسم";
}

// ======================================================
// المستخدم المستهدف بالرد
// ======================================================

function getTarget(ctx) {

  if (
    !ctx.message ||
    !ctx.message.reply_to_message
  ) {
    return null;
  }

  return (
    ctx.message.reply_to_message.from ||
    null
  );
}

// ======================================================
// رفض الصلاحية
// ======================================================

async function permissionDenied(
  ctx,
  required
) {

  await ctx.reply(
    eveMessage("إيف", [

      "⌗ رتبتك ما تسمح لك بالأمر",

      `〃 المطلوب 〃 ${required}`

    ])
  );
}

// ======================================================
// التأكد أن الرسالة داخل قروب
// ======================================================

function isGroup(ctx) {

  return (
    ctx.chat &&
    (
      ctx.chat.type === "group" ||
      ctx.chat.type === "supergroup"
    )
  );
}

// ======================================================
// START
// ======================================================

bot.start(async ctx => {

  await ctx.reply(

    eveMessage("إيف", [

      "⌗ أهلًا بك في إيف",

      "〃 البوت جاهز للعمل"

    ])

  );
});

// ======================================================
// دخول البوت إلى قروب
// ======================================================

bot.on(
  "my_chat_member",
  async ctx => {

    const update =
      ctx.myChatMember;

    if (
      update.chat.type !==
        "group" &&
      update.chat.type !==
        "supergroup"
    ) {
      return;
    }

    const newStatus =
      update.new_chat_member.status;

    const oldStatus =
      update.old_chat_member.status;

    const added =
      (
        newStatus === "member" ||
        newStatus === "administrator"
      ) &&
      (
        oldStatus === "left" ||
        oldStatus === "kicked"
      );

    const removed =
      (
        newStatus === "left" ||
        newStatus === "kicked"
      );

    const group =
      getGroup(ctx);

    // --------------------------------------------------
    // تمت إضافة إيف
    // --------------------------------------------------

    if (added) {

      let inviteLink =
        "غير متاح";

      try {

        const invite =
          await ctx.telegram
            .createChatInviteLink(
              update.chat.id,
              {
                name: "إيف"
              }
            );

        inviteLink =
          invite.invite_link;

      } catch {}

      const owner =
        update.from;

      await ctx.telegram
        .sendMessage(

          DEVELOPER_ID,

          eveMessage("إيف", [

            "⌗ تم إضافة البوت إلى قروب جديد",

            `〃 القروب 〃 ${
              update.chat.title ||
              "بدون اسم"
            }`,

            `〃 الآيدي 〃 ${
              update.chat.id
            }`,

            `〃 المضاف بواسطة 〃 ${
              displayName(owner)
            }`,

            `〃 المستخدم 〃 ${
              owner.username
                ? "@" + owner.username
                : "لا يوجد"
            }`,

            `〃 الرابط 〃 ${
              inviteLink
            }`

          ])

        )
        .catch(() => {});
    }

    // --------------------------------------------------
    // خرجت إيف
    // --------------------------------------------------

    if (removed) {

      await ctx.telegram
        .sendMessage(

          DEVELOPER_ID,

          eveMessage("إيف", [

            "⌗ تم إخراج إيف من قروب",

            `〃 القروب 〃 ${
              group.title
            }`,

            `〃 الآيدي 〃 ${
              group.id
            }`

          ])

        )
        .catch(() => {});
    }
  }
);

// ======================================================
// دخول أعضاء
// ======================================================

bot.on(
  "new_chat_members",
  async ctx => {

    const group =
      getGroup(ctx);

    if (
      !group.settings.welcome
    ) {
      return;
    }

    for (
      const member
      of ctx.message.new_chat_members
    ) {

      const text =
        group.welcomeText

          .replaceAll(
            "{name}",
            member.first_name ||
              ""
          )

          .replaceAll(
            "{username}",
            member.username
              ? "@" +
                member.username
              : ""
          );

      await ctx.reply(text);
    }
  }
);

// ======================================================
// خروج أعضاء
// ======================================================

bot.on(
  "left_chat_member",
  async ctx => {

    const group =
      getGroup(ctx);

    if (
      !group.settings.farewell
    ) {
      return;
    }

    const member =
      ctx.message
        .left_chat_member;

    const text =
      group.farewellText

        .replaceAll(
          "{name}",
          member.first_name ||
            ""
        )

        .replaceAll(
          "{username}",
          member.username
            ? "@" +
              member.username
            : ""
        );

    await ctx.reply(text);
  }
);

// ======================================================
// الرسائل المعدلة
// ======================================================

bot.on(
  "edited_message",
  async ctx => {

    if (!isGroup(ctx)) {
      return;
    }

    const group =
      getGroup(ctx);

    const rank =
      getRank(
        group,
        ctx.from.id
      );

    if (
      rankLevel(rank) >=
      rankLevel("مميز")
    ) {
      return;
    }

    if (
      group.settings.protection
    ) {

      await ctx
        .deleteMessage()
        .catch(() => {});
    }
  }
);

// ======================================================
// أوامر الرسائل
// ======================================================

bot.on(
  "text",
  async ctx => {

    if (!ctx.from) {
      return;
    }

    const text =
      ctx.message.text
        .trim();

    const user =
      getUser(ctx.from);

    user.messages++;

    if (
      text.startsWith("/")
    ) {
      user.commands++;
    }

    // --------------------------------------------------
    // الخاص
    // --------------------------------------------------

    if (!isGroup(ctx)) {

      if (
        text === "المطور"
      ) {

        let photo = null;

        try {

          const photos =
            await ctx.telegram
              .getUserProfilePhotos(
                Number(
                  DEVELOPER_ID
                ),
                0,
                1
              );

          if (
            photos.total_count
          ) {

            photo =
              photos.photos[0][0]
                .file_id;
          }

        } catch {}

        const developer =
          await ctx.telegram
            .getChat(
              Number(
                DEVELOPER_ID
              )
            )
            .catch(() => null);

        const username =
          developer?.username;

        const keyboard =
          username
            ? Markup.inlineKeyboard([
                [
                  Markup.button.url(
                    "الملف الشخصي",
                    `https://t.me/${username}`
                  )
                ]
              ])
            : undefined;

        const caption =
          eveMessage(
            "المطور",
            [

              `⌗ الاسم 〃 ${
                developer
                  ? displayName(
                      developer
                    )
                  : "المطور"
              }`,

              `⌗ المستخدم 〃 ${
                username
                  ? "@" +
                    username
                  : "غير متاح"
              }`,

              "",

              "〃 المطور الأساسي لإيف"

            ]
          );

        if (photo) {

          await ctx.replyWithPhoto(
            photo,
            {
              caption,
              has_spoiler: true,
              ...(
                keyboard || {}
              )
            }
          );

        } else {

          await ctx.reply(
            caption,
            keyboard
          );
        }

        return;
      }

      return;
    }

    // --------------------------------------------------
    // بيانات القروب
    // --------------------------------------------------

    const group =
      getGroup(ctx);

    const id =
      String(ctx.from.id);

    // --------------------------------------------------
    // تحديث بيانات المستخدم
    // --------------------------------------------------

    user.username =
      ctx.from.username ||
      "";

    user.firstName =
      ctx.from.first_name ||
      "";

    user.lastName =
      ctx.from.last_name ||
      "";

    // --------------------------------------------------
    // التفاعل
    // --------------------------------------------------

    group.interaction[id] =
      (
        group.interaction[id] ||
        0
      ) + 1;

    // --------------------------------------------------
    // الخبرة
    // --------------------------------------------------

    group.xp[id] =
      (
        group.xp[id] ||
        0
      ) + 1;

    saveDatabase();

    // ==================================================
    // الحظر العام
    // ==================================================

    if (
      db.global.banned[id]
    ) {

      await ctx
        .deleteMessage()
        .catch(() => {});

      return;
    }

    // ==================================================
    // الكتم العام
    // ==================================================

    if (
      db.global.muted[id]
    ) {

      await ctx
        .deleteMessage()
        .catch(() => {});

      return;
    }

    // ==================================================
    // كتم داخل القروب
    // ==================================================

    if (
      group.muted[id] &&
      !hasRank(
        group,
        ctx.from.id,
        "مدير"
      )
    ) {

      await ctx
        .deleteMessage()
        .catch(() => {});

      return;
    }

    // ==================================================
    // الردود المخصصة
    // ==================================================

    if (
      group.customReplies[text]
    ) {

      await ctx.reply(
        group.customReplies[text]
      );

      return;
    }

    // ==================================================
    // الألعاب
    // ==================================================

    if (
      text === "الألعاب"
    ) {

      await ctx.reply(

        eveMessage(
          "ألعاب إيف",
          [

            "⌗ ترتيب الصور",

            "⌗ ترتيب الكلمات",

            "⌗ الكلمة الناقصة",

            "⌗ الصورة المفقودة",

            "⌗ المختلف",

            "⌗ فك الرمز",

            "⌗ خمن الصورة",

            "⌗ خمن الصوت",

            "⌗ خمن الشخصية",

            "⌗ من الأسرع؟",

            "⌗ الذاكرة",

            "⌗ المتاهة",

            "⌗ صح أو خطأ",

            "⌗ أسئلة سريعة",

            "⌗ تحدي الحروف",

            "⌗ تركيب الكلمات",

            "⌗ عدّاد السرعة",

            "⌗ اكتشف الخطأ"

          ]
        )

      );

      return;
    }

    // ==================================================
    // الفعاليات
    // ==================================================

    if (
      text === "الفعاليات"
    ) {

      await ctx.reply(

        eveMessage(
          "فعاليات إيف",
          [

            "⌗ فعالية",

            "⌗ ابدأ فعالية",

            "⌗ إلغاء الفعالية",

            "⌗ الفعالية الحالية",

            "⌗ فعالية تفاعلية",

            "⌗ فعالية أسئلة",

            "⌗ فعالية سرعة",

            "⌗ فعالية حروف",

            "⌗ فعالية تخمين",

            "⌗ فعالية ترتيب",

            "⌗ متصدرين الفعاليات",

            "⌗ نقاط الفعاليات",

            "⌗ تصفير نقاط الفعاليات"

          ]
        )

      );

      return;
    }

    // ==================================================
    // الملف الشخصي
    // ==================================================

    if (
      text === "ملفي" ||
      text === "ملفه"
    ) {

      const target =
        getTarget(ctx) ||
        ctx.from;

      const targetId =
        String(target.id);

      const targetUser =
        getUser(target);

      const rank =
        getRank(
          group,
          target.id
        );

      const xp =
        group.xp[targetId] ||
        0;

      const level =
        Math.floor(
          xp / 100
        ) + 1;

      const interaction =
        group.interaction[
          targetId
        ] || 0;

      await ctx.reply(

        eveMessage(
          "ملف إيف",
          [

            `⌗ الاسم 〃 ${
              displayName(target)
            }`,

            `⌗ المستخدم 〃 ${
              target.username
                ? "@" +
                  target.username
                : "لا يوجد"
            }`,

            `⌗ الرتبة 〃 ${
              rank
            }`,

            `⌗ المستوى 〃 ${
              level
            }`,

            `⌗ التفاعل 〃 ${
              interaction
            }`,

            `⌗ الرسائل 〃 ${
              targetUser.messages
            }`

          ]
        )

      );

      return;
    }

    // ==================================================
    // رتبتي
    // ==================================================

    if (
      text === "رتبتي" ||
      text === "رتبته"
    ) {

      const target =
        getTarget(ctx) ||
        ctx.from;

      await ctx.reply(

        eveMessage(
          "إيف",
          [

            `⌗ المستخدم 〃 ${
              displayName(target)
            }`,

            `〃 الرتبة 〃 ${
              getRank(
                group,
                target.id
              )
            }`

          ]
        )

      );

      return;
    }

    // ==================================================
    // تفاعلي
    // ==================================================

    if (
      text === "تفاعلي" ||
      text === "تفاعله"
    ) {

      const target =
        getTarget(ctx) ||
        ctx.from;

      await ctx.reply(

        eveMessage(
          "إيف",
          [

            `⌗ المستخدم 〃 ${
              displayName(target)
            }`,

            `〃 التفاعل 〃 ${
              group.interaction[
                String(target.id)
              ] || 0
            }`

          ]
        )

      );

      return;
    }

    // ==================================================
    // إضافة / حذف تفاعل
    // ==================================================

    const interactionCommand =
      text.match(
        /^(اضف|حذف) تفاعل\s+(\d+)$/
      );

    if (
      interactionCommand
    ) {

      if (
        !hasRank(
          group,
          ctx.from.id,
          "مدير"
        )
      ) {

        await permissionDenied(
          ctx,
          "مدير"
        );

        return;
      }

      const target =
        getTarget(ctx);

      if (!target) {

        await ctx.reply(

          eveMessage(
            "إيف",
            [
              "⌗ استخدم الأمر بالرد على العضو"
            ]
          )

        );

        return;
      }

      const amount =
        Number(
          interactionCommand[2]
        );

      const targetId =
        String(target.id);

      const old =
        group.interaction[
          targetId
        ] || 0;

      if (
        interactionCommand[1] ===
        "اضف"
      ) {

        group.interaction[
          targetId
        ] =
          old + amount;

      } else {

        group.interaction[
          targetId
        ] =
          Math.max(
            0,
            old - amount
          );
      }

      saveDatabase();

      await ctx.reply(

        eveMessage(
          "إيف",
          [

            `⌗ المستخدم 〃 ${
              displayName(target)
            }`,

            `〃 ${
              interactionCommand[1] ===
              "اضف"
                ? "تمت إضافة"
                : "تم حذف"
            } ${amount} تفاعل`

          ]
        )

      );

      return;
    }

    // ==================================================
    // المالك
    // ==================================================

    if (
      text === "المالك"
    ) {

      const ownerId =
        group.owners[0];

      if (!ownerId) {

        await ctx.reply(

          eveMessage(
            "إيف",
            [
              "⌗ لم يتم تحديد مالك للقروب"
            ]
          )

        );

        return;
      }

      try {

        const member =
          await ctx.telegram
            .getChatMember(
              ctx.chat.id,
              ownerId
            );

        const owner =
          member.user;

        let photo = null;

        try {

          const photos =
            await ctx.telegram
              .getUserProfilePhotos(
                ownerId,
                0,
                1
              );

          if (
            photos.total_count
          ) {

            photo =
              photos.photos[0][0]
                .file_id;
          }

        } catch {}

        const keyboard =
          owner.username
            ? Markup.inlineKeyboard([
                [
                  Markup.button.url(
                    "الملف الشخصي",
                    `https://t.me/${owner.username}`
                  )
                ]
              ])
            : undefined;

        const caption =
          eveMessage(
            "المالك",
            [

              `⌗ الاسم 〃 ${
                displayName(owner)
              }`,

              `⌗ المستخدم 〃 ${
                owner.username
                  ? "@" +
                    owner.username
                  : "لا يوجد"
              }`,

              "⌗ البايو 〃 غير متاح عبر Bot API",

              "",

              "〃 مالك القروب الحالي"

            ]
          );

        if (photo) {

          await ctx.replyWithPhoto(
            photo,
            {

              caption,

              has_spoiler:
                true,

              ...(keyboard || {})

            }
          );

        } else {

          await ctx.reply(
            caption,
            keyboard
          );
        }

      } catch {

        await ctx.reply(

          eveMessage(
            "إيف",
            [
              "⌗ تعذر جلب بيانات المالك"
            ]
          )

        );
      }

      return;
    }

    // ==================================================
    // إنشاء رد
    // ==================================================

    if (
      text === "اضف رد"
    ) {

      if (
        !hasRank(
          group,
          ctx.from.id,
          "مالك"
        )
      ) {

        await permissionDenied(
          ctx,
          "مالك"
        );

        return;
      }

      group.pending[
        String(ctx.from.id)
      ] = {

        type: "reply-word"

      };

      saveDatabase();

      await ctx.reply(

        eveMessage(
          "إيف",
          [

            "⌗ أرسل الكلمة",

            "〃 التي تريد إضافة رد لها"

          ]
        )

      );

      return;
    }

    // ==================================================
    // الرد على إضافة الرد
    // ==================================================

    const pending =
      group.pending[
        String(ctx.from.id)
      ];

    if (
      pending &&
      pending.type ===
        "reply-word"
    ) {

      pending.word =
        text;

      pending.type =
        "reply-text";

      saveDatabase();

      await ctx.reply(

        eveMessage(
          "إيف",
          [

            "⌗ أرسل الرد الذي تريده",

            `〃 على 〃 ${text}`

          ]
        )

      );

      return;
    }

    if (
      pending &&
      pending.type ===
        "reply-text"
    ) {

      group.customReplies[
        pending.word
      ] = text;

      delete group.pending[
        String(ctx.from.id)
      ];

      saveDatabase();

      await ctx.reply(

        eveMessage(
          "إيف",
          [

            "⌗ تم حفظ الرد بنجاح",

            `〃 الكلمة 〃 ${pending.word}`

          ]
        )

      );

      return;
    }

    // ==================================================
    // حذف رد
    // ==================================================

    if (
      text === "حذف رد"
    ) {

      if (
        !hasRank(
          group,
          ctx.from.id,
          "مالك"
        )
      ) {

        await permissionDenied(
          ctx,
          "مالك"
        );

        return;
      }

      const replies =
        Object.keys(
          group.customReplies
        );

      if (!replies.length) {

        await ctx.reply(

          eveMessage(
            "إيف",
            [
              "⌗ لا توجد ردود مضافة"
            ]
          )

        );

        return;
      }

      const buttons =
        replies
          .slice(0, 30)
          .map(
            word => [

              Markup.button.callback(
                word,
                `delete_reply:${Buffer.from(
                  word
                ).toString("base64")}`
              )

            ]
          );

      await ctx.reply(

        eveMessage(
          "إيف",
          [
            "⌗ اختر الرد الذي تريد حذفه"
          ]
        ),

        Markup.inlineKeyboard(
          buttons
        )

      );

      return;
    }

    // ==================================================
    // إضافة تقييد
    // ==================================================

    if (
      text === "تقييد"
    ) {

      if (
        !hasRank(
          group,
          ctx.from.id,
          "مدير"
        )
      ) {

        await permissionDenied(
          ctx,
          "مدير"
        );

        return;
      }

      const target =
        getTarget(ctx);

      if (!target) {

        await ctx.reply(

          eveMessage(
            "إيف",
            [
              "⌗ استخدم الأمر بالرد على العضو"
            ]
          )

        );

        return;
      }

      group.restricted[
        String(target.id)
      ] = true;

      saveDatabase();

      await ctx.reply(

        eveMessage(
          "إيف",
          [

            `⌗ المستخدم 〃 ${
              displayName(target)
            }`,

            "〃 تم تقييده"

          ]
        )

      );

      return;
    }

    // ==================================================
    // كتم
    // ==================================================

    if (
      text === "كتم"
    ) {

      if (
        !hasRank(
          group,
          ctx.from.id,
          "مدير"
        )
      ) {

        await permissionDenied(
          ctx,
          "مدير"
        );

        return;
      }

      const target =
        getTarget(ctx);

      if (!target) {

        await ctx.reply(

          eveMessage(
            "إيف",
            [
              "⌗ استخدم الأمر بالرد على العضو"
            ]
          )

        );

        return;
      }

      group.muted[
        String(target.id)
      ] = true;

      saveDatabase();

      await ctx.reply(

        eveMessage(
          "إيف",
          [

            `⌗ المستخدم 〃 ${
              displayName(target)
            }`,

            "〃 تم كتمه"

          ]
        )

      );

      return;
    }

    // ==================================================
    // حظر
    // ==================================================

    if (
      text === "حظر"
    ) {

      if (
        !hasRank(
          group,
          ctx.from.id,
          "مالك"
        )
      ) {

        await permissionDenied(
          ctx,
          "مالك"
        );

        return;
      }

      const target =
        getTarget(ctx);

      if (!target) {

        await ctx.reply(

          eveMessage(
            "إيف",
            [
              "⌗ استخدم الأمر بالرد على العضو"
            ]
          )

        );

        return;
      }

      group.banned[
        String(target.id)
      ] = true;

      try {

        await ctx.telegram
          .banChatMember(
            ctx.chat.id,
            target.id
          );

      } catch {}

      saveDatabase();

      await ctx.reply(

        eveMessage(
          "إيف",
          [

            `⌗ المستخدم 〃 ${
              displayName(target)
            }`,

            "〃 تم حظره"

          ]
        )

      );

      return;
    }

    // ==================================================
    // تحذير
    // ==================================================

    if (
      text === "تحذير"
    ) {

      if (
        !hasRank(
          group,
          ctx.from.id,
          "مدير"
        )
      ) {

        await permissionDenied(
          ctx,
          "مدير"
        );

        return;
      }

      const target =
        getTarget(ctx);

      if (!target) {

        await ctx.reply(

          eveMessage(
            "إيف",
            [
              "⌗ استخدم الأمر بالرد على العضو"
            ]
          )

        );

        return;
      }

      const targetId =
        String(target.id);

      group.warnings[
        targetId
      ] =
        (
          group.warnings[
            targetId
          ] || 0
        ) + 1;

      saveDatabase();

      await ctx.reply(

        eveMessage(
          "إيف",
          [

            `⌗ تنبيه 〃 ${
              displayName(target)
            }`,

            `〃 التحذير رقم ${
              group.warnings[targetId]
            }`

          ]
        )

      );

      return;
    }

    // ==================================================
    // تفعيل الحماية
    // ==================================================

    if (
      text === "تفعيل الحماية" ||
      text === "تعطيل الحماية"
    ) {

      if (
        !hasRank(
          group,
          ctx.from.id,
          "مالك"
        )
      ) {

        await permissionDenied(
          ctx,
          "مالك"
        );

        return;
      }

      group.settings.protection =
        text ===
        "تفعيل الحماية";

      saveDatabase();

      await ctx.reply(

        eveMessage(
          "إيف",
          [

            `⌗ الحماية 〃 ${
              group.settings.protection
                ? "مفعلة"
                : "معطلة"
            }`

          ]
        )

      );

      return;
    }

    // ==================================================
    // لوحة المطور
    // ==================================================

    if (
      text === "لوحة" &&
      String(ctx.from.id) ===
        String(DEVELOPER_ID)
    ) {

      await ctx.reply(

        eveMessage(
          "لوحة إيف",
          [

            "⌗ إدارة القروبات",

            "⌗ إدارة المطورين",

            "⌗ إدارة الرتب",

            "⌗ إدارة الحماية",

            "⌗ إدارة البنك",

            "⌗ إدارة الأوامر",

            "⌗ الإحصائيات",

            "⌗ إعدادات المصدر",

            "⌗ النسخ الاحتياطي"

          ]
        )

      );

      return;
    }
  }
);

// ======================================================
// الأزرار
// ======================================================

bot.on(
  "callback_query",
  async ctx => {

    const data =
      ctx.callbackQuery.data;

    // --------------------------------------------------
    // حذف رد
    // --------------------------------------------------

    if (
      data.startsWith(
        "delete_reply:"
      )
    ) {

      if (!isGroup(ctx)) {
        return;
      }

      const group =
        getGroup(ctx);

      if (
        !hasRank(
          group,
          ctx.from.id,
          "مالك"
        )
      ) {

        await ctx.answerCbQuery(
          "ما عندك صلاحية",
          {
            show_alert: true
          }
        );

        return;
      }

      const encoded =
        data.replace(
          "delete_reply:",
          ""
        );

      const word =
        Buffer.from(
          encoded,
          "base64"
        ).toString();

      delete group.customReplies[
        word
      ];

      saveDatabase();

      await ctx.answerCbQuery(
        "تم حذف الرد"
      );

      await ctx.editMessageText(

        eveMessage(
          "إيف",
          [

            "⌗ تم حذف الرد",

            `〃 الكلمة 〃 ${word}`

          ]
        )

      );

      return;
    }

    await ctx.answerCbQuery();
  }
);

// ======================================================
// أخطاء
// ======================================================

bot.catch(
  (error, ctx) => {

    console.error(
      "Eif Error:",
      error
    );
  }
);

// ======================================================
// تشغيل إيف
// ======================================================

bot.launch()
  .then(() => {

    console.log(
      "୨୧ ─── إيف تعمل الآن ─── ୨୧"
    );

  })
  .catch(error => {

    console.error(
      "Failed to start Eif:",
      error
    );

  });

// ======================================================
// إيقاف آمن
// ======================================================

process.once(
  "SIGINT",
  () => bot.stop("SIGINT")
);

process.once(
  "SIGTERM",
  () => bot.stop("SIGTERM")
);
