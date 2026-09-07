// test-whatsapp-module.mjs
import { normalizePhoneNumber, isValidE164, formatPhoneDisplay } from "../src/app/api/utils/phoneNormalizer.js";
import { parseInfobipInboundPayload, parseInfobipStatusPayload } from "../src/app/api/utils/infobipService.js";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres.agznfhskhsazzhbeboth:KXL5417ZawC9V4Kd@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres";

async function runTests() {
  console.log("=========================================");
  console.log("  TESTING CUSTOM WHATSAPP MODULE LOGIC   ");
  console.log("=========================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // --- 1. Phone Normalizer Tests ---
  console.log("[1] Testing Phone Normalizer (E.164 & Lebanon special cases)");

  // Standard domestic Lebanese numbers
  assert(normalizePhoneNumber("70123456") === "+96170123456", "Lebanese 8-digit starts with 70 -> +96170123456");
  assert(normalizePhoneNumber("03123456") === "+9613123456", "Lebanese 7-digit with leading zero 03 -> +9613123456");
  assert(normalizePhoneNumber("3123456") === "+9613123456", "Lebanese 7-digit without leading zero 3 -> +9613123456");
  assert(normalizePhoneNumber("01555666") === "+9611555666", "Lebanese landline 01 -> +9611555666");
  assert(normalizePhoneNumber("+961 71 234 567") === "+96171234567", "Lebanese with country code and spaces -> +96171234567");
  assert(normalizePhoneNumber("00961 76 999 888") === "+96176999888", "Lebanese with 00 prefix -> +96176999888");

  // Arabic numerals normalization
  assert(normalizePhoneNumber("٠٣١٢٣٤٥٦") === "+9613123456", "Arabic-Indic digits '٠٣١٢٣٤٥٦' -> +9613123456");

  // International numbers
  assert(normalizePhoneNumber("+1 (415) 555-2671") === "+14155552671", "US international number -> +14155552671");
  assert(normalizePhoneNumber("+971 50 123 4567") === "+971501234567", "UAE international number -> +971501234567");
  assert(normalizePhoneNumber("+33 6 12 34 56 78") === "+33612345678", "France international number -> +33612345678");

  // E.164 Validator
  assert(isValidE164("+96170123456") === true, "Valid E.164 +96170123456");
  assert(isValidE164("03123456") === false, "Invalid raw domestic number rejected by isValidE164");
  assert(isValidE164("abc") === false, "String with letters rejected by isValidE164");

  // Display Formatter
  assert(formatPhoneDisplay("+96170123456") === "+961 70 123 456", "Lebanese display format: +961 70 123 456");
  assert(formatPhoneDisplay("+9613123456") === "+961 3 123 456", "Lebanese display format: +961 3 123 456");


  // --- 2. Meta 24-Hour Customer Service Window Logic ---
  console.log("\n[2] Testing Meta 24-Hour Service Window Calculation");

  function isWithin24HourWindow(lastCustomerMessageAt) {
    if (!lastCustomerMessageAt) return false;
    const lastMsgTime = new Date(lastCustomerMessageAt).getTime();
    if (isNaN(lastMsgTime)) return false;
    const now = Date.now();
    const diffMs = now - lastMsgTime;
    return diffMs <= 24 * 60 * 60 * 1000;
  }

  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString();
  const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();

  assert(isWithin24HourWindow(twoHoursAgo) === true, "2 hours ago is INSIDE 24h window (Free-form text allowed)");
  assert(isWithin24HourWindow(twentyThreeHoursAgo) === true, "23 hours ago is INSIDE 24h window (Free-form text allowed)");
  assert(isWithin24HourWindow(twentyFiveHoursAgo) === false, "25 hours ago is OUTSIDE 24h window (Template required)");
  assert(isWithin24HourWindow(threeDaysAgo) === false, "3 days ago is OUTSIDE 24h window (Template required)");
  assert(isWithin24HourWindow(null) === false, "No previous incoming message is OUTSIDE 24h window");


  // --- 3. Infobip Inbound & Status Payload Parsers ---
  console.log("\n[3] Testing Infobip Webhook Parsers");

  // Inbound payload simulation
  const sampleInboundPayload = {
    results: [
      {
        from: "96170123456",
        to: "96176489078",
        messageId: "infobip-msg-abc-123",
        receivedAt: "2026-09-07T04:00:00.000+0000",
        message: {
          text: "Hello, I would like to track my order!"
        },
        contact: {
          name: "Sami Khoury"
        }
      }
    ]
  };

  const parsedInbound = parseInfobipInboundPayload(sampleInboundPayload);
  assert(parsedInbound.length === 1, "Parsed exactly 1 inbound message");
  assert(parsedInbound[0].fromPhone === "+96170123456", "Sender phone normalized to E.164 +96170123456");
  assert(parsedInbound[0].messageId === "infobip-msg-abc-123", "Message ID correctly extracted");
  assert(parsedInbound[0].content === "Hello, I would like to track my order!", "Text content extracted");
  assert(parsedInbound[0].contactName === "Sami Khoury", "Contact name extracted");

  // Status callback payload simulation
  const sampleStatusPayload = {
    results: [
      {
        messageId: "infobip-msg-abc-123",
        to: "96170123456",
        status: {
          name: "DELIVERED",
          description: "Message delivered to handset"
        },
        doneAt: "2026-09-07T04:00:05.000+0000"
      }
    ]
  };

  const parsedStatus = parseInfobipStatusPayload(sampleStatusPayload);
  assert(parsedStatus.length === 1, "Parsed exactly 1 status report");
  assert(parsedStatus[0].messageId === "infobip-msg-abc-123", "Status message ID matches");
  assert(parsedStatus[0].status === "delivered", "Status matches delivered");


  // --- 4. Database Schema Integrity Check ---
  console.log("\n[4] Testing Database Schema & Seed Data");
  const sql = postgres(DATABASE_URL, { ssl: "require", max: 2 });

  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN (
          'whatsapp_contacts',
          'whatsapp_conversations',
          'whatsapp_messages',
          'whatsapp_templates',
          'whatsapp_campaigns',
          'whatsapp_campaign_recipients',
          'whatsapp_audit_logs'
        )
      ORDER BY table_name;
    `;

    const foundTables = tables.map(t => t.table_name);
    assert(foundTables.includes("whatsapp_contacts"), "Table whatsapp_contacts exists");
    assert(foundTables.includes("whatsapp_conversations"), "Table whatsapp_conversations exists");
    assert(foundTables.includes("whatsapp_messages"), "Table whatsapp_messages exists");
    assert(foundTables.includes("whatsapp_templates"), "Table whatsapp_templates exists");
    assert(foundTables.includes("whatsapp_campaigns"), "Table whatsapp_campaigns exists");
    assert(foundTables.includes("whatsapp_campaign_recipients"), "Table whatsapp_campaign_recipients exists");
    assert(foundTables.includes("whatsapp_audit_logs"), "Table whatsapp_audit_logs exists");

    // Check app_settings default seed
    const settings = await sql`
      SELECT setting_key, setting_value FROM app_settings 
      WHERE setting_key IN ('whatsapp_service_window_hours', 'whatsapp_campaign_batch_size');
    `;
    assert(settings.some(s => s.setting_key === "whatsapp_service_window_hours"), "Setting whatsapp_service_window_hours is seeded");
    assert(settings.some(s => s.setting_key === "whatsapp_campaign_batch_size"), "Setting whatsapp_campaign_batch_size is seeded");

    await sql.end();
  } catch (err) {
    console.error("DB check failed:", err.message);
    failed++;
  }

  console.log("\n=========================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Fatal error during tests:", err);
  process.exit(1);
});
