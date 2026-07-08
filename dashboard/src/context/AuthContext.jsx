import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext();
const BASE_URL = "http://localhost:8080";

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [error, setError] = useState('');

  const login = async (email, password) => {
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        setIsAuthenticated(true);
        setCurrentUser(email);
        setToken(data.token);
        return true;
      } else {
        setError(data.error || 'Invalid credentials');
        return false;
      }
    } catch (err) {
      setError('Cannot connect to server');
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setToken(null);
    setError('');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, currentUser, token, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};