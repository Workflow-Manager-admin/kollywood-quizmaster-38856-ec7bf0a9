import React, { useState, useEffect } from "react";
import {
  fetchPopularKollywoodMovies,
  fetchMovieDetails,
  getPosterUrl,
} from "./tmdbApi";

// PUBLIC_INTERFACE
function BlurredPosterQuiz({ onResult }) {
  /**
   * Blurred Poster Quiz Game: Guess movie from blurred poster, get clues, can reveal, handle loading/error/UI.
   */
  const [movie, setMovie] = useState(null);
  const [answer, setAnswer] = useState("");
  const [userInput, setUserInput] = useState("");
  const [status, setStatus] = useState("loading"); // loading | ready | error | revealed | correct | wrong
  const [clueIndex, setClueIndex] = useState(0); // For 2 clues: 0=none, 1=1 clue, 2=2 clues
  const [error, setError] = useState("");
  const [score, setScore] = useState(null);

  useEffect(() => {
    let ignore = false;
    async function loadRandomMovie() {
      setStatus("loading");
      setError("");
      setMovie(null);

      try {
        // Fetch first 3 pages, then pick a random movie from the array (robust to edge cases)
        const randomPage = Math.floor(Math.random() * 3) + 1;
        const data = await fetchPopularKollywoodMovies(randomPage);
        if (!data || !Array.isArray(data.results) || data.results.length === 0) {
          throw new Error("No Kollywood movies were found for this round (TMDb). Try again later!");
        }
        let idx = Math.floor(Math.random() * data.results.length);
        let m = data.results[idx];
        // Must have poster
        let tries = 0;
        while (
          (tries < 8) &&
          (!m || !m.poster_path || m.poster_path === null)
        ) {
          idx = Math.floor(Math.random() * data.results.length);
          m = data.results[idx];
          tries++;
        }
        if (!m || !m.poster_path) {
          throw new Error("No suitable Kollywood movie poster found. Please try refresh.");
        }
        // Fetch details for clues
        let details;
        try {
          details = await fetchMovieDetails(m.id);
        } catch (e) {
          throw new Error(e.message || "Could not fetch details for this movie. Try refresh.");
        }
        if (!ignore) {
          setMovie({ ...m, ...details });
          setAnswer(details.title);
          setStatus("ready");
        }
      } catch (e) {
        setError(typeof e === "string" ? e : (e.message || "Failed to load movie. Try refresh."));
        setStatus("error");
      }
    }
    loadRandomMovie();
    return () => (ignore = true);
  }, []);

  function getClueText(movie, index) {
    if (!movie) return "";
    // 2 clues: 1) release year, 2) main actor
    if (index === 1) {
      return `Clue 1: The movie released in ${movie.release_date?.slice(0, 4)}.`;
    }
    if (index === 2 && movie.credits?.cast?.length > 0) {
      const top = movie.credits.cast.slice(0, 3).map((c) => c.name).join(", ");
      return `Clue 2: Top cast includes: ${top}`;
    }
    return "";
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!userInput.trim()) return;
    if (
      userInput.trim().toLowerCase() === answer.trim().toLowerCase() ||
      userInput.trim().toLowerCase() === movie.original_title?.toLowerCase()
    ) {
      setStatus("correct");
      setScore(1);
      onResult && onResult(true, movie);
    } else {
      setStatus("wrong");
      setScore(0);
      onResult && onResult(false, movie);
    }
  }

  function handleReveal() {
    setStatus("revealed");
    setScore(0);
    onResult && onResult(false, movie, true);
  }

  if (status === "loading")
    return (
      <div style={{ minHeight: 380, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span>Loading question...</span>
      </div>
    );
  if (status === "error") return <div style={{ color: "#E87A41" }}>{error}</div>;

  return (
    <div style={{
      background: "var(--base-dark)",
      padding: "32px",
      borderRadius: 12,
      boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
      textAlign: "center"
    }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ position: "relative", width: 240, margin: "auto" }}>
          {movie?.poster_path && (
            <img
              alt="Blurred Kollywood Poster"
              src={getPosterUrl(movie.poster_path)}
              style={{
                width: "100%", borderRadius: 12,
                filter: status === "revealed" || status === "correct" ? "none" : "blur(14px)"
              }}
            />
          )}
          {!movie?.poster_path && <span>No poster image available.</span>}
        </div>
      </div>
      <div style={{ marginBottom: 8, minHeight: 20 }}>
        {clueIndex === 0 && <button className="btn" onClick={() => setClueIndex(1)}>Show Clue 1</button>}
        {clueIndex > 0 && <div className="subtitle" style={{ color: "var(--base-light)", marginBottom: 6 }}>{getClueText(movie, 1)}</div>}
        {clueIndex === 1 && <button className="btn" onClick={() => setClueIndex(2)}>Show Clue 2</button>}
        {clueIndex === 2 && <div className="subtitle" style={{ color: "var(--base-light)" }}>{getClueText(movie, 2)}</div>}
      </div>
      {(status === "ready" || status === "wrong") && (
        <form onSubmit={handleSubmit} style={{ marginTop: 18 }}>
          <input
            type="text"
            placeholder="Enter movie title"
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            style={{
              padding: "10px 12px", fontSize: 16,
              borderRadius: 4, border: "1px solid var(--border-color)",
              width: "80%",
              marginBottom: 9,
              outline: "none"
            }}
            autoFocus
          />
          <div>
            <button className="btn btn-large" type="submit" style={{ minWidth: 100 }}>Submit</button>
            <button type="button" className="btn" style={{ marginLeft: 10 }} onClick={handleReveal}>
              Reveal Answer
            </button>
          </div>
          {status === "wrong" && <div style={{ color: "#E87A41", marginTop: 10 }}>Incorrect. Try again or reveal!</div>}
        </form>
      )}
      {status === "correct" && (
        <div style={{ marginTop: 20, color: "#43e441", fontWeight: 600 }}>
          🎉 Correct! The movie is <b>{answer}</b>
        </div>
      )}
      {status === "revealed" && (
        <div style={{ marginTop: 20, color: "var(--kavia-orange)" }}>
          Answer: <b>{answer}</b>
        </div>
      )}
      <div className="description" style={{ fontSize: 15, marginTop: 16, color: "var(--text-secondary)" }}>
        {movie?.overview}
      </div>
    </div>
  );
}

export default BlurredPosterQuiz;
