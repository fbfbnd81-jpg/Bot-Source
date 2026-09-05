const { Telegraf, Markup } = require('telegraf');
const http = require('http');
const fs = require('fs');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Torayf Bot is active!');
}).listen(process.env.PORT || 3000);

const bot = new Telegraf('8963407967:AAGFd-z2MsvV0Hj7EkoEEPQOrnFBsXv0qiw');

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
    } catch (e) {}
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    } catch (e) {}
}

function isDev1(userId, username) {
    return (username && username.toLowerCase() === 'j4xa7') || userId.toString() === '123456789';
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

function getUserRole(chatId, userId, username) {
    if (isDev1(userId, username)) return 'Dev🎖️';
    if (db.roles[chatId] && db.roles[chatId][userId]) return db.roles[chatId][userId];
    return 'عضو';
}

const devPanelText = `• أهلًا بك عزيزي في لوحة تحكم المطور
━━━━━━━━━━━━━━━
• أوامر التحكم والتفعيل :
• تحديد عدد الأعضاء + العدد
• تفعيل - تعطيل ↤ الردود العامة
• تفعيل - تعطيل ↤ البنك العام
• تفعيل ↤ التواصل
• تفعيل - تعطيل ↤ الاشتراك الإجباري
• الاشتراك الإجباري
• تعديل الاشتراك الإجباري
• تفعيل ↤ البوت الخدمي
• تفعيل - تعطيل ↤ الإحصائيات
• تفعيل ↤ الزاجل العام
• تفعيل ↤ الصيغ العامة
━━━━━━━━━━━━━━━
• أوامر إدارة الرتب :
• رفع - تنزيل ↤ Dev «المطور الثانوي»
• رفع - تنزيل ↤ MY
• رفع - تنزيل ↤ M
• رفع - تنزيل ↤ المالك الأساسي
• حذف جميع المطورين الثانويين
• حذف قائمة MY
• حذف قائمة M
• حذف قائمة المالكين الأساسيين
• عرض المطورين الثانويين
• عرض قائمة MY
• عرض قائمة M
• عرض المالكين الأساسيين
• تنزيل جميع الرتب
• تغيير المطور الأساسي
━━━━━━━━━━━━━━━
• أوامر الإذاعة :
• إذاعة ↤ للمجموعات
• ذيع + أيدي القروب ↤ بالرد على الرسالة
• إذاعة خاصة
• إذاعة بالتوجيه
• إذاعة خاصة بالتوجيه
• إذاعة مع التثبيت
━━━━━━━━━━━━━━━
• أوامر القيود والحظر :
• حظر عام - إلغاء حظر عام
• قائمة المحظورين عام - مسح القائمة
• كتم عام - إلغاء كتم عام
• قائمة المكتومين عام - مسح القائمة
• رفع القيود عام + المعرف
• منع عام - إلغاء منع عام
• قائمة الممنوعين عام - مسح القائمة
• حظر قروب + الأيدي
• إلغاء حظر قروب + الأيدي
• عرض القروبات المحظورة
• مسح جميع القروبات المحظورة
━━━━━━━━━━━━━━━
• أوامر النسخ الاحتياطي :
• استخراج النسخة الاحتياطية
• استعادة النسخة الاحتياطية ↤ بالرد على الملف
• استخراج نسخة الردود
• استعادة نسخة الردود ↤ بالرد على الملف
• استخراج نسخة الردود العامة
• استعادة نسخة الردود العامة ↤ بالرد على الملف
━━━━━━━━━━━━━━━
• أوامر الألعاب والميزات :
• إضافة لعبة + اسم اللعبة
• إضافة + اسم اللعبة
• حذف لعبة + اسم اللعبة
• قائمة + اسم اللعبة
• حذف سؤال + اسم اللعبة ↤ بالرد
• حذف صورة + اسم اللعبة ↤ بالرد
━━━━━━━━━━━━━━━
• أوامر إدارة الردود :
• إضافة - حذف ↤ رد التواصل
• ردود التواصل - مسح ردود التواصل
• إضافة - حذف ↤ رد عام
• الردود العامة - مسح الردود العامة
• إضافة - حذف ↤ رد متعدد عام
• إضافة - حذف ↤ رد مميز عام
• إضافة - حذف ↤ رد انلاين عام
• إضافة - حذف ↤ رد كيبورد عام
━━━━━━━━━━━━━━━
• أوامر إضافية للمطور :
• تحديث البوت
• تغيير رمز البوت
• تعيين صورة الترحيب
• غادر + أيدي القروب
• معلومات القروب + الأيدي
• تغيير - حذف ↤ اسم البوت
• تعيين - حذف ↤ الأيدي العام
• وضع - حذف ↤ الترحيب العام
• وضع - حذف ↤ كليشة المطور
• عرض الإحصائيات
• وضع - حذف ↤ كليشة الكشف
• مسح - تغيير ↤ يوزر المطور`;

const channelsPanelText = `• أهلًا بك عزيزي في قائمة أوامر القنوات
━━━━━━━━━━━━━━━
• /ربط قناة ↤ ربط البوت بالقناة وتشغيل الخدمات فيها
• /فك ربط قناة ↤ إزالة القناة المرتبطة بالبوت
• تشغيل قناة + الاسم ↤ تشغيل البوت داخل القناة المحددة
• إيقاف قناة + الاسم ↤ إيقاف خدمات البوت بالقناة
• تشغيل + اسم الأغنية ↤ تشغيل المقطع في القناة المرتبطة
• التالي ↤ الانتقال للمقطع التالي
• تخطي ↤ تخطي المقطع الحالي
• إيقاف ↤ إيقاف التشغيل
• استئناف ↤ متابعة التشغيل
• قائمة التشغيل ↤ عرض المقاطع الموجودة في الانتظار
• مسح القائمة ↤ حذف جميع المقاطع المنتظرة
• معلومات القناة ↤ عرض بيانات القناة المرتبطة
━━━━━━━━━━━━━━━
🎛️ أوامر التحكم بالقناة
• تفعيل الردود ↤ السماح للبوت بالرد داخل القناة
• تعطيل الردود ↤ إيقاف ردود البوت
• تفعيل الحماية ↤ تشغيل حماية القناة
• تعطيل الحماية ↤ إيقاف الحماية
• تثبيت ↤ تثبيت الرسالة المحددة
• حذف ↤ حذف الرسالة المحددة
━━━━━━━━━━━━━━━
🔗 أوامر الربط
• ربط + أيدي القناة ↤ ربط قناة معينة بالبوت
• القناة المرتبطة ↤ معرفة القناة المتصلة
• تغيير القناة + الأيدي ↤ استبدال القناة الحالية
• فك الربط ↤ فصل القناة عن البوت`;

const gamesPanelText = `━━━━━━━━━━━━━━━
• لعبة ↤ عرض الألعاب المتاحة
• العاب ↤ قائمة الألعاب
• لعبة + الاسم ↤ بدء اللعبة المطلوبة
• إلغاء اللعبة ↤ إنهاء اللعبة الحالية
• المتصدرين ↤ عرض أصحاب أعلى النقاط
• نقاطي ↤ عرض نقاطك
• ترتيبي ↤ عرض ترتيبك بين الأعضاء
• تحدي + العضو ↤ تحدي عضو آخر
• فائزين ↤ عرض الفائزين الأخيرين
━━━━━━━━━━━━━━━
قسم الفعاليات
━━━━━━━━━━━━━━━
• فعالية ↤ عرض الفعاليات المتاحة
• ابدأ فعالية ↤ بدء فعالية عشوائية
• فعالية + الاسم ↤ تشغيل فعالية معينة
• إيقاف الفعالية ↤ إنهاء الفعالية
• المشاركين ↤ عرض المشاركين
• نتائج الفعالية ↤ عرض النتائج
• سجل الفعاليات ↤ آخر الفعاليات والفائزين
━━━━━━━━━━━━━━━
قسم التسلية
━━━━━━━━━━━━━━━
• تسلية ↤ فعالية تسلية عشوائية
• حظ ↤ نسبة حظ عشوائية
• نسبة الحب ↤ نسبة عشوائية بين شخصين
• صراحة ↤ سؤال صراحة
• تحدي ↤ تحدي عشوائي
• سؤال ↤ سؤال عشوائي
• لغز ↤ لغز عشوائي
• نكتة ↤ نكتة عشوائية
• معلومة ↤ معلومة عشوائية
• حكمة ↤ حكمة عشوائية
• ماذا لو ↤ سؤال ماذا لو
• اختار ↤ اختيار عشوائي بين خيارين
• قرعة ↤ اختيار عضو عشوائي
• رقم ↤ رقم عشوائي
━━━━━━━━━━━━━━━
قسم النقاط والجوائز
━━━━━━━━━━━━━━━
• نقاط ↤ عرض نقاطك
• نقاط + العضو ↤ عرض نقاط عضو
• المتصدرين ↤ قائمة أعلى الأعضاء
• جمع ↤ الحصول على نقاط يومية
• هدية ↤ إرسال نقاط لعضو
• مكافأتي ↤ المكافأة اليومية
• سحب ↤ سحب عشوائي على جائزة
• مسابقة ↤ إنشاء مسابقة للأعضاء`;

const membersPanelText = `━━━━━━━━━━━━━━━
قسم الأعضاء
━━━━━━━━━━━━━━━
• الأعضاء ↤ عرض قائمة أعضاء القروب
• العضو + الاسم ↤ عرض معلومات العضو
• معلوماتي ↤ عرض معلوماتك
• ايدي ↤ عرض إيديك
• ايدي + العضو ↤ عرض إيدي العضو
• منشن ↤ عمل منشن للعضو
• منشن + العضو ↤ منشن عضو معين
• رتبتي ↤ عرض رتبتك
• نقاطي ↤ عرض نقاطك
• تفاعلي ↤ مستوى تفاعلك
• رسائلي ↤ عدد رسائلك
• انضمامي ↤ تاريخ انضمامك
• الرتبة ↤ رتب الأعضاء
• قائمة الرتب ↤ جميع رتب القروب`;

const adminPanelText = `━━━━━━━━━━━━━━━
قسم الإدارة
━━━━━━━━━━━━━━━
• المشرفين ↤ عرض قائمة المشرفين
• معلومات القروب ↤ عرض معلومات القروب
• الأعضاء ↤ عرض أعضاء القروب
• رفع + العضو ↤ رفع عضو للإدارة
• تنزيل + العضو ↤ تنزيل رتبة الإدارة
• طرد + العضو ↤ طرد عضو من القروب
• حظر + العضو ↤ حظر عضو من القروب
• فك حظر + العضو ↤ فك حظر عضو
• كتم + العضو ↤ كتم عضو
• فك الكتم + العضو ↤ فك كتم عضو
• تقييد + العضو ↤ تقييد عضو
• فك التقييد + العضو ↤ إزالة التقييد
• تحذير + العضو ↤ إعطاء تحذير للعضو
• تحذيرات + العضو ↤ عرض تحذيرات العضو
• حذف ↤ حذف الرسالة المحددة
• حذف + عدد ↤ حذف عدد من الرسائل
• تثبيت ↤ تثبيت الرسالة
• إلغاء التثبيت ↤ إلغاء تثبيت الرسالة
• قفل ↤ قفل القروب
• فتح ↤ فتح القروب
• وضعية ↤ عرض وضعية القروب
• تصفير ↤ تصفير تحذيرات العضو
• تنظيف ↤ تنظيف الرسائل
• إخفاء ↤ إخفاء الرسالة المحددة
• إلغاء الإخفاء ↤ إظهار الرسالة`;

const protectionPanelText = `━━━━━━━━━━━━━━━
قسم الحماية
━━━━━━━━━━━━━━━
• الحماية ↤ عرض إعدادات الحماية
• حماية ↤ تفعيل الحماية
• تعطيل الحماية ↤ تعطيل الحماية
• الروابط ↤ تشغيل أو إيقاف منع الروابط
• التكرار ↤ تشغيل أو إيقاف منع التكرار
• الإعلانات ↤ تشغيل أو إيقاف منع الإعلانات
• الكلمات ↤ تشغيل أو إيقاف الكلمات الممنوعة
• التعديل ↤ منع تعديل الرسائل
• الوسائط ↤ منع أو السماح بالوسائط
• الصور ↤ منع أو السماح بالصور
• الفيديو ↤ منع أو السماح بالفيديو
• الملفات ↤ منع أو السماح بالملفات
• الملصقات ↤ منع أو السماح بالملصقات
• التاغ ↤ منع المنشنات المزعجة
• البوتات ↤ منع إضافة البوتات
• السبام ↤ الحماية من الرسائل المزعجة
• القائمة السوداء ↤ عرض الأعضاء والكلمات المحظورة
• إضافة ممنوع + الكلمة ↤ إضافة كلمة للقائمة الممنوعة
• حذف ممنوع + الكلمة ↤ إزالة كلمة من القائمة الممنوعة
• استثناء + العضو ↤ استثناء عضو من الحماية
• إلغاء الاستثناء + العضو ↤ إزالة الاستثناء
• سجل الحماية ↤ عرض آخر إجراءات الحماية`;

bot.start(async (ctx) => {
    if (ctx.chat.type === 'private') {
        const botInfo = await ctx.telegram.getMe();
        return ctx.reply('• أهلًا بك يا مطورنا في لوحة الأوامر الشفافة 🛠️', {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '• أوامر التفاعل والأعضاء', callback_data: 'cmd_members' },
                        { text: '• أوامر الحماية والتسلية', callback_data: 'cmd_protection' }
                    ],
                    [
                        { text: '• أوامر الرفع والربط', callback_data: 'cmd_channels' },
                        { text: '• أوامر الميديا والبحث والألعاب', callback_data: 'cmd_games' }
                    ],
                    [
                        { text: '• أوامر لوحة المطور', callback_data: 'cmd_dev' },
                        { text: '• أوامر الإدارة', callback_data: 'cmd_admin' }
                    ],
                    [
                        { text: 'إغلاق اللوحة ❌', callback_data: 'hide_message' }
                    ]
                ]
            }
        });
    }
});

bot.action('cmd_dev', async (ctx) => {
    try {
        const userId = ctx.from.id.toString();
        const username = ctx.from.username || '';
        const role = getUserRole(ctx.chat.id, userId, username);
        if (getHierarchyLevel(role) < 7 && !isDev1(userId, username)) {
            return ctx.answerCbQuery('• هذا الامر يخص ↤ ｢ Dev🎖️ ｣ فقط', { show_alert: true });
        }
        await ctx.editMessageText(devPanelText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'إخفاء الامر ❌', callback_data: 'hide_message' }]
                ]
            }
        });
    } catch (e) {}
});

bot.action('cmd_channels', async (ctx) => {
    try {
        await ctx.editMessageText(channelsPanelText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'إخفاء الامر ❌', callback_data: 'hide_message' }]
                ]
            }
        });
    } catch (e) {}
});

bot.action('cmd_games', async (ctx) => {
    try {
        await ctx.editMessageText(gamesPanelText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'إخفاء الامر ❌', callback_data: 'hide_message' }]
                ]
            }
        });
    } catch (e) {}
});

bot.action('cmd_members', async (ctx) => {
    try {
        await ctx.editMessageText(membersPanelText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'إخفاء الامر ❌', callback_data: 'hide_message' }]
                ]
            }
        });
    } catch (e) {}
});

bot.action('cmd_admin', async (ctx) => {
    try {
        await ctx.editMessageText(adminPanelText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'إخفاء الامر ❌', callback_data: 'hide_message' }]
                ]
            }
        });
    } catch (e) {}
});

bot.action('cmd_protection', async (ctx) => {
    try {
        await ctx.editMessageText(protectionPanelText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'إخفاء الامر ❌', callback_data: 'hide_message' }]
                ]
            }
        });
    } catch (e) {}
});

bot.action('hide_message', async (ctx) => {
    try { 
        await ctx.deleteMessage(); 
    } catch(e) {}
});

bot.on('message', async (ctx) => {
    try {
        if (!ctx.chat) return;
        const chatId = ctx.chat.id.toString();
        const text = (ctx.message.text || ctx.message.caption || '').trim();

        if (text === 'الأوامر' || text === 'اوامر') {
            return ctx.reply('• أهلًا بك يا مطورنا في لوحة الأوامر الشفافة 🛠️', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '• أوامر التفاعل والأعضاء', callback_data: 'cmd_members' },
                            { text: '• أوامر الحماية والتسلية', callback_data: 'cmd_protection' }
                        ],
                        [
                            { text: '• أوامر الرفع والربط', callback_data: 'cmd_channels' },
                            { text: '• أوامر الميديا والبحث والألعاب', callback_data: 'cmd_games' }
                        ],
                        [
                            { text: '• أوامر لوحة المطور', callback_data: 'cmd_dev' },
                            { text: '• أوامر الإدارة', callback_data: 'cmd_admin' }
                        ],
                        [
                            { text: 'إغلاق اللوحة ❌', callback_data: 'hide_message' }
                        ]
                    ]
                }
            });
        }
    } catch (e) {}
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
