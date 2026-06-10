import { formatMoney } from "./utils";

export function PricingSection({
  order,
  subtotalAmount,
  deliveryFee,
  rewardDiscount,
  promoDiscount,
  totalBeforeDiscount,
  totalCharged,
  isEditing,
  isContentLocked,
}) {
  return (
    <div className="mb-6 bg-gray-50 p-4 rounded-lg">
      <h3 className="font-semibold text-lg mb-2">Pricing</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-600">Subtotal</p>
          <p className="font-medium">{formatMoney(subtotalAmount)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Delivery Fee</p>
          <p className="font-medium">{formatMoney(deliveryFee)}</p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Rewards Discount</p>
          <p className="font-medium">
            {rewardDiscount > 0
              ? `- ${formatMoney(rewardDiscount)}`
              : formatMoney(0)}
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Promo</p>
          <p className="font-medium">
            {order.promo_code ? (
              <span>
                {String(order.promo_code).toUpperCase()} (
                {promoDiscount > 0
                  ? `- ${formatMoney(promoDiscount)}`
                  : formatMoney(0)}
                )
              </span>
            ) : (
              <span className="text-gray-500">None</span>
            )}
          </p>
        </div>

        {order.reward_title && (
          <div className="col-span-2">
            <p className="text-sm text-gray-600">Applied Reward</p>
            <div className="font-medium bg-purple-50 border border-purple-200 rounded-lg p-3 mt-1">
              <div className="flex items-center gap-2 text-purple-800">
                <span className="text-lg">🎁</span>
                <span className="font-semibold">{order.reward_title}</span>
              </div>
              {order.reward_description && (
                <p className="text-sm text-purple-700 mt-1 ml-7">
                  {order.reward_description}
                </p>
              )}
              {order.reward_code && (
                <p className="text-xs text-purple-600 mt-1 ml-7 font-mono">
                  Code: {order.reward_code}
                </p>
              )}
            </div>
          </div>
        )}

        <div>
          <p className="text-sm text-gray-600">Total Before Discounts</p>
          <p className="font-medium">{formatMoney(totalBeforeDiscount)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Total Charged</p>
          <p className="font-medium">{formatMoney(totalCharged)}</p>
        </div>
      </div>

      {isEditing && !isContentLocked && (
        <p className="text-xs text-gray-500 mt-3">
          Note: while editing items, the promo is not re-validated. The "Total
          Charged" shows what the customer was originally charged.
        </p>
      )}
    </div>
  );
}
