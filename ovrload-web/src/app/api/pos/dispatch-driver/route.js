import { sendInfobipWhatsAppTemplate, sendInfobipWhatsAppFreeForm } from "@/app/api/utils/infobipWhatsApp";

export async function POST(request) {
  try {
    const body = await request.json();
    const { orderId, etaMinutes, phone } = body;
    const targetPhone = phone || "9613361515";
    const timeText = etaMinutes === "Now" ? "Now" : etaMinutes ? `${etaMinutes}'` : "15'";
    const messageText = `🛵 Hello, need driver in ${timeText}`;

    let apiResult = null;
    let templateSuccess = false;

    // 1. Try Approved Template first (bypasses 24-hour session limits)
    try {
      apiResult = await sendInfobipWhatsAppTemplate(
        targetPhone,
        { templateName: "driver_request", language: "en" },
        [timeText]
      );
      if (apiResult && apiResult.id) {
        templateSuccess = true;
      }
    } catch (templateError) {
      console.warn("[dispatch-driver] Template dispatch failed, falling back to free-form text:", templateError.message);
    }

    // 2. Fallback to free-form text if template is not yet active
    if (!templateSuccess) {
      apiResult = await sendInfobipWhatsAppFreeForm(targetPhone, messageText);
    }

    return Response.json({
      success: true,
      apiSuccess: true,
      usedTemplate: templateSuccess,
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
