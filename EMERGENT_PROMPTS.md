# Emergent prompt pack — EPL custom MC panels

5 self-contained prompts for Jose to paste into Emergent (or v0 / Bolt / Lovable). Each prompt is designed to let the AI builder OUT-DESIGN the HTML mockup visually while preserving the data contract that the rest of Mission Control depends on.

## How to use

1. Open Emergent. Start a new project. Pick "React + Tailwind + shadcn/ui" (or the closest equivalent).
2. Pick the panel you're building this round. Paste the corresponding §X prompt below verbatim.
3. Drag the matching HTML mockup screenshot into Emergent as visual reference (`~/mission-control/mockup/<name>-panel-preview.html` → open + cmd-shift-4 for a screenshot, or just use the file as upload).
4. Iterate in Emergent until the visuals are stronger than the mockup. **Do not change the data shape, prop names, or cross-nav targets** listed in §Contract.
5. Export React. Replace the contents of `src/components/panels/epl-<name>-panel.tsx` with the generated component.
6. The matching API endpoint `/api/epl/<name>` already returns mock JSON in the exact shape your component should fetch — no backend wiring needed for the first pass.

## What Emergent should improve

- Typography (we're on Inter via the MC fork — feel free to use display weights for headlines)
- Spacing, breathing room, card depth
- Hover/focus animations, micro-interactions
- Dark mode (MC already has theme support — match `theme-background.tsx` tokens)
- Empty/loading/error states
- Mobile responsiveness (Gerda checks from her phone)

## What Emergent must NOT change

- Field names in the JSON contract (or your component won't read the existing API)
- The 5 panel IDs: `today` `projects` `properties` `maintenance` `decisions`
- The cross-nav targets (header chips / drawer "open in" buttons jump to other panels)
- The aggregator-source attribution (every data widget cites its canonical source — Gerda insists)

---

## §1 Today panel — Gerda's personal landing

**Goal:** when Gerda logs into mc.str-agents.com first thing in the morning, this is the ONLY screen she needs for the next 5 minutes. Decision-grade information density, zero decoration.

**Layout regions (top to bottom):**

1. Compact greeting line: "Good morning Gerda" + date + weather chip + agent count chip ("12 agents · 3 need you").
2. **Top 3 Actions** — large cards, biggest visual weight on the page. Each: title (1 line, 18-20px), 1-line "why" subtitle, primary CTA button that deep-links to the right panel.
3. **Agents overnight** — single horizontal row of agent chips. Each chip: name, role, action count, status dot (green/amber/red/grey). Click → open agent panel.
4. **KPIs** — 4 small cards in a row: open maintenance tickets, cash runway, avg star rating (30d), active flats. Show delta vs prior period.
5. **Waiting on you** — table with: id (R1-R32), title, age (badge: green <2d, amber 2-7d, red >7d), category chip, owner. Click row → open Decisions panel filtered to that id.

**Contract (fetch from `GET /api/epl/today`):**

```ts
{
  generatedAt: string,
  actions: { id: string, title: string, why: string, cta: string, deeplink: string }[],
  agentsOvernight: { name: string, role: string, actions: number, status: 'ok'|'review'|'offline', headline: string }[],
  kpis: { label: string, value: string, delta: string }[],
  waitingOnYou: { id: string, title: string, age: string, category: string, owner: string }[]
}
```

**Cross-nav targets:** Top 3 Actions CTA buttons follow `deeplink` field (already absolute paths like `/decisions?id=R1`). Agent chips link to `/agents?name=<agentname>`. Waiting-on-you rows link to `/decisions?id=<id>`.

**Reference screenshot:** `/mockup/today-panel-preview.html` (served from MC). Use it as visual baseline — beat it on polish, keep the priorities.

---

## §2 Projects panel — 6-column Kanban (Asana replacement)

**Goal:** Gerda + Jose + Atlas see all in-flight work in one place. Replaces Asana for the agent-fleet projects in Wk4.

**Layout:** Horizontal 6-column board. Columns equal width on desktop, swipeable on mobile. Drag-drop between columns.

**Columns:** `Inbox` · `Up next` · `In progress` · `Waiting` · `Review` · `Done (this week)`

**Card design:**
- Title (2 lines max, ellipsis)
- Owner avatar (use agent emoji if no photo: Sofia 📨, James 💰, Atlas 🧭, Hugo 🔧, Larry 🤝, etc.)
- Tag chips (`agent-build`, `EPL`, `landlord`, `data`, etc.)
- Age badge (green <2d, amber 2-7d, red >7d)
- Click → drawer with subtasks + comment thread

**Contract (`GET /api/epl/projects`):**

```ts
{
  generatedAt: string,
  columns: {
    id: 'inbox'|'up_next'|'in_progress'|'waiting'|'review'|'done_this_week',
    label: string,
    cards: { id: string, title: string, owner: string, tags: string[], age: string }[]
  }[]
}
```

**Cross-nav:** card with tag `maintenance` shows a small "open in 🔧" button → `/maintenance`. Same for `landlord` → `/decisions?category=Rapid`.

**Reference:** `/mockup/projects-panel-preview.html`

---

## §3 Properties panel — heat map + Hot/Star callouts

**Goal:** see all 50 flats at a glance. Heat-colour by composite score (occupancy × margin × guest score × open tickets). Click any tile → detail drawer.

**Layout regions:**

1. **Portfolio KPIs strip** — 5 numbers: total flats, live, onboarding, avg occupancy 30d, total net margin 30d.
2. **Hot / Star / Cold callouts** — 3 horizontal panels, 3 tiles each. Hot = top performers. Star = highest guest score. Cold = onboarding or under-performing.
3. **Heat map grid** — 4-wide tile grid (responsive: 2-wide on mobile, 6-wide on ultra-wide). Tile colour = heat state.

**Heat colours (LOCKED — do not change palette):**
- `hot`     → emerald 600 background, white text
- `warm`    → emerald 200 background
- `neutral` → slate 200 background
- `cool`    → amber 200 background
- `cold`    → slate 100 with dashed border (onboarding) OR rose 200 (under-performing)

**Tile design (each):**
- Display name (1 line)
- Beds icon · brand chip (EPL/Staylio/NourNest/UrbanReady)
- 3 micro-stats: 🟢 occ%, 💷 net margin, ⭐ guest score
- 🔧 open ticket count badge (only if >0)

**Detail drawer (slides in from right when tile clicked):**
- Header: canonical_id + display name + brand
- Tabs: Overview · Bookings · Maintenance · Guest reviews · P&L · Compliance
- Footer: "Aggregator Principle — data sources" → list of canonical sources used

**Contract (`GET /api/epl/properties`):**

```ts
{
  generatedAt: string,
  tiles: {
    canonical_id: string,
    display_name: string,
    beds: number,
    brand: 'EPL'|'Staylio'|'NourNest'|'UrbanReady',
    heat: 'hot'|'warm'|'neutral'|'cool'|'cold',
    occupancy_30d: number,
    net_margin_30d: number,
    guest_score: number,
    open_tickets: number,
    status: 'live'|'onboarding'|'archived'
  }[],
  callouts: { hot: Tile[], star: Tile[], cold: Tile[] },
  sources: { registry: string, occupancy: string, revenue: string, guest_score: string, open_tickets: string, status: string }
}
```

**Cross-nav:** drawer's "Maintenance" tab loads from `/api/epl/maintenance?property=<canonical_id>`. "Open in Maintenance" button jumps to `/maintenance?filter=<canonical_id>`.

**Reference:** `/mockup/properties-panel-preview.html` — note the Aggregator Principle footer is REQUIRED, not decorative.

---

## §4 Maintenance panel — Hugo Phase 3 home

**Goal:** Kris and Gerda triage maintenance tickets. Replaces the WhatsApp scroll-back.

**Layout regions:**

1. **KPI strip** — open total, P0 count, P1 count, awaiting-parts >7d. If `hugo_status !== 'live'` show "Hugo offline — showing mock data" banner.
2. **5-column Kanban** — `Inbox` · `In progress` · `Awaiting parts` · `Resolved (this week)` · `Cancelled`. Drag between columns.
3. **Property heat map** — secondary view, smaller tiles. Heat by open ticket count + max severity.

**Ticket card design:**
- Severity badge (P0 red · P1 orange · P2 amber · P3 grey) — top-left, dominant
- Property canonical_id + display name
- Summary (2 lines)
- Footer: assignee avatar + age badge
- Action buttons (visible on hover): Resolved · Awaiting · Reassign · Cancel

**Assignee allowlist (HARD RULE):**
- NEVER render `U07FQ300EVB` (Hanna — left)
- NEVER render `U09MSN2EFK6` (Sheikh Abuzar duplicate account)
- Allowed: Zain (P0/P1), Kris (P2/P3), Em (P1 insurance), Gerda (P0 escalation)

**Contract (`GET /api/epl/maintenance`):**

```ts
{
  generatedAt: string,
  tickets: {
    id: string, property: string, summary: string,
    severity: 'P0'|'P1'|'P2'|'P3',
    status: 'open'|'in_progress'|'awaiting_parts'|'resolved'|'cancelled',
    assignee: string, age_hours: number, ts: string
  }[]
}
```

Also: `?part=kanban` returns `{ columns: { inbox: [], in_progress: [], ... } }` pre-bucketed. `?part=heat` returns per-property summary.

**Cross-nav:** property name in card → `/properties?canonical_id=<property>`. Assignee avatar → `/agents?name=hugo`.

**Reference:** `/mockup/maintenance-panel-preview.html`

---

## §5 Decisions panel — Gerda's queue with Atlas recommendations

**Goal:** the decision throughput bottleneck. Show every open decision, age-risk first, with Atlas's recommended default so Gerda can approve/reject in one click.

**Layout regions:**

1. **Status strip** — total · open · decided · blocked counts (4 numbers, big).
2. **Age-risk callout** — banner if any open decision is >10 days old. Lists them in red.
3. **Decisions list** — grouped by category. Each row: id chip · title · status pill · age badge · owner · expand caret.
4. **Detail drawer** (slides in when row clicked):
   - Header: id + title + category chip + status pill
   - **Atlas recommendation** block (lavender background, bot icon) — the AI-suggested default with reasoning
   - 3 action buttons: 🟢 Approve default · 🔴 Reject · 💬 Discuss in Slack
   - Automation hooks footer (what happens when approved — e.g. "Atlas runs `larry create-draft`, posts to thread")

**Category palette:**
- Hugo → wrench 🔧 + slate
- Rapid → bolt ⚡ + amber
- Architecture → blueprint 📐 + sky
- AI Policies → shield 🛡 + violet
- MC build → screen 🖥 + emerald
- Maintenance → toolbox 🧰 + rose

**Status palette:**
- open → amber pill
- decided → emerald pill (with checkmark)
- blocked → slate pill (with lock icon)

**Contract (`GET /api/epl/decisions`):**

```ts
{
  generatedAt: string,
  decisions: {
    id: string, title: string,
    category: 'Hugo'|'Rapid'|'Architecture'|'AI Policies'|'MC build'|'Maintenance',
    status: 'open'|'decided'|'blocked',
    age_days: number, owner: string,
    recommendation?: string, default_applied?: string
  }[]
}
```

Also: `?part=age-risk` returns aged>10d items. `?part=by-category` returns grouped.

**Cross-nav:** decision with `category=Hugo` shows "open in 🔧" → `/maintenance`. `category=Rapid` "open in 📋" → `/projects`.

**Reference:** `/mockup/decisions-panel-preview.html`

---

## §6 Agents (fleet) panel — Gerda's agent tracker

**Goal:** see the entire 15-agent fleet at a glance. Surface staleness, status, current Phase, KPI count, and what each agent did last. Replaces the spreadsheet Gerda kept threatening to build.

**Layout regions:**

1. **Fleet KPI strip** — 5 numbers: total · healthy · review · offline · stale ROADMAPs.
2. **Stale ROADMAP callout** — amber banner if any agent has ROADMAP age >7d. Lists them as chips. Edward's Friday scan feeds off this.
3. **Fleet table** — 1 row per agent. Columns: name (with emoji) · category chip · phase · status pill · ROADMAP age badge · KPI count · headline · stats source (live/mock).
4. **Per-agent drawer** (slides in when row clicked): full /api/stats response + recent activity timeline + link to agent ROADMAP + "open in Slack" button.

**Status palette:**
- ok → emerald pill
- review → amber pill
- offline → slate pill
- blocked → rose pill

**Category palette:** see existing colour map in `/mockup/agents-panel-preview.html` style block.

**Stats source badge:**
- `live` → green badge — agent's /api/stats returned data
- `mock` → grey "mock" badge — agent doesn't expose /api/stats yet OR is offline

**Contract (`GET /api/epl/agents`):**

```ts
{
  generatedAt: string,
  agents: {
    name: string, role: string,
    category: 'PA'|'Finance'|'Marketing'|'Revenue'|'Pricing'|'Compliance'|'CoS'|'Meta'|'Cash'|'QA'|'Landlord'|'Onboarding'|'Acquisition'|'Maintenance'|'Research'|'Health',
    phase: string,
    status: 'ok'|'review'|'offline'|'blocked',
    last_action: string,            // ISO
    roadmap_age_days: number,
    kpi_count: number,
    headline: string,
    stats_url?: string,
    stats_source: 'live'|'mock'
  }[]
}
```

Also: `?part=summary` for the KPI strip · `?part=stale-roadmaps` for the callout · `?part=by-category` for groupings.

**Per-agent detail (`GET /api/epl/agents/[name]`):**

```ts
{
  name: string,
  roadmap_age_days: number | null,
  stats_source: 'live'|'mock',
  stats_url: string | null,
  stats: { agent: string, [k: string]: any }  // live /api/stats response or placeholder
}
```

**Cross-nav:** clicking an agent row → drawer. Drawer "open in chat" → `/chat?agent=<name>`. "open in ROADMAP" → opens GitHub link if repo wired. Maintenance agent (Hugo) drawer shows the same data as the Maintenance panel summary.

**Reference:** `/mockup/agents-panel-preview.html`

---

## Bonus: `/api/epl/atlas-brief` — morning brief composer

This isn't a panel — it's the data source for Atlas's 08:00 BST DM to Gerda AND a Today-panel banner. Worth knowing it exists so you can build a small "Today's brief" widget on the Today panel that fetches `GET /api/epl/atlas-brief?format=markdown` and renders it.

**Endpoint:** `GET /api/epl/atlas-brief?format=markdown&role=gerda|kris|arianne`

**Output:** plain-text Markdown ready for Slack. Composes from `/api/epl/today` + `/api/epl/maintenance` + `/api/epl/decisions?part=age-risk` + `/api/epl/agents?part=stale-roadmaps`. Hugo is the canary — when Hugo's /api/stats goes live, maintenance numbers in the brief flip from mock to live automatically.

---

## Test it locally before pushing

```bash
cd ~/mission-control
pnpm dev    # http://localhost:3000
# Visit each panel:
#   /today  /projects  /properties  /maintenance  /decisions
```

Until you replace `src/components/panels/epl-<name>-panel.tsx`, each route renders the HTML mockup inside an iframe + a yellow dev banner pointing back to this file. Once you paste in your Emergent React, the banner disappears and the live React takes over.

## Deploy

```bash
cd ~/mission-control
pnpm build
pnpm test:all   # quality gate
# then per HETZNER_PRODUCTION.md → rsync or docker compose push to 204.168.227.30
```
