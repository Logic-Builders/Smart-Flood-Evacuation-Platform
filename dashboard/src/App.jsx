import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginScreen } from './components/Auth/LoginScreen';
import { Masthead } from './components/Layout/Masthead';
import { SectionNav } from './components/Layout/SectionNav';
import { Overview } from './components/Pages/Overview';
import { Reports } from './components/Pages/Reports';
import { Weather } from './components/Pages/Weather';
import { Dams } from './components/Pages/Dams';
import { FloodMap } from './components/Pages/Map';
import { Toast } from './components/UI/Toast';
import styles from './App.module.css';

function App() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  const renderPage = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview onTabChange={setActiveTab} />;
      case 'reports':
        return <Reports />;
      case 'weather':
        return <Weather />;
      case 'dams':
        return <Dams />;
      case 'map':
        return <FloodMap />;
      default:
        return <Overview onTabChange={setActiveTab} />;
    }
  };

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className={styles.app}>
      <Masthead />
      <SectionNav activeTab={activeTab} onTabChange={setActiveTab} />
      <div className={styles.mainBody}>
        <main className={styles.content}>{renderPage()}</main>
      </div>
      <Toast />
    </div>
  );
}

export default App;
