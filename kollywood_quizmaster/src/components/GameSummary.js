import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

// PUBLIC_INTERFACE
function GameSummary() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { gameType } = useParams();

  let score = 0, total = 0;
  let details = [];
  if (state && state.results) {
    total = state.results.length;
    score = state.results.filter(r => typeof r.correct === "boolean" ? r.correct : true).length;

    details = state.results.map((result, i) => (
      <div key={i}>
        Q{i + 1}:{" "}
        <span
          className={result.correct ? "kq-results-correct" : "kq-results-wrong"}
        >
          {result.correct ? "Correct" : "Wrong"}
        </span>
        {"  "}
        <span style={{ color: "#0b0a0a" }}>
          {result.solution ? `(${result.solution})` : ""}
        </span>
        {result.poster && (
          <img
            src={`https://image.tmdb.org/t/p/w92${result.poster}`}
            alt="poster"
            style={{
              marginLeft: 8,
              borderRadius: 4,
              verticalAlign: "middle",
              width: 42,
            }}
          />
        )}
      </div>
    ));
  }

  const titleMap = {
    "blurred-poster": "Blurred Poster Quiz",
    "character-movie-match": "Character-Movie Match",
    "movie-bingo": "Movie Bingo",
    "movie-timeline": "Movie Timeline Challenge",
    "spin-the-wheel": "Spin the Wheel",
    "cast-combo": "Cast Combo"
  };

  return (
    <div className="kq-results-summary">
      <h2>
        {titleMap[gameType] || "Quiz"} - Results
      </h2>
      <div className="kq-results-detail">
        {total
          ? `You scored ${score} out of ${total}.`
          : "Thank you for playing!"}
      </div>
      <div style={{ margin: "9px 0 18px 0" }}>{details}</div>
      <button className="kq-btn" onClick={() => navigate("/")}>
        Back to Dashboard
      </button>
    </div>
  );
}

export default GameSummary;
