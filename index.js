const { Telegraf, Markup } = require('telegraf');
const http = require('http');
const fs = require('fs');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Torayf Bot is active!');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf(process.env.BOT_TOKEN);

const DATA_FILE = './toraif_github_database.json';

let db = {
    roles: {},
    stats: {},
    titles: {},
    muted: {},
    globalMuted: {},
    whispers: {},
    pendingWhispers: {},
    pendingReplies: {},
    money: {},
    activeGames: {},
    warnings: {},
    violationsSettings: {},
    marriages: {},
    customCommands: {},
    customReplies: {},
    settings: {}
};

if (fs.existsSync(DATA_FILE)) {
    try {
        const fileData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

        if (fileData.roles) db.roles = fileData.roles;
        if (fileData.stats) db.stats = fileData.stats;
        if (fileData.titles) db.titles = fileData.titles;
        if (fileData.muted) db.muted = fileData.muted;
        if (fileData.globalMuted) db.globalMuted = fileData.globalMuted;
        if (fileData.whispers) db.whispers = fileData.whispers;
        if (fileData.pendingWhispers) db.pendingWhispers = fileData.pendingWhispers;
        if (fileData.pendingReplies) db.pendingReplies = fileData.pendingReplies;
        if (fileData.money) db.money = fileData.money;
        if (fileData.activeGames) db.activeGames = fileData.activeGames;
        if (fileData.warnings) db.warnings = fileData.warnings;
        if (fileData.violationsSettings) db.violationsSettings = fileData.violationsSettings;
        if (fileData.marriages) db.marriages = fileData.marriages;
        if (fileData.customCommands) db.customCommands = fileData.customCommands;
        if (fileData.customReplies) db.customReplies = fileData.customReplies;
        if (fileData.settings) db.settings = fileData.settings;

    } catch (e) {
        console.log('تعذر قراءة قاعدة البيانات');
    }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.log('تعذر حفظ البيانات');
    }
}

function isDev1(userId, username) {
    return (
        (username && username.toLowerCase() === 'j4xa7') ||
        userId.toString() === '123456789'
    );
}

function getHierarchyLevel(role) {
    if (!role) return 0;

    const r = role.trim();

    if (r === 'Dev🎖️') return 7;
    if (r === 'Dev²🎖️') return 6;
    if (r === 'Myth 🎖️') return 5;
    if (r === 'Myth') return 4;
    if (r === 'مالك أساسي') return 3;
    if (r === 'مالك') return 2;
    if (r === 'مميز') return 1;

    return 0;
}

function getRankName(level) {
    switch (level) {
        case 7: return 'Dev🎖️';
        case 6: return 'Dev²🎖️';
        case 5: return 'Myth 🎖️';
        case 4: return 'Myth';
        case 3: return 'مالك أساسي';
        case 2: return 'مالك';
        case 1: return 'مميز';
        default: return 'عضو';
    }
}

function getUserRole(chatId, userId, username) {
    if (isDev1(userId, username)) return 'Dev🎖️';

    if (
        db.roles[chatId] &&
        db.roles[chatId][userId]
    ) {
        return db.roles[chatId][userId];
    }

    return 'عضو';
}

function getUserTitle(chatId, userId) {
    if (
        db.titles &&
        db.titles[chatId] &&
        db.titles[chatId][userId]
    ) {
        return db.titles[chatId][userId];
    }

    return 'ما حط لقب';
}

async function isUserAdminOrHasRole(ctx, chatId, userId, username) {
    if (isDev1(userId, username)) return true;

    const role = getUserRole(chatId, userId, username);

    if (getHierarchyLevel(role) > 0) return true;

    try {
        const member = await ctx.telegram.getChatMember(chatId, userId);

        return (
            member.status === 'administrator' ||
            member.status === 'creator'
        );

    } catch (e) {
        return false;
    }
}

function denyAccess(ctx, rank) {
    return ctx.reply(`• هذا الامر يخص ↤ ｢ ${rank} ｣`);
}


/* =========================
   START
========================= */

bot.start(async (ctx) => {
    try {

        if (ctx.chat.type === 'private') {

            const args = ctx.message.text.split(' ');

            if (args.length > 1) {

                if (args[1].startsWith('start_whisper_')) {

                    const targetId =
                        args[1].replace('start_whisper_', '');

                    if (
                        ctx.from.id.toString() !==
                        targetId.toString()
                    ) {
                        return ctx.reply(
                            'هذا البدء مخصص لشخص آخر.'
                        );
                    }

                    if (!db.pendingWhispers) {
                        db.pendingWhispers = {};
                    }

                    return ctx.reply(
                        '• أرسل الآن الهمسة\n\n• يمكنك إرسال نص أو ملصق أو صورة أو قيف'
                    );
                }


                if (args[1].startsWith('start_reply_')) {

                    const wId =
                        args[1].replace('start_reply_', '');

                    if (
                        !db.whispers ||
                        !db.whispers[wId]
                    ) {
                        return ctx.reply(
                            'انتهت صلاحية هذه الهمسة.'
                        );
                    }

                    const wh = db.whispers[wId];

                    if (
                        ctx.from.id.toString() !==
                        wh.targetId.toString()
                    ) {
                        return ctx.reply(
                            'هذا الرد لا يخصك.'
                        );
                    }

                    if (!db.pendingReplies) {
                        db.pendingReplies = {};
                    }

                    db.pendingReplies[ctx.from.id] = {
                        senderId: wh.senderId,
                        senderName: wh.senderName,
                        chatId: wh.chatId
                    };

                    saveData();

                    return ctx.reply(
                        '• أرسل الآن ردك (يمكنك إرسال نص، صورة، ملصق، قيف):'
                    );
                }
            }
        }

        const botInfo =
            await ctx.telegram.getMe();

        const botUsername =
            botInfo.username;

        const startText =
            `اهلا بك يا قلبي 🫶 - ُ\n\n` +
            `• انا اشغل لك اللي تبي بالمكالمه\n\n` +
            `ادعم هالمنصات كلها : يوتيوب، سبوتيفاي، ريسو، ابل ميوزك وساوند كلاود.`;

        return ctx.reply(startText, {
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: '➕ أضفني في مجموعتك',
                        url:
                            `https://t.me/${botUsername}?startgroup=true`
                    }],
                    [{
                        text: '🎖️ المطور',
                        url:
                            'https://t.me/j4xa7'
                    }]
                ]
            }
        });

    } catch (e) {}
});


/* =========================
   EDITED MESSAGE
========================= */

bot.on('edited_message', async (ctx) => {

    try {

        if (!ctx.chat) return;

        const chatId =
            ctx.chat.id;

        if (
            db.violationsSettings &&
            db.violationsSettings[chatId] === false
        ) return;

        const userId =
            ctx.from
                ? ctx.from.id
                : chatId;

        const username =
            ctx.from &&
            ctx.from.username
                ? ctx.from.username
                : '';

        const name =
            ctx.from &&
            ctx.from.first_name
                ? ctx.from.first_name
                : 'المستخدم';

        const role =
            getUserRole(
                chatId,
                userId,
                username
            );

        if (
            getHierarchyLevel(role) >= 1
        ) return;

        try {
            await ctx.deleteMessage();
        } catch (e) {}

        return ctx.reply(
            `${name}، ممنوع ارسال تعديل الرسائل`,
            {
                reply_to_message_id:
                    ctx.editedMessage.message_id
            }
        ).catch(() => {});

    } catch (e) {}
});


/* =========================
   MAIN MESSAGE SYSTEM
========================= */

bot.on('message', async (ctx) => {

    try {

        if (!ctx.chat) return;

        const chatId =
            ctx.chat.id.toString();

        const userId =
            ctx.from
                ? ctx.from.id.toString()
                : chatId;

        const username =
            ctx.from &&
            ctx.from.username
                ? ctx.from.username
                : '';

        const name =
            ctx.from &&
            ctx.from.first_name
                ? ctx.from.first_name
                : 'المستخدم';

        const role =
            getUserRole(
                chatId,
                userId,
                username
            );

        const userLevel =
            getHierarchyLevel(role);

        const text =
            (
                ctx.message.text ||
                ctx.message.caption ||
                ''
            ).trim();

        const isTheDev1 =
            isDev1(userId, username);


        /* =========================
           PRIVATE
        ========================= */

        if (ctx.chat.type === 'private') {

            if (
                db.pendingWhispers &&
                db.pendingWhispers[userId]
            ) {

                const whInfo =
                    db.pendingWhispers[userId];

                const wId =
                    Date.now().toString() +
                    Math.floor(Math.random() * 1000);

                let contentData = {
                    type: 'text',
                    value: ''
                };

                if (ctx.message.text) {

                    contentData = {
                        type: 'text',
                        value: ctx.message.text
                    };

                } else if (ctx.message.sticker) {

                    contentData = {
                        type: 'sticker',
                        value:
                            ctx.message.sticker.file_id
                    };

                } else if (ctx.message.photo) {

                    contentData = {
                        type: 'photo',
                        value:
                            ctx.message.photo[
                                ctx.message.photo.length - 1
                            ].file_id,
                        caption:
                            ctx.message.caption || ''
                    };

                } else if (ctx.message.animation) {

                    contentData = {
                        type: 'animation',
                        value:
                            ctx.message.animation.file_id,
                        caption:
                            ctx.message.caption || ''
                    };

                } else {

                    return ctx.reply(
                        'نوع المحتوى غير مدعوم. يرجى إرسال نص أو ملصق أو صورة أو قيف.'
                    );
                }

                if (!db.whispers) {
                    db.whispers = {};
                }

                db.whispers[wId] = {

                    senderId: userId,
                    senderName: name,

                    targetId:
                        whInfo.targetId,

                    targetName:
                        whInfo.targetName,

                    chatId:
                        whInfo.chatId,

                    content:
                        contentData,

                    seen: false
                };

                delete db.pendingWhispers[userId];

                saveData();

                const botInfo =
                    await ctx.telegram.getMe();

                await ctx.telegram.sendMessage(
                    whInfo.chatId,

                    `• ياحلو ↤ [${whInfo.targetName}](tg://user?id=${whInfo.targetId})\n\n` +
                    `• وصلتك همسة سرية من ↤ [${name}](tg://user?id=${userId})\n\n` +
                    `• انت وحدك تقدر تشوفها`,

                    {
                        parse_mode: 'Markdown',

                        reply_markup: {
                            inline_keyboard: [

                                [{
                                    text: 'رؤية الهمسه',
                                    callback_data:
                                        `wh_view_${wId}`
                                }],

                                [{
                                    text: 'رد على الهمسه',
                                    url:
                                        `https://t.me/${botInfo.username}?start=start_reply_${wId}`
                                }]

                            ]
                        }
                    }
                );

                return ctx.reply(
                    '• تم ارسال الهمسة'
                );
            }


            if (
                db.pendingReplies &&
                db.pendingReplies[userId]
            ) {

                const repInfo =
                    db.pendingReplies[userId];

                const wId =
                    Date.now().toString() +
                    Math.floor(Math.random() * 1000);

                let contentData = {
                    type: 'text',
                    value: ''
                };

                if (ctx.message.text) {

                    contentData = {
                        type: 'text',
                        value:
                            ctx.message.text
                    };

                } else if (ctx.message.sticker) {

                    contentData = {
                        type: 'sticker',
                        value:
                            ctx.message.sticker.file_id
                    };

                } else if (ctx.message.photo) {

                    contentData = {
                        type: 'photo',
                        value:
                            ctx.message.photo[
                                ctx.message.photo.length - 1
                            ].file_id,

                        caption:
                            ctx.message.caption || ''
                    };

                } else if (ctx.message.animation) {

                    contentData = {
                        type: 'animation',
                        value:
                            ctx.message.animation.file_id,

                        caption:
                            ctx.message.caption || ''
                    };

                } else {

                    return ctx.reply(
                        'نوع المحتوى غير مدعوم للرد.'
                    );
                }

                if (!db.whispers) {
                    db.whispers = {};
                }

                const originalWhisper =
                    Object.values(db.whispers)
                        .find(w =>
                            w.targetId.toString() ===
                            userId.toString() ||
                            w.senderId.toString() ===
                            userId.toString()
                        );

                const targetChatId =
                    repInfo.chatId ||
                    (
                        originalWhisper
                            ? originalWhisper.chatId
                            : null
                    );

                const originalSenderId =
                    originalWhisper
                        ? (
                            originalWhisper.senderId.toString() ===
                            userId.toString()
                                ? originalWhisper.targetId
