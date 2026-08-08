export function CustomerInfo({ order }) {
  let parsedName = order.customer_name;
  let parsedPhone = order.customer_phone;

  if (!parsedName || parsedName === 'Guest') {
    const matchName = order.special_instructions?.match(/Name:\s*([^\n]+)/i);
    if (matchName) parsedName = matchName[1].trim();
  }

  if (!parsedPhone || parsedPhone === 'N/A') {
    const matchPhone = order.special_instructions?.match(/Phone:\s*([^\n]+)/i);
    if (matchPhone) parsedPhone = matchPhone[1].trim();
  }

  return (
    <div className="mb-6 bg-gray-50 p-4 rounded-lg">
      <h3 className="font-semibold text-lg mb-2">Customer Information</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-600">Name</p>
          <p className="font-medium">{parsedName || "Guest"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Email</p>
          <p className="font-medium">{order.customer_email || "N/A"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Phone</p>
          <p className="font-medium">{parsedPhone || "N/A"}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Branch</p>
          <p className="font-medium">{order.branch_name || "N/A"}</p>
        </div>
      </div>
    </div>
  );
}
