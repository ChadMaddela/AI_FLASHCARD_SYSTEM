import React, { useContext, useState } from "react";
import { TutorialContext } from "../context/TutorialContext";
import "../styles/MaterialsPage.css";
import "../styles/OnboardingTutorial.css";

const STUDENT_STEPS = [
  {
    title: "Welcome! 👋",
    body: "This is your Dashboard — it's where you'll study your flashcard queue. Cards are picked for you automatically, so just start answering.",
  },
  {
    title: "Materials",
    body: "See everything your teacher has uploaded and which decks are ready to study.",
  },
  {
    title: "My Analytics",
    body: "Track your mastery over time — see which topics you've got down and which need more practice.",
  },
  {
    title: "Quizzes",
    body: "Take quizzes your teacher has assigned, separate from your everyday flashcard practice.",
  },
  {
    title: "One tip before you start",
    body: "When answering a card, you'll be asked how confident you feel first. Be honest — it's not graded, and it helps you learn faster.",
  },
];

const TEACHER_STEPS = [
  {
    title: "Welcome! 👋",
    body: "This is your Control Center — upload a lecture file (PDF, DOCX, or PPTX) and the system will draft adaptive flashcards from it automatically.",
  },
  {
    title: "Review before students study",
    body: "AI-generated flashcards are drafts. Open any deck to edit or delete cards before your students rely on them.",
  },
  {
    title: "Manage Users",
    body: "Edit student and teacher accounts, including roles and passwords, from one table.",
  },
  {
    title: "Class Analytics",
    body: "See class-wide performance, per-student breakdowns, and standards-based reports (item analysis, competency mastery, TOS).",
  },
  {
    title: "One tip before you start",
    body: "Flashcard generation runs in the background and can take up to a minute — you don't need to wait on the page.",
  },
];

const OnboardingTutorial = () => {
  const { visible, role, closeTutorial } = useContext(TutorialContext);
  const [stepIndex, setStepIndex] = useState(0);

  if (!visible) return null;

  const steps = role === "teacher" ? TEACHER_STEPS : STUDENT_STEPS;
  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  const handleFinish = () => {
    setStepIndex(0);
    closeTutorial();
  };

  return (
    <div className="custom-modal-overlay">
      <div className="custom-modal-card wide-modal-card">
        <div className="tutorial-progress-dots">
          {steps.map((_, i) => (
            <span key={i} className={`tutorial-dot ${i === stepIndex ? "active" : ""}`} />
          ))}
        </div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="modal-split-actions">
          {!isLastStep ? (
            <>
              <button onClick={() => setStepIndex((i) => i + 1)} className="submit-button modal-close-btn">
                Next
              </button>
              <button onClick={handleFinish} className="submit-button modal-close-btn gray-btn">
                Skip
              </button>
            </>
          ) : (
            <button onClick={handleFinish} className="submit-button modal-close-btn">
              Got it, let's go
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingTutorial;
