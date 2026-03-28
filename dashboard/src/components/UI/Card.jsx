import React from 'react';
import styles from './Card.module.css';

export const Card = ({ children, className = '', title, title_icon = '' }) => {
  return (
    <div className={`${styles.card} ${className}`}>
      {title && (
        <div className={styles.cardTitle}>
          {title_icon && <span>{title_icon}</span>}
          {title}
        </div>
      )}
      {children}
    </div>
  );
};
