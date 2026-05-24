/**
 * api.js - Simplified Embed URL Builder API
 * Seamlessly transitions 605streams to secure iframe embeds for https://111movies.com.
 * Fully preserves console debugging hooks and manual stream bypass overrides.
 */

const BASE_URL = 'https://111movies.com';

// Module state variables
let isDebug = false;
let manualStreamUrl = null;

/**
 * Checks whether debug logging is enabled.
 * Activated by URL query param `?debug=true` or localStorage key `605streams_debug === 'true'`.
 * @returns {boolean}
 */
export function isDebugEnabled() {
  if (isDebug) return true;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('debug') && urlParams.get('debug') !== 'false') {
      return true;
    }
    if (localStorage.getItem('605streams_debug') === 'true') {
      return true;
    }
  } catch (_) {
    // Gracefully handle private browser sandboxes blocking localStorage access
  }
  return false;
}

/**
 * Prints color-coded debug messages to console if debug mode is active.
 * @param {string} message - Primary log description
 * @param {...any} args - Supporting objects or strings
 */
export function debugLog(message, ...args) {
  if (isDebugEnabled()) {
    console.log(
      `%c[605streams-DEBUG]%c ${message}`,
      'color: #06b6d4; font-weight: 800; background: rgba(6, 182, 212, 0.08); padding: 2px 6px; border-radius: 4px;',
      'color: #e2e8f0; font-weight: 500;',
      ...args
    );
  }
}

/**
 * Enables or disables verbose debug logs.
 * Exposed as command: API.setDebug(true/false)
 * @param {boolean} value 
 */
export function setDebug(value) {
  isDebug = !!value;
  if (isDebug) {
    localStorage.setItem('605streams_debug', 'true');
    console.log('%c[605streams] API Debug Logging Enabled.', 'color: #10b981; font-weight: bold;');
  } else {
    localStorage.removeItem('605streams_debug');
    console.log('%c[605streams] API Debug Logging Disabled.', 'color: #ef4444; font-weight: bold;');
  }
}

/**
 * Configures an active manual stream URL override, bypassing all future API fetches.
 * Exposed as command: API.setManualStreamUrl(url)
 * @param {string} url - Direct video address
 */
export function setManualStreamUrl(url) {
  manualStreamUrl = url && url.trim() !== '' ? url.trim() : null;
  if (manualStreamUrl) {
    sessionStorage.setItem('605streams_manual_url', manualStreamUrl);
    console.log(`%c[605streams] Manual Stream URL Set: ${manualStreamUrl}`, 'color: #f59e0b; font-weight: bold;');
  } else {
    sessionStorage.removeItem('605streams_manual_url');
    console.log('%c[605streams] Manual Stream URL Cleared.', 'color: #ef4444; font-weight: bold;');
  }
}

/**
 * Clears any active manual stream URL override.
 * Exposed as command: API.clearManualStreamUrl()
 */
export function clearManualStreamUrl() {
  manualStreamUrl = null;
  sessionStorage.removeItem('605streams_manual_url');
  console.log('%c[605streams] Manual Stream URL Cleared.', 'color: #ef4444; font-weight: bold;');
}

/**
 * Retrieves the currently active manual stream override address.
 * Looks up session memory cache as fallback.
 * @returns {string|null}
 */
export function getManualStreamUrl() {
  if (!manualStreamUrl) {
    manualStreamUrl = sessionStorage.getItem('605streams_manual_url');
  }
  return manualStreamUrl;
}

/**
 * Returns the embedded player iframe URL for a movie ID.
 * Supports IMDb ID (tt6263850) or TMDb numeric (533535) directly.
 * 
 * @param {string} id - Movie identifier
 * @returns {string} - Embedded target URL
 */
export function getMovieUrl(id) {
  return `${BASE_URL}/movie/${id}`;
}

/**
 * Returns the embedded player iframe URL for a TV episode.
 * Supports IMDb ID (tt0903747) or TMDb numeric directly.
 * 
 * @param {string} id - TV Series identifier
 * @param {number|string} season - Season number
 * @param {number|string} episode - Episode number
 * @returns {string} - Embedded target URL
 */
export function getTvUrl(id, season, episode) {
  return `${BASE_URL}/tv/${id}/${season}/${episode}`;
}

/**
 * Resolves movie stream URLs. Returns manual override directly if active.
 * Maintains compatibility signature with standard ui.js loaders.
 * 
 * @param {string} id - Movie ID
 * @returns {Promise<string>} - Iframe source target
 */
export async function fetchMovieStream(id) {
  const manual = getManualStreamUrl();
  if (manual) {
    debugLog(`[Manual Override] Active. Returning: ${manual}`);
    return manual;
  }

  if (!id || id.trim() === '') {
    throw new Error('Movie ID is required.');
  }

  const cleanId = id.trim();
  const url = getMovieUrl(cleanId);
  debugLog(`Resolved movie embed url: ${url}`);
  return url;
}

/**
 * Resolves TV episode stream URLs. Returns manual override directly if active.
 * Maintains compatibility signature with standard ui.js loaders.
 * 
 * @param {string} id - TV Series ID
 * @param {number|string} season - Season number
 * @param {number|string} episode - Episode number
 * @returns {Promise<string>} - Iframe source target
 */
export async function fetchTvStream(id, season, episode) {
  const manual = getManualStreamUrl();
  if (manual) {
    debugLog(`[Manual Override] Active. Returning: ${manual}`);
    return manual;
  }

  if (!id || id.trim() === '') {
    throw new Error('TV Show ID is required.');
  }
  if (!season || isNaN(parseInt(season))) {
    throw new Error('Valid season number is required.');
  }
  if (!episode || isNaN(parseInt(episode))) {
    throw new Error('Valid episode number is required.');
  }

  const cleanId = id.trim();
  const s = parseInt(season);
  const e = parseInt(episode);
  const url = getTvUrl(cleanId, s, e);
  debugLog(`Resolved TV episode embed url: ${url}`);
  return url;
}

// Bind custom global API namespace object on window for console control command requirements!
const API = {
  setDebug,
  setManualStreamUrl,
  clearManualStreamUrl,
  getManualStreamUrl,
  fetchMovieStream,
  fetchTvStream,
  getMovieUrl,
  getTvUrl
};

window.API = API;
export { API };
