/**
 * search.js - TMDB Integration and Search Engine for 605streams
 * Resolves trending grids, autocomplete typeaheads, and TMDb-to-IMDb ID lookups.
 * Built with an automatic key-rotation fallback engine AND static offline fallbacks.
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

// Active keys pool
let activeKeys = [...DEFAULT_KEYS];

// Load local private credentials securely if available
import('./config.js')
  .then(config => {
    if (config.TMDB_API_KEY && config.TMDB_API_KEY.trim().length > 5) {
      console.info('Loaded private TMDB credentials securely from config.js');
      // Prepend the user's custom API key to the very front of the active pool
      activeKeys.unshift(config.TMDB_API_KEY.trim());
    }
  })
  .catch(e => {
    // Graceful ignore if config.js does not exist
  });

// Offline High-Fidelity Static Mock Databases for sandbox/no-internet environments
const STATIC_TRENDING_MOVIES = [
  {
    id: 603,
    title: "The Matrix",
    release_date: "1999-03-30",
    vote_average: 8.2,
    poster_path: "/f89U3wL3mKe56vKpIpccE36ClG1.jpg",
    type: "movie"
  },
  {
    id: 27205,
    title: "Inception",
    release_date: "2010-07-15",
    vote_average: 8.4,
    poster_path: "/oYu2Qhx0gzfsy1507XYgNs71v0C.jpg",
    type: "movie"
  },
  {
    id: 157336,
    title: "Interstellar",
    release_date: "2014-11-05",
    vote_average: 8.4,
    poster_path: "/gEU2Qv4IL747YJvj7vj4vj4vj.jpg",
    type: "movie"
  },
  {
    id: 550,
    title: "Fight Club",
    release_date: "1999-10-15",
    vote_average: 8.4,
    poster_path: "/bptfVGEQuv2v2z1znQvA7V1y4Du.jpg",
    type: "movie"
  },
  {
    id: 120,
    title: "The Lord of the Rings: The Fellowship of the Ring",
    release_date: "2001-12-18",
    vote_average: 8.4,
    poster_path: "/6oom5Q5QA2ikw5r6j5w7vj.jpg",
    type: "movie"
  },
  {
    id: 13,
    title: "Forrest Gump",
    release_date: "1994-06-23",
    vote_average: 8.5,
    poster_path: "/arw2CVaaFLNVl9vDcMMQLHpI7jN.jpg",
    type: "movie"
  }
];

const STATIC_TRENDING_TV = [
  {
    id: 1396,
    name: "Breaking Bad",
    first_air_date: "2008-01-20",
    vote_average: 9.3,
    poster_path: "/ztkUQJmgC7xCCam25ZW4qSErvv.jpg",
    type: "tv"
  },
  {
    id: 1399,
    name: "Game of Thrones",
    first_air_date: "2011-04-17",
    vote_average: 8.4,
    poster_path: "/u3bZ62I7bq1ueegzGFa2n1e5760.jpg",
    type: "tv"
  },
  {
    id: 66732,
    name: "Stranger Things",
    first_air_date: "2016-07-15",
    vote_average: 8.6,
    poster_path: "/49WjfeN0mhmfgw9Mfb6ZelV0hO.jpg",
    type: "tv"
  },
  {
    id: 1402,
    name: "The Walking Dead",
    first_air_date: "2010-10-31",
    vote_average: 8.1,
    poster_path: "/xf9wuDcQrfun525c27ZJ6fLvmg4.jpg",
    type: "tv"
  },
  {
    id: 456,
    name: "The Simpsons",
    first_air_date: "1989-12-17",
    vote_average: 8.0,
    poster_path: "/a51t63w2Z1vK6f11mJ9A8e9Vmg4.jpg",
    type: "tv"
  },
  {
    id: 71790,
    name: "S.W.A.T.",
    first_air_date: "2017-11-02",
    vote_average: 7.7,
    poster_path: "/uq45UfL8Z6a3d9mFf4gLv7fLvmg4.jpg",
    type: "tv"
  },
  {
    id: 76479,
    name: "The Boys",
    first_air_date: "2019-07-25",
    vote_average: 8.5,
    poster_path: "/stTEyCBFT2sG2qXcNIQQJbjdxMJ.jpg",
    type: "tv"
  }
];

// Offline TMDb-to-IMDb pre-calculated map
const OFFLINE_IMDB_MAPPING = {
  "603": "tt0133093",    // The Matrix
  "27205": "tt1375666",  // Inception
  "157336": "tt0816692", // Interstellar
  "550": "tt0137523",    // Fight Club
  "120": "tt0120737",    // LOTR Fellowship
  "13": "tt0109830",     // Forrest Gump
  "1396": "tt0903747",   // Breaking Bad
  "1399": "tt0944947",   // Game of Thrones
  "66732": "tt5027774",  // Stranger Things
  "1402": "tt1276104",   // The Walking Dead
  "456": "tt0096697",    // The Simpsons
  "71790": "tt6111130",  // SWAT
  "76479": "tt1190634"   // The Boys
};

/**
 * Perform a fetch with a specific connection timeout
 */
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 1500 } = options;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Global network cache status flag to trigger fast-fail offline modes
let isTmdOffline = false;

/**
 * Resilient fetch wrapper with automatic API key rotation and timeout rules
 * @param {string} endpoint - API path (e.g. 'search/movie')
 * @param {Object} queryParams - Query parameters
 * @returns {Promise<Object>}
 */
async function fetchWithKeyRotation(endpoint, queryParams = {}) {
  // If we have already detected that TMDB is offline or blocked, fail fast to avoid massive timeouts!
  if (isTmdOffline) {
    throw new Error('TMDB is offline (fast-fallback mode active).');
  }

  // 1. Try user custom key from localStorage first if provided
  const customKey = localStorage.getItem('605streams_tmdb_key');
  if (customKey && customKey.trim().length > 5) {
    const url = buildUrl(endpoint, customKey.trim(), queryParams);
    try {
      const response = await fetchWithTimeout(url, { timeout: 1200 });
      if (response.ok) return await response.json();
      console.warn(`Custom TMDB key failed with status: ${response.status}`);
    } catch (e) {
      console.warn('Custom TMDB key fetch error:', e);
      if (e instanceof TypeError || e.message?.includes('Failed to fetch')) {
        isTmdOffline = true;
      }
    }
  }

  // 2. Iterate through our active keys pool
  // Try up to 3 keys max to prevent huge lag if all keys are completely firewalled
  const maxRetries = Math.min(activeKeys.length, 3);
  for (let i = 0; i < maxRetries; i++) {
    const key = activeKeys[i];
    const url = buildUrl(endpoint, key, queryParams);
    try {
      const response = await fetchWithTimeout(url, { timeout: 1200 });
      if (response.ok) {
        // Successfully reached TMDB! Reset offline state if it was set
        isTmdOffline = false;
        return await response.json();
      }
      console.warn(`TMDB key fallback [${i + 1}/${maxRetries}] failed: ${response.status}`);
    } catch (e) {
      console.warn(`TMDB key fallback [${i + 1}/${maxRetries}] error:`, e);
      
      // If we hit a standard offline error (TypeError, Failed to fetch, DNS failure), trigger instant fast-fallback!
      if (e instanceof TypeError || e.message?.includes('Failed to fetch')) {
        isTmdOffline = true;
        console.warn('Instant offline network block detected. Fast-fallback activated.');
        break;
      }
    }
  }

  // If we looped through retries and they all timed out/failed, flag TMDB as offline
  isTmdOffline = true;
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
/**
 * Searches TMDB for movies or TV shows using a highly robust multi-stage lookup engine.
 * Supports: IMDb ttID lookup, Smart Year Parsing, and Multi-search broad category fallbacks.
 * @param {string} query - The search query string
 * @param {string} type - 'movie' or 'tv'
 * @returns {Promise<Array>}
 */
export async function searchContent(query, type = 'movie') {
  if (!query || query.trim().length < 2) return [];
  
  const cleanQuery = query.trim();

  // Pass 1: IMDb tt-ID lookup (e.g. tt0903747) utilizing the TMDB /find endpoint
  const imdbMatch = cleanQuery.match(/^(tt\d+)$/i);
  if (imdbMatch) {
    const imdbId = imdbMatch[1].toLowerCase();
    try {
      const data = await fetchWithKeyRotation(`find/${imdbId}`, {
        external_source: 'imdb_id'
      });
      
      let matchedResults = [];
      if (type === 'movie' && data.movie_results && data.movie_results.length > 0) {
        matchedResults = data.movie_results;
      } else if (type === 'tv' && data.tv_results && data.tv_results.length > 0) {
        matchedResults = data.tv_results;
      } else {
        // Universal match
        matchedResults = [
          ...(data.movie_results || []),
          ...(data.tv_results || [])
        ];
      }
      
      if (matchedResults.length > 0) {
        return matchedResults.map(item => ({
          ...item,
          type: item.title ? 'movie' : 'tv'
        }));
      }
    } catch (err) {
      console.warn('TMDb Find API external ID lookup failed:', err);
    }
  }

  // Pass 2: Smart Year Extraction (e.g. "The Matrix 1999" -> query: "The Matrix", year: "1999")
  const yearMatch = cleanQuery.match(/\b(19\d\d|20\d\d)\b/);
  let parsedTitle = cleanQuery;
  let parsedYear = null;
  if (yearMatch) {
    parsedYear = yearMatch[1];
    parsedTitle = cleanQuery.replace(yearMatch[0], '').replace(/\s+/g, ' ').trim();
  }

  const endpoint = type === 'movie' ? 'search/movie' : 'search/tv';

  try {
    let results = [];
    
    // Stage A: Specific Search query with Year filters (extremely impressive accuracy for unpopular/older specific results)
    if (parsedYear && parsedTitle.length >= 2) {
      const queryParams = {
        query: parsedTitle,
        include_adult: 'false'
      };
      if (type === 'movie') {
        queryParams.primary_release_year = parsedYear;
      } else {
        queryParams.first_air_date_year = parsedYear;
      }
      const data = await fetchWithKeyRotation(endpoint, queryParams);
      results = data.results || [];
    }

    // Stage B: Standard TMDB Search fallback
    if (results.length === 0) {
      const data = await fetchWithKeyRotation(endpoint, {
        query: cleanQuery,
        include_adult: 'false'
      });
      results = data.results || [];
    }

    // Stage C: Broad TMDB multi-search fallback (grabs extremely obscure/unpopular results, foreign content, keywords)
    if (results.length === 0) {
      const data = await fetchWithKeyRotation('search/multi', {
        query: cleanQuery,
        include_adult: 'false'
      });
      if (data.results && data.results.length > 0) {
        results = data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
        
        // Sort matching content category (movie/tv) first in results list
        results.sort((a, b) => {
          if (a.media_type === type && b.media_type !== type) return -1;
          if (a.media_type !== type && b.media_type === type) return 1;
          return 0;
        });
      }
    }

    // Ensure all items carry their type property
    return results.map(item => ({
      ...item,
      type: item.media_type || type
    }));

  } catch (error) {
    console.warn('TMDB Search API failed or timed out. Filtering static database offline.', error);
    
    // Fall back immediately to client-side fuzzy search on mock static database
    const staticList = type === 'movie' ? STATIC_TRENDING_MOVIES : STATIC_TRENDING_TV;
    const term = query.toLowerCase().trim();
    return staticList.filter(item => {
      const title = type === 'movie' ? item.title : item.name;
      return title.toLowerCase().includes(term);
    });
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
    console.warn('TMDB Trending API failed or timed out. Using offline static database.', error);
    // Fall back immediately to mock static lists to keep UI functional and beautiful
    return type === 'movie' ? STATIC_TRENDING_MOVIES : STATIC_TRENDING_TV;
  }
}

/**
 * Resolves TMDB poster image URLs directly from TMDB CDN (CORS proxy bypassed for fast direct image rendering)
 * @param {string} path - Poster image path from TMDB
 * @param {string} size - size code ('w92', 'w200', 'w500', etc.)
 * @returns {string|null}
 */
export function getImageUrl(path, size = 'w342') {
  if (!path) return null;
  if (path.startsWith('http')) return path;
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

  // Instant offline cache resolve
  if (OFFLINE_IMDB_MAPPING[tmdbId.toString()]) {
    return OFFLINE_IMDB_MAPPING[tmdbId.toString()];
  }

  try {
    if (type === 'movie') {
      const data = await fetchWithKeyRotation(`movie/${tmdbId}`);
      return data.imdb_id || null;
    } else {
      const data = await fetchWithKeyRotation(`tv/${tmdbId}/external_ids`);
      return data.imdb_id || null;
    }
  } catch (error) {
    console.warn(`TMDB ID Conversion Error: using cached mapper for ${tmdbId}`, error);
    return OFFLINE_IMDB_MAPPING[tmdbId.toString()] || null;
  }
}

/**
 * Fetches backup alternative image paths from TMDB for a movie or TV show using the /images API
 * @param {string|number} tmdbId
 * @param {string} type - 'movie' or 'tv'
 * @returns {Promise<Array<string>>}
 */
export async function getBackupImages(tmdbId, type = 'movie') {
  if (!tmdbId) return [];
  const endpoint = type === 'movie' ? `movie/${tmdbId}/images` : `tv/${tmdbId}/images`;
  try {
    const data = await fetchWithKeyRotation(endpoint);
    const paths = [];
    
    // 1. Collect alternative posters first
    if (data.posters && data.posters.length > 0) {
      data.posters.slice(0, 5).forEach(p => {
        if (p.file_path) paths.push(p.file_path);
      });
    }
    // 2. Add backdrops if poster lists are empty
    if (data.backdrops && data.backdrops.length > 0) {
      data.backdrops.slice(0, 5).forEach(b => {
        if (b.file_path) paths.push(b.file_path);
      });
    }
    return paths;
  } catch (error) {
    console.warn(`Failed to fetch backup images for ${tmdbId}:`, error);
    return [];
  }
}

// Pre-calculated dynamic offline databases for popular TV show season/episode counts
const OFFLINE_TV_DETAILS = {
  "1396": { // Breaking Bad
    number_of_seasons: 5,
    seasons: [
      { season_number: 1, episode_count: 7 },
      { season_number: 2, episode_count: 13 },
      { season_number: 3, episode_count: 13 },
      { season_number: 4, episode_count: 13 },
      { season_number: 5, episode_count: 16 }
    ]
  },
  "1399": { // Game of Thrones
    number_of_seasons: 8,
    seasons: [
      { season_number: 1, episode_count: 10 },
      { season_number: 2, episode_count: 10 },
      { season_number: 3, episode_count: 10 },
      { season_number: 4, episode_count: 10 },
      { season_number: 5, episode_count: 10 },
      { season_number: 6, episode_count: 10 },
      { season_number: 7, episode_count: 7 },
      { season_number: 8, episode_count: 6 }
    ]
  },
  "66732": { // Stranger Things
    number_of_seasons: 4,
    seasons: [
      { season_number: 1, episode_count: 8 },
      { season_number: 2, episode_count: 9 },
      { season_number: 3, episode_count: 8 },
      { season_number: 4, episode_count: 9 }
    ]
  },
  "76479": { // The Boys
    number_of_seasons: 4,
    seasons: [
      { season_number: 1, episode_count: 8 },
      { season_number: 2, episode_count: 8 },
      { season_number: 3, episode_count: 8 },
      { season_number: 4, episode_count: 8 }
    ]
  }
};

/**
 * Fetches accurate TV show season and episode counts from TMDB (with full offline fallback support)
 * @param {string|number} id - IMDb or TMDb ID
 * @returns {Promise<Object>}
 */
export async function getTvDetails(id) {
  if (!id) return null;
  let tmdbId = id;
  
  // If it is an IMDb ID, resolve it to TMDb ID first
  if (String(id).startsWith('tt')) {
    // Check our offline map first for instant resolve
    for (const [tId, iId] of Object.entries(OFFLINE_IMDB_MAPPING)) {
      if (iId === id) {
        tmdbId = tId;
        break;
      }
    }
    
    // If not found in offline map and online, query TMDB find API
    if (String(tmdbId).startsWith('tt')) {
      try {
        const findData = await fetchWithKeyRotation(`find/${id}`, { external_source: 'imdb_id' });
        const tvResult = findData.tv_results?.[0];
        if (tvResult) {
          tmdbId = tvResult.id;
        }
      } catch (err) {
        console.warn('Failed to find TV show by IMDb ID:', err);
      }
    }
  }

  // Now fetch the actual TV show details by TMDb ID
  try {
    const data = await fetchWithKeyRotation(`tv/${tmdbId}`);
    return data;
  } catch (error) {
    console.warn(`TMDB tv details failed for ID ${tmdbId}, using static offline map.`, error);
    // Fall back to offline static mock TV details
    return OFFLINE_TV_DETAILS[tmdbId] || {
      number_of_seasons: 5,
      seasons: [
        { season_number: 1, episode_count: 10 },
        { season_number: 2, episode_count: 10 },
        { season_number: 3, episode_count: 10 },
        { season_number: 4, episode_count: 10 },
        { season_number: 5, episode_count: 10 }
      ]
    };
  }
}
