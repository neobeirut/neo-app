import React, { useState } from 'react';
import type { ShiftCashRecord } from '../services/shiftCashBridge';
import type { ShiftReconciliationSummary } from '../services/shiftReconciliationService';
import { generateShiftReportPrintPayload, printShiftReport } from '../services/shiftReconciliationService';

interface ShiftReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: ShiftCashRecord | null;
  reconciliation: ShiftReconciliationSummary | null;
  isXReport?: boolean;
}

export const ShiftReportModal: React.FC<ShiftReportModalProps> = ({
  isOpen,
  onClose,
  shift,
  reconciliation,
  isXReport = false
}) => {
  if (!isOpen || !shift || !reconciliation) return null;

  const [isPrinting, setIsPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState<string | null>(null);

  const reportTitle = isXReport ? 'X REPORT (MID-SHIFT SNAPSHOT)' : 'SHIFT CLOSE REPORT';

  const handlePrint = async () => {
    setIsPrinting(true);
    setPrintStatus(null);
    try {
      const payload = generateShiftReportPrintPayload({
        shift,
        reconciliation,
        isXReport
      });
      const res = await printShiftReport(payload);
      if (res.success) {
        setPrintStatus('✓ Printed to LAN Thermal Printer (192.168.18.195:9191)');
      } else {
        setPrintStatus(`⚠️ Print failed: ${res.error}`);
      }
    } catch (err: any) {
      setPrintStatus(`⚠️ Print error: ${err.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl text-slate-900 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-[#1e5c4f] border border-emerald-200 flex items-center justify-center font-bold text-base shadow-xs">
              📄
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">{reportTitle}</h3>
              <p className="text-xs text-slate-500 font-mono font-medium">{shift.branch} • {shift.user_name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 flex items-center justify-center font-bold text-sm transition cursor-pointer shadow-xs"
          >
            ✕
          </button>
        </div>

        {/* Body - Receipt simulation */}
        <div className="p-6 overflow-y-auto space-y-4 font-mono text-xs">
          {printStatus && (
            <div className={`p-3 rounded-2xl border text-xs font-bold shadow-xs ${printStatus.includes('✓') ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              {printStatus}
            </div>
          )}

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="text-center border-b border-slate-200 pb-3">
              <h2 className="font-black text-sm text-slate-900 uppercase tracking-wider">FLOW POS — {reportTitle}</h2>
              <p className="text-[11px] text-slate-600 mt-1">{shift.branch} • Terminal: {shift.terminal_id || 'TERM-1'}</p>
              <p className="text-[11px] text-slate-600">Cashier: {shift.user_name}</p>
              <p className="text-[10px] text-slate-500 mt-1">
                Opened: {new Date(shift.created_at).toLocaleString()}
              </p>
              {shift.closed_at && (
                <p className="text-[10px] text-slate-500">
                  Closed: {new Date(shift.closed_at).toLocaleString()}
                </p>
              )}
            </div>

            {/* Financial Overview */}
            <div className="space-y-1 py-2 border-b border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-600">Gross Sales:</span>
                <span className="text-slate-900 font-bold">${reconciliation.grossSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Discounts ({reconciliation.discountedOrdersCount} ord):</span>
                <span className="text-rose-700 font-bold">-${reconciliation.totalDiscounts.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Refunds:</span>
                <span className="text-rose-700 font-bold">-${reconciliation.totalRefunds.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-[#1e5c4f] pt-1 border-t border-slate-200">
                <span>Net Sales:</span>
                <span>${reconciliation.netSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Total Orders:</span>
                <span className="text-slate-900 font-bold">{reconciliation.ordersCount} (Avg: ${reconciliation.avgTicket.toFixed(2)})</span>
              </div>
              {reconciliation.totalCovers > 0 && (
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>Total Covers (Dine-in):</span>
                  <span className="text-slate-900 font-bold">{reconciliation.totalCovers}</span>
                </div>
              )}
            </div>

            {/* Tenders Breakdown */}
            <div className="space-y-1 py-2 border-b border-slate-200">
              <span className="font-bold text-slate-800 uppercase tracking-wider block mb-1">Tenders Collected</span>
              <div className="flex justify-between">
                <span className="text-slate-600">Cash USD:</span>
                <span className="text-slate-900 font-bold">${reconciliation.tenders.cash_usd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Cash LBP:</span>
                <span className="text-slate-900 font-bold">{reconciliation.tenders.cash_lbp.toLocaleString()} L.L.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Whish:</span>
                <span className="text-slate-900 font-bold">${reconciliation.tenders.whish_usd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Card:</span>
                <span className="text-slate-900 font-bold">${reconciliation.tenders.card_usd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Toters (Aggregator):</span>
                <span className="text-slate-900 font-bold">${reconciliation.tenders.toters_usd.toFixed(2)} ({reconciliation.tenders.toters_orders} ord)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">NokNok (Aggregator):</span>
                <span className="text-slate-900 font-bold">${reconciliation.tenders.noknok_usd.toFixed(2)} ({reconciliation.tenders.noknok_orders} ord)</span>
              </div>
            </div>

            {/* Drawer Cash Reconciliation */}
            <div className="space-y-1 py-2 border-b border-slate-200">
              <span className="font-bold text-slate-800 uppercase tracking-wider block mb-1">Drawer Cash Balancing</span>
              <div className="flex justify-between">
                <span className="text-slate-600">Opening USD:</span>
                <span className="text-slate-900">${Number(shift.opening_usd || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Expected USD:</span>
                <span className="text-slate-900 font-bold">${reconciliation.expectedCashUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Actual USD:</span>
                <span className="text-slate-900 font-bold">${Number(shift.actual_usd || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-slate-700">USD Variance:</span>
                <span className={Number(shift.variance_usd || shift.difference_usd || 0) === 0 ? 'text-emerald-700' : 'text-rose-700'}>
                  {Number(shift.variance_usd || shift.difference_usd || 0) > 0 ? '+' : ''}${Number(shift.variance_usd || shift.difference_usd || 0).toFixed(2)}
                </span>
              </div>

              <div className="pt-2"></div>
              <div className="flex justify-between">
                <span className="text-slate-600">Opening LBP:</span>
                <span className="text-slate-900">{Number(shift.opening_lbp || 0).toLocaleString()} L.L.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Expected LBP:</span>
                <span className="text-slate-900 font-bold">{reconciliation.expectedCashLbp.toLocaleString()} L.L.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Actual LBP:</span>
                <span className="text-slate-900 font-bold">{Number(shift.actual_lbp || 0).toLocaleString()} L.L.</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-slate-700">LBP Variance:</span>
                <span className={Number(shift.variance_lbp || 0) === 0 ? 'text-emerald-700' : 'text-rose-700'}>
                  {Number(shift.variance_lbp || 0) > 0 ? '+' : ''}{Number(shift.variance_lbp || 0).toLocaleString()} L.L.
                </span>
              </div>
            </div>

            {/* Approvals and Notes */}
            {shift.approved_by && (
              <div className="text-[11px] text-emerald-800 font-medium">
                Manager Override Approved by: <span className="font-bold">{shift.approved_by}</span>
              </div>
            )}
            {shift.closing_notes && (
              <div className="text-[11px] text-slate-500 italic">
                Notes: {shift.closing_notes}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition cursor-pointer shadow-xs"
          >
            Close Window
          </button>
          <button
            type="button"
            disabled={isPrinting}
            onClick={handlePrint}
            className="px-5 py-2 bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-xs rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>🖨️</span>
            <span>{isPrinting ? 'Printing...' : 'Print Thermal Report'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
