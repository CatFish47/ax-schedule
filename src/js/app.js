import { getState, setState, subscribe } from './store.js';
import { getEvents, getEventsForDay, applyFilters, getVenueMap, invalidateCache } from './data.js';
import { openCustomEventForm } from './custom-event-form.js';
import { render as renderGrid, updateGoingState as updateGridGoing } from './grid.js';
import { render as renderList, updateGoingState as updateListGoing } from './list.js';
import { render as renderMySchedule } from './my-schedule.js';
import { render as renderCompare } from './compare.js';
import { openShareModal, getCompareSet } from './share.js';
import { initVenueMap } from './modal.js';

const DAYS = [
  { day: 1, label: 'Jul 2' },
  { day: 2, label: 'Jul 3' },
  { day: 3, label: 'Jul 4' },
  { day: 4, label: 'Jul 5' },
];

// 8 AM (480) to 2:30 AM next day (1590) in 30-min steps
const TIME_OPTIONS = [];
for (let m = 480; m <= 1590; m += 30) TIME_OPTIONS.push(m);

function fmtTimeOpt(minutes) {
  const m = minutes % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  const period = h < 12 ? 'AM' : 'PM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return min === 0
    ? `${displayH} ${period}`
    : `${displayH}:${String(min).padStart(2, '0')} ${period}`;
}

function addTablistKeyNav(container, itemSelector) {
  container.addEventListener('keydown', e => {
    const items = [...container.querySelectorAll(itemSelector)];
    const idx = items.findIndex(el => el === document.activeElement);
    if (idx === -1) return;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % items.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next !== -1) { e.preventDefault(); items[next].focus(); items[next].click(); }
  });
}

async function init() {
  let allEvents;
  try {
    const [events, venueMap] = await Promise.all([getEvents(), getVenueMap()]);
    allEvents = events;
    initVenueMap(venueMap);
  } catch (err) {
    document.getElementById('app-main').innerHTML =
      `<div class="error-state">Failed to load schedule data. Please refresh.</div>`;
    console.error(err);
    return;
  }

  const daySelector         = document.getElementById('day-selector');
  const navTabs             = document.getElementById('nav-tabs');
  const toolbar             = document.getElementById('schedule-toolbar');
  const myScheduleToolbar   = document.getElementById('my-schedule-toolbar');
  const mainContent         = document.getElementById('app-main');

  let compareSet = getCompareSet();

  // ── Day selector pills ──────────────────────────────────────────
  for (const { day, label } of DAYS) {
    const btn = document.createElement('button');
    btn.className = 'day-pill';
    btn.dataset.day = day;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', 'false');
    btn.tabIndex = -1;
    btn.textContent = label;
    btn.addEventListener('click', () => setState({ day }));
    daySelector.appendChild(btn);
  }

  // ── Nav tabs + right-side action buttons ──────────────────────
  const views = [
    { view: 'schedule',    label: 'Schedule' },
    { view: 'my-schedule', label: 'My Schedule' },
    { view: 'compare',     label: 'Compare' },
  ];
  for (const { view, label } of views) {
    const btn = document.createElement('button');
    btn.className = 'nav-tab';
    btn.dataset.view = view;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', 'false');
    btn.tabIndex = -1;
    btn.textContent = label;
    btn.addEventListener('click', () => setState({ view }));
    navTabs.appendChild(btn);
  }

  const overflowWrap = document.createElement('div');
  overflowWrap.className = 'nav-overflow-wrap';

  const overflowBtn = document.createElement('button');
  overflowBtn.className = 'nav-overflow-btn';
  overflowBtn.setAttribute('aria-label', 'More options');
  overflowBtn.setAttribute('aria-expanded', 'false');
  overflowBtn.textContent = '⋯';

  const overflowMenu = document.createElement('div');
  overflowMenu.className = 'nav-overflow-menu';
  overflowMenu.hidden = true;

  const menuFeedback = document.createElement('a');
  menuFeedback.className = 'nav-overflow-item';
  menuFeedback.href = 'https://forms.gle/B8PqCum5bTtdDCNK7';
  menuFeedback.target = '_blank';
  menuFeedback.rel = 'noopener noreferrer';
  menuFeedback.textContent = 'Feedback ↗';
  overflowMenu.appendChild(menuFeedback);

  const menuExport = document.createElement('button');
  menuExport.className = 'nav-overflow-item';
  menuExport.textContent = 'Export / Import';
  menuExport.addEventListener('click', () => {
    overflowMenu.hidden = true;
    overflowBtn.setAttribute('aria-expanded', 'false');
    openShareModal(overflowBtn, allEvents);
  });
  overflowMenu.appendChild(menuExport);

  overflowBtn.addEventListener('click', e => {
    e.stopPropagation();
    const open = !overflowMenu.hidden;
    overflowMenu.hidden = open;
    overflowBtn.setAttribute('aria-expanded', String(!open));
  });

  document.addEventListener('click', () => {
    if (!overflowMenu.hidden) {
      overflowMenu.hidden = true;
      overflowBtn.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overflowMenu.hidden) {
      overflowMenu.hidden = true;
      overflowBtn.setAttribute('aria-expanded', 'false');
      overflowBtn.focus();
    }
  });

  overflowWrap.appendChild(overflowBtn);
  overflowWrap.appendChild(overflowMenu);
  navTabs.appendChild(overflowWrap);

  // ── Schedule toolbar ────────────────────────────────────────────
  const modeToggle = document.createElement('div');
  modeToggle.className = 'mode-toggle';
  modeToggle.setAttribute('role', 'group');
  modeToggle.setAttribute('aria-label', 'View mode');

  const gridBtn = document.createElement('button');
  gridBtn.className = 'mode-btn mode-btn--active';
  gridBtn.setAttribute('aria-pressed', 'true');
  gridBtn.innerHTML = '▦ Grid';

  const listBtn = document.createElement('button');
  listBtn.className = 'mode-btn';
  listBtn.setAttribute('aria-pressed', 'false');
  listBtn.innerHTML = '≡ List';

  gridBtn.addEventListener('click', () => setState({ scheduleMode: 'grid' }));
  listBtn.addEventListener('click', () => setState({ scheduleMode: 'list' }));
  modeToggle.appendChild(gridBtn);
  modeToggle.appendChild(listBtn);

  const sep = document.createElement('div');
  sep.className = 'toolbar-sep';

  const filtersEl = document.createElement('div');
  filtersEl.className = 'toolbar-filters';

  const adultToggle = document.createElement('button');
  adultToggle.className = 'filter-toggle filter-toggle--active';
  adultToggle.setAttribute('aria-pressed', 'true');
  adultToggle.textContent = '18+';
  adultToggle.title = 'Show/hide 18+ events';
  adultToggle.addEventListener('click', () => {
    const { filters } = getState();
    setState({ filters: { ...filters, show18Plus: !filters.show18Plus } });
  });

  const fromLabel = document.createElement('label');
  fromLabel.className = 'filter-label';
  fromLabel.textContent = 'From';
  const fromSelect = document.createElement('select');
  fromSelect.className = 'filter-select';
  fromSelect.setAttribute('aria-label', 'Start time filter');
  fromSelect.innerHTML = '<option value="">Any</option>';
  for (const m of TIME_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = fmtTimeOpt(m);
    fromSelect.appendChild(opt);
  }

  const toLabel = document.createElement('label');
  toLabel.className = 'filter-label';
  toLabel.textContent = 'To';
  const toSelect = document.createElement('select');
  toSelect.className = 'filter-select';
  toSelect.setAttribute('aria-label', 'End time filter');
  toSelect.innerHTML = '<option value="">Any</option>';
  for (const m of TIME_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = fmtTimeOpt(m);
    toSelect.appendChild(opt);
  }

  function syncTimeRange() {
    const from = fromSelect.value ? Number(fromSelect.value) : null;
    const to   = toSelect.value   ? Number(toSelect.value)   : null;
    const timeRange = (from !== null || to !== null)
      ? { start: from ?? 0, end: to ?? 9999 }
      : null;
    const { filters } = getState();
    setState({ filters: { ...filters, timeRange } });
  }
  fromSelect.addEventListener('change', syncTimeRange);
  toSelect.addEventListener('change', syncTimeRange);

  fromLabel.appendChild(fromSelect);
  toLabel.appendChild(toSelect);
  filtersEl.appendChild(adultToggle);
  filtersEl.appendChild(fromLabel);
  filtersEl.appendChild(toLabel);

  toolbar.innerHTML = '';
  toolbar.appendChild(modeToggle);
  toolbar.appendChild(sep);
  toolbar.appendChild(filtersEl);

  // ── My Schedule toolbar ────────────────────────────────────────
  const myGridBtn = document.createElement('button');
  myGridBtn.className = 'mode-btn';
  myGridBtn.setAttribute('aria-pressed', 'false');
  myGridBtn.innerHTML = '▦ Grid';

  const myListBtn = document.createElement('button');
  myListBtn.className = 'mode-btn mode-btn--active';
  myListBtn.setAttribute('aria-pressed', 'true');
  myListBtn.innerHTML = '≡ List';

  myGridBtn.addEventListener('click', () => setState({ myScheduleMode: 'grid' }));
  myListBtn.addEventListener('click', () => setState({ myScheduleMode: 'list' }));

  const myModeToggle = document.createElement('div');
  myModeToggle.className = 'mode-toggle';
  myModeToggle.setAttribute('role', 'group');
  myModeToggle.setAttribute('aria-label', 'My Schedule view mode');
  myModeToggle.appendChild(myGridBtn);
  myModeToggle.appendChild(myListBtn);

  const myToolbarSep = document.createElement('div');
  myToolbarSep.className = 'toolbar-sep';

  const addEventBtn = document.createElement('button');
  addEventBtn.className = 'add-event-btn';
  addEventBtn.textContent = '+ Add Event';
  addEventBtn.setAttribute('aria-label', 'Add custom event');
  addEventBtn.addEventListener('click', () => openCustomEventForm());

  myScheduleToolbar.innerHTML = '';
  myScheduleToolbar.appendChild(myModeToggle);
  myScheduleToolbar.appendChild(myToolbarSep);
  myScheduleToolbar.appendChild(addEventBtn);

  // ── Keyboard nav ───────────────────────────────────────────────
  addTablistKeyNav(daySelector, '.day-pill');
  addTablistKeyNav(navTabs, '.nav-tab');

  // ── Render helpers ─────────────────────────────────────────────
  function renderSchedule(state) {
    const dayEvents = getEventsForDay(allEvents, state.day);
    const filtered  = applyFilters(dayEvents, state.filters);
    if (state.scheduleMode === 'grid') renderGrid(mainContent, filtered);
    else                               renderList(mainContent, filtered);
  }

  // ── State subscriber ───────────────────────────────────────────
  let prevView = null;
  let prevDay  = null;

  subscribe(state => {
    if (prevView !== null && (state.view !== prevView || state.day !== prevDay)) {
      mainContent.scrollTop = 0;
      mainContent.scrollLeft = 0;
    }
    prevView = state.view;
    prevDay  = state.day;

    // Day pills
    daySelector.querySelectorAll('.day-pill').forEach(btn => {
      const active = Number(btn.dataset.day) === state.day;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.tabIndex = active ? 0 : -1;
    });

    // Nav tabs
    navTabs.querySelectorAll('.nav-tab').forEach(btn => {
      const active = btn.dataset.view === state.view;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.tabIndex = active ? 0 : -1;
    });

    const isSchedule   = state.view === 'schedule';
    const isMySchedule = state.view === 'my-schedule';
    const needsDays    = isSchedule || state.view === 'compare' ||
                         (isMySchedule && state.myScheduleMode === 'grid');
    daySelector.style.display       = needsDays   ? '' : 'none';
    toolbar.style.display           = isSchedule  ? '' : 'none';
    myScheduleToolbar.style.display = isMySchedule ? '' : 'none';

    // Schedule mode toggle
    gridBtn.classList.toggle('mode-btn--active', state.scheduleMode === 'grid');
    listBtn.classList.toggle('mode-btn--active', state.scheduleMode === 'list');
    gridBtn.setAttribute('aria-pressed', state.scheduleMode === 'grid' ? 'true' : 'false');
    listBtn.setAttribute('aria-pressed', state.scheduleMode === 'list' ? 'true' : 'false');

    // My Schedule mode toggle
    myGridBtn.classList.toggle('mode-btn--active', state.myScheduleMode === 'grid');
    myListBtn.classList.toggle('mode-btn--active', state.myScheduleMode === 'list');
    myGridBtn.setAttribute('aria-pressed', state.myScheduleMode === 'grid' ? 'true' : 'false');
    myListBtn.setAttribute('aria-pressed', state.myScheduleMode === 'list' ? 'true' : 'false');

    // 18+ toggle
    adultToggle.classList.toggle('filter-toggle--active', state.filters.show18Plus);
    adultToggle.setAttribute('aria-pressed', state.filters.show18Plus ? 'true' : 'false');

    // Render
    if (state.view === 'schedule') {
      renderSchedule(state);
    } else if (state.view === 'my-schedule') {
      renderMySchedule(mainContent, allEvents, state.day, state.myScheduleMode);
    } else {
      renderCompare(mainContent, allEvents, state.day, compareSet);
    }
  });

  // Going-to changes
  document.addEventListener('goingto:change', () => {
    const state = getState();
    if (state.view === 'schedule') {
      if (state.scheduleMode === 'grid') updateGridGoing(mainContent);
      else                               updateListGoing(mainContent);
    } else if (state.view === 'my-schedule') {
      renderMySchedule(mainContent, allEvents, state.day, state.myScheduleMode);
    } else {
      renderCompare(mainContent, allEvents, state.day, compareSet);
    }
  });

  // Custom event changes — refresh merged event list then re-render
  document.addEventListener('customevent:change', async () => {
    invalidateCache();
    allEvents = await getEvents();
    const state = getState();
    if (state.view === 'schedule') {
      renderSchedule(state);
    } else if (state.view === 'my-schedule') {
      renderMySchedule(mainContent, allEvents, state.day, state.myScheduleMode);
    } else {
      renderCompare(mainContent, allEvents, state.day, compareSet);
    }
  });

  // Compare schedule changes
  document.addEventListener('compare:change', () => {
    compareSet = getCompareSet();
    const state = getState();
    if (state.view === 'compare') {
      renderCompare(mainContent, allEvents, state.day, compareSet);
    }
  });

  setState({ day: 1, view: 'schedule' });
}

init();
