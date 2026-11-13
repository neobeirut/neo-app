export const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const DEFAULT_WEEKDAY_SCHEDULE = {
  monday: { active: true, open: "12:00", close: "23:00" },
  tuesday: { active: true, open: "12:00", close: "23:00" },
  wednesday: { active: true, open: "12:00", close: "23:00" },
  thursday: { active: true, open: "12:00", close: "23:00" },
  friday: { active: true, open: "12:00", close: "23:00" },
  saturday: { active: true, open: "12:00", close: "23:00" },
  sunday: { active: false, open: "12:00", close: "23:00" },
};

export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(":");
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

/**
 * Clean & normalize weekday schedule object or string
 */
export function normalizeWeekdaySchedule(raw, fallbackOpen = "12:00", fallbackClose = "23:00") {
  let parsed = raw;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch (_) { parsed = {}; }
  }
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch (_) { parsed = {}; }
  }

  const clean = {};
  for (const day of DAYS_OF_WEEK) {
    const d = parsed && typeof parsed === "object" ? parsed[day] : null;
    if (d && typeof d === "object") {
      clean[day] = {
        active: d.active !== false,
        open: typeof d.open === "string" && d.open.trim() ? d.open.trim().slice(0, 5) : fallbackOpen.slice(0, 5),
        close: typeof d.close === "string" && d.close.trim() ? d.close.trim().slice(0, 5) : fallbackClose.slice(0, 5),
      };
    } else {
      clean[day] = {
        active: day !== "sunday",
        open: fallbackOpen.slice(0, 5),
        close: fallbackClose.slice(0, 5),
      };
    }
  }
  return clean;
}

/**
 * Get current date & time parts in Asia/Beirut timezone
 */
export function getBeirutNowInfo(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Beirut",
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const map = {};
  for (const p of parts) map[p.type] = p.value;

  const weekday = map.weekday.toLowerCase();
  const timeHHMM = `${map.hour}:${map.minute}`;
  const timeMinutes = parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);
  const dateYYYYMMDD = `${map.year}-${map.month}-${map.day}`;

  return {
    weekday,
    timeHHMM,
    timeMinutes,
    dateYYYYMMDD,
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
  };
}

/**
 * Helper to construct an accurate Date object for Beirut timezone given Y, M, D and HH:MM
 */
export function calculateDateForBeirut(year, month, day, timeHHMM) {
  const [hourStr, minStr] = timeHHMM.split(":");
  const h = parseInt(hourStr, 10) || 0;
  const m = parseInt(minStr, 10) || 0;

  // Approximate UTC by assuming UTC+3 / UTC+2
  let candidate = new Date(Date.UTC(year, month - 1, day, h - 3, m, 0));
  const beirutCheck = getBeirutNowInfo(candidate);
  const diffHours = h - beirutCheck.hour;
  if (diffHours !== 0) {
    candidate = new Date(candidate.getTime() + diffHours * 3600000);
  }
  return candidate;
}

/**
 * Calculate the next scheduled opening time (returns label and exact Date object)
 */
export function getNextScheduledOpen(schedule, fromDate = new Date()) {
  const info = getBeirutNowInfo(fromDate);
  const currentDayIndex = DAYS_OF_WEEK.indexOf(info.weekday);

  // 1. Check if today is active and we are before today's open
  const todaySched = schedule[info.weekday];
  if (todaySched && todaySched.active) {
    const todayOpenMin = timeToMinutes(todaySched.open);
    if (info.timeMinutes < todayOpenMin) {
      const reopenDate = calculateDateForBeirut(info.year, info.month, info.day, todaySched.open);
      return {
        day: info.weekday,
        openTime: todaySched.open,
        daysAhead: 0,
        label: `today at ${todaySched.open}`,
        reopenDate,
      };
    }
  }

  // 2. Look ahead 1 to 7 days
  for (let offset = 1; offset <= 7; offset++) {
    const nextDayIndex = (currentDayIndex + offset) % 7;
    const nextDayName = DAYS_OF_WEEK[nextDayIndex];
    const nextDaySched = schedule[nextDayName];
    if (nextDaySched && nextDaySched.active) {
      const capDay = nextDayName.charAt(0).toUpperCase() + nextDayName.slice(1);
      const label = offset === 1 ? `tomorrow at ${nextDaySched.open}` : `${capDay} at ${nextDaySched.open}`;
      const reopenDate = calculateDateForBeirut(info.year, info.month, info.day + offset, nextDaySched.open);
      return {
        day: nextDayName,
        openTime: nextDaySched.open,
        daysAhead: offset,
        label,
        reopenDate,
      };
    }
  }

  // Fallback: tomorrow 12:00
  const fallbackReopen = calculateDateForBeirut(info.year, info.month, info.day + 1, "12:00");
  return {
    day: info.weekday,
    openTime: "12:00",
    daysAhead: 1,
    label: "tomorrow at 12:00",
    reopenDate: fallbackReopen,
  };
}

/**
 * Compute the real-time operational status of a branch
 *
 * @param {object} branch - Database branch row
 * @param {Date} now - Current time (defaults to new Date())
 * @returns {object} Status details
 */
export function evaluateBranchStatus(branch, now = new Date()) {
  if (!branch) {
    return {
      isOpen: false,
      ordersActive: false,
      status: "closed",
      closureReason: null,
      displayText: "🔴 Closed",
      description: "Store is Closed",
      needsDbSync: false,
      newOperationalStatus: "closed",
      newClosedUntil: null,
    };
  }

  // If master switch is inactive, branch is totally off
  if (branch.is_active === false) {
    return {
      isOpen: false,
      ordersActive: false,
      status: "closed",
      closureReason: branch.closure_reason || "Branch Inactive",
      displayText: "🔴 Closed (Inactive)",
      description: "Branch is currently disabled in system",
      needsDbSync: false,
      newOperationalStatus: "closed",
      newClosedUntil: null,
    };
  }

  const sched = normalizeWeekdaySchedule(
    branch.weekday_schedule,
    branch.opening_time || "12:00",
    branch.closing_time || "23:00"
  );
  const beirutNow = getBeirutNowInfo(now);
  const todaySched = sched[beirutNow.weekday] || { active: true, open: "12:00", close: "23:00" };

  const todayOpenMin = timeToMinutes(todaySched.open);
  const todayCloseMin = timeToMinutes(todaySched.close);
  const isWithinScheduledHours =
    todaySched.active !== false &&
    beirutNow.timeMinutes >= todayOpenMin &&
    beirutNow.timeMinutes < todayCloseMin;

  const nextOpen = getNextScheduledOpen(sched, now);

  // Check if closed_until is active
  let isClosedUntilActive = false;
  if (branch.closed_until) {
    const closedUntilDate = new Date(branch.closed_until);
    if (closedUntilDate.getTime() > now.getTime()) {
      isClosedUntilActive = true;
    }
  }

  // 1. Temporary closure still in effect (closed_until in the future)
  if (isClosedUntilActive) {
    const reason = branch.closure_reason || "Temporarily Closed";
    const status = branch.operational_status || "closed";
    const closedUntilDate = new Date(branch.closed_until);
    const untilInfo = getBeirutNowInfo(closedUntilDate);
    const isToday = untilInfo.dateYYYYMMDD === beirutNow.dateYYYYMMDD;
    const untilCap = untilInfo.weekday.charAt(0).toUpperCase() + untilInfo.weekday.slice(1);
    const reopensLabel = isToday ? `today at ${untilInfo.timeHHMM}` : `${untilCap} at ${untilInfo.timeHHMM}`;

    return {
      isOpen: false,
      ordersActive: false,
      status,
      closureReason: reason,
      closedUntil: branch.closed_until,
      displayText: status === "closed_hour" ? `⏳ Closed 1h (Reopens ${untilInfo.timeHHMM})` : `🔴 Closed (Reopens ${reopensLabel})`,
      description: `Store is closed (${reason}) — reopens ${reopensLabel}`,
      needsDbSync: false,
      newOperationalStatus: status,
      newClosedUntil: branch.closed_until,
    };
  }

  // 2. If closed_until was set in the past, it HAS EXPIRED!
  const hadExpiredClosure = !!branch.closed_until && new Date(branch.closed_until).getTime() <= now.getTime();

  // 3. What if operational_status was "closed" or "closed_today" without closed_until?
  // If we are within today's scheduled operating hours, it should be OPEN!
  const isLegacyManualClose =
    (branch.operational_status === "closed" || branch.operational_status === "closed_today") &&
    !branch.closed_until;

  if (isWithinScheduledHours) {
    // Within operating hours: store is OPEN!
    const needsSync =
      hadExpiredClosure ||
      isLegacyManualClose ||
      branch.operational_status !== "open" ||
      branch.orders_active !== true;

    return {
      isOpen: true,
      ordersActive: true,
      status: "open",
      closureReason: null,
      closedUntil: null,
      displayText: `🟢 Open (${todaySched.open} - ${todaySched.close})`,
      description: `Store is Open (Operating Hours: ${todaySched.open} - ${todaySched.close})`,
      needsDbSync: needsSync,
      newOperationalStatus: "open",
      newClosedUntil: null,
    };
  }

  // 4. Outside operating hours: store is CLOSED by schedule!
  const dayCap = beirutNow.weekday.charAt(0).toUpperCase() + beirutNow.weekday.slice(1);
  let closedDesc = `Store is Closed (Operating Hours: ${todaySched.open} - ${todaySched.close})`;
  let displayText = `🕒 Closed (Opens ${nextOpen.label})`;

  if (!todaySched.active) {
    displayText = `📅 Closed on ${dayCap}`;
    closedDesc = `Store Closed on ${dayCap} (Opens ${nextOpen.label})`;
  } else if (beirutNow.timeMinutes < todayOpenMin) {
    displayText = `🕒 Closed (Opens today at ${todaySched.open})`;
    closedDesc = `Store is Closed (Opens today at ${todaySched.open})`;
  } else {
    displayText = `🕒 Closed (Opens ${nextOpen.label})`;
    closedDesc = `Store is Closed for the day (Opens ${nextOpen.label})`;
  }

  const needsSync = hadExpiredClosure || (branch.orders_active === true && !isWithinScheduledHours);

  return {
    isOpen: false,
    ordersActive: false,
    status: "closed",
    closureReason: !todaySched.active ? `Closed on ${dayCap}` : "Outside Operating Hours",
    closedUntil: null,
    displayText,
    description: closedDesc,
    needsDbSync: needsSync,
    newOperationalStatus: "open", // Keeps standard auto mode in DB so it opens when opening time arrives
    newClosedUntil: null,
  };
}
