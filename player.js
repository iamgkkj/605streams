/**
 * player.js - Hybrid Player Engine Module
 * Supports dual-mode playback:
 * 1. Direct video playback (HLS .m3u8, HTML5 .mp4) using native <video>, Hls.js, custom control bars, and subtitle sync.
 * 2. Iframe embed playback (external domains e.g., 111movies.com) with loading spinner states, hiding custom control bars.
 */

import { debugLog } from './api.js';

let isHlsActive = false;
let hlsInstance = null;
let currentUrl = '';
let mainVideoElement = null;
let iframeElement = null;
let playerContainer = null;
let iframeContainer = null;

// Event callbacks bound by UI orchestrator
let callbacks = {
  onTimeUpdate: null,
  onDurationChange: null,
  onBufferProgress: null,
  onStateChange: null,
  onBuffering: null,
  onFullscreenChange: null,
  onError: null
};

/**
 * Initializes target elements and binds event listeners for direct video playback.
 * 
 * @param {HTMLVideoElement} videoEl - HTML5 Video element
 * @param {Object} options - Callback functions
 */
export function initPlayer(videoEl, options = {}) {
  mainVideoElement = videoEl;
  playerContainer = document.getElementById('video-container');
  iframeContainer = document.getElementById('iframe-container');
  
  // Set options callbacks
  callbacks = { ...callbacks, ...options };
  
  // Bind standard video tag listeners (only used in direct playback mode)
  if (mainVideoElement) {
    mainVideoElement.addEventListener('timeupdate', () => {
      if (callbacks.onTimeUpdate && !mainVideoElement.classList.contains('hidden')) {
        callbacks.onTimeUpdate({
          currentTime: mainVideoElement.currentTime,
          duration: mainVideoElement.duration
        });
      }
    });

    mainVideoElement.addEventListener('durationchange', () => {
      if (callbacks.onDurationChange && !mainVideoElement.classList.contains('hidden')) {
        callbacks.onDurationChange({ duration: mainVideoElement.duration });
      }
    });

    mainVideoElement.addEventListener('progress', () => {
      if (callbacks.onBufferProgress && !mainVideoElement.classList.contains('hidden') && mainVideoElement.buffered.length > 0) {
        callbacks.onBufferProgress({
          bufferedEnd: mainVideoElement.buffered.end(mainVideoElement.buffered.length - 1),
          duration: mainVideoElement.duration
        });
      }
    });

    const triggerStateChange = () => {
      if (callbacks.onStateChange && !mainVideoElement.classList.contains('hidden')) {
        callbacks.onStateChange({ playing: !mainVideoElement.paused });
      }
    };

    mainVideoElement.addEventListener('play', triggerStateChange);
    mainVideoElement.addEventListener('pause', triggerStateChange);
    mainVideoElement.addEventListener('playing', triggerStateChange);

    mainVideoElement.addEventListener('seeking', () => {
      if (callbacks.onBuffering && !mainVideoElement.classList.contains('hidden')) {
        callbacks.onBuffering({ buffering: true });
      }
    });

    mainVideoElement.addEventListener('seeked', () => {
      if (callbacks.onBuffering && !mainVideoElement.classList.contains('hidden')) {
        callbacks.onBuffering({ buffering: false });
      }
    });

    mainVideoElement.addEventListener('waiting', () => {
      if (callbacks.onBuffering && !mainVideoElement.classList.contains('hidden')) {
        callbacks.onBuffering({ buffering: true });
      }
    });

    mainVideoElement.addEventListener('error', () => {
      if (callbacks.onError && !mainVideoElement.classList.contains('hidden')) {
        callbacks.onError(new Error('HTML5 Video element failed to decode source.'));
      }
    });
  }

  // Bind full screen transitions on parent container wrapper
  document.addEventListener('fullscreenchange', () => {
    const isFullscreen = document.fullscreenElement === playerContainer;
    if (callbacks.onFullscreenChange) {
      callbacks.onFullscreenChange({ isFullscreen });
    }
  });
}

/**
 * Returns current playing source url (direct video or iframe embed).
 * Exposed as command: player.getCurrentUrl()
 * @returns {string}
 */
export function getCurrentUrl() {
  return currentUrl;
}

/**
 * Clears the active Hls.js instance safely.
 */
export function destroyHls() {
  if (hlsInstance) {
    debugLog('Destroying active Hls decoder instance.');
    hlsInstance.destroy();
    hlsInstance = null;
  }
  isHlsActive = false;
}

/**
 * Returns current play/pause states.
 * Only applicable in direct playback mode.
 * @returns {Object}
 */
export function getPlayerState() {
  if (mainVideoElement && !mainVideoElement.classList.contains('hidden')) {
    return {
      paused: mainVideoElement.paused,
      currentTime: mainVideoElement.currentTime,
      duration: mainVideoElement.duration
    };
  }
  // Safe defaults if playing iframe
  return { paused: true, currentTime: 0, duration: 0 };
}

/**
 * Returns current volume levels.
 * Only applicable in direct playback mode.
 * @returns {Object}
 */
export function getVolumeState() {
  if (mainVideoElement) {
    return {
      volume: mainVideoElement.volume,
      muted: mainVideoElement.muted
    };
  }
  return { volume: 1.0, muted: false };
}

/**
 * Toggles play/pause state.
 * Only applicable in direct playback mode.
 */
export function togglePlay() {
  if (mainVideoElement && !mainVideoElement.classList.contains('hidden')) {
    if (mainVideoElement.paused) {
      mainVideoElement.play().catch(() => {});
    } else {
      mainVideoElement.pause();
    }
  }
}

/**
 * Plays direct media feed.
 * Only applicable in direct playback mode.
 */
export function play() {
  if (mainVideoElement && !mainVideoElement.classList.contains('hidden')) {
    mainVideoElement.play().catch(() => {});
  }
}

/**
 * Pauses direct media feed.
 * Only applicable in direct playback mode.
 */
export function pause() {
  if (mainVideoElement && !mainVideoElement.classList.contains('hidden')) {
    mainVideoElement.pause();
  }
}

/**
 * Seeks to a specific playback position.
 * Only applicable in direct playback mode.
 * @param {number} timeSecs - Seconds position
 */
export function seek(timeSecs) {
  if (mainVideoElement && !mainVideoElement.classList.contains('hidden')) {
    const duration = mainVideoElement.duration || 0;
    const bounded = Math.max(0, Math.min(duration, timeSecs));
    mainVideoElement.currentTime = bounded;
  }
}

/**
 * Adjusts native volume levels.
 * Only applicable in direct playback mode.
 * @param {number} value - Volume between 0 and 1
 */
export function setVolume(value) {
  if (mainVideoElement) {
    const bounded = Math.max(0, Math.min(1, value));
    mainVideoElement.volume = bounded;
    mainVideoElement.muted = (bounded === 0);
  }
}

/**
 * Toggles volume mute status.
 * Only applicable in direct playback mode.
 * @param {boolean} muted 
 */
export function setMuted(muted) {
  if (mainVideoElement) {
    mainVideoElement.muted = !!muted;
  }
}

/**
 * Toggles fullscreen container wrapper mode.
 * Works perfectly on both native <video> elements and <iframe> embeddings.
 * @param {HTMLElement} containerEl 
 */
export function toggleFullscreen(containerEl) {
  const target = containerEl || playerContainer;
  if (!document.fullscreenElement) {
    target.requestFullscreen().catch((err) => {
      console.error('Fullscreen request rejected by browser:', err);
    });
  } else {
    document.exitFullscreen();
  }
}

/**
 * Loads a URL into either the iframe embedding container or Hls.js/HTML5 direct player.
 * Checks file extensions dynamically to switch player modes:
 * - If .m3u8, .mp4, etc. -> Direct mode (shows controls, enables local subtitles).
 * - Otherwise (standard movie/tv urls) -> Iframe embedding mode (auto-hides controls).
 * 
 * @param {string} url - Target URL/Source
 */
export function loadStream(url) {
  currentUrl = url;
  destroyHls();
  
  // Reset native video tags
  if (mainVideoElement) {
    mainVideoElement.pause();
    mainVideoElement.removeAttribute('src');
    mainVideoElement.load();
  }

  // Clear active iframe mounts
  if (iframeContainer) {
    iframeContainer.innerHTML = '';
  }

  // Check if target is a direct stream format (.m3u8, .mp4, .mkv, .webm)
  const isDirectVideo =
    url.toLowerCase().includes('.m3u8') ||
    url.toLowerCase().includes('.mp4') ||
    url.toLowerCase().includes('.mkv') ||
    url.toLowerCase().includes('.webm');

  const videoControls = document.getElementById('video-controls');
  const subOverlayDiv = document.getElementById('sub-overlay-div');
  const subtitleSection = document.getElementById('subtitle-config-card');

  if (isDirectVideo) {
    debugLog(`Direct Video stream detected: "${url}". Loading Hls/HTML5 module.`);
    
    // Toggle UI views: Hide iframe, reveal video elements and custom control bar
    if (iframeContainer) iframeContainer.classList.add('hidden');
    if (mainVideoElement) mainVideoElement.classList.remove('hidden');
    if (videoControls) videoControls.classList.remove('hidden');
    if (subOverlayDiv) subOverlayDiv.classList.remove('hidden');
    
    // Enable subtitle dashboard options
    if (subtitleSection) subtitleSection.classList.remove('disabled-opacity');

    if (url.toLowerCase().includes('.m3u8')) {
      if (Hls.isSupported()) {
        hlsInstance = new Hls({
          maxBufferLength: 30,
          maxMaxBufferLength: 600,
          enableWorker: true
        });
        hlsInstance.loadSource(url);
        hlsInstance.attachMedia(mainVideoElement);
        isHlsActive = true;

        hlsInstance.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                debugLog('Fatal Hls network error. Retrying load...');
                hlsInstance.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                debugLog('Fatal Hls media error. Recovering media codec...');
                hlsInstance.recoverMediaError();
                break;
              default:
                debugLog('Unrecoverable fatal Hls error. Resetting player...');
                destroyHls();
                if (callbacks.onError) callbacks.onError(new Error('Fatal streaming decode error.'));
                break;
            }
          }
        });
      } else if (mainVideoElement.canPlayType('application/vnd.apple.mpegurl')) {
        mainVideoElement.src = url;
      } else {
        if (callbacks.onError) callbacks.onError(new Error('CORS HLS playback not supported by browser.'));
      }
    } else {
      mainVideoElement.src = url;
    }
  } else {
    debugLog(`Iframe embed URL detected: "${url}". Creating embedding container.`);
    
    // Toggle UI views: Reveal iframe container, hide video elements and custom controls
    if (iframeContainer) iframeContainer.classList.remove('hidden');
    if (mainVideoElement) mainVideoElement.classList.add('hidden');
    if (videoControls) videoControls.classList.add('hidden');
    if (subOverlayDiv) subOverlayDiv.classList.add('hidden');
    
    // Subtitle upload dashboard disabled for iframes as requested
    if (subtitleSection) subtitleSection.classList.add('disabled-opacity');

    // Instantiation of the secure sandbox iframe
    iframeElement = document.createElement('iframe');
    iframeElement.src = url;
    iframeElement.className = 'stream-iframe';
    iframeElement.allowFullscreen = true;
    iframeElement.setAttribute('referrerpolicy', 'no-referrer');
    iframeElement.setAttribute('allow', 'autoplay; encrypted-media');
    
    // Trigger loader message
    if (callbacks.onBuffering) callbacks.onBuffering({ buffering: true });

    iframeElement.onload = () => {
      debugLog('Embed iframe loaded successfully.');
      if (callbacks.onBuffering) callbacks.onBuffering({ buffering: false });
    };

    iframeElement.onerror = () => {
      debugLog('Embed iframe loading failed.');
      if (callbacks.onBuffering) callbacks.onBuffering({ buffering: false });
      if (callbacks.onError) callbacks.onError(new Error(`Failed to load iframe url: ${url}`));
    };

    iframeContainer.appendChild(iframeElement);
  }
}
