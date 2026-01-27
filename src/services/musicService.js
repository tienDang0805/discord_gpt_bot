const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  entersState, 
  StreamType, 
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection
} = require('@discordjs/voice');
const play = require('play-dl');
const { video_basic_info, stream } = require('play-dl');

const { EventEmitter } = require('events');

class MusicService extends EventEmitter {
  constructor() {
    super();
    this.players = new Map(); // guildId -> player
    this.queues = new Map(); // guildId -> queue[]
    this.nowPlaying = new Map(); // guildId -> current track
    this.repeatModes = new Map(); // guildId -> repeat mode (off, song, queue)
  }

  // Initialize player for a guild if not exists
  _initPlayer(guildId) {
    if (!this.players.has(guildId)) {
      const player = createAudioPlayer();
      this.players.set(guildId, player);
      this.queues.set(guildId, []);
      this.repeatModes.set(guildId, 'off');
      
      player.on('error', error => {
        console.error(`[Player Error] Guild ${guildId}:`, error);
        this.emit('error', { guildId, error });
      });

      player.on(AudioPlayerStatus.Idle, () => {
        this._handleIdle(guildId);
      });

      return player;
    }
    return this.players.get(guildId);
  }

  // Handle when player becomes idle
  async _handleIdle(guildId) {
    const repeatMode = this.repeatModes.get(guildId);
    const currentTrack = this.nowPlaying.get(guildId);

    if (repeatMode === 'song' && currentTrack) {
      // Replay current song
      return this._playTrack(guildId, currentTrack);
    }

    if (repeatMode === 'queue' && currentTrack) {
      // Add current song back to queue
      this.queues.get(guildId).push(currentTrack);
    }

    const queue = this.queues.get(guildId);
    if (queue.length > 0) {
      // Play next in queue
      const nextTrack = queue.shift();
      this.nowPlaying.set(guildId, nextTrack);
      return this._playTrack(guildId, nextTrack);
    }

    // No more tracks, clean up
    this.nowPlaying.delete(guildId);
    this.emit('queueEnd', guildId);
  }

  // Internal method to play a track
async _playTrack(guildId, track, retries = 1) {
    if (!track || !track.url) {
        throw new Error('Invalid track object or missing URL');
    }

    // Xử lý URL - loại bỏ tham số thời gian nếu có
    let cleanUrl = track.url.split('&')[0];
    if (!cleanUrl.startsWith('https://')) {
        throw new Error('Invalid YouTube URL');
    }

    const player = this.players.get(guildId);
    const connection = getVoiceConnection(guildId);
    if (!connection) {
        throw new Error('Bot is not in a voice channel');
    }

    try {

        
        // Kiểm tra URL hợp lệ trước
        const isYoutube = play.yt_validate(cleanUrl);
        if (!isYoutube) {
            throw new Error('URL is not a valid YouTube link');
        }

        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), 30000);


        const stream = await play.stream(cleanUrl, {
            discordPlayerCompatibility: true,
            quality: 2,
            signal: abortController.signal
        }).catch(err => {
            clearTimeout(timeout);
            console.error('Stream error:', err);
            throw err;
        });

        clearTimeout(timeout);


        const resource = createAudioResource(stream.stream, {
            inputType: stream.type,
            inlineVolume: true,
        });

        player.play(resource);
        connection.subscribe(player);

        await entersState(player, AudioPlayerStatus.Playing, 5000);
        this.emit('trackStart', { guildId, track });

    } catch (error) {
        console.error(`[PlayTrack Error] Guild ${guildId}:`, error);
        
        if (retries > 0) {
            console.log(`Retrying... (${retries} attempts left)`);
            return this._playTrack(guildId, track, retries - 1);
        }
        
        throw new Error(`Failed to play track: ${error.message}`);
    }
}
  // Join voice channel and setup connection
  async joinVoiceChannel(voiceChannel) {
    const guildId = voiceChannel.guild.id;
    
    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      this._initPlayer(guildId);

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch (error) {
          this.cleanup(guildId);
        }
      });

      return connection;
    } catch (error) {
      console.error(`[JoinVoice Error] Guild ${guildId}:`, error);
      throw error;
    }
  }

  // Main play method
  async play(voiceChannel, url, options = {}) {
    const guildId = voiceChannel.guild.id;
    console.log("url",)
    try {
      // Validate URL using play-dl
      const isYoutubeUrl = play.yt_validate(url);
      if (!isYoutubeUrl) {
        throw new Error('Invalid YouTube URL');
      }

      // Get video info using play-dl
      const info = await play.video_info(url);
      const track = {
        url,
        title: info.video_details.title,
        duration: info.video_details.durationInSec,
        requestedBy: options.requestedBy,
      };

      // Initialize player if needed
      this._initPlayer(guildId);

      // Join voice channel if not already connected
      if (!getVoiceConnection(guildId)) {
        await this.joinVoiceChannel(voiceChannel);
      }

      const queue = this.queues.get(guildId);
      const player = this.players.get(guildId);

      // Add to queue
      queue.push(track);
      this.emit('trackAdd', { guildId, track });

      // If nothing is playing, start playback
      if (player.state.status === AudioPlayerStatus.Idle) {
        const nextTrack = queue.shift();
        this.nowPlaying.set(guildId, nextTrack);
        await this._playTrack(guildId, nextTrack);
        return { 
          message: `🎵 Now playing: **${nextTrack.title}**`,
          track: nextTrack,
        };
      }

      return { 
        message: `🎶 Added to queue: **${track.title}** (Position ${queue.length})`,
        track,
      };

    } catch (error) {
      console.error(`[Play Error] Guild ${guildId}:`, error);
      throw error;
    }
  }

  // Skip current track
  async skip(guildId) {
    const player = this.players.get(guildId);
    if (!player) throw new Error('No player for this guild');
    
    player.stop();
    return { message: '⏭ Skipped current track' };
  }

  // Stop playback and clear queue
  async stop(guildId) {
    const player = this.players.get(guildId);
    if (player) player.stop();
    
    this.queues.set(guildId, []);
    this.nowPlaying.delete(guildId);
    
    return { message: '⏹ Stopped playback and cleared queue' };
  }

  // Pause playback
  async pause(guildId) {
    const player = this.players.get(guildId);
    if (!player) throw new Error('No player for this guild');
    
    player.pause();
    return { message: '⏸ Playback paused' };
  }

  // Resume playback
  async resume(guildId) {
    const player = this.players.get(guildId);
    if (!player) throw new Error('No player for this guild');
    
    player.unpause();
    return { message: '▶ Playback resumed' };
  }

  // Set repeat mode
  async setRepeatMode(guildId, mode) {
    if (!['off', 'song', 'queue'].includes(mode)) {
      throw new Error('Invalid repeat mode. Use off/song/queue');
    }
    
    this.repeatModes.set(guildId, mode);
    return { message: `🔁 Repeat mode set to ${mode}` };
  }

  // Get current queue
  async getQueue(guildId) {
    const current = this.nowPlaying.get(guildId);
    const queue = this.queues.get(guildId) || [];
    const repeatMode = this.repeatModes.get(guildId) || 'off';
    
    return { current, queue, repeatMode };
  }

  // Cleanup resources for a guild
  cleanup(guildId) {
    const connection = getVoiceConnection(guildId);
    if (connection) connection.destroy();
    
    this.players.delete(guildId);
    this.queues.delete(guildId);
    this.nowPlaying.delete(guildId);
    this.repeatModes.delete(guildId);
    
    this.emit('cleanup', guildId);
  }

  // Set volume (0-100)
  async setVolume(guildId, volume) {
    const player = this.players.get(guildId);
    if (!player) throw new Error('No player for this guild');
    
    const clampedVolume = Math.min(Math.max(volume, 0), 100);
    const volumeDecimal = clampedVolume / 100;
    
    const resource = player.state.resource;
    if (resource) {
      resource.volume.setVolume(volumeDecimal);
      return { message: `🔊 Volume set to ${clampedVolume}%` };
    }
    
    throw new Error('No audio resource to adjust volume');
  }
}

module.exports = MusicService;