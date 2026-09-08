import React from "react";
import { Link } from "react-router-dom";
import "../styles/AboutPage.css";

const PrivacyPage = () => {
  return (
    <div className="about-page">
      <h2>Privacy Policy</h2>
      <p className="about-intro">
        A plain-language summary of what this system collects, how AI is
        used, and where your data lives. It's written to be readable without
        a technical background.
      </p>

      <section className="about-section">
        <h3>What we collect</h3>
        <ul>
          <li>
            <strong>Account info</strong> — your username, an optional email,
            and your role (student/teacher). Your password is never stored in
            readable form.
          </li>
          <li>
            <strong>Uploaded materials</strong> — files a teacher uploads,
            used to generate flashcards.
          </li>
          <li>
            <strong>Study activity</strong> — which flashcards you've
            answered, whether you got them right, and your confidence ratings.
            This is what powers the adaptive scheduling and your analytics.
          </li>
        </ul>
        <p>
          We don't collect payment information, precise location, or device
          fingerprinting of any kind.
        </p>
      </section>

      <section className="about-section">
        <h3>How AI (Google Gemini) is used</h3>
        <p>
          When a teacher uploads a lecture file, only the extracted text of
          that material is sent to Gemini to generate flashcards — never
          student names, scores, or confidence ratings. The AI's output
          becomes draft flashcards that a teacher can review, edit, or delete
          before students see them.
        </p>
      </section>

      <section className="about-section">
        <h3>Where your data lives</h3>
        <p>
          Account info, materials, flashcards, and your study activity are
          stored in a managed, access-controlled database. Uploaded files are
          stored in secure cloud storage. Your login session is kept in your
          browser only for as long as you're signed in.
        </p>
      </section>

      <section className="about-section">
        <h3>Data retention — where we're honest about a current gap</h3>
        <p>
          There is currently no self-service option to export or delete your
          own account and study history. If you'd like your data removed,
          reach out to your teacher or system administrator directly. Closing
          this gap with a proper self-service option is an acknowledged item
          on the system's roadmap.
        </p>
      </section>

      <section className="about-section">
        <h3>Our commitments on AI use</h3>
        <ul>
          <li>AI drafts flashcards — a teacher always has final say over what's accurate.</li>
          <li>You should always be told that flashcards may be AI-generated and instructor-reviewed.</li>
          <li>The system never auto-grades open-ended reasoning — only objective recall.</li>
        </ul>
      </section>

      <p className="about-footer-link">
        Read more <Link to="/about">about the system</Link>.
      </p>
    </div>
  );
};

export default PrivacyPage;
