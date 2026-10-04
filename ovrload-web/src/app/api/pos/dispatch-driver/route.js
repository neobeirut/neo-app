import { sendInfobipWhatsAppTemplate, sendInfobipWhatsAppFreeForm } from "@/app/api/utils/infobipWhatsApp";

function formatDriverArrivalEta(etaMinutes, baseDate = new Date(), timeZone = "Asia/Beirut") {
  const isNow = etaMinutes === "Now" || etaMinutes === 0 || etaMinutes === "0";
  const mins = isNow ? 0 : (parseInt(etaMinutes, 10) || 15);
  const targetDate = new Date(baseDate.getTime() + mins * 60 * 1000);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const timeFormatted = formatter.format(targetDate);
  const durationLabel = isNow ? "now" : `${mins} min`;
  return {
    isNow,
    timeText: timeFormatted,
    durationLabel,
    mins,
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { orderId, etaMinutes, phone, targetTime, messageText: clientMessageText } = body;
    const targetPhone = phone || "9613826136";

    const etaInfo = formatDriverArrivalEta(etaMinutes || "15");
    const resolvedTimeText = targetTime || etaInfo.timeText;
    const orderText = orderId ? `#${orderId}` : "";

    // Desired message text requested by user
    const messageText = clientMessageText || (etaInfo.isNow
      ? `Hello, driver needed for Order ${orderText} — pickup time: Now (${resolvedTimeText})`
      : `Hello, driver needed for Order ${orderText} — pickup time: ${resolvedTimeText}`);

    // For current approved Meta template "Hello, need driver in {{1}}":
    // Sending "{{1}}" = "15 min for Order #2457 — pickup time: 3:50 PM"
    // Outputs in WhatsApp: "Hello, need driver in 15 min for Order #2457 — pickup time: 3:50 PM"
    const templateParam = etaInfo.isNow
      ? `now for Order ${orderText} — pickup time: ${resolvedTimeText}`
      : `${etaInfo.durationLabel} for Order ${orderText} — pickup time: ${resolvedTimeText}`;

    let apiResult = null;
    let templateSuccess = false;

    // 1. Try new template 'driver_needed' if user creates it in Meta/Infobip
    try {
      apiResult = await sendInfobipWhatsAppTemplate(
        targetPhone,
        { templateName: "driver_needed", language: "en" },
        [orderId || "", resolvedTimeText]
      );
      if (apiResult && apiResult.id) {
        templateSuccess = true;
      }
    } catch (_) {
      // driver_needed not active yet, proceed to driver_request
    }

    // 2. Try current approved template 'driver_request' ("Hello, need driver in {{1}}")
    if (!templateSuccess) {
      try {
        apiResult = await sendInfobipWhatsAppTemplate(
          targetPhone,
          { templateName: "driver_request", language: "en" },
          [templateParam]
        );
        if (apiResult && apiResult.id) {
          templateSuccess = true;
        }
      } catch (templateError) {
        console.warn("[dispatch-driver] Template dispatch failed, falling back to free-form text:", templateError.message);
      }
    }

    // 3. Fallback to free-form text if template is not yet active
    if (!templateSuccess) {
      apiResult = await sendInfobipWhatsAppFreeForm(targetPhone, messageText);
    }

    return Response.json({
      success: true,
      apiSuccess: true,
      usedTemplate: templateSuccess,
      messageText,
      templateParamSent: templateParam,
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
