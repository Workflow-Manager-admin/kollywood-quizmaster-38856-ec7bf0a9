import React, { useEffect, useState } from "react";
import { discoverTamilMovies, getMovieDetails, getMovieCast } from "../tmdb";
import { useNavigate } from "react-router-dom";
import QuizProgressBar from "./QuizProgressBar";

/**
 * Game: Spin the Wheel - get actor/year clues, pick 1 from 3 movie options.
 */
// PUBLIC_INTERFACE
function SpinTheWheel() {
  const TOTAL = 10;
  const [questions, setQuestions] = useState([]);
  const [step, setStep] = useState(0);
  const [options, setOptions] = useState([]);
  const [clues, setClues] = useState({});
  const [picked, setPicked] = useState("");
  const [showClues, setShowClues] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [results, setResults] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    discoverTamilMovies({ page: 6 }).then((mv) => {
      // Pick 10 unique films
      setQuestions(mv.slice(0, TOTAL));
    });
  }, []);

  useEffect(() => {
    if (!questions.length) return;
    const q = questions[step];
    // Pick 2 random distractor movies from rest for options, generate clues
    const rest = questions.filter((_, i) => i !== step);
    const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
    const distractors = shuffle(rest).slice(0, 2);
    const optList = shuffle([q, ...distractors]);
    setOptions(optList);
    // Clues: pick main cast & year
    getMovieCast(q.id).then((cast) => {
      const mainCast = cast
        .slice(0, 2)
        .map((c) => c.name)
        .filter(Boolean)
        .join(", ");
      setClues({
        mainCast: mainCast || "Actor clue unavailable",
        year: q.release_date ? q.release_date.slice(0, 4) : "?",
      });
    });
    setPicked("");
    setReveal(false);
    setShowClues(false);
  }, [step, questions]);

  function checkAnswer() {
    const correct = options.find((x) => x === questions[step]);
    const ok = picked === correct.title;
    setResults([
      ...results,
      {
        correct: ok,
        picked,
        solution: correct.title,
      },
    ]);
    if (step + 1 === TOTAL) {
      navigate("/summary/spin-the-wheel", {
        state: { results: [...results, { correct: ok, picked, solution: correct.title }] },
      });
    } else {
      setStep(step + 1);
    }
  }

  function handleReveal() {
    setReveal(true);
    setShowClues(true);
    setTimeout(checkAnswer, 1700);
  }

  if (!questions.length)
    return (
      <div className="kq-quiz-panel kq-center" style={{ marginTop: 25 }}>
        Loading...
      </div>
    );
  const q = questions[step];
  return (
    <div className="kq-quiz-panel">
      <QuizProgressBar step={step} total={TOTAL} />
      <h3 style={{ color: "#f604c2", textAlign: "center" }}>
        Which is the right movie?
      </h3>
      {showClues && (
        <div className="kq-quiz-clues">
          <ul>
            <li>
              <b>Main Actor/Actress:</b> {clues.mainCast}
            </li>
            <li>
              <b>Year:</b> {clues.year}
            </li>
          </ul>
        </div>
      )}
      <div className="kq-quiz-action-bar" style={{ flexWrap: "wrap", gap: 20, marginTop: 17 }}>
        {options.map((opt) => (
          <button
            className="kq-btn outline"
            style={{
              color: picked === opt.title ? "#fff" : "#f604c2",
              background: picked === opt.title ? "#f604c2" : "#fff",
              fontWeight: "700",
              border: "2px solid #f604c2",
              minWidth: 150,
              marginBottom: 5,
            }}
            key={opt.id}
            onClick={() => setPicked(opt.title)}
            disabled={reveal}
          >
            {opt.title}
          </button>
        ))}
      </div>
      <div className="kq-quiz-action-bar">
        <button
          className="kq-quiz-answer-btn"
          onClick={() => setShowClues(true)}
          disabled={showClues}
        >
          Show Clues
        </button>
        <button className="kq-quiz-answer-btn reveal" onClick={handleReveal} disabled={reveal}>
          Reveal
        </button>
        <button
          className="kq-quiz-answer-btn"
          onClick={checkAnswer}
          disabled={!picked || reveal}
        >
          Submit
        </button>
      </div>
      {reveal && (
        <div style={{ color: "#b51b3b", marginTop: 11 }}>
          The answer is: <b>{questions[step].title}</b>
        </div>
      )}
    </div>
  );
}

export default SpinTheWheel;
