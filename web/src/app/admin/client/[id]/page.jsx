"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  User,
  Calendar,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  MapPin,
  Award,
  Clock,
  Coffee,
  Home,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react";

export default function ClientDashboardPage({ params }) {
  const clientId = params.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState({});

  useEffect(() => {
    if (clientId) {
      fetchClientData();
    }
  }, [clientId]);

  const fetchClientData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${clientId}/dashboard`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Error fetching client data:", error);
    }
    setLoading(false);
  };

  const toggleOrderExpanded = (orderId) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTierColor = (tier) => {
    const colors = {
      Bronze: "bg-orange-100 text-orange-800 border-orange-200",
      Silver: "bg-gray-100 text-gray-800 border-gray-300",
      Gold: "bg-yellow-100 text-yellow-800 border-yellow-300",
      Corporate: "bg-purple-100 text-purple-800 border-purple-200",
    };
    return colors[tier] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getTimeIcon = (timeSlot) => {
    const icons = {
      morning: "☀️",
      lunch: "🍽️",
      evening: "🌆",
      night: "🌙",
    };
    return icons[timeSlot] || "⏰";
  };

  const goBack = () => {
    if (typeof window !== "undefined") {
      window.history.back();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2e7d32] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading client dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Client not found</p>
          <button
            onClick={goBack}
            className="mt-4 text-[#2e7d32] hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const { user, stats, preferred_branch, orders, addresses, insights } = data;

  const clientName =
    user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.name || user.email || "Unknown Client";

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-[#2e7d32] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={goBack}
            className="flex items-center gap-2 text-white/90 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="text-sm">Back to Clients</span>
          </button>

          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <User size={32} className="text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                {clientName}
              </h1>
              <div className="flex flex-wrap gap-4 text-sm text-white/90">
                {user.email && (
                  <span className="flex items-center gap-1">
                    📧 {user.email}
                  </span>
                )}
                {user.phone && (
                  <span className="flex items-center gap-1">
                    📱 {user.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Member Since */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#2e7d32]/10 flex items-center justify-center">
                  <Calendar size={20} className="text-[#2e7d32]" />
                </div>
                <div className="text-sm text-gray-600">Member Since</div>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatDate(user.member_since)}
              </div>
            </div>

            {/* Total Orders */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#2e7d32]/10 flex items-center justify-center">
                  <ShoppingBag size={20} className="text-[#2e7d32]" />
                </div>
                <div className="text-sm text-gray-600">Total Orders</div>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.total_orders}
              </div>
            </div>

            {/* Total Spent */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#2e7d32]/10 flex items-center justify-center">
                  <DollarSign size={20} className="text-[#2e7d32]" />
                </div>
                <div className="text-sm text-gray-600">Lifetime Value</div>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                ${stats.total_spent.toFixed(2)}
              </div>
            </div>

            {/* Average Order Value */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#2e7d32]/10 flex items-center justify-center">
                  <TrendingUp size={20} className="text-[#2e7d32]" />
                </div>
                <div className="text-sm text-gray-600">Avg Order Value</div>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                ${stats.avg_order_value.toFixed(2)}
              </div>
            </div>

            {/* Preferred Branch */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#2e7d32]/10 flex items-center justify-center">
                  <MapPin size={20} className="text-[#2e7d32]" />
                </div>
                <div className="text-sm text-gray-600">Preferred Branch</div>
              </div>
              <div className="text-lg font-bold text-gray-900">
                {preferred_branch?.name || "N/A"}
              </div>
            </div>

            {/* Loyalty Points */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#2e7d32]/10 flex items-center justify-center">
                  <Award size={20} className="text-[#2e7d32]" />
                </div>
                <div className="text-sm text-gray-600">Loyalty Points</div>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {user.points || 0}
              </div>
            </div>

            {/* Membership Tier */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow sm:col-span-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#2e7d32]/10 flex items-center justify-center">
                  <Award size={20} className="text-[#2e7d32]" />
                </div>
                <div className="text-sm text-gray-600">Membership Tier</div>
              </div>
              <div>
                <span
                  className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold border ${getTierColor(user.membership_tier)}`}
                >
                  {user.membership_tier || "Bronze"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Personalization & Insights */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Behavioral Insights
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Most Ordered Category */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#2e7d32]/10 flex items-center justify-center">
                  <Coffee size={20} className="text-[#2e7d32]" />
                </div>
                <div className="text-sm text-gray-600">Favorite Category</div>
              </div>
              <div className="text-lg font-bold text-gray-900">
                {insights.most_ordered_category || "N/A"}
              </div>
            </div>

            {/* Most Frequent Time */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#2e7d32]/10 flex items-center justify-center">
                  <Clock size={20} className="text-[#2e7d32]" />
                </div>
                <div className="text-sm text-gray-600">Preferred Time</div>
              </div>
              <div className="text-lg font-bold text-gray-900 capitalize">
                {getTimeIcon(insights.most_frequent_time)}{" "}
                {insights.most_frequent_time || "N/A"}
              </div>
            </div>

            {/* Order Type Preference */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#2e7d32]/10 flex items-center justify-center">
                  <Package size={20} className="text-[#2e7d32]" />
                </div>
                <div className="text-sm text-gray-600">Order Preference</div>
              </div>
              <div className="text-lg font-bold text-gray-900 capitalize">
                {insights.order_type_preference === "delivery" ? "🚚" : "📦"}{" "}
                {insights.order_type_preference || "N/A"}
              </div>
            </div>

            {/* Last Order */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#2e7d32]/10 flex items-center justify-center">
                  <Calendar size={20} className="text-[#2e7d32]" />
                </div>
                <div className="text-sm text-gray-600">Last Order</div>
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {formatDate(stats.last_order_date)}
              </div>
            </div>
          </div>
        </div>

        {/* Saved Addresses */}
        {addresses && addresses.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Saved Addresses
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Home size={18} className="text-[#2e7d32]" />
                      <span className="font-semibold text-gray-900">
                        {address.label || "Address"}
                      </span>
                    </div>
                    {address.is_default && (
                      <span className="text-xs bg-[#2e7d32]/10 text-[#2e7d32] px-2 py-1 rounded-full font-medium">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    {address.building && <div>{address.building}</div>}
                    <div>{address.address_line1}</div>
                    {address.address_line2 && (
                      <div>{address.address_line2}</div>
                    )}
                    <div>
                      {address.city}, {address.state}
                    </div>
                    {address.company_name && (
                      <div className="text-gray-500">
                        Company: {address.company_name}
                      </div>
                    )}
                    {address.delivery_distance_km != null &&
                      !isNaN(address.delivery_distance_km) && (
                        <div className="text-[#2e7d32] font-medium mt-2">
                          📍 {Number(address.delivery_distance_km).toFixed(1)}{" "}
                          km from branch
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order History */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Order History ({orders.length})
          </h2>
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div
                  className="p-5 cursor-pointer"
                  onClick={() => toggleOrderExpanded(order.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-900">
                          Order #{order.id}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            order.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : order.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : order.status === "cancelled"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <span>
                            {order.order_type === "delivery" ? "🚚" : "📦"}
                          </span>
                          <span className="capitalize">{order.order_type}</span>
                          {order.branch_name && (
                            <>
                              <span>•</span>
                              <span>{order.branch_name}</span>
                            </>
                          )}
                        </div>
                        <div>
                          📅 {order.scheduled_date} at {order.scheduled_time}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDateTime(order.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-gray-900 mb-1">
                        ${parseFloat(order.total_amount).toFixed(2)}
                      </div>
                      <button className="text-[#2e7d32] hover:text-[#1e5d22] transition-colors">
                        {expandedOrders[order.id] ? (
                          <ChevronUp size={20} />
                        ) : (
                          <ChevronDown size={20} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Loyalty Points Info */}
                  {(order.points_awarded > 0 || order.points_redeemed > 0) && (
                    <div className="flex gap-3 text-xs">
                      {order.points_awarded > 0 && (
                        <span className="text-green-700 bg-green-50 px-2 py-1 rounded">
                          +{order.points_awarded} points earned
                        </span>
                      )}
                      {order.points_redeemed > 0 && (
                        <span className="text-blue-700 bg-blue-50 px-2 py-1 rounded">
                          {order.points_redeemed} points redeemed
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded Order Items */}
                {expandedOrders[order.id] && order.items.length > 0 && (
                  <div className="border-t border-gray-200 bg-gray-50 p-5">
                    <div className="text-sm font-semibold text-gray-900 mb-3">
                      Order Items:
                    </div>
                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">
                              {item.quantity}x
                            </span>
                            <span className="text-gray-900 font-medium">
                              {item.product_name}
                            </span>
                            {item.category_name && (
                              <span className="text-xs text-gray-500">
                                ({item.category_name})
                              </span>
                            )}
                          </div>
                          <span className="font-semibold text-gray-900">
                            ${parseFloat(item.total_price).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {order.delivery_address && (
                      <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
                        <div className="font-medium mb-1">
                          Delivery Address:
                        </div>
                        <div>{order.delivery_address}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
