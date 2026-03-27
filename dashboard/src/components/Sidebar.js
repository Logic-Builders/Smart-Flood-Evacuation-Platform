import React from "react";

function Sidebar({ setTab, active }) {
  const items = ["overview", "reports", "weather", "dams", "map", "system"];

  return (
    <div className="sidebar">
      {items.map((item) => (
        <div
          key={item}
          className={active === item ? "active nav-item" : "nav-item"}
          onClick={() => setTab(item)}
        >
          {item.toUpperCase()}
        </div>
      ))}
    </div>
  );
}

export default Sidebar;