/**
 * Telegram Bot - Complete Implementation complying with all rules:
 * ADD ONLY — DO NOT DELETE — DO NOT REPLACE — DO NOT FORGET.
 * Full Node.js Telegram Bot Implementation (using Telegraf or standard compatible structure).
 */

const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

// Initialize Bot Token (Placeholder / Environment variable configuration)
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const bot = new Telegraf(BOT_TOKEN);

// Database configuration and persistence
const DB_FILE = path.join(__dirname, 'database.json');

let db = {
    users: {},
    groups: {},
    global_admins: {},
    broadcast_subscribers: [],
    custom_commands: {},
    custom_replies: {},
    blacklisted_words: {},
    warnings: {},
    games_state: {},
    bank: {},
    economy: {},
    whispers: {},
    music_queues: {},
    marriage: {},
    bot_settings: {
        active: true,
        protection: true,
        auto_protection: true,
        links_block: true,
        edit_block: true,
        spam_block: true,
        ads_block: true,
        mention_block: true,
        forward_block: true,
        alarms: true,
        auto_mute: true,
        auto_ban: true,
        account_protection: true,
        bot_protection: true,
        new_account_protection: true,
        violations_lock: false,
        responses: true,
        bank_system: true,
        communication: true,
        forced_subscription: false,
        forced_subscription_channel: '',
        service_bot: true,
        statistics: true,
        zajel: true,
        formats: true,
        developer_mode: false,
        member_count_target: 0,
        log_channel: '',
        subscription_channel: ''
    },
    logs: []
};

// Load Database safely
function loadDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            const parsed = JSON.parse(data);
            db = { ...db, ...parsed };
        } else {
            saveDatabase();
        }
    } catch (e) {
        console.error('Error loading database:', e);
    }
}

// Save Database safely
function saveDatabase() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving database:', e);
    }
}

loadDatabase();

// Ranks Hierarchy Definition
const RANKS = {
    "عضو": 0,
    "مميز": 1,
    "مالك": 2,
    "مالك أساسي": 3,
    "Myth": 4,
    "Myth🎖️": 5,
    "Dev²🎖️": 6,
    "Dev🎖️": 7
};

// Helper: Get user rank value
function getUserRank(userId, chatId) {
    if (db.global_admins && db.global_admins[userId]) {
        return db.global_admins[userId]; // Can be Dev🎖️ (7) or Dev²🎖️ (6)
    }
    if (db.groups[chatId] && db.groups[chatId].ranks && db.groups[chatId].ranks[userId]) {
        return RANKS[db.groups[chatId].ranks[userId]] || 0;
    }
    return 0;
}

function getUserRankName(userId, chatId) {
    if (db.global_admins && db.global_admins[userId]) {
        return db.global_admins[userId];
    }
    if (db.groups[chatId] && db.groups[chatId].ranks && db.groups[chatId].ranks[userId]) {
        return db.groups[chatId].ranks[userId];
    }
    return "عضو";
}
