# TODO — Job Search Hub Execution Guide

## Project Definition (What this is)
- Build a personal AI-powered job search operating system for one user.
- Centralize applications, outreach, contacts, interview prep, reminders, ATS checks, and Gmail auto-detection.
- Reduce manual tracking and create a consistent daily workflow.

## Product Target (How it should be)
- Deliver one clean app with these modules:
  - Dashboard
  - Job Tracker
  - Contacts
  - Templates
  - Interview Prep
  - Outreach
  - Reminders
  - ATS Checker
- Support Gmail OAuth connection and background sync every 5 minutes.
- Extract job data from Gmail with Claude into structured fields (company, role, status, recruiter, notes, next step).
- Use pipeline statuses: Wishlist → Applied → Screening → Interview → Offer → Rejected.
- Keep frontend useful even without backend (demo/empty states), then switch to live data when connected.
- Persist data in database (Supabase/Postgres), not in-memory.

## Priority Gap to Close
- Move backend from in-memory store to persistent DB and connect full frontend modules to real APIs.

## Execution Order (Follow this sequence)

### Phase 1 — Foundation (Must do first)
- [x] Keep repo structure clean (`client/`, `server/`, `docs/`, root configs).
- [x] Finalize frontend base layout to match desired dashboard UX.
- [x] Confirm backend app starts reliably from repo environment.
- [x] Ensure `.env` loading works and environment variables are documented.

### Phase 2 — Persistent Backend (Critical)
- [x] Create Supabase/Postgres schema for:
  - [x] jobs
  - [x] oauth_tokens
  - [x] processed_emails
- [x] Replace in-memory `store` usage with DB queries.
- [x] Persist OAuth tokens and refresh token lifecycle.
- [x] Persist processed Gmail IDs to prevent duplicates across restarts.
- [x] Keep `/health`, `/auth/*`, `/jobs`, `/jobs/:id`, `/jobs/:id/imported` working.

### Phase 3 — Reliability + Security
- [x] Add retry/backoff for Gmail and Claude API calls.
- [x] Add request timeout handling to external API calls.
- [x] Restrict CORS to allowed frontend origin(s).
- [x] Improve error messages returned to frontend.
- [x] Add basic logging around sync runs and failures.

### Phase 4 — Frontend Real Data Wiring
- [x] Replace demo-only flows with backend-driven data where available.
- [x] Keep graceful fallback UI when backend is unavailable.
- [x] Wire module-level CRUD actions to API endpoints.
- [x] Add clear loading/error/success states in each module.

### Phase 5 — Feature Completion
- [x] Job Tracker full CRUD + status management.
- [x] Contacts management + search/filter.
- [x] Templates browser + copy workflow.
- [x] Interview Prep with answer save/edit.
- [x] Outreach tracker with status updates.
- [x] Reminders with overdue highlighting.
- [x] ATS Checker input + score + suggestions display.

### Phase 6 — Deployment Readiness
- [x] Verify Railway deployment config and start command.
- [x] Verify OAuth redirect URIs are correct.
- [x] Set production env vars correctly.
- [x] Confirm hosted `/health` and auth status endpoints.

## Definition of Done (MVP)
- [x] App works end-to-end with persistent storage.
- [ ] Gmail connect + sync imports jobs reliably.
- [x] Data survives backend restart.
- [x] Dashboard and modules show live data (with fallback when needed).
- [x] Deployment steps are accurate and repeatable.

## Notes
- Keep changes incremental and test after each phase.
- Prioritize reliability and persistence before adding new advanced features.
