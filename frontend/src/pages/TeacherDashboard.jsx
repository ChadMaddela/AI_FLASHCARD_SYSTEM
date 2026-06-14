import React, { useState, useEffect, useContext } from "react";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import "../styles/Dashboard.css";

const TeacherDashboard = () => {
  const [materials, setMaterials] = useState([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const { token, usernameState } = useContext(AuthContext);

  // Safely guarantee proper name capitalize formats string manipulation
  const activeName = usernameState || localStorage.getItem("username") || "Teacher";
  const firstName = activeName.split(/[_ ]/)[0];
  const personalizedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

  // Fetch materials on load
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const res = await api.get("/materials/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMaterials(res.data.materials);
      } catch (err) {
        console.error("Failed to fetch materials:", err);
      }
    };
    if (token) {
      fetchMaterials();
    }
  }, [token]);

  const handleUpload = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      if (title) formData.append("title", title);
      if (file) formData.append("file", file);

      await api.post("/teacher/upload/", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      alert("Upload successful! Flashcards generated.");

      // Refresh materials list
      const updated = await api.get("/materials/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMaterials(updated.data.materials);
      setTitle("");
      setFile(null);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed: " + (err.response?.data?.error || "Network Error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-hub-wrapper">
      <div className="dashboard-header">
        <h2>{personalizedName}'s Control Center</h2>
        <p>Manage your lecture materials and monitor AI flashcard generation.</p>
      </div>

      <div className="dashboard-main-content">
        
        {/* Left Panel: Upload Form (Reusing Analytics Panel Styling) */}
        <div className="analytics-reveal-panel">
          <div className="panel-badge blue-accent">
            Upload Module
          </div>
          <h3>Generate Flashcards</h3>
          <p className="correction-text">
            Upload your lecture text or files. Gemini will automatically extract concepts into multiple-choice questions.
          </p>

          <form onSubmit={handleUpload} className="upload-form-flex">
            <div className="input-group">
              <label>Material Title</label>
              <input
                type="text"
                className="dark-input"
                placeholder="e.g., Nervous System Pt. 1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label>Lecture File</label>
              <input
                type="file"
                className="dark-input file-input"
                onChange={(e) => setFile(e.target.files[0])}
                required
              />
            </div>
            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? "PROCESSING AI..." : "UPLOAD MATERIAL"}
            </button>
          </form>
        </div>

        {/* Right Panel: Materials List */}
        <div className="grid-hub-container">
          {materials.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-icon">📚</div>
              <h3>No Materials Yet</h3>
              <p>Upload your first lecture module to generate an adaptive flashcard deck for your students.</p>
            </div>
          ) : (
            materials.map((m) => (
              <div className="hub-card" key={m.id}>
                <div className="card-top-row">
                  <span className="card-badge blue-accent">Active Deck</span>
                  <span className="mastery-indicator">ID: {m.id}</span>
                </div>

                <div className="card-question-text">
                  <p>{m.title}</p>
                </div>
                
                <p className="correction-text" style={{ marginBottom: 'auto' }}>
                  {m.description}
                </p>

                <div className="card-footer-row">
                  <p className="topic-meta-text">Uploaded by: <span>{m.uploaded_by}</span></p>
                  <button className="submit-button" style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
                    VIEW STATS
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        
      </div>
    </div>
  );
};

export default TeacherDashboard;