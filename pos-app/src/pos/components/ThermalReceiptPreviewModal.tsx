import React, { useState } from 'react';
import { X, Copy, Check, Eye, Code, FileText, AlertTriangle, ChefHat } from 'lucide-react';

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
}

/**
 * Checks whether the ticket data represents a kitchen prep ticket / chit
 * (e.g. kitchen print, fire round, station chit, scheduled kitchen order).
 * Kitchen tickets must strictly display items, quantities, modifiers, and notes WITHOUT prices or totals.
 */
export function isKitchenTicketData(data?: ThermalReceiptData | null): boolean {
  if (!data) return false;
  if (data.isKitchenTicket === true) return true;
  if (data.isKitchenFire === true) return true;
  if (data.isSeparateFireTicket === true) return true;
  if (data.isScheduledOrder === true) return true;
  if (data.type === 'kitchen_chit' || data.type === 'kitchen' || data.type === 'kitchen_order') return true;

  // Explicit pre-checks and customer bills are NOT kitchen tickets
  if (data.isPreCheck === true) return false;
  if (data.payment_method && !data.title?.toUpperCase().includes('KITCHEN')) return false;

  const title = (data.title || '').toUpperCase();
  if (
    title.includes('KITCHEN') ||
    title.includes('FIRE') ||
    title.includes('CHIT') ||
    title.includes('COOK') ||
    title.includes('PREP') ||
    title.includes('ORDER TICKET')
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
  const resto = (data.restaurant_name || 'Neo Beirut').toUpperCase();
  lines.push(center(resto));

  // ─────────────────────────────────────────────────────────────
  // 1. KITCHEN CHIT FORMAT (ITEMS, MODIFIERS, NOTES ONLY — NO PRICES)
  // ─────────────────────────────────────────────────────────────
  if (isKitchen) {
    const chitTitle = data.title
      ? `*** ${data.title.toUpperCase()} ***`
      : data.station
      ? `*** ${data.station.toUpperCase()} CHIT ***`
      : '*** KITCHEN ORDER TICKET ***';
    lines.push(center(chitTitle));
    if (data.station) {
      lines.push(center(`STATION: ${data.station.toUpperCase()}`));
    }
    lines.push(divider('='));

    const idStr = data.id || data.orderId ? `Order #${data.id || data.orderId}` : '';
    const tableVal = data.table_code || data.table_label || data.table;
    const tableStr = tableVal ? `Table: ${tableVal}` : '';
    const d = new Date(data.created_at || Date.now());
    const p = (n: number) => String(n).padStart(2, '0');
    const dateStr = data.timestamp || `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}  ${p(d.getHours())}:${p(d.getMinutes())}`;

    if (tableStr && dateStr) {
      lines.push(cols(tableStr, dateStr));
    } else if (idStr && dateStr) {
      lines.push(cols(idStr, dateStr));
    }

    if (idStr && tableStr) {
      const guests = data.guest_count ? `Guests: ${data.guest_count}` : '';
      lines.push(cols(idStr, guests));
    }

    const server = data.served_by || data.waiter_name || data.waiter || data.server_name || data.server || data.cashier_name || 'Staff';
    lines.push(`Server  : ${server}`);
    lines.push(cols(`Channel : ${data.order_source || 'POS'}`, `Type: ${data.order_type || data.service_type || 'DINE-IN'}`));
    if (data.fireRound) {
      lines.push(`Course Fire: #${data.fireRound}`);
    }
    lines.push(divider('-'));

    // Kitchen Column Header: NO PRICE COLUMN
    lines.push(' QTY  ITEM');
    lines.push(divider('-'));

    let totalItemCount = 0;
    for (const item of (data.items || [])) {
      if ((item as any).name === 'HOLD' || (item as any).isHoldSeparator) continue;
      const qty = Number(item.qty ?? item.quantity ?? 1);
      totalItemCount += qty;

      // Print only item quantity and name (no prices)
      lines.push(` ${String(qty).padStart(2)}x ${item.name}`);

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
        if (typeof c === 'string') {
          name = c.trim();
          isRem = name.toLowerCase().startsWith('no ') || name.toLowerCase().startsWith('without ') || name.startsWith('- ');
        } else if (typeof c === 'object' && c !== null) {
          name = (c.name || c.ingredient || c.option_name || c.label || '').trim();
          isRem = (c.customization_type || '').toLowerCase() === 'removal' || name.toLowerCase().startsWith('no ') || name.toLowerCase().startsWith('without ');
        }
        if (name) lines.push(`       ${isRem ? '- [NO] ' : '+ '}${name}`);
      }

      // Extract item special note
      const note = (item.note || item.comment || item.notes || '').trim();
      if (note) lines.push(`       * Note: ${note}`);
    }

    lines.push(divider('-'));
    // Kitchen Footer: Total Items only, NO financial prices, taxes, or MOF
    lines.push(cols('TOTAL ITEMS:', String(totalItemCount)));
    lines.push(divider('-'));

    if (data.footer_message) {
      lines.push(center(data.footer_message));
    }
    lines.push(center('*** END OF KITCHEN TICKET ***'));

    return lines.join('\n');
  }

  // ─────────────────────────────────────────────────────────────
  // 2. GUEST CHECK / BILL / FISCAL INVOICE FORMAT (FULL PRICING & TOTALS)
  // ─────────────────────────────────────────────────────────────
  if (data.invoice_number) {
    if (data.concept_name) {
      lines.push(center(data.concept_name.toUpperCase()));
    }
    lines.push(center(`*** FISCAL INVOICE ***`));
    lines.push(center(`NO: ${data.invoice_number}`));
  } else {
    lines.push(center('*** GUEST CHECK / BILL ***'));
    lines.push(center('(NOT A FISCAL RECEIPT)'));
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
  const rate = Number(data.exchange_rate || data.rate || 89500);
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

export const ThermalReceiptPreviewModal: React.FC<Props> = ({ isOpen, onClose, data }) => {
  const [activeTab, setActiveTab] = useState<'paper' | 'escpos'>('paper');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !data) return null;

  const isKitchen = isKitchenTicketData(data);
  const restoName = (data.restaurant_name || (typeof window !== 'undefined' ? localStorage.getItem('flow_pos_restaurant_name') : null) || 'Neo Beirut').toUpperCase();
  const legalName = data.company_legal_name || (typeof window !== 'undefined' ? localStorage.getItem('flow_pos_company_legal_name') : null) || 'Neo Beirut S.A.L.';
  const mofNumber = data.mof_number || (typeof window !== 'undefined' ? localStorage.getItem('flow_pos_mof_number') : null) || '382910-601';
  const exchangeRate = Number(data.exchange_rate || data.rate || 89500);
  const serverName = data.served_by || data.waiter_name || data.waiter || data.server_name || data.server || data.cashier_name || 'Staff';
  const tableCode = data.table_code || data.table_label || data.table;
  const guestCount = data.guest_count || 1;
  const footerMessage = data.footer_message || (isKitchen ? '' : 'Thank you for dining with us! Come back soon.');

  let calcSubtotal = 0;
  const items = (data.items || []).filter(i => (i as any).name !== 'HOLD' && !(i as any).isHoldSeparator).map(i => {
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
  const subtotal = Number(data.subtotal_amount !== undefined ? data.subtotal_amount : calcSubtotal) || 0;
  const discount = Number(data.discount_amount || 0);
  const totalUsd = Number(data.total_amount !== undefined ? data.total_amount : (subtotal - discount)) || 0;
  const totalLbp = Math.round(totalUsd * exchangeRate);

  const formattedDate = () => {
    if (data.timestamp) return data.timestamp;
    const d = new Date(data.created_at || Date.now());
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}  ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  const rawEscPos = formatEscPosText(data);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(rawEscPos);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 w-full max-w-xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-900">
        {/* Top Notification Banner: DESIGN PREVIEW ONLY */}
        <div className={`border-b px-4 py-2.5 flex items-center justify-between text-xs font-semibold ${
          isKitchen 
            ? 'bg-amber-50 border-amber-200 text-amber-900' 
            : 'bg-emerald-50 border-emerald-200 text-emerald-950'
        }`}>
          <div className="flex items-center gap-2">
            {isKitchen ? (
              <ChefHat className="w-4 h-4 text-amber-700 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#1e5c4f] shrink-0" />
            )}
            <span>
              <strong>{isKitchen ? 'KITCHEN CHIT PREVIEW:' : 'PREVIEW MODE ACTIVE:'}</strong>{' '}
              {isKitchen 
                ? 'Reviewing kitchen ticket layout. Displays items, modifiers & notes (prices and totals omitted).'
                : 'Physical printing is temporarily paused. Reviewing design and layout on-screen.'}
            </span>
          </div>
          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border font-mono font-bold ${
            isKitchen
              ? 'bg-amber-100 text-amber-800 border-amber-300'
              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
          }`}>
            {isKitchen ? 'Kitchen' : 'Dry Run'}
          </span>
        </div>

        {/* Header Controls */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              isKitchen 
                ? 'bg-amber-100 text-amber-700 border-amber-300'
                : 'bg-emerald-100 text-emerald-700 border-emerald-300'
            }`}>
              {isKitchen ? <ChefHat className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>{isKitchen ? 'Kitchen Chit Preview' : 'Receipt Design Preview'}</span>
                <span className="text-[11px] font-normal text-slate-500">
                  {tableCode ? `(Table ${tableCode})` : `#${data.id || data.orderId || 'Order'}`}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">
                {isKitchen ? 'Kitchen & Prep Printer Format (No Prices)' : 'ESC/POS 48-Column Thermal Printer Format'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher: Paper Slip vs Raw ESC/POS Text */}
            <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex items-center text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('paper')}
                className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1.5 transition ${
                  activeTab === 'paper' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Paper Slip</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('escpos')}
                className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1.5 transition ${
                  activeTab === 'escpos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Raw Text</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyText}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition"
              title="Copy receipt text to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 border border-slate-200 transition"
              title="Close Preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-200/90 flex justify-center items-start">
          {activeTab === 'paper' ? (
            /* ── REALISTIC THERMAL PAPER SLIP ── */
            <div className="w-[370px] bg-[#FAF8F5] text-slate-900 rounded-sm shadow-2xl p-6 font-mono text-[13px] leading-tight select-text border-t-8 border-b-8 border-dashed border-[#D9D5CD] relative">
              {isKitchen ? (
                /* ═════════════════════════════════════════════════════════════ */
                /* KITCHEN CHIT: STRICTLY ITEMS, MODIFIERS, NOTES (NO PRICES)  */
                /* ═════════════════════════════════════════════════════════════ */
                <>
                  {/* Kitchen Header */}
                  <div className="text-center pb-2">
                    <h1 className="text-xl font-black tracking-wider text-black">{restoName}</h1>
                    <div className="text-[13px] font-black text-amber-900 mt-1 uppercase tracking-wide">
                      *** {data.title || (data.station ? `${data.station} CHIT` : 'KITCHEN ORDER TICKET')} ***
                    </div>
                    {data.station && (
                      <div className="text-[11px] font-bold text-amber-800 mt-0.5">
                        STATION: {data.station.toUpperCase()}
                      </div>
                    )}
                    {data.fireRound && (
                      <div className="text-[11px] font-extrabold text-orange-700 mt-0.5">
                        COURSE FIRE: #{data.fireRound}
                      </div>
                    )}
                  </div>

                  <div className="border-b-2 border-slate-900 my-2" />

                  {/* Order Metadata */}
                  <div className="space-y-0.5 text-[11px] text-slate-800">
                    <div className="flex justify-between">
                      <span className="font-bold">{tableCode ? `Table ${tableCode}` : `#${data.id || data.orderId || 'ORDER'}`}</span>
                      <span>{formattedDate()}</span>
                    </div>
                    {tableCode && (
                      <div className="flex justify-between">
                        <span>Table   : {tableCode}</span>
                        <span>{data.id || data.orderId ? `Order #${data.id || data.orderId}` : (guestCount ? `Guests: ${guestCount}` : '')}</span>
                      </div>
                    )}
                    <div className="font-bold text-slate-950">
                      Server: {serverName}
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Channel : {data.order_source || 'POS'}</span>
                      <span>Type: {data.order_type || data.service_type || 'DINE-IN'}</span>
                    </div>
                  </div>

                  <div className="border-b border-dashed border-slate-400 my-2" />

                  {/* Items Column Header - NO PRICE COLUMN */}
                  <div className="font-extrabold text-[12px] text-slate-950 pb-1">
                    <span>QTY  ITEM</span>
                  </div>
                  <div className="border-b border-slate-400 mb-2" />

                  {/* Line Items - STRICTLY NO PRICES */}
                  <div className="space-y-2 text-[12px]">
                    {items.length === 0 ? (
                      <div className="text-center py-4 text-slate-400 italic">No items on this ticket</div>
                    ) : (
                      items.map((item, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <div className="flex items-start">
                            <span className="inline-block w-8 text-slate-950 font-black text-[13px] shrink-0">{item.qty}x</span>
                            <span className="text-black font-bold text-[13px] flex-1">{item.name}</span>
                          </div>

                          {/* Modifiers */}
                          {item.modifiers.length > 0 && (
                            <div className="pl-8 space-y-0.5 text-[11px]">
                              {item.modifiers.map((mod: any, mIdx: number) => {
                                let modName = '';
                                let isRemoval = false;
                                if (typeof mod === 'string') {
                                  modName = mod.trim();
                                  isRemoval = modName.toLowerCase().startsWith('no ') || modName.toLowerCase().startsWith('without ') || modName.startsWith('- ');
                                } else if (typeof mod === 'object' && mod !== null) {
                                  modName = (mod.name || mod.ingredient || mod.option_name || mod.label || '').trim();
                                  isRemoval = (mod.customization_type || '').toLowerCase() === 'removal' || modName.toLowerCase().startsWith('no ') || modName.toLowerCase().startsWith('without ');
                                }
                                if (!modName) return null;
                                return (
                                  <div key={mIdx} className={isRemoval ? 'text-rose-700 font-semibold italic' : 'text-slate-800 font-semibold'}>
                                    {isRemoval ? `- [NO] ${modName}` : `+ ${modName}`}
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

                  {/* Kitchen Footer - Total Item Count Only (NO Subtotal, Discount, Total USD, or Taxes) */}
                  <div className="flex justify-between items-center text-[12px] font-black text-slate-950">
                    <span>TOTAL ITEMS:</span>
                    <span className="tabular-nums">{totalItemsCount}</span>
                  </div>

                  <div className="border-b border-dashed border-slate-400 my-2.5" />

                  {footerMessage && (
                    <div className="text-center text-[11px] text-slate-600 italic px-2 mb-2">
                      {footerMessage}
                    </div>
                  )}

                  <div className="text-center text-[11px] font-bold text-slate-500 tracking-wider">
                    *** END OF KITCHEN TICKET ***
                  </div>
                </>
              ) : (
                /* ═════════════════════════════════════════════════════════════ */
                /* GUEST CHECK / BILL: FULL FINANCIAL PRICING, TOTALS & TAXES   */
                /* ═════════════════════════════════════════════════════════════ */
                <>
                  {/* Restaurant Header */}
                  <div className="text-center pb-2">
                    <h1 className="text-xl font-black tracking-wider text-black">{restoName}</h1>
                    <div className="text-[12px] font-bold text-slate-700 mt-1">*** GUEST CHECK / BILL ***</div>
                    <div className="text-[10px] text-slate-500">(NOT A FISCAL RECEIPT)</div>
                  </div>

                  <div className="border-b-2 border-slate-900 my-2" />

                  {/* Order Metadata */}
                  <div className="space-y-0.5 text-[11px] text-slate-800">
                    <div className="flex justify-between">
                      <span className="font-bold">{tableCode ? `Table ${tableCode}` : `#${data.id || 'ORDER'}`}</span>
                      <span>{formattedDate()}</span>
                    </div>
                    {tableCode && (
                      <div className="flex justify-between">
                        <span>Table   : {tableCode}</span>
                        <span>Guests: {guestCount}</span>
                      </div>
                    )}
                    <div className="font-bold text-slate-950">
                      Served by: {serverName}
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Channel : {data.order_source || 'POS'}</span>
                      <span>Type: {data.order_type || 'DINE-IN'}</span>
                    </div>
                  </div>

                  <div className="border-b border-dashed border-slate-400 my-2" />

                  {/* Items Column Header */}
                  <div className="flex justify-between font-bold text-[11px] text-slate-950 pb-1">
                    <span>QTY  ITEM</span>
                    <span>PRICE (USD)</span>
                  </div>
                  <div className="border-b border-slate-400 mb-2" />

                  {/* Line Items */}
                  <div className="space-y-2 text-[12px]">
                    {items.length === 0 ? (
                      <div className="text-center py-4 text-slate-400 italic">No items on this ticket</div>
                    ) : (
                      items.map((item, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <div className="flex justify-between items-start font-semibold">
                            <span className="flex-1 pr-2">
                              <span className="inline-block w-6 text-slate-700 font-bold">{item.qty}x</span>
                              <span className="text-black">{item.name}</span>
                            </span>
                            <span className="text-right tabular-nums text-black font-bold shrink-0">
                              ${item.lineTotal.toFixed(2)}
                            </span>
                          </div>

                          {/* Modifiers: On customer bill, only priced add-ons are displayed; zero-value choices/removals are omitted */}
                          {item.modifiers.filter((mod: any) => typeof mod === 'object' && Number(mod.price) > 0).length > 0 && (
                            <div className="pl-6 space-y-0.5 text-[11px] text-slate-600">
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
                            <div className="pl-6 text-[11px] text-amber-800 italic">
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

                  {/* TOTAL USD & LBP */}
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
