import React from 'react';
import styles from './SkeletonLoader.module.css';

/**
 * Skeleton components for displaying loading states
 * Used while async data is being fetched
 */

/**
 * Generic skeleton box - flexible dimensions
 */
export function SkeletonBox({ width = '100%', height = '1.5rem', className = '' }) {
  return (
    <div
      className={`${styles.skeleton} ${className}`}
      style={{
        width,
        height,
      }}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton for text lines
 */
export function SkeletonText({ lines = 1, gap = '0.5rem' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox key={i} height="1rem" />
      ))}
    </div>
  );
}

/**
 * Skeleton for job card in kanban
 */
export function SkeletonJobCard() {
  return (
    <div className={styles.jobCardSkeleton}>
      <SkeletonBox height="1.25rem" width="80%" className={styles.mb} />
      <SkeletonBox height="0.875rem" width="60%" className={styles.mb} />
      <SkeletonBox height="0.875rem" width="70%" className={styles.mb} />
      <div className={styles.footer}>
        <SkeletonBox height="0.75rem" width="40%" />
      </div>
    </div>
  );
}

/**
 * Skeleton for kanban column
 */
export function SkeletonKanbanColumn({ cardCount = 3 }) {
  return (
    <div className={styles.kanbanColumnSkeleton}>
      <SkeletonBox height="1.25rem" width="80%" className={styles.mb} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {Array.from({ length: cardCount }).map((_, i) => (
          <SkeletonJobCard key={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for full kanban board
 */
export function SkeletonKanbanBoard({ columnCount = 4, cardCount = 3 }) {
  return (
    <div className={styles.kanbanBoardSkeleton}>
      {Array.from({ length: columnCount }).map((_, i) => (
        <SkeletonKanbanColumn key={i} cardCount={cardCount} />
      ))}
    </div>
  );
}

/**
 * Skeleton for list item
 */
export function SkeletonListItem() {
  return (
    <div className={styles.listItemSkeleton}>
      <SkeletonBox height="1rem" width="20%" className={styles.inline} />
      <SkeletonBox height="1rem" width="60%" className={styles.inline} />
    </div>
  );
}

/**
 * Skeleton for table row
 */
export function SkeletonTableRow({ columnCount = 5 }) {
  return (
    <div className={styles.tableRowSkeleton}>
      {Array.from({ length: columnCount }).map((_, i) => (
        <SkeletonBox key={i} height="1rem" />
      ))}
    </div>
  );
}

/**
 * Skeleton for avatar/profile picture
 */
export function SkeletonAvatar({ size = '2.5rem' }) {
  return (
    <SkeletonBox
      width={size}
      height={size}
      className={styles.avatar}
    />
  );
}

/**
 * Skeleton for user profile card
 */
export function SkeletonProfileCard() {
  return (
    <div className={styles.profileCardSkeleton}>
      <div className={styles.profileHeader}>
        <SkeletonAvatar />
        <div>
          <SkeletonBox height="1.25rem" width="150px" className={styles.mb} />
          <SkeletonBox height="0.875rem" width="200px" />
        </div>
      </div>
      <div className={styles.profileBody}>
        <SkeletonText lines={4} />
      </div>
    </div>
  );
}

/**
 * Skeleton for chart/graph
 */
export function SkeletonChart() {
  return (
    <div className={styles.chartSkeleton}>
      <div className={styles.chartBar} />
      <div className={styles.chartBar} />
      <div className={styles.chartBar} />
    </div>
  );
}

/**
 * Compound skeleton for dashboard
 */
export function SkeletonDashboard() {
  return (
    <div className={styles.dashboardSkeleton}>
      <div className={styles.header}>
        <SkeletonBox height="1.75rem" width="200px" />
      </div>
      <div className={styles.widgets}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.widget}>
            <SkeletonBox height="1rem" width="80%" className={styles.mb} />
            <SkeletonBox height="2rem" width="100%" />
          </div>
        ))}
      </div>
    </div>
  );
}
