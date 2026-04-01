# Architecture

## Repository Structure
- client: frontend app code and UI modules
- server: backend API, integrations, scheduling, and config
- docs: deployment and architecture documentation

## Backend Modules
- server/index.js: runtime entry point
- server/src/app.js: express app wiring
- server/src/routes: endpoint grouping by domain
- server/src/services: business logic and orchestration
- server/src/integrations: external API clients
- server/src/scheduler: recurring job definitions
- server/src/store: runtime state storage (currently in-memory)

## Frontend Modules
- client/src/pages: top-level views
- client/src/components: reusable UI parts
- client/src/api: backend communication code
- client/src/hooks: custom hooks
- client/src/utils: pure helpers
- client/src/styles: shared styling assets
