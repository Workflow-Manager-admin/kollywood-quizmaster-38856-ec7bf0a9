import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Patch global variable to provide PUBLIC_URL if referenced in templates
if (typeof PUBLIC_URL === 'undefined' && typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL) {
  // eslint-disable-next-line no-undef
  window.PUBLIC_URL = process.env.PUBLIC_URL;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
