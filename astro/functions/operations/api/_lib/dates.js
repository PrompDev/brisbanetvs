const BRISBANE_TIME_ZONE = "Australia/Brisbane";
const dayFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: BRISBANE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function brisbaneDay(date = new Date()) {
  const parts = dayFormatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function brisbaneDayDaysAgo(days, now = new Date()) {
  return brisbaneDay(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));
}

export function leadRecency(value, now = new Date()) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "unknown";

  const today = brisbaneDay(now);
  if (brisbaneDay(date) === today) return "today";
  if (brisbaneDay(date) === brisbaneDayDaysAgo(1, now)) return "yesterday";
  return "older";
}
