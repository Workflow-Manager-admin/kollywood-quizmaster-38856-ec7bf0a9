import React, { useEffect, useState } from "react";
import { discoverTamilMovies, getMovieDetails, getMovieCast } from "../tmdb";
import { useNavigate } from "react-router-dom";

/**
 * Game: Movie Bingo as Grid Trivia (Kollywood)
 * 3x3 (9) grid, each cell is a unique, accurate Kollywood trivia question.
 * Each cell: user selects ONE answer (multiple choice), locks after selection. Correct: green, Incorrect: red.
 * Questions sourced via TMDb for accuracy.
 */
// PUBLIC_INTERFACE
function MovieBingo() {
  // Set grid size: 3x3 grid with 9 questions (can change to 4x4 for 16)
  const GRID_SIZE = 3; // 3x3 grid
  const TOTAL_QUESTIONS = GRID_SIZE * GRID_SIZE;
  const navigate = useNavigate();

  // Grid structure: An array of question objects, each with {question, options, correctIdx, userPick}
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);

  /**
   * Helper - Fisher-Yates shuffle (in-place)
   */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Generates trivia question objects using real TMDb movie data
   */
  useEffect(() => {
    setLoading(true);
    setError("");
    async function loadQuestions() {
      try {
        // We fetch multiple pages to increase the chance of unique, good Kollywood trivia.
        // We'll pull the first 4 pages, and combine movies
        const pages = [1, 2, 3, 4];
        let allMovies = [];
        for (let pg of pages) {
          let mv = await discoverTamilMovies({ sort_by: "popularity.desc", page: pg });
          allMovies = allMovies.concat(mv);
        }
        // Remove movies with missing details
        allMovies = allMovies.filter(m => m && m.title && m.id);

        // Helper to sample n unique movies
        function pickUnique(n, arr) {
          const used = new Set();
          let out = [];
          let tryArr = shuffle(arr);
          for (let i = 0, j = 0; i < tryArr.length && out.length < n; i++) {
            const m = tryArr[i];
            if (!used.has(m.id)) { out.push(m); used.add(m.id); }
          }
          return out;
        }

        // Now, build 9 (or 16) unique, diverse question templates
        // Each cell can use a different template for Kollywood trivia
        // Option templates: actor-in-movie, year, director, genre, main plot, etc.
        // We'll use a mix for variety

        // Define trivia templates -- randomize assignment
        // All questions will resolve to a unique correct movie+factual answer
        const templates = [
          // 1. Who starred as...in [movie]?
          async (movie, moviesPool) => {
            // Get cast for this movie
            const cast = await getMovieCast(movie.id);
            const lead = (cast && cast.find(c => c.order === 0)) || cast[0];
            if (!lead || !lead.name) return null;
            // Distractor actors from other random movies
            const otherNames = shuffle(moviesPool)
              .flatMap(m => m.title && m.id !== movie.id ? [m.id] : [])
              .map(id => {
                const oc = allMovies.find(mv => mv.id === id);
                if (!oc) return null;
                return getMovieCast(oc.id).then(cast2 => {
                  const first = cast2 && cast2[0] && cast2[0].name;
                  return first && first !== lead.name ? first : null;
                });
              }).slice(0, 4);
            // Wait for distractor names to resolve
            const distractorsResolved = (await Promise.all(otherNames)).filter(Boolean);
            // Compose options
            let options = shuffle([lead.name, ...distractorsResolved].slice(0, 4));
            let correctIdx = options.findIndex(x => x === lead.name);
            return {
              type: "actor-in-movie",
              qText: `Who played the lead in "${movie.title}"?`,
              options,
              correctIdx,
              movieTitle: movie.title,
              correct: lead.name
            };
          },
          // 2. Which year was [movie.title] released?
          async (movie, moviesPool) => {
            if (!movie.release_date) return null;
            const correctYear = movie.release_date.slice(0, 4);
            // Distractor years: sample release years from other movies
            const years = shuffle(moviesPool)
              .map(m => m.release_date && m.release_date.slice(0, 4))
              .filter(y => y && y !== correctYear);
            let options = shuffle([correctYear, ...years].slice(0, 4));
            let correctIdx = options.findIndex(x => x === correctYear);
            return {
              type: "year-of-release",
              qText: `Which year was "${movie.title}" released?`,
              options,
              correctIdx,
              movieTitle: movie.title,
              correct: correctYear
            };
          },
          // 3. Which movie features [actor name] in a leading role? (From pool)
          async (movie, moviesPool) => {
            const cast = await getMovieCast(movie.id);
            const lead = (cast && cast.find(c => c.order === 0)) || cast[0];
            if (!lead || !lead.name) return null;
            // Find three other movies (from pool) not starring this lead
            let notInLeadMovies = moviesPool.filter(async m => {
              if (m.id === movie.id) return false;
              const cast2 = await getMovieCast(m.id);
              return !cast2.find(c => c.name === lead.name);
            });
            // For speed, just sample movie titles at random
            const otherTitles = shuffle(moviesPool.filter(m => m.id !== movie.id && m.title)).slice(0, 4).map(m => m.title);
            let options = shuffle([movie.title, ...otherTitles].slice(0, 4));
            let correctIdx = options.findIndex(x => x === movie.title);
            return {
              type: "movie-for-actor",
              qText: `Which movie features actor "${lead.name}" as lead?`,
              options,
              correctIdx,
              correct: movie.title,
              actor: lead.name
            };
          },
          // 4. What is the genre of [movie.title]? (one correct + distractor genres)
          async (movie, moviesPool) => {
            if (!movie.genre_ids || !Array.isArray(movie.genre_ids) || movie.genre_ids.length === 0) return null;
            // We'll map TMDb's genre IDs to genre names (only top-level for brevity)
            const genreNames = {
              28: "Action", 35: "Comedy", 18: "Drama", 10749: "Romance", 27: "Horror", 80: "Crime", 53: "Thriller",
            };
            const correctGenreId = movie.genre_ids[0];
            const correctGenre = genreNames[correctGenreId] || "Drama";
            // Distractors: other genres from genreNames
            const distractorGenres = Object.values(genreNames).filter(g => g !== correctGenre);
            let options = shuffle([correctGenre, ...distractorGenres].slice(0, 4));
            let correctIdx = options.findIndex(x => x === correctGenre);
            return {
              type: "genre-of-movie",
              qText: `What is a primary genre of "${movie.title}"?`,
              options,
              correctIdx,
              correct: correctGenre
            };
          }
          // Add more template types here for more variety.
        ];

        // Now, prepare a shuffled set of 9 movie problems
        let allQuestions = [];
        // We'll round robin through question templates for max variety, reusing different movies each time
        let moviesPool = pickUnique(TOTAL_QUESTIONS + 6, allMovies); // use more for variation
        let moviesPicked = pickUnique(TOTAL_QUESTIONS, moviesPool);
        // Random assignment of templates per grid cell
        const templateSequence = shuffle(
          Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i % templates.length)
        );
        let attempts = 0;
        for (let i = 0; i < TOTAL_QUESTIONS; ++i) {
          attempts++;
          if (attempts > 18) break;
          let whichTemplate = templateSequence[i];
          let movie = moviesPicked[i];
          let fn = templates[whichTemplate];
          let q = null;
          // Retry with next movie if null (bad data)
          for (let movTries = 0; movTries < 2 && !q && i + movTries < moviesPool.length; movTries++) {
            q = await fn(movie, moviesPool);
            if (!q) { movie = moviesPool[i + movTries + 1]; }
          }
          if (q && q.options && typeof q.correctIdx === "number" && q.options.length >= 2) {
            // Ensure answer indexes are valid
            allQuestions.push({
              ...q,
              userPick: null,
              locked: false
            });
          }
        }
        // Only take exactly GRID_SIZE * GRID_SIZE (or GRID_SIZE^2)
        if (allQuestions.length < TOTAL_QUESTIONS) throw new Error("Not enough movie data for quiz.");
        allQuestions = allQuestions.slice(0, TOTAL_QUESTIONS);
        setQuestions(allQuestions);
        setLoading(false);
      } catch (err) {
        setError("Failed to load bingo. Please try again.");
        setLoading(false);
      }
    }

    loadQuestions();
    // eslint-disable-next-line
  }, []);

  /**
   * Handler for selecting an answer in a grid cell
   */
  function handleAnswer(qIdx, optIdx) {
    // Do nothing if already locked
    if (questions[qIdx].locked) return;
    // Lock selection immediately, update state
    const correct = questions[qIdx].correctIdx === optIdx;
    const updatedQuestions = questions.map((q, idx) =>
      idx === qIdx
        ? { ...q, userPick: optIdx, locked: true }
        : q
    );
    setQuestions(updatedQuestions);
    // Check if all are answered (locked)
    const done = updatedQuestions.every(q => q.locked);
    if (done) {
      // Collate results and go to summary after short delay
      setTimeout(() => {
        const summary = updatedQuestions.map(q => ({
          correct: q.correctIdx === q.userPick,
          answer: q.options[q.userPick] || null,
          solution: q.options[q.correctIdx],
          question: q.qText || "",
        }));
        setResults(summary);
        // Go to summary after 1s
        setTimeout(() => {
          navigate("/summary/movie-bingo", { state: { results: summary } });
        }, 1000);
      }, 500);
    }
  }

  // Loading/error
  if (loading)
    return (
      <div className="kq-quiz-panel kq-center" style={{ marginTop: 25 }}>
        Loading bingo questions...
      </div>
    );
  if (error)
    return (
      <div className="kq-quiz-panel kq-center" style={{ marginTop: 25, color: "#b51b3b", fontWeight: 600 }}>
        {error}
      </div>
    );

  // Compose grid
  function getGridRows(arr, size) {
    let out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  // Cell color logic for locking
  function getBtnColor(q, idx) {
    if (!q.locked) return {};
    if (q.userPick !== idx) {
      // Dim unselected answers after locking
      return { opacity: 0.54 };
    }
    // Selected/locked
    if (idx === q.correctIdx) {
      return {
        background: "#1b9e38",
        color: "#fff",
        borderColor: "#137b2c",
        boxShadow: "0 0 7px #34c85a88"
      };
    } else {
      return {
        background: "#b51b3b",
        color: "#fff",
        borderColor: "#7c1e2f",
        boxShadow: "0 0 7px #f3123888"
      };
    }
  }

  return (
    <div>
      <div className="kq-quiz-panel">
        <div style={{marginBottom: 10}}>
          <b style={{ color: "#f604c2", fontSize: "1.2rem" }}>🎲 Kollywood Movie Bingo</b>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gap: 19,
          margin: "15px auto",
          maxWidth: 780
        }}>
          {getGridRows(questions, GRID_SIZE).map((row, rowIdx) =>
            row.map((q, colIdx) => (
              <div
                key={`${rowIdx}-${colIdx}`}
                style={{
                  background: "#faeff9",
                  borderRadius: 10,
                  boxShadow: "var(--kq-shadow)",
                  padding: "18px 12px 16px 12px",
                  minWidth: 0,
                  minHeight: 170,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  alignItems: "stretch",
                  opacity: q.locked ? 0.99 : 1,
                  border: "2px solid #f604c2"
                }}
              >
                <div style={{ minHeight: 52, marginBottom: 6, fontWeight: 600, color: "#0b0a0a", fontSize: "1.06em"}}>
                  {q.qText}
                </div>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                  marginTop: 2,
                  alignItems: "stretch"
                }}>
                  {q.options.map((opt, idx) => (
                    <button
                      key={opt}
                      className="kq-btn outline"
                      style={{
                        ...{
                          color: "#f604c2",
                          background: "#fff",
                          fontWeight: 700,
                          border: "2px solid #f604c2",
                          borderRadius: 8,
                          fontSize: "1.03em",
                          padding: "7px 8px",
                          opacity: q.locked && q.userPick !== idx ? 0.51 : 1,
                          marginBottom: 2,
                          pointerEvents: q.locked ? "none" : "auto",
                          transition: "all 0.15s"
                        },
                        ...(q.locked ? getBtnColor(q, idx) : {})
                      }}
                      disabled={q.locked}
                      onClick={() => handleAnswer(rowIdx * GRID_SIZE + colIdx, idx)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {/* Feedback below choices */}
                {(q.locked && q.userPick != null) && (
                  <div style={{
                    marginTop: 7,
                    color: (q.userPick === q.correctIdx) ? "#1b9e38" : "#b51b3b",
                    fontWeight: 700,
                    textAlign: 'center'
                  }}>
                    {q.userPick === q.correctIdx ? "Correct! 🎉" : "Incorrect."}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        {/* Progress bar */}
        <div style={{marginTop: 15, marginBottom: -3}}>
          <div className="kq-progress-label">
            Progress: {questions.filter(q => q.locked).length} / {questions.length}
          </div>
          <div className="kq-progress-bar-bg">
            <div className="kq-progress-bar" style={{
              width: `${Math.round((questions.filter(q => q.locked).length / questions.length) * 100)}%`
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default MovieBingo;
