import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState('');

  const USERS = {
    admin1: 'admin123',
    admin2: 'flood2024',
  };

  const login = (username, password) => {
    setError('');
    if (USERS[username] && USERS[username] === password) {
      setIsAuthenticated(true);
      setCurrentUser(username);
      return true;
    } else {
      setError('Invalid credentials. Try admin1 / admin123');
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setError('');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, currentUser, error, login, logout }}>
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
