/**
 * In-Memory Realtime SSE Broadcaster for WhatsApp Live Chat
 * Manages connected SSE client streams and distributes events:
 * - whatsapp.message.received
 * - whatsapp.message.sent
 * - whatsapp.message.updated
 * - whatsapp.conversation.updated
 */

// Use globalThis to preserve connection pool across Hono / Vite module reloads in dev & prod
if (!globalThis.__whatsappSSEClients) {
  globalThis.__whatsappSSEClients = new Set();
}

const clients = globalThis.__whatsappSSEClients;

export function addSSEClient(controller) {
  clients.add(controller);
  console.log(`[SSE] Client connected. Total active clients: ${clients.size}`);

  // Send initial ping
  try {
    controller.enqueue(
      new TextEncoder().encode(`: connected\n\nevent: ping\ndata: {"time":${Date.now()}}\n\n`)
    );
  } catch (e) {
    clients.delete(controller);
  }
}

export function removeSSEClient(controller) {
  clients.delete(controller);
  console.log(`[SSE] Client disconnected. Remaining clients: ${clients.size}`);
}

export function broadcastWhatsAppEvent(eventType, payload) {
  if (clients.size === 0) return;

  const dataStr = JSON.stringify({
    event: eventType,
    data: payload,
    timestamp: Date.now(),
  });

  const message = `event: ${eventType}\ndata: ${dataStr}\n\n`;
  const encoded = new TextEncoder().encode(message);

  const deadClients = [];
  for (const client of clients) {
    try {
      client.enqueue(encoded);
    } catch (err) {
      deadClients.push(client);
    }
  }

  for (const dead of deadClients) {
    clients.delete(dead);
  }
}
