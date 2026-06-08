import { getActiveRoomGroups, computeOverlaps, ROOM_ABBREV, formatTime } from './data.js';
import { GoingTo } from './storage.js';
import { openModal } from './modal.js';

const PX_PER_MIN = 1.5;
const ROOM_COL_W = 120;  // must match --room-col-w in CSS
const MIN_EVENT_HEIGHT = 24;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getDayBounds(events) {
  const dayStart = Math.floor(Math.min(...events.map(e => e.start_int)) / 30) * 30;
  const dayEnd   = Math.ceil(Math.max(...events.map(e => e.end_int))   / 30) * 30;
  return { dayStart, dayEnd };
}

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

function buildEventCard(ev, slot, totalSlots, dayStart, going) {
  const card = document.createElement('div');
  card.className = 'event-card' + (going ? ' event-card--going' : '');
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${ev.title}, ${ev.start_time} to ${ev.end_time}`);
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
    inner.appendChild(buildEventCard(ev, slot, totalSlots, dayStart, goingSet.has(ev.id)));
  }

  col.appendChild(inner);
  return col;
}

export function render(container, events) {
  const goingSet = GoingTo.getAll();

  if (events.length === 0) {
    container.innerHTML = '<div class="empty-state">No events match the current filters.</div>';
    return;
  }

  const { dayStart, dayEnd } = getDayBounds(events);
  const roomGroups = getActiveRoomGroups(events);

  const byRoom = {};
  for (const ev of events) {
    if (!byRoom[ev.room]) byRoom[ev.room] = [];
    byRoom[ev.room].push(ev);
  }

  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'timeline-grid';

  // ── Sticky header ──
  const headerWrap = document.createElement('div');
  headerWrap.className = 'grid-header-wrap';

  const headerArea = document.createElement('div');
  headerArea.className = 'grid-header';
  headerArea.appendChild(Object.assign(document.createElement('div'), { className: 'grid-header-spacer' }));
  for (const group of roomGroups) {
    const g = document.createElement('div');
    g.className = 'group-header';
    g.style.width = `${group.rooms.length * ROOM_COL_W}px`;
    g.textContent = group.label;
    headerArea.appendChild(g);
  }

  const roomHeaderRow = document.createElement('div');
  roomHeaderRow.className = 'room-header-row';
  roomHeaderRow.appendChild(Object.assign(document.createElement('div'), { className: 'grid-header-spacer' }));
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

  // ── Body ──
  const body = document.createElement('div');
  body.className = 'grid-body';
  body.appendChild(buildTimeAxis(dayStart, dayEnd));

  for (const group of roomGroups) {
    const groupCol = document.createElement('div');
    groupCol.className = 'group-col';
    for (const room of group.rooms) {
      groupCol.appendChild(buildRoomColumn(room, byRoom[room] || [], dayStart, dayEnd, goingSet));
    }
    body.appendChild(groupCol);
  }

  grid.appendChild(body);
  container.appendChild(grid);
}

export function updateGoingState(container) {
  const goingSet = GoingTo.getAll();
  container.querySelectorAll('.event-card').forEach(card => {
    card.classList.toggle('event-card--going', goingSet.has(card.dataset.id));
  });
}
