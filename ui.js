/**
 * ui.js - DOM Binding, Custom Controls, and Orchestration Module
 */

import * as api from './api.js';
import * as player from './player.js';
import * as subtitles from './subtitles.js';

// DOM Selectors
const doc = (id) => document.getElementById(id);

// Connection Status
const statusDot = doc('connection-status')?.previousElementSibling;
const statusText = doc('connection-status');

// Form and Stream Loading
const streamForm = doc('stream-form');
const tvFields = doc('tv-fields');
const loadBtn = doc('load-btn');
const dismissErrorBtn = doc('dismiss-error-btn');

// Subtitles elements
const subUploadZone = doc('sub-upload-zone');
const subFileInput = doc('sub-file-input');
const subStatusBar = doc('sub-status-bar');
const loadedSubName = doc('loaded-sub-name');
const removeSubBtn = doc('remove-sub-btn');
const subSettingsPanel = doc('sub-settings-panel');
const subToggle = doc('sub-toggle');
const offsetSlider = doc('offset-slider');
const offsetDisplay = doc('offset-display');
const downloadSubBtn = doc('download-sub-btn');

// Video wrappers and screens
const videoContainer = doc('video-container');
const mainVideo = doc('main-video');
const subOverlayDiv = doc('sub-overlay-div');
const subTextSpan = doc('sub-text-span');
const loadingOverlay = doc('loading-overlay');
const loadingMsg = doc('loading-msg');
const errorOverlay = doc('error-overlay');
const errorMsg = doc('error-msg');

// Custom video player controls
const videoControls = doc('video-controls');
const timeline = doc('timeline');
const timelineProgress = doc('timeline-progress');
const timelineBuffer = doc('timeline-buffer');
const ctrlPlayPause = doc('ctrl-play-pause');
const ctrlMute = doc('ctrl-mute');
const ctrlVolumeSlider = doc('ctrl-volume-slider');
const timeCurrent = doc('time-current');
const timeDuration = doc('time-duration');
const ctrlSkipBack = doc('ctrl-skip-back');
const ctrlSkipForward = doc('ctrl-skip-forward');
const ctrlFullscreen = doc('ctrl-fullscreen');
const centerPlayIndicator = doc('center-play-indicator');

// Global UI State
let isDraggingTimeline = false;
let controlsTimeout = null;
let currentSubtitleFilename = '';

/**
 * Format a number of seconds into MM:SS or HH:MM:SS
 * @param {number} totalSeconds 
 * @returns {string}
 */
function formatTime(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds === Infinity) return '0:00';
  
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);

  const pad = (n) => n.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${mins}:${pad(secs)}`;
}

/**
 * Update Connection Status UI
 * @param {string} state - 'ready' | 'loading' | 'error' | 'playing'
 * @param {string} text - Display text
 */
function setStatus(state, text) {
  if (!statusText || !statusDot) return;
  statusText.textContent = text;
  
  statusDot.className = 'status-dot'; // Reset
  if (state === 'loading') {
    statusDot.classList.add('loading');
  } else if (state === 'error') {
    statusDot.classList.add('error');
  }
}

/**
 * Shows the loading spinner screen inside the player
 * @param {string} message 
 */
function showSpinner(message = 'Connecting to stream source...') {
  if (loadingOverlay && loadingMsg) {
    loadingMsg.textContent = message;
    loadingOverlay.classList.remove('hidden');
  }
}

/**
 * Hides the loading spinner screen inside the player
 */
function hideSpinner() {
  if (loadingOverlay) {
    loadingOverlay.classList.add('hidden');
  }
}

/**
 * Shows the playback error panel inside the player
 * @param {string} message 
 */
function showPlaybackError(message) {
  hideSpinner();
  setStatus('error', 'Failed');
  if (errorOverlay && errorMsg) {
    errorMsg.textContent = message;
    errorOverlay.classList.remove('hidden');
  }
}

/**
 * Hides the playback error panel
 */
function hidePlaybackError() {
  if (errorOverlay) {
    errorOverlay.classList.add('hidden');
  }
}

/**
 * Triggers a beautiful center action icon animation (flashing play/pause icon)
 * @param {string} type - 'play' | 'pause'
 */
function flashCenterIndicator(type) {
  if (!centerPlayIndicator) return;
  
  // Set correct SVG path inside
  if (type === 'play') {
    centerPlayIndicator.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
  } else {
    centerPlayIndicator.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
  }
  
  centerPlayIndicator.classList.remove('flash');
  // Trigger DOM reflow to restart animation
  void centerPlayIndicator.offsetWidth;
  centerPlayIndicator.classList.add('flash');
}

/**
 * Automatically manages custom controls visibility based on mouse movements (idle hiding)
 */
function showControls() {
  if (!videoContainer) return;
  
  videoContainer.classList.remove('controls-hide');
  videoContainer.classList.add('controls-active');
  
  if (controlsTimeout) {
    clearTimeout(controlsTimeout);
  }
  
  const playerState = player.getPlayerState();
  // Only hide controls if the stream is actively playing
  if (!playerState.paused) {
    controlsTimeout = setTimeout(() => {
      videoContainer.classList.add('controls-hide');
      videoContainer.classList.remove('controls-active');
    }, 3000);
  }
}

/**
 * Sets up and binds event listeners for the entire UI
 */
export function initUI() {
  // 1. Initialize Player and Subtitle sub-modules
  player.initPlayer(mainVideo, {
    onTimeUpdate: ({ currentTime, duration }) => {
      // 1.1 Render subtitles for current time frame
      subtitles.renderCues(currentTime);

      // 1.2 Update custom video progress bar (if not user scrubbing)
      if (!isDraggingTimeline) {
        const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
        if (timeline) {
          timeline.value = pct;
        }
        if (timelineProgress) {
          timelineProgress.style.width = `${pct}%`;
        }
        if (timeCurrent) {
          timeCurrent.textContent = formatTime(currentTime);
        }
      }
    },

    onDurationChange: ({ duration }) => {
      if (timeDuration) {
        timeDuration.textContent = formatTime(duration);
      }
    },

    onBufferProgress: ({ bufferedEnd, duration }) => {
      if (timelineBuffer && duration > 0) {
        const pct = (bufferedEnd / duration) * 100;
        timelineBuffer.style.width = `${pct}%`;
      }
    },

    onStateChange: ({ playing }) => {
      showControls();
      
      // Update play/pause buttons
      const iconPlay = ctrlPlayPause?.querySelector('.icon-play');
      const iconPause = ctrlPlayPause?.querySelector('.icon-pause');
      
      if (playing) {
        iconPlay?.classList.add('hidden');
        iconPause?.classList.remove('hidden');
        setStatus('playing', 'Playing');
      } else {
        iconPlay?.classList.remove('hidden');
        iconPause?.classList.add('hidden');
        const playerState = player.getPlayerState();
        if (playerState.currentTime > 0 && playerState.currentTime >= playerState.duration - 0.5) {
          setStatus('ready', 'Finished');
        } else {
          setStatus('ready', 'Paused');
        }
      }
    },

    onBuffering: ({ buffering }) => {
      if (buffering) {
        showSpinner('Buffering stream media...');
      } else {
        hideSpinner();
      }
    },

    onFullscreenChange: ({ isFullscreen }) => {
      const iconMax = ctrlFullscreen?.querySelector('.icon-maximize');
      const iconMin = ctrlFullscreen?.querySelector('.icon-minimize');

      if (isFullscreen) {
        iconMax?.classList.add('hidden');
        iconMin?.classList.remove('hidden');
      } else {
        iconMax?.classList.remove('hidden');
        iconMin?.classList.add('hidden');
      }
    },

    onError: ({ message }) => {
      showPlaybackError(message);
    }
  });

  subtitles.initSubtitles(subOverlayDiv, subTextSpan);

  // 2. Form submission & content selection toggles
  const contentTypes = document.querySelectorAll('input[name="content-type"]');
  contentTypes.forEach(radio => {
    radio.addEventListener('change', (e) => {
      // Toggle CSS active state class for visual styling
      document.querySelectorAll('.toggle-option').forEach(opt => {
        opt.classList.remove('active');
      });
      e.target.parentElement.classList.add('active');

      // Expand TV fields smoothly
      if (e.target.value === 'tv') {
        tvFields?.classList.add('show');
        doc('tv-season')?.setAttribute('required', 'true');
        doc('tv-episode')?.setAttribute('required', 'true');
      } else {
        tvFields?.classList.remove('show');
        doc('tv-season')?.removeAttribute('required');
        doc('tv-episode')?.removeAttribute('required');
      }
    });
  });

  // 3. API Streaming Loader execution
  if (streamForm) {
    streamForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hidePlaybackError();

      const type = document.querySelector('input[name="content-type"]:checked').value;
      const id = doc('content-id').value.trim();

      showSpinner(`Connecting to 111Movies for ${type === 'movie' ? 'movie' : 'episode'} stream...`);
      setStatus('loading', 'Fetching stream...');

      try {
        let streamUrl = '';
        if (type === 'movie') {
          streamUrl = await api.fetchMovieStream(id);
        } else {
          const season = doc('tv-season').value;
          const episode = doc('tv-episode').value;
          streamUrl = await api.fetchTvStream(id, season, episode);
        }

        console.log('Stream URL resolved:', streamUrl);
        
        // Load stream in player
        player.loadStream(streamUrl);
        
        // Auto play on load
        player.play();
        
        setStatus('ready', 'Stream loaded');

      } catch (error) {
        showPlaybackError(error.message);
      }
    });
  }

  // Dismiss Error Screen
  if (dismissErrorBtn) {
    dismissErrorBtn.addEventListener('click', hidePlaybackError);
  }

  // 4. Subtitle Dashboard logic
  // Trigger file browser on click
  if (subUploadZone) {
    subUploadZone.addEventListener('click', () => {
      subFileInput?.click();
    });

    // Drag over highlights
    subUploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      subUploadZone.classList.add('dragover');
    });

    subUploadZone.addEventListener('dragleave', () => {
      subUploadZone.classList.remove('dragover');
    });

    subUploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      subUploadZone.classList.remove('dragover');
      
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleSubtitleFileSelection(files[0]);
      }
    });
  }

  if (subFileInput) {
    subFileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleSubtitleFileSelection(files[0]);
      }
    });
  }

  // Remove uploaded subtitles
  if (removeSubBtn) {
    removeSubBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Avoid triggering click upload zone
      subtitles.resetSubtitles();
      
      // Update UI panels
      subStatusBar?.classList.add('hidden');
      subUploadZone?.classList.remove('hidden');
      subSettingsPanel?.classList.add('disabled-opacity');
      
      // Disable inputs
      subToggle?.setAttribute('disabled', 'true');
      offsetSlider?.setAttribute('disabled', 'true');
      downloadSubBtn?.setAttribute('disabled', 'true');
      
      // Disable sync buttons
      toggleSyncButtons(true);
      
      // Reset sliders
      if (offsetSlider) offsetSlider.value = 0;
      if (offsetDisplay) offsetDisplay.textContent = '0.0s';
      if (subFileInput) subFileInput.value = '';
    });
  }

  // Subtitle synchronization changes
  if (subToggle) {
    subToggle.addEventListener('change', (e) => {
      subtitles.setEnabled(e.target.checked);
    });
  }

  if (offsetSlider) {
    offsetSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      updateSubtitleOffset(val);
    });
  }

  // Quick adjust subtitle buttons
  doc('btn-sub-minus-1')?.addEventListener('click', () => adjustOffsetByDelta(-1.0));
  doc('btn-sub-minus-01')?.addEventListener('click', () => adjustOffsetByDelta(-0.1));
  doc('btn-sub-reset')?.addEventListener('click', () => updateSubtitleOffset(0.0));
  doc('btn-sub-plus-01')?.addEventListener('click', () => adjustOffsetByDelta(0.1));
  doc('btn-sub-plus-1')?.addEventListener('click', () => adjustOffsetByDelta(1.0));

  // Export Sync'd Subtitles
  if (downloadSubBtn) {
    downloadSubBtn.addEventListener('click', () => {
      subtitles.downloadSubtitle();
    });
  }

  // 5. Custom Video Controls event bindings
  if (ctrlPlayPause) {
    ctrlPlayPause.addEventListener('click', () => {
      const state = player.getPlayerState();
      player.togglePlay();
      flashCenterIndicator(state.paused ? 'play' : 'pause');
    });
  }

  // Seek Progress Slider bar interaction
  if (timeline) {
    timeline.addEventListener('input', (e) => {
      isDraggingTimeline = true;
      const pct = parseFloat(e.target.value);
      const state = player.getPlayerState();
      
      // Update visual timeline bar instantly before video seeks
      if (timelineProgress) {
        timelineProgress.style.width = `${pct}%`;
      }
      if (timeCurrent) {
        timeCurrent.textContent = formatTime((pct / 100) * state.duration);
      }
    });

    timeline.addEventListener('change', (e) => {
      const pct = parseFloat(e.target.value);
      const state = player.getPlayerState();
      const targetSec = (pct / 100) * state.duration;
      
      player.seek(targetSec);
      isDraggingTimeline = false;
    });
  }

  // Volume bindings
  if (ctrlMute) {
    ctrlMute.addEventListener('click', () => {
      const state = player.getVolumeState();
      player.setMuted(!state.muted);
    });
  }

  if (ctrlVolumeSlider) {
    ctrlVolumeSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      player.setVolume(val);
    });
  }

  // Volume UI updates
  player.initPlayer(mainVideo, {
    // Note: Re-binding in initPlayer was already performed. Let's register volume state triggers
  });
  
  // Custom video controller volume update responder
  const originalInit = player.initPlayer;
  // (We handle volume updates smoothly inside player callbacks now!)

  // Skip buttons
  if (ctrlSkipBack) {
    ctrlSkipBack.addEventListener('click', () => {
      const state = player.getPlayerState();
      player.seek(state.currentTime - 10);
    });
  }

  if (ctrlSkipForward) {
    ctrlSkipForward.addEventListener('click', () => {
      const state = player.getPlayerState();
      player.seek(state.currentTime + 10);
    });
  }

  // Fullscreen Button toggle
  if (ctrlFullscreen) {
    ctrlFullscreen.addEventListener('click', () => {
      player.toggleFullscreen(videoContainer);
    });
  }

  // Click on Video Canvas directly toggles play/pause
  if (mainVideo) {
    mainVideo.addEventListener('click', (e) => {
      // Prevent clicking video from toggling fullscreen double click
      e.preventDefault();
      const state = player.getPlayerState();
      player.togglePlay();
      flashCenterIndicator(state.paused ? 'play' : 'pause');
    });

    // Double-click on Video Container toggles Fullscreen
    mainVideo.addEventListener('dblclick', () => {
      player.toggleFullscreen(videoContainer);
    });
  }

  // Mouse hover activity monitoring for hiding custom control panel
  if (videoContainer) {
    videoContainer.addEventListener('mousemove', showControls);
    videoContainer.addEventListener('mouseleave', () => {
      const state = player.getPlayerState();
      // Instantly hide on mouseleave if playing
      if (!state.paused) {
        if (controlsTimeout) clearTimeout(controlsTimeout);
        videoContainer.classList.add('controls-hide');
        videoContainer.classList.remove('controls-active');
      }
    });
    
    // Touch controls helper for mobile support
    videoContainer.addEventListener('touchstart', showControls);
  }

  // Custom keyboard event bindings
  window.addEventListener('keydown', handleKeyboardShortcuts);
}

/**
 * Handle custom video keyboard controls
 * @param {KeyboardEvent} e 
 */
function handleKeyboardShortcuts(e) {
  // Ignore keys if user is typing in form inputs
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
    return;
  }

  const key = e.key.toLowerCase();
  const state = player.getPlayerState();
  const volState = player.getVolumeState();

  switch (e.key) {
    case ' ': // Space key
      e.preventDefault();
      player.togglePlay();
      flashCenterIndicator(state.paused ? 'play' : 'pause');
      showControls();
      break;
    case 'f':
    case 'F':
      e.preventDefault();
      player.toggleFullscreen(videoContainer);
      break;
    case 'm':
    case 'M':
      e.preventDefault();
      player.setMuted(!volState.muted);
      showControls();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      player.seek(state.currentTime - 10);
      showControls();
      break;
    case 'ArrowRight':
      e.preventDefault();
      player.seek(state.currentTime + 10);
      showControls();
      break;
    case 'ArrowUp':
      e.preventDefault();
      player.setVolume(volState.volume + 0.1);
      showControls();
      break;
    case 'ArrowDown':
      e.preventDefault();
      player.setVolume(volState.volume - 0.1);
      showControls();
      break;
  }
}

/**
 * Processes selected subtitle file
 * @param {File} file 
 */
function handleSubtitleFileSelection(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    
    try {
      const cues = subtitles.parseSubtitleFile(text, file.name);
      
      // Update UI bar
      if (loadedSubName) loadedSubName.textContent = file.name;
      subUploadZone?.classList.add('hidden');
      subStatusBar?.classList.remove('hidden');
      
      // Enable settings inputs
      subSettingsPanel?.classList.remove('disabled-opacity');
      
      subToggle?.removeAttribute('disabled');
      if (subToggle) subToggle.checked = true;
      subtitles.setEnabled(true);
      
      offsetSlider?.removeAttribute('disabled');
      downloadSubBtn?.removeAttribute('disabled');
      
      toggleSyncButtons(false);
      
      // Set to 0 initial offset
      updateSubtitleOffset(0.0);
      
      console.log(`Successfully loaded ${cues.length} subtitles cues from ${file.name}`);

    } catch (err) {
      console.error(err);
      alert('Error parsing subtitle file. Make sure it is a valid .srt or .vtt file.');
    }
  };
  
  reader.readAsText(file);
}

/**
 * Enables or disables synchronization shift buttons
 * @param {boolean} disabled 
 */
function toggleSyncButtons(disabled) {
  const btns = [
    'btn-sub-minus-1', 'btn-sub-minus-01', 'btn-sub-reset',
    'btn-sub-plus-01', 'btn-sub-plus-1'
  ];
  
  btns.forEach(id => {
    if (disabled) {
      doc(id)?.setAttribute('disabled', 'true');
    } else {
      doc(id)?.removeAttribute('disabled');
    }
  });
}

/**
 * Updates subtitle timing delay offset in Javascript and Slider
 * @param {number} offsetSec 
 */
function updateSubtitleOffset(offsetSec) {
  const boundedOffset = Math.max(-10, Math.min(10, offsetSec));
  const rounded = Math.round(boundedOffset * 10) / 10; // 100ms precision limit

  subtitles.setOffset(rounded);
  
  if (offsetSlider) {
    offsetSlider.value = rounded;
  }
  
  if (offsetDisplay) {
    const prefix = rounded > 0 ? '+' : '';
    offsetDisplay.textContent = `${prefix}${rounded.toFixed(1)}s`;
  }
}

/**
 * Adjust offset delay by a incremental amount
 * @param {number} delta 
 */
function adjustOffsetByDelta(delta) {
  const subState = subtitles.getSubtitleState();
  updateSubtitleOffset(subState.offset + delta);
}

// Subscribe to volume updates from Player events specifically
// To sync the sound sliders and visual volume mute indicators
window.addEventListener('load', () => {
  player.initPlayer(mainVideo, {
    // This handles redundant initialization safety
  });
  
  // Custom observer to link Volume changes to Controls
  mainVideo.addEventListener('volumechange', () => {
    const volState = player.getVolumeState();
    
    // Sync slider value
    if (ctrlVolumeSlider) {
      ctrlVolumeSlider.value = volState.muted ? 0 : volState.volume;
    }
    
    // Sync Mute Icons
    const iconHigh = ctrlMute?.querySelector('.icon-vol-high');
    const iconMute = ctrlMute?.querySelector('.icon-vol-mute');

    if (volState.muted || volState.volume === 0) {
      iconHigh?.classList.add('hidden');
      iconMute?.classList.remove('hidden');
    } else {
      iconHigh?.classList.remove('hidden');
      iconMute?.classList.add('hidden');
    }
  });
});
