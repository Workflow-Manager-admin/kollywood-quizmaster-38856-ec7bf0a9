import React, { useEffect, useState } from "react";
import { fetchPopularKollywoodMovies, fetchMovieDetails } from "./tmdbApi";

// Demo list of categories mapped to TMDb values (replace/expand as needed)
const bingoCategories = [
  { label: "A Comedy", genreId: 35 },
  { label: "A Blockbuster", minVotes: 500 },
  { label: "Released After 2015", yearFrom: 2015 },
  { label: "National Award Winner", isAwardWinner: true }, // Will mock this
  { label: "Family Film", genreId: 10751 },
  { label: "High User Rating", minRating: 7.5 },
  { label: "Action Movie", genreId: 28 },
  { label: "By a Famous Director", director: "Mani Ratnam" },
  { label: "Romantic", genreId: 10749 },
];

// Helper
function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

// PUBLIC_INTERFACE
function MovieBingo({ onResult }) {
  /**
   * Movie Bingo: 3x3 grid of movie titles, click to mark movies that fit category clue. Reveal, show answers, results.
   */
  const [category, setCategory] = useState(null);
  const [movies, setMovies] = useState([]);
  const [selected, setSelected] = useState({});
  const [status, setStatus] = useState("loading"); // loading | ready | submitted | revealed
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    async function loadGrid() {
      setStatus("loading");
      setError("");
      setSelected({});
      setMovies([]);
      // pick a random bingo category
      const chosenCat = shuffle(bingoCategories)[0];
      setCategory(chosenCat);
      // detemine filter logic
      let found = [];
      let page = 1;
      try {
        // Keep trying next page until we have 9 movies
        while (found.length < 9 && page < 7) {
          const d = await fetchPopularKollywoodMovies(page++);
          for (const m of d.results) {
            if (found.length >= 9) break;
            // filter by category property
            let match = false;
            if (chosenCat.genreId && m.genre_ids.includes(chosenCat.genreId))
              match = true;
            else if (
              chosenCat.yearFrom &&
              m.release_date &&
              parseInt(m.release_date.slice(0, 4), 10) >= chosenCat.yearFrom
            )
              match = true;
            else if (chosenCat.minVotes && m.vote_count > chosenCat.minVotes)
              match = true;
            else if (chosenCat.minRating && m.vote_average > chosenCat.minRating)
              match = true;
            else if (chosenCat.director) {
              // fetch details and check director
              let det = await fetchMovieDetails(m.id);
              if (
                det.credits &&
                det.credits.crew &&
                det.credits.crew.find(
                  c =>
                    c.job === "Director" &&
                    c.name.toLowerCase() === chosenCat.director.toLowerCase()
                )
              )
                match = true;
            } else if (chosenCat.isAwardWinner) {
              // TMDb API doesn't provide this directly; mock using high vote_average
              if (m.vote_count > 150 && m.vote_average > 7.2) match = true;
            }
            if (match) found.push({ id: m.id, title: m.title });
          }
        }
        found = shuffle(found.slice(0, 9));
        setMovies(found);
        setStatus("ready");
      } catch (e) {
        setError("Failed to load movie data for Bingo grid. " + e.message);
        setStatus("error");
      }
    }
    loadGrid();
    return () => (ignore = true);
  }, []);

  function toggle(idx) {
    if (status !== "ready") return;
    setSelected(prev => ({ ...prev, [idx]: !prev[idx] }));
  }

  function handleSubmit() {
    setStatus("submitted");
    // 'Correct' if user marks any movie that fits category (here, all do)
    onResult && onResult(Object.keys(selected).filter(k => selected[k]).length, category, movies, selected);
  }
  function handleReveal() {
    setStatus("revealed");
    onResult && onResult(movies.length, category, movies, null, true);
  }

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
        {movies.map((m, idx) => (
          <div
            key={idx}
            onClick={() => toggle(idx)}
            style={{
              padding: "18px 4px",
              background: selected[idx]
                ? "var(--base-light)"
                : "rgba(255,255,255,0.07)",
              color: selected[idx] ? "#000" : "#fff",
              fontWeight: 600,
              cursor: status === "ready" ? "pointer" : "default",
              borderRadius: 7,
              border: selected[idx]
                ? "2px solid gold"
                : "1.5px solid var(--border-color)",
              boxShadow: selected[idx] ? "0 2px 8px #f7c43e55" : "",
              fontSize: 16,
              transition: "all 0.2s"
            }}
          >
            {m.title}
          </div>
        ))}
      </div>
      <div>
        {status === "ready" && (
          <>
            <button className="btn btn-large" onClick={handleSubmit}>
              Submit
            </button>{" "}
            <button className="btn" onClick={handleReveal}>Reveal All</button>
          </>
        )}
        {status === "submitted" && (
          <div style={{ marginTop: 18, color: "#5cfcad" }}>
            You marked <b>{Object.keys(selected).filter(i => selected[i]).length}</b> movies!
            <br />
            <button className="btn" style={{ marginTop: 10 }} onClick={handleReveal}>Reveal Correct</button>
          </div>
        )}
        {status === "revealed" && (
          <div style={{ marginTop: 18, color: "#eedd2d" }}>
            All movies in grid fit this bingo! Grid movies are <b>all valid answers</b>.
          </div>
        )}
      </div>
    </div>
  );
}

export default MovieBingo;
