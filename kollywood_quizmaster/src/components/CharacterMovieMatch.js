import React, { useState, useEffect } from "react";
import { discoverTamilMovies, getMovieCast, getPosterUrl } from "../tmdb";
import { useNavigate } from "react-router-dom";
import QuizProgressBar from "./QuizProgressBar";

/**
 * Game: Character-Movie Match
 * Show 4 Tamil movie posters with drag-and-drop character name clues.
 * Users drag character names to match the correct movie poster.
 * Character clues appear at the top, movie poster grid at the bottom for clean separation.
 */
// PUBLIC_INTERFACE
function CharacterMovieMatch() {
  const MOVIE_COUNT = 4;
  const [movies, setMovies] = useState([]);
  const [characterClues, setCharacterClues] = useState([]); // {character, movieId}
  const [assignments, setAssignments] = useState({}); // movieId: character
  const [draggedClue, setDraggedClue] = useState(null); // character name
  const [loading, setLoading] = useState(true);
  const [showClues, setShowClues] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [results, setResults] = useState(null);
  const navigate = useNavigate();

  // Fisher-Yates shuffle for array
  function shuffleArray(arr) {
    const array = [...arr];
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Setup/refresh game
  useEffect(() => {
    let isMounted = true;

    async function setupGame() {
      setLoading(true);
      setReveal(false);
      setShowClues(false);
      setResults(null);
      setAssignments({});

      // To avoid repeated titles, use a Set to track picked titles (local to this round)
      // Try sampling from multiple pages if not enough unique titles
      const neededMovies = MOVIE_COUNT;
      let collected = [];
      let triedTitles = new Set();
      let page = Math.floor(Math.random() * 25) + 1;
      // Try up to 6 pages to ensure diversity and non-repeating titles
      for (let retries = 0; collected.length < neededMovies && retries < 6; retries++) {
        let tamilMovies = await discoverTamilMovies({
          page: ((page + retries) % 25) + 1,
          "vote_count.gte": 7,
        });
        tamilMovies = tamilMovies.filter((m) => m.poster_path && m.title && m.id && !triedTitles.has(m.title.trim().toLowerCase()));
        for (const m of tamilMovies) {
          const tTitle = m.title.trim().toLowerCase();
          if (!triedTitles.has(tTitle) && collected.length < neededMovies) {
            collected.push(m);
            triedTitles.add(tTitle);
          }
        }
      }

      // Now we have at most four unique-title movies
      if (collected.length < neededMovies) {
        // Not enough unique-title movies with posters found, retry after a short pause
        if (isMounted) setTimeout(setupGame, 700);
        return;
      }

      // For each movie, fetch accurate character options from TMDb
      const withCast = await Promise.all(
        collected.map(async (m) => {
          const cast = await getMovieCast(m.id);
          // Deduplicate and filter for displayable characters
          const validChars = Array.from(
            new Set(
              (Array.isArray(cast) ? cast : [])
                .filter(
                  (c) =>
                    c.character &&
                    typeof c.character === "string" &&
                    c.character.length > 1 &&
                    !c.character.toLowerCase().includes("himself") &&
                    !c.character.toLowerCase().includes("herself") &&
                    !c.character.toLowerCase().includes("uncredited")
                )
                .map((c) => c.character)
            )
          );
          return {
            ...m,
            characterOptions: validChars,
          };
        })
      );

      // Must ensure each movie has at least one valid character clue
      const moviesWithChar = withCast
        .filter(
          (m) => Array.isArray(m.characterOptions) && m.characterOptions.length > 0
        )
        // In case two movies have the same featured character, filter for unique characters globally
        .slice(0, neededMovies);

      if (moviesWithChar.length < neededMovies) {
        // Not enough valid movies with characters, try again
        if (isMounted) setTimeout(setupGame, 800);
        return;
      }

      // Assign a unique random character clue for each movie, and globally ensure character names do not repeat
      let usedCharacters = new Set();
      const chosen = [];
      for (let m of moviesWithChar) {
        const charOptions = m.characterOptions.filter(
          (c) => !usedCharacters.has(c.trim().toLowerCase())
        );
        if (!charOptions.length) continue;
        const character = charOptions[Math.floor(Math.random() * charOptions.length)];
        usedCharacters.add(character.trim().toLowerCase());
        chosen.push({ ...m, correctCharacter: character });
      }

      if (chosen.length < neededMovies) {
        // If by any chance duplicate character names reduced our count, retry
        if (isMounted) setTimeout(setupGame, 850);
        return;
      }

      // Prepare drag clues, shuffle clues
      const clues = shuffleArray(
        chosen.map((m) => ({
          character: m.correctCharacter,
          movieId: m.id,
        }))
      );

      if (isMounted) {
        setMovies(chosen);
        setCharacterClues(clues);
        setAssignments({});
        setLoading(false);
      }
    }
    setupGame();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line
  }, []);

  // Drag handlers for clues (top row)
  function onDragStartClue(e, character) {
    e.dataTransfer.setData("character", character);
    setDraggedClue(character);
    // Custom drag avatar is optional for clarity
  }
  function onDragEndClue() {
    setDraggedClue(null);
  }

  // Allow dropping on poster
  function onDragOverPoster(e) {
    e.preventDefault();
  }
  function onDropPoster(e, movieId) {
    e.preventDefault();
    const character = (e.dataTransfer.getData && e.dataTransfer.getData("character")) || draggedClue;
    if (!character) return;
    // Only allow assigning unused clues
    if (
      characterClues.some((c) => c.character === character) &&
      !Object.values(assignments).includes(character)
    ) {
      setAssignments((prev) => ({
        ...prev,
        [movieId]: character,
      }));
    }
    setDraggedClue(null);
  }

  // For keyboard accessibility (tab+enter to assign)
  function assignClueToPoster(character, movieId) {
    if (
      characterClues.some((c) => c.character === character) &&
      !Object.values(assignments).includes(character)
    ) {
      setAssignments((prev) => ({
        ...prev,
        [movieId]: character,
      }));
    }
  }

  // Unassign a clue from a poster (allow re-match before submit)
  function clearAssignment(movieId) {
    setAssignments((prev) => {
      const newAssign = { ...prev };
      delete newAssign[movieId];
      return newAssign;
    });
  }

  function handleReveal() {
    setReveal(true);
    setShowClues(true);
    setTimeout(handleSubmit, 2200);
  }

  // PUBLIC_INTERFACE
  function handleSubmit() {
    // Compute result summary
    const summary = movies.map((m) => {
      return {
        movieId: m.id,
        poster: m.poster_path,
        movie: m.title,
        chosen: assignments[m.id],
        correct: m.correctCharacter,
        correctMatch:
          !!assignments[m.id] && assignments[m.id] === m.correctCharacter,
      };
    });
    setResults(summary);
    setReveal(true);
    setShowClues(true);
    setTimeout(() => {
      navigate("/summary/character-movie-match", {
        state: {
          results: summary.map((item) => ({
            correct: item.correctMatch,
            guess: item.chosen,
            solution: item.correct,
            poster: item.poster,
          })),
        },
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

  const allAssigned =
    Object.keys(assignments).length === MOVIE_COUNT &&
    Object.values(assignments).every(Boolean) &&
    !results;

  // Get available clues (not yet assigned)
  function isClueAssigned(clue) {
    return Object.values(assignments).includes(clue.character);
  }

  return (
    <div className="kq-quiz-panel" tabIndex={-1}>
      <QuizProgressBar step={results ? MOVIE_COUNT : 0} total={MOVIE_COUNT} />
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Top: DRAGGABLE CLUES */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 13,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          {characterClues.map((clue, idx) => (
            <button
              key={clue.character + idx}
              style={{
                borderRadius: 7,
                cursor:
                  !isClueAssigned(clue) && !reveal && !results
                    ? "grab"
                    : "not-allowed",
                padding: "10px 17px",
                background: "#fff",
                color: "#f604c2",
                border: "2px solid #f604c2",
                fontWeight: "bold",
                fontSize: "1.08rem",
                opacity: isClueAssigned(clue) || reveal || results ? 0.36 : 1,
                pointerEvents:
                  isClueAssigned(clue) || reveal || results
                    ? "none"
                    : "auto",
                userSelect: "none",
                outline:
                  draggedClue === clue.character && !isClueAssigned(clue)
                    ? "2.5px solid #b51b3b"
                    : "none",
                boxShadow: draggedClue === clue.character ? "0 0 4px #b51b3b88" : "",
                transition: "opacity 0.15s, outline 0.18s, box-shadow 0.13s"
              }}
              tabIndex={isClueAssigned(clue) || reveal || results ? -1 : 0}
              draggable={!isClueAssigned(clue) && !reveal && !results}
              aria-label={`character ${clue.character}`}
              onDragStart={(e) => onDragStartClue(e, clue.character)}
              onDragEnd={onDragEndClue}
              onKeyDown={(e) => {
                // Space/Enter starts drag
                if (
                  !isClueAssigned(clue) &&
                  !reveal &&
                  !results &&
                  (e.key === "Enter" || e.key === " ")
                ) {
                  setDraggedClue(clue.character);
                }
              }}
              className="kq-btn outline"
            >
              {clue.character}
            </button>
          ))}
        </div>
        {/* BOTTOM: MOVIE POSTER GRID */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${MOVIE_COUNT}, minmax(122px,1fr))`,
            gap: "22px",
            justifyItems: "center",
            alignItems: "flex-start",
            marginTop: 9,
            marginBottom: "7px",
          }}
        >
          {movies.map((movie, idx) => {
            const assignedCharacter = assignments[movie.id];
            const isDropTarget = !assignedCharacter && !reveal && !results;
            return (
              <div
                key={movie.id}
                tabIndex={isDropTarget ? 0 : -1}
                style={{
                  background: "#faeff9",
                  borderRadius: "12px",
                  boxShadow: "var(--kq-shadow)",
                  padding: 10,
                  textAlign: "center",
                  minWidth: 110,
                  outline: isDropTarget && draggedClue ? "2.0px solid #f604c2" : undefined
                }}
                onDragOver={isDropTarget ? onDragOverPoster : undefined}
                onDrop={isDropTarget ? (e) => onDropPoster(e, movie.id) : undefined}
                aria-dropeffect={isDropTarget ? "move" : undefined}
                onKeyUp={
                  isDropTarget && draggedClue
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          assignClueToPoster(draggedClue, movie.id);
                          setDraggedClue(null);
                        }
                      }
                    : undefined
                }
              >
                <img
                  src={getPosterUrl(movie.poster_path, "w185")}
                  alt={movie.title}
                  style={{
                    width: 105,
                    height: 158,
                    objectFit: "cover",
                    borderRadius: 8,
                    marginBottom: 7,
                    border: assignedCharacter
                      ? "3px solid #f604c2"
                      : "2px dashed #f604c2",
                    background: "#ddd",
                    transition: "border 0.18s",
                    opacity: reveal || results ? 0.84 : 1,
                  }}
                  draggable={false}
                />
                <div
                  style={{
                    minHeight: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: assignedCharacter ? 700 : 400,
                    color: "#0b0a0a",
                    marginBottom: 4,
                  }}
                  aria-live="polite"
                >
                  {assignedCharacter && (
                    <span>
                      🏷️ <b>{assignedCharacter}</b>
                      {!reveal && !results && (
                        <span
                          title="Unassign"
                          style={{
                            fontSize: "1.0em",
                            marginLeft: 7,
                            opacity: 0.55,
                            cursor: "pointer",
                          }}
                          onClick={() =>
                            !reveal && !results && clearAssignment(movie.id)
                          }
                          tabIndex={0}
                          onKeyUp={(e) =>
                            (e.key === "Delete" || e.key === "Backspace") &&
                            clearAssignment(movie.id)
                          }
                          aria-label="Clear assignment"
                        >
                          ❌
                        </span>
                      )}
                    </span>
                  )}
                  {!assignedCharacter && (
                    <span
                      style={{
                        color: "#aaa",
                        opacity: 0.63,
                        fontSize: "0.97em",
                        fontWeight: 400,
                      }}
                    >
                      {isDropTarget ? "Drop clue here" : "—"}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    color: "#222",
                    fontSize: 13,
                    minHeight: 36,
                  }}
                >
                  <b>{movie.title}</b>
                </div>
                {reveal && (
                  <div
                    style={{
                      marginTop: 2,
                      color:
                        assignments[movie.id] === movie.correctCharacter
                          ? "#1b9e38"
                          : "#b51b3b",
                      fontWeight: "bold",
                      minHeight: 18,
                    }}
                  >
                    {assignments[movie.id] === movie.correctCharacter
                      ? "✅ Correct!"
                      : (
                        <span>
                          ❌
                          <span style={{ fontWeight: 400, marginLeft: 4 }}>
                            Ans: {movie.correctCharacter}
                          </span>
                        </span>
                      )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="kq-quiz-action-bar" style={{ marginTop: 9 }}>
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
          <div className="kq-quiz-clues" style={{ marginTop: 8 }}>
            <span>
              <b>Tip:</b> Drag a character clue above onto its movie poster below. You can click ❌ to undo an assignment before submitting!
            </span>
          </div>
        )}
        {results && (
          <div
            style={{
              color: "#1b9e38",
              marginTop: 14,
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            Results submitted! Redirecting...
          </div>
        )}
      </div>
    </div>
  );
}

export default CharacterMovieMatch;
