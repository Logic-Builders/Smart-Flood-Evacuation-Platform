// dashboard/src/context/AuthContext.jsx
import React, { createContext, useState, useContext } from "react";
import { login as apiLogin, logout as apiLogout } from "../api/api";  // ← fixed path

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setError("");
    setLoading(true);
    try {
      const token = await apiLogin(email, password);
      setUser({ email, token });
    } catch (err) {
      setError(err.message || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    apiLogout();
    setUser(null);
    setError("");
  };

  return (
    <AuthContext.Provider value={{ user, error, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
