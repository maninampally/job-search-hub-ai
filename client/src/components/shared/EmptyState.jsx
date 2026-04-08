import React from 'react';
import styles from './EmptyState.module.css';

/**
 * EmptyState - reusable empty state with icon, message, and optional CTA
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel = 'Get started',
  className = '',
}) {
  return (
    <div className={`${styles.container} ${className}`}>
      {Icon && (
        <div className={styles.icon}>
          <Icon size={48} />
        </div>
      )}

      <h3 className={styles.title}>{title}</h3>

      {description && <p className={styles.description}>{description}</p>}

      {action && (
        <button className={styles.button} onClick={action}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
