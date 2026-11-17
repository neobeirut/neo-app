import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase, getGlobalRestaurantId, setGlobalRestaurantId } from '../api/supabase';
import { COMMERCE_API_BASE } from '../pos/config';
import { resolveCommerceBranchLink } from '../pos/services/branchMapping';
import type { CommerceBranchLink } from '../pos/types/commerce';
import { usePosShift } from '../pos/hooks/usePosShift';
import {
  fetchPosCatalog,
  type PosProduct,
  type PosCategory
} from '../pos/services/posCatalogService';
import {
  fetchPosScreens,
  TILE_COLORS,
  calculateDynamicGrid,
  getGridButtonDensity
} from '../pos/services/posScreenService';
import type { PosScreen, PosScreenButton } from '../pos/types/posScreen';
import {
  createDirectOrder,
  updateDirectOrderStatus,
  fetchOrderWithItems
} from '../pos/services/posOrderService';
import {
  buildPreparationPrintJobs,
  buildMainBillPrintJob,
  dispatchPhysicalPrintJobs,
  isCourseHoldItem
} from '../pos/services/ticketRoutingService';
import {
  hasPosPermission,
  loadRestaurantRolePermissions,
  normalizePosRole
} from '../pos/services/posPermissionService';
import {
  PosSupervisorAuthModal,
  type SupervisorAuthRequest
} from '../pos/components/PosSupervisorAuthModal';
import {
  TablesScreen,
  requestBill,
  loadFloorState,
  type PosTable
} from '../pos/tables';
import { ThermalReceiptPreviewModal, type ThermalReceiptData } from '../pos/components/ThermalReceiptPreviewModal';
import { useRestaurantTheme } from '../pos/theme/useRestaurantTheme';

const safeTimeoutSignal = (ms: number) => typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? safeTimeoutSignal(ms) : undefined;
import PosPinScreen from '../pos/components/PosPinScreen';
import { TableTransferModal } from '../pos/components/TableTransferModal';
import { PosModifierModal, partitionCustomizations } from '../pos/components/PosModifierModal';
import {
  Utensils,
  Lock,
  LogOut,
  ArrowLeft,
  Send,
  Flame,
  Receipt,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Layers,
  Edit3,
  X,
  Maximize,
  Minimize,
  ChevronLeft,
  MoveRight,
  Smartphone
} from 'lucide-react';
import { PwaInstallModal } from '../pos/components/PwaInstallModal';

interface PosWaiterScreenProps {
  user: any;
  onExit?: () => void;
}

interface TicketItem {
  line_item_id: string;
  order_item_id?: string | number;
  product_id: string | number;
  name: string;
  unit_price: number;
  qty: number;
  originalQty?: number;
  selectedCustomizations?: any[];
  note?: string;
  isHoldSeparator?: boolean;
  isOrdered?: boolean;
  item_added_by?: string;
  item_added_by_id?: string;
}

interface ActiveTableContext {
  orderId: number | string | null;
  tableCode: string;
  sessionId: string | null;
  guestCount: number;
  waiterName: string;
  waiterId?: string;
  tableId?: string | null;
  isNewlyCreated?: boolean;
  isExistingOccupied?: boolean;
}

export default function PosWaiterScreen({ user: initialUser, onExit }: PosWaiterScreenProps) {
  const { primaryColor, primaryHover, primaryText } = useRestaurantTheme();

  // Current active staff user on the tablet
  const [currentUser, setCurrentUser] = useState<any>(initialUser);

  // Tablet Lock Screen state (Fast Handover between servers)
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('flow_pos_locked') === 'true';
    } catch {
      return false;
    }
  });

  // Full Screen API state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // PWA Install Prompt State
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).deferredPwaPrompt) {
      setDeferredInstallPrompt((window as any).deferredPwaPrompt);
    }
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPwaPrompt = e;
      setDeferredInstallPrompt(e);
    };
    const handlePwaReady = (e: any) => {
      setDeferredInstallPrompt(e.detail || (window as any).deferredPwaPrompt);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('flow:pwa_install_ready', handlePwaReady);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('flow:pwa_install_ready', handlePwaReady);
    };
  }, []);

  // Dynamic Orientation Detection (adapts layout when tablet is vertical vs horizontal)
  const [isPortrait, setIsPortrait] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerHeight > window.innerWidth;
  });

  useEffect(() => {
    const handleOrientationOrResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handleOrientationOrResize);
    window.addEventListener('orientationchange', handleOrientationOrResize);
    return () => {
      window.removeEventListener('resize', handleOrientationOrResize);
      window.removeEventListener('orientationchange', handleOrientationOrResize);
    };
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      const doc = document as any;
      const fsEl = doc.fullscreenElement || doc.webkitFullscreenElement || doc.webkitCurrentFullScreenElement;
      setIsFullscreen(Boolean(fsEl));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // FLOW Branch Mapping State
  const [commerceBranchLink, setCommerceBranchLink] = useState<CommerceBranchLink | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function resolveBranch() {
      const candidateBranch =
        currentUser?.branch ||
        localStorage.getItem('flow_pos_selected_branch') ||
        'Badaro';
      const { link } = await resolveCommerceBranchLink(candidateBranch, 'ovrload');
      if (!cancelled && link) {
        setCommerceBranchLink(link);
      }
    }
    resolveBranch();
    return () => { cancelled = true; };
  }, [currentUser]);

  // Branch & Restaurant Context (Unified with PosTerminalScreen)
  const restaurantId = useMemo(() => {
    return (
      commerceBranchLink?.restaurant_id ||
      currentUser?.restaurant_id ||
      getGlobalRestaurantId() ||
      localStorage.getItem('flow_pos_selected_restaurant') ||
      '79256f11-a9f8-4fec-901d-69baf929762d'
    );
  }, [commerceBranchLink, currentUser]);

  const branchId = useMemo(() => {
    return (
      commerceBranchLink?.flow_branch_id ||
      currentUser?.branch_id ||
      import.meta.env.VITE_DEFAULT_BRANCH_ID ||
      '9c214659-9cc7-4f33-b115-cbbb8a823a94'
    );
  }, [commerceBranchLink, currentUser]);

  const externalBranchId = useMemo(() => {
    return String(commerceBranchLink?.external_branch_id || '1');
  }, [commerceBranchLink]);

  const branchName = useMemo(() => {
    return commerceBranchLink?.flow_branch_name || currentUser?.branch || 'Badaro';
  }, [commerceBranchLink, currentUser]);

  // FLOW Shift Cash State & Bridge
  const { activeShift, isShiftOpen } = usePosShift(
    branchName,
    currentUser?.name || 'Waiter',
    undefined, // Waiters inherit the branch's active open shift
    branchId,
    restaurantId
  );

  // Load custom role permissions
  useEffect(() => {
    if (restaurantId) {
      setGlobalRestaurantId(restaurantId);
      loadRestaurantRolePermissions(restaurantId).catch(() => {});
    }
  }, [restaurantId]);

  // View state: 'floor' | 'ticket'
  const [view, setView] = useState<'floor' | 'ticket'>('floor');
  const [activeTableContext, setActiveTableContext] = useState<ActiveTableContext | null>(null);

  // Catalog & Screens State (matching POS Terminal matrix)
  const [categories, setCategories] = useState<PosCategory[]>([]);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [posScreens, setPosScreens] = useState<PosScreen[]>([]);
  const [currentScreenId, setCurrentScreenId] = useState<string>('root');
  const [screenStack, setScreenStack] = useState<string[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Table Ticket Items
  const [ticketItems, setTicketItems] = useState<TicketItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline +/- stepper editor state for quantity
  const [activeQtyEditorLineId, setActiveQtyEditorLineId] = useState<string | null>(null);

  // Supervisor Authorization Modal State
  const [supervisorAuthRequest, setSupervisorAuthRequest] = useState<SupervisorAuthRequest | null>(null);

  // Table Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [floorTables, setFloorTables] = useState<PosTable[]>([]);

  // Thermal Receipt Preview Modal State
  const [receiptPreviewData, setReceiptPreviewData] = useState<ThermalReceiptData | null>(null);
  const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);

  // Item modifier / customization modal state
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
  const [modifyingProduct, setModifyingProduct] = useState<any | null>(null);
  const [modifyingItemIndex, setModifyingItemIndex] = useState<number | null>(null);

  // Toast / Banner notice
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showNotification = useCallback((message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(prev => (prev?.message === message ? null : prev));
    }, 3500);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;

      if (isIOS) {
        if (isStandalone) {
          showNotification("You are already in full screen standalone mode!", "success");
          return;
        }
        alert(
          "📱 iPad Full Screen Mode:\n\n" +
          "Apple restricts third-party browsers (Chrome, Edge) from entering full screen directly.\n\n" +
          "To get permanent 100% full screen without address bars or tabs:\n" +
          "1. Open this POS link in Safari\n" +
          "2. Tap the Share button (square with arrow ↑ at top right)\n" +
          "3. Tap 'Add to Home Screen'\n\n" +
          "Tap the new FLOW POS icon from your iPad Home Screen to run in full kiosk mode!"
        );
        return;
      }

      const doc = document as any;
      const el = document.documentElement as any;
      const currentFs = doc.fullscreenElement || doc.webkitFullscreenElement || doc.webkitCurrentFullScreenElement;

      if (!currentFs) {
        if (typeof el.requestFullscreen === 'function') {
          await el.requestFullscreen().catch(() => {});
        } else if (typeof el.webkitRequestFullscreen === 'function') {
          el.webkitRequestFullscreen();
        } else if (typeof el.webkitRequestFullScreen === 'function') {
          el.webkitRequestFullScreen();
        } else {
          showNotification(
            "💡 Fullscreen is not supported by this browser. Use Safari 'Add to Home Screen' for full screen.",
            'info'
          );
        }
      } else {
        if (typeof doc.exitFullscreen === 'function') {
          await doc.exitFullscreen().catch(() => {});
        } else if (typeof doc.webkitExitFullscreen === 'function') {
          doc.webkitExitFullscreen();
        } else if (typeof doc.webkitCancelFullScreen === 'function') {
          doc.webkitCancelFullScreen();
        }
      }
    } catch (e) {
      console.warn('Fullscreen toggle failed:', e);
      showNotification(
        "💡 Fullscreen toggle not supported on this browser.",
        'info'
      );
    }
  }, [showNotification]);

  // Fetch Floor Tables for Transfer destination picking
  const refreshFloorTablesList = useCallback(async () => {
    if (!branchId) return;
    try {
      const res = await loadFloorState(branchId);
      if (res?.tables) {
        setFloorTables(res.tables);
      }
    } catch (e) {
      console.warn('Could not load floor tables:', e);
    }
  }, [branchId]);

  useEffect(() => {
    refreshFloorTablesList();
  }, [refreshFloorTablesList]);

  // Fetch Catalog & Screen Layout
  useEffect(() => {
    let mounted = true;
    const loadCatalogAndScreens = async () => {
      try {
        setCatalogLoading(true);
        const data = await fetchPosCatalog(restaurantId, branchId);
        const screens = await fetchPosScreens(restaurantId, data.categories || [], data.products || []);
        if (mounted) {
          setCategories(data.categories || []);
          setProducts(data.products || []);
          setPosScreens(screens || []);
          const root = (screens || []).find(s => s.isRoot) || screens?.[0];
          if (root) setCurrentScreenId(root.id);
        }
      } catch (err) {
        console.warn('Failed to load POS catalog and screens:', err);
      } finally {
        if (mounted) setCatalogLoading(false);
      }
    };
    loadCatalogAndScreens();
    return () => {
      mounted = false;
    };
  }, [restaurantId, branchId]);

  // Screen Matrix Helpers (same as POS)
  const activePosScreen = useMemo(() => {
    if (!posScreens || posScreens.length === 0) return null;
    return posScreens.find(s => s.id === currentScreenId) || posScreens.find(s => s.isRoot) || posScreens[0];
  }, [posScreens, currentScreenId]);

  const activeGridConfig = useMemo(() => {
    const btnCount = activePosScreen?.buttons?.length || 0;

    if (isPortrait) {
      // In Vertical (Portrait) Tablet Orientation:
      // Limit to 2 or 3 columns so buttons remain wide enough for dish titles.
      let cols = 3;
      if (btnCount <= 6) cols = 2;
      else if (btnCount <= 12) cols = 3;
      else cols = 3;

      const rows = Math.ceil(btnCount / cols) || 1;
      return { cols, rows, totalSlots: cols * rows };
    }

    // In Horizontal (Landscape) Orientation:
    return calculateDynamicGrid(
      btnCount,
      activePosScreen?.gridCols,
      activePosScreen?.gridRows
    );
  }, [activePosScreen, isPortrait]);

  const activeGridDensity = useMemo(() => {
    if (isPortrait) {
      // Portrait density: compact padding, controlled font size so text never overflows
      return {
        padding: 'p-2',
        fontSize: 'text-xs sm:text-sm font-black',
        minHeight: 'min-h-[64px]',
        gap: '0.45rem'
      };
    }

    if (activeGridConfig.cols >= 6) {
      return {
        padding: 'p-2',
        fontSize: 'text-xs md:text-sm font-black',
        minHeight: 'min-h-[64px]',
        gap: '0.45rem'
      };
    }
    if (activeGridConfig.cols >= 5) {
      return {
        padding: 'p-2.5',
        fontSize: 'text-sm md:text-base font-black',
        minHeight: 'min-h-[74px]',
        gap: '0.55rem'
      };
    }
    return {
      padding: 'p-3',
      fontSize: 'text-sm md:text-base font-black',
      minHeight: 'min-h-[82px]',
      gap: '0.65rem'
    };
  }, [activeGridConfig, isPortrait]);

  const handleNavigateToSubscreen = (targetScreenId?: string) => {
    if (!targetScreenId) return;
    setScreenStack(prev => [...prev, currentScreenId]);
    setCurrentScreenId(targetScreenId);
  };

  const handleNavigateBack = () => {
    if (screenStack.length === 0) return;
    const prev = [...screenStack];
    const target = prev.pop();
    setScreenStack(prev);
    if (target) setCurrentScreenId(target);
  };

  // Check if active table belongs to someone else
  const isOtherWaiterTable = useMemo(() => {
    if (!activeTableContext) return false;
    if (!activeTableContext.waiterName || activeTableContext.waiterName === 'Cashier' || activeTableContext.waiterName === 'Staff') {
      return false;
    }
    return activeTableContext.waiterName.toLowerCase().trim() !== (currentUser?.name || '').toLowerCase().trim();
  }, [activeTableContext, currentUser]);

  // ─────────────────────────────────────────────────────────────
  // Action Handlers
  // ─────────────────────────────────────────────────────────────

  // Table Selection from Floor Plan
  const handleOpenTableOrder = async (
    orderId: number | null,
    tableCode: string,
    sessionId?: string,
    guestCount?: number,
    waiterName?: string,
    tableId?: string,
    isNewlyCreated?: boolean
  ) => {
    const isOther = waiterName && waiterName !== 'Cashier' && waiterName.toLowerCase().trim() !== (currentUser?.name || '').toLowerCase().trim();
    if (isOther && orderId) {
      if (!hasPosPermission(currentUser, 'view_other_tables') && !hasPosPermission(currentUser, 'view_all_tables')) {
        showNotification(`You do not have permission to view tables assigned to ${waiterName}.`, 'error');
        return;
      }
    }

    const tableCtx: ActiveTableContext = {
      orderId: orderId || null,
      tableCode,
      sessionId: sessionId || null,
      guestCount: guestCount || 1,
      waiterName: waiterName || currentUser?.name || 'Waiter',
      tableId: tableId || null,
      isNewlyCreated: Boolean(isNewlyCreated),
      isExistingOccupied: Boolean(orderId)
    };

    setActiveTableContext(tableCtx);
    setTicketItems([]);
    setView('ticket');

    // Reset screen navigation to root
    const root = posScreens.find(s => s.isRoot) || posScreens[0];
    if (root) {
      setScreenStack([]);
      setCurrentScreenId(root.id);
    }

    // Load existing items if occupied or active order exists
    try {
      const ord = await fetchOrderWithItems(orderId, tableCode, restaurantId);

      if (ord) {
        if (ord.id && !tableCtx.orderId) {
          tableCtx.orderId = ord.id;
          tableCtx.isExistingOccupied = true;
          setActiveTableContext({ ...tableCtx });
        }
        const rawItems = ord.items || ord.pos_order_items || [];
        const mapped: TicketItem[] = rawItems.map((i: any) => {
            const rawName = String(i.product_name || i.name || '').trim();
            const isHold =
              Boolean(i.isHoldSeparator) ||
              String(i.product_id || '').startsWith('hold_') ||
              rawName.toUpperCase() === 'HOLD' ||
              rawName.toUpperCase().includes('HOLD FOR NEXT COURSE') ||
              rawName.toUpperCase() === '--- HOLD ---';

            const itemQty = Number(i.quantity || i.qty) || 1;
            return {
              line_item_id: i.line_item_id || String(i.id || Math.random()),
              order_item_id: i.id,
              product_id: isHold ? (i.product_id || 'hold_separator_' + Date.now()) : (i.product_id || i.id),
              name: isHold ? 'HOLD' : (i.product_name || i.name),
              unit_price: isHold ? 0 : (Number(i.unit_price) || 0),
              qty: itemQty,
              originalQty: !isHold ? itemQty : 0,
              selectedCustomizations: i.customizations || [],
              note: i.comment || i.note || '',
              isHoldSeparator: isHold,
              isOrdered: !isHold,
              item_added_by: i.item_added_by || ord.waiter_reference || 'Waiter',
              item_added_by_id: i.item_added_by_id || null
            };
          });
          setTicketItems(mapped);
        }
      } catch (err) {
        console.error('Failed to load table items:', err);
        showNotification('Failed to load table items.', 'error');
      }
    };

  // Add Item to Ticket (triggered from touch matrix button)
  const handleTouchButtonPress = (btn: PosScreenButton) => {
    if (btn.type === 'screen') {
      handleNavigateToSubscreen(btn.targetScreenId);
    } else {
      const prod = products.find(p => String(p.id) === String(btn.productId)) ||
                   products.find(p => (p.name || '').trim().toLowerCase() === (btn.label || '').trim().toLowerCase());
      if (!prod || (prod as any).is_active === false || ['deleted', 'archived'].includes(String((prod as any).status || '').toLowerCase())) {
        showNotification(`⚠️ "${btn.label}" is deleted or not found in the catalog.`, 'error');
        return;
      }
      handleAddItem(prod);
    }
  };

  const handleAddItem = (product: PosProduct | { id: any; name: string; unit_price_usd: number; customizations?: any[] }) => {
    if (!product || (product as any).is_active === false || ['deleted', 'archived'].includes(String((product as any).status || '').toLowerCase())) {
      showNotification(`⚠️ This product is deleted or unavailable.`, 'error');
      return;
    }
    if (isOtherWaiterTable) {
      if (!hasPosPermission(currentUser, 'add_items_to_other_tables')) {
        setSupervisorAuthRequest({
          actionKey: 'add_items_to_other_tables',
          actionTitle: `Add Items to Table ${activeTableContext?.tableCode} (${activeTableContext?.waiterName})`,
          tableNumber: activeTableContext?.tableCode,
          orderId: activeTableContext?.orderId,
          onAuthorized: () => {
            triggerAddItemOrModifier(product);
          }
        });
        return;
      }
    }

    triggerAddItemOrModifier(product);
  };

  const triggerAddItemOrModifier = (product: PosProduct | { id: any; name: string; unit_price_usd: number; customizations?: any[] }) => {
    // If product has modifier groups, open the Modifier Modal immediately
    if (product.customizations && product.customizations.length > 0) {
      setModifyingProduct(product);
      setModifyingItemIndex(null);
      setIsModifierModalOpen(true);
      return;
    }

    // Direct add or increment if no modifiers
    doAddItem(product);
  };

  const doAddItem = (product: PosProduct | { id: any; name: string; unit_price_usd: number }) => {
    // If user clicks on product menu again, it increments qty!
    const existingIndex = ticketItems.findIndex(
      it => !it.isOrdered && !it.isHoldSeparator && String(it.product_id) === String(product.id) && !it.note
    );

    if (existingIndex > -1) {
      const updated = [...ticketItems];
      updated[existingIndex].qty += 1;
      setTicketItems(updated);
    } else {
      const newLineId = 'line-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      const newItem: TicketItem = {
        line_item_id: newLineId,
        product_id: product.id,
        name: product.name,
        unit_price: product.unit_price_usd || 0,
        qty: 1,
        selectedCustomizations: [],
        note: '',
        isOrdered: false,
        item_added_by: currentUser?.name || 'Waiter',
        item_added_by_id: currentUser?.id || null
      };
      setTicketItems(prev => [...prev, newItem]);
    }
  };

  // Add Hold / Course Break separator
  const handleAddHoldSeparator = () => {
    if (ticketItems.length === 0) {
      showNotification('Add course items before adding a course break.', 'error');
      return;
    }

    const lastItem = ticketItems[ticketItems.length - 1];
    if (lastItem?.isHoldSeparator) {
      showNotification('A Hold break is already placed at this position.', 'error');
      return;
    }

    const holdLine: TicketItem = {
      line_item_id: 'hold_' + Date.now(),
      product_id: 'hold_separator_' + Date.now(),
      name: 'HOLD',
      unit_price: 0,
      qty: 1,
      isHoldSeparator: true,
      note: 'Kitchen waits for fire',
      isOrdered: false
    };

    setTicketItems(prev => [...prev, holdLine]);
  };

  // Adjust item quantity
  const handleUpdateQty = (index: number, delta: number) => {
    const item = ticketItems[index];
    if (!item) return;

    if (item.isHoldSeparator) {
      setTicketItems(prev => prev.filter((_, i) => i !== index));
      return;
    }

    const originalQty = Number(item.originalQty !== undefined ? item.originalQty : (item.isOrdered && activeTableContext?.orderId ? item.qty : 0));

    if (delta < 0) {
      const newQty = item.qty + delta;
      // Only require supervisor void if trying to reduce below already placed original quantity!
      if (originalQty > 0 && newQty < originalQty) {
        const canVoid = hasPosPermission(currentUser, 'void_sent_items');
        if (!canVoid) {
          setSupervisorAuthRequest({
            actionKey: 'void_sent_items',
            actionTitle: `Void Sent Item: ${item.name}`,
            tableNumber: activeTableContext?.tableCode,
            orderId: activeTableContext?.orderId,
            previousValue: item.qty,
            newValue: item.qty - 1,
            requireReason: true,
            defaultReason: 'Customer changed mind',
            onAuthorized: () => {
              executeVoidSentItem(index);
            }
          });
          return;
        } else {
          executeVoidSentItem(index);
          return;
        }
      }

      // Decrement unplaced draft quantity freely
      applyDraftQtyChange(index, delta);
      return;
    }

    if (isOtherWaiterTable && !hasPosPermission(currentUser, 'edit_other_tables')) {
      setSupervisorAuthRequest({
        actionKey: 'edit_other_tables',
        actionTitle: `Modify Order on Table ${activeTableContext?.tableCode}`,
        tableNumber: activeTableContext?.tableCode,
        orderId: activeTableContext?.orderId,
        onAuthorized: () => {
          applyDraftQtyChange(index, delta);
        }
      });
      return;
    }

    applyDraftQtyChange(index, delta);
  };

  const applyDraftQtyChange = (index: number, delta: number) => {
    const updated = [...ticketItems];
    const newQty = updated[index].qty + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
      setActiveQtyEditorLineId(null);
    } else {
      updated[index].qty = newQty;
    }
    setTicketItems(updated);
  };

  const executeVoidSentItem = (index: number) => {
    const updated = [...ticketItems];
    if (updated[index].qty > 1) {
      updated[index].qty -= 1;
    } else {
      updated.splice(index, 1);
      setActiveQtyEditorLineId(null);
    }
    setTicketItems(updated);
    showNotification(`Voided item: ${ticketItems[index]?.name}`, 'info');
  };

  // Fire Next Course Chit
  const handleFireCourse = async () => {
    if (!activeTableContext?.orderId) {
      showNotification('Please send the order to kitchen before firing courses.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const printUrl = `http://192.168.18.195:9191/print`;
      const firePayload = {
        isKitchenTicket: true,
        isKitchenFire: true,
        title: '*** FIRE NEXT COURSE ***',
        order_type: 'dine_in',
        table_label: activeTableContext.tableCode,
        guest_count: activeTableContext.guestCount,
        waiter_name: currentUser?.name || 'Waiter',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        items: [{ name: '🔥 FIRE NEXT COURSE', qty: 1, note: `Table ${activeTableContext.tableCode}` }]
      };

      try {
        await fetch(printUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(firePayload),
          signal: safeTimeoutSignal(2000)
        });
      } catch (e) {
        console.warn('Printer fire round network warning:', e);
      }

      showNotification(`🔥 Fire chit sent to kitchen for Table ${activeTableContext.tableCode}!`, 'success');
    } catch (err) {
      console.error('Error firing course:', err);
      showNotification('Failed to fire course.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Print Pre-Check Bill
  const handlePrintBill = async () => {
    if (!hasPosPermission(currentUser, 'print_bill')) {
      showNotification('Your role does not have permission to print customer bills.', 'error');
      return;
    }

    if (!activeTableContext) return;

    try {
      setIsSubmitting(true);
      if (activeTableContext.sessionId) {
        await requestBill(activeTableContext.sessionId).catch(() => {});
      }

      // Load cached receipt settings or fallbacks
      const restoName = localStorage.getItem('flow_pos_restaurant_name') || 'Neo Beirut';
      const legalName = localStorage.getItem('flow_pos_company_legal_name') || 'Neo Beirut S.A.L.';
      const mofNum = localStorage.getItem('flow_pos_mof_number') || '382910-601';
      const footerMsg = localStorage.getItem('flow_pos_receipt_footer') || 'Thank you for dining with us! Come back soon.';
      const rateNum = Number(localStorage.getItem('flow_pos_exchange_rate')) || 89500;

      // Calculate totals and format items with prices, notes, and customizations
      let subtotal = 0;
      const validItems = ticketItems.filter(i => !i.isHoldSeparator).map(i => {
        const lineTotal = (Number(i.unit_price) || 0) * (Number(i.qty) || 1);
        subtotal += lineTotal;
        return {
          name: i.name,
          qty: Number(i.qty) || 1,
          unit_price: Number(i.unit_price) || 0,
          price: Number(i.unit_price) || 0,
          total_price: lineTotal,
          selectedCustomizations: i.selectedCustomizations || [],
          customizations: i.selectedCustomizations || [],
          note: i.note || ''
        };
      });

      const printUrl = `http://192.168.18.195:9191/print`;
      const billPayload = {
        isPreCheck: true,
        title: '*** GUEST CHECK / BILL ***',
        id: activeTableContext.orderId || `Table-${activeTableContext.tableCode}`,
        table_code: activeTableContext.tableCode,
        table_label: activeTableContext.tableCode,
        guest_count: activeTableContext.guestCount || 1,
        waiter_name: activeTableContext.waiterName || currentUser?.name || 'Waiter',
        served_by: activeTableContext.waiterName || currentUser?.name || 'Waiter',
        server_name: activeTableContext.waiterName || currentUser?.name || 'Waiter',
        restaurant_name: restoName,
        company_legal_name: legalName,
        mof_number: mofNum,
        exchange_rate: rateNum,
        subtotal_amount: subtotal,
        total_amount: subtotal,
        order_source: 'Dine In',
        order_type: 'dine_in',
        footer_message: footerMsg,
        items: validItems
      };

      setReceiptPreviewData(billPayload as ThermalReceiptData);
      setIsReceiptPreviewOpen(true);

      // Multi-Printer Architecture: Dispatch exclusively to designated Main Bill Printer
      try {
        const billJob = await buildMainBillPrintJob({
          order: {
            id: activeTableContext.orderId || `Table-${activeTableContext.tableCode}`,
            order_id: activeTableContext.orderId || `Table-${activeTableContext.tableCode}`,
            table_label: activeTableContext.tableCode,
            table_code: activeTableContext.tableCode,
            guest_count: activeTableContext.guestCount || 1,
            waiter_name: activeTableContext.waiterName || currentUser?.name || 'Waiter',
            cashier_name: currentUser?.name || 'Waiter',
            subtotal,
            total: subtotal,
            currency: 'USD',
            exchange_rate: rateNum,
            items: validItems
          },
          isPreCheck: true,
          branchId: branchId || undefined,
          restaurantId: restaurantId || undefined,
          footerText: footerMsg
        });

        if (billJob) {
          await dispatchPhysicalPrintJobs([billJob]);
        }
      } catch (e) {
        console.warn('Bill print dispatch warning:', e);
      }

      showNotification(`🧾 Pre-check bill printed for Table ${activeTableContext.tableCode}`, 'success');
    } catch (err) {
      console.error('Failed to print bill:', err);
      showNotification('Failed to print bill.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Print Pre-Check Bill from Floor Table Card
  const handlePrintPreCheckDoc = async (table: PosTable) => {
    if (!hasPosPermission(currentUser, 'print_bill')) {
      showNotification('Your role does not have permission to print customer bills.', 'error');
      return;
    }

    try {
      if (table.current_session_id) {
        await requestBill(table.current_session_id).catch(() => {});
      }

      const restoName = localStorage.getItem('flow_pos_restaurant_name') || 'Neo Beirut';
      const legalName = localStorage.getItem('flow_pos_company_legal_name') || 'Neo Beirut S.A.L.';
      const mofNum = localStorage.getItem('flow_pos_mof_number') || '382910-601';
      const footerMsg = localStorage.getItem('flow_pos_receipt_footer') || 'Thank you for dining with us! Come back soon.';
      const rateNum = Number(localStorage.getItem('flow_pos_exchange_rate')) || 89500;

      let ord: any = null;
      const orderId = table.commerce_order_id;
      if (orderId) {
        const { data } = await supabase
          .from('pos_orders')
          .select('*, items:pos_order_items(*)')
          .eq('id', orderId)
          .maybeSingle();
        ord = data;
      }

      let subtotal = 0;
      let itemsList: any[] = [];

      if (ord?.items && ord.items.length > 0) {
        itemsList = ord.items.map((it: any) => {
          const lineTotal = Number(it.total_price !== undefined ? it.total_price : (Number(it.unit_price || 0) * Number(it.quantity || 1)));
          subtotal += lineTotal;
          let parsedCusts = [];
          try {
            if (it.customizations_json) parsedCusts = JSON.parse(it.customizations_json);
            else if (typeof it.customizations === 'string') parsedCusts = it.customizations.split(',').map((s: string) => s.trim());
            else if (Array.isArray(it.customizations)) parsedCusts = it.customizations;
          } catch (e) {}

          return {
            name: it.product_name || it.name,
            qty: Number(it.quantity || 1),
            unit_price: Number(it.unit_price || 0),
            price: Number(it.unit_price || 0),
            total_price: lineTotal,
            selectedCustomizations: parsedCusts,
            customizations: parsedCusts,
            note: it.comment || it.note || ''
          };
        });
      } else if (activeTableContext?.tableCode === table.table_code && ticketItems.length > 0) {
        itemsList = ticketItems.filter(i => !i.isHoldSeparator).map(i => {
          const lineTotal = (Number(i.unit_price) || 0) * (Number(i.qty) || 1);
          subtotal += lineTotal;
          return {
            name: i.name,
            qty: Number(i.qty) || 1,
            unit_price: Number(i.unit_price) || 0,
            price: Number(i.unit_price) || 0,
            total_price: lineTotal,
            selectedCustomizations: i.selectedCustomizations || [],
            customizations: i.selectedCustomizations || [],
            note: i.note || ''
          };
        });
      }

      const total = Number(ord?.total_amount || ord?.total || subtotal);

      const billPayload = {
        isPreCheck: true,
        title: '*** GUEST CHECK / BILL ***',
        id: ord?.id || `Table-${table.table_code}`,
        table_code: table.table_code,
        table_label: table.table_code,
        guest_count: table.guest_count || 1,
        waiter_name: table.assigned_waiter || currentUser?.name || 'Waiter',
        served_by: table.assigned_waiter || currentUser?.name || 'Waiter',
        server_name: table.assigned_waiter || currentUser?.name || 'Waiter',
        restaurant_name: restoName,
        company_legal_name: legalName,
        mof_number: mofNum,
        exchange_rate: rateNum,
        subtotal_amount: subtotal,
        total_amount: total,
        order_source: 'Dine In',
        order_type: 'dine_in',
        footer_message: footerMsg,
        items: itemsList
      };

      setReceiptPreviewData(billPayload as ThermalReceiptData);
      setIsReceiptPreviewOpen(true);

      // Multi-Printer Architecture: Dispatch exclusively to designated Main Bill Printer
      try {
        const billJob = await buildMainBillPrintJob({
          order: {
            id: ord?.id || `Table-${table.table_code}`,
            order_id: ord?.id || `Table-${table.table_code}`,
            table_label: table.table_code,
            table_code: table.table_code,
            guest_count: table.guest_count || 1,
            waiter_name: table.assigned_waiter || currentUser?.name || 'Waiter',
            cashier_name: currentUser?.name || 'Waiter',
            subtotal,
            total,
            currency: ord?.currency || 'USD',
            exchange_rate: rateNum,
            items: itemsList
          },
          isPreCheck: true,
          branchId: branchId || undefined,
          restaurantId: restaurantId || undefined,
          footerText: footerMsg
        });

        if (billJob) {
          await dispatchPhysicalPrintJobs([billJob]);
        }
      } catch (e) {
        console.warn('Bill print dispatch warning:', e);
      }

      showNotification(`🧾 Pre-check bill printed for Table ${table.table_code}`, 'success');
      await refreshFloorTablesList();
    } catch (err: any) {
      console.error('Failed to print pre-check bill:', err);
      showNotification(`Print failed: ${err.message || 'Unknown error'}`, 'error');
    }
  };

  // Send Order to Kitchen (KOT)
  const handleSendToKitchen = async () => {
    if (ticketItems.length === 0) {
      showNotification('Cart is empty. Add items before sending.', 'error');
      return;
    }

    if (!hasPosPermission(currentUser, 'send_to_kitchen')) {
      showNotification('You do not have permission to send orders to the kitchen.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const orderPayload = {
        branch_id: branchId,
        restaurant_id: restaurantId,
        orderType: 'dine_in',
        service_type: 'dine_in',
        table_label: activeTableContext?.tableCode,
        guest_count: activeTableContext?.guestCount || 1,
        waiter_reference: activeTableContext?.waiterName || currentUser?.name || 'Waiter',
        cashierName: currentUser?.name || 'Waiter',
        orderSource: 'POS',
        paymentMethod: 'Cash',
        status: 'held',
        subtotal: 0,
        total: 0,
        items: ticketItems.map(item => ({
          line_item_id: item.line_item_id,
          product_id: item.product_id,
          name: item.name,
          quantity: item.qty,
          unit_price: item.unit_price,
          customizations: item.selectedCustomizations || [],
          comment: item.note || '',
          item_added_by: item.item_added_by || currentUser?.name || 'Waiter',
          item_added_by_id: item.item_added_by_id || currentUser?.id || null
        }))
      };

      let targetOrderId = activeTableContext?.orderId;
      if (targetOrderId) {
        if (COMMERCE_API_BASE && /^\d+$/.test(String(targetOrderId))) {
          try {
            await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${targetOrderId}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: 'held',
                items: orderPayload.items
              })
            });
          } catch (e) {
            console.warn('Commerce API status update warning from waiter screen:', e);
          }
        }
        await updateDirectOrderStatus(targetOrderId, {
          items: orderPayload.items
        });
      } else {
        const createRes = await createDirectOrder(orderPayload);
        if (!createRes.success) {
          throw new Error(createRes.error || 'Failed to create dine-in table order');
        }
        targetOrderId = createRes.order?.id || createRes.orderId;
      }

      // Link table session
      if (activeTableContext?.sessionId && targetOrderId) {
        await supabase
          .from('pos_table_sessions')
          .update({
            commerce_order_id: targetOrderId,
            status: 'occupied',
            sync_status: 'synced',
            last_sync_error: null
          })
          .eq('id', activeTableContext.sessionId);
      }

      // Send Chits to Preparation Printers: Intelligent multi-printer routing & bundle expansion
      const unprintedItems: any[] = [];
      for (const it of ticketItems) {
        if (isCourseHoldItem(it)) continue;
        const orig = Number(it.originalQty || 0);
        if (!it.isOrdered || orig === 0) {
          unprintedItems.push(it);
        } else if (it.qty > orig) {
          unprintedItems.push({
            ...it,
            qty: it.qty - orig
          });
        }
      }
      if (unprintedItems.length > 0) {
        try {
          const { jobs, unroutedCount, excludedNoPrintCount } = await buildPreparationPrintJobs({
            orderMetadata: {
              order_id: targetOrderId || `Table-${activeTableContext?.tableCode}`,
              table_label: activeTableContext?.tableCode,
              table_code: activeTableContext?.tableCode,
              guest_count: activeTableContext?.guestCount || 1,
              waiter_name: currentUser?.name || 'Waiter',
              service_type: 'dine_in'
            },
            items: unprintedItems,
            branchId: branchId || undefined,
            restaurantId: restaurantId || undefined,
            productsCatalog: products
          });

          if (jobs.length > 0) {
            const dispatchRes = await dispatchPhysicalPrintJobs(jobs);
            if (!dispatchRes.success) {
              console.warn('Some preparation printer jobs failed:', dispatchRes.results);
            }
          }
        } catch (e) {
          console.warn('Preparation printer ticket dispatch error:', e);
        }
      }

      setTicketItems(prev => prev.map(it => ({ ...it, isOrdered: true, originalQty: it.qty })));
      showNotification(`📤 Order sent to kitchen for Table ${activeTableContext?.tableCode}!`, 'success');

      // Return immediately to table selection page
      setView('floor');
      setActiveTableContext(null);
      setTicketItems([]);
    } catch (err: any) {
      console.error('Failed to send order to kitchen:', err);
      showNotification(err?.message || 'Error sending order to kitchen.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Save from Step-by-Step Modifier Modal
  const handleSaveModifierModal = (result: {
    selectedCustomizations: any[];
    note: string;
    qty: number;
    unitPrice: number;
  }) => {
    if (!modifyingProduct) return;

    if (modifyingItemIndex !== null) {
      // Editing existing line item in ticket
      const updated = [...ticketItems];
      const existing = updated[modifyingItemIndex];
      if (existing) {
        updated[modifyingItemIndex] = {
          ...existing,
          selectedCustomizations: result.selectedCustomizations,
          note: result.note,
          qty: result.qty,
          unit_price: result.unitPrice
        };
        setTicketItems(updated);
      }
    } else {
      // Adding new customized item
      const newLineId = 'line-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      const newItem: TicketItem = {
        line_item_id: newLineId,
        product_id: modifyingProduct.id,
        name: modifyingProduct.name,
        unit_price: result.unitPrice,
        qty: result.qty || 1,
        selectedCustomizations: result.selectedCustomizations,
        note: result.note,
        isHoldSeparator: false,
        isOrdered: false,
        item_added_by: currentUser?.name || 'Waiter',
        item_added_by_id: currentUser?.id || null
      };
      setTicketItems(prev => [...prev, newItem]);
    }

    setIsModifierModalOpen(false);
    setModifyingProduct(null);
    setModifyingItemIndex(null);
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER: Lock Screen Overlay (Instant Fast Handover)
  // ─────────────────────────────────────────────────────────────
  if (isLocked) {
    return (
      <PosPinScreen
        isLockScreen={true}
        initialRestaurantId={restaurantId}
        onCancel={() => {
          localStorage.removeItem('flow_pos_locked');
          setIsLocked(false);
        }}
        onLogout={() => {
          localStorage.removeItem('flow_pos_locked');
          onExit?.();
        }}
        onSuccess={(unlockedUser: any) => {
          localStorage.removeItem('flow_pos_locked');
          setIsLocked(false);
          const norm = normalizePosRole(unlockedUser?.role);
          if (norm === 'waiter') {
            setCurrentUser(unlockedUser);
            showNotification(`Welcome, ${unlockedUser.name}!`, 'success');
          } else {
            // Cashier or Manager unlocked: route to POS
            window.location.hash = '#/pos';
          }
        }}
      />
    );
  }

  return (
    <div
      onClick={() => setActiveQtyEditorLineId(null)}
      className="flex flex-col h-screen w-screen bg-[#F5F6F4] text-[#242B28] select-none overflow-hidden font-sans"
    >
      {/* ─────────────────────────────────────────────────────────────
          TOP TABLET HEADER BAR
      ───────────────────────────────────────────────────────────── */}
      <header className="h-16 bg-white border-b border-[#E0E3DF] px-4 flex items-center justify-between shrink-0 shadow-sm z-30">
        {/* Left: Brand / View Navigation */}
        <div className="flex items-center gap-3">
          {view === 'ticket' ? (
            <button
              type="button"
              onClick={() => {
                setView('floor');
                setActiveTableContext(null);
                setTicketItems([]);
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F5F6F4] hover:bg-slate-200 text-[#242B28] border border-[#E0E3DF] text-sm font-semibold transition active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" style={{ color: primaryColor }} />
              <span>Floor Plan</span>
            </button>
          ) : (
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center border shadow-sm"
                style={{ backgroundColor: '#E9F4ED', color: primaryColor, borderColor: `${primaryColor}40` }}
              >
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-black text-[#242B28] tracking-wide flex items-center gap-2">
                  <span>FLOW WAITER</span>
                  <span
                    className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full border"
                    style={{ backgroundColor: '#E9F4ED', color: primaryColor, borderColor: `${primaryColor}40` }}
                  >
                    Tablet
                  </span>
                </div>
                <div className="text-[11px] text-[#5E6964] font-medium">{branchName}</div>
              </div>
            </div>
          )}

          {/* Table Indicator in Ticket Mode */}
          {view === 'ticket' && activeTableContext && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-sm"
              style={{ backgroundColor: '#E9F4ED', borderColor: `${primaryColor}40` }}
            >
              <span className="text-xs font-black uppercase tracking-wider" style={{ color: primaryColor }}>
                {activeTableContext.tableCode ? (
                  activeTableContext.tableCode.toLowerCase().startsWith('table')
                    ? activeTableContext.tableCode
                    : `Table ${activeTableContext.tableCode.replace(/^[Tt]/, '')}`
                ) : 'Table'}
              </span>
              <span className="text-[#5E6964]">•</span>
              <span className="text-xs font-semibold text-[#5E6964]">
                {activeTableContext.guestCount} Guests
              </span>
              {isOtherWaiterTable && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-300">
                  Assigned: {activeTableContext.waiterName}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Controls & Server Identity */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* PWA Install Button */}
          <button
            type="button"
            onClick={() => setIsInstallModalOpen(true)}
            className="px-2.5 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-sm hover:opacity-90"
            style={{ backgroundColor: '#E9F4ED', color: primaryColor, borderColor: `${primaryColor}40` }}
            title="Install Waiter POS App (Add to Home Screen)"
          >
            <Smartphone className="w-4 h-4" />
            <span className="hidden md:inline font-black">Install App</span>
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-[#F5F6F4] hover:bg-slate-200 text-[#242B28] border border-[#E0E3DF] transition active:scale-95 cursor-pointer"
            title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" style={{ color: primaryColor }} /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* Waiter Profile Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F5F6F4] border border-[#E0E3DF]">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs border shadow-sm"
              style={{ backgroundColor: primaryColor, color: primaryText, borderColor: `${primaryColor}50` }}
            >
              {(currentUser?.name || 'W').slice(0, 2).toUpperCase()}
            </div>
            <div className="text-left hidden lg:block leading-tight">
              <div className="text-xs font-bold text-[#242B28]">{currentUser?.name || 'Waiter'}</div>
              <div className="text-[10px] font-bold capitalize" style={{ color: primaryColor }}>
                {currentUser?.role || 'Waiter'}
              </div>
            </div>
          </div>

          {/* Quick KDS Button */}
          <button
            type="button"
            onClick={() => { window.location.hash = '#/kds'; }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F5F6F4] hover:bg-slate-200 text-[#242B28] border border-[#E0E3DF] text-xs font-bold transition active:scale-95 cursor-pointer"
            title="View Kitchen Display System (KDS)"
          >
            <span>🍳</span>
            <span className="hidden sm:inline">KDS</span>
          </button>

          {/* Quick Lock Button */}
          <button
            type="button"
            onClick={() => {
              localStorage.setItem('flow_pos_locked', 'true');
              setIsLocked(true);
              window.dispatchEvent(new Event('flow:pos_lock'));
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition active:scale-95 cursor-pointer"
            title="Lock screen for next server"
          >
            <Lock className="w-4 h-4" />
            <span className="hidden sm:inline">Lock</span>
          </button>

          {/* Sign Out */}
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700/80 transition cursor-pointer"
              title="Sign Out completely"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Toast Notification */}
      {notification && (
        <div
          className={`absolute top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border text-sm font-semibold transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            notification.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-600/50 shadow-rose-950/50'
              : notification.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-600/50 shadow-emerald-950/50'
              : 'bg-slate-900/90 text-slate-200 border-slate-700 shadow-slate-950/50'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MAIN CONTENT: FLOOR PLAN OR TABLE TICKET
      ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {view === 'floor' ? (
          /* ── VIEW 1: FLOOR PLAN (TABLE SELECTION) ── */
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F5F6F4]">
            <TablesScreen
              branchId={branchId}
              branchName={branchName}
              restaurantId={restaurantId}
              externalBranchId={externalBranchId}
              cashierName={currentUser?.name || 'Waiter'}
              isShiftOpen={isShiftOpen}
              activeShift={activeShift}
              canOpenNewTables={hasPosPermission(currentUser, 'open_table')}
              isTableAdmin={
                hasPosPermission(currentUser, 'override_order_restrictions') ||
                hasPosPermission(currentUser, 'transfer_table')
              }
              onOpenOrderInCart={handleOpenTableOrder}
              onPrintPreCheckDoc={table => {
                handlePrintPreCheckDoc(table);
              }}
            />
          </div>
        ) : (
          /* ── VIEW 2: TABLE TICKET & POS SCREEN MATRIX ── */
          <div className="flex-1 flex h-full overflow-hidden">
            {/* ── LEFT PANEL (Adapts to Tablet Direction): Screen Matrix ── */}
            <div className={`${isPortrait ? 'w-[58%]' : 'w-[65%]'} flex flex-col h-full bg-[#F5F6F4] border-r border-[#E0E3DF] transition-all duration-150`}>
              {/* Screen Matrix Header & Breadcrumb */}
              <div className="h-12 bg-white border-b border-[#E0E3DF] px-3.5 flex items-center justify-between shrink-0 shadow-sm">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  {screenStack.length > 0 && (
                    <button
                      type="button"
                      onClick={handleNavigateBack}
                      className="p-1 rounded-lg bg-[#F5F6F4] hover:bg-slate-200 text-[#242B28] border border-[#E0E3DF] active:scale-95 transition mr-1 cursor-pointer shrink-0"
                      title="Back to previous screen"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const root = posScreens.find(s => s.isRoot) || posScreens[0];
                      if (root) {
                        setScreenStack([]);
                        setCurrentScreenId(root.id);
                      }
                    }}
                    style={{ color: activePosScreen?.isRoot ? primaryColor : '#5E6964' }}
                    className={`font-black text-xs uppercase tracking-wider transition cursor-pointer shrink-0 hover:opacity-80`}
                  >
                    Main Menu
                  </button>
                  {activePosScreen && !activePosScreen.isRoot && (
                    <>
                      <span className="text-[#5E6964] font-bold text-xs shrink-0">/</span>
                      <span
                        style={{ color: primaryColor }}
                        className="font-black text-xs uppercase tracking-wider truncate max-w-[120px] sm:max-w-[200px]"
                      >
                        {activePosScreen.name}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Dynamic Grid Matrix: Automatically adapts columns and font to tablet direction */}
              <div className="flex-1 p-2 sm:p-3 overflow-y-auto bg-[#F5F6F4]">
                {catalogLoading ? (
                  <div className="h-full flex items-center justify-center text-[#5E6964] text-sm">
                    Loading screen layout...
                  </div>
                ) : !activePosScreen || !activePosScreen.buttons || activePosScreen.buttons.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-[#5E6964] text-sm">
                    <Utensils className="w-8 h-8 mb-2 opacity-40" />
                    <span>This screen has no configured buttons</span>
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
                      const matchingProduct = !isSubscreen
                        ? (products.find((p: any) => String(p.id) === String(btn.productId)) ||
                           products.find((p: any) => (p.name || '').trim().toLowerCase() === (btn.label || '').trim().toLowerCase()))
                        : null;
                      const isProductDeleted = !isSubscreen && (
                        !matchingProduct ||
                        (matchingProduct as any).is_active === false ||
                        ['deleted', 'archived'].includes(String((matchingProduct as any).status || '').toLowerCase())
                      );
                      const isDisabled = isProductDeleted;

                      return (
                        <button
                          key={btn.id || idx}
                          type="button"
                          onClick={() => handleTouchButtonPress(btn)}
                          disabled={isDisabled}
                          title={isProductDeleted ? `⚠️ "${btn.label}" is deleted or not found in catalog` : btn.label}
                          className={`w-full ${activeGridDensity.minHeight} ${activeGridDensity.padding} rounded-2xl border flex flex-col items-center justify-center text-center shadow-xs transition-all active:scale-95 cursor-pointer select-none overflow-hidden relative group ${
                            isDisabled
                              ? 'bg-slate-100 border-dashed border-rose-300 opacity-40 cursor-not-allowed text-slate-400'
                              : `${colorTheme.bg} ${colorTheme.border} ${colorTheme.hover} ${colorTheme.text || 'text-slate-800'} hover:shadow-md hover:scale-[1.01]`
                          }`}
                        >
                          {/* PURE BUTTON NAME ONLY - NO PRICES - ADAPTIVE TEXT WRAP */}
                          <span
                            className={`w-full max-w-full ${activeGridDensity.fontSize} leading-tight tracking-normal line-clamp-3 ${isDisabled ? 'line-through text-slate-400' : (colorTheme.text || 'text-slate-800')} px-1`}
                            style={{
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word',
                              hyphens: 'auto'
                            }}
                          >
                            {btn.label}
                          </span>
                          {isProductDeleted && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 mt-1">
                              Deleted
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT PANEL (Adapts to Tablet Direction): Order Panel #FFFFFF ── */}
            <div className={`${isPortrait ? 'w-[42%]' : 'w-[35%]'} flex flex-col h-full bg-white border-l border-[#E0E3DF] transition-all duration-150 shadow-md`}>
              {/* Ticket Top: Table & Server info + Hold/Fire controls */}
              <div className="p-3 bg-white border-b border-[#E0E3DF] shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-[#242B28]">
                      {activeTableContext?.tableCode ? (
                        activeTableContext.tableCode.toLowerCase().startsWith('table')
                          ? activeTableContext.tableCode
                          : `Table ${activeTableContext.tableCode.replace(/^[Tt]/, '')}`
                      ) : 'Table'}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F5F6F4] text-[#242B28] font-bold border border-[#E0E3DF]">
                      {activeTableContext?.guestCount}p
                    </span>
                  </div>
                  <div className="text-[11px] text-[#5E6964] font-medium truncate max-w-[120px]">
                    {activeTableContext?.waiterName || currentUser?.name}
                  </div>
                </div>

                {/* Course Break, Fire & Transfer Actions */}
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={handleAddHoldSeparator}
                    className="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl bg-[#F5F6F4] hover:bg-slate-200 text-[#242B28] border border-[#E0E3DF] text-[11px] font-bold transition active:scale-95 cursor-pointer"
                  >
                    <Layers className="w-3 h-3 text-amber-600" />
                    <span>+ Hold</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleFireCourse}
                    disabled={isSubmitting || !activeTableContext?.orderId}
                    className="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200 text-[11px] font-bold transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Flame className="w-3 h-3 text-orange-600" />
                    <span>Fire Next</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(true)}
                    className="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-[11px] font-bold transition active:scale-95 cursor-pointer"
                    title="Transfer Table or Move Selected Items"
                  >
                    <MoveRight className="w-3 h-3 text-sky-600" />
                    <span>Transfer</span>
                  </button>
                </div>
              </div>

              {/* Order Basket Items List: Selected items #E9F4ED */}
              <div className="flex-1 p-2 overflow-y-auto space-y-1.5 bg-white">
                {ticketItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-[#5E6964] text-xs">
                    <Utensils className="w-7 h-7 mb-1.5 opacity-30" />
                    <span>Table is empty</span>
                  </div>
                ) : (
                  ticketItems.map((item, idx) => {
                    const isSelected = activeQtyEditorLineId === item.line_item_id;

                    if (item.isHoldSeparator) {
                      return (
                        <div
                          key={item.line_item_id}
                          className="my-1.5 py-1 px-2.5 rounded-lg bg-amber-50 border border-dashed border-amber-300 flex items-center justify-between text-amber-900 text-[11px] font-bold"
                        >
                          <div className="flex items-center gap-1.5">
                            <Layers className="w-3 h-3 text-amber-700" />
                            <span>--- ⏸️ HOLD ---</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(idx, -1)}
                            className="p-0.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={item.line_item_id}
                        className={`py-1.5 px-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                          isSelected
                            ? 'bg-[#E9F4ED] border-[#1e5c4f]/40 shadow-sm'
                            : item.isOrdered
                            ? 'bg-[#F5F6F4] border-[#E0E3DF] opacity-90'
                            : 'bg-[#F5F6F4] border-[#E0E3DF] hover:border-slate-300'
                        }`}
                      >
                        {/* Quantity display / Clickable to show +/- stepper */}
                        <div className="flex items-center shrink-0">
                          {isSelected ? (
                            <div
                              onClick={e => e.stopPropagation()}
                              className="flex items-center bg-white rounded-lg p-0.5 border border-[#E0E3DF] shadow-inner"
                            >
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(idx, -1)}
                                className="w-6 h-6 rounded bg-[#F5F6F4] hover:bg-slate-200 text-[#242B28] font-bold text-xs flex items-center justify-center active:scale-90 transition cursor-pointer border border-[#E0E3DF]"
                              >
                                -
                              </button>
                              <span
                                style={{ color: primaryColor }}
                                className="w-6 text-center font-black text-xs select-none"
                              >
                                {item.qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(idx, 1)}
                                className="w-6 h-6 rounded bg-[#F5F6F4] hover:bg-slate-200 text-[#242B28] font-bold text-xs flex items-center justify-center active:scale-90 transition cursor-pointer border border-[#E0E3DF]"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setActiveQtyEditorLineId(item.line_item_id);
                              }}
                              style={{ backgroundColor: '#E9F4ED', color: primaryColor, borderColor: `${primaryColor}40` }}
                              className="px-2 py-0.5 rounded-lg border font-black text-xs min-w-[28px] text-center active:scale-95 transition cursor-pointer"
                              title="Click to adjust quantity"
                            >
                              {item.qty}x
                            </button>
                          )}
                        </div>

                        {/* Item Name & Modifiers (Minimum space, no Draft, no Price) */}
                        <div
                          onClick={() => {
                            const prod = products.find(p => String(p.id) === String(item.product_id)) || {
                              id: item.product_id,
                              name: item.name,
                              unit_price_usd: item.unit_price,
                              customizations: item.selectedCustomizations || []
                            };
                            setModifyingProduct(prod);
                            setModifyingItemIndex(idx);
                            setIsModifierModalOpen(true);
                          }}
                          className="flex-1 min-w-0 pr-1 cursor-pointer hover:opacity-90"
                          title="Click to customize modifiers & notes"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-[#242B28] truncate leading-snug">{item.name}</span>
                            {Boolean(item.isOrdered && activeTableContext?.orderId) && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300">
                                {Number(item.originalQty || 0) > 0 && item.qty > Number(item.originalQty)
                                  ? `Ordered: ${item.originalQty} (+${item.qty - Number(item.originalQty)} new)`
                                  : 'Ordered'}
                              </span>
                            )}
                            {!item.isOrdered && Boolean(activeTableContext?.orderId) && !item.isHoldSeparator && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
                                +Draft
                              </span>
                            )}
                          </div>

                          {/* Customizations Pills */}
                          {item.selectedCustomizations && item.selectedCustomizations.length > 0 && (() => {
                            const { addons, removals } = partitionCustomizations(item.selectedCustomizations);
                            return (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {addons.map((a, i) => (
                                  <span key={`a-${i}`} className="text-[10px] bg-white text-[#242B28] px-1.5 py-0.5 rounded border border-[#E0E3DF] font-medium">
                                    + {a}
                                  </span>
                                ))}
                                {removals.map((r, i) => (
                                  <span key={`r-${i}`} className="text-[10px] bg-rose-50 text-rose-800 px-1.5 py-0.5 rounded border border-rose-200 font-bold">
                                    - {r}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}

                          {item.note && (
                            <div className="text-[10px] text-amber-800 italic truncate leading-tight mt-0.5 font-medium">
                              Note: {item.note}
                            </div>
                          )}
                        </div>

                        {/* Right: Pen Icon to edit */}
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            const prod = products.find(p => String(p.id) === String(item.product_id)) || {
                              id: item.product_id,
                              name: item.name,
                              unit_price_usd: item.unit_price,
                              customizations: item.selectedCustomizations || []
                            };
                            setModifyingProduct(prod);
                            setModifyingItemIndex(idx);
                            setIsModifierModalOpen(true);
                          }}
                          className="p-1 rounded-lg text-[#5E6964] hover:text-[#242B28] hover:bg-slate-200 transition active:scale-90 shrink-0 cursor-pointer"
                          title="Edit modifiers & notes"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Touch Action Bar: Waiters can Print Bill & Send to Kitchen */}
              <div className="p-3 bg-white border-t border-[#E0E3DF] shrink-0 shadow-sm">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handlePrintBill}
                    disabled={isSubmitting || ticketItems.length === 0}
                    className="py-3 px-2 rounded-xl bg-[#F5F6F4] hover:bg-slate-200 text-[#242B28] border border-[#E0E3DF] text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                    title="Print customer bill / guest check"
                  >
                    <Receipt className="w-4 h-4 text-[#5E6964]" />
                    <span className="truncate">Print Bill</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendToKitchen}
                    disabled={isSubmitting || ticketItems.length === 0}
                    style={{ backgroundColor: primaryColor, color: primaryText }}
                    className="py-3 px-2 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:opacity-95"
                    title="Fire round to kitchen and KDS"
                  >
                    <Send className="w-4 h-4" />
                    <span className="truncate">Send Kitchen</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          STEP-BY-STEP DYNAMIC MODIFIER MODAL
      ───────────────────────────────────────────────────────────── */}
      {isModifierModalOpen && modifyingProduct && (
        <PosModifierModal
          isOpen={isModifierModalOpen}
          product={modifyingProduct}
          allProducts={products}
          initialSelectedCustomizations={
            modifyingItemIndex !== null
              ? ticketItems[modifyingItemIndex]?.selectedCustomizations || []
              : []
          }
          initialNote={
            modifyingItemIndex !== null
              ? ticketItems[modifyingItemIndex]?.note || ''
              : ''
          }
          initialQty={
            modifyingItemIndex !== null
              ? ticketItems[modifyingItemIndex]?.qty || 1
              : 1
          }
          isEditing={modifyingItemIndex !== null}
          onClose={() => {
            setIsModifierModalOpen(false);
            setModifyingProduct(null);
            setModifyingItemIndex(null);
          }}
          onSave={handleSaveModifierModal}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          TABLE & ITEMS TRANSFER MODAL
      ───────────────────────────────────────────────────────────── */}
      {isTransferModalOpen && activeTableContext && (
        <TableTransferModal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          sourceTableCode={activeTableContext.tableCode}
          sourceOrderId={activeTableContext.orderId}
          sourceSessionId={activeTableContext.sessionId}
          conceptId={'00000000-0000-0000-0000-000000000001'}
          ticketItems={ticketItems}
          availableTables={floorTables}
          restaurantId={restaurantId}
          branchId={branchId}
          currentUser={{
            id: currentUser?.id,
            name: currentUser?.name || 'Waiter',
            role: currentUser?.role || 'waiter'
          }}
          onSuccess={(result) => {
            try {
              window.dispatchEvent(new CustomEvent('flow:order_created', { detail: { orderId: result.destOrderId } }));
              window.dispatchEvent(new CustomEvent('flow:table_transferred', { detail: { destTableCode: result.destTableCode } }));
            } catch (e) {}

            if (result.mode === 'entire') {
              setActiveTableContext(prev => prev ? {
                ...prev,
                tableCode: result.destTableCode
              } : null);
              showNotification(`✅ Table moved to Table ${result.destTableCode}!`, 'success');
              // Return to floor plan
              setView('floor');
              setActiveTableContext(null);
              setTicketItems([]);
            } else {
              setTicketItems(result.remainingItems || []);
              showNotification(`✅ Items transferred to Table ${result.destTableCode}!`, 'success');
              refreshFloorTablesList().catch(() => {});
            }
          }}
          onRequestSupervisorAuth={(req) => setSupervisorAuthRequest(req)}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          SUPERVISOR AUTHORIZATION MODAL
      ───────────────────────────────────────────────────────────── */}
      

      <PosSupervisorAuthModal
        isOpen={Boolean(supervisorAuthRequest)}
        request={supervisorAuthRequest}
        restaurantId={restaurantId}
        branchName={branchName}
        requestingUser={{
          id: currentUser?.id,
          name: currentUser?.name || 'Waiter',
          role: currentUser?.role || 'waiter'
        }}
        onClose={() => setSupervisorAuthRequest(null)}
      />

      <ThermalReceiptPreviewModal
        isOpen={isReceiptPreviewOpen}
        onClose={() => setIsReceiptPreviewOpen(false)}
        data={receiptPreviewData}
      />

      {/* PWA Install Modal */}
      <PwaInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        deferredPrompt={deferredInstallPrompt}
      />
    </div>
  );
}
