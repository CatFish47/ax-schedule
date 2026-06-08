const state = {
  day: 1,
  view: 'schedule',         // 'schedule' | 'my-schedule' | 'compare'
  scheduleMode: 'grid',     // 'grid' | 'list'
  myScheduleMode: 'list',   // 'grid' | 'list'
  filters: { timeRange: null, show18Plus: true },
  modalEvent: null,
  highlightedRooms: [],
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
