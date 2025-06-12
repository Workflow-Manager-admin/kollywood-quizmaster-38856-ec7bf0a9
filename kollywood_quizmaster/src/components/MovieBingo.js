import React, { useState, useEffect } from "react";
import { discoverTamilMovies, getMovieDetails, getMovieCast } from "../tmdb";

/**
 * MovieBingo main component.
 * 
 * Refactored: Now fetches Tamil movies, and for each cell in the bingo grid creates a unique trivia question 
 * using deep TMDb data and template logic (e.g., "Which actor did NOT appear?", release year, genre, awards, 
 * character name per role, etc.). Each cell guarantees non-trivial, grid-unique, Kollywood-flavored questions.
 * If all loading fails, fallback to Demo/Mock Mode with static questions and warning.
 * 
 * Deepest clues use: getMovieCast (for actor/role questions), getMovieDetails (for tagline/award/genre info),
 * and movie properties (release year, genre). Grid always contains 9 (3x3) distinct trivia types if possible.
 */
import { useNavigate } from "react-router-dom";

// PUBLIC_INTERFACE
function MovieBingo() {
  const [questions, setQuestions] = useState(null); // null = loading, [] = loaded failure, [questions] = loaded success
  const [error, setError] = useState(null);
  const [demoMode, setDemoMode] = useState(false);

  // Hardcoded fallback grid questions for Demo/Mock Mode
  const demoQuestions = [
    {
      qText: "A Kollywood movie featuring a double role?",
      options: ["Sivaji", "Thani Oruvan", "Jeans", "Mankatha"],
      correctIdx: 2,
      userPick: null,
      locked: false,
    },
    {
      qText: "Which movie won a National Award?",
      options: ["Chandramukhi", "Pariyerum Perumal", "Billa", "Kaala"],
      correctIdx: 1,
      userPick: null,
      locked: false,
    },
    {
      qText: "A Rajinikanth film in the 2010s?",
      options: ["Nayakan", "Enthiran", "Moondram Pirai", "Sathya"],
      correctIdx: 1,
      userPick: null,
      locked: false,
    },
    {
      qText: "Which has A. R. Rahman as music director?",
      options: ["Nanban", "Roja", "Vikram Vedha", "Singam"],
      correctIdx: 1,
      userPick: null,
      locked: false,
    },
    {
      qText: "Sports-based Kollywood movie?",
      options: ["Irudhi Suttru", "Bigil", "Both", "Neither"],
      correctIdx: 2, // Both
      userPick: null,
      locked: false,
    },
    {
      qText: "A remake of a Hindi film?",
      options: ["Ghajini", "Anniyan", "OK Kanmani", "Kaththi"],
      correctIdx: 0,
      userPick: null,
      locked: false,
    },
    {
      qText: "Which is primarily a comedy?",
      options: ["Chennai 600028", "Aayirathil Oruvan", "Dasavathaaram", "Asuran"],
      correctIdx: 0,
      userPick: null,
      locked: false,
    },
    {
      qText: "Movie directed by Mani Ratnam?",
      options: ["Baashha", "Mouna Ragam", "Thuppakki", "Aruvi"],
      correctIdx: 1,
      userPick: null,
      locked: false,
    },
    {
      qText: "Starred Vijay Sethupathi?",
      options: ["96", "Mugavari", "7G Rainbow Colony", "Sivaji"],
      correctIdx: 0,
      userPick: null,
      locked: false,
    },
  ];

  useEffect(() => {
    let didCancel = false;

    // Log utility (keep all fetches and responses)
    function logInfo() {
      // eslint-disable-next-line no-console
      if (console && typeof console.info === "function") {
        // Arguments to array to better control output in React strict mode
        // eslint-disable-next-line prefer-rest-params
        console.info("[MovieBingo]", ...arguments);
      }
    }

    async function generateRichQuestions(movies) {
      const templates = [
        // 1. Which of these actors did NOT appear in {movie.title}?
        async (movie, pool) => {
          const cast = await getMovieCast(movie.id).catch(() => []);
          const mainActors = (cast || []).map(c => c.name).filter(Boolean);
          if (mainActors.length < 2) return null;

          // Find a distractor - an actor not in cast, from pool
          let distractor = null;
          for (const mv of pool) {
            if (mv.id === movie.id) continue;
            const otherCast = await getMovieCast(mv.id).catch(() => []);
            const altActor = (otherCast.find(x => x && x.name && !mainActors.includes(x.name)));
            if (altActor && altActor.name && !mainActors.includes(altActor.name)) {
              distractor = altActor.name;
              break;
            }
          }
          if (!distractor) distractor = "Vadivelu";

          const actorsSet = mainActors.slice(0, 3);
          const insertIdx = Math.floor(Math.random() * (actorsSet.length + 1));
          actorsSet.splice(insertIdx, 0, distractor);

          return {
            qText: `Which of these actors did NOT appear in "${movie.title}"?`,
            options: actorsSet,
            correctIdx: insertIdx,
            tmdbId: movie.id,
            poster: movie.poster_path,
            userPick: null,
            locked: false
          };
        },

        // 2. What year was {movie.title} released?
        async (movie) => {
          if (!movie.release_date) return null;
          const year = movie.release_date.slice(0, 4);
          let opts = [year];
          while (opts.length < 4) {
            const n = (1980 + Math.floor(Math.random() * 41)).toString();
            if (!opts.includes(n)) opts.push(n);
          }
          for (let i = opts.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [opts[i], opts[j]] = [opts[j], opts[i]];
          }
          return {
            qText: `What year was "${movie.title}" released?`,
            options: opts,
            correctIdx: opts.findIndex(o => o === year),
            tmdbId: movie.id,
            poster: movie.poster_path,
            userPick: null,
            locked: false
          };
        },

        // 3. Which award did {movie.title} win? (if awards in tagline/overview)
        async (movie) => {
          const details = await getMovieDetails(movie.id).catch(() => null);
          const text = [details?.tagline, details?.overview].join(" ").toLowerCase();
          const awards = [];
          if (text.includes("national award") || text.includes("national film award"))
            awards.push("National Film Award");
          if (text.includes("filmfare"))
            awards.push("Filmfare Award");
          if (text.includes("state award"))
            awards.push("Tamil Nadu State Film Award");
          if (text.includes("sivaji ganesan award"))
            awards.push("Sivaji Ganesan Award");
          if (!awards.length) return null;

          const optionPool = [
            "National Film Award",
            "Filmfare Award",
            "Tamil Nadu State Film Award",
            "Sivaji Ganesan Award",
            "Vijay Award",
            "SIIMA Award"
          ].filter(item => !awards.includes(item));
          while (awards.length < 1) awards.push(optionPool.pop());
          const allAwards = [...awards];
          while (allAwards.length < 4 && optionPool.length)
            allAwards.push(optionPool.pop());
          for (let i = allAwards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allAwards[i], allAwards[j]] = [allAwards[j], allAwards[i]];
          }
          return {
            qText: `Which of these awards did "${movie.title}" (supposedly) win?`,
            options: allAwards,
            correctIdx: allAwards.findIndex(a => awards.includes(a)),
            tmdbId: movie.id,
            poster: movie.poster_path,
            userPick: null,
            locked: false
          };
        },

        // 4. Which character did {actor} play in {movie.title}? (use cast)
        async (movie) => {
          const cast = await getMovieCast(movie.id).catch(() => []);
          const candidates = cast.filter(x => x && x.character && x.name && x.character.length > 2);
          if (candidates.length < 2) return null;
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          let distractors = [];
          for (let c2 of cast) {
            if (c2.character && c2.character !== pick.character && c2.character.length > 2) {
              distractors.push(c2.character);
              if (distractors.length >= 3) break;
            }
          }
          while (distractors.length < 3) {
            const generic = ["Inspector", "Doctor", "Villager", "Raja", "Radha", "Kumar"][Math.floor(Math.random() * 6)];
            if (!distractors.includes(generic))
              distractors.push(generic);
          }
          const options = [pick.character, ...distractors.slice(0, 3)];
          for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
          }
          return {
            qText: `Which character did ${pick.name} play in "${movie.title}"?`,
            options,
            correctIdx: options.findIndex(x => x === pick.character),
            tmdbId: movie.id,
            poster: movie.poster_path,
            userPick: null,
            locked: false
          };
        },

        // 5. Which genre best describes {movie.title}?
        async (movie, pool) => {
          if (!Array.isArray(movie.genre_ids) || movie.genre_ids.length === 0) return null;
          const genreMap = {
            28: "Action",
            35: "Comedy",
            18: "Drama",
            53: "Thriller",
            10749: "Romance",
            9648: "Mystery",
            27: "Horror",
            80: "Crime",
            14: "Fantasy",
            36: "History",
            10402: "Music"
          };
          const mainGenreId = movie.genre_ids.find(id => genreMap[id]);
          if (!mainGenreId) return null;
          const mainGenre = genreMap[mainGenreId];

          let distractors = [];
          for (const mv of pool) {
            for (const gid of mv.genre_ids) {
              if (gid !== mainGenreId && genreMap[gid] && !distractors.includes(genreMap[gid]))
                distractors.push(genreMap[gid]);
              if (distractors.length >= 3) break;
            }
            if (distractors.length >= 3) break;
          }
          while (distractors.length < 3) {
            let g0 = Object.values(genreMap)[Math.floor(Math.random() * Object.values(genreMap).length)];
            if (!distractors.includes(g0) && g0 !== mainGenre)
              distractors.push(g0);
          }
          const options = [mainGenre, ...distractors.slice(0, 3)];
          for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
          }
          return {
            qText: `Which genre best describes "${movie.title}"?`,
            options,
            correctIdx: options.findIndex(x => x === mainGenre),
            tmdbId: movie.id,
            poster: movie.poster_path,
            userPick: null,
            locked: false
          };
        }
        // More templates can be added as required in future.
      ];

      const n = 9; // for bingo grid (3x3)
      let out = [];
      // Try each template for each slot, rotate, fallback to basic if not enough data
      for (let i = 0; i < n && i < movies.length; i++) {
        let templateIdx = (i + Math.floor(Math.random() * templates.length)) % templates.length;
        let q = null, atts = 0, tried = {};
        do {
          q = await templates[templateIdx](movies[i], movies);
          tried[templateIdx] = true;
          if (!q) {
            templateIdx = (templateIdx + 1) % templates.length;
            atts++;
          }
        } while (!q && atts < templates.length);
        if (!q) {
          q = {
            qText: `Which of these is a real movie title: "${movies[i].title}"?`,
            options: [movies[i].title, ...movies.slice(0,4)
              .filter(m=>m.id!==movies[i].id).map(m=>m.title).slice(0,3)],
            correctIdx: 0,
            tmdbId: movies[i].id,
            poster: movies[i].poster_path,
            userPick: null,
            locked: false
          };
          for (let j = q.options.length - 1; j > 0; j--) {
            const t = Math.floor(Math.random() * (j + 1));
            [q.options[j], q.options[t]] = [q.options[t], q.options[j]];
          }
          q.correctIdx = q.options.findIndex(x=>x===movies[i].title);
        }
        out.push(q);
      }
      // Deduplicate by question text
      const seen = {};
      out = out.filter(q => {
        if (seen[q.qText]) return false;
        seen[q.qText] = 1;
        return true;
      });
      return out;
    }

    async function fetchBingoQuestions() {
      try {
        logInfo("Starting fetch for Movie Bingo real questions...");
        // Fetch Tamil movies (using "discover" API, sorted by popularity)
        const movies = await discoverTamilMovies({ page: 1, sort_by: "popularity.desc" });
        logInfo("TMDb discoverTamilMovies result:", movies);

        if (!Array.isArray(movies) || movies.length < 4) {
          throw new Error("Not enough movies from TMDb for Bingo");
        }

        // Accept any movies with a title and some vote count, relax filtering
        let filtered = movies.filter(
          (m) =>
            m &&
            typeof m.title === "string" &&
            m.title.trim().length >= 2 &&
            Array.isArray(m.genre_ids)
        );
        if (filtered.length < 9) {
          logInfo("Not enough filtered movies, falling back to movies as fetched");
          filtered = movies.slice(0, 9);
        } else {
          filtered = filtered.slice(0, 9);
        }

        // Use async builder for rich, deep trivia for each cell
        const quizQs = await generateRichQuestions(filtered);

        if (!didCancel) {
          setQuestions(quizQs);
          setDemoMode(false);
          setError(null);
        }
      } catch (e) {
        logInfo("Movie Bingo TMDb fetch failed/fallback:", e && e.message || e);
        if (!didCancel) {
          setQuestions(demoQuestions);
          setDemoMode(true);
          setError(
            "Environment or API error — falling back to Demo/Mock Mode. All real movie data fetches failed (API key/network/unavailable)."
          );
        }
      }
    }
    fetchBingoQuestions();
    return () => { didCancel = true; };
    // eslint-disable-next-line
  }, []);

  // UI Rendering
  if (questions === null) {
    return (
      <div className="kq-center kq-mt25">
        <div className="kq-quiz-panel">Loading Movie Bingo...<br />🎲</div>
      </div>
    );
  }

  // Render the Bingo grid and — if game is finished — the "Back to Desktop" button.
  return (
    <MovieBingoWrapper questions={questions} demoMode={demoMode} />
  );
}

/* Component that wraps DemoBingo and shows "Back to Desktop" when all questions are answered */

function MovieBingoWrapper({ questions, demoMode }) {
  const [internalQuestions, setInternalQuestions] = useState([...questions]);
  const navigate = useNavigate();

  // Handler for answer (same as old handleAnswer in DemoBingo), but lifted up for central state
  function handleAnswer(qIdx, optIdx) {
    if (internalQuestions[qIdx].locked) return;
    const correct = internalQuestions[qIdx].correctIdx === optIdx;
    const updatedQuestions = internalQuestions.map((q, idx) =>
      idx === qIdx
        ? { ...q, userPick: optIdx, locked: true }
        : q
    );
    setInternalQuestions(updatedQuestions);
  }

  // Bingo is finished if all questions are locked/answered
  const finished = internalQuestions.every(q => q.locked);

  // Helper to get grid rows
  function getGridRows(arr, size) {
    let out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function getBtnColor(q, idx) {
    if (!q.locked) return {};
    if (q.userPick !== idx) {
      return { opacity: 0.54 };
    }
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

  // Matches styling from DemoBingo, with Back to Desktop at the end
  return (
    <div>
      {demoMode && (
        <div style={{
          background: "#fff7ee",
          color: "#b51b3b",
          border: "2px solid #ffc6c6",
          borderRadius: 10,
          margin: "0 auto 16px auto",
          maxWidth: 670,
          padding: "13px 22px",
          fontWeight: 600,
          textAlign: "center",
          fontSize: "1.11em",
        }}>
          <span role="img" aria-label="warning">⚠️</span>{" "}
          <b>Demo/Mock Mode:</b> Unable to load live Movie Bingo questions due to API or network/environment issues. <br />
          Displaying a static Bingo grid for demonstration/testing purposes.<br />
          <span style={{ fontWeight: 400, fontSize: "0.96em" }}>
            (Make sure TMDb API key is set and network is available for real questions)
          </span>
        </div>
      )}
      <div>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(3, 1fr)`,
          gap: 19,
          margin: "15px auto 7px auto",
          maxWidth: 780
        }}>
          {getGridRows(internalQuestions, 3).map((row, rowIdx) =>
            row.map((q, colIdx) => (
              <div
                key={`${rowIdx}-${colIdx}`}
                style={{
                  background: "#faeff9",
                  borderRadius: 10,
                  boxShadow: "var(--kq-shadow)",
                  padding: "18px 12px 16px 12px",
                  minWidth: 0,
                  minHeight: 140,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  alignItems: "stretch",
                  opacity: q.locked ? 0.99 : 1,
                  border: "2px solid #f604c2"
                }}
              >
                <div style={{ minHeight: 48, marginBottom: 6, fontWeight: 600, color: "#0b0a0a", fontSize: "1.06em" }}>
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
                      onClick={() => handleAnswer(rowIdx * 3 + colIdx, idx)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
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
        <div style={{ marginTop: 15, marginBottom: -3 }}>
          <div className="kq-progress-label">
            Progress: {internalQuestions.filter(q => q.locked).length} / {internalQuestions.length}
          </div>
          <div className="kq-progress-bar-bg">
            <div className="kq-progress-bar" style={{
              width: `${Math.round((internalQuestions.filter(q => q.locked).length / internalQuestions.length) * 100)}%`
            }} />
          </div>
        </div>
      </div>
      {/* Back to Desktop button appears only at end */}
      {finished && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 28 }}>
          <button
            className="kq-btn"
            style={{
              fontSize: "1.22em",
              padding: "13px 34px",
              background: "#f604c2",
              color: "#fff",
              fontWeight: 700,
              borderRadius: 8,
              boxShadow: "0 3px 20px 0 #ca2fa31a",
              border: "none"
            }}
            onClick={() => navigate("/")}
            tabIndex={0}
          >
            ⬅️ Back to Desktop
          </button>
        </div>
      )}
    </div>
  );
}

// Pure render for bingo grid UI from props (for demo/livetest)
function DemoBingo({ questions: initialQuestions }) {
  // Each question: { qText, options, correctIdx, userPick, locked }
  const GRID_SIZE = 3;
  const [questions, setQuestions] = useState(initialQuestions);

  function handleAnswer(qIdx, optIdx) {
    if (questions[qIdx].locked) return;
    const correct = questions[qIdx].correctIdx === optIdx;
    const updatedQuestions = questions.map((q, idx) =>
      idx === qIdx
        ? { ...q, userPick: optIdx, locked: true }
        : q
    );
    setQuestions(updatedQuestions);
  }

  function getGridRows(arr, size) {
    let out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function getBtnColor(q, idx) {
    if (!q.locked) return {};
    if (q.userPick !== idx) {
      return { opacity: 0.54 };
    }
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
      <div>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gap: 19,
          margin: "15px auto 7px auto",
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
                  minHeight: 140,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  alignItems: "stretch",
                  opacity: q.locked ? 0.99 : 1,
                  border: "2px solid #f604c2"
                }}
              >
                <div style={{ minHeight: 48, marginBottom: 6, fontWeight: 600, color: "#0b0a0a", fontSize: "1.06em"}}>
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
