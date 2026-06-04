const {
    Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, Events,
    REST, Routes, SlashCommandBuilder, AuditLogEvent, ChannelType
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
        linkProtection: true,        // 🔴 MAXIMUM: BAWAL ANG IBANG SERVER LINKS, BUBURAHIN AT PARUSAHAN
        antiImageGrabber: true,      // 🔴 MAXIMUM: BAWAL ANG LAHAT NG IP LOGGER / GRABBER
        antiMassBan: true,           // 🔴 BAGO: BAWAL ANG MARAMIHANG PAGBAN
        antiMassKick: true,          // 🔴 BAGO: BAWAL ANG MARAMIHANG PAGKICK
        antiChannelEdit: true,       // 🔴 BAGO: BAWAL PALITAN ANG PANGALAN / SETTINGS NG CHANNEL
        antiRoleCreateDelete: true,  // 🔴 BAGO: BAWAL GUMAWA O MAGBURA NG ROLE
        antiWebhook: true,           // 🔴 BAGO: BAWAL GUMAWA NG WEBHOOK (GINAGAMIT SA NUKE)
        antiServerEdit: true,        // 🔴 BAGO: BAWAL PALITAN ANG ICON / PANGALAN NG SERVER
        antiAddBot: true             // 🔴 BAGO: BAWAL DUMAGDAG NG IBANG BOT
    }
};

const spamMap = new Map();
const actionLog = new Map(); // Para sa Mass Ban/Kick detection
let joinLog = [];

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
    console.log(`🛡️  AZURA ULTIMATE SECURITY SYSTEM ONLINE 🛡️`);
    console.log(`✅ MODE: GOD MODE - WALANG MAKAKAGALAW KUNDI IKAW LANG`);
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
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

        logSecurity(`🚨 **ANTI-GIVE ADMIN TRIGGERED**\n**Target:** ${newMember.user.tag} (${newMember.id})\n**Salarin:** ${executor.tag} (${executor.id})\n🔒 **Aksyon:** Tinanggal lahat ng roles, BINAN sa server (Permanent).`, '#FF0000');

        // IBALIK SA DATIN ANG ROLES
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        for (const [roleId] of addedRoles) await newMember.roles.remove(roleId).catch(() => {});

        // PARUSA SA NAGBIGAY
        const staffMember = newMember.guild.members.cache.get(executor.id);
        if (staffMember) {
            await staffMember.ban({ reason: 'AZURA SECURITY: Ilegal na pagbibigay ng Administrator' }).catch(() => {});
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

    // 1. ANTI-SPAM (SOBRANG HIGPIT)
    if (DB.security.antiSpam && !isOwner) {
        if (!spamMap.has(authorId)) spamMap.set(authorId, []);
        const userLog = spamMap.get(authorId);
        userLog.push({ time: now, msgId: message.id, channelId: message.channel.id });

        const recentMessages = userLog.filter(log => now - log.time < 2000); // 2 SECONDS LANG
        spamMap.set(authorId, recentMessages);

        if (recentMessages.length > 3) { // KAPAG 3 NA SA LOOB NG 2S
            logSecurity(`⚠️ **ANTI-SPAM TRIGGERED**\n**User:** ${message.author.tag}\n🔒 **Aksyon:** BINAN (Spamming), binura lahat ng mensahe.`, '#FF0000');
            
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

    // 2. LINK PROTECTION (Bawal ang ibang server)
    if (DB.security.linkProtection) {
        const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li|com)|discordapp\.com\/invite)\/[a-zA-Z0-9]+/gi;
        const badDomains = ['discord.gg', 'discord.com/invite', 'dsc.gg', 'invite.gg'];
        
        if (inviteRegex.test(message.content)) {
            logSecurity(`🚫 **FORBIDDEN LINK DETECTED**\n**User:** ${message.author.tag}\n**Channel:** ${message.channel}\n🔒 **Aksyon:** Mensahe binura, User BINAN.`, '#FF0000');
            await message.delete().catch(() => {});
            await message.member.ban({ reason: 'AZURA SECURITY: Nagpadala ng ibang server link' }).catch(() => {});
            return;
        }
    }

    // 3. ANTI IMAGE GRABBER / IP LOGGER
    if (DB.security.antiImageGrabber) {
        const grabberDomains = ['iplogger.org', 'grabify.link', 'blasze.com', 'ezstat.ru', 'ip-tracker.org', 'leak.sx', 'logger', 'steal', 'log.', 'ip.', 'tracker', 'link'];
        const containsGrabber = grabberDomains.some(domain => message.content.toLowerCase().includes(domain));

        if (containsGrabber) {
            logSecurity(`🚫 **DANGEROUS LINK DETECTED**\n**User:** ${message.author.tag}\n**Link:** \`${message.content}\`\n🔒 **Aksyon:** Mensahe binura, User BINAN.`, '#FF0000');
            await message.delete().catch(() => {});
            await message.member.ban({ reason: 'AZURA SECURITY: Nagpadala ng IP Logger / Virus Link' }).catch(() => {});
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

    logSecurity(`🚨 **ANTI-NUKE: CHANNEL DELETED**\n**Salarin:** ${user.tag} (${user.id})\n**Channel:** #${channel.name}\n🔒 **Aksyon:** IBINALIK ANG CHANNEL, SALARIN BINAN.`, '#FF0000');
    
    const member = channel.guild.members.cache.get(user.id);
    if (member) await member.ban({ reason: 'AZURA SECURITY: Nagbura ng Channel (NUKE ATTEMPT)' }).catch(() => {});

    // IBALIK AGAD ANG CHANNEL
    channel.guild.channels.create({
        name: channel.name,
        type: channel.type,
        parent: channel.parent,
        position: channel.position,
        permissionOverwrites: channel.permissionOverwrites.cache
    }).catch(() => {});
});

// PAG PALIT NG PANGALAN O SETTINGS NG CHANNEL
client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
    if (!DB.security.antiChannelEdit || newChannel.type === ChannelType.DM) return;

    const logs = await newChannel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelUpdate });
    const user = logs.entries.first()?.executor;

    if (!user || user.id === DB.ownerId || user.bot) return;

    if (oldChannel.name !== newChannel.name || JSON.stringify(oldChannel.permissionOverwrites) !== JSON.stringify(newChannel.permissionOverwrites)) {
        logSecurity(`🚨 **ANTI-NUKE: CHANNEL EDITED**\n**Salarin:** ${user.tag}\n**Channel:** #${oldChannel.name}\n🔒 **Aksyon:** Ibinalik sa dati, Salarin BINAN.`, '#FF0000');
        await newChannel.setName(oldChannel.name).catch(() => {});
        await newChannel.setPosition(oldChannel.position).catch(() => {});
        await newChannel.permissionOverwrites.set(oldChannel.permissionOverwrites.cache).catch(() => {});
        
        const member = newChannel.guild.members.cache.get(user.id);
        if (member) await member.ban({ reason: 'AZURA SECURITY: Nagbago ng settings ng Channel' }).catch(() => {});
    }
});

// PAG GUMAWA NG CHANNEL
client.on(Events.ChannelCreate, async (channel) => {
    if (!DB.security.antiNuke || channel.type === ChannelType.DM) return;

    const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate });
    const user = logs.entries.first()?.executor;

    if (!user || user.id === DB.ownerId || user.bot) return;

    logSecurity(`🚨 **ANTI-NUKE: CHANNEL CREATED**\n**Salarin:** ${user.tag}\n🔒 **Aksyon:** Binura ang ginawang channel, Salarin BINAN.`, '#FF0000');
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
        (newRole.permissions.has(PermissionsBitField.Flags.ManageRoles) && !oldRole.permissions.has(PermissionsBitField.Flags.ManageRoles))) {
        
        await newRole.setPermissions(oldRole.permissions).catch(() => {});
        logSecurity(`🚨 **ANTI-TOKEN STEAL DETECTED**\n**Salarin:** ${user.tag}\n**Role:** ${newRole.name}\n🔒 **Aksyon:** Ibinalik ang perms, Salarin BINAN.`, '#FF0000');
        
        const member = newRole.guild.members.cache.get(user.id);
        if (member) await member.ban({ reason: 'AZURA SECURITY: Sinubukang nakawin ang Server / Permissions' }).catch(() => {});
    }
});

// PAG GUMAWA O MAGBURA NG ROLE
client.on(Events.GuildRoleCreate, async (role) => {
    if (!DB.security.antiRoleCreateDelete) return;
    const logs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleCreate });
    const user = logs.entries.first()?.executor;
    if (!user || user.id === DB.ownerId || user.bot) return;

    logSecurity(`🚨 **ROLE CREATE DETECTED**\n**Salarin:** ${user.tag}\n🔒 **Aksyon:** Binura ang role, Salarin BINAN.`, '#FF0000');
    await role.delete().catch(() => {});
    const member = role.guild.members.cache.get(user.id);
    if (member) await member.ban({ reason: 'AZURA SECURITY: Ilegal na paggawa ng Role' }).catch(() => {});
});

client.on(Events.GuildRoleDelete, async (role) => {
    if (!DB.security.antiRoleCreateDelete) return;
    const logs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete });
    const user = logs.entries.first()?.executor;
    if (!user || user.id === DB.ownerId || user.bot) return;

    logSecurity(`🚨 **ROLE DELETE DETECTED**\n**Salarin:** ${user.tag}\n🔒 **Aksyon:** BINAN ang salarin.`, '#FF0000');
    const member = role.guild.members.cache.get(user.id);
    if (member) await member.ban({ reason: 'AZURA SECURITY: Nagbura ng Role' }).catch(() => {});
});

// ==============================================
// 🛡️ ANTI MASS BAN / KICK / WEBHOOK
// ==============================================

// ANTI MASS BAN
client.on(Events.GuildBanAdd, async (ban) => {
    if (!DB.security.antiMassBan) return;
    const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
    const user = logs.entries.first()?.executor;
    if (!user || user.id === DB.ownerId || user.bot) return;

    const now = Date.now();
    if (!actionLog.has(user.id)) actionLog.set(user.id, []);
    actionLog.get(user.id).push(now);
    
    const recentActions = actionLog.get(user.id).filter(t => now - t < 10000); // 10 seconds
    if (recentActions.length >= 3) { // Kapag 3 na ban
        logSecurity(`🚨 **MASS BAN DETECTED**\n**Salarin:** ${user.tag}\n**Bilang:** ${recentActions.length} tao\n🔒 **Aksyon:** BINAN ang salarin.`, '#FF0000');
        const member = ban.guild.members.cache.get(user.id);
        if (member) await member.ban({ reason: 'AZURA SECURITY: Mass Ban / Raid Attempt' }).catch(() => {});
    }
});

// ANTI WEBHOOK (Pinaka-importante sa mga nagnu-nuke)
client.on(Events.WebhookCreate, async (webhook) => {
    if (!DB.security.antiWebhook) return;
    const logs = await webhook.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.WebhookCreate });
    const user = logs.entries.first()?.executor;
    if (!user || user.id === DB.ownerId || user.bot) return;

    logSecurity(`🚨 **WEBHOOK CREATED**\n**Salarin:** ${user.tag}\n🔒 **Aksyon:** Binura ang webhook, Salarin BINAN.`, '#FF0000');
    await webhook.delete().catch(() => {});
    const member = webhook.guild.members.cache.get(user.id);
    if (member) await member.ban({ reason: 'AZURA SECURITY: Gumawa ng Webhook (Tool para sa Nuke)' }).catch(() => {});
});

// ==============================================
// 🛡️ ANTI RAID SYSTEM
// ==============================================
client.on(Events.GuildMemberAdd, async (member) => {
    if (member.user.bot) {
        // ANTI ADD BOT
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
    joinLog = joinLog.filter(time => now - time < 10000); // 10 Segundo

    if (joinLog.length >= 5 && DB.security.antiRaidDetection) {
        logSecurity(`🚨 **RAID ALERT! MARAMIHANG PAGDATING**\n**Bilang:** ${joinLog.length} tao sa loob ng 10s\n🔒 **Aksyon:** SERVER LOCKED + VERIFICATION MAXIMUM`, '#FF0000');
        
        // I-LOCK ANG SERVER
        await member.guild.setVerificationLevel(4).catch(() => {}); // Pinakamataas na seguridad
        await member.guild.setDefaultNotifications(2).catch(() => {}); // Only mentions

        // BAN LAHAT NG KAKASUKO LANG (RAIDERS)
        const recentJoiners = member.guild.members.cache.filter(m => now - m.joinedTimestamp < 10000 && !m.user.bot);
        recentJoiners.forEach(async m => {
            await m.ban({ reason: 'AZURA SECURITY: Raid detected, automatic ban' }).catch(() => {});
        });
        joinLog = []; // I-clear ang log
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

    if (oldGuild.name !== newGuild.name || oldGuild.icon !== newGuild.icon || oldGuild.banner !== newGuild.banner) {
        logSecurity(`🚨 **SERVER EDIT DETECTED**\n**Salarin:** ${user.tag}\n🔒 **Aksyon:** Ibinalik ang pangalan/Icon, Salarin BINAN.`, '#FF0000');
        await newGuild.setName(oldGuild.name).catch(() => {});
        if (oldGuild.icon) await newGuild.setIcon(oldGuild.iconURL({ size: 4096 })).catch(() => {});
        
        const member = newGuild.members.cache.get(user.id);
        if (member) await member.ban({ reason: 'AZURA SECURITY: Sinubukang baguhin ang pangalan o itsura ng Server' }).catch(() => {});
    }
});

// ==============================================
// 📝 LOGGING FUNCTION
// ==============================================
function logSecurity(message, color) {
    const ch = client.channels.cache.get(DB.channels.securityLogs);
    if (!ch) return console.log("⚠️ Security Log Channel not found!");
    
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('🛡️ AZURA SECURITY LOGS')
        .setDescription(message)
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/2647/2647625.png')
        .setTimestamp()
        .setFooter({ text: 'Azura Organization • Ultimate Protection', iconURL: 'https://cdn-icons-png.flaticon.com/512/1828/1828843.png' });

    ch.send({ embeds: [embed] }).catch(() => {});
}

client.login(TOKEN);
