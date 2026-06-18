import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import "../styles/LoginPage.css";

const LoginPage = () => {
  const { setToken, setRole, setUsernameState } = useContext(AuthContext);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Request JWT token
      const res = await api.post("token/", { username, password });
      const { access } = res.data;
      localStorage.setItem("token", access);

      // Fetch user profile
      const userRes = await api.get("user/me/", {
        headers: { Authorization: `Bearer ${access}` },
      });
      const role = userRes.data.role;
      const finalName =
        userRes.data.first_name ||
        userRes.data.username ||
        userRes.data.name ||
        "Student";

      localStorage.setItem("role", role);
      localStorage.setItem("username", finalName);

      // Update context
      setToken(access);
      setRole(role);
      if (setUsernameState) setUsernameState(finalName);

      // ✅ Route to clean dashboard — StudentDashboard handles material
      //    selection internally; no materialId baked into the URL here.
      const normalizedRole = role ? role.toLowerCase() : "";
      if (normalizedRole === "student") {
        navigate("/dashboard", { replace: true });
      } else if (normalizedRole === "teacher") {
        navigate("/teacher-dashboard", { replace: true });
      } else {
        setError("Unauthorized system profile role detected.");
      }
    } catch (err) {
      console.error("Login failure debug details:", err);
      setError("Invalid username or password");
    } finally {
      setLoading(false);
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
          disabled={loading}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          {loading ? "LOGGING IN..." : "Log In"}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
