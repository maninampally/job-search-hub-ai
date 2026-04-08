import React from "react";
import styles from "./MobileTabBar.module.css";

const MOBILE_TABS = [
  { label: "Home",     view: "Dashboard" },
  { label: "Jobs",     view: "Job Tracker" },
  { label: "Contacts", view: "Contacts" },
  { label: "Remind",   view: "Reminders" },
  { label: "More",     view: "Templates" },
];

export function MobileTabBar({ activeView, onNavigate }) {
  return (
    <nav className={styles.tabBar} aria-label="Mobile navigation">
      {MOBILE_TABS.map((tab) => (
        <button
          key={tab.view}
          type="button"
          className={`${styles.tab} ${activeView === tab.view ? styles.active : ""}`}
          onClick={() => onNavigate(tab.view)}
        >
          <span className={styles.label}>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
