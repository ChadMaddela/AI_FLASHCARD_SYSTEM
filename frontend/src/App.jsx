import React, { useContext, useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import StudentDashboard from "./pages/StudentDashboard";
import NavBar from "./components/NavBar";
import api from "./api";

// Simple dynamic middleman component to capture and split student materials asynchronously
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
        if (res.data && res.data.length > 0) {
          navigate(`/student/${res.data[0].id}`, { replace: true });
        } else {
          // Fallback if the teacher hasn't assigned any structural course decks yet
          navigate("/no-materials", { replace: true });
        }
      } catch (err) {
        console.error("Error setting dynamic material route destination:", err);
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
    <div className={isLoginPage ? "app-container login-view" : "app-container authenticated-view"}>
      {/* Show NavBar everywhere except login */}
      {!isLoginPage && <NavBar />}

      {/* Main Content Area Container */}
      <div className={isLoginPage ? "auth-container" : "main-content-layout"}>
        <Routes>
          {/* Default Base Navigation Hooks */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={token ? (
            normalizedRole === "student" ? <Navigate to="/student-redirect" replace /> : <Navigate to="/login" replace />
          ) : <LoginPage />} />

          {/* Secure Authenticated Student Routes */}
          {token && normalizedRole === "student" && (
            <>
              <Route path="/student-redirect" element={<StudentRedirector />} />
              <Route path="/student/:materialId" element={<StudentDashboard />} />
              <Route path="/no-materials" element={
                <div style={{ padding: "40px", color: "#fff" }}>
                  <h2>No Learning Decks Found</h2>
                  <p>Please wait for an administrator or teacher to compile your presentation reviews.</p>
                </div>
              } />
            </>
          )}

          {/* Fallback Catch-All Route Guard */}
          <Route
            path="*"
            element={
              token ? (
                normalizedRole === "student" ? (
                  <Navigate to="/student-redirect" replace />
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