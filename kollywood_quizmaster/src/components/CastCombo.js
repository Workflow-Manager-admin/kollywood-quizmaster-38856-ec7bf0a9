import React, { useEffect, useState } from "react";
import { discoverTamilMovies, getMovieCast, searchMovies } from "../tmdb";
import { useNavigate } from "react-router-dom";
import QuizProgressBar from "./QuizProgressBar";

/**
 * Game: Cast Combo - guess movie for given combo of actors; reverse: who doesn't fit in given movie.
 * Now made substantially harder:
 *   - Uses supporting/minor actors in combos, rare/obscure or less popular movies from TMDb,
 *   - Distractors are frequent-appearing (but not in combo) Tamil actors from the broader pool,
 *   - Actor-not-in-movie combos prefer secondary/cameo names,
 *   - Movie guesses sometimes use "actors who never co-starred together" distractors.
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
  const [supportingActorsPool, setSupportingActorsPool] = useState([]);
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

  // Helper to get random item(s) from array, excluding specified ones
  function pickRandom(arr, count = 1, excludeList = []) {
    const unique = arr.filter(x => !excludeList.includes(x));
    for (let i = unique.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unique[i], unique[j]] = [unique[j], unique[i]];
    }
    if (count === 1) return unique[0];
    return unique.slice(0, count);
  }

  // Preload a pool of rare/supporting actor names, from multiple pages of cast members in random movies
  useEffect(() => {
    async function buildSupportingPool() {
      // Use several pages to find supporting/minor actors from lots of different films (not just stars)
      const movies = await discoverTamilMovies({ page: 10, sort_by: "release_date.asc" }).catch(() => []);
      let allSupporting = [];
      for (let i = 0; i < Math.min(12, movies.length); ++i) {
        const movie = movies[i];
        if (!movie) continue;
        const cast = await getMovieCast(movie.id).catch(() => []);
        // Exclude first 3–4 billed (make pool of usual bit/supporting/cameo actors)
        const minor = cast
          .filter((c, idx) =>
            c &&
            c.name &&
            typeof c.name === "string" &&
            idx > 2 &&
            // Exclude single-word "Doctor"/"Villager"/"Boy"/"Girl"/background
            c.name.trim().length > 4
          )
          .map(c => c.name);
        allSupporting.push(...minor);
      }
      // Remove duplicates
      setSupportingActorsPool(Array.from(new Set(allSupporting)));
    }
    buildSupportingPool();
  }, []);

  // --- Hard "not-in" question for OK Kanmani as step 0 (as before, but uses supporting pool distractor) ---
  useEffect(() => {
    async function setupOkkQn() {
      let movieId = null;
      // 1. Find TMDb id for O Kadhal Kanmani
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

      let cast = [];
      if (movieId) {
        cast = await getMovieCast(movieId).catch(() => []);
      }

      // Mix 2 main and 1 supporting/cameo
      let actorNames = (cast || [])
        .filter(c => c.name)
        .map(c => c.name);

      // Pick 2 "usual" leads and 1 less-obvious (NOT top billed)
      let mainNames = [];
      if (actorNames.includes("Dulquer Salmaan")) mainNames.push("Dulquer Salmaan");
      if (actorNames.includes("Nithya Menen")) mainNames.push("Nithya Menen");
      const supporting = pickRandom(actorNames.slice(3), 1, mainNames);
      if (supporting && !mainNames.includes(supporting)) mainNames.push(supporting);

      // Distractor: plausible Kollywood actor name not in this movie (from supporting pool if possible)
      let distractor = pickRandom(
        supportingActorsPool.length > 0
          ? supportingActorsPool
          : [
            "Sivakarthikeyan",
            "Vijay",
            "Vikram",
            "Karthi",
            "Suriya",
            "Arya",
            "Samantha Ruth Prabhu"
          ],
        1,
        actorNames
      );
      if (!distractor) distractor = "Sivakarthikeyan";

      const allOptions = shuffle([...mainNames, distractor]);
      setOkkCombo({
        actors: allOptions,
        movie: "O Kadhal Kanmani",
        notIn: distractor
      });
      setOkkLoaded(true);
    }
    // Only generate at step 0 and once actor pool is loaded
    if (step === 0 && supportingActorsPool.length > 0) {
      setupOkkQn();
    } else {
      setOkkLoaded(false);
    }
    // eslint-disable-next-line
  }, [step, supportingActorsPool]);

  // Load an obscure/rare Kollywood movie list for hard question pool
  useEffect(() => {
    // Use low-popularity/old/random page to find less-known movies
    discoverTamilMovies({
      sort_by: "vote_count.asc",
      page: 18 // deeper pages ensure obscurity
    }).then((movies) => {
      setQuestions(movies.slice(0, TOTAL)); // Chosen for obscurity
    });
  }, []);

  /**
   * Generate hard cast combo question for step > 0 (or if special not set).
   * Uses:
   *   - supporting/bit actors in the combos
   *   - for "not-in" combos: draws distractors from broader cast/bit pool, not stars
   *   - Sometimes asks for obscure movie title given uncommon combo, sometimes "which actor is NOT present" with rare/bit/secondary names
   */
  useEffect(() => {
    async function generateCombo() {
      if (step === 0 && okkLoaded && okkCombo) {
        setCombo(okkCombo);
        setReveal(false);
        setShowClues(false);
        setUserAnswer("");
        return;
      }
      // Otherwise, choose question type randomly (but weighted towards harder)
      const q = questions[step];
      if (!q) return;
      let cast = [];
      try {
        cast = await getMovieCast(q.id);
      } catch {
        cast = [];
      }
      if (!Array.isArray(cast) || cast.length < 6) {
        // fallback: just 3 names
        const names = cast.map(c => c.name).filter(Boolean);
        setCombo({
          actors: shuffle(names.slice(0, 3)),
          movie: q.title,
          notIn: ""
        });
        setReveal(false);
        setShowClues(false);
        setUserAnswer("");
        return;
      }

      // Split main and deep supporting actors
      const mains = cast.slice(0, 3).map((c) => c.name);
      const supportings = cast.slice(4).map((c) => c.name).filter(Boolean);
      // Give a 2/3 chance for hard mode: supporting/cameo based question, else fallback to "mains"
      const isNotIn = Math.random() < 0.6;

      if (isNotIn && supportings.length > 0 && supportingActorsPool.length > 6) {
        // Reverse: "pick actor not present" out of a combo with 2 supportings + 1 plausible name as a difficult distractor
        const fromMovie = shuffle(pickRandom(supportings, 2));
        const inThisMovie = mains.length ? shuffle(mains)[0] : supportings[0];
        const pickedNames = shuffle([...fromMovie, inThisMovie]).slice(0, 3);

        // Distractor is a supporting actor (from Kollywood supporting pool, not in current movie)
        let distract = pickRandom(supportingActorsPool, 1, [...cast.map(c => c.name), ...pickedNames]);
        if (!distract) distract = "T. M. Karthik"; // fallback: actual Kollywood bit/cameo actor

        // Shuffle and insert
        const options = shuffle([...pickedNames, distract]);
        setCombo({
          actors: options.slice(0, 4),
          movie: q.title,
          notIn: distract
        });
      } else {
        // Forward: guess (possibly obscure) movie from an unusual supporting cast combo
        let trio = shuffle(supportings).slice(0, 2);
        if (trio.length < 2) trio = mains.slice(0, 2);
        // Add one main or another supporting/bit actor
        const add = pickRandom([...mains, ...supportings], 1, trio);
        const actorsCombo = shuffle([...trio, add]);
        setCombo({
          actors: actorsCombo.slice(0, 3),
          movie: q.title,
          notIn: ""
        });
      }
      setReveal(false);
      setShowClues(false);
      setUserAnswer("");
    }
    generateCombo();
    // eslint-disable-next-line
  }, [step, questions, okkLoaded, supportingActorsPool]);

  // PUBLIC_INTERFACE
  function checkAnswer(autoAdvance = false) {
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
    setReveal(true);
    setShowClues(true);
    // After feedback, move to next after delay
    setTimeout(() => {
      setReveal(false);
      setShowClues(false);
      setUserAnswer("");
      if (step + 1 === TOTAL) {
        navigate("/summary/cast-combo", { state: { results: res } });
      } else {
        setStep(step + 1);
      }
    }, 1600); // Feedback visible for 1.6 seconds
  }

  function handleReveal() {
    if (reveal) return;
    setReveal(true);
    setShowClues(true);
    setTimeout(() => {
      checkAnswer(true);
    }, 1400);
  }

  if ((step === 0 && !okkLoaded) || !combo.actors.length)
    return (
      <div className="kq-quiz-panel kq-center" style={{ marginTop: 25 }}>
        Loading...
      </div>
    );

  return (
    <div style={{ position: "relative" }}>
      <BackButton />
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
                if (userAnswer && !reveal) checkAnswer(true);
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
            onChange={e => !reveal && setUserAnswer(e.target.value)}
            disabled={reveal}
            autoFocus
          />
        </div>
      )}
      {/* Only show main action bar if not a NOT-in combo */}
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
            onClick={() => {
              if (!reveal && userAnswer) checkAnswer(true);
            }}
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
          {/* Feedback auto-advance handled in logic above */}
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

// PUBLIC_INTERFACE
export default CastCombo;
