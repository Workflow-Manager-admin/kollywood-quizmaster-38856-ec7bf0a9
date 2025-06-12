import React, { useState, useEffect } from "react";
import { discoverTamilMovies, getMovieDetails, getMovieCast } from "../tmdb";

/*
 * No direct usage of PUBLIC_URL here (must use process.env.PUBLIC_URL for React scripts).
 * If you see any usage of PUBLIC_URL, replace with process.env.PUBLIC_URL.
 */
// No PUBLIC_URL usage here; kept as-is

// PUBLIC_INTERFACE
/**
 * MovieBingo main component.
 * If data loads successfully, render live questions.
 * If all loading fails, fallback to Demo/Mock Mode with static questions and warning.
 */
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

    async function fetchBingoQuestions() {
      try {
        logInfo("Starting fetch for Movie Bingo real questions...");
        // Fetch a set of Tamil movies using TMDb live API (relaxed filtering)
        const movies = await discoverTamilMovies({ page: 1, sort_by: "popularity.desc" });
        logInfo("TMDb discoverTamilMovies result:", movies);

        if (!Array.isArray(movies) || movies.length < 4) {
          throw new Error("Not enough movies from TMDb for Bingo");
        }

        // Accept any movies with a title and some vote count, relax further as possible
        // Some movies may lack "quiz properties", but we'll allow most valid entries
        let filtered = movies.filter(
          (m) =>
            m &&
            typeof m.title === "string" &&
            m.title.trim().length >= 2 &&
            Array.isArray(m.genre_ids) // any genre info
        );
        if (filtered.length < 9) {
          logInfo("Not enough filtered movies, falling back to movies as fetched");
          filtered = movies.slice(0, 9); // just use what we got
        } else {
          filtered = filtered.slice(0, 9); // get exactly 9 for 3x3 grid
        }

        // Build question objects - we allow ANY candidate, minimal requirements
        // Optionally enhance with live trivia (random multiple choice based on titles)
        const quizQs = filtered.map((movie, i) => {
          // Option generation: shuffle 4 distinct movies, include correct
          // Even if options are loose, that's ok - it's to ensure real TMDb content is visible
          const optionMovies = [movie];
          // Try to find "distractors" for options (title only, allow weak mixing)
          while (optionMovies.length < 4 && filtered.length >= 4) {
            let cand = filtered[Math.floor(Math.random() * filtered.length)];
            if (!optionMovies.includes(cand)) optionMovies.push(cand);
          }
          // Shuffle options
          for (let k = optionMovies.length - 1; k > 0; k--) {
            const j = Math.floor(Math.random() * (k + 1));
            [optionMovies[k], optionMovies[j]] = [optionMovies[j], optionMovies[k]];
          }
          logInfo(`MovieBingo Q${i+1}:`, { movie, options: optionMovies.map(m=>m.title)});
          return {
            qText: `Which movie matches this TMDb description? (${movie.title})`, // Loose filler, can improve with more hints if needed
            options: optionMovies.map((m) => m.title),
            correctIdx: optionMovies.findIndex((m) => m.id === movie.id),
            userPick: null,
            locked: false,
            tmdbId: movie.id,
            poster: movie.poster_path,
          };
        });

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
      {/* Always show real Bingo grid when ANY data is loaded */}
      <DemoBingo questions={questions} />
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
