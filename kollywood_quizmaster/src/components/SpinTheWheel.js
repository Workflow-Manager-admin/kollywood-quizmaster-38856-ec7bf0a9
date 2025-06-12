import React, { useEffect, useState } from "react";
import { discoverTamilMovies, getMovieDetails, getMovieCast } from "../tmdb";
import { useNavigate } from "react-router-dom";
import QuizProgressBar from "./QuizProgressBar";

/**
 * SpinTheWheel: Shows a spinning wheel split into 10 Q1–Q10 segments.
 * When spun, animates and selects a question (by index); then reveals its clues (actor, actress, year).
 * User then sees those true clues only for the selected question/segment.
 */
// PUBLIC_INTERFACE
function SpinTheWheel() {
  const TOTAL = 10;
  const [questions, setQuestions] = useState([]);  // [{title, id, ...mainActor/actress/year prepared}]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0); // progress in session
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelAngle, setWheelAngle] = useState(0);
  const [selectedSegment, setSelectedSegment] = useState(null); // Q0...Q9 index
  const [revealed, setRevealed] = useState(false); // After spin, show clues for that round
  const [results, setResults] = useState([]);
  const navigate = useNavigate();

  // Prepare 10 real questions with pre-fetched clues
  useEffect(() => {
    setLoading(true);
    setError("");
    discoverTamilMovies({ sort_by: "popularity.desc", page: 4 })
      .then(async (movies) => {
        // Shuffle and pick 10
        let filtered = movies.filter(
          (m) =>
            m &&
            m.id &&
            m.title &&
            m.release_date &&
            typeof m.title === "string" &&
            typeof m.release_date === "string" &&
            m.release_date.length >= 4
        );
        // Shuffle (Fisher-Yates)
        for (let i = filtered.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
        }
        filtered = filtered.slice(0, TOTAL);

        // For each, fetch cast/details to pick actor/actress/year
        const readyQs = await Promise.all(
          filtered.map(async (m) => {
            try {
              const [cast, details] = await Promise.all([
                getMovieCast(m.id),
                getMovieDetails(m.id)
              ]);
              let actor = "", actress = "";
              if (Array.isArray(cast)) {
                const mActor = cast.find(
                  (c) =>
                    c.known_for_department === "Acting" &&
                    c.gender === 2 &&
                    c.name
                );
                actor = mActor?.name || "";
                const fActress = cast.find(
                  (c) =>
                    c.known_for_department === "Acting" &&
                    c.gender === 1 &&
                    c.name
                );
                actress = fActress?.name || "";
                if (!actor && cast.length) actor = cast[0].name;
                if (!actress) {
                  const alt = cast.find(
                    (c) =>
                      c.gender === 1 ||
                      (c.gender === 0 && c.name && c.name !== actor)
                  );
                  actress = alt?.name || "Clue unavailable";
                }
                if (!actor) actor = "Clue unavailable";
              } else {
                actor = "Clue unavailable";
                actress = "Clue unavailable";
              }
              const year = m.release_date ? m.release_date.slice(0, 4) : "?";
              return {
                ...m,
                clueActor: actor,
                clueActress: actress,
                clueYear: year
              };
            } catch {
              // fallback with blank clues
              return {
                ...m,
                clueActor: "Clue unavailable",
                clueActress: "Clue unavailable",
                clueYear: m.release_date ? m.release_date.slice(0, 4) : "?"
              };
            }
          })
        );
        setQuestions(readyQs);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to fetch movie data from TMDb.");
        setLoading(false);
      });
  }, []);

  // Handle spinning the wheel
  function spinWheel() {
    if (isSpinning || loading || revealed) return;
    setIsSpinning(true);
    setSelectedSegment(null);
    setRevealed(false);
    // Simulate wheel: select a QN at random except those already completed
    const available = questions
      .map((q, idx) => idx)
      .filter((idx) => !results.some((r) => r.qIdx === idx));
    if (available.length === 0) return;
    const targetQIdx = available[Math.floor(Math.random() * available.length)];
    const anglePerSegment = 360 / TOTAL;
    const extraSpins = 6;
    const finalAngle =
      360 * extraSpins +
      targetQIdx * anglePerSegment +
      anglePerSegment / 2;
    let current = wheelAngle;
    let startTs = null;
    function animate(ts) {
      if (!startTs) startTs = ts;
      const duration = 2100;
      const elapsed = ts - startTs;
      const progress = Math.min(elapsed / duration, 1);
      // cubic ease out
      const easeOut = (t) => --t * t * t + 1;
      const eased = easeOut(progress);
      const angle = current + (finalAngle - current) * eased;
      setWheelAngle(angle % 360);
      if (progress < 1) {
        window.requestAnimationFrame(animate);
      } else {
        setWheelAngle(finalAngle % 360);
        setTimeout(() => {
          setIsSpinning(false);
          setSelectedSegment(targetQIdx);
          setTimeout(() => setRevealed(true), 600);
        }, 220);
      }
    }
    window.requestAnimationFrame(animate);
  }

  // Submit and continue to next, or summary at end
  function handleNext() {
    // User presses continue (after clues shown)
    setResults((arr) => [
      ...arr,
      {
        qIdx: selectedSegment,
        correct: true,
        solution: questions[selectedSegment]?.title,
      }
    ]);
    // Advance step; if finished, go to summary
    if (results.length + 1 >= TOTAL) {
      setTimeout(() => {
        navigate("/summary/spin-the-wheel", {
          state: {
            results: [
              ...results,
              {
                qIdx: selectedSegment,
                correct: true,
                solution: questions[selectedSegment]?.title,
              }
            ]
          }
        });
      }, 300);
    } else {
      setTimeout(() => {
        setStep((prev) => prev + 1);
        setSelectedSegment(null);
        setRevealed(false);
        setWheelAngle((prev) => prev + Math.floor(Math.random() * 60));
      }, 320);
    }
  }

  // UI render
  if (loading)
    return (
      <div className="kq-center kq-mt25">
        <div className="kq-quiz-panel">Loading wheel and questions...<br />🎡</div>
      </div>
    );
  if (error)
    return (
      <div className="kq-center kq-mt25">
        <div className="kq-quiz-panel" style={{ color: "#b51b3b" }}>{error}</div>
      </div>
    );

  // Calculate which segments are still remaining, or mark finished
  const allSpun = results.length >= TOTAL;

  return (
    <div>
      <div className="kq-quiz-panel" style={{ maxWidth: 440, minHeight: 440, position: "relative" }}>
        <QuizProgressBar step={results.length} total={TOTAL} />
        {!revealed ? (
          <div
            style={{
              margin: "32px auto 8px auto",
              width: 240,
              height: 240,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <WheelCircle
              spinning={isSpinning}
              angle={wheelAngle}
              highlightIdx={selectedSegment}
              showResults={results}
              total={TOTAL}
            />
            <button
              className="kq-btn"
              onClick={spinWheel}
              style={{
                fontWeight: 700,
                fontSize: "1.18em",
                marginTop: 14,
                padding: "13px 31px",
                borderRadius: 20,
                letterSpacing: "1.5px",
              }}
              disabled={isSpinning || allSpun}
            >
              {isSpinning
                ? "Spinning..."
                : allSpun
                ? "All questions done!"
                : "SPIN"}
            </button>
            <div
              style={{
                color: "#f604c2",
                marginTop: 11,
                fontWeight: 500,
                fontSize: 17,
              }}
            >
              Spin to get Q1 – Q10!
            </div>
            <div
              style={{
                marginTop: 7,
                fontSize: 13,
                color: "#0b0a0a",
                opacity: 0.78,
                maxWidth: 200,
                textAlign: "center",
              }}
            >
              {allSpun
                ? "No more segments left. (See your results below!)"
                : "Each segment is Q1, Q2... Spin to reveal clues!"}
            </div>
          </div>
        ) : selectedSegment != null ? (
          <div style={{ marginTop: 30, minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 22, color: "#f604c2", fontWeight: "bold", marginBottom: 6 }}>
              {`Q${selectedSegment + 1}`}
            </div>
            <div className="kq-quiz-clues">
              <ul style={{ color: "#0b0a0a", fontSize: "1.12em", margin: 0, listStyle: "disc inside", paddingLeft: 8 }}>
                <li>
                  <b>Actor:</b>{" "}
                  <span style={{ color: "#b51b3b" }}>
                    {questions[selectedSegment]?.clueActor}
                  </span>
                </li>
                <li>
                  <b>Actress:</b>{" "}
                  <span style={{ color: "#b51b3b" }}>
                    {questions[selectedSegment]?.clueActress}
                  </span>
                </li>
                <li>
                  <b>Year:</b>{" "}
                  <span style={{ color: "#f604c2" }}>
                    {questions[selectedSegment]?.clueYear}
                  </span>
                </li>
              </ul>
              <div
                style={{
                  marginTop: 11,
                  color: "#0b0a0a",
                  opacity: 0.75,
                  fontSize: 14.5,
                  marginBottom: 5,
                  textAlign: "center",
                }}
              >
                Guess the movie for these clues:<br />
                <b style={{ color: "#222" }}>
                  ({questions[selectedSegment]?.title || ""})
                </b>
              </div>
            </div>
            <div style={{ marginTop: 19, marginBottom: 6 }}>
              <button
                className="kq-btn"
                onClick={handleNext}
                style={{
                  padding: "10px 26px",
                  fontWeight: 700,
                  fontSize: 18,
                  borderRadius: 7,
                }}
              >
                {results.length + 1 >= TOTAL ? "View Results" : "Next Spin"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
function WheelCircle({ spinning, angle, highlightIdx, showResults, total }) {
  // Draw 10 segments labeled Q1 - Q10
  const n = total || 10;
  const colors = [
    "#f604c2", "#0b0a0a", "#b51b3b", "#f7bb04", "#0475f7",
    "#16860c", "#b51b3b", "#fa6e25", "#e05b8c", "#06b8ae"
  ];
  const segmentLabels = Array.from({ length: n }, (_, i) => `Q${i + 1}`);
  const cx = 120, cy = 120, outer = 110, inner = 32;

  // Used segments (finished) are provided as showResults (array of {qIdx,...}), highlightIdx is current selected
  function getArcPath(idx, total, inner = 32, outer = 110) {
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
    <div style={{ width: 240, height: 240, position: "relative" }}>
      <svg width="240" height="240" viewBox="0 0 240 240" style={{
        transform: `rotate(${angle}deg)`,
        transition: spinning ? "none" : "transform 0.7s cubic-bezier(.23,.93,.62,1.13)"
      }}>
        {Array.from({ length: n }).map((_, idx) => (
          <path
            key={idx}
            d={getArcPath(idx, n)}
            fill={colors[idx % colors.length]}
            opacity={
              highlightIdx === idx
                ? 1
                : (showResults?.some((r) => r.qIdx === idx) ? 0.35 : 0.83)
            }
            stroke="#fff"
            strokeWidth={2.5}
          />
        ))}
        {/* Label the segments */}
        {segmentLabels.map((lbl, idx) => {
          const a = (((idx + 0.5) / n) * 2 * Math.PI) - Math.PI / 2;
          return (
            <text
              key={lbl}
              x={cx + Math.cos(a) * 72}
              y={cy + Math.sin(a) * 72 + 7}
              fontSize={23}
              fontWeight={900}
              textAnchor="middle"
              fill="#fff"
              style={{
                pointerEvents: "none",
                textShadow: highlightIdx === idx ? "2px 2px 5px #b51b3b88,0.5px 0.5px 1px #0008" : "1px 1px 2px #0008",
                opacity:
                  showResults?.some((r) => r.qIdx === idx)
                    ? 0.36
                    : 0.9
              }}
            >{lbl}</text>
          );
        })}
        {/* Wheel center */}
        <circle cx={cx} cy={cy} r={36} fill="#fff" stroke="#f604c2" strokeWidth={4.6} />
        <text x={cx} y={cy + 13} textAnchor="middle" fontWeight={900} fontSize={37} fill="#f604c2">🎡</text>
      </svg>
      {/* Wheel pointer */}
      <div style={{
        position: "absolute",
        top: 11, left: "50%", width: 0, height: 0, pointerEvents: "none",
        transform: "translateX(-50%)"
      }}>
        <svg width="30" height="41">
          <polygon points="15,1 0,41 30,41" fill="#f604c2" stroke="#b51b3b" strokeWidth={2} />
        </svg>
      </div>
    </div>
  );
}

export default SpinTheWheel;
