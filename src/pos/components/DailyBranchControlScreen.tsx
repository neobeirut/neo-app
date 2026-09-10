import React, { useState, useEffect } from 'react';
import { getDailyBranchControlSummary } from '../services/shiftReconciliationService';
import type { ShiftCashRecord } from '../services/shiftCashBridge';

interface DailyBranchControlScreenProps {
  branchIdentifier: string;
  branchName: string;
  onClose: () => void;
  onSelectShiftReport?: (shift: ShiftCashRecord) => void;
}

export const DailyBranchControlScreen: React.FC<DailyBranchControlScreenProps> = ({
  branchIdentifier,
  branchName,
  onClose,
  onSelectShiftReport
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [shifts, setShifts] = useState<ShiftCashRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadDailyData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDailyBranchControlSummary(branchIdentifier, selectedDate);
      if (res.success) {
        setSummaryData(res.summary);
        setShifts(res.shifts);
      } else {
        setError(res.error || 'Failed to load daily branch control summary');
      }
    } catch (err: any) {
      setError(err?.message || 'Error fetching summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDailyData();
  }, [branchIdentifier, selectedDate]);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-full max-w-4xl shadow-2xl text-white flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#262D3D] flex items-center justify-between bg-[#151820]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center font-bold text-xl">
              🏪
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-white">Daily Branch Control Dashboard</h2>
              <p className="text-xs text-gray-400">Branch: {branchName} • Shift Reconciliation Overview</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-[#1F2430] border border-[#2D3548] text-white text-xs font-bold rounded-xl px-3 py-1.5 outline-none"
            />
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 text-xl font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-300 text-xs font-bold">
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              <span className="inline-block animate-spin mr-2">⏳</span> Loading daily branch store control metrics...
            </div>
          ) : summaryData ? (
            <>
              {/* Daily KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#1F2430] p-4 rounded-xl border border-[#2D3548]">
                  <span className="text-[11px] text-gray-400 font-bold uppercase block">Total Net Sales</span>
                  <span className="text-xl font-black text-emerald-400">${summaryData.totalSalesUsd.toFixed(2)}</span>
                  <span className="text-[10px] text-gray-500 block mt-1">{summaryData.totalOrders} Orders (Avg ${summaryData.avgTicket.toFixed(2)})</span>
                </div>
                <div className="bg-[#1F2430] p-4 rounded-xl border border-[#2D3548]">
                  <span className="text-[11px] text-gray-400 font-bold uppercase block">Discounts & Refunds</span>
                  <span className="text-xl font-black text-rose-400">-${(summaryData.totalDiscounts + summaryData.totalRefunds).toFixed(2)}</span>
                  <span className="text-[10px] text-gray-500 block mt-1">Discounts: ${summaryData.totalDiscounts.toFixed(2)}</span>
                </div>
                <div className="bg-[#1F2430] p-4 rounded-xl border border-[#2D3548]">
                  <span className="text-[11px] text-gray-400 font-bold uppercase block">USD Cash Variance</span>
                  <span className={`text-xl font-black ${summaryData.totalVarianceUsd === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {summaryData.totalVarianceUsd > 0 ? '+' : ''}${summaryData.totalVarianceUsd.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-1">Actual: ${summaryData.totalActualUsd.toFixed(2)} / Exp: ${summaryData.totalExpectedUsd.toFixed(2)}</span>
                </div>
                <div className="bg-[#1F2430] p-4 rounded-xl border border-[#2D3548]">
                  <span className="text-[11px] text-gray-400 font-bold uppercase block">LBP Cash Variance</span>
                  <span className={`text-xl font-black ${summaryData.totalVarianceLbp === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {summaryData.totalVarianceLbp > 0 ? '+' : ''}{summaryData.totalVarianceLbp.toLocaleString()} L.L.
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-1">Actual: {summaryData.totalActualLbp.toLocaleString()} L.L.</span>
                </div>
              </div>

              {/* Tender Breakdown */}
              <div className="bg-[#1F2430] p-4 rounded-xl border border-[#2D3548]">
                <h4 className="text-xs font-black text-gray-300 uppercase tracking-wider mb-3">Daily Tenders Aggregated</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                  <div className="bg-[#151820] p-3 rounded-lg border border-[#2D3548]">
                    <span className="text-gray-400 block text-[10px]">Cash USD</span>
                    <span className="font-mono font-bold text-white text-sm">${summaryData.tenderTotals.cash_usd.toFixed(2)}</span>
                  </div>
                  <div className="bg-[#151820] p-3 rounded-lg border border-[#2D3548]">
                    <span className="text-gray-400 block text-[10px]">Cash LBP</span>
                    <span className="font-mono font-bold text-white text-sm">{summaryData.tenderTotals.cash_lbp.toLocaleString()} L.L.</span>
                  </div>
                  <div className="bg-[#151820] p-3 rounded-lg border border-[#2D3548]">
                    <span className="text-gray-400 block text-[10px]">Whish</span>
                    <span className="font-mono font-bold text-white text-sm">${summaryData.tenderTotals.whish_usd.toFixed(2)}</span>
                  </div>
                  <div className="bg-[#151820] p-3 rounded-lg border border-[#2D3548]">
                    <span className="text-gray-400 block text-[10px]">Card</span>
                    <span className="font-mono font-bold text-white text-sm">${summaryData.tenderTotals.card_usd.toFixed(2)}</span>
                  </div>
                  <div className="bg-[#151820] p-3 rounded-lg border border-[#2D3548]">
                    <span className="text-gray-400 block text-[10px]">Toters</span>
                    <span className="font-mono font-bold text-white text-sm">${summaryData.tenderTotals.toters_usd.toFixed(2)}</span>
                  </div>
                  <div className="bg-[#151820] p-3 rounded-lg border border-[#2D3548]">
                    <span className="text-gray-400 block text-[10px]">NokNok</span>
                    <span className="font-mono font-bold text-white text-sm">${summaryData.tenderTotals.noknok_usd.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Shifts Table */}
              <div className="bg-[#1F2430] rounded-xl border border-[#2D3548] overflow-hidden">
                <div className="p-3 border-b border-[#2D3548] flex justify-between items-center">
                  <h4 className="text-xs font-black text-gray-300 uppercase tracking-wider">Shifts Log ({shifts.length})</h4>
                  <button
                    type="button"
                    onClick={loadDailyData}
                    className="text-xs text-blue-400 hover:text-blue-300 font-bold"
                  >
                    ↻ Refresh
                  </button>
                </div>
                {shifts.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-xs">No shifts recorded for {selectedDate}.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[#151820] text-gray-400 text-[11px] uppercase">
                        <tr>
                          <th className="p-3">Shift</th>
                          <th className="p-3">Cashier</th>
                          <th className="p-3">Terminal</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Opened</th>
                          <th className="p-3">Closed</th>
                          <th className="p-3 text-right">USD Variance</th>
                          <th className="p-3 text-right">LBP Variance</th>
                          <th className="p-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2D3548]">
                        {shifts.map((s) => (
                          <tr key={s.id} className="hover:bg-[#282F40] transition">
                            <td className="p-3 font-bold text-white">{s.shift}</td>
                            <td className="p-3 text-gray-300">{s.user_name}</td>
                            <td className="p-3 text-gray-400">{s.terminal_id || 'TERM-1'}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${s.status === 'open' ? 'bg-amber-900/60 text-amber-300 border border-amber-500/30' : 'bg-gray-800 text-gray-400'}`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="p-3 text-gray-400">{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="p-3 text-gray-400">{s.closed_at ? new Date(s.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                            <td className={`p-3 text-right font-bold ${Number(s.variance_usd || s.difference_usd || 0) === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {Number(s.variance_usd || s.difference_usd || 0) > 0 ? '+' : ''}${Number(s.variance_usd || s.difference_usd || 0).toFixed(2)}
                            </td>
                            <td className={`p-3 text-right font-bold ${Number(s.variance_lbp || 0) === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {Number(s.variance_lbp || 0) > 0 ? '+' : ''}{Number(s.variance_lbp || 0).toLocaleString()}
                            </td>
                            <td className="p-3 text-center">
                              {onSelectShiftReport && (
                                <button
                                  type="button"
                                  onClick={() => onSelectShiftReport(s)}
                                  className="px-2 py-1 bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white rounded text-[10px] font-bold transition"
                                >
                                  Report
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
