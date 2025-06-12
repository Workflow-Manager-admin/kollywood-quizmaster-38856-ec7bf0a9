import React, { useEffect, useState } from "react";
import { discoverTamilMovies, getMovieCast } from "../tmdb";
import { useNavigate } from "react-router-dom";
import QuizProgressBar from "./QuizProgressBar";

/**
 * Game: Cast Combo - guess movie for given combo of actors; reverse: who doesn't fit in given movie.
 */
// PUBLIC_INTERFACE
function CastCombo() {
  const TOTAL = 10;
  const [questions, setQuestions] = useState([]);
  const [step, setStep] = useState(0);
  const [combo, setCombo] = useState({ actors: [], movie: "", notIn: "" });
  const [userAnswer, setUserAnswer] = useState("");
  const [showClues, setShowClues] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [results, setResults] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    discoverTamilMovies({ page: 7 }).then((movies) => {
      setQuestions(movies.slice(0, TOTAL));
    });
  }, []);

  useEffect(() => {
    generateCombo();
    setReveal(false);
    setShowClues(false);
    setUserAnswer("");
  // eslint-disable-next-line
  }, [step, questions]);

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function generateCombo() {
    const q = questions[step];
    if (!q) return;
    // Give: 3 actors from movie, 1 not-in-movie (reverse sometimes)
    getMovieCast(q.id).then((cast) => {
      const names = cast
        .filter((c) => c.name)
        .slice(0, 9)
        .map((c) => c.name);
      if (Math.random() < 0.5) {
        // Normal: show actors, user guesses the movie
        setCombo({ actors: names.slice(0, 3), movie: q.title, notIn: "" });
      } else {
        // Reverse: show 3 actors from movie + fake, user picks which actor is NOT in movie
        discoverTamilMovies({ page: 10 }).then((mv2) => {
          const restNames = mv2
            .flatMap((m) => m.title && m.id !== q.id ? [m.title] : [])
            .concat(names);
          const notIn = shuffle(restNames).find(
            (nm) => !names.includes(nm) && typeof nm === "string"
          );
          setCombo({
            actors: shuffle([...names.slice(0, 3), notIn]).slice(0, 4),
            movie: q.title,
            notIn,
          });
        });
      }
    });
  }

  function checkAnswer() {
    let ok;
    if (combo.notIn) {
      // Pick which actor is not in movie
      ok = userAnswer === combo.notIn;
    } else {
      ok = userAnswer.trim().toLowerCase() === combo.movie.trim().toLowerCase();
    }
    const res = [
      ...results,
      { correct: ok, answer: userAnswer, solution: combo.movie, notIn: combo.notIn },
    ];
    setResults(res);
    if (step + 1 === TOTAL) {
      navigate("/summary/cast-combo", { state: { results: res } });
    } else {
      setStep(step + 1);
    }
  }

  function handleReveal() {
    setReveal(true);
    setShowClues(true);
    setTimeout(checkAnswer, 1400);
  }

  if (!questions.length || !combo.actors.length)
    return (
      <div className="kq-quiz-panel kq-center" style={{ marginTop: 25 }}>
        Loading...
      </div>
    );

  return (
    <div className="kq-quiz-panel">
      <QuizProgressBar step={step} total={TOTAL} />
      {combo.notIn ? (
        <div style={{ color: "#0b0a0a", marginBottom: 8 }}>
          <b>Pick the actor <span style={{ color: "#b51b3b" }}>NOT</span> present in: {combo.movie}</b>
        </div>
      ) : (
        <div style={{ color: "#0b0a0a", marginBottom: 8 }}>
          <b>Guess the movie with these actors:</b>{" "}
          <span style={{ color: "#f604c2" }}>{combo.actors.join(", ")}</span>
        </div>
      )}
      {combo.notIn ? (
        <div className="kq-quiz-action-bar">
          {combo.actors.map((n, idx) => (
            <button
              className="kq-btn outline"
              key={n + idx}
              style={{
                color: userAnswer === n ? "#fff" : "#f604c2",
                background: userAnswer === n ? "#f604c2" : "#fff",
                fontWeight: "700",
                border: "2px solid #f604c2",
                minWidth: 110,
                marginBottom: 4,
              }}
              onClick={() => setUserAnswer(n)}
              disabled={reveal}
            >
              {n}
            </button>
          ))}
        </div>
      ) : (
        <div className="kq-quiz-answer-row">
          <input
            className="kq-input"
            placeholder="Movie Title"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            disabled={reveal}
            autoFocus
          />
        </div>
      )}
      <div className="kq-quiz-action-bar">
        <button
          className="kq-quiz-answer-btn"
          onClick={() => setShowClues(true)}
          disabled={showClues}
        >
          Clue
        </button>
        <button className="kq-quiz-answer-btn reveal" onClick={handleReveal} disabled={reveal}>
          Reveal
        </button>
        {!combo.notIn && (
          <button
            className="kq-quiz-answer-btn"
            onClick={checkAnswer}
            disabled={!userAnswer || reveal}
          >
            Submit
          </button>
        )}
      </div>
      {showClues && (
        <div className="kq-quiz-clues">
          {combo.notIn
            ? "Hint: One name above is not in the main cast!"
            : "All actors listed are starring in the same movie."}
        </div>
      )}
      {reveal && (
        <div style={{ color: "#b51b3b", marginTop: 11 }}>
          The answer is:{" "}
          <b>
            {combo.notIn
              ? combo.notIn
              : combo.movie}
          </b>
        </div>
      )}
    </div>
  );
}

export default CastCombo;
