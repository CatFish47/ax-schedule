import { GoingTo } from './storage.js';
import { openModal } from './modal.js';
import { formatTime, computeOverlaps } from './data.js';

const PX_PER_MIN = 1.5;
const MIN_EVENT_HEIGHT = 24;

const DAY_LABELS = {
  1: 'Day 1 — July 2',
  2: 'Day 2 — July 3',
  3: 'Day 3 — July 4',
  4: 'Day 4 — July 5',
};

// Day 1=Jul 2, day 2=Jul 3, day 3=Jul 4, day 4=Jul 5.
// Post-midnight events (mins >= 1440) spill to the next calendar day.
const DAY_OF_MONTH = { 1: 2, 2: 3, 3: 4, 4: 5 };

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeIcs(str) {
  return String(str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function toIcsDateTime(day, mins) {
  const dom = DAY_OF_MONTH[day] + (mins >= 1440 ? 1 : 0);
  const actual = mins % 1440;
  const h = String(Math.floor(actual / 60)).padStart(2, '0');
  const m = String(actual % 60).padStart(2, '0');
  return `202607${String(dom).padStart(2, '0')}T${h}${m}00`;
}

function buildIcs(events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AX Schedule 2026//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:AX Schedule 2026',
    'X-WR-TIMEZONE:America/Los_Angeles',
  ];
  for (const ev of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:ax26-${ev.id}@ax-schedule`);
    lines.push(`DTSTART;TZID=America/Los_Angeles:${toIcsDateTime(ev.day, ev.start_int)}`);
    lines.push(`DTEND;TZID=America/Los_Angeles:${toIcsDateTime(ev.day, ev.end_int)}`);
    lines.push(`SUMMARY:${escapeIcs(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeIcs(ev.description)}`);
    lines.push(`LOCATION:${escapeIcs(ev.room)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function exportToCalendar(allEvents) {
  const goingSet = GoingTo.getAll();
  const events = allEvents.filter(e => goingSet.has(e.id));
  if (events.length === 0) return;
  const ics = buildIcs(events);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ax-schedule-2026.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Single-column timeline (grid mode) ──────────────────────────

function buildTimeAxis(dayStart, dayEnd) {
  const col = document.createElement('div');
  col.className = 'grid-time-axis';
  col.style.height = `${(dayEnd - dayStart) * PX_PER_MIN}px`;
  for (let t = dayStart; t <= dayEnd; t += 30) {
    const tick = document.createElement('div');
    tick.className = 'time-tick' + (t % 60 === 0 ? ' time-tick-hour' : ' time-tick-half');
    tick.style.top = `${(t - dayStart) * PX_PER_MIN}px`;
    if (t % 60 === 0) tick.textContent = formatTime(t);
    col.appendChild(tick);
  }
  return col;
}

function buildTimelineCard(ev, dayStart, slot, totalSlots) {
  const card = document.createElement('div');
  card.className = 'event-card event-card--going';
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${ev.title}, ${ev.start_time} to ${ev.end_time}, ${ev.room}`);
  card.dataset.id = ev.id;

  const top    = (ev.start_int - dayStart) * PX_PER_MIN;
  const height = Math.max((ev.end_int - ev.start_int) * PX_PER_MIN, MIN_EVENT_HEIGHT);
  const wPct   = 100 / totalSlots;
  const lPct   = slot * wPct;
  card.style.cssText = `top:${top}px;height:${height}px;width:calc(${wPct}% - 2px);left:calc(${lPct}% + 1px);`;

  const badges = [];
  if (ev.is_18_plus)     badges.push('<span class="badge badge-18">18+</span>');
  if (ev.cleared_before) badges.push('<span class="badge badge-clear" title="Room cleared before">↑</span>');
  if (ev.cleared_after)  badges.push('<span class="badge badge-clear" title="Room cleared after">↓</span>');

  card.innerHTML = `
    ${badges.length ? `<div class="card-badges">${badges.join('')}</div>` : ''}
    <div class="card-title">${escapeHtml(ev.title)}</div>
    <div class="card-time">${ev.start_time}–${ev.end_time} · ${escapeHtml(ev.room)}</div>
  `;

  function open() { openModal(ev, card); }
  card.addEventListener('click', open);
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });
  return card;
}

function renderGridView(container, dayEvents) {
  const dayStart = Math.floor(Math.min(...dayEvents.map(e => e.start_int)) / 30) * 30;
  const dayEnd   = Math.ceil(Math.max(...dayEvents.map(e => e.end_int))   / 30) * 30;

  container.innerHTML = '';

  const timeline = document.createElement('div');
  timeline.className = 'my-schedule-timeline';

  const body = document.createElement('div');
  body.className = 'my-schedule-timeline-body';
  body.appendChild(buildTimeAxis(dayStart, dayEnd));

  const col = document.createElement('div');
  col.className = 'my-schedule-timeline-col';

  const inner = document.createElement('div');
  inner.className = 'my-schedule-timeline-inner';
  inner.style.height = `${(dayEnd - dayStart) * PX_PER_MIN}px`;

  const slotMap = computeOverlaps(dayEvents);
  for (const ev of dayEvents) {
    const { slot, totalSlots } = slotMap[ev.id] || { slot: 0, totalSlots: 1 };
    inner.appendChild(buildTimelineCard(ev, dayStart, slot, totalSlots));
  }

  col.appendChild(inner);
  body.appendChild(col);
  timeline.appendChild(body);
  container.appendChild(timeline);
}

// ── List view ───────────────────────────────────────────────────

function renderListView(container, myEvents) {
  const byDay = {};
  for (const ev of myEvents) {
    if (!byDay[ev.day]) byDay[ev.day] = [];
    byDay[ev.day].push(ev);
  }
  const dayCount = Object.keys(byDay).length;

  const header = document.createElement('div');
  header.className = 'my-schedule-header';
  header.innerHTML = `
    <h2>My Schedule
      <span class="event-count">
        ${myEvents.length} event${myEvents.length !== 1 ? 's' : ''}
        across ${dayCount} day${dayCount !== 1 ? 's' : ''}
      </span>
    </h2>
  `;
  container.appendChild(header);

  for (const day of Object.keys(byDay).sort()) {
    const dayEvents = byDay[day];
    const section = document.createElement('div');
    section.className = 'my-schedule-day';

    const dayHeader = document.createElement('div');
    dayHeader.className = 'my-schedule-day-header';
    dayHeader.textContent = DAY_LABELS[day] ?? `Day ${day}`;
    section.appendChild(dayHeader);

    const list = document.createElement('div');
    list.className = 'my-schedule-list';

    for (const ev of dayEvents) {
      const card = document.createElement('div');
      card.className = 'my-event-card';
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `${ev.title}, ${ev.start_time} to ${ev.end_time}, ${ev.room}`);
      card.dataset.id = ev.id;

      const badges = [];
      if (ev.is_18_plus) badges.push('<span class="badge badge-18">18+</span>');
      if (ev.cleared_before) badges.push('<span class="badge badge-clear" title="Room cleared before this panel">↑ cleared</span>');
      if (ev.cleared_after) badges.push('<span class="badge badge-clear" title="Room cleared for next panel">↓ cleared</span>');

      card.innerHTML = `
        <span class="my-event-dot" aria-hidden="true">●</span>
        <div class="my-event-body">
          <div class="my-event-meta">
            <span class="my-event-time">${ev.start_time} – ${ev.end_time}</span>
            <span class="my-event-room">${escapeHtml(ev.room)}</span>
            ${badges.length ? `<span class="my-event-badges">${badges.join('')}</span>` : ''}
          </div>
          <div class="my-event-title">${escapeHtml(ev.title)}</div>
        </div>
      `;

      function open(e) { openModal(ev, e.currentTarget); }
      card.addEventListener('click', open);
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); }
      });

      list.appendChild(card);
    }

    section.appendChild(list);
    container.appendChild(section);
  }
}

// ── Public render ───────────────────────────────────────────────

export function render(container, allEvents, day, mode) {
  const goingSet = GoingTo.getAll();
  const myEvents = allEvents
    .filter(e => goingSet.has(e.id))
    .sort((a, b) => a.day - b.day || a.start_int - b.start_int);

  if (myEvents.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <p>No events yet — browse the <strong>Schedule</strong> tab and mark ones you're going to.</p>
      </div>
    `;
    return;
  }

  if (mode === 'grid') {
    const dayEvents = myEvents.filter(e => e.day === day);
    if (dayEvents.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No events on this day — try another day or switch to List.</p>
        </div>
      `;
      return;
    }
    renderGridView(container, dayEvents);
    return;
  }

  container.innerHTML = '';
  renderListView(container, myEvents);
}
