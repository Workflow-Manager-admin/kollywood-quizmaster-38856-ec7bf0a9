import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

/*
 * No direct usage of PUBLIC_URL here (must use process.env.PUBLIC_URL for React scripts).
 * If you see any usage of PUBLIC_URL, replace with process.env.PUBLIC_URL.
 */
// No PUBLIC_URL usage here; kept as-is

// Confirmed: No PUBLIC_URL direct usage in this file as required by the project.

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
