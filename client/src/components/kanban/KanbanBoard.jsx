import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useJobsStore } from '../../stores/jobsStore';
import { useUIStore } from '../../stores/uiStore';
import styles from './KanbanBoard.module.css';

const STATUSES = ['applied', 'screening', 'interview', 'offer', 'rejected'];

/**
 * KanbanBoard - drag-and-drop job tracker
 */
export function KanbanBoard() {
  const jobs = useJobsStore((state) => state.jobs);
  const updateJobStatus = useJobsStore((state) => state.updateJobStatus);
  const success = useUIStore((state) => state.success);
  const error = useUIStore((state) => state.error);

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return; // Dropped outside valid zone

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return; // Dropped in same position
    }

    const newStatus = destination.droppableId;
    const result_update = await updateJobStatus(draggableId, newStatus);

    if (result_update.success) {
      success(`Job moved to ${newStatus}`);
    } else {
      error(`Failed to update job: ${result_update.error}`);
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
          />
        ))}
      </div>
    </DragDropContext>
  );
}

/**
 * KanbanColumn - individual column in board
 */
function KanbanColumn({ status, jobs }) {
  const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <Droppable droppableId={status}>
      {(provided, snapshot) => (
        <div
          className={`${styles.column} ${snapshot.isDraggingOver ? styles.active : ''}`}
          {...provided.droppableProps}
          ref={provided.innerRef}
        >
          <div className={styles.columnHeader}>
            <h3 className={styles.columnTitle}>{displayStatus}</h3>
            <span className={styles.jobCount}>{jobs.length}</span>
          </div>

          <div className={styles.jobsList}>
            {jobs.map((job, index) => (
              <Draggable key={job.id} draggableId={job.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`${styles.jobCard} ${
                      snapshot.isDragging ? styles.dragging : ''
                    }`}
                  >
                    <JobCard job={job} />
                  </div>
                )}
              </Draggable>
            ))}
          </div>

          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}

/**
 * JobCard - individual job application card
 */
function JobCard({ job }) {
  return (
    <div className={styles.card}>
      <h4 className={styles.cardTitle}>{job.title || 'Untitled'}</h4>
      <p className={styles.cardCompany}>{job.company || 'Unknown'}</p>

      {job.applied_date && (
        <p className={styles.cardMeta}>
          Applied: {new Date(job.applied_date).toLocaleDateString()}
        </p>
      )}

      {job.contact && (
        <p className={styles.cardContact}>
          <span className={styles.contactLabel}>👤</span> {job.contact}
        </p>
      )}
    </div>
  );
}
