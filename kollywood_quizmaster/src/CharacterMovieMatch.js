import React, { useEffect, useState, useRef } from "react";
import { fetchPopularKollywoodMovies, fetchMovieDetails, getPosterUrl } from "./tmdbApi";

// Helper to shuffle array (Fisher-Yates)
function shuffle(array) {
  let arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * CharacterMovieMatch game, harder edition:
 * - Instead of using main characters only, prefer less prominent (not lead/top-billed) characters as clues.
 * - Actor names in parentheses are **no longer shown** in clues.
 * - Only character names appear in clue chips.
 * - TMDb data filters out generic ("Self") and too short/empty, and also skips always top-3-billed characters when valid harder choices exist.
 */
function CharacterMovieMatch({ onResult }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pairs, setPairs] = useState([]); // [{movieTitle, poster_path, char, movieId}]
  const [clues, setClues] = useState([]); // [{text, idx}]
  const [options, setOptions] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [dragging, setDragging] = useState(null);
  const [status, setStatus] = useState("playing");
  const [feedback, setFeedback] = useState({});
  const [score, setScore] = useState(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      setError("");
      setScore(null);
      setAssignments({});
      setClues([]);
      setOptions([]);
      setFeedback({});
      setStatus("playing");
      // We want 3-4 movies with less obvious/less-main character clues
      try {
        const page = Math.floor(Math.random() * 3) + 1;
        const data = await fetchPopularKollywoodMovies(page);
        if (!Array.isArray(data.results) || data.results.length < 5)
          throw new Error("TMDb didn't return enough Kollywood movies. Try again later.");
        // Must have posters
        const posterMovies = data.results.filter(m => !!m.poster_path && !!m.id);
        if (posterMovies.length < 3)
          throw new Error("Not enough Kollywood movie posters available now. Try refresh.");
        // Try with more movies to ensure harder clues
        let candidates = shuffle(posterMovies).slice(0, 8);
        let pairsArr = [];
        for (let i = 0; i < candidates.length && pairsArr.length < 3; i++) {
          let det;
          try {
            det = await fetchMovieDetails(candidates[i].id);
          } catch {
            continue;
          }
          // Find a less 'main' character with a valid character name
          // Try to pick someone outside top 2 billing, else take whatever valid is there
          const cast = Array.isArray(det.credits?.cast) ? det.credits.cast : [];
          // Exclude generic "Self" or empty, extremely short or only whitespace, also skip "uncredited"
          const hardCast = cast.filter(
            actor =>
              actor &&
              actor.character &&
              !/^self$/i.test(actor.character.trim()) &&
              actor.character.trim().length > 1 &&
              !/uncredited/i.test(actor.character) &&
              !/crowd/i.test(actor.character)
          );
          // Sort by order/billing (lower = more prominent)
          const sortedHardCast = [...hardCast].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
          // Try to pick from lower billing unless there are only few
          let chosen = null;
          if (sortedHardCast.length > 5) {
            // Pick randomly among 4th-8th billing (index [3,7]), to make harder, else from rest
            const range = sortedHardCast.slice(3, 9);
            if (range.length) {
              chosen = shuffle(range)[0];
            }
          }
          if (!chosen && sortedHardCast.length) {
            // fallback: pick one from lower half if possible
            if (sortedHardCast.length > 3) {
              chosen = sortedHardCast[Math.floor(sortedHardCast.length / 2)];
            } else {
              chosen = sortedHardCast[0];
            }
          }
          // Do NOT include actor names in clue anymore; only character name
          if (chosen && chosen.character && chosen.character.trim().length > 1) {
            pairsArr.push({
              movieTitle: det.title,
              poster_path: det.poster_path,
              char: chosen.character,
              movieId: det.id
            });
          }
        }
        if (pairsArr.length < 3)
          throw new Error("Couldn't retrieve enough movies with suitable hard character clues. Try again.");
        // Shuffle to increase challenge with visually similar posters and clues
        const shuffledOptions = shuffle(pairsArr);
        const clueObjs = shuffle(
          shuffledOptions.map((p, idx) => ({
            text: `${p.char}`,
            idx: idx,
            assigned: false
          }))
        );
        if (ignore) return;
        setPairs(shuffledOptions);
        setOptions(shuffledOptions);
        setClues(clueObjs);
      } catch (e) {
        setError(e.message || "Failed to generate the quiz. Please try again.");
      }
      setLoading(false);
    }
    load();
    return () => (ignore = true);
  }, []);

  // Drag and drop event handlers
  const dragClueStart = idx => {
    setDragging(idx);
  };
  const dragClueEnd = () => {
    setDragging(null);
  };

  // Allow drop only on unassigned posters
  const allowDrop = (e, posterIdx) => {
    e.preventDefault();
    // Don't allow drop if already assigned
    if (assignments.hasOwnProperty(posterIdx)) return false;
    return true;
  };

  // Drop a clue onto a poster
  const handleDrop = (e, posterIdx) => {
    if (assignments.hasOwnProperty(posterIdx)) return; // prevent double-assignment
    setAssignments(prev => ({
      ...prev,
      [posterIdx]: dragging
    }));
    setDragging(null);
  };

  // Remove clue assignment (if user clicks "undo assignment")
  const unassign = posterIdx => {
    setAssignments(prev => {
      const newA = { ...prev };
      delete newA[posterIdx];
      return newA;
    });
  };

  // Submit: grade and update feedback/score
  const handleSubmit = e => {
    e && e.preventDefault();
    let correct = 0;
    let feedbackMap = {};
    for (let i = 0; i < options.length; i++) {
      const assignedClueIdx = assignments[i];
      if (
        typeof assignedClueIdx === "number" &&
        clues[assignedClueIdx] &&
        clues[assignedClueIdx].idx === i // clue idx matches poster idx
      ) {
        feedbackMap[i] = "correct";
        correct++;
      } else if (typeof assignedClueIdx === "number") {
        feedbackMap[i] = "wrong";
      }
    }
    setScore(correct);
    setFeedback(feedbackMap);
    setStatus("submitted");
    onResult && onResult(correct, pairs, assignments);
  };

  // Reveal: display correct answers, lock inputs
  const handleReveal = () => {
    setStatus("revealed");
    setFeedback({});
    setScore(0);
    onResult && onResult(0, pairs, assignments, true);
  };

  // Utility: Get clue chip text from clue idx (used to render assigned clues)
  function getClueText(clueIdx) {
    const cc = clues[clueIdx];
    // Show only character name (actor names omitted per requirements)
    return cc ? cc.text : "";
  }

  // Has all clues been assigned to posters?
  const allAssigned =
    Object.keys(assignments).length === options.length &&
    Object.values(assignments).every(v => typeof v === "number");

  if (loading)
    return (
      <div style={{ minHeight: 220, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading posters and clues...
      </div>
    );
  if (error)
    return (
      <div style={{ color: "var(--kavia-orange)" }}>{error}</div>
    );

  // --- UI Rendering ---
  return (
    <div style={{
      background: "var(--base-dark)",
      padding: 28,
      borderRadius: 15,
      boxShadow: "0 4px 18px rgba(50,20,60,0.13)",
      maxWidth: 740,
      margin: "0 auto"
    }}>
      <h2 className="subtitle" style={{ color: "var(--kavia-orange)", marginBottom: 20, textAlign: "center" }}>
        Drag the Character/Actor onto the Correct Movie Poster!
      </h2>
      <div style={{
        display: "flex",
        justifyContent: "center",
        marginBottom: 22,
        flexWrap: "wrap",
        gap: 12
      }}>
        {
          clues.map((clue, idx) => {
            // Omit if clue is already assigned (assigned to some poster)
            const isAssigned = Object.values(assignments).includes(idx);
            return !isAssigned && (
              <div
                key={idx}
                draggable={status === "playing"}
                onDragStart={() => dragClueStart(idx)}
                onDragEnd={dragClueEnd}
                style={{
                  background: dragging === idx ? "#13d4ff" : "var(--base-light)",
                  color: "#191743",
                  borderRadius: 19,
                  boxShadow: dragging === idx
                    ? "0 2px 12px #13d4ff44"
                    : "0 1px 8px rgba(0,0,0,0.10)",
                  padding: "9px 18px",
                  fontWeight: 600,
                  fontSize: 17,
                  cursor: status === "playing" ? "grab" : "not-allowed",
                  opacity: dragging === null || dragging === idx ? 1 : 0.83,
                  userSelect: "none"
                }}
              >
                {clue.text}
              </div>
            );
          })
        }
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{
          display: "flex",
          gap: 34,
          justifyContent: "center",
          flexWrap: "wrap",
          marginBottom: 22
        }}>
          {options.map((poster, idx) => {
            // Drag-over highlight coloring
            const isOver = false; // (not using lib, so can't highlight without extra state)
            const assignedClueIdx = assignments[idx];
            const isSubmitted = status === "submitted";
            let borderClr =
              status === "revealed"
                ? "#13d4ff"
                : isSubmitted && feedback[idx] === "correct"
                  ? "#32f095"
                  : isSubmitted && feedback[idx] === "wrong"
                    ? "#ec184c"
                    : isOver
                      ? "#f8ff3f"
                      : "var(--border-color)";
            let boxSdw =
              isSubmitted && feedback[idx] === "correct"
                ? "0 0 14px #4cff7e77"
                : isSubmitted && feedback[idx] === "wrong"
                  ? "0 0 20px #ea183199"
                  : "";

            return (
              <div
                key={idx}
                onDragOver={e => allowDrop(e, idx) ? e.preventDefault() : null}
                onDrop={e => allowDrop(e, idx) && status === "playing" ? handleDrop(e, idx) : null}
                tabIndex={0}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  background: "#191743",
                  borderRadius: 18,
                  border: `3.5px solid ${borderClr}`,
                  minWidth: 155,
                  minHeight: 242,
                  padding: "16px 8px 6px",
                  margin: "0 1vw",
                  boxShadow: boxSdw,
                  position: "relative"
                }}
              >
                <img
                  src={getPosterUrl(poster.poster_path, "w342")}
                  alt={poster.movieTitle}
                  style={{
                    width: 130,
                    height: 190,
                    objectFit: "cover",
                    borderRadius: 12,
                    marginBottom: 7,
                    background: "#e2e0ea"
                  }}
                />
                <div style={{
                  fontWeight: 700,
                  fontSize: 15,
                  color: "#ffe853",
                  textAlign: "center",
                  lineHeight: "1.2"
                }}>
                  {poster.movieTitle}
                </div>
                <div style={{
                  marginTop: 5,
                  minHeight: 38,
                  minWidth: 93,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  {/* Show assigned clue if set */}
                  {
                    typeof assignedClueIdx === "number"
                      ? (
                        <div
                          style={{
                            background: "#ffda31",
                            color: "#191743",
                            borderRadius: 11,
                            fontWeight: 600,
                            padding: "6px 14px",
                            margin: "0 7px",
                            fontSize: 16,
                            boxShadow: "0 1px 6px #ffda3133",
                            display: "flex",
                            alignItems: "center"
                          }}
                        >
                          {getClueText(assignedClueIdx)}
                          {status === "playing" &&
                            <button
                              type="button"
                              onClick={() => unassign(idx)}
                              style={{
                                border: "none",
                                background: "transparent",
                                color: "#e72828",
                                marginLeft: 7,
                                fontWeight: 700,
                                fontSize: 17,
                                cursor: "pointer"
                              }}
                              title="Undo assignment"
                            >×</button>
                          }
                        </div>
                      )
                      : (
                        status === "playing" &&
                        <span style={{ color: "#ffc", fontSize: 12, opacity: 0.86 }}>Drop a clue here</span>
                      )
                  }
                </div>
                {/* Show feedback tick/cross after submission */}
                {status === "submitted" && (feedback[idx] === "correct" || feedback[idx] === "wrong") && (
                  <div style={{
                    position: "absolute",
                    top: 7,
                    right: 10,
                    fontSize: 22,
                    fontWeight: 900,
                    color: feedback[idx] === "correct" ? "#57ff7a" : "#ec184c",
                    textShadow: "0 0 4px black"
                  }}>
                    {feedback[idx] === "correct" ? "✔" : "✗"}
                  </div>
                )}
                {/* Display correct answer if revealed */}
                {status === "revealed" && (
                  <div style={{
                    position: "absolute",
                    top: 7,
                    right: 10,
                    fontSize: 18,
                    color: "#ffe853",
                    fontWeight: 700,
                    textShadow: "0 0 6px #000"
                  }}>Ans</div>
                )}
              </div>
            );
          })}
        </div>
        {/* Control buttons and feedback UI */}
        {status === "playing" && (
          <div style={{ textAlign: "center", marginTop: 18 }}>
            <button
              type="submit"
              className="btn btn-large"
              style={{ minWidth: 135 }}
              disabled={!allAssigned}
            >
              Submit
            </button>
            <button
              className="btn"
              type="button"
              style={{ marginLeft: 18 }}
              onClick={handleReveal}
            >
              Reveal Answers
            </button>
            {!allAssigned && (
              <span style={{ marginLeft: 20, color: "#ffc97e", fontWeight: 500, fontSize: 14 }}>
                <em>Assign all clues to posters first!</em>
              </span>
            )}
          </div>
        )}
        {status === "submitted" && (
          <div style={{ textAlign: "center", marginTop: 26 }}>
            <div style={{
              color: "#77fb8d",
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: 1.2
            }}>
              Score: {score} / {pairs.length}
            </div>
            <button className="btn btn-large"
              type="button"
              style={{ marginTop: 12 }}
              onClick={handleReveal}
            >Reveal</button>
          </div>
        )}
        {status === "revealed" && (
          <div style={{ textAlign: "center", marginTop: 24, color: "var(--base-light)" }}>
            Correct answers are now displayed above. Try the next round!
          </div>
        )}
      </form>
    </div>
  );
}

export default CharacterMovieMatch;
