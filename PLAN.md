# AX Schedule Web App — Product Plan

## Overview

A client-side-only web app for browsing, planning, and sharing Anime Expo 2026 schedules. All data is static (pre-processed from CSV); user state is stored in localStorage. No backend server at any phase.

---

## Data Pre-Processing (prerequisite to all phases)

Run once as a build step. Input: `scraped_events.csv`. Output: `events.json`.

### Columns to add

| New column | Type | Description |
|---|---|---|
| `id` | string | Stable hash of `date + room + start_time + title` (e.g. first 8 chars of SHA-1). Used for localStorage keys and export encoding. |
| `start_int` | integer | Start time as minutes from midnight. `10:00 AM` → `600`. For events past midnight, add 1440: `1:30 AM` → `1530`. This preserves sort order within a convention day without splitting across calendar dates. |
| `end_int` | integer | Same encoding for end time. |
| `cleared_before` | boolean | Parsed from description text. `true` if description contains `"This room WILL be cleared prior to this panel"`. |
| `cleared_after` | boolean | `true` if description contains `"This room WILL be cleared for the next panel"`. |
| `is_18_plus` | boolean | `true` if title contains `(18+)`. |

### Notes on cross-midnight events

AX Dance events run until 1:30 AM–2:30 AM. The CSV records these with the date of the evening they *start*, which is the right convention-day grouping. The `start_int`/`end_int` encoding above preserves this — do not use the literal calendar date of the end time to assign day membership.

### Output format

```json
[
  {
    "id": "a3f2c1d4",
    "date": "July 2, 2026",
    "day": 1,
    "start_time": "10:00 AM",
    "end_time": "10:50 AM",
    "start_int": 600,
    "end_int": 650,
    "room": "The Novo",
    "title": "Welcome Ceremony",
    "description": "...",
    "cleared_before": false,
    "cleared_after": false,
    "is_18_plus": false
  }
]
```

`day` is a 1-based integer (1 = July 2, 2, 3, 4 = July 5) for easy day-tab indexing.

---

## Phase 1 — MVP

**Goal:** Load the event data, visualize the schedule with overlap detection, and let users mark events as "going to."

### Features

#### 1. Schedule View (Timeline Grid)

- **Axes:** Time on the Y-axis (scrollable), rooms on the X-axis.
- **Default:** Show one day at a time. Day selector tabs at the top.
- **Overlap rendering:** Events in the same room at overlapping times are rendered side by side within the room column. Events in different rooms that overlap in time are visually aligned by their time position — this is the primary value of the grid over a list.
- **Event card:** Shows title, time range, room, and cleared-before/cleared-after indicators.
- **Room grouping:** Group columns by venue area (e.g. "LACC Panels", "JW Marriott", "Main Stages", "Outdoor/Other") to reduce visual noise from 15+ columns.

#### 2. "Going To" Marking

- Clicking an event card opens a detail modal with full description.
- Modal has a "Going To" toggle button.
- State stored in localStorage under the key `ax26_going_to` as a JSON array of event IDs.
- Cards in the schedule view show a visual indicator (e.g. highlighted border) when marked.

#### 3. My Schedule View

- A separate tab/page listing all events the user has marked "going to."
- Sorted by day, then by `start_int`.
- Shows the same event card format with time, room, title.
- Clicking an event opens the same detail modal with the toggle to unmark it.

### Storage Interface

Abstract localStorage access behind a simple interface so Phase 2/3 can extend it without rewriting call sites:

```js
// storage.js
export const GoingTo = {
  getAll()        // returns Set<eventId>
  add(eventId)
  remove(eventId)
  has(eventId)    // returns boolean
  clear()
}
```

---

## Phase 2 — Views, Filters, and Schedule Sharing

### Features

#### 1. List View / Schedule View Toggle

- Toggle between the timeline grid (Phase 1) and a compact list view.
- List view groups events by day, sorted chronologically, all rooms interleaved.
- List view is better for browsing; schedule view is better for seeing conflicts.

#### 2. Filters

- **By day:** Already handled by day tabs in Phase 1.
- **By time window:** Filter to only show events that are *active* (i.e. start_int falls within) a user-selected time range. Use a range slider or start/end time pickers.
- **By 18+:** Toggle to show or hide 18+ events.
- *(Phase 3 adds location filter)*

#### 3. Export / Import Schedule

- **Export:** Serialize the user's "going to" event ID array → JSON string → base64 encode → display as a copyable string or QR code.
- **Import (own schedule):** Paste a base64 string → decode → replace current localStorage state.
- **Import (compare schedule):** Paste a base64 string → decode → store separately as `ax26_compare` in localStorage. Does not overwrite the user's own schedule.

#### 4. Schedule Comparison View

- A variant of the schedule view (or list view) that overlays two schedules:
  - **Your events** — one color/style
  - **Their events** — another color/style
  - **Shared events** — a third color/style (events both people are attending)
- Useful for coordinating with friends: quickly see where schedules align and where they diverge.
- The compare schedule persists in localStorage until the user clears it or imports a new one.

---

## Phase 3 — Venue Location Context

**Goal:** Help users understand how far apart their consecutive events are, given that walkways can be blocked and entry queues vary.

### Scope clarification

The venues span multiple non-connected buildings:
- **LACC (Los Angeles Convention Center):** Numbered rooms (402A, 403AB, 404AB, 406AB, 408AB, 409AB, 411, 511ABC, 515AB), Concourse Hall E, Petree Hall
- **JW Marriott:** JW Platinum, JW Diamond
- **Main stages:** Peacock Theater, Crypto.com Arena (Main Events)
- **Outdoor/nearby:** Beer Garden at Peacock Place, AX Crossing, The Novo, Lounge 21, AX Dance

"Distance" between two LACC rooms is very different from LACC to Crypto.com Arena. Phase 3 should reflect this reality rather than showing a single continuous floor plan.

### Features

#### 1. Venue Map with Tagged Locations

- A static image (or SVG) of the venue area with room locations marked.
- Each room in `events.json` maps to a coordinate `{x, y}` on the map image.
- Stored as a separate `venue_map.json` config file, not in the event data.

#### 2. Room-to-Room Context in My Schedule

- In "My Schedule" view, between consecutive events, show:
  - The two rooms involved
  - A visual indicator of proximity (same building / adjacent building / separate venue)
  - Time gap between events
  - A warning if the gap is short and the venues are far apart (e.g. < 15 min gap between a LACC room and Crypto.com Arena)

#### 3. Map Highlight View

- Tap any event to highlight its room on the venue map.
- In the comparison view, highlight both events' rooms simultaneously to show the physical relationship.

### Out of scope for Phase 3

- Real-time walking directions
- Live crowd/queue data
- Indoor turn-by-turn routing (blocked walkways change day to day)

The goal is awareness, not navigation — show users *where* their rooms are in relation to each other so they can make their own judgment about whether the gap is realistic.

---

## Technical Notes

### Stack

- **Framework:** Vanilla JS with ES modules — no React, no build step (see `DESIGN.md`)
- **Styling:** CSS custom properties, dark-mode default (see `DESIGN.md` for full palette)
- **Pre-processing script:** Python (`hashlib` + `re` + `csv`)
- **No build server required for production:** The app is a static site (`index.html` + `events.json`)

See [`DESIGN.md`](./DESIGN.md) for color palette, typography, layout specs, component designs, and file structure.

### Event ID stability

The `id` hash is computed from `date + room + start_time + title`. If the source CSV is updated (e.g. a panel time changes), IDs for changed events will shift. This is acceptable for this use case — the user's "going to" list may lose a few events on a data refresh, which is better than silently keeping a stale reference.

### Accessibility notes for schedule grid

A timeline grid with many columns is inherently difficult to navigate by keyboard or screen reader. At minimum: ensure event cards are keyboard-focusable, the modal is focus-trapped, and the list view (Phase 2) is the accessible fallback.

---

## Phase Summary

| Phase | Scope | Key deliverable |
|---|---|---|
| 0 (pre-processing) | Data pipeline | `events.json` with derived columns |
| 1 (MVP) | Core schedule + going-to | Timeline grid, My Schedule, localStorage state |
| 2 | Views + sharing | List view, filters, base64 export/import, comparison view |
| 3 | Venue context | Static venue map, room-distance warnings |
