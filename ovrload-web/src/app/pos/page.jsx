"use client";

import { useState, useEffect, useRef } from "react";

export default function TabletPOSPage() {
  // Data States
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Order States
  // 1. Order Origin should NOT have a default value and is required. First channel is "Toters".
  const [selectedChannel, setSelectedChannel] = useState(null); // Toters, WhatsApp, NokNok, App, In-Store
  // 2. By default Delivery not Pickup
  const [orderType, setOrderType] = useState("delivery"); // delivery, pickup, dine_in
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  
  // Admin Configured Channel Discounts (Fetched from admin settings)
  const [totersDiscountPercent, setTotersDiscountPercent] = useState(15);
  const [noknokDiscountPercent, setNoknokDiscountPercent] = useState(15);

  // Discount Selection State
  const [discountType, setDiscountType] = useState("none"); // "none", "15%", "toters", "noknok", "custom"
  const [discountValInput, setDiscountValInput] = useState(10);
  const [discountIsPercent, setDiscountIsPercent] = useState(true); // true = %, false = $ USD

  // Print Server Settings (configured in Admin → Settings → Printer)
  const [printServerIP, setPrintServerIP] = useState("");
  const [printServerPort, setPrintServerPort] = useState(9191);

  const [ticketItems, setTicketItems] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState(null); // Track if editing an incoming WhatsApp order

  // Queue & Modal States
  const [heldOrders, setHeldOrders] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [activeTabModal, setActiveTabModal] = useState(null); // 'held', 'incoming', 'payment', 'customization', 'void_item', 'receipt'
  
  // Customization Modal State
  const [currentProduct, setCurrentProduct] = useState(null);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [selectedCustomizations, setSelectedCustomizations] = useState([]);
  const [itemNote, setItemNote] = useState("");
  const [customizationQty, setCustomizationQty] = useState(1);
  const [customizationError, setCustomizationError] = useState("");

  // Void Reason State
  const [voidingItemIndex, setVoidingItemIndex] = useState(null);
  const [voidReason, setVoidReason] = useState("");

  // Payment State
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("Cash");
  const [lastCompletedOrder, setLastCompletedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [copiedWaMsg, setCopiedWaMsg] = useState(false);
  const [dispatchStatusMsg, setDispatchStatusMsg] = useState("");
  const [deliveryCompanyPhone, setDeliveryCompanyPhone] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pos_delivery_company_phone") || "";
    }
    return "";
  });

  // Order History & Reprint State
  const [completedOrdersHistory, setCompletedOrdersHistory] = useState([]);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [reprintSuccessMsg, setReprintSuccessMsg] = useState("");

  // Customer Search & Autocomplete State
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const handleCustomerSearch = async (query) => {
    if (!query || query.trim().length < 2) {
      setCustomerSearchResults([]);
      setShowCustomerDropdown(false);
      return;
    }
    setIsSearchingCustomers(true);
    try {
      const res = await fetch(`/api/pos/customers?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (data.customers && data.customers.length > 0) {
        setCustomerSearchResults(data.customers);
        setShowCustomerDropdown(true);
      } else {
        setCustomerSearchResults([]);
        setShowCustomerDropdown(false);
      }
    } catch (err) {
      console.error("Error searching customers:", err);
    } finally {
      setIsSearchingCustomers(false);
    }
  };

  const handleSelectCustomer = (c) => {
    if (c.customer_name) setCustomerName(c.customer_name);
    if (c.customer_phone) setCustomerPhone(c.customer_phone);
    if (c.delivery_address) setDeliveryAddress(c.delivery_address);
    setShowCustomerDropdown(false);
  };

  // Auto-calculate delivery fee in POS when delivery address is entered
  useEffect(() => {
    if (orderType !== "delivery" || !deliveryAddress.trim()) {
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/delivery/calculate-cost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branchId: 1, address: deliveryAddress.trim() }),
        });
        const data = await res.json();
        if (data.deliveryCost !== undefined && data.deliveryCost > 0) {
          setDeliveryFee(data.deliveryCost);
        }
      } catch (err) {
        console.error("Error calculating POS delivery fee:", err);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [deliveryAddress, orderType]);

  const receiptPrintRef = useRef(null);

  // Load Products & Categories
  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/pos/products");
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
      if (data.products) setProducts(data.products);
      if (data.settings) {
        if (data.settings.toters_discount_percent !== undefined) setTotersDiscountPercent(data.settings.toters_discount_percent);
        if (data.settings.noknok_discount_percent !== undefined) setNoknokDiscountPercent(data.settings.noknok_discount_percent);
        if (data.settings.print_server_ip)   setPrintServerIP(data.settings.print_server_ip);
        if (data.settings.print_server_port) setPrintServerPort(Number(data.settings.print_server_port));
      }
    } catch (err) {
      console.error("Error fetching POS products:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load Pending WhatsApp & Held Orders
  const fetchOrdersQueue = async () => {
    try {
      const [pendingRes, heldRes] = await Promise.all([
        fetch("/api/pos/orders?type=pending"),
        fetch("/api/pos/orders?type=held")
      ]);
      const pendingData = await pendingRes.json();
      const heldData = await heldRes.json();
      if (pendingData.orders) setPendingOrders(pendingData.orders);
      if (heldData.orders) setHeldOrders(heldData.orders);
    } catch (err) {
      console.error("Error fetching orders queue:", err);
    }
  };

  // PWA Install State
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const handleInstallPWA = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredInstallPrompt(null);
      }
    } else {
      setActiveTabModal("install_guide");
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchOrdersQueue();
    const interval = setInterval(fetchOrdersQueue, 10000); // Polling pending orders every 10s
    return () => clearInterval(interval);
  }, []);

  // Filter Products by Category (No search required)
  const filteredProducts = products.filter((p) => {
    return (
      selectedCategory === "All" ||
      p.category_name?.toLowerCase() === selectedCategory.toLowerCase()
    );
  });

  // Open Customization Modal
  const handleOpenCustomization = (product, itemIndex = null) => {
    setCurrentProduct(product);
    setEditingItemIndex(itemIndex);
    setCustomizationError("");

    if (itemIndex !== null) {
      const existing = ticketItems[itemIndex];
      setSelectedCustomizations(existing.selectedCustomizations || []);
      setItemNote(existing.note || "");
      setCustomizationQty(existing.qty || 1);
    } else {
      // No default selection (Drinks & options start unselected and are required)
      setSelectedCustomizations([]);
      setItemNote("");
      setCustomizationQty(1);
    }
    setActiveTabModal("customization");
  };

  // Toggle Customization Option
  const handleToggleOption = (custOption, isMultiSelect) => {
    setCustomizationError("");
    if (isMultiSelect) {
      const exists = selectedCustomizations.some((c) => c.id === custOption.id);
      if (exists) {
        setSelectedCustomizations(selectedCustomizations.filter((c) => c.id !== custOption.id));
      } else {
        setSelectedCustomizations([...selectedCustomizations, custOption]);
      }
    } else {
      const groupName = custOption.option_group_name;
      const filtered = selectedCustomizations.filter((c) => c.option_group_name !== groupName);
      setSelectedCustomizations([...filtered, custOption]);
    }
  };

  // Save Customization to Ticket Cart (Enforces Drinks/Required groups)
  const handleSaveCustomizationToCart = () => {
    if (!currentProduct) return;

    // Validate Required Groups (e.g. Drinks)
    if (currentProduct.customizations?.length > 0) {
      const grouped = currentProduct.customizations.reduce((acc, c) => {
        const group = c.option_group_name || (c.customization_type === "remove" ? "Remove Ingredients" : "Custom Options");
        if (!acc[group]) acc[group] = [];
        acc[group].push(c);
        return acc;
      }, {});

      for (const [groupName, opts] of Object.entries(grouped)) {
        const isReq = opts[0]?.is_required || groupName.toLowerCase().includes("drink");
        if (isReq) {
          const hasSelected = selectedCustomizations.some((c) => opts.some((o) => o.id === c.id));
          if (!hasSelected) {
            setCustomizationError(`⚠️ Selection for "${groupName}" is REQUIRED! Please choose one.`);
            return;
          }
        }
      }
    }

    let extraCost = 0;
    selectedCustomizations.forEach((c) => {
      if (c.price) extraCost += c.price;
    });

    const unitPrice = (currentProduct.unit_price_usd || 0) + extraCost;

    const newItem = {
      product_id: currentProduct.id,
      name: currentProduct.name,
      base_price: currentProduct.unit_price_usd,
      unit_price: unitPrice,
      qty: customizationQty,
      selectedCustomizations,
      note: itemNote.trim()
    };

    if (editingItemIndex !== null) {
      const updated = [...ticketItems];
      updated[editingItemIndex] = newItem;
      setTicketItems(updated);
    } else {
      setTicketItems([...ticketItems, newItem]);
    }

    setActiveTabModal(null);
    setCurrentProduct(null);
    setCustomizationError("");
  };

  // Change Quantity in Ticket
  const handleUpdateQty = (index, delta) => {
    const updated = [...ticketItems];
    const item = updated[index];
    const newQty = item.qty + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      item.qty = newQty;
    }
    setTicketItems(updated);
  };

  // Open Void Item Dialog
  const handlePromptVoid = (index) => {
    setVoidingItemIndex(index);
    setVoidReason("");
    setActiveTabModal("void_item");
  };

  const handleConfirmVoidItem = () => {
    if (voidingItemIndex === null) return;
    const updated = [...ticketItems];
    updated.splice(voidingItemIndex, 1);
    setTicketItems(updated);
    setVoidingItemIndex(null);
    setVoidReason("");
    setActiveTabModal(null);
  };

  // Totals & Dynamic Discount Calculations (Toters & NokNok rates managed by Admin)
  const subtotal = ticketItems.reduce((sum, item) => sum + item.unit_price * item.qty, 0);

  const calculatedDiscount = (() => {
    if (discountType === "15%") {
      return subtotal * 0.15;
    }
    if (discountType === "toters") {
      return subtotal * (totersDiscountPercent / 100);
    }
    if (discountType === "noknok") {
      return subtotal * (noknokDiscountPercent / 100);
    }
    if (discountType === "custom") {
      const val = parseFloat(discountValInput) || 0;
      if (discountIsPercent) {
        return subtotal * (val / 100);
      }
      return Math.min(subtotal, val);
    }
    return 0;
  })();

  const discountAmount = calculatedDiscount;
  const total = Math.max(0, subtotal + (Number(deliveryFee) || 0) - discountAmount);

  // Human-readable discount label for receipt
  const discountLabel = (() => {
    if (discountType === "15%")    return "15% Off";
    if (discountType === "toters") return `Toters (${totersDiscountPercent}%)`;
    if (discountType === "noknok") return `NokNok (${noknokDiscountPercent}%)`;
    if (discountType === "custom") return discountIsPercent ? `Custom (${discountValInput}%)` : "Custom Discount";
    return "Discount";
  })();

  // Send print job to local print server (Form POST bypasses HTTPS Mixed Content blocking)
  const handlePrint = async (orderData) => {
    const ip = printServerIP || "192.168.18.195";
    const port = printServerPort || "9191";
    const url = `http://${ip}:${port}/print`;

    try {
      // 1. Try direct fetch first
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
        signal: AbortSignal.timeout(2000),
      });
      const result = await res.json();
      if (result && result.success) {
        console.log(`Direct HTTP Printed: ${(result.printed || []).join(" + ")}`);
        return;
      }
    } catch (err) {
      console.warn("Fetch blocked or timed out, submitting print job via form POST:", err.message);
    }

    // 2. Form POST submission to hidden iframe bypasses HTTPS Mixed Content restrictions on tablet
    try {
      let iframe = document.getElementById("print_iframe");
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "print_iframe";
        iframe.name = "print_iframe";
        iframe.style.display = "none";
        document.body.appendChild(iframe);
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = url;
      form.target = "print_iframe";

      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "payload";
      input.value = JSON.stringify(orderData);
      form.appendChild(input);

      document.body.appendChild(form);
      form.submit();
      setTimeout(() => {
        try { document.body.removeChild(form); } catch (e) {}
      }, 1000);
      console.log("Submitted print job via Form POST to local print server.");
    } catch (formErr) {
      console.error("Print form error:", formErr.message);
    }
  };

  // Validate Order Origin
  const validateOrder = () => {
    if (!selectedChannel && !editingOrderId) {
      setValidationError("⚠️ Order Origin is REQUIRED! Please select Toters, WhatsApp, NokNok, etc. at the top.");
      return false;
    }
    setValidationError("");
    return true;
  };

  // Hold Current Order
  const handleHoldOrder = async () => {
    if (ticketItems.length === 0) return;
    if (!validateOrder()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/pos/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType,
          orderSource: selectedChannel,
          paymentMethod: selectedPaymentMethod,
          customerName,
          customerPhone,
          deliveryAddress,
          status: "held",
          subtotal,
          deliveryFee: (parseFloat(deliveryFee) || 0),
          discountAmount,
          total,
          items: ticketItems.map((item) => ({
            product_id: item.product_id,
            quantity: item.qty,
            unit_price: item.unit_price,
            customizations: item.selectedCustomizations.map((c) => c.ingredient || c.name),
            comment: item.note
          }))
        })
      });
      const data = await res.json();
      if (data.success) {
        setTicketItems([]);
        setCustomerName("");
        setCustomerPhone("");
        setDeliveryAddress("");
        setSelectedChannel(null); // Reset origin
        setEditingOrderId(null);
        setDeliveryFee(0);
        setOrderType("delivery");
        fetchOrdersQueue();
      }
    } catch (err) {
      console.error("Error holding order:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Complete Order & Trigger Print (or Save Edited WhatsApp Order)
  const handleFinalizePayment = async () => {
    if (ticketItems.length === 0) return;
    // Default to In-Store if no channel selected instead of blocking
    if (!selectedChannel && !editingOrderId) setSelectedChannel("In-Store");
    if (!validateOrder()) return;

    setIsSubmitting(true);
    try {
      let data;
      if (editingOrderId) {
        // If editing an existing WhatsApp order, update status to approved & update items
        const updateRes = await fetch(`/api/pos/orders/${editingOrderId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "approved",
            subtotal,
            deliveryFee: (parseFloat(deliveryFee) || 0),
            discountAmount,
            total,
            customerName,
            customerPhone,
            deliveryAddress,
            orderType,
            orderSource: selectedChannel || "WhatsApp",
            items: ticketItems.map((item) => ({
              product_id: item.product_id,
              quantity: item.qty,
              unit_price: item.unit_price,
              customizations: item.selectedCustomizations.map((c) => c.ingredient || c.name),
              comment: item.note
            }))
          })
        });
        data = await updateRes.json();
        if (data.success) {
          data.orderId = editingOrderId;
        }
      } else {
        const actualPaymentMethod =
          selectedChannel === "Toters" ? "Toters" :
          selectedChannel === "NokNok" ? "NokNok" :
          selectedPaymentMethod;

        // Create brand new POS order
        const createRes = await fetch("/api/pos/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderType,
            orderSource: selectedChannel,
            paymentMethod: actualPaymentMethod,
            customerName,
            customerPhone,
            deliveryAddress,
            status: "completed",
            subtotal,
            deliveryFee: (parseFloat(deliveryFee) || 0),
            discountAmount,
            total,
            items: ticketItems.map((item) => ({
              product_id: item.product_id,
              quantity: item.qty,
              unit_price: item.unit_price,
              customizations: (item.selectedCustomizations || []).map((c) =>
                typeof c === "string" ? c : (c.ingredient || c.name || "")
              ).filter(Boolean),
              comment: item.note || ""
            }))
          })
        });
        data = await createRes.json();
      }

      if (data && data.success) {
        // Normalize items to same clean shape used by handleReprintOrder
        // so the print server always receives consistent data
        const normalizedItems = ticketItems.map((item) => ({
          qty: item.qty || item.quantity || 1,
          name: item.name || item.product_name || "Item",
          unit_price: item.unit_price || 0,
          selectedCustomizations: (item.selectedCustomizations || []).map((c) =>
            typeof c === "string" ? { name: c } : { name: c.ingredient || c.name || "" }
          ),
          note: item.note || ""
        }));

        const completedOrderData = {
          id: data.orderId || editingOrderId,
          order_source: selectedChannel,
          order_type: orderType,
          payment_method:
            selectedChannel === "Toters" ? "Toters" :
            selectedChannel === "NokNok" ? "NokNok" :
            selectedPaymentMethod,
          customer_name: customerName,
          customer_phone: customerPhone,
          delivery_address: deliveryAddress,
          subtotal_amount: subtotal,
          delivery_fee: (parseFloat(deliveryFee) || 0),
          discount_amount: discountAmount,
          discount_label: discountAmount > 0 ? discountLabel : null,
          total_amount: total,
          items: normalizedItems,
          created_at: new Date().toISOString()
        };
        // Fire print job (non-blocking — order saved regardless of print result)
        console.log("[POS] Firing print for order #" + completedOrderData.id, completedOrderData);
        handlePrint(completedOrderData);
        setLastCompletedOrder(completedOrderData);
        setTicketItems([]);
        setCustomerName("");
        setCustomerPhone("");
        setDeliveryAddress("");
        setSelectedChannel(null); // Reset origin
        setEditingOrderId(null);
        setDiscountType("none");
        setDiscountValInput(15);
        setDiscountIsPercent(true);
        setDeliveryFee(0);
        setOrderType("delivery");
        // Toters & NokNok handle their own delivery — skip driver modal, go straight back
        setActiveTabModal(["Toters", "NokNok"].includes(selectedChannel) ? null : "receipt");
        fetchOrdersQueue();
      } else if (data && data.error) {
        setValidationError(`⚠️ ${data.error}`);
      }
    } catch (err) {
      console.error("Error completing payment:", err);
      setValidationError(`⚠️ Error completing payment: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reject Incoming WhatsApp Order
  const handleRejectPendingOrder = async (orderId) => {
    try {
      const res = await fetch(`/api/pos/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled", voidReason: "Rejected by POS Operator" })
      });
      const data = await res.json();
      if (data.success) {
        fetchOrdersQueue();
      }
    } catch (err) {
      console.error("Error rejecting order:", err);
    }
  };

  // Send Silent WhatsApp Driver Request via Infobip Backend API (+961 3 826 136)
  const handleSendDeliveryWhatsApp = async (etaMinutes, mode = "silent") => {
    if (!lastCompletedOrder) return;
    const cleanPhone = "9613826136";
    const timeText = etaMinutes === "Now" ? "Now" : etaMinutes ? `${etaMinutes}'` : "15'";
    const msg = `🛵 Hello, need driver in ${timeText} for Order #${lastCompletedOrder.id}`;

    // Always copy message to clipboard as fallback
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try { navigator.clipboard.writeText(msg); } catch (e) {}
    }

    if (mode === "manual") {
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, "_blank");
      // Close modal after manual open
      setTimeout(() => setActiveTabModal(null), 800);
      return;
    }

    // Silent Background API Send (<0.3s) - 0 Tabs, 0 Popups!
    setDispatchStatusMsg(`Sending driver request (${timeText})... ⏳`);
    try {
      const res = await fetch("/api/pos/dispatch-driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: lastCompletedOrder.id,
          etaMinutes: etaMinutes || "15",
          phone: cleanPhone
        })
      });
      const data = await res.json();
      setDispatchStatusMsg(`Driver Requested in ${timeText}! ✓`);
    } catch (err) {
      setDispatchStatusMsg(`Request Sent (${timeText}) ✓`);
    }
    // Auto-close after 1.2s so staff sees the confirmation tick
    setTimeout(() => {
      setDispatchStatusMsg("");
      setActiveTabModal(null);
    }, 1200);
  };

  // Fetch Order History for POS
  const fetchOrderHistory = async () => {
    try {
      const res = await fetch("/api/pos/orders?type=all");
      const data = await res.json();
      if (data.orders) {
        setCompletedOrdersHistory(data.orders);
      }
    } catch (err) {
      console.error("Error fetching order history:", err);
    }
  };

  // Reprint Receipt for Past Order
  const handleReprintOrder = (order) => {
    const orderData = {
      id: order.id,
      order_source: order.order_source || "POS",
      order_type: order.order_type || "pickup",
      payment_method: order.payment_method || "Cash",
      customer_name: order.customer_name || "",
      customer_phone: order.customer_phone || "",
      delivery_address: order.delivery_address || "",
      subtotal_amount: order.subtotal_amount || 0,
      delivery_fee: order.delivery_fee || 0,
      discount_amount: order.discount_amount || 0,
      total_amount: order.total_amount || 0,
      items: (order.items || []).map((i) => ({
        qty: i.quantity || i.qty || 1,
        name: i.product_name || i.name || "Item",
        unit_price: i.unit_price || 0,
        selectedCustomizations: i.customizations ? [{ name: i.customizations }] : [],
        note: i.comment || ""
      })),
      created_at: order.created_at || new Date().toISOString()
    };

    handlePrint(orderData);
    setLastCompletedOrder(orderData);
    setReprintSuccessMsg(`Order #${order.id} sent to thermal printer! 🖨️`);
    setTimeout(() => setReprintSuccessMsg(""), 4000);
  };
  const handleApprovePendingOrder = async (order) => {
    try {
      const res = await fetch(`/api/pos/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" })
      });
      const data = await res.json();
      if (data.success) {
        // Build print data from the order (same format as handleReprintOrder)
        const printData = {
          id: order.id,
          order_source: order.order_source || "WhatsApp",
          order_type: order.order_type || "delivery",
          payment_method: order.payment_method || "Cash",
          customer_name: order.customer_name || "",
          customer_phone: order.customer_phone || "",
          delivery_address: order.delivery_address || "",
          subtotal_amount: order.subtotal_amount || 0,
          delivery_fee: order.delivery_fee || 0,
          discount_amount: order.discount_amount || 0,
          total_amount: order.total_amount || 0,
          items: (order.items || []).map((i) => ({
            qty: i.quantity || i.qty || 1,
            name: i.product_name || i.name || "Item",
            unit_price: i.unit_price || 0,
            selectedCustomizations: i.customizations ? [{ name: i.customizations }] : [],
            note: i.comment || ""
          })),
          created_at: order.created_at || new Date().toISOString()
        };
        // Fire print job before opening receipt modal
        handlePrint(printData);
        setLastCompletedOrder(order);
        setActiveTabModal("receipt");
        fetchOrdersQueue();
      }
    } catch (err) {
      console.error("Error approving order:", err);
    }
  };

  // Edit & Approve Incoming WhatsApp Order (Load into POS active ticket)
  const handleEditAndApproveOrder = (order) => {
    setEditingOrderId(order.id);
    setSelectedChannel(order.order_source || "WhatsApp");
    setOrderType(order.order_type || "delivery");
    setCustomerName(order.customer_name || "");
    setCustomerPhone(order.customer_phone || "");
    setDeliveryAddress(order.delivery_address || "");
    const initialFee = order.delivery_fee !== undefined && order.delivery_fee !== null
      ? parseFloat(order.delivery_fee)
      : 0;
    setDeliveryFee(initialFee);

    const mappedItems = (order.items || []).map((i) => ({
      product_id: i.product_id,
      name: i.product_name || `Product #${i.product_id}`,
      unit_price: i.unit_price,
      qty: i.quantity,
      selectedCustomizations: i.customizations ? [{ name: i.customizations }] : [],
      note: i.comment || ""
    }));

    setTicketItems(mappedItems);
    setActiveTabModal(null); // Close modal so user can edit items on the POS grid & ticket
  };

  // Resume Held Order
  const handleResumeHeldOrder = (order) => {
    setEditingOrderId(null);
    setSelectedChannel(order.order_source || "Toters");
    setOrderType(order.order_type || "delivery");
    setCustomerName(order.customer_name || "");
    setCustomerPhone(order.customer_phone || "");
    setDeliveryAddress(order.delivery_address || "");

    const items = (order.items || []).map((i) => ({
      product_id: i.product_id,
      name: i.product_name || `Product #${i.product_id}`,
      unit_price: i.unit_price,
      qty: i.quantity,
      selectedCustomizations: i.customizations ? [{ name: i.customizations }] : [],
      note: i.comment || ""
    }));

    setTicketItems(items);
    setActiveTabModal(null);
  };

  // Print Thermal Ticket
  const handlePrintThermalTicket = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121417] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#eb660c] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 font-medium">Loading OVR LOAD Tablet POS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen max-h-screen bg-[#0F1115] text-[#E0E6ED] font-sans overflow-hidden flex flex-col select-none">
      {/* Printable Thermal Receipt Container */}
      {lastCompletedOrder && (
        <div className="hidden print:block print:w-[80mm] print:text-black print:p-2 text-xs font-mono">
          <div className="text-center font-bold text-sm mb-1">*** OVR LOAD KITCHEN TICKET ***</div>
          <div className="text-center mb-2">Order #{lastCompletedOrder.id} • {lastCompletedOrder.order_source}</div>
          <hr className="border-black mb-2" />
          <div>Type: {lastCompletedOrder.order_type?.toUpperCase()}</div>
          <div>Payment: {lastCompletedOrder.payment_method}</div>
          <div className="font-extrabold text-sm my-1">
            CLIENT: {lastCompletedOrder.customer_name || (lastCompletedOrder.order_source === "In-Store" ? "Walk-in Guest" : "N/A")}
          </div>
          {lastCompletedOrder.customer_phone && <div>Phone: {lastCompletedOrder.customer_phone}</div>}
          {lastCompletedOrder.delivery_address && <div>Addr: {lastCompletedOrder.delivery_address}</div>}
          <hr className="border-black my-2" />
          <div className="space-y-1">
            {(lastCompletedOrder.items || []).map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between font-bold">
                  <span>{item.qty || item.quantity}x {item.name || item.product_name}</span>
                  <span>${((item.unit_price || 0) * (item.qty || item.quantity || 1)).toFixed(2)}</span>
                </div>
                {item.selectedCustomizations?.length > 0 && (
                  <div className="pl-3 text-[10px] text-gray-700">
                    {item.selectedCustomizations.map((c) => c.name || c.ingredient).join(", ")}
                  </div>
                )}
                {item.note && (
                  <div className="pl-3 text-[10px] text-black font-bold">
                    NOTE: {item.note}
                  </div>
                )}
              </div>
            ))}
          </div>
          <hr className="border-black my-2" />
          <div className="flex justify-between font-bold text-sm">
            <span>TOTAL:</span>
            <span>${(lastCompletedOrder.total_amount || lastCompletedOrder.total || 0).toFixed(2)}</span>
          </div>
          <div className="text-center mt-3 text-[10px]">Thank you for ordering with OVR LOAD!</div>
        </div>
      )}

      {/* TOP TABLET HEADER */}
      <header className="h-16 bg-[#181C24] border-b border-[#262D3D] px-6 flex items-center justify-between shadow-md print:hidden flex-shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#eb660c] flex items-center justify-center font-black text-white text-base">
              O
            </span>
            <span className="font-extrabold text-xl tracking-wider text-white">
              OVR<span className="text-[#eb660c]">LOAD</span> <span className="text-xs px-2 py-0.5 rounded bg-[#eb660c]/20 text-[#eb660c] font-semibold">POS TABLET v2.5.4</span>
            </span>
          </div>
        </div>

        {/* Active Origin Display & Switch Button */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400">Order Origin:</span>
          {selectedChannel ? (
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md ${
                selectedChannel === "Toters" ? "bg-[#00C49F] text-black" :
                selectedChannel === "WhatsApp" ? "bg-[#25D366] text-black" :
                selectedChannel === "NokNok" ? "bg-[#FF5A5F] text-white" :
                selectedChannel === "App" ? "bg-[#3B82F6] text-white" :
                "bg-[#E5C07B] text-black"
              }`}>
                {selectedChannel}
              </span>
              <button
                type="button"
                onClick={() => setSelectedChannel(null)}
                className="text-[11px] font-bold text-gray-400 hover:text-white underline px-2 py-1"
              >
                Switch Channel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSelectedChannel(null)}
              className="px-3.5 py-1.5 bg-[#eb660c] hover:bg-[#d55909] text-white rounded-xl text-xs font-extrabold shadow-md animate-pulse"
            >
              Select Origin ➔
            </button>
          )}
        </div>

        {/* Queues & Quick Actions */}
        <div className="flex items-center gap-3">
          {/* Pending WhatsApp Orders Queue Button */}
          <button
            onClick={() => setActiveTabModal("incoming")}
            className="relative px-3.5 py-2 bg-[#262D3D] hover:bg-[#323B4E] rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2 border border-[#3A455C]"
          >
            <span>📱 WhatsApp Orders</span>
            {pendingOrders.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#eb660c] text-white text-[11px] font-black flex items-center justify-center animate-pulse">
                {pendingOrders.length}
              </span>
            )}
          </button>

          {/* Held Orders Queue Button */}
          <button
            onClick={() => setActiveTabModal("held")}
            className="px-3.5 py-2 bg-[#262D3D] hover:bg-[#323B4E] rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2 border border-[#3A455C]"
          >
            <span>⏸️ Held ({heldOrders.length})</span>
          </button>

          {/* Order History Button */}
          <button
            onClick={() => {
              fetchOrderHistory();
              setActiveTabModal("history");
            }}
            className="px-3.5 py-2 bg-[#262D3D] hover:bg-[#323B4E] rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2 border border-[#3A455C]"
          >
            <span>📜 Order History</span>
          </button>
        </div>
      </header>

      {/* Validation Error Banner */}
      {validationError && (
        <div className="bg-red-600 text-white text-xs font-bold px-6 py-2 flex items-center justify-between shadow-md print:hidden flex-shrink-0">
          <span>{validationError}</span>
          <button onClick={() => setValidationError("")} className="font-extrabold px-2">✕</button>
        </div>
      )}

      {/* Editing WhatsApp Banner */}
      {editingOrderId && (
        <div className="bg-[#eb660c] text-white text-xs font-extrabold px-6 py-2 flex items-center justify-between shadow-md print:hidden flex-shrink-0">
          <span>✏️ Editing WhatsApp Order #{editingOrderId} — Make adjustments then tap "Approve & Print"</span>
          <button
            onClick={() => {
              setEditingOrderId(null);
              setTicketItems([]);
              setSelectedChannel(null);
            }}
            className="underline text-xs text-white hover:text-gray-200"
          >
            Cancel Editing
          </button>
        </div>
      )}

      {/* DUAL-PANE TABLET MAIN AREA */}
      <div className="flex-1 min-h-0 flex overflow-hidden print:hidden">
        {/* LEFT PANE: PRODUCTS & CATEGORIES (65% width) */}
        <div className="w-[65%] h-full flex flex-col bg-[#12151C] border-r border-[#262D3D] min-h-0 overflow-hidden">
          {/* Category Tabs (No search bar) */}
          <div className="p-4 bg-[#181C24] border-b border-[#262D3D] flex items-center gap-2 overflow-x-auto no-scrollbar flex-shrink-0">
            <button
              onClick={() => setSelectedCategory("All")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === "All"
                  ? "bg-[#eb660c] text-white shadow-md"
                  : "bg-[#0F1115] text-gray-400 hover:text-white border border-[#262D3D]"
              }`}
            >
              All Items
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat.name
                    ? "bg-[#eb660c] text-white shadow-md"
                    : "bg-[#0F1115] text-gray-400 hover:text-white border border-[#262D3D]"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Product Grid (Compact, Fixed Card Height, Price between Options & Add) */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 grid grid-cols-3 gap-3 align-content-start">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => handleOpenCustomization(product)}
                className="h-[115px] bg-[#181C24] hover:bg-[#202632] border border-[#262D3D] hover:border-[#eb660c] rounded-xl p-3 flex flex-col justify-between cursor-pointer transition-all active:scale-95 shadow-sm group select-none"
              >
                <div>
                  <h3 className="font-extrabold text-sm text-white group-hover:text-[#eb660c] transition-colors line-clamp-2 leading-snug">
                    {product.name}
                  </h3>
                </div>

                <div className="flex items-center justify-between border-t border-[#262D3D] pt-2">
                  <span className="text-[11px] text-gray-400 font-medium truncate max-w-[33%]">
                    {product.customizations?.length > 0
                      ? `${product.customizations.length} opts`
                      : "Standard"}
                  </span>
                  <span className="text-sm font-black text-white px-1">
                    ${(product.unit_price_usd || 0).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenCustomization(product);
                    }}
                    className="px-2.5 py-1 bg-[#eb660c] group-hover:bg-[#d55909] text-white rounded-lg text-xs font-bold shadow cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANE: ACTIVE TICKET CART & CHECKOUT (35% width - Independent 100% Height) */}
        <div className="w-[35%] h-full flex flex-col bg-[#181C24] border-l border-[#262D3D] min-h-0 overflow-hidden relative">
          {/* Order Header / Customer Info (Fixed Top - Z-30 for dropdown overflow) */}
          <div className="p-3 border-b border-[#262D3D] bg-[#14171F] flex-shrink-0 relative z-30">

            {/* Order Type Buttons (Default Delivery) */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => {
                  setOrderType("delivery");
                }}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  orderType === "delivery"
                    ? "bg-[#eb660c] text-white border-[#eb660c]"
                    : "bg-[#0F1115] text-gray-400 border-[#262D3D] hover:text-white"
                }`}
              >
                🚚 Delivery
              </button>
              <button
                onClick={() => {
                  setOrderType("pickup");
                  setDeliveryFee(0);
                }}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  orderType === "pickup"
                    ? "bg-[#eb660c] text-white border-[#eb660c]"
                    : "bg-[#0F1115] text-gray-400 border-[#262D3D] hover:text-white"
                }`}
              >
                🛍️ Pickup
              </button>
            </div>

            {/* Customer Inputs with Autocomplete */}
            <div className="space-y-2 relative">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    handleCustomerSearch(e.target.value);
                  }}
                  onFocus={() => {
                    if (customerName.length >= 2) handleCustomerSearch(customerName);
                  }}
                  placeholder="Customer Name 🔍"
                  className="px-3 py-1.5 bg-[#0F1115] border border-[#262D3D] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#eb660c]"
                />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    handleCustomerSearch(e.target.value);
                  }}
                  onFocus={() => {
                    if (customerPhone.length >= 2) handleCustomerSearch(customerPhone);
                  }}
                  placeholder="Phone Number 🔍"
                  className="px-3 py-1.5 bg-[#0F1115] border border-[#262D3D] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#eb660c]"
                />
              </div>

              {orderType === "delivery" && (
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Delivery Address & Landmarks"
                  className="w-full px-3 py-1.5 bg-[#0F1115] border border-[#262D3D] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#eb660c]"
                />
              )}

              {/* Autocomplete Dropdown Menu */}
              {showCustomerDropdown && customerSearchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-[#181C24] border border-[#eb660c]/60 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-[#262D3D]">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-[#eb660c] bg-[#eb660c]/10 flex justify-between items-center sticky top-0 bg-[#181C24] z-10 border-b border-[#262D3D]">
                    <span>Found Customers (Tap to select)</span>
                    <button
                      type="button"
                      onClick={() => setShowCustomerDropdown(false)}
                      className="text-gray-400 hover:text-white font-bold"
                    >
                      ✕
                    </button>
                  </div>
                  {customerSearchResults.map((c, i) => (
                    <div
                      key={i}
                      onClick={() => handleSelectCustomer(c)}
                      className="p-2.5 hover:bg-[#202632] cursor-pointer transition-colors text-xs flex flex-col gap-0.5"
                    >
                      <div className="flex justify-between items-center font-extrabold text-white">
                        <span>👤 {c.customer_name || "Customer"}</span>
                        <span className="text-[#eb660c] font-mono text-[11px]">{c.customer_phone || ""}</span>
                      </div>
                      {c.delivery_address && (
                        <span className="text-[10px] text-gray-400 truncate max-w-full">
                          📍 {c.delivery_address}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ticket Items List (Scrollable Middle Section) */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {ticketItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2 py-12">
                <svg className="w-12 h-12 stroke-current" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <p className="text-xs font-semibold">Ticket is empty</p>
                <p className="text-[10px] text-gray-600">Select items from the left grid to add</p>
              </div>
            ) : (
              ticketItems.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-3 flex flex-col gap-2 relative group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-white">{item.name}</h4>
                      <div className="text-xs text-gray-400">
                        ${item.unit_price.toFixed(2)} each
                      </div>
                    </div>
                    <span className="font-black text-sm text-white">
                      ${(item.unit_price * item.qty).toFixed(2)}
                    </span>
                  </div>

                  {/* Options & Notes */}
                  {item.selectedCustomizations?.length > 0 && (
                    <div className="text-[11px] text-[#eb660c] font-medium bg-[#eb660c]/10 px-2 py-1 rounded">
                      {item.selectedCustomizations.map((c) => c.ingredient || c.name).join(", ")}
                    </div>
                  )}

                  {item.note && (
                    <div className="text-[11px] text-amber-400 bg-amber-400/10 px-2 py-1 rounded flex items-center gap-1 font-medium">
                      <span>✏️</span> {item.note}
                    </div>
                  )}

                  {/* Controls Bar */}
                  <div className="flex items-center justify-between border-t border-[#262D3D] pt-2 mt-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateQty(idx, -1)}
                        className="w-7 h-7 rounded-lg bg-[#262D3D] hover:bg-[#323B4E] text-white font-bold text-sm flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="font-extrabold text-sm text-white px-1">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => handleUpdateQty(idx, 1)}
                        className="w-7 h-7 rounded-lg bg-[#262D3D] hover:bg-[#323B4E] text-white font-bold text-sm flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const prod = products.find((p) => p.id === item.product_id);
                          if (prod) handleOpenCustomization(prod, idx);
                        }}
                        className="text-[11px] font-bold text-gray-400 hover:text-white px-2 py-1 bg-[#181C24] border border-[#262D3D] rounded-md"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handlePromptVoid(idx)}
                        className="text-[11px] font-bold text-red-400 hover:text-red-300 px-2 py-1 bg-red-500/10 rounded-md"
                      >
                        Void
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Ticket Footer / Summary (Fixed Bottom - Side-by-Side Amounts & Actions) */}
          <div className="p-3 border-t border-[#262D3D] bg-[#14171F] flex-shrink-0 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              {/* LEFT SIDE: Amounts Breakdown */}
              <div className="flex-1 space-y-1 text-xs text-gray-400">
                <div className="flex justify-between gap-2">
                  <span>Subtotal</span>
                  <span className="text-white font-bold">${subtotal.toFixed(2)}</span>
                </div>
                {/* Interactive Editable Discount Row (Default 15%, Editable by Cashier) */}
                <div className="flex justify-between items-center gap-2 text-[#eb660c] font-extrabold text-xs">
                  <div className="flex items-center gap-1.5">
                    <span>Discount</span>
                    <div className="flex items-center bg-[#0F1115] border border-[#262D3D] focus-within:border-[#eb660c] rounded px-1.5 py-0.5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={
                          discountType === "toters" ? totersDiscountPercent :
                          discountType === "noknok" ? noknokDiscountPercent :
                          discountValInput
                        }
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setDiscountValInput(val);
                          setDiscountType("custom");
                          setDiscountIsPercent(true);
                        }}
                        className="w-10 bg-transparent text-right text-xs font-black text-[#eb660c] outline-none"
                      />
                      <span className="text-[10px] text-[#eb660c] font-extrabold ml-0.5">%</span>
                    </div>
                  </div>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>

                {/* Interactive Editable Delivery Fee Row (Listed directly under Discount, editable by cashier) */}
                <div className="flex justify-between items-center gap-2 text-xs font-bold text-gray-300">
                  <div className="flex items-center gap-1.5">
                    <span>🛵 Delivery</span>
                    <div className="flex items-center bg-[#0F1115] border border-[#262D3D] focus-within:border-[#eb660c] rounded px-1.5 py-0.5">
                      <span className="text-[10px] text-[#25D366] font-extrabold mr-0.5">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={deliveryFee}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setDeliveryFee(val);
                        }}
                        className="w-12 bg-transparent text-right text-xs font-black text-[#25D366] outline-none"
                      />
                    </div>
                  </div>
                  <span className="text-[#25D366] font-extrabold">+${deliveryFee.toFixed(2)}</span>
                </div>
                {(!["Toters", "NokNok"].includes(selectedChannel)) && (
                  <div className="flex justify-between items-center gap-2 text-xs text-gray-400">
                    <span>Payment</span>
                    <div className="flex bg-[#0F1115] p-0.5 rounded border border-[#262D3D]">
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentMethod("Cash")}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${
                          selectedPaymentMethod === "Cash" ? "bg-[#eb660c] text-white shadow" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        💵 Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentMethod("Whish")}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${
                          selectedPaymentMethod === "Whish" ? "bg-purple-600 text-white shadow" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        🟣 Whish
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex justify-between gap-2 pt-1 border-t border-[#262D3D] text-sm font-black text-white">
                  <span>Total</span>
                  <span className="text-[#eb660c] text-base">${total.toFixed(2)}</span>
                </div>
              </div>

              {/* RIGHT SIDE: Action Buttons */}
              <div className="flex flex-col gap-2 min-w-[140px]">
                <button
                  onClick={handleHoldOrder}
                  disabled={ticketItems.length === 0 || isSubmitting}
                  className="py-2 px-3 bg-[#262D3D] hover:bg-[#323B4E] disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all whitespace-nowrap"
                >
                  ⏸️ Hold Ticket
                </button>
                <button
                  onClick={() => {
                    if (!validateOrder()) return;
                    // For Toters, NokNok, or Editing existing orders, bypass modal and finalize directly
                    if (selectedChannel === "Toters" || selectedChannel === "NokNok" || editingOrderId) {
                      handleFinalizePayment();
                    } else {
                      setActiveTabModal("payment");
                    }
                  }}
                  disabled={ticketItems.length === 0 || isSubmitting}
                  className="py-2.5 px-3 bg-[#eb660c] hover:bg-[#d55909] disabled:opacity-50 text-white rounded-xl font-extrabold text-xs transition-all shadow-md whitespace-nowrap"
                >
                  {isSubmitting ? "Processing..." : (editingOrderId ? "✅ Approve & Print" : "💳 Pay & Print")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CUSTOMIZATION & NOTES MODAL */}
      {activeTabModal === "customization" && currentProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-[600px] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#262D3D] flex justify-between items-center bg-[#14171F]">
              <div>
                <h3 className="font-extrabold text-lg text-white">{currentProduct.name}</h3>
                <span className="text-xs text-[#eb660c] font-bold">${(currentProduct.unit_price_usd || 0).toFixed(2)} base</span>
              </div>
              <button
                onClick={() => setActiveTabModal(null)}
                className="w-8 h-8 rounded-lg bg-[#262D3D] text-gray-400 hover:text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Options Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {customizationError && (
                <div className="bg-red-600/90 text-white text-xs font-bold px-3 py-2 rounded-xl flex justify-between items-center animate-bounce">
                  <span>{customizationError}</span>
                  <button onClick={() => setCustomizationError("")} className="font-extrabold px-1">✕</button>
                </div>
              )}

              {currentProduct.customizations?.length > 0 ? (
                Object.entries(
                  currentProduct.customizations.reduce((acc, c) => {
                    const group = c.option_group_name || (c.customization_type === "remove" ? "Remove Ingredients" : "Custom Options");
                    if (!acc[group]) acc[group] = [];
                    acc[group].push(c);
                    return acc;
                  }, {})
                ).map(([groupName, options]) => {
                  const isMultiSelect = options[0]?.is_multi_select || groupName === "Remove Ingredients";
                  const isReq = options[0]?.is_required || groupName.toLowerCase().includes("drink");
                  return (
                    <div key={groupName} className={`bg-[#0F1115] border rounded-xl p-3.5 space-y-2 ${
                      isReq ? "border-[#eb660c]/50" : "border-[#262D3D]"
                    }`}>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                          {groupName} {isMultiSelect ? "(Multi-select)" : "(Single choice)"}
                        </h4>
                        {isReq && (
                          <span className="text-[10px] font-extrabold text-[#eb660c] bg-[#eb660c]/10 px-2 py-0.5 rounded">
                            REQUIRED *
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {options.map((opt) => {
                          const isSelected = selectedCustomizations.some((c) => c.id === opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleToggleOption(opt, isMultiSelect)}
                              className={`p-2.5 rounded-lg border text-left text-xs font-bold flex justify-between items-center transition-all ${
                                isSelected
                                  ? "bg-[#eb660c]/20 border-[#eb660c] text-white"
                                  : "bg-[#181C24] border-[#262D3D] text-gray-400 hover:text-white"
                              }`}
                            >
                              <span>{opt.customization_type === "remove" ? `No ${opt.ingredient}` : opt.ingredient}</span>
                              {opt.price > 0 && <span className="text-[#eb660c]">+${opt.price.toFixed(2)}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-gray-500 italic">No predefined customization options for this item.</p>
              )}

              {/* Free-text Item Notes */}
              <div className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-3.5 space-y-2">
                <label className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                  Item Kitchen Notes
                </label>
                <textarea
                  value={itemNote}
                  onChange={(e) => setItemNote(e.target.value)}
                  placeholder="Type special requests here..."
                  rows={2}
                  className="w-full px-3 py-2 bg-[#181C24] border border-[#262D3D] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#eb660c]"
                />
              </div>

              {/* Quantity Selector */}
              <div className="flex items-center justify-between bg-[#0F1115] p-3 rounded-xl border border-[#262D3D]">
                <span className="text-xs font-bold text-white">Item Quantity</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCustomizationQty(Math.max(1, customizationQty - 1))}
                    className="w-8 h-8 rounded-lg bg-[#262D3D] text-white font-bold flex items-center justify-center text-base"
                  >
                    -
                  </button>
                  <span className="font-black text-base text-white">{customizationQty}</span>
                  <button
                    onClick={() => setCustomizationQty(customizationQty + 1)}
                    className="w-8 h-8 rounded-lg bg-[#262D3D] text-white font-bold flex items-center justify-center text-base"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#262D3D] bg-[#14171F] flex justify-end gap-2">
              <button
                onClick={() => setActiveTabModal(null)}
                className="px-4 py-2.5 bg-[#262D3D] text-white rounded-xl text-xs font-bold hover:bg-[#323B4E]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomizationToCart}
                className="px-6 py-2.5 bg-[#eb660c] hover:bg-[#d55909] text-white rounded-xl text-xs font-extrabold shadow-md"
              >
                Save Item to Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANDATORY SELECT ORDER ORIGIN MODAL (FIRST STEP FOR NEW TICKET) */}
      {(!selectedChannel && !editingOrderId && activeTabModal === null) && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 print:hidden animate-fade-in select-none">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl text-center">
            
            {/* Header */}
            <div className="space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-[#eb660c]/20 text-[#eb660c] border border-[#eb660c]/40 flex items-center justify-center text-2xl mx-auto shadow-inner">
                🛵
              </div>
              <h2 className="text-2xl font-black text-white tracking-wide">Select Order Origin</h2>
              <p className="text-xs text-gray-400 font-medium">
                Step 1 of 2: Choose the sales channel for this order to unlock the POS catalog.
              </p>
            </div>

            {/* Channels Big Touch Buttons Grid */}
            <div className="grid grid-cols-1 gap-3">
              {[
                { name: "Toters", icon: "🟢", desc: `Toters Delivery (${totersDiscountPercent}% Auto-Discount • Auto-Paid)`, color: "bg-[#00C49F] hover:bg-[#00b391] text-black border-[#00C49F]" },
                { name: "WhatsApp", icon: "💬", desc: "WhatsApp Order Direct", color: "bg-[#25D366] hover:bg-[#20bd5a] text-black border-[#25D366]" },
                { name: "NokNok", icon: "🔴", desc: `NokNok Express (${noknokDiscountPercent}% Auto-Discount • Auto-Paid)`, color: "bg-[#FF5A5F] hover:bg-[#e04f53] text-white border-[#FF5A5F]" },
                { name: "App", icon: "📱", desc: "Mobile Application Order", color: "bg-[#3B82F6] hover:bg-[#2563eb] text-white border-[#3B82F6]" },
                { name: "In-Store", icon: "🏪", desc: "Dine-In / Takeaway Cash POS", color: "bg-[#E5C07B] hover:bg-[#d4b06a] text-black border-[#E5C07B]" }
              ].map((ch) => (
                <button
                  key={ch.name}
                  onClick={() => {
                    setSelectedChannel(ch.name);
                    setValidationError("");
                    if (ch.name === "Toters") {
                      setDiscountType("toters");
                      setSelectedPaymentMethod("Toters");
                    } else if (ch.name === "NokNok") {
                      setDiscountType("noknok");
                      setSelectedPaymentMethod("NokNok");
                    } else {
                      // WhatsApp, App, and In-Store default to 15% discount (editable by cashier)
                      setDiscountType("custom");
                      setDiscountIsPercent(true);
                      setDiscountValInput(15);
                      setSelectedPaymentMethod("Cash");
                    }
                  }}
                  className={`p-4 rounded-2xl border font-black text-sm flex items-center justify-between transition-all active:scale-98 shadow-md group ${ch.color}`}
                >
                  <div className="flex items-center gap-3 text-left">
                    <span className="text-2xl">{ch.icon}</span>
                    <div>
                      <div className="font-black text-base">{ch.name}</div>
                      <div className="text-[11px] opacity-80 font-semibold">{ch.desc}</div>
                    </div>
                  </div>
                  <span className="text-xl opacity-60 group-hover:translate-x-1 transition-transform">➔</span>
                </button>
              ))}
            </div>

            <div className="pt-2 text-[11px] text-gray-500 font-semibold">
              OVR LOAD POS • Select Origin to Begin
            </div>

          </div>
        </div>
      )}

      {/* PAYMENT METHOD SELECTION MODAL (CASH vs WHISH) */}
      {activeTabModal === "payment" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-[450px] p-5 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#262D3D] pb-3">
              <h3 className="font-extrabold text-lg text-white">Select Payment Method</h3>
              <button
                type="button"
                onClick={() => setActiveTabModal(null)}
                className="text-gray-400 hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="text-center py-3 bg-[#0F1115] rounded-xl border border-[#262D3D]">
              <span className="text-xs text-gray-400 block font-semibold mb-1">Total Due Amount</span>
              <span className="text-3xl font-black text-[#eb660c]">${total.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { name: "Cash", icon: "💵" },
                { name: "Whish", icon: "🟣" }
              ].map((method) => (
                <button
                  key={method.name}
                  type="button"
                  onClick={() => setSelectedPaymentMethod(method.name)}
                  className={`p-4 rounded-xl border font-black text-sm flex items-center justify-center gap-2.5 transition-all ${
                    selectedPaymentMethod === method.name
                      ? "bg-[#eb660c] border-[#eb660c] text-white shadow-lg scale-105 ring-2 ring-white/20"
                      : "bg-[#0F1115] border-[#262D3D] text-gray-400 hover:text-white hover:border-gray-500"
                  }`}
                >
                  <span className="text-2xl">{method.icon}</span>
                  <span className="text-base">{method.name}</span>
                </button>
              ))}
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-[#262D3D]">
              <button
                type="button"
                onClick={() => setActiveTabModal(null)}
                className="px-4 py-2.5 bg-[#262D3D] text-white rounded-xl text-xs font-bold hover:bg-[#323B4E]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTabModal(null);
                  handleFinalizePayment();
                }}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-[#eb660c] hover:bg-[#d55909] disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-md"
              >
                {isSubmitting ? "Processing..." : `Confirm ${selectedPaymentMethod} & Print`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOID ITEM DIALOG */}
      {activeTabModal === "void_item" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-[400px] p-5 space-y-4 shadow-2xl">
            <h3 className="font-extrabold text-base text-red-400">Void Item Reason</h3>
            <p className="text-xs text-gray-400">
              Please enter the reason for removing this item from the active ticket:
            </p>
            <input
              type="text"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g. Out of stock / Customer changed mind"
              className="w-full px-3 py-2 bg-[#0F1115] border border-[#262D3D] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-400"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActiveTabModal(null)}
                className="px-4 py-2 bg-[#262D3D] text-white rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVoidItem}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-extrabold"
              >
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INCOMING WHATSAPP ORDERS APPROVAL MODAL (Reject / Approve / Edit & Approve) */}
      {activeTabModal === "incoming" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-[750px] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#262D3D] flex justify-between items-center bg-[#14171F]">
              <h3 className="font-extrabold text-lg text-white">📱 Incoming WhatsApp Orders Verification</h3>
              <button onClick={() => setActiveTabModal(null)} className="text-gray-400 hover:text-white font-bold">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {pendingOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-xs">No pending WhatsApp orders to verify</div>
              ) : (
                pendingOrders.map((order) => (
                  <div key={order.id} className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-extrabold text-[#eb660c]">Order #{order.id}</span>
                        <div className="text-sm font-bold text-white">{order.customer_name || "WhatsApp Customer"} ({order.customer_phone || "No phone"})</div>
                        <div className="text-xs text-gray-400">{order.delivery_address || "Pickup at store"}</div>
                      </div>
                      <span className="text-lg font-black text-[#eb660c]">${(order.total_amount || 0).toFixed(2)}</span>
                    </div>

                    <div className="border-t border-[#262D3D] pt-2 space-y-1">
                      {(order.items || []).map((item, i) => (
                        <div key={i} className="text-xs text-gray-300 flex justify-between">
                          <span>{item.quantity}x {item.product_name} {item.customizations ? `(${item.customizations})` : ""}</span>
                          <span>${(item.total_price || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Action Bar: Reject, Approve, Edit & Approve */}
                    <div className="flex justify-end gap-2 pt-2 border-t border-[#262D3D]">
                      <button
                        onClick={() => handleRejectPendingOrder(order.id)}
                        className="px-3.5 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs font-bold rounded-xl border border-red-500/30"
                      >
                        ❌ Reject
                      </button>
                      <button
                        onClick={() => handleEditAndApproveOrder(order)}
                        className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 text-xs font-bold rounded-xl border border-amber-500/30"
                      >
                        ✏️ Edit & Approve
                      </button>
                      <button
                        onClick={() => handleApprovePendingOrder(order)}
                        className="px-4 py-2 bg-[#eb660c] hover:bg-[#d55909] text-white text-xs font-extrabold rounded-xl shadow-md"
                      >
                        ✅ Approve & Print
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* HELD ORDERS MODAL */}
      {activeTabModal === "held" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-[600px] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#262D3D] flex justify-between items-center bg-[#14171F]">
              <h3 className="font-extrabold text-lg text-white">⏸️ Held / Draft Orders</h3>
              <button onClick={() => setActiveTabModal(null)} className="text-gray-400 hover:text-white font-bold">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {heldOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-xs">No held orders right now</div>
              ) : (
                heldOrders.map((order) => (
                  <div key={order.id} className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-4 flex justify-between items-center">
                    <div>
                      <div className="text-xs font-bold text-[#eb660c]">Held Order #{order.id} • {order.order_source}</div>
                      <div className="text-sm font-bold text-white">${(order.total_amount || 0).toFixed(2)}</div>
                      <div className="text-[11px] text-gray-400">{(order.items || []).length} items</div>
                    </div>
                    <button
                      onClick={() => handleResumeHeldOrder(order)}
                      className="px-4 py-2 bg-[#eb660c] hover:bg-[#d55909] text-white text-xs font-bold rounded-xl"
                    >
                      ▶️ Resume Ticket
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT / PRINT SUCCESS MODAL */}
      {activeTabModal === "receipt" && lastCompletedOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-[450px] p-5 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 bg-[#eb660c]/20 text-[#eb660c] rounded-full flex items-center justify-center text-2xl mx-auto font-black">
              ✓
            </div>
            <h3 className="font-extrabold text-xl text-white">Order Approved & Saved!</h3>
            <p className="text-xs text-gray-400">
              Order #{lastCompletedOrder.id} has been recorded in the database.
            </p>

            <div className="bg-[#0F1115] p-3 rounded-xl border border-[#262D3D] text-left text-xs space-y-1">
              <div className="flex justify-between font-bold text-white">
                <span>Total Amount:</span>
                <span className="text-[#eb660c]">${(lastCompletedOrder.total_amount || lastCompletedOrder.total || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Payment Method:</span>
                <span className="text-white">{lastCompletedOrder.payment_method || "Cash"}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Channel:</span>
                <span className="text-white">{lastCompletedOrder.order_source || "POS"}</span>
              </div>
            </div>

            {/* Driver Request section for Delivery Orders */}
            {lastCompletedOrder.order_type === "delivery" && (
              <div className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-3.5 space-y-2.5 text-center">
                <div className="flex justify-between items-center text-xs font-bold text-gray-300">
                  <span className="flex items-center gap-1.5">🛵 Request Driver (+961 3 826 136)</span>
                  {dispatchStatusMsg ? (
                    <span className="text-[10px] bg-[#25D366]/20 text-[#25D366] px-2.5 py-0.5 rounded-full font-black animate-pulse">
                      {dispatchStatusMsg}
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#25D366] font-extrabold">⚡ 0-Tab Silent Dispatch</span>
                  )}
                </div>
                <div className="text-[11px] text-gray-400 font-medium text-left">
                  Tap arrival ETA time (Sends WhatsApp silently via Infobip in 0.2s):
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {["Now", "15", "20", "30", "45"].map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => handleSendDeliveryWhatsApp(time, "silent")}
                      className="py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-black font-black text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1"
                    >
                      <span>⚡</span>
                      <span>{time === "Now" ? "Now" : `${time}'`}</span>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => handleSendDeliveryWhatsApp("15", "manual")}
                    className="text-[11px] text-gray-400 hover:text-white underline font-semibold"
                  >
                    Open WhatsApp Web/App Manually ➔
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-center pt-2">
              <button
                onClick={() => setActiveTabModal(null)}
                className="px-6 py-2.5 bg-[#262D3D] text-white rounded-xl text-xs font-bold hover:bg-[#323B4E]"
              >
                ✕ Close & Return to POS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ORDER HISTORY & REPRINT MODAL */}
      {activeTabModal === "history" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-[#262D3D] flex justify-between items-center bg-[#14171F]">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">📜</span>
                <div>
                  <h3 className="font-extrabold text-lg text-white">POS Order History & Receipt Reprint</h3>
                  <p className="text-xs text-gray-400">View recent orders, customer details, and reprint thermal receipts</p>
                </div>
              </div>
              <button onClick={() => setActiveTabModal(null)} className="text-gray-400 hover:text-white font-bold text-xl p-1">
                ✕
              </button>
            </div>

            {/* Search & Feedback Banner */}
            <div className="p-4 border-b border-[#262D3D] bg-[#0F1115] space-y-2">
              {reprintSuccessMsg && (
                <div className="bg-[#25D366]/20 border border-[#25D366]/40 text-[#25D366] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between">
                  <span>{reprintSuccessMsg}</span>
                  <button onClick={() => setReprintSuccessMsg("")}>✕</button>
                </div>
              )}
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Search history by Order #, Customer Name, Phone, or Channel..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="w-full bg-[#181C24] border border-[#262D3D] rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#eb660c]"
                />
                {historySearchQuery && (
                  <button
                    onClick={() => setHistorySearchQuery("")}
                    className="absolute right-3 top-2.5 text-xs text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Orders List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {completedOrdersHistory.filter((o) => {
                if (!historySearchQuery.trim()) return true;
                const q = historySearchQuery.toLowerCase().trim();
                return (
                  String(o.id).includes(q) ||
                  (o.customer_name || "").toLowerCase().includes(q) ||
                  (o.customer_phone || "").toLowerCase().includes(q) ||
                  (o.order_source || "").toLowerCase().includes(q)
                );
              }).length === 0 ? (
                <div className="text-center py-16 text-gray-500 text-xs font-semibold">
                  No orders found matching your search query
                </div>
              ) : (
                completedOrdersHistory
                  .filter((o) => {
                    if (!historySearchQuery.trim()) return true;
                    const q = historySearchQuery.toLowerCase().trim();
                    return (
                      String(o.id).includes(q) ||
                      (o.customer_name || "").toLowerCase().includes(q) ||
                      (o.customer_phone || "").toLowerCase().includes(q) ||
                      (o.order_source || "").toLowerCase().includes(q)
                    );
                  })
                  .map((order) => (
                    <div key={order.id} className="bg-[#0F1115] border border-[#262D3D] rounded-2xl p-4 space-y-3 hover:border-[#3A455C] transition-all">
                      {/* Top Row: Order ID, Channel, Date & Total */}
                      <div className="flex justify-between items-start border-b border-[#262D3D]/50 pb-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-white text-base">Order #{order.id}</span>
                            <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold ${
                              order.order_source === "Toters" ? "bg-[#00C49F] text-black" :
                              order.order_source === "WhatsApp" ? "bg-[#25D366] text-black" :
                              order.order_source === "NokNok" ? "bg-[#FF5A5F] text-white" :
                              order.order_source === "App" ? "bg-[#3B82F6] text-white" :
                              "bg-[#E5C07B] text-black"
                            }`}>
                              {order.order_source || "In-Store"}
                            </span>
                            <span className="text-[10px] bg-[#262D3D] text-gray-300 px-2 py-0.5 rounded-md font-bold uppercase">
                              {order.order_type || "pickup"}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400 font-medium">
                            {order.created_at ? new Date(order.created_at).toLocaleString() : "Date N/A"} • Payment: <strong className="text-white">{order.payment_method || "Cash"}</strong>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xl font-black text-[#eb660c]">${(order.total_amount || 0).toFixed(2)}</div>
                          <button
                            type="button"
                            onClick={() => handleReprintOrder(order)}
                            className="mt-1 px-3 py-1.5 bg-[#eb660c] hover:bg-[#d55909] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                          >
                            🖨️ Reprint Receipt
                          </button>
                        </div>
                      </div>

                      {/* Customer Info (if available) */}
                      {(order.customer_name || order.customer_phone || order.delivery_address) && (
                        <div className="text-xs text-gray-300 bg-[#181C24] p-2.5 rounded-xl border border-[#262D3D] space-y-0.5">
                          {order.customer_name && <div>👤 <strong>Customer:</strong> {order.customer_name}</div>}
                          {order.customer_phone && <div>📞 <strong>Phone:</strong> {order.customer_phone}</div>}
                          {order.delivery_address && <div>🏠 <strong>Address:</strong> {order.delivery_address}</div>}
                        </div>
                      )}

                      {/* Items List */}
                      <div className="text-xs text-gray-400 space-y-1">
                        <div className="font-bold text-gray-300 text-[11px] uppercase">Items Summary:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(order.items || []).map((item, idx) => (
                            <span key={idx} className="bg-[#181C24] border border-[#262D3D] px-2.5 py-1 rounded-lg text-[11px] text-gray-200 font-medium">
                              <strong>{item.quantity || item.qty}x</strong> {item.product_name || item.name} (${((item.unit_price || 0) * (item.quantity || item.qty || 1)).toFixed(2)})
                            </span>
                          ))}
                        </div>
                      </div>

                    </div>
                  ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-[#262D3D] bg-[#14171F] flex justify-between items-center text-xs text-gray-400">
              <span>Showing past {completedOrdersHistory.length} orders</span>
              <button
                onClick={() => setActiveTabModal(null)}
                className="px-5 py-2 bg-[#262D3D] hover:bg-[#323B4E] text-white rounded-xl font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSTALL APP GUIDE MODAL */}
      {activeTabModal === "install_guide" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-full max-w-md p-6 space-y-5 text-white shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#262D3D] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">📥</span>
                <h3 className="font-extrabold text-lg">Install OVR LOAD POS App</h3>
              </div>
              <button
                onClick={() => setActiveTabModal(null)}
                className="text-gray-400 hover:text-white text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-gray-300">
              <div className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-3.5 space-y-2">
                <span className="font-extrabold text-[#eb660c] text-sm block">📱 Android Phone / Tablet (Chrome):</span>
                <ol className="list-decimal list-inside space-y-1.5 text-gray-300 leading-relaxed">
                  <li>Tap the <strong>3 dots menu (⋮)</strong> in the top right corner of Chrome.</li>
                  <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                  <li>Tap <strong>Install</strong> to add the App icon to your home screen!</li>
                </ol>
              </div>

              <div className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-3.5 space-y-2">
                <span className="font-extrabold text-amber-400 text-sm block">🍏 iPhone / iPad (Safari / Chrome):</span>
                <ol className="list-decimal list-inside space-y-1.5 text-gray-300 leading-relaxed">
                  <li>Tap the <strong>Share button</strong> (square icon with an arrow pointing up).</li>
                  <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
                  <li>Tap <strong>Add</strong> in the top right corner!</li>
                </ol>
              </div>
            </div>

            <button
              onClick={() => setActiveTabModal(null)}
              className="w-full py-3 bg-[#eb660c] hover:bg-[#d55909] text-white font-extrabold rounded-xl transition-all shadow-lg"
            >
              Got It!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
