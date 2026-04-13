I now have a comprehensive understanding of the entire codebase. Let me produce the full specification document.

---

# HireCanvas — Comprehensive UI Specification Document

**Version:** 1.0 — April 2026
**Scope:** Full redesign from dark-indigo theme to light mint/teal theme per PolishedDashboard.jpeg

---

## SECTION 1 — DESIGN SYSTEM

### 1.1 Color Palette

The single most critical change is replacing the current dark-indigo sidebar and blue-primary accent system with a light mint/teal palette. Every color below is a CSS custom property to be defined in `client/src/styles/app.css` (the `:root` block), replacing or augmenting the existing tokens.

**Core Background Colors**

| Token | New Value | Old Value | Notes |
|---|---|---|---|
| `--bg-page` | `#f0fdfb` | `#f0f4ff` | Page-level wash — very light mint |
| `--bg-surface` | `#ffffff` | `#ffffff` | White cards, no change |
| `--bg-sidebar` | `#ccfbf1` | `var(--indigo-950)` | CRITICAL: sidebar switches from dark to light teal |
| `--bg-sidebar-deep` | `#99f6e4` | — | Deeper teal for sidebar hover/active states |

**Teal/Mint Palette (add to full palette section)**

```
--teal-50:   #f0fdfa
--teal-100:  #ccfbf1
--teal-200:  #99f6e4
--teal-300:  #5eead4
--teal-400:  #2dd4bf
--teal-500:  #14b8a6
--teal-600:  #0d9488
--teal-700:  #0f766e
--teal-800:  #115e59
--teal-900:  #134e4a
```

These already partially exist in `app.css` (`--teal-50`, `--teal-100`, `--teal-500`, `--teal-600`) — extend them to include 200, 300, 400, 700, 800, 900.

**Semantic Accent Tokens (full replacement)**

| Token | New Value | Old Value |
|---|---|---|
| `--accent` | `#14b8a6` (teal-500) | `var(--indigo-600)` |
| `--accent-hover` | `#0d9488` (teal-600) | `var(--indigo-700)` |
| `--accent-soft` | `#f0fdfa` (teal-50) | `var(--indigo-50)` |
| `--accent-border` | `#99f6e4` (teal-200) | — |

**Sidebar-Specific Tokens (full replacement)**

| Token | New Value | Old Value |
|---|---|---|
| `--sidebar-bg` | `#ccfbf1` | `linear-gradient(160deg, #1e1b4b, #312e81, #4c1d95)` |
| `--sidebar-text` | `#115e59` (teal-800) | `rgba(165,180,252,0.85)` |
| `--sidebar-text-hover` | `#0f766e` (teal-700) | `#e0e7ff` |
| `--sidebar-text-active` | `#134e4a` (teal-900) | `#ffffff` |
| `--sidebar-item-active-bg` | `rgba(20,184,166,0.15)` | `rgba(99,102,241,0.25)` |
| `--sidebar-label-color` | `#5eead4` (teal-300) | `rgba(148,163,184,0.55)` |
| `--sidebar-border` | `#99f6e4` (teal-200) | `rgba(99,102,241,0.2)` |
| `--sidebar-active-indicator` | `#0d9488` (teal-600) | `var(--indigo-400)` |

**Text Colors** (no change needed — these work well on white cards)

| Token | Value |
|---|---|
| `--text-primary` | `#0f172a` (slate-900) — keep as-is |
| `--text-secondary` | `#64748b` (slate-500) — keep as-is |
| `--text-muted` | `#94a3b8` (slate-400) — keep as-is |

**Status/Pipeline Colors** (preserve existing chip system, no change required)

Wishlist: slate, Applied: blue, Screening: amber, Interview: violet, Offer: emerald, Rejected: rose. These contrast well against white cards on the new teal page.

**New AI Score Badge Colors**

| Score Range | Background | Text | Border |
|---|---|---|---|
| 80–100 ("High") | `#f0fdfa` (teal-50) | `#0d9488` (teal-600) | `#5eead4` (teal-300) |
| 50–79 ("Medium") | `#fffbeb` (amber-50) | `#d97706` (amber-600) | `#fde68a` (amber-200) |
| 0–49 ("Low") | `#fff1f2` (rose-50) | `#e11d48` (rose-600) | `#fda4af` (rose-300) |

**Shadow Tokens (update to teal-tinted)**

```css
--shadow-xs: 0 1px 3px rgba(20, 184, 166, 0.06), 0 1px 2px rgba(0,0,0,0.04);
--shadow-sm: 0 2px 8px rgba(20, 184, 166, 0.08), 0 1px 3px rgba(0,0,0,0.04);
--shadow-md: 0 6px 20px rgba(20, 184, 166, 0.10), 0 2px 6px rgba(0,0,0,0.05);
--shadow-lg: 0 16px 40px rgba(20, 184, 166, 0.12), 0 4px 10px rgba(0,0,0,0.06);
```

The existing shadow tokens use indigo-tinted RGBA values. Updating to teal-tinted values makes subtle card shadows align with the new palette without jarring color bleed.

### 1.2 Typography

No change to font family — Inter remains correct. The following sizes, weights, and line-heights stay as-is. The only typographic change is gradient text colors: anywhere a gradient uses `var(--indigo-700) → var(--violet-600)`, replace with `var(--teal-700) → var(--teal-500)`.

Specific instances to update:
- `.module-header h1` gradient: change from `indigo-700 → violet-600` to `teal-700 → teal-500`
- `.brand h2` gradient in sidebar: change to solid `#134e4a` (teal-900) — gradients look poor on light backgrounds
- `.auth-card h1` gradient: keep as-is or switch to `teal-700 → teal-500` for consistency

**Type Scale (unchanged)**

| Use | Size | Weight |
|---|---|---|
| View title (h1 in module-header) | 1.45rem | 800 |
| Card title (cc-card-title) | 0.9375rem | 600 |
| KPI value | 2rem | 700 |
| Body text | 0.9375rem | 400 |
| Secondary text | 0.875rem | 400–500 |
| Labels/Captions | 0.75–0.8125rem | 500–600 |
| Nav group labels | 0.68rem | 700, uppercase |
| Nav item labels | 0.855rem | 500 |

### 1.3 Spacing

Existing spacing tokens (`--space-xs` through `--space-xl`) are correct and should not change. The layout grid uses these consistently.

### 1.4 Border Radius

Existing tokens are correct:
- `--radius-sm: 6px` — chip/badge radius
- `--radius-md: 10px` — inputs, buttons, small cards
- `--radius-lg: 14px` — primary cards
- `--radius-xl: 20px` — modal, auth card

### 1.5 Focus Ring

Update from indigo-tinted to teal:
```css
*:focus-visible {
  outline: 2px solid var(--teal-500);
  outline-offset: 2px;
}
```

### 1.6 Scrollbar

Update thumb color:
```css
::-webkit-scrollbar-thumb { background: var(--teal-200); }
::-webkit-scrollbar-thumb:hover { background: var(--teal-300); }
```

### 1.7 Summary of "Find and Replace" Token Migrations

Every reference to `var(--indigo-600)` used as a primary action color becomes `var(--teal-600)` or `var(--accent)`. Key locations in `app.css`:

- `.cc-sync-btn` background: `var(--indigo-600)` → `var(--teal-600)`
- `.cc-sync-btn:hover` background: `var(--indigo-700)` → `var(--teal-700)`
- `.cc-tier-bar-fill` gradient: `var(--indigo-400), var(--violet-400)` → `var(--teal-400), var(--teal-600)`
- `.cc-log-footer` color: `var(--indigo-600)` → `var(--teal-600)`
- `.cc-action-link` color: `var(--indigo-600)` → `var(--teal-600)`
- `.cc-view-all-btn` color: `var(--indigo-600)` → `var(--teal-600)`
- `.cc-badge-soft` background/color: `var(--indigo-50) / var(--indigo-700)` → `var(--teal-50) / var(--teal-700)`
- `.btn-apply-range` background: `var(--indigo-600)` → `var(--teal-600)`
- All `.module-header h1` gradient text: `indigo-700 → violet-600` → `teal-700 → teal-500`
- `.block h3` uppercase label color: `var(--indigo-600)` → `var(--teal-600)`
- All `.job-form / .contact-form / .outreach-form / .reminder-form` button gradients: `indigo-600 → violet-600` → `teal-600 → teal-500`
- Input focus rings: `rgba(99,102,241,0.12–0.15)` → `rgba(20,184,166,0.12–0.15)`
- `.tabs-header` background: `indigo-100 → violet-100` → `teal-100 → teal-50`
- `.tab-button.active` gradient: `indigo-600 → violet-600` → `teal-600 → teal-500`
- `.pipeline-card` and `.focus-pill` backgrounds: indigo variants → teal variants

**Do NOT change**: status chip colors (Applied=blue, Screening=amber, Interview=violet, Offer=emerald, Rejected=rose). These are semantic and should remain distinct from the primary accent.

---

## SECTION 2 — SHELL / LAYOUT

### 2.1 Overall Grid

```css
.shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
}
```

No change to the grid itself. Only the sidebar's visual appearance changes.

### 2.2 Sidebar

**Dimensions:** 248px wide, full viewport height, `position: sticky; top: 0; height: 100vh; overflow-y: auto`

**Background:** Replace the current `linear-gradient(160deg, var(--indigo-950) 0%, var(--indigo-900) 55%, var(--violet-900) 100%)` with a flat light teal:

```css
.sidebar {
  background: var(--teal-100); /* #ccfbf1 */
  color: var(--sidebar-text);
  border-right: 1px solid var(--teal-200);
}
```

The sidebar switches from a dark gradient to a solid light teal. This is the most visually impactful single change.

**Logo / Brand Area (.brand)**

- `h2` text "HireCanvas": 1.2rem, weight 800, `letter-spacing: -0.03em`, color `var(--teal-900)` (#134e4a) — solid dark teal, no gradient (gradients do not work well on light sidebar backgrounds)
- Sub-label (optional): 0.75rem, `var(--teal-600)`, "Your job search command center" or user's plan tagline
- Logo icon: a small canvas/brush SVG icon or existing brand icon, 24×24px, `color: var(--teal-600)`
- Brand search input (if kept): background `rgba(255,255,255,0.6)`, border `var(--teal-200)`, text `var(--teal-900)`, placeholder `var(--teal-400)`. On focus: `border-color: var(--teal-500)`, `box-shadow: 0 0 0 3px rgba(20,184,166,0.15)`

**Navigation Groups (.nav-group)**

Group labels (`.nav-group-label`): Change from `rgba(148,163,184,0.55)` to `var(--teal-600)` (#0d9488). This label will now be visible and readable against the light teal sidebar.

**Menu Items (.menu-item)**

Default state: `color: var(--teal-800)`, background transparent, border none
Hover state: `background: rgba(20,184,166,0.12)`, `color: var(--teal-900)`, no transform, no box-shadow
Active state: `background: rgba(20,184,166,0.18)`, `color: var(--teal-900)`, `font-weight: 700`, `border-left: 3px solid var(--teal-600)`, `padding-left: calc(0.875rem - 3px)`

Active icon: `color: var(--teal-600)`
Inactive icon: `color: var(--teal-500)`, `opacity: 0.8`

**Sidebar Footer**

Border-top: `1px solid var(--teal-200)`
Text: `color: var(--teal-700)`

**User Profile Card (.sidebar-profile-card)**

Avatar border: `border: 2px solid var(--teal-300)`
Avatar background (initials fallback): gradient `linear-gradient(135deg, var(--teal-400) 0%, var(--teal-600) 100%)`
Avatar initial text: `#ffffff`
User name text: `var(--teal-900)`, 0.9rem, weight 600
User tagline: `var(--teal-600)`, 0.75rem, weight 400

**Tier Card (.cc-tier-card in sidebar)**

Change from: `background: rgba(99,102,241,0.15)`, `border: 1px solid rgba(165,180,252,0.2)`
Change to: `background: rgba(20,184,166,0.12)`, `border: 1px solid var(--teal-200)`

Tier title: `var(--teal-900)`, 0.8125rem, weight 600
Tier copy: `var(--teal-700)`, 0.75rem
Progress bar fill: `linear-gradient(90deg, var(--teal-400), var(--teal-600))`

**Account Action Buttons in Sidebar Footer**

Background: `rgba(255,255,255,0.6)`, border: `var(--teal-200)`, color: `var(--teal-800)`
Hover: `background: rgba(20,184,166,0.15)`, `border-color: var(--teal-400)`, `color: var(--teal-900)`

**"Upgrade" CTA Button (top-right of sidebar or in tier card)**

Per the design image, a prominent teal-green button appears in the top-right corner of the overall app. Specification:
- Position: fixed or in the topbar, right of the topbar actions
- Size: height 36px, padding 0 1.25rem
- Background: `var(--teal-500)` (#14b8a6)
- Text: `#ffffff`, 0.875rem, weight 700, "Upgrade"
- Border: none
- Border-radius: `var(--radius-md)` (10px)
- Hover: `background: var(--teal-600)`, `box-shadow: 0 4px 12px rgba(20,184,166,0.4)`
- Only visible when user tier is free or pro

### 2.3 Topbar (.cc-topbar)

**Height:** 64px — no change
**Background:** `var(--bg-surface)` (#ffffff) — no change
**Border-bottom:** `1px solid var(--border)` — no change
**Shadow:** `var(--shadow-xs)` — no change

**Left side:**
- Page title (`.cc-topbar-title`): 1.25rem, weight 700, `var(--text-primary)` — no change

**Right side (.cc-topbar-actions):**

- Gmail connection badge (`.cc-badge-soft`): Update to teal: `background: var(--teal-50)`, `color: var(--teal-700)`, `border: 1px solid var(--teal-100)`
- Account email display (`.cc-account-email`): no change
- Sync button (`.cc-sync-btn`): Update from indigo to teal: `background: var(--teal-600)`, hover `var(--teal-700)`, `box-shadow: 0 2px 8px rgba(20,184,166,0.25)`
- Upgrade button: `background: var(--teal-500)`, `color: #ffffff` — only shown for free/pro users
- Avatar (`.cc-topbar-avatar`): `border: 2px solid var(--border)`, hover `border-color: var(--teal-400)`. Background uses gradient keyed off user's name for color diversity.

### 2.4 Content Area (.cc-page-scroll)

**Background:** `var(--bg-page)` (#f0fdfb) — update from `#f0f4ff` to new mint value
**Padding:** `1.5rem 2rem 2.5rem` — no change
**Overflow:** `overflow-y: auto`, flex: 1 inside `.content-shell` — no change

---

## SECTION 3 — DASHBOARD HOME VIEW

File: `client/src/components/views/DashboardHomeView.jsx`

### 3.1 Alert Banner Row

Only shown when `connectedFromCallback`, `successText`, or `errorText` is truthy. Same `.inline-note.success` / `.inline-note.error` pattern. No design change — these use emerald/rose colors that work on the new background.

### 3.2 KPI Stats Grid (.cc-kpi-grid)

**Layout:** `display: grid`, 4 equal columns, `gap: 1rem`, `margin-bottom: 1.25rem`
**Responsive:** At ≤980px: 2 columns. At ≤640px: 2 columns.

**Each KPI Card (.cc-kpi-card)**

- Background: `#ffffff`
- Border: `1px solid var(--border)` (#e2e8f0)
- Border-radius: `var(--radius-lg)` (14px)
- Padding: `1.25rem 1.375rem`
- Shadow: `var(--shadow-xs)`
- Hover: `transform: translateY(-2px)`, `box-shadow: var(--shadow-sm)` — add this transition

**Card Structure (top → bottom):**

Row 1 (`.cc-kpi-top`): flex, space-between
- Left: label text — 0.8125rem, weight 500, `var(--text-secondary)`
- Right: icon — 18px, `var(--text-muted)`

Row 2 (`.cc-kpi-value`): 2rem, weight 700, `var(--text-primary)`, `line-height: 1`

Row 3 (`.cc-kpi-note`): 0.75rem, weight 500, flex with icon
- Default color: `var(--text-muted)`
- Success modifier (`.cc-success`): `color: var(--emerald-600)` — update from existing which references emerald-600 but check for any indigo references

**The 4 cards, left to right:**

1. Total Applications — icon: briefcase (MdWork, 18px) — kpi-note shows "+N this week" in emerald when N > 0
2. Active Interviews — icon: calendar (MdCalendarToday, 18px) — kpi-note: "N upcoming" or encouragement text
3. Offers — icon: trophy (MdEmojiEvents, 18px) — kpi-note: "Awaiting your response" or encouragement
4. Rejections — icon: cancel (MdCancel, 18px) — kpi-note: "N jobs need follow-up" (teal accent) or encouragement

**New Design Touch:** Add a thin 4px top accent bar on each card, color-coded:
- Total Applications: `var(--teal-400)`
- Active Interviews: `var(--amber-400)`
- Offers: `var(--emerald-400)`
- Rejections: `var(--rose-400)`

Implementation: `::before` pseudo-element on `.cc-kpi-card`, `position: absolute; top: 0; left: 0; right: 0; height: 4px; border-radius: 14px 14px 0 0`. Make `.cc-kpi-card` `position: relative; overflow: hidden`.

### 3.3 Overview Middle Row (.cc-overview-middle)

**Layout:** `display: grid`, `grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr)`, `gap: 1.25rem`, `margin-bottom: 1.25rem`

#### 3.3.1 Application Activity Chart (`.cc-section-card`, left)

**Card header (.cc-card-head):**
- Title "Application Activity": 0.9375rem, weight 600, `var(--text-primary)`
- Meta "Last 7 Days": 0.8125rem, `var(--text-secondary)`
- Border-bottom: `1px solid var(--border)`
- Padding: `1rem 1.375rem`

**Chart body (.cc-chart-body):** padding `1.375rem 1.375rem 1rem`

**Bar chart (.cc-bar-chart):** height 200px, flex, align-items flex-end, gap 10px

**Bar color update (CRITICAL):**
- Default bar: change from `color-mix(in srgb, var(--indigo-500) 18%, var(--bg-surface))` to `color-mix(in srgb, var(--teal-500) 18%, var(--bg-surface))`
- Default bar border: change from indigo to `color-mix(in srgb, var(--teal-400) 22%, transparent)`
- Active bar (today): `background: var(--teal-500)`, `border-color: var(--teal-500)`
- Bar tooltip (`.cc-bar-tip`): no change needed (uses text-primary/bg-surface)

**Active bar label color:** `color: var(--teal-700)` instead of current `var(--text-primary)`

#### 3.3.2 Recent AI Extractions Log (`.cc-section-card`, right)

**Card header:** Same pattern as chart, title "Recent AI Extractions", meta info icon (ⓘ)

**Log rows (.cc-log-row):**

Each row: `padding: 0.875rem 1.375rem`, flex, `gap: 0.75rem`, `border-bottom: 1px solid var(--border)`

Icon box (`.cc-log-icon`):
- Size: 30×30px, `border-radius: var(--radius-md)`
- Update from `background: var(--indigo-50)`, `color: var(--indigo-600)` to `background: var(--teal-50)`, `color: var(--teal-600)`
- Icon type variants:
  - Application Received: `MdStar` icon
  - Interview Scheduled: `MdCalendarMonth` icon, `background: var(--amber-50)`, `color: var(--amber-600)`
  - Offer Received: `MdMarkEmailRead` icon, `background: var(--emerald-50)`, `color: var(--emerald-600)`
  - Rejected: `MdCancel` icon, `background: var(--rose-50)`, `color: var(--rose-500)`

Copy block: title 0.875rem weight 500 `var(--text-primary)`, sub 0.8125rem `var(--text-secondary)`, both truncate with overflow ellipsis
Time stamp: 0.75rem `var(--text-muted)`, flex-shrink: 0

**Footer link (.cc-log-footer):** Update `color: var(--indigo-600)` → `var(--teal-600)`, hover background `var(--indigo-50)` → `var(--teal-50)`

**Empty state (.cc-empty-state):** `padding: 2.5rem 1.5rem`, centered, 0.875rem, `var(--text-secondary)`

### 3.4 Active Pipeline Table (.cc-table-shell)

**Shell:** white card, `border: 1px solid var(--border)`, `border-radius: var(--radius-lg)`, `overflow: hidden`, `box-shadow: var(--shadow-xs)`

**Table header row (.cc-table-header):**
- Left: title "Active Pipeline" — 0.9375rem, weight 600
- Right: filter button (`.cc-filter-btn`) and "Add Job" CTA button
  - Filter button: existing style, update hover to teal: `border-color: var(--teal-300)`, `background: var(--teal-50)`, `color: var(--teal-700)`
  - "Add Job" button: `background: var(--teal-500)`, `color: #ffffff`, `border: none`, height 34px, `border-radius: var(--radius-md)`, weight 600, hover `background: var(--teal-600)`

**Data Table (.cc-data-table):**

Column headers (`th`): `background: var(--slate-50)`, 0.8rem, weight 600, `var(--text-secondary)`. Columns: Company, Role, Pipeline Stage, AI Score, Source, Last Activity, Actions.

**Column specifications:**

- Company: 34px logo box (`.cc-company-logo`) + company name + optional domain note — same as current `.cc-company-cell`
- Role: 0.875rem, `var(--text-primary)`
- Pipeline Stage: `.cc-stage-pill` — keep existing stage pill colors (they are semantic and correct)
- AI Score (new column): shows a numeric score 0–100 with colored badge per Section 1.1 AI Score colors. Badge: pill shape, 0.75rem, weight 700. If no score, show "—" in muted color.
- Source: icon + text (Gmail icon for email-sourced, manual pencil icon for manual). `var(--text-secondary)`, 0.8125rem
- Last Activity: relative time string ("2h ago", "3d ago"), 0.8125rem, `var(--text-muted)`
- Actions: "View" link button — update `.cc-action-link` color from `var(--indigo-600)` to `var(--teal-600)`

**Row hover:** `background: var(--teal-50)` instead of current `var(--slate-50)`

**Footer "View all in Job Tracker" link (.cc-view-all-btn):** Update color `var(--indigo-600)` → `var(--teal-600)`, hover background `var(--indigo-50)` → `var(--teal-50)`

**Showing:** Up to 8 rows from pipeline columns with status Applied, Screening, Interview, Offer — same logic as current `activeTableJobs` memo.

### 3.5 Data Props Required

No change to existing prop contract:

```
stats: { total, active, interviews, offers }
weeklySummaryDisplay: { applicationsThisWeek, ... }
dailyApplicationsSeries: [{ date, count }]
pipelineColumns: [{ status, jobs: [{ id, company, role, status, source, updatedAt, aiScore? }] }]
jobs: full job array (for extraction log)
needsFollowUpJobs: array
connected: boolean
gmailSyncAllowed: boolean
onNavigateView: function
onOpenBilling: function
```

New prop: `jobs[].aiScore` — optional numeric 0–100. If backend does not yet provide this, render "—" in the column. Do not hide the column.

---

## SECTION 4 — JOB TRACKER VIEW

File: `client/src/components/views/JobTrackerView.jsx`

### 4.1 Layout

The view uses a Kanban board layout. The existing structure has a view-header row, filter/control row, and then the Kanban columns. No structural change needed, only visual updates.

**Module panel (`.module-panel`):** white, `border: 1px solid var(--border)`, `border-radius: var(--radius-xl)`, `box-shadow: var(--shadow-sm)`. The header gradient text updates to teal as specified in Section 1.7.

### 4.2 Control Row

- Search input: same as existing `.filters-row input`, but focus ring updates to teal: `border-color: var(--teal-500)`, `box-shadow: 0 0 0 3px rgba(20,184,166,0.12)`
- Status filter buttons / smart view pills: active state updates from indigo to teal background: `background: var(--teal-600)`, `color: #ffffff`
- "Add Job" button in the control row: `background: var(--teal-500)`, `color: #ffffff`, `border: none`, weight 700, hover `background: var(--teal-600)`

### 4.3 Pipeline Kanban Columns

**Layout:** `display: grid`, currently 6 columns (one per stage). Keeps as-is.

**Column headers:** UPPERCASE label in `var(--text-secondary)`, count badge. Update count badge from indigo gradient to teal: `background: linear-gradient(135deg, var(--teal-100) 0%, var(--teal-50) 100%)`, `border: 1px solid var(--teal-200)`, `color: var(--teal-700)`.

**Drag-drop drop target:** When a card is being dragged and hovers over a column, show a teal dashed border: `border: 2px dashed var(--teal-300)`, `background: var(--teal-50)`.

### 4.4 Tracker Cards (.tracker-card)

**Default card:**
- Background: `#ffffff`
- Border: `1.5px solid var(--border)`
- Border-radius: `var(--radius-lg)` (14px)
- Shadow: `var(--shadow-xs)`
- Padding: `0.875rem`
- Hover: `box-shadow: var(--shadow-md)`, `transform: translateY(-2px)`
- Dragging: `opacity: 0.65`, `transform: rotate(1.5deg) scale(0.97)`, cursor grab → grabbing

**Left border color by status:** Same as current — these are semantic and correct. Only the Wishlist border updates:
- `.card-status-wishlist`: `border-left: 3px solid var(--teal-300)` (was slate-400, teal is more on-brand)
- All others: unchanged

**Card content:**
- Role title (`h4`): 0.9rem, weight 700, `var(--text-primary)`
- Company name (`strong`): 0.82rem, weight 600, `var(--text-secondary)`
- Location / applied date: 0.82rem, `var(--text-secondary)`

**Card badges (`.tracker-card-badges`):** flex-column, align-items flex-end, gap 0.35rem
- Status chip: use existing `.chip.status-*` classes — no change
- Email count badge: use existing `.chip.email-count-badge` — no change
- NEW: AI Score badge (`.cc-ai-score-badge`) — only render if `job.aiScore` exists

**AI Score Badge (new element):**
- Shape: pill, same as other chips, `border-radius: 999px`
- Size: 0.73rem, weight 700, `padding: 0.2rem 0.65rem`
- Colors: use AI Score badge colors from Section 1.1 (teal for high, amber for medium, rose for low)
- Content: "AI: {score}%" or just "{score}%"
- Placement: below status chip in the badges column

**Expanded Card Detail Panel:** No visual change beyond color token updates (indigo → teal for borders, backgrounds, and focus rings within `.job-detail-tabs`, `.tabs-header`, `.tab-button.active`).

### 4.5 Add/Edit Job Form

The `.job-form` grid (3 columns) updates its background gradient and border from indigo to teal:
- `background: linear-gradient(135deg, var(--teal-50) 0%, #fafffe 100%)`
- `border: 1px solid var(--teal-100)`
- Submit button: `background: linear-gradient(135deg, var(--teal-600) 0%, var(--teal-500) 100%)`

**Fields:** Company (text), Role (text), Location (text), Applied Date (date), Status (select), Notes (textarea, spans 2 cols), Resume attachment (select), URL (text), Source (text). Same as current form.

---

## SECTION 5 — CONTACTS VIEW

File: `client/src/components/views/ContactsView.jsx`

### 5.1 Layout

Follows `.module-panel` pattern. Header section → success/error alerts → add-contact form → filter row → contact cards grid.

### 5.2 Module Header

Title "Contacts", sub "Manage recruiters and networking contacts." Gradient text updates to teal per Section 1.7.

### 5.3 Add Contact Form (.contact-form)

3-column grid layout, same fields as current: Name, Company, Title, Email, Relationship (select), Notes (spans 2 cols), Add Contact button.

Visual update:
- Form background: `linear-gradient(135deg, var(--teal-50) 0%, #fafffe 100%)`
- Form border: `var(--teal-100)`
- Submit button: teal gradient per Section 4.5
- Input focus: teal ring per Section 4.2

### 5.4 Filter Row

Search input (min-width 220px, flex:1) + Relationship filter select. Same as current. Input focus ring updates to teal.

### 5.5 Contacts Grid (.contacts-grid)

2-column grid, `gap: 0.875rem`. Each contact card (`.contact-card`) updates:

**Top border gradient:** Change from `linear-gradient(90deg, var(--indigo-400) 0%, var(--violet-400) 100%)` to `linear-gradient(90deg, var(--teal-400) 0%, var(--teal-600) 100%)`

**Card content:**
- Name: 0.975rem, weight 700, `var(--text-primary)`
- Company · Title: 0.875rem, `var(--text-secondary)`
- Email: 0.875rem, `var(--text-secondary)`, link color `var(--teal-600)`
- Relationship badge: pill chip, style per relationship type:
  - Recruiter: `background: var(--teal-50)`, `color: var(--teal-700)`, `border: 1px solid var(--teal-200)`
  - Hiring Manager: `background: var(--amber-50)`, `color: var(--amber-700)`, `border: 1px solid var(--amber-200)`
  - Employee: `background: var(--blue-50)`, `color: #1e40af`, `border: 1px solid #bfdbfe`
  - Other: default chip style
- Notes: 0.875rem, `var(--text-secondary)`, italic, truncated to 2 lines
- Edit / Delete action buttons: small, placed in card header right side. Edit: ghost button, Delete: danger-btn

**Hover state:** `box-shadow: var(--shadow-md)`, `border-color: var(--teal-200)`, `transform: translateY(-2px)`

**Edit mode:** Inline form replaces card content. Fields: Name, Company, Title, Email, Relationship, Notes. Save + Cancel buttons.

### 5.6 Empty State

When no contacts: centered illustration placeholder (a simple icon like MdPeople, 48px, `var(--teal-300)`) + "No contacts yet" heading + "Add your first contact using the form above" description text + optional CTA button.

---

## SECTION 6 — OUTREACH VIEW

File: `client/src/components/views/OutreachView.jsx` and `OutreachView.module.css`

### 6.1 Layout

Stats row (4 KPI mini-cards) → filter row → "Log Outreach" form (toggle-able) → outreach cards list.

### 6.2 Stats Row (new, already in current file)

4 mini-stat cards in a 4-column flex/grid:
- Total Outreach, Replied, Pending, No Response
- White cards, `border-radius: var(--radius-md)`, `border: 1px solid var(--border)`, `padding: 0.75rem 1rem`
- Number: 1.5rem weight 700. Label: 0.75rem uppercase `var(--text-secondary)`
- Top accent color: Total=teal, Replied=emerald, Pending=amber, No Response=rose (4px `::before` bar)

### 6.3 Filter Row

Search input + Status filter select. Same pattern. Teal focus rings.

**"Log Outreach" toggle button:** When collapsed, shows teal-outlined button with "+" icon. When form is open, shows "Cancel" button. This is the existing `showForm` toggle.

### 6.4 Outreach Form (.outreach-form)

Same 3-column grid, same fields: Contact, Company, Method (select: LinkedIn/Email/Phone/WhatsApp), Status (select), Date, Notes (spans 2 cols).

Visual update to teal: same pattern as contact-form.

### 6.5 Outreach Cards (.outreach-card)

**Top border:** `border-top: 3px solid var(--teal-400)` (change from `var(--blue-400)`)

**Card header:** Contact name (weight 700) + Method chip (right)

**Method chip styles (`.module.css` `.methodLinkedIn` etc.):** Keep distinct per channel:
- LinkedIn: `background: var(--indigo-100)`, `color: var(--indigo-700)` — this is semantic (LinkedIn blue-purple) — keep
- Email: `background: var(--blue-50)`, `color: #1e40af`
- Phone: `background: var(--amber-50)`, `color: var(--amber-700)`
- WhatsApp: `background: var(--emerald-50)`, `color: var(--emerald-700)`

**Status chip styles:**
- Sent: `background: var(--teal-50)`, `color: var(--teal-700)`, `border: 1px solid var(--teal-200)`
- Replied: `background: var(--emerald-50)`, `color: var(--emerald-700)`, `border: 1px solid var(--emerald-200)`
- No Response: `background: var(--slate-100)`, `color: var(--slate-600)`
- Scheduled: `background: var(--amber-50)`, `color: var(--amber-700)`, `border: 1px solid var(--amber-200)`

**Card body:** Company, date, notes text. "Update Status" select inline + delete button.

---

## SECTION 7 — RESUME MANAGER VIEW

File: `client/src/components/ResumesManager.jsx`

### 7.1 Layout

Module-panel wrapper. Header "Resume Manager" + sub-description. Upload area → resume cards grid.

### 7.2 Upload Area

Drag-and-drop zone:
- Background: `var(--teal-50)`, border: `2px dashed var(--teal-300)`, `border-radius: var(--radius-lg)`, `padding: 2rem`, centered
- Icon: `MdDescription` or upload cloud, 48px, `var(--teal-400)`
- Text: "Drag a PDF or click to upload" — 0.9rem, `var(--text-secondary)`
- Hover state: `background: var(--teal-100)`, `border-color: var(--teal-400)`
- Active/file-over: `border-color: var(--teal-600)`, `background: var(--teal-100)`

### 7.3 Resume Cards Grid

2-column grid. Each card:
- White background, `border: 1px solid var(--border)`, `border-radius: var(--radius-lg)`, `padding: 1.25rem`
- Top accent: `border-top: 3px solid var(--teal-400)`
- Resume name: weight 700, `var(--text-primary)`
- File size / upload date: 0.75rem, `var(--text-muted)`
- Action buttons row: Download (icon + text), Set as Default (if applicable), Delete (danger-btn)
- "Default" badge: `background: var(--teal-50)`, `color: var(--teal-700)`, `border: 1px solid var(--teal-200)`, pill shape

### 7.4 ATS Checker Panel

Two-column textarea grid (`.ats-grid`):
- Left: "Paste Job Description" textarea
- Right: "Paste Resume Text" textarea

Below: "Check ATS Fit" button → `background: var(--teal-600)`, teal gradient.

Results panel (`.ats-result`): Change from `background: linear-gradient(135deg, var(--indigo-50) 0%, var(--violet-50) 100%)` to `linear-gradient(135deg, var(--teal-50) 0%, #f0fdfb 100%)`, `border: 1px solid var(--teal-100)`.

Score display: large number (2rem weight 700) with color: <50 rose, 50–79 amber, ≥80 teal.

---

## SECTION 8 — TEMPLATES VIEW

File: `client/src/components/views/TemplatesView.jsx`

### 8.1 Layout

Module-panel wrapper. Header "Templates" + description. Filter row → templates grid.

### 8.2 Filter Row

Type select (All/Email/LinkedIn/WhatsApp) + search input. Same as current.

### 8.3 Templates Grid (.templates-grid)

2-column, `gap: 0.875rem`.

**Template Card (.template-card):**
- Top border: `border-top: 3px solid var(--teal-500)` — already teal, keep.
- Card header: Template name (weight 700) + type chip (right)
  - Type chip colors: Email=teal (`.chip.type-email` update to teal-50/teal-700), LinkedIn=indigo (keep, semantic), WhatsApp=emerald (keep)
- "Case" label: 0.75rem, `var(--text-muted)`
- Body preview: first 100 chars, truncated, 0.875rem `var(--text-secondary)`
- Expanded body: full template text in `<pre>` or `<p>` with `white-space: pre-wrap`
- "Copy" button: primary teal button, "Copied!" success state with checkmark
- Hover: `box-shadow: var(--shadow-md)`, `border-color: var(--teal-200)`, `transform: translateY(-2px)`

### 8.4 Archive Panel

Background: `linear-gradient(135deg, var(--teal-50) 0%, #fafffe 100%)`, `border: 1px solid var(--teal-100)`. Heading color: `var(--teal-700)`.

---

## SECTION 9 — INTERVIEW PREP VIEW

File: `client/src/components/views/InterviewPrepView.jsx`

### 9.1 Layout

Module-panel. Header "Interview Prep" + sub. Filter select → question cards list.

### 9.2 Filter Row

Single select: All Categories / Technical / System Design / Behavioral.

### 9.3 Question Cards (.question-card)

**Card structure:**
- Header row: question text (`h4`, weight 700) + category·difficulty chip (right)
- Category chip: 0.73rem, weight 700. Color by category:
  - Technical: `background: var(--blue-100)`, `color: #1e40af`
  - System Design: `background: var(--violet-100)`, `color: var(--violet-700)`
  - Behavioral: `background: var(--teal-100)`, `color: var(--teal-700)` — update from neutral chip
- Difficulty indicator: dot (Easy=emerald, Medium=amber, Hard=rose) or text badge
- Answer textarea: `min-height: 90px`, `resize: vertical`, focus ring teal

### 9.4 Progress Indicator (new feature to add)

Above the question list, a mini progress bar showing "N of M questions answered":
- Label: "N answered" — 0.8125rem, weight 600, `var(--text-secondary)`
- Bar: `height: 6px`, `border-radius: 999px`, `background: var(--border)` track, fill `var(--teal-500)`

---

## SECTION 10 — REMINDERS VIEW

File: `client/src/components/views/RemindersView.jsx` and `RemindersView.module.css`

### 10.1 Layout

Stats row (4 mini-cards) → toggle row → filter row → form → reminder list.

### 10.2 Stats Row

4 cards: Overdue, Today, Upcoming, Completed. Same white card pattern.
- Overdue: `border-top: 4px solid var(--rose-500)`, number in `var(--rose-600)`
- Today: `border-top: 4px solid var(--amber-500)`, number in `var(--amber-700)`
- Upcoming: `border-top: 4px solid var(--teal-500)`, number in `var(--teal-700)`
- Completed: `border-top: 4px solid var(--emerald-500)`, number in `var(--emerald-700)`

### 10.3 Toggle and Filter Row

- "Show Completed" toggle: checkbox-style or pill button. When active: `background: var(--teal-50)`, `border-color: var(--teal-300)`, check icon in `var(--teal-600)`
- Type filter pills: All / Follow Up / Apply Deadline / Interview Prep / Other. Active pill: `background: var(--teal-600)`, `color: #fff`. Inactive: ghost border `var(--border)`.

### 10.4 Add Reminder Form (.reminder-form)

Same teal form styling. Fields: Title, Type (select), Due Date (date), Notes. Submit button teal.

### 10.5 Reminder Cards (.reminder-card)

**Default:** `border-left: 3px solid var(--teal-400)` (change from `var(--indigo-400)`)

**Type chip colors (update `.module.css`):**
- Follow Up: `background: var(--teal-50)`, `color: var(--teal-700)`, `border: 1px solid var(--teal-200)`
- Apply Deadline: `background: var(--rose-50)`, `color: var(--rose-600)`, `border: 1px solid var(--rose-200)`
- Interview Prep: `background: var(--amber-50)`, `color: var(--amber-700)`, `border: 1px solid var(--amber-200)`
- Other: default chip

**Overdue state (.overdue):**
- `border-left-color: var(--rose-500)`
- `background: linear-gradient(135deg, #fff5f5 0%, #fff 100%)`
- Due date text: `var(--rose-600)`, weight 600

**Completed state (.reminder-done):**
- `border-left-color: var(--emerald-400)`
- `background: linear-gradient(135deg, var(--emerald-50) 0%, #fff 100%)`
- Title: `text-decoration: line-through`, `color: var(--text-muted)`
- Opacity: 0.75

**Card actions:** Toggle complete checkbox/button + Delete button. Toggle checked state: teal check icon.

### 10.6 Calendar Export + Reminder Hooks

- "Export All to Calendar" button: outlined teal, `border: 1.5px solid var(--teal-300)`, `color: var(--teal-700)`, hover teal-50 background
- "Send Hooks" button (if sendingReminderHooks): loading spinner in teal

---

## SECTION 11 — SETTINGS PAGE

File: `client/src/components/views/SettingsPage.jsx` and `SettingsPage.module.css`

### 11.1 Layout

Full-width inside the content-shell. Header section → alert banners → tab strip → tab content panel.

### 11.2 Page Header

Title "Settings" — 1.5rem, weight 800, `var(--text-primary)`
Sub "Manage your account preferences and security" — 0.9rem, `var(--text-secondary)`

### 11.3 Tab Strip

4 tabs: Account, Security, Notifications, Connections

Tab container: inline-flex, `background: var(--slate-100)`, `border-radius: var(--radius-lg)`, `padding: 0.3rem`, `gap: 0.25rem`

Each tab button:
- Default: `background: transparent`, `color: var(--text-secondary)`, 0.83rem, weight 500, `border-radius: var(--radius-md)`, `padding: 0.4rem 0.875rem`
- Active: `background: var(--teal-600)`, `color: #ffffff`, weight 700, `box-shadow: var(--shadow-sm)` — update from indigo gradient
- Hover (not active): `background: rgba(20,184,166,0.08)`, `color: var(--teal-700)`

### 11.4 Tab: Account

Form fields: Name (text input), Email (text, disabled with note "Contact support to change").
Save button: `background: var(--teal-600)`, teal. Loading state: spinner inside button.

Profile picture section (if present): avatar display + "Change Photo" button.

### 11.5 Tab: Security

**Password change section:** Current Password, New Password, Confirm New Password. Update button: teal.

**MFA section:**
- Status indicator: badge — enabled=emerald, disabled=slate
- "Enable MFA" button: teal outlined
- "Disable MFA" button: rose danger-btn

**Active Sessions table:**
- Columns: Device, IP, Last Active, Actions
- Current session: highlighted with teal left border or "Current" badge in teal
- "End Session" button per row: small danger-btn
- "End All Other Sessions" button: danger-btn at bottom

### 11.6 Tab: Notifications

Toggle rows for:
- Email Notifications
- Weekly Digest
- Reminder Notifications

Each row: flex space-between, label on left, toggle switch on right.
Toggle switch: `width: 44px`, `height: 24px`, pill shape. ON: `background: var(--teal-500)`, thumb white. OFF: `background: var(--slate-300)`, thumb white.

### 11.7 Tab: Connections

**Gmail Integration panel:**
- Status: Connected badge (emerald) or Disconnected badge (slate)
- "Connect Gmail" button: teal with Gmail icon
- "Disconnect" link: `color: var(--rose-500)`, small, underlined

**Email Extraction Verification panel** (`EmailExtractionVerification` sub-component):
- Shown when connected; allows test of extraction accuracy
- Styled as inner card: `background: var(--slate-50)`, `border: 1px solid var(--border)`, `border-radius: var(--radius-lg)`, `padding: 1.25rem`

---

## SECTION 12 — AUTH PAGES (Login, Register, Verify Email)

Files: `client/src/pages/LoginPage.jsx`, `ConfirmEmailPage.jsx`, `VerifyEmailPage.jsx`

### 12.1 Auth Page Shell (.auth-page)

The current dark indigo gradient background works well for auth pages as a contrast from the light dashboard. However, to be consistent with the HireCanvas rebrand, the gradient should shift:

**Option A (keep dark dramatic):** Change from `#1e1b4b → #312e81 → #4c1d95 → #6d28d9` to `#134e4a → #0f766e → #0d9488 → #14b8a6` — a deep-to-vibrant teal gradient.

**Option B (light, matching dashboard):** Full page `background: var(--bg-page)` (#f0fdfb) with a centered card. Less dramatic but highly consistent.

**Recommendation:** Option A — the deep teal gradient gives the auth page a distinct, premium identity while being on-brand. The pseudo-element radial gradients should update to teal-tinted: `rgba(20,184,166,0.3)` and `rgba(13,148,136,0.25)`.

### 12.2 Auth Card (.auth-card)

Dimensions: `width: min(460px, 100%)`, `padding: 2.25rem`, `border-radius: var(--radius-xl)` (20px)
Background: `rgba(255,255,255,0.97)` — no change (white glass card works on any dark background)
Shadow: `0 24px 60px rgba(15,23,42,0.35), 0 0 0 1px rgba(255,255,255,0.1)` — no change

**Card title (.auth-card h1):** Change gradient from `var(--indigo-700) → var(--violet-600)` to `var(--teal-700) → var(--teal-500)`. Size: 1.75rem, weight 800.

**Subtitle (.auth-card p):** 0.9rem, `var(--text-secondary)`. Content: time-of-day greeting + "Sign in to your job search command center."

### 12.3 Mode Switcher (.auth-mode-switch)

Container: `background: var(--slate-100)`, `border-radius: var(--radius-lg)`, `padding: 0.3rem`

Active tab: `background: var(--teal-600)` (was `var(--indigo-600)`)
Active tab hover (not current): `background: rgba(20,184,166,0.08)`, `color: var(--teal-700)` (was indigo)

### 12.4 Form Inputs (.auth-form input)

Focus: `border-color: var(--teal-500)`, `box-shadow: 0 0 0 3px rgba(20,184,166,0.15)` (was indigo-400 + indigo shadow)

### 12.5 Submit Button (.auth-form button[type="submit"])

`background: linear-gradient(135deg, var(--teal-600) 0%, var(--teal-500) 100%)` (was indigo → violet)
`box-shadow: 0 4px 14px rgba(20,184,166,0.4)` (was indigo shadow)
Hover: deeper teal, stronger shadow.

### 12.6 Google Sign-In Button

Keep existing Google brand colors (`#4285f4 → #34a853` gradient) — this is a Google identity requirement. No change.

### 12.7 Error / Success Banners

Same `.auth-error` (rose) / `.auth-success` (emerald) pattern. No change needed.

### 12.8 MFA Step

Appears inline within the card, same form group pattern. A 6-digit numeric input for the OTP code. Standard border, teal focus ring.

### 12.9 Email Verification Pages

**ConfirmEmailPage / VerifyEmailPage:**
- Centered card on auth-page background
- Icon: `MdEmail` or envelope SVG, 48px, `var(--teal-500)`
- Heading: "Check your inbox" or "Verify your email"
- Body text: instructions
- CTA button: teal
- Resend link: `color: var(--teal-600)`, `text-decoration: underline`

---

## SECTION 13 — LANDING PAGE

File: `client/src/pages/LandingPage.jsx` and `LandingPage.module.css`

### 13.1 Overall Structure

The landing page is a public marketing page. It uses `LandingPage.module.css` which is largely independent of `app.css`. The branding update requires touching this file.

**Page background:** Linear gradient wash from `#f0fdfb` (teal-50) through `#ffffff`. Not a dramatic dark gradient — this is a light, fresh SaaS landing page look.

### 13.2 Nav Header

Height: 64px, `background: rgba(255,255,255,0.9)`, `backdrop-filter: blur(12px)`, `position: sticky`, top 0, `border-bottom: 1px solid var(--teal-100)`.

Left: "HireCanvas" logo — weight 800, `var(--teal-800)`.
Right: "Log In" ghost button + "Get Started" teal CTA button.

### 13.3 Hero Section

2-column layout at ≥768px, single column on mobile.

**Left column:**
- Eyebrow label: "Job Search — Reimagined" — 0.75rem, weight 700, uppercase, `var(--teal-600)`, letter-spacing 0.1em
- Headline: 3rem (desktop), 2rem (mobile), weight 900, letter-spacing -0.04em, `var(--text-primary)`
- Sub-headline: 1.0625rem, `var(--text-secondary)`, max-width 480px, line-height 1.7
- CTA row: "Start Free" button (teal, 48px height) + "Watch Demo" ghost link button
- Social proof line: "Join N+ job seekers" — 0.85rem, `var(--text-secondary)`, with avatar stack

**Right column:** App screenshot or dashboard mockup preview in a rounded card with teal shadow.

### 13.4 Features Grid (.FEATURES array)

6 cards, 3-column grid (desktop), 2-column (tablet), 1-column (mobile).

Each card:
- White background, `border-radius: var(--radius-xl)` (20px), `padding: 1.5rem`, `box-shadow: var(--shadow-sm)`
- Icon circle: 48×48px, `background: var(--teal-50)`, `border-radius: 12px`, icon in `var(--teal-500)` or `var(--teal-600)`
- Title: 1rem, weight 700, `var(--text-primary)`
- Description: 0.9rem, `var(--text-secondary)`, `line-height: 1.6`
- Hover: `transform: translateY(-4px)`, `box-shadow: var(--shadow-md)`, `border: 1px solid var(--teal-100)`

### 13.5 Pricing Section (.PLANS array)

3 cards: Free, Pro (highlighted), Elite.

**Pro card (popular):**
- Background: `var(--teal-600)` (was indigo gradient) — the dominant plan card is now teal
- All text on Pro card: white
- Border: none
- Transform: `scale(1.04)` at desktop
- Shadow: `0 20px 60px rgba(20,184,166,0.35)`

**Free and Elite cards:** white background, `border: 1px solid var(--border)`, normal shadow.

**CTA buttons per plan:**
- Free: ghost outlined teal button
- Pro: white button with teal text (`background: #fff`, `color: var(--teal-700)`, weight 700)
- Elite: teal filled button

### 13.6 Footer

Dark footer: `background: #134e4a` (teal-900). Logo in white. Links in `rgba(255,255,255,0.65)`. Copyright text in `rgba(255,255,255,0.4)`.

---

## SECTION 14 — COMPONENT LIBRARY

These are the universal shared components/classes needed across all views.

### 14.1 Buttons

**Primary Button (`.btn-primary`)**
```
background: var(--teal-600)
color: #ffffff
border: none
border-radius: var(--radius-md)
padding: 0.5rem 1.125rem
font-size: 0.875rem
font-weight: 600
height: 36px (inline) or 40px (form)
box-shadow: 0 2px 8px rgba(20,184,166,0.25)
hover: background var(--teal-700), box-shadow stronger
active: translateY(0)
disabled: opacity 0.5, cursor not-allowed
```

**Secondary Button (`.btn-secondary`)**
```
background: var(--bg-surface)
color: var(--text-primary)
border: 1.5px solid var(--border)
border-radius: var(--radius-md)
hover: background var(--teal-50), border-color var(--teal-300), color var(--teal-700)
box-shadow: var(--shadow-xs)
```

**Ghost Button (`.btn-ghost`)**
```
background: transparent
color: var(--teal-600)
border: none
padding: 0.5rem 0.875rem
hover: background var(--teal-50)
box-shadow: none
```

**Danger Button (`.danger-btn`) — existing, no change needed**
```
border-color: #fca5a5
color: var(--rose-600)
background: var(--rose-50)
```

**Icon Button (`.btn-icon`)**
```
Square: 32×32px or 36×36px
border-radius: var(--radius-sm)
background: transparent
border: 1px solid var(--border)
color: var(--text-secondary)
hover: background var(--teal-50), border-color var(--teal-200), color var(--teal-600)
```

### 14.2 Badges and Pills

**Status Chips (`.chip.status-*`) — keep all as-is.** These are semantic colors that should not be altered.

**Stage Pills (`.cc-stage-pill`) — keep as-is.** Same reasoning.

**AI Score Badge (`.cc-ai-score-badge`)**
```
display: inline-flex
align-items: center
gap: 4px
padding: 0.2rem 0.65rem
border-radius: 999px
font-size: 0.73rem
font-weight: 700
border: 1px solid
/* Colors per score range as defined in Section 1.1 */
```

**Tier Badge — update TierBadge.module.css:**
- Free: `background: var(--slate-100)`, `color: var(--slate-600)` — keep
- Pro: `background: var(--teal-100)`, `color: var(--teal-700)`, `border: 1px solid var(--teal-200)` — update from blue
- Elite: `background: linear-gradient(135deg, var(--teal-100) 0%, var(--emerald-100) 100%)`, `color: var(--teal-800)` — update from purple
- Admin: keep rose/red

**Nav Group Label** — see sidebar spec, `var(--teal-600)` at 0.68rem uppercase.

**Relationship Badge / Type Badges** — defined per view section above.

### 14.3 Form Inputs

All inputs, selects, and textareas share these focus styles:
```
border: 1.5px solid var(--border)
border-radius: var(--radius-md)
padding: 0.5rem 0.875rem
font-size: 0.875rem
background: var(--bg-surface)
color: var(--text-primary)
transition: border-color 0.18s, box-shadow 0.18s

:focus {
  border-color: var(--teal-500);
  box-shadow: 0 0 0 3px rgba(20,184,166,0.12);
  outline: none;
}
```

Replace all `var(--indigo-400)` focus border-colors and all `rgba(99,102,241,0.12)` focus shadows with the above teal values across `app.css`.

**Form Group Pattern:**
```
Label: display: block; font-size: 0.85rem; font-weight: 600; color: var(--slate-700); margin-bottom: 0.3rem;
Input: full width
Error text: font-size: 0.8rem; color: var(--rose-600); margin-top: 0.25rem; display: flex; align-items: center; gap: 4px;
```

### 14.4 Cards

**Surface Card (.cc-section-card / .module-panel type)**
```
background: #ffffff
border: 1px solid var(--border)  /* #e2e8f0 */
border-radius: var(--radius-lg)  /* 14px */
box-shadow: var(--shadow-xs)
```

**Elevated Card (hover-interactive cards)**
```
transition: transform 0.15s, box-shadow 0.15s
:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--teal-200); }
```

**Accent-top Card (KPI cards, stat mini-cards)**
```
position: relative
overflow: hidden
::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 4px; border-radius: 14px 14px 0 0; background: [accent color]; }
```

### 14.5 Tables (.cc-data-table)

```
th: background var(--slate-50), font-size 0.8rem, weight 600, color var(--text-secondary)
td: font-size 0.875rem, color var(--text-primary), padding 0.875rem 1rem
tr:hover td: background var(--teal-50)   ← update from slate-50
border-bottom on cells: 1px solid var(--border)
```

### 14.6 Modal / Dialog

**Overlay:**
```
position: fixed
inset: 0
background: rgba(15,23,42,0.55)
backdrop-filter: blur(4px)
z-index: var(--z-modal)
display: flex
align-items: center
justify-content: center
padding: 1rem
```

**Modal panel:**
```
background: #ffffff
border-radius: var(--radius-xl)  /* 20px */
padding: 1.75rem 2rem
width: min(540px, 100%)
box-shadow: var(--shadow-xl)
border: 1px solid var(--border)
position: relative
animation: modalEnter 200ms ease-out
```

**Modal header:** Title (1.125rem, weight 700) + close button (top-right, 28×28px, ghost icon button, hover rose-50/rose-500).

**Modal footer:** flex, justify-content flex-end, gap 0.5rem, padding-top 1rem, border-top `1px solid var(--border)`.

**@keyframes modalEnter:** `from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: none; }`

### 14.7 Empty States

Pattern for all empty list views:
```
Container: padding 3rem 1.5rem, display flex, flex-direction column, align-items center, text-align center
Icon: 48px, color var(--teal-300), margin-bottom 1rem
Heading: 1rem, weight 600, var(--text-primary)
Body: 0.875rem, var(--text-secondary), max-width 320px, line-height 1.6
CTA: teal primary button, margin-top 1.25rem (optional)
```

### 14.8 Loading States

**Skeleton Loader (`SkeletonLoader.jsx`):**
- Pulse animation: `@keyframes skeletonPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`
- Element: `background: var(--teal-100)`, `border-radius: var(--radius-sm)`, animation `skeletonPulse 1.6s ease-in-out infinite`
- Update from any current indigo-100 or slate-100 skeleton color to teal-100

**Spinner:** 20×20px circle, `border: 2.5px solid var(--teal-100)`, `border-top-color: var(--teal-600)`, `border-radius: 50%`, `animation: spin 0.7s linear infinite`.

**Page-level Loading:**
```
.auth-loading: min-height 100vh, flex center, font-size 1rem, color var(--text-secondary)
```
Currently shows "Loading…" text — optionally add the HireCanvas logo above it with the spinner.

### 14.9 Toast Notifications

File: `client/src/components/shared/Toast.jsx`

**Success toast:** `background: var(--emerald-50)`, `border-left: 4px solid var(--emerald-500)`, `color: #064e3b`
**Error toast:** `background: var(--rose-50)`, `border-left: 4px solid var(--rose-500)`, `color: #881337`
**Info toast:** `background: var(--teal-50)`, `border-left: 4px solid var(--teal-500)`, `color: var(--teal-800)` — update from indigo-tinted info toast if present

Position: `position: fixed`, `bottom: 1.5rem`, `right: 1.5rem`, `z-index: var(--z-toast)`, `max-width: 380px`

Entrance animation: slide in from right — `@keyframes toastIn { from { transform: translateX(100%); opacity: 0; } to { transform: none; opacity: 1; } }`

### 14.10 Inline Feedback Messages

`.inline-note.success` and `.inline-note.error` — keep as-is (emerald/rose). These are semantic.

`.cc-badge-soft` — update to teal as specified in Section 2.3.

---

## SECTION 15 — IMPLEMENTATION PRIORITY ORDER

Work through each phase sequentially. Each phase is independently shippable.

### Phase 1: Design Token Swap (Foundation — 1–2 hours)

All subsequent work depends on this.

**Target file:** `client/src/styles/app.css`

1. Extend the teal palette variables (add `--teal-200`, `--teal-300`, `--teal-400`, `--teal-700`, `--teal-800`, `--teal-900`)
2. Update semantic tokens: `--bg-page`, `--bg-sidebar`, `--accent`, `--accent-hover`, `--accent-soft`, all `--sidebar-*` tokens, all `--shadow-*` tokens
3. Do the mechanical find-and-replace for all indigo/violet accent references as listed in Section 1.7
4. Update `--bg-page` to `#f0fdfb`
5. Update focus ring color globally
6. Update scrollbar thumb color
7. Update `tokens.css` to align `--color-primary` with teal

**Result:** The entire app immediately shifts to teal accents while preserving all layouts.

### Phase 2: Sidebar Visual Overhaul (High Impact — 1–3 hours)

**Target file:** `client/src/styles/app.css` (`.sidebar`, `.brand`, `.menu-item`, `.nav-group-label`, `.cc-tier-card`, `.sidebar-footer`, `.sidebar-*` classes)

1. Replace sidebar background gradient with flat `var(--teal-100)`
2. Update all sidebar text colors to teal-800/900 family
3. Update brand `h2` to solid `var(--teal-900)` (remove gradient)
4. Update nav group labels to `var(--teal-600)`
5. Update active item indicator color and background
6. Update sidebar footer border and button colors
7. Update tier card to teal tints
8. Update avatar border/initials background

**Result:** Sidebar goes from dark indigo to light mint/teal.

### Phase 3: Topbar and Shell Polish (Low-risk — 30 minutes)

**Target file:** `client/src/styles/app.css` (`.cc-topbar`, `.cc-sync-btn`, `.cc-badge-soft`, `.cc-topbar-avatar`)

1. Update sync button to teal
2. Update badge to teal
3. Add "Upgrade" button spec if not already present in JSX
4. Avatar hover border to teal

### Phase 4: Dashboard Home View (Core Experience — 2–4 hours)

**Target files:** `client/src/styles/app.css` (`.cc-kpi-card`, `.cc-bar`, `.cc-log-icon`, `.cc-log-footer`, `.cc-filter-btn`, `.cc-action-link`, `.cc-view-all-btn`, `.cc-data-table tr:hover`), `DashboardHomeView.jsx`

1. Add `::before` accent bar to KPI cards (4-color scheme)
2. Update bar chart colors to teal
3. Update log icon backgrounds to teal (with semantic overrides per event type)
4. Update table row hover to `var(--teal-50)`
5. Add AI Score column to Active Pipeline table (new `th` and `td` + AI score badge component)
6. Update all teal-converted action links and button colors

### Phase 5: Job Tracker View (2–3 hours)

**Target files:** `client/src/styles/app.css` (`.tracker-card`, `.pipeline-col span`, drag-drop target styles), `JobTrackerView.jsx`

1. Update Kanban column count badge to teal
2. Update Wishlist card left border from slate-400 to `var(--teal-300)`
3. Add AI score badge rendering in `renderJobTrackerCard`
4. Update drag-drop hover state to teal dashed border
5. Update smart view active pill to teal
6. Update job form background/border to teal
7. Update submit button

### Phase 6: Other Views — Contacts, Outreach, Reminders (2–4 hours combined)

Work through these together as they share the same pattern: form background → teal, card top/left border → teal, submit button → teal, chip colors → per semantic spec, focus rings → teal.

**Contacts:** Update contact-card top border gradient, relationship badge colors.
**Outreach:** Update Sent status chip to teal, card top border to teal-400, form to teal.
**Reminders:** Update left border to teal-400, type chip colors, toggle active state, stats row card accents.

### Phase 7: Toolkit Views — Templates, Interview Prep, Resume Manager (1–2 hours combined)

**Templates:** template-card already has `border-top: 3px solid var(--teal-500)` — keep. Update type chip for Email to teal, archive panel to teal.
**Interview Prep:** Update Behavioral category chip to teal, focus rings, add progress bar.
**Resume Manager:** Update upload zone to teal, card borders to teal, ATS result panel to teal.

### Phase 8: Settings Page (1–2 hours)

**Target files:** `SettingsPage.module.css`

1. Tab strip active state from indigo gradient to `var(--teal-600)` flat
2. Toggle switches ON state to `var(--teal-500)`
3. Save/action buttons to teal
4. Connections panel to teal badge colors

### Phase 9: Auth Pages (1 hour)

**Target files:** `client/src/styles/app.css` (`.auth-page`, `.auth-card h1`, `.auth-mode-switch button.active`, `.auth-form input:focus`, `.auth-form button[type="submit"]`)

1. Update auth page background gradient to deep teal
2. Update pseudo-element radial blobs to teal-tinted
3. Update card title gradient to teal
4. Update mode switch active tab to teal
5. Update input focus ring to teal
6. Update submit button to teal

### Phase 10: Landing Page (2–3 hours)

**Target file:** `client/src/pages/LandingPage.module.css`

1. Update nav header border to teal
2. Update hero CTA to teal
3. Update feature card icons to teal
4. Update pricing Pro card from indigo to `var(--teal-600)`
5. Update footer to deep teal background

### Phase 11: TierBadge Component Update (30 minutes)

**Target file:** `client/src/components/shared/TierBadge.module.css`

1. Pro tier: teal colors
2. Elite tier: teal-to-emerald gradient

---

## Additional Implementation Notes

**CSS variable scope:** All changes should be to the CSS variables in `:root` within `app.css` wherever possible. This ensures a single source of truth. Avoid hardcoding `#14b8a6` in component files — always use `var(--teal-500)` or `var(--accent)`.

**Backward compatibility:** The status chip colors (`.chip.status-applied` = blue, `.chip.status-screening` = amber, etc.) must NOT change. They are semantically meaningful and contrast correctly against white card backgrounds. Similarly, the email type chips (blue/violet/emerald/rose/teal/amber) are semantic and should be preserved.

**Dark mode:** The existing `@media (prefers-color-scheme: dark)` block in `tokens.css` will need a companion update once the light mode redesign is complete. Out of scope for initial implementation — add a TODO comment.

**Mobile (≤768px):** The sidebar is hidden and replaced by `MobileTabBar` component. The teal color update should also be applied to the MobileTabBar's active indicator. The sidebar changes do not affect mobile layout.

**The "Upgrade" CTA button location:** Currently the design shows it in the top-right of the topbar. In the `Dashboard.jsx` topbar JSX, add it conditionally: `{user?.tier !== 'elite' && <button className="btn-primary" onClick={onOpenBilling}>Upgrade</button>}`.

**AI Score data:** The `aiScore` field on job objects is a new backend concern. For now, implement the UI to gracefully handle `undefined` (render "—"). The backend can add this field independently. Do not block UI implementation on the backend feature.

---

### Critical Files for Implementation

- `/c/Users/manik.DESKTOP-SD2I0QV/job-search-hub-ai/client/src/styles/app.css`
- `/c/Users/manik.DESKTOP-SD2I0QV/job-search-hub-ai/client/src/styles/tokens.css`
- `/c/Users/manik.DESKTOP-SD2I0QV/job-search-hub-ai/client/src/components/views/DashboardHomeView.jsx`
- `/c/Users/manik.DESKTOP-SD2I0QV/job-search-hub-ai/client/src/pages/Dashboard.jsx`
- `/c/Users/manik.DESKTOP-SD2I0QV/job-search-hub-ai/client/src/components/shared/TierBadge.jsx`