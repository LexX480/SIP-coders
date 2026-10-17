// Opening-hours helpers shared by the warehouse pages. Hours are stored as
// one entry per weekday: { day, closed, open: "HH:MM", close: "HH:MM" }
// where day follows JS getDay() (0 = Sunday) and times are Nepal local time.

export const DAYS = [
  { index: 0, label: "Sunday", short: "Sun" },
  { index: 1, label: "Monday", short: "Mon" },
  { index: 2, label: "Tuesday", short: "Tue" },
  { index: 3, label: "Wednesday", short: "Wed" },
  { index: 4, label: "Thursday", short: "Thu" },
  { index: 5, label: "Friday", short: "Fri" },
  { index: 6, label: "Saturday", short: "Sat" },
];

const ALL_DAY = { open: "00:00", close: "23:59" };

// A full week with the same hours on every day.
export function uniformHours(open = "09:00", close = "17:00") {
  return DAYS.map((d) => ({ day: d.index, closed: false, open, close }));
}

export function allDayHours() {
  return uniformHours(ALL_DAY.open, ALL_DAY.close);
}

// Always returns 7 entries in Sunday..Saturday order. Days missing from
// the saved data are treated as closed. Empty/unset hours -> null.
export function normalizeHours(openingHours) {
  if (!Array.isArray(openingHours) || openingHours.length === 0) return null;
  return DAYS.map((d) => {
    const found = openingHours.find((h) => h.day === d.index);
    if (!found || found.closed) return { day: d.index, closed: true, open: "09:00", close: "17:00" };
    return { day: d.index, closed: false, open: found.open, close: found.close };
  });
}

// True when every day of the week is open from 00:00 to 23:59.
export function isAllDayWeek(openingHours) {
  const week = normalizeHours(openingHours);
  return !!week && week.every((e) => !e.closed && e.open === ALL_DAY.open && e.close === ALL_DAY.close);
}

// Returns a human-readable problem with the hours, or "" if they're fine.
// Mirrors the server-side check so people see the mistake before saving.
export function findHoursError(openingHours) {
  const week = normalizeHours(openingHours);
  if (!week) return "";
  for (const e of week) {
    if (e.closed) continue;
    if (!e.open || !e.close) return `${DAYS[e.day].label}: set both an opening and a closing time.`;
    if (e.close <= e.open) return `${DAYS[e.day].label}: closing time must be after opening time.`;
  }
  return "";
}

// "13:30" -> "1:30 PM"
export function formatTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function rangeLabel(entry) {
  if (entry.closed) return "Closed";
  if (entry.open === ALL_DAY.open && entry.close === ALL_DAY.close) return "Open 24 hours";
  return `${formatTime(entry.open)} - ${formatTime(entry.close)}`;
}

// Current weekday + minutes-since-midnight in Nepal, regardless of where
// the viewer's own device clock/timezone is set.
function nepalNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kathmandu",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const day = DAYS.find((d) => d.short === get("weekday"))?.index ?? 0;
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Compact weekly summary, grouping consecutive days with identical hours:
// [ "Sun - Fri  9:00 AM - 5:00 PM", "Sat  Closed" ]
export function summarizeHours(openingHours) {
  const week = normalizeHours(openingHours);
  if (!week) return [];

  const groups = [];
  for (const entry of week) {
    const label = rangeLabel(entry);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.end = entry.day;
    } else {
      groups.push({ start: entry.day, end: entry.day, label });
    }
  }

  return groups.map((g) => ({
    days: g.start === g.end ? DAYS[g.start].short : `${DAYS[g.start].short} - ${DAYS[g.end].short}`,
    label: g.label,
  }));
}

// { known, open, label, detail }
// known=false  -> no hours set, show nothing
// label        -> short badge text ("Open now" / "Closed")
// detail       -> "Closes 5:00 PM" / "Opens Mon 9:00 AM" etc.
export function getOpenStatus(openingHours, now = new Date()) {
  const week = normalizeHours(openingHours);
  if (!week) return { known: false, open: null, label: "", detail: "" };

  const { day, minutes } = nepalNow(now);
  const today = week[day];

  if (!today.closed) {
    const openAt = toMinutes(today.open);
    const closeAt = toMinutes(today.close);

    if (minutes >= openAt && minutes < closeAt) {
      const allDay = today.open === ALL_DAY.open && today.close === ALL_DAY.close;
      return {
        known: true,
        open: true,
        label: "Open now",
        detail: allDay ? "Open 24 hours" : `Closes ${formatTime(today.close)}`,
      };
    }
    if (minutes < openAt) {
      return { known: true, open: false, label: "Closed", detail: `Opens today ${formatTime(today.open)}` };
    }
  }

  // Closed for the rest of today - find the next day it opens.
  for (let i = 1; i <= 7; i++) {
    const next = week[(day + i) % 7];
    if (!next.closed) {
      const when = i === 1 ? "tomorrow" : DAYS[next.day].short;
      return { known: true, open: false, label: "Closed", detail: `Opens ${when} ${formatTime(next.open)}` };
    }
  }
  return { known: true, open: false, label: "Closed", detail: "Closed all week" };
}