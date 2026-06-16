import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import "../styles/MaterialsPage.css";

const MaterialsPage = () => {
  const { token } = useContext(AuthContext);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMaterials = async () => {
      const activeToken = token || localStorage.getItem("token");
      try {
        setLoading(true);
        const res = await api.get("/materials/", {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
        
        const rawData = Array.isArray(res.data) ? res.data : res.data.materials || [];
        
        // Hardening: Normalize data properties coming from Django/Supabase
        const sanitizedData = rawData.map((m) => {
          let cleanUrl = null;

          if (m.file_url) {
            // If the URL comes back nested as an object from Supabase JSON string formats, extract the raw string
            if (typeof m.file_url === "object" && m.file_url.publicUrl) {
              cleanUrl = m.file_url.publicUrl;
            } else if (typeof m.file_url === "string" && m.file_url.trim() !== "") {
              cleanUrl = m.file_url;
            }
          }

          return {
            ...m,
            file_url: cleanUrl,
          };
        });

        setMaterials(sanitizedData);
      } catch (err) {
        console.error("Failed to fetch materials:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMaterials();
  }, [token]);

  const handlePractice = (materialId) => {
    navigate(`/student/${materialId}`);
  };

  if (loading) {
    return (
      <div className="materials-container">
        <p className="no-materials">Loading your presentation tracks...</p>
      </div>
    );
  }

  return (
    <div className="materials-container">
      <h2>Uploaded Materials</h2>
      {materials.length === 0 ? (
        <p className="no-materials">No materials available yet.</p>
      ) : (
        <div className="materials-grid">
          {materials.map((m) => (
            <div key={m.id} className="material-card">
              <h3>{m.title || "Untitled Material"}</h3>
              <p>{m.description || "No description provided."}</p>

              <div className="material-actions">
                {m.file_url ? (
                  /* ✅ Active View Material Button */
                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="view-btn"
                  >
                    📄 View Material
                  </a>
                ) : (
                  /* ⚠️ Fallback Visual if URL is missing */
                  <button 
                    className="view-btn disabled-btn" 
                    disabled 
                    title={`Missing file link path asset string layout for record ID: ${m.id}`}
                  >
                    ❌ No Material File
                  </button>
                )}
                
                <button
                  className="practice-btn"
                  onClick={() => handlePractice(m.id)}
                >
                  Practice Flashcards
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MaterialsPage;