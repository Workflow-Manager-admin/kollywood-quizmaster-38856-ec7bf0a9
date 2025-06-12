import React, { useEffect, useState, useRef } from "react";
import { discoverTamilMovies, getMovieDetails, getMovieCast } from "../tmdb";
import { useNavigate } from "react-router-dom";
import QuizProgressBar from "./QuizProgressBar";

/**
 * Game: Spin the Wheel - visually animated spinning wheel, fetches a Kollywood actor, actress, and year.
 * After spinning, player is prompted to guess the movie from 3 real options (1 correct + 2 distractors).
 * All clues/options are based on actual TMDb Kollywood data. Animation is smooth. One round per spin.
 */
// PUBLIC_INTERFACE
function SpinTheWheel() {
  const TOTAL = 10;
  const [questions, setQuestions] = useState([]);
  const [step, setStep] = useState(0);

  // For current round:
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [showWheel, setShowWheel] = useState(true);
  const [spinResult, setSpinResult] = useState(null); // {actor, actress, year, movie}
  const [movieOptions, setMovieOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reveal, setReveal] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  // Fetch Tamil movies once at mount for building dataset
  useEffect(() => {
    setLoading(true);
    discoverTamilMovies({ sort_by: "popularity.desc", page: 3 }).then(movies => {
      // Filter valid entries (need poster or cast, avoid broken data)
      const filtered = movies.filter(m =>
        m &&
        m.id &&
        m.title &&
        m.release_date &&
        typeof m.title === "string" &&
        typeof m.release_date === "string" &&
        m.release_date.length >= 4
      );
      setQuestions(filtered.slice(0, TOTAL * 3)); // room for distractor pool
      setLoading(false);
    }).catch(() => {
      setError("Failed to load TMDb movies. Please refresh.");
      setLoading(false);
    });
  }, []);

  // Triggered WHEN user spins (user clicks SPIN) —
  // Randomly pick a movie, fetch cast (actor+actress), and set clues.
  async function handleSpin() {
    if (isSpinning || loading) return;
    setSelected(null);
    setReveal(false);
    setShowWheel(true);
    setSpinResult(null);

    // Animate: 5s spin, ease out (randomized total angle per round)
    const segments = 8; // Wheel divided for visual effect only
    const anglePerSegment = 360 / segments;
    // We'll "land" on a random segment to indicate visually, but clues are random.
    const finalSegment = Math.floor(Math.random() * segments);
    const extraSpins = 6; // Number of full 360s before stopping
    const finalAngle = 360 * extraSpins + finalSegment * anglePerSegment + (anglePerSegment/2);
    setIsSpinning(true);

    let current = wheelAngle;
    let startTs = null;

    // Animate the wheel: ease out cubic
    function animate(ts) {
      if (!startTs) startTs = ts;
      const duration = 2200; // ms
      const elapsed = ts - startTs;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out
      const easeOut = (t) => --t * t * t + 1;
      const easedProgress = easeOut(progress);
      const angle = current + (finalAngle - current) * easedProgress;
      setWheelAngle(angle % 360);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setWheelAngle(finalAngle % 360);
        setTimeout(() => setIsSpinning(false), 200); // minor post-spin delay
        handlePickClues();
      }
    }
    requestAnimationFrame(animate);
  }

  // Once wheel is "spun", pick actor/actress/year clues and movie pool
  async function handlePickClues() {
    // Wait just after wheel stops for effect
    setTimeout(async () => {
      // For each round/step, use a dedicated subset for correct/distractors
      const qIdx = (step * 2) % Math.max(questions.length, 1);
      let baseMovie = questions[qIdx];
      // Try another if TMDb returns junk/empty
      for (let off=0; off<4; ++off) {
        if (!baseMovie) baseMovie = questions[(qIdx+off)%questions.length];
        if (baseMovie && baseMovie.id) break;
      }
      if (!baseMovie || !baseMovie.id) {
        setError("Could not find a valid movie from TMDb.");
        setShowWheel(false);
        return;
      }
      // Fetch cast and movie details to pick clues and options
      let cast, details;
      try {
        [cast, details] = await Promise.all([
          getMovieCast(baseMovie.id),
          getMovieDetails(baseMovie.id)
        ]);
      } catch {
        setError("Could not fetch movie/cast details from TMDb.");
        setShowWheel(false);
        return;
      }

      // Get main actor (male), actress (female) for clues. Some movies may not have both!
      let actor = "", actress = "";

      if (Array.isArray(cast)) {
        // Try to get a male actor
        const mActor = cast.find(c => c.known_for_department === "Acting" && c.gender === 2 && c.name);
        actor = mActor?.name || "";
        // Try to get a female actress
        const fActress = cast.find(c => c.known_for_department === "Acting" && c.gender === 1 && c.name);
        actress = fActress?.name || "";
        // fallback
        if (!actor && cast.length) actor = cast[0].name;
        if (!actress) {
          // Try second female if available
          const alt = cast.find(c => c.gender === 1 || (c.gender === 0 && c.name && c.name !== actor));
          actress = alt?.name || "Clue unavailable";
        }
        if (!actor) actor = "Clue unavailable";
      } else {
        actor = "Clue unavailable";
        actress = "Clue unavailable";
      }
      // Use year as short clue
      const year = baseMovie.release_date ? baseMovie.release_date.slice(0, 4) : "?";

      // Pick distractor movies: exclude the correct one, pick 2, options shuffled
      let optionMovies = [baseMovie];
      let distractors = [];
      // Pool from questions, exclude already used ID
      let rest = questions.filter(m => m && m.id !== baseMovie.id && m.title);
      // Prefer same-decade (for realism); fallback to any
      const sameDecade = rest.filter(m => m.release_date && m.release_date.slice(0,3) === year.slice(0,3));
      const distractorPool = sameDecade.length >= 2 ? sameDecade : rest;
      while (distractors.length < 2 && distractorPool.length) {
        const idx = Math.floor(Math.random() * distractorPool.length);
        const d = distractorPool.splice(idx,1)[0];
        if (d && d.title && !optionMovies.find(x=>x.id === d.id)) {
          distractors.push(d);
        }
      }
      optionMovies = [...optionMovies, ...distractors];
      // Enrich movie clues for UI
      setSpinResult({ actor, actress, year, movie: baseMovie.title });
      setMovieOptions(optionMovies.sort(() => Math.random() - 0.5));
      setShowWheel(false); // show clues/options screen
    }, 430);
  }

  // User submits guess
  function checkAnswer() {
    if (!spinResult || !selected) return;
    const ok = selected === spinResult.movie;
    setResults((arr) => ([...arr, {
      correct: ok,
      picked: selected,
      solution: spinResult.movie
    }]));
    setReveal(true);
    setTimeout(() => {
      if (step + 1 === TOTAL) {
        navigate("/summary/spin-the-wheel", {
          state: { results: [...results, { correct: ok, picked: selected, solution: spinResult.movie }] }
        });
      } else {
        resetForNext();
      }
    }, 1500);
  }

  function resetForNext() {
    setStep(step => step + 1);
    setSelected(null);
    setReveal(false);
    setShowWheel(true);
    setSpinResult(null);
    setMovieOptions([]);
    setWheelAngle((prev) => prev + Math.floor(Math.random() * 90)); // vary wheel
  }

  // Main rendering
  if (loading)
    return (
      <div className="kq-center kq-mt25"><div className="kq-quiz-panel">Loading Spin the Wheel...<br />🎡</div></div>
    );
  if (error)
    return (
      <div className="kq-center kq-mt25"><div className="kq-quiz-panel" style={{ color: "#b51b3b" }}>{error}</div></div>
    );

  return (
    <div>
      <div className="kq-quiz-panel" style={{ maxWidth: 440, minHeight: 430, position: "relative" }}>
        <QuizProgressBar step={step} total={TOTAL} />
        {showWheel ? (
          // ==== Spinning Wheel UI ====
          <div style={{
            margin: "32px auto 8px auto",
            width: 220, height: 220, position: "relative",
            display: "flex", flexDirection: "column", alignItems: "center"
          }}>
            <WheelView spinning={isSpinning} angle={wheelAngle} highlightIdx={isSpinning ? -1 : null} />
            <button
              className="kq-btn"
              onClick={handleSpin}
              style={{
                fontWeight: 700, fontSize: "1.14em", marginTop: 14,
                padding: "13px 27px", borderRadius: 20, letterSpacing: "1.5px"
              }}
              disabled={isSpinning}
            >
              {isSpinning ? "Spinning..." : "SPIN"}
            </button>
            <div style={{ color: "#f604c2", marginTop: 11, fontWeight: 500 }}>
              Spin for clues: Actor, Actress and Year!
            </div>
          </div>
        ) : (
          // ==== Show Resulting Clues, Movie Options, and Answer Prompt ====
          <div>
            <h3 style={{ color: "#f604c2", textAlign: "center", letterSpacing: 0.5 }}>Guess the Movie:</h3>
            <div className="kq-quiz-clues">
              <ul style={{
                color: "#0b0a0a", fontSize: "1.15em", marginBottom: 3, listStyle: "disc inside",
                paddingLeft: 8, lineHeight: "1.5"
              }}>
                <li><b>Actor:</b> <span style={{ color: "#b51b3b" }}>{spinResult?.actor}</span></li>
                <li><b>Actress:</b> <span style={{ color: "#b51b3b" }}>{spinResult?.actress}</span></li>
                <li><b>Year:</b> <span style={{ color: "#f604c2" }}>{spinResult?.year}</span></li>
              </ul>
            </div>
            <div className="kq-quiz-action-bar" style={{ flexWrap: "wrap", gap: 17, marginTop: 18, marginBottom: 4, justifyContent: "center" }}>
              {movieOptions.map((opt) => (
                <button
                  className="kq-btn outline"
                  key={opt.id}
                  style={{
                    color: selected === opt.title ? "#fff" : "#f604c2",
                    background: selected === opt.title ? "#f604c2" : "#fff",
                    fontWeight: "700",
                    border: "2px solid #f604c2",
                    minWidth: 160,
                    marginBottom: 7,
                    borderRadius: 9,
                    fontSize: "1.10em",
                    boxShadow: selected === opt.title ? "0 0 9px #f604c258" : ""
                  }}
                  onClick={() => { if (!reveal) setSelected(opt.title); }}
                  disabled={reveal}
                  tabIndex={0}
                >{opt.title}</button>
              ))}
            </div>
            <div className="kq-quiz-action-bar" style={{ marginTop: 8 }}>
              <button
                className="kq-quiz-answer-btn"
                style={{ minWidth: 88 }}
                onClick={checkAnswer}
                disabled={!selected || reveal}
              >
                Submit
              </button>
            </div>
            {reveal && (
              <div style={{
                marginTop: 16, background: "#f8e7f4", borderRadius: 7, padding: 11,
                textAlign: "center", color: "#b51b3b", fontWeight: 600, fontSize: "1.13em"
              }}>
                The correct answer was: <b>{spinResult.movie}</b>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper component: visual wheel (not interactive, controlled by parent)
function WheelView({ spinning, angle, highlightIdx }) {
  // Segment colors and labels for show (have no effect on clue selection)
  const segments = [
    { color: "#f604c2", label: "Actor" },
    { color: "#0b0a0a", label: "Actress" },
    { color: "#b51b3b", label: "Year" },
    { color: "#f7bb04", label: "Actor" },
    { color: "#0475f7", label: "Year" },
    { color: "#16860c", label: "Actress" },
    { color: "#b51b3b", label: "Actor" },
    { color: "#fa6e25", label: "Year" }
  ];
  const n = segments.length;
  const r = 95; // radius
  const cx = 110, cy = 110;

  // For each segment, draw a path for the slice of the pie
  function getArcPath(idx, total, inner = 32, outer = 95) {
    const a0 = ((idx / total) * 2 * Math.PI) - Math.PI/2;
    const a1 = (((idx+1) / total) * 2 * Math.PI) - Math.PI/2;
    const x0 = cx + Math.cos(a0) * inner;
    const y0 = cy + Math.sin(a0) * inner;
    const x1 = cx + Math.cos(a1) * inner;
    const y1 = cy + Math.sin(a1) * inner;
    const X0 = cx + Math.cos(a0) * outer;
    const Y0 = cy + Math.sin(a0) * outer;
    const X1 = cx + Math.cos(a1) * outer;
    const Y1 = cy + Math.sin(a1) * outer;
    const largeArc = a1 - a0 > Math.PI ? 1 : 0;
    return [
      `M${x0},${y0}`,
      `L${X0},${Y0}`,
      `A${outer},${outer},0,${largeArc},1,${X1},${Y1}`,
      `L${x1},${y1}`,
      `A${inner},${inner},0,${largeArc},0,${x0},${y0}`,
      "Z"
    ].join(" ");
  }

  return (
    <div style={{ width: 220, height: 220, position: "relative" }}>
      <svg width="220" height="220" viewBox="0 0 220 220" style={{
        transform: `rotate(${angle}deg)`,
        transition: spinning ? "none" : "transform 0.6s cubic-bezier(.23,.93,.62,1.13)"
      }}>
        {segments.map((seg, idx) => (
          <path
            key={idx}
            d={getArcPath(idx, n)}
            fill={seg.color}
            opacity={highlightIdx === idx ? 0.72 : 0.83}
            stroke="#fff"
            strokeWidth={2}
          />
        ))}
        {/* Label the segments */}
        {segments.map((seg, idx) => {
          const a = (((idx + 0.5) / n) * 2 * Math.PI) - Math.PI/2;
          return (
            <text
              key={idx}
              x={cx + Math.cos(a) * 65}
              y={cy + Math.sin(a) * 65 + 6}
              fontSize={18}
              fontWeight={700}
              textAnchor="middle"
              fill="#fff"
              style={{
                pointerEvents: "none",
                textShadow: "1px 1px 2px #0008"
              }}
            >{seg.label}</text>
          );
        })}
        {/* Wheel center (decorative) */}
        <circle cx={cx} cy={cy} r={31} fill="#fff" stroke="#f604c2" strokeWidth={4} />
        <text x={cx} y={cy+11} textAnchor="middle" fontWeight={900} fontSize={30} fill="#f604c2">🎡</text>
      </svg>
      {/* Wheel pointer */}
      <div style={{
        position: "absolute",
        top: 5, left: "50%", width: 0, height: 0, pointerEvents: "none",
        transform: "translateX(-50%)"
      }}>
        <svg width="26" height="33">
          <polygon points="13,0 0,33 26,33" fill="#f604c2" stroke="#b51b3b" strokeWidth={2} />
        </svg>
      </div>
    </div>
  );
}

export default SpinTheWheel;
