import { Trash2, Pencil } from "lucide-react";

export function OrderItem({
  item,
  isEditing,
  isContentLocked,
  onUpdateQuantity,
  onRemoveItem,
  onEditItem,
}) {
  const itemCustomizations = Array.isArray(item.customizations)
    ? item.customizations
    : [];

  const options = itemCustomizations.filter(
    (c) => c.customization_type === "option",
  );

  const addons = itemCustomizations.filter(
    (c) => c.customization_type === "addon",
  );

  const removals = itemCustomizations.filter(
    (c) => c.customization_type === "remove",
  );

  const hasOptions = options.length > 0;
  const hasAddons = addons.length > 0;
  const hasRemovals = removals.length > 0;

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start gap-4">
        {item.product_image && (
          <img
            src={item.product_image}
            alt={item.product_name}
            className="w-20 h-20 object-cover rounded-lg"
          />
        )}
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{item.product_name}</h4>
          <p className="text-sm text-gray-600">
            ${parseFloat(item.unit_price).toFixed(2)} each
          </p>

          {/* Per-item note */}
          {item.comment && String(item.comment).trim() && (
            <p className="text-xs text-gray-700 mt-2 italic">
              Note: {String(item.comment)}
            </p>
          )}

          {/* Customizations */}
          {(hasOptions || hasAddons || hasRemovals) && (
            <div className="mt-2">
              {/* Options */}
              {hasOptions && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-blue-700 mb-1">
                    Selected Options:
                  </p>
                  {options.map((custom, idx) => {
                    const priceNumber = Number.parseFloat(custom?.price || 0);
                    const hasPrice =
                      Number.isFinite(priceNumber) && priceNumber > 0;
                    const priceLabel = hasPrice
                      ? ` (+$${priceNumber.toFixed(2)})`
                      : "";

                    return (
                      <p
                        key={`option-${idx}`}
                        className="text-xs text-blue-600 font-medium"
                      >
                        {custom.option_group_name && (
                          <span className="font-semibold">
                            {custom.option_group_name}:{" "}
                          </span>
                        )}
                        {custom.ingredient}
                        {priceLabel}
                      </p>
                    );
                  })}
                </div>
              )}

              {/* Add-ons */}
              {hasAddons && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-green-700 mb-1">
                    Add-ons:
                  </p>
                  {addons.map((custom, idx) => {
                    const priceNumber = Number.parseFloat(custom?.price || 0);
                    const hasPrice =
                      Number.isFinite(priceNumber) && priceNumber > 0;
                    const priceLabel = hasPrice
                      ? ` (+$${priceNumber.toFixed(2)})`
                      : "";

                    return (
                      <p key={`addon-${idx}`} className="text-xs text-gray-600">
                        + {custom.ingredient}
                        {priceLabel}
                      </p>
                    );
                  })}
                </div>
              )}

              {/* Removals */}
              {hasRemovals && (
                <div>
                  <p className="text-xs font-medium text-red-700 mb-1">
                    Removals:
                  </p>
                  {removals.map((custom, idx) => (
                    <p key={`remove-${idx}`} className="text-xs text-gray-600">
                      - No {custom.ingredient}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Legacy add-ons (product_addons / order_item_addons) */}
          {item.addons && item.addons.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-gray-700 mb-1">
                Legacy Add-ons:
              </p>
              {item.addons.map((addon, idx) => (
                <p key={idx} className="text-xs text-gray-600">
                  • {addon.name} (+${parseFloat(addon.price).toFixed(2)})
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isEditing && !isContentLocked ? (
            <>
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) =>
                  onUpdateQuantity(
                    item.id || item._tempId,
                    parseInt(e.target.value),
                  )
                }
                className="w-16 border border-gray-300 rounded px-2 py-1 text-center"
              />
              <button
                onClick={() => onEditItem(item)}
                className="text-blue-500 hover:text-blue-700"
                title="Edit item"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => onRemoveItem(item.id || item._tempId)}
                className="text-red-600 hover:text-red-800"
                title="Remove item"
              >
                <Trash2 size={18} />
              </button>
            </>
          ) : (
            <span className="text-gray-600">Qty: {item.quantity}</span>
          )}
          <span className="font-medium text-gray-900 w-24 text-right">
            ${parseFloat(item.total_price).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
