import os
import sqlite3
import threading
import uuid
import logging
from telethon import TelegramClient, events, Button
from telethon.tl.types import ChatAdminRights
from dotenv import load_dotenv
import openai

load_dotenv()
API_ID = int(os.getenv("API_ID", 0))
API_HASH = os.getenv("API_HASH", "")
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
AI_API_KEY = os.getenv("AI_API_KEY", "")

logging.basicConfig(level=logging.INFO)
bot = TelegramClient("eve_bot_session", API_ID, API_HASH).start(bot_token=BOT_TOKEN)

RANKS = {
    "Dev🎖️": 8,
    "Dev²🎖️": 7,
    "Myth🎖️": 6,
    "Myth": 5,
    "مالك أساسي": 4,
    "مالك": 3,
    "مميز": 2,
    "عضو": 1
}

# ----------------- Database Manager -----------------
class DatabaseManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, db_name="eve_bot.db"):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(DatabaseManager, cls).__new__(cls)
                cls._instance.db_name = db_name
                cls._instance.conn = sqlite3.connect(db_name, check_same_thread=False)
                cls._instance.conn.row_factory = sqlite3.Row
                cls._instance._create_tables()
        return cls._instance

    def _create_tables(self):
        with self._lock:
            cursor = self.conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    user_id INTEGER PRIMARY KEY,
                    username TEXT,
                    balance REAL DEFAULT 0.0,
                    rank TEXT DEFAULT 'عضو'
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS channels (
                    channel_id INTEGER PRIMARY KEY,
                    title TEXT,
                    link TEXT,
                    added_by INTEGER
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS forbidden_words (
                    word TEXT PRIMARY KEY
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS warnings (
                    user_id INTEGER,
                    chat_id INTEGER,
                    count INTEGER DEFAULT 0,
                    PRIMARY KEY (user_id, chat_id)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS custom_commands (
                    command TEXT PRIMARY KEY,
                    response TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS marriages (
                    user1_id INTEGER PRIMARY KEY,
                    user2_id INTEGER
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS whispers (
                    whisper_id TEXT PRIMARY KEY,
                    sender_id INTEGER,
                    receiver_id INTEGER,
                    text TEXT
                )
            """)
            self.conn.commit()

    def execute(self, query, params=()):
        with self._lock:
            cursor = self.conn.cursor()
            cursor.execute(query, params)
            self.conn.commit()
            return cursor

    def fetchone(self, query, params=()):
        with self._lock:
            cursor = self.conn.cursor()
            cursor.execute(query, params)
            return cursor.fetchone()

    def fetchall(self, query, params=()):
        with self._lock:
            cursor = self.conn.cursor()
            cursor.execute(query, params)
            return cursor.fetchall()

db = DatabaseManager()

# ----------------- Games Data & Logic -----------------
GAMES_DATA = {
    "صور": {"q": "ما هو الحيوان في الصورة؟ (أسد/فهد)", "a": "أسد"},
    "كلمة": {"q": "رتب الحروف لتكون كلمة: (ة م ك م ل ع)", "a": "المملكة"},
    "ترتيب": {"q": "رتب العاصمة: (ي ر ا ض ل)", "a": "الرياض"},
    "مقال": {"q": "اكتب كلمة 'تطوير' بشكل صحيح.", "a": "تطوير"},
    "جملة": {"q": "ما هي عاصمة السعودية؟", "a": "الرياض"},
    "حروف": {"q": "اجمع الحرفين: (م + ك)", "a": "مك"},
    "خمن": {"q": "شيء يكتب ولا يقرأ؟", "a": "القلم"},
    "لغز": {"q": "من هو خال أبناء عمكتك؟", "a": "والدك"},
    "صح أو خطأ": {"q": "الشمس تهبط ليلاً؟ (صح/خطأ)", "a": "خطأ"},
    "أكمل": {"q": "من طلب العلى سهر الليل (أكمل بكلمة: الليالي)", "a": "الليالي"},
    "مقلوب": {"q": "اعكس كلمة: (سَمَاء)", "a": "ءَامَس"},
    "فكك": {"q": "فكك كلمة: (محمد)", "a": "م ح م د"},
    "إيموجي": {"q": "ماذا يعبر هذا الإيموجي؟ 🍎", "a": "تفاحة"},
    "سرعة": {"q": "اكتب بسرعة: (ايف البوت الذكي)", "a": "ايف البوت الذكي"},
    "حساب": {"q": "كم الناتج: 5 + 5 * 2", "a": "15"},
    "ذاكرة": {"q": "اذكر الرقم الذي تم عرضه سابقاً: 789", "a": "789"},
    "من أنا": {"q": "أنا لغة برمجة أستخدم لإنشاء بوتات تليجرام واسمي يبدأ بـ P", "a": "بايثون"},
    "كلمة السر": {"q": "كلمة السر هي: (الذكاء)", "a": "الذكاء"}
}

class GameManager:
    @staticmethod
    def process_answer(user_id, game_type, answer):
        game = GAMES_DATA.get(game_type)
        if game and game["a"].strip().lower() == answer.strip().lower():
            db.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", (user_id,))
            db.execute("UPDATE users SET balance = balance + 10.0 WHERE user_id = ?", (user_id,))
            return True
        return False

# ----------------- AI & Helpers -----------------
def ask_ai(prompt):
    if not AI_API_KEY:
        return "مفتاح OpenAI API غير مُعرّف في البيئة."
    try:
        client = openai.OpenAI(api_key=AI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices.message.content.strip()
    except Exception as e:
        return f"حدث خطأ أثناء الاتصال بالذكاء الاصطناعي: {e}"

def create_whisper(sender_id, receiver_id, text):
    w_id = str(uuid.uuid4())[:8]
    db.execute("INSERT INTO whispers (whisper_id, sender_id, receiver_id, text) VALUES (?, ?, ?, ?)",
               (w_id, sender_id, receiver_id, text))
    return w_id

def get_user_rank(user_id):
    row = db.fetchone("SELECT rank FROM users WHERE user_id = ?", (user_id,))
    return row["rank"] if row else "عضو"

def check_rank(user_id, min_rank_name):
    user_rank = get_user_rank(user_id)
    return RANKS.get(user_rank, 0) >= RANKS.get(min_rank_name, 0)

# ----------------- Bot Event Handlers -----------------
@bot.on(events.NewMessage(pattern=r'/start'))
async def start_handler(event):
    user = await event.get_sender()
    db.execute("INSERT OR IGNORE INTO users (user_id, username, rank) VALUES (?, ?, ?)",
               (user.id, user.username, "عضو"))
    
    # دعم فتح الهمسات في الخاص
    if event.is_private and "whisper_" in event.text:
        w_id = event.text.split("whisper_")
        row = db.fetchone("SELECT * FROM whispers WHERE whisper_id = ?", (w_id,))
        if row:
            if user.id == row["receiver_id"] or user.id == row["sender_id"]:
                return await event.respond(f"🔏 **همسة خاصة:**\n{row['text']}")
            else:
                return await event.respond("هذه الهمسة ليست موجهة لك!")
        else:
            return await event.respond("هذه الهمسة غير موجودة أو انتهت صلاحيتها.")

    await event.respond("أهلاً بك أنا بوت ايف المتطور 🎖️.\nاستخدم /help لعرض قائمة الأوامر التفاعلية.")

@bot.on(events.NewMessage(pattern=r'/help'))
async def help_handler(event):
    help_text = (
        "**قائمة أوامر بوت ايف 🎖️**\n\n"
        "• `/game [اسم اللعبة]` - لبدء الألعاب التفاعلية\n"
        "• `/balance` - لعرض الرصيد البنكي العالمي (10 ريال لكل إجابة)\n"
        "• `/whisper @user [الرسالة]` - لإرسال همسة خاصة\n"
        "• `/ai [سؤالك]` - التفاعل الذكي مع الذكاء الاصطناعي\n"
        "• `/ban` - حظر مستخدم بالرد\n"
        "• `/promote_panel` - لوحة صلاحيات المشرفين الفعلية\n"
    )
    await event.respond(help_text, parse_mode='markdown')

@bot.on(events.NewMessage(pattern=r'/balance'))
async def balance_handler(event):
    row = db.fetchone("SELECT balance FROM users WHERE user_id = ?", (event.sender_id,))
    bal = row["balance"] if row else 0.0
    await event.respond(f"رصيدك الحالي في البنك العالمي: {bal} ريال 💰")

@bot.on(events.NewMessage(pattern=r'/ai\s+(.+)'))
async def ai_cmd(event):
    prompt = event.pattern_match.group(1)
    msg = await event.respond("جاري التفكير...")
    res = ask_ai(prompt)
    await msg.edit(res)

@bot.on(events.NewMessage(pattern=r'/game\s+(.+)'))
async def game_cmd(event):
    g_name = event.pattern_match.group(1).strip()
    if g_name in GAMES_DATA:
        q = GAMES_DATA[g_name]["q"]
        await event.respond(f"لعبة ({g_name}):\n{q}\nأجب بسرعة عبر الرد على هذه الرسالة!")
    else:
        await event.respond("لعبة غير موجودة. الألعاب المتاحة: " + ", ".join(GAMES_DATA.keys()))

@bot.on(events.NewMessage())
async def game_answer_listener(event):
    if event.is_reply and not event.text.startswith('/'):
        reply = await event.get_reply_message()
        if reply and "لعبة" in reply.text:
            for g_name in GAMES_DATA:
                if g_name in reply.text:
                    correct = GameManager.process_answer(event.sender_id, g_name, event.text)
                    if correct:
                        await event.respond("إجابة صحيحة! 🎉 تم إضافة 10 ريال إلى رصيدك العالمي.")
                    return

@bot.on(events.NewMessage(pattern=r'/whisper\s+(@\w+)\s+(.+)'))
async def whisper_cmd(event):
    target_username = event.pattern_match.group(1)
    text = event.pattern_match.group(2)
    try:
        user = await bot.get_entity(target_username)
        w_id = create_whisper(event.sender_id, user.id, text)
        me = await bot.get_me()
        await event.respond("تم إرسال الهمسة بنجاح في الخاص 🔏", buttons=[
            [Button.url("فتح الهمسة", url=f"https://t.me/{me.username}?start=whisper_{w_id}")]
        ])
    except Exception as e:
        await event.respond(f"خطأ في إرسال الهمسة: {e}")

@bot.on(events.NewMessage(pattern=r'/ban'))
async def ban_handler(event):
    if not event.is_reply:
        return await event.respond("يجب الرد على المستخدم لحظره.")
    reply = await event.get_reply_message()
    try:
        await bot.edit_permissions(event.chat_id, reply.sender_id, view_messages=False)
        await event.respond("تم حظر المستخدم بنجاح 🚫")
    except Exception as e:
        await event.respond(f"فشل الحظر لصلاحيات ناقصة: {e}")

@bot.on(events.NewMessage(pattern=r'/promote_panel'))
async def promote_panel(event):
    if not check_rank(event.sender_id, "Myth"):
        return await event.respond("ليس لديك الصلاحية الكافية.")
    if not event.is_reply:
        return await event.respond("الرد على المستخدم مطلوب لرفع مشرف.")
    
    await event.respond("اختر صلاحيات المشرف الفعلية:", buttons=[
        [Button.inline("تغيير معلومات المجموعة", data="perm_change_info"),
         Button.inline("حذف الرسائل", data="perm_delete_messages")],
        [Button.inline("حظر المستخدمين", data="perm_ban_users"),
         Button.inline("دعوة المستخدمين", data="perm_invite_users")],
        [Button.inline("حفظ وتطبيق الصلاحيات", data="perm_apply")]
    ])

@bot.on(events.CallbackQuery(data=b'perm_apply'))
async def apply_permissions(event):
    reply = await event.get_reply_message()
    rights = ChatAdminRights(
        change_info=True,
        post_messages=True,
        edit_messages=True,
        delete_messages=True,
        ban_users=True,
        invite_users=True,
        pin_messages=True,
        manage_call=True
    )
    try:
        await bot.edit_admin(event.chat_id, reply.sender_id, rights=rights, rank="مشرف ايف")
        await event.edit("تم تطبيق صلاحيات Telegram الفعليّة وحفظها بنجاح ✅")
    except Exception as e:
        await event.edit(f"حدث خطأ أثناء التطبيق: {e}")

if __name__ == '__main__':
    print("Eve Bot is running...")
    bot.run_until_disconnected()
