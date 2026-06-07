# AX Schedule — Frontend Design

## Stack

**Vanilla JS + CSS — no framework, no build step.**

- ES modules (`<script type="module">`) loaded directly in the browser
- No bundler, no transpiler, no Node.js required to run
- `index.html` opens locally or is served from any static host
- `events.json` is fetched with `fetch()` on load

Vanilla JS is feasible through all three phases. See the [Framework Assessment](#framework-assessment) section for the full reasoning.

---

## Framework Assessment

### Is vanilla JS sustainable through Phase 3?

**Yes — with one architectural commitment up front: a reactive store.**

Each phase introduces new state variables. Without a reactive store, every state change requires manually finding and updating every affected DOM element. With one, you call `setState({day: 2})` and all registered renderers re-run automatically. This is ~40 lines of code and eliminates the main scaling risk of vanilla JS.

### State surface by phase

| Phase | New state variables | Risk without store |
|---|---|---|
| 1 | `day`, `goingTo` (Set), `modalEvent` | Low — 3 variables, direct DOM updates fine |
| 2 | `+ viewMode`, `filters`, `compareSchedule` | High — filter + compare interactions require coordinated re-renders |
| 3 | `+ highlightedRooms`, `mapVisible` | Low net addition — map is direct SVG DOM, not reactive |

Phase 2 is the inflection point. The comparison view requires that a single "compare schedule imported" action simultaneously updates the grid (new color coding), the list (new badges), and a possible map view. Without a store, these are three separate manual DOM hunts. With one, it's one `setState` call.

Phase 3 is actually *friendlier* to vanilla than a framework. Highlighting a room on an SVG map means `el.classList.add('highlighted')` on a real DOM node — frameworks make you model this declaratively, which is more awkward for direct graphical manipulation.

### The reactive store (40 lines, no library)

```js
// store.js
const state = {
  day: 1,
  view: 'schedule',          // 'schedule' | 'my-schedule'
  scheduleMode: 'grid',      // 'grid' | 'list'  (Phase 2)
  filters: { timeRange: null, show18Plus: true },  // Phase 2
  modalEvent: null,
  highlightedRooms: [],      // Phase 3
};

const subscribers = new Set();

export function getState() { return { ...state }; }

export function setState(patch) {
  Object.assign(state, patch);
  subscribers.forEach(fn => fn({ ...state }));
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);  // returns unsubscribe fn
}
```

Each view module subscribes on mount and unsubscribes on destroy. No library. No magic. This pattern scales cleanly to Phase 3's ~8 state variables.

### When would a framework actually help?

Only if the comparison view + map highlight interactions push past ~10 tightly interdependent state variables and the manual subscription wiring becomes hard to follow. At that point the zero-friction upgrade is **Preact via CDN** (no build step, 3KB gzipped, uses tagged template literals instead of JSX):

```html
<script type="module">
  import { h, render } from 'https://esm.sh/preact';
  import { useState } from 'https://esm.sh/preact/hooks';
  import htm from 'https://esm.sh/htm';
  const html = htm.bind(h);
  // ... components look exactly like React but load from CDN
</script>
```

The store pattern above is intentionally Preact-compatible — state is a plain object, updates are explicit. If a migration becomes necessary, the store becomes a Preact signal and render functions become components. This is the escape hatch if Phase 2/3 proves harder to coordinate than expected.

**Recommendation: start with vanilla + the store above. Migrate to Preact only if Phase 2 state wiring feels brittle in practice.**

---

## File Structure

```
ax-schedule/
├── index.html
├── events.json
├── preprocess.py
├── PLAN.md
├── DESIGN.md
└── src/
    ├── css/
    │   └── styles.css
    └── js/
        ├── app.js          # entry point; mounts views, wires nav tabs
        ├── store.js        # reactive state store (day, view, filters, modal, highlights)
        ├── data.js         # fetch + cache events.json; filter/group helpers
        ├── storage.js      # GoingTo localStorage abstraction (per PLAN.md spec)
        ├── grid.js         # timeline grid view renderer
        ├── list.js         # list view renderer (Phase 2)
        ├── my-schedule.js  # My Schedule list renderer
        ├── modal.js        # event detail modal (shared by all views)
        └── map.js          # venue map view (Phase 3)
```

Each `js/` module exports a single `mount(container, state)` function and a `destroy()` / `update(state)` pair — no framework needed, just functions that write to the DOM.

---

## Color Palette

### Theme: "Midnight Convention"

Dark-mode default. Deep indigo base with electric blue primary accent and AX red as the "going to" highlight. The indigo-black feels appropriate for a multi-day convention that runs into the early morning; the red nods to AX's own brand without copying it exactly.

| Role | Token | Hex |
|---|---|---|
| Page background | `--bg` | `#0d0d1a` |
| Surface (cards, panels) | `--surface` | `#16162a` |
| Surface raised (modal, hover) | `--surface-raised` | `#1f1f38` |
| Border / divider | `--border` | `#2c2c50` |
| Text primary | `--text` | `#eeeeff` |
| Text secondary / muted | `--text-muted` | `#7878a8` |
| Text on accent | `--text-on-accent` | `#ffffff` |
| Primary accent (interactive) | `--accent` | `#4e6ef2` |
| Primary accent hover | `--accent-hover` | `#6b87f5` |
| "Going to" highlight | `--going` | `#e84c6b` |
| "Going to" glow | `--going-glow` | `rgba(232,76,107,0.25)` |
| 18+ badge | `--badge-18` | `#ff7043` |
| Cleared-room badge | `--badge-clear` | `#3dbfa0` |
| Day tab active | `--tab-active` | `#4e6ef2` |
| Scrollbar thumb | `--scrollbar` | `#2c2c50` |

All colors are defined as CSS custom properties on `:root` so they're easy to theme or adjust.

### Accent usage rules

- `--accent` only for: active tabs, focused inputs, primary buttons, "Going To" toggle in its unchecked state
- `--going` only for: the "Going To" active/checked state (card border, modal button background, list dot)
- Never mix `--accent` and `--going` on the same element

---

## Typography

**No external fonts.** System font stack loads instantly and looks good on both platforms.

```css
font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
```

| Scale | Size | Weight | Usage |
|---|---|---|---|
| `--text-xs` | 11px | 500 | Badges, time axis labels |
| `--text-sm` | 13px | 400 | Event card body, secondary info |
| `--text-base` | 15px | 400 | Default body text |
| `--text-lg` | 18px | 600 | Modal title, section headers |
| `--text-xl` | 22px | 700 | App name in header |

Line-height: 1.4 for body, 1.2 for headings. No decorative fonts.

---

## Layout

### Shell (both mobile + desktop)

```
┌─────────────────────────────┐
│  HEADER  (app name + day)   │  48px, sticky top
├─────────────────────────────┤
│  NAV TABS  (Schedule │ Mine)│  40px, sticky below header
├─────────────────────────────┤
│                             │
│     MAIN CONTENT AREA       │  flex-1, overflow-y auto
│                             │
└─────────────────────────────┘
```

### Mobile (< 768px)

- Header: app name left, "Day N" chip right
- Nav tabs: full-width row, equal split
- Day selector: horizontal scrollable pill row *within* the Schedule view, below the nav tabs
- Schedule grid: horizontally scrollable; time axis sticks to left edge on scroll
- My Schedule: full-width card list, no grid

### Desktop (≥ 768px)

- Header: app name left, day selector pill row center-right
- Nav tabs: inline with header or directly below it
- Schedule grid: fills available width; room column groups visible without horizontal scroll where possible (collapse empty-day rooms to help)
- My Schedule: max-width container, two-column card layout on wide screens

---

## Component Specs

### Day Selector

Seven pill buttons: "Jul 2" / "Jul 3" / "Jul 4" / "Jul 5". Active pill: `--accent` fill, white text. Inactive: `--surface-raised` fill, `--text-muted` text.

On mobile this row scrolls horizontally if it doesn't fit — it won't overflow or wrap.

---

### Schedule Grid (Timeline)

**Structure:**

```
         │ LACC Panels          │ JW Marriott │ Main Stages  │ Outdoor/Other   │
         │ 402A 403AB … Petree  │ Plat  Dia   │ Peacock Cry  │ Beer AXX Novo … │
─────────┼──────────────────────┼─────────────┼──────────────┼─────────────────┤
10:00 AM │                      │             │ ████████████ │                 │
         │                      │             │              │                 │
10:30 AM │ ████ ████████        │             │              │ ████████        │
         │                      │             │              │                 │
11:00 AM │      ████████        │ ████████    │              │                 │
```

**Time axis (left column):**
- 30-minute tick marks, labeled at the hour (`10 AM`, `11 AM`, etc.)
- Pixel-per-minute: 1.5px (adjustable via CSS variable `--px-per-min`)
- Axis width: 56px, sticky on horizontal scroll via `position: sticky; left: 0`
- Day 2 and 3 extend past midnight; show `12 AM`, `1 AM`, `2 AM` naturally

**Room column groups:**

| Group | Rooms |
|---|---|
| LACC Panels | 402A, 403AB, 404AB, 406AB, 408AB, 409AB, 411, 511ABC, 515 AB, Concourse Hall E, Petree Hall |
| JW Marriott | JW Diamond, JW Platinum |
| Main Stages | Crypto.com Arena, Main Events (Crypto.com Arena), Peacock Theater |
| Outdoor / Other | AX Crossing, AX Dance, Beer Garden at Peacock Place, Lounge 21, The Novo |

- Group header row spans all room sub-columns within it, with a subtle bottom border
- Room sub-header row shows individual room names (abbreviated on mobile)
- Empty rooms for the selected day are hidden (no column rendered)
- Group separator: 2px `--border` gap between groups

**Event block positioning:**
- `position: absolute` within each room column's inner container
- `top = (start_int - dayStartMin) * PX_PER_MIN`
- `height = (end_int - start_int) * PX_PER_MIN`, min 20px
- Overlapping events in the same room: split column width equally (2 events = 50% each, etc.)
  - Overlap detection: two events overlap if `a.start_int < b.end_int && b.start_int < a.end_int`

**Event card (grid):**
```
┌─╔══════════════════╗
│ ║ Title (truncated)║  ← --going border if marked
│ ║ 10:00 – 10:50 AM║
└─╚══════════════════╝
```
- Left border 3px: `--accent` default, `--going` if marked
- Background: `--surface`
- On hover: background `--surface-raised`
- Badges: 18+ (`--badge-18`), cleared-before ↑ / cleared-after ↓ (`--badge-clear`) as tiny pill overlays
- Click → opens modal

**Scroll behavior:**
- Outer container: `overflow-x: auto; overflow-y: auto`
- Time axis column: `position: sticky; left: 0; z-index: 2`
- Group/room header row: `position: sticky; top: 0; z-index: 3`
- Both stick simultaneously so the corner cell (top-left) doesn't disappear

---

### Event Detail Modal

- Centered overlay with backdrop blur on desktop, bottom sheet on mobile (slides up)
- Max-width 560px desktop, full-width mobile
- Focus-trapped while open; `Escape` closes it

**Content layout:**
```
┌──────────────────────────────────────┐
│ [18+]  Title of the Event         ✕  │
│ Jul 3 · 2:00 PM – 3:00 PM           │
│ Room: Petree Hall                    │
│ ─────────────────────────────────── │
│ [cleared before notice if true]      │
│ [cleared after notice if true]       │
│ ─────────────────────────────────── │
│ Description text…                    │
│                                      │
│ ┌────────────────────────────────┐   │
│ │  ♥  Going To  (toggle button)  │   │
│ └────────────────────────────────┘   │
└──────────────────────────────────────┘
```
- "Going To" button: full-width, `--going` fill when active, `--surface-raised` outline when inactive
- Cleared notices: teal left-border callout, short one-line message ("Room cleared before this panel — early entry likely")

---

### My Schedule List

- Header: "My Schedule — N events across 4 days"
- Grouped by day (sticky group headers: "Day 1 — July 2")
- Each event: horizontal card

```
┌─────────────────────────────────────────────────┐
│ ● 10:00 AM – 10:50 AM   The Novo                │
│   Welcome Ceremony                              │
└─────────────────────────────────────────────────┘
```
- `●` dot: `--going` color
- Time + room on one line (muted), title below
- Click → modal (with option to unmark)
- Empty state: centered illustration placeholder + "No events yet — browse the Schedule tab"

---

## Responsive Breakpoints

| Breakpoint | Value | Key changes |
|---|---|---|
| Mobile | `< 768px` | Bottom-sheet modal, horizontal-scroll grid, single-column list |
| Tablet | `768px – 1200px` | Modal centered, grid fits more columns |
| Desktop | `> 1200px` | Two-column My Schedule, full grid visible |

CSS approach: mobile-first, `@media (min-width: 768px)` for overrides. No JS breakpoint detection needed.

---

## Interaction Details

| Interaction | Behavior |
|---|---|
| Tap event card | Open detail modal |
| Toggle "Going To" | Update localStorage, re-render card border in both grid and list instantly |
| Close modal | Backdrop click, ✕ button, or Escape key |
| Switch day tab | Re-render grid for that day; preserve scroll position between day switches (reset on tab switch) |
| Switch Schedule / My Schedule | Instant (no fetch, data is already in memory) |

---

## Accessibility Baseline

- All event cards: keyboard-focusable (`tabindex="0"`), `role="button"`, `aria-label` with title + time
- Modal: `role="dialog"`, `aria-modal="true"`, focus trapped, returns focus to triggering card on close
- Day tabs: `role="tablist"` / `role="tab"` / `aria-selected`
- Color is never the *only* indicator — "going to" state also changes the button text and adds a border
- The grid is acknowledged as keyboard-unfriendly by nature; the My Schedule list view is the accessible alternative

---

## Decisions to Revisit

- **`--px-per-min` value**: 1.5px/min = 90px/hour. An 8-hour day = 720px tall. On mobile this may need to be larger (events too small to tap) or smaller (too much scrolling). Make it a CSS variable so it's one-line to change.
- **Room abbreviations on mobile**: "Concourse Hall E" → "Con E", "Beer Garden at Peacock Place" → "Beer Garden", etc. Decide abbreviation map before implementing room headers.
- **Post-midnight display**: Day 2/3 grids run to ~1:30 AM. The time axis past midnight should show `12 AM`, `1 AM` — not `0:00`, `60`. Decide label format.
- **Color palette final call**: The "Midnight Convention" palette above is the recommendation. If the user wants to stay closer to AX red/white/black, the swap is: `--accent` → `#c8102e` (AX red), `--going` → `#0057b7` (AX blue), `--bg` → `#0a0a0a`. Everything else stays the same.
