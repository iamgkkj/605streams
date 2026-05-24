/**
 * api.js - CORS-Resilient and Format-Tolerant Streaming Client API
 * Bridges requests to 111Movies using fallback retries, multi-strategy parsers, and sequential CORS proxy loops.
 */

const BASE_URL = 'https://111movies.net';

// Module state variables
let isDebug = false;
let manualStreamUrl = null;

// CORS Proxy lists to iterate through sequentially upon direct connection blocking
const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
];

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
 * Validates whether a string is a valid HTTP/HTTPS URL.
 * @param {string} string 
 * @returns {boolean}
 */
export function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

/**
 * Validates whether a URL looks like a streamable media container file.
 * @param {string} string 
 * @returns {boolean}
 */
export function isVideoUrl(string) {
  if (!isValidUrl(string)) return false;
  const lower = string.toLowerCase();
  // Standard video container signatures
  return (
    lower.includes('.m3u8') ||
    lower.includes('.mp4') ||
    lower.includes('.mkv') ||
    lower.includes('.webm') ||
    lower.includes('.mov')
  );
}

/**
 * Resolves movie stream URLs using an aggressive, multi-strategy, fault-tolerant mechanism.
 * Attempts both raw and tt-prefixed ID variations sequentially upon primary failures.
 * 
 * @param {string} id - Movie IMDb ID (e.g. tt6263850) or TMDb ID (e.g. 293660)
 * @returns {Promise<string>} - The resolved video streaming URL
 */
export async function fetchMovieStream(id) {
  const manual = getManualStreamUrl();
  if (manual) {
    debugLog(`[Manual Override] Active. Bypassing API fetch and returning: ${manual}`);
    return manual;
  }

  if (!id || id.trim() === '') {
    throw new Error('Movie ID is required.');
  }

  const primaryId = id.trim();
  let secondaryId = '';

  if (primaryId.startsWith('tt')) {
    secondaryId = primaryId.slice(2);
  } else {
    secondaryId = 'tt' + primaryId;
  }

  debugLog(`Starting Movie load. Primary: "${primaryId}", Fallback: "${secondaryId}"`);

  try {
    debugLog(`Movie Attempt 1: Fetching primary ID "${primaryId}"...`);
    const streamUrl = await fetchStreamFromEndpoint(`${BASE_URL}/movie/${primaryId}`);
    debugLog(`Movie stream loaded successfully on primary ID: ${streamUrl}`);
    return streamUrl;
  } catch (primaryError) {
    debugLog(`Movie Primary ID failed: ${primaryError.message}. Initiating fallback search on ID "${secondaryId}"...`);
    try {
      const fallbackUrl = await fetchStreamFromEndpoint(`${BASE_URL}/movie/${secondaryId}`);
      debugLog(`Movie stream loaded successfully on fallback ID: ${fallbackUrl}`);
      return fallbackUrl;
    } catch (fallbackError) {
      debugLog(`Movie Fallback ID failed: ${fallbackError.message}`);
      throw consolidateErrors(primaryError, fallbackError, primaryId, secondaryId);
    }
  }
}

/**
 * Resolves TV episode stream URLs. Supports automatic IMDb <-> TMDb format fallbacks.
 * 
 * @param {string} id - TV Series IMDb ID or TMDb ID
 * @param {number|string} season - Season number
 * @param {number|string} episode - Episode number
 * @returns {Promise<string>} - The resolved video streaming URL
 */
export async function fetchTvStream(id, season, episode) {
  const manual = getManualStreamUrl();
  if (manual) {
    debugLog(`[Manual Override] Active. Bypassing API fetch and returning: ${manual}`);
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

  const primaryId = id.trim();
  let secondaryId = '';

  if (primaryId.startsWith('tt')) {
    secondaryId = primaryId.slice(2);
  } else {
    secondaryId = 'tt' + primaryId;
  }

  const s = parseInt(season);
  const e = parseInt(episode);

  debugLog(`Starting TV S${s}E${e} load. Primary: "${primaryId}", Fallback: "${secondaryId}"`);

  try {
    debugLog(`TV Attempt 1: Fetching primary ID "${primaryId}" S${s}E${e}...`);
    const streamUrl = await fetchStreamFromEndpoint(`${BASE_URL}/tv/${primaryId}/${s}/${e}`);
    debugLog(`TV stream loaded successfully on primary ID: ${streamUrl}`);
    return streamUrl;
  } catch (primaryError) {
    debugLog(`TV Primary ID S${s}E${e} failed: ${primaryError.message}. Initiating fallback search on ID "${secondaryId}"...`);
    try {
      const fallbackUrl = await fetchStreamFromEndpoint(`${BASE_URL}/tv/${secondaryId}/${s}/${e}`);
      debugLog(`TV stream loaded successfully on fallback ID: ${fallbackUrl}`);
      return fallbackUrl;
    } catch (fallbackError) {
      debugLog(`TV Fallback ID S${s}E${e} failed: ${fallbackError.message}`);
      throw consolidateErrors(primaryError, fallbackError, primaryId, secondaryId);
    }
  }
}

/**
 * Internal core retriever that queries a specific URL and applies prioritised
 * extraction strategies to dig out streamable video files or player embeds.
 * Resolves CORS blocks by automatically routing through proxy pools if direct fetching fails.
 * 
 * @param {string} url - Target URL to query
 * @returns {Promise<string>} - Extracted stream/embed URL
 */
async function fetchStreamFromEndpoint(url) {
  let response = null;
  let bodyText = '';
  let finalUrlTarget = '';

  // Setup sequential CORS proxy strategies
  const fetchStrategies = [
    {
      name: 'Direct Connection',
      fetcher: async () => {
        return await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
          }
        });
      }
    },
    {
      name: 'CORS Proxy Fallback (corsproxy.io)',
      fetcher: async () => {
        const proxy = CORS_PROXIES[0](url);
        return await fetch(proxy);
      }
    },
    {
      name: 'CORS Proxy Fallback (allorigins.win)',
      fetcher: async () => {
        const proxy = CORS_PROXIES[1](url);
        return await fetch(proxy);
      }
    }
  ];

  let lastError = null;

  // Sequentially try direct connection and then CORS proxies
  for (const strategy of fetchStrategies) {
    try {
      debugLog(`Attempting fetch via strategy: ${strategy.name}`);
      response = await strategy.fetcher();
      
      if (response && response.ok) {
        debugLog(`Fetch success via strategy: ${strategy.name}`);
        finalUrlTarget = response.url;
        bodyText = await response.text();
        break; // Stop immediately upon connection success!
      } else {
        const status = response ? response.status : 'Unknown status';
        debugLog(`Strategy ${strategy.name} returned non-OK status: ${status}`);
        lastError = new Error(`Server returned HTTP status ${status}`);
      }
    } catch (err) {
      debugLog(`Strategy ${strategy.name} threw connection error: ${err.message}`);
      lastError = err;
    }
  }

  // Handle failure in case no strategies resolved
  if (!bodyText) {
    if (window.location.protocol === 'file:') {
      const corsErr = new Error('Browser blocks API connection due to CORS rules under file:// protocol. Run Python server locally (python3 -m http.server 8080) or paste direct stream manifest below.');
      corsErr.type = 'FETCH_FAILED';
      throw corsErr;
    }
    const err = new Error(lastError ? lastError.message : 'Connection to streaming API failed due to CORS restriction or network block.');
    err.type = 'FETCH_FAILED';
    throw err;
  }

  const trimmedText = bodyText.trim();

  // Handle Empty Response
  if (!trimmedText) {
    const err = new Error('Server returned an empty text response body.');
    err.type = 'EMPTY_RESPONSE';
    throw err;
  }

  // DETECT SYSTEM ERRORS:
  // NextJS App Client-side Errors
  if (trimmedText.includes('Application error') && trimmedText.includes('client-side exception')) {
    const err = new Error('NextJS client-side exception page detected.');
    err.type = 'APP_ERROR';
    throw err;
  }

  // Cloudflare DDOS or Captcha pages
  if (
    trimmedText.includes('cf-challenge') || 
    trimmedText.includes('cloudflare') || 
    trimmedText.includes('Checking your browser') ||
    trimmedText.includes('Access denied')
  ) {
    const err = new Error('Cloudflare DDoS firewall challenge detected.');
    err.type = 'CF_CAPTCHA';
    throw err;
  }

  // STRATEGY 2: Check if response body is a direct video URL (plain text)
  if (isVideoUrl(trimmedText)) {
    debugLog('[Strategy 2] Success! Plain text is direct video URL:', trimmedText);
    return trimmedText;
  }

  // STRATEGY 3: Parse JSON responses for common video keys
  try {
    const parsed = JSON.parse(trimmedText);
    if (parsed && typeof parsed === 'object') {
      debugLog('Response parsed as JSON. Scanning keys...');
      const keys = ['url', 'stream', 'src', 'source', 'file', 'playlist', 'video', 'data', 'link'];
      
      for (const key of keys) {
        if (parsed[key] && typeof parsed[key] === 'string' && isValidUrl(parsed[key])) {
          debugLog(`[Strategy 3] Success! Found link in JSON key "${key}":`, parsed[key]);
          return parsed[key];
        }
      }

      // Check nested objects
      if (parsed.data && typeof parsed.data === 'object') {
        for (const key of keys) {
          if (parsed.data[key] && typeof parsed.data[key] === 'string' && isValidUrl(parsed.data[key])) {
            debugLog(`[Strategy 3] Success! Found link in JSON nested key "data.${key}":`, parsed.data[key]);
            return parsed.data[key];
          }
        }
      }
    }
  } catch (_) {
    // Ignore JSON parsing exceptions for HTML streams
  }

  // STRATEGY 4 & 5: Parse HTML documents
  if (bodyText.startsWith('<!DOCTYPE html>') || bodyText.includes('<html') || bodyText.includes('<body')) {
    debugLog('Response is HTML. Launching DOM Parser...');
    const domParser = new DOMParser();
    const doc = domParser.parseFromString(bodyText, 'text/html');

    // STRATEGY 4: Scan for embedded video players inside iframe tags
    const iframes = doc.querySelectorAll('iframe');
    debugLog(`Found ${iframes.length} iframes.`);
    for (const iframe of iframes) {
      const src = iframe.getAttribute('src');
      if (src && isValidUrl(src)) {
        const targetSrc = src.startsWith('//') ? 'https:' + src : src;
        debugLog('[Strategy 4] Success! Found player iframe source:', targetSrc);
        return targetSrc;
      }
    }

    // STRATEGY 5: Scan for native <source> or <video> media elements
    const sources = doc.querySelectorAll('source');
    debugLog(`Found ${sources.length} source elements.`);
    for (const source of sources) {
      const src = source.getAttribute('src');
      if (src && isValidUrl(src)) {
        debugLog('[Strategy 5] Success! Extracted <source> media URL:', src);
        return src;
      }
    }

    const videos = doc.querySelectorAll('video');
    debugLog(`Found ${videos.length} video elements.`);
    for (const video of videos) {
      const src = video.getAttribute('src');
      if (src && isValidUrl(src)) {
        debugLog('[Strategy 5] Success! Extracted <video> media URL:', src);
        return src;
      }
    }
  }

  // STRATEGY 6: Regular expression scan for direct streaming links in entire text
  debugLog('Scanning raw response with regex for stream signatures...');
  const videoRegex = /https?:\/\/[^\s"'`>]+?\.(m3u8|mp4|mkv)(?:[?#][^\s"'`>]*)?/gi;
  const videoMatches = bodyText.match(videoRegex);
  if (videoMatches && videoMatches.length > 0) {
    const match = videoMatches[0];
    debugLog('[Strategy 6] Success! Regex matched stream URL:', match);
    return match;
  }

  // STRATEGY 7: Check for embedded layout link formats (/embed/, /e/, /v/)
  debugLog('Scanning raw response with regex for embed links...');
  const embedRegex = /https?:\/\/[^\s"'`>]+?\/(?:embed|e|v)\/[^\s"'`>]+/gi;
  const embedMatches = bodyText.match(embedRegex);
  if (embedMatches && embedMatches.length > 0) {
    const match = embedMatches[0];
    debugLog('[Strategy 7] Success! Regex matched player embed pattern:', match);
    return match;
  }

  // Fallback: If redirected, return final redirect endpoint even if it didn't pass video filter
  if (finalUrlTarget && finalUrlTarget !== url && isValidUrl(finalUrlTarget)) {
    debugLog('[Strategy Fallback] Using redirected address:', finalUrlTarget);
    return finalUrlTarget;
  }

  // All strategies exhausted
  const err = new Error('The API returned a page, but no video files or player overlays were found.');
  err.type = 'UNPLAYABLE_HTML';
  throw err;
}

/**
 * Merges primary and fallback stream errors into a structured user-facing Error.
 * 
 * @param {Error} primary - Error thrown during main ID fetch
 * @param {Error} secondary - Error thrown during fallback ID fetch
 * @param {string} id1 - The primary ID queried
 * @param {string} id2 - The fallback ID queried
 * @returns {Error} - Consolidated error carrying properties
 */
function consolidateErrors(primary, secondary, id1, id2) {
  let message = '';
  let type = 'UNKNOWN';

  const isCaptcha = primary.type === 'CF_CAPTCHA' || secondary.type === 'CF_CAPTCHA';
  const isAppError = primary.type === 'APP_ERROR' || secondary.type === 'APP_ERROR';
  const isNotFound = primary.type === 'NOT_FOUND' && secondary.type === 'NOT_FOUND';
  const isFetchError = primary.type === 'FETCH_FAILED' || secondary.type === 'FETCH_FAILED';

  if (isCaptcha) {
    message = 'API request blocked by Cloudflare DDOS protection. To resolve this, open 111movies.net in a new tab, pass the captcha challenge, and then try loading the stream again.';
    type = 'CF_CAPTCHA';
  } else if (isAppError) {
    message = `111Movies returned an "Application Error" page for this content ID. The stream is temporarily offline. Try retry using alternate ID (TMDb numeric: ${id1.replace('tt', '')} or IMDb: tt${id1.replace('tt', '')}) or paste a direct stream URL below.`;
    type = 'APP_ERROR';
  } else if (isNotFound) {
    message = `Streaming source was not found (404) for both ID formats: "${id1}" and "${id2}". Verify the movie or TV show ID is valid.`;
    type = 'NOT_FOUND';
  } else if (isFetchError) {
    message = 'Connection to streaming API failed. This could be due to a CORS restriction or network block. Run http-server locally or use the manual override below.';
    type = 'FETCH_FAILED';
  } else {
    message = `Playback stream extraction failed. Primary ID "${id1}" Error: ${primary.message}. Secondary ID "${id2}" Error: ${secondary.message}.`;
    type = 'APP_ERROR';
  }

  const err = new Error(message);
  err.type = type;
  err.primaryError = primary;
  err.secondaryError = secondary;
  err.id1 = id1;
  err.id2 = id2;
  return err;
}

// Bind custom global API namespace object on window for console control command requirements!
const API = {
  setDebug,
  setManualStreamUrl,
  clearManualStreamUrl,
  getManualStreamUrl,
  fetchMovieStream,
  fetchTvStream
};

window.API = API;
export { API };
