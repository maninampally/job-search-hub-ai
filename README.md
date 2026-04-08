# Job Search Hub

A personal job search management app with Gmail auto-sync powered by Claude AI.

## Repository Structure
- client/: frontend app code (React structure)
- server/: backend API and integrations
- docs/: deployment and architecture docs
- package.json: root scripts for local development

## Features
- Job application tracker (Wishlist to Offer pipeline)
- Gmail auto-detection — AI reads emails and adds jobs automatically
- 12 outreach message templates (Email, LinkedIn, WhatsApp)
- Contact manager for recruiters and networking
- Interview prep with Q&A answer saving
- ATS keyword checker (paste resume + JD, get match score)
- Follow-up reminders with overdue alerts
- Outreach log tracker

## Quick Start

### Backend
```bash
npm install
cp .env.example .env
# Fill in .env with your keys
npm run dev:server
```

### Frontend
```bash
npm --prefix client install
npm run dev:client
```

### Run with Docker
```bash
# Ensure .env exists at project root
docker compose up --build
```

Notes:
- Frontend Docker image is built as static assets and served in production mode.
- `VITE_BACKEND_URL` is a build-time variable for frontend image build.
- Backend runs with `NODE_ENV=production` in compose.

App URLs:
- Frontend: http://localhost:5173
- Backend health: http://localhost:3001/health

To stop:
```bash
docker compose down
```

## Tech Stack
- Frontend: React (organized under client/)
- Backend: Node.js + Express
- Database: Supabase (PostgreSQL)
- Gmail: Google OAuth2 + Gmail API
- AI: Claude claude-sonnet-4 (Anthropic)
- Email: Resend SMTP
- Containerization: Docker & Docker Compose

## Environment Variables
Required (server):
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `REDIRECT_URI`
- `ANTHROPIC_API_KEY`

Optional:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ALLOWED_ORIGINS`
- `EXTERNAL_API_TIMEOUT_MS`
- `RETRY_ATTEMPTS`
- `INITIAL_SYNC_LOOKBACK_DAYS`
- `DAILY_SYNC_LOOKBACK_DAYS`
- `GMAIL_SYNC_MAX_RESULTS_PER_PAGE`
- `INITIAL_SYNC_MAX_MESSAGES`
- `SYNC_CRON`

Frontend build-time:
- `VITE_BACKEND_URL`

See `.env.example` for sample values.

## Documentation
- docs/DEPLOYMENT.md
- docs/ARCHITECTURE.md
- PROJECT_DOCUMENTATION.md (complete end-to-end documentation)

## Production Verification
- `GET /health` should return `{"status":"ok","version":"1.0.0"}`
- `GET /auth/status` should return auth state and `lastChecked`

## MCP MVP Endpoints
- `GET /mcp/health`
- `GET /mcp/auth_status`
- `GET /mcp/list_jobs`
- `POST /mcp/sync_jobs` (optional `mode`: `daily` or `initial`)
- `POST /mcp/create_job`
- `PATCH /mcp/update_job`
- `DELETE /mcp/delete_job?id=<job_id>`
- `GET /mcp/template_list`
- `GET /mcp/template_fetch?path=<relative_txt_path>`

Notes:
- MCP auth uses `Authorization: Bearer <MCP_AUTH_TOKEN>` when configured.
- MCP requests are rate limited and audited.

## Additional Backend Endpoints
- `GET /jobs/analytics/weekly`
- `GET /jobs/export/csv` (optional request body: `contacts`, `outreach`, `reminders`)
- `GET /jobs/timeline/:id`
- `POST /jobs/notifications/hooks/due-reminders`

## Built for
Manikanth Nampally — Data Engineer, FAU MS 2026