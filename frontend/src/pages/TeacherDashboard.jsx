import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import LoadingScreen from "../components/LoadingScreen";
import AlertModal from "../components/AlertModal";
import ConfirmModal from "../components/ConfirmModal";
import "../styles/Dashboard.css";

const TeacherDashboard = () => {
  const [materials, setMaterials] = useState([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [generationMode, setGenerationMode] = useState("MCQ");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [alertModal, setAlertModal] = useState({ show: false, type: "success", title: "", message: "" });
  const [confirmModal, setConfirmModal] = useState({ show: false, materialId: null });

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
      setPageLoading(true);
      fetchMaterials().finally(() => setPageLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Poll while any material is still generating flashcards in the background.
  useEffect(() => {
    const stillProcessing = materials.some((m) => m.generation_status === "PROCESSING");
    if (!stillProcessing) return;

    const interval = setInterval(() => {
      fetchMaterials();
    }, 4000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials]);

  const handleUpload = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      if (title) formData.append("title", title);
      if (file) formData.append("file", file);
      formData.append("generation_mode", generationMode);

      await api.post("/teacher/upload/", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setAlertModal({
        show: true, type: "success", title: "Upload Successful",
        message: "Flashcards are generating in the background.",
      });

      setTitle("");
      setFile(null);
      fetchMaterials(); // Reload the list
    } catch (err) {
      console.error("Upload failed:", err);
      setAlertModal({
        show: true, type: "error", title: "Upload Failed",
        message: err.response?.data?.error || "Network Error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handles dynamic deletion of db entries and linked cloud storage bucket files
  const triggerDeleteMaterial = (materialId) => {
    setConfirmModal({ show: true, materialId });
  };

  const confirmDeleteMaterial = async () => {
    const materialId = confirmModal.materialId;
    setConfirmModal({ show: false, materialId: null });
    try {
      await api.delete(`/materials/${materialId}/delete/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Instantly optimize local UI state array
      setMaterials(materials.filter((m) => m.id !== materialId));
      setAlertModal({
        show: true, type: "success", title: "Material Deleted",
        message: "Material successfully removed from storage bucket.",
      });
    } catch (err) {
      console.error("Failed to delete material:", err);
      setAlertModal({
        show: true, type: "error", title: "Deletion Failed",
        message: err.response?.data?.error || "Server Error",
      });
    }
  };

  if (pageLoading) return <LoadingScreen message="Loading your materials..." />;

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
            <div className="input-group">
              <label>Flashcard Type</label>
              <select
                className="dark-input"
                value={generationMode}
                onChange={(e) => setGenerationMode(e.target.value)}
              >
                <option value="MCQ">Multiple Choice</option>
                <option value="BASIC">Front / Back (Classic Recall)</option>
              </select>
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
                  {m.generation_status === "PROCESSING" && (
                    <span className="badge generation-badge processing-badge">
                      ⏳ Generating flashcards…
                    </span>
                  )}
                  {m.generation_status === "FAILED" && (
                    <span
                      className="badge generation-badge failed-badge"
                      title={m.generation_error || "Flashcard generation failed."}
                    >
                      ⚠️ Generation failed
                    </span>
                  )}
                </div>

                {/* Flat Single-Row Action Container */}
                <div className="material-actions-row-layout">
                  {/* 1. Delete Button (Far Left) */}
                  <button
                    onClick={() => triggerDeleteMaterial(m.id)}
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

                  {/* 4. View Flashcards Button */}
                  <button
                    onClick={() => navigate(`/teacher/flashcards/${m.id}`, { state: { materialTitle: m.title } })}
                    className={`submit-button view-cards-btn ${m.generation_status === "PROCESSING" ? "disabled-btn" : ""}`}
                    disabled={m.generation_status === "PROCESSING"}
                    title={m.generation_status === "PROCESSING" ? "Flashcards are still generating" : undefined}
                  >
                    Flashcards
                  </button>

                  {/* 5. Manage Quizzes Button (Far Right) */}
                  <button
                    onClick={() => navigate(`/teacher/quizzes/${m.id}`, { state: { materialTitle: m.title } })}
                    className={`submit-button view-cards-btn ${m.generation_status === "PROCESSING" ? "disabled-btn" : ""}`}
                    disabled={m.generation_status === "PROCESSING"}
                    title={m.generation_status === "PROCESSING" ? "Flashcards are still generating" : undefined}
                  >
                    Quizzes
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmModal
        show={confirmModal.show}
        danger
        title="Confirm Deletion"
        message="Are you sure you want to permanently delete this material module, its flashcards, and remove its file from the storage bucket?"
        confirmLabel="Yes, Delete"
        onConfirm={confirmDeleteMaterial}
        onCancel={() => setConfirmModal({ show: false, materialId: null })}
      />
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

export default TeacherDashboard;