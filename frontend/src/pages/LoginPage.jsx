import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom"; // Added for deterministic routing
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import "../styles/LoginPage.css"; 

const LoginPage = () => {
  const { setToken, setRole, setUsernameState } = useContext(AuthContext);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate(); // Hook assignment

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      // Request JWT Token
      const res = await api.post("token/", { username, password });
      const { access } = res.data;
      
      // Always store token before running secondary calls so interceptor captures it
      localStorage.setItem("token", access);

      // Fetch user profile data via clean relative endpoint mapping
      const userRes = await api.get("user/me/");
      
      const role = userRes.data.role;
      const finalName = userRes.data.first_name || userRes.data.username || userRes.data.name || "Student";
      
      localStorage.setItem("role", role);
      localStorage.setItem("username", finalName);

      // Update Context States
      setToken(access);
      setRole(role);
      if (setUsernameState) {
        setUsernameState(finalName);
      }

      // Route users programmatically based on their backend permissions role mapping
      const normalizedRole = role ? role.toLowerCase() : "";
      if (normalizedRole === "student") {
        navigate("/student-redirect", { replace: true });
      } else if (normalizedRole === "teacher") {
        navigate("/teacher-dashboard", { replace: true });
      } else {
        setError("Unauthorized system profile role detected.");
      }

    } catch (err) {
      console.error("Login failure debug details:", err);
      setError("Invalid username or password");
    }
  };

  return (
    <div className="login-container">
      <h1>Login</h1>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Log In</button>
      </form>
    </div>
  );
};

export default LoginPage;