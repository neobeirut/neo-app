export function applyInventoryStatusRule(currentStatus, quantityOnHand) {
  // Preserve "hard" admin statuses
  if (
    currentStatus === "Hide from Menu" ||
    currentStatus === "Unavailable Until Further Notice"
  ) {
    return currentStatus;
  }

  if (quantityOnHand <= 0) {
    return "Unavailable Today";
  }

  // Auto-recover back to Available if restocked and it was Unavailable Today
  if (currentStatus === "Unavailable Today") {
    return "Available";
  }

  return currentStatus;
}
