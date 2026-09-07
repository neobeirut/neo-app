import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import { normalizePhoneE164, isValidE164 } from "@/app/api/utils/phoneNormalizer";

export async function GET(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const optIn = searchParams.get("opt_in"); // 'true', 'false', or null
    const category = (searchParams.get("category") || "").trim();
    const tag = (searchParams.get("tag") || "").trim();
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    const contacts = await sql`
      SELECT 
        con.*,
        u.name as customer_name,
        u.email as customer_email,
        u.membership_tier as customer_tier,
        u.total_spent as customer_total_spent,
        wc.id as conversation_id,
        wc.status as conversation_status,
        wc.last_message_at,
        wc.unread_count
      FROM whatsapp_contacts con
      LEFT JOIN auth_users u ON u.id = con.customer_id
      LEFT JOIN whatsapp_conversations wc ON wc.contact_id = con.id
      WHERE (
        ${search ? sql`(
          con.name ILIKE ${'%' + search + '%'}
          OR con.phone_e164 ILIKE ${'%' + search + '%'}
          OR COALESCE(con.email, '') ILIKE ${'%' + search + '%'}
        )` : sql`true`}
      )
      AND (
        ${optIn === 'true' ? sql`con.whatsapp_opt_in = true` : 
          optIn === 'false' ? sql`(con.whatsapp_opt_in = false OR con.whatsapp_opt_in IS NULL)` : sql`true`}
      )
      AND (
        ${category && category !== 'all' ? sql`con.category = ${category}` : sql`true`}
      )
      AND (
        ${tag ? sql`${tag} = ANY(con.tags)` : sql`true`}
      )
      ORDER BY con.updated_at DESC, con.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [totalRow] = await sql`
      SELECT COUNT(*)::int as total FROM whatsapp_contacts
      WHERE (
        ${search ? sql`(
          name ILIKE ${'%' + search + '%'}
          OR phone_e164 ILIKE ${'%' + search + '%'}
          OR COALESCE(email, '') ILIKE ${'%' + search + '%'}
        )` : sql`true`}
      )
      AND (
        ${optIn === 'true' ? sql`whatsapp_opt_in = true` : 
          optIn === 'false' ? sql`(whatsapp_opt_in = false OR whatsapp_opt_in IS NULL)` : sql`true`}
      )
      AND (
        ${category && category !== 'all' ? sql`category = ${category}` : sql`true`}
      )
      AND (
        ${tag ? sql`${tag} = ANY(tags)` : sql`true`}
      )
    `;

    const categoriesRows = await sql`
      SELECT DISTINCT category FROM whatsapp_contacts WHERE category IS NOT NULL AND category != '' ORDER BY category ASC
    `;

    return Response.json({
      ok: true,
      contacts,
      total: totalRow?.total || 0,
      categories: categoriesRows.map((r) => r.category),
      limit,
      offset,
    });
  } catch (error) {
    console.error("[whatsapp/contacts GET] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { name, phone, email, category = "General", notes, tags = [], whatsapp_opt_in = false, opt_in_source = "manual" } = body;

    if (!phone) {
      return Response.json({ error: "Phone number is required" }, { status: 400 });
    }

    const normalizedPhone = normalizePhoneE164(phone);
    if (!isValidE164(normalizedPhone)) {
      return Response.json({ error: "Invalid phone number format. International E.164 required." }, { status: 400 });
    }

    // Check duplicate phone
    const [existing] = await sql`
      SELECT id, name, phone_e164 FROM whatsapp_contacts WHERE phone_e164 = ${normalizedPhone} LIMIT 1
    `;
    if (existing) {
      return Response.json({
        ok: false,
        error: `A contact with phone ${normalizedPhone} already exists (${existing.name || 'Unnamed'}).`,
        contactId: existing.id,
      }, { status: 409 });
    }

    // Attempt to match existing customer in auth_users
    const digitsOnly = normalizedPhone.replace(/\D/g, "");
    const [linkedUser] = await sql`
      SELECT id, name, email FROM auth_users
      WHERE REPLACE(REPLACE(phone, ' ', ''), '+', '') LIKE '%' || ${digitsOnly.slice(-8)}
         OR phone = ${normalizedPhone}
      LIMIT 1
    `;

    const finalName = (name || "").trim() || linkedUser?.name || `WhatsApp ${normalizedPhone.slice(-4)}`;
    const finalEmail = (email || "").trim() || linkedUser?.email || null;
    const finalCategory = (category || "").trim() || "General";
    const customerId = linkedUser?.id || null;
    const optInAt = whatsapp_opt_in ? new Date() : null;

    const [newContact] = await sql`
      INSERT INTO whatsapp_contacts (
        name, phone_e164, email, category, notes, tags, customer_id,
        whatsapp_opt_in, whatsapp_opt_in_at, whatsapp_opt_in_source, created_at, updated_at
      )
      VALUES (
        ${finalName}, ${normalizedPhone}, ${finalEmail}, ${finalCategory}, ${notes || null}, ${tags}, ${customerId},
        ${Boolean(whatsapp_opt_in)}, ${optInAt}, ${opt_in_source}, now(), now()
      )
      RETURNING *
    `;

    await sql`
      INSERT INTO whatsapp_audit_logs (admin_user_id, action, entity_type, entity_id, details, created_at)
      VALUES (${admin.id}, 'contact.created', 'contact', ${newContact.id}, ${JSON.stringify({ name: finalName, phone: normalizedPhone, category: finalCategory })}, now())
    `;

    return Response.json({ ok: true, contact: newContact }, { status: 201 });
  } catch (error) {
    console.error("[whatsapp/contacts POST] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
