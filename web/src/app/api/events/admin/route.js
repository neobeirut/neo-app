import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

function parseBool(value) {
  if (value === null || value === undefined) return null;
  const v = String(value).toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return null;
}

function safeArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return [];
}

function safeWeekdayArray(value) {
  const allowed = new Set(["SU", "MO", "TU", "WE", "TH", "FR", "SA"]);
  if (!Array.isArray(value)) return [];
  return value
    .map((v) =>
      String(v || "")
        .trim()
        .toUpperCase(),
    )
    .filter((v) => allowed.has(v));
}

export async function GET(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const timing = searchParams.get("timing") || "all"; // upcoming|past|all
    const status = searchParams.get("status") || "all"; // draft|published|cancelled|all
    const search = searchParams.get("search") || "";
    const featuredOnly = parseBool(searchParams.get("featured"));

    const limitRaw = Number.parseInt(searchParams.get("limit") || "50", 10);
    const offsetRaw = Number.parseInt(searchParams.get("offset") || "0", 10);

    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 100)
      : 50;
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

    const whereParts = [];
    const values = [];
    let idx = 1;

    if (status !== "all") {
      whereParts.push(`status = $${idx}::event_status`);
      values.push(status);
      idx += 1;
    }

    if (timing === "past") {
      whereParts.push(`COALESCE(end_at, start_at) < now()`);
    } else if (timing === "upcoming") {
      whereParts.push(`COALESCE(end_at, start_at) >= now()`);
    }

    if (search) {
      whereParts.push(`LOWER(name) LIKE LOWER($${idx})`);
      values.push(`%${search}%`);
      idx += 1;
    }

    if (featuredOnly === true) {
      whereParts.push(`featured = true`);
    }

    const whereSql = whereParts.length
      ? `WHERE ${whereParts.join(" AND ")}`
      : "";

    values.push(limit + 1);
    const limitIdx = idx;
    idx += 1;

    values.push(offset);
    const offsetIdx = idx;

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
      ORDER BY start_at DESC
      LIMIT $${limitIdx}
      OFFSET $${offsetIdx}
    `;

    const rows = await sql(query, values);

    const hasMore = rows.length > limit;
    const events = hasMore ? rows.slice(0, limit) : rows;

    return Response.json({
      events,
      pagination: { limit, offset, has_more: hasMore },
    });
  } catch (error) {
    console.error("[api/events/admin] GET error", error);
    return Response.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const name = body?.name ? String(body.name).trim() : "";
    const coverImage = body?.cover_image ? String(body.cover_image).trim() : "";
    const startAt = body?.start_at ? new Date(body.start_at) : null;
    const endAt = body?.end_at ? new Date(body.end_at) : null;

    if (!name) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }

    if (!coverImage) {
      return Response.json(
        { error: "Cover image is required" },
        { status: 400 },
      );
    }

    if (!startAt || Number.isNaN(startAt.getTime())) {
      return Response.json({ error: "start_at is required" }, { status: 400 });
    }

    const isRecurring = !!body?.is_recurring;
    const recurrenceFrequency = body?.recurrence_frequency
      ? String(body.recurrence_frequency)
      : null;
    const recurrenceIntervalRaw =
      body?.recurrence_interval === null ||
      body?.recurrence_interval === undefined
        ? null
        : Number.parseInt(String(body.recurrence_interval), 10);

    const recurrenceInterval = Number.isFinite(recurrenceIntervalRaw)
      ? Math.max(1, recurrenceIntervalRaw)
      : 1;

    const recurrenceByWeekday = safeWeekdayArray(body?.recurrence_byweekday);

    const recurrenceUntil = body?.recurrence_until
      ? String(body.recurrence_until).slice(0, 10)
      : null;

    if (isRecurring) {
      if (recurrenceFrequency !== "weekly") {
        return Response.json(
          { error: "recurrence_frequency must be 'weekly'" },
          { status: 400 },
        );
      }
      if (!recurrenceByWeekday.length) {
        return Response.json(
          { error: "recurrence_byweekday is required for recurring events" },
          { status: 400 },
        );
      }
    }

    const reservationRequired = !!body?.reservation_required;
    const showInReservationTab = reservationRequired
      ? !!body?.show_in_reservation_tab
      : false;

    const reservationUrl = body?.reservation_url
      ? String(body.reservation_url).trim()
      : null;
    const reservationPhone = body?.reservation_phone
      ? String(body.reservation_phone).trim()
      : null;

    // Only require link/phone when the event is actually shown in the reservation tab
    if (
      reservationRequired &&
      showInReservationTab &&
      !reservationUrl &&
      !reservationPhone
    ) {
      return Response.json(
        { error: "Reservation requires reservation_url or reservation_phone" },
        { status: 400 },
      );
    }

    const images = safeArray(body?.images);
    const recapImages = safeArray(body?.recap_images);
    const recapVideos = safeArray(body?.recap_videos);

    const status = body?.status ? String(body.status) : "draft";
    const featured = !!body?.featured;

    const price =
      body?.price === "" || body?.price === null || body?.price === undefined
        ? null
        : Number(body.price);
    const currency = body?.currency ? String(body.currency).trim() : null;
    const capacity =
      body?.capacity === "" ||
      body?.capacity === null ||
      body?.capacity === undefined
        ? null
        : Number.parseInt(String(body.capacity), 10);

    const [created] = await sql`
      INSERT INTO events (
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
        is_recurring,
        recurrence_frequency,
        recurrence_interval,
        recurrence_byweekday,
        recurrence_until
      ) VALUES (
        ${name},
        ${body?.description || null},
        ${startAt.toISOString()},
        ${endAt && !Number.isNaN(endAt.getTime()) ? endAt.toISOString() : null},
        ${coverImage},
        ${images},
        ${reservationRequired},
        ${showInReservationTab},
        ${reservationUrl},
        ${reservationPhone},
        ${Number.isFinite(price) ? price : null},
        ${currency},
        ${Number.isFinite(capacity) ? capacity : null},
        ${recapImages},
        ${recapVideos},
        ${body?.recap_caption || null},
        ${status},
        ${featured},
        ${isRecurring},
        ${isRecurring ? recurrenceFrequency : null},
        ${isRecurring ? recurrenceInterval : null},
        ${isRecurring ? recurrenceByWeekday : null},
        ${isRecurring ? recurrenceUntil : null}
      )
      RETURNING id
    `;

    return Response.json({ id: created?.id });
  } catch (error) {
    console.error("[api/events/admin] POST error", error);
    return Response.json({ error: "Failed to create event" }, { status: 500 });
  }
}
