import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Delete, Plus, Check, Utensils, AlertCircle, Layers, Sparkles } from 'lucide-react';
import { supabase } from '../../api/supabase';
import type { PosProduct } from '../services/posCatalogService';

export interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: PosProduct | any) => void;
  productsCatalog: PosProduct[];
  restaurantId?: string;
  conceptId?: string;
  isProduct86d?: (idOrProduct: any) => boolean;
  currencySymbol?: string;
}

export const ProductSearchModal: React.FC<ProductSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectProduct,
  productsCatalog = [],
  restaurantId,
  conceptId,
  isProduct86d,
  currencySymbol = '$'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [dbExtraProducts, setDbExtraProducts] = useState<PosProduct[]>([]);
  const [isSearchingDb, setIsSearchingDb] = useState(false);
  const [recentAddedId, setRecentAddedId] = useState<string | number | null>(null);
  const [showKeyboard, setShowKeyboard] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<any>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedCategory('ALL');
      setDbExtraProducts([]);
      setRecentAddedId(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Search entire database (menu products even if not configured on POS screens)
  useEffect(() => {
    if (!isOpen || !restaurantId || searchQuery.trim().length < 2) {
      setDbExtraProducts([]);
      setIsSearchingDb(false);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearchingDb(true);
      try {
        const queryTerm = searchQuery.trim();
        const { data, error } = await supabase
          .from('products')
          .select('id, name, price, unit_price_usd, category_id, status, is_active, concept_id, description, image_url')
          .eq('restaurant_id', restaurantId)
          .ilike('name', `%${queryTerm}%`)
          .limit(40);

        if (!error && Array.isArray(data)) {
          // Identify items that are NOT in productsCatalog
          const catalogIdSet = new Set(productsCatalog.map(p => String(p.id)));
          const extras: PosProduct[] = data
            .filter(item => !catalogIdSet.has(String(item.id)) && item.is_active !== false)
            .map(item => ({
              id: item.id,
              master_product_id: item.id,
              name: item.name,
              description: item.description || '',
              unit_price_usd: Number((item.price !== null && item.price !== undefined && Number(item.price) > 0) ? item.price : (item.unit_price_usd || item.price || 0)),
              image_url: item.image_url || '',
              category_id: item.category_id,
              category_name: 'Menu Item',
              concept_id: item.concept_id || conceptId,
              status: item.status || 'Available',
              customizations: []
            }));
          setDbExtraProducts(extras);
        }
      } catch (err) {
        console.warn('Error querying full database products for POS search:', err);
      } finally {
        setIsSearchingDb(false);
      }
    }, 250);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, isOpen, restaurantId, productsCatalog, conceptId]);

  // Combined product pool: loaded catalog + database extras
  const combinedPool = useMemo(() => {
    if (dbExtraProducts.length === 0) return productsCatalog;
    const seen = new Set<string>();
    const list: PosProduct[] = [];
    for (const p of productsCatalog) {
      seen.add(String(p.id));
      list.push(p);
    }
    for (const p of dbExtraProducts) {
      if (!seen.has(String(p.id))) {
        seen.add(String(p.id));
        list.push(p);
      }
    }
    return list;
  }, [productsCatalog, dbExtraProducts]);

  // Filter products by search term and selected category
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return combinedPool.filter(product => {
      // Category filter
      if (selectedCategory !== 'ALL') {
        const catName = (product.category_name || '').toLowerCase();
        if (catName !== selectedCategory.toLowerCase()) return false;
      }

      // Query filter
      if (!q) return true;
      const nameMatch = (product.name || '').toLowerCase().includes(q);
      const catMatch = (product.category_name || '').toLowerCase().includes(q);
      const descMatch = (product.description || '').toLowerCase().includes(q);
      const idMatch = String(product.id) === q;
      return nameMatch || catMatch || descMatch || idMatch;
    });
  }, [combinedPool, searchQuery, selectedCategory]);

  // Extract unique categories for quick filter chips
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    combinedPool.forEach(p => {
      if (p.category_name && p.category_name.trim()) {
        cats.add(p.category_name.trim());
      }
    });
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  }, [combinedPool]);

  // Touch Keyboard Handlers
  const handleKeyClick = (char: string) => {
    setSearchQuery(prev => prev + char);
    inputRef.current?.focus();
  };

  const handleBackspace = () => {
    setSearchQuery(prev => prev.slice(0, -1));
    inputRef.current?.focus();
  };

  const handleClear = () => {
    setSearchQuery('');
    inputRef.current?.focus();
  };

  const handleProductTap = (product: PosProduct) => {
    const is86 = isProduct86d ? isProduct86d(product.id || product) : false;
    const isUnavail = product.status === 'Unavailable Today' || product.status === 'OUT_OF_STOCK' || is86;
    if (isUnavail) {
      alert(`⚠️ "${product.name}" is currently unavailable or 86'd.`);
      return;
    }

    setRecentAddedId(product.id);
    setTimeout(() => setRecentAddedId(null), 1200);

    onSelectProduct(product);

    // If product requires customization/modifiers, close search so modifier modal can display clearly
    if (product.customizations && product.customizations.length > 0) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-2 sm:p-4 select-none animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white w-full max-w-6xl h-[94vh] sm:h-[88vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* HEADER BAR */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-wide">Menu Product Search</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Full Catalog
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Search all menu products across categories, even if not pinned to POS screens
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowKeyboard(!showKeyboard)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer border border-slate-700"
              title={showKeyboard ? "Hide On-Screen Keyboard" : "Show On-Screen Keyboard"}
            >
              <span>⌨️</span>
              <span>{showKeyboard ? 'Hide Keys' : 'Show Keys'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-rose-500 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer active:scale-95"
              title="Close Search (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MAIN BODY: 2-COLUMN SPLIT (KEYBOARD & INPUT ON LEFT, RESULTS ON RIGHT) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 bg-[#F5F6F4]">
          {/* LEFT COLUMN: SEARCH INPUT & TOUCH KEYBOARD */}
          <div className={`${showKeyboard ? 'w-full md:w-[50%] lg:w-[46%]' : 'w-full md:w-[380px]'} flex flex-col border-b md:border-b-0 md:border-r border-slate-200 bg-white p-3 sm:p-4 shrink-0 overflow-y-auto`}>
            {/* SEARCH INPUT BAR */}
            <div className="mb-3">
              <div className="flex items-center gap-2 bg-slate-50 border-2 border-slate-300 focus-within:border-[#1e5c4f] focus-within:bg-white rounded-2xl px-3 py-2 sm:py-2.5 transition shadow-inner">
                <Search className="w-5 h-5 text-[#1e5c4f] shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Type product name, category, or code..."
                  className="flex-1 bg-transparent text-slate-900 font-black text-base sm:text-lg placeholder-slate-400 focus:outline-none tracking-wide"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                    title="Clear query"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mt-1.5 px-1 text-[11px] text-slate-500 font-bold">
                <span>
                  {filteredProducts.length} matching item{filteredProducts.length === 1 ? '' : 's'}
                </span>
                {isSearchingDb && (
                  <span className="text-amber-600 flex items-center gap-1 animate-pulse">
                    <Sparkles className="w-3 h-3" />
                    Searching full database…
                  </span>
                )}
              </div>
            </div>

            {/* ON-SCREEN TOUCH KEYBOARD */}
            {showKeyboard && (
              <div className="flex-1 flex flex-col justify-center gap-1.5 my-auto">
                {/* Number Row (0-9) */}
                <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
                  {'1234567890'.split('').map(digit => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeyClick(digit)}
                      className="h-10 sm:h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-900 font-black text-sm sm:text-base border border-slate-300 flex items-center justify-center transition cursor-pointer shadow-xs"
                    >
                      {digit}
                    </button>
                  ))}
                </div>

                {/* Letters Row 1: Q - P */}
                <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
                  {'QWERTYUIOP'.split('').map(letter => (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => handleKeyClick(letter)}
                      className="h-10 sm:h-12 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-900 font-black text-sm sm:text-base border border-slate-300 flex items-center justify-center transition cursor-pointer shadow-xs"
                    >
                      {letter}
                    </button>
                  ))}
                </div>

                {/* Letters Row 2: A - L */}
                <div className="grid grid-cols-9 gap-1 sm:gap-1.5 px-2 sm:px-3">
                  {'ASDFGHJKL'.split('').map(letter => (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => handleKeyClick(letter)}
                      className="h-10 sm:h-12 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-900 font-black text-sm sm:text-base border border-slate-300 flex items-center justify-center transition cursor-pointer shadow-xs"
                    >
                      {letter}
                    </button>
                  ))}
                </div>

                {/* Letters Row 3: Z - M + Special Menu Characters */}
                <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
                  {['Z', 'X', 'C', 'V', 'B', 'N', 'M', '.', '&', '/'].map(char => (
                    <button
                      key={char}
                      type="button"
                      onClick={() => handleKeyClick(char)}
                      className="h-10 sm:h-12 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-900 font-black text-sm sm:text-base border border-slate-300 flex items-center justify-center transition cursor-pointer shadow-xs"
                    >
                      {char}
                    </button>
                  ))}
                </div>

                {/* Row 4: Space, Clear, Backspace */}
                <div className="flex items-center gap-1.5 sm:gap-2 mt-1">
                  <button
                    type="button"
                    onClick={handleClear}
                    className="w-16 sm:w-20 h-10 sm:h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 transition cursor-pointer uppercase shadow-xs shrink-0"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeyClick(' ')}
                    className="flex-1 h-10 sm:h-12 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-800 font-black text-xs sm:text-sm border border-slate-300 transition cursor-pointer uppercase tracking-widest shadow-xs"
                  >
                    SPACE
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="w-16 sm:w-20 h-10 sm:h-12 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 font-black text-xs border border-rose-200 flex items-center justify-center transition cursor-pointer shadow-xs shrink-0"
                    title="Backspace"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Quick Helper Note */}
            <div className="mt-3 pt-2 border-t border-slate-200 text-center">
              <span className="text-[11px] text-slate-400 font-semibold">
                Tap an item on the right to add to ticket. Physical keyboard typing is also supported.
              </span>
            </div>
          </div>

          {/* RIGHT COLUMN: CATEGORY FILTER PILLS & SCROLLABLE PRODUCT RESULTS */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#F5F6F4]">
            {/* Category Filter Horizontal Pills */}
            {availableCategories.length > 0 && (
              <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-white border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 shadow-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
                    selectedCategory === 'ALL'
                      ? 'bg-[#1e5c4f] text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  ALL CATEGORIES ({combinedPool.length})
                </button>
                {availableCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition cursor-pointer shrink-0 uppercase ${
                      selectedCategory.toLowerCase() === cat.toLowerCase()
                        ? 'bg-[#1e5c4f] text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Product Cards Grid */}
            <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-14 h-14 rounded-full bg-slate-200/80 flex items-center justify-center text-slate-400 mb-3">
                    <Utensils className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-black text-slate-800 mb-1">No products found</h3>
                  <p className="text-xs text-slate-500 max-w-sm">
                    No menu items matched &ldquo;{searchQuery}&rdquo;. Try another search keyword or clear filters.
                  </p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="mt-3 px-4 py-2 rounded-xl bg-[#1e5c4f] text-white font-bold text-xs transition active:scale-95 cursor-pointer shadow-xs"
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5">
                  {filteredProducts.map(product => {
                    const is86 = isProduct86d ? isProduct86d(product.id || product) : false;
                    const isUnavailable = product.status === 'Unavailable Today' || product.status === 'OUT_OF_STOCK' || is86;
                    const hasOptions = Boolean(product.customizations && product.customizations.length > 0);
                    const isJustAdded = recentAddedId === product.id;
                    const price = typeof (product as any).price === 'number' && (product as any).price > 0
                      ? (product as any).price
                      : (typeof product.unit_price_usd === 'number' && product.unit_price_usd > 0
                        ? product.unit_price_usd
                        : Number((product as any).price || product.unit_price_usd || 0));

                    return (
                      <div
                        key={String(product.id)}
                        onClick={() => !isUnavailable && handleProductTap(product)}
                        className={`group relative p-3 rounded-2xl border transition-all select-none text-left flex flex-col justify-between min-h-[92px] ${
                          isUnavailable
                            ? 'bg-slate-100/80 border-slate-300 opacity-60 cursor-not-allowed'
                            : isJustAdded
                            ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500 shadow-md'
                            : 'bg-white hover:bg-emerald-50/40 border-slate-200 hover:border-emerald-300 hover:shadow-md cursor-pointer active:scale-[0.98]'
                        }`}
                      >
                        {/* Top: Category & Status Badges */}
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg truncate max-w-[140px]">
                            {product.category_name || 'General'}
                          </span>

                          <div className="flex items-center gap-1 shrink-0">
                            {hasOptions && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                                Modifiers
                              </span>
                            )}
                            {isUnavailable ? (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-0.5">
                                <AlertCircle className="w-2.5 h-2.5" />
                                86&apos;d
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Middle: Product Name & Description */}
                        <div className="mb-2">
                          <h4 className="text-sm font-black text-slate-900 group-hover:text-[#1e5c4f] transition line-clamp-2 leading-snug">
                            {product.name}
                          </h4>
                          {product.description && (
                            <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                              {product.description}
                            </p>
                          )}
                        </div>

                        {/* Bottom: Price & Add Action */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                          <div className="text-sm font-black text-[#1e5c4f]">
                            {currencySymbol}{price.toFixed(2)}
                          </div>

                          {isJustAdded ? (
                            <span className="flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg animate-in zoom-in-90">
                              <Check className="w-3.5 h-3.5" />
                              Added!
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isUnavailable}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isUnavailable) handleProductTap(product);
                              }}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black transition ${
                                isUnavailable
                                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-[#1e5c4f] hover:bg-[#16473D] text-white active:scale-95 cursor-pointer shadow-xs'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* FOOTER BAR: SUMMARY & CLOSE */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-500 font-semibold">
                Showing <strong className="text-slate-900 font-black">{filteredProducts.length}</strong> of{' '}
                <strong className="text-slate-900 font-black">{combinedPool.length}</strong> menu products
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider transition active:scale-95 cursor-pointer shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
