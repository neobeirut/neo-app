import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PlusCircle,
  Pencil,
  Trash2,
  Star,
  StarOff,
  Ban,
  Eye,
  EyeOff,
} from "lucide-react";
import EventFormModal from "@/components/Admin/EventFormModal";

function isPastEvent(startAt, endAt) {
  try {
    const start = startAt ? new Date(startAt) : null;
    const end = endAt ? new Date(endAt) : null;
    const compare = end && !Number.isNaN(end.getTime()) ? end : start;
    if (!compare || Number.isNaN(compare.getTime())) return false;
    return compare.getTime() < Date.now();
  } catch (e) {
    return false;
  }
}

function formatShort(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  } catch (e) {
    return "";
  }
}

export default function EventsView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [timingFilter, setTimingFilter] = useState("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const getAdminHeaders = useCallback(() => {
    try {
      const adminToken = localStorage.getItem("admin_token");
      const adminId = localStorage.getItem("admin_id");
      if (!adminToken || !adminId) return {};
      return {
        "x-admin-token": adminToken,
        "x-admin-id": adminId, // dev fallback only
      };
    } catch (e) {
      return {};
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("status", statusFilter);
      params.set("timing", timingFilter);
      if (featuredOnly) params.set("featured", "true");
      if (search) params.set("search", search);
      params.set("limit", "100");
      params.set("offset", "0");

      const response = await fetch(`/api/events/admin?${params.toString()}`, {
        headers: {
          ...getAdminHeaders(),
        },
      });

      if (response.status === 401 || response.status === 403) {
        setItems([]);
        setError("Admin session expired. Please login again.");
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data?.error || `Failed to fetch (status ${response.status})`,
        );
      }

      const data = await response.json();
      setItems(Array.isArray(data.events) ? data.events : []);
    } catch (err) {
      console.error(err);
      setItems([]);
      setError(err?.message || "Failed to fetch events");
    } finally {
      setLoading(false);
    }
  }, [featuredOnly, getAdminHeaders, search, statusFilter, timingFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const openCreate = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const updateEvent = async (id, patch) => {
    const response = await fetch(`/api/events/admin/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getAdminHeaders(),
      },
      body: JSON.stringify(patch),
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error("Admin session expired. Please login again.");
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || `Failed (status ${response.status})`);
    }
  };

  const deleteEvent = async (id) => {
    if (!confirm("Delete this event? This cannot be undone.")) return;

    const response = await fetch(`/api/events/admin/${id}`, {
      method: "DELETE",
      headers: {
        ...getAdminHeaders(),
      },
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error("Admin session expired. Please login again.");
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || `Failed (status ${response.status})`);
    }
  };

  const rows = useMemo(() => {
    return items.map((e) => {
      const past = isPastEvent(e.start_at, e.end_at);
      return { ...e, _past: past };
    });
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Events</h2>
          <p className="text-gray-600 mt-1">
            Upcoming events + past recap gallery (photos/videos).
          </p>
        </div>

        <button
          onClick={openCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <PlusCircle size={18} />
          Add Event
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm text-gray-700 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">
            Upcoming/Past
          </label>
          <select
            value={timingFilter}
            onChange={(e) => setTimingFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="all">All</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
          </select>
        </div>

        <div className="flex-1 min-w-[240px]">
          <label className="block text-sm text-gray-700 mb-1">Search</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Search by name"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
          <input
            type="checkbox"
            checked={featuredOnly}
            onChange={(e) => setFeaturedOnly(e.target.checked)}
          />
          Featured only
        </label>

        <button
          onClick={fetchEvents}
          className="px-4 py-2 rounded-lg border hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      ) : null}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-gray-600">Loading...</div>
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">When</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Media</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const status = String(e.status || "draft");
                  const past = !!e._past;

                  return (
                    <tr key={e.id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {e.featured ? (
                            <Star size={16} className="text-amber-500" />
                          ) : null}
                          {e.name}
                        </div>
                        {e.reservation_required ? (
                          <div className="text-xs text-gray-500 mt-1">
                            Reservation required
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 mt-1">
                            Walk-in
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div>{formatShort(e.start_at)}</div>
                        {e.end_at ? (
                          <div className="text-xs text-gray-500">
                            End: {formatShort(e.end_at)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs border ${
                            past
                              ? "bg-gray-50 text-gray-700 border-gray-200"
                              : "bg-green-50 text-green-700 border-green-200"
                          }`}
                        >
                          {past ? "Past" : "Upcoming"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs border ${
                            status === "published"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : status === "cancelled"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-gray-50 text-gray-700 border-gray-200"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {past ? (
                          <span className="text-xs text-gray-600">
                            {e.recap_images?.length || 0} photos •{" "}
                            {e.recap_videos?.length || 0} videos
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600">
                            {e.images?.length || 0} extra images
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(e)}
                            className="p-2 rounded hover:bg-gray-100"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            onClick={async () => {
                              try {
                                await updateEvent(e.id, {
                                  featured: !e.featured,
                                });
                                await fetchEvents();
                              } catch (err) {
                                alert(err?.message || "Failed");
                              }
                            }}
                            className="p-2 rounded hover:bg-gray-100"
                            title={e.featured ? "Unfeature" : "Feature"}
                          >
                            {e.featured ? (
                              <StarOff size={16} className="text-amber-600" />
                            ) : (
                              <Star size={16} className="text-amber-600" />
                            )}
                          </button>

                          <button
                            onClick={async () => {
                              try {
                                const nextStatus =
                                  status === "published"
                                    ? "draft"
                                    : "published";
                                await updateEvent(e.id, { status: nextStatus });
                                await fetchEvents();
                              } catch (err) {
                                alert(err?.message || "Failed");
                              }
                            }}
                            className="p-2 rounded hover:bg-gray-100"
                            title={
                              status === "published" ? "Unpublish" : "Publish"
                            }
                          >
                            {status === "published" ? (
                              <EyeOff size={16} />
                            ) : (
                              <Eye size={16} />
                            )}
                          </button>

                          <button
                            onClick={async () => {
                              try {
                                await updateEvent(e.id, {
                                  status: "cancelled",
                                });
                                await fetchEvents();
                              } catch (err) {
                                alert(err?.message || "Failed");
                              }
                            }}
                            className="p-2 rounded hover:bg-gray-100 text-red-600"
                            title="Cancel event"
                          >
                            <Ban size={16} />
                          </button>

                          <button
                            onClick={async () => {
                              try {
                                await deleteEvent(e.id);
                                await fetchEvents();
                              } catch (err) {
                                alert(err?.message || "Failed");
                              }
                            }}
                            className="p-2 rounded hover:bg-gray-100 text-red-600"
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
        ) : (
          <div className="p-6 text-gray-600">No events found.</div>
        )}
      </div>

      <EventFormModal
        isOpen={modalOpen}
        editingItem={editingItem}
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          await fetchEvents();
        }}
        getAdminHeaders={getAdminHeaders}
      />
    </div>
  );
}
