const {
    Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, Events, 
    REST, Routes, SlashCommandBuilder, AuditLogEvent
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
        GatewayIntentBits.GuildModeration
    ]
});

// ==============================================
// ⚠️ KONFIGURASYON - PALITAN ANG MGA ID AT LINK DITO
// ==============================================
const TOKEN = process.env.TOKEN || '';
const CLIENT_ID = '1508602818901053460';
const DATA_FILE = path.join(__dirname, 'data.json');

const DB = {
    ownerId: '1250654354344775703', // ✅ Protektado ang Owner
    channels: {
        securityLogs: '1509015315323945172' // ✅ Security logs channel ID
    },
    security: {
        antiNuke: true,          // 🔴 NANANATILING MAHIGPIT (Bawal magbura ng channels)
        AntiTokenSteal: true,    // 🔴 NANANATILING MAHIGPIT (Bawal ang nakaw-admin sa roles)
        antiRaidDetection: true, // 🔴 NANANATILING MAHIGPIT (Bawal ang sabay-sabay na pasok ng raiders)
        antiGiveAdmin: true,     // 🔴 NANANATILING MAHIGPIT (Bawal mag-ninja admin)
        antiSpam: true,          // 🟡 PROTEKTADO SA FLOODING (Mute lang pag subra-sobra ang spam)
        linkProtection: true,    // 🟢 CHILL MODE (Alert log na lang, no delete)
        antiImageGrabber: true   // 🟢 CHILL MODE (Alert log na lang, no delete)
    }
};

const spamMap = new Map();

// --- DATA SAVE/LOAD ---
function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        const data = JSON.parse(fs.readFileSync(DATA_FILE));
        DB.channels = data.channels || DB.channels;
    }
}
function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
        channels: DB.channels
    }, null, 2));
}
loadData();

const commands = [].map(command => command.toJSON());

// --- BOT ONLINE ---
client.on(Events.Ready, async () => {
    console.log(`🛡️  AZURA EASY-GOING PROTECTION ONLINE 🛡️`);
    console.log(`✅ Mode: BALANCED SECURITY (Logs Chat Links, Blocks Server Nukes)`);
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
});

// ==================================================
// 🔐 SECURITY SYSTEM (BALANCED & FRIENDLY)
// ==================================================

// ANTI-GIVE ADMIN (HINDI BINABAGO ANG CHAT PERO BINABANTAYAN ANG ROLES)
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    if (!DB.security.antiGiveAdmin) return;

    const hadAdmin = oldMember.permissions.has(PermissionsBitField.Flags.Administrator);
    const hasAdmin = newMember.permissions.has(PermissionsBitField.Flags.Administrator);

    if (hasAdmin && !hadAdmin) {
        const logs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate });
        const executor = logs.entries.first()?.executor;

        if (!executor || executor.id === DB.ownerId || executor.id === client.user.id) return;

        logSecurity(`🚨 **ANTI-GIVE ADMIN DETECTED**\n**Target:** ${newMember.user.tag}\n**Nagbigay:** ${executor.tag}\n🔒 **Aksyon:** Tinanggal ang Admin role at na-timeout ang nagbigay.`, '#FF0000');

        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        for (const [roleId, role] of addedRoles) {
            if (role.permissions.has(PermissionsBitField.Flags.Administrator)) {
                await newMember.roles.remove(roleId).catch(() => {});
            }
        }

        const staffMember = newMember.guild.members.cache.get(executor.id);
        if (staffMember) {
            await staffMember.timeout(2419200000, 'Azura Security: Ilegal na pagbibigay ng Admin perms').catch(() => {});
            await staffMember.roles.set([]).catch(() => {});
        }
    }
});

// CHAT MONITORING (SPAM CONTROL & LINK LOGGING ONLY)
client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;

    const authorId = message.author.id;
    const now = Date.now();
    const isOwner = authorId === DB.ownerId;

    // 1. ANTI-SPAM SYSTEM (Para lang iwas sa mga naninira ng chat box)
    if (DB.security.antiSpam && !isOwner) {
        if (!spamMap.has(authorId)) {
            spamMap.set(authorId, []);
        }

        const userLog = spamMap.get(authorId);
        userLog.push({ time: now, msgId: message.id, channelId: message.channel.id });

        const recentMessages = userLog.filter(log => now - log.time < 3000);
        spamMap.set(authorId, recentMessages);

        if (recentMessages.length > 5) {
            logSecurity(`⚠️ **ANTI-SPAM TRIGGERED**\n**User:** ${message.author.tag}\n🔒 **Aksyon:** Na-timeout nang 10 min at binura ang spam messages para luminis ang chat.`, '#FFA500');
            await message.member.timeout(600000, 'Azura Security: Chat Spamming').catch(() => {});

            for (const log of recentMessages) {
                const channel = message.guild.channels.cache.get(log.channelId);
                if (channel) channel.messages.delete(log.msgId).catch(() => {});
            }
            spamMap.delete(authorId);
            return;
        }
    }

    if (isOwner) return; // Wag nang i-log kung owner ang nag-send ng link

    // 2. ALERT-ONLY DISCORD LINK LOGGING (HINDI BURADO, LOG LANG)
    if (DB.security.linkProtection) {
        const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li|com)|discordapp\.com\/invite)\/[a-zA-Z0-9]+/gi;
        if (inviteRegex.test(message.content)) {
            // HINDI na ito buburahin! Mag-se-send lang ng log para aware ka kung sino nag-li-link.
            logSecurity(`ℹ️ **DISCORD INVITE SENT**\n**User:** ${message.author.tag} (${message.author.id})\n**Channel:** ${message.channel}\n**Mensahe:** ${message.content}\n*📊 Status: Hinihayaan lang sa chat.*`, '#3498DB');
        }
    }

    // 3. ALERT-ONLY IMAGE GRABBER / IP LOGGER (HINDI BURADO, LOG LANG)
    if (DB.security.antiImageGrabber) {
        const grabberDomains = ['iplogger.org', 'grabify.link', 'blasze.com', 'ezstat.ru', 'ip-tracker.org', 'leak.sx'];
        const containsGrabber = grabberDomains.some(domain => message.content.toLowerCase().includes(domain));

        if (containsGrabber) {
            // HINDI na rin ito buburahin. Paalala lang sa logs mo.
            logSecurity(`⚠️ **SUSPICIOUS LINK DETECTED**\n**User:** ${message.author.tag} (${message.author.id})\n**Link:** \`${message.content}\`\n*📊 Status: Na-send sa chat nang walang bura.*`, '#E67E22');
        }
    }
});

// PAG BURA NG CHANNEL (ANTI-NUKE - KAILANGAN IBALIK KUNG HINDI OWNER)
client.on(Events.ChannelDelete, async (channel) => {
    if (!DB.security.antiNuke) return;

    const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
    const user = logs.entries.first()?.executor;

    if (!user || user.id === DB.ownerId || user.bot) return;

    logSecurity(`🚨 **ANTI-NUKE TRIGGERED**\n**Aksyon:** Binura ang Channel\n**User:** ${user.tag}\n**Channel:** #${channel.name}`, '#FF0000');
    
    const member = channel.guild.members.cache.get(user.id);
    if (member) {
        await member.timeout(2419200000, 'Azura Security: Nagtangka mag-NUKE').catch(() => {});
        await member.roles.set([]).catch(() => {}); 
    }

    channel.guild.channels.create({
        name: channel.name,
        type: channel.type,
        parent: channel.parent,
        position: channel.position,
        permissionOverwrites: channel.permissionOverwrites.cache
    }).catch(() => {});
});

// PAG BAGO NG ROLES / PERMISSIONS (ANTI-TOKEN)
client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
    if (!DB.security.AntiTokenSteal) return;

    const logs = await newRole.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleUpdate });
    const user = logs.entries.first()?.executor;

    if (!user || user.id === DB.ownerId || user.bot) return;

    if (newRole.permissions.has(PermissionsBitField.Flags.Administrator) && !oldRole.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await newRole.setPermissions(oldRole.permissions).catch(() => {});
        logSecurity(`🚨 **ANTI-TOKEN PROTECTION**\n**User:** ${user.tag}\n**Role:** ${newRole.name}\n🔒 **Aksyon:** Ibinalik ang dating settings, user na-timeout.`, '#FF0000');
        
        const member = newRole.guild.members.cache.get(user.id);
        if (member) await member.timeout(2419200000, 'Sinubukang baguhin ang Server Permissions').catch(() => {});
    }
});

// PAG BURA NG EMOJI / STICKER / BOT
client.on(Events.GuildEmojiDelete, async (emoji) => {
    if (!DB.security.antiRaidDetection) return;

    const logs = await emoji.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.EmojiDelete });
    const user = logs.entries.first()?.executor;
    
    if (!user || user.id === DB.ownerId || user.bot) return;

    logSecurity(`⚠️ **RAID BEHAVIOR DETECTED**\n**User:** ${user.tag}\n**Aksyon:** Nagbura ng Emoji/Asset`, '#FFA500');
    
    const member = emoji.guild.members.cache.get(user.id);
    if (member) await member.timeout(86400000, 'Kahina-hinalang gawain: Posibleng paghahanda sa raid').catch(() => {});
});

// RAID DETECTION (MARAMIHANG PAGPASOK)
let joinLog = [];
client.on(Events.GuildMemberAdd, async (member) => {
    if (member.user.bot) return;

    const now = Date.now();
    joinLog.push(now);
    joinLog = joinLog.filter(time => now - time < 10000); 

    if (joinLog.length >= 5 && DB.security.antiRaidDetection) {
        logSecurity(`🚨 **RAID ALERT! MARAMIHANG PAGDATING**\n**Bilang:** ${joinLog.length} tao sa loob ng 10 segundo`, '#FF0000');
        const guild = member.guild;
        await guild.setVerificationLevel(4).catch(() => {}); 
    }
});

// LOGGING FUNCTIONS
function logSecurity(message, color) {
    const ch = client.channels.cache.get(DB.channels.securityLogs);
    if (!ch) return;
    ch.send({ embeds: [new EmbedBuilder().setColor(color).setDescription(message).setTimestamp()] }).catch(() => {});
}

client.login(TOKEN);
