import React, { useState, useEffect } from "react";
import "./App.css";
import BlurredPosterQuiz from "./BlurredPosterQuiz";
import CharacterMovieMatch from "./CharacterMovieMatch";
import MovieBingo from "./MovieBingo";
import MovieTimelineChallenge from "./MovieTimelineChallenge";
import SpinTheWheel from "./SpinTheWheel";
import CastCombo from "./CastCombo";

// A simple in-app router (no dependencies on react-router-dom for minimalism)
const GAME_LIST = [
  {
    key: "blurred-poster",
    name: "Blurred Poster Quiz",
    description: "Guess the Kollywood movie from a blurred poster image. Use clues, submit your answer, or reveal!",
    component: BlurredPosterQuiz,
    icon: "🎬"
  },
  {
    key: "character-movie-match",
    name: "Character-Movie Match",
    description: "Match famous Kollywood character names to their movies.",
    component: CharacterMovieMatch,
    icon: "🎭"
  },
  {
    key: "movie-bingo",
    name: "Movie Bingo",
    description: "Mark off Kollywood movies in Bingo categories like 'Comedies' or 'Award Winners'.",
    component: MovieBingo,
    icon: "🟩"
  },
  {
    key: "movie-timeline",
    name: "Movie Timeline Challenge",
    description: "Arrange Kollywood movies in the correct order of their release dates.",
    component: MovieTimelineChallenge,
    icon: "⏳"
  },
  {
    key: "spin-the-wheel",
    name: "Spin the Wheel",
    description: "Spin to get actor/year clues and pick the correct movie!",
    component: SpinTheWheel,
    icon: "🌀"
  },
  {
    key: "cast-combo",
    name: "Cast Combo",
    description: "Guess the movie based on a unique combination of 2-3 stars, or spot the odd actor out!",
    component: CastCombo,
    icon: "👥"
  },
];

// Simple dummy login. User must provide a display name.
function LoginScreen({ onLogin }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  function submit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("Please enter your name to continue.");
    } else {
      onLogin(name.trim());
    }
  }
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#e718c2 0,#00FFFF 65%,#261cba 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <div style={{
        background: "#171748cc",
        padding: 36,
        borderRadius: 16,
        textAlign: "center",
        color: "white",
        minWidth: 330,
        boxShadow: "0 4px 48px #ea12e730"
      }}>
        <div className="logo" style={{ fontSize: 36, marginBottom: 10 }}>
          <span className="logo-symbol">🎥</span>
          Kollywood QuizMaster
        </div>
        <div className="subtitle" style={{ color: "#ffda31", marginBottom: 24, fontSize: 18 }}>
          Test your Kollywood movie knowledge!
        </div>
        {err && <div style={{ color: "#f17a6f", marginBottom: 14 }}>{err}</div>}
        <form onSubmit={submit}>
          <input
            type="text"
            placeholder="Enter your name..."
            value={name}
            style={{
              padding: "12px 16px",
              borderRadius: 8,
              border: "none",
              fontSize: 17,
              marginBottom: 18,
              width: 210
            }}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
          <div>
            <button className="btn btn-large" type="submit" style={{ width: 130, marginTop: 4, fontWeight: 600, fontSize: 18 }}>
              Play!
            </button>
          </div>
        </form>
        <div style={{ marginTop: 16, fontSize: 13, color: "#f5e1c6", letterSpacing: 0.2 }}>
          © Kavia AI | Kollywood Movie Game!
        </div>
      </div>
    </div>
  );
}

// Dashboard of games
function Dashboard({ user, onSelectGame, onLogout }) {
  return (
    <div>
      <nav className="navbar" style={{ background: "var(--base-dark)" }}>
        <div className="container" style={{ display: 'flex', justifyContent: "space-between" }}>
          <div className="logo" style={{ letterSpacing: 2 }}>
            <span className="logo-symbol">🎬</span>
            Kollywood QuizMaster
          </div>
          <div style={{ display: 'flex', alignItems: "center", gap: 18 }}>
            <span style={{ color: "#00FFFF", fontWeight: 500, fontSize: 15 }}>Welcome, {user}!</span>
            <button className="btn" style={{ background: "#f604c2", fontWeight: 600, color: "#fff" }} onClick={onLogout}>Logout</button>
          </div>
        </div>
      </nav>
      <div className="container" style={{ paddingTop: 108 }}>
        <section>
          <div className="title" style={{ fontSize: 34, fontWeight: 700, textAlign: "center", color: "#f604c2", marginBottom: 3 }}>
            🎉 Let's Play!
          </div>
          <div className="subtitle" style={{ textAlign: "center", color: "#19e4d2", marginBottom: 30, fontWeight: 500 }}>
            Choose a Kollywood Movie Quiz Game:
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(290px,1fr))",
            gap: 26,
            maxWidth: 950,
            margin: "0 auto"
          }}>
            {GAME_LIST.map(game =>
              <div
                key={game.key}
                style={{
                  borderRadius: 14,
                  background: "#161950",
                  color: "#fff",
                  boxShadow: "0 3px 18px #ea12e713",
                  padding: "28px 21px 23px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between"
                }}
              >
                <div style={{ fontSize: 38, marginBottom: 7 }}>{game.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 19, marginBottom: 6, color: "#fd5ce9" }}>
                  {game.name}
                </div>
                <div className="description" style={{ fontSize: 15, marginBottom: 15, color: "#d2f7fe" }}>
                  {game.description}
                </div>
                <button
                  className="btn btn-large"
                  style={{ background: "#f604c2", color: "#fff", fontWeight: 600 }}
                  onClick={() => onSelectGame(game.key)}
                >
                  Play {game.icon}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// Top progress bar (for games with multiple questions)
function ProgressBar({ current, total }) {
  return (
    <div style={{
      marginBottom: 18,
      width: "100%",
      background: "#eee3",
      borderRadius: 8,
      height: 12,
      overflow: "hidden"
    }}>
      <div style={{
        height: "100%",
        width: `${(current / total) * 100}%`,
        background: "linear-gradient(90deg,#f604c2,#00ffff)",
        transition: "width 0.2s"
      }} />
      <div style={{
        position: "absolute",
        left: "50%", top: 0,
        transform: "translateX(-50%)",
        color: "#fff", fontSize: 14,
        fontWeight: 500
      }}>
        {current} / {total}
      </div>
    </div>
  );
}

// Game runner: handles showing 10 rounds of the selected quiz
function GameRunner({ user, gameKey, onBackToDashboard }) {
  const gameMeta = GAME_LIST.find(g => g.key === gameKey);
  const QuizComponent = gameMeta.component;
  const [step, setStep] = useState(0);
  const [results, setResults] = useState([]);
  const [showSummary, setShowSummary] = useState(false);

  // Track unique MovieBingo categories for this session if/when that game is played
  const [bingoCategories, setBingoCategories] = useState(null);

  // Reset categories list on new game or full reset
  useEffect(() => {
    setBingoCategories(null);
  }, [gameKey]);

  function handleResult(...args) {
    setResults(arr => [...arr, args]);
    setTimeout(() => {
      if (step < 9) setStep(s => s + 1);
      else setShowSummary(true);
    }, 1000); // small delay for feedback
  }

  function resetGame() {
    setStep(0);
    setResults([]);
    setShowSummary(false);
    setBingoCategories(null); // reset the bingo session pool too!
  }

  if (showSummary) {
    const correctCount = results.filter(r => r[0] === true || r[0] === 1).length;
    return (
      <div className="container" style={{ paddingTop: 80 }}>
        <div style={{
          maxWidth: 480,
          margin: "auto",
          padding: 36,
          background: "#1b2255",
          borderRadius: 18,
          color: "#fff",
          textAlign: "center",
          boxShadow: "0 4px 36px #ea12e7aa"
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏁</div>
          <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>
            Quiz Completed!
          </div>
          <div className="subtitle" style={{ color: "#ffda31", marginBottom: 8 }}>
            {user}, your score: <span style={{ fontWeight: 700, color: "#20ffe3" }}>{correctCount} / 10</span>
          </div>
          <button className="btn btn-large" style={{ background: "#f604c2", fontWeight: 700, color: "#fff", marginTop: 8 }} onClick={resetGame}>
            Play Again
          </button>{" "}
          <button className="btn btn-large" style={{ marginLeft: 12, background: '#fafd62', color: '#17174e' }} onClick={onBackToDashboard}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // set up props for MovieBingo for unique session category pool
  const quizProps =
    gameKey === "movie-bingo"
      ? {
        availableCategories:
          bingoCategories ??
          (setBingoCategories &&
            (() => {
              const all = [
                { label: "A Comedy", genreId: 35 },
                { label: "A Blockbuster", minVotes: 500 },
                { label: "Released After 2015", yearFrom: 2015 },
                { label: "National Award Winner", isAwardWinner: true },
                { label: "Family Film", genreId: 10751 },
                { label: "High User Rating", minRating: 7.5 },
                { label: "Action Movie", genreId: 28 },
                { label: "By a Famous Director", director: "Mani Ratnam" },
                { label: "Romantic", genreId: 10749 },
              ];
              setBingoCategories(all.sort(() => Math.random() - 0.5));
              return all;
            })()),
        setAvailableCategories: setBingoCategories,
        onResult: handleResult,
      }
      : { onResult: handleResult };

  return (
    <div className="container" style={{ paddingTop: 80 }}>
      <div>
        <button
          className="btn"
          style={{ background: "#eee3", color: "#f604c2", marginBottom: 20, fontWeight: 700 }}
          onClick={onBackToDashboard}>
          ← Back to Dashboard
        </button>
      </div>
      <div className="title" style={{ fontSize: 26, fontWeight: 600, color: "#f604c2", marginBottom: 4, marginTop: -10 }}>
        {gameMeta.icon} {gameMeta.name}
      </div>
      <ProgressBar current={step + 1} total={10} />
      {gameKey === "movie-bingo" && (
        <MovieBingo
          key={step}
          availableCategories={quizProps.availableCategories}
          setAvailableCategories={quizProps.setAvailableCategories}
          onResult={quizProps.onResult}
        />
      )}
      {gameKey !== "movie-bingo" && (
        <QuizComponent key={step} onResult={handleResult} />
      )}
      <div style={{ textAlign: "center", marginTop: 28, color: "#9ac7fc", fontSize: 13 }}>
        Question {step + 1} out of 10
      </div>
    </div>
  );
}

// Main App
function App() {
  const [user, setUser] = useState(null);
  const [game, setGame] = useState(null);

  function handleLogout() {
    setUser(null);
    setGame(null);
  }

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  if (!game) {
    return <Dashboard user={user} onSelectGame={setGame} onLogout={handleLogout} />;
  }

  return (
    <GameRunner user={user} gameKey={game} onBackToDashboard={() => setGame(null)} />
  );
}

export default App;
