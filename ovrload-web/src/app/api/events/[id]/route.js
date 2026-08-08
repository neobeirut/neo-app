import sql from "@/app/api/utils/sql";
import {
  generateWeeklyOccurrences,
  normalizeEventListItem,
} from "@/app/api/utils/eventRecurrence";

export async function GET(request, { params: { id } }) {
  try {
    if (!id) {
      return Response.json({ error: "Missing id" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const occurrenceStartAt = searchParams.get("occurrence_start_at");

    const rows = await sql(
      `
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
      WHERE id = $1
        AND status = ANY($2::event_status[])
      LIMIT 1
      `,
      [String(id), ["published"]],
    );

    const baseEvent = rows?.[0] || null;
    if (!baseEvent) {
      return Response.json({ error: "Event not found" }, { status: 404 });
    }

    // If no occurrence requested, behave like before.
    if (!occurrenceStartAt) {
      return Response.json({
        event: normalizeEventListItem({
          event: baseEvent,
          occurrence: null,
          override: null,
        }),
      });
    }

    const requested = new Date(occurrenceStartAt);
    if (Number.isNaN(requested.getTime())) {
      return Response.json(
        { error: "occurrence_start_at must be a valid ISO datetime" },
        { status: 400 },
      );
    }

    // For recurring events, we return the specific instance.
    if (!baseEvent?.is_recurring) {
      // Non-recurring: just return base (ignoring occurrence param).
      return Response.json({
        event: normalizeEventListItem({
          event: baseEvent,
          occurrence: null,
          override: null,
        }),
      });
    }

    if (String(baseEvent?.recurrence_frequency || "") !== "weekly") {
      return Response.json(
        { error: "This recurring event type is not supported yet" },
        { status: 400 },
      );
    }

    // Generate only around the requested day to validate + compute end_at.
    const dayStart = new Date(requested.getTime() - 2 * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(requested.getTime() + 2 * 24 * 60 * 60 * 1000);

    const occurrences = generateWeeklyOccurrences({
      event: baseEvent,
      rangeStart: dayStart,
      rangeEnd: dayEnd,
    });

    const match = occurrences.find(
      (o) => o.start_at === requested.toISOString(),
    );

    // If there is no generated match, allow an explicit override row to define it.
    const [overrideRow] = await sql(
      `
      SELECT event_id, start_at, end_at, status
      FROM event_occurrences
      WHERE event_id = $1
        AND start_at = $2
      LIMIT 1
      `,
      [String(baseEvent.id), requested.toISOString()],
    );

    const override = overrideRow || null;

    if (!match && !override) {
      return Response.json(
        { error: "That event occurrence does not exist" },
        { status: 404 },
      );
    }

    const event = normalizeEventListItem({
      event: baseEvent,
      occurrence: match || { start_at: requested.toISOString(), end_at: null },
      override,
    });

    return Response.json({ event });
  } catch (error) {
    console.error("[api/events/[id]] GET error", error);
    return Response.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}
