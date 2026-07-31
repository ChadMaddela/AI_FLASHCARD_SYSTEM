import React, { useEffect, useState, useContext } from "react";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import AnalyticsDetail from "../components/AnalyticsDetail";
import TOSReport from "../components/reports/TOSReport";
import ItemAnalysisReport from "../components/reports/ItemAnalysisReport";
import CompetencyMasteryReport from "../components/reports/CompetencyMasteryReport";
import LoadingScreen from "../components/LoadingScreen";
import { downloadFileFromApi } from "../utils/downloadFile";
import "../styles/Dashboard.css";

const REPORT_TABS = [
  { id: "tos", label: "Table of Specifications" },
  { id: "item-analysis", label: "Item Analysis" },
  { id: "competency-mastery", label: "Competency Mastery" },
];

const TeacherAnalyticsPage = () => {
  const { token } = useContext(AuthContext);
  const [classData, setClassData] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const [materials, setMaterials] = useState([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [materialFlashcards, setMaterialFlashcards] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [activeReportTab, setActiveReportTab] = useState("tos");

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const [classRes, studentsRes, materialsRes] = await Promise.all([
          api.get("/analytics/class/", { headers: { Authorization: `Bearer ${token}` } }),
          api.get("/analytics/students/", { headers: { Authorization: `Bearer ${token}` } }),
          api.get("/materials/", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setClassData(classRes.data);
        setStudents(studentsRes.data);
        setMaterials(materialsRes.data);
      } catch (err) {
        console.error("Failed to fetch class analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchOverview();
  }, [token]);

  const handleSelectMaterial = async (materialId) => {
    setSelectedMaterialId(materialId);
    setSelectedQuizId("");
    setQuizzes([]);
    setMaterialFlashcards([]);
    if (!materialId) return;
    try {
      const [flashcardsRes, quizzesRes] = await Promise.all([
        api.get(`/materials/${materialId}/flashcards/`, { headers: { Authorization: `Bearer ${token}` } }),
        api.get(`/materials/${materialId}/quizzes/`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setMaterialFlashcards(Array.isArray(flashcardsRes.data) ? flashcardsRes.data : []);
      setQuizzes(quizzesRes.data);
    } catch (err) {
      console.error("Failed to fetch material's quizzes/flashcards for reports:", err);
    }
  };

  const handleSelectStudent = async (studentId) => {
    setSelectedStudentId(studentId);
    setDetailLoading(true);
    try {
      const res = await api.get(`/analytics/students/${studentId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudentDetail(res.data);
    } catch (err) {
      console.error("Failed to fetch student analytics:", err);
      setStudentDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDownloadClassPdf = () => {
    downloadFileFromApi(api, "/analytics/class/pdf/", { token, filename: "class_analytics.pdf" });
  };

  const handleDownloadStudentPdf = () => {
    const student = students.find((s) => s.student_id === selectedStudentId);
    downloadFileFromApi(api, `/analytics/students/${selectedStudentId}/pdf/`, {
      token,
      filename: `student_analytics_${student?.username || selectedStudentId}.pdf`,
    });
  };

  if (loading) return <LoadingScreen message="Loading analytics..." />;

  return (
    <div className="dashboard-hub-wrapper">
      <div className="dashboard-header">
        <h2>Class Analytics</h2>
        <p>Aggregate performance across all students, or drill into an individual.</p>
      </div>

      {classData && (
        <>
          <button onClick={handleDownloadClassPdf} className="submit-button edit-btn">
            📄 Download Class Analytics (PDF)
          </button>
          <div className="analytics-metrics-grid analytics-grid-standalone">
            <div className="metric-box">
              <span className="metric-label">Students</span>
              <span className="metric-val">{classData.student_count}</span>
            </div>
            <div className="metric-box">
              <span className="metric-label">Class Accuracy</span>
              <span className="metric-val">{classData.class_accuracy_percentage}%</span>
            </div>
          </div>

          <div className="analytics-section-block">
            <h3>Class Breakdown by Sub-topic</h3>
            {classData.topic_breakdown.length === 0 ? (
              <p className="topic-meta-text">No review data yet.</p>
            ) : (
              <table className="analytics-topic-table">
                <thead>
                  <tr>
                    <th>Sub-topic</th>
                    <th>Avg. Mastery</th>
                    <th>Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {classData.topic_breakdown.map((row) => (
                    <tr key={row.sub_topic}>
                      <td>{row.sub_topic}</td>
                      <td>{row.avg_mastery}</td>
                      <td>{row.accuracy_percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <div className="topic-filter-bar-container">
        <span className="topic-filter-label">Individual Student:</span>
        <div className="topic-pills-wrapper">
          {students.length === 0 ? (
            <span className="topic-meta-text">No students registered yet.</span>
          ) : (
            students.map((s) => (
              <button
                key={s.student_id}
                className={`topic-filter-pill ${selectedStudentId === s.student_id ? "active" : ""}`}
                onClick={() => handleSelectStudent(s.student_id)}
              >
                {s.username} ({s.accuracy_percentage}%)
              </button>
            ))
          )}
        </div>
      </div>

      {detailLoading && <p className="topic-meta-text">Loading student details...</p>}
      {!detailLoading && studentDetail && (
        <>
          <button onClick={handleDownloadStudentPdf} className="submit-button edit-btn">
            📄 Download Student Analytics (PDF)
          </button>
          <AnalyticsDetail data={studentDetail} />
        </>
      )}

      <div className="dashboard-header reports-section-header">
        <h2>Assessment Reports</h2>
        <p>Table of Specifications, Item Analysis, and Competency Mastery — scoped to one quiz session.</p>
      </div>

      <div className="topic-filter-bar-container">
        <span className="topic-filter-label">Material:</span>
        <select
          className="dark-input-box"
          value={selectedMaterialId}
          onChange={(e) => handleSelectMaterial(e.target.value)}
        >
          <option value="">Select a material...</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>{m.title}</option>
          ))}
        </select>
      </div>

      {selectedMaterialId && (
        <div className="topic-filter-bar-container">
          <span className="topic-filter-label">Quiz Session:</span>
          <div className="topic-pills-wrapper">
            {quizzes.length === 0 ? (
              <span className="topic-meta-text">No quiz sessions for this material yet.</span>
            ) : (
              quizzes.map((q) => (
                <button
                  key={q.id}
                  className={`topic-filter-pill ${selectedQuizId === q.id ? "active" : ""}`}
                  onClick={() => setSelectedQuizId(q.id)}
                >
                  {q.title}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {selectedQuizId && (
        <>
          <div className="topic-filter-bar-container">
            <div className="topic-pills-wrapper">
              {REPORT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`topic-filter-pill ${activeReportTab === tab.id ? "active" : ""}`}
                  onClick={() => setActiveReportTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeReportTab === "tos" && (
            <TOSReport token={token} quizId={selectedQuizId} flashcards={materialFlashcards} />
          )}
          {activeReportTab === "item-analysis" && (
            <ItemAnalysisReport token={token} quizId={selectedQuizId} />
          )}
          {activeReportTab === "competency-mastery" && (
            <CompetencyMasteryReport token={token} quizId={selectedQuizId} />
          )}
        </>
      )}
    </div>
  );
};

export default TeacherAnalyticsPage;
