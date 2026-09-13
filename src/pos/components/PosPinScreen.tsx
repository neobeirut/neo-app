import React, { useState, useEffect, useCallback } from 'react';
import { api, setCachedRestaurantId } from '../../api/client';
import { setGlobalRestaurantId } from '../../api/supabase';
import { sessionLogger } from '../../utils/sessionLogger';
import { Lock, Delete, ArrowRight, Shield, Utensils, AlertCircle } from 'lucide-react';

interface PosPinScreenProps {
  onSuccess: (user: any) => void;
  onSwitchToPasswordLogin?: () => void;
  initialRestaurantId?: string;
  isLockScreen?: boolean;
  onCancelLock?: () => void;
}

export default function PosPinScreen({
  onSuccess,
  onSwitchToPasswordLogin,
  initialRestaurantId,
  isLockScreen = false,
  onCancelLock
}: PosPinScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [restaurantId, setRestaurantId] = useState<string>(() => {
    return initialRestaurantId || localStorage.getItem('flow_pos_selected_restaurant') || '4c0ed960-e459-42c4-962f-41229a2d3783';
  });

  useEffect(() => {
    if (restaurantId === '4c0ed960-e459-42c4-962f-41229a2d3783') {
      setRestaurantName('The Bistro');
    } else if (restaurantId === '79256f11-a9f8-4fec-901d-69baf929762d') {
      setRestaurantName('Neo Beirut');
    } else {
      setRestaurantName('FLOW POS');
    }
  }, [restaurantId]);

  const handleDigit = useCallback((digit: string) => {
    setError('');
    setPin((prev) => {
      if (prev.length >= 8) return prev;
      return prev + digit;
    });
  }, []);

  const handleClear = useCallback(() => {
    setPin('');
    setError('');
  }, []);

  const handleBackspace = useCallback(() => {
    setError('');
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const handleSubmitPin = useCallback(async (pinToSubmit?: string) => {
    const code = pinToSubmit || pin;
    if (!code || code.length < 3) {
      setError('Please enter your PIN code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.verifyCashierPin(code, restaurantId);
      if (res.success && res.data) {
        const userData = res.data;
        const resolvedRestId = userData.restaurant_id || restaurantId;
        
        setGlobalRestaurantId(resolvedRestId);
        setCachedRestaurantId(resolvedRestId);
        localStorage.setItem('flow_pos_selected_restaurant', resolvedRestId);

        const fullUser = {
          ...userData,
          restaurant_id: resolvedRestId,
          branch: userData.branch || 'All'
        };

        sessionLogger.startSession(fullUser);
        onSuccess(fullUser);
      } else {
        setError(res.error || 'Invalid PIN code. Please try again.');
        setPin('');
      }
    } catch (err: any) {
      setError(err?.message || 'Verification error. Please try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  }, [pin, restaurantId, onSuccess]);

  useEffect(() => {
    if (pin.length === 4) {
      handleSubmitPin(pin);
    }
  }, [pin, handleSubmitPin]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading) return;
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        handleSubmitPin();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, handleDigit, handleBackspace, handleSubmitPin, handleClear]);

  return (
    <div className="fixed inset-0 bg-[#0A0D14] text-white flex flex-col items-center justify-between p-6 select-none z-50 overflow-hidden font-sans">
      <div className="w-full max-w-md flex items-center justify-between pt-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-amber-500/20">
            {restaurantName.charAt(0) || 'F'}
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              {restaurantName}
              <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                POS
              </span>
            </h1>
            <p className="text-xs text-slate-400">Touch Terminal Sign-In</p>
          </div>
        </div>

        {isLockScreen && onCancelLock && (
          <button
            type="button"
            onClick={onCancelLock}
            className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="w-full max-w-xs flex flex-col items-center my-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-900 border border-slate-800 text-amber-400 mb-3 shadow-inner">
            <Lock size={24} />
          </div>
          <h2 className="text-xl font-black text-slate-100">Enter Cashier PIN</h2>
          <p className="text-xs text-slate-400 mt-1">Tap your 4-digit code to unlock the terminal</p>
        </div>

        <div className="flex items-center justify-center gap-4 mb-6">
          {[0, 1, 2, 3].map((index) => {
            const hasDigit = pin.length > index;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  hasDigit
                    ? 'bg-amber-400 scale-125 shadow-lg shadow-amber-500/50'
                    : 'bg-slate-800 border border-slate-700'
                }`}
              />
            );
          })}
        </div>

        {error && (
          <div className="w-full mb-4 px-3 py-2 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs font-semibold flex items-center gap-2 justify-center animate-shake">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="w-full grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={loading}
              onClick={() => handleDigit(digit)}
              className="h-16 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:bg-amber-500 active:text-slate-950 border border-slate-800/80 text-2xl font-black text-slate-100 flex items-center justify-center shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            disabled={loading}
            onClick={handleClear}
            className="h-16 rounded-2xl bg-slate-900/40 hover:bg-red-950/50 active:bg-red-900 border border-slate-800/80 text-sm font-bold text-slate-400 hover:text-red-300 flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            CLEAR
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleDigit('0')}
            className="h-16 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:bg-amber-500 active:text-slate-950 border border-slate-800/80 text-2xl font-black text-slate-100 flex items-center justify-center shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            0
          </button>

          <button
            type="button"
            disabled={loading || pin.length === 0}
            onClick={handleBackspace}
            className="h-16 rounded-2xl bg-slate-900/40 hover:bg-slate-800 active:bg-slate-700 border border-slate-800/80 text-slate-300 flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-30"
            title="Backspace"
          >
            <Delete size={22} />
          </button>
        </div>

        <button
          type="button"
          disabled={loading || pin.length === 0}
          onClick={() => handleSubmitPin()}
          className={`w-full mt-4 h-14 rounded-2xl font-black text-sm tracking-wider uppercase flex items-center justify-center gap-2 transition-all shadow-xl active:scale-98 cursor-pointer ${
            loading || pin.length === 0
              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/25 border border-amber-400'
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
              VERIFYING...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span>UNLOCK TERMINAL</span>
              <ArrowRight size={18} />
            </span>
          )}
        </button>
      </div>

      <div className="w-full max-w-md flex flex-col items-center gap-3 pb-2 text-center">
        {onSwitchToPasswordLogin && (
          <button
            type="button"
            onClick={onSwitchToPasswordLogin}
            className="text-xs text-slate-400 hover:text-white transition flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-slate-900/80 border border-transparent hover:border-slate-800"
          >
            <Shield size={13} className="text-slate-500" />
            <span>Admin Email & Password Login</span>
          </button>
        )}

        <div className="flex items-center gap-2 text-[11px] text-slate-600">
          <Utensils size={11} />
          <span>FLOW Restaurant Touch POS • Fast Staff Switching</span>
        </div>
      </div>
    </div>
  );
}
