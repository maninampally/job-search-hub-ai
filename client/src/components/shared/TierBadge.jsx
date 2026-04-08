import React from 'react';
import styles from './TierBadge.module.css';

const TIER_CONFIG = {
  free: {
    label: 'Free',
    color: 'gray',
    icon: '○',
  },
  pro: {
    label: 'Pro',
    color: 'blue',
    icon: '★',
  },
  elite: {
    label: 'Elite',
    color: 'purple',
    icon: '✦',
  },
  admin: {
    label: 'Admin',
    color: 'red',
    icon: '⚙',
  },
};

/**
 * TierBadge - displays user tier with color
 */
export function TierBadge({ tier = 'free', size = 'md' }) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.free;

  return (
    <span
      className={`${styles.badge} ${styles[config.color]} ${styles[size]}`}
      title={`${config.label} tier`}
    >
      <span className={styles.icon}>{config.icon}</span>
      <span className={styles.label}>{config.label}</span>
    </span>
  );
}
