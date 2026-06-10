/**
 * Time window helpers for generating time slots based on branch operational hours
 */

/**
 * Convert time string (HH:MM or HH:MM:SS) to minutes since midnight
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to HH:MM format
 */
export function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * Get current time in minutes since midnight (local timezone)
 */
export function getCurrentTimeInMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Generate time slots for a given time window
 * @param {string} startTime - Start time in HH:MM format
 * @param {string} endTime - End time in HH:MM format
 * @param {number} intervalMinutes - Interval between slots (default 30)
 * @param {string} selectedDate - The date being scheduled (YYYY-MM-DD)
 * @returns {Array<{label: string, value: string}>}
 */
export function generateTimeSlots(
  startTime,
  endTime,
  intervalMinutes = 30,
  selectedDate = null,
) {
  if (!startTime || !endTime) {
    // Fallback to default time slots if branch hours not set
    return getDefaultTimeSlots(selectedDate);
  }

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (
    startMinutes === null ||
    endMinutes === null ||
    startMinutes >= endMinutes
  ) {
    return getDefaultTimeSlots(selectedDate);
  }

  // Check if ordering for today - if so, start from current time + buffer
  const isToday = selectedDate === getTodayDateString();
  const currentMinutes = isToday ? getCurrentTimeInMinutes() : null;

  // For today's orders, adjust the start time to be current time + 30 min buffer
  // Round up to the next interval slot
  let effectiveStartMinutes = startMinutes;
  if (isToday && currentMinutes !== null) {
    const minStartTime = currentMinutes + 30; // 30-minute buffer

    // If the earliest available time is past the branch opening time,
    // round up to the next interval slot
    if (minStartTime > startMinutes) {
      effectiveStartMinutes =
        Math.ceil(minStartTime / intervalMinutes) * intervalMinutes;
    }
  }

  const slots = [];

  for (
    let minutes = effectiveStartMinutes;
    minutes < endMinutes;
    minutes += intervalMinutes
  ) {
    const timeValue = minutesToTime(minutes);
    slots.push({
      label: formatTimeLabel(timeValue),
      value: timeValue,
    });
  }

  return slots;
}

/**
 * Format time string for display (convert 24h to 12h format)
 */
function formatTimeLabel(timeStr) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

/**
 * Default time slots fallback (9 AM to 9 PM)
 * @param {string} selectedDate - The date being scheduled (YYYY-MM-DD)
 */
function getDefaultTimeSlots(selectedDate = null) {
  const allSlots = [
    { label: "9:00 AM", value: "09:00" },
    { label: "9:30 AM", value: "09:30" },
    { label: "10:00 AM", value: "10:00" },
    { label: "10:30 AM", value: "10:30" },
    { label: "11:00 AM", value: "11:00" },
    { label: "11:30 AM", value: "11:30" },
    { label: "12:00 PM", value: "12:00" },
    { label: "12:30 PM", value: "12:30" },
    { label: "1:00 PM", value: "13:00" },
    { label: "1:30 PM", value: "13:30" },
    { label: "2:00 PM", value: "14:00" },
    { label: "2:30 PM", value: "14:30" },
    { label: "3:00 PM", value: "15:00" },
    { label: "3:30 PM", value: "15:30" },
    { label: "4:00 PM", value: "16:00" },
    { label: "4:30 PM", value: "16:30" },
    { label: "5:00 PM", value: "17:00" },
    { label: "5:30 PM", value: "17:30" },
    { label: "6:00 PM", value: "18:00" },
    { label: "6:30 PM", value: "18:30" },
    { label: "7:00 PM", value: "19:00" },
    { label: "7:30 PM", value: "19:30" },
    { label: "8:00 PM", value: "20:00" },
    { label: "8:30 PM", value: "20:30" },
  ];

  // Filter out past times for today
  const isToday = selectedDate === getTodayDateString();
  if (!isToday) {
    return allSlots;
  }

  const currentMinutes = getCurrentTimeInMinutes();
  return allSlots.filter((slot) => {
    const slotMinutes = timeToMinutes(slot.value);
    // Add 30-minute buffer
    return slotMinutes > currentMinutes + 30;
  });
}

/**
 * Get appropriate time slots based on order type and branch hours
 * @param {string} orderType - 'delivery' or 'pickup'
 * @param {object} branch - Branch object with operational hours
 * @param {string} selectedDate - The date being scheduled (YYYY-MM-DD)
 * @returns {Array<{label: string, value: string}>}
 */
export function getTimeSlotsByOrderType(
  orderType,
  branch,
  selectedDate = null,
) {
  if (!branch) {
    return getDefaultTimeSlots(selectedDate);
  }

  if (orderType === "delivery") {
    return generateTimeSlots(
      branch.delivery_start_time,
      branch.delivery_end_time,
      30,
      selectedDate,
    );
  } else {
    // pickup
    return generateTimeSlots(
      branch.opening_time,
      branch.closing_time,
      30,
      selectedDate,
    );
  }
}

/**
 * Check if a time is within a time window AND not in the past for today's orders
 * @param {string} time - Time to check (HH:MM)
 * @param {string} windowStart - Window start time (HH:MM)
 * @param {string} windowEnd - Window end time (HH:MM)
 * @param {string} selectedDate - The scheduled date (YYYY-MM-DD)
 * @returns {boolean}
 */
export function isTimeInWindow(
  time,
  windowStart,
  windowEnd,
  selectedDate = null,
) {
  if (!time || !windowStart || !windowEnd) return true; // Allow if not configured

  const timeMinutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(windowStart);
  const endMinutes = timeToMinutes(windowEnd);

  if (timeMinutes === null || startMinutes === null || endMinutes === null) {
    return true;
  }

  // Check if time is within the operational window
  const inWindow = timeMinutes >= startMinutes && timeMinutes < endMinutes;

  if (!inWindow) {
    return false;
  }

  // For today's orders, also check if the time hasn't passed yet
  const isToday = selectedDate === getTodayDateString();
  if (isToday) {
    const currentMinutes = getCurrentTimeInMinutes();
    // Require at least 30 minutes from now
    return timeMinutes > currentMinutes + 30;
  }

  return true;
}
