import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import * as api from '../../api/backend';
import styles from './MFASetupModal.module.css';

/**
 * MFASetupModal - 3-step MFA enrollment flow
 * Step 1: Show QR code + backup codes
 * Step 2: Verify TOTP code from authenticator
 * Step 3: Confirmation
 */
export function MFASetupModal() {
  const isOpen = useUIStore((state) => state.modals.mfaSetup);
  const closeModal = useUIStore((state) => state.closeModal);
  const success = useUIStore((state) => state.success);
  const error = useUIStore((state) => state.error);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [code, setCode] = useState('');
  const [backupCodesCopied, setBackupCodesCopied] = useState(false);
  const [errors, setErrors] = useState({});

  // Fetch QR code on modal open
  useEffect(() => {
    if (isOpen && step === 1 && !setupData) {
      fetchSetup();
    }
  }, [isOpen, step, setupData]);

  async function fetchSetup() {
    setLoading(true);
    try {
      const response = await api.setupMFA();
      setSetupData(response);
    } catch (err) {
      error('Failed to set up MFA. Please try again.');
      closeModal('mfaSetup');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (!code || code.length !== 6) {
      setErrors({ code: 'Please enter a valid 6-digit code' });
      return;
    }

    setLoading(true);
    try {
      const response = await api.verifyMFA(code);
      if (response.success) {
        success('MFA enabled successfully!');
        setStep(3); // Show confirmation
      } else {
        setErrors({ code: response.error || 'Invalid code' });
      }
    } catch (err) {
      setErrors({ code: err.message || 'Verification failed' });
    } finally {
      setLoading(false);
    }
  }

  function copyBackupCodes() {
    if (setupData?.backupCodes) {
      const text = setupData.backupCodes.join('\n');
      navigator.clipboard.writeText(text);
      setBackupCodesCopied(true);
      setTimeout(() => setBackupCodesCopied(false), 2000);
    }
  }

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={() => closeModal('mfaSetup')}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button
          className={styles.closeBtn}
          onClick={() => closeModal('mfaSetup')}
          aria-label="Close modal"
        >
          ×
        </button>

        {/* Step 1: QR Code + Backup Codes */}
        {step === 1 && (
          <div className={styles.step}>
            <div className={styles.header}>
              <h2 className={styles.title}>Enable Two-Factor Authentication</h2>
              <p className={styles.subtitle}>Step 1 of 2</p>
            </div>

            {loading ? (
              <div className={styles.loading}>Setting up...</div>
            ) : setupData ? (
              <>
                <div className={styles.content}>
                  <div className={styles.qrSection}>
                    <p className={styles.instruction}>
                      Scan this QR code with your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc)
                    </p>
                    <img
                      src={setupData.qrCodeUrl}
                      alt="MFA QR Code"
                      className={styles.qrCode}
                    />
                  </div>

                  <div className={styles.divider}>or enter manually</div>

                  <div className={styles.manualEntry}>
                    <code className={styles.secret}>{setupData.secret}</code>
                  </div>

                  <div className={styles.backupCodesSection}>
                    <h3 className={styles.backupTitle}>Save your backup codes</h3>
                    <p className={styles.backupDescription}>
                      Save these codes in a secure location. You can use them to access your account if you lose your authenticator device.
                    </p>
                    <div className={styles.codesList}>
                      {setupData.backupCodes?.map((code, i) => (
                        <div key={i} className={styles.code}>
                          {code}
                        </div>
                      ))}
                    </div>
                    <button
                      className={styles.copyBtn}
                      onClick={copyBackupCodes}
                    >
                      {backupCodesCopied ? '✓ Copied!' : 'Copy Codes'}
                    </button>
                  </div>
                </div>

                <div className={styles.footer}>
                  <button
                    className={styles.primaryBtn}
                    onClick={() => {
                      setStep(2);
                      setCode('');
                      setErrors({});
                    }}
                  >
                    Next: Verify Code
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Step 2: Verify TOTP Code */}
        {step === 2 && (
          <div className={styles.step}>
            <div className={styles.header}>
              <h2 className={styles.title}>Verify Your Code</h2>
              <p className={styles.subtitle}>Step 2 of 2</p>
            </div>

            <div className={styles.content}>
              <p className={styles.instruction}>
                Enter the 6-digit code from your authenticator app to confirm MFA setup
              </p>

              <div className={styles.inputGroup}>
                <input
                  type="text"
                  maxLength="6"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ''));
                    setErrors({});
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && code.length === 6) {
                      verifyCode();
                    }
                  }}
                  className={`${styles.input} ${errors.code ? styles.inputError : ''}`}
                  autoFocus
                />
                {errors.code && (
                  <p className={styles.errorMsg}>{errors.code}</p>
                )}
              </div>
            </div>

            <div className={styles.footer}>
              <button
                className={styles.secondaryBtn}
                onClick={() => {
                  setStep(1);
                  setCode('');
                  setErrors({});
                }}
                disabled={loading}
              >
                Back
              </button>
              <button
                className={styles.primaryBtn}
                onClick={verifyCode}
                disabled={loading || code.length !== 6}
              >
                {loading ? 'Verifying...' : 'Verify & Enable'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className={styles.step}>
            <div className={styles.header}>
              <h2 className={styles.title}>Two-Factor Authentication Enabled</h2>
            </div>

            <div className={styles.content}>
              <div className={styles.success}>
                <span className={styles.successIcon}>✓</span>
              </div>

              <p className={styles.successMsg}>
                Your account is now protected with two-factor authentication
              </p>

              <div className={styles.info}>
                <h4>What's next?</h4>
                <ul>
                  <li>Keep your authenticator app installed and secure</li>
                  <li>Store your backup codes in a safe place</li>
                  <li>You'll need your authenticator code to log in</li>
                </ul>
              </div>
            </div>

            <div className={styles.footer}>
              <button
                className={styles.primaryBtn}
                onClick={() => closeModal('mfaSetup')}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
