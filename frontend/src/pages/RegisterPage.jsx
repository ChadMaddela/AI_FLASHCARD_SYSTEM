import React, { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import { loginAndRedirect } from "../utils/auth";
import "../styles/LoginPage.css";

const flattenErrors = (data) => {
  if (!data) return "Registration failed.";
  if (typeof data === "string") return data;
  return Object.values(data).flat().join(" ");
};

const RegisterPage = () => {
  const { setToken, setRole, setUsernameState } = useContext(AuthContext);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.post("register/", { username, email, password });
      // Auto-login: new accounts are always STUDENT, so this lands on /dashboard.
      await loginAndRedirect(username, password, { setToken, setRole, setUsernameState }, navigate);
    } catch (err) {
      console.error("Registration failure debug details:", err);
      setError(flattenErrors(err.response?.data) || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h1>Create Account</h1>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loading}
          required
        />
        <input
          type="email"
          placeholder="Email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
        />
        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "CREATING ACCOUNT..." : "Register"}
        </button>
      </form>
      <p className="register-link-text">
        Already have an account? <Link to="/login">Log In</Link>
      </p>
    </div>
  );
};

export default RegisterPage;
