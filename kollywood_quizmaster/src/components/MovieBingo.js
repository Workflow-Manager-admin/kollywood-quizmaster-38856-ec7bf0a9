import React, { useState } from "react";

function DemoBingo({ questions: initialQuestions }) {
  // Reimplement basic grid for demo using passed-in questions.
  // Each question: { qText, options, correctIdx, userPick, locked }
  const GRID_SIZE = 3;
  const [questions, setQuestions] = useState(initialQuestions);

  function handleAnswer(qIdx, optIdx) {
    if (questions[qIdx].locked) return;
    const correct = questions[qIdx].correctIdx === optIdx;
    const updatedQuestions = questions.map((q, idx) =>
      idx === qIdx
        ? { ...q, userPick: optIdx, locked: true }
        : q
    );
    setQuestions(updatedQuestions);
  }

  function getGridRows(arr, size) {
    let out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function getBtnColor(q, idx) {
    if (!q.locked) return {};
    if (q.userPick !== idx) {
      return { opacity: 0.54 };
    }
    if (idx === q.correctIdx) {
      return {
        background: "#1b9e38",
        color: "#fff",
        borderColor: "#137b2c",
        boxShadow: "0 0 7px #34c85a88"
      };
    } else {
      return {
        background: "#b51b3b",
        color: "#fff",
        borderColor: "#7c1e2f",
        boxShadow: "0 0 7px #f3123888"
      };
    }
  }

  return (
    <div>
      <div>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gap: 19,
          margin: "15px auto 7px auto",
          maxWidth: 780
        }}>
          {getGridRows(questions, GRID_SIZE).map((row, rowIdx) =>
            row.map((q, colIdx) => (
              <div
                key={`${rowIdx}-${colIdx}`}
                style={{
                  background: "#faeff9",
                  borderRadius: 10,
                  boxShadow: "var(--kq-shadow)",
                  padding: "18px 12px 16px 12px",
                  minWidth: 0,
                  minHeight: 140,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  alignItems: "stretch",
                  opacity: q.locked ? 0.99 : 1,
                  border: "2px solid #f604c2"
                }}
              >
                <div style={{ minHeight: 48, marginBottom: 6, fontWeight: 600, color: "#0b0a0a", fontSize: "1.06em"}}>
                  {q.qText}
                </div>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                  marginTop: 2,
                  alignItems: "stretch"
                }}>
                  {q.options.map((opt, idx) => (
                    <button
                      key={opt}
                      className="kq-btn outline"
                      style={{
                        ...{
                          color: "#f604c2",
                          background: "#fff",
                          fontWeight: 700,
                          border: "2px solid #f604c2",
                          borderRadius: 8,
                          fontSize: "1.03em",
                          padding: "7px 8px",
                          opacity: q.locked && q.userPick !== idx ? 0.51 : 1,
                          marginBottom: 2,
                          pointerEvents: q.locked ? "none" : "auto",
                          transition: "all 0.15s"
                        },
                        ...(q.locked ? getBtnColor(q, idx) : {})
                      }}
                      disabled={q.locked}
                      onClick={() => handleAnswer(rowIdx * GRID_SIZE + colIdx, idx)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {(q.locked && q.userPick != null) && (
                  <div style={{
                    marginTop: 7,
                    color: (q.userPick === q.correctIdx) ? "#1b9e38" : "#b51b3b",
                    fontWeight: 700,
                    textAlign: 'center'
                  }}>
                    {q.userPick === q.correctIdx ? "Correct! 🎉" : "Incorrect."}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <div style={{marginTop: 15, marginBottom: -3}}>
          <div className="kq-progress-label">
            Progress: {questions.filter(q => q.locked).length} / {questions.length}
          </div>
          <div className="kq-progress-bar-bg">
            <div className="kq-progress-bar" style={{
              width: `${Math.round((questions.filter(q => q.locked).length / questions.length) * 100)}%`
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default DemoBingo;
