import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { useBillingPlan, useCheckoutSession, useBillingPortal } from '../../hooks/useQueries';
import styles from './BillingPage.module.css';

const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    period: 'Forever',
    features: [
      'Up to 10 job applications',
      'Basic job tracking',
      'Email support',
    ],
  },
  pro: {
    name: 'Pro',
    price: 9,
    period: '/month',
    features: [
      'Unlimited job applications',
      'Gmail sync',
      'AI job extraction',
      'Kanban board',
      'Basic analytics',
      'Priority support',
    ],
  },
  elite: {
    name: 'Elite',
    price: 24,
    period: '/month',
    features: [
      'All Pro features',
      'AI cover letter generator',
      'AI interview coach',
      'Multi-inbox support',
      'Advanced analytics',
      'VIP support',
    ],
  },
};

/**
 * BillingPage - Subscription and payment management
 */
export function BillingPage() {
  const user = useAuthStore((state) => state.user);
  const { data: billingPlan, isLoading } = useBillingPlan();
  const checkoutMutation = useCheckoutSession();
  const portalMutation = useBillingPortal();
  const success = useUIStore((state) => state.success);
  const error = useUIStore((state) => state.error);

  const currentTier = user?.role || 'free';

  async function handleSelect(tier) {
    if (tier === currentTier) {
      return;
    }

    try {
      await checkoutMutation.mutateAsync(tier);
    } catch (err) {
      error(err.message || 'Failed to initiate checkout');
    }
  }

  async function handleManageSubscription() {
    try {
      await portalMutation.mutateAsync();
    } catch (err) {
      error('Failed to open billing portal');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Billing & Plans</h1>
        <p className={styles.subtitle}>
          Manage your subscription and payment method
        </p>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Loading billing info...</div>
      ) : (
        <>
          {/* Current Plan Info */}
          <div className={styles.currentPlan}>
            <h2 className={styles.sectionTitle}>Current Plan</h2>
            <div className={styles.planInfo}>
              <div>
                <p className={styles.label}>Active Plan</p>
                <p className={styles.value}>
                  {PLANS[currentTier].name}
                </p>
              </div>

              {billingPlan?.subscriptionStatus !== 'free' && (
                <>
                  <div>
                    <p className={styles.label}>Billing Cycle</p>
                    <p className={styles.value}>Monthly</p>
                  </div>

                  {billingPlan?.planExpires && (
                    <div>
                      <p className={styles.label}>Renews</p>
                      <p className={styles.value}>
                        {new Date(billingPlan.planExpires).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {billingPlan?.subscriptionStatus !== 'free' && (
              <button
                className={styles.manageBtn}
                onClick={handleManageSubscription}
                disabled={portalMutation.isPending}
              >
                {portalMutation.isPending ? 'Loading...' : 'Manage Subscription'}
              </button>
            )}
          </div>

          {/* Plans Comparison */}
          <div className={styles.plansSection}>
            <h2 className={styles.sectionTitle}>Choose Your Plan</h2>
            <div className={styles.plansGrid}>
              {Object.entries(PLANS).map(([key, plan]) => (
                <PlanCard
                  key={key}
                  tier={key}
                  plan={plan}
                  isCurrent={currentTier === key}
                  onSelect={() => handleSelect(key)}
                  isLoading={checkoutMutation.isPending}
                />
              ))}
            </div>
          </div>

          {/* Usage & Settings */}
          <div className={styles.usage}>
            <h2 className={styles.sectionTitle}>Usage & Limits</h2>
            <div className={styles.usageGrid}>
              <UsageItem
                label="Jobs Tracked"
                current={billingPlan?.jobsTracked || 0}
                limit={currentTier === 'free' ? 10 : 'Unlimited'}
              />
              <UsageItem
                label="AI Calls This Month"
                current={billingPlan?.aiCallsThisMonth || 0}
                limit={currentTier === 'free' ? 0 : 'Unlimited'}
              />
              <UsageItem
                label="Storage"
                current={billingPlan?.storageUsedGB || 0}
                limit="20 GB"
              />
            </div>
          </div>

          {/* Billing History */}
          <div className={styles.history}>
            <h2 className={styles.sectionTitle}>Billing History</h2>
            <div className={styles.table}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {billingPlan?.invoices?.map((inv) => (
                    <tr key={inv.id}>
                      <td>{new Date(inv.date).toLocaleDateString()}</td>
                      <td>{inv.description}</td>
                      <td>${(inv.amount / 100).toFixed(2)}</td>
                      <td>
                        <span className={`${styles.status} ${styles[inv.status]}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PlanCard({ tier, plan, isCurrent, onSelect, isLoading }) {
  const isUpgrade = tier !== 'free' && tier !== 'free';

  return (
    <div className={`${styles.planCard} ${isCurrent ? styles.current : ''}`}>
      {isCurrent && <div className={styles.badge}>Current Plan</div>}

      <h3 className={styles.planName}>{plan.name}</h3>

      <div className={styles.pricing}>
        {plan.price > 0 ? (
          <>
            <span className={styles.price}>${plan.price}</span>
            <span className={styles.period}>{plan.period}</span>
          </>
        ) : (
          <span className={styles.free}>Always Free</span>
        )}
      </div>

      <ul className={styles.features}>
        {plan.features.map((feature, idx) => (
          <li key={idx}>
            <span className={styles.checkmark}>✓</span>
            {feature}
          </li>
        ))}
      </ul>

      {!isCurrent && (
        <button
          className={styles.selectBtn}
          onClick={onSelect}
          disabled={isLoading}
        >
          {isLoading ? 'Processing...' : 'Select Plan'}
        </button>
      )}

      {isCurrent && (
        <button className={styles.selectBtn} disabled>
          Current Plan
        </button>
      )}
    </div>
  );
}

function UsageItem({ label, current, limit }) {
  const percentage =
    typeof limit === 'number' ? Math.round((current / limit) * 100) : 0;

  return (
    <div className={styles.usageItem}>
      <div className={styles.usageHeader}>
        <p className={styles.usageLabel}>{label}</p>
        <p className={styles.usageValue}>
          {current} / {limit}
        </p>
      </div>
      {typeof limit === 'number' && (
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
