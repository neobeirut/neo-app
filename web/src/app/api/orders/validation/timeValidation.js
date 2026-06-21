import { corsJson } from "@/app/api/utils/cors";
import sql from "@/app/api/utils/sql";

/**
 * Convert time string (HH:MM or HH:MM:SS) to minutes since midnight
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 60 + minutes;
}

/**
 * Get current date, hours, and minutes in Beirut timezone
 */
function getBeirutDateTime() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Beirut",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const partMap = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  // YYYY-MM-DD
  const dateString = `${partMap.year}-${partMap.month}-${partMap.day}`;
  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);

  return { dateString, hour, minute };
}

/**
 * Get current time in minutes since midnight (Beirut timezone)
 */
function getCurrentTimeInMinutes() {
  const beirut = getBeirutDateTime();
  return beirut.hour * 60 + beirut.minute;
}

/**
 * Get today's date in YYYY-MM-DD format (Beirut timezone)
 */
function getTodayDateString() {
  const beirut = getBeirutDateTime();
  return beirut.dateString;
}

/**
 * Validate that the scheduled time is valid for the branch and hasn't passed
 */
export async function validateScheduledTime({
  request,
  scheduled_date,
  scheduled_time,
  order_type,
  branch_id,
}) {
  try {
    // Get branch operational hours
    const [branch] = await sql`
      SELECT 
        delivery_start_time,
        delivery_end_time,
        opening_time,
        closing_time
      FROM branches
      WHERE id = ${branch_id}
      LIMIT 1
    `;

    if (!branch) {
      return {
        ok: false,
        response: corsJson(
          request,
          { error: "Branch not found" },
          { status: 404 },
        ),
      };
    }

    // Determine which time window to use based on order type
    const windowStart =
      order_type === "delivery"
        ? branch.delivery_start_time
        : branch.opening_time;
    const windowEnd =
      order_type === "delivery"
        ? branch.delivery_end_time
        : branch.closing_time;

    if (!windowStart || !windowEnd || !scheduled_time) {
      // If hours not configured, allow the order (fallback)
      return { ok: true };
    }

    const timeMinutes = timeToMinutes(scheduled_time);
    const startMinutes = timeToMinutes(windowStart);
    const endMinutes = timeToMinutes(windowEnd);

    if (timeMinutes === null || startMinutes === null || endMinutes === null) {
      return { ok: true };
    }

    // Check if time is within operational window
    const inWindow = timeMinutes >= startMinutes && timeMinutes < endMinutes;

    if (!inWindow) {
      const windowText = `${windowStart} - ${windowEnd}`;
      return {
        ok: false,
        response: corsJson(
          request,
          {
            error: `${order_type === "delivery" ? "Delivery" : "Pickup"} is only available during ${windowText}`,
            code: "TIME_OUTSIDE_OPERATIONAL_HOURS",
          },
          { status: 400 },
        ),
      };
    }

    // For today's orders, check if the time hasn't passed yet
    const isToday = scheduled_date === getTodayDateString();
    if (isToday) {
      const currentMinutes = getCurrentTimeInMinutes();
      // Require at least 30 minutes from now to prepare the order
      if (timeMinutes <= currentMinutes + 30) {
        return {
          ok: false,
          response: corsJson(
            request,
            {
              error:
                "This time has already passed or is too soon. Please select a time at least 30 minutes from now.",
              code: "TIME_IN_PAST",
            },
            { status: 400 },
          ),
        };
      }
    }

    return { ok: true };
  } catch (error) {
    console.error("[validateScheduledTime] Error:", error);
    return {
      ok: false,
      response: corsJson(
        request,
        { error: "Failed to validate scheduled time" },
        { status: 500 },
      ),
    };
  }
}
