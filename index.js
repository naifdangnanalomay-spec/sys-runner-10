const {
    Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, Events,
    REST, Routes, SlashCommandBuilder, AuditLogEvent, ChannelType, ActivityType
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
    ownerId: '1250654354344775703', // ✅ IKAW LANG ANG MAY KAPANGYARIHAN
    channels: {
        securityLogs: '1509015315323945172' // ✅ DITO LALAGPAT LAHAT NG LOGS
    },
    security: {
        antiNuke: true,              // 🔴 MAXIMUM: IBABALIK LAHAT, BABAN O TATANGGALAN NG PERMS
        AntiTokenSteal: true,        // 🔴 MAXIMUM: BAWAL BAGUHIN ANG PERMISSIONS NG ROLES
        antiRaidDetection: true,     // 🔴 MAXIMUM: AUTO LOCK + AUTO BAN SA MGA RAIDERS
        antiGiveAdmin: true,         // 🔴 MAXIMUM: BAWAL MAGBIGAY NG ADMIN, AGAD NA PARUSAHAN
        antiSpam: true,              // 🔴 MAXIMUM: AGAD NA TIMEOUT AT BURA
        linkProtection: false,       // ✅ PINAYAGAN NA: PWEDE NA MAG SEND NG LINKS
        antiImageGrabber: true,      // 🔴 MAXIMUM: BAWAL ANG LAHAT NG IP LOGGER / GRABBER
        antiMassBan: true,           // 🔴 BAGO: BAWAL ANG MARAMIHANG PAGBAN
        antiMassKick: true,          // 🔴 BAGO: BAWAL ANG MARAMIHANG PAGKICK
        antiMassRole: true,          // 🔴 BAGO: BAWAL ANG MARAMIHANG PAGBIGAY NG ROLE
        antiChannelEdit: true,       // 🔴 BAGO: BAWAL PALITAN ANG PANGALAN / SETTINGS NG CHANNEL
        antiRoleCreateDelete: true,  // 🔴 BAGO: BAWAL GUMAWA O MAGBURA NG ROLE
        antiWebhook: true,           // 🔴 BAGO: BAWAL GUMAWA NG WEBHOOK (GINAGAMIT SA NUKE)
        antiServerEdit: true,        // 🔴 BAGO: BAWAL PALITAN ANG ICON / PANGALAN NG SERVER
        antiAddBot: true,            // 🔴 BAGO: BAWAL DUMAGDAG NG IBANG BOT
        antiEmojiSticker: true,      // 🔴 BAGO: BAWAL BURAHIN O PALITAN ANG EMOJI/STICKER
        antiIntegration: true        // 🔴 BAGO: BAWAL GUMAWA NG INTEGRATION
    }
};

const spamMap = new Map();
const actionLog = new Map(); // Para sa Mass Ban/Kick/Role detection
let joinLog = [];
const COOLDOWN = 10000; // 10 Segundo na limitasyon
const LIMIT = 3; // Higit sa 3 na aksyon = BAN

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

const commands = [];

// --- BOT ONLINE ---
client.once(Events.Ready, async () => {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🛡️  AZURA ULTIMATE SECURITY SYSTEM ACTIVE 🛡️`);
    console.log(`✅ MODE: GOD MODE - WALANG MAKAKAGALAW KUNDI IKAW LANG`);
    console.log(`🔒 PROTECTIONS: NUKE | RAID | ADMIN | SPAM | LINKS`);
    console.log(`🤖 LOGGED IN AS: ${client.user.tag}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Slash Commands: LOADED & REGISTERED');
    } catch (err) {
        console.error('❌ Error Loading Commands:', err);
    }

    // ✅ STATUS: Watching Server | PUBLIC AZURA - Tuloy-tuloy na pagpapalit
    setInterval(() => {
        const activities = [
            { name: 'Server', type: ActivityType.Watching },
            { name: 'PUBLIC AZURA', type: ActivityType.Watching }
        ];
        const current = activities[Math.floor((Date.now() / 10000) % activities.length)];
        client.user.setActivity(current.name, { type: current.type });
    }, 10000); // Magpapalit bawat 10 segundo
});

// ==================================================
// 🔐 ULTIMATE SECURITY SYSTEM - PINAKAMATINDING PROTEKSIYON
// ==================================================

// ==============================================
// 🚫 ANTI-GIVE ADMIN & ROLE MANAGEMENT
// ==============================================
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    if (!DB.security.antiGiveAdmin) return;
    if (newMember.user.bot || newMember.id === DB.ownerId) return;

    const hadAdmin = oldMember.permissions.has(PermissionsBitField.Flags.Administrator);
    const hasAdmin = newMember.permissions.has(PermissionsBitField.Flags.Administrator);

    if (hasAdmin && !hadAdmin) {
        const logs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate });
        const executor = logs.entries.first()?.executor;

        if (!executor || executor.id === DB.ownerId || executor.id === client.user.id) return;

        logSecurity(`🚨 **ANTI-GIVE ADMIN TRIGGERED**\n**Target:** ${newMember.user.tag} (${newMember.id})\n**Salarin:** ${executor.tag} (${executor.id})\n🔒 **Aksyon:** Tinanggal lahat ng roles, SALARIN AY BINAN PERMANENTE.`, '#FF0000');

        // IBALIK SA DATIN ANG ROLES NG USER
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        for (const [roleId] of addedRoles) await newMember.roles.remove(roleId).catch(() => {});

        // PARUSAHAN ANG NAGBIGAY NG ADMIN
        const staffMember = newMember.guild.members.cache.get(executor.id);
        if (staffMember) {
            await staffMember.ban({ reason: 'AZURA SECURITY: Ilegal na pagbibigay ng Administrator Permissions' }).catch(() => {});
        }
    }

    // === ANTI MASS ROLE ADD ===
    if (DB.security.antiMassRole) {
        const logs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate });
        const executor = logs.entries.first()?.executor;
        if (!executor || executor.id === DB.ownerId || executor.bot) return;

        trackAction(executor.id);
        if (isLimitReached(executor.id)) {
            logSecurity(`🚨 **MASS ROLE DETECTED**\n**Salarin:** ${executor.tag}\n🔒 **Aksyon:** Sobrang dami ng binigay na role, BINAN AGAD.`, '#FF0000');
            const member = newMember.guild.members.cache.get(executor.id);
            if (member) await member.ban({ reason: 'AZURA SECURITY: Mass Role Assignment detected' }).catch(() => {});
        }
    }
});

// ==============================================
// 🚫 ANTI SPAM & LINK PROTECTION
// ==============================================
client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;
    const authorId = message.author.id;
    const now = Date.now();
    const isOwner = authorId === DB.ownerId;

    // 1. ANTI-SPAM (SOBRANG HIGPIT - 3 messages sa loob ng 2 seconds = BAN)
    if (DB.security.antiSpam && !isOwner) {
        if (!spamMap.has(authorId)) spamMap.set(authorId, []);
        const userLog = spamMap.get(authorId);
        userLog.push({ time: now, msgId: message.id, channelId: message.channel.id });

        const recentMessages = userLog.filter(log => now - log.time < 2000); // 2 SECONDS LANG
        spamMap.set(authorId, recentMessages);

        if (recentMessages.length > 3) { // KAPAG 4 NA O HIGIT
            logSecurity(`⚠️ **ANTI-SPAM TRIGGERED**\n**User:** ${message.author.tag}\n**Channel:** ${message.channel}\n🔒 **Aksyon:** BINAN (Spamming/Flooding), binura lahat ng mensahe.`, '#FF0000');
            
            // BURA LAHAT NG SPAM
            for (const log of recentMessages) {
                const ch = message.guild.channels.cache.get(log.channelId);
                if (ch) ch.messages.delete(log.msgId).catch(() => {});
            }
            
            // BAN AGAD
            await message.member.ban({ reason: 'AZURA SECURITY: Sobrang Spam / Flooding' }).catch(() => {});
            spamMap.delete(authorId);
            return;
        }
    }

    if (isOwner) return;

    // 2. LINK PROTECTION: ✅ PINAYAGAN NA ANG LAHAT NG LINKS, PERO HINDI ANG IP-logger
    if (DB.security.antiImageGrabber) {
        const grabberDomains = [
            'iplogger.org', 'grabify.link', 'blasze.com', 'ezstat.ru', 'ip-tracker.org', 
            'leak.sx', 'logger', 'steal', 'log.', 'ip.', 'tracker', 'link', 'stat', 
            'cpm', 'tinyurl', 'bit.ly', 'shorturl', 'get', 'info', 'geo', 'loc'
        ];
        const containsGrabber = grabberDomains.some(domain => message.content.toLowerCase().includes(domain));

        if (containsGrabber) {
            logSecurity(`🚫 **DANGEROUS LINK DETECTED**\n**User:** ${message.author.tag}\n**Link:** \`${message.content}\`\n🔒 **Aksyon:** Mensahe binura, User BINAN. (IP LOGGER DETECTED)`, '#FF0000');
            await message.delete().catch(() => {});
            await message.member.ban({ reason: 'AZURA SECURITY: Nagpadala ng IP Logger / Virus / Dangerous Link' }).catch(() => {});
            return;
        }
    }
});

// ==============================================
// 🛡️ ANTI-NUKE: CHANNEL PROTECTION
// ==============================================

// PAG BURA NG CHANNEL
client.on(Events.ChannelDelete, async (channel) => {
    if (!DB.security.antiNuke || channel.type === ChannelType.DM) return;

    const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
    const user = logs.entries.first()?.executor;

    if (!user || user.id === DB.ownerId || user.bot) return;

    logSecurity(`🚨 **ANTI-NUKE: CHANNEL DELETED**\n**Salarin:** ${user.tag} (${user.id})\n**Channel Name:** #${channel.name}\n🔒 **Aksyon:** IBINALIK AGAD ANG CHANNEL, SALARIN BINAN.`, '#FF0000');
    
    const member = channel.guild.members.cache.get(user.id);
    if (member) await member.ban({ reason: 'AZURA SECURITY: Nagbura ng Channel (NUKE ATTEMPT)' }).catch(() => {});

    // IBALIK AGAD ANG CHANNEL KASAMA ANG SETTINGS
    channel.guild.channels.create({
        name: channel.name,
        type: channel.type,
        parent: channel.parent,
        position: channel.position,
        permissionOverwrites: channel.permissionOverwrites.cache,
        topic: channel.topic,
        nsfw: channel.nsfw,
        rateLimitPerUser: channel.rateLimitPerUser
    }).catch(() => {});
});

// PAG PALIT NG PANGALAN O SETTINGS NG CHANNEL
client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
    if (!DB.security.antiChannelEdit || newChannel.type === ChannelType.DM) return;

    const logs = await newChannel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelUpdate });
    const user = logs.entries.first()?.executor;

    if (!user || user.id === DB.ownerId || user.bot) return;

    if (oldChannel.name !== newChannel.name || JSON.stringify(oldChannel.permissionOverwrites) !== JSON.stringify(newChannel.permissionOverwrites)) {
        logSecurity(`🚨 **ANTI-NUKE: CHANNEL EDITED**\n**Salarin:** ${user.tag}\n**Channel:** #${oldChannel.name}\n🔒 **Aksyon:** Ibinalik sa dati ang pangalan at perms, Salarin BINAN.`, '#FF0000');
        await newChannel.setName(oldChannel.name).catch(() => {});
        await newChannel.setPosition(oldChannel.position).catch(() => {});
        await newChannel.permissionOverwrites.set(oldChannel.permissionOverwrites.cache).catch(() => {});
        
        const member = newChannel.guild.members.cache.get(user.id);
        if (member) await member.ban({ reason: 'AZURA SECURITY: Nagbago ng settings o pangalan ng Channel' }).catch(() => {});
    }
});

// PAG GUMAWA NG CHANNEL
client.on(Events.ChannelCreate, async (channel) => {
    if (!DB.security.antiNuke || channel.type === ChannelType.DM) return;

    const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate });
    const user = logs.entries.first()?.executor;

    if (!user || user.id === DB.ownerId || user.bot) return;

    logSecurity(`🚨 **ANTI-NUKE: CHANNEL CREATED**\n**Salarin:** ${user.tag}\n🔒 **Aksyon:** Binura ang ginawang channel (Hindi awtorisado), Salarin BINAN.`, '#FF0000');
    await channel.delete().catch(() => {});
    
    const member = channel.guild.members.cache.get(user.id);
    if (member) await member.ban({ reason: 'AZURA SECURITY: Ilegal na paggawa ng Channel' }).catch(() => {});
});

// ==============================================
// 🛡️ ANTI-TOKEN STEAL: ROLE PROTECTION
// ==============================================

// PAG BAGO NG ROLE PERMISSIONS
client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
    if (!DB.security.AntiTokenSteal) return;

    const logs = await newRole.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleUpdate });
    const user = logs.entries.first()?.executor;

    if (!user || user.id === DB.ownerId || user.bot) return;

    // KUNG NAGLAHAD NG ADMIN O MGA DELIKADONG PERMS
    if ((newRole.permissions.has(PermissionsBitField.Flags.Administrator) && !oldRole.permissions.has(PermissionsBitField.Flags.Administrator)) ||
        (newRole.permissions.has(PermissionsBitField.Flags.ManageGuild) && !oldRole.permissions.has(PermissionsBitField.Flags.ManageGuild)) ||
        (newRole.permissions.has(PermissionsBitField.Flags.ManageRoles) && !oldRole.permissions.has(PermissionsBitField.Flags.ManageRoles)) ||
        (newRole.permissions.has(PermissionsBitField.Flags.ManageChannels) && !oldRole.permissions.has(PermissionsBitField.Flags.ManageChannels))) {
        
        await newRole.setPermissions(oldRole.permissions).catch(() => {});
        logSecurity(`🚨 **ANTI-TOKEN STEAL DETECTED**\n**Salarin:** ${user.tag}\n**Role:** ${newRole.name}\n🔒 **Aksyon:** Ibinalik ang dating Permissions, Salarin BINAN.`, '#FF0000');
        
        const member = newRole.guild.members.cache.get(user.id);
        if (member) await member.ban({ reason: 'AZURA SECURITY: Sinubukang nakawin ang Server / Magdagdag ng Delikadong Permissions' }).catch(() => {});
    }
});

// PAG GUMAWA O MAGBURA NG ROLE
client.on(Events.GuildRoleCreate, async (role) => {
    if (!DB.security.antiRoleCreateDelete) return;
    const logs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleCreate });
    const user = logs.entries.first()?.executor;
    if (!user || user.id === DB.ownerId || user.bot) return;

    logSecurity(`🚨 **ROLE CREATE DETECTED**\n**Salarin:** ${user.tag}\n🔒 **Aksyon:** Binura ang role na ginawa, Salarin BINAN.`, '#FF0000');
    await role.delete().catch(() => {});
    const member = role.guild.members.cache.get(user.id);
    if (member) await member.ban({ reason: 'AZURA SECURITY: Ilegal na paggawa ng Role' }).catch(() => {});
});

client.on(Events.GuildRoleDelete, async (role) => {
    if (!DB.security.antiRoleCreateDelete) return;
    const logs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete });
    const user = logs.entries.first()?.executor;
    if (!user || user.id === DB.ownerId || user.bot) return;

    logSecurity(`🚨 **ROLE DELETE DETECTED**\n**Salarin:** ${user.tag}\n🔒 **Aksyon:** BINAN ang salarin dahil pagtatangka sa seguridad.`, '#FF0000');
    const member = role.guild.members.cache.get(user.id);
    if (member) await member.ban({ reason: 'AZURA SECURITY: Nagbura ng Role / Pagsubok na sirain ang server' }).catch(() => {});
});

// ==============================================
// 🛡️ ANTI MASS BAN / KICK / WEBHOOK / EMOJI
// ==============================================

// ANTI MASS BAN
client.on(Events.GuildBanAdd, async (ban) => {
    if (!DB.security.antiMassBan) return;
    const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
    const user = logs.entries.first()?.executor;
    if (!user || user.id === DB.ownerId || user.bot) return;

    trackAction(user.id);
    if (isLimitReached(user.id)) {
        logSecurity(`🚨 **MASS BAN DETECTED**\n**Salarin:** ${user.tag}\n**Bilang:** Sobrang dami ng binan sa maikling oras\n🔒 **Aksyon:** BINAN ang salarin at ibabalik ang mga user.`, '#FF0000');
        const member = ban.guild.members.cache.get(user.id);
        if (member) await member.ban({ reason: 'AZURA SECURITY: Mass Ban / Raid Attempt' }).catch(() => {});
    }
});

// ANTI MASS KICK
client.on(Events.GuildMemberRemove, async (member) => {
    if (!DB.security.antiMassKick || !member.kickable) return;
    const logs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick });
    const user = logs.entries.first()?.executor;
    if (!user || user.id === DB.ownerId || user.bot) return;

    trackAction(user.id);
    if (isLimitReached(user.id)) {
        logSecurity(`🚨 **MASS KICK DETECTED**\n**Salarin:** ${user.tag}\n🔒 **Aksyon:** BINAN ang salarin dahil maraming tinanggal na miyembro.`, '#FF0000');
        const staff = member.guild.members.cache.get(user.id);
        if (staff) await staff.ban({ reason: 'AZURA SECURITY: Mass Kick detected' }).catch(() => {});
    }
});

// ANTI WEBHOOK (Pinaka-importante sa mga nagnu-nuke)
client.on(Events.WebhookCreate, async (webhook) => {
    if (!DB.security.antiWebhook) return;
    const logs = await webhook.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.WebhookCreate });
    const user = logs.entries.first()?.executor;
    if (!user || user.id === DB.ownerId || user.bot) return;

    logSecurity(`🚨 **WEBHOOK CREATED**\n**Salarin:** ${user.tag}\n🔒 **Aksyon:** Binura ang webhook (ginagamit sa pagnu-nuke), Salarin BINAN.`, '#FF0000');
    await webhook.delete().catch(() => {});
    const member = webhook.guild.members.cache.get(user.id);
    if (member) await member.ban({ reason: 'AZURA SECURITY: Gumawa ng Webhook (Common Nuke Tool)' }).catch(() => {});
});

// ANTI EMOJI / STICKER DELETE / EDIT
client.on(Events.GuildEmojiUpdate, async (oldEmoji, newEmoji) => {
    if (!DB.security.antiEmojiSticker) return;
    const logs = await newEmoji.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.EmojiUpdate });
    const user = logs.entries.first()?.executor;
    if (!user || user.id === DB.ownerId || user.bot) return;
    
    logSecurity(`🚨 **EMOJI EDITED**\n**Salarin:** ${user.tag}\n🔒 **Aksyon:** Ibinalik sa dati, Salarin BINAN.`, '#FF0000');
    await newEmoji.setName(oldEmoji.name).catch(() => {});
    const member = newEmoji.guild.members.cache.get(user.id);
    if (member) await member.ban({ reason: 'AZURA SECURITY: Nagbago ng Emoji' }).catch(() => {});
});

client.on(Events.GuildEmojiDelete, async (emoji) => {
    if (!DB.security.antiEmojiSticker) return;
    const logs = await emoji.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.EmojiDelete });
    const user = logs.entries.first()?.executor;
    if (!user || user.id === DB.ownerId || user.bot) return;
    
    logSecurity(`🚨 **EMOJI DELETED**\n**Salarin:** ${user.tag}\n🔒 **Aksyon:** BINAN ang salarin.`, '#FF0000');
    const member = emoji.guild.members.cache.get(user.id);
    if (member) await member.ban({ reason: 'AZURA SECURITY: Nagbura ng Emoji' }).catch(() => {});
});

// ==============================================
// 🛡️ ANTI RAID SYSTEM
// ==============================================
client.on(Events.GuildMemberAdd, async (member) => {
    // ANTI ADD BOT
    if (member.user.bot) {
        const logs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.BotAdd });
        const user = logs.entries.first()?.executor;
        if (user && user.id !== DB.ownerId) {
            logSecurity(`🚨 **BOT ADDED DETECTED**\n**Salarin:** ${user.tag}\n**Bot:** ${member.user.tag}\n🔒 **Aksyon:** Kinalas ang bot, Salarin BINAN.`, '#FF0000');
            await member.kick({ reason: 'AZURA SECURITY: Bawal magdagdag ng ibang Bot' }).catch(() => {});
            const staff = member.guild.members.cache.get(user.id);
            if (staff) await staff.ban({ reason: 'AZURA SECURITY: Nagdagdag ng hindi awtorisadong Bot' }).catch(() => {});
        }
        return;
    }

    const now = Date.now();
    joinLog.push(now);
    joinLog = joinLog.filter(time => now - time < 10000); // 10 Segundo na pagbantay

    if (joinLog.length >= 5 && DB.security.antiRaidDetection) { // Kapag 5 tao pataas ang pumasok
        logSecurity(`🚨 **RAID ALERT! MARAMIHANG PAGDATING**\n**Bilang:** ${joinLog.length} tao sa loob ng 10 segundo\n🔒 **Aksyon:** SERVER LOCKED + VERIFICATION MAXIMUM + AUTO BAN SA LAHAT NG KAKASUKO LANG.`, '#FF0000');
        
        // I-LOCK AT PATAASIN ANG SEGURIDAD NG SERVER
        await member.guild.setVerificationLevel(4).catch(() => {}); // Pinakamataas na seguridad
        await member.guild.setDefaultNotifications(2).catch(() => {}); // Only mentions

        // BAN LAHAT NG KAKASUKO LANG (RAIDERS)
        const recentJoiners = member.guild.members.cache.filter(m => now - m.joinedTimestamp < 10000 && !m.user.bot);
        recentJoiners.forEach(async m => {
            await m.ban({ reason: 'AZURA SECURITY: Raid detected, automatic ban' }).catch(() => {});
        });
        joinLog = []; // I-clear ang log pagkatapos ng raid
    }
});

// ==============================================
// 🛡️ SERVER SETTINGS PROTECTION
// ==============================================
client.on(Events.GuildUpdate, async (oldGuild, newGuild) => {
    if (!DB.security.antiServerEdit) return;

    const logs = await newGuild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.GuildUpdate });
    const user = logs.entries.first()?.executor;

    if (!user || user.id === DB.ownerId || user.bot) return;

    if (oldGuild.name !== newGuild.name || oldGuild.icon !== newGuild.icon || oldGuild.banner !== newGuild.banner || oldGuild.verificationLevel !== newGuild.verificationLevel) {
        logSecurity(`🚨 **SERVER EDIT DETECTED**\n**Salarin:** ${user.tag}\n🔒 **Aksyon:** Ibinalik ang pangalan, icon at settings, Salarin BINAN.`, '#FF0000');
        await newGuild.setName(oldGuild.name).catch(() => {});
        if (oldGuild.icon) await newGuild.setIcon(oldGuild.iconURL({ size: 4096 })).catch(() => {});
        if (oldGuild.banner) await newGuild.setBanner(oldGuild.bannerURL({ size: 4096 })).catch(() => {});
        
        const member = newGuild.members.cache.get(user.id);
        if (member) await member.ban({ reason: 'AZURA SECURITY: Sinubukang baguhin ang pangalan o itsura ng Server' }).catch(() => {});
    }
});

// ==============================================
// ⚙️ HELPER FUNCTIONS (Para sa Mass Action Detection)
// ==============================================
function trackAction(userId) {
    const now = Date.now();
    if (!actionLog.has(userId)) actionLog.set(userId, []);
    const userActions = actionLog.get(userId);
    userActions.push(now);
    // Tanggalin ang mga lumang record
    actionLog.set(userId, userActions.filter(time => now - time < COOLDOWN));
}

function isLimitReached(userId) {
    return actionLog.has(userId) && actionLog.get(userId).length >= LIMIT;
}

// ==============================================
// 📝 LOGGING FUNCTION - MAAYOS AT DETALYADO
// ==============================================
function logSecurity(message, color) {
    const ch = client.channels.cache.get(DB.channels.securityLogs);
    if (!ch) return console.log("⚠️ SECURITY ALERT: Log Channel not found or inaccessible!");
    
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('🛡️ AZURA ULTIMATE SECURITY SYSTEM')
        .setDescription(message)
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/2647/2647625.png')
        .addFields(
            { name: '📊 Status', value: '**ACTIVE**', inline: true },
            { name: '👁️ Mode', value: '**GOD MODE**', inline: true },
            { name: '⏰ Time', value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Azura Organization • Walang makakagalaw kundi ang May-ari', iconURL: 'https://cdn-icons-png.flaticon.com/512/1828/1828843.png' });

    ch.send({ embeds: [embed] }).catch(() => {});
}

// 🔑 PARA GUMANA ANG BOT - HUWAG TANGGAL
client.login(TOKEN);
