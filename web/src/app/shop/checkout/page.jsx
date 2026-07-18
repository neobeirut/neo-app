"use client";

import { useState, useEffect } from "react";

export default function CheckoutPage() {
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [orderType, setOrderType] = useState("delivery");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  const fetchCart = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/cart?branch_id=${selectedBranch.id}`);
      const data = await response.json();
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

  const deliveryFee = orderType === "delivery" ? 5.0 : 0;
  const total = subtotal + deliveryFee;

  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    if (cartItems.length === 0) {
      alert("Your cart is empty");
      return;
    }

    if (orderType === "delivery" && !deliveryAddress.trim()) {
      alert("Please enter a delivery address");
      return;
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
            <h2 className="text-xl font-bold text-[#1A1A1A] mb-4">
              Order Type
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setOrderType("delivery")}
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
              </button>
              <button
                type="button"
                onClick={() => setOrderType("pickup")}
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
              </button>
            </div>
          </div>

          {/* Delivery Address */}
          {orderType === "delivery" && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-[#1A1A1A] mb-4">
                Delivery Address
              </h2>
              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Enter your delivery address"
                rows={3}
                required={orderType === "delivery"}
                className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg focus:outline-none focus:border-[#235b4e]"
              />
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

          {/* Order Summary */}
          <div className="bg-[#F9F9F9] rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold text-[#1A1A1A] mb-4">
              Order Summary
            </h2>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-[#666666]">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {orderType === "delivery" && (
                <div className="flex justify-between text-[#666666]">
                  <span>Delivery Fee</span>
                  <span>${deliveryFee.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-[#E0E0E0] pt-3 flex justify-between">
                <span className="text-lg font-bold text-[#1A1A1A]">Total</span>
                <span className="text-2xl font-bold text-[#235b4e]">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="text-sm text-[#666666] mb-4">
              {cartItems.length} item{cartItems.length !== 1 ? "s" : ""} •{" "}
              {selectedBranch?.name}
            </div>
          </div>

          {/* Place Order Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#235b4e] text-white px-6 py-4 rounded-lg hover:bg-[#2B6B5C] transition-colors font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? "Placing Order..."
              : `Place Order - $${total.toFixed(2)}`}
          </button>
        </form>
      </main>
    </div>
  );
}
