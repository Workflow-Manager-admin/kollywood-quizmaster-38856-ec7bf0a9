import React, { useState, useEffect } from "react";
import { discoverTamilMovies, getMovieCast } from "../tmdb";
import { useNavigate } from "react-router-dom";
import QuizProgressBar from "./QuizProgressBar";

/**
 * Game: Character-Movie Match
 * 10 questions. Drag character names to the right movie title.
 */
// PUBLIC_INTERFACE
function CharacterMovieMatch() {
  const TOTAL = 10;
  const [questions, setQuestions] = useState([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [drags, setDrags] = useState([]);
  const [showClues, setShowClues] = useState(false);
  const [reveal, setReveal] = useState(false);
  const navigate = useNavigate();

  // Build questions (movie, 3 random character names from their cast)
  useEffect(() => {
    discoverTamilMovies({ page: 3 }).then((movies) => {
      const filtered = movies
        .filter((m) => m.title)
        .slice(0, TOTAL + 3);
      Promise.all(
        filtered.map((m) =>
          getMovieCast(m.id).then((cast) => {
            // Get 2 main and 1 minor "character" for the correct movie
            const major = cast.slice(0, 3).filter((c) => c.character);
            if (major.length === 0) return null;
            return {
              movie: m.title,
              movieId: m.id,
              characterOptions: major.map((c) => c.character),
            };
          })
        )
      ).then((qsetRaw) => {
        // take only valid ones with 2 or more characterOptions
        const qset = qsetRaw.filter((q) => q && q.characterOptions.length > 1);
        // Build pool: for drag, pool all chars, then shuffle
        let charBag = [];
        qset.forEach((q) => charBag.push(...q.characterOptions));
        charBag = charBag.slice(0, TOTAL * 2); // avoid overfitting
        setQuestions(qset.slice(0, TOTAL));
        setDrags(shuffleArray(charBag).slice(0, TOTAL * 2));
      });
    });
  }, []);

  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function onDrop(e, movie) {
    const char = e.dataTransfer.getData("character");
    if (!char) return;
    setAnswers({ ...answers, [movie]: char });
  }

  function startDrag(e, char) {
    e.dataTransfer.setData("character", char);
  }

  function checkAnswer() {
    const q = questions[step];
    const correct = q.characterOptions.includes(answers[q.movie]);
    const nextStep = step + 1;
    if (nextStep === TOTAL) {
      navigate("/summary/character-movie-match", {
        state: {
          results: [
            ...(JSON.parse(window.sessionStorage.getItem("cm-match") || "[]")),
            { correct, guess: answers[q.movie], solution: q.characterOptions.join(", ") },
          ],
        },
      });
    } else {
      setStep(nextStep);
      setAnswers({ ...answers, [q.movie]: "" });
    }
    window.sessionStorage.setItem(
      "cm-match",
      JSON.stringify([
        ...(JSON.parse(window.sessionStorage.getItem("cm-match") || "[]")),
        { correct, guess: answers[q.movie], solution: q.characterOptions.join(", ") },
      ])
    );
    setReveal(false);
    setShowClues(false);
  }

  function revealNow() {
    setReveal(true);
    setShowClues(true);
    setTimeout(() => checkAnswer(), 2100);
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
        Which character appears in <span style={{ color: "#b51b3b" }}>{q.movie}</span>?
      </h3>
      <div className="kq-quiz-clues" style={{ minHeight: "26px" }}>
        {showClues && (
          <div>
            <b>Clue:</b> Drag the best match character from the box below.
          </div>
        )}
      </div>
      <div
        className="kq-quiz-answer-row"
        style={{
          minHeight: 60,
          marginTop: 16,
          border: "1.5px dashed #f604c2",
          borderRadius: 6,
          justifyContent: "center",
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDrop(e, q.movie)}
      >
        <div style={{ fontWeight: 500, color: "#0b0a0a" }}>
          {answers[q.movie] ? (
            <span>
              Picked: <b>{answers[q.movie]}</b>
            </span>
          ) : (
            "Drop character here"
          )}
        </div>
      </div>
      <div
        style={{
          marginTop: 22,
          display: "flex",
          flexWrap: "wrap",
          gap: "9px",
        }}
      >
        {drags.slice(step * 2, step * 2 + 3).map((char, i) => (
          <span
            draggable
            onDragStart={(e) => startDrag(e, char)}
            className="kq-btn outline"
            key={char + i}
            style={{
              borderRadius: "6px",
              cursor: "grab",
              padding: "9px 18px",
              background: "#fbfaf9",
              color: "#f604c2",
              borderColor: "#f604c2",
              fontWeight: "700",
            }}
          >
            {char}
          </span>
        ))}
      </div>
      <div className="kq-quiz-action-bar">
        <button className="kq-quiz-answer-btn" onClick={() => setShowClues(!showClues)} disabled={showClues}>
          {showClues ? "Clue given" : "Show Clue"}
        </button>
        <button className="kq-quiz-answer-btn reveal" onClick={revealNow} disabled={reveal}>
          Reveal
        </button>
        <button
          className="kq-quiz-answer-btn"
          onClick={checkAnswer}
          disabled={!answers[q.movie] || reveal}
        >
          Submit
        </button>
      </div>
      {reveal && (
        <div style={{ color: "#b51b3b", marginTop: 13 }}>
          One possible correct character: <b>{q.characterOptions[0]}</b>
        </div>
      )}
    </div>
  );
}

export default CharacterMovieMatch;
