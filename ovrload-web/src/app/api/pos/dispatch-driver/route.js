import { sendInfobipWhatsAppFreeForm } from "@/app/api/utils/infobipWhatsApp";

// Trigger deployment build 2026-08-10 18:05
export async function POST(request) {
  try {
    const body = await request.json();
    const { orderId, etaMinutes, phone } = body;
    const targetPhone = phone || "9613361515";
    const timeText = etaMinutes ? `${etaMinutes}'` : "15'";
    const messageText = `🛵 Hello, need driver in ${timeText}`;

    const apiResult = await sendInfobipWhatsAppFreeForm(targetPhone, messageText);

    return Response.json({
      success: true,
      apiSuccess: true,
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
