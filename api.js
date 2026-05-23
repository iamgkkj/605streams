/**
 * api.js - 111Movies API Integration Module
 * Exposes methods to fetch video stream URLs for movies and TV shows.
 */

const BASE_URL = 'https://111movies.net';

/**
 * Validates whether a string is a valid URL.
 * @param {string} string
 * @returns {boolean}
 */
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Fetches stream URL for a given Movie.
 * Supports IMDb IDs (e.g. tt6263850) and TMDb numeric IDs (e.g. 533535).
 * 
 * @param {string} id - IMDb or TMDb ID of the movie
 * @returns {Promise<string>} - Resolves to the video stream URL (.m3u8 or .mp4)
 */
export async function fetchMovieStream(id) {
  if (!id || id.trim() === '') {
    throw new Error('Movie ID is required.');
  }

  const cleanId = id.trim();
  const url = `${BASE_URL}/movie/${cleanId}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Movie with ID "${cleanId}" was not found or is currently unavailable.`);
      }
      throw new Error(`Server returned error status: ${response.status} ${response.statusText}`);
    }

    // Handle redirect: If response.url is different from requested url and seems like a stream, use it.
    if (response.redirected && response.url && response.url !== url) {
      return response.url;
    }

    // Try reading response body
    const responseText = await response.text();
    const trimmedText = responseText.trim();

    // Check if response is a direct JSON string containing url
    try {
      const parsedJson = JSON.parse(trimmedText);
      if (parsedJson && typeof parsedJson === 'object') {
        const streamUrl = parsedJson.url || parsedJson.stream || parsedJson.src || parsedJson.file;
        if (streamUrl && isValidUrl(streamUrl)) {
          return streamUrl;
        }
      }
    } catch (_) {
      // Not a JSON, fallback to text check
    }

    // Check if the plain text is a valid URL itself
    if (isValidUrl(trimmedText)) {
      return trimmedText;
    }

    // Fallback: If redirected, even if same domain, return response.url
    if (response.url && isValidUrl(response.url)) {
      return response.url;
    }

    throw new Error('Unable to extract a valid stream URL from the API response.');

  } catch (error) {
    console.error('Error in fetchMovieStream:', error);
    throw new Error(error.message || 'Network error occurred while fetching the stream.');
  }
}

/**
 * Fetches stream URL for a given TV Episode.
 * Supports IMDb IDs (e.g. tt30217403) or TMDb IDs.
 * 
 * @param {string} id - IMDb or TMDb ID of the series
 * @param {number|string} season - Season number
 * @param {number|string} episode - Episode number
 * @returns {Promise<string>} - Resolves to the video stream URL (.m3u8 or .mp4)
 */
export async function fetchTvStream(id, season, episode) {
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
  const sNum = parseInt(season);
  const eNum = parseInt(episode);
  const url = `${BASE_URL}/tv/${cleanId}/${sNum}/${eNum}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`TV Show ID "${cleanId}" S${sNum}E${eNum} was not found or is unavailable.`);
      }
      throw new Error(`Server returned error status: ${response.status} ${response.statusText}`);
    }

    // Handle redirect
    if (response.redirected && response.url && response.url !== url) {
      return response.url;
    }

    // Try reading response body
    const responseText = await response.text();
    const trimmedText = responseText.trim();

    // Check if JSON containing url
    try {
      const parsedJson = JSON.parse(trimmedText);
      if (parsedJson && typeof parsedJson === 'object') {
        const streamUrl = parsedJson.url || parsedJson.stream || parsedJson.src || parsedJson.file;
        if (streamUrl && isValidUrl(streamUrl)) {
          return streamUrl;
        }
      }
    } catch (_) {
      // Not JSON
    }

    // Check if plain text is valid URL
    if (isValidUrl(trimmedText)) {
      return trimmedText;
    }

    // Fallback
    if (response.url && isValidUrl(response.url)) {
      return response.url;
    }

    throw new Error('Unable to extract a valid stream URL from the API response.');

  } catch (error) {
    console.error('Error in fetchTvStream:', error);
    throw new Error(error.message || 'Network error occurred while fetching the TV stream.');
  }
}
