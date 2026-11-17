import React, { useEffect } from 'react';
import { X, Ban, ChefHat, Layers, CheckCircle2, RefreshCw, ExternalLink } from 'lucide-react';
import type { Pos86Item } from '../hooks/usePos86';

interface Pos86ModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Pos86Item[];
  conceptName?: string;
  branchName?: string;
  onRefresh?: () => void;
}

export const Pos86Modal: React.FC<Pos86ModalProps> = ({
  isOpen,
  onClose,
  items,
  conceptName = 'NÉO',
  branchName = 'Badaro',
  onRefresh
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuItems = items.filter(i => i.type === 'menu' || !i.type);
  const ingredientItems = items.filter(i => i.type === 'ingredient');

  const renderBadge = (dept?: string) => {
    const d = (dept || 'Kitchen').toLowerCase();
    let bg = 'bg-slate-100 text-slate-700 border-slate-200';
    if (d === 'kitchen') bg = 'bg-amber-100 text-amber-800 border-amber-300';
    else if (d === 'bar') bg = 'bg-purple-100 text-purple-800 border-purple-300';
    else if (d === 'bakery') bg = 'bg-orange-100 text-orange-800 border-orange-300';
    else if (d === 'pastry') bg = 'bg-pink-100 text-pink-800 border-pink-300';
    return (
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${bg}`}>
        {dept || 'Kitchen'}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-86-modal-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center border border-rose-200 shadow-xs">
              <Ban size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="pos-86-modal-title" className="text-base font-black text-slate-900">
                  Daily 86 Missing Items
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[11px] font-bold">
                  {items.length} unavailable
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                {branchName} • {conceptName} • Today
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 transition cursor-pointer"
                title="Refresh 86 list"
              >
                <RefreshCw size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 transition cursor-pointer"
              title="Close (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {items.length === 0 ? (
            <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                <CheckCircle2 size={32} />
              </div>
              <h4 className="text-base font-black text-slate-900">All Items Available</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                There are currently no dishes, drinks, or modifier ingredients marked as 86'd for today. Everything can be ordered.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Menu Items Column */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 flex flex-col">
                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-200">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <ChefHat size={16} className="text-sky-600" />
                    <span>Menu Products</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-black">
                    {menuItems.length}
                  </span>
                </div>
                {menuItems.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">No menu products 86'd</p>
                ) : (
                  <ul className="space-y-1.5 flex-1 overflow-y-auto max-h-[320px]">
                    {menuItems.map((item, idx) => (
                      <li
                        key={idx}
                        className="px-3 py-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <span className="font-extrabold text-xs text-slate-800 truncate">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {renderBadge(item.department)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Modifiers / Ingredients Column */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 flex flex-col">
                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-200">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <Layers size={16} className="text-amber-600" />
                    <span>Modifiers & Add-ons</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-black">
                    {ingredientItems.length}
                  </span>
                </div>
                {ingredientItems.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">No modifiers 86'd</p>
                ) : (
                  <ul className="space-y-1.5 flex-1 overflow-y-auto max-h-[320px]">
                    {ingredientItems.map((item, idx) => (
                      <li
                        key={idx}
                        className="px-3 py-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <span className="font-extrabold text-xs text-slate-800 truncate">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {renderBadge(item.department)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={() => { window.open('/new/admin/#/86', '_blank'); }}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition cursor-pointer"
          >
            <ExternalLink size={14} />
            <span>Manage 86 in Admin</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition cursor-pointer active:scale-95 shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
