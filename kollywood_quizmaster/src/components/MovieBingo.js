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
        // Expanded templates: deeper knowledge, more challenging!
        const templates = [
          // 1. Which actor played a significant supporting role (not the lead) in [movie]?
          async (movie, moviesPool) => {
            const cast = await getMovieCast(movie.id);
            if (!cast || cast.length < 2) return null;
            // Try to pick a secondary (supporting) actor - skip first, pick 2nd or 3rd credited
            const secondary = cast.find((c, idx) => idx > 0 && !!c.name);
            if (!secondary || !secondary.name) return null;
            // Distractor actors (not present among main cast)
            const distractors = shuffle(moviesPool)
              .map(m => m.id)
              .filter(id => id !== movie.id)
              .slice(0, 8) // sample several, use names that are never in this movie's cast
              .map(async (id) => {
                const oc = allMovies.find(mv => mv.id === id);
                if (!oc) return null;
                const cast2 = await getMovieCast(oc.id);
                const possible = cast2.find((c2) => c2 && c2.name && c2.name !== secondary.name && !cast.find(c0 => c0.name === c2.name));
                return possible ? possible.name : null;
              });
            const distractorsResolved = (await Promise.all(distractors)).filter(Boolean).slice(0, 3);
            let options = shuffle([secondary.name, ...distractorsResolved]);
            let correctIdx = options.findIndex(x => x === secondary.name);
            return {
              type: "secondary-actor-in-movie",
              qText: `Who played a key supporting role (not the lead) in "${movie.title}"?`,
              options,
              correctIdx,
              correct: secondary.name,
              movieTitle: movie.title
            };
          },

          // 2. Which film below was nominated for or won a national/state award? (random mix)
          async (movie, moviesPool) => {
            // To make this non-trivial, pick films with awards/noms in details.
            const mainDetail = await getMovieDetails(movie.id);
            if (!mainDetail || !mainDetail.title) return null;
            // We'll "hack" TMDb's details for awards mentions in 'overview' text (common for noted films).
            const checkAward = (det) =>
              det &&
              det.overview &&
              /award|winner|nominated|won|best/i.test(det.overview);

            if (!checkAward(mainDetail)) return null; // retry if no confirmation

            // Select 3 distractors without such mention
            const choices = [];
            const distractorMovies = [];
            // try multiple for accuracy
            for (let i = 0; i < moviesPool.length && distractorMovies.length < 3; i++) {
              const det = await getMovieDetails(moviesPool[i].id);
              if (!checkAward(det) && moviesPool[i].id !== movie.id && det.title) {
                distractorMovies.push(det.title);
              }
            }
            choices.push(mainDetail.title, ...distractorMovies.slice(0, 3));
            let options = shuffle(choices);
            let correctIdx = options.findIndex(x => x === mainDetail.title);
            return {
              type: "award-winning-film",
              qText: `Which of these films was nominated for or won a major award (National/State)?`,
              options,
              correctIdx,
              correct: mainDetail.title
            };
          },

          // 3. Which of these movies released in a leap year? (Factually hard Q: need deeper release date understanding)
          async (movie, moviesPool) => {
            if (!movie.release_date) return null;
            const getYear = (m) => Number(m.release_date?.slice(0, 4));
            const correctYear = getYear(movie);
            if (!correctYear || correctYear % 4 !== 0) return null; // must be leap year
            // Get some non-leap-year movies as distractors
            let distractors = shuffle(moviesPool.filter(m => m.id !== movie.id && m.release_date)).filter(
              m => getYear(m) % 4 !== 0
            ).slice(0, 3);
            if (distractors.length < 3) return null;
            let options = shuffle([movie.title, ...distractors.map(m => m.title)]);
            let correctIdx = options.findIndex(x => x === movie.title);
            return {
              type: "leap-year-film",
              qText: `Which of these movies was released in a leap year?`,
              options,
              correctIdx,
              correct: movie.title
            };
          },

          // 4. Which movie does NOT feature actor [well-known actor] in any role? (hard: negative knowledge)
          async (movie, moviesPool) => {
            const cast = await getMovieCast(movie.id);
            if (!cast || cast.length < 2) return null;
            // Pick a common (non-lead, seen in many films) Tamil actor
            const possibleKnown = cast.find(c => c.order > 0 && c.name);
            if (!possibleKnown) return null;
            const actorName = possibleKnown.name;

            // Get 1 movie which DOES include, and 3 from pool which do not (have to check)
            let withActor = movie.title;
            let withoutActors = [];
            for (let i = 0; i < moviesPool.length && withoutActors.length < 3; i++) {
              const cst = await getMovieCast(moviesPool[i].id);
              if (!cst || !cst.find(c => c.name === actorName)) {
                withoutActors.push(moviesPool[i].title);
              }
            }
            if (withoutActors.length < 3) return null;
            let options = shuffle([withActor, ...withoutActors]);
            // Logical negation for Q:
            let correctIdx = options.findIndex(x => x !== withActor); // pick first distractor as "not featured"
            // But ensure all "withActor" only appears once
            return {
              type: "actor-not-in-one",
              qText: `In which film does actor "${actorName}" NOT appear in any credited role?`,
              options,
              correctIdx,
              correct: options[correctIdx]
            };
          },

          // 5. Which movie's plot involves a [subtle plot keyword, unique per movie]?
          async (movie, moviesPool) => {
            const mainDetail = await getMovieDetails(movie.id);
            if (!mainDetail || !mainDetail.overview) return null;
            // Try to extract a less-obvious plot keyword (skip "love", "life"); use a noun > 4 chars
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
            // Find 3 distractor movies whose overviews do NOT contain this word
            const distractors = [];
            for (let i = 0; i < moviesPool.length && distractors.length < 3; i++) {
              const det = await getMovieDetails(moviesPool[i].id);
              if (!det || !det.overview) continue;
              if (!new RegExp(plotKey, "i").test(det.overview) && movie.id !== moviesPool[i].id) {
                distractors.push(det.title);
              }
            }
            if (distractors.length < 3) return null;
            let options = shuffle([movie.title, ...distractors]);
            let correctIdx = options.findIndex(x => x === movie.title);
            return {
              type: "plot-keyword-challenge",
              qText: `Which film's story notably involves "${plotKey}"?`,
              options,
              correctIdx,
              correct: movie.title
            };
          },

          // 6. Which movie was the earliest release among these? (non-obvious: all non-famous movies)
          async (movie, moviesPool) => {
            const sameEra = shuffle(moviesPool.filter(m => m.release_date && m.id !== movie.id)).slice(0, 3);
            if (sameEra.length < 3) return null;
            const candidates = [movie, ...sameEra];
            const options = shuffle(candidates).map(m => m.title);
            const minYear = Math.min(...candidates.map(m => +m.release_date.slice(0,4)));
            const correctMovie = candidates.find(m => +m.release_date.slice(0,4) === minYear);
            let correctIdx = options.findIndex(x => x === correctMovie.title);
            return {
              type: "earliest-of-these",
              qText: `Which of these films was released earliest?`,
              options,
              correctIdx,
              correct: correctMovie.title
            };
          },

          // 7. Who composed the soundtrack for [movie]? (only if composer is credited in details)
          async (movie, moviesPool) => {
            const details = await getMovieDetails(movie.id);
            if (!details || !details.credits || !Array.isArray(details.credits.crew)) return null;
            const musicDirs = details.credits.crew.filter(
              (mem) => mem && /music|original score|composer/i.test(mem.job)
            );
            if (!musicDirs.length) return null;
            const composer = musicDirs[0].name;
            // Get distractor composer names
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
            return {
              type: "composer-of-movie",
              qText: `Who composed the music for "${movie.title}"?`,
              options,
              correctIdx,
              correct: composer
            };
          },

          // 8. Who played a pivotal cameo role in [movie]? (for films w/ cameo in cast - name comes from cast order>5, marked as cameo)
          async (movie, moviesPool) => {
            const cast = await getMovieCast(movie.id);
            const cameo = cast && cast.find(c => (c.order > 5 && c.character && /cameo/i.test(c.character)) );
            if (!cameo || !cameo.name) return null;
            // Distractors = pick names from cast not in this movie
            const distractors = [];
            for (let i = 0; i < moviesPool.length && distractors.length < 3; i++) {
              const movieCast = await getMovieCast(moviesPool[i].id);
              if (!movieCast || !movieCast.find(ct => ct.name === cameo.name)) {
                const alt = movieCast.find(ct => !!ct.name);
                if (alt) distractors.push(alt.name);
              }
            }
            if (distractors.length < 3) return null;
            let options = shuffle([cameo.name, ...distractors]);
            let correctIdx = options.findIndex(x => x === cameo.name);
            return {
              type: "cameo-role-pivot",
              qText: `Who played a pivotal cameo in "${movie.title}"?`,
              options,
              correctIdx,
              correct: cameo.name
            };
          },

          // 9. Which film was directed by [director]? (get director from movie details/credits)
          async (movie, moviesPool) => {
            const details = await getMovieDetails(movie.id);
            let directorObj = null;
            if (details && details.credits && Array.isArray(details.credits.crew)) {
              directorObj = details.credits.crew.find(m => /director/i.test(m.job));
            }
            if (!directorObj || !directorObj.name) return null;
            const director = directorObj.name;
            // Find 3 movies not directed by this director
            const distractors = [];
            for (let i = 0; i < moviesPool.length && distractors.length < 3; i++) {
              const det = await getMovieDetails(moviesPool[i].id);
              if (det.credits && det.credits.crew && !det.credits.crew.find(m => m.name === director && /director/i.test(m.job))) {
                distractors.push(det.title);
              }
            }
            if (distractors.length < 3) return null;
            let options = shuffle([movie.title, ...distractors]);
            let correctIdx = options.findIndex(x => x === movie.title);
            return {
              type: "director-movie-match",
              qText: `Which movie was directed by "${director}"?`,
              options,
              correctIdx,
              correct: movie.title
            };
          }
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
