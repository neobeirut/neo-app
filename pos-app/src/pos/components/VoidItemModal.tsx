import React, { useState, useEffect } from 'react';
import type { CanceledItemDetail } from '../services/voidBridge';
import { 
  fetchVoidReasons, 
  DEFAULT_VOID_REASONS, 
  isManagerAuthorizedForVoid, 
  verifyVoidManagerPin, 
  type PosVoidReason 
} from '../services/posVoidService';

interface VoidItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | number;
  tableLabel?: string | null;
  items: CanceledItemDetail[];
  currentUser: any;
  voidType: 'item_void' | 'order_cancellation' | 'refund';
  onConfirmVoid: (
    reason: string, 
    authorizedBy: string, 
    isWaste?: boolean, 
    reasonCode?: string
  ) => Promise<{ success: boolean; error?: string }>;
}

export const VoidItemModal: React.FC<VoidItemModalProps> = ({
  isOpen,
  onClose,
  orderId,
  tableLabel,
  items,
  currentUser,
  voidType,
  onConfirmVoid
}) => {
  if (!isOpen) return null;

  const isUserAuthorized = isManagerAuthorizedForVoid(currentUser);

  // Dynamic Reasons State
  const [reasons, setReasons] = useState<PosVoidReason[]>(DEFAULT_VOID_REASONS);
  const [selectedReason, setSelectedReason] = useState<string>('Change his mind (waste)');
  const [selectedReasonCode, setSelectedReasonCode] = useState<string>('CHANGE_MIND_WASTE');
  const [isWaste, setIsWaste] = useState<boolean>(true);
  const [customReason, setCustomReason] = useState<string>('');

  // Manager Authorization State
  const [managerPin, setManagerPin] = useState<string>('');
  const [managerName, setManagerName] = useState<string>(isUserAuthorized ? (currentUser?.name || 'Manager') : '');
  const [pinVerified, setPinVerified] = useState<boolean>(isUserAuthorized);
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // General Error and Submitting States
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch dynamic reasons on open
  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const loaded = await fetchVoidReasons(currentUser?.restaurant_id);
        if (isMounted && loaded && loaded.length > 0) {
          setReasons(loaded);
          const first = loaded[0];
          setSelectedReason(first.label);
          setSelectedReasonCode(first.code);
          setIsWaste(first.is_waste);
        }
      } catch (err) {
        console.warn('Could not load dynamic reasons:', err);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [currentUser?.restaurant_id]);

  // Reset PIN state when modal opens
  useEffect(() => {
    const authorized = isManagerAuthorizedForVoid(currentUser);
    setPinVerified(authorized);
    setManagerName(authorized ? (currentUser?.name || 'Manager') : '');
    setManagerPin('');
    setPinError(null);
    setError(null);
  }, [isOpen, currentUser]);

  const handleSelectReason = (r: PosVoidReason) => {
    setSelectedReason(r.label);
    setSelectedReasonCode(r.code);
    setIsWaste(r.is_waste);
  };

  const handleVerifyManagerPin = async (explicitPin?: string) => {
    const pinToTest = explicitPin || managerPin;
    if (!pinToTest || pinToTest.length < 4) {
      setPinError('Enter 4-digit Manager PIN');
      return;
    }

    setIsVerifyingPin(true);
    setPinError(null);
    try {
      const res = await verifyVoidManagerPin(pinToTest);
      if (res.authorized && res.managerName) {
        setPinVerified(true);
        setManagerName(res.managerName);
        setPinError(null);
      } else {
        setPinError(res.error || 'Invalid Manager PIN code');
        setManagerPin('');
      }
    } catch (err: any) {
      setPinError(err?.message || 'PIN verification failed');
      setManagerPin('');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (managerPin.length >= 6) return;
    const next = managerPin + digit;
    setManagerPin(next);
    setPinError(null);
    if (next.length === 4) {
      handleVerifyManagerPin(next);
    }
  };

  const handleKeypadBackspace = () => {
    setManagerPin(prev => prev.slice(0, -1));
    setPinError(null);
  };

  const handleKeypadClear = () => {
    setManagerPin('');
    setPinError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinVerified) {
      setError('Manager authorization is required before voiding placed items.');
      return;
    }

    const effectiveReasonText = selectedReason === 'Other' || !selectedReason
      ? customReason.trim()
      : customReason.trim()
      ? `${selectedReason} - ${customReason.trim()}`
      : selectedReason;

    if (!effectiveReasonText.trim()) {
      setError('Please select or specify a reason for this void.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const authorizedBy = managerName || currentUser?.name || 'Authorized Manager';
    try {
      const res = await onConfirmVoid(
        effectiveReasonText, 
        authorizedBy, 
        isWaste, 
        selectedReasonCode
      );
      if (!res.success) {
        setError(res.error || 'Void operation failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Error executing void');
    } finally {
      setIsSubmitting(false);
    }
  };

  const titleText = 
    voidType === 'order_cancellation' ? 'Authorize Order Cancellation' :
    voidType === 'refund' ? 'Authorize Payment Refund' :
    'Authorize Item Void';

  const totalValue = items.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 1), 0);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-4 sm:p-6 shadow-2xl text-slate-900 max-h-[95vh] flex flex-col">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center text-lg font-bold shadow-xs">
              🛡️
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-slate-900 leading-tight">{titleText}</h3>
              <p className="text-xs text-slate-500 font-medium">
                {tableLabel ? `Table ${tableLabel} • ` : ''}Order #{orderId || 'Current'} • FLOW Audit
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 font-bold text-sm flex items-center justify-center transition cursor-pointer border border-slate-200 shadow-xs"
          >
            ✕
          </button>
        </div>

        {/* ERROR BANNER */}
        {error && (
          <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2 shrink-0 shadow-xs">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
          {/* ITEMS TO VOID SUMMARY */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
              <span>Items to Void ({items.length}):</span>
              <span className="text-rose-700 font-black font-mono">Total: $${totalValue.toFixed(2)}</span>
            </div>
            <div className="space-y-1.5">
              {items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="font-extrabold text-slate-900">
                    {it.qty}x {it.name}
                  </span>
                  {it.price !== undefined && (
                    <span className="font-mono text-slate-700 font-bold">
                      $${((it.price || 0) * (it.qty || 1)).toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* MANAGER AUTHORIZATION BLOCK */}
          {!pinVerified ? (
            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                  <span>🔒</span>
                  <span>Manager Authorization Required</span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium">Role: {currentUser?.role || 'Cashier'}</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-tight">
                Placed items cannot be deleted without approval. A Manager or Admin must enter their 4-digit PIN.
              </p>

              {pinError && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] font-bold">
                  ⚠️ {pinError}
                </div>
              )}

              {/* PIN INPUT & TOUCH KEYPAD */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="••••"
                    value={managerPin}
                    onChange={(e) => {
                      setManagerPin(e.target.value);
                      if (e.target.value.length === 4) handleVerifyManagerPin(e.target.value);
                    }}
                    className="flex-1 bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3 py-2 text-slate-900 font-mono text-center tracking-widest text-lg outline-none shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleVerifyManagerPin()}
                    disabled={isVerifyingPin || managerPin.length < 4}
                    className="px-4 py-2 bg-[#1e5c4f] hover:bg-[#16473D] active:scale-95 disabled:opacity-40 text-white font-black text-xs rounded-xl transition cursor-pointer shadow-xs"
                  >
                    {isVerifyingPin ? 'Verifying...' : 'Authorize'}
                  </button>
                </div>

                {/* Compact On-Screen Keypad for Touch Terminals */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleKeypadPress(d)}
                      className="h-10 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-900 font-bold text-sm border border-slate-200 transition shadow-2xs cursor-pointer"
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleKeypadClear}
                    className="h-10 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 font-bold text-xs transition cursor-pointer shadow-2xs"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className="h-10 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-900 font-bold text-sm border border-slate-200 transition shadow-2xs cursor-pointer"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleKeypadBackspace}
                    className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 border border-slate-200 font-bold text-xs transition cursor-pointer shadow-2xs"
                  >
                    ⌫
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-[#1e5c4f] flex items-center justify-center font-bold">
                  ✓
                </span>
                <div>
                  <span className="text-slate-500 block text-[10px] font-medium">Void Authorized by:</span>
                  <span className="text-emerald-800 font-extrabold text-xs">{managerName || 'Manager'}</span>
                </div>
              </div>
              {!isUserAuthorized && (
                <button
                  type="button"
                  onClick={() => {
                    setPinVerified(false);
                    setManagerPin('');
                    setManagerName('');
                  }}
                  className="text-[10px] text-slate-500 hover:text-slate-900 underline cursor-pointer"
                >
                  Change
                </button>
              )}
            </div>
          )}

          {/* DYNAMIC VOID REASONS SELECTION */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black text-slate-800">
                Select Void Reason: <span className="text-rose-600">*</span>
              </label>
              <span className="text-[10px] text-slate-500 font-medium">Dynamic DB List</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-2">
              {reasons.map((r) => {
                const isSelected = selectedReason === r.label || selectedReasonCode === r.code;
                return (
                  <button
                    key={r.id || r.code}
                    type="button"
                    onClick={() => handleSelectReason(r)}
                    className={`p-2.5 rounded-xl text-left border transition-all flex items-center justify-between gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 border-[#1e5c4f] text-[#1e5c4f] shadow-xs ring-1 ring-[#1e5c4f]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-[11px] font-bold truncate flex-1">{r.label}</span>
                    {r.is_waste ? (
                      <span className="shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200">
                        Waste
                      </span>
                    ) : (
                      <span className="shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                        No Waste
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* INTERACTIVE WASTE TOGGLE */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-900">Food Waste Accounting</span>
                  {isWaste ? (
                    <span className="text-[10px] bg-rose-50 text-rose-800 border border-rose-200 font-black px-1.5 py-0.5 rounded-md">
                      YES - WASTED
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-200 text-slate-700 font-black px-1.5 py-0.5 rounded-md">
                      NO WASTE
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                  {isWaste 
                    ? '⚠️ Item was prepared and discarded. Recorded in restaurant waste log.' 
                    : '⚡ Item was cancelled before preparation. No inventory wasted.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsWaste(!isWaste)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 border ${
                  isWaste 
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                {isWaste ? 'Marked as Waste' : 'Mark as Waste'}
              </button>
            </div>

            {/* CUSTOM REASON / DETAIL NOTE */}
            <div className="mt-2">
              <input
                type="text"
                placeholder="Additional void notes / reason details (optional)..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl py-2 px-3 text-xs text-slate-900 outline-none shadow-xs"
              />
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="flex gap-2 pt-3 border-t border-slate-200 mt-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition cursor-pointer shadow-xs"
          >
            Cancel
          </button>
          <button
            id="confirm-void-btn"
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !pinVerified}
            className="flex-[1.4] py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-40 text-white font-black text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span>Logging Void...</span>
            ) : (
              <span>Confirm Void &amp; Audit ($${totalValue.toFixed(2)})</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
