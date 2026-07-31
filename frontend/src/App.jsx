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
import RegisterPage from "./pages/RegisterPage";
import StudentDashboard from "./pages/StudentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import MaterialsPage from "./pages/MaterialsPage";
import TeacherFlashcardsPage from "./pages/TeacherFlashcardsPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import StudentAnalyticsPage from "./pages/StudentAnalyticsPage";
import TeacherAnalyticsPage from "./pages/TeacherAnalyticsPage";
import TeacherQuizzesPage from "./pages/TeacherQuizzesPage";
import StudentQuizzesPage from "./pages/StudentQuizzesPage";
import NavBar from "./components/NavBar";

function AppRoutes() {
  const { token, role } = useContext(AuthContext);
  const normalizedRole = role ? role.toLowerCase() : null;
  const location = useLocation();
  const isLoginPage = location.pathname === "/login" || location.pathname === "/register";

  const redirectByRole = (
    <Navigate
      to={
        normalizedRole === "student"
          ? "/dashboard"
          : normalizedRole === "teacher"
          ? "/teacher-dashboard"
          : "/login"
      }
      replace
    />
  );

  return (
    <div className={isLoginPage ? "app-container login-view" : "app-container authenticated-view"}>
      {!isLoginPage && <NavBar />}

      <div className={isLoginPage ? "auth-container" : "main-content-layout"}>
        <Routes>
          {/* Default route */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Login route */}
          <Route path="/login" element={token ? redirectByRole : <LoginPage />} />

          {/* Register route */}
          <Route path="/register" element={token ? redirectByRole : <RegisterPage />} />

          {/* Student routes */}
          {token && normalizedRole === "student" && (
            <>
              {/* ✅ Single clean route — no materialId in URL */}
              <Route path="/dashboard" element={<StudentDashboard />} />
              <Route path="/materials" element={<MaterialsPage />} />
              <Route path="/analytics" element={<StudentAnalyticsPage />} />
              <Route path="/quizzes" element={<StudentQuizzesPage />} />
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
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/teacher/analytics" element={<TeacherAnalyticsPage />} />
              <Route path="/teacher/quizzes/:materialId" element={<TeacherQuizzesPage />} />
            </>
          )}

          {/* Catch-all */}
          <Route path="*" element={token ? redirectByRole : <Navigate to="/login" replace />} />
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
