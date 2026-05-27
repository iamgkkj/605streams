/**
 * ui.js - DOM Binding, Custom Controls, and Orchestration Module
 */

import * as api from './api.js';
import * as player from './player.js';
import * as subtitles from './subtitles.js';
import { getImdbId, getTvDetails } from './search.js';

// Auto-inject diagnostic debugger tools for developer consoles
import './api-debug.js';

// DOM Element References (Initialized dynamically in initUI to prevent timing issues)
const doc = (id) => document.getElementById(id);

let statusDot = null;
let statusText = null;
let streamForm = null;
let quickTvSelectors = null;
let quickSeason = null;
let quickEpisode = null;
let activeTvDetails = null;
let activeTvShowId = '';
let tvFields = null;
let loadBtn = null;
let subUploadZone = null;
let subFileInput = null;
let subStatusBar = null;
let loadedSubName = null;
let removeSubBtn = null;
let subSettingsPanel = null;
let subToggle = null;
let offsetSlider = null;
let offsetDisplay = null;
let downloadSubBtn = null;
let videoContainer = null;
let mainVideo = null;
let subOverlayDiv = null;
let subTextSpan = null;
let loadingOverlay = null;
let loadingMsg = null;
let errorOverlay = null;
let errorMsg = null;
let videoControls = null;
let timeline = null;
let timelineProgress = null;
let timelineBuffer = null;
let ctrlPlayPause = null;
let ctrlMute = null;
let ctrlVolumeSlider = null;
let timeCurrent = null;
let timeDuration = null;
let ctrlSkipBack = null;
let ctrlSkipForward = null;
let ctrlFullscreen = null;
let centerPlayIndicator = null;

// Global UI State
let isDraggingTimeline = false;
let controlsTimeout = null;

// Simulated Subtitle playback clock for Iframe Mode
let simulatedTime = 0;
let simulatedInterval = null;

function startSimulatedSubtitles() {
  if (simulatedInterval) clearInterval(simulatedInterval);
  simulatedInterval = setInterval(() => {
    simulatedTime += 0.1;
    subtitles.renderCues(simulatedTime);
  }, 100);
}

function stopSimulatedSubtitles() {
  if (simulatedInterval) {
    clearInterval(simulatedInterval);
    simulatedInterval = null;
  }
}

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
 * Shows a beautiful high-fidelity diagnostic error card based on failure type.
 * @param {Error} error - The consolidated Error object thrown by the API
 */
function showPlaybackError(error) {
  hideSpinner();
  setStatus('error', 'Failed');

  let errorTitle = 'Playback Error';
  let message = typeof error === 'string' ? error : error.message;
  let suggestionHtml = '';

  // Apply diagnostic categorizations
  if (error && typeof error === 'object') {
    if (error.type === 'CF_CAPTCHA') {
      errorTitle = 'Security Captcha Triggered';
      suggestionHtml = `
        <div class="error-suggestion">
          <p><strong>Required Action:</strong> 111Movies request blocked by Cloudflare verification.</p>
          <ol>
            <li>Open <a href="https://111movies.net" target="_blank" class="error-link">111movies.net</a> in another browser tab.</li>
            <li>Pass the Cloudflare CAPTCHA challenge.</li>
            <li>Return here and re-submit the <strong>Load Stream</strong> query.</li>
          </ol>
        </div>
      `;
    } else if (error.type === 'APP_ERROR') {
      errorTitle = 'Stream Temporarily Broken';
      const currentId = doc('content-id')?.value?.trim() || '';
      const toggledId = currentId.startsWith('tt') ? currentId.slice(2) : 'tt' + currentId;
      suggestionHtml = `
        <div class="error-suggestion">
          <p><strong>Troubleshooting Options:</strong> The service returned a client-side crash error for this ID.</p>
          <div class="error-actions">
            <button type="button" class="btn btn-secondary btn-sm btn-full" id="btn-quick-swap-id" data-swap-id="${toggledId}">
              Try Swapping ID format: "${toggledId}"
            </button>
            <p class="subtext">Or paste a direct stream URL into the <strong>Manual Override</strong> panel below.</p>
          </div>
        </div>
      `;
    } else if (error.type === 'NOT_FOUND') {
      errorTitle = 'Video Not Found (404)';
      suggestionHtml = `
        <div class="error-suggestion">
          <p><strong>Troubleshooting Options:</strong> The content was not located on the streaming server database.</p>
          <ol>
            <li>Check ID spelling on IMDb/TMDb.</li>
            <li>Try adding or removing the "tt" prefix.</li>
            <li>Verify if the show is available directly on 111movies.net.</li>
          </ol>
        </div>
      `;
    } else if (error.type === 'FETCH_FAILED') {
      errorTitle = 'Network Blocks / CORS Blocking';
      suggestionHtml = `
        <div class="error-suggestion">
          <p><strong>Troubleshooting Options:</strong> Browser failed to fetch the streaming manifest directly due to security policies.</p>
          <ol>
            <li>Run a local static server to resolve local files policy (e.g. <code>python3 -m http.server 8080</code>).</li>
            <li>Clear browser cache and retry.</li>
            <li>Manually find and paste the streaming URL directly below.</li>
          </ol>
        </div>
      `;
    }
  }

  // Populate overlay screen
  if (errorOverlay && errorMsg) {
    const errorContainer = errorOverlay.querySelector('.error-container');
    if (errorContainer) {
      errorContainer.innerHTML = `
        <div class="error-icon-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <h3 class="error-title">${errorTitle}</h3>
        <p class="error-message">${message}</p>
        ${suggestionHtml}
        <button class="btn btn-secondary btn-sm" id="dismiss-error-btn">Dismiss</button>
      `;

      // Re-bind dismiss action
      doc('dismiss-error-btn')?.addEventListener('click', hidePlaybackError);

      // Re-bind quick ID swap trigger
      const swapBtn = doc('btn-quick-swap-id');
      if (swapBtn) {
        swapBtn.addEventListener('click', (e) => {
          const newId = e.currentTarget.getAttribute('data-swap-id');
          if (doc('content-id')) {
            doc('content-id').value = newId;
            hidePlaybackError();
            streamForm.dispatchEvent(new Event('submit'));
          }
        });
      }
    }
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
  
  if (type === 'play') {
    centerPlayIndicator.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
  } else {
    centerPlayIndicator.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
  }
  
  centerPlayIndicator.classList.remove('flash');
  void centerPlayIndicator.offsetWidth; // Force Reflow
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
  // DOM element query lookups inside DOMContentLoaded initialization block
  statusDot = doc('connection-status')?.previousElementSibling;
  statusText = doc('connection-status');
  streamForm = doc('stream-form');
  tvFields = doc('tv-fields');
  
  // Resolve Quick TV Selectors
  quickTvSelectors = doc('quick-tv-selectors');
  quickSeason = doc('quick-season');
  quickEpisode = doc('quick-episode');

  // Bind Quick TV dropdown selectors listeners
  if (quickSeason && quickEpisode) {
    quickSeason.addEventListener('change', () => {
      const tvSeasonInput = doc('tv-season');
      if (tvSeasonInput) {
        tvSeasonInput.value = quickSeason.value;
      }
      // Reset episode to 1 on season switch for standard UX
      const tvEpisodeInput = doc('tv-episode');
      if (tvEpisodeInput) {
        tvEpisodeInput.value = '1';
        if (quickEpisode) quickEpisode.value = '1';
      }
      if (streamForm) {
        streamForm.dispatchEvent(new Event('submit'));
      }
    });

    quickEpisode.addEventListener('change', () => {
      const tvEpisodeInput = doc('tv-episode');
      if (tvEpisodeInput) {
        tvEpisodeInput.value = quickEpisode.value;
      }
      if (streamForm) {
        streamForm.dispatchEvent(new Event('submit'));
      }
    });
  }
  loadBtn = doc('load-btn');
  subUploadZone = doc('sub-upload-zone');
  subFileInput = doc('sub-file-input');
  subStatusBar = doc('sub-status-bar');
  loadedSubName = doc('loaded-sub-name');
  removeSubBtn = doc('remove-sub-btn');
  subSettingsPanel = doc('sub-settings-panel');
  subToggle = doc('sub-toggle');
  offsetSlider = doc('offset-slider');
  offsetDisplay = doc('offset-display');
  downloadSubBtn = doc('download-sub-btn');
  videoContainer = doc('video-container');
  mainVideo = doc('main-video');
  subOverlayDiv = doc('sub-overlay-div');
  subTextSpan = doc('sub-text-span');
  loadingOverlay = doc('loading-overlay');
  loadingMsg = doc('loading-msg');
  errorOverlay = doc('error-overlay');
  errorMsg = doc('error-msg');
  videoControls = doc('video-controls');
  timeline = doc('timeline');
  timelineProgress = doc('timeline-progress');
  timelineBuffer = doc('timeline-buffer');
  ctrlPlayPause = doc('ctrl-play-pause');
  ctrlMute = doc('ctrl-mute');
  ctrlVolumeSlider = doc('ctrl-volume-slider');
  timeCurrent = doc('time-current');
  timeDuration = doc('time-duration');
  ctrlSkipBack = doc('ctrl-skip-back');
  ctrlSkipForward = doc('ctrl-skip-forward');
  ctrlFullscreen = doc('ctrl-fullscreen');
  centerPlayIndicator = doc('center-play-indicator');

  // 1. Initialize Player and Subtitle sub-modules
  player.initPlayer(mainVideo, {
    onTimeUpdate: ({ currentTime, duration }) => {
      subtitles.renderCues(currentTime);

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

    onLoadStart: () => {
      showSpinner('Loading stream...');
      setStatus('loading', 'Loading...');
      hidePlaybackError();
    },

    onLoadComplete: () => {
      hideSpinner();
      setStatus('ready', 'Playing');
    },

    onError: (err) => {
      showPlaybackError(err);
    }
  });

  subtitles.initSubtitles(subOverlayDiv, subTextSpan);

  // 2. Form submission & content selection toggles
  const contentTypes = document.querySelectorAll('input[name="content-type"]');
  contentTypes.forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.querySelectorAll('.toggle-option').forEach(opt => {
        opt.classList.remove('active');
      });
      e.target.parentElement.classList.add('active');

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

      // Reset simulated subtitle timer on new load
      stopSimulatedSubtitles();
      simulatedTime = 0;

      const type = document.querySelector('input[name="content-type"]:checked').value;
      const id = doc('content-id').value.trim();

      const manualUrl = api.getManualStreamUrl();
      if (manualUrl) {
        api.debugLog('Manual override URL is active. Triggering direct override play.', manualUrl);
        showSpinner('Loading manual override stream...');
        setStatus('loading', 'Loading override...');
        try {
          player.loadStream(manualUrl);
          player.play();
          setStatus('ready', 'Manual override stream loaded');
          return;
        } catch (err) {
          showPlaybackError(err);
          return;
        }
      }

      showSpinner(`Connecting to 111Movies for ${type === 'movie' ? 'movie' : 'episode'} stream...`);
      setStatus('loading', 'Fetching stream...');

      try {
        let streamUrl = '';
        if (type === 'movie') {
          streamUrl = await api.fetchMovieStream(id);
          // Hide quick selectors for movies
          if (quickTvSelectors) {
            quickTvSelectors.classList.add('hidden');
          }
        } else {
          const season = doc('tv-season').value;
          const episode = doc('tv-episode').value;
          streamUrl = await api.fetchTvStream(id, season, episode);
          
          // Sync quick selectors for TV shows
          loadAndPopulateTvDropdowns(id, season, episode);
        }

        api.debugLog('Stream URL resolved:', streamUrl);
        
        player.loadStream(streamUrl);
        player.play();
        setStatus('ready', 'Stream loaded');

        // Update TV watch position in browser local cache
        if (type === 'tv') {
          const season = doc('tv-season').value;
          const episode = doc('tv-episode').value;
          updateTvRecentHistory(id, season, episode);
        }

      } catch (error) {
        showPlaybackError(error);
      }
    });
  }

  // Dismiss Error Screen
  doc('dismiss-error-btn')?.addEventListener('click', hidePlaybackError);

  // 4. Subtitle Dashboard logic
  if (subUploadZone) {
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

  if (removeSubBtn) {
    removeSubBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      subtitles.resetSubtitles();
      stopSimulatedSubtitles();
      simulatedTime = 0;
      
      subStatusBar?.classList.add('hidden');
      subUploadZone?.classList.remove('hidden');
      subSettingsPanel?.classList.add('disabled-opacity');
      
      subToggle?.setAttribute('disabled', 'true');
      offsetSlider?.setAttribute('disabled', 'true');
      downloadSubBtn?.setAttribute('disabled', 'true');
      
      toggleSyncButtons(true);
      
      if (offsetSlider) offsetSlider.value = 0;
      if (offsetDisplay) offsetDisplay.textContent = '0.0s';
      if (subFileInput) subFileInput.value = '';
    });
  }

  if (subToggle) {
    subToggle.addEventListener('change', (e) => {
      subtitles.setEnabled(e.target.checked);
      if (mainVideo && mainVideo.classList.contains('hidden')) {
        if (e.target.checked) {
          startSimulatedSubtitles();
        } else {
          stopSimulatedSubtitles();
        }
      }
    });
  }

  if (offsetSlider) {
    offsetSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      updateSubtitleOffset(val);
    });
  }

  doc('btn-sub-minus-1')?.addEventListener('click', () => adjustOffsetByDelta(-1.0));
  doc('btn-sub-minus-01')?.addEventListener('click', () => adjustOffsetByDelta(-0.1));
  doc('btn-sub-reset')?.addEventListener('click', () => updateSubtitleOffset(0.0));
  doc('btn-sub-plus-01')?.addEventListener('click', () => adjustOffsetByDelta(0.1));
  doc('btn-sub-plus-1')?.addEventListener('click', () => adjustOffsetByDelta(1.0));

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

  if (timeline) {
    timeline.addEventListener('input', (e) => {
      isDraggingTimeline = true;
      const pct = parseFloat(e.target.value);
      const state = player.getPlayerState();
      
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

  if (ctrlFullscreen) {
    ctrlFullscreen.addEventListener('click', () => {
      player.toggleFullscreen(videoContainer);
    });
  }

  if (mainVideo) {
    mainVideo.addEventListener('click', (e) => {
      e.preventDefault();
      const state = player.getPlayerState();
      player.togglePlay();
      flashCenterIndicator(state.paused ? 'play' : 'pause');
    });

    mainVideo.addEventListener('dblclick', () => {
      player.toggleFullscreen(videoContainer);
    });
  }

  if (videoContainer) {
    videoContainer.addEventListener('mousemove', showControls);
    videoContainer.addEventListener('mouseleave', () => {
      const state = player.getPlayerState();
      if (!state.paused) {
        if (controlsTimeout) clearTimeout(controlsTimeout);
        videoContainer.classList.add('controls-hide');
        videoContainer.classList.remove('controls-active');
      }
    });
    videoContainer.addEventListener('touchstart', showControls);
  }

  window.addEventListener('keydown', handleKeyboardShortcuts);

  // 6. Dedicated Collapsible Manual Override Card event bindings
  const overrideToggle = doc('override-toggle');
  const overrideContent = doc('override-content');
  const loadManualBtn = doc('load-manual-btn');
  const clearManualBtn = doc('clear-manual-btn');
  const manualStreamUrl = doc('manual-stream-url');
  const overrideStatusMsg = doc('override-status-msg');

  // Toggle Collapse panel
  if (overrideToggle && overrideContent) {
    overrideToggle.addEventListener('click', () => {
      const isExpanded = overrideToggle.getAttribute('aria-expanded') === 'true';
      overrideToggle.setAttribute('aria-expanded', !isExpanded);
      if (isExpanded) {
        overrideContent.classList.add('hidden');
      } else {
        overrideContent.classList.remove('hidden');
      }
    });
  }

  /**
   * Updates status messages within the manual override panel
   * @param {'success'|'error'|'clear'} type 
   * @param {string} [message] 
   */
  function setOverrideStatus(type, message) {
    if (!overrideStatusMsg) return;
    overrideStatusMsg.className = 'override-status'; // reset
    
    if (type === 'success') {
      overrideStatusMsg.classList.add('success');
      overrideStatusMsg.textContent = message;
      overrideStatusMsg.classList.remove('hidden');
    } else if (type === 'error') {
      overrideStatusMsg.classList.add('error');
      overrideStatusMsg.textContent = message;
      overrideStatusMsg.classList.remove('hidden');
    } else {
      overrideStatusMsg.classList.add('hidden');
    }
  }

  // Load manual stream (Apply Override)
  if (loadManualBtn && manualStreamUrl) {
    loadManualBtn.addEventListener('click', () => {
      const url = manualStreamUrl.value.trim();
      if (!url) {
        setOverrideStatus('error', 'Please paste a valid video URL first.');
        return;
      }

      try {
        // Configure in API module
        api.setManualStreamUrl(url);
        setOverrideStatus('success', 'Manual override applied successfully! System will bypass standard API loading.');
        
        // Clear old visual playback errors
        hidePlaybackError();

        // Smoothly collapse panel
        overrideToggle?.setAttribute('aria-expanded', 'false');
        overrideContent?.classList.add('hidden');

        // Automatically reload content into the Hls.js player
        if (streamForm) {
          streamForm.dispatchEvent(new Event('submit'));
        }
      } catch (err) {
        setOverrideStatus('error', `Failed to apply override: ${err.message}`);
      }
    });
  }

  // Clear manual stream
  if (clearManualBtn && manualStreamUrl) {
    clearManualBtn.addEventListener('click', () => {
      try {
        api.clearManualStreamUrl();
        manualStreamUrl.value = '';
        setOverrideStatus('success', 'Manual override cleared. System will query 111Movies API.');

        // Hide playback errors
        hidePlaybackError();

        // If an ID is present in standard input, automatically trigger reload
        const currentId = doc('content-id')?.value?.trim();
        if (currentId && streamForm) {
          streamForm.dispatchEvent(new Event('submit'));
        }
      } catch (err) {
        setOverrideStatus('error', `Failed to clear override: ${err.message}`);
      }
    });
  }

  // Check if there is an active session override URL on load and sync inputs
  const cachedUrl = api.getManualStreamUrl();
  if (cachedUrl && manualStreamUrl) {
    manualStreamUrl.value = cachedUrl;
    setOverrideStatus('success', 'Active session override URL loaded.');
  }

  // Parse URL parameters and auto-trigger stream load
  parseUrlParamsAndLoad();
}

/**
 * Handle custom video keyboard controls
 * @param {KeyboardEvent} e 
 */
function handleKeyboardShortcuts(e) {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
    return;
  }

  const state = player.getPlayerState();
  const volState = player.getVolumeState();

  switch (e.key) {
    case ' ':
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
    const arrayBuffer = e.target.result;
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // 1. Detect Byte Order Mark (BOM) for standard UTF encodings
    let encoding = 'utf-8';
    if (uint8Array[0] === 0xEF && uint8Array[1] === 0xBB && uint8Array[2] === 0xBF) {
      encoding = 'utf-8';
    } else if (uint8Array[0] === 0xFF && uint8Array[1] === 0xFE) {
      encoding = 'utf-16le';
    } else if (uint8Array[0] === 0xFE && uint8Array[1] === 0xFF) {
      encoding = 'utf-16be';
    }
    
    // 2. Decode using TextDecoder with fatal flag to trigger fallback on invalid UTF-8 sequences
    let text = '';
    try {
      const decoder = new TextDecoder(encoding, { fatal: true });
      text = decoder.decode(uint8Array);
    } catch (err) {
      // Fallback to windows-1252 (very common for European/Spanish/French subtitle files)
      const fallbackDecoder = new TextDecoder('windows-1252');
      text = fallbackDecoder.decode(uint8Array);
    }
    
    try {
      const cues = subtitles.parseSubtitleFile(text, file.name);
      
      if (loadedSubName) loadedSubName.textContent = file.name;
      subUploadZone?.classList.add('hidden');
      subStatusBar?.classList.remove('hidden');
      
      subSettingsPanel?.classList.remove('disabled-opacity');
      
      subToggle?.removeAttribute('disabled');
      if (subToggle) subToggle.checked = true;
      subtitles.setEnabled(true);
      
      offsetSlider?.removeAttribute('disabled');
      downloadSubBtn?.removeAttribute('disabled');
      
      toggleSyncButtons(false);
      updateSubtitleOffset(0.0);
      
      // Start simulated subtitle playback timer if we are in iframe mode (video is hidden)
      if (mainVideo && mainVideo.classList.contains('hidden')) {
        simulatedTime = 0;
        startSimulatedSubtitles();
      }

      console.log(`Successfully loaded ${cues.length} subtitles cues from ${file.name}`);

    } catch (err) {
      console.error(err);
      alert('Error parsing subtitle file. Make sure it is a valid .srt or .vtt file.');
    }
  };
  
  reader.readAsArrayBuffer(file);
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
  const rounded = Math.round(boundedOffset * 10) / 10;

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

// Subscribe to volume changes from Player events specifically
window.addEventListener('load', () => {
  mainVideo.addEventListener('volumechange', () => {
    const volState = player.getVolumeState();
    
    if (ctrlVolumeSlider) {
      ctrlVolumeSlider.value = volState.muted ? 0 : volState.volume;
    }
    
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

/**
 * Resolves query string parameters on mount, pre-fills visual controls and automatically triggers playback
 */
async function parseUrlParamsAndLoad() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const type = params.get('type');
  const title = params.get('title');
  const year = params.get('year');
  const rating = params.get('rating');

  // Pre-fill fields and trigger playback if id and type are specified
  if (id && type) {
    console.log(`Auto-loading param content: ${title} (${type})`);

    // 1. Populate top player header nav controls
    const infoTitle = doc('info-title');
    const infoYear = doc('info-year');
    const infoRating = doc('info-rating');

    if (infoTitle) {
      infoTitle.textContent = title || 'Loading stream...';
    }
    if (infoYear && year) {
      infoYear.textContent = year;
      infoYear.classList.remove('hidden');
    }
    if (infoRating && rating) {
      infoRating.textContent = `⭐ ${rating}`;
      infoRating.classList.remove('hidden');
    }

    // 2. Pre-fill Advanced manual loader fields
    if (doc('content-id')) {
      doc('content-id').value = id;
    }

    const typeRadio = document.querySelector(`input[name="content-type"][value="${type}"]`);
    if (typeRadio) {
      typeRadio.checked = true;
      typeRadio.dispatchEvent(new Event('change'));
    }

    if (type === 'tv') {
      const urlSeason = params.get('season') || '1';
      const urlEpisode = params.get('episode') || '1';
      if (doc('tv-season')) doc('tv-season').value = urlSeason;
      if (doc('tv-episode')) doc('tv-episode').value = urlEpisode;
      
      // Auto populate quick dropdowns in navbar
      loadAndPopulateTvDropdowns(id, urlSeason, urlEpisode);
    }

    // 3. Resolve TMDb to IMDb ID conversion if ID is numeric (not starting with 'tt')
    let activeId = id;
    if (!id.startsWith('tt')) {
      showSpinner('Resolving TMDb to IMDb ID...');
      try {
        const resolvedImdb = await getImdbId(id, type);
        if (resolvedImdb) {
          activeId = resolvedImdb;
          if (doc('content-id')) {
            doc('content-id').value = resolvedImdb;
          }
        }
      } catch (err) {
        console.warn('TMDb-to-IMDb conversion failed, using original ID:', err);
      }
    }

    // 4. Force Advanced collapsible wrapper to be closed initially for a premium cleaner view
    const advancedSection = doc('advanced-section');
    if (advancedSection) {
      advancedSection.removeAttribute('open');
    }

    // 5. Submit stream form to start playback
    if (streamForm) {
      streamForm.dispatchEvent(new Event('submit'));
    }
  } else {
    // If not auto-loading from home page navigation, open advanced form for custom entries
    const advancedSection = doc('advanced-section');
    if (advancedSection) {
      advancedSection.setAttribute('open', 'true');
    }
  }
}

/**
 * Updates continue watching TV episode positions in localStorage
 */
function updateTvRecentHistory(id, season, episode) {
  try {
    const recent = JSON.parse(localStorage.getItem('605streams_recent') || '[]');
    const index = recent.findIndex(item => item.id == id && item.type == 'tv');
    if (index !== -1) {
      recent[index].season = season;
      recent[index].episode = episode;
      recent[index].timestamp = Date.now();
      localStorage.setItem('605streams_recent', JSON.stringify(recent));
    }
  } catch (e) {
    console.error('Failed to update TV history position:', e);
  }
}

/**
 * Asynchronously loads TV series metadata from TMDB and populates quick selectors
 */
async function loadAndPopulateTvDropdowns(id, activeSeason, activeEpisode) {
  if (!id) return;
  
  if (activeTvShowId !== id || !activeTvDetails) {
    activeTvShowId = id;
    activeTvDetails = null;
    
    // Provide a neat inline loading placeholder in dropdowns
    if (quickSeason) quickSeason.innerHTML = '<option value="">Loading...</option>';
    if (quickEpisode) quickEpisode.innerHTML = '<option value="">Loading...</option>';
    
    try {
      activeTvDetails = await getTvDetails(id);
    } catch (err) {
      console.warn('Failed to load TV metadata details:', err);
    }
  }

  // Build selectors using the fetched metadata schema
  populateTvDropdownsWithData(activeSeason, activeEpisode);
}

/**
 * Builds custom Materialistic Option fields matching the exact seasons and episodes count
 */
function populateTvDropdownsWithData(activeSeason, activeEpisode) {
  if (!quickSeason || !quickEpisode) return;

  const currentSeason = parseInt(activeSeason) || 1;
  const currentEpisode = parseInt(activeEpisode) || 1;

  // 1. Resolve exact seasons bounds from TMDB data
  let totalSeasons = 5;
  let seasonsData = [];
  if (activeTvDetails) {
    totalSeasons = activeTvDetails.number_of_seasons || 5;
    seasonsData = activeTvDetails.seasons || [];
  }
  totalSeasons = Math.max(totalSeasons, currentSeason);

  // 2. Populate seasons list
  quickSeason.innerHTML = '';
  for (let s = 1; s <= totalSeasons; s++) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = `Season ${s}`;
    if (s === currentSeason) opt.selected = true;
    quickSeason.appendChild(opt);
  }

  // 3. Resolve exact episode counts for the currently selected season
  let totalEpisodes = 10;
  if (seasonsData.length > 0) {
    const targetSeason = seasonsData.find(item => item.season_number === currentSeason);
    if (targetSeason) {
      totalEpisodes = targetSeason.episode_count || 10;
    }
  }
  totalEpisodes = Math.max(totalEpisodes, currentEpisode);

  // 4. Populate episodes list
  quickEpisode.innerHTML = '';
  for (let e = 1; e <= totalEpisodes; e++) {
    const opt = document.createElement('option');
    opt.value = e;
    opt.textContent = `Episode ${e}`;
    if (e === currentEpisode) opt.selected = true;
    quickEpisode.appendChild(opt);
  }

  // Reveal selectors in header bar
  if (quickTvSelectors) {
    quickTvSelectors.classList.remove('hidden');
  }
}
