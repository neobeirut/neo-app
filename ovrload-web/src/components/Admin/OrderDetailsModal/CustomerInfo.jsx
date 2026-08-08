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
      </div>
    </div>
  );
}
