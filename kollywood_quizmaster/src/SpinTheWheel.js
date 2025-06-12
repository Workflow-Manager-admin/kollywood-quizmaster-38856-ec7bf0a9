import React, { useEffect, useState } from "react";
import { fetchPopularKollywoodMovies, fetchMovieDetails } from "./tmdbApi";

// PUBLIC_INTERFACE
function SpinTheWheel({ onResult }) {
  /**
   * Spin the Wheel: Player gets a random actor/actress + year clue, must pick correct movie among 3.
   */
  const [choices, setChoices] = useState([]);
  const [correctIdx, setCorrectIdx] = useState(null);
  const [wheel, setWheel] = useState({ spin: false, actor: "", year: "" });
  const [status, setStatus] = useState("loading"); // loading|spun|answered|revealed
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    async function makeQ() {
      setStatus("loading");
      setError("");
      setWheel({ spin: false, actor: "", year: "" });
      try {
        // Choose 3 distinct movies with cast
        let page = Math.floor(Math.random() * 2) + 1;
        let data = await fetchPopularKollywoodMovies(page);
        let picks = [];
        let seen = new Set();
        let tries = 0;
        for (let i = 0; picks.length < 3 && tries < 20; i++) {
          let m = data.results[Math.floor(Math.random() * data.results.length)];
          if (!m || !m.id || seen.has(m.id)) {
            tries++; continue;
          }
          let det = await fetchMovieDetails(m.id);
          if (!det.title || !det.credits?.cast?.[0]) {
            tries++; continue;
          }
          picks.push(det);
          seen.add(m.id);
        }
        if (picks.length < 3) throw new Error("Could not get valid movie options");
        // Pick correct, and extract actor/year from it
        const idx = Math.floor(Math.random() * 3);
        const correct = picks[idx];
        const actor = correct.credits.cast[0].name;
        const year = correct.release_date?.slice(0, 4);
        setCorrectIdx(idx);
        setChoices(picks.map(m => m.title));
        setWheel({ spin: false, actor, year });
        setStatus("spun");
      } catch (e) {
        setError("Failed to fetch Spin the Wheel question");
        setStatus("error");
      }
    }
    makeQ();
    return () => (ignore = true);
  }, []);

  function handleSpin() {
    setWheel(w => ({ ...w, spin: true }));
    // simulate spin delay
    setTimeout(() => setWheel(w => ({ ...w, spin: false })), 800);
  }

  function handleSelect(i) {
    setSelected(i);
    setStatus("answered");
    onResult && onResult(i === correctIdx, choices, correctIdx);
  }

  function handleReveal() {
    setStatus("revealed");
    onResult && onResult(false, choices, correctIdx, true);
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
      boxShadow: "0 2px 16px #20fcfc23",
      textAlign: "center",
      minWidth: 300,
      maxWidth: 420,
      margin: "auto"
    }}>
      <h2 className="subtitle" style={{ color: "var(--base-light)" }}>
        Guess the Movie!
      </h2>
      <div style={{ marginTop: 10, marginBottom: 22 }}>
        <div style={{
          fontWeight: 600,
          fontSize: 17,
          padding: "16px 12px",
          borderRadius: "50%",
          border: "4px dotted var(--base-light)",
          width: 120,
          height: 120,
          margin: "auto",
          background: wheel.spin ? "var(--base-light)" : "#000",
          color: wheel.spin ? "#222" : "#fff",
          lineHeight: "34px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: wheel.spin ? "0 0 40px var(--base-light)" : "",
          transition: "all 0.45s"
        }}>
          <div>🎡</div>
          {wheel.spin ? <div style={{ fontSize: 13 }}>Spinning...</div> : (
            <>
              <span style={{ fontSize: 14, color: "var(--kavia-orange)" }}>Clues:</span>
              <div>Actor/Actress:<br /><b>{wheel.actor}</b></div>
              <div>Year:<br /><b>{wheel.year}</b></div>
            </>
          )}
        </div>
        <button
          className="btn btn-large"
          style={{ marginTop: 12 }}
          onClick={handleSpin}
          disabled={wheel.spin || !!selected || status === "revealed" || status === "answered"}
        >
          Spin
        </button>
      </div>
      <div>
        <h3 style={{ margin: "14px 0 10px", fontSize: 17, color: "var(--base-light)" }}>Which movie is it?</h3>
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 12
        }}>
          {choices.map((title, idx) => (
            <button
              key={idx}
              className="btn"
              style={{
                background: selected === idx && idx === correctIdx
                  ? "#32f095"
                  : selected === idx
                    ? "#ec184c"
                    : "var(--base-light)",
                color: selected === idx ? "#000" : "#fff",
                border: selected === idx ? "2px solid #eee" : "",
                outline: "none",
                fontWeight: 600,
                fontSize: "1rem",
                opacity: status === "revealed" && idx !== correctIdx ? 0.6 : 1,
                cursor: selected === null && status === "spun" ? "pointer" : "not-allowed"
              }}
              disabled={!!selected || status !== "spun"}
              onClick={() => handleSelect(idx)}
            >
              {title}
            </button>
          ))}
        </div>
      </div>
      {(status === "answered" || status === "revealed") && (
        <div style={{ marginTop: 16, color: selected === correctIdx ? "#44ef82" : "#ec184c" }}>
          {status === "answered"
            ? selected === correctIdx
              ? "🎉 Correct!"
              : "Wrong. Try next time!"
            : <span>Answer: <b>{choices[correctIdx]}</b></span>
          }
          <div>
            <button className="btn" style={{ marginTop: 9 }} onClick={handleReveal}>Reveal</button>
          </div>
        </div>
      )}
      {status === "revealed" && (
        <div style={{ color: "#ffe853", marginTop: 10 }}>The right answer is <b>{choices[correctIdx]}</b>!</div>
      )}
    </div>
  );
}

export default SpinTheWheel;
