import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import { normalizePhoneE164 } from "@/app/api/utils/phoneNormalizer";

export async function GET(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";
    const search = (searchParams.get("search") || "").trim();
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    // Fetch configurable service window duration in hours (default 24)
    let windowHours = 24;
    try {
      const [setting] = await sql`
        SELECT setting_value FROM app_settings WHERE setting_key = 'whatsapp_service_window_hours' LIMIT 1
      `;
      if (setting?.setting_value) windowHours = parseFloat(setting.setting_value) || 24;
    } catch (e) {}

    // Base query
    let rows = await sql`
      SELECT 
        wc.id,
        wc.phone,
        wc.customer_id,
        wc.contact_id,
        wc.assigned_user_id,
        wc.status,
        wc.last_message,
        wc.last_message_preview,
        wc.last_message_at,
        wc.last_customer_message_at,
        wc.unread_count,
        wc.created_at,
        wc.updated_at,
        con.name as contact_name,
        con.phone_e164 as contact_phone,
        con.email as contact_email,
        con.avatar_url as contact_avatar,
        con.tags as contact_tags,
        con.whatsapp_opt_in,
        u.name as customer_name,
        u.email as customer_email,
        u.phone as customer_phone,
        au.name as assigned_user_name,
        au.email as assigned_user_email,
        (
          wc.last_customer_message_at IS NOT NULL 
          AND wc.last_customer_message_at > now() - (make_interval(hours => ${windowHours}))
        ) as is_window_active
      FROM whatsapp_conversations wc
      LEFT JOIN whatsapp_contacts con ON con.id = wc.contact_id
      LEFT JOIN auth_users u ON u.id = wc.customer_id
      LEFT JOIN admin_users au ON au.id = wc.assigned_user_id
      WHERE (
        -- Search filter
        ${search ? sql`(
          COALESCE(con.name, '') ILIKE ${'%' + search + '%'}
          OR COALESCE(u.name, '') ILIKE ${'%' + search + '%'}
          OR wc.phone ILIKE ${'%' + search + '%'}
          OR COALESCE(con.phone_e164, '') ILIKE ${'%' + search + '%'}
          OR COALESCE(wc.last_message, '') ILIKE ${'%' + search + '%'}
        )` : sql`true`}
      )
      AND (
        -- Category filters
        ${filter === 'unread' ? sql`wc.unread_count > 0` : sql`true`}
      )
      AND (
        ${filter === 'open' ? sql`(wc.status = 'open' OR wc.status IS NULL)` : sql`true`}
      )
      AND (
        ${filter === 'closed' ? sql`wc.status = 'closed'` : sql`true`}
      )
      AND (
        ${filter === 'assigned_to_me' ? sql`wc.assigned_user_id = ${admin.id}` : sql`true`}
      )
      AND (
        ${filter === 'unassigned' ? sql`wc.assigned_user_id IS NULL` : sql`true`}
      )
      ORDER BY wc.last_message_at DESC NULLS LAST, wc.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Total unread count across all conversations
    const [unreadTotalRow] = await sql`
      SELECT COALESCE(SUM(unread_count), 0)::int as total_unread
      FROM whatsapp_conversations
      WHERE status != 'closed' OR status IS NULL
    `;

    return Response.json({
      ok: true,
      conversations: rows.map(r => ({
        ...r,
        displayName: r.contact_name || r.customer_name || r.phone || "Unknown Client",
      })),
      totalUnread: unreadTotalRow?.total_unread || 0,
      windowHours,
    });
  } catch (error) {
    console.error("[whatsapp/conversations GET] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { contactId, phone } = body;

    let targetContactId = contactId;
    let targetPhone = phone;

    if (!targetContactId && !targetPhone) {
      return Response.json({ error: "Contact ID or phone number required" }, { status: 400 });
    }

    if (targetPhone) {
      targetPhone = normalizePhoneE164(targetPhone);
    }

    if (!targetContactId && targetPhone) {
      let [existingContact] = await sql`
        SELECT id FROM whatsapp_contacts WHERE phone_e164 = ${targetPhone} LIMIT 1
      `;
      if (!existingContact) {
        [existingContact] = await sql`
          INSERT INTO whatsapp_contacts (name, phone_e164, whatsapp_opt_in, created_at, updated_at)
          VALUES (${'WhatsApp ' + targetPhone.slice(-4)}, ${targetPhone}, false, now(), now())
          RETURNING id
        `;
      }
      targetContactId = existingContact.id;
    }

    const [contact] = await sql`
      SELECT id, phone_e164, customer_id FROM whatsapp_contacts WHERE id = ${targetContactId} LIMIT 1
    `;

    if (!contact) {
      return Response.json({ error: "Contact not found" }, { status: 404 });
    }

    let [conv] = await sql`
      SELECT * FROM whatsapp_conversations WHERE contact_id = ${contact.id} LIMIT 1
    `;

    if (!conv) {
      const convId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      [conv] = await sql`
        INSERT INTO whatsapp_conversations (
          id, contact_id, phone, customer_id, status, created_at, updated_at
        )
        VALUES (
          ${convId}, ${contact.id}, ${contact.phone_e164}, ${contact.customer_id}, 'open', now(), now()
        )
        RETURNING *
      `;
    }

    return Response.json({ ok: true, conversation: conv });
  } catch (error) {
    console.error("[whatsapp/conversations POST] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
