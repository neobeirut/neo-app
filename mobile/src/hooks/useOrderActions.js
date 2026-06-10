import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { nextStatuses, statusOptions } from "@/utils/orderHelpers";

export function useOrderActions({
  orders,
  updateStatusMutation,
  deleteOrderMutation,
  deleteItemMutation,
  updateItemQuantityMutation,
  setExpandedOrder,
}) {
  const handleStatusChange = async (orderId, currentStatus) => {
    await Haptics.selectionAsync();

    // Lock should apply to order CONTENT, not status transitions.
    // We only block status changes for final states.
    if (["completed", "cancelled"].includes(currentStatus)) {
      Alert.alert(
        "Cannot Update",
        "This order is already completed or cancelled.",
      );
      return;
    }

    const order = orders.find((o) => o.id === orderId);
    const orderType = order?.order_type;

    let availableStatuses = nextStatuses[currentStatus] || [];

    // After "ready":
    // - delivery orders should go to "out_for_delivery"
    // - pickup orders should go to "completed"
    if (currentStatus === "ready") {
      if (orderType === "delivery") {
        availableStatuses = ["out_for_delivery"];
      } else {
        availableStatuses = ["completed"];
      }
    }

    // After "out_for_delivery": only completion makes sense
    if (currentStatus === "out_for_delivery") {
      availableStatuses = ["completed"];
    }

    if (availableStatuses.length === 0) {
      Alert.alert("Info", "This order cannot be updated further");
      return;
    }

    const currentLabel =
      statusOptions.find((opt) => opt.value === currentStatus)?.label ||
      currentStatus;

    const buttons = availableStatuses.map((status) => {
      const label =
        statusOptions.find((opt) => opt.value === status)?.label || status;
      return {
        text: label,
        onPress: () => {
          updateStatusMutation.mutate({ orderId, status });
        },
      };
    });

    buttons.push({ text: "Cancel", style: "cancel" });

    Alert.alert(
      "Update Order Status",
      `Current status: ${currentLabel}\n\nSelect new status:`,
      buttons,
    );
  };

  const handleDeleteOrder = (orderId) => {
    Alert.alert(
      "Delete Order",
      "Are you sure you want to delete this order? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteOrderMutation.mutate(orderId);
            setExpandedOrder(null);
          },
        },
      ],
    );
  };

  const handleDeleteItem = (orderId, itemId, itemName) => {
    Alert.alert("Delete Item", `Remove ${itemName} from this order?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteItemMutation.mutate({ orderId, itemId }),
      },
    ]);
  };

  const handleQuantityChange = async (orderId, item, delta) => {
    await Haptics.selectionAsync();
    const newQuantity = item.quantity + delta;

    if (newQuantity < 1) {
      handleDeleteItem(orderId, item.id, item.product_name);
      return;
    }

    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const items = order.items.map((i) => ({
      id: i.id,
      product_id: i.product_id,
      quantity: i.id === item.id ? newQuantity : i.quantity,
      selected_addons: i.addons?.map((a) => a.id) || [],
    }));

    updateItemQuantityMutation.mutate({ orderId, items });
  };

  const handleAddItem = (
    orderId,
    productId,
    setShowAddItemModal,
    setProductSearch,
  ) => {
    if (!orderId) return;

    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const items = [
      ...order.items.map((i) => ({
        id: i.id,
        product_id: i.product_id,
        quantity: i.quantity,
        selected_addons: i.addons?.map((a) => a.id) || [],
      })),
      {
        product_id: productId,
        quantity: 1,
        selected_addons: [],
      },
    ];

    updateItemQuantityMutation.mutate({ orderId, items });
    setShowAddItemModal(false);
    setProductSearch("");
  };

  return {
    handleStatusChange,
    handleDeleteOrder,
    handleDeleteItem,
    handleQuantityChange,
    handleAddItem,
  };
}
