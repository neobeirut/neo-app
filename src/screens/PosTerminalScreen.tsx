
import React, { useState, useEffect, useRef, useMemo } from "react";
import { api } from "../api/client";
import { supabase, getGlobalRestaurantId, setGlobalRestaurantId } from "../api/supabase";

import { resolveCommerceBranchLink, getBranchCapabilities } from "../pos/services/branchMapping";
import type { CommerceBranchLink } from "../pos/types/commerce";
import type { BranchCapabilities } from "../pos/services/branchMapping";
import { TablesScreen, getOrCreateTableAndSession, loadFloorState, closeTableSession } from "../pos/tables";
import type { PosTable } from "../pos/tables";
import { BranchMappingAlert } from "../pos/components/BranchMappingAlert";
import { usePos86 } from "../pos/hooks/usePos86";
import { usePosUpsell } from "../pos/hooks/usePosUpsell";
import { UpsellRecommendationBar } from "../pos/components/UpsellRecommendationBar";
import { DiscountManagerModal } from "../pos/components/DiscountManagerModal";
import {
  type PosDiscountRule,
  getRestaurantDiscounts,
  getApplicableDiscounts,
  calculateDiscountAmount
} from "../pos/services/discountService";
import { usePosShift } from "../pos/hooks/usePosShift";
import { OpenShiftModal } from "../pos/components/OpenShiftModal";
import { CloseShiftModal } from "../pos/components/CloseShiftModal";
import { ShiftReportModal } from "../pos/components/ShiftReportModal";
import { DailyBranchControlScreen } from "../pos/components/DailyBranchControlScreen";
import { PilotIncidentLog } from "../pos/components/PilotIncidentLog";
import type { PilotIncident } from "../pos/components/PilotIncidentLog";
import type { ShiftReconciliationSummary } from "../pos/services/shiftReconciliationService";
import { calculateShiftReconciliation } from "../pos/services/shiftReconciliationService";
import { ShiftStatusBadge } from "../pos/components/ShiftStatusBadge";
import { executeVoidTransaction } from "../pos/services/voidBridge";
import type { CanceledItemDetail } from "../pos/services/voidBridge";
import { VoidItemModal } from "../pos/components/VoidItemModal";
import { OrdersHubScreen } from "../pos/orders/OrdersHubScreen";
import { PaymentModal, RefundModal } from "../pos/payments";
import { TerminalPaymentModal } from "../pos/components/TerminalPaymentModal";
import { fireOrderRound, getBranchLocationKey } from "../pos/kds";

interface PosTerminalScreenProps {
  user?: any;
  onExit?: () => void;
}

import { COMMERCE_API_BASE } from "../pos/config";
import { fetchPosCatalog } from "../pos/services/posCatalogService";
import { fetchPosScreens, savePosScreens, TILE_COLORS, calculateDynamicGrid, getGridButtonDensity } from "../pos/services/posScreenService";
import type { PosScreen, PosScreenButton } from "../pos/types/posScreen";
import PosPinScreen from "../pos/components/PosPinScreen";


const FAVORITE_PRODUCT_NAMES = [
  "caesar loaded wrap",
  "crispy loaded wrap",
  "beef quesa",
  "fries",
  "pepsi",
  "diet pepsi",
  "chocolate load",
  "banoffee overload",
  // Bistro popular items
  "boulette aux trois fromages",
  "steak-frites",
  "risotto",
  "lemonade",
  "burger",
  "espresso",
  "poulet croquant",
  "salade"
];

const partitionCustomizations = (customizations) => {
  const addons = [];
  const removals = [];

  if (!customizations) return { addons, removals };

  let parsed = customizations;
  // Unwrap nested JSON strings if any (e.g. from DB or nested serialization)
  while (typeof parsed === "string") {
    const trimmed = parsed.trim();
    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        break;
      }
    } else {
      break;
    }
  }

  let itemsList = [];
  if (Array.isArray(parsed)) {
    itemsList = parsed;
  } else if (typeof parsed === "string") {
    itemsList = parsed.split(",").map((s) => s.trim());
  } else if (parsed && typeof parsed === "object") {
    itemsList = [parsed];
  }

  itemsList.forEach((c) => {
    if (!c) return;
    let obj = c;
    if (typeof c === "string") {
      let str = c.trim();
      if (str.startsWith("{") && str.endsWith("}")) {
        try {
          obj = JSON.parse(str);
        } catch (e) {
          obj = { name: str };
        }
      } else {
        obj = { name: str };
      }
    }

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
export default function PosTerminalScreen({ user, onExit }: PosTerminalScreenProps) {
  // FLOW Branch Mapping State
  const [commerceBranchLink, setCommerceBranchLink] = useState<CommerceBranchLink | null>(null);
  const [branchMappingError, setBranchMappingError] = useState<string | null>(null);
  const [isResolvingBranch, setIsResolvingBranch] = useState(true);

  // Dynamic Restaurant & Branch Identity Resolution (Lifted to top for strict tenant isolation)
  const currentRestaurantId =
    commerceBranchLink?.restaurant_id ||
    user?.restaurant_id ||
    user?.restaurants?.id ||
    (user?.email?.toLowerCase().includes('bistro') || user?.branch?.toLowerCase().includes('bistro') || user?.name?.toLowerCase().includes('bistro')
      ? '4c0ed960-e459-42c4-962f-41229a2d3783'
      : getGlobalRestaurantId() || '79256f11-a9f8-4fec-901d-69baf929762d');

  const currentRestaurantName =
    user?.restaurants?.name ||
    (currentRestaurantId === '4c0ed960-e459-42c4-962f-41229a2d3783' ? 'The Bistro' : 'Neo Beirut');

  // Sync global restaurant context for Supabase tenant header
  useEffect(() => {
    if (currentRestaurantId) {
      setGlobalRestaurantId(currentRestaurantId);
    }
  }, [currentRestaurantId]);

  // Available Commerce Branches & Selection State
  const [availableCommerceBranches, setAvailableCommerceBranches] = useState<any[]>([]);
  const [isBranchSwitcherOpen, setIsBranchSwitcherOpen] = useState(false);
  const [selectedTerminalBranch, setSelectedTerminalBranch] = useState<string | null>(() => {
    try {
      return localStorage.getItem('flow_pos_selected_branch') || null;
    } catch {
      return null;
    }
  });

  // Query all active commerce branch links strictly for current restaurant
  useEffect(() => {
    const fetchAvailableBranches = async () => {
      try {
        let query = supabase.from('commerce_branch_links').select('*').eq('active', true);
        if (currentRestaurantId) {
          query = query.eq('restaurant_id', currentRestaurantId);
        }
        const { data } = await query;
        if (data && data.length > 0) {
          setAvailableCommerceBranches(data);
        }
      } catch (err) {
        console.warn("Could not load available commerce branches:", err);
      }
    };
    fetchAvailableBranches();
  }, [currentRestaurantId]);

  // Main POS Navigation: SELL vs TABLES vs ORDERS
  const [posActiveView, setPosActiveView] = useState<'sell' | 'tables' | 'orders'>('sell');
  const [branchCapabilities, setBranchCapabilities] = useState<BranchCapabilities | null>(null);
  const [activeTableContext, setActiveTableContext] = useState<{
    orderId?: number | null;
    tableCode: string;
    sessionId?: string;
    guestCount?: number;
    waiterName?: string;
    isExistingOccupied?: boolean;
  } | null>(null);

  // Quick Table Input State (Type table # on-demand)
  const [quickTableInput, setQuickTableInput] = useState("");
  const [isQuickTableLoading, setIsQuickTableLoading] = useState(false);

  // Live Floor Tables
  const [branchFloorTables, setBranchFloorTables] = useState<PosTable[]>([]);

  // Cashier PIN Lock & Fast Switch States
  const [activeCashier, setActiveCashier] = useState<any>(user || null);
  const [isCashierModalOpen, setIsCashierModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // Branch Resolution Logic
  const resolveActiveBranch = async (explicitBranch?: string) => {
    setIsResolvingBranch(true);
    setBranchMappingError(null);

    // Determine candidate branch:
    // 1. Explicit argument
    // 2. Persisted terminal selection
    // 3. Active cashier's assigned branch (if not 'All')
    // 4. User's assigned branch (if not 'All')
    let branchToResolve = explicitBranch || selectedTerminalBranch;

    // Validate that candidate branch belongs to current restaurant if available
    if (availableCommerceBranches.length > 0 && branchToResolve) {
      const match = availableCommerceBranches.some(
        (b) => b.flow_branch_name?.toLowerCase() === branchToResolve?.toLowerCase() ||
               b.flow_branch_id === branchToResolve ||
               b.external_branch_name?.toLowerCase() === branchToResolve?.toLowerCase()
      );
      if (!match) {
        // Switch to the first valid branch for this restaurant
        branchToResolve = availableCommerceBranches[0].flow_branch_name;
        setSelectedTerminalBranch(branchToResolve);
      }
    }

    if (!branchToResolve || branchToResolve.toLowerCase() === 'all') {
      if (activeCashier?.branch && activeCashier.branch.toLowerCase() !== 'all') {
        branchToResolve = activeCashier.branch;
      } else if (user?.branch && user.branch.toLowerCase() !== 'all') {
        branchToResolve = user.branch;
      } else if (availableCommerceBranches.length > 0) {
        branchToResolve = availableCommerceBranches[0].flow_branch_name;
      } else {
        branchToResolve = currentRestaurantId === '4c0ed960-e459-42c4-962f-41229a2d3783' ? 'Badaro (Bistro)' : 'Badaro';
      }
    }

    if (!branchToResolve) {
      setCommerceBranchLink(null);
      setBranchMappingError("No active branch selected for this terminal.");
      setIsResolvingBranch(false);
      return;
    }

    const { link, error } = await resolveCommerceBranchLink(branchToResolve, 'ovrload');
    if (link) {
      // Validate that the resolved branch belongs to the user's active restaurant (unless superadmin)
      if (currentRestaurantId && link.restaurant_id && link.restaurant_id !== currentRestaurantId && user?.role?.toLowerCase() !== 'superadmin') {
        setCommerceBranchLink(null);
        setSelectedTerminalBranch(null);
        try { localStorage.removeItem('flow_pos_selected_branch'); } catch {}
        setBranchMappingError("Selected branch does not belong to your active restaurant.");
        setIsResolvingBranch(false);
        return;
      }

      setCommerceBranchLink(link);
      setSelectedTerminalBranch(link.flow_branch_name);
      try { localStorage.setItem('flow_pos_selected_branch', link.flow_branch_name); } catch {}
      setBranchMappingError(null);
    } else {
      setCommerceBranchLink(null);
      setBranchMappingError(error || `Branch "${branchToResolve}" has no mapped commerce branch.`);
    }

    // Query authoritative branch capabilities (dine_in, table_service)
    const branchIdentifier = link?.flow_branch_id || user?.branch_id || branchToResolve;
    const { success: capSuccess, capabilities } = await getBranchCapabilities(branchIdentifier);
    if (capSuccess && capabilities) {
      setBranchCapabilities(capabilities);
      if (!capabilities.table_service && posActiveView === 'tables') {
        setPosActiveView('sell');
      }
    } else {
      setBranchCapabilities(null);
    }

    setIsResolvingBranch(false);
  };

  const handleSelectTerminalBranch = async (branchName: string) => {
    setSelectedTerminalBranch(branchName);
    try {
      localStorage.setItem('flow_pos_selected_branch', branchName);
    } catch {}
    if (activeCashier) {
      setActiveCashier((prev: any) => prev ? { ...prev, branch: branchName } : null);
    }
    setIsBranchSwitcherOpen(false);
    await resolveActiveBranch(branchName);
  };

  useEffect(() => {
    resolveActiveBranch();
  }, [user?.branch, activeCashier?.branch, user?.restaurant_id]);

  // FLOW 86 Dynamic Availability Hook
  const { isProduct86d, unavailableProductIds, refetch86 } = usePos86(
    commerceBranchLink?.flow_branch_name || user?.branch || "Cloud Kitchen"
  );

  // Persistent POS terminal identity (from localStorage or hardware station ID)
  const [persistentTerminalId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('flow_pos_terminal_id');
      if (stored && stored.trim()) return stored.trim();
      const generated = 'FLOW-TERM-' + (commerceBranchLink?.location_key || '01').toUpperCase();
      localStorage.setItem('flow_pos_terminal_id', generated);
      return generated;
    } catch {
      return 'FLOW-TERM-01';
    }
  });

  // Dynamic Branch Identity Resolution
  const currentBranchId = commerceBranchLink?.flow_branch_id || branchCapabilities?.branchId || "";
  const currentBranchName =
    commerceBranchLink?.flow_branch_name ||
    selectedTerminalBranch ||
    user?.branch ||
    activeCashier?.branch ||
    (currentRestaurantId === '4c0ed960-e459-42c4-962f-41229a2d3783' ? 'Badaro (Bistro)' : 'Badaro');

  const refreshFloorTables = async () => {
    const flowBranchId = currentBranchId || commerceBranchLink?.flow_branch_id || branchCapabilities?.branchId || "9c214659-9cc7-4f33-b115-cbbb8a823a94";
    if (flowBranchId) {
      try {
        const res = await loadFloorState(flowBranchId);
        if (res.success && res.tables) {
          setBranchFloorTables(res.tables);
        }
      } catch (err) {
        console.warn("Could not load floor tables for keypad:", err);
      }
    }
  };

  useEffect(() => {
    refreshFloorTables();
  }, [currentBranchId, commerceBranchLink, branchCapabilities]);

  // FLOW Shift Cash State & Bridge
  const {
    activeShift,
    isShiftOpen,
    loading: shiftLoading,
    isOpenShiftModalOpen,
    setIsOpenShiftModalOpen,
    isCloseShiftModalOpen,
    setIsCloseShiftModalOpen,
    isShiftReportModalOpen,
    setIsShiftReportModalOpen,
    reportModalMode,
    setReportModalMode,
    openXReport,
    handleOpenShift,
    handleCloseShift
  } = usePosShift(
    currentBranchName,
    activeCashier?.name || user?.name || "Cashier",
    persistentTerminalId,
    currentBranchId,
    currentRestaurantId
  );

  // Auto popup for closed shift after cashier logs in with PIN
  const [hasPromptedShiftClosed, setHasPromptedShiftClosed] = useState(false);

  useEffect(() => {
    if (!shiftLoading && !isShiftOpen && !hasPromptedShiftClosed) {
      setHasPromptedShiftClosed(true);
      setIsOpenShiftModalOpen(true);
    }
  }, [shiftLoading, isShiftOpen, hasPromptedShiftClosed]);


  // Phase 6 Shift Closing & Reporting States
  const [lastClosedShift, setLastClosedShift] = useState<any>(null);
  const [shiftReportData, setShiftReportData] = useState<ShiftReconciliationSummary | null>(null);
  const [isDailyControlOpen, setIsDailyControlOpen] = useState(false);
  const [pilotIncidents, setPilotIncidents] = useState<PilotIncident[]>([]);

  const recordIncident = (
    category: 'PRINTER' | 'KDS' | 'COMMERCE_SYNC' | 'PAYMENT' | 'OCC_CONFLICT' | 'TABLE_SYNC',
    severity: 'WARNING' | 'CRITICAL',
    message: string,
    details?: any
  ) => {
    const incident: PilotIncident = {
      id: 'inc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      category,
      severity,
      message,
      details
    };
    setPilotIncidents(prev => [incident, ...prev.slice(0, 19)]);
  };

  // FLOW Void Management State
  const [voidModalState, setVoidModalState] = useState<{
    isOpen: boolean;
    orderId: string | number;
    items: CanceledItemDetail[];
    voidType: 'item_void' | 'order_cancellation' | 'refund';
    onSuccess?: () => void;
  }>({
    isOpen: false,
    orderId: '',
    items: [],
    voidType: 'order_cancellation'
  });

  const handleExecuteVoid = async (reason: string, authorizedBy: string) => {
    const { orderId, items, voidType, onSuccess } = voidModalState;
    const branchName = commerceBranchLink?.flow_branch_name || user?.branch || "Cloud Kitchen";

    const result = await executeVoidTransaction({
      voidType,
      branchName,
      orderId,
      items,
      reason,
      cashierName: activeCashier?.name || user?.name || "Cashier",
      authorizedBy,
      orderType: "POS",
      executeCommerceMutation: async (opId?: string) => {
        const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${orderId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "cancelled",
            voidReason: reason,
            void_operation_id: opId,
            is_manager_override: true
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          return { success: true };
        }
        return { success: false, error: data.error || "Failed to update order status" };
      }
    });

    if (result.success) {
      setVoidModalState(prev => ({ ...prev, isOpen: false }));
      if (onSuccess) onSuccess();
      fetchOrdersQueue();
      return { success: true };
    }

    return { success: false, error: result.error || "Void failed during transaction" };
  };

  const handleCashierPinSubmit = async (pinToSubmit?: string) => {
    const code = pinToSubmit || pinInput;
    if (!code || code.length < 4) {
      setPinError("Please enter your 4-digit PIN");
      return;
    }
    setIsVerifyingPin(true);
    setPinError("");
    try {
      const res = await api.verifyCashierPin(code);
      if (res.success && res.data) {
        setActiveCashier(res.data);
        setIsCashierModalOpen(false);
        setPinInput("");
        setPinError("");
      } else {
        setPinError(res.error || "Invalid PIN code");
        setPinInput("");
      }
    } catch (err: any) {
      setPinError(err.message || "Failed to verify PIN");
      setPinInput("");
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // Data States
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  // FLOW Upsell Recommendations Hook
  const { activeUpsells } = usePosUpsell(
    commerceBranchLink?.flow_branch_name || user?.branch || "Cloud Kitchen",
    products
  );
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
  const [discountType, setDiscountType] = useState("none"); // "none", "5%", "10%", "15%", "wa15", "toters", "noknok", "custom", "custom_rule"
  const [discountValInput, setDiscountValInput] = useState(10);
  const [discountIsPercent, setDiscountIsPercent] = useState(true);
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  // Restaurant & Branch Specific Discount Configuration
  const [restaurantDiscounts, setRestaurantDiscounts] = useState<PosDiscountRule[]>([]);
  const [selectedDiscountRule, setSelectedDiscountRule] = useState<PosDiscountRule | null>(null);
  const [isDiscountManagerOpen, setIsDiscountManagerOpen] = useState(false);

  // Print Server Settings
  const [printServerIP, setPrintServerIP] = useState("");
  const [printServerPort, setPrintServerPort] = useState(9191);

  const [ticketItems, setTicketItems] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editingOrderVersion, setEditingOrderVersion] = useState(null);

  // Check if active table is already occupied / committed
  const isCurrentTableOccupied = useMemo(() => {
    if (!activeTableContext) return false;
    // An occupied table has an active order entered or loaded, or items in ticket
    if (activeTableContext.orderId) return true;
    if (ticketItems.length > 0) return true;
    if (activeTableContext.isExistingOccupied) return true;
    return false;
  }, [activeTableContext, ticketItems]);

  // Course Pacing State: Table Fire Counts (persisted per shift session)
  const [tableFireCounts, setTableFireCounts] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem('flow_pos_table_fire_counts');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const updateTableFireCount = (key: string, count: number) => {
    setTableFireCounts(prev => {
      const next = { ...prev, [key]: count };
      try {
        localStorage.setItem('flow_pos_table_fire_counts', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const currentTableKey = useMemo(() => {
    if (activeTableContext?.tableCode) {
      return 'TABLE_' + String(activeTableContext.tableCode).toUpperCase().replace(/\s+/g, '');
    }
    if (editingOrderId) {
      return 'ORDER_' + editingOrderId;
    }
    return 'WALK_IN';
  }, [activeTableContext, editingOrderId]);

  // Count of Hold lines placed in current ticket order
  const currentTableHolds = useMemo(() => {
    return ticketItems.filter((i: any) =>
      Boolean(i.isHoldSeparator) ||
      i.name === 'HOLD' ||
      (typeof i.name === 'string' && i.name.toUpperCase().includes('HOLD'))
    ).length;
  }, [ticketItems]);

  const currentTableFires = tableFireCounts[currentTableKey] || 0;
  // Fire is active till the fire count is less than the Hold count per table
  const isFireActive = currentTableHolds > 0 && currentTableFires < currentTableHolds;
  const remainingFires = Math.max(0, currentTableHolds - currentTableFires);

  // Sell Mode: Scheduled Order Popup state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduledOrderDate, setScheduledOrderDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [scheduledOrderTime, setScheduledOrderTime] = useState<string>("");
  const [scheduledOrderNote, setScheduledOrderNote] = useState<string>("");

  const applyQuickSchedule = (mins: number) => {
    const d = new Date(Date.now() + mins * 60000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    setScheduledOrderDate(`${yyyy}-${mm}-${dd}`);
    setScheduledOrderTime(`${hh}:${min}`);
  };

  const formatScheduledTimeDisplay = (dateStr: string, timeStr: string) => {
    if (!timeStr) return "";
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const isToday = dateStr === todayStr;
      const [h, m] = timeStr.split(':').map(Number);
      const dateObj = new Date();
      dateObj.setHours(h, m, 0, 0);
      const timeFormatted = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return isToday ? `Today at ${timeFormatted}` : `${dateStr} at ${timeFormatted}`;
    } catch {
      return `${dateStr} ${timeStr}`;
    }
  };

  const [posTerminalId] = useState(() => {
    if (typeof window !== "undefined") {
      let tid = localStorage.getItem("pos_terminal_id");
      if (!tid) {
        tid = "OVRLOAD-POS-" + Math.floor(1000 + Math.random() * 9000);
        localStorage.setItem("pos_terminal_id", tid);
      }
      return tid;
    }
    return "OVRLOAD-POS-01";
  });
  const [clientOrderToken, setClientOrderToken] = useState(() => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "tok-" + Date.now()));
  const resetClientOrderToken = () => {
    setClientOrderToken(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "tok-" + Date.now());
  };

  // Queue & Modal States
  const [heldOrders, setHeldOrders] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [rejectingOrderId, setRejectingOrderId] = useState(null);
  const [confirmingRejectId, setConfirmingRejectId] = useState(null);
  const [confirmingDeleteHeldId, setConfirmingDeleteHeldId] = useState(null);
  const [deletingHeldOrderId, setDeletingHeldOrderId] = useState(null);
  const [activeTabModal, setActiveTabModal] = useState(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [lastPrintedOrder, setLastPrintedOrder] = useState<any | null>(null);
  const [isTerminalPaymentModalOpen, setIsTerminalPaymentModalOpen] = useState(false);
  const [activeOrderForTerminalPayment, setActiveOrderForTerminalPayment] = useState<any | null>(null); // 'held', 'incoming', 'payment', 'customization', 'void_item', 'receipt', 'settings'

  // Notification tracking refs
  const knownOrderIdsRef = useRef(null);
  const isFirstPollRef = useRef(true);
  const isPollingRef = useRef(false);

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
  const [exchangeRate, setExchangeRate] = useState<number>(89500);
  const [lastCompletedOrder, setLastCompletedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadError, setInitialLoadError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [dispatchStatusMsg, setDispatchStatusMsg] = useState("");

  // POS Screen Matrix & Horizontal Touch Bar States
  const [posScreens, setPosScreens] = useState<PosScreen[]>([]);
  const [currentScreenId, setCurrentScreenId] = useState<string>('root');
  const [screenStack, setScreenStack] = useState<string[]>([]);
  const [isFeaturesModalOpen, setIsFeaturesModalOpen] = useState(false);
  const [isPinLockOpen, setIsPinLockOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTargetTableInput, setTransferTargetTableInput] = useState("");

  // Fetch exchange rate on load
  useEffect(() => {
    api.getExchangeRate(user?.restaurant_id)
      .then((res) => {
        if (res.success && res.rate && res.rate > 0) {
          setExchangeRate(res.rate);
        } else {
          setExchangeRate(89500);
        }
      })
      .catch(() => {
        setExchangeRate(89500);
      });
  }, [user?.restaurant_id]);

  // Restaurant & Branch Discounts Fetch
  const fetchRestaurantDiscounts = async () => {

    if (!currentRestaurantId) return;
    try {
      const res = await getRestaurantDiscounts(currentRestaurantId);
      if (res.discounts) {
        setRestaurantDiscounts(res.discounts);
      }
    } catch (err) {
      console.warn("[POS] Error fetching restaurant discounts:", err);
    }
  };

  useEffect(() => {
    fetchRestaurantDiscounts();
  }, [currentRestaurantId]);

  const applicableDiscounts = useMemo(() => {
    return getApplicableDiscounts(restaurantDiscounts, currentBranchId, currentBranchName);
  }, [restaurantDiscounts, currentBranchId, currentBranchName]);

  // Helper for safe fetch with timeout
  const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timer);
    }
  };

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
      const res = await fetchWithTimeout(`${COMMERCE_API_BASE}/api/branches`, {}, 8000);
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
      const res = await fetch(`${COMMERCE_API_BASE}/api/branches/${branchStatus.id}`, {
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
      const res = await fetchWithTimeout(`${COMMERCE_API_BASE}/api/pos/customers?q=${encodeURIComponent(cleanDigits)}`, {}, 6000);
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
      const res = await fetchWithTimeout(`${COMMERCE_API_BASE}/api/pos/customers?q=${encodeURIComponent(query.trim())}`, {}, 6000);
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
        const res = await fetchWithTimeout(`${COMMERCE_API_BASE}/api/delivery/calculate-cost`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branchId: parseInt(commerceBranchLink?.external_branch_id || "1", 10), address: deliveryAddress.trim() }),
        }, 8000);
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
    setInitialLoadError(null);
    try {
      const data = await fetchPosCatalog(currentRestaurantId);
      if (data.categories) setCategories(data.categories);
      if (data.products) setProducts(data.products);

      // Load POS Screen Matrix (modifiable screens & subscreens)
      try {
        const screens = await fetchPosScreens(currentRestaurantId, data.categories || [], data.products || []);
        setPosScreens(screens);
        const rootScreen = screens.find((s) => s.isRoot) || screens[0];
        if (rootScreen) {
          setCurrentScreenId(rootScreen.id);
        }
      } catch (screenErr) {
        console.warn("Could not load POS screens:", screenErr);
      }

      if (data.settings) {
        if (data.settings.toters_discount_percent !== undefined) setTotersDiscountPercent(data.settings.toters_discount_percent);
        if (data.settings.noknok_discount_percent !== undefined) setNoknokDiscountPercent(data.settings.noknok_discount_percent);
        if (data.settings.print_server_ip) setPrintServerIP(data.settings.print_server_ip);
        if (data.settings.print_server_port) setPrintServerPort(Number(data.settings.print_server_port));
      }
    } catch (err: any) {
      console.error("Error fetching POS products:", err);
      setInitialLoadError(err.message || "Failed to connect to POS server");
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
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    try {
      const extBranchId = commerceBranchLink?.external_branch_id || '';
      const qs = `restaurant_id=${encodeURIComponent(currentRestaurantId || '')}${extBranchId ? `&branch_id=${encodeURIComponent(extBranchId)}` : ''}`;
      const [pendingRes, heldRes] = await Promise.all([
        fetchWithTimeout(`/api/pos/orders?type=pending&${qs}`, {}, 8000),
        fetchWithTimeout(`/api/pos/orders?type=held&${qs}`, {}, 8000)
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
    } finally {
      isPollingRef.current = false;
    }
  };

  const handleRejectPendingOrder = (orderId: string | number) => {
    const order = (pendingOrders || []).find((o: any) => o.id === orderId);
    const items: CanceledItemDetail[] = (order?.items || []).map((i: any) => ({
      name: i.product_name || i.name || 'Item',
      qty: i.quantity || i.qty || 1,
      price: i.unit_price || 0
    }));

    setVoidModalState({
      isOpen: true,
      orderId,
      items,
      voidType: 'order_cancellation',
      onSuccess: () => {
        setPendingOrders((prev: any) => prev.filter((o: any) => o.id !== orderId));
      }
    });
  };

  const handleDeleteHeldOrder = (orderId: string | number) => {
    const order = (heldOrders || []).find((o: any) => o.id === orderId);
    const items: CanceledItemDetail[] = (order?.items || []).map((i: any) => ({
      name: i.product_name || i.name || 'Item',
      qty: i.quantity || i.qty || 1,
      price: i.unit_price || 0
    }));

    setVoidModalState({
      isOpen: true,
      orderId,
      items,
      voidType: 'order_cancellation',
      onSuccess: () => {
        setHeldOrders((prev: any) => prev.filter((o: any) => o.id !== orderId));
      }
    });
  };

  const handleDirectVoidOrder = (order: any) => {
    const raw = order.rawOrder || order;
    const items: CanceledItemDetail[] = (order.items || raw.items || []).map((i: any) => ({
      name: i.name || i.product_name || 'Item',
      qty: i.quantity || i.qty || 1,
      price: i.unitPrice || i.unit_price || 0
    }));

    setVoidModalState({
      isOpen: true,
      orderId: order.id,
      items,
      voidType: (order.statusGroup === 'COMPLETED' || raw.status === 'completed') ? 'refund' : 'order_cancellation',
      onSuccess: () => {
        fetchOrdersQueue();
      }
    });
  };

  const releaseCurrentOrderLock = async () => {
    if (editingOrderId) {
      try {
        await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${editingOrderId}/release`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claimed_terminal: posTerminalId })
        });
      } catch (e) {
        console.warn("Error releasing order lock:", e);
      }
    }
  };

  const handleRestoreHeldTicket = async (o) => {
    if (!o) return;
    if (o.claimed_terminal && o.claimed_terminal !== posTerminalId) {
      const confirmOverride = window.confirm(
        `Order #${o.id} is currently claimed by ${o.claimed_by || "another cashier"} on ${o.claimed_terminal}.\n\nDo you want to override this claim as manager?`
      );
      if (!confirmOverride) return;
      try {
        const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${o.id}/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            claimed_by: "Cashier",
            claimed_terminal: posTerminalId,
            force_override: true
          })
        });
        const data = await res.json();
        if (data.success) {
          loadOrderToTicket(o, "POS");
          setActiveTabModal(null);
        } else {
          alert(data.error || "Failed to claim order");
        }
      } catch (err) {
        console.error("Error claiming order:", err);
      }
      return;
    }

    try {
      const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${o.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimed_by: "Cashier",
          claimed_terminal: posTerminalId,
          force_override: false
        })
      });
      const data = await res.json();
      if (res.status === 409 || data.conflict) {
        alert(data.error || "Order is currently being handled by another terminal.");
        return;
      }
      loadOrderToTicket(o, "POS");
      setActiveTabModal(null);
    } catch (err) {
      console.error("Error claiming order:", err);
      loadOrderToTicket(o, "POS");
      setActiveTabModal(null);
    }
  };

  const loadOrderToTicket = (o, defaultChannel = "WhatsApp") => {
    if (!o) return;
    setEditingOrderId(o.id);
    setEditingOrderVersion(o.version !== undefined && o.version !== null ? Number(o.version) : 1);
    setCustomerName(o.customer_name || "");
    setCustomerPhone(o.customer_phone || "");
    setDeliveryAddress(o.delivery_address || "");

    // 1. Automatically turn origin / channel to WhatsApp (or the order's specific channel)
    const channelRaw = o.order_source || defaultChannel;
    let channel = "WhatsApp";
    if (channelRaw) {
      const lower = String(channelRaw).toLowerCase();
      if (lower.includes("toter")) channel = "Toters";
      else if (lower.includes("nok")) channel = "NokNok";
      else if (lower.includes("what") || lower.includes("wa")) channel = "WhatsApp";
      else if (lower.includes("app")) channel = "App";
      else if (lower === "pos" || lower === "pick-up" || lower === "pickup") channel = null;
      else channel = channelRaw;
    }
    setSelectedChannel(channel);

    // 2. Load order type (delivery vs pickup)
    const isPickup = (o.order_type || "").toLowerCase() === "pickup" || (!o.delivery_address && (o.order_type || "").toLowerCase() !== "delivery");
    setOrderType(isPickup ? "pickup" : "delivery");

    // 3. Load delivery fee
    const fee = o.delivery_fee !== undefined && o.delivery_fee !== null ? Number(o.delivery_fee) : 0;
    setDeliveryFee(fee);

    // 4. Map ticket items
    const items = (o.items || []).map((i) => {
      let custs = [];
      if (i.customizations) {
        let parsed = i.customizations;
        while (typeof parsed === "string") {
          const trimmed = parsed.trim();
          if (
            (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
            (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
            (trimmed.startsWith('"') && trimmed.endsWith('"'))
          ) {
            try {
              parsed = JSON.parse(trimmed);
            } catch {
              break;
            }
          } else {
            break;
          }
        }
        if (Array.isArray(parsed)) {
          custs = parsed.map((c) => {
            if (typeof c === "string") {
              if (c.trim().startsWith("{") && c.trim().endsWith("}")) {
                try {
                  return JSON.parse(c);
                } catch {
                  return { name: c };
                }
              }
              return { name: c };
            }
            return { ...c, name: c.name || c.ingredient || "" };
          });
        } else if (typeof parsed === "string" && parsed.trim()) {
          custs = parsed
            .split(",")
            .map((s) => ({ name: s.trim() }))
            .filter((x) => x.name);
        } else if (parsed && typeof parsed === "object") {
          custs = [{ ...parsed, name: parsed.name || parsed.ingredient || "" }];
        }
      }

      const rawName = String(i.product_name || i.name || '').trim();
      const isHold = Boolean(i.isHoldSeparator) ||
        String(i.product_id || '').startsWith('hold_') ||
        rawName.toUpperCase() === 'HOLD' ||
        rawName.toUpperCase().includes('HOLD FOR NEXT COURSE') ||
        rawName.toUpperCase() === '--- HOLD ---';

      return {
        product_id: isHold ? (i.product_id || 'hold_separator_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)) : (i.product_id || i.id),
        name: isHold ? 'HOLD' : (i.product_name || i.name),
        unit_price: isHold ? 0 : (Number(i.unit_price) || 0),
        qty: Number(i.quantity || i.qty) || 1,
        selectedCustomizations: custs,
        note: i.comment || i.note || (isHold ? "Kitchen waits for fire" : ""),
        isHoldSeparator: isHold
      };
    });
    setTicketItems(items);

    // 5. Load discount
    const itemsSubtotal = items.reduce((sum, item) => sum + item.unit_price * item.qty, 0);
    const discAmt = Number(o.discount_amount) || 0;

    if (discAmt > 0) {
      if (itemsSubtotal > 0 && Math.abs(discAmt - (itemsSubtotal * 0.15)) < 0.05) {
        setDiscountType("wa15");
      } else if (itemsSubtotal > 0 && Math.abs(discAmt - (itemsSubtotal * 0.10)) < 0.05) {
        setDiscountType("10%");
      } else if (itemsSubtotal > 0 && Math.abs(discAmt - (itemsSubtotal * 0.05)) < 0.05) {
        setDiscountType("5%");
      } else if (itemsSubtotal > 0 && Math.abs(discAmt - (itemsSubtotal * (totersDiscountPercent / 100))) < 0.05 && channel === "Toters") {
        setDiscountType("toters");
      } else if (itemsSubtotal > 0 && Math.abs(discAmt - (itemsSubtotal * (noknokDiscountPercent / 100))) < 0.05 && channel === "NokNok") {
        setDiscountType("noknok");
      } else {
        setDiscountType("custom");
        setDiscountIsPercent(false);
        setDiscountValInput(discAmt);
      }
    } else {
      // Default discount preset according to channel
      if (channel === "WhatsApp") {
        setDiscountType("wa15");
      } else if (channel === "Toters") {
        setDiscountType("toters");
      } else if (channel === "NokNok") {
        setDiscountType("noknok");
      } else {
        setDiscountType("none");
      }
    }

    setActiveTabModal(null);
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
    if (isProduct86d(product.id)) {
      alert(`⚠️ "${product.name}" is currently 86'd (unavailable) by the kitchen.`);
      return;
    }
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

  // Screen Matrix Navigation Helpers
  const activePosScreen = useMemo(() => {
    if (!posScreens || posScreens.length === 0) return null;
    return posScreens.find((s) => s.id === currentScreenId) || posScreens.find((s) => s.isRoot) || posScreens[0];
  }, [posScreens, currentScreenId]);

  const activeGridConfig = useMemo(() => {
    return calculateDynamicGrid(
      activePosScreen?.buttons?.length || 0,
      activePosScreen?.gridCols,
      activePosScreen?.gridRows
    );
  }, [activePosScreen?.buttons?.length, activePosScreen?.gridCols, activePosScreen?.gridRows]);

  const activeGridDensity = useMemo(() => {
    return getGridButtonDensity(activeGridConfig.cols, activeGridConfig.rows);
  }, [activeGridConfig.cols, activeGridConfig.rows]);

  const handleNavigateToSubscreen = (targetScreenId?: string) => {
    if (!targetScreenId) return;
    setScreenStack((prev) => [...prev, currentScreenId]);
    setCurrentScreenId(targetScreenId);
  };

  const handleBackToParentScreen = () => {
    if (screenStack.length > 0) {
      const prevScreenId = screenStack[screenStack.length - 1];
      setScreenStack((prev) => prev.slice(0, -1));
      setCurrentScreenId(prevScreenId);
    } else {
      const rootScreen = posScreens.find((s) => s.isRoot) || posScreens[0];
      if (rootScreen) setCurrentScreenId(rootScreen.id);
    }
  };

  const handleTouchButtonPress = (btn: PosScreenButton) => {
    if (btn.type === 'screen') {
      handleNavigateToSubscreen(btn.targetScreenId);
    } else {
      const prod = products.find((p: any) => String(p.id) === String(btn.productId)) ||
                   products.find((p: any) => (p.name || '').toLowerCase() === (btn.label || '').toLowerCase()) ||
                   { id: btn.productId || 'item_' + Date.now(), name: btn.label, unit_price_usd: 0, customizations: [] };

      if (isProduct86d((prod as any).id)) {
        alert(`⚠️ "${(prod as any).name}" is currently 86'd (unavailable) by the kitchen.`);
        return;
      }

      if ((prod as any).customizations && (prod as any).customizations.length > 0) {
        handleOpenCustomization(prod);
      } else {
        handleQuickAddProduct(prod);
      }
    }
  };

  // Horizontal Bottom Bar Action 3: Hold
  // In Table Mode: Course Hold separator for kitchen pacing
  // In Sell Mode: Opens popup to schedule the order for pickup / delivery
  const handleInsertHold = () => {
    if (ticketItems.length === 0) {
      alert("⚠️ Please add items to the ticket first.");
      return;
    }

    // In Sell mode (OTC / no active table): Open Schedule Order popup
    if (!activeTableContext) {
      if (!scheduledOrderTime) {
        applyQuickSchedule(30);
      }
      setIsScheduleModalOpen(true);
      return;
    }

    // In Dine-In Table mode: Course hold separator
    const lastItem: any = ticketItems[ticketItems.length - 1];
    if (lastItem?.isHoldSeparator || lastItem?.name === 'HOLD') {
      alert("⚠️ A Hold line is already placed at this position.");
      return;
    }

    setTicketItems((prev: any) => [
      ...prev,
      {
        product_id: 'hold_separator_' + Date.now(),
        name: 'HOLD',
        unit_price: 0,
        qty: 1,
        selectedCustomizations: [],
        note: 'Kitchen waits for fire',
        isHoldSeparator: true
      }
    ]);
  };

  // Horizontal Bottom Bar Action 5: Kitchen Firing Command (Active till fire count < hold count per table)
  const handleKitchenFireChit = async () => {
    if (!isFireActive) {
      if (currentTableHolds === 0) {
        alert("⚠️ No held courses in this ticket. Tap 'Hold' between items to pace kitchen preparation.");
      } else {
        alert(`⚠️ All held courses (${currentTableHolds}) have already been fired.`);
      }
      return;
    }

    const nextFire = currentTableFires + 1;
    updateTableFireCount(currentTableKey, nextFire);

    const tableLabel = activeTableContext
      ? (String(activeTableContext.tableCode).toUpperCase().startsWith('T')
          ? `Table ${activeTableContext.tableCode.replace(/^T/i, '')}`
          : `Table ${activeTableContext.tableCode}`)
      : (customerName || 'Table');
    const waiterName = activeCashier?.name || user?.name || 'Staff';

    // Separate Fire Ticket print payload
    // Ex: Table 7 \n Fire
    const fireChitPayload = {
      isKitchenFire: true,
      isSeparateFireTicket: true,
      title: "FIRE",
      table: tableLabel,
      text: "FIRE",
      content: `${tableLabel}\nFire`,
      fireRound: nextFire,
      totalHolds: currentTableHolds,
      server: waiterName,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      items: [
        {
          name: "FIRE",
          qty: 1,
          note: `Course ${nextFire + 1}`
        }
      ]
    };

    try {
      await handlePrint(fireChitPayload);
    } catch (err) {
      console.warn("Print fire chit error:", err);
    }

    // Also notify KDS if active
    if (activeTableContext?.orderId || editingOrderId) {
      try {
        const locKey = commerceBranchLink?.location_key || 'badaro';
        await fireOrderRound({
          orderId: (activeTableContext?.orderId || editingOrderId)!,
          locationKey: locKey,
          items: [],
          serviceType: 'dine_in',
          tableLabel: tableLabel,
          waiterReference: waiterName,
          firedBy: waiterName
        });
      } catch (kdsErr) {
        console.warn("KDS fire round notice:", kdsErr);
      }
    }

    const remaining = currentTableHolds - nextFire;
    alert(`🔥 Separate Fire ticket sent to printer:\n\n${tableLabel}\nFire\n\n(${remaining} fire${remaining === 1 ? '' : 's'} remaining)`);
  };

  const handleOpenCustomization = (product, itemIndex = null) => {
    if (isProduct86d(product.id)) {
      alert(`⚠️ "${product.name}" is currently 86'd (unavailable) by the kitchen.`);
      return;
    }
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

  const handleRemoveTicketItem = (index) => {
    const updated = [...ticketItems];
    updated.splice(index, 1);
    setTicketItems(updated);
  };

  const handlePromptVoid = (index: number) => {
    if (editingOrderId) {
      // Type B: Submitted item void on existing server order
      const itemToVoid = ticketItems[index];
      setVoidModalState({
        isOpen: true,
        orderId: editingOrderId,
        items: [{
          name: itemToVoid?.name || 'Item',
          qty: itemToVoid?.qty || 1,
          price: itemToVoid?.unit_price || 0,
          product_id: itemToVoid?.product_id
        }],
        voidType: 'item_void',
        onSuccess: () => {
          handleRemoveTicketItem(index);
        }
      });
    } else {
      // Type A: Local draft cart item removal (0 audit, zero backend impact)
      handleRemoveTicketItem(index);
    }
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

  const handleResetCart = () => {
    updateTableFireCount(currentTableKey, 0);
    releaseCurrentOrderLock();
    resetClientOrderToken();
    setActiveTableContext(null);
    setQuickTableInput("");
    setTicketItems([]);
    setEditingOrderId(null);
    setEditingOrderVersion(null);
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryAddress("");
    setSelectedChannel(null);
    setOrderType("delivery");
    setDiscountType("none");
    setSelectedDiscountRule(null);
    setDiscountValInput(10);
    setDiscountIsPercent(true);
    setDeliveryFee(0);
    setValidationError("");
    setDetectedWaLocation(null);
    setCustomerSearchResults([]);
    setShowCustomerDropdown(false);
    setEditingItemIndex(null);
    setSelectedCustomizations([]);
    setItemNote("");
  };

  const subtotal = ticketItems.reduce((sum, item) => sum + item.unit_price * item.qty, 0);

  const calculatedDiscount = (() => {
    if (selectedDiscountRule) {
      return calculateDiscountAmount(selectedDiscountRule, subtotal);
    }
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
    if (selectedDiscountRule) {
      return `${selectedDiscountRule.name} (${selectedDiscountRule.type === 'percent' ? `${selectedDiscountRule.value}%` : `$${selectedDiscountRule.value}`})`;
    }
    if (discountType === "5%") return "5%";
    if (discountType === "10%") return "10%";
    if (discountType === "15%") return "15%";
    if (discountType === "wa15") return "WhatsApp 15%";
    if (discountType === "toters") return `Toters (${totersDiscountPercent}%)`;
    if (discountType === "noknok") return `NokNok (${noknokDiscountPercent}%)`;
    if (discountType === "custom") return discountIsPercent ? `${discountValInput}%` : `$${discountValInput}`;
    return "Discount";
  })();

  const handlePrintPreCheckDoc = async (table: PosTable) => {
    if (!table.commerce_order_id) return;
    try {
      const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders?type=all`);
      const data = await res.json();
      const orders = data.orders || [];
      const ord = orders.find((o: any) => o.id === table.commerce_order_id);
      if (!ord) return;

      const preCheckPayload = {
        isPreCheck: true,
        title: "PRE-CHECK / BILL — NOT PAID",
        id: ord.id,
        table_code: table.table_code,
        guest_count: table.guest_count || 1,
        waiter_name: table.assigned_waiter || activeCashier?.name || "Staff",
        order_source: "Dine In",
        order_type: "dine_in",
        items: (ord.items || []).map((it: any) => ({
          name: it.product_name || it.name,
          qty: it.quantity,
          unit_price: parseFloat(it.unit_price || 0),
          total_price: parseFloat(it.total_price || 0),
          note: it.comment || it.note || ""
        })),
        subtotal_amount: parseFloat(ord.subtotal_amount || 0),
        discount_amount: parseFloat(ord.discount_amount || 0),
        total_amount: parseFloat(ord.total_amount || 0),
        created_at: ord.created_at || new Date().toISOString()
      };

      await handlePrint(preCheckPayload);
    } catch (err) {
      console.error("Error printing pre-check:", err);
    }
  };

  const handleQuickAssignTable = async (inputStr: string) => {
    const raw = inputStr.trim();
    if (!raw) return;

    const flowBranchId = currentBranchId || commerceBranchLink?.flow_branch_id || branchCapabilities?.branchId || "9c214659-9cc7-4f33-b115-cbbb8a823a94";
    const flowRestId = currentRestaurantId;
    const extBranchId = String(commerceBranchLink?.external_branch_id || "1");

    const cashier = activeCashier?.name || user?.name || "Cashier";

    setIsQuickTableLoading(true);
    try {
      const res = await getOrCreateTableAndSession({
        tableCodeInput: raw,
        branchId: flowBranchId,
        restaurantId: flowRestId,
        externalBranchId: extBranchId,
        operatorName: cashier,
        operatorUserId: activeCashier?.id || user?.id,
        waiterName: cashier
      });

      if (!res.success || !res.table) {
        alert(res.error || "Failed to resolve or create table.");
        return;
      }

      setQuickTableInput("");

      // If existing occupied table has a commerce order, load it into ticket!
      if (res.orderId) {
        try {
          const orderRes = await fetch(`${COMMERCE_API_BASE}/api/pos/orders?type=all`);
          const data = await orderRes.json();
          const ord = (data.orders || []).find((o: any) => o.id === res.orderId);
          if (ord) {
            loadOrderToTicket(ord, "POS");
            setActiveTableContext({
              orderId: res.orderId,
              tableCode: res.table.table_code,
              sessionId: res.sessionId,
              guestCount: res.guestCount,
              waiterName: res.waiterName,
              isExistingOccupied: true,
            });
            return;
          }
        } catch (e) {
          console.warn("Could not load existing table order:", e);
        }
      }

      // Fresh table session (newly created or opened before order entered)
      setCustomerName(`Table ${res.table.table_code}`);
      setOrderType("dine_in");
      setSelectedChannel("POS");
      setActiveTableContext({
        orderId: null,
        tableCode: res.table.table_code,
        sessionId: res.sessionId,
        guestCount: res.guestCount,
        waiterName: res.waiterName,
        isExistingOccupied: false,
      });
    } catch (err: any) {
      alert(err.message || "Error assigning table.");
    } finally {
      setIsQuickTableLoading(false);
    }
  };

  const handleTableKeypadSelect = async (tableCode: string) => {
    if (activeTableContext && isCurrentTableOccupied) {
      alert("⚠️ Table is already occupied. You cannot change the table number unless you click Transfer Table.");
      setTransferTargetTableInput("");
      setIsTransferModalOpen(true);
      return;
    }
    // Changing table before order is entered: clean up previous empty table session
    if (activeTableContext?.sessionId && !isCurrentTableOccupied) {
      try {
        await closeTableSession(activeTableContext.sessionId);
      } catch (e) {
        console.warn("Released previous empty table session:", e);
      }
    }
    await handleQuickAssignTable(tableCode);
    setPosActiveView('sell');
  };

  const handleOpenFloorMap = () => {
    setPosActiveView('tables');
  };

  const handleClearCurrentTable = async () => {
    if (activeTableContext?.sessionId && !isCurrentTableOccupied) {
      try {
        await closeTableSession(activeTableContext.sessionId);
      } catch (e) {}
    }
    setActiveTableContext(null);
    setQuickTableInput("");
    setCustomerName("");
  };

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
    const isPickup = orderType === "pickup" || (selectedChannel || "").toLowerCase().includes("pick");
    const isDineIn = Boolean(activeTableContext);
    if (!isPickup && !isDineIn && (!customerName || !customerName.trim())) {
      setValidationError("⚠️ Customer name is required to save the order");
      return false;
    }
    setValidationError("");
    return true;
  };

  const handleHoldOrder = async () => {
    if (ticketItems.length === 0) return;
    if (!validateOrder()) return;
    if (!isShiftOpen) {
      alert("⚠️ A FLOW shift cash session must be open before holding orders or accepting payments.");
      setIsOpenShiftModalOpen(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const isDineIn = Boolean(activeTableContext);
      const isPickup = orderType === "pickup" || (selectedChannel || "").toLowerCase().includes("pick");
      const defaultCustomer = isDineIn
        ? `Table ${activeTableContext?.tableCode}`
        : isPickup
        ? "Pickup Customer"
        : "Direct Order";
      const resolvedCustomerName = customerName.trim() || defaultCustomer;

      const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: parseInt(commerceBranchLink?.external_branch_id || "1", 10),
          restaurant_id: currentRestaurantId,
          client_order_token: clientOrderToken,
          orderType: isDineIn ? "dine_in" : orderType,
          service_type: isDineIn ? "dine_in" : undefined,
          table_label: activeTableContext ? activeTableContext.tableCode : undefined,
          guest_count: activeTableContext ? (activeTableContext.guestCount || 1) : undefined,
          waiter_reference: activeTableContext ? (activeTableContext.waiterName || user?.name) : undefined,
          orderSource: selectedChannel || "POS",
          paymentMethod: selectedPaymentMethod,
          customerName: resolvedCustomerName,
          customerPhone,
          deliveryAddress,
          status: "held",
          subtotal,
          deliveryFee: (!isDineIn && orderType === "delivery") ? (parseFloat(deliveryFee) || 0) : 0,
          discountAmount,
          total,
          is_scheduled: Boolean(scheduledOrderTime),
          scheduled_for: scheduledOrderTime ? `${scheduledOrderDate} ${scheduledOrderTime}` : undefined,
          scheduled_note: scheduledOrderNote || undefined,
          items: ticketItems.map((item) => ({
            product_id: item.product_id,
            name: item.name,
            quantity: item.qty,
            unit_price: item.unit_price,
            customizations: (item.selectedCustomizations || []).map((c) => c.ingredient || c.name || c),
            comment: item.note
          }))
        })
      });
      const data = await res.json();
      if (data.success) {
        const heldOrderId = data.order?.id || data.orderId;
        if (activeTableContext?.sessionId && heldOrderId) {
          try {
            await supabase
              .from('pos_table_sessions')
              .update({
                commerce_order_id: heldOrderId,
                sync_status: 'synced',
                last_sync_error: null
              })
              .eq('id', activeTableContext.sessionId);
          } catch (e) {
            console.warn("Could not update pos_table_sessions with held order ID:", e);
          }
        }

        // If this was a scheduled order, print the kitchen ticket chit
        if (scheduledOrderTime) {
          const formattedSchedule = formatScheduledTimeDisplay(scheduledOrderDate, scheduledOrderTime);
          const scheduledKitchenPayload = {
            id: heldOrderId,
            isScheduledOrder: true,
            title: "*** SCHEDULED ORDER ***",
            scheduled_for: `${scheduledOrderDate} ${scheduledOrderTime}`,
            scheduled_time_display: formattedSchedule,
            scheduled_note: scheduledOrderNote,
            order_source: selectedChannel || "POS",
            order_type: orderType,
            customer_name: resolvedCustomerName,
            customer_phone: customerPhone,
            items: [
              {
                name: "*** SCHEDULED ORDER ***",
                qty: 1,
                unit_price: 0,
                customizations_print_text: [
                  `READY AT: ${formattedSchedule}`,
                  ...(scheduledOrderNote ? [`NOTE: ${scheduledOrderNote}`] : [])
                ],
                note: `READY AT: ${formattedSchedule}${scheduledOrderNote ? ` | ${scheduledOrderNote}` : ''}`
              },
              ...ticketItems.map((it: any) => ({
                name: it.name,
                qty: it.qty,
                note: it.note,
                customizations_print_text: (it.selectedCustomizations || []).map((c: any) => typeof c === 'string' ? c : c.name || c.ingredient)
              }))
            ]
          };
          try {
            await handlePrint(scheduledKitchenPayload);
          } catch (pe) {
            console.warn("Kitchen print for scheduled order error:", pe);
          }
        }

        resetClientOrderToken();
        setActiveTableContext(null);
        setTicketItems([]);
        setCustomerName("");
        setCustomerPhone("");
        setDeliveryAddress("");
        setSelectedChannel(null);
        setEditingOrderId(null);
        setEditingOrderVersion(null);
        setDiscountType("none");
        setDiscountValInput(10);
        setDiscountIsPercent(true);
        setDeliveryFee(0);
        setOrderType("delivery");
        setScheduledOrderTime("");
        setScheduledOrderNote("");
        fetchOrdersQueue();
      } else {
        alert(data.error || "Failed to hold order");
      }
    } catch (err) {
      console.error("Error holding order:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFireToKitchen = async () => {
    if (ticketItems.length === 0) {
      alert("No items in cart to fire.");
      return;
    }
    let targetOrderId = activeTableContext?.orderId || editingOrderId;
    setIsSubmitting(true);
    try {
      if (!targetOrderId) {
        if (!activeTableContext) {
          alert("Please hold or open an order before firing a round to the kitchen.");
          setIsSubmitting(false);
          return;
        }

        // Create the dine-in order in OVRLOAD commerce first!
        const orderPayload = {
          branch_id: parseInt(commerceBranchLink?.external_branch_id || "1", 10),
          restaurant_id: currentRestaurantId,
          client_order_token: clientOrderToken,
          orderType: 'dine_in',
          service_type: 'dine_in',
          table_label: activeTableContext.tableCode,
          guest_count: activeTableContext.guestCount || 1,
          waiter_reference: activeTableContext.waiterName || user?.name || 'Cashier',
          customerName: `Table ${activeTableContext.tableCode}`,
          customerPhone: '',
          orderSource: 'POS',
          paymentMethod: 'Cash',
          status: 'held',
          subtotal,
          deliveryFee: 0,
          discountAmount,
          total,
          items: ticketItems.map((item) => ({
            product_id: item.product_id,
            name: item.name,
            quantity: item.qty,
            unit_price: item.unit_price,
            customizations: (item.selectedCustomizations || []).map((c: any) =>
              typeof c === "string" ? c : (c.ingredient || c.name || "")
            ).filter(Boolean),
            comment: item.note || ""
          }))
        };

        const createRes = await fetch(`${COMMERCE_API_BASE}/api/pos/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload)
        });
        const createData = await createRes.json();
        if (!createRes.ok || !createData.success) {
          throw new Error(createData.error || `Failed to create dine-in order for Table ${activeTableContext.tableCode}`);
        }

        targetOrderId = createData.order?.id || createData.orderId;

        // Link this order to the FLOW table session
        if (activeTableContext.sessionId) {
          try {
            await supabase
              .from('pos_table_sessions')
              .update({
                commerce_order_id: targetOrderId,
                sync_status: 'synced',
                last_sync_error: null
              })
              .eq('id', activeTableContext.sessionId);
          } catch (e) {
            console.warn("Could not link commerce_order_id to table session:", e);
          }
        }

        setActiveTableContext(prev => prev ? { ...prev, orderId: targetOrderId } : null);
        resetClientOrderToken();
      } else {
        // Update existing order with latest items in cart
        await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${targetOrderId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subtotal,
            total,
            items: ticketItems.map((item) => ({
              product_id: item.product_id,
              quantity: item.qty,
              unit_price: item.unit_price,
              customizations: (item.selectedCustomizations || []).map((c: any) =>
                typeof c === "string" ? c : (c.ingredient || c.name || "")
              ).filter(Boolean),
              comment: item.note || ""
            }))
          })
        });
      }

      // Now fire the round to KDS!
      const locKey = commerceBranchLink?.location_key || 'badaro';
      const fireItems = ticketItems.map((item) => {
        const pName = item.name || item.product_name || "Item";
        const stationKey = (pName.toLowerCase().includes('drink') || pName.toLowerCase().includes('pepsi') || pName.toLowerCase().includes('coffee') || pName.toLowerCase().includes('water'))
          ? 'BAR'
          : 'HOT_KITCHEN';

        return {
          order_item_id: item.product_id,
          product_name: pName,
          quantity: item.qty || 1,
          station_key: stationKey,
          modifiers: (item.selectedCustomizations || []).map((c: any) => ({
            name: typeof c === 'string' ? c : (c.ingredient || c.name || '')
          })),
          notes: item.note || null
        };
      });

      const fireRes = await fireOrderRound({
        orderId: targetOrderId!,
        locationKey: locKey,
        items: fireItems,
        serviceType: 'dine_in',
        tableLabel: activeTableContext?.tableCode || customerName || 'Dine-In',
        guestCount: activeTableContext?.guestCount || 1,
        waiterReference: activeTableContext?.waiterName || user?.name || 'Cashier',
        firedBy: user?.name || 'POS Staff'
      });

      if (!fireRes.success) {
        throw new Error(fireRes.error || "Failed to fire kitchen round");
      }

      alert(`🔥 Sent Round #${fireRes.fireNumber || 1} to Kitchen successfully!`);
      setTicketItems([]);
      fetchOrdersQueue();
    } catch (err: any) {
      alert("Error firing round to kitchen: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalizePayment = async (paymentDetails?: {
    paymentMethod?: string;
    tenderedAmount?: number;
    tenderedCurrency?: "USD" | "LBP";
    changeAmount?: number;
    changeCurrency?: "USD" | "LBP";
  }) => {
    if (ticketItems.length === 0) return;
    if (!validateOrder()) return;
    if (!isShiftOpen) {
      alert("⚠️ A FLOW shift cash session must be open before processing payments or submitting orders.");
      setIsOpenShiftModalOpen(true);
      return;
    }
    const effectiveChannel = selectedChannel || "POS";
    if (!selectedChannel && !editingOrderId) setSelectedChannel("POS");

    const paymentOperationId = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : "pay-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7);

    const actualPaymentMethod =
      paymentDetails?.paymentMethod ||
      (effectiveChannel === "Toters" ? "Toters" :
       effectiveChannel === "NokNok" ? "NokNok" :
       selectedPaymentMethod);

    const isDineIn = Boolean(activeTableContext);
    const targetOrderId = editingOrderId || activeTableContext?.orderId;

    setIsSubmitting(true);
    try {
      let data;
      if (targetOrderId) {
        const updateRes = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${targetOrderId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: isDineIn ? "completed" : "preparing",
            payment_status: "paid",
            expected_version: editingOrderVersion,
            payment_operation_id: paymentOperationId,
            subtotal,
            deliveryFee: (!isDineIn && orderType === "delivery") ? (parseFloat(deliveryFee) || 0) : 0,
            discountAmount,
            total,
            customerName: customerName.trim() || (activeTableContext ? `Table ${activeTableContext.tableCode}` : ""),
            customerPhone,
            deliveryAddress,
            orderType: isDineIn ? "dine_in" : orderType,
            orderSource: effectiveChannel,
            paymentMethod: actualPaymentMethod,
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
        if (updateRes.status === 409 || data.conflict) {
          alert(data.error || "This order was updated on another terminal. The latest version has been loaded.");
          if (data.currentOrder) {
            loadOrderToTicket(data.currentOrder);
          }
          setIsSubmitting(false);
          return;
        }
        if (data.success) data.orderId = targetOrderId;
      } else {
        const createRes = await fetch(`${COMMERCE_API_BASE}/api/pos/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branch_id: parseInt(commerceBranchLink?.external_branch_id || "1", 10),
            restaurant_id: currentRestaurantId,
            client_order_token: clientOrderToken,
            payment_operation_id: paymentOperationId,
            orderType: isDineIn ? "dine_in" : orderType,
            service_type: isDineIn ? "dine_in" : undefined,
            table_label: activeTableContext ? activeTableContext.tableCode : undefined,
            guest_count: activeTableContext ? (activeTableContext.guestCount || 1) : undefined,
            waiter_reference: activeTableContext ? (activeTableContext.waiterName || user?.name) : undefined,
            orderSource: effectiveChannel,
            paymentMethod: actualPaymentMethod,
            customerName: customerName.trim() || (activeTableContext ? `Table ${activeTableContext.tableCode}` : ""),
            customerPhone,
            deliveryAddress,
            status: isDineIn ? "completed" : "preparing",
            subtotal,
            deliveryFee: (!isDineIn && orderType === "delivery") ? (parseFloat(deliveryFee) || 0) : 0,
            discountAmount,
            total,
            items: ticketItems.map((item) => ({
              product_id: item.product_id,
              name: item.name,
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
        const completedOrderId = data.orderId || data.order?.id || targetOrderId;
        if (activeTableContext?.sessionId) {
          try {
            await supabase
              .from('pos_table_sessions')
              .update({
                ...(completedOrderId ? { commerce_order_id: completedOrderId } : {}),
                status: 'closed',
                closed_at: new Date().toISOString()
              })
              .eq('id', activeTableContext.sessionId);
          } catch (e) {
            console.warn("Error closing table session on direct payment:", e);
          }
        }

        resetClientOrderToken();
        const normalizedItems = ticketItems.map((item) => {
          if (item.isHoldSeparator || item.name === 'HOLD') {
            return {
              qty: 1,
              name: "HOLD",
              unit_price: 0,
              selectedCustomizations: [],
              addons: [],
              removals: [],
              customizations_print_text: [],
              note: "Kitchen pauses — fire to resume",
              isHoldSeparator: true
            };
          }

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

        // If scheduled order in Sell mode, print prominent scheduled chit header
        if (scheduledOrderTime) {
          const formattedSchedule = formatScheduledTimeDisplay(scheduledOrderDate, scheduledOrderTime);
          normalizedItems.unshift({
            qty: 1,
            name: "*** SCHEDULED ORDER ***",
            unit_price: 0,
            selectedCustomizations: [],
            addons: [],
            removals: [],
            customizations_print_text: [
              `READY AT: ${formattedSchedule}`,
              ...(scheduledOrderNote ? [`NOTE: ${scheduledOrderNote}`] : [])
            ],
            note: `READY AT: ${formattedSchedule}${scheduledOrderNote ? ` | ${scheduledOrderNote}` : ''}`,
            isHoldSeparator: false
          });
        }

        const isPickup = orderType === "pickup" || (effectiveChannel || "").toLowerCase().includes("pick");
        const defaultCustomer = isDineIn
          ? `Table ${activeTableContext?.tableCode}`
          : isPickup
          ? "Pickup Customer"
          : "Direct Order";

        const completedOrderData = {
          id: completedOrderId,
          order_source: effectiveChannel,
          order_type: isDineIn ? "dine_in" : orderType,
          payment_method: actualPaymentMethod,
          tendered_amount: paymentDetails?.tenderedAmount,
          tendered_currency: paymentDetails?.tenderedCurrency || "USD",
          change_amount: paymentDetails?.changeAmount,
          change_currency: paymentDetails?.changeCurrency || "USD",
          exchange_rate: exchangeRate,
          customer_name: customerName.trim() || defaultCustomer,
          table_label: activeTableContext?.tableCode,
          guest_count: activeTableContext?.guestCount,
          waiter_name: activeTableContext?.waiterName || user?.name,
          customer_phone: customerPhone,
          delivery_address: deliveryAddress,
          is_scheduled: Boolean(scheduledOrderTime),
          scheduled_for: scheduledOrderTime ? `${scheduledOrderDate} ${scheduledOrderTime}` : null,
          scheduled_time_display: scheduledOrderTime ? formatScheduledTimeDisplay(scheduledOrderDate, scheduledOrderTime) : null,
          scheduled_notes: scheduledOrderNote || null,
          subtotal_amount: subtotal,
          delivery_fee: (!isDineIn && orderType === "delivery") ? (parseFloat(deliveryFee) || 0) : 0,
          discount_amount: discountAmount,
          discount_label: discountAmount > 0 ? discountLabel : null,
          total_amount: total,
          items: normalizedItems,
          created_at: new Date().toISOString()
        };

        handlePrint(completedOrderData);
        setLastCompletedOrder(completedOrderData);
        setIsTerminalPaymentModalOpen(false);
        updateTableFireCount(currentTableKey, 0);
        const wasTable = Boolean(activeTableContext);
        setActiveTableContext(null);
        setTicketItems([]);
        setCustomerName("");
        setCustomerPhone("");
        setDeliveryAddress("");
        setSelectedChannel(null);
        setEditingOrderId(null);
        setEditingOrderVersion(null);
        setDiscountType("none");
        setDiscountValInput(10);
        setDiscountIsPercent(true);
        setDeliveryFee(0);
        setOrderType("delivery");
        setScheduledOrderTime("");
        setScheduledOrderNote("");
        if (wasTable) {
          setPosActiveView('tables');
        } else {
          setActiveTabModal(["Toters", "NokNok"].includes(effectiveChannel) ? null : "receipt");
        }
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
      const extBranchId = commerceBranchLink?.external_branch_id || '';
      const qs = `restaurant_id=${encodeURIComponent(currentRestaurantId || '')}${extBranchId ? `&branch_id=${encodeURIComponent(extBranchId)}` : ''}`;
      const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders?type=all&${qs}`);
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
    const dispatchOperationId = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : "disp-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7);

    setDispatchStatusMsg(`Sending driver request (${timeText})... ⏳`);
    try {
      const res = await fetch(`${COMMERCE_API_BASE}/api/pos/dispatch-driver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: lastCompletedOrder.id,
          etaMinutes: etaMinutes || "15",
          phone: cleanPhone,
          dispatch_operation_id: dispatchOperationId
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

  if (initialLoadError && products.length === 0) {
    return (
      <div className="h-screen bg-[#0F1115] text-white flex items-center justify-center font-bold text-lg">
        <div className="flex flex-col items-center gap-4 max-w-md text-center p-6 bg-[#161922] border border-[#262D3D] rounded-2xl shadow-2xl">
          <span className="text-4xl">⚠️</span>
          <h2 className="text-xl font-black text-rose-400">Connection Error</h2>
          <p className="text-sm font-normal text-slate-300">
            {initialLoadError}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => {
                setLoading(true);
                setInitialLoadError(null);
                fetchProducts();
                fetchOrdersQueue();
                fetchBranchStatusAndPrompt();
              }}
              className="px-5 py-3 bg-[#eb660c] hover:bg-[#d55807] text-white font-bold rounded-xl shadow-lg transition active:scale-95"
            >
              🔄 Retry Connection
            </button>
            <button
              onClick={() => {
                window.location.reload();
              }}
              className="px-5 py-3 bg-[#262D3D] hover:bg-[#343D52] text-slate-200 font-bold rounded-xl shadow-lg transition active:scale-95"
            >
              🔁 Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  const realtimeStatus = getRealtimeBranchStatusInfo(branchStatus, posOperationalStatus, posClosureReason);

  return (
    <div className="h-screen max-h-screen flex flex-col bg-[#0F1115] text-white font-sans overflow-hidden select-none">
        {posActiveView === 'orders' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-12 bg-[#181C24] border-b border-[#262D3D] px-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPosActiveView('sell')}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow"
                >
                  <span>←</span>
                  <span>Back to POS Register</span>
                </button>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <span>📋 Orders Hub</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">{commerceBranchLink?.flow_branch_name || user?.branch || currentBranchName}</span>
                </div>
              </div>

              {/* RIGHT NAVIGATION BUTTONS: TABLES, SELL, ORDERS */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    refreshFloorTables();
                    setPosActiveView('tables');
                  }}
                  className="h-8 px-3 rounded-lg bg-[#181D28] hover:bg-[#22293A] text-slate-200 border border-[#2B354D] text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>🪑</span>
                  <span>{activeTableContext ? `Table ${activeTableContext.tableCode}` : 'Tables'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPosActiveView('sell')}
                  className="h-8 px-3 rounded-lg bg-[#181D28] hover:bg-[#22293A] text-slate-200 border border-[#2B354D] text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>🏷️</span>
                  <span>Sell</span>
                </button>
                <button
                  type="button"
                  className="h-8 px-3 rounded-lg bg-blue-600 text-white border border-blue-400 text-xs font-black flex items-center gap-1.5 shadow"
                >
                  <span>📋</span>
                  <span>Orders</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <OrdersHubScreen
                branchName={commerceBranchLink?.flow_branch_name || user?.branch || (currentRestaurantId === '4c0ed960-e459-42c4-962f-41229a2d3783' ? 'Badaro (Bistro)' : 'Badaro')}
                restaurantId={currentRestaurantId}
                branchId={commerceBranchLink?.external_branch_id}
                currentTerminalId={posTerminalId}
                activeCashierName={activeCashier?.name || user?.name || "Cashier"}
                onOpenOrderToTicket={(order) => {
                  loadOrderToTicket(order.rawOrder, order.channel);
                  setActiveTableContext(null);
                  setPosActiveView('sell');
                }}
                onReprint={(order) => {
                  handleReprintOrder(order.rawOrder);
                }}
                onRequestVoid={(order) => {
                  handleDirectVoidOrder(order);
                }}
              />
            </div>
          </div>
        ) : posActiveView === 'tables' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-12 bg-[#181C24] border-b border-[#262D3D] px-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPosActiveView('sell')}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow"
                >
                  <span>←</span>
                  <span>Back to POS Register</span>
                </button>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <span>🪑 Floor Plan & Tables</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">{currentBranchName}</span>
                </div>
              </div>

              {/* RIGHT NAVIGATION BUTTONS: TABLES, SELL, ORDERS */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-8 px-3 rounded-lg bg-amber-500 text-slate-950 font-black text-xs border border-amber-400 flex items-center gap-1.5 shadow"
                >
                  <span>🪑</span>
                  <span>{activeTableContext ? `Table ${activeTableContext.tableCode}` : 'Tables'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPosActiveView('sell')}
                  className="h-8 px-3 rounded-lg bg-[#181D28] hover:bg-[#22293A] text-slate-200 border border-[#2B354D] text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>🏷️</span>
                  <span>Sell</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPosActiveView('orders')}
                  className="h-8 px-3 rounded-lg bg-[#181D28] hover:bg-[#22293A] text-slate-200 border border-[#2B354D] text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>📋</span>
                  <span>Orders</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <TablesScreen
                branchId={currentBranchId || commerceBranchLink?.flow_branch_id || branchCapabilities?.branchId || "9c214659-9cc7-4f33-b115-cbbb8a823a94"}
                branchName={currentBranchName}
                restaurantId={currentRestaurantId}
                externalBranchId={String(commerceBranchLink?.external_branch_id || "1")}
                cashierName={activeCashier?.name || user?.name || "Cashier"}
                initialTableCode={activeTableContext?.tableCode || null}
                onOpenOrderInCart={async (orderId, tableCode, sessionId, guestCount, waiterName) => {
                  if (orderId) {
                    try {
                      const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders?type=all`);
                      const data = await res.json();
                      const ord = (data.orders || []).find((o: any) => o.id === orderId);
                      if (ord) {
                        loadOrderToTicket(ord, "POS");
                        setActiveTableContext({ orderId, tableCode, sessionId, guestCount, waiterName });
                        setPosActiveView('sell');
                        return;
                      }
                    } catch (e) {
                      console.error("Failed to load table order into ticket:", e);
                    }
                  }
                  // No existing commerce order yet (fresh table): start fresh ticket
                  setTicketItems([]);
                  setCustomerName(`Table ${tableCode}`);
                  setCustomerPhone("");
                  setDeliveryAddress("");
                  setSelectedChannel("POS");
                  setOrderType("dine_in");
                  setEditingOrderId(null);
                  setEditingOrderVersion(null);
                  setActiveTableContext({ orderId: null, tableCode, sessionId, guestCount, waiterName });
                  setPosActiveView('sell');
                }}
                onPrintPreCheckDoc={handlePrintPreCheckDoc}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* MAIN WORKSPACE: MATRIX ON LEFT & CART ON RIGHT */}
            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* LEFT AREA (65% Width): Categories Bar + Product Grid */}
              <div className="w-[65%] flex flex-col h-full overflow-hidden border-r border-[#262D3D]">
              {/* FLOW UPSELL RECOMMENDATIONS */}
              <UpsellRecommendationBar
                upsells={activeUpsells}
                onSelectProduct={handleQuickAddProduct}
                isProduct86d={isProduct86d}
              />

              {/* POS SCREEN MATRIX NAVIGATION & TILES */}
              <div className="flex-1 flex flex-col overflow-hidden bg-[#0C0F17]">
                {/* SCREEN HEADER & BREADCRUMBS */}
                <div className="px-4 py-3 bg-[#131722] border-b border-[#262D3D] flex items-center justify-between gap-3 flex-shrink-0">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {screenStack.length > 0 && (
                      <button
                        type="button"
                        onClick={handleBackToParentScreen}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-black text-xs border border-amber-500/40 flex items-center gap-1.5 transition active:scale-95 shadow cursor-pointer"
                      >
                        <span>←</span>
                        <span>Back</span>
                      </button>
                    )}

                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                      <button
                        type="button"
                        onClick={() => {
                          const root = posScreens.find(s => s.isRoot) || posScreens[0];
                          if (root) {
                            setScreenStack([]);
                            setCurrentScreenId(root.id);
                          }
                        }}
                        className={`hover:text-white transition ${activePosScreen?.isRoot ? 'text-amber-400 font-black text-sm' : ''}`}
                      >
                        Main Menu
                      </button>
                      {activePosScreen && !activePosScreen.isRoot && (
                        <>
                          <span className="text-slate-600">/</span>
                          <span className="text-white font-black text-sm">{activePosScreen.name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-semibold hidden sm:inline">
                      {activePosScreen?.buttons?.length || 0} items ({activeGridConfig.cols}×{activeGridConfig.rows})
                    </span>
                  </div>
                </div>

                {/* TOUCH SCREEN BUTTONS GRID: Pure Product Names Only with Dynamic 4-7 cols x 5-7 rows */}
                <div className="flex-1 overflow-y-auto p-4">
                  {(!activePosScreen || !activePosScreen.buttons || activePosScreen.buttons.length === 0) ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-[#222838] rounded-3xl my-auto">
                      <p className="text-slate-400 font-bold text-sm">No buttons configured on this screen.</p>
                      <button
                        type="button"
                        onClick={async () => {
                          const defaultScreens = (await import("../pos/services/posScreenService")).generateDefaultScreens(categories, products);
                          setPosScreens(defaultScreens);
                          savePosScreens(currentRestaurantId, defaultScreens);
                          const root = defaultScreens.find(s => s.isRoot) || defaultScreens[0];
                          if (root) setCurrentScreenId(root.id);
                        }}
                        className="mt-3 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition active:scale-95 cursor-pointer shadow-lg shadow-amber-500/20"
                      >
                        Rebuild From Menu Catalog
                      </button>
                    </div>
                  ) : (
                    <div
                      className="w-full align-content-start"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${activeGridConfig.cols}, minmax(0, 1fr))`,
                        gap: activeGridDensity.gap
                      }}
                    >
                      {activePosScreen.buttons.map((btn, idx) => {
                        const colorTheme = TILE_COLORS.find(c => c.id === btn.color) || TILE_COLORS[0];
                        const isSubscreen = btn.type === 'screen';

                        return (
                          <button
                            key={btn.id || idx}
                            type="button"
                            onClick={() => handleTouchButtonPress(btn)}
                            className={`${activeGridDensity.minHeight} ${activeGridDensity.padding} rounded-2xl border flex flex-col items-center justify-center text-center shadow-lg transition-all active:scale-95 cursor-pointer relative overflow-hidden group select-none ${
                              isSubscreen
                                ? `${colorTheme.bg} ${colorTheme.border} ring-1 ring-white/10 hover:border-amber-400`
                                : 'bg-[#161B26] hover:bg-[#1F2636] border-[#262F44] hover:border-amber-500/50'
                            }`}
                          >
                            {/* PURE BUTTON NAME ONLY (nothing else displayed) */}
                            <span className={`font-black ${activeGridDensity.fontSize} leading-tight tracking-wide line-clamp-3 ${
                              isSubscreen ? colorTheme.text : 'text-slate-100 group-hover:text-amber-300'
                            }`}>
                              {btn.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

        {/* RIGHT PANEL: TICKET CART & CHECKOUT (35% Width) */}
        <div className="w-[35%] flex flex-col h-full bg-[#14171F] overflow-hidden flex-shrink-0">
          {/* PRIMARY POS MODE BUTTONS: TABLES, SELL, ORDERS */}
          <div className="grid grid-cols-3 gap-2 p-2 bg-[#10131B] border-b border-[#262D3D] flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                refreshFloorTables();
                setPosActiveView('tables');
              }}
              className={`h-11 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm ${
                activeTableContext
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 ring-1 ring-amber-500/30'
                  : 'bg-[#181D28] hover:bg-[#22293A] text-slate-200 border border-[#2B354D]'
              }`}
              title="Open Floor Plan & Tables"
            >
              <span className="text-sm">🪑</span>
              <span className="truncate">{activeTableContext ? `Table ${activeTableContext.tableCode}` : 'Tables'}</span>
            </button>

            <button
              type="button"
              onClick={() => setPosActiveView('sell')}
              className={`h-11 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm ${
                posActiveView === 'sell'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 shadow-emerald-950/60'
                  : 'bg-[#181D28] hover:bg-[#22293A] text-slate-200 border border-[#2B354D]'
              }`}
              title="Sell Register"
            >
              <span className="text-sm">🏷️</span>
              <span>Sell</span>
            </button>

            <button
              type="button"
              onClick={() => setPosActiveView('orders')}
              className={`h-11 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm ${
                posActiveView === 'orders'
                  ? 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 shadow-blue-950/60'
                  : 'bg-[#181D28] hover:bg-[#22293A] text-slate-200 border border-[#2B354D]'
              }`}
              title="Orders Hub"
            >
              <span className="text-sm">📋</span>
              <span>Orders</span>
            </button>
          </div>

          {/* TICKET HEADER & UNIFIED SMART CHANNEL BAR */}
          <div className="p-3 border-b border-[#262D3D] space-y-2 bg-[#181C24] flex-shrink-0">
            {/* Active Table Context Bar */}
            {activeTableContext ? (
              <div className="bg-[#181C26] border border-[#2B354D] px-3 py-1.5 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-black">🪑 Table {activeTableContext.tableCode}</span>
                  {isCurrentTableOccupied && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/40">
                      Occupied
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {isCurrentTableOccupied ? (
                    /* Table already occupied: Cannot change table # directly; must Transfer */
                    <button
                      type="button"
                      onClick={() => {
                        setTransferTargetTableInput("");
                        setIsTransferModalOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition active:scale-95 shadow cursor-pointer flex items-center gap-1"
                      title="Transfer occupied table to another table"
                    >
                      <span>🔀</span>
                      <span>Transfer Table</span>
                    </button>
                  ) : (
                    /* Before order is entered: Option to change table */
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          refreshFloorTables();
                          setPosActiveView('tables');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-black text-xs border border-amber-500/40 transition active:scale-95 cursor-pointer flex items-center gap-1"
                        title="Change table before order is entered"
                      >
                        <span>🔄</span>
                        <span>Change Table</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleClearCurrentTable}
                        className="text-slate-400 hover:text-rose-300 text-xs font-bold px-1.5 py-0.5 cursor-pointer"
                        title="Clear table"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : editingOrderId ? (
              <div className="bg-blue-950/60 border border-blue-500/40 px-3 py-1.5 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="animate-pulse">✏️</span>
                  <span className="font-extrabold text-blue-300">Editing Order #{editingOrderId}</span>
                </div>
                <button
                  type="button"
                  onClick={handleResetCart}
                  className="text-[10px] font-bold text-gray-400 hover:text-white bg-[#181C24] px-2 py-0.5 rounded border border-[#262D3D]"
                >
                  Cancel Edit
                </button>
              </div>
            ) : null}

            {/* TICKET ACTIONS & STATUS HEADER BAR */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-white tracking-wider">
                  Current Order
                </span>
                {ticketItems.filter(i => !i.isHoldSeparator && i.name !== 'HOLD').length > 0 && (
                  <span className="px-2 py-0.5 bg-[#eb660c]/20 text-[#eb660c] text-[10px] font-black rounded-full border border-[#eb660c]/30">
                    {ticketItems.filter(i => !i.isHoldSeparator && i.name !== 'HOLD').reduce((sum, item) => sum + (Number(item.qty) || 1), 0)} items
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {(ticketItems.length > 0 || customerName || customerPhone || deliveryAddress || editingOrderId) && (
                  <button
                    type="button"
                    onClick={handleResetCart}
                    disabled={isSubmitting}
                    className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-500/50 rounded-lg text-[10px] font-extrabold transition-all active:scale-95 flex items-center gap-1 shadow-sm cursor-pointer"
                    title="Reset cart & clear ticket"
                  >
                    🗑️ Reset Cart
                  </button>
                )}
              </div>
            </div>

            {/* UNIFIED SMART CHANNEL BAR & CUSTOMER FIELDS (Hidden when at a Dine-In Table) */}
            {!activeTableContext && (
              <div className="space-y-2 pt-1 border-t border-[#262D3D]/60">
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
                        ? !selectedChannel || selectedChannel === "POS" || selectedChannel === "Pick-up"
                        : (selectedChannel || "").toLowerCase() === src.id.toLowerCase();

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
                {["WhatsApp", "App"].some(ch => (selectedChannel || "").toLowerCase() === ch.toLowerCase()) && (
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
                      placeholder={
                        orderType === "pickup" || (selectedChannel || "").toLowerCase().includes("pick")
                          ? "Customer Name (Optional)"
                          : "Customer Name *"
                      }
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if (validationError) setValidationError("");
                      }}
                      className={`w-full bg-[#0F1115] border ${
                        validationError &&
                        !customerName.trim() &&
                        orderType !== "pickup" &&
                        !(selectedChannel || "").toLowerCase().includes("pick") &&
                        !activeTableContext
                          ? "border-rose-500 ring-2 ring-rose-500/50 bg-rose-950/20"
                          : "border-[#262D3D]"
                      } rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 font-medium focus:outline-none focus:border-[#eb660c]`}
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

                  {/* ACTIVE SCHEDULED ORDER BADGE */}
                  {scheduledOrderTime && (
                    <div className="bg-purple-950/80 border border-purple-500/60 rounded-xl p-2.5 flex items-center justify-between text-xs shadow-lg animate-fade-in">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base">⏳</span>
                        <div className="min-w-0">
                          <div className="font-black text-purple-200 text-[11px] flex items-center gap-1.5">
                            <span>SCHEDULED ORDER</span>
                            <span className="text-[10px] bg-purple-800 text-purple-100 px-1.5 py-0.5 rounded font-bold">
                              {formatScheduledTimeDisplay(scheduledOrderDate, scheduledOrderTime)}
                            </span>
                          </div>
                          {scheduledOrderNote && (
                            <div className="text-[10px] text-purple-300 font-medium truncate mt-0.5">
                              Note: {scheduledOrderNote}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsScheduleModalOpen(true)}
                          className="px-2 py-1 text-[10px] font-bold text-purple-200 hover:text-white bg-purple-900/80 hover:bg-purple-800 rounded-lg transition"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setScheduledOrderTime("");
                            setScheduledOrderNote("");
                          }}
                          className="px-2 py-1 text-[10px] font-bold text-rose-300 hover:text-rose-100 bg-rose-950/50 hover:bg-rose-900 rounded-lg transition"
                          title="Remove schedule"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
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
              ticketItems.map((item, index) => {
                if (item.isHoldSeparator || item.name === 'HOLD') {
                  return (
                    <div
                      key={index}
                      className="my-2 py-2 px-3 rounded-xl bg-purple-950/70 border border-purple-500/60 flex items-center justify-between text-purple-200 shadow-sm"
                    >
                      <div className="flex items-center gap-2 text-xs font-black tracking-widest uppercase">
                        <span className="text-sm">⏸️</span>
                        <span>HOLD</span>
                        <span className="text-[10px] text-purple-300/80 font-medium normal-case tracking-normal">
                          (kitchen waits for fire)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTicketItem(index)}
                        className="text-purple-400 hover:text-rose-300 text-xs font-bold px-2 py-0.5 rounded-lg bg-black/40 hover:bg-black/60 transition cursor-pointer"
                        title="Remove Hold Line"
                      >
                        ✕
                      </button>
                    </div>
                  );
                }

                return (
                <div key={index} className="bg-[#181C24] border border-[#262D3D] rounded-xl p-2.5 space-y-1.5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-2">
                      <h5 className="font-extrabold text-xs text-white leading-tight">{item.name}</h5>
                      <div className="text-xs text-[#eb660c] font-black mt-0.5">
                        ${(item.unit_price * item.qty).toFixed(2)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTicketItem(index)}
                      className="text-gray-400 hover:text-rose-400 hover:bg-rose-950/40 p-1.5 rounded-lg text-sm transition-all active:scale-90 flex items-center justify-center cursor-pointer"
                      title="Remove Item from Ticket"
                    >
                      🗑️
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
              );
            })
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
                  {(selectedDiscountRule || (discountType !== "none" && discountAmount > 0)) ? (
                    <div className="flex items-center justify-between bg-amber-950/50 border border-amber-500/40 px-2 py-1 rounded-lg text-amber-300 text-xs font-extrabold">
                      <span
                        onClick={() => setShowDiscountModal(true)}
                        className="truncate cursor-pointer hover:underline"
                        title="Click to change discount"
                      >
                        {discountLabel} (-${discountAmount.toFixed(2)})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountType("none");
                          setSelectedDiscountRule(null);
                          setDiscountValInput(10);
                        }}
                        className="hover:text-white font-bold ml-1.5 p-0.5 text-xs text-amber-400 hover:text-white"
                        title="Remove discount"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowDiscountModal(true)}
                      className="px-2.5 py-1 bg-[#0F1115] border border-[#262D3D] hover:border-amber-400 rounded-lg text-[11px] font-extrabold text-amber-400 transition-all flex items-center gap-1"
                    >
                      <span>🏷️</span>
                      <span>+ Discount</span>
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
                  <div className="text-right">
                    <span className="font-black text-xl text-[#eb660c]">
                      ${total.toFixed(2)}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400 block -mt-0.5">
                      ≈ {Math.round(total * (exchangeRate || 89500)).toLocaleString()} LBP
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* 5 HORIZONTAL ACTION BUTTONS DOCK AT BOTTOM */}
      <div className="h-16 bg-[#131722] border-t-2 border-[#262D3D] px-4 py-2 flex items-center gap-2.5 flex-shrink-0 z-20 shadow-2xl">
        {/* 1 - Features */}
        <button
          type="button"
          onClick={() => setIsFeaturesModalOpen(true)}
          className="flex-1 h-full rounded-xl bg-[#1E2433] hover:bg-[#283042] active:scale-98 text-slate-200 hover:text-white font-black text-xs md:text-sm tracking-wider flex items-center justify-center gap-2 border border-[#3A455C] shadow-md transition cursor-pointer"
          title="Open POS Features: History, Store Control, Transfer Table, Shift"
        >
          <span className="text-base md:text-lg">⚙️</span>
          <span>Features</span>
        </button>

        {/* 2 - Place order (disabled in Sell mode or when no table) */}
        <button
          type="button"
          onClick={handleHoldOrder}
          disabled={ticketItems.length === 0 || isSubmitting || !activeTableContext}
          className={`flex-[1.1] h-full rounded-xl font-black text-xs md:text-sm tracking-wider flex items-center justify-center gap-2 border shadow-lg transition ${
            ticketItems.length === 0 || isSubmitting || !activeTableContext
              ? 'bg-[#181C24] text-slate-500 border-[#262D3D] opacity-40 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white border-emerald-400 shadow-emerald-950/50 cursor-pointer'
          }`}
          title={
            !activeTableContext
              ? "Place order is disabled in Sell mode. In Sell mode, please use 'Settle & close' to complete orders."
              : "Place and submit order to kitchen / table"
          }
        >
          <span className="text-base md:text-lg">🍽️</span>
          <span>{isSubmitting ? 'Placing...' : 'Place order'}</span>
        </button>

        {/* 3 - Hold */}
        <button
          type="button"
          onClick={handleInsertHold}
          disabled={ticketItems.length === 0}
          className={`flex-1 h-full rounded-xl active:scale-98 font-black text-xs md:text-sm tracking-wider flex items-center justify-center gap-2 border shadow-md transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            scheduledOrderTime && !activeTableContext
              ? 'bg-purple-900 text-white border-purple-400 ring-2 ring-purple-400/50 shadow-purple-950/60'
              : 'bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border-purple-500/50'
          }`}
          title={
            activeTableContext
              ? "Insert HOLD separator: tells kitchen to pause before next items"
              : scheduledOrderTime
              ? `Order scheduled for ${formatScheduledTimeDisplay(scheduledOrderDate, scheduledOrderTime)}. Click to edit.`
              : "Schedule order: set pickup / delivery ready time to print on kitchen ticket"
          }
        >
          <span className="text-base md:text-lg">⏳</span>
          <span>
            {activeTableContext
              ? "Hold"
              : scheduledOrderTime
              ? `Sched: ${scheduledOrderTime}`
              : "Hold"}
          </span>
        </button>

        {/* 4 - Fire */}
        <button
          type="button"
          onClick={handleKitchenFireChit}
          disabled={!isFireActive}
          className={`flex-[1.1] h-full rounded-xl active:scale-98 font-black text-xs md:text-sm tracking-wider flex items-center justify-center gap-2 border shadow-lg transition cursor-pointer ${
            isFireActive
              ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white border-red-400 shadow-red-900/50 animate-pulse'
              : 'bg-[#181C24] text-slate-500 border-[#262D3D] opacity-40 cursor-not-allowed'
          }`}
          title={
            currentTableHolds === 0
              ? "No held courses in this ticket. Insert 'Hold' between items to pace courses."
              : isFireActive
              ? `Fire next held course (${remainingFires} remaining)`
              : `All held courses have been fired (${currentTableFires}/${currentTableHolds})`
          }
        >
          <span className="text-base md:text-xl">🔥</span>
          <span>Fire {isFireActive ? `(${remainingFires})` : ''}</span>
        </button>

        {/* 5 - Settle & close (far right) */}
        <button
          type="button"
          onClick={() => {
            if (["toters", "noknok"].includes((selectedChannel || "").toLowerCase())) {
              handleFinalizePayment();
              return;
            }
            if (!isShiftOpen) {
              setIsOpenShiftModalOpen(true);
              return;
            }
            setIsTerminalPaymentModalOpen(true);
          }}
          disabled={ticketItems.length === 0 && !activeTableContext?.orderId && !editingOrderId}
          className="flex-[1.3] h-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-98 text-white font-black text-xs md:text-sm tracking-wider flex items-center justify-center gap-2 border border-blue-400 shadow-lg shadow-blue-900/40 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title="Collect payment and settle order / table"
        >
          <span className="text-base md:text-lg">💳</span>
          <span>Settle & close</span>
        </button>
      </div>
    </div>
  )}

      {/* SCHEDULE ORDER MODAL (Hold in Sell mode) */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-full max-w-md p-5 space-y-4 text-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-[#262D3D] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">⏳</span>
                <div>
                  <h3 className="font-black text-base text-white">Schedule Order (Hold)</h3>
                  <p className="text-[11px] text-gray-400">
                    Set target prep & ready time. Info prints on kitchen ticket.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-gray-400 hover:text-white font-bold p-1 text-sm rounded-lg hover:bg-[#262D3D]"
              >
                ✕
              </button>
            </div>

            {/* Quick Time Presets */}
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1.5">
                Quick Preset Ready Times:
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[15, 30, 45, 60, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => applyQuickSchedule(mins)}
                    className="px-2 py-2 rounded-xl bg-[#0F1115] hover:bg-purple-950/70 border border-[#262D3D] hover:border-purple-500/60 text-xs font-black text-purple-200 hover:text-white transition text-center"
                  >
                    +{mins < 60 ? `${mins}m` : `${mins / 60}h`}
                  </button>
                ))}
              </div>
            </div>

            {/* Date & Time Selectors */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-gray-400 block mb-1">
                  Target Ready Date:
                </label>
                <input
                  type="date"
                  value={scheduledOrderDate}
                  onChange={(e) => setScheduledOrderDate(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#262D3D] rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-400 block mb-1">
                  Target Ready Time:
                </label>
                <input
                  type="time"
                  value={scheduledOrderTime}
                  onChange={(e) => setScheduledOrderTime(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#262D3D] rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Special Kitchen Notes */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 block mb-1">
                Kitchen Prep & Pickup Note (prints on ticket):
              </label>
              <input
                type="text"
                placeholder="e.g. Customer will pick up curbside at 1:30 PM, pack sauces separately"
                value={scheduledOrderNote}
                onChange={(e) => setScheduledOrderNote(e.target.value)}
                className="w-full bg-[#0F1115] border border-[#262D3D] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 font-medium focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Preview Banner */}
            {scheduledOrderTime && (
              <div className="p-3 bg-purple-950/40 border border-purple-500/40 rounded-xl text-xs space-y-1">
                <div className="font-bold text-purple-300 flex items-center gap-1.5">
                  <span>🖨️</span>
                  <span>Kitchen Chit Print Preview:</span>
                </div>
                <div className="font-mono text-[11px] text-white bg-black/50 p-2.5 rounded-lg border border-purple-500/20 space-y-0.5">
                  <div className="font-bold text-amber-300">*** SCHEDULED ORDER ***</div>
                  <div className="text-purple-200 font-bold">
                    READY AT: {formatScheduledTimeDisplay(scheduledOrderDate, scheduledOrderTime)}
                  </div>
                  {scheduledOrderNote && <div className="text-gray-300">NOTE: {scheduledOrderNote}</div>}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#262D3D]">
              {scheduledOrderTime && (
                <button
                  type="button"
                  onClick={() => {
                    setScheduledOrderTime("");
                    setScheduledOrderNote("");
                    setIsScheduleModalOpen(false);
                  }}
                  className="px-3 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 font-bold text-xs transition"
                  title="Clear schedule"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#262D3D] hover:bg-[#323B4E] text-gray-300 hover:text-white font-bold text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!scheduledOrderTime) {
                    applyQuickSchedule(30);
                  }
                  setIsScheduleModalOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs transition shadow-lg shadow-purple-950/50"
              >
                Confirm Schedule
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!scheduledOrderTime) {
                    applyQuickSchedule(30);
                  }
                  setIsScheduleModalOpen(false);
                  await handleHoldOrder();
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black text-xs transition shadow-lg shadow-amber-950/50"
                title="Save scheduled order into held orders queue immediately and print kitchen chit"
              >
                Hold & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISCOUNT MODAL */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-full max-w-md p-5 space-y-4 text-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-[#262D3D] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base text-white">Apply Discount</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                    {currentBranchName}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Discounts applicable to {currentRestaurantName} • {currentBranchName}
                </p>
              </div>
              <button
                onClick={() => setShowDiscountModal(false)}
                className="text-gray-400 hover:text-white font-bold p-1 text-sm rounded-lg hover:bg-[#262D3D]"
              >
                ✕
              </button>
            </div>

            {/* Currently Applied Discount Banner (if active) */}
            {(selectedDiscountRule || (discountType !== "none" && discountAmount > 0)) && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Active Discount</span>
                  <span className="text-xs font-black text-white">{discountLabel} (-${discountAmount.toFixed(2)})</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType("none");
                    setSelectedDiscountRule(null);
                    setShowDiscountModal(false);
                  }}
                  className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 hover:text-white rounded-lg text-xs font-bold transition"
                >
                  Remove Discount
                </button>
              </div>
            )}

            {/* Applicable Branch Discounts */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-gray-400 tracking-wider">
                  Presets for {currentBranchName} ({applicableDiscounts.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscountModal(false);
                    setIsDiscountManagerOpen(true);
                  }}
                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 hover:underline"
                >
                  <span>⚙️ Manage Discounts</span>
                </button>
              </div>

              {applicableDiscounts.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#0F1115] border border-dashed border-[#262D3D] text-center">
                  <p className="text-xs text-gray-400 font-bold">No discount presets configured for this branch.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDiscountModal(false);
                      setIsDiscountManagerOpen(true);
                    }}
                    className="mt-2 text-xs font-black text-amber-400 underline"
                  >
                    + Add discounts for {currentRestaurantName}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {applicableDiscounts.map((rule) => {
                    const isSelected = selectedDiscountRule?.id === rule.id;
                    return (
                      <button
                        key={rule.id}
                        type="button"
                        onClick={() => {
                          if (rule.requires_manager_pin) {
                            const pin = prompt(`Manager approval required for "${rule.name}". Enter Manager PIN:`);
                            if (!pin) return;
                          }
                          setSelectedDiscountRule(rule);
                          setDiscountType("custom_rule");
                          setShowDiscountModal(false);
                        }}
                        className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                          isSelected
                            ? "bg-amber-500/20 border-amber-500 text-white shadow"
                            : "bg-[#0F1115] border-[#262D3D] hover:border-amber-500/50 text-white"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-extrabold truncate">{rule.name}</span>
                          {rule.requires_manager_pin && (
                            <span className="text-[10px]" title="Requires Manager Approval">🔒</span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className={`text-xs font-black px-1.5 py-0.5 rounded ${
                            rule.type === 'percent'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                              : 'bg-sky-950 text-sky-400 border border-sky-500/30'
                          }`}>
                            {rule.type === 'percent' ? `${rule.value}% OFF` : `$${rule.value} OFF`}
                          </span>
                          <span className="text-[9px] text-gray-400 font-medium">
                            {rule.apply_to_all_branches ? '🌐 All' : '📍 Branch'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Custom Manual Discount Entry */}
            <div className="pt-3 border-t border-[#262D3D] space-y-2">
              <span className="text-xs font-bold text-gray-400 block">Or Custom Discount Value:</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="e.g. 10"
                  value={discountValInput}
                  onChange={(e) => setDiscountValInput(e.target.value)}
                  className="flex-1 bg-[#0F1115] border border-[#262D3D] rounded-xl px-3 py-2 text-xs text-white font-bold placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setDiscountIsPercent(!discountIsPercent)}
                  className="px-3 py-2 bg-[#262D3D] hover:bg-[#323B4E] rounded-xl text-xs font-extrabold text-amber-400 border border-[#3A455C] transition"
                >
                  {discountIsPercent ? "%" : "$ USD"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDiscountRule(null);
                    setDiscountType("custom");
                    setShowDiscountModal(false);
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow transition"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Manage Discounts Button in Modal Footer */}
            <div className="pt-2 border-t border-[#262D3D] flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setShowDiscountModal(false);
                  setIsDiscountManagerOpen(true);
                }}
                className="text-xs text-gray-400 hover:text-amber-400 font-bold flex items-center gap-1.5 transition"
              >
                <span>🏷️ Configure Discounts for {currentRestaurantName}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDiscountModal(false)}
                className="px-4 py-1.5 bg-[#262D3D] hover:bg-[#323B4E] text-gray-300 font-bold text-xs rounded-xl"
              >
                Close
              </button>
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

              <div className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-400 text-xs block uppercase tracking-wider">
                    Restaurant & Branch Discounts:
                  </span>
                  <span className="text-[10px] text-gray-400 font-bold">
                    {restaurantDiscounts.length} configured
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Configure discounts for {currentRestaurantName} and choose whether they apply to all branches or separate branches.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTabModal(null);
                    setIsDiscountManagerOpen(true);
                  }}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl transition-all text-xs border border-amber-400 flex items-center justify-center gap-2 shadow"
                >
                  🏷️ Manage Discounts & Branch Scopes
                </button>
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
                        onClick={() => loadOrderToTicket(o, "WhatsApp")}
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
                      {o.claimed_terminal && (
                        <div className="mt-1 px-2 py-0.5 bg-amber-950/80 text-amber-300 border border-amber-500/50 rounded text-[10px] font-bold inline-flex items-center gap-1">
                          <span>🔒</span> In Use: {o.claimed_by || "Cashier"} ({o.claimed_terminal})
                        </div>
                      )}
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
                        onClick={() => handleRestoreHeldTicket(o)}
                        className={`px-4 py-2 text-white font-black rounded-xl shadow-md flex items-center gap-1 ${
                          o.claimed_terminal && o.claimed_terminal !== posTerminalId
                            ? "bg-amber-600 hover:bg-amber-500"
                            : "bg-[#eb660c] hover:bg-[#d55909]"
                        }`}
                      >
                        <span>{o.claimed_terminal && o.claimed_terminal !== posTerminalId ? "Claim Ticket" : "Restore Ticket"}</span>
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
                      {ordersGroup.map((order) => {
                        const isCompleted =
                          (order.status || "").toLowerCase() === "completed" ||
                          (order.status || "").toLowerCase() === "delivered";
                        const isCancelled =
                          (order.status || "").toLowerCase() === "cancelled" ||
                          (order.status || "").toLowerCase() === "rejected";
                        const canEdit = !isCompleted && !isCancelled;

                        return (
                          <div
                            key={order.id}
                            onClick={() => {
                              if (canEdit) {
                                loadOrderToTicket(order, order.order_source || "POS");
                                setActiveTabModal(null);
                              }
                            }}
                            className={`p-4 bg-[#0F1115] border border-[#262D3D] rounded-xl space-y-3 text-xs shadow-sm transition-all ${
                              canEdit
                                ? "hover:border-[#eb660c] cursor-pointer"
                                : "hover:border-[#3A455C]"
                            }`}
                          >
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
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-extrabold uppercase border ${
                                      isCompleted
                                        ? "bg-slate-800 text-slate-300 border-slate-700"
                                        : isCancelled
                                        ? "bg-rose-950 text-rose-300 border-rose-800"
                                        : "bg-emerald-950 text-emerald-300 border-emerald-500/30"
                                    }`}>
                                      {order.status}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-gray-400 font-medium">
                                  🕒 {order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Time N/A"} • Payment: <strong className="text-white">{order.payment_method || "Cash"}</strong>
                                </div>
                              </div>

                              <div className="text-right flex flex-col items-end gap-1.5">
                                <div className="text-xl font-black text-[#eb660c]">${parseFloat(order.total_amount || 0).toFixed(2)}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {canEdit ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        loadOrderToTicket(order, order.order_source || "POS");
                                        setActiveTabModal(null);
                                      }}
                                      className="px-3 py-1.5 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-[11px] font-extrabold shadow-sm flex items-center gap-1 transition active:scale-95"
                                    >
                                      ✏️ Edit in POS
                                    </button>
                                  ) : (
                                    <span className="text-[10px] font-bold text-gray-400 bg-[#181C24] px-2 py-1 rounded-lg border border-[#262D3D]">
                                      🔒 {isCompleted ? "Completed" : "Locked"}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReprintOrder(order);
                                    }}
                                    className="px-3 py-1.5 bg-[#eb660c] hover:bg-[#d55909] text-white rounded-xl text-[11px] font-extrabold shadow-sm flex items-center gap-1 transition active:scale-95"
                                  >
                                    🖨️ Reprint
                                  </button>
                                  {!isCancelled && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const items: CanceledItemDetail[] = (order.items || []).map((i: any) => ({
                                          name: i.product_name || i.name || 'Item',
                                          qty: i.quantity || i.qty || 1,
                                          price: i.unit_price || 0
                                        }));
                                        setVoidModalState({
                                          isOpen: true,
                                          orderId: order.id,
                                          items,
                                          voidType: isCompleted ? 'refund' : 'order_cancellation',
                                          onSuccess: () => {
                                            fetchOrderHistory();
                                          }
                                        });
                                      }}
                                      className="px-2.5 py-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-500/40 rounded-xl text-[11px] font-extrabold shadow-sm flex items-center gap-1 transition active:scale-95"
                                      title="Void or Cancel order with FLOW audit"
                                    >
                                      🛡️ Void
                                    </button>
                                  )}
                                </div>
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
                      );
                    })}
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
    
      {/* UNMAPPED BRANCH BLOCKING ALERT */}
      {!isResolvingBranch && branchMappingError && (
        <BranchMappingAlert
          branchName={selectedTerminalBranch || activeCashier?.branch || user?.branch || "All"}
          errorMessage={branchMappingError}
          restaurantName={user?.restaurants?.name || (user?.restaurant_id === '4c0ed960-e459-42c4-962f-41229a2d3783' ? 'The Bistro' : 'Neo Beirut')}
          availableBranches={availableCommerceBranches}
          onSelectBranch={handleSelectTerminalBranch}
          onRetry={() => resolveActiveBranch()}
          onExit={onExit}
        />
      )}



      {/* TERMINAL PAYMENT & DUAL CURRENCY CHANGE MODAL */}
      <TerminalPaymentModal
        isOpen={isTerminalPaymentModalOpen}
        onClose={() => setIsTerminalPaymentModalOpen(false)}
        totalUsd={total}
        exchangeRate={exchangeRate}
        isTable={Boolean(activeTableContext)}
        tableCode={activeTableContext?.tableCode}
        guestCount={activeTableContext?.guestCount}
        waiterName={activeTableContext?.waiterName || user?.name}
        orderType={orderType}
        isSubmitting={isSubmitting}
        onConfirmPayment={async (paymentDetails) => {
          await handleFinalizePayment(paymentDetails);
        }}
      />

      {/* OPEN SHIFT CASH MODAL */}
      <OpenShiftModal
        isOpen={isOpenShiftModalOpen}
        onClose={() => setIsOpenShiftModalOpen(false)}
        branchName={commerceBranchLink?.flow_branch_name || user?.branch || "Cloud Kitchen"}
        cashierName={activeCashier?.name || user?.name || "Cashier"}
        onConfirm={handleOpenShift}
      />

      {/* PHASE 6 CLOSE SHIFT CASH MODAL */}
      <CloseShiftModal
        isOpen={isCloseShiftModalOpen}
        onClose={() => setIsCloseShiftModalOpen(false)}
        shift={activeShift}
        branchName={commerceBranchLink?.flow_branch_name || user?.branch || "Cloud Kitchen"}
        branchId={commerceBranchLink?.flow_branch_id}
        locationKey={commerceBranchLink?.location_key || "cloud-kitchen"}
        terminalId={activeShift?.terminal_id || persistentTerminalId}
        cashierName={activeCashier?.name || user?.name || "Cashier"}
        onShiftClosed={(closedShift, recon) => {
          setLastClosedShift(closedShift);
          setShiftReportData(recon);
          setReportModalMode('CLOSE');
          setIsShiftReportModalOpen(true);
        }}
      />

      {/* PHASE 6 SHIFT REPORT MODAL (X Report & Shift Close Report) */}
      <ShiftReportModal
        isOpen={isShiftReportModalOpen}
        onClose={() => setIsShiftReportModalOpen(false)}
        shift={reportModalMode === 'X' ? activeShift : (lastClosedShift || activeShift)}
        reconciliation={shiftReportData}
        isXReport={reportModalMode === 'X'}
      />

      {/* PHASE 6 DAILY BRANCH STORE CONTROL DASHBOARD */}
      {isDailyControlOpen && (
        <DailyBranchControlScreen
          branchIdentifier={commerceBranchLink?.flow_branch_id || commerceBranchLink?.flow_branch_name || user?.branch || "Cloud Kitchen"}
          branchName={commerceBranchLink?.flow_branch_name || user?.branch || "Cloud Kitchen"}
          onClose={() => setIsDailyControlOpen(false)}
          onSelectShiftReport={async (selectedShift) => {
            const res = await calculateShiftReconciliation({
              locationKey: commerceBranchLink?.location_key || 'cloud-kitchen',
              shiftId: selectedShift.id,
              startTime: selectedShift.created_at,
              endTime: selectedShift.closed_at || undefined,
              terminalId: selectedShift.terminal_id || persistentTerminalId,
              openingUsd: Number(selectedShift.opening_usd || 0),
              openingLbp: Number(selectedShift.opening_lbp || 0)
            });
            if (res.success && res.summary) {
              setLastClosedShift(selectedShift);
              setShiftReportData(res.summary);
              setReportModalMode('CLOSE');
              setIsShiftReportModalOpen(true);
            }
          }}
        />
      )}

      {/* PHASE 6 PILOT OPERATIONAL INCIDENT LOG */}
      <PilotIncidentLog
        incidents={pilotIncidents}
        onClearIncidents={() => setPilotIncidents([])}
      />

      {/* FLOW VOID TRANSACTION MODAL */}
      <VoidItemModal
        isOpen={voidModalState.isOpen}
        onClose={() => setVoidModalState(prev => ({ ...prev, isOpen: false }))}
        orderId={voidModalState.orderId}
        items={voidModalState.items}
        currentUser={activeCashier || user}
        voidType={voidModalState.voidType}
        onConfirmVoid={handleExecuteVoid}
      />

      {/* CASHIER PIN LOCK & SWITCH MODAL */}
      {isCashierModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-2xl mb-3">
              🔒
            </div>
            <h3 className="text-lg font-black text-white">Switch Cashier</h3>
            <p className="text-xs text-gray-400 mt-1 mb-4">
              Enter your 4-digit FLOW PIN code to sign in to this terminal.
            </p>

            {/* PIN display dots */}
            <div className="flex items-center justify-center gap-3 mb-4">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    pinInput.length > idx
                      ? "bg-blue-500 border-blue-400 scale-110"
                      : "border-gray-600 bg-transparent"
                  }`}
                />
              ))}
            </div>

            {pinError && (
              <div className="mb-3 text-xs font-bold text-rose-400 bg-rose-950/60 border border-rose-500/40 px-3 py-1.5 rounded-lg">
                ⚠️ {pinError}
              </div>
            )}

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2 w-full max-w-[240px] mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => {
                    if (pinInput.length < 4) {
                      const next = pinInput + digit;
                      setPinInput(next);
                      if (next.length === 4) handleCashierPinSubmit(next);
                    }
                  }}
                  className="h-12 bg-[#222734] hover:bg-[#2e3547] active:scale-95 text-white font-black text-lg rounded-xl transition border border-[#2D3548]"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPinInput('')}
                className="h-12 bg-gray-800/40 hover:bg-gray-800 text-gray-400 font-bold text-xs rounded-xl transition border border-[#2D3548]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pinInput.length < 4) {
                    const next = pinInput + '0';
                    setPinInput(next);
                    if (next.length === 4) handleCashierPinSubmit(next);
                  }
                }}
                className="h-12 bg-[#222734] hover:bg-[#2e3547] active:scale-95 text-white font-black text-lg rounded-xl transition border border-[#2D3548]"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setPinInput(prev => prev.slice(0, -1))}
                className="h-12 bg-gray-800/40 hover:bg-gray-800 text-gray-400 font-bold text-base rounded-xl transition border border-[#2D3548]"
              >
                ⌫
              </button>
            </div>

            <div className="flex gap-2 w-full">
              <button
                type="button"
                onClick={() => { setIsCashierModalOpen(false); setPinInput(''); setPinError(''); }}
                className="flex-1 py-2.5 bg-gray-700/40 hover:bg-gray-700 text-gray-300 font-bold text-xs rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCashierPinSubmit()}
                disabled={pinInput.length === 0 || isVerifyingPin}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-blue-600/30"
              >
                {isVerifyingPin ? "Verifying..." : "Confirm PIN"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESTAURANT & BRANCH DISCOUNT MANAGER MODAL */}
      <DiscountManagerModal
        isOpen={isDiscountManagerOpen}
        onClose={() => setIsDiscountManagerOpen(false)}
        restaurantId={currentRestaurantId}
        restaurantName={currentRestaurantName}
        currentBranchId={currentBranchId}
        currentBranchName={currentBranchName}
        onDiscountsUpdated={(newDiscounts) => {
          setRestaurantDiscounts(newDiscounts);
        }}
      />

      {/* FEATURES MODAL */}
      {isFeaturesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-3xl w-full max-w-xl p-6 space-y-4 text-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#262D3D] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚙️</span>
                <h3 className="font-black text-lg text-white">POS Features</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFeaturesModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-[#262D3D] text-gray-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            {/* Terminal Info: Locked Branch, Cashier, Shift Status */}
            <div className="p-3 bg-[#1F2430] border border-[#2D3548] rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">📍</span>
                <span className="text-gray-400">Branch:</span>
                <span className="text-white font-extrabold">{currentBranchName}</span>
                <span className="text-[10px] text-gray-400 bg-black/50 px-1.5 py-0.5 rounded font-mono border border-white/5">🔒 Fixed</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-400">Cashier: <strong className="text-white">{activeCashier?.name || user?.name || "Staff"}</strong></span>
                <span className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] ${
                  isShiftOpen ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {isShiftOpen ? '🟢 SHIFT OPEN' : '🔴 SHIFT CLOSED'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {/* Order History */}
              <button
                type="button"
                onClick={() => {
                  setIsFeaturesModalOpen(false);
                  fetchOrderHistory();
                  setActiveTabModal("history");
                }}
                className="p-3 rounded-2xl bg-[#222734] hover:bg-[#2c3344] border border-[#2D3548] flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">📜</span>
                <span className="font-extrabold text-xs text-gray-200 group-hover:text-white">Order History</span>
                <span className="text-[10px] text-gray-400">Past bills & receipts</span>
              </button>

              {/* Store Control */}
              <button
                type="button"
                onClick={() => {
                  setIsFeaturesModalOpen(false);
                  setIsDailyControlOpen(true);
                }}
                className="p-3 rounded-2xl bg-[#222734] hover:bg-[#2c3344] border border-[#2D3548] flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">🏪</span>
                <span className="font-extrabold text-xs text-gray-200 group-hover:text-white">Store Control</span>
                <span className="text-[10px] text-gray-400">Status, 86 items</span>
              </button>

              {/* Transfer Table */}
              <button
                type="button"
                onClick={() => {
                  setIsFeaturesModalOpen(false);
                  if (!activeTableContext) {
                    alert("Please select or open an active table first to transfer.");
                    return;
                  }
                  setTransferTargetTableInput("");
                  setIsTransferModalOpen(true);
                }}
                className="p-3 rounded-2xl bg-[#222734] hover:bg-[#2c3344] border border-[#2D3548] flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">🔀</span>
                <span className="font-extrabold text-xs text-gray-200 group-hover:text-white">Transfer Table</span>
                <span className="text-[10px] text-gray-400">Move table to another</span>
              </button>

              {/* Screen Builder */}
              <button
                type="button"
                onClick={() => {
                  setIsFeaturesModalOpen(false);
                  window.location.hash = '#/pos-screens';
                }}
                className="p-3 rounded-2xl bg-[#222734] hover:bg-[#2c3344] border border-[#2D3548] flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">🎨</span>
                <span className="font-extrabold text-xs text-gray-200 group-hover:text-white">Screen Builder</span>
                <span className="text-[10px] text-gray-400">Customize POS screens</span>
              </button>

              {/* Shift / Drawer */}
              <button
                type="button"
                onClick={() => {
                  setIsFeaturesModalOpen(false);
                  if (!activeShift) {
                    setIsOpenShiftModalOpen(true);
                  } else {
                    setIsCloseShiftModalOpen(true);
                  }
                }}
                className="p-3 rounded-2xl bg-[#222734] hover:bg-[#2c3344] border border-[#2D3548] flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">💼</span>
                <span className="font-extrabold text-xs text-gray-200 group-hover:text-white">Shift / Drawer</span>
                <span className="text-[10px] text-gray-400">{activeShift ? 'Close / X-Report' : 'Open Shift Float'}</span>
              </button>

              {/* Lock Screen / Switch Cashier */}
              <button
                type="button"
                onClick={() => {
                  setIsFeaturesModalOpen(false);
                  setIsPinLockOpen(true);
                }}
                className="p-3 rounded-2xl bg-[#222734] hover:bg-[#2c3344] border border-[#2D3548] flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">🔒</span>
                <span className="font-extrabold text-xs text-gray-200 group-hover:text-white">Lock / Switch PIN</span>
                <span className="text-[10px] text-gray-400">Switch cashier staff</span>
              </button>

              {/* Floor Plan Tables */}
              {Boolean(branchCapabilities?.table_service) && (
                <button
                  type="button"
                  onClick={() => {
                    setIsFeaturesModalOpen(false);
                    setPosActiveView('tables');
                  }}
                  className="p-3 rounded-2xl bg-[#222734] hover:bg-[#2c3344] border border-[#2D3548] flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">🪑</span>
                  <span className="font-extrabold text-xs text-gray-200 group-hover:text-white">Floor Tables</span>
                  <span className="text-[10px] text-gray-400">View dining tables</span>
                </button>
              )}

              {/* Orders Hub */}
              <button
                type="button"
                onClick={() => {
                  setIsFeaturesModalOpen(false);
                  setPosActiveView('orders');
                }}
                className="p-3 rounded-2xl bg-[#222734] hover:bg-[#2c3344] border border-[#2D3548] flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">📋</span>
                <span className="font-extrabold text-xs text-gray-200 group-hover:text-white">Orders Hub</span>
                <span className="text-[10px] text-gray-400">Online & branch orders</span>
              </button>

              {/* POS Settings */}
              <button
                type="button"
                onClick={() => {
                  setIsFeaturesModalOpen(false);
                  setActiveTabModal("settings");
                }}
                className="p-3 rounded-2xl bg-[#222734] hover:bg-[#2c3344] border border-[#2D3548] flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">⚙️</span>
                <span className="font-extrabold text-xs text-gray-200 group-hover:text-white">POS Settings</span>
                <span className="text-[10px] text-gray-400">Printers & hardware</span>
              </button>

              {/* Exit POS under Features */}
              {onExit && (
                <button
                  type="button"
                  onClick={() => {
                    setIsFeaturesModalOpen(false);
                    onExit();
                  }}
                  className="p-3 rounded-2xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer sm:col-span-3"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">🚪</span>
                  <span className="font-extrabold text-xs text-rose-300 group-hover:text-white">Exit POS</span>
                  <span className="text-[10px] text-rose-400/80">Return to Admin Operations Portal</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TRANSFER TABLE MODAL */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-3xl w-full max-w-sm p-6 space-y-4 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#262D3D] pb-3">
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <span>🔀</span> Transfer Table
              </h3>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="text-gray-400 hover:text-white font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Transfer current ticket from <strong className="text-amber-400">Table {activeTableContext?.tableCode}</strong> to another table:
            </p>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Destination Table # (e.g. 8, T12)
              </label>
              <input
                type="text"
                value={transferTargetTableInput}
                onChange={(e) => setTransferTargetTableInput(e.target.value)}
                placeholder="Enter destination table number..."
                className="w-full bg-[#10131A] border border-[#262D3D] rounded-xl px-3 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-amber-400"
                autoFocus
              />

              {/* Touch keypad for destination table */}
              <div className="grid grid-cols-3 gap-1.5 pt-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setTransferTargetTableInput(prev => prev + d)}
                    className="h-10 bg-[#121620] hover:bg-[#1C2232] text-white font-black text-sm rounded-xl border border-[#262F44] transition active:scale-95 cursor-pointer"
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTransferTargetTableInput('')}
                  className="h-10 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-bold text-xs rounded-xl border border-rose-500/30 transition active:scale-95 cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setTransferTargetTableInput(prev => prev + '0')}
                  className="h-10 bg-[#121620] hover:bg-[#1C2232] text-white font-black text-sm rounded-xl border border-[#262F44] transition active:scale-95 cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setTransferTargetTableInput(prev => prev.slice(0, -1))}
                  className="h-10 bg-[#1E2333] hover:bg-[#283147] text-amber-400 font-black text-sm rounded-xl border border-[#2C364D] transition active:scale-95 cursor-pointer"
                  title="Backspace"
                >
                  ⌫
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-700/50 hover:bg-gray-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const dest = transferTargetTableInput.trim().toUpperCase();
                  if (!dest) {
                    alert("Please enter a destination table number.");
                    return;
                  }
                  if (dest === String(activeTableContext?.tableCode).toUpperCase()) {
                    alert("Destination table cannot be the same as current table.");
                    return;
                  }

                  const prevTable = activeTableContext?.tableCode;
                  setActiveTableContext(prev => prev ? { ...prev, tableCode: dest } : null);
                  setCustomerName(`Table ${dest}`);
                  setIsTransferModalOpen(false);
                  refreshFloorTables();
                  alert(`✅ Order successfully transferred from Table ${prevTable} to Table ${dest}!`);
                }}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 cursor-pointer"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}


      {/* PIN LOCK SCREEN OVERLAY */}
      {isPinLockOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center">
          <div className="w-full max-w-md p-4">
            <PosPinScreen
              isLockScreen={true}
              initialRestaurantId={currentRestaurantId}
              onCancelLock={() => setIsPinLockOpen(false)}
              onSuccess={(cashierUser) => {
                setActiveCashier(cashierUser);
                setIsPinLockOpen(false);
              }}
            />
          </div>
        </div>
      )}
</div>
  );
}
