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
    // Ovrload sender where driver_request template is registered & approved
    const ovrloadSender = "96181202607";

    const etaInfo = formatDriverArrivalEta(etaMinutes || "15");
    const resolvedTimeText = targetTime || etaInfo.timeText;
    const orderNum = orderId ? `#${orderId}` : "";

    // The approved template in Infobip (Sender 96181202607):
    // "Hello, driver needed for Order {{1}}"
    // "Thank you"
    // Setting parameter {{1}} to:
    // "#2457 — pickup time: 3:50 PM"
    // Renders the exact desired WhatsApp text:
    // "Hello, driver needed for Order #2457 — pickup time: 3:50 PM\nThank you"
    const templateParam = etaInfo.isNow
      ? `${orderNum} — pickup time: Now (${resolvedTimeText})`.trim()
      : `${orderNum} — pickup time: ${resolvedTimeText}`.trim();

    // Desired plain message text for fallback or wa.me
    const messageText = clientMessageText || (etaInfo.isNow
      ? `Hello, driver needed for Order ${orderNum} — pickup time: Now (${resolvedTimeText})`
      : `Hello, driver needed for Order ${orderNum} — pickup time: ${resolvedTimeText}`);

    let apiResult = null;
    let templateSuccess = false;

    // Send using approved template 'driver_request' on Ovrload sender
    try {
      apiResult = await sendInfobipWhatsAppTemplate(
        targetPhone,
        { templateName: "driver_request", language: "en" },
        [templateParam],
        ovrloadSender
      );
      if (apiResult && apiResult.id) {
        templateSuccess = true;
      }
    } catch (templateError) {
      console.warn("[dispatch-driver] Template dispatch failed, falling back to free-form text:", templateError.message);
    }

    // Fallback to free-form text if template failed
    if (!templateSuccess) {
      apiResult = await sendInfobipWhatsAppFreeForm(targetPhone, messageText, ovrloadSender);
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
