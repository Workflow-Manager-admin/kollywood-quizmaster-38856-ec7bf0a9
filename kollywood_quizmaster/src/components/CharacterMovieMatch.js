import React, { useState, useEffect, useRef } from "react";
import { discoverTamilMovies, getMovieCast, getPosterUrl } from "../tmdb";
import { useNavigate } from "react-router-dom";
import QuizProgressBar from "./QuizProgressBar";

/**
 * Game: Character-Movie Match
 * Multi-round matching: each round, drag character clues to correct posters.
 * No movie/character repeats until all exhausted. Accurate scoring/results.
 */

// PUBLIC_INTERFACE
function CharacterMovieMatch() {
  // === CONFIGURABLES ===
  const MOVIES_PER_ROUND = 4;
  const MAX_ROUNDS = 3;      // Number of rounds user can play per game session.
  const MIN_CHAR_LENGTH = 2; // Minimum char clue length for validity.

  // State
  const [round, setRound] = useState(0);          // round index (0-based)
  const [gamesCount, setGamesCount] = useState(MAX_ROUNDS); // to display/track more rounds, can be changed per config
  const [allAvailableMovies, setAllAvailableMovies] = useState([]); // fetched, unshuffled list
  const [usedMovieIds, setUsedMovieIds] = useState([]);      // ids already used in any round
  const [usedCharacters, setUsedCharacters] = useState([]);  // characters used across any round
  const [roundMovies, setRoundMovies] = useState([]);        // {id, title, poster, charOptions, correctCharacter}
  const [clues, setClues] = useState([]);                    // [{character, movieId}]
  const [assignments, setAssignments] = useState({});         // movieId: character
  const [draggedClue, setDraggedClue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showClues, setShowClues] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [roundResults, setRoundResults] = useState([]); // Array of arrays for each round
  const [feedback, setFeedback] = useState("");          // Feedback after round
  const navigate = useNavigate();

  // Track if we've exhausted all available movies/characters for playthrough
  const endOfQuestions = useRef(false);

  // Fisher-Yates shuffle for array
  function shuffleArray(arr) {
    const array = [...arr];
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // INITIAL LOAD: Fetch a large pool of movies once per session (not per round)
  useEffect(() => {
    let active = true;
    async function fetchPool() {
      setLoading(true); setError("");
      let finalMovies = [];
      let page = 1;
      // We'll fetch a number of pages to get enough unique/quality movies.
      while (finalMovies.length < MOVIES_PER_ROUND * MAX_ROUNDS && page < 30 && active) {
        let movies = await discoverTamilMovies({ page, "vote_count.gte": 7 });
        // Filter out entries with no poster/title and unwanted duplicates.
        movies = movies.filter(m => m.poster_path && m.title && m.id && (typeof m.id === "number" || typeof m.id === "string"));
        for (const m of movies) {
          if (!finalMovies.find(mm => mm.id === m.id)) {
            finalMovies.push(m);
          }
        }
        page++;
      }
      if (!active) return;
      setAllAvailableMovies(finalMovies);
      setUsedMovieIds([]); // Ensure reset if replay
      setUsedCharacters([]);
      setRoundResults([]);
      setRound(0);
      setLoading(false);
    }
    fetchPool();
    return () => { active = false; }
  }, []);

  // Prepare a round (reset clues, assignments, get movies, fetch cast, etc.)
  useEffect(() => {
    if (!allAvailableMovies.length) { setLoading(true); return; }
    setLoading(true); setError("");
    setAssignments({}); setClues([]); setDraggedClue(null);
    setShowClues(false); setReveal(false); setFeedback("");
    let didCancel = false; // race check

    async function setupRound() {
      // 1. Pick 4 unique, unused movies for this round.
      // If out of new movies, we should stop progressing.
      const availableMovies = allAvailableMovies.filter(m => !usedMovieIds.includes(m.id));
      if (availableMovies.length < MOVIES_PER_ROUND) {
        endOfQuestions.current = true;
        setGamesCount(round+1); // Only display as many rounds as loaded
        setLoading(false);
        return;
      }
      // Sample 4 random unique movies
      const pickedMovies = shuffleArray(availableMovies).slice(0, MOVIES_PER_ROUND);
      // For each, fetch cast and pick a unique character name not yet used
      let prepared = [];
      let roundCharNames = [];
      let tried = 0;
      for (let m of pickedMovies) {
        tried++;
        const cast = await getMovieCast(m.id).catch(() => []);
        // deduplicate and filter
        let validChars = Array.from(
          new Set(
            (cast || [])
              .filter(c => c && c.character && typeof c.character === "string" && c.character.length >= MIN_CHAR_LENGTH)
              .map(c => c.character)
              .filter(str => 
                !str.toLowerCase().includes("himself") &&
                !str.toLowerCase().includes("herself") &&
                !str.toLowerCase().includes("uncredited"))
          )
        );

        // Remove characters seen in all previous rounds.
        validChars = validChars.filter(c => 
          !usedCharacters.includes(c.trim().toLowerCase()) &&
          !roundCharNames.includes(c.trim().toLowerCase())
        );

        if (validChars.length === 0) {
          continue; // try next
        }
        // Pick one clue for this movie for this round
        const character = validChars[Math.floor(Math.random()*validChars.length)];
        roundCharNames.push(character.trim().toLowerCase());
        prepared.push({
          ...m,
          characterOptions: validChars,
          correctCharacter: character
        });
      }

      // If for any reason <MOVIES_PER_ROUND movies got enough clues, try refilling from pool
      if (prepared.length < MOVIES_PER_ROUND) {
        // Mark as end (shouldn't typically trigger)
        endOfQuestions.current = true;
        setGamesCount(round+1);
        setLoading(false);
        return;
      }

      // Build clues: shuffle clues for drag-arrangement
      const roundClues = shuffleArray(prepared.map(m => ({
        character: m.correctCharacter,
        movieId: m.id
      })));

      // If not cancelled, set state
      if (!didCancel) {
        setRoundMovies(prepared);
        setClues(roundClues);
        setAssignments({});
        setLoading(false);
      }
    }
    setupRound();
    return ()=>{ didCancel = true; }
    // eslint-disable-next-line
  }, [round, allAvailableMovies]); // triggers on initial load or round increment

  // Drag handlers for clues (top row)
  function onDragStartClue(e, character) {
    e.dataTransfer?.setData("character", character);
    setDraggedClue(character);
  }
  function onDragEndClue() { setDraggedClue(null); }

  // Allow dropping on poster
  function onDragOverPoster(e) { e.preventDefault(); }
  function onDropPoster(e, movieId) {
    e.preventDefault();
    const character = (e.dataTransfer?.getData("character")) || draggedClue;
    if (!character) return;
    if (
      clues.some(c => c.character === character) &&
      !Object.values(assignments).includes(character)
    ) {
      setAssignments(prev => ({
        ...prev,
        [movieId]: character
      }));
    }
    setDraggedClue(null);
  }

  // For keyboard accessibility (tab+enter to assign)
  function assignClueToPoster(character, movieId) {
    if (
      clues.some(c => c.character === character) &&
      !Object.values(assignments).includes(character)
    ) {
      setAssignments(prev => ({
        ...prev,
        [movieId]: character
      }));
    }
  }

  function clearAssignment(movieId) {
    setAssignments(prev => {
      const newAssign = { ...prev };
      delete newAssign[movieId];
      return newAssign;
    });
  }

  // Evaluate user assignments for round
  function evaluateAssignments() {
    return roundMovies.map((m) => ({
      movieId: m.id,
      poster: m.poster_path,
      movie: m.title,
      chosen: assignments[m.id],
      correct: m.correctCharacter,
      correctMatch: !!assignments[m.id] && assignments[m.id] === m.correctCharacter
    }));
  }

  // Compute round score
  function roundScore(resultList) {
    return resultList.filter(r => r.correctMatch).length;
  }

  // PUBLIC_INTERFACE
  function handleSubmit() {
    // 1. Evaluate results for the round
    const summary = evaluateAssignments();
    const roundCorrect = roundScore(summary);
    // 2. Update round-wise results array (append for new round)
    setRoundResults(prev => {
      let copy = prev.slice();
      copy[round] = summary;
      return copy;
    });
    // 3. Mark reveal, feedback, and show answers before proceeding
    setReveal(true);
    setShowClues(true);
    setFeedback(`Round ${round + 1}: You matched ${roundCorrect} of ${MOVIES_PER_ROUND} correctly!`);
    // 4. Wait and then progress to next round or summary
    // Mark movies/characters as used (across all game)
    setUsedMovieIds(prev => prev.concat(roundMovies.map(m=>m.id)));
    setUsedCharacters(prev => prev.concat(roundMovies.map(m=>m.correctCharacter.trim().toLowerCase())));
    // Progression: move to next round or summary screen
    setTimeout(() => {
      if ((round + 1) < gamesCount && !endOfQuestions.current) {
        setRound(round + 1);
        // All other state changes handled in useEffect
      } else {
        // Build flat results array & go to summary
        let flatResults = [];
        let score = 0, total = 0;
        roundResults.concat([summary]).forEach((lst) => {
          lst.forEach((item) => {
            flatResults.push({
              correct: item.correctMatch,
              guess: item.chosen,
              solution: item.correct,
              poster: item.poster
            });
            total++;
            if (item.correctMatch) score++;
          });
        });
        // Transition to summary
        navigate("/summary/character-movie-match", {
          state: { results: flatResults, userScore: score, total: total }
        });
      }
    }, 2100);
  }

  function handleReveal() {
    setReveal(true);
    setShowClues(true);
    setFeedback("Revealing answers...");
    setTimeout(handleSubmit, 2200);
  }

  // Restart (full reload)
  function restartGame() { window.location.reload(); }

  // Helper for rendering clues
  function isClueAssigned(clue) {
    return Object.values(assignments).includes(clue.character);
  }
  const allAssigned =
    Object.keys(assignments).length === MOVIES_PER_ROUND &&
    Object.values(assignments).every(Boolean) &&
    !reveal;

  // UI Render
  if (loading)
    return (
      <div className="kq-quiz-panel kq-center" style={{ marginTop: 25 }}>
        Loading posters and character clues...
      </div>
    );
  if (endOfQuestions.current) {
    return (
      <div className="kq-quiz-panel kq-center" style={{ marginTop: 25 }}>
        {gamesCount > 1
          ? "You've answered all non-repeating movie rounds for this session!"
          : "Failed to load enough data for a round."}
        <br />
        <button className="kq-btn outline" onClick={restartGame}>Retry</button>
      </div>
    );
  }
  if (!roundMovies.length || !clues.length)
    return (
      <div className="kq-quiz-panel kq-center" style={{ marginTop: 25 }}>
        Failed to load movies/characters for this round.<br />
        <button className="kq-btn outline" onClick={restartGame}>Retry</button>
      </div>
    );

  return (
    <div className="kq-quiz-panel" tabIndex={-1}>
      <QuizProgressBar step={round} total={gamesCount} />
      <div style={{ color: "#222", marginBottom: 9, fontWeight: 600, fontSize: "1.16em" }}>
        Round {round + 1} of {gamesCount}
      </div>
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
          {clues.map((clue, idx) => (
            <button
              key={clue.character + idx}
              style={{
                borderRadius: 7,
                cursor: !isClueAssigned(clue) && !reveal ? "grab" : "not-allowed",
                padding: "10px 17px",
                background: "#fff",
                color: "#f604c2",
                border: "2px solid #f604c2",
                fontWeight: "bold",
                fontSize: "1.08rem",
                opacity: isClueAssigned(clue) || reveal ? 0.36 : 1,
                pointerEvents: isClueAssigned(clue) || reveal ? "none" : "auto",
                userSelect: "none",
                outline:
                  draggedClue === clue.character && !isClueAssigned(clue)
                    ? "2.5px solid #b51b3b"
                    : "none",
                boxShadow: draggedClue === clue.character ? "0 0 4px #b51b3b88" : "",
                transition: "opacity 0.15s, outline 0.18s, box-shadow 0.13s"
              }}
              tabIndex={isClueAssigned(clue) || reveal ? -1 : 0}
              draggable={!isClueAssigned(clue) && !reveal}
              aria-label={`character ${clue.character}`}
              onDragStart={(e) => onDragStartClue(e, clue.character)}
              onDragEnd={onDragEndClue}
              onKeyDown={(e) => {
                // Space/Enter starts drag
                if (
                  !isClueAssigned(clue) &&
                  !reveal &&
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
            gridTemplateColumns: `repeat(${MOVIES_PER_ROUND}, minmax(122px,1fr))`,
            gap: "22px",
            justifyItems: "center",
            alignItems: "flex-start",
            marginTop: 9,
            marginBottom: "7px",
          }}
        >
          {roundMovies.map((movie, idx) => {
            const assignedCharacter = assignments[movie.id];
            const isDropTarget = !assignedCharacter && !reveal;

            // --- New Highlight Logic ---
            // Provide immediate visual feedback if this poster is being hovered with the draggedClue, 
            // and draggedClue matches this movie's correct character clue.
            const isDraggedOverCorrect =
              isDropTarget &&
              draggedClue &&
              clues.find(
                (clue) => clue.character === draggedClue && clue.movieId === movie.id
              );
            const isDraggedOverWrong =
              isDropTarget &&
              draggedClue &&
              clues.find(
                (clue) => clue.character === draggedClue && clue.movieId !== movie.id
              );

            // highlight parameters
            let dropBorderColor = assignedCharacter
              ? "#f604c2"
              : "2px dashed #f604c2";
            let dropBoxShadow = "";
            let dropIndicator = null;

            if (isDraggedOverCorrect) {
              dropBorderColor = "2.5px solid #1b9e38";
              dropBoxShadow = "0 0 9px 1.5px #75c684";
              dropIndicator = (
                <span title="Matching!">
                  <span style={{ color: "#1b9e38", fontWeight: 900, fontSize: 19, marginLeft: 4 }}>✔️</span>
                </span>
              );
            } else if (isDraggedOverWrong) {
              dropBorderColor = "2.5px solid #b51b3b";
              dropBoxShadow = "0 0 9px 1.5px #b51b3b55";
              dropIndicator = (
                <span title="Incorrect match!">
                  <span style={{ color: "#b51b3b", fontWeight: 900, fontSize: 18, marginLeft: 4 }}>❌</span>
                </span>
              );
            }

            return (
              <div
                key={movie.id}
                tabIndex={isDropTarget ? 0 : -1}
                style={{
                  background: "#faeff9",
                  borderRadius: "12px",
                  boxShadow: dropBoxShadow || "var(--kq-shadow)",
                  padding: 10,
                  textAlign: "center",
                  minWidth: 110,
                  outline: isDropTarget && draggedClue ? "2.0px solid #f604c2" : undefined
                }}
                // To allow dynamic border and feedback
                onDragOver={
                  isDropTarget
                    ? (e) => {
                        e.preventDefault();
                        // Optionally: update some feedback state if more dynamic changes needed
                      }
                    : undefined
                }
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
                      : dropBorderColor,
                    background: "#ddd",
                    transition: "border 0.18s, box-shadow 0.18s",
                    opacity: reveal ? 0.84 : 1,
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
                      {!reveal && (
                        <span
                          title="Unassign"
                          style={{
                            fontSize: "1.0em",
                            marginLeft: 7,
                            opacity: 0.55,
                            cursor: "pointer",
                          }}
                          onClick={() => !reveal && clearAssignment(movie.id)}
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
                        display: "flex",
                        alignItems: "center"
                      }}
                    >
                      {isDropTarget
                        ? <>{isDraggedOverCorrect
                          ? <>Correct match! {dropIndicator}</>
                          : isDraggedOverWrong
                          ? <>Not a match {dropIndicator}</>
                          : "Drop clue here"}
                        </>
                        : "—"
                      }
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
            disabled={showClues || reveal}
          >
            {showClues ? "Clue shown" : "Show Clue"}
          </button>
          <button
            className="kq-quiz-answer-btn reveal"
            onClick={handleReveal}
            disabled={reveal}
          >
            Reveal
          </button>
          <button
            className="kq-quiz-answer-btn"
            onClick={handleSubmit}
            disabled={!allAssigned || reveal}
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
        {(reveal || feedback) && (
          <div
            style={{
              color: reveal ? "#b51b3b" : "#222",
              marginTop: 14,
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            {feedback}
          </div>
        )}
      </div>
    </div>
  );
}

export default CharacterMovieMatch;
