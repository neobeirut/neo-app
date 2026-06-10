import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

function safeArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return null;
}

function safeWeekdayArray(value) {
  const allowed = new Set(["SU", "MO", "TU", "WE", "TH", "FR", "SA"]);
  if (!Array.isArray(value)) return null;
  const arr = value
    .map((v) =>
      String(v || "")
        .trim()
        .toUpperCase(),
    )
    .filter((v) => allowed.has(v));
  return arr;
}

async function getEventByIdAnyStatus(id) {
  const rows = await sql(`SELECT * FROM events WHERE id = $1 LIMIT 1`, [
    String(id),
  ]);
  return rows?.[0] || null;
}

export async function GET(request, { params: { id } }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const event = await getEventByIdAnyStatus(id);
    if (!event) {
      return Response.json({ error: "Event not found" }, { status: 404 });
    }

    return Response.json({ event });
  } catch (error) {
    console.error("[api/events/admin/[id]] GET error", error);
    return Response.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}

export async function PUT(request, { params: { id } }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!id) {
      return Response.json({ error: "Missing id" }, { status: 400 });
    }

    const existing = await getEventByIdAnyStatus(id);
    if (!existing) {
      return Response.json({ error: "Event not found" }, { status: 404 });
    }

    const body = await request.json();

    // Merge for validation
    const next = {
      ...existing,
      ...body,
    };

    const name = next?.name ? String(next.name).trim() : "";
    if (!name) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }

    const coverImage = next?.cover_image ? String(next.cover_image).trim() : "";
    if (!coverImage) {
      return Response.json(
        { error: "Cover image is required" },
        { status: 400 },
      );
    }

    const reservationRequired = !!next?.reservation_required;
    const showInReservationTab = reservationRequired
      ? !!next?.show_in_reservation_tab
      : false;

    const reservationUrl = next?.reservation_url
      ? String(next.reservation_url).trim()
      : null;
    const reservationPhone = next?.reservation_phone
      ? String(next.reservation_phone).trim()
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

    // Recurrence validation (Option B)
    const isRecurring = !!next?.is_recurring;
    const recurrenceFrequency = next?.recurrence_frequency
      ? String(next.recurrence_frequency)
      : null;

    const recurrenceIntervalRaw =
      next?.recurrence_interval === null ||
      next?.recurrence_interval === undefined
        ? null
        : Number.parseInt(String(next.recurrence_interval), 10);

    const recurrenceInterval = Number.isFinite(recurrenceIntervalRaw)
      ? Math.max(1, recurrenceIntervalRaw)
      : 1;

    const recurrenceByWeekday = safeWeekdayArray(next?.recurrence_byweekday);
    const recurrenceUntil = next?.recurrence_until
      ? String(next.recurrence_until).slice(0, 10)
      : null;

    if (isRecurring) {
      if (recurrenceFrequency !== "weekly") {
        return Response.json(
          { error: "recurrence_frequency must be 'weekly'" },
          { status: 400 },
        );
      }
      if (!recurrenceByWeekday || recurrenceByWeekday.length === 0) {
        return Response.json(
          { error: "recurrence_byweekday is required for recurring events" },
          { status: 400 },
        );
      }
    }

    const setParts = [];
    const values = [];
    let idx = 1;

    const assign = (col, val, cast = "") => {
      setParts.push(`${col} = $${idx}${cast}`);
      values.push(val);
      idx += 1;
    };

    // Only update fields present in body
    if ("name" in body) assign("name", name);
    if ("description" in body) assign("description", body.description || null);

    if ("start_at" in body) {
      const d = body.start_at ? new Date(body.start_at) : null;
      if (!d || Number.isNaN(d.getTime())) {
        return Response.json(
          { error: "start_at must be a valid datetime" },
          { status: 400 },
        );
      }
      assign("start_at", d.toISOString());
    }

    if ("end_at" in body) {
      const d = body.end_at ? new Date(body.end_at) : null;
      assign(
        "end_at",
        d && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
      );
    }

    if ("cover_image" in body) assign("cover_image", coverImage);

    if ("images" in body) {
      const arr = safeArray(body.images) || [];
      assign("images", arr, "::text[]");
    }

    if ("reservation_required" in body)
      assign("reservation_required", reservationRequired);

    if ("show_in_reservation_tab" in body) {
      assign("show_in_reservation_tab", showInReservationTab);
    }

    // If reservation was turned off, force it off the reservation tab too.
    if ("reservation_required" in body && reservationRequired === false) {
      assign("show_in_reservation_tab", false);
    }

    if ("reservation_url" in body) assign("reservation_url", reservationUrl);
    if ("reservation_phone" in body)
      assign("reservation_phone", reservationPhone);

    if ("price" in body) {
      const price =
        body.price === "" || body.price === null || body.price === undefined
          ? null
          : Number(body.price);
      assign("price", Number.isFinite(price) ? price : null);
    }

    if ("currency" in body)
      assign("currency", body.currency ? String(body.currency).trim() : null);

    if ("capacity" in body) {
      const cap =
        body.capacity === "" ||
        body.capacity === null ||
        body.capacity === undefined
          ? null
          : Number.parseInt(String(body.capacity), 10);
      assign("capacity", Number.isFinite(cap) ? cap : null);
    }

    if ("recap_images" in body) {
      const arr = safeArray(body.recap_images) || [];
      assign("recap_images", arr, "::text[]");
    }

    if ("recap_videos" in body) {
      const arr = safeArray(body.recap_videos) || [];
      assign("recap_videos", arr, "::text[]");
    }

    if ("recap_caption" in body)
      assign("recap_caption", body.recap_caption || null);

    if ("status" in body) {
      const st = String(body.status || "");
      if (!["draft", "published", "cancelled"].includes(st)) {
        return Response.json({ error: "Invalid status" }, { status: 400 });
      }
      assign("status", st, "::event_status");
    }

    if ("featured" in body) assign("featured", !!body.featured);

    // Recurrence updates
    if ("is_recurring" in body) assign("is_recurring", !!body.is_recurring);

    if ("recurrence_frequency" in body) {
      assign(
        "recurrence_frequency",
        isRecurring
          ? body.recurrence_frequency
            ? String(body.recurrence_frequency)
            : null
          : null,
      );
    }

    if ("recurrence_interval" in body) {
      const raw =
        body.recurrence_interval === null ||
        body.recurrence_interval === undefined
          ? null
          : Number.parseInt(String(body.recurrence_interval), 10);
      const val = Number.isFinite(raw) ? Math.max(1, raw) : null;
      assign("recurrence_interval", isRecurring ? val : null);
    }

    if ("recurrence_byweekday" in body) {
      const arr = safeWeekdayArray(body.recurrence_byweekday);
      assign("recurrence_byweekday", isRecurring ? arr : null, "::text[]");
    }

    if ("recurrence_until" in body) {
      const val = body.recurrence_until
        ? String(body.recurrence_until).slice(0, 10)
        : null;
      assign("recurrence_until", isRecurring ? val : null);
    }

    if (setParts.length === 0) {
      return Response.json({ ok: true, id: String(id) });
    }

    values.push(String(id));
    const idIdx = idx;

    const query = `UPDATE events SET ${setParts.join(", ")} WHERE id = $${idIdx}`;
    await sql(query, values);

    return Response.json({ ok: true, id: String(id) });
  } catch (error) {
    console.error("[api/events/admin/[id]] PUT error", error);
    return Response.json({ error: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(request, { params: { id } }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!id) {
      return Response.json({ error: "Missing id" }, { status: 400 });
    }

    await sql(`DELETE FROM events WHERE id = $1`, [String(id)]);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[api/events/admin/[id]] DELETE error", error);
    return Response.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
