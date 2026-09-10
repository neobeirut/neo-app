import React, { useState, useEffect } from 'react';
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

    let isMounted = true;
    setLoading(true);
    setErrorMessage(null);
    setStagedTenders([]);
    setIsSplitMode(false);

    // Fetch exchange rate from FLOW app_settings / restaurants
    api.getExchangeRate()
      .then(res => {
        if (isMounted) {
          if (res.success && res.rate && res.rate > 0) {
            setExchangeRate(res.rate);
          } else {
            setExchangeRate(null);
          }
          setRateLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setExchangeRate(null);
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
  const handlePrintReceipt = async () => {
    try {
      const printPayload = {
        orderId,
        orderNumber: orderNumber || orderId,
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
    setSubmitting(true);
    setErrorMessage(null);

    try {
      let finalTenders: TenderItem[] = [];

      if (stagedTenders.length > 0) {
        finalTenders = [...stagedTenders];
        // If there's still a balance and the user entered an amount in the box, include it
        if (netRemaining > 0 && appliedUsdForCurrent > 0) {
          finalTenders.push({
            id: 'tender-final',
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
          return;
        }
        finalTenders = [{
          id: 'tender-single',
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
        setSubmitting(false);
        return;
      }

      // Also trigger LAN printing automatically in background
      handlePrintReceipt().catch(() => {});

      if (result.summary) {
        onPaymentComplete(result.summary);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment submission error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Take Payment — Order #{orderNumber || orderId}
              </h2>
              <p className="text-xs text-slate-400">
                Cashier: <span className="text-slate-200 font-medium">{cashierName}</span> • Terminal: <span className="text-slate-200 font-medium">{terminalId}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Exchange Rate Badge */}
            {rateLoading ? (
              <span className="text-xs text-slate-500">Loading rate...</span>
            ) : exchangeRate ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <span>Rate:</span>
                <span className="font-mono">{exchangeRate.toLocaleString()} LBP/$</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>LBP Rate Not Configured</span>
              </div>
            )}

            <button
              onClick={onClose}
              disabled={submitting}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Top Row: Financial Snapshot */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Total Bill</span>
              <div className="text-2xl font-black text-slate-100 mt-1">
                ${orderTotal.toFixed(2)}
              </div>
              {exchangeRate && (
                <div className="text-xs text-slate-500">
                  {(orderTotal * exchangeRate).toLocaleString()} LBP
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Already Paid</span>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                ${(financialSummary?.amountPaid || 0).toFixed(2)}
              </div>
              <div className="text-xs text-slate-500">
                {financialSummary?.paymentStatus || 'UNPAID'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Remaining Due</span>
              <div className={`text-2xl font-black mt-1 ${netRemaining > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                ${netRemaining.toFixed(2)}
              </div>
              {exchangeRate && netRemaining > 0 && (
                <div className="text-xs text-slate-500">
                  {Math.ceil(netRemaining * exchangeRate).toLocaleString()} LBP
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Calculated Change</span>
              <div className={`text-2xl font-black mt-1 ${changeAmount > 0 ? 'text-emerald-300' : 'text-slate-500'}`}>
                ${changeAmount.toFixed(2)}
              </div>
              {exchangeRate && changeAmount > 0 && (
                <div className="text-xs text-emerald-400 font-medium">
                  {Math.round(changeAmount * exchangeRate).toLocaleString()} LBP
                </div>
              )}
            </div>
          </div>

          {/* Payment Method Selector Grid */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 block">
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
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-sm font-bold text-slate-200">
                  Tendered Amount ({selectedMethod.currency})
                </span>
                <p className="text-xs text-slate-400">
                  {isLbp ? 'Enter amount in Lebanese Pounds' : 'Enter amount in US Dollars'}
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="number"
                  step={isLbp ? '1000' : '0.01'}
                  value={tenderInput}
                  onChange={e => setTenderInput(e.target.value)}
                  disabled={submitting}
                  className="w-full sm:w-48 bg-slate-900 border border-slate-700 text-slate-100 text-lg font-bold px-3 py-2 rounded-xl focus:border-amber-500 focus:outline-none text-right font-mono"
                  placeholder="0.00"
                />
                <button
                  type="button"
                  onClick={handleExactClick}
                  disabled={submitting || netRemaining <= 0}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl text-xs font-bold uppercase transition-all whitespace-nowrap"
                >
                  Exact
                </button>
              </div>
            </div>

            {/* Quick Cash Presets */}
            <div>
              <span className="text-xs text-slate-500 block mb-2 font-medium">Quick Presets:</span>
              <div className="flex flex-wrap gap-2">
                {isLbp ? (
                  LBP_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePresetClick(preset)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-all"
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
                      className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-all"
                    >
                      ${preset}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Split Tender Action Button */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Splitting across multiple tender methods?
              </span>
              <button
                type="button"
                onClick={handleAddStagedTender}
                disabled={submitting || appliedUsdForCurrent <= 0}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <span>Add Tender to Split</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
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
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/95 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Printer className="w-4 h-4 text-slate-400" />
            <span>Thermal LAN Receipt (192.168.18.195:9191) auto-triggered on completion</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-semibold text-sm transition-all"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleFinalize}
              disabled={submitting || (stagedTenders.length === 0 && appliedUsdForCurrent <= 0)}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
