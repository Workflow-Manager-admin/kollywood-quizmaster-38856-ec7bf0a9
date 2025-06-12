import React, { useEffect, useState } from "react";
import { discoverTamilMovies } from "../tmdb";
import { useNavigate } from "react-router-dom";
import QuizProgressBar from "./QuizProgressBar";

/**
 * Game: Movie Bingo (Refactored to Quiz Format)
 * Shows one question at a time with multiple-choice options.
 * - Only one answer may be picked per question, answer locks after selection.
 * - Skip option for each question (no feedback for skip).
 * - Correct/incorrect answers are colored: green/red.
 */
// PUBLIC_INTERFACE
function MovieBingo() {
  const TOTAL_QUESTIONS = 10;
  const QUESTION_BANK = [
    {
      clue: "National award winner",
      match: (movie) =>
        ["national", "award"].some((kw) =>
          (movie.overview || "").toLowerCase().includes(kw)
        ),
    },
    {
      clue: "Musical hit",
      match: (movie) =>
        ["music", "song", "album", "musical", "soundtrack"].some((kw) =>
          (movie.overview || "").toLowerCase().includes(kw)
        ),
    },
    {
      clue: "Comedy",
      match: (movie) =>
        (movie.genre_ids || []).includes(35) ||
        (movie.genres && movie.genres.some((g) => g.name === "Comedy")),
    },
    {
      clue: "Action-packed",
      match: (movie) =>
        (movie.genre_ids || []).includes(28) ||
        (movie.genres && movie.genres.some((g) => g.name === "Action")),
    },
    {
      clue: "Female lead",
      match: (movie) =>
        ["woman", "female", "girl", "heroine"].some((kw) =>
          (movie.overview || "").toLowerCase().includes(kw)
        ),
    },
    {
      clue: "Oscar submission",
      match: (movie) =>
        ["oscar", "academy award", "international feature"].some((kw) =>
          (movie.overview || "").toLowerCase().includes(kw)
        ),
    },
    {
      clue: "Debut director",
      match: (movie) =>
        ["debut", "first film", "first-time director"].some((kw) =>
          (movie.overview || "").toLowerCase().includes(kw)
        ),
    },
    {
      clue: "Superstar cast",
      match: (movie) =>
        ["superstar", "big star", "ensemble"].some((kw) =>
          (movie.overview || "").toLowerCase().includes(kw)
        ),
    },
    {
      clue: "Known for villain",
      match: (movie) =>
        ["villain", "antagonist"].some((kw) =>
          (movie.overview || "").toLowerCase().includes(kw)
        ),
    },
    {
      clue: "Family drama",
      match: (movie) =>
        (movie.genre_ids || []).includes(18) ||
        (movie.genres && movie.genres.some((g) => g.name === "Drama")) ||
        ["family", "home"].some((kw) =>
          (movie.overview || "").toLowerCase().includes(kw)
        ),
    },
  ];

  const [questionList, setQuestionList] = useState([]);
  const [optionsByQ, setOptionsByQ] = useState([]); // [ [options-for-Q0], ... ]
  const [step, setStep] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]); // {answerIdx: number|null, skipped: boolean }
  const [locked, setLocked] = useState(false);
  const [selected, setSelected] = useState(null);
  const [revealState, setRevealState] = useState(null); // "correct", "wrong", null
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Shuffle helper
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // On mount: prepare questions and options
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        // Get more than needed to provide distractors
        const movies = await discoverTamilMovies({ page: 4 });
        // For each clue, pick one correct + up to 3 distractors
        let qList = shuffle(QUESTION_BANK).slice(0, TOTAL_QUESTIONS);
        let optsArr = [];
        for (let q of qList) {
          // Find matches for clue
          const matches = shuffle(movies.filter(q.match));
          const correct = matches[0] || shuffle(movies)[0]; // fallback if none found
          const distractors = shuffle(
            movies.filter((m) => m.id !== correct.id)
          ).slice(0, 3);
          const opts = shuffle([correct, ...distractors]).slice(0, 4);
          optsArr.push({ options: opts, correctId: correct.id });
        }
        setQuestionList(qList);
        setOptionsByQ(optsArr);
        setUserAnswers([]);
        setStep(0);
        setSelected(null);
        setRevealState(null);
        setLocked(false);
        setLoading(false);
      } catch (e) {
        setError("Failed to load quiz data. Please refresh and try again.");
        setLoading(false);
      }
    }
    loadData();
  // eslint-disable-next-line
  }, []);

  // Select an answer (locked after choice)
  function handleSelect(idx) {
    if (locked) return;
    setSelected(idx);
    setLocked(true);
    // Reveal green/red
    const optsForThisQ = optionsByQ[step];
    const isCorrect =
      optsForThisQ &&
      optsForThisQ.options &&
      optsForThisQ.options[idx] &&
      optsForThisQ.options[idx].id === optsForThisQ.correctId;
    setRevealState(isCorrect ? "correct" : "wrong");
    // Save answer result
    const newAnswers = [...userAnswers];
    newAnswers[step] = { answerIdx: idx, skipped: false, correct: isCorrect };
    setUserAnswers(newAnswers);
    // Advance to next after 1.4s
    setTimeout(() => {
      gotoNextQuestion(isCorrect, idx, false);
    }, 1400);
  }

  // Skip logic
  function handleSkip() {
    // Mark this question as skipped, do not show correct/wrong
    const newAnswers = [...userAnswers];
    newAnswers[step] = { answerIdx: null, skipped: true, correct: false };
    setUserAnswers(newAnswers);
    gotoNextQuestion(false, null, true);
  }

  function gotoNextQuestion(isCorrect, answerIdx, skipped) {
    if (step + 1 >= TOTAL_QUESTIONS) {
      // Prepare results mapping for summary
      let results = [];
      for (let i = 0; i < TOTAL_QUESTIONS; ++i) {
        const ans = (userAnswers[i] || {});
        let optObj = null;
        if (ans.answerIdx != null && optionsByQ[i] && optionsByQ[i].options) {
          optObj = optionsByQ[i].options[ans.answerIdx];
        }
        results.push({
          correct: ans.skipped
            ? null
            : !!(ans.correct),
          answer: optObj ? optObj.title : null,
          skipped: !!ans.skipped,
          solution: optionsByQ[i]?.options.find(
            (o) => o.id === optionsByQ[i].correctId
          )?.title,
          poster: optionsByQ[i]?.options.find(
            (o) => o.id === optionsByQ[i].correctId
          )?.poster_path,
        });
      }
      navigate("/summary/movie-bingo", {
        state: { results },
      });
    } else {
      setStep(step + 1);
      setSelected(null);
      setRevealState(null);
      setLocked(false);
    }
  }

  // UI RENDER
  if (loading)
    return (
      <div className="kq-quiz-panel kq-center" style={{ marginTop: 25 }}>
        Loading quiz...
      </div>
    );
  if (error)
    return (
      <div className="kq-quiz-panel kq-center" style={{ marginTop: 25, color: "#b51b3b", fontWeight: 600 }}>
        {error}
      </div>
    );

  const qObj = questionList[step];
  const optsObj = optionsByQ[step];
  if (!qObj || !optsObj)
    return (
      <div className="kq-quiz-panel kq-center" style={{ marginTop: 25 }}>
        Failed to load question. Please restart game.
      </div>
    );
  const { clue } = qObj;
  const { options, correctId } = optsObj;

  return (
    <div className="kq-quiz-panel">
      <QuizProgressBar step={step} total={TOTAL_QUESTIONS} />
      <h2 style={{ color: "#f604c2", textAlign: "center", margin: "0 0 13px 0" }}>
        {clue}
      </h2>
      <div className="kq-quiz-action-bar" style={{ flexDirection: "column", gap: 15, margin: "20px 0 16px" }}>
        {options.map((m, idx) => {
          let style = {
            minHeight: 55,
            fontWeight: 700,
            color: "#f604c2",
            background: "#fff",
            border: "2px solid #f604c2",
            borderRadius: 9,
            cursor: locked ? "not-allowed" : "pointer",
            opacity: locked && selected !== idx ? 0.62 : 1,
            pointerEvents: locked && selected !== idx ? "none" : "auto",
            fontSize: "1.07em",
            marginBottom: 4,
            transition: "all 0.18s",
          };
          if (locked && selected === idx) {
            if (
              (m.id === correctId && revealState === "correct") ||
              (m.id !== correctId && revealState === "wrong")
            ) {
              style.background =
                m.id === correctId
                  ? "#1b9e38"
                  : "#b51b3b";
              style.color = "#fff";
              style.borderColor = m.id === correctId ? "#137b2c" : "#7c1e2f";
              style.boxShadow = m.id === correctId ? "0 0 7px #34c85a88" : "0 0 7px #f3123888";
            }
          } else if (locked && m.id === correctId) {
            // If skipped and showing options (for future), do not highlight correct unless feedback required.
            // (Current: only color selected/locked answer.)
          }
          return (
            <button
              className="kq-btn outline"
              disabled={locked}
              key={m.id}
              style={style}
              onClick={() => handleSelect(idx)}
              aria-label={`option ${m.title}`}
            >
              {m.title}
            </button>
          );
        })}
      </div>
      <div className="kq-quiz-action-bar" style={{ marginTop: 8, justifyContent: "center" }}>
        <button
          className="kq-quiz-answer-btn"
          onClick={handleSkip}
          disabled={locked}
          style={{
            minWidth: 120,
            background: "#f604c2",
            color: "#fff",
            border: "none",
            marginRight: 13,
            borderRadius: 7,
            fontWeight: 700,
            opacity: locked ? 0.51 : 1,
            cursor: locked ? "not-allowed" : "pointer"
          }}
        >
          Skip
        </button>
      </div>
      {locked && selected != null && (
        <div style={{
          marginTop: 17,
          minHeight: 23,
          color: revealState === "correct" ? "#1b9e38" : "#b51b3b",
          fontWeight: 700,
          textAlign: 'center'
        }}>
          {revealState === "correct"
            ? "Correct! 🎉"
            : "Incorrect."}
        </div>
      )}
    </div>
  );
}

export default MovieBingo;
