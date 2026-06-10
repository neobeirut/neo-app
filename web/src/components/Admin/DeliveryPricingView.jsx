"use client";
import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Save, X } from "lucide-react";

export default function DeliveryPricingView() {
  const [rules, setRules] = useState([]);
  const [freePeriods, setFreePeriods] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [showPeriodForm, setShowPeriodForm] = useState(false);

  // Get admin token from localStorage
  const getAdminHeaders = () => {
    const token = localStorage.getItem("admin_token");
    return {
      "Content-Type": "application/json",
      "x-admin-token": token || "",
    };
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = getAdminHeaders();

      const [rulesRes, periodsRes, branchesRes] = await Promise.all([
        fetch("/api/delivery/pricing-rules", { headers }),
        fetch("/api/delivery/free-periods", { headers }),
        fetch("/api/branches", { headers }),
      ]);

      const [rulesData, periodsData, branchesData] = await Promise.all([
        rulesRes.json(),
        periodsRes.json(),
        branchesRes.json(),
      ]);

      setRules(rulesData.rules || []);
      setFreePeriods(periodsData.periods || []);
      setBranches(branchesData.branches || []);
    } catch (error) {
      console.error("Error loading data:", error);
      alert("Failed to load delivery pricing data");
    } finally {
      setLoading(false);
    }
  };

  const saveRule = async (rule) => {
    try {
      const url = "/api/delivery/pricing-rules";
      const method = rule.id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: getAdminHeaders(),
        body: JSON.stringify(rule),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save rule");
      }

      await loadData();
      setEditingRule(null);
      setShowRuleForm(false);
    } catch (error) {
      console.error("Error saving rule:", error);
      alert(error.message || "Failed to save rule");
    }
  };

  const deleteRule = async (id) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;

    try {
      const response = await fetch(`/api/delivery/pricing-rules?id=${id}`, {
        method: "DELETE",
        headers: getAdminHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to delete rule");
      }

      await loadData();
    } catch (error) {
      console.error("Error deleting rule:", error);
      alert("Failed to delete rule");
    }
  };

  const savePeriod = async (period) => {
    try {
      const url = "/api/delivery/free-periods";
      const method = period.id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: getAdminHeaders(),
        body: JSON.stringify(period),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save period");
      }

      await loadData();
      setEditingPeriod(null);
      setShowPeriodForm(false);
    } catch (error) {
      console.error("Error saving period:", error);
      alert(error.message || "Failed to save period");
    }
  };

  const deletePeriod = async (id) => {
    if (!confirm("Are you sure you want to delete this period?")) return;

    try {
      const response = await fetch(`/api/delivery/free-periods?id=${id}`, {
        method: "DELETE",
        headers: getAdminHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to delete period");
      }

      await loadData();
    } catch (error) {
      console.error("Error deleting period:", error);
      alert("Failed to delete period");
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Delivery Pricing Management</h1>

      {/* Distance-Based Pricing Rules */}
      <section className="mb-12">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">
            Distance-Based Pricing Rules
          </h2>
          <button
            onClick={() => {
              setEditingRule({
                branchId: null,
                minDistanceKm: "",
                maxDistanceKm: "",
                deliveryCost: "",
                isActive: true,
                displayOrder: rules.length,
              });
              setShowRuleForm(true);
            }}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            <Plus size={20} />
            Add Rule
          </button>
        </div>

        {showRuleForm && editingRule && (
          <RuleForm
            rule={editingRule}
            branches={branches}
            onSave={saveRule}
            onCancel={() => {
              setEditingRule(null);
              setShowRuleForm(false);
            }}
          />
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Branch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Distance Range (km)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rules.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No pricing rules defined. Add a rule to get started.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">
                      {rule.branch_name || "Global"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {rule.min_distance_km} - {rule.max_distance_km} km
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      ${parseFloat(rule.delivery_cost).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          rule.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {rule.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <button
                        onClick={() => {
                          setEditingRule({
                            id: rule.id,
                            branchId: rule.branch_id,
                            minDistanceKm: parseFloat(rule.min_distance_km),
                            maxDistanceKm: parseFloat(rule.max_distance_km),
                            deliveryCost: parseFloat(rule.delivery_cost),
                            isActive: rule.is_active,
                            displayOrder: rule.display_order,
                          });
                          setShowRuleForm(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 mr-3"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Free Delivery Periods */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Free Delivery Periods</h2>
          <button
            onClick={() => {
              setEditingPeriod({
                name: "",
                startAt: "",
                endAt: "",
                maxDistanceKm: null,
                branchIds: null,
                isActive: true,
              });
              setShowPeriodForm(true);
            }}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            <Plus size={20} />
            Add Period
          </button>
        </div>

        {showPeriodForm && editingPeriod && (
          <PeriodForm
            period={editingPeriod}
            branches={branches}
            onSave={savePeriod}
            onCancel={() => {
              setEditingPeriod(null);
              setShowPeriodForm(false);
            }}
          />
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Max Distance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {freePeriods.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No free delivery periods defined.
                  </td>
                </tr>
              ) : (
                freePeriods.map((period) => (
                  <tr key={period.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium">
                      {period.name}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {new Date(period.start_at).toLocaleString()} -{" "}
                      {new Date(period.end_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {period.max_distance_km
                        ? `${period.max_distance_km} km`
                        : "Unlimited"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          period.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {period.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <button
                        onClick={() => {
                          setEditingPeriod({
                            id: period.id,
                            name: period.name,
                            startAt: period.start_at,
                            endAt: period.end_at,
                            maxDistanceKm: period.max_distance_km,
                            branchIds: period.branch_ids,
                            isActive: period.is_active,
                          });
                          setShowPeriodForm(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 mr-3"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => deletePeriod(period.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RuleForm({ rule, branches, onSave, onCancel }) {
  const [formData, setFormData] = useState(rule);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate that all required fields are filled
    if (
      !formData.minDistanceKm ||
      !formData.maxDistanceKm ||
      !formData.deliveryCost
    ) {
      alert("Please fill in all required fields");
      return;
    }

    // Convert string values to numbers
    const submitData = {
      ...formData,
      minDistanceKm: parseFloat(formData.minDistanceKm),
      maxDistanceKm: parseFloat(formData.maxDistanceKm),
      deliveryCost: parseFloat(formData.deliveryCost),
    };

    onSave(submitData);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-50 p-6 rounded-lg mb-6 border border-gray-200"
    >
      <h3 className="text-lg font-semibold mb-4">
        {rule.id ? "Edit Rule" : "Add Rule"}
      </h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Branch (leave empty for global)
          </label>
          <select
            value={formData.branchId || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                branchId: e.target.value ? parseInt(e.target.value) : null,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded"
          >
            <option value="">Global (All Branches)</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Delivery Cost ($) *
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={formData.deliveryCost}
            onChange={(e) =>
              setFormData({
                ...formData,
                deliveryCost: e.target.value,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded"
            placeholder="e.g., 5.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Min Distance (km) *
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={formData.minDistanceKm}
            onChange={(e) =>
              setFormData({
                ...formData,
                minDistanceKm: e.target.value,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded"
            placeholder="e.g., 0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Distance (km) *
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={formData.maxDistanceKm}
            onChange={(e) =>
              setFormData({
                ...formData,
                maxDistanceKm: e.target.value,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded"
            placeholder="e.g., 5"
          />
        </div>

        <div className="col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData({ ...formData, isActive: e.target.checked })
              }
              className="rounded"
            />
            <span className="text-sm font-medium text-gray-700">Active</span>
          </label>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
        >
          <X size={18} />
          Cancel
        </button>
        <button
          type="submit"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          <Save size={18} />
          Save
        </button>
      </div>
    </form>
  );
}

function PeriodForm({ period, branches, onSave, onCancel }) {
  const [formData, setFormData] = useState(period);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-50 p-6 rounded-lg mb-6 border border-gray-200"
    >
      <h3 className="text-lg font-semibold mb-4">
        {period.id ? "Edit Free Delivery Period" : "Add Free Delivery Period"}
      </h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Campaign Name
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded"
            placeholder="e.g., Holiday Free Delivery"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Date & Time
          </label>
          <input
            type="datetime-local"
            required
            value={
              formData.startAt
                ? new Date(formData.startAt).toISOString().slice(0, 16)
                : ""
            }
            onChange={(e) =>
              setFormData({
                ...formData,
                startAt: new Date(e.target.value).toISOString(),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Date & Time
          </label>
          <input
            type="datetime-local"
            required
            value={
              formData.endAt
                ? new Date(formData.endAt).toISOString().slice(0, 16)
                : ""
            }
            onChange={(e) =>
              setFormData({
                ...formData,
                endAt: new Date(e.target.value).toISOString(),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Distance (km) - optional
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.maxDistanceKm || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                maxDistanceKm: e.target.value
                  ? parseFloat(e.target.value)
                  : null,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded"
            placeholder="Leave empty for unlimited"
          />
        </div>

        <div className="col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData({ ...formData, isActive: e.target.checked })
              }
              className="rounded"
            />
            <span className="text-sm font-medium text-gray-700">Active</span>
          </label>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
        >
          <X size={18} />
          Cancel
        </button>
        <button
          type="submit"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          <Save size={18} />
          Save
        </button>
      </div>
    </form>
  );
}
