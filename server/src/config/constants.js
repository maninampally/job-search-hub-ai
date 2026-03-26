/**
 * Shared constants for job search hub application
 */

export const VALID_STATUSES = new Set([
  "Wishlist",
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Rejected"
]);

export const JOB_STATUSES = {
  WISHLIST: "Wishlist",
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected"
};

export const EMAIL_TYPES = [
  "Recruiter Outreach",
  "Interview Scheduled",
  "Offer",
  "Rejection"
];
