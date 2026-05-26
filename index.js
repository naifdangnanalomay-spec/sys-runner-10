const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    EmbedBuilder,
    Events,
    REST,
    Routes,
    Collection,
    ChannelType
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildEmojisAndStickers
    ],
    partials: ['MESSAGE', 'CHANNEL', 'REACTION']
});

// ⚠️ HUWAG ILAGAY ANG TOKEN DITO. ILALAGAY SA HOSTING ENVIRONMENT
const TOKEN = process.env.TOKEN || '';
const CLIENT_ID = '1508602818901053460'; // <-- KUNIN SA DISCORD DEVELOPER PORTAL

// ==============================================
// 🛡️ AZURA SECURITY CONFIGURATION & DATABASE
// ==============================================
// Database na nakatago sa memory (ligtas at mabilis)
const DB = {
    ownerId: '1250654354344775703', // <-- ILAGAY ANG DISCORD ID MO
    logs: {
        security: null,
        autodelete: null,
        picture: null,
        all: null
    },
    toggles: {
        antiBot: true,
        antiWebhook: true,
        antiCreateChannel: true,
        antiKick: true,
        antiBan: true,
        antiTimeout: true,
        antiSpam: true,
        antiGiveAdmin: true,
        antiGiveDangerous: true,
        antiLink: true,
        antiDeleteRole: true,
        antiUpdateRole: true,
        antiUpdateServer: true,
        antiNuke: true,
        antiRaid: true,
        antiMassMention: true,
        antiGhostPing: true,
        antiImageGrabber: true,
        autoDeleteKeywords: true
    },
    punishments: {
        type: 'ban', // options: timeout, kick, ban
        duration: 3600000 // 1 oras timeout kung yun ang napili
    },
    limits: {
        channelCreate: 2, // Max na channel na pwedeng gawin sa loob ng 10s
        roleDelete: 1,
        roleUpdate: 1,
        messagePerSec: 4,
        maxMentions: 5
    },
    keywords: [],
    whitelist: new Set(),
    userData: new Map(),
    actionLogs: new Map()
};

// ==============================================
// 📜 SLASH COMMANDS DEFINITION
// ==============================================
const commands = [
    // SETLOGS COMMANDS
    {
        name: 'setlogs',
        description: 'Itakda ang channel para sa mga logs',
        options: [
            {
                name: 'uri',
                type: 3,
                description: 'Uri ng log',
                required: true,
                choices: [
                    { name: 'Security Logs', value: 'security' },
                    { name: 'Auto-Delete & Anti-Link', value: 'autodelete' },
                    { name: 'Anti-Image Logs', value: 'picture' },
                    { name: 'Lahat ng Pangyayari', value: 'all' }
                ]
            },
            { name: 'channel', type: 7, description: 'Channel na paglalagyan', required: true }
        ]
    },
    // TOGGLE COMMANDS
    {
        name: 'toggle',
        description: 'Buksan o isara ang mga proteksyon',
        options: [
            {
                name: 'feature',
                type: 3,
                description: 'Piliin ang proteksyon',
                required: true,
                choices: [
                    { name: 'Anti-Bot', value: 'antiBot' },
                    { name: 'Anti-Webhook', value: 'antiWebhook' },
                    { name: 'Anti-Create Channel', value: 'antiCreateChannel' },
                    { name: 'Anti-Kick Members', value: 'antiKick' },
                    { name: 'Anti-Ban Members', value: 'antiBan' },
                    { name: 'Anti-Timeout', value: 'antiTimeout' },
                    { name: 'Anti-Spam', value: 'antiSpam' },
                    { name: 'Anti-Give Admin', value: 'antiGiveAdmin' },
                    { name: 'Anti-Give Dangerous Perms', value: 'antiGiveDangerous' },
                    { name: 'Anti-Link / Advertise', value: 'antiLink' },
                    { name: 'Auto-Delete Keywords', value: 'autoDeleteKeywords' },
                    { name: 'Anti-Image Grabber', value: 'antiImageGrabber' },
                    { name: 'Anti-Delete Role', value: 'antiDeleteRole' },
                    { name: 'Anti-Update Role', value: 'antiUpdateRole' },
                    { name: 'Anti-Update Server', value: 'antiUpdateServer' },
                    { name: 'Anti-Nuke (Mass Delete)', value: 'antiNuke' },
                    { name: 'Anti-Raid (New Accounts)', value: 'antiRaid' },
                    { name: 'Anti-Mention Spam', value: 'antiMassMention' },
                    { name: 'Anti-Ghost Ping', value: 'antiGhostPing' }
                ]
            },
            { name: 'status', type: 3, description: 'On o Off', required: true, choices: [{ name: 'ON', value: 'on' }, { name: 'OFF', value: 'off' }] }
        ]
    },
    // KEYWORDS SYSTEM
    { name: 'addword', description: 'Magdagdag ng salitang ibubura', options: [{ name: 'salita', type: 3, description: 'Ang salita o parirala', required: true }] },
    { name: 'removeword', description: 'Magbura ng salita sa listahan', options: [{ name: 'salita', type: 3, description: 'Ang salita', required: true }] },
    { name: 'listwords', description: 'Ipakita lahat ng mga salitang binabantayan' },
    // WHITELIST SYSTEM
    { name: 'whitelistadd', description: 'Ilagay ang user/role sa ligtas na listahan', options: [{ name: 'target', type: 9, description: 'User o Role ID', required: true }] },
    { name: 'whitelistremove', description: 'Tanggalin sa ligtas na listahan', options: [{ name: 'target', type: 9, description: 'User o Role ID', required: true }] },
    { name: 'whitelistview', description: 'Tingnan ang lahat ng nasa ligtas na listahan' },
    // CONFIG
    {
        name: 'setpunishment',
        description: 'Itakda ang parusa sa lumalabag',
        options: [
            { name: 'type', type: 3, description: 'Uri ng parusa', required: true, choices: [{ name: 'Timeout', value: 'timeout' }, { name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' }] }
        ]
    },
    { name: 'settings', description: 'Ipakita ang kasalukuyang mga setting ng seguridad' },
    { name: 'cmds', description: 'Ipakita ang listahan ng lahat ng utos' }
];

// ==============================================
// 🚀 BOT STARTUP & COMMAND REGISTRATION
// ==============================================
client.on('ready', async () => {
    console.log(`✅✅✅ AZURA ANTI ENEMY ULTRA ACTIVE ✅✅✅`);
    console.log(`🔐 Proteksyon: Anti-Nuke | Anti-Raid | Anti-Admin | Anti-Spam | Anti-Link | Anti-Image`);
    client.user.setActivity(`🛡️ AZURA SECURITY | PROTECTED`, { type: "watching" });

    // Rehistro ng Slash Commands
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.post(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Slash Commands naitala na!');
    } catch (error) {
        console.error('❌ Error sa Commands:', error);
    }
});

// ==============================================
// 🛡️ CORE SECURITY ENGINE (LAHAT NG ANTI FEATURES)
// ==============================================

// 🔴 ANTI RAID / NEW ACCOUNT PROTECTION
client.on(Events.GuildMemberAdd, async (member) => {
    if (!DB.toggles.antiRaid || isWhitelisted(member.id)) return;
    
    const accountAge = Date.now() - member.user.createdTimestamp;
    const daysOld = accountAge / (1000 * 60 * 60 * 24);
    
    if (daysOld < 7) { // Mas mababa sa 7 araw = BAN
        await secureAction(member, 'ANTI-RAID', 'Bagong gawa ang account / Posibleng Atake');
        logEvent('security', `🔴 **ANTI-RAID**\n**User:** ${member.user.tag} (${member.id})\n**Dahilan:** Account edad: ${daysOld.toFixed(1)} araw\n**Aksyon:** Auto-Ban`, '#FF0000');
    }
});

// 🔴 ANTI BOT JOIN
client.on(Events.GuildMemberAdd, async (member) => {
    if (!DB.toggles.antiBot || isWhitelisted(member.id)) return;
    if (member.user.bot) {
        await secureAction(member, 'ANTI-BOT', 'Ipinagbabawal ang pagpasok ng ibang Bot');
        logEvent('security', `🔴 **ANTI-BOT**\n**Bot:** ${member.user.tag}\n**Aksyon:** Auto-Ban`, '#FF0000');
    }
});

// 🔴 ANTI ROLE UPDATE / ANTI GIVE ADMIN / DANGEROUS PERMS
client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
    const auditLogs = await oldRole.guild.fetchAuditLogs({ limit: 1, type: Events.GuildRoleUpdate });
    const executor = auditLogs.entries.first()?.executor;
    if (!executor || isWhitelisted(executor.id)) return;

    // Anti Give Admin
    if (DB.toggles.antiGiveAdmin && newRole.permissions.has(PermissionsBitField.Flags.Administrator) && !oldRole.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await newRole.setPermissions(oldRole.permissions); // IBALIK SA LUMANG PERMISSION
        const member = oldRole.guild.members.cache.get(executor.id);
        if (member) await secureAction(member, 'ANTI-GIVE-ADMIN', 'Sinubukang maglagay ng Administrator sa Role');
        logEvent('security', `🔴 **ANTI-GIVE-ADMIN**\n**User:** ${executor.tag}\n**Role:** ${newRole.name}\n**Aksyon:** Ibinalik ang Perms + Parusa`, '#FF0000');
    }

    // Anti Dangerous Perms (Kick, Ban, Manage Server, Mention Everyone)
    const dangerousPerms = [
        PermissionsBitField.Flags.KickMembers, PermissionsBitField.Flags.BanMembers,
        PermissionsBitField.Flags.ManageGuild, PermissionsBitField.Flags.MentionEveryone
    ];
    if (DB.toggles.antiGiveDangerous && dangerousPerms.some(p => newRole.permissions.has(p) && !oldRole.permissions.has(p))) {
        await newRole.setPermissions(oldRole.permissions);
        const member = oldRole.guild.members.cache.get(executor.id);
        if (member) await secureAction(member, 'ANTI-DANGEROUS-PERMS', 'Sinubukang maglagay ng mapanganib na kapangyarihan');
        logEvent('security', `🔴 **ANTI-DANGEROUS-PERMS**\n**User:** ${executor.tag}\n**Role:** ${newRole.name}\n**Aksyon:** Ibinalik ang Perms + Parusa`, '#FF0000');
    }
});

// 🔴 ANTI ROLE DELETE / ANTI NUKE ROLES
client.on(Events.GuildRoleDelete, async (role) => {
    if (!DB.toggles.antiDeleteRole) return;
    const auditLogs = await role.guild.fetchAuditLogs({ limit: 1, type: Events.GuildRoleDelete });
    const executor = auditLogs.entries.first()?.executor;
    if (!executor || isWhitelisted(executor.id)) return;

    // Count actions for Anti-Nuke
    trackAction(executor.id, 'roleDelete');
    if (DB.actionLogs.get(executor.id).count >= DB.limits.roleDelete && DB.toggles.antiNuke) {
        const member = role.guild.members.cache.get(executor.id);
        if (member) await secureAction(member, 'ANTI-NUKE', 'Maramihang pagbura ng Role / Server Nuke Attempt');
        logEvent('security', `🔴 **ANTI-NUKE (ROLES)**\n**User:** ${executor.tag}\n**Aksyon:** Auto-Ban dahil sa marahas na aksyon`, '#FF0000');
    }
});

// 🔴 ANTI CHANNEL CREATE / DELETE (ANTI NUKE)
client.on(Events.GuildChannelCreate, async (channel) => {
    if (!DB.toggles.antiCreateChannel) return;
    const auditLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: Events.GuildChannelCreate });
    const executor = auditLogs.entries.first()?.executor;
    if (!executor || isWhitelisted(executor.id)) return;

    trackAction(executor.id, 'channelCreate');
    if (DB.actionLogs.get(executor.id).count >= DB.limits.channelCreate && DB.toggles.antiNuke) {
        await channel.delete('Anti-Nuke Protection'); // BURAHIN AGAD ANG GINAWANG CHANNEL
        const member = channel.guild.members.cache.get(executor.id);
        if (member) await secureAction(member, 'ANTI-NUKE', 'Maramihang paggawa ng Channel / Spam Channels');
        logEvent('security', `🔴 **ANTI-NUKE (CHANNELS)**\n**User:** ${executor.tag}\n**Aksyon:** Binura ang channel + Auto-Ban`, '#FF0000');
    }
});

// 🔴 ANTI WEBHOOK CREATE
client.on(Events.WebhookCreate, async (webhook) => {
    if (!DB.toggles.antiWebhook) return;
    const auditLogs = await webhook.guild.fetchAuditLogs({ limit: 1, type: Events.GuildWebhookCreate });
    const executor = auditLogs.entries.first()?.executor;
    if (!executor || isWhitelisted(executor.id)) return;

    await webhook.delete('Anti-Webhook Protection');
    const member = webhook.guild.members.cache.get(executor.id);
    if (member) await secureAction(member, 'ANTI-WEBHOOK', 'Paglikha ng Webhook na ipinagbabawal');
    logEvent('security', `🔴 **ANTI-WEBHOOK**\n**User:** ${executor.tag}\n**Aksyon:** Binura ang Webhook + Parusa`, '#FF0000');
});

// 🔴 ANTI KICK / BAN / TIMEOUT
client.on(Events.GuildMemberKick, async (member) => {
    if (!DB.toggles.antiKick) return;
    const auditLogs = await member.guild.fetchAuditLogs({ limit: 1, type: Events.GuildMemberKick });
    const executor = auditLogs.entries.first()?.executor;
    if (executor && !isWhitelisted(executor.id)) {
        const execMember = member.guild.members.cache.get(executor.id);
        if (execMember) await secureAction(execMember, 'ANTI-KICK', 'Pag-kick ng miyembro nang walang pahintulot');
        logEvent('security', `🔴 **ANTI-KICK**\n**User:** ${executor.tag}\n**Target:** ${member.user.tag}\n**Aksyon:** Parusahan ang nag-kick`, '#FF0000');
    }
});
client.on(Events.GuildMemberBan, async (member) => {
    if (!DB.toggles.antiBan) return;
    const auditLogs = await member.guild.fetchAuditLogs({ limit: 1, type: Events.GuildMemberBan });
    const executor = auditLogs.entries.first()?.executor;
    if (executor && !isWhitelisted(executor.id)) {
        const execMember = member.guild.members.cache.get(executor.id);
        if (execMember) await secureAction(execMember, 'ANTI-BAN', 'Pag-ban ng miyembro nang walang pahintulot');
        logEvent('security', `🔴 **ANTI-BAN**\n**User:** ${executor.tag}\n**Target:** ${member.user.tag}\n**Aksyon:** Parusahan ang nag-ban`, '#FF0000');
    }
});

// ==============================================
// 📨 MESSAGE PROTECTION (ANTI SPAM, LINK, IMAGE, KEYWORDS)
// ==============================================
client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot || isWhitelisted(message.author.id)) return;

    // --- ANTI GHOST PING ---
    if (DB.toggles.antiGhostPing && message.mentions.members.size > 0) {
        setTimeout(async () => {
            if (message.deleted) {
                logEvent('security', `👻 **ANTI-GhostPing**\n**User:** ${message.author.tag}\n**Pinged:** ${message.mentions.members.first()}\n**Aksyon:** Nakatuklas ng binurang pagbanggit`, '#FFFF00');
            }
        }, 1000);
    }

    // --- ANTI MASS MENTION ---
    if (DB.toggles.antiMassMention && message.mentions.members.size > DB.limits.maxMentions) {
        await message.delete().catch(() => {});
        await secureAction(message.member, 'ANTI-MASS-MENTION', `Sumubok magbanggit ng ${message.mentions.members.size} na tao`);
        return logEvent('security', `🔴 **ANTI-MASS-MENTION**\n**User:** ${message.author.tag}\n**Bilang:** ${message.mentions.members.size}\n**Aksyon:** Binura + Parusa`, '#FF0000');
    }

    // --- ANTI SPAM ---
    if (DB.toggles.antiSpam) {
        const user = DB.userData.get(message.author.id) || { count: 0, timer: Date.now() };
        if (Date.now() - user.timer < 2000) { // Bawat 2 segundo
            user.count++;
            if (user.count > DB.limits.messagePerSec) {
                await message.delete().catch(() => {});
                return secureAction(message.member, 'ANTI-SPAM', 'Mabilis at sunod-sunod na pagmemensahe');
            }
        } else { user.count = 0; user.timer = Date.now(); }
        DB.userData.set(message.author.id, user);
    }

    // --- ANTI DISCORD LINK / ADVERT ---
    if (DB.toggles.antiLink) {
        const linkRegex = /(discord\.gg\/|discordapp\.com\/invite\/|https?:\/\/|www\.)/gi;
        if (linkRegex.test(message.content)) {
            await message.delete().catch(() => {});
            logEvent('autodelete', `🔗 **ANTI-LINK**\n**User:** ${message.author.tag}\n**Nilalaman:** ||${message.content}||\n**Aksyon:** Binura`, '#FFA500');
            return;
        }
    }

    // --- AUTO DELETE KEYWORDS ---
    if (DB.toggles.autoDeleteKeywords && DB.keywords.some(word => message.content.toLowerCase().includes(word.toLowerCase()))) {
        await message.delete().catch(() => {});
        logEvent('autodelete', `📝 **KEYWORD DETECTED**\n**User:** ${message.author.tag}\n**Salita:** *(Nakatago)*\n**Aksyon:** Binura`, '#FFA500');
        return;
    }

    // --- ANTI IMAGE GRABBER / MASS IMAGE UPLOAD ---
    if (DB.toggles.antiImageGrabber && message.attachments.size > 3) { // Higit sa 3 litrato
        await message.delete().catch(() => {});
        logEvent('picture', `🖼️ **ANTI-IMAGE-GRABBER**\n**User:** ${message.author.tag}\n**Bilang:** ${message.attachments.size} litrato\n**Aksyon:** Binura ang maramihang upload`, '#00FFFF');
        return;
    }
});

// ==============================================
// ⚙️ SLASH COMMANDS HANDLER
// ==============================================
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options } = interaction;

    // --- /SETLOGS ---
    if (commandName === 'setlogs') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return interaction.reply({ ephemeral: true, content: "❌ Wala kang karapatan." });
        const type = options.getString('uri');
        const channel = options.getChannel('channel');
        DB.logs[type] = channel.id;
        return interaction.reply(`✅ **Logs para sa \`${type}\`** ay nakatakda na sa <#${channel.id}>`);
    }

    // --- /TOGGLE ---
    if (commandName === 'toggle') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ ephemeral: true, content: "❌ Pang-Admin lang ito." });
        const feature = options.getString('feature');
        const status = options.getString('on') === 'on';
        DB.toggles[feature] = status;
        return interaction.reply(`✅ **${feature}** ay nakatakda na sa: **${status ? 'NAKABUKAS ✅' : 'NAKASARA ❌'}**`);
    }

    // --- KEYWORDS ---
    if (commandName === 'addword') {
        const word = options.getString('salita').toLowerCase();
        if(!DB.keywords.includes(word)) DB.keywords.push(word);
        return interaction.reply(`✅ Idinagdag sa listahan: \`${word}\``);
    }
    if (commandName === 'removeword') {
        const word = options.getString('salita').toLowerCase();
        DB.keywords = DB.keywords.filter(w => w !== word);
        return interaction.reply(`✅ Tinanggal sa listahan: \`${word}\``);
    }
    if (commandName === 'listwords') {
        return interaction.reply(`📋 **Mga Binabantayang Salita:**\n${DB.keywords.length > 0 ? DB.keywords.map(w => `\`${w}\``).join(', ') : "Wala pa"}`);
    }

    // --- WHITELIST ---
    if (commandName === 'whitelistadd') {
        const id = options.getString('target');
        DB.whitelist.add(id);
        return interaction.reply(`✅ <@${id}> / \`${id}\` ay nasa **WHITELIST** na (Ligtas).`);
    }
    if (commandName === 'whitelistremove') {
        const id = options.getString('target');
        DB.whitelist.delete(id);
        return interaction.reply(`❌ <@${id}> / \`${id}\` ay tinanggal sa Whitelist.`);
    }
    if (commandName === 'whitelistview') {
        return interaction.reply(`📋 **Whitelist IDs:**\n${Array.from(DB.whitelist).map(i => `\`${i}\``).join('\n') || "Wala pa"}`);
    }

    // --- SETPUNISHMENT ---
    if (commandName === 'setpunishment') {
        const type = options.getString('type');
        DB.punishments.type = type;
        return interaction.reply(`⚖️ **Parusa sa paglabag:** Nakatakda na sa **${type.toUpperCase()}**`);
    }

    // --- SETTINGS ---
    if (commandName === 'settings') {
        const embed = new EmbedBuilder()
            .setTitle("⚙️ AZURA SECURITY - KASALUKUYANG SETTINGS")
            .setColor('#2F3136')
            .addFields(
                { name: "🛡️ Proteksyon", value: Object.entries(DB.toggles).map(([k,v])=>`${v?'✅':'❌'} ${k}`).join('\n'), inline: true },
                { name: "⚖️ Parusa", value: `Uri: ${DB.punishments.type}\nTagal: ${DB.punishments.duration/60000} minuto`, inline: true },
                { name: "📋 Logs Channels", value: Object.entries(DB.logs).map(([k,v])=>`${k}: ${v?'<#'+v+'>':'Wala'}`).join('\n'), inline: true }
            );
        return interaction.reply({ embeds: [embed] });
    }

    // --- CMDS ---
    if (commandName === 'cmds') {
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle("📜 AZURA COMMANDS LIST").setColor('Blue').setDescription(`
**/setlogs [uri] [channel]** - Itakda ang logs
**/toggle [feature] [on/off]** - Buksan/isara proteksyon
**/addword / removeword / listwords** - Pamahalaan ang mga salitang ibubura
**/whitelistadd / remove / view** - Pamahalaan ang ligtas na listahan
**/setpunishment [uri]** - Itakda ang parusa
**/settings** - Tingnan ang konfigurasyon
**/cmds** - Itong listahan
        `)] });
    }
});

// ==============================================
// 🛠️ UTILITY FUNCTIONS (HUWAG BAGUHIN ITO)
// ==============================================
function isWhitelisted(userId) {
    return userId === DB.ownerId || DB.whitelist.has(userId);
}

function trackAction(userId, type) {
    const data = DB.actionLogs.get(userId) || { count: 0, start: Date.now() };
    if (Date.now() - data.start < 10000) { // 10 segundong palugit
        data.count++;
    } else {
        data.count = 1;
        data.start = Date.now();
    }
    DB.actionLogs.set(userId, data);
    setTimeout(() => DB.actionLogs.delete(userId), 10000); // Burahin pagkalipas ng oras
}

async function secureAction(member, reason, detail) {
    try {
        if (DB.punishments.type === 'ban') return await member.ban({ reason: `AZURA SECURITY: ${reason} | ${detail}` });
        if (DB.punishments.type === 'kick') return await member.kick(`AZURA SECURITY: ${reason} | ${detail}`);
        if (DB.punishments.type === 'timeout') return await member.timeout(DB.punishments.duration, `AZURA SECURITY: ${reason} | ${detail}`);
    } catch (e) { console.log("Hindi ma-parusahan:", e) }
}

function logEvent(type, message, color) {
    const channelId = DB.logs[type] || DB.logs.all;
    if (!channelId) return;
    const ch = client.channels.cache.get(channelId);
    if (ch) ch.send({ embeds: [new EmbedBuilder().setDescription(message).setColor(color || '#000000').setTimestamp()] });
}

// ==============================================
// 🛡️ ERROR HANDLING
// ==============================================
client.on('error', () => {});
process.on('unhandledRejection', () => {});
process.on('uncaughtException', () => {});

// ==============================================
// 🚀 CONNECT
// ==============================================
client.login(TOKEN);