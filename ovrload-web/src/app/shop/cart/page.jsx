"use client";

import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";

export default function CartPage() {
  const { user, loading: userLoading } = useUser();
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      fetchCart();
    }
  }, [selectedBranch]);

  const fetchCart = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/cart?branch_id=${selectedBranch.id}`, {
        credentials: "include", // ✅ Include cookies for JWT auth
      });
      const data = await response.json();
      setCartItems(data.cart_items || []);
    } catch (error) {
      console.error("Error fetching cart:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId, newQuantity) => {
    if (newQuantity < 1) {
      await removeItem(itemId);
      return;
    }

    try {
      const response = await fetch("/api/cart/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // ✅ Include cookies for JWT auth
        body: JSON.stringify({
          cart_item_id: itemId,
          quantity: newQuantity,
        }),
      });

      if (response.ok) {
        fetchCart();
      }
    } catch (error) {
      console.error("Error updating quantity:", error);
    }
  };

  const removeItem = async (itemId) => {
    try {
      const response = await fetch(`/api/cart?id=${itemId}`, {
        method: "DELETE",
        credentials: "include", // ✅ Include cookies for JWT auth
      });

      if (response.ok) {
        fetchCart();
      }
    } catch (error) {
      console.error("Error removing item:", error);
    }
  };

  const subtotal = cartItems.reduce((sum, item) => {
    const itemTotal = Number(item.price) * Number(item.quantity);
    const addonsTotal = (item.addons || []).reduce((addonSum, addon) => {
      return addonSum + Number(addon.price) * Number(item.quantity);
    }, 0);
    return sum + itemTotal + addonsTotal;
  }, 0);

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Overlapping Floating Logo */}
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

            {/* Spacer for logo */}
            <div className="w-32"></div>

            <h1 className="text-2xl font-bold text-[#235b4e]">Cart</h1>
            <div className="w-12"></div>
          </div>
        </div>
      </header>

      {/* Main Content - padding top to clear overlapping logo */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-12">
        {!user && !userLoading ? (
          <div className="text-center py-20">
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
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">
              Sign In Required
            </h2>
            <p className="text-[#666666] mb-6">
              Please sign in to view your cart
            </p>
            <a
              href="/account/signin?callbackUrl=/shop/cart"
              className="inline-block bg-[#235b4e] text-white px-8 py-3 rounded-lg hover:bg-[#2B6B5C] transition-colors font-medium"
            >
              Sign In
            </a>
          </div>
        ) : loading || userLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-[#F9F9F9] h-32 rounded-xl"></div>
            ))}
          </div>
        ) : cartItems.length === 0 ? (
          <div className="text-center py-20">
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
              Add some delicious items to get started
            </p>
            <a
              href="/shop"
              className="inline-block bg-[#235b4e] text-white px-8 py-3 rounded-lg hover:bg-[#2B6B5C] transition-colors font-medium"
            >
              Continue Shopping
            </a>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <div className="space-y-4 mb-8">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-[#E0E0E0] rounded-xl p-6"
                >
                  <div className="flex gap-4">
                    {/* Product Image */}
                    <div className="w-24 h-24 flex-shrink-0 bg-[#F9F9F9] rounded-lg overflow-hidden">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg
                            className="w-12 h-12 text-[#E0E0E0]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-[#1A1A1A] mb-1">
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="text-sm text-[#666666] mb-2 line-clamp-2">
                          {item.description}
                        </p>
                      )}

                      {/* Customizations */}
                      {item.customizations &&
                        item.customizations.length > 0 && (
                          <div className="text-sm text-[#666666] mb-2">
                            {item.customizations.map((custom, idx) => (
                              <div key={idx}>
                                •{" "}
                                {custom.ingredient || custom.option_group_name}
                              </div>
                            ))}
                          </div>
                        )}

                      {/* Addons */}
                      {item.addons && item.addons.length > 0 && (
                        <div className="text-sm text-[#666666] mb-2">
                          {item.addons.map((addon, idx) => (
                            <div key={idx}>
                              + {addon.name} (${addon.price})
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Comment */}
                      {item.comment && (
                        <p className="text-sm text-[#666666] italic mb-2">
                          Note: {item.comment}
                        </p>
                      )}

                      {/* Price and Quantity */}
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-lg font-bold text-[#235b4e]">
                          $
                          {(Number(item.price) * Number(item.quantity)).toFixed(
                            2,
                          )}
                        </span>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                            className="w-8 h-8 flex items-center justify-center bg-[#F9F9F9] rounded-lg hover:bg-[#E0E0E0] transition-colors"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M20 12H4"
                              />
                            </svg>
                          </button>
                          <span className="font-semibold text-[#1A1A1A] min-w-[2rem] text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                            className="w-8 h-8 flex items-center justify-center bg-[#F9F9F9] rounded-lg hover:bg-[#E0E0E0] transition-colors"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="ml-2 text-[#D85555] hover:text-[#B83333] transition-colors"
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart Summary */}
            <div className="bg-[#F9F9F9] rounded-xl p-6 sticky bottom-0">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold text-[#1A1A1A]">
                  Subtotal
                </span>
                <span className="text-2xl font-bold text-[#235b4e]">
                  ${subtotal.toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-[#666666] mb-4">
                Delivery fees and final pricing will be calculated at checkout
              </p>
              <a
                href="/shop/checkout"
                className="block w-full bg-[#235b4e] text-white text-center px-6 py-4 rounded-lg hover:bg-[#2B6B5C] transition-colors font-medium text-lg"
              >
                Proceed to Checkout
              </a>
              <a
                href="/shop"
                className="block w-full text-center text-[#235b4e] px-6 py-3 rounded-lg hover:bg-white transition-colors font-medium mt-3"
              >
                Continue Shopping
              </a>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
