import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/index";
import { AuthContext } from "../context/AuthContext";

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { setToken, setRole } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Request JWT token
      const res = await api.post("/token/", { username, password });
      const { access, refresh } = res.data;

      // Save tokens
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);
      setToken(access);

      // Fetch user role
      const userRes = await api.get("/user/me/", {
        headers: { Authorization: `Bearer ${access}` },
      });
      const { role } = userRes.data;

      // Save role
      localStorage.setItem("role", role);
      setRole(role);

      // Normalize role string and redirect
      const normalizedRole = role.toLowerCase();
      if (normalizedRole === "teacher") {
        navigate("/teacher");
      } else {
        navigate("/student/1");
      }

      alert("Login successful!");
    } catch (err) {
      console.error("Login failed:", err);
      alert("Login failed: Network Error");
    }
  };

  return (
    <div className="login-container">
      <h2>Welcome to</h2>
      <h3>Login</h3>
      <form onSubmit={handleSubmit}>
        <label>
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default LoginForm;
