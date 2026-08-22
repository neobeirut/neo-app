"use client";

import { useState, useEffect, useRef } from "react";

const FAVORITE_PRODUCT_NAMES = [
  "caesar loaded wrap",
  "crispy loaded wrap",
  "beef quesa",
  "fries",
  "pepsi",
  "diet pepsi",
  "chocolate load",
  "banoffee overload",
];

const partitionCustomizations = (customizations) => {
  const addons = [];
  const removals = [];

  if (!customizations) return { addons, removals };

  const itemsList = Array.isArray(customizations)
    ? customizations
    : typeof customizations === "string"
    ? customizations.split(",").map((s) => s.trim())
    : [customizations];

  itemsList.forEach((c) => {
    const obj = typeof c === "string" ? { name: c } : c;
    const nameStr = (obj.name || obj.ingredient || obj.customization_name || "").trim();
    if (!nameStr) return;

    const nameLower = nameStr.toLowerCase();
    const groupLower = (obj.option_group_name || "").toLowerCase();
    const typeLower = (obj.customization_type || obj.type || "").toLowerCase();

    const isRemoval =
      typeLower === "remove" ||
      groupLower.includes("remove") ||
      nameLower.startsWith("no ") ||
      nameLower.startsWith("no-") ||
      nameLower.startsWith("remove ") ||
      nameLower.startsWith("without ");

    let cleanName = nameStr;
    if (isRemoval) {
      cleanName = cleanName.replace(/^(no\s+|no-|remove\s+|without\s+)/i, "").trim();
    }

    if (isRemoval) {
      removals.push(cleanName || nameStr);
    } else {
      addons.push(nameStr);
    }
  });

  return { addons, removals };
};

// OVR LOAD Tablet POS System v2.6.0 - Auto WhatsApp Location Sync
export default function TabletPOSPage() {
  // Data States
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("⭐ Favorites");

  // Favorites persistence state (localStorage)
  const [favoriteProductIds, setFavoriteProductIds] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("pos_favorite_product_ids");
        return saved ? JSON.parse(saved) : [];
      } catch (e) {}
    }
    return [];
  });

  const toggleFavoriteProduct = (productId, e) => {
    if (e) e.stopPropagation();
    let updated;
    if (favoriteProductIds.includes(productId)) {
      updated = favoriteProductIds.filter((id) => id !== productId);
    } else {
      updated = [...favoriteProductIds, productId];
    }
    setFavoriteProductIds(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("pos_favorite_product_ids", JSON.stringify(updated));
      } catch (e) {}
    }
  };

  // Order States
  const [selectedChannel, setSelectedChannel] = useState(null); // Toters, WhatsApp, NokNok, App, In-Store
  const [orderType, setOrderType] = useState("delivery"); // pickup, delivery, dine_in
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);

  // Admin Configured Channel Discounts
  const [totersDiscountPercent, setTotersDiscountPercent] = useState(15);
  const [noknokDiscountPercent, setNoknokDiscountPercent] = useState(15);

  // Discount Selection State
  const [discountType, setDiscountType] = useState("none"); // "none", "5%", "10%", "15%", "wa15", "toters", "noknok", "custom"
  const [discountValInput, setDiscountValInput] = useState(10);
  const [discountIsPercent, setDiscountIsPercent] = useState(true);
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  // Print Server Settings
  const [printServerIP, setPrintServerIP] = useState("");
  const [printServerPort, setPrintServerPort] = useState(9191);

  const [ticketItems, setTicketItems] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState(null);

  // Queue & Modal States
  const [heldOrders, setHeldOrders] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [rejectingOrderId, setRejectingOrderId] = useState(null);
  const [confirmingRejectId, setConfirmingRejectId] = useState(null);
  const [confirmingDeleteHeldId, setConfirmingDeleteHeldId] = useState(null);
  const [deletingHeldOrderId, setDeletingHeldOrderId] = useState(null);
  const [activeTabModal, setActiveTabModal] = useState(null); // 'held', 'incoming', 'payment', 'customization', 'void_item', 'receipt', 'settings'

  // Notification tracking refs
  const knownOrderIdsRef = useRef(null);
  const isFirstPollRef = useRef(true);

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
  const [dispatchStatusMsg, setDispatchStatusMsg] = useState("");

  // Order History & Reprint State
  const [completedOrdersHistory, setCompletedOrdersHistory] = useState([]);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [reprintSuccessMsg, setReprintSuccessMsg] = useState("");

  // Customer Search & Autocomplete State
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // WhatsApp Location Auto-Detection State
  const [detectedWaLocation, setDetectedWaLocation] = useState(null);
  const [isCheckingWaLocation, setIsCheckingWaLocation] = useState(false);

  // Branch Operational Status Modal States
  const [branchStatus, setBranchStatus] = useState(null);
  const [showBranchStatusModal, setShowBranchStatusModal] = useState(false);
  const [hasShownInitialBranchModal, setHasShownInitialBranchModal] = useState(false);
  const [posOperationalStatus, setPosOperationalStatus] = useState("open");
  const [posClosureReason, setPosClosureReason] = useState("Overloaded");
  const [isSavingBranchStatus, setIsSavingBranchStatus] = useState(false);

  const fetchBranchStatusAndPrompt = async () => {
    try {
      const res = await fetch("/api/branches");
      const data = await res.json();
      if (data.branches && data.branches.length > 0) {
        const mainBranch = data.branches[0];
        const status = mainBranch.operational_status || (mainBranch.orders_active === false ? "closed" : "open");
        const reason = mainBranch.closure_reason || "Overloaded";
        
        setBranchStatus(mainBranch);
        setPosOperationalStatus(status);
        setPosClosureReason(reason);

        if (!hasShownInitialBranchModal) {
          setHasShownInitialBranchModal(true);
          setShowBranchStatusModal(true);
        }
      }
    } catch (err) {
      console.error("Error fetching branch status in POS:", err);
    }
  };

  const handleSaveBranchStatusFromPos = async () => {
    if (!branchStatus) return;
    setIsSavingBranchStatus(true);
    try {
      const finalReason = posOperationalStatus !== "open" ? (posClosureReason || "Overloaded") : null;
      const res = await fetch(`/api/branches/${branchStatus.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: branchStatus.name || "Cloud Kitchen",
          operational_status: posOperationalStatus,
          closure_reason: finalReason,
          orders_active: posOperationalStatus === "open",
          is_active: posOperationalStatus !== "closed",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated = data.branch || {
          ...branchStatus,
          operational_status: posOperationalStatus,
          closure_reason: finalReason,
          orders_active: posOperationalStatus === "open",
        };
        setBranchStatus(updated);
        setShowBranchStatusModal(false);
        alert("Branch operational status updated successfully!");
      } else {
        const err = await res.json();
        alert("Failed to update status: " + (err.error || "Unknown error"));
      }
    } catch (e) {
      console.error("Error saving branch status from POS:", e);
      alert("Error saving branch status: " + e.message);
    } finally {
      setIsSavingBranchStatus(false);
    }
  };

  const getRealtimeBranchStatusInfo = (branch, currentPosStatus, currentReason) => {
    if (!branch) return { text: "🟢 Open", description: "Store is Open", badgeClass: "bg-emerald-900/40 text-emerald-300 border-emerald-500/50", isOpen: true };

    const status = currentPosStatus || branch.operational_status || "open";
    const reasonText = currentReason ? ` (${currentReason})` : "";

    if (status === "closed") {
      return {
        text: `🔴 Closed (Hidden)`,
        description: `Store is Closed${reasonText}`,
        badgeClass: "bg-rose-900/40 text-rose-300 border-rose-500/50",
        isOpen: false
      };
    }

    const nowBeirutWeekday = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Beirut", weekday: "long" }).toLowerCase();
    const currentHHMM = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Beirut", hour: "2-digit", minute: "2-digit" });

    let sched = branch.weekday_schedule;
    if (typeof sched === "string") {
      try { sched = JSON.parse(sched); } catch(e){}
    }

    let openTime = (branch.opening_time || "12:00").slice(0, 5);
    let closeTime = (branch.closing_time || "23:00").slice(0, 5);
    let isWeekdayActive = true;

    if (sched && typeof sched === "object" && sched[nowBeirutWeekday]) {
      const dayConfig = sched[nowBeirutWeekday];
      if (dayConfig.active === false) {
        isWeekdayActive = false;
      } else {
        if (dayConfig.open) openTime = dayConfig.open.slice(0, 5);
        if (dayConfig.close) closeTime = dayConfig.close.slice(0, 5);
      }
    }

    const capitalizedDay = nowBeirutWeekday.charAt(0).toUpperCase() + nowBeirutWeekday.slice(1);

    if (!isWeekdayActive) {
      return {
        text: `📅 Closed on ${capitalizedDay}`,
        description: `Kitchen Closed on ${capitalizedDay}${reasonText}`,
        badgeClass: "bg-rose-900/40 text-rose-300 border-rose-500/50",
        isOpen: false
      };
    }

    if (currentHHMM < openTime || currentHHMM >= closeTime) {
      if (currentHHMM < openTime) {
        return {
          text: `🕒 Closed (Opens ${openTime})`,
          description: `Store is Closed (Opens today at ${openTime})`,
          badgeClass: "bg-amber-900/40 text-amber-300 border-amber-500/50",
          isOpen: false
        };
      } else {
        return {
          text: `🕒 Closed (${openTime}-${closeTime})`,
          description: `Store is Closed (Operating Hours: ${openTime} - ${closeTime})`,
          badgeClass: "bg-amber-900/40 text-amber-300 border-amber-500/50",
          isOpen: false
        };
      }
    }

    if (status === "closed_hour") {
      return {
        text: `⏳ Closed 1h${reasonText}`,
        description: `Store is Closed For an Hour${reasonText}`,
        badgeClass: "bg-amber-900/40 text-amber-300 border-amber-500/50",
        isOpen: false
      };
    } else if (status === "closed_today") {
      return {
        text: `🌙 Closed Today${reasonText}`,
        description: `Store is Closed For Today${reasonText}`,
        badgeClass: "bg-purple-900/40 text-purple-300 border-purple-500/50",
        isOpen: false
      };
    }

    return {
      text: `🟢 Open / Accepting Orders`,
      description: `Store is Open (Operating Hours: ${openTime} - ${closeTime})`,
      badgeClass: "bg-emerald-900/40 text-emerald-300 border-emerald-500/50",
      isOpen: true
    };
  };

  const handleSelectChannelSource = (sourceId) => {
    if (sourceId === "Pick-up" || sourceId === "POS") {
      setSelectedChannel(null); // POS source
      setOrderType("pickup");
      setDiscountType("none");
      setDeliveryFee(0);
    } else if (sourceId === "Toters") {
      setSelectedChannel("Toters");
      setOrderType("delivery");
      setDiscountType("toters");
      setDeliveryFee(0);
    } else if (sourceId === "NokNok") {
      setSelectedChannel("NokNok");
      setOrderType("delivery");
      setDiscountType("noknok");
      setDeliveryFee(0);
    } else if (sourceId === "WhatsApp") {
      setSelectedChannel("WhatsApp");
      setDiscountType("wa15");
    } else if (sourceId === "App") {
      setSelectedChannel("App");
      setDiscountType("none");
    }
  };

  const checkWhatsAppLocation = async (phone) => {
    if (!phone || phone.replace(/\D/g, "").length < 6) {
      setDetectedWaLocation(null);
      return;
    }
    setIsCheckingWaLocation(true);
    try {
      // Query /api/pos/customers with the phone number
      const cleanDigits = phone.replace(/\D/g, "");
      const res = await fetch(`/api/pos/customers?q=${encodeURIComponent(cleanDigits)}`);
      if (res.ok) {
        const data = await res.json();
        const match = (data.customers || []).find((c) => c.whatsapp_location && c.whatsapp_location.hasLocation);
        if (match && match.whatsapp_location) {
          setDetectedWaLocation(match.whatsapp_location);
          return;
        }
      }
      setDetectedWaLocation(null);
    } catch (err) {
      console.error("Error checking WhatsApp location:", err);
      setDetectedWaLocation(null);
    } finally {
      setIsCheckingWaLocation(false);
    }
  };

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
        const matchWithLocation = data.customers.find((c) => c.whatsapp_location);
        if (matchWithLocation) {
          setDetectedWaLocation(matchWithLocation.whatsapp_location);
        }
      } else {
        setCustomerSearchResults([]);
        setShowCustomerDropdown(false);
      }
    } catch (err) {
      console.error("Error searching customers:", err);
    } finally {
      setIsSearchingCustomers(false);
    }

    // Also check for WhatsApp location if the query contains digits (phone number)
    if (query.replace(/\D/g, "").length >= 6) {
      checkWhatsAppLocation(query);
    }
  };

  const handleSelectCustomer = (c) => {
    if (c.customer_name) setCustomerName(c.customer_name);
    if (c.customer_phone) setCustomerPhone(c.customer_phone);
    if (c.delivery_address) setDeliveryAddress(c.delivery_address);
    if (c.whatsapp_location) {
      setDetectedWaLocation(c.whatsapp_location);
      if (c.whatsapp_location.deliveryFee !== undefined) {
        setDeliveryFee(c.whatsapp_location.deliveryFee);
      }
    } else {
      checkWhatsAppLocation(c.customer_phone);
    }
    setShowCustomerDropdown(false);
  };

  useEffect(() => {
    if (orderType !== "delivery" || !deliveryAddress.trim()) return;
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

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/pos/products");
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
      if (data.products) setProducts(data.products);
      if (data.settings) {
        if (data.settings.toters_discount_percent !== undefined) setTotersDiscountPercent(data.settings.toters_discount_percent);
        if (data.settings.noknok_discount_percent !== undefined) setNoknokDiscountPercent(data.settings.noknok_discount_percent);
        if (data.settings.print_server_ip) setPrintServerIP(data.settings.print_server_ip);
        if (data.settings.print_server_port) setPrintServerPort(Number(data.settings.print_server_port));
      }
    } catch (err) {
      console.error("Error fetching POS products:", err);
    } finally {
      setLoading(false);
    }
  };

  const playNotificationBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const beep = (freq, startAt, dur) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.4, ctx.currentTime + startAt);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + dur);
        osc.start(ctx.currentTime + startAt);
        osc.stop(ctx.currentTime + startAt + dur + 0.05);
      };
      beep(880, 0, 0.18);
      beep(1100, 0.22, 0.18);
      beep(1320, 0.44, 0.30);
    } catch (e) {}
  };

  const fireOrderNotification = (order) => {
    playNotificationBeep();
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      const notif = new Notification("🛵 New WhatsApp Order!", {
        body: `${order.customer_name || "Customer"} • $${parseFloat(order.total_amount || 0).toFixed(2)}`,
        icon: "/icon-192x192.png",
        tag: `wa-order-${order.id}`,
        renotify: true,
        requireInteraction: true,
      });
      notif.onclick = () => {
        window.focus();
        setActiveTabModal("incoming");
      };
    }
  };

  const fetchOrdersQueue = async () => {
    try {
      const [pendingRes, heldRes] = await Promise.all([
        fetch("/api/pos/orders?type=pending"),
        fetch("/api/pos/orders?type=held")
      ]);
      const pendingData = await pendingRes.json();
      const heldData = await heldRes.json();

      if (pendingData.orders) {
        const incoming = pendingData.orders;
        setPendingOrders(incoming);
        if (!isFirstPollRef.current && knownOrderIdsRef.current) {
          incoming
            .filter((o) => !knownOrderIdsRef.current.has(o.id))
            .forEach((o) => fireOrderNotification(o));
        }
        knownOrderIdsRef.current = new Set(incoming.map((o) => o.id));
        isFirstPollRef.current = false;
      }
      if (heldData.orders) setHeldOrders(heldData.orders);
    } catch (err) {
      console.error("Error fetching orders queue:", err);
    }
  };

  const handleRejectPendingOrder = async (orderId) => {
    if (confirmingRejectId !== orderId) {
      setConfirmingRejectId(orderId);
      setTimeout(() => {
        setConfirmingRejectId((current) => (current === orderId ? null : current));
      }, 4000);
      return;
    }
    setConfirmingRejectId(null);
    setRejectingOrderId(orderId);
    try {
      const res = await fetch(`/api/pos/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          voidReason: "Rejected from POS WhatsApp Queue",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
        fetchOrdersQueue();
      } else {
        alert("Failed to reject order: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Error rejecting pending order:", err);
      alert("Error rejecting order: " + err.message);
    } finally {
      setRejectingOrderId(null);
    }
  };

  const handleDeleteHeldOrder = async (orderId) => {
    if (confirmingDeleteHeldId !== orderId) {
      setConfirmingDeleteHeldId(orderId);
      setTimeout(() => {
        setConfirmingDeleteHeldId((current) => (current === orderId ? null : current));
      }, 4000);
      return;
    }
    setConfirmingDeleteHeldId(null);
    setDeletingHeldOrderId(orderId);
    try {
      const res = await fetch(`/api/pos/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          voidReason: "Deleted from Held Orders",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHeldOrders((prev) => prev.filter((o) => o.id !== orderId));
        fetchOrdersQueue();
      } else {
        alert("Failed to delete held order: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Error deleting held order:", err);
      alert("Error deleting held order: " + err.message);
    } finally {
      setDeletingHeldOrderId(null);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    fetchProducts();
    fetchOrdersQueue();
    fetchBranchStatusAndPrompt();
    const interval = setInterval(fetchOrdersQueue, 10000);
    return () => clearInterval(interval);
  }, []);

  // Category Name Helper: Strips "OVRLOAD" for display while preserving DB matching
  const formatCategoryDisplay = (name) => {
    if (!name) return "";
    return name.replace(/ovrload\s*/gi, "").trim();
  };

  const normalizeCat = (str) => (str || "").toLowerCase().replace(/ovrload\s*/gi, "").trim();

  // Dynamic Category List Generation
  const dbCatNames = Array.from(new Set(categories.map((c) => c.name).filter(Boolean)));
  const availableCategoryList = [
    "⭐ Favorites",
    ...(dbCatNames.length > 0 ? dbCatNames : ["Meals", "Wraps", "Quesa", "Sweets", "Shakes", "Sides", "Drinks", "Dips"]),
  ];

  const filteredProducts = products.filter((p) => {
    if (selectedCategory === "⭐ Favorites") {
      if (favoriteProductIds.length > 0) {
        return favoriteProductIds.includes(p.id);
      }
      const pName = (p.name || "").toLowerCase();
      const isFav = FAVORITE_PRODUCT_NAMES.some((fav) => pName.includes(fav));
      if (isFav) return true;
      const anyFavMatch = products.some((item) => FAVORITE_PRODUCT_NAMES.some((f) => (item.name || "").toLowerCase().includes(f)));
      if (!anyFavMatch) return true;
      return false;
    }
    if (selectedCategory === "All") return true;

    const targetNorm = normalizeCat(selectedCategory);
    const prodNorm = normalizeCat(p.category_name);

    if (!targetNorm) return true;

    return (
      prodNorm === targetNorm ||
      prodNorm.includes(targetNorm) ||
      targetNorm.includes(prodNorm)
    );
  });

  const handleQuickAddProduct = (product) => {
    if (product.customizations && product.customizations.length > 0) {
      handleOpenCustomization(product);
      return;
    }
    const existingIndex = ticketItems.findIndex(
      (item) => item.product_id === product.id && (!item.selectedCustomizations || item.selectedCustomizations.length === 0) && !item.note
    );

    if (existingIndex > -1) {
      const updated = [...ticketItems];
      updated[existingIndex].qty += 1;
      setTicketItems(updated);
    } else {
      setTicketItems([
        ...ticketItems,
        {
          product_id: product.id,
          name: product.name,
          base_price: product.unit_price_usd || 0,
          unit_price: product.unit_price_usd || 0,
          qty: 1,
          selectedCustomizations: [],
          note: "",
        },
      ]);
    }
  };

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
      setSelectedCustomizations([]);
      setItemNote("");
      setCustomizationQty(1);
    }
    setActiveTabModal("customization");
  };

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

  const handleSaveCustomizationToCart = () => {
    if (!currentProduct) return;

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
            setCustomizationError(`⚠️ Selection for "${groupName}" is REQUIRED!`);
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

  const subtotal = ticketItems.reduce((sum, item) => sum + item.unit_price * item.qty, 0);

  const calculatedDiscount = (() => {
    if (discountType === "5%") return subtotal * 0.05;
    if (discountType === "10%") return subtotal * 0.10;
    if (discountType === "15%" || discountType === "wa15") return subtotal * 0.15;
    if (discountType === "toters") return subtotal * (totersDiscountPercent / 100);
    if (discountType === "noknok") return subtotal * (noknokDiscountPercent / 100);
    if (discountType === "custom") {
      const val = parseFloat(discountValInput) || 0;
      if (discountIsPercent) return subtotal * (val / 100);
      return Math.min(subtotal, val);
    }
    return 0;
  })();

  const discountAmount = calculatedDiscount;
  const total = Math.max(0, subtotal + (orderType === "delivery" ? (Number(deliveryFee) || 0) : 0) - discountAmount);

  const discountLabel = (() => {
    if (discountType === "5%") return "5%";
    if (discountType === "10%") return "10%";
    if (discountType === "15%") return "15%";
    if (discountType === "wa15") return "WhatsApp 15%";
    if (discountType === "toters") return `Toters (${totersDiscountPercent}%)`;
    if (discountType === "noknok") return `NokNok (${noknokDiscountPercent}%)`;
    if (discountType === "custom") return discountIsPercent ? `${discountValInput}%` : `$${discountValInput}`;
    return "Discount";
  })();

  const handlePrint = async (orderData) => {
    const ip = printServerIP || "192.168.18.195";
    const port = printServerPort || "9191";
    const url = `http://${ip}:${port}/print`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
        signal: AbortSignal.timeout(2000),
      });
      const result = await res.json();
      if (result && result.success) return;
    } catch (err) {}

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
    } catch (formErr) {}
  };

  const validateOrder = () => {
    if (!selectedChannel && !editingOrderId) {
      setSelectedChannel("POS");
    }
    setValidationError("");
    return true;
  };

  const handleHoldOrder = async () => {
    if (ticketItems.length === 0) return;
    validateOrder();

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/pos/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType,
          orderSource: selectedChannel || "POS",
          paymentMethod: selectedPaymentMethod,
          customerName,
          customerPhone,
          deliveryAddress,
          status: "held",
          subtotal,
          deliveryFee: orderType === "delivery" ? (parseFloat(deliveryFee) || 0) : 0,
          discountAmount,
          total,
          items: ticketItems.map((item) => ({
            product_id: item.product_id,
            quantity: item.qty,
            unit_price: item.unit_price,
            customizations: (item.selectedCustomizations || []).map((c) => c.ingredient || c.name || c),
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
        setSelectedChannel(null);
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

  const handleFinalizePayment = async () => {
    if (ticketItems.length === 0) return;
    const effectiveChannel = selectedChannel || "POS";
    if (!selectedChannel && !editingOrderId) setSelectedChannel("POS");

    setIsSubmitting(true);
    try {
      let data;
      if (editingOrderId) {
        const updateRes = await fetch(`/api/pos/orders/${editingOrderId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "preparing",
            subtotal,
            deliveryFee: orderType === "delivery" ? (parseFloat(deliveryFee) || 0) : 0,
            discountAmount,
            total,
            customerName,
            customerPhone,
            deliveryAddress,
            orderType,
            orderSource: effectiveChannel,
            items: ticketItems.map((item) => ({
              product_id: item.product_id,
              quantity: item.qty,
              unit_price: item.unit_price,
              customizations: (item.selectedCustomizations || []).map((c) => c.ingredient || c.name || c),
              comment: item.note
            }))
          })
        });
        data = await updateRes.json();
        if (data.success) data.orderId = editingOrderId;
      } else {
        const actualPaymentMethod =
          effectiveChannel === "Toters" ? "Toters" :
          effectiveChannel === "NokNok" ? "NokNok" :
          selectedPaymentMethod;

        const createRes = await fetch("/api/pos/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderType,
            orderSource: effectiveChannel,
            paymentMethod: actualPaymentMethod,
            customerName,
            customerPhone,
            deliveryAddress,
            status: "preparing",
            subtotal,
            deliveryFee: orderType === "delivery" ? (parseFloat(deliveryFee) || 0) : 0,
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
        const normalizedItems = ticketItems.map((item) => {
          const rawCusts = item.selectedCustomizations || [];
          const { addons, removals } = partitionCustomizations(rawCusts);

          const printCustomizationLines = [];
          addons.forEach((a) => printCustomizationLines.push(`+ ${a}`));
          if (removals.length > 0) {
            printCustomizationLines.push(`REMOVE:`);
            removals.forEach((r) => printCustomizationLines.push(`  - ${r}`));
          }

          return {
            qty: item.qty || item.quantity || 1,
            name: item.name || item.product_name || "Item",
            unit_price: item.unit_price || 0,
            selectedCustomizations: rawCusts.map((c) =>
              typeof c === "string" ? { name: c } : { name: c.ingredient || c.name || "" }
            ),
            addons,
            removals,
            customizations_print_text: printCustomizationLines,
            note: item.note || ""
          };
        });

        const completedOrderData = {
          id: data.orderId || editingOrderId,
          order_source: effectiveChannel,
          order_type: orderType,
          payment_method:
            effectiveChannel === "Toters" ? "Toters" :
            effectiveChannel === "NokNok" ? "NokNok" :
            selectedPaymentMethod,
          customer_name: customerName,
          customer_phone: customerPhone,
          delivery_address: deliveryAddress,
          subtotal_amount: subtotal,
          delivery_fee: orderType === "delivery" ? (parseFloat(deliveryFee) || 0) : 0,
          discount_amount: discountAmount,
          discount_label: discountAmount > 0 ? discountLabel : null,
          total_amount: total,
          items: normalizedItems,
          created_at: new Date().toISOString()
        };

        handlePrint(completedOrderData);
        setLastCompletedOrder(completedOrderData);
        setTicketItems([]);
        setCustomerName("");
        setCustomerPhone("");
        setDeliveryAddress("");
        setSelectedChannel(null);
        setEditingOrderId(null);
        setDiscountType("none");
        setDiscountValInput(10);
        setDiscountIsPercent(true);
        setDeliveryFee(0);
        setOrderType("delivery");
        setActiveTabModal(["Toters", "NokNok"].includes(effectiveChannel) ? null : "receipt");
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

  const fetchOrderHistory = async () => {
    try {
      const res = await fetch("/api/pos/orders?type=all");
      const data = await res.json();
      if (data.orders) setCompletedOrdersHistory(data.orders);
    } catch (err) {
      console.error("Error fetching order history:", err);
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
      items: (order.items || []).map((i) => {
        const rawCusts = i.customizations
          ? Array.isArray(i.customizations)
            ? i.customizations.map((c) => (typeof c === "string" ? { name: c } : c))
            : [{ name: String(i.customizations) }]
          : [];
        const { addons, removals } = partitionCustomizations(rawCusts);

        const printCustomizationLines = [];
        addons.forEach((a) => printCustomizationLines.push(`+ ${a}`));
        if (removals.length > 0) {
          printCustomizationLines.push(`REMOVE:`);
          removals.forEach((r) => printCustomizationLines.push(`  - ${r}`));
        }

        return {
          qty: i.quantity || i.qty || 1,
          name: i.product_name || i.name || "Item",
          unit_price: i.unit_price || 0,
          selectedCustomizations: rawCusts,
          addons,
          removals,
          customizations_print_text: printCustomizationLines,
          note: i.comment || ""
        };
      }),
      created_at: order.created_at || new Date().toISOString()
    };
    handlePrint(orderData);
    setLastCompletedOrder(orderData);
    setReprintSuccessMsg(`Order #${order.id} sent to thermal printer! 🖨️`);
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#0F1115] text-white flex items-center justify-center font-bold text-lg">
        <div className="flex flex-col items-center gap-3">
          <span className="w-10 h-10 border-4 border-[#eb660c] border-t-transparent rounded-full animate-spin"></span>
          <span>Loading OVRLOAD POS...</span>
        </div>
      </div>
    );
  }

  const realtimeStatus = getRealtimeBranchStatusInfo(branchStatus, posOperationalStatus, posClosureReason);

  return (
    <div className="h-screen max-h-screen flex bg-[#0F1115] text-white font-sans overflow-hidden select-none">
      {/* LEFT AREA (65% Width): Header + Category Bar + Product Grid */}
      <div className="w-[65%] flex flex-col h-full overflow-hidden border-r border-[#262D3D]">
        {/* HEADER FOR LEFT AREA */}
        <header className="h-14 bg-[#181C24] border-b border-[#262D3D] px-4 flex items-center justify-between shadow-md print:hidden flex-shrink-0 z-10">
          {/* Brand + All Action Buttons on Left */}
          <div className="flex items-center gap-3">
            {/* Brand Logo */}
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#eb660c] flex items-center justify-center font-black text-white text-sm">
                O
              </span>
              <span className="font-extrabold text-base tracking-wider text-white">
                OVR<span className="text-[#eb660c]">LOAD</span> <span className="text-[#eb660c] font-black text-[10px] ml-0.5">POS</span>
              </span>
            </div>

            {/* Action Buttons (Moved Left next to Logo) */}
            <div className="flex items-center gap-1.5 ml-2">
              {/* WhatsApp Orders Button */}
              <button
                onClick={() => setActiveTabModal("incoming")}
                className="px-2.5 py-1.5 bg-[#262D3D] hover:bg-[#323B4E] rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1 border border-[#3A455C]"
              >
                <span>📱 WhatsApp</span>
                {pendingOrders.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#eb660c] text-white text-[10px] font-black animate-pulse">
                    {pendingOrders.length}
                  </span>
                )}
              </button>

              {/* Held Orders Button */}
              <button
                onClick={() => setActiveTabModal("held")}
                className="px-2.5 py-1.5 bg-[#262D3D] hover:bg-[#323B4E] rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1 border border-[#3A455C]"
              >
                <span>⏸️ Held ({heldOrders.length})</span>
              </button>

              {/* History Button */}
              <button
                onClick={() => {
                  fetchOrderHistory();
                  setActiveTabModal("history");
                }}
                className="px-2.5 py-1.5 bg-[#262D3D] hover:bg-[#323B4E] rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1 border border-[#3A455C]"
              >
                <span>📜 History</span>
              </button>

              {/* Settings Button with Green/Red Light Indicator */}
              <button
                onClick={() => setActiveTabModal("settings")}
                className="px-2.5 py-1.5 bg-[#262D3D] hover:bg-[#323B4E] rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 border border-[#3A455C]"
                title={`POS Settings • Branch Status: ${realtimeStatus.isOpen ? "OPEN" : "CLOSED"}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${
                  realtimeStatus.isOpen ? "bg-emerald-400 shadow-sm shadow-emerald-400/80 animate-pulse" : "bg-rose-500 shadow-sm shadow-rose-500/80"
                }`}></span>
                <span>⚙️ Settings</span>
              </button>
            </div>
          </div>
        </header>
          {/* CATEGORIES BAR */}
          <div className="px-4 py-2.5 bg-[#14171F] border-b border-[#262D3D] flex items-center gap-2 overflow-x-auto no-scrollbar flex-shrink-0">
            {availableCategoryList.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 border ${
                    isSelected
                      ? "bg-[#eb660c] text-white border-[#eb660c] shadow-md shadow-[#eb660c]/20 scale-102"
                      : "bg-[#181C24] text-gray-300 border-[#262D3D] hover:bg-[#262D3D] hover:text-white"
                  }`}
                >
                  <span>{formatCategoryDisplay(cat)}</span>
                </button>
              );
            })}
          </div>

          {/* PRODUCT GRID (3 Columns in a row) */}
          <div className="flex-1 overflow-y-auto p-3.5 grid grid-cols-3 gap-3 align-content-start">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full py-16 text-center text-gray-400 font-medium text-sm">
                No products found in this category.
              </div>
            ) : (
              filteredProducts.map((p) => {
                const hasOptions = p.customizations && p.customizations.length > 0;
                const optionsCount = hasOptions
                  ? new Set(p.customizations.map((c) => c.option_group_name || c.name)).size || p.customizations.length
                  : 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => handleQuickAddProduct(p)}
                    className="bg-[#181C24] hover:bg-[#1f2532] border border-[#262D3D] hover:border-[#eb660c]/50 rounded-xl p-3 flex flex-col justify-between transition-all cursor-pointer group shadow-sm min-h-[105px] h-auto relative overflow-hidden"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-extrabold text-xs text-white group-hover:text-[#eb660c] transition-colors leading-tight">
                          {p.name}
                        </h4>
                        <button
                          type="button"
                          onClick={(e) => toggleFavoriteProduct(p.id, e)}
                          className={`text-xs px-1 hover:scale-125 transition-all ${
                            favoriteProductIds.includes(p.id) ? "text-amber-400 opacity-100" : "text-gray-500 opacity-30 hover:opacity-100"
                          }`}
                          title={favoriteProductIds.includes(p.id) ? "Starred as Favorite" : "Add to Favorites"}
                        >
                          ★
                        </button>
                      </div>
                      {hasOptions && (
                        <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#eb660c]/15 text-[#eb660c] border border-[#eb660c]/30">
                          {optionsCount} option{optionsCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-[#262D3D]/60">
                      <span className="font-black text-xs text-[#eb660c]">
                        ${(p.unit_price_usd || 0).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickAddProduct(p);
                        }}
                        className="px-2.5 py-1 bg-[#eb660c] group-hover:bg-[#d55909] text-white rounded-lg text-[11px] font-black shadow-sm transition-all active:scale-95 flex items-center gap-1"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL: TICKET CART & CHECKOUT (35% Width) */}
        <div className="w-[35%] flex flex-col h-full bg-[#14171F] overflow-hidden flex-shrink-0">
          {/* TICKET HEADER & UNIFIED SMART CHANNEL BAR */}
          <div className="p-3 border-b border-[#262D3D] space-y-2 bg-[#181C24] flex-shrink-0">
            {/* Hold Button if active items */}
            {ticketItems.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleHoldOrder}
                  disabled={isSubmitting}
                  className="px-2.5 py-0.5 bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold transition-all"
                >
                  ⏸️ Hold Ticket
                </button>
              </div>
            )}

            {/* UNIFIED 5-BUTTON SMART CHANNEL BAR */}
            <div className="grid grid-cols-5 gap-1 p-1 bg-[#0F1115] rounded-xl border border-[#262D3D]">
              {[
                { id: "Toters", label: "Toters 🟢" },
                { id: "WhatsApp", label: "WA 📱" },
                { id: "POS", label: "POS" },
                { id: "NokNok", label: "NokNok 🔴" },
                { id: "App", label: "App 📲" },
              ].map((src) => {
                const isCurrent =
                  src.id === "POS" || src.id === "Pick-up"
                    ? !selectedChannel
                    : selectedChannel === src.id;

                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => handleSelectChannelSource(src.id === "POS" ? "Pick-up" : src.id)}
                    className={`py-2 px-1 rounded-lg text-[11px] font-black transition-all text-center truncate ${
                      isCurrent
                        ? "bg-[#eb660c] text-white shadow-md shadow-[#eb660c]/20"
                        : "text-gray-400 hover:text-white hover:bg-[#181C24]"
                    }`}
                  >
                    {src.id === "POS" ? "Pick-up 🛍️" : src.label}
                  </button>
                );
              })}
            </div>

            {/* Sub-toggle for WhatsApp and App (Delivery vs Pickup) */}
            {["WhatsApp", "App"].includes(selectedChannel) && (
              <div className="flex items-center justify-between px-2 py-1 bg-[#0F1115] rounded-lg border border-[#262D3D]">
                <span className="text-[11px] font-bold text-gray-400">{selectedChannel} Type:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOrderType("delivery")}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-black transition-all ${
                      orderType === "delivery"
                        ? "bg-[#eb660c] text-white shadow-sm"
                        : "text-gray-400 hover:text-white hover:bg-[#181C24]"
                    }`}
                  >
                    🛵 Delivery
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType("pickup")}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-black transition-all ${
                      orderType === "pickup"
                        ? "bg-[#eb660c] text-white shadow-sm"
                        : "text-gray-400 hover:text-white hover:bg-[#181C24]"
                    }`}
                  >
                    🛍 Pickup
                  </button>
                </div>
              </div>
            )}

            {/* CUSTOMER FIELDS */}
            <div className="pt-1 border-t border-[#262D3D]/60 space-y-1.5 relative">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Customer Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#262D3D] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 font-medium focus:outline-none focus:border-[#eb660c]"
                />
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Phone Number"
                    value={customerPhone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomerPhone(val);
                      handleCustomerSearch(val);
                    }}
                    className="w-full bg-[#0F1115] border border-[#262D3D] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 font-medium focus:outline-none focus:border-[#eb660c]"
                  />
                  {showCustomerDropdown && customerSearchResults.length > 0 && (
                    <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-[#181C24] border border-[#262D3D] rounded-xl shadow-xl max-h-40 overflow-y-auto">
                      {customerSearchResults.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => handleSelectCustomer(c)}
                          className="p-2 hover:bg-[#262D3D] cursor-pointer text-xs border-b border-[#262D3D] last:border-0"
                        >
                          <div className="font-bold text-white">{c.customer_name || "Customer"}</div>
                          <div className="text-[11px] text-gray-400">{c.customer_phone}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* WHATSAPP LOCATION DETECTED BADGE / AUTO-FILL PROMPT */}
              {detectedWaLocation && (
                <div className="bg-emerald-950/90 border border-emerald-500/70 rounded-xl p-2 flex items-center justify-between text-xs shadow-lg animate-fade-in">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="font-black text-emerald-300 flex items-center gap-1.5 text-[11px]">
                      <span>📍</span>
                      <span>WhatsApp Location Received</span>
                      <span className="text-[9px] bg-emerald-800 text-emerald-100 px-1.5 py-0.5 rounded-full font-bold">
                        {detectedWaLocation.receivedMinutesAgo <= 1 ? "Just now" : `${detectedWaLocation.receivedMinutesAgo}m ago`}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-300 truncate mt-0.5">
                      {detectedWaLocation.address} {detectedWaLocation.distanceKm ? `• ${detectedWaLocation.distanceKm} km` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOrderType("delivery");
                      const fullAddr = detectedWaLocation.address && detectedWaLocation.mapUrl
                        ? `${detectedWaLocation.address} [Maps Pin: ${detectedWaLocation.mapUrl}]`
                        : (detectedWaLocation.mapUrl || detectedWaLocation.address || "");
                      setDeliveryAddress(fullAddr);
                      if (detectedWaLocation.deliveryFee !== undefined && detectedWaLocation.deliveryFee !== null) {
                        setDeliveryFee(detectedWaLocation.deliveryFee);
                      }
                    }}
                    className="bg-[#eb660c] hover:bg-[#ff771f] text-white text-[11px] font-black px-2.5 py-1.5 rounded-lg shadow-md shrink-0 flex items-center gap-1 transition-all active:scale-95"
                  >
                    <span>⚡ Auto-Fill</span>
                    {detectedWaLocation.deliveryFee !== undefined && (
                      <span>(${detectedWaLocation.deliveryFee?.toFixed(2)})</span>
                    )}
                  </button>
                </div>
              )}

              {/* DELIVERY ADDRESS / LOCATION TEXTAREA (Visible for Delivery Orders) */}
              {orderType === "delivery" && (
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-gray-400">
                      📍 Delivery Address & WhatsApp Map Link:
                    </label>
                    {deliveryAddress && (
                      <button
                        type="button"
                        onClick={() => setDeliveryAddress("")}
                        className="text-[10px] text-gray-400 hover:text-red-400 font-bold"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Street, Bldg, Floor, or paste WhatsApp / Google Maps link..."
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full bg-[#0F1115] border border-[#262D3D] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 font-medium focus:outline-none focus:border-[#eb660c] resize-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* TICKET ITEMS LIST */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {ticketItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-gray-400 border-2 border-dashed border-[#262D3D] rounded-2xl my-2">
                <span className="text-3xl mb-2 opacity-50">🛒</span>
                <h4 className="font-extrabold text-sm text-gray-300">Ticket is empty</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-[200px]">Tap a product from the catalog to start an order.</p>
              </div>
            ) : (
              ticketItems.map((item, index) => (
                <div key={index} className="bg-[#181C24] border border-[#262D3D] rounded-xl p-2.5 space-y-1.5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-2">
                      <h5 className="font-extrabold text-xs text-white leading-tight">{item.name}</h5>
                      <div className="text-xs text-[#eb660c] font-black mt-0.5">
                        ${(item.unit_price * item.qty).toFixed(2)}
                      </div>
                    </div>
                    <button
                      onClick={() => handlePromptVoid(index)}
                      className="text-gray-400 hover:text-red-400 p-1 text-xs transition-colors"
                      title="Remove Item"
                    >
                      🗑
                    </button>
                  </div>

                  {item.selectedCustomizations && item.selectedCustomizations.length > 0 && (() => {
                    const { addons, removals } = partitionCustomizations(item.selectedCustomizations);
                    return (
                      <div className="space-y-1 pt-0.5">
                        {addons.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {addons.map((a, i) => (
                              <span key={i} className="text-[10px] bg-[#0F1115] text-gray-300 px-2 py-0.5 rounded border border-[#262D3D] font-medium">
                                + {a}
                              </span>
                            ))}
                          </div>
                        )}
                        {removals.length > 0 && (
                          <div className="space-y-0.5 pt-0.5">
                            <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider block">REMOVE:</span>
                            <div className="flex flex-wrap gap-1">
                              {removals.map((r, i) => (
                                <span key={i} className="text-[10px] bg-rose-950/60 text-rose-300 px-2 py-0.5 rounded border border-rose-500/40 font-extrabold">
                                  - {r}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {item.note && <p className="text-[10px] text-amber-300 italic">Note: {item.note}</p>}

                  <div className="flex items-center justify-between pt-1 border-t border-[#262D3D]/50">
                    <button
                      onClick={() => handleOpenCustomization(products.find((p) => p.id === item.product_id) || { id: item.product_id, name: item.name, unit_price_usd: item.base_price }, index)}
                      className="text-[11px] font-bold text-gray-400 hover:text-white underline"
                    >
                      Edit Options
                    </button>
                    <div className="flex items-center gap-1 bg-[#0F1115] border border-[#262D3D] rounded-lg p-0.5">
                      <button
                        onClick={() => handleUpdateQty(index, -1)}
                        className="w-6 h-6 rounded bg-[#262D3D] hover:bg-[#323B4E] font-extrabold text-white text-xs flex items-center justify-center transition-all active:scale-95"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-extrabold text-xs text-white">{item.qty}</span>
                      <button
                        onClick={() => handleUpdateQty(index, 1)}
                        className="w-6 h-6 rounded bg-[#262D3D] hover:bg-[#323B4E] font-extrabold text-white text-xs flex items-center justify-center transition-all active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* CHECKOUT SUMMARY & PAY & PRINT AREA */}
          <div className="p-3.5 border-t border-[#262D3D] bg-[#181C24] space-y-2.5 flex-shrink-0">
            {/* Validation Alert */}
            {validationError && (
              <div className="bg-red-950/80 border border-red-500/50 text-red-200 text-xs px-3 py-1.5 rounded-lg flex items-center justify-between">
                <span>{validationError}</span>
                <button onClick={() => setValidationError("")} className="font-bold px-1">✕</button>
              </div>
            )}

            {/* Discount & Delivery Fee Quick Inputs */}
            <div className="space-y-1.5 text-xs">
            {/* 2-COLUMN CONTROLS & CALCULATIONS GRID */}
            <div className="grid grid-cols-2 gap-2.5 pt-1.5 border-t border-[#262D3D]">
              {/* LEFT SIDE: Discount & Delivery Fee Controls */}
              <div className="space-y-2 text-xs pr-2 border-r border-[#262D3D]/60 flex flex-col justify-between">
                {/* Discount Control */}
                <div className="space-y-1">
                  <span className="font-bold text-gray-400 text-[11px] block">Discount:</span>
                  {discountType !== "none" && discountAmount > 0 ? (
                    <div className="flex items-center justify-between bg-amber-950/50 border border-amber-500/40 px-2 py-1 rounded-lg text-amber-300 text-xs font-extrabold">
                      <span className="truncate">{discountLabel} (-${discountAmount.toFixed(2)})</span>
                      <button
                        onClick={() => {
                          setDiscountType("none");
                          setDiscountValInput(10);
                        }}
                        className="hover:text-white font-bold ml-1"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowDiscountModal(true)}
                      className="px-2 py-1 bg-[#0F1115] border border-[#262D3D] hover:border-[#eb660c] rounded-lg text-[11px] font-extrabold text-[#eb660c] transition-all"
                    >
                      + Discount
                    </button>
                  )}
                </div>

                {/* Delivery Fee Control (Only for Delivery orders) */}
                {orderType === "delivery" && (
                  <div className="space-y-1 pt-1 border-t border-[#262D3D]/40">
                    <span className="font-bold text-gray-400 text-[11px] block">Delivery Fee:</span>
                    <div className="flex flex-wrap items-center gap-1">
                      {[0, 1, 2, 3].map((fee) => (
                        <button
                          key={fee}
                          type="button"
                          onClick={() => setDeliveryFee(fee)}
                          className={`px-2 py-0.5 rounded text-[11px] font-extrabold transition-all ${
                            Number(deliveryFee) === fee
                              ? "bg-[#eb660c] text-white"
                              : "bg-[#0F1115] border border-[#262D3D] text-gray-300 hover:bg-[#262D3D]"
                          }`}
                        >
                          ${fee}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const val = prompt("Custom Delivery Fee ($ USD):", deliveryFee);
                          if (val !== null && !isNaN(parseFloat(val))) setDeliveryFee(parseFloat(val));
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-extrabold transition-all ${
                          ![0, 1, 2, 3].includes(Number(deliveryFee))
                            ? "bg-[#eb660c] text-white"
                            : "bg-[#0F1115] border border-[#262D3D] text-gray-300 hover:bg-[#262D3D]"
                        }`}
                      >
                        Custom
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT SIDE: Subtotal, Discount, Delivery Fee, TOTAL */}
              <div className="space-y-1 text-xs font-semibold text-gray-300 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-amber-400">
                      <span>Discount ({discountLabel})</span>
                      <span>-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {orderType === "delivery" && (
                    <div className="flex justify-between text-blue-400">
                      <span>Delivery Fee</span>
                      <span>+${(Number(deliveryFee) || 0).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#262D3D]">
                  <span className="font-extrabold text-xs uppercase text-gray-300 tracking-wider">TOTAL</span>
                  <span className="font-black text-xl text-[#eb660c]">
                    ${total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* SAME HORIZONTAL LINE: Payment Buttons on Left & PAY & PRINT on Right */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#262D3D]">
              {/* LEFT SIDE: Cash / Whish or Prepaid Channel Badge */}
              {!["Toters", "NokNok"].includes(selectedChannel) ? (
                <div className="grid grid-cols-2 gap-1 w-[45%] shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod("Cash")}
                    className={`py-3 rounded-xl text-xs font-black flex items-center justify-center gap-1 border transition-all ${
                      selectedPaymentMethod === "Cash"
                        ? "bg-emerald-700 text-white border-emerald-500 shadow-md shadow-emerald-700/20"
                        : "bg-[#0F1115] text-gray-300 border-[#262D3D] hover:bg-[#262D3D]"
                    }`}
                  >
                    💵 Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod("Whish")}
                    className={`py-3 rounded-xl text-xs font-black flex items-center justify-center gap-1 border transition-all ${
                      selectedPaymentMethod === "Whish"
                        ? "bg-purple-700 text-white border-purple-500 shadow-md shadow-purple-700/20"
                        : "bg-[#0F1115] text-gray-300 border-[#262D3D] hover:bg-[#262D3D]"
                    }`}
                  >
                    🟣 Whish
                  </button>
                </div>
              ) : (
                <div className="w-[45%] shrink-0">
                  <div className={`py-3 px-2 rounded-xl text-xs font-black text-center border ${
                    selectedChannel === "Toters" ? "bg-[#00C49F]/20 text-[#00C49F] border-[#00C49F]/40" : "bg-[#FF5A5F]/20 text-[#FF5A5F] border-[#FF5A5F]/40"
                  }`}>
                    {selectedChannel} (Prepaid)
                  </div>
                </div>
              )}

              {/* RIGHT SIDE: PAY & PRINT BUTTON */}
              <button
                type="button"
                onClick={handleFinalizePayment}
                disabled={ticketItems.length === 0 || isSubmitting}
                className={`flex-1 py-3 rounded-xl text-xs font-black tracking-wider flex items-center justify-center gap-1 transition-all shadow-lg ${
                  ticketItems.length === 0 || isSubmitting
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed border border-gray-600"
                    : "bg-[#eb660c] hover:bg-[#d55909] text-white active:scale-98 shadow-[#eb660c]/20 border border-[#eb660c]"
                }`}
              >
                {isSubmitting ? "PROCESSING..." : `PAY & PRINT — $${total.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DISCOUNT MODAL */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-full max-w-sm p-5 space-y-4 text-white shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#262D3D] pb-3">
              <h3 className="font-extrabold text-base">Apply Discount Presets</h3>
              <button onClick={() => setShowDiscountModal(false)} className="text-gray-400 hover:text-white font-bold">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <button
                onClick={() => { setDiscountType("5%"); setShowDiscountModal(false); }}
                className="p-3 bg-[#0F1115] border border-[#262D3D] hover:border-[#eb660c] rounded-xl text-center text-white"
              >
                5% Off
              </button>
              <button
                onClick={() => { setDiscountType("10%"); setShowDiscountModal(false); }}
                className="p-3 bg-[#0F1115] border border-[#262D3D] hover:border-[#eb660c] rounded-xl text-center text-white"
              >
                10% Off
              </button>
              <button
                onClick={() => { setDiscountType("15%"); setShowDiscountModal(false); }}
                className="p-3 bg-[#0F1115] border border-[#262D3D] hover:border-[#eb660c] rounded-xl text-center text-white"
              >
                15% Off
              </button>
              <button
                onClick={() => { setDiscountType("wa15"); setShowDiscountModal(false); }}
                className="p-3 bg-[#0F1115] border border-[#262D3D] hover:border-[#eb660c] rounded-xl text-center text-emerald-400"
              >
                WhatsApp 15%
              </button>
              <button
                onClick={() => { setDiscountType("toters"); setShowDiscountModal(false); }}
                className="p-3 bg-[#0F1115] border border-[#262D3D] hover:border-[#eb660c] rounded-xl text-center text-teal-300"
              >
                Toters ({totersDiscountPercent}%)
              </button>
              <button
                onClick={() => { setDiscountType("noknok"); setShowDiscountModal(false); }}
                className="p-3 bg-[#0F1115] border border-[#262D3D] hover:border-[#eb660c] rounded-xl text-center text-rose-300"
              >
                NokNok ({noknokDiscountPercent}%)
              </button>
            </div>

            <div className="pt-2 border-t border-[#262D3D] space-y-2">
              <span className="text-xs font-bold text-gray-400 block">Custom Discount Value:</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={discountValInput}
                  onChange={(e) => setDiscountValInput(e.target.value)}
                  className="flex-1 bg-[#0F1115] border border-[#262D3D] rounded-xl px-3 py-2 text-xs text-white font-bold"
                />
                <button
                  onClick={() => setDiscountIsPercent(!discountIsPercent)}
                  className="px-3 py-2 bg-[#262D3D] rounded-xl text-xs font-extrabold text-amber-400"
                >
                  {discountIsPercent ? "%" : "$ USD"}
                </button>
                <button
                  onClick={() => { setDiscountType("custom"); setShowDiscountModal(false); }}
                  className="px-4 py-2 bg-[#eb660c] text-white rounded-xl text-xs font-black"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TABLET-FRIENDLY MODIFIER MODAL */}
      {activeTabModal === "customization" && currentProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-full max-w-lg p-6 space-y-5 text-white shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-[#262D3D] pb-3 flex-shrink-0">
              <div>
                <h3 className="font-extrabold text-base text-white">{currentProduct.name}</h3>
                <span className="text-xs font-bold text-[#eb660c]">${(currentProduct.unit_price_usd || 0).toFixed(2)}</span>
              </div>
              <button
                onClick={() => { setActiveTabModal(null); setCurrentProduct(null); }}
                className="text-gray-400 hover:text-white text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            {customizationError && (
              <div className="bg-red-950/80 border border-red-500/50 text-red-200 text-xs px-3.5 py-2 rounded-xl font-bold flex-shrink-0">
                {customizationError}
              </div>
            )}

            {/* MODIFIER OPTIONS LIST */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {currentProduct.customizations && currentProduct.customizations.length > 0 ? (
                (() => {
                  const grouped = currentProduct.customizations.reduce((acc, c) => {
                    const group = c.option_group_name || (c.customization_type === "remove" ? "Remove Ingredients" : "Custom Options");
                    if (!acc[group]) acc[group] = [];
                    acc[group].push(c);
                    return acc;
                  }, {});

                  return Object.entries(grouped).map(([groupName, opts]) => {
                    const isMultiSelect = opts.length > 1 && !opts[0]?.option_group_name?.toLowerCase().includes("drink");
                    const isRequired = opts[0]?.is_required || groupName.toLowerCase().includes("drink");

                    return (
                      <div key={groupName} className="space-y-2 bg-[#0F1115] p-3.5 rounded-xl border border-[#262D3D]">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-gray-200 uppercase tracking-wider">{groupName}</span>
                          {isRequired && <span className="text-[10px] font-extrabold px-2 py-0.5 bg-red-950/80 text-red-300 border border-red-500/40 rounded">REQUIRED</span>}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {opts.map((opt) => {
                            const isSelected = selectedCustomizations.some((c) => c.id === opt.id);
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleToggleOption(opt, isMultiSelect)}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                                  isSelected
                                    ? "bg-[#eb660c] text-white border-[#eb660c] shadow-md shadow-[#eb660c]/20"
                                    : "bg-[#181C24] text-gray-300 border-[#262D3D] hover:bg-[#262D3D]"
                                }`}
                              >
                                {isSelected ? "✓ " : ""}{opt.name || opt.ingredient}
                                {opt.price > 0 ? ` (+$${opt.price.toFixed(2)})` : ""}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()
              ) : (
                <div className="text-center py-6 text-xs text-gray-400">No extra options for this product.</div>
              )}

              {/* Special Note */}
              <div className="space-y-1.5 pt-2 border-t border-[#262D3D]">
                <label className="text-xs font-bold text-gray-300 block">Special Preparation Note:</label>
                <input
                  type="text"
                  placeholder="e.g. Extra toasted, sauce on the side..."
                  value={itemNote}
                  onChange={(e) => setItemNote(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#262D3D] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#eb660c]"
                />
              </div>
            </div>

            {/* MODAL BOTTOM ACTION */}
            <div className="flex gap-3 pt-3 border-t border-[#262D3D] flex-shrink-0">
              <button
                type="button"
                onClick={() => { setActiveTabModal(null); setCurrentProduct(null); }}
                className="px-5 py-3 bg-[#262D3D] hover:bg-[#323B4E] text-white font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomizationToCart}
                className="flex-1 py-3 bg-[#eb660c] hover:bg-[#d55909] text-white font-black rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {(() => {
                  let extraCost = 0;
                  selectedCustomizations.forEach((c) => { if (c.price) extraCost += c.price; });
                  const finalUnitPrice = (currentProduct.unit_price_usd || 0) + extraCost;
                  return `ADD TO TICKET — $${(finalUnitPrice * customizationQty).toFixed(2)}`;
                })()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS SETTINGS MODAL */}
      {activeTabModal === "settings" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-full max-w-md p-6 space-y-5 text-white shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#262D3D] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">⚙️</span>
                <h3 className="font-extrabold text-base">POS System Settings</h3>
              </div>
              <button onClick={() => setActiveTabModal(null)} className="text-gray-400 hover:text-white text-xl font-bold p-1">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-3.5 space-y-2">
                <span className="font-extrabold text-[#eb660c] text-xs block uppercase tracking-wider">Store Operational Control:</span>
                <button
                  onClick={() => {
                    setActiveTabModal(null);
                    fetchBranchStatusAndPrompt();
                    setShowBranchStatusModal(true);
                  }}
                  className="w-full py-2.5 bg-[#262D3D] hover:bg-[#323B4E] text-white font-extrabold rounded-xl transition-all text-xs border border-[#3A455C] flex items-center justify-center gap-2"
                >
                  ⚙️ Change Store Opening / Closure Status
                </button>
              </div>

              <div className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-3.5 space-y-2">
                <span className="font-extrabold text-amber-400 text-xs block uppercase tracking-wider">Thermal Printer Configuration:</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] text-gray-400 block mb-1">Print Server IP</label>
                    <input
                      type="text"
                      value={printServerIP}
                      onChange={(e) => setPrintServerIP(e.target.value)}
                      placeholder="192.168.18.195"
                      className="w-full bg-[#181C24] border border-[#262D3D] rounded-lg px-2.5 py-1.5 text-xs text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Port</label>
                    <input
                      type="number"
                      value={printServerPort}
                      onChange={(e) => setPrintServerPort(Number(e.target.value))}
                      className="w-full bg-[#181C24] border border-[#262D3D] rounded-lg px-2.5 py-1.5 text-xs text-white font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-3.5 flex items-center justify-between text-gray-400">
                <span>POS Tablet System Version</span>
                <span className="font-bold text-white bg-[#262D3D] px-2 py-0.5 rounded text-[11px]">v2.5.4</span>
              </div>
            </div>

            <button
              onClick={() => setActiveTabModal(null)}
              className="w-full py-3 bg-[#eb660c] hover:bg-[#d55909] text-white font-extrabold rounded-xl transition-all shadow-lg"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* BRANCH STATUS MODAL */}
      {showBranchStatusModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-full max-w-md p-6 space-y-5 text-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-[#262D3D] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">⚙️</span>
                <div>
                  <h3 className="font-extrabold text-base text-white">Store Operational Status</h3>
                  <p className="text-[11px] text-gray-400 font-medium">{branchStatus?.name || "Cloud Kitchen"}</p>
                </div>
              </div>
              <button
                onClick={() => setShowBranchStatusModal(false)}
                className="text-gray-400 hover:text-white text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className={`p-4 rounded-xl border flex items-center justify-between ${realtimeStatus.badgeClass}`}>
              <div>
                <span className="text-xs uppercase font-extrabold tracking-wider block opacity-75">Real-Time Store Status</span>
                <span className="text-sm font-black block mt-0.5">{realtimeStatus.description}</span>
              </div>
              {!realtimeStatus.isOpen && (
                <span className="px-2.5 py-1 rounded-lg bg-black/40 text-xs font-bold border border-white/10 shrink-0 ml-2">
                  Notice Active
                </span>
              )}
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  1. Orders Active / Operational Status
                </label>
                <select
                  value={posOperationalStatus}
                  onChange={(e) => setPosOperationalStatus(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#262D3D] rounded-xl px-3.5 py-2.5 text-xs font-bold text-white shadow-inner focus:outline-none focus:border-[#eb660c]"
                >
                  <option value="open">🟢 Normal / Auto Schedule (Open during operating hours)</option>
                  <option value="closed_hour">⏳ Closed For an Hour (60 Minutes)</option>
                  <option value="closed_today">🌙 Closed For Today (Until Midnight)</option>
                  <option value="closed">🔴 Closed (Hidden from Customers & POS)</option>
                </select>
              </div>

              {posOperationalStatus !== "open" && (
                <div className="pt-2 border-t border-[#262D3D]">
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                    2. Closure Reason
                  </label>
                  <select
                    value={posClosureReason}
                    onChange={(e) => setPosClosureReason(e.target.value)}
                    className="w-full bg-[#0F1115] border border-[#262D3D] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white shadow-inner focus:outline-none focus:border-[#eb660c]"
                  >
                    <option value="Overloaded">⚡ Overloaded (High order volume)</option>
                    <option value="Out of Stock">📦 Out of Stock</option>
                    <option value="Maintenance">🛠️ Maintenance</option>
                    <option value="Holiday">🌴 Holiday</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveBranchStatusFromPos}
                disabled={isSavingBranchStatus}
                className={`flex-1 py-3 font-extrabold rounded-xl text-xs transition-all shadow-lg text-white ${
                  isSavingBranchStatus ? "bg-gray-600 cursor-not-allowed" : "bg-[#eb660c] hover:bg-[#d55909]"
                }`}
              >
                {isSavingBranchStatus ? "Saving Status..." : "Save Status Changes"}
              </button>
              <button
                onClick={() => setShowBranchStatusModal(false)}
                className="px-4 py-3 bg-[#262D3D] hover:bg-[#323B4E] text-white font-bold rounded-xl text-xs"
              >
                Keep Current
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP INCOMING ORDERS QUEUE MODAL */}
      {activeTabModal === "incoming" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col text-white shadow-2xl">
            <div className="p-4 border-b border-[#262D3D] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xl">📱</span>
                <h3 className="font-extrabold text-base">Incoming WhatsApp Orders Queue</h3>
              </div>
              <button onClick={() => setActiveTabModal(null)} className="text-gray-400 hover:text-white font-bold p-1">✕</button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {pendingOrders.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">No pending WhatsApp orders right now.</div>
              ) : (
                pendingOrders.map((o) => (
                  <div key={o.id} className="p-3.5 bg-[#0F1115] border border-[#262D3D] rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-black text-white text-sm">Order #{o.id} • {o.customer_name || "WhatsApp Customer"}</div>
                      <div className="text-gray-400 mt-0.5">{o.customer_phone} • {o.delivery_address || "Pickup"}</div>
                      <div className="text-[#eb660c] font-black mt-1">${parseFloat(o.total_amount || 0).toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRejectPendingOrder(o.id)}
                        disabled={rejectingOrderId === o.id}
                        className={`px-3 py-2 border rounded-xl font-bold transition-all disabled:opacity-50 ${
                          confirmingRejectId === o.id
                            ? "bg-red-600 text-white border-red-400 animate-pulse font-black"
                            : "bg-rose-950/60 text-rose-300 border-rose-500/40 hover:bg-rose-900/80"
                        }`}
                      >
                        {rejectingOrderId === o.id
                          ? "Rejecting..."
                          : confirmingRejectId === o.id
                          ? "Tap again to Reject"
                          : "Reject"}
                      </button>
                      <button
                        onClick={() => {
                          setEditingOrderId(o.id);
                          setCustomerName(o.customer_name || "");
                          setCustomerPhone(o.customer_phone || "");
                          setDeliveryAddress(o.delivery_address || "");
                          setSelectedChannel("WhatsApp");
                          setTicketItems((o.items || []).map((i) => ({
                            product_id: i.product_id || i.id,
                            name: i.product_name || i.name,
                            unit_price: i.unit_price || 0,
                            qty: i.quantity || i.qty || 1,
                            selectedCustomizations: i.customizations ? (Array.isArray(i.customizations) ? i.customizations.map(c => typeof c === 'string' ? {name: c} : c) : [{name: i.customizations}]) : [],
                            note: i.comment || ""
                          })));
                          setActiveTabModal(null);
                        }}
                        className="px-4 py-2 bg-[#eb660c] hover:bg-[#d55909] text-white font-black rounded-xl shadow-md"
                      >
                        Load to Ticket ➔
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
          <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-full max-w-xl max-h-[80vh] flex flex-col text-white shadow-2xl">
            <div className="p-4 border-b border-[#262D3D] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xl">⏸️</span>
                <h3 className="font-extrabold text-base">Held Orders ({heldOrders.length})</h3>
              </div>
              <button onClick={() => setActiveTabModal(null)} className="text-gray-400 hover:text-white font-bold p-1">✕</button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {heldOrders.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">No held orders right now.</div>
              ) : (
                heldOrders.map((o) => (
                  <div key={o.id} className="p-3.5 bg-[#0F1115] border border-[#262D3D] rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-black text-white text-sm">Held Order #{o.id}</div>
                      <div className="text-gray-400 mt-0.5">{o.customer_name || "Walk-in"} • ${parseFloat(o.total_amount || 0).toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteHeldOrder(o.id)}
                        disabled={deletingHeldOrderId === o.id}
                        className={`px-3 py-2 border rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-1 ${
                          confirmingDeleteHeldId === o.id
                            ? "bg-red-600 text-white border-red-400 animate-pulse font-black"
                            : "bg-rose-950/60 text-rose-300 border-rose-500/40 hover:bg-rose-900/80"
                        }`}
                      >
                        <span>🗑️</span>
                        <span>
                          {deletingHeldOrderId === o.id
                            ? "Deleting..."
                            : confirmingDeleteHeldId === o.id
                            ? "Tap again to Delete"
                            : "Delete Order"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingOrderId(o.id);
                          setCustomerName(o.customer_name || "");
                          setCustomerPhone(o.customer_phone || "");
                          setDeliveryAddress(o.delivery_address || "");
                          setSelectedChannel(o.order_source || "POS");
                          setTicketItems((o.items || []).map((i) => ({
                            product_id: i.product_id || i.id,
                            name: i.product_name || i.name,
                            unit_price: i.unit_price || 0,
                            qty: i.quantity || i.qty || 1,
                            selectedCustomizations: i.customizations ? (Array.isArray(i.customizations) ? i.customizations.map(c => typeof c === 'string' ? {name: c} : c) : [{name: i.customizations}]) : [],
                            note: i.comment || ""
                          })));
                          setActiveTabModal(null);
                        }}
                        className="px-4 py-2 bg-[#eb660c] hover:bg-[#d55909] text-white font-black rounded-xl shadow-md flex items-center gap-1"
                      >
                        <span>Restore Ticket</span>
                        <span>➔</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ORDER HISTORY MODAL */}
      {activeTabModal === "history" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col text-white shadow-2xl">
            <div className="p-4 border-b border-[#262D3D] flex justify-between items-center">
              <h3 className="font-extrabold text-base">📜 Order History</h3>
              <button onClick={() => setActiveTabModal(null)} className="text-gray-400 hover:text-white font-bold p-1">✕</button>
            </div>
            <div className="p-3 bg-[#0F1115] border-b border-[#262D3D]">
              <input
                type="text"
                placeholder="Search history by Order #, Customer Name, Phone..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className="w-full bg-[#181C24] border border-[#262D3D] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 font-medium focus:outline-none focus:border-[#eb660c]"
              />
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              {(() => {
                const filtered = completedOrdersHistory.filter((o) => {
                  if (!historySearchQuery.trim()) return true;
                  const q = historySearchQuery.toLowerCase();
                  return (
                    String(o.id).includes(q) ||
                    (o.customer_name || "").toLowerCase().includes(q) ||
                    (o.customer_phone || "").includes(q) ||
                    (o.order_source || "").toLowerCase().includes(q)
                  );
                });

                if (filtered.length === 0) {
                  return <div className="py-12 text-center text-gray-400 text-xs">No completed orders found.</div>;
                }

                // Group orders by date
                const grouped = {};
                const sorted = [...filtered].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

                sorted.forEach((order) => {
                  const d = order.created_at ? new Date(order.created_at) : new Date();
                  const today = new Date();
                  const yesterday = new Date();
                  yesterday.setDate(today.getDate() - 1);

                  const isToday = d.toDateString() === today.toDateString();
                  const isYesterday = d.toDateString() === yesterday.toDateString();

                  const formattedDateStr = d.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });

                  let dateHeader = `📅 ${formattedDateStr}`;
                  if (isToday) dateHeader = `📅 Today • ${formattedDateStr}`;
                  else if (isYesterday) dateHeader = `📅 Yesterday • ${formattedDateStr}`;

                  if (!grouped[dateHeader]) grouped[dateHeader] = [];
                  grouped[dateHeader].push(order);
                });

                return Object.entries(grouped).map(([dateGroup, ordersGroup]) => (
                  <div key={dateGroup} className="space-y-3">
                    {/* DATE GROUP HEADER */}
                    <div className="sticky top-0 z-10 bg-[#14171F] py-2 px-3 border border-[#262D3D] rounded-xl text-xs font-black text-[#eb660c] flex items-center justify-between shadow-md">
                      <span className="truncate">{dateGroup}</span>
                      <span className="text-[10px] font-extrabold text-gray-300 bg-[#181C24] px-2.5 py-0.5 rounded-lg border border-[#262D3D] shrink-0">
                        {ordersGroup.length} Order{ordersGroup.length > 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* ORDERS IN THIS DATE GROUP */}
                    <div className="space-y-3 pl-1">
                      {ordersGroup.map((order) => (
                        <div key={order.id} className="p-4 bg-[#0F1115] border border-[#262D3D] rounded-xl space-y-3 text-xs shadow-sm hover:border-[#3A455C] transition-all">
                          {/* Header Row */}
                          <div className="flex justify-between items-start border-b border-[#262D3D]/60 pb-2.5">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-white text-base">Order #{order.id}</span>
                                <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold ${
                                  order.order_source === "Toters" ? "bg-[#00C49F] text-black" :
                                  order.order_source === "WhatsApp" ? "bg-[#25D366] text-black" :
                                  order.order_source === "NokNok" ? "bg-[#FF5A5F] text-white" :
                                  order.order_source === "App" ? "bg-[#3B82F6] text-white" :
                                  "bg-[#eb660c] text-white"
                                }`}>
                                  {order.order_source || "POS"}
                                </span>
                                <span className="text-[10px] bg-[#262D3D] text-gray-300 px-2 py-0.5 rounded font-bold uppercase">
                                  {order.order_type || "pickup"}
                                </span>
                                {order.status && (
                                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-extrabold uppercase">
                                    {order.status}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-400 font-medium">
                                🕒 {order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Time N/A"} • Payment: <strong className="text-white">{order.payment_method || "Cash"}</strong>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-xl font-black text-[#eb660c]">${parseFloat(order.total_amount || 0).toFixed(2)}</div>
                              <button
                                onClick={() => handleReprintOrder(order)}
                                className="mt-1 px-3 py-1.5 bg-[#eb660c] hover:bg-[#d55909] text-white rounded-xl text-[11px] font-extrabold shadow-sm flex items-center gap-1.5 ml-auto"
                              >
                                🖨️ Reprint Receipt
                              </button>
                            </div>
                          </div>

                          {/* Customer Info Box */}
                          {(order.customer_name || order.customer_phone || order.delivery_address) && (
                            <div className="text-xs text-gray-300 bg-[#181C24] p-3 rounded-xl border border-[#262D3D] space-y-1">
                              {order.customer_name && <div>👤 <strong>Customer:</strong> {order.customer_name}</div>}
                              {order.customer_phone && <div>📞 <strong>Phone:</strong> {order.customer_phone}</div>}
                              {order.delivery_address && <div>🏠 <strong>Delivery Address:</strong> {order.delivery_address}</div>}
                            </div>
                          )}

                          {/* Items Summary */}
                          <div className="space-y-1.5">
                            <div className="font-extrabold text-gray-300 text-[11px] uppercase tracking-wider">Ordered Items:</div>
                            <div className="space-y-1">
                              {(order.items || []).map((item, idx) => (
                                <div key={idx} className="bg-[#181C24] border border-[#262D3D] p-2 rounded-lg flex items-start justify-between text-xs">
                                  <div>
                                    <div className="font-bold text-white">
                                      <span className="text-[#eb660c] font-black">{item.quantity || item.qty}x</span> {item.product_name || item.name}
                                    </div>
                                    {item.customizations && (() => {
                                      const { addons, removals } = partitionCustomizations(item.customizations);
                                      return (
                                        <div className="text-[10px] space-y-0.5 mt-0.5">
                                          {addons.length > 0 && (
                                            <div className="text-gray-300">
                                              <strong className="text-gray-400">+ Addons:</strong> {addons.join(", ")}
                                            </div>
                                          )}
                                          {removals.length > 0 && (
                                            <div className="text-rose-400 font-extrabold">
                                              <strong>REMOVE:</strong> {removals.join(", ")}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                    {item.comment && (
                                      <div className="text-[10px] text-amber-300 italic">Note: {item.comment}</div>
                                    )}
                                  </div>
                                  <span className="font-bold text-gray-200">${((item.unit_price || 0) * (item.quantity || item.qty || 1)).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Financial Summary Bar */}
                          <div className="bg-[#181C24] border border-[#262D3D] p-2.5 rounded-xl flex items-center justify-between text-xs text-gray-300 font-semibold">
                            <div>Subtotal: <strong className="text-white">${parseFloat(order.subtotal_amount || 0).toFixed(2)}</strong></div>
                            {parseFloat(order.discount_amount || 0) > 0 && (
                              <div className="text-amber-400">Discount: <strong>-${parseFloat(order.discount_amount).toFixed(2)}</strong></div>
                            )}
                            <div>Delivery Fee: <strong className={parseFloat(order.delivery_fee || 0) > 0 ? "text-blue-400" : "text-gray-400"}>${parseFloat(order.delivery_fee || 0).toFixed(2)}</strong></div>
                            <div>Total: <strong className="text-[#eb660c] font-black text-sm">${parseFloat(order.total_amount || 0).toFixed(2)}</strong></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT CONFIRMATION & DRIVER DISPATCH MODAL */}
      {activeTabModal === "receipt" && lastCompletedOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-full max-w-md p-6 space-y-4 text-white shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-400 text-2xl flex items-center justify-center mx-auto font-black">
              ✓
            </div>
            <div>
              <h3 className="font-black text-lg text-white">Order #{lastCompletedOrder.id} Approved & Saved!</h3>
              <p className="text-xs text-gray-400 mt-1">Sent to thermal printer & recorded in database.</p>
            </div>

            <div className="p-3.5 bg-[#0F1115] border border-[#262D3D] rounded-xl text-xs space-y-1 text-left">
              <div className="flex justify-between font-bold text-white">
                <span>Total Amount:</span>
                <span className="text-[#eb660c]">${parseFloat(lastCompletedOrder.total_amount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Payment Method:</span>
                <span>{lastCompletedOrder.payment_method || "Cash"}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Order Type / Channel:</span>
                <span>{lastCompletedOrder.order_type || "delivery"} • {lastCompletedOrder.order_source || "POS"}</span>
              </div>
            </div>

            {/* DRIVER DISPATCH SECTION FOR DELIVERY ORDERS */}
            {lastCompletedOrder.order_type === "delivery" && (
              <div className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-3.5 space-y-2.5 text-center">
                <div className="flex justify-between items-center text-xs font-bold text-gray-300">
                  <span className="flex items-center gap-1.5">🛵 Request Driver (+961 3 826 136)</span>
                  {dispatchStatusMsg ? (
                    <span className="text-[10px] bg-[#25D366]/20 text-[#25D366] px-2.5 py-0.5 rounded-full font-black animate-pulse">
                      {dispatchStatusMsg}
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#25D366] font-extrabold">⚡ Instant Dispatch</span>
                  )}
                </div>
                <div className="text-[11px] text-gray-400 font-medium text-left">
                  Select arrival ETA time to send WhatsApp to driver (+961 3 826 136):
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {["Now", "15", "20", "30", "45"].map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => handleSendDeliveryWhatsApp(time, "silent")}
                      className="py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-black font-black text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-0.5"
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

            <button
              onClick={() => setActiveTabModal(null)}
              className="w-full py-3.5 bg-[#eb660c] hover:bg-[#d55909] text-white font-black rounded-xl text-xs transition-all shadow-lg"
            >
              New Order ➔
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
