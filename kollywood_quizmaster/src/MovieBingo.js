import React, { useEffect, useState } from "react";
import { fetchPopularKollywoodMovies, fetchMovieDetails } from "./tmdbApi";

/*
 * MovieBingo with per-session unique bingo categories:
 * - Tracks a pool of unused categories in React state for the lifetime of the session.
 * - Each round draws a unique, non-repeating category from this pool.
 * - Used categories are removed from the pool.
 * - Once exhausted, (very rare in 10-round games) the pool is reset/shuffled, but within each game, categories do NOT repeat.
 */

const bingoCategoriesMaster = [
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

// PUBLIC_INTERFACE
// Fisher-Yates shuffle for unbiased order
function shuffle(arr) {
  if (!Array.isArray(arr)) return [];
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function MovieBingo({ onResult, availableCategories, setAvailableCategories }) {
  /**
   * Movie Bingo: 3x3 grid where only one matches the challenge category.
   * Each question uses a unique category, with the available pool managed at session level.
   */
  const [movies, setMovies] = useState([]); // [{id, title}]
  const [category, setCategory] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | locked | revealed | error
  const [error, setError] = useState("");
  const [correctIdx, setCorrectIdx] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [gridDisabled, setGridDisabled] = useState(false);

  useEffect(() => {
    // Defensive: never mutate prop arrays
    if (!availableCategories || availableCategories.length === 0) {
      // If no available categories, reinit pool (necessary if 10+ rounds, rare)
      setAvailableCategories(shuffle([...bingoCategoriesMaster]));
      return;
    }
    // On each round, pick a random available category (unique for session).
    const rndIdx = Math.floor(Math.random() * availableCategories.length);
    const chosenCat = availableCategories[rndIdx];
    setCategory(chosenCat);

    let ignore = false;
    async function loadGrid() {
      setStatus("loading");
      setError("");
      setMovies([]);
      setSelectedIdx(null);
      setIsCorrect(null);
      setGridDisabled(false);
      setCorrectIdx(null);

      // Remove the chosen category from available categories (avoid repeats).
      setAvailableCategories(prev => prev.filter((x, i) => i !== rndIdx));

      // ===== GRID LOADING CODE remains unchanged =====
      let found = [];
      let correctMovie = null;
      let page = 1;
      try {
        // --- 1. Find at least 1 movie that matches the category ---
        let correctOptions = [];
        while (correctOptions.length < 1 && page < 7) {
          const d = await fetchPopularKollywoodMovies(page++);
          if (!d || !Array.isArray(d.results)) throw new Error("TMDb/network error while loading movies for Bingo.");
          for (const m of d.results) {
            let match = false;
            if (chosenCat.genreId && m.genre_ids.includes(chosenCat.genreId)) match = true;
            else if (chosenCat.yearFrom && m.release_date && parseInt(m.release_date.slice(0, 4), 10) >= chosenCat.yearFrom) match = true;
            else if (chosenCat.minVotes && m.vote_count > chosenCat.minVotes) match = true;
            else if (chosenCat.minRating && m.vote_average > chosenCat.minRating) match = true;
            else if (chosenCat.director) {
              let det;
              try {
                det = await fetchMovieDetails(m.id);
              } catch (err) { continue; }
              if (
                det.credits && det.credits.crew 
                && det.credits.crew.some(
                  c => c.job === "Director" && c.name.toLowerCase() === chosenCat.director.toLowerCase()
                )
              ) match = true;
            }
            else if (chosenCat.isAwardWinner) {
              // No TMDb for this, so mock: high vote_average & count
              if (m.vote_count > 150 && m.vote_average > 7.2) match = true;
            }
            if (match) correctOptions.push(m);
            if (correctOptions.length >= 1) break;
          }
        }
        if (correctOptions.length === 0) throw new Error("No valid movie found for Bingo category. Quota/data issue.");
        correctMovie = correctOptions[0];
        // --- 2. Find additional grid movies (distractors) ---
        found = [correctMovie];
        page = 1;
        let skipIds = new Set([correctMovie.id]);
        while (found.length < 9 && page < 10) {
          const d = await fetchPopularKollywoodMovies(page++);
          if (!d || !Array.isArray(d.results)) throw new Error("TMDb/network error while loading grid movies.");
          for (const m of d.results) {
            if (found.length >= 9) break;
            if (!m.id || skipIds.has(m.id)) continue;
            // Filter: do NOT add movies that match the category!
            let match = false;
            if (chosenCat.genreId && m.genre_ids.includes(chosenCat.genreId)) match = true;
            else if (chosenCat.yearFrom && m.release_date && parseInt(m.release_date.slice(0, 4), 10) >= chosenCat.yearFrom) match = true;
            else if (chosenCat.minVotes && m.vote_count > chosenCat.minVotes) match = true;
            else if (chosenCat.minRating && m.vote_average > chosenCat.minRating) match = true;
            else if (chosenCat.director) {
              let det;
              try {
                det = await fetchMovieDetails(m.id);
              } catch (err) { continue; }
              if (
                det.credits && det.credits.crew 
                && det.credits.crew.some(
                  c => c.job === "Director" && c.name.toLowerCase() === chosenCat.director.toLowerCase()
                )
              ) match = true;
            }
            else if (chosenCat.isAwardWinner) {
              if (m.vote_count > 150 && m.vote_average > 7.2) match = true;
            }
            if (match) continue; // Only one correct in grid!
            found.push(m);
            skipIds.add(m.id);
            if (found.length >= 9) break;
          }
        }
        if (found.length < 9) throw new Error("Not enough grid movies for Bingo category. Try again!");
        found = shuffle(found);
        // Ensure correct still in grid
        let correctIdxFinal = found.findIndex(m => m.id === correctMovie.id);
        if (correctIdxFinal === -1) {
          found[0] = correctMovie;
          correctIdxFinal = 0;
        }
        setMovies(found.map(m => ({ id: m.id, title: m.title })));
        setCorrectIdx(correctIdxFinal);
        setStatus("ready");
      } catch (e) {
        setError(typeof e === "string" ? e : (e && e.message) || "Failed to load movie data for Bingo grid.");
        setStatus("error");
      }
    }
    loadGrid();
    return () => { ignore = true; };
    // Only run on availableCategories prop change (i.e., new round)
  }, [availableCategories, setAvailableCategories]);

  // PUBLIC_INTERFACE
  function selectCell(idx) {
    if (status !== "ready") return;
    if (gridDisabled) return;
    if (selectedIdx !== null) return; // Already selected one
    setGridDisabled(true);

    // Defensive: ensure idx in [0,8] and one remains correct
    if (idx == null || idx < 0 || idx >= movies.length) {
      // Robust handling: If an invalid grid cell is selected, ignore.
      setGridDisabled(false);
      return;
    }

    setSelectedIdx(idx);

    const isWin = idx === correctIdx;
    setIsCorrect(isWin);
    setStatus("locked");

    // Give immediate feedback and send result
    setTimeout(() => {
      onResult && onResult(isWin, category, movies, { selected: idx, correct: correctIdx });
    }, 200); // Brief delay for color feedback if needed visually
  }

  // PUBLIC_INTERFACE
  function handleReveal() {
    setStatus("revealed");
    setGridDisabled(true);
    setTimeout(() => {
      onResult && onResult(true, category, movies, { selected: selectedIdx, correct: correctIdx }, true);
    }, 50);
  }

  // PUBLIC_INTERFACE
  function resetGrid() {
    // For replay. Not used in 1-round game but useful for test hooks.
    setSelectedIdx(null);
    setIsCorrect(null);
    setStatus("ready");
    setGridDisabled(false);
  }

  // --- UI ---
  if (status === "loading")
    return <div style={{ minHeight: 150 }}>Loading Movie Bingo grid...</div>;
  if (status === "error")
    return <div style={{ color: "var(--kavia-orange)" }}>{error}</div>;

  return (
    <div
      style={{
        background: "var(--base-dark)",
        borderRadius: 10,
        boxShadow: "0 3px 12px rgba(0,0,0,0.11)",
        padding: 24,
        maxWidth: 480,
        margin: "auto"
      }}
    >
      <h2 className="subtitle" style={{ color: "var(--base-light)" }}>
        Bingo Category: <span style={{ fontWeight: 600 }}>{category?.label}</span>
      </h2>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12,
        margin: "18px 0",
        minHeight: 180
      }}>
        {movies.map((m, idx) => {
          // Cell coloring: Feedback after selection ("locked") or reveal
          let bg = "rgba(255,255,255,0.07)",
              color = "#fff",
              border = "1.5px solid var(--border-color)", 
              cursor = status === "ready" && !gridDisabled && selectedIdx === null ? "pointer" : "default",
              boxShadow = "";

          if (status === "locked" || status === "revealed") {
            if (selectedIdx === idx) {
              if (idx === correctIdx) {
                bg = "#32f095"; // green
                color = "#171e10";
                border = "2.5px solid #82ff54";
                boxShadow = "0 2px 10px #19fc626c";
              } else {
                bg = "#ec184c"; // red
                color = "#fff";
                border = "2.5px solid #ee25a4";
                boxShadow = "0 2px 8px #ee256066";
              }
            } else if (status === "revealed" && idx === correctIdx) {
              bg = "#32f095";
              color = "#171f11";
              border = "2.5px solid #82ff54";
              boxShadow = "0 2px 10px #19fc626c";
            }
          } else if (selectedIdx === idx) {
            // Lights up while clicking, before having determined right/wrong
            bg = "var(--base-light)";
            color = "#171f20";
            border = "2px solid #ddd";
            boxShadow = "0 2px 8px #41eee9aa";
          }

          // If grid is disabled, or user already chose one, block all clicks
          let disabled = gridDisabled || (selectedIdx !== null && selectedIdx !== idx);

          return (
            <div
              key={idx}
              tabIndex={0}
              aria-disabled={disabled}
              onClick={() => (disabled ? undefined : selectCell(idx))}
              style={{
                padding: "18px 4px",
                background: bg,
                color: color,
                fontWeight: 600,
                cursor: cursor,
                borderRadius: 7,
                border: border,
                boxShadow: boxShadow,
                fontSize: 16,
                transition: "all 0.18s",
                outline: selectedIdx === idx ? "2px solid #ffe791" : "none",
                pointerEvents: disabled ? "none" : "auto",
                position: "relative",
                userSelect: "none",
                minHeight: 35
              }}
              title={disabled && selectedIdx !== null ? "You may only select one answer for this question." : m.title}
              data-testid={"bingo-cell-" + idx}
            >
              {m.title}
              {(status === "locked" || status === "revealed") && idx === correctIdx && (
                <span style={{
                  position: "absolute",
                  right: 7,
                  top: 7,
                  fontSize: 17,
                  fontWeight: 900,
                  color: "#5be85e"
                }}>✔</span>
              )}
              {(status === "locked" || status === "revealed") && selectedIdx === idx && idx !== correctIdx && (
                <span style={{
                  position: "absolute",
                  right: 7,
                  top: 7,
                  fontSize: 17,
                  fontWeight: 900,
                  color: "#ea2525"
                }}>✗</span>
              )}
            </div>
          );
        })}
      </div>
      <div>
        {status === "ready" && (
          <div style={{ color: "#eee", fontSize: 15, marginTop: 10 }}>
            Select <b>one</b> movie you think fits the category above.
          </div>
        )}
        {status === "locked" && (
          <div style={{
            color: isCorrect ? "#32f095" : "#fd3c77",
            fontWeight: 600,
            marginTop: 14,
            fontSize: 17
          }}>
            {isCorrect ? "🎉 Correct! The chosen movie fits the category." : "Oops! That's not correct for this category."}
            <br />
            <button className="btn" style={{ marginTop: 10 }} onClick={handleReveal}>Reveal Correct</button>
          </div>
        )}
        {status === "revealed" && (
          <div style={{
            marginTop: 18,
            background: "#191947",
            borderRadius: 8,
            padding: "10px 15px",
            color: "#eedd2d",
            fontSize: 16
          }}>
            The correct answer is highlighted in <span style={{ color: "#60fb87", fontWeight: 600 }}>green</span>.
          </div>
        )}
      </div>
    </div>
  );
}

export default MovieBingo;
