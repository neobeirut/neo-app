import { useState } from "react";

const DAYS_OF_WEEK = [
  { id: "monday", label: "Monday" },
  { id: "tuesday", label: "Tuesday" },
  { id: "wednesday", label: "Wednesday" },
  { id: "thursday", label: "Thursday" },
  { id: "friday", label: "Friday" },
  { id: "saturday", label: "Saturday" },
  { id: "sunday", label: "Sunday" },
];

const DEFAULT_SCHEDULE = {
  monday: { active: true, open: "09:00", close: "23:00" },
  tuesday: { active: true, open: "09:00", close: "23:00" },
  wednesday: { active: true, open: "09:00", close: "23:00" },
  thursday: { active: true, open: "09:00", close: "23:00" },
  friday: { active: true, open: "09:00", close: "23:00" },
  saturday: { active: true, open: "09:00", close: "23:00" },
  sunday: { active: true, open: "09:00", close: "23:00" },
};

const formatTimeHHMM = (timeStr) => {
  if (!timeStr) return "09:00";
  const s = String(timeStr).trim();
  if (s.length >= 5) return s.slice(0, 5);
  return s;
};

export function BranchForm({ editingItem, onSave, onCancel }) {
  const [isSaving, setIsSaving] = useState(false);

  const initialSchedule = (() => {
    if (editingItem?.weekday_schedule) {
      if (typeof editingItem.weekday_schedule === "string") {
        try {
          return JSON.parse(editingItem.weekday_schedule);
        } catch (e) {}
      } else if (typeof editingItem.weekday_schedule === "object") {
        return editingItem.weekday_schedule;
      }
    }
    return DEFAULT_SCHEDULE;
  })();

  const initialStatus = editingItem?.operational_status || (editingItem?.orders_active === false ? "closed" : "open");

  const [formData, setFormData] = useState({
    name: editingItem?.name || "",
    address: editingItem?.address || "",
    phone: editingItem?.phone || "",
    whatsapp_phone: editingItem?.whatsapp_phone || "",
    location: editingItem?.location || "",
    is_active: editingItem?.is_active ?? true,
    discount_percentage: editingItem?.discount_percentage || 0,
    image_url: editingItem?.image_url || "",
    delivery_radius_km:
      editingItem?.delivery_radius_km === null ||
      editingItem?.delivery_radius_km === undefined
        ? 10
        : Number(editingItem.delivery_radius_km),
    opening_time: formatTimeHHMM(editingItem?.opening_time || "09:00"),
    closing_time: formatTimeHHMM(editingItem?.closing_time || "21:00"),
    delivery_start_time: formatTimeHHMM(editingItem?.delivery_start_time || "11:00"),
    delivery_end_time: formatTimeHHMM(editingItem?.delivery_end_time || "20:00"),
    orders_active: editingItem?.orders_active ?? true,
    operational_status: initialStatus,
    closure_reason: editingItem?.closure_reason || "Overloaded",
    weekday_schedule: initialSchedule,
  });

  const [imageError, setImageError] = useState(null);

  const validateImageUrl = (url) => {
    if (!url.trim()) {
      setImageError(null);
      return true;
    }

    try {
      new URL(url);
      setImageError(null);
      return true;
    } catch (e) {
      setImageError("Please enter a valid URL");
      return false;
    }
  };

  const handleWeekdayChange = (dayId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      weekday_schedule: {
        ...prev.weekday_schedule,
        [dayId]: {
          ...(prev.weekday_schedule[dayId] || { active: true, open: "09:00", close: "23:00" }),
          [field]: value,
        },
      },
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert("Branch name is required");
      return;
    }

    const radiusValue = Number(formData.delivery_radius_km);
    const radiusOk = Number.isFinite(radiusValue) && radiusValue >= 0;

    if (!radiusOk) {
      alert("Delivery radius must be a non-negative number");
      return;
    }

    if (formData.image_url && !validateImageUrl(formData.image_url)) {
      alert("Please enter a valid image URL");
      return;
    }

    // Derived flags for backward compatibility & closure reasons
    const finalOrdersActive = formData.operational_status === "open";
    const finalIsActive = formData.operational_status !== "closed";
    const finalReason = formData.operational_status !== "open" ? (formData.closure_reason || "Overloaded") : null;

    const dataToSave = editingItem
      ? { 
          ...formData, 
          id: editingItem.id,
          orders_active: finalOrdersActive,
          is_active: finalIsActive,
          closure_reason: finalReason
        }
      : {
          ...formData,
          orders_active: finalOrdersActive,
          is_active: finalIsActive,
          closure_reason: finalReason
        };

    setIsSaving(true);
    try {
      const success = await onSave(dataToSave);
      if (success) {
        onCancel();
      }
    } catch (e) {
      console.error("Error saving branch form:", e);
      alert("Failed to save branch: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6 border border-slate-200">
      <h3 className="text-lg font-semibold mb-4 text-slate-900">
        {editingItem ? "Edit Branch" : "Add New Branch"}
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Branch Name</label>
          <input
            type="text"
            placeholder="Branch Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="border rounded px-3 py-2 w-full text-sm placeholder:text-gray-400"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Phone Number</label>
          <input
            type="text"
            placeholder="Phone Number"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="border rounded px-3 py-2 w-full text-sm placeholder:text-gray-400"
          />
        </div>

        {/* WhatsApp phone */}
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Store WhatsApp Phone (E.164)
          </label>
          <input
            type="text"
            placeholder="+9613123456"
            value={formData.whatsapp_phone}
            onChange={(e) =>
              setFormData({ ...formData, whatsapp_phone: e.target.value })
            }
            className="border rounded px-3 py-2 w-full text-sm placeholder:text-gray-400"
          />
          <p className="text-xs text-gray-500 mt-1">
            Used by the Admin “Send WhatsApp for Delivery” button. If empty, fall back to Phone Number.
          </p>
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Address</label>
          <textarea
            placeholder="Address"
            value={formData.address}
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
            className="border rounded px-3 py-2 w-full text-sm placeholder:text-gray-400"
            rows="2"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Location Coordinates (lat,lng)</label>
          <input
            type="text"
            placeholder="e.g., 33.8938,35.5018"
            value={formData.location}
            onChange={(e) =>
              setFormData({ ...formData, location: e.target.value })
            }
            className="border rounded px-3 py-2 w-full text-sm placeholder:text-gray-400"
          />
        </div>

        {/* Image URL Field */}
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Branch Image URL
          </label>
          <input
            type="text"
            placeholder="https://example.com/branch-image.jpg"
            value={formData.image_url}
            onChange={(e) => {
              setFormData({ ...formData, image_url: e.target.value });
              validateImageUrl(e.target.value);
            }}
            className={`border rounded px-3 py-2 w-full text-sm placeholder:text-gray-400 ${imageError ? "border-red-500" : "border-gray-300"}`}
          />
          {imageError && (
            <p className="text-red-500 text-xs mt-1">{imageError}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Discount Percentage (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="0"
            value={formData.discount_percentage}
            onChange={(e) =>
              setFormData({
                ...formData,
                discount_percentage: parseFloat(e.target.value) || 0,
              })
            }
            className="border rounded px-3 py-2 text-sm placeholder:text-gray-400"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Delivery Radius (km)
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="10"
            value={formData.delivery_radius_km}
            onChange={(e) =>
              setFormData({
                ...formData,
                delivery_radius_km: parseFloat(e.target.value) || 0,
              })
            }
            className="border rounded px-3 py-2 text-sm placeholder:text-gray-400"
          />
        </div>

        {/* OPERATIONAL CONTROLS SECTION */}
        <div className="col-span-2 mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-md font-bold mb-3 text-slate-800 flex items-center gap-2">
            ⚙️ Operational Controls & Branch Closure Status
          </h4>

          {/* Operational Status Select */}
          <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Orders Active / Operational Status
              </label>
              <select
                value={formData.operational_status}
                onChange={(e) => {
                  const newStatus = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    operational_status: newStatus,
                    closure_reason: prev.closure_reason || "Overloaded"
                  }));
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold bg-white shadow-sm focus:ring-2 focus:ring-amber-500"
              >
                <option value="open">🟢 Open / Active (Accepting Orders)</option>
                <option value="closed_hour">⏳ Closed For an Hour (60 Minutes)</option>
                <option value="closed_today">🌙 Closed For Today (Until Midnight)</option>
                <option value="closed">🔴 Closed (Hidden from Customers & POS)</option>
              </select>
              <p className="text-xs text-slate-600 mt-1.5">
                {formData.operational_status === "open" && "Branch is currently open and accepting online & POS orders normally."}
                {formData.operational_status === "closed_hour" && "Branch will pause taking orders for 60 minutes."}
                {formData.operational_status === "closed_today" && "Branch will remain closed for the rest of today."}
                {formData.operational_status === "closed" && "Branch is set to Closed and WILL NOT APPEAR in origin selection or customer site."}
              </p>
            </div>

            {/* Closure Reason Selector */}
            {formData.operational_status !== "open" && (
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Closure Reason
                </label>
                <select
                  value={formData.closure_reason || "Overloaded"}
                  onChange={(e) => {
                    const selected = e.target.value;
                    setFormData((prev) => ({ ...prev, closure_reason: selected }));
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium bg-white shadow-sm cursor-pointer"
                >
                  <option value="Overloaded">⚡ Overloaded (High order volume)</option>
                  <option value="Out of Stock">📦 Out of Stock</option>
                  <option value="Maintenance">🛠️ Maintenance</option>
                  <option value="Holiday">🌴 Holiday</option>
                </select>
              </div>
            )}
          </div>

          {/* WEEKDAYS OPENING SCHEDULE */}
          <div className="mt-6">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
              📅 Weekdays Opening Schedule (Operating Hours)
            </h4>
            <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              {DAYS_OF_WEEK.map((day) => {
                const dayConfig = formData.weekday_schedule?.[day.id] || {
                  active: true,
                  open: "09:00",
                  close: "23:00",
                };

                return (
                  <div
                    key={day.id}
                    className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-slate-200 text-xs shadow-2xs"
                  >
                    <label className="flex items-center gap-2 font-bold text-slate-800 min-w-[110px]">
                      <input
                        type="checkbox"
                        checked={!!dayConfig.active}
                        onChange={(e) =>
                          handleWeekdayChange(day.id, "active", e.target.checked)
                        }
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                      />
                      {day.label}
                    </label>

                    {dayConfig.active ? (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[11px] font-medium">Open:</span>
                        <input
                          type="time"
                          value={dayConfig.open || "09:00"}
                          onChange={(e) =>
                            handleWeekdayChange(day.id, "open", e.target.value)
                          }
                          className="border rounded px-2 py-1 text-xs font-semibold text-slate-800"
                        />
                        <span className="text-slate-500 text-[11px] font-medium">Close:</span>
                        <input
                          type="time"
                          value={dayConfig.close || "23:00"}
                          onChange={(e) =>
                            handleWeekdayChange(day.id, "close", e.target.value)
                          }
                          className="border rounded px-2 py-1 text-xs font-semibold text-slate-800"
                        />
                      </div>
                    ) : (
                      <span className="text-rose-600 font-bold uppercase text-[11px] bg-rose-50 px-2.5 py-1 rounded border border-rose-200">
                        Closed on {day.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Standard Opening / Delivery Hours Fallbacks */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Default Opening Time
              </label>
              <input
                type="time"
                value={formData.opening_time}
                onChange={(e) =>
                  setFormData({ ...formData, opening_time: e.target.value })
                }
                className="border rounded px-3 py-2 text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Default Closing Time
              </label>
              <input
                type="time"
                value={formData.closing_time}
                onChange={(e) =>
                  setFormData({ ...formData, closing_time: e.target.value })
                }
                className="border rounded px-3 py-2 text-sm w-full"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-6">
        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className={`px-5 py-2.5 rounded-lg text-sm font-extrabold shadow-sm transition-colors text-white ${
            isSaving ? "bg-slate-400 cursor-not-allowed" : "bg-amber-600 hover:bg-amber-700"
          }`}
        >
          {isSaving ? "Saving..." : "Save Branch Settings"}
        </button>
        <button
          onClick={onCancel}
          className="bg-slate-500 hover:bg-slate-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
