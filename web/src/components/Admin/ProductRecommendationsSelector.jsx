import { useEffect, useMemo, useState } from "react";

export default function ProductRecommendationsSelector({
  productId,
  allProducts,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // mode: 'auto' | 'manual' | 'none'
  const [mode, setMode] = useState("auto");
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");

  const adminHeaders = useMemo(() => {
    if (typeof window === "undefined") {
      return {};
    }

    const adminToken = localStorage.getItem("admin_token");
    const adminId = localStorage.getItem("admin_id");

    const headers = {};
    if (adminToken) headers["x-admin-token"] = adminToken;
    if (adminId) headers["x-admin-id"] = adminId;
    return headers;
  }, []);

  const candidateProducts = useMemo(() => {
    const list = Array.isArray(allProducts) ? allProducts : [];

    const q = String(search || "")
      .trim()
      .toLowerCase();

    const filtered = list
      .filter((p) => Number(p?.id) !== Number(productId))
      .filter((p) => {
        if (!q) return true;
        const name = String(p?.name || "").toLowerCase();
        const category = String(p?.category_name || "").toLowerCase();
        return name.includes(q) || category.includes(q);
      })
      .slice(0, 200);

    return filtered;
  }, [allProducts, productId, search]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!productId) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/products/${productId}/recommendations-override`,
          {
            headers: {
              ...adminHeaders,
            },
          },
        );

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(
            `Failed to load recommendations override (${response.status}) ${text}`,
          );
        }

        const data = await response.json();

        if (cancelled) return;

        const nextMode =
          data?.mode === "manual"
            ? "manual"
            : data?.mode === "none"
              ? "none"
              : "auto";
        setMode(nextMode);

        const ids = Array.isArray(data?.recommended_product_ids)
          ? data.recommended_product_ids
              .map((v) => Number(v))
              .filter((v) => Number.isFinite(v))
          : [];
        setSelectedIds(ids);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError("Could not load this product’s recommendations settings.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [productId, adminHeaders]);

  const toggleSelected = (id) => {
    const pid = Number(id);
    if (!Number.isFinite(pid)) return;

    setSelectedIds((prev) => {
      const has = prev.includes(pid);
      if (has) {
        return prev.filter((x) => x !== pid);
      }
      return [...prev, pid];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const payload =
        mode === "auto"
          ? { mode: "auto" }
          : mode === "none"
            ? { mode: "none", recommended_product_ids: [] }
            : { mode: "manual", recommended_product_ids: selectedIds };

      const response = await fetch(
        `/api/products/${productId}/recommendations-override`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...adminHeaders,
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `Failed to save (${response.status}) ${response.statusText} ${text}`,
        );
      }

      alert("Saved: You Might Also Like settings updated");
    } catch (e) {
      console.error(e);
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isNone = mode === "none";
  const isManual = mode === "manual";

  const handleToggleNone = (checked) => {
    setMode(checked ? "none" : "auto");
  };

  return (
    <div className="mt-8 pt-8 border-t border-gray-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-base font-semibold text-gray-900">
            “You Might Also Like”
          </h4>
          <p className="text-sm text-gray-600 mt-1">
            Display order: Manual → Featured → AI (all shown in this order).
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading || saving}
          className="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save section"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm font-medium">⚠️ {error}</p>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {/* None checkbox (explicit requirement) */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isNone}
            onChange={(e) => handleToggleNone(e.target.checked)}
            disabled={loading || saving}
          />
          <span>None (hide this section for this product)</span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="reco-mode"
            checked={mode === "auto"}
            onChange={() => setMode("auto")}
            disabled={loading || saving || isNone}
          />
          <span>Auto (Featured products first, then AI if no featured)</span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="reco-mode"
            checked={mode === "manual"}
            onChange={() => setMode("manual")}
            disabled={loading || saving || isNone}
          />
          <span>Manual selection (highest priority)</span>
        </label>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-gray-500">Loading…</div>
      ) : null}

      {!loading && !isNone ? (
        <div className="mt-6">
          {isManual ? (
            <>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="text-sm text-gray-700">
                  Select products to show in this section (max 12 saved).
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products…"
                  className="border rounded px-3 py-2 text-sm w-full sm:w-[280px]"
                  disabled={saving}
                />
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto border rounded p-3">
                {candidateProducts.map((p) => {
                  const pid = Number(p.id);
                  const checked = selectedIds.includes(pid);
                  const label = `${p.name}${p.category_name ? ` · ${p.category_name}` : ""}`;

                  return (
                    <label
                      key={String(p.id)}
                      className="flex items-center gap-2 text-sm text-gray-800"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelected(pid)}
                        disabled={saving}
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}

                {candidateProducts.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    No products match.
                  </div>
                ) : null}
              </div>

              <div className="mt-2 text-xs text-gray-500">
                Selected: {selectedIds.length} (manual picks show first;
                featured and AI still show after)
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-600">
              Auto mode is enabled. This product will show Featured products
              first, then AI recommendations.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
