import { GoingTo } from './storage.js';
import { openModal } from './modal.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCard(ev, goingSet, compareSet) {
  const mine = goingSet.has(ev.id);
  const theirs = compareSet?.has(ev.id) ?? false;

  const card = document.createElement('div');
  card.className = 'list-event-card';
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${ev.title}, ${ev.start_time} to ${ev.end_time}, ${ev.room}`);
  card.dataset.id = ev.id;

  if (compareSet) {
    if (mine && theirs) card.classList.add('list-card--shared');
    else if (mine)      card.classList.add('list-card--mine');
    else if (theirs)    card.classList.add('list-card--theirs');
  } else if (mine) {
    card.classList.add('list-card--mine');
  }

  const badges = [];
  if (ev.is_18_plus) badges.push('<span class="badge badge-18">18+</span>');
  if (ev.cleared_before) badges.push('<span class="badge badge-clear" title="Room cleared before">↑ cleared</span>');
  if (ev.cleared_after)  badges.push('<span class="badge badge-clear" title="Room cleared after">↓ cleared</span>');

  let sideHtml = '';
  if (compareSet) {
    let indicator = '<span class="list-indicator" aria-hidden="true"></span>';
    if (mine && theirs) indicator = '<span class="list-indicator list-indicator--shared" aria-hidden="true">⬥</span>';
    else if (mine)      indicator = '<span class="list-indicator list-indicator--mine" aria-hidden="true">♥</span>';
    else if (theirs)    indicator = '<span class="list-indicator list-indicator--theirs" aria-hidden="true">♦</span>';
    sideHtml = `<div class="list-card-side">${indicator}</div>`;
  }

  card.innerHTML = `
    ${sideHtml}
    <div class="list-card-body">
      <div class="list-card-meta">
        <span class="list-card-time">${ev.start_time} – ${ev.end_time}</span>
        <span class="list-card-room">${escapeHtml(ev.room)}</span>
        ${badges.length ? `<span class="list-card-badges">${badges.join('')}</span>` : ''}
      </div>
      <div class="list-card-title">${escapeHtml(ev.title)}</div>
    </div>
  `;

  function open(e) { openModal(ev, e.currentTarget); }
  card.addEventListener('click', open);
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); }
  });

  return card;
}

// events: already sorted/filtered for the current day
export function render(container, events, compareSet = null) {
  container.innerHTML = '';

  if (events.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🗓</div>
        <p>No events match the current filters.</p>
      </div>
    `;
    return;
  }

  const goingSet = GoingTo.getAll();
  const sorted = [...events].sort((a, b) => a.start_int - b.start_int);

  const listEl = document.createElement('div');
  listEl.className = 'list-view';

  for (const ev of sorted) {
    listEl.appendChild(buildCard(ev, goingSet, compareSet));
  }

  container.appendChild(listEl);
}

export function updateGoingState(container, compareSet = null) {
  const goingSet = GoingTo.getAll();
  container.querySelectorAll('.list-event-card').forEach(card => {
    const mine = goingSet.has(card.dataset.id);
    const theirs = compareSet?.has(card.dataset.id) ?? false;
    card.classList.toggle('list-card--mine',   compareSet ? (mine && !theirs) : mine);
    card.classList.toggle('list-card--theirs', !!compareSet && theirs && !mine);
    card.classList.toggle('list-card--shared', !!compareSet && mine && theirs);
  });
}
