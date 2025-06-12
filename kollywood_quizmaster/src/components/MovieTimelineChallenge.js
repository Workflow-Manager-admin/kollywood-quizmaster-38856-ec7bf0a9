import React, { useEffect, useState } from "react";
import { discoverTamilMovies, getMovieDetails } from "../tmdb";
import { useNavigate } from "react-router-dom";
import QuizProgressBar from "./QuizProgressBar";
import BackButton from "./BackButton";

/**
 * Game: Movie Timeline Challenge
 * Show 5 movies, user arranges by release year. Must use only accurate Tamil (Kollywood) movies.
 * Multiple rounds, preventing repeats, possible to keep playing as long as there's enough fresh data.
 * Always cross-checks TMDb for years, ONLY Tamil movies (with_original_language: "ta").
 */
// PUBLIC_INTERFACE
function MovieTimelineChallenge() {
  const MOVIES_PER_ROUND = 5;
  const [pool, setPool] = useState([]);           // All loaded Tamil movie objects
  const [usedMovieIds, setUsedMovieIds] = useState([]); // All movie IDs already used in prior rounds
  const [round, setRound] = useState(0);
  const [roundMovies, setRoundMovies] = useState([]); // Current round's movie objects
  const [order, setOrder] = useState([]);         // Current order for display/reorder
  const [showClues, setShowClues] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [result, setResult] = useState([]);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [allRounds, setAllRounds] = useState([]); // List of each round's results

  const [totalRounds, setTotalRounds] = useState(1); // How many rounds (dynamic from available data)
  const navigate = useNavigate();

  // Helper - Fisher-Yates shuffle
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Helper: reload new movies for a round, always picks ones NOT already used
  async function loadRoundMovies() {
    setBusy(true);
    setSubmitted(false);
    setShowClues(false);
    setReveal(false);
    setResult([]);

    // Pick random MOVIES_PER_ROUND not used yet, ALWAYS with known release date
    let available = pool.filter(
      m =>
        m.release_date &&
        typeof m.release_date === "string" && m.release_date.length >= 4 &&
        !usedMovieIds.includes(m.id)
    );
    if (available.length < MOVIES_PER_ROUND) {
      setError(
        "Congratulations, you've finished all unique timeline rounds from available Kollywood movies!"
      );
      setRound(r => r + 1);
      setPool([]);
      setRoundMovies([]);
      setOrder([]);
      setBusy(false);
      return;
    }
    // Shuffle and pick
    let pick = shuffle(available).slice(0, MOVIES_PER_ROUND);

    // Cross-check year accuracy via getMovieDetails (in case discover API gives null/0 date or wrong lang)
    // For robustness in quiz, all .release_date must be confirmed as YYYY-MM-DD with year ≥ 1960
    pick = await Promise.all(
      pick.map(async (m) => {
        if (!m.release_date || m.release_date.length < 4) {
          // Fallback to fetch details
          try {
            const det = await getMovieDetails(m.id);
            return { ...m, release_date: det.release_date || "" };
          } catch (err) {
            return m;
          }
        }
        return m;
      })
    );
    // Remove any missing years after enrichment
    pick = pick.filter(m => m.release_date && /^\d{4}/.test(m.release_date));

    // If not enough, try again with unused ones
    if (pick.length < MOVIES_PER_ROUND) {
      // Remove these attempted (don't retry endlessly)
      const skipped = pick.map(m => m.id);
      let extraAvail = available.filter(m => !skipped.includes(m.id));
      if (extraAvail.length >= MOVIES_PER_ROUND) {
        pick = shuffle(extraAvail).slice(0, MOVIES_PER_ROUND);
      } else {
        setError (
          "Not enough unique Kollywood movies available for a new round."
        );
        setBusy(false);
        return;
      }
    }

    setRoundMovies(pick);
    setOrder(shuffle(pick));
    setBusy(false);
  }

  // Initial load - fetch a large pool of Tamil movies
  useEffect(() => {
    setError("");
    setBusy(true);
    // Fetch up to 100 unique Tamil movies (5 pages), filtering for valid titles/dates/ids, avoiding duplicates
    async function fetchMoviePool() {
      let bigPool = [];
      let seen = {};
      let page = 1;
      while (bigPool.length < 45 && page <= 10) {
        try {
          // The filters ensure only Kollywood (Tamil language, India region), sort by popularity or release date
          let movies = await discoverTamilMovies({
            sort_by: "release_date.desc",
            page,
            "vote_count.gte": 4
          });
          for (let m of movies) {
            if (
              m &&
              m.id &&
              m.title &&
              typeof m.title === "string" &&
              m.title.trim().length > 1 &&
              m.release_date &&
              /^\d{4}-\d{2}-\d{2}$/.test(m.release_date) &&
              !seen[m.id]
            ) {
              bigPool.push(m);
              seen[m.id] = 1;
            }
          }
        } catch (err) {
          // Silently skip pages unavailable
        }
        page += 1;
      }
      setTotalRounds(Math.floor(bigPool.length / MOVIES_PER_ROUND) || 1);
      setPool(bigPool);
      setUsedMovieIds([]); // On a fresh reload
      setAllRounds([]);
      setRound(0);
      setBusy(false);
    }
    fetchMoviePool();
    // eslint-disable-next-line
  }, []);

  // Whenever round index or pool changes, load next round's movies if allowed
  useEffect(() => {
    if (!pool.length || usedMovieIds.length >= pool.length) return;
    loadRoundMovies();
    // eslint-disable-next-line
  }, [pool, round]);

  // Submit answers for current round
  function handleSubmit() {
    setSubmitted(true);
    // Sort correct order by ascending release year
    const correctOrder = [...roundMovies].sort(
      (a, b) => new Date(a.release_date) - new Date(b.release_date)
    );
    let roundDetail = [];
    let match = true;
    for (let i = 0; i < MOVIES_PER_ROUND; i++) {
      if (order[i].id === correctOrder[i].id) {
        roundDetail.push({ correct: true, movie: order[i].title, year: order[i].release_date });
      } else {
        roundDetail.push({ correct: false, movie: order[i].title, year: order[i].release_date });
        match = false;
      }
    }
    setResult(roundDetail);
    setAllRounds(prev => {
      const updated = prev.slice();
      updated[round] = roundDetail;
      return updated;
    });
    // Mark these movies as used
    setUsedMovieIds((ids) => ids.concat(roundMovies.map(m => m.id)));

    setTimeout(() => {
      // If more possible rounds, let user keep going; else, finish!
      if ((usedMovieIds.length + MOVIES_PER_ROUND) < pool.length) {
        setRound(r => r + 1);
      } else {
        // Compile all answers/results into single flat list for summary
        let summaryResults = [];
        allRounds.concat([roundDetail]).forEach((detailArr) => {
          for (const it of detailArr) summaryResults.push(it);
        });
        navigate("/summary/movie-timeline", {
          state: { results: summaryResults }
        });
      }
    }, 1800);
  }

  // Navigation: user can play another round if available
  function handleNextRound() {
    setRound(r => r + 1);
  }

  // User resets for a totally new fresh movie pool/game
  function startOver() {
    window.location.reload();
  }

  // Move movie up or down in current order
  function move(idx, dir) {
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    const newOrder = order.slice();
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    setOrder(newOrder);
  }

  // If too busy or error
  if (busy)
    return (
      <div className="kq-quiz-panel kq-center" style={{ marginTop: 25 }}>
        {error ? error : "Loading Timeline..."}<br/>📅
      </div>
    );
  if (error)
    return (
      <div className="kq-quiz-panel kq-center" style={{ marginTop: 25 }}>
        <div style={{ color: "#b51b3b" }}>
          {error}
          <br />
          <button className="kq-btn outline" onClick={startOver} style={{ marginTop: 16 }}>
            {pool.length ? 'Restart All Timeline Rounds' : 'Reload'}
          </button>
        </div>
      </div>
    );
  if (!roundMovies.length)
    return (
      <div className="kq-quiz-panel kq-center" style={{ marginTop: 25 }}>
        Waiting for next timeline round...
      </div>
    );

  return (
    <div style={{ position: "relative" }}>
      <BackButton />
      <div className="kq-quiz-panel">
        <QuizProgressBar step={round} total={totalRounds} />
        <h2 style={{ color: "#f604c2", textAlign: "center" }}>
          Arrange the movies in correct release order (oldest → newest)
        </h2>
        <div style={{ textAlign: "center", margin: "0 0 12px 0", fontSize: "1.06em" }}>
          <span style={{ color: "#0b0a0a" }}>
            Kollywood movies – round {round + 1} of {totalRounds}
          </span>
        </div>
        {showClues && (
          <div className="kq-quiz-clues">
            <span>
              Hint: Use year, cast, or your Kollywood intuition! All movies are guaranteed Tamil releases.
            </span>
          </div>
        )}
        <ol style={{ paddingLeft: 0, listStyle: "none" }}>
          {order.map((m, idx) => (
            <li
              key={m.id}
              style={{
                marginTop: 9,
                background: "#faeff9",
                padding: "12px",
                borderRadius: 7,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontWeight: 600,
                color: "#b51b3b",
                fontSize: "1.11em"
              }}
            >
              <span style={{ flex: 1 }}>
                {m.title}
                {/* Optionally show year for stricter clues or after reveal */}
                {reveal && (
                  <span style={{ color: "#807", fontWeight: 400, marginLeft: 7 }}>
                    ({m.release_date.slice(0, 4)})
                  </span>
                )}
              </span>
              <span style={{ color: "#bbb", marginLeft: 13 }}>
                {submitted && (
                  <b>
                    {result[idx]?.correct ? "✔️" : "❌"}
                  </b>
                )}
              </span>
              <div style={{ display: "flex", gap: 6, marginLeft: "7px" }}>
                <button
                  style={{ background: "#f604c2", color: "#fff", border: "none", borderRadius: 3, padding: "2px 8px", cursor: "pointer" }}
                  disabled={idx === 0 || submitted}
                  onClick={() => move(idx, -1)}
                  tabIndex={0}
                  aria-label={`Move ${m.title} up in order`}
                >
                  ↑
                </button>
                <button
                  style={{ background: "#f604c2", color: "#fff", border: "none", borderRadius: 3, padding: "2px 8px", cursor: "pointer" }}
                  disabled={idx === order.length - 1 || submitted}
                  onClick={() => move(idx, 1)}
                  tabIndex={0}
                  aria-label={`Move ${m.title} down in order`}
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ol>

        <div className="kq-quiz-action-bar" style={{ marginTop: 14 }}>
          <button
            className="kq-quiz-answer-btn"
            onClick={() => setShowClues(true)}
            disabled={showClues || submitted}>
            Show Clue
          </button>
          <button
            className="kq-quiz-answer-btn reveal"
            onClick={() => setReveal(true)}
            disabled={reveal}
          >
            Reveal
          </button>
          <button
            className="kq-quiz-answer-btn"
            onClick={handleSubmit}
            disabled={submitted}
          >
            Submit
          </button>
        </div>
        {reveal && (
          <div style={{ marginTop: 12, color: "#b51b3b" }}>
            <b>Correct Order:</b>{" "}
            {[...roundMovies]
              .sort((a, b) => new Date(a.release_date) - new Date(b.release_date))
              .map((m) => `${m.title} (${m.release_date.slice(0,4)})`)
              .join(" → ")}
          </div>
        )}
        {submitted && round + 1 < totalRounds && usedMovieIds.length + MOVIES_PER_ROUND < pool.length && (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button className="kq-btn" onClick={handleNextRound} style={{ fontSize: "1.08em", padding: "7px 28px" }}>
              Next Timeline Round
            </button>
          </div>
        )}
        {submitted && (usedMovieIds.length + MOVIES_PER_ROUND >= pool.length || round + 1 >= totalRounds) && (
          <div style={{ marginTop: 18, color: "#137b2c", textAlign: "center", fontWeight: "600" }}>
            <span role="img" aria-label="trophy">🏆</span> All unique Kollywood timeline rounds finished!<br />
            <button className="kq-btn outline" onClick={startOver} style={{ fontSize: "1.05em", marginTop: 8 }}>
              Play Again!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MovieTimelineChallenge;

