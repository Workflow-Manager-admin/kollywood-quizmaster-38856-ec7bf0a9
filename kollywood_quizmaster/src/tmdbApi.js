//
// Util for TMDb API usage in Kollywood QuizMaster
//

const TMDB_API_KEY = "YOUR_TMDB_API_KEY"; // <-- Replace with your TMDb API Key
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

/**
 * Detects TMDb-specific error from API, including quota exceeded, invalid key, CORS, etc.
 * @param {Response} res - fetch Response object
 * @param {Object} json - parsed response body
 * @param {string} context - "movies", "details", etc.
 * @throws {Error} if a TMDb or network/shape error is detected (message intended for UI display)
 */
function checkTmdbResponse(res, json, context = "") {
  if (!res.ok) {
    let message = `API error: ${res.status} ${res.statusText}`;
    // TMDb returns 401 for API key issues/quota exceeded
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
 * @param {string} respType
 * @param {object} [options]
 * @returns {Promise<object>}
 */
async function robustTmdbFetch(url, respType, options = {}) {
  let res;
  try {
    res = await fetch(url);
    let json;
    try { json = await res.json(); } catch {
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
   * Fetch popular Indian/Tamil (Kollywood) movies with robust error/shape handling.
   * Throws descriptive Error for unrecoverable errors (API key, quota, network, etc).
   */
  if (!TMDB_API_KEY || TMDB_API_KEY === "YOUR_TMDB_API_KEY")
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
   * Get full movie details, including credits and images. Robust error/shape handling.
   */
  if (!TMDB_API_KEY || TMDB_API_KEY === "YOUR_TMDB_API_KEY")
    throw new Error("TMDb API key not configured. Please provide your TMDb API key.");
  const url = `${BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits,images`;
  const det = await robustTmdbFetch(url, "details", { expectFields: ["title", "release_date"] });
  return det;
}

// PUBLIC_INTERFACE
export async function fetchMovieImages(movieId) {
  /**
   * Get all images for a specific movie (posters/backdrops).
   */
  if (!TMDB_API_KEY || TMDB_API_KEY === "YOUR_TMDB_API_KEY")
    throw new Error("TMDb API key not configured. Please provide your TMDb API key.");
  const url = `${BASE_URL}/movie/${movieId}/images?api_key=${TMDB_API_KEY}`;
  return await robustTmdbFetch(url, "images");
}

// PUBLIC_INTERFACE
export async function fetchPersonDetails(personId) {
  /**
   * Get full person (actor/actress) details including movie_credits.
   */
  if (!TMDB_API_KEY || TMDB_API_KEY === "YOUR_TMDB_API_KEY")
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
