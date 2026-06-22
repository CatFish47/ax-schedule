import { GoingTo, CustomEvents } from './storage.js';
import { setState } from './store.js';
import { openCustomEventForm } from './custom-event-form.js';

let _venueMap = null;
export function initVenueMap(data) { _venueMap = data; }

function getMapsForRoom(room) {
  if (!_venueMap) return [];
  const ids = _venueMap.rooms?.[room] ?? [];
  return ids.map(id => _venueMap.maps?.[id]).filter(Boolean);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let backdrop = null;
let triggerEl = null;

function formatRange(ev) {
  return `${ev.start_time} – ${ev.end_time}`;
}

function buildModal(ev, going) {
  const el = document.createElement('div');
  el.className = 'modal';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', ev.title);

  const badges = [];
  if (ev.custom)     badges.push('<span class="badge badge-custom">Custom</span>');
  if (ev.is_18_plus) badges.push('<span class="badge badge-18">18+</span>');

  const clearedBefore = ev.cleared_before
    ? `<div class="modal-notice">
        <span class="notice-icon">↑</span>
        Room cleared before this panel
       </div>`
    : '';
  const clearedAfter = ev.cleared_after
    ? `<div class="modal-notice">
        <span class="notice-icon">↓</span>
        Room cleared for the next panel
       </div>`
    : '';

  const roomMaps = getMapsForRoom(ev.room);
  const mapsHtml = roomMaps.length
    ? `<div class="modal-maps">
        <div class="modal-maps-title">Maps</div>
        <div class="modal-maps-links">
          ${roomMaps.map(m =>
            `<a class="map-link" href="${escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(m.label)}</a>`
          ).join('')}
        </div>
       </div>`
    : '';

  el.innerHTML = `
    <div class="modal-header">
      <div class="modal-title-row">
        <span class="modal-badges">${badges.join('')}</span>
        <h2 class="modal-title">${escapeHtml(ev.title)}</h2>
        <button class="modal-close" aria-label="Close">✕</button>
      </div>
      <div class="modal-meta">
        <span>${ev.date}</span>
        <span class="meta-sep">·</span>
        <span>${formatRange(ev)}</span>
      </div>
      <div class="modal-room">Room: ${escapeHtml(ev.room)}</div>
    </div>
    ${clearedBefore || clearedAfter ? `<div class="modal-notices">${clearedBefore}${clearedAfter}</div>` : ''}
    <div class="modal-body">
      <p class="modal-description">${escapeHtml(ev.description)}</p>
    </div>
    ${mapsHtml}
    ${ev.custom ? `
    <div class="modal-footer custom-form-footer">
      <button class="form-btn form-btn--danger" data-action="delete">Delete</button>
      <button class="form-btn form-btn--primary" data-action="edit">Edit</button>
    </div>` : `
    <div class="modal-footer">
      <button class="going-btn ${going ? 'going-active' : ''}" data-id="${ev.id}">
        ${going ? '♥ Going' : '♡ Going To'}
      </button>
    </div>`}
  `;

  // Close button
  el.querySelector('.modal-close').addEventListener('click', closeModal);

  // Custom event Edit / Delete
  if (ev.custom) {
    el.querySelector('[data-action="edit"]').addEventListener('click', () => {
      closeModal();
      openCustomEventForm(ev);
    });
    el.querySelector('[data-action="delete"]').addEventListener('click', () => {
      CustomEvents.remove(ev.id);
      document.dispatchEvent(new CustomEvent('customevent:change'));
      closeModal();
    });
    return el;
  }

  // Going To toggle
  const goingBtn = el.querySelector('.going-btn');
  goingBtn.addEventListener('click', () => {
    const isGoing = GoingTo.has(ev.id);
    if (isGoing) {
      GoingTo.remove(ev.id);
    } else {
      GoingTo.add(ev.id);
    }
    const nowGoing = GoingTo.has(ev.id);
    goingBtn.classList.toggle('going-active', nowGoing);
    goingBtn.textContent = nowGoing ? '♥ Going' : '♡ Going To';
    // Notify rest of app that going-to set changed
    document.dispatchEvent(new CustomEvent('goingto:change', { detail: { id: ev.id } }));
  });

  return el;
}

function trapFocus(modal) {
  const focusable = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  function onKey(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  modal.addEventListener('keydown', onKey);
  return () => modal.removeEventListener('keydown', onKey);
}

export function openModal(ev, fromEl = null) {
  closeModal();
  triggerEl = fromEl;

  backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closeModal();
  });

  const going = GoingTo.has(ev.id);
  const modal = buildModal(ev, going);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // Prevent body scroll on mobile
  document.body.style.overflow = 'hidden';

  // Focus management
  requestAnimationFrame(() => {
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn?.focus();
  });

  const untraptFocus = trapFocus(modal);

  // Escape key
  function onEscape(e) {
    if (e.key === 'Escape') closeModal();
  }
  document.addEventListener('keydown', onEscape);

  backdrop._cleanup = () => {
    untraptFocus();
    document.removeEventListener('keydown', onEscape);
  };

  setState({ modalEvent: ev });
}

export function closeModal() {
  if (!backdrop) return;
  backdrop._cleanup?.();
  backdrop.remove();
  backdrop = null;
  document.body.style.overflow = '';
  triggerEl?.focus();
  triggerEl = null;
  setState({ modalEvent: null });
}
