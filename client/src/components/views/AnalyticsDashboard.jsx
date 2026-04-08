import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  FunnelChart,
  Funnel,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import styles from './AnalyticsDashboard.module.css';

/**
 * AnalyticsDashboard - Job tracking analytics and stats
 */
export function AnalyticsDashboard({ jobs = [], syncStats = {} }) {
  // Prepare data for charts
  const statusDistribution = getStatusDistribution(jobs);
  const applicationTrend = getApplicationTrend(jobs);
  const funnelData = getFunnelData(jobs);
  const timeToResult = getTimeToResult(jobs);

  return (
    <div className={styles.dashboard}>
      <h2 className={styles.title}>Analytics</h2>

      <div className={styles.grid}>
        {/* Status Distribution */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Application Trend */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Applications Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={applicationTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#8b5cf6" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion Funnel */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Conversion Funnel</h3>
          <ResponsiveContainer width="100%" height={300}>
            <FunnelChart>
              <Tooltip />
              <Funnel data={funnelData} dataKey="count" shape="smooth">
                {funnelData.map((entry, index) => (
                  <Bar key={`bar-${index}`} dataKey="count" fill={entry.color} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>

        {/* Stats Cards */}
        <div className={styles.statsGrid}>
          <StatCard
            label="Total Applications"
            value={jobs.length}
            icon="📋"
          />
          <StatCard
            label="Average Time to Interview"
            value={`${timeToResult.avgDaysToInterview || 0}d`}
            icon="⏱️"
          />
          <StatCard
            label="Interview Rate"
            value={`${calculateInterviewRate(jobs)}%`}
            icon="📊"
          />
          <StatCard
            label="Offer Rate"
            value={`${calculateOfferRate(jobs)}%`}
            icon="🎉"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statContent}>
        <p className={styles.statLabel}>{label}</p>
        <p className={styles.statValue}>{value}</p>
      </div>
    </div>
  );
}

// Helper functions

function getStatusDistribution(jobs) {
  const statuses = {};
  jobs.forEach((job) => {
    const status = job.status || 'no-status';
    statuses[status] = (statuses[status] || 0) + 1;
  });

  return Object.entries(statuses).map(([status, count]) => ({
    status: status.charAt(0).toUpperCase() + status.slice(1),
    count,
  }));
}

function getApplicationTrend(jobs) {
  const dateMap = {};

  jobs
    .filter((job) => job.applied_date)
    .forEach((job) => {
      const date = new Date(job.applied_date).toLocaleDateString();
      dateMap[date] = (dateMap[date] || 0) + 1;
    });

  return Object.entries(dateMap)
    .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB))
    .map(([date, count]) => ({ date, count }))
    .slice(-14); // Last 14 days
}

function getFunnelData(jobs) {
  const applied = jobs.length;
  const screening = jobs.filter((j) => j.status === 'screening').length;
  const interview = jobs.filter((j) => j.status === 'interview').length;
  const offer = jobs.filter((j) => j.status === 'offer').length;

  return [
    { name: 'Applied', count: applied, color: '#3b82f6' },
    { name: 'Screening', count: screening || 1, color: '#8b5cf6' },
    { name: 'Interview', count: interview || 1, color: '#06b6d4' },
    { name: 'Offer', count: offer || 1, color: '#10b981' },
  ];
}

function getTimeToResult(jobs) {
  let totalDays = 0;
  let count = 0;

  jobs
    .filter((job) => job.applied_date && job.last_updated)
    .forEach((job) => {
      const appliedDate = new Date(job.applied_date);
      const resultDate = new Date(job.last_updated);
      const days = Math.floor(
        (resultDate.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      totalDays += days;
      count++;
    });

  return {
    avgDaysToInterview: count > 0 ? Math.round(totalDays / count) : 0,
  };
}

function calculateInterviewRate(jobs) {
  if (jobs.length === 0) return 0;
  const interviews = jobs.filter((j) => j.status === 'interview').length;
  return Math.round((interviews / jobs.length) * 100);
}

function calculateOfferRate(jobs) {
  if (jobs.length === 0) return 0;
  const offers = jobs.filter((j) => j.status === 'offer').length;
  return Math.round((offers / jobs.length) * 100);
}
