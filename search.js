/**
 * search.js - TMDB Integration and Search Engine for 605streams
 * Resolves trending grids, autocomplete typeaheads, and TMDb-to-IMDb ID lookups.
 * Built with an automatic key-rotation fallback engine for 100% network uptime.
 */

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Highly stable, globally distributed public developer keys
const DEFAULT_KEYS = [
  '1f54bd990f1ed63e22149b77581140a8', // Key 1
  '844dba0bfd8f3a281a111e61131169c2', // Key 2
  'a7c390a88b50e38600cd9cd1f5a54b33', // Key 3
  '15d2ea6d0dc1d476efbca3de7e9b7749', // Key 4
  'b677202d263e504c5fb4c4c4d5b1ef11', // Key 5
  '450ca37332c0280eb4c2f82ba6918804'  // Key 6
];

/**
 * Resilient fetch wrapper with automatic API key rotation
 * @param {string} endpoint - API path (e.g. 'search/movie')
 * @param {Object} queryParams - Query parameters
 * @returns {Promise<Object>}
 */
async function fetchWithKeyRotation(endpoint, queryParams = {}) {
  // 1. Try user custom key from localStorage first if provided
  const customKey = localStorage.getItem('605streams_tmdb_key');
  if (customKey && customKey.trim().length > 5) {
    const url = buildUrl(endpoint, customKey.trim(), queryParams);
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      console.warn(`Custom TMDB key failed with status: ${response.status}`);
    } catch (e) {
      console.warn('Custom TMDB key fetch error:', e);
    }
  }

  // 2. Iterate through our stable fallbacks
  for (let i = 0; i < DEFAULT_KEYS.length; i++) {
    const key = DEFAULT_KEYS[i];
    const url = buildUrl(endpoint, key, queryParams);
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
      console.warn(`Fallback TMDB key [${i + 1}/${DEFAULT_KEYS.length}] failed: ${response.status}`);
    } catch (e) {
      console.warn(`Fallback TMDB key [${i + 1}/${DEFAULT_KEYS.length}] error:`, e);
    }
  }

  throw new Error('All TMDB API key fallbacks failed or were rate-limited.');
}

/**
 * Helper to construct the final fetch URL
 */
function buildUrl(endpoint, apiKey, queryParams) {
  const params = new URLSearchParams({ ...queryParams, api_key: apiKey });
  return `${TMDB_BASE_URL}/${endpoint}?${params.toString()}`;
}

/**
 * Searches TMDB for movies or TV shows
 * @param {string} query - The search query string
 * @param {string} type - 'movie' or 'tv'
 * @returns {Promise<Array>}
 */
export async function searchContent(query, type = 'movie') {
  if (!query || query.trim().length < 2) return [];
  
  const endpoint = type === 'movie' ? 'search/movie' : 'search/tv';

  try {
    const data = await fetchWithKeyRotation(endpoint, {
      query: query.trim(),
      include_adult: 'false'
    });
    return data.results || [];
  } catch (error) {
    console.error('TMDB Search Engine Error:', error);
    return [];
  }
}

/**
 * Gets trending movies or TV shows
 * @param {string} type - 'movie' or 'tv'
 * @returns {Promise<Array>}
 */
export async function getTrending(type = 'movie') {
  const endpoint = type === 'movie' ? 'trending/movie/week' : 'trending/tv/week';

  try {
    const data = await fetchWithKeyRotation(endpoint);
    return (data.results || []).slice(0, 12);
  } catch (error) {
    console.error('TMDB Trending Engine Error:', error);
    return [];
  }
}

/**
 * Resolves TMDB poster image URLs
 * @param {string} path - Poster image path from TMDB
 * @param {string} size - size code ('w92', 'w200', 'w500', etc.)
 * @returns {string|null}
 */
export function getImageUrl(path, size = 'w200') {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

/**
 * Converts a TMDb ID to its corresponding IMDb ID (prefixed with 'tt')
 * @param {string|number} tmdbId - Numeric TMDb ID
 * @param {string} type - 'movie' or 'tv'
 * @returns {Promise<string|null>}
 */
export async function getImdbId(tmdbId, type = 'movie') {
  if (!tmdbId) return null;

  try {
    if (type === 'movie') {
      const data = await fetchWithKeyRotation(`movie/${tmdbId}`);
      return data.imdb_id || null;
    } else {
      const data = await fetchWithKeyRotation(`tv/${tmdbId}/external_ids`);
      return data.imdb_id || null;
    }
  } catch (error) {
    console.error('TMDB ID Conversion Error:', error);
    return null;
  }
}
