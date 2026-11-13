import React, { useState, useEffect, useRef } from 'react';
import { Search, Phone, User, X, Check, Delete, ArrowRight } from 'lucide-react';
import { supabase } from '../../api/supabase';

export interface CustomerData {
  id?: string | number;
  customer_name: string;
  customer_phone: string;
  delivery_address?: string;
  category?: string;
}

interface CustomerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: CustomerData) => void;
  initialPhone?: string;
  initialName?: string;
  initialTab?: 'phone' | 'name';
}

// Phone Normalization for Lebanese & International Formats
// Treats 9613123456, 96103123456, 03123456, and 3123456 as the exact same phone number
export function extractCorePhone(phone: string): { core: string; rawDigits: string; isLebanese: boolean } {
  const rawDigits = (phone || '').replace(/\D/g, '');
  if (!rawDigits) return { core: '', rawDigits: '', isLebanese: false };

  let core = rawDigits;
  let isLebanese = false;

  if (rawDigits.startsWith('9610')) {
    core = rawDigits.slice(4);
    isLebanese = true;
  } else if (rawDigits.startsWith('961')) {
    core = rawDigits.slice(3);
    isLebanese = true;
  } else if (rawDigits.startsWith('0')) {
    // Domestic Lebanese trunk 0 (e.g. 03, 01, 70, 71, etc.)
    core = rawDigits.slice(1);
    isLebanese = true;
  } else if (
    rawDigits.startsWith('3') ||
    rawDigits.startsWith('7') ||
    rawDigits.startsWith('8') ||
    rawDigits.startsWith('1') ||
    rawDigits.startsWith('4') ||
    rawDigits.startsWith('5') ||
    rawDigits.startsWith('6') ||
    rawDigits.startsWith('9')
  ) {
    core = rawDigits;
    isLebanese = true;
  } else if (rawDigits.length >= 7 && rawDigits.length <= 8) {
    core = rawDigits;
    isLebanese = true;
  }

  return { core, rawDigits, isLebanese };
}

export function getPhoneSearchVariants(phone: string): string[] {
  const { core, rawDigits } = extractCorePhone(phone);
  const variants = new Set<string>();

  if (rawDigits.length >= 2) {
    variants.add(rawDigits);
  }

  if (core && core.length >= 2) {
    variants.add(core);              // e.g. 3361515
    variants.add('0' + core);         // e.g. 03361515
    variants.add('961' + core);       // e.g. 9613361515
    variants.add('+961' + core);      // e.g. +9613361515
    variants.add('9610' + core);      // e.g. 96103361515
    variants.add('+9610' + core);     // e.g. +96103361515
  }

  return Array.from(variants);
}

export const CustomerSearchModal: React.FC<CustomerSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectCustomer,
  initialPhone = '',
  initialName = '',
  initialTab = 'phone'
}) => {
  const [activeTab, setActiveTab] = useState<'phone' | 'name'>(initialTab);
  const [phoneQuery, setPhoneQuery] = useState(initialPhone);
  const [nameQuery, setNameQuery] = useState(initialName);
  const [searchResults, setSearchResults] = useState<CustomerData[]>([]);
  const searchRequest = useRef(0);
  const [isSearching, setIsSearching] = useState(false);

  // Sync initial inputs if modal opens
  useEffect(() => {
    if (isOpen) {
      setPhoneQuery(initialPhone);
      setNameQuery(initialName);
      setActiveTab(initialTab);
      if (initialTab === 'name') searchByName(initialName);
      else searchByPhone(initialPhone);
    }
    return () => { searchRequest.current++; };
  }, [isOpen, initialPhone, initialName, initialTab]);

  // Search by Phone (considers 961..., 9610..., 03..., and 3... the same)
  const searchByPhone = async (phone: string) => {
    const request = ++searchRequest.current;
    setIsSearching(true);
    try {
      const { core, rawDigits } = extractCorePhone(phone);
      const variants = getPhoneSearchVariants(phone);

      let query = supabase
        .from('whatsapp_contacts')
        .select('id, name, phone_e164, category')
        .order('name', { ascending: true })
        .limit(30);

      if (variants.length > 0 && rawDigits.length >= 2) {
        const orClause = variants.map(v => `phone_e164.ilike.%${v}%`).join(',');
        query = query.or(orClause);
      }

      const { data, error } = await query;
      if (request !== searchRequest.current) return;
      if (!error && data) {
        const mapped: CustomerData[] = data.map(d => ({
          id: d.id,
          customer_name: d.name || 'Unnamed Client',
          customer_phone: d.phone_e164 || '',
          category: d.category || undefined
        }));

        // Sort exact core matches to the top
        if (core.length >= 3) {
          mapped.sort((a, b) => {
            const aCore = extractCorePhone(a.customer_phone).core;
            const bCore = extractCorePhone(b.customer_phone).core;
            const aExact = aCore === core;
            const bExact = bCore === core;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
            return (a.customer_name || '').localeCompare(b.customer_name || '');
          });
        }

        setSearchResults(mapped);
      }
    } catch (err) {
      console.warn('Phone search error:', err);
    } finally {
      if (request === searchRequest.current) setIsSearching(false);
    }
  };

  // Search by Name
  const searchByName = async (name: string) => {
    const request = ++searchRequest.current;
    setIsSearching(true);
    try {
      const clean = name.trim();
      let query = supabase
        .from('whatsapp_contacts')
        .select('id, name, phone_e164, category')
        .order('name', { ascending: true })
        .limit(25);

      if (clean.length >= 1) {
        query = query.ilike('name', `%${clean}%`);
      }

      const { data, error } = await query;
      if (request !== searchRequest.current) return;
      if (!error && data) {
        setSearchResults(
          data.map(d => ({
            id: d.id,
            customer_name: d.name || 'Unnamed Client',
            customer_phone: d.phone_e164 || '',
            category: d.category || undefined
          }))
        );
      }
    } catch (err) {
      console.warn('Name search error:', err);
    } finally {
      if (request === searchRequest.current) setIsSearching(false);
    }
  };

  // Keyboard Handlers for Phone
  const handlePhoneDigit = (digit: string) => {
    const next = phoneQuery + digit;
    setPhoneQuery(next);
    searchByPhone(next);
  };

  const handlePhoneBackspace = () => {
    const next = phoneQuery.slice(0, -1);
    setPhoneQuery(next);
    searchByPhone(next);
  };

  const handlePhoneClear = () => {
    setPhoneQuery('');
    searchByPhone('');
  };

  // Keyboard Handlers for Name
  const handleNameLetter = (letter: string) => {
    const next = nameQuery + letter;
    setNameQuery(next);
    searchByName(next);
  };

  const handleNameBackspace = () => {
    const next = nameQuery.slice(0, -1);
    setNameQuery(next);
    searchByName(next);
  };

  const handleNameClear = () => {
    setNameQuery('');
    searchByName('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-6xl h-[90vh] max-h-[780px] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* HEADER */}
        <div className="h-14 bg-white border-b border-slate-200 px-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl p-2 bg-emerald-50 rounded-2xl border border-emerald-200 text-[#1e5c4f]">👥</span>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-wide">Customer Search</h2>
              <p className="text-[11px] text-slate-500 font-medium">Search client database by phone number or name</p>
            </div>
          </div>

          {/* TAB SELECTOR */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setActiveTab('phone');
                searchByPhone(phoneQuery);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'phone'
                  ? 'bg-[#1e5c4f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Phone Search</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('name');
                searchByName(nameQuery);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'name'
                  ? 'bg-[#1e5c4f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Name Search</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 flex items-center justify-center transition cursor-pointer shadow-xs"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY SPLIT: KEYBOARD ON LEFT, RESULTS ON RIGHT */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* LEFT: TOUCH KEYBOARD & INPUT (65% Width) */}
          <div className="w-[65%] p-4 bg-slate-50 border-r border-slate-200 flex flex-col justify-between overflow-y-auto">
            {activeTab === 'phone' ? (
              /* --- PHONE TAB CONTENT --- */
              <div className="flex flex-col h-full justify-between gap-3">
                {/* Phone Display Box */}
                <div>
                  <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1">
                    Customer Phone Number
                  </label>
                  <div className="flex items-center gap-2 bg-white border-2 border-slate-200 focus-within:border-[#1e5c4f] rounded-2xl px-3 py-2 shadow-xs">
                    <Phone className="w-5 h-5 text-[#1e5c4f] flex-shrink-0" />
                    <input
                      type="text"
                      value={phoneQuery}
                      onChange={e => {
                        setPhoneQuery(e.target.value);
                        searchByPhone(e.target.value);
                      }}
                      placeholder="Type phone digits..."
                      className="flex-1 bg-transparent text-slate-900 font-black text-xl placeholder-slate-400 focus:outline-none tracking-wider font-mono"
                      autoFocus
                    />
                    {phoneQuery && (
                      <button
                        type="button"
                        onClick={handlePhoneClear}
                        className="text-slate-400 hover:text-slate-700 text-xs px-2 py-1 cursor-pointer font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Numeric Touch Keypad */}
                <div className="grid grid-cols-3 gap-2 flex-1 my-1">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0'].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handlePhoneDigit(d)}
                      className="rounded-2xl bg-white hover:bg-slate-100 active:scale-95 text-slate-900 font-black text-2xl border border-slate-200 flex items-center justify-center transition shadow-xs cursor-pointer"
                    >
                      {d}
                    </button>
                  ))}
                  {/* Backspace Button */}
                  <button
                    type="button"
                    onClick={handlePhoneBackspace}
                    className="rounded-2xl bg-slate-100 hover:bg-rose-50 active:scale-95 text-slate-700 hover:text-rose-600 font-black text-lg border border-slate-200 flex items-center justify-center transition shadow-xs cursor-pointer"
                    title="Backspace"
                  >
                    <Delete className="w-6 h-6" />
                  </button>
                </div>

                {/* Bottom Clear & Custom Phone Action */}
                <div className="flex items-center gap-2 pt-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handlePhoneClear}
                    className="h-11 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-300 uppercase transition cursor-pointer shadow-xs"
                  >
                    Clear
                  </button>
                  {phoneQuery.trim().length >= 3 && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCustomer({
                          customer_name: nameQuery.trim(),
                          customer_phone: phoneQuery.trim()
                        });
                        onClose();
                      }}
                      className="flex-1 h-11 px-4 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-xs flex items-center justify-center gap-2 uppercase tracking-wider transition active:scale-95 shadow-xs cursor-pointer"
                    >
                      <span>Use Phone: {phoneQuery.trim()}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* --- NAME TAB CONTENT --- */
              <div className="flex flex-col h-full justify-between gap-3">
                {/* Name Display Box */}
                <div>
                  <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1">
                    Customer Name
                  </label>
                  <div className="flex items-center gap-2 bg-white border-2 border-slate-200 focus-within:border-[#1e5c4f] rounded-2xl px-3 py-2 shadow-xs">
                    <User className="w-5 h-5 text-[#1e5c4f] flex-shrink-0" />
                    <input
                      type="text"
                      value={nameQuery}
                      onChange={e => {
                        setNameQuery(e.target.value);
                        searchByName(e.target.value);
                      }}
                      placeholder="Type client name..."
                      className="flex-1 bg-transparent text-slate-900 font-black text-lg placeholder-slate-400 focus:outline-none tracking-wide"
                      autoFocus
                    />
                    {nameQuery && (
                      <button
                        type="button"
                        onClick={handleNameClear}
                        className="text-slate-400 hover:text-slate-700 text-xs px-2 py-1 cursor-pointer font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Touch QWERTY Keyboard */}
                <div className="flex flex-col gap-1.5 flex-1 justify-center my-1">
                  {/* Row 1: Q - P */}
                  <div className="grid grid-cols-10 gap-1">
                    {'QWERTYUIOP'.split('').map(letter => (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => handleNameLetter(letter)}
                        className="h-12 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-900 font-black text-base border border-slate-200 flex items-center justify-center transition cursor-pointer shadow-xs"
                      >
                        {letter}
                      </button>
                    ))}
                  </div>

                  {/* Row 2: A - L */}
                  <div className="grid grid-cols-9 gap-1 px-3">
                    {'ASDFGHJKL'.split('').map(letter => (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => handleNameLetter(letter)}
                        className="h-12 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-900 font-black text-base border border-slate-200 flex items-center justify-center transition cursor-pointer shadow-xs"
                      >
                        {letter}
                      </button>
                    ))}
                  </div>

                  {/* Row 3: Z - M */}
                  <div className="grid grid-cols-7 gap-1 px-8">
                    {'ZXCVBNM'.split('').map(letter => (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => handleNameLetter(letter)}
                        className="h-12 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-900 font-black text-base border border-slate-200 flex items-center justify-center transition cursor-pointer shadow-xs"
                      >
                        {letter}
                      </button>
                    ))}
                  </div>

                  {/* Row 4: Space, Backspace, Clear */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <button
                      type="button"
                      onClick={handleNameClear}
                      className="w-20 h-12 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-300 transition cursor-pointer uppercase shadow-xs"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNameLetter(' ')}
                      className="flex-1 h-12 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-800 font-bold text-xs border border-slate-200 transition cursor-pointer uppercase tracking-widest shadow-xs"
                    >
                      SPACE
                    </button>
                    <button
                      type="button"
                      onClick={handleNameBackspace}
                      className="w-20 h-12 rounded-xl bg-slate-100 hover:bg-rose-50 active:scale-95 text-slate-700 hover:text-rose-600 font-black text-xs border border-slate-200 flex items-center justify-center transition cursor-pointer shadow-xs"
                      title="Backspace"
                    >
                      <Delete className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Bottom Custom Name Action */}
                {nameQuery.trim().length >= 2 && (
                  <div className="pt-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCustomer({
                          customer_name: nameQuery.trim(),
                          customer_phone: phoneQuery.trim()
                        });
                        onClose();
                      }}
                      className="w-full h-11 px-4 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-xs flex items-center justify-center gap-2 uppercase tracking-wider transition active:scale-95 shadow-xs cursor-pointer"
                    >
                      <span>Use Name: {nameQuery.trim()}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: REAL-TIME MATCHES LIST (35% Width) */}
          <div className="w-[35%] flex flex-col bg-slate-100 overflow-hidden">
            {/* Results Header */}
            <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-[#1e5c4f]" />
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Matching Clients ({searchResults.length})
                </span>
              </div>
              {isSearching && (
                <span className="text-[10px] text-emerald-800 font-bold animate-pulse">
                  Searching...
                </span>
              )}
            </div>

            {/* Results Cards List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {searchResults.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <User className="w-10 h-10 mb-2 stroke-[1.5] text-slate-400" />
                  <p className="font-bold text-xs text-slate-600">
                    {activeTab === 'phone'
                      ? phoneQuery
                        ? 'No client matching this phone'
                        : 'Type phone digits on keypad'
                      : nameQuery
                      ? 'No client matching this name'
                      : 'Type client name on keyboard'}
                  </p>
                  {(phoneQuery || nameQuery) && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Tap the button below the keyboard to use this as a guest.
                    </p>
                  )}
                </div>
              ) : (
                searchResults.map(c => (
                  <div
                    key={c.id || c.customer_phone}
                    onClick={() => {
                      onSelectCustomer(c);
                      onClose();
                    }}
                    className="p-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-[#1e5c4f] transition cursor-pointer flex items-center justify-between gap-3 group active:scale-98 shadow-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm truncate group-hover:text-[#1e5c4f] transition">
                          {c.customer_name}
                        </span>
                        {c.category && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold uppercase">
                            {c.category}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{c.customer_phone || 'No phone recorded'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCustomer(c);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#1e5c4f] group-hover:bg-[#16473D] text-white font-black text-xs transition flex items-center gap-1 shadow-xs flex-shrink-0 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Select</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
