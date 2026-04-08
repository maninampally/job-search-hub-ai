import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import "./styles/app.css";

// Handle unhandled promise rejections gracefully
window.addEventListener("unhandledrejection", (event) => {
  // Only log non-extension-related errors
  if (event.reason?.message && !event.reason.message.includes("message channel")) {
    console.error("Unhandled promise rejection:", event.reason);
  }
});

// Suppress known extension-related errors from console
const originalError = console.error;
console.error = function (...args) {
  const message = String(args[0] || "");
  // Suppress known extension errors
  if (message.includes("checkSupportDomain") || message.includes("message channel closed")) {
    return;
  }
  originalError.apply(console, args);
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
