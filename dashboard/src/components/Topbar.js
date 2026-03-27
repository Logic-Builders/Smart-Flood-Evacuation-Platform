import React from "react";

function Topbar({ user, onLogout }) {
  return (
    <div className="topbar">
      <h3>FloodGuard</h3>
      <div>
        {user}
        <button onClick={onLogout}>Logout</button>
      </div>
    </div>
  );
}

export default Topbar;