/**
 * api-debug.js - API Diagnostics and Console Testing Utility
 * Exposes methods to window.StreamsDebug to check endpoints and responses in the browser console.
 */

import * as api from './api.js';

// Setup debug object on window
const StreamsDebug = {
  /**
   * Enables detailed color-coded console logs in localStorage.
   */
  enableDebug: () => {
    localStorage.setItem('605streams_debug', 'true');
    console.log('%c[605streams] Debug logging ENABLED. Reload the page to start seeing logs.', 'color: #10b981; font-weight: bold;');
  },

  /**
   * Disables console logs in localStorage.
   */
  disableDebug: () => {
    localStorage.removeItem('605streams_debug');
    console.log('%c[605streams] Debug logging DISABLED.', 'color: #ef4444; font-weight: bold;');
  },

  /**
   * Tests fetching a movie stream.
   * @param {string} id - IMDb or TMDb ID
   */
  testMovie: async (id) => {
    console.log(`%c[DEBUG] Testing movie stream for ID: ${id}...`, 'color: #6366f1; font-weight: bold;');
    try {
      const url = await api.fetchMovieStream(id);
      console.log('%c[DEBUG] SUCCESS! Resolved stream URL:', 'color: #10b981; font-weight: bold;', url);
      return url;
    } catch (err) {
      console.error('[DEBUG] FAILED! Error details:', err);
      console.log(`%c[DEBUG] Suggested Action: ${StreamsDebug.getTroubleshootingTip(err)}`, 'color: #f59e0b;');
      throw err;
    }
  },

  /**
   * Tests fetching a TV episode stream.
   * @param {string} id - IMDb or TMDb ID
   * @param {number} season - Season number
   * @param {number} episode - Episode number
   */
  testTv: async (id, season, episode) => {
    console.log(`%c[DEBUG] Testing TV stream for ID: ${id} (S${season}E${episode})...`, 'color: #6366f1; font-weight: bold;');
    try {
      const url = await api.fetchTvStream(id, season, episode);
      console.log('%c[DEBUG] SUCCESS! Resolved stream URL:', 'color: #10b981; font-weight: bold;', url);
      return url;
    } catch (err) {
      console.error('[DEBUG] FAILED! Error details:', err);
      console.log(`%c[DEBUG] Suggested Action: ${StreamsDebug.getTroubleshootingTip(err)}`, 'color: #f59e0b;');
      throw err;
    }
  },

  /**
   * Performs a raw HTTP request and displays detailed header and body snapshots.
   * Useful to bypass player loaders and inspect actual content returned by the endpoint.
   * @param {string} url - Target endpoint URL
   */
  rawFetch: async (url) => {
    console.log(`%c[DEBUG] Performing raw fetch to: ${url}`, 'color: #06b6d4; font-weight: bold;');
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8'
        }
      });

      console.log(`%c[DEBUG] HTTP Status: ${response.status} ${response.statusText}`, 'color: #f59e0b;');
      console.log('[DEBUG] Redirected:', response.redirected);
      console.log('[DEBUG] Redirected URL Target:', response.url);
      
      const headersObj = {};
      response.headers.forEach((val, key) => { headersObj[key] = val; });
      console.log('[DEBUG] Response Headers:', headersObj);

      const bodyText = await response.text();
      console.log(`[DEBUG] Body Size: ${bodyText.length} characters`);
      console.log('[DEBUG] Body Preview (First 800 chars):');
      console.log('%c' + bodyText.slice(0, 800) + (bodyText.length > 800 ? '\n...[truncated]' : ''), 'color: #a1a1aa; font-family: monospace;');

      // Run regex checks
      const videoRegex = /https?:\/\/[^\s"'`>]+?\.(m3u8|mp4|mkv)(?:[?#][^\s"'`>]*)?/gi;
      const matches = bodyText.match(videoRegex);
      if (matches) {
        console.log('%c[DEBUG] Regex matched video URLs:', 'color: #10b981;', matches);
      } else {
        console.log('[DEBUG] No direct video extensions (.m3u8, .mp4, .mkv) found via regex.');
      }

      const embedRegex = /https?:\/\/[^\s"'`>]+?\/(?:embed|e|v)\/[^\s"'`>]+/gi;
      const embeds = bodyText.match(embedRegex);
      if (embeds) {
        console.log('%c[DEBUG] Regex matched embed link patterns:', 'color: #10b981;', embeds);
      }

      return {
        status: response.status,
        url: response.url,
        body: bodyText
      };
    } catch (err) {
      console.error('[DEBUG] Raw fetch failed:', err);
      throw err;
    }
  },

  /**
   * Maps error codes to user advice in the console.
   */
  getTroubleshootingTip: (err) => {
    switch (err.type) {
      case 'CF_CAPTCHA':
        return 'Cloudflare block! Open 111movies.net in a browser tab, complete the captcha check, then re-try here.';
      case 'APP_ERROR':
        return 'API client-side error! The endpoint may be broken. Try swapping the ID format or paste the stream URL manually.';
      case 'NOT_FOUND':
        return 'Content missing. Verify ID correctness on IMDb or TMDb.';
      case 'FETCH_FAILED':
        return 'Network issue. Try checking CORS policies, run a local web server, or verify your network connection.';
      default:
        return 'Unknown issue. Review console error parameters or use window.StreamsDebug.rawFetch(url) to inspect.';
    }
  }
};

// Bind to window context
window.StreamsDebug = StreamsDebug;
console.log('%c[605streams] Diagnostic module loaded. Exposes window.StreamsDebug in console.', 'color: #a855f7; font-weight: bold;');
console.log('Available Commands:\n - StreamsDebug.enableDebug()\n - StreamsDebug.disableDebug()\n - StreamsDebug.testMovie(id)\n - StreamsDebug.testTv(id, season, episode)\n - StreamsDebug.rawFetch(url)');
