import React, { useEffect, useState } from "react";
import { discoverTamilMovies } from "../tmdb";
import { useNavigate } from "react-router-dom";
import QuizProgressBar from "./QuizProgressBar";

/**
 * Game: Movie Bingo
 * 10 movies in 3x4 grid (1 filler), categories given, select matching ones.
 */
// PUBLIC_INTERFACE
function MovieBingo() {
  const BINGO_SIZE = 12;
  const QUESTIONS = [
    "National award winner",
    "Musical hit",
    "Comedy",
    "Action-packed",
    "Female lead",
    "Oscar submission",
    "Debut director",
    "Superstar cast",
    "Known for villain",
    "Family drama",
  ];
  const [movies, setMovies] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [selected, setSelected] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    discoverTamilMovies({ with_genres: "", page: 4 }).then((mv) => {
      setMovies(mv.slice(0, BINGO_SIZE));
      setCategories(QUESTIONS);
    });
  }, []);

  function toggle(idx) {
    let nsel = [...selected];
    if (nsel.includes(idx)) nsel = nsel.filter((x) => x !== idx);
    else nsel.push(idx);
    setSelected(nsel);
  }
  function submitBingo() {
    setDone(true);
    setTimeout(
      () =>
        navigate("/summary/movie-bingo", {
          state: {
            results: selected.map((idx) => movies[idx]?.title),
          },
        }),
      1800
    );
  }

  if (!movies.length)
    return (
      <div className="kq-quiz-panel kq-center" style={{ marginTop: 25 }}>
        Loading Bingo...
      </div>
    );

  return (
    <div className="kq-quiz-panel">
      <QuizProgressBar step={step} total={1} />
      <h2 style={{ color: "#f604c2", textAlign: "center" }}>Kollywood Movie Bingo</h2>
      <div className="kq-quiz-clues" style={{ marginBottom: 16 }}>
        Categories:{" "}
        <ul>
          {categories.map((cat, i) => (
            <li key={cat + i}>{cat}</li>
          ))}
        </ul>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
        }}
      >
        {movies.map((m, idx) => (
          <button
            key={m.id}
            className="kq-btn outline"
            style={{
              minHeight: 57,
              border:
                selected.includes(idx) && !done
                  ? "2.5px solid #f604c2"
                  : "1.5px solid #f604c2",
              background: selected.includes(idx) ? "#f604c266" : "#fff",
              color: selected.includes(idx) ? "#b51b3b" : "#f604c2",
              cursor: done ? "not-allowed" : "pointer",
              borderRadius: 10,
            }}
            onClick={() => toggle(idx)}
            disabled={done}
          >
            {m.title}
          </button>
        ))}
      </div>
      <div className="kq-quiz-action-bar">
        <button
          className="kq-quiz-answer-btn"
          style={{ minWidth: 120 }}
          disabled={done}
          onClick={submitBingo}
        >
          Submit
        </button>
      </div>
      {done && (
        <div style={{ color: "#1b9e38", fontWeight: 600, marginTop: 12 }}>
          Submitted! Calculating your bingo...
        </div>
      )}
    </div>
  );
}

export default MovieBingo;
