import { sendInfobipWhatsAppTemplate, sendInfobipWhatsAppFreeForm } from "@/app/api/utils/infobipWhatsApp";
import sql from "../../utils/sql";

export async function POST(request) {
  try {
    const body = await request.json();
    const { orderId, etaMinutes, phone, dispatch_operation_id } = body;
    const targetPhone = phone || "9613826136";

    // 1. Idempotency Check: if dispatch_operation_id is provided, verify whether this operation already ran
    if (orderId && dispatch_operation_id) {
      const existing = await sql`
        SELECT id, last_dispatch_operation_id FROM orders WHERE id = ${orderId} LIMIT 1
      `;
      if (existing && existing[0] && existing[0].last_dispatch_operation_id === dispatch_operation_id) {
        console.log(`[dispatch-driver] Idempotent retry detected for dispatch_operation_id ${dispatch_operation_id} on order #${orderId}`);
        return Response.json({
          success: true,
          apiSuccess: true,
          isDuplicate: true,
          message: "Idempotent response: driver dispatch operation already sent",
          orderId,
          dispatch_operation_id
        });
      }
    }

    const timeText = etaMinutes === "Now" ? "Now" : etaMinutes ? `${etaMinutes}'` : "15'";
    const orderText = orderId ? ` for Order #${orderId}` : "";
    const paramText = `${timeText}${orderText}`;
    const messageText = `🛵 Hello, need driver in ${paramText}`;

    let apiResult = null;
    let templateSuccess = false;

    // 2. Try Approved Template first (bypasses 24-hour session limits)
    try {
      apiResult = await sendInfobipWhatsAppTemplate(
        targetPhone,
        { templateName: "driver_request", language: "en" },
        [paramText]
      );
      if (apiResult && apiResult.id) {
        templateSuccess = true;
      }
    } catch (templateError) {
      console.warn("[dispatch-driver] Template dispatch failed, falling back to free-form text:", templateError.message);
    }

    // 3. Fallback to free-form text if template is not yet active
    if (!templateSuccess) {
      apiResult = await sendInfobipWhatsAppFreeForm(targetPhone, messageText);
    }

    // 4. Record last_dispatch_operation_id on order if provided
    if (orderId && dispatch_operation_id) {
      try {
        await sql`
          UPDATE orders 
          SET last_dispatch_operation_id = ${dispatch_operation_id}
          WHERE id = ${orderId}
        `;
      } catch (dbErr) {
        console.warn("[dispatch-driver] Could not update last_dispatch_operation_id on order:", dbErr);
      }
    }

    return Response.json({
      success: true,
      apiSuccess: true,
      usedTemplate: templateSuccess,
      messageText,
      targetPhone,
      result: apiResult,
      dispatch_operation_id: dispatch_operation_id || null
    });
  } catch (error) {
    console.error("Error in POST /api/pos/dispatch-driver:", error);
    return Response.json(
      { success: false, error: "Failed to dispatch driver: " + error.message },
      { status: 500 }
    );
  }
}
