//
// Util for TMDb API usage in Kollywood QuizMaster
//

const TMDB_API_KEY = "YOUR_TMDB_API_KEY"; // <-- Replace with your TMDb API Key
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

// PUBLIC_INTERFACE
export async function fetchPopularKollywoodMovies(page = 1) {
  /**
   * Fetch popular Indian/Tamil (Kollywood) movies.
   */
  // TMDb 'with_original_language=ta' for Tamil, sort by popularity or with filters
  const url = `${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=ta&sort_by=popularity.desc&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch movies');
  return res.json();
}

// PUBLIC_INTERFACE
export async function fetchMovieDetails(movieId) {
  /**
   * Get full movie details, including credits and images.
   */
  const url = `${BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits,images`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch movie details');
  return res.json();
}

// PUBLIC_INTERFACE
export async function fetchMovieImages(movieId) {
  /**
   * Get all images for a specific movie (posters/backdrops).
   */
  const url = `${BASE_URL}/movie/${movieId}/images?api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch movie images');
  return res.json();
}

// PUBLIC_INTERFACE
export async function fetchPersonDetails(personId) {
  /**
   * Get full person (actor/actress) details including movie_credits.
   */
  const url = `${BASE_URL}/person/${personId}?api_key=${TMDB_API_KEY}&append_to_response=movie_credits,images`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch person details');
  return res.json();
}

// PUBLIC_INTERFACE
export function getPosterUrl(path, size = "w500") {
  /**
   * Build the full URL for a poster/backdrop image.
   */
  if (!path) return "";
  return `${IMAGE_BASE}/${size}${path}`;
}
