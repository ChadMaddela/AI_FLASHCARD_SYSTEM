import React from "react";
import "../styles/AboutPage.css";

const TeacherSustainabilityPage = () => {
  return (
    <div className="about-page">
      <h2>Keeping This System Reliable & Accurate</h2>
      <p className="about-intro">
        A look at how this system is maintained over time, what part of that
        depends on you as the subject-matter reviewer, and what's on the
        roadmap next. Visible to teachers only.
      </p>

      <section className="about-section">
        <h3>Your role: keeping content accurate</h3>
        <p>
          AI-generated flashcards are drafts, not verified fact — you're the
          one who keeps them accurate. Periodically re-review older decks,
          especially after you update a lecture, to catch anything the AI got
          wrong or that's since gone out of date.
        </p>
        <p>
          You can edit or delete any card, AI-generated or your own, from the
          flashcard management page at any time — no extra tooling needed,
          just the review itself. When your source material changes
          significantly, re-upload it rather than hand-patching old cards
          indefinitely, so the material and the flashcards don't drift apart.
        </p>
      </section>

      <section className="about-section">
        <h3>Reporting a problem</h3>
        <p>
          If you notice the AI mislabeling topics, generating something
          incorrect, or anything about the system behaving oddly, report it
          to your system administrator with what you saw and which
          material/deck it was on. Fixes that unblock everyday classroom use
          are prioritized over new features.
        </p>
      </section>

      <section className="about-section">
        <h3>How the system stays reliable</h3>
        <ul>
          <li>Every change is tested automatically before it goes live — nothing ships without passing the existing test suite.</li>
          <li>Database changes go through a controlled migration process, with a backup taken beforehand.</li>
          <li>Dependencies and security updates are reviewed on a regular cadence rather than left indefinitely.</li>
        </ul>
      </section>

      <section className="about-section">
        <h3>What's on the roadmap</h3>
        <p>Known gaps, already tracked rather than overlooked:</p>
        <ul>
          <li>A self-service way for students to export or delete their own account data.</li>
          <li>Consent capture built directly into registration.</li>
          <li>A structured way for you to flag incorrect AI-generated content directly in the app, instead of reporting it out-of-band.</li>
          <li>Configurable data-retention windows for inactive accounts.</li>
        </ul>
      </section>
    </div>
  );
};

export default TeacherSustainabilityPage;
