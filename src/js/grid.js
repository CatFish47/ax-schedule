import { getEventsForDay, getActiveRoomGroups, computeOverlaps, ROOM_ABBREV, formatTime } from './data.js';
import { GoingTo } from './storage.js';
import { openModal } from './modal.js';

const PX_PER_MIN = 1.5;
const ROOM_COL_W = 120;  // must match --room-col-w in CSS
const MIN_EVENT_HEIGHT = 24;

function getDayBounds(events) {
  const starts = events.map(e => e.start_int);
  const rawMin = Math.min(...starts);
  // Round down to nearest 30
  const dayStart = Math.floor(rawMin / 30) * 30;
  const ends = events.map(e => e.end_int);
  const rawMax = Math.max(...ends);
  const dayEnd = Math.ceil(rawMax / 30) * 30;
  return { dayStart, dayEnd };
}

function buildTimeAxis(dayStart, dayEnd) {
  const col = document.createElement('div');
  col.className = 'grid-time-axis';

  const totalMin = dayEnd - dayStart;
  col.style.height = `${totalMin * PX_PER_MIN}px`;

  for (let t = dayStart; t <= dayEnd; t += 30) {
    const tick = document.createElement('div');
    tick.className = 'time-tick' + (t % 60 === 0 ? ' time-tick-hour' : ' time-tick-half');
    tick.style.top = `${(t - dayStart) * PX_PER_MIN}px`;
    if (t % 60 === 0) {
      tick.textContent = formatTime(t);
    }
    col.appendChild(tick);
  }
  return col;
}

function buildEventCard(ev, slot, totalSlots, dayStart, going) {
  const card = document.createElement('div');
  card.className = 'event-card' + (going ? ' event-card--going' : '');
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${ev.title}, ${ev.start_time} to ${ev.end_time}`);
  card.dataset.id = ev.id;

  const top = (ev.start_int - dayStart) * PX_PER_MIN;
  const height = Math.max((ev.end_int - ev.start_int) * PX_PER_MIN, MIN_EVENT_HEIGHT);
  const widthPct = 100 / totalSlots;
  const leftPct = slot * widthPct;

  card.style.cssText = `
    top: ${top}px;
    height: ${height}px;
    width: calc(${widthPct}% - 2px);
    left: calc(${leftPct}% + 1px);
  `;

  const badges = [];
  if (ev.is_18_plus) badges.push('<span class="badge badge-18">18+</span>');
  if (ev.cleared_before) badges.push('<span class="badge badge-clear" title="Room cleared before">↑</span>');
  if (ev.cleared_after) badges.push('<span class="badge badge-clear" title="Room cleared after">↓</span>');

  card.innerHTML = `
    ${badges.length ? `<div class="card-badges">${badges.join('')}</div>` : ''}
    <div class="card-title">${escapeHtml(ev.title)}</div>
    <div class="card-time">${ev.start_time}–${ev.end_time}</div>
  `;

  function open() { openModal(ev, card); }
  card.addEventListener('click', open);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });

  return card;
}

function buildRoomColumn(room, events, dayStart, dayEnd, goingSet) {
  const col = document.createElement('div');
  col.className = 'room-col';
  col.dataset.room = room;

  const inner = document.createElement('div');
  inner.className = 'room-col-inner';
  inner.style.height = `${(dayEnd - dayStart) * PX_PER_MIN}px`;

  const slotMap = computeOverlaps(events);

  for (const ev of events) {
    const { slot, totalSlots } = slotMap[ev.id] || { slot: 0, totalSlots: 1 };
    const card = buildEventCard(ev, slot, totalSlots, dayStart, goingSet.has(ev.id));
    inner.appendChild(card);
  }

  col.appendChild(inner);
  return col;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let _container = null;
let _unsubGoingTo = null;
let _currentEvents = null;
let _currentDay = null;

function rerender() {
  if (!_container || !_currentEvents || !_currentDay) return;
  render(_container, _currentEvents, _currentDay);
}

export function render(container, allEvents, day) {
  _container = container;
  _currentEvents = allEvents;
  _currentDay = day;

  const events = getEventsForDay(allEvents, day);
  const goingSet = GoingTo.getAll();

  if (events.length === 0) {
    container.innerHTML = '<div class="empty-state">No events scheduled for this day.</div>';
    return;
  }

  const { dayStart, dayEnd } = getDayBounds(events);
  const roomGroups = getActiveRoomGroups(events);

  // Map room → events
  const byRoom = {};
  for (const ev of events) {
    if (!byRoom[ev.room]) byRoom[ev.room] = [];
    byRoom[ev.room].push(ev);
  }

  // Build the grid
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'timeline-grid';

  // ── Header rows (wrapped in a single sticky container) ──
  const headerWrap = document.createElement('div');
  headerWrap.className = 'grid-header-wrap';

  // Row 1: group labels
  const headerArea = document.createElement('div');
  headerArea.className = 'grid-header';

  const axisSpacer = document.createElement('div');
  axisSpacer.className = 'grid-header-spacer';
  headerArea.appendChild(axisSpacer);

  for (const group of roomGroups) {
    const groupHeader = document.createElement('div');
    groupHeader.className = 'group-header';
    // Explicit pixel width so flex knows how wide to make it
    groupHeader.style.width = `${group.rooms.length * ROOM_COL_W}px`;
    groupHeader.textContent = group.label;
    headerArea.appendChild(groupHeader);
  }

  // Row 2: individual room names
  const roomHeaderRow = document.createElement('div');
  roomHeaderRow.className = 'room-header-row';

  const axisSpacer2 = document.createElement('div');
  axisSpacer2.className = 'grid-header-spacer';
  roomHeaderRow.appendChild(axisSpacer2);

  for (const group of roomGroups) {
    for (const room of group.rooms) {
      const rh = document.createElement('div');
      rh.className = 'room-header';
      rh.textContent = ROOM_ABBREV[room] ?? room;
      rh.title = room;
      roomHeaderRow.appendChild(rh);
    }
  }

  headerWrap.appendChild(headerArea);
  headerWrap.appendChild(roomHeaderRow);
  grid.appendChild(headerWrap);

  // ── Body (time axis + room columns) ──
  const body = document.createElement('div');
  body.className = 'grid-body';

  const timeAxis = buildTimeAxis(dayStart, dayEnd);
  body.appendChild(timeAxis);

  for (const group of roomGroups) {
    const groupCol = document.createElement('div');
    groupCol.className = 'group-col';

    for (const room of group.rooms) {
      const roomEvents = byRoom[room] || [];
      const col = buildRoomColumn(room, roomEvents, dayStart, dayEnd, goingSet);
      groupCol.appendChild(col);
    }

    body.appendChild(groupCol);
  }

  grid.appendChild(body);
  container.appendChild(grid);
}

export function updateGoingState(container) {
  const goingSet = GoingTo.getAll();
  container.querySelectorAll('.event-card').forEach(card => {
    const going = goingSet.has(card.dataset.id);
    card.classList.toggle('event-card--going', going);
  });
}

export function destroy() {
  _unsubGoingTo?.();
  _container = null;
  _currentEvents = null;
  _currentDay = null;
}
