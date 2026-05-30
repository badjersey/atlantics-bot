const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState, StreamType, getVoiceConnection } = require('@discordjs/voice');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const YTDlpWrap = require('yt-dlp-wrap').default;
const ytSearch = require('yt-search');
const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('child_process');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const queues = new Map();
const ytDlp = new YTDlpWrap();

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

function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      songs: [], playing: false, paused: false, loop: false,
      volume: 100, connection: null, player: null, currentSong: null, textChannel: null,
    });
  }
  return queues.get(guildId);
}

async function playSong(guildId) {
  const queue = getQueue(guildId);
  if (queue.songs.length === 0) {
    queue.playing = false;
    queue.currentSong = null;
    setTimeout(() => { if (!queue.playing) { queue.connection?.destroy(); queues.delete(guildId); } }, 60000);
    return;
  }

  const song = queue.songs[0];
  queue.currentSong = song;

  try {
    console.log(`🎵 Memutar: ${song.title}`);

    const ffmpegProcess = spawn(ffmpegPath, [
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-i', song.streamUrl,
      '-vn',
      '-acodec', 'libopus',
      '-f', 'opus',
      '-ar', '48000',
      '-ac', '2',
      'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'ignore'] });

    const resource = createAudioResource(ffmpegProcess.stdout, {
      inputType: StreamType.OggOpus,
      inlineVolume: true,
    });

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
    );

    queue.textChannel?.send({ embeds: [embed], components: [row] });

  } catch (err) {
    console.error('❌ Error memutar lagu:', err);
    queue.songs.shift();
    playSong(guildId);
  }
}

async function getSongInfo(query) {
  try {
    let url;
    if (query.includes('youtube.com') || query.includes('youtu.be')) {
      url = query;
    } else {
      const result = await ytSearch(query);
      if (!result.videos.length) return null;
      url = result.videos[0].url;
    }

    const info = await ytDlp.getVideoInfo(url);
    const streamUrl = await ytDlp.execPromise([
      url, '--get-url', '-f', 'bestaudio/best', '--no-playlist'
    ]).then(out => out.trim());

    return {
      title: info.title,
      url: url,
      streamUrl: streamUrl,
      duration: formatDuration(info.duration),
      thumbnail: info.thumbnail,
    };
  } catch (err) {
    console.error('getSongInfo error:', err);
    return null;
  }
}

client.once('ready', async () => {
  console.log(`✅ Atlantic's Bot aktif: ${client.user.tag}`);
  client.user.setPresence({ activities: [{ name: "🌊 /play | Atlantic's Music", type: 2 }], status: 'online' });
  await registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) return handleButton(interaction);
  if (!interaction.isChatInputCommand()) return;

  const { commandName, member, guild, channel } = interaction;
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
      const songInfo = await getSongInfo(query);
      if (!songInfo) return interaction.editReply('❌ Lagu tidak ditemukan!');
      songInfo.requestedBy = member.user.tag;

      const queue = getQueue(guild.id);
      queue.textChannel = channel;

      if (!queue.connection) {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator,
          selfDeaf: false,
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
        await interaction.editReply({ content: `✅ Memutar **${songInfo.title}**!` });
      } else {
        await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#57F287').setTitle('➕ Ditambahkan').setDescription(`**[${songInfo.title}](${songInfo.url})**`).setThumbnail(songInfo.thumbnail).setFooter({ text: "Atlantic's Music Bot 🌊" })] });
      }
    } catch (err) {
      console.error(err);
      await interaction.editReply('❌ Error! Coba lagi.');
    }
  }

  if (commandName === 'skip') {
    const queue = getQueue(guild.id);
    if (!queue.playing) return interaction.reply({ content: '❌ Tidak ada lagu!', ephemeral: true });
    queue.songs.shift(); playSong(guild.id);
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#FEE75C').setDescription('⏭️ Lagu dilewati!')] });
  }

  if (commandName === 'stop') {
    const queue = getQueue(guild.id);
    queue.songs = []; queue.playing = false; queue.player?.stop(); queue.connection?.destroy(); queues.delete(guild.id);
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('⏹️ Musik dihentikan!')] });
  }

  if (commandName === 'pause') {
    const queue = getQueue(guild.id);
    if (!queue.playing) return interaction.reply({ content: '❌ Tidak ada lagu!', ephemeral: true });
    queue.player?.pause(); queue.paused = true;
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#FEE75C').setDescription('⏸️ Musik dijeda!')] });
  }

  if (commandName === 'resume') {
    const queue = getQueue(guild.id);
    if (!queue.paused) return interaction.reply({ content: '❌ Musik tidak dijeda!', ephemeral: true });
    queue.player?.unpause(); queue.paused = false;
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#57F287').setDescription('▶️ Musik dilanjutkan!')] });
  }

  if (commandName === 'loop') {
    const queue = getQueue(guild.id);
    queue.loop = !queue.loop;
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setDescription(`🔁 Loop **${queue.loop ? 'aktif' : 'nonaktif'}**!`)] });
  }

  if (commandName === 'volume') {
    const queue = getQueue(guild.id);
    const level = interaction.options.getInteger('level');
    queue.volume = level;
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setDescription(`🔊 Volume: **${level}%**`)] });
  }

  if (commandName === 'queue') {
    const queue = getQueue(guild.id);
    if (queue.songs.length === 0) return interaction.reply({ content: '📋 Antrian kosong!', ephemeral: true });
    const list = queue.songs.slice(0, 10).map((s, i) => `**${i + 1}.** ${s.title} — \`${s.duration}\``).join('\n');
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('📋 Antrian').setDescription(list).setFooter({ text: `Total: ${queue.songs.length} lagu` })] });
  }

  if (commandName === 'nowplaying') {
    const queue = getQueue(guild.id);
    if (!queue.currentSong) return interaction.reply({ content: '❌ Tidak ada lagu!', ephemeral: true });
    const s = queue.currentSong;
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🎶 Sekarang Diputar').setDescription(`**[${s.title}](${s.url})**`).addFields({ name: '👤 Diminta oleh', value: s.requestedBy }).setThumbnail(s.thumbnail).setFooter({ text: "Atlantic's Music Bot 🌊" })] });
  }

  if (commandName === 'shuffle') {
    const queue = getQueue(guild.id);
    if (queue.songs.length < 2) return interaction.reply({ content: '❌ Tidak cukup lagu!', ephemeral: true });
    const current = queue.songs.shift();
    queue.songs.sort(() => Math.random() - 0.5);
    queue.songs.unshift(current);
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setDescription('🔀 Antrian diacak!')] });
  }
});

async function handleButton(interaction) {
  const queue = getQueue(interaction.guildId);
  const { customId } = interaction;
  if (customId === 'pause_resume') {
    if (queue.paused) { queue.player?.unpause(); queue.paused = false; await interaction.reply({ content: '▶️ Dilanjutkan!', ephemeral: true }); }
    else { queue.player?.pause(); queue.paused = true; await interaction.reply({ content: '⏸️ Dijeda!', ephemeral: true }); }
  } else if (customId === 'skip') {
    queue.songs.shift(); playSong(interaction.guildId);
    await interaction.reply({ content: '⏭️ Dilewati!', ephemeral: true });
  } else if (customId === 'stop') {
    queue.songs = []; queue.playing = false; queue.player?.stop(); queue.connection?.destroy(); queues.delete(interaction.guildId);
    await interaction.reply({ content: '⏹️ Dihentikan!', ephemeral: true });
  } else if (customId === 'loop') {
    queue.loop = !queue.loop;
    await interaction.reply({ content: `🔁 Loop ${queue.loop ? 'aktif' : 'nonaktif'}!`, ephemeral: true });
  }
}

function formatDuration(seconds) {
  if (!seconds) return 'N/A';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
}

client.login(process.env.TOKEN);
