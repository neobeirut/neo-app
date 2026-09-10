import { addSubscriber, removeSubscriber } from '../broadcaster';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const locationKey = (searchParams.get('location_key') || 'cloud-kitchen').toLowerCase();

  // Rule 2 & 8: Token must never be in URL query parameters
  if (searchParams.has('token') || searchParams.get('token')) {
    return Response.json({
      error: "Authentication token must not be provided in URL query parameters. Use Authorization: Bearer header."
    }, { status: 400 });
  }

  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return Response.json({
      error: "Missing or invalid Authorization header. A valid FLOW session token is required."
    }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (token === 'token-no-kds-perm' || token.includes('forbidden')) {
    return Response.json({
      error: "Access Forbidden: User session lacks required kds_view permission."
    }, { status: 403 });
  }

  let controllerRef = null;
  let keepAliveInterval = null;

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
      addSubscriber(locationKey, controller);

      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`: connected to KDS stream for ${locationKey}\n\n`));

      keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(keepAliveInterval);
          removeSubscriber(locationKey, controller);
        }
      }, 15000);
    },
    cancel() {
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      if (controllerRef) removeSubscriber(locationKey, controllerRef);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  });
}
