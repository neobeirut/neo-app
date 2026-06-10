import { Edit2, Trash2 } from "lucide-react";

function formatRewardBenefit(reward) {
  const discount =
    reward.discount_amount === null || reward.discount_amount === undefined
      ? 0
      : Number.parseFloat(reward.discount_amount);

  const hasDiscount = Number.isFinite(discount) && discount > 0;
  const freeDelivery = reward.free_delivery === true;

  if (hasDiscount && freeDelivery) {
    return `$${discount.toFixed(2)} off + Free Delivery`;
  }
  if (hasDiscount) {
    return `$${discount.toFixed(2)} off`;
  }
  if (freeDelivery) {
    return "Free Delivery";
  }
  return "—";
}

export function RewardsTable({ rewards, onEdit, onDelete }) {
  return (
    <table className="w-full">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
            Title
          </th>
          <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
            Description
          </th>
          <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
            Points Cost
          </th>
          <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
            Benefit
          </th>
          <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
            Image
          </th>
          <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {rewards.map((reward) => {
          const benefit = formatRewardBenefit(reward);
          return (
            <tr key={reward.id}>
              <td className="px-6 py-4 text-sm text-gray-900">
                {reward.title}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {reward.description}
              </td>
              <td className="px-6 py-4 text-sm text-gray-900">
                {reward.points_cost} pts
              </td>
              <td className="px-6 py-4 text-sm text-gray-900">{benefit}</td>
              <td className="px-6 py-4">
                <img
                  src={reward.image_url}
                  alt={reward.title}
                  className="w-12 h-12 object-cover rounded"
                />
              </td>
              <td className="px-6 py-4 text-sm">
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(reward)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(reward.id, "rewards")}
                    className="text-red-600 hover:text-red-800"
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
  );
}
