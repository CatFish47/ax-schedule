#!/usr/bin/env python3
"""
Preprocess scraped_events.csv → events.json

Added fields:
  id            — stable 8-char hex hash of date+room+start_time+title
  day           — 1-based convention day (1=Jul 2, 2=Jul 3, 3=Jul 4, 4=Jul 5)
  start_int     — start time as minutes from midnight; post-midnight times
                  (< 6:00 AM) get +1440 to preserve same-day sort order
  end_int       — same encoding for end time
  cleared_before — true if description says room is cleared before this panel
  cleared_after  — true if description says room is cleared after this panel
  is_18_plus    — true if title contains "(18+)"
"""

import csv
import hashlib
import json
import re
import sys
from pathlib import Path

DATE_TO_DAY = {
    "July 2, 2026": 1,
    "July 3, 2026": 2,
    "July 4, 2026": 3,
    "July 5, 2026": 4,
}

# Times whose 24h value falls below this (minutes) are treated as post-midnight
# continuations of the previous evening rather than early-morning events.
# Earliest legitimate morning event in this dataset starts at 9:45 AM (585 min).
POST_MIDNIGHT_THRESHOLD = 360  # 6:00 AM


def parse_time(time_str: str) -> int:
    """
    Convert a 12-hour time string to integer minutes from midnight.

    Post-midnight times (< POST_MIDNIGHT_THRESHOLD after 12h→24h conversion)
    have 1440 added so they sort after the evening that precedes them.

    Examples:
      "10:00 AM" → 600
      "12:30 AM" → 30 + 1440 = 1470   (midnight = hour 0 in 24h)
      "12:00 PM" → 720                 (noon stays at 720, not adjusted)
      "1:30 AM"  → 90 + 1440 = 1530
    """
    m = re.fullmatch(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_str.strip(), re.IGNORECASE)
    if not m:
        raise ValueError(f"Unrecognised time format: {time_str!r}")

    hour, minute, period = int(m.group(1)), int(m.group(2)), m.group(3).upper()

    if period == "AM":
        hour = 0 if hour == 12 else hour      # 12:xx AM → 0:xx
    else:
        hour = hour if hour == 12 else hour + 12  # 12:xx PM stays; others +12

    total = hour * 60 + minute
    if total < POST_MIDNIGHT_THRESHOLD:
        total += 1440
    return total


def make_id(date: str, room: str, start_time: str, title: str) -> str:
    key = f"{date}|{room}|{start_time}|{title}"
    return hashlib.sha1(key.encode()).hexdigest()[:8]


def process(input_path: Path, output_path: Path) -> None:
    events = []
    warnings = []

    with open(input_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):  # row 1 is the header
            date = row["date"].strip()
            start_time = row["start time"].strip()
            end_time = row["end time"].strip()
            room = row["room"].strip()
            title = row["title"].strip()
            description = row["description"].strip()

            day = DATE_TO_DAY.get(date)
            if day is None:
                warnings.append(f"row {i}: unknown date {date!r} — skipped ({title!r})")
                continue

            try:
                start_int = parse_time(start_time)
                end_int = parse_time(end_time)
            except ValueError as exc:
                warnings.append(f"row {i}: {exc} — skipped ({title!r})")
                continue

            if end_int <= start_int:
                warnings.append(
                    f"row {i}: end_int ({end_int}) ≤ start_int ({start_int}) "
                    f"for {title!r} [{start_time}–{end_time}]"
                )

            events.append({
                "id": make_id(date, room, start_time, title),
                "date": date,
                "day": day,
                "start_time": start_time,
                "end_time": end_time,
                "start_int": start_int,
                "end_int": end_int,
                "room": room,
                "title": title,
                "description": description,
                "cleared_before": "This room WILL be cleared prior to this panel" in description,
                "cleared_after": "This room WILL be cleared for the next panel" in description,
                "is_18_plus": "(18+)" in title,
            })

    # Stable sort: day first, then chronological within the day
    events.sort(key=lambda e: (e["day"], e["start_int"]))

    # Detect hash collisions (extremely unlikely with 8 hex chars over ~400 events)
    seen_ids: dict[str, str] = {}
    for e in events:
        if e["id"] in seen_ids:
            warnings.append(
                f"ID collision: {e['id']} shared by {seen_ids[e['id']]!r} and {e['title']!r}"
            )
        seen_ids[e["id"]] = e["title"]

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(events, f, indent=2, ensure_ascii=False)

    # Summary
    by_day = {d: sum(1 for e in events if e["day"] == d) for d in range(1, 5)}
    print(f"Output:  {output_path}")
    print(f"Total:   {len(events)} events")
    for d, count in by_day.items():
        date_label = next(k for k, v in DATE_TO_DAY.items() if v == d)
        print(f"  Day {d} ({date_label}): {count} events")
    print(f"18+:     {sum(1 for e in events if e['is_18_plus'])} events")
    print(f"Cleared before: {sum(1 for e in events if e['cleared_before'])} events")
    print(f"Cleared after:  {sum(1 for e in events if e['cleared_after'])} events")

    if warnings:
        print(f"\nWarnings ({len(warnings)}):", file=sys.stderr)
        for w in warnings:
            print(f"  {w}", file=sys.stderr)


if __name__ == "__main__":
    root = Path(__file__).parent
    process(root / "scraped_events.csv", root / "events.json")
