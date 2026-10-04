import { sendInfobipWhatsAppTemplate, sendInfobipWhatsAppFreeForm } from "@/app/api/utils/infobipWhatsApp";

function formatDriverEtaTime(etaMinutes, baseDate = new Date(), timeZone = "Asia/Beirut") {
  if (etaMinutes === "Now" || etaMinutes === 0 || etaMinutes === "0") {
    return { isNow: true, timeText: "Now", phrase: "Now" };
  }
  const mins = parseInt(etaMinutes, 10);
  if (isNaN(mins)) {
    return { isNow: false, timeText: String(etaMinutes), phrase: `at ${etaMinutes}` };
  }
  const targetDate = new Date(baseDate.getTime() + mins * 60 * 1000);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const parts = formatter.formatToParts(targetDate);
  const hour = parts.find((p) => p.type === "hour")?.value || "";
  const minute = parts.find((p) => p.type === "minute")?.value || "";
  const dayPeriod = (parts.find((p) => p.type === "dayPeriod")?.value || "").toUpperCase();
  const formattedTime = minute === "00" ? `${hour}${dayPeriod}` : `${hour}:${minute}${dayPeriod}`;
  return { isNow: false, timeText: formattedTime, phrase: `at ${formattedTime}` };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { orderId, etaMinutes, phone, targetTime, messageText: clientMessageText } = body;
    const targetPhone = phone || "9613826136";

    const etaInfo = formatDriverEtaTime(etaMinutes || "15");
    const resolvedTimeText = targetTime || etaInfo.timeText;
    const orderText = orderId ? ` for Order #${orderId}` : "";

    const messageText = clientMessageText || (etaInfo.isNow
      ? `🛵 Hello, need driver Now${orderText}`
      : `🛵 Hello, need driver at ${resolvedTimeText}${orderText}`);

    const paramText = etaInfo.isNow ? `Now${orderText}` : `at ${resolvedTimeText}${orderText}`;

    let apiResult = null;
    let templateSuccess = false;

    // 1. Try Approved Template first (bypasses 24-hour session limits)
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
