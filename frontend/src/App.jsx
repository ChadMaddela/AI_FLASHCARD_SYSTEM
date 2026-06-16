import React, { useContext, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AuthContext } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import StudentDashboard from "./pages/StudentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import MaterialsPage from "./pages/MaterialsPage"; // ✅ import MaterialsPage
import NavBar from "./components/NavBar";
import api from "./api";

// Student redirector: fetch first material and forward
function StudentRedirector() {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchInitialMaterial = async () => {
      const activeToken = token || localStorage.getItem("token");
      try {
        const res = await api.get("/materials/", {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
        const data = Array.isArray(res.data) ? res.data : res.data.materials || [];
        if (data.length > 0 && data[0].id) {
          navigate(`/student/${data[0].id}`, { replace: true });
        } else {
          navigate("/no-materials", { replace: true });
        }
      } catch (err) {
        console.error("Error setting dynamic material route destination:", err);
        navigate("/no-materials", { replace: true });
      }
    };
    fetchInitialMaterial();
  }, [token, navigate]);

  return (
    <div className="loading-placeholder">
      <h3>Synchronizing Learning Modules...</h3>
    </div>
  );
}

function AppRoutes() {
  const { token, role } = useContext(AuthContext);
  const normalizedRole = role ? role.toLowerCase() : null;
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";

  return (
    <div
      className={
        isLoginPage ? "app-container login-view" : "app-container authenticated-view"
      }
    >
      {!isLoginPage && <NavBar />}

      <div className={isLoginPage ? "auth-container" : "main-content-layout"}>
        <Routes>
          {/* Default route */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Login route */}
          <Route
            path="/login"
            element={
              token ? (
                normalizedRole === "student" ? (
                  <Navigate to="/student-redirect" replace />
                ) : normalizedRole === "teacher" ? (
                  <Navigate to="/teacher-dashboard" replace />
                ) : (
                  <Navigate to="/login" replace />
                )
              ) : (
                <LoginPage />
              )
            }
          />

          {/* Student routes */}
          {token && normalizedRole === "student" && (
            <>
              <Route path="/student-redirect" element={<StudentRedirector />} />
              <Route path="/student/:materialId" element={<StudentDashboard />} />
              <Route path="/materials" element={<MaterialsPage />} /> {/* ✅ new route */}
              <Route
                path="/no-materials"
                element={
                  <div style={{ padding: "40px", color: "#fff" }}>
                    <h2>No Learning Decks Found</h2>
                    <p>
                      Please wait for an administrator or teacher to compile your
                      presentation reviews.
                    </p>
                  </div>
                }
              />
            </>
          )}

          {/* Teacher routes */}
          {token && normalizedRole === "teacher" && (
            <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
          )}

          {/* Catch-all */}
          <Route
            path="*"
            element={
              token ? (
                normalizedRole === "student" ? (
                  // ✅ allow staying on /student/:materialId or /materials
                  location.pathname.startsWith("/student/") ||
                  location.pathname === "/materials" ? (
                    <Navigate to={location.pathname} replace />
                  ) : (
                    <Navigate to="/student-redirect" replace />
                  )
                ) : normalizedRole === "teacher" ? (
                  <Navigate to="/teacher-dashboard" replace />
                ) : (
                  <Navigate to="/login" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
