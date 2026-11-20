import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getRestaurantId } from '../api/client';
import { fetchPosCatalog } from '../pos/services/posCatalogService';
import { fetchPosScreens, savePosScreens, generateDefaultScreens, TILE_COLORS, calculateDynamicGrid, getGridButtonDensity } from '../pos/services/posScreenService';
import { KNOWN_CONCEPT_PROFILES } from '../pos/services/posWorkspaceService';
import type { PosScreen, PosScreenButton } from '../pos/types/posScreen';
import { 
  Layers, Plus, Trash2, Edit3, ArrowLeft, Save, RefreshCw, 
  FolderPlus, GripVertical, Check, AlertCircle, Grid, Search, CheckSquare, Square
} from 'lucide-react';

export default function PosScreenBuilderScreen({ user }: { user?: any }) {
  const navigate = useNavigate();
  const currentRestaurantId = user?.restaurant_id || getRestaurantId() || '79256f11-a9f8-4fec-901d-69baf929762d';

  const getInitialConceptId = (): string => {
    try {
      if (typeof window !== 'undefined') {
        const fullUrl = window.location.href;
        const match = fullUrl.match(/[?&]concept=([a-zA-Z0-9_-]+)/i);
        if (match && match[1]) {
          const reqCode = match[1].toUpperCase();
          const target = Object.values(KNOWN_CONCEPT_PROFILES).find(
            c => c.code === reqCode || c.receipt_prefix === reqCode || c.id === match[1]
          );
          if (target) return target.id;
        }
        const savedState = localStorage.getItem('flow_pos_terminal_state');
        if (savedState) {
          const parsed = JSON.parse(savedState);
          if (parsed.activeConcept?.id) return parsed.activeConcept.id;
        }
      }
    } catch {}
    return '00000000-0000-0000-0000-000000000001';
  };

  const [activeConceptId, setActiveConceptId] = useState<string>(getInitialConceptId);
  const activeConcept = KNOWN_CONCEPT_PROFILES[activeConceptId] || KNOWN_CONCEPT_PROFILES['00000000-0000-0000-0000-000000000001'];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [screens, setScreens] = useState<PosScreen[]>([]);
  const [activeScreenId, setActiveScreenId] = useState<string>('root');

  const [isAddScreenModalOpen, setIsAddScreenModalOpen] = useState(false);
  const [newScreenName, setNewScreenName] = useState('');
  const [newScreenIsRoot, setNewScreenIsRoot] = useState(false);

  const [isAddButtonModalOpen, setIsAddButtonModalOpen] = useState(false);
  const [editingButtonIndex, setEditingButtonIndex] = useState<number | null>(null);
  const [btnType, setBtnType] = useState<'screen' | 'product'>('product');
  const [btnLabel, setBtnLabel] = useState('');
  const [btnTargetScreenId, setBtnTargetScreenId] = useState('');
  const [btnProductId, setBtnProductId] = useState<string | number>('');
  const [btnCategoryFilter, setBtnCategoryFilter] = useState<string>('all');
  const [btnColor, setBtnColor] = useState('slate');

  // Drag-and-drop state for screen buttons
  const [draggedBtnIndex, setDraggedBtnIndex] = useState<number | null>(null);
  const [dragOverBtnIndex, setDragOverBtnIndex] = useState<number | null>(null);

  // Bulk Add Products Modal State
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [bulkSelectedProductIds, setBulkSelectedProductIds] = useState<Set<string | number>>(new Set());
  const [bulkSearchQuery, setBulkSearchQuery] = useState('');
  const [bulkCategoryFilter, setBulkCategoryFilter] = useState<string>('all');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const catalog = await fetchPosCatalog(currentRestaurantId, undefined, activeConceptId);
        setCategories(catalog.categories || []);
        setProducts(catalog.products || []);

        const loadedScreens = await fetchPosScreens(
          currentRestaurantId,
          catalog.categories,
          catalog.products,
          activeConceptId
        );
        setScreens(loadedScreens);

        const rootScreen = loadedScreens.find((s) => s.isRoot) || loadedScreens[0];
        if (rootScreen) {
          setActiveScreenId(rootScreen.id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load POS screen configuration');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentRestaurantId, activeConceptId]);

  const activeScreen = screens.find((s) => s.id === activeScreenId) || screens[0];
  const computedGrid = activeScreen
    ? calculateDynamicGrid(activeScreen.buttons.length, activeScreen.gridCols, activeScreen.gridRows)
    : { cols: 4, rows: 5, totalSlots: 20 };
  const gridDensity = getGridButtonDensity(computedGrid.cols, computedGrid.rows);

  const sortedCategories = [...categories].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
  );

  const sortedAllProducts = [...products].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
  );

  const filteredAddBtnProducts = sortedAllProducts.filter((p) => {
    if (btnCategoryFilter === 'all') return true;
    return (
      String(p.category_id) === String(btnCategoryFilter) ||
      (p.category && String(p.category).toLowerCase() === btnCategoryFilter.toLowerCase())
    );
  });

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      const res = await savePosScreens(currentRestaurantId, screens, activeConceptId);
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setError(res.error || 'Failed to save changes');
      }
    } catch (err: any) {
      setError(err.message || 'Error saving changes');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (!window.confirm(`Reset all screens to default menu structure for ${activeConcept.name}? This will rebuild screens from your current categories and dishes.`)) {
      return;
    }
    const defaultScreens = generateDefaultScreens(categories, products);
    setScreens(defaultScreens);
    setActiveScreenId('root');
  };

  const handleCreateScreen = () => {
    if (!newScreenName.trim()) return;
    const newId = 'screen_' + Date.now();
    const updatedScreens = screens.map((s) => newScreenIsRoot ? { ...s, isRoot: false } : s);
    const newScreen: PosScreen = {
      id: newId,
      name: newScreenName.trim(),
      isRoot: newScreenIsRoot,
      buttons: []
    };
    setScreens([...updatedScreens, newScreen]);
    setActiveScreenId(newId);
    setNewScreenName('');
    setNewScreenIsRoot(false);
    setIsAddScreenModalOpen(false);
  };

  const handleDeleteScreen = (screenIdToDelete: string) => {
    if (screens.length <= 1) {
      alert('Cannot delete the last remaining screen.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this screen?')) return;
    const remaining = screens.filter((s) => s.id !== screenIdToDelete);
    if (!remaining.some((s) => s.isRoot) && remaining.length > 0) {
      remaining[0].isRoot = true;
    }
    setScreens(remaining);
    setActiveScreenId(remaining[0].id);
  };

  const handleOpenAddButtonModal = (editIdx?: number) => {
    if (editIdx !== undefined && editIdx >= 0) {
      const btn = activeScreen.buttons[editIdx];
      setEditingButtonIndex(editIdx);
      setBtnType(btn.type);
      setBtnLabel(btn.label);
      setBtnTargetScreenId(btn.targetScreenId || '');
      setBtnProductId(btn.productId || '');
      const existingProd = products.find((p) => String(p.id) === String(btn.productId));
      setBtnCategoryFilter(existingProd?.category_id ? String(existingProd.category_id) : 'all');
      setBtnColor(btn.color || 'slate');
    } else {
      setEditingButtonIndex(null);
      setBtnType('product');
      setBtnLabel('');
      setBtnTargetScreenId(screens.find((s) => s.id !== activeScreen.id)?.id || '');
      setBtnCategoryFilter('all');
      setBtnProductId(sortedAllProducts[0]?.id || '');
      setBtnColor('slate');
    }
    setIsAddButtonModalOpen(true);
  };

  const handleSaveButton = () => {
    if (!activeScreen) return;
    let labelToUse = btnLabel.trim();
    if (!labelToUse) {
      if (btnType === 'product') {
        const prod = products.find((p) => String(p.id) === String(btnProductId));
        labelToUse = prod?.name || 'Dish';
      } else {
        const scr = screens.find((s) => s.id === btnTargetScreenId);
        labelToUse = scr?.name || 'Subscreen';
      }
    }

    const newBtn: PosScreenButton = {
      id: editingButtonIndex !== null ? activeScreen.buttons[editingButtonIndex].id : 'btn_' + Date.now(),
      label: labelToUse,
      type: btnType,
      targetScreenId: btnType === 'screen' ? btnTargetScreenId : undefined,
      productId: btnType === 'product' ? btnProductId : undefined,
      color: btnColor,
      sortOrder: editingButtonIndex !== null ? editingButtonIndex : activeScreen.buttons.length
    };

    let updatedButtons = [...activeScreen.buttons];
    if (editingButtonIndex !== null) {
      updatedButtons[editingButtonIndex] = newBtn;
    } else {
      updatedButtons.push(newBtn);
    }

    const updatedScreens = screens.map((s) => (s.id === activeScreen.id ? { ...s, buttons: updatedButtons } : s));
    setScreens(updatedScreens);
    setIsAddButtonModalOpen(false);
  };

  const handleDeleteButton = async (btnIndex: number) => {
    if (!activeScreen) return;
    const btnToDelete = activeScreen.buttons[btnIndex];
    const btnLabelName = btnToDelete?.label || 'this button';
    if (!window.confirm(`Are you sure you want to delete "${btnLabelName}" from "${activeScreen.name}"?`)) {
      return;
    }
    const updatedButtons = activeScreen.buttons
      .filter((_, idx) => idx !== btnIndex)
      .map((b, i) => ({ ...b, sortOrder: i }));
    const updatedScreens = screens.map((s) => (s.id === activeScreen.id ? { ...s, buttons: updatedButtons } : s));
    setScreens(updatedScreens);
    setIsAddButtonModalOpen(false);
    setEditingButtonIndex(null);

    // Persist immediately to Supabase
    try {
      setSaving(true);
      const res = await savePosScreens(currentRestaurantId, updatedScreens, activeConceptId);
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setError(res.error || 'Failed to save changes after deletion');
      }
    } catch (err: any) {
      setError(err.message || 'Error saving changes after deletion');
    } finally {
      setSaving(false);
    }
  };

  const handleClearScreen = async () => {
    if (!activeScreen) return;
    if (activeScreen.buttons.length === 0) return;
    if (!window.confirm(`Clear all ${activeScreen.buttons.length} button(s) from "${activeScreen.name}"? This will leave the screen completely empty.`)) {
      return;
    }
    const updatedScreens = screens.map((s) => (s.id === activeScreen.id ? { ...s, buttons: [] } : s));
    setScreens(updatedScreens);

    try {
      setSaving(true);
      const res = await savePosScreens(currentRestaurantId, updatedScreens, activeConceptId);
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err: any) {
      console.error('Failed to auto-save after clear:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReorderButton = (fromIndex: number, toIndex: number) => {
    if (!activeScreen || fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= activeScreen.buttons.length || toIndex >= activeScreen.buttons.length) return;

    const updatedButtons = [...activeScreen.buttons];
    const [moved] = updatedButtons.splice(fromIndex, 1);
    updatedButtons.splice(toIndex, 0, moved);
    const reindexed = updatedButtons.map((b, i) => ({ ...b, sortOrder: i }));

    const updatedScreens = screens.map((s) => (s.id === activeScreen.id ? { ...s, buttons: reindexed } : s));
    setScreens(updatedScreens);
  };

  const handleUpdateGridDimensions = (cols?: number, rows?: number) => {
    if (!activeScreen) return;
    const updatedScreens = screens.map((s) =>
      s.id === activeScreen.id ? { ...s, gridCols: cols, gridRows: rows } : s
    );
    setScreens(updatedScreens);
  };

  const handleOpenBulkAddModal = () => {
    setBulkSelectedProductIds(new Set());
    setBulkSearchQuery('');
    setBulkCategoryFilter('all');
    setIsBulkAddModalOpen(true);
  };

  const handleToggleBulkProduct = (prodId: string | number) => {
    setBulkSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(prodId)) next.delete(prodId);
      else next.add(prodId);
      return next;
    });
  };

  const filteredBulkProducts = sortedAllProducts.filter((p) => {
    const matchesCategory =
      bulkCategoryFilter === 'all' ||
      String(p.category_id) === String(bulkCategoryFilter) ||
      (p.category && String(p.category).toLowerCase() === bulkCategoryFilter.toLowerCase());
    const matchesSearch =
      !bulkSearchQuery.trim() || p.name?.toLowerCase().includes(bulkSearchQuery.toLowerCase().trim());
    return matchesCategory && matchesSearch;
  });

  const handleSelectAllBulkFiltered = () => {
    const ids = filteredBulkProducts.map((p) => p.id);
    setBulkSelectedProductIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleConfirmBulkAdd = () => {
    if (!activeScreen) return;
    const selectedProductsList = sortedAllProducts.filter((p) => bulkSelectedProductIds.has(p.id));
    if (selectedProductsList.length === 0) {
      setIsBulkAddModalOpen(false);
      return;
    }

    const newButtons: PosScreenButton[] = selectedProductsList.map((p, idx) => ({
      id: 'btn_prod_' + p.id + '_' + Date.now() + '_' + idx,
      label: p.name || 'Dish',
      type: 'product',
      productId: p.id,
      color: 'slate',
      sortOrder: activeScreen.buttons.length + idx
    }));

    const updatedScreens = screens.map((s) =>
      s.id === activeScreen.id ? { ...s, buttons: [...s.buttons, ...newButtons] } : s
    );
    setScreens(updatedScreens);
    setIsBulkAddModalOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex items-center gap-3 text-slate-500">
          <span className="w-5 h-5 border-2 border-[#1e5c4f] border-t-transparent rounded-full animate-spin"></span>
          <span className="text-sm font-semibold">Loading POS screen layouts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-900 font-sans">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
            title="Go Back"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <Layers className="text-[#1e5c4f]" />
              <span>POS Screen Layout Builder</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Customize touch screens and product tiles for <strong className="text-slate-800">{activeConcept.name} ({activeConcept.receipt_prefix})</strong>
            </p>
          </div>
        </div>

        {/* Commercial Concept Workspace Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
          {Object.values(KNOWN_CONCEPT_PROFILES).map((c) => {
            const isSelected = c.id === activeConceptId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveConceptId(c.id);
                  window.location.hash = `#/pos-screens?concept=${c.id}`;
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                style={isSelected ? { backgroundColor: c.primary_color } : {}}
              >
                <span>{c.name}</span>
                <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${isSelected ? 'bg-black/30 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {c.receipt_prefix}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition"
            title="Rebuild screens from standard menu sections and dishes"
          >
            <RefreshCw size={14} />
            <span>Reset to Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl active:scale-98 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer hover:brightness-110"
            style={{ backgroundColor: activeConcept.primary_color }}
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Saving {activeConcept.name}...</span>
              </>
            ) : saveSuccess ? (
              <>
                <Check size={16} />
                <span>Saved {activeConcept.name}!</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Save {activeConcept.name} Screens</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col h-[calc(100vh-220px)] min-h-[500px] shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">Screens ({screens.length})</span>
            <button
              type="button"
              onClick={() => setIsAddScreenModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-[#1e5c4f] hover:bg-emerald-100 border border-emerald-200 transition flex items-center gap-1 text-xs font-bold"
              title="Create New Screen"
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1">
            {screens.map((screen) => {
              const isActive = screen.id === activeScreenId;
              return (
                <div
                  key={screen.id}
                  onClick={() => setActiveScreenId(screen.id)}
                  className={`p-3 rounded-xl transition flex items-center justify-between gap-2 cursor-pointer border ${
                    isActive
                      ? 'bg-emerald-50 border-[#1e5c4f] text-[#1e5c4f] shadow-sm ring-2 ring-emerald-500/20'
                      : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="truncate flex-1">
                    <div className="font-bold text-sm truncate flex items-center gap-1.5">
                      <span>{screen.name}</span>
                      {screen.isRoot && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1e5c4f] text-white font-black">
                          HOME
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {screen.buttons.length} button{screen.buttons.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {!screen.isRoot && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteScreen(screen.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Delete Screen"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col h-[calc(100vh-220px)] min-h-[500px] shadow-sm">
          {activeScreen ? (
            <>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black text-slate-900">{activeScreen.name}</h2>
                  {activeScreen.isRoot ? (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                      Root / First Screen
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = screens.map((s) => ({
                          ...s,
                          isRoot: s.id === activeScreen.id
                        }));
                        setScreens(updated);
                      }}
                      className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:text-[#1e5c4f] hover:bg-emerald-50 border border-slate-200 font-semibold transition"
                    >
                      Set as First Screen
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {activeScreen.buttons.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearScreen}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                      title="Clear all buttons from this screen"
                    >
                      <Trash2 size={14} className="text-rose-600" />
                      <span>Clear Screen</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleOpenBulkAddModal}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                    title="Bulk Add Products to this screen"
                  >
                    <CheckSquare size={14} className="text-[#1e5c4f]" />
                    <span>Bulk Add Dishes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenAddButtonModal()}
                    className="px-3.5 py-1.5 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] active:scale-95 text-white text-xs font-black flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <Plus size={16} />
                    <span>Add Button</span>
                  </button>
                </div>
              </div>

              {/* Grid Dimensions & Density Control Bar */}
              <div className="py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 my-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700">
                    <Grid size={15} className="text-[#1e5c4f]" />
                    <span>Grid Matrix:</span>
                  </div>

                  {/* Columns Selector (4 to 7 or Auto) */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-slate-500 font-medium text-[11px]">Cols (H):</label>
                    <select
                      value={activeScreen.gridCols || ''}
                      onChange={(e) => handleUpdateGridDimensions(e.target.value ? Number(e.target.value) : undefined, activeScreen.gridRows)}
                      className="bg-white border border-slate-300 text-slate-900 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#1e5c4f]"
                    >
                      <option value="">Auto ({computedGrid.cols})</option>
                      <option value="4">4 Cols (Min)</option>
                      <option value="5">5 Cols</option>
                      <option value="6">6 Cols</option>
                      <option value="7">7 Cols (Max)</option>
                    </select>
                  </div>

                  {/* Rows Selector (5 to 7 or Auto) */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-slate-500 font-medium text-[11px]">Rows (V):</label>
                    <select
                      value={activeScreen.gridRows || ''}
                      onChange={(e) => handleUpdateGridDimensions(activeScreen.gridCols, e.target.value ? Number(e.target.value) : undefined)}
                      className="bg-white border border-slate-300 text-slate-900 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#1e5c4f]"
                    >
                      <option value="">Auto ({computedGrid.rows})</option>
                      <option value="5">5 Rows (Min)</option>
                      <option value="6">6 Rows</option>
                      <option value="7">7 Rows (Max)</option>
                    </select>
                  </div>

                  {/* Capacity & Matrix Info */}
                  <span className="px-2 py-0.5 rounded-full bg-white text-slate-700 font-mono text-[11px] border border-slate-200">
                    {computedGrid.cols} × {computedGrid.rows} ({computedGrid.totalSlots} slots)
                  </span>
                </div>

                <div className="flex items-center gap-2 text-slate-500 font-medium">
                  <span>
                    {activeScreen.buttons.length} tiles configured
                  </span>
                  {activeScreen.buttons.length > computedGrid.totalSlots && (
                    <span className="text-amber-700 font-semibold text-[11px] flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      <AlertCircle size={12} />
                      Scrolls on touch
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pt-1 pb-4">
                {activeScreen.buttons.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <FolderPlus size={36} className="text-slate-400 mb-2" />
                    <p className="text-sm font-bold text-slate-700">This screen has no buttons yet</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Add buttons linking to sub-screens (e.g. Starters, Drinks) or specific menu dishes.
                    </p>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={handleOpenBulkAddModal}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold"
                      >
                        Bulk Add Dishes
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenAddButtonModal()}
                        className="px-3.5 py-2 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] text-white text-xs font-black shadow-sm"
                      >
                        Add Single Button
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${computedGrid.cols}, minmax(0, 1fr))`,
                      gap: gridDensity.gap
                    }}
                  >
                    {activeScreen.buttons.map((btn, idx) => {
                      const colorTheme = TILE_COLORS.find((c) => c.id === btn.color) || TILE_COLORS[0];
                      const isDragging = draggedBtnIndex === idx;
                      const isDragOver = dragOverBtnIndex === idx && draggedBtnIndex !== idx;
                      const isSubscreen = btn.type === 'screen';
                      const matchingProd = !isSubscreen
                        ? (products.find((p) => String(p.id) === String(btn.productId)) ||
                           products.find((p) => (p.name || '').trim().toLowerCase() === (btn.label || '').trim().toLowerCase()))
                        : null;
                      const isUnavailable = !isSubscreen && (
                        !matchingProd ||
                        (matchingProd as any).is_active === false ||
                        ['deleted', 'archived', 'unavailable', 'unavailable today', 'out_of_stock'].includes(String((matchingProd as any).status || '').toLowerCase())
                      );
                      return (
                        <div
                          key={btn.id || idx}
                          draggable
                          onDragStart={(e) => {
                            setDraggedBtnIndex(idx);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', String(idx));
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (dragOverBtnIndex !== idx) {
                              setDragOverBtnIndex(idx);
                            }
                          }}
                          onDragEnter={(e) => {
                            e.preventDefault();
                            if (dragOverBtnIndex !== idx) {
                              setDragOverBtnIndex(idx);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const fromIdx = draggedBtnIndex !== null ? draggedBtnIndex : Number(e.dataTransfer.getData('text/plain'));
                            if (!Number.isNaN(fromIdx) && fromIdx !== idx) {
                              handleReorderButton(fromIdx, idx);
                            }
                            setDraggedBtnIndex(null);
                            setDragOverBtnIndex(null);
                          }}
                          onDragEnd={() => {
                            setDraggedBtnIndex(null);
                            setDragOverBtnIndex(null);
                          }}
                          onClick={() => handleOpenAddButtonModal(idx)}
                          title={isUnavailable ? `⚠️ "${btn.label}" is unavailable` : "Click to edit, or drag to reorder"}
                          className={`relative group rounded-xl border overflow-hidden ${gridDensity.minHeight} ${gridDensity.padding} flex flex-col justify-between transition-all shadow-sm cursor-pointer select-none ${
                            isUnavailable ? 'bg-slate-100 border-dashed border-rose-300 opacity-60' : `${colorTheme.bg} ${colorTheme.border}`
                          } ${
                            isDragging ? 'opacity-40 scale-95' : ''
                          } ${isDragOver ? 'ring-2 ring-emerald-500 border-emerald-500 scale-[1.03]' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-1 opacity-85 group-hover:opacity-100 transition">
                            <span className="text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded bg-black/10 text-slate-700 flex items-center gap-0.5">
                              <GripVertical size={10} className="text-slate-500" />
                              {btn.type === 'screen' ? '📁 Sub' : '🍽️ Dish'}
                            </span>
                            {isUnavailable && (
                              <span className="text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded bg-rose-600 text-white shadow-sm">
                                Unavailable
                              </span>
                            )}
                            <div
                              className="flex items-center gap-1 z-20"
                              onMouseDown={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                draggable={false}
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenAddButtonModal(idx);
                                }}
                                className="p-1.5 rounded-lg bg-black/10 hover:bg-black/20 text-slate-700 hover:text-slate-900 transition cursor-pointer"
                                title="Edit Button"
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                type="button"
                                draggable={false}
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDeleteButton(idx);
                                }}
                                className="p-1.5 rounded-lg bg-black/10 hover:bg-rose-600 hover:text-white text-slate-700 transition cursor-pointer"
                                title="Delete Button"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          <div className="my-auto py-1 text-center pointer-events-none">
                            <span className={`font-black ${gridDensity.fontSize} leading-tight line-clamp-2 ${isUnavailable ? 'line-through text-slate-400' : (colorTheme.text || 'text-slate-800')}`}>
                              {btn.label}
                            </span>
                          </div>

                          <div className="text-[9px] text-slate-500 font-medium text-center truncate opacity-80 pointer-events-none">
                            {btn.type === 'screen'
                              ? `Opens: ${screens.find((s) => s.id === btn.targetScreenId)?.name || 'Screen'}`
                              : 'Click or drag to move'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              Select a screen from the left to edit.
            </div>
          )}
        </div>
      </div>

      {isAddScreenModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 text-slate-900 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 mb-3">Create New Screen</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Screen Title</label>
                <input
                  type="text"
                  value={newScreenName}
                  onChange={(e) => setNewScreenName(e.target.value)}
                  placeholder="e.g. Desserts, Bar & Cocktails"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 font-medium focus:outline-none focus:border-[#1e5c4f] focus:ring-1 focus:ring-[#1e5c4f]"
                  autoFocus
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={newScreenIsRoot}
                  onChange={(e) => setNewScreenIsRoot(e.target.checked)}
                  className="w-4 h-4 rounded text-[#1e5c4f] focus:ring-[#1e5c4f]"
                />
                <span className="text-xs font-medium text-slate-700">Set as Root / First Screen</span>
              </label>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setIsAddScreenModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateScreen}
                disabled={!newScreenName.trim()}
                className="flex-1 py-2 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] text-white text-xs font-black disabled:opacity-50 transition shadow-sm"
              >
                Create Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddButtonModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 text-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">
              {editingButtonIndex !== null ? 'Edit Button' : 'Add Button to ' + activeScreen.name}
            </h3>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">Button Function</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBtnType('product')}
                  className={`py-2 rounded-xl text-xs font-black border transition ${
                    btnType === 'product'
                      ? 'bg-emerald-50 text-[#1e5c4f] border-[#1e5c4f] ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  🍽️ Product Button
                </button>
                <button
                  type="button"
                  onClick={() => setBtnType('screen')}
                  className={`py-2 rounded-xl text-xs font-black border transition ${
                    btnType === 'screen'
                      ? 'bg-emerald-50 text-[#1e5c4f] border-[#1e5c4f] ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  📁 Subscreen Link
                </button>
              </div>
            </div>

            {btnType === 'product' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Filter by Category</label>
                  <select
                    value={btnCategoryFilter}
                    onChange={(e) => {
                      const nextCat = e.target.value;
                      setBtnCategoryFilter(nextCat);
                      const nextList = sortedAllProducts.filter((p) => {
                        if (nextCat === 'all') return true;
                        return (
                          String(p.category_id) === String(nextCat) ||
                          (p.category && String(p.category).toLowerCase() === nextCat.toLowerCase())
                        );
                      });
                      if (nextList.length > 0 && !nextList.some((p) => String(p.id) === String(btnProductId))) {
                        const firstProd = nextList[0];
                        setBtnProductId(firstProd.id);
                        if (editingButtonIndex === null) {
                          setBtnLabel(firstProd.name || '');
                        }
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#1e5c4f]"
                  >
                    <option value="all">All Categories ({sortedAllProducts.length})</option>
                    {sortedCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Select Menu Item (A–Z) ({filteredAddBtnProducts.length})
                  </label>
                  <select
                    value={btnProductId}
                    onChange={(e) => {
                      setBtnProductId(e.target.value);
                      const prod = products.find((p) => String(p.id) === String(e.target.value));
                      if (prod && (editingButtonIndex === null || !btnLabel)) {
                        setBtnLabel(prod.name);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#1e5c4f]"
                  >
                    {filteredAddBtnProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {(p.category_name || p.category) ? `(${p.category_name || p.category})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Target Subscreen</label>
                <select
                  value={btnTargetScreenId}
                  onChange={(e) => {
                    setBtnTargetScreenId(e.target.value);
                    const scr = screens.find((s) => s.id === e.target.value);
                    if (scr && !btnLabel) {
                      setBtnLabel(scr.name);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#1e5c4f]"
                >
                  {[...screens]
                    .filter((s) => s.id !== activeScreen.id)
                    .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">
                Button Label (Displays only this name on POS)
              </label>
              <input
                type="text"
                value={btnLabel}
                onChange={(e) => setBtnLabel(e.target.value)}
                placeholder="Leave blank to use default name"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#1e5c4f]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">Tile Color Theme</label>
              <div className="flex flex-wrap gap-2">
                {TILE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setBtnColor(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black border transition shadow-sm ${c.bg} ${c.border} ${c.text || 'text-white'} ${
                      btnColor === c.id ? 'ring-2 ring-[#1e5c4f] scale-105' : 'opacity-85 hover:opacity-100'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              {editingButtonIndex !== null && (
                <button
                  type="button"
                  onClick={() => void handleDeleteButton(editingButtonIndex)}
                  className="py-2.5 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                  title="Delete this button from screen"
                >
                  <Trash2 size={14} />
                  <span>Delete Button</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsAddButtonModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveButton}
                className="flex-1 py-2.5 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] text-white text-xs font-black shadow-sm transition cursor-pointer"
              >
                {editingButtonIndex !== null ? 'Update Button' : 'Add Button'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Dishes Modal */}
      {isBulkAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 text-slate-900 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <CheckSquare className="text-[#1e5c4f]" size={20} />
                  Bulk Add Dishes to {activeScreen?.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Quickly select multiple dishes (sorted A–Z) to populate buttons on this screen.
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                {bulkSelectedProductIds.size} Selected
              </span>
            </div>

            {/* Filter and Search Bar */}
            <div className="py-3 flex flex-wrap items-center gap-2 border-b border-slate-200">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={bulkSearchQuery}
                  onChange={(e) => setBulkSearchQuery(e.target.value)}
                  placeholder="Search dishes by name..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#1e5c4f]"
                />
              </div>

              <select
                value={bulkCategoryFilter}
                onChange={(e) => setBulkCategoryFilter(e.target.value)}
                className="bg-white border border-slate-300 text-xs text-slate-900 rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#1e5c4f]"
              >
                <option value="all">All Categories</option>
                {sortedCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleSelectAllBulkFiltered}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 border border-slate-200 transition"
              >
                {filteredBulkProducts.length > 0 &&
                filteredBulkProducts.every((p) => bulkSelectedProductIds.has(p.id))
                  ? 'Deselect Filtered'
                  : 'Select All Filtered'}
              </button>
            </div>

            {/* Product List Grid */}
            <div className="flex-1 overflow-y-auto py-3 space-y-1.5 pr-1 min-h-[260px] max-h-[420px]">
              {filteredBulkProducts.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No dishes found matching your search or category filter.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredBulkProducts.map((p) => {
                    const isSelected = bulkSelectedProductIds.has(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleToggleBulkProduct(p.id)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition select-none ${
                          isSelected
                            ? 'bg-emerald-50 border-[#1e5c4f] text-[#1e5c4f] ring-2 ring-emerald-500/20'
                            : 'bg-slate-50/80 border-slate-200 text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div className={`p-1 rounded ${isSelected ? 'text-[#1e5c4f]' : 'text-slate-400'}`}>
                            {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                          </div>
                          <div className="truncate">
                            <div className="font-bold text-xs text-slate-900 truncate">{p.name}</div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              {p.category_name || p.category || 'Menu Item'} • ${Number(p.unit_price_usd ?? p.price ?? 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <div className="text-xs text-slate-500 font-medium">
                {bulkSelectedProductIds.size} dish{bulkSelectedProductIds.size === 1 ? '' : 'es'} will be added as buttons.
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={bulkSelectedProductIds.size === 0}
                  onClick={handleConfirmBulkAdd}
                  className="px-4 py-2 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] disabled:opacity-40 disabled:hover:bg-[#1e5c4f] text-white text-xs font-black transition shadow-sm"
                >
                  Add {bulkSelectedProductIds.size} Button{bulkSelectedProductIds.size === 1 ? '' : 's'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
