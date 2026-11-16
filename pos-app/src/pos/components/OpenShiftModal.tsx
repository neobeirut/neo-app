import React, { useState, useEffect } from 'react';

export interface OpenShiftModalProps {
  branchName: string;
  cashierName: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (params: { openingUsd: number; openingLbp: number; shift: 'AM' | 'PM' | 'ALL DAY' }) => Promise<{ success: boolean; error?: string }>;
  concept?: { id: string; code: string; name: string; primary_color?: string };
  isDeliveryConcept?: boolean;
  allowedShift?: 'AM' | 'PM';
  isAmEnabled?: boolean;
  isPmEnabled?: boolean;
  eligibilityReason?: string;
  statusLoading?: boolean;
  statusError?: string | null;
  prefillUsd?: number | null;
  prefillLbp?: number | null;
  prefillSource?: 'AM' | 'PM' | null;
  /** AM shift actual closing cash (USD) — backward compatibility */
  amShiftClosed?: boolean;
  amClosingUsd?: number | null;
  /** AM shift actual closing cash (LBP) — backward compatibility */
  amClosingLbp?: number | null;
}

export const OpenShiftModal: React.FC<OpenShiftModalProps> = ({
  branchName,
  cashierName,
  isOpen,
  onClose,
  onConfirm,
  concept,
  isDeliveryConcept = false,
  allowedShift,
  isAmEnabled,
  isPmEnabled,
  eligibilityReason,
  statusLoading = false,
  statusError = null,
  prefillUsd,
  prefillLbp,
  prefillSource,
  amShiftClosed = false,
  amClosingUsd,
  amClosingLbp,
}) => {
  const isConceptDeliveryMode = isDeliveryConcept || Boolean(concept && concept.code !== 'NEO');
  // Determine allowed shift and enabled status deterministically
  const effectiveAllowedShift: 'AM' | 'PM' = allowedShift || (amShiftClosed ? 'PM' : 'AM');
  const effectiveIsAmEnabled = isAmEnabled !== undefined ? isAmEnabled : !amShiftClosed;
  const effectiveIsPmEnabled = isPmEnabled !== undefined ? isPmEnabled : true;

  // Effective pre-fill values and source (supports PM -> AM and AM -> PM)
  const effectivePrefillUsd = prefillUsd !== undefined ? prefillUsd : (amClosingUsd ?? null);
  const effectivePrefillLbp = prefillLbp !== undefined ? prefillLbp : (amClosingLbp ?? null);
  const effectivePrefillSource: 'AM' | 'PM' | null = prefillSource !== undefined
    ? prefillSource
    : ((amClosingUsd != null || amClosingLbp != null) ? 'AM' : null);

  const [shift, setShift] = useState<'AM' | 'PM' | 'ALL DAY'>(effectiveAllowedShift);
  const [openingUsd, setOpeningUsd] = useState<string>('100');
  const [openingLbp, setOpeningLbp] = useState<string>('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lock shift selection to the system-allowed shift
  useEffect(() => {
    if (!isOpen) return;
    setShift(effectiveAllowedShift);
    setError(null);
  }, [isOpen, effectiveAllowedShift]);

  // Pre-fill opening cash from handover when available
  useEffect(() => {
    if (!isOpen || statusLoading) return;
    if (effectivePrefillUsd != null || effectivePrefillLbp != null) {
      if (effectivePrefillUsd != null) {
        setOpeningUsd(String(Math.round(effectivePrefillUsd * 100) / 100));
      } else {
        setOpeningUsd('0');
      }
      if (effectivePrefillLbp != null) {
        setOpeningLbp(String(Math.round(effectivePrefillLbp)));
      } else {
        setOpeningLbp('0');
      }
    } else {
      // Default initial float if no handover record exists
      setOpeningUsd('100');
      setOpeningLbp('0');
    }
  }, [isOpen, statusLoading, effectivePrefillUsd, effectivePrefillLbp, effectiveAllowedShift]);

  if (!isOpen) return null;

  const actualDate = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Beirut',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConceptDeliveryMode) {
      if (statusLoading || statusError) return;
      if (effectiveAllowedShift === 'AM' && !effectiveIsAmEnabled) return;
      if (effectiveAllowedShift === 'PM' && !effectiveIsPmEnabled) return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const usd = parseFloat(openingUsd) || 0;
      const lbp = parseFloat(openingLbp) || 0;
      const targetShift = isConceptDeliveryMode ? 'ALL DAY' : (shift || effectiveAllowedShift);

      const res = await onConfirm({ openingUsd: usd, openingLbp: lbp, shift: targetShift });
      if (!res.success) {
        setError(res.error || 'Failed to open shift');
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasHandoverData = effectivePrefillSource && (effectivePrefillUsd != null || effectivePrefillLbp != null);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md max-h-[94dvh] flex flex-col shadow-2xl text-slate-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-4 sm:p-5 flex-shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xl shadow-xs"
              style={{
                backgroundColor: concept?.primary_color ? `${concept.primary_color}20` : '#F1F5F9',
                color: concept?.primary_color || '#1e5c4f'
              }}
            >
              💵
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">
                {isConceptDeliveryMode ? `${concept?.name || 'OVRLOAD'} — Open Cash Shift` : 'Open Shift Cash Session'}
              </h3>
              <p className="text-xs text-slate-500">
                {isConceptDeliveryMode ? `Concept Cash Register • ${branchName}` : `FLOW Shift Management • ${branchName}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-300 flex items-center justify-center transition cursor-pointer shadow-xs"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5">
            {(error || (!isConceptDeliveryMode && statusError)) && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                <span>⚠️</span>
                <span>{error || (!isConceptDeliveryMode && statusError)}</span>
              </div>
            )}

            {/* Warning Banner */}
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 flex items-start gap-2.5 text-xs">
              <span className="text-base leading-none">⚠️</span>
              <div>
                <div className="font-black text-amber-900">
                  {isConceptDeliveryMode ? `${concept?.name || 'OVRLOAD'} Cash Shift is Currently Closed` : 'Shift is Currently Closed'}
                </div>
                <div className="text-amber-800/90 mt-0.5 font-medium leading-relaxed">
                  Please count and verify your opening cash float to begin taking orders and processing payments.
                </div>
              </div>
            </div>
          {/* Cashier & Date */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
            <span className="text-slate-500 font-bold uppercase text-[11px]">Cashier:</span>
            <span className="text-slate-900 font-black">{cashierName}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center gap-3 text-xs">
            <span className="text-slate-500 font-bold uppercase text-[11px]">Actual Date (Beirut):</span>
            <span className="text-slate-900 font-black text-right">{actualDate}</span>
          </div>

          {/* Shift Period (Only shown for Restaurant NÉO mode) */}
          {!isConceptDeliveryMode && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider">Shift Period (Sequential)</label>
                <span className="text-[10px] text-slate-500 font-medium">Auto-selected by drawer sequence</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!effectiveIsAmEnabled || statusLoading || Boolean(statusError)}
                  onClick={() => {
                    if (effectiveIsAmEnabled) setShift('AM');
                  }}
                  className={`py-2.5 rounded-xl text-xs font-black border transition-all ${
                    effectiveAllowedShift === 'AM'
                      ? 'bg-[#1e5c4f] text-white border-[#1e5c4f] shadow-xs'
                      : 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  {effectiveIsAmEnabled ? '☀️ AM Shift (Morning)' : (amShiftClosed ? '✓ AM Shift Closed' : '🔒 AM Shift (Locked)')}
                </button>
                <button
                  type="button"
                  disabled={!effectiveIsPmEnabled || statusLoading || Boolean(statusError)}
                  onClick={() => {
                    if (effectiveIsPmEnabled) setShift('PM');
                  }}
                  className={`py-2.5 rounded-xl text-xs font-black border transition-all ${
                    effectiveAllowedShift === 'PM'
                      ? 'bg-[#1e5c4f] text-white border-[#1e5c4f] shadow-xs'
                      : 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  {effectiveIsPmEnabled ? '🌙 PM Shift (Evening)' : '🔒 PM Shift (Locked)'}
                </button>
              </div>
            </div>
          )}

          {!isConceptDeliveryMode && statusLoading && <p className="text-xs text-slate-500">Verifying drawer shift eligibility…</p>}
          {!isConceptDeliveryMode && !statusLoading && eligibilityReason && (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-2.5 font-medium">
              ℹ️ {eligibilityReason}
            </p>
          )}

          {/* Handover Float Transfer Banner (PM -> AM or AM -> PM) */}
          {hasHandoverData && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
              <div className="flex items-center gap-2 text-emerald-800 font-black mb-1">
                <span>🔄</span> {effectivePrefillSource === 'PM' ? 'PM Closing Cash Transferred' : 'AM Closing Cash Transferred'}
              </div>
              <div className="text-slate-700 space-y-0.5 font-mono">
                {effectivePrefillUsd != null && (
                  <div>USD: <span className="text-slate-900 font-black">${effectivePrefillUsd.toFixed(2)}</span></div>
                )}
                {effectivePrefillLbp != null && (
                  <div>LBP: <span className="text-slate-900 font-black">L.L. {effectivePrefillLbp.toLocaleString()}</span></div>
                )}
              </div>
              <div className="text-emerald-700 font-medium text-[11px] mt-1.5">Edit below if the actual physical drawer count differs.</div>
            </div>
          )}

          {/* Opening USD */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                Opening Float (USD $)
              </label>
              {effectivePrefillSource && effectivePrefillUsd != null && (
                <span className="text-[10px] text-emerald-700 font-bold">From {effectivePrefillSource} Closing</span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">$</span>
              <input
                type="number"
                inputMode="numeric"
                step="any"
                required
                value={openingUsd}
                onChange={(e) => setOpeningUsd(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl py-2.5 pl-8 pr-3 text-slate-900 font-mono font-bold text-sm outline-none shadow-2xs"
                placeholder="0.00"
              />
            </div>
            {!hasHandoverData && (
              <div className="flex gap-1.5 mt-1.5">
                {[50, 100, 150, 200].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setOpeningUsd(String(preset))}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-[11px] font-mono text-slate-700 font-bold transition"
                  >
                    +${preset}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Opening LBP */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                Opening Float (LBP LL)
              </label>
              {effectivePrefillSource && effectivePrefillLbp != null && (
                <span className="text-[10px] text-emerald-700 font-bold">From {effectivePrefillSource} Closing</span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">L.L.</span>
              <input
                type="number"
                inputMode="numeric"
                step="any"
                value={openingLbp}
                onChange={(e) => setOpeningLbp(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl py-2.5 pl-10 pr-3 text-slate-900 font-mono font-bold text-sm outline-none shadow-2xs"
                placeholder="0"
              />
            </div>
          </div>
          </div>

          {/* Actions - Fixed at Bottom */}
          <div className="flex gap-2 p-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              Cancel (Browse Only)
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                (!isConceptDeliveryMode && (
                  statusLoading ||
                  Boolean(statusError) ||
                  (effectiveAllowedShift === 'AM' && !effectiveIsAmEnabled) ||
                  (effectiveAllowedShift === 'PM' && !effectiveIsPmEnabled)
                ))
              }
              className="flex-1 py-2.5 bg-[#1e5c4f] hover:bg-[#16473D] disabled:opacity-40 text-white font-black text-xs rounded-xl transition shadow-md cursor-pointer"
            >
              {isSubmitting ? 'Opening Shift...' : isConceptDeliveryMode ? `Open Shift for ${concept?.name || 'Concept'}` : 'Unlock Payments & Open'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
