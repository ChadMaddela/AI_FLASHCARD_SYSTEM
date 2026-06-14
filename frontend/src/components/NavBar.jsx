import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "../styles/NavBar.css";

function NavBar() {
  const { token, setToken, setRole } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("role");
    setToken(null);
    setRole(null);
    navigate("/login");
  };

  return (
    <nav className="navbar-container">
      {/* Brand Heading Left side alignment */}
      <div className="navbar-logo-section">
        <h1>AI Flashcard System</h1>
      </div>

      {/* Far Right Action Items Group (Pushes actions to the absolute right corner) */}
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