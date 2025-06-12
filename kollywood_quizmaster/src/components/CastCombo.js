import React, { useEffect, useState } from "react";
import { discoverTamilMovies, getMovieCast, searchMovies } from "../tmdb";
import { useNavigate } from "react-router-dom";
import QuizProgressBar from "./QuizProgressBar";

/**
 * Game: Cast Combo - guess movie for given combo of actors; reverse: who doesn't fit in given movie.
 * 
 * Extension: if a specific negative cast trivia for 'O Kadhal Kanmani' is needed,
 * override the first question to be a multiple-choice "Pick the actor NOT present in: O Kadhal Kanmani".
 * Fetch real cast, and inject a plausible Kollywood actor as distractor.
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
  const [okkLoaded, setOkkLoaded] = useState(false);
  const [okkCombo, setOkkCombo] = useState(null);
  const navigate = useNavigate();

  // Helper: shuffle array
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Generate OK Kanmani special question
  useEffect(() => {
    async function setupOkkQn() {
      // 1. Find TMDb id for O Kadhal Kanmani
      let movieId = null;
      // Try up to a few variants to avoid mismatch
      const variants = [
        "O Kadhal Kanmani",
        "OK Kanmani",
        "O Kadhal Kanmani (2015)"
      ];
      let movieData = null;
      for (let title of variants) {
        const found = await searchMovies(title, { language: "ta-IN", region: "IN" });
        movieData = (found || []).find(m =>
          m.title &&
          (
            m.title.toLowerCase() === "o kadhal kanmani" ||
            m.title.toLowerCase() === "ok kanmani"
          )
        );
        if (movieData && movieData.id) {
          movieId = movieData.id;
          break;
        }
      }
      // Fallback: search for English title "O Kadhal Kanmani"
      if (!movieId && (!movieData || !movieData.id)) {
        const found = await searchMovies("O Kadhal Kanmani");
        movieData = (found || []).find(m =>
          m.title &&
          (
            m.title.toLowerCase() === "o kadhal kanmani" ||
            m.title.toLowerCase() === "ok kanmani"
          )
        );
        if (movieData && movieData.id) {
          movieId = movieData.id;
        }
      }

      // 2. Get cast
      let cast = [];
      if (movieId) {
        cast = await getMovieCast(movieId).catch(() => []);
      }

      // 3. Pick 3 main actors
      const actorNames = (cast || [])
        .filter(c => c.name)
        .slice(0, 6) // broaden in case top billed not desired
        .map(c => c.name);

      // Known main actors for context:
      // Dulquer Salmaan, Nithya Menen, Prakash Raj
      let mainCast = [];
      // Ensure Dulquer Salmaan & Nithya Menen included
      ["Dulquer Salmaan", "Nithya Menen", "Prakash Raj", "Ramya Subramanian", "Leela Samson"].forEach(n => {
        if (actorNames.includes(n) && !mainCast.includes(n)) {
          mainCast.push(n);
        }
      });
      // If not enough, fill from fetched
      for (let n of actorNames) {
        if (mainCast.length >= 3) break;
        if (!mainCast.includes(n)) mainCast.push(n);
      }
      mainCast = mainCast.slice(0, 3);

      // 4. Plausible but absent Kollywood actor as distractor (not in mainCast or actorNames)
      // Use a small pool of famous Kollywood actors or search from other TMDb Tamil movies
      const plausibleDistractors = [
        "Sivakarthikeyan",
        "Vijay",
        "Vikram",
        "Karthi",
        "Suriya",
        "Arya",
        "Samantha Ruth Prabhu"
      ];
      // Remove any who are (somehow) in main cast
      const distractor =
        plausibleDistractors.find(n => !actorNames.includes(n) && !mainCast.includes(n))
        || "Sivakarthikeyan"; // fallback

      // Build shuffled options and mark answer
      const allOptions = shuffle([...mainCast, distractor]);
      const okkQnCombo = {
        actors: allOptions,
        movie: "O Kadhal Kanmani",
        notIn: distractor
      };
      setOkkCombo(okkQnCombo);
      setOkkLoaded(true);
    }
    // Only setup for step 0
    if (step === 0) {
      setupOkkQn();
    } else {
      setOkkLoaded(false);
    }
    // eslint-disable-next-line
  }, [step]);

  // Load other game questions (for other steps)
  useEffect(() => {
    // Just fetch general Tamil movies for other quiz rounds as before
    discoverTamilMovies({ page: 7 }).then((movies) => {
      setQuestions(movies.slice(0, TOTAL));
    });
  }, []);

  // For all non-step 0 OR if okkLoaded is false, generate normal question
  useEffect(() => {
    async function generateCombo() {
      if (step === 0 && okkLoaded && okkCombo) {
        setCombo(okkCombo);
        setReveal(false);
        setShowClues(false);
        setUserAnswer("");
        return;
      }
      // Otherwise: normal combo question (randomly negative or not, original logic)
      const q = questions[step];
      if (!q) return;
      await getMovieCast(q.id).then((cast) => {
        const names = cast
          .filter((c) => c.name)
          .slice(0, 9)
          .map((c) => c.name);
        if (Math.random() < 0.5) {
          // Standard: show actors, guess movie
          setCombo({ actors: names.slice(0, 3), movie: q.title, notIn: "" });
        } else {
          // Reverse: show 3 actors from movie + fake distractor not in movie
          // Find plausible distractors
          const plausibleDistractors = [
            "Sivakarthikeyan", "Vijay", "Vikram", "Karthi", "Suriya",
            "Arya", "Samantha Ruth Prabhu", "Anirudh Ravichander", "Jyotika"
          ];
          const notIn =
            shuffle(plausibleDistractors)
              .find(nm => !names.includes(nm) && typeof nm === "string")
            || "Sivakarthikeyan";
          setCombo({
            actors: shuffle([...names.slice(0, 3), notIn]).slice(0, 4),
            movie: q.title,
            notIn,
          });
        }
        setReveal(false);
        setShowClues(false);
        setUserAnswer("");
      });
    }
    // Always trigger on step/okkLoaded/question load
    generateCombo();
    // eslint-disable-next-line
  }, [step, questions, okkLoaded]);

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

  if ((step === 0 && !okkLoaded) || !combo.actors.length)
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
        <div>
          <div className="kq-quiz-action-bar" style={{ flexWrap: "wrap", marginBottom: 8 }}>
            {combo.actors.map((n, idx) => {
              // Feedback coloring
              let btnStyle = {
                color: userAnswer === n ? "#fff" : "#f604c2",
                background: userAnswer === n ? "#f604c2" : "#fff",
                fontWeight: 700,
                border: "2px solid #f604c2",
                minWidth: 110,
                marginBottom: 4,
                pointerEvents: reveal ? "none" : "auto",
                opacity: reveal && userAnswer !== n ? 0.65 : 1,
                transition: "background 0.17s, color 0.16s",
              };
              // If locking after submit, use feedback color
              if (reveal && userAnswer) {
                if (n === userAnswer) {
                  if (userAnswer === combo.notIn) {
                    btnStyle.background = "#1b9e38";
                    btnStyle.color = "#fff";
                    btnStyle.border = "2.5px solid #137b2c";
                    btnStyle.boxShadow = "0 0 7px #34c85a88";
                  } else {
                    btnStyle.background = "#b51b3b";
                    btnStyle.color = "#fff";
                    btnStyle.border = "2.5px solid #7c1e2f";
                    btnStyle.boxShadow = "0 0 7px #f3123888";
                  }
                }
              }
              return (
                <button
                  className="kq-btn outline"
                  key={n + idx}
                  style={btnStyle}
                  onClick={() => !reveal && setUserAnswer(n)}
                  disabled={reveal}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <div className="kq-quiz-action-bar">
            <button
              className="kq-quiz-answer-btn"
              onClick={() => setShowClues(true)}
              disabled={showClues}
            >
              Clue
            </button>
            <button
              className="kq-quiz-answer-btn reveal"
              onClick={handleReveal}
              disabled={reveal}
            >
              Reveal
            </button>
            {/* Add Submit for NOT-in questions */}
            <button
              className="kq-quiz-answer-btn"
              onClick={() => {
                if (userAnswer && !reveal) setReveal(true);
              }}
              disabled={!userAnswer || reveal}
            >
              Submit
            </button>
          </div>
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
      {!combo.notIn && (
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
          <button
            className="kq-quiz-answer-btn"
            onClick={checkAnswer}
            disabled={!userAnswer || reveal}
          >
            Submit
          </button>
        </div>
      )}
      {showClues && (
        <div className="kq-quiz-clues">
          {combo.notIn
            ? "Hint: One name above is not in the main cast!"
            : "All actors listed are starring in the same movie."}
        </div>
      )}
      {/* Feedback message for NOT-in questions after Submit */}
      {combo.notIn && reveal && userAnswer && (
        <div
          style={{
            marginTop: 9,
            color: userAnswer === combo.notIn ? "#1b9e38" : "#b51b3b",
            fontWeight: 700,
            fontSize: "1.13em",
            textAlign: "center"
          }}
        >
          {userAnswer === combo.notIn ? "Correct! 🎉" : "Incorrect."}
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
