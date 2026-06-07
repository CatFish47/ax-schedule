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
    btn.setAttribute('aria-selected', day === 1 ? 'true' : 'false');
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
    btn.setAttribute('aria-selected', view === 'schedule' ? 'true' : 'false');
    btn.textContent = label;
    btn.addEventListener('click', () => setState({ view }));
    navTabs.appendChild(btn);
  }

  // ── Re-render on state changes ──
  subscribe(state => {
    // Sync day pills
    daySelector.querySelectorAll('.day-pill').forEach(btn => {
      const active = Number(btn.dataset.day) === state.day;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    // Sync nav tabs
    navTabs.querySelectorAll('.nav-tab').forEach(btn => {
      const active = btn.dataset.view === state.view;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
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
