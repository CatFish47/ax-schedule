import { GoingTo } from './storage.js';
import { openModal } from './modal.js';
import { computeOverlaps, formatTime } from './data.js';

const COMPARE_KEY = 'ax26_compare';
const PX_PER_MIN = 1.5;
const MIN_EVENT_HEIGHT = 24;

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

function buildCard(ev, slot, totalSlots, dayStart, cardClass) {
  const card = document.createElement('div');
  card.className = `event-card ${cardClass}`;
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

function buildPersonColumn(events, otherSet, dayStart, dayEnd, ownClass) {
  const col = document.createElement('div');
  col.className = 'compare-col';

  const inner = document.createElement('div');
  inner.className = 'compare-col-inner';
  inner.style.height = `${(dayEnd - dayStart) * PX_PER_MIN}px`;

  const slotMap = computeOverlaps(events);
  for (const ev of events) {
    const { slot, totalSlots } = slotMap[ev.id] || { slot: 0, totalSlots: 1 };
    const cardClass = otherSet.has(ev.id) ? 'event-card--shared' : ownClass;
    inner.appendChild(buildCard(ev, slot, totalSlots, dayStart, cardClass));
  }

  col.appendChild(inner);
  return col;
}

// ── Setup state (no compare schedule loaded) ────────────────────
function renderSetup(container) {
  const goingSet   = GoingTo.getAll();
  const exportCode = goingSet.size > 0 ? encode(goingSet) : '';

  const wrap = document.createElement('div');
  wrap.className = 'compare-setup';

  wrap.innerHTML = `
    <div class="compare-setup-card">
      <h2 class="compare-setup-title">Compare Schedules</h2>

      <section class="compare-setup-section">
        <h3 class="share-section-title">Your schedule code</h3>
        ${exportCode ? `
          <div class="share-code-row">
            <textarea class="share-code" readonly spellcheck="false" rows="3">${escapeHtml(exportCode)}</textarea>
            <button class="share-copy-btn">Copy</button>
          </div>
          <p class="share-hint">Send this to your friend — they paste it in the box below.</p>
        ` : `
          <p class="share-hint">Mark events as "Going To" on the Schedule tab to generate your code.</p>
        `}
      </section>

      <section class="compare-setup-section">
        <h3 class="share-section-title">Paste a friend's code</h3>
        <textarea class="share-import-input" placeholder="Paste schedule code here…" rows="3" spellcheck="false"></textarea>
        <button class="compare-start-btn share-btn-primary">Start comparing</button>
        <p class="share-error" hidden></p>
      </section>
    </div>
  `;

  const copyBtn = wrap.querySelector('.share-copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(exportCode).then(() => {
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('copied'); }, 2000);
      }).catch(() => wrap.querySelector('.share-code')?.select());
    });
  }

  const errEl   = wrap.querySelector('.share-error');
  const startBtn = wrap.querySelector('.compare-start-btn');
  startBtn.addEventListener('click', () => {
    const raw = wrap.querySelector('.share-import-input').value.trim();
    if (!raw) { showErr(errEl, 'Paste a schedule code first.'); return; }
    const decoded = decode(raw);
    if (!decoded) { showErr(errEl, 'Invalid code — check it and try again.'); return; }
    localStorage.setItem(COMPARE_KEY, JSON.stringify([...decoded]));
    document.dispatchEvent(new CustomEvent('compare:change'));
  });

  container.innerHTML = '';
  container.appendChild(wrap);
}

function showErr(el, msg) {
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 4000);
}

// ── Timeline state (compare schedule loaded) ────────────────────
function renderTimeline(container, allEvents, day, compareSet) {
  const goingSet   = GoingTo.getAll();
  const dayEvents  = allEvents.filter(e => e.day === day);
  const myEvents   = dayEvents.filter(e => goingSet.has(e.id));
  const theirEvents= dayEvents.filter(e => compareSet.has(e.id));
  const attended   = dayEvents.filter(e => goingSet.has(e.id) || compareSet.has(e.id));

  container.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'compare-grid';

  // ── Sticky header wrap ──
  const headerWrap = document.createElement('div');
  headerWrap.className = 'compare-header-wrap';

  // Active bar with end button
  const activeBar = document.createElement('div');
  activeBar.className = 'compare-active-bar';

  const legend = document.createElement('div');
  legend.className = 'compare-legend';
  legend.innerHTML = `
    <span class="compare-leg-item"><span class="compare-leg-dot compare-leg-dot--mine"></span>Me</span>
    <span class="compare-leg-item"><span class="compare-leg-dot compare-leg-dot--theirs"></span>Friend</span>
    <span class="compare-leg-item"><span class="compare-leg-dot compare-leg-dot--shared"></span>Both</span>
  `;

  const endBtn = document.createElement('button');
  endBtn.className = 'compare-end-btn';
  endBtn.textContent = '✕ End comparison';
  endBtn.addEventListener('click', () => {
    localStorage.removeItem(COMPARE_KEY);
    document.dispatchEvent(new CustomEvent('compare:change'));
  });

  activeBar.appendChild(legend);
  activeBar.appendChild(endBtn);
  headerWrap.appendChild(activeBar);

  // Column headers
  const header = document.createElement('div');
  header.className = 'compare-header';

  const spacer = document.createElement('div');
  spacer.className = 'grid-header-spacer';
  header.appendChild(spacer);

  function makeColHead(label, cls, count) {
    const h = document.createElement('div');
    h.className = 'compare-col-header';
    h.innerHTML = `
      <span class="compare-col-label ${cls}">${label}</span>
      <span class="compare-col-count">${count} event${count !== 1 ? 's' : ''} today</span>
    `;
    return h;
  }

  header.appendChild(makeColHead('Me',     'compare-col-label--mine',   myEvents.length));
  header.appendChild(makeColHead('Friend', 'compare-col-label--friend', theirEvents.length));
  headerWrap.appendChild(header);
  grid.appendChild(headerWrap);

  // ── Body ──
  if (attended.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<p>Neither schedule has events on this day.</p>';
    grid.appendChild(empty);
    container.appendChild(grid);
    return;
  }

  const { dayStart, dayEnd } = getDayBounds(attended);
  const body = document.createElement('div');
  body.className = 'grid-body';

  body.appendChild(buildTimeAxis(dayStart, dayEnd));
  body.appendChild(buildPersonColumn(myEvents,    compareSet, dayStart, dayEnd, 'event-card--going'));
  body.appendChild(buildPersonColumn(theirEvents, goingSet,   dayStart, dayEnd, 'event-card--compare'));

  grid.appendChild(body);
  container.appendChild(grid);
}

// ── Public API ──────────────────────────────────────────────────
export function render(container, allEvents, day, compareSet) {
  if (!compareSet) {
    renderSetup(container);
  } else {
    renderTimeline(container, allEvents, day, compareSet);
  }
}
