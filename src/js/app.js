import { getState, setState, subscribe } from './store.js';
import { getEvents } from './data.js';
import { render as renderGrid, updateGoingState } from './grid.js';
import { render as renderMySchedule } from './my-schedule.js';

const DAYS = [
  { day: 1, label: 'Jul 2' },
  { day: 2, label: 'Jul 3' },
  { day: 3, label: 'Jul 4' },
  { day: 4, label: 'Jul 5' },
];

function addTablistKeyNav(container, itemSelector, getStateKey, setStateKey) {
  container.addEventListener('keydown', e => {
    const items = [...container.querySelectorAll(itemSelector)];
    const idx = items.findIndex(el => el === document.activeElement);
    if (idx === -1) return;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % items.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next !== -1) {
      e.preventDefault();
      items[next].focus();
      items[next].click();
    }
  });
}

async function init() {
  let allEvents;
  try {
    allEvents = await getEvents();
  } catch (err) {
    document.getElementById('app-main').innerHTML =
      `<div class="error-state">Failed to load schedule data. Please refresh.</div>`;
    console.error(err);
    return;
  }

  const daySelector = document.getElementById('day-selector');
  const navTabs = document.getElementById('nav-tabs');
  const mainContent = document.getElementById('app-main');

  // ── Build day selector pills ──
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

  // ── Build nav tabs ──
  const views = [
    { view: 'schedule', label: 'Schedule' },
    { view: 'my-schedule', label: 'My Schedule' },
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

  // ── Keyboard navigation (roving tabindex) ──
  addTablistKeyNav(daySelector, '.day-pill');
  addTablistKeyNav(navTabs, '.nav-tab');

  // ── Re-render on state changes ──
  let prevView = null;
  let prevDay = null;

  subscribe(state => {
    // Reset scroll when switching views or days
    if (prevView !== null && (state.view !== prevView || state.day !== prevDay)) {
      mainContent.scrollTop = 0;
      mainContent.scrollLeft = 0;
    }
    prevView = state.view;
    prevDay = state.day;

    // Sync day pills (roving tabindex)
    daySelector.querySelectorAll('.day-pill').forEach(btn => {
      const active = Number(btn.dataset.day) === state.day;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.tabIndex = active ? 0 : -1;
    });

    // Sync nav tabs (roving tabindex)
    navTabs.querySelectorAll('.nav-tab').forEach(btn => {
      const active = btn.dataset.view === state.view;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.tabIndex = active ? 0 : -1;
    });

    // Show/hide day selector (only on schedule view)
    daySelector.style.display = state.view === 'schedule' ? '' : 'none';

    // Render the active view
    if (state.view === 'schedule') {
      renderGrid(mainContent, allEvents, state.day);
    } else {
      renderMySchedule(mainContent, allEvents);
    }
  });

  // Listen for going-to changes so grid and my-schedule stay in sync
  document.addEventListener('goingto:change', () => {
    const state = getState();
    if (state.view === 'schedule') {
      updateGoingState(mainContent);
    } else {
      renderMySchedule(mainContent, allEvents);
    }
  });

  // Initial render
  setState({ day: 1, view: 'schedule' });
}

init();
