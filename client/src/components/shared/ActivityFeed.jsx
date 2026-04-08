import React from 'react';
import styles from './ActivityFeed.module.css';

/**
 * ActivityFeed - Shows recent user actions
 */
export function ActivityFeed({ activities = [] }) {
  if (activities.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No recent activity</p>
      </div>
    );
  }

  return (
    <div className={styles.feed}>
      <h3 className={styles.title}>Recent Activity</h3>
      <div className={styles.list}>
        {activities.map((activity, idx) => (
          <ActivityItem key={idx} activity={activity} />
        ))}
      </div>
    </div>
  );
}

function ActivityItem({ activity }) {
  const formatDate = (date) => {
    const now = Date.now();
    const diff = now - new Date(date).getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return new Date(date).toLocaleDateString();
  };

  const getIcon = (type) => {
    const icons = {
      job_added: '✓',
      job_updated: '📝',
      job_moved: '→',
      status_changed: '📊',
      sync: '🔄',
      login: '🔑',
      logout: '🚪',
      profile_updated: '👤',
    };
    return icons[type] || '•';
  };

  const getLabel = (activity) => {
    const labels = {
      job_added: `Added job: ${activity.title || 'Untitled'}`,
      job_updated: `Updated job: ${activity.title || 'Untitled'}`,
      job_moved: `Moved to ${activity.status || 'status'}`,
      status_changed: `Changed status to ${activity.new_status || 'new status'}`,
      sync: `Synced ${activity.count || 0} emails from Gmail`,
      login: 'Logged in',
      logout: 'Logged out',
      profile_updated: 'Updated profile',
    };
    return labels[activity.type] || activity.description || 'Activity';
  };

  return (
    <div className={styles.item}>
      <div className={styles.icon}>{getIcon(activity.type)}</div>
      <div className={styles.content}>
        <p className={styles.label}>{getLabel(activity)}</p>
        <p className={styles.time}>{formatDate(activity.timestamp)}</p>
      </div>
    </div>
  );
}
