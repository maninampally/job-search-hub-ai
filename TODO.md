# TODO — Repository Stabilization Plan (Audit Based)

## P0 — Critical (Do now)
- [x] Fix sync idempotency in `server/src/services/jobSync.js`
  - [x] Do not mark Gmail message as processed when `processEmail()` fails
  - [x] Refresh OAuth token before sync starts if expired
  - [x] Remove two-step create+update path for non-applied jobs to avoid partial writes
- [x] Add strict payload validation in `server/src/routes/jobRoutes.js`
  - [x] Validate `status` against allowed pipeline statuses
  - [x] Validate `date` fields (`appliedDate`, email `date`) before saving
  - [x] Add size checks for `subject`, `preview`, `body`
- [x] Add fail-fast env checks in `server/src/config/env.js`
  - [x] Error at startup if required keys are missing (`GOOGLE_*`, `REDIRECT_URI`, `ANTHROPIC_API_KEY`) in production
- [x] Harden template archive path validation in `server/src/routes/templateRoutes.js`
  - [x] Use `path.relative` guard and reject traversal paths cross-platform

## P1 — High
- [x] Deployment hardening
  - [x] Use production frontend container strategy (build static assets, serve static)
  - [x] Set `NODE_ENV=production` in compose for backend
  - [x] Add service healthcheck and health-aware `depends_on`
- [x] Frontend architecture cleanup
  - [x] Split monolithic `client/src/pages/Dashboard.jsx` into feature modules (route/data extraction)
  - [x] Remove dead route helper logic no longer used after router migration

## P2 — Medium
- [x] Docs/env consistency sweep
  - [x] Align `README.md`, `docs/DEPLOYMENT.md`, `.env.example`
  - [x] Clearly mark required vs optional env vars
- [x] Package cleanup
  - [x] Remove `job-search-hub: file:` self-reference from root `package.json`
  - [x] Remove `job-search-hub: file:..` from `client/package.json`

## Verification Checklist
- [x] Sync run with expired token still completes (code path implemented; requires connected Gmail for live verification)
- [x] Failed message processing is retried next run (not incorrectly marked processed) (code path implemented; requires connected Gmail for live verification)
- [x] PATCH `/jobs/:id` rejects invalid statuses
- [x] POST `/jobs/:id/emails` rejects invalid or oversized payloads
- [x] Template archive endpoint blocks traversal attempts
- [x] Frontend routes refresh correctly (`/dashboard`, `/jobtracker/settings`, `/templates/library`)

## Better Options Roadmap
- [x] Add smart follow-up suggestions on Dashboard (stale Applied/Screening jobs without follow-up reminders)
- [x] Auto-create follow-up reminder when a new manual job is created
- [x] Add weekly summary report (applications, responses, interviews, stalled jobs)
- [x] Add recruiter auto-contact creation from parsed Gmail emails
- [x] Add Kanban board drag/drop in Job Tracker
- [x] Add calendar integration for reminders/interviews

## AI + MCP Options
- [x] Add MCP server MVP tools: `health`, `auth_status`, `list_jobs`, `sync_jobs`
- [x] Add MCP write tools: `create_job`, `update_job`, `delete_job`
- [x] Add MCP template tools: `template_list`, `template_fetch`
- [x] Add MCP auth and audit middleware (`MCP_AUTH_TOKEN`, request logging)
- [x] Add MCP rate limiting and tool-level permission guardrails

## Data + Backend Enhancements
- [x] Add job status timeline history table/structure (status change + timestamp)
- [x] Add weekly analytics endpoint (new apps, responses, interviews, stalls)
- [x] Add CSV export endpoint for jobs/contacts/outreach/reminders
- [x] Add queue-based email processing for high-volume sync

## UX + Productivity Enhancements
- [x] Add global search across jobs, contacts, reminders, templates
- [x] Add saved filters/smart views (`Needs Follow-up`, `Interview This Week`)
- [x] Add dashboard weekly summary card
- [x] Add notification hooks (email/Slack/WhatsApp) for due reminders
