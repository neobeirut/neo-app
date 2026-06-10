"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusCircle, Pencil, Trash2, X, Check } from "lucide-react";

function getAdminHeadersSafe() {
  try {
    const adminToken = localStorage.getItem("admin_token");
    const adminId = localStorage.getItem("admin_id");

    if (!adminToken || !adminId) {
      return {};
    }

    return {
      "x-admin-token": adminToken,
      "x-admin-id": adminId, // dev fallback only
    };
  } catch (e) {
    return {};
  }
}

function toInputDateTime(value) {
  if (!value) {
    return "";
  }
  try {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) {
      return "";
    }

    // datetime-local uses local time, no timezone.
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());

    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  } catch {
    return "";
  }
}

function fromInputDateTime(value) {
  // we send ISO strings to the API (it accepts ISO; server will parse)
  if (!value) {
    return null;
  }
  try {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) {
      return null;
    }
    return d.toISOString();
  } catch {
    return null;
  }
}

function formatDiscount(promo) {
  const type = promo?.discount_type;
  const val = promo?.discount_value;

  if (type === "percent") {
    return `${val}%`;
  }

  if (type === "fixed") {
    return `$${val}`;
  }

  return String(val ?? "-");
}

const emptyDraft = {
  id: null,
  code: "",
  description: "",
  discount_type: "percent",
  discount_value: "",
  min_subtotal: "",
  max_discount: "",
  start_at: "",
  end_at: "",
  usage_limit_total: "",
  usage_limit_per_user: "",
  is_active: true,
  first_order_only: false,
  stackable: false,
};

export default function PromoCodesView() {
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState(null);

  const queryKey = useMemo(() => ["admin", "promo-codes"], []);

  const promoQuery = useQuery({
    queryKey,
    enabled: typeof window !== "undefined",
    queryFn: async () => {
      const res = await fetch("/api/promo-codes/admin", {
        headers: {
          ...getAdminHeadersSafe(),
        },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(
          `When fetching /api/promo-codes/admin, the response was [${res.status}] ${res.statusText} ${txt}`,
        );
      }

      const data = await res.json();
      const list = Array.isArray(data?.promoCodes) ? data.promoCodes : [];
      return list;
    },
  });

  const promoCodes = promoQuery.data || [];

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setDraft(emptyDraft);
    setError(null);
  }, []);

  const openCreate = useCallback(() => {
    setDraft(emptyDraft);
    setError(null);
    setIsOpen(true);
  }, []);

  const openEdit = useCallback((promo) => {
    const next = {
      id: promo?.id || null,
      code: String(promo?.code || ""),
      description: String(promo?.description || ""),
      discount_type: String(promo?.discount_type || "percent"),
      discount_value:
        promo?.discount_value === null || promo?.discount_value === undefined
          ? ""
          : String(promo.discount_value),
      min_subtotal:
        promo?.min_subtotal === null || promo?.min_subtotal === undefined
          ? ""
          : String(promo.min_subtotal),
      max_discount:
        promo?.max_discount === null || promo?.max_discount === undefined
          ? ""
          : String(promo.max_discount),
      start_at: toInputDateTime(promo?.start_at),
      end_at: toInputDateTime(promo?.end_at),
      usage_limit_total:
        promo?.usage_limit_total === null ||
        promo?.usage_limit_total === undefined
          ? ""
          : String(promo.usage_limit_total),
      usage_limit_per_user:
        promo?.usage_limit_per_user === null ||
        promo?.usage_limit_per_user === undefined
          ? ""
          : String(promo.usage_limit_per_user),
      is_active: !!promo?.is_active,
      first_order_only: !!promo?.first_order_only,
      stackable: !!promo?.stackable,
    };

    setDraft(next);
    setError(null);
    setIsOpen(true);
  }, []);

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/promo-codes/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeadersSafe(),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create promo code");
      }

      return data?.promoCode;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      closeModal();
    },
    onError: (e) => {
      console.error(e);
      setError(String(e?.message || "Could not create promo code"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/promo-codes/admin", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeadersSafe(),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update promo code");
      }

      return data?.promoCode;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      closeModal();
    },
    onError: (e) => {
      console.error(e);
      setError(String(e?.message || "Could not update promo code"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(
        `/api/promo-codes/admin?id=${encodeURIComponent(String(id))}`,
        {
          method: "DELETE",
          headers: {
            ...getAdminHeadersSafe(),
          },
        },
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete promo code");
      }

      return true;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (e) => {
      console.error(e);
      alert(String(e?.message || "Could not delete promo code"));
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, nextActive }) => {
      const res = await fetch("/api/promo-codes/admin", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeadersSafe(),
        },
        body: JSON.stringify({ id, is_active: nextActive }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update promo code");
      }

      return data?.promoCode;
    },
    onMutate: async ({ id, nextActive }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old) => {
        const list = Array.isArray(old) ? old : [];
        return list.map((p) =>
          p?.id === id ? { ...p, is_active: nextActive } : p,
        );
      });

      return { previous };
    },
    onError: (e, _vars, ctx) => {
      console.error(e);
      if (ctx?.previous) {
        queryClient.setQueryData(queryKey, ctx.previous);
      }
      alert(String(e?.message || "Could not update promo code"));
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const onSave = useCallback(() => {
    setError(null);

    const payload = {
      code: String(draft.code || ""),
      description: draft.description ? String(draft.description) : null,
      discount_type: String(draft.discount_type || "percent"),
      discount_value: draft.discount_value,
      min_subtotal: draft.min_subtotal,
      max_discount: draft.max_discount,
      start_at: fromInputDateTime(draft.start_at),
      end_at: fromInputDateTime(draft.end_at),
      usage_limit_total: draft.usage_limit_total,
      usage_limit_per_user: draft.usage_limit_per_user,
      is_active: !!draft.is_active,
      first_order_only: !!draft.first_order_only,
      stackable: !!draft.stackable,
    };

    const isEditing = !!draft.id;

    if (isEditing) {
      updateMutation.mutate({ id: draft.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }, [createMutation, draft, updateMutation]);

  const isBusy =
    promoQuery.isLoading ||
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    toggleActiveMutation.isPending;

  const topError =
    error ||
    (promoQuery.isError
      ? String(promoQuery.error?.message || "Could not load promo codes")
      : null);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Promo Codes</h2>
          <p className="text-gray-600 text-sm mt-1">
            Create discounts customers can apply at checkout.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-600"
        >
          <PlusCircle size={18} />
          New promo code
        </button>
      </div>

      {topError ? (
        <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-red-700 text-sm">
          {topError}
        </div>
      ) : null}

      <div className="p-6">
        {promoQuery.isLoading ? (
          <div className="text-center py-8 text-gray-600">Loading...</div>
        ) : promoCodes.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-700 font-medium">No promo codes yet</p>
            <p className="text-gray-500 text-sm mt-1">
              Click “New promo code” to create your first one.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Discount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Active
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Window
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {promoCodes.map((p) => {
                  const startLabel = p?.start_at
                    ? new Date(String(p.start_at)).toLocaleString()
                    : "—";
                  const endLabel = p?.end_at
                    ? new Date(String(p.end_at)).toLocaleString()
                    : "—";
                  const activeLabel = p?.is_active ? "Yes" : "No";

                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {String(p.code || "")}
                        </div>
                        <div className="text-xs text-gray-500">
                          {p?.description ? String(p.description) : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {formatDiscount(p)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          disabled={isBusy}
                          onClick={() =>
                            toggleActiveMutation.mutate({
                              id: p.id,
                              nextActive: !p.is_active,
                            })
                          }
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm border ${
                            p?.is_active
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-gray-50 text-gray-700 border-gray-200"
                          }`}
                        >
                          {p?.is_active ? <Check size={14} /> : <X size={14} />}
                          {activeLabel}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div>Start: {startLabel}</div>
                        <div>End: {endLabel}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-2 rounded-md hover:bg-gray-100"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => {
                              const ok = confirm(
                                `Delete promo code ${String(p.code || "")}?`,
                              );
                              if (!ok) {
                                return;
                              }
                              deleteMutation.mutate(p.id);
                            }}
                            className="p-2 rounded-md hover:bg-gray-100 text-red-600"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />

          <div className="relative bg-white w-full max-w-2xl mx-4 rounded-xl shadow-lg overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-gray-900">
                  {draft.id ? "Edit promo code" : "New promo code"}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Codes are stored in uppercase.
                </div>
              </div>
              <button
                className="p-2 rounded-md hover:bg-gray-100"
                onClick={closeModal}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code
                </label>
                <input
                  value={draft.code}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, code: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="WELCOME10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount type
                </label>
                <select
                  value={draft.discount_type}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, discount_type: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount value
                </label>
                <input
                  value={draft.discount_value}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, discount_value: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder={draft.discount_type === "percent" ? "10" : "5"}
                  inputMode="decimal"
                />
                <div className="text-xs text-gray-500 mt-1">
                  {draft.discount_type === "percent"
                    ? "Example: 10 means 10% off"
                    : "Example: 5 means $5 off"}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum subtotal (optional)
                </label>
                <input
                  value={draft.min_subtotal}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, min_subtotal: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="25"
                  inputMode="decimal"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max discount (optional)
                </label>
                <input
                  value={draft.max_discount}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, max_discount: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder={draft.discount_type === "percent" ? "20" : ""}
                  inputMode="decimal"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Active
                </label>
                <select
                  value={draft.is_active ? "yes" : "no"}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      is_active: e.target.value === "yes",
                    }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <input
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, description: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="10% off your first order"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start at (optional)
                </label>
                <input
                  type="datetime-local"
                  value={draft.start_at}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, start_at: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End at (optional)
                </label>
                <input
                  type="datetime-local"
                  value={draft.end_at}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, end_at: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Usage limit total (optional)
                </label>
                <input
                  value={draft.usage_limit_total}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      usage_limit_total: e.target.value,
                    }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="100"
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Usage limit per user (optional)
                </label>
                <input
                  value={draft.usage_limit_per_user}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      usage_limit_per_user: e.target.value,
                    }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="1"
                  inputMode="numeric"
                />
              </div>

              <div className="md:col-span-2 flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!draft.first_order_only}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        first_order_only: e.target.checked,
                      }))
                    }
                  />
                  First order only
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!draft.stackable}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, stackable: e.target.checked }))
                    }
                  />
                  Stackable with other promos
                </label>
              </div>

              {error ? (
                <div className="md:col-span-2 text-sm text-red-600">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="p-5 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                disabled={isBusy}
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={isBusy}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {draft.id ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
