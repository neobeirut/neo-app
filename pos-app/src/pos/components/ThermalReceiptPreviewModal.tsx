import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Eye, Code, FileText, AlertTriangle, ChefHat, History, Trash2, Monitor, Printer, Ban } from 'lucide-react';
import {
  getPrintedTicketsHistory,
  clearPrintedTicketsHistory,
  isVirtualPrintModeActive,
  setVirtualPrintMode,
  type PrintedTicketRecord
} from '../services/ticketRoutingService';

export interface ThermalReceiptItem {
  name: string;
  qty: number;
  quantity?: number;
  unit_price?: number;
  price?: number;
  total_price?: number;
  selectedCustomizations?: any[] | string;
  customizations?: any[] | string;
  modifiers?: any[] | string;
  customizations_print_text?: any[] | string;
  note?: string;
  comment?: string;
  notes?: string;
  isHoldSeparator?: boolean;
}

export interface ThermalReceiptData {
  title?: string;
  invoice_number?: string;
  concept_name?: string;
  isKitchenTicket?: boolean;
  isKitchenFire?: boolean;
  isSeparateFireTicket?: boolean;
  isScheduledOrder?: boolean;
  isCancellation?: boolean;
  reason?: string;
  void_reason?: string;
  type?: string;
  station?: string;
  station_code?: string;
  fireRound?: number;
  totalHolds?: number;
  isPreCheck?: boolean;
  orderId?: string | number;
  id?: string | number;
  table_code?: string | number;
  table_label?: string | number;
  table?: string | number;
  guest_count?: number;
  served_by?: string;
  waiter_name?: string;
  waiter?: string;
  server_name?: string;
  server?: string;
  cashier_name?: string;
  order_source?: string;
  order_type?: string;
  service_type?: string;
  created_at?: string;
  timestamp?: string;
  restaurant_name?: string;
  company_legal_name?: string;
  mof_number?: string;
  logo_url?: string;
  exchange_rate?: number;
  rate?: number;
  subtotal_amount?: number;
  discount_amount?: number;
  discount_label?: string;
  delivery_fee?: number;
  vat_amount?: number;
  vat_rate?: number;
  total_amount?: number;
  payment_method?: string;
  tendered_amount?: number;
  tendered_currency?: string;
  change_amount?: number;
  change_currency?: string;
  footer_message?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  items: ThermalReceiptItem[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: ThermalReceiptData | null;
  tickets?: ThermalReceiptData[];
  initialTab?: 'paper' | 'escpos' | 'history';
}

/**
 * Checks whether the ticket data represents a kitchen prep ticket / chit or cancellation chit.
 * Kitchen tickets display items, quantities, modifiers, and notes WITHOUT prices or totals.
 */
export function isKitchenTicketData(data?: ThermalReceiptData | null): boolean {
  if (!data) return false;
  if (data.isCancellation === true) return true;
  if (data.isKitchenTicket === true) return true;
  if (data.isKitchenFire === true) return true;
  if (data.isSeparateFireTicket === true) return true;
  if (data.isScheduledOrder === true) return true;
  if (data.type === 'kitchen_chit' || data.type === 'kitchen' || data.type === 'kitchen_order' || data.type === 'cancellation') return true;

  // Explicit pre-checks and customer bills are NOT kitchen tickets
  if (data.isPreCheck === true) return false;
  if (data.payment_method && !data.title?.toUpperCase().includes('KITCHEN') && !data.title?.toUpperCase().includes('CANCEL')) return false;

  const title = (data.title || '').toUpperCase();
  if (
    title.includes('KITCHEN') ||
    title.includes('FIRE') ||
    title.includes('CHIT') ||
    title.includes('COOK') ||
    title.includes('PREP') ||
    title.includes('ORDER TICKET') ||
    title.includes('CANCEL') ||
    title.includes('VOID')
  ) {
    return true;
  }

  // If a prep station is specified without being a pre-check or payment receipt
  if ((data.station || data.station_code) && !data.payment_method && !data.isPreCheck) {
    return true;
  }

  return false;
}

// 48-column monospace formatter matching ESC/POS thermal printer
export function formatEscPosText(data: ThermalReceiptData): string {
  const isKitchen = isKitchenTicketData(data);
  const isCancel = Boolean(data.isCancellation || data.type === 'cancellation' || (data.title || '').toUpperCase().includes('CANCEL') || (data.title || '').toUpperCase().includes('VOID'));
  const W = 48;
  const cols = (left: string, right: string) => {
    const l = String(left || '');
    const r = String(right || '');
    const gap = W - l.length - r.length;
    if (gap <= 0) return l.slice(0, Math.max(0, W - r.length - 1)) + ' ' + r;
    return l + ' '.repeat(gap) + r;
  };
  const center = (text: string) => {
    const str = String(text || '').trim();
    if (str.length >= W) return str.slice(0, W);
    const pad = Math.floor((W - str.length) / 2);
    return ' '.repeat(pad) + str;
  };
  const divider = (ch = '-') => ch.repeat(W);
  const fmtMoney = (n: number) => '$' + Math.abs(Number(n) || 0).toFixed(2);

  const lines: string[] = [];
  const resto = (isKitchen ? (data.concept_name || data.restaurant_name || 'Neo Beirut') : (data.restaurant_name || 'Neo Beirut')).toUpperCase();
  lines.push(center(resto));

  // ─────────────────────────────────────────────────────────────
  // 1. KITCHEN CHIT FORMAT (ITEMS, MODIFIERS, NOTES ONLY — NO PRICES)
  // ─────────────────────────────────────────────────────────────
  if (isKitchen) {
    if (isCancel) {
      lines.push(center('*** ITEM VOID / CANCELLED ***'));
      const reason = data.reason || data.void_reason || 'Item Cancelled';
      lines.push(center(`REASON: ${reason.toUpperCase()}`));
    } else {
      const rawTitle = String(data.title || data.station || 'KITCHEN')
        .replace(/\*/g, '')
        .replace(/\bPREPARATION\s+CHIT\b/i, '')
        .replace(/\bPREPARATION\s+TICKET\b/i, '')
        .replace(/\bCHIT\b/i, '')
        .trim();
      lines.push(center((rawTitle || data.station || 'KITCHEN').toUpperCase()));
    }
    if (data.station) {
      lines.push(center(`STATION: ${data.station.toUpperCase()}`));
    }
    if ((data as any).is_scheduled || (data as any).scheduled_for || data.isScheduledOrder) {
      const dueStr = (data as any).scheduled_time_display || (data as any).scheduled_for || 'SCHEDULED';
      lines.push(center('*** PRE-ORDER / SCHEDULED ***'));
      lines.push(center(`DUE TIME: ${dueStr.toUpperCase()}`));
      const sNote = (data as any).scheduled_notes || (data as any).scheduled_note;
      if (sNote) lines.push(center(`NOTE: ${sNote.toUpperCase()}`));
    }
    lines.push(divider('='));

    const orderNum = data.id || data.orderId || (data as any).order_id;
    const idStr = orderNum ? `Order: #${orderNum}` : '';
    const serviceTypeLower = String(data.service_type || data.order_type || '').toLowerCase();
    const rawTable = data.table_code || data.table_label || data.table || '';
    const hasTableValue = Boolean(rawTable && String(rawTable).trim() !== '' && String(rawTable).trim().toUpperCase() !== 'N/A');
    const isNonTableService = ['takeout', 'pickup', 'delivery', 'sell', 'direct', 'pos', 'counter', 'walkin', 'walk-in'].includes(serviceTypeLower);
    const isTableOrder = Boolean(data.table_code) || (hasTableValue && !isNonTableService);
    const tableStr = isTableOrder ? `TABLE: ${String(rawTable).replace(/^table\s+/i, '').trim()}` : '';
    const clientName = String(data.customer_name || (data as any).client_name || (!isTableOrder && hasTableValue ? rawTable : '') || '').trim();
    const d = new Date(data.created_at || Date.now());
    const p = (n: number) => String(n).padStart(2, '0');
    const dateStr = data.timestamp || `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}  ${p(d.getHours())}:${p(d.getMinutes())}`;

    if (isTableOrder) {
      lines.push(cols(tableStr, dateStr));
      if (idStr) {
        const guests = data.guest_count ? `Guests: ${data.guest_count}` : '';
        lines.push(cols(idStr, guests));
      }
    } else {
      lines.push(cols(idStr || 'Order: #N/A', dateStr));
      if (clientName) {
        lines.push(`Client  : ${clientName}`);
      }
    }

    const server = data.served_by || data.waiter_name || data.waiter || data.server_name || data.server || data.cashier_name || 'Staff';
    lines.push(`Server  : ${server}`);
    lines.push(cols(`Channel : ${data.order_source || 'POS'}`, `Type: ${data.order_type || data.service_type || 'DINE-IN'}`));
    if (data.fireRound) {
      lines.push(`Course Fire: #${data.fireRound}`);
    }
    lines.push(divider('-'));

    // Kitchen Column Header: NO PRICE COLUMN
    lines.push(isCancel ? ' QTY  [CANCELLED ITEM]' : ' QTY  ITEM');
    lines.push(divider('-'));

    let totalItemCount = 0;
    for (const item of (data.items || [])) {
      if ((item as any).name === 'HOLD' || (item as any).isHoldSeparator) continue;
      const qty = Number(item.qty ?? item.quantity ?? 1);
      totalItemCount += qty;

      // Print only item quantity and name (no prices)
      lines.push(isCancel ? ` [CANCELLED] ${String(qty).padStart(2)}x ${item.name}` : ` ${String(qty).padStart(2)}x ${item.name}`);

      // Extract modifiers
      const rawCusts = item.selectedCustomizations || item.customizations || item.modifiers || item.customizations_print_text || [];
      let modList: any[] = [];
      if (Array.isArray(rawCusts)) modList = rawCusts;
      else if (typeof rawCusts === 'string') {
        try {
          const parsed = JSON.parse(rawCusts);
          modList = Array.isArray(parsed) ? parsed : rawCusts.split(',').map(s => s.trim());
        } catch {
          modList = rawCusts.split(',').map(s => s.trim());
        }
      }

      for (const c of modList) {
        if (!c) continue;
        let name = '';
        let isRem = false;
        let groupName = '';
        let modQty = 1;
        if (typeof c === 'string') {
          name = c.trim();
          isRem = name.toLowerCase().startsWith('no ') || name.toLowerCase().startsWith('without ') || name.toLowerCase().startsWith('remove:') || name.toLowerCase().startsWith('remove ') || name.startsWith('- ');
        } else if (typeof c === 'object' && c !== null) {
          name = String(c.name || c.ingredient || c.option_name || c.label || c.customization_name || '').trim();
          groupName = String(c.option_group_name || '').trim();
          modQty = Number(c.quantity || c.qty || 1);
          const groupLower = groupName.toLowerCase();
          const typeLower = String(c.customization_type || c.type || '').toLowerCase();
          isRem = (
            c.action === 'remove' ||
            c.action === 'no' ||
            typeLower === 'removal' ||
            typeLower === 'remove' ||
            groupLower.includes('remove') ||
            name.toLowerCase().startsWith('no ') ||
            name.toLowerCase().startsWith('without ') ||
            name.toLowerCase().startsWith('remove:') ||
            name.toLowerCase().startsWith('remove ') ||
            name.startsWith('- ')
          );
        }
        if (name) {
          const cleanName = name.replace(/^\[?[-+]\s*\]?\s*/i, '').replace(/^(no|without|remove:?)\s+/i, '').replace(/\]$/, '').trim();
          const qtySuffix = modQty > 1 ? ` x${modQty}` : '';
          if (isRem) {
            lines.push(`       * REMOVE: ${cleanName || name}`);
          } else {
            const groupLower = groupName.toLowerCase();
            const isGenericAddon = !groupName || ['general', 'add on', 'add-on', 'addon', 'add-ons', 'addons', 'add ons', 'add_on', 'add_ons', 'extra', 'extras'].includes(groupLower);
            const label = isGenericAddon ? 'ADD ON' : groupName.toUpperCase();
            lines.push(`       + ${label}: ${cleanName || name}${qtySuffix}`);
          }
        }
      }

      // Extract item special note
      const note = (item.note || item.comment || item.notes || '').trim();
      if (note) lines.push(`       * Note: ${note}`);
    }

    lines.push(divider('-'));
    // Kitchen Footer: Total Items only, NO financial prices, taxes, or MOF
    lines.push(cols(isCancel ? 'CANCELLED ITEMS:' : 'TOTAL ITEMS:', String(totalItemCount)));
    lines.push(divider('-'));

    if (data.footer_message) {
      lines.push(center(data.footer_message));
    }

    return lines.join('\n');
  }

  // ─────────────────────────────────────────────────────────────
  // 2. GUEST CHECK / BILL / FISCAL INVOICE FORMAT (FULL PRICING & TOTALS)
  // ─────────────────────────────────────────────────────────────
  if (data.invoice_number) {
    if (data.concept_name) {
      lines.push(center(data.concept_name.toUpperCase()));
    }
    lines.push(center(`*** RECEIPT ***`));
    lines.push(center(`NO: ${data.invoice_number}`));
  } else {
    lines.push(center(data.isPreCheck ? '*** GUEST CHECK / BILL ***' : '*** RECEIPT ***'));
  }
  lines.push(divider('='));

  const idStr = data.id ? `#${data.id}` : (data.table_code ? `Table ${data.table_code}` : '');
  const d = new Date(data.created_at || Date.now());
  const p = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}  ${p(d.getHours())}:${p(d.getMinutes())}`;
  lines.push(cols(idStr, dateStr));

  if (data.table_code) {
    const guests = data.guest_count ? `Guests: ${data.guest_count}` : '';
    lines.push(cols(`Table   : ${data.table_code}`, guests));
  }

  const server = data.served_by || data.waiter_name || data.server_name || data.cashier_name || 'Staff';
  lines.push(`Served by: ${server}`);
  lines.push(cols(`Channel : ${data.order_source || 'POS'}`, `Type: ${data.order_type || 'DINE-IN'}`));
  if (data.is_scheduled || data.scheduled_for || data.isScheduledOrder) {
    const dueStr = data.scheduled_time_display || data.scheduled_for || 'SCHEDULED';
    lines.push(divider('-'));
    lines.push(center('*** PRE-ORDER / SCHEDULED ***'));
    lines.push(center(`DUE FOR: ${dueStr}`));
    const sNote = data.scheduled_notes || data.scheduled_note;
    if (sNote) lines.push(center(`NOTE: ${sNote}`));
  }
  lines.push(divider('-'));

  lines.push(cols(' QTY  ITEM', 'PRICE (USD)'));
  lines.push(divider('-'));

  let calcSubtotal = 0;
  for (const item of (data.items || [])) {
    const qty = Number(item.qty || 1);
    const unit = Number(item.unit_price ?? item.price ?? (item.total_price && qty > 0 ? item.total_price / qty : 0)) || 0;
    const lineTotal = Number(item.total_price ?? (unit * qty)) || 0;
    calcSubtotal += lineTotal;

    lines.push(cols(` ${String(qty).padStart(2)}x ${item.name}`, fmtMoney(lineTotal)));

    const rawCusts = item.selectedCustomizations || item.customizations || item.modifiers || item.customizations_print_text || [];
    let modList: any[] = [];
    if (Array.isArray(rawCusts)) modList = rawCusts;
    else if (typeof rawCusts === 'string') {
      try {
        const parsed = JSON.parse(rawCusts);
        modList = Array.isArray(parsed) ? parsed : rawCusts.split(',').map(s => s.trim());
      } catch {
        modList = rawCusts.split(',').map(s => s.trim());
      }
    }

    for (const c of modList) {
      if (!c) continue;
      let name = '';
      let price = 0;
      if (typeof c === 'object' && c !== null) {
        name = (c.name || c.ingredient || c.option_name || c.label || '').trim();
        price = Number(c.price || c.unit_price || 0);
      }
      // On customer bills, strictly skip zero-value modifiers (like choices, removals, and free add-ons)
      if (price <= 0) continue;

      if (name) lines.push(`       + ${name} (+$${fmtMoney(price)})`);
    }

    const note = (item.note || item.comment || item.notes || '').trim();
    if (note) lines.push(`       * Note: ${note}`);
  }

  lines.push(divider('-'));
  const sub = Number(data.subtotal_amount ?? calcSubtotal) || 0;
  const disc = Number(data.discount_amount || 0);
  const total = Number(data.total_amount ?? (sub - disc)) || 0;

  lines.push(cols('', `Subtotal :  ${fmtMoney(sub)}`));
  if (disc > 0) lines.push(cols('', `Discount : -${fmtMoney(disc)}`));
  lines.push(divider('-'));

  lines.push(cols('TOTAL USD:', fmtMoney(total)));
  const rate = Number(data.exchange_rate || data.rate || 90000);
  if (rate > 0) {
    const totalLbp = Math.round(total * rate);
    lines.push(cols('TOTAL LBP:', `${totalLbp.toLocaleString('en-US')} LBP`));
  }
  lines.push(divider('-'));

  const legalName = data.company_legal_name || (typeof window !== 'undefined' ? localStorage.getItem('flow_pos_company_legal_name') : null) || 'Neo Beirut S.A.L.';
  const mofNumber = data.mof_number || (typeof window !== 'undefined' ? localStorage.getItem('flow_pos_mof_number') : null) || '382910-601';

  lines.push(center(legalName));
  lines.push(center(`M.O.F: ${mofNumber}`));
  if (rate > 0) {
    lines.push(center(`Rate: 1 USD = ${rate.toLocaleString('en-US')} LBP`));
  }
  lines.push(divider('-'));

  if (data.footer_message) {
    lines.push(center(data.footer_message));
  }

  return lines.join('\n');
}

export const ThermalReceiptPreviewModal: React.FC<Props> = ({ isOpen, onClose, data, tickets, initialTab = 'paper' }) => {
  const [activeTab, setActiveTab] = useState<'paper' | 'escpos' | 'history'>(initialTab);
  const [copied, setCopied] = useState(false);
  const [virtualMode, setVirtualMode] = useState<boolean>(isVirtualPrintModeActive());
  const [historyList, setHistoryList] = useState<PrintedTicketRecord[]>([]);
  const [currentTicket, setCurrentTicket] = useState<ThermalReceiptData | null>(data);
  const [ticketList, setTicketList] = useState<ThermalReceiptData[]>([]);
  const [selectedTicketIdx, setSelectedTicketIdx] = useState<number>(0);

  // Sync with prop changes
  useEffect(() => {
    if (tickets && tickets.length > 0) {
      setTicketList(tickets);
      setSelectedTicketIdx(0);
      setCurrentTicket(tickets[0]);
    } else if (data) {
      setTicketList([data]);
      setSelectedTicketIdx(0);
      setCurrentTicket(data);
    } else if (!currentTicket) {
      const hist = getPrintedTicketsHistory();
      if (hist.length > 0 && hist[0].payload) {
        setTicketList(hist.map(h => h.payload).filter(Boolean));
        setCurrentTicket(hist[0].payload);
      }
    }
  }, [data, tickets]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setHistoryList(getPrintedTicketsHistory());
      setVirtualMode(isVirtualPrintModeActive());
    }
  }, [isOpen, initialTab]);

  // Listen to print events across window
  useEffect(() => {
    const refreshHistory = () => {
      setHistoryList(getPrintedTicketsHistory());
      setVirtualMode(isVirtualPrintModeActive());
    };
    refreshHistory();

    window.addEventListener('flow_pos_ticket_printed', refreshHistory);
    window.addEventListener('flow_pos_ticket_printed_cleared', refreshHistory);
    window.addEventListener('flow_pos_virtual_mode_changed', refreshHistory);

    return () => {
      window.removeEventListener('flow_pos_ticket_printed', refreshHistory);
      window.removeEventListener('flow_pos_ticket_printed_cleared', refreshHistory);
      window.removeEventListener('flow_pos_virtual_mode_changed', refreshHistory);
    };
  }, []);

  if (!isOpen) return null;

  // Use current ticket or fallback to initial data or most recent printed record
  const activeTicketData: ThermalReceiptData | null = currentTicket || data || (historyList.length > 0 ? (historyList[0].payload as ThermalReceiptData) : null);

  const isKitchen = isKitchenTicketData(activeTicketData);
  const isCancel = Boolean(
    activeTicketData?.isCancellation ||
    activeTicketData?.type === 'cancellation' ||
    (activeTicketData?.title || '').toUpperCase().includes('CANCEL') ||
    (activeTicketData?.title || '').toUpperCase().includes('VOID')
  );

  const restoName = (activeTicketData?.restaurant_name || (typeof window !== 'undefined' ? localStorage.getItem('flow_pos_restaurant_name') : null) || 'Neo Beirut').toUpperCase();
  const conceptHeaderName = (activeTicketData?.concept_name || restoName).toUpperCase();
  const legalName = activeTicketData?.company_legal_name || (typeof window !== 'undefined' ? localStorage.getItem('flow_pos_company_legal_name') : null) || 'Neo Beirut S.A.L.';
  const mofNumber = activeTicketData?.mof_number || (typeof window !== 'undefined' ? localStorage.getItem('flow_pos_mof_number') : null) || '382910-601';
  const previewConceptId = (activeTicketData as any)?.concept_id;
  const previewConceptCode = (activeTicketData as any)?.concept_code;
  const previewConceptName = activeTicketData?.concept_name;
  const hasExplicitPreviewConcept = Boolean(previewConceptId || previewConceptCode || previewConceptName);
  const isDefaultNeoPreview =
    !hasExplicitPreviewConcept ||
    previewConceptId === '00000000-0000-0000-0000-000000000001' ||
    String(previewConceptCode || '').toUpperCase() === 'NEO' ||
    String(previewConceptName || '').toUpperCase().startsWith('NÉO') ||
    String(previewConceptName || '').toUpperCase().startsWith('NEO');
  const logoUrl =
    (typeof window !== 'undefined' && previewConceptId
      ? localStorage.getItem(`flow_pos_concept_logo_${previewConceptId}`)
      : null) ||
    (typeof window !== 'undefined' && previewConceptCode
      ? localStorage.getItem(`flow_pos_concept_logo_${String(previewConceptCode).toUpperCase()}`)
      : null) ||
    (activeTicketData?.logo_url && (isDefaultNeoPreview || !String(activeTicketData.logo_url).toLowerCase().includes('neobeirut.com'))
      ? activeTicketData.logo_url
      : '') ||
    (isDefaultNeoPreview && typeof window !== 'undefined'
      ? (localStorage.getItem('flow_pos_logo_url') || localStorage.getItem('flow_pos_restaurant_logo'))
      : null) ||
    '';
  const exchangeRate = Number(activeTicketData?.exchange_rate || activeTicketData?.rate || 90000);
  const serverName = activeTicketData?.served_by || activeTicketData?.waiter_name || activeTicketData?.waiter || activeTicketData?.server_name || activeTicketData?.server || activeTicketData?.cashier_name || 'Staff';
  const rawTableCode = activeTicketData?.table_code || activeTicketData?.table_label || activeTicketData?.table;
  const serviceTypeLower = String(activeTicketData?.service_type || activeTicketData?.order_type || '').toLowerCase();
  const hasTableVal = Boolean(rawTableCode && String(rawTableCode).trim() !== '' && String(rawTableCode).trim().toUpperCase() !== 'N/A');
  const isNonTableService = ['takeout', 'pickup', 'delivery', 'sell', 'direct', 'pos', 'counter', 'walkin', 'walk-in'].includes(serviceTypeLower);
  const isTableOrder = Boolean(activeTicketData?.table_code) || (hasTableVal && !isNonTableService);
  const tableCode = isTableOrder ? String(rawTableCode).replace(/^table\s+/i, '').trim() : undefined;
  const orderNumber = activeTicketData?.id || activeTicketData?.orderId || (activeTicketData as any)?.order_id;
  const clientName = String(activeTicketData?.customer_name || (activeTicketData as any)?.client_name || (!isTableOrder && hasTableVal ? rawTableCode : '') || '').trim();
  const guestCount = activeTicketData?.guest_count || 1;
  const footerMessage = activeTicketData?.footer_message || (isKitchen ? '' : 'Thank you for dining with us! Come back soon.');

  let calcSubtotal = 0;
  const items = (activeTicketData?.items || []).filter(i => (i as any).name !== 'HOLD' && !(i as any).isHoldSeparator).map(i => {
    const qty = Number(i.qty ?? i.quantity ?? 1);
    const unitPrice = Number(
      i.unit_price !== undefined ? i.unit_price :
      i.price !== undefined ? i.price :
      (i.total_price && qty > 0 ? i.total_price / qty : 0)
    ) || 0;
    const lineTotal = Number(i.total_price !== undefined ? i.total_price : (unitPrice * qty)) || 0;
    calcSubtotal += lineTotal;

    const rawCusts = i.selectedCustomizations || i.customizations || i.modifiers || i.customizations_print_text || [];
    let modList: any[] = [];
    if (Array.isArray(rawCusts)) modList = rawCusts;
    else if (typeof rawCusts === 'string') {
      try {
        const parsed = JSON.parse(rawCusts);
        modList = Array.isArray(parsed) ? parsed : rawCusts.split(',').map(s => s.trim());
      } catch {
        modList = rawCusts.split(',').map(s => s.trim());
      }
    }

    const note = (i.note || i.comment || i.notes || '').trim();

    return {
      name: i.name,
      qty,
      unitPrice,
      lineTotal,
      modifiers: modList,
      note
    };
  });

  const totalItemsCount = items.reduce((sum, it) => sum + it.qty, 0);
  const subtotal = Number(activeTicketData?.subtotal_amount !== undefined ? activeTicketData.subtotal_amount : calcSubtotal) || 0;
  const discount = Number(activeTicketData?.discount_amount || 0);
  const totalUsd = Number(activeTicketData?.total_amount !== undefined ? activeTicketData.total_amount : (subtotal - discount)) || 0;
  const totalLbp = Math.round(totalUsd * exchangeRate);

  const formattedDate = () => {
    if (activeTicketData?.timestamp) return activeTicketData.timestamp;
    const d = new Date(activeTicketData?.created_at || Date.now());
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}  ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  const rawEscPos = activeTicketData ? formatEscPosText(activeTicketData) : '';

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(rawEscPos);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleToggleVirtualMode = () => {
    const next = !virtualMode;
    setVirtualPrintMode(next);
    setVirtualMode(next);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 w-full max-w-2xl max-h-[94vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-900">
        {/* Top Notification Banner */}
        <div className={`border-b px-4 py-2.5 flex items-center justify-between text-xs font-semibold ${
          isCancel
            ? 'bg-rose-50 border-rose-200 text-rose-950'
            : isKitchen 
            ? 'bg-amber-50 border-amber-200 text-amber-900' 
            : 'bg-emerald-50 border-emerald-200 text-emerald-950'
        }`}>
          <div className="flex items-center gap-2">
            {isCancel ? (
              <Ban className="w-4 h-4 text-rose-600 shrink-0" />
            ) : isKitchen ? (
              <ChefHat className="w-4 h-4 text-amber-700 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#1e5c4f] shrink-0" />
            )}
            <span>
              <strong>
                {isCancel 
                  ? 'ITEM VOID / CANCELLATION:' 
                  : isKitchen 
                  ? 'KITCHEN CHIT:' 
                  : 'RECEIPT PREVIEW:'}
              </strong>{' '}
              {isCancel
                ? 'Reviewing cancellation chit sent to kitchen. Shows voided items and reason.'
                : isKitchen 
                ? 'Reviewing kitchen ticket layout. Items, modifiers & notes (prices omitted).'
                : 'Reviewing customer receipt. Company info & MOF at bottom.'}
            </span>
          </div>

          {/* Screen Print Mode Toggle Button */}
          <button
            type="button"
            onClick={handleToggleVirtualMode}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black border transition cursor-pointer shadow-xs ${
              virtualMode
                ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'
            }`}
            title="When active, all print jobs render on screen without needing physical printer hardware"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Screen Mode: {virtualMode ? 'ON (Virtual)' : 'OFF (Physical)'}</span>
          </button>
        </div>

        {/* Header Controls */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              isCancel
                ? 'bg-rose-100 text-rose-700 border-rose-300'
                : isKitchen 
                ? 'bg-amber-100 text-amber-700 border-amber-300'
                : 'bg-emerald-100 text-emerald-700 border-emerald-300'
            }`}>
              {isCancel ? <Ban className="w-4 h-4" /> : isKitchen ? <ChefHat className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>
                  {isCancel
                    ? 'Cancellation Chit'
                    : isKitchen 
                    ? 'Kitchen Chit' 
                    : 'Customer Receipt'}
                </span>
                {activeTicketData && (
                  <span className="text-[11px] font-normal text-slate-500">
                    {tableCode ? `(Table ${tableCode})` : `#${activeTicketData.id || activeTicketData.orderId || 'Order'}`}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-500">
                {isCancel
                  ? 'Voided items dispatched to food prep station'
                  : isKitchen 
                  ? 'Kitchen & Prep Printer Format (No Prices)' 
                  : 'Thermal 48-Col Format with Logo & MOF'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher: Paper Slip vs Raw ESC/POS vs Print Log */}
            <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex items-center text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('paper')}
                className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'paper' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Paper Slip</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('escpos')}
                className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'escpos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>ESC/POS</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'history' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="View recent print jobs"
              >
                <History className="w-3.5 h-3.5" />
                <span>Print Log</span>
                {historyList.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-slate-800 text-white text-[10px] font-black">
                    {historyList.length}
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyText}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition cursor-pointer"
              title="Copy receipt text to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 border border-slate-200 transition cursor-pointer"
              title="Close Preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-200/90 flex justify-center items-start">
          {activeTab === 'history' ? (
            /* ── PRINT LOG & JOURNAL VIEW ── */
            <div className="w-full max-w-xl bg-white rounded-xl shadow-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span>🖨️ On-Screen Print Log</span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {historyList.length} tickets
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live capture of all bills, kitchen prep tickets, and cancellation chits for on-screen verification.
                  </p>
                </div>
                {historyList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearPrintedTicketsHistory();
                      setHistoryList([]);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 rounded-lg border border-rose-200 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Log</span>
                  </button>
                )}
              </div>

              {historyList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <Printer className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">No printed tickets recorded yet.</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Print a bill, send food to the kitchen, or cancel an item in POS to inspect its slip here without hardware.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[58vh] overflow-y-auto pr-1">
                  {historyList.map((item) => {
                    const isItemVoid = item.ticket_type === 'cancellation' || (item.title || '').toUpperCase().includes('CANCEL') || (item.title || '').toUpperCase().includes('VOID');
                    const isItemBill = item.ticket_type === 'receipt' || (item.title || '').toUpperCase().includes('RECEIPT') || (item.title || '').toUpperCase().includes('CHECK');
                    const isItemBar = !isItemVoid && !isItemBill && (item.section_key?.toLowerCase().includes('bar') || (item.title || '').toUpperCase().includes('BAR'));
                    const d = new Date(item.timestamp);
                    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                          isItemVoid
                            ? 'bg-rose-50/70 border-rose-200 hover:border-rose-300'
                            : isItemBill
                            ? 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300'
                            : isItemBar
                            ? 'bg-purple-50/70 border-purple-200 hover:border-purple-300'
                            : 'bg-amber-50/70 border-amber-200 hover:border-amber-300'
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                              isItemVoid
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : isItemBill
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : isItemBar
                                ? 'bg-purple-100 text-purple-800 border-purple-300'
                                : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}>
                              {isItemVoid ? 'VOID / CANCEL' : isItemBill ? 'RECEIPT / BILL' : isItemBar ? '🍸 BAR PREP' : '🍳 KITCHEN PREP'}
                            </span>
                            <span className="text-xs font-black text-slate-900 truncate">
                              {item.title}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {timeStr}
                            </span>
                          </div>
                          <div className="text-xs text-slate-700 flex items-center gap-3">
                            {item.table_label && (
                              <span className="font-bold">Table: {item.table_label}</span>
                            )}
                            {item.order_id && (
                              <span className="text-slate-500">#{item.order_id}</span>
                            )}
                            <span className="text-slate-600 truncate">
                              Target: {item.printer_name}
                            </span>
                          </div>
                          {item.summary && (
                            <div className="text-[11px] text-slate-600 truncate italic">
                              {item.summary}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (item.payload) {
                              setCurrentTicket(item.payload);
                              setActiveTab('paper');
                            }
                          }}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-900 text-xs font-black rounded-lg border border-slate-300 transition shrink-0 flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Slip</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'paper' ? (
            /* ── REALISTIC THERMAL PAPER SLIP ── */
            !activeTicketData ? (
              <div className="text-center py-12 text-slate-500">
                <Printer className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                <p className="text-xs font-bold">No ticket selected</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="mt-2 text-xs text-[#1e5c4f] font-bold underline"
                >
                  View Print Log
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                {ticketList.length > 1 && (
                  <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-300 shadow-sm mb-3">
                    <span className="text-[10px] font-black text-slate-500 uppercase px-1">Stations:</span>
                    {ticketList.map((t, idx) => {
                      const isBar = (t.station || t.title || '').toLowerCase().includes('bar');
                      const isKitchen = (t.station || t.title || '').toLowerCase().includes('kitchen');
                      const label = t.station || (isBar ? 'Bar Chit' : isKitchen ? 'Kitchen Chit' : `Chit #${idx + 1}`);
                      const isSelected = selectedTicketIdx === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSelectedTicketIdx(idx);
                            setCurrentTicket(t);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? isBar
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-amber-600 text-white shadow-xs'
                              : 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                          }`}
                        >
                          <span>{isBar ? '🍸' : isKitchen ? '🍳' : '📋'}</span>
                          <span>{label}</span>
                          <span className="text-[10px] opacity-80">({t.items?.length || 0})</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="w-[370px] bg-[#FAF8F5] text-slate-900 rounded-sm shadow-2xl p-6 font-mono text-[13px] leading-tight select-text border-t-8 border-b-8 border-dashed border-[#D9D5CD] relative">
                {isKitchen ? (
                  /* ═════════════════════════════════════════════════════════════ */
                  /* KITCHEN CHIT / CANCELLATION CHIT (ITEMS, MODIFIERS, NOTES)  */
                  /* ═════════════════════════════════════════════════════════════ */
                  <>
                    {/* Cancellation Top Alert Box */}
                    {isCancel && (
                      <div className="bg-rose-100 border-2 border-rose-500 rounded p-2 text-center mb-3">
                        <div className="text-[14px] font-black text-rose-700 tracking-wide">
                          *** ITEM VOID / CANCELLED ***
                        </div>
                        <div className="text-[11px] font-extrabold text-rose-900 mt-1 uppercase">
                          REASON: {activeTicketData.reason || activeTicketData.void_reason || 'Item Cancelled'}
                        </div>
                      </div>
                    )}

                    {/* Kitchen Header */}
                    <div className="text-center pb-2">
                      <h1 className="text-xl font-black tracking-wider text-black">{conceptHeaderName}</h1>
                      <div className={`text-[13px] font-black mt-1 uppercase tracking-wide ${isCancel ? 'text-rose-700' : 'text-amber-900'}`}>
                        {isCancel
                          ? '*** CANCELLATION ***'
                          : (String(activeTicketData.title || activeTicketData.station || 'KITCHEN')
                              .replace(/\*/g, '')
                              .replace(/\bPREPARATION\s+CHIT\b/i, '')
                              .replace(/\bPREPARATION\s+TICKET\b/i, '')
                              .replace(/\bCHIT\b/i, '')
                              .trim() || activeTicketData.station || 'KITCHEN')}
                      </div>
                      {activeTicketData.station && (
                        <div className="text-[11px] font-bold text-amber-800 mt-0.5">
                          STATION: {activeTicketData.station.toUpperCase()}
                        </div>
                      )}
                      {activeTicketData.fireRound && (
                        <div className="text-[11px] font-extrabold text-orange-700 mt-0.5">
                          COURSE FIRE: #{activeTicketData.fireRound}
                        </div>
                      )}
                    </div>

                    <div className="border-b-2 border-slate-900 my-2" />

                    {/* Order Metadata */}
                    <div className="space-y-0.5 text-[12px] text-slate-800">
                      {isTableOrder ? (
                        <>
                          <div className="flex justify-between">
                            <span className="font-bold">TABLE: {tableCode}</span>
                            <span>{formattedDate()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{orderNumber ? `Order #${orderNumber}` : ''}</span>
                            <span>{guestCount ? `Guests: ${guestCount}` : ''}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span className="font-bold">Order: #{orderNumber || 'N/A'}</span>
                            <span>{formattedDate()}</span>
                          </div>
                          {clientName && (
                            <div className="font-bold text-slate-950">
                              Client: {clientName}
                            </div>
                          )}
                        </>
                      )}
                      <div className="font-bold text-slate-950">
                        Server: {serverName}
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Channel : {activeTicketData.order_source || 'POS'}</span>
                        <span>Type: {activeTicketData.order_type || activeTicketData.service_type || 'DINE-IN'}</span>
                      </div>
                    </div>

                    <div className="border-b border-dashed border-slate-400 my-2" />

                    {/* Items Column Header - NO PRICE COLUMN */}
                    <div className="font-extrabold text-[12px] text-slate-950 pb-1">
                      <span>{isCancel ? 'QTY  [CANCELLED ITEM]' : 'QTY  ITEM'}</span>
                    </div>
                    <div className="border-b border-slate-400 mb-2" />

                    {/* Line Items */}
                    <div className="space-y-2 text-[13px]">
                      {items.length === 0 ? (
                        <div className="text-center py-4 text-slate-400 italic">No items on this ticket</div>
                      ) : (
                        items.map((item, idx) => (
                          <div key={idx} className={`space-y-0.5 p-1 rounded ${isCancel ? 'bg-rose-50 border border-rose-200' : ''}`}>
                            <div className="flex items-start">
                              <span className={`inline-block w-8 font-black text-[14px] shrink-0 ${isCancel ? 'text-rose-700' : 'text-slate-950'}`}>
                                {item.qty}x
                              </span>
                              <span className={`font-bold text-[14px] flex-1 ${isCancel ? 'text-rose-900' : 'text-black'}`}>
                                {item.name}
                                {isCancel && (
                                  <span className="text-[10px] bg-rose-200 text-rose-800 px-1 rounded ml-1 font-black">
                                    CANCELLED
                                  </span>
                                )}
                              </span>
                            </div>

                            {/* Modifiers */}
                            {item.modifiers.length > 0 && (
                              <div className="pl-8 space-y-0.5 text-[12px]">
                                {item.modifiers.map((mod: any, mIdx: number) => {
                                  let modName = '';
                                  let isRemoval = false;
                                  let groupName = '';
                                  let modQty = 1;
                                  if (typeof mod === 'string') {
                                    modName = mod.trim();
                                    isRemoval = modName.toLowerCase().startsWith('no ') || modName.toLowerCase().startsWith('without ') || modName.toLowerCase().startsWith('remove:') || modName.toLowerCase().startsWith('remove ') || modName.startsWith('- ');
                                  } else if (typeof mod === 'object' && mod !== null) {
                                    modName = String(mod.name || mod.ingredient || mod.option_name || mod.label || mod.customization_name || '').trim();
                                    groupName = String(mod.option_group_name || '').trim();
                                    modQty = Number(mod.quantity || mod.qty || 1);
                                    const groupLower = groupName.toLowerCase();
                                    const typeLower = String(mod.customization_type || mod.type || '').toLowerCase();
                                    isRemoval = (
                                      mod.action === 'remove' ||
                                      mod.action === 'no' ||
                                      typeLower === 'removal' ||
                                      typeLower === 'remove' ||
                                      groupLower.includes('remove') ||
                                      modName.toLowerCase().startsWith('no ') ||
                                      modName.toLowerCase().startsWith('without ') ||
                                      modName.toLowerCase().startsWith('remove:') ||
                                      modName.toLowerCase().startsWith('remove ') ||
                                      modName.startsWith('- ')
                                    );
                                  }
                                  if (!modName) return null;
                                  const cleanModName = modName.replace(/^\[?[-+]\s*\]?\s*/i, '').replace(/^(no|without|remove:?)\s+/i, '').replace(/\]$/, '').trim();
                                  const qtySuffix = modQty > 1 ? ` x${modQty}` : '';
                                  const groupLower = groupName.toLowerCase();
                                  const isGenericAddon = !groupName || ['general', 'add on', 'add-on', 'addon', 'add-ons', 'addons', 'add ons', 'add_on', 'add_ons', 'extra', 'extras'].includes(groupLower);
                                  const label = isGenericAddon ? 'ADD ON' : groupName.toUpperCase();
                                  return (
                                    <div key={mIdx} className={isRemoval ? 'text-rose-700 font-bold tracking-wide' : 'text-slate-800 font-semibold'}>
                                      {isRemoval ? `* REMOVE: ${cleanModName || modName}` : `+ ${label}: ${cleanModName || modName}${qtySuffix}`}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Item Special Instructions / Note */}
                            {item.note && (
                              <div className="pl-8 text-[11px] text-amber-900 font-bold italic">
                                * Note: {item.note}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="border-b border-dashed border-slate-400 my-2.5" />

                    {/* Kitchen Footer - Total Item Count Only */}
                    <div className="flex justify-between items-center text-[12px] font-black text-slate-950">
                      <span>{isCancel ? 'CANCELLED ITEMS:' : 'TOTAL ITEMS:'}</span>
                      <span className="tabular-nums">{totalItemsCount}</span>
                    </div>

                    <div className="border-b border-dashed border-slate-400 my-2.5" />

                    {footerMessage && (
                      <div className="text-center text-[11px] text-slate-600 italic px-2 mb-2">
                        {footerMessage}
                      </div>
                    )}
                  </>
                ) : (
                  /* ═════════════════════════════════════════════════════════════ */
                  /* GUEST CHECK / BILL: FULL FINANCIAL PRICING, TOTALS & TAXES   */
                  /* ═════════════════════════════════════════════════════════════ */
                  <>
                    {/* Restaurant Header */}
                    <div className="text-center pb-2">
                      {logoUrl ? (
                        <div className="flex flex-col items-center justify-center mb-1">
                          <img
                            src={logoUrl}
                            alt={restoName}
                            className="max-h-14 max-w-[190px] object-contain filter grayscale contrast-125 mb-1"
                          />
                        </div>
                      ) : (
                        <h1 className="text-xl font-black tracking-wider text-black">{restoName}</h1>
                      )}
                      <div className="text-[13px] font-bold text-slate-800 mt-1">
                        {activeTicketData.isPreCheck
                          ? '*** GUEST CHECK / BILL ***'
                          : (activeTicketData as any).is_reprint || String(activeTicketData.title || '').toUpperCase().includes('REPRINT')
                            ? '*** REPRINTED RECEIPT ***'
                            : '*** RECEIPT ***'}
                      </div>
                    </div>

                    <div className="border-b-2 border-slate-900 my-2" />

                    {/* Order Metadata */}
                    <div className="space-y-0.5 text-[12px] text-slate-800">
                      <div className="flex justify-between">
                        <span className="font-bold">{tableCode ? `Table ${tableCode}` : `#${activeTicketData.id || 'ORDER'}`}</span>
                        <span>{formattedDate()}</span>
                      </div>
                      {tableCode && (
                        <div className="flex justify-between">
                          <span>Table   : {tableCode}</span>
                          <span>Guests: {guestCount}</span>
                        </div>
                      )}
                      {!tableCode && clientName && (
                        <div className="font-bold text-slate-950">
                          Client: {clientName}
                        </div>
                      )}
                      {!tableCode && (activeTicketData as any).customer_phone && (
                        <div className="text-slate-700">
                          Phone: {(activeTicketData as any).customer_phone}
                        </div>
                      )}
                      {!tableCode && (activeTicketData as any).delivery_address && (
                        <div className="text-slate-700">
                          Address: {(activeTicketData as any).delivery_address}
                        </div>
                      )}
                      <div className="font-bold text-slate-950">
                        Served by: {serverName}
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Channel : {activeTicketData.order_source || 'POS'}</span>
                        <span>Type: {activeTicketData.order_type || 'DINE-IN'}</span>
                      </div>
                    </div>

                    <div className="border-b border-dashed border-slate-400 my-2" />

                    {/* Items Column Header */}
                    <div className="flex justify-between font-extrabold text-[12px] text-slate-950 pb-1">
                      <span>QTY  ITEM</span>
                      <span>PRICE (USD)</span>
                    </div>
                    <div className="border-b border-slate-400 mb-2" />

                    {/* Line Items - Increased font of item line */}
                    <div className="space-y-2.5">
                      {items.length === 0 ? (
                        <div className="text-center py-4 text-slate-400 italic">No items on this ticket</div>
                      ) : (
                        items.map((item, idx) => (
                          <div key={idx} className="space-y-0.5">
                            <div className="flex justify-between items-start font-bold text-[14px] leading-tight">
                              <span className="flex-1 pr-2 flex items-start">
                                <span className="inline-block w-7 text-black font-black shrink-0">{item.qty}x</span>
                                <span className="text-black font-bold">{item.name}</span>
                              </span>
                              <span className="text-right tabular-nums text-black font-black shrink-0">
                                ${item.lineTotal.toFixed(2)}
                              </span>
                            </div>

                            {/* Modifiers: On customer bill, only priced add-ons are displayed */}
                            {item.modifiers.filter((mod: any) => typeof mod === 'object' && Number(mod.price) > 0).length > 0 && (
                              <div className="pl-7 space-y-0.5 text-[12px] text-slate-600">
                                {item.modifiers
                                  .filter((mod: any) => typeof mod === 'object' && Number(mod.price) > 0)
                                  .map((mod: any, mIdx: number) => {
                                    const modName = (mod.name || mod.ingredient || mod.option_name || '').trim();
                                    const price = Number(mod.price || 0);
                                    return (
                                      <div key={mIdx} className="flex justify-between items-center text-slate-700 font-medium">
                                        <span>+ {modName}</span>
                                        <span className="font-mono text-slate-800 font-bold">+${price.toFixed(2)}</span>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}

                            {/* Item Special Instructions / Note */}
                            {item.note && (
                              <div className="pl-7 text-[12px] text-amber-800 italic">
                                * Note: {item.note}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="border-b border-dashed border-slate-400 my-2.5" />

                    {/* Financial Subtotals */}
                    <div className="space-y-1 text-[11px] text-slate-800">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="tabular-nums">${subtotal.toFixed(2)}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-rose-700 font-medium">
                          <span>Discount:</span>
                          <span className="tabular-nums">-${discount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-b-2 border-slate-900 my-2" />

                    {/* TOTAL USD & LBP on same line */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-baseline text-base font-black text-black">
                        <span>TOTAL USD:</span>
                        <span className="tabular-nums">${totalUsd.toFixed(2)}</span>
                      </div>
                      {exchangeRate > 0 && (
                        <div className="flex justify-between items-baseline text-[13px] font-black text-slate-900">
                          <span>TOTAL LBP:</span>
                          <span className="tabular-nums">{totalLbp.toLocaleString('en-US')} LBP</span>
                        </div>
                      )}
                    </div>

                    <div className="border-b border-dashed border-slate-400 my-3" />

                    {/* Company Legal Information & Rate Under MOF */}
                    <div className="text-center text-[11px] text-slate-700 space-y-0.5">
                      <div className="font-bold text-slate-900">{legalName}</div>
                      <div>M.O.F: {mofNumber}</div>
                      {exchangeRate > 0 && (
                        <div className="text-[10px] text-slate-500 pt-0.5 font-medium">
                          Rate: 1 USD = {exchangeRate.toLocaleString('en-US')} LBP
                        </div>
                      )}
                    </div>

                    <div className="border-b border-dashed border-slate-400 my-2.5" />

                    {/* Bottom Custom Message */}
                    {footerMessage && (
                      <div className="text-center text-[11px] text-slate-600 italic px-2">
                        {footerMessage}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
          ) : (
            /* ── RAW 48-COLUMN MONOSPACE VIEW ── */
            <div className="w-full bg-[#05070A] border border-[#1E2536] rounded-xl p-4 overflow-x-auto">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1E2536] text-xs text-slate-400">
                <span>Exact 48-Char ESC/POS Monospace Stream:</span>
                <span className="font-mono text-emerald-400">{rawEscPos.split('\n').length} lines</span>
              </div>
              <pre className="font-mono text-xs leading-relaxed text-emerald-300 selection:bg-emerald-900 whitespace-pre">
                {rawEscPos}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            {copied ? 'Copied to clipboard!' : 'Preview ready. Click close or tap anywhere outside.'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#1e5c4f]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-[#1e5c4f] hover:bg-[#16473D] text-white text-xs font-black rounded-lg transition shadow-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
