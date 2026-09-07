import { addSSEClient, removeSSEClient } from "@/app/api/utils/realtimeBroadcaster";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

export async function GET(request) {
  const admin = await getAdminWithRolesFromRequest(request);
  if (!admin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let clientController = null;

  const stream = new ReadableStream({
    start(controller) {
      clientController = controller;
      addSSEClient(controller);
    },
    cancel() {
      if (clientController) {
        removeSSEClient(clientController);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
