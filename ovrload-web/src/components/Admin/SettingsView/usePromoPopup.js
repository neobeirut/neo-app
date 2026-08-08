import { useState, useEffect } from "react";
import { getAdminHeaders } from "@/utils/adminAuth";
import { DEFAULT_PROMO } from "./constants";

export function usePromoPopup() {
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoError, setPromoError] = useState(null);
  const [promoUpdatedAt, setPromoUpdatedAt] = useState(null);
  const [promo, setPromo] = useState(DEFAULT_PROMO);
  const [products, setProducts] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setPromoLoading(true);
      setPromoError(null);

      try {
        const [promoRes, productsRes, eventsRes] = await Promise.all([
          fetch("/api/settings/promo-popup"),
          fetch("/api/products"),
          fetch("/api/events/admin?timing=all&status=all&limit=100", {
            headers: getAdminHeaders(),
          }),
        ]);

        if (!promoRes.ok) {
          throw new Error(
            `Failed to load promo popup settings (status ${promoRes.status})`,
          );
        }

        const promoData = await promoRes.json();
        const nextPromo = promoData?.promo_popup || DEFAULT_PROMO;
        const nextUpdatedAt = promoData?.updated_at || null;

        let nextProducts = [];
        if (productsRes.ok) {
          const productsData = await productsRes.json();
          nextProducts = Array.isArray(productsData?.products)
            ? productsData.products
            : [];
        }

        let nextEvents = [];
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          nextEvents = Array.isArray(eventsData?.events)
            ? eventsData.events
            : [];
        }

        if (cancelled) return;

        setPromo({ ...DEFAULT_PROMO, ...nextPromo });
        setPromoUpdatedAt(nextUpdatedAt);
        setProducts(nextProducts);
        setEvents(nextEvents);
      } catch (error) {
        console.error("Error loading promo popup settings:", error);
        if (!cancelled) {
          setPromoError(
            error?.message || "Failed to load promo popup settings",
          );
          setPromo({ ...DEFAULT_PROMO });
          setPromoUpdatedAt(null);
        }
      } finally {
        if (!cancelled) setPromoLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSavePromo = async (e) => {
    e.preventDefault();
    setPromoSaving(true);
    setPromoError(null);

    try {
      const payload = {
        promo_popup: {
          ...promo,
        },
      };

      const response = await fetch("/api/settings/promo-popup", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg = err?.error
          ? String(err.error)
          : `Failed to save promo popup (status ${response.status})`;
        throw new Error(msg);
      }

      // Re-fetch
      const promoRes = await fetch("/api/settings/promo-popup");
      if (promoRes.ok) {
        const promoData = await promoRes.json();
        setPromo({ ...DEFAULT_PROMO, ...(promoData?.promo_popup || {}) });
        setPromoUpdatedAt(promoData?.updated_at || null);
      }

      alert("Promo popup updated successfully!");
    } catch (error) {
      console.error("Error saving promo popup:", error);
      const message = error?.message || "Failed to save promo popup";

      const needsLogin =
        typeof message === "string" &&
        (message.toLowerCase().includes("unauthorized") ||
          message.toLowerCase().includes("401"));

      if (needsLogin) {
        alert("Your admin login expired. Please log in again.");
      } else {
        alert(message);
      }

      setPromoError(message);
    } finally {
      setPromoSaving(false);
    }
  };

  return {
    promo,
    setPromo,
    promoLoading,
    promoSaving,
    promoError,
    setPromoError,
    promoUpdatedAt,
    products,
    events,
    handleSavePromo,
  };
}
