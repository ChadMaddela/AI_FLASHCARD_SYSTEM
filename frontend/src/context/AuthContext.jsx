import React, { createContext, useState, useEffect } from "react";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [role, setRole] = useState(localStorage.getItem("role") || null);
  // Default fallback text initialization if string evaluates empty
  const [usernameState, setUsernameState] = useState(localStorage.getItem("username") || "Student");

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }, [token]);

  useEffect(() => {
    if (role) {
      localStorage.setItem("role", role);
    } else {
      localStorage.removeItem("role");
    }
  }, [role]);

  useEffect(() => {
    if (usernameState) {
      localStorage.setItem("username", usernameState);
    } else if (!token) {
      localStorage.removeItem("username");
    }
  }, [usernameState, token]);

  return (
    <AuthContext.Provider value={{ token, setToken, role, setRole, usernameState, setUsernameState }}>
      {children}
    </AuthContext.Provider>
  );
};