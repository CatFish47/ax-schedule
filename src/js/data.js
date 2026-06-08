let cache = null;

export async function getEvents() {
  if (cache) return cache;
  const res = await fetch('./events.json');
  if (!res.ok) throw new Error(`Failed to load events.json: ${res.status}`);
  cache = await res.json();
  return cache;
}

export function getEventsForDay(events, day) {
  return events.filter(e => e.day === day);
}

// Room groupings for the timeline grid columns
export const ROOM_GROUPS = [
  {
    label: 'LACC Panels',
    rooms: [
      '402A', '403AB', '404AB', '406AB', '408AB', '409AB', '411',
      '511ABC', '515 AB', 'Concourse Hall E', 'Petree Hall',
    ],
  },
  {
    label: 'JW Marriott',
    rooms: ['JW Diamond', 'JW Platinum'],
  },
  {
    label: 'Main Stages',
    rooms: ['Crypto.com Arena', 'Main Events (Crypto.com Arena)', 'Peacock Theater'],
  },
  {
    label: 'Outdoor / Other',
    rooms: ['AX Crossing', 'AX Dance', 'Beer Garden at Peacock Place', 'Lounge 21', 'The Novo'],
  },
];

// Abbreviated room names for tight mobile columns
export const ROOM_ABBREV = {
  '402A': '402A',
  '403AB': '403AB',
  '404AB': '404AB',
  '406AB': '406AB',
  '408AB': '408AB',
  '409AB': '409AB',
  '411': '411',
  '511ABC': '511ABC',
  '515 AB': '515AB',
  'Concourse Hall E': 'Con E',
  'Petree Hall': 'Petree',
  'JW Diamond': 'Diamond',
  'JW Platinum': 'Platinum',
  'Crypto.com Arena': 'Crypto',
  'Main Events (Crypto.com Arena)': 'Main Events',
  'Peacock Theater': 'Peacock',
  'AX Crossing': 'AX Cross',
  'AX Dance': 'AX Dance',
  'Beer Garden at Peacock Place': 'Beer Garden',
  'Lounge 21': 'Lounge 21',
  'The Novo': 'The Novo',
};

// Returns rooms present in the given event list, maintaining group order
export function getActiveRoomGroups(events) {
  const present = new Set(events.map(e => e.room));
  return ROOM_GROUPS.map(group => ({
    ...group,
    rooms: group.rooms.filter(r => present.has(r)),
  })).filter(group => group.rooms.length > 0);
}

// Detect overlapping events within a single room and assign left/width slots.
// Returns a map: eventId → { slot, totalSlots }
export function computeOverlaps(roomEvents) {
  const slotMap = {};
  // Sort by start time
  const sorted = [...roomEvents].sort((a, b) => a.start_int - b.start_int);

  // Build overlap groups using a sweep
  const groups = [];
  let currentGroup = [];
  let groupEnd = -Infinity;

  for (const ev of sorted) {
    if (ev.start_int >= groupEnd) {
      if (currentGroup.length > 0) groups.push(currentGroup);
      currentGroup = [ev];
      groupEnd = ev.end_int;
    } else {
      currentGroup.push(ev);
      groupEnd = Math.max(groupEnd, ev.end_int);
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  for (const group of groups) {
    // Assign slots greedily
    const lanes = [];
    for (const ev of group) {
      let placed = false;
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i] <= ev.start_int) {
          slotMap[ev.id] = { slot: i, totalSlots: 0 };
          lanes[i] = ev.end_int;
          placed = true;
          break;
        }
      }
      if (!placed) {
        slotMap[ev.id] = { slot: lanes.length, totalSlots: 0 };
        lanes.push(ev.end_int);
      }
    }
    const total = lanes.length;
    for (const ev of group) {
      slotMap[ev.id].totalSlots = total;
    }
  }

  return slotMap;
}

export function applyFilters(events, filters) {
  let result = events;
  if (!filters.show18Plus) {
    result = result.filter(e => !e.is_18_plus);
  }
  if (filters.timeRange) {
    const { start, end } = filters.timeRange;
    result = result.filter(e => e.start_int >= start && e.end_int <= end);
  }
  return result;
}

export function formatTime(minutes) {
  const m = minutes % 1440;  // unwrap post-midnight
  const h = Math.floor(m / 60);
  const min = m % 60;
  const period = h < 12 ? 'AM' : 'PM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return min === 0
    ? `${displayH} ${period}`
    : `${displayH}:${String(min).padStart(2, '0')} ${period}`;
}
