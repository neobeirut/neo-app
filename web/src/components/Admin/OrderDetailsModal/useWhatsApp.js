import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { getAdminHeaders } from "./utils";

export function useWhatsApp(
  orderId,
  openWhatsAppOnMount,
  onWhatsAppAutoOpenHandled,
) {
  const [waOpen, setWaOpen] = useState(false);
  const [waPreview, setWaPreview] = useState("");
  const [waLoading, setWaLoading] = useState(false);
  const [waSending, setWaSending] = useState(false);
  const [waCanSend, setWaCanSend] = useState(true);
  const [waReason, setWaReason] = useState(null);
  const [waForceNext, setWaForceNext] = useState(false);

  const loadWhatsAppPreview = useCallback(async () => {
    try {
      console.log(`[useWhatsApp] 📋 Loading preview for order ${orderId}...`);
      setWaLoading(true);
      setWaReason(null);
      setWaCanSend(true);
      setWaForceNext(false);

      const headers = getAdminHeaders();

      console.log(
        `[useWhatsApp] 🌐 Sending dryRun request to /api/admin/orders/send-whatsapp`,
      );

      const response = await fetch("/api/admin/orders/send-whatsapp", {
        method: "POST",
        headers,
        body: JSON.stringify({ orderId, dryRun: true }),
      });

      console.log(`[useWhatsApp] 📥 Response received:`, {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
      });

      const data = await response.json().catch(() => ({}));
      console.log(`[useWhatsApp] 📦 Response data:`, data);

      const preview = data?.preview ? String(data.preview) : "";
      setWaPreview(preview);

      if (!response.ok || data?.ok === false) {
        const err =
          data?.error ||
          `Failed to prepare WhatsApp preview (${response.status})`;
        console.error(`[useWhatsApp] ❌ Preview failed:`, err);
        setWaCanSend(false);
        setWaReason(String(err));
        return;
      }

      const sentRecently = data?.sentRecently === true;
      if (sentRecently) {
        setWaForceNext(true);
        console.log(
          `[useWhatsApp] ⚠️ WhatsApp was sent recently for this order`,
        );
      }

      setWaCanSend(true);
      console.log(`[useWhatsApp] ✅ Preview loaded successfully`);
    } catch (e) {
      console.error("[useWhatsApp] 💥 Exception during preview:", e);
      setWaCanSend(false);
      setWaReason("Could not load WhatsApp preview");
    } finally {
      setWaLoading(false);
    }
  }, [orderId]);

  const openWhatsApp = useCallback(async () => {
    console.log(`[useWhatsApp] 🚀 Opening WhatsApp modal for order ${orderId}`);
    setWaOpen(true);
    await loadWhatsAppPreview();
  }, [orderId, loadWhatsAppPreview]);

  useEffect(() => {
    if (openWhatsAppOnMount) {
      openWhatsApp();
      if (typeof onWhatsAppAutoOpenHandled === "function") {
        onWhatsAppAutoOpenHandled();
      }
    }
  }, [openWhatsAppOnMount, openWhatsApp, onWhatsAppAutoOpenHandled]);

  const handleSendWhatsApp = async () => {
    try {
      console.log(`[useWhatsApp] 🚀 Sending WhatsApp for order ${orderId}...`);

      if (!waCanSend) {
        console.log(`[useWhatsApp] ❌ Cannot send - waCanSend is false`);
        return;
      }

      const ok = confirm(
        waForceNext
          ? "WhatsApp was already sent recently. Send again?"
          : "Send WhatsApp for Delivery to the store?",
      );

      if (!ok) {
        console.log(`[useWhatsApp] ❌ User cancelled send`);
        return;
      }

      setWaSending(true);

      const headers = getAdminHeaders();

      console.log(
        `[useWhatsApp] 🌐 Sending REAL request to /api/admin/orders/send-whatsapp`,
      );
      console.log(`[useWhatsApp] 📤 Request body:`, {
        orderId,
        force: waForceNext,
      });

      const response = await fetch("/api/admin/orders/send-whatsapp", {
        method: "POST",
        headers,
        body: JSON.stringify({
          orderId,
          force: waForceNext,
        }),
      });

      console.log(`[useWhatsApp] 📥 Response received:`, {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
      });

      const data = await response.json().catch(() => ({}));
      console.log(`[useWhatsApp] 📦 Response data:`, data);

      if (!response.ok || data?.ok === false) {
        // Special case: backend asks for confirmation (already sent recently)
        if (data?.requireConfirm) {
          setWaForceNext(true);
          console.log(`[useWhatsApp] ⚠️ Requires force confirmation`);
          toast.message(
            "This order was messaged recently — tap Send again to confirm.",
          );
          return;
        }

        const err =
          data?.error || `Failed to send WhatsApp (${response.status})`;
        console.error(`[useWhatsApp] ❌ Send failed:`, err);
        toast.error(String(err));
        return;
      }

      console.log(`[useWhatsApp] ✅ WhatsApp sent successfully!`);
      toast.success("WhatsApp sent");
      setWaOpen(false);
    } catch (e) {
      console.error("[useWhatsApp] 💥 Exception during send:", e);
      toast.error("Could not send WhatsApp");
    } finally {
      setWaSending(false);
    }
  };

  return {
    waOpen,
    setWaOpen,
    waPreview,
    waLoading,
    waSending,
    waCanSend,
    waReason,
    waForceNext,
    openWhatsApp,
    loadWhatsAppPreview,
    handleSendWhatsApp,
  };
}
