import React, { useEffect, useRef, useState } from 'react';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { useToast } from '../../context/ToastContext';
import styles from './Map.module.css';

export const FloodMap = () => {
  const { showToast } = useToast();
  const mapContainer = useRef(null);
  const [mapInitialized, setMapInitialized] = useState(false);

  useEffect(() => {
    if (!mapInitialized && mapContainer.current) {
      initializeMap();
    }
  }, [mapInitialized]);

  const initializeMap = async () => {
    try {
      // This is a placeholder. In production, you'd initialize Leaflet here.
      // For now, we're just showing the map container with placeholder content
      const container = mapContainer.current;
      if (container) {
        container.innerHTML = `
          <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #161c2a 0%, #1d2538 100%); border-radius: 12px;">
            <div style="text-align: center; color: #6b7a99;">
              <div style="font-size: 2rem; margin-bottom: 10px;">🗺</div>
              <div style="font-size: 0.9rem;">Interactive Flood Map</div>
              <div style="font-size: 0.75rem; margin-top: 5px; color: #6b7a99;">Powered by Leaflet.js</div>
              <div style="margin-top: 20px; font-size: 0.8rem; color: #00c9a7;">
                <div>📍 3 Critical Zones</div>
                <div>⚠️ 2 Warning Zones</div>
                <div>✓ 1 Safe Route</div>
              </div>
            </div>
          </div>
        `;
      }
      setMapInitialized(true);
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  };

  const handleAddMarker = (type) => {
    const messages = {
      warning: '📍 Warning zone added',
      critical: '📍 Critical zone added',
      safe: '📍 Safe route added',
    };
    const colors = {
      warning: 'var(--accent3)',
      critical: 'var(--danger)',
      safe: 'var(--accent)',
    };
    showToast(messages[type], colors[type]);
  };

  return (
    <div className={styles.mapPage}>
      <div className={styles.pageHeader}>
        <h2>Live Flood Map</h2>
        <p>Interactive map — mark and monitor flood-affected zones</p>
      </div>

      <div className={styles.twoCol} style={{ marginBottom: '16px' }}>
        <Card title="🎛 Map Controls" className={styles.controlCard}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button variant="approve" onClick={() => handleAddMarker('warning')}>
              + Warning Zone
            </Button>
            <Button variant="reject" onClick={() => handleAddMarker('critical')}>
              + Critical Zone
            </Button>
            <Button variant="secondary" onClick={() => handleAddMarker('safe')}>
              + Safe Route
            </Button>
          </div>
        </Card>

        <Card title="🗂 Legend" className={styles.legendCard}>
          <div className={styles.legend}>
            <span>
              <span className={`${styles.legendDot} ${styles.critical}`}></span>
              Critical
            </span>
            <span>
              <span className={`${styles.legendDot} ${styles.warning}`}></span>
              Warning
            </span>
            <span>
              <span className={`${styles.legendDot} ${styles.safe}`}></span>
              Safe Route
            </span>
          </div>
        </Card>
      </div>

      <div className={styles.mapContainer} ref={mapContainer}></div>
    </div>
  );
};
