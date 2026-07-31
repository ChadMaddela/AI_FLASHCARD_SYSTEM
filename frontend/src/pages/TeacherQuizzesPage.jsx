import React, { useEffect, useState, useContext } from "react";
import { useParams, useLocation } from "react-router-dom";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import LoadingScreen from "../components/LoadingScreen";
import AlertModal from "../components/AlertModal";
import "../styles/MaterialsPage.css";

const QUIZ_TYPE_LABELS = {
    PRETEST: "Pretest",
    POSTTEST: "Posttest",
    QUIZ: "Quiz",
};

const TeacherQuizzesPage = () => {
    const { token } = useContext(AuthContext);
    const { materialId } = useParams();
    const location = useLocation();

    const [materialTitle, setMaterialTitle] = useState(location.state?.materialTitle || "");
    const [mcqFlashcards, setMcqFlashcards] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    const [newQuiz, setNewQuiz] = useState({ title: "", quiz_type: "QUIZ", flashcard_ids: [] });
    const [resultsByQuiz, setResultsByQuiz] = useState({});
    const [expandedQuizId, setExpandedQuizId] = useState(null);

    const [improvement, setImprovement] = useState(null);
    const [showImprovement, setShowImprovement] = useState(false);

    const [alertModal, setAlertModal] = useState({ show: false, type: "success", title: "", message: "" });

    const fetchQuizzes = async () => {
        const res = await api.get(`/materials/${materialId}/quizzes/`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        setQuizzes(res.data);
    };

    useEffect(() => {
        const fetchPageData = async () => {
            setLoading(true);
            try {
                const flashcardsRes = await api.get(`/materials/${materialId}/flashcards/`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const all = Array.isArray(flashcardsRes.data) ? flashcardsRes.data : [];
                setMcqFlashcards(all.filter((f) => f.card_type === "MCQ"));
                await fetchQuizzes();
            } catch (err) {
                console.error("Failed to load quiz management data:", err);
            } finally {
                setLoading(false);
            }
        };
        if (token && materialId) fetchPageData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [materialId, token]);

    const toggleFlashcardSelection = (id) => {
        setNewQuiz((prev) => ({
            ...prev,
            flashcard_ids: prev.flashcard_ids.includes(id)
                ? prev.flashcard_ids.filter((fid) => fid !== id)
                : [...prev.flashcard_ids, id],
        }));
    };

    const handleCreateQuiz = async () => {
        if (!newQuiz.title.trim()) {
            setAlertModal({ show: true, type: "error", title: "Missing Title", message: "Please give this quiz a title." });
            return;
        }
        if (newQuiz.flashcard_ids.length === 0) {
            setAlertModal({ show: true, type: "error", title: "No Questions Selected", message: "Select at least one MCQ flashcard to include." });
            return;
        }

        setIsCreating(true);
        try {
            await api.post(
                "/quizzes/create/",
                { material: materialId, title: newQuiz.title, quiz_type: newQuiz.quiz_type, flashcard_ids: newQuiz.flashcard_ids },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setNewQuiz({ title: "", quiz_type: "QUIZ", flashcard_ids: [] });
            await fetchQuizzes();
            setAlertModal({ show: true, type: "success", title: "Quiz Created 🎉", message: "The quiz session is ready for students." });
        } catch (err) {
            console.error(err);
            setAlertModal({ show: true, type: "error", title: "Creation Failed ❌", message: "Failed to create the quiz. Please try again." });
        } finally {
            setIsCreating(false);
        }
    };

    const handleToggleActive = async (quiz) => {
        try {
            const res = await api.patch(`/quizzes/${quiz.id}/toggle/`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setQuizzes(quizzes.map((q) => (q.id === quiz.id ? res.data : q)));
        } catch (err) {
            console.error("Failed to toggle quiz active state:", err);
        }
    };

    const handleViewResults = async (quizId) => {
        if (expandedQuizId === quizId) {
            setExpandedQuizId(null);
            return;
        }
        try {
            const res = await api.get(`/quizzes/${quizId}/results/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setResultsByQuiz((prev) => ({ ...prev, [quizId]: res.data }));
            setExpandedQuizId(quizId);
        } catch (err) {
            console.error("Failed to fetch quiz results:", err);
        }
    };

    const handleShowImprovement = async () => {
        if (showImprovement) {
            setShowImprovement(false);
            return;
        }
        try {
            const res = await api.get(`/materials/${materialId}/quiz-improvement/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setImprovement(res.data);
            setShowImprovement(true);
        } catch (err) {
            console.error("Failed to fetch improvement data:", err);
        }
    };

    if (loading) return <LoadingScreen message="Loading quiz management..." />;

    return (
        <div className="flashcards-container">
            <h2>Quiz Sessions for {materialTitle || `Material ${materialId}`}</h2>
            <div className="flashcards-layout">

                {/* Create Form Sidebar */}
                <div className="new-flashcard-pane">
                    <h3>Create New Quiz Session</h3>
                    <div className="form-grid">
                        <div className="form-field-block">
                            <label>TITLE:</label>
                            <input
                                type="text"
                                disabled={isCreating}
                                placeholder="e.g., Pretest — Circulatory System"
                                className="dark-input-box"
                                value={newQuiz.title}
                                onChange={(e) => setNewQuiz({ ...newQuiz, title: e.target.value })}
                            />
                        </div>

                        <div className="form-field-block">
                            <label>QUIZ TYPE:</label>
                            <select
                                disabled={isCreating}
                                className="dark-input-box"
                                value={newQuiz.quiz_type}
                                onChange={(e) => setNewQuiz({ ...newQuiz, quiz_type: e.target.value })}
                            >
                                <option value="PRETEST">Pretest (before flashcard practice)</option>
                                <option value="POSTTEST">Posttest (after flashcard practice)</option>
                                <option value="QUIZ">Quiz (general)</option>
                            </select>
                        </div>

                        <div className="form-field-block">
                            <label>SELECT MCQ QUESTIONS ({newQuiz.flashcard_ids.length} selected):</label>
                            {mcqFlashcards.length === 0 ? (
                                <p className="no-cards-notice">No MCQ flashcards exist for this material yet.</p>
                            ) : (
                                <div className="quiz-question-checklist">
                                    {mcqFlashcards.map((f) => (
                                        <label key={f.id} className="quiz-question-checkbox-row">
                                            <input
                                                type="checkbox"
                                                disabled={isCreating}
                                                checked={newQuiz.flashcard_ids.includes(f.id)}
                                                onChange={() => toggleFlashcardSelection(f.id)}
                                            />
                                            <span>{f.question}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={handleCreateQuiz}
                        disabled={isCreating}
                        className={`submit-button create-btn ${isCreating ? "btn-disabled" : ""}`}
                    >
                        {isCreating ? "⏳ Creating..." : "➕ Create Quiz Session"}
                    </button>
                </div>

                {/* Quiz List */}
                <div className="flashcards-scroll">
                    <button onClick={handleShowImprovement} className="submit-button edit-btn improvement-toggle-btn">
                        📈 {showImprovement ? "Hide" : "View"} Pretest → Posttest Improvement
                    </button>

                    {showImprovement && improvement && (
                        <div className="premium-flashcard-card">
                            <h3 className="premium-card-question">Class Improvement</h3>
                            <div className="analytics-metrics-grid-inline">
                                <div className="metric-box">
                                    <span className="metric-label">Class Avg Pretest</span>
                                    <span className="metric-val">{improvement.class_average_pretest}%</span>
                                </div>
                                <div className="metric-box">
                                    <span className="metric-label">Class Avg Posttest</span>
                                    <span className="metric-val">{improvement.class_average_posttest}%</span>
                                </div>
                                <div className="metric-box">
                                    <span className="metric-label">Class Avg Improvement</span>
                                    <span className="metric-val">{improvement.class_average_improvement}%</span>
                                </div>
                            </div>
                            {improvement.students.length === 0 ? (
                                <p className="no-cards-notice">No students have completed both a pretest and posttest for this material yet.</p>
                            ) : (
                                <table className="analytics-topic-table">
                                    <thead>
                                        <tr>
                                            <th>Student</th>
                                            <th>Pretest</th>
                                            <th>Posttest</th>
                                            <th>Improvement</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {improvement.students.map((row) => (
                                            <tr key={row.student_id}>
                                                <td>{row.username}</td>
                                                <td>{row.pretest_percentage}%</td>
                                                <td>{row.posttest_percentage}%</td>
                                                <td>{row.improvement > 0 ? "+" : ""}{row.improvement}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {quizzes.length === 0 ? (
                        <p className="no-cards-notice">No quiz sessions created for this material yet.</p>
                    ) : (
                        quizzes.map((quiz) => (
                            <div key={quiz.id} className="premium-flashcard-card">
                                <div className="card-badge-row">
                                    <span className="badge active-badge">{QUIZ_TYPE_LABELS[quiz.quiz_type] || quiz.quiz_type}</span>
                                    <span className="badge topic-badge">{quiz.question_count} question{quiz.question_count === 1 ? "" : "s"}</span>
                                    <span className={`badge ${quiz.is_active ? "type-badge" : ""}`}>
                                        {quiz.is_active ? "Open to students" : "Closed"}
                                    </span>
                                </div>
                                <h3 className="premium-card-question">{quiz.title}</h3>
                                <div className="premium-card-footer">
                                    <div className="flashcard-actions">
                                        <button onClick={() => handleToggleActive(quiz)} className="submit-button edit-btn">
                                            {quiz.is_active ? "🔒 Close" : "🔓 Open"}
                                        </button>
                                        <button onClick={() => handleViewResults(quiz.id)} className="submit-button edit-btn">
                                            {expandedQuizId === quiz.id ? "Hide Results" : "📊 View Results"}
                                        </button>
                                    </div>
                                </div>

                                {expandedQuizId === quiz.id && resultsByQuiz[quiz.id] && (
                                    resultsByQuiz[quiz.id].length === 0 ? (
                                        <p className="no-cards-notice">No students have taken this quiz yet.</p>
                                    ) : (
                                        <table className="analytics-topic-table">
                                            <thead>
                                                <tr>
                                                    <th>Student</th>
                                                    <th>Score</th>
                                                    <th>Percentage</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {resultsByQuiz[quiz.id].map((attempt) => (
                                                    <tr key={attempt.id}>
                                                        <td>{attempt.student_username}</td>
                                                        <td>{attempt.completed_at ? `${attempt.score}/${attempt.total_questions}` : "In progress"}</td>
                                                        <td>{attempt.completed_at ? `${attempt.score_percentage}%` : "—"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Alert Modal */}
            <AlertModal
                show={alertModal.show}
                type={alertModal.type}
                title={alertModal.title}
                message={alertModal.message}
                onClose={() => setAlertModal({ ...alertModal, show: false })}
            />
        </div>
    );
};

export default TeacherQuizzesPage;
