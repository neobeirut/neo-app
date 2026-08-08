import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  CONTENT_LOCKED_STATUSES,
  STATUS_LOCKED_STATUSES,
} from "./OrderDetailsModal/constants";
import {
  calculateItemsTotal,
  calculateOrderTotals,
  formatMoney,
} from "./OrderDetailsModal/utils";
import { useWhatsApp } from "./OrderDetailsModal/useWhatsApp";
import { ModalHeader } from "./OrderDetailsModal/ModalHeader";
import { CustomerInfo } from "./OrderDetailsModal/CustomerInfo";
import { OrderDetails } from "./OrderDetailsModal/OrderDetails";
import { PricingSection } from "./OrderDetailsModal/PricingSection";
import { StatusUpdate } from "./OrderDetailsModal/StatusUpdate";
import { OrderItemsList } from "./OrderDetailsModal/OrderItemsList";
import { WhatsAppModal } from "./OrderDetailsModal/WhatsAppModal";

export default function OrderDetailsModal({
  order,
  onClose,
  onStatusChange,
  onUpdateItems,
  openWhatsAppOnMount,
  onWhatsAppAutoOpenHandled,
}) {
  const [status, setStatus] = useState(order.status);
  const [items, setItems] = useState([]);
  const [isEditing, setIsEditing] = useState(false);

  const isContentLocked = CONTENT_LOCKED_STATUSES.includes(order.status);
  const isStatusLocked = STATUS_LOCKED_STATUSES.includes(order.status);

  const {
    waOpen,
    setWaOpen,
    waPreview,
    waLoading,
    waSending,
    waCanSend,
    waReason,
    waForceNext,
    openWhatsApp,
    loadWhatsAppPreview,
    handleSendWhatsApp,
  } = useWhatsApp(order.id, openWhatsAppOnMount, onWhatsAppAutoOpenHandled);

  useEffect(() => {
    // Hydrate selected_addons from the joined addons array so unedited items
    // retain their product addons when the basket is saved.
    const hydrated = (order.items || []).map((item) => ({
      ...item,
      selected_addons: (item.addons || []).map((a) => a.id).filter(Boolean),
    }));
    setItems(hydrated);
  }, [order]);

  const handleStatusChange = async () => {
    if (status !== order.status) {
      try {
        const result = await onStatusChange(order.id, status);

        console.log(
          "[OrderDetails] ==================== STATUS CHANGE ====================",
        );
        console.log("[OrderDetails] Full API response:", result);
        console.log("[OrderDetails] WhatsApp data:", result?.whatsapp);
        console.log(
          "[OrderDetails] WhatsApp attempted?",
          result?.whatsapp?.attempted,
        );
        console.log("[OrderDetails] WhatsApp sent?", result?.whatsapp?.sent);
        console.log("[OrderDetails] WhatsApp error:", result?.whatsapp?.error);
        console.log(
          "[OrderDetails] WhatsApp method:",
          result?.whatsapp?.method,
        );
        console.log(
          "[OrderDetails] =======================================================",
        );

        if (result?.whatsapp) {
          if (result.whatsapp.sent) {
            toast.success(
              `Status updated! WhatsApp sent via ${result.whatsapp.method}`,
            );
          } else if (result.whatsapp.attempted && result.whatsapp.error) {
            toast.warning(
              `Status updated, but WhatsApp failed: ${result.whatsapp.error}`,
            );
          } else if (result.whatsapp.error) {
            toast.warning(
              `Status updated. WhatsApp not sent: ${result.whatsapp.error}`,
            );
          } else {
            console.warn(
              "[OrderDetails] WhatsApp object exists but no status flags are true",
            );
            toast.success("Status updated successfully!");
          }
        } else {
          console.warn("[OrderDetails] No WhatsApp object in response");
          toast.success("Status updated successfully!");
        }
      } catch (error) {
        console.error("[OrderDetails] Status update error:", error);
        toast.error(`Failed to update status: ${error.message}`);
      }
    }
  };

  const handleUpdateQuantity = (itemId, newQuantity) => {
    if (newQuantity < 1) return;
    setItems(
      items.map((item) =>
        (item.id || item._tempId) === itemId
          ? {
              ...item,
              quantity: newQuantity,
              total_price: item.unit_price * newQuantity,
            }
          : item,
      ),
    );
  };

  const handleRemoveItem = (itemId) => {
    if (confirm("Remove this item from the order?")) {
      setItems(items.filter((item) => (item.id || item._tempId) !== itemId));
    }
  };

  const handleEditItem = (updatedItem) => {
    setItems(
      items.map((item) =>
        (item.id || item._tempId) === (updatedItem.id || updatedItem._tempId)
          ? updatedItem
          : item,
      ),
    );
  };

  const handleAddItem = (newItem) => {
    setItems((prev) => [...prev, newItem]);
  };

  const handleSaveItems = async () => {
    await onUpdateItems(order.id, items);
    setIsEditing(false);
    alert("Order items updated successfully!");
  };

  const itemsTotal = calculateItemsTotal(items);
  const {
    subtotalAmount,
    deliveryFee,
    rewardDiscount,
    promoDiscount,
    totalBeforeDiscount,
    totalCharged,
  } = calculateOrderTotals(order, itemsTotal);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <ModalHeader
          orderId={order.id}
          onClose={onClose}
          onOpenWhatsApp={openWhatsApp}
        />

        <div className="px-6 py-4">
          <CustomerInfo order={order} />
          <OrderDetails order={order} />
          <PricingSection
            order={order}
            subtotalAmount={subtotalAmount}
            deliveryFee={deliveryFee}
            rewardDiscount={rewardDiscount}
            promoDiscount={promoDiscount}
            totalBeforeDiscount={totalBeforeDiscount}
            totalCharged={totalCharged}
            isEditing={isEditing}
            isContentLocked={isContentLocked}
          />
          <StatusUpdate
            status={status}
            originalStatus={order.status}
            isStatusLocked={isStatusLocked}
            onStatusChange={setStatus}
            onUpdateStatus={handleStatusChange}
          />
          <OrderItemsList
            items={items}
            isEditing={isEditing}
            isContentLocked={isContentLocked}
            branchId={order.branch_id}
            onToggleEdit={() => setIsEditing(!isEditing)}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onEditItem={handleEditItem}
            onAddItem={handleAddItem}
            onSaveItems={handleSaveItems}
          />

          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-between items-center text-xl font-bold">
              <span>Total:</span>
              <span>{formatMoney(totalCharged)}</span>
            </div>
          </div>

          <WhatsAppModal
            waOpen={waOpen}
            waPreview={waPreview}
            waLoading={waLoading}
            waSending={waSending}
            waCanSend={waCanSend}
            waReason={waReason}
            waForceNext={waForceNext}
            onClose={() => setWaOpen(false)}
            onRefresh={loadWhatsAppPreview}
            onSend={handleSendWhatsApp}
          />
        </div>
      </div>
    </div>
  );
}
