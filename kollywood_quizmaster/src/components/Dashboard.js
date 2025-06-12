import React from "react";
import { useNavigate } from "react-router-dom";

const games = [
  {
    key: "blurred-poster",
    title: "Blurred Poster Quiz",
    desc: "Guess the movie from a blurred poster image. Two clues, one reveal.",
    icon: "🖼️",
  },
  {
    key: "character-movie-match",
    title: "Character-Movie Match",
    desc: "Drag and drop character names into the right movies.",
    icon: "🧑🏾‍🎤",
  },
  {
    key: "movie-bingo",
    title: "Movie Bingo",
    desc: "Bingo! Click movies that fit each category clue.",
    icon: "🎲",
  },
  {
    key: "movie-timeline",
    title: "Movie Timeline Challenge",
    desc: "Arrange the movies in ascending order of release.",
    icon: "📅",
  },
  {
    key: "spin-the-wheel",
    title: "Spin the Wheel",
    desc: "Spin for actor/year clues, select the right Kollywood movie.",
    icon: "🎡",
  },
  {
    key: "cast-combo",
    title: "Cast Combo",
    desc: "Pick the movie based on a combo cast. Or find who doesn't fit!",
    icon: "👥",
  },
];

// PUBLIC_INTERFACE
function Dashboard() {
  const navigate = useNavigate();
  return (
    <div>
      <section className="kq-dashboard-hero">
        <h1>Welcome! 🎬</h1>
        <div style={{ fontWeight: 500, color: "#0b0a0a" }}>
          Pick a Kollywood Quiz Game to begin
        </div>
      </section>
      <div className="kq-dashboard-cards">
        {games.map((game) => (
          <div className="kq-game-card" key={game.key}>
            <span className="kq-card-icon">{game.icon}</span>
            <h2 style={{ margin: "7px 0 0 0", color: "#f604c2" }}>{game.title}</h2>
            <div style={{ color: "#0b0a0a", minHeight: 44, marginBottom: 6 }}>{game.desc}</div>
            <button
              className="kq-card-btn"
              onClick={() => navigate(`/quiz/${game.key}`)}
            >
              Start
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
