const KEY = 'ax26_going_to';
const CUSTOM_KEY = 'ax26_custom_events';

function load() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function save(set) {
  localStorage.setItem(KEY, JSON.stringify([...set]));
}

export const CustomEvents = {
  getAll() {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
    } catch {
      return [];
    }
  },
  add(ev) {
    const all = this.getAll();
    all.push(ev);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(all));
    GoingTo.add(ev.id);
  },
  update(ev) {
    const all = this.getAll().map(e => e.id === ev.id ? ev : e);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(all));
  },
  remove(id) {
    const all = this.getAll().filter(e => e.id !== id);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(all));
    GoingTo.remove(id);
  },
};

export const GoingTo = {
  getAll() {
    return load();
  },
  add(eventId) {
    const s = load();
    s.add(eventId);
    save(s);
  },
  remove(eventId) {
    const s = load();
    s.delete(eventId);
    save(s);
  },
  has(eventId) {
    return load().has(eventId);
  },
  clear() {
    localStorage.removeItem(KEY);
  },
};
