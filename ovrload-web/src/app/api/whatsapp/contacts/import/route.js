import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import { normalizePhoneE164, isValidE164 } from "@/app/api/utils/phoneNormalizer";

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const rawHeaders = parseCSVLine(lines[0]);
  const headers = rawHeaders.map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, "")
  );

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx] : "";
    });
    rows.push(row);
  }
  return rows;
}

function extractField(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
      return String(row[k]).trim();
    }
  }
  return "";
}

function parseOptIn(val) {
  if (typeof val === "boolean") return val;
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return ["true", "1", "yes", "y", "opted_in", "optin", "opt_in"].includes(s);
}

export async function POST(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const contentType = request.headers.get("content-type") || "";
    let rawContacts = [];

    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      if (Array.isArray(body.contacts)) {
        rawContacts = body.contacts;
      } else if (typeof body.csv === "string") {
        rawContacts = parseCSV(body.csv);
      }
    } else if (contentType.includes("text/csv") || contentType.includes("multipart/form-data")) {
      const text = await request.text();
      rawContacts = parseCSV(text);
    }

    if (!Array.isArray(rawContacts) || rawContacts.length === 0) {
      return Response.json(
        { ok: false, error: "No contact records provided or CSV was empty." },
        { status: 400 }
      );
    }

    let importedCount = 0;
    let updatedCount = 0;
    const errors = [];

    for (let i = 0; i < rawContacts.length; i++) {
      const row = rawContacts[i];
      const rowNum = i + 1;

      // Extract attributes flexibly
      const rawPhone = extractField(row, [
        "phone",
        "phonee164",
        "phonenumber",
        "mobile",
        "mobilenumber",
        "telephone",
        "tel",
        "cell",
        "number",
      ]);

      if (!rawPhone) {
        errors.push({ row: rowNum, error: "Missing phone number" });
        continue;
      }

      const normalizedPhone = normalizePhoneE164(rawPhone);
      if (!isValidE164(normalizedPhone)) {
        errors.push({
          row: rowNum,
          phone: rawPhone,
          error: `Invalid phone format ("${rawPhone}"). Must be valid international E.164.`,
        });
        continue;
      }

      const name =
        extractField(row, ["name", "fullname", "clientname", "contactname", "customername"]) ||
        `WhatsApp ${normalizedPhone.slice(-4)}`;

      const category =
        extractField(row, ["category", "group", "type", "tier", "segment"]) || "General";

      const email = extractField(row, ["email", "mail", "emailaddress"]) || null;
      const notes = extractField(row, ["notes", "note", "comment", "comments", "description"]) || null;

      const rawTags =
        extractField(row, ["tags", "tag", "labels", "label"]) ||
        (Array.isArray(row.tags) ? row.tags.join(",") : "");
      const tagsArray = rawTags
        ? rawTags
            .split(",")
            .map((t) => t.trim().replace(/^#/, ""))
            .filter(Boolean)
        : [];

      const optInRaw =
        row.whatsapp_opt_in !== undefined
          ? row.whatsapp_opt_in
          : row.opt_in !== undefined
          ? row.opt_in
          : extractField(row, ["optin", "optinconsent", "consent", "whatsappoptin", "marketing"]);
      const optInBool = parseOptIn(optInRaw);
      const optInAt = optInBool ? new Date() : null;

      try {
        // Upsert into whatsapp_contacts
        const [upserted] = await sql`
          INSERT INTO whatsapp_contacts (
            name, phone_e164, email, category, notes, tags,
            whatsapp_opt_in, whatsapp_opt_in_at, whatsapp_opt_in_source, created_at, updated_at
          )
          VALUES (
            ${name}, ${normalizedPhone}, ${email}, ${category}, ${notes}, ${tagsArray},
            ${optInBool}, ${optInAt}, 'csv_import', now(), now()
          )
          ON CONFLICT (phone_e164) DO UPDATE SET
            name = CASE 
              WHEN EXCLUDED.name != '' AND EXCLUDED.name NOT LIKE 'WhatsApp %' THEN EXCLUDED.name 
              ELSE whatsapp_contacts.name 
            END,
            email = COALESCE(EXCLUDED.email, whatsapp_contacts.email),
            category = COALESCE(NULLIF(EXCLUDED.category, ''), whatsapp_contacts.category),
            notes = CASE 
              WHEN EXCLUDED.notes IS NOT NULL AND EXCLUDED.notes != '' 
              THEN COALESCE(whatsapp_contacts.notes || ' | ' || EXCLUDED.notes, EXCLUDED.notes) 
              ELSE whatsapp_contacts.notes 
            END,
            tags = (
              SELECT COALESCE(array_agg(DISTINCT elem), '{}')
              FROM unnest(whatsapp_contacts.tags || EXCLUDED.tags) elem
              WHERE elem IS NOT NULL AND elem != ''
            ),
            whatsapp_opt_in = CASE 
              WHEN EXCLUDED.whatsapp_opt_in = true THEN true 
              ELSE whatsapp_contacts.whatsapp_opt_in 
            END,
            whatsapp_opt_in_at = CASE 
              WHEN EXCLUDED.whatsapp_opt_in = true AND whatsapp_contacts.whatsapp_opt_in IS NOT TRUE THEN now() 
              ELSE whatsapp_contacts.whatsapp_opt_in_at 
            END,
            whatsapp_opt_in_source = CASE 
              WHEN EXCLUDED.whatsapp_opt_in = true AND whatsapp_contacts.whatsapp_opt_in IS NOT TRUE THEN 'csv_import' 
              ELSE whatsapp_contacts.whatsapp_opt_in_source 
            END,
            updated_at = now()
          RETURNING id, (xmax = 0) AS was_inserted
        `;

        if (upserted?.was_inserted) {
          importedCount++;
        } else {
          updatedCount++;
        }
      } catch (rowErr) {
        console.error(`[import row ${rowNum}] Error:`, rowErr);
        errors.push({ row: rowNum, phone: rawPhone, error: rowErr.message });
      }
    }

    // Audit log
    await sql`
      INSERT INTO whatsapp_audit_logs (admin_user_id, action, entity_type, entity_id, details, created_at)
      VALUES (
        ${admin.id}, 
        'contacts.imported', 
        'contacts', 
        NULL, 
        ${JSON.stringify({
          totalProcessed: rawContacts.length,
          imported: importedCount,
          updated: updatedCount,
          errorsCount: errors.length,
        })}, 
        now()
      )
    `;

    return Response.json({
      ok: true,
      totalProcessed: rawContacts.length,
      imported: importedCount,
      updated: updatedCount,
      errors,
    });
  } catch (error) {
    console.error("[whatsapp/contacts/import POST] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
