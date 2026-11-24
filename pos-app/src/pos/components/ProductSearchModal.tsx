import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Delete, Plus, Check, Utensils, AlertCircle, Sparkles } from 'lucide-react';
import Fuse from 'fuse.js';
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

// Normalize accents/diacritics and symbols for robust matching
function normalizeSearchText(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Levenshtein distance for fuzzy typo matching
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }
  return d[m][n];
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

  // Fuse.js search engine instance for fuzzy matching across all categories
  const fuseInstance = useMemo(() => {
    return new Fuse(combinedPool, {
      keys: [
        { name: 'name', weight: 0.75 },
        { name: 'category_name', weight: 0.15 },
        { name: 'description', weight: 0.1 }
      ],
      threshold: 0.4,
      distance: 100,
      ignoreLocation: true,
      minMatchCharLength: 2,
      shouldSort: true
    });
  }, [combinedPool]);

  // Intelligent Search with tokenized fuzzy matching (e.g. "Pan" -> "Pain", "pain chocolat" -> "Pain au chocolat")
  // Returns empty array when query is empty (as requested: do not show all items on open)
  const filteredProducts = useMemo(() => {
    const rawQ = searchQuery.trim();
    if (!rawQ) return [];

    const normQ = normalizeSearchText(rawQ);
    const qTokens = normQ.split(/\s+/).filter(Boolean);

    // Fuse.js matches
    const fuseMap = new Map<string, { score: number; rank: number }>();
    if (fuseInstance) {
      const fuseResults = fuseInstance.search(normQ);
      fuseResults.forEach((r, idx) => {
        fuseMap.set(String(r.item.id), { score: r.score ?? 0.5, rank: idx });
      });
    }

    const scored: { item: PosProduct; score: number }[] = [];

    for (const item of combinedPool) {
      const normName = normalizeSearchText(item.name);
      const normCat = normalizeSearchText(item.category_name);
      const normDesc = normalizeSearchText(item.description);
      const itemWords = (normName + ' ' + normCat).split(/[\s\-_,.:;'/+()]+/).filter(Boolean);

      let tokenMatchScore = 0;
      let allTokensMatched = true;

      for (const qToken of qTokens) {
        let bestTokenScore = 999;
        for (const iWord of itemWords) {
          if (iWord === qToken) {
            bestTokenScore = 0;
            break;
          }
          if (iWord.startsWith(qToken)) {
            bestTokenScore = Math.min(bestTokenScore, 0.1);
          } else if (iWord.includes(qToken)) {
            bestTokenScore = Math.min(bestTokenScore, 0.25);
          } else {
            // Typo / fuzzy tolerance (e.g. "pan" -> "pain")
            const maxDist = qToken.length <= 4 ? 1 : (qToken.length <= 7 ? 2 : 3);
            const dist = levenshteinDistance(qToken, iWord);
            if (dist <= maxDist) {
              bestTokenScore = Math.min(bestTokenScore, 0.4 + dist * 0.2);
            }
          }
        }

        if (bestTokenScore >= 999) {
          allTokensMatched = false;
          break;
        } else {
          tokenMatchScore += bestTokenScore;
        }
      }

      const fuseInfo = fuseMap.get(String(item.id));
      if (allTokensMatched || fuseInfo) {
        let finalScore = allTokensMatched ? tokenMatchScore : 10;
        // Prioritize exact substring or prefix in product name
        if (normName.includes(normQ)) finalScore -= 2.0;
        if (normName.startsWith(normQ)) finalScore -= 1.0;
        if (fuseInfo) finalScore += (fuseInfo.score || 0) * 2;
        scored.push({ item, score: finalScore });
      }
    }

    scored.sort((a, b) => a.score - b.score || a.item.name.length - b.item.name.length);
    return scored.map(s => s.item);
  }, [combinedPool, searchQuery, fuseInstance]);

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
                  Intelligent Search
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Fuzzy search across all categories (e.g. &ldquo;Pan&rdquo; finds &ldquo;Pain&rdquo;, &ldquo;pain chocolat&rdquo; finds &ldquo;Pain au chocolat&rdquo;)
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
                  placeholder="Type product name (e.g. pan, burger)..."
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
                  {searchQuery.trim() === ''
                    ? 'Start typing to search all categories...'
                    : `${filteredProducts.length} matching item${filteredProducts.length === 1 ? '' : 's'}`}
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

          {/* RIGHT COLUMN: SCROLLABLE PRODUCT RESULTS (NO CATEGORY PILLS, DEFAULTS TO ALL CATEGORIES) */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#F5F6F4]">
            {/* Product Results Area */}
            <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
              {/* STATE 1: Empty Query -> Welcoming prompt, no list of all items */}
              {searchQuery.trim() === '' ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 select-none">
                  <div className="w-16 h-16 rounded-2xl bg-[#1e5c4f]/10 border border-[#1e5c4f]/20 flex items-center justify-center text-[#1e5c4f] mb-4 shadow-inner">
                    <Search className="w-8 h-8" />
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-800 mb-1">
                    Search Across All Menu Categories
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mb-5 leading-relaxed">
                    Type a dish name, bread, beverage, or keyword on the keyboard. Typo-tolerant search will find items instantly.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 max-w-md">
                    {['Pain', 'Croissant', 'Baguette', 'Burger', 'Coffee', 'Salad'].map(suggestion => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setSearchQuery(suggestion);
                          inputRef.current?.focus();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-slate-700 hover:text-[#1e5c4f] font-bold text-xs border border-slate-200 hover:border-emerald-300 transition cursor-pointer shadow-xs active:scale-95"
                      >
                        🔍 {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : filteredProducts.length === 0 ? (
                /* STATE 2: Query entered, but no matching products */
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-14 h-14 rounded-full bg-slate-200/80 flex items-center justify-center text-slate-400 mb-3">
                    <Utensils className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-black text-slate-800 mb-1">No products found</h3>
                  <p className="text-xs text-slate-500 max-w-sm">
                    No menu items matched &ldquo;{searchQuery}&rdquo;. Try another spelling or search keyword.
                  </p>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="mt-3 px-4 py-2 rounded-xl bg-[#1e5c4f] text-white font-bold text-xs transition active:scale-95 cursor-pointer shadow-xs"
                  >
                    Clear Search
                  </button>
                </div>
              ) : (
                /* STATE 3: Query entered with matching results */
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
                {searchQuery.trim() === '' ? (
                  <span>Ready to search across <strong className="text-slate-900 font-black">{combinedPool.length}</strong> menu products</span>
                ) : (
                  <span>Showing <strong className="text-slate-900 font-black">{filteredProducts.length}</strong> matching of <strong className="text-slate-900 font-black">{combinedPool.length}</strong> menu products</span>
                )}
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
