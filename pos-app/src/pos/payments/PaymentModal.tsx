import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  DollarSign,
  Banknote,
  CheckCircle2,
  Printer,
  AlertTriangle,
  RotateCcw,
  CreditCard,
  Zap,
  ShoppingBag,
  ArrowRight
} from 'lucide-react';
import { api } from '../../api/client';
import type {
  OrderFinancialSummary,
  PaymentRecord,
  SupportedCurrency,
  TenderItem
} from './types';
import {
  PAYMENT_METHODS,
  USD_PRESETS,
  LBP_PRESETS
} from './paymentConfig';
import type { PaymentMethodOption } from './paymentConfig';
import { PaymentMethodButton } from './PaymentMethodButton';
import { SplitPaymentPanel } from './SplitPaymentPanel';
import {
  getFinancialSummary,
  submitPayment,
  submitMultiTenderPayments
} from './paymentService';

interface PaymentModalProps {
  isOpen: boolean;
  orderId: number;
  orderNumber?: string | number;
  orderTotal: number;
  baseOrder?: any;
  cashierName?: string;
  terminalId?: string;
  onClose: () => void;
  onPaymentComplete: (summary: OrderFinancialSummary) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  orderId,
  orderNumber,
  orderTotal,
  baseOrder,
  cashierName = 'Cashier',
  terminalId = 'flow-pos-terminal',
  onClose,
  onPaymentComplete
}) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [financialSummary, setFinancialSummary] = useState<OrderFinancialSummary | null>(null);
  const [paymentsList, setPaymentsList] = useState<PaymentRecord[]>([]);

  // Stable operation identity across retries and concurrent submission guard
  const operationIdRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pay-${Date.now()}`
  );
  const isSubmittingRef = useRef<boolean>(false);

  // Exchange rate from FLOW
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(true);

  // Multi-tender staging
  const [stagedTenders, setStagedTenders] = useState<TenderItem[]>([]);
  const [isSplitMode, setIsSplitMode] = useState(false);

  // Active tender form state
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodOption>(PAYMENT_METHODS[0]);
  const [tenderInput, setTenderInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [printSuccess, setPrintSuccess] = useState<boolean | null>(null);

  // Load summary and exchange rate
  useEffect(() => {
    if (!isOpen || !orderId) return;

    // Reset operation ID for a fresh payment attempt when modal opens
    operationIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `pay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    isSubmittingRef.current = false;

    let isMounted = true;
    setLoading(true);
    setErrorMessage(null);
    setStagedTenders([]);
    setIsSplitMode(false);

    // Fetch exchange rate from FLOW app_settings / restaurants (fallback: 89500)
    api.getExchangeRate()
      .then(res => {
        if (isMounted) {
          if (res.success && res.rate && res.rate > 0) {
            setExchangeRate(res.rate);
          } else {
            setExchangeRate(89500);
          }
          setRateLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setExchangeRate(89500);
          setRateLoading(false);
        }
      });

    // Fetch financial ledger from OVRLOAD
    getFinancialSummary(orderId, baseOrder)
      .then(res => {
        if (isMounted) {
          setFinancialSummary(res.summary);
          setPaymentsList(res.payments);
          // Default tender amount to remaining balance
          const rem = res.summary.amountRemaining;
          setTenderInput(rem > 0 ? rem.toFixed(2) : '0.00');
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setErrorMessage(err.message || 'Failed to load order financial data');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, orderId, baseOrder]);

  if (!isOpen) return null;

  const orderRemaining = financialSummary?.amountRemaining ?? orderTotal;
  const stagedApplied = stagedTenders.reduce((sum, t) => sum + t.appliedUsd, 0);
  const netRemaining = Math.max(0, orderRemaining - stagedApplied);

  // Active tender calculation
  const isLbp = selectedMethod.currency === 'LBP';
  const numericTender = parseFloat(tenderInput) || 0;

  let appliedUsdForCurrent = 0;
  let changeAmount = 0;

  if (isLbp) {
    if (exchangeRate && exchangeRate > 0) {
      const tenderUsdEquiv = numericTender / exchangeRate;
      if (tenderUsdEquiv >= netRemaining) {
        appliedUsdForCurrent = netRemaining;
        changeAmount = Math.max(0, tenderUsdEquiv - netRemaining);
      } else {
        appliedUsdForCurrent = tenderUsdEquiv;
        changeAmount = 0;
      }
    }
  } else {
    if (numericTender >= netRemaining) {
      appliedUsdForCurrent = netRemaining;
      changeAmount = Math.max(0, numericTender - netRemaining);
    } else {
      appliedUsdForCurrent = numericTender;
      changeAmount = 0;
    }
  }

  // Handle Preset Click
  const handlePresetClick = (amount: number) => {
    setTenderInput(String(amount));
  };

  const handleExactClick = () => {
    if (isLbp) {
      if (exchangeRate) {
        setTenderInput(String(Math.ceil(netRemaining * exchangeRate)));
      }
    } else {
      setTenderInput(netRemaining.toFixed(2));
    }
  };

  // Add Staged Tender
  const handleAddStagedTender = () => {
    if (appliedUsdForCurrent <= 0) {
      setErrorMessage('Please enter a valid tender amount.');
      return;
    }

    const newTender: TenderItem = {
      id: 'tender-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      operationId: `${operationIdRef.current}_part_${stagedTenders.length + 1}`,
      method: selectedMethod.name,
      category: selectedMethod.category,
      currency: selectedMethod.currency,
      exchangeRate: isLbp ? exchangeRate : null,
      tenderedAmount: numericTender,
      appliedUsd: parseFloat(appliedUsdForCurrent.toFixed(2)),
      changeAmount: parseFloat(changeAmount.toFixed(2))
    };

    const updated = [...stagedTenders, newTender];
    setStagedTenders(updated);

    const newTotalApplied = updated.reduce((sum, t) => sum + t.appliedUsd, 0);
    const newNetRemaining = Math.max(0, orderRemaining - newTotalApplied);

    if (newNetRemaining > 0) {
      setTenderInput(newNetRemaining.toFixed(2));
    } else {
      setTenderInput('0.00');
    }
    setErrorMessage(null);
  };

  // Remove Staged Tender
  const handleRemoveStagedTender = (id: string) => {
    const updated = stagedTenders.filter(t => t.id !== id);
    setStagedTenders(updated);
    const newTotalApplied = updated.reduce((sum, t) => sum + t.appliedUsd, 0);
    const newNetRemaining = Math.max(0, orderRemaining - newTotalApplied);
    setTenderInput(newNetRemaining.toFixed(2));
  };

  // Print Receipt via LAN Print Server
  const handlePrintReceipt = async (extraData?: { invoice_number?: string; invoice_series?: string }) => {
    try {
      const invNum = extraData?.invoice_number || (baseOrder as any)?.invoice_number;
      const invSer = extraData?.invoice_series || (baseOrder as any)?.invoice_series;
      const printPayload = {
        orderId,
        orderNumber: invNum || orderNumber || orderId,
        invoice_number: invNum,
        invoice_series: invSer,
        total: orderTotal,
        items: baseOrder?.items || [],
        customerName: baseOrder?.customer_name || 'Guest',
        customerPhone: baseOrder?.customer_phone || '',
        paymentMethod: selectedMethod.name,
        cashier: cashierName,
        timestamp: new Date().toISOString()
      };

      const res = await fetch('http://192.168.18.195:9191/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(printPayload)
      });

      if (res.ok) {
        setPrintSuccess(true);
      } else {
        setPrintSuccess(false);
      }
    } catch {
      setPrintSuccess(false);
    }
  };

  // Finalize Payment
  const handleFinalize = async () => {
    if (isSubmittingRef.current || submitting) return;
    isSubmittingRef.current = true;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      let finalTenders: TenderItem[] = [];

      if (stagedTenders.length > 0) {
        finalTenders = stagedTenders.map((t, idx) => ({
          ...t,
          operationId: t.operationId || `${operationIdRef.current}_part_${idx + 1}`
        }));
        // If there's still a balance and the user entered an amount in the box, include it
        if (netRemaining > 0 && appliedUsdForCurrent > 0) {
          finalTenders.push({
            id: 'tender-final',
            operationId: `${operationIdRef.current}_part_${finalTenders.length + 1}`,
            method: selectedMethod.name,
            category: selectedMethod.category,
            currency: selectedMethod.currency,
            exchangeRate: isLbp ? exchangeRate : null,
            tenderedAmount: numericTender,
            appliedUsd: parseFloat(appliedUsdForCurrent.toFixed(2)),
            changeAmount: parseFloat(changeAmount.toFixed(2))
          });
        }
      } else {
        // Single direct tender
        if (appliedUsdForCurrent <= 0) {
          setErrorMessage('Please specify tender amount before finalizing.');
          setSubmitting(false);
          isSubmittingRef.current = false;
          return;
        }
        finalTenders = [{
          id: 'tender-single',
          operationId: operationIdRef.current,
          method: selectedMethod.name,
          category: selectedMethod.category,
          currency: selectedMethod.currency,
          exchangeRate: isLbp ? exchangeRate : null,
          tenderedAmount: numericTender,
          appliedUsd: parseFloat(appliedUsdForCurrent.toFixed(2)),
          changeAmount: parseFloat(changeAmount.toFixed(2))
        }];
      }

      // Submit tenders
      const result = await submitMultiTenderPayments({
        orderId,
        tenders: finalTenders,
        terminalId,
        cashierName
      });

      if (!result.success) {
        setErrorMessage(result.error || 'Payment failed to process');
        return;
      }

      // Also trigger LAN printing automatically in background
      handlePrintReceipt(result.summary ? { 
        invoice_number: (result.summary as any).invoice_number, 
        invoice_series: (result.summary as any).invoice_series 
      } : undefined).catch(() => {});

      if (result.summary) {
        onPaymentComplete(result.summary);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment submission error');
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#1e5c4f]">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                Take Payment — Order #{orderNumber || orderId}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Cashier: <span className="text-slate-800 font-bold">{cashierName}</span> • Terminal: <span className="text-slate-800 font-bold">{terminalId}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Exchange Rate Badge */}
            {rateLoading ? (
              <span className="text-xs text-slate-400">Loading rate...</span>
            ) : exchangeRate ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[#1e5c4f] text-xs font-bold">
                <span>Rate:</span>
                <span className="font-mono">{exchangeRate.toLocaleString()} LBP/$</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>LBP Payment Unavailable — Exchange Rate Not Configured</span>
              </div>
            )}

            <button
              onClick={onClose}
              disabled={submitting}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2 font-medium">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Top Row: Financial Snapshot */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Bill</span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                ${orderTotal.toFixed(2)}
              </div>
              {exchangeRate && (
                <div className="text-xs text-slate-400 font-medium">
                  {(orderTotal * exchangeRate).toLocaleString()} LBP
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Already Paid</span>
              <div className="text-2xl font-black text-[#1e5c4f] mt-1">
                ${(financialSummary?.amountPaid || 0).toFixed(2)}
              </div>
              <div className="text-xs text-slate-400 font-bold uppercase">
                {financialSummary?.paymentStatus || 'UNPAID'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Remaining Due</span>
              <div className={`text-2xl font-black mt-1 ${netRemaining > 0 ? 'text-amber-800' : 'text-slate-400'}`}>
                ${netRemaining.toFixed(2)}
              </div>
              {exchangeRate && netRemaining > 0 && (
                <div className="text-xs text-slate-400 font-medium">
                  {Math.ceil(netRemaining * exchangeRate).toLocaleString()} LBP
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Calculated Change</span>
              <div className={`text-2xl font-black mt-1 ${changeAmount > 0 ? 'text-[#1e5c4f]' : 'text-slate-400'}`}>
                {isLbp && exchangeRate
                  ? `${Math.round(changeAmount * exchangeRate).toLocaleString()} LBP`
                  : `$${changeAmount.toFixed(2)}`}
              </div>
              {exchangeRate && changeAmount > 0 && (
                <div className="text-xs text-[#1e5c4f] font-bold">
                  {isLbp
                    ? `≈ $${changeAmount.toFixed(2)} USD`
                    : `≈ ${Math.round(changeAmount * exchangeRate).toLocaleString()} LBP`}
                </div>
              )}
            </div>
          </div>

          {/* Payment Method Selector Grid */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-600 mb-2.5 block">
              Select Payment Method
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              {PAYMENT_METHODS.map(method => {
                const isLbpDisabled = method.currency === 'LBP' && (!exchangeRate || exchangeRate <= 0);
                return (
                  <PaymentMethodButton
                    key={method.id}
                    method={method}
                    isSelected={selectedMethod.id === method.id}
                    disabled={isLbpDisabled || submitting}
                    onClick={() => {
                      setSelectedMethod(method);
                      setErrorMessage(null);
                      if (method.currency === 'LBP') {
                        if (exchangeRate) {
                          setTenderInput(String(Math.ceil(netRemaining * exchangeRate)));
                        }
                      } else {
                        setTenderInput(netRemaining.toFixed(2));
                      }
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Tender Amount Input & Quick Buttons */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-sm font-black text-slate-900">
                  Tendered Amount ({selectedMethod.currency})
                </span>
                <p className="text-xs text-slate-500 font-medium">
                  {isLbp ? 'Enter amount in Lebanese Pounds' : 'Enter amount in US Dollars'}
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="number"
                  inputMode="numeric"
                  step={isLbp ? '1000' : '0.01'}
                  value={tenderInput}
                  onChange={e => setTenderInput(e.target.value)}
                  disabled={submitting}
                  className="w-full sm:w-48 bg-white border border-slate-300 text-slate-900 text-lg font-black px-3 py-2 rounded-xl focus:border-[#1e5c4f] focus:outline-none text-right font-mono shadow-xs"
                  placeholder="0.00"
                />
                <button
                  type="button"
                  onClick={handleExactClick}
                  disabled={submitting || netRemaining <= 0}
                  className="px-3 py-2 bg-white hover:bg-slate-100 text-[#1e5c4f] border border-slate-300 rounded-xl text-xs font-black uppercase transition-all whitespace-nowrap shadow-xs"
                >
                  Exact
                </button>
              </div>
            </div>

            {/* Quick Cash Presets */}
            <div>
              <span className="text-xs text-slate-500 block mb-2 font-bold uppercase tracking-wider">Quick Presets:</span>
              <div className="flex flex-wrap gap-2">
                {isLbp ? (
                  LBP_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePresetClick(preset)}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all shadow-xs"
                    >
                      {preset.toLocaleString()} LBP
                    </button>
                  ))
                ) : (
                  USD_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePresetClick(preset)}
                      className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all shadow-xs"
                    >
                      ${preset}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Split Tender Action Button */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Splitting across multiple tender methods?
              </span>
              <button
                type="button"
                onClick={handleAddStagedTender}
                disabled={submitting || appliedUsdForCurrent <= 0}
                className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              >
                <span>Add Tender to Split</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#1e5c4f]" />
              </button>
            </div>
          </div>

          {/* Multi-Tender Breakdown List if split mode or tenders staged */}
          {stagedTenders.length > 0 && (
            <SplitPaymentPanel
              tenders={stagedTenders}
              orderTotal={orderRemaining}
              onRemoveTender={handleRemoveStagedTender}
            />
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Thermal LAN Receipt (192.168.18.195:9191) auto-triggered on completion</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-sm transition-all"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleFinalize}
              disabled={submitting || (stagedTenders.length === 0 && appliedUsdForCurrent <= 0)}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-sm shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span>Recording Payment...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>Finalize Payment ({stagedTenders.length > 0 ? `${stagedTenders.length + (appliedUsdForCurrent > 0 ? 1 : 0)} Tenders` : `${selectedMethod.name}`})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
