import { CustomEvents } from './storage.js';
import { formatTime } from './data.js';

const DAYS = [
  { day: 1, label: 'Day 1 — Jul 2', date: 'July 2, 2026' },
  { day: 2, label: 'Day 2 — Jul 3', date: 'July 3, 2026' },
  { day: 3, label: 'Day 3 — Jul 4', date: 'July 4, 2026' },
  { day: 4, label: 'Day 4 — Jul 5', date: 'July 5, 2026' },
];

const TIME_OPTIONS = [];
for (let m = 480; m <= 1590; m += 30) TIME_OPTIONS.push(m);

let backdrop = null;

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function closeForm() {
  if (!backdrop) return;
  backdrop._cleanup?.();
  backdrop.remove();
  backdrop = null;
  document.body.style.overflow = '';
}

export function openCustomEventForm(ev = null) {
  closeForm();

  const isEdit = ev !== null;
  const defaultDay   = ev?.day       ?? 1;
  const defaultStart = ev?.start_int ?? 600;
  const defaultEnd   = ev?.end_int   ?? 660;

  backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeForm(); });

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', isEdit ? 'Edit custom event' : 'Add custom event');

  const timeOpts = TIME_OPTIONS.map(m =>
    `<option value="${m}">${formatTime(m)}</option>`
  ).join('');

  const dayOpts = DAYS.map(d =>
    `<option value="${d.day}" ${d.day === defaultDay ? 'selected' : ''}>${d.label}</option>`
  ).join('');

  modal.innerHTML = `
    <div class="modal-header">
      <div class="modal-title-row">
        <h2 class="modal-title">${isEdit ? 'Edit Event' : 'Add Custom Event'}</h2>
        <button class="modal-close" aria-label="Close">✕</button>
      </div>
    </div>
    <div class="modal-body">
      <div class="custom-event-form">
        <div class="form-field">
          <label class="form-label" for="cef-title">Title <span class="form-required">*</span></label>
          <input class="form-input" id="cef-title" type="text" placeholder="Event title" maxlength="200" value="${escapeHtml(ev?.title ?? '')}">
        </div>
        <div class="form-field">
          <label class="form-label" for="cef-day">Day <span class="form-required">*</span></label>
          <select class="form-select" id="cef-day">${dayOpts}</select>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label class="form-label" for="cef-start">Start <span class="form-required">*</span></label>
            <select class="form-select" id="cef-start">
              ${TIME_OPTIONS.map(m => `<option value="${m}" ${m === defaultStart ? 'selected' : ''}>${formatTime(m)}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label class="form-label" for="cef-end">End <span class="form-required">*</span></label>
            <select class="form-select" id="cef-end">
              ${TIME_OPTIONS.map(m => `<option value="${m}" ${m === defaultEnd ? 'selected' : ''}>${formatTime(m)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-field">
          <label class="form-label" for="cef-room">Location</label>
          <input class="form-input" id="cef-room" type="text" placeholder="e.g. Main Lobby" maxlength="100" value="${escapeHtml(ev?.room ?? '')}">
        </div>
        <div class="form-field">
          <label class="form-label" for="cef-desc">Notes</label>
          <textarea class="form-textarea" id="cef-desc" rows="3" placeholder="Optional notes">${escapeHtml(ev?.description ?? '')}</textarea>
        </div>
        <div class="form-error" id="cef-error" hidden></div>
      </div>
    </div>
    <div class="modal-footer custom-form-footer">
      ${isEdit ? '<button class="form-btn form-btn--danger" id="cef-delete">Delete</button>' : ''}
      <button class="form-btn" id="cef-cancel">Cancel</button>
      <button class="form-btn form-btn--primary" id="cef-save">${isEdit ? 'Save Changes' : 'Add Event'}</button>
    </div>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => modal.querySelector('#cef-title')?.focus());

  modal.querySelector('.modal-close').addEventListener('click', closeForm);
  modal.querySelector('#cef-cancel').addEventListener('click', closeForm);

  if (isEdit) {
    modal.querySelector('#cef-delete').addEventListener('click', () => {
      CustomEvents.remove(ev.id);
      document.dispatchEvent(new CustomEvent('customevent:change'));
      closeForm();
    });
  }

  modal.querySelector('#cef-save').addEventListener('click', () => {
    const title    = modal.querySelector('#cef-title').value.trim();
    const day      = Number(modal.querySelector('#cef-day').value);
    const startInt = Number(modal.querySelector('#cef-start').value);
    const endInt   = Number(modal.querySelector('#cef-end').value);
    const room     = modal.querySelector('#cef-room').value.trim() || 'Custom';
    const description = modal.querySelector('#cef-desc').value.trim();

    const errorEl = modal.querySelector('#cef-error');
    if (!title) {
      errorEl.textContent = 'Title is required.';
      errorEl.hidden = false;
      modal.querySelector('#cef-title').focus();
      return;
    }
    if (endInt <= startInt) {
      errorEl.textContent = 'End time must be after start time.';
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;

    const dayInfo = DAYS.find(d => d.day === day);
    const newEv = {
      id: isEdit ? ev.id : `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      custom: true,
      title,
      day,
      date: dayInfo.date,
      start_int: startInt,
      end_int: endInt,
      start_time: formatTime(startInt),
      end_time: formatTime(endInt),
      room,
      description,
      is_18_plus: false,
      cleared_before: false,
      cleared_after: false,
    };

    if (isEdit) {
      CustomEvents.update(newEv);
    } else {
      CustomEvents.add(newEv);
    }

    document.dispatchEvent(new CustomEvent('customevent:change'));
    closeForm();
  });

  function onEscape(e) { if (e.key === 'Escape') closeForm(); }
  document.addEventListener('keydown', onEscape);
  backdrop._cleanup = () => document.removeEventListener('keydown', onEscape);
}
