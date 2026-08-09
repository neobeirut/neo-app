"use client";

import { useState, useEffect } from "react";

export function ChannelDiscountSection() {
  const [totersDiscount, setTotersDiscount] = useState("15");
  const [noknokDiscount, setNoknokDiscount] = useState("15");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (data.toters_discount_percent !== undefined) {
        setTotersDiscount(String(data.toters_discount_percent));
      }
      if (data.noknok_discount_percent !== undefined) {
        setNoknokDiscount(String(data.noknok_discount_percent));
      }
    } catch (err) {
      console.error("Error loading admin settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toters_discount_percent: parseFloat(totersDiscount) || 0,
          noknok_discount_percent: parseFloat(noknokDiscount) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage("✅ Discount settings saved successfully!");
      } else {
        setMessage("❌ Failed to save settings: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      setMessage("❌ Error saving settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            🏷️ POS Channel Discount Settings
          </h3>
          <p className="text-xs text-gray-500">
            Configure default discount percentages applied automatically on POS for Toters and NokNok channels.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <label className="block text-xs font-bold text-emerald-900 mb-1">
              Toters Discount (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={totersDiscount}
                onChange={(e) => setTotersDiscount(e.target.value)}
                className="w-full bg-white border border-emerald-300 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="15"
                required
              />
              <span className="font-extrabold text-emerald-700 text-sm">%</span>
            </div>
          </div>

          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
            <label className="block text-xs font-bold text-rose-900 mb-1">
              NokNok Discount (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={noknokDiscount}
                onChange={(e) => setNoknokDiscount(e.target.value)}
                className="w-full bg-white border border-rose-300 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                placeholder="15"
                required
              />
              <span className="font-extrabold text-rose-700 text-sm">%</span>
            </div>
          </div>
        </div>

        {message && (
          <div className="text-xs font-bold text-gray-800">{message}</div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 bg-[#eb660c] hover:bg-[#d55909] disabled:opacity-50 text-white font-extrabold rounded-lg text-xs transition-all shadow"
        >
          {saving ? "Saving..." : "Save Discount Settings"}
        </button>
      </form>
    </div>
  );
}
