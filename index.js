require('dotenv').config();
const {
    Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, Events, MessageFlags
} = require('discord.js');
const axios = require('axios');
const cron = require('node-cron');

// ================== [ الإعدادات ] ==================
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; // ⚠️ لازم يتحط في ملف .env
const COMMAND_CHANNEL_ID = '';
const LOG_CHANNEL_ID = '';
const GALLERY_IMG_BASE = 'https://mapgallery.realitymod.org/images/maps';
const GALLERY_JSON_BASE = 'https://mapgallery.realitymod.org/json';
const DEMO_URL = 'https://alliance-community.com/servers/primary/prdemos/';
// =======================================================

const client = new Client({
    // الأزرار والقوايم مش محتاجة قراءة رسايل السيرفر، فشلنا GuildMessages و MessageContent عشان البوت ميستقبلش كل رسالة في السيرفر
    intents: [GatewayIntentBits.Guilds],
});

let latestMapsHistory = {};
let latestSkirmishHistory = {}; // Skirmish له سجل منفصل تماماً عن AAS/INS
let latestVehiclesHistory = {}; // Vehicle Warfare برضه له سجل منفصل
let latestGungameHistory = {};  // Gungame كمان
let lastUpdateTime = "Waiting for Sync...";

process.on('unhandledRejection', error => console.error('SYSTEM ERROR:', error));
process.on('uncaughtException', error => console.error('CRITICAL ERROR:', error));

// --- [ MAP DATABASE ] ---
const MAP_DATABASE = {
    '1k_ins': {
        'Standard': ['Fallujah West', 'Gaza', 'Grostok', 'Korengal Valley']
    },
    '2k_ins': {
        'Standard': ['albasrah', 'Assault on Grozny', 'Dragon Fly', 'Iron Ridge', 'Karbala', 'Kokan', 'Kozelsk', 'Lashkar Valley', 'Musa Qala - BETA', 'Zakho - BETA', 'Operation Marlin', 'Outpost', 'Ramiel', 'Ras el masri', 'Sbeneh Outskirts', 'Shahadah', 'Talbisah', 'Kafr Halab']
    },
    '4k_ins': {
        'Standard': ['Bamyan', 'Kunar Province - BETA', 'Road to Damascus - BETA']
    },
    '1k_aas': {
        'Standard': ['Asad Khal', 'Assault on Mestia', 'Grostok', 'Hill 488', 'Korengal Valley', 'Merville', 'Reichswald', 'Tad Sae Offensive']
    },
    '2k_aas': {
        'Urban/Non-Forest': ['Operation Marlin', 'Operation Falcon', 'Beirut', 'Muttrah City', 'Shahadah', 'Zakho - BETA', 'Ras el Masri', 'donbas', 'Assault on Grozny', 'Talbisah', 'Stalingrad', 'Stalingrad Summer', 'Sbeneh Outskirts', 'Outpost', 'Kafr Halab'],
        'Forest/Woodland': ['Fools Road', 'Brecourt Assault', 'Battle of Ia Drang', 'Battle of Debrecen', 'Nuijamaa', 'Krivaja Valley', 'Dovre', 'Dovre Winter', 'Kozelsk', 'Route E-106', 'Sahel', 'Rzhev', 'Ulyanovsk', 'Charlies Point', 'Iron Ridge', 'Goose Green', 'Operation Brunswick', 'Carentan', 'Operation Barracuda', 'Omaha Beach', 'Dragon Fly']
    },
    '4k_aas': {
        'Forest/Woodland': ['Belyaevo', 'Battle of Kerch', 'Operation Thunder - BETA', 'Pavlovsk Bay', 'Vadso City', 'Silent Eagle', 'Saaremaa', 'Xiangshan', 'Yamalia', 'Wanda Shan', 'shijiavalley', 'Operation Soul Rebel', 'Icebreaker', 'Korbach Offensive - BETA', 'Ascheberg', 'Adak - BETA', 'Operation Bobcat', 'Vung Ro', 'Fields of Kassel', 'Hades Peak'],
        'Desert/Arid': ['Bamyan', 'Kashan Desert', 'Masirah', 'Khamisiyah', 'Kunar Province - BETA', 'Burning Sands', 'Road to Damascus - BETA', 'Black Gold']
    },
    'vehicle_warfare': {
        'All Maps': ['Black Gold', 'Dragon Fly', 'Fields of Kassel', 'Icebreaker', 'Kashan Desert', 'Khamisiyah', 'Korbach Offensive - BETA', 'Operation Soul Rebel', 'Road to Damascus - BETA', 'Sbeneh Outskirts', 'Shijia Valley', 'Silent Eagle', 'The Falklands', 'Wanda Shan', 'Xiangshan', 'Yamalia']
    },
    'gungame': {
        'All Maps': ['Al Basrah', 'Asad Khal', 'Black Gold', 'Deagle5', 'Donbas', 'Dovre', 'Shipment', 'Stalingrad Summer', 'Wanda Shan']
    },
    'skirmish': {
        'All Maps': ['Adak - BETA', 'Al Basrah', 'Asad Khal', 'Assault on Grozny', 'Assault on Mestia', 'Bamyan', 'Battle of Ia Drang', 'Beirut', 'Belyaevo', 'Black Gold', 'Brecourt Assault', 'Burning Sands', 'Carentan', 'Charlies Point', 'Donbas', 'Dovre', 'Dovre Winter', 'Dragon Fly', 'Fallujah West', 'Fields of Kassel', 'Fools Road', 'Gaza', 'Goose Green', 'Grostok', 'Hades Peak', 'Hill 488', 'Icebreaker', 'Iron Ridge', 'Kafr Halab', 'Karbala', 'Kashan Desert', 'Khamisiyah', 'Kokan', 'Korbach Offensive - BETA', 'Korengal Valley', 'Kozelsk', 'Krivaja Valley', 'Lashkar Valley', 'Masirah', 'Merville', 'Musa Qala - BETA', 'Muttrah City', 'Nuijamaa', 'Omaha Beach', 'Operation Barracuda', 'Operation Bobcat', 'Operation Falcon', 'Operation Marlin', 'Operation Soul Rebel', 'Operation Thunder - BETA', 'Outpost', 'Pavlovsk Bay', 'Ramiel', 'Ras el Masri', 'Reichswald', 'Road to Damascus - BETA', 'Route E-106', 'Saaremaa', 'Sahel', 'Sbeneh Outskirts', 'Shahadah', 'Shijia Valley', 'Silent Eagle', 'Stalingrad', 'Tad Sae Offensive', 'Talbisah', 'The Falklands', 'Ulyanovsk', 'Vadso City', 'Vung Ro', 'Wanda Shan', 'Xiangshan', 'Yamalia', 'Zakho - BETA']
    }
};

// --- [ HELPERS ] ---
// --- [ UTC DATE HELPERS ] ---
function utcDayStart(d) {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function daysSince(lastDate, now) {
    return Math.floor((utcDayStart(now) - utcDayStart(lastDate)) / (1000 * 60 * 60 * 24));
}
function formatUTCDate(d) {
    // نفس شكل toDateString القديم: "Sat Sep 26 2026" (من غير فواصل، والسنة/اليوم بـ UTC)
    const s = d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' });
    return s.replace(/,/g, '');
}

// --- [ CHECK LAYER HELPERS ] ---
const LAYER_MODES = {
    aas: { code: 'gpm_cq', label: 'AAS' },
    ins: { code: 'gpm_insurgency', label: 'INS' },
    skirmish: { code: 'gpm_skirmish', label: 'Skirmish' },
    vw: { code: 'gpm_vehicles', label: 'Vehicle Warfare' },
    gungame: { code: 'gpm_gungame', label: 'Gungame' }
};
const MODE_ALIASES = { aas: 'aas', ins: 'ins', skirmish: 'skirmish', skir: 'skirmish', skm: 'skirmish', vw: 'vw', vehicles: 'vw', vehicle: 'vw', veh: 'vw', gungame: 'gungame', gg: 'gungame', gun: 'gungame' };
const LAYER_SIZES = [
    { size: '16', label: 'Infantry' },
    { size: '32', label: 'Alternative' },
    { size: '64', label: 'Standard' },
    { size: '128', label: 'Large' }
];
const layerCache = new Map(); // key: slug|mode -> [{size,label,url}]

const normName = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

// كل أسماء المابات من كل الفئات، من غير تكرار (albasrah و Al Basrah نفس الماب)
function allMapNames() {
    const byKey = new Map();
    Object.values(MAP_DATABASE).forEach(cat => Object.values(cat).forEach(list => list.forEach(n => {
        const k = normMapKey(n);
        const cur = byKey.get(k);
        if (!cur || (!/\s/.test(cur) && /\s/.test(n))) byKey.set(k, n); // نفضل الاسم اللي فيه مسافات
    })));
    return [...byKey.values()];
}

let knownNamesCache = null;
function knownMapKeys() {
    if (!knownNamesCache) knownNamesCache = new Set(allMapNames().map(normMapKey));
    return knownNamesCache;
}

// يدور على الماب بأول 3 حروف أو أكتر (بيتجاهل Operation / Battle of)
function matchMapNames(query) {
    const q = normName(query.replace(/operation\s+|battle of\s+/gi, ''));
    if (q.length < 3) return [];
    const names = allMapNames();
    const stripped = n => normName(n.replace(/operation\s+|battle of\s+/gi, ''));
    // الاسم الكامل بالظبط له الأولوية (dovre مش بتتلخبط مع dovre winter)
    const exact = names.filter(n => stripped(n) === q || normName(n) === q);
    if (exact.length) return exact;
    const starts = names.filter(n => stripped(n).startsWith(q) || normName(n).startsWith(q));
    if (starts.length) return starts;
    return names.filter(n => stripped(n).includes(q) || normName(n).includes(q));
}

// أشكال اسم المجلد المحتملة على الموقع
function slugCandidates(name) {
    const noBeta = name.replace(/\s*-\s*beta/i, '');
    const forms = [name, noBeta].flatMap(n => [
        n.toLowerCase().replace(/[^a-z0-9]+/g, ''),
        n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    ]);
    return [...new Set(forms)];
}

async function imageExists(url) {
    try {
        const r = await axios.head(url, { timeout: 8000, validateStatus: () => true, headers: { 'User-Agent': 'Mozilla/5.0' } });
        return r.status === 200 && String(r.headers['content-type'] || '').startsWith('image');
    } catch { return false; }
}

async function findLayerImages(mapName, modeKey) {
    const mode = LAYER_MODES[modeKey];
    for (const slug of slugCandidates(mapName)) {
        const cacheKey = `${slug}|${mode.code}`;
        if (layerCache.has(cacheKey)) {
            const cached = layerCache.get(cacheKey);
            if (cached.length) return cached;
            continue;
        }
        const checks = await Promise.all(LAYER_SIZES.map(async l => {
            const url = `${GALLERY_IMG_BASE}/${slug}/mapoverview_${mode.code}_${l.size}.jpg`;
            return (await imageExists(url)) ? { ...l, url, slug } : null;
        }));
        const found = checks.filter(Boolean);
        layerCache.set(cacheKey, found);
        if (found.length) return found;
    }
    return [];
}

// --- [ LAYER ASSETS (vehicles per team) ] ---
let vehiclesCache = null;
const layoutCache = new Map();

async function getJson(url) {
    try {
        const r = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    } catch (e) {
        console.error(`[LAYER] JSON fetch failed: ${url} (${e.message})`);
        return null;
    }
}

async function getVehicles() {
    if (vehiclesCache) return vehiclesCache;
    const list = await getJson(`${GALLERY_JSON_BASE}/vehicles.json`);
    if (!Array.isArray(list)) return null;
    vehiclesCache = {};
    list.forEach(v => { vehiclesCache[v.Key] = v; });
    return vehiclesCache;
}

async function getLayout(slug, modeCode, size) {
    const key = `${slug}|${modeCode}|${size}`;
    if (layoutCache.has(key)) return layoutCache.get(key);
    const data = await getJson(`${GALLERY_JSON_BASE}/${slug}/${modeCode}_${size}.json`);
    if (data && Array.isArray(data.Assets)) layoutCache.set(key, data);
    return data && Array.isArray(data.Assets) ? data : null;
}

// ترتيب الأصول زي الموقع: طيارات > هليكوبتر > دبابات > APC > ...
function iconRank(icon = '') {
    const ranks = { mini_jet_: 11, mini_ahe_: 10, mini_the_: 9, mini_tank_: 8, mini_apc_: 7, mini_rec_: 6, mini_adv_: 5, mini_trk_: 4, mini_jep_: 3, mini_civ_: 2 };
    const prefix = Object.keys(ranks).find(p => icon.startsWith(p));
    return prefix ? ranks[prefix] : 0;
}

function formatAssets(assets, team, vehicles) {
    const groups = new Map();
    for (const a of assets) {
        if (a.Team !== team) continue;
        const v = vehicles[a.Key];
        if (!v) continue;
        const key = `${v.Name.toLowerCase()}|${a.InitialDelay}|${a.RespawnDelay}`;
        const g = groups.get(key);
        if (g) g.qty++; else groups.set(key, { v, a, qty: 1 });
    }
    const lines = [...groups.values()]
        .sort((x, y) => iconRank(y.v.Icon) - iconRank(x.v.Icon))
        .map(({ v, a, qty }) => {
            const parts = [];
            if (a.InitialDelay) parts.push(`Delay ${Math.round(a.InitialDelay / 60)}m`);
            parts.push(a.RespawnDelay > 9000 ? 'No Respawn' : `Respawn ${Math.round(a.RespawnDelay / 60)}m`);
            return `**${qty}x** ${v.Name} — ${parts.join(' · ')}`;
        });
    if (!lines.length) return 'No assets in this layout.';
    let text = lines.join('\n');
    if (text.length > 1024) {
        text = text.slice(0, 1000);
        text = text.slice(0, text.lastIndexOf('\n')) + '\n…';
    }
    return text;
}

async function buildLayerEmbed(mapName, mode, layer, vehicles) {
    const embed = new EmbedBuilder().setColor('#1044ad')
        .setTitle(`${mapName.toUpperCase()} — ${mode.label} ${layer.label}`)
        .setImage(layer.url);
    const layout = vehicles ? await getLayout(layer.slug, mode.code, layer.size) : null;
    if (layout) {
        for (let t = 0; t < 2; t++) {
            const team = layout.Team && layout.Team[t];
            embed.addFields({
                name: team ? `${team.Name} — ${team.Tickets} tickets` : `Team ${t + 1}`,
                value: formatAssets(layout.Assets, t, vehicles)
            });
        }
    }
    return embed;
}

// بيدور على الماب في السجل. الاسم المطابق تماماً له الأولوية، عشان Dovre ميتلخبطش مع Dovre Winter
// و Stalingrad مع Stalingrad Summer.
function normMapKey(s) {
    return s.toLowerCase().replace(/kafar/g, 'kafr').replace(/\s*-\s*beta\b/g, '')
        .replace(/operation\s+|battle of\s+/g, '').replace(/[^a-z0-9]+/g, '');
}

function findMapInHistory(inputName, history = latestMapsHistory) {
    if (!inputName || typeof history !== 'object') return null;
    const input = normMapKey(inputName);
    if (!input) return null;
    const keys = Object.keys(history);

    const exact = keys.find(k => normMapKey(k) === input);
    if (exact) return exact;

    const candidates = keys.filter(k => { const h = normMapKey(k); return h.includes(input) || input.includes(h); });
    const knownNames = knownMapKeys();
    // بحث جزئي (مثلاً kri): أول نتيجة. اسم كامل من القايمة: نتجاهل المابات التانية المعروفة
    return knownNames.has(input) ? candidates.find(k => !knownNames.has(normMapKey(k))) : candidates[0];
}

// مسح واحد بس في نفس الوقت (الـ cron والزرار والتشغيل كانوا بيشتغلوا مع بعض)، ومحاولة تانية لو فشل
let fetchInFlight = null;
function fetchMapsData() {
    if (!fetchInFlight) {
        fetchInFlight = (async () => {
            let ok = await fetchMapsDataOnce();
            if (!ok) {
                await new Promise(r => setTimeout(r, 5000));
                ok = await fetchMapsDataOnce();
            }
            return ok;
        })().finally(() => { fetchInFlight = null; });
    }
    return fetchInFlight;
}

async function fetchMapsDataOnce() {
    console.log('⏳ [INTEL] Scanning demo server for map history...');
    try {
        const response = await axios.get(DEMO_URL, { timeout: 30000 });
        const files = Array.isArray(response.data) ? response.data : [];
        const fileNames = files
            .filter(f => !f.is_dir && typeof f.name === 'string' && f.name.includes('.PRdemo'))
            .map(f => f.name);

        let tempLatest = {};
        let tempSkirmish = {};
        let tempVehicles = {};
        let tempGungame = {};

        fileNames.forEach(fileName => {
            // نتأكد إن الملف بيبدأ بـ tracker
            if (!fileName.startsWith('tracker_')) return;

            const nameLower = fileName.toLowerCase();
            // AAS (cq) و INS في سجل واحد، و Skirmish في سجل منفصل، وأي مود تاني بيتجاهل
            const isAAS = nameLower.includes('_gpm_cq_');
            const isINS = nameLower.includes('_gpm_insurgency_') || nameLower.includes('_gpm_ins_');
            const isSKM = nameLower.includes('_gpm_skirmish_');
            const isVW = nameLower.includes('_gpm_vehicles_');
            const isGG = nameLower.includes('_gpm_gungame_');

            if (isAAS || isINS || isSKM || isVW || isGG) {
                const parts = fileName.replace('.PRdemo', '').split('_');

                // الصيغة المتوقعة: tracker_YYYY_MM_DD_HH_MM_SS_mapname...
                if (parts.length >= 8) {
                    // سحب التاريخ بالكامل (عشان حساب الساعات يكون دقيق 100%)
                    const dateObj = new Date(Date.UTC(
                        parseInt(parts[1]),      // السنة
                        parseInt(parts[2]) - 1,  // الشهر (بيبدأ من 0)
                        parseInt(parts[3]),      // اليوم
                        parseInt(parts[4]),      // الساعة
                        parseInt(parts[5]),      // الدقيقة
                        parseInt(parts[6])       // الثانية
                    ));

                    // استخراج اسم المابة وتنظيفه من المودات والمقاسات
                    let mapNameRaw = parts.slice(7).join(' ').toLowerCase();
                    let mapName = mapNameRaw
                        .replace(/\b(aas|ins|gpm|cq|insurgency|skirmish|vehicles|gungame|std|alt|lrg|16|32|64|128|vw|cnc)\b/g, '')
                        .replace(/_/g, ' ')
                        .trim();

                    // التحديث لأحدث تاريخ اتلعبت فيه المابة (بغض النظر عن كانت AAS ولا INS)
                    const target = isSKM ? tempSkirmish : isVW ? tempVehicles : isGG ? tempGungame : tempLatest;
                    if (mapName && (!target[mapName] || dateObj > target[mapName])) {
                        target[mapName] = dateObj;
                    }
                }
            }
        });

        latestMapsHistory = tempLatest;
        latestSkirmishHistory = tempSkirmish;
        latestVehiclesHistory = tempVehicles;
        latestGungameHistory = tempGungame;
        lastUpdateTime = new Date().toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true }) + ' UTC';
        console.log(`✅ [INTEL] Sync Complete at ${lastUpdateTime}`);
        return true;
    } catch (e) {
        console.error('❌ Scraper Error:', e.message);
        return false;
    }
}

// ============================================================
// ============================================================
// بناء تقرير السكان مباشرة من الكود (من غير AI)
// ============================================================
function buildScanReport(category, organizedData) {
    const subCatEmojis = {
        'Urban/Non-Forest': '🏢',
        'Forest/Woodland': '🌲',
        'Desert/Arid': '🏜️'
    };

    let report = `## ${category.replace('_', ' ').toUpperCase()}\n\n`;

    for (const [subCat, maps] of Object.entries(organizedData)) {
        const icon = subCatEmojis[subCat] || '🗺️';
        const accepted = maps.filter(m => m.ready).sort((a, b) => b.daysAgo - a.daysAgo);
        const rejected = maps.filter(m => !m.ready).sort((a, b) => b.daysAgo - a.daysAgo);

        report += `### ${icon} ${subCat}\n`;
        report += `✅ **ACCEPTED MAPS** (oldest first)\n`;
        report += accepted.length
            ? accepted.map(m => `• **${m.name}** — Last Played: ${m.lastPlayed}`).join('\n')
            : `• None available.`;

        report += `\n\n❌ **REJECTED MAPS** (played within the last 3 days)\n`;
        report += rejected.length
            ? rejected.map(m => `• **${m.name}** — Last Played: ${m.lastPlayed}`).join('\n')
            : `• None.`;

        report += `\n\n---\n`;
    }

    let bestSubCat = null, bestCount = -1;
    for (const [subCat, maps] of Object.entries(organizedData)) {
        const count = maps.filter(m => m.ready).length;
        if (count > bestCount) { bestCount = count; bestSubCat = subCat; }
    }
    // ملخص "أكتر مجموعة فيها مابات" مالوش لازمة لو في مجموعة واحدة بس
    if (Object.keys(organizedData).length > 1) {
        report += bestSubCat
            ? `**Most maps available:** ${bestSubCat} (${bestCount} accepted)`
            : `No maps currently available.`;
    }

    return report;
}

// Discord بيحدد الـ embed بـ 4096 حرف والرسالة بـ 6000. قايمة Skirmish طويلة فبنقسمها على أكتر من embed/رسالة
function splitText(text, max = 4000) {
    const chunks = [];
    let cur = '';
    for (const line of text.split('\n')) {
        if (cur && (cur.length + 1 + line.length) > max) { chunks.push(cur); cur = line; }
        else cur = cur ? `${cur}\n${line}` : line;
    }
    if (cur) chunks.push(cur);
    return chunks;
}

function buildReportMessages(briefing, title) {
    const messages = [];
    let group = [], len = 0;
    splitText(briefing).forEach((chunk, i) => {
        if (group.length && len + chunk.length > 5500) { messages.push(group); group = []; len = 0; }
        const e = new EmbedBuilder().setColor('#1044ad').setDescription(chunk);
        if (i === 0 && title) e.setTitle(title);
        group.push(e);
        len += chunk.length;
    });
    if (group.length) messages.push(group);
    return messages;
}

function createPanelEmbed() {
    return new EmbedBuilder()
        .setColor('#1044ad')
        .setTitle('Alliance Map Assistant')
        .setDescription(
            '**About:** This bot scans our [tracker rounds](https://alliance-community.com/servers/primary/prdemos/) for `AAS`, `INS`, `Skirmish`, `Vehicle Warfare` and `Gungame` rounds, and ensures a 3 day cooldown for maps played within the last 3 days.\n' +
            '`AAS` and `INS` share one history, while `Skirmish`, `Vehicle Warfare` and `Gungame` each have their own, so only their own rounds count. Expect `CNC` soon, it is currently being developed.\n\n' +
            '**How to use?**\n\n' +
            'Before everything you must click on **Refresh Database** on each mapvote or on every new round.\n\n' +
            'Press on the inverted arrow or ↓ and select which maps you wanna do, make sure that you have read the [Mapvote Guide](https://discord.com/channels/1310371617632817186/1512841785926221955).\n\n' +
            'You can simply check for specific maps using the `History Search` button. Note you don\'t need to type the full map name, type at least 3 letters of the map eg: `kri` `uly` `nui` ....etc.\n\n' +
            '**Check Layer:** type the map name and the mode (`aas` `ins` `skirmish` `vw` `gungame`) eg: `mutt aas` `falk vw` `dea gungame`, to see all its layers with tickets and vehicles.\n\n' +
            'All times are in **UTC**.'
        )
        .setFooter({ text: `Last Sync: ${lastUpdateTime}` });
}

function createPanelComponents() {
    const selectMenu = new StringSelectMenuBuilder().setCustomId('suggest_menu').setPlaceholder('Select a category')
        .addOptions(
            { label: '1k INS', value: '1k_ins' },
            { label: '2k INS', value: '2k_ins' },
            { label: '4k INS', value: '4k_ins' },
            { label: '1k AAS', value: '1k_aas' },
            { label: '2k AAS', value: '2k_aas' },
            { label: '4k AAS', value: '4k_aas' },
            { label: 'Skirmish', value: 'skirmish' },
            { label: 'Vehicle Warfare', value: 'vehicle_warfare' },
            { label: 'Gungame', value: 'gungame' }
        );
    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('open_search_modal').setLabel('🔍 History Search').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('open_layer_modal').setLabel('🗺️ Check Layer').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('refresh_data').setLabel('🔄 Refresh Database').setStyle(ButtonStyle.Primary)
    );
    return [new ActionRowBuilder().addComponents(selectMenu), buttons];
}

// --- [ BOT EVENTS ] ---
// بيعدّل الـ panel الموجودة بدل ما يبعت واحدة جديدة مع كل restart
async function upsertPanel(channel) {
    try {
        const recent = await channel.messages.fetch({ limit: 25 });
        const mine = recent.find(m => m.author.id === client.user.id && m.components.length > 0 && m.embeds[0]?.title === 'Alliance Map Assistant');
        if (mine) return await mine.edit({ embeds: [createPanelEmbed()], components: createPanelComponents() });
    } catch (e) { console.error('Panel lookup failed:', e.message); }
    return await channel.send({ embeds: [createPanelEmbed()], components: createPanelComponents() });
}

client.once(Events.ClientReady, async (c) => {
    console.log(`🚀 System Online: ${c.user.tag}`);
    const channel = client.channels.cache.get(COMMAND_CHANNEL_ID);
    // الـ panel تظهر فوراً، والمسح بيشتغل في الخلفية وبعدين الـ footer بيتحدث
    let panelMsg = null;
    if (channel) panelMsg = await upsertPanel(channel).catch(e => { console.error('Panel error:', e.message); return null; });
    const ok = await fetchMapsData();
    if (ok && panelMsg) await panelMsg.edit({ embeds: [createPanelEmbed()] }).catch(() => { });
});

cron.schedule('*/30 * * * *', fetchMapsData);

client.on('interactionCreate', async (interaction) => {
    const logChan = client.channels.cache.get(LOG_CHANNEL_ID);
    const now = new Date();

    const userName = interaction.user.globalName || interaction.user.username;
    const userAvatar = interaction.user.displayAvatarURL({ dynamic: true });

    try {
        if (interaction.isStringSelectMenu() && interaction.customId === 'suggest_menu') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const cid = interaction.values[0];
            const categories = MAP_DATABASE[cid] || {};
            const history = { skirmish: latestSkirmishHistory, vehicle_warfare: latestVehiclesHistory, gungame: latestGungameHistory }[cid] || latestMapsHistory;

            let organizedData = {};

            for (const [subCat, maps] of Object.entries(categories)) {
                organizedData[subCat] = [];

                maps.forEach(n => {
                    const key = findMapInHistory(n, history);
                    const lastDate = key ? history[key] : null;

                    // نحسب الفرق بالتقويم (أيام كاملة) مش بالساعة بالظبط
                    // ده بيطابق طريقة الأدمن وهو بيبص على الموقع: يوم/شهر بس، من غير التوقيت
                    const daysAgo = lastDate ? daysSince(lastDate, now) : 9999;

                    organizedData[subCat].push({
                        name: n.toUpperCase(),
                        lastPlayed: lastDate ? `\`${formatUTCDate(lastDate)}\`` : "`Never Played`",
                        daysAgo,
                        ready: daysAgo >= 3
                    });
                });

                organizedData[subCat].sort((a, b) => b.daysAgo - a.daysAgo);
            }

            const briefing = buildScanReport(cid, organizedData);
            const messages = buildReportMessages(briefing, 'Alliance Map Assistant');
            await interaction.editReply({ embeds: messages[0] });
            for (const m of messages.slice(1)) {
                await interaction.followUp({ embeds: m, flags: MessageFlags.Ephemeral });
            }

            if (logChan) {
                const logMsgs = buildReportMessages(briefing, 'Alliance Map Assistant — Category Check');
                logMsgs[0][0].setAuthor({ name: userName, iconURL: userAvatar });
                const lastGroup = logMsgs[logMsgs.length - 1];
                lastGroup[lastGroup.length - 1].setTimestamp();
                for (const m of logMsgs) await logChan.send({ embeds: m }).catch(() => { });
            }
        }

        if (interaction.isButton() && interaction.customId === 'refresh_data') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const success = await fetchMapsData();
            if (success) {
                await interaction.editReply("✅ Database synchronized.");
                await interaction.message.edit({ embeds: [createPanelEmbed()] });
            } else { await interaction.editReply("❌ Sync failed."); }
        }

        if (interaction.isButton() && interaction.customId === 'open_search_modal') {
            const modal = new ModalBuilder().setCustomId('search_modal').setTitle('Search Map Records');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('maps_input').setLabel("Enter Map Names").setStyle(TextInputStyle.Paragraph).setRequired(true)));
            await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && interaction.customId === 'search_modal') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const input = interaction.fields.getTextInputValue('maps_input');
            const queries = input.split(/[, ]+/).filter(q => q.length > 2);
            let resEmbed = new EmbedBuilder().setTitle('Alliance Map Assistant — Search Results').setColor('#1044ad');
            let logData = "";

            queries.forEach(q => {
                const key = findMapInHistory(q);
                if (key && latestMapsHistory[key]) {
                    const lastDate = latestMapsHistory[key];
                    const date = formatUTCDate(lastDate);
                    const days = daysSince(lastDate, now);
                    resEmbed.addFields({ name: `✅ ${key.toUpperCase()}`, value: `Last: \`${date}\` (${days}d ago)` });
                    logData += `✅ **${key.toUpperCase()}**: \`${date}\` (${days}d ago)\n`;
                } else {
                    resEmbed.addFields({ name: `❌ ${q.toUpperCase()}`, value: `Not found.` });
                    logData += `❌ **${q.toUpperCase()}**: Not found\n`;
                }
            });

            await interaction.editReply({ embeds: [resEmbed] });

            if (logChan) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('Alliance Map Assistant — Search Results')
                    .setColor('#1044ad')
                    .setAuthor({ name: userName, iconURL: userAvatar })
                    .setDescription(`**Input:** \`${input}\`\n\n**Results:**\n${logData}`)
                    .setTimestamp();
                await logChan.send({ embeds: [logEmbed] }).catch(() => { });
            }
        }

        if (interaction.isButton() && interaction.customId === 'open_layer_modal') {
            const modal = new ModalBuilder().setCustomId('layer_modal').setTitle('Check Layer');
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('layer_input').setLabel('Map name + mode (aas/ins/skirmish/vw/gungame)')
                    .setPlaceholder('e.g. mutt aas   or   falk vw   or   dea gungame').setStyle(TextInputStyle.Short).setRequired(true)
            ));
            await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && interaction.customId === 'layer_modal') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const input = interaction.fields.getTextInputValue('layer_input').trim();
            const tokens = input.replace(/\bvehicle\s+warfare\b/i, 'vw').split(/\s+/);
            const modeKey = tokens.length > 1 ? MODE_ALIASES[tokens[tokens.length - 1].toLowerCase()] : undefined;
            const query = tokens.slice(0, -1).join(' ');

            if (!modeKey) {
                return await interaction.editReply('❌ Add the mode at the end: `aas`, `ins`, `skirmish`, `vw` or `gungame`.\nExample: `mutt aas`');
            }
            const matches = matchMapNames(query);
            console.log(`[LAYER] input="${input}" query="${query}" mode=${modeKey} matches=${JSON.stringify(matches)}`);
            if (!matches.length) {
                return await interaction.editReply(`❌ No map found for \`${query}\`. Type at least 3 letters of the map name.`);
            }
            if (matches.length > 1) {
                return await interaction.editReply(`⚠️ Be more specific, \`${query}\` matches: ${matches.slice(0, 8).map(m => `**${m}**`).join(', ')}`);
            }

            const mapName = matches[0];
            const mode = LAYER_MODES[modeKey];
            const layers = await findLayerImages(mapName, modeKey);
            console.log(`[LAYER] ${mapName} ${mode.label} -> ${layers.length} layer(s) found`);

            if (!layers.length) {
                return await interaction.editReply(`❌ No ${mode.label} layer images found for **${mapName}**.`);
            }

            // رسالة منفصلة لكل layer (حد Discord 6000 حرف للرسالة الواحدة)
            const vehicles = await getVehicles();
            const embeds = await Promise.all(layers.map(l => buildLayerEmbed(mapName, mode, l, vehicles)));
            await interaction.editReply({ embeds: [embeds[0]] });
            for (const e of embeds.slice(1)) {
                await interaction.followUp({ embeds: [e], flags: MessageFlags.Ephemeral });
            }

            if (logChan) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('Alliance Map Assistant — Check Layer')
                    .setColor('#1044ad')
                    .setAuthor({ name: userName, iconURL: userAvatar })
                    .setDescription(`**Input:** \`${input}\`\n**Result:** ${mapName.toUpperCase()} — ${mode.label} (${layers.map(l => l.label).join(', ')})`)
                    .setTimestamp();
                await logChan.send({ embeds: [logEmbed] }).catch(() => { });
            }
        }
    } catch (error) {
        if (error.code === 10062) {
            console.warn('⚠️ Interaction expired (bot was too slow to answer within 3s).');
            return;
        }
        console.error("Interaction Error:", error);
        try {
            if (interaction.deferred || interaction.replied) await interaction.editReply('❌ Something went wrong, please try again.');
        } catch { }
    }
});


client.login(DISCORD_TOKEN);