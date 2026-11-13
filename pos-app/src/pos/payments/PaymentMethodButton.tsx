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
          ? 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
          : isSelected
          ? 'bg-emerald-50 border-[#1e5c4f] text-[#1e5c4f] ring-2 ring-emerald-500/20 shadow-sm'
          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={isSelected ? 'text-[#1e5c4f]' : 'text-slate-500'}>
          {getIcon()}
        </span>
        <span className="text-sm font-bold tracking-wide">
          {method.label}
        </span>
      </div>

      {method.badge && (
        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-bold">
          {method.badge}
        </span>
      )}

      {isSelected && (
        <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#1e5c4f] rounded-full flex items-center justify-center text-white shadow-xs">
          <Check className="w-2.5 h-2.5 stroke-[3]" />
        </span>
      )}
    </button>
  );
};
