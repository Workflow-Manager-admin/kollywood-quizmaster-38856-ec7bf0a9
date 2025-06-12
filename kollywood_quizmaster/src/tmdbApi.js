//
// Util for TMDb API usage in Kollywood QuizMaster
//

/**
 * TMDb API utility for Kollywood QuizMaster.
 * Uses direct requests to /3 endpoints, with API key securely managed.
 * All requests support robust error checking and standardized response handling.
 */

const TMDB_API_KEY = "5bc67d3b06aecbd18121a3cbbc16eb59"; // For production, use env vars.
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

/**
 * Detects TMDb-specific errors from API responses.
 * @param {Response} res - fetch Response object
 * @param {Object} json - parsed response body
 * @param {string} context - Provides context for error messages (e.g., "movies", "details")
 * @throws {Error} Descriptive error suitable for UI display
 */
function checkTmdbResponse(res, json, context = "") {
  if (!res.ok) {
    let message = `API error: ${res.status} ${res.statusText}`;
    // TMDb returns 401 for API key issues or quota exceeded
    if (res.status === 401) {
      if (json && json.status_message) message = `TMDb: ${json.status_message}`;
      else message = "TMDb: Unauthorized. Check API key or quota.";
    } else if (res.status === 404) {
      message = "TMDb: Resource not found.";
    }
    throw new Error(`[TMDb ${context}] ${message}`);
  }
  // TMDb sometimes returns { success: false, status_code, status_message }
  if (json && json.success === false) {
    let msg = json.status_message || "Unknown TMDb error";
    throw new Error(`[TMDb ${context}] ${msg}`);
  }
}

/**
 * Robust fetch wrapper for TMDb endpoints with fallback and error trapping.
 * @param {string} url
 * @param {string} respType - Context string for error messages
 * @param {object} [options] - { expectFields?: string[] }
 * @returns {Promise<object>}
 */
async function robustTmdbFetch(url, respType, options = {}) {
  let res;
  try {
    res = await fetch(url);
    let json;
    try {
      json = await res.json();
    } catch {
      throw new Error("[TMDb] Response body could not be parsed");
    }
    checkTmdbResponse(res, json, respType);
    if (options.expectFields) {
      for (const f of options.expectFields) {
        if (!(f in json)) {
          throw new Error(`[TMDb ${respType}] Missing expected field: ${f}`);
        }
      }
    }
    return json;
  } catch (err) {
    if (err.name === "TypeError" && err.message && err.message.match(/Network/)) {
      throw new Error("[Network] Could not reach TMDb. Please check internet or try again.");
    }
    throw err;
  }
}

// PUBLIC_INTERFACE
export async function fetchPopularKollywoodMovies(page = 1) {
  /**
   * Fetches popular Kollywood movies (Tamil language, sorted by popularity).
   * Throws a descriptive Error for unrecoverable errors (API key, quota, network, etc).
   */
  if (!TMDB_API_KEY)
    throw new Error("TMDb API key not configured. Please provide your TMDb API key.");
  const url = `${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=ta&sort_by=popularity.desc&page=${page}`;
  const data = await robustTmdbFetch(url, "movies", { expectFields: ["results"] });
  if (!Array.isArray(data.results) || data.results.length === 0) {
    throw new Error("TMDb returned no Tamil movies. Quota exhausted, or none found for page.");
  }
  return data;
}

// PUBLIC_INTERFACE
export async function fetchMovieDetails(movieId) {
  /**
   * Fetches full movie details, including credits and images.
   * Robust error/shape handling.
   */
  if (!TMDB_API_KEY)
    throw new Error("TMDb API key not configured. Please provide your TMDb API key.");
  const url = `${BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits,images`;
  const det = await robustTmdbFetch(url, "details", { expectFields: ["title", "release_date"] });
  return det;
}

// PUBLIC_INTERFACE
export async function fetchMovieImages(movieId) {
  /**
   * Fetches all images for a specific movie (posters/backdrops).
   */
  if (!TMDB_API_KEY)
    throw new Error("TMDb API key not configured. Please provide your TMDb API key.");
  const url = `${BASE_URL}/movie/${movieId}/images?api_key=${TMDB_API_KEY}`;
  return await robustTmdbFetch(url, "images");
}

// PUBLIC_INTERFACE
export async function fetchPersonDetails(personId) {
  /**
   * Fetches full person (actor/actress) details including movie_credits.
   */
  if (!TMDB_API_KEY)
    throw new Error("TMDb API key not configured. Please provide your TMDb API key.");
  const url = `${BASE_URL}/person/${personId}?api_key=${TMDB_API_KEY}&append_to_response=movie_credits,images`;
  return await robustTmdbFetch(url, "person");
}

// PUBLIC_INTERFACE
export function getPosterUrl(path, size = "w500") {
  /**
   * Build the full URL for a poster/backdrop image.
   */
  if (!path) return "";
  return `${IMAGE_BASE}/${size}${path}`;
}
