import React, { useContext } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthContext } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import StudentDashboard from "./pages/StudentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import MaterialsPage from "./pages/MaterialsPage";
import TeacherFlashcardsPage from "./pages/TeacherFlashcardsPage";
import NavBar from "./components/NavBar";

function AppRoutes() {
  const { token, role } = useContext(AuthContext);
  const normalizedRole = role ? role.toLowerCase() : null;
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";

  return (
    <div className={isLoginPage ? "app-container login-view" : "app-container authenticated-view"}>
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
                  <Navigate to="/dashboard" replace />
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
              {/* ✅ Single clean route — no materialId in URL */}
              <Route path="/dashboard" element={<StudentDashboard />} />
              <Route path="/materials" element={<MaterialsPage />} />
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
            <>
              <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
              <Route
                path="/teacher/flashcards/:materialId"
                element={<TeacherFlashcardsPage />}
              />
            </>
          )}

          {/* Catch-all */}
          <Route
            path="*"
            element={
              token ? (
                normalizedRole === "student" ? (
                  <Navigate to="/dashboard" replace />
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
