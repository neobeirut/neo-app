import { supabase, getGlobalRestaurantId } from '../../api/supabase';

export interface PosPrinter {
  id: string;
  restaurant_id: string;
  branch_id: string;
  name: string;
  printer_role: string;
  connection_type: string;
  windows_printer_name?: string | null;
  ip_address: string;
  port: number;
  is_active: boolean;
  is_receipt_printer: boolean;
  is_fallback: boolean;
  paper_width_mm: number;
  status: 'online' | 'offline' | 'unknown' | 'error';
}

export interface PosPrinterSectionRoute {
  id: string;
  restaurant_id: string;
  branch_id: string;
  section_key: string;
  print_preparation_ticket: boolean;
  printer_id: string | null;
  is_default: boolean;
  printer?: PosPrinter | null;
}

export interface ExpandedPrepItem {
  id: string | number;
  name: string;
  quantity: number;
  qty: number;
  preparation_section: string;
  print_preparation_ticket: boolean;
  is_bundle_component: boolean;
  bundle_parent_name?: string;
  modifiers: any[];
  notes?: string;
  note?: string;
  original_item_id?: string | number;
  line_item_id?: string;
}

export interface OrderPrintMetadata {
  order_id: number | string;
  concept_name?: string;
  table_label?: string;
  table_code?: string;
  customer_name?: string;
  guest_count?: number;
  waiter_name?: string;
  cashier_name?: string;
  service_type?: string;
  timestamp?: string;
  fire_round?: number;
  total_holds?: number;
  is_reprint?: boolean;
  is_scheduled?: boolean;
  scheduled_for?: string;
  scheduled_time_display?: string;
  scheduled_notes?: string;
}

export interface PhysicalPrinterTicketJob {
  printer: PosPrinter;
  section_key: string;
  ticket_type: 'prep_ticket' | 'modification' | 'cancellation' | 'reprint' | 'receipt' | 'pre_check';
  ticket_payload: any;
  items: ExpandedPrepItem[];
  idempotency_key: string;
}

// In-memory cache for printer config per branch
interface CachedBranchConfig {
  printers: PosPrinter[];
  routes: PosPrinterSectionRoute[];
  mainBillPrinter: PosPrinter | null;
  fallbackPrepPrinter: PosPrinter | null;
  timestamp: number;
}
const configCache = new Map<string, CachedBranchConfig>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute TTL

/**
 * Loads and caches active printer configurations and section routes for a branch.
 */
export async function loadBranchPrinterConfig(branchId?: string, restaurantId?: string): Promise<{
  printers: PosPrinter[];
  routes: PosPrinterSectionRoute[];
  mainBillPrinter: PosPrinter | null;
  fallbackPrepPrinter: PosPrinter | null;
}> {
  const rId = restaurantId || getGlobalRestaurantId() || '79256f11-a9f8-4fec-901d-69baf929762d';
  const targetBranch = branchId || '9c214659-9cc7-4f33-b115-cbbb8a823a94';
  const cacheKey = `${rId}_${targetBranch}`;

  const cached = configCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return {
      printers: cached.printers,
      routes: cached.routes,
      mainBillPrinter: cached.mainBillPrinter,
      fallbackPrepPrinter: cached.fallbackPrepPrinter
    };
  }

  try {
    const [printersRes, routesRes] = await Promise.all([
      supabase
        .from('pos_printers')
        .select('*')
        .eq('restaurant_id', rId)
        .eq('branch_id', targetBranch)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('pos_printer_section_routes')
        .select('*, printer:pos_printers(*)')
        .eq('restaurant_id', rId)
        .eq('branch_id', targetBranch)
    ]);

    const printers = (printersRes.data || []) as PosPrinter[];
    const routes = (routesRes.data || []) as PosPrinterSectionRoute[];

    // Identify Main Bill Printer: marked with is_receipt_printer = true or named 'Main'
    const mainBillPrinter = printers.find(p => p.is_receipt_printer) || printers.find(p => p.name.toLowerCase() === 'main') || printers[0] || null;

    // Identify Preparation Fallback Printer: marked with is_fallback = true or named 'Kitchen Printer'
    const fallbackPrepPrinter = printers.find(p => p.is_fallback) || printers.find(p => p.name.toLowerCase().includes('kitchen')) || printers[0] || null;

    const result = { printers, routes, mainBillPrinter, fallbackPrepPrinter, timestamp: Date.now() };
    configCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('Could not load branch printer config, falling back to local defaults:', err);
    // Safe hardcoded fallback for offline mode
    const defaultKitchen: PosPrinter = {
      id: 'default-kitchen',
      restaurant_id: rId,
      branch_id: targetBranch,
      name: 'Kitchen Printer',
      printer_role: 'kitchen',
      connection_type: 'network_raw',
      ip_address: '192.168.18.11',
      port: 9100,
      is_active: true,
      is_receipt_printer: false,
      is_fallback: true,
      paper_width_mm: 80,
      status: 'online'
    };
    const defaultMain: PosPrinter = {
      id: 'default-main',
      restaurant_id: rId,
      branch_id: targetBranch,
      name: 'Main',
      printer_role: 'main_bill',
      connection_type: 'network_raw',
      ip_address: '192.168.18.10',
      port: 9100,
      is_active: true,
      is_receipt_printer: true,
      is_fallback: false,
      paper_width_mm: 80,
      status: 'online'
    };
    return {
      printers: [defaultMain, defaultKitchen],
      routes: [
        { id: 'r1', restaurant_id: rId, branch_id: targetBranch, section_key: 'Kitchen', print_preparation_ticket: true, printer_id: 'default-kitchen', is_default: true, printer: defaultKitchen },
        { id: 'r2', restaurant_id: rId, branch_id: targetBranch, section_key: 'Store', print_preparation_ticket: false, printer_id: null, is_default: true, printer: null },
        { id: 'r3', restaurant_id: rId, branch_id: targetBranch, section_key: 'Retail', print_preparation_ticket: false, printer_id: null, is_default: true, printer: null }
      ],
      mainBillPrinter: defaultMain,
      fallbackPrepPrinter: defaultKitchen
    };
  }
}

/**
 * Resolves the preparation section and ticket eligibility for an item.
 * Supports explicit product overrides, categories, and heuristics.
 */
export function resolveItemPreparationSection(
  item: any,
  productsCatalog?: any[],
  routes?: PosPrinterSectionRoute[]
): {
  section_key: string;
  print_preparation_ticket: boolean;
  is_override: boolean;
} {
  const pName = String(item.product_name_snapshot || item.product_name || item.name || '').trim();
  let cName = String(item.category_name || item.category || '').trim();
  let cSection = String(item.category_section || '').trim();
  let itemConceptId = String(item.concept_id || '').trim();

  // 1. Check if item has explicit properties directly
  let section = item.preparation_section || '';
  let override = item.prep_print_override || null;

  // 2. Check catalog if not present on item
  if ((!section || !override || !cName || !cSection || !itemConceptId) && productsCatalog && productsCatalog.length > 0) {
    const matched = productsCatalog.find(p => (
      (item.product_id && String(p.id) === String(item.product_id)) ||
      (p.name && p.name.toLowerCase() === pName.toLowerCase())
    ));
    if (matched) {
      if (!section && matched.preparation_section) section = matched.preparation_section;
      if (!override && matched.prep_print_override) override = matched.prep_print_override;
      if (!cName) cName = String(matched.category_name || matched.category || matched.categories?.name || '').trim();
      if (!cSection && matched.category_section) cSection = String(matched.category_section).trim();
      if (!itemConceptId && matched.concept_id) itemConceptId = String(matched.concept_id).trim();
    }
  }

  // 3. Deterministic Category Station (authoritative unless product explicitly overrides)
  const validStations = new Set(['kitchen', 'ovrload kitchen', 'bar', 'pastry', 'bakery', 'cold kitchen', 'hot kitchen', 'store', 'retail']);
  if (!section && cSection && validStations.has(cSection.toLowerCase())) {
    section = cSection;
  }

  // 4. Heuristic fallback ONLY if neither product nor category defines a station
  if (!section) {
    const combined = (pName + ' ' + cName).toLowerCase();
    const isOvrloadConcept = itemConceptId === '00000000-0000-0000-0000-000000000002' || combined.includes('ovrload');
    if (cName.toLowerCase() === 'store' || cName.toLowerCase() === 'retail' || /\b(store|retail|merch|packaged|grocery)\b/i.test(combined)) {
      section = 'Store';
    } else if (/\b(coffee|espresso|latte|cappuccino|nescafe|nescafé|mocha|frappe|frappé|cocoa|chai|infusion|tea|teas|juice|juices|drinks|beverage|beverages|cocktail|cocktails|beer|wine|vodka|gin|whisky|mocktail|tonic|water|soda|lemonade|pepsi|cola|7up|perrier|almaza|american|americano|regular|decaf|v60|chemex|flat white|cortado|macchiato|matcha|shake|shakes|smoothie|hot chocolate|brew|milkshake|milkshakes)\b/i.test(combined)) {
      section = 'Bar';
    } else if (/\b(cake|cakes|pastry|croissant|croissants|viennoiserie|viennoiseries|cookie|cookies|brownie|eclair|tart|tarte|bakery|bread)\b/i.test(combined)) {
      section = 'Pastry';
    } else if (isOvrloadConcept) {
      section = 'OVRLOAD Kitchen';
    } else {
      section = 'Kitchen';
    }
  }

  // 4. Resolve print_preparation_ticket rule
  let printPrep = true;
  if (override === 'NO_PRINT') {
    printPrep = false;
  } else if (override === 'PRINT') {
    printPrep = true;
  } else {
    // Check section route configuration
    const route = routes?.find(r => r.section_key.toLowerCase() === section.toLowerCase());
    if (route) {
      printPrep = route.print_preparation_ticket !== false;
    } else {
      // Default rule: Store / Retail are NO_PRINT
      const lower = section.toLowerCase();
      if (lower === 'store' || lower === 'retail') {
        printPrep = false;
      } else {
        printPrep = true;
      }
    }
  }

  return {
    section_key: section,
    print_preparation_ticket: printPrep,
    is_override: Boolean(override)
  };
}

/**
 * Checks whether an item represents a course HOLD divider separator.
 */
export function isCourseHoldItem(item: any): boolean {
  if (!item) return false;
  const name = String(item.product_name_snapshot || item.product_name || item.name || '').trim().toUpperCase();
  const idStr = String(item.order_item_id || item.product_id || item.id || '');
  return (
    name === 'HOLD' ||
    name === '--- HOLD ---' ||
    name === 'HOLD FOR NEXT COURSE' ||
    name.includes('HOLD (KITCHEN') ||
    idStr.startsWith('hold_') ||
    item.isHoldSeparator === true
  );
}

/**
 * Checks if a product is a bundle/combo.
 */
export function isBundleProduct(item: any, productsCatalog?: any[]): boolean {
  if (!item) return false;
  if (item.is_bundle === true || item.isBundle === true) return true;
  const cName = String(item.category_name || item.category || '').toLowerCase();
  const pName = String(item.product_name || item.name || '').toLowerCase();
  if (
    cName.includes('bundle') || cName.includes('combo') ||
    pName.includes('bundle') || pName.includes('combo') ||
    pName.includes('parisien') || pName.includes('formula') || pName.includes('formule')
  ) {
    return true;
  }
  // Check if matched catalog item has bundle properties or category_id 30
  if (productsCatalog && item.product_id) {
    const matched = productsCatalog.find(p => String(p.id) === String(item.product_id));
    if (matched && (
      matched.category_id === 30 ||
      String(matched.category_name || '').toLowerCase().includes('bundle') ||
      String(matched.name).toLowerCase().includes('bundle') ||
      String(matched.name).toLowerCase().includes('parisien') ||
      String(matched.name).toLowerCase().includes('formula') ||
      String(matched.name).toLowerCase().includes('formule')
    )) {
      return true;
    }
  }
  return false;
}

/**
 * Expands order items into individual components for preparation ticket generation.
 * Follows Phase 4 rules:
 * - Bundle parent is expanded into individual components
 * - Each component inherits effective quantity = bundle.qty * component.quantity
 * - Component-specific customizations and notes are attached
 * - Preparation section is resolved per component
 * - Components belonging to No-Print sections (e.g. Store) are excluded from preparation tickets
 * - Bundle parent is preserved in commercial records, NOT printed as an extra shell item
 */
export function expandOrderItemsForPreparation(
  items: any[],
  productsCatalog?: any[],
  routes?: PosPrinterSectionRoute[]
): ExpandedPrepItem[] {
  const result: ExpandedPrepItem[] = [];

  for (const item of items) {
    if (isCourseHoldItem(item)) {
      continue; // Hold dividers do not route to station printers as food items
    }

    const bundle = isBundleProduct(item, productsCatalog);
    const itemQty = Number(item.qty || item.quantity || 1);

    if (bundle) {
      // Find components selected within the bundle
      const custs = item.selectedCustomizations || item.customizations || item.modifiers || [];
      
      // Separate top-level choices (products selected in groups like "Your Eggs", "Your Coffee")
      // from child modifiers (like "Oat Milk" on Coffee)
      const topLevelChoices = custs.filter((c: any) => !c.parent_option_id);
      const childModifiers = custs.filter((c: any) => Boolean(c.parent_option_id));

      if (topLevelChoices.length > 0) {
        for (const choice of topLevelChoices) {
          const compName = choice.name || choice.ingredient || 'Component';
          const compQty = itemQty * Number(choice.quantity || 1);

          // Find any sub-modifiers that belong to this choice
          const relevantMods = childModifiers.filter((m: any) => 
            m.parent_option_id === choice.id || 
            (choice.original_id && m.parent_option_id === choice.original_id) ||
            m.parent_option_name === compName
          );

          // Resolve preparation section for this bundle component
          const resolution = resolveItemPreparationSection(
            { name: compName, product_id: choice.original_id || choice.id },
            productsCatalog,
            routes
          );

          // Exclude component if its section is marked No-Print (e.g. packaged Store snack)
          if (!resolution.print_preparation_ticket) {
            continue;
          }

          result.push({
            id: `comp_${item.id || item.line_item_id}_${choice.id}`,
            name: compName,
            quantity: compQty,
            qty: compQty,
            preparation_section: resolution.section_key,
            print_preparation_ticket: true,
            is_bundle_component: true,
            bundle_parent_name: item.name || 'Combo',
            modifiers: relevantMods,
            notes: choice.note || '',
            note: choice.note || '',
            original_item_id: item.id || item.product_id,
            line_item_id: item.line_item_id
          });
        }
      } else {
        // Fallback if bundle had no explicit customization items expanded
        const resolution = resolveItemPreparationSection(item, productsCatalog, routes);
        if (resolution.print_preparation_ticket) {
          result.push({
            id: item.id || item.line_item_id || Math.random().toString(),
            name: item.name,
            quantity: itemQty,
            qty: itemQty,
            preparation_section: resolution.section_key,
            print_preparation_ticket: true,
            is_bundle_component: false,
            modifiers: custs,
            notes: item.note || item.comment || '',
            note: item.note || item.comment || '',
            original_item_id: item.id || item.product_id,
            line_item_id: item.line_item_id
          });
        }
      }
    } else {
      // Regular standalone product
      const resolution = resolveItemPreparationSection(item, productsCatalog, routes);

      // Exclude if No-Print (Store / Retail)
      if (!resolution.print_preparation_ticket) {
        continue;
      }

      result.push({
        id: item.id || item.line_item_id || Math.random().toString(),
        name: item.name,
        quantity: itemQty,
        qty: itemQty,
        preparation_section: resolution.section_key,
        print_preparation_ticket: true,
        is_bundle_component: false,
        modifiers: item.selectedCustomizations || item.customizations || item.modifiers || [],
        notes: item.note || item.comment || '',
        note: item.note || item.comment || '',
        original_item_id: item.id || item.product_id,
        line_item_id: item.line_item_id
      });
    }
  }

  return result;
}

/**
 * Core Routing Function:
 * Takes order items, expands bundles, filters by printing eligibility,
 * groups by physical destination printer, and returns ticket dispatch jobs.
 */
export async function buildPreparationPrintJobs(params: {
  orderMetadata: OrderPrintMetadata;
  items: any[];
  branchId?: string;
  restaurantId?: string;
  productsCatalog?: any[];
}): Promise<{
  jobs: PhysicalPrinterTicketJob[];
  unroutedCount: number;
  excludedNoPrintCount: number;
}> {
  const branchId = params.branchId || '9c214659-9cc7-4f33-b115-cbbb8a823a94';
  const config = await loadBranchPrinterConfig(branchId, params.restaurantId);

  // 1. Expand items and filter out intentional No-Print items
  const expandedItems = expandOrderItemsForPreparation(
    params.items,
    params.productsCatalog,
    config.routes
  );

  let unroutedCount = 0;
  const excludedNoPrintCount = params.items.length - expandedItems.length;

  if (expandedItems.length === 0) {
    return { jobs: [], unroutedCount: 0, excludedNoPrintCount };
  }

  // 2. Resolve destination printer for each expanded item and group by physical printer
  const itemsByPrinterId = new Map<string, { printer: PosPrinter; section: string; items: ExpandedPrepItem[] }>();

  for (const prepItem of expandedItems) {
    const route = config.routes.find(r => r.section_key.toLowerCase() === prepItem.preparation_section.toLowerCase());
    let targetPrinter: PosPrinter | null = null;

    if (route && route.printer_id) {
      targetPrinter = config.printers.find(p => p.id === route.printer_id) || null;
    }

    if (!targetPrinter) {
      // Apply configured fallback printer with warning
      targetPrinter = config.fallbackPrepPrinter;
      unroutedCount++;
    }

    if (!targetPrinter) {
      console.warn(`No printer found for item "${prepItem.name}" in section "${prepItem.preparation_section}".`);
      continue;
    }

    const groupKey = targetPrinter.id;
    if (!itemsByPrinterId.has(groupKey)) {
      itemsByPrinterId.set(groupKey, {
        printer: targetPrinter,
        section: prepItem.preparation_section,
        items: []
      });
    }
    itemsByPrinterId.get(groupKey)!.items.push(prepItem);
  }

  // 3. Generate structured preparation ticket payload for each physical printer
  const jobs: PhysicalPrinterTicketJob[] = [];
  const meta = params.orderMetadata;

  for (const [printerId, group] of itemsByPrinterId.entries()) {
    const sectionName = group.section || 'Kitchen';
    const isReprint = Boolean(meta.is_reprint);
    const isSched = Boolean(meta.is_scheduled || meta.scheduled_for);
    const dueTime = meta.scheduled_time_display || meta.scheduled_for || '';
    const stationTitle = isReprint
      ? `REPRINT - ${sectionName.toUpperCase()}`
      : isSched
      ? `PRE-ORDER (DUE: ${dueTime})`
      : sectionName.toUpperCase();

    const ticketPayload = {
      isKitchenTicket: true,
      concept_name: meta.concept_name || undefined,
      station: sectionName,
      station_code: sectionName.toUpperCase(),
      section_key: sectionName,
      title: stationTitle,
      printer_name: group.printer.name,
      printer_ip: group.printer.ip_address,
      printer_port: group.printer.port,
      order_id: meta.order_id,
      table_code: meta.table_code || undefined,
      table_label: meta.table_label || meta.table_code || undefined,
      customer_name: meta.customer_name || undefined,
      guest_count: meta.guest_count || 1,
      waiter_name: meta.waiter_name || 'Staff',
      service_type: meta.service_type || (meta.table_code ? 'dine_in' : 'takeout'),
      timestamp: meta.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fire_round: meta.fire_round || 1,
      is_reprint: isReprint,
      is_scheduled: isSched,
      scheduled_for: meta.scheduled_for || null,
      scheduled_time_display: meta.scheduled_time_display || null,
      scheduled_notes: meta.scheduled_notes || null,
      // Items grouped with parent bundle headers
      items: group.items.map(it => ({
        name: it.name,
        qty: it.quantity,
        quantity: it.quantity,
        is_bundle_component: it.is_bundle_component,
        bundle_parent_name: it.bundle_parent_name || null,
        note: it.note || it.notes || '',
        modifiers: (it.modifiers || []).map((m: any) => {
          if (typeof m === 'string') return m;
          const mName = (m.name || m.ingredient || m.option_name || m.label || m.customization_name || '').trim();
          const groupLower = (m.option_group_name || '').toLowerCase();
          const typeLower = (m.customization_type || m.type || '').toLowerCase();
          const isRem = (
            m.action === 'remove' ||
            m.action === 'no' ||
            typeLower === 'removal' ||
            typeLower === 'remove' ||
            groupLower.includes('remove') ||
            mName.toLowerCase().startsWith('no ') ||
            mName.toLowerCase().startsWith('without ') ||
            mName.toLowerCase().startsWith('remove: ') ||
            mName.startsWith('- ')
          );
          return {
            name: mName,
            action: isRem ? 'remove' : 'add',
            customization_type: isRem ? 'removal' : (m.customization_type || m.type || 'addon'),
            option_group_name: m.option_group_name || undefined,
            quantity: Number(m.quantity || m.qty || 1)
          };
        })
      }))
    };

    const orderKeyPart = (!meta.order_id || String(meta.order_id) === 'Chit')
      ? `chit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      : String(meta.order_id);
    const idempotencyKey = `order_${orderKeyPart}_fire_${meta.fire_round || 1}_printer_${printerId}${meta.is_reprint ? '_reprint_' + Date.now() : ''}`;

    jobs.push({
      printer: group.printer,
      section_key: group.section,
      ticket_type: meta.is_reprint ? 'reprint' : 'prep_ticket',
      ticket_payload: ticketPayload,
      items: group.items,
      idempotency_key: idempotencyKey
    });
  }

  return { jobs, unroutedCount, excludedNoPrintCount };
}

/**
 * Builds the customer bill / receipt print job payload.
 * Dispatched EXCLUSIVELY to the branch's designated Main bill printer.
 * Contains the complete commercial order (all items including Store/Retail).
 */
export async function buildMainBillPrintJob(params: {
  order: any;
  isPreCheck: boolean;
  branchId?: string;
  restaurantId?: string;
  conceptBranding?: {
    conceptName?: string;
    receiptPrefix?: string;
    customFooter?: string;
  };
  footerText?: string;
  printRequestId?: string;
}): Promise<PhysicalPrinterTicketJob | null> {
  const branchId = params.branchId || '9c214659-9cc7-4f33-b115-cbbb8a823a94';
  const config = await loadBranchPrinterConfig(branchId, params.restaurantId);

  const mainPrinter = config.mainBillPrinter;
  if (!mainPrinter) {
    console.warn('No Main Bill Printer designated for this branch.');
    return null;
  }

  const ord = params.order;
  const isPre = params.isPreCheck;
  const items = (ord.items || []).map((it: any) => {
    const rawMods = it.selectedCustomizations || it.customizations || it.modifiers || [];
    const modsArr = Array.isArray(rawMods) ? rawMods : [];
    const pricedModLines = modsArr
      .filter((m: any) => m && typeof m === 'object' && Number(m.price ?? m.unit_price ?? m.price_delta ?? m.extra_price ?? 0) > 0)
      .map((m: any) => {
        const mName = String(m.name || m.ingredient || m.option_name || m.label || '').trim();
        const mQty = Number(m.quantity || m.qty || 1);
        const mPrice = Number(m.price ?? m.unit_price ?? m.price_delta ?? m.extra_price ?? 0) * mQty;
        return `+ ${mName}${mQty > 1 ? ` x${mQty}` : ''} (+$${mPrice.toFixed(2)})`;
      })
      .filter(Boolean);
    return {
      name: it.name || it.product_name,
      qty: it.qty || it.quantity || 1,
      unit_price: Number(it.unit_price || it.price || 0),
      total_price: Number(it.total_price !== undefined ? it.total_price : (Number(it.unit_price || 0) * Number(it.qty || 1))),
      modifiers: modsArr,
      customizations_print_text: pricedModLines,
      note: it.note || it.comment || ''
    };
  });

  const conceptTitle = params.conceptBranding?.conceptName 
    ? `*** ${params.conceptBranding.conceptName.toUpperCase()} ***`
    : (isPre ? '*** GUEST CHECK / PRE-CHECK ***' : '*** RECEIPT ***');

  const conceptFooter = params.conceptBranding?.customFooter 
    || params.footerText 
    || 'Thank you for dining with us! Come back soon.';

  const hasExplicitConcept = Boolean(ord.concept_id || ord.concept_code || ord.concept_name || params.conceptBranding?.conceptName);
  const isDefaultNeo =
    !hasExplicitConcept ||
    ord.concept_id === '00000000-0000-0000-0000-000000000001' ||
    String(ord.concept_code || '').toUpperCase() === 'NEO' ||
    String(ord.concept_name || params.conceptBranding?.conceptName || '').toUpperCase().startsWith('NÉO') ||
    String(ord.concept_name || params.conceptBranding?.conceptName || '').toUpperCase().startsWith('NEO');
  const resolvedConceptLogo =
    (typeof window !== 'undefined' && ord.concept_id ? localStorage.getItem(`flow_pos_concept_logo_${ord.concept_id}`) : null) ||
    (typeof window !== 'undefined' && ord.concept_code ? localStorage.getItem(`flow_pos_concept_logo_${String(ord.concept_code).toUpperCase()}`) : null) ||
    (ord.logo_url && (isDefaultNeo || !String(ord.logo_url).toLowerCase().includes('neobeirut.com')) ? ord.logo_url : '') ||
    (isDefaultNeo && typeof window !== 'undefined' ? localStorage.getItem('flow_pos_logo_url') : null) ||
    '';

  const payload = {
    isPreCheck: isPre,
    isCustomerBill: true,
    title: conceptTitle,
    concept_id: ord.concept_id,
    concept_code: ord.concept_code,
    concept_name: ord.concept_name || params.conceptBranding?.conceptName,
    receipt_prefix: params.conceptBranding?.receiptPrefix,
    restaurant_name: ord.restaurant_name || (typeof window !== 'undefined' ? localStorage.getItem('flow_pos_restaurant_name') : null) || 'Neo Beirut',
    company_legal_name: ord.company_legal_name || (typeof window !== 'undefined' ? localStorage.getItem('flow_pos_company_legal_name') : null) || 'Neo Beirut S.A.L.',
    mof_number: ord.mof_number || (typeof window !== 'undefined' ? localStorage.getItem('flow_pos_mof_number') : null) || '382910-601',
    logo_url: resolvedConceptLogo,
    printer_name: mainPrinter.name,
    printer_ip: mainPrinter.ip_address,
    printer_port: mainPrinter.port,
    order_id: ord.id || ord.order_id,
    table_label: ord.table_label || ord.table_code || 'N/A',
    guest_count: ord.guest_count || 1,
    waiter_name: ord.waiter_name || ord.waiter_reference || 'Staff',
    cashier_name: ord.cashier_name || 'Cashier',
    timestamp: new Date().toLocaleString(),
    subtotal: ord.subtotal || ord.subtotal_amount || 0,
    discount_amount: ord.discount_amount || ord.discountAmount || 0,
    delivery_fee: ord.delivery_fee || ord.deliveryFee || 0,
    vat_amount: ord.vat_amount || 0,
    total: ord.total || ord.total_amount || 0,
    currency: ord.currency || 'USD',
    exchange_rate: ord.exchange_rate || 90000,
    items,
    footer: conceptFooter
  };

  const actionUuid = params.printRequestId || ord.print_request_id || ord.bill_request_id || `${ord.id || ord.order_id}_${isPre ? 'precheck' : 'settled'}`;
  const idempotencyKey = `bill_order_${ord.id || ord.order_id}_${isPre ? 'precheck' : 'settled'}_${actionUuid}`;

  return {
    printer: mainPrinter,
    section_key: 'Customer Receipt',
    ticket_type: isPre ? 'pre_check' : 'receipt',
    ticket_payload: payload,
    items: [],
    idempotency_key: idempotencyKey
  };
}

/**
 * Builds a cancellation ticket job dispatched to the ORIGINAL printer that printed the item.
 */
export function buildCancellationJob(params: {
  cancelledItem: any;
  originalPrinter: PosPrinter;
  orderMetadata: OrderPrintMetadata;
  reason?: string;
}): PhysicalPrinterTicketJob {
  const meta = params.orderMetadata;
  const it = params.cancelledItem;

  const payload = {
    isKitchenTicket: true,
    isCancellation: true,
    concept_name: meta.concept_name || undefined,
    title: '*** ITEM VOID / CANCELLED ***',
    printer_name: params.originalPrinter.name,
    printer_ip: params.originalPrinter.ip_address,
    printer_port: params.originalPrinter.port,
    order_id: meta.order_id,
    table_code: meta.table_code || undefined,
    table_label: meta.table_label || meta.table_code || undefined,
    customer_name: meta.customer_name || undefined,
    service_type: meta.service_type || (meta.table_code ? 'dine_in' : 'takeout'),
    waiter_name: meta.waiter_name || 'Staff',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    reason: params.reason || 'Manager void authorization',
    items: [
      {
        name: `[CANCELLED] ${it.name}`,
        qty: it.qty || it.quantity || 1,
        note: `VOID: ${params.reason || 'Customer request'}`,
        modifiers: it.selectedCustomizations || it.customizations || it.modifiers || []
      }
    ]
  };

  const actionId = (meta as any).action_id || `${it.id || it.line_item_id}`;
  const idempotencyKey = `void_order_${meta.order_id}_item_${it.id || it.line_item_id}_${actionId}`;

  return {
    printer: params.originalPrinter,
    section_key: it.preparation_section || 'Kitchen',
    ticket_type: 'cancellation',
    ticket_payload: payload,
    items: [it],
    idempotency_key: idempotencyKey
  };
}

/**
 * Builds cancellation ticket jobs for one or multiple items or whole bundles.
 * Resolves destination printers per preparation section and expands combos if cancelled.
 */
export async function buildCancellationPrintJobs(params: {
  orderMetadata: OrderPrintMetadata;
  cancelledItems: any[];
  branchId?: string;
  restaurantId?: string;
  productsCatalog?: any[];
  reason?: string;
}): Promise<PhysicalPrinterTicketJob[]> {
  const branchId = params.branchId || '9c214659-9cc7-4f33-b115-cbbb8a823a94';
  const config = await loadBranchPrinterConfig(branchId, params.restaurantId);

  // Expand combos if whole combos were cancelled
  const expandedItems = expandOrderItemsForPreparation(
    params.cancelledItems,
    params.productsCatalog,
    config.routes
  );

  if (expandedItems.length === 0) return [];

  // Group by destination printer
  const itemsByPrinter = new Map<string, { printer: PosPrinter; section: string; items: ExpandedPrepItem[] }>();

  for (const item of expandedItems) {
    const route = config.routes.find(r => r.section_key.toLowerCase() === item.preparation_section.toLowerCase());
    let targetPrinter = route?.printer_id ? config.printers.find(p => p.id === route.printer_id) : null;
    if (!targetPrinter) targetPrinter = config.fallbackPrepPrinter;
    if (!targetPrinter) continue;

    if (!itemsByPrinter.has(targetPrinter.id)) {
      itemsByPrinter.set(targetPrinter.id, {
        printer: targetPrinter,
        section: item.preparation_section,
        items: []
      });
    }
    itemsByPrinter.get(targetPrinter.id)!.items.push(item);
  }

  const jobs: PhysicalPrinterTicketJob[] = [];
  const meta = params.orderMetadata;

  for (const [printerId, group] of itemsByPrinter.entries()) {
    const payload = {
      isKitchenTicket: true,
      isCancellation: true,
      concept_name: meta.concept_name || undefined,
      title: '*** ITEM VOID / CANCELLED ***',
      printer_name: group.printer.name,
      printer_ip: group.printer.ip_address,
      printer_port: group.printer.port,
      order_id: meta.order_id,
      table_code: meta.table_code || undefined,
      table_label: meta.table_label || meta.table_code || undefined,
      customer_name: meta.customer_name || undefined,
      service_type: meta.service_type || (meta.table_code ? 'dine_in' : 'takeout'),
      waiter_name: meta.waiter_name || 'Staff',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reason: params.reason || 'Item void / cancellation',
      items: group.items.map(it => ({
        name: `[CANCELLED] ${it.name}`,
        qty: it.quantity,
        is_bundle_component: it.is_bundle_component,
        bundle_parent_name: it.bundle_parent_name || null,
        note: `VOID: ${params.reason || 'Item cancelled'}`,
        modifiers: (it.modifiers || []).map((m: any) => {
          if (typeof m === 'string') return m;
          const mName = (m.name || m.ingredient || m.option_name || m.label || m.customization_name || '').trim();
          const groupLower = (m.option_group_name || '').toLowerCase();
          const typeLower = (m.customization_type || m.type || '').toLowerCase();
          const isRem = (
            m.action === 'remove' ||
            m.action === 'no' ||
            typeLower === 'removal' ||
            typeLower === 'remove' ||
            groupLower.includes('remove') ||
            mName.toLowerCase().startsWith('no ') ||
            mName.toLowerCase().startsWith('without ') ||
            mName.toLowerCase().startsWith('remove: ') ||
            mName.startsWith('- ')
          );
          return {
            name: mName,
            action: isRem ? 'remove' : 'add',
            customization_type: isRem ? 'removal' : (m.customization_type || m.type || 'addon'),
            option_group_name: m.option_group_name || undefined,
            quantity: Number(m.quantity || m.qty || 1)
          };
        })
      }))
    };

    const actionId = (meta as any).action_id || 'void';
    const idempotencyKey = `void_order_${meta.order_id}_printer_${printerId}_${actionId}`;

    jobs.push({
      printer: group.printer,
      section_key: group.section,
      ticket_type: 'cancellation',
      ticket_payload: payload,
      items: group.items,
      idempotency_key: idempotencyKey
    });
  }

  return jobs;
}

export interface PrintedTicketRecord {
  id: string;
  timestamp: string;
  ticket_type: string;
  title: string;
  printer_name: string;
  section_key?: string;
  table_label?: string;
  order_id?: string;
  itemsCount: number;
  summary: string;
  payload: any;
}

const PRINTED_JOURNAL_KEY = 'flow_pos_printed_tickets_log';
const VIRTUAL_PRINT_KEY = 'flow_pos_virtual_print_mode';

export function isVirtualPrintModeActive(): boolean {
  if (typeof window === 'undefined') return false;
  const val = localStorage.getItem(VIRTUAL_PRINT_KEY);
  if (val === null) {
    return false;
  }
  return val === 'true';
}

export function setVirtualPrintMode(active: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VIRTUAL_PRINT_KEY, active ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('flow_pos_virtual_mode_changed', { detail: { active } }));
}

export function getPrintedTicketsHistory(): PrintedTicketRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PRINTED_JOURNAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordPrintedTicket(record: PrintedTicketRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getPrintedTicketsHistory();
    const updated = [record, ...history.filter(r => r.id !== record.id)].slice(0, 50);
    localStorage.setItem(PRINTED_JOURNAL_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('flow_pos_ticket_printed', { detail: record }));
  } catch (e) {
    console.warn('Could not record printed ticket in local history:', e);
  }
}

export function clearPrintedTicketsHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PRINTED_JOURNAL_KEY);
  window.dispatchEvent(new CustomEvent('flow_pos_ticket_printed_cleared'));
}

/**
 * Dispatches physical printer ticket jobs to the local print bridge server
 * and records jobs into the database `pos_print_jobs` table.
 * Isolates printer errors: failure of one printer does not block other printers.
 */
export async function dispatchPhysicalPrintJobs(jobs: PhysicalPrinterTicketJob[]): Promise<{
  success: boolean;
  dispatchedCount: number;
  failedCount: number;
  results: Array<{ printer: string; success: boolean; error?: string }>;
}> {
  if (jobs.length === 0) {
    return { success: true, dispatchedCount: 0, failedCount: 0, results: [] };
  }

  const isVirtual = isVirtualPrintModeActive();
  const isHttpsPublic =
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    !['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    !/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(window.location.hostname);
  const defaultHost = (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== '192.168.18.195') ? window.location.hostname : '127.0.0.1';
  let storedIp = localStorage.getItem('flow_pos_print_server_ip');
  if (storedIp === '192.168.18.195') storedIp = null;
  const bridgeIp = storedIp || defaultHost;
  const bridgePort = localStorage.getItem('flow_pos_print_server_port') || '9191';
  const bridgeUrl = `http://${bridgeIp}:${bridgePort}/print`;
  const shouldSkipDirectBridge = isHttpsPublic && !storedIp;

  const results: Array<{ printer: string; success: boolean; error?: string }> = [];
  let dispatchedCount = 0;
  let failedCount = 0;

  for (const job of jobs) {
    const printerName = job.printer.name;
    const orderIdNum = /^\d+$/.test(String(job.ticket_payload.order_id)) ? Number(job.ticket_payload.order_id) : null;

    // 1. Always record in on-screen journal so user can inspect on screen
    const items = job.ticket_payload?.items || [];
    const itemNames = items.slice(0, 3).map((it: any) => `${it.qty || 1}x ${it.name}`).join(', ');
    const summaryText = items.length > 3 ? `${itemNames} +${items.length - 3} more` : (itemNames || job.ticket_type);

    recordPrintedTicket({
      id: job.idempotency_key,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      ticket_type: job.ticket_type,
      title: job.ticket_payload?.title || (job.section_key ? `${job.section_key.toUpperCase()} CHIT` : (job.ticket_type === 'receipt' ? 'RECEIPT' : 'CHIT')),
      printer_name: printerName,
      section_key: job.section_key,
      table_label: String(job.ticket_payload.table_label || job.ticket_payload.table_code || 'Direct'),
      order_id: String(job.ticket_payload.order_id || job.ticket_payload.id || ''),
      itemsCount: items.length,
      summary: summaryText,
      payload: job.ticket_payload
    });

    // 2. If Virtual / Testing Screen Print Mode is ON, skip physical network/spooler dispatch
    if (isVirtual) {
      dispatchedCount++;
      results.push({ printer: printerName, success: true });
      continue;
    }

    // 3. Dispatch to local print server bridge
    const isUsbPrinter =
      job.printer.connection_type === 'windows_driver' ||
      job.printer.connection_type === 'usb' ||
      (!job.printer.ip_address && Boolean((job.printer as any).windows_printer_name));
    const dispatchPayload = {
      destination: job.printer.name,
      printer: {
        name: job.printer.name,
        host: job.printer.ip_address,
        port: job.printer.port || 9100,
        connection_type: job.printer.connection_type,
        windows_printer_name: isUsbPrinter ? ((job.printer as any).windows_printer_name || job.printer.name) : null
      },
      content: job.ticket_payload,
      job_type: job.ticket_type,
      idempotency_key: job.idempotency_key
    };

    let printSuccess = false;
    let printError: string | undefined = undefined;

    try {
      if (shouldSkipDirectBridge) {
        throw new Error('HTTPS cloud mode: queue directly to pos_print_jobs');
      }
      const res = await fetch(bridgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dispatchPayload),
        signal: AbortSignal.timeout(5000)
      });

      if (res.ok) {
        printSuccess = true;
        dispatchedCount++;
        // Record as already sent so cloud worker will NOT re-print it!
        try {
          await supabase.from('pos_print_jobs').insert({
            restaurant_id: job.printer.restaurant_id || getGlobalRestaurantId(),
            branch_id: job.printer.branch_id,
            order_id: orderIdNum,
            printer_id: job.printer.id,
            section_key: job.section_key,
            job_type: job.ticket_type,
            status: 'sent',
            payload: job.ticket_payload,
            idempotency_key: job.idempotency_key,
            completed_at: new Date().toISOString()
          });
        } catch (dbErr) {}
      } else {
        printError = `Print server status: ${res.status}`;
        failedCount++;
      }
    } catch (fetchErr: any) {
      printError = fetchErr.message || 'Bridge unreachable';
      failedCount++;

      // LAN bridge failed: Queue into Supabase pos_print_jobs with status 'pending' as asynchronous fallback
      try {
        await supabase.from('pos_print_jobs').insert({
          restaurant_id: job.printer.restaurant_id || getGlobalRestaurantId(),
          branch_id: job.printer.branch_id,
          order_id: orderIdNum,
          printer_id: job.printer.id,
          section_key: job.section_key,
          job_type: job.ticket_type,
          status: 'pending',
          payload: job.ticket_payload,
          idempotency_key: job.idempotency_key
        });
      } catch (qErr) {
        console.warn('Could not queue fallback print job in DB:', qErr);
      }
    }

    results.push({
      printer: printerName,
      success: printSuccess,
      error: printError
    });
  }

  return {
    success: failedCount === 0,
    dispatchedCount,
    failedCount,
    results
  };
}
