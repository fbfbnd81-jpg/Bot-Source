import { Telegraf, Markup } from 'telegraf';
import Database from 'better-sqlite3';

const TOKEN = "8963407967:AAGFd-z2MsvV0Hj7EkoEEPQOrnFBsXv0qiw";
const bot = new Telegraf(TOKEN);
const db = new Database('toraive.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        role TEXT DEFAULT 'member',
        messages INTEGER DEFAULT 0,
        balance INTEGER DEFAULT 0,
        is_muted INTEGER DEFAULT 0,
        is_globally_muted INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
`);

const setDef = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
setDef.run("chat_locked", "false");
setDef.run("games_locked", "false");
setDef.run("violations_locked", "false");

const ROLES_HIERARCHY = {
    "member": 0,
    "مميز": 1,
    "مالك": 2,
    "مالك أساسي": 3,
    "Myth": 4,
    "Myth 🎖️": 5,
    "Dev²🎖️": 6,
    "Dev🎖️": 7
};

function getUserRole(userId) {
    const row = db.prepare("SELECT role FROM users WHERE user_id = ?").get(userId);
    return row ? row.role : "member";
}

function checkRankProtection(executorRole, targetRole) {
    return ROLES_HIERARCHY[executorRole] > ROLES_HIERARCHY[targetRole];
}

// نظام استقبال الرسائل والتفاعل
bot.on('text', async (ctx, next) => {
    if (!ctx.message || !ctx.from || ctx.from.is_bot) return;
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();

    // تحديث التفاعل
    db.prepare("INSERT OR IGNORE INTO users (user_id, messages, balance) VALUES (?, 0, 0)").run(userId);
    db.prepare("UPDATE users SET messages = messages + 1 WHERE user_id = ?").run(userId);

    // شخصية تورايف والردود
    if (text === 'تورايف' || text === 'بوت') {
        const replies = ["هلا", "عيوني", "امر", "وش بغيت", "ها", "عيون ايفي"];
        return ctx.reply(replies[Math.floor(Math.random() * replies.length)], { reply_to_message_id: ctx.message.message_id });
    }
    
    // منشن إيلاف الحقيقي مع الرد (Reply)
    if (text === 'ايلاف' || text === 'إيلاف') {
        return ctx.replyWithMarkdownV2(`[j4xa7](t.me/j4xa7)`, { reply_to_message_id: ctx.message.message_id });
    }

    return next();
});

// أوامر التفاعل والرتب
bot.command(['رتبتي', 'تفاعلي'], (ctx) => {
    const userId = ctx.from.id;
    const user = db.prepare("SELECT messages, role FROM users WHERE user_id = ?").get(userId) || { messages: 0, role: 'عضو' };
    const rankRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE messages > ?").get(user.messages);
    const rank = rankRow.count + 1;
    ctx.reply(`• رتبتك هي ↤ ${user.role}\n• رسائلك بالتفاعل ↤ ${user.messages}\n• ترتيبك بالمتفاعلين ↤ ${rank}`, { reply_to_message_id: ctx.message.message_id });
});

bot.command(['المتفاعلين', 'التوب'], (ctx) => {
    const topUsers = db.prepare("SELECT user_id, messages FROM users ORDER BY messages DESC LIMIT 20").all();
    const userId = ctx.from.id;
    const userRow = db.prepare("SELECT messages FROM users WHERE user_id = ?").get(userId) || { messages: 0 };
    const userRankRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE messages > ?").get(userRow.messages);
    
    let msg = "المتفاعلين\n\nتوب اكثر 20 متفاعلين بالقروب :\n━━━━━━━━━\n";
    const medals = ["🥇", "🥈", "🥉"];
    topUsers.forEach((u, index) => {
        const prefix = medals[index] || (index + 1);
        msg += `${prefix} ) ${u.messages.toLocaleString()}  l مقيم_${u.user_id}\n`;
    });
    msg += `━━━━━━━━━\n• you) ${userRow.messages} l منشن العضو\n━━━━━━━━━`;
    
    ctx.reply(msg, Markup.inlineKeyboard([
        [Markup.button.callback('إخفاء الأمر', 'hide_message')]
    ]));
});

bot.action('hide_message', async (ctx) => {
    try { await ctx.deleteMessage(); } catch (e) {}
});

// أوامر الهمسات
bot.command(['اهمس', 'همسه', 'ه'], (ctx) => {
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.url('اهمس هنا', `https://t.me/${ctx.botInfo.username}?start=whisper`)]
    ]);
    ctx.reply("• تم تحديد الهمسه لـ ↤ هيج/ لا احد يكلمني نايمه\n• اضغط الزر لكتابة الهمسة", keyboard);
});

bot.launch();
console.log('Toraive Bot is running...');
