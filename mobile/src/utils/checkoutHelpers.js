// Generate next 7 days for date picker
export const getDateOptions = () => {
  const options = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];
    const label =
      i === 0
        ? "Today"
        : i === 1
          ? "Tomorrow"
          : date.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
    options.push({ value: dateStr, label });
  }
  return options;
};

// Available time options
export const timeOptions = [
  "8:00 AM",
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
  "6:00 PM",
];

// Convert 12-hour time to 24-hour format
export const convertTo24Hour = (time12h) => {
  const [time, modifier] = time12h.split(" ");
  let [hours, minutes] = time.split(":");
  if (hours === "12") {
    hours = "00";
  }
  if (modifier === "PM") {
    hours = parseInt(hours, 10) + 12;
  }
  return `${hours}:${minutes}:00`;
};

// Format address for display
export const formatAddress = (addr) => {
  if (!addr) return "Select address";
  return `${addr.address_line1}${addr.address_line2 ? ", " + addr.address_line2 : ""}, ${addr.city}, ${addr.state}`;
};

// Calculate subtotal from cart items
export const calculateSubtotal = (cartData) => {
  if (!cartData?.cart_items) return 0;
  return cartData.cart_items.reduce((total, item) => {
    const itemPrice = parseFloat(item.price);
    const addonsPrice =
      item.addons?.reduce(
        (sum, addon) => sum + parseFloat(addon.price || 0),
        0,
      ) || 0;

    // Calculate customizations price (only add-ons have prices)
    const customizationsPrice =
      item.customizations?.reduce((sum, customization) => {
        if (customization.customization_type === "addon") {
          return sum + parseFloat(customization.price || 0);
        }
        return sum;
      }, 0) || 0;

    return (
      total + (itemPrice + addonsPrice + customizationsPrice) * item.quantity
    );
  }, 0);
};
