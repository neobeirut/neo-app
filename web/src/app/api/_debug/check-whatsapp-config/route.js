import sql from "@/app/api/utils/sql";
import { getTemplateStructure } from "@/app/api/utils/whatsappTemplateRegistry";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");

  const diagnostics = {
    timestamp: new Date().toISOString(),
  };

  // 1. Check environment variable
  diagnostics.senderPhone = {
    envVariable: process.env.INFOBIP_WHATSAPP_SENDER || "NOT SET",
    envVariableLength: process.env.INFOBIP_WHATSAPP_SENDER?.length || 0,
  };

  // 2. Check "preparing" template config
  const [preparing] = await sql`
    SELECT setting_key, setting_value
    FROM app_settings
    WHERE setting_key = 'whatsapp_template_preparing'
    LIMIT 1
  `;

  if (preparing) {
    try {
      const config = JSON.parse(preparing.setting_value);
      diagnostics.preparingTemplate = {
        templateName: config.template_name,
        language: config.language,
        fullConfig: config,
      };
    } catch (e) {
      diagnostics.preparingTemplate = {
        error: "Failed to parse JSON",
        raw: preparing.setting_value,
      };
    }
  } else {
    diagnostics.preparingTemplate = {
      error: "NOT CONFIGURED",
      hint: "Go to Admin Settings → WhatsApp Templates",
    };
  }

  // 3. Check template structure in registry
  const structure = getTemplateStructure("preparing");
  diagnostics.preparingStructure = structure;

  // 4. If orderId provided, check that order's branch phone
  if (orderId) {
    const [order] = await sql`
      SELECT 
        o.id,
        o.branch_id,
        b.name as branch_name,
        b.whatsapp_phone as branch_whatsapp_phone
      FROM orders o
      LEFT JOIN branches b ON b.id = o.branch_id
      WHERE o.id = ${Number(orderId)}
      LIMIT 1
    `;

    if (order) {
      diagnostics.order = {
        id: order.id,
        branchId: order.branch_id,
        branchName: order.branch_name,
        branchWhatsAppPhone: order.branch_whatsapp_phone || "NOT SET",
        finalSenderPhone:
          order.branch_whatsapp_phone ||
          process.env.INFOBIP_WHATSAPP_SENDER ||
          "MISSING!",
      };
    } else {
      diagnostics.order = {
        error: `Order ${orderId} not found`,
      };
    }
  }

  // 5. Check all branches with WhatsApp phones
  const branches = await sql`
    SELECT id, name, whatsapp_phone
    FROM branches
    WHERE whatsapp_phone IS NOT NULL AND whatsapp_phone != ''
    ORDER BY id
  `;

  diagnostics.branchesWithWhatsApp = branches.map((b) => ({
    id: b.id,
    name: b.name,
    phone: b.whatsapp_phone,
  }));

  return Response.json(diagnostics, { status: 200 });
}
