# Pricing and infrastructure cost estimate

This document is a **rough planning guide** for operators of Job Search Hub. Costs vary by region, traffic, discounts, and vendor price changes. Re-check current public pricing before you budget.

Figures are in **USD** and assume a **small SaaS** (roughly hundreds to a few thousand active users), **2026** vendor landscapes unless noted.

---

## 1. Variable costs (scale with usage)

### Google Gemini (LLM)

- Used for job extraction from email bodies, cover letters, interview coach, and similar features.
- **Drivers:** number of sync-processed emails, AI feature calls, model tier (Flash vs Pro), prompt size.
- **Rough order of magnitude:** from **tens of dollars/month** at low volume to **hundreds+** if many users run large backfills and heavy Elite features daily.
- **Mitigation:** quotas per tier, batch where possible, shorter prompts, cache repeated patterns, cap `INITIAL_SYNC_MAX_MESSAGES` and lookback days.

### Gmail API

- **Read-only** OAuth scope; listing and fetching messages.
- Google publishes **per-user and per-project** quotas. Typical product usage stays within free quota if you rate-limit syncs and avoid tight loops.
- **Cost:** usually **$0** direct API fees; **indirect** cost is your compute and LLM calls per message.

### Supabase (or managed Postgres)

- **Free tier** fits early development; production commonly uses **Pro** (~\$25/month and up) for backups, support, and capacity.
- **Drivers:** row growth (`jobs`, `job_emails`, `processed_emails`, `audit_log`), storage, egress.
- **Rough range:** **\$25 to \$100+**/month for a growing app.

### Application hosting (AWS or similar)

- **Options:** ECS/Fargate, EC2, Fly.io, Railway, Render, etc.
- **Drivers:** always-on API, background workers, region, logs.
- **Rough range:** **\$30 to \$200+**/month** for a small HA setup (before scaling out).

### Object storage and CDN (if you add file CDN later)

- Resumes and static assets: often **\$5 to \$50**/month** at small scale (S3 + CloudFront or equivalent).

### Email (SMTP / transactional)

- **Drivers:** verification, notifications, volume.
- **Rough range:** **\$0** (dev/console) to **\$20 to \$100+**/month** on a paid transactional provider at moderate volume.

### Stripe

- **Per successful charge:** roughly **2.9% + fixed fee** (region-specific).
- No monthly fee for basic use; treat as **pass-through** on revenue.

---

## 2. Mostly fixed / annual

### Domain

- **About \$10 to \$20/year** for a common TLD.

### Google Cloud (OAuth / Gmail)

- **OAuth consent screen** and Gmail API: no separate per-user fee beyond normal GCP project use; budget engineer time for verification if you use **sensitive** scopes publicly.

### Monitoring (optional)

- Sentry, LogRocket, etc.: often **\$0 to \$50+**/month** at small scale.

---

## 3. Suggested retail pricing (already in product)

Current positioning in the app:

| Tier  | Price   | Role |
|-------|---------|------|
| Free  | \$0     | Limited jobs, tighter manual sync, no or restricted Gmail by policy |
| Pro   | \$9/mo  | Gmail sync, AI extraction, full tracker |
| Elite | \$24/mo | Pro plus premium AI (cover letter, coach, etc.) |

**Margin thinking (not financial advice):**

- **Pro at \$9** can cover one light user’s infra + LLM if usage is capped; heavy Gmail + AI users need **quotas** (daily AI calls, sync frequency, lookback) so average cost stays predictable.
- **Elite at \$24** should assume **multiple LLM calls per week** per user; still enforce daily caps to avoid abuse.
- **Free** should cost you **near zero** on LLM (no AI or very low quota) and **low manual sync** (for example 3/hour as implemented; adjust via env).

Tune **Stripe prices** after you have **30 days of real usage**: Gemini dashboard + DB row growth + hosting metrics.

---

## 4. Checklist before launch

1. Run `docs/database/010_oauth_tokens_last_checked.sql` (or your migration runner) on production.
2. Set `INITIAL_SYNC_LOOKBACK_DAYS` and AI quotas to match what you promise in marketing.
3. Set `SYNC_CRON` / `SYNC_CRON_TIMEZONE` so scheduled sync matches **9 PM** in the zone you advertise.
4. Set tier sync limits (`RATE_LIMIT_SYNC_*`) to match support capacity.
5. Reconcile this estimate with **actual** Supabase, hosting, and Google AI billing after soft launch.

---

## 5. Disclaimer

This is not tax, legal, or investment advice. Vendor prices change; your architecture choices dominate actual spend.
