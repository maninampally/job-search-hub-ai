/**
 * Email Extraction Verification Component
 * Multi-step verification flow: OTP → Email Link → Extraction Enabled
 * Manages state transitions, error handling, and user feedback
 */

import React, { useState, useEffect } from 'react';
import {
  requestOTP,
  verifyOTP,
  verifyEmailToken,
  getExtractionStatus,
  formatErrorMessage
} from '../../api/emailExtraction.js';

const EmailExtractionVerification = ({ onSuccess, onCancel }) => {
  // State management
  const [step, setStep] = useState('initial'); // initial, otp_request, otp_verify, email_verify, success
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [extractionStatus, setExtractionStatus] = useState(null);

  // Check extraction status on mount
  useEffect(() => {
    checkExtractionStatus();
  }, []);

  // Countdown timer for rate limiting
  useEffect(() => {
    if (retryAfterSeconds > 0) {
      const timer = setTimeout(() => {
        setRetryAfterSeconds(retryAfterSeconds - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [retryAfterSeconds]);

  const checkExtractionStatus = async () => {
    try {
      const response = await getExtractionStatus();
      if (response.success) {
        setExtractionStatus(response.status);
        if (response.status.emailExtractionEnabled) {
          setStep('success');
          setSuccessMessage('Email extraction is already enabled');
        }
      }
    } catch (err) {
      console.error('Error checking extraction status:', err);
    }
  };

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      const response = await requestOTP(email);

      if (response.error) {
        setError(formatErrorMessage(response.error));
        if (response.error.code === 'RATE_LIMITED') {
          setRetryAfterSeconds(60);
        }
      } else {
        setMaskedEmail(response.maskedEmail);
        setStep('otp_verify');
        setSuccessMessage('OTP sent to your email');
        setOtpCode('');
      }
    } catch (err) {
      setError('Failed to request OTP. Please try again.');
      console.error('Error requesting OTP:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!otpCode.trim() || otpCode.length !== 6) {
      setError('Please enter a 6-digit OTP code');
      return;
    }

    setLoading(true);
    try {
      const response = await verifyOTP(otpCode);

      if (response.error) {
        const err = response.error;
        setError(formatErrorMessage(err));
        if (err.details?.attemptsRemaining) {
          setAttemptsRemaining(err.details.attemptsRemaining);
        }
        if (err.code === 'ACCOUNT_LOCKED' && err.details?.retryAfter) {
          setRetryAfterSeconds(err.details.retryAfter);
        }
      } else {
        setSuccessMessage('OTP verified successfully');
        if (response.verificationLink?.token) {
          setVerificationToken(response.verificationLink.token);
          setStep('email_verify');
        }
      }
    } catch (err) {
      setError('Failed to verify OTP. Please try again.');
      console.error('Error verifying OTP:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    setLoading(true);
    try {
      const response = await verifyEmailToken(verificationToken);

      if (response.error) {
        setError(formatErrorMessage(response.error));
      } else {
        setSuccessMessage('Email extraction enabled successfully!');
        setStep('success');
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (err) {
      setError('Failed to verify email. Please try again.');
      console.error('Error verifying email:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('initial');
    setEmail('');
    setOtpCode('');
    setVerificationToken('');
    setError('');
    setSuccessMessage('');
    setMaskedEmail('');
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      handleReset();
    }
  };

  // Initial step
  if (step === 'initial') {
    return (
      <div className="email-extraction-container">
        <div className="extraction-card">
          <h2>Enable Email Data Extraction</h2>
          <p>
            Allow Job Search Hub to securely extract job opportunities from your emails.
            We'll verify your identity through a secure two-step process.
          </p>

          <div className="extraction-info">
            <ul>
              <li>✓ Two-step verification (OTP + Email confirmation)</li>
              <li>✓ Your email remains secure and private</li>
              <li>✓ You can disable extraction anytime</li>
            </ul>
          </div>

          <div className="button-group">
            <button
              onClick={(e) => {
                e.preventDefault();
                setStep('otp_request');
                setError('');
                setSuccessMessage('');
              }}
              className="btn-primary"
              disabled={loading}
            >
              Enable Extraction
            </button>
            <button onClick={handleCancel} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // OTP Request step
  if (step === 'otp_request') {
    return (
      <div className="email-extraction-container">
        <div className="extraction-card">
          <h2>Enter Your Email</h2>
          <p>We'll send a 6-digit code to verify your identity</p>

          <form onSubmit={handleRequestOTP}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={loading || retryAfterSeconds > 0}
                required
              />
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {successMessage && <div className="alert alert-success">{successMessage}</div>}

            {retryAfterSeconds > 0 && (
              <div className="alert alert-info">
                Please wait {retryAfterSeconds}s before requesting again
              </div>
            )}

            <div className="button-group">
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || retryAfterSeconds > 0}
              >
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
              <button type="button" onClick={handleCancel} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // OTP Verify step
  if (step === 'otp_verify') {
    return (
      <div className="email-extraction-container">
        <div className="extraction-card">
          <h2>Enter Verification Code</h2>
          <p>We sent a 6-digit code to {maskedEmail}</p>

          <form onSubmit={handleVerifyOTP}>
            <div className="form-group">
              <label htmlFor="otp">Verification Code</label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.slice(0, 6))}
                placeholder="000000"
                maxLength="6"
                disabled={loading || retryAfterSeconds > 0}
                required
              />
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {successMessage && <div className="alert alert-success">{successMessage}</div>}

            {attemptsRemaining > 0 && attemptsRemaining < 5 && (
              <div className="alert alert-warning">
                {attemptsRemaining} attempts remaining
              </div>
            )}

            {retryAfterSeconds > 0 && (
              <div className="alert alert-info">
                Account locked. Try again in {retryAfterSeconds}s
              </div>
            )}

            <div className="extraction-help">
              <p>Didn't receive the code?</p>
              <button
                type="button"
                onClick={() => {
                  setStep('otp_request');
                  setOtpCode('');
                  setAttemptsRemaining(5);
                }}
                className="link-button"
              >
                Request a new code
              </button>
            </div>

            <div className="button-group">
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || retryAfterSeconds > 0 || otpCode.length !== 6}
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
              <button type="button" onClick={handleCancel} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Email Verify step
  if (step === 'email_verify') {
    return (
      <div className="email-extraction-container">
        <div className="extraction-card">
          <h2>Verify Email</h2>
          <p>We've sent a verification link to {maskedEmail}</p>

          <div className="extraction-info">
            <p>
              Please click the link in your email to complete the verification process.
              You'll be redirected back to this page once verified.
            </p>
          </div>

          <form onSubmit={handleVerifyEmail}>
            <div className="form-group">
              <label htmlFor="token">Verification Link (if you have it)</label>
              <input
                id="token"
                type="text"
                value={verificationToken}
                readOnly
                placeholder="Token will be received via email"
              />
              <small>
                Paste the token from your verification email here, or click the link in your email
              </small>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {successMessage && <div className="alert alert-success">{successMessage}</div>}

            <div className="extraction-help">
              <p>Already clicked the link in your email?</p>
              <button
                type="button"
                onClick={() => {
                  setStep('success');
                  setSuccessMessage('Email extraction enabled successfully!');
                  if (onSuccess) {
                    onSuccess();
                  }
                }}
                className="link-button"
              >
                I've already verified
              </button>
            </div>

            <div className="button-group">
              <button type="button" onClick={handleCancel} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Success step
  if (step === 'success') {
    return (
      <div className="email-extraction-container">
        <div className="extraction-card success">
          <h2>✓ Extraction Enabled</h2>
          <p>{successMessage}</p>

          <div className="extraction-info">
            <p>
              Your email data extraction is now enabled. Job Search Hub will automatically
              extract job opportunities from your emails.
            </p>
          </div>

          <div className="button-group">
            <button onClick={handleCancel} className="btn-primary">
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default EmailExtractionVerification;
