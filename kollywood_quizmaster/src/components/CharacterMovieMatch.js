import React, { useState, useEffect } from "react";
import { discoverTamilMovies, getMovieCast, getPosterUrl } from "../tmdb";
import { useNavigate } from "react-router-dom";
import QuizProgressBar from "./QuizProgressBar";

/**
 * Game: Character-Movie Match
 * Show 4 Tamil movie posters with drag-and-drop character name clues.
 * Users drag character names to match the correct movie poster.
 */
// PUBLIC_INTERFACE
function CharacterMovieMatch() {
  const MOVIE_COUNT = 4;
  const [movies, setMovies] = useState([]);
  const [characterClues, setCharacterClues] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [draggedCharacter, setDraggedCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showClues, setShowClues] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [results, setResults] = useState(null);
  const navigate = useNavigate();

  // Shuffle utility (Fisher-Yates)
  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  useEffect(() => {
    async function setupGame() {
      setLoading(true);
      setReveal(false);
      setShowClues(false);
      setResults(null);
      let tamilMovies = await discoverTamilMovies({ page: Math.floor(Math.random() * 25) + 1, "vote_count.gte": 7 });

      // Filter for movies that have posters & title
      tamilMovies = tamilMovies.filter(m => m.poster_path && m.title && m.id);
      tamilMovies = shuffleArray(tamilMovies);

      const selected = tamilMovies.slice(0, MOVIE_COUNT);

      // For each, get cast and pick a random character (from those that have character names)
      const withCast = await Promise.all(
        selected.map(async m => {
          const cast = await getMovieCast(m.id);
          // Get characters with names & remove duplicates/empty
          const validChars = Array.from(
            new Set(cast.filter(c => c.character && c.character.length > 1).map(c => c.character))
          );
          return {
            ...m,
            characterOptions: validChars
          };
        })
      );
      // Only keep those with at least one character
      const moviesWithCharacter = withCast.filter(m => m.characterOptions && m.characterOptions.length > 0);
      if (moviesWithCharacter.length < MOVIE_COUNT) {
        // Not enough, fallback (try again)
        setMovies([]);
        setCharacterClues([]);
        setTimeout(() => setupGame(), 700);
        return;
      }
      // Pick ONE random character per movie (for clues)
      const chosen = moviesWithCharacter.slice(0, MOVIE_COUNT).map(m => {
        const character = m.characterOptions[Math.floor(Math.random() * m.characterOptions.length)];
        return { ...m, correctCharacter: character };
      });
      setMovies(chosen);

      // Prepare clues (shuffle for replayability)
      const clues = shuffleArray(chosen.map(m => ({
        character: m.correctCharacter,
        movieId: m.id
      })));
      setCharacterClues(clues);
      setAssignments({});
      setLoading(false);
    }
    setupGame();
    // eslint-disable-next-line
  }, []);

  function onDrop(e, movieId) {
    const character = e.dataTransfer.getData("character");
    if (!character) return;
    setAssignments(prev => ({
      ...prev,
      [movieId]: character
    }));
  }

  function startDrag(e, character) {
    setDraggedCharacter(character);
    e.dataTransfer.setData("character", character);
  }

  function allowDrop(e) {
    e.preventDefault();
  }

  function handleReveal() {
    setReveal(true);
    setShowClues(true);
    setTimeout(handleSubmit, 2200);
  }

  // PUBLIC_INTERFACE
  function handleSubmit() {
    // Result: Array of {movieId (number), match: boolean, chosen: string, correct: string}
    const summary = movies.map(m => {
      return {
        movieId: m.id,
        poster: m.poster_path,
        movie: m.title,
        chosen: assignments[m.id],
        correct: m.correctCharacter,
        correctMatch: assignments[m.id] && assignments[m.id] === m.correctCharacter
      };
    });
    setResults(summary);
    setReveal(true);
    setShowClues(true);
    setTimeout(() => {
      navigate("/summary/character-movie-match", {
        state: {
          results: summary.map(item => ({
            correct: item.correctMatch,
            guess: item.chosen,
            solution: item.correct,
            poster: item.poster,
          }))
        }
      });
    }, 2000);
  }

  function restartGame() {
    setMovies([]);
    setCharacterClues([]);
    setResults(null);
    setReveal(false);
    setShowClues(false);
    setAssignments({});
    // triggers useEffect to reload game
    setTimeout(() => window.location.reload(), 100);
  }

  if (loading)
    return (
      <div className="kq-quiz-panel kq-center" style={{ marginTop: 25 }}>
        Loading posters and character clues...
      </div>
    );

  if (!movies.length || !characterClues.length)
    return (
      <div className="kq-quiz-panel kq-center" style={{ marginTop: 25 }}>
        Failed to load enough movies/characters. <br />
        <button className="kq-btn outline" onClick={restartGame}>Retry</button>
      </div>
    );

  const allAssigned = Object.keys(assignments).length === MOVIE_COUNT && Object.values(assignments).every(Boolean) && !results;

  return (
    <div className="kq-quiz-panel">
      <QuizProgressBar step={results ? MOVIE_COUNT : 0} total={MOVIE_COUNT} />
      <h3 style={{ color: "#f604c2", textAlign: "center", marginBottom: 14 }}>
        Drag the correct <span style={{ color: "#b51b3b" }}>character name</span> onto each movie poster!
      </h3>
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${MOVIE_COUNT}, minmax(120px,1fr))`,
        gap: "22px",
        justifyItems: "center",
        marginBottom: "17px"
      }}>
        {movies.map(m => (
          <div
            key={m.id}
            style={{
              background: "#faeff9",
              borderRadius: "12px",
              boxShadow: "var(--kq-shadow)",
              padding: 8,
              textAlign: "center"
            }}
            onDragOver={allowDrop}
            onDrop={e => onDrop(e, m.id)}
          >
            <img
              src={getPosterUrl(m.poster_path, "w185")}
              alt={m.title}
              style={{
                width: 105,
                height: 158,
                objectFit: "cover",
                borderRadius: 8,
                marginBottom: 8,
                border: assignments[m.id] ? "3px solid #f604c2" : "2px dashed #f604c2",
                background: "#ddd",
                transition: "border 0.18s"
              }}
              draggable={false}
            />
            <div style={{
              minHeight: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: assignments[m.id] ? 700 : 400,
              color: "#0b0a0a"
            }}>
              {assignments[m.id]
                ? <span> 🏷️ <b>{assignments[m.id]}</b></span>
                : <span style={{opacity:0.63}}>Drop character here</span>}
            </div>
            <div style={{ marginTop: 7, color: "#222", fontSize: 13, minHeight: 40 }}>
              <b>{m.title}</b>
            </div>
            {reveal && <div style={{
              marginTop: 2,
              color: assignments[m.id] === m.correctCharacter ? "#1b9e38" : "#b51b3b",
              fontWeight: "bold"
            }}>
              {assignments[m.id] === m.correctCharacter
                ? "✅ Correct!"
                : <>❌<span style={{fontWeight: 400, marginLeft:4}}>Ans: {m.correctCharacter}</span></>}
            </div>}
          </div>
        ))}
      </div>
      <div style={{
        margin: "20px 0 12px 0",
        display: "flex",
        flexWrap: "wrap",
        gap: "13px",
        justifyContent: "center"
      }}>
        {characterClues.map((c, idx) => (
          <span
            key={c.character + idx}
            draggable={!assignments && !reveal}
            onDragStart={e => startDrag(e, c.character)}
            style={{
              borderRadius: 7,
              cursor: "grab",
              padding: "10px 20px",
              background: "#fff",
              color: "#f604c2",
              border: "2px solid #f604c2",
              fontWeight: "bold",
              fontSize: "1.09rem",
              opacity: assignments && Object.values(assignments).includes(c.character)
                ? 0.4 : 1,
              pointerEvents: assignments && Object.values(assignments).includes(c.character)
                ? "none" : "auto",
              userSelect: "none"
            }}
            className="kq-btn outline"
          >
            {c.character}
          </span>
        ))}
      </div>
      <div className="kq-quiz-action-bar" style={{ marginTop: 10 }}>
        <button
          className="kq-quiz-answer-btn"
          onClick={() => setShowClues((v) => !v)}
          disabled={showClues || !!results}
        >
          {showClues ? "Clue shown" : "Show Clue"}
        </button>
        <button
          className="kq-quiz-answer-btn reveal"
          onClick={handleReveal}
          disabled={reveal || !!results}
        >
          Reveal
        </button>
        <button
          className="kq-quiz-answer-btn"
          onClick={handleSubmit}
          disabled={!allAssigned || reveal || !!results}
        >
          Submit
        </button>
      </div>
      {showClues && (
        <div className="kq-quiz-clues" style={{marginTop:10}}>
          <span>
            <b>Tip:</b> Each movie poster is matched to a Kollywood character name. Drag a clue onto its movie!
          </span>
        </div>
      )}
      {results && (
        <div style={{ color: "#1b9e38", marginTop: 16, textAlign: "center", fontWeight: 600 }}>
          Results submitted! Redirecting...
        </div>
      )}
    </div>
  );
}

export default CharacterMovieMatch;
