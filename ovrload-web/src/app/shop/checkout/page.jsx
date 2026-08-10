"use client";

import { useState, useEffect } from "react";

export default function CheckoutPage() {
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [orderType, setOrderType] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("orderType") || "delivery";
    }
    return "delivery";
  });
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [calculatedDeliveryFee, setCalculatedDeliveryFee] = useState(0);
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);
  const [pinnedLocation, setPinnedLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handlePinGPSLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      alert("Geolocation is not supported by your browser/device.");
      return;
    }
    setIsCalculatingFee(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        try {
          const res = await fetch("/api/delivery/calculate-cost", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              branchId: selectedBranch?.id || 1,
              latitude: lat,
              longitude: lng,
            }),
          });
          const data = await res.json();
          if (data.deliveryCost !== undefined && data.deliveryCost > 0) {
            setCalculatedDeliveryFee(data.deliveryCost);
            setPinnedLocation({ lat, lng, distanceKm: data.distanceKm });
            const gpsLabel = `GPS Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
            if (!deliveryAddress.trim() || deliveryAddress.startsWith("GPS Pinned Location")) {
              setDeliveryAddress(gpsLabel);
            }
          } else {
            alert(data.error || "Could not calculate delivery cost for your GPS location.");
          }
        } catch (err) {
          console.error("GPS calculation error:", err);
          alert("Error calculating distance from GPS position.");
        } finally {
          setIsCalculatingFee(false);
        }
      },
      (err) => {
        setIsCalculatingFee(false);
        alert("Unable to retrieve GPS location: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    const savedBranch = localStorage.getItem("selectedBranch");
    if (savedBranch) {
      try {
        const branch = JSON.parse(savedBranch);
        setSelectedBranch(branch);
      } catch (e) {
        console.error("Failed to parse saved branch:", e);
      }
    }

    // Set default date to today
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    setSelectedDate(dateStr);

    // Set default time to current hour + 2
    const defaultHour = (today.getHours() + 2) % 24;
    setSelectedTime(`${String(defaultHour).padStart(2, "0")}:00`);
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      fetchCart();
    }
  }, [selectedBranch]);

  // Calculate delivery fee dynamically when location/address changes
  useEffect(() => {
    if (orderType !== "delivery" || !deliveryAddress.trim() || !selectedBranch) {
      setCalculatedDeliveryFee(0);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCalculatingFee(true);
      try {
        const res = await fetch("/api/delivery/calculate-cost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId: selectedBranch.id,
            address: deliveryAddress.trim(),
          }),
        });
        const data = await res.json();
        if (data.deliveryCost !== undefined) {
          setCalculatedDeliveryFee(data.deliveryCost);
        }
      } catch (err) {
        console.error("Error calculating delivery cost:", err);
      } finally {
        setIsCalculatingFee(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [deliveryAddress, selectedBranch, orderType]);

  const fetchCart = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/cart?branch_id=${selectedBranch.id}`);
      const data = await response.json();
      if (data.unauthenticated) {
        alert("Please sign in or create an account to proceed to checkout.");
        window.location.href = "/account/signin?callbackUrl=/shop/checkout";
        return;
      }
      setCartItems(data.cart_items || []);
    } catch (error) {
      console.error("Error fetching cart:", error);
    } finally {
      setLoading(false);
    }
  };

  const subtotal = cartItems.reduce((sum, item) => {
    const itemTotal = Number(item.price) * Number(item.quantity);
    const addonsTotal = (item.addons || []).reduce((addonSum, addon) => {
      return addonSum + Number(addon.price) * Number(item.quantity);
    }, 0);
    return sum + itemTotal + addonsTotal;
  }, 0);

  const deliveryFee = orderType === "delivery" ? calculatedDeliveryFee : 0;
  const total = subtotal + deliveryFee;

  const isDeliveryBlocked = orderType === "delivery" && (isCalculatingFee || !deliveryAddress.trim() || calculatedDeliveryFee <= 0);

  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    if (cartItems.length === 0) {
      alert("Your cart is empty");
      return;
    }

    if (orderType === "delivery") {
      if (!deliveryAddress.trim()) {
        alert("Please enter a delivery address to calculate delivery fee.");
        return;
      }
      if (isCalculatingFee) {
        alert("Calculating delivery fee based on your location... Please wait a moment.");
        return;
      }
      if (!calculatedDeliveryFee || Number(calculatedDeliveryFee) <= 0) {
        alert("⚠️ Cannot submit order: Delivery fee is $0 or uncalculated. Please specify a valid delivery location and wait for fee calculation.");
        return;
      }
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: selectedBranch.id,
          order_type: orderType,
          scheduled_date: selectedDate,
          scheduled_time: selectedTime,
          delivery_address: orderType === "delivery" ? deliveryAddress : null,
          special_instructions: specialInstructions || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert("Order placed successfully!");
        window.location.href = "/shop";
      } else {
        const error = await response.json();
        alert(error.error || "Failed to place order");
      }
    } catch (error) {
      console.error("Error placing order:", error);
      alert("Failed to place order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#235b4e] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#666666]">Loading...</p>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <header className="sticky top-0 z-50 bg-white border-b border-[#E0E0E0] overflow-visible">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative overflow-visible">
            <div className="flex items-center justify-between h-24">
              {/* Overlapping Logo */}
              <a
                href="/shop"
                className="absolute -bottom-6 left-4 sm:left-6 lg:left-8 z-[60] bg-white rounded-2xl shadow-xl p-4 hover:shadow-2xl transition-shadow duration-300"
              >
                <img
                  src="https://ucarecdn.com/4f78cc02-ceb3-4858-bff8-6b70095dc4b8/-/format/auto/"
                  alt="NEO Beirut"
                  className="h-16 w-auto"
                />
              </a>

              <div className="w-32"></div>
              <h1 className="text-2xl font-bold text-[#235b4e]">Checkout</h1>
              <div className="w-12"></div>
            </div>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 pt-24 text-center">
          <svg
            className="w-24 h-24 mx-auto text-[#E0E0E0] mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
            />
          </svg>
          <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">
            Your Cart is Empty
          </h2>
          <p className="text-[#666666] mb-6">
            Add items to your cart before checking out
          </p>
          <a
            href="/shop"
            className="inline-block bg-[#235b4e] text-white px-8 py-3 rounded-lg hover:bg-[#2B6B5C] transition-colors font-medium"
          >
            Continue Shopping
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Overlapping Floating Logo */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#E0E0E0] overflow-visible">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative overflow-visible">
          <div className="flex items-center justify-between h-24">
            {/* Overlapping Logo */}
            <a
              href="/shop/cart"
              className="absolute -bottom-6 left-4 sm:left-6 lg:left-8 z-[60] bg-white rounded-2xl shadow-xl p-4 hover:shadow-2xl transition-shadow duration-300"
            >
              <img
                src="https://ucarecdn.com/4f78cc02-ceb3-4858-bff8-6b70095dc4b8/-/format/auto/"
                alt="NEO Beirut"
                className="h-16 w-auto"
              />
            </a>

            {/* Back Button */}
            <a
              href="/shop/cart"
              className="flex items-center gap-2 text-[#235b4e] hover:text-[#2B6B5C] ml-32"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </a>

            <h1 className="text-2xl font-bold text-[#235b4e]">Checkout</h1>
            <div className="w-16"></div>
          </div>
        </div>
      </header>

      {/* Main Content - padding top to clear overlapping logo */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-12">
        <form onSubmit={handlePlaceOrder}>
          {/* Order Type */}
          <div className="mb-8">
            <h2 className="text-1xl font-bold text-[#1A1A1A] mb-4">
              Order Type
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {/* Pickup Button on the LEFT */}
              <button
                type="button"
                onClick={() => {
                  setOrderType("pickup");
                  if (typeof window !== "undefined") localStorage.setItem("orderType", "pickup");
                }}
                className={`p-6 rounded-xl border-2 transition-all ${
                  orderType === "pickup"
                    ? "border-[#235b4e] bg-[#F0F5F3]"
                    : "border-[#E0E0E0] hover:border-[#235b4e]"
                }`}
              >
                <svg
                  className="w-8 h-8 mx-auto mb-2 text-[#235b4e]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
                <div className="font-semibold text-[#1A1A1A]">Pickup</div>
                <div className="text-xs text-[#666666] mt-1">Location not required • Free</div>
              </button>

              {/* Delivery Button on the RIGHT */}
              <button
                type="button"
                onClick={() => {
                  setOrderType("delivery");
                  if (typeof window !== "undefined") localStorage.setItem("orderType", "delivery");
                }}
                className={`p-6 rounded-xl border-2 transition-all ${
                  orderType === "delivery"
                    ? "border-[#235b4e] bg-[#F0F5F3]"
                    : "border-[#E0E0E0] hover:border-[#235b4e]"
                }`}
              >
                <svg
                  className="w-8 h-8 mx-auto mb-2 text-[#235b4e]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                  />
                </svg>
                <div className="font-semibold text-[#1A1A1A]">Delivery</div>
                <div className="text-xs text-[#666666] mt-1">Calculated when location selected</div>
              </button>
            </div>
          </div>

          {/* Delivery Address */}
          {orderType === "delivery" && (
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <h2 className="text-xl font-bold text-[#1A1A1A]">
                  Delivery Address & Location
                </h2>
                <button
                  type="button"
                  onClick={handlePinGPSLocation}
                  disabled={isCalculatingFee}
                  className="px-4 py-2 bg-[#235b4e] hover:bg-[#1a473d] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{isCalculatingFee ? "Locating..." : "📍 Pin My GPS Location"}</span>
                </button>
              </div>

              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Enter building name, street, apartment number or landmarks"
                rows={3}
                required={orderType === "delivery"}
                className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg focus:outline-none focus:border-[#235b4e]"
              />

              {pinnedLocation && (
                <div className="mt-2 p-3 bg-[#F0F5F3] border border-[#235b4e]/30 rounded-lg text-xs text-[#235b4e] font-medium flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📍</span>
                    <span>
                      GPS Location Pinned ({pinnedLocation.lat.toFixed(4)}, {pinnedLocation.lng.toFixed(4)})
                      {pinnedLocation.distanceKm ? ` • ${pinnedLocation.distanceKm} km away` : ""}
                    </span>
                  </div>
                  <span className="font-bold bg-[#235b4e] text-white px-2 py-0.5 rounded text-[11px]">
                    Delivery: ${calculatedDeliveryFee.toFixed(2)}
                  </span>
                </div>
              )}

              {isCalculatingFee && (
                <p className="text-xs text-[#235b4e] mt-2 font-medium flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-[#235b4e] border-t-transparent rounded-full animate-spin"></span>
                  Calculating exact distance and delivery fee...
                </p>
              )}
            </div>
          )}

          {/* Schedule */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#1A1A1A] mb-4">Schedule</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#666666] mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg focus:outline-none focus:border-[#235b4e]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#666666] mb-2">
                  Time
                </label>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg focus:outline-none focus:border-[#235b4e]"
                />
              </div>
            </div>
          </div>

          {/* Special Instructions */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#1A1A1A] mb-4">
              Special Instructions
            </h2>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Any special requests? (Optional)"
              rows={3}
              className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg focus:outline-none focus:border-[#235b4e]"
            />
          </div>

          {/* Order Summary & Final Amounts (at the bottom) */}
          <div className="bg-[#F9F9F9] border border-[#E5E5E5] rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-[#1A1A1A] mb-4 flex items-center justify-between">
              <span>Order Summary & Payment</span>
              <span className="text-xs font-normal text-[#666666]">
                {cartItems.length} item{cartItems.length !== 1 ? "s" : ""}
              </span>
            </h2>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-[#666666]">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#666666]">
                <span>Delivery Fee</span>
                <span className="font-semibold text-[#1A1A1A]">
                  {orderType === "pickup"
                    ? "$0.00 (Pickup)"
                    : isCalculatingFee
                    ? "Calculating..."
                    : calculatedDeliveryFee > 0
                    ? `$${calculatedDeliveryFee.toFixed(2)}${pinnedLocation?.distanceKm ? ` (${pinnedLocation.distanceKm} km)` : ""}`
                    : "$0.00 (📍 Pin location above)"}
                </span>
              </div>
              <div className="border-t border-[#E0E0E0] pt-3 flex justify-between items-baseline">
                <span className="text-lg font-bold text-[#1A1A1A]">Total Amount</span>
                <span className="text-2xl font-bold text-[#235b4e]">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Warning banner if delivery calculation is missing/pending */}
          {orderType === "delivery" && isDeliveryBlocked && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 font-bold flex items-start gap-2.5 shadow-sm">
              <span className="text-lg leading-none">⚠️</span>
              <div>
                <p className="font-bold text-sm mb-0.5">Location Pin & Delivery Fee Required</p>
                <p className="font-normal text-amber-800">
                  {isCalculatingFee
                    ? "Calculating delivery fee for your location... Please wait."
                    : !deliveryAddress.trim()
                    ? "Please click '📍 Pin My GPS Location' or enter your delivery address to calculate the delivery fee before placing your order."
                    : "Delivery fee calculation pending or location invalid ($0 fee). Click '📍 Pin My GPS Location' above to calculate fee based on distance."}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              type="submit"
              disabled={submitting || isDeliveryBlocked}
              className="w-full bg-[#235b4e] text-white px-6 py-4 rounded-xl hover:bg-[#1a473d] transition-all font-bold text-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting
                ? "Placing Order..."
                : isDeliveryBlocked
                ? isCalculatingFee
                  ? "Calculating Delivery Fee..."
                  : "Pin Location to Calculate Delivery Fee"
                : `Place Order • $${total.toFixed(2)}`}
            </button>

            {/* WhatsApp Order Option */}
            <button
              type="button"
              disabled={isDeliveryBlocked}
              onClick={() => {
                if (isDeliveryBlocked) return;
                const itemsText = cartItems.map(i => `• ${i.quantity}x ${i.name || "Item"} ($${(i.price * i.quantity).toFixed(2)})`).join("\n");
                const locLink = pinnedLocation ? `\n📍 GPS Location: https://maps.google.com/?q=${pinnedLocation.lat},${pinnedLocation.lng}` : "";
                const msg = `🛒 *New Order from Web Shop*\n\n*Order Type:* ${orderType.toUpperCase()}\n*Branch:* ${selectedBranch?.name || "Ovrload"}\n\n*Items:*\n${itemsText}\n\n*Subtotal:* $${subtotal.toFixed(2)}\n*Delivery Fee:* $${deliveryFee.toFixed(2)}\n*Total:* $${total.toFixed(2)}\n\n*Delivery Address:* ${deliveryAddress || "Not specified"}${locLink}\n*Schedule:* ${selectedDate} ${selectedTime}`;
                const waUrl = `https://wa.me/96176489078?text=${encodeURIComponent(msg)}`;
                window.open(waUrl, "_blank");
              }}
              className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white px-6 py-3.5 rounded-xl font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>💬 Order via WhatsApp</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
