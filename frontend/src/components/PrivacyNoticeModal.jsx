import React from "react";
import { Link } from "react-router-dom";
import "../styles/MaterialsPage.css";

const PrivacyNoticeModal = ({ show, onAcknowledge }) => {
  if (!show) return null;

  return (
    <div className="custom-modal-overlay">
      <div className="custom-modal-card wide-modal-card">
        <h3>Before you continue</h3>
        <div className="privacy-notice-body">
          <p>This system collects and uses a few things to work properly:</p>
          <ul>
            <li>Your account info (username, optional email) and study activity, to power your flashcard schedule and analytics.</li>
            <li>Teacher-uploaded lecture text is sent to an AI service (Google Gemini) to draft flashcards — never your name, scores, or answers.</li>
            <li>Flashcards are AI-drafted, then reviewed by your teacher before you study them.</li>
          </ul>
          <p>You can read the full details anytime from the Privacy Policy link on this page.</p>
        </div>
        <div className="modal-split-actions">
          <button onClick={onAcknowledge} className="submit-button modal-close-btn">
            I Understand, Continue
          </button>
        </div>
        <Link to="/privacy" className="privacy-modal-link">
          Read the full Privacy Policy
        </Link>
      </div>
    </div>
  );
};

export default PrivacyNoticeModal;
