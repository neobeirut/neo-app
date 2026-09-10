import React, { useState, useEffect } from 'react';
import type { ShiftCashRecord } from '../services/shiftCashBridge';
import {
  calculateShiftReconciliation,
  checkVarianceThresholds,
  verifyManagerPin,
  getBranchReconSettings,
  generateShiftReportPrintPayload,
  printShiftReport
} from '../services/shiftReconciliationService';
import type { ShiftReconciliationSummary, BranchReconSettings } from '../services/shiftReconciliationService';

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: ShiftCashRecord | null;
  branchName: string;
  branchId?: string;
  locationKey: string;
  terminalId?: string;
  cashierName: string;
  onShiftClosed: (closedShift: ShiftCashRecord, recon: ShiftReconciliationSummary) => void;
}

export const CloseShiftModal: React.FC<CloseShiftModalProps> = ({
  isOpen,
  onClose,
  shift,
  branchName,
  branchId,
  locationKey,
  terminalId = 'TERM-1',
  cashierName,
  onShiftClosed
}) => {
  if (!isOpen || !shift) return null;

  const [step, setStep] = useState<'REVIEW' | 'COUNT' | 'RECONCILE' | 'AUTHORIZE'>('REVIEW');
  const [loadingRecon, setLoadingRecon] = useState(false);
  const [reconData, setReconData] = useState<ShiftReconciliationSummary | null>(null);
  const [branchSettings, setBranchSettings] = useState<BranchReconSettings>({
    allowed_usd_variance: 2.0,
    allowed_lbp_variance: 100000,
    blind_cash_close_enabled: false,
    denomination_helper_enabled: true
  });

  // Physical Counts
  const [actualUsd, setActualUsd] = useState<string>('');
  const [actualLbp, setActualLbp] = useState<string>('');
  const [hasSubmittedCount, setHasSubmittedCount] = useState(false);

  // Denomination Helper State
  const [showDenomHelper, setShowDenomHelper] = useState(false);
  const [usdDenoms, setUsdDenoms] = useState<{ [key: string]: number }>({
    '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0
  });
  const [lbpDenoms, setLbpDenoms] = useState<{ [key: string]: number }>({
    '100000': 0, '50000': 0, '20000': 0, '10000': 0, '5000': 0
  });

  // Manager Approval State
  const [managerPin, setManagerPin] = useState('');
  const [managerName, setManagerName] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [varianceReason, setVarianceReason] = useState('Counting difference');
  const [varianceNotes, setVarianceNotes] = useState('');

  // Closing State
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load branch settings and live reconciliation on open
  useEffect(() => {
    if (!isOpen || !shift) return;

    const loadData = async () => {
      setLoadingRecon(true);
      setErrorMessage(null);
      try {
        const settings = await getBranchReconSettings(branchId || branchName);
        setBranchSettings(settings);

        const res = await calculateShiftReconciliation({
          locationKey,
          startTime: shift.created_at,
          endTime: new Date().toISOString(),
          terminalId: shift.terminal_id || terminalId,
          openingUsd: Number(shift.opening_usd || 0),
          openingLbp: Number(shift.opening_lbp || 0)
        });

        if (res.success && res.summary) {
          setReconData(res.summary);
        } else {
          setErrorMessage(res.error || 'Failed to calculate reconciliation figures');
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Error fetching shift reconciliation');
      } finally {
        setLoadingRecon(false);
      }
    };

    loadData();
  }, [isOpen, shift, branchId, branchName, locationKey, terminalId]);

  // Denomination Calculations
  const calcDenomUsd = () => {
    return Object.entries(usdDenoms).reduce((sum, [bill, count]) => sum + Number(bill) * (count || 0), 0);
  };

  const calcDenomLbp = () => {
    return Object.entries(lbpDenoms).reduce((sum, [bill, count]) => sum + Number(bill) * (count || 0), 0);
  };

  const applyDenomTotals = () => {
    setActualUsd(String(calcDenomUsd()));
    setActualLbp(String(calcDenomLbp()));
    setShowDenomHelper(false);
  };

  // Variances
  const numericActualUsd = parseFloat(actualUsd) || 0;
  const numericActualLbp = parseFloat(actualLbp) || 0;
  const expectedUsd = reconData?.expectedCashUsd || Number(shift.opening_usd || 0);
  const expectedLbp = reconData?.expectedCashLbp || Number(shift.opening_lbp || 0);

  const varianceCheck = checkVarianceThresholds(
    numericActualUsd,
    numericActualLbp,
    expectedUsd,
    expectedLbp,
    branchSettings
  );

  const handleVerifyManager = async () => {
    if (!managerPin || managerPin.length < 4) {
      setPinError('Please enter a 4-digit Manager PIN');
      return;
    }
    setIsVerifyingPin(true);
    setPinError('');
    try {
      const res = await verifyManagerPin(managerPin);
      if (res.success && res.managerName) {
        setManagerName(res.managerName);
        setPinError('');
      } else {
        setPinError(res.error || 'Invalid manager PIN or insufficient permissions');
      }
    } catch (err: any) {
      setPinError(err.message || 'Error verifying PIN');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleFinalizeClose = async () => {
    if (varianceCheck.requiresManagerApproval && !managerName) {
      setStep('AUTHORIZE');
      setPinError('Manager approval is required before closing shift with cash variance.');
      return;
    }

    setIsFinalizing(true);
    setErrorMessage(null);

    try {
      const fullNotes = varianceNotes
        ? `[${varianceReason}] ${varianceNotes}`
        : varianceReason;

      const { closeShift } = await import('../services/shiftCashBridge');
      const res = await closeShift({
        shiftId: shift.id,
        actualUsd: numericActualUsd,
        actualLbp: numericActualLbp,
        expectedCashUsd: expectedUsd,
        expectedCashLbp: expectedLbp,
        varianceUsd: varianceCheck.varianceUsd,
        varianceLbp: varianceCheck.varianceLbp,
        closedBy: cashierName,
        approvedBy: managerName || null,
        managerPinVerified: Boolean(managerName),
        blindClosed: branchSettings.blind_cash_close_enabled,
        closingNotes: (varianceCheck.varianceUsd !== 0 || varianceCheck.varianceLbp !== 0) ? fullNotes : null,
        tenderSummary: reconData?.tenders || {},
        kpiSummary: {
          ordersCount: reconData?.ordersCount || 0,
          grossSales: reconData?.grossSales || 0,
          totalDiscounts: reconData?.totalDiscounts || 0,
          totalRefunds: reconData?.totalRefunds || 0,
          netSales: reconData?.netSales || 0,
          avgTicket: reconData?.avgTicket || 0,
          voidCount: reconData?.voidCount || 0,
          voidTotal: reconData?.voidTotal || 0,
          channels: reconData?.channels || {}
        }
      });

      if (!res.success || !res.shift) {
        setErrorMessage(res.error || 'Failed to close shift in database');
        setIsFinalizing(false);
        return;
      }

      // Automatically dispatch Shift Close Report print to LAN printer
      if (reconData) {
        const printPayload = generateShiftReportPrintPayload({
          shift: res.shift,
          reconciliation: reconData,
          isXReport: false,
          actualUsd: numericActualUsd,
          actualLbp: numericActualLbp,
          varianceUsd: varianceCheck.varianceUsd,
          varianceLbp: varianceCheck.varianceLbp,
          managerName,
          notes: fullNotes
        });
        printShiftReport(printPayload).catch(() => {});
      }

      onShiftClosed(res.shift, reconData!);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error finalizing shift close');
      setIsFinalizing(false);
    }
  };

  const isBlind = branchSettings.blind_cash_close_enabled && !hasSubmittedCount;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-full max-w-xl shadow-2xl text-white flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#262D3D] flex items-center justify-between bg-[#151820]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-black text-xl">
              🔒
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-white">Close Shift Cash Session</h2>
              <p className="text-xs text-gray-400 font-mono">
                {branchName} • {terminalId} • Shift #{shift.shift} • Cashier: {shift.user_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Wizard Step Nav */}
        <div className="grid grid-cols-4 border-b border-[#262D3D] text-xs font-black text-center bg-[#1B202B]">
          <button
            onClick={() => setStep('REVIEW')}
            className={`py-2.5 transition ${step === 'REVIEW' ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-500/10' : 'text-gray-400'}`}
          >
            1. Review
          </button>
          <button
            onClick={() => setStep('COUNT')}
            className={`py-2.5 transition ${step === 'COUNT' ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-500/10' : 'text-gray-400'}`}
          >
            2. Count Cash
          </button>
          <button
            onClick={() => {
              if (actualUsd !== '' || actualLbp !== '') setHasSubmittedCount(true);
              setStep('RECONCILE');
            }}
            className={`py-2.5 transition ${step === 'RECONCILE' ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-500/10' : 'text-gray-400'}`}
          >
            3. Reconcile
          </button>
          <button
            onClick={() => setStep('AUTHORIZE')}
            className={`py-2.5 transition ${step === 'AUTHORIZE' ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-500/10' : 'text-gray-400'}`}
          >
            4. Authorize
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {errorMessage && (
            <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-300 text-xs font-bold">
              ⚠️ {errorMessage}
            </div>
          )}

          {loadingRecon && (
            <div className="text-center py-8 text-gray-400 text-sm">
              <span className="inline-block animate-spin mr-2">⏳</span>
              Calculating live shift reconciliation from commerce ledger...
            </div>
          )}

          {/* STEP 1: REVIEW */}
          {step === 'REVIEW' && reconData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-[#1F2430] p-3 rounded-xl border border-[#2D3548]">
                  <span className="text-[11px] text-gray-400 font-bold uppercase block">Orders</span>
                  <span className="text-lg font-black text-white">{reconData.ordersCount}</span>
                </div>
                <div className="bg-[#1F2430] p-3 rounded-xl border border-[#2D3548]">
                  <span className="text-[11px] text-gray-400 font-bold uppercase block">Gross Sales</span>
                  <span className="text-lg font-black text-white">${reconData.grossSales.toFixed(2)}</span>
                </div>
                <div className="bg-[#1F2430] p-3 rounded-xl border border-[#2D3548]">
                  <span className="text-[11px] text-gray-400 font-bold uppercase block">Discounts</span>
                  <span className="text-lg font-black text-rose-400">-${reconData.totalDiscounts.toFixed(2)}</span>
                </div>
                <div className="bg-[#1F2430] p-3 rounded-xl border border-[#2D3548]">
                  <span className="text-[11px] text-gray-400 font-bold uppercase block">Net Sales</span>
                  <span className="text-lg font-black text-emerald-400">${reconData.netSales.toFixed(2)}</span>
                </div>
              </div>

              {/* Tenders Summary */}
              <div className="bg-[#1F2430] p-4 rounded-xl border border-[#2D3548]">
                <h4 className="text-xs font-black text-gray-300 uppercase tracking-wider mb-3">Tender Breakdown</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#2D3548]/50">
                    <span className="text-gray-400">💵 Cash USD Sales:</span>
                    <span className="font-mono font-bold text-white">${reconData.tenders.cash_usd.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#2D3548]/50">
                    <span className="text-gray-400">💵 Cash LBP Sales:</span>
                    <span className="font-mono font-bold text-white">{reconData.tenders.cash_lbp.toLocaleString()} L.L.</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#2D3548]/50">
                    <span className="text-gray-400">📱 Whish Money:</span>
                    <span className="font-mono font-bold text-white">${reconData.tenders.whish_usd.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#2D3548]/50">
                    <span className="text-gray-400">💳 Card / POS:</span>
                    <span className="font-mono font-bold text-white">${reconData.tenders.card_usd.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#2D3548]/50">
                    <span className="text-gray-400">🛵 Toters Delivery:</span>
                    <span className="font-mono font-bold text-white">${reconData.tenders.toters_usd.toFixed(2)} ({reconData.tenders.toters_orders} ord)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#2D3548]/50">
                    <span className="text-gray-400">📦 NokNok:</span>
                    <span className="font-mono font-bold text-white">${reconData.tenders.noknok_usd.toFixed(2)} ({reconData.tenders.noknok_orders} ord)</span>
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-gray-500 italic">
                  * Note: Aggregators (Toters/NokNok) and digital tenders are non-cash settlements and not included in drawer cash expectations.
                </div>
              </div>

              {/* Voids and Refunds */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[#1F2430] p-3 rounded-xl border border-[#2D3548] flex justify-between items-center">
                  <span className="text-gray-400">Total Voids:</span>
                  <span className="font-mono font-bold text-amber-400">{reconData.voidCount} items (${reconData.voidTotal.toFixed(2)})</span>
                </div>
                <div className="bg-[#1F2430] p-3 rounded-xl border border-[#2D3548] flex justify-between items-center">
                  <span className="text-gray-400">Refunds Paid:</span>
                  <span className="font-mono font-bold text-rose-400">-${reconData.totalRefunds.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: COUNT */}
          {step === 'COUNT' && (
            <div className="space-y-4">
              {isBlind && (
                <div className="p-3 bg-blue-950/50 border border-blue-500/40 rounded-xl text-blue-300 text-xs font-bold flex items-center gap-2">
                  <span>🔒</span>
                  <span>Blind Cash Count Active: Enter physical drawer cash first before reviewing expected ledger figures.</span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black text-gray-300 uppercase tracking-wider">Physical Drawer Cash Count</h4>
                {branchSettings.denomination_helper_enabled && (
                  <button
                    type="button"
                    onClick={() => setShowDenomHelper(!showDenomHelper)}
                    className="text-xs text-amber-400 hover:text-amber-300 font-bold underline"
                  >
                    {showDenomHelper ? '✕ Close Denominations' : '🧮 Denomination Helper'}
                  </button>
                )}
              </div>

              {/* Denomination Helper Accordion */}
              {showDenomHelper && (
                <div className="bg-[#1F2430] p-4 rounded-xl border border-amber-500/30 space-y-4">
                  <div>
                    <h5 className="text-xs font-black text-amber-400 mb-2">USD Denominations</h5>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
                      {['100', '50', '20', '10', '5', '1'].map((bill) => (
                        <div key={bill} className="bg-[#151820] p-2 rounded-lg border border-[#2D3548]">
                          <label className="block text-[10px] text-gray-400 font-bold">${bill} ×</label>
                          <input
                            type="number"
                            min="0"
                            value={usdDenoms[bill] || ''}
                            onChange={(e) => setUsdDenoms({ ...usdDenoms, [bill]: parseInt(e.target.value, 10) || 0 })}
                            className="w-full bg-transparent text-white font-mono font-bold outline-none text-sm"
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="text-right text-xs text-gray-300 font-mono mt-1">
                      USD Subtotal: <span className="font-bold text-white">${calcDenomUsd()}</span>
                    </div>
                  </div>

                  <div>
                    <h5 className="text-xs font-black text-amber-400 mb-2">LBP Denominations</h5>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
                      {['100000', '50000', '20000', '10000', '5000'].map((bill) => (
                        <div key={bill} className="bg-[#151820] p-2 rounded-lg border border-[#2D3548]">
                          <label className="block text-[10px] text-gray-400 font-bold">{(Number(bill)/1000)}k ×</label>
                          <input
                            type="number"
                            min="0"
                            value={lbpDenoms[bill] || ''}
                            onChange={(e) => setLbpDenoms({ ...lbpDenoms, [bill]: parseInt(e.target.value, 10) || 0 })}
                            className="w-full bg-transparent text-white font-mono font-bold outline-none text-sm"
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="text-right text-xs text-gray-300 font-mono mt-1">
                      LBP Subtotal: <span className="font-bold text-white">{calcDenomLbp().toLocaleString()} L.L.</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={applyDenomTotals}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl transition"
                  >
                    Apply Denomination Totals to Count
                  </button>
                </div>
              )}

              {/* Direct Count Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#1F2430] p-4 rounded-xl border border-[#2D3548]">
                  <label className="block text-xs font-bold text-gray-300 mb-2">Actual Cash USD ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-400 font-bold text-sm">$</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={actualUsd}
                      onChange={(e) => setActualUsd(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#151820] border border-[#2D3548] focus:border-amber-500 rounded-xl py-2.5 pl-8 pr-3 text-white font-mono font-extrabold text-base outline-none"
                    />
                  </div>
                  {!isBlind && (
                    <div className="mt-2 text-xs text-gray-400">
                      Expected USD: <span className="font-mono font-bold text-white">${expectedUsd.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="bg-[#1F2430] p-4 rounded-xl border border-[#2D3548]">
                  <label className="block text-xs font-bold text-gray-300 mb-2">Actual Cash LBP (L.L.)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-400 font-bold text-xs">L.L.</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={actualLbp}
                      onChange={(e) => setActualLbp(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#151820] border border-[#2D3548] focus:border-amber-500 rounded-xl py-2.5 pl-10 pr-3 text-white font-mono font-extrabold text-base outline-none"
                    />
                  </div>
                  {!isBlind && (
                    <div className="mt-2 text-xs text-gray-400">
                      Expected LBP: <span className="font-mono font-bold text-white">{expectedLbp.toLocaleString()} L.L.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: RECONCILE */}
          {step === 'RECONCILE' && (
            <div className="space-y-4">
              <h4 className="text-xs font-black text-gray-300 uppercase tracking-wider">Reconciliation & Variance Summary</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* USD Card */}
                <div className="bg-[#1F2430] p-4 rounded-xl border border-[#2D3548]">
                  <h5 className="text-xs font-extrabold text-white mb-3">USD Cash Reconciliation</h5>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-400">
                      <span>Opening Float:</span>
                      <span className="font-mono font-bold text-white">${Number(shift.opening_usd || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Cash Sales:</span>
                      <span className="font-mono font-bold text-white">+${(reconData?.tenders.cash_usd || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Cash Refunds:</span>
                      <span className="font-mono font-bold text-rose-400">-${(reconData?.totalRefunds || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-white font-bold pt-2 border-t border-[#2D3548]">
                      <span>Expected Cash:</span>
                      <span className="font-mono">${expectedUsd.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-white font-bold">
                      <span>Actual Count:</span>
                      <span className="font-mono text-amber-400">${numericActualUsd.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-black text-sm pt-2 border-t border-[#2D3548]">
                      <span>USD Variance:</span>
                      <span className={`font-mono ${varianceCheck.varianceUsd === 0 ? 'text-emerald-400' : varianceCheck.isUsdExceeded ? 'text-rose-400' : 'text-amber-400'}`}>
                        {varianceCheck.varianceUsd > 0 ? '+' : ''}${varianceCheck.varianceUsd.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  {varianceCheck.isUsdExceeded && (
                    <div className="mt-2 p-2 bg-rose-950/50 border border-rose-500/40 rounded text-[11px] font-bold text-rose-300">
                      ⚠️ Exceeds allowed variance of ±${branchSettings.allowed_usd_variance.toFixed(2)}
                    </div>
                  )}
                </div>

                {/* LBP Card */}
                <div className="bg-[#1F2430] p-4 rounded-xl border border-[#2D3548]">
                  <h5 className="text-xs font-extrabold text-white mb-3">LBP Cash Reconciliation</h5>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-400">
                      <span>Opening Float:</span>
                      <span className="font-mono font-bold text-white">{Number(shift.opening_lbp || 0).toLocaleString()} L.L.</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Cash Sales:</span>
                      <span className="font-mono font-bold text-white">+{(reconData?.tenders.cash_lbp || 0).toLocaleString()} L.L.</span>
                    </div>
                    <div className="flex justify-between text-white font-bold pt-2 border-t border-[#2D3548]">
                      <span>Expected Cash:</span>
                      <span className="font-mono">{expectedLbp.toLocaleString()} L.L.</span>
                    </div>
                    <div className="flex justify-between text-white font-bold">
                      <span>Actual Count:</span>
                      <span className="font-mono text-amber-400">{numericActualLbp.toLocaleString()} L.L.</span>
                    </div>
                    <div className="flex justify-between font-black text-sm pt-2 border-t border-[#2D3548]">
                      <span>LBP Variance:</span>
                      <span className={`font-mono ${varianceCheck.varianceLbp === 0 ? 'text-emerald-400' : varianceCheck.isLbpExceeded ? 'text-rose-400' : 'text-amber-400'}`}>
                        {varianceCheck.varianceLbp > 0 ? '+' : ''}{varianceCheck.varianceLbp.toLocaleString()} L.L.
                      </span>
                    </div>
                  </div>
                  {varianceCheck.isLbpExceeded && (
                    <div className="mt-2 p-2 bg-rose-950/50 border border-rose-500/40 rounded text-[11px] font-bold text-rose-300">
                      ⚠️ Exceeds allowed variance of ±{branchSettings.allowed_lbp_variance.toLocaleString()} L.L.
                    </div>
                  )}
                </div>
              </div>

              {/* Variance reason / notes */}
              {(varianceCheck.varianceUsd !== 0 || varianceCheck.varianceLbp !== 0) && (
                <div className="bg-[#1F2430] p-4 rounded-xl border border-[#2D3548] space-y-3">
                  <label className="block text-xs font-bold text-gray-300">Variance Explanation / Closing Notes</label>
                  <select
                    value={varianceReason}
                    onChange={(e) => setVarianceReason(e.target.value)}
                    className="w-full bg-[#151820] border border-[#2D3548] rounded-xl py-2 px-3 text-xs text-white outline-none"
                  >
                    <option value="Customer change issue">Customer change issue</option>
                    <option value="Cash drop">Cash drop recorded</option>
                    <option value="Incorrect opening float">Incorrect opening float</option>
                    <option value="Counting difference">Counting difference</option>
                    <option value="Other">Other</option>
                  </select>
                  <textarea
                    rows={2}
                    value={varianceNotes}
                    onChange={(e) => setVarianceNotes(e.target.value)}
                    placeholder="Additional explanatory comments (optional)..."
                    className="w-full bg-[#151820] border border-[#2D3548] rounded-xl p-2.5 text-xs text-white outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 4: AUTHORIZE */}
          {step === 'AUTHORIZE' && (
            <div className="space-y-4">
              {!varianceCheck.requiresManagerApproval ? (
                <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-center space-y-2">
                  <div className="text-3xl">✓</div>
                  <h4 className="text-sm font-black text-emerald-300">Variance Within Allowed Tolerance</h4>
                  <p className="text-xs text-gray-400">
                    Your counted cash matches within branch tolerance limits (±${branchSettings.allowed_usd_variance} / ±{branchSettings.allowed_lbp_variance.toLocaleString()} L.L.).
                    You can finalize and close your shift now.
                  </p>
                </div>
              ) : (
                <div className="bg-[#1F2430] p-5 rounded-xl border border-rose-500/50 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xl">
                      🛡️
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-rose-300">Manager Authorization Required</h4>
                      <p className="text-xs text-gray-400">
                        Cash variance exceeds allowed threshold. A Manager or Admin must enter their PIN to authorize closing.
                      </p>
                    </div>
                  </div>

                  {managerName ? (
                    <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex justify-between items-center">
                      <span>✓ Authorized by Manager: {managerName}</span>
                      <button
                        type="button"
                        onClick={() => { setManagerName(''); setManagerPin(''); }}
                        className="text-xs text-gray-400 hover:text-white underline"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pinError && (
                        <div className="p-2.5 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-300 text-xs font-bold">
                          ⚠️ {pinError}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="password"
                          maxLength={6}
                          value={managerPin}
                          onChange={(e) => setManagerPin(e.target.value)}
                          placeholder="Enter Manager PIN"
                          className="flex-1 bg-[#151820] border border-[#2D3548] focus:border-rose-500 rounded-xl py-2 px-3 text-white text-center font-mono font-extrabold tracking-widest text-base outline-none"
                        />
                        <button
                          type="button"
                          disabled={isVerifyingPin}
                          onClick={handleVerifyManager}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl transition"
                        >
                          {isVerifyingPin ? 'Checking...' : 'Authorize'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-[#262D3D] flex justify-between items-center bg-[#151820]">
          <button
            type="button"
            onClick={() => {
              if (step === 'REVIEW') onClose();
              else if (step === 'COUNT') setStep('REVIEW');
              else if (step === 'RECONCILE') setStep('COUNT');
              else if (step === 'AUTHORIZE') setStep('RECONCILE');
            }}
            className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs rounded-xl transition"
          >
            {step === 'REVIEW' ? 'Cancel' : '← Back'}
          </button>

          <div className="flex gap-2">
            {step !== 'AUTHORIZE' ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 'REVIEW') setStep('COUNT');
                  else if (step === 'COUNT') {
                    setHasSubmittedCount(true);
                    setStep('RECONCILE');
                  }
                  else if (step === 'RECONCILE') setStep('AUTHORIZE');
                }}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl transition shadow-lg shadow-amber-600/30"
              >
                {step === 'COUNT' ? 'Submit Count & Reconcile →' : 'Next →'}
              </button>
            ) : (
              <button
                type="button"
                disabled={isFinalizing || (varianceCheck.requiresManagerApproval && !managerName)}
                onClick={handleFinalizeClose}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl transition shadow-lg shadow-emerald-600/30 flex items-center gap-2"
              >
                <span>{isFinalizing ? 'Finalizing & Printing...' : 'Finalize & Close Shift'}</span>
                <span>🔒</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
