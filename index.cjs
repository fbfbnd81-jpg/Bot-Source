============================================================

requirements.txt

============================================================

telethon>=1.36.0
python-dotenv>=1.0.1
httpx>=0.27.0

============================================================

database.py

============================================================

import sqlite3
import threading
import random
import string
from typing import Optional, List, Dict, Any

RANKS_HIERARCHY = {
“Dev🎖️”: 7,
“Dev²🎖️”: 6,
“Myth🎖️”: 5,
“Myth”: 4,
“مالك أساسي”: 3,
“مالك”: 2,
“مميز”: 1,
“عضو”: 0,
}

class DatabaseManager:
def init(self, db_path: str = “bot_database.db”):
self.db_path = db_path
self._lock = threading.RLock()
self._init_db()

def _get_connection(self):
    conn = sqlite3.connect(
        self.db_path,
        timeout=30,
        check_same_thread=False
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn
def _init_db(self):
    with self._lock:
        with self._get_connection() as conn:
            conn.executescript("""
            CREATE TABLE IF NOT EXISTS global_users (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                global_rank TEXT NOT NULL DEFAULT 'عضو',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS group_ranks (
                chat_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                rank_name TEXT NOT NULL,
                PRIMARY KEY (chat_id, user_id),
                FOREIGN KEY(user_id)
                    REFERENCES global_users(user_id)
                    ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS user_balances (
                user_id INTEGER PRIMARY KEY,
                balance REAL NOT NULL DEFAULT 0,
                FOREIGN KEY(user_id)
                    REFERENCES global_users(user_id)
                    ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS bank_accounts (
                user_id INTEGER PRIMARY KEY,
                bank_name TEXT NOT NULL,
                account_number TEXT NOT NULL UNIQUE,
                active INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id)
                    REFERENCES global_users(user_id)
                    ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS user_interactions (
                chat_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                interaction_count INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(chat_id, user_id),
                FOREIGN KEY(user_id)
                    REFERENCES global_users(user_id)
                    ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS warnings (
                chat_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                count INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(chat_id, user_id)
            );
            CREATE TABLE IF NOT EXISTS muted_users (
                chat_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                mode TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(chat_id, user_id)
            );
            CREATE TABLE IF NOT EXISTS forbidden_words (
                chat_id INTEGER NOT NULL,
                word TEXT NOT NULL,
                PRIMARY KEY(chat_id, word)
            );
            CREATE TABLE IF NOT EXISTS custom_commands (
                chat_id INTEGER NOT NULL,
                command TEXT NOT NULL,
                reply_text TEXT NOT NULL,
                PRIMARY KEY(chat_id, command)
            );
            CREATE TABLE IF NOT EXISTS custom_replies (
                chat_id INTEGER NOT NULL,
                word TEXT NOT NULL,
                reply_text TEXT NOT NULL,
                PRIMARY KEY(chat_id, word)
            );
            CREATE TABLE IF NOT EXISTS user_channels (
                user_id INTEGER PRIMARY KEY,
                channel_id TEXT NOT NULL,
                channel_name TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id)
                    REFERENCES global_users(user_id)
                    ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS marriages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id INTEGER NOT NULL,
                husband_id INTEGER NOT NULL,
                wife_id INTEGER NOT NULL,
                slot INTEGER NOT NULL,
                dowry REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(chat_id, wife_id),
                UNIQUE(chat_id, husband_id, slot),
                UNIQUE(chat_id, husband_id, wife_id)
            );
            CREATE TABLE IF NOT EXISTS game_settings (
                chat_id INTEGER PRIMARY KEY,
                locked INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS game_stats (
                chat_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                total_games INTEGER NOT NULL DEFAULT 0,
                total_wins INTEGER NOT NULL DEFAULT 0,
                correct_answers INTEGER NOT NULL DEFAULT 0,
                best_speed REAL NOT NULL DEFAULT 0,
                PRIMARY KEY(chat_id, user_id)
            );
            CREATE TABLE IF NOT EXISTS active_games (
                chat_id INTEGER PRIMARY KEY,
                game_type TEXT NOT NULL,
                question TEXT NOT NULL,
                answers TEXT NOT NULL,
                started_at REAL NOT NULL,
                extra_data TEXT
            );
            CREATE TABLE IF NOT EXISTS active_ahkam (
                chat_id INTEGER PRIMARY KEY,
                starter_id INTEGER NOT NULL,
                participants TEXT NOT NULL,
                state TEXT NOT NULL,
                judge_id INTEGER,
                target_id INTEGER,
                last_pair TEXT
            );
            CREATE TABLE IF NOT EXISTS private_users (
                user_id INTEGER PRIMARY KEY,
                first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS whispers (
                whisper_id TEXT PRIMARY KEY,
                chat_id INTEGER NOT NULL,
                sender_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                content_type TEXT NOT NULL,
                text_content TEXT,
                file_path TEXT,
                caption TEXT,
                status TEXT NOT NULL DEFAULT 'waiting',
                parent_whisper_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                viewed_at TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS whisper_sessions (
                session_id TEXT PRIMARY KEY,
                user_id INTEGER UNIQUE NOT NULL,
                whisper_id TEXT NOT NULL,
                chat_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                parent_whisper_id TEXT,
                prompt_message_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS broadcast_users (
                user_id INTEGER PRIMARY KEY
            );
            """)
            conn.commit()
# ---------------- Users ----------------
def get_or_create_user(
    self,
    user_id: int,
    username: Optional[str] = None,
    first_name: Optional[str] = None
):
    with self._lock:
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT user_id FROM global_users WHERE user_id=?",
                (user_id,)
            ).fetchone()
            if row:
                conn.execute("""
                    UPDATE global_users
                    SET username=COALESCE(?, username),
                        first_name=COALESCE(?, first_name)
                    WHERE user_id=?
                """, (username, first_name, user_id))
            else:
                conn.execute("""
                    INSERT INTO global_users
                    (user_id, username, first_name, global_rank)
                    VALUES (?, ?, ?, 'عضو')
                """, (user_id, username, first_name))
            conn.execute("""
                INSERT OR IGNORE INTO user_balances
                (user_id, balance)
                VALUES (?, 0)
            """, (user_id,))
            conn.commit()
def set_private_user(self, user_id: int):
    self.get_or_create_user(user_id)
    with self._get_connection() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO private_users(user_id) VALUES(?)",
            (user_id,)
        )
        conn.execute(
            "INSERT OR IGNORE INTO broadcast_users(user_id) VALUES(?)",
            (user_id,)
        )
        conn.commit()
# ---------------- Ranks ----------------
def get_global_rank(self, user_id: int) -> str:
    with self._get_connection() as conn:
        row = conn.execute(
            "SELECT global_rank FROM global_users WHERE user_id=?",
            (user_id,)
        ).fetchone()
        return row["global_rank"] if row else "عضو"
def get_user_rank(self, chat_id: int, user_id: int) -> str:
    global_rank = self.get_global_rank(user_id)
    if global_rank == "Dev🎖️":
        return global_rank
    with self._get_connection() as conn:
        row = conn.execute("""
            SELECT rank_name
            FROM group_ranks
            WHERE chat_id=? AND user_id=?
        """, (chat_id, user_id)).fetchone()
        return row["rank_name"] if row else "عضو"
def get_rank_value(self, rank_name: str) -> int:
    return RANKS_HIERARCHY.get(rank_name, 0)
def set_global_rank(self, user_id: int, rank_name: str):
    self.get_or_create_user(user_id)
    with self._get_connection() as conn:
        conn.execute("""
            UPDATE global_users
            SET global_rank=?
            WHERE user_id=?
        """, (rank_name, user_id))
        conn.commit()
def remove_global_rank(self, user_id: int):
    with self._get_connection() as conn:
        conn.execute("""
            UPDATE global_users
            SET global_rank='عضو'
            WHERE user_id=?
        """, (user_id,))
        conn.commit()
def set_group_rank(
    self,
    chat_id: int,
    user_id: int,
    rank_name: str
):
    self.get_or_create_user(user_id)
    if rank_name == "عضو":
        self.remove_group_rank(chat_id, user_id)
        return
    with self._get_connection() as conn:
        conn.execute("""
            INSERT INTO group_ranks(chat_id, user_id, rank_name)
            VALUES (?, ?, ?)
            ON CONFLICT(chat_id, user_id)
            DO UPDATE SET rank_name=excluded.rank_name
        """, (chat_id, user_id, rank_name))
        conn.commit()
def remove_group_rank(self, chat_id: int, user_id: int):
    with self._get_connection() as conn:
        conn.execute("""
            DELETE FROM group_ranks
            WHERE chat_id=? AND user_id=?
        """, (chat_id, user_id))
        conn.commit()
def get_all_global_devs(self):
    with self._get_connection() as conn:
        rows = conn.execute("""
            SELECT user_id, username, first_name
            FROM global_users
            WHERE global_rank='Dev🎖️'
            ORDER BY user_id
        """).fetchall()
        return [dict(row) for row in rows]
# ---------------- Balance ----------------
def get_user_balance(self, user_id: int) -> float:
    self.get_or_create_user(user_id)
    with self._get_connection() as conn:
        row = conn.execute("""
            SELECT balance
            FROM user_balances
            WHERE user_id=?
        """, (user_id,)).fetchone()
        return float(row["balance"]) if row else 0.0
def add_balance_atomic(self, user_id: int, amount: float) -> bool:
    self.get_or_create_user(user_id)
    try:
        with self._lock:
            with self._get_connection() as conn:
                conn.execute("BEGIN IMMEDIATE")
                row = conn.execute("""
                    SELECT balance
                    FROM user_balances
                    WHERE user_id=?
                """, (user_id,)).fetchone()
                if not row:
                    conn.rollback()
                    return False
                new_balance = float(row["balance"]) + float(amount)
                if new_balance < 0:
                    conn.rollback()
                    return False
                conn.execute("""
                    UPDATE user_balances
                    SET balance=?
                    WHERE user_id=?
                """, (new_balance, user_id))
                conn.commit()
                return True
    except Exception:
        return False
def transfer_balance(
    self,
    sender_id: int,
    receiver_id: int,
    amount: float
) -> bool:
    if amount <= 0 or sender_id == receiver_id:
        return False
    self.get_or_create_user(sender_id)
    self.get_or_create_user(receiver_id)
    try:
        with self._lock:
            with self._get_connection() as conn:
                conn.execute("BEGIN IMMEDIATE")
                sender = conn.execute("""
                    SELECT balance FROM user_balances
                    WHERE user_id=?
                """, (sender_id,)).fetchone()
                if not sender or float(sender["balance"]) < amount:
                    conn.rollback()
                    return False
                conn.execute("""
                    UPDATE user_balances
                    SET balance=balance-?
                    WHERE user_id=?
                """, (amount, sender_id))
                conn.execute("""
                    UPDATE user_balances
                    SET balance=balance+?
                    WHERE user_id=?
                """, (amount, receiver_id))
                conn.commit()
                return True
    except Exception:
        return False
# ---------------- Bank ----------------
def _new_account_number(self):
    while True:
        number = "".join(
            random.choice(string.digits)
            for _ in range(10)
        )
        with self._get_connection() as conn:
            exists = conn.execute("""
                SELECT 1 FROM bank_accounts
                WHERE account_number=?
            """, (number,)).fetchone()
        if not exists:
            return number
def create_bank_account(
    self,
    user_id: int,
    bank_name: str
):
    self.get_or_create_user(user_id)
    with self._get_connection() as conn:
        row = conn.execute("""
            SELECT * FROM bank_accounts
            WHERE user_id=?
        """, (user_id,)).fetchone()
        if row:
            conn.execute("""
                UPDATE bank_accounts
                SET bank_name=?, active=1
                WHERE user_id=?
            """, (bank_name, user_id))
            conn.commit()
            return dict(row)
        account_number = self._new_account_number()
        conn.execute("""
            INSERT INTO bank_accounts
            (user_id, bank_name, account_number, active)
            VALUES (?, ?, ?, 1)
        """, (user_id, bank_name, account_number))
        conn.commit()
        return {
            "user_id": user_id,
            "bank_name": bank_name,
            "account_number": account_number,
            "active": 1
        }
def get_bank_account(self, user_id: int):
    with self._get_connection() as conn:
        row = conn.execute("""
            SELECT * FROM bank_accounts
            WHERE user_id=?
        """, (user_id,)).fetchone()
        return dict(row) if row else None
def delete_bank_account(self, user_id: int):
    with self._get_connection() as conn:
        conn.execute("""
            UPDATE bank_accounts
            SET active=0
            WHERE user_id=?
        """, (user_id,))
        conn.commit()
# ---------------- Interaction ----------------
def add_interaction(self, chat_id: int, user_id: int, amount: int = 1):
    self.get_or_create_user(user_id)
    with self._get_connection() as conn:
        conn.execute("""
            INSERT INTO user_interactions
            (chat_id, user_id, interaction_count)
            VALUES (?, ?, ?)
            ON CONFLICT(chat_id, user_id)
            DO UPDATE SET
                interaction_count =
                interaction_count + excluded.interaction_count
        """, (chat_id, user_id, amount))
        conn.commit()
def get_interaction(self, chat_id: int, user_id: int) -> int:
    with self._get_connection() as conn:
        row = conn.execute("""
            SELECT interaction_count
            FROM user_interactions
            WHERE chat_id=? AND user_id=?
        """, (chat_id, user_id)).fetchone()
        return int(row["interaction_count"]) if row else 0
def top_interactions(self, chat_id: int, limit: int = 10):
    with self._get_connection() as conn:
        rows = conn.execute("""
            SELECT user_id, interaction_count
            FROM user_interactions
            WHERE chat_id=?
            ORDER BY interaction_count DESC
            LIMIT ?
        """, (chat_id, limit)).fetchall()
        return [dict(row) for row in rows]
# ---------------- Warnings ----------------
def add_warning(self, chat_id: int, user_id: int) -> int:
    with self._get_connection() as conn:
        conn.execute("""
            INSERT INTO warnings(chat_id, user_id, count)
            VALUES (?, ?, 1)
            ON CONFLICT(chat_id, user_id)
            DO UPDATE SET count=count+1
        """, (chat_id, user_id))
        row = conn.execute("""
            SELECT count FROM warnings
            WHERE chat_id=? AND user_id=?
        """, (chat_id, user_id)).fetchone()
        conn.commit()
        return int(row["count"])
def remove_warning(self, chat_id: int, user_id: int):
    with self._get_connection() as conn:
        conn.execute("""
            DELETE FROM warnings
            WHERE chat_id=? AND user_id=?
        """, (chat_id, user_id))
        conn.commit()
# ---------------- Games ----------------
def is_games_locked(self, chat_id: int) -> bool:
    with self._get_connection() as conn:
        row = conn.execute("""
            SELECT locked FROM game_settings
            WHERE chat_id=?
        """, (chat_id,)).fetchone()
        return bool(row["locked"]) if row else False
def set_games_locked(self, chat_id: int, locked: bool):
    with self._get_connection() as conn:
        conn.execute("""
            INSERT INTO game_settings(chat_id, locked)
            VALUES (?, ?)
            ON CONFLICT(chat_id)
            DO UPDATE SET locked=excluded.locked
        """, (chat_id, int(locked)))
        conn.commit()
def record_game(
    self,
    chat_id: int,
    user_id: int,
    won: bool,
    speed: float
):
    self.get_or_create_user(user_id)
    with self._get_connection() as conn:
        conn.execute("""
            INSERT INTO game_stats
            (chat_id, user_id, total_games, total_wins,
             correct_answers, best_speed)
            VALUES (?, ?, 1, ?, ?, ?)
            ON CONFLICT(chat_id, user_id)
            DO UPDATE SET
                total_games=total_games+1,
                total_wins=total_wins+excluded.total_wins,
                correct_answers=
                    correct_answers+excluded.correct_answers,
                best_speed=
                    CASE
                        WHEN game_stats.best_speed=0
                        THEN excluded.best_speed
                        WHEN excluded.best_speed < game_stats.best_speed
                        THEN excluded.best_speed
                        ELSE game_stats.best_speed
                    END
        """, (
            chat_id,
            user_id,
            int(won),
            int(won),
            speed
        ))
        conn.commit()

============================================================

main.py

============================================================

import os
import logging
import asyncio

from dotenv import load_dotenv
from telethon import TelegramClient, events

from database import DatabaseManager, RANKS_HIERARCHY

load_dotenv()

API_ID = int(os.getenv(“API_ID”, “0”))
API_HASH = os.getenv(“API_HASH”, “”)
BOT_TOKEN = os.getenv(“BOT_TOKEN”, “”)

if not API_ID or not API_HASH or not BOT_TOKEN:
raise RuntimeError(
“ضع API_ID و API_HASH و BOT_TOKEN في متغيرات البيئة.”
)

logging.basicConfig(
level=logging.INFO,
format=”%(asctime)s | %(levelname)s | %(message)s”
)

logger = logging.getLogger(“EIF”)

db = DatabaseManager(“bot_database.db”)

client = TelegramClient(
“eif_bot_session”,
API_ID,
API_HASH
)

def get_rank(event):
return db.get_user_rank(
event.chat_id,
event.sender_id
)

def rank_value(rank):
return RANKS_HIERARCHY.get(rank, 0)

def is_dev(event):
return db.get_global_rank(event.sender_id) == “Dev🎖️”

def can_manage(event, target_id):
if event.sender_id == target_id:
return False

actor_rank = get_rank(event)
target_rank = db.get_user_rank(
    event.chat_id,
    target_id
)
return rank_value(actor_rank) > rank_value(target_rank)

async def ensure_user(event):
try:
sender = await event.get_sender()

    username = getattr(sender, "username", None)
    first_name = getattr(sender, "first_name", None)
    db.get_or_create_user(
        event.sender_id,
        username,
        first_name
    )
    if not event.is_group:
        db.set_private_user(event.sender_id)
except Exception as e:
    logger.error("ensure_user: %s", e)

============================================================

أوامر عامة

============================================================

@client.on(events.NewMessage)
async def user_registration(event):
await ensure_user(event)

@client.on(events.NewMessage(pattern=r”^فلوسي$”))
async def my_money(event):
balance = db.get_user_balance(event.sender_id)

await event.reply(
    f"فلوسك: {balance:g} ريال"
)

@client.on(events.NewMessage(pattern=r”^فلوسه$”))
async def his_money(event):
if not event.is_reply:
await event.reply(“يجب أن يكون الأمر ردًا على المستخدم.”)
return

reply = await event.get_reply_message()
if not reply or not reply.sender_id:
    await event.reply("تعذر تحديد المستخدم.")
    return
balance = db.get_user_balance(reply.sender_id)
await event.reply(
    f"فلوسه: {balance:g} ريال"
)

@client.on(events.NewMessage(pattern=r”^انشاء حساب بنكي$”))
async def create_bank(event):
account = db.get_bank_account(event.sender_id)

if account and account["active"]:
    await event.reply("لديك حساب بنكي فعال بالفعل.")
    return
banks = [
    "الراجحي",
    "الأهلي",
    "البنك الثالث"
]
bank = banks[event.sender_id % len(banks)]
account = db.create_bank_account(
    event.sender_id,
    bank
)
await event.reply(
    "تم إنشاء حسابك البنكي.\n"
    f"البنك: {account['bank_name']}\n"
    f"رقم الحساب: {account['account_number']}\n"
    f"الرصيد: {db.get_user_balance(event.sender_id):g} ريال"
)

@client.on(events.NewMessage(pattern=r”^حسابي$”))
async def my_bank(event):
account = db.get_bank_account(event.sender_id)

if not account or not account["active"]:
    await event.reply(
        "ليس لديك حساب بنكي فعال.\n"
        "اكتب: انشاء حساب بنكي"
    )
    return
balance = db.get_user_balance(event.sender_id)
await event.reply(
    f"البنك: {account['bank_name']}\n"
    f"رقم الحساب: {account['account_number']}\n"
    f"الرصيد: {balance:g} ريال"
)

@client.on(events.NewMessage(pattern=r”^حذف حسابي$”))
async def delete_bank(event):
account = db.get_bank_account(event.sender_id)

if not account or not account["active"]:
    await event.reply("لا يوجد لديك حساب بنكي فعال.")
    return
db.delete_bank_account(event.sender_id)
await event.reply(
    "تم تعطيل حسابك البنكي.\n"
    "رصيدك وبياناتك لم يتم حذفها."
)

@client.on(events.NewMessage(pattern=r”^اهداء\s+([0-9]+(?:.[0-9]+)?)$”))
async def gift_money(event):
if not event.is_reply:
await event.reply(“يجب أن يكون الأمر ردًا على المستخدم.”)
return

amount = float(event.pattern_match.group(1))
if amount <= 0:
    await event.reply("المبلغ يجب أن يكون أكبر من صفر.")
    return
reply = await event.get_reply_message()
if not reply or not reply.sender_id:
    await event.reply("تعذر تحديد المستخدم.")
    return
if reply.sender_id == event.sender_id:
    await event.reply("لا يمكنك إهداء نفسك.")
    return
if db.transfer_balance(
    event.sender_id,
    reply.sender_id,
    amount
):
    await event.reply(
        f"تم إهداء {amount:g} ريال بنجاح."
    )
else:
    await event.reply(
        "تعذر تنفيذ العملية. "
        "تأكد من أن رصيدك يكفي."
    )

============================================================

الرتب

============================================================

PROMOTION_COMMANDS = {
“رفع مميز”: “مميز”,
“رفع مالك”: “مالك”,
“رفع اساس”: “مالك أساسي”,
“رفع M”: “Myth”,
“رفع My”: “Myth🎖️”,
“رفع اكس”: “Dev²🎖️”,
“رفع مطور ثانوي”: “Dev²🎖️”,
“رفع ديف”: “Dev🎖️”,
}

DEMOTION_COMMANDS = {
“تنزيل مميز”: “مميز”,
“تنزيل مالك”: “مالك”,
“تنزيل اساس”: “مالك أساسي”,
“تنزيل M”: “Myth”,
“تنزيل My”: “Myth🎖️”,
“تنزيل اكس”: “Dev²🎖️”,
“تنزيل مطور ثانوي”: “Dev²🎖️”,
“تنزيل ديف”: “Dev🎖️”,
}

async def get_target_from_reply(event):
if not event.is_reply:
return None

message = await event.get_reply_message()
if not message or not message.sender_id:
    return None
return message.sender_id

@client.on(events.NewMessage(
pattern=r”^(رفع مميز|رفع مالك|رفع اساس|رفع M|رفع My|رفع اكس|رفع مطور ثانوي|رفع ديف)$”
))
async def promote(event):
if not event.is_group:
return

target_id = await get_target_from_reply(event)
if not target_id:
    await event.reply(
        "يجب أن يكون الأمر ردًا على العضو."
    )
    return
target_rank = PROMOTION_COMMANDS[event.raw_text.strip()]
actor_rank = get_rank(event)
if target_id == event.sender_id:
    await event.reply(
        "لا يمكنك رفع رتبتك بنفسك."
    )
    return
if target_rank == "Dev🎖️":
    if not is_dev(event):
        await event.reply(
            "هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
        )
        return
    db.set_global_rank(
        target_id,
        "Dev🎖️"
    )
else:
    if rank_value(actor_rank) <= rank_value(target_rank):
        await event.reply(
            "لا تملك رتبة كافية لتنفيذ هذا الأمر."
        )
        return
    if not can_manage(event, target_id):
        await event.reply(
            "لا يمكنك تعديل رتبة هذا المستخدم."
        )
        return
    db.set_group_rank(
        event.chat_id,
        target_id,
        target_rank
    )
await event.reply(
    f"تم رفع رتبة المستخدم إلى {target_rank}."
)

@client.on(events.NewMessage(
pattern=r”^(تنزيل مميز|تنزيل مالك|تنزيل اساس|تنزيل M|تنزيل My|تنزيل اكس|تنزيل مطور ثانوي|تنزيل ديف)$”
))
async def demote(event):
if not event.is_group:
return

target_id = await get_target_from_reply(event)
if not target_id:
    await event.reply(
        "يجب أن يكون الأمر ردًا على العضو."
    )
    return
requested_rank = DEMOTION_COMMANDS[event.raw_text.strip()]
actor_rank = get_rank(event)
target_rank = db.get_user_rank(
    event.chat_id,
    target_id
)
if target_id == event.sender_id:
    await event.reply(
        "لا يمكنك تنزيل رتبتك بنفسك."
    )
    return
if rank_value(actor_rank) <= rank_value(target_rank):
    await event.reply(
        "لا يمكنك تنزيل رتبة مستخدم مساوية أو أعلى منك."
    )
    return
if requested_rank == "Dev🎖️":
    if not is_dev(event):
        await event.reply(
            "هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
        )
        return
    db.remove_global_rank(target_id)
else:
    if target_rank != requested_rank:
        await event.reply(
            "رتبة المستخدم الحالية لا تطابق الرتبة المطلوبة للتنزيل."
        )
        return
    db.remove_group_rank(
        event.chat_id,
        target_id
    )
await event.reply(
    "تم تنزيل رتبة المستخدم بنجاح."
)

@client.on(events.NewMessage(pattern=r”^قائمة المطورين$”))
async def developers_list(event):
if not event.is_group:
return

developers = db.get_all_global_devs()
if not developers:
    await event.reply(
        "لا يوجد مطورون مسجلون."
    )
    return
lines = ["قائمة المطورين:"]
for user in developers:
    name = user["first_name"] or "بدون اسم"
    username = (
        f"@{user['username']}"
        if user["username"]
        else "بدون يوزر"
    )
    lines.append(
        f"{name} | {username} | {user['user_id']}"
    )
await event.reply("\n".join(lines))

@client.on(events.NewMessage(pattern=r”^مسح المطورين$”))
async def clear_developers(event):
if not event.is_group:
return

if not is_dev(event):
    await event.reply(
        "هذا الامر يخص ↤ ｢ Dev🎖️ ｣"
    )
    return
developers = db.get_all_global_devs()
for user in developers:
    if user["user_id"] != event.sender_id:
        db.remove_global_rank(
            user["user_id"]
        )
await event.reply(
    "تم مسح المطورين باستثناء منفذ الأمر."
)

============================================================

التفاعل

============================================================

@client.on(events.NewMessage)
async def interaction_counter(event):
if not event.is_group:
return

if not event.sender_id:
    return
text = (event.raw_text or "").strip()
if not text:
    return
excluded = {
    "اوامر",
    "تفاعلي",
    "رتبتي",
    "المتفاعلين",
    "رتبته",
    "تفاعله"
}
if text in excluded:
    return
db.add_interaction(
    event.chat_id,
    event.sender_id,
    1
)

@client.on(events.NewMessage(pattern=r”^تفاعلي$”))
async def my_interaction(event):
if not event.is_group:
return

count = db.get_interaction(
    event.chat_id,
    event.sender_id
)
await event.reply(
    f"تفاعلك في القروب: {count}"
)

@client.on(events.NewMessage(pattern=r”^المتفاعلين$”))
async def top_interactions(event):
if not event.is_group:
return

top = db.top_interactions(
    event.chat_id,
    10
)
if not top:
    await event.reply(
        "لا توجد تفاعلات مسجلة."
    )
    return
lines = ["المتفاعلين:"]
for index, item in enumerate(top, 1):
    lines.append(
        f"{index}. [{item['user_id']}](tg://user?id={item['user_id']})"
        f" — {item['interaction_count']}"
    )
await event.reply(
    "\n".join(lines),
    parse_mode="md"
)

============================================================

تشغيل البوت

============================================================

async def main():
logger.info(“جاري تشغيل بوت ايف…”)
await client.start(
bot_token=BOT_TOKEN
)
logger.info(“بوت ايف يعمل الآن.”)
await client.run_until_disconnected()

if name == “main”:
asyncio.run(main())
