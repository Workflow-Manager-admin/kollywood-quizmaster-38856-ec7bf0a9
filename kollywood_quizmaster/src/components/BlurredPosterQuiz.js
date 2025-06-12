import React, { useState, useEffect } from "react";
import { getPosterUrl, discoverTamilMovies, getMovieDetails } from "../tmdb";
import QuizProgressBar from "./QuizProgressBar";
import { useNavigate } from "react-router-dom";

/**
 * Game: Blurred Poster Quiz
 * 10 questions: guess movie by poster (blurred), two clues, reveal button, progress, show results on finish.
 */
// PUBLIC_INTERFACE
function BlurredPosterQuiz() {
  const TOTAL = 10;
  const [questions, setQuestions] = useState([]);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState("");
  const [showClues, setShowClues] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch a list of Tamil movies and set up questions
    setLoading(true);
    discoverTamilMovies({ sort_by: "popularity.desc", page: 2 })
      .then((movies) => {
        // Pick 10 with posters & titles
        const filtered = movies.filter(
          (m) => m.poster_path && m.title
        );
        // Shuffle
        for (let i = filtered.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
        }
        return filtered.slice(0, TOTAL);
      })
      .then(async (list) => {
        // Enrich with clues (overview and release date)
        const detailsList = await Promise.all(
          list.map((m) =>
            getMovieDetails(m.id).then((d) => ({
              ...m,
              overview: d.overview || "",
              release_date: d.release_date || "",
            }))
          )
        );
        setQuestions(detailsList);
        setLoading(false);
      })
      .catch(() => {
        setError(
          "Failed to load quiz data. Please refresh and try again."
        );
        setLoading(false);
      });
  }, []);

  function checkAnswer() {
    const q = questions[step];
    const correct =
      answer.trim().toLowerCase() === q.title.trim().toLowerCase();
    setResults([
      ...results,
      {
        correct,
        answer: answer.trim(),
        solution: q.title,
        poster: q.poster_path,
      },
    ]);
    setAnswer("");
    setShowClues(false);
    setReveal(false);
    if (step + 1 === TOTAL) {
      navigate("/summary/blurred-poster", { state: { results: [...results, { correct, answer: answer.trim(), solution: q.title, poster: q.poster_path }] } });
    } else {
      setStep(step + 1);
    }
  }

  function handleReveal() {
    setReveal(true);
    setShowClues(true);
    setTimeout(() => {
      // Go to next after 2 secs
      checkAnswer();
    }, 1800);
  }

  if (loading)
    return (
      <div className="kq-center kq-mt25">
        <div className="kq-quiz-panel">Loading quiz...<br />🎬</div>
      </div>
    );
  if (error)
    return (
      <div className="kq-center kq-mt25">
        <div className="kq-quiz-panel" style={{ color: "#b51b3b" }}>{error}</div>
      </div>
    );

  const q = questions[step];
  return (
    <div>
      <div className="kq-quiz-panel">
        <QuizProgressBar step={step} total={TOTAL} />
        <img
          src={getPosterUrl(q.poster_path, "w342")}
          alt="Poster"
          className="kq-quiz-image-blur"
          style={{ margin: "auto", display: "block" }}
        />
        <div className="kq-quiz-answer-row">
          <input
            type="text"
            className="kq-input"
            placeholder="Movie Title"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={reveal}
            autoFocus
          />
          <button className="kq-quiz-answer-btn" onClick={checkAnswer} disabled={!answer || reveal}>
            Submit
          </button>
        </div>
        <div className="kq-quiz-action-bar">
          <button
            className="kq-quiz-answer-btn"
            onClick={() => setShowClues(!showClues)}
            disabled={showClues}
          >
            {showClues ? "Clue given" : "Show Clues"}
          </button>
          <button
            className="kq-quiz-answer-btn reveal"
            onClick={handleReveal}
            disabled={reveal}
          >
            Reveal
          </button>
        </div>
        {showClues && (
          <div className="kq-quiz-clues">
            <ul>
              <li>
                <b>Clue 1:</b> {q.overview ? q.overview.slice(0, 80) + "..." : "No overview"}
              </li>
              <li>
                <b>Clue 2:</b> Year: {q.release_date ? q.release_date.slice(0, 4) : "?"}
              </li>
            </ul>
          </div>
        )}
        {reveal && (
          <div
            style={{
              background: "#f8e7f4",
              marginTop: 16,
              borderRadius: 7,
              padding: 10,
              textAlign: "center",
              color: "#b51b3b",
              fontWeight: 600,
            }}
          >
            The answer is: {q.title}
          </div>
        )}
      </div>
    </div>
  );
}

export default BlurredPosterQuiz;
