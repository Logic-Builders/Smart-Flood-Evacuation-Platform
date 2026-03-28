import React from 'react';
import { useToast } from '../../context/ToastContext';
import styles from './Toast.module.css';

export const Toast = () => {
  const toastContext = useToast();
  const toasts = toastContext?.toasts || [];

  return (
    <div className={styles.toastContainer}>
      {toasts && toasts.map((toast) => (
        <div
          key={toast.id}
          className={styles.toast}
          style={{ borderColor: toast.color }}
        >
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
};
