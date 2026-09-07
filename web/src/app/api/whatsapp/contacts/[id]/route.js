import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import { normalizePhoneE164, isValidE164 } from "@/app/api/utils/phoneNormalizer";

export async function GET(request, { params }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    const [contact] = await sql`
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
      WHERE con.id = ${id}
      LIMIT 1
    `;

    if (!contact) return Response.json({ error: "Contact not found" }, { status: 404 });
    return Response.json({ ok: true, contact });
  } catch (error) {
    console.error("[whatsapp/contacts/[id] GET] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { name, phone, email, notes, tags, whatsapp_opt_in, whatsapp_opt_in_source } = body;

    let normalizedPhone = undefined;
    if (phone) {
      normalizedPhone = normalizePhoneE164(phone);
      if (!isValidE164(normalizedPhone)) {
        return Response.json({ error: "Invalid phone number format" }, { status: 400 });
      }

      // Check duplicate phone if changing
      const [existing] = await sql`
        SELECT id FROM whatsapp_contacts WHERE phone_e164 = ${normalizedPhone} AND id != ${id} LIMIT 1
      `;
      if (existing) {
        return Response.json({ error: "Another contact already has this phone number" }, { status: 409 });
      }
    }

    const optInAt = whatsapp_opt_in === true ? new Date() : (whatsapp_opt_in === false ? null : undefined);

    const [updated] = await sql`
      UPDATE whatsapp_contacts
      SET 
        name = COALESCE(${name !== undefined ? name : null}, name),
        phone_e164 = COALESCE(${normalizedPhone || null}, phone_e164),
        email = COALESCE(${email !== undefined ? email : null}, email),
        notes = COALESCE(${notes !== undefined ? notes : null}, notes),
        tags = COALESCE(${tags !== undefined ? tags : null}, tags),
        whatsapp_opt_in = COALESCE(${whatsapp_opt_in !== undefined ? whatsapp_opt_in : null}, whatsapp_opt_in),
        whatsapp_opt_in_at = COALESCE(${optInAt !== undefined ? optInAt : null}, whatsapp_opt_in_at),
        whatsapp_opt_in_source = COALESCE(${whatsapp_opt_in_source !== undefined ? whatsapp_opt_in_source : null}, whatsapp_opt_in_source),
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!updated) return Response.json({ error: "Contact not found" }, { status: 404 });

    await sql`
      INSERT INTO whatsapp_audit_logs (admin_user_id, action, entity_type, entity_id, details, created_at)
      VALUES (${admin.id}, 'contact.updated', 'contact', ${id}, ${JSON.stringify(body)}, now())
    `;

    return Response.json({ ok: true, contact: updated });
  } catch (error) {
    console.error("[whatsapp/contacts/[id] PATCH] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
