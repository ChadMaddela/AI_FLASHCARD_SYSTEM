import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import "../styles/Dashboard.css";

const TeacherDashboard = () => {
  const [materials, setMaterials] = useState([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const { token, usernameState } = useContext(AuthContext);
  const navigate = useNavigate();

  const activeName = usernameState || localStorage.getItem("username") || "Teacher";
  const firstName = activeName.split(/[_ ]/)[0];
  const personalizedName =
    firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

  const normalizeMaterials = (data) => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.materials)) return data.materials;
    return [];
  };

  const fetchMaterials = async () => {
    try {
      const res = await api.get("/materials/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMaterials(normalizeMaterials(res.data));
    } catch (err) {
      console.error("Failed to fetch materials:", err);
      setMaterials([]);
    }
  };

  useEffect(() => {
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

      setTitle("");
      setFile(null);
      fetchMaterials(); // Reload the list
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed: " + (err.response?.data?.error || "Network Error"));
    } finally {
      setLoading(false);
    }
  };

  // Handles dynamic deletion of db entries and linked cloud storage bucket files
  const handleDeleteMaterial = async (materialId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to permanently delete this material module, its flashcards, and remove its file from the storage bucket?"
    );
    if (!confirmDelete) return;

    try {
      await api.delete(`/materials/${materialId}/delete/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Instantly optimize local UI state array
      setMaterials(materials.filter((m) => m.id !== materialId));
      alert("Material successfully removed from storage bucket.");
    } catch (err) {
      console.error("Failed to delete material:", err);
      alert("Failed to delete material: " + (err.response?.data?.error || "Server Error"));
    }
  };

  return (
    <div className="dashboard-hub-wrapper">
      <div className="dashboard-header">
        <h2>{personalizedName}'s Control Center</h2>
        <p>Manage your lecture materials and monitor AI flashcard generation.</p>
      </div>

      <div className="dashboard-main-content">
        {/* Upload Form Sidebar */}
        <div className="analytics-reveal-panel">
          <div className="panel-badge blue-accent">Upload Module</div>
          <h3>Generate Flashcards</h3>
          <p className="correction-text">
            Upload your lecture files (pdf, docx, pptx) to generate adaptive flashcard decks for your students.
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

        {/* Dynamic Materials Card Stream Grid */}
        <div className="grid-hub-container">
          {materials.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-icon">📚</div>
              <h3>No Materials Yet</h3>
              <p>
                Upload your first lecture module to generate an adaptive flashcard
                deck for your students.
              </p>
            </div>
          ) : (
            materials.map((m) => (
              <div className="hub-card premium-clean-card" key={m.id}>
                <div className="card-question-text">
                  <p className="clean-title-heading">{m.title}</p>
                </div>

                {/* Flat Single-Row Action Container */}
                <div className="material-actions-row-layout">
                  {/* 1. Delete Button (Far Left) */}
                  <button
                    onClick={() => handleDeleteMaterial(m.id)}
                    className="material-danger-delete-btn"
                  >
                    🗑️ Delete
                  </button>

                  {/* 2. Stats Button */}
                  <button className="submit-button metrics-action-btn">
                    📊 Stats
                  </button>

                  {/* 3. View Material Button */}
                  {m.file_url ? (
                    <button
                      onClick={() => window.open(m.file_url, "_blank")}
                      className="submit-button document-action-btn"
                    >
                      📄 Material
                    </button>
                  ) : (
                    <button className="submit-button disabled-btn" disabled>
                      ❌ No File
                    </button>
                  )}

                  {/* 4. View Flashcards Button (Far Right) */}
                  <button
                    onClick={() => navigate(`/teacher/flashcards/${m.id}`, { state: { materialTitle: m.title } })}
                    className="submit-button view-cards-btn"
                  >
                    Flashcards
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