import React, { useState, useEffect, useMemo } from "react";

export interface TerminalPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalUsd: number;
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
  }) => Promise<void>;
}

type PaymentMethodKey = "cash_usd" | "cash_lbp" | "card" | "whish";

export const TerminalPaymentModal: React.FC<TerminalPaymentModalProps> = ({
  isOpen,
  onClose,
  totalUsd,
  exchangeRate = 89500,
  isTable,
  tableCode,
  guestCount = 1,
  waiterName,
  orderType = "dine_in",
  isSubmitting = false,
  onConfirmPayment
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodKey>("cash_usd");
  const [tenderInput, setTenderInput] = useState<string>("");

  const rate = exchangeRate && exchangeRate > 0 ? exchangeRate : 89500;
  const totalLbp = useMemo(() => Math.round(totalUsd * rate), [totalUsd, rate]);

  // Reset tender input when modal opens or method changes
  useEffect(() => {
    if (!isOpen) return;
    if (selectedMethod === "cash_usd") {
      setTenderInput(totalUsd.toFixed(2));
    } else if (selectedMethod === "cash_lbp") {
      setTenderInput(String(totalLbp));
    } else {
      setTenderInput(totalUsd.toFixed(2));
    }
  }, [isOpen, selectedMethod, totalUsd, totalLbp]);

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

  // Determine if payment is valid to confirm
  const canConfirm = (() => {
    if (isSubmitting) return false;
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
    if (val === "CLEAR") {
      setTenderInput("");
      return;
    }
    if (val === "BACKSPACE") {
      setTenderInput((prev) => prev.slice(0, -1));
      return;
    }
    if (val === "." && tenderInput.includes(".")) {
      return;
    }
    setTenderInput((prev) => prev + val);
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
    }

    onConfirmPayment({
      paymentMethod: paymentMethodLabel,
      tenderedAmount: tenderedAmt,
      tenderedCurrency: tenderedCurr,
      changeAmount: changeAmt,
      changeCurrency: changeCurr
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 print:hidden animate-fade-in">
      <div className="bg-[#14171F] border border-[#262D3D] rounded-2xl w-full max-w-3xl text-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="p-4 bg-[#181C24] border-b border-[#262D3D] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-xl font-black">
              {isTable ? "🪑" : "💳"}
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-white leading-tight">
                {isTable ? `Settle & Close Table ${tableCode}` : "Settle Order & Print Receipt"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isTable
                  ? `Guests: ${guestCount} • Waiter: ${waiterName || "Staff"}`
                  : `${orderType?.toUpperCase()} Order Checkout`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-lg bg-[#262D3D] hover:bg-[#323B4E] text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* MODAL CONTENT BODY */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* TOTAL DUE BANNER */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-[#181C24] to-[#1F2430] border border-[#262D3D] flex flex-wrap items-center justify-between gap-3 shadow-inner">
            <div>
              <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                TOTAL DUE TO PAY
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl sm:text-4xl font-black text-[#eb660c]">
                  ${totalUsd.toFixed(2)}
                </span>
                <span className="text-sm sm:text-base font-bold text-slate-300">
                  ≈ {totalLbp.toLocaleString()} LBP
                </span>
              </div>
            </div>

            <div className="px-3 py-1.5 rounded-lg bg-[#0F1115] border border-[#262D3D] text-right">
              <span className="text-[10px] text-slate-400 block">EXCHANGE RATE</span>
              <span className="text-xs font-black text-emerald-400">
                1 USD = {rate.toLocaleString()} LBP
              </span>
            </div>
          </div>

          {/* PAYMENT METHOD SELECTOR */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-300 mb-2 block">
              Choose Payment Currency & Method:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setSelectedMethod("cash_usd")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedMethod === "cash_usd"
                    ? "bg-emerald-950/80 border-emerald-500 text-white shadow-lg shadow-emerald-900/30 ring-1 ring-emerald-500"
                    : "bg-[#181C24] border-[#262D3D] text-slate-300 hover:bg-[#202531]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-lg">💵</span>
                  <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-900/40 px-1.5 py-0.5 rounded">
                    USD
                  </span>
                </div>
                <div className="text-xs font-black">Cash USD</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  ${totalUsd.toFixed(2)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod("cash_lbp")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedMethod === "cash_lbp"
                    ? "bg-emerald-950/80 border-emerald-500 text-white shadow-lg shadow-emerald-900/30 ring-1 ring-emerald-500"
                    : "bg-[#181C24] border-[#262D3D] text-slate-300 hover:bg-[#202531]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-lg">🇱🇧</span>
                  <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-900/40 px-1.5 py-0.5 rounded">
                    LBP
                  </span>
                </div>
                <div className="text-xs font-black">Cash LBP</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                  {totalLbp.toLocaleString()} L.L.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod("card")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedMethod === "card"
                    ? "bg-blue-950/80 border-blue-500 text-white shadow-lg shadow-blue-900/30 ring-1 ring-blue-500"
                    : "bg-[#181C24] border-[#262D3D] text-slate-300 hover:bg-[#202531]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-lg">💳</span>
                  <span className="text-[10px] font-black uppercase text-blue-400 bg-blue-900/40 px-1.5 py-0.5 rounded">
                    POS
                  </span>
                </div>
                <div className="text-xs font-black">Credit Card</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Exact Charge</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod("whish")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedMethod === "whish"
                    ? "bg-purple-950/80 border-purple-500 text-white shadow-lg shadow-purple-900/30 ring-1 ring-purple-500"
                    : "bg-[#181C24] border-[#262D3D] text-slate-300 hover:bg-[#202531]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-lg">🟣</span>
                  <span className="text-[10px] font-black uppercase text-purple-400 bg-purple-900/40 px-1.5 py-0.5 rounded">
                    APP
                  </span>
                </div>
                <div className="text-xs font-black">Whish Money</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Exact Transfer</div>
              </button>
            </div>
          </div>

          {/* TENDER INPUT & CHANGE CALCULATION */}
          {["cash_usd", "cash_lbp"].includes(selectedMethod) ? (
            <div className="bg-[#181C24] border border-[#262D3D] rounded-xl p-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* LEFT SIDE: Input, Presets, and Live Change Box */}
                <div className="md:col-span-7 space-y-3.5 flex flex-col justify-between">
                  {/* Tender Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-slate-200">
                        Cash Tendered ({selectedMethod === "cash_usd" ? "USD $" : "LBP L.L."})
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {selectedMethod === "cash_usd" ? "Handed in USD" : "Handed in LBP"}
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        step={selectedMethod === "cash_usd" ? "0.01" : "5000"}
                        value={tenderInput}
                        onChange={(e) => setTenderInput(e.target.value)}
                        placeholder="0"
                        disabled={isSubmitting}
                        className="w-full bg-[#0F1115] border border-[#262D3D] text-white text-2xl font-mono font-black pl-12 pr-3 py-2.5 rounded-xl text-right focus:border-[#eb660c] focus:outline-none"
                      />
                      <span className="absolute left-3.5 top-3 text-xs text-slate-500 font-black">
                        {selectedMethod === "cash_usd" ? "USD $" : "LBP"}
                      </span>
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                      Quick Bill Presets:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedMethod === "cash_usd" ? usdPresets : lbpPresets).map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setTenderInput(String(preset))}
                          className="px-2.5 py-1.5 rounded-lg bg-[#262D3D] hover:bg-[#323B4E] border border-slate-700 text-xs font-black text-slate-200 hover:text-white transition active:scale-95 cursor-pointer"
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
                      <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-center space-y-1 animate-fade-in shadow-inner">
                        <span className="text-[11px] font-black uppercase text-emerald-400 tracking-wider block">
                          💵 CHANGE DUE TO CUSTOMER
                        </span>
                        <div className="text-3xl font-black text-white font-mono">
                          ${changeDueUsd.toFixed(2)} USD
                        </div>
                        {changeDueUsd > 0 && (
                          <div className="text-xs font-bold text-emerald-300">
                            ≈ {changeDueLbpFromUsd.toLocaleString()} LBP (if returning in Lebanese Pounds)
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-center space-y-0.5 animate-fade-in">
                        <span className="text-[11px] font-black uppercase text-rose-400 tracking-wider block">
                          ⚠️ SHORTAGE / REMAINING DUE
                        </span>
                        <div className="text-2xl font-black text-rose-200 font-mono">
                          ${remainingUsd.toFixed(2)} USD
                        </div>
                        <div className="text-[11px] text-rose-300">
                          ≈ {remainingLbpFromUsd.toLocaleString()} LBP still needed
                        </div>
                      </div>
                    )
                  ) : isLbpCovered ? (
                    <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-center space-y-1 animate-fade-in shadow-inner">
                      <span className="text-[11px] font-black uppercase text-emerald-400 tracking-wider block">
                        🇱🇧 CHANGE DUE TO CUSTOMER
                      </span>
                      <div className="text-3xl font-black text-white font-mono">
                        {changeDueLbp.toLocaleString()} LBP
                      </div>
                      {changeDueLbp > 0 && (
                        <div className="text-xs font-bold text-emerald-300">
                          ≈ ${changeDueUsdFromLbp.toFixed(2)} USD (if returning in Dollars)
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-center space-y-0.5 animate-fade-in">
                      <span className="text-[11px] font-black uppercase text-rose-400 tracking-wider block">
                        ⚠️ SHORTAGE / REMAINING DUE
                      </span>
                      <div className="text-2xl font-black text-rose-200 font-mono">
                        {remainingLbp.toLocaleString()} LBP
                      </div>
                      <div className="text-[11px] text-rose-300">
                        ≈ ${remainingUsdFromLbp.toFixed(2)} USD still needed
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT SIDE: ON-SCREEN NUMPAD FOR TOUCH TERMINALS */}
                <div className="md:col-span-5 flex flex-col justify-center border-t md:border-t-0 md:border-l border-[#262D3D] pt-3 md:pt-0 md:pl-4">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2 text-center md:text-left">
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
                              ? "bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30"
                              : "bg-[#0F1115] hover:bg-[#202531] text-slate-200 border border-[#262D3D]"
                          }`}
                        >
                          {btn}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() => handleNumpadPress("CLEAR")}
                      className="h-10 rounded-lg font-black text-xs bg-rose-950/40 hover:bg-rose-900/50 text-rose-400 border border-rose-500/30 transition active:scale-95 flex items-center justify-center cursor-pointer"
                    >
                      CLEAR
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedMethod === "cash_usd") {
                          setTenderInput(totalUsd.toFixed(2));
                        } else {
                          setTenderInput(String(totalLbp));
                        }
                      }}
                      className="h-10 rounded-lg font-black text-xs bg-[#262D3D] hover:bg-[#323B4E] text-emerald-400 border border-emerald-500/30 transition active:scale-95 flex items-center justify-center cursor-pointer"
                    >
                      EXACT
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#181C24] border border-[#262D3D] text-center space-y-2">
              <div className="text-2xl">{selectedMethod === "card" ? "💳" : "🟣"}</div>
              <h4 className="font-extrabold text-sm text-white">
                {selectedMethod === "card"
                  ? "Charge Exact Amount on Bank POS Terminal"
                  : "Collect Exact Whish Money Transfer"}
              </h4>
              <p className="text-xs text-slate-400">
                Amount: <strong className="text-white">${totalUsd.toFixed(2)}</strong> (
                {totalLbp.toLocaleString()} LBP). No cash change required.
              </p>
            </div>
          )}
        </div>

        {/* MODAL ACTION FOOTER */}
        <div className="p-4 bg-[#181C24] border-t border-[#262D3D] flex items-center justify-between gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-3 rounded-xl text-xs font-extrabold text-slate-300 bg-[#262D3D] hover:bg-[#323B4E] transition active:scale-95 cursor-pointer"
          >
            Cancel / Back
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`flex-1 py-3.5 px-4 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer ${
              !canConfirm
                ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                : isTable
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400 active:scale-98 shadow-emerald-900/40"
                : "bg-[#eb660c] hover:bg-[#d55909] text-white border border-[#eb660c] active:scale-98 shadow-[#eb660c]/30"
            }`}
          >
            {isSubmitting ? (
              <span>PROCESSING TRANSACTION...</span>
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
      </div>
    </div>
  );
};
