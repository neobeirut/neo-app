import { useState } from "react";

export function DeliveryCostSection({ deliveryCost, onUpdateDeliveryCost }) {
  const [cost, setCost] = useState(deliveryCost?.toString() || "3.99");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onUpdateDeliveryCost(parseFloat(cost));
      alert("Delivery cost updated successfully!");
    } catch (error) {
      console.error("Error updating delivery cost:", error);
      alert(error?.message || "Failed to update delivery cost");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-2xl mb-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="delivery-cost"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Delivery Cost ($)
          </label>
          <input
            id="delivery-cost"
            type="number"
            step="0.01"
            min="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
            placeholder="3.99"
          />
          <p className="mt-2 text-sm text-gray-500">
            This is the delivery fee charged to customers for delivery orders.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
