const TOKEN = "8963407967:AAEMfQ6NkTtIDY4f6b4palcck3TU82cOXQg؛
const bot = new Telegraf(TOKEN);

// ===============================
// الرتب
// ===============================

const RANKS = {
    "عضو": 0,
    "مميز": 1,
    "مالك": 2,
    "مالك أساسي": 3,
    "Myth": 4,
    "Myth 🎖️": 5,
    "Dev² 🎖️": 6,
    "Dev 🎖️": 7
};

// ===============================
// قاعدة البيانات
// ===============================

const DB_FILE = "./data.json";

let db = {
    users: {},
    chats: {}
};

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    } catch {
        console.log("تعذر قراءة قاعدة البيانات، سيتم إنشاء قاعدة جديدة.");
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ===============================
// المستخدم
// ===============================

function getUser(userId) {
    userId = String(userId);

    if (!db.users[userId]) {
        db.users[userId] = {
            rank: "عضو"
        };

        saveDB();
    }

    return db.users[userId];
}

function getRank(userId) {
    return getUser(userId).rank || "عضو";
}

function getRankLevel(userId) {
    return RANKS[getRank(userId)] ?? 0;
}

// ===============================
// هل يقدر ينزل رتبة شخص؟
// فقط Myth 🎖️ وفوق
// والشخص المستهدف لازم يكون أقل منه
// ===============================

function canChangeRank(actorId, targetId) {
    const actorLevel = getRankLevel(actorId);
    const targetLevel = getRankLevel(targetId);

    // تبدأ صلاحية تنزيل الرتب من Myth 🎖️
    if (actorLevel < RANKS["Myth 🎖️"]) {
        return false;
    }

    // لا يستطيع تعديل نفسه
    if (String(actorId) === String(targetId)) {
        return false;
    }

    // يقدر يتعامل مع اللي تحته فقط
    return actorLevel > targetLevel;
}

// ===============================
// تحويل اسم الرتبة إلى المستوى
// ===============================

function rankName(level) {
    return Object.keys(RANKS).find(
        rank => RANKS[rank] === level
    ) || "عضو";
}

// ===============================
// أمر عرض الرتبة
// ===============================

bot.command("رتبتي", async (ctx) => {
    const user = getUser(ctx.from.id);

    await ctx.reply(
        `• رتبتك الحالية ↤ ${user.rank}`
    );
});

// ===============================
// أمر عرض الرتب
// ===============================

bot.hears("الرتب", async (ctx) => {
    let text = "• رتب البوت:\n\n";

    Object.entries(RANKS)
        .sort((a, b) => b[1] - a[1])
        .forEach(([rank, level]) => {
            text += `• ${rank} ↤ ${level}\n`;
        });

    await ctx.reply(text);
});

// ===============================
// تنزيل رتبة بالرد
//
// مثال:
// بالرد على شخص:
// تنزيل عضو
//
// أو:
// تنزيل مميز
// ===============================

bot.hears(/^تنزيل(?:\s+(.+))?$/i, async (ctx) => {

    if (!ctx.message.reply_to_message) {
        return ctx.reply(
            "• يجب الرد على الشخص الذي تريد تنزيل رتبته."
        );
    }

    const actorId = ctx.from.id;
    const targetId = ctx.message.reply_to_message.from.id;

    if (!canChangeRank(actorId, targetId)) {
        return ctx.reply(
            "• ليس لديك صلاحية تنزيل رتبة هذا الشخص."
        );
    }

    const newRank = ctx.match[1]?.trim();

    if (!newRank || !RANKS.hasOwnProperty(newRank)) {
        return ctx.reply(
            "• الرتبة غير صحيحة.\n\n" +
            "• الرتب المتاحة:\n" +
            Object.keys(RANKS).join("\n")
        );
    }

    const target = getUser(targetId);

    const actorLevel = getRankLevel(actorId);
    const targetLevel = getRankLevel(targetId);
    const newLevel = RANKS[newRank];

    // لا يسمح برفع رتبة الشخص بهذا الأمر
    if (newLevel >= targetLevel) {
        return ctx.reply(
            "• هذا الأمر مخصص لإنزال الرتبة فقط."
        );
    }

    // لا يستطيع إعطاء رتبة مساوية أو أعلى من رتبته
    if (newLevel >= actorLevel) {
        return ctx.reply(
            "• لا يمكنك إعطاء الشخص رتبة مساوية أو أعلى من رتبتك."
        );
    }

    target.rank = newRank;
    saveDB();

    await ctx.reply(
        `• تم تنزيل رتبة المستخدم إلى ↤ ${newRank}`
    );
});

// ===============================
// تعيين رتبة
// فقط Myth 🎖️ وفوق
// والرتبة الجديدة أقل من رتبة المنفذ
// ===============================

bot.hears(/^رفع(?:\s+(.+))?$/i, async (ctx) => {

    if (!ctx.message.reply_to_message) {
        return ctx.reply(
            "• يجب الرد على الشخص."
        );
    }

    const actorId = ctx.from.id;
    const targetId = ctx.message.reply_to_message.from.id;

    const actorLevel = getRankLevel(actorId);
    const targetLevel = getRankLevel(targetId);

    if (actorLevel < RANKS["Myth 🎖️"]) {
        return ctx.reply(
            "• ما عندك صلاحية تعديل الرتب."
        );
    }

    if (actorLevel <= targetLevel) {
        return ctx.reply(
            "• لا يمكنك تعديل رتبة شخص مساوي أو أعلى منك."
        );
    }

    const newRank = ctx.match[1]?.trim();

    if (!newRank || !RANKS.hasOwnProperty(newRank)) {
        return ctx.reply(
            "• الرتبة غير صحيحة."
        );
    }

    const newLevel = RANKS[newRank];

    if (newLevel >= actorLevel) {
        return ctx.reply(
            "• لا يمكنك إعطاء رتبة مساوية أو أعلى من رتبتك."
        );
    }

    getUser(targetId).rank = newRank;
    saveDB();

    await ctx.reply(
        `• تم تعيين الرتبة ↤ ${newRank}`
    );
});

// ===============================
// تشغيل البوت
// ===============================

bot.launch();

console.log("Bot is running...");

// إيقاف آمن
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
