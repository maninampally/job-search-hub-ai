import { useState } from "react";
import styles from "./AppShell.module.css";

const NAV_ITEMS = [
  { label: "Dashboard", badge: null },
  { label: "Job Tracker", badge: 12, badgeType: "blue" },
  { label: "Outreach", badge: null },
  { label: "Reminders", badge: 3, badgeType: "red" },
  { label: "Contacts", badge: null },
  { label: "Resumes", badge: null },
  { label: "Interview Prep", badge: null },
  { label: "Templates", badge: null },
];

const MOBILE_TABS = [
  { label: "Home", view: "Dashboard" },
  { label: "Jobs", view: "Job Tracker" },
  { label: "Outreach", view: "Outreach" },
  { label: "Remind", view: "Reminders" },
  { label: "More", view: "Templates" },
];

export function AppShell({ 
  children, 
  activeView = "Job Tracker", 
  onNavigate,
  user = { name: "Mani K.", role: "Data Engineer", initials: "MK" },
  pageTitle = "Job Tracker",
  pageSubtitle = "12 active applications",
  onAddJob,
  onSyncGmail,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (label) => {
    if (onNavigate) {
      onNavigate(label);
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className={styles.shell}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        {/* Logo Section */}
        <div className={styles.logo}>
          <div className={styles.logoIcon} />
          <span className={styles.logoText}>Job Search Hub</span>
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`${styles.navItem} ${activeView === item.label ? styles.active : ""}`}
              onClick={() => handleNavClick(item.label)}
            >
              <div className={styles.navIcon} />
              <span className={styles.navLabel}>{item.label}</span>
              {item.badge && (
                <span 
                  className={`${styles.badge} ${item.badgeType === "red" ? styles.badgeRed : styles.badgeBlue}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User Section */}
        <div className={styles.userSection}>
          <div className={styles.avatar}>
            <span>{user.initials}</span>
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userRole}>{user.role}</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={styles.main}>
        {/* Top Bar */}
        <header className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <h1 className={styles.pageTitle}>{pageTitle}</h1>
            <p className={styles.pageSubtitle}>{pageSubtitle}</p>
          </div>
          <div className={styles.topBarRight}>
            <button 
              type="button" 
              className={styles.ghostButton}
              onClick={onAddJob}
            >
              Add job
            </button>
            <button 
              type="button" 
              className={styles.primaryButton}
              onClick={onSyncGmail}
            >
              Sync Gmail
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className={styles.content}>
          {children || (
            <div className={styles.placeholder}>
              Page content here
            </div>
          )}
        </main>
      </div>

      {/* Mobile Tab Bar */}
      <nav className={styles.mobileTabBar}>
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.view}
            type="button"
            className={`${styles.mobileTab} ${activeView === tab.view ? styles.mobileTabActive : ""}`}
            onClick={() => handleNavClick(tab.view)}
          >
            <div className={styles.mobileTabIcon} />
            <span className={styles.mobileTabLabel}>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default AppShell;
