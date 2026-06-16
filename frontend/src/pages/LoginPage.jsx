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
  const [loading, setLoading] = useState(false); // ✅ loading state
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true); // ✅ show loading state
    try {
      // Request JWT Token
      const res = await api.post("token/", { username, password });
      const { access } = res.data;
      localStorage.setItem("token", access);

      // Fetch user profile
      const userRes = await api.get("user/me/");
      const role = userRes.data.role;
      const finalName =
        userRes.data.first_name ||
        userRes.data.username ||
        userRes.data.name ||
        "Student";

      localStorage.setItem("role", role);
      localStorage.setItem("username", finalName);

      // Update Context
      setToken(access);
      setRole(role);
      if (setUsernameState) {
        setUsernameState(finalName);
      }

      // Route users programmatically
      const normalizedRole = role ? role.toLowerCase() : "";
      if (normalizedRole === "student") {
        try {
          // Fetch materials to get first materialId
          const materialsRes = await api.get("materials/", {
            headers: { Authorization: `Bearer ${access}` },
          });
          const data = Array.isArray(materialsRes.data)
            ? materialsRes.data
            : materialsRes.data.materials || [];

          if (data.length > 0 && data[0].id) {
            navigate(`/student/${data[0].id}`, { replace: true });
          } else {
            navigate("/no-materials", { replace: true });
          }
        } catch (err) {
          console.error("Failed to fetch student materials:", err);
          navigate("/no-materials", { replace: true });
        }
      } else if (normalizedRole === "teacher") {
        navigate("/teacher-dashboard", { replace: true });
      } else {
        setError("Unauthorized system profile role detected.");
      }
    } catch (err) {
      console.error("Login failure debug details:", err);
      setError("Invalid username or password");
    } finally {
      setLoading(false); // ✅ reset loading state
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
          disabled={loading} // ✅ disable while loading
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          {loading ? "LOGGING IN..." : "Log In"} {/* ✅ dynamic label */}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
