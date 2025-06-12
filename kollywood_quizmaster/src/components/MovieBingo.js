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
    let didAbort = false;
    async function loadQuestions() {
      /**
       * Robust wrapper for TMDb API/data fetch with error catching and response validation.
       * If the fetch or processing fails at any stage with "genuine" error, log to console and display error UI.
       */
      let logContext = {};
      try {
        // We fetch multiple pages to increase the chance of unique, good Kollywood trivia.
        // We'll pull the first 4 pages, and combine movies
        const pages = [1, 2, 3, 4];
        let allMovies = [];
        let encounteredPageError = false;
        for (let pg of pages) {
          try {
            let mv = await discoverTamilMovies({ sort_by: "popularity.desc", page: pg });
            if (!Array.isArray(mv)) {
              throw new Error("TMDb /discover: result not array");
            }
            allMovies = allMovies.concat(mv.filter(x => x && typeof x === "object"));
          } catch (err) {
            encounteredPageError = true;
            // Diagnostics on API issues
            console.error(`[MovieBingo] Failed to fetch TMDb page ${pg}: ${err.message}`, err);
          }
        }
        if (allMovies.length < 20) {
          // Not enough movies returned by multiple page calls -- severe fallback path.
          throw new Error("TMDb discover returned insufficient movies");
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

        // All trivia templates robustified: each step now protected/checked for empty/null/bad data
        const templates = [
          async (movie, moviesPool) => {
            try {
              const cast = await getMovieCast(movie.id);
              if (!Array.isArray(cast) || cast.length < 2) return null;
              const secondary = cast.find((c, idx) => idx > 0 && !!c.name);
              if (!secondary || !secondary.name) return null;
              // Distractor actors (not present among main cast)
              const distractors = shuffle(moviesPool)
                .map(m => m.id)
                .filter(id => id !== movie.id)
                .slice(0, 8)
                .map(async (id) => {
                  const oc = allMovies.find(mv => mv.id === id);
                  if (!oc) return null;
                  let cast2;
                  try {
                    cast2 = await getMovieCast(oc.id);
                  } catch {
                    return null;
                  }
                  const possible = cast2.find((c2) => c2 && c2.name && c2.name !== secondary.name && !cast.find(c0 => c0.name === c2.name));
                  return possible ? possible.name : null;
                });
              const distractorsResolved = (await Promise.all(distractors)).filter(Boolean).slice(0, 3);
              let options = shuffle([secondary.name, ...distractorsResolved]);
              let correctIdx = options.findIndex(x => x === secondary.name);
              if (options.length < 2 || correctIdx < 0) return null;
              return {
                type: "secondary-actor-in-movie",
                qText: `Who played a key supporting role (not the lead) in "${movie.title}"?`,
                options,
                correctIdx,
                correct: secondary.name,
                movieTitle: movie.title
              };
            } catch (err) {
              console.warn("[MovieBingo secondary-actor-in-movie] Template error:", err);
              return null;
            }
          },
          async (movie, moviesPool) => {
            try {
              const mainDetail = await getMovieDetails(movie.id);
              if (!mainDetail || !mainDetail.title) return null;
              const checkAward = (det) =>
                det &&
                det.overview &&
                /award|winner|nominated|won|best/i.test(det.overview);

              if (!checkAward(mainDetail)) return null; // retry if no confirmation

              const choices = [];
              const distractorMovies = [];
              for (let i = 0; i < moviesPool.length && distractorMovies.length < 3; i++) {
                let det = null;
                try {
                  det = await getMovieDetails(moviesPool[i].id);
                } catch {}
                if (!checkAward(det) && moviesPool[i].id !== movie.id && det && det.title) {
                  distractorMovies.push(det.title);
                }
              }
              choices.push(mainDetail.title, ...distractorMovies.slice(0, 3));
              let options = shuffle(choices);
              let correctIdx = options.findIndex(x => x === mainDetail.title);
              if (options.length < 2 || correctIdx < 0) return null;
              return {
                type: "award-winning-film",
                qText: `Which of these films was nominated for or won a major award (National/State)?`,
                options,
                correctIdx,
                correct: mainDetail.title
              };
            } catch (err) {
              console.warn("[MovieBingo award-winning-film] Template error:", err);
              return null;
            }
          },
          async (movie, moviesPool) => {
            try {
              if (!movie.release_date) return null;
              const getYear = (m) => Number(m.release_date?.slice(0, 4));
              const correctYear = getYear(movie);
              if (!correctYear || correctYear % 4 !== 0) return null;
              let distractors = shuffle(moviesPool.filter(m => m.id !== movie.id && m.release_date)).filter(
                m => getYear(m) % 4 !== 0
              ).slice(0, 3);
              if (distractors.length < 3) return null;
              let options = shuffle([movie.title, ...distractors.map(m => m.title)]);
              let correctIdx = options.findIndex(x => x === movie.title);
              if (options.length < 2 || correctIdx < 0) return null;
              return {
                type: "leap-year-film",
                qText: `Which of these movies was released in a leap year?`,
                options,
                correctIdx,
                correct: movie.title
              };
            } catch (err) {
              console.warn("[MovieBingo leap-year-film] Template error:", err);
              return null;
            }
          },
          async (movie, moviesPool) => {
            try {
              const cast = await getMovieCast(movie.id);
              if (!Array.isArray(cast) || cast.length < 2) return null;
              const possibleKnown = cast.find(c => c.order > 0 && c.name);
              if (!possibleKnown) return null;
              const actorName = possibleKnown.name;
              let withActor = movie.title;
              let withoutActors = [];
              for (let i = 0; i < moviesPool.length && withoutActors.length < 3; i++) {
                let cst = [];
                try {
                  cst = await getMovieCast(moviesPool[i].id);
                } catch {}
                if (!cst || !cst.find(c => c.name === actorName)) {
                  withoutActors.push(moviesPool[i].title);
                }
              }
              if (withoutActors.length < 3) return null;
              let options = shuffle([withActor, ...withoutActors]);
              let correctIdx = options.findIndex(x => x !== withActor);
              if (options.length < 2 || correctIdx < 0) return null;
              return {
                type: "actor-not-in-one",
                qText: `In which film does actor "${actorName}" NOT appear in any credited role?`,
                options,
                correctIdx,
                correct: options[correctIdx]
              };
            } catch (err) {
              console.warn("[MovieBingo actor-not-in-one] Template error:", err);
              return null;
            }
          },
          async (movie, moviesPool) => {
            try {
              const mainDetail = await getMovieDetails(movie.id);
              if (!mainDetail || !mainDetail.overview) return null;
              const keywords = Array.from(
                new Set(
                  mainDetail.overview
                    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"")
                    .split(" ")
                    .filter(w => w.length > 4 && !/love|story|movie|their|about|these|there|after|while|other|from|with/i.test(w))
                    .map(w => w[0].toUpperCase() + w.slice(1).toLowerCase())
                )
              );
              const plotKey = shuffle(keywords)[0];
              if (!plotKey) return null;
              const distractors = [];
              for (let i = 0; i < moviesPool.length && distractors.length < 3; i++) {
                let det = null;
                try {
                  det = await getMovieDetails(moviesPool[i].id);
                } catch {}
                if (!det || !det.overview) continue;
                if (!new RegExp(plotKey, "i").test(det.overview) && movie.id !== moviesPool[i].id) {
                  distractors.push(det.title);
                }
              }
              if (distractors.length < 3) return null;
              let options = shuffle([movie.title, ...distractors]);
              let correctIdx = options.findIndex(x => x === movie.title);
              if (options.length < 2 || correctIdx < 0) return null;
              return {
                type: "plot-keyword-challenge",
                qText: `Which film's story notably involves "${plotKey}"?`,
                options,
                correctIdx,
                correct: movie.title
              };
            } catch (err) {
              console.warn("[MovieBingo plot-keyword-challenge] Template error:", err);
              return null;
            }
          },
          async (movie, moviesPool) => {
            try {
              const sameEra = shuffle(moviesPool.filter(m => m.release_date && m.id !== movie.id)).slice(0, 3);
              if (sameEra.length < 3) return null;
              const candidates = [movie, ...sameEra];
              const options = shuffle(candidates).map(m => m.title);
              const minYear = Math.min(...candidates.map(m => +m.release_date.slice(0,4)));
              const correctMovie = candidates.find(m => +m.release_date.slice(0,4) === minYear);
              let correctIdx = options.findIndex(x => x === correctMovie.title);
              if (options.length < 2 || correctIdx < 0) return null;
              return {
                type: "earliest-of-these",
                qText: `Which of these films was released earliest?`,
                options,
                correctIdx,
                correct: correctMovie.title
              };
            } catch (err) {
              console.warn("[MovieBingo earliest-of-these] Template error:", err);
              return null;
            }
          },
          async (movie, moviesPool) => {
            try {
              const details = await getMovieDetails(movie.id);
              if (!details || !details.credits || !Array.isArray(details.credits.crew)) return null;
              const musicDirs = details.credits.crew.filter(
                (mem) => mem && /music|original score|composer/i.test(mem.job)
              );
              if (!musicDirs.length) return null;
              const composer = musicDirs[0].name;
              const options = shuffle([
                composer,
                "Yuvan Shankar Raja",
                "Anirudh Ravichander",
                "Ilaiyaraaja",
                "D. Imman",
                "G. V. Prakash Kumar",
                "A. R. Rahman"
              ]).slice(0, 4);
              let correctIdx = options.findIndex(x => x === composer);
              if (options.length < 2 || correctIdx < 0) return null;
              return {
                type: "composer-of-movie",
                qText: `Who composed the music for "${movie.title}"?`,
                options,
                correctIdx,
                correct: composer
              };
            } catch (err) {
              console.warn("[MovieBingo composer-of-movie] Template error:", err);
              return null;
            }
          },
          async (movie, moviesPool) => {
            try {
              const cast = await getMovieCast(movie.id);
              const cameo = cast && cast.find(c => (c.order > 5 && c.character && /cameo/i.test(c.character)) );
              if (!cameo || !cameo.name) return null;
              const distractors = [];
              for (let i = 0; i < moviesPool.length && distractors.length < 3; i++) {
                let movieCast = [];
                try {
                  movieCast = await getMovieCast(moviesPool[i].id);
                } catch {}
                if (!movieCast || !movieCast.find(ct => ct.name === cameo.name)) {
                  const alt = movieCast.find(ct => !!ct.name);
                  if (alt) distractors.push(alt.name);
                }
              }
              if (distractors.length < 3) return null;
              let options = shuffle([cameo.name, ...distractors]);
              let correctIdx = options.findIndex(x => x === cameo.name);
              if (options.length < 2 || correctIdx < 0) return null;
              return {
                type: "cameo-role-pivot",
                qText: `Who played a pivotal cameo in "${movie.title}"?`,
                options,
                correctIdx,
                correct: cameo.name
              };
            } catch (err) {
              console.warn("[MovieBingo cameo-role-pivot] Template error:", err);
              return null;
            }
          },
          async (movie, moviesPool) => {
            try {
              const details = await getMovieDetails(movie.id);
              let directorObj = null;
              if (details && details.credits && Array.isArray(details.credits.crew)) {
                directorObj = details.credits.crew.find(m => /director/i.test(m.job));
              }
              if (!directorObj || !directorObj.name) return null;
              const director = directorObj.name;
              const distractors = [];
              for (let i = 0; i < moviesPool.length && distractors.length < 3; i++) {
                let det = null;
                try {
                  det = await getMovieDetails(moviesPool[i].id);
                } catch {}
                if (det && det.credits && det.credits.crew && !det.credits.crew.find(m => m.name === director && /director/i.test(m.job))) {
                  distractors.push(det.title);
                }
              }
              if (distractors.length < 3) return null;
              let options = shuffle([movie.title, ...distractors]);
              let correctIdx = options.findIndex(x => x === movie.title);
              if (options.length < 2 || correctIdx < 0) return null;
              return {
                type: "director-movie-match",
                qText: `Which movie was directed by "${director}"?`,
                options,
                correctIdx,
                correct: movie.title
              };
            } catch (err) {
              console.warn("[MovieBingo director-movie-match] Template error:", err);
              return null;
            }
          }
        ];

        // Retry with fallback: If first run doesn't fill bingo, attempt to use different pool/pages if needed.
        let allQuestions = [];
        let failCount = 0;
        let maxRetries = 2;
        while (!allQuestions.length && failCount < maxRetries) {
          // We'll round robin through question templates for max variety, reusing different movies each time
          let moviesPool = pickUnique(TOTAL_QUESTIONS + 8, allMovies); 
          let moviesPicked = pickUnique(TOTAL_QUESTIONS, moviesPool);
          // Random assignment of templates per grid cell
          const templateSequence = shuffle(
            Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i % templates.length)
          );
          let attempts = 0;
          for (let i = 0; i < TOTAL_QUESTIONS; ++i) {
            attempts++;
            if (attempts > TOTAL_QUESTIONS * 2) break;
            let whichTemplate = templateSequence[i];
            let movie = moviesPicked[i];
            let fn = templates[whichTemplate];
            let q = null;
            try {
              for (let movTries = 0; movTries < 2 && !q && i + movTries < moviesPool.length; movTries++) {
                q = await fn(movie, moviesPool);
                if (!q) { movie = moviesPool[i + movTries + 1]; }
              }
            } catch (err) {
              // Template may have errored
              if (window && window.console) {
                console.error(`[MovieBingo] Error generating question (template ${whichTemplate}):`, err, {movie});
              }
              q = null;
            }
            if (q && q.options && typeof q.correctIdx === "number" && q.options.length >= 2) {
              allQuestions.push({
                ...q,
                userPick: null,
                locked: false
              });
            }
          }
          // Only accept if full grid is generated; else retry with new shuffle
          if (allQuestions.length < TOTAL_QUESTIONS) {
            failCount++;
            allQuestions = [];
            // Log issue and continue retry
            console.warn("[MovieBingo] Retrying: Unable to build full bingo grid from TMDb data, retrying with reshuffled movies.");
          }
        }

        if (allQuestions.length < TOTAL_QUESTIONS) {
          throw new Error("Not enough robust movie question data for quiz after retrying.");
        }
        allQuestions = allQuestions.slice(0, TOTAL_QUESTIONS);
        if (didAbort) return;
        setQuestions(allQuestions);
        setLoading(false);
      } catch (err) {
        // Diagnostic logging
        if (window && window.console) {
          console.error("[MovieBingo] TMDb Bingo Quiz Load Error:", err, logContext);
        }
        if (!didAbort) {
          setError("Failed to load bingo. Please try again.<br/><span style='font-size:0.92em;opacity:0.6'>For diagnostics, check the browser console for details.</span>");
          setLoading(false);
        }
      }
    }
    loadQuestions();

    // Cleanup: avoid state updates on unmount/inflight abort
    return () => { didAbort = true; };
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
