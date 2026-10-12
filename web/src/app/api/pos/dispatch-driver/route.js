import { sendInfobipWhatsAppTemplate, sendInfobipWhatsAppFreeForm } from "@/app/api/utils/infobipWhatsApp";

function formatDriverEta(etaMinutes, orderId) {
  const isNow = etaMinutes === "Now" || etaMinutes === 0 || etaMinutes === "0";
  const cleanMins = String(etaMinutes || "").replace(/[^0-9]/g, "");
  const mins = cleanMins ? parseInt(cleanMins, 10) : 15;
  const etaText = isNow ? "Now" : `in ${mins}'`;

  let orderNum = "";
  if (orderId) {
    const raw = String(orderId).trim();
    orderNum = raw.startsWith("#") ? raw : `#${raw}`;
  }

  const templateParam = orderNum ? `${orderNum} ${etaText}`.trim() : etaText;
  const messageText = `Hello, driver needed for Order ${templateParam}
Thank you`;

  return {
    isNow,
    mins,
    etaText,
    templateParam,
    messageText,
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { orderId, etaMinutes, phone, messageText: clientMessageText } = body;
    const targetPhone = phone || "9613826136";
    // Ovrload sender where driver_request template is registered & approved
    const ovrloadSender = "96181202607";

    const etaInfo = formatDriverEta(etaMinutes || "15", orderId);

    // The approved template in Infobip (Sender 96181202607):
    // "Hello, driver needed for Order {{1}}"
    // "Thank you"
    // Parameter {{1}} is e.g. "#4578 in 15'" or "#4578 Now"
    // Renders:
    // "Hello, driver needed for Order #4578 in 15'
    // Thank you"
    const templateParam = etaInfo.templateParam;
    const messageText = clientMessageText || etaInfo.messageText;

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
