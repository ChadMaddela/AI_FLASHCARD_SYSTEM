import React, { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { TutorialContext } from "../context/TutorialContext";
import "../styles/AboutPage.css";

const HelpPage = () => {
  const { token } = useContext(AuthContext);
  const { openTutorial } = useContext(TutorialContext);

  return (
    <div className="about-page">
      <h2>Help &amp; FAQ</h2>
      <p className="about-intro">
        Answers to common questions, what to do when something goes wrong,
        and what you need to use the system.
      </p>

      {token && (
        <section className="about-section">
          <h3>Need a refresher?</h3>
          <p>Replay the guided tour of your dashboard anytime.</p>
          <button onClick={openTutorial} className="submit-button edit-btn">
            ▶️ Replay Tutorial
          </button>
        </section>
      )}

      <section className="about-section">
        <h3>System requirements</h3>
        <ul>
          <li>A modern browser — Chrome, Edge, or Firefox (latest version recommended).</li>
          <li>An active internet connection. Nothing needs to be installed.</li>
          <li>Works on desktop, laptop, or tablet. Phone screens work but aren't optimized for the flashcard view.</li>
        </ul>
      </section>

      <section className="about-section">
        <h3>My flashcards aren't showing up after I uploaded a file</h3>
        <p>
          Flashcard generation runs in the background and can take up to a
          minute for longer files — the Materials list shows "Processing"
          while it works. Wait a moment and refresh the page. If it shows
          "Failed," try re-uploading the file; if it keeps failing, contact
          your system administrator.
        </p>
      </section>

      <section className="about-section">
        <h3>I can't log in</h3>
        <p>
          Double-check your username and password — use the eye icon on the
          password field to confirm what you've typed. If you've forgotten
          your password, ask your teacher or administrator to reset it from
          the Manage Users page.
        </p>
      </section>

      <section className="about-section">
        <h3>The page won't load or looks broken</h3>
        <p>
          Try refreshing the page first. If that doesn't help, check your
          internet connection. If the problem happens on multiple devices,
          the service may be briefly down — try again in a few minutes, or
          contact your administrator if it continues.
        </p>
      </section>

      <section className="about-section">
        <h3>Did I lose my progress when my connection dropped?</h3>
        <p>
          No — each answer is saved as soon as you submit it. If your
          connection drops mid-session, just reconnect and continue; only an
          answer that never finished submitting would need to be redone.
        </p>
      </section>

      <section className="about-section">
        <h3>Who do I contact for help?</h3>
        <p>
          Start with your teacher — they can escalate to the system
          administrator if it's something they can't resolve directly.
        </p>
      </section>
    </div>
  );
};

export default HelpPage;
