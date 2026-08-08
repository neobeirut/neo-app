import sql from "@/app/api/utils/sql";
import {
  generateWeeklyOccurrences,
  normalizeEventListItem,
} from "@/app/api/utils/eventRecurrence";

function parseBool(value) {
  if (value === null || value === undefined) return null;
  const v = String(value).toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return null;
}

function isPastByTimes(startAtIso, endAtIso) {
  try {
    const start = startAtIso ? new Date(startAtIso) : null;
    const end = endAtIso ? new Date(endAtIso) : null;
    const compare = end && !Number.isNaN(end.getTime()) ? end : start;
    if (!compare || Number.isNaN(compare.getTime())) return false;
    return compare.getTime() < Date.now();
  } catch (e) {
    return false;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const tab = searchParams.get("tab") || "upcoming"; // upcoming | past
    const search = searchParams.get("search") || "";
    const reservationRequired = parseBool(
      searchParams.get("reservation_required"),
    );
    const featuredOnly = parseBool(searchParams.get("featured"));

    const limitRaw = Number.parseInt(searchParams.get("limit") || "20", 10);
    const offsetRaw = Number.parseInt(searchParams.get("offset") || "0", 10);

    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 50)
      : 20;
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

    // Public visibility: ONLY published (draft + cancelled are hidden)
    const statusList = ["published"];

    // We filter by attributes in SQL, then handle timing + recurrence in JS.
    const whereParts = [];
    const values = [];
    let idx = 1;

    whereParts.push(`status = ANY($${idx}::event_status[])`);
    values.push(statusList);
    idx += 1;

    if (search) {
      whereParts.push(`LOWER(name) LIKE LOWER($${idx})`);
      values.push(`%${search}%`);
      idx += 1;
    }

    if (reservationRequired !== null) {
      whereParts.push(`reservation_required = $${idx}`);
      values.push(reservationRequired);
      idx += 1;

      if (reservationRequired === true) {
        whereParts.push(`show_in_reservation_tab = true`);
      }
    }

    if (featuredOnly === true) {
      whereParts.push(`featured = true`);
    }

    const whereSql = whereParts.length
      ? `WHERE ${whereParts.join(" AND ")}`
      : "";

    const query = `
      SELECT
        id,
        name,
        description,
        start_at,
        end_at,
        cover_image,
        images,
        reservation_required,
        show_in_reservation_tab,
        reservation_url,
        reservation_phone,
        price,
        currency,
        capacity,
        recap_images,
        recap_videos,
        recap_caption,
        status,
        featured,
        created_at,
        updated_at,
        COALESCE(array_length(recap_images, 1), 0) as recap_images_count,
        COALESCE(array_length(recap_videos, 1), 0) as recap_videos_count,
        is_recurring,
        recurrence_frequency,
        recurrence_interval,
        recurrence_byweekday,
        recurrence_until
      FROM events
      ${whereSql}
      ORDER BY start_at ASC
    `;

    const rows = await sql(query, values);

    const now = new Date();
    const rangeStart =
      tab === "past"
        ? new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        : now;
    const rangeEnd =
      tab === "past" ? now : new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Pull any per-occurrence overrides for recurring events within the range
    const recurringIds = rows
      .filter((r) => r?.is_recurring)
      .map((r) => String(r.id));

    let overridesByKey = new Map();
    if (recurringIds.length) {
      const overrides = await sql(
        `
        SELECT event_id, start_at, end_at, status
        FROM event_occurrences
        WHERE event_id = ANY($1::uuid[])
          AND start_at >= $2
          AND start_at <= $3
        `,
        [recurringIds, rangeStart.toISOString(), rangeEnd.toISOString()],
      );

      overridesByKey = new Map(
        overrides.map((o) => [`${o.event_id}_${o.start_at}`, o]),
      );
    }

    const expanded = [];

    for (const ev of rows) {
      const isRecurring = !!ev?.is_recurring;

      if (!isRecurring) {
        const past = isPastByTimes(ev?.start_at, ev?.end_at);
        if (tab === "past" ? past : !past) {
          expanded.push(
            normalizeEventListItem({
              event: ev,
              occurrence: null,
              override: null,
            }),
          );
        }
        continue;
      }

      // Currently we support weekly recurrence.
      if (String(ev?.recurrence_frequency || "") !== "weekly") {
        continue;
      }

      const occurrences = generateWeeklyOccurrences({
        event: ev,
        rangeStart,
        rangeEnd,
      });

      for (const occ of occurrences) {
        const override = overridesByKey.get(`${ev.id}_${occ.start_at}`) || null;
        const item = normalizeEventListItem({
          event: ev,
          occurrence: occ,
          override,
        });

        const past = isPastByTimes(item?.start_at, item?.end_at);
        if (tab === "past" ? past : !past) {
          expanded.push(item);
        }
      }
    }

    const orderAsc = tab !== "past";
    expanded.sort((a, b) => {
      const at = a?.start_at ? new Date(a.start_at).getTime() : 0;
      const bt = b?.start_at ? new Date(b.start_at).getTime() : 0;
      return orderAsc ? at - bt : bt - at;
    });

    const slice = expanded.slice(offset, offset + limit + 1);
    const hasMore = slice.length > limit;
    const events = hasMore ? slice.slice(0, limit) : slice;

    return Response.json({
      events,
      pagination: { limit, offset, has_more: hasMore },
    });
  } catch (error) {
    console.error("[api/events] GET error", error);
    return Response.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}
