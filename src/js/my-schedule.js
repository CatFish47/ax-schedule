import { GoingTo } from './storage.js';
import { openModal } from './modal.js';

const DAY_LABELS = {
  1: 'Day 1 — July 2',
  2: 'Day 2 — July 3',
  3: 'Day 3 — July 4',
  4: 'Day 4 — July 5',
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function render(container, allEvents) {
  const goingSet = GoingTo.getAll();
  const myEvents = allEvents
    .filter(e => goingSet.has(e.id))
    .sort((a, b) => a.day - b.day || a.start_int - b.start_int);

  container.innerHTML = '';

  if (myEvents.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <p>No events yet — browse the <strong>Schedule</strong> tab and mark ones you're going to.</p>
      </div>
    `;
    return;
  }

  const header = document.createElement('div');
  header.className = 'my-schedule-header';
  header.innerHTML = `<h2>My Schedule <span class="event-count">${myEvents.length} event${myEvents.length !== 1 ? 's' : ''}</span></h2>`;
  container.appendChild(header);

  // Group by day
  const byDay = {};
  for (const ev of myEvents) {
    if (!byDay[ev.day]) byDay[ev.day] = [];
    byDay[ev.day].push(ev);
  }

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

      card.innerHTML = `
        <span class="my-event-dot" aria-hidden="true">●</span>
        <div class="my-event-body">
          <div class="my-event-meta">
            <span class="my-event-time">${ev.start_time} – ${ev.end_time}</span>
            <span class="my-event-room">${escapeHtml(ev.room)}</span>
            ${badges.join('')}
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
