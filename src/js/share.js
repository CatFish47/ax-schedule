import { GoingTo } from './storage.js';
import { exportToCalendar } from './my-schedule.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function encode(ids) {
  return btoa(JSON.stringify([...ids]));
}

function decode(str) {
  try {
    const arr = JSON.parse(atob(str.trim()));
    if (!Array.isArray(arr)) return null;
    return new Set(arr.filter(x => typeof x === 'string'));
  } catch { return null; }
}

export function getCompareSet() {
  try {
    const raw = localStorage.getItem('ax26_compare');
    if (!raw) return null;
    return new Set(JSON.parse(raw));
  } catch { return null; }
}

let backdrop = null;
let triggerEl = null;

export function openShareModal(fromEl = null, allEvents = null) {
  closeShareModal();
  triggerEl = fromEl;

  backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeShareModal(); });

  const modal = buildModal(allEvents);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => modal.querySelector('.modal-close')?.focus());

  function onEscape(e) { if (e.key === 'Escape') closeShareModal(); }
  document.addEventListener('keydown', onEscape);
  backdrop._cleanup = () => document.removeEventListener('keydown', onEscape);
}

export function closeShareModal() {
  if (!backdrop) return;
  backdrop._cleanup?.();
  backdrop.remove();
  backdrop = null;
  document.body.style.overflow = '';
  triggerEl?.focus();
  triggerEl = null;
}

function buildModal(allEvents) {
  const el = document.createElement('div');
  el.className = 'modal';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Export / Import');

  const myIds = GoingTo.getAll();
  const exportCode = myIds.size > 0 ? encode(myIds) : '';

  el.innerHTML = `
    <div class="modal-header">
      <div class="modal-title-row">
        <h2 class="modal-title">Export / Import</h2>
        <button class="modal-close" aria-label="Close">✕</button>
      </div>
    </div>
    <div class="share-modal-body">
      <section class="share-section">
        <h3 class="share-section-title">Your schedule code</h3>
        ${exportCode ? `
          <div class="share-code-row">
            <textarea class="share-code" readonly spellcheck="false" rows="3">${escapeHtml(exportCode)}</textarea>
            <button class="share-copy-btn">Copy</button>
          </div>
          <p class="share-hint">Copy code to export schedule to another device.</p>
        ` : `
          <p class="share-hint">Mark some events as "Going To" to generate a code.</p>
        `}
      </section>

      <section class="share-section">
        <h3 class="share-section-title">Replace my schedule</h3>
        <p class="share-hint">Paste a code to overwrite your current "Going To" list.</p>
        <textarea class="share-import-input" placeholder="Paste schedule code here…" rows="3" spellcheck="false"></textarea>
        <div class="share-import-actions">
          <button class="share-btn-secondary" data-action="replace">Replace my schedule</button>
        </div>
        <p class="share-error" hidden></p>
      </section>

      <section class="share-section">
        <h3 class="share-section-title">Export to calendar</h3>
        <p class="share-hint">Download your "Going To" events as a .ics file for Apple Calendar, Google Calendar, or Outlook.</p>
        <div class="share-import-actions">
          <button class="share-btn-secondary" data-action="export-ics"${!myIds.size ? ' disabled' : ''}>↓ Download .ics</button>
        </div>
      </section>
    </div>
  `;

  el.querySelector('.modal-close').addEventListener('click', closeShareModal);

  const copyBtn = el.querySelector('.share-copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(exportCode).then(() => {
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('copied'); }, 2000);
      }).catch(() => el.querySelector('.share-code')?.select());
    });
  }

  const exportIcsBtn = el.querySelector('[data-action="export-ics"]');
  if (exportIcsBtn) {
    exportIcsBtn.addEventListener('click', () => {
      exportToCalendar(allEvents ?? []);
      closeShareModal();
    });
  }

  const errEl = el.querySelector('.share-error');
  el.querySelector('[data-action="replace"]').addEventListener('click', () => {
    const raw = el.querySelector('.share-import-input').value.trim();
    if (!raw) { showErr(errEl, 'Paste a schedule code first.'); return; }
    const decoded = decode(raw);
    if (!decoded) { showErr(errEl, 'Invalid code — check it and try again.'); return; }
    const count = myIds.size;
    if (!confirm(`Replace your current schedule (${count} event${count !== 1 ? 's' : ''}) with the imported one (${decoded.size} event${decoded.size !== 1 ? 's' : ''})?`)) return;
    GoingTo.clear();
    for (const id of decoded) GoingTo.add(id);
    document.dispatchEvent(new CustomEvent('goingto:change'));
    closeShareModal();
  });

  return el;
}

function showErr(el, msg) {
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 4000);
}
