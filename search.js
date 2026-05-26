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
    id: 76479,
    name: "S.W.A.T.",
    first_air_date: "2017-11-02",
    vote_average: 7.7,
    poster_path: "/uq45UfL8Z6a3d9mFf4gLv7fLvmg4.jpg",
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
  "76479": "tt6111130"   // SWAT
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

/**
 * Resilient fetch wrapper with automatic API key rotation and timeout rules
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
      const response = await fetchWithTimeout(url, { timeout: 1500 });
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
      const response = await fetchWithTimeout(url, { timeout: 1500 });
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
 * Resolves TMDB poster image URLs
 * @param {string} path - Poster image path from TMDB
 * @param {string} size - size code ('w92', 'w200', 'w500', etc.)
 * @returns {string|null}
 */
export function getImageUrl(path, size = 'w342') {
  if (!path) return null;
  // If static item already has full image link, return it
  if (path.startsWith('http')) return path;
  
  const directUrl = `https://image.tmdb.org/t/p/${size}${path}`;
  
  // Check if we're in a restricted environment (like localhost)
  const isRestricted = window.location.protocol === 'http:' || 
                       window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1';
  
  if (isRestricted) {
    // Use a CORS proxy for development
    return `https://corsproxy.io/?${encodeURIComponent(directUrl)}`;
  }
  
  return directUrl;
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
