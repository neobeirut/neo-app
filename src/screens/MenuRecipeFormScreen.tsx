import RecipeDeleteButton from '../components/RecipeDeleteButton';
import SearchableSelect from '../components/SearchableSelect';
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import ProductModifierModal from './crm/ProductModifierModal';
import { 
  inventoryModes, 
  positiveNumber, 
  conversionFactor, 
  getConvertibleUnits, 
  formatConversionPreview, 
  validateComponents, 
  validateMapping, 
  resolveReferenceOutput, 
  resolveReferenceRecipe, 
  resolveItemEffectiveCost,
  type InventoryMode 
} from '../utils/inventoryConfiguration';
import { generateRecipeTemplate, parseRecipeExcelOrCsv } from '../utils/recipeExcelImport';
import { ArrowLeft, Save, Loader2, Upload, ChefHat, Plus, Trash2, CheckCircle, AlertTriangle, Layers, Settings, Sliders, Package, AlertCircle, Info, Link2, FileText, Download, Copy, Edit2, X, Sparkles, RotateCcw, Calculator } from 'lucide-react';

export default function MenuRecipeFormScreen({ canDelete = false }: { canDelete?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState(false);

  // Form State
  const [itemName, setItemName] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [recipeText, setRecipeText] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [plateType, setPlateType] = useState('');
  const [foodCost, setFoodCost] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [platingInstructions, setPlatingInstructions] = useState('');
  const [hints, setHints] = useState('');
  const [allergens, setAllergens] = useState('');
  
  // Phase 2 BOM / Inventory Extensions
  const [productId, setProductId] = useState<number | ''>('');
  const [yieldQuantity, setYieldQuantity] = useState<number>(1.0);
  const [yieldUnit, setYieldUnit] = useState<string>('portion');
  const [bomStatus, setBomStatus] = useState<'DRAFT' | 'ACTIVE' | 'INACTIVE'>('DRAFT');
  const [components, setComponents] = useState<any[]>([]);

  // Dual Image
  const [inhouseImageUrl, setInhouseImageUrl] = useState('');
  const [deliveryImageUrl, setDeliveryImageUrl] = useState('');
  const [uploadingInhouse, setUploadingInhouse] = useState(false);
  const [uploadingDelivery, setUploadingDelivery] = useState(false);

  // Production & New Fields
  const [isProduction, setIsProduction] = useState(false);
  const [preparationSteps, setPreparationSteps] = useState('');
  const [packagingInstructions, setPackagingInstructions] = useState('');
  const [qualityStandards, setQualityStandards] = useState('');
  
  // Access Control
  const [accessDepartments, setAccessDepartments] = useState<string[]>(['All']);
  const [accessEmployees, setAccessEmployees] = useState<string[]>([]);
  const [referenceRecipes, setReferenceRecipes] = useState<any[]>([]);

  // Reference Data
  const [sections, setSections] = useState<any[]>([]);
  const [allRecipes, setAllRecipes] = useState<any[]>([]);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [rawItems, setRawItems] = useState<any[]>([]);
  const [inventoryLocations, setInventoryLocations] = useState<any[]>([]);
  const [productionRecipes, setProductionRecipes] = useState<any[]>([]);

  // Modifiers & Inventory Effects
  const [productCustomizations, setProductCustomizations] = useState<any[]>([]);
  const [selectedCustomizationId, setSelectedCustomizationId] = useState<number | null>(null);
  const [modifierEffects, setModifierEffects] = useState<any[]>([]);
  const [newEffectItem, setNewEffectItem] = useState('');
  const [newEffectType, setNewEffectType] = useState<'ADD' | 'REMOVE'>('ADD');
  const [newEffectQty, setNewEffectQty] = useState('');
  const [newEffectUnit, setNewEffectUnit] = useState('g');
  const [newEffectLocation, setNewEffectLocation] = useState('');
  const [effectSaving, setEffectSaving] = useState(false);
  const [editingEffectId, setEditingEffectId] = useState<string | null>(null);
  const [editEffectDraft, setEditEffectDraft] = useState<{
    item_id: string;
    effect_type: 'ADD' | 'REMOVE';
    quantity_delta: string;
    unit: string;
    location_id: string;
  } | null>(null);
  const [copySourceProductId, setCopySourceProductId] = useState<string>('');
  const [copyingModifiers, setCopyingModifiers] = useState(false);
  const [syncingAllProducts, setSyncingAllProducts] = useState(false);
  const [activeModifierScreenIdx, setActiveModifierScreenIdx] = useState<number>(0);
  const [draggedScreenIdx, setDraggedScreenIdx] = useState<number | null>(null);
  const [allProductModifierEffects, setAllProductModifierEffects] = useState<any[]>([]);
  const [vatRate, setVatRate] = useState<number>(11);
  const [selectedSimulatorOptions, setSelectedSimulatorOptions] = useState<Record<string, number | null>>({});

  const modifierScreenGroups = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    for (const c of productCustomizations) {
      const rawG = (c.option_group_name || c.group_name || '').trim();
      const lower = rawG.toLowerCase();
      const tLower = (c.customization_type || '').toLowerCase();
      let g = rawG;
      if (lower === 'remove' || lower === 'removal' || lower === 'removals' || lower.startsWith('remove ingredient') || tLower === 'remove' || tLower === 'removal') {
        g = 'Remove';
      } else if (!rawG || lower === 'general' || lower === 'add on' || lower === 'add-on' || lower === 'addon' || lower === 'add-ons' || lower === 'addons' || lower === 'add ons' || lower === 'add_on' || lower === 'add_ons' || tLower === 'addon') {
        if (!rawG || lower === 'general' || lower === 'add on' || lower === 'add-on' || lower === 'addon' || lower === 'add-ons' || lower === 'addons' || lower === 'add ons' || lower === 'add_on' || lower === 'add_ons') {
          g = 'Add On';
        }
      }
      if (!g) g = 'Modifier';
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(c);
    }
    const getExplicitScreenOrder = (opts: any[]): number | null => {
      for (const o of opts) {
        const ca = String(o?.created_at || '');
        const m = ca.match(/^2020-01-01T00:(\d{2}):/);
        if (m) {
          const ord = parseInt(m[1], 10);
          if (ord > 0) return ord;
        }
      }
      return null;
    };
    const groupPriority = (name: string, opts: any[]) => {
      const explicitOrd = getExplicitScreenOrder(opts);
      if (explicitOrd !== null) return explicitOrd;
      const lower = name.toLowerCase();
      if (lower === 'milk') return 110;
      if (lower === 'coffee' || lower === 'coffee type' || lower === 'your coffee') return 120;
      if (lower === 'syrups' || lower === 'syrup') return 130;
      if (lower.startsWith('remove')) return 190;
      const isReq = opts.some(o => o.is_required);
      const isMulti = opts.some(o => o.is_multi_select);
      if (isReq && !isMulti) return 140;
      if (isReq && isMulti) return 150;
      if (!isMulti) return 160;
      return 170;
    };
    return Object.entries(grouped).sort(([aName, aOpts], [bName, bOpts]) => {
      const pa = groupPriority(aName, aOpts);
      const pb = groupPriority(bName, bOpts);
      if (pa !== pb) return pa - pb;
      return aName.localeCompare(bName);
    });
  }, [productCustomizations]);

  const handleReorderModifierScreen = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= modifierScreenGroups.length || toIdx >= modifierScreenGroups.length) {
      return;
    }
    const currentOrder = modifierScreenGroups.map(([gName]) => gName);
    const [moved] = currentOrder.splice(fromIdx, 1);
    currentOrder.splice(toIdx, 0, moved);

    const markerByGroup = new Map<string, string>();
    currentOrder.forEach((gName, idx) => {
      markerByGroup.set(gName, new Date(Date.UTC(2020, 0, 1, 0, idx + 1, 0)).toISOString());
    });

    setProductCustomizations(prev =>
      prev.map(c => {
        const g = (c.option_group_name || c.group_name || 'Modifier').trim() || 'Modifier';
        const marker = markerByGroup.get(g);
        return marker ? { ...c, created_at: marker } : c;
      })
    );

    if (activeModifierScreenIdx === fromIdx) {
      setActiveModifierScreenIdx(toIdx);
    } else if (fromIdx < activeModifierScreenIdx && toIdx >= activeModifierScreenIdx) {
      setActiveModifierScreenIdx(activeModifierScreenIdx - 1);
    } else if (fromIdx > activeModifierScreenIdx && toIdx <= activeModifierScreenIdx) {
      setActiveModifierScreenIdx(activeModifierScreenIdx + 1);
    }

    if (productId) {
      await api.saveProductModifierScreenOrder(Number(productId), currentOrder);
    }
  };

  // Finished Good Mapping State
  const [fgItemId, setFgItemId] = useState('');
  const [fgRatio, setFgRatio] = useState('1.0');
  const [inventoryMode, setInventoryMode] = useState<InventoryMode>('NONE');
  const [conversions, setConversions] = useState<any[]>([]);
  const [packagingOptions, setPackagingOptions] = useState<any[]>([]);
  const [configurationLoading, setConfigurationLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [configurationError, setConfigurationError] = useState('');
  const [modifierRevision, setModifierRevision] = useState(0);
  const [manageModifiers, setManageModifiers] = useState(false);
  const [savedComponents, setSavedComponents] = useState('[]');
  const [savedRecipeInventory, setSavedRecipeInventory] = useState('');
  const [savedMapping, setSavedMapping] = useState('');
  const [savedRecipeId, setSavedRecipeId] = useState(id || '');
  const [prepDraft, setPrepDraft] = useState<{ item: any; name: string; quantity: string; unit: string } | null>(null);
  const linkedProductionRecipe = resolveReferenceRecipe({ name: itemName }, productionRecipes);
  const isPrepDocumentation = !productId && (isProduction || !!linkedProductionRecipe);
  const selectedProduct = allProducts.find(p => Number(p.id) === Number(productId));
  const busy = deleting || saving || activating || configurationLoading || effectSaving;
  const recipeFingerprint = JSON.stringify([productId, yieldQuantity, yieldUnit]);
  const mappingFingerprint = JSON.stringify([fgItemId, fgRatio]);
  const inventoryDirty = inventoryMode !== (selectedProduct?.inventory_mode || 'NONE') ||
    (inventoryMode === 'NONE' && selectedProduct?.inventory_applies === true) ||
    (inventoryMode === 'RECIPE' && (savedComponents !== JSON.stringify(components) || savedRecipeInventory !== recipeFingerprint)) ||
    (inventoryMode === 'FINISHED_GOOD' && savedMapping !== mappingFingerprint);
  const hasConfiguredModifiers = productCustomizations.length > 0;
  const configurationProblem = !productId ? (isPrepDocumentation ? null : 'Link a menu product.') : inventoryMode === 'FINISHED_GOOD'
    ? validateMapping(fgItemId, fgRatio, rawItems)
    : inventoryMode === 'RECIPE' ? (!positiveNumber(yieldQuantity) ? 'Yield quantity must be positive.' :
      (components.length > 0 ? validateComponents(components, rawItems, conversions) : (!hasConfiguredModifiers ? 'BOM must have at least one ingredient or configured modifier option.' : null)) || (bomStatus !== 'ACTIVE' ? 'Activate the BOM after saving.' : null)) : null;
  const readiness = configurationLoading ? 'LOADING' : (loadError || configurationError || configurationProblem) ? 'INCOMPLETE'
    : isPrepDocumentation ? 'DOCUMENTATION ONLY' : inventoryDirty ? 'UNSAVED CHANGES' : inventoryMode === 'NONE' ? 'NOT TRACKED' : 'READY';

  const recipeFileRef = React.useRef<HTMLInputElement | null>(null);

  const handleImportRecipeSpreadsheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const res = await parseRecipeExcelOrCsv(file, rawItems, conversions, packagingOptions);
    if (!res.success) {
      alert(`Recipe spreadsheet import failed with ${res.errors.length} error(s):\n\n• ` + res.errors.slice(0, 8).join('\n• ') + (res.errors.length > 8 ? `\n...and ${res.errors.length - 8} more` : ''));
      return;
    }
    if (res.data.length > 0) {
      if (res.recipeName && !itemName) {
        setItemName(res.recipeName);
      }
      const newComponents = res.data.map(d => ({
        id: crypto.randomUUID(),
        item_id: d.item_id,
        base_quantity: d.base_quantity,
        unit: d.unit,
        location_id: '',
        waste_percentage: d.waste_percentage,
        notes: d.notes || ''
      }));
      setComponents(prev => [...prev, ...newComponents]);
      alert(`Successfully imported ${res.data.length} recipe ingredient(s) with validated units!`);
    }
  };

  const handleInhouseImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingInhouse(true);
    const res = await api.uploadTrainingMedia(file);
    setUploadingInhouse(false);
    
    if (res.success && res.url) {
      setInhouseImageUrl(res.url);
    } else {
      alert(res.error || 'Failed to upload inhouse image.');
    }
  };

  const handleDeliveryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingDelivery(true);
    const res = await api.uploadTrainingMedia(file);
    setUploadingDelivery(false);
    
    if (res.success && res.url) {
      setDeliveryImageUrl(res.url);
    } else {
      alert(res.error || 'Failed to upload delivery image.');
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setProductCustomizations([]); setSelectedCustomizationId(null); setModifierEffects([]);
    setFgItemId(''); setFgRatio('1.0'); setSavedMapping(''); setConfigurationError('');
    setPrepDraft(null);
    if (!productId) { setConfigurationLoading(false); return; }
    setConfigurationLoading(true);
    Promise.all([api.getProductCustomizationsList(Number(productId)), api.getProductInventoryItemMapping(Number(productId))])
      .then(([mods, mapping]) => {
        if (cancelled) return;
        if (!mods.success || !mapping.success) throw new Error(mods.error || mapping.error || 'Could not load product inventory configuration.');
        const cList = mods.data || [];
        setProductCustomizations(cList);
        setSelectedCustomizationId(cList[0]?.id || null);
        if (cList.length > 0) {
          api.getAllProductModifierEffects(cList.map((c: any) => c.id)).then(effRes => {
            if (!cancelled && effRes.success) setAllProductModifierEffects(effRes.data || []);
          });
        } else {
          setAllProductModifierEffects([]);
        }
        const item = mapping.data?.item_id || '', ratio = String(mapping.data?.conversion_ratio ?? 1);
        setFgItemId(item); setFgRatio(ratio); setSavedMapping(JSON.stringify([item, ratio]));
      }).catch(e => { if (!cancelled) setConfigurationError(e.message); })
      .finally(() => { if (!cancelled) setConfigurationLoading(false); });
    return () => { cancelled = true; };
  }, [productId]);

  useEffect(() => {
    let cancelled = false;
    if (!productId || !modifierRevision) return;
    api.getProductCustomizationsList(Number(productId)).then(res => {
      if (cancelled) return;
      if (!res.success) { setConfigurationError(res.error || 'Could not reload modifiers.'); return; }
      const cList = res.data || [];
      setProductCustomizations(cList);
      setSelectedCustomizationId(cList[0]?.id || null);
      if (cList.length > 0) {
        api.getAllProductModifierEffects(cList.map((c: any) => c.id)).then(effRes => {
          if (!cancelled && effRes.success) setAllProductModifierEffects(effRes.data || []);
        });
      }
    });
    return () => { cancelled = true; };
  }, [productId, modifierRevision]);

  useEffect(() => {
    let cancelled = false;
    setModifierEffects([]);
    setEditingEffectId(null);
    setEditEffectDraft(null);
    if (selectedCustomizationId) {
      const selectedCustomization = productCustomizations.find(c => c.id === selectedCustomizationId);
      if (selectedCustomization) {
        const isRemove = selectedCustomization.customization_type === 'remove' ||
          selectedCustomization.customization_type === 'removal' ||
          (selectedCustomization.option_group_name || '').toLowerCase().includes('remove');
        setNewEffectType(isRemove ? 'REMOVE' : 'ADD');
      }
      api.getModifierInventoryEffectsList(selectedCustomizationId).then(res => {
        if (cancelled) return;
        if (res.success) setModifierEffects(res.data || []);
        else setConfigurationError(res.error || 'Could not load modifier effects.');
      });
    }
    return () => { cancelled = true; };
  }, [selectedCustomizationId, modifierRevision, productCustomizations]);

  const handleAddModifierEffect = async () => {
    if (busy || inventoryMode !== 'RECIPE' || !productCustomizations.some(c => c.id === selectedCustomizationId)) return;
    const absQty = Math.abs(Number(newEffectQty));
    const effectError = validateComponents([{ item_id: newEffectItem, base_quantity: absQty, unit: newEffectUnit }], rawItems, conversions);
    if (effectError) { alert(effectError); return; }
    if (!selectedCustomizationId || !newEffectItem || !newEffectQty || isNaN(absQty) || absQty <= 0) {
      alert('Please select an item and enter quantity delta.');
      return;
    }
    setEffectSaving(true);
    const res = await api.saveModifierInventoryEffect({
      product_customization_id: selectedCustomizationId,
      item_id: newEffectItem,
      effect_type: newEffectType,
      quantity_delta: absQty,
      unit: newEffectUnit,
      location_id: newEffectLocation || null
    });
    setEffectSaving(false);
    if (res.success) {
      setNewEffectQty('');
      const list = await api.getModifierInventoryEffectsList(selectedCustomizationId);
      if (list.success) setModifierEffects(list.data || []);
    } else {
      alert(res.error || 'Failed to save modifier effect');
    }
  };

  const handleStartEditModifierEffect = (eff: any) => {
    setEditingEffectId(eff.id);
    setEditEffectDraft({
      item_id: eff.item_id || '',
      effect_type: (eff.effect_type === 'REMOVE' ? 'REMOVE' : 'ADD'),
      quantity_delta: String(eff.quantity_delta ?? ''),
      unit: eff.unit || 'g',
      location_id: eff.location_id || ''
    });
  };

  const handleSaveEditedModifierEffect = async () => {
    if (!editingEffectId || !editEffectDraft || !selectedCustomizationId || busy) return;
    const absQty = Math.abs(Number(editEffectDraft.quantity_delta));
    const effectError = validateComponents(
      [{ item_id: editEffectDraft.item_id, base_quantity: absQty, unit: editEffectDraft.unit }],
      rawItems,
      conversions
    );
    if (effectError) {
      alert(effectError);
      return;
    }
    setEffectSaving(true);
    const res = await api.saveModifierInventoryEffect({
      id: editingEffectId,
      product_customization_id: selectedCustomizationId,
      item_id: editEffectDraft.item_id,
      effect_type: editEffectDraft.effect_type,
      quantity_delta: absQty,
      unit: editEffectDraft.unit,
      location_id: editEffectDraft.location_id || null
    });
    setEffectSaving(false);
    if (res.success) {
      setEditingEffectId(null);
      setEditEffectDraft(null);
      const list = await api.getModifierInventoryEffectsList(selectedCustomizationId);
      if (list.success) setModifierEffects(list.data || []);
    } else {
      alert(res.error || 'Failed to update modifier effect');
    }
  };

  const handleDeleteModifierEffect = async (effectId: string) => {
    if (!window.confirm('Delete this modifier inventory effect?')) return;
    const res = await api.deleteModifierInventoryEffect(effectId);
    if (res.success && selectedCustomizationId) {
      if (editingEffectId === effectId) {
        setEditingEffectId(null);
        setEditEffectDraft(null);
      }
      const list = await api.getModifierInventoryEffectsList(selectedCustomizationId);
      if (list.success) setModifierEffects(list.data || []);
    }
  };

  const handleCopyModifiersFromProduct = async () => {
    if (!productId || !copySourceProductId || copyingModifiers) return;
    setCopyingModifiers(true);
    try {
      const res = await api.copyProductModifiersAndEffects(Number(copySourceProductId), Number(productId));
      if (!res.success) {
        alert(res.error || 'Failed to copy modifiers from product.');
        return;
      }
      setModifierRevision(r => r + 1);
      setCopySourceProductId('');
      alert(`Copied modifiers and inventory effects (${res.totalSourceModifiers || 0} modifier(s), ${res.copiedEffectsCount || 0} new inventory delta(s)).`);
    } finally {
      setCopyingModifiers(false);
    }
  };

  const handleSyncEffectsToAllProducts = async () => {
    if (!selectedCustomizationId || syncingAllProducts) return;
    const currentMod = productCustomizations.find(c => c.id === selectedCustomizationId);
    const modLabel = currentMod?.ingredient || currentMod?.name || 'this modifier';

    if (newEffectItem && newEffectQty && Number(newEffectQty) > 0) {
      alert(`You have an unsaved inventory delta below. Please click the "Add Delta" button first so "${modLabel}" has a saved delta before applying it to all other products.`);
      return;
    }

    if (modifierEffects.length === 0) {
      alert(`There are no inventory deltas saved for "${modLabel}" yet. Add a delta using the form below, click "Add Delta", and then click this button to propagate it to all other products.`);
      return;
    }

    if (!window.confirm(`Apply the current inventory deltas (${modifierEffects.length} item(s)) for "${modLabel}" to all other products in your menu that use "${modLabel}"?`)) return;
    setSyncingAllProducts(true);
    try {
      const res = await api.applyModifierEffectsToAllMatchingProducts(selectedCustomizationId);
      if (!res.success) {
        alert(res.error || 'Failed to sync modifier effects.');
        return;
      }
      alert(`Synced "${modLabel}" inventory deltas to ${res.updatedProductsCount || 0} other product(s).`);
    } finally {
      setSyncingAllProducts(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [secRes, recRes, deptRes, empRes, prodRes, itemRes, locRes, prRes, conversionRes, pkgRes, vatRes] = await Promise.all([
        api.getMenuSections(),
        api.getMenuRecipes(),
        api.getDepartmentsList(),
        api.getAllUsers(),
        api.getProductsSimpleList(),
        api.getInventoryItemsSimpleList(),
        api.getInventoryLocationsSimpleList(),
        api.getProductionRecipesList(),
        api.getInventoryUnitConversions(),
        api.getAllItemPackagingOptions(),
        api.getVatRate()
      ]);

      for (const result of [secRes, recRes, prodRes, itemRes, locRes, prRes, conversionRes]) {
        if (!result.success) throw new Error(result.error || 'Required configuration could not be loaded.');
      }
      setConversions(conversionRes.data || []);
      if (pkgRes?.success) setPackagingOptions(pkgRes.data || []);
      if (vatRes?.success && vatRes.rate != null) setVatRate(Number(vatRes.rate));
      if (secRes.success) setSections(secRes.data || []);
      if (recRes.success && recRes.data) setAllRecipes(recRes.data.filter((r: any) => r.id !== id));
      if (deptRes.success && deptRes.data) setAllDepartments([{name: 'All'}, ...deptRes.data]);
      if (empRes.success) setAllUsers(empRes.data || []);
      if (prodRes.success) setAllProducts(prodRes.data || []);
      if (itemRes.success) setRawItems(itemRes.data || []);
      if (locRes.success) setInventoryLocations(locRes.data || []);
      if (prRes?.success) setProductionRecipes(prRes.data || []);

      if (isEditing && id) {
        const res = await api.getMenuRecipeById(id);
        if (!res.success || !res.data) throw new Error(res.error || 'Recipe could not be loaded.');
        if (res.success && res.data) {
          const recipe = res.data;
          setItemName(recipe.item_name || '');
          setSectionId(recipe.section_id || '');
          setRecipeText(recipe.recipe_text || '');
          setPrepTime(recipe.prep_time || '');
          setPlateType(recipe.plate_type || '');
          const linkedProd = prodRes.data?.find((p: any) => p.id === recipe.product_id);
          setFoodCost(recipe.food_cost ? String(recipe.food_cost) : '');
          setSellingPrice(linkedProd?.price != null && Number(linkedProd.price) > 0 ? String(linkedProd.price) : (recipe.selling_price ? String(recipe.selling_price) : ''));
          setPlatingInstructions(recipe.plating_instructions || '');
          setHints(recipe.hints || '');
          setAllergens(recipe.allergens || '');
          setInhouseImageUrl(recipe.inhouse_image_url || recipe.image_url || '');
          setDeliveryImageUrl(recipe.delivery_image_url || '');
          setIsProduction(recipe.is_production || false);
          setPreparationSteps(recipe.preparation_steps || '');
          setPackagingInstructions(recipe.packaging_instructions || '');
          setQualityStandards(recipe.quality_standards || '');
          setAccessDepartments(recipe.access_departments || ['All']);
          setAccessEmployees(recipe.access_employees || []);
          setReferenceRecipes(recipe.reference_recipes || []);

          // Phase 2 Fields
          setProductId(recipe.product_id || '');
          setInventoryMode(linkedProd?.inventory_mode || 'NONE');
          setSavedRecipeInventory(JSON.stringify([recipe.product_id || '', Number(recipe.yield_quantity ?? 1), recipe.yield_unit || 'portion']));
          if (recipe.yield_quantity) setYieldQuantity(Number(recipe.yield_quantity));
          if (recipe.yield_unit) setYieldUnit(recipe.yield_unit);
          if (recipe.bom_status) setBomStatus(recipe.bom_status);

          // Load components
          const compRes = await api.getRecipeComponents(id);
          if (!compRes.success) throw new Error(compRes.error || 'BOM could not be loaded.');
          if (compRes.success && compRes.data) {
            setComponents(compRes.data);
            setSavedComponents(JSON.stringify(compRes.data));
          }
        }
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load inventory configuration.');
    }
    setLoading(false);
  };

  // Helper: compute detailed ingredient cost factoring in waste % and VAT
  const computeCostDetail = (itemId: string, qty: number, unit: string, wastePercentage: number = 0) => {
    const item = rawItems.find(i => i.id === itemId);
    if (!item || !qty) return { costExclVat: 0, costWithVat: 0, vatAmount: 0, isVatApplicable: false, unitCost: 0, unitCostWithVat: 0 };
    const { unitCost } = resolveItemEffectiveCost(itemId, rawItems, productionRecipes, conversions, packagingOptions);
    const itemPrice = unitCost || Number(item.price_usd) || 0;
    if (!itemPrice) return { costExclVat: 0, costWithVat: 0, vatAmount: 0, isVatApplicable: false, unitCost: 0, unitCostWithVat: 0 };
    const factor = conversionFactor(itemId, unit, item.unit || item.base_unit, conversions, packagingOptions);
    if (factor === null) return { costExclVat: NaN, costWithVat: NaN, vatAmount: NaN, isVatApplicable: false, unitCost: 0, unitCostWithVat: 0 };
    const wasteFactor = wastePercentage > 0 && wastePercentage < 100 ? 1 / (1 - wastePercentage / 100) : 1;
    const costExclVat = qty * factor * itemPrice * wasteFactor;
    const isVatApplicable = item.vat === 'yes';
    const vatMultiplier = isVatApplicable ? (1 + vatRate / 100) : 1;
    const costWithVat = costExclVat * vatMultiplier;
    return {
      costExclVat,
      costWithVat,
      vatAmount: costWithVat - costExclVat,
      isVatApplicable,
      unitCost: itemPrice,
      unitCostWithVat: itemPrice * vatMultiplier
    };
  };

  // Helper: compute ingredient cost (returns cost with VAT)
  const computeCost = (itemId: string, qty: number, unit: string, wastePercentage: number = 0) => {
    const detail = computeCostDetail(itemId, qty, unit, wastePercentage);
    return detail.costWithVat;
  };

  // Total Calculated Food Cost from BOM (Excl. VAT and With VAT)
  const bomCostSummary = useMemo(() => {
    let sumExcl = 0;
    let sumWithVat = 0;
    components.forEach(c => {
      const detail = computeCostDetail(c.item_id, Number(c.base_quantity) || 0, c.unit || 'g', Number(c.waste_percentage) || 0);
      if (!isNaN(detail.costExclVat)) sumExcl += detail.costExclVat;
      if (!isNaN(detail.costWithVat)) sumWithVat += detail.costWithVat;
    });
    return {
      totalExclVat: Math.round(sumExcl * 1000) / 1000,
      totalWithVat: Math.round(sumWithVat * 1000) / 1000,
      totalVat: Math.round((sumWithVat - sumExcl) * 1000) / 1000
    };
  }, [components, rawItems, conversions, productionRecipes, packagingOptions, vatRate]);

  const totalBomCost = bomCostSummary.totalWithVat;

  // Finished Good costing calculation (resolves from catalog price or production prep recipe)
  const mappedFgItem = useMemo(() => rawItems.find(i => i.id === fgItemId), [rawItems, fgItemId]);
  const fgCostInfo = useMemo(() => {
    if (!fgItemId) return { unitCost: 0, isFromProductionRecipe: false };
    return resolveItemEffectiveCost(fgItemId, rawItems, productionRecipes, conversions, packagingOptions);
  }, [fgItemId, rawItems, productionRecipes, conversions, packagingOptions]);
  const fgItemCost = fgCostInfo.unitCost || Number(mappedFgItem?.price_usd || 0);
  const fgRatioNum = Number(fgRatio) || 1;
  const fgVatMultiplier = mappedFgItem?.vat === 'yes' ? (1 + vatRate / 100) : 1;
  const totalFgCost = Math.round(fgItemCost * fgRatioNum * fgVatMultiplier * 1000) / 1000;

  // Effective Selling Price (Linked POS product price is authoritative, falls back to manual selling_price)
  const effectiveSellingPrice = useMemo(() => {
    if (selectedProduct?.price != null && Number(selectedProduct.price) > 0) return Number(selectedProduct.price);
    if (sellingPrice && Number(sellingPrice) > 0) return Number(sellingPrice);
    return null;
  }, [sellingPrice, selectedProduct]);

  // Variant Costing Matrix: Calculates Base Recipe + Every Modifier Option with VAT
  const modifierVariants = useMemo(() => {
    const rawGroups: Record<string, { groupName: string; options: any[] }> = {};

    productCustomizations.forEach(c => {
      const gName = (c.option_group_name || c.group_name || 'Options').trim();
      const lowerType = (c.customization_type || '').toLowerCase();
      if (lowerType === 'remove' || lowerType === 'removal' || gName.toLowerCase().includes('remove')) return;

      if (!rawGroups[gName]) {
        rawGroups[gName] = { groupName: gName, options: [] };
      }

      const effects = allProductModifierEffects.filter(e => e.product_customization_id === c.id);
      let modCostExcl = 0;
      let modCostWithVat = 0;
      const effectsBreakdown: Array<{ name: string; qty: number; unit: string; costExcl: number; costWithVat: number; isVat: boolean }> = [];

      effects.forEach(eff => {
        const effQty = Number(eff.quantity_delta) || 0;
        const compUnit = eff.unit || 'g';
        const calc = computeCostDetail(eff.item_id, effQty, compUnit, 0);
        if (!isNaN(calc.costExclVat)) {
          modCostExcl += calc.costExclVat;
          modCostWithVat += calc.costWithVat;
          const matchItem = rawItems.find(i => i.id === eff.item_id);
          effectsBreakdown.push({
            name: matchItem?.name || eff.items?.name || 'Item',
            qty: effQty,
            unit: compUnit,
            costExcl: calc.costExclVat,
            costWithVat: calc.costWithVat,
            isVat: calc.isVatApplicable
          });
        }
      });

      const surcharge = Number(c.price ?? c.price_delta) || 0;

      rawGroups[gName].options.push({
        id: c.id,
        name: c.ingredient || c.option_name || c.name || `Option #${c.id}`,
        surcharge,
        modCostExcl,
        modCostWithVat,
        isStandard: surcharge === 0,
        effectsCount: effects.length,
        effectsBreakdown
      });
    });

    const activeGroups = Object.values(rawGroups).filter(g => g.options.some(o => o.effectsCount > 0));

    // Calculate baseline standard cost from each other group so drink cost reflects the complete drink!
    const standardCostByGroup: Record<string, number> = {};
    activeGroups.forEach(g => {
      const std = g.options.find(o => o.isStandard && o.effectsCount > 0);
      standardCostByGroup[g.groupName] = std ? std.modCostWithVat : 0;
    });

    const totalStandardAllGroups = Object.values(standardCostByGroup).reduce((sum, c) => sum + c, 0);

    // Finalize variant options with full multi-group drink pricing and margins
    return activeGroups.map(g => {
      const otherGroupsStdCost = totalStandardAllGroups - (standardCostByGroup[g.groupName] || 0);

      const enrichedOptions = g.options.map(opt => {
        const basePrice = Number(effectiveSellingPrice) || 0;
        const variantPrice = basePrice + opt.surcharge;
        // Total Drink Cost = Base BOM + Other Groups Standard Options (e.g. coffee beans) + This Option (e.g. oat milk)
        const variantCostWithVat = Math.round((bomCostSummary.totalWithVat + otherGroupsStdCost + opt.modCostWithVat) * 1000) / 1000;
        const variantCostExclVat = Math.round((bomCostSummary.totalExclVat + opt.modCostExcl) * 1000) / 1000;
        const foodCostPct = variantPrice > 0 ? (variantCostWithVat / variantPrice) * 100 : null;
        const grossMargin = variantPrice > 0 ? variantPrice - variantCostWithVat : null;

        return {
          ...opt,
          variantPrice,
          variantCostWithVat,
          variantCostExclVat,
          otherGroupsStdCost,
          foodCostPct,
          grossMargin
        };
      });

      return {
        groupName: g.groupName,
        options: enrichedOptions
      };
    });
  }, [productCustomizations, allProductModifierEffects, bomCostSummary, effectiveSellingPrice, rawItems, conversions, productionRecipes, packagingOptions, vatRate]);

  // Standard Build Benchmark across all groups (sums all $0 standard modifier choices, e.g. Regular Coffee + Full Fat Milk)
  const standardVariantsList = useMemo(() => {
    const list: any[] = [];
    for (const g of modifierVariants) {
      const std = g.options.find(o => o.isStandard && o.effectsCount > 0);
      if (std) list.push({ ...std, groupName: g.groupName });
    }
    return list;
  }, [modifierVariants]);

  const standardModifiersCostWithVat = useMemo(() => {
    return standardVariantsList.reduce((sum, v) => sum + v.modCostWithVat, 0);
  }, [standardVariantsList]);

  // Standard beverage cost includes base BOM + standard modifier option for EVERY group (e.g. Base BOM + Regular Coffee + Full Fat Milk)
  const standardDrinkCost = Math.round((bomCostSummary.totalWithVat + standardModifiersCostWithVat) * 1000) / 1000;
  const standardVariant = standardVariantsList[0] || null;

  // Interactive Simulator: dynamically builds any combination of Coffee, Milk, Syrups, etc.
  const simulatedDrink = useMemo(() => {
    const basePrice = Number(effectiveSellingPrice) || 0;
    let totalSurcharges = 0;
    let totalModifierCostExclVat = 0;
    let totalModifierCostWithVat = 0;
    const selectedOptionsDetails: Array<{
      groupName: string;
      optionId: number;
      optionName: string;
      surcharge: number;
      costWithVat: number;
      effectsBreakdown: any[];
    }> = [];
    const allEffectsBreakdown: any[] = [];

    modifierVariants.forEach(g => {
      let selectedId = selectedSimulatorOptions[g.groupName];
      if (selectedId === undefined) {
        // Default to standard $0 option if available, otherwise null
        const std = g.options.find(o => o.isStandard && o.effectsCount > 0);
        selectedId = std ? std.id : null;
      }

      if (selectedId) {
        const option = g.options.find(o => o.id === selectedId);
        if (option) {
          totalSurcharges += option.surcharge;
          totalModifierCostExclVat += option.modCostExcl;
          totalModifierCostWithVat += option.modCostWithVat;
          selectedOptionsDetails.push({
            groupName: g.groupName,
            optionId: option.id,
            optionName: option.name,
            surcharge: option.surcharge,
            costWithVat: option.modCostWithVat,
            effectsBreakdown: option.effectsBreakdown
          });
          allEffectsBreakdown.push(...option.effectsBreakdown);
        }
      }
    });

    const totalCostWithVat = Math.round((bomCostSummary.totalWithVat + totalModifierCostWithVat) * 1000) / 1000;
    const totalCostExclVat = Math.round((bomCostSummary.totalExclVat + totalModifierCostExclVat) * 1000) / 1000;
    const totalPrice = Math.round((basePrice + totalSurcharges) * 100) / 100;
    const grossMargin = totalPrice > 0 ? Math.round((totalPrice - totalCostWithVat) * 100) / 100 : null;
    const foodCostPct = totalPrice > 0 ? Math.round((totalCostWithVat / totalPrice) * 1000) / 10 : null;

    // Standard benchmark comparison
    const stdPrice = basePrice;
    const stdCost = standardDrinkCost;
    const stdMargin = stdPrice > 0 ? Math.round((stdPrice - stdCost) * 100) / 100 : null;
    const marginDiffVsStandard = grossMargin != null && stdMargin != null ? Math.round((grossMargin - stdMargin) * 100) / 100 : null;

    return {
      basePrice,
      totalSurcharges,
      totalPrice,
      baseCostWithVat: bomCostSummary.totalWithVat,
      totalModifierCostWithVat,
      totalCostWithVat,
      totalCostExclVat,
      grossMargin,
      foodCostPct,
      selectedOptionsDetails,
      allEffectsBreakdown,
      marginDiffVsStandard,
      stdCost: standardDrinkCost,
      stdMargin
    };
  }, [modifierVariants, selectedSimulatorOptions, bomCostSummary, effectiveSellingPrice, standardDrinkCost]);

  // Active Calculated Food Cost depending on Inventory Mode
  const activeCalculatedCost = useMemo(() => {
    if (inventoryMode === 'RECIPE') return standardDrinkCost;
    if (inventoryMode === 'FINISHED_GOOD') return totalFgCost;
    return 0;
  }, [inventoryMode, standardDrinkCost, totalFgCost]);

  // Effective Food Cost (Manual input falls back to calculated BOM / FG cost)
  const effectiveFoodCost = useMemo(() => {
    if (foodCost && Number(foodCost) > 0) return Number(foodCost);
    if (activeCalculatedCost > 0) return activeCalculatedCost;
    return null;
  }, [foodCost, activeCalculatedCost]);

  // Financial Metrics: Gross Profit & Margin & Pricing Factor
  const financialMetrics = useMemo(() => {
    if (effectiveSellingPrice == null) return null;
    const cost = effectiveFoodCost ?? 0;
    const profit = effectiveSellingPrice - cost;
    const marginPct = effectiveSellingPrice > 0 ? (profit / effectiveSellingPrice) * 100 : 0;
    const costPct = effectiveSellingPrice > 0 ? (cost / effectiveSellingPrice) * 100 : 0;
    const factor = cost > 0 ? Math.round((effectiveSellingPrice / cost) * 100) / 100 : null;
    return {
      sellingPrice: effectiveSellingPrice,
      foodCost: effectiveFoodCost,
      profit: Math.round(profit * 100) / 100,
      marginPct: Math.round(marginPct * 10) / 10,
      costPct: Math.round(costPct * 10) / 10,
      factor
    };
  }, [effectiveSellingPrice, effectiveFoodCost]);

  // Directive 3 & 4: Authoritative classification (PRODUCTION if output_item_id in production_recipes)
  const getItemClassification = (itemId: string) => {
    const item = rawItems.find(i => i.id === itemId);
    if (!item) return { type: 'RAW', label: 'RAW', color: '#b45309', bg: '#fef3c7', border: '#fde68a' };

    const prodRecipe = productionRecipes.find(pr => pr.output_item_id === item.id);
    if (prodRecipe) {
      return {
        type: 'PRODUCTION',
        label: 'PRODUCTION',
        color: '#047857',
        bg: '#d1fae5',
        border: '#a7f3d0',
        recipeName: prodRecipe.name,
        recipeId: prodRecipe.id
      };
    }

    return { type: 'INVENTORY', label: 'INVENTORY ITEM', color: '#475569', bg: '#f1f5f9', border: '#e2e8f0' };
  };

  // Directive 6: Double-counting warning (production prep item + raw ingredients of that prep)
  const doubleCountingWarnings = useMemo(() => {
    const warnings: string[] = [];
    components.forEach(comp => {
      const prodRecipe = productionRecipes.find(pr => pr.output_item_id === comp.item_id);
      if (prodRecipe && prodRecipe.production_recipe_items && prodRecipe.production_recipe_items.length > 0) {
        const rawIngredientIds = prodRecipe.production_recipe_items.map((pri: any) => pri.item_id);
        const overlapping = components.filter(c => c.item_id !== comp.item_id && rawIngredientIds.includes(c.item_id));
        if (overlapping.length > 0) {
          const prepItem = rawItems.find(i => i.id === comp.item_id);
          const rawNames = overlapping.map(c => rawItems.find(i => i.id === c.item_id)?.name || 'Unknown').join(', ');
          warnings.push(`This product contains both prep item "${prepItem?.name || prodRecipe.name}" and raw ingredient(s) used in that recipe (${rawNames}). Verify this is intentional (e.g. extra garnish vs duplicate entry).`);
        }
      }
    });
    return warnings;
  }, [components, productionRecipes, rawItems]);

  // Directive 7: Hard activation / save validation blocks
  const validateBomComponents = (comps: any[]) => validateComponents(comps, rawItems, conversions);

  const handleAddPrepToBom = (outputItem: any, recipeName: string) => {
    if (inventoryMode !== 'RECIPE' || busy) return;
    if (components.some(c => c.item_id === outputItem.id)) { alert('This output item is already in the BOM. Edit its quantity there.'); return; }
    setPrepDraft({ item: outputItem, name: recipeName, quantity: '', unit: outputItem.base_unit || outputItem.unit || '' });
  };
  const confirmPrepComponent = () => {
    if (!prepDraft) return;
    const component = { 
      id: crypto.randomUUID(),
      item_id: prepDraft.item.id, 
      base_quantity: Number(prepDraft.quantity), 
      unit: prepDraft.unit,
      location_id: prepDraft.item.default_inventory_location_id || '', 
      waste_percentage: 0, 
      notes: 'Prep component from ' + prepDraft.name 
    };
    const error = validateBomComponents([...components, component]);
    if (error) { alert(error); return; }
    setComponents([...components, component]); setPrepDraft(null);
  };

  const handleAddIngredient = () => {
    if (rawItems.length === 0) return;
    const firstItem = rawItems[0];
    const defaultUnit = firstItem.preferred_recipe_unit || firstItem.base_unit || firstItem.unit || 'g';
    setComponents([
      ...components,
      {
        id: crypto.randomUUID(),
        item_id: firstItem.id,
        base_quantity: 100,
        unit: defaultUnit,
        location_id: firstItem.default_inventory_location_id || '',
        waste_percentage: 0,
        notes: ''
      }
    ]);
  };

  const handleUpdateComponent = (index: number, field: string, val: any) => {
    const updated = [...components];
    updated[index] = { ...updated[index], [field]: val };
    if (field === 'item_id') {
      const match = rawItems.find(i => i.id === val);
      if (match) {
        updated[index].unit = match.preferred_recipe_unit || match.base_unit || match.unit || updated[index].unit;
        if (match.default_inventory_location_id) {
          updated[index].location_id = match.default_inventory_location_id;
        }
      }
    }
    setComponents(updated);
  };

  const handleRemoveComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const persistConfiguration = async () => {
    if (loadError || configurationError || configurationLoading) throw new Error(loadError || configurationError || 'Wait for configuration to load.');
    if (!itemName.trim() || !sectionId) throw new Error('Item Name and Menu Section are required.');
    if (inventoryMode === 'FINISHED_GOOD') {
      const error = validateMapping(fgItemId, fgRatio, rawItems);
      if (error) throw new Error(error);
    }
    if (inventoryMode === 'RECIPE' || savedComponents !== JSON.stringify(components)) {
      if (!positiveNumber(yieldQuantity) || !yieldUnit.trim()) throw new Error('Enter a positive yield quantity and unit.');
      if (components.length > 0) {
        const error = validateBomComponents(components);
        if (error) throw new Error(error);
        const unitResult = await api.validateRecipeComponentUnits(components, rawItems);
        if (!unitResult.success) throw new Error(unitResult.error);
      } else if (bomStatus === 'ACTIVE' && productCustomizations.length === 0) {
        throw new Error('BOM must have at least one ingredient or configured modifier option.');
      }
    }
    const previousMode = selectedProduct?.inventory_mode || 'NONE';
    const modeNeedsSave = previousMode !== inventoryMode || (inventoryMode === 'NONE' && selectedProduct?.inventory_applies === true);
    if (productId && modeNeedsSave && !window.confirm(
      'Change ' + selectedProduct?.name + ' from ' + previousMode + ' to ' + inventoryMode + '? Existing recipes and finished-good mappings will be preserved. Sales will use only the selected mode.' +
      (previousMode === 'RECIPE' ? ' Any active recipe will stop driving sales inventory.' : '') +
      (inventoryMode === 'NONE' ? ' Legacy product stock tracking will also be disabled. Packaging keeps its separate configuration.' : '')
    )) return null;
    const user = JSON.parse(localStorage.getItem('neo_admin_user') || '{}');
    const finalRecipeText = recipeText || 'Recipe details in BOM';
    const payload = {
      id: savedRecipeId || crypto.randomUUID(),
      section_id: sectionId,
      item_name: itemName,
      recipe_text: finalRecipeText || 'Recipe details in BOM',
      prep_time: prepTime,
      plate_type: plateType,
      food_cost: foodCost ? Number(foodCost) : (activeCalculatedCost > 0 ? activeCalculatedCost : null),
      selling_price: selectedProduct?.price != null && Number(selectedProduct.price) > 0 ? Number(selectedProduct.price) : (sellingPrice ? Number(sellingPrice) : null),
      plating_instructions: platingInstructions,
      hints: hints,
      allergens: allergens,
      inhouse_image_url: inhouseImageUrl,
      image_url: inhouseImageUrl,
      delivery_image_url: deliveryImageUrl,
      is_production: isProduction,
      preparation_steps: preparationSteps,
      packaging_instructions: packagingInstructions,
      quality_standards: qualityStandards,
      access_departments: accessDepartments,
      access_employees: accessEmployees,
      reference_recipes: referenceRecipes,
      product_id: productId ? Number(productId) : null,
      yield_quantity: Number(yieldQuantity),
      yield_unit: yieldUnit || 'portion',
      bom_status: bomStatus || 'DRAFT',
      updated_by: user.name,
      ...(savedRecipeId ? {} : { created_by: user.name })
    };

    const res = await api.saveMenuRecipe(payload);
    if (!res.success || !res.data?.id) throw new Error(res.error || 'Recipe save was not confirmed.');
    const targetId = res.data.id;
    setSavedRecipeId(targetId);
    // Unchanged historical BOMs are untouched; valid unsaved edits survive a mode change.
    if (savedComponents !== JSON.stringify(components)) {
      const result = await api.saveRecipeComponents(targetId, components);
      if (result.data) setComponents(result.data);
      if (!result.success) throw new Error(result.error);
      setSavedComponents(JSON.stringify(result.data || []));
    }
    if (inventoryMode === 'FINISHED_GOOD' && savedMapping !== mappingFingerprint) {
      const result = await api.saveProductInventoryItemMapping(Number(productId), fgItemId, Number(fgRatio));
      if (!result.success) throw new Error(result.error);
      setSavedMapping(mappingFingerprint);
    }
    // Switch routing last, after the selected configuration has been saved successfully.
    if (productId && modeNeedsSave) {
      const result = await api.saveProductInventoryMode(Number(productId), inventoryMode, previousMode);
      if (!result.success) throw new Error(result.error);
      setAllProducts(prev => prev.map(p => p.id === productId ? { ...p, inventory_mode: inventoryMode, ...(inventoryMode === 'NONE' ? { inventory_applies: false } : {}) } : p));
    }
    if (productId && selectedProduct?.is_active === false) {
      await api.updateCrmProduct(Number(productId), { is_active: true, status: 'Available' });
      setAllProducts(prev => prev.map(p => Number(p.id) === Number(productId) ? { ...p, is_active: true, status: 'Available' } : p));
    }
    if (inventoryMode === 'RECIPE' && productId && (components.length > 0 || productCustomizations.length > 0) && bomStatus !== 'ACTIVE') {
      const actRes = await api.activateMenuRecipe(targetId);
      if (actRes.success) {
        setBomStatus('ACTIVE');
      }
    }
    setSavedRecipeInventory(recipeFingerprint);
    return targetId;
  };

  const handleActivateBOM = async () => {
    if (busy) return;
    if (!productId || inventoryMode !== 'RECIPE') { alert('This product is not configured for recipe inventory tracking.'); return; }
    if (components.length > 0) {
      const error = validateBomComponents(components);
      if (error) { alert(error); return; }
    } else if (productCustomizations.length === 0) {
      alert('BOM must have at least one ingredient or configured modifier option.');
      return;
    }
    setActivating(true);
    try {
      const targetId = await persistConfiguration();
      if (!targetId) return;
      const result = await api.activateMenuRecipe(targetId);
      if (!result.success) throw new Error(result.error);
      setBomStatus('ACTIVE');
      alert('BOM saved and activated.');
    } catch (e) { alert('Activation stopped: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setActivating(false); }
  };

  const handleSave = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (busy) return;
    setSaving(true);
    try {
      const targetId = await persistConfiguration();
      if (targetId) navigate('/menu');
    } catch (e) { alert('Save incomplete. Some earlier steps may have saved; your edits remain available. ' + (e instanceof Error ? e.message : String(e))); }
    finally { setSaving(false); }
  };

  const addRef = (val: string) => {
    if (!val) return;
    const matchMenu = allRecipes.find(r => r.id === val);
    const matchProd = productionRecipes.find(pr => pr.id === val);
    const matchName = matchMenu?.item_name || matchProd?.name;
    if (matchName && !referenceRecipes.some(r => r.id === val || r.name.toLowerCase() === matchName.toLowerCase())) {
      setReferenceRecipes([...referenceRecipes, { id: val, name: matchName }]);
    }

  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="spin" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/menu')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', backgroundColor: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ChefHat size={28} style={{ color: 'var(--primary)' }} /> {isEditing ? 'Edit Recipe & BOM' : 'New Recipe & BOM'}
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
              Manage product inventory tracking, recipes, prep quantities and costs.
            </p>
          </div>
        </div>

        {/* Header Actions */}
        {canDelete && id && (
          <RecipeDeleteButton 
            kind="menu" 
            recipeId={id} 
            name={itemName} 
            linkedProductName={selectedProduct?.name ? `${selectedProduct.name} (#${selectedProduct.id})` : undefined}
            disabled={busy || !!loadError} 
            onBusyChange={setDeleting} 
            onDeleted={() => navigate('/menu', { replace: true })} 
          />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {inventoryMode === 'RECIPE' && (bomStatus === 'ACTIVE' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#dcfce7', color: '#15803d', padding: '8px 16px', borderRadius: '20px', fontWeight: 700, fontSize: '14px' }}>
              <CheckCircle size={18} /> ACTIVE BOM
            </div>
          ) : (
            <button
              type="button"
              onClick={handleActivateBOM}
              disabled={busy || !!loadError || !!configurationError}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              title="Save and activate this BOM for sales consumption"
            >
              {activating ? <Loader2 size={16} className="spin" /> : <Layers size={16} />} Activate BOM
            </button>
          ))}

          <button 
            type="button"
            onClick={handleSave} 
            disabled={busy || !!loadError || !!configurationError}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
          >
            {saving ? <Loader2 size={18} className="spin" /> : <Save size={18} />} Save Configuration
          </button>
        </div>
      </div>

      {(loadError || configurationError) && <div role="alert" style={{ padding: 16, color: '#b91c1c' }}>{loadError || configurationError} <button type="button" onClick={() => window.location.reload()}>Reload</button></div>}
      <fieldset disabled={busy || !!loadError || !!configurationError} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.2fr)', gap: '24px' }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Section 1: Basic Information */}
          <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Basic Information</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Item Name *</label>
                <input style={inputStyle} value={itemName} onChange={e => setItemName(e.target.value)} required placeholder="e.g. Caesar Salad" />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={labelStyle}>Menu Section *</label>
                  <button
                    type="button"
                    onClick={async () => {
                      const name = window.prompt('Enter new Menu Section name (e.g. Pastry, Cakes, Bakery):');
                      if (!name || !name.trim()) return;
                      try {
                        const res = await api.createMenuSection({ name: name.trim(), department: 'Kitchen' });
                        if (!res.success) {
                          alert(res.error || 'Failed to create section');
                          return;
                        }
                        const updated = await api.getMenuSections();
                        if (updated.success && updated.data) {
                          setSections(updated.data);
                        }
                        setSectionId(String(res.data.id));
                      } catch (err: any) {
                        alert(`Error creating section: ${err.message}`);
                      }
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, padding: 0 }}
                  >
                    + New Section
                  </button>
                </div>
                <select style={inputStyle} value={sectionId} onChange={e => setSectionId(e.target.value)} required>
                  <option value="">Select Section...</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {/* Product Link & BOM Config */}
            <div style={{ padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, color: '#0369a1', fontSize: '15px' }}>Linked Menu Product (ERP / Sales Engine)</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: bomStatus === 'ACTIVE' ? '#15803d' : '#b45309' }}>
                  {inventoryMode === 'RECIPE' ? 'BOM Status: ' + bomStatus : ''}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ ...labelStyle, color: '#0284c7', marginBottom: 0 }}>Select Product *</label>
                    {!productId && itemName.trim() && !allProducts.some(p => (p.name || '').trim().toLowerCase() === itemName.trim().toLowerCase()) && (
                      <button
                        type="button"
                        onClick={async () => {
                          const priceStr = window.prompt(`Enter selling price ($) for new POS Menu Product "${itemName.trim()}":`, String(sellingPrice || 5));
                          if (priceStr === null) return;
                          const priceNum = Number(priceStr) || 0;
                          const secName = (sections.find(s => String(s.id) === String(sectionId))?.name || '').toLowerCase();
                          const defaultCatId = secName.includes('coffee') ? 26 : (allProducts.find(p => p.category_id)?.category_id || 26);
                          const res = await api.createCrmProduct({
                            name: itemName.trim(),
                            category_id: defaultCatId,
                            price: priceNum,
                            unit_price_usd: priceNum,
                            is_active: true,
                            status: 'Available',
                            inventory_mode: 'RECIPE'
                          });
                          if (res.success && res.data) {
                            const created = res.data;
                            setAllProducts(prev => [...prev, created]);
                            setProductId(Number(created.id));
                            setInventoryMode('RECIPE');
                            if (priceNum > 0) setSellingPrice(priceNum);
                          } else {
                            alert('Failed to create POS Menu Product: ' + (res.error || 'Unknown error'));
                          }
                        }}
                        style={{
                          fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                          borderRadius: '6px', border: '1px solid #0284c7',
                          backgroundColor: '#e0f2fe', color: '#0369a1', cursor: 'pointer'
                        }}
                      >
                        + Create POS Product "{itemName.trim()}"
                      </button>
                    )}
                  </div>
                  <SearchableSelect aria-label="Linked menu product" 
                    style={inputStyle} 
                    value={productId} 
                    disabled={bomStatus === 'ACTIVE'}
                    onValueChange={value => {
                      const next = value ? Number(value) : '';
                      if (inventoryDirty && !window.confirm('Switch linked product? Unsaved mode and mapping edits will be discarded; BOM edits stay with this recipe.')) return;
                      setProductId(next);
                      const nextProd = allProducts.find(p => Number(p.id) === next);
                      setInventoryMode(nextProd?.inventory_mode || 'NONE');
                      if (nextProd?.price != null) {
                        setSellingPrice(String(nextProd.price));
                      }
                    }}
                  >
                    <option value="">-- No Linked Product --</option>
                    {allProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (#{p.id})
                      </option>
                    ))}
                  </SearchableSelect>
                </div>
                {inventoryMode === 'RECIPE' && <><div>
                  <label style={{ ...labelStyle, color: '#0284c7' }}>Yield Quantity</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    style={inputStyle} 
                    value={yieldQuantity} 
                    onChange={e => setYieldQuantity(Number(e.target.value))} 
                  />
                </div>
                <div>
                  <label style={{ ...labelStyle, color: '#0284c7' }}>Yield Unit</label>
                  <select style={inputStyle} value={yieldUnit} onChange={e => setYieldUnit(e.target.value)}>
                    <option value="portion">portion</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="l">L</option>
                    <option value="pcs">pcs</option>
                  </select>
                </div>
                </>}
              </div>
              <label style={labelStyle}>Inventory Mode
                <select aria-label="Inventory Mode" style={inputStyle} value={inventoryMode} disabled={!productId} onChange={e => { setInventoryMode(e.target.value as InventoryMode); setPrepDraft(null); }}>
                  {inventoryModes.map(mode => <option key={mode} value={mode}>{mode}</option>)}
                </select>
              </label>
              <p style={{ margin: 0, fontSize: 13 }}>Mode and configuration changes are saved together with Save Configuration. Existing BOMs and mappings are preserved.</p>
              {inventoryMode === 'NONE' && !isPrepDocumentation && <p>Inventory Tracking: None. {selectedProduct?.inventory_applies ? 'Legacy stock tracking is currently enabled. Save Configuration to disable it.' : 'Sales of this product will not affect product inventory.'} Packaging follows its separate configuration.</p>}
            </div>
          </div>

          <div aria-label="Inventory readiness" style={{ backgroundColor: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <strong style={{ fontSize: 16 }}>{selectedProduct?.name || itemName || 'Select a product'}</strong>
                {isPrepDocumentation ? <p style={{ margin: '4px 0 0 0' }}>This is kitchen documentation for a prep recipe. No sellable menu product is required.</p> : <p style={{ margin: '4px 0 0 0' }}>Inventory Mode: <span style={{ fontWeight: 600 }}>{productId ? inventoryMode : 'UNLINKED'}</span></p>}
                {isPrepDocumentation && <a href={linkedProductionRecipe ? '#/production-recipes/' + linkedProductionRecipe.id : '#/production-recipes'} target="_blank" rel="noreferrer">{linkedProductionRecipe ? 'Edit Production Recipe' : 'Open Production Recipes'} ↗</a>}
                {inventoryMode === 'RECIPE' && <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>BOM: {bomStatus} · Components: {components.length} · Production Components: {components.filter(c => productionRecipes.some(p => p.output_item_id === c.item_id)).length} · Modifiers: {productCustomizations.length}</p>}
                {inventoryMode === 'FINISHED_GOOD' && <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Mapped Inventory Item: <strong style={{ color: '#0f172a' }}>{mappedFgItem?.name || 'NOT SET'}</strong> · Ratio: {fgRatio} {mappedFgItem?.base_unit || mappedFgItem?.unit || 'units'} / sale</p>}
                <div style={{ marginTop: 6 }}>
                  <strong>Inventory Configuration: {readiness}</strong>
                  {configurationProblem && <p style={{ margin: '4px 0 0 0', color: '#dc2626' }}>{configurationProblem}</p>}
                </div>
              </div>

              {/* Live Financial Snapshot Badge Panel */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', backgroundColor: '#ffffff', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ minWidth: 85 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>POS Price</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: effectiveSellingPrice != null ? '#059669' : '#9ca3af' }}>
                    {effectiveSellingPrice != null ? `$${effectiveSellingPrice.toFixed(2)}` : '—'}
                  </div>
                </div>
                <div style={{ minWidth: 85, borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Food Cost</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: effectiveFoodCost != null ? '#1e293b' : '#9ca3af' }}>
                    {effectiveFoodCost != null ? `$${effectiveFoodCost.toFixed(2)}` : '—'}
                  </div>
                </div>
                <div style={{ minWidth: 85, borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Gross Profit</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: financialMetrics && financialMetrics.profit >= 0 ? '#16a34a' : '#dc2626' }}>
                    {financialMetrics ? `$${financialMetrics.profit.toFixed(2)}` : '—'}
                  </div>
                </div>
                <div style={{ minWidth: 85, borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Margin %</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: financialMetrics ? (financialMetrics.marginPct >= 70 ? '#16a34a' : financialMetrics.marginPct >= 50 ? '#ca8a04' : '#dc2626') : '#9ca3af', marginTop: 1 }}>
                    {financialMetrics ? `${financialMetrics.marginPct}%` : '—'}
                  </div>
                </div>
                <div style={{ minWidth: 85, borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Factor</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#2563eb', marginTop: 1 }} title="Pricing Markup Factor (POS Price / Food Cost)">
                    {financialMetrics && financialMetrics.factor ? `${financialMetrics.factor}x` : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {inventoryMode === 'RECIPE' && <>
          {/* Section 2: Structured Bill of Materials (BOM) */}
          <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Structured Recipe BOM (Quantitative Components)</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Ingredients and prep components deducted upon sale. Every stock-driving component must have an explicit quantity and unit.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => generateRecipeTemplate(rawItems)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid var(--border)', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                  title="Download Excel recipe ingredients template"
                >
                  <Download size={15} /> Template
                </button>
                <button
                  type="button"
                  onClick={() => recipeFileRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid var(--border)', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                  title="Import ingredients from Excel or CSV file"
                >
                  <Upload size={15} /> Import Excel / CSV
                </button>
                <input
                  ref={recipeFileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={handleImportRecipeSpreadsheet}
                />
                <button
                  type="button"
                  onClick={handleAddIngredient}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Plus size={16} /> Add Ingredient
                </button>
              </div>
            </div>

            {/* Directive 6: Double-counting warning banner */}
            {doubleCountingWarnings.length > 0 && (
              <div style={{ padding: '12px 16px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {doubleCountingWarnings.map((warn, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#b45309' }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{warn}</span>
                  </div>
                ))}
              </div>
            )}

            {components.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 16px', backgroundColor: hasConfiguredModifiers ? '#f0fdf4' : 'var(--background)', borderRadius: '8px', border: hasConfiguredModifiers ? '1px dashed #86efac' : '1px dashed var(--border)' }}>
                {hasConfiguredModifiers ? (
                  <div>
                    <div style={{ color: '#166534', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                      ✨ Modifier-Driven Recipe (No Fixed Ingredients)
                    </div>
                    <p style={{ color: '#15803d', margin: 0, fontSize: '13px' }}>
                      This product has no fixed base ingredients. Inventory consumption is 100% driven by customer modifier choices (e.g. Decaf vs Regular beans, choice of milk) configured in the <strong>Modifier Inventory Effects</strong> section below.
                    </p>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>No BOM ingredients added yet. Click &quot;Add Ingredient&quot; above to add fixed ingredients, or configure options below.</p>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px' }}>Component / Raw Material</th>
                      <th style={{ padding: '8px', width: '130px' }}>Type</th>
                      <th style={{ padding: '8px', width: '100px' }}>Quantity</th>
                      <th style={{ padding: '8px', width: '100px' }}>Unit</th>
                      <th style={{ padding: '8px', width: '90px' }}>Waste (%)</th>
                      <th style={{ padding: '8px' }}>Location Override</th>
                      <th style={{ padding: '8px', width: '110px' }}>Est. Cost ($)</th>
                      <th style={{ padding: '8px', width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {components.map((comp, idx) => {
                      const item = rawItems.find(i => i.id === comp.item_id);
                      const classification = getItemClassification(comp.item_id);
                      const costDetail = computeCostDetail(comp.item_id, Number(comp.base_quantity) || 0, comp.unit || 'g', Number(comp.waste_percentage) || 0);
                      const cost = costDetail.costWithVat;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px' }}>
                            <SearchableSelect aria-label="BOM inventory item" 
                              style={{ ...inputStyle, padding: '6px 8px' }}
                              value={comp.item_id}
                              onValueChange={value => handleUpdateComponent(idx, 'item_id', value)}
                            >
                              {rawItems.map(it => {
                                const c = getItemClassification(it.id);
                                const tag = c.type === 'PRODUCTION' ? '[PROD] ' : c.type === 'PURCHASED PREP' ? '[PREP] ' : '';
                                return (
                                  <option key={it.id} value={it.id}>
                                    {tag}{it.name} ({it.unit}) {it.price_usd ? `- $${it.price_usd}/${it.unit}` : ''}
                                  </option>
                                );
                              })}
                            </SearchableSelect>
                          </td>
                          <td style={{ padding: '8px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: classification.bg,
                              color: classification.color,
                              border: `1px solid ${classification.border}`
                            }}>
                              {classification.label}
                            </span>
                            {classification.recipeName && (
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                                Prep: {classification.recipeName}
                                <a href={`#/production-recipes/${classification.recipeId}`} target="_blank" rel="noreferrer" style={{ display: 'block', color: 'var(--primary)', marginTop: 4 }}>Edit Production Recipe ↗</a>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input 
                              type="number"
                              step="0.01"
                              style={{ ...inputStyle, padding: '6px 8px' }}
                              value={comp.base_quantity}
                              onChange={e => handleUpdateComponent(idx, 'base_quantity', e.target.value)}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            {(() => {
                              const itemMatch = rawItems.find(i => i.id === comp.item_id);
                              const convertible = itemMatch ? getConvertibleUnits(itemMatch, conversions, packagingOptions) : [comp.unit || 'g'];
                              const baseUnit = itemMatch?.base_unit || itemMatch?.unit || comp.unit;
                              const factor = itemMatch ? conversionFactor(itemMatch.id, comp.unit, baseUnit, conversions, packagingOptions) : 1;
                              const preview = formatConversionPreview(Number(comp.base_quantity), comp.unit, baseUnit, factor);
                              return (
                                <div>
                                  <select 
                                    aria-label="Component unit" 
                                    style={{ ...inputStyle, padding: '6px 8px' }} 
                                    value={comp.unit} 
                                    onChange={e => handleUpdateComponent(idx, 'unit', e.target.value)}
                                  >
                                    {convertible.map(u => (
                                      <option key={u} value={u}>{u}</option>
                                    ))}
                                  </select>
                                  {preview && (
                                    <div style={{ fontSize: '10px', color: '#0284c7', marginTop: '2px', whiteSpace: 'nowrap' }}>
                                      {preview}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <input 
                                type="number"
                                min="0"
                                max="99.9"
                                step="1"
                                placeholder="0"
                                style={{ ...inputStyle, padding: '6px 8px', width: '60px' }}
                                value={comp.waste_percentage ?? 0}
                                onChange={e => handleUpdateComponent(idx, 'waste_percentage', Math.max(0, Math.min(99.9, Number(e.target.value) || 0)))}
                              />
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>%</span>
                            </div>
                          </td>
                          <td style={{ padding: '8px' }}>
                            <select 
                              style={{ ...inputStyle, padding: '6px 8px' }}
                              value={comp.location_id || ''}
                              onChange={e => handleUpdateComponent(idx, 'location_id', e.target.value)}
                            >
                              <option value="">Default Location</option>
                              {inventoryLocations.map(loc => (
                                <option key={loc.id} value={loc.id}>
                                  {loc.name} ({loc.department})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '8px', fontWeight: 600 }}>
                            <div>${cost.toFixed(3)}</div>
                            {costDetail.isVatApplicable && (
                              <div style={{ fontSize: 11, color: '#0284c7', fontWeight: 500 }}>
                                (excl. VAT: ${costDetail.costExclVat.toFixed(3)})
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveComponent(idx)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Total BOM Summary */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginTop: '16px', padding: '14px 18px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, display: 'block' }}>Base BOM Cost (Excl. VAT)</span>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: '#475569' }}>${bomCostSummary.totalExclVat.toFixed(2)}</span>
                    </div>
                    {bomCostSummary.totalVat > 0 && (
                      <div>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#0284c7', fontWeight: 700, display: 'block' }}>VAT ({vatRate}%)</span>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: '#0369a1' }}>+${bomCostSummary.totalVat.toFixed(2)}</span>
                      </div>
                    )}
                    <div>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#0f766e', fontWeight: 700, display: 'block' }}>Base BOM Cost (With VAT)</span>
                      <span style={{ fontSize: '18px', fontWeight: 800, color: '#0f766e' }}>${bomCostSummary.totalWithVat.toFixed(2)}</span>
                    </div>
                    {standardVariantsList.length > 0 && (
                      <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: 16 }}>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#1e40af', fontWeight: 700, display: 'block' }}>
                          Standard Drink Cost ({standardVariantsList.map(v => v.name).join(' + ')})
                        </span>
                        <span style={{ fontSize: '18px', fontWeight: 800, color: '#1e3a8a' }}>${standardDrinkCost.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        const targetCost = standardDrinkCost;
                        const costStr = targetCost.toFixed(2);
                        setFoodCost(costStr);
                        if (id) {
                          try {
                            await api.saveMenuRecipe({ id, food_cost: targetCost });
                            alert(`✅ Synced & Saved Food Cost: $${costStr}${standardVariantsList.length > 0 ? ` (${standardVariantsList.map(v => v.name).join(' + ')} with VAT)` : ' (with VAT)'}`);
                          } catch (e) {
                            alert(`Synced to Food Cost: $${costStr}. Click Save Configuration to persist.`);
                          }
                        } else {
                          alert(`Synced to Food Cost: $${costStr}. Click Save Configuration to save.`);
                        }
                      }}
                      style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '6px', border: '1px solid #93c5fd', backgroundColor: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontWeight: 700 }}
                    >
                      Sync {standardVariantsList.length > 0 ? 'Standard Drink Cost' : 'BOM Cost'} (${standardDrinkCost.toFixed(2)}) ↓
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2.2: Live Drink Cost & Margin Simulator + Variant Costing Matrix */}
          {modifierVariants.length > 0 && (
            <div style={{
              backgroundColor: 'var(--surface)',
              padding: '24px',
              borderRadius: 'var(--radius)',
              border: '1px solid #bfdbfe',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#1e3a8a' }}>
                    <Calculator size={22} style={{ color: '#2563eb' }} /> Live Drink Cost & Margin Simulator
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                    Simulate any customer combination (coffee beans, milk type, syrups, extras) to instantly see the real beverage cost with {vatRate}% VAT, selling price, and gross margin.
                  </p>
                </div>
                {standardVariantsList.length > 0 && (
                  <div style={{ padding: '6px 12px', background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe', fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>
                    Standard Build: <strong>{standardVariantsList.map(v => v.name).join(' + ')}</strong> (${standardDrinkCost.toFixed(2)} with VAT)
                  </div>
                )}
              </div>

              {/* Interactive Simulator Controls & KPI Dashboard */}
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Select Drink Options:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedSimulatorOptions({})}
                    style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, color: '#475569' }}
                    title="Reset to default $0 standard options"
                  >
                    <RotateCcw size={13} /> Reset to Defaults
                  </button>
                </div>

                {/* Option Dropdowns Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  {modifierVariants.map(g => {
                    const defaultStd = g.options.find(o => o.isStandard && o.effectsCount > 0);
                    const currentSelectedId = selectedSimulatorOptions[g.groupName] !== undefined 
                      ? selectedSimulatorOptions[g.groupName] 
                      : (defaultStd ? defaultStd.id : (g.options[0]?.id ?? ''));

                    return (
                      <div key={g.groupName} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {g.groupName}
                        </label>
                        <select
                          value={currentSelectedId ?? ''}
                          onChange={e => {
                            const val = e.target.value ? Number(e.target.value) : null;
                            setSelectedSimulatorOptions(prev => ({ ...prev, [g.groupName]: val }));
                          }}
                          style={{
                            padding: '9px 12px',
                            borderRadius: 6,
                            border: '1px solid #94a3b8',
                            backgroundColor: '#fff',
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#0f172a',
                            outline: 'none',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                          }}
                        >
                          <option value="">-- None / No {g.groupName} --</option>
                          {g.options.map(opt => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name} {opt.surcharge > 0 ? `(+$${opt.surcharge.toFixed(2)})` : '($0)'} — Cost: ${opt.modCostWithVat.toFixed(2)}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>

                {/* KPI Metrics Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  {/* Selling Price */}
                  <div style={{ background: '#fff', padding: '12px 14px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Selling Price</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                      ${simulatedDrink.totalPrice.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Base: ${simulatedDrink.basePrice.toFixed(2)} {simulatedDrink.totalSurcharges > 0 ? `+ Add-ons: $${simulatedDrink.totalSurcharges.toFixed(2)}` : ''}
                    </div>
                  </div>

                  {/* Total Real Cost */}
                  <div style={{ background: '#f0fdfa', padding: '12px 14px', borderRadius: 8, border: '1px solid #99f6e4' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase' }}>Total Real Cost (VAT)</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#0f766e', marginTop: 2 }}>
                      ${simulatedDrink.totalCostWithVat.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 11, color: '#0f766e', marginTop: 2 }}>
                      Base ${simulatedDrink.baseCostWithVat.toFixed(2)} + Options ${simulatedDrink.totalModifierCostWithVat.toFixed(2)}
                    </div>
                  </div>

                  {/* Gross Profit Margin */}
                  <div style={{ background: '#f0fdf4', padding: '12px 14px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Gross Margin ($)</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: simulatedDrink.grossMargin != null && simulatedDrink.grossMargin >= 0 ? '#15803d' : '#dc2626', marginTop: 2 }}>
                      {simulatedDrink.grossMargin != null ? `$${simulatedDrink.grossMargin.toFixed(2)}` : '—'}
                    </div>
                    {simulatedDrink.marginDiffVsStandard != null && simulatedDrink.marginDiffVsStandard !== 0 && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: simulatedDrink.marginDiffVsStandard > 0 ? '#15803d' : '#dc2626', marginTop: 2 }}>
                        {simulatedDrink.marginDiffVsStandard > 0 ? `+` : ``}${simulatedDrink.marginDiffVsStandard.toFixed(2)} vs standard
                      </div>
                    )}
                  </div>

                  {/* Food Cost % */}
                  <div style={{ background: '#fefce8', padding: '12px 14px', borderRadius: 8, border: '1px solid #fef08a' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#854d0e', textTransform: 'uppercase' }}>Food Cost %</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: simulatedDrink.foodCostPct != null && simulatedDrink.foodCostPct > 35 ? '#dc2626' : '#15803d', marginTop: 2 }}>
                      {simulatedDrink.foodCostPct != null ? `${simulatedDrink.foodCostPct.toFixed(1)}%` : '—'}
                    </div>
                    <div style={{ fontSize: 11, color: '#854d0e', marginTop: 2 }}>
                      {simulatedDrink.foodCostPct != null ? (simulatedDrink.foodCostPct <= 30 ? 'Target: Excellent' : simulatedDrink.foodCostPct <= 35 ? 'Target: Normal' : 'Warning: High') : 'Set price'}
                    </div>
                  </div>

                  {/* Pricing Factor */}
                  <div style={{ background: '#eff6ff', padding: '12px 14px', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>Pricing Factor</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#1e3a8a', marginTop: 2 }}>
                      {simulatedDrink.totalCostWithVat > 0 ? `${(simulatedDrink.totalPrice / simulatedDrink.totalCostWithVat).toFixed(2)}x` : '—'}
                    </div>
                    <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 2 }}>
                      Markup (Price / Cost)
                    </div>
                  </div>
                </div>

                {/* Ingredients Depletion Summary */}
                <div style={{ background: '#fff', padding: '12px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                    Depleted Ingredients for this Selected Drink Build:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {components.map((c, i) => {
                      const itm = rawItems.find(r => r.id === c.item_id);
                      const cCost = computeCostDetail(c.item_id, Number(c.base_quantity) || 0, c.unit, Number(c.waste_percentage) || 0);
                      return (
                        <span key={`comp-${i}`} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>
                          <strong>{itm?.name || 'Base'}:</strong> {c.base_quantity} {c.unit} (${cCost.costWithVat.toFixed(2)})
                        </span>
                      );
                    })}
                    {simulatedDrink.allEffectsBreakdown.map((eff, i) => (
                      <span key={`eff-${i}`} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                        <strong>{eff.name}:</strong> {eff.qty} {eff.unit} (${eff.costWithVat.toFixed(2)})
                      </span>
                    ))}
                    {components.length === 0 && simulatedDrink.allEffectsBreakdown.length === 0 && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No ingredients configured yet</span>
                    )}
                  </div>
                </div>

                {/* Apply Button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    onClick={async () => {
                      const costStr = simulatedDrink.totalCostWithVat.toFixed(2);
                      const priceStr = simulatedDrink.totalPrice.toFixed(2);
                      setFoodCost(costStr);
                      setSellingPrice(priceStr);
                      if (id) {
                        try {
                          await api.saveMenuRecipe({ id, food_cost: simulatedDrink.totalCostWithVat, selling_price: simulatedDrink.totalPrice });
                          alert(`✅ Synced & Saved Simulated Configuration to Recipe!\n\nFood Cost: $${costStr}\nSelling Price: $${priceStr}`);
                        } catch (e) {
                          alert(`Applied Food Cost: $${costStr} to inputs below. Click Save Configuration to persist.`);
                        }
                      } else {
                        alert(`Applied Food Cost: $${costStr} to inputs below. Click Save Configuration to save.`);
                      }
                    }}
                    style={{ padding: '8px 16px', fontSize: 13, borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                  >
                    <Sparkles size={14} /> Apply Simulated Cost (${simulatedDrink.totalCostWithVat.toFixed(2)}) to Recipe Details ↓
                  </button>
                </div>
              </div>

              {/* Complete Variant Option Breakdown Matrix */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 15, fontWeight: 700, color: '#334155' }}>
                  All Available Variants by Option Group:
                </h4>
                {modifierVariants.map(group => (
                  <div key={group.groupName} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Option Group:</span> <strong>{group.groupName}</strong>
                    </div>
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: '#475569' }}>
                            <th style={{ padding: '10px 14px' }}>Variant Option</th>
                            <th style={{ padding: '10px 14px' }}>Modifier Surcharge</th>
                            <th style={{ padding: '10px 14px' }}>Drink Price</th>
                            <th style={{ padding: '10px 14px' }}>Modifier Portion & Item</th>
                            <th style={{ padding: '10px 14px' }}>Modifier Cost (VAT)</th>
                            <th style={{ padding: '10px 14px' }}>Total Drink Cost</th>
                            <th style={{ padding: '10px 14px' }}>Food Cost %</th>
                            <th style={{ padding: '10px 14px' }}>Factor</th>
                            <th style={{ padding: '10px 14px' }}>Gross Margin</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>Sync</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.options.map(opt => (
                            <tr key={opt.id} style={{ borderBottom: '1px solid #f1f5f9', background: opt.isStandard ? '#f0fdf4' : '#fff' }}>
                              <td style={{ padding: '10px 14px', fontWeight: 700 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>{opt.name}</span>
                                  {opt.isStandard && (
                                    <span style={{ fontSize: 10, background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                                      STANDARD $0
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '10px 14px', color: opt.surcharge > 0 ? '#0284c7' : 'var(--text-muted)', fontWeight: 600 }}>
                                {opt.surcharge > 0 ? `+$${opt.surcharge.toFixed(2)}` : '$0.00'}
                              </td>
                              <td style={{ padding: '10px 14px', fontWeight: 700 }}>
                                ${opt.variantPrice.toFixed(2)}
                              </td>
                              <td style={{ padding: '10px 14px', color: '#475569' }}>
                                {opt.effectsBreakdown.map((eff, eIdx) => (
                                  <div key={eIdx}>
                                    {eff.qty} {eff.unit} {eff.name}
                                    {eff.isVat && <span style={{ fontSize: 10, color: '#0369a1', marginLeft: 4 }}>({vatRate}% VAT)</span>}
                                  </div>
                                ))}
                              </td>
                              <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                                ${opt.modCostWithVat.toFixed(3)}
                                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>
                                  excl. VAT: ${opt.modCostExcl.toFixed(3)}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f766e', fontSize: 14 }}>
                                ${opt.variantCostWithVat.toFixed(2)}
                                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                                  {opt.otherGroupsStdCost > 0
                                    ? `Base $${bomCostSummary.totalWithVat.toFixed(2)} + ${group.groupName} $${opt.modCostWithVat.toFixed(2)} + Std Other $${opt.otherGroupsStdCost.toFixed(2)}`
                                    : `Base $${bomCostSummary.totalWithVat.toFixed(2)} + Mod $${opt.modCostWithVat.toFixed(2)}`}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', fontWeight: 700, color: opt.foodCostPct && opt.foodCostPct > 35 ? '#dc2626' : '#15803d' }}>
                                {opt.foodCostPct != null ? `${opt.foodCostPct.toFixed(1)}%` : '—'}
                              </td>
                              <td style={{ padding: '10px 14px', fontWeight: 700, color: '#2563eb' }}>
                                {opt.variantCostWithVat > 0 ? `${(opt.variantPrice / opt.variantCostWithVat).toFixed(2)}x` : '—'}
                              </td>
                              <td style={{ padding: '10px 14px', fontWeight: 700, color: opt.grossMargin && opt.grossMargin >= 0 ? '#15803d' : '#dc2626' }}>
                                {opt.grossMargin != null ? `$${opt.grossMargin.toFixed(2)}` : '—'}
                                {opt.surcharge > 0 && standardVariant && opt.grossMargin != null && standardVariant.grossMargin != null && (
                                  <span style={{ display: 'block', fontSize: 11, color: '#0369a1', fontWeight: 600 }}>
                                    +${(opt.grossMargin - standardVariant.grossMargin).toFixed(2)} vs standard
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const targetCost = opt.variantCostWithVat;
                                    const costStr = targetCost.toFixed(2);
                                    const priceStr = opt.variantPrice.toFixed(2);
                                    setFoodCost(costStr);
                                    setSellingPrice(priceStr);
                                    if (id) {
                                      try {
                                        await api.saveMenuRecipe({ id, food_cost: targetCost, selling_price: opt.variantPrice });
                                        alert(`✅ Synced & Saved ${opt.name} Variant!\n\nFood Cost: $${costStr}\nSelling Price: $${priceStr}`);
                                      } catch (e: any) {
                                        alert(`Synced to inputs below (Food Cost: $${costStr}). Click Save Configuration to persist.`);
                                      }
                                    } else {
                                      alert(`Synced to inputs below (Food Cost: $${costStr}). Click Save Configuration to save.`);
                                    }
                                  }}
                                  style={{ padding: '4px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
                                  title="Sync this variant cost to recipe details"
                                >
                                  Sync Cost
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2.5: Modifier Inventory Effects (POS Customizations & BOM Deltas) */}
          <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sliders size={20} style={{ color: 'var(--primary)' }} /> Modifier Inventory Effects (Add-ons, Removals & Substitutions)
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Map POS modifier selections to raw stock inventory deltas. Sales engine automatically computes net recipe consumption.
                </p>
              </div>
            </div>

            {productId && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setManageModifiers(true)}
                  style={{ padding: '8px 14px', backgroundColor: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Sliders size={15} style={{ color: 'var(--primary)' }} /> Manage Product Modifiers ({productCustomizations.length})
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                    <Copy size={14} style={{ color: 'var(--primary)' }} /> Copy Modifiers &amp; Effects from:
                  </span>
                  <div style={{ minWidth: '240px' }}>
                    <SearchableSelect
                      aria-label="Copy modifiers from product"
                      style={{ ...inputStyle, padding: '6px 10px', fontSize: '13px' }}
                      value={copySourceProductId}
                      onValueChange={val => setCopySourceProductId(val)}
                    >
                      <option value="">Select another product…</option>
                      {allProducts
                        .filter(p => Number(p.id) !== Number(productId))
                        .map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </SearchableSelect>
                  </div>
                  <button
                    type="button"
                    disabled={!copySourceProductId || copyingModifiers}
                    onClick={handleCopyModifiersFromProduct}
                    style={{
                      padding: '7px 14px',
                      backgroundColor: copySourceProductId ? 'var(--primary)' : '#e2e8f0',
                      color: copySourceProductId ? '#fff' : '#94a3b8',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: copySourceProductId && !copyingModifiers ? 'pointer' : 'not-allowed',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {copyingModifiers ? 'Copying…' : 'Copy Modifiers & Effects'}
                  </button>
                </div>
              </div>
            )}
            {!productId ? (
              <div style={{ padding: '16px', backgroundColor: '#fef3c7', borderRadius: '6px', border: '1px solid #fde68a', color: '#92400e', fontSize: '14px' }}>
                ℹ️ Link this recipe to a POS Product in <strong>Section 1 (Linked POS Product)</strong> above to configure modifier inventory effects.
              </div>
            ) : productCustomizations.length === 0 ? (
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '14px' }}>
                No modifiers are currently assigned to this product. Click <strong>Manage Product Modifiers</strong> or use <strong>Copy Modifiers &amp; Effects from</strong> above to clone modifiers from another product.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {(() => {
                  const totalScreens = Math.max(modifierScreenGroups.length, 1);
                  const safeScreenIdx = Math.min(Math.max(activeModifierScreenIdx, 0), totalScreens - 1);
                  const activeScreen = modifierScreenGroups[safeScreenIdx];
                  const activeScreenName = activeScreen ? activeScreen[0] : 'Modifiers';
                  const activeScreenOptions: any[] = activeScreen ? activeScreen[1] : productCustomizations;

                  return (
                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Dynamic Modifier Screens ({totalScreens} {totalScreens === 1 ? 'Screen' : 'Screens'}):
                          </span>
                          {modifierScreenGroups.map(([gName, gOpts], idx) => {
                            const isCurrent = idx === safeScreenIdx;
                            const isDragging = draggedScreenIdx === idx;
                            return (
                              <React.Fragment key={gName}>
                                <div
                                  draggable={totalScreens > 1}
                                  onDragStart={() => setDraggedScreenIdx(idx)}
                                  onDragOver={(e) => {
                                    if (totalScreens > 1) e.preventDefault();
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    if (draggedScreenIdx !== null && draggedScreenIdx !== idx) {
                                      handleReorderModifierScreen(draggedScreenIdx, idx);
                                    }
                                    setDraggedScreenIdx(null);
                                  }}
                                  onDragEnd={() => setDraggedScreenIdx(null)}
                                  title={totalScreens > 1 ? 'Drag to reorder screen position or use the arrows' : undefined}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    borderRadius: '8px',
                                    border: isCurrent ? '1px solid var(--primary)' : '1px solid #cbd5e1',
                                    backgroundColor: isCurrent ? 'var(--primary)' : '#ffffff',
                                    opacity: isDragging ? 0.5 : 1,
                                    overflow: 'hidden',
                                    boxShadow: isCurrent ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                  }}
                                >
                                  {totalScreens > 1 && idx > 0 && (
                                    <button
                                      type="button"
                                      title={`Move "${gName}" earlier (Screen ${idx})`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleReorderModifierScreen(idx, idx - 1);
                                      }}
                                      style={{
                                        border: 'none',
                                        borderRight: isCurrent ? '1px solid rgba(255,255,255,0.2)' : '1px solid #e2e8f0',
                                        backgroundColor: 'transparent',
                                        color: isCurrent ? '#ffffff' : '#64748b',
                                        padding: '6px 6px',
                                        fontSize: '10px',
                                        cursor: 'pointer',
                                        fontWeight: 800
                                      }}
                                    >
                                      ◀
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveModifierScreenIdx(idx);
                                      if (gOpts.length > 0) setSelectedCustomizationId(gOpts[0].id);
                                    }}
                                    style={{
                                      padding: '6px 10px',
                                      border: 'none',
                                      backgroundColor: 'transparent',
                                      color: isCurrent ? '#ffffff' : '#334155',
                                      fontSize: '12px',
                                      fontWeight: 700,
                                      cursor: totalScreens > 1 ? 'grab' : 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px'
                                    }}
                                  >
                                    <span style={{
                                      width: '18px',
                                      height: '18px',
                                      borderRadius: '999px',
                                      backgroundColor: isCurrent ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                                      color: isCurrent ? '#fff' : '#475569',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '11px',
                                      fontWeight: 800
                                    }}>
                                      {idx + 1}
                                    </span>
                                    <span>{gName} ({gOpts.length})</span>
                                  </button>
                                  {totalScreens > 1 && idx < totalScreens - 1 && (
                                    <button
                                      type="button"
                                      title={`Move "${gName}" later (Screen ${idx + 2})`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleReorderModifierScreen(idx, idx + 1);
                                      }}
                                      style={{
                                        border: 'none',
                                        borderLeft: isCurrent ? '1px solid rgba(255,255,255,0.2)' : '1px solid #e2e8f0',
                                        backgroundColor: 'transparent',
                                        color: isCurrent ? '#ffffff' : '#64748b',
                                        padding: '6px 6px',
                                        fontSize: '10px',
                                        cursor: 'pointer',
                                        fontWeight: 800
                                      }}
                                    >
                                      ▶
                                    </button>
                                  )}
                                </div>
                                {idx < modifierScreenGroups.length - 1 && (
                                  <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: '13px' }}>→</span>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>

                        {totalScreens > 1 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                              Move "{activeScreenName}":
                            </span>
                            <button
                              type="button"
                              disabled={safeScreenIdx === 0}
                              onClick={() => handleReorderModifierScreen(safeScreenIdx, 0)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: safeScreenIdx === 0 ? '#f1f5f9' : '#ffffff',
                                color: safeScreenIdx === 0 ? '#94a3b8' : '#0f172a',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: safeScreenIdx === 0 ? 'not-allowed' : 'pointer'
                              }}
                            >
                              ⏮ First
                            </button>
                            {totalScreens >= 3 && (
                              <button
                                type="button"
                                disabled={safeScreenIdx === Math.floor(totalScreens / 2)}
                                onClick={() => handleReorderModifierScreen(safeScreenIdx, Math.floor(totalScreens / 2))}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: safeScreenIdx === Math.floor(totalScreens / 2) ? '#f1f5f9' : '#ffffff',
                                  color: safeScreenIdx === Math.floor(totalScreens / 2) ? '#94a3b8' : '#0f172a',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: safeScreenIdx === Math.floor(totalScreens / 2) ? 'not-allowed' : 'pointer'
                                }}
                              >
                                Middle
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={safeScreenIdx >= totalScreens - 1}
                              onClick={() => handleReorderModifierScreen(safeScreenIdx, totalScreens - 1)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: safeScreenIdx >= totalScreens - 1 ? '#f1f5f9' : '#ffffff',
                                color: safeScreenIdx >= totalScreens - 1 ? '#94a3b8' : '#0f172a',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: safeScreenIdx >= totalScreens - 1 ? 'not-allowed' : 'pointer'
                              }}
                            >
                              Last ⏭
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Options in current screen */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '4px', borderTop: '1px dashed #cbd5e1' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', marginRight: '4px' }}>
                          Screen {safeScreenIdx + 1} ({activeScreenName}) Options:
                        </span>
                        {activeScreenOptions.map((opt: any) => {
                          const isSelectedOpt = selectedCustomizationId === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setSelectedCustomizationId(opt.id)}
                              style={{
                                padding: '5px 11px',
                                borderRadius: '6px',
                                border: isSelectedOpt ? '2px solid #0284c7' : '1px solid #cbd5e1',
                                backgroundColor: isSelectedOpt ? '#e0f2fe' : '#ffffff',
                                color: isSelectedOpt ? '#0369a1' : '#334155',
                                fontSize: '12px',
                                fontWeight: isSelectedOpt ? 800 : 600,
                                cursor: 'pointer'
                              }}
                            >
                              {opt.ingredient || opt.option_name || opt.name || `Option #${opt.id}`}
                              {(opt.price ?? opt.price_delta) ? ` (+$${opt.price ?? opt.price_delta})` : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Selected Modifier Option:</label>
                    <SearchableSelect aria-label="Product modifier" 
                      style={{ ...inputStyle, maxWidth: '350px' }}
                      value={selectedCustomizationId || ''}
                      onValueChange={value => {
                        const numVal = value ? Number(value) : null;
                        setSelectedCustomizationId(numVal);
                        if (numVal) {
                          const foundIdx = modifierScreenGroups.findIndex(([, gOpts]) => gOpts.some((o: any) => o.id === numVal));
                          if (foundIdx >= 0) setActiveModifierScreenIdx(foundIdx);
                        }
                      }}
                    >
                      {productCustomizations.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.option_group_name || c.group_name || 'Modifier'}: {c.ingredient || c.option_name || c.name || `Option #${c.id}`} {(c.price ?? c.price_delta) ? `(+${c.price ?? c.price_delta})` : ''}
                        </option>
                      ))}
                    </SearchableSelect>
                  </div>
                  {selectedCustomizationId && (
                    <button
                      type="button"
                      disabled={syncingAllProducts}
                      onClick={handleSyncEffectsToAllProducts}
                      title="Propagate this modifier's inventory deltas to all other products that use this same modifier"
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: syncingAllProducts ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Copy size={13} />
                      {syncingAllProducts ? 'Syncing…' : 'Apply This Modifier’s Deltas to All Products'}
                    </button>
                  )}
                </div>

                {/* Existing effects table */}
                <div style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px 12px' }}>Target Inventory Item</th>
                        <th style={{ padding: '8px 12px', width: '130px' }}>Effect Type</th>
                        <th style={{ padding: '8px 12px', width: '120px' }}>Delta Qty</th>
                        <th style={{ padding: '8px 12px', width: '100px' }}>Unit</th>
                        <th style={{ padding: '8px 12px' }}>Location</th>
                        <th style={{ padding: '8px 12px', width: '100px', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modifierEffects.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No inventory deltas configured for this option. Standard BOM will be consumed without adjustment.
                          </td>
                        </tr>
                      ) : (
                        modifierEffects.map(eff => {
                          const isRowEditing = editingEffectId === eff.id && editEffectDraft !== null;
                          const item = rawItems.find(i => i.id === (isRowEditing ? editEffectDraft.item_id : eff.item_id));
                          const editConvertible = item ? getConvertibleUnits(item, conversions, packagingOptions) : ['g', 'kg', 'ml', 'l', 'pcs'];

                          if (isRowEditing && editEffectDraft) {
                            return (
                              <tr key={eff.id} style={{ borderBottom: '1px solid var(--border)', backgroundColor: '#fffbeb' }}>
                                <td style={{ padding: '8px 10px' }}>
                                  <SearchableSelect
                                    aria-label="Edit modifier inventory item"
                                    style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px' }}
                                    value={editEffectDraft.item_id}
                                    onValueChange={val => {
                                      const match = rawItems.find(it => it.id === val);
                                      setEditEffectDraft(prev => prev ? {
                                        ...prev,
                                        item_id: val,
                                        unit: match ? (match.preferred_recipe_unit || match.base_unit || match.unit || prev.unit) : prev.unit
                                      } : null);
                                    }}
                                  >
                                    <option value="">Select Inventory Item...</option>
                                    {rawItems.map(it => (
                                      <option key={it.id} value={it.id}>
                                        {it.name} ({it.unit})
                                      </option>
                                    ))}
                                  </SearchableSelect>
                                </td>
                                <td style={{ padding: '8px 10px' }}>
                                  <select
                                    style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px' }}
                                    value={editEffectDraft.effect_type}
                                    onChange={e => setEditEffectDraft(prev => prev ? { ...prev, effect_type: e.target.value as 'ADD' | 'REMOVE' } : null)}
                                  >
                                    <option value="ADD">ADD (+qty)</option>
                                    <option value="REMOVE">REMOVE (-qty)</option>
                                  </select>
                                </td>
                                <td style={{ padding: '8px 10px' }}>
                                  <input
                                    type="number"
                                    step="0.01"
                                    style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px' }}
                                    value={editEffectDraft.quantity_delta}
                                    onChange={e => setEditEffectDraft(prev => prev ? { ...prev, quantity_delta: e.target.value } : null)}
                                  />
                                </td>
                                <td style={{ padding: '8px 10px' }}>
                                  <select
                                    style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px' }}
                                    value={editEffectDraft.unit}
                                    onChange={e => setEditEffectDraft(prev => prev ? { ...prev, unit: e.target.value } : null)}
                                  >
                                    {editConvertible.map(u => (
                                      <option key={u} value={u}>{u}</option>
                                    ))}
                                  </select>
                                </td>
                                <td style={{ padding: '8px 10px' }}>
                                  <select
                                    style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px' }}
                                    value={editEffectDraft.location_id}
                                    onChange={e => setEditEffectDraft(prev => prev ? { ...prev, location_id: e.target.value } : null)}
                                  >
                                    <option value="">Default Location</option>
                                    {inventoryLocations.map(loc => (
                                      <option key={loc.id} value={loc.id}>
                                        {loc.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    <button
                                      type="button"
                                      disabled={effectSaving}
                                      onClick={handleSaveEditedModifierEffect}
                                      title="Save changes"
                                      style={{
                                        padding: '4px 8px',
                                        backgroundColor: '#16a34a',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontWeight: 700,
                                        fontSize: '11px',
                                        cursor: effectSaving ? 'wait' : 'pointer'
                                      }}
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      disabled={effectSaving}
                                      onClick={() => { setEditingEffectId(null); setEditEffectDraft(null); }}
                                      title="Cancel editing"
                                      style={{
                                        padding: '4px 6px',
                                        backgroundColor: '#f1f5f9',
                                        color: '#475569',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                      }}
                                    >
                                      <X size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={eff.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                                {item?.name || eff.item_id}
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  backgroundColor: eff.effect_type === 'ADD' ? '#dcfce7' : eff.effect_type === 'REMOVE' ? '#fee2e2' : '#e0e7ff',
                                  color: eff.effect_type === 'ADD' ? '#15803d' : eff.effect_type === 'REMOVE' ? '#b91c1c' : '#4338ca'
                                }}>
                                  {eff.effect_type}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700 }}>
                                {eff.effect_type === 'REMOVE' ? `-${eff.quantity_delta}` : `+${eff.quantity_delta}`}
                              </td>
                              <td style={{ padding: '8px 12px' }}>{eff.unit}</td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                                {inventoryLocations.find(l => l.id === eff.location_id)?.name || 'Default'}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditModifierEffect(eff)}
                                    title="Edit this delta record"
                                    style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: '2px' }}
                                  >
                                    <Edit2 size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteModifierEffect(eff.id)}
                                    title="Delete this delta record"
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Add new effect row */}
                <div style={{ backgroundColor: '#f9fafb', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>+ Add Inventory Delta for Selected Option</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr auto', gap: '8px', alignItems: 'center' }}>
                    <div>
                      <SearchableSelect aria-label="Modifier inventory item" 
                        style={{ ...inputStyle, padding: '6px 8px', fontSize: '13px' }}
                        value={newEffectItem}
                        onValueChange={value => {
                          setNewEffectItem(value);
                          const match = rawItems.find(it => it.id === value);
                          if (match) {
                            setNewEffectUnit(match.preferred_recipe_unit || match.base_unit || match.unit || 'g');
                          }
                        }}
                      >
                        <option value="">Select Inventory Item...</option>
                        {rawItems.map(it => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.unit})
                          </option>
                        ))}
                      </SearchableSelect>
                    </div>
                    <div>
                      <select 
                        style={{ ...inputStyle, padding: '6px 8px', fontSize: '13px' }}
                        value={newEffectType}
                        onChange={e => setNewEffectType(e.target.value as any)}
                      >
                        <option value="ADD">ADD (+qty)</option>
                        <option value="REMOVE">REMOVE (-qty)</option>
                      </select>
                    </div>
                    <div>
                      <input 
                        type="number"
                        step="0.01"
                        placeholder="Quantity"
                        style={{ ...inputStyle, padding: '6px 8px', fontSize: '13px' }}
                        value={newEffectQty}
                        onChange={e => setNewEffectQty(e.target.value)}
                      />
                    </div>
                    <div>
                      {(() => {
                        const sel = rawItems.find(it => it.id === newEffectItem);
                        const convertible = sel ? getConvertibleUnits(sel, conversions, packagingOptions) : ['g', 'kg', 'ml', 'l', 'pcs'];
                        return (
                          <select 
                            style={{ ...inputStyle, padding: '6px 8px', fontSize: '13px' }}
                            value={newEffectUnit}
                            onChange={e => setNewEffectUnit(e.target.value)}
                          >
                            {convertible.map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        );
                      })()}
                    </div>
                    <div>
                      <select 
                        style={{ ...inputStyle, padding: '6px 8px', fontSize: '13px' }}
                        value={newEffectLocation}
                        onChange={e => setNewEffectLocation(e.target.value)}
                      >
                        <option value="">Default Location</option>
                        {inventoryLocations.map(loc => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={handleAddModifierEffect}
                        disabled={effectSaving}
                        style={{ padding: '6px 14px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                      >
                        {effectSaving ? 'Adding...' : 'Add Delta'}
                      </button>
                    </div>
                  </div>

                  {/* Live Conversion Preview for Modifier Effect */}
                  {(() => {
                    const sel = rawItems.find(it => it.id === newEffectItem);
                    if (!sel || !newEffectQty || !newEffectUnit) return null;
                    const base = sel.base_unit || sel.unit;
                    const factor = conversionFactor(sel.id, newEffectUnit, base, conversions, packagingOptions);
                    const preview = formatConversionPreview(Number(newEffectQty), newEffectUnit, base, factor);
                    if (!preview) return null;
                    return (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#0369a1', background: '#e0f2fe', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
                        ℹ️ Modifier delta: {preview}
                      </div>
                    );
                  })()}

                  {/* BOM Validation Warning for REMOVE */}
                  {newEffectType === 'REMOVE' && newEffectItem && !components.some(c => c.item_id === newEffectItem) && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#d97706', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={14} /> Warning: The selected item is not currently in the Base Recipe BOM above. A REMOVE effect on an unlisted ingredient has no stock effect.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          </>}
          {inventoryMode === 'FINISHED_GOOD' && <>
          {/* Section 2.6: Finished Good Direct Inventory Mapping */}
          <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={20} style={{ color: 'var(--primary)' }} /> Direct Finished Good Inventory Mapping
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Choose the stock item sold directly, such as a bottled drink, and how many inventory units each sale uses.
                </p>
              </div>
            </div>

            {!productId ? (
              <div style={{ padding: '16px', backgroundColor: '#fef3c7', borderRadius: '6px', border: '1px solid #fde68a', color: '#92400e', fontSize: '14px' }}>
                ℹ️ Link this recipe to a POS Product in <strong>Section 1</strong> above to configure finished good stock mapping.
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '16px', alignItems: 'flex-end', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div>
                    <label style={labelStyle}>Linked Inventory Balance Catalog Item</label>
                    <SearchableSelect aria-label="Finished good inventory item" 
                      style={inputStyle}
                      value={fgItemId}
                      onValueChange={value => setFgItemId(value)}
                    >
                      <option value="">-- No Direct Finished Good Mapping --</option>
                      {rawItems.map(it => (
                        <option key={it.id} value={it.id}>
                          {it.name} ({it.unit}) {it.sku ? `[SKU: ${it.sku}]` : ''}
                        </option>
                      ))}
                    </SearchableSelect>
                  </div>
                  <div>
                    <label style={labelStyle}>Conversion Ratio (Item Units per Sale)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      style={inputStyle} 
                      value={fgRatio} 
                      onChange={e => setFgRatio(e.target.value)} 
                      placeholder="1.0"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={busy}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                      Save Configuration
                    </button>
                  </div>
                </div>

                {mappedFgItem && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, padding: '14px 18px', backgroundColor: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#1e40af', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          Stock Unit Cost
                          {fgCostInfo.isFromProductionRecipe && (
                            <span style={{ fontSize: 10, background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'none' }}>
                              Prep Recipe: {fgCostInfo.recipeName}
                            </span>
                          )}
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#1e3a8a' }}>
                          ${fgItemCost.toFixed(2)} <span style={{ fontSize: 12, fontWeight: 500, color: '#3b82f6' }}>/ {mappedFgItem.unit || mappedFgItem.base_unit || 'unit'}</span>
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#1e40af', fontWeight: 700, display: 'block' }}>Portion Food Cost</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#1e3a8a' }}>
                          ${totalFgCost.toFixed(2)} <span style={{ fontSize: 12, fontWeight: 500, color: '#3b82f6' }}>({fgRatioNum} × ${fgItemCost.toFixed(2)})</span>
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#1e40af', fontWeight: 700, display: 'block' }}>POS Menu Selling Price</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: effectiveSellingPrice != null ? '#059669' : '#6b7280' }}>
                          {effectiveSellingPrice != null ? `$${effectiveSellingPrice.toFixed(2)}` : 'Not Set in Product'}
                        </span>
                      </div>
                      {effectiveSellingPrice != null && (
                        <div>
                          <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#1e40af', fontWeight: 700, display: 'block' }}>Gross Profit Margin</span>
                          <span style={{ fontSize: 16, fontWeight: 800, color: (effectiveSellingPrice - totalFgCost) >= 0 ? '#16a34a' : '#dc2626' }}>
                            ${(effectiveSellingPrice - totalFgCost).toFixed(2)} <span style={{ fontSize: 12, fontWeight: 600 }}>({effectiveSellingPrice > 0 ? (((effectiveSellingPrice - totalFgCost) / effectiveSellingPrice) * 100).toFixed(1) : 0}%)</span>
                          </span>
                        </div>
                      )}
                      {effectiveSellingPrice != null && totalFgCost > 0 && (
                        <div>
                          <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#1e40af', fontWeight: 700, display: 'block' }}>Factor</span>
                          <span style={{ fontSize: 16, fontWeight: 800, color: '#2563eb' }} title="Pricing Markup Factor (Selling Price / Food Cost)">
                            {(effectiveSellingPrice / totalFgCost).toFixed(2)}x
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const targetCost = totalFgCost > 0 ? totalFgCost : fgItemCost;
                        const costStr = targetCost.toFixed(2);
                        const priceStr = effectiveSellingPrice != null ? effectiveSellingPrice.toFixed(2) : (sellingPrice || '0.00');
                        setFoodCost(costStr);
                        if (effectiveSellingPrice != null) {
                          setSellingPrice(priceStr);
                        }
                        if (id) {
                          try {
                            await api.saveMenuRecipe({
                              id,
                              food_cost: Number(costStr),
                              selling_price: effectiveSellingPrice != null ? Number(priceStr) : undefined
                            });
                            alert(`✅ Synced & Saved!\n\nFood Cost: $${costStr}\nSelling Price: $${priceStr}\n\nSection 3 and report totals have been updated.`);
                          } catch (err: any) {
                            alert(`Synced to Section 3 below (Food Cost: $${costStr}). Click "Save Configuration" to persist.`);
                          }
                        } else {
                          alert(`Synced to Section 3 below (Food Cost: $${costStr}). Click "Save Configuration" to save.`);
                        }
                      }}
                      style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '5px', border: '1px solid #93c5fd', backgroundColor: '#ffffff', color: '#1d4ed8', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Sync Cost to Recipe Details ↓
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          </>}
          {/* Section 3: Costing & Text Instructions */}
          <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Menu & Costing Details</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
              <div><label style={labelStyle}>Prep Time</label><input style={inputStyle} value={prepTime} onChange={e => setPrepTime(e.target.value)} placeholder="e.g. 10 mins" /></div>
              <div><label style={labelStyle}>Plate / Glassware</label><input style={inputStyle} value={plateType} onChange={e => setPlateType(e.target.value)} placeholder="e.g. Deep Bowl" /></div>
              <div>
                <label style={labelStyle}>
                  Food Cost ($)
                  {activeCalculatedCost > 0 && (
                    <button
                      type="button"
                      onClick={() => setFoodCost(String(activeCalculatedCost))}
                      title="Click to copy calculated food cost"
                      style={{ marginLeft: 6, fontSize: 11, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      (Calc: ${activeCalculatedCost.toFixed(2)})
                    </button>
                  )}
                </label>
                <input 
                  type="number" 
                  step="0.01" 
                  style={inputStyle} 
                  value={foodCost} 
                  onChange={e => setFoodCost(e.target.value)} 
                  placeholder={activeCalculatedCost > 0 ? activeCalculatedCost.toFixed(2) : '0.00'} 
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Selling Price ($)
                  {selectedProduct?.price != null && (
                    <button
                      type="button"
                      onClick={() => setSellingPrice(String(selectedProduct.price))}
                      title="Click to copy POS Product price"
                      style={{ marginLeft: 6, fontSize: 11, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      (POS: ${Number(selectedProduct.price).toFixed(2)})
                    </button>
                  )}
                </label>
                <input 
                  type="number" 
                  step="0.01" 
                  style={inputStyle} 
                  value={sellingPrice} 
                  onChange={e => setSellingPrice(e.target.value)} 
                  placeholder={selectedProduct?.price != null ? Number(selectedProduct.price).toFixed(2) : '0.00'} 
                />
              </div>
            </div>

            {Number(sellingPrice) > 0 && Number(foodCost) > 0 && (
              <div style={{ padding: '10px 16px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Active Recipe Metrics:</span>
                <span>Gross Profit: <strong style={{ color: Number(sellingPrice) - Number(foodCost) >= 0 ? '#16a34a' : '#dc2626' }}>${(Number(sellingPrice) - Number(foodCost)).toFixed(2)}</strong></span>
                <span>Margin: <strong>{(((Number(sellingPrice) - Number(foodCost)) / Number(sellingPrice)) * 100).toFixed(1)}%</strong></span>
                <span>Food Cost %: <strong>{((Number(foodCost) / Number(sellingPrice)) * 100).toFixed(1)}%</strong></span>
                <span style={{ color: '#2563eb' }}>Pricing Factor: <strong>{(Number(sellingPrice) / Number(foodCost)).toFixed(2)}x</strong></span>
              </div>
            )}

            <div>
              <label style={labelStyle}>Ingredients Text (Kitchen Display / Manual)</label>
              <textarea style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }} value={recipeText} onChange={e => setRecipeText(e.target.value)} placeholder="Text summary of ingredients for kitchen manual..." />
            </div>

            <div>
              <label style={labelStyle}>Preparation Steps</label>
              <textarea style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }} value={preparationSteps} onChange={e => setPreparationSteps(e.target.value)} placeholder="Step 1: Prep lettuce. Step 2: Toss dressing..." />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Plating Instructions (Dine-in)</label>
                <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={platingInstructions} onChange={e => setPlatingInstructions(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Packaging Instructions (Delivery)</label>
                <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={packagingInstructions} onChange={e => setPackagingInstructions(e.target.value)} />
              </div>
            </div>
          </div>

        </form>

        {/* Right Sidebar: Media & Production Access */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Images Section */}
          <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 700 }}>Images</h3>
            
            <label style={labelStyle}>Inhouse Image</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input style={{ ...inputStyle, flex: 1 }} value={inhouseImageUrl} onChange={e => setInhouseImageUrl(e.target.value)} placeholder="Image URL or upload..." />
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', backgroundColor: 'var(--border)', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 }}>
                {uploadingInhouse ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleInhouseImageUpload} disabled={uploadingInhouse} />
              </label>
            </div>
            {inhouseImageUrl && <img src={inhouseImageUrl} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }} alt="Inhouse" />}
            
            <label style={labelStyle}>Delivery Image</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input style={{ ...inputStyle, flex: 1 }} value={deliveryImageUrl} onChange={e => setDeliveryImageUrl(e.target.value)} placeholder="Image URL or upload..." />
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', backgroundColor: 'var(--border)', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 }}>
                {uploadingDelivery ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleDeliveryImageUpload} disabled={uploadingDelivery} />
              </label>
            </div>
            {deliveryImageUrl && <img src={deliveryImageUrl} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px' }} alt="Delivery" />}
          </div>

          {/* Related / Reference Recipes (Documentation Only) */}
          <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: '8px', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} style={{ color: 'var(--primary)' }} />
              Related / Reference Recipes (Documentation Only)
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px 0', lineHeight: '1.4' }}>
              These references are for kitchen documentation and do not affect inventory or food cost. To consume prep items during sales, add the prep inventory item to the BOM.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {referenceRecipes.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px', textAlign: 'center' }}>
                  No reference recipes attached.
                </div>
              ) : (
                referenceRecipes.map(r => {
                  const referenceProductionRecipe = resolveReferenceRecipe(r, productionRecipes);
                  const outputItem = resolveReferenceOutput(r, productionRecipes, rawItems);
                  const bomComp = outputItem ? components.find(c => c.item_id === outputItem.id) : null;

                  return (
                    <div key={r.id} style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Link2 size={14} style={{ color: 'var(--primary)' }} /> {r.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setReferenceRecipes(referenceRecipes.filter(x => x.id !== r.id))}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px' }}
                          title="Remove reference"
                        >
                          ✕
                        </button>
                      </div>

                      {referenceProductionRecipe && <a href={`#/production-recipes/${referenceProductionRecipe.id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontSize: 13 }}>Edit Production Recipe ↗</a>}
                      {inventoryMode === 'RECIPE' && outputItem ? (
                        bomComp ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#15803d', backgroundColor: '#dcfce7', padding: '6px 10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                            <CheckCircle size={14} />
                            <span>✓ BOM Linked — {outputItem.name} {bomComp.base_quantity} {bomComp.unit}</span>
                          </div>
                        ) : (
                          <div style={{ padding: '8px 10px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px' }}>
                            <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '8px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                              <span>
                                "{itemName || 'This recipe'}" references "{r.name}", but prep item "<strong>{outputItem.name}</strong>" is not currently included in the inventory BOM.
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddPrepToBom(outputItem, r.name)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                backgroundColor: '#0284c7',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              <Plus size={14} /> + Add to BOM as Prep Component ({outputItem.name})
                            </button>
                          </div>
                        )
                      ) : (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {inventoryMode !== 'RECIPE' ? 'Kitchen documentation only. Prep components are used in RECIPE mode.' : 'Kitchen documentation only. Link an output inventory item in the production recipe before adding it to the BOM.'}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <SearchableSelect aria-label="Add reference recipe" style={inputStyle} onValueChange={addRef} value="">
              <option value="">+ Add Reference Recipe...</option>
              {productionRecipes.length > 0 && (
                <optgroup label="Production / Prep Recipes">
                  {productionRecipes.map(pr => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name} {pr.recipe_code ? `(${pr.recipe_code})` : ''}
                    </option>
                  ))}
                </optgroup>
              )}
              {allRecipes.length > 0 && (
                <optgroup label="Menu Item Recipes">
                  {allRecipes.map(r => (
                    <option key={r.id} value={r.id}>{r.item_name}</option>
                  ))}
                </optgroup>
              )}
            </SearchableSelect>
          </div>

          {/* Bottom Controls */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button 
              type="button" 
              onClick={() => navigate('/menu')}
              style={{ padding: '12px 24px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={handleSave} 
              disabled={busy || !!loadError || !!configurationError}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 32px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '16px', cursor: 'pointer' }}
            >
              {saving ? <Loader2 size={20} className="spin" /> : <Save size={20} />}
              Save Configuration
            </button>
          </div>

        </div>
      </div>
      </fieldset>
      {manageModifiers && selectedProduct && <ProductModifierModal product={selectedProduct} onClose={() => { setManageModifiers(false); setModifierRevision(n => n + 1); }} onSaved={() => setModifierRevision(n => n + 1)} />}
      {prepDraft && <div role="dialog" aria-modal="true" aria-label="Add prep component" style={{ position: 'fixed', inset: 0, background: '#0006', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', padding: 24, borderRadius: 12, width: 420, maxWidth: '90vw' }}>
          <h3>Add to BOM as Prep Component</h3>
          <p>{prepDraft.name} → {prepDraft.item.name}</p>
          <label style={labelStyle}>Quantity<input aria-label="Prep quantity" type="number" min="0" step="any" style={inputStyle} value={prepDraft.quantity} onChange={e => setPrepDraft({ ...prepDraft, quantity: e.target.value })} /></label>
          <label style={labelStyle}>Unit<input aria-label="Prep unit" list="inventory-units" style={inputStyle} value={prepDraft.unit} onChange={e => setPrepDraft({ ...prepDraft, unit: e.target.value })} /></label>
          <p>Consumes this output item directly. Its raw ingredients are not consumed again during sales.</p>
          <button type="button" onClick={() => setPrepDraft(null)}>Cancel</button>{' '}
          <button type="button" onClick={confirmPrepComponent}>Add Component</button>
        </div>
      </div>}
      <datalist id="inventory-units">{Array.from(new Set(['g','kg','ml','l','pcs','portion', ...rawItems.map(i => i.base_unit || i.unit), ...conversions.flatMap(c => [c.from_unit,c.to_unit])])).filter(Boolean).map(unit => <option key={unit} value={unit} />)}</datalist>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' };
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '14px', fontFamily: 'inherit', backgroundColor: '#fff' };
