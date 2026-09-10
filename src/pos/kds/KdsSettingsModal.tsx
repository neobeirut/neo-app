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
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className={`bg-gray-900 border border-gray-700 rounded-2xl flex flex-col shadow-2xl transition-all ${
        activeTab === 'routing' ? 'max-w-4xl w-full max-h-[90vh]' : 'max-w-md w-full'
      }`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white">KDS Manager Settings</h2>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => setActiveTab('station')}
                className={`text-xs font-bold px-3 py-1 rounded-lg transition-all ${
                  activeTab === 'station'
                    ? 'bg-amber-500 text-gray-950 font-black'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Station & Sound
              </button>
              <button
                onClick={() => setActiveTab('routing')}
                className={`text-xs font-bold px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'routing'
                    ? 'bg-amber-500 text-gray-950 font-black'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                <span>Product Routing Diagnostic</span>
                {coverageData.unroutedCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-rose-600 text-white rounded text-[10px]">
                    {coverageData.unroutedCount}
                  </span>
                )}
              </button>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 rounded-lg">
            ✕
          </button>
        </div>

        {/* Tab 1: Station & Sound */}
        {activeTab === 'station' && (
          <div className="p-6 space-y-4">
            {/* Audio Chimes */}
            <div className="p-4 rounded-xl bg-gray-850 border border-gray-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-white text-sm">Audio Chimes</div>
                <div className="text-xs text-gray-400">Play bells for new fires and late tickets</div>
              </div>
              <button
                onClick={handleToggleMute}
                className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${
                  isMuted
                    ? 'bg-rose-950/60 text-rose-300 border border-rose-800'
                    : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                }`}
              >
                {isMuted ? 'MUTED' : 'ENABLED'}
              </button>
            </div>

            {/* Test Sound */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => kdsAudio.playNewFireChime()}
                className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-300 border border-gray-700"
              >
                🔔 Test New Fire Chime
              </button>
              <button
                onClick={() => kdsAudio.playLateAlertChime()}
                className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-300 border border-gray-700"
              >
                ⚠️ Test Late Ticket Chime
              </button>
            </div>

            {/* Station Info */}
            {activeStation && (
              <div className="p-4 rounded-xl bg-gray-850 border border-gray-800 text-xs space-y-1.5 text-gray-300">
                <div className="text-gray-400 uppercase font-black tracking-wider text-[10px] mb-1">
                  Active Station Info
                </div>
                <div><span className="text-gray-500">Name:</span> {activeStation.name}</div>
                <div><span className="text-gray-500">Code:</span> {activeStation.code}</div>
                <div><span className="text-gray-500">Type:</span> {activeStation.station_type}</div>
                <div><span className="text-gray-500">Warning SLA:</span> {Math.round(activeStation.default_timer_yellow_seconds / 60)} min</div>
                <div><span className="text-gray-500">Critical SLA:</span> {Math.round(activeStation.default_timer_red_seconds / 60)} min</div>
                <div><span className="text-gray-500">Printer Destination:</span> {activeStation.printer_destination_key || 'kitchen-printer'}</div>
                <div><span className="text-gray-500">LAN Host:</span> {activeStation.default_printer_ip || '192.168.18.10'}</div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Product Routing Diagnostic */}
        {activeTab === 'routing' && (
          <div className="p-6 flex-1 flex flex-col overflow-hidden space-y-4">
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
              <div className="p-3 bg-gray-850 border border-gray-800 rounded-xl">
                <div className="text-xs text-gray-400 font-bold uppercase">Total Products</div>
                <div className="text-2xl font-black text-white mt-1">{coverageData.totalProducts}</div>
              </div>
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl">
                <div className="text-xs text-emerald-400 font-bold uppercase">Routed</div>
                <div className="text-2xl font-black text-emerald-400 mt-1">{coverageData.routedCount}</div>
              </div>
              <div className={`p-3 rounded-xl border ${
                coverageData.unroutedCount > 0
                  ? 'bg-rose-950/50 border-rose-800 text-rose-300 animate-pulse'
                  : 'bg-gray-850 border-gray-800 text-gray-400'
              }`}>
                <div className="text-xs font-bold uppercase">Unrouted</div>
                <div className="text-2xl font-black mt-1">{coverageData.unroutedCount}</div>
              </div>
              <div className="p-3 bg-cyan-950/40 border border-cyan-800/60 rounded-xl">
                <div className="text-xs text-cyan-400 font-bold uppercase">No Kitchen</div>
                <div className="text-2xl font-black text-cyan-400 mt-1">{coverageData.noKitchenCount}</div>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
              <div className="flex items-center gap-1 bg-gray-800 p-1 rounded-lg">
                {(['all', 'routed', 'unrouted', 'no_kitchen'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setFilterMode(mode)}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                      filterMode === mode
                        ? 'bg-amber-500 text-gray-950'
                        : 'text-gray-400 hover:text-white'
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
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500 w-48"
              />
            </div>

            {/* Product Routing Table */}
            <div className="flex-1 overflow-y-auto border border-gray-800 rounded-xl max-h-[360px]">
              {loadingCoverage ? (
                <div className="p-12 text-center text-gray-500">Loading product coverage diagnostics...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-12 text-center text-gray-500">No products match current filter.</div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-850 text-gray-400 uppercase font-black tracking-wider text-[10px] sticky top-0">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Assigned Station</th>
                      <th className="p-3">Disposition</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredProducts.map((p) => {
                      const isSaving = savingLinkId === p.linkId;
                      return (
                        <tr key={p.linkId} className="hover:bg-gray-850/50">
                          <td className="p-3 font-bold text-white">
                            {p.productName}
                          </td>
                          <td className="p-3 text-gray-400">
                            {p.categoryName}
                          </td>
                          <td className="p-3">
                            {p.disposition === 'no_kitchen' ? (
                              <span className="text-gray-500 italic">No Station Required</span>
                            ) : (
                              <select
                                value={p.stationId || ''}
                                disabled={isSaving}
                                onChange={(e) => handleUpdateProductStation(p, e.target.value)}
                                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs outline-none focus:border-amber-500"
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
                              className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-all ${
                                p.disposition === 'no_kitchen'
                                  ? 'bg-cyan-950/60 text-cyan-300 border-cyan-700'
                                  : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-amber-500'
                              }`}
                            >
                              {p.disposition === 'no_kitchen' ? '🚫 No Kitchen' : '🍳 Production'}
                            </button>
                          </td>
                          <td className="p-3 text-right">
                            {p.isRouted ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800 font-bold">
                                ✓ Routed
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-800 font-bold">
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
        <div className="p-4 border-t border-gray-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
