import React, { useEffect, useState } from "react";
import { fetchPopularKollywoodMovies, fetchMovieDetails } from "./tmdbApi";

// Helper for drag'n'drop (manual with up/down buttons)
function swap(array, idx1, idx2) {
  const arr = array.slice();
  [arr[idx1], arr[idx2]] = [arr[idx2], arr[idx1]];
  return arr;
}

// PUBLIC_INTERFACE
function MovieTimelineChallenge({ onResult }) {
  /**
   * Timeline Game: Player arranges movies in chronological order (earliest to latest), clues, reveal, answer logic.
   */
  const [titles, setTitles] = useState([]);
  const [order, setOrder] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | playing | submitted | revealed
  const [answerOrder, setAnswerOrder] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    async function loadMovies() {
      setStatus("loading");
      setError("");
      try {
        // Fetch a random page, pick 4-5 movies for order game
        const pg = Math.floor(Math.random() * 2) + 1;
        const resp = await fetchPopularKollywoodMovies(pg);
        if (!resp || !Array.isArray(resp.results) || resp.results.length < 4)
          throw new Error("TMDb returned insufficient Kollywood movies (quota exhausted or data error).");
        let picked = resp.results
          .filter(m => m.release_date)
          .slice(0, 5);
        // Fetch details for year
        const withDates = await Promise.all(picked.map(m => fetchMovieDetails(m.id)));
        const movies = withDates.map(d => ({
          title: d.title,
          release_date: d.release_date,
        }));
        setTitles(movies);
        // Randomize user starting order
        setOrder(shuffleArr(movies));
        // Prepare correct answer
        const sorted = [...movies].sort(
          (a, b) => new Date(a.release_date) - new Date(b.release_date)
        );
        setAnswerOrder(sorted);
        setStatus("playing");
      } catch (e) {
        setError(e.message || "Failed to load timeline data.");
        setStatus("error");
      }
    }
    loadMovies();
    return () => (ignore = true);
  }, []);

  function move(idx, dir) {
    setOrder(prev => swap(prev, idx, idx + dir));
  }

  function handleSubmit() {
    setStatus("submitted");
    const isCorrect = order.every(
      (m, idx) => m.title === answerOrder[idx].title
    );
    onResult && onResult(isCorrect, order, answerOrder);
  }
  function handleReveal() {
    setStatus("revealed");
    setOrder(answerOrder);
    onResult && onResult(true, answerOrder, answerOrder, true);
  }

  if (status === "loading")
    return <div style={{ minHeight: 140 }}>Loading timeline movies...</div>;
  if (status === "error") return <div style={{ color: "var(--kavia-orange)" }}>{error}</div>;

  return (
    <div
      style={{
        borderRadius: 10,
        background: "var(--base-dark)",
        maxWidth: 420,
        margin: "auto",
        boxShadow: "0 2px 12px rgba(2,1,30,0.13)",
        padding: 26,
      }}
    >
      <h2 className="subtitle" style={{ color: "var(--base-light)" }}>
        Arrange the movies in chronological order (earliest first)
      </h2>
      <div>
        <ol style={{ padding: 0, listStyle: "none" }}>
          {order.map((m, idx) => (
            <li key={m.title} style={{
              marginBottom: 10,
              padding: "14px 10px",
              border: "1.5px solid var(--border-color)",
              background: "#161a3a",
              borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              fontWeight: 600
            }}>
              <span>
                {m.title}
                {status !== "revealed" && (
                  <span style={{
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    display: "block"
                  }}>(Release: {m.release_date?.slice(0, 4) || "?"})</span>
                )}
              </span>

              {status === "playing" && (
                <span>
                  <button
                    type="button"
                    className="btn"
                    disabled={idx === 0}
                    onClick={() => move(idx, -1)}
                  >⬆️</button>
                  <button
                    type="button"
                    className="btn"
                    disabled={idx === order.length - 1}
                    onClick={() => move(idx, +1)}
                    style={{ marginLeft: 6 }}
                  >⬇️</button>
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
      {status === "playing" && (
        <div>
          <button className="btn btn-large" onClick={handleSubmit}>Submit</button>
          <button className="btn" style={{ marginLeft: 10 }} onClick={handleReveal}>Reveal</button>
        </div>
      )}
      {status === "submitted" && (
        <div style={{ color: "#1af04d", marginTop: 16 }}>
          {order.every((m, idx) => m.title === answerOrder[idx].title)
            ? "Correct chronology! 🎉"
            : "Incorrect. Try again or reveal answer."
          }
          <div>
            <button className="btn" style={{ marginTop: 8 }} onClick={handleReveal}>Reveal Order</button>
          </div>
        </div>
      )}
      {status === "revealed" && (
        <div style={{ color: "#f6d731", marginTop: 14 }}>
          Revealed correct chronological movie order!
        </div>
      )}
    </div>
  );
}

function shuffleArr(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default MovieTimelineChallenge;
