import { useState } from 'react';
import styles from './SettingsPage.module.css';

const TABS = [
  { key: 'account', label: 'Account' },
  { key: 'security', label: 'Security' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'connections', label: 'Connections' },
];

/**
 * SettingsPage - User settings with tabs for account, security, notifications, connections
 */
export function SettingsPage({
  user = {},
  mfaEnabled = false,
  sessions = [],
  onUpdateProfile,
  onEnableMFA,
  onDisableMFA,
  onEndSession,
  onEndAllSessions,
  onConnectGoogle,
  onDisconnectGoogle,
  onDeleteAccount,
}) {
  const [activeTab, setActiveTab] = useState('account');
  const [loading, setLoading] = useState(false);

  // Form states
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [reminderNotifications, setReminderNotifications] = useState(true);

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      await onUpdateProfile?.({ name, email });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage your account preferences and security</p>
      </header>

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`${styles.tab} ${activeTab === tab.key ? styles.active : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Account Tab */}
      {activeTab === 'account' && (
        <>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Profile Information</h2>
            </div>
            <div className={styles.sectionContent}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Full Name</label>
                <input
                  type="text"
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Email Address</label>
                <input
                  type="email"
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className={styles.footer}>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  onClick={handleSaveProfile}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </section>

          <section className={`${styles.section} ${styles.dangerZone}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Danger Zone</h2>
            </div>
            <div className={styles.sectionContent}>
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <div className={styles.settingLabel}>Delete Account</div>
                  <div className={styles.settingDescription}>
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </div>
                </div>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonDanger}`}
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete your account? This cannot be undone.')) {
                      onDeleteAccount?.();
                    }
                  }}
                >
                  Delete Account
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Two-Factor Authentication</h2>
              <span className={`${styles.sectionBadge} ${mfaEnabled ? styles.badgeEnabled : styles.badgeDisabled}`}>
                {mfaEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className={styles.sectionContent}>
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <div className={styles.settingLabel}>Authenticator App</div>
                  <div className={styles.settingDescription}>
                    {mfaEnabled
                      ? 'Your account is protected with two-factor authentication using an authenticator app.'
                      : 'Add an extra layer of security by requiring a code from your authenticator app when signing in.'}
                  </div>
                </div>
                <button
                  type="button"
                  className={`${styles.button} ${mfaEnabled ? styles.buttonDanger : styles.buttonPrimary}`}
                  onClick={mfaEnabled ? onDisableMFA : onEnableMFA}
                >
                  {mfaEnabled ? 'Disable MFA' : 'Enable MFA'}
                </button>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Active Sessions</h2>
            </div>
            <div className={styles.sectionContent}>
              <div className={styles.sessionsList}>
                {sessions.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: '14px' }}>No active sessions</p>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`${styles.sessionCard} ${session.is_current ? styles.current : ''}`}
                    >
                      <div className={styles.sessionIcon}>
                        {getDeviceIcon(session.user_agent)}
                      </div>
                      <div className={styles.sessionInfo}>
                        <div className={styles.sessionDevice}>
                          {parseUserAgent(session.user_agent)}
                          {session.is_current && <span className={styles.currentBadge}>Current</span>}
                        </div>
                        <div className={styles.sessionMeta}>
                          {session.ip_address} - Last active {formatRelativeTime(session.last_active)}
                        </div>
                      </div>
                      {!session.is_current && (
                        <button
                          type="button"
                          className={styles.sessionAction}
                          onClick={() => onEndSession?.(session.id)}
                        >
                          End
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
              {sessions.length > 1 && (
                <div className={styles.footer}>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonDanger}`}
                    onClick={() => {
                      if (window.confirm('End all other sessions?')) {
                        onEndAllSessions?.();
                      }
                    }}
                  >
                    End All Other Sessions
                  </button>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Email Notifications</h2>
          </div>
          <div className={styles.sectionContent}>
            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <div className={styles.settingLabel}>Application Updates</div>
                <div className={styles.settingDescription}>
                  Get notified when there are updates to your job applications
                </div>
              </div>
              <Toggle checked={emailNotifications} onChange={setEmailNotifications} />
            </div>
            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <div className={styles.settingLabel}>Weekly Digest</div>
                <div className={styles.settingDescription}>
                  Receive a weekly summary of your job search progress
                </div>
              </div>
              <Toggle checked={weeklyDigest} onChange={setWeeklyDigest} />
            </div>
            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <div className={styles.settingLabel}>Reminder Notifications</div>
                <div className={styles.settingDescription}>
                  Get reminders for follow-ups and scheduled tasks
                </div>
              </div>
              <Toggle checked={reminderNotifications} onChange={setReminderNotifications} />
            </div>
          </div>
        </section>
      )}

      {/* Connections Tab */}
      {activeTab === 'connections' && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Connected Services</h2>
          </div>
          <div className={styles.sectionContent}>
            <div className={styles.connectedApp}>
              <div className={styles.appIcon}>
                <GoogleIcon />
              </div>
              <div className={styles.appInfo}>
                <div className={styles.appName}>Google Account</div>
                <div className={`${styles.appStatus} ${user.googleConnected ? styles.appStatusConnected : ''}`}>
                  {user.googleConnected ? 'Connected' : 'Not connected'}
                </div>
              </div>
              <button
                type="button"
                className={`${styles.button} ${user.googleConnected ? styles.buttonDanger : styles.buttonPrimary}`}
                onClick={user.googleConnected ? onDisconnectGoogle : onConnectGoogle}
              >
                {user.googleConnected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
            <div className={styles.connectedApp}>
              <div className={styles.appIcon}>
                <CalendarIcon />
              </div>
              <div className={styles.appInfo}>
                <div className={styles.appName}>Google Calendar</div>
                <div className={styles.appStatus}>Coming soon</div>
              </div>
              <button type="button" className={`${styles.button} ${styles.buttonSecondary}`} disabled>
                Connect
              </button>
            </div>
            <div className={styles.connectedApp}>
              <div className={styles.appIcon}>
                <LinkedInIcon />
              </div>
              <div className={styles.appInfo}>
                <div className={styles.appName}>LinkedIn</div>
                <div className={styles.appStatus}>Coming soon</div>
              </div>
              <button type="button" className={`${styles.button} ${styles.buttonSecondary}`} disabled>
                Connect
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// Toggle component
function Toggle({ checked, onChange }) {
  return (
    <label className={styles.toggle}>
      <input
        type="checkbox"
        className={styles.toggleInput}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.toggleSlider} />
    </label>
  );
}

// Helper functions
function parseUserAgent(ua = '') {
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edge')) return 'Edge';
  return 'Unknown Browser';
}

function getDeviceIcon(ua = '') {
  if (ua.includes('Mobile') || ua.includes('iPhone')) return '📱';
  if (ua.includes('Mac')) return '💻';
  if (ua.includes('Windows')) return '🖥️';
  if (ua.includes('Linux')) return '🐧';
  return '💻';
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Icons
function GoogleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="#0A66C2">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

export default SettingsPage;
