import React, { useState } from 'react';

interface OpenShiftModalProps {
  branchName: string;
  cashierName: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (params: { openingUsd: number; openingLbp: number; shift: 'AM' | 'PM' | 'ALL DAY' }) => Promise<{ success: boolean; error?: string }>;
}

export const OpenShiftModal: React.FC<OpenShiftModalProps> = ({
  branchName,
  cashierName,
  isOpen,
  onClose,
  onConfirm
}) => {
  if (!isOpen) return null;

  const currentHour = new Date().getHours();
  const [shift, setShift] = useState<'AM' | 'PM' | 'ALL DAY'>(currentHour < 16 ? 'AM' : 'PM');
  const [openingUsd, setOpeningUsd] = useState<string>('100');
  const [openingLbp, setOpeningLbp] = useState<string>('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const usd = parseFloat(openingUsd) || 0;
      const lbp = parseFloat(openingLbp) || 0;

      const res = await onConfirm({
        openingUsd: usd,
        openingLbp: lbp,
        shift
      });

      if (!res.success) {
        setError(res.error || 'Failed to open shift');
      }
    } catch (err: any) {
      setError(err?.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-full max-w-md p-6 shadow-2xl text-white">
        <div className="flex items-center justify-between border-b border-[#262D3D] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-lg">
              💵
            </div>
            <div>
              <h3 className="font-extrabold text-base">Open Shift Cash Session</h3>
              <p className="text-xs text-gray-400">FLOW Shift Management • {branchName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white font-bold text-sm px-2 py-1 rounded"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-300 text-xs font-bold">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-[#1F2430] p-3 rounded-xl border border-[#2D3548] flex justify-between items-center text-xs">
            <span className="text-gray-400">Cashier:</span>
            <span className="text-white font-extrabold">{cashierName}</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">Shift Period</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShift('AM')}
                className={`py-2 rounded-xl text-xs font-extrabold border transition-all ${
                  shift === 'AM'
                    ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/20'
                    : 'bg-[#1F2430] text-gray-300 border-[#2D3548] hover:bg-[#282F40]'
                }`}
              >
                ☀️ AM Shift (Morning)
              </button>
              <button
                type="button"
                onClick={() => setShift('PM')}
                className={`py-2 rounded-xl text-xs font-extrabold border transition-all ${
                  shift === 'PM'
                    ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/20'
                    : 'bg-[#1F2430] text-gray-300 border-[#2D3548] hover:bg-[#282F40]'
                }`}
              >
                🌙 PM Shift (Evening)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">
              Opening Float (USD $)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 font-bold text-sm">$</span>
              <input
                type="number"
                step="any"
                required
                value={openingUsd}
                onChange={(e) => setOpeningUsd(e.target.value)}
                className="w-full bg-[#14171F] border border-[#2D3548] focus:border-amber-500 rounded-xl py-2.5 pl-8 pr-3 text-white font-bold text-sm outline-none"
                placeholder="0.00"
              />
            </div>
            <div className="flex gap-1.5 mt-1.5">
              {[50, 100, 150, 200].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setOpeningUsd(String(preset))}
                  className="px-2 py-0.5 bg-[#1F2430] hover:bg-[#282F40] border border-[#2D3548] rounded text-[11px] font-mono text-gray-300"
                >
                  +${preset}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">
              Opening Float (LBP LL)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 font-bold text-xs">L.L.</span>
              <input
                type="number"
                step="any"
                value={openingLbp}
                onChange={(e) => setOpeningLbp(e.target.value)}
                className="w-full bg-[#14171F] border border-[#2D3548] focus:border-amber-500 rounded-xl py-2.5 pl-10 pr-3 text-white font-bold text-sm outline-none"
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs rounded-xl transition"
            >
              Cancel (Browse Only)
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl transition shadow-lg shadow-amber-600/30"
            >
              {isSubmitting ? 'Opening...' : 'Unlock Payments & Open'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
