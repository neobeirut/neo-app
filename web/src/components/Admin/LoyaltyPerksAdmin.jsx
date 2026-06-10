import { useEffect, useMemo, useState } from "react";

function getAdminHeaders() {
  try {
    const adminToken = localStorage.getItem("admin_token");
    const adminId = localStorage.getItem("admin_id");
    if (!adminToken || !adminId) return {};
    return {
      "x-admin-token": adminToken,
      "x-admin-id": adminId,
    };
  } catch (e) {
    return {};
  }
}

export default function LoyaltyPerksAdmin({ users }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [settings, setSettings] = useState({
    thresholds: { Silver: 50, Gold: 200, Platinum: 500 },
    maxRewardsPerOrder: 1,
  });

  const [catalog, setCatalog] = useState([]);
  const [tierCounts, setTierCounts] = useState({
    Bronze: 0,
    Silver: 0,
    Gold: 0,
    Platinum: 0,
  });

  const [grantUserId, setGrantUserId] = useState("");
  const [grantCatalogCode, setGrantCatalogCode] = useState("");
  const [grantExpiresDays, setGrantExpiresDays] = useState("7");

  const catalogOptions = useMemo(() => {
    return catalog
      .slice()
      .sort((a, b) => String(a.title).localeCompare(String(b.title)))
      .map((c) => ({
        label: `${c.title} (${c.code})`,
        value: c.code,
      }));
  }, [catalog]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [settingsRes, catalogRes, statsRes] = await Promise.all([
          fetch("/api/loyalty/settings", { headers: getAdminHeaders() }),
          fetch("/api/loyalty/catalog", { headers: getAdminHeaders() }),
          fetch("/api/loyalty/tier-stats", { headers: getAdminHeaders() }),
        ]);

        if (!settingsRes.ok) {
          throw new Error("Failed to load loyalty settings");
        }

        const settingsData = await settingsRes.json();
        const nextSettings = {
          thresholds: settingsData.thresholds || {
            Silver: 50,
            Gold: 200,
            Platinum: 500,
          },
          maxRewardsPerOrder: settingsData.maxRewardsPerOrder || 1,
        };

        const nextCatalog = catalogRes.ok
          ? (await catalogRes.json()).catalog || []
          : [];

        const nextCounts = statsRes.ok
          ? (await statsRes.json()).counts || tierCounts
          : tierCounts;

        if (cancelled) return;

        setSettings(nextSettings);
        setCatalog(Array.isArray(nextCatalog) ? nextCatalog : []);
        setTierCounts({ ...tierCounts, ...(nextCounts || {}) });

        if (!grantCatalogCode && nextCatalog?.[0]?.code) {
          setGrantCatalogCode(nextCatalog[0].code);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setError(e?.message || "Failed to load loyalty admin");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateThreshold = (key, value) => {
    const num = Number(value);
    setSettings((prev) => ({
      ...prev,
      thresholds: {
        ...prev.thresholds,
        [key]: Number.isFinite(num) ? num : prev.thresholds[key],
      },
    }));
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/loyalty/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to save loyalty settings");
      }

      alert("Loyalty settings saved.");
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to save loyalty settings");
    } finally {
      setSaving(false);
    }
  };

  const toggleCatalog = async (item) => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/loyalty/catalog", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to update catalog item");
      }

      setCatalog((prev) =>
        prev.map((c) =>
          c.id === item.id ? { ...c, is_active: !item.is_active } : c,
        ),
      );
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to update catalog item");
    } finally {
      setSaving(false);
    }
  };

  const handleGrant = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const userId = Number(grantUserId);
      const expiresDays = Number(grantExpiresDays);

      if (!Number.isFinite(userId)) {
        throw new Error("Pick a user");
      }

      if (!grantCatalogCode) {
        throw new Error("Pick a reward");
      }

      const response = await fetch("/api/loyalty/grant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify({
          userId,
          catalogCode: grantCatalogCode,
          expiresDays: Number.isFinite(expiresDays) ? expiresDays : undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to grant reward");
      }

      alert("Reward granted.");
      setGrantUserId("");
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to grant reward");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-2">Tier Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(tierCounts).map(([tier, count]) => (
            <div
              key={tier}
              className="border rounded-lg p-3 flex items-center justify-between"
            >
              <div className="text-sm text-gray-600">{tier}</div>
              <div className="text-lg font-semibold text-gray-900">{count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Tier Thresholds</h3>
        {error ? (
          <div className="text-sm text-red-600 mb-3">{error}</div>
        ) : null}

        {loading ? (
          <div className="text-gray-600">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm text-gray-700">
              Silver threshold ($)
              <input
                type="number"
                value={settings.thresholds.Silver}
                onChange={(e) => updateThreshold("Silver", e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </label>
            <label className="text-sm text-gray-700">
              Gold threshold ($)
              <input
                type="number"
                value={settings.thresholds.Gold}
                onChange={(e) => updateThreshold("Gold", e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </label>
            <label className="text-sm text-gray-700">
              Platinum threshold ($)
              <input
                type="number"
                value={settings.thresholds.Platinum}
                onChange={(e) => updateThreshold("Platinum", e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </label>
            <label className="text-sm text-gray-700">
              Max rewards per order
              <input
                type="number"
                min={1}
                max={3}
                value={settings.maxRewardsPerOrder}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    maxRewardsPerOrder: Number(e.target.value || 1),
                  }))
                }
                className="mt-1 w-full border rounded px-3 py-2"
              />
              <div className="text-xs text-gray-500 mt-1">
                Your mobile app currently applies only one reward, but this
                setting is enforced on the backend.
              </div>
            </label>
          </div>
        )}

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Tier Settings"}
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Tier Perks Catalog</h3>
        <div className="text-sm text-gray-600 mb-4">
          Toggle which tier perks are active. Perks are auto-issued based on
          tier + frequency.
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                  Code
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                  Title
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                  Tier
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                  Frequency
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                  Active
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {catalog.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 text-sm text-gray-700">{c.code}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{c.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {c.tier_required}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {c.frequency}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleCatalog(c)}
                      disabled={saving}
                      className={`px-3 py-1 rounded text-sm ${
                        c.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {c.is_active ? "On" : "Off"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Grant Reward to User</h3>
        <form
          onSubmit={handleGrant}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <label className="text-sm text-gray-700">
            User
            <select
              value={grantUserId}
              onChange={(e) => setGrantUserId(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2"
              required
            >
              <option value="">Select user...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email} (Tier: {u.membership_tier || "Bronze"})
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-700">
            Reward
            <select
              value={grantCatalogCode}
              onChange={(e) => setGrantCatalogCode(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2"
              required
            >
              {catalogOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-700">
            Expires in (days)
            <input
              type="number"
              min={1}
              value={grantExpiresDays}
              onChange={(e) => setGrantExpiresDays(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2"
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Granting..." : "Grant Reward"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
