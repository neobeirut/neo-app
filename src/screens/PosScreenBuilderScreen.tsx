import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getRestaurantId } from '../api/client';
import { fetchPosCatalog } from '../pos/services/posCatalogService';
import { fetchPosScreens, savePosScreens, generateDefaultScreens, TILE_COLORS, calculateDynamicGrid, getGridButtonDensity } from '../pos/services/posScreenService';
import type { PosScreen, PosScreenButton } from '../pos/types/posScreen';
import { 
  Layers, Plus, Trash2, Edit3, ArrowLeft, Save, RefreshCw, 
  FolderPlus, MoveLeft, MoveRight, Check, AlertCircle, Grid, Search, CheckSquare, Square
} from 'lucide-react';

export default function PosScreenBuilderScreen({ user }: { user?: any }) {
  const navigate = useNavigate();
  const currentRestaurantId = user?.restaurant_id || getRestaurantId() || '4c0ed960-e459-42c4-962f-41229a2d3783';

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
  const [btnColor, setBtnColor] = useState('slate');

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
        const catalog = await fetchPosCatalog(currentRestaurantId);
        setCategories(catalog.categories || []);
        setProducts(catalog.products || []);

        const loadedScreens = await fetchPosScreens(
          currentRestaurantId,
          catalog.categories,
          catalog.products
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
  }, [currentRestaurantId]);

  const activeScreen = screens.find((s) => s.id === activeScreenId) || screens[0];
  const computedGrid = activeScreen
    ? calculateDynamicGrid(activeScreen.buttons.length, activeScreen.gridCols, activeScreen.gridRows)
    : { cols: 4, rows: 5, totalSlots: 20 };
  const gridDensity = getGridButtonDensity(computedGrid.cols, computedGrid.rows);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      const res = await savePosScreens(currentRestaurantId, screens);
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
    if (!window.confirm('Reset all screens to default menu structure? This will rebuild screens from your current categories and dishes.')) {
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
      setBtnColor(btn.color || 'slate');
    } else {
      setEditingButtonIndex(null);
      setBtnType('product');
      setBtnLabel('');
      setBtnTargetScreenId(screens.find((s) => s.id !== activeScreen.id)?.id || '');
      setBtnProductId(products[0]?.id || '');
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

  const handleDeleteButton = (btnIndex: number) => {
    if (!activeScreen) return;
    const updatedButtons = activeScreen.buttons.filter((_, idx) => idx !== btnIndex);
    const updatedScreens = screens.map((s) => (s.id === activeScreen.id ? { ...s, buttons: updatedButtons } : s));
    setScreens(updatedScreens);
  };

  const handleMoveButton = (btnIndex: number, direction: 'left' | 'right') => {
    if (!activeScreen) return;
    const targetIndex = direction === 'left' ? btnIndex - 1 : btnIndex + 1;
    if (targetIndex < 0 || targetIndex >= activeScreen.buttons.length) return;

    const updatedButtons = [...activeScreen.buttons];
    const [moved] = updatedButtons.splice(btnIndex, 1);
    updatedButtons.splice(targetIndex, 0, moved);

    const updatedScreens = screens.map((s) => (s.id === activeScreen.id ? { ...s, buttons: updatedButtons } : s));
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

  const filteredBulkProducts = products.filter((p) => {
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
    const selectedProductsList = products.filter((p) => bulkSelectedProductIds.has(p.id));
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
        <div className="flex items-center gap-3 text-slate-400">
          <span className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
          <span>Loading POS screen layouts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto text-slate-100 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
            title="Go Back"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Layers className="text-amber-500" />
              <span>POS Screen Layout Builder</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Customize touch screens, subscreens, and product tiles for the POS terminal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition"
            title="Rebuild screens from standard menu sections and dishes"
          >
            <RefreshCw size={14} />
            <span>Reset to Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                <span>Saving...</span>
              </>
            ) : saveSuccess ? (
              <>
                <Check size={16} />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Save Screens</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 bg-[#121620] border border-slate-800/80 rounded-2xl p-4 flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Screens ({screens.length})</span>
            <button
              type="button"
              onClick={() => setIsAddScreenModalOpen(true)}
              className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition flex items-center gap-1 text-xs font-bold"
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
                      ? 'bg-amber-500/15 border-amber-500/60 text-white shadow-md shadow-amber-500/10'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="truncate flex-1">
                    <div className="font-bold text-sm truncate flex items-center gap-1.5">
                      <span>{screen.name}</span>
                      {screen.isRoot && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-black">
                          HOME
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
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
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/50 transition"
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

        <div className="lg:col-span-3 bg-[#121620] border border-slate-800/80 rounded-2xl p-5 flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
          {activeScreen ? (
            <>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black text-white">{activeScreen.name}</h2>
                  {activeScreen.isRoot ? (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
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
                      className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 hover:text-amber-400 hover:bg-slate-700 transition"
                    >
                      Set as First Screen
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenBulkAddModal}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition shadow"
                    title="Bulk Add Products to this screen"
                  >
                    <CheckSquare size={14} className="text-amber-400" />
                    <span>Bulk Add Dishes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenAddButtonModal()}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-black flex items-center gap-1.5 transition shadow"
                  >
                    <Plus size={16} />
                    <span>Add Button</span>
                  </button>
                </div>
              </div>

              {/* Grid Dimensions & Density Control Bar */}
              <div className="py-2 px-3 rounded-xl bg-slate-900/80 border border-slate-800/80 my-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 font-bold text-slate-300">
                    <Grid size={15} className="text-amber-400" />
                    <span>Grid Matrix:</span>
                  </div>

                  {/* Columns Selector (4 to 7 or Auto) */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-slate-400 text-[11px]">Cols (H):</label>
                    <select
                      value={activeScreen.gridCols || ''}
                      onChange={(e) => handleUpdateGridDimensions(e.target.value ? Number(e.target.value) : undefined, activeScreen.gridRows)}
                      className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-500"
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
                    <label className="text-slate-400 text-[11px]">Rows (V):</label>
                    <select
                      value={activeScreen.gridRows || ''}
                      onChange={(e) => handleUpdateGridDimensions(activeScreen.gridCols, e.target.value ? Number(e.target.value) : undefined)}
                      className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-500"
                    >
                      <option value="">Auto ({computedGrid.rows})</option>
                      <option value="5">5 Rows (Min)</option>
                      <option value="6">6 Rows</option>
                      <option value="7">7 Rows (Max)</option>
                    </select>
                  </div>

                  {/* Capacity & Matrix Info */}
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[11px] border border-slate-700">
                    {computedGrid.cols} × {computedGrid.rows} ({computedGrid.totalSlots} slots)
                  </span>
                </div>

                <div className="flex items-center gap-2 text-slate-400">
                  <span>
                    {activeScreen.buttons.length} tiles configured
                  </span>
                  {activeScreen.buttons.length > computedGrid.totalSlots && (
                    <span className="text-amber-400 font-semibold text-[11px] flex items-center gap-1">
                      <AlertCircle size={12} />
                      Scrolls on touch
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pt-1 pb-4">
                {activeScreen.buttons.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-800 rounded-2xl">
                    <FolderPlus size={36} className="text-slate-600 mb-2" />
                    <p className="text-sm font-bold text-slate-400">This screen has no buttons yet</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Add buttons linking to sub-screens (e.g. Starters, Drinks) or specific menu dishes.
                    </p>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={handleOpenBulkAddModal}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-bold"
                      >
                        Bulk Add Dishes
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenAddButtonModal()}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black"
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
                      return (
                        <div
                          key={btn.id || idx}
                          className={`relative group rounded-xl border ${gridDensity.minHeight} ${gridDensity.padding} flex flex-col justify-between transition-all shadow-md ${colorTheme.bg} ${colorTheme.border}`}
                        >
                          <div className="flex items-center justify-between gap-1 opacity-80 group-hover:opacity-100 transition">
                            <span className="text-[9px] uppercase font-black tracking-wider px-1 py-0.2 rounded bg-black/40 text-slate-300">
                              {btn.type === 'screen' ? '📁 Sub' : '🍽️ Dish'}
                            </span>
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveButton(idx, 'left')}
                                className="p-0.5 rounded bg-black/40 hover:bg-black/80 text-slate-400 hover:text-white disabled:opacity-20 transition"
                                title="Move Left"
                              >
                                <MoveLeft size={11} />
                              </button>
                              <button
                                type="button"
                                disabled={idx === activeScreen.buttons.length - 1}
                                onClick={() => handleMoveButton(idx, 'right')}
                                className="p-0.5 rounded bg-black/40 hover:bg-black/80 text-slate-400 hover:text-white disabled:opacity-20 transition"
                                title="Move Right"
                              >
                                <MoveRight size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenAddButtonModal(idx)}
                                className="p-0.5 rounded bg-black/40 hover:bg-black/80 text-slate-400 hover:text-amber-400 transition"
                                title="Edit Button"
                              >
                                <Edit3 size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteButton(idx)}
                                className="p-0.5 rounded bg-black/40 hover:bg-red-950 text-slate-400 hover:text-red-400 transition"
                                title="Delete Button"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>

                          <div className="my-auto py-1 text-center">
                            <span className={`font-black ${gridDensity.fontSize} leading-tight line-clamp-2 ${colorTheme.text}`}>
                              {btn.label}
                            </span>
                          </div>

                          <div className="text-[9px] text-slate-400 text-center truncate opacity-70">
                            {btn.type === 'screen'
                              ? `Opens: ${screens.find((s) => s.id === btn.targetScreenId)?.name || 'Screen'}`
                              : 'Product'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              Select a screen from the left to edit.
            </div>
          )}
        </div>
      </div>

      {isAddScreenModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181C24] border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-3">Create New Screen</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Screen Title</label>
                <input
                  type="text"
                  value={newScreenName}
                  onChange={(e) => setNewScreenName(e.target.value)}
                  placeholder="e.g. Desserts, Bar & Cocktails"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-medium focus:outline-none focus:border-amber-500"
                  autoFocus
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={newScreenIsRoot}
                  onChange={(e) => setNewScreenIsRoot(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500"
                />
                <span className="text-xs font-medium text-slate-300">Set as Root / First Screen</span>
              </label>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setIsAddScreenModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateScreen}
                disabled={!newScreenName.trim()}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black disabled:opacity-50"
              >
                Create Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddButtonModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181C24] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-white">
              {editingButtonIndex !== null ? 'Edit Button' : 'Add Button to ' + activeScreen.name}
            </h3>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1.5">Button Function</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBtnType('product')}
                  className={`py-2 rounded-xl text-xs font-black border transition ${
                    btnType === 'product'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/60'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  🍽️ Product Button
                </button>
                <button
                  type="button"
                  onClick={() => setBtnType('screen')}
                  className={`py-2 rounded-xl text-xs font-black border transition ${
                    btnType === 'screen'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/60'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  📁 Subscreen Link
                </button>
              </div>
            </div>

            {btnType === 'product' ? (
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Select Menu Item</label>
                <select
                  value={btnProductId}
                  onChange={(e) => {
                    setBtnProductId(e.target.value);
                    const prod = products.find((p) => String(p.id) === String(e.target.value));
                    if (prod && !btnLabel) {
                      setBtnLabel(prod.name);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.category ? `(${p.category})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Target Subscreen</label>
                <select
                  value={btnTargetScreenId}
                  onChange={(e) => {
                    setBtnTargetScreenId(e.target.value);
                    const scr = screens.find((s) => s.id === e.target.value);
                    if (scr && !btnLabel) {
                      setBtnLabel(scr.name);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  {screens
                    .filter((s) => s.id !== activeScreen.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">
                Button Label (Displays only this name on POS)
              </label>
              <input
                type="text"
                value={btnLabel}
                onChange={(e) => setBtnLabel(e.target.value)}
                placeholder="Leave blank to use default name"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1.5">Tile Color Theme</label>
              <div className="flex flex-wrap gap-2">
                {TILE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setBtnColor(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${c.bg} ${c.text} ${
                      btnColor === c.id ? 'ring-2 ring-amber-400 border-white' : 'border-slate-700/60'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddButtonModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveButton}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black"
              >
                {editingButtonIndex !== null ? 'Update Button' : 'Add Button'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Dishes Modal */}
      {isBulkAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181C24] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <CheckSquare className="text-amber-400" size={20} />
                  Bulk Add Dishes to {activeScreen?.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Quickly select multiple dishes to populate buttons on this screen.
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {bulkSelectedProductIds.size} Selected
              </span>
            </div>

            {/* Filter and Search Bar */}
            <div className="py-3 flex flex-wrap items-center gap-2 border-b border-slate-800/60">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={bulkSearchQuery}
                  onChange={(e) => setBulkSearchQuery(e.target.value)}
                  placeholder="Search dishes by name..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={bulkCategoryFilter}
                onChange={(e) => setBulkCategoryFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleSelectAllBulkFiltered}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition"
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
                <div className="text-center py-10 text-slate-500 text-xs">
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
                            ? 'bg-amber-500/15 border-amber-500/60 text-white'
                            : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div className={`p-1 rounded ${isSelected ? 'text-amber-400' : 'text-slate-500'}`}>
                            {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                          </div>
                          <div className="truncate">
                            <div className="font-bold text-xs text-white truncate">{p.name}</div>
                            <div className="text-[10px] text-slate-400">
                              {p.category || 'Menu Item'} • ${Number(p.price || 0).toFixed(2)}
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
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <div className="text-xs text-slate-400">
                {bulkSelectedProductIds.size} dish{bulkSelectedProductIds.size === 1 ? '' : 'es'} will be added as buttons.
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={bulkSelectedProductIds.size === 0}
                  onClick={handleConfirmBulkAdd}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-slate-950 text-xs font-black transition"
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
