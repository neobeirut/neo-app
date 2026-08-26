import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getBeirutTimeInfo,
  isOverloadClosed,
  hasAutoReplyBeenSent,
  recordAutoReplySent,
  sendClosedAutoReply,
  normalizePhoneForInfobip,
  CLOSED_AUTO_RESPONSE_TEXT,
} from "../utils/whatsappAfterHours.js";
import { POST, GET } from "./route.js";

describe("OVRLOAD WhatsApp After-Hours & Webhook", () => {
  describe("Beirut Timezone & Operating Hours", () => {
    it("should recognize Monday 11:59 AM as closed", () => {
      const monMorning = new Date("2026-08-24T08:59:00Z"); // 11:59 Beirut (UTC+3)
      const info = getBeirutTimeInfo(monMorning);
      expect(info.weekday).toBe("Monday");
      expect(info.hour).toBe(11);
      expect(info.isNormallyClosed).toBe(true);
    });

    it("should recognize Monday 12:00 PM as open", () => {
      const monNoon = new Date("2026-08-24T09:00:00Z"); // 12:00 Beirut
      const info = getBeirutTimeInfo(monNoon);
      expect(info.weekday).toBe("Monday");
      expect(info.hour).toBe(12);
      expect(info.isNormallyClosed).toBe(false);
    });

    it("should recognize Monday 10:59 PM as open", () => {
      const monLateEvening = new Date("2026-08-24T19:59:00Z"); // 22:59 Beirut
      const info = getBeirutTimeInfo(monLateEvening);
      expect(info.weekday).toBe("Monday");
      expect(info.hour).toBe(22);
      expect(info.isNormallyClosed).toBe(false);
    });

    it("should recognize Monday 11:00 PM as closed", () => {
      const monNight = new Date("2026-08-24T20:00:00Z"); // 23:00 Beirut
      const info = getBeirutTimeInfo(monNight);
      expect(info.weekday).toBe("Monday");
      expect(info.hour).toBe(23);
      expect(info.isNormallyClosed).toBe(true);
    });

    it("should recognize Sunday all day as closed", () => {
      const sunMidnight = new Date("2026-08-29T21:00:00Z"); // 00:00 Beirut Sunday
      const sunAfternoon = new Date("2026-08-30T12:00:00Z"); // 15:00 Beirut Sunday
      expect(getBeirutTimeInfo(sunMidnight).isNormallyClosed).toBe(true);
      expect(getBeirutTimeInfo(sunAfternoon).isNormallyClosed).toBe(true);
    });

    it("should treat Saturday night through Monday 12:00 PM as a continuous closed period", () => {
      const satNight = new Date("2026-08-29T20:15:00Z"); // Sat 23:15 Beirut
      const sunAfternoon = new Date("2026-08-30T11:30:00Z"); // Sun 14:30 Beirut
      const monMorning = new Date("2026-08-31T05:45:00Z"); // Mon 08:45 Beirut

      const satInfo = getBeirutTimeInfo(satNight);
      const sunInfo = getBeirutTimeInfo(sunAfternoon);
      const monInfo = getBeirutTimeInfo(monMorning);

      expect(satInfo.periodId).toBe("closed_until_2026-08-31_12:00");
      expect(sunInfo.periodId).toBe("closed_until_2026-08-31_12:00");
      expect(monInfo.periodId).toBe("closed_until_2026-08-31_12:00");
    });
  });

  describe("Testing Mode (WHATSAPP_FORCE_CLOSED)", () => {
    const originalEnv = process.env.WHATSAPP_FORCE_CLOSED;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.WHATSAPP_FORCE_CLOSED = originalEnv;
      } else {
        delete process.env.WHATSAPP_FORCE_CLOSED;
      }
    });

    it("should force closed state when WHATSAPP_FORCE_CLOSED is true", () => {
      process.env.WHATSAPP_FORCE_CLOSED = "true";
      const monNoon = new Date("2026-08-24T09:00:00Z"); // 12:00 Beirut
      const result = isOverloadClosed(monNoon);
      expect(result.isClosed).toBe(true);
      expect(result.isForceClosed).toBe(true);
    });

    it("should respect normal business hours when WHATSAPP_FORCE_CLOSED is false or unset", () => {
      process.env.WHATSAPP_FORCE_CLOSED = "false";
      const monNoon = new Date("2026-08-24T09:00:00Z");
      const result = isOverloadClosed(monNoon);
      expect(result.isClosed).toBe(false);
      expect(result.isForceClosed).toBe(false);
    });
  });

  describe("Duplicate Prevention", () => {
    it("should prevent duplicate auto-replies within the same closed period", async () => {
      const phone = "96181999111";
      const period = "closed_until_2026-08-25_12:00";

      const before = await hasAutoReplyBeenSent(phone, period);
      expect(before).toBe(false);

      await recordAutoReplySent(phone, period);

      const after = await hasAutoReplyBeenSent(phone, period);
      expect(after).toBe(true);
    });
  });

  describe("Outbound Message Construction", () => {
    it("should have the exact required text and emojis", () => {
      expect(CLOSED_AUTO_RESPONSE_TEXT).toContain("Thanks for reaching out to OVRLOAD! 🌯");
      expect(CLOSED_AUTO_RESPONSE_TEXT).toContain("https://ovrload-nine.vercel.app/");
      expect(CLOSED_AUTO_RESPONSE_TEXT).toContain("See you soon! 🧡");
    });
  });

  describe("HTTP Webhook Handlers", () => {
    it("GET should return 200 with service info", async () => {
      const req = new Request("http://localhost:8080/api/whatsapp-webhook");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.endpoint).toBe("/api/whatsapp-webhook");
    });

    it("GET should return verification challenge if requested", async () => {
      const req = new Request("http://localhost:8080/api/whatsapp-webhook?challenge=my-verify-token");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("my-verify-token");
    });

    it("POST should handle empty payload without errors", async () => {
      const req = new Request("http://localhost:8080/api/whatsapp-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });
  });
});
