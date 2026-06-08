import { GoingTo } from './storage.js';

const COMPARE_KEY = 'ax26_compare';

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
  } catch {
    return null;
  }
}

export function getCompareSet() {
  try {
    const raw = localStorage.getItem(COMPARE_KEY);
    if (!raw) return null;
    return new Set(JSON.parse(raw));
  } catch {
    return null;
  }
}

let backdrop = null;
let triggerEl = null;

export function openShareModal(fromEl = null) {
  closeShareModal();
  triggerEl = fromEl;

  backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closeShareModal();
  });

  const modal = buildModal();
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

function buildModal() {
  const el = document.createElement('div');
  el.className = 'modal';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Share Schedule');

  const myIds = GoingTo.getAll();
  const hasExport = myIds.size > 0;
  const exportCode = hasExport ? encode(myIds) : '';
  const hasCompare = !!localStorage.getItem(COMPARE_KEY);

  el.innerHTML = `
    <div class="modal-header">
      <div class="modal-title-row">
        <h2 class="modal-title">Share Schedule</h2>
        <button class="modal-close" aria-label="Close">✕</button>
      </div>
    </div>
    <div class="share-modal-body">
      <section class="share-section">
        <h3 class="share-section-title">Your schedule code</h3>
        ${hasExport ? `
          <div class="share-code-row">
            <textarea class="share-code" readonly spellcheck="false" rows="3">${escapeHtml(exportCode)}</textarea>
            <button class="share-copy-btn">Copy</button>
          </div>
          <p class="share-hint">Share this code with a friend so they can compare schedules with you.</p>
        ` : `
          <p class="share-hint">Mark some events as "Going To" to generate a shareable code.</p>
        `}
      </section>

      <section class="share-section">
        <h3 class="share-section-title">Import a schedule</h3>
        <textarea class="share-import-input" placeholder="Paste a schedule code here…" rows="3" spellcheck="false"></textarea>
        <div class="share-import-actions">
          <button class="share-btn-primary" data-action="compare">Compare schedules</button>
          <button class="share-btn-secondary" data-action="replace">Replace my schedule</button>
        </div>
        ${hasCompare ? `
          <p class="share-hint share-hint--active">
            <span class="compare-active-dot"></span>
            Comparison overlay is active
          </p>
        ` : ''}
      </section>

      ${hasCompare ? `
        <section class="share-section share-section--danger">
          <button class="share-btn-danger">Clear comparison</button>
        </section>
      ` : ''}
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
      }).catch(() => {
        el.querySelector('.share-code').select();
      });
    });
  }

  el.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const raw = el.querySelector('.share-import-input').value.trim();
      if (!raw) { showError(el, 'Paste a schedule code first.'); return; }
      const decoded = decode(raw);
      if (!decoded) { showError(el, 'Invalid schedule code — please check and try again.'); return; }

      if (btn.dataset.action === 'compare') {
        localStorage.setItem(COMPARE_KEY, JSON.stringify([...decoded]));
        document.dispatchEvent(new CustomEvent('compare:change'));
        closeShareModal();
      } else {
        const count = myIds.size;
        if (!confirm(`Replace your current schedule (${count} event${count !== 1 ? 's' : ''}) with the imported one (${decoded.size} event${decoded.size !== 1 ? 's' : ''})?`)) return;
        GoingTo.clear();
        for (const id of decoded) GoingTo.add(id);
        document.dispatchEvent(new CustomEvent('goingto:change'));
        closeShareModal();
      }
    });
  });

  const clearBtn = el.querySelector('.share-btn-danger');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      localStorage.removeItem(COMPARE_KEY);
      document.dispatchEvent(new CustomEvent('compare:change'));
      closeShareModal();
    });
  }

  return el;
}

function showError(modal, message) {
  let errEl = modal.querySelector('.share-error');
  if (!errEl) {
    errEl = document.createElement('p');
    errEl.className = 'share-error';
    modal.querySelector('.share-import-actions').insertAdjacentElement('afterend', errEl);
  }
  errEl.textContent = message;
  setTimeout(() => errEl?.remove(), 4000);
}
