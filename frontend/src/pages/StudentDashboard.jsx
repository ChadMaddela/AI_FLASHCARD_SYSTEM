import React, { useState, useEffect, useContext, useCallback } from "react";
import { useLocation } from "react-router-dom";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import ClozeText from "../components/ClozeText";
import LoadingScreen from "../components/LoadingScreen";
import AlertModal from "../components/AlertModal";
import "../styles/Dashboard.css";

const StudentDashboard = () => {
  const location = useLocation();

  const [queue, setQueue] = useState([]);
  const [materials, setMaterials] = useState([]);
  // ✅ Default is "All" — not the first material
  const [selectedMaterialId, setSelectedMaterialId] = useState("All");
  const [materialUrl, setMaterialUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [alertModal, setAlertModal] = useState({ show: false, type: "success", title: "", message: "" });
  const [result, setResult] = useState(null);
  const [selectedChoice, setSelectedChoice] = useState({});
  const [revealed, setRevealed] = useState({});
  const [confidence, setConfidence] = useState({});

  const { token, usernameState } = useContext(AuthContext);

  const activeName = usernameState || localStorage.getItem("username") || "Student";
  const firstName = activeName.split(/[_ ]/)[0];
  const personalizedName =
    firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

  // ── Queue loader ──────────────────────────────────────────────────────────
  // For "All": fetch every material's queue in parallel and merge results.
  // For a specific material: fetch that material's queue directly.
  const fetchQueue = useCallback(
    async (currentMaterialId, materialsList) => {
      const activeToken = token || localStorage.getItem("token");

      try {
        if (currentMaterialId === "All" || !currentMaterialId) {
          // No /materials/queue/ backend route — fetch each in parallel and merge
          const sources = materialsList && materialsList.length > 0
            ? materialsList
            : materials;

          if (sources.length === 0) {
            setQueue([]);
            setMaterialUrl("");
            return;
          }

          const responses = await Promise.all(
            sources.map((mat) =>
              api
                .get(`/materials/${mat.id}/queue/`, {
                  headers: { Authorization: `Bearer ${activeToken}` },
                })
                .catch(() => null) // Don't let one failure kill the rest
            )
          );

          const merged = responses.flatMap((res) =>
            res ? res.data.queue || res.data.flashcards || [] : []
          );

          setQueue(merged);
          setMaterialUrl(""); // No single file URL when viewing all
        } else {
          // Specific material
          const res = await api.get(`/materials/${currentMaterialId}/queue/`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          });

          setQueue(res.data.queue || res.data.flashcards || []);

          if (res.data.material_file_url) {
            setMaterialUrl(res.data.material_file_url);
          } else if (res.data.file_url) {
            setMaterialUrl(res.data.file_url);
          } else {
            setMaterialUrl("");
          }
        }
      } catch (err) {
        console.error("Failed to fetch queue:", err);
        setQueue([]);
      }
    },
    [token, materials]
  );

  // ── Boot sequence ─────────────────────────────────────────────────────────
  // Fetch materials list, then:
  // - If MaterialsPage sent us here with a specific materialId via location.state, use it
  // - Otherwise default to "All"
  useEffect(() => {
    const boot = async () => {
      const activeToken = token || localStorage.getItem("token");
      try {
        const res = await api.get("/materials/", {
          headers: { Authorization: `Bearer ${activeToken}` },
        });

        const list = Array.isArray(res.data)
          ? res.data
          : res.data.materials || [];

        setMaterials(list);

        // Check if MaterialsPage navigated here with a pre-selected material
        const incomingId = location.state?.selectedMaterialId ?? "All";
        setSelectedMaterialId(incomingId);
        await fetchQueue(incomingId, list);
      } catch (err) {
        console.error("Failed to fetch materials:", err);
      } finally {
        setPageLoading(false);
      }
    };

    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Runs exactly once on mount

  // ── Pill click handler ────────────────────────────────────────────────────
  const handleMaterialSelection = (id) => {
    setResult(null);
    setSelectedChoice({});
    setSelectedMaterialId(id);
    fetchQueue(id, materials);
  };

  // ── Answer submission ─────────────────────────────────────────────────────
  const handleSubmit = async (flashcardId) => {
    if (!selectedChoice[flashcardId] || !confidence[flashcardId]) return;
    setLoading(true);
    const activeToken = token || localStorage.getItem("token");
    try {
      const res = await api.post(
        "/flashcards/submit/",
        {
          flashcard_id: flashcardId,
          selected_choice: selectedChoice[flashcardId],
          confidence: confidence[flashcardId],
        },
        { headers: { Authorization: `Bearer ${activeToken}` } }
      );
      setResult(res.data);
      await fetchQueue(selectedMaterialId, materials);
    } catch (err) {
      console.error("Submit failed:", err);
      setAlertModal({
        show: true, type: "error", title: "Submit Failed",
        message: err.response?.data?.error || "Network Error",
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Self-graded recall submission (BASIC cards) ─────────────────────────────
  const handleGradeSubmit = async (flashcardId, grade) => {
    setLoading(true);
    const activeToken = token || localStorage.getItem("token");
    try {
      const res = await api.post(
        "/flashcards/submit/",
        { flashcard_id: flashcardId, grade, confidence: confidence[flashcardId] },
        { headers: { Authorization: `Bearer ${activeToken}` } }
      );
      setResult(res.data);
      setRevealed((prev) => ({ ...prev, [flashcardId]: false }));
      await fetchQueue(selectedMaterialId, materials);
    } catch (err) {
      console.error("Grade submit failed:", err);
      setAlertModal({
        show: true, type: "error", title: "Submit Failed",
        message: err.response?.data?.error || "Network Error",
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Confidence selector (metacognitive self-rating, asked before feedback) ──
  const renderConfidenceRow = (cardId) => (
    <div className="confidence-button-row">
      {[
        { value: "GUESSING", label: "Guessing" },
        { value: "UNSURE", label: "Unsure" },
        { value: "CONFIDENT", label: "Confident" },
      ].map((option) => (
        <button
          key={option.value}
          type="button"
          className={`confidence-btn ${confidence[cardId] === option.value ? "selected" : ""}`}
          disabled={loading}
          onClick={() =>
            setConfidence((prev) => ({ ...prev, [cardId]: option.value }))
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  if (pageLoading) return <LoadingScreen message="Loading your flashcards..." />;

  return (
    <div className="dashboard-hub-wrapper">
      <div className="dashboard-header">
        <div
          className="header-title-row"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            flexWrap: "wrap",
            gap: "15px",
          }}
        >
          <div>
            <h2>{personalizedName}'s Learning Hub</h2>
            <p>
              {queue.length === 0
                ? "You are all caught up! No active flashcards waiting for execution inside this segment."
                : `Welcome back! You have ${queue.length} active review tracks waiting for completion.`}
            </p>
          </div>

          {materialUrl && (
            <a
              href={materialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="view-material-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                color: "#ffffff",
                textDecoration: "none",
                fontSize: "0.95rem",
                fontWeight: "600",
                transition: "all 0.3s ease",
                cursor: "pointer",
                boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
              }}
            >
              📖 View Material
            </a>
          )}
        </div>
      </div>

      {/* 🎛️ Filter Bar */}
      <div className="topic-filter-bar-container">
        <span className="topic-filter-label">Filter Material:</span>
        <div className="topic-pills-wrapper">
          <button
            className={`topic-filter-pill ${selectedMaterialId === "All" ? "active" : ""}`}
            onClick={() => handleMaterialSelection("All")}
          >
            All Materials
          </button>

          {materials.map((mat) => (
            <button
              key={mat.id}
              className={`topic-filter-pill ${
                String(selectedMaterialId) === String(mat.id) ? "active" : ""
              }`}
              onClick={() => handleMaterialSelection(mat.id)}
            >
              {mat.title}
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard-main-content">
        {result && (
          <div
            className={`analytics-reveal-panel ${
              result.card_type === "MCQ"
                ? (result.is_correct ? "success-tint" : "error-tint")
                : "neutral-tint"
            }`}
          >
            {result.card_type === "MCQ" ? (
              <>
                <div className="panel-badge">
                  {result.is_correct ? "✓ Correct Evaluation" : "✕ Incorrect Evaluation"}
                </div>
                <h3>Evaluation Matrix</h3>
                <p className="correction-text">
                  <strong>Correct Choice Target:</strong>{" "}
                  <span className="highlight-text">{result.correct_answer}</span>
                </p>
              </>
            ) : (
              <>
                <div className="panel-badge">Recall Graded</div>
                <h3>Evaluation Matrix</h3>
              </>
            )}

            <div className="analytics-metrics-grid">
              <div className="metric-box">
                <span className="metric-label">Mastery Level</span>
                <span className="metric-val">
                  {result.analytics.updated_mastery_level}
                </span>
              </div>
              <div className="metric-box">
                <span className="metric-label">Total Attempts</span>
                <span className="metric-val">{result.analytics.total_attempts}</span>
              </div>
              <div className="metric-box">
                <span className="metric-label">Accuracy Rating</span>
                <span className="metric-val">
                  {parseFloat(result.analytics.accuracy_percentage).toFixed(1)}%
                </span>
              </div>
              <div className="metric-box">
                <span className="metric-label">Next Review</span>
                <span className="metric-val">
                  {new Date(result.analytics.due_date).toLocaleString()}
                </span>
              </div>
            </div>
            <p className="sub-topic-tag">
              Tracking: {result.analytics.sub_topic_tracked}
            </p>
          </div>
        )}

        {queue.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-icon">🎉</div>
            <h3>Queue Cleared</h3>
            <p>
              Your items matching this material context have been completely mastered.
            </p>
          </div>
        ) : (
          <div className="grid-hub-container">
            {queue.map((card) => (
              <div className="hub-card" key={card.id}>
                <div className="card-top-row">
                  <span className="card-badge blue-accent">
                    {card.card_type === "BASIC"
                      ? "Recall Card"
                      : card.card_type === "CLOZE"
                      ? "Cloze Card"
                      : "Active Flashcard"}
                  </span>
                  <span className="mastery-indicator">
                    Level {card.current_mastery_level}
                  </span>
                </div>

                {card.image_url && (
                  <img src={card.image_url} alt="" className="card-illustration-image" />
                )}

                <div className="card-question-text">
                  <p><ClozeText text={card.question} /></p>
                </div>

                {["BASIC", "CLOZE"].includes(card.card_type) ? (
                  revealed[card.id] ? (
                    <>
                      <div className="card-answer-text">
                        <p><strong>Answer:</strong> {card.answer}</p>
                      </div>
                      <div className="grade-button-row">
                        <button
                          className="grade-btn again-btn"
                          disabled={loading}
                          onClick={() => handleGradeSubmit(card.id, "again")}
                        >
                          Again
                        </button>
                        <button
                          className="grade-btn hard-btn"
                          disabled={loading}
                          onClick={() => handleGradeSubmit(card.id, "hard")}
                        >
                          Hard
                        </button>
                        <button
                          className="grade-btn good-btn"
                          disabled={loading}
                          onClick={() => handleGradeSubmit(card.id, "good")}
                        >
                          Good
                        </button>
                        <button
                          className="grade-btn easy-btn"
                          disabled={loading}
                          onClick={() => handleGradeSubmit(card.id, "easy")}
                        >
                          Easy
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="topic-meta-text confidence-prompt-label">
                        How confident are you before seeing the answer?
                      </p>
                      {renderConfidenceRow(card.id)}
                      <div className="card-footer-row">
                        <p className="topic-meta-text">
                          Sub-topic: <span>{card.sub_topic}</span>
                        </p>
                        <button
                          className="submit-button"
                          disabled={loading || !confidence[card.id]}
                          onClick={() =>
                            setRevealed((prev) => ({ ...prev, [card.id]: true }))
                          }
                        >
                          SHOW ANSWER
                        </button>
                      </div>
                    </>
                  )
                ) : (
                  <>
                    <div className="choice-grid">
                      {Object.entries(card.choices).map(([letter, text]) => (
                        <button
                          key={letter}
                          className={`choice-button ${
                            selectedChoice[card.id] === letter ? "selected" : ""
                          }`}
                          onClick={() =>
                            setSelectedChoice((prev) => ({
                              ...prev,
                              [card.id]: letter,
                            }))
                          }
                          disabled={loading}
                        >
                          <span className="choice-letter">{letter}</span>
                          <span className="choice-string">{text}</span>
                        </button>
                      ))}
                    </div>

                    <p className="topic-meta-text confidence-prompt-label">
                      How confident are you in this answer?
                    </p>
                    {renderConfidenceRow(card.id)}

                    <div className="card-footer-row">
                      <p className="topic-meta-text">
                        Sub-topic: <span>{card.sub_topic}</span>
                      </p>
                      <button
                        className="submit-button"
                        onClick={() => handleSubmit(card.id)}
                        disabled={loading || !selectedChoice[card.id] || !confidence[card.id]}
                      >
                        {loading ? "PROCESSING..." : "SUBMIT ANSWER"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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

export default StudentDashboard;
