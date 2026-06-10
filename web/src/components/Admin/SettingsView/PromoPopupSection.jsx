import { useMemo } from "react";
import { useUpload } from "@/utils/useUpload";
import {
  toLocalDateTimeInputValue,
  fromLocalDateTimeInputValue,
} from "@/utils/dateTimeHelpers";
import { PAGE_OPTIONS } from "./constants";

export function PromoPopupSection({
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
}) {
  const [upload] = useUpload();

  const handlePromoImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPromoError(null);

    try {
      const result = await upload({ file });
      if (result.error) {
        throw new Error(result.error);
      }
      if (!result.url) {
        throw new Error("Upload did not return a URL");
      }

      setPromo((prev) => ({ ...prev, image_url: result.url }));
    } catch (error) {
      console.error("Error uploading promo image:", error);
      setPromoError(error?.message || "Failed to upload promo image");
    } finally {
      try {
        e.target.value = "";
      } catch (err) {
        // ignore
      }
    }
  };

  const productOptions = useMemo(() => {
    return products
      .slice()
      .sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || "")),
      )
      .map((p) => ({
        label: `${p.name} (#${p.id})`,
        value: String(p.id),
      }));
  }, [products]);

  const eventOptions = useMemo(() => {
    return events
      .slice()
      .sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || "")),
      )
      .map((ev) => ({
        label: `${ev.name}`,
        value: String(ev.id),
      }));
  }, [events]);

  const showDestinationValueSelect =
    promo.destination_type === "event" || promo.destination_type === "product";

  const destinationValueLabel =
    promo.destination_type === "event"
      ? "Select Event"
      : promo.destination_type === "product"
        ? "Select Product"
        : "Route";

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-2xl mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Home Promo Popup
      </h3>

      {promoLoading ? (
        <div className="text-gray-600">Loading promo popup settings...</div>
      ) : (
        <form onSubmit={handleSavePromo} className="space-y-5">
          {promoError ? (
            <div className="text-sm text-red-600">{promoError}</div>
          ) : null}

          <div className="flex items-center gap-3">
            <input
              id="promo-enabled"
              type="checkbox"
              checked={!!promo.enabled}
              onChange={(e) =>
                setPromo((prev) => ({ ...prev, enabled: e.target.checked }))
              }
            />
            <label
              htmlFor="promo-enabled"
              className="text-sm font-medium text-gray-700"
            >
              Enabled
            </label>
            {promoUpdatedAt ? (
              <span className="text-xs text-gray-400">
                last updated: {new Date(promoUpdatedAt).toLocaleString()}
              </span>
            ) : null}
          </div>

          {promo.image_url ? (
            <div className="rounded-lg overflow-hidden border border-gray-200">
              <img
                src={promo.image_url}
                alt="Promo preview"
                className="w-full h-48 object-cover"
              />
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              No promo image uploaded yet.
            </div>
          )}

          <div>
            <label
              htmlFor="promo-image"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Popup Image
            </label>
            <input
              id="promo-image"
              type="file"
              accept="image/*"
              onChange={handlePromoImageUpload}
              disabled={promoSaving}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Destination Type
            </label>
            <select
              value={promo.destination_type}
              onChange={(e) => {
                const nextType = e.target.value;
                setPromo((prev) => ({
                  ...prev,
                  destination_type: nextType,
                  destination_value:
                    nextType === "page" ? "/(tabs)/home" : null,
                }));
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="event">Event</option>
              <option value="product">Product</option>
              <option value="page">Page</option>
            </select>
          </div>

          {showDestinationValueSelect ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {destinationValueLabel}
              </label>
              <select
                value={promo.destination_value || ""}
                onChange={(e) =>
                  setPromo((prev) => ({
                    ...prev,
                    destination_value: e.target.value || null,
                  }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select...</option>
                {(promo.destination_type === "event"
                  ? eventOptions
                  : productOptions
                ).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-gray-500">
                If empty/invalid, the app will fall back to Home.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Destination Page
                </label>
                <select
                  value={
                    PAGE_OPTIONS.some(
                      (p) => p.value === promo.destination_value,
                    )
                      ? promo.destination_value
                      : "custom"
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "custom") {
                      setPromo((prev) => ({
                        ...prev,
                        destination_value: "",
                      }));
                    } else {
                      setPromo((prev) => ({
                        ...prev,
                        destination_value: v,
                      }));
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  {PAGE_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label} ({p.value})
                    </option>
                  ))}
                  <option value="custom">Custom route…</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Route (optional)
                </label>
                <input
                  value={promo.destination_value || ""}
                  onChange={(e) =>
                    setPromo((prev) => ({
                      ...prev,
                      destination_value: e.target.value,
                    }))
                  }
                  placeholder="/(tabs)/home"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Must start with <code>/</code>.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date (optional)
              </label>
              <input
                type="datetime-local"
                value={
                  promo.start_at
                    ? toLocalDateTimeInputValue(promo.start_at)
                    : ""
                }
                onChange={(e) =>
                  setPromo((prev) => ({
                    ...prev,
                    start_at: fromLocalDateTimeInputValue(e.target.value),
                  }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date (optional)
              </label>
              <input
                type="datetime-local"
                value={
                  promo.end_at ? toLocalDateTimeInputValue(promo.end_at) : ""
                }
                onChange={(e) =>
                  setPromo((prev) => ({
                    ...prev,
                    end_at: fromLocalDateTimeInputValue(e.target.value),
                  }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Show Frequency
            </label>
            <select
              value={promo.show_frequency}
              onChange={(e) =>
                setPromo((prev) => ({
                  ...prev,
                  show_frequency: e.target.value,
                }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="every_visit">Every visit</option>
              <option value="once_per_session">Once per session</option>
              <option value="once_per_day">Once per day</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={promoSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {promoSaving ? "Saving..." : "Save Promo Popup"}
          </button>
        </form>
      )}
    </div>
  );
}
