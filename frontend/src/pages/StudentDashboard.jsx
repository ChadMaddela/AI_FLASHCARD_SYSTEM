import React, { useState, useEffect, useContext } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import "../styles/Dashboard.css";

const StudentDashboard = () => {
  const { materialId } = useParams();
  const [queue, setQueue] = useState([]);
  const [materialUrl, setMaterialUrl] = useState(""); // ✅ Added state to host original file link
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedChoice, setSelectedChoice] = useState({});
  
  // Connect cleanly to our newly added context variable tracking fields
  const { token, usernameState } = useContext(AuthContext);

  // Safely guarantee proper name capitalize formats string manipulation
  const activeName = usernameState || localStorage.getItem("username") || "Student";
  
  // Isolate the first name by stripping anything after an underscore or space
  const firstName = activeName.split(/[_ ]/)[0];
  const personalizedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

  useEffect(() => {
    const fetchQueue = async () => {
      const activeToken = token || localStorage.getItem("token");
      try {
        const res = await api.get(`/materials/${materialId}/queue/`, {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
        
        setQueue(res.data.queue || res.data.flashcards || []);

        // ✅ Extract file url directly if returned by your queue payload, 
        // else fallback to standard lookup parameters
        if (res.data.material_file_url) {
          setMaterialUrl(res.data.material_file_url);
        } else if (res.data.file_url) {
          setMaterialUrl(res.data.file_url);
        } else {
          // Fallback: Fetch direct details from your material serializer endpoint
          const materialRes = await api.get(`/materials/${materialId}/`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          });
          if (materialRes.data && materialRes.data.file_url) {
            setMaterialUrl(materialRes.data.file_url);
          }
        }
      } catch (err) {
        console.error("Failed to fetch queue or material source:", err);
      }
    };
    if (materialId) {
      fetchQueue();
    }
  }, [materialId, token]);

  const handleSubmit = async (flashcardId) => {
    if (!selectedChoice[flashcardId]) return;
    loading(true);
    const activeToken = token || localStorage.getItem("token");
    try {
      const res = await api.post(
        "/flashcards/submit/",
        { flashcard_id: flashcardId, selected_choice: selectedChoice[flashcardId] },
        { headers: { Authorization: `Bearer ${activeToken}` } }
      );
      setResult(res.data);

      const updated = await api.get(`/materials/${materialId}/queue/`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      setQueue(updated.data.queue || updated.data.flashcards || []);
    } catch (err) {
      console.error("Submit failed:", err);
      alert("Submit failed: " + (err.response?.data?.error || "Network Error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-hub-wrapper">
      <div className="dashboard-header">
        <div className="header-title-row" style={{ display: "flex", justifyContent: "between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "15px" }}>
          <div>
            <h2>{personalizedName}'s Learning Hub</h2>
            <p>
              {queue.length === 0 
                ? "You are all caught up! No flashcards remaining in this queue area." 
                : `Welcome back! You have ${queue.length} active review tracks waiting for completion.`}
            </p>
          </div>
          
          {/* ✅ New View Material Action Layout Button Block */}
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
                boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.25)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              📖 View Material
            </a>
          )}
        </div>
      </div>

      <div className="dashboard-main-content">
        {result && (
          <div className={`analytics-reveal-panel ${result.is_correct ? "success-tint" : "error-tint"}`}>
            <div className="panel-badge">
              {result.is_correct ? "✓ Correct Evaluation" : "✕ Incorrect Evaluation"}
            </div>
            <h3>Evaluation Matrix</h3>
            <p className="correction-text">
              <strong>Correct Choice Target:</strong> <span className="highlight-text">{result.correct_answer}</span>
            </p>
            
            <div className="analytics-metrics-grid">
              <div className="metric-box">
                <span className="metric-label">Mastery Level</span>
                <span className="metric-val">{result.analytics.updated_mastery_level}</span>
              </div>
              <div className="metric-box">
                <span className="metric-label">Total Attempts</span>
                <span className="metric-val">{result.analytics.total_attempts}</span>
              </div>
              <div className="metric-box">
                <span className="metric-label">Accuracy Rating</span>
                <span className="metric-val">{parseFloat(result.analytics.accuracy_percentage).toFixed(1)}%</span>
              </div>
            </div>
            <p className="sub-topic-tag">Tracking: {result.analytics.sub_topic_tracked}</p>
          </div>
        )}

        {queue.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-icon">🎉</div>
            <h3>Queue Cleared</h3>
            <p>Your current assigned sub-topic presentation materials have been completely mastered.</p>
          </div>
        ) : (
          <div className="grid-hub-container">
            {queue.map((card) => (
              <div className="hub-card" key={card.id}>
                <div className="card-top-row">
                  <span className="card-badge blue-accent">Active Flashcard</span>
                  <span className="mastery-indicator">Level {card.current_mastery_level}</span>
                </div>

                <div className="card-question-text">
                  <p>{card.question}</p>
                </div>

                <div className="choice-grid">
                  {Object.entries(card.choices).map(([letter, text]) => (
                    <button
                      key={letter}
                      className={`choice-button ${selectedChoice[card.id] === letter ? "selected" : ""}`}
                      onClick={() =>
                        setSelectedChoice((prev) => ({ ...prev, [card.id]: letter }))
                      }
                      disabled={loading}
                    >
                      <span className="choice-letter">{letter}</span>
                      <span className="choice-string">{text}</span>
                    </button>
                  ))}
                </div>

                <div className="card-footer-row">
                  <p className="topic-meta-text">Sub-topic: <span>{card.sub_topic}</span></p>
                  <button
                    className="submit-button"
                    onClick={() => handleSubmit(card.id)}
                    disabled={loading || !selectedChoice[card.id]}
                  >
                    {loading ? "PROCESSING..." : "SUBMIT ANSWER"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;