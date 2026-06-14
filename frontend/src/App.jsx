import React, { useContext, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import StudentDashboard from "./pages/StudentDashboard";
import NavBar from "./components/NavBar";
import api from "./api";

function AppRoutes() {
  const { token, role } = useContext(AuthContext);
  const normalizedRole = role ? role.toLowerCase() : null;
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const redirectStudent = async () => {
      if (token && normalizedRole === "student") {
        try {
          const res = await api.get("/materials/", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.data.length > 0) {
            const firstMaterialId = res.data[0].id;
            navigate(`/student/${firstMaterialId}`, { replace: true });
          } else {
            console.warn("No materials found for student");
          }
        } catch (err) {
          console.error("Failed to fetch materials:", err);
        }
      }
    };
    redirectStudent();
  }, [token, normalizedRole, navigate]);

  const isLoginPage = location.pathname === "/login";

  return (
    <div className={isLoginPage ? "app-container login-view" : "app-container authenticated-view"}>
      {/* Show NavBar everywhere except login */}
      {!isLoginPage && <NavBar />}

      {/* Main Content Area Container */}
      <div className={isLoginPage ? "auth-container" : "main-content-layout"}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />

          {token && normalizedRole === "student" && (
            <Route path="/student/:materialId" element={<StudentDashboard />} />
          )}

          <Route
            path="*"
            element={
              token ? (
                normalizedRole === "student" ? (
                  <Navigate to="/login" replace />
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