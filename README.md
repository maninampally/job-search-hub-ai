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
npm run dev
```

### Frontend
Frontend code organization is prepared under client/src.

### Deploy to Railway
See docs/DEPLOYMENT.md for full step by step guide.

## Tech Stack
- Frontend: React (organized under client/)
- Backend: Node.js + Express
- Gmail: Google OAuth2 + Gmail API
- AI: Claude claude-sonnet-4 (Anthropic)
- Hosting: Railway (free tier)

## Environment Variables
See .env.example for all required variables.

## Documentation
- docs/DEPLOYMENT.md
- docs/ARCHITECTURE.md

## Built for
Manikanth Nampally — Data Engineer, FAU MS 2026