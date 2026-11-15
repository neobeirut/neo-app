import { loadPreparingOrders } from '../pos/services/preparingOrders';
import { restoreModifiers } from '../pos/services/posInventory';
import InventorySyncNotice from '../pos/components/InventorySyncNotice';

import React, { useState, useEffect, useRef, useMemo } from "react";
import { api } from "../api/client";
import { supabase, getGlobalRestaurantId, setGlobalRestaurantId } from "../api/supabase";
import { sessionLogger } from "../utils/sessionLogger";

import { resolveCommerceBranchLink, getBranchCapabilities } from "../pos/services/branchMapping";
import type { CommerceBranchLink } from "../pos/types/commerce";
import type { BranchCapabilities } from "../pos/services/branchMapping";
import { TablesScreen, getOrCreateTableAndSession, loadFloorState, closeTableSession, requestBill, deleteTable } from "../pos/tables";
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
import { OverdueShiftModal } from "../pos/components/OverdueShiftModal";
import { ManagerHeldShiftsModal } from "../pos/components/ManagerHeldShiftsModal";
import type { ShiftCashRecord } from "../pos/services/shiftCashBridge";
import { resolveShiftEligibility, getClosedAmShift, getDrawerTerminalAliases } from "../pos/services/shiftCashBridge";
import { loadShiftReportingPeriod } from '../pos/services/shiftReportingPeriod';
import { DailyPaymentsModal } from "../pos/components/DailyPaymentsModal";
import { SupplierInvoicesModal } from "../pos/components/SupplierInvoicesModal";
import { ConceptCashModal } from "../pos/components/ConceptCashModal";
import { DriverHandoverModal } from "../pos/components/DriverHandoverModal";
import { ShiftReportModal } from "../pos/components/ShiftReportModal";
import PosPinScreen from "../pos/components/PosPinScreen";
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
import { ThermalReceiptPreviewModal, type ThermalReceiptData } from "../pos/components/ThermalReceiptPreviewModal";
import { useRestaurantTheme } from "../pos/theme/useRestaurantTheme";
import {
  buildPreparationPrintJobs,
  buildMainBillPrintJob,
  buildCancellationPrintJobs,
  dispatchPhysicalPrintJobs,
  loadBranchPrinterConfig,
  isCourseHoldItem
} from "../pos/services/ticketRoutingService";

const safeTimeoutSignal = (ms: number) => typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? safeTimeoutSignal(ms) : undefined;
import { fireOrderRound, getBranchLocationKey } from "../pos/kds";
import { CustomerSearchModal } from "../pos/components/CustomerSearchModal";
import {
  hasPosPermission,
  loadRestaurantRolePermissions,
  type PosPermissionKey
} from "../pos/services/posPermissionService";
import {
  PosSupervisorAuthModal,
  type SupervisorAuthRequest
} from "../pos/components/PosSupervisorAuthModal";
import { TableTransferModal } from "../pos/components/TableTransferModal";
import { ConceptWorkspaceSwitcher } from "../pos/components/ConceptWorkspaceSwitcher";
import FullscreenToggleButton from "../pos/components/FullscreenToggleButton";
import { posWorkspaceService, KNOWN_CONCEPT_PROFILES, type TerminalWorkspaceState } from "../pos/services/posWorkspaceService";

interface PosTerminalScreenProps {
  user?: any;
  onExit?: () => void;
}

import { COMMERCE_API_BASE, DRIVER_DISPATCH_API_BASE, HAS_COMMERCE_API } from "../pos/config";
import { fetchPosCatalog, resolveEffectivePosPrice, resolveEffectivePosImage } from "../pos/services/posCatalogService";
import { fetchPosScreens, savePosScreens, TILE_COLORS, calculateDynamicGrid, getGridButtonDensity } from "../pos/services/posScreenService";
import type { PosScreen, PosScreenButton } from "../pos/types/posScreen";
import {
  createDirectOrder,
  updateDirectOrderStatus,
  fetchDirectOrders,
  claimDirectOrder,
  reversePosOrderInventory,
  resolveCanonicalSalesChannel
} from "../pos/services/posOrderService";


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

    const rawName = (obj.name || obj.ingredient || obj.customization_name || "").trim();
    if (!rawName) return;
    const nameStr = obj.parent_option_name ? `${obj.parent_option_name} → ${rawName}` : rawName;

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

    const isInc = Boolean(
      obj.option_group_name?.toLowerCase().includes('included') ||
      obj.name?.toLowerCase().includes('(included)') ||
      obj.ingredient?.toLowerCase().includes('(included)') ||
      obj.is_default
    );
    const qty = Number(obj.quantity || obj.qty || 1);
    const displayName = !isInc && qty > 1 ? `${nameStr} ×${qty}` : nameStr;

    if (isRemoval) {
      removals.push(cleanName || nameStr);
    } else {
      addons.push(displayName);
    }
  });

  return { addons, removals };
};

// OVR LOAD Tablet POS System v2.6.0 - Auto WhatsApp Location Sync
export default function PosTerminalScreen({ user, onExit }: PosTerminalScreenProps) {
  const { primaryColor, primaryHover, primaryText } = useRestaurantTheme();

  // FLOW Branch Mapping State
  const [commerceBranchLink, setCommerceBranchLink] = useState<CommerceBranchLink | null>(null);
  const [branchMappingError, setBranchMappingError] = useState<string | null>(null);
  const [isResolvingBranch, setIsResolvingBranch] = useState(true);

  // Dynamic Restaurant & Branch Identity Resolution (Lifted to top for strict tenant isolation)
  const currentRestaurantId =
    commerceBranchLink?.restaurant_id ||
    user?.restaurant_id ||
    user?.restaurants?.id ||
    getGlobalRestaurantId() ||
    '79256f11-a9f8-4fec-901d-69baf929762d';

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
  const [posActiveView, setPosActiveView] = useState<'sell' | 'tables' | 'orders'>(() => {
    if (typeof window !== 'undefined' && window.location.hash.toLowerCase().includes('orders')) {
      return 'orders';
    }
    return 'sell';
  });

  useEffect(() => {
    const handleHashCheck = () => {
      if (typeof window !== 'undefined' && window.location.hash.toLowerCase().includes('orders')) {
        setPosActiveView('orders');
      }
    };
    window.addEventListener('hashchange', handleHashCheck);
    return () => window.removeEventListener('hashchange', handleHashCheck);
  }, []);
  const [branchCapabilities, setBranchCapabilities] = useState<BranchCapabilities | null>(null);
  const [activeTableContext, setActiveTableContext] = useState<{
    orderId?: number | string | null;
    tableCode: string;
    sessionId?: string;
    tableId?: string;
    isNewlyCreated?: boolean;
    guestCount?: number;
    waiterName?: string;
    isExistingOccupied?: boolean;
  } | null>(null);

  // Quick Table Input State (Type table # on-demand)
  const [quickTableInput, setQuickTableInput] = useState("");
  const [isQuickTableLoading, setIsQuickTableLoading] = useState(false);

  // Live Floor Tables
  const tableNavigationSaving = useRef(false);
  const [isSavingTableNavigation, setIsSavingTableNavigation] = useState(false);
  const [branchFloorTables, setBranchFloorTables] = useState<PosTable[]>([]);

  // Cashier PIN Lock & Fast Switch States
  const [activeCashier, setActiveCashier] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('pos_current_cashier');
      if (saved) return JSON.parse(saved);
    } catch {}
    return user || null;
  });
  const [isCashierModalOpen, setIsCashierModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // Customer Search Modal State
  const [customerSearchTab, setCustomerSearchTab] = useState<'phone' | 'name'>('phone');
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);

  // Admin & Role helper
  const currentUserRole = (activeCashier?.role || user?.role || '').toLowerCase();
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'manager' || currentUserRole === 'superadmin' || Boolean(user?.is_super_admin);
  const isTableAdmin = (currentUserRole === 'admin' || currentUserRole === 'superadmin' || Boolean(user?.is_super_admin)) && currentUserRole !== 'manager';

  // Multi-Concept Workspace State (Phase 2)
  const [workspaceState, setWorkspaceState] = useState<TerminalWorkspaceState>(() => {
    return posWorkspaceService.getInitialWorkspaceState(user);
  });
  // Separate draft carts per concept to prevent discarding cashier work during switching
  const [conceptDraftCarts, setConceptDraftCarts] = useState<Record<string, any[]>>({});

  const handleWorkspaceChanged = async (newState: TerminalWorkspaceState) => {
    const prevConceptId = workspaceState.activeConcept.id;
    const nextConceptId = newState.activeConcept.id;

    // 1. Preserve active cart items for current concept
    setConceptDraftCarts(prev => ({
      ...prev,
      [prevConceptId]: ticketItems
    }));

    // 2. Restore preserved draft cart for target concept (if any)
    const preservedItems = conceptDraftCarts[nextConceptId] || [];
    setTicketItems(preservedItems);
    setWorkspaceState(newState);
    setHasPromptedShiftClosed(false);

    try {
      const data = await fetchPosCatalog(currentRestaurantId, currentBranchId || commerceBranchLink?.flow_branch_id, newState.activeConcept.id);
      if (data.categories) setCategories(data.categories);
      if (data.products) setProducts(data.products);

      // Rebuild touch screen matrix specifically for the newly activated concept
      try {
        const screens = await fetchPosScreens(currentRestaurantId, data.categories || [], data.products || [], newState.activeConcept.id);
        setPosScreens(screens);
        const rootScreen = screens.find((s) => s.isRoot) || screens[0];
        if (rootScreen) {
          setScreenStack([]);
          setCurrentScreenId(rootScreen.id);
        }
      } catch (screenErr) {
        console.error('Failed to rebuild screen matrix for concept:', screenErr);
      }
    } catch (err) {
      console.error('Failed to reload catalog for concept:', err);
    }
  };

  // Synchronize workspace to cashier's assigned concept upon login
  useEffect(() => {
    const targetUser = activeCashier || user;
    if (!targetUser) return;

    const syncConceptFromUser = async () => {
      let uConcept = targetUser.concept || targetUser.concept_id || targetUser.assigned_concept;
      let canSwitch = targetUser.can_switch_concepts;

      // If concept is missing or 'ALL', lookup from shared Supabase restaurants.settings.user_concepts
      if (!uConcept || uConcept === 'ALL') {
        try {
          const restId = currentRestaurantId || '79256f11-a9f8-4fec-901d-69baf929762d';
          const { data: restData } = await supabase
            .from('restaurants')
            .select('settings')
            .eq('id', restId)
            .maybeSingle();
          const remoteUserConcepts = restData?.settings?.user_concepts;
          if (remoteUserConcepts && remoteUserConcepts[targetUser.id]) {
            uConcept = remoteUserConcepts[targetUser.id].concept;
            if (remoteUserConcepts[targetUser.id].can_switch_concepts !== undefined) {
              canSwitch = remoteUserConcepts[targetUser.id].can_switch_concepts;
            }
          }
        } catch (e) {}
      }

      const uName = (targetUser.name || '').toUpperCase();
      let targetProfile: any = null;

      if (uConcept && uConcept !== 'ALL') {
        targetProfile = Object.values(KNOWN_CONCEPT_PROFILES).find(
          c => c.id === uConcept || c.code === String(uConcept).toUpperCase() || c.receipt_prefix === String(uConcept).toUpperCase()
        );
      } else if (uName.includes('OVRLOAD') || uName.includes('OVR')) {
        targetProfile = KNOWN_CONCEPT_PROFILES['00000000-0000-0000-0000-000000000002'];
        canSwitch = false;
      } else if (uName.includes('WICKD') || uName.includes('WCK')) {
        targetProfile = KNOWN_CONCEPT_PROFILES['00000000-0000-0000-0000-000000000003'];
        canSwitch = false;
      }

      if (targetProfile && targetProfile.id !== workspaceState.activeConcept.id) {
        handleWorkspaceChanged({
          ...workspaceState,
          activeConcept: targetProfile,
          allowedConcepts: canSwitch ? Object.values(KNOWN_CONCEPT_PROFILES) : [targetProfile],
          lastSwitchedAt: new Date().toISOString()
        });
      }
    };

    syncConceptFromUser();
  }, [activeCashier?.id, activeCashier?.name, activeCashier?.concept, user?.id]);

  // Navigation: Reset menu back to products main page
  const handleResetToMainMenu = () => {
    const root = posScreens.find(s => s.isRoot) || posScreens[0];
    if (root) {
      setScreenStack([]);
      setCurrentScreenId(root.id);
    }
  };
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
        branchToResolve = '';
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
  const candidateBranch = commerceBranchLink?.flow_branch_name || selectedTerminalBranch;
  const userBranchClean = (user?.branch && user.branch.toLowerCase() !== 'all') ? user.branch : undefined;
  const activeCashierBranchClean = (activeCashier?.branch && activeCashier.branch.toLowerCase() !== 'all') ? activeCashier.branch : undefined;

  const currentBranchName =
    candidateBranch ||
    userBranchClean ||
    activeCashierBranchClean ||
    '';

  const currentBranchId =
    commerceBranchLink?.flow_branch_id ||
    branchCapabilities?.branchId ||
    user?.branch_id ||
    activeCashier?.branch_id ||
    '';

  const refreshFloorTables = async () => {
    const flowBranchId = currentBranchId || commerceBranchLink?.flow_branch_id || branchCapabilities?.branchId || '';
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
    isOverdueShift,
    loading: shiftLoading,
    checkShift,
    isOpenShiftModalOpen,
    setIsOpenShiftModalOpen,
    isCloseShiftModalOpen,
    setIsCloseShiftModalOpen,
    isShiftReportModalOpen,
    setIsShiftReportModalOpen,
    isOverdueModalOpen,
    setIsOverdueModalOpen,
    isManagerHeldShiftsModalOpen,
    setIsManagerHeldShiftsModalOpen,
    heldShifts,
    heldShiftsCount,
    refreshHeldShifts,
    reportModalMode,
    setReportModalMode,
    openXReport,
    handleOpenShift,
    handleCloseShift,
    handleHoldShift
  } = usePosShift(
    currentBranchName || commerceBranchLink?.flow_branch_name || user?.branch || "Badaro",
    activeCashier?.name || user?.name || "Cashier",
    persistentTerminalId || 'FLOW-TERM-01',
    currentBranchId || commerceBranchLink?.flow_branch_id || '9c214659-9cc7-4f33-b115-cbbb8a823a94',
    currentRestaurantId || '79256f11-a9f8-4fec-901d-69baf929762d',
    workspaceState.activeConcept?.id
  );

  const [auditShiftTarget, setAuditShiftTarget] = useState<ShiftCashRecord | null>(null);
  const [isDailyPaymentsModalOpen, setIsDailyPaymentsModalOpen] = useState(false);
  const [isSupplierInvoicesModalOpen, setIsSupplierInvoicesModalOpen] = useState(false);
  const [isConceptCashModalOpen, setIsConceptCashModalOpen] = useState(false);
  const [terminalHandoverOrder, setTerminalHandoverOrder] = useState<any | null>(null);

  // Auto popup for closed shift after cashier logs in with PIN
  const [hasPromptedShiftClosed, setHasPromptedShiftClosed] = useState(false);

  useEffect(() => {
    if (!isResolvingBranch && !shiftLoading) {
      if (isOverdueShift) {
        setIsOpenShiftModalOpen(false);
        setIsOverdueModalOpen(true);
      } else if (isShiftOpen) {
        setIsOpenShiftModalOpen(false);
      } else if (!hasPromptedShiftClosed) {
        setHasPromptedShiftClosed(true);
        setIsOpenShiftModalOpen(true);
      }
    }
  }, [isResolvingBranch, shiftLoading, isShiftOpen, isOverdueShift, hasPromptedShiftClosed]);

  // Shift Eligibility & Opening Float Handover State
  const [shiftEligibility, setShiftEligibility] = useState<{
    allowedShift: 'AM' | 'PM';
    isAmEnabled: boolean;
    isPmEnabled: boolean;
    reason: string;
    prefillUsd: number | null;
    prefillLbp: number | null;
    prefillSource: 'AM' | 'PM' | null;
  }>({
    allowedShift: 'AM',
    isAmEnabled: true,
    isPmEnabled: false,
    reason: '',
    prefillUsd: null,
    prefillLbp: null,
    prefillSource: null,
  });
  const [shiftEligibilityLoading, setShiftEligibilityLoading] = useState(true);
  const [shiftEligibilityError, setShiftEligibilityError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpenShiftModalOpen) {
      setShiftEligibilityLoading(true);
      return;
    }
    let cancelled = false;
    setShiftEligibilityLoading(true);
    setShiftEligibilityError(null);

    resolveShiftEligibility(currentBranchId || currentBranchName, persistentTerminalId, currentRestaurantId, workspaceState.activeConcept?.id)
      .then((eligibility) => {
        if (cancelled) return;
        setShiftEligibility(eligibility);
      })
      .catch((err) => {
        if (!cancelled) {
          setShiftEligibilityError(err?.message || 'Could not verify shift eligibility. Reopen this window to retry.');
        }
      })
      .finally(() => {
        if (!cancelled) setShiftEligibilityLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpenShiftModalOpen, currentBranchId, currentBranchName, persistentTerminalId, currentRestaurantId, workspaceState.activeConcept?.id]);

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
    tableNumber?: string | null;
    items: CanceledItemDetail[];
    voidType: 'item_void' | 'order_cancellation' | 'refund';
    targetItemIndex?: number;
    qtyToVoid?: number;
    onSuccess?: () => void;
  }>({
    isOpen: false,
    orderId: '',
    tableNumber: null,
    items: [],
    voidType: 'order_cancellation',
    targetItemIndex: undefined,
    qtyToVoid: undefined
  });

  const handleExecuteVoid = async (
    reason: string, 
    authorizedBy: string, 
    isWaste?: boolean, 
    reasonCode?: string
  ) => {
    const { orderId, items, voidType, targetItemIndex, qtyToVoid, onSuccess } = voidModalState;
    const branchName = commerceBranchLink?.flow_branch_name || user?.branch || "Cloud Kitchen";

    const result = await executeVoidTransaction({
      voidType,
      branchName,
      orderId,
      tableNumber: voidModalState.tableNumber || activeTableContext?.tableCode || null,
      items,
      reason,
      isWaste: Boolean(isWaste),
      reasonCode,
      cashierName: activeCashier?.name || user?.name || "Cashier",
      authorizedBy,
      orderType: "POS",
      executeCommerceMutation: async (opId?: string) => {
        if (voidType === 'item_void') {
          // If not marked as waste, reverse inventory for the voided item
          if (!isWaste && typeof targetItemIndex === 'number' && ticketItems[targetItemIndex]) {
            const currentItem = ticketItems[targetItemIndex];
            const toRemove = qtyToVoid || currentItem.qty || 1;
            const effectiveBranchId = currentBranchId || commerceBranchLink?.flow_branch_id;
            if (effectiveBranchId && currentItem.product_id) {
              const stockReversal = await reversePosOrderInventory(
                orderId,
                effectiveBranchId,
                currentItem.line_item_id || 'line-' + targetItemIndex,
                currentItem.product_id,
                toRemove,
                currentRestaurantId,
                reason,
                activeCashier?.name || user?.name
              );
              if (!stockReversal.success) throw new Error(stockReversal.error);
            }
          }

          // Calculate remaining items
          let remaining = [...ticketItems];
          if (typeof targetItemIndex === 'number' && remaining[targetItemIndex]) {
            const currentItem = remaining[targetItemIndex];
            const toRemove = qtyToVoid || currentItem.qty || 1;
            if (toRemove >= currentItem.qty) {
              remaining.splice(targetItemIndex, 1);
            } else {
              remaining[targetItemIndex] = {
                ...currentItem,
                qty: currentItem.qty - toRemove
              };
            }
          }

          const remainingSubtotal = remaining.reduce((sum, it) => sum + (it.unit_price || 0) * (it.qty || 1), 0);
          
          let remainingDiscount = 0;
          if (discountType === 'percent' && discountValInput > 0) {
            remainingDiscount = Number(((remainingSubtotal * discountValInput) / 100).toFixed(2));
          } else if (discountType === 'fixed' && discountValInput > 0) {
            remainingDiscount = Math.min(remainingSubtotal, discountValInput);
          }

          const currentVatRate = isVatSubscribed ? vatRate : 0;
          const remainingVat = isVatSubscribed ? Number(((remainingSubtotal - remainingDiscount) * (currentVatRate / 100)).toFixed(2)) : 0;
          const remainingFee = (!activeTableContext && orderType === 'delivery') ? (Number(deliveryFee) || 0) : 0;
          const remainingTotal = Number((remainingSubtotal - remainingDiscount + remainingVat + remainingFee).toFixed(2));

          if (remaining.length === 0) {
            // All items were voided from order -> cancel the order
            const voidUpdate = await updateDirectOrderStatus(orderId, {
              inventory_void: true,
              status: "cancelled",
              subtotal: 0,
              total: 0,
              items: []
            });
            if (!voidUpdate.success) throw new Error(voidUpdate.error);
            if (activeTableContext?.sessionId) {
              await closeTableSession(activeTableContext.sessionId).catch(() => {});
            }
          } else {
            // Update order with remaining items
            const voidUpdate = await updateDirectOrderStatus(orderId, {
              inventory_void: true,
              subtotal: remainingSubtotal,
              total: remainingTotal,
              items: remaining.map(it => ({
                line_item_id: it.line_item_id,
                product_id: it.product_id,
                name: it.name,
                quantity: it.qty,
                unit_price: it.unit_price,
                customizations: it.selectedCustomizations || [],
                comment: it.note
              }))
            });
            if (!voidUpdate.success) throw new Error(voidUpdate.error);
          }

          return { success: true };
        }

        // Full order void: if not waste, reverse inventory for all items
        if (!isWaste) {
          const effectiveBranchId = currentBranchId || commerceBranchLink?.flow_branch_id;
          if (effectiveBranchId) {
            for (let i = 0; i < ticketItems.length; i++) {
              const it = ticketItems[i];
              if (it && it.product_id) {
                const stockReversal = await reversePosOrderInventory(
                  orderId,
                  effectiveBranchId,
                  it.line_item_id || 'line-' + i,
                  it.product_id,
                  it.qty || 1,
                  currentRestaurantId,
                  reason,
                  activeCashier?.name || user?.name
                );
                if (!stockReversal.success) throw new Error(stockReversal.error);
              }
            }
          }
        }

        if (HAS_COMMERCE_API) {
          try {
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
          } catch (e) {
            console.warn("API void mutation failed, falling back to direct database update:", e);
          }
        }

        // Direct update in pos_orders
        await supabase
          .from('pos_orders')
          .update({
            status: "cancelled",
            special_instructions: reason ? `Voided: ${reason}` : 'Voided',
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);

        // Also update orders table if present
        await supabase
          .from('orders')
          .update({
            status: "cancelled",
            notes: reason ? `Voided: ${reason}` : 'Voided',
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);

        if (activeTableContext?.sessionId) {
          await closeTableSession(activeTableContext.sessionId).catch(() => {});
        }

        return { success: true };
      }
    });

    if (result.success) {
      // Dispatch Cancellation Tickets to original preparation printers (Phase 5)
      try {
        const cancelledItemsList = (voidType === 'item_void' && typeof targetItemIndex === 'number' && ticketItems[targetItemIndex])
          ? [{ ...ticketItems[targetItemIndex], qty: qtyToVoid || ticketItems[targetItemIndex].qty || 1 }]
          : items;

        const effBranchId = currentBranchId || commerceBranchLink?.flow_branch_id;
        const cancelJobs = await buildCancellationPrintJobs({
          orderMetadata: {
            order_id: orderId,
            table_label: voidModalState.tableNumber || (activeTableContext ? `Table ${activeTableContext.tableCode}` : 'Order'),
            waiter_name: activeCashier?.name || user?.name || 'Staff'
          },
          cancelledItems: cancelledItemsList,
          branchId: effBranchId || undefined,
          restaurantId: currentRestaurantId,
          productsCatalog: products,
          reason: reason || 'Void authorized'
        });

        if (cancelJobs.length > 0) {
          await dispatchPhysicalPrintJobs(cancelJobs);
        }
      } catch (cancelErr) {
        console.warn('Cancellation slip routing warning:', cancelErr);
      }

      if (voidType === 'item_void') {
        let remaining = [...ticketItems];
        if (typeof targetItemIndex === 'number' && remaining[targetItemIndex]) {
          const currentItem = remaining[targetItemIndex];
          const toRemove = qtyToVoid || currentItem.qty || 1;
          if (toRemove >= currentItem.qty) {
            remaining.splice(targetItemIndex, 1);
          } else {
            remaining[targetItemIndex] = {
              ...currentItem,
              qty: currentItem.qty - toRemove
            };
          }
        }
        setTicketItems(remaining);
        if (remaining.length === 0) {
          handleResetCart();
        }
      }
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
        const currentShift = await checkShift();
        if (!currentShift) {
          setIsOpenShiftModalOpen(true);
        } else {
          setIsOpenShiftModalOpen(false);
        }
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
  const [orderType, setOrderType] = useState("pickup"); // pickup, delivery, dine_in
  const [isOrderSetupOpen, setIsOrderSetupOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [marketplaceOrderRef, setMarketplaceOrderRef] = useState("");

  // Operating Mode: Restaurant Mode (NÉO with Tables, Covers, Pacing) vs Fast Delivery/Pickup Mode (OVRLOAD/WICKD)
  const activeConceptType = (workspaceState.activeConcept as any)?.concept_type || (workspaceState.activeConcept?.code === 'NEO' ? 'RESTAURANT' : 'DELIVERY_PICKUP');
  const isRestaurantMode = activeConceptType === 'RESTAURANT' && workspaceState.activeConcept?.code === 'NEO';

  // Independent Concept Channel Commercial Agreements (Decoupled from customer discounts)
  const [conceptChannelAgreements, setConceptChannelAgreements] = useState<Record<string, {
    totersCommissionPct: number;
    noknokCommissionPct: number;
    whatsappPromoPct: number;
    pickupDiscountPct: number;
  }>>({
    '00000000-0000-0000-0000-000000000002': { // OVRLOAD
      totersCommissionPct: 15,
      noknokCommissionPct: 15,
      whatsappPromoPct: 0,
      pickupDiscountPct: 0,
    },
    '00000000-0000-0000-0000-000000000003': { // WICKD
      totersCommissionPct: 20,
      noknokCommissionPct: 20,
      whatsappPromoPct: 0,
      pickupDiscountPct: 0,
    },
    '00000000-0000-0000-0000-000000000001': { // NÉO
      totersCommissionPct: 0,
      noknokCommissionPct: 0,
      whatsappPromoPct: 0,
      pickupDiscountPct: 0,
    }
  });

  const activeAgreement = conceptChannelAgreements[workspaceState.activeConcept.id] || {
    totersCommissionPct: workspaceState.activeConcept?.code === 'OVRLOAD' ? 15 : 0,
    noknokCommissionPct: workspaceState.activeConcept?.code === 'OVRLOAD' ? 15 : 0,
    whatsappPromoPct: 0,
    pickupDiscountPct: 0
  };
  const [deliveryPricingRules, setDeliveryPricingRules] = useState<any[]>([
    { id: 1, min_distance_km: 0, max_distance_km: 3, delivery_cost: 1.67 },
    { id: 2, min_distance_km: 3, max_distance_km: 4.5, delivery_cost: 2.22 },
    { id: 3, min_distance_km: 4.5, max_distance_km: 6, delivery_cost: 2.78 },
    { id: 4, min_distance_km: 6, max_distance_km: 7.5, delivery_cost: 3.33 },
    { id: 5, min_distance_km: 7.5, max_distance_km: 10, delivery_cost: 5.00 },
    { id: 6, min_distance_km: 10, max_distance_km: 12.5, delivery_cost: 7.22 },
  ]);

  // Admin Configured Channel Discounts
  const [totersDiscountPercent, setTotersDiscountPercent] = useState(15);
  const [noknokDiscountPercent, setNoknokDiscountPercent] = useState(15);

  // Discount Selection State
  const [discountType, setDiscountType] = useState("none"); // "none", "5%", "10%", "15%", "wa15", "toters", "noknok", "custom", "custom_rule"
  const [discountValInput, setDiscountValInput] = useState<any>(10);
  const [discountIsPercent, setDiscountIsPercent] = useState(true);
  const [isDiscountPresetsModalOpen, setIsDiscountPresetsModalOpen] = useState(false);

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

  const isCurrentTableBillRequested = useMemo(() => {
    if (!activeTableContext) return false;
    const match = branchFloorTables.find(t => t.table_code === activeTableContext.tableCode);
    if (match && match.status === 'bill_requested') return true;
    return false;
  }, [activeTableContext, branchFloorTables]);

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

  const tableFireKey = (orderId: unknown, tableCode?: string) => orderId
    ? 'ORDER_' + currentRestaurantId + '_' + String(orderId)
    : 'TABLE_' + currentRestaurantId + '_' + String(currentBranchId) + '_' + String(tableCode || '').toUpperCase().replace(/\s+/g, '');
  const currentTableKey = useMemo(() => {
    if (activeTableContext?.orderId || editingOrderId) return tableFireKey(activeTableContext?.orderId || editingOrderId);
    if (activeTableContext?.tableCode) {
      return tableFireKey(null, activeTableContext.tableCode);
    }
    if (editingOrderId) {
      return 'ORDER_' + editingOrderId;
    }
    return 'WALK_IN';
  }, [activeTableContext, editingOrderId, currentRestaurantId, currentBranchId]);

  // Count of Hold lines placed in current ticket order
  const countHeldCourses = (items: any[]) => items.filter(i => i.isHoldSeparator || String(i.product_id || i.productId || '').startsWith('hold_') || ['HOLD', '--- HOLD ---', 'HOLD FOR NEXT COURSE'].includes(String(i.name || i.product_name || '').trim().toUpperCase())).length;
  const [firingTableKey, setFiringTableKey] = useState<string | null>(null);
  const fireInProgress = useRef(false);
  const currentTableHolds = useMemo(() => {
    return countHeldCourses(ticketItems);
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
  const [customizationStep, setCustomizationStep] = useState(0);
  const [inventoryRevision, setInventoryRevision] = useState(0);

  // Void Reason State
  const [voidingItemIndex, setVoidingItemIndex] = useState(null);
  const [voidReason, setVoidReason] = useState("");

  // Payment State
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("Cash");
  const [exchangeRate, setExchangeRate] = useState<number>(90000);
  const [isVatSubscribed, setIsVatSubscribed] = useState<boolean>(false);
  const [vatRate, setVatRate] = useState<number>(11);
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
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTargetTableInput, setTransferTargetTableInput] = useState("");

  // Thermal Receipt Preview Modal State
  const [receiptPreviewData, setReceiptPreviewData] = useState<ThermalReceiptData | null>(null);
  const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);

  // FLOW Supervisor Authorization & Permissions Engine
  const [supervisorAuthRequest, setSupervisorAuthRequest] = useState<SupervisorAuthRequest | null>(null);

  useEffect(() => {
    if (currentRestaurantId) {
      loadRestaurantRolePermissions(currentRestaurantId);
    }
  }, [currentRestaurantId]);

  // Instant Screen Lock / Block for Fast Staff Handover
  const handleQuickLock = () => {
    localStorage.removeItem('pos_current_cashier');
    setActiveCashier(null);
    setIsPinLockOpen(true);
  };

  const [autoLockOnOrder, setAutoLockOnOrder] = useState<boolean>(() => {
    try {
      return localStorage.getItem('flow_pos_autolock') === 'true';
    } catch {
      return false;
    }
  });

  const toggleAutoLock = () => {
    setAutoLockOnOrder(prev => {
      const next = !prev;
      localStorage.setItem('flow_pos_autolock', String(next));
      return next;
    });
  };

  const handleTerminalLogout = async () => {
    try {
      localStorage.removeItem('flow_pos_user');
      localStorage.removeItem('pos_current_cashier');
      setActiveCashier(null);
      setIsPinLockOpen(false);
      setIsSecurityModalOpen(false);
      try {
        await sessionLogger.endSession();
      } catch (e) {
        console.warn('Session logger endSession error:', e);
      }
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Supabase signOut error:', e);
      }
      if (onExit) {
        onExit();
      } else {
        window.location.hash = '#/';
        window.location.reload();
      }
    } catch (err) {
      console.error('Logout error:', err);
      localStorage.removeItem('flow_pos_user');
      localStorage.removeItem('pos_current_cashier');
      if (onExit) onExit();
      else window.location.reload();
    }
  };

  // Fetch exchange rate & VAT settings from System Settings on load or restaurant change
  useEffect(() => {
    const rid = currentRestaurantId || user?.restaurant_id;
    api.getExchangeRate(rid)
      .then((res) => {
        if (res.success && res.rate && res.rate > 0) {
          setExchangeRate(res.rate);
        } else {
          setExchangeRate(90000);
        }
      })
      .catch(() => {
        setExchangeRate(90000);
      });

    api.getVatSettings(rid)
      .then((res) => {
        if (res.success) {
          setIsVatSubscribed(res.isVatSubscribed === true);
          setVatRate(typeof res.vatRate === 'number' ? res.vatRate : 11);
        }
      })
      .catch((err) => {
        console.warn("[POS] Error loading VAT settings:", err);
      });

    // Fetch receipt and company legal settings
    (async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['receipt_restaurant_name', 'company_legal_name', 'mof_number', 'receipt_footer_text']);

        if (data) {
          data.forEach(item => {
            if (item.setting_key === 'receipt_restaurant_name' && item.setting_value) {
              localStorage.setItem('flow_pos_restaurant_name', item.setting_value);
            }
            if (item.setting_key === 'company_legal_name' && item.setting_value) {
              localStorage.setItem('flow_pos_company_legal_name', item.setting_value);
            }
            if (item.setting_key === 'mof_number' && item.setting_value) {
              localStorage.setItem('flow_pos_mof_number', item.setting_value);
            }
            if (item.setting_key === 'receipt_footer_text' && item.setting_value) {
              localStorage.setItem('flow_pos_receipt_footer', item.setting_value);
            }
          });
        }
      } catch (err) {
        console.warn("[POS] Error loading receipt app_settings:", err);
      }
    })();

    // Also check restaurants table settings
    if (currentRestaurantId) {
      (async () => {
        try {
          const { data } = await supabase
            .from('restaurants')
            .select('name, settings')
            .eq('id', currentRestaurantId)
            .maybeSingle();

          if (data?.settings) {
            const s = data.settings as any;
            if (s.receipt_restaurant_name) {
              localStorage.setItem('flow_pos_restaurant_name', s.receipt_restaurant_name);
            } else if (data.name) {
              localStorage.setItem('flow_pos_restaurant_name', data.name);
            }
            if (s.company_legal_name) {
              localStorage.setItem('flow_pos_company_legal_name', s.company_legal_name);
            }
            if (s.mof_number) {
              localStorage.setItem('flow_pos_mof_number', s.mof_number);
            }
            if (s.receipt_footer_text) {
              localStorage.setItem('flow_pos_receipt_footer', s.receipt_footer_text);
            }
          }
        } catch (err) {
          console.warn("[POS] Error loading restaurant settings:", err);
        }
      })();
    }
  }, [currentRestaurantId, user?.restaurant_id]);

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
  const [historyMode, setHistoryMode] = useState<'shift' | 'date'>('shift');
  const [historyDate, setHistoryDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [isFetchingHistoryDate, setIsFetchingHistoryDate] = useState(false);
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
      if (!HAS_COMMERCE_API) {
        const { data: bList } = await supabase.from('branches').select('*').limit(5);
        if (bList && bList.length > 0) {
          const mainBranch = bList[0];
          setBranchStatus(mainBranch);
          setPosOperationalStatus(mainBranch.operational_status || "open");
          setPosClosureReason(mainBranch.closure_reason || "");
        }
        return;
      }
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

  const handleSelectChannelSource = (sourceId: string) => {
    const channel = sourceId === 'Store' ? 'POS' : sourceId;
    setSelectedChannel(channel);
    setValidationError("");

    // Revalidate cart item pricing on channel switch (Section 6)
    if (ticketItems.length > 0) {
      let changedCount = 0;
      const updated = ticketItems.map((item: any) => {
        const prod = products.find((p: any) => String(p.id) === String(item.product_id));
        if (!prod) return item;
        const newEffectivePrice = resolveEffectivePosPrice(prod, channel);
        if (newEffectivePrice > 0 && Math.abs(newEffectivePrice - Number(item.unit_price)) > 0.001) {
          changedCount++;
          return {
            ...item,
            base_price: newEffectivePrice,
            unit_price: newEffectivePrice
          };
        }
        return item;
      });

      if (changedCount > 0) {
        setTicketItems(updated);
        setValidationError(`Notice: Switched channel to ${channel}. Revalidated pricing on ${changedCount} cart item(s).`);
      }
    }

    if (channel === 'Toters') {
      setOrderType('delivery');
      setDeliveryFee(0);
      setDiscountType('toters');
      if (customerName === 'Pickup Customer') setCustomerName('');
    } else if (channel === 'NokNok') {
      setOrderType('delivery');
      setDeliveryFee(0);
      setDiscountType('noknok');
      if (customerName === 'Pickup Customer') setCustomerName('');
    } else if (channel === 'POS' || channel === 'Pick-up') {
      setOrderType('pickup');
      setDeliveryFee(0);
      setDiscountType('none');
    } else if (channel === 'WhatsApp') {
      setOrderType('delivery');
      setDiscountType('wa15');
    } else if (channel === 'App') {
      setOrderType('delivery');
      setDiscountType('none');
    }
  };

  const checkWhatsAppLocation = async (phone: string) => {
    if (!phone || phone.replace(/\D/g, "").length < 6) {
      setDetectedWaLocation(null);
      return;
    }
    setIsCheckingWaLocation(true);
    try {
      const cleanDigits = phone.replace(/\D/g, "");
      const res = await fetchWithTimeout(`${COMMERCE_API_BASE}/api/pos/customers?q=${encodeURIComponent(cleanDigits)}`, {}, 6000);
      if (res.ok) {
        const data = await res.json();
        const match = (data.customers || []).find((c: any) => c.whatsapp_location && c.whatsapp_location.hasLocation);
        if (match && match.whatsapp_location) {
          setDetectedWaLocation(match.whatsapp_location);
          if (match.whatsapp_location.deliveryFee !== undefined && match.whatsapp_location.deliveryFee !== null) {
            setDeliveryFee(Number(match.whatsapp_location.deliveryFee));
          }
          if (match.whatsapp_location.address) {
            const fullAddr = match.whatsapp_location.address && match.whatsapp_location.mapUrl
              ? `${match.whatsapp_location.address} [Maps Pin: ${match.whatsapp_location.mapUrl}]`
              : (match.whatsapp_location.mapUrl || match.whatsapp_location.address);
            setDeliveryAddress(fullAddr);
          }
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
    if (c.customer_name) {
      const clean = c.customer_name.trim();
      setCustomerName(clean === "." || clean === "-" ? "" : clean);
    }
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
    setValidationError("");
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
      const data = await fetchPosCatalog(currentRestaurantId, currentBranchId || commerceBranchLink?.flow_branch_id, workspaceState.activeConcept.id);
      if (data.categories) setCategories(data.categories);
      if (data.products) setProducts(data.products);

      // Load POS Screen Matrix (modifiable screens & subscreens)
      try {
        const screens = await fetchPosScreens(currentRestaurantId, data.categories || [], data.products || [], workspaceState.activeConcept.id);
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
      setProducts([]); setCategories([]);
      setInitialLoadError(err.message || "Failed to connect to POS server");
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveryPricingRules = async () => {
    if (!HAS_COMMERCE_API) return;
    try {
      const res = await fetchWithTimeout(`${COMMERCE_API_BASE}/api/delivery/pricing-rules`, {}, 8000);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.rules) && data.rules.length > 0) {
          setDeliveryPricingRules(data.rules.filter((r: any) => r.is_active !== false));
        }
      }
    } catch (err) {
      console.error("Error fetching delivery pricing rules in POS:", err);
    }
  };

  const playNotificationBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
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
      } as any);
      notif.onclick = () => {
        window.focus();
        setActiveTabModal("incoming");
      };
    }
  };

  const [preparingOrderCount, setPreparingOrderCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPreparingOrderCount(null);
    const refresh = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const rows = await loadPreparingOrders(currentBranchId || commerceBranchLink?.flow_branch_id, commerceBranchLink?.external_branch_id, currentRestaurantId);
        if (!cancelled) setPreparingOrderCount(rows.length);
      } catch { if (!cancelled) setPreparingOrderCount(null); }
    };
    void refresh();
    const timer = setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [currentRestaurantId, currentBranchId, commerceBranchLink?.flow_branch_id, commerceBranchLink?.external_branch_id, inventoryRevision]);

  const fetchOrdersQueue = async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    try {
      if (!HAS_COMMERCE_API) {
        const [pendingRes, heldRes] = await Promise.all([
          supabase.from('orders').select('*').eq('status', 'pending').limit(50),
          supabase.from('orders').select('*').eq('status', 'held').limit(50)
        ]);
        const incoming = pendingRes.data || [];
        setPendingOrders(incoming);
        setHeldOrders(heldRes.data || []);
        return;
      }
      const [pendingRes, heldRes] = await Promise.all([
        fetchWithTimeout(`${COMMERCE_API_BASE}/api/pos/orders?type=pending`, {}, 8000),
        fetchWithTimeout(`${COMMERCE_API_BASE}/api/pos/orders?type=held`, {}, 8000)
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
    const staffUser = activeCashier || user;
    const canCancel = hasPosPermission(staffUser, 'cancel_entire_order');

    const executeReject = () => {
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

    if (canCancel) {
      executeReject();
    } else {
      setSupervisorAuthRequest({
        actionKey: 'cancel_entire_order',
        actionTitle: `Reject Pending Order #${orderId}`,
        orderId,
        requireReason: true,
        defaultReason: 'Staff rejected pending order',
        onAuthorized: async () => {
          executeReject();
        }
      });
    }
  };

  const handleDeleteHeldOrder = (orderId: string | number) => {
    const staffUser = activeCashier || user;
    const canCancel = hasPosPermission(staffUser, 'cancel_entire_order');

    const executeDelete = () => {
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

    if (canCancel) {
      executeDelete();
    } else {
      setSupervisorAuthRequest({
        actionKey: 'cancel_entire_order',
        actionTitle: `Cancel Held Order #${orderId}`,
        orderId,
        requireReason: true,
        defaultReason: 'Staff canceled held order',
        onAuthorized: async () => {
          executeDelete();
        }
      });
    }
  };

  const handleDirectVoidOrder = (order: any) => {
    const staffUser = activeCashier || user;
    const isCompleted = order.statusGroup === 'COMPLETED' || order.rawOrder?.status === 'completed';
    const requiredPermission = isCompleted ? 'refund_payment' : 'cancel_entire_order';
    const canVoid = hasPosPermission(staffUser, requiredPermission);

    const executeDirectVoid = () => {
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
        voidType: isCompleted ? 'refund' : 'order_cancellation',
        onSuccess: () => {
          fetchOrdersQueue();
        }
      });
    };

    if (canVoid) {
      executeDirectVoid();
    } else {
      setSupervisorAuthRequest({
        actionKey: requiredPermission,
        actionTitle: `${isCompleted ? 'Refund' : 'Cancel'} Order #${order.id}`,
        orderId: order.id,
        requireReason: true,
        defaultReason: `${isCompleted ? 'Order refund' : 'Order cancellation'} authorization`,
        onAuthorized: async () => {
          executeDirectVoid();
        }
      });
    }
  };

  const releaseCurrentOrderLock = async () => {
    if (!HAS_COMMERCE_API || !editingOrderId) return;
    try {
      await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${editingOrderId}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimed_terminal: posTerminalId })
      });
    } catch (e) {
      console.warn("Error releasing order lock:", e);
    }
  };

  const handleRestoreHeldTicket = async (o) => {
    if (!o) return;
    if (!HAS_COMMERCE_API) {
      loadOrderToTicket(o, "POS");
      setActiveTabModal(null);
      return;
    }
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
    const isOrderCancelled =
      ['cancelled', 'canceled', 'voided'].includes(String(o.status || '').toLowerCase()) ||
      String(o.status_group || '').toUpperCase() === 'CANCELLED';
    if (isOrderCancelled) {
      alert("This order is canceled and cannot be edited or modified.");
      return;
    }
    setEditingOrderId(o.id);
    const rawCustName = (o.customer_name || "").trim();
    setCustomerName(rawCustName === "." || rawCustName === "-" ? "" : rawCustName);
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

    // 2. Load order type (delivery vs pickup vs dine_in)
    const isDineIn = (o.order_type || "").toLowerCase() === "dine_in" || Boolean(o.table_label);
    const isPickup = (o.order_type || "").toLowerCase() === "pickup" || (!o.delivery_address && (o.order_type || "").toLowerCase() !== "delivery");
    setOrderType(isDineIn ? "dine_in" : (isPickup ? "pickup" : "delivery"));

    // 3. Load delivery fee
    const fee = o.delivery_fee !== undefined && o.delivery_fee !== null ? Number(o.delivery_fee) : 0;
    setDeliveryFee(fee);

    // 4. Map ticket items
    const rawItemsList = o.items || o.pos_order_items || [];
    const items = rawItemsList.map((i) => {
      const custs = restoreModifiers(i, products.find(p => String(p.id) === String(i.product_id))?.customizations || []);

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
        isHoldSeparator: isHold,
        isOrdered: !isHold,
        order_item_id: i.id,
        line_item_id: i.line_item_id || String(i.id)
      };
    });
    setTicketItems(items);

    // 5. Load discount
    const itemsSubtotal = items.reduce((sum, item) => sum + item.unit_price * item.qty, 0);
    const discAmt = Number(o.discount_amount) || 0;

    if (discAmt > 0) {
      if (itemsSubtotal > 0 && Math.abs(discAmt - itemsSubtotal * 0.15) < 0.05) {
        setDiscountType("wa15");
      } else if (itemsSubtotal > 0 && Math.abs(discAmt - itemsSubtotal * 0.10) < 0.05) {
        setDiscountType("10%");
      } else if (itemsSubtotal > 0 && Math.abs(discAmt - itemsSubtotal * 0.05) < 0.05) {
        setDiscountType("5%");
      } else if (itemsSubtotal > 0 && Math.abs(discAmt - itemsSubtotal * (totersDiscountPercent / 100)) < 0.05 && channel === "Toters") {
        setDiscountType("toters");
      } else if (itemsSubtotal > 0 && Math.abs(discAmt - itemsSubtotal * (noknokDiscountPercent / 100)) < 0.05 && channel === "NokNok") {
        setDiscountType("noknok");
      } else {
        setDiscountType("custom");
        setDiscountIsPercent(false);
        setDiscountValInput(discAmt);
      }
    } else {
      setDiscountType(channel === "WhatsApp" ? "wa15" : channel === "Toters" ? "toters" : channel === "NokNok" ? "noknok" : "none");
    }

    // 6. Check WhatsApp location
    if (o.whatsapp_location) {
      setDetectedWaLocation(o.whatsapp_location);
    } else if (o.customer_phone) {
      checkWhatsAppLocation(o.customer_phone);
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
    fetchDeliveryPricingRules();
    const interval = setInterval(fetchOrdersQueue, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!currentRestaurantId || !currentBranchId) return;
    let cancelled = false;
    const refreshCatalog = async () => {
      try {
        const catalogue = await fetchPosCatalog(currentRestaurantId, currentBranchId, workspaceState.activeConcept.id);
        if (!cancelled) {
          setProducts(catalogue.products);
          setCategories(catalogue.categories);
          setInitialLoadError(null);
          try {
            const scrs = await fetchPosScreens(currentRestaurantId, catalogue.categories || [], catalogue.products || [], workspaceState.activeConcept.id);
            setPosScreens(scrs);
          } catch (e) {}
        }
      } catch (error: any) {
        if (!cancelled) { setProducts([]); setCategories([]); setInitialLoadError(error.message || 'Could not refresh the POS catalogue.'); }
      }
    };
    void refreshCatalog(); window.addEventListener('focus', refreshCatalog);
    return () => { cancelled = true; window.removeEventListener('focus', refreshCatalog); };
  }, [currentRestaurantId, currentBranchId, workspaceState.activeConcept.id]);

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
    if (!isShiftOpen) {
      setIsOpenShiftModalOpen(true);
      return;
    }
    if (isOverdueShift) {
      setIsOverdueModalOpen(true);
      return;
    }

    const staffUser = activeCashier || user;
    if (!hasPosPermission(staffUser, 'add_items') && !hasPosPermission(staffUser, 'create_order')) {
      alert(`⚠️ Your assigned role (${staffUser?.role || 'Staff'}) does not have permission to add items or create orders.`);
      return;
    }

    const tableAssignedWaiter = activeTableContext?.waiterName;
    const currentStaffName = staffUser?.name;
    const isOtherWaitersTable = Boolean(tableAssignedWaiter && currentStaffName && tableAssignedWaiter.toLowerCase() !== currentStaffName.toLowerCase());
    if (isOtherWaitersTable && !hasPosPermission(staffUser, 'add_items_to_other_tables')) {
      alert(`⚠️ You do not have permission to add items to another server's table (Table ${activeTableContext?.tableCode} assigned to ${tableAssignedWaiter}).`);
      return;
    }

    if (isProduct86d(product.id)) {
      alert(`⚠️ "${product.name}" is currently 86'd (unavailable) by the kitchen.`);
      return;
    }
    if (product.customizations && product.customizations.length > 0) {
      handleOpenCustomization(product);
      return;
    }
    const existingIndex = ticketItems.findIndex(
      (item) => !item.isOrdered && item.product_id === product.id && (!item.selectedCustomizations || item.selectedCustomizations.length === 0) && !item.note
    );

    if (existingIndex > -1) {
      const updated = [...ticketItems];
      updated[existingIndex].qty += 1;
      setTicketItems(updated);
    } else {
      const newLineId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'line-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);

      const effectivePrice = resolveEffectivePosPrice(product, selectedChannel);
      setTicketItems([
        ...ticketItems,
        {
          line_item_id: newLineId,
          product_id: product.id,
          name: product.name,
          base_price: effectivePrice || product.unit_price_usd || 0,
          unit_price: effectivePrice || product.unit_price_usd || 0,
          qty: 1,
          selectedCustomizations: [],
          note: "",
          isOrdered: false,
          item_added_by: activeCashier?.name || user?.name || "Cashier",
          item_added_by_id: activeCashier?.id || user?.id || null
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
      if (!isShiftOpen) {
        setIsOpenShiftModalOpen(true);
        return;
      }
      if (isOverdueShift) {
        setIsOverdueModalOpen(true);
        return;
      }
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

    // In Sell mode (OTC / no active table): Deactivated in Sell screen (use Settle & Close)
    if (!activeTableContext) {
      if (validateOrder()) setIsScheduleModalOpen(true);
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
  const handleKitchenFireChit = async (tableOrder?: { orderId: number; tableCode: string; items: any[]; waiterName?: string }) => {
    if (!isShiftOpen) {
      alert("⚠️ A FLOW shift cash session must be open before firing kitchen rounds.");
      setIsOpenShiftModalOpen(true);
      return;
    }
    if (fireInProgress.current) return;
    const fireKey = tableOrder ? tableFireKey(tableOrder.orderId, tableOrder.tableCode) : currentTableKey;
    const holdCount = tableOrder ? countHeldCourses(tableOrder.items) : currentTableHolds;
    const firedCount = tableFireCounts[fireKey] || 0;
    if (holdCount <= firedCount) {
      if (holdCount === 0) {
        alert("⚠️ No held courses in this ticket. Tap 'Hold' between items to pace kitchen preparation.");
      } else {
        alert(`⚠️ All held courses (${holdCount}) have already been fired.`);
      }
      return;
    }

    const nextFire = firedCount + 1;
    fireInProgress.current = true;
    setFiringTableKey(fireKey);

    const tableLabel = tableOrder ? `Table ${tableOrder.tableCode}` : activeTableContext
      ? (String(activeTableContext.tableCode).toUpperCase().startsWith('T')
          ? `Table ${activeTableContext.tableCode.replace(/^T/i, '')}`
          : `Table ${activeTableContext.tableCode}`)
      : (customerName || 'Table');
    const waiterName = tableOrder?.waiterName || activeCashier?.name || user?.name || 'Staff';

    // Separate Fire Ticket print payload
    // Ex: Table 7 \n Fire
    const fireChitPayload = {
      isKitchenTicket: true,
      isKitchenFire: true,
      isSeparateFireTicket: true,
      title: "FIRE",
      table: tableLabel,
      table_label: tableLabel,
      text: "FIRE",
      content: `${tableLabel}\nFire`,
      fireRound: nextFire,
      totalHolds: holdCount,
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

    let printConfirmed = false;
    let kdsConfirmed = false;
    try {
      try {
        await handlePrint(fireChitPayload, false);
        printConfirmed = true;
      } catch (err) {
        console.warn('Fire print was not confirmed:', err);
      }

      const targetOrderId = tableOrder?.orderId || activeTableContext?.orderId || editingOrderId;
      if (HAS_COMMERCE_API && targetOrderId) {
        try {
          const result = await fireOrderRound({
            orderId: Number(targetOrderId),
            locationKey: commerceBranchLink?.location_key || 'badaro',
            items: [],
            serviceType: 'dine_in',
            tableLabel,
            waiterReference: waiterName,
            firedBy: waiterName
          });
          kdsConfirmed = result.success === true;
        } catch (err) {
          console.warn('KDS Fire error:', err);
        }
      }

      if (!printConfirmed && !kdsConfirmed) {
        alert('Fire was not confirmed by the printer or kitchen display. Check the kitchen before retrying.');
        return;
      }

      updateTableFireCount(fireKey, nextFire);
      const remaining = holdCount - nextFire;
      alert('🔥 ' + tableLabel + ': Course ' + nextFire + ' fired to ' + (printConfirmed ? 'printer and kitchen display' : 'kitchen display') + '. ' + remaining + ' held course(s) remaining.');
    } finally {
      fireInProgress.current = false;
      setFiringTableKey(null);
    }
  };

  const getOrderedModifierGroups = (customizations: any[] = []): [string, any[]][] => {
    const grouped: Record<string, any[]> = {};
    for (const c of customizations) {
      const rawG = (c.option_group_name || '').trim();
      const lower = rawG.toLowerCase();
      const tLower = (c.customization_type || '').toLowerCase();
      let group = rawG;
      if (lower === 'remove' || lower === 'removal' || lower === 'removals' || lower.startsWith('remove ingredient') || tLower === 'remove' || tLower === 'removal') {
        group = 'Remove Ingredients';
      } else if (!rawG || lower === 'general' || lower === 'add on' || lower === 'add-on' || lower === 'addon' || lower === 'add-ons' || lower === 'addons' || lower === 'add ons' || lower === 'add_on' || lower === 'add_ons' || tLower === 'addon') {
        if (!rawG || lower === 'general' || lower === 'add on' || lower === 'add-on' || lower === 'addon' || lower === 'add-ons' || lower === 'addons' || lower === 'add ons' || lower === 'add_on' || lower === 'add_ons') {
          group = 'Add On';
        }
      }
      if (!group) group = 'Custom Options';
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(c);
    }

    const getExplicitScreenOrder = (opts: any[]): number | null => {
      for (const o of opts) {
        const ca = String(o?.created_at || '');
        const m = ca.match(/^2020-01-01T00:(\d{2}):/);
        if (m) {
          const ord = parseInt(m[1], 10);
          if (ord > 0) return ord;
        }
      }
      return null;
    };

    const groupPriority = (groupName: string, opts: any[]): number => {
      const explicitOrd = getExplicitScreenOrder(opts);
      if (explicitOrd !== null) return explicitOrd;
      const lower = groupName.trim().toLowerCase();
      if (lower === 'milk') return 110;
      if (lower === 'coffee' || lower === 'coffee type' || lower === 'your coffee') return 120;
      if (lower === 'syrups' || lower === 'syrup') return 130;
      const isRemove = opts.every((o: any) => o.customization_type === 'removal' || o.customization_type === 'remove') || lower.startsWith('remove');
      if (isRemove) return 190;
      const isReq = opts.some((o: any) => o.is_required);
      const isMulti = opts.some((o: any) => o.is_multi_select);
      if (isReq && !isMulti) return 140;
      if (isReq && isMulti) return 150;
      if (!isMulti) return 160;
      return 170;
    };

    return Object.entries(grouped).sort(([aName, aOpts], [bName, bOpts]) => {
      const pa = groupPriority(aName, aOpts);
      const pb = groupPriority(bName, bOpts);
      if (pa !== pb) return pa - pb;
      return aName.localeCompare(bName);
    });
  };

  const findMatchingProduct = (optName: string, allProducts: any[] = []): any | null => {
    if (!optName || !allProducts || allProducts.length === 0) return null;
    const raw = String(optName).trim();
    const norm = raw.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();
    if (!norm) return null;

    let p = allProducts.find(p => p.name && p.name.toLowerCase().trim() === norm);
    if (p) return p;
    p = allProducts.find(p => p.name && (norm.startsWith(p.name.toLowerCase().trim()) || p.name.toLowerCase().trim().startsWith(norm)));
    if (p) return p;
    p = allProducts.find(p => p.name && (norm.includes(p.name.toLowerCase().trim()) || p.name.toLowerCase().trim().includes(norm)));
    return p || null;
  };

  const buildDynamicModifierGroups = (
    baseCustomizations: any[] = [],
    currentSelected: any[] = [],
    allProducts: any[] = [],
    isBundle: boolean = false
  ): [string, any[]][] => {
    const baseGroups = getOrderedModifierGroups(baseCustomizations);
    const result: [string, any[]][] = [];

    for (const [groupName, opts] of baseGroups) {
      result.push([groupName, opts]);

      // Check if any selected option in this group has its own product customizations
      const selectedInGroup = opts.filter(opt =>
        currentSelected.some(c => c.id === opt.id || c.original_id === opt.id)
      );

      for (const selOpt of selectedInGroup) {
        const optName = selOpt.name || selOpt.ingredient;
        const matchedProd = findMatchingProduct(optName, allProducts);

        if (matchedProd && matchedProd.customizations && matchedProd.customizations.length > 0) {
          const subGroups = getOrderedModifierGroups(matchedProd.customizations);

          for (const [subGroupName, subOpts] of subGroups) {
            const dynamicGroupName = `${optName} — ${subGroupName}`;

            const mappedSubOpts = subOpts.map(subO => ({
              ...subO,
              id: `sub_${selOpt.id}_${subO.id}`,
              original_id: subO.id,
              parent_option_id: selOpt.id,
              parent_option_name: optName,
              option_group_name: dynamicGroupName,
              price: isBundle ? 0 : (subO.price || 0),
            }));

            result.push([dynamicGroupName, mappedSubOpts]);
          }
        }
      }
    }

    return result;
  };

  const handleOpenCustomization = (product, itemIndex = null) => {
    const staffUser = activeCashier || user;
    if (itemIndex === null && !hasPosPermission(staffUser, 'add_items') && !hasPosPermission(staffUser, 'create_order')) {
      alert(`⚠️ Your assigned role (${staffUser?.role || 'Staff'}) does not have permission to add items.`);
      return;
    }

    const tableAssignedWaiter = activeTableContext?.waiterName;
    const currentStaffName = staffUser?.name;
    const isOtherWaitersTable = Boolean(tableAssignedWaiter && currentStaffName && tableAssignedWaiter.toLowerCase() !== currentStaffName.toLowerCase());
    if (itemIndex === null && isOtherWaitersTable && !hasPosPermission(staffUser, 'add_items_to_other_tables')) {
      alert(`⚠️ You do not have permission to add items to another server's table (Table ${activeTableContext?.tableCode} assigned to ${tableAssignedWaiter}).`);
      return;
    }

    if (isProduct86d(product.id)) {
      alert(`⚠️ "${product.name}" is currently 86'd (unavailable) by the kitchen.`);
      return;
    }
    setCurrentProduct(product);
    setEditingItemIndex(itemIndex);
    setCustomizationError("");
    setCustomizationStep(0);

    if (itemIndex !== null) {
      const existing = ticketItems[itemIndex];
      setSelectedCustomizations(existing.selectedCustomizations || []);
      setItemNote(existing.note || "");
      setCustomizationQty(existing.qty || 1);
    } else {
      const isBundle = Boolean(
        product.category_id === 30 ||
        (product.category_name && product.category_name.toLowerCase().includes('bundle')) ||
        (product.name && product.name.toLowerCase().includes('bundle'))
      );

      // Pre-select options that are marked as default for this product
      const baseDefaultOpts = (product.customizations || [])
        .filter((c: any) => Boolean(c.is_default))
        .map((c: any) => ({ ...c, quantity: 1 }));

      const allDefaults = [...baseDefaultOpts];
      baseDefaultOpts.forEach((bOpt: any) => {
        const optName = bOpt.name || bOpt.ingredient;
        const matchedProd = findMatchingProduct(optName, products);
        if (matchedProd && matchedProd.customizations && matchedProd.customizations.length > 0) {
          const subGroups = getOrderedModifierGroups(matchedProd.customizations);
          for (const [subGroupName, subOpts] of subGroups) {
            const dynamicGroupName = `${optName} — ${subGroupName}`;
            const defs = subOpts.filter((so: any) => Boolean(so.is_default));
            defs.forEach((subO: any) => {
              allDefaults.push({
                ...subO,
                id: `sub_${bOpt.id}_${subO.id}`,
                original_id: subO.id,
                parent_option_id: bOpt.id,
                parent_option_name: optName,
                option_group_name: dynamicGroupName,
                price: isBundle ? 0 : (subO.price || 0),
                quantity: 1,
              });
            });
          }
        }
      });

      setSelectedCustomizations(allDefaults);
      setItemNote("");
      setCustomizationQty(1);
    }
    setActiveTabModal("customization");
  };

  const handleToggleOption = (custOption: any, isMultiSelect: boolean, totalSteps: number = 1) => {
    setCustomizationError("");
    const groupName = custOption.option_group_name;
    if (isMultiSelect) {
      // Checkbox-style: toggle individual option within group
      const exists = selectedCustomizations.some((c: any) => c.id === custOption.id || c.original_id === custOption.id);
      if (exists) {
        setSelectedCustomizations(selectedCustomizations.filter((c: any) => c.id !== custOption.id && c.original_id !== custOption.id && c.parent_option_id !== custOption.id));
      } else {
        setSelectedCustomizations([...selectedCustomizations, { ...custOption, quantity: 1 }]);
      }
    } else {
      // Radio-style: clear ALL other selections in this group and their sub-options, then pick this one
      const alreadySelected = selectedCustomizations.some((c: any) => c.id === custOption.id || c.original_id === custOption.id);
      const previousInGroup = selectedCustomizations.find((c: any) => c.option_group_name === groupName);
      const prevId = previousInGroup?.id;
      
      const filtered = selectedCustomizations.filter((c: any) =>
        c.option_group_name !== groupName && (!prevId || c.parent_option_id !== prevId)
      );

      if (alreadySelected) {
        setSelectedCustomizations(filtered.filter((c: any) => c.parent_option_id !== custOption.id));
      } else {
        const isBundle = currentProduct ? Boolean(
          currentProduct.category_id === 30 ||
          (currentProduct.category_name && currentProduct.category_name.toLowerCase().includes('bundle')) ||
          (currentProduct.name && currentProduct.name.toLowerCase().includes('bundle'))
        ) : false;

        // Auto-select defaults for any sub-modifiers this option provides
        const subDefaults: any[] = [];
        const optName = custOption.name || custOption.ingredient;
        const matchedProd = findMatchingProduct(optName, products);
        if (matchedProd && matchedProd.customizations && matchedProd.customizations.length > 0) {
          const subGroups = getOrderedModifierGroups(matchedProd.customizations);
          for (const [subGroupName, subOpts] of subGroups) {
            const dynamicGroupName = `${optName} — ${subGroupName}`;
            const defs = subOpts.filter((so: any) => Boolean(so.is_default));
            defs.forEach((subO: any) => {
              subDefaults.push({
                ...subO,
                id: `sub_${custOption.id}_${subO.id}`,
                original_id: subO.id,
                parent_option_id: custOption.id,
                parent_option_name: optName,
                option_group_name: dynamicGroupName,
                price: isBundle ? 0 : (subO.price || 0),
                quantity: 1,
              });
            });
          }
        }

        setSelectedCustomizations([...filtered, { ...custOption, quantity: 1 }, ...subDefaults]);
        // Automatically advance to the next modifier screen when picking a single-choice option
        if (customizationStep < totalSteps - 1) {
          setTimeout(() => {
            setCustomizationStep((prev) => Math.min(prev + 1, totalSteps - 1));
          }, 160);
        }
      }
    }
  };

  const handleUpdateOptionQty = (custOption: any, delta: number) => {
    setCustomizationError("");
    const existing = selectedCustomizations.find((c: any) => c.id === custOption.id);
    if (!existing) {
      if (delta > 0) {
        setSelectedCustomizations([...selectedCustomizations, { ...custOption, quantity: 1 }]);
      }
      return;
    }
    const currentQty = Number(existing.quantity || 1);
    const newQty = currentQty + delta;
    if (newQty <= 0) {
      setSelectedCustomizations(selectedCustomizations.filter((c: any) => c.id !== custOption.id));
    } else {
      setSelectedCustomizations(
        selectedCustomizations.map((c: any) =>
          c.id === custOption.id ? { ...c, quantity: newQty } : c
        )
      );
    }
  };

  const handleSaveCustomizationToCart = () => {
    if (!currentProduct) return;

    if (currentProduct.customizations?.length > 0) {
      const orderedGroups = getOrderedModifierGroups(currentProduct.customizations);

      for (let idx = 0; idx < orderedGroups.length; idx++) {
        const [groupName, opts] = orderedGroups[idx];
        // is_required is set per-item on the group; any item in group having it = group is required
        const isReq = (opts as any[]).some((o: any) => o.is_required);
        if (isReq) {
          const hasSelected = selectedCustomizations.some((c: any) => (opts as any[]).some((o: any) => o.id === c.id));
          if (!hasSelected) {
            setCustomizationStep(idx);
            setCustomizationError(`⚠️ "${groupName}" (Screen ${idx + 1} of ${orderedGroups.length}) is REQUIRED — please make a selection.`);
            return;
          }
        }
      }
    }

    const isBundle = Boolean(
      currentProduct.category_id === 30 ||
      (currentProduct.category_name && currentProduct.category_name.toLowerCase().includes('bundle')) ||
      (currentProduct.category && currentProduct.category.toLowerCase().includes('bundle')) ||
      (currentProduct.name && currentProduct.name.toLowerCase().includes('bundle'))
    );

    let extraCost = 0;
    if (!isBundle) {
      selectedCustomizations.forEach((c) => {
        const q = Number(c.quantity || 1);
        if (c.price) extraCost += c.price * q;
      });
    }

    const unitPrice = (currentProduct.unit_price_usd || 0) + extraCost;

    const existing = editingItemIndex !== null ? ticketItems[editingItemIndex] : null;
    const persistentLineId = existing?.line_item_id || (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'line-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8));

    const newItem = {
      line_item_id: persistentLineId,
      product_id: currentProduct.id,
      name: currentProduct.name,
      base_price: currentProduct.unit_price_usd,
      unit_price: unitPrice,
      qty: customizationQty,
      selectedCustomizations,
      note: itemNote.trim(),
      isOrdered: existing ? Boolean(existing.isOrdered) : false,
      item_added_by: existing?.item_added_by || activeCashier?.name || user?.name || "Cashier",
      item_added_by_id: existing?.item_added_by_id || activeCashier?.id || user?.id || null
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

  const handleUpdateQty = (index: number, delta: number) => {
    const item = ticketItems[index];
    if (!item) return;

    const targetOrderId = editingOrderId || activeTableContext?.orderId;
    const isOrderedItem = Boolean(item.isOrdered && targetOrderId);

    if (delta < 0) {
      if (isOrderedItem) {
        // Decrementing an already-ordered item requires manager authorization and void waste logging!
        handlePromptVoid(index, 1);
        return;
      }
      // Draft item just added to the basket: decrement or remove immediately
      const updated = [...ticketItems];
      const newQty = item.qty + delta;
      if (newQty <= 0) {
        updated.splice(index, 1);
      } else {
        updated[index] = { ...item, qty: newQty };
      }
      setTicketItems(updated);
      return;
    }

    // delta > 0: increment qty
    const updated = [...ticketItems];
    updated[index] = { ...item, qty: item.qty + delta };
    setTicketItems(updated);
  };

  const handleRemoveTicketItem = (index: number) => {
    const updated = [...ticketItems];
    updated.splice(index, 1);
    setTicketItems(updated);
  };

  const handlePromptVoid = (index: number, qtyToVoid?: number) => {
    const itemToVoid = ticketItems[index];
    if (!itemToVoid) return;

    // Hold separators can be removed freely without manager void
    if (itemToVoid.isHoldSeparator || itemToVoid.name === 'HOLD') {
      handleRemoveTicketItem(index);
      return;
    }

    const targetOrderId = editingOrderId || activeTableContext?.orderId;
    // Authorized void should ONLY appear once items are ordered, not when just added to the basket!
    const isOrderedItem = Boolean(itemToVoid.isOrdered && targetOrderId);

    if (isOrderedItem) {
      const actualQtyToVoid = Math.min(itemToVoid.qty || 1, qtyToVoid && qtyToVoid > 0 ? qtyToVoid : (itemToVoid.qty || 1));
      const staffUser = activeCashier || user;
      const canVoidDirect = hasPosPermission(staffUser, 'void_sent_items');

      const triggerItemVoid = () => {
        setVoidModalState({
          isOpen: true,
          orderId: targetOrderId,
          tableNumber: activeTableContext?.tableCode || null,
          items: [{
            name: itemToVoid?.name || 'Item',
            qty: actualQtyToVoid,
            price: itemToVoid?.unit_price || 0,
            product_id: itemToVoid?.product_id
          }],
          voidType: 'item_void',
          targetItemIndex: index,
          qtyToVoid: actualQtyToVoid,
          onSuccess: () => {
            // Callback after void completes
          }
        });
      };

      if (canVoidDirect) {
        triggerItemVoid();
      } else {
        setSupervisorAuthRequest({
          actionKey: 'void_sent_items',
          actionTitle: `Void Item: ${itemToVoid?.name || 'Item'} (x${actualQtyToVoid})`,
          tableNumber: activeTableContext?.tableCode || null,
          orderId: targetOrderId,
          previousValue: itemToVoid?.qty,
          newValue: (itemToVoid?.qty || 1) - actualQtyToVoid,
          requireReason: true,
          defaultReason: 'Sent item void request',
          onAuthorized: async () => {
            triggerItemVoid();
          }
        });
      }
    } else {
      // Local draft cart item removal
      if (qtyToVoid && qtyToVoid < itemToVoid.qty) {
        const updated = [...ticketItems];
        updated[index] = { ...itemToVoid, qty: itemToVoid.qty - qtyToVoid };
        setTicketItems(updated);
      } else {
        handleRemoveTicketItem(index);
      }
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

  const tableEditorRequest = useRef(0);
  const handleCancelEdit = () => {
    tableEditorRequest.current += 1;
    const wasTable = Boolean(activeTableContext);
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
    setOrderType("pickup");
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
    handleResetToMainMenu();
    setIsFeaturesModalOpen(false);
    if (wasTable) { setPosActiveView('tables'); refreshFloorTables().catch(() => {}); }
  };

  const handleVoidTable = () => {
    const targetOrderId = editingOrderId || activeTableContext?.orderId;
    if (!activeTableContext || !targetOrderId || isSubmitting) return;
    setIsFeaturesModalOpen(false);

    const staffUser = activeCashier || user;
    const canVoid = hasPosPermission(staffUser, 'cancel_entire_order') || hasPosPermission(staffUser, 'void_sent_items');

    const triggerTableVoid = () => {
      setVoidModalState({
        isOpen: true, orderId: targetOrderId, tableNumber: activeTableContext.tableCode,
        items: ticketItems.filter(i => i.isOrdered && !i.isHoldSeparator).map(it => ({
          name: it.name, qty: it.qty, price: it.unit_price, product_id: it.product_id
        })),
        voidType: 'order_cancellation',
        onSuccess: () => { updateTableFireCount(currentTableKey, 0); handleCancelEdit(); }
      });
    };

    if (canVoid) {
      triggerTableVoid();
    } else {
      setSupervisorAuthRequest({
        actionKey: 'cancel_entire_order',
        actionTitle: `Void Order for Table ${activeTableContext.tableCode}`,
        tableNumber: activeTableContext.tableCode,
        orderId: targetOrderId,
        requireReason: true,
        defaultReason: 'Void table order',
        onAuthorized: async () => {
          triggerTableVoid();
        }
      });
    }
  };

  const handleResetCart = () => {
    const hasOrderedItems = ticketItems.some(i => i.isOrdered);
    const targetOrderId = editingOrderId || activeTableContext?.orderId;

    if (hasOrderedItems && targetOrderId) {
      // If there are uncommitted draft items added in this session, clear only draft items
      const hasDraftItems = ticketItems.some(i => !i.isOrdered && !i.isHoldSeparator);
      if (hasDraftItems) {
        setTicketItems(ticketItems.filter(i => i.isOrdered || i.isHoldSeparator));
        return;
      }

      // If only ordered items remain, wiping cart requires manager void authorization
      const staffUser = activeCashier || user;
      const canVoid = hasPosPermission(staffUser, 'cancel_entire_order') || hasPosPermission(staffUser, 'void_sent_items');

      const triggerCartWipe = () => {
        setVoidModalState({
          isOpen: true,
          orderId: targetOrderId,
          tableNumber: activeTableContext?.tableCode || null,
          items: ticketItems.filter(i => !i.isHoldSeparator).map(it => ({
            name: it.name,
            qty: it.qty,
            price: it.unit_price,
            product_id: it.product_id
          })),
          voidType: 'order_cancellation',
          onSuccess: () => {
            updateTableFireCount(currentTableKey, 0);
            releaseCurrentOrderLock();
            resetClientOrderToken();
            setActiveTableContext(null);
            setQuickTableInput("");
            setTicketItems([]);
            setEditingOrderId(null);
            setEditingOrderVersion(null);
          }
        });
      };

      if (canVoid) {
        triggerCartWipe();
      } else {
        setSupervisorAuthRequest({
          actionKey: 'cancel_entire_order',
          actionTitle: `Cancel Order #${targetOrderId}`,
          tableNumber: activeTableContext?.tableCode || null,
          orderId: targetOrderId,
          requireReason: true,
          defaultReason: 'Cart wipe / cancellation',
          onAuthorized: async () => {
            triggerCartWipe();
          }
        });
      }
      return;
    }

    if (activeTableContext && ticketItems.length === 0) {
      if (activeTableContext.sessionId && !activeTableContext.orderId) {
        closeTableSession(activeTableContext.sessionId).catch(() => {});
      }
      if (activeTableContext.tableId && activeTableContext.isNewlyCreated) {
        deleteTable(activeTableContext.tableId).catch(() => {});
      }
    }
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
    setOrderType("pickup");
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
    handleResetToMainMenu();
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
      const val = typeof discountValInput === 'number' ? discountValInput : (parseFloat(discountValInput) || 0);
      if (discountIsPercent) return subtotal * (val / 100);
      return Math.min(subtotal, val);
    }
    return 0;
  })();

  const discountAmount = calculatedDiscount;

  // VAT calculation: applied to taxable net sales when VAT Subscribed (Yes/No) is Yes
  const taxableBase = Math.max(0, subtotal - discountAmount);
  const vatAmount = isVatSubscribed ? Number((taxableBase * (vatRate / 100)).toFixed(2)) : 0;
  const total = Math.max(
    0,
    subtotal + (orderType === "delivery" ? (Number(deliveryFee) || 0) : 0) - discountAmount + vatAmount
  );

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
    const staffUser = activeCashier || user;
    if (!hasPosPermission(staffUser, 'print_bill') && !hasPosPermission(staffUser, 'view_bill')) {
      alert(`⚠️ Your assigned role (${staffUser?.role || 'Staff'}) does not have permission to print customer bills.`);
      return;
    }
    if (!isShiftOpen) {
      alert("⚠️ Cannot print bill: Shift is closed. Please open your shift first.");
      setIsOpenShiftModalOpen(true);
      return;
    }
    if (!table.commerce_order_id && !table.current_session_id) return;
    try {
      let ord: any;
      if (!HAS_COMMERCE_API) {
        if (table.commerce_order_id) {
          const { data } = await supabase.from('pos_orders').select('*, items:pos_order_items(*)').eq('id', table.commerce_order_id).maybeSingle();
          ord = data;
          if (!ord) {
            const { data: legData } = await supabase.from('orders').select('*').eq('id', table.commerce_order_id).maybeSingle();
            ord = legData;
          }
        }
      } else {
        const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders?type=all`);
        const data = await res.json();
        const orders = data.orders || [];
        ord = orders.find((o: any) => o.id === table.commerce_order_id);
      }

      const preCheckPayload = {
        isPreCheck: true,
        title: "GUEST CHECK / BILL — NOT PAID",
        id: ord?.id || `Table-${table.table_code}`,
        table_code: table.table_code,
        table_label: table.table_code,
        guest_count: table.guest_count || 1,
        waiter_name: table.assigned_waiter || activeCashier?.name || user?.name || "Staff",
        served_by: table.assigned_waiter || activeCashier?.name || user?.name || "Staff",
        server_name: table.assigned_waiter || activeCashier?.name || user?.name || "Staff",
        restaurant_name: localStorage.getItem('flow_pos_restaurant_name') || "Neo Beirut",
        company_legal_name: localStorage.getItem('flow_pos_company_legal_name') || "Neo Beirut S.A.L.",
        mof_number: localStorage.getItem('flow_pos_mof_number') || "382910-601",
        exchange_rate: exchangeRate || 89500,
        footer_message: localStorage.getItem('flow_pos_receipt_footer') || "Thank you for dining with us! Come back soon.",
        order_source: "Dine In",
        order_type: "dine_in",
        items: ord?.items ? ord.items.map((it: any) => {
          const allCusts = it.customizations_json ? JSON.parse(it.customizations_json) : (it.customizations || []);
          // On customer guest check / bill, strictly omit zero-value modifiers (choices, removals, free add-ons)
          const billCusts = (Array.isArray(allCusts) ? allCusts : []).filter((c: any) =>
            typeof c === 'object' && c !== null && Number(c.price || c.unit_price || 0) > 0
          );
          return {
            name: it.product_name || it.name,
            qty: it.quantity,
            unit_price: parseFloat(it.unit_price || 0),
            price: parseFloat(it.unit_price || 0),
            total_price: parseFloat(it.total_price || (it.unit_price * it.quantity) || 0),
            selectedCustomizations: billCusts,
            customizations: billCusts,
            note: it.comment || it.note || ""
          };
        }) : ticketItems.map((it: any) => {
          const allCusts = it.selectedCustomizations || [];
          const billCusts = (Array.isArray(allCusts) ? allCusts : []).filter((c: any) =>
            typeof c === 'object' && c !== null && Number(c.price || c.unit_price || 0) > 0
          );
          return {
            name: it.name,
            qty: it.qty,
            unit_price: parseFloat(it.unit_price || 0),
            price: parseFloat(it.unit_price || 0),
            total_price: parseFloat(it.unit_price || 0) * (it.qty || 1),
            selectedCustomizations: billCusts,
            customizations: billCusts,
            note: it.note || ""
          };
        }),
        subtotal_amount: parseFloat(ord?.subtotal_amount || subtotal || 0),
        discount_amount: parseFloat(ord?.discount_amount || discountAmount || 0),
        is_vat_subscribed: isVatSubscribed,
        vat_rate: isVatSubscribed ? vatRate : 0,
        vat_amount: isVatSubscribed ? (parseFloat(ord?.vat_amount || 0) || vatAmount) : 0,
        total_amount: parseFloat(ord?.total_amount || total || 0),
        created_at: ord?.created_at || new Date().toISOString()
      };

      await handlePrint(preCheckPayload);

      // Transition table session to bill_requested
      if (table.current_session_id) {
        await requestBill(table.current_session_id);
      }

      // Update pos_orders to note bill was printed
      if (ord?.id) {
        await supabase
          .from('pos_orders')
          .update({
            status: 'bill_requested',
            special_instructions: ord.special_instructions ? `${ord.special_instructions} [BILL_PRINTED]` : '[BILL_PRINTED]',
            updated_at: new Date().toISOString()
          })
          .eq('id', ord.id);
      }

      setReprintSuccessMsg(`Bill printed for Table ${table.table_code}! Staff notified.`);
      refreshFloorTables().catch(() => {});
      fetchOrdersQueue();
    } catch (err) {
      console.error("Error printing pre-check:", err);
    }
  };

  const handlePrintBillFromPaymentModal = async () => {
    if (!isShiftOpen) {
      alert("⚠️ Cannot print bill: Shift is closed. Please open your shift first.");
      setIsOpenShiftModalOpen(true);
      return;
    }
    try {
      const orderId = activeTableContext?.orderId || editingOrderId;
      const tableCode = activeTableContext?.tableCode || "Table";
      const waiter = activeTableContext?.waiterName || activeCashier?.name || user?.name || "Staff";

      const preCheckPayload = {
        isPreCheck: true,
        title: "GUEST CHECK / BILL — NOT PAID",
        id: orderId || `Table-${tableCode}`,
        table_code: tableCode,
        guest_count: activeTableContext?.guestCount || 1,
        waiter_name: waiter,
        order_source: "Dine In",
        order_type: "dine_in",
        items: ticketItems.map((it: any) => {
          const allCusts = it.selectedCustomizations || [];
          // On customer guest check / bill, strictly omit zero-value modifiers (choices, removals, free add-ons)
          const billCusts = (Array.isArray(allCusts) ? allCusts : []).filter((c: any) =>
            typeof c === 'object' && c !== null && Number(c.price || c.unit_price || 0) > 0
          );
          return {
            name: it.name,
            qty: it.qty,
            unit_price: parseFloat(it.unit_price || 0),
            price: parseFloat(it.unit_price || 0),
            total_price: parseFloat(it.unit_price || 0) * (it.qty || 1),
            selectedCustomizations: billCusts,
            customizations: billCusts,
            note: it.note || ""
          };
        }),
        subtotal_amount: subtotal,
        discount_amount: discountAmount,
        is_vat_subscribed: isVatSubscribed,
        vat_rate: isVatSubscribed ? vatRate : 0,
        vat_amount: vatAmount,
        total_amount: total,
        created_at: new Date().toISOString()
      };

      await handlePrint(preCheckPayload);

      // Transition session to bill_requested
      if (activeTableContext?.sessionId) {
        await requestBill(activeTableContext.sessionId);
      }

      // Update pos_orders so Orders Hub & table status show Bill Printed
      if (orderId) {
        await supabase
          .from('pos_orders')
          .update({
            status: 'bill_requested',
            special_instructions: '[BILL_PRINTED]',
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);
      }

      setReprintSuccessMsg(`Bill printed for Table ${tableCode}! Order remains open for payment.`);
      refreshFloorTables().catch(() => {});
      fetchOrdersQueue();
    } catch (err) {
      console.error("Error printing bill from payment modal:", err);
    }
  };

  const handleQuickAssignTable = async (inputStr: string) => {
    const raw = inputStr.trim();
    if (!raw) return;

    const flowBranchId = currentBranchId || commerceBranchLink?.flow_branch_id || branchCapabilities?.branchId || '';
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
          let ord: any;
          if (!HAS_COMMERCE_API) {
            const { data } = await supabase.from('pos_orders').select('*, items:pos_order_items(*)').eq('id', res.orderId).maybeSingle();
            ord = data;
          } else {
            const orderRes = await fetch(`${COMMERCE_API_BASE}/api/pos/orders?type=all`);
            const data = await orderRes.json();
            ord = (data.orders || []).find((o: any) => o.id === res.orderId);
          }
          if (ord) {
            loadOrderToTicket(ord, "POS");
            setActiveTableContext({
              orderId: res.orderId,
              tableCode: res.table.table_code,
              sessionId: res.sessionId,
              tableId: res.table.id,
              guestCount: res.guestCount,
              waiterName: res.waiterName,
              isExistingOccupied: true,
              isNewlyCreated: false
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
        tableId: res.table.id,
        isNewlyCreated: Boolean(res.isNewlyCreated),
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
      if (activeTableContext?.tableId && activeTableContext.isNewlyCreated) {
        try {
          await deleteTable(activeTableContext.tableId);
        } catch (e) {}
      }
    }
    await handleQuickAssignTable(tableCode);
    setPosActiveView('sell');
  };

  const handleSaveTableOrderSilently = async () => {
    if (!activeTableContext || ticketItems.length === 0) return;
    const tableLabel = activeTableContext.tableCode;
    let existingOrderId = activeTableContext.orderId || editingOrderId;

    if (!existingOrderId && tableLabel) {
      try {
        const { data: activeForTable } = await supabase
          .from('pos_orders')
          .select('id')
          .in('table_label', [tableLabel, `T${tableLabel.replace(/^T/i, '')}`, `Table ${tableLabel}`])
          .in('status', ['held', 'preparing', 'new', 'confirmed', 'ready', 'open', 'occupied', 'bill_requested'])
          .order('id', { ascending: false })
          .limit(1);
        if (activeForTable && activeForTable.length > 0) {
          existingOrderId = activeForTable[0].id;
          setActiveTableContext(prev => prev ? { ...prev, orderId: existingOrderId } : null);
          setEditingOrderId(existingOrderId);
        }
      } catch (e) {
        console.warn('Could not check existing table order on hold:', e);
      }
    }

    const payload = {
      branch_id: COMMERCE_API_BASE ? commerceBranchLink?.external_branch_id : (currentBranchId || commerceBranchLink?.flow_branch_id),
      restaurant_id: currentRestaurantId,
      concept_id: workspaceState.activeConcept.id,
      client_order_token: clientOrderToken,
      orderType: "dine_in",
      service_type: "dine_in",
      table_label: tableLabel,
      guest_count: activeTableContext.guestCount || 1,
      waiter_reference: activeTableContext.waiterName || user?.name || "Cashier",
      cashierName: activeCashier?.name || user?.name || "Cashier",
      orderSource: selectedChannel || "POS",
      paymentMethod: selectedPaymentMethod || "Cash USD",
      payment_status: "pending",
      customerName: customerName.trim() || `Table ${tableLabel}`,
      customerPhone,
      deliveryAddress,
      status: "held",
      subtotal,
      deliveryFee: 0,
      discountAmount,
      total,
      items: ticketItems.map((item) => ({
        line_item_id: item.line_item_id,
        product_id: item.product_id,
        name: item.name,
        quantity: item.qty,
        unit_price: item.unit_price,
        customizations: item.selectedCustomizations || [],
        comment: item.note
      }))
    };

    if (existingOrderId) {
      // Update existing order with current items
      const saveResult = await updateDirectOrderStatus(existingOrderId, {
        subtotal,
        total,
        items: payload.items
      });
      if (!saveResult.success) throw new Error(saveResult.error);
      if (activeTableContext.sessionId) {
        await supabase
          .from('pos_table_sessions')
          .update({
            commerce_order_id: existingOrderId,
            status: 'occupied',
            sync_status: 'synced',
            last_sync_error: null
          })
          .eq('id', activeTableContext.sessionId);
      }
    } else {
      // Create new direct order in Supabase
      const data = await createDirectOrder(payload);
      if (!data.success) { if (data.orderId) setEditingOrderId(data.orderId); throw new Error(data.error); }
      if (data.success) {
        const heldOrderId = data.order?.id || data.orderId;
        if (activeTableContext.sessionId && heldOrderId) {
          await supabase
            .from('pos_table_sessions')
            .update({
              commerce_order_id: heldOrderId,
              status: 'occupied',
              sync_status: 'synced',
              last_sync_error: null
            })
            .eq('id', activeTableContext.sessionId);
        }
        setActiveTableContext(prev => prev ? { ...prev, orderId: heldOrderId } : null);
        setEditingOrderId(heldOrderId);
      }
    }
  };

  const handleNavigateToTables = async () => {
    if (tableNavigationSaving.current) return;
    const staffUser = activeCashier || user;
    if (!hasPosPermission(staffUser, 'view_floor')) {
      alert(`⚠️ Your assigned role (${staffUser?.role || 'Staff'}) does not have permission to view the tables floor.`);
      return;
    }
    const needsSave = Boolean(activeTableContext && ticketItems.length > 0);
    tableNavigationSaving.current = needsSave;
    setIsSavingTableNavigation(needsSave);
    setPosActiveView('tables');
    try {
      if (needsSave) await handleSaveTableOrderSilently();
      refreshFloorTables().catch(() => {});
    } catch (e: any) {
      setValidationError(e?.message || 'Could not save the table order. Please retry.');
      setPosActiveView('sell');
    } finally {
      tableNavigationSaving.current = false;
      setIsSavingTableNavigation(false);
    }
  };
  const handleOpenFloorMap = async () => {
    await handleNavigateToTables();
  };

  const handleCloseTableAndSell = async () => {
    // If there are unsaved/draft items added in this session that were not placed/fired:
    const hasUnsavedDrafts = ticketItems.some(i => !i.isOrdered && !i.isHoldSeparator && i.name !== 'HOLD');
    if (hasUnsavedDrafts) {
      const confirmDiscard = window.confirm(`⚠️ Table ${activeTableContext?.tableCode || ''} has unplaced draft items. Discard new draft items and return to new sale?`);
      if (!confirmDiscard) return;
    }

    // Clean up empty table session if opened but never ordered
    if (activeTableContext?.sessionId && !isCurrentTableOccupied) {
      try {
        await closeTableSession(activeTableContext.sessionId);
      } catch (e) {}
    }
    if (activeTableContext?.tableId && activeTableContext.isNewlyCreated && !activeTableContext.orderId) {
      try {
        await deleteTable(activeTableContext.tableId);
      } catch (e) {}
    }

    // Release locks and reset table context back to clean sell register
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
    setOrderType("pickup");
    setDiscountType("none");
    setSelectedDiscountRule(null);
    setDiscountValInput(10);
    setDiscountIsPercent(true);
    setDeliveryFee(0);
    setValidationError("");
    handleResetToMainMenu();
    setPosActiveView('sell');
  };

  const handleClearCurrentTable = async () => {
    await handleCloseTableAndSell();
  };

  const handlePrint = async (orderData, requireAcknowledgement = false) => {
    if (orderData && (orderData.isPreCheck || orderData.items)) {
      setReceiptPreviewData(orderData);
      setIsReceiptPreviewOpen(true);
    }

    try {
      const effBranchId = currentBranchId || commerceBranchLink?.flow_branch_id;
      const isCustomerBill = Boolean(orderData?.isPreCheck || orderData?.payment_method || orderData?.isCustomerBill || (!orderData?.isKitchenTicket && !orderData?.isKitchenFire));

      if (isCustomerBill) {
        // Customer Bill / Receipt / Pre-Check: route strictly to Main Bill Printer
        const billJob = await buildMainBillPrintJob({
          order: {
            ...orderData,
            order_id: orderData.id || orderData.order_id,
            subtotal: orderData.subtotal_amount || orderData.subtotal || 0,
            total: orderData.total_amount || orderData.total || 0,
            currency: orderData.currency || 'USD',
            exchange_rate: orderData.exchange_rate || exchangeRate || 90000,
            items: orderData.items || []
          },
          isPreCheck: Boolean(orderData.isPreCheck),
          branchId: effBranchId || undefined,
          restaurantId: currentRestaurantId,
          footerText: orderData.footer_message
        });

        if (billJob) {
          const dispatchRes = await dispatchPhysicalPrintJobs([billJob]);
          if (dispatchRes.success) return true;
        }
      } else if (orderData?.isKitchenFire || orderData?.isSeparateFireTicket) {
        // Course fire chit: route to preparation fallback printer (Kitchen)
        const config = await loadBranchPrinterConfig(effBranchId, currentRestaurantId);
        const kitchenPrinter = config.fallbackPrepPrinter || config.printers[0];
        if (kitchenPrinter) {
          const fireJob = {
            printer: kitchenPrinter,
            section_key: 'Kitchen',
            ticket_type: 'prep_ticket' as const,
            ticket_payload: orderData,
            items: [],
            idempotency_key: `fire_ticket_${orderData.table || 'chit'}_${Date.now()}`
          };
          const dispatchRes = await dispatchPhysicalPrintJobs([fireJob]);
          if (dispatchRes.success) return true;
        }
      } else if (orderData?.items && orderData.items.length > 0) {
        // Preparation ticket with items: intelligent section routing
        const { jobs } = await buildPreparationPrintJobs({
          orderMetadata: {
            order_id: orderData.id || orderData.order_id || 'Chit',
            table_label: orderData.table_label || orderData.customer_name || 'Table',
            waiter_name: orderData.server || activeCashier?.name || user?.name || 'Staff'
          },
          items: orderData.items,
          branchId: effBranchId || undefined,
          restaurantId: currentRestaurantId,
          productsCatalog: products
        });

        if (jobs.length > 0) {
          const dispatchRes = await dispatchPhysicalPrintJobs(jobs);
          if (dispatchRes.success) return true;
        }
      }
    } catch (routeErr) {
      console.warn("Intelligent routing dispatch fallback:", routeErr);
    }

    const ip = printServerIP || "192.168.18.195";
    const port = printServerPort || "9191";
    const url = `http://${ip}:${port}/print`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
        signal: safeTimeoutSignal(2000),
      });
      const result = await res.json();
      if (res.ok && result && result.success) return true;
    } catch (err) {}

    if (requireAcknowledgement) throw new Error('The printer did not confirm the Fire ticket. Check the printer before trying again.');
    try {
      let iframe = document.getElementById("print_iframe") as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement("iframe") as HTMLIFrameElement;
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

  const validateOrder = (overrideCustomerName?: string, allowDefaultCustomer = false) => {
    if (!selectedChannel && !editingOrderId) {
      setSelectedChannel("POS");
    }
    const effectiveName = overrideCustomerName !== undefined ? overrideCustomerName : customerName;
    const isPickup = orderType === "pickup" || (selectedChannel || "").toLowerCase().includes("pick");
    const isDineIn = Boolean(activeTableContext);
    const isPosWalkin = orderType === "takeout" || !selectedChannel || selectedChannel === "POS" || selectedChannel === "Store";
    if (!allowDefaultCustomer && !isPickup && !isDineIn && !isPosWalkin && (!effectiveName || !effectiveName.trim())) {
      setValidationError("⚠️ Customer name is required for delivery orders");
      return false;
    }
    setValidationError("");
    return true;
  };

  const handleHoldOrder = async (scheduleOverrides?: { scheduledDate?: string; scheduledTime?: string; scheduledNote?: string }) => {
    if (isOverdueShift) {
      setIsOverdueModalOpen(true);
      return;
    }
    if (ticketItems.length === 0) return;
    if (!validateOrder()) return;
    if (isOverdueShift && !editingOrderId && !activeTableContext?.orderId) { setIsOverdueModalOpen(true); return; }
    if (!isShiftOpen) {
      alert("⚠️ A FLOW shift cash session must be open before holding orders or accepting payments.");
      setIsOpenShiftModalOpen(true);
      return;
    }

    if (scheduleOverrides) {
      if (scheduleOverrides.scheduledDate) setScheduledOrderDate(scheduleOverrides.scheduledDate);
      if (scheduleOverrides.scheduledTime !== undefined) setScheduledOrderTime(scheduleOverrides.scheduledTime);
      if (scheduleOverrides.scheduledNote !== undefined) setScheduledOrderNote(scheduleOverrides.scheduledNote);
    }
    const effScheduledTime = scheduleOverrides?.scheduledTime !== undefined ? scheduleOverrides.scheduledTime : scheduledOrderTime;
    const effScheduledDate = scheduleOverrides?.scheduledDate !== undefined ? scheduleOverrides.scheduledDate : scheduledOrderDate;
    const effScheduledNote = scheduleOverrides?.scheduledNote !== undefined ? scheduleOverrides.scheduledNote : scheduledOrderNote;

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

      let heldOrderId = activeTableContext?.orderId || editingOrderId;
      if (!heldOrderId && activeTableContext?.tableCode) {
        try {
          const { data: activeForTable } = await supabase
            .from('pos_orders')
            .select('id')
            .in('table_label', [activeTableContext.tableCode, `T${activeTableContext.tableCode.replace(/^T/i, '')}`, `Table ${activeTableContext.tableCode}`])
            .in('status', ['held', 'preparing', 'new', 'confirmed', 'ready', 'open', 'occupied', 'bill_requested'])
            .order('id', { ascending: false })
            .limit(1);
          if (activeForTable && activeForTable.length > 0) {
            heldOrderId = activeForTable[0].id;
            setActiveTableContext(prev => prev ? { ...prev, orderId: heldOrderId } : null);
            setEditingOrderId(heldOrderId);
          }
        } catch (e) {
          console.warn('Could not check existing table order on send to kitchen:', e);
        }
      }
      const orderPayload = {
        branch_id: COMMERCE_API_BASE ? commerceBranchLink?.external_branch_id : (currentBranchId || commerceBranchLink?.flow_branch_id),
        restaurant_id: currentRestaurantId,
        concept_id: workspaceState.activeConcept.id,
        client_order_token: clientOrderToken,
        orderType: isDineIn ? "dine_in" : (orderType || "takeout"),
        service_type: isDineIn ? "dine_in" : undefined,
        table_label: activeTableContext ? activeTableContext.tableCode : undefined,
        guest_count: activeTableContext ? (activeTableContext.guestCount || 1) : undefined,
        waiter_reference: activeTableContext ? (activeTableContext.waiterName || user?.name) : (activeCashier?.name || user?.name),
        cashierName: activeCashier?.name || user?.name || "Cashier",
        orderSource: selectedChannel || "POS",
        paymentMethod: selectedPaymentMethod || "Cash USD",
        payment_status: "pending",
        customerName: resolvedCustomerName,
        customerPhone,
        deliveryAddress,
        status: isDineIn ? "held" : "preparing",
        subtotal,
        deliveryFee: (!isDineIn && orderType === "delivery") ? (Number(deliveryFee) || 0) : 0,
        discountAmount,
        is_vat_subscribed: isVatSubscribed,
        vat_rate: isVatSubscribed ? vatRate : 0,
        vat_amount: vatAmount,
        total,
        is_scheduled: Boolean(effScheduledTime),
        scheduled_for: effScheduledTime ? `${effScheduledDate} ${effScheduledTime}` : undefined,
        scheduled_note: effScheduledNote || undefined,
        items: ticketItems.map((item) => ({
          line_item_id: item.line_item_id,
          product_id: item.product_id,
          name: item.name,
          quantity: item.qty,
          qty: item.qty,
          unit_price: item.unit_price,
          unit_price_usd: item.unit_price,
          price: item.unit_price,
          total_price: Number(item.unit_price || 0) * Number(item.qty || 1),
          customizations: item.selectedCustomizations || [],
          comment: item.note,
          item_added_by: item.item_added_by || activeCashier?.name || user?.name || "Cashier",
          item_added_by_id: item.item_added_by_id || activeCashier?.id || user?.id || null
        }))
      };

      let data: any = null;

      if (HAS_COMMERCE_API) {
        try {
          if (heldOrderId) {
            const updateRes = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${heldOrderId}/status`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: isDineIn ? "held" : "preparing",
                subtotal,
                subtotal_amount: subtotal,
                deliveryFee: (!isDineIn && orderType === "delivery") ? (Number(deliveryFee) || 0) : 0,
                delivery_fee: (!isDineIn && orderType === "delivery") ? (Number(deliveryFee) || 0) : 0,
                discountAmount,
                discount_amount: discountAmount,
                total,
                total_amount: total,
                customerName: resolvedCustomerName,
                customerPhone,
                deliveryAddress,
                orderType: isDineIn ? "dine_in" : (orderType || "takeout"),
                orderSource: selectedChannel || "POS",
                items: orderPayload.items
              })
            });
            if (updateRes.ok) {
              data = await updateRes.json();
              if (data) data.orderId = heldOrderId;
            } else {
              const errBody = await updateRes.json().catch(() => ({}));
              data = { success: false, error: errBody.error || `HTTP ${updateRes.status} updating order` };
            }
          } else {
            const extBranch = commerceBranchLink?.external_branch_id || currentBranchId || commerceBranchLink?.flow_branch_id;
            const createRes = await fetch(`${COMMERCE_API_BASE}/api/pos/orders`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                branch_id: extBranch,
                restaurant_id: currentRestaurantId,
                concept_id: workspaceState.activeConcept?.id,
                client_order_token: clientOrderToken,
                orderType: isDineIn ? "dine_in" : (orderType || "takeout"),
                service_type: isDineIn ? "dine_in" : undefined,
                table_label: activeTableContext ? activeTableContext.tableCode : undefined,
                guest_count: activeTableContext ? (activeTableContext.guestCount || 1) : undefined,
                waiter_reference: activeTableContext ? (activeTableContext.waiterName || user?.name) : (activeCashier?.name || user?.name),
                cashierName: activeCashier?.name || user?.name || "Cashier",
                orderSource: selectedChannel || "POS",
                paymentMethod: selectedPaymentMethod || "Cash USD",
                payment_status: "pending",
                customerName: resolvedCustomerName,
                customerPhone,
                deliveryAddress,
                status: isDineIn ? "held" : "preparing",
                subtotal,
                subtotal_amount: subtotal,
                deliveryFee: (!isDineIn && orderType === "delivery") ? (Number(deliveryFee) || 0) : 0,
                delivery_fee: (!isDineIn && orderType === "delivery") ? (Number(deliveryFee) || 0) : 0,
                discountAmount,
                discount_amount: discountAmount,
                total,
                total_amount: total,
                is_scheduled: Boolean(effScheduledTime),
                scheduled_for: effScheduledTime ? `${effScheduledDate} ${effScheduledTime}` : undefined,
                scheduled_note: effScheduledNote || undefined,
                items: orderPayload.items
              })
            });
            if (createRes.ok) {
              data = await createRes.json();
              if (data?.order?.id) data.orderId = data.order.id;
              if (data && data.success) {
                heldOrderId = data.orderId || data.order?.id;
              }
            } else {
              const errBody = await createRes.json().catch(() => ({}));
              data = { success: false, error: errBody.error || `HTTP ${createRes.status} creating order` };
            }
          }
        } catch (apiErr: any) {
          console.warn("Commerce API order placement failed, falling back to direct DB:", apiErr);
        }
      }

      if (!data || !data.success) {
        if (heldOrderId) {
          data = await updateDirectOrderStatus(heldOrderId, {
            subtotal,
            total,
            items: orderPayload.items,
            ...(!isDineIn ? {
              is_scheduled: Boolean(effScheduledTime),
              scheduled_for: effScheduledTime ? `${effScheduledDate} ${effScheduledTime}` : null,
              scheduled_notes: effScheduledNote || null
            } : {})
          });
        } else {
          data = await createDirectOrder(orderPayload);
          if (data && data.success) {
            heldOrderId = data.order?.id || data.orderId;
          }
        }
      }

      if (!data?.success) {
        if (data?.orderId) setEditingOrderId(data.orderId);
        const errMsg = data?.error || 'Order save failed.';
        setValidationError(errMsg);
        alert('⚠️ ' + errMsg);
        return;
      }
      if (heldOrderId) {
        if (activeTableContext?.sessionId) {
          try {
            await supabase
              .from('pos_table_sessions')
              .update({
                commerce_order_id: heldOrderId,
                status: 'occupied',
                sync_status: 'synced',
                last_sync_error: null
              })
              .eq('id', activeTableContext.sessionId);
          } catch (e) {
            console.warn("Could not update pos_table_sessions with held order ID:", e);
          }
        }

        // If this was a scheduled order, print the kitchen ticket chit
        if (effScheduledTime) {
          const formattedSchedule = formatScheduledTimeDisplay(effScheduledDate, effScheduledTime);
          const scheduledKitchenPayload = {
            id: heldOrderId,
            isKitchenTicket: true,
            isScheduledOrder: true,
            title: "*** SCHEDULED ORDER ***",
            scheduled_for: `${effScheduledDate} ${effScheduledTime}`,
            scheduled_time_display: formattedSchedule,
            scheduled_note: effScheduledNote,
            order_source: selectedChannel || "POS",
            order_type: orderType,
            customer_name: resolvedCustomerName,
            customer_phone: customerPhone,
            items: [
              {
                name: "*** SCHEDULED ORDER ***",
                qty: 1,
                customizations_print_text: [
                  `READY AT: ${formattedSchedule}`,
                  ...(effScheduledNote ? [`NOTE: ${effScheduledNote}`] : [])
                ],
                note: `READY AT: ${formattedSchedule}${effScheduledNote ? ` | ${effScheduledNote}` : ''}`
              },
              ...ticketItems.map((it: any) => ({
                name: it.name,
                qty: it.qty,
                note: it.note,
                modifiers: it.selectedCustomizations || [],
                customizations_print_text: (it.selectedCustomizations || []).map((c: any) => typeof c === 'string' ? c : c.name || c.ingredient)
              }))
            ]
          };
          try {
            await handlePrint(scheduledKitchenPayload);
          } catch (pe) {
            console.warn("Kitchen print for scheduled order error:", pe);
          }
        } else {
          // Multi-Printer Preparation Routing Engine: Dispatch new items to section printers
          const unprintedItems = ticketItems.filter(it => !it.isOrdered && !isCourseHoldItem(it));
          if (unprintedItems.length > 0) {
            try {
              const effBranchId = currentBranchId || commerceBranchLink?.flow_branch_id;
              const { jobs } = await buildPreparationPrintJobs({
                orderMetadata: {
                  order_id: heldOrderId,
                  table_label: activeTableContext ? activeTableContext.tableCode : resolvedCustomerName,
                  table_code: activeTableContext?.tableCode,
                  guest_count: activeTableContext?.guestCount || 1,
                  waiter_name: activeTableContext?.waiterName || activeCashier?.name || user?.name || 'Staff',
                  cashier_name: activeCashier?.name || user?.name || 'Cashier',
                  service_type: isDineIn ? 'dine_in' : (orderType || 'takeout'),
                  fire_round: 1
                },
                items: unprintedItems,
                branchId: effBranchId || undefined,
                restaurantId: currentRestaurantId,
                productsCatalog: products
              });

              if (jobs.length > 0) {
                await dispatchPhysicalPrintJobs(jobs);
              }
            } catch (pe) {
              console.warn("Intelligent ticket routing error on order placement:", pe);
            }
          }
        }

        resetClientOrderToken();

        setActiveTableContext(null);
        setTicketItems([]);
        setCustomerName("");
        setCustomerPhone("");
        setDeliveryAddress("");
        setSelectedChannel(null);
        setMarketplaceOrderRef("");
        setEditingOrderId(null);
        setEditingOrderVersion(null);
        setDiscountType("none");
        setDiscountValInput(10);
        setDiscountIsPercent(true);
        setDeliveryFee(0);
        setOrderType("pickup");
        setScheduledOrderTime("");
        setScheduledOrderNote("");
        handleResetToMainMenu();
        fetchOrdersQueue();
        try {
          window.dispatchEvent(new CustomEvent('flow:order_created', { detail: { orderId: heldOrderId } }));
          window.dispatchEvent(new CustomEvent('flow:order_settled', { detail: { orderId: heldOrderId } }));
        } catch (e) {}
        refreshFloorTables().catch(() => {});
      } else {
        const errMsg = data?.error || "Failed to place order";
        setValidationError(errMsg);
        alert('⚠️ ' + errMsg);
      }
    } catch (err: any) {
      console.error("Error holding order:", err);
      const errMsg = err?.message || 'Error occurred while placing order.';
      setValidationError(errMsg);
      alert('⚠️ ' + errMsg);
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
    if (!targetOrderId && activeTableContext?.tableCode) {
      try {
        const { data: activeForTable } = await supabase
          .from('pos_orders')
          .select('id')
          .in('table_label', [activeTableContext.tableCode, `T${activeTableContext.tableCode.replace(/^T/i, '')}`, `Table ${activeTableContext.tableCode}`])
          .in('status', ['held', 'preparing', 'new', 'confirmed', 'ready', 'open', 'occupied', 'bill_requested'])
          .order('id', { ascending: false })
          .limit(1);
        if (activeForTable && activeForTable.length > 0) {
          targetOrderId = activeForTable[0].id;
          setActiveTableContext(prev => prev ? { ...prev, orderId: targetOrderId } : null);
          setEditingOrderId(targetOrderId);
        }
      } catch (e) {
        console.warn('Could not check existing table order on fire round:', e);
      }
    }
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
          branch_id: COMMERCE_API_BASE ? commerceBranchLink?.external_branch_id : (currentBranchId || commerceBranchLink?.flow_branch_id),
          restaurant_id: currentRestaurantId,
          concept_id: workspaceState.activeConcept.id,
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
            line_item_id: item.line_item_id,
            product_id: item.product_id,
            name: item.name,
            quantity: item.qty,
            unit_price: item.unit_price,
            customizations: item.selectedCustomizations || [],
            comment: item.note || ""
          }))
        };

        let targetOrderIdValue: any;
        if (!HAS_COMMERCE_API) {
          const directRes = await createDirectOrder(orderPayload);
          if (!directRes.success) {
            throw new Error(directRes.error || `Failed to create dine-in order for Table ${activeTableContext.tableCode}`);
          }
          targetOrderIdValue = directRes.orderId;
        } else {
          const createRes = await fetch(`${COMMERCE_API_BASE}/api/pos/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload)
          });
          const createData = await createRes.json();
          if (!createRes.ok || !createData.success) {
            throw new Error(createData.error || `Failed to create dine-in order for Table ${activeTableContext.tableCode}`);
          }
          targetOrderIdValue = createData.order?.id || createData.orderId;
        }

        targetOrderId = targetOrderIdValue;

        // Link this order to the FLOW table session
        if (activeTableContext.sessionId) {
          try {
            await supabase
              .from('pos_table_sessions')
              .update({
                commerce_order_id: targetOrderId,
                status: 'occupied',
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
        if (!HAS_COMMERCE_API) {
          const saveResult = await updateDirectOrderStatus(targetOrderId, {
            subtotal,
            total,
            items: ticketItems.map((item) => ({
              line_item_id: item.line_item_id,
              product_id: item.product_id,
              quantity: item.qty,
              unit_price: item.unit_price,
              customizations: item.selectedCustomizations || [],
              comment: item.note || ""
            }))
          });
          if (!saveResult.success) throw new Error(saveResult.error);
        } else {
          await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${targetOrderId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subtotal,
              total,
              items: ticketItems.map((item) => ({
                line_item_id: item.line_item_id,
                product_id: item.product_id,
                quantity: item.qty,
                unit_price: item.unit_price,
                customizations: item.selectedCustomizations || [],
                comment: item.note || ""
              }))
            })
          });
        }
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
    customerName?: string;
    isAdvancePayment?: boolean;
  }) => {
    if (ticketItems.length === 0) return;
    if (!validateOrder(paymentDetails?.customerName, true)) return;
    if (!isShiftOpen) {
      alert("⚠️ A FLOW shift cash session must be open before processing payments or submitting orders.");
      setIsOpenShiftModalOpen(true);
      return;
    }
    if (isOverdueShift && !editingOrderId && !activeTableContext?.orderId) { setIsOverdueModalOpen(true); return; }
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
    const isPickupOrder = orderType === "pickup" || (effectiveChannel || "").toLowerCase().includes("pick");
    const fallbackCustomer = isDineIn
      ? `Table ${activeTableContext?.tableCode}`
      : isPickupOrder
      ? "Pickup Customer"
      : "Direct Order";

    const finalCustomerName = (paymentDetails?.customerName && paymentDetails.customerName.trim() && paymentDetails.customerName.trim() !== ".")
      ? paymentDetails.customerName.trim()
      : ((customerName && customerName.trim() && customerName.trim() !== ".") ? customerName.trim() : fallbackCustomer);
    const isAdvance = Boolean(paymentDetails?.isAdvancePayment);
    // Final settlement closes every sale; advance payment leaves fulfillment open.
    const isCompletedStatus = !isAdvance;
    const targetOrderId = editingOrderId || activeTableContext?.orderId;
    const finalOrderStatus = isAdvance ? "paid" : "completed";
    const advanceInstructions = isAdvance ? "[PAID_IN_ADVANCE]" : undefined;

    setIsSubmitting(true);
    try {
      let data: any;
      if (!HAS_COMMERCE_API) {
        if (targetOrderId) {
          data = await updateDirectOrderStatus(targetOrderId, {
            status: finalOrderStatus,
            payment_status: 'paid',
            terminalId: persistentTerminalId,
            is_inventory_commit: true,
            tendered_amount: paymentDetails?.tenderedAmount ?? total,
            tendered_currency: paymentDetails?.tenderedCurrency || 'USD',
            change_amount: paymentDetails?.changeAmount || 0,
            change_currency: paymentDetails?.changeCurrency || 'USD',
            special_instructions: advanceInstructions,
            payment_method: actualPaymentMethod,
            customer_name: finalCustomerName,
            subtotal,
            total,
            items: ticketItems.map((item) => ({
              line_item_id: item.line_item_id,
              product_id: item.product_id,
              name: item.name,
              quantity: item.qty,
              unit_price: item.unit_price,
              customizations: item.selectedCustomizations || [],
              comment: item.note || "",
              item_added_by: item.item_added_by || activeCashier?.name || user?.name || "Cashier",
              item_added_by_id: item.item_added_by_id || activeCashier?.id || user?.id || null
            }))
          });
          if (data && data.success) data.orderId = targetOrderId;
        } else {
          const effectiveBranchId = currentBranchId || commerceBranchLink?.flow_branch_id;
          if (!effectiveBranchId) {
            alert("No active branch resolved for this session. Cannot place order.");
            setIsSubmitting(false);
            return;
          }
          const isTotersOrder = effectiveChannel === 'Toters';
          const isNoknokOrder = effectiveChannel === 'NokNok';
          const commissionPct = isTotersOrder ? activeAgreement.totersCommissionPct : isNoknokOrder ? activeAgreement.noknokCommissionPct : 0;
          const commissionUsd = (subtotal * (commissionPct / 100));
          const netReceivableUsd = ['Toters', 'NokNok'].includes(effectiveChannel) ? (total - commissionUsd) : total;

          data = await createDirectOrder({
            branch_id: effectiveBranchId,
            restaurant_id: currentRestaurantId,
            concept_id: workspaceState.activeConcept.id,
            client_order_token: clientOrderToken,
            orderType: isDineIn ? "dine_in" : orderType,
            service_type: isDineIn ? "dine_in" : undefined,
            channel: resolveCanonicalSalesChannel(isDineIn ? "dine_in" : orderType, effectiveChannel),
            table_label: activeTableContext ? activeTableContext.tableCode : undefined,
            guest_count: activeTableContext ? (activeTableContext.guestCount || 1) : undefined,
            waiter_reference: activeTableContext ? (activeTableContext.waiterName || user?.name) : undefined,
            cashierName: activeCashier?.name || user?.name || "Cashier",
            orderSource: effectiveChannel,
            paymentMethod: actualPaymentMethod,
            status: finalOrderStatus,
            customerName: finalCustomerName,
            customerPhone,
            deliveryAddress,
            scheduled_note: advanceInstructions,
            marketplace_order_ref: ['Toters', 'NokNok'].includes(effectiveChannel) ? marketplaceOrderRef.trim() : undefined,
            marketplace_commission_pct: commissionPct,
            marketplace_commission_usd: commissionUsd,
            net_receivable_usd: netReceivableUsd,
            invoice_series: workspaceState.activeConcept.receipt_prefix || 'MAIN',
            tendered_amount: paymentDetails?.tenderedAmount !== undefined 
              ? paymentDetails.tenderedAmount 
              : ((finalOrderStatus === 'completed' || finalOrderStatus === 'paid') ? total : 0),
            payment_status: 'paid',
            is_inventory_commit: true,
            tendered_currency: paymentDetails?.tenderedCurrency || "USD",
            change_amount: paymentDetails?.changeAmount || 0,
            change_currency: paymentDetails?.changeCurrency || "USD",
            subtotal,
            deliveryFee: (!isDineIn && orderType === "delivery") ? (Number(deliveryFee) || 0) : 0,
            discountAmount,
            is_vat_subscribed: isVatSubscribed,
            vat_rate: isVatSubscribed ? vatRate : 0,
            vat_amount: vatAmount,
            total,
            items: ticketItems.map((item) => ({
              line_item_id: item.line_item_id,
              product_id: item.product_id,
              name: item.name,
              quantity: item.qty,
              unit_price: item.unit_price,
              customizations: item.selectedCustomizations || [],
              comment: item.note || "",
              item_added_by: item.item_added_by || activeCashier?.name || user?.name || "Cashier",
              item_added_by_id: item.item_added_by_id || activeCashier?.id || user?.id || null
            }))
          });
        }
      } else if (targetOrderId) {
        const updateRes = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${targetOrderId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: finalOrderStatus,
            payment_status: "paid",
            expected_version: editingOrderVersion,
            payment_operation_id: paymentOperationId,
            subtotal,
            subtotal_amount: subtotal,
            deliveryFee: (!isDineIn && orderType === "delivery") ? (Number(deliveryFee) || 0) : 0,
            delivery_fee: (!isDineIn && orderType === "delivery") ? (Number(deliveryFee) || 0) : 0,
            discountAmount,
            discount_amount: discountAmount,
            total,
            total_amount: total,
            customerName: customerName.trim() || (activeTableContext ? `Table ${activeTableContext.tableCode}` : ""),
            customerPhone,
            deliveryAddress,
            orderType: isDineIn ? "dine_in" : orderType,
            orderSource: effectiveChannel,
            paymentMethod: actualPaymentMethod,
            items: ticketItems.map((item) => ({
              line_item_id: item.line_item_id,
              product_id: item.product_id,
              quantity: item.qty,
              qty: item.qty,
              unit_price: item.unit_price,
              unit_price_usd: item.unit_price,
              price: item.unit_price,
              total_price: Number(item.unit_price || 0) * Number(item.qty || 1),
              customizations: item.selectedCustomizations || [],
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
            branch_id: COMMERCE_API_BASE ? commerceBranchLink?.external_branch_id : (currentBranchId || commerceBranchLink?.flow_branch_id),
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
            customerName: finalCustomerName,
            customerPhone,
            deliveryAddress,
            status: finalOrderStatus,
            payment_status: "paid",
            subtotal,
            subtotal_amount: subtotal,
            deliveryFee: (!isDineIn && orderType === "delivery") ? (Number(deliveryFee) || 0) : 0,
            delivery_fee: (!isDineIn && orderType === "delivery") ? (Number(deliveryFee) || 0) : 0,
            discountAmount,
            discount_amount: discountAmount,
            total,
            total_amount: total,
            items: ticketItems.map((item) => ({
              line_item_id: item.line_item_id,
              product_id: item.product_id,
              name: item.name,
              quantity: item.qty,
              qty: item.qty,
              unit_price: item.unit_price,
              unit_price_usd: item.unit_price,
              price: item.unit_price,
              total_price: Number(item.unit_price || 0) * Number(item.qty || 1),
              customizations: item.selectedCustomizations || [],
              comment: item.note || "",
              item_added_by: item.item_added_by || activeCashier?.name || user?.name || "Cashier",
              item_added_by_id: item.item_added_by_id || activeCashier?.id || user?.id || null
            }))
          })
        });
        data = await createRes.json();
      }

      if (data?.orderId && !data.success) setEditingOrderId(data.orderId);
      if (data?.inventory?.success === false) alert('Order saved. Stock needs attention: ' + data.inventory.error + '\nDo not charge the customer again. Use Retry stock update.');
      setInventoryRevision(n => n + 1);
      if (data && data.success) {
        const completedOrderId = data.orderId || data.order?.id || targetOrderId;
        const settledTableCode = activeTableContext?.tableCode || (orderType === 'dine_in' ? customerName.replace(/^Table\s*/i, '') : undefined);
        const settledTableId = activeTableContext?.tableId;
        const settledSessionId = activeTableContext?.sessionId;
        const wasTable = Boolean(activeTableContext) || isDineIn;

        if (isDineIn) {
          try {
            if (paymentDetails?.isAdvancePayment) {
              if (settledSessionId) {
                await supabase
                  .from('pos_table_sessions')
                  .update({
                    ...(completedOrderId ? { commerce_order_id: completedOrderId } : {}),
                    sync_status: 'synced'
                  })
                  .eq('id', settledSessionId);
              }
            } else {
              // 1. Direct session ID
              if (settledSessionId) {
                await closeTableSession(settledSessionId, completedOrderId ? Number(completedOrderId) : undefined).catch(() => {});
              }
              // 2. Also close any session associated with this completed order ID
              if (completedOrderId) {
                await supabase
                  .from('pos_table_sessions')
                  .update({
                    status: 'closed',
                    closed_at: new Date().toISOString()
                  })
                  .eq('commerce_order_id', completedOrderId)
                  .in('status', ['opening', 'occupied', 'bill_requested', 'closing']);
              }
              // 3. Close by tableId or tableCode
              if (settledTableId) {
                const { data: sessionLinks } = await supabase
                  .from('pos_table_session_tables')
                  .select('session_id')
                  .eq('table_id', settledTableId);
                if (sessionLinks && sessionLinks.length > 0) {
                  const sIds = sessionLinks.map((s: any) => s.session_id);
                  await supabase
                    .from('pos_table_sessions')
                    .update({
                      status: 'closed',
                      closed_at: new Date().toISOString()
                    })
                    .in('id', sIds)
                    .in('status', ['opening', 'occupied', 'bill_requested', 'closing']);
                }
              } else if (settledTableCode) {
                const { data: tbl } = await supabase
                  .from('pos_tables')
                  .select('id')
                  .eq('table_code', settledTableCode)
                  .maybeSingle();
                if (tbl?.id) {
                  const { data: sessionLinks } = await supabase
                    .from('pos_table_session_tables')
                    .select('session_id')
                    .eq('table_id', tbl.id);
                  if (sessionLinks && sessionLinks.length > 0) {
                    const sIds = sessionLinks.map((s: any) => s.session_id);
                    await supabase
                      .from('pos_table_sessions')
                      .update({
                        status: 'closed',
                        closed_at: new Date().toISOString()
                      })
                      .in('id', sIds)
                      .in('status', ['opening', 'occupied', 'bill_requested', 'closing']);
                  }
                }
              }
            }
          } catch (e) {
            console.warn("Error closing table session on payment:", e);
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
          // On customer guest bill / receipt: omit 0-value modifiers (choices, removals, free add-ons)
          const paidAddons = (Array.isArray(rawCusts) ? rawCusts : []).filter((c: any) =>
            typeof c === 'object' && c !== null && Number(c.price || c.unit_price || 0) > 0
          );

          const printCustomizationLines = paidAddons.map((a: any) => {
            const aName = a.name || a.ingredient || 'Add-on';
            const aPrice = Number(a.price || a.unit_price || 0);
            return `+ ${aName} (+$${aPrice.toFixed(2)})`;
          });

          return {
            qty: item.qty || item.quantity || 1,
            name: item.name || item.product_name || "Item",
            unit_price: item.unit_price || 0,
            selectedCustomizations: paidAddons,
            customizations: paidAddons,
            addons: paidAddons.map((a: any) => a.name || a.ingredient || ''),
            removals: [],
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
          exchange_rate: exchangeRate || 89500,
          customer_name: finalCustomerName || defaultCustomer,
          table_label: activeTableContext?.tableCode,
          table_code: activeTableContext?.tableCode,
          guest_count: activeTableContext?.guestCount,
          waiter_name: activeTableContext?.waiterName || activeCashier?.name || user?.name || "Staff",
          served_by: activeTableContext?.waiterName || activeCashier?.name || user?.name || "Staff",
          server_name: activeTableContext?.waiterName || activeCashier?.name || user?.name || "Staff",
          restaurant_name: localStorage.getItem('flow_pos_restaurant_name') || "Neo Beirut",
          company_legal_name: localStorage.getItem('flow_pos_company_legal_name') || "Neo Beirut S.A.L.",
          mof_number: localStorage.getItem('flow_pos_mof_number') || "382910-601",
          footer_message: localStorage.getItem('flow_pos_receipt_footer') || "Thank you for dining with us! Come back soon.",
          customer_phone: customerPhone,
          delivery_address: deliveryAddress,
          is_scheduled: Boolean(scheduledOrderTime),
          scheduled_for: scheduledOrderTime ? `${scheduledOrderDate} ${scheduledOrderTime}` : null,
          scheduled_time_display: scheduledOrderTime ? formatScheduledTimeDisplay(scheduledOrderDate, scheduledOrderTime) : null,
          scheduled_notes: scheduledOrderNote || null,
          subtotal_amount: subtotal,
          delivery_fee: (!isDineIn && orderType === "delivery") ? (Number(deliveryFee) || 0) : 0,
          discount_amount: discountAmount,
          discount_label: discountAmount > 0 ? discountLabel : null,
          is_vat_subscribed: isVatSubscribed,
          vat_rate: isVatSubscribed ? vatRate : 0,
          vat_amount: isVatSubscribed ? vatAmount : 0,
          total_amount: total,
          items: normalizedItems,
          created_at: new Date().toISOString()
        };

        handlePrint(completedOrderData);
        setLastCompletedOrder(completedOrderData);
        setIsTerminalPaymentModalOpen(false);
        updateTableFireCount(currentTableKey, 0);

        // Physical cash collection into active register drawer
        const isCashMethod = !actualPaymentMethod ||
          actualPaymentMethod.toLowerCase().includes('cash') ||
          (paymentDetails?.paymentMethod && paymentDetails.paymentMethod.toLowerCase().includes('cash'));

        const chLower = (effectiveChannel || '').toLowerCase();
        const isAggregator = chLower.includes('toter') || chLower.includes('nok') ||
          actualPaymentMethod.toLowerCase().includes('toter') || actualPaymentMethod.toLowerCase().includes('nok');

        if (isCashMethod && !isAggregator) {
          const shiftTargetId = activeShift?.id || 'active-shift';
          const movementOpId = `pos-cash-${completedOrderId}-${Date.now()}`;
          const isLbp = paymentDetails?.tenderedCurrency === 'LBP' || actualPaymentMethod.toLowerCase().includes('lbp');
          const finalCashAmt = Number(total || subtotal || 0);

          if (finalCashAmt > 0) {
            const movementLabel = chLower.includes('app')
              ? `App Cash Order #${completedOrderId} (${finalCustomerName || 'Customer'})`
              : `${effectiveChannel || 'POS'} Cash Sale #${completedOrderId} (${finalCustomerName || 'Walk-in'})`;

            const localMovement = {
              id: movementOpId,
              shift_id: shiftTargetId,
              operation_id: movementOpId,
              movement_type: 'cash_in',
              amount: finalCashAmt,
              currency: isLbp ? 'LBP' : 'USD',
              reason: movementLabel,
              created_by: activeCashier?.name || user?.name || "Cashier",
              created_at: new Date().toISOString()
            };

            try {
              const cacheKey = `flow_shift_movements_${shiftTargetId}`;
              const existingStr = window.localStorage.getItem(cacheKey);
              const existingList = existingStr ? JSON.parse(existingStr) : [];
              existingList.unshift(localMovement);
              window.localStorage.setItem(cacheKey, JSON.stringify(existingList));
            } catch (cErr) {}

            if (activeShift?.id) {
              try {
                supabase.from('shift_cash_movements').insert([{
                  shift_id: activeShift.id,
                  operation_id: movementOpId,
                  movement_type: 'cash_in',
                  amount: finalCashAmt,
                  currency: isLbp ? 'LBP' : 'USD',
                  reason: movementLabel,
                  created_by: activeCashier?.name || user?.name || "Cashier"
                }]).then(({ error: mErr }) => {
                  if (mErr) console.warn('Non-fatal shift movement insert error:', mErr);
                });
              } catch (insErr) {
                console.warn('Non-fatal shift movement insert error:', insErr);
              }
            }

            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent('flow:cash_movement_recorded', { detail: localMovement }));
            }
          }
        }

        // Instant event dispatch for 0ms clearance across TablesScreen, FloorPlan, and OrdersHub
        if (typeof window !== "undefined") {
          if (wasTable && !paymentDetails?.isAdvancePayment) {
            window.dispatchEvent(new CustomEvent('flow:table_settled', {
              detail: {
                tableCode: settledTableCode,
                tableId: settledTableId,
                sessionId: settledSessionId,
                orderId: completedOrderId
              }
            }));
          }
          window.dispatchEvent(new CustomEvent('flow:order_settled', {
            detail: {
              orderId: completedOrderId,
              tableCode: settledTableCode,
              tableId: settledTableId
            }
          }));
        }
        if (wasTable) {
          refreshFloorTables().catch(() => {});
        }

        setActiveTableContext(null);
        setTicketItems([]);
        setCustomerName("");
        setCustomerPhone("");
        setDeliveryAddress("");
        setSelectedChannel(null);
        setMarketplaceOrderRef("");
        setEditingOrderId(null);
        setEditingOrderVersion(null);
        setDiscountType("none");
        setDiscountValInput(10);
        setDiscountIsPercent(true);
        setDeliveryFee(0);
        setOrderType("pickup");
        setScheduledOrderTime("");
        setScheduledOrderNote("");
        setActiveTabModal(["Toters", "NokNok"].includes(effectiveChannel) ? null : "receipt");
        handleResetToMainMenu();
        if (wasTable) {
          setPosActiveView('tables');
        } else {
          setPosActiveView('sell');
        }
        fetchOrdersQueue();
        if (autoLockOnOrder) {
          handleQuickLock();
        }
      } else if (data && data.error) {
        setValidationError(`⚠️ ${data.error}`);
        if (isTerminalPaymentModalOpen) alert(`⚠️ ${data.error}`);
      }
    } catch (err: any) {
      console.error("Error completing payment:", err);
      setValidationError(`⚠️ Error completing payment: ${err.message}`);
      if (isTerminalPaymentModalOpen) alert(`⚠️ Error completing payment: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch orders for the CURRENT SHIFT only (from shift open time to now)
  const fetchOrderHistory = async () => {
    try {
      // Use shift open time as cutoff so only this shift's orders appear
      const shiftCutoff = activeShift?.created_at || null;
      if (!HAS_COMMERCE_API) {
        const directRes = await fetchDirectOrders(currentRestaurantId, undefined, undefined, shiftCutoff);
        if (directRes.success && directRes.orders) {
          setCompletedOrdersHistory(directRes.orders);
        }
        return;
      }
      const extBranchId = commerceBranchLink?.external_branch_id || '';
      const qs = `restaurant_id=${encodeURIComponent(currentRestaurantId || '')}${extBranchId ? `&branch_id=${encodeURIComponent(extBranchId)}` : ''}${shiftCutoff ? `&from=${encodeURIComponent(shiftCutoff)}` : ''}`;
      const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders?type=all&${qs}`);
      const data = await res.json();
      if (data.orders) setCompletedOrdersHistory(data.orders);
    } catch (err) {
      console.error("Error fetching order history:", err);
    }
  };

  // Fetch orders for a specific calendar DATE (admin-only "Previous Orders" lookup)
  const fetchHistoryByDate = async (dateStr: string) => {
    setIsFetchingHistoryDate(true);
    try {
      // dateStr is YYYY-MM-DD. Build start/end of that day in ISO format.
      const start = `${dateStr}T00:00:00.000Z`;
      const end = `${dateStr}T23:59:59.999Z`;
      const { data, error } = await supabase
        .from('pos_orders')
        .select('*, pos_order_items(*)')
        .eq('restaurant_id', currentRestaurantId)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false })
        .limit(300);
      if (!error && data) {
        setCompletedOrdersHistory(data);
      }
    } catch (err) {
      console.error("Error fetching orders by date:", err);
    } finally {
      setIsFetchingHistoryDate(false);
    }
  };

  const formatDriverArrivalEta = (etaMinutes: any) => {
    const isNow = etaMinutes === "Now" || etaMinutes === 0 || etaMinutes === "0";
    const cleanMins = String(etaMinutes || "").replace(/[^0-9]/g, "");
    const mins = cleanMins ? parseInt(cleanMins, 10) : 15;
    const etaText = isNow ? "Now" : `in ${mins}'`;
    return {
      isNow,
      etaText,
      mins
    };
  };

  // Send Silent WhatsApp Driver Request via Infobip Backend API (+961 3 826 136)
  const handleSendDeliveryWhatsApp = async (etaMinutes: any, mode = "silent") => {
    if (!lastCompletedOrder) return;
    const cleanPhone = "9613826136";
    const etaInfo = formatDriverArrivalEta(etaMinutes);
    const orderId = lastCompletedOrder.id;
    const orderNum = `#${orderId}`;
    const templateParam = `${orderNum} ${etaInfo.etaText}`;
    const msg = `Hello, driver needed for Order ${templateParam}\nThank you`;

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

    setDispatchStatusMsg(`Sending driver request (${etaInfo.etaText})... ⏳`);
    try {
      const res = await fetch(`${DRIVER_DISPATCH_API_BASE}/api/pos/dispatch-driver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: lastCompletedOrder.id,
          etaMinutes: etaMinutes || "15",
          messageText: msg,
          phone: cleanPhone,
          dispatch_operation_id: dispatchOperationId
        })
      });
      const data = await res.json();
      setDispatchStatusMsg(`Driver Requested (${etaInfo.etaText})! ✓`);
    } catch (err) {
      setDispatchStatusMsg(`Request Sent (${etaInfo.etaText}) ✓`);
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
        // On customer reprint: omit 0-value modifiers (choices, removals, free add-ons)
        const paidAddons = (Array.isArray(rawCusts) ? rawCusts : []).filter((c: any) =>
          typeof c === 'object' && c !== null && Number(c.price || c.unit_price || 0) > 0
        );

        const printCustomizationLines = paidAddons.map((a: any) => {
          const aName = a.name || a.ingredient || 'Add-on';
          const aPrice = Number(a.price || a.unit_price || 0);
          return `+ ${aName} (+$${aPrice.toFixed(2)})`;
        });

        return {
          qty: i.quantity || i.qty || 1,
          name: i.product_name || i.name || "Item",
          unit_price: i.unit_price || 0,
          selectedCustomizations: paidAddons,
          customizations: paidAddons,
          addons: paidAddons.map((a: any) => a.name || a.ingredient || ''),
          removals: [],
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
      <div className="h-screen bg-[#F5F6F4] text-slate-800 flex items-center justify-center font-bold text-lg">
        <div className="flex flex-col items-center gap-3">
          <span className="w-10 h-10 border-4 border-pos-primary border-t-transparent rounded-full animate-spin"></span>
          <span>Loading Neo Beirut...</span>
        </div>
      </div>
    );
  }

  if (initialLoadError && products.length === 0) {
    return (
      <div className="h-screen bg-[#F5F6F4] text-slate-800 flex items-center justify-center font-bold text-lg">
        <div className="flex flex-col items-center gap-4 max-w-md text-center p-6 bg-white border border-slate-200 rounded-2xl shadow-xl">
          <span className="text-4xl">⚠️</span>
          <h2 className="text-xl font-black text-rose-600">Connection Error</h2>
          <p className="text-sm font-normal text-slate-600">
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
              className="px-5 py-3 bg-pos-primary hover:bg-pos-primary-hover text-white font-bold rounded-xl shadow-md transition active:scale-95"
            >
              🔄 Retry Connection
            </button>
            <button
              onClick={() => {
                window.location.reload();
              }}
              className="px-5 py-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold rounded-xl shadow-xs transition active:scale-95"
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
    <div className="h-screen max-h-screen flex flex-col bg-[#F5F6F4] text-[#242B28] font-sans overflow-hidden select-none">
      <InventorySyncNotice restaurantId={currentRestaurantId} branchId={currentBranchId || commerceBranchLink?.flow_branch_id} legacyBranchId={commerceBranchLink?.external_branch_id} revision={inventoryRevision} />
      {!isShiftOpen && (
        <div className="bg-rose-950 border-b border-rose-500/50 px-4 py-2 flex items-center justify-between z-30 flex-shrink-0 animate-pulse text-white">
          <div className="flex items-center gap-2">
            <span className="text-base">🔒</span>
            <span className="text-xs font-black text-rose-200 tracking-wide uppercase">
              Shift is Closed — POS ordering, billing, and invoicing are disabled.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsOpenShiftModalOpen(true)}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-black shadow transition active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <span>🔑</span>
            <span>Open Shift</span>
          </button>
        </div>
      )}
      {/* UNIFIED TOP POS HEADER: EXACT SAME ACROSS SELL, TABLES, AND ORDERS */}
      <div className="flex items-stretch border-b border-[#E0E3DF] flex-shrink-0 bg-white">
        {/* LEFT SECTION (65% Width) */}
        <div className="w-[65%] px-4 py-2.5 bg-white border-r border-[#E0E3DF] flex items-center justify-between gap-3 flex-shrink-0 min-h-[58px]">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {posActiveView === 'sell' ? (
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => {
                    const root = posScreens.find(s => s.isRoot) || posScreens[0];
                    if (root) {
                      setScreenStack([]);
                      setCurrentScreenId(root.id);
                    }
                  }}
                  className={`hover:text-slate-900 transition ${activePosScreen?.isRoot ? 'text-amber-700 font-black text-sm' : ''}`}
                >
                  Main Menu
                </button>
                {activePosScreen && !activePosScreen.isRoot && (
                  <>
                    <span className="text-slate-400">/</span>
                    <span className="text-slate-900 font-black text-sm">{activePosScreen.name}</span>
                  </>
                )}
              </div>
            ) : posActiveView === 'tables' ? (
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => setPosActiveView('sell')}
                  className="hover:text-slate-900 transition text-slate-600"
                >
                  Main Menu
                </button>
                <span className="text-slate-400">/</span>
                <span className="text-amber-700 font-black text-sm">
                  Floor Plan & Tables
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => setPosActiveView('sell')}
                  className="hover:text-slate-900 transition text-slate-600"
                >
                  Main Menu
                </button>
                <span className="text-slate-400">/</span>
                <span className="text-amber-700 font-black text-sm">
                  Orders Hub
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {posActiveView === 'sell' ? (
              <span className="text-xs text-slate-500 font-semibold hidden sm:inline">
                {activePosScreen?.buttons?.length || 0} items ({activeGridConfig.cols}×{activeGridConfig.rows})
              </span>
            ) : posActiveView === 'tables' ? (
              <span className="text-xs text-slate-500 font-semibold hidden sm:inline">
                {branchFloorTables.filter((t: any) => t.status && t.status !== 'free' && t.status !== 'available' && t.status !== 'inactive').length} active / {branchFloorTables.length} tables
              </span>
            ) : (
              <span className="text-xs text-slate-500 font-semibold hidden sm:inline">
                {commerceBranchLink?.flow_branch_name || user?.branch || currentBranchName}
              </span>
            )}

            <button
              type="button"
              onClick={() => { window.location.hash = '#/kds'; }}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-800 hover:text-slate-950 text-xs font-bold border border-slate-300 flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
              title="Open Kitchen Display System (KDS)"
            >
              <span>🍳</span>
              <span>KDS</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => { window.location.hash = `#/pos-screens?concept=${workspaceState.activeConcept.id}`; }}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-800 hover:text-slate-950 text-xs font-bold border border-slate-300 flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                title={`Open Touch Screens Layout Builder for ${workspaceState.activeConcept.name}`}
              >
                <span>🎛️</span>
                <span>Edit Screens</span>
              </button>
            )}

            {heldShiftsCount > 0 && (
              <button
                type="button"
                onClick={() => setIsManagerHeldShiftsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs animate-pulse"
                title="Manager Audit: Shifts on hold waiting for formal reconciliation"
              >
                <span>⏸️</span>
                <span>{heldShiftsCount} Held Shift{heldShiftsCount > 1 ? 's' : ''}</span>
              </button>
            )}

            {/* Concept Workspace Switcher (Phase 2 Multi-Concept POS) */}
            <ConceptWorkspaceSwitcher
              workspaceState={workspaceState}
              cartItemCount={ticketItems.length}
              draftCartCounts={Object.fromEntries(
                Object.entries(conceptDraftCarts).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])
              )}
              canSwitchConcepts={isAdmin || Boolean(user?.can_switch_concepts) || Boolean(activeCashier?.can_switch_concepts)}
              onWorkspaceChanged={handleWorkspaceChanged}
              onClearCartRequest={() => setTicketItems([])}
            />

            {/* Quick Delivery POS Navigation Shortcuts (WhatsApp Queue, Held Orders, History) */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTabModal("incoming")}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1 border border-slate-300 cursor-pointer shadow-xs active:scale-95"
                title="Incoming WhatsApp Orders Queue"
              >
                <span>📱 WA</span>
                {pendingOrders.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#eb660c] text-white text-[10px] font-black animate-pulse">
                    {pendingOrders.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTabModal("held")}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1 border border-slate-300 cursor-pointer shadow-xs active:scale-95"
                title="Held Orders Queue"
              >
                <span>⏸️ Held</span>
                {heldOrders.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black">
                    {heldOrders.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  fetchOrderHistory();
                  setActiveTabModal("history");
                }}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1 border border-slate-300 cursor-pointer shadow-xs active:scale-95"
                title="Order History"
              >
                <span>📜 History</span>
              </button>
              <FullscreenToggleButton
                compact
                className="px-2 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold flex items-center justify-center cursor-pointer transition shadow-xs"
              />
            </div>

            {/* Cashier Badge with 1-Tap Quick Lock */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 shadow-xs">
              <span className="text-amber-500 text-sm">👤</span>
              <span className="text-slate-900 font-black max-w-[120px] truncate">{activeCashier?.name || user?.name || "Cashier"}</span>
              <button
                type="button"
                onClick={handleQuickLock}
                className="px-2 py-0.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[11px] font-black flex items-center gap-1 cursor-pointer transition active:scale-95 shadow-xs"
                title="Lock Terminal immediately so another user must enter their PIN"
              >
                <span>🔒</span>
                <span>Lock</span>
              </button>
              {!isShiftOpen ? (
                <button
                  type="button"
                  onClick={() => setIsOpenShiftModalOpen(true)}
                  className="ml-0.5 px-2 py-0.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 text-[10px] font-black cursor-pointer animate-pulse"
                  title="Shift is closed. Click to open shift."
                >
                  Closed
                </button>
              ) : (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black">
                  ● Open
                </span>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT SECTION (35% Width): PRIMARY POS MODE BUTTONS */}
        <div className="w-[35%] p-2 bg-white flex items-center flex-shrink-0 min-h-[58px] border-l border-[#E0E3DF]">
          <div className="grid grid-cols-3 gap-2 w-full">
            {isRestaurantMode && (
              <button
                type="button"
                onClick={handleNavigateToTables}
                style={{
                  backgroundColor: posActiveView === 'tables' ? primaryColor : '#F5F6F4',
                  color: posActiveView === 'tables' ? primaryText : '#242B28'
                }}
                className={`h-11 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm border border-[#E0E3DF] ${
                  posActiveView === 'tables'
                    ? 'shadow-md ring-1 ring-[#1e5c4f]/30'
                    : 'hover:bg-slate-200'
                }`}
                title="Open Floor Plan & Tables"
              >
                <span className="text-sm">🪑</span>
                <span className="truncate">Tables</span>
                {branchFloorTables.filter((t: any) => t.status && t.status !== 'free' && t.status !== 'available' && t.status !== 'inactive').length > 0 && (
                  <span className={`ml-0.5 min-w-[18px] h-[18px] px-1 rounded text-[10px] font-black flex items-center justify-center leading-none ${
                    posActiveView === 'tables' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}>
                    {branchFloorTables.filter((t: any) => t.status && t.status !== 'free' && t.status !== 'available' && t.status !== 'inactive').length}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (posActiveView === 'sell' && activeTableContext) {
                  handleCloseTableAndSell();
                } else {
                  setPosActiveView('sell');
                }
              }}
              style={{
                backgroundColor: posActiveView === 'sell' ? primaryColor : '#F5F6F4',
                color: posActiveView === 'sell' ? primaryText : '#242B28'
              }}
              className={`h-11 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm border border-[#E0E3DF] ${
                posActiveView === 'sell'
                  ? 'shadow-md ring-1 ring-[#1e5c4f]/30'
                  : 'hover:bg-slate-200'
              }`}
              title={activeTableContext ? "Close table and start new sale" : "Sell Register"}
            >
              <span className="text-sm">🏷️</span>
              <span>Sell</span>
            </button>

            <button
              type="button"
              onClick={() => setPosActiveView('orders')}
              style={{
                backgroundColor: posActiveView === 'orders' ? primaryColor : '#F5F6F4',
                color: posActiveView === 'orders' ? primaryText : '#242B28'
              }}
              className={`h-11 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm border border-[#E0E3DF] ${
                posActiveView === 'orders'
                  ? 'shadow-md ring-1 ring-[#1e5c4f]/30'
                  : 'hover:bg-slate-200'
              }`}
              title="Orders Hub"
            >
              <span className="text-sm">📋</span>
              <span>Orders</span>
              <span title="Preparing orders, including paid orders awaiting completion" aria-label={preparingOrderCount === null ? 'Preparing count unavailable' : preparingOrderCount + ' preparing orders'} className="min-w-[18px] px-1 rounded bg-pos-primary text-white text-[10px] font-black">{preparingOrderCount ?? '!'}</span>
            </button>

            {!isRestaurantMode && (
              <button
                type="button"
                onClick={() => setIsConceptCashModalOpen(true)}
                style={{
                  backgroundColor: '#F5F6F4',
                  color: '#242B28'
                }}
                className="h-11 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm border border-[#E0E3DF] hover:bg-slate-200"
                title={`Cash Shift Management (${workspaceState.activeConcept.name})`}
              >
                <span className="text-sm">💵</span>
                <span className="truncate">Cash</span>
                <span className={`ml-0.5 min-w-[18px] h-[18px] px-1 rounded text-[10px] font-black flex items-center justify-center leading-none ${
                  isShiftOpen ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}>
                  {isShiftOpen ? 'OPEN' : 'CLOSED'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
        {posActiveView === 'orders' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <OrdersHubScreen
                branchName={currentBranchName || commerceBranchLink?.flow_branch_name || user?.branch || 'Active Branch'}
                restaurantId={currentRestaurantId}
                branchId={commerceBranchLink?.external_branch_id}
                flowBranchId={commerceBranchLink?.flow_branch_id || currentBranchId}
                activeShift={activeShift}
                isShiftOpen={isShiftOpen}
                activeConceptCode={workspaceState.activeConcept?.code as any}
                onOpenShift={() => setIsOpenShiftModalOpen(true)}
                currentTerminalId={posTerminalId}
                activeCashierName={activeCashier?.name || user?.name || "Cashier"}
                onOpenOrderToTicket={(order) => {
                  const isOrderCancelled =
                    order.statusGroup === 'CANCELLED' ||
                    ['cancelled', 'canceled', 'voided'].includes(String(order.rawStatus || '').toLowerCase()) ||
                    ['cancelled', 'canceled', 'voided'].includes(String(order.rawOrder?.status || '').toLowerCase());
                  if (isOrderCancelled) {
                    alert("This order is canceled and cannot be edited or modified.");
                    return;
                  }
                  loadOrderToTicket(order.rawOrder, order.channel);
                  if (order.isTableOrder) {
                    const tableCode = order.tableLabel || (order.customerName ? order.customerName.replace(/^Table\s*/i, '') : '1');
                    setActiveTableContext({
                      orderId: String(order.id),
                      tableCode,
                      sessionId: order.rawOrder?.session_id || null,
                      guestCount: order.guestCount || 1,
                      waiterName: order.waiterName || (activeCashier?.name || user?.name || "Cashier"),
                      tableId: order.rawOrder?.table_id || null,
                      isNewlyCreated: false,
                      isExistingOccupied: true
                    });
                    setCustomerName(`Table ${tableCode}`);
                    setCustomerPhone("");
                    setDeliveryAddress("");
                    setSelectedChannel("POS");
                    setOrderType("dine_in");
                    setEditingOrderId(order.id);
                  } else {
                    setActiveTableContext(null);
                  }
                  setPosActiveView('sell');
                }}
                onPrintBill={(order) => {
                  const staffUser = activeCashier || user;
                  if (!hasPosPermission(staffUser, 'print_bill')) {
                    alert(`⚠️ Your assigned role (${staffUser?.role || 'Staff'}) does not have permission to print customer bills.`);
                    return;
                  }
                  const tableCode = order.tableLabel || (order.customerName ? order.customerName.replace(/^Table\s*/i, '') : '1');
                  handlePrintPreCheckDoc({
                    id: String(order.rawOrder?.table_id || 'table-' + order.id),
                    branch_id: currentBranchId || '',
                    floor_area_id: '',
                    table_code: tableCode,
                    display_name: `Table ${tableCode}`,
                    capacity: order.guestCount || 2,
                    position_x: 0,
                    position_y: 0,
                    width: 7,
                    height: 7,
                    shape: 'square',
                    active: true,
                    sort_order: 0,
                    commerce_order_id: Number(order.id),
                    current_session_id: order.rawOrder?.session_id || null,
                    assigned_waiter: order.waiterName || (activeCashier?.name || user?.name || "Cashier"),
                    guest_count: order.guestCount || 1,
                    status: 'bill_requested'
                  });
                }}
                getFireState={order => {
                  const tableCode = order.tableLabel || order.customerName?.replace(/^Table\s*/i, '') || '';
                  const key = tableFireKey(/^\d+$/.test(String(order.id)) ? order.id : null, tableCode);
                  const holds = countHeldCourses(order.rawOrder?.items || order.rawOrder?.pos_order_items || order.items || []);
                  const fired = tableFireCounts[key] || 0;
                  return { holds, fired, busy: firingTableKey === key, canFire: holds > fired && !firingTableKey && /^\d+$/.test(String(order.id)) };
                }}
                onFireOrder={order => handleKitchenFireChit({
                  orderId: Number(order.id), tableCode: order.tableLabel || order.customerName?.replace(/^Table\s*/i, '') || '',
                  items: order.rawOrder?.items || order.rawOrder?.pos_order_items || order.items || [], waiterName: order.waiterName
                })}
                onReprint={(order) => {
                  handleReprintOrder(order.rawOrder);
                }}
                onRequestVoid={(order) => {
                  handleDirectVoidOrder(order);
                }}
                onSettleOrder={(order) => {
                  const isOrderCancelled =
                    order.statusGroup === 'CANCELLED' ||
                    ['cancelled', 'canceled', 'voided'].includes(String(order.rawStatus || '').toLowerCase()) ||
                    ['cancelled', 'canceled', 'voided'].includes(String(order.rawOrder?.status || '').toLowerCase());
                  if (isOrderCancelled) {
                    alert("This order is canceled and cannot be settled.");
                    return;
                  }
                  if (!isShiftOpen) {
                    setIsOpenShiftModalOpen(true);
                    return;
                  }

                  const staffUser = activeCashier || user;
                  const canCollect = !isRestaurantMode || hasPosPermission(staffUser, 'settle_table') || hasPosPermission(staffUser, 'collect_payment');

                  const proceedSettleOrder = () => {
                    // Load the order into the ticket (same as opening in ticket)
                    loadOrderToTicket(order.rawOrder, order.channel);
                    if (order.isTableOrder) {
                      const tableCode = order.tableLabel || (order.customerName ? order.customerName.replace(/^Table\s*/i, '') : '1');
                      setActiveTableContext({
                        orderId: String(order.id),
                        tableCode,
                        sessionId: order.rawOrder?.session_id || null,
                        guestCount: order.guestCount || 1,
                        waiterName: order.waiterName || (activeCashier?.name || user?.name || "Cashier"),
                        tableId: order.rawOrder?.table_id || null,
                        isNewlyCreated: false,
                        isExistingOccupied: true
                      });
                      setCustomerName(`Table ${tableCode}`);
                      setOrderType("dine_in");
                      setEditingOrderId(order.id);
                    } else {
                      setActiveTableContext(null);
                    }
                    // Switch to Sell view and open the payment modal
                    setPosActiveView('sell');
                    // Small delay to ensure state is set before modal opens
                    setTimeout(() => setIsTerminalPaymentModalOpen(true), 50);
                  };

                  if (canCollect) {
                    proceedSettleOrder();
                  } else {
                    setSupervisorAuthRequest({
                      actionKey: 'collect_payment',
                      actionTitle: `Collect Payment for Order #${order.id}`,
                      orderId: order.id,
                      tableNumber: order.tableLabel || null,
                      requireReason: false,
                      onAuthorized: async () => {
                        proceedSettleOrder();
                      }
                    });
                  }
                }}
              />
            </div>
          </div>
        ) : posActiveView === 'tables' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <TablesScreen
                canOpenNewTables={isShiftOpen && !isOverdueShift && hasPosPermission(activeCashier || user, 'open_table')}
                isShiftOpen={isShiftOpen}
                onOpenShift={() => setIsOpenShiftModalOpen(true)}
                branchId={currentBranchId || commerceBranchLink?.flow_branch_id || branchCapabilities?.branchId || ''}
                branchName={currentBranchName}
                restaurantId={currentRestaurantId}
                externalBranchId={String(commerceBranchLink?.external_branch_id || "1")}
                cashierName={activeCashier?.name || user?.name || "Cashier"}
                initialTableCode={activeTableContext?.tableCode || null}
                initialTables={branchFloorTables}
                isTableAdmin={isTableAdmin}
                getFireState={order => {
                  const tableCode = order.tableLabel || order.customerName?.replace(/^Table\s*/i, '') || '';
                  const key = tableFireKey(/^\d+$/.test(String(order.id)) ? order.id : null, tableCode);
                  const holds = countHeldCourses(order.rawOrder?.items || order.rawOrder?.pos_order_items || order.items || []);
                  const fired = tableFireCounts[key] || 0;
                  return { holds, fired, busy: firingTableKey === key, canFire: holds > fired && !firingTableKey && /^\d+$/.test(String(order.id)) };
                }}
                onFireOrder={order => handleKitchenFireChit({
                  orderId: Number(order.id), tableCode: order.tableLabel || order.customerName?.replace(/^Table\s*/i, '') || '',
                  items: order.rawOrder?.items || order.rawOrder?.pos_order_items || order.items || [], waiterName: order.waiterName
                })}
                onOpenOrderInCart={async (orderId, tableCode, sessionId, guestCount, waiterName, tableId, isNewlyCreated) => {
                  const request = ++tableEditorRequest.current;
                  setTicketItems([]);
                  // Switch view to sell INSTANTLY for immediate tactile response
                  setActiveTableContext({
                    orderId: orderId || null,
                    tableCode,
                    sessionId: sessionId || null,
                    guestCount: guestCount || 1,
                    waiterName: waiterName || "Cashier",
                    tableId: tableId || null,
                    isNewlyCreated: Boolean(isNewlyCreated),
                    isExistingOccupied: Boolean(orderId)
                  });
                  setCustomerName(`Table ${tableCode}`);
                  setCustomerPhone("");
                  setDeliveryAddress("");
                  setSelectedChannel("POS");
                  setOrderType("dine_in");
                  setEditingOrderId(orderId || null);
                  setEditingOrderVersion(null);
                  setPosActiveView('sell');

                  if (orderId) {
                    try {
                      let ord: any;
                      if (!HAS_COMMERCE_API) {
                        const { data } = await supabase.from('pos_orders').select('*, items:pos_order_items(*)').eq('id', orderId).maybeSingle();
                        ord = data;
                      } else {
                        const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders?type=all`);
                        const data = await res.json();
                        ord = (data.orders || []).find((o: any) => o.id === orderId);
                      }
                      if (ord && request === tableEditorRequest.current) {
                        loadOrderToTicket(ord, "POS");
                      }
                    } catch (e) {
                      console.error("Failed to load table order into ticket:", e);
                    }
                  } else if (activeTableContext?.tableCode !== tableCode) {
                    // Fresh different table: initialize empty ticket
                    setTicketItems([]);
                  }
                }}
                activeShift={activeShift}
                onPrintPreCheckDoc={handlePrintPreCheckDoc}
                onSettleTable={(hasPosPermission(activeCashier || user, 'settle_table') || hasPosPermission(activeCashier || user, 'collect_payment')) ? async (table, order) => {
                  if (!isShiftOpen) {
                    setIsOpenShiftModalOpen(true);
                    return;
                  }

                  const staffUser = activeCashier || user;
                  const canCollect = hasPosPermission(staffUser, 'collect_payment') || hasPosPermission(staffUser, 'settle_table');

                  const proceedSettleTable = async () => {
                    const targetOrderId = order?.id ? Number(order.id) : (table.commerce_order_id ? Number(table.commerce_order_id) : null);
                    const tableCode = table.table_code || (order?.tableLabel) || "1";
                    setActiveTableContext({
                      orderId: targetOrderId ? String(targetOrderId) : null,
                      tableCode,
                      sessionId: table.current_session_id || order?.rawOrder?.session_id || null,
                      guestCount: table.guest_count || order?.guestCount || 1,
                      waiterName: table.assigned_waiter || order?.waiterName || "Cashier",
                      tableId: table.id,
                      isNewlyCreated: false,
                      isExistingOccupied: true
                    });
                    setCustomerName(`Table ${tableCode}`);
                    setOrderType("dine_in");
                    setEditingOrderId(targetOrderId);
                    if (targetOrderId) {
                      try {
                        let ord: any;
                        if (!HAS_COMMERCE_API) {
                          const { data } = await supabase.from('pos_orders').select('*, items:pos_order_items(*)').eq('id', targetOrderId).maybeSingle();
                          ord = data;
                        } else {
                          const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders?type=all`);
                          const data = await res.json();
                          ord = (data.orders || []).find((o: any) => o.id === targetOrderId);
                        }
                        if (ord) {
                          loadOrderToTicket(ord, "POS");
                        }
                      } catch (e) {
                        console.error("Failed to load order for settling:", e);
                      }
                    }
                    setPosActiveView('sell');
                    setIsTerminalPaymentModalOpen(true);
                  };

                  if (canCollect) {
                    await proceedSettleTable();
                  } else {
                    setSupervisorAuthRequest({
                      actionKey: 'collect_payment',
                      actionTitle: `Settle Table ${table.table_code}`,
                      tableNumber: table.table_code,
                      orderId: order?.id || table.commerce_order_id || null,
                      requireReason: false,
                      onAuthorized: async () => {
                        await proceedSettleTable();
                      }
                    });
                  }
                } : undefined}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
            {/* SHIFT CLOSED OVERLAY — blocks all sell actions when no active shift */}
            {!isShiftOpen && (
              <div className="absolute inset-0 z-30 bg-[#0C0F17]/90 backdrop-blur-sm flex flex-col items-center justify-center gap-5 select-none">
                <div className="text-6xl">🔒</div>
                <div className="text-center space-y-1">
                  <p className="text-xl font-black text-white">Shift is Closed</p>
                  <p className="text-sm text-gray-400">Open a shift to start selling</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpenShiftModalOpen(true)}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-950/60 transition active:scale-95 cursor-pointer"
                >
                  ▶ Open Shift
                </button>
              </div>
            )}
            {/* MAIN WORKSPACE: MATRIX ON LEFT & CART ON RIGHT */}
            <div className="flex-1 flex overflow-hidden min-h-0 bg-[#F5F6F4]">
              {/* LEFT AREA (65% Width): Categories Bar + Product Grid */}
              <div className="w-[65%] flex flex-col h-full overflow-hidden border-r border-[#E0E3DF] bg-[#F5F6F4]">
              {/* FLOW UPSELL RECOMMENDATIONS */}
              <UpsellRecommendationBar
                upsells={activeUpsells}
                onSelectProduct={handleQuickAddProduct}
                isProduct86d={isProduct86d}
              />

              {/* POS SCREEN MATRIX NAVIGATION & TILES */}
              <div className="flex-1 flex flex-col overflow-hidden bg-[#F5F6F4]">


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
                        const isDisabled = !isShiftOpen && !isSubscreen;

                        return (
                          <button
                            key={btn.id || idx}
                            type="button"
                            onClick={() => handleTouchButtonPress(btn)}
                            disabled={isDisabled}
                            className={`${activeGridDensity.minHeight} ${activeGridDensity.padding} rounded-2xl border flex flex-col items-center justify-center text-center shadow-xs transition-all active:scale-95 cursor-pointer relative overflow-hidden group select-none ${
                              isDisabled
                                ? 'bg-slate-100 border-slate-200 opacity-40 cursor-not-allowed text-slate-400'
                                : `${colorTheme.bg} ${colorTheme.border} ${colorTheme.hover} ${colorTheme.text || 'text-slate-800'} hover:shadow-md hover:scale-[1.01]`
                            }`}
                          >
                            {/* PURE BUTTON NAME ONLY */}
                            <span className={`font-black ${activeGridDensity.fontSize} leading-tight tracking-wide line-clamp-3 ${colorTheme.text || 'text-slate-800'}`}>
                              {btn.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 6 ACTION BUTTONS DOCK (EMBEDDED IN LEFT 65% PANEL) */}
                <div className="h-14 sm:h-16 bg-white border-t-2 border-[#E0E3DF] px-2.5 py-2 flex items-center gap-1.5 sm:gap-2 flex-shrink-0 z-20 shadow-md">
                  {/* 0 - Quick 1-Tap Lock (Far Left) */}
                  <button
                    type="button"
                    onClick={handleQuickLock}
                    className="h-full px-2.5 sm:px-3 rounded-xl bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 font-black text-xs sm:text-sm font-black tracking-wider flex items-center justify-center gap-1.5 border border-amber-300 shadow-sm transition cursor-pointer flex-shrink-0"
                    title="Lock Terminal immediately so another user must enter their PIN"
                  >
                    <span className="text-sm sm:text-base">🔒</span>
                    <span className="hidden sm:inline">Lock</span>
                  </button>

                  {/* 1 - Features */}
                  <button
                    type="button"
                    onClick={() => setIsFeaturesModalOpen(true)}
                    className="flex-1 min-w-0 h-full rounded-xl bg-[#F5F6F4] hover:bg-slate-200 active:scale-98 text-[#242B28] font-black text-xs sm:text-sm font-black tracking-wider flex items-center justify-center gap-1 sm:gap-1.5 border border-[#E0E3DF] shadow-sm transition cursor-pointer px-1"
                    title="Open POS Features: History, Store Control, Shift, Tables, Orders"
                  >
                    <span className="text-sm sm:text-base">⚙️</span>
                    <span className="truncate">Features</span>
                  </button>

                  {/* 2 - Hold (Deactivated in Sell screen; use Settle & Close to hold/schedule) */}
                  <button
                    type="button"
                    onClick={handleInsertHold}
                    disabled={ticketItems.length === 0 || isSubmitting || !isShiftOpen}
                    className={`flex-1 min-w-0 h-full rounded-xl font-black text-xs sm:text-sm font-black tracking-wider flex items-center justify-center gap-1 sm:gap-1.5 border shadow-sm transition px-1 ${
                      ticketItems.length === 0 || isSubmitting || !isShiftOpen
                        ? 'bg-[#F5F6F4] text-slate-400 border-[#E0E3DF] opacity-40 cursor-not-allowed'
                        : 'bg-purple-50 hover:bg-purple-100 active:scale-98 text-purple-900 border-purple-300 cursor-pointer'
                    }`}
                    title={
                      !isShiftOpen
                        ? "Shift is closed - open shift first"
                        : activeTableContext
                        ? "Insert HOLD separator: tells kitchen to pause before next items"
                        : "Choose when to prepare this order without taking payment"
                    }
                  >
                    <span className="text-sm sm:text-base">⏳</span>
                    <span className="truncate">{activeTableContext ? "Hold" : "Schedule"}</span>
                  </button>

                  {/* 3 - Fire (Only shown in Restaurant Table Service Mode) */}
                  {isRestaurantMode && (
                    <button
                      type="button"
                      onClick={() => handleKitchenFireChit()}
                      disabled={!isFireActive || !isShiftOpen}
                      className={`flex-[1.05] min-w-0 h-full rounded-xl active:scale-98 font-black text-xs sm:text-sm font-black tracking-wider flex items-center justify-center gap-1 sm:gap-1.5 border shadow-sm transition px-1 ${
                        isFireActive && isShiftOpen
                          ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white border-red-400 shadow-red-900/50 animate-pulse cursor-pointer'
                          : 'bg-[#F5F6F4] text-slate-400 border-[#E0E3DF] opacity-40 cursor-not-allowed'
                      }`}
                      title={
                        !isShiftOpen
                          ? "Shift is closed - open shift first"
                          : currentTableHolds === 0
                          ? "No held courses in this ticket. Insert 'Hold' between items to pace courses."
                          : isFireActive
                          ? `Fire next held course (${remainingFires} remaining)`
                          : `All held courses have been fired (${currentTableFires}/${currentTableHolds})`
                      }
                    >
                      <span className="text-sm sm:text-lg">🔥</span>
                      <span className="truncate">Fire {isFireActive && isShiftOpen ? `(${remainingFires})` : ''}</span>
                    </button>
                  )}

                  {/* 4 - Settle & close / Instant Aggregator Complete */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!isShiftOpen) {
                        setIsOpenShiftModalOpen(true);
                        return;
                      }
                      if (isOverdueShift && !editingOrderId && !activeTableContext?.orderId) {
                        setIsOverdueModalOpen(true);
                        return;
                      }
                      if (["toters", "noknok"].includes((selectedChannel || "").toLowerCase())) {
                        if (!customerName || !customerName.trim() || customerName === 'Pickup Customer') {
                          setValidationError(`⚠️ Customer name is required for ${selectedChannel} orders`);
                          return;
                        }
                        handleFinalizePayment();
                        return;
                      }

                      const staffUser = activeCashier || user;
                      if (isRestaurantMode && !hasPosPermission(staffUser, 'collect_payment')) {
                        setSupervisorAuthRequest({
                          actionKey: 'collect_payment',
                          actionTitle: `Collect Payment (${activeTableContext ? `Table ${activeTableContext.tableCode}` : 'Order'})`,
                          tableNumber: activeTableContext?.tableCode || null,
                          orderId: editingOrderId || activeTableContext?.orderId || null,
                          requireReason: false,
                          onAuthorized: async () => {
                            setIsTerminalPaymentModalOpen(true);
                          }
                        });
                        return;
                      }

                      setIsTerminalPaymentModalOpen(true);
                    }}
                    disabled={ticketItems.length === 0 || !isShiftOpen}
                    style={{ backgroundColor: primaryColor, color: primaryText }}
                    className="flex-[1.15] min-w-0 h-full rounded-xl hover:opacity-95 active:scale-98 font-black text-xs sm:text-sm font-black tracking-wider flex items-center justify-center gap-1 sm:gap-1.5 border border-black/10 shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer px-1.5"
                    title={!isShiftOpen ? "Shift is closed - settlement disabled" : ticketItems.length === 0 ? "Cart is empty - add items to settle" : "Collect payment and settle order / table"}
                  >
                    <span className="text-sm sm:text-base">💳</span>
                    <span className="truncate">
                      {["toters", "noknok"].includes((selectedChannel || "").toLowerCase())
                        ? `Complete ${selectedChannel}`
                        : "Settle & close"}
                    </span>
                  </button>

                  {/* 5 - Place order (far right) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!isShiftOpen) {
                        setIsOpenShiftModalOpen(true);
                        return;
                      }
                      if (!validateOrder()) {
                        alert("⚠️ Customer name is required for delivery orders.");
                        return;
                      }
                      handleHoldOrder();
                    }}
                    disabled={ticketItems.length === 0 || isSubmitting || !isShiftOpen}
                    style={{
                      backgroundColor: (ticketItems.length > 0 && !isSubmitting && isShiftOpen) ? '#E9F4ED' : '#F5F6F4',
                      color: (ticketItems.length > 0 && !isSubmitting && isShiftOpen) ? primaryColor : '#5E6964',
                      borderColor: (ticketItems.length > 0 && !isSubmitting && isShiftOpen) ? `${primaryColor}40` : '#E0E3DF'
                    }}
                    className={`flex-[1.25] min-w-0 h-full rounded-xl font-black text-xs sm:text-sm font-black tracking-wider flex items-center justify-center gap-1 sm:gap-1.5 border shadow-sm transition px-1 hover:opacity-90 cursor-pointer ${
                      ticketItems.length === 0 || isSubmitting || !isShiftOpen
                        ? 'opacity-40 cursor-not-allowed'
                        : 'active:scale-98'
                    }`}
                    title={
                      !isShiftOpen
                        ? "Shift is closed - placing orders disabled"
                        : ticketItems.length === 0
                        ? "Add items to cart to place order"
                        : activeTableContext
                        ? "Place and submit order to kitchen / table"
                        : "Place and send order to kitchen"
                    }
                  >
                    <span className="text-sm sm:text-base">🍽️</span>
                    <span className="truncate">{isSubmitting ? 'Placing...' : 'Place order'}</span>
                  </button>
                </div>
              </div>
            </div>

        {/* RIGHT PANEL: TICKET CART & CHECKOUT (35% Width) */}
        <div className="w-[35%] flex flex-col h-full bg-white border-l border-[#E0E3DF] overflow-hidden flex-shrink-0 shadow-lg">
          {/* TICKET HEADER & UNIFIED SMART CHANNEL BAR */}
          <div className="p-3 border-b border-[#E0E3DF] space-y-2 bg-white flex-shrink-0">

            {(editingOrderId || activeTableContext) && (
              <div className="flex justify-end px-3 py-1.5">
                <button type="button" onClick={handleCancelEdit} disabled={isSubmitting}
                  className="text-xs font-bold text-[#242B28] hover:bg-slate-200 bg-[#F5F6F4] px-3 py-2 rounded border border-[#E0E3DF] disabled:opacity-50 cursor-pointer">
                  Cancel Edit
                </button>
              </div>
            )}

            {/* TICKET ACTIONS & STATUS HEADER BAR */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-[#242B28] tracking-wider">
                  Current Order
                </span>
                {ticketItems.filter(i => !i.isHoldSeparator && i.name !== 'HOLD').length > 0 && (
                  <span
                    style={{ backgroundColor: '#E9F4ED', color: primaryColor, borderColor: `${primaryColor}40` }}
                    className="px-2 py-0.5 text-[10px] font-black rounded-full border"
                  >
                    {ticketItems.filter(i => !i.isHoldSeparator && i.name !== 'HOLD').reduce((sum, item) => sum + (Number(item.qty) || 1), 0)} items
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {/* Table # and Seats info — shown when a table context is active */}
                {activeTableContext && (
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: primaryColor }} className="font-black text-xs flex items-center gap-1">
                      🪑 <span>{activeTableContext.tableCode ? (
                        activeTableContext.tableCode.toLowerCase().startsWith('table')
                          ? activeTableContext.tableCode
                          : `Table ${activeTableContext.tableCode.replace(/^[Tt]/, '')}`
                      ) : 'Table'}</span>
                    </span>
                    {activeTableContext.guestCount ? (
                      <span className="px-1.5 py-0.5 rounded bg-[#F5F6F4] text-[#242B28] text-[10px] font-bold border border-[#E0E3DF]">
                        {activeTableContext.guestCount} {activeTableContext.guestCount === 1 ? 'Seat' : 'Seats'}
                      </span>
                    ) : null}
                    {isCurrentTableBillRequested && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-300 animate-pulse">
                        🧾 Bill Printed
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsTransferModalOpen(true)}
                      className="px-2 py-0.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-900 text-[10px] font-bold border border-sky-300 flex items-center gap-1 transition active:scale-95 cursor-pointer ml-1"
                      title="Transfer Table or Move Selected Items"
                    >
                      <span>🔄</span>
                      <span>Transfer</span>
                    </button>
                  </div>
                )}
                {!activeTableContext && (ticketItems.length > 0 || customerName || customerPhone || deliveryAddress || editingOrderId) && (
                  <button
                    type="button"
                    onClick={handleResetCart}
                    disabled={isSubmitting || !isShiftOpen}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all active:scale-95 flex items-center gap-1 shadow-sm ${
                      isSubmitting || !isShiftOpen
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 opacity-50 cursor-not-allowed'
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 cursor-pointer'
                    }`}
                    title={!isShiftOpen ? "Shift is closed" : "Reset cart & clear ticket"}
                  >
                    🗑️ Reset Cart
                  </button>
                )}
              </div>
            </div>

            {/* UNIFIED SMART CHANNEL BAR & CUSTOMER FIELDS (Hidden when at a Dine-In Table) */}
            {!activeTableContext && (
              isRestaurantMode ? (
                <div className="space-y-2 pt-1 border-t border-slate-200/60">
                  <button type="button" onClick={() => setIsOrderSetupOpen(true)}
                    className="w-full min-h-[56px] px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left flex items-center justify-between gap-3 shadow-xs transition cursor-pointer">
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-slate-900">{!selectedChannel || ['POS', 'Pick-up', 'Phone', 'Delivery'].includes(selectedChannel) ? 'Store' : selectedChannel} · {orderType === 'delivery' ? 'Delivery' : 'Pickup'}</span>
                      <span className="block text-xs text-slate-500 font-medium truncate">{customerName || customerPhone || (orderType === 'delivery' ? 'Add customer & delivery address' : 'Customer optional')}{customerName && customerPhone ? ' • ' + customerPhone : ''}</span>
                    </span>
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg shrink-0">Change ›</span>
                  </button>
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
              ) : (
                /* FAST DELIVERY & PICKUP MODE: 5-CHANNEL QUICK BAR (OVRLOAD / WICKD) */
                <div className="space-y-2 pt-1 border-t border-slate-200/60">
                  <div className="grid grid-cols-5 gap-1 p-1 bg-slate-900 rounded-xl border border-slate-700">
                    {[
                      { id: 'Toters', label: 'Toters 🟢', activeBg: 'bg-emerald-600 text-white' },
                      { id: 'WhatsApp', label: 'WA 📱', activeBg: 'bg-green-600 text-white' },
                      { id: 'POS', label: 'POS', activeBg: 'bg-amber-600 text-white' },
                      { id: 'NokNok', label: 'NokNok 🔴', activeBg: 'bg-rose-600 text-white' },
                      { id: 'App', label: 'App 📲', activeBg: 'bg-blue-600 text-white' },
                    ].map((ch) => {
                      const isSelected = selectedChannel === ch.id || (!selectedChannel && ch.id === 'POS');
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => handleSelectChannelSource(ch.id)}
                          className={`py-1.5 px-0.5 rounded-lg text-[11px] font-black transition cursor-pointer text-center truncate ${
                            isSelected ? `${ch.activeBg} shadow-sm ring-1 ring-white/20` : 'text-slate-300 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          {ch.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Delivery / Pickup Customer Inputs */}
                  <div className="pt-1 border-t border-slate-700/60 space-y-1.5 relative">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Customer Name *"
                        value={customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value);
                          if (validationError) setValidationError("");
                        }}
                        className={`w-full bg-slate-900 border ${
                          validationError && (!customerName || !customerName.trim() || customerName === 'Pickup Customer')
                            ? "border-rose-500 ring-2 ring-rose-500/50 bg-rose-950/20"
                            : "border-slate-700"
                        } rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-400 font-medium focus:outline-none focus:border-amber-500`}
                      />
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Phone Number (optional)"
                          value={customerPhone}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomerPhone(val);
                            handleCustomerSearch(val);
                            if (val.replace(/\D/g, "").length >= 6) {
                              checkWhatsAppLocation(val);
                            }
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-400 font-medium focus:outline-none focus:border-amber-500"
                        />
                        {showCustomerDropdown && customerSearchResults.length > 0 && (
                          <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                            {customerSearchResults.map((cust: any) => (
                              <div
                                key={cust.id}
                                onClick={() => {
                                  if (cust.customer_name) setCustomerName(cust.customer_name);
                                  if (cust.customer_phone) setCustomerPhone(cust.customer_phone);
                                  if (cust.delivery_address) setDeliveryAddress(cust.delivery_address);
                                  if (cust.whatsapp_location) {
                                    setDetectedWaLocation(cust.whatsapp_location);
                                    if (cust.whatsapp_location.deliveryFee !== undefined && cust.whatsapp_location.deliveryFee !== null) {
                                      setDeliveryFee(Number(cust.whatsapp_location.deliveryFee));
                                    }
                                  } else if (cust.customer_phone) {
                                    checkWhatsAppLocation(cust.customer_phone);
                                  }
                                  setShowCustomerDropdown(false);
                                }}
                                className="p-2 hover:bg-slate-700 cursor-pointer text-xs border-b border-slate-700 last:border-0"
                              >
                                <div className="font-bold text-white">{cust.customer_name || "Customer"}</div>
                                <div className="text-[11px] text-gray-400">{cust.customer_phone}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* WhatsApp Location Detected Alert & Auto-Fill */}
                    {detectedWaLocation && (
                      <div className="bg-emerald-950/90 border border-emerald-500/70 rounded-xl p-2 flex items-center justify-between text-xs shadow-lg animate-fade-in">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="font-black text-emerald-300 flex items-center gap-1.5 text-[11px]">
                            <span>📍</span>
                            <span>WhatsApp Location Received</span>
                            {detectedWaLocation.receivedMinutesAgo !== undefined && (
                              <span className="text-[9px] bg-emerald-800 text-emerald-100 px-1.5 py-0.5 rounded-full font-bold">
                                {detectedWaLocation.receivedMinutesAgo <= 1 ? "Just now" : `${detectedWaLocation.receivedMinutesAgo}m ago`}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-300 truncate mt-0.5">
                            {detectedWaLocation.address} {detectedWaLocation.distanceKm ? `• ${detectedWaLocation.distanceKm} km` : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setOrderType("delivery");
                            const addr = detectedWaLocation.address && detectedWaLocation.mapUrl
                              ? `${detectedWaLocation.address} [Maps Pin: ${detectedWaLocation.mapUrl}]`
                              : (detectedWaLocation.mapUrl || detectedWaLocation.address || "");
                            setDeliveryAddress(addr);
                            if (detectedWaLocation.deliveryFee !== undefined && detectedWaLocation.deliveryFee !== null) {
                              setDeliveryFee(Number(detectedWaLocation.deliveryFee));
                            }
                          }}
                          className="bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-black px-2.5 py-1.5 rounded-lg shadow-md shrink-0 flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                        >
                          <span>⚡ Auto-Fill</span>
                          {detectedWaLocation.deliveryFee !== undefined && detectedWaLocation.deliveryFee !== null && (
                            <span>(${Number(detectedWaLocation.deliveryFee).toFixed(2)})</span>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Delivery Address Input when delivery mode and not Toters/NokNok */}
                    {orderType === "delivery" && !['Toters', 'NokNok'].includes(selectedChannel || '') && (
                      <input
                        type="text"
                        placeholder="Delivery Address (Street, Building, Floor...)"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-400 font-medium focus:outline-none focus:border-amber-500"
                      />
                    )}
                  </div>
                </div>
              )
            )}
          </div>

          {/* TICKET ITEMS LIST */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {ticketItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-gray-400 border-2 border-dashed border-slate-200 rounded-2xl my-2">
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
                      className="my-2 py-2 px-3 rounded-xl bg-purple-50 border border-dashed border-purple-300 flex items-center justify-between text-purple-900 shadow-sm"
                    >
                      <div className="flex items-center gap-2 text-xs font-black tracking-widest uppercase">
                        <span className="text-sm">⏸️</span>
                        <span className="text-purple-900">HOLD</span>
                        <span className="text-[10px] text-purple-700 font-medium normal-case tracking-normal">
                          (kitchen waits for fire)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTicketItem(index)}
                        className="text-purple-700 hover:text-rose-600 text-xs font-bold px-2 py-0.5 rounded-lg bg-white border border-purple-200 hover:bg-rose-50 transition cursor-pointer"
                        title="Remove Hold Line"
                      >
                        ✕
                      </button>
                    </div>
                  );
                }

                const isSelected = editingItemIndex === index;
                return (
                <div
                  key={index}
                  className={`rounded-xl p-2.5 space-y-1.5 transition ${
                    isSelected
                      ? "bg-[#E9F4ED] border border-[#1e5c4f]/40 shadow-sm"
                      : "bg-[#F5F6F4] border border-[#E0E3DF] hover:border-slate-300 shadow-sm"
                  }`}
                  style={isSelected ? { borderColor: `${primaryColor}60` } : undefined}
                >
                  {/* ROW 1: name + price on same line, qty controls, trash */}
                  <div className="flex items-center justify-between gap-1">
                    {/* Name (clickable to edit options) */}
                    <button
                      type="button"
                      onClick={() => handleOpenCustomization(products.find((p) => p.id === item.product_id) || { id: item.product_id, name: item.name, unit_price_usd: item.base_price }, index)}
                      className="flex-1 min-w-0 text-left"
                      title="Tap to edit options"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h5 className="font-extrabold text-xs text-[#242B28] leading-tight hover:opacity-80 transition-colors">{item.name}</h5>
                        {Boolean(item.isOrdered && (editingOrderId || activeTableContext?.orderId)) && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300">
                            Ordered
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-black mt-0.5" style={{ color: primaryColor }}>
                        ${(item.unit_price * item.qty).toFixed(2)}
                      </div>
                    </button>

                    {/* Qty controls */}
                    <div className="flex items-center gap-0.5 bg-white border border-[#E0E3DF] rounded p-0.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(index, -1)}
                        disabled={!isShiftOpen}
                        className="w-6 h-6 rounded-sm bg-[#F5F6F4] hover:bg-slate-200 font-extrabold text-[#242B28] text-xs flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-extrabold text-xs text-[#242B28]">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(index, 1)}
                        disabled={!isShiftOpen}
                        className="w-6 h-6 rounded-sm bg-[#F5F6F4] hover:bg-slate-200 font-extrabold text-[#242B28] text-xs flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>

                    {/* Trash */}
                    <button
                      type="button"
                      onClick={() => handlePromptVoid(index)}
                      disabled={!isShiftOpen}
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded text-sm transition-all active:scale-90 flex items-center justify-center cursor-pointer flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={!isShiftOpen ? "Shift is closed" : Boolean(item.isOrdered && (editingOrderId || activeTableContext?.orderId)) ? "Authorize Item Void (Requires Manager PIN)" : "Remove Item from Ticket"}
                    >
                      🗑️
                    </button>
                  </div>

                  {/* Customizations: addons green, removals red (no REMOVE: label) */}
                  {item.selectedCustomizations && item.selectedCustomizations.length > 0 && (() => {
                    const { addons, removals } = partitionCustomizations(item.selectedCustomizations);
                    return (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {addons.map((a, i) => (
                          <span key={`a-${i}`} className="text-[10px] bg-white text-[#242B28] px-2 py-0.5 rounded border border-[#E0E3DF] font-medium">
                            + {a}
                          </span>
                        ))}
                        {removals.map((r, i) => (
                          <span key={`r-${i}`} className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200 font-extrabold">
                            - {r}
                          </span>
                        ))}
                      </div>
                    );
                  })()}

                  {item.note && <p className="text-[10px] text-amber-700 italic">Note: {item.note}</p>}
                </div>
              );
            })
            )}
          </div>

          {/* CHECKOUT SUMMARY & PAY & PRINT AREA */}
          <div className="p-3.5 border-t border-[#E0E3DF] bg-white text-[#242B28] space-y-2.5 flex-shrink-0">
            {/* Validation Alert */}
            {validationError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-1.5 rounded-lg flex items-center justify-between">
                <span>{validationError}</span>
                <button onClick={() => setValidationError("")} className="font-bold px-1">✕</button>
              </div>
            )}

            {/* Discount & Delivery Fee Quick Inputs */}
            <div className="space-y-1.5 text-xs">
            {/* 2-COLUMN CONTROLS & CALCULATIONS GRID */}
            <div className="grid grid-cols-2 gap-2.5 pt-1.5 border-t border-[#E0E3DF]">
              {/* LEFT SIDE: Discount & Delivery Fee Controls */}
              <div className="space-y-2 text-xs pr-2 border-r border-[#E0E3DF] flex flex-col justify-between">
                {/* Discount Control (Matching OVRLOAD Reference POS) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#5E6964] text-[11px] block">Discount:</span>
                    {discountAmount > 0 && (
                      <span className="text-[11px] font-extrabold text-amber-600">
                        -${discountAmount.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {discountAmount > 0 ? (
                    <div className="flex items-center justify-between gap-1 bg-amber-50 border border-amber-300 px-2 py-1 rounded-lg text-amber-900 text-xs font-black shadow-xs">
                      <span
                        className="truncate cursor-pointer hover:underline"
                        onClick={() => setIsDiscountPresetsModalOpen(true)}
                        title="Click to change discount preset"
                      >
                        🏷️ {discountLabel} (-${discountAmount.toFixed(2)})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountType("none");
                          setDiscountValInput(10);
                        }}
                        className="text-slate-400 hover:text-rose-600 font-bold ml-1 p-0.5 cursor-pointer text-sm"
                        title="Remove discount"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsDiscountPresetsModalOpen(true)}
                      className="w-full px-2.5 py-1.5 bg-[#F5F6F4] hover:bg-slate-200 border border-[#E0E3DF] hover:border-amber-400 rounded-lg text-xs font-black text-slate-700 hover:text-slate-900 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>🏷️</span>
                      <span>+ Discount</span>
                    </button>
                  )}
                </div>

                {/* Delivery Fee Control (Only for Delivery orders) */}
                {orderType === "delivery" && (() => {
                  const currentFeeNum = Number(deliveryFee) || 0;
                  const matchingRule = deliveryPricingRules.find(
                    (r: any) => Math.abs((parseFloat(r.delivery_cost) || 0) - currentFeeNum) < 0.001
                  );
                  const isZeroFee = currentFeeNum === 0;
                  const isCustomFee = !isZeroFee && !matchingRule;
                  const selectValue = isCustomFee
                    ? currentFeeNum
                    : (matchingRule ? (parseFloat(matchingRule.delivery_cost) || 0) : 0);

                  return (
                    <div className="space-y-1 pt-1 border-t border-[#E0E3DF]">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#5E6964] text-[11px] block">Delivery Fee:</span>
                        <span className="text-[11px] font-extrabold text-blue-600">
                          ${currentFeeNum.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={selectValue}
                          onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                          className="bg-[#F5F6F4] border border-[#E0E3DF] text-[#242B28] text-[11px] font-extrabold rounded-lg px-2 py-1 outline-none flex-1 truncate"
                        >
                          <option value={0}>$0.00 (Free Delivery)</option>
                          {deliveryPricingRules.map((r: any) => {
                            const cost = parseFloat(r.delivery_cost) || 0;
                            return (
                              <option key={r.id} value={cost}>
                                {r.min_distance_km} - {r.max_distance_km} km — ${cost.toFixed(2)}
                              </option>
                            );
                          })}
                          {isCustomFee && (
                            <option value={currentFeeNum}>
                              Custom: ${currentFeeNum.toFixed(2)}
                            </option>
                          )}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const val = prompt("Custom Delivery Fee ($ USD):", String(currentFeeNum));
                            if (val !== null && val.trim() !== "" && !isNaN(parseFloat(val))) {
                              setDeliveryFee(parseFloat(val));
                            }
                          }}
                          style={isCustomFee ? { backgroundColor: primaryColor, color: primaryText } : undefined}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all shrink-0 ${
                            isCustomFee
                              ? "shadow"
                              : "bg-[#F5F6F4] border border-[#E0E3DF] text-[#242B28] hover:bg-slate-200"
                          }`}
                        >
                          Custom
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* RIGHT SIDE: Subtotal, Discount, Delivery Fee, TOTAL */}
              <div className="space-y-1 text-xs font-semibold text-[#5E6964] flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#5E6964]">Subtotal</span>
                    <span className="text-[#242B28]">${subtotal.toFixed(2)}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-amber-600 font-bold">
                      <span>Discount ({discountLabel})</span>
                      <span>-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}

                  {orderType === "delivery" && (
                    <div className="flex justify-between text-blue-600">
                      <span>Delivery Fee</span>
                      <span>+${(Number(deliveryFee) || 0).toFixed(2)}</span>
                    </div>
                  )}
                  {isVatSubscribed && vatAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>VAT ({vatRate}%)</span>
                      <span>+${vatAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#E0E3DF]">
                  <span className="font-extrabold text-xs uppercase text-[#242B28] tracking-wider">TOTAL</span>
                  <div className="text-right">
                    <span className="font-black text-xl" style={{ color: primaryColor }}>
                      ${total.toFixed(2)}
                    </span>
                    <span className="text-[11px] font-bold text-[#5E6964] block -mt-0.5">
                      ≈ {Math.round(total * (exchangeRate || 90000)).toLocaleString()} LBP
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  )}

      {/* SCHEDULE ORDER MODAL (Hold in Sell mode) */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-5 space-y-4 text-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">⏳</span>
                <div>
                  <h3 className="font-black text-base text-slate-900">Place Order — Now or Later</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Place now or choose a ready date and time. Payment is separate.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 font-bold p-1 text-sm rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Time Presets */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Quick Preset Ready Times:
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[15, 30, 45, 60, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => applyQuickSchedule(mins)}
                    className="px-2 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 hover:border-purple-300 text-xs font-black text-purple-900 transition text-center shadow-xs cursor-pointer"
                  >
                    +{mins < 60 ? `${mins}m` : `${mins / 60}h`}
                  </button>
                ))}
              </div>
            </div>

            {/* Date & Time Selectors */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Target Ready Date:
                </label>
                <input
                  type="date"
                  inputMode="none"
                  value={scheduledOrderDate}
                  onChange={(e) => setScheduledOrderDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-purple-500 shadow-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Target Ready Time:
                </label>
                <input
                  type="time"
                  inputMode="none"
                  value={scheduledOrderTime}
                  onChange={(e) => setScheduledOrderTime(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-purple-500 shadow-xs"
                />
              </div>
            </div>

            {/* Special Kitchen Notes */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Kitchen Prep & Pickup Note (prints on ticket):
              </label>
              <input
                type="text"
                placeholder="e.g. Customer will pick up curbside at 1:30 PM, pack sauces separately"
                value={scheduledOrderNote}
                onChange={(e) => setScheduledOrderNote(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:border-purple-500 shadow-xs"
              />
            </div>

            {/* Preview Banner */}
            {scheduledOrderTime && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs space-y-1">
                <div className="font-bold text-purple-900 flex items-center gap-1.5">
                  <span>🖨️</span>
                  <span>Kitchen Chit Print Preview:</span>
                </div>
                <div className="font-mono text-[11px] text-slate-800 bg-white p-2.5 rounded-lg border border-purple-200 space-y-0.5 shadow-xs">
                  <div className="font-bold text-amber-700">*** SCHEDULED ORDER ***</div>
                  <div className="text-purple-900 font-bold">
                    READY AT: {formatScheduledTimeDisplay(scheduledOrderDate, scheduledOrderTime)}
                  </div>
                  {scheduledOrderNote && <div className="text-slate-600">NOTE: {scheduledOrderNote}</div>}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
              {scheduledOrderTime && (
                <button
                  type="button"
                  onClick={() => {
                    setScheduledOrderTime("");
                    setScheduledOrderNote("");
                    setIsScheduleModalOpen(false);
                  }}
                  className="px-3 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 font-bold text-xs transition cursor-pointer"
                  title="Clear schedule"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs transition cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={async () => {
                  setIsScheduleModalOpen(false);
                  await handleHoldOrder({ scheduledTime: '', scheduledNote: '' });
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs transition shadow-md cursor-pointer"
              >
                Place Now
              </button>
              <button
                type="button"
                disabled={isSubmitting || !scheduledOrderDate || !scheduledOrderTime}
                onClick={async () => {
                  setIsScheduleModalOpen(false);
                  await handleHoldOrder({ scheduledDate: scheduledOrderDate, scheduledTime: scheduledOrderTime, scheduledNote: scheduledOrderNote });
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black text-xs transition shadow-lg shadow-amber-950/50"
                title="Save the order with its ready time and print a scheduled kitchen ticket; no payment is taken"
              >
                Schedule Order
              </button>
            </div>
          </div>
        </div>
      )}



      {/* TABLET-FRIENDLY DYNAMIC STEP-BY-STEP MODIFIER MODAL */}
      {activeTabModal === "customization" && currentProduct && (() => {
        const isBundle = Boolean(
          currentProduct.category_id === 30 ||
          (currentProduct.category_name && currentProduct.category_name.toLowerCase().includes('bundle')) ||
          (currentProduct.category && currentProduct.category.toLowerCase().includes('bundle')) ||
          (currentProduct.name && currentProduct.name.toLowerCase().includes('bundle'))
        );

        const orderedGroups = buildDynamicModifierGroups(
          currentProduct.customizations || [],
          selectedCustomizations,
          products,
          isBundle
        );
        const totalScreens = Math.max(orderedGroups.length, 1);
        const safeStep = Math.min(Math.max(customizationStep, 0), totalScreens - 1);
        const activeGroupEntry = orderedGroups[safeStep] || null;
        const activeGroupName = activeGroupEntry ? activeGroupEntry[0] : '';
        const activeGroupOpts: any[] = activeGroupEntry ? activeGroupEntry[1] : [];
        const activeIsRequired = activeGroupOpts.some((o: any) => o.is_required);
        const activeHasSelection = selectedCustomizations.some((c: any) =>
          activeGroupOpts.some((o: any) => o.id === c.id || o.original_id === c.id || o.id === c.original_id || (o.original_id && c.original_id && o.original_id === c.original_id && o.parent_option_id === c.parent_option_id))
        );
        const allRequiredSatisfied = orderedGroups.every(([, opts]) => {
          const isReq = (opts as any[]).some((o: any) => o.is_required);
          return !isReq || selectedCustomizations.some((c: any) =>
            (opts as any[]).some((o: any) => o.id === c.id || o.original_id === c.id || o.id === c.original_id || (o.original_id && c.original_id && o.original_id === c.original_id && o.parent_option_id === c.parent_option_id))
          );
        });

        let extraCost = 0;
        if (!isBundle) {
          selectedCustomizations.forEach((c: any) => {
            const q = Number(c.quantity || 1);
            if (c.price) extraCost += c.price * q;
          });
        }
        const finalUnitPrice = (currentProduct.unit_price_usd || 0) + extraCost;

        const handleNextStep = () => {
          setCustomizationError("");
          if (activeIsRequired && !activeHasSelection) {
            setCustomizationError(`⚠️ "${activeGroupName}" is REQUIRED — please select an option before continuing.`);
            return;
          }
          if (safeStep < totalScreens - 1) {
            setCustomizationStep(safeStep + 1);
          } else {
            handleSaveCustomizationToCart();
          }
        };

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 print:hidden">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl md:max-w-2xl p-5 sm:p-6 space-y-4 text-slate-900 shadow-2xl max-h-[90vh] flex flex-col">
              {/* HEADER */}
              <div className="flex justify-between items-center border-b border-slate-200 pb-3 flex-shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base sm:text-lg text-slate-900">{currentProduct.name}</h3>
                    {orderedGroups.length > 0 && (
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-pos-primary/10 text-pos-primary border border-pos-primary/30">
                        Screen {safeStep + 1} of {totalScreens}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-pos-primary">${finalUnitPrice.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => { setActiveTabModal(null); setCurrentProduct(null); }}
                  className="text-slate-400 hover:text-slate-900 text-xl font-bold p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* DYNAMIC MODIFIER SCREENS STEPPER BAR */}
              {orderedGroups.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 flex-shrink-0">
                  {orderedGroups.map(([gName, gOpts], idx) => {
                    const isCurrent = idx === safeStep;
                    const hasSel = selectedCustomizations.some((c: any) =>
                      (gOpts as any[]).some((o: any) => o.id === c.id || o.original_id === c.id || o.id === c.original_id || (o.original_id && c.original_id && o.original_id === c.original_id && o.parent_option_id === c.parent_option_id))
                    );
                    const isReq = (gOpts as any[]).some((o: any) => o.is_required);
                    return (
                      <React.Fragment key={gName}>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomizationError("");
                            setCustomizationStep(idx);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap border flex-shrink-0 cursor-pointer ${
                            isCurrent
                              ? 'bg-pos-primary text-white border-pos-primary shadow-sm'
                              : hasSel
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                                : isReq
                                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-xs'
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full bg-black/10 flex items-center justify-center text-[10px]">
                            {hasSel ? '✓' : idx + 1}
                          </span>
                          <span>{gName}</span>
                        </button>
                        {idx < orderedGroups.length - 1 && (
                          <span className="text-slate-400 text-xs font-bold flex-shrink-0">→</span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}

              {customizationError && (
                <div className="bg-rose-50 border border-rose-300 text-rose-800 text-xs px-3.5 py-2 rounded-xl font-bold flex-shrink-0 animate-pulse">
                  {customizationError}
                </div>
              )}

              {/* CURRENT MODIFIER SCREEN CONTENT */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {activeGroupEntry ? (
                  (() => {
                    const groupName = activeGroupName;
                    const opts = activeGroupOpts;
                    const isMultiSelect = opts.some((o: any) => o.is_multi_select) || opts[0]?.customization_type === 'removal';
                    const isRequired = activeIsRequired;
                    const isRemoveGroup = opts.every((o: any) => o.customization_type === 'removal' || o.customization_type === 'remove');
                    const groupHasSelection = activeHasSelection;

                    const modeBadge = isRemoveGroup
                      ? { label: 'REMOVE', cls: 'bg-rose-100 text-rose-800 border-rose-300' }
                      : isMultiSelect
                        ? { label: 'MULTI SELECT', cls: 'bg-blue-100 text-blue-800 border-blue-300' }
                        : { label: 'SINGLE CHOICE', cls: 'bg-purple-100 text-purple-800 border-purple-300' };

                    return (
                      <div
                        key={groupName}
                        className={`space-y-3 p-4 rounded-xl border transition-all ${
                          isRequired && !groupHasSelection
                            ? 'bg-rose-50/70 border-rose-300'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {/* Group header */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                              {safeStep + 1}. {groupName}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${modeBadge.cls}`}>
                              {modeBadge.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isRequired ? (
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                                groupHasSelection
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                              }`}>
                                {groupHasSelection ? '✓ SATISFIED' : 'REQUIRED'}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                                Optional
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Hint text */}
                        <p className="text-[11px] text-slate-500 -mt-1">
                          {isRemoveGroup
                            ? 'Select any ingredients to remove from the dish.'
                            : isMultiSelect
                              ? 'Select one or more options below, then tap Next.'
                              : `Select one option${safeStep < totalScreens - 1 ? ' (automatically advances to the next screen)' : ''}.`
                          }
                        </p>

                        {/* Options Grid */}
                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                          {opts.map((opt: any) => {
                            const selectedEntry = selectedCustomizations.find((c: any) =>
                              c.id === opt.id ||
                              (c.original_id && c.original_id === opt.id) ||
                              (opt.original_id && c.id === opt.original_id) ||
                              (c.original_id && opt.original_id && c.original_id === opt.original_id && c.parent_option_id === opt.parent_option_id)
                            );
                            const isSelected = Boolean(selectedEntry);
                            const optQty = Number(selectedEntry?.quantity || 1);
                            const matchedSubProd = findMatchingProduct(opt.name || opt.ingredient, products);
                            const hasSubModifiers = Boolean(matchedSubProd && matchedSubProd.customizations && matchedSubProd.customizations.length > 0);
                            const isIncludedItem = Boolean(
                              opt.option_group_name?.toLowerCase().includes('included') ||
                              opt.name?.toLowerCase().includes('included') ||
                              opt.ingredient?.toLowerCase().includes('included') ||
                              opt.is_default
                            );

                            const rawOptName = opt.name || opt.ingredient || '';
                            const displayName = rawOptName.replace(/\s*\(\s*included\s*\)/gi, '').trim();
                            const hasExtraPrice = !isBundle && opt.price > 0;

                            return (
                              <div key={opt.id} className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleOption(opt, isMultiSelect, totalScreens)}
                                  className={`w-full p-3.5 rounded-xl text-xs font-bold transition-all border shadow-xs flex items-center justify-between gap-2.5 cursor-pointer min-h-[48px] ${
                                    isSelected
                                      ? isRemoveGroup
                                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm ring-2 ring-rose-300'
                                        : isMultiSelect
                                          ? 'bg-blue-600 text-white border-blue-400 shadow-sm ring-2 ring-blue-300'
                                          : 'bg-pos-primary text-white border-pos-primary shadow-sm ring-2 ring-pos-primary/30'
                                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-xs'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <span className={`w-4 h-4 rounded-${isMultiSelect ? 'sm' : 'full'} border-2 flex items-center justify-center flex-shrink-0 ${
                                      isSelected ? 'border-white bg-white/30' : 'border-slate-400 bg-transparent'
                                    }`}>
                                      {isSelected && (
                                        <span className={`${isMultiSelect ? 'text-[9px]' : 'w-2 h-2 rounded-full bg-white block'}`}>
                                          {isMultiSelect ? '✓' : ''}
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-xs font-bold text-left leading-snug break-words">
                                      {displayName}
                                    </span>
                                  </div>

                                  {hasExtraPrice && (
                                    <span className={`text-[11px] font-black whitespace-nowrap flex-shrink-0 ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                                      +${(opt.price * (isSelected ? optQty : 1)).toFixed(2)}
                                    </span>
                                  )}
                                </button>

                                {/* Modifier Quantity Stepper Controls (- 1 +) */}
                                {isMultiSelect && isSelected && !isRemoveGroup && !isBundle && !isIncludedItem && (
                                  <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl px-1.5 py-1.5 gap-1.5 shadow-xs flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateOptionQty(opt, -1);
                                      }}
                                      className="w-5 h-5 rounded-lg flex items-center justify-center bg-white hover:bg-slate-200 text-xs font-black text-slate-800 border border-slate-200 cursor-pointer shadow-xs"
                                      title="Decrease quantity"
                                    >
                                      -
                                    </button>
                                    <span className="text-xs font-black text-slate-900 min-w-[14px] text-center">
                                      {optQty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateOptionQty(opt, 1);
                                      }}
                                      className="w-5 h-5 rounded-lg flex items-center justify-center bg-white hover:bg-slate-200 text-xs font-black text-slate-800 border border-slate-200 cursor-pointer shadow-xs"
                                      title="Increase quantity"
                                    >
                                      +
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-center py-6 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl">No extra options for this product.</div>
                )}

                {/* Summary of selections across all screens */}
                {selectedCustomizations.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mr-1">Selected:</span>
                    {selectedCustomizations.map((c: any) => {
                      const isInc = Boolean(
                        c.option_group_name?.toLowerCase().includes('included') ||
                        c.name?.toLowerCase().includes('(included)') ||
                        c.ingredient?.toLowerCase().includes('(included)') ||
                        c.is_default
                      );
                      const showQty = !isInc && !isBundle && Number(c.quantity || 1) > 1;
                      const rawCustName = c.name || c.ingredient || '';
                      const displayName = rawCustName.replace(/\s*\(\s*included\s*\)/gi, '').trim();

                      return (
                        <span
                          key={c.id}
                          className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-800 shadow-xs"
                        >
                          {displayName}
                          {showQty ? ` ×${c.quantity}` : ''}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Special Note (shown on final screen or when only 1 screen) */}
                {safeStep === totalScreens - 1 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-200">
                    <label className="text-xs font-bold text-slate-700 block">Special Preparation Note:</label>
                    <input
                      type="text"
                      placeholder="e.g. Extra hot, syrup on the side..."
                      value={itemNote}
                      onChange={(e) => setItemNote(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pos-primary shadow-xs"
                    />
                  </div>
                )}
              </div>

              {/* MODAL BOTTOM NAVIGATION */}
              <div className="flex gap-2.5 pt-3 border-t border-slate-200 flex-shrink-0">
                {safeStep > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomizationError("");
                      setCustomizationStep(safeStep - 1);
                    }}
                    className="px-4 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold rounded-xl text-xs whitespace-nowrap transition cursor-pointer shadow-xs"
                  >
                    ← Back: {orderedGroups[safeStep - 1]?.[0]}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setActiveTabModal(null); setCurrentProduct(null); }}
                    className="px-4 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
                  >
                    Cancel
                  </button>
                )}

                {safeStep < totalScreens - 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="flex-1 py-3 bg-pos-primary hover:bg-pos-primary-hover text-white font-black rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {activeHasSelection
                        ? `Next: ${orderedGroups[safeStep + 1]?.[0]} (${safeStep + 2}/${totalScreens}) →`
                        : activeIsRequired
                          ? `Select ${activeGroupName} to Continue →`
                          : `Skip / Next: ${orderedGroups[safeStep + 1]?.[0]} (${safeStep + 2}/${totalScreens}) →`}
                    </button>
                    {allRequiredSatisfied && (
                      <button
                        type="button"
                        onClick={handleSaveCustomizationToCart}
                        className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition-all whitespace-nowrap shadow-md cursor-pointer"
                        title="All required choices are satisfied — add directly to ticket"
                      >
                        Add Now (${(finalUnitPrice * customizationQty).toFixed(2)})
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveCustomizationToCart}
                    className="flex-1 py-3 bg-pos-primary hover:bg-pos-primary-hover text-white font-black rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    ADD TO TICKET — ${(finalUnitPrice * customizationQty).toFixed(2)}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* POS SETTINGS MODAL */}
      {activeTabModal === "settings" && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-5 text-slate-900 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">⚙️</span>
                <h3 className="font-extrabold text-base">POS System Settings</h3>
              </div>
              <button onClick={() => setActiveTabModal(null)} className="text-gray-400 hover:text-white text-xl font-bold p-1">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <span className="font-extrabold text-pos-primary text-xs block uppercase tracking-wider">Store Operational Control:</span>
                <button
                  onClick={() => {
                    setActiveTabModal(null);
                    fetchBranchStatusAndPrompt();
                    setShowBranchStatusModal(true);
                  }}
                  className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-800 font-extrabold rounded-xl transition-all text-xs border border-slate-300 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  ⚙️ Change Store Opening / Closure Status
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <span className="font-extrabold text-amber-800 text-xs block uppercase tracking-wider">Thermal Printer Configuration:</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-500 block mb-1">Print Server IP</label>
                    <input
                      type="text"
                      value={printServerIP}
                      onChange={(e) => setPrintServerIP(e.target.value)}
                      placeholder="192.168.18.195"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-bold shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Port</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={printServerPort}
                      onChange={(e) => setPrintServerPort(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-bold shadow-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-800 text-xs block uppercase tracking-wider">
                    Restaurant & Branch Discounts:
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">
                    {restaurantDiscounts.length} configured
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Configure discounts for {currentRestaurantName} and choose whether they apply to all branches or separate branches.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTabModal(null);
                    setIsDiscountManagerOpen(true);
                  }}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl transition-all text-xs border border-amber-400 flex items-center justify-center gap-2 shadow cursor-pointer"
                >
                  🏷️ Manage Discounts & Branch Scopes
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-slate-600">
                <span>POS Tablet System Version</span>
                <span className="font-bold text-slate-800 bg-slate-200 px-2 py-0.5 rounded text-[11px]">v2.5.4</span>
              </div>
            </div>

            <button
              onClick={() => setActiveTabModal(null)}
              className="w-full py-3 bg-pos-primary hover:bg-pos-primary-hover text-white font-extrabold rounded-xl transition-all shadow-lg"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* BRANCH STATUS MODAL */}
      {showBranchStatusModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-5 text-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">⚙️</span>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Store Operational Status</h3>
                  <p className="text-[11px] text-slate-500 font-medium">{branchStatus?.name || "Cloud Kitchen"}</p>
                </div>
              </div>
              <button
                onClick={() => setShowBranchStatusModal(false)}
                className="text-slate-400 hover:text-slate-900 text-xl font-bold p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
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
                <span className="px-2.5 py-1 rounded-lg bg-black/10 text-xs font-bold border border-slate-300 shrink-0 ml-2">
                  Notice Active
                </span>
              )}
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  1. Orders Active / Operational Status
                </label>
                <select
                  value={posOperationalStatus}
                  onChange={(e) => setPosOperationalStatus(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 shadow-xs focus:outline-none focus:border-pos-primary"
                >
                  <option value="open">🟢 Normal / Auto Schedule (Open during operating hours)</option>
                  <option value="closed_hour">⏳ Closed For an Hour (60 Minutes)</option>
                  <option value="closed_today">🌙 Closed For Today (Until Midnight)</option>
                  <option value="closed">🔴 Closed (Hidden from Customers & POS)</option>
                </select>
              </div>

              {posOperationalStatus !== "open" && (
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    2. Closure Reason
                  </label>
                  <select
                    value={posClosureReason}
                    onChange={(e) => setPosClosureReason(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 shadow-xs focus:outline-none focus:border-pos-primary"
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
                className={`flex-1 py-3 font-extrabold rounded-xl text-xs transition-all shadow-md text-white cursor-pointer ${
                  isSavingBranchStatus ? "bg-slate-400 cursor-not-allowed" : "bg-pos-primary hover:bg-pos-primary-hover"
                }`}
              >
                {isSavingBranchStatus ? "Saving Status..." : "Save Status Changes"}
              </button>
              <button
                onClick={() => setShowBranchStatusModal(false)}
                className="px-4 py-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs shadow-xs transition cursor-pointer"
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
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col text-slate-900 shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
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
                  <div key={o.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-black text-slate-900 text-sm">Order #{o.id} • {o.customer_name || "WhatsApp Customer"}</div>
                      <div className="text-slate-500 mt-0.5">{o.customer_phone} • {o.delivery_address || "Pickup"}</div>
                      <div className="text-pos-primary font-black mt-1">${parseFloat(o.total_amount || 0).toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRejectPendingOrder(o.id)}
                        disabled={rejectingOrderId === o.id}
                        className={`px-3 py-2 border rounded-xl font-bold transition-all disabled:opacity-50 ${
                          confirmingRejectId === o.id
                            ? "bg-red-600 text-white border-red-400 animate-pulse font-black"
                            : "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
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
                        className="px-4 py-2 bg-pos-primary hover:bg-pos-primary-hover text-white font-black rounded-xl shadow-md cursor-pointer"
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
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl max-h-[80vh] flex flex-col text-slate-900 shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xl">⏸️</span>
                <h3 className="font-extrabold text-base">Held Orders ({heldOrders.length})</h3>
              </div>
              <button onClick={() => setActiveTabModal(null)} className="text-slate-400 hover:text-slate-900 text-xl font-bold p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer">✕</button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {heldOrders.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">No held orders right now.</div>
              ) : (
                heldOrders.map((o) => (
                  <div key={o.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-black text-slate-900 text-sm">Held Order #{o.id}</div>
                      <div className="text-slate-500 mt-0.5">{o.customer_name || "Walk-in"} • ${parseFloat(o.total_amount || 0).toFixed(2)}</div>
                      {o.claimed_terminal && (
                        <div className="mt-1 px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-300 rounded text-[10px] font-bold inline-flex items-center gap-1">
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
                            : "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
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
                        className={`px-4 py-2 text-white font-black rounded-xl shadow-md flex items-center gap-1 cursor-pointer ${
                          o.claimed_terminal && o.claimed_terminal !== posTerminalId
                            ? "bg-amber-600 hover:bg-amber-500"
                            : "bg-pos-primary hover:bg-pos-primary-hover"
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
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col text-slate-900 shadow-2xl">

            {/* HEADER */}
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h3 className="font-extrabold text-base">
                  {historyMode === 'shift' ? '📜 Current Shift Orders' : `📅 Orders — ${historyDate}`}
                </h3>
                {historyMode === 'shift' && activeShift && (
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                    {activeShift.shift} Shift · Since {new Date(activeShift.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Back to shift button when in date mode */}
                {historyMode === 'date' && (
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryMode('shift');
                      setHistorySearchQuery('');
                      fetchOrderHistory();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-bold transition active:scale-95 cursor-pointer"
                  >
                    ← Current Shift
                  </button>
                )}
                {/* Admin-only Previous Orders button */}
                {isAdmin && historyMode === 'shift' && (
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryMode('date');
                      setHistorySearchQuery('');
                      fetchHistoryByDate(historyDate);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/40 border border-blue-500/40 text-xs font-bold transition active:scale-95 cursor-pointer flex items-center gap-1"
                  >
                    <span>📅</span>
                    <span>Previous Orders</span>
                  </button>
                )}
                <button onClick={() => setActiveTabModal(null)} className="text-gray-400 hover:text-white font-bold p-1">✕</button>
              </div>
            </div>

            {/* DATE PICKER (admin date mode only) */}
            {historyMode === 'date' && (
              <div className="px-4 pt-3 pb-2 bg-[#0D1018] border-b border-slate-200 flex items-center gap-3">
                <label className="text-xs font-bold text-slate-400 whitespace-nowrap">Select Date:</label>
                <input
                  type="date"
                  value={historyDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => {
                    const d = e.target.value;
                    if (d) {
                      setHistoryDate(d);
                      setHistorySearchQuery('');
                      fetchHistoryByDate(d);
                    }
                  }}
                  className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                />
                {isFetchingHistoryDate && (
                  <span className="text-xs text-slate-500 animate-pulse">Loading…</span>
                )}
              </div>
            )}

            {/* SEARCH BAR */}
            <div className="p-3 bg-slate-50 border-b border-slate-200">
              <input
                type="text"
                placeholder="Search by Order #, Customer Name, Phone…"
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:border-pos-primary shadow-xs"
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
                  return <div className="py-12 text-center text-slate-500 text-xs">No completed orders found.</div>;
                }

                // Group orders by date
                const grouped: Record<string, any[]> = {};
                const sorted = [...filtered].sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

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

                return (Object.entries(grouped) as [string, any[]][]).map(([dateGroup, ordersGroup]) => (
                  <div key={dateGroup} className="space-y-3">
                    {/* DATE GROUP HEADER */}
                    <div className="sticky top-0 z-10 bg-slate-100 py-2 px-3 border border-slate-200 rounded-xl text-xs font-black text-slate-800 flex items-center justify-between shadow-xs">
                      <span className="truncate">{dateGroup}</span>
                      <span className="text-[10px] font-extrabold text-slate-700 bg-white px-2.5 py-0.5 rounded-lg border border-slate-300 shrink-0">
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
                            className={`p-4 bg-white border border-slate-200 rounded-xl space-y-3 text-xs shadow-xs transition-all ${
                              canEdit
                                ? "hover:border-pos-primary cursor-pointer"
                                : "hover:border-slate-300"
                            }`}
                          >
                            {/* Header Row */}
                            <div className="flex justify-between items-start border-b border-slate-200/60 pb-2.5">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-slate-900 text-base">Order #{order.id}</span>
                                  <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold ${
                                    order.order_source === "Toters" ? "bg-[#00C49F] text-black" :
                                    order.order_source === "WhatsApp" ? "bg-[#25D366] text-black" :
                                    order.order_source === "NokNok" ? "bg-[#FF5A5F] text-white" :
                                    order.order_source === "App" ? "bg-[#3B82F6] text-white" :
                                    "bg-pos-primary text-white"
                                  }`}>
                                    {order.order_source || "POS"}
                                  </span>
                                  <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-bold uppercase">
                                    {order.order_type || "pickup"}
                                  </span>
                                  {order.status && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-extrabold uppercase border ${
                                      isCompleted
                                        ? "bg-slate-100 text-slate-700 border-slate-300"
                                        : isCancelled
                                        ? "bg-rose-50 text-rose-700 border-rose-300"
                                        : "bg-emerald-50 text-emerald-800 border-emerald-300"
                                    }`}>
                                      {order.status}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium">
                                  🕒 {order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Time N/A"} • Payment: <strong className="text-slate-800">{order.payment_method || "Cash"}</strong>
                                </div>
                              </div>

                              <div className="text-right flex flex-col items-end gap-1.5">
                                <div className="text-xl font-black text-pos-primary">${parseFloat(order.total_amount || 0).toFixed(2)}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {canEdit ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        loadOrderToTicket(order, order.order_source || "POS");
                                        setActiveTabModal(null);
                                      }}
                                      className="px-3 py-1.5 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-[11px] font-extrabold shadow-xs flex items-center gap-1 transition active:scale-95 cursor-pointer"
                                    >
                                      ✏️ Edit in POS
                                    </button>
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                                      🔒 {isCompleted ? "Completed" : "Locked"}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReprintOrder(order);
                                    }}
                                    className="px-3 py-1.5 bg-pos-primary hover:bg-pos-primary-hover text-white rounded-xl text-[11px] font-extrabold shadow-xs flex items-center gap-1 transition active:scale-95 cursor-pointer"
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
                                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-[11px] font-extrabold shadow-xs flex items-center gap-1 transition active:scale-95 cursor-pointer"
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
                            <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                              {order.customer_name && <div>👤 <strong>Customer:</strong> {order.customer_name}</div>}
                              {order.customer_phone && <div>📞 <strong>Phone:</strong> {order.customer_phone}</div>}
                              {order.delivery_address && <div>🏠 <strong>Delivery Address:</strong> {order.delivery_address}</div>}
                            </div>
                          )}

                          {/* Items Summary */}
                          <div className="space-y-1.5">
                            <div className="font-extrabold text-slate-700 text-[11px] uppercase tracking-wider">Ordered Items:</div>
                            <div className="space-y-1">
                              {(order.items || []).map((item, idx) => (
                                <div key={idx} className="bg-slate-50 border border-slate-200 p-2 rounded-lg flex items-start justify-between text-xs">
                                  <div>
                                    <div className="font-bold text-slate-900">
                                      <span className="text-pos-primary font-black">{item.quantity || item.qty}x</span> {item.product_name || item.name}
                                    </div>
                                    {item.customizations && (() => {
                                      const { addons, removals } = partitionCustomizations(item.customizations);
                                      return (
                                        <div className="text-[10px] space-y-0.5 mt-0.5">
                                          {addons.length > 0 && (
                                            <div className="text-slate-600">
                                              <strong className="text-slate-700">+ Addons:</strong> {addons.join(", ")}
                                            </div>
                                          )}
                                          {removals.length > 0 && (
                                            <div className="text-rose-600 font-extrabold">
                                              <strong>REMOVE:</strong> {removals.join(", ")}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                    {item.comment && (
                                      <div className="text-[10px] text-amber-800 italic">Note: {item.comment}</div>
                                    )}
                                  </div>
                                  <span className="font-bold text-slate-800">${((item.unit_price || 0) * (item.quantity || item.qty || 1)).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Financial Summary Bar */}
                          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between text-xs text-slate-700 font-semibold">
                            <div>Subtotal: <strong className="text-slate-900">${parseFloat(order.subtotal_amount || 0).toFixed(2)}</strong></div>
                            {parseFloat(order.discount_amount || 0) > 0 && (
                              <div className="text-amber-700">Discount: <strong>-${parseFloat(order.discount_amount).toFixed(2)}</strong></div>
                            )}
                            <div>Delivery Fee: <strong className={parseFloat(order.delivery_fee || 0) > 0 ? "text-blue-700" : "text-slate-500"}>${parseFloat(order.delivery_fee || 0).toFixed(2)}</strong></div>
                            <div>Total: <strong className="text-pos-primary font-black text-sm">${parseFloat(order.total_amount || 0).toFixed(2)}</strong></div>
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
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 text-slate-900 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-2xl flex items-center justify-center mx-auto font-black shadow-xs">
              ✓
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-900">Order #{lastCompletedOrder.id} Approved & Saved!</h3>
              <p className="text-xs text-slate-500 mt-1">Sent to thermal printer & recorded in database.</p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1 text-left">
              <div className="flex justify-between font-bold text-slate-900">
                <span>Total Amount:</span>
                <span className="text-pos-primary font-black">${parseFloat(lastCompletedOrder.total_amount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Payment Method:</span>
                <span className="text-slate-800 font-bold">{lastCompletedOrder.payment_method || "Cash"}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Order Type / Channel:</span>
                <span className="text-slate-800 font-bold">{lastCompletedOrder.order_type || "delivery"} • {lastCompletedOrder.order_source || "POS"}</span>
              </div>
            </div>

            {/* DRIVER DISPATCH SECTION FOR DELIVERY ORDERS */}
            {lastCompletedOrder.order_type === "delivery" && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-center">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">🛵 Request Driver (+961 3 826 136)</span>
                  {dispatchStatusMsg ? (
                    <span className="text-[10px] bg-[#25D366]/20 text-[#25D366] px-2.5 py-0.5 rounded-full font-black animate-pulse">
                      {dispatchStatusMsg}
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-700 font-extrabold">⚡ Instant Dispatch</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 font-medium text-left">
                  Select arrival ETA time to send WhatsApp to driver (+961 3 826 136):
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {["Now", "5", "15", "20", "30", "45"].map((time) => (
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
                    className="text-[11px] text-slate-500 hover:text-slate-900 underline font-semibold"
                  >
                    Open WhatsApp Web/App Manually ➔
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setActiveTabModal(null)}
              className="w-full py-3.5 bg-pos-primary hover:bg-pos-primary-hover text-white font-black rounded-xl text-xs transition-all shadow-lg cursor-pointer"
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
        isShiftOpen={isShiftOpen}
        onOpenShift={() => setIsOpenShiftModalOpen(true)}
        totalUsd={total}
        subtotal={subtotal}
        discountAmount={discountAmount}
        discountType={discountType}
        discountValInput={discountValInput}
        discountIsPercent={discountIsPercent}
        selectedDiscountRule={selectedDiscountRule}
        applicableDiscounts={applicableDiscounts}
        currentRestaurantName={currentRestaurantName}
        currentBranchName={currentBranchName}
        onApplyDiscount={(type, val, isPct, rule) => {
          const doApply = () => {
            setDiscountType(type);
            setDiscountValInput(Number(val) || 0);
            setDiscountIsPercent(isPct);
            setSelectedDiscountRule(rule);
          };

          if (type === 'none') {
            doApply();
            return;
          }

          const staffUser = activeCashier || user;
          if (hasPosPermission(staffUser, 'apply_discount')) {
            doApply();
          } else {
            setSupervisorAuthRequest({
              actionKey: 'apply_discount',
              actionTitle: `Apply ${isPct ? `${val}%` : `$${val}`} Discount`,
              tableNumber: activeTableContext?.tableCode || null,
              orderId: editingOrderId || activeTableContext?.orderId || null,
              previousValue: discountType,
              newValue: { type, val, isPct, ruleName: rule?.name },
              requireReason: true,
              defaultReason: rule?.name || 'Discount authorization',
              onAuthorized: async () => {
                doApply();
              }
            });
          }
        }}
        exchangeRate={exchangeRate}
        isTable={Boolean(activeTableContext)}
        tableCode={activeTableContext?.tableCode}
        guestCount={activeTableContext?.guestCount}
        waiterName={activeTableContext?.waiterName || user?.name}
        orderType={orderType}
        isSubmitting={isSubmitting}
        customerName={customerName?.trim() === "." ? "" : customerName}
        customerPhone={customerPhone}
        scheduledOrderDate={scheduledOrderDate}
        scheduledOrderTime={scheduledOrderTime}
        scheduledOrderNote={scheduledOrderNote}
        onHoldOrder={async (sched) => {
          if (sched) {
            if (sched.scheduledDate) setScheduledOrderDate(sched.scheduledDate);
            if (sched.scheduledTime !== undefined) setScheduledOrderTime(sched.scheduledTime);
            if (sched.scheduledNote !== undefined) setScheduledOrderNote(sched.scheduledNote);
          }
          await handleHoldOrder(sched);
        }}
        onConfirmPayment={async (paymentDetails) => {
          if (paymentDetails.scheduledOrderDate) setScheduledOrderDate(paymentDetails.scheduledOrderDate);
          if (paymentDetails.scheduledOrderTime !== undefined) setScheduledOrderTime(paymentDetails.scheduledOrderTime || "");
          if (paymentDetails.scheduledOrderNote !== undefined) setScheduledOrderNote(paymentDetails.scheduledOrderNote || "");
          if (paymentDetails.customerPhone && !customerPhone) setCustomerPhone(paymentDetails.customerPhone);
          if (paymentDetails.customerName && (!customerName || customerName === ".")) setCustomerName(paymentDetails.customerName);
          await handleFinalizePayment(paymentDetails);
        }}
        onPrintBill={handlePrintBillFromPaymentModal}
      />

      {isOrderSetupOpen && !activeTableContext && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
          <section role="dialog" aria-modal="true" aria-labelledby="order-setup-title" className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-2.5 text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h2 id="order-setup-title" className="text-base font-black text-slate-900">Order type & customer</h2>
              <button type="button" onClick={() => setIsOrderSetupOpen(false)} aria-label="Close order setup" className="min-w-[40px] min-h-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-base font-bold transition cursor-pointer">✕</button>
            </div>
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Origin</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 bg-slate-100 rounded-xl border border-slate-200">
                    {['Store', 'WhatsApp', 'App', 'Toters', 'NokNok'].map(origin => {
                      const source = !selectedChannel || ['POS', 'Pick-up', 'Phone', 'Delivery'].includes(selectedChannel) ? 'Store' : selectedChannel;
                      return <button key={origin} type="button" onClick={() => handleSelectChannelSource(origin)} aria-pressed={source === origin}
                        className={'min-h-[44px] px-3 rounded-xl text-sm font-black transition cursor-pointer ' + (source === origin ? 'bg-pos-primary text-white shadow-xs' : 'text-slate-700 hover:bg-white')}>{origin}</button>;
                    })}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Type</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {['pickup', 'delivery'].map(type => <button key={type} type="button" aria-pressed={orderType === type}
                      onClick={() => { setOrderType(type); if (type === 'pickup') setDeliveryFee(0); setValidationError(''); }}
                      className={'min-h-[44px] rounded-xl text-sm font-black border transition cursor-pointer ' + (orderType === type ? 'bg-pos-primary text-white border-pos-primary shadow-xs' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200')}>{type === 'pickup' ? 'Pickup' : 'Delivery'}</button>)}
                  </div>
                </div>

                {/* CUSTOMER SELECTION BUTTON & POPUP TRIGGER */}
                <div className="pt-1 border-t border-slate-200/60 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCustomerSearchOpen(true)}
                    className={`flex-1 min-h-[44px] px-3 rounded-xl border flex items-center justify-between text-xs font-bold transition active:scale-98 cursor-pointer shadow-xs ${
                      customerName || customerPhone
                        ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                    title="Customer Search (Phone & Name)"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-amber-500 text-sm">👤</span>
                      <span className="truncate font-black text-xs">
                        {customerName
                          ? `${customerName}${customerPhone ? ` • ${customerPhone}` : ''}`
                          : customerPhone
                          ? customerPhone
                          : 'Customer'}
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300 font-bold uppercase tracking-wider flex-shrink-0">
                      {customerName || customerPhone ? 'Change' : '+ Add'}
                    </span>
                  </button>

                  {(customerName || customerPhone) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerName('');
                        setCustomerPhone('');
                        setDeliveryAddress('');
                        setDetectedWaLocation(null);
                      }}
                      className="min-h-[44px] px-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-300 hover:border-rose-300 text-xs font-bold transition cursor-pointer flex-shrink-0"
                      title="Clear customer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {(orderType === "delivery" || customerPhone || customerName) && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] font-bold text-slate-600">
                      Customer Name {orderType === "delivery" ? '*' : ''}
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => { setCustomerName(e.target.value); setValidationError(null); }}
                        onClick={() => { setCustomerSearchTab('name'); setIsCustomerSearchOpen(true); }}
                        readOnly
                        inputMode="none"
                        placeholder="Tap to enter / search name"
                        className="mt-1 w-full bg-white border border-slate-300 rounded-lg min-h-[44px] px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-pos-primary shadow-xs"
                      />
                    </label>
                    <label className="text-[11px] font-bold text-slate-600">
                      Phone Number
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        onClick={() => { setCustomerSearchTab('phone'); setIsCustomerSearchOpen(true); }}
                        readOnly
                        inputMode="none"
                        placeholder="Tap to enter / search phone"
                        className="mt-1 w-full bg-white border border-slate-300 rounded-lg min-h-[44px] px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-pos-primary shadow-xs"
                      />
                    </label>
                  </div>
                )}
                  {/* WHATSAPP LOCATION DETECTED BADGE / AUTO-FILL PROMPT */}
                  {detectedWaLocation && (
                    <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-2.5 flex items-center justify-between text-xs shadow-xs animate-fade-in">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="font-black text-emerald-800 flex items-center gap-1.5 text-[11px]">
                          <span>📍</span>
                          <span>WhatsApp Location Received</span>
                          <span className="text-[9px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded-full font-bold">
                            {detectedWaLocation.receivedMinutesAgo <= 1 ? "Just now" : `${detectedWaLocation.receivedMinutesAgo}m ago`}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-600 truncate mt-0.5">
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
                        className="bg-pos-primary hover:bg-pos-primary-hover text-white text-[11px] font-black px-2.5 py-1.5 rounded-lg shadow-xs shrink-0 flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                      >
                        <span>⚡ Auto-Fill</span>
                        {detectedWaLocation.deliveryFee !== undefined && (
                          <span>(${detectedWaLocation.deliveryFee?.toFixed(2)})</span>
                        )}
                      </button>
                    </div>
                  )}

                  {/* DELIVERY ADDRESS / LOCATION TEXTAREA (Only visible for delivery orders with a selected customer) */}
                  {orderType === "delivery" && (
                    <div className="space-y-1 pt-0.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-600">
                          📍 Delivery Address / Map Link:
                        </label>
                        {deliveryAddress && (
                          <button
                            type="button"
                            onClick={() => setDeliveryAddress("")}
                            className="text-[10px] text-slate-500 hover:text-rose-600 font-bold"
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
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:border-pos-primary resize-none shadow-xs"
                      />
                    </div>
                  )}


            {validationError && <p role="alert" className="text-sm text-rose-600 font-bold">{validationError}</p>}
            <button type="button" onClick={() => { if (validateOrder()) setIsOrderSetupOpen(false); }} className="w-full min-h-[44px] rounded-xl bg-pos-primary hover:bg-pos-primary-hover text-white text-sm font-black cursor-pointer shadow-md">Done</button>
          </section>
        </div>
      )}

      {isSavingTableNavigation && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 bg-black/10" role="status" aria-live="polite" aria-busy="true">
          <div className="rounded-xl bg-amber-50 border border-amber-300 px-5 py-3 text-sm font-bold text-amber-900 shadow-xl">
            Saving table order…
          </div>
        </div>
      )}
      {/* CUSTOMER SEARCH MODAL (PHONE & NAME KEYPADS) */}
      <CustomerSearchModal
        isOpen={isCustomerSearchOpen}
        onClose={() => setIsCustomerSearchOpen(false)}
        onSelectCustomer={handleSelectCustomer}
        initialPhone={customerPhone}
        initialName={customerName}
        initialTab={customerSearchTab}
      />

      {/* OVERDUE SHIFT ALERT MODAL */}
      <OverdueShiftModal
        onResolveTables={() => { setIsOverdueModalOpen(false); setPosActiveView("tables"); }}
        onResolveOrders={() => { setIsOverdueModalOpen(false); setPosActiveView("orders"); }}
        isOpen={isOverdueModalOpen && Boolean(activeShift)}
        shift={activeShift}
        cashierName={activeCashier?.name || user?.name || "Cashier"}
        onDismiss={() => setIsOverdueModalOpen(false)}
        onCloseShiftNow={() => {
          setIsOverdueModalOpen(false);
          setIsCloseShiftModalOpen(true);
        }}
        onHoldShift={handleHoldShift}
      />

      {/* MANAGER HELD SHIFTS AUDIT MODAL */}
      <ManagerHeldShiftsModal
        isOpen={isManagerHeldShiftsModalOpen}
        onClose={() => setIsManagerHeldShiftsModalOpen(false)}
        heldShifts={heldShifts}
        branchName={commerceBranchLink?.flow_branch_name || user?.branch || currentBranchName}
        onRefresh={refreshHeldShifts}
        onAuditShift={(heldShift) => {
          setAuditShiftTarget(heldShift);
          setIsManagerHeldShiftsModalOpen(false);
          setIsCloseShiftModalOpen(true);
        }}
      />

      {/* OPEN SHIFT CASH MODAL */}
      <OpenShiftModal
        isOpen={isOpenShiftModalOpen}
        onClose={() => setIsOpenShiftModalOpen(false)}
        branchName={commerceBranchLink?.flow_branch_name || user?.branch || "Cloud Kitchen"}
        cashierName={activeCashier?.name || user?.name || "Cashier"}
        concept={workspaceState.activeConcept}
        isDeliveryConcept={!isRestaurantMode}
        onConfirm={handleOpenShift}
        allowedShift={shiftEligibility.allowedShift}
        isAmEnabled={shiftEligibility.isAmEnabled}
        isPmEnabled={shiftEligibility.isPmEnabled}
        eligibilityReason={shiftEligibility.reason}
        statusLoading={shiftEligibilityLoading}
        statusError={shiftEligibilityError}
        prefillUsd={shiftEligibility.prefillUsd}
        prefillLbp={shiftEligibility.prefillLbp}
        prefillSource={shiftEligibility.prefillSource}
      />

      {/* PHASE 6 CLOSE SHIFT CASH MODAL — only mount when shift data is available */}
      {(isCloseShiftModalOpen && (auditShiftTarget || activeShift)) && (
        <CloseShiftModal
          isOpen={isCloseShiftModalOpen}
          onClose={() => {
            setIsCloseShiftModalOpen(false);
            setAuditShiftTarget(null);
          }}
          shift={auditShiftTarget || activeShift}
          branchName={commerceBranchLink?.flow_branch_name || user?.branch || "Cloud Kitchen"}
          branchId={commerceBranchLink?.flow_branch_id}
          externalBranchId={commerceBranchLink?.external_branch_id || undefined}
          locationKey={commerceBranchLink?.location_key || "cloud-kitchen"}
          terminalId={(auditShiftTarget || activeShift)?.terminal_id || persistentTerminalId}
          cashierName={activeCashier?.name || user?.name || "Cashier"}
          onHoldShift={auditShiftTarget ? undefined : handleHoldShift}
          onShiftClosed={async (closedShift, recon) => {
            setLastClosedShift(closedShift);
            setShiftReportData(recon);
            setReportModalMode('CLOSE');
            setIsShiftReportModalOpen(true);
            setAuditShiftTarget(null);
            await checkShift();
            await refreshHeldShifts();
            setHasPromptedShiftClosed(false);
          }}
        />
      )}

      {/* DAILY PAYMENTS MODAL (Cash In/Out, Supplier Payments, Delivery Expenses) */}
      <DailyPaymentsModal
        isOpen={isDailyPaymentsModalOpen}
        onClose={() => setIsDailyPaymentsModalOpen(false)}
        branchName={currentBranchName || commerceBranchLink?.flow_branch_name || user?.branch || "Cloud Kitchen"}
        branchId={currentBranchId}
        cashierName={activeCashier?.name || user?.name || "Cashier"}
        activeShiftName={activeShift?.shift || 'AM'}
        activeShiftDate={activeShift?.date}
        activeShiftId={activeShift?.id}
        restaurantId={currentRestaurantId}
      />

      {/* SUPPLIER INVOICES MODAL (Stage E: AI Scan, Product Match, Posting & Receiving) */}
      <SupplierInvoicesModal
        isOpen={isSupplierInvoicesModalOpen}
        onClose={() => setIsSupplierInvoicesModalOpen(false)}
        branchName={currentBranchName || commerceBranchLink?.flow_branch_name || user?.branch || "Cloud Kitchen"}
        branchId={currentBranchId}
        restaurantId={currentRestaurantId}
        cashierName={activeCashier?.name || user?.name || "Cashier"}
        userRole={activeCashier?.role || user?.role || "cashier"}
        userId={activeCashier?.id || user?.id}
      />

      {/* PHASE 6 SHIFT REPORT MODAL (X Report & Shift Close Report) */}
      <ShiftReportModal
        isOpen={isShiftReportModalOpen}
        onClose={() => {
          setIsShiftReportModalOpen(false);
          if (reportModalMode === 'CLOSE' && !isShiftOpen) {
            setIsOpenShiftModalOpen(true);
            setHasPromptedShiftClosed(true);
          }
        }}
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
            const aliases = await getDrawerTerminalAliases(selectedShift.branch_id || currentBranchId, selectedShift.terminal_id || persistentTerminalId);
            const period = await loadShiftReportingPeriod(selectedShift, aliases);
            const res = await calculateShiftReconciliation({
              locationKey: commerceBranchLink?.location_key || 'cloud-kitchen',
              shiftId: selectedShift.id,
              startTime: period.startTime,
              endTime: period.endTime,
              endExclusive: true,
              terminalIds: aliases,
              branchId: selectedShift.branch_id || currentBranchId,
              externalBranchId: commerceBranchLink?.external_branch_id,
              restaurantId: selectedShift.restaurant_id || currentRestaurantId,
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
        tableLabel={voidModalState.tableNumber || (activeTableContext ? `Table ${activeTableContext.tableCode}` : null)}
        items={voidModalState.items}
        currentUser={activeCashier || user}
        voidType={voidModalState.voidType}
        onConfirmVoid={handleExecuteVoid}
      />

      {/* CASHIER PIN LOCK & SWITCH MODAL */}
      {isCashierModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center text-slate-900 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-2xl mb-3 text-[#1e5c4f] shadow-xs">
              🔒
            </div>
            <h3 className="text-lg font-black text-slate-900">Switch Cashier</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4 font-medium">
              Enter your 4-digit FLOW PIN code to sign in to this terminal.
            </p>

            {/* PIN display dots */}
            <div className="flex items-center justify-center gap-3 mb-4">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    pinInput.length > idx
                      ? "bg-[#1e5c4f] border-[#1e5c4f] scale-110 shadow-xs"
                      : "border-slate-300 bg-slate-100"
                  }`}
                />
              ))}
            </div>

            {pinError && (
              <div className="mb-3 text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
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
                  className="h-12 bg-white hover:bg-slate-50 active:scale-95 text-slate-900 border border-slate-200 font-black text-lg rounded-xl transition shadow-xs cursor-pointer"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPinInput('')}
                className="h-12 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 font-bold text-xs rounded-xl transition border border-slate-200 cursor-pointer"
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
                className="h-12 bg-white hover:bg-slate-50 active:scale-95 text-slate-900 border border-slate-200 font-black text-lg rounded-xl transition shadow-xs cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setPinInput(prev => prev.slice(0, -1))}
                className="h-12 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-base rounded-xl transition border border-slate-200 cursor-pointer"
              >
                ⌫
              </button>
            </div>

            <div className="flex gap-2 w-full">
              <button
                type="button"
                onClick={() => { setIsCashierModalOpen(false); setPinInput(''); setPinError(''); }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCashierPinSubmit()}
                disabled={pinInput.length === 0 || isVerifyingPin}
                className="flex-1 py-2.5 bg-[#1e5c4f] hover:bg-[#16473D] disabled:opacity-40 text-white font-black text-xs rounded-xl transition shadow-md cursor-pointer"
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

      {/* QUICK DISCOUNT PRESETS MODAL (OVRLOAD / WICKD / RESTAURANT) */}
      {isDiscountPresetsModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-full max-w-sm p-4 space-y-3 text-white shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-[#262D3D] pb-2">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <span>🏷️</span> Apply Discount Preset
              </h3>
              <button
                type="button"
                onClick={() => setIsDiscountPresetsModalOpen(false)}
                className="text-gray-400 hover:text-white font-bold p-1 text-sm rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setDiscountType("none");
                  setIsDiscountPresetsModalOpen(false);
                }}
                className={`p-3 bg-[#0F1115] border rounded-xl text-center text-gray-300 hover:text-white transition cursor-pointer ${
                  discountType === 'none' ? 'border-[#eb660c] text-white' : 'border-[#262D3D] hover:border-[#eb660c]'
                }`}
              >
                None (0%)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscountType("5%");
                  setIsDiscountPresetsModalOpen(false);
                }}
                className={`p-3 bg-[#0F1115] border rounded-xl text-center text-white transition cursor-pointer ${
                  discountType === '5%' ? 'border-[#eb660c]' : 'border-[#262D3D] hover:border-[#eb660c]'
                }`}
              >
                5% Off
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscountType("10%");
                  setIsDiscountPresetsModalOpen(false);
                }}
                className={`p-3 bg-[#0F1115] border rounded-xl text-center text-white transition cursor-pointer ${
                  discountType === '10%' ? 'border-[#eb660c]' : 'border-[#262D3D] hover:border-[#eb660c]'
                }`}
              >
                10% Off
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscountType("15%");
                  setIsDiscountPresetsModalOpen(false);
                }}
                className={`p-3 bg-[#0F1115] border rounded-xl text-center text-white transition cursor-pointer ${
                  discountType === '15%' ? 'border-[#eb660c]' : 'border-[#262D3D] hover:border-[#eb660c]'
                }`}
              >
                15% Off
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscountType("wa15");
                  setIsDiscountPresetsModalOpen(false);
                }}
                className={`p-3 bg-[#0F1115] border rounded-xl text-center text-emerald-400 transition cursor-pointer ${
                  discountType === 'wa15' ? 'border-[#eb660c]' : 'border-[#262D3D] hover:border-[#eb660c]'
                }`}
              >
                WhatsApp 15%
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscountType("toters");
                  setIsDiscountPresetsModalOpen(false);
                }}
                className={`p-3 bg-[#0F1115] border rounded-xl text-center text-teal-300 transition cursor-pointer ${
                  discountType === 'toters' ? 'border-[#eb660c]' : 'border-[#262D3D] hover:border-[#eb660c]'
                }`}
              >
                Toters ({totersDiscountPercent}%)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscountType("noknok");
                  setIsDiscountPresetsModalOpen(false);
                }}
                className={`p-3 bg-[#0F1115] border rounded-xl text-center text-rose-300 transition cursor-pointer ${
                  discountType === 'noknok' ? 'border-[#eb660c]' : 'border-[#262D3D] hover:border-[#eb660c]'
                }`}
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
                  className="flex-1 bg-[#0F1115] border border-[#262D3D] rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:border-[#eb660c]"
                />
                <button
                  type="button"
                  onClick={() => setDiscountIsPercent(!discountIsPercent)}
                  className="px-3 py-2 bg-[#262D3D] rounded-xl text-xs font-extrabold text-amber-400 hover:bg-[#323b4e] transition cursor-pointer"
                >
                  {discountIsPercent ? "%" : "$ USD"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType("custom");
                    setIsDiscountPresetsModalOpen(false);
                  }}
                  className="px-4 py-2 bg-[#eb660c] hover:bg-[#ff771f] text-white rounded-xl text-xs font-black shadow transition cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FEATURES MODAL */}
      {isFeaturesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl p-6 space-y-4 text-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚙️</span>
                <h3 className="font-black text-lg text-slate-900">POS Features</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFeaturesModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-900 font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Terminal Info: Locked Branch, Cashier, Shift Status */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#1e5c4f] font-bold">📍</span>
                <span className="text-slate-500 font-medium">Branch:</span>
                <span className="text-slate-900 font-black">{currentBranchName}</span>
                <span className="text-[10px] text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-md font-bold border border-slate-300">🔒 Fixed</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-500 font-medium">Cashier: <strong className="text-slate-900 font-black">{activeCashier?.name || user?.name || "Staff"}</strong></span>
                <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] border ${
                  isShiftOpen ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {isShiftOpen ? '🟢 SHIFT OPEN' : '🔴 SHIFT CLOSED'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {activeTableContext && (editingOrderId || activeTableContext.orderId) && (
                <button type="button" onClick={handleVoidTable} disabled={isSubmitting}
                  className="p-3 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer shadow-xs disabled:opacity-50">
                  <span className="text-2xl group-hover:scale-110 transition-transform">🗑️</span>
                  <span className="font-black text-xs text-rose-900">Void Table</span>
                  <span className="text-[10px] text-rose-700 font-medium">Cancel the entire saved table order</span>
                </button>
              )}
              {/* Order History */}
              <button
                type="button"
                onClick={() => {
                  setIsFeaturesModalOpen(false);
                  setHistoryMode('shift');
                  setHistorySearchQuery('');
                  fetchOrderHistory();
                  setActiveTabModal("history");
                }}
                className="p-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer shadow-xs"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">📜</span>
                <span className="font-extrabold text-xs text-slate-800 group-hover:text-slate-950">Order History</span>
                <span className="text-[10px] text-slate-500">Past bills & receipts</span>
              </button>

              {/* Daily Branch Dashboard */}
              <button
                type="button"
                onClick={() => {
                  setIsFeaturesModalOpen(false);
                  setIsDailyControlOpen(true);
                }}
                className="p-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer shadow-xs"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">📊</span>
                <span className="font-extrabold text-xs text-slate-800 group-hover:text-slate-950">Daily Dashboard</span>
                <span className="text-[10px] text-slate-500">Shifts, sales & cash summary</span>
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
                className="p-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer shadow-xs"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">💼</span>
                <span className="font-extrabold text-xs text-slate-800 group-hover:text-slate-950">Shift / Drawer</span>
                <span className="text-[10px] text-slate-500">{activeShift ? 'Close / X-Report' : 'Open Shift Float'}</span>
              </button>

              {/* Held Shifts Audit (Manager) */}
              {heldShiftsCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsFeaturesModalOpen(false);
                    setIsManagerHeldShiftsModalOpen(true);
                  }}
                  className="p-3 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-300 flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer shadow-xs"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">⏸️</span>
                  <span className="font-extrabold text-xs text-amber-900 group-hover:text-amber-950">Held Shifts Audit</span>
                  <span className="text-[10px] text-amber-700">{heldShiftsCount} waiting review</span>
                </button>
              )}

              {/* Daily Payments (Cash Flow / Payouts / Expenses) */}
              <button
                type="button"
                onClick={() => {
                  setIsFeaturesModalOpen(false);
                  setIsDailyPaymentsModalOpen(true);
                }}
                className="p-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer shadow-xs"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">📝</span>
                <span className="font-extrabold text-xs text-slate-800 group-hover:text-slate-950">Daily Payments</span>
                <span className="text-[10px] text-slate-500">Payouts & Cash In/Out</span>
              </button>

              {/* Centralized Supplier Invoices (Stage E) */}
              <button
                type="button"
                onClick={() => {
                  setIsFeaturesModalOpen(false);
                  setIsSupplierInvoicesModalOpen(true);
                }}
                className="p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer shadow-xs"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">🧾</span>
                <span className="font-extrabold text-xs text-emerald-950 group-hover:text-emerald-900">Supplier Invoices</span>
                <span className="text-[10px] text-emerald-700">Scan, Match & Post</span>
              </button>



              {/* Screen Layout Builder */}
              <button
                type="button"
                onClick={() => {
                  setIsFeaturesModalOpen(false);
                  window.location.hash = '#/pos-screens';
                }}
                className="p-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer shadow-xs"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">🎛️</span>
                <span className="font-extrabold text-xs text-slate-800 group-hover:text-slate-950">Screen Builder</span>
                <span className="text-[10px] text-slate-500">Configure POS tiles & layout</span>
              </button>

              {/* POS System & Receipt Settings */}
              <button
                type="button"
                onClick={() => {
                  setIsFeaturesModalOpen(false);
                  window.location.hash = '#/pos-settings';
                }}
                className="p-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer shadow-xs"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">⚙️</span>
                <span className="font-extrabold text-xs text-slate-800 group-hover:text-slate-950">POS Settings</span>
                <span className="text-[10px] text-slate-500">Receipt MOF, Company & Hardware</span>
              </button>

              {/* Auto-Lock Screen after Every Sale */}
              <button
                type="button"
                onClick={toggleAutoLock}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer shadow-xs ${
                  autoLockOnOrder
                    ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
                title="Automatically block / lock screen after each completed order"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">
                  {autoLockOnOrder ? '🔒' : '🔓'}
                </span>
                <span className="font-extrabold text-xs">
                  Auto-Lock: {autoLockOnOrder ? 'ON' : 'OFF'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {autoLockOnOrder ? 'Blocks POS after sale' : 'Tap to block after sale'}
                </span>
              </button>

              {/* Exit POS under Features */}
              <button
                type="button"
                onClick={() => {
                  setIsFeaturesModalOpen(false);
                  handleTerminalLogout();
                }}
                className="p-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 flex flex-col items-center justify-center gap-1 text-center transition active:scale-95 group cursor-pointer sm:col-span-3 shadow-xs"
                title="Sign out and exit POS"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">🚪</span>
                <span className="font-black text-xs text-rose-800 group-hover:text-rose-950">Exit / Log Out POS</span>
                <span className="text-[10px] text-rose-600 font-medium">End session and return to sign-in</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TABLE & ITEMS TRANSFER MODAL */}
      {isTransferModalOpen && activeTableContext && (
        <TableTransferModal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          sourceTableCode={activeTableContext.tableCode}
          sourceOrderId={activeTableContext.orderId || editingOrderId}
          sourceSessionId={activeTableContext.sessionId}
          ticketItems={ticketItems}
          availableTables={branchFloorTables}
          restaurantId={currentRestaurantId}
          branchId={currentBranchId || commerceBranchLink?.flow_branch_id || branchCapabilities?.branchId || ''}
          currentUser={{
            id: (activeCashier || user)?.id || 'user',
            name: (activeCashier || user)?.name || 'Cashier',
            role: (activeCashier || user)?.role || 'cashier'
          }}
          onSuccess={async (result) => {
            if (result.mode === 'entire') {
              setActiveTableContext(prev => prev ? {
                ...prev,
                tableCode: result.destTableCode
              } : null);
              setCustomerName(`Table ${result.destTableCode}`);
              await refreshFloorTables();
              await fetchOrdersQueue().catch(() => {});
              alert(`✅ Table moved to Table ${result.destTableCode}!`);
            } else {
              if (result.remainingItems && result.remainingItems.length > 0) {
                setTicketItems(result.remainingItems);
              } else {
                setTicketItems([]);
                setActiveTableContext(null)
                setCustomerName("");
              }
              await refreshFloorTables();
              await fetchOrdersQueue().catch(() => {});
              alert(`✅ Items transferred to Table ${result.destTableCode}!`);
            }
          }}
          onRequestSupervisorAuth={(req) => setSupervisorAuthRequest(req)}
        />
      )}


      {/* PIN LOCK SCREEN OVERLAY */}
      {isPinLockOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center">
          <div className="w-full h-full max-w-6xl p-2 sm:p-4">
            <PosPinScreen
              isLockScreen={true}
              initialRestaurantId={currentRestaurantId}
              onLogout={handleTerminalLogout}
              onSuccess={async (cashierUser) => {
                setActiveCashier(cashierUser);
                setIsPinLockOpen(false);
                const currentShift = await checkShift();
                if (!currentShift) {
                  setIsOpenShiftModalOpen(true);
                } else {
                  setIsOpenShiftModalOpen(false);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* SECURITY / LOGOUT MODAL */}
      {isSecurityModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 space-y-4 text-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <span>🔒</span> Terminal Security
              </h3>
              <button
                type="button"
                onClick={() => setIsSecurityModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 text-lg font-bold p-1 rounded-lg hover:bg-slate-100 cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Current cashier: <strong className="text-slate-900">{activeCashier?.name || user?.name || 'Cashier'}</strong>.
              Choose an action below:
            </p>

            <div className="space-y-2.5 pt-1">
              {/* Switch Cashier / Lock */}
              <button
                type="button"
                onClick={() => {
                  setIsSecurityModalOpen(false);
                  localStorage.removeItem('pos_current_cashier');
                  setActiveCashier(null);
                  setIsPinLockOpen(true);
                }}
                className="w-full p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left flex items-center gap-3 transition cursor-pointer active:scale-98 shadow-xs"
              >
                <span className="text-2xl p-2 rounded-xl bg-amber-100 text-amber-800 border border-amber-200">🔒</span>
                <div>
                  <div className="font-black text-sm text-slate-900">Lock Screen / Switch Staff</div>
                  <div className="text-[11px] text-slate-500">Keep session active, require PIN to unlock</div>
                </div>
              </button>

              {/* Full Log Out */}
              <button
                type="button"
                onClick={() => {
                  handleTerminalLogout();
                }}
                className="w-full p-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-left flex items-center gap-3 transition cursor-pointer active:scale-98 shadow-xs"
              >
                <span className="text-2xl p-2 rounded-xl bg-rose-100 text-rose-800 border border-rose-200">🚪</span>
                <div>
                  <div className="font-black text-sm text-rose-900">Log Out Completely</div>
                  <div className="text-[11px] text-rose-700">Sign out, clear all sessions, return to login</div>
                </div>
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsSecurityModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs transition cursor-pointer shadow-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOW SUPERVISOR PIN AUTHORIZATION MODAL */}
      <PosSupervisorAuthModal
        isOpen={Boolean(supervisorAuthRequest)}
        request={supervisorAuthRequest}
        restaurantId={currentRestaurantId}
        branchName={currentBranchName}
        requestingUser={{
          id: activeCashier?.id || user?.id || 'pos-waiter',
          name: activeCashier?.name || user?.name || 'Staff',
          role: activeCashier?.role || user?.role || 'waiter'
        }}
        onClose={() => setSupervisorAuthRequest(null)}
      />

      <ThermalReceiptPreviewModal
        isOpen={isReceiptPreviewOpen}
        onClose={() => setIsReceiptPreviewOpen(false)}
        data={receiptPreviewData}
      />

      {/* CONCEPT CASH SHIFT MANAGEMENT (OVRLOAD / WICKD / DELIVERY CONCEPTS) */}
      {isConceptCashModalOpen && (
        <ConceptCashModal
          isOpen={isConceptCashModalOpen}
          onClose={() => setIsConceptCashModalOpen(false)}
          activeConcept={workspaceState.activeConcept}
          activeShift={activeShift}
          branchId={currentBranchId || commerceBranchLink?.flow_branch_id}
          branchName={currentBranchName}
          terminalId={posTerminalId}
          cashierName={activeCashier?.name || user?.name || "Cashier"}
          cashierId={activeCashier?.id || user?.id}
          onOpenShift={async ({ openingUsd, openingLbp, shift }) => {
            const res = await handleOpenShift(openingUsd, openingLbp, shift, 89500);
            return { success: !!res };
          }}
          onCloseShift={async (params) => {
            const res = await handleCloseShift(params);
            return { success: !!res };
          }}
          onTriggerHandoverOrder={(order) => {
            setTerminalHandoverOrder(order);
          }}
        />
      )}

      {/* DRIVER HANDOVER CASH COLLECTION MODAL */}
      {terminalHandoverOrder && (
        <DriverHandoverModal
          isOpen={Boolean(terminalHandoverOrder)}
          onClose={() => setTerminalHandoverOrder(null)}
          order={terminalHandoverOrder}
          activeCashierId={activeCashier?.id || user?.id}
          activeCashierName={activeCashier?.name || user?.name || "Cashier"}
          activeShiftId={activeShift?.id}
          exchangeRate={89500}
          onHandoverSuccess={async () => {
            setTerminalHandoverOrder(null);
            await checkShift();
            await fetchOrdersQueue();
          }}
        />
      )}
    </div>
  );
}
