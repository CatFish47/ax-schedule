const state = {
  day: 1,
  view: 'schedule',      // 'schedule' | 'my-schedule'
  scheduleMode: 'grid',  // 'grid' | 'list' (Phase 2)
  filters: { timeRange: null, show18Plus: true },
  modalEvent: null,
  highlightedRooms: [],  // Phase 3
};

const subscribers = new Set();

export function getState() {
  return { ...state };
}

export function setState(patch) {
  Object.assign(state, patch);
  subscribers.forEach(fn => fn({ ...state }));
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
