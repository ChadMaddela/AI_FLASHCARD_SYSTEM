import React, { useState, useContext } from "react";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import "../styles/LoginPage.css"; // dark theme CSS

const LoginPage = () => {
  const { setToken, setRole, setUsernameState } = useContext(AuthContext);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      // request JWT token
      const res = await api.post("/token/", { username, password });
      const { access } = res.data;
      localStorage.setItem("token", access);

      // fetch user profile data
      const userRes = await api.get("/user/me/", {
        headers: { Authorization: `Bearer ${access}` },
      });
      
      const role = userRes.data.role;
      // Capture alternative name properties depending on your specific Django backend field assignments
      const finalName = userRes.data.first_name || userRes.data.username || userRes.data.name || "Student";
      
      localStorage.setItem("role", role);
      localStorage.setItem("username", finalName); // Save to storage cache

      setToken(access);
      setRole(role);
      if (setUsernameState) {
        setUsernameState(finalName); // Update active global tracking state
      }
    } catch (err) {
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