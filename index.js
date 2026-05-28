const {
    Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, Events, 
    REST, Routes, ButtonBuilder, ActionRowBuilder, ButtonStyle,
    SlashCommandBuilder, AuditLogEvent
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
    ownerId: '1250654354344775703', // ✅ ID MO LANG ANG PROTEKTAHAN
    roles: {
        verified: '<@&1509517115265253487>' // ✅ ROLE IBIBIGAY PAG VERIFIED
    },
    channels: {
        verificationLogs: '1509531106137870406', // ✅ ID NG CHANNEL PARA SA VERIFY LOGS
        securityLogs: '1509015315323945172', // 👈 DITO ILAGAY ANG SECURITY LOGS ID
        verifyChannel: ''
    },
    // 🖼️ BANNER / GIF SA ILALIM NG BUTTON - ILAGAY DITO ANG DISCORD LINK NG GIF MO!
    // EXAMPLE: 'https://cdn.discordapp.com/attachments/1234/5678/ang_gif_mo.gif'
    verifyBanner: 'https://cdn.discordapp.com/attachments/1397829995908567092/1509223385341886674/IMG_4252.gif?ex=6a190e0f&is=6a17bc8f&hm=760070b15604741c33bc19c82ad3db03753b776b012af596868bb4027067fb2d&', 
    // ✅ SETTINGS: HIGPITAN ANG AKSYON, HINDI ANG PAGPASOK
    security: {
        antiNuke: true,        // 🔴 MAXIMUM HIGPIT
        AntiTokenSteal: true,  // 🔴 MAXIMUM HIGPIT
        antiRaidDetection: true, // 🟢 MAGIGING AKTIBO LANG PAG MAY GALAWANG KAHINA-PAGHINALA
        linkProtection: false  // ✅ HINDI MAHIGPIT SA CHAT
    }
};

// --- DATA SAVE/LOAD ---
function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        const data = JSON.parse(fs.readFileSync(DATA_FILE));
        DB.channels = data.channels || DB.channels;
        DB.roles = data.roles || DB.roles;
    }
}
function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
        channels: DB.channels,
        roles: DB.roles
    }, null, 2));
}
loadData();

// --- SLASH COMMANDS ---
const commands = [
    new SlashCommandBuilder()
        .setName('setup-verify')
        .setDescription('I-setup ang verification system')
        .addChannelOption(option => 
            option.setName('channel').setDescription('Channel para sa Verify Button').setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('set-role')
        .setDescription('Palitan ang role na ibibigay pag verified')
        .addRoleOption(option => option.setName('role').setDescription('Bagong Role').setRequired(true))
].map(command => command.toJSON());

// --- BOT ONLINE ---
client.on(Events.Ready, async () => {
    console.log(`🛡️  AZURA ULTIMATE PROTECTION ONLINE 🛡️`);
    console.log(`✅ Mode: SECURE (Attack Detection Only)`);
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
});

// ==================================================
// 🔐 ANTI NUKE SYSTEM - PINAKAMAHIGPIT DITO
// ==================================================

// 1. PAG BURA NG CHANNEL
client.on(Events.ChannelDelete, async (channel) => {
    if (!DB.security.antiNuke) return;

    const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
    const user = logs.entries.first()?.executor;

    // ✅ HINDI PIPIGILAN ANG OWNER AT BOT
    if (!user || user.id === DB.ownerId || user.bot) return;

    // 🔴 MAY TUMANGKANG MAG NUKE!
    logSecurity(`🚨 **ANTI-NUKE TRIGGERED**\n**Aksyon:** Binura ang Channel\n**User:** ${user.tag} (${user.id})\n**Channel:** #${channel.name}\n⚠️ **STATUS: BINABAWAL ANG ACCESS**`, '#FF0000');
    
    // 🛑 PIGILAN AGAD - TIMEOUT + TANGGAL PERMISSIONS
    const member = channel.guild.members.cache.get(user.id);
    if (member) {
        await member.timeout(2419200000, 'Azura Security: Nagtangka mag-NUKE').catch(() => {});
        await member.roles.set([]).catch(() => {}); // Tanggalin lahat ng role
    }

    // 🔄 IBALIK AGAD ANG CHANNEL
    channel.guild.channels.create({
        name: channel.name,
        type: channel.type,
        parent: channel.parent,
        position: channel.position,
        permissionOverwrites: channel.permissionOverwrites.cache
    }).catch(() => {});
});

// 2. PAG BAGO NG ROLES / PERMISSIONS (ANTI TOKEN / ANTI ADMIN)
client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
    if (!DB.security.AntiTokenSteal) return;

    const logs = await newRole.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleUpdate });
    const user = logs.entries.first()?.executor;

    if (!user || user.id === DB.ownerId || user.bot) return;

    // ❌ MAY NAGBABAGO NG PERMISSIONS (Senyales ng pag nanakaw ng server/account)
    if (newRole.permissions.has(PermissionsBitField.Flags.Administrator) && !oldRole.permissions.has(PermissionsBitField.Flags.Administrator)) {
        // IBALIK AGAD SA DATI
        await newRole.setPermissions(oldRole.permissions).catch(() => {});
        
        logSecurity(`🚨 **ANTI-TOKEN PROTECTION**\n**Babala:** May nagtangkang magbigay ng ADMIN PERMISSIONS!\n**User:** ${user.tag}\n**Role:** ${newRole.name}\n🔒 **Aksyon:** Ibinalik ang dating settings, user na-timeout.`, '#FF0000');
        
        const member = newRole.guild.members.cache.get(user.id);
        if (member) await member.timeout(2419200000, 'Sinubukang baguhin ang Server Permissions').catch(() => {});
    }
});

// 3. PAG BURA NG EMOJI / STICKER / BOT (SENYALES NG RAID)
client.on(Events.GuildEmojiDelete, async (emoji) => {
    if (!DB.security.antiRaidDetection) return;

    const logs = await emoji.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.EmojiDelete });
    const user = logs.entries.first()?.executor;
    
    if (!user || user.id === DB.ownerId || user.bot) return;

    // ⚠️ MAY GALAWANG HINDI MAGANDA, TRIGGER ANG ANTI-RAID DEFENSE
    logSecurity(`⚠️ **RAID BEHAVIOR DETECTED**\n**User:** ${user.tag}\n**Aksyon:** Nagbura ng Emoji/Asset\n**⚠️ NAG-ACTIVATE ANG RAID PROTECTION**`, '#FFA500');
    
    const member = emoji.guild.members.cache.get(user.id);
    if (member) await member.timeout(86400000, 'Kahina-hinalang gawain: Posibleng paghahanda sa raid').catch(() => {});
});

// 4. PAG DUMAMI ANG PUMASOK NG SABAY-SABAY (RAID DETECTION)
let joinLog = [];
client.on(Events.GuildMemberAdd, async (member) => {
    // ✅ NORMAL NA PAGPASOK: HINDI KINOKICK, HINDI GAGALAWIN
    if (member.user.bot) return;

    // 🕵️‍♂️ RECORD LANG ANG PAGDATING PARA SA DETEKSYON
    const now = Date.now();
    joinLog.push(now);
    joinLog = joinLog.filter(time => now - time < 10000); // Tago lang ng 10 segundo

    // ⚠️ KUNG 5 O HIGIT PANG TAO ANG PUMASOK SA LOOB NG 10S -> RAID!
    if (joinLog.length >= 5 && DB.security.antiRaidDetection) {
        logSecurity(`🚨 **RAID ALERT! MARAMIHANG PAGDATING**\n**Bilang:** ${joinLog.length} tao sa loob ng 10 segundo\n**⚠️ NAG-LOCKDOWN ANG SERVER!**`, '#FF0000');
        
        // I-lock ang server pansamantala
        const guild = member.guild;
        await guild.setVerificationLevel(4).catch(() => {}); // Itaas ang seguridad
    }
});

// ==================================================
// ✅ VERIFICATION SYSTEM (MAY BANNER/GIF SA BABA)
// ==================================================

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
        // --- SETUP VERIFY ---
        if (interaction.commandName === 'setup-verify') {
            const channel = interaction.options.getChannel('channel');
            DB.channels.verifyChannel = channel.id;
            saveData();

            const button = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_user')
                    .setLabel('✅ VERIFY YOUR ACCOUNT')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🔓')
            );

            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('🔐 AZURA VERIFICATION SYSTEM')
                .setDescription(`**Pindutin ang button sa ibaba para ma-verify at makapasok sa server.**\n\n✅ Pag pindot mo, mabibigyan ka agad ng access.\n📝 Ang lahat ng pag-verify ay naka-log sa pribadong channel.`)
                .setImage(DB.verifyBanner) // 👈 DITO LALABAS ANG GIF MO
                .setTimestamp();

            await channel.send({ embeds: [embed], components: [button] });
            await interaction.reply({ content: `✅ Verification setup complete sa ${channel}`, ephemeral: true });
        }

        // --- SET ROLE ---
        if (interaction.commandName === 'set-role') {
            const role = interaction.options.getRole('role');
            DB.roles.verified = role.id;
            saveData();
            await interaction.reply({ content: `✅ Verified role na ngayon ay: ${role}`, ephemeral: true });
        }
    }

    // --- BUTTON CLICK ---
    if (interaction.isButton() && interaction.customId === 'verify_user') {
        const user = interaction.user;
        const member = interaction.member;

        if (member.roles.cache.has(DB.roles.verified)) {
            return interaction.reply({ content: `⚠️ Verified ka na!`, ephemeral: true });
        }

        try {
            // ✅ BIGYAN NG ROLE
            await member.roles.add(DB.roles.verified);

            // 📝 LOG SA SARILING CHANNEL
            const logEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('✅ NEW VERIFICATION SUCCESS')
                .setDescription(`
**👤 User:** ${user.tag}
**🆔 ID:** \`${user.id}\`
**📅 Oras:** <t:${Math.floor(Date.now()/1000)}:F>
**🔖 Role:** <@&${DB.roles.verified}>
**📊 Status:** ✅ **TAGUMPAY**
                `)
                .setThumbnail(user.displayAvatarURL({dynamic:true}))
                .setTimestamp();

            const logCh = client.channels.cache.get(DB.channels.verificationLogs);
            if (logCh) logCh.send({ embeds: [logEmbed] });

            await interaction.reply({ content: `✅ **VERIFIED!** Maligayang pagdating sa AZURA! 🎉`, ephemeral: true });

        } catch (err) {
            // ❌ KUNG MAY ERROR
            const errorEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ VERIFICATION FAILED')
                .setDescription(`
**👤 User:** ${user.tag}
**🆔 ID:** \`${user.id}\`
**📅 Oras:** <t:${Math.floor(Date.now()/1000)}:F>
**⚠️ Error:** \`${err.message}\`
**📊 Status:** ❌ **NABIGO**
                `)
                .setThumbnail(user.displayAvatarURL({dynamic:true}))
                .setTimestamp();

            const logCh = client.channels.cache.get(DB.channels.verificationLogs);
            if (logCh) logCh.send({ embeds: [errorEmbed] });

            await interaction.reply({ content: `❌ May problema, kontakin ang Staff.`, ephemeral: true });
        }
    }
});

// ==================================================
// 📝 LOGGING FUNCTIONS
// ==================================================
function logSecurity(message, color) {
    const ch = client.channels.cache.get(DB.channels.securityLogs);
    if (!ch) return;
    ch.send({ embeds: [new EmbedBuilder().setColor(color).setDescription(message).setTimestamp()] }).catch(() => {});
}

// --- START BOT ---
client.login(TOKEN);
