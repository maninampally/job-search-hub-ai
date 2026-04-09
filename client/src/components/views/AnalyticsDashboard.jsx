import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import styles from './AnalyticsDashboard.module.css';

/**
 * AnalyticsDashboard - Job tracking analytics with stat cards and charts
 */
export function AnalyticsDashboard({ jobs = [] }) {
  const [period, setPeriod] = useState('30d');

  // Calculate stats
  const totalApplications = jobs.length;
  const interviewCount = jobs.filter(j => j.status === 'Interview' || j.status === 'interview').length;
  const offerCount = jobs.filter(j => j.status === 'Offer' || j.status === 'offer').length;
  const rejectedCount = jobs.filter(j => j.status === 'Rejected' || j.status === 'rejected').length;
  
  const responseRate = totalApplications > 0 
    ? Math.round(((interviewCount + offerCount + rejectedCount) / totalApplications) * 100) 
    : 0;
  
  const interviewRate = totalApplications > 0 
    ? Math.round((interviewCount / totalApplications) * 100) 
    : 0;

  // Chart data
  const applicationTrend = getApplicationTrend(jobs, period);
  const funnelData = getFunnelData(jobs);
  const recentActivity = getRecentActivity(jobs);

  // Weekly goal (example: 10 applications per week)
  const weeklyGoal = 10;
  const thisWeekApps = getThisWeekApplications(jobs);
  const goalProgress = Math.min(100, Math.round((thisWeekApps / weeklyGoal) * 100));

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>Analytics</h1>
        <select 
          className={styles.periodSelect}
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </header>

      {/* Stat Cards */}
      <div className={styles.statsGrid}>
        <StatCard
          label="Total Applications"
          value={totalApplications}
          change={getChangeFromPrevious(jobs, 'total', period)}
          iconClass={styles.statIconBlue}
          icon={<BriefcaseIcon />}
        />
        <StatCard
          label="Response Rate"
          value={`${responseRate}%`}
          change={getChangeFromPrevious(jobs, 'response', period)}
          iconClass={styles.statIconPurple}
          icon={<ChartIcon />}
        />
        <StatCard
          label="Interviews"
          value={interviewCount}
          change={getChangeFromPrevious(jobs, 'interviews', period)}
          iconClass={styles.statIconGreen}
          icon={<CalendarIcon />}
        />
        <StatCard
          label="Offers"
          value={offerCount}
          change={getChangeFromPrevious(jobs, 'offers', period)}
          iconClass={styles.statIconOrange}
          icon={<TrophyIcon />}
        />
      </div>

      {/* Charts Row */}
      <div className={styles.chartsGrid}>
        {/* Applications Over Time */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Applications Over Time</h3>
            <div className={styles.chartLegend}>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#2563eb' }} />
                Applications
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={applicationTrend}>
              <defs>
                <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <Tooltip 
                contentStyle={{ 
                  background: '#ffffff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="count" 
                stroke="#2563eb" 
                strokeWidth={2}
                fill="url(#colorApps)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion Funnel */}
        <div className={styles.funnelCard}>
          <h3 className={styles.chartTitle}>Conversion Funnel</h3>
          <div className={styles.funnelList}>
            {funnelData.map((item) => (
              <div key={item.name} className={styles.funnelItem}>
                <span className={styles.funnelLabel}>{item.name}</span>
                <div 
                  className={`${styles.funnelBar} ${styles[item.barClass]}`}
                  style={{ width: `${item.percentage}%`, minWidth: item.count > 0 ? '40px' : '0' }}
                >
                  {item.count}
                </div>
                <span className={styles.funnelValue}>{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className={styles.bottomGrid}>
        {/* Weekly Goal */}
        <div className={styles.goalCard}>
          <h3 className={styles.chartTitle}>Weekly Goal</h3>
          <div className={styles.goalProgress}>
            <div className={styles.goalHeader}>
              <span className={styles.goalLabel}>Applications this week</span>
              <span className={styles.goalValue}>{thisWeekApps} / {weeklyGoal}</span>
            </div>
            <div className={styles.goalBar}>
              <div 
                className={styles.goalFill} 
                style={{ width: `${goalProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className={styles.activityCard}>
          <h3 className={styles.chartTitle}>Recent Activity</h3>
          <div className={styles.activityList}>
            {recentActivity.length === 0 ? (
              <div className={styles.emptyState}>
                <span>No recent activity</span>
              </div>
            ) : (
              recentActivity.slice(0, 4).map((activity, index) => (
                <div key={index} className={styles.activityItem}>
                  <span className={`${styles.activityDot} ${styles[activity.dotClass]}`} />
                  <div className={styles.activityContent}>
                    <div className={styles.activityText}>{activity.text}</div>
                    <div className={styles.activityTime}>{activity.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * StatCard component
 */
function StatCard({ label, value, change, iconClass, icon }) {
  const changeClass = change > 0 
    ? styles.statChangeUp 
    : change < 0 
      ? styles.statChangeDown 
      : styles.statChangeNeutral;

  return (
    <div className={styles.statCard}>
      <div className={styles.statHeader}>
        <span className={styles.statLabel}>{label}</span>
        <span className={`${styles.statIcon} ${iconClass}`}>{icon}</span>
      </div>
      <div className={styles.statValue}>{value}</div>
      <div className={`${styles.statChange} ${changeClass}`}>
        {change > 0 && <ArrowUpIcon />}
        {change < 0 && <ArrowDownIcon />}
        {change !== 0 ? `${Math.abs(change)}% vs last period` : 'No change'}
      </div>
    </div>
  );
}

// Helper functions
function getApplicationTrend(jobs, period) {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
  const dateMap = {};
  const now = new Date();

  // Initialize with zeros
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    dateMap[key] = 0;
  }

  // Count applications
  jobs.forEach((job) => {
    if (job.applied_date || job.appliedDate) {
      const date = new Date(job.applied_date || job.appliedDate);
      const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dateMap[key] !== undefined) {
        dateMap[key]++;
      }
    }
  });

  // Sample for display (max 14 points)
  const entries = Object.entries(dateMap);
  const step = Math.ceil(entries.length / 14);
  return entries
    .filter((_, i) => i % step === 0 || i === entries.length - 1)
    .map(([date, count]) => ({ date, count }));
}

function getFunnelData(jobs) {
  const total = jobs.length || 1;
  const applied = jobs.length;
  const screening = jobs.filter(j => 
    j.status === 'Screening' || j.status === 'screening' ||
    j.status === 'Interview' || j.status === 'interview' ||
    j.status === 'Offer' || j.status === 'offer'
  ).length;
  const interview = jobs.filter(j => 
    j.status === 'Interview' || j.status === 'interview' ||
    j.status === 'Offer' || j.status === 'offer'
  ).length;
  const offer = jobs.filter(j => j.status === 'Offer' || j.status === 'offer').length;

  return [
    { name: 'Applied', count: applied, percentage: 100, barClass: 'funnelBarApplied' },
    { name: 'Screening', count: screening, percentage: Math.round((screening / total) * 100), barClass: 'funnelBarScreening' },
    { name: 'Interview', count: interview, percentage: Math.round((interview / total) * 100), barClass: 'funnelBarInterview' },
    { name: 'Offer', count: offer, percentage: Math.round((offer / total) * 100), barClass: 'funnelBarOffer' },
  ];
}

function getRecentActivity(jobs) {
  const activities = [];
  
  jobs
    .slice()
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
    .slice(0, 4)
    .forEach((job) => {
      const status = job.status || 'Applied';
      const dotClass = 
        status === 'Interview' || status === 'interview' ? 'activityDotYellow' :
        status === 'Offer' || status === 'offer' ? 'activityDotGreen' :
        status === 'Rejected' || status === 'rejected' ? 'activityDotBlue' :
        'activityDotPurple';

      activities.push({
        text: `${job.company || 'Unknown'} - ${status}`,
        time: formatRelativeTime(job.updated_at || job.created_at),
        dotClass,
      });
    });

  return activities;
}

function getThisWeekApplications(jobs) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  return jobs.filter((job) => {
    const date = new Date(job.applied_date || job.appliedDate || job.created_at);
    return date >= weekStart;
  }).length;
}

function getChangeFromPrevious(jobs, metric, period) {
  // Simplified: return random change for demo
  const changes = [5, -3, 12, 0, 8, -5, 15];
  return changes[Math.floor(Math.random() * changes.length)];
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return 'Recently';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Icons
function BriefcaseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

export default AnalyticsDashboard;
