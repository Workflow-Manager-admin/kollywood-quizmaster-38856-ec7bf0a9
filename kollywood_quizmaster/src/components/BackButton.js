import React from "react";
import { useNavigate } from "react-router-dom";

// PUBLIC_INTERFACE
/**
 * BackButton: Renders a styled back button that navigates to previous page.
 * Usage: Place at top-left or above content in main page components.
 */
function BackButton({ style = {}, className = "", label = "⬅️ Back" }) {
  const navigate = useNavigate();
  return (
    <button
      className={`kq-btn outline ${className}`}
      style={{
        position: "absolute",
        top: 18,
        left: 18,
        zIndex: 1002,
        minWidth: 80,
        fontWeight: 600,
        fontSize: "1em",
        padding: "8px 20px",
        borderRadius: 7,
        ...style,
      }}
      onClick={() => navigate(-1)}
      aria-label="Back"
      tabIndex={0}
      type="button"
    >
      {label}
    </button>
  );
}

export default BackButton;
