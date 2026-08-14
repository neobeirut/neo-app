export function CustomerInfo({ order }) {
  return (
    <div className="mb-6 bg-gray-50 p-4 rounded-lg">
      <h3 className="font-semibold text-lg mb-2">Customer Information</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-600">Name</p>
          <p className="font-medium">{order.customer_name || "Guest"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Email</p>
          <p className="font-medium">{order.customer_email || "N/A"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Phone</p>
          <p className="font-medium">{order.customer_phone || "N/A"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Branch</p>
          <p className="font-medium">{order.branch_name || "N/A"}</p>
        </div>
        {order.driver_phone && (
          <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-2.5 mt-1">
            <p className="text-xs text-blue-700 font-bold uppercase tracking-wider">🛵 Assigned Driver Phone</p>
            <p className="font-black text-blue-900 text-base">+{order.driver_phone.replace(/^\+/, '')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
