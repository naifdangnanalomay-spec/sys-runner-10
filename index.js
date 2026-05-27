const {
    Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, Events, 
    REST, Routes, ButtonBuilder, ActionRowBuilder, ButtonStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans, GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildModeration
    ]
});

const TOKEN = process.env.TOKEN || '';
const CLIENT_ID = '1508602818901053460';
const DATA_FILE = path.join(__dirname, 'data.json');

const DB = {
    ownerId: '1250654354344775703',
    logs: { security: '1509015315323945172', autodelete: '1509015315323945172', all: '1509015315323945172' },
    toggles: { antiRaid: true, antiLink: true, antiNuke: true, antiGiveAdmin: true },
    punishments: { type: 'kick' }, // Changed to kick for safety
    whitelist: new Set()
};

// --- DATA PERSISTENCE ---
function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        const data = JSON.parse(fs.readFileSync(DATA_FILE));
        DB.whitelist = new Set(data.whitelist);
    }
}
function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ whitelist: Array.from(DB.whitelist) }));
}
loadData();

// --- COMMANDS ---
const commands = [
    { name: 'setup-verify', description: 'I-send ang verification button' },
    { name: 'whitelistadd', description: 'Add to whitelist', options: [{ name: 'target', type: 9, description: 'User/Role', required: true }] }
];

client.on('ready', async () => {
    console.log(`✅✅✅ AZURA ANTI ENEMY ULTRA ACTIVE ✅✅✅`);
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
});

// --- SECURITY ENGINE ---
client.on(Events.GuildMemberAdd, async (member) => {
    const daysOld = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
    if (daysOld < 7 && DB.toggles.antiRaid && !isWhitelisted(member.id)) {
        await member.kick('Azura Security: New Account Protection').catch(() => {});
        logEvent('security', `🔴 **ANTI-RAID (KICKED)**\nUser: ${member.user.tag}`, '#FF0000');
    }
});

client.on(Events.ChannelDelete, async (channel) => {
    if (!DB.toggles.antiNuke) return;
    const audit = await channel.guild.fetchAuditLogs({ limit: 1, type: 12 });
    const executor = audit.entries.first()?.executor;
    if (executor && !isWhitelisted(executor.id)) {
        const member = channel.guild.members.cache.get(executor.id);
        if (member) await member.kick('Anti-Nuke Triggered');
    }
});

// --- VERIFICATION SYSTEM ---
client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup-verify') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('verify_user').setLabel('✅ I-verify ang Account').setStyle(ButtonStyle.Success)
            );
            await interaction.reply({ content: 'Pindutin ang button para ma-verify.', components: [row] });
        }
        if (interaction.commandName === 'whitelistadd') {
            const id = interaction.options.get('target').value;
            DB.whitelist.add(id);
            saveData();
            await interaction.reply(`✅ Added ${id} to whitelist.`);
        }
    }

    if (interaction.isButton() && interaction.customId === 'verify_user') {
        const memberRole = '1508552687837249696';
        await interaction.member.roles.add(memberRole).catch(() => {});
        await interaction.reply({ content: '✅ Verified ka na!', ephemeral: true });
    }
});

// --- UTILITIES ---
function isWhitelisted(userId) { return userId === DB.ownerId || DB.whitelist.has(userId); }
function logEvent(type, message, color) {
    const ch = client.channels.cache.get(DB.logs[type]);
    if (ch) ch.send({ embeds: [new EmbedBuilder().setDescription(message).setColor(color).setTimestamp()] });
}

client.login(TOKEN);
