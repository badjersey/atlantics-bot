const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const playdl = require('play-dl');
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

const queues = new Map();

const commands = [
  new SlashCommandBuilder().setName('play').setDescription('🎵 Putar lagu dari YouTube').addStringOption(opt => opt.setName('query').setDescription('Nama lagu atau URL YouTube').setRequired(true)),
  new SlashCommandBuilder().setName('skip').setDescription('⏭️ Lewati lagu yang sedang diputar'),
  new SlashCommandBuilder().setName('stop').setDescription('⏹️ Hentikan musik dan kosongkan antrian'),
  new SlashCommandBuilder().setName('queue').setDescription('📋 Tampilkan antrian lagu'),
  new SlashCommandBuilder().setName('pause').setDescription('⏸️ Jeda lagu'),
  new SlashCommandBuilder().setName('resume').setDescription('▶️ Lanjutkan lagu'),
  new SlashCommandBuilder().setName('nowplaying').setDescription('🎶 Tampilkan lagu yang sedang diputar'),
  new SlashCommandBuilder().setName('volume').setDescription('🔊 Atur volume (1-100)').addIntegerOption(opt => opt.setName('level').setDescription('Level volume 1-100').setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder().setName('shuffle').setDescription('🔀 Acak antrian lagu'),
  new SlashCommandBuilder().setName('loop').setDescription('🔁 Toggle mode loop lagu'),
  new SlashCommandBuilder().setName('remove').setDescription('🗑️ Hapus lagu dari antrian').addIntegerOption(opt => opt.setName('posisi').setDescription('Posisi lagu di antrian').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('ping').setDescription('🏓 Cek latensi bot'),
  new SlashCommandBuilder().setName('help').setDescription('📖 Tampilkan semua perintah'),
].map(cmd => cmd.toJSON());

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
    const stream = await playdl.stream(song.url, { quality: 2 });
    const resource = createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true });
    resource.volum
