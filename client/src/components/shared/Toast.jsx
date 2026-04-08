import React, { useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import styles from './Toast.module.css';

/**
 * Toast - Global notification toast
 */
export function Toast() {
  const notifications = useUIStore((state) => state.notifications);
  const removeNotification = useUIStore((state) => state.removeNotification);

  return (
    <div className={styles.container}>
      {notifications.map((notif) => (
        <ToastItem
          key={notif.id}
          notification={notif}
          onClose={() => removeNotification(notif.id)}
        />
      ))}
    </div>
  );
}

function ToastItem({ notification, onClose }) {
  const { id, message, type, duration } = notification;

  useEffect(() => {
    if (duration && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  };

  return (
    <div
      className={`${styles.toast} ${styles[type]}`}
      role="alert"
      aria-live="polite"
    >
      <span className={styles.icon}>{icons[type] || icons.info}</span>
      <span className={styles.message}>{message}</span>
      <button
        className={styles.closeBtn}
        onClick={onClose}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}
