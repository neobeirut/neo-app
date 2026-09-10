import React from 'react';
import { DollarSign, Banknote, CreditCard, Zap, ShoppingBag, Check } from 'lucide-react';
import type { PaymentMethodOption } from './paymentConfig';

interface PaymentMethodButtonProps {
  method: PaymentMethodOption;
  isSelected: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export const PaymentMethodButton: React.FC<PaymentMethodButtonProps> = ({
  method,
  isSelected,
  disabled = false,
  onClick
}) => {
  const getIcon = () => {
    switch (method.iconName) {
      case 'DollarSign': return <DollarSign className="w-5 h-5" />;
      case 'Banknote': return <Banknote className="w-5 h-5" />;
      case 'CreditCard': return <CreditCard className="w-5 h-5" />;
      case 'Zap': return <Zap className="w-5 h-5" />;
      case 'ShoppingBag': return <ShoppingBag className="w-5 h-5" />;
      default: return <DollarSign className="w-5 h-5" />;
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all text-center min-h-[72px] ${
        disabled
          ? 'opacity-40 cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500'
          : isSelected
          ? 'bg-amber-500/15 border-amber-500 text-amber-300 ring-2 ring-amber-500/30 shadow-lg shadow-amber-500/10'
          : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80 active:scale-[0.98]'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={isSelected ? 'text-amber-400' : 'text-slate-400'}>
          {getIcon()}
        </span>
        <span className="text-sm font-semibold tracking-wide">
          {method.label}
        </span>
      </div>

      {method.badge && (
        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
          {method.badge}
        </span>
      )}

      {isSelected && (
        <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-slate-950">
          <Check className="w-2.5 h-2.5 stroke-[3]" />
        </span>
      )}
    </button>
  );
};
