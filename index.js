import logging
import sqlite3
import random
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ChatPermissions
from telegram.ext import (
    ApplicationBuilder,
    ContextTypes,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    filters
)

# ----------------- الإعدادات الأساسية -----------------
TOKEN = "YOUR_BOT_TOKEN_HERE"
OWNER_USERNAME = "j4xa7"

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

# ----------------- قاعدة البيانات -----------------
def init_db():
    conn = sqlite3.connect("toraive.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            role TEXT DEFAULT 'member',
            messages INTEGER DEFAULT 0,
            balance INTEGER DEFAULT 0,
            is_muted INTEGER DEFAULT 0,
            is_globally_muted INTEGER DEFAULT 0
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    conn.commit()
    conn.close()

init_db()

def get_db():
    return sqlite3.connect("toraive.db")

# ----------------- نظام الرتب والصلاحيات -----------------
ROLES_HIERARCHY = {
    "member": 0,
    "مميز": 1,
    "مالك": 2,
    "مالك أساسي": 3,
    "Myth": 4,
    "Myth 🎖️": 5,
    "Dev²🎖️": 6,
    "Dev🎖️": 7
}

def get_user_role(user_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT role FROM users WHERE user_id = ?", (user_id,))
    res = cursor.fetchone()
    conn.close()
    return res[0] if res else "member"

async def check_rank_protection(update: Update, target_user_id: int) -> bool:
    executor_id = update.effective_user.id
    executor_role = get_user_role(executor_id)
    target_role = get_user_role(target_user_id)
    
    executor_lvl = ROLES_HIERARCHY.get(executor_role, 0)
    target_lvl = ROLES_HIERARCHY.get(target_role, 0)
    
    if executor_lvl <= target_lvl:
        await update.message.reply_text(f"• ماتقدر تستخدم الامر على ↤ ｢ {target_role} ｣\n• لازم ينزل رتبته أولًا.")
        return False
    return True

# ----------------- أوامر الحماية والإدارة بالرد -----------------
async def mute_user(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message.reply_to_message:
        return
    target_id = update.message.reply_to_message.from_user.id
    if not await check_rank_protection(update, target_id):
        return
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET is_muted = 1 WHERE user_id = ?", (target_id,))
    conn.commit()
    conn.close()
    
    try:
        await context.bot.restrict_chat_member(
            chat_id=update.effective_chat.id,
            user_id=target_id,
            permissions=ChatPermissions(can_send_messages=False)
        )
        await update.message.reply_text("• تم كتم العضو بنجاح.")
    except Exception as e:
        await update.message.reply_text(f"خطأ في تنفيذ الأمر عبر تيليجرام: {e}")

async def global_mute_user(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message.reply_to_message:
        return
    target_id = update.message.reply_to_message.from_user.id
    if not await check_rank_protection(update, target_id):
        return
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET is_globally_muted = 1 WHERE user_id = ?", (target_id,))
    conn.commit()
    conn.close()
    await update.message.reply_text("• تم كتم العضو عام بنجاح.")

async def restrict_user(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message.reply_to_message:
        return
    target_id = update.message.reply_to_message.from_user.id
    if not await check_rank_protection(update, target_id):
        return
    
    try:
        await context.bot.restrict_chat_member(
            chat_id=update.effective_chat.id,
            user_id=target_id,
            permissions=ChatPermissions(can_send_messages=False, can_send_media_messages=False)
        )
        await update.message.reply_text("• تم تقييد العضو المحدد.")
    except Exception as e:
        await update.message.reply_text(f"خطأ: {e}")

async def ban_user(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message.reply_to_message:
        return
    target_id = update.message.reply_to_message.from_user.id
    if not await check_rank_protection(update, target_id):
        return
    
    try:
        await context.bot.ban_chat_member(chat_id=update.effective_chat.id, user_id=target_id)
        await update.message.reply_text("• تم حظر العضو المحدد.")
    except Exception as e:
        await update.message.reply_text(f"خطأ: {e}")

async def kick_user(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message.reply_to_message:
        return
    target_id = update.message.reply_to_message.from_user.id
    if not await check_rank_protection(update, target_id):
        return
    
    try:
        await context.bot.ban_chat_member(chat_id=update.effective_chat.id, user_id=target_id)
        await context.bot.unban_chat_member(chat_id=update.effective_chat.id, user_id=target_id)
        await update.message.reply_text("• تم طرد العضو المحدد.")
    except Exception as e:
        await update.message.reply_text(f"خطأ: {e}")

# ----------------- قوائم ومسح المكتومين -----------------
async def list_muted(update: Update, context: ContextTypes.DEFAULT_TYPE):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id FROM users WHERE is_muted = 1")
    muted = cursor.fetchall()
    conn.close()
    
    if not muted:
        await update.message.reply_text("• لا يوجد مكتومين")
    else:
        msg = "قائمة المكتومين:\n" + "\n".join([f"- مقيم_{uid[0]}" for uid in muted])
        await update.message.reply_text(msg)

async def clear_muted(update: Update, context: ContextTypes.DEFAULT_TYPE):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users WHERE is_muted = 1")
    count = cursor.fetchone()[0]
    
    if count == 0:
        await update.message.reply_text("• لا يوجد مكتومين")
    else:
        cursor.execute("UPDATE users SET is_muted = 0")
        conn.commit()
        await update.message.reply_text(f"• تم مسح ( {count} ) من المكتومين")
    conn.close()

async def list_global_muted(update: Update, context: ContextTypes.DEFAULT_TYPE):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id FROM users WHERE is_globally_muted = 1")
    muted = cursor.fetchall()
    conn.close()
    
    if not muted:
        await update.message.reply_text("• لا يوجد مكتومين عام ,")
    else:
        msg = "قائمة المكتومين عام:\n" + "\n".join([f"- مقيم_{uid[0]}" for uid in muted])
        await update.message.reply_text(msg)

async def clear_global_muted(update: Update, context: ContextTypes.DEFAULT_TYPE):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users WHERE is_globally_muted = 1")
    count = cursor.fetchone()[0]
    
    if count == 0:
        await update.message.reply_text("• لا يوجد مكتومين عام ,")
    else:
        cursor.execute("UPDATE users SET is_globally_muted = 0")
        conn.commit()
        await update.message.reply_text(f"• تم مسح ( {count} ) من المكتومين عام")
    conn.close()

async def demote_all_roles(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message.reply_to_message:
        return
    target_id = update.message.reply_to_message.from_user.id
    if not await check_rank_protection(update, target_id):
        return
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET role = 'member' WHERE user_id = ?", (target_id,))
    conn.commit()
    conn.close()
    await update.message.reply_text("• تم تنزيل جميع رتب العضو وإعادته إلى رتبة عضو.")

# ----------------- التشغيل -----------------
def main():
    app = ApplicationBuilder().token(TOKEN).build()

    app.add_handler(CommandHandler("كتم", mute_user))
    app.add_handler(CommandHandler("عام", global_mute_user))
    app.add_handler(CommandHandler("تقييد", restrict_user))
    app.add_handler(CommandHandler("حظر", ban_user))
    app.add_handler(CommandHandler("طرد", kick_user))
    app.add_handler(CommandHandler("مم", list_muted))
    app.add_handler(CommandHandler("مسح_المكتومين", clear_muted)) # أو عبر فلتر النص
    app.add_handler(CommandHandler("خخ", list_global_muted))
    app.add_handler(CommandHandler("تنزيل_الكل", demote_all_roles))

    logger.info("Moderation bot running...")
    app.run_polling()

if __name__ == "__main__":
    main()
