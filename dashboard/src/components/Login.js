import React, { useState } from "react";
import { validateLogin } from "../utils/auth";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (validateLogin(username, password)) {
      onLogin(username);
    } else {
      setError("Invalid credentials");
    }
  };

  return (
    <div className="login">
      <h2>FloodGuard Admin</h2>

      <input
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

      <button onClick={handleLogin}>Login</button>

      <p className="error">{error}</p>
    </div>
  );
}

export default Login;