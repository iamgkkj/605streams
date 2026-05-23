/**
 * player.js - HTML5 Video Player and HLS.js Integration Module
 */

let video = null;
let hlsInstance = null;
let eventCallbacks = {};

/**
 * Trigger an event callback if registered
 * @param {string} eventName 
 * @param {any} data 
 */
function trigger(eventName, data) {
  if (eventCallbacks[eventName]) {
    eventCallbacks[eventName](data);
  }
}

/**
 * Cleans up and destroys the active Hls.js instance if it exists
 */
function destroyHls() {
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
}

/**
 * Initializes the video player and registers native video events.
 * 
 * @param {HTMLVideoElement} videoElement - The video element in the DOM
 * @param {Object} callbacks - Event callback functions (onTimeUpdate, onDurationChange, onBufferProgress, onStateChange, onError)
 */
export function initPlayer(videoElement, callbacks = {}) {
  if (!videoElement) {
    throw new Error('Video element is required to initialize player.');
  }

  video = videoElement;
  eventCallbacks = callbacks;

  // Bind video element event listeners
  video.addEventListener('play', () => trigger('onStateChange', { playing: true }));
  video.addEventListener('pause', () => trigger('onStateChange', { playing: false }));
  video.addEventListener('ended', () => trigger('onStateChange', { playing: false }));
  
  video.addEventListener('waiting', () => trigger('onBuffering', { buffering: true }));
  video.addEventListener('playing', () => trigger('onBuffering', { buffering: false }));
  video.addEventListener('canplay', () => trigger('onBuffering', { buffering: false }));

  video.addEventListener('timeupdate', () => {
    trigger('onTimeUpdate', {
      currentTime: video.currentTime,
      duration: video.duration || 0
    });
  });

  video.addEventListener('durationchange', () => {
    trigger('onDurationChange', {
      duration: video.duration || 0
    });
  });

  video.addEventListener('progress', () => {
    if (video.buffered && video.buffered.length > 0) {
      // Find the buffered range that covers current time
      let bufferedEnd = 0;
      const currentTime = video.currentTime;
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= currentTime && currentTime <= video.buffered.end(i)) {
          bufferedEnd = video.buffered.end(i);
          break;
        }
      }
      trigger('onBufferProgress', {
        bufferedEnd: bufferedEnd,
        duration: video.duration || 0
      });
    }
  });

  video.addEventListener('volumechange', () => {
    trigger('onVolumeChange', {
      volume: video.volume,
      muted: video.muted
    });
  });

  // Track fullscreen changes to sync custom icons
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);
}

/**
 * Handles fullscreen change events to notify the UI
 */
function handleFullscreenChange() {
  const isFullscreen = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
  trigger('onFullscreenChange', { isFullscreen });
}

/**
 * Loads a media stream URL (either .m3u8 HLS or standard mp4/webm)
 * 
 * @param {string} url - Direct video or streaming manifest URL
 */
export function loadStream(url) {
  if (!video) {
    throw new Error('Player not initialized. Call initPlayer first.');
  }

  // Stop current video and clear previous stream state
  video.pause();
  destroyHls();
  
  // Reset source
  video.removeAttribute('src');
  video.load();

  trigger('onBuffering', { buffering: true });

  const isHls = url.toLowerCase().includes('.m3u8') || url.includes('m3u8');

  if (isHls) {
    // Check if browser supports native HLS (e.g. Safari / iOS)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.load();
    } 
    // Otherwise, check if Hls.js is available and supported
    else if (window.Hls && window.Hls.isSupported()) {
      hlsInstance = new window.Hls({
        maxMaxBufferLength: 30, // Smooth buffering
        enableWorker: true,
        lowLatencyMode: false
      });

      hlsInstance.loadSource(url);
      hlsInstance.attachMedia(video);

      hlsInstance.on(window.Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
          switch (data.type) {
            case window.Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('Fatal network error in HLS, attempting recovery...', data);
              hlsInstance.startLoad();
              break;
            case window.Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('Fatal media error in HLS, attempting recovery...', data);
              hlsInstance.recoverMediaError();
              break;
            default:
              console.error('Fatal HLS error, cannot recover.', data);
              destroyHls();
              trigger('onError', { message: 'Failed to play HLS stream. Media is unsupported or broken.' });
              break;
          }
        }
      });
    } else {
      trigger('onError', { message: 'Your browser does not support HLS streaming (.m3u8).' });
    }
  } else {
    // Normal direct video stream (mp4, webm, etc.)
    video.src = url;
    video.load();
  }
}

/**
 * Play the current video
 */
export function play() {
  if (video) video.play().catch(err => console.warn('Play interrupted:', err));
}

/**
 * Pause the current video
 */
export function pause() {
  if (video) video.pause();
}

/**
 * Toggles between play and pause
 */
export function togglePlay() {
  if (!video) return;
  if (video.paused) {
    play();
  } else {
    pause();
  }
}

/**
 * Seek to a specific timestamp in seconds
 * @param {number} seconds 
 */
export function seek(seconds) {
  if (!video) return;
  
  // Constrain seconds between 0 and duration
  const duration = video.duration || 0;
  let targetTime = Math.max(0, Math.min(seconds, duration));
  
  video.currentTime = targetTime;
}

/**
 * Set player volume
 * @param {number} value - Floating point number between 0 and 1
 */
export function setVolume(value) {
  if (!video) return;
  video.volume = Math.max(0, Math.min(value, 1));
  if (video.volume > 0 && video.muted) {
    setMuted(false);
  }
}

/**
 * Set player mute state
 * @param {boolean} isMuted 
 */
export function setMuted(isMuted) {
  if (!video) return;
  video.muted = !!isMuted;
}

/**
 * Returns current volume state
 * @returns {Object} { volume: number, muted: boolean }
 */
export function getVolumeState() {
  if (!video) return { volume: 1, muted: false };
  return {
    volume: video.volume,
    muted: video.muted
  };
}

/**
 * Toggles player fullscreen state on the video container element
 * (Allows overlays like custom subtitles to remain visible)
 * 
 * @param {HTMLElement} containerElement - The wrapper container enclosing the video and subtitles overlay
 */
export function toggleFullscreen(containerElement) {
  if (!containerElement) return;

  const isFullscreen = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );

  if (!isFullscreen) {
    if (containerElement.requestFullscreen) {
      containerElement.requestFullscreen();
    } else if (containerElement.webkitRequestFullscreen) { /* Safari */
      containerElement.webkitRequestFullscreen();
    } else if (containerElement.msRequestFullscreen) { /* IE11 */
      containerElement.msRequestFullscreen();
    } else if (containerElement.mozRequestFullScreen) { /* Firefox */
      containerElement.mozRequestFullScreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    }
  }
}

/**
 * Exposes current state of player
 */
export function getPlayerState() {
  if (!video) return { currentTime: 0, duration: 0, paused: true };
  return {
    currentTime: video.currentTime,
    duration: video.duration || 0,
    paused: video.paused
  };
}
