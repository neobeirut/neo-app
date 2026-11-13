import React, { useState, useEffect } from 'react';
import type { KdsStation } from './types';
import { kdsAudio } from './kdsAudio';
import { loadProductRoutingCoverage, updateProductRouting } from './kdsService';

interface KdsSettingsModalProps {
  branchId?: string;
  activeStation: KdsStation | null;
  stations?: KdsStation[];
  onClose: () => void;
}

export const KdsSettingsModal: React.FC<KdsSettingsModalProps> = ({
  branchId,
  activeStation,
  stations = [],
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'station' | 'routing'>('station');
  const [isMuted, setIsMuted] = useState(kdsAudio.getMuted());

  // Routing diagnostic state
  const [loadingCoverage, setLoadingCoverage] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'routed' | 'unrouted' | 'no_kitchen'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [coverageData, setCoverageData] = useState<{
    totalProducts: number;
    routedCount: number;
    unroutedCount: number;
    noKitchenCount: number;
    products: any[];
  }>({
    totalProducts: 0,
    routedCount: 0,
    unroutedCount: 0,
    noKitchenCount: 0,
    products: []
  });
  const [savingLinkId, setSavingLinkId] = useState<string | null>(null);

  const handleToggleMute = () => {
    const next = !isMuted;
    kdsAudio.setMuted(next);
    setIsMuted(next);
  };

  const fetchCoverage = async () => {
    if (!branchId) return;
    setLoadingCoverage(true);
    const data = await loadProductRoutingCoverage(branchId);
    setCoverageData(data);
    setLoadingCoverage(false);
  };

  useEffect(() => {
    if (activeTab === 'routing' && branchId) {
      fetchCoverage();
    }
  }, [activeTab, branchId]);

  const handleUpdateProductStation = async (product: any, newStationId: string) => {
    if (!branchId) return;
    setSavingLinkId(product.linkId);
    await updateProductRouting({
      branchId,
      commerceProductLinkId: product.linkId,
      stationId: newStationId,
      disposition: 'production'
    });
    await fetchCoverage();
    setSavingLinkId(null);
  };

  const handleToggleDisposition = async (product: any) => {
    if (!branchId) return;
    setSavingLinkId(product.linkId);
    const nextDisposition = product.disposition === 'no_kitchen' ? 'production' : 'no_kitchen';
    await updateProductRouting({
      branchId,
      commerceProductLinkId: product.linkId,
      stationId: nextDisposition === 'no_kitchen' ? null : (stations[0]?.id || null),
      disposition: nextDisposition
    });
    await fetchCoverage();
    setSavingLinkId(null);
  };

  const filteredProducts = coverageData.products.filter(p => {
    const matchesSearch = p.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.categoryName.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filterMode === 'routed') return p.isRouted;
    if (filterMode === 'unrouted') return !p.isRouted;
    if (filterMode === 'no_kitchen') return p.disposition === 'no_kitchen';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className={`bg-white border border-slate-200 rounded-2xl flex flex-col shadow-2xl transition-all ${
        activeTab === 'routing' ? 'max-w-4xl w-full max-h-[90vh]' : 'max-w-md w-full'
      }`}>
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-black text-slate-900">KDS Manager Settings</h2>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setActiveTab('station')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'station'
                    ? 'bg-[#1e5c4f] text-white font-bold shadow-xs'
                    : 'bg-white border border-slate-300 text-slate-700 hover:text-slate-950 hover:bg-slate-100'
                }`}
              >
                Station & Sound
              </button>
              <button
                onClick={() => setActiveTab('routing')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'routing'
                    ? 'bg-[#1e5c4f] text-white font-bold shadow-xs'
                    : 'bg-white border border-slate-300 text-slate-700 hover:text-slate-950 hover:bg-slate-100'
                }`}
              >
                <span>Product Routing Diagnostic</span>
                {coverageData.unroutedCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-rose-600 text-white rounded text-[10px] font-bold">
                    {coverageData.unroutedCount}
                  </span>
                )}
              </button>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-2 rounded-lg cursor-pointer transition-colors">
            ✕
          </button>
        </div>

        {/* Tab 1: Station & Sound */}
        {activeTab === 'station' && (
          <div className="p-6 space-y-4 bg-white">
            {/* Audio Chimes */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900 text-sm">Audio Chimes</div>
                <div className="text-xs text-slate-500 font-medium">Play bells for new fires and late tickets</div>
              </div>
              <button
                onClick={handleToggleMute}
                className={`px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  isMuted
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                {isMuted ? 'MUTED' : 'ENABLED'}
              </button>
            </div>

            {/* Test Sound */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => kdsAudio.playNewFireChime()}
                className="flex-1 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 border border-slate-300 cursor-pointer transition-colors"
              >
                🔔 Test New Fire Chime
              </button>
              <button
                onClick={() => kdsAudio.playLateAlertChime()}
                className="flex-1 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 border border-slate-300 cursor-pointer transition-colors"
              >
                ⚠️ Test Late Ticket Chime
              </button>
            </div>

            {/* Station Info */}
            {activeStation && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 text-slate-700">
                <div className="text-slate-500 uppercase font-black tracking-wider text-[10px] mb-1">
                  Active Station Info
                </div>
                <div><span className="text-slate-400">Name:</span> <span className="font-bold text-slate-900">{activeStation.name}</span></div>
                <div><span className="text-slate-400">Code:</span> <span className="font-mono text-slate-800">{activeStation.code}</span></div>
                <div><span className="text-slate-400">Type:</span> <span className="font-semibold text-slate-800">{activeStation.station_type}</span></div>
                <div><span className="text-slate-400">Warning SLA:</span> <span className="font-semibold text-slate-800">{Math.round(activeStation.default_timer_yellow_seconds / 60)} min</span></div>
                <div><span className="text-slate-400">Critical SLA:</span> <span className="font-semibold text-slate-800">{Math.round(activeStation.default_timer_red_seconds / 60)} min</span></div>
                <div><span className="text-slate-400">Printer Destination:</span> <span className="font-mono text-slate-800">{activeStation.printer_destination_key || 'kitchen-printer'}</span></div>
                <div><span className="text-slate-400">LAN Host:</span> <span className="font-mono text-slate-800">{activeStation.default_printer_ip || '192.168.18.10'}</span></div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Product Routing Diagnostic */}
        {activeTab === 'routing' && (
          <div className="p-6 flex-1 flex flex-col overflow-hidden space-y-4 bg-white">
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-xs text-slate-500 font-bold uppercase">Total Products</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{coverageData.totalProducts}</div>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="text-xs text-emerald-800 font-bold uppercase">Routed</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">{coverageData.routedCount}</div>
              </div>
              <div className={`p-3 rounded-xl border ${
                coverageData.unroutedCount > 0
                  ? 'bg-rose-50 border-rose-300 text-rose-800 animate-pulse'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                <div className="text-xs font-bold uppercase">Unrouted</div>
                <div className="text-2xl font-black mt-1">{coverageData.unroutedCount}</div>
              </div>
              <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl">
                <div className="text-xs text-cyan-800 font-bold uppercase">No Kitchen</div>
                <div className="text-2xl font-black text-cyan-700 mt-1">{coverageData.noKitchenCount}</div>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                {(['all', 'routed', 'unrouted', 'no_kitchen'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setFilterMode(mode)}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      filterMode === mode
                        ? 'bg-[#1e5c4f] text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    {mode === 'all' ? 'All' : mode === 'routed' ? 'Routed' : mode === 'unrouted' ? 'Unrouted' : 'No Kitchen'}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 outline-hidden focus:border-[#1e5c4f] w-48"
              />
            </div>

            {/* Product Routing Table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl max-h-[360px]">
              {loadingCoverage ? (
                <div className="p-12 text-center text-slate-500">Loading product coverage diagnostics...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-12 text-center text-slate-500">No products match current filter.</div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-black tracking-wider text-[10px] sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Assigned Station</th>
                      <th className="p-3">Disposition</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredProducts.map((p) => {
                      const isSaving = savingLinkId === p.linkId;
                      return (
                        <tr key={p.linkId} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-900">
                            {p.productName}
                          </td>
                          <td className="p-3 text-slate-500">
                            {p.categoryName}
                          </td>
                          <td className="p-3">
                            {p.disposition === 'no_kitchen' ? (
                              <span className="text-slate-400 italic">No Station Required</span>
                            ) : (
                              <select
                                value={p.stationId || ''}
                                disabled={isSaving}
                                onChange={(e) => handleUpdateProductStation(p, e.target.value)}
                                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 text-xs outline-hidden focus:border-[#1e5c4f]"
                              >
                                <option value="" disabled>-- Select Station --</option>
                                {stations.filter(s => s.station_type !== 'expo').map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} ({s.code})
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => handleToggleDisposition(p)}
                              disabled={isSaving}
                              className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer ${
                                p.disposition === 'no_kitchen'
                                  ? 'bg-cyan-50 text-cyan-800 border-cyan-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:border-[#1e5c4f]'
                              }`}
                            >
                              {p.disposition === 'no_kitchen' ? '🚫 No Kitchen' : '🍳 Production'}
                            </button>
                          </td>
                          <td className="p-3 text-right">
                            {p.isRouted ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                                ✓ Routed
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-bold">
                                ⚠️ Unrouted
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-end bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] text-white font-bold text-sm transition-all shadow-sm cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
