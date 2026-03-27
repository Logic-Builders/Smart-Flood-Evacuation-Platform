import React, { useState } from "react";
import Login from "./components/Login";
import Topbar from "./components/Topbar";
import Sidebar from "./components/Sidebar";
import Overview from "./components/Overview";
import Reports from "./components/Reports";
import Weather from "./components/Weather";
import Dams from "./components/Dams";
import MapView from "./components/MapView";
import System from "./components/System";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("overview");

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  const renderTab = () => {
    switch (tab) {
      case "overview": return <Overview />;
      case "reports": return <Reports />;
      case "weather": return <Weather />;
      case "dams": return <Dams />;
      case "map": return <MapView />;
      case "system": return <System />;
      default: return <Overview />;
    }
  };

  return (
    <div className="app">
      <Topbar user={user} onLogout={() => setUser(null)} />
      <div className="main">
        <Sidebar setTab={setTab} active={tab} />
        <div className="content">{renderTab()}</div>
      </div>
    </div>
  );
}

export default App;