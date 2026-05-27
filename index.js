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
const CLIENT_ID = '1508602818901053460'; 

// ==============================================
// 🛡️ AZURA SECURITY CONFIGURATION & DATABASE
// ==============================================
const DB = {
    ownerId: '1250654354344775703',
    // Inilagay na ang iyong Category at Log Channel ID
    categoryID: '1509013646548664390',
    logs: {
        security: '1509015315323945172',
        autodelete: '1509015315323945172',
        picture: '1509015315323945172',
        all: '1509015315323945172' // Lahat ng logs ay papasok dito
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
        type: 'ban',
        duration: 3600000 
    },
    limits: {
        channelCreate: 2,
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
    { name: 'addword', description: 'Magdagdag ng salitang ibubura', options: [{ name: 'salita', type: 3, description: 'Ang salita o parirala', required: true }] },
    { name: 'removeword', description: 'Magbura ng salita sa listahan', options: [{ name: 'salita', type: 3, description: 'Ang salita', required: true }] },
    { name: 'listwords', description: 'Ipakita lahat ng mga salitang binabantayan' },
    { name: 'whitelistadd', description: 'Ilagay ang user/role sa ligtas na listahan', options: [{ name: 'target', type: 9, description: 'User o Role ID', required: true }] },
    { name: 'whitelistremove', description: 'Tanggalin sa ligtas na listahan', options: [{ name: 'target', type: 9, description: 'User o Role ID', required: true }] },
    { name: 'whitelistview', description: 'Tingnan ang lahat ng nasa ligtas na listahan' },
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
    client.user.setActivity(`🛡️ AZURA SECURITY | PROTECTED`, { type: 4 });

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Slash Commands naitala na!');
    } catch (error) {
        console.error('❌ Error sa Commands:', error);
    }
});

// ==============================================
// 🛡️ CORE SECURITY ENGINE
// ==============================================

client.on(Events.GuildMemberAdd, async (member) => {
    if (!DB.toggles.antiRaid || isWhitelisted(member.id)) return;
    const accountAge = Date.now() - member.user.createdTimestamp;
    const daysOld = accountAge / (1000 * 60 * 60 * 24);
    if (daysOld < 7) { 
        await secureAction(member, 'ANTI-RAID', 'Bagong gawa ang account');
        logEvent('security', `🔴 **ANTI-RAID**\n**User:** ${member.user.tag}\n**Aksyon:** Auto-Ban`, '#FF0000');
    }
});

client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
    const auditLogs = await oldRole.guild.fetchAuditLogs({ limit: 1, type: 31 });
    const executor = auditLogs.entries.first()?.executor;
    if (!executor || isWhitelisted(executor.id)) return;

    if (DB.toggles.antiGiveAdmin && newRole.permissions.has(PermissionsBitField.Flags.Administrator) && !oldRole.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await newRole.setPermissions(oldRole.permissions);
        const member = oldRole.guild.members.cache.get(executor.id);
        if (member) await secureAction(member, 'ANTI-GIVE-ADMIN', 'Sinubukang maglagay ng Admin');
        logEvent('security', `🔴 **ANTI-GIVE-ADMIN**\n**User:** ${executor.tag}`, '#FF0000');
    }
});

// (Ang iba pang logic ay nananatiling pareho)
client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot || isWhitelisted(message.author.id)) return;
    if (DB.toggles.antiLink) {
        const linkRegex = /(discord\.gg\/|discordapp\.com\/invite\/|https?:\/\/|www\.)/gi;
        if (linkRegex.test(message.content)) {
            await message.delete().catch(() => {});
            logEvent('autodelete', `🔗 **ANTI-LINK**\n**User:** ${message.author.tag}`, '#FFA500');
        }
    }
});

// ==============================================
// ⚙️ SLASH COMMANDS HANDLER
// ==============================================
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options } = interaction;
    if (commandName === 'setlogs') {
        const type = options.getString('uri');
        const channel = options.getChannel('channel');
        DB.logs[type] = channel.id;
        return interaction.reply(`✅ Logs para sa \`${type}\` ay nakatakda sa <#${channel.id}>`);
    }
    // (Iba pang command handlers...)
});

// ==============================================
// 🛠️ UTILITY FUNCTIONS
// ==============================================
function isWhitelisted(userId) {
    return userId === DB.ownerId || DB.whitelist.has(userId);
}

async function secureAction(member, reason, detail) {
    try {
        if (DB.punishments.type === 'ban') await member.ban({ reason: `AZURA: ${reason}` });
    } catch (e) { console.log("Hindi ma-parusahan:", e) }
}

function logEvent(type, message, color) {
    const channelId = DB.logs[type] || DB.logs.all;
    if (!channelId) return;
    const ch = client.channels.cache.get(channelId);
    if (ch) ch.send({ embeds: [new EmbedBuilder().setDescription(message).setColor(color || '#000000').setTimestamp()] });
}

client.login(TOKEN);
