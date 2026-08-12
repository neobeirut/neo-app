"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Load QRCode library dynamically (no next/script — React Router app)
function useQRScript() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // useEffect only runs client-side, so window is always defined here
    if (typeof window !== "undefined" && window.QRCode) { setReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);
  return ready;
}

export default function DriverPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [activeOrder, setActiveOrder] = useState(null);
  const [pickingUp, setPickingUp] = useState(false);
  const [toast, setToast] = useState(null);
  const qrReady = useQRScript();
  const qrRef = useRef(null);
  const qrInstanceRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const timeAgo = (iso) => {
    const s = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (s < 60) return s + "s ago";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    return Math.floor(s / 3600) + "h ago";
  };

  const cleanAddr = (addr) =>
    (addr || "")
      .replace(/\[Maps Pin:.*?\]/gi, "")
      .replace(/[\r\n]+/g, " ")
      .trim();

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders/pending-delivery");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      setOrders(data);
      setConnected(true);
    } catch (err) {
      setConnected(false);
      showToast("⚠️ " + (err.message || "Could not load orders"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  // Generate QR when modal opens
  useEffect(() => {
    if (!activeOrder || !qrReady || !qrRef.current) return;
    if (qrInstanceRef.current) {
      qrRef.current.innerHTML = "";
      qrInstanceRef.current = null;
    }
    const url = `https://ovrload-nine.vercel.app/driver/scan?orderId=${activeOrder.id}`;
    qrInstanceRef.current = new window.QRCode(qrRef.current, {
      text: url,
      width: 220,
      height: 220,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: window.QRCode.CorrectLevel.M,
    });
  }, [activeOrder, qrReady]);

  const markPickedUp = async () => {
    if (!activeOrder) return;
    setPickingUp(true);
    try {
      const res = await fetch(`/api/orders/driver-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: activeOrder.id, status: "completed" }),
      });
      if (res.ok) {
        setActiveOrder(null);
        showToast("✅ Order #" + activeOrder.id + " marked as picked up");
        loadOrders();
      } else {
        showToast("⚠️ Failed to update order");
      }
    } catch {
      showToast("⚠️ Connection error");
    } finally {
      setPickingUp(false);
    }
  };

  const activeStatuses = ["pending", "accepted", "preparing", "ready", "out_for_delivery"];

  const badgeStyle = (status) => {
    const map = {
      pending:          { bg: "rgba(255,193,7,0.15)",  color: "#ffc107", border: "rgba(255,193,7,0.3)" },
      accepted:         { bg: "rgba(66,165,245,0.15)", color: "#42a5f5", border: "rgba(66,165,245,0.3)" },
      preparing:        { bg: "rgba(255,152,0,0.15)",  color: "#ff9800", border: "rgba(255,152,0,0.3)" },
      ready:            { bg: "rgba(37,211,102,0.15)", color: "#25d366", border: "rgba(37,211,102,0.3)" },
      out_for_delivery: { bg: "rgba(171,71,188,0.15)", color: "#ab47bc", border: "rgba(171,71,188,0.3)" },
      completed:        { bg: "rgba(255,255,255,0.05)", color: "#5e5e62", border: "rgba(255,255,255,0.08)" },
    };
    return map[status] || map.completed;
  };

  const badgeLabel = (status) => ({
    pending: "⏳ Pending", accepted: "● Accepted", preparing: "🔥 Preparing",
    ready: "✓ Ready", out_for_delivery: "🛵 On the way", completed: "Completed",
  }[status] || status);

  return (
    <>
      <div style={{ background: "#0a0a0a", minHeight: "100vh", fontFamily: "-apple-system, 'Outfit', BlinkMacSystemFont, sans-serif", color: "#fff" }}>

        {/* Header */}
        <header style={{ background: "#141414", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0.9rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ color: "#e66e19", fontWeight: 800, fontSize: "1.2rem" }}>OVR</span>
            <span style={{ color: "#5e5e62" }}>/</span>
            <span style={{ color: "#8e8e93", fontWeight: 600, fontSize: "0.85rem" }}>Driver Dispatch</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#25d366" : "#ff4a4a", boxShadow: `0 0 6px ${connected ? "#25d366" : "#ff4a4a"}`, animation: "pulse 2s infinite" }} />
            <button
              onClick={() => { loadOrders(); showToast("Refreshed"); }}
              style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.08)", color: "#8e8e93", padding: "0.4rem 0.85rem", borderRadius: 8, fontSize: "0.8rem", cursor: "pointer" }}
            >
              ↻ Refresh
            </button>
          </div>
        </header>

        {/* List */}
        <div style={{ padding: "1rem", maxWidth: 640, margin: "0 auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "5rem", color: "#5e5e62" }}>Loading orders...</div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: "center", padding: "5rem 2rem" }}>
              <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🛵</div>
              <div style={{ color: "#8e8e93", fontSize: "1rem", marginBottom: "0.4rem" }}>No active delivery orders</div>
              <div style={{ color: "#5e5e62", fontSize: "0.82rem" }}>New orders will appear here automatically</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5e5e62", marginBottom: "0.6rem" }}>
                Active — {orders.length} order{orders.length > 1 ? "s" : ""}
              </div>
              {orders.map((o) => <OrderCard key={o.id} o={o} onOpen={setActiveOrder} timeAgo={timeAgo} cleanAddr={cleanAddr} badgeStyle={badgeStyle} badgeLabel={badgeLabel} />)}
            </>
          )}
        </div>

        {/* QR Modal */}
        {activeOrder && (
          <div
            onClick={(e) => { if (e.target === e.currentTarget) setActiveOrder(null); }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
          >
            <div style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 24, padding: "1.75rem 1.5rem 1.5rem", maxWidth: 380, width: "100%", textAlign: "center" }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#e66e19", marginBottom: "0.2rem" }}>
                Order #{activeOrder.id}
              </div>
              <div style={{ fontSize: "0.88rem", color: "#8e8e93", marginBottom: "0.2rem" }}>
                👤 {activeOrder.customer_name || "Customer"}
                {activeOrder.customer_phone && <span>  ·  {activeOrder.customer_phone}</span>}
              </div>
              {cleanAddr(activeOrder.delivery_address) && (
                <div style={{ fontSize: "0.78rem", color: "#5e5e62", marginBottom: "1.25rem" }}>
                  📍 {cleanAddr(activeOrder.delivery_address)}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "center", background: "#fff", borderRadius: 16, padding: "1rem", marginBottom: "0.75rem" }}>
                <div ref={qrRef} />
              </div>
              <div style={{ fontSize: "0.78rem", color: "#5e5e62", marginBottom: "1.25rem", lineHeight: 1.5 }}>
                Driver: scan with phone camera to receive delivery details on WhatsApp
              </div>
              <div style={{ display: "flex", gap: "0.65rem" }}>
                <button
                  onClick={markPickedUp}
                  disabled={pickingUp}
                  style={{ flex: 1, padding: "0.85rem", background: "#25d366", color: "#fff", fontWeight: 700, fontSize: "0.9rem", border: "none", borderRadius: 12, cursor: "pointer", opacity: pickingUp ? 0.7 : 1 }}
                >
                  {pickingUp ? "Updating..." : "✅ Mark as Picked Up"}
                </button>
                <button
                  onClick={() => setActiveOrder(null)}
                  style={{ padding: "0.85rem 1rem", background: "#1e1e1e", color: "#8e8e93", fontSize: "0.9rem", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{ position: "fixed", bottom: "2rem", left: "50%", transform: "translateX(-50%)", background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "0.6rem 1.2rem", borderRadius: 10, fontSize: "0.82rem", zIndex: 9999, whiteSpace: "nowrap" }}>
            {toast}
          </div>
        )}

        <style>{`
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        `}</style>
      </div>
    </>
  );
}

function OrderCard({ o, onOpen, timeAgo, cleanAddr, badgeStyle, badgeLabel }) {
  const bs = badgeStyle(o.status);
  const items = (o.items || []).filter((i) => i?.product_name).map((i) => `${i.quantity}x ${i.product_name}`).join(" • ") || "—";
  const addr = cleanAddr(o.delivery_address);

  return (
    <div
      onClick={() => onOpen(o)}
      style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "1rem 1.1rem", marginBottom: "0.75rem", cursor: "pointer", userSelect: "none", WebkitTapHighlightColor: "transparent", transition: "border-color 0.15s" }}
      onTouchStart={(e) => e.currentTarget.style.borderColor = "#e66e19"}
      onTouchEnd={(e) => { setTimeout(() => { if(e.currentTarget) e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }, 200); }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
        <span style={{ fontSize: "1rem", fontWeight: 700, color: "#e66e19" }}>#{o.id}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: bs.bg, color: bs.color, border: `1px solid ${bs.border}`, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {badgeLabel(o.status)}
          </span>
          <span style={{ fontSize: "0.7rem", color: "#5e5e62" }}>{timeAgo(o.created_at)}</span>
        </div>
      </div>
      <div style={{ fontSize: "0.92rem", color: "#8e8e93", marginBottom: 2 }}>👤 {o.customer_name || "Customer"}</div>
      {addr && <div style={{ fontSize: "0.78rem", color: "#5e5e62", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {addr}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.55rem" }}>
        <span style={{ fontSize: "0.75rem", color: "#5e5e62", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: "0.75rem" }}>🛒 {items}</span>
        <span style={{ fontSize: "0.95rem", fontWeight: 700 }}>${Number(o.total_amount || 0).toFixed(2)}</span>
      </div>
    </div>
  );
}
