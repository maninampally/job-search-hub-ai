import React, { useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import styles from './OnboardingChecklist.module.css';

const ONBOARDING_STEPS = [
  {
    id: 'email-verified',
    title: 'Verify Your Email',
    description: 'Confirm your email address to activate your account',
    icon: '✉️',
  },
  {
    id: 'mfa-enabled',
    title: 'Enable Two-Factor Auth',
    description: 'Secure your account with MFA',
    icon: '🔐',
  },
  {
    id: 'gmail-sync',
    title: 'Connect Gmail',
    description: 'Sync your job application emails',
    icon: '📧',
  },
  {
    id: 'profile-complete',
    title: 'Complete Your Profile',
    description: 'Add your resume and contact details',
    icon: '👤',
  },
];

/**
 * OnboardingChecklist - 4-step onboarding widget
 */
export function OnboardingChecklist({ userState = {} }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const openModal = useUIStore((state) => state.openModal);

  const completed = ONBOARDING_STEPS.filter((step) => {
    if (step.id === 'email-verified') return userState.email_verified;
    if (step.id === 'mfa-enabled') return userState.mfa_enabled;
    if (step.id === 'gmail-sync') return userState.gmail_connected;
    if (step.id === 'profile-complete') return userState.profile_complete;
    return false;
  }).length;

  const completionPercentage = Math.round((completed / ONBOARDING_STEPS.length) * 100);
  const allComplete = completed === ONBOARDING_STEPS.length;

  if (allComplete) {
    return null; // Don't show if all complete
  }

  return (
    <div className={styles.widget}>
      <div className={styles.header} onClick={() => setIsCollapsed(!isCollapsed)}>
        <h3 className={styles.title}>
          <span className={styles.icon}>🚀</span>
          Get Started
        </h3>
        <div className={styles.progress}>
          <span className={styles.percentage}>{completionPercentage}%</span>
          <button
            className={styles.toggleBtn}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>

          <div className={styles.steps}>
            {ONBOARDING_STEPS.map((step) => {
              const isComplete =
                (step.id === 'email-verified' && userState.email_verified) ||
                (step.id === 'mfa-enabled' && userState.mfa_enabled) ||
                (step.id === 'gmail-sync' && userState.gmail_connected) ||
                (step.id === 'profile-complete' && userState.profile_complete);

              return (
                <ChecklistItem
                  key={step.id}
                  step={step}
                  isComplete={isComplete}
                  onAction={() => {
                    if (step.id === 'email-verified') {
                      // Trigger email verification
                    } else if (step.id === 'mfa-enabled') {
                      openModal('mfaSetup');
                    } else if (step.id === 'gmail-sync') {
                      // Trigger Gmail connection
                    } else if (step.id === 'profile-complete') {
                      // Navigate to profile
                    }
                  }}
                />
              );
            })}
          </div>

          <div className={styles.footer}>
            <p className={styles.footerText}>
              {completed} of {ONBOARDING_STEPS.length} steps complete
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function ChecklistItem({ step, isComplete, onAction }) {
  return (
    <div className={`${styles.step} ${isComplete ? styles.completed : ''}`}>
      <div className={styles.checkbox}>
        {isComplete ? <span className={styles.checkmark}>✓</span> : <span />}
      </div>

      <div className={styles.stepContent}>
        <p className={styles.stepTitle}>{step.title}</p>
        <p className={styles.stepDescription}>{step.description}</p>
      </div>

      {!isComplete && (
        <button className={styles.actionBtn} onClick={onAction}>
          Start
        </button>
      )}
    </div>
  );
}
