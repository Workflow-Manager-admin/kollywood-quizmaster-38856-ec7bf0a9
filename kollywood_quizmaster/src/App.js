import React, { useState, useEffect, createContext } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import "./App.css";
import tmdb from "./tmdb";

import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import BlurredPosterQuiz from "./components/BlurredPosterQuiz";
import CharacterMovieMatch from "./components/CharacterMovieMatch";
import MovieBingo from "./components/MovieBingo";
import MovieTimelineChallenge from "./components/MovieTimelineChallenge";
import SpinTheWheel from "./components/SpinTheWheel";
import CastCombo from "./components/CastCombo";
import GameSummary from "./components/GameSummary";

// -- App-wide user context. --
export const UserContext = createContext(null);

// No PUBLIC_URL usage here; kept as-is

function Navbar({ user, onLogout }) {
  return (
    <nav className="kq-navbar">
      <div className="kq-navbar-content">
        <span className="kq-logo">
          <span className="kq-logo-flash">🎬</span> Kollywood QuizMaster
        </span>
        <span style={{ color: "#fff" }}>
          {user ? (
            <>
              <b style={{ marginRight: 13 }}>{user.username}</b>
              <button className="kq-btn outline" onClick={onLogout}>
                Log out
              </button>
            </>
          ) : (
            <span className="kq-logo-mini">Welcome!</span>
          )}
        </span>
      </div>
    </nav>
  );
}

function App() {
  // Simulate user session (localStorage could be used in real app)
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = window.localStorage.getItem("kq-user");
    if (u) setUser(JSON.parse(u));
  }, []);

  function handleLogin(username) {
    setUser({ username });
    window.localStorage.setItem("kq-user", JSON.stringify({ username }));
  }
  function handleLogout() {
    setUser(null);
    window.localStorage.removeItem("kq-user");
  }

  return (
    <UserContext.Provider value={user}>
      <Router>
        <Navbar user={user} onLogout={handleLogout} />
        <main>
          <Routes>
            <Route
              path="/"
              element={
                user ? <Dashboard /> : <LoginPage onLogin={handleLogin} />
              }
            />
            <Route
              path="/quiz/blurred-poster"
              element={user ? <BlurredPosterQuiz /> : <Navigate to="/" />}
            />
            <Route
              path="/quiz/character-movie-match"
              element={user ? <CharacterMovieMatch /> : <Navigate to="/" />}
            />
            <Route
              path="/quiz/movie-bingo"
              element={user ? <MovieBingo /> : <Navigate to="/" />}
            />
            <Route
              path="/quiz/movie-timeline"
              element={user ? <MovieTimelineChallenge /> : <Navigate to="/" />}
            />
            <Route
              path="/quiz/spin-the-wheel"
              element={user ? <SpinTheWheel /> : <Navigate to="/" />}
            />
            <Route
              path="/quiz/cast-combo"
              element={user ? <CastCombo /> : <Navigate to="/" />}
            />
            <Route
              path="/summary/:gameType"
              element={user ? <GameSummary /> : <Navigate to="/" />}
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </Router>
    </UserContext.Provider>
  );
}

export default App;
