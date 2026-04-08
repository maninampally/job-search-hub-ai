import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import * as api from '../../api/backend';
import styles from './AdminDashboard.module.css';

/**
 * AdminDashboard - System admin panel
 * Requires: role === 'admin' + mfa_passed === true
 */
export function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const error = useUIStore((state) => state.error);

  useEffect(() => {
    fetchMetrics();
  }, []);

  async function fetchMetrics() {
    setLoading(true);
    try {
      const response = await api.getAdminMetrics();
      setMetrics(response);
    } catch (err) {
      error('Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h1 className={styles.title}>Admin Dashboard</h1>
        <p className={styles.subtitle}>System administration and metrics</p>
      </div>

      <div className={styles.tabs}>
        <TabButton
          label="Overview"
          active={tab === 'overview'}
          onClick={() => setTab('overview')}
        />
        <TabButton
          label="Users"
          active={tab === 'users'}
          onClick={() => setTab('users')}
        />
        <TabButton
          label="Audit Log"
          active={tab === 'audit'}
          onClick={() => setTab('audit')}
        />
        <TabButton
          label="Settings"
          active={tab === 'settings'}
          onClick={() => setTab('settings')}
        />
      </div>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <>
            {tab === 'overview' && <OverviewTab metrics={metrics} />}
            {tab === 'users' && <UsersTab />}
            {tab === 'audit' && <AuditLogTab />}
            {tab === 'settings' && <SettingsTab />}
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      className={`${styles.tabBtn} ${active ? styles.active : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function OverviewTab({ metrics }) {
  if (!metrics) return <div>No metrics available</div>;

  return (
    <div className={styles.grid}>
      <MetricCard
        label="Total Users"
        value={metrics.totalUsers || 0}
        trend={`+${metrics.newUsersThisMonth || 0} this month`}
        icon="👥"
      />
      <MetricCard
        label="Active Subscriptions"
        value={metrics.activeSubscriptions || 0}
        trend={`${metrics.monthlyRecurringRevenue || '$0'} MRR`}
        icon="💳"
      />
      <MetricCard
        label="AI Usage"
        value={`${metrics.aiCallsThisMonth || 0} calls`}
        trend={`${metrics.costThisMonth || '$0'} cost`}
        icon="🤖"
      />
      <MetricCard
        label="Conversion Rate"
        value={`${metrics.conversionRate || 0}%`}
        trend={metrics.conversionTrend || 'stable'}
        icon="📊"
      />
    </div>
  );
}

function MetricCard({ label, value, trend, icon }) {
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricIcon}>{icon}</div>
      <div className={styles.metricContent}>
        <p className={styles.metricLabel}>{label}</p>
        <p className={styles.metricValue}>{value}</p>
        <p className={styles.metricTrend}>{trend}</p>
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const success = useUIStore((state) => state.success);
  const error = useUIStore((state) => state.error);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const response = await api.getAdminUsers({ page: 1, limit: 50 });
      setUsers(response.users || []);
    } catch (err) {
      error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function updateUserRole(userId, newRole) {
    try {
      await api.updateUserRole(userId, { role: newRole });
      success(`User role updated to ${newRole}`);
      fetchUsers();
    } catch (err) {
      error('Failed to update user role');
    }
  }

  async function suspendUser(userId) {
    if (!confirm('Are you sure? This will disable the user account.')) return;

    try {
      await api.suspendUser(userId);
      success('User suspended');
      fetchUsers();
    } catch (err) {
      error('Failed to suspend user');
    }
  }

  if (loading) return <div className={styles.loading}>Loading users...</div>;

  return (
    <div className={styles.table}>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Role</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td>{user.name || '-'}</td>
              <td>
                <select
                  value={user.role}
                  onChange={(e) => updateUserRole(user.id, e.target.value)}
                  className={styles.roleSelect}
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="elite">Elite</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td>{new Date(user.created_at).toLocaleDateString()}</td>
              <td>
                <button
                  className={styles.actionBtn}
                  onClick={() => suspendUser(user.id)}
                  title="Suspend account"
                >
                  Suspend
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditLogTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const error = useUIStore((state) => state.error);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    setLoading(true);
    try {
      const response = await api.getAuditLog({ page: 1, limit: 100 });
      setLogs(response.logs || []);
    } catch (err) {
      error('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className={styles.loading}>Loading audit log...</div>;

  return (
    <div className={styles.table}>
      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th>User</th>
            <th>Resource</th>
            <th>Timestamp</th>
            <th>IP Address</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td className={styles.action}>{log.action}</td>
              <td>{log.user_email || 'System'}</td>
              <td>{log.resource}</td>
              <td>{new Date(log.created_at).toLocaleString()}</td>
              <td className={styles.ip}>{log.ip_address}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className={styles.settings}>
      <h3>System Settings</h3>
      <p>Coming soon: Email configuration, feature flags, rate limits, etc.</p>
    </div>
  );
}
