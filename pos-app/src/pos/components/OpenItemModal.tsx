import React, { useState, useEffect } from 'react';

export interface OpenItemData {
  name: string;
  unitPrice: number;
  qty: number;
  unit?: string;
  note?: string;
  editingIndex?: number | null;
}

interface OpenItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (item: OpenItemData) => void;
  initialData?: OpenItemData | null;
  primaryColor?: string;
}

const PRESET_NAMES = [
  'Divers',
  'Divers Gâteau',
  'Divers Pâtisserie',
  'Divers Plat',
  'Item Spécial',
];

const PRESET_UNITS = [
  { label: 'g (grams)', val: 'g' },
  { label: 'kg (kilos)', val: 'kg' },
  { label: 'pcs', val: 'pcs' },
  { label: 'portion', val: 'portion' },
  { label: 'None', val: '' },
];

const QUICK_PRICES = [0.1, 0.25, 0.3, 0.5, 1, 2, 5, 10];
const QUICK_QTYS = [1, 5, 10, 50, 100, 250, 500];

export const OpenItemModal: React.FC<OpenItemModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialData,
  primaryColor = '#1e5c4f',
}) => {
  const [name, setName] = useState('Divers');
  const [priceInput, setPriceInput] = useState('');
  const [qtyInput, setQtyInput] = useState('1');
  const [unit, setUnit] = useState('');
  const [note, setNote] = useState('');
  const [activeInput, setActiveInput] = useState<'price' | 'qty'>('price');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name || 'Divers');
        setPriceInput(initialData.unitPrice > 0 ? String(initialData.unitPrice) : '');
        setQtyInput(initialData.qty > 0 ? String(initialData.qty) : '1');
        setUnit(initialData.unit || '');
        setNote(initialData.note || '');
        setActiveInput('price');
      } else {
        setName('Divers');
        setPriceInput('');
        setQtyInput('1');
        setUnit('');
        setNote('');
        setActiveInput('price');
      }
      setError('');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const parsedPrice = parseFloat(priceInput) || 0;
  const parsedQty = parseFloat(qtyInput) || 0;
  const totalAmount = parsedPrice * parsedQty;

  const handleNumpadPress = (val: string) => {
    setError('');
    const current = activeInput === 'price' ? priceInput : qtyInput;
    const setter = activeInput === 'price' ? setPriceInput : setQtyInput;

    if (val === 'CLEAR') {
      setter('');
      return;
    }
    if (val === 'BACKSPACE') {
      setter(current.slice(0, -1));
      return;
    }
    if (val === '.') {
      if (!current.includes('.')) {
        setter(current === '' ? '0.' : current + '.');
      }
      return;
    }
    setter(current + val);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');

    const cleanName = name.trim() || 'Divers';
    if (parsedPrice <= 0) {
      setError('⚠️ Please enter a valid price greater than $0.00');
      setActiveInput('price');
      return;
    }
    if (parsedQty <= 0) {
      setError('⚠️ Please enter a valid quantity greater than 0');
      setActiveInput('qty');
      return;
    }

    onConfirm({
      name: cleanName,
      unitPrice: parsedPrice,
      qty: parsedQty,
      unit: unit.trim(),
      note: note.trim(),
      editingIndex: initialData?.editingIndex ?? null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 print:hidden animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl p-1.5 bg-emerald-100 rounded-xl text-emerald-800">✨</span>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 leading-tight">
                {initialData?.editingIndex !== undefined && initialData?.editingIndex !== null
                  ? 'Edit Open Item (Divers)'
                  : 'Add Open Item (Divers)'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Item without catalog price (manual amount & quantity)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* BODY */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-between">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')} className="font-black px-1">✕</button>
            </div>
          )}

          {/* ITEM NAME & PRESETS */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 flex items-center justify-between">
              <span>Item Name / Description:</span>
              <span className="text-[11px] text-slate-400 font-normal">Ex: Divers 0.3$ x 100g</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Divers, Divers Gâteau..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
            {/* Quick Name Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESET_NAMES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setName(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                    name === p
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* DUAL DISPLAY & INPUT TABS: PRICE & QTY */}
          <div className="grid grid-cols-2 gap-3">
            {/* Price Box */}
            <div
              onClick={() => setActiveInput('price')}
              className={`p-3 rounded-2xl border-2 transition cursor-pointer ${
                activeInput === 'price'
                  ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/10'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-extrabold">
                <span className={activeInput === 'price' ? 'text-emerald-800' : 'text-slate-600'}>
                  Unit Price ($ USD)
                </span>
                {activeInput === 'price' && (
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded-full font-black">
                    Editing
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-base font-bold text-slate-400">$</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {priceInput || '0.00'}
                </span>
              </div>
              {unit && (
                <span className="text-[11px] text-slate-500 font-medium">per {unit}</span>
              )}
            </div>

            {/* Qty / Weight Box */}
            <div
              onClick={() => setActiveInput('qty')}
              className={`p-3 rounded-2xl border-2 transition cursor-pointer ${
                activeInput === 'qty'
                  ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/10'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-extrabold">
                <span className={activeInput === 'qty' ? 'text-emerald-800' : 'text-slate-600'}>
                  Quantity / Weight
                </span>
                {activeInput === 'qty' && (
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded-full font-black">
                    Editing
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {qtyInput || '0'}
                </span>
                {unit && (
                  <span className="text-sm font-bold text-emerald-700">{unit}</span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                {unit ? `in ${unit}` : 'units'}
              </span>
            </div>
          </div>

          {/* UNIT OF MEASURE CHIPS */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-600 block">Unit of measure:</span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_UNITS.map((u) => (
                <button
                  key={u.label}
                  type="button"
                  onClick={() => setUnit(u.val)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                    unit === u.val
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          {/* QUICK SHORTCUT BUTTONS */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
              <span>Quick {activeInput === 'price' ? 'Price ($)' : 'Qty / Weight'}:</span>
              <span className="text-[10px] text-slate-400">Click to set</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
              {(activeInput === 'price' ? QUICK_PRICES : QUICK_QTYS).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    if (activeInput === 'price') {
                      setPriceInput(String(val));
                    } else {
                      setQtyInput(String(val));
                    }
                  }}
                  className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black transition active:scale-95 text-center cursor-pointer"
                >
                  {activeInput === 'price' ? `$${val}` : `${val}${unit ? unit : ''}`}
                </button>
              ))}
            </div>
          </div>

          {/* TOUCH NUMPAD */}
          <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 space-y-1.5">
            <div className="grid grid-cols-3 gap-1.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'BACKSPACE'].map((key) => {
                const isBack = key === 'BACKSPACE';
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleNumpadPress(key)}
                    className={`h-11 rounded-xl font-black text-base flex items-center justify-center transition active:scale-95 cursor-pointer shadow-xs ${
                      isBack
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {isBack ? '⌫' : key}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleNumpadPress('CLEAR')}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-200 hover:bg-slate-300 transition"
              >
                Clear Input
              </button>
              <button
                type="button"
                onClick={() => setActiveInput(activeInput === 'price' ? 'qty' : 'price')}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
              >
                Switch to {activeInput === 'price' ? 'Qty / Weight →' : 'Price →'}
              </button>
            </div>
          </div>

          {/* OPTIONAL NOTE */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">
              Kitchen / Receipt Note (Optional):
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Fresh strawberry cake, custom preparation..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-xs"
            />
          </div>

          {/* TOTAL PREVIEW BANNER */}
          <div className="p-3 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-300 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold text-emerald-900 block uppercase tracking-wider">
                Total Line Amount:
              </span>
              <span className="text-xs text-slate-600 font-semibold">
                ${parsedPrice.toFixed(2)} × {parsedQty}{unit}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-800 tabular-nums">
              ${totalAmount.toFixed(2)}
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs sm:text-sm transition cursor-pointer shadow-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            style={{ backgroundColor: primaryColor }}
            className="flex-2 py-3 rounded-xl text-white font-extrabold text-xs sm:text-sm transition shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2 hover:brightness-110"
          >
            <span>✨</span>
            <span>
              {initialData?.editingIndex !== undefined && initialData?.editingIndex !== null
                ? `Update Item — $${totalAmount.toFixed(2)}`
                : `Add to Ticket — $${totalAmount.toFixed(2)}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
