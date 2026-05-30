const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const ytdl = require('@distube/ytdl-core');
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

// Queue per server
const queues = new Map();

// ───────────────────────────────────────────
//  SLASH COMMANDS DEFINITION
// ───────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('🎵 Putar lagu dari YouTube')
    .addStringOption(opt => opt.setName('query').setDescription('Nama lagu atau URL YouTube').setRequired(true)),
  new SlashCommandBuilder()
    .setName('skip')
    .setDescription('⏭️ Lewati lagu yang sedang diputar'),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('⏹️ Hentikan musik dan kosongkan antrian'),
  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('📋 Tampilkan antrian lagu'),
  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('⏸️ Jeda lagu'),
  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('▶️ Lanjutkan lagu'),
  new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('🎶 Tampilkan lagu yang sedang diputar'),
  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('🔊 Atur volume (1-100)')
    .addIntegerOption(opt => opt.setName('level').setDescription('Level volume 1-100').setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('🔀 Acak antrian lagu'),
  new SlashCommandBuilder()
    .setName('loop')
    .setDescription('🔁 Toggle mode loop lagu'),
  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('🗑️ Hapus lagu dari antrian')
    .addIntegerOption(opt => opt.setName('posisi').setDescription('Posisi lagu di antrian').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('🏓 Cek latensi bot'),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('📖 Tampilkan semua perintah Atlantic\'s'),
].map(cmd => cmd.toJSON());

// ───────────────────────────────────────────
//  REGISTER SLASH COMMANDS
// ───────────────────────────────────────────
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    console.log('🔄 Mendaftarkan slash commands...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('✅ Slash commands berhasil didaftarkan!');
  } catch (err) {
    console.error('❌ Gagal mendaftarkan commands:', err);
  }
}

// ───────────────────────────────────────────
//  HELPER: GET OR CREATE QUEUE
// ───────────────────────────────────────────
function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      songs: [],
      playing: false,
      paused: false,
      loop: false,
      volume: 100,
      connection: null,
      player: null,
      currentSong: null,
      textChannel: null,
    });
  }
  return queues.get(guildId);
}

// ───────────────────────────────────────────
//  HELPER: PLAY NEXT SONG
// ───────────────────────────────────────────
async function playSong(guildId) {
  const queue = getQueue(guildId);
  if (queue.songs.length === 0) {
    queue.playing = false;
    queue.currentSong = null;
    if (queue.connection) {
      setTimeout(() => {
        if (!queue.playing) {
          queue.connection?.destroy();
          queues.delete(guildId);
        }
      }, 60000);
    }
    return;
  }

  const song = queue.songs[0];
  queue.currentSong = song;

  try {
    const stream = ytdl(song.url, {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25,
    });

    const resource = createAudioResource(stream, { inlineVolume: true });
    resource.volume?.setVolume(queue.volume / 100);

    queue.player.play(resource);
    queue.playing = true;

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🎵 Sekarang Diputar')
      .setDescription(`**[${song.title}](${song.url})**`)
      .addFields(
        { name: '⏱️ Durasi', value: song.duration || 'N/A', inline: true },
        { name: '👤 Diminta oleh', value: song.requestedBy, inline: true },
        { name: '🔁 Loop', value: queue.loop ? 'Aktif' : 'Nonaktif', inline: true }
      )
      .setThumbnail(song.thumbnail)
      .setFooter({ text: "Atlantic's Music Bot 🌊" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pause_resume').setEmoji('⏸️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('skip').setEmoji('⏭️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('loop').setEmoji('🔁').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('queue_btn').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    );

    queue.textChannel?.send({ embeds: [embed], components: [row] });

  } catch (err) {
    console.error('❌ Error memutar lagu:', err);
    queue.songs.shift();
    playSong(guildId);
  }
}

// ───────────────────────────────────────────
//  BOT READY
// ───────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Atlantic's Bot aktif sebagai ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "🌊 /play | Atlantic's Music", type: 2 }],
    status: 'online',
  });
  await registerCommands();
});

// ───────────────────────────────────────────
//  SLASH COMMAND HANDLER
// ───────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) return handleButton(interaction);
  if (!interaction.isChatInputCommand()) return;

  const { commandName, member, guild, channel } = interaction;

  // ── /ping ──
  if (commandName === 'ping') {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor('#5865F2')
        .setTitle('🏓 Pong!')
        .setDescription(`Latensi: **${client.ws.ping}ms**`)
        .setFooter({ text: "Atlantic's Music Bot 🌊" })]
    });
  }

  // ── /help ──
  if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle("🌊 Atlantic's Music Bot — Daftar Perintah")
      .setDescription('Bot musik terbaik untuk server Discord kamu!')
      .addFields(
        { name: '🎵 Musik', value: '`/play` `/skip` `/stop` `/pause` `/resume`' },
        { name: '📋 Antrian', value: '`/queue` `/shuffle` `/remove` `/loop`' },
        { name: '🔊 Pengaturan', value: '`/volume` `/nowplaying`' },
        { name: '🛠️ Lainnya', value: '`/ping` `/help`' },
      )
      .setFooter({ text: "Atlantic's Music Bot 🌊 | Made with ❤️" })
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  // Untuk command musik, pastikan user di voice channel
  const voiceChannel = member.voice?.channel;

  if (commandName === 'play') {
    if (!voiceChannel) {
      return interaction.reply({ content: '❌ Kamu harus masuk ke **voice channel** dulu!', ephemeral: true });
    }

    await interaction.deferReply();
    const query = interaction.options.getString('query');

    try {
      let songInfo;
      if (query.includes('youtube.com') || query.includes('youtu.be')) {
        const info = await ytdl.getInfo(query);
        songInfo = {
          title: info.videoDetails.title,
          url: info.videoDetails.video_url,
          duration: formatDuration(parseInt(info.videoDetails.lengthSeconds)),
          thumbnail: info.videoDetails.thumbnails?.pop()?.url,
          requestedBy: member.user.tag,
        };
      } else {
        const result = await ytSearch(query);
        const video = result.videos[0];
        if (!video) return interaction.editReply('❌ Lagu tidak ditemukan!');
        songInfo = {
          title: video.title,
          url: video.url,
          duration: video.duration.timestamp,
          thumbnail: video.thumbnail,
          requestedBy: member.user.tag,
        };
      }

      const queue = getQueue(guild.id);
      queue.textChannel = channel;

      if (!queue.connection) {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        connection.subscribe(player);
        queue.connection = connection;
        queue.player = player;

        player.on(AudioPlayerStatus.Idle, () => {
          if (!queue.loop) queue.songs.shift();
          playSong(guild.id);
        });

        player.on('error', (err) => {
          console.error('Player error:', err);
          queue.songs.shift();
          playSong(guild.id);
        });

        connection.on(VoiceConnectionStatus.Disconnected, async () => {
          try {
            await Promise.race([
              entersState(connection, VoiceConnectionStatus.Signalling, 5000),
              entersState(connection, VoiceConnectionStatus.Connecting, 5000),
            ]);
          } catch {
            connection.destroy();
            queues.delete(guild.id);
          }
        });
      }

      queue.songs.push(songInfo);

      if (!queue.playing) {
        playSong(guild.id);
        await interaction.editReply({ content: `✅ Menambahkan **${songInfo.title}** ke antrian!` });
      } else {
        const embed = new EmbedBuilder()
          .setColor('#57F287')
          .setTitle('➕ Ditambahkan ke Antrian')
          .setDescription(`**[${songInfo.title}](${songInfo.url})**`)
          .addFields(
            { name: '⏱️ Durasi', value: songInfo.duration, inline: true },
            { name: '📍 Posisi', value: `#${queue.songs.length}`, inline: true }
          )
          .setThumbnail(songInfo.thumbnail)
          .setFooter({ text: "Atlantic's Music Bot 🌊" });
        await interaction.editReply({ embeds: [embed] });
      }
    } catch (err) {
      console.error(err);
      interaction.editReply('❌ Terjadi error saat mencari lagu. Coba lagi!');
    }
  }

  if (commandName === 'skip') {
    const queue = getQueue(guild.id);
    if (!queue.playing) return interaction.reply({ content: '❌ Tidak ada lagu yang diputar!', ephemeral: true });
    queue.songs.shift();
    playSong(guild.id);
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#FEE75C').setDescription('⏭️ Lagu dilewati!')] });
  }

  if (commandName === 'stop') {
    const queue = getQueue(guild.id);
    queue.songs = [];
    queue.playing = false;
    queue.player?.stop();
    queue.connection?.destroy();
    queues.delete(guild.id);
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('⏹️ Musik dihentikan dan antrian dikosongkan!')] });
  }

  if (commandName === 'pause') {
    const queue = getQueue(guild.id);
    if (!queue.playing) return interaction.reply({ content: '❌ Tidak ada lagu!', ephemeral: true });
    queue.player?.pause();
    queue.paused = true;
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#FEE75C').setDescription('⏸️ Musik dijeda!')] });
  }

  if (commandName === 'resume') {
    const queue = getQueue(guild.id);
    if (!queue.paused) return interaction.reply({ content: '❌ Musik tidak sedang dijeda!', ephemeral: true });
    queue.player?.unpause();
    queue.paused = false;
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#57F287').setDescription('▶️ Musik dilanjutkan!')] });
  }

  if (commandName === 'loop') {
    const queue = getQueue(guild.id);
    queue.loop = !queue.loop;
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor('#5865F2')
        .setDescription(`🔁 Mode loop **${queue.loop ? 'diaktifkan' : 'dinonaktifkan'}**!`)]
    });
  }

  if (commandName === 'volume') {
    const queue = getQueue(guild.id);
    const level = interaction.options.getInteger('level');
    queue.volume = level;
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor('#5865F2').setDescription(`🔊 Volume diatur ke **${level}%**`)]
    });
  }

  if (commandName === 'queue') {
    const queue = getQueue(guild.id);
    if (queue.songs.length === 0) return interaction.reply({ content: '📋 Antrian kosong!', ephemeral: true });
    const list = queue.songs.slice(0, 10).map((s, i) => `**${i + 1}.** ${s.title} — \`${s.duration}\``).join('\n');
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📋 Antrian Lagu')
      .setDescription(list)
      .setFooter({ text: `Total: ${queue.songs.length} lagu | Atlantic's Music Bot 🌊` });
    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'nowplaying') {
    const queue = getQueue(guild.id);
    if (!queue.currentSong) return interaction.reply({ content: '❌ Tidak ada lagu yang diputar!', ephemeral: true });
    const s = queue.currentSong;
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🎶 Sekarang Diputar')
      .setDescription(`**[${s.title}](${s.url})**`)
      .addFields(
        { name: '⏱️ Durasi', value: s.duration, inline: true },
        { name: '👤 Diminta oleh', value: s.requestedBy, inline: true }
      )
      .setThumbnail(s.thumbnail)
      .setFooter({ text: "Atlantic's Music Bot 🌊" });
    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'shuffle') {
    const queue = getQueue(guild.id);
    if (queue.songs.length < 2) return interaction.reply({ content: '❌ Tidak cukup lagu untuk diacak!', ephemeral: true });
    const current = queue.songs.shift();
    queue.songs.sort(() => Math.random() - 0.5);
    queue.songs.unshift(current);
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setDescription('🔀 Antrian diacak!')] });
  }

  if (commandName === 'remove') {
    const queue = getQueue(guild.id);
    const pos = interaction.options.getInteger('posisi');
    if (pos > queue.songs.length) return interaction.reply({ content: '❌ Posisi tidak valid!', ephemeral: true });
    const removed = queue.songs.splice(pos - 1, 1);
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor('#ED4245').setDescription(`🗑️ **${removed[0].title}** dihapus dari antrian!`)]
    });
  }
});

// ───────────────────────────────────────────
//  BUTTON HANDLER
// ───────────────────────────────────────────
async function handleButton(interaction) {
  const queue = getQueue(interaction.guildId);
  const { customId } = interaction;

  if (customId === 'pause_resume') {
    if (queue.paused) {
      queue.player?.unpause();
      queue.paused = false;
      await interaction.reply({ content: '▶️ Musik dilanjutkan!', ephemeral: true });
    } else {
      queue.player?.pause();
      queue.paused = true;
      await interaction.reply({ content: '⏸️ Musik dijeda!', ephemeral: true });
    }
  } else if (customId === 'skip') {
    queue.songs.shift();
    playSong(interaction.guildId);
    await interaction.reply({ content: '⏭️ Lagu dilewati!', ephemeral: true });
  } else if (customId === 'stop') {
    queue.songs = [];
    queue.playing = false;
    queue.player?.stop();
    queue.connection?.destroy();
    queues.delete(interaction.guildId);
    await interaction.reply({ content: '⏹️ Musik dihentikan!', ephemeral: true });
  } else if (customId === 'loop') {
    queue.loop = !queue.loop;
    await interaction.reply({ content: `🔁 Loop ${queue.loop ? 'aktif' : 'nonaktif'}!`, ephemeral: true });
  } else if (customId === 'queue_btn') {
    if (queue.songs.length === 0) return interaction.reply({ content: '📋 Antrian kosong!', ephemeral: true });
    const list = queue.songs.slice(0, 10).map((s, i) => `**${i + 1}.** ${s.title}`).join('\n');
    await interaction.reply({ content: `**📋 Antrian:**\n${list}`, ephemeral: true });
  }
}

// ───────────────────────────────────────────
//  HELPER: FORMAT DURATION
// ───────────────────────────────────────────
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
}

// ───────────────────────────────────────────
//  LOGIN
// ───────────────────────────────────────────
client.login(process.env.TOKEN);
