import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import { sendInfobipTemplateMessage } from "@/app/api/utils/infobipService";
import { normalizePhoneE164 } from "@/app/api/utils/phoneNormalizer";

// Batch sending background worker helper
async function processCampaignBatch(campaignId, adminId) {
  try {
    const [campaign] = await sql`SELECT * FROM whatsapp_campaigns WHERE id = ${campaignId} LIMIT 1`;
    if (!campaign || campaign.status === 'cancelled') return;

    await sql`UPDATE whatsapp_campaigns SET status = 'running', started_at = now(), updated_at = now() WHERE id = ${campaignId}`;

    // Fetch batch size setting
    let batchSize = 25;
    let delayMs = 500;
    try {
      const [bs] = await sql`SELECT setting_value FROM app_settings WHERE setting_key = 'whatsapp_campaign_batch_size' LIMIT 1`;
      if (bs?.setting_value) batchSize = parseInt(bs.setting_value, 10) || 25;
      const [del] = await sql`SELECT setting_value FROM app_settings WHERE setting_key = 'whatsapp_campaign_delay_ms' LIMIT 1`;
      if (del?.setting_value) delayMs = parseInt(del.setting_value, 10) || 500;
    } catch (e) {}

    const pendingRecipients = await sql`
      SELECT id, contact_id, phone_e164 
      FROM whatsapp_campaign_recipients 
      WHERE campaign_id = ${campaignId} AND status = 'pending'
      ORDER BY id ASC
    `;

    const templateVariables = Array.isArray(campaign.template_variables) ? campaign.template_variables : [];

    for (let i = 0; i < pendingRecipients.length; i += batchSize) {
      // Check if campaign was cancelled mid-flight
      const [check] = await sql`SELECT status FROM whatsapp_campaigns WHERE id = ${campaignId} LIMIT 1`;
      if (check?.status === 'cancelled') {
        console.log(`[campaign-${campaignId}] Cancelled by staff. Halting send.`);
        break;
      }

      const chunk = pendingRecipients.slice(i, i + batchSize);

      await Promise.all(chunk.map(async (rec) => {
        try {
          const res = await sendInfobipTemplateMessage({
            to: rec.phone_e164,
            templateName: campaign.template_name,
            language: campaign.template_language || 'en',
            placeholders: templateVariables,
          });

          await sql`
            UPDATE whatsapp_campaign_recipients
            SET 
              status = 'sent',
              infobip_message_id = ${res.messageId},
              sent_at = now()
            WHERE id = ${rec.id}
          `;

          // Also record in whatsapp_messages for the conversation
          const [conv] = await sql`
            SELECT id FROM whatsapp_conversations WHERE contact_id = ${rec.contact_id} LIMIT 1
          `;
          if (conv) {
            await sql`
              INSERT INTO whatsapp_messages (
                conversation_id, contact_id, infobip_message_id, direction,
                message_type, text_content, template_name, template_parameters,
                status, sent_by_user_id, raw_infobip_payload, created_at, updated_at
              )
              VALUES (
                ${conv.id}, ${rec.contact_id}, ${res.messageId}, 'outgoing',
                'template', ${'[Campaign: ' + campaign.name + ']'}, ${campaign.template_name},
                ${JSON.stringify(templateVariables)}, 'sent', ${adminId}, ${JSON.stringify(res.raw || {})}, now(), now()
              )
            `;
          }
        } catch (err) {
          console.error(`[campaign-${campaignId}] Failed sending to ${rec.phone_e164}:`, err.message);
          await sql`
            UPDATE whatsapp_campaign_recipients
            SET 
              status = 'failed',
              error_code = ${err.errorCode || 'SEND_FAILED'},
              error_message = ${err.message}
            WHERE id = ${rec.id}
          `;
        }
      }));

      // Update counters
      await sql`
        UPDATE whatsapp_campaigns
        SET 
          sent_count = (SELECT COUNT(*) FROM whatsapp_campaign_recipients WHERE campaign_id = ${campaignId} AND status IN ('sent', 'delivered', 'read')),
          failed_count = (SELECT COUNT(*) FROM whatsapp_campaign_recipients WHERE campaign_id = ${campaignId} AND status = 'failed'),
          updated_at = now()
        WHERE id = ${campaignId}
      `;

      // Polite rate limit pause between batches
      if (i + batchSize < pendingRecipients.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Complete campaign
    await sql`
      UPDATE whatsapp_campaigns
      SET 
        status = 'completed',
        completed_at = now(),
        updated_at = now()
      WHERE id = ${campaignId} AND status = 'running'
    `;
    console.log(`[campaign-${campaignId}] Execution completed.`);
  } catch (err) {
    console.error(`[campaign-${campaignId}] Fatal error in batch worker:`, err);
    await sql`UPDATE whatsapp_campaigns SET status = 'failed', updated_at = now() WHERE id = ${campaignId}`;
  }
}

export async function POST(request, { params }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { 
      audienceType = "opted_in", // 'opted_in', 'tag', 'tier', 'manual', 'all'
      selectedTag = null,
      selectedTier = null,
      manualContactIds = [],
      manualPhones = [],
      allowUnopted = false, // Must be explicitly allowed if permitted by law
    } = body;

    const [campaign] = await sql`SELECT * FROM whatsapp_campaigns WHERE id = ${id} LIMIT 1`;
    if (!campaign) return Response.json({ error: "Campaign not found" }, { status: 404 });
    if (campaign.status === 'running') return Response.json({ error: "Campaign is already running" }, { status: 400 });
    if (campaign.status === 'completed') return Response.json({ error: "Campaign is already completed" }, { status: 400 });

    // 1. Resolve eligible recipients with strict marketing opt-in compliance
    let contacts = [];

    if (audienceType === 'tag' && selectedTag) {
      contacts = await sql`
        SELECT id, phone_e164, whatsapp_opt_in FROM whatsapp_contacts
        WHERE ${selectedTag} = ANY(tags)
        ${!allowUnopted ? sql`AND whatsapp_opt_in = true` : sql`true`}
      `;
    } else if (audienceType === 'tier' && selectedTier) {
      contacts = await sql`
        SELECT con.id, con.phone_e164, con.whatsapp_opt_in
        FROM whatsapp_contacts con
        INNER JOIN auth_users u ON u.id = con.customer_id
        WHERE u.membership_tier = ${selectedTier}
        ${!allowUnopted ? sql`AND con.whatsapp_opt_in = true` : sql`true`}
      `;
    } else if (audienceType === 'manual' && manualContactIds.length > 0) {
      contacts = await sql`
        SELECT id, phone_e164, whatsapp_opt_in FROM whatsapp_contacts
        WHERE id = ANY(${manualContactIds})
        ${!allowUnopted ? sql`AND whatsapp_opt_in = true` : sql`true`}
      `;
    } else {
      // Default: All opted-in clients
      contacts = await sql`
        SELECT id, phone_e164, whatsapp_opt_in FROM whatsapp_contacts
        WHERE whatsapp_opt_in = true
      `;
    }

    // Process manual phone numbers if provided (e.g. from CSV import)
    const phoneList = new Set();
    const resolvedRecipients = [];

    for (const c of contacts) {
      if (c.phone_e164 && !phoneList.has(c.phone_e164)) {
        phoneList.add(c.phone_e164);
        resolvedRecipients.push({ contact_id: c.id, phone: c.phone_e164 });
      }
    }

    for (const p of manualPhones) {
      const e164 = normalizePhoneE164(p);
      if (e164 && !phoneList.has(e164)) {
        phoneList.add(e164);
        // Find or create contact
        let [mc] = await sql`SELECT id, whatsapp_opt_in FROM whatsapp_contacts WHERE phone_e164 = ${e164} LIMIT 1`;
        if (!mc) {
          [mc] = await sql`
            INSERT INTO whatsapp_contacts (name, phone_e164, whatsapp_opt_in, whatsapp_opt_in_source, created_at, updated_at)
            VALUES (${'WhatsApp ' + e164.slice(-4)}, ${e164}, ${Boolean(allowUnopted)}, 'csv_campaign', now(), now())
            RETURNING id, whatsapp_opt_in
          `;
        }
        if (allowUnopted || mc.whatsapp_opt_in) {
          resolvedRecipients.push({ contact_id: mc.id, phone: e164 });
        }
      }
    }

    if (resolvedRecipients.length === 0) {
      return Response.json({
        ok: false,
        error: "No eligible recipients found. Note that marketing campaigns require contacts to have opt-in consent (whatsapp_opt_in = true).",
        code: "NO_OPTED_IN_RECIPIENTS",
      }, { status: 400 });
    }

    // Clear any prior pending recipients for this campaign
    await sql`DELETE FROM whatsapp_campaign_recipients WHERE campaign_id = ${id} AND status = 'pending'`;

    // Insert recipients
    for (const r of resolvedRecipients) {
      await sql`
        INSERT INTO whatsapp_campaign_recipients (campaign_id, contact_id, phone_e164, status)
        VALUES (${id}, ${r.contact_id}, ${r.phone}, 'pending')
      `;
    }

    // Update total recipients
    await sql`
      UPDATE whatsapp_campaigns
      SET total_recipients = ${resolvedRecipients.length}, updated_at = now()
      WHERE id = ${id}
    `;

    await sql`
      INSERT INTO whatsapp_audit_logs (admin_user_id, action, entity_type, entity_id, details, created_at)
      VALUES (${admin.id}, 'campaign.sent', 'campaign', ${id}, ${JSON.stringify({ totalRecipients: resolvedRecipients.length })}, now())
    `;

    // Fire off async background execution so API responds immediately without blocking the browser
    setTimeout(() => {
      processCampaignBatch(id, admin.id).catch(err => console.error("Batch runner error:", err));
    }, 100);

    return Response.json({
      ok: true,
      message: "Campaign queued for sending",
      recipientCount: resolvedRecipients.length,
    });
  } catch (error) {
    console.error("[whatsapp/campaigns/[id]/send POST] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
