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
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-full max-w-lg shadow-2xl text-white flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#262D3D] flex items-center justify-between bg-[#151820]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-base">
              📄
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">{reportTitle}</h3>
              <p className="text-xs text-gray-400 font-mono">{shift.branch} • {shift.user_name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Body - Receipt simulation */}
        <div className="p-6 overflow-y-auto space-y-4 font-mono text-xs">
          {printStatus && (
            <div className={`p-3 rounded-xl border text-xs font-bold ${printStatus.includes('✓') ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/60 border-rose-500/40 text-rose-300'}`}>
              {printStatus}
            </div>
          )}

          <div className="bg-[#12151C] p-4 rounded-xl border border-[#262D3D] space-y-3">
            <div className="text-center border-b border-[#262D3D] pb-3">
              <h2 className="font-black text-sm text-white uppercase tracking-wider">FLOW POS — {reportTitle}</h2>
              <p className="text-[11px] text-gray-400 mt-1">{shift.branch} • Terminal: {shift.terminal_id || 'TERM-1'}</p>
              <p className="text-[11px] text-gray-400">Cashier: {shift.user_name}</p>
              <p className="text-[10px] text-gray-500 mt-1">
                Opened: {new Date(shift.created_at).toLocaleString()}
              </p>
              {shift.closed_at && (
                <p className="text-[10px] text-gray-500">
                  Closed: {new Date(shift.closed_at).toLocaleString()}
                </p>
              )}
            </div>

            {/* Financial Overview */}
            <div className="space-y-1 py-2 border-b border-[#262D3D]">
              <div className="flex justify-between">
                <span className="text-gray-400">Gross Sales:</span>
                <span className="text-white font-bold">${reconciliation.grossSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Discounts ({reconciliation.discountedOrdersCount} ord):</span>
                <span className="text-rose-400 font-bold">-${reconciliation.totalDiscounts.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Refunds:</span>
                <span className="text-rose-400 font-bold">-${reconciliation.totalRefunds.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-emerald-400 pt-1 border-t border-[#262D3D]/50">
                <span>Net Sales:</span>
                <span>${reconciliation.netSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-gray-400">
                <span>Total Orders:</span>
                <span className="text-white">{reconciliation.ordersCount} (Avg: ${reconciliation.avgTicket.toFixed(2)})</span>
              </div>
              {reconciliation.totalCovers > 0 && (
                <div className="flex justify-between text-[11px] text-gray-400">
                  <span>Total Covers (Dine-in):</span>
                  <span className="text-white">{reconciliation.totalCovers}</span>
                </div>
              )}
            </div>

            {/* Tenders Breakdown */}
            <div className="space-y-1 py-2 border-b border-[#262D3D]">
              <span className="font-bold text-gray-300 uppercase tracking-wider block mb-1">Tenders Collected</span>
              <div className="flex justify-between">
                <span className="text-gray-400">Cash USD:</span>
                <span className="text-white font-bold">${reconciliation.tenders.cash_usd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Cash LBP:</span>
                <span className="text-white font-bold">{reconciliation.tenders.cash_lbp.toLocaleString()} L.L.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Whish:</span>
                <span className="text-white font-bold">${reconciliation.tenders.whish_usd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Card:</span>
                <span className="text-white font-bold">${reconciliation.tenders.card_usd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Toters (Aggregator):</span>
                <span className="text-white font-bold">${reconciliation.tenders.toters_usd.toFixed(2)} ({reconciliation.tenders.toters_orders} ord)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">NokNok (Aggregator):</span>
                <span className="text-white font-bold">${reconciliation.tenders.noknok_usd.toFixed(2)} ({reconciliation.tenders.noknok_orders} ord)</span>
              </div>
            </div>

            {/* Drawer Cash Reconciliation */}
            <div className="space-y-1 py-2 border-b border-[#262D3D]">
              <span className="font-bold text-gray-300 uppercase tracking-wider block mb-1">Drawer Cash Balancing</span>
              <div className="flex justify-between">
                <span className="text-gray-400">Opening USD:</span>
                <span className="text-white">${Number(shift.opening_usd || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Expected USD:</span>
                <span className="text-white font-bold">${reconciliation.expectedCashUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Actual USD:</span>
                <span className="text-amber-400 font-bold">${Number(shift.actual_usd || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-gray-300">USD Variance:</span>
                <span className={Number(shift.variance_usd || shift.difference_usd || 0) === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {Number(shift.variance_usd || shift.difference_usd || 0) > 0 ? '+' : ''}${Number(shift.variance_usd || shift.difference_usd || 0).toFixed(2)}
                </span>
              </div>

              <div className="pt-2"></div>
              <div className="flex justify-between">
                <span className="text-gray-400">Opening LBP:</span>
                <span className="text-white">{Number(shift.opening_lbp || 0).toLocaleString()} L.L.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Expected LBP:</span>
                <span className="text-white font-bold">{reconciliation.expectedCashLbp.toLocaleString()} L.L.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Actual LBP:</span>
                <span className="text-amber-400 font-bold">{Number(shift.actual_lbp || 0).toLocaleString()} L.L.</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-gray-300">LBP Variance:</span>
                <span className={Number(shift.variance_lbp || 0) === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {Number(shift.variance_lbp || 0) > 0 ? '+' : ''}{Number(shift.variance_lbp || 0).toLocaleString()} L.L.
                </span>
              </div>
            </div>

            {/* Approvals and Notes */}
            {shift.approved_by && (
              <div className="text-[11px] text-emerald-300">
                Manager Override Approved by: <span className="font-bold">{shift.approved_by}</span>
              </div>
            )}
            {shift.closing_notes && (
              <div className="text-[11px] text-gray-400 italic">
                Notes: {shift.closing_notes}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#262D3D] flex justify-between items-center bg-[#151820]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs rounded-xl transition"
          >
            Close Window
          </button>
          <button
            type="button"
            disabled={isPrinting}
            onClick={handlePrint}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition shadow-lg shadow-blue-600/30 flex items-center gap-2"
          >
            <span>🖨️</span>
            <span>{isPrinting ? 'Printing...' : 'Print Thermal Report'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
