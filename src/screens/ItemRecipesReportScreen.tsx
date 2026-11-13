import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  ChefHat, 
  Search, 
  Printer, 
  Download, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  DollarSign, 
  Clock, 
  RotateCcw, 
  Package, 
  Eye, 
  BookOpen, 
  ExternalLink, 
  Utensils, 
  X,
  Flame,
  Check,
  Coffee,
  Sliders
} from 'lucide-react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { api } from '../api/client';
import { conversionFactor, resolveItemEffectiveCost } from '../utils/inventoryConfiguration';

export interface UnifiedRecipeComponent {
  id: string;
  itemId: string;
  name: string;
  unit: string;
  baseQuantity: number;
  wastePercentage: number;
  effectiveQuantity: number;
  unitCost: number;
  lineCost: number;
  isUnpriced: boolean;
  classification: 'RAW' | 'PRODUCTION' | 'FINISHED_GOOD';
  department?: string;
  locationName?: string;
  notes?: string;
  sortOrder: number;
}

export interface ModifierOptionItem {
  id: string;
  customizationId: number;
  optionName: string;
  groupName: string;
  price: number;
  itemId?: string;
  itemName?: string;
  quantity?: number;
  unit?: string;
  unitCost?: number;
  lineCost?: number;
  department?: string;
}

export interface UnifiedRecipeReportItem {
  id: string;
  rawId: string;
  code?: string;
  name: string;
  type: 'MENU' | 'PRODUCTION';
  inventoryMode: 'RECIPE' | 'FINISHED_GOOD' | 'PRODUCTION' | 'MODIFIERS' | 'NONE';
  isFinishedGood: boolean;
  isModifierDriven: boolean;
  hasMethodOnly: boolean;
  typeLabel: string;
  sectionId?: number | string;
  sectionName: string;
  department: string;
  yieldQuantity: number;
  yieldUnit: string;
  prepTime?: string;
  plateType?: string;
  shelfLife?: string;
  storageTemp?: string;
  allergens?: string;
  sellingPrice: number | null;
  totalCost: number;
  foodCostPercent: number | null;
  grossMargin: number | null;
  bomStatus: 'ACTIVE' | 'DRAFT' | 'INACTIVE';
  isActive: boolean;
  components: UnifiedRecipeComponent[];
  componentCount: number;
  modifierOptions: ModifierOptionItem[];
  modifierOptionCount: number;
  contentStatus: 'COMPLETE' | 'NO_INGREDIENTS' | 'UNPRICED_ITEMS' | 'HIGH_FOOD_COST';
  recipeText?: string;
  preparationSteps?: string;
  platingInstructions?: string;
  packagingInstructions?: string;
  qualityStandards?: string;
  hints?: string;
  imageUrl?: string;
  updatedAt?: string;
  editUrl: string;
}

export default function ItemRecipesReportScreen({ user, permissions }: { user: any; permissions: any }) {
  const [loading, setLoading] = useState(true);
  const [menuRecipes, setMenuRecipes] = useState<any[]>([]);
  const [productionRecipes, setProductionRecipes] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [packagingOptions, setPackagingOptions] = useState<any[]>([]);
  const [sectionsList, setSectionsList] = useState<any[]>([]);
  const [productMappings, setProductMappings] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [customizationsList, setCustomizationsList] = useState<any[]>([]);
  const [modifierEffectsList, setModifierEffectsList] = useState<any[]>([]);
  const [vatRate, setVatRate] = useState<number>(11);

  // Filtering & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [recipeTypeFilter, setRecipeTypeFilter] = useState<'ALL' | 'MENU_BOM' | 'MODIFIER_DRIVEN' | 'FINISHED_GOOD' | 'PRODUCTION'>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [sectionFilter, setSectionFilter] = useState('ALL');
  const [contentStatusFilter, setContentStatusFilter] = useState<'ALL' | 'COMPLETE' | 'NO_INGREDIENTS' | 'UNPRICED' | 'HIGH_FOOD_COST'>('ALL');
  const [allergenFilter, setAllergenFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'cost_desc' | 'cost_asc' | 'food_cost_desc' | 'components_desc' | 'components_asc'>('name');

  // Display Mode: 'cards' | 'table' | 'reverse_lookup'
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'reverse_lookup'>('cards');

  // Expanded items state for cards / rows
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        menuRecipesRes, 
        prodRecipesRes, 
        itemsRes, 
        convRes, 
        packRes, 
        secRes,
        mappingsRes,
        prodsRes,
        custsRes,
        effectsRes,
        vatRes
      ] = await Promise.all([
        api.getMenuRecipes(),
        api.getProductionRecipeCatalog(),
        api.getInventoryItemsSimpleList(),
        api.getInventoryUnitConversions(),
        api.getAllItemPackagingOptions(),
        api.getMenuSections(),
        api.getAllProductInventoryItemMappings(),
        api.getProductsSimpleList(),
        api.getAllProductCustomizations(),
        api.getAllModifierInventoryEffects(),
        api.getVatRate()
      ]);

      if (vatRes?.success && vatRes.rate != null) {
        setVatRate(Number(vatRes.rate));
      }

      if (menuRecipesRes.success && menuRecipesRes.data) {
        setMenuRecipes(menuRecipesRes.data);
      }
      if (prodRecipesRes.success && prodRecipesRes.data) {
        setProductionRecipes(prodRecipesRes.data);
      }
      if (itemsRes.success && itemsRes.data) {
        setCatalogItems(itemsRes.data);
      }
      if (convRes.success && convRes.data) {
        setConversions(convRes.data);
      }
      if (packRes.success && packRes.data) {
        setPackagingOptions(packRes.data);
      }
      if (secRes.success && secRes.data) {
        setSectionsList(secRes.data);
      }
      if (mappingsRes.success && mappingsRes.data) {
        setProductMappings(mappingsRes.data);
      }
      if (prodsRes.success && prodsRes.data) {
        setProductsList(prodsRes.data);
      }
      if (custsRes.success && custsRes.data) {
        setCustomizationsList(custsRes.data);
      }
      if (effectsRes.success && effectsRes.data) {
        setModifierEffectsList(effectsRes.data);
      }
    } catch (e) {
      console.error('Failed to load recipe report data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Helper map for raw catalog items
  const catalogMap = useMemo(() => {
    const map = new Map<string, any>();
    catalogItems.forEach(item => {
      if (item.id) map.set(item.id, item);
    });
    return map;
  }, [catalogItems]);

  // Helper map for sections
  const sectionsMap = useMemo(() => {
    const map = new Map<string, any>();
    sectionsList.forEach(s => {
      map.set(String(s.id), s);
    });
    return map;
  }, [sectionsList]);

  // Helper map for product mappings
  const productMappingsMap = useMemo(() => {
    const map = new Map<number, any>();
    productMappings.forEach(m => {
      if (m.product_id) map.set(Number(m.product_id), m);
    });
    return map;
  }, [productMappings]);

  // Helper map for products
  const productsMap = useMemo(() => {
    const map = new Map<number, any>();
    productsList.forEach(p => {
      if (p.id) map.set(Number(p.id), p);
    });
    return map;
  }, [productsList]);

  // Helper map for products by normalized name (fallback if recipe.product_id is unlinked)
  const productsByNameMap = useMemo(() => {
    const map = new Map<string, any>();
    productsList.forEach(p => {
      if (p.name) map.set(p.name.trim().toLowerCase(), p);
    });
    return map;
  }, [productsList]);

  // Helper map for modifier inventory effects grouped by customization id
  const modifierEffectsMap = useMemo(() => {
    const map = new Map<number, any[]>();
    modifierEffectsList.forEach(eff => {
      const cid = Number(eff.product_customization_id);
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid)!.push(eff);
    });
    return map;
  }, [modifierEffectsList]);

  // Helper map for product customizations grouped by product id
  const productCustomizationsMap = useMemo(() => {
    const map = new Map<number, any[]>();
    customizationsList.forEach(c => {
      const pid = Number(c.product_id);
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(c);
    });
    return map;
  }, [customizationsList]);

  // Set of output_item_ids from production recipes
  const productionOutputItemIds = useMemo(() => {
    return new Set(productionRecipes.map(pr => pr.output_item_id).filter(Boolean));
  }, [productionRecipes]);

  // Component Cost Calculation
  const calculateComponentCost = (
    itemId: string,
    rawQty: number,
    compUnit: string,
    wastePercentage: number = 0,
    itemOverride?: any
  ): { lineCost: number; unitCost: number; effectiveQty: number; isUnpriced: boolean } => {
    const item = itemOverride || catalogMap.get(itemId);
    if (!item || !rawQty) {
      return { lineCost: 0, unitCost: 0, effectiveQty: rawQty, isUnpriced: true };
    }

    const itemUnit = item.unit || item.base_unit || compUnit;
    const factor = conversionFactor(itemId, compUnit, itemUnit, conversions, packagingOptions);
    const { unitCost: effCost } = resolveItemEffectiveCost(itemId, catalogItems, productionRecipes, conversions, packagingOptions);
    const isVatApplicable = item.vat === 'yes';
    const vatMultiplier = isVatApplicable ? (1 + vatRate / 100) : 1;
    const rawUnitPrice = effCost || Number(item.price_usd) || 0;
    const unitPrice = rawUnitPrice * vatMultiplier;
    const isUnpriced = rawUnitPrice <= 0 || factor === null || isNaN(factor);

    const validFactor = factor !== null && !isNaN(factor) ? factor : 1;
    const wasteFactor = wastePercentage > 0 && wastePercentage < 100 
      ? 1 / (1 - wastePercentage / 100) 
      : 1;

    const effectiveQty = rawQty * validFactor * wasteFactor;
    const lineCost = effectiveQty * unitPrice;

    return {
      lineCost: Math.round(lineCost * 1000) / 1000,
      unitCost: unitPrice,
      effectiveQty: Math.round(effectiveQty * 1000) / 1000,
      isUnpriced
    };
  };

  // Build unified recipe list
  const unifiedRecipes: UnifiedRecipeReportItem[] = useMemo(() => {
    const list: UnifiedRecipeReportItem[] = [];

    // 1. Process Menu Recipes (Finished Dishes, Drinks, Finished Goods, Modifier-driven items)
    menuRecipes.forEach(recipe => {
      const secObj = recipe.section_id ? sectionsMap.get(String(recipe.section_id)) : null;
      const sectionName = secObj?.name || recipe.menu_sections?.name || 'Unassigned Section';
      const department = secObj?.department || 'Kitchen';

      const matchedProd = recipe.product_id 
        ? productsMap.get(Number(recipe.product_id)) 
        : productsByNameMap.get((recipe.item_name || '').trim().toLowerCase());
      const pid = matchedProd?.id ? Number(matchedProd.id) : (recipe.product_id ? Number(recipe.product_id) : null);
      const productObj = matchedProd || (pid ? productsMap.get(pid) : null);
      const fgMapping = pid ? productMappingsMap.get(pid) : null;
      const rawComps = recipe.recipe_components || [];
      const prodCustomizations = pid ? (productCustomizationsMap.get(pid) || []) : [];

      // Determine if item is configured as Finished Good direct stock
      const isFinishedGood = productObj?.inventory_mode === 'FINISHED_GOOD' || (rawComps.length === 0 && !!fgMapping);

      const components: UnifiedRecipeComponent[] = [];
      const modifierOptions: ModifierOptionItem[] = [];

      // Process product customizations & modifier inventory effects
      prodCustomizations.forEach(c => {
        const effects = modifierEffectsMap.get(Number(c.id)) || [];
        if (effects.length > 0) {
          effects.forEach((eff: any) => {
            const itemObj = eff.items || catalogMap.get(eff.item_id);
            const itemName = itemObj?.name || 'Inventory Item';
            const qty = Number(eff.quantity_delta) || 0;
            const compUnit = eff.unit || itemObj?.unit || itemObj?.base_unit || 'g';

            const { lineCost, unitCost } = calculateComponentCost(eff.item_id, qty, compUnit, 0, itemObj);

            modifierOptions.push({
              id: `eff-${eff.id}`,
              customizationId: c.id,
              optionName: c.ingredient,
              groupName: c.option_group_name || 'Options',
              price: Number(c.price) || 0,
              itemId: eff.item_id,
              itemName,
              quantity: qty,
              unit: compUnit,
              unitCost,
              lineCost,
              department: itemObj?.department
            });
          });
        } else {
          // Customization option without explicit inventory effect
          modifierOptions.push({
            id: `cust-${c.id}`,
            customizationId: c.id,
            optionName: c.ingredient,
            groupName: c.option_group_name || 'Options',
            price: Number(c.price) || 0
          });
        }
      });

      // If finished good with mapping, add the mapped catalog item
      if (isFinishedGood && fgMapping) {
        const mappedItem = fgMapping.items || catalogMap.get(fgMapping.item_id);
        const qty = Number(fgMapping.conversion_ratio) || 1;
        const compUnit = mappedItem?.unit || mappedItem?.base_unit || 'pcs';
        const { unitCost: effUnitCost } = resolveItemEffectiveCost(fgMapping.item_id, catalogItems, productionRecipes, conversions, packagingOptions);
        const unitCost = effUnitCost || Number(mappedItem?.price_usd) || 0;
        const lineCost = qty * unitCost;

        components.push({
          id: fgMapping.id || `fg-comp-${recipe.id}`,
          itemId: fgMapping.item_id,
          name: mappedItem?.name || 'Direct Stock Item',
          unit: compUnit,
          baseQuantity: qty,
          wastePercentage: 0,
          effectiveQuantity: qty,
          unitCost,
          lineCost: Math.round(lineCost * 1000) / 1000,
          isUnpriced: unitCost <= 0,
          classification: 'FINISHED_GOOD',
          department: mappedItem?.department || department,
          notes: `Direct Finished Good mapping (1 sale = ${qty} ${compUnit})`,
          sortOrder: 0
        });
      } else {
        // Standard multi-ingredient BOM components
        rawComps.forEach((c: any, idx: number) => {
          const itemObj = c.items || catalogMap.get(c.item_id);
          const itemName = itemObj?.name || 'Unknown Item';
          const qty = Number(c.base_quantity) || 0;
          const compUnit = c.unit || itemObj?.unit || itemObj?.base_unit || 'g';
          const wastePct = Number(c.waste_percentage) || 0;

          const { lineCost, unitCost, effectiveQty, isUnpriced } = calculateComponentCost(
            c.item_id,
            qty,
            compUnit,
            wastePct,
            itemObj
          );

          let classification: 'RAW' | 'PRODUCTION' | 'FINISHED_GOOD' = 'RAW';
          if (productionOutputItemIds.has(c.item_id)) {
            classification = 'PRODUCTION';
          }

          components.push({
            id: c.id || `menu-comp-${recipe.id}-${idx}`,
            itemId: c.item_id,
            name: itemName,
            unit: compUnit,
            baseQuantity: qty,
            wastePercentage: wastePct,
            effectiveQuantity: effectiveQty,
            unitCost,
            lineCost,
            isUnpriced,
            classification,
            department: itemObj?.department,
            notes: c.notes,
            sortOrder: c.sort_order ?? idx
          });
        });

        // Also check reference recipes (sub-recipes) if any
        if (recipe.reference_recipes && Array.isArray(recipe.reference_recipes)) {
          recipe.reference_recipes.forEach((ref: any, refIdx: number) => {
            const prod = productionRecipes.find(p => p.id === ref.id || p.name?.toLowerCase() === ref.name?.toLowerCase());
            const outItem = prod?.output_item || (prod?.output_item_id ? catalogMap.get(prod.output_item_id) : null);
            const refName = ref.name || prod?.name || 'Sub-Recipe';
            const alreadyIn = components.some(c => c.name.toLowerCase() === refName.toLowerCase());
            if (!alreadyIn) {
              const qty = Number(ref.quantity || prod?.target_yield_quantity) || 1;
              const unit = ref.unit || prod?.yield_unit || outItem?.unit || 'serving';
              const unitCost = Number(outItem?.price_usd) || 0;
              components.push({
                id: `ref-comp-${recipe.id}-${refIdx}`,
                itemId: prod?.output_item_id || ref.id,
                name: refName,
                unit,
                baseQuantity: qty,
                wastePercentage: 0,
                effectiveQuantity: qty,
                unitCost,
                lineCost: Math.round(qty * unitCost * 1000) / 1000,
                isUnpriced: unitCost <= 0,
                classification: 'PRODUCTION',
                department: prod?.department || outItem?.department || department,
                notes: `Reference Sub-Recipe (${prod?.recipe_code || 'PREP'})`,
                sortOrder: 100 + refIdx
              });
            }
          });
        }
      }

      // Check if item has preparation method or is driven by modifiers
      const hasMethodOnly = components.length === 0 && !isFinishedGood && Boolean(
        recipe.preparation_steps?.trim() || 
        (recipe.recipe_text?.trim() && recipe.recipe_text !== 'Recipe details in BOM')
      );
      const isModifierDriven = components.length === 0 && !isFinishedGood && modifierOptions.length > 0;

      // Base component cost
      let totalCost = components.reduce((sum, c) => sum + c.lineCost, 0);

      // Check if item has standard $0 modifier option (e.g. Full Fat Milk in Milk group)
      const standardModOptions = modifierOptions.filter(m => Number(m.price) === 0 && m.lineCost > 0);
      let standardModifierCost = 0;
      if (standardModOptions.length > 0) {
        const seenGroups = new Set<string>();
        standardModOptions.forEach(m => {
          if (!seenGroups.has(m.groupName)) {
            seenGroups.add(m.groupName);
            standardModifierCost += m.lineCost;
          }
        });
      }

      if (standardModifierCost > 0) {
        totalCost += standardModifierCost;
      } else if (isModifierDriven && modifierOptions.length > 0) {
        const primaryEffects = modifierOptions.filter(o => o.lineCost && o.lineCost > 0);
        if (primaryEffects.length > 0) {
          totalCost = primaryEffects[0].lineCost || 0;
        }
      }

      const roundedTotalCost = Math.round(totalCost * 1000) / 1000;
      
      // Authoritative selling price from linked POS product, fallback to recipe selling_price
      const sellingPrice = (productObj?.price != null && Number(productObj.price) > 0)
        ? Number(productObj.price)
        : (productObj?.unit_price_usd != null && Number(productObj.unit_price_usd) > 0)
        ? Number(productObj.unit_price_usd)
        : (recipe.selling_price ? Number(recipe.selling_price) : null);

      const foodCostPercent = (sellingPrice && sellingPrice > 0)
        ? Math.round((roundedTotalCost / sellingPrice) * 1000) / 10
        : null;
      const grossMargin = (sellingPrice !== null && sellingPrice > 0)
        ? Math.round((sellingPrice - roundedTotalCost) * 100) / 100
        : null;

      // Content Status determination
      let contentStatus: 'COMPLETE' | 'NO_INGREDIENTS' | 'UNPRICED_ITEMS' | 'HIGH_FOOD_COST' = 'COMPLETE';
      if (components.length === 0 && !isFinishedGood && !isModifierDriven && !hasMethodOnly) {
        contentStatus = 'NO_INGREDIENTS';
      } else if (components.some(c => c.isUnpriced)) {
        contentStatus = 'UNPRICED_ITEMS';
      } else if (foodCostPercent !== null && foodCostPercent > 35) {
        contentStatus = 'HIGH_FOOD_COST';
      }

      const inventoryMode = isFinishedGood 
        ? 'FINISHED_GOOD' 
        : isModifierDriven 
        ? 'MODIFIERS' 
        : (productObj?.inventory_mode as any) || (recipe.is_production ? 'PRODUCTION' : 'RECIPE');

      const typeLabel = isFinishedGood 
        ? 'Direct Finished Good' 
        : isModifierDriven 
        ? 'Modifier-Driven Recipe' 
        : hasMethodOnly 
        ? 'Preparation Spec' 
        : 'Menu Product BOM';

      list.push({
        id: `menu-${recipe.id}`,
        rawId: recipe.id,
        name: recipe.item_name || 'Unnamed Recipe',
        type: 'MENU',
        inventoryMode,
        isFinishedGood,
        isModifierDriven,
        hasMethodOnly,
        typeLabel,
        sectionId: recipe.section_id,
        sectionName,
        department,
        yieldQuantity: Number(recipe.yield_quantity) || 1,
        yieldUnit: recipe.yield_unit || 'portion',
        prepTime: recipe.prep_time || '',
        plateType: recipe.plate_type || '',
        allergens: recipe.allergens || '',
        sellingPrice,
        totalCost: roundedTotalCost,
        foodCostPercent,
        grossMargin,
        bomStatus: (recipe.bom_status as any) || (recipe.is_active ? 'ACTIVE' : 'DRAFT'),
        isActive: recipe.is_active !== false,
        components,
        componentCount: components.length,
        modifierOptions,
        modifierOptionCount: modifierOptions.length,
        contentStatus,
        recipeText: recipe.recipe_text,
        preparationSteps: recipe.preparation_steps,
        platingInstructions: recipe.plating_instructions,
        packagingInstructions: recipe.packaging_instructions,
        qualityStandards: recipe.quality_standards,
        hints: recipe.hints,
        imageUrl: recipe.inhouse_image_url || recipe.image_url,
        updatedAt: recipe.updated_at,
        editUrl: `/menu/edit/${recipe.id}`
      });
    });

    // 2. Process Production Recipes (Batch / Sub-recipes / Preps)
    productionRecipes.forEach(pr => {
      const outputItem = pr.output_item || catalogMap.get(pr.output_item_id);
      const department = pr.department || outputItem?.department || 'Kitchen';
      const sectionName = 'Production & Batch Prep';

      const components: UnifiedRecipeComponent[] = (pr.production_recipe_items || []).map((pri: any, idx: number) => {
        const itemObj = pri.items || catalogMap.get(pri.item_id);
        const itemName = itemObj?.name || 'Unknown Item';
        const qty = Number(pri.quantity || pri.base_quantity) || 0;
        const compUnit = pri.unit || pri.base_unit || itemObj?.unit || itemObj?.base_unit || 'g';
        const wastePct = Number(pri.waste_percentage) || 0;

        const { lineCost, unitCost, effectiveQty, isUnpriced } = calculateComponentCost(
          pri.item_id,
          qty,
          compUnit,
          wastePct,
          itemObj
        );

        let classification: 'RAW' | 'PRODUCTION' | 'FINISHED_GOOD' = 'RAW';
        if (productionOutputItemIds.has(pri.item_id)) {
          classification = 'PRODUCTION';
        }

        return {
          id: pri.id || `prod-comp-${pr.id}-${idx}`,
          itemId: pri.item_id,
          name: itemName,
          unit: compUnit,
          baseQuantity: qty,
          wastePercentage: wastePct,
          effectiveQuantity: effectiveQty,
          unitCost,
          lineCost,
          isUnpriced,
          classification,
          department: itemObj?.department,
          notes: pri.notes,
          sortOrder: pri.sort_order ?? idx
        };
      });

      const totalBatchCost = components.reduce((sum, c) => sum + c.lineCost, 0);
      const roundedTotalCost = Math.round(totalBatchCost * 1000) / 1000;
      const targetYield = Number(pr.target_yield_quantity || pr.batch_size) || 1;

      let contentStatus: 'COMPLETE' | 'NO_INGREDIENTS' | 'UNPRICED_ITEMS' | 'HIGH_FOOD_COST' = 'COMPLETE';
      if (components.length === 0) {
        contentStatus = 'NO_INGREDIENTS';
      } else if (components.some(c => c.isUnpriced)) {
        contentStatus = 'UNPRICED_ITEMS';
      }

      list.push({
        id: `prod-${pr.id}`,
        rawId: pr.id,
        code: pr.recipe_code,
        name: pr.name || outputItem?.name || 'Unnamed Prep Recipe',
        type: 'PRODUCTION',
        inventoryMode: 'PRODUCTION',
        isFinishedGood: false,
        isModifierDriven: false,
        hasMethodOnly: false,
        typeLabel: 'Production / Batch Recipe',
        sectionName,
        department,
        yieldQuantity: targetYield,
        yieldUnit: pr.yield_unit || outputItem?.unit || 'batch',
        prepTime: pr.prep_time_minutes ? `${pr.prep_time_minutes} mins` : '',
        shelfLife: pr.shelf_life_days ? `${pr.shelf_life_days} days` : '',
        storageTemp: pr.storage_temperature || '',
        sellingPrice: null,
        totalCost: roundedTotalCost,
        foodCostPercent: null,
        grossMargin: null,
        bomStatus: pr.is_active ? 'ACTIVE' : 'DRAFT',
        isActive: pr.is_active !== false,
        components,
        componentCount: components.length,
        modifierOptions: [],
        modifierOptionCount: 0,
        contentStatus,
        recipeText: pr.description,
        preparationSteps: pr.instructions,
        updatedAt: pr.updated_at,
        editUrl: `/production-recipes/${pr.id}`
      });
    });

    return list;
  }, [
    menuRecipes, 
    productionRecipes, 
    catalogMap, 
    sectionsMap, 
    productMappingsMap, 
    productsMap, 
    customizationsList,
    modifierEffectsMap,
    productionOutputItemIds, 
    conversions, 
    packagingOptions
  ]);

  // Derived filters
  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    unifiedRecipes.forEach(r => {
      if (r.department) set.add(r.department);
    });
    return Array.from(set).sort();
  }, [unifiedRecipes]);

  const availableSections = useMemo(() => {
    const set = new Set<string>();
    unifiedRecipes.forEach(r => {
      if (r.sectionName) set.add(r.sectionName);
    });
    return Array.from(set).sort();
  }, [unifiedRecipes]);

  // Filtered recipes
  const filteredRecipes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const ingQuery = ingredientSearch.trim().toLowerCase();

    return unifiedRecipes.filter(recipe => {
      // Free text search
      if (query) {
        const matchesName = recipe.name.toLowerCase().includes(query);
        const matchesCode = recipe.code?.toLowerCase().includes(query);
        const matchesSection = recipe.sectionName.toLowerCase().includes(query);
        const matchesDept = recipe.department.toLowerCase().includes(query);
        const matchesComponent = recipe.components.some(c => c.name.toLowerCase().includes(query) || c.notes?.toLowerCase().includes(query));
        const matchesModifier = recipe.modifierOptions.some(m => m.optionName.toLowerCase().includes(query) || m.itemName?.toLowerCase().includes(query));
        const matchesInstructions = recipe.preparationSteps?.toLowerCase().includes(query) || recipe.recipeText?.toLowerCase().includes(query);

        if (!matchesName && !matchesCode && !matchesSection && !matchesDept && !matchesComponent && !matchesModifier && !matchesInstructions) {
          return false;
        }
      }

      // Ingredient-specific search
      if (ingQuery) {
        const inComponents = recipe.components.some(c => c.name.toLowerCase().includes(ingQuery));
        const inModifiers = recipe.modifierOptions.some(m => m.itemName?.toLowerCase().includes(ingQuery) || m.optionName.toLowerCase().includes(ingQuery));
        if (!inComponents && !inModifiers) return false;
      }

      // Recipe Type Filter
      if (recipeTypeFilter === 'MENU_BOM' && (recipe.type !== 'MENU' || recipe.isFinishedGood || recipe.isModifierDriven)) {
        return false;
      }
      if (recipeTypeFilter === 'MODIFIER_DRIVEN' && !recipe.isModifierDriven) {
        return false;
      }
      if (recipeTypeFilter === 'FINISHED_GOOD' && !recipe.isFinishedGood) {
        return false;
      }
      if (recipeTypeFilter === 'PRODUCTION' && recipe.type !== 'PRODUCTION') {
        return false;
      }

      // Department Filter
      if (departmentFilter !== 'ALL' && recipe.department !== departmentFilter) {
        return false;
      }

      // Section Filter
      if (sectionFilter !== 'ALL' && recipe.sectionName !== sectionFilter) {
        return false;
      }

      // Content Status Filter
      if (contentStatusFilter !== 'ALL') {
        if (contentStatusFilter === 'COMPLETE' && recipe.contentStatus !== 'COMPLETE') return false;
        if (contentStatusFilter === 'NO_INGREDIENTS' && recipe.contentStatus !== 'NO_INGREDIENTS') return false;
        if (contentStatusFilter === 'UNPRICED' && recipe.contentStatus !== 'UNPRICED_ITEMS') return false;
        if (contentStatusFilter === 'HIGH_FOOD_COST' && recipe.contentStatus !== 'HIGH_FOOD_COST') return false;
      }

      // Allergen Filter
      if (allergenFilter !== 'ALL') {
        if (!recipe.allergens || !recipe.allergens.toLowerCase().includes(allergenFilter.toLowerCase())) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'cost_desc':
          return b.totalCost - a.totalCost;
        case 'cost_asc':
          return a.totalCost - b.totalCost;
        case 'food_cost_desc':
          return (b.foodCostPercent || 0) - (a.foodCostPercent || 0);
        case 'components_desc':
          return (b.componentCount + b.modifierOptionCount) - (a.componentCount + a.modifierOptionCount);
        case 'components_asc':
          return (a.componentCount + a.modifierOptionCount) - (b.componentCount + b.modifierOptionCount);
        default:
          return 0;
      }
    });
  }, [
    unifiedRecipes, 
    searchQuery, 
    ingredientSearch, 
    recipeTypeFilter, 
    departmentFilter, 
    sectionFilter, 
    contentStatusFilter, 
    allergenFilter, 
    sortBy
  ]);

  // Aggregate Metrics & Audit Statistics
  const stats = useMemo(() => {
    const total = unifiedRecipes.length;
    const complete = unifiedRecipes.filter(r => r.contentStatus === 'COMPLETE').length;
    const modifierDrivenCount = unifiedRecipes.filter(r => r.isModifierDriven).length;
    const finishedGoodsCount = unifiedRecipes.filter(r => r.isFinishedGood).length;
    const missingIngredients = unifiedRecipes.filter(r => r.contentStatus === 'NO_INGREDIENTS').length;
    const unpriced = unifiedRecipes.filter(r => r.components.some(c => c.isUnpriced)).length;
    
    const pricedRecipes = unifiedRecipes.filter(r => r.foodCostPercent !== null && r.foodCostPercent > 0);
    const avgFoodCost = pricedRecipes.length > 0 
      ? Math.round((pricedRecipes.reduce((sum, r) => sum + (r.foodCostPercent || 0), 0) / pricedRecipes.length) * 10) / 10 
      : 0;
    
    const totalComponentsCount = unifiedRecipes.reduce((sum, r) => sum + r.componentCount + r.modifierOptionCount, 0);
    const avgComponents = total > 0 ? Math.round((totalComponentsCount / total) * 10) / 10 : 0;

    return {
      total,
      complete,
      modifierDrivenCount,
      finishedGoodsCount,
      missingIngredients,
      unpriced,
      avgFoodCost,
      avgComponents
    };
  }, [unifiedRecipes]);

  // Reverse Ingredient Lookup: mapping ingredient -> list of recipes (includes BOMs, Finished Goods, AND Modifier options!)
  const ingredientUsageMap = useMemo(() => {
    const map = new Map<string, {
      itemId: string;
      name: string;
      department?: string;
      unit: string;
      unitCost: number;
      recipesCount: number;
      recipes: {
        recipeId: string;
        recipeName: string;
        recipeType: string;
        sectionName: string;
        usageSource: 'BOM' | 'MODIFIER' | 'FINISHED_GOOD';
        quantity: number;
        unit: string;
        lineCost: number;
      }[];
    }>();

    unifiedRecipes.forEach(recipe => {
      // 1. From regular components
      recipe.components.forEach(comp => {
        const key = comp.itemId || comp.name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            itemId: comp.itemId,
            name: comp.name,
            department: comp.department,
            unit: comp.unit,
            unitCost: comp.unitCost,
            recipesCount: 0,
            recipes: []
          });
        }
        const entry = map.get(key)!;
        entry.recipesCount += 1;
        entry.recipes.push({
          recipeId: recipe.id,
          recipeName: recipe.name,
          recipeType: recipe.typeLabel,
          sectionName: recipe.sectionName,
          usageSource: recipe.isFinishedGood ? 'FINISHED_GOOD' : 'BOM',
          quantity: comp.baseQuantity,
          unit: comp.unit,
          lineCost: comp.lineCost
        });
      });

      // 2. From modifier options & inventory effects
      recipe.modifierOptions.forEach(opt => {
        if (opt.itemId && opt.itemName) {
          const key = opt.itemId || opt.itemName.toLowerCase();
          if (!map.has(key)) {
            map.set(key, {
              itemId: opt.itemId,
              name: opt.itemName,
              department: opt.department,
              unit: opt.unit || 'g',
              unitCost: opt.unitCost || 0,
              recipesCount: 0,
              recipes: []
            });
          }
          const entry = map.get(key)!;
          // Avoid duplicate entry if same recipe has same ingredient in multiple options
          if (!entry.recipes.some(r => r.recipeId === recipe.id)) {
            entry.recipesCount += 1;
            entry.recipes.push({
              recipeId: recipe.id,
              recipeName: `${recipe.name} (${opt.optionName})`,
              recipeType: 'Modifier Option',
              sectionName: recipe.sectionName,
              usageSource: 'MODIFIER',
              quantity: opt.quantity || 0,
              unit: opt.unit || 'g',
              lineCost: opt.lineCost || 0
            });
          }
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.recipesCount - a.recipesCount);
  }, [unifiedRecipes]);

  // Toggle single item expanded state
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Expand / Collapse all
  const handleToggleAll = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    filteredRecipes.forEach(r => {
      next[r.id] = expand;
    });
    setExpandedIds(next);
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery('');
    setIngredientSearch('');
    setRecipeTypeFilter('ALL');
    setDepartmentFilter('ALL');
    setSectionFilter('ALL');
    setContentStatusFilter('ALL');
    setAllergenFilter('ALL');
    setSortBy('name');
  };

  // EXPORT TO EXCEL (.xlsx)
  const handleExportExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();

      // Sheet 1: Detailed Recipe Ingredients Breakdown
      const ingredientRows: any[] = [];
      filteredRecipes.forEach(r => {
        if (r.components.length === 0 && r.modifierOptions.length === 0) {
          ingredientRows.push({
            'Recipe / Dish Name': r.name,
            'Recipe Type': r.typeLabel,
            'Inventory Tracking': r.isFinishedGood ? 'Direct Finished Good' : r.isModifierDriven ? 'Modifier-Driven' : 'Recipe BOM',
            'Recipe Code': r.code || '',
            'Menu Section': r.sectionName,
            'Department': r.department,
            'Target Yield': `${r.yieldQuantity} ${r.yieldUnit}`,
            'Selling Price ($)': r.sellingPrice !== null ? r.sellingPrice : 'N/A',
            'Total Recipe Cost ($)': r.totalCost,
            'Food Cost %': r.foodCostPercent !== null ? `${r.foodCostPercent}%` : 'N/A',
            'Ingredient #': 'NO BOM ITEMS CONFIGURED',
            'Ingredient Name': '-',
            'Classification': r.hasMethodOnly ? 'Culinary Method Only' : '-',
            'Base Qty': 0,
            'Unit': '-',
            'Waste %': 0,
            'Effective Qty': 0,
            'Unit Cost ($)': 0,
            'Line Cost ($)': 0,
            'Notes / Specs': r.recipeText || ''
          });
        } else {
          // Add standard BOM components
          r.components.forEach((c, idx) => {
            ingredientRows.push({
              'Recipe / Dish Name': r.name,
              'Recipe Type': r.typeLabel,
              'Inventory Tracking': r.isFinishedGood ? 'Direct Finished Good' : 'Recipe BOM',
              'Recipe Code': r.code || '',
              'Menu Section': r.sectionName,
              'Department': r.department,
              'Target Yield': `${r.yieldQuantity} ${r.yieldUnit}`,
              'Selling Price ($)': r.sellingPrice !== null ? r.sellingPrice : 'N/A',
              'Total Recipe Cost ($)': r.totalCost,
              'Food Cost %': r.foodCostPercent !== null ? `${r.foodCostPercent}%` : 'N/A',
              'Ingredient #': idx + 1,
              'Ingredient Name': c.name,
              'Classification': c.classification === 'FINISHED_GOOD' ? 'Finished Good Stock Item' : c.classification,
              'Base Qty': c.baseQuantity,
              'Unit': c.unit,
              'Waste %': `${c.wastePercentage}%`,
              'Effective Qty': c.effectiveQuantity,
              'Unit Cost ($)': c.unitCost,
              'Line Cost ($)': c.lineCost,
              'Notes / Specs': c.notes || ''
            });
          });

          // Add modifier options if any
          r.modifierOptions.forEach((opt, idx) => {
            ingredientRows.push({
              'Recipe / Dish Name': r.name,
              'Recipe Type': r.typeLabel,
              'Inventory Tracking': 'Modifier Option Choice',
              'Recipe Code': r.code || '',
              'Menu Section': r.sectionName,
              'Department': r.department,
              'Target Yield': `${r.yieldQuantity} ${r.yieldUnit}`,
              'Selling Price ($)': r.sellingPrice !== null ? r.sellingPrice : 'N/A',
              'Total Recipe Cost ($)': r.totalCost,
              'Food Cost %': r.foodCostPercent !== null ? `${r.foodCostPercent}%` : 'N/A',
              'Ingredient #': `MOD-${idx + 1} (${opt.groupName})`,
              'Ingredient Name': `${opt.optionName} -> ${opt.itemName || 'No stock mapping'}`,
              'Classification': 'Modifier Option Choice',
              'Base Qty': opt.quantity || 0,
              'Unit': opt.unit || '',
              'Waste %': '0%',
              'Effective Qty': opt.quantity || 0,
              'Unit Cost ($)': opt.unitCost || 0,
              'Line Cost ($)': opt.lineCost || 0,
              'Notes / Specs': `Option in group "${opt.groupName}"`
            });
          });
        }
      });

      const wsIngredients = XLSX.utils.json_to_sheet(ingredientRows);
      XLSX.utils.book_append_sheet(workbook, wsIngredients, 'Recipe Ingredients Content');

      // Sheet 2: Recipes Catalog Summary
      const summaryRows = filteredRecipes.map(r => ({
        'Item Name': r.name,
        'Type': r.typeLabel,
        'Inventory Tracking': r.isFinishedGood ? 'Direct Finished Good' : r.isModifierDriven ? 'Modifier-Driven' : 'Recipe BOM',
        'Code': r.code || '',
        'Section': r.sectionName,
        'Department': r.department,
        'BOM Status': r.bomStatus,
        'Ingredients Count': r.componentCount,
        'Modifier Options Count': r.modifierOptionCount,
        'Total Recipe Cost ($)': r.totalCost,
        'Selling Price ($)': r.sellingPrice !== null ? r.sellingPrice : 'N/A',
        'Food Cost %': r.foodCostPercent !== null ? `${r.foodCostPercent}%` : 'N/A',
        'Gross Margin ($)': r.grossMargin !== null ? r.grossMargin : 'N/A',
        'Pricing Factor': r.sellingPrice !== null && r.totalCost > 0 ? `${(r.sellingPrice / r.totalCost).toFixed(2)}x` : 'N/A',
        'Target Yield': `${r.yieldQuantity} ${r.yieldUnit}`,
        'Prep Time': r.prepTime || 'N/A',
        'Plate / Glass': r.plateType || 'N/A',
        'Allergens': r.allergens || 'None',
        'Content Status': r.contentStatus,
        'Preparation Instructions': r.preparationSteps || r.recipeText || ''
      }));

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(workbook, wsSummary, 'Recipes Summary');

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `Item_Recipes_Content_Report_${dateStr}.xlsx`);
    } catch (err: any) {
      console.error('Error exporting to Excel:', err);
      alert('Failed to export report to Excel. Please try again.');
    }
  };

  // EXPORT TO CSV
  const handleExportCSV = () => {
    try {
      const rows: string[] = [];
      rows.push([
        'Recipe Name',
        'Type',
        'Inventory Mode',
        'Section',
        'Department',
        'Yield',
        'Selling Price',
        'Total Recipe Cost',
        'Food Cost %',
        'Item / Option Name',
        'Net Qty',
        'Unit',
        'Unit Cost',
        'Line Cost',
        'Notes'
      ].join(','));

      filteredRecipes.forEach(r => {
        if (r.components.length === 0 && r.modifierOptions.length === 0) {
          rows.push([
            `"${r.name.replace(/"/g, '""')}"`,
            `"${r.typeLabel}"`,
            `"${r.inventoryMode}"`,
            `"${r.sectionName.replace(/"/g, '""')}"`,
            `"${r.department}"`,
            `"${r.yieldQuantity} ${r.yieldUnit}"`,
            r.sellingPrice !== null ? String(r.sellingPrice) : '',
            String(r.totalCost),
            r.foodCostPercent !== null ? `${r.foodCostPercent}%` : '',
            '"NO INGREDIENTS CONFIGURED"',
            '0',
            '',
            '0',
            '0',
            `"${(r.recipeText || '').replace(/"/g, '""')}"`
          ].join(','));
        } else {
          r.components.forEach(c => {
            rows.push([
              `"${r.name.replace(/"/g, '""')}"`,
              `"${r.typeLabel}"`,
              `"${r.inventoryMode}"`,
              `"${r.sectionName.replace(/"/g, '""')}"`,
              `"${r.department}"`,
              `"${r.yieldQuantity} ${r.yieldUnit}"`,
              r.sellingPrice !== null ? String(r.sellingPrice) : '',
              String(r.totalCost),
              r.foodCostPercent !== null ? `${r.foodCostPercent}%` : '',
              `"${c.name.replace(/"/g, '""')}"`,
              String(c.baseQuantity),
              `"${c.unit}"`,
              String(c.unitCost),
              String(c.lineCost),
              `"${(c.notes || '').replace(/"/g, '""')}"`
            ].join(','));
          });
          r.modifierOptions.forEach(opt => {
            rows.push([
              `"${r.name.replace(/"/g, '""')}"`,
              `"${r.typeLabel}"`,
              `"MODIFIER"`,
              `"${r.sectionName.replace(/"/g, '""')}"`,
              `"${r.department}"`,
              `"${r.yieldQuantity} ${r.yieldUnit}"`,
              r.sellingPrice !== null ? String(r.sellingPrice) : '',
              String(r.totalCost),
              r.foodCostPercent !== null ? `${r.foodCostPercent}%` : '',
              `"${opt.groupName}: ${opt.optionName} (${opt.itemName || 'No stock mapping'})"`,
              String(opt.quantity || 0),
              `"${opt.unit || ''}"`,
              String(opt.unitCost || 0),
              String(opt.lineCost || 0),
              `"Modifier option"`
            ].join(','));
          });
        }
      });

      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Item_Recipes_Content_Report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Error exporting CSV:', err);
      alert('Failed to export CSV.');
    }
  };

  // Print Recipe Book
  const handlePrint = () => {
    window.print();
  };

  const hasActiveFilters = Boolean(
    searchQuery || 
    ingredientSearch || 
    recipeTypeFilter !== 'ALL' || 
    departmentFilter !== 'ALL' || 
    sectionFilter !== 'ALL' || 
    contentStatusFilter !== 'ALL' || 
    allergenFilter !== 'ALL' || 
    sortBy !== 'name'
  );

  return (
    <div className="recipe-report-container" style={{ padding: '24px 32px', minHeight: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* PRINT-ONLY HEADER */}
      <div className="print-only" style={{ display: 'none', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>{user?.restaurants?.name || 'Restaurant'} — Recipe Specifications & Content Book</h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#444' }}>
              Official Item Recipes & BOM Ingredient Report • Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '12px', color: '#666' }}>
            <div>Total Items: {filteredRecipes.length}</div>
            <div>Department: {departmentFilter === 'ALL' ? 'All Departments' : departmentFilter}</div>
          </div>
        </div>
      </div>

      {/* SCREEN HEADER */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>
            <span>Reports</span>
            <span>/</span>
            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Item Recipes Report</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileSpreadsheet size={30} style={{ color: 'var(--primary)' }} />
            Item Recipes Report Generator
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '14px' }}>
            Audit and verify the content of each item: fixed kitchen BOMs, modifier-driven recipes (coffee beans/options), finished goods, and batch preps.
          </p>
        </div>

        {/* Global Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 16px',
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-main)',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            title="Print clean kitchen spec sheets or save as PDF"
          >
            <Printer size={16} />
            Print Recipe Book
          </button>

          <button
            onClick={handleExportCSV}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 16px',
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-main)',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            title="Download complete ingredients as CSV"
          >
            <Download size={16} />
            Export CSV
          </button>

          <button
            onClick={handleExportExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              background: '#059669',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)'
            }}
            title="Export formatted workbook with components, summary, and audit sheets"
          >
            <FileSpreadsheet size={16} />
            Export Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* KPI AUDIT DASHBOARD STRIP */}
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px' }}>
        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Items</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#111827', marginTop: '4px' }}>{stats.total}</div>
          <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px', fontWeight: 500 }}>Menu, retail, & preps</div>
        </div>

        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Content Configured</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>{stats.complete}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            BOMs, modifiers & finished goods
          </div>
        </div>

        <div 
          onClick={() => setRecipeTypeFilter(recipeTypeFilter === 'MODIFIER_DRIVEN' ? 'ALL' : 'MODIFIER_DRIVEN')}
          style={{ 
            background: recipeTypeFilter === 'MODIFIER_DRIVEN' ? '#f5f3ff' : '#fff', 
            padding: '16px 20px', 
            borderRadius: '12px', 
            border: recipeTypeFilter === 'MODIFIER_DRIVEN' ? '1px solid #c4b5fd' : '1px solid var(--border)', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          title="Click to filter Modifier-Driven recipes (like coffee, choice options)"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '12px', color: '#6d28d9', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Modifier-Driven</div>
            <Coffee size={15} color="#7c3aed" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#6d28d9', marginTop: '4px' }}>
            {stats.modifierDrivenCount}
          </div>
          <div style={{ fontSize: '11px', color: '#7c3aed', marginTop: '4px', fontWeight: 500 }}>
            Coffee beans & option choices
          </div>
        </div>

        <div 
          onClick={() => setRecipeTypeFilter(recipeTypeFilter === 'FINISHED_GOOD' ? 'ALL' : 'FINISHED_GOOD')}
          style={{ 
            background: recipeTypeFilter === 'FINISHED_GOOD' ? '#f0fdf4' : '#fff', 
            padding: '16px 20px', 
            borderRadius: '12px', 
            border: recipeTypeFilter === 'FINISHED_GOOD' ? '1px solid #86efac' : '1px solid var(--border)', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          title="Click to filter Direct Finished Good items"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '12px', color: '#166534', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Finished Goods</div>
            <Package size={15} color="#16a34a" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
            {stats.finishedGoodsCount}
          </div>
          <div style={{ fontSize: '11px', color: '#166534', marginTop: '4px', fontWeight: 500 }}>
            Direct stock items (bottles/cans)
          </div>
        </div>

        <div 
          onClick={() => setContentStatusFilter(contentStatusFilter === 'NO_INGREDIENTS' ? 'ALL' : 'NO_INGREDIENTS')}
          style={{ 
            background: stats.missingIngredients > 0 ? '#fff1f2' : '#fff', 
            padding: '16px 20px', 
            borderRadius: '12px', 
            border: stats.missingIngredients > 0 ? '1px solid #fecdd3' : '1px solid var(--border)', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          title="Click to filter items missing recipes"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '12px', color: stats.missingIngredients > 0 ? '#be123c' : 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Missing Content</div>
            {stats.missingIngredients > 0 && <AlertTriangle size={15} color="#e11d48" />}
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: stats.missingIngredients > 0 ? '#e11d48' : '#111827', marginTop: '4px' }}>
            {stats.missingIngredients}
          </div>
          <div style={{ fontSize: '11px', color: stats.missingIngredients > 0 ? '#be123c' : 'var(--text-muted)', marginTop: '4px', fontWeight: 500 }}>
            {stats.missingIngredients > 0 ? 'Items without BOM or options' : 'All items configured'}
          </div>
        </div>

        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg Food Cost</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: stats.avgFoodCost > 32 ? '#d97706' : '#2563eb', marginTop: '4px' }}>
            {stats.avgFoodCost}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Across priced products</div>
        </div>
      </div>

      {/* FILTER CONTROL BAR */}
      <div className="no-print" style={{ background: '#fff', padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Main Search Input */}
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by item name, code, or keyword..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontSize: '13px',
                outline: 'none',
                background: '#f8fafc'
              }}
            />
            {searchQuery && (
              <X 
                size={14} 
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer' }} 
              />
            )}
          </div>

          {/* Ingredient Specific Search */}
          <div style={{ flex: '1 1 220px', position: 'relative' }}>
            <Utensils size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#059669' }} />
            <input
              type="text"
              placeholder="Search ingredient (e.g. Decaf, Coffee Beans, Garlic)..."
              value={ingredientSearch}
              onChange={e => setIngredientSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '8px',
                border: '1px solid #a7f3d0',
                fontSize: '13px',
                outline: 'none',
                background: '#f0fdf4'
              }}
            />
            {ingredientSearch && (
              <X 
                size={14} 
                onClick={() => setIngredientSearch('')}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer' }} 
              />
            )}
          </div>

          {/* Recipe Type Filter */}
          <div style={{ minWidth: '180px' }}>
            <select
              value={recipeTypeFilter}
              onChange={e => setRecipeTypeFilter(e.target.value as any)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontSize: '13px',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Item Types</option>
              <option value="MENU_BOM">Fixed Menu Recipes (BOMs)</option>
              <option value="MODIFIER_DRIVEN">Modifier-Driven Recipes (Coffee / Choice)</option>
              <option value="FINISHED_GOOD">Direct Finished Goods (Cans/Bottles)</option>
              <option value="PRODUCTION">Production Batch Preps</option>
            </select>
          </div>

          {/* Department Filter */}
          <div style={{ minWidth: '140px' }}>
            <select
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontSize: '13px',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Departments</option>
              {availableDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div style={{ minWidth: '160px' }}>
            <select
              value={sectionFilter}
              onChange={e => setSectionFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontSize: '13px',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Menu Sections</option>
              {availableSections.map(sec => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>

          {/* Content Completeness Filter */}
          <div style={{ minWidth: '160px' }}>
            <select
              value={contentStatusFilter}
              onChange={e => setContentStatusFilter(e.target.value as any)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontSize: '13px',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Content Statuses</option>
              <option value="COMPLETE">Configured Content (Ready)</option>
              <option value="NO_INGREDIENTS">Empty Content (0 Ingredients)</option>
              <option value="UNPRICED">Has Unpriced Items</option>
              <option value="HIGH_FOOD_COST">High Food Cost (&gt;35%)</option>
            </select>
          </div>

          {/* Sort By */}
          <div style={{ minWidth: '140px' }}>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontSize: '13px',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="name">Sort: Name (A-Z)</option>
              <option value="cost_desc">Sort: Cost (High to Low)</option>
              <option value="cost_asc">Sort: Cost (Low to High)</option>
              <option value="food_cost_desc">Sort: Food Cost % (High to Low)</option>
              <option value="components_desc">Sort: Most Ingredients</option>
              <option value="components_asc">Sort: Least Ingredients</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 14px',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={14} />
              Reset Filters
            </button>
          )}
        </div>

        {/* View Mode Tabs & Expand/Collapse Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setViewMode('cards')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'cards' ? 'var(--primary)' : '#f8fafc',
                color: viewMode === 'cards' ? '#fff' : 'var(--text-main)',
                transition: 'all 0.15s'
              }}
            >
              <BookOpen size={16} />
              Recipe Specification Sheets ({filteredRecipes.length})
            </button>

            <button
              onClick={() => setViewMode('table')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'table' ? 'var(--primary)' : '#f8fafc',
                color: viewMode === 'table' ? '#fff' : 'var(--text-main)',
                transition: 'all 0.15s'
              }}
            >
              <Layers size={16} />
              Audit Matrix Table
            </button>

            <button
              onClick={() => setViewMode('reverse_lookup')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'reverse_lookup' ? 'var(--primary)' : '#f8fafc',
                color: viewMode === 'reverse_lookup' ? '#fff' : 'var(--text-main)',
                transition: 'all 0.15s'
              }}
            >
              <Utensils size={16} />
              Ingredient Usage Explorer ({ingredientUsageMap.length})
            </button>
          </div>

          {viewMode === 'cards' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => handleToggleAll(true)}
                style={{
                  padding: '6px 12px',
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                Expand All
              </button>
              <button
                onClick={() => handleToggleAll(false)}
                style={{
                  padding: '6px 12px',
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                Collapse All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CONTENT AREA */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ marginTop: '16px', fontSize: '14px', color: 'var(--text-muted)' }}>Loading recipes, BOMs, modifiers, and finished goods mappings...</p>
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <ChefHat size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>No items match your criteria</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '8px 0 16px' }}>
            Try adjusting your search terms or clearing some filters to see recipe contents.
          </p>
          <button
            onClick={resetFilters}
            style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
          >
            Reset All Filters
          </button>
        </div>
      ) : viewMode === 'cards' ? (

        /* ========================================================================= */
        /* VIEW MODE 1: RECIPE SPECIFICATION SHEETS (CARDS)                          */
        /* ========================================================================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredRecipes.map(recipe => {
            const isExpanded = expandedIds[recipe.id] !== false; // default expanded

            return (
              <div 
                key={recipe.id}
                className="recipe-card"
                style={{
                  background: '#fff',
                  borderRadius: '12px',
                  border: recipe.contentStatus === 'NO_INGREDIENTS' 
                    ? '1px solid #fecdd3' 
                    : '1px solid var(--border)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  overflow: 'hidden',
                  transition: 'box-shadow 0.2s',
                  pageBreakInside: 'avoid'
                }}
              >
                {/* Card Header Bar */}
                <div 
                  onClick={() => toggleExpand(recipe.id)}
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: recipe.contentStatus === 'NO_INGREDIENTS' ? '#fff1f2' : '#ffffff',
                    borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    {recipe.imageUrl ? (
                      <img 
                        src={recipe.imageUrl} 
                        alt={recipe.name} 
                        style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border)' }} 
                      />
                    ) : (
                      <div style={{ 
                        width: '44px', 
                        height: '44px', 
                        borderRadius: '8px', 
                        background: recipe.isModifierDriven ? '#f5f3ff' : recipe.isFinishedGood ? '#f0fdf4' : recipe.type === 'PRODUCTION' ? '#ecfdf5' : '#eff6ff', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        color: recipe.isModifierDriven ? '#7c3aed' : recipe.isFinishedGood ? '#16a34a' : recipe.type === 'PRODUCTION' ? '#059669' : '#2563eb' 
                      }}>
                        {recipe.isModifierDriven ? <Coffee size={22} /> : recipe.isFinishedGood ? <Package size={22} /> : recipe.type === 'PRODUCTION' ? <Flame size={22} /> : <ChefHat size={22} />}
                      </div>
                    )}

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', margin: 0 }}>
                          {recipe.name}
                        </h3>
                        {recipe.code && (
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            {recipe.code}
                          </span>
                        )}
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: 700, 
                          padding: '2px 8px', 
                          borderRadius: '12px',
                          background: recipe.isModifierDriven ? '#ede9fe' : recipe.isFinishedGood ? '#dcfce7' : recipe.type === 'PRODUCTION' ? '#d1fae5' : '#dbeafe',
                          color: recipe.isModifierDriven ? '#6d28d9' : recipe.isFinishedGood ? '#15803d' : recipe.type === 'PRODUCTION' ? '#065f46' : '#1e40af'
                        }}>
                          {recipe.typeLabel}
                        </span>
                        <span style={{ fontSize: '11px', background: '#f3f4f6', color: '#4b5563', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                          {recipe.sectionName}
                        </span>
                        <span style={{ fontSize: '11px', background: '#f8fafc', color: '#64748b', padding: '2px 8px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                          {recipe.department}
                        </span>
                        {recipe.bomStatus === 'DRAFT' && !recipe.isFinishedGood && (
                          <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                            DRAFT
                          </span>
                        )}
                      </div>

                      {/* Content Completeness Alert Tag */}
                      <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                        {recipe.isModifierDriven ? (
                          <span style={{ color: '#7c3aed', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={13} />
                            Modifier-Driven Recipe ({recipe.modifierOptionCount} options configured e.g. Beans / Milk)
                          </span>
                        ) : recipe.isFinishedGood ? (
                          <span style={{ color: '#15803d', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={13} />
                            Direct Stock Mapping ({recipe.components[0]?.name || 'Catalog Item'} • {recipe.components[0]?.baseQuantity} {recipe.components[0]?.unit} / sale)
                          </span>
                        ) : recipe.hasMethodOnly ? (
                          <span style={{ color: '#0369a1', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={13} />
                            Culinary Method & Dosing Specified
                          </span>
                        ) : recipe.contentStatus === 'NO_INGREDIENTS' ? (
                          <span style={{ color: '#e11d48', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={13} />
                            Recipe Empty — No BOM components or modifier options configured!
                          </span>
                        ) : recipe.contentStatus === 'UNPRICED_ITEMS' ? (
                          <span style={{ color: '#d97706', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={13} />
                            {recipe.componentCount} ingredients • Warning: Contains unpriced items
                          </span>
                        ) : (
                          <span style={{ color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={13} />
                            {recipe.componentCount} ingredients configured
                          </span>
                        )}

                        {recipe.allergens && (
                          <span style={{ color: '#6b7280' }}>
                            • Allergens: <strong style={{ color: '#b91c1c' }}>{recipe.allergens}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side metrics summary */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Cost</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>
                        ${recipe.totalCost.toFixed(2)}
                      </div>
                    </div>

                    {recipe.sellingPrice !== null && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Price</div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: '#059669' }}>
                          ${recipe.sellingPrice.toFixed(2)}
                        </div>
                      </div>
                    )}

                    {recipe.foodCostPercent !== null && (
                      <div style={{ textAlign: 'right', minWidth: '70px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Food Cost</div>
                        <div style={{ 
                          fontSize: '15px', 
                          fontWeight: 800, 
                          color: recipe.foodCostPercent > 35 ? '#dc2626' : recipe.foodCostPercent > 30 ? '#d97706' : '#15803d' 
                        }}>
                          {recipe.foodCostPercent}%
                        </div>
                      </div>
                    )}

                    <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>

                {/* Collapsible Recipe Content Body */}
                {isExpanded && (
                  <div style={{ padding: '20px' }}>
                    
                    {/* Modifier-Driven Recipe Callout Banner */}
                    {recipe.isModifierDriven && (
                      <div style={{
                        background: '#f5f3ff',
                        border: '1px solid #ddd6fe',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Coffee size={20} style={{ color: '#7c3aed' }} />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#5b21b6' }}>
                              Modifier-Driven Recipe (Customizable Options)
                            </div>
                            <div style={{ fontSize: '12px', color: '#6d28d9', marginTop: '2px' }}>
                              Ingredients for this drink/dish are selected by the guest upon ordering (such as choosing between Regular vs. Decaf coffee beans or milk choices). Stock is deducted dynamically according to the chosen modifier.
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 700, background: '#ede9fe', color: '#6d28d9', padding: '4px 10px', borderRadius: '6px' }}>
                          {recipe.modifierOptionCount} Options Configured
                        </span>
                      </div>
                    )}

                    {/* Finished Good Info Banner */}
                    {recipe.isFinishedGood && (
                      <div style={{
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Package size={20} style={{ color: '#16a34a' }} />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#14532d' }}>
                              Direct Finished Good Inventory Item
                            </div>
                            <div style={{ fontSize: '12px', color: '#166534', marginTop: '2px' }}>
                              This product is sold directly from catalog stock (such as a bottled soft drink, canned beverage, or retail good). Stock is deducted 1:1 per sale without kitchen BOM assembly.
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '6px' }}>
                          Status: READY
                        </span>
                      </div>
                    )}

                    {/* Metadata Strip */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
                      gap: '12px', 
                      background: '#f8fafc', 
                      padding: '12px 16px', 
                      borderRadius: '8px', 
                      marginBottom: '18px',
                      fontSize: '12px'
                    }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Target Yield</span>
                        <strong style={{ color: '#111827' }}>{recipe.yieldQuantity} {recipe.yieldUnit}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Prep Time</span>
                        <strong style={{ color: '#111827' }}>{recipe.prepTime || 'Standard'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Plate / Glassware</span>
                        <strong style={{ color: '#111827' }}>{recipe.plateType || 'Standard Dish'}</strong>
                      </div>
                      {recipe.shelfLife && (
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Shelf Life</span>
                          <strong style={{ color: '#111827' }}>{recipe.shelfLife}</strong>
                        </div>
                      )}
                      {recipe.storageTemp && (
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Storage</span>
                          <strong style={{ color: '#111827' }}>{recipe.storageTemp}</strong>
                        </div>
                      )}
                      {recipe.grossMargin !== null && (
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Gross Margin</span>
                          <strong style={{ color: '#059669' }}>${recipe.grossMargin.toFixed(2)}</strong>
                        </div>
                      )}
                      {recipe.sellingPrice != null && recipe.totalCost > 0 && (
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Factor</span>
                          <strong style={{ color: '#2563eb' }}>{(recipe.sellingPrice / recipe.totalCost).toFixed(2)}x</strong>
                        </div>
                      )}
                    </div>

                    {/* FIXED BOM COMPONENTS TABLE (IF ANY) */}
                    {recipe.components.length > 0 && (
                      <div style={{ marginBottom: '18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Utensils size={15} style={{ color: 'var(--primary)' }} />
                            {recipe.isFinishedGood ? 'Linked Inventory Catalog Item' : `Base Recipe Content & BOM (${recipe.components.length} ingredients)`}
                          </h4>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Cost based on inventory purchases & base conversions
                          </span>
                        </div>

                        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '9px 12px', width: '36px', color: 'var(--text-muted)' }}>#</th>
                                <th style={{ padding: '9px 12px', fontWeight: 600, color: '#374151' }}>Ingredient Item</th>
                                <th style={{ padding: '9px 12px', fontWeight: 600, color: '#374151' }}>Type</th>
                                <th style={{ padding: '9px 12px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Net Qty</th>
                                <th style={{ padding: '9px 12px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Waste %</th>
                                <th style={{ padding: '9px 12px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Gross Qty</th>
                                <th style={{ padding: '9px 12px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Unit Cost</th>
                                <th style={{ padding: '9px 12px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Line Total</th>
                                <th style={{ padding: '9px 12px', fontWeight: 600, color: '#374151' }}>Notes & Instructions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recipe.components.map((comp, idx) => (
                                <tr 
                                  key={comp.id} 
                                  style={{ 
                                    borderBottom: '1px solid #f1f5f9',
                                    background: comp.isUnpriced ? '#fffbeb' : idx % 2 === 1 ? '#fbfcfe' : '#ffffff'
                                  }}
                                >
                                  <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#111827' }}>
                                    {comp.name}
                                    {comp.isUnpriced && (
                                      <span title="Unit cost is $0 or missing conversion factor" style={{ marginLeft: '6px', color: '#d97706', fontSize: '11px', fontWeight: 700 }}>
                                        [Unpriced]
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '8px 12px' }}>
                                    <span style={{
                                      fontSize: '10px',
                                      fontWeight: 600,
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: comp.classification === 'FINISHED_GOOD' ? '#dcfce7' : comp.classification === 'PRODUCTION' ? '#ecfdf5' : '#f1f5f9',
                                      color: comp.classification === 'FINISHED_GOOD' ? '#15803d' : comp.classification === 'PRODUCTION' ? '#047857' : '#475569'
                                    }}>
                                      {comp.classification === 'FINISHED_GOOD' ? 'Finished Good Stock' : comp.classification === 'PRODUCTION' ? 'Prep Sub-Recipe' : 'Raw Ingredient'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                                    {comp.baseQuantity} {comp.unit}
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', color: comp.wastePercentage > 0 ? '#d97706' : 'var(--text-muted)' }}>
                                    {comp.wastePercentage > 0 ? `${comp.wastePercentage}%` : '0%'}
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#4b5563' }}>
                                    {comp.effectiveQuantity} {comp.unit}
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#4b5563' }}>
                                    {comp.unitCost > 0 ? `$${comp.unitCost.toFixed(3)}` : '-'}
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>
                                    ${comp.lineCost.toFixed(3)}
                                  </td>
                                  <td style={{ padding: '8px 12px', color: '#64748b', fontStyle: comp.notes ? 'normal' : 'italic' }}>
                                    {comp.notes || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                                <td colSpan={7} style={{ padding: '10px 12px', textAlign: 'right', color: '#111827' }}>
                                  Total Calculated Recipe Cost:
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#2563eb', fontSize: '13px' }}>
                                  ${recipe.totalCost.toFixed(3)}
                                </td>
                                <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                                  {recipe.foodCostPercent !== null && `(${recipe.foodCostPercent}% of selling price)`}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Callout if Recipe is Modifier-Driven */}
                    {recipe.components.length === 0 && recipe.isModifierDriven && (
                      <div style={{ padding: '12px 16px', background: '#f5f3ff', borderRadius: '8px', border: '1px solid #ddd6fe', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Coffee size={20} style={{ color: '#7c3aed', flexShrink: 0 }} />
                        <div style={{ fontSize: '13px', color: '#5b21b6' }}>
                          <strong>Dynamic Modifier Recipe:</strong> Base ingredients for this item (such as coffee beans or milk type) are selected at the POS. Stock and food cost are deducted dynamically based on customer choices below.
                        </div>
                      </div>
                    )}

                    {/* Callout if Recipe has Culinary Method Only */}
                    {recipe.components.length === 0 && !recipe.isModifierDriven && !recipe.isFinishedGood && recipe.hasMethodOnly && (
                      <div style={{ padding: '12px 16px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ChefHat size={20} style={{ color: '#0284c7', flexShrink: 0 }} />
                        <div style={{ fontSize: '13px', color: '#0369a1' }}>
                          <strong>Preparation Spec Recipe:</strong> Preparation steps and extraction dosing are defined below. Link raw catalog items in the BOM editor to track raw stock usage automatically.
                        </div>
                      </div>
                    )}

                    {/* MODIFIER OPTIONS & INGREDIENTS TABLE */}
                    {recipe.modifierOptions.length > 0 && (
                      <div style={{ marginBottom: '18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#6d28d9', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Coffee size={15} style={{ color: '#7c3aed' }} />
                            Modifier Options & Recipe Choices ({recipe.modifierOptions.length} options)
                          </h4>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Stock deducted dynamically per modifier selected on order
                          </span>
                        </div>

                        <div style={{ overflowX: 'auto', border: '1px solid #ddd6fe', borderRadius: '8px', background: '#faf5ff' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ background: '#ede9fe', borderBottom: '1px solid #ddd6fe' }}>
                                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#5b21b6' }}>Option Group</th>
                                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#5b21b6' }}>Choice / Modifier</th>
                                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#5b21b6' }}>Inventory Stock Item</th>
                                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#5b21b6', textAlign: 'right' }}>Dose / Qty</th>
                                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#5b21b6', textAlign: 'right' }}>Unit Cost</th>
                                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#5b21b6', textAlign: 'right' }}>Option Cost</th>
                                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#5b21b6', textAlign: 'right' }}>Extra Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recipe.modifierOptions.map(opt => (
                                <tr key={opt.id} style={{ borderBottom: '1px solid #f3e8ff', background: '#ffffff' }}>
                                  <td style={{ padding: '8px 12px', fontWeight: 700, color: '#6d28d9' }}>
                                    {opt.groupName}
                                  </td>
                                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e293b' }}>
                                    {opt.optionName}
                                  </td>
                                  <td style={{ padding: '8px 12px', color: opt.itemName ? '#111827' : '#9ca3af', fontStyle: opt.itemName ? 'normal' : 'italic' }}>
                                    {opt.itemName || 'No inventory item linked'}
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                                    {opt.quantity ? `${opt.quantity} ${opt.unit}` : '—'}
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#4b5563' }}>
                                    {opt.unitCost && opt.unitCost > 0 ? `$${opt.unitCost.toFixed(3)}` : '—'}
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                                    {opt.lineCost && opt.lineCost > 0 ? `$${opt.lineCost.toFixed(3)}` : '—'}
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', color: opt.price > 0 ? '#059669' : '#9ca3af', fontWeight: 600 }}>
                                    {opt.price > 0 ? `+$${opt.price.toFixed(2)}` : 'Free'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* EMPTY BANNER IF NO COMPONENTS, NO FINISHED GOOD, AND NO MODIFIERS */}
                    {recipe.components.length === 0 && !recipe.isFinishedGood && !recipe.isModifierDriven && !recipe.hasMethodOnly && (
                      <div style={{ padding: '24px', background: '#fff1f2', borderRadius: '8px', border: '1px dashed #fca5a5', textAlign: 'center', marginBottom: '16px' }}>
                        <AlertTriangle size={24} style={{ color: '#e11d48', margin: '0 auto 6px' }} />
                        <div style={{ fontWeight: 700, color: '#9f1239', fontSize: '14px' }}>No ingredients or finished good mapping configured</div>
                        <p style={{ fontSize: '12px', color: '#be123c', margin: '4px 0 12px' }}>
                          Kitchen operations require a recipe breakdown, modifier options, or a direct finished good inventory mapping to track cost, yield, and deduct stock.
                        </p>
                        <Link 
                          to={recipe.editUrl}
                          className="no-print"
                          style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            padding: '6px 14px', 
                            background: '#e11d48', 
                            color: '#fff', 
                            borderRadius: '6px', 
                            fontSize: '12px', 
                            fontWeight: 600, 
                            textDecoration: 'none' 
                          }}
                        >
                          <ChefHat size={14} /> Configure in Recipe & BOM Editor
                        </Link>
                      </div>
                    )}

                    {/* METHOD & PREPARATION STEPS / EXTRACTION SPECS */}
                    {(recipe.preparationSteps || (recipe.recipeText && recipe.recipeText !== 'Recipe details in BOM')) && (
                      <div style={{ marginTop: '16px', background: '#f8fafc', padding: '14px 18px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <h5 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={14} style={{ color: 'var(--primary)' }} />
                          Preparation Instructions & Extraction Method:
                        </h5>
                        <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                          {recipe.preparationSteps || recipe.recipeText}
                        </p>
                      </div>
                    )}

                    {/* Plating / Quality / Packaging Standards */}
                    {(recipe.platingInstructions || recipe.qualityStandards || recipe.packagingInstructions) && (
                      <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                        {recipe.platingInstructions && (
                          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 14px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Plating & Presentation</span>
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#334155' }}>{recipe.platingInstructions}</p>
                          </div>
                        )}
                        {recipe.qualityStandards && (
                          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 14px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Quality Standards</span>
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#334155' }}>{recipe.qualityStandards}</p>
                          </div>
                        )}
                        {recipe.packagingInstructions && (
                          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 14px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Delivery Packaging</span>
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#334155' }}>{recipe.packagingInstructions}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div className="no-print" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                      <Link 
                        to={recipe.editUrl}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          background: '#fff',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--primary)',
                          textDecoration: 'none'
                        }}
                      >
                        <ExternalLink size={14} /> Open Recipe & BOM Editor
                      </Link>
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>

      ) : viewMode === 'table' ? (

        /* ========================================================================= */
        /* VIEW MODE 2: AUDIT MATRIX TABLE                                           */
        /* ========================================================================= */
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#374151' }}>Item / Dish Name</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, color: '#374151' }}>Type</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, color: '#374151' }}>Section</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, color: '#374151' }}>Dept</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, color: '#374151' }}>Content Status</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, color: '#374151' }}>Recipe Content Preview</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Total Cost</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Selling Price</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600, color: '#374151', textAlign: 'right' }}>Food Cost %</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#374151', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecipes.map((recipe, idx) => {
                  const isExpanded = !!expandedIds[recipe.id];

                  return (
                    <React.Fragment key={recipe.id}>
                      <tr 
                        style={{ 
                          borderBottom: '1px solid #f1f5f9',
                          background: recipe.contentStatus === 'NO_INGREDIENTS' 
                            ? '#fff1f2' 
                            : idx % 2 === 1 ? '#fbfcfe' : '#ffffff',
                          cursor: 'pointer'
                        }}
                        onClick={() => toggleExpand(recipe.id)}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#111827' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </span>
                            <span>{recipe.name}</span>
                            {recipe.code && (
                              <span style={{ fontSize: '10px', background: '#f1f5f9', color: '#64748b', padding: '1px 5px', borderRadius: '4px' }}>
                                {recipe.code}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: '10px',
                            background: recipe.isModifierDriven ? '#ede9fe' : recipe.isFinishedGood ? '#dcfce7' : recipe.type === 'PRODUCTION' ? '#d1fae5' : '#dbeafe',
                            color: recipe.isModifierDriven ? '#6d28d9' : recipe.isFinishedGood ? '#15803d' : recipe.type === 'PRODUCTION' ? '#065f46' : '#1e40af'
                          }}>
                            {recipe.isModifierDriven ? 'Modifier-Driven' : recipe.isFinishedGood ? 'Finished Good' : recipe.type === 'PRODUCTION' ? 'Production' : 'Menu Dish'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#4b5563' }}>
                          {recipe.sectionName}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '12px' }}>
                          {recipe.department}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {recipe.isModifierDriven ? (
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#6d28d9', background: '#ede9fe', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={12} /> Modifiers ({recipe.modifierOptionCount})
                            </span>
                          ) : recipe.isFinishedGood ? (
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={12} /> Finished Good
                            </span>
                          ) : recipe.hasMethodOnly ? (
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#0369a1', background: '#e0f2fe', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={12} /> Method Spec
                            </span>
                          ) : recipe.contentStatus === 'NO_INGREDIENTS' ? (
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#e11d48', background: '#ffe4e6', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={12} /> Empty (0)
                            </span>
                          ) : recipe.contentStatus === 'UNPRICED_ITEMS' ? (
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#d97706', background: '#fef3c7', padding: '2px 8px', borderRadius: '12px' }}>
                              {recipe.componentCount} items (Unpriced)
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={12} /> {recipe.componentCount} items
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '12px', maxWidth: '240px' }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {recipe.components.length > 0 
                              ? recipe.components.slice(0, 3).map(c => c.name).join(', ') + (recipe.components.length > 3 ? '...' : '')
                              : recipe.modifierOptions.length > 0
                              ? recipe.modifierOptions.slice(0, 3).map(o => o.optionName + (o.itemName ? ` (${o.itemName})` : '')).join(', ')
                              : recipe.recipeText
                              ? recipe.recipeText.slice(0, 30) + '...'
                              : <span style={{ color: '#e11d48', fontStyle: 'italic' }}>No content configured</span>}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>
                          ${recipe.totalCost.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: recipe.sellingPrice ? '#059669' : '#9ca3af' }}>
                          {recipe.sellingPrice ? `$${recipe.sellingPrice.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800 }}>
                          {recipe.foodCostPercent !== null ? (
                            <span style={{
                              color: recipe.foodCostPercent > 35 ? '#dc2626' : recipe.foodCostPercent > 30 ? '#d97706' : '#15803d'
                            }}>
                              {recipe.foodCostPercent}%
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <Link
                            to={recipe.editUrl}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              background: '#f1f5f9',
                              color: 'var(--primary)',
                              fontSize: '12px',
                              fontWeight: 600,
                              textDecoration: 'none'
                            }}
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>

                      {/* Inline Expanded Component Breakdown */}
                      {isExpanded && (
                        <tr style={{ background: '#f8fafc' }}>
                          <td colSpan={10} style={{ padding: '16px 24px', borderBottom: '2px solid var(--border)' }}>
                            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontWeight: 700, fontSize: '13px', color: '#111827' }}>
                                  {recipe.isModifierDriven 
                                    ? `Modifier Choices & Dosing for ${recipe.name}`
                                    : recipe.isFinishedGood 
                                    ? `Direct Finished Good Mapping for ${recipe.name}` 
                                    : `Detailed BOM for ${recipe.name} (${recipe.components.length} ingredients)`}
                                </span>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                  Target Yield: <strong>{recipe.yieldQuantity} {recipe.yieldUnit}</strong>
                                </span>
                              </div>

                              {recipe.components.length > 0 ? (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: recipe.modifierOptions.length > 0 ? '12px' : '0' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: 'var(--text-muted)', textAlign: 'left' }}>
                                      <th style={{ padding: '6px 8px' }}>Ingredient Item</th>
                                      <th style={{ padding: '6px 8px' }}>Classification</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Net Qty</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Waste %</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Unit Cost</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Line Total</th>
                                      <th style={{ padding: '6px 8px' }}>Notes & Instructions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {recipe.components.map(comp => (
                                      <tr key={comp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '6px 8px', fontWeight: 600, color: '#111827' }}>{comp.name}</td>
                                        <td style={{ padding: '6px 8px', color: '#64748b' }}>
                                          {comp.classification === 'FINISHED_GOOD' ? 'Finished Good Stock' : comp.classification}
                                        </td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{comp.baseQuantity} {comp.unit}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#64748b' }}>{comp.wastePercentage}%</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#64748b' }}>${comp.unitCost.toFixed(3)}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>${comp.lineCost.toFixed(3)}</td>
                                        <td style={{ padding: '6px 8px', color: '#64748b' }}>{comp.notes || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : null}

                              {/* Modifier choices in expanded view */}
                              {recipe.modifierOptions.length > 0 && (
                                <div style={{ marginTop: '8px' }}>
                                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#6d28d9', marginBottom: '6px' }}>
                                    Modifier Option Choices & Dosing:
                                  </div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                      <tr style={{ background: '#ede9fe', borderBottom: '1px solid #ddd6fe', textAlign: 'left' }}>
                                        <th style={{ padding: '6px 8px', color: '#5b21b6' }}>Group</th>
                                        <th style={{ padding: '6px 8px', color: '#5b21b6' }}>Option</th>
                                        <th style={{ padding: '6px 8px', color: '#5b21b6' }}>Catalog Item</th>
                                        <th style={{ padding: '6px 8px', color: '#5b21b6', textAlign: 'right' }}>Dose / Qty</th>
                                        <th style={{ padding: '6px 8px', color: '#5b21b6', textAlign: 'right' }}>Line Cost</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {recipe.modifierOptions.map(opt => (
                                        <tr key={opt.id} style={{ borderBottom: '1px solid #f3e8ff' }}>
                                          <td style={{ padding: '6px 8px', fontWeight: 600, color: '#6d28d9' }}>{opt.groupName}</td>
                                          <td style={{ padding: '6px 8px', fontWeight: 600, color: '#111827' }}>{opt.optionName}</td>
                                          <td style={{ padding: '6px 8px', color: '#4b5563' }}>{opt.itemName || '—'}</td>
                                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{opt.quantity ? `${opt.quantity} ${opt.unit}` : '—'}</td>
                                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>{opt.lineCost ? `$${opt.lineCost.toFixed(3)}` : '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {recipe.recipeText && (
                                <div style={{ marginTop: '10px', fontSize: '12px', color: '#334155', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px' }}>
                                  <strong>Method / Dosing: </strong> {recipe.recipeText}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      ) : (

        /* ========================================================================= */
        /* VIEW MODE 3: REVERSE INGREDIENT USAGE EXPLORER                            */
        /* ========================================================================= */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {ingredientUsageMap
            .filter(ing => {
              if (!ingredientSearch && !searchQuery) return true;
              const q = (ingredientSearch || searchQuery).toLowerCase();
              return ing.name.toLowerCase().includes(q);
            })
            .map(ing => (
              <div 
                key={ing.itemId || ing.name}
                style={{
                  background: '#fff',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>
                      {ing.name}
                    </h4>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {ing.department || 'Catalog Item'} • ${ing.unitCost.toFixed(3)} / {ing.unit}
                    </span>
                  </div>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    padding: '3px 8px', 
                    borderRadius: '12px', 
                    background: '#eff6ff', 
                    color: '#1d4ed8' 
                  }}>
                    Used in {ing.recipesCount} {ing.recipesCount === 1 ? 'item' : 'items'}
                  </span>
                </div>

                {/* List of items using this ingredient */}
                <div style={{ marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Contained in Items:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                    {ing.recipes.map((r, i) => (
                      <div 
                        key={i} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          fontSize: '12px',
                          padding: '4px 6px',
                          borderRadius: '6px',
                          background: '#f8fafc'
                        }}
                      >
                        <div>
                          <strong style={{ color: '#1e293b' }}>{r.recipeName}</strong>
                          <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontSize: '11px' }}>({r.sectionName})</span>
                          {r.usageSource === 'MODIFIER' && (
                            <span style={{ marginLeft: '4px', fontSize: '10px', background: '#ede9fe', color: '#6d28d9', padding: '1px 5px', borderRadius: '4px' }}>
                              Modifier
                            </span>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 600, color: '#2563eb' }}>{r.quantity} {r.unit}</span>
                          <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontSize: '11px' }}>(${r.lineCost.toFixed(2)})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* PRINT-SPECIFIC CSS RULES */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @media print {
          .no-print, .sidebar, .top-bar {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          body, html, .app-layout, .main-content, .content-area {
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          .recipe-report-container {
            padding: 0 !important;
            margin: 0 !important;
          }
          .recipe-card {
            border: 1px solid #ccc !important;
            box-shadow: none !important;
            margin-bottom: 24px !important;
            page-break-inside: avoid !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #ddd !important;
            padding: 6px 8px !important;
            font-size: 11px !important;
          }
        }
      `}</style>
    </div>
  );
}
