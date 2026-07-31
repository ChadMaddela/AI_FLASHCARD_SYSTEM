import React, { useEffect, useState, useContext } from "react";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import LoadingScreen from "../components/LoadingScreen";
import AlertModal from "../components/AlertModal";
import "../styles/Dashboard.css";

const QUIZ_TYPE_LABELS = {
    PRETEST: "Pretest",
    POSTTEST: "Posttest",
    QUIZ: "Quiz",
};

const StudentQuizzesPage = () => {
    const { token } = useContext(AuthContext);
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);

    const [activeQuiz, setActiveQuiz] = useState(null); // { quiz_id, title, quiz_type, questions }
    const [answers, setAnswers] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [finalResult, setFinalResult] = useState(null);
    const [alertModal, setAlertModal] = useState({ show: false, type: "success", title: "", message: "" });

    const fetchQuizzes = async () => {
        try {
            const res = await api.get("/quizzes/available/", {
                headers: { Authorization: `Bearer ${token}` },
            });
            setQuizzes(res.data);
        } catch (err) {
            console.error("Failed to fetch available quizzes:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchQuizzes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const handleStartQuiz = async (quizId) => {
        try {
            const res = await api.post(`/quizzes/${quizId}/start/`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setActiveQuiz(res.data);
            setAnswers({});
            setFinalResult(null);
        } catch (err) {
            console.error("Failed to start quiz:", err);
            setAlertModal({
                show: true, type: "error", title: "Could Not Start Quiz",
                message: err.response?.data?.error || "Network Error",
            });
        }
    };

    const handleSubmitQuiz = async () => {
        setSubmitting(true);
        try {
            const payload = {
                answers: Object.entries(answers).map(([flashcard_id, selected_choice]) => ({
                    flashcard_id: Number(flashcard_id),
                    selected_choice,
                })),
            };
            const res = await api.post(`/quizzes/${activeQuiz.quiz_id}/submit/`, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setFinalResult(res.data);
            await fetchQuizzes();
        } catch (err) {
            console.error("Failed to submit quiz:", err);
            setAlertModal({
                show: true, type: "error", title: "Submit Failed",
                message: err.response?.data?.error || "Network Error",
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleBackToList = () => {
        setActiveQuiz(null);
        setAnswers({});
        setFinalResult(null);
    };

    if (loading) return <LoadingScreen message="Loading quizzes..." />;

    const alertModalNode = (
        <AlertModal
            show={alertModal.show}
            type={alertModal.type}
            title={alertModal.title}
            message={alertModal.message}
            onClose={() => setAlertModal({ ...alertModal, show: false })}
        />
    );

    // --- Taking a quiz / viewing the just-submitted result ---
    if (activeQuiz) {
        const answeredCount = Object.keys(answers).length;
        const totalQuestions = activeQuiz.questions.length;

        return (
            <div className="dashboard-hub-wrapper">
                <div className="dashboard-header">
                    <h2>{activeQuiz.title}</h2>
                    <p>{QUIZ_TYPE_LABELS[activeQuiz.quiz_type] || activeQuiz.quiz_type} — answer every question, then submit once.</p>
                </div>

                {finalResult ? (
                    <div className="analytics-reveal-panel success-tint">
                        <div className="panel-badge">✓ Quiz Submitted</div>
                        <h3>Your Score</h3>
                        <div className="analytics-metrics-grid analytics-grid-standalone">
                            <div className="metric-box">
                                <span className="metric-label">Score</span>
                                <span className="metric-val">{finalResult.score}/{finalResult.total_questions}</span>
                            </div>
                            <div className="metric-box">
                                <span className="metric-label">Percentage</span>
                                <span className="metric-val">{finalResult.score_percentage}%</span>
                            </div>
                        </div>
                        <button onClick={handleBackToList} className="submit-button">Back to Quizzes</button>
                    </div>
                ) : (
                    <div className="dashboard-main-content">
                        <div className="grid-hub-container">
                            {activeQuiz.questions.map((q, idx) => (
                                <div className="hub-card" key={q.id}>
                                    <div className="card-top-row">
                                        <span className="card-badge blue-accent">Question {idx + 1} of {totalQuestions}</span>
                                    </div>
                                    <div className="card-question-text">
                                        <p>{q.question}</p>
                                    </div>
                                    <div className="choice-grid">
                                        {Object.entries(q.choices).map(([letter, text]) => (
                                            <button
                                                key={letter}
                                                className={`choice-button ${answers[q.id] === letter ? "selected" : ""}`}
                                                disabled={submitting}
                                                onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: letter }))}
                                            >
                                                <span className="choice-letter">{letter}</span>
                                                <span className="choice-string">{text}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="quiz-submit-bar">
                            <p className="topic-meta-text">Answered {answeredCount} of {totalQuestions}</p>
                            <button
                                className="submit-button"
                                disabled={submitting || answeredCount < totalQuestions}
                                onClick={handleSubmitQuiz}
                            >
                                {submitting ? "SUBMITTING..." : "SUBMIT QUIZ"}
                            </button>
                        </div>
                    </div>
                )}
                {alertModalNode}
            </div>
        );
    }

    // --- Quiz list ---
    const grouped = quizzes.reduce((acc, q) => {
        acc[q.material_title] = acc[q.material_title] || [];
        acc[q.material_title].push(q);
        return acc;
    }, {});

    return (
        <div className="dashboard-hub-wrapper">
            <div className="dashboard-header">
                <h2>Quizzes</h2>
                <p>Pretests, posttests, and quizzes your teacher has assigned.</p>
            </div>

            {quizzes.length === 0 ? (
                <div className="empty-state-card">
                    <div className="empty-icon">📝</div>
                    <h3>No Quizzes Yet</h3>
                    <p>Your teacher hasn't assigned any quiz sessions yet.</p>
                </div>
            ) : (
                Object.entries(grouped).map(([materialTitle, materialQuizzes]) => (
                    <div key={materialTitle} className="quiz-material-group">
                        <h3 className="quiz-material-heading">{materialTitle}</h3>
                        <div className="grid-hub-container">
                            {materialQuizzes.map((q) => (
                                <div className="hub-card" key={q.id}>
                                    <div className="card-top-row">
                                        <span className="card-badge blue-accent">{QUIZ_TYPE_LABELS[q.quiz_type] || q.quiz_type}</span>
                                        <span className="mastery-indicator">{q.question_count} question{q.question_count === 1 ? "" : "s"}</span>
                                    </div>
                                    <div className="card-question-text">
                                        <p>{q.title}</p>
                                    </div>
                                    <div className="card-footer-row">
                                        {q.completed ? (
                                            <p className="topic-meta-text">Completed — Score: <span>{q.score}/{q.total_questions} ({q.score_percentage}%)</span></p>
                                        ) : (
                                            <button className="submit-button" onClick={() => handleStartQuiz(q.id)}>
                                                START QUIZ
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
            {alertModalNode}
        </div>
    );
};

export default StudentQuizzesPage;
