import React, { useEffect, useState } from "react";
import { discoverTamilMovies } from "../tmdb";
import { useNavigate } from "react-router-dom";
import QuizProgressBar from "./QuizProgressBar";

/**
 * Game: Movie Timeline Challenge
 * Show 5 movies, user arranges by release year.
 */
// PUBLIC_INTERFACE
function MovieTimelineChallenge() {
  const TOTAL = 5;
  const [movies, setMovies] = useState([]);
  const [order, setOrder] = useState([]);
  const [step, setStep] = useState(0);
  const [showClues, setShowClues] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    discoverTamilMovies({ sort_by: "release_date.desc", page: 5 })
      .then((mv) => {
        const picked = shuffle(mv.filter(m => m.release_date)).slice(0, TOTAL);
        setMovies(picked);
        setOrder([...picked]);
      });
  }, []);
  
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function move(idx, dir) {
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    const newOrder = order.slice();
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    setOrder(newOrder);
  }

  function handleSubmit() {
    setSubmitted(true);
    const correctOrder = [...movies].sort((a, b) =>
      new Date(a.release_date) - new Date(b.release_date)
    );
    let allMatch = true;
    let detail = [];
    for (let i = 0; i < TOTAL; i++) {
      if (order[i].id === correctOrder[i].id) {
        detail.push({ correct: true, movie: order[i].title });
      } else {
        detail.push({ correct: false, movie: order[i].title });
        allMatch = false;
      }
    }
    setResult(detail);
    setTimeout(
      () =>
        navigate("/summary/movie-timeline", {
          state: { results: detail },
        }),
      2000
    );
  }

  if (!movies.length)
    return (
      <div className="kq-quiz-panel kq-center" style={{ marginTop: 25 }}>
        Loading Timeline...
      </div>
    );
  return (
    <div className="kq-quiz-panel">
      <QuizProgressBar step={step} total={1} />
      <h2 style={{ color: "#f604c2", textAlign: "center" }}>
        Arrange the movies in correct release order (oldest → newest)
      </h2>
      {showClues && (
        <div className="kq-quiz-clues">
          Hint: Drag and re-order the list, then submit.
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
            }}
          >
            <span style={{ flex: 1 }}>{m.title}</span>
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
                disabled={idx === 0}
                onClick={() => move(idx, -1)}
              >
                ↑
              </button>
              <button
                style={{ background: "#f604c2", color: "#fff", border: "none", borderRadius: 3, padding: "2px 8px", cursor: "pointer" }}
                disabled={idx === order.length - 1}
                onClick={() => move(idx, 1)}
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="kq-quiz-action-bar">
        <button className="kq-quiz-answer-btn" onClick={() => setShowClues(true)} disabled={showClues}>
          Show Clue
        </button>
        <button className="kq-quiz-answer-btn reveal" onClick={() => setReveal(true)} disabled={reveal}>
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
          {[...movies]
            .sort((a, b) => new Date(a.release_date) - new Date(b.release_date))
            .map((m) => m.title)
            .join(" → ")}
        </div>
      )}
    </div>
  );
}

export default MovieTimelineChallenge;
