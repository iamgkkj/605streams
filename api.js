/**
 * api.js - Simple URL Builder for 111movies.net
 * No fetching - just constructs the embed URL
 */

const BASE_URL = 'https://111movies.net';

// Debug mode (console commands still work)
let isDebug = false;

export function isDebugEnabled() {
    return isDebug || localStorage.getItem('605streams_debug') === 'true';
}

export function debugLog(message, ...args) {
    if (isDebugEnabled()) {
        console.log(`%c[605streams] ${message}`, 'color: #06b6d4', ...args);
    }
}

export function setDebug(value) {
    isDebug = !!value;
    if (isDebug) {
        localStorage.setItem('605streams_debug', 'true');
        console.log('%c[605streams] Debug mode ON', 'color: #10b981');
    } else {
        localStorage.removeItem('605streams_debug');
        console.log('%c[605streams] Debug mode OFF', 'color: #ef4444');
    }
}

// Manual override support
let manualStreamUrl = null;

export function setManualStreamUrl(url) {
    manualStreamUrl = url && url.trim() !== '' ? url.trim() : null;
    if (manualStreamUrl) {
        sessionStorage.setItem('605streams_manual_url', manualStreamUrl);
        console.log(`%c[605streams] Manual URL set: ${manualStreamUrl}`, 'color: #f59e0b');
    } else {
        sessionStorage.removeItem('605streams_manual_url');
        console.log('%c[605streams] Manual URL cleared', 'color: #ef4444');
    }
}

export function clearManualStreamUrl() {
    manualStreamUrl = null;
    sessionStorage.removeItem('605streams_manual_url');
    console.log('%c[605streams] Manual URL cleared', 'color: #ef4444');
}

export function getManualStreamUrl() {
    if (!manualStreamUrl) {
        manualStreamUrl = sessionStorage.getItem('605streams_manual_url');
    }
    return manualStreamUrl;
}

/**
 * Build movie embed URL
 * @param {string} id - IMDb ID (tt6263850) or numeric ID (533535)
 * @returns {string}
 */
export function getMovieUrl(id) {
    return `${BASE_URL}/movie/${encodeURIComponent(id.trim())}`;
}

/**
 * Build TV episode embed URL
 * @param {string} id - Series ID
 * @param {number|string} season - Season number
 * @param {number|string} episode - Episode number
 * @returns {string}
 */
export function getTvUrl(id, season, episode) {
    return `${BASE_URL}/tv/${encodeURIComponent(id.trim())}/${season}/${episode}`;
}

/**
 * Resolve stream URL (for manual override support)
 * @param {string} id - Movie ID
 * @returns {Promise<string>}
 */
export async function fetchMovieStream(id) {
    const manual = getManualStreamUrl();
    if (manual) return manual;
    return getMovieUrl(id);
}

/**
 * Resolve TV stream URL (for manual override support)
 * @param {string} id - TV ID
 * @param {number|string} season - Season
 * @param {number|string} episode - Episode
 * @returns {Promise<string>}
 */
export async function fetchTvStream(id, season, episode) {
    const manual = getManualStreamUrl();
    if (manual) return manual;
    return getTvUrl(id, season, episode);
}

// Global API object for console commands
window.API = {
    setDebug,
    setManualStreamUrl,
    clearManualStreamUrl,
    getManualStreamUrl,
    getMovieUrl,
    getTvUrl,
    fetchMovieStream,
    fetchTvStream
};

console.log('%c605streams API ready. Try: API.setDebug(true)', 'color: #10b981');
