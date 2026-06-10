export function OrderDetails({ order }) {
  return (
    <div className="mb-6 bg-gray-50 p-4 rounded-lg">
      <h3 className="font-semibold text-lg mb-2">Order Details</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-600">Order Type</p>
          <p className="font-medium capitalize">{order.order_type}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Scheduled</p>
          <p className="font-medium">
            {new Date(order.scheduled_date).toLocaleDateString()} at{" "}
            {order.scheduled_time}
          </p>
        </div>
        {order.delivery_address && (
          <div className="col-span-2">
            <p className="text-sm text-gray-600">Delivery Address</p>
            <div className="font-medium">
              <p>{order.address_line1 || order.delivery_address}</p>
              {order.building && <p>{order.building}</p>}
              {order.company_name && <p>{order.company_name}</p>}
              {order.address_line2 && <p>{order.address_line2}</p>}
              {order.city && order.state && (
                <p>
                  {order.city}, {order.state} {order.zip_code}
                </p>
              )}
              {order.latitude && order.longitude && (
                <p className="text-xs text-blue-600 mt-1">
                  📍 GPS: {Number(order.latitude).toFixed(6)},{" "}
                  {Number(order.longitude).toFixed(6)}
                </p>
              )}
            </div>
          </div>
        )}
        {order.special_instructions && (
          <div className="col-span-2">
            <p className="text-sm text-gray-600">Special Instructions</p>
            <p className="font-medium">{order.special_instructions}</p>
          </div>
        )}
      </div>
    </div>
  );
}
