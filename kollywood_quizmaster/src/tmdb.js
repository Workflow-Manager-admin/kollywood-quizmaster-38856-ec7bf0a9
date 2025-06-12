//
// TMDb API integration for Kollywood QuizMaster
// Provides reusable functions to get Tamil movie data, posters, and cast for quiz features.
//

const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";
// Directly hardcoded API key for frontend-only usage.
// Do NOT use process.env in any code running in the browser—use this string literal only.
const TMDB_API_KEY = "5bc67d3b06aecbd18121a3cbbc16eb59";

/**
 * Helper for GET requests to TMDb API with authentication.
 * LOGS ALL fetches and responses for debug.
 * @param {string} endpoint (e.g., '/search/movie')
 * @param {object} params - Query parameters as key-value pairs.
 * @returns {Promise<object>} - Parsed response from TMDb.
 */
async function tmdbGet(endpoint, params = {}) {
  // Ensure API key is added to all requests
  const urlParams = new URLSearchParams({ api_key: TMDB_API_KEY, ...params });
  const url = `${TMDB_API_BASE_URL}${endpoint}?${urlParams.toString()}`;
  // Log outbound fetch for debug
  if (console && typeof console.info === "function") {
    console.info("[tmdbGet] Fetching:", url, params);
  }
  let response;
  try {
    response = await fetch(url);
    if (console && typeof console.info === "function") {
      console.info("[tmdbGet] Response:", response, "status:", response && response.status);
    }
    if (!response.ok) {
      throw new Error(`TMDb API error: ${response.status} - ${response.statusText}`);
    }
    const result = await response.json();
    if (console && typeof console.info === "function") {
      console.info("[tmdbGet] Parsed JSON for", endpoint, result);
    }
    return result;
  } catch (e) {
    if (console && typeof console.error === "function") {
      console.error("[tmdbGet] FAILED:", url, e);
    }
    throw e;
  }
}

// PUBLIC_INTERFACE
/**
 * Search movies by keyword (e.g., for finding Tamil movies by name or keyword).
 * See: https://developers.themoviedb.org/3/search/search-movies
 * @param {string} query
 * @param {object} extraParams - Any extra TMDb params (e.g., language, region).
 * @returns {Promise<object[]>}
 */
export async function searchMovies(query, extraParams = {}) {
  // For Kollywood: use region=IN and language=ta-IN if available
  return tmdbGet('/search/movie', { query, ...extraParams })
    .then(data => data.results);
}

// PUBLIC_INTERFACE
/**
 * Get details for a specific movie by TMDb ID.
 * https://developers.themoviedb.org/3/movies/get-movie-details
 * @param {number|string} movieId
 * @returns {Promise<object>}
 */
export async function getMovieDetails(movieId) {
  return tmdbGet(`/movie/${movieId}`, { language: 'ta-IN' });
}

// PUBLIC_INTERFACE
/**
 * Get the cast (actors) for a specific movie by TMDb ID.
 * https://developers.themoviedb.org/3/movies/get-movie-credits
 * @param {number|string} movieId
 * @returns {Promise<object[]>} - Array of cast members
 */
export async function getMovieCast(movieId) {
  return tmdbGet(`/movie/${movieId}/credits`)
    .then(data => data.cast);
}

// PUBLIC_INTERFACE
/**
 * Discover movies filtered to Kollywood (Tamil-language) using the discover endpoint.
 * See: https://developers.themoviedb.org/3/discover/movie-discover
 * @param {object} filters - Extra filters (e.g., year, with_cast).
 * @returns {Promise<object[]>}
 */
export async function discoverTamilMovies(filters = {}) {
  // Tamil language code is 'ta' in ISO 639-1
  return tmdbGet('/discover/movie', {
    with_original_language: 'ta',
    region: 'IN',
    sort_by: 'popularity.desc',
    ...filters
  }).then(data => data.results);
}

// PUBLIC_INTERFACE
/**
 * Helper to get poster URL from poster_path provided by TMDb.
 * https://developer.themoviedb.org/docs/image-basics
 * @param {string} posterPath - Poster path from movie object
 * @param {string} size - Poster size: 'w185', 'w342', 'w500', etc.
 * @returns {string} - Absolute URL to the poster image
 */
export function getPosterUrl(posterPath, size = "w342") {
  if (!posterPath) return "";
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}

// PUBLIC_INTERFACE
/**
 * Fetch details for a person (actor/actress) by TMDb ID.
 * https://developers.themoviedb.org/3/people/get-person-details
 * @param {number|string} personId
 * @returns {Promise<object>}
 */
export async function getPersonDetails(personId) {
  return tmdbGet(`/person/${personId}`);
}

/**
 * Example: Use this module for quiz features such as:
 * - Blurred Poster Quiz: Use getPosterUrl() for the image, and getMovieDetails()
 * - Cast Combo/Spin the Wheel: Use getMovieCast() and getPersonDetails()
 * - Character-Movie Match: Use getMovieDetails() -> characters (if available)
 */

