import React, { useEffect, useState } from "react";
import { fetchPopularKollywoodMovies, fetchMovieDetails } from "./tmdbApi";

// PUBLIC_INTERFACE
function CastCombo({ onResult }) {
  /**
   * Cast Combo: Guess movie by actor combo, or the odd-one-out (reverse).
   * Includes clues, reveal, results, and error/loading states.
   */
  const [combo, setCombo] = useState([]);
  const [answer, setAnswer] = useState("");
  const [mode, setMode] = useState("combo"); // or "oddone"
  const [status, setStatus] = useState("loading");
  const [options, setOptions] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [correct, setCorrect] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    async function loadQ() {
      setStatus("loading");
      setError("");
      setCombo([]);
      setAnswer("");
      setUserInput("");
      setCorrect(null);
      setOptions([]);
      // Randomly pick mode: normal or odd-one-out
      const chosenMode = Math.random() > 0.5 ? "combo" : "oddone";
      setMode(chosenMode);
      try {
        // For 'combo' mode: pick a movie, get 2-3 actor names, ask for movie.
        if (chosenMode === "combo") {
          let data = await fetchPopularKollywoodMovies(1 + Math.floor(Math.random() * 2));
          let mIdx = Math.floor(Math.random() * data.results.length);
          let m = data.results[mIdx];
          let det = await fetchMovieDetails(m.id);
          let c = (det.credits?.cast || []).slice(0, 3);
          if (c.length < 2) throw new Error("Could not get enough cast");
          let names = c.map(a => a.name);
          setCombo(names);
          setAnswer(det.title);
          setStatus("ready");
        } else {
          // For odd-one-out: show 3 actors, 2 in movie, 1 not; user picks the actor not in the movie.
          let data = await fetchPopularKollywoodMovies(1);
          let base = Math.floor(Math.random() * data.results.length);
          let baseMovie = await fetchMovieDetails(data.results[base].id);
          let cast = (baseMovie.credits?.cast || []).slice(0, 2);
          if (cast.length < 2) throw new Error("Not enough cast for odd-one-out");
          let allActors = [cast[0].name, cast[1].name];
          // Try get a real Tamil actor from another movie not in that cast
          let tries = 0, odd = "";
          while (tries < 10 && !odd) {
            let d = await fetchPopularKollywoodMovies(1 + Math.floor(Math.random() * 2));
            let mi = Math.floor(Math.random() * d.results.length);
            let m = await fetchMovieDetails(d.results[mi].id);
            let c = (m.credits?.cast ?? []);
            let alt = c.length > 0 ? c[0].name : "";
            if (alt && !allActors.includes(alt)) odd = alt;
            tries++;
          }
          let optionList = shuffle([allActors[0], allActors[1], odd]);
          setCombo(optionList);
          setAnswer(odd);
          setOptions({ movie: baseMovie.title, actors: allActors, all: optionList });
          setStatus("ready");
        }
      } catch (e) {
        setError("Failed to fetch CastCombo data");
        setStatus("error");
      }
    }
    loadQ();
    return () => (ignore = true);
    // We only trigger on mount, reload resets on each mode/rerender.
    // eslint-disable-next-line
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (mode === "combo") {
      if (userInput.trim().toLowerCase() === answer.toLowerCase()) {
        setCorrect(true);
        setStatus("answered");
        onResult && onResult(true, combo, answer);
      } else {
        setCorrect(false);
        setStatus("answered");
        onResult && onResult(false, combo, answer);
      }
    } else {
      if (userInput === answer) {
        setCorrect(true);
        setStatus("answered");
        onResult && onResult(true, options, answer);
      } else {
        setCorrect(false);
        setStatus("answered");
        onResult && onResult(false, options, answer);
      }
    }
  }

  function handleReveal() {
    setStatus("revealed");
    onResult && onResult(false, combo, answer, true);
  }

  if (status === "loading")
    return <div style={{ minHeight: 120 }}>Loading question...</div>;
  if (status === "error")
    return <div style={{ color: "var(--kavia-orange)" }}>{error}</div>;

  return (
    <div style={{
      background: "var(--base-dark)",
      padding: 24,
      borderRadius: 12,
      boxShadow: "0 2px 12px #00e8ea18",
      textAlign: "center",
      minWidth: 300,
      maxWidth: 420,
      margin: "auto"
    }}>
      {mode === "combo" ? (
        <>
          <h2 className="subtitle" style={{ color: "var(--base-light)" }}>
            Which Kollywood movie starred {combo.join(", ")} together?
          </h2>
          <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
            <input
              type="text"
              value={userInput}
              placeholder="Movie title"
              onChange={e => setUserInput(e.target.value)}
              style={{
                padding: "10px 12px",
                fontSize: 16,
                borderRadius: 4,
                border: "1.5px solid var(--border-color)",
                width: "80%",
                marginBottom: 8
              }}
              autoFocus
              disabled={status === "answered"}
            />
            <div>
              <button className="btn btn-large" type="submit" disabled={status === "answered"}>
                Submit
              </button>
              <button className="btn" type="button" style={{ marginLeft: 10 }} onClick={handleReveal}>
                Reveal Answer
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          <h2 className="subtitle" style={{ color: "var(--base-light)" }}>
            Odd One Out: <span style={{ color: "var(--kavia-orange)" }}>{options?.movie}</span>
          </h2>
          <div style={{ marginTop: 12, fontWeight: 600 }}>
            Which of these actors was <span style={{ color: "var(--kavia-orange)" }}>NOT</span> in <b>{options?.movie}</b>?
          </div>
          <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
            {combo.map((name, idx) => (
              <label key={idx} style={{ display: "block", marginBottom: 10 }}>
                <input type="radio" name="actor" value={name}
                  checked={userInput === name}
                  onChange={e => setUserInput(e.target.value)}
                  disabled={status === "answered"}
                  style={{ marginRight: 6 }}
                />
                {name}
              </label>
            ))}
            <button className="btn btn-large" type="submit" disabled={status === "answered" || !userInput}>
              Submit
            </button>
            <button className="btn" type="button" style={{ marginLeft: 10 }} onClick={handleReveal}>
              Reveal Answer
            </button>
          </form>
        </>
      )}
      {status === "answered" && (
        <div style={{ color: correct ? "#41e961" : "#ec184c", marginTop: 20 }}>
          {correct
            ? "🎉 Correct!"
            : "Oops! That's not right."}
          <div>
            <button className="btn" style={{ marginTop: 8 }} onClick={handleReveal}>Reveal</button>
          </div>
        </div>
      )}
      {status === "revealed" && (
        <div style={{ color: "#ffe853", marginTop: 14 }}>
          Answer: <b>{answer}</b>
        </div>
      )}
    </div>
  );
}

function shuffle(arr) {
  return arr ? arr.slice().sort(() => Math.random() - 0.5) : [];
}

export default CastCombo;
