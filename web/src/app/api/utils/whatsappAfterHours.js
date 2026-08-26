import sql from "./sql.js";

/**
 * Exact closed auto-response message for OVRLOAD
 */
export const CLOSED_AUTO_RESPONSE_TEXT = `Thanks for reaching out to OVRLOAD! 🌯
We’re currently closed.

Our opening hours are Monday to Saturday, from 12:00 PM until 11:00 PM.
We are closed on Sundays.

Your message has been received and we’ll get back to you when we reopen.

You can browse our menu anytime here:
https://ovrload-nine.vercel.app/

See you soon! 🧡`;

/**
 * Format and normalize phone numbers for Infobip API (digits only, no "+" prefix)
 */
export function normalizePhoneForInfobip(phone) {
  if (!phone) return "";
  let trimmed = String(phone).replace(/\s+/g, "").trim();
  if (trimmed.startsWith("+")) {
    trimmed = trimmed.slice(1);
  }
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  // Local Lebanese format: 03123456 or 70123456 -> 961...
  if (digits.startsWith("0") && digits.length === 8) {
    return "961" + digits.slice(1);
  }
  if ((digits.length === 7 || digits.length === 8) && !digits.startsWith("961")) {
    return "961" + digits;
  }
  return digits;
}

/**
 * Extract time and calendar details in Asia/Beirut timezone.
 * Handles daylight saving time correctly via Intl.DateTimeFormat.
 */
export function getBeirutTimeInfo(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Beirut",
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type) => parts.find((p) => p.type === type)?.value;

  const weekday = getPart("weekday"); // "Monday", "Tuesday", ..., "Sunday"
  const year = parseInt(getPart("year"), 10);
  const month = parseInt(getPart("month"), 10);
  const day = parseInt(getPart("day"), 10);
  const hour = parseInt(getPart("hour"), 10);
  const minute = parseInt(getPart("minute"), 10);
  const second = parseInt(getPart("second"), 10);

  // Business logic:
  // Monday-Saturday: 12:00 PM (12:00) until 11:00 PM (23:00) is OPEN
  // Sunday: CLOSED all day
  // Closed when: Sunday OR hour >= 23 OR hour < 12
  const isNormallyClosed = weekday === "Sunday" || hour >= 23 || hour < 12;

  // Calculate closed period identifier:
  // The closed period is uniquely identified by the next reopening time (12:00 PM Beirut).
  const beirutCalendarDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  let daysUntilReopen = 0;

  if (weekday === "Saturday" && hour >= 23) {
    daysUntilReopen = 2; // Saturday night -> Monday noon
  } else if (weekday === "Sunday") {
    daysUntilReopen = 1; // Sunday anytime -> Monday noon
  } else if (hour >= 23) {
    daysUntilReopen = (weekday === "Friday") ? 1 : 1; // Mon-Fri night -> next day noon
  } else if (hour < 12) {
    daysUntilReopen = 0; // Mon-Sat morning -> today noon
  } else {
    // Open hours fallback (e.g. when force-closed during day)
    daysUntilReopen = (weekday === "Saturday") ? 2 : 1;
  }

  const reopenDate = new Date(beirutCalendarDate.getTime() + daysUntilReopen * 86400000);
  const reopenYear = reopenDate.getUTCFullYear();
  const reopenMonth = String(reopenDate.getUTCMonth() + 1).padStart(2, "0");
  const reopenDay = String(reopenDate.getUTCDate()).padStart(2, "0");
  const periodId = `closed_until_${reopenYear}-${reopenMonth}-${reopenDay}_12:00`;

  return {
    weekday,
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateString: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    timeString: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`,
    formatted: `${weekday}, ${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")} (Asia/Beirut)`,
    isNormallyClosed,
    periodId,
  };
}

/**
 * Determine if OVRLOAD is closed, supporting testing mode (WHATSAPP_FORCE_CLOSED).
 */
export function isOverloadClosed(date = new Date()) {
  const forceClosedEnv = (process.env.WHATSAPP_FORCE_CLOSED || "").trim().toLowerCase();
  const isForceClosed = forceClosedEnv === "true" || forceClosedEnv === "1";

  const beirutInfo = getBeirutTimeInfo(date);
  const isClosed = isForceClosed || beirutInfo.isNormallyClosed;

  return {
    isClosed,
    isForceClosed,
    beirutInfo,
  };
}

// In-memory cache for fast and resilient duplicate prevention across process lifespan
const inMemorySentReplies = new Set();

let tableChecked = false;

/**
 * Ensure the persistent tracking table exists in PostgreSQL
 */
async function ensureAutoReplyTable() {
  if (tableChecked || !process.env.DATABASE_URL) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS whatsapp_auto_replies (
        phone VARCHAR(64) NOT NULL,
        period_id VARCHAR(64) NOT NULL,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (phone, period_id)
      )
    `;
    tableChecked = true;
  } catch (err) {
    console.warn("[whatsapp-after-hours] Could not ensure whatsapp_auto_replies table:", err.message);
  }
}

/**
 * Check if an auto-reply has already been sent to this phone number during the given closed period.
 */
export async function hasAutoReplyBeenSent(phone, periodId) {
  const normalizedPhone = normalizePhoneForInfobip(phone);
  const key = `${normalizedPhone}:${periodId}`;

  if (inMemorySentReplies.has(key)) {
    return true;
  }

  if (process.env.DATABASE_URL) {
    try {
      await ensureAutoReplyTable();
      const rows = await sql`
        SELECT 1 FROM whatsapp_auto_replies
        WHERE phone = ${normalizedPhone} AND period_id = ${periodId}
        LIMIT 1
      `;
      if (rows && rows.length > 0) {
        inMemorySentReplies.add(key);
        return true;
      }
    } catch (err) {
      console.warn("[whatsapp-after-hours] Database check failed, using memory state:", err.message);
    }
  }

  return false;
}

/**
 * Record that an auto-reply was sent to this phone number for this closed period.
 */
export async function recordAutoReplySent(phone, periodId) {
  const normalizedPhone = normalizePhoneForInfobip(phone);
  const key = `${normalizedPhone}:${periodId}`;
  inMemorySentReplies.add(key);

  if (process.env.DATABASE_URL) {
    try {
      await ensureAutoReplyTable();
      await sql`
        INSERT INTO whatsapp_auto_replies (phone, period_id, sent_at)
        VALUES (${normalizedPhone}, ${periodId}, now())
        ON CONFLICT (phone, period_id) DO NOTHING
      `;
    } catch (err) {
      console.warn("[whatsapp-after-hours] Failed to record sent auto-reply in DB:", err.message);
    }
  }
}

/**
 * Send the closed auto-response WhatsApp message via Infobip API.
 */
export async function sendClosedAutoReply(toPhone) {
  const apiKey = process.env.INFOBIP_API_KEY;
  const baseUrl = (process.env.INFOBIP_BASE_URL || "").trim().replace(/\/$/, "");
  const senderEnv = process.env.INFOBIP_WHATSAPP_SENDER || "96181202607";
  const fromSender = normalizePhoneForInfobip(senderEnv) || "96181202607";
  const recipient = normalizePhoneForInfobip(toPhone);

  if (!recipient) {
    throw new Error("Cannot send WhatsApp message without a valid recipient phone number");
  }

  if (!apiKey || !baseUrl) {
    console.warn("[whatsapp-after-hours] INFOBIP_API_KEY or INFOBIP_BASE_URL is not configured.");
    return {
      ok: false,
      skipped: true,
      reason: "Infobip credentials not configured in environment",
    };
  }

  const endpointUrl = `${baseUrl}/whatsapp/1/message/text`;

  const payload = {
    from: fromSender,
    to: recipient,
    content: {
      text: CLOSED_AUTO_RESPONSE_TEXT,
    },
  };

  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: {
      "Authorization": `App ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch (e) {
    responseData = { raw: responseText };
  }

  if (!response.ok) {
    const safeError = typeof responseData === "object" ? JSON.stringify(responseData) : responseText;
    console.error(`[whatsapp-after-hours] Infobip outbound API error HTTP ${response.status}: ${safeError}`);
    throw new Error(`Infobip API error (HTTP ${response.status})`);
  }

  const messageId = responseData?.messageId || responseData?.messages?.[0]?.messageId || null;
  console.log(`[whatsapp-after-hours] Infobip outbound API success. Message ID: ${messageId || "N/A"}`);

  // Optionally log message into customer_whatsapp_messages for dashboard/audit trail
  if (process.env.DATABASE_URL) {
    try {
      await sql`
        INSERT INTO customer_whatsapp_messages (
          user_id, order_id, phone, direction, message_type,
          message_text, bird_message_id, status, created_at
        )
        VALUES (
          NULL, NULL, ${recipient}, 'outbound', 'auto_reply_closed',
          ${CLOSED_AUTO_RESPONSE_TEXT}, ${messageId}, 'sent', now()
        )
      `.catch(() => {});
    } catch (e) {}
  }

  return {
    ok: true,
    messageId,
    data: responseData,
  };
}
