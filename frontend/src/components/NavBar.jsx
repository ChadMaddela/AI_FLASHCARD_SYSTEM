import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "../styles/NavBar.css";

function NavBar() {
  const { token, role, setToken, setRole } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("role");
    setToken(null);
    setRole(null);
    navigate("/login");
  };

  const normalizedRole = role ? role.toLowerCase() : "";

  return (
    <nav className="navbar-container">
      {/* Brand Heading Left side alignment - Updated to be a functional home link based on role */}
      <div className="navbar-logo-section">
        <Link 
          to={token ? (normalizedRole === "teacher" ? "/teacher-dashboard" : "/student-redirect") : "/login"} 
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <h1>AI Flashcard System</h1>
        </Link>
      </div>

      {/* Center navigation links */}
      <div className="navbar-links-section">
        {/* Student Links */}
        {token && normalizedRole === "student" && (
          <>
            <Link to="/student-dashboard" className="nav-link">Dashboard</Link>
            <Link to="/materials" className="nav-link">Materials</Link>
          </>
        )}
        
        {/* Teacher Links - Dashboard and Upload words are completely removed */}
        {token && normalizedRole === "teacher" && (
          <>
            {/* Kept empty to retain structure layout, or you can add teacher-only links here in the future */}
          </>
        )}
      </div>

      {/* Far Right Action Items Group */}
      <div className="navbar-actions-section">
        {!token ? (
          <Link to="/login" className="login-link-btn">Login</Link>
        ) : (
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}

export default NavBar;