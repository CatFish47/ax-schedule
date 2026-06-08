import { GoingTo } from './storage.js';
import { openModal } from './modal.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCard(ev, going) {
  const card = document.createElement('div');
  card.className = 'list-event-card' + (going ? ' list-card--mine' : '');
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${ev.title}, ${ev.start_time} to ${ev.end_time}, ${ev.room}`);
  card.dataset.id = ev.id;

  const badges = [];
  if (ev.is_18_plus)     badges.push('<span class="badge badge-18">18+</span>');
  if (ev.cleared_before) badges.push('<span class="badge badge-clear" title="Room cleared before">↑ cleared</span>');
  if (ev.cleared_after)  badges.push('<span class="badge badge-clear" title="Room cleared after">↓ cleared</span>');

  card.innerHTML = `
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

export function render(container, events) {
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
    listEl.appendChild(buildCard(ev, goingSet.has(ev.id)));
  }
  container.appendChild(listEl);
}

export function updateGoingState(container) {
  const goingSet = GoingTo.getAll();
  container.querySelectorAll('.list-event-card').forEach(card => {
    card.classList.toggle('list-card--mine', goingSet.has(card.dataset.id));
  });
}
