import SearchableSelect from '../components/SearchableSelect';
import RecipeDeleteButton from '../components/RecipeDeleteButton';
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { Search, Plus, Loader2, ChefHat, Package, RotateCcw, X, Layers, Edit2, Trash2, Check, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LinkedCatalogItemsModal, { type LinkedCatalogItemDetail } from '../components/LinkedCatalogItemsModal';

const PRODUCT_RECIPES_FILTER_STORAGE_KEY = 'neo_product_recipes_filters_v1';

interface SavedProductRecipeFilters {
  searchQuery: string;
  section: string;
  recipeType: string;
  productLink: string;
  bomStatus: string;
  sort: string;
}

function loadSavedProductRecipeFilters(): SavedProductRecipeFilters {
  try {
    const raw = sessionStorage.getItem(PRODUCT_RECIPES_FILTER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        searchQuery: typeof parsed.searchQuery === 'string' ? parsed.searchQuery : '',
        section: typeof parsed.section === 'string' ? parsed.section : '',
        recipeType: typeof parsed.recipeType === 'string' ? parsed.recipeType : '',
        productLink: typeof parsed.productLink === 'string' ? parsed.productLink : '',
        bomStatus: typeof parsed.bomStatus === 'string' ? parsed.bomStatus : '',
        sort: typeof parsed.sort === 'string' && parsed.sort ? parsed.sort : 'name',
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return {
    searchQuery: '',
    section: '',
    recipeType: '',
    productLink: '',
    bomStatus: '',
    sort: 'name',
  };
}

export default function MenuManualScreen({ canEdit = false }: { canEdit?: boolean }) {
  const initialFilters = loadSavedProductRecipeFilters();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [productionRecipes, setProductionRecipes] = useState<any[]>([]);
  const [productMappings, setProductMappings] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [customizationsList, setCustomizationsList] = useState<any[]>([]);
  const [modifierEffectsList, setModifierEffectsList] = useState<any[]>([]);
  const [selectedRecipeForModal, setSelectedRecipeForModal] = useState<{ recipe: any; items: LinkedCatalogItemDetail[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery);
  const [section, setSection] = useState(initialFilters.section);
  const [recipeType, setRecipeType] = useState(initialFilters.recipeType);
  const [productLink, setProductLink] = useState(initialFilters.productLink);
  const [bomStatus, setBomStatus] = useState(initialFilters.bomStatus);
  const [sort, setSort] = useState(initialFilters.sort);
  const navigate = useNavigate();

  // Section Management state
  const [sectionsList, setSectionsList] = useState<any[]>([]);
  const [manageSectionsOpen, setManageSectionsOpen] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | number | null>(null);
  const [editSectionName, setEditSectionName] = useState('');
  const [editSectionDept, setEditSectionDept] = useState('Kitchen');
  const [editSectionOrder, setEditSectionOrder] = useState('1');
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionDept, setNewSectionDept] = useState('Kitchen');
  const [newSectionOrder, setNewSectionOrder] = useState('10');
  const [sectionError, setSectionError] = useState('');
  const [sectionSuccess, setSectionSuccess] = useState('');
  const [sectionSubmitting, setSectionSubmitting] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        PRODUCT_RECIPES_FILTER_STORAGE_KEY,
        JSON.stringify({ searchQuery, section, recipeType, productLink, bomStatus, sort })
      );
    } catch {
      // Ignore storage write errors
    }
  }, [searchQuery, section, recipeType, productLink, bomStatus, sort]);

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const [recipesRes, itemsRes, prodRes, mappingsRes, secRes, custsRes, effectsRes, prodsRes] = await Promise.all([
        api.getMenuRecipes(),
        api.getInventoryItemsSimpleList(),
        api.getProductionRecipeCatalog(),
        api.getAllProductInventoryItemMappings(),
        api.getMenuSections(),
        api.getAllProductCustomizations(),
        api.getAllModifierInventoryEffects(),
        api.getProductsSimpleList()
      ]);
      if (recipesRes.success && recipesRes.data) {
        setRecipes(recipesRes.data);
      }
      if (itemsRes.success && itemsRes.data) {
        setCatalogItems(itemsRes.data);
      }
      if (prodRes.success && prodRes.data) {
        setProductionRecipes(prodRes.data);
      }
      if (mappingsRes.success && mappingsRes.data) {
        setProductMappings(mappingsRes.data);
      }
      if (secRes.success && secRes.data) {
        setSectionsList(secRes.data);
      }
      if (custsRes?.success && custsRes.data) {
        setCustomizationsList(custsRes.data);
      }
      if (effectsRes?.success && effectsRes.data) {
        setModifierEffectsList(effectsRes.data);
      }
      if (prodsRes?.success && prodsRes.data) {
        setProductsList(prodsRes.data);
      }
    } catch (e) {
      console.error('Error fetching recipes:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    setSectionSubmitting(true);
    setSectionError('');
    setSectionSuccess('');
    try {
      const res = await api.createMenuSection({
        name: newSectionName.trim(),
        department: newSectionDept,
        display_order: Number(newSectionOrder) || 10
      });
      if (!res.success) throw new Error(res.error || 'Failed to create section.');
      setNewSectionName('');
      setSectionSuccess(`Section "${res.data.name}" created successfully!`);
      const updatedSec = await api.getMenuSections();
      if (updatedSec.success) setSectionsList(updatedSec.data || []);
      fetchRecipes();
    } catch (err: any) {
      setSectionError(err.message);
    } finally {
      setSectionSubmitting(false);
    }
  };

  const startEditSection = (sec: any) => {
    setEditingSectionId(sec.id);
    setEditSectionName(sec.name);
    setEditSectionDept(sec.department || 'Kitchen');
    setEditSectionOrder(String(sec.display_order ?? 1));
    setSectionError('');
    setSectionSuccess('');
  };

  const handleUpdateSection = async (id: number | string) => {
    if (!editSectionName.trim()) return;
    setSectionSubmitting(true);
    setSectionError('');
    setSectionSuccess('');
    try {
      const res = await api.updateMenuSection(id, {
        name: editSectionName.trim(),
        department: editSectionDept,
        display_order: Number(editSectionOrder) || 1
      });
      if (!res.success) throw new Error(res.error || 'Failed to update section.');
      setEditingSectionId(null);
      setSectionSuccess(`Section updated successfully!`);
      const updatedSec = await api.getMenuSections();
      if (updatedSec.success) setSectionsList(updatedSec.data || []);
      fetchRecipes();
    } catch (err: any) {
      setSectionError(err.message);
    } finally {
      setSectionSubmitting(false);
    }
  };

  const handleDeleteSection = async (sec: any) => {
    if (!window.confirm(`Are you sure you want to delete section "${sec.name}"?`)) return;
    setSectionSubmitting(true);
    setSectionError('');
    setSectionSuccess('');
    try {
      const res = await api.deleteMenuSection(sec.id);
      if (!res.success) throw new Error(res.error || 'Failed to delete section.');
      setSectionSuccess(`Section "${sec.name}" deleted successfully.`);
      const updatedSec = await api.getMenuSections();
      if (updatedSec.success) setSectionsList(updatedSec.data || []);
      fetchRecipes();
    } catch (err: any) {
      setSectionError(err.message);
    } finally {
      setSectionSubmitting(false);
    }
  };

  const normalize = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const sectionKey = (recipe: any) => recipe.section_id == null ? '__none' : String(recipe.section_id);
  const sections = useMemo(() => {
    const map = new Map<string, string>();
    sectionsList.forEach(s => {
      map.set(String(s.id), s.name);
    });
    recipes.forEach(r => {
      if (r.section_id != null) {
        if (!map.has(String(r.section_id))) {
          map.set(String(r.section_id), r.menu_sections?.name || `Section #${r.section_id}`);
        }
      } else {
        map.set('__none', 'Unassigned section');
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [sectionsList, recipes]);
  const terms = normalize(searchQuery).trim().split(/\s+/).filter(Boolean);
  const filteredRecipes = recipes.filter(recipe => {
    const text = normalize([recipe.item_name, recipe.menu_sections?.name, recipe.product_id].join(' '));
    return terms.every(term => text.includes(term))
      && (!section || sectionKey(recipe) === section)
      && (!recipeType || (recipeType === 'production' ? recipe.is_production : !recipe.is_production))
      && (!productLink || (productLink === 'linked' ? recipe.product_id != null : recipe.product_id == null))
      && (!bomStatus || (bomStatus === 'ACTIVE' ? recipe.bom_status === 'ACTIVE' : recipe.bom_status !== 'ACTIVE'));
  }).sort((a, b) => sort === 'updated'
    ? (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0)
    : String(a.item_name ?? '').localeCompare(String(b.item_name ?? ''), undefined, { sensitivity: 'base' }) * (sort === 'reverse' ? -1 : 1));
  const hasFilters = Boolean(searchQuery || section || recipeType || productLink || bomStatus || sort !== 'name');
  const clearFilters = () => {
    setSearchQuery('');
    setSection('');
    setRecipeType('');
    setProductLink('');
    setBomStatus('');
    setSort('name');
    try {
      sessionStorage.removeItem(PRODUCT_RECIPES_FILTER_STORAGE_KEY);
    } catch {
      // Ignore storage remove errors
    }
  };
  const filterStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: 14 };
  const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 };

  const productsByNameMap = useMemo(() => {
    const map = new Map<string, any>();
    productsList.forEach(p => {
      if (p.name) map.set(normalize(p.name), p);
    });
    return map;
  }, [productsList]);

  const modifierEffectsMap = useMemo(() => {
    const map = new Map<number, any[]>();
    modifierEffectsList.forEach(eff => {
      const cid = Number(eff.product_customization_id);
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid)!.push(eff);
    });
    return map;
  }, [modifierEffectsList]);

  const productCustomizationsMap = useMemo(() => {
    const map = new Map<number, any[]>();
    customizationsList.forEach(c => {
      const pid = Number(c.product_id);
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(c);
    });
    return map;
  }, [customizationsList]);

  const getRecipeLinkedCatalogItems = (recipe: any): LinkedCatalogItemDetail[] => {
    const list: LinkedCatalogItemDetail[] = [];
    const seenItemIds = new Set<string>();

    // 1. Direct BOM components (recipe_components)
    if (recipe.recipe_components && Array.isArray(recipe.recipe_components)) {
      recipe.recipe_components.forEach((c: any) => {
        const itemObj = c.items || catalogItems.find(i => i.id === c.item_id);
        if (c.item_id) seenItemIds.add(c.item_id);
        list.push({
          id: c.item_id,
          name: itemObj?.name || 'Unknown item',
          role: 'BOM Component',
          quantity: c.base_quantity,
          unit: c.unit,
          department: itemObj?.department,
          subDepartment: itemObj?.sub_department,
          priceUsd: itemObj?.price_usd,
          wastePercentage: c.waste_percentage,
          notes: c.notes
        });
      });
    }

    // 2. Reference Recipes (e.g. sub-recipes like Sauce hollandaise, Lemonade Syrup)
    if (recipe.reference_recipes && Array.isArray(recipe.reference_recipes)) {
      recipe.reference_recipes.forEach((ref: any) => {
        const matchedProd = productionRecipes.find(p => p.id === ref.id || normalize(p.name) === normalize(ref.name));
        const outputItem = matchedProd?.output_item_id ? catalogItems.find(i => i.id === matchedProd.output_item_id) : null;
        if (matchedProd?.output_item_id) seenItemIds.add(matchedProd.output_item_id);
        list.push({
          id: ref.id,
          name: ref.name || matchedProd?.name || 'Reference Recipe',
          role: 'Reference Prep Recipe',
          quantity: matchedProd?.target_yield_quantity,
          unit: matchedProd?.yield_unit,
          department: outputItem?.department,
          subDepartment: outputItem?.sub_department,
          priceUsd: outputItem?.price_usd
        });
      });
    }

    // 3. Finished Good Mapping (when recipe is linked to a sales product configured for finished-good inventory)
    const effectivePid = recipe.product_id ? Number(recipe.product_id) : (productsByNameMap.get(normalize(recipe.item_name))?.id || null);
    if (effectivePid) {
      const mapping = productMappings.find(m => Number(m.product_id) === effectivePid);
      if (mapping && !seenItemIds.has(mapping.item_id)) {
        const itemObj = mapping.items || catalogItems.find(i => i.id === mapping.item_id);
        list.push({
          id: mapping.item_id,
          name: itemObj?.name || 'Finished Good Item',
          role: 'Catalog Item',
          quantity: mapping.conversion_ratio || 1,
          unit: itemObj?.unit || itemObj?.base_unit || 'portion',
          department: itemObj?.department,
          subDepartment: itemObj?.sub_department,
          priceUsd: itemObj?.price_usd
        });
      }

      // 4. Modifier Options & Inventory Effects (e.g. Doppio, Espresso coffee beans / milk options)
      const custs = productCustomizationsMap.get(effectivePid) || [];
      custs.forEach((c: any) => {
        const effects = modifierEffectsMap.get(Number(c.id)) || [];
        if (effects.length > 0) {
          effects.forEach((eff: any) => {
            const itemObj = eff.items || catalogItems.find(i => i.id === eff.item_id);
            const effItemId = eff.item_id || `mod-${eff.id}`;
            if (!seenItemIds.has(effItemId)) {
              seenItemIds.add(effItemId);
              list.push({
                id: eff.item_id,
                name: `${itemObj?.name || c.ingredient} (${c.option_group_name || 'Option'}: ${c.ingredient})`,
                role: 'Modifier Option',
                quantity: eff.quantity_delta,
                unit: eff.unit || itemObj?.unit || itemObj?.base_unit || 'g',
                department: itemObj?.department,
                subDepartment: itemObj?.sub_department,
                priceUsd: itemObj?.price_usd,
                notes: `POS Option: ${c.option_group_name || 'Option'} > ${c.ingredient}`
              });
            }
          });
        }
      });
    }

    return list;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ChefHat size={28} style={{ color: 'var(--primary)' }} /> Product Recipes
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Manage kitchen recipes, final menu items, and preparation instructions.
          </p>
        </div>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
          <button onClick={() => navigate('/production-recipes')} style={{padding:'10px 16px',border:'1px solid var(--border)',borderRadius:6,background:'white',cursor:'pointer'}}>Production Recipes</button>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setSectionError('');
                setSectionSuccess('');
                setEditingSectionId(null);
                setManageSectionsOpen(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', border: '1px solid var(--border)', borderRadius: 6, background: '#f8fafc', cursor: 'pointer', fontWeight: 600 }}
              title="Add, rename or organize menu sections"
            >
              <Layers size={18} style={{ color: 'var(--primary)' }} /> Manage Sections
            </button>
          )}
          <button 
            onClick={() => navigate('/menu/new')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={20} /> New Recipe
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <Search size={20} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
        <input 
          type="text" 
          aria-label="Search menu recipes"
          placeholder="Search by recipe name, section or product number…" 
          value={searchQuery}
          onChange={handleSearch}
          style={{ width: '100%', padding: '12px 38px 12px 40px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '16px' }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            title="Clear search"
            style={{
              position: 'absolute',
              right: '10px',
              top: '8px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Quick Section Filter Pills */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '16px',
          scrollbarWidth: 'thin'
        }}
      >
        <button
          type="button"
          onClick={() => setSection('')}
          style={{
            flexShrink: 0,
            padding: '6px 14px',
            borderRadius: '999px',
            border: !section ? '1px solid var(--primary)' : '1px solid var(--border)',
            backgroundColor: !section ? 'var(--primary)' : '#ffffff',
            color: !section ? '#ffffff' : 'var(--text-muted)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}
        >
          All Sections ({recipes.length})
        </button>
        {sections.map(([id, name]) => {
          const isSelected = section === id;
          const count = recipes.filter(r => sectionKey(r) === id).length;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSection(isSelected ? '' : id)}
              style={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '999px',
                border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                fontSize: '13px',
                fontWeight: isSelected ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{name}</span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: isSelected ? 'var(--primary)' : '#f1f5f9',
                  color: isSelected ? '#ffffff' : 'var(--text-muted)',
                  fontWeight: 600
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16, alignItems: 'end' }}>
        <label style={labelStyle}>Menu section
          <SearchableSelect aria-label="Menu section filter" value={section} onValueChange={setSection} style={filterStyle}>
            <option value="">All sections</option>
            {sections.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </SearchableSelect>
        </label>
        <label style={labelStyle}>Recipe type
          <select aria-label="Recipe type filter" value={recipeType} onChange={e => setRecipeType(e.target.value)} style={filterStyle}>
            <option value="">All types</option><option value="final">Final Menu</option><option value="production">Production</option>
          </select>
        </label>
        <label style={labelStyle}>Product link
          <select aria-label="Product link filter" value={productLink} onChange={e => setProductLink(e.target.value)} style={filterStyle}>
            <option value="">All links</option><option value="linked">Linked to a product</option><option value="unlinked">No product linked</option>
          </select>
        </label>
        <label style={labelStyle}>BOM status
          <select aria-label="BOM status filter" value={bomStatus} onChange={e => setBomStatus(e.target.value)} style={filterStyle}>
            <option value="">All statuses</option><option value="ACTIVE">Active BOM</option><option value="inactive">No active BOM</option>
          </select>
        </label>
        <label style={labelStyle}>Sort by
          <select aria-label="Sort recipes" value={sort} onChange={e => setSort(e.target.value)} style={filterStyle}>
            <option value="name">Name A–Z</option><option value="reverse">Name Z–A</option><option value="updated">Recently updated</option>
          </select>
        </label>
        <div>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasFilters}
            style={{
              height: '40px',
              width: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '0 14px',
              borderRadius: '8px',
              border: hasFilters ? '1px solid #fca5a5' : '1px solid var(--border)',
              backgroundColor: hasFilters ? '#fef2f2' : '#f8fafc',
              color: hasFilters ? '#dc2626' : '#94a3b8',
              fontSize: '13px',
              fontWeight: 600,
              cursor: hasFilters ? 'pointer' : 'not-allowed'
            }}
            title="Reset all filters and search"
          >
            <RotateCcw size={15} /> Reset Filter
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <span role="status" aria-live="polite" style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {loading ? 'Loading recipes…' : `${filteredRecipes.length} of ${recipes.length} recipes`}
          {hasFilters ? ' (Filtered)' : ''}
        </span>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={14} /> Reset Filters
          </button>
        )}
      </div>

      <div style={{ flex: 1, backgroundColor: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', borderBottom: '2px solid var(--border)', zIndex: 1 }}>
                <tr>
                  <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 600 }}>Item Name</th>
                  <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 600 }}>Section</th>
                  <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 600 }}>Linked Catalog Items</th>
                  <th style={{ padding: '16px', color: 'var(--text-muted)', fontWeight: 600 }}>Last Updated</th>
                  {canEdit && <th style={{ padding: 16 }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredRecipes.map(recipe => (
                  <tr 
                    key={recipe.id} 
                    onClick={() => navigate(`/menu/edit/${recipe.id}`)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--background)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '16px', fontWeight: 600, color: 'var(--primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {recipe.inhouse_image_url || recipe.image_url ? (
                          <img src={recipe.inhouse_image_url || recipe.image_url} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#e9ecef' }} />
                        )}
                        {recipe.item_name}
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ backgroundColor: '#eef2f5', color: 'var(--primary)', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
                        {recipe.menu_sections?.name || 'Unassigned section'}
                      </span>
                    </td>
                    {(() => {
                      const linkedItems = getRecipeLinkedCatalogItems(recipe);
                      const count = linkedItems.length;
                      const hasModifiers = linkedItems.some(i => i.role === 'Modifier Option');
                      const isModifierOnly = hasModifiers && (!recipe.recipe_components || recipe.recipe_components.length === 0);

                      return (
                        <>
                          <td style={{ padding: '16px' }}>
                            {recipe.is_production ? (
                              <span style={{ backgroundColor: '#fdf5e6', color: '#d97706', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
                                Production
                              </span>
                            ) : isModifierOnly ? (
                              <span style={{ backgroundColor: '#ede9fe', color: '#6d28d9', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
                                Modifier Menu
                              </span>
                            ) : (
                              <span style={{ backgroundColor: '#e9f5e9', color: '#2e7d32', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
                                Final Menu
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '16px' }} onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRecipeForModal({ recipe, items: linkedItems });
                              }}
                              title={hasModifiers ? "Click to view linked modifier options and catalog ingredients" : "Click to view linked catalog items"}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 10px',
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 600,
                                background: hasModifiers ? '#ede9fe' : count > 0 ? '#eff6ff' : '#f3f4f6',
                                color: hasModifiers ? '#6d28d9' : count > 0 ? '#1d4ed8' : '#6b7280',
                                border: hasModifiers ? '1px solid #ddd6fe' : count > 0 ? '1px solid #bfdbfe' : '1px solid #e5e7eb',
                                cursor: 'pointer'
                              }}
                            >
                              <Package size={13} />
                              {count} item{count !== 1 ? 's' : ''} {hasModifiers && !recipe.recipe_components?.length ? '(Modifiers)' : ''}
                            </button>
                          </td>
                        </>
                      );
                    })()}
                    <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '14px' }}>
                      {new Date(recipe.updated_at).toLocaleDateString()}
                    </td>
                    {canEdit && <td style={{ padding: 16 }} onClick={e => e.stopPropagation()}><RecipeDeleteButton kind="menu" recipeId={recipe.id} name={recipe.item_name} onDeleted={() => setRecipes(rows => rows.filter(row => row.id !== recipe.id))} /></td>}
                  </tr>
                ))}
                {filteredRecipes.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {hasFilters ? 'No recipes match these filters. Try another selection or clear filters.' : 'No recipes found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manage Menu Sections Modal */}
      {manageSectionsOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              maxWidth: 680,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={20} style={{ color: 'var(--primary)' }} /> Manage Menu Sections
                </h2>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  Add, rename or reorder menu sections (e.g. Starters, Pastry, Breakfast, Desserts).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManageSectionsOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {sectionError && (
              <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} /> {sectionError}
              </div>
            )}

            {sectionSuccess && (
              <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Check size={16} /> {sectionSuccess}
              </div>
            )}

            {/* Add New Section Form */}
            <form onSubmit={handleAddSection} style={{ marginTop: 20, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: 'var(--text-main)' }}>
                + Add New Menu Section
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.8fr auto', gap: 10, alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Section name (e.g. Pastry, Cakes)"
                  value={newSectionName}
                  onChange={e => setNewSectionName(e.target.value)}
                  required
                  style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}
                />
                <select
                  value={newSectionDept}
                  onChange={e => setNewSectionDept(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}
                >
                  <option value="Kitchen">Kitchen</option>
                  <option value="Bar">Bar</option>
                  <option value="All">All Stations</option>
                </select>
                <input
                  type="number"
                  placeholder="Order"
                  title="Display order index"
                  value={newSectionOrder}
                  onChange={e => setNewSectionOrder(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}
                />
                <button
                  type="submit"
                  disabled={sectionSubmitting || !newSectionName.trim()}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: sectionSubmitting || !newSectionName.trim() ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Add Section
                </button>
              </div>
            </form>

            {/* Sections List Table */}
            <div style={{ marginTop: 20, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 14px', width: 60 }}>Order</th>
                    <th style={{ padding: '10px 14px' }}>Section Name</th>
                    <th style={{ padding: '10px 14px', width: 110 }}>Department</th>
                    <th style={{ padding: '10px 14px', width: 90, textAlign: 'center' }}>Recipes</th>
                    <th style={{ padding: '10px 14px', width: 110, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionsList.map(sec => {
                    const isEditing = editingSectionId === sec.id;
                    const recipeCount = recipes.filter(r => String(r.section_id) === String(sec.id)).length;

                    if (isEditing) {
                      return (
                        <tr key={sec.id} style={{ borderBottom: '1px solid var(--border)', background: '#fffbeb' }}>
                          <td style={{ padding: '8px 14px' }}>
                            <input
                              type="number"
                              value={editSectionOrder}
                              onChange={e => setEditSectionOrder(e.target.value)}
                              style={{ width: 50, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4 }}
                            />
                          </td>
                          <td style={{ padding: '8px 14px' }}>
                            <input
                              type="text"
                              value={editSectionName}
                              onChange={e => setEditSectionName(e.target.value)}
                              style={{ width: '100%', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4 }}
                            />
                          </td>
                          <td style={{ padding: '8px 14px' }}>
                            <select
                              value={editSectionDept}
                              onChange={e => setEditSectionDept(e.target.value)}
                              style={{ padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4 }}
                            >
                              <option value="Kitchen">Kitchen</option>
                              <option value="Bar">Bar</option>
                              <option value="All">All Stations</option>
                            </select>
                          </td>
                          <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                            {recipeCount}
                          </td>
                          <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => handleUpdateSection(sec.id)}
                                title="Save changes"
                                style={{ padding: '4px 8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSectionId(null)}
                                title="Cancel"
                                style={{ padding: '4px 8px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={sec.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                          #{sec.display_order ?? '-'}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                          {sec.name}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: sec.department === 'Bar' ? '#e0e7ff' : '#f1f5f9', color: sec.department === 'Bar' ? '#3730a3' : '#475569', fontWeight: 600 }}>
                            {sec.department || 'Kitchen'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: recipeCount > 0 ? '#1d4ed8' : 'var(--text-muted)', fontWeight: recipeCount > 0 ? 600 : 400 }}>
                          {recipeCount}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => startEditSection(sec)}
                              title="Edit section"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4 }}
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSection(sec)}
                              title={recipeCount > 0 ? `Cannot delete: ${recipeCount} recipes assigned` : 'Delete section'}
                              style={{ background: 'none', border: 'none', cursor: recipeCount > 0 ? 'not-allowed' : 'pointer', color: recipeCount > 0 ? '#cbd5e1' : '#dc2626', padding: 4 }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setManageSectionsOpen(false)}
                style={{ padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 6, background: '#fff', cursor: 'pointer', fontWeight: 600 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Linked Catalog Items Modal */}
      <LinkedCatalogItemsModal
        isOpen={Boolean(selectedRecipeForModal)}
        onClose={() => setSelectedRecipeForModal(null)}
        recipeName={selectedRecipeForModal?.recipe.item_name || ''}
        recipeCodeOrSection={selectedRecipeForModal?.recipe.menu_sections?.name || 'Section'}
        recipeType="menu"
        editUrl={selectedRecipeForModal ? `/menu/edit/${selectedRecipeForModal.recipe.id}` : undefined}
        items={selectedRecipeForModal?.items || []}
      />
    </div>
  );
}
