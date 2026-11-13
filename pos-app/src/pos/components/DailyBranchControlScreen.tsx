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
  const [hasLiveData, setHasLiveData] = useState(false);

  const loadDailyData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDailyBranchControlSummary(branchIdentifier, selectedDate);
      if (res.success) {
        setSummaryData(res.summary);
        setShifts(res.shifts);
        setHasLiveData((res as any).hasLiveData === true);
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl text-slate-900 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-[#1e5c4f] flex items-center justify-center font-bold text-xl">
              🏪
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-slate-900">Daily Branch Control Dashboard</h2>
              <p className="text-xs text-slate-500 font-medium">Branch: {branchName} • Shift Reconciliation Overview</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              inputMode="none"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-1.5 outline-hidden focus:border-[#1e5c4f] focus:ring-1 focus:ring-[#1e5c4f]"
            />
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1 text-xl font-bold transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-white">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold">
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              <span className="inline-block animate-spin mr-2">⏳</span> Loading daily branch store control metrics...
            </div>
          ) : summaryData ? (
            <>
              {/* Live data notice */}
              {hasLiveData && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                  LIVE — shift still open · figures update each time you refresh · will finalize at shift close
                </div>
              )}
              {/* Daily KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Total Net Sales</span>
                  <span className="text-xl font-black text-emerald-700">${summaryData.totalSalesUsd.toFixed(2)}</span>
                  <span className="text-[10px] text-slate-500 font-medium block mt-1">{summaryData.totalOrders} Orders (Avg ${summaryData.avgTicket.toFixed(2)})</span>
                </div>
                <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Discounts & Refunds</span>
                  <span className="text-xl font-black text-rose-600">-${(summaryData.totalDiscounts + summaryData.totalRefunds).toFixed(2)}</span>
                  <span className="text-[10px] text-slate-500 font-medium block mt-1">Discounts: ${summaryData.totalDiscounts.toFixed(2)}</span>
                </div>
                <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">USD Cash Variance</span>
                  <span className={`text-xl font-black ${summaryData.totalVarianceUsd === 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {summaryData.totalVarianceUsd > 0 ? '+' : ''}${summaryData.totalVarianceUsd.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium block mt-1">Actual: ${summaryData.totalActualUsd.toFixed(2)} / Exp: ${summaryData.totalExpectedUsd.toFixed(2)}</span>
                </div>
                <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">LBP Cash Variance</span>
                  <span className={`text-xl font-black ${summaryData.totalVarianceLbp === 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {summaryData.totalVarianceLbp > 0 ? '+' : ''}{summaryData.totalVarianceLbp.toLocaleString()} L.L.
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium block mt-1">Actual: {summaryData.totalActualLbp.toLocaleString()} L.L.</span>
                </div>
              </div>

              {/* Tender Breakdown */}
              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">Daily Tenders Aggregated</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-slate-500 block text-[10px] font-semibold uppercase">Cash USD</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">${summaryData.tenderTotals.cash_usd.toFixed(2)}</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-slate-500 block text-[10px] font-semibold uppercase">Cash LBP</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">{summaryData.tenderTotals.cash_lbp.toLocaleString()} L.L.</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-slate-500 block text-[10px] font-semibold uppercase">Whish</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">${summaryData.tenderTotals.whish_usd.toFixed(2)}</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-slate-500 block text-[10px] font-semibold uppercase">Card</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">${summaryData.tenderTotals.card_usd.toFixed(2)}</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-slate-500 block text-[10px] font-semibold uppercase">Toters</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">${summaryData.tenderTotals.toters_usd.toFixed(2)}</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-slate-500 block text-[10px] font-semibold uppercase">NokNok</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">${summaryData.tenderTotals.noknok_usd.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Shifts Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Shifts Log ({shifts.length})</h4>
                  <button
                    type="button"
                    onClick={loadDailyData}
                    className="text-xs text-[#1e5c4f] hover:text-[#16473D] font-bold flex items-center gap-1 transition-colors"
                  >
                    ↻ Refresh
                  </button>
                </div>
                {shifts.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">No shifts recorded for {selectedDate}.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold border-b border-slate-200">
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
                      <tbody className="divide-y divide-slate-100">
                        {shifts.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 font-bold text-slate-900">{s.shift}</td>
                            <td className="p-3 text-slate-700 font-medium">{s.user_name}</td>
                            <td className="p-3 text-slate-500">{s.terminal_id || 'TERM-1'}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${s.status === 'open' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="p-3 text-slate-500">{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="p-3 text-slate-500">{s.closed_at ? new Date(s.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                            <td className={`p-3 text-right font-bold ${Number(s.variance_usd || s.difference_usd || 0) === 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {Number(s.variance_usd || s.difference_usd || 0) > 0 ? '+' : ''}${Number(s.variance_usd || s.difference_usd || 0).toFixed(2)}
                            </td>
                            <td className={`p-3 text-right font-bold ${Number(s.variance_lbp || 0) === 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {Number(s.variance_lbp || 0) > 0 ? '+' : ''}{Number(s.variance_lbp || 0).toLocaleString()}
                            </td>
                            <td className="p-3 text-center">
                              {onSelectShiftReport && (
                                <button
                                  type="button"
                                  onClick={() => onSelectShiftReport(s)}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-[#1e5c4f] text-[#1e5c4f] hover:text-white border border-emerald-200 hover:border-[#1e5c4f] rounded-lg text-[10px] font-bold transition-colors shadow-2xs"
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
