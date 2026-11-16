import { splitCashChange } from '../payments/cashChange';
import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../api/supabase";
import { CustomerSearchModal, extractCorePhone, getPhoneSearchVariants, CustomerData } from "./CustomerSearchModal";
import { PosDiscountRule } from "../services/discountService";

export const sanitizeClientName = (name?: string): string => {
  if (!name) return "";
  const trimmed = name.trim();
  if (
    trimmed === "." ||
    trimmed === ".." ||
    trimmed === "..." ||
    trimmed === "-" ||
    trimmed === "--" ||
    trimmed === "null" ||
    trimmed === "undefined" ||
    trimmed.toLowerCase() === "walk-in" ||
    trimmed.toLowerCase() === "walk in"
  ) {
    return "";
  }
  const cleaned = trimmed.replace(/^[.\s\-_]+|[.\s\-_]+$/g, "").trim();
  return cleaned === "." ? "" : cleaned;
};

export interface TerminalPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalUsd: number;
  subtotal?: number;
  discountAmount?: number;
  discountType?: string;
  discountValInput?: number | string;
  discountIsPercent?: boolean;
  selectedDiscountRule?: PosDiscountRule | null;
  applicableDiscounts?: PosDiscountRule[];
  currentRestaurantName?: string;
  currentBranchName?: string;
  onApplyDiscount?: (
    discountType: string,
    discountValInput: number | string,
    discountIsPercent: boolean,
    selectedDiscountRule: PosDiscountRule | null
  ) => void;
  exchangeRate?: number;
  isTable: boolean;
  tableCode?: string;
  guestCount?: number;
  waiterName?: string;
  orderType?: string;
  isSubmitting?: boolean;
  onConfirmPayment: (paymentDetails: {
    paymentMethod: string;
    tenderedAmount: number;
    tenderedCurrency: "USD" | "LBP";
    changeAmount: number;
    changeCurrency: "USD" | "LBP";
    customerName?: string;
    customerPhone?: string;
    isAdvancePayment?: boolean;
    scheduledOrderDate?: string;
    scheduledOrderTime?: string;
    scheduledOrderNote?: string;
  }) => Promise<void>;
  onPrintBill?: () => Promise<void> | void;
  customerName?: string;
  customerPhone?: string;
  scheduledOrderDate?: string;
  scheduledOrderTime?: string;
  scheduledOrderNote?: string;
  onHoldOrder?: (schedule?: {
    scheduledDate?: string;
    scheduledTime?: string;
    scheduledNote?: string;
  }) => Promise<void>;
  isShiftOpen?: boolean;
  onOpenShift?: () => void;
}

type PaymentMethodKey = "cash_usd" | "cash_lbp" | "card" | "whish" | "on_account";

export const TerminalPaymentModal: React.FC<TerminalPaymentModalProps> = ({
  isOpen,
  onClose,
  totalUsd,
  subtotal,
  discountAmount = 0,
  discountType = "none",
  discountValInput = 10,
  discountIsPercent = true,
  selectedDiscountRule = null,
  applicableDiscounts = [],
  currentRestaurantName = "",
  currentBranchName = "",
  onApplyDiscount,
  exchangeRate = 89500,
  isTable,
  tableCode,
  guestCount = 1,
  waiterName,
  orderType = "dine_in",
  isSubmitting = false,
  customerName = "",
  customerPhone = "",
  scheduledOrderDate = "",
  scheduledOrderTime = "",
  scheduledOrderNote = "",
  onConfirmPayment,
  onPrintBill,
  onHoldOrder,
  isShiftOpen = true,
  onOpenShift
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodKey>("cash_usd");
  const [tenderInput, setTenderInput] = useState<string>("0");
  const [returnedUsdInput, setReturnedUsdInput] = useState('0');
  const [cashInputTarget, setCashInputTarget] = useState<'tender' | 'returned'>('tender');
  const [creditClientName, setCreditClientName] = useState<string>("");
  const [creditClientPhone, setCreditClientPhone] = useState<string>("");
  const [isAdvancePayment, setIsAdvancePayment] = useState<boolean>(false);

  // Custom Discount UI State
  const [isCustomDiscountOpen, setIsCustomDiscountOpen] = useState<boolean>(false);
  const [customDiscountVal, setCustomDiscountVal] = useState<string>(String(discountValInput ?? 10));
  const [customDiscountIsPct, setCustomDiscountIsPct] = useState<boolean>(discountIsPercent ?? true);

  // Sync customDiscountVal when props change
  useEffect(() => {
    if (discountValInput !== undefined) {
      setCustomDiscountVal(String(discountValInput));
    }
    if (discountIsPercent !== undefined) {
      setCustomDiscountIsPct(discountIsPercent);
    }
  }, [discountValInput, discountIsPercent]);

  // Client Search in On Account Mode
  const [clientSearchMode, setClientSearchMode] = useState<"name" | "phone">("phone");
  const [clientSearchQuery, setClientSearchQuery] = useState<string>("");
  const [clientSearchResults, setClientSearchResults] = useState<CustomerData[]>([]);
  const [isSearchingClients, setIsSearchingClients] = useState<boolean>(false);
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState<boolean>(false);

  // Schedule & Hold state
  const [schedDate, setSchedDate] = useState<string>(() => scheduledOrderDate || new Date().toISOString().split("T")[0]);
  const [schedTime, setSchedTime] = useState<string>(() => scheduledOrderTime || "");
  const [schedNote, setSchedNote] = useState<string>(() => scheduledOrderNote || "");

  const rate = exchangeRate && exchangeRate > 0 ? exchangeRate : 89500;
  const totalLbp = useMemo(() => Math.round(totalUsd * rate), [totalUsd, rate]);

  // Reset tender input, client name, and schedule when modal opens or method changes
  useEffect(() => {
    if (!isOpen) return;
    setIsAdvancePayment(false);
    const cleanName = sanitizeClientName(customerName);
    setCreditClientName(cleanName || (tableCode ? `Table ${tableCode}` : ""));
    setCreditClientPhone(customerPhone || "");
    setClientSearchQuery("");
    setClientSearchResults([]);
    setSchedDate(scheduledOrderDate || new Date().toISOString().split("T")[0]);
    setSchedTime(scheduledOrderTime || "");
    setSchedNote(scheduledOrderNote || "");

    setReturnedUsdInput('0');
    setCashInputTarget('tender');
    setTenderInput(selectedMethod === 'cash_usd' || selectedMethod === 'cash_lbp' ? '0' : totalUsd.toFixed(2));
  }, [isOpen, selectedMethod, totalUsd, totalLbp, customerName, customerPhone, tableCode, scheduledOrderDate, scheduledOrderTime, scheduledOrderNote]);

  // Client search handler (supports Name and Phone modes with Lebanese phone normalization)
  const handleClientSearch = async (query: string, modeOverride?: "name" | "phone") => {
    const mode = modeOverride || clientSearchMode;
    setClientSearchQuery(query);
    const clean = query.trim();
    if (!clean) {
      setClientSearchResults([]);
      setIsSearchingClients(false);
      return;
    }
    setIsSearchingClients(true);
    try {
      const rawDigits = clean.replace(/\D/g, "");
      const isPhoneQuery = mode === "phone" || rawDigits.length >= 2 || clean.startsWith("+");

      if (isPhoneQuery) {
        const { core } = extractCorePhone(clean);
        const variants = getPhoneSearchVariants(clean);
        let q = supabase
          .from("whatsapp_contacts")
          .select("id, name, phone_e164, category")
          .order("name", { ascending: true })
          .limit(30);

        const conditions: string[] = [];
        if (variants.length > 0 && rawDigits.length >= 2) {
          variants.forEach((v) => conditions.push(`phone_e164.ilike.%${v}%`));
        }
        if (clean.length >= 2) {
          conditions.push(
`full_name.ilike.%${clean}%`);
        }

        if (conditions.length > 0) {
          q = q.or(conditions.join(","));
        }
        const { data, error } = await q;
        if (!error && data) {
          const mapped: CustomerData[] = data.map((d: any) => ({
            id: d.id,
            customer_name: d.name || "Unnamed Client",
            customer_phone: d.phone_e164 || "",
            category: d.category || undefined
          }));
          if (core.length >= 3) {
            mapped.sort((a, b) => {
              const aCore = extractCorePhone(a.customer_phone).core;
              const bCore = extractCorePhone(b.customer_phone).core;
              const aExact = aCore === core;
              const bExact = bCore === core;
              if (aExact && !bExact) return -1;
              if (!aExact && bExact) return 1;
              return (a.customer_name || "").localeCompare(b.customer_name || "");
            });
          }
          setClientSearchResults(mapped);
        }
      } else {
        let q = supabase
          .from("whatsapp_contacts")
          .select("id, name, phone_e164, category")
          .order("name", { ascending: true })
          .limit(30);

        if (clean.length >= 1) {
          q = q.ilike("name", `%${clean}%`);
        }
        const { data, error } = await q;
        if (!error && data) {
          const mapped: CustomerData[] = data.map((d: any) => ({
            id: d.id,
            customer_name: d.name || "Unnamed Client",
            customer_phone: d.phone_e164 || "",
            category: d.category || undefined
          }));
          setClientSearchResults(mapped);
        }
      }
    } catch (err) {
      console.warn("Client search error in PaymentModal:", err);
    } finally {
      setIsSearchingClients(false);
    }
  };

  const handlePhoneInputChange = async (phoneInput: string) => {
    setCreditClientPhone(phoneInput);
    const clean = phoneInput.trim();
    const rawDigits = clean.replace(/\D/g, "");
    if (rawDigits.length >= 4) {
      const { core } = extractCorePhone(clean);
      const variants = getPhoneSearchVariants(clean);
      if (variants.length > 0) {
        const orClause = variants.map((v) => `phone_e164.ilike.%${v}%`).join(",");
        const { data } = await supabase
          .from("whatsapp_contacts")
          .select("id, name, phone_e164, category")
          .or(orClause)
          .limit(10);
        if (data && data.length > 0) {
          const exact = data.find((d: any) => {
            const dCore = extractCorePhone(d.phone_e164 || "").core;
            return dCore === core;
          });
          if (exact) {
            if (!creditClientName || creditClientName.startsWith("Table ")) {
              setCreditClientName(sanitizeClientName(exact.name));
            }
          }
        }
      }
    }
  };

  // Quick schedule helper
  const applyQuickSchedule = (mins: number) => {
    const d = new Date(Date.now() + mins * 60000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    setSchedDate(`${yyyy}-${mm}-${dd}`);
    setSchedTime(`${hh}:${min}`);
  };

  const formatScheduledDisplay = (dateStr: string, timeStr: string) => {
    if (!timeStr) return "";
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const isToday = dateStr === todayStr;
      const [h, m] = timeStr.split(":").map(Number);
      const dateObj = new Date();
      dateObj.setHours(h, m, 0, 0);
      const formattedTime = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
      return isToday ? `Today at ${formattedTime}` : `${dateStr} at ${formattedTime}`;
    } catch {
      return `${dateStr} ${timeStr}`;
    }
  };

  // Numeric calculations based on selected method
  const numericTender = parseFloat(tenderInput) || 0;

  // USD Change & Remaining
  const diffUsd = numericTender - totalUsd;
  const isUsdCovered = diffUsd >= -0.001;
  const changeDueUsd = isUsdCovered ? Math.max(0, diffUsd) : 0;
  const changeDueLbpFromUsd = Math.round(changeDueUsd * rate);
  const remainingUsd = !isUsdCovered ? Math.abs(diffUsd) : 0;
  const remainingLbpFromUsd = Math.round(remainingUsd * rate);

  // LBP Change & Remaining
  const diffLbp = numericTender - totalLbp;
  const isLbpCovered = diffLbp >= 0;
  const changeDueLbp = isLbpCovered ? Math.max(0, diffLbp) : 0;
  const changeDueUsdFromLbp = changeDueLbp / rate;
  const remainingLbp = !isLbpCovered ? Math.abs(diffLbp) : 0;
  const remainingUsdFromLbp = remainingLbp / rate;

  const splitChange = splitCashChange(
    selectedMethod === 'cash_lbp' ? changeDueLbp : changeDueUsd,
    selectedMethod === 'cash_lbp' ? 'LBP' : 'USD',
    returnedUsdInput.trim() === '' ? 0 : Number(returnedUsdInput), rate
  );
  // Determine if payment is valid to confirm
  const canConfirm = (() => {
    if (isSubmitting || isShiftOpen === false) return false;
    if (['cash_usd', 'cash_lbp'].includes(selectedMethod) && (!splitChange.valid || !Number.isFinite(Number(tenderInput)) || Number(tenderInput) < 0)) return false;
    if (selectedMethod === "on_account") return creditClientName.trim().length > 0;
    if (totalUsd <= 0) return true;
    if (selectedMethod === "cash_usd") return isUsdCovered;
    if (selectedMethod === "cash_lbp") return isLbpCovered;
    return true; // Card & Whish are exact
  })();

  // Quick preset generators
  const usdPresets = useMemo(() => {
    const list: number[] = [parseFloat(totalUsd.toFixed(2))];
    const whole = Math.ceil(totalUsd);
    [5, 10, 20, 50, 100].forEach((p) => {
      if (p >= whole && !list.includes(p)) list.push(p);
    });
    // Add next round 10 or 20 if total is large
    if (whole > 20) {
      const next10 = Math.ceil(totalUsd / 10) * 10;
      if (!list.includes(next10)) list.push(next10);
      const next20 = Math.ceil(totalUsd / 20) * 20;
      if (!list.includes(next20)) list.push(next20);
    }
    return Array.from(new Set(list)).sort((a, b) => a - b).slice(0, 5);
  }, [totalUsd]);

  const lbpPresets = useMemo(() => {
    const list: number[] = [totalLbp];
    [500000, 1000000, 1500000, 2000000, 3000000, 5000000, 10000000].forEach((p) => {
      if (p >= totalLbp && !list.includes(p)) list.push(p);
    });
    const next250k = Math.ceil(totalLbp / 250000) * 250000;
    if (!list.includes(next250k)) list.push(next250k);
    const next500k = Math.ceil(totalLbp / 500000) * 500000;
    if (!list.includes(next500k)) list.push(next500k);
    return Array.from(new Set(list)).sort((a, b) => a - b).slice(0, 5);
  }, [totalLbp]);

  // Numpad handlers
  const handleNumpadPress = (val: string) => {
    const setter = cashInputTarget === 'returned' ? setReturnedUsdInput : setTenderInput;
    setter(prev => {
      if (val === 'CLEAR') return '0';
      if (val === 'BACKSPACE') return prev.slice(0, -1) || '0';
      if (val === '.' && prev.includes('.')) return prev;
      return prev === '0' && val !== '.' ? val : prev + val;
    });
  };

  const handleConfirm = () => {
    if (!canConfirm) return;

    let paymentMethodLabel = "Cash";
    let tenderedAmt = totalUsd;
    let tenderedCurr: "USD" | "LBP" = "USD";
    let changeAmt = 0;
    let changeCurr: "USD" | "LBP" = "USD";

    if (selectedMethod === "cash_usd") {
      paymentMethodLabel = "Cash USD";
      tenderedAmt = numericTender;
      tenderedCurr = "USD";
      changeAmt = parseFloat(changeDueUsd.toFixed(2));
      changeCurr = "USD";
    } else if (selectedMethod === "cash_lbp") {
      paymentMethodLabel = "Cash LBP";
      tenderedAmt = numericTender;
      tenderedCurr = "LBP";
      changeAmt = Math.round(changeDueLbp);
      changeCurr = "LBP";
    } else if (selectedMethod === "card") {
      paymentMethodLabel = "Card";
      tenderedAmt = totalUsd;
      tenderedCurr = "USD";
      changeAmt = 0;
      changeCurr = "USD";
    } else if (selectedMethod === "whish") {
      paymentMethodLabel = "Whish";
      tenderedAmt = totalUsd;
      tenderedCurr = "USD";
      changeAmt = 0;
      changeCurr = "USD";
    } else if (selectedMethod === "on_account") {
      paymentMethodLabel = "On Account";
      tenderedAmt = totalUsd;
      tenderedCurr = "USD";
      changeAmt = 0;
      changeCurr = "USD";
    }

    onConfirmPayment({
      paymentMethod: paymentMethodLabel,
      tenderedAmount: tenderedAmt,
      tenderedCurrency: tenderedCurr,
      changeAmount: changeAmt,
      changeCurrency: changeCurr,
      customerName: selectedMethod === "on_account" ? creditClientName.trim() : (customerName || ""),
      customerPhone: selectedMethod === "on_account" ? creditClientPhone.trim() : (customerPhone || ""),
      isAdvancePayment: isAdvancePayment,
      scheduledOrderDate: schedTime ? schedDate : undefined,
      scheduledOrderTime: schedTime || undefined,
      scheduledOrderNote: schedNote || undefined
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#F5F6F4] z-50 flex flex-col text-slate-900 print:hidden animate-fade-in select-none">
      {/* FULL PAGE HEADER */}
      <div className="h-14 px-6 bg-white border-b border-slate-200 flex items-center justify-between flex-shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#1e5c4f] border border-emerald-200 flex items-center justify-center text-xl font-black shadow-xs">
            {isTable ? "🪑" : "💳"}
          </div>
          <div>
            <h3 className="font-black text-base sm:text-lg text-slate-900 leading-tight">
              {isTable ? `Settle & Close Table ${tableCode}` : "Settle Order & Print Receipt"}
            </h3>
             <p className="text-xs text-slate-500">
                {isTable
                  ? `Table ${tableCode} — ${orderType?.toUpperCase() || 'DINE IN'}`
                  : `${orderType?.toUpperCase()} Order Checkout`}
              </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-2 text-xs font-black transition cursor-pointer active:scale-95 border border-slate-300 shadow-xs"
        >
          <span>✕</span>
          <span>Back to Register</span>
        </button>
      </div>

      {/* SHIFT CLOSED WARNING BANNER */}
      {isShiftOpen === false && (
        <div className="bg-rose-950/95 border-b border-rose-500/60 px-6 py-3 flex items-center justify-between flex-shrink-0 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <p className="text-sm font-black text-rose-200 uppercase tracking-wide">
                Shift is Closed — Invoicing and Payments are Disabled
              </p>
              <p className="text-xs text-rose-300/80">
                A cashier shift must be open before you can print bills or confirm payments.
              </p>
            </div>
          </div>
          {onOpenShift && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenShift();
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-950/60 transition active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <span>🔑</span>
              <span>Open Shift Now</span>
            </button>
          )}
        </div>
      )}

      {/* FULL PAGE MAIN CONTENT: TWO-COLUMN NO-SCROLL LAYOUT */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden p-3 sm:p-4 gap-4">
        {/* PAYMENT COLUMN: TOTAL, METHOD SELECTOR, CASH TENDER & CHANGE */}
        <div className={`${isTable ? 'w-full max-w-3xl mx-auto' : 'lg:w-1/2'} flex flex-col gap-3 h-full overflow-y-auto no-scrollbar`}>
          {/* TOTAL DUE BANNER */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 shadow-xs flex-shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  TOTAL DUE TO PAY
                </span>
                {discountAmount > 0 && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
                    Discount -${discountAmount.toFixed(2)} applied
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl sm:text-4xl font-black text-pos-primary">
                  ${totalUsd.toFixed(2)}
                </span>
                <span className="text-sm sm:text-base font-bold text-slate-700">
                  ≈ {totalLbp.toLocaleString()} LBP
                </span>
              </div>
              {typeof subtotal === "number" && discountAmount > 0 && (
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Subtotal: ${subtotal.toFixed(2)} • Discount: -${discountAmount.toFixed(2)}
                </div>
              )}
            </div>

            <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-right">
              <span className="text-[10px] text-slate-500 block font-bold">EXCHANGE RATE</span>
              <span className="text-xs font-black text-emerald-800 font-mono">
                1 USD = {rate.toLocaleString()} LBP
              </span>
            </div>
          </div>

          {/* DISCOUNT CONTROLS */}
          <div className="p-3 rounded-xl bg-white border border-slate-200 flex-shrink-0 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  🏷️ Discount:
                </span>
                {discountAmount > 0 && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    -${discountAmount.toFixed(2)}
                  </span>
                )}
              </div>
              {discountAmount > 0 && (
                <button
                  type="button"
                  onClick={() => onApplyDiscount?.("none", 0, true, null)}
                  className="text-[11px] text-rose-400 hover:text-rose-300 font-bold hover:underline cursor-pointer"
                >
                  Clear Discount
                </button>
              )}
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* None */}
              <button
                type="button"
                onClick={() => onApplyDiscount?.("none", 0, true, null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                  !selectedDiscountRule && (discountType === "none" || discountAmount === 0)
                    ? "bg-slate-700 text-white border border-slate-500 shadow"
                    : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs"
                }`}
              >
                None
              </button>

              {/* Custom button */}
              <button
                type="button"
                onClick={() => setIsCustomDiscountOpen(!isCustomDiscountOpen)}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                  isCustomDiscountOpen || (!selectedDiscountRule && discountType === "custom")
                    ? "bg-amber-600/30 border border-amber-500 text-amber-300"
                    : "bg-white border border-slate-200 text-slate-700 hover:border-amber-400 hover:bg-slate-50 shadow-xs"
                }`}
              >
                Custom
              </button>
            </div>

            {/* Custom Drawer */}
            {isCustomDiscountOpen && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200/60 animate-in fade-in duration-100">
                <span className="text-xs text-slate-500 font-bold">Custom Value:</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={customDiscountVal}
                  onChange={(e) => setCustomDiscountVal(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-24 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1e5c4f]"
                />
                <button
                  type="button"
                  onClick={() => setCustomDiscountIsPct(!customDiscountIsPct)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-black text-slate-800 border border-slate-300 cursor-pointer"
                >
                  {customDiscountIsPct ? "%" : "$ USD"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const num = parseFloat(customDiscountVal) || 0;
                    onApplyDiscount?.("custom", num, customDiscountIsPct, null);
                  }}
                  className="px-3 py-1 bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-xs rounded-lg shadow-xs cursor-pointer active:scale-95"
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          {/* PAYMENT METHOD SELECTOR */}
          <div className="flex-shrink-0">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1.5 block">
              Choose Payment Currency & Method:
            </label>
            <div className="grid grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => setSelectedMethod("cash_usd")}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedMethod === "cash_usd"
                    ? "bg-emerald-50 border-[#1e5c4f] text-[#1e5c4f] shadow-xs ring-2 ring-[#1e5c4f]/20"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-base">💵</span>
                  <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-900/40 px-1 py-0.2 rounded">
                    USD
                  </span>
                </div>
                <div className="text-xs font-black truncate">Cash USD</div>
                <div className="text-[10px] text-slate-500 font-mono">
                  ${totalUsd.toFixed(2)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod("cash_lbp")}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedMethod === "cash_lbp"
                    ? "bg-emerald-50 border-[#1e5c4f] text-[#1e5c4f] shadow-xs ring-2 ring-[#1e5c4f]/20"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-base">🇱🇧</span>
                  <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-900/40 px-1 py-0.2 rounded">
                    LBP
                  </span>
                </div>
                <div className="text-xs font-black truncate">Cash LBP</div>
                <div className="text-[10px] text-slate-500 font-mono truncate">
                  {totalLbp.toLocaleString()} L.L.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod("card")}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedMethod === "card"
                    ? "bg-blue-50 border-blue-600 text-blue-900 shadow-xs ring-2 ring-blue-500/20"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-base">💳</span>
                  <span className="text-[9px] font-black uppercase text-blue-400 bg-blue-900/40 px-1 py-0.2 rounded">
                    POS
                  </span>
                </div>
                <div className="text-xs font-black truncate">Credit Card</div>
                <div className="text-[10px] text-slate-500 font-mono">Exact Charge</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod("whish")}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedMethod === "whish"
                    ? "bg-purple-50 border-purple-600 text-purple-900 shadow-xs ring-2 ring-purple-500/20"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-base">🟣</span>
                  <span className="text-[9px] font-black uppercase text-purple-400 bg-purple-900/40 px-1 py-0.2 rounded">
                    APP
                  </span>
                </div>
                <div className="text-xs font-black truncate">Whish</div>
                <div className="text-[10px] text-slate-500 font-mono">Transfer</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod("on_account")}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedMethod === "on_account"
                    ? "bg-amber-50 border-amber-600 text-amber-900 shadow-xs ring-2 ring-amber-500/20"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-base">📋</span>
                  <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-900/40 px-1 py-0.2 rounded">
                    CREDIT
                  </span>
                </div>
                <div className="text-xs font-black truncate">On Account</div>
                <div className="text-[10px] text-slate-500 font-mono">Client</div>
              </button>
            </div>
          </div>

          {/* CASH TENDER / CLIENT CREDIT / EXACT CHARGE */}
          <div className="space-y-3">
          {["cash_usd", "cash_lbp"].includes(selectedMethod) ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* LEFT SIDE: Input, Presets, and Live Change Box */}
                <div className="md:col-span-7 space-y-3.5 flex flex-col justify-between">
                  {/* Tender Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-slate-700">
                        Cash Tendered ({selectedMethod === "cash_usd" ? "USD $" : "LBP L.L."})
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {selectedMethod === "cash_usd" ? "Handed in USD" : "Handed in LBP"}
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                  inputMode="numeric"
                        step={selectedMethod === "cash_usd" ? "0.01" : "5000"}
                        aria-label="Cash Tendered"
                        min="0"
                        onFocus={e => { setCashInputTarget('tender'); e.target.select(); }}
                        value={tenderInput}
                        onChange={(e) => setTenderInput(e.target.value)}
                        placeholder="0"
                        disabled={isSubmitting}
                        className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-2xl font-mono font-black shadow-inner pl-12 pr-3 py-2.5 rounded-xl text-right focus:border-pos-primary focus:outline-none"
                      />
                      <span className="absolute left-3.5 top-3 text-xs text-slate-500 font-black">
                        {selectedMethod === "cash_usd" ? "USD $" : "LBP"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="cash-returned-usd" className="text-xs font-black text-slate-700 block mb-1.5">Cash Returned (USD $)</label>
                    <input id="cash-returned-usd" type="number" inputMode="decimal" min="0" step="0.01"
                      value={returnedUsdInput} onChange={e => setReturnedUsdInput(e.target.value)}
                      onFocus={e => { setCashInputTarget('returned'); e.target.select(); }} disabled={isSubmitting}
                      aria-invalid={!splitChange.valid} aria-describedby="cash-returned-result"
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-2xl font-mono font-black shadow-inner px-3 py-2.5 rounded-xl text-right focus:border-pos-primary focus:outline-none" />
                    <div id="cash-returned-result" role="status" aria-live="polite" className="mt-2 text-sm font-bold text-emerald-700">
                      {!splitChange.valid ? <span className="text-rose-300">{splitChange.error}</span>
                        : <span>Also return <strong>{splitChange.remainingLbp.toLocaleString()} LBP</strong></span>}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">Enter the dollars you give back. The rest is calculated in LBP at {rate.toLocaleString()} LBP / $1.</p>
                    <button type="button" disabled={isSubmitting} onClick={() => setReturnedUsdInput(String(Math.floor((selectedMethod === 'cash_lbp' ? changeDueUsdFromLbp : changeDueUsd) * 100 + 0.000001) / 100))}
                      className="mt-2 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold text-slate-700 shadow-xs cursor-pointer">Return change in USD</button>
                  </div>

                  {/* Quick Presets */}
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">
                      Quick Bill Presets:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedMethod === "cash_usd" ? usdPresets : lbpPresets).map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => { setCashInputTarget('tender'); setReturnedUsdInput('0'); setTenderInput(String(preset)); }}
                          className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs font-black text-slate-800 shadow-xs transition active:scale-95 cursor-pointer"
                        >
                          {idx === 0 ? "Exact " : ""}
                          {selectedMethod === "cash_usd"
                            ? `$${preset.toFixed(2)}`
                            : `${preset.toLocaleString()} LBP`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* LIVE CHANGE DUE / REMAINING BOX */}
                  {selectedMethod === "cash_usd" ? (
                    isUsdCovered ? (
                      <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1 animate-fade-in shadow-xs">
                        <span className="text-[11px] font-black uppercase text-emerald-800 tracking-wider block">
                          💵 CHANGE DUE TO CUSTOMER
                        </span>
                        <div className="text-3xl font-black text-[#1e5c4f] font-mono">
                          ${changeDueUsd.toFixed(2)} USD
                        </div>
                        {changeDueUsd > 0 && (
                          <div className="text-xs font-bold text-emerald-700">
                            ≈ {changeDueLbpFromUsd.toLocaleString()} LBP (if returning in Lebanese Pounds)
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-0.5 animate-fade-in shadow-xs">
                        <span className="text-[11px] font-black uppercase text-rose-800 tracking-wider block">
                          ⚠️ SHORTAGE / REMAINING DUE
                        </span>
                        <div className="text-2xl font-black text-rose-700 font-mono">
                          ${remainingUsd.toFixed(2)} USD
                        </div>
                        <div className="text-[11px] text-rose-700 font-medium">
                          ≈ {remainingLbpFromUsd.toLocaleString()} LBP still needed
                        </div>
                      </div>
                    )
                  ) : isLbpCovered ? (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1 animate-fade-in shadow-xs">
                      <span className="text-[11px] font-black uppercase text-emerald-800 tracking-wider block">
                        🇱🇧 CHANGE DUE TO CUSTOMER
                      </span>
                      <div className="text-3xl font-black text-[#1e5c4f] font-mono">
                        {changeDueLbp.toLocaleString()} LBP
                      </div>
                      {changeDueLbp > 0 && (
                        <div className="text-xs font-bold text-emerald-700">
                          ≈ ${changeDueUsdFromLbp.toFixed(2)} USD (if returning in Dollars)
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-0.5 animate-fade-in shadow-xs">
                      <span className="text-[11px] font-black uppercase text-rose-800 tracking-wider block">
                        ⚠️ SHORTAGE / REMAINING DUE
                      </span>
                      <div className="text-2xl font-black text-rose-700 font-mono">
                        {remainingLbp.toLocaleString()} LBP
                      </div>
                      <div className="text-[11px] text-rose-700 font-medium">
                        ≈ ${remainingUsdFromLbp.toFixed(2)} USD still needed
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT SIDE: ON-SCREEN NUMPAD FOR TOUCH TERMINALS */}
                <div className="md:col-span-5 flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-4">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-2 text-center md:text-left">
                    Touch Numpad
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", selectedMethod === "cash_usd" ? "." : "00", "0", "⌫"].map((btn, idx) => {
                      const isBackspace = btn === "⌫";
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (isBackspace) handleNumpadPress("BACKSPACE");
                            else handleNumpadPress(btn);
                          }}
                          className={`h-11 rounded-lg font-black text-base transition active:scale-95 flex items-center justify-center cursor-pointer ${
                            isBackspace
                              ? "bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200"
                              : "bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 shadow-xs"
                          }`}
                        >
                          {btn}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-center text-xs text-slate-500 mt-2">Keypad: {cashInputTarget === 'returned' ? 'Cash Returned (USD)' : 'Cash Tendered'}</div>
                  <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() => handleNumpadPress("CLEAR")}
                      className="h-10 rounded-xl font-black text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition active:scale-95 flex items-center justify-center cursor-pointer shadow-xs"
                    >
                      CLEAR
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCashInputTarget('tender');
                        setReturnedUsdInput('0');
                        if (selectedMethod === "cash_usd") {
                          setTenderInput(totalUsd.toFixed(2));
                        } else {
                          setTenderInput(String(totalLbp));
                        }
                      }}
                      className="h-10 rounded-xl font-black text-xs bg-emerald-50 hover:bg-emerald-100 text-[#1e5c4f] border border-emerald-200 transition active:scale-95 flex items-center justify-center cursor-pointer shadow-xs"
                    >
                      EXACT
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedMethod === "on_account" ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                    <span>📋</span>
                    <span>Client Account / Tab Credit</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Settle this ticket into an existing customer debt ledger or register a new client
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setClientSearchMode("phone");
                      setClientSearchQuery("");
                      setClientSearchResults([]);
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-black transition cursor-pointer ${
                      clientSearchMode === "phone"
                        ? "bg-[#1e5c4f] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Phone
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClientSearchMode("name");
                      setClientSearchQuery("");
                      setClientSearchResults([]);
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-black transition cursor-pointer ${
                      clientSearchMode === "name"
                        ? "bg-[#1e5c4f] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Name
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDirectoryModalOpen(true)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition cursor-pointer flex items-center gap-1 shadow-xs"
                    title="Open Full Customer Directory"
                  >
                    <span>👥</span> Directory
                  </button>
                </div>
              </div>

              {/* CLIENT SEARCH BAR */}
              <div className="relative">
                <div className="relative">
                  <input
                    type="text"
                    value={clientSearchQuery}
                    onChange={(e) => handleClientSearch(e.target.value)}
                    placeholder={
                      clientSearchMode === "phone"
                        ? "Search phone (e.g. 03361515, 3361515, 9613361515, +961...) or name..."
                        : "Search client name (e.g. Freddy, Elie...) or phone..."
                    }
                    className="w-full bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3 py-2 text-slate-900 text-xs font-bold outline-none transition pr-8 shadow-xs"
                  />
                  {isSearchingClients ? (
                    <div className="absolute right-2.5 top-2 text-xs text-amber-400 animate-spin">⏳</div>
                  ) : clientSearchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setClientSearchQuery("");
                        setClientSearchResults([]);
                      }}
                      className="absolute right-2.5 top-2 text-slate-500 hover:text-white text-xs font-bold"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>

                {/* SEARCH RESULTS DROPDOWN */}
                {clientSearchResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto bg-white border border-amber-500/40 rounded-lg divide-y divide-[#262D3D] shadow-xl">
                    {clientSearchResults.map((contact) => (
                      <button
                        key={contact.id || contact.customer_phone || contact.customer_name}
                        type="button"
                        onClick={() => {
                          setCreditClientName(sanitizeClientName(contact.customer_name));
                          setCreditClientPhone(contact.customer_phone || "");
                          setClientSearchResults([]);
                          setClientSearchQuery("");
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-amber-500/10 flex items-center justify-between transition cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {contact.customer_name}
                          </div>
                          {contact.customer_phone && (
                            <div className="text-[11px] text-amber-400 font-mono">
                              📞 {contact.customer_phone}
                            </div>
                          )}
                        </div>
                        {contact.category && (
                          <span className="text-[10px] uppercase font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded ml-2">
                            {contact.category}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* CLIENT DETAILS INPUTS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Client Name <span className="text-rose-400">* Required</span>
                  </label>
                  <input
                    type="text"
                    value={creditClientName}
                    onChange={(e) => setCreditClientName(sanitizeClientName(e.target.value))}
                    placeholder="Enter or select client name..."
                    className="w-full bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3.5 py-2.5 text-slate-900 text-xs font-bold outline-none transition shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                    Client Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={creditClientPhone}
                    onChange={(e) => handlePhoneInputChange(e.target.value)}
                    placeholder="e.g. 03361515, 3361515, +961..."
                    className="w-full bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3.5 py-2.5 text-slate-900 text-xs font-bold outline-none transition shadow-xs"
                  />
                </div>
              </div>

              {!creditClientName.trim() && (
                <span className="text-[11px] text-rose-400 block font-bold">
                  ⚠️ Please enter or pick the client's name to record this order under their credit account.
                </span>
              )}

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-mono flex flex-wrap justify-between items-center gap-2 shadow-xs">
                <span>Total Credit Receivable:</span>
                <span className="font-extrabold text-amber-950 text-sm">
                  ${totalUsd.toFixed(2)} USD • {totalLbp.toLocaleString()} LBP
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-white border border-slate-200 text-center space-y-2">
              <div className="text-2xl">{selectedMethod === "card" ? "💳" : "🟣"}</div>
              <h4 className="font-extrabold text-sm text-slate-900">
                {selectedMethod === "card"
                  ? "Charge Exact Amount on Bank POS Terminal"
                  : "Collect Exact Whish Money Transfer"}
              </h4>
              <p className="text-xs text-slate-500">
                Amount: <strong className="text-slate-900">${totalUsd.toFixed(2)}</strong> (
                {totalLbp.toLocaleString()} LBP). No cash change required.
              </p>
            </div>
          )}
          </div>
        </div>

        {/* RIGHT COLUMN: SCHEDULE OR HOLD ORDER & ADVANCE PAYMENT (ONLY FOR NON-TABLE ORDERS) */}
        {!isTable && (
          <div className="lg:w-1/2 flex flex-col gap-3 h-full overflow-y-auto no-scrollbar justify-between">
          <div className="space-y-3">
            {/* SCHEDULE OR HOLD ORDER */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 flex-shrink-0 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⏳</span>
                  <div>
                    <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">Schedule or Hold Order</h4>
                    <p className="text-[10px] text-slate-500">Set target kitchen prep & ready time or hold in queue</p>
                  </div>
                </div>
                {schedTime && (
                  <button
                    type="button"
                    onClick={() => {
                      setSchedTime("");
                      setSchedNote("");
                    }}
                    className="text-[10px] font-bold text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 px-2 py-1 rounded-lg transition cursor-pointer"
                  >
                    Clear Schedule
                  </button>
                )}
              </div>

              {/* Quick Time Presets */}
              <div>
                <div className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Quick Preset Ready Times:</span>
                  {schedTime && (
                    <span className="text-purple-300 font-mono text-[11px] font-bold">
                      Target: {formatScheduledDisplay(schedDate, schedTime)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[15, 30, 45, 60, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => applyQuickSchedule(mins)}
                      className="px-2 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-black text-slate-800 transition text-center active:scale-95 cursor-pointer shadow-2xs"
                    >
                      +{mins < 60 ? `${mins}m` : `${mins / 60}h`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Time Pickers */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Target Ready Date:</label>
                  <input
                    type="date"
                  inputMode="none"
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-2.5 py-1.5 text-xs text-slate-900 outline-none shadow-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Target Ready Time:</label>
                  <input
                    type="time"
                  inputMode="none"
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-2.5 py-1.5 text-xs text-slate-900 outline-none shadow-xs"
                  />
                </div>
              </div>

              {/* Kitchen Prep Note */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">
                  Kitchen Prep & Pickup Note (prints on ticket):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Customer pickup at curbside, extra crispy, pack sauces separately"
                  value={schedNote}
                  onChange={(e) => setSchedNote(e.target.value)}
                  className="w-full bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none shadow-xs"
                />
              </div>

              {/* Print Chit Preview Banner */}
              {schedTime && (
                <div className="p-2.5 bg-purple-950/40 border border-purple-500/30 rounded-lg text-xs space-y-0.5">
                  <div className="font-bold text-purple-300 flex items-center gap-1.5 text-[11px]">
                    <span>🖨️</span>
                    <span>Kitchen Chit Print Preview:</span>
                  </div>
                  <div className="font-mono text-[10px] text-white bg-black/60 p-2 rounded border border-purple-500/20">
                    <div className="font-bold text-amber-300">*** SCHEDULED ORDER ***</div>
                    <div className="text-purple-200">
                      READY AT: {formatScheduledDisplay(schedDate, schedTime)}
                    </div>
                    {schedNote && <div className="text-gray-300">NOTE: {schedNote}</div>}
                  </div>
                </div>
              )}

              {/* Hold & Save to Queue Button */}
              {onHoldOrder && (
                <div className="pt-1 flex items-center justify-end">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={async () => {
                      await onHoldOrder({
                        scheduledDate: schedDate,
                        scheduledTime: schedTime,
                        scheduledNote: schedNote
                      });
                      onClose();
                    }}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-black flex items-center justify-center gap-2 border border-amber-400/50 shadow-md shadow-amber-950/40 transition active:scale-95 cursor-pointer"
                    title="Save order into the Held Orders Queue immediately without closing payment"
                  >
                    <span>⏳</span>
                    <span>Hold & Save Order to Queue (No Payment)</span>
                  </button>
                </div>
              )}
            </div>

            {/* ORDERED & PAID IN ADVANCE TOGGLE */}
            {selectedMethod !== "on_account" && (
              <div className="pt-1 flex-shrink-0">
                <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-[#1e5c4f] cursor-pointer transition select-none shadow-xs">
                  <input
                    type="checkbox"
                    checked={isAdvancePayment}
                    onChange={(e) => setIsAdvancePayment(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 accent-amber-500 cursor-pointer"
                  />
                  <div className="flex-1 text-left">
                    <div className="text-xs font-black text-slate-900 flex items-center gap-2">
                      <span>⚡ Ordered & Paid in Advance</span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold border border-amber-500/40">
                        Keep Active
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {isTable
                        ? "Collect payment into shift sales now, but keep table occupied while guests finish dining."
                        : "Collect payment into shift sales now, while order continues preparing in the kitchen."}
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* MODAL ACTION FOOTER */}
      <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 flex-shrink-0 shadow-xs">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="px-4 py-3 rounded-xl text-xs font-extrabold text-slate-700 bg-slate-100 hover:bg-slate-200 transition active:scale-95 cursor-pointer"
        >
          Cancel / Back
        </button>

        {isTable && onPrintBill && (
          <button
            type="button"
            disabled={isSubmitting || isShiftOpen === false}
            onClick={async () => {
              if (isShiftOpen === false) {
                onOpenShift?.();
                return;
              }
              await onPrintBill();
              onClose();
            }}
            className={`px-4 py-3 rounded-xl text-xs font-black transition active:scale-95 flex items-center gap-1.5 shadow-md ${
              isShiftOpen === false
                ? "bg-white text-slate-500 border border-slate-200 opacity-40 cursor-not-allowed"
                : "text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 shadow-xs cursor-pointer"
            }`}
            title={isShiftOpen === false ? "Cannot print bill while shift is closed" : "Print pre-check bill for client without closing the table"}
          >
            <span className="text-sm">🧾</span>
            <span>Print Bill (Keep Open)</span>
          </button>
        )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm || isShiftOpen === false}
            className={`flex-1 py-3.5 px-4 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all shadow-xl ${
              !canConfirm || isShiftOpen === false
                ? "bg-slate-800 text-slate-500 border border-slate-700 opacity-50 cursor-not-allowed"
                : selectedMethod === "on_account"
                ? "bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 border border-amber-400 active:scale-98 shadow-amber-950/50 cursor-pointer"
                : isAdvancePayment
                ? "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 border border-amber-300 active:scale-98 shadow-amber-950/50 cursor-pointer"
                : isTable
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400 active:scale-98 shadow-emerald-900/40 cursor-pointer"
                : "bg-pos-primary hover:bg-pos-primary-hover text-white border border-pos-primary active:scale-98 shadow-md cursor-pointer"
            }`}
          >
            {isSubmitting ? (
              <span>PROCESSING TRANSACTION...</span>
            ) : isShiftOpen === false ? (
              <>
                <span>🔒</span>
                <span>SHIFT IS CLOSED — PAYMENT DISABLED</span>
              </>
            ) : selectedMethod === "on_account" ? (
              <>
                <span>📋</span>
                <span>SAVE AS CREDIT BY CLIENT NAME</span>
              </>
            ) : isAdvancePayment ? (
              <>
                <span>⚡</span>
                <span>CONFIRM ADVANCE PAYMENT (KEEP ACTIVE)</span>
              </>
            ) : isTable ? (
              <>
                <span>✅</span>
                <span>CLOSE TABLE & PRINT RECEIPT</span>
              </>
            ) : (
              <>
                <span>✅</span>
                <span>CONFIRM PAYMENT & PRINT RECEIPT</span>
              </>
            )}
          </button>
        </div>

        {/* Customer Directory Modal */}
        {isDirectoryModalOpen && (
          <CustomerSearchModal
            isOpen={isDirectoryModalOpen}
            onClose={() => setIsDirectoryModalOpen(false)}
            onSelectCustomer={(cust) => {
              setCreditClientName(sanitizeClientName(cust.customer_name));
              setCreditClientPhone(cust.customer_phone || "");
              setIsDirectoryModalOpen(false);
            }}
            initialPhone={creditClientPhone}
            initialName={creditClientName}
          />
        )}
      </div>
  );
};
