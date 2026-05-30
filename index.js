const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const { DisTube } = require('distube');
const ytSearch = require('yt-search');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const ffmpegPath = require('ffmpeg-static');
const { DisTubeVoice } = require('distube');
const distube = new DisTube(client, {
  emitNewSongOnly: true,
  emitAddSongWhenCreatingQueue: false,
  emitAddListWhenCreatingQueue: false,
  joinNewVoiceChannel: true,
  nsfw: false,
  ffmpeg: {
    path: ffmpegPath,
    args: {
      global: { loglevel: 'quiet' },
      input: {},
      output: { b: '128k' },
    },
  },
});
const commands = [
  new SlashCommandBuilder().setName('play').setDescription('🎵 Putar lagu dari YouTube').addStringOption(opt => opt.setName('query').setDescription('Nama lagu atau URL').setRequired(true)),
  new SlashCommandBuilder().setName('skip').setDescription('⏭️ Lewati lagu'),
  new SlashCommandBuilder().setName('stop').setDescription('⏹️ Hentikan musik'),
  new SlashCommandBuilder().setName('queue').setDescription('📋 Tampilkan antrian'),
  new SlashCommandBuilder().setName('pause').setDescription('⏸️ Jeda lagu'),
  new SlashCommandBuilder().setName('resume').setDescription('▶️ Lanjutkan lagu'),
  new SlashCommandBuilder().setName('nowplaying').setDescription('🎶 Lagu yang sedang diputar'),
  new SlashCommandBuilder().setName('volume').setDescription('🔊 Atur volume (1-100)').addIntegerOption(opt => opt.setName('level').setDescription('Level volume').setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder().setName('shuffle').setDescription('🔀 Acak antrian'),
  new SlashCommandBuilder().setName('loop').setDescription('🔁 Toggle loop'),
  new SlashCommandBuilder().setName('ping').setDescription('🏓 Cek latensi'),
  new SlashCommandBuilder().setName('help').setDescription('📖 Daftar perintah'),
].map(cmd => cmd.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('✅ Slash commands berhasil!');
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

client.once('ready', async () => {
  console.log(`✅ Atlantic's Bot aktif: ${client.user.tag}`);
  client.user.setPresence({ activities: [{ name: "🌊 /play | Atlantic's Music", type: 2 }], status: 'online' });
  await registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, member, guild } = interaction;
  const voiceChannel = member.voice?.channel;

  if (commandName === 'ping') {
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🏓 Pong!').setDescription(`Latensi: **${client.ws.ping}ms**`)] });
  }

  if (commandName === 'help') {
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle("🌊 Atlantic's Music Bot").addFields(
      { name: '🎵 Musik', value: '`/play` `/skip` `/stop` `/pause` `/resume`' },
      { name: '📋 Antrian', value: '`/queue` `/shuffle` `/loop`' },
      { name: '🔊 Lainnya', value: '`/volume` `/nowplaying` `/ping` `/help`' },
    ).setFooter({ text: "Atlantic's Music Bot 🌊" })] });
  }

  if (commandName === 'play') {
    if (!voiceChannel) return interaction.reply({ content: '❌ Masuk voice channel dulu!', ephemeral: true });
    await interaction.deferReply();
    const query = interaction.options.getString('query');
    try {
      await distube.play(voiceChannel, query, { member, textChannel: interaction.channel });
      await interaction.editReply({ content: `✅ Mencari **${query}**...` });
    } catch (err) {
      console.error(err);
      await interaction.editReply('❌ Error! Coba lagi.');
    }
  }

  if (commandName === 'skip') {
    const queue = distube.getQueue(guild);
    if (!queue) return interaction.reply({ content: '❌ Tidak ada lagu!', ephemeral: true });
    await queue.skip();
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#FEE75C').setDescription('⏭️ Lagu dilewati!')] });
  }

  if (commandName === 'stop') {
    const queue = distube.getQueue(guild);
    if (!queue) return interaction.reply({ content: '❌ Tidak ada lagu!', ephemeral: true });
    await queue.stop();
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('⏹️ Musik dihentikan!')] });
  }

  if (commandName === 'pause') {
    const queue = distube.getQueue(guild);
    if (!queue) return interaction.reply({ content: '❌ Tidak ada lagu!', ephemeral: true });
    queue.pause();
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#FEE75C').setDescription('⏸️ Musik dijeda!')] });
  }

  if (commandName === 'resume') {
    const queue = distube.getQueue(guild);
    if (!queue) return interaction.reply({ content: '❌ Tidak ada lagu!', ephemeral: true });
    queue.resume();
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#57F287').setDescription('▶️ Musik dilanjutkan!')] });
  }

  if (commandName === 'loop') {
    const queue = distube.getQueue(guild);
    if (!queue) return interaction.reply({ content: '❌ Tidak ada lagu!', ephemeral: true });
    const mode = queue.repeatMode === 0 ? 1 : 0;
    queue.setRepeatMode(mode);
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setDescription(`🔁 Loop **${mode === 1 ? 'aktif' : 'nonaktif'}**!`)] });
  }

  if (commandName === 'volume') {
    const queue = distube.getQueue(guild);
    if (!queue) return interaction.reply({ content: '❌ Tidak ada lagu!', ephemeral: true });
    const level = interaction.options.getInteger('level');
    queue.setVolume(level);
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setDescription(`🔊 Volume: **${level}%**`)] });
  }

  if (commandName === 'queue') {
    const queue = distube.getQueue(guild);
    if (!queue) return interaction.reply({ content: '📋 Antrian kosong!', ephemeral: true });
    const list = queue.songs.slice(0, 10).map((s, i) => `**${i + 1}.** ${s.name} — \`${s.formattedDuration}\``).join('\n');
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('📋 Antrian').setDescription(list).setFooter({ text: `Total: ${queue.songs.length} lagu` })] });
  }

  if (commandName === 'nowplaying') {
    const queue = distube.getQueue(guild);
    if (!queue) return interaction.reply({ content: '❌ Tidak ada lagu!', ephemeral: true });
    const s = queue.songs[0];
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🎶 Sekarang Diputar').setDescription(`**[${s.name}](${s.url})**`).addFields({ name: '⏱️ Durasi', value: s.formattedDuration, inline: true }).setThumbnail(s.thumbnail).setFooter({ text: "Atlantic's Music Bot 🌊" })] });
  }

  if (commandName === 'shuffle') {
    const queue = distube.getQueue(guild);
    if (!queue) return interaction.reply({ content: '❌ Tidak ada lagu!', ephemeral: true });
    await queue.shuffle();
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setDescription('🔀 Antrian diacak!')] });
  }
});

// DisTube Events
distube.on('playSong', (queue, song) => {
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🎵 Sekarang Diputar')
    .setDescription(`**[${song.name}](${song.url})**`)
    .addFields(
      { name: '⏱️ Durasi', value: song.formattedDuration, inline: true },
      { name: '👤 Diminta oleh', value: song.user?.tag || 'Unknown', inline: true }
    )
    .setThumbnail(song.thumbnail)
    .setFooter({ text: "Atlantic's Music Bot 🌊" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('pause_btn').setEmoji('⏸️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('skip_btn').setEmoji('⏭️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('stop_btn').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('loop_btn').setEmoji('🔁').setStyle(ButtonStyle.Success),
  );

  queue.textChannel?.send({ embeds: [embed], components: [row] });
});

distube.on('addSong', (queue, song) => {
  queue.textChannel?.send({ embeds: [new EmbedBuilder().setColor('#57F287').setTitle('➕ Ditambahkan ke Antrian').setDescription(`**[${song.name}](${song.url})**`).addFields({ name: '📍 Posisi', value: `#${queue.songs.length}`, inline: true }).setThumbnail(song.thumbnail).setFooter({ text: "Atlantic's Music Bot 🌊" })] });
});

distube.on('error', (channel, err) => {
  console.error('DisTube error:', err);
  channel?.send('❌ Terjadi error saat memutar lagu!');
});

distube.on('finish', (queue) => {
  queue.textChannel?.send({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('✅ Antrian selesai! Sampai jumpa 🌊')] });
});

// Button Handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  const queue = distube.getQueue(interaction.guildId);
  const { customId } = interaction;

  if (customId === 'pause_btn') {
    if (queue?.paused) { queue.resume(); await interaction.reply({ content: '▶️ Dilanjutkan!', ephemeral: true }); }
    else { queue?.pause(); await interaction.reply({ content: '⏸️ Dijeda!', ephemeral: true }); }
  } else if (customId === 'skip_btn') {
    await queue?.skip();
    await interaction.reply({ content: '⏭️ Dilewati!', ephemeral: true });
  } else if (customId === 'stop_btn') {
    await queue?.stop();
    await interaction.reply({ content: '⏹️ Dihentikan!', ephemeral: true });
  } else if (customId === 'loop_btn') {
    const mode = queue?.repeatMode === 0 ? 1 : 0;
    queue?.setRepeatMode(mode);
    await interaction.reply({ content: `🔁 Loop ${mode === 1 ? 'aktif' : 'nonaktif'}!`, ephemeral: true });
  }
});

client.login(process.env.TOKEN);
