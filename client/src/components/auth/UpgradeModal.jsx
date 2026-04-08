import React from 'react';
import { useUIStore } from '../../stores/uiStore';
import styles from './UpgradeModal.module.css';

const TIER_PRICING = {
  pro: {
    name: 'Pro',
    price: '$9',
    period: '/month',
    features: [
      'Gmail sync',
      'AI job extraction',
      'Kanban board',
      'Basic analytics',
      'Email notifications',
    ],
  },
  elite: {
    name: 'Elite',
    price: '$24',
    period: '/month',
    features: [
      'All Pro features',
      'AI cover letter generator',
      'AI interview coach',
      'Multi-inbox support',
      'Advanced analytics',
      'Priority support',
    ],
  },
};

/**
 * UpgradeModal - shows pricing and upgrade CTA when user hits tier limits
 */
export function UpgradeModal() {
  const isOpen = useUIStore((state) => state.modals.upgrade);
  const modalData = useUIStore((state) => state.modalData.upgrade = {});
  const closeModal = useUIStore((state) => state.closeModal);

  const { minTier = 'pro', feature = 'this feature' } = modalData || {};

  if (!isOpen) return null;

  const tiers = minTier === 'elite' ? ['elite'] : ['pro', 'elite'];

  return (
    <div className={styles.overlay} onClick={() => closeModal('upgrade')}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button
          className={styles.closeBtn}
          onClick={() => closeModal('upgrade')}
          aria-label="Close modal"
        >
          ×
        </button>

        <div className={styles.header}>
          <h2 className={styles.title}>Upgrade to unlock {feature}</h2>
          <p className={styles.subtitle}>
            Choose the perfect plan for your job search
          </p>
        </div>

        <div className={styles.pricingGrid}>
          {tiers.map((tier) => {
            const plan = TIER_PRICING[tier];
            return (
              <div key={tier} className={styles.priceCard}>
                <h3 className={styles.planName}>{plan.name}</h3>
                <div className={styles.pricing}>
                  <span className={styles.price}>{plan.price}</span>
                  <span className={styles.period}>{plan.period}</span>
                </div>

                <ul className={styles.featuresList}>
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className={styles.featureItem}>
                      <span className={styles.checkmark}>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button className={styles.upgradeBtn}>
                  Upgrade to {plan.name}
                </button>
              </div>
            );
          })}
        </div>

        <div className={styles.footer}>
          <p className={styles.note}>
            🎁 Get 7 days free when you upgrade today
          </p>
        </div>
      </div>
    </div>
  );
}
