const { Telegraf } = require('telegraf');
const fs = require('fs');

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('Error: BOT_TOKEN is missing.');
  process.exit(1);
}

// نظام قاعدة بيانات محلية وهمية باستخدام ملف JSON
const DB_FILE = './database.json';

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading DB:', e);
  }
  return {};
}

function saveDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error saving DB:', e);
  }
}

const bot = new Telegraf(token);

bot.start((ctx) => {
  const db = loadDB();
  const userId = ctx.from.id.toString();

  if (!db[userId]) {
    db[userId] = { balance: 100, rank: 'مميز' };
    saveDB(db);
  }

  ctx.reply(`أهلاً بك في البوت بالذاكرة المحلية! 🎖️\nرتبتك: ${db[userId].rank}\nرصيدك: ${db[userId].balance} نقطة.`);
});

bot.command('balance', (ctx) => {
  const db = loadDB();
  const userId = ctx.from.id.toString();
  const user = db[userId] || { balance: 0 };
  
  ctx.reply(`رصيدك الحالي: ${user.balance} نقطة 💰`);
});

bot.launch().then(() => {
  console.log('Bot with local memory is running successfully!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
