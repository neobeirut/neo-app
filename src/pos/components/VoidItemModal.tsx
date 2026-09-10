import React, { useState } from 'react';
import { api } from '../../api/client';
import type { CanceledItemDetail } from '../services/voidBridge';

interface VoidItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | number;
  items: CanceledItemDetail[];
  currentUser: any;
  voidType: 'item_void' | 'order_cancellation' | 'refund';
  onConfirmVoid: (reason: string, authorizedBy: string) => Promise<{ success: boolean; error?: string }>;
}

const COMMON_REASONS = [
  'Customer changed mind',
  'Wrong item entered',
  'Kitchen delay / 86 item',
  'Quality / complaint issue',
  'Payment declined / abandoned',
  'Duplicate order'
];

export const VoidItemModal: React.FC<VoidItemModalProps> = ({
  isOpen,
  onClose,
  orderId,
  items,
  currentUser,
  voidType,
  onConfirmVoid
}) => {
  if (!isOpen) return null;

  const isUserAuthorized = 
    currentUser?.role === 'Admin' || 
    currentUser?.role === 'Manager' || 
    currentUser?.admin_permissions?.voids === true;

  const [selectedReason, setSelectedReason] = useState(COMMON_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [managerName, setManagerName] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [pinVerified, setPinVerified] = useState(isUserAuthorized);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveReason = selectedReason === 'Other' ? customReason : selectedReason;

  const handleVerifyManagerPin = async () => {
    if (!managerPin || managerPin.length < 4) {
      setError('Enter 4-digit Manager PIN');
      return;
    }

    setIsVerifyingPin(true);
    setError(null);
    try {
      const res = await api.verifyCashierPin(managerPin);
      if (res.success && res.data) {
        const mgr = res.data;
        const hasPerm = 
          mgr.role === 'Admin' || 
          mgr.role === 'Manager' || 
          mgr.admin_permissions?.voids === true;

        if (hasPerm) {
          setPinVerified(true);
          setManagerName(mgr.name);
          setError(null);
        } else {
          setError(`User "${mgr.name}" does not have manager void authorization.`);
        }
      } else {
        setError(res.error || 'Invalid Manager PIN code');
      }
    } catch (err: any) {
      setError(err?.message || 'PIN verification failed');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinVerified) {
      setError('Manager authorization required before voiding');
      return;
    }
    if (!effectiveReason.trim()) {
      setError('Please select or specify a reason for voiding');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const authorizedBy = managerName || currentUser?.name || 'Authorized Manager';
    try {
      const res = await onConfirmVoid(effectiveReason, authorizedBy);
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

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl w-full max-w-md p-6 shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#262D3D] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-lg">
              🛡️
            </div>
            <div>
              <h3 className="font-extrabold text-base">{titleText}</h3>
              <p className="text-xs text-gray-400">Order #{orderId} • FLOW Audit Log</p>
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

        {/* Canceled Items Summary */}
        <div className="mb-4 bg-[#14171F] p-3 rounded-xl border border-[#262D3D] max-h-32 overflow-y-auto">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            Items to Void ({items.length}):
          </div>
          <div className="space-y-1">
            {items.map((it, idx) => (
              <div key={idx} className="flex justify-between text-xs">
                <span className="font-bold text-white">
                  {it.qty}x {it.name}
                </span>
                {it.price !== undefined && (
                  <span className="font-mono text-gray-400">
                    ${(it.price * it.qty).toFixed(2)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Manager Authorization Section if needed */}
          {!pinVerified ? (
            <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-amber-400">
                <span>🔒</span>
                <span>Manager Authorization Required</span>
              </div>
              <p className="text-[11px] text-gray-400">
                Cashier "{currentUser?.name || 'Cashier'}" cannot execute voids. A manager must enter their 4-digit PIN.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  maxLength={6}
                  placeholder="Enter Manager PIN"
                  value={managerPin}
                  onChange={(e) => setManagerPin(e.target.value)}
                  className="flex-1 bg-[#14171F] border border-[#2D3548] focus:border-amber-500 rounded-xl px-3 py-2 text-white font-mono text-center tracking-widest text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={handleVerifyManagerPin}
                  disabled={isVerifyingPin || managerPin.length < 4}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition"
                >
                  {isVerifyingPin ? 'Verifying...' : 'Authorize'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs">
              <span className="text-gray-400">Authorized by:</span>
              <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                <span>✓</span> {managerName || currentUser?.name || 'Manager'}
              </span>
            </div>
          )}

          {/* Reason Selection */}
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5">
              Reason for Void / Cancellation:
            </label>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {COMMON_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedReason(r)}
                  className={`py-2 px-2.5 rounded-xl text-left text-[11px] font-bold border transition-all truncate ${
                    selectedReason === r
                      ? 'bg-[#eb660c] text-white border-[#eb660c] shadow-sm'
                      : 'bg-[#1F2430] text-gray-300 border-[#2D3548] hover:bg-[#282F40]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Or specify custom reason..."
              value={customReason}
              onChange={(e) => {
                setCustomReason(e.target.value);
                setSelectedReason('Other');
              }}
              className="w-full bg-[#14171F] border border-[#2D3548] focus:border-[#eb660c] rounded-xl py-2 px-3 text-xs text-white outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !pinVerified}
              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl transition shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? 'Logging Void...' : 'Confirm Void & Audit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
