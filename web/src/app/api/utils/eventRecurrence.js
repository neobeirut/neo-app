function weekdayCodeFromDateUTC(date) {
  // JS: 0=Sun..6=Sat
  const map = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  return map[date.getUTCDay()] || "";
}

function dateKeyUTC(date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysUTC(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function weeksBetweenUTC(a, b) {
  // whole weeks between two UTC midnights
  const ms = b.getTime() - a.getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  return Math.floor(ms / weekMs);
}

export function generateWeeklyOccurrences({ event, rangeStart, rangeEnd }) {
  const startAt = event?.start_at ? new Date(event.start_at) : null;
  if (!startAt || Number.isNaN(startAt.getTime())) {
    return [];
  }

  const endAt = event?.end_at ? new Date(event.end_at) : null;
  const durationMs =
    endAt && !Number.isNaN(endAt.getTime())
      ? endAt.getTime() - startAt.getTime()
      : null;

  const interval = Number(event?.recurrence_interval || 1);
  const byWeekday = Array.isArray(event?.recurrence_byweekday)
    ? event.recurrence_byweekday.map(String)
    : [];

  if (!byWeekday.length || !Number.isFinite(interval) || interval < 1) {
    return [];
  }

  const templateStartDateKey = dateKeyUTC(startAt);

  const untilDateKey = event?.recurrence_until
    ? String(event.recurrence_until).slice(0, 10)
    : null;

  // Normalize scan bounds to UTC midnight days
  const scanStart = new Date(
    Date.UTC(
      rangeStart.getUTCFullYear(),
      rangeStart.getUTCMonth(),
      rangeStart.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );

  const scanEnd = new Date(
    Date.UTC(
      rangeEnd.getUTCFullYear(),
      rangeEnd.getUTCMonth(),
      rangeEnd.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );

  // Base date for interval math = template start day (UTC midnight)
  const baseDay = new Date(
    Date.UTC(
      startAt.getUTCFullYear(),
      startAt.getUTCMonth(),
      startAt.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );

  const occurrences = [];

  for (
    let d = scanStart;
    d.getTime() <= scanEnd.getTime();
    d = addDaysUTC(d, 1)
  ) {
    const dayKey = dateKeyUTC(d);

    // Not before the template start day
    if (dayKey < templateStartDateKey) {
      continue;
    }

    // Not after until
    if (untilDateKey && dayKey > untilDateKey) {
      continue;
    }

    const weekday = weekdayCodeFromDateUTC(d);
    if (!byWeekday.includes(weekday)) {
      continue;
    }

    const weekDiff = weeksBetweenUTC(baseDay, d);
    if (weekDiff % interval !== 0) {
      continue;
    }

    const occStart = new Date(
      Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        startAt.getUTCHours(),
        startAt.getUTCMinutes(),
        startAt.getUTCSeconds(),
        startAt.getUTCMilliseconds(),
      ),
    );

    const occEnd =
      durationMs !== null ? new Date(occStart.getTime() + durationMs) : null;

    occurrences.push({
      start_at: occStart.toISOString(),
      end_at: occEnd ? occEnd.toISOString() : null,
    });
  }

  return occurrences;
}

export function normalizeEventListItem({ event, occurrence, override }) {
  const base = {
    ...event,
  };

  // Ensure consumers can uniquely identify an instance.
  const occurrenceStart =
    override?.start_at || occurrence?.start_at || base?.start_at;

  const occurrenceEnd =
    override?.end_at !== undefined
      ? override.end_at
      : occurrence?.end_at !== undefined
        ? occurrence.end_at
        : base?.end_at;

  const occurrenceStatus = override?.status || base?.status;

  return {
    ...base,
    // Keep template id
    template_id: base.id,
    // Make start_at/end_at represent the occurrence's time
    start_at: occurrenceStart,
    end_at: occurrenceEnd,
    status: occurrenceStatus,
    // Carry flags
    is_recurring: !!base.is_recurring,
    occurrence_start_at: occurrenceStart,
  };
}
