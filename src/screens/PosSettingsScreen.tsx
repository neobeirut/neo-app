import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRestaurantId, api } from '../api/client';
import { supabase } from '../api/supabase';
import { 
  Settings, Printer, Store, Tag, Monitor, Save, CheckCircle, 
  RefreshCw, ArrowRight, ShieldCheck, Layers, AlertCircle
} from 'lucide-react';
import { DiscountManagerModal } from '../pos/components/DiscountManagerModal';

export default function PosSettingsScreen({ user }: { user?: any }) {
  const navigate = useNavigate();
  const currentRestaurantId = user?.restaurant_id || getRestaurantId() || '4c0ed960-e459-42c4-962f-41229a2d3783';
  const restaurantName = currentRestaurantId === '4c0ed960-e459-42c4-962f-41229a2d3783' ? 'The Bistro' : 'FLOW POS';

  // Printer Settings
  const [printServerIP, setPrintServerIP] = useState(() => {
    return localStorage.getItem('flow_pos_print_server_ip') || '192.168.18.195';
  });
  const [printServerPort, setPrintServerPort] = useState(() => {
    return Number(localStorage.getItem('flow_pos_print_server_port')) || 9191;
  });

  // Terminal Settings
  const [terminalId, setTerminalId] = useState(() => {
    return localStorage.getItem('flow_pos_terminal_id') || 'FLOW-TERM-01';
  });

  // Store Operational Status
  const [isStoreOpen, setIsStoreOpen] = useState(true);
  const [storeStatusLoading, setStoreStatusLoading] = useState(false);

  // Discount Manager State
  const [isDiscountManagerOpen, setIsDiscountManagerOpen] = useState(false);
  const [discountCount, setDiscountCount] = useState(0);

  // Notification state
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    // Load store status
    const loadStoreStatus = async () => {
      try {
        const { data } = await supabase
          .from('branches')
          .select('is_active')
          .eq('restaurant_id', currentRestaurantId)
          .limit(1);
        if (data && data.length > 0) {
          setIsStoreOpen(data[0].is_active !== false);
        }
      } catch (err) {
        console.warn('Could not fetch store status:', err);
      }
    };
    loadStoreStatus();

    // Load discount count
    const loadDiscounts = async () => {
      try {
        const { data } = await supabase
          .from('pos_discounts')
          .select('id')
          .eq('restaurant_id', currentRestaurantId);
        if (data) {
          setDiscountCount(data.length);
        }
      } catch (err) {
        console.warn('Could not fetch discounts count:', err);
      }
    };
    loadDiscounts();
  }, [currentRestaurantId]);

  const handleSaveSettings = () => {
    localStorage.setItem('flow_pos_print_server_ip', printServerIP.trim());
    localStorage.setItem('flow_pos_print_server_port', String(printServerPort));
    localStorage.setItem('flow_pos_terminal_id', terminalId.trim());

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleToggleStoreStatus = async () => {
    setStoreStatusLoading(true);
    try {
      const nextStatus = !isStoreOpen;
      const { error } = await supabase
        .from('branches')
        .update({ is_active: nextStatus })
        .eq('restaurant_id', currentRestaurantId);
      if (!error) {
        setIsStoreOpen(nextStatus);
      }
    } catch (err) {
      console.error('Error toggling store status:', err);
    } finally {
      setStoreStatusLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-white p-6 md:p-8 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#262D3D] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold text-2xl shadow-lg">
              ⚙️
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white !text-white" style={{ color: '#ffffff' }}>
                POS System Settings
              </h1>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">
                Hardware, Thermal Printing, Operational Store Status & Branch Discounts • {restaurantName}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/pos-screens')}
            className="px-4 py-2.5 bg-[#1F2430] hover:bg-[#283042] text-gray-200 hover:text-white font-extrabold text-xs rounded-xl border border-[#2D3548] flex items-center gap-2 transition"
          >
            <Layers size={16} className="text-blue-400" />
            <span>Screen Builder</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/pos')}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-950/50 flex items-center gap-2 transition"
          >
            <Monitor size={16} />
            <span>Open POS Register</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-500/50 rounded-2xl text-emerald-300 text-xs font-black flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle size={18} className="text-emerald-400" />
          <span>POS Settings successfully saved to terminal hardware storage!</span>
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Thermal Printer & Hardware */}
        <div className="bg-[#181C24] border border-[#262D3D] rounded-3xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center gap-3 border-b border-[#262D3D] pb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <Printer size={20} />
            </div>
            <div>
              <h2 className="font-black text-base text-white !text-white" style={{ color: '#ffffff' }}>
                Thermal LAN Printer Configuration
              </h2>
              <p className="text-xs text-gray-400">ESC/POS LAN receipt and kitchen ticket printing</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">
                Print Server IP Address
              </label>
              <input
                type="text"
                value={printServerIP}
                onChange={(e) => setPrintServerIP(e.target.value)}
                placeholder="192.168.18.195"
                className="w-full bg-[#10141E] border border-[#2D3548] focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-xs outline-none transition"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Local IP of the Ethernet thermal receipt printer or print bridge server.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">
                Print Server Port
              </label>
              <input
                type="number"
                value={printServerPort}
                onChange={(e) => setPrintServerPort(Number(e.target.value))}
                placeholder="9191"
                className="w-full bg-[#10141E] border border-[#2D3548] focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-xs outline-none transition"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Default raw socket port (typically 9191 or 9100).
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">
                Terminal Identifier
              </label>
              <input
                type="text"
                value={terminalId}
                onChange={(e) => setTerminalId(e.target.value)}
                placeholder="FLOW-TERM-01"
                className="w-full bg-[#10141E] border border-[#2D3548] focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-xs outline-none transition"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Hardware station code assigned to this register terminal.
              </span>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveSettings}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                <Save size={16} />
                <span>Save Hardware & Printer Configuration</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Store Operational Status & Discounts */}
        <div className="space-y-6">
          {/* Store Status Card */}
          <div className="bg-[#181C24] border border-[#262D3D] rounded-3xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center gap-3 border-b border-[#262D3D] pb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Store size={20} />
              </div>
              <div>
                <h2 className="font-black text-base text-white !text-white" style={{ color: '#ffffff' }}>
                  Store Operational Control
                </h2>
                <p className="text-xs text-gray-400">Master branch opening and online ordering availability</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-[#10141E] rounded-2xl border border-[#2D3548]">
              <div>
                <div className="text-xs font-black text-white">Current Branch Status</div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {isStoreOpen ? 'Branch is actively OPEN and accepting orders' : 'Branch is currently CLOSED'}
                </div>
              </div>
              <button
                type="button"
                disabled={storeStatusLoading}
                onClick={handleToggleStoreStatus}
                className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
                  isStoreOpen 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-rose-600 hover:text-white' 
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-emerald-600 hover:text-white'
                }`}
              >
                {storeStatusLoading ? <RefreshCw size={14} className="animate-spin" /> : null}
                <span>{isStoreOpen ? '🟢 OPEN (Click to Close)' : '🔴 CLOSED (Click to Open)'}</span>
              </button>
            </div>
          </div>

          {/* Restaurant & Branch Discounts Card */}
          <div className="bg-[#181C24] border border-[#262D3D] rounded-3xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center gap-3 border-b border-[#262D3D] pb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                <Tag size={20} />
              </div>
              <div>
                <h2 className="font-black text-base text-white !text-white" style={{ color: '#ffffff' }}>
                  Restaurant & Branch Discounts
                </h2>
                <p className="text-xs text-gray-400">{discountCount} active discounts configured for {restaurantName}</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Define authorized cashier discounts, manager comp rules, and staff meal policies across all branches or specific pilot locations.
            </p>

            <button
              type="button"
              onClick={() => setIsDiscountManagerOpen(true)}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <Tag size={16} />
              <span>🏷️ Manage Discounts & Branch Scopes</span>
            </button>
          </div>
        </div>
      </div>

      {/* Discount Manager Modal */}
      <DiscountManagerModal
        isOpen={isDiscountManagerOpen}
        onClose={() => setIsDiscountManagerOpen(false)}
        restaurantId={currentRestaurantId}
        restaurantName={restaurantName}
        currentBranchId=""
        currentBranchName=""
        onDiscountsUpdated={() => {
          // Refresh discount count
          supabase
            .from('pos_discounts')
            .select('id')
            .eq('restaurant_id', currentRestaurantId)
            .then(({ data }) => {
              if (data) setDiscountCount(data.length);
            });
        }}
      />
    </div>
  );
}
