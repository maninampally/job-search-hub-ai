import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import * as api from '../../api/backend';
import styles from './SessionsPanel.module.css';

/**
 * SessionsPanel - Device and session management
 */
export function SessionsPanel() {
  const isOpen = useUIStore((state) => state.modals.sessions);
  const closeModal = useUIStore((state) => state.closeModal);
  const success = useUIStore((state) => state.success);
  const error = useUIStore((state) => state.error);

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  async function fetchSessions() {
    setLoading(true);
    try {
      const response = await api.getSessions();
      setSessions(response.sessions || []);
    } catch (err) {
      error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }

  async function deleteSession(sessionId) {
    setDeleting(sessionId);
    try {
      await api.deleteSession(sessionId);
      setSessions(sessions.filter((s) => s.id !== sessionId));
      success('Session ended');
    } catch (err) {
      error('Failed to end session');
    } finally {
      setDeleting(null);
    }
  }

  async function deleteAllOtherSessions() {
    if (!confirm('End all other sessions? You will need to log in on those devices.')) {
      return;
    }

    setDeleting('all');
    try {
      await api.deleteOtherSessions();
      // Keep only current session
      const currentSession = sessions.find((s) => s.is_current);
      setSessions(currentSession ? [currentSession] : []);
      success('All other sessions ended');
    } catch (err) {
      error('Failed to end sessions');
    } finally {
      setDeleting(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={() => closeModal('sessions')}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Active Sessions</h2>
          <button
            className={styles.closeBtn}
            onClick={() => closeModal('sessions')}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className={styles.empty}>No active sessions</div>
          ) : (
            <>
              <p className={styles.description}>
                These are the devices and locations where you're currently logged in.
              </p>

              <div className={styles.sessionsList}>
                {sessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    onDelete={() => deleteSession(session.id)}
                    isDeleting={deleting === session.id}
                  />
                ))}
              </div>

              {sessions.length > 1 && (
                <button
                  className={styles.deleteAllBtn}
                  onClick={deleteAllOtherSessions}
                  disabled={deleting === 'all'}
                >
                  {deleting === 'all' ? 'Ending sessions...' : 'End all other sessions'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionItem({ session, onDelete, isDeleting }) {
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const parseUserAgent = (ua) => {
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edge')) return 'Edge';
    if (ua.includes('Mobile')) return 'Mobile';
    return 'Unknown Browser';
  };

  const getDeviceIcon = (ua) => {
    if (ua.includes('Mobile') || ua.includes('iPhone')) return '📱';
    if (ua.includes('Mac')) return '🍎';
    if (ua.includes('Windows')) return '🪟';
    if (ua.includes('Linux')) return '🐧';
    return '💻';
  };

  return (
    <div className={`${styles.sessionCard} ${session.is_current ? styles.current : ''}`}>
      <div className={styles.sessionIcon}>
        {getDeviceIcon(session.user_agent)}
      </div>

      <div className={styles.sessionInfo}>
        <div className={styles.sessionHeader}>
          <div>
            <p className={styles.sessionBrowser}>
              {parseUserAgent(session.user_agent)}
            </p>
            {session.is_current && <span className={styles.badge}>Current</span>}
          </div>
          {!session.is_current && (
            <button
              className={styles.deleteBtn}
              onClick={onDelete}
              disabled={isDeleting}
              aria-label="End session"
              title="End this session"
            >
              {isDeleting ? '...' : '×'}
            </button>
          )}
        </div>

        <p className={styles.sessionLocation}>
          {session.ip_address && `IP: ${session.ip_address}`}
        </p>

        <p className={styles.sessionTime}>
          Last active: {formatDate(session.last_active)}
        </p>
      </div>
    </div>
  );
}
