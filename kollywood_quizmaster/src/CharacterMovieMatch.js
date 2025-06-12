import React, { useEffect, useState } from "react";
import { fetchPopularKollywoodMovies, fetchMovieDetails } from "./tmdbApi";

// Helper for shuffling array
function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

// PUBLIC_INTERFACE
function CharacterMovieMatch({ onResult }) {
  /**
   * Character-Movie Match Game: Players drag/drop (manual assign here) character names to correct movies.
   * Shows clues, reveals, answer logic, progress.
   */
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [status, setStatus] = useState("playing"); // playing | submitted | revealed
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    async function loadQ() {
      setLoading(true);
      setError("");
      try {
        // Grab 3 movies with credits, each with "main" character
        const data = await fetchPopularKollywoodMovies(1);
        if (!data || !Array.isArray(data.results) || data.results.length < 3)
          throw new Error("TMDb didn't return enough Kollywood movies. Quota exhausted or data error.");
        let selected = shuffle(data.results.filter(m => m.id)).slice(0, 3);
        const details = await Promise.all(selected.map(x => fetchMovieDetails(x.id)));
        // Each: {character, movieTitle}
        const mapped = details.map(movie =>
          ({
            movieTitle: movie.title,
            char: movie.credits?.cast?.[0]?.character || movie.title[0] + " (Hero)",
            castName: movie.credits?.cast?.[0]?.name || "Hero",
          })
        );
        setPairs(mapped);
        setAnswers({});
        setStatus("playing");
      } catch (e) {
        setError(e.message || "Failed to load data. Please try again.");
      }
      setLoading(false);
    }
    loadQ();
    return () => (ignore = true);
  }, []);

  // For rendering randomized option lists
  const movieTitles = shuffle(pairs.map(p => p.movieTitle));
  const charNames = shuffle(pairs.map(p => `${p.char} (${p.castName})`));

  function handleChange(charIdx, val) {
    setAnswers(prev => ({ ...prev, [charIdx]: val }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setStatus("submitted");
    let score = 0;
    for (let i = 0; i < pairs.length; i++) {
      if (answers[i] === pairs[i].movieTitle) score += 1;
    }
    onResult && onResult(score, pairs, answers);
  }

  function handleReveal() {
    setStatus("revealed");
    onResult && onResult(0, pairs, null, true);
  }

  if (loading) return <div style={{ minHeight: 180 }}>Loading question...</div>;
  if (error) return <div style={{ color: "var(--kavia-orange)" }}>{error}</div>;

  return (
    <div style={{
      background: "var(--base-dark)", padding: 28, borderRadius: 12,
      boxShadow: "0 4px 14px rgba(50,20,60,0.11)", maxWidth: 520, margin: "0 auto"
    }}>
      <h2 className="subtitle" style={{ color: "var(--kavia-orange)", marginBottom: 14 }}>
        Match the Character to the Correct Movie!
      </h2>
      <form onSubmit={handleSubmit}>
        <table style={{ width: "100%", borderSpacing: 0, marginBottom: 10 }}>
          <thead>
            <tr style={{ color: "var(--base-light)", fontWeight: 600 }}>
              <td>Character (Actor)</td>
              <td>Movie</td>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p, idx) => (
              <tr key={idx}>
                <td style={{ padding: 4 }}>
                  {`${p.char} (${p.castName})`}
                </td>
                <td style={{ padding: 4 }}>
                  {status === "revealed"
                    ? <span style={{ color: "#19db57", fontWeight: 600 }}>{p.movieTitle}</span>
                    : (
                      <select
                        value={answers[idx] || ""}
                        onChange={e => handleChange(idx, e.target.value)}
                        required
                        style={{
                          padding: "6px 16px",
                          border: "1px solid var(--border-color)",
                          borderRadius: 6,
                          background: "#18182a",
                          color: "white"
                        }}
                        disabled={status !== "playing"}
                      >
                        <option value="" disabled>Pick movie</option>
                        {movieTitles.map((m, i) => (
                          <option key={i} value={m}>{m}</option>
                        ))}
                      </select>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {status === "playing" &&
          <div>
            <button className="btn btn-large" type="submit">Submit</button>
            <button className="btn" type="button" style={{ marginLeft: 12 }} onClick={handleReveal}>Reveal Answers</button>
          </div>
        }
        {status === "submitted" && (
          <div>
            <div style={{ color: "#72e665", marginTop: 14 }}>
              Your score: {Object.keys(answers).filter(i => answers[i] === pairs[i].movieTitle).length} / {pairs.length}
            </div>
            <button className="btn btn-large" type="button" onClick={handleReveal}>Reveal</button>
          </div>
        )}
        {status === "revealed" && (
          <div style={{ color: "var(--base-light)", marginTop: 12 }}>
            Correct answers are highlighted above!
          </div>
        )}
      </form>
    </div>
  )
}

export default CharacterMovieMatch;
