import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Lock, AlertCircle, CheckCircle2, Delete, ArrowRight, X } from 'lucide-react';
import { verifySupervisorPin, logSensitivePosAction, type PosPermissionKey } from '../services/posPermissionService';

export interface SupervisorAuthRequest {
  actionKey: PosPermissionKey;
  actionTitle: string;
  tableNumber?: string | null;
  orderId?: string | number | null;
  previousValue?: any;
  newValue?: any;
  requireReason?: boolean;
  defaultReason?: string;
  onAuthorized: (authorizer: { id: string; name: string; role: string }, reason?: string) => Promise<void> | void;
  onCancel?: () => void;
}

interface PosSupervisorAuthModalProps {
  isOpen: boolean;
  request: SupervisorAuthRequest | null;
  restaurantId: string;
  branchName?: string;
  requestingUser: {
    id: string;
    name: string;
    role: string;
  };
  onClose: () => void;
}

export function PosSupervisorAuthModal({
  isOpen,
  request,
  restaurantId,
  branchName,
  requestingUser,
  onClose
}: PosSupervisorAuthModalProps) {
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState(request?.defaultReason || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successAuthorizer, setSuccessAuthorizer] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setReason(request?.defaultReason || '');
      setError('');
      setLoading(false);
      setSuccessAuthorizer(null);
    }
  }, [isOpen, request]);

  const handleDigit = useCallback((digit: string) => {
    setError('');
    setPin(prev => (prev.length >= 8 ? prev : prev + digit));
  }, []);

  const handleBackspace = useCallback(() => {
    setError('');
    setPin(prev => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setPin('');
    setError('');
  }, []);

  const handleAuthorize = useCallback(async () => {
    if (!request) return;

    if (request.requireReason && !reason.trim()) {
      setError('Please provide a reason for this operation.');
      return;
    }

    if (!pin || pin.length < 3) {
      setError('Please enter a supervisor PIN (at least 3 digits).');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await verifySupervisorPin(restaurantId, pin, request.actionKey);
      if (!res.success || !res.supervisor) {
        setError(res.error || 'Authorization failed. Invalid supervisor PIN.');
        setPin('');
        setLoading(false);
        return;
      }

      setSuccessAuthorizer(res.supervisor);

      // Log authorization event to audit trail
      await logSensitivePosAction({
        restaurantId,
        employeeId: requestingUser.id,
        employeeName: requestingUser.name,
        authorizerId: res.supervisor.id,
        authorizerName: res.supervisor.name,
        branch: branchName || 'Main',
        tableNumber: request.tableNumber || null,
        orderId: request.orderId || null,
        actionType: request.actionKey,
        actionLabel: request.actionTitle,
        previousValue: request.previousValue,
        newValue: request.newValue,
        reason: reason.trim() || undefined,
        status: 'approved'
      });

      // Execute authorized operation (one-time execution, no permanent elevation)
      setTimeout(async () => {
        try {
          await request.onAuthorized(res.supervisor, reason.trim() || undefined);
        } finally {
          onClose();
        }
      }, 500);
    } catch (err: any) {
      setError(err?.message || 'Error executing authorized operation.');
      setPin('');
      setLoading(false);
    }
  }, [request, pin, reason, restaurantId, branchName, requestingUser, onClose]);

  // Auto-submit when PIN reaches 4 digits
  useEffect(() => {
    if (pin.length === 4 && (!request?.requireReason || reason.trim())) {
      handleAuthorize();
    }
  }, [pin, reason, request, handleAuthorize]);

  if (!isOpen || !request) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 space-y-4 text-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center font-bold shadow-xs">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 tracking-tight">Authorization Required</h3>
              <p className="text-[11px] text-slate-500 font-medium">Supervisor approval required to proceed</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 flex items-center justify-center transition cursor-pointer shadow-xs"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Details Badge */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Requested Action:</span>
            <span className="font-black text-emerald-900 px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200">
              {request.actionTitle}
            </span>
          </div>

          {(request.tableNumber || request.orderId) && (
            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
              <span className="text-slate-500 font-medium">Target Context:</span>
              <span className="font-bold text-slate-800">
                {request.tableNumber ? `Table ${request.tableNumber}` : ''}
                {request.tableNumber && request.orderId ? ' • ' : ''}
                {request.orderId ? `Order #${request.orderId}` : ''}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
            <span className="text-slate-500 font-medium">Staff Requesting:</span>
            <span className="font-bold text-slate-800">
              {requestingUser.name} <span className="text-[10px] text-slate-500 font-normal">({requestingUser.role})</span>
            </span>
          </div>
        </div>

        {/* Reason Input (if required or optional) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Reason for Action {request.requireReason && <span className="text-rose-600">*</span>}
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Customer complaint, Cold food, Spill, Void..."
            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1e5c4f] shadow-xs"
          />
        </div>

        {/* Error Alert */}
        {error && (
          <div className="px-3 py-2 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 shadow-xs">
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successAuthorizer && (
          <div className="px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-xs">
            <CheckCircle2 size={16} className="shrink-0 text-[#1e5c4f]" />
            <span>Approved by {successAuthorizer.name} ({successAuthorizer.role})</span>
          </div>
        )}

        {/* PIN Entry Area */}
        <div className="pt-1">
          <div className="text-center mb-3">
            <span className="text-xs font-bold text-slate-600">Supervisor PIN Entry</span>
            {/* PIN Dots */}
            <div className="flex items-center justify-center gap-3 mt-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                    pin.length > i
                      ? 'bg-[#1e5c4f] scale-125 shadow-xs'
                      : 'bg-slate-100 border border-slate-300'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Compact Touch Numpad */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                disabled={loading || !!successAuthorizer}
                onClick={() => handleDigit(digit)}
                className="h-12 rounded-xl bg-white hover:bg-slate-100 active:bg-emerald-50 border border-slate-200 text-lg font-black text-slate-900 flex items-center justify-center transition active:scale-95 cursor-pointer disabled:opacity-40 shadow-2xs"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              disabled={loading || !!successAuthorizer}
              onClick={handleClear}
              className="h-12 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center justify-center transition active:scale-95 cursor-pointer disabled:opacity-40 shadow-2xs"
            >
              CLEAR
            </button>
            <button
              type="button"
              disabled={loading || !!successAuthorizer}
              onClick={() => handleDigit('0')}
              className="h-12 rounded-xl bg-white hover:bg-slate-100 active:bg-emerald-50 border border-slate-200 text-lg font-black text-slate-900 flex items-center justify-center transition active:scale-95 cursor-pointer disabled:opacity-40 shadow-2xs"
            >
              0
            </button>
            <button
              type="button"
              disabled={loading || pin.length === 0 || !!successAuthorizer}
              onClick={handleBackspace}
              className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center transition active:scale-95 cursor-pointer disabled:opacity-40 shadow-2xs"
            >
              <Delete size={18} />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer border border-slate-300 shadow-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || pin.length === 0 || !!successAuthorizer}
            onClick={handleAuthorize}
            className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer ${
              loading || pin.length === 0 || !!successAuthorizer
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'bg-[#1e5c4f] hover:bg-[#16473D] text-white shadow-xs active:scale-98'
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                VERIFYING...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                AUTHORIZE <ArrowRight size={14} />
              </span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
