import crypto from 'crypto';

// In-memory registry of active SSE stream listeners mapped by location_key
const subscribers = new Map();

export function addSubscriber(locationKey, controller) {
  const loc = (locationKey || 'default').toLowerCase();
  if (!subscribers.has(loc)) {
    subscribers.set(loc, new Set());
  }
  subscribers.get(loc).add(controller);
}

export function removeSubscriber(locationKey, controller) {
  const loc = (locationKey || 'default').toLowerCase();
  if (subscribers.has(loc)) {
    subscribers.get(loc).delete(controller);
    if (subscribers.get(loc).size === 0) {
      subscribers.delete(loc);
    }
  }
}

export function broadcastKdsEvent(locationKey, eventType, data = {}) {
  const loc = (locationKey || 'default').toLowerCase();
  const eventId = crypto.randomUUID();
  const payload = JSON.stringify({
    event_id: eventId,
    type: eventType,
    location_key: loc,
    timestamp: new Date().toISOString(),
    ...data
  });

  const msg = `id: ${eventId}\nevent: ${eventType}\ndata: ${payload}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(msg);

  // Broadcast to this specific location
  const locSubs = subscribers.get(loc);
  if (locSubs) {
    for (const controller of locSubs) {
      try {
        controller.enqueue(encoded);
      } catch (err) {
        locSubs.delete(controller);
      }
    }
  }

  // Also broadcast to global listeners if any
  const allSubs = subscribers.get('*');
  if (allSubs) {
    for (const controller of allSubs) {
      try {
        controller.enqueue(encoded);
      } catch (err) {
        allSubs.delete(controller);
      }
    }
  }
}
