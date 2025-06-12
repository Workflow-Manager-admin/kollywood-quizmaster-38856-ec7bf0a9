import React from "react";

// PUBLIC_INTERFACE
function QuizProgressBar({ step, total }) {
  const percent = Math.round(((step + 1) / total) * 100);
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="kq-progress-label">
        Progress: {step + 1} / {total}
      </div>
      <div className="kq-progress-bar-bg">
        <div className="kq-progress-bar" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default QuizProgressBar;
