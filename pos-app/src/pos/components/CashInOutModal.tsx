import React, { useState } from 'react';
import { 
  X, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { addDailyPayment } from '../services/shiftCashBridge';

export interface CashInOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialType?: 'CashIn' | 'CashOut';
  branchName: string;
  shiftName: string;
  date: string;
  cashierName: string;
  restaurantId?: string;
}

export const CashInOutModal: React.FC<CashInOutModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialType = 'CashIn',
  branchName,
  shiftName,
  date,
  cashierName,
  restaurantId
}) => {
  const [movementType, setMovementType] = useState<'CashIn' | 'CashOut'>(initialType);
  const [cashOutSubtype, setCashOutSubtype] = useState<string>('CashOut');
  const [amountUsd, setAmountUsd] = useState<string>('');
  const [amountLbp, setAmountLbp] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setMovementType(initialType);
      setAmountUsd('');
      setAmountLbp('');
      setDescription('');
      setErrorMsg(null);
    }
  }, [isOpen, initialType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numUsd = parseFloat(amountUsd) || 0;
    const numLbp = parseFloat(amountLbp) || 0;

    if (numUsd === 0 && numLbp === 0) {
      setErrorMsg('Please enter either a USD or LBP amount.');
      return;
    }

    const effectiveType = movementType === 'CashIn' ? 'CashIn' : cashOutSubtype;
    const effectiveDesc = description.trim() || (movementType === 'CashIn' ? 'Cash In (Drawer Top-Up)' : 'Cash Out Payout');

    setSaving(true);
    setErrorMsg(null);

    try {
      const record = {
        date,
        branch: branchName,
        shift: shiftName,
        supplier: effectiveDesc,
        amount_usd: numUsd,
        amount_lbp: numLbp,
        type: effectiveType,
        has_invoice: false,
        user_name: cashierName,
        status: 'Paid',
        restaurant_id: restaurantId
      };

      const res = await addDailyPayment(record);
      if (res.success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to record transaction in daily payments.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error recording drawer transaction.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden text-slate-900 animate-in fade-in zoom-in-95 duration-150">
        
        {/* HEADER */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${
              movementType === 'CashIn' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {movementType === 'CashIn' ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900">
                {movementType === 'CashIn' ? 'Record Cash In' : 'Record Cash Out'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {branchName} • {shiftName} Shift • {date}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-800 transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* ERROR MSG */}
        {errorMsg && (
          <div className="px-5 py-2 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {/* Toggle Type */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMovementType('CashIn')}
              className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                movementType === 'CashIn'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ArrowDownCircle size={14} />
              <span>Cash In</span>
            </button>

            <button
              type="button"
              onClick={() => setMovementType('CashOut')}
              className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                movementType === 'CashOut'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ArrowUpCircle size={14} />
              <span>Cash Out</span>
            </button>
          </div>

          {/* Subcategory for Cash Out */}
          {movementType === 'CashOut' && (
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: 'CashOut', label: 'General' },
                  { id: 'Cashout Loan', label: 'Advance' },
                  { id: 'Cashout Salary', label: 'Salary' },
                  { id: 'Cashout Bank', label: 'Bank' }
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setCashOutSubtype(st.id)}
                    className={`py-1 px-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                      cashOutSubtype === st.id
                        ? 'bg-rose-100 text-rose-900 border-rose-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Amount Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase text-slate-500">
                Amount USD ($)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input
                  type="number"
                  step="any"
                  value={amountUsd}
                  onChange={(e) => setAmountUsd(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-6 pr-2 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#1e5c4f] rounded-xl font-mono font-black text-sm text-slate-900 outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {[5, 10, 20, 50, 100].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmountUsd(String((parseFloat(amountUsd) || 0) + v))}
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                  >
                    +${v}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase text-slate-500">
                Amount LBP (L.L.)
              </label>
              <div className="relative">
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[9px]">LBP</span>
                <input
                  type="number"
                  step="any"
                  value={amountLbp}
                  onChange={(e) => setAmountLbp(e.target.value)}
                  placeholder="0"
                  className="w-full pl-2 pr-8 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#1e5c4f] rounded-xl font-mono font-black text-sm text-slate-900 outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {[100000, 250000, 500000, 1000000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmountLbp(String((parseFloat(amountLbp) || 0) + v))}
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                  >
                    +{v >= 1000000 ? `${v / 1000000}M` : `${v / 1000}k`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
              Reason / Description / Payee *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                movementType === 'CashIn' 
                  ? "e.g. Change for register float" 
                  : "e.g. Ice, Bread, Taxi, Cleaning"
              }
              className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#1e5c4f] rounded-xl text-xs font-bold text-slate-900 outline-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || (!amountUsd && !amountLbp)}
              className={`px-5 py-2 rounded-xl font-black text-xs text-white transition cursor-pointer shadow-md flex items-center gap-1.5 ${
                movementType === 'CashIn'
                  ? 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50'
                  : 'bg-rose-600 hover:bg-rose-700 disabled:opacity-50'
              }`}
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : null}
              <span>{saving ? 'Saving...' : `Save ${movementType === 'CashIn' ? 'Cash In' : 'Cash Out'}`}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
