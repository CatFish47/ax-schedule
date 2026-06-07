const KEY = 'ax26_going_to';

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
