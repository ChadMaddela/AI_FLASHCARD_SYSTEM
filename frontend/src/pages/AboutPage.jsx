import React from "react";
import { Link } from "react-router-dom";
import "../styles/AboutPage.css";

const AboutPage = () => {
  return (
    <div className="about-page">
      <h2>About the AI Flashcard System</h2>
      <p className="about-intro">
        A study platform built for teachers and students — teachers upload
        lecture materials, and the system turns them into flashcards that
        adjust to what each student actually knows.
      </p>

      <section className="about-section">
        <h3>How it adapts to you</h3>
        <p>
          Every flashcard keeps track of how well you know it. Cards you get
          wrong, or aren't sure about, come back sooner. Cards you consistently
          get right start showing up less often. This is called{" "}
          <strong>spaced repetition</strong> — instead of studying everything
          equally, your time goes toward what you actually need to practice.
        </p>
        <p>
          If you're struggling with a topic, the system also holds back on
          introducing brand-new cards until you've caught up — so you're
          never buried under more material than you can handle at once.
        </p>
      </section>

      <section className="about-section">
        <h3>Why we ask how confident you are</h3>
        <p>
          Before you see the answer, you'll be asked to rate how confident
          you feel: <em>Guessing</em>, <em>Unsure</em>, or <em>Confident</em>.
          This isn't graded — it's there to help <strong>you</strong> notice
          the difference between things you truly know and things you're
          just recognizing. Comparing your confidence to your actual accuracy
          is one of the most effective ways to study smarter, not just harder.
        </p>
      </section>

      <section className="about-section">
        <h3>Built on how memory actually works</h3>
        <p>
          The system leans on three ideas with strong research behind them:
        </p>
        <ul>
          <li>
            <strong>Retrieval practice</strong> — actively trying to recall an
            answer (instead of just re-reading notes) builds stronger memory.
          </li>
          <li>
            <strong>Spaced repetition</strong> — reviewing material at
            increasing intervals beats cramming everything at once.
          </li>
          <li>
            <strong>Immediate feedback</strong> — finding out right away
            whether you were correct helps the lesson stick.
          </li>
        </ul>
      </section>

      <section className="about-section">
        <h3>About the AI-generated content</h3>
        <p>
          Flashcards are drafted by AI (Google Gemini) from a teacher's
          uploaded material, but every card stays fully editable — teachers
          review, fix, or remove AI-generated cards before students rely on
          them. The AI drafts; the teacher decides what's accurate.
        </p>
      </section>

      <section className="about-section">
        <h3>What you need to use it</h3>
        <p>
          Just a modern browser (Chrome, Edge, or Firefox) and an internet
          connection — nothing to install. It works on desktop, laptop, or
          tablet.
        </p>
      </section>

      <p className="about-footer-link">
        Curious how your data is handled? Read the{" "}
        <Link to="/privacy">Privacy Policy</Link>.
      </p>
    </div>
  );
};

export default AboutPage;
