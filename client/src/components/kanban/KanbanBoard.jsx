import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useJobsStore } from '../../stores/jobsStore';
import { useUIStore } from '../../stores/uiStore';
import styles from './KanbanBoard.module.css';

const STATUSES = ['Wishlist', 'Applied', 'Screening', 'Interview', 'Offer', 'Rejected'];

const STATUS_LABELS = {
  Wishlist: 'Wishlist',
  Applied: 'Applied',
  Screening: 'Screening',
  Interview: 'Interview',
  Offer: 'Offer',
  Rejected: 'Rejected',
};

/**
 * KanbanBoard - drag-and-drop job tracker with 6 columns
 */
export function KanbanBoard({ onJobClick, onAddJob }) {
  const jobs = useJobsStore((state) => state.jobs);
  const updateJobStatus = useJobsStore((state) => state.updateJobStatus);
  const success = useUIStore((state) => state.success);
  const error = useUIStore((state) => state.error);

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const newStatus = destination.droppableId;
    const updateResult = await updateJobStatus(draggableId, newStatus);

    if (updateResult.success) {
      success(`Job moved to ${STATUS_LABELS[newStatus]}`);
    } else {
      error(`Failed to update job: ${updateResult.error}`);
    }
  };

  const groupedJobs = STATUSES.reduce((acc, status) => {
    acc[status] = jobs.filter((job) => job.status === status);
    return acc;
  }, {});

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className={styles.board}>
        {STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            jobs={groupedJobs[status] || []}
            onJobClick={onJobClick}
            onAddJob={onAddJob}
          />
        ))}
      </div>
    </DragDropContext>
  );
}

/**
 * KanbanColumn - individual column
 */
function KanbanColumn({ status, jobs, onJobClick, onAddJob }) {
  const columnClass = `column${status}`;

  return (
    <Droppable droppableId={status}>
      {(provided, snapshot) => (
        <div
          className={`${styles.column} ${styles[columnClass]} ${snapshot.isDraggingOver ? styles.active : ''}`}
          {...provided.droppableProps}
          ref={provided.innerRef}
        >
          <div className={styles.columnHeader}>
            <h3 className={styles.columnTitle}>{STATUS_LABELS[status]}</h3>
            <span className={styles.jobCount}>{jobs.length}</span>
          </div>

          <div className={styles.jobsList}>
            {jobs.length === 0 ? (
              <div className={styles.emptyColumn}>
                Drop jobs here or click + to add
              </div>
            ) : (
              jobs.map((job, index) => (
                <Draggable key={job.id} draggableId={job.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`${styles.jobCard} ${snapshot.isDragging ? styles.dragging : ''}`}
                      onClick={() => onJobClick?.(job)}
                    >
                      <JobCard job={job} />
                    </div>
                  )}
                </Draggable>
              ))
            )}
            {provided.placeholder}
          </div>

          <button 
            type="button" 
            className={styles.addJobButton}
            onClick={() => onAddJob?.(status)}
          >
            <span className={styles.addIcon}>+</span>
            Add job
          </button>
        </div>
      )}
    </Droppable>
  );
}

/**
 * JobCard - individual job card
 */
function JobCard({ job }) {
  const emailCount = job.emails?.length || 0;
  const hasUnread = job.emails?.some(e => !e.isRead) || false;

  return (
    <div className={styles.card}>
      <h4 className={styles.cardTitle}>{job.title || job.role || 'Untitled'}</h4>
      <p className={styles.cardCompany}>{job.company || 'Unknown Company'}</p>

      {job.location && (
        <p className={styles.cardLocation}>
          <LocationIcon />
          {job.location}
        </p>
      )}

      {job.applied_date && (
        <p className={styles.cardMeta}>
          <CalendarIcon />
          {new Date(job.applied_date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          })}
        </p>
      )}

      {job.contact && (
        <p className={styles.cardContact}>
          <span className={styles.contactIcon}>
            <UserIcon />
          </span>
          {job.contact}
        </p>
      )}

      {emailCount > 0 && (
        <div className={`${styles.emailBadge} ${hasUnread ? styles.hasUnread : ''}`}>
          <MailIcon />
          {emailCount} email{emailCount !== 1 ? 's' : ''}
          {hasUnread && <span className={styles.unreadDot} />}
        </div>
      )}
    </div>
  );
}

// Simple SVG icons
function LocationIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

export default KanbanBoard;
