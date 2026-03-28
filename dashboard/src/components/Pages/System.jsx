import React from 'react';
import { Card } from '../UI/Card';
import styles from './System.module.css';

const ARCH_NODES = [
  {
    title: '🖥 Admin Dashboard (Web)',
    items: [
      'Secure login — pre-seeded credentials only',
      'Real-time flood zone management',
      'User report verification with photo',
      'Dam warning processing',
      'Weather data ingestion',
    ],
  },
  {
    title: '📱 Mobile Client App',
    items: [
      'Safest-path routing (flood-aware)',
      'Real-time map via WebSocket',
      'P2P sync when offline',
      'Submit flood reports + photo proof',
      'Evacuation alerts',
    ],
  },
  {
    title: '🔗 Server Layer',
    items: [
      'REST API + WebSocket server',
      'Flood zone graph database',
      'Safety-weighted Dijkstra routing',
      'Push notification service',
      'Photo verification queue',
    ],
  },
  {
    title: '📡 Data Sources',
    items: [
      'MeteoGroup / DMC weather feed',
      'Local authority status API',
      'Dam authority messaging system',
      'Citizen crowdsource reports',
      'Satellite imagery (planned)',
    ],
  },
  {
    title: '🤝 P2P Connectivity',
    items: [
      'Bluetooth / WiFi-Direct discovery',
      'Nearest peer update sync',
      'Offline cache of last safe routes',
      'Mesh relay for critical alerts',
    ],
  },
  {
    title: '🔐 Security',
    items: [
      'JWT-based admin authentication',
      'No self-signup — DB-seeded accounts',
      'Photo hashing for tamper detection',
      'Encrypted P2P payloads',
      'Rate limiting on submissions',
    ],
  },
];

export const System = () => {
  return (
    <div className={styles.system}>
      <div className={styles.pageHeader}>
        <h2>System Architecture</h2>
        <p>Technical overview of the Smart Flood Evacuation platform</p>
      </div>

      <div className={styles.archGrid}>
        {ARCH_NODES.map((node, idx) => (
          <Card key={idx} title={node.title} className={styles.archNode}>
            <ul className={styles.nodeList}>
              {node.items.map((item, itemIdx) => (
                <li key={itemIdx}>{item}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
};
