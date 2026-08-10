import { sendInfobipWhatsAppFreeForm } from "@/app/api/utils/infobipWhatsApp";

export async function POST(request) {
  try {
    const body = await request.json();
    const { orderId, etaMinutes, phone } = body;
    const targetPhone = phone || "9613361515";
    const timeText = etaMinutes ? `${etaMinutes}'` : "15'";
    const messageText = `🛵 Hello, need driver in ${timeText}`;

    let apiResult = null;
    let apiSuccess = false;
    let apiError = null;

    try {
      apiResult = await sendInfobipWhatsAppFreeForm(targetPhone, messageText);
      apiSuccess = true;
    } catch (infobipErr) {
      apiError = infobipErr.message || String(infobipErr);
      console.error("[DispatchDriver] Infobip API Error:", infobipErr);
    }

    return Response.json({
      success: true,
      apiSuccess,
      apiError,
      messageText,
      targetPhone,
      result: apiResult,
    });
  } catch (error) {
    console.error("Error in POST /api/pos/dispatch-driver:", error);
    return Response.json(
      { success: false, error: "Failed to dispatch driver: " + error.message },
      { status: 500 }
    );
  }
}
