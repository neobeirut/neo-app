export type InventoryMode = 'NONE' | 'RECIPE' | 'FINISHED_GOOD';
export const inventoryModes: InventoryMode[] = ['NONE', 'RECIPE', 'FINISHED_GOOD'];

export const positiveNumber = (value: unknown): boolean =>
  Number.isFinite(Number(value)) && Number(value) > 0;

export const normalize = (unit: string): string => (unit || '').trim().toLowerCase();

/**
 * Standard canonical unit mappings.
 * Normalizes equivalent unit labels such as g/gr/gram/grams to one canonical string.
 */
export const CANONICAL_UNIT_ALIASES: Record<string, string> = {
  // Weight
  g: 'g', gr: 'g', gram: 'g', grams: 'g', gm: 'g', 'g.': 'g',
  kg: 'kg', kilo: 'kg', kilogram: 'kg', kilograms: 'kg', kgs: 'kg', 'kg.': 'kg',
  mg: 'mg', milligram: 'mg', milligrams: 'mg', 'mg.': 'mg',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',

  // Volume
  ml: 'ml', milliliter: 'ml', millilitre: 'ml', milliliters: 'ml', millilitres: 'ml', mls: 'ml', 'ml.': 'ml',
  l: 'l', lt: 'l', liter: 'l', litre: 'l', liters: 'l', litres: 'l', littre: 'l', 'l.': 'l',
  cl: 'cl', centiliter: 'cl', centilitre: 'cl', 'cl.': 'cl',
  dl: 'dl', deciliter: 'dl', decilitre: 'dl',

  // Count & Portions
  pcs: 'pcs', pc: 'pcs', piece: 'pcs', pieces: 'pcs', ea: 'pcs', each: 'pcs', unit: 'pcs', units: 'pcs', pce: 'pcs',
  egg: 'pcs', eggs: 'pcs',
  portion: 'portion', portions: 'portion', serving: 'portion', servings: 'portion'
};

export function canonicalUnit(unit: string): string {
  const norm = normalize(unit);
  return CANONICAL_UNIT_ALIASES[norm] || norm;
}

export type UnitDimension = 'weight' | 'volume' | 'count' | 'portion' | 'custom';

export function unitDimension(unit: string): UnitDimension {
  const c = canonicalUnit(unit);
  if (['g', 'kg', 'mg', 'oz', 'lb'].includes(c)) return 'weight';
  if (['ml', 'l', 'cl', 'dl'].includes(c)) return 'volume';
  if (['pcs'].includes(c)) return 'count';
  if (['portion'].includes(c)) return 'portion';
  return 'custom';
}

/**
 * Built-in standard physical conversions between canonical units within the same dimension.
 */
const STANDARD_METRIC_FACTORS: Record<string, number> = {
  'kg->g': 1000,
  'g->kg': 0.001,
  'g->mg': 1000,
  'mg->g': 0.001,
  'kg->mg': 1000000,
  'mg->kg': 0.000001,

  'l->ml': 1000,
  'ml->l': 0.001,
  'cl->ml': 10,
  'ml->cl': 0.1,
  'l->cl': 100,
  'cl->l': 0.01,
  'dl->ml': 100,
  'ml->dl': 0.01,

  'pcs->pcs': 1,
  'portion->portion': 1
};

/**
 * Calculates the conversion factor from `fromUnit` to `toUnit`.
 * Precedence:
 * 1. Exact or canonical identity (1)
 * 2. Item-specific conversions in `conversions` (forward and inverse)
 * 3. Packaging options in `packagingOptions` (forward and inverse)
 * 4. Global conversions in `conversions` (where item_id is null)
 * 5. Standard metric physical conversions (within same dimension)
 * Returns null if no valid conversion exists. Never blindly assumes 1.
 */
export function conversionFactor(
  itemId: string | null | undefined,
  from: string,
  to: string,
  conversions: any[] = [],
  packagingOptions: any[] = []
): number | null {
  const rawFrom = normalize(from);
  const rawTo = normalize(to);
  if (!rawFrom || !rawTo) return null;
  if (rawFrom === rawTo) return 1;

  const canonFrom = canonicalUnit(from);
  const canonTo = canonicalUnit(to);
  if (canonFrom === canonTo) return 1;

  // 1. Check item-specific conversions in item_unit_conversions
  if (itemId) {
    const itemConvs = conversions.filter(c => c.item_id === itemId);
    for (const c of itemConvs) {
      const cFrom = normalize(c.from_unit);
      const cTo = normalize(c.to_unit);
      const cFromCanon = canonicalUnit(c.from_unit);
      const cToCanon = canonicalUnit(c.to_unit);

      if ((cFrom === rawFrom && cTo === rawTo) || (cFromCanon === canonFrom && cToCanon === canonTo)) {
        if (positiveNumber(c.conversion_factor)) return Number(c.conversion_factor);
      }
      if ((cFrom === rawTo && cTo === rawFrom) || (cFromCanon === canonTo && cToCanon === canonFrom)) {
        if (positiveNumber(c.conversion_factor)) return 1 / Number(c.conversion_factor);
      }

      // Chained metric conversion (e.g. "Bottle = 1 l" allows converting "ml -> bottle" via "ml -> l -> bottle")
      if (positiveNumber(c.conversion_factor)) {
        const factor = Number(c.conversion_factor);
        // Case A: cTo matches target (e.g. c: l -> bottle, or inverse c: bottle -> l where target is bottle)
        if (cTo === rawTo || cToCanon === canonTo) {
          const bridge = STANDARD_METRIC_FACTORS[`${canonFrom}->${cFromCanon}`];
          if (bridge) return bridge * factor;
        }
        if (cFrom === rawTo || cFromCanon === canonTo) {
          const bridge = STANDARD_METRIC_FACTORS[`${canonFrom}->${cToCanon}`];
          if (bridge) return bridge * (1 / factor);
        }
        // Case B: cFrom matches source (e.g. converting bottle -> ml via bottle -> l -> ml)
        if (cFrom === rawFrom || cFromCanon === canonFrom) {
          const bridge = STANDARD_METRIC_FACTORS[`${cToCanon}->${canonTo}`];
          if (bridge) return factor * bridge;
        }
        if (cTo === rawFrom || cToCanon === canonFrom) {
          const bridge = STANDARD_METRIC_FACTORS[`${cFromCanon}->${canonTo}`];
          if (bridge) return (1 / factor) * bridge;
        }
      }
    }

    // 2. Check supplier packaging options in packagingOptions
    const itemPacks = packagingOptions.filter(p => p.item_id === itemId && (p.is_active !== false));
    for (const p of itemPacks) {
      const pUnit = normalize(p.purchase_unit);
      const pDesc = normalize(p.pack_description || '');
      const pBrandUnit = normalize(`${p.brand || ''} ${p.purchase_unit || ''}`.trim());
      const pBaseUnit = normalize(p.base_unit);
      const pBaseCanon = canonicalUnit(p.base_unit);
      const baseQty = Number(p.base_quantity_per_purchase_unit);

      if (positiveNumber(baseQty)) {
        // Forward: pack -> base_unit
        if ((rawFrom === pUnit || rawFrom === pDesc || rawFrom === pBrandUnit) &&
            (rawTo === pBaseUnit || canonTo === pBaseCanon)) {
          return baseQty;
        }
        // Inverse: base_unit -> pack
        if ((rawTo === pUnit || rawTo === pDesc || rawTo === pBrandUnit) &&
            (rawFrom === pBaseUnit || canonFrom === pBaseCanon)) {
          return 1 / baseQty;
        }
      }
    }
  }

  // 3. Check global conversions in item_unit_conversions
  const globalConvs = conversions.filter(c => !c.item_id);
  for (const c of globalConvs) {
    const cFrom = normalize(c.from_unit);
    const cTo = normalize(c.to_unit);
    const cFromCanon = canonicalUnit(c.from_unit);
    const cToCanon = canonicalUnit(c.to_unit);

    if ((cFrom === rawFrom && cTo === rawTo) || (cFromCanon === canonFrom && cToCanon === canonTo)) {
      if (positiveNumber(c.conversion_factor)) return Number(c.conversion_factor);
    }
    if ((cFrom === rawTo && cTo === rawFrom) || (cFromCanon === canonTo && cToCanon === canonFrom)) {
      if (positiveNumber(c.conversion_factor)) return 1 / Number(c.conversion_factor);
    }
  }

  // 4. Inherent standard physical conversions between canonical units
  const keyForward = `${canonFrom}->${canonTo}`;
  if (STANDARD_METRIC_FACTORS[keyForward]) {
    return STANDARD_METRIC_FACTORS[keyForward];
  }
  const keyInverse = `${canonTo}->${canonFrom}`;
  if (STANDARD_METRIC_FACTORS[keyInverse]) {
    return 1 / STANDARD_METRIC_FACTORS[keyInverse];
  }

  // 5. Standard culinary liquid density fallback: 1 kg = 1 L (and 1 g = 1 ml)
  // Water, juices, vinegars, broths, and milk commonly approximate 1 kg per liter in culinary prep
  if ((canonFrom === 'kg' && canonTo === 'l') || (canonFrom === 'l' && canonTo === 'kg')) {
    return 1;
  }
  if ((canonFrom === 'g' && canonTo === 'ml') || (canonFrom === 'ml' && canonTo === 'g')) {
    return 1;
  }
  if ((canonFrom === 'g' && canonTo === 'l') || (canonFrom === 'ml' && canonTo === 'kg')) {
    return 0.001;
  }
  if ((canonFrom === 'kg' && canonTo === 'ml') || (canonFrom === 'l' && canonTo === 'g')) {
    return 1000;
  }

  return null;
}

/**
 * Returns a list of all units that can validly convert to the item's base unit.
 * Places the item's preferred_recipe_unit first if configured.
 */
export function getConvertibleUnits(
  item: any,
  conversions: any[] = [],
  packagingOptions: any[] = []
): string[] {
  if (!item) return ['pcs'];
  const baseUnit = canonicalUnit(item.base_unit || item.unit || 'pcs');
  const preferred = item.preferred_recipe_unit ? canonicalUnit(item.preferred_recipe_unit) : null;
  const dim = unitDimension(baseUnit);

  const unitsSet = new Set<string>();

  // Add preferred recipe unit first if set
  if (preferred) {
    unitsSet.add(preferred);
  }

  // Add base unit
  unitsSet.add(baseUnit);

  // Add same dimension metric units
  if (dim === 'weight') {
    ['g', 'kg', 'mg'].forEach(u => unitsSet.add(u));
  } else if (dim === 'volume') {
    ['ml', 'l', 'cl', 'dl'].forEach(u => unitsSet.add(u));
  } else if (dim === 'count') {
    unitsSet.add('pcs');
  } else if (dim === 'portion') {
    unitsSet.add('portion');
  }

  // Add units from item-specific conversions
  conversions
    .filter(c => c.item_id === item.id)
    .forEach(c => {
      const f = canonicalUnit(c.from_unit);
      const t = canonicalUnit(c.to_unit);
      if (f === baseUnit) unitsSet.add(t);
      if (t === baseUnit) unitsSet.add(f);
      unitsSet.add(c.from_unit);
      unitsSet.add(f);
      unitsSet.add(t);
      if (unitDimension(f) === 'volume' || unitDimension(t) === 'volume') {
        ['ml', 'l', 'cl'].forEach(u => unitsSet.add(u));
      }
      if (unitDimension(f) === 'weight' || unitDimension(t) === 'weight') {
        ['g', 'kg', 'mg'].forEach(u => unitsSet.add(u));
      }
    });

  // Add packaging options
  packagingOptions
    .filter(p => p.item_id === item.id && p.is_active !== false)
    .forEach(p => {
      if (p.purchase_unit) unitsSet.add(p.purchase_unit);
      if (p.pack_description) unitsSet.add(p.pack_description);
      if (p.brand && p.purchase_unit) unitsSet.add(`${p.brand} ${p.purchase_unit}`);
    });

  // Filter to only those that can actually convert
  const result: string[] = [];
  for (const u of unitsSet) {
    if (conversionFactor(item.id, u, baseUnit, conversions, packagingOptions) !== null) {
      result.push(u);
    }
  }

  // Ensure preferred is first if present
  if (preferred && result.includes(preferred)) {
    return [preferred, ...result.filter(u => u !== preferred)];
  }

  return result.length > 0 ? result : [baseUnit];
}

/**
 * Format a helpful conversion preview string.
 * Example: "80 g = 0.08 kg deducted from inventory"
 */
export function formatConversionPreview(
  qty: number,
  fromUnit: string,
  toBaseUnit: string,
  factor: number | null
): string {
  if (!positiveNumber(qty) || !fromUnit || !toBaseUnit || factor === null) {
    return '';
  }
  const baseQty = qty * factor;
  // Round cleanly for preview
  const displayQty = baseQty >= 1 ? Number(baseQty.toFixed(4)) : Number(baseQty.toPrecision(3));
  if (normalize(fromUnit) === normalize(toBaseUnit)) {
    return `${qty} ${fromUnit} deducted from inventory`;
  }
  return `${qty} ${fromUnit} = ${displayQty} ${toBaseUnit} deducted from inventory`;
}

/**
 * Calculates mixed count entries into a single base quantity and audit breakdown text.
 * Example: 1 Brand A container (3.8 kg) + 500 g = 4.3 kg
 */
export function calculateMixedCount(
  entries: { quantity: number | string; unit: string }[],
  itemId: string,
  baseUnit: string,
  conversions: any[] = [],
  packagingOptions: any[] = []
): { totalBaseQty: number; breakdownText: string; error?: string } {
  let total = 0;
  const parts: string[] = [];

  for (const entry of entries) {
    const qty = Number(entry.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const factor = conversionFactor(itemId, entry.unit, baseUnit, conversions, packagingOptions);
    if (factor === null) {
      return {
        totalBaseQty: 0,
        breakdownText: '',
        error: `Cannot convert unit "${entry.unit}" to base unit "${baseUnit}".`
      };
    }
    const converted = qty * factor;
    total += converted;
    parts.push(`${qty} ${entry.unit} (${Number(converted.toFixed(4))} ${baseUnit})`);
  }

  const breakdownText = parts.length > 0 ? parts.join(' + ') : `0 ${baseUnit}`;
  return { totalBaseQty: Number(total.toFixed(4)), breakdownText };
}

export function validateComponents(
  components: any[],
  items: any[],
  conversions: any[] = [],
  packagingOptions: any[] = []
): string | null {
  if (!components.length) return 'BOM must have at least one component.';
  const seen = new Set<string>();
  for (const component of components) {
    const item = items.find(i => i.id === component.item_id);
    if (!item) return 'Every component must reference an existing inventory item.';
    if (!positiveNumber(component.base_quantity)) return `${item.name}: quantity must be greater than zero and finite.`;
    const targetBase = item.base_unit || item.unit;
    if (conversionFactor(item.id, component.unit, targetBase, conversions, packagingOptions) === null) {
      return `${item.name}: choose a unit convertible to ${targetBase}.`;
    }
    if (seen.has(item.id)) return `${item.name} appears more than once. Combine the quantities in one row.`;
    seen.add(item.id);
  }
  return null;
}

export function validateMapping(itemId: string, ratio: unknown, items: any[]): string | null {
  if (!items.some(i => i.id === itemId)) return 'Select a valid inventory item for finished-good tracking.';
  if (!positiveNumber(ratio)) return 'Units per sale must be greater than zero and finite.';
  return null;
}

export function resolveReferenceRecipe(reference: any, recipes: any[]) {
  const exact = recipes.find(r => r.id === reference.id);
  const matches = recipes.filter(r => normalize(r.name) === normalize(reference.name));
  return exact || (matches.length === 1 ? matches[0] : undefined);
}

export function resolveReferenceOutput(reference: any, recipes: any[], items: any[]) {
  const recipe = resolveReferenceRecipe(reference, recipes);
  return recipe?.output_item_id ? items.find(i => i.id === recipe.output_item_id) : undefined;
}

/**
 * Resolves the unit cost of an inventory item.
 * 1. Checks if this item is produced by a Production Recipe. If so, recursively calculates
 *    the production cost per yield unit from its ingredients.
 * 2. If not produced by a production recipe or production cost is 0, falls back to direct price_usd.
 */
export function resolveItemEffectiveCost(
  itemId: string,
  items: any[] = [],
  productionRecipes: any[] = [],
  conversions: any[] = [],
  packagingOptions: any[] = [],
  visited: Set<string> = new Set()
): { unitCost: number; isFromProductionRecipe: boolean; recipeName?: string } {
  if (!itemId || visited.has(itemId)) {
    return { unitCost: 0, isFromProductionRecipe: false };
  }
  visited.add(itemId);

  const item = items.find(i => i.id === itemId);
  if (!item) return { unitCost: 0, isFromProductionRecipe: false };

  const directPrice = Number(item.price_usd) || 0;

  // Check if item is produced by a production recipe
  const prodRecipe = productionRecipes.find(pr => pr.output_item_id === itemId);
  if (prodRecipe && Number(prodRecipe.target_yield_quantity) > 0) {
    const recipeItems = prodRecipe.production_recipe_items || [];
    if (recipeItems.length > 0) {
      let batchCost = 0;
      for (const ing of recipeItems) {
        const ingId = ing.item_id;
        const ingItem = items.find(i => i.id === ingId);
        if (!ingItem) continue;

        const { unitCost: ingUnitCost } = resolveItemEffectiveCost(
          ingId,
          items,
          productionRecipes,
          conversions,
          packagingOptions,
          new Set(visited)
        );

        const ingUnit = ing.unit || ingItem.unit || ingItem.base_unit;
        const targetBase = ingItem.base_unit || ingItem.unit;
        const factor = conversionFactor(ingId, ingUnit, targetBase, conversions, packagingOptions) ?? 1;
        const waste = Number(ing.waste_percentage) || 0;
        const wasteFactor = (waste > 0 && waste < 100) ? 1 / (1 - waste / 100) : 1;
        const qtyInBase = (ing.quantity !== undefined && ing.quantity !== null && ing.quantity !== '')
          ? Number(ing.quantity) * factor
          : Number(ing.base_quantity || 0);

        batchCost += qtyInBase * ingUnitCost * wasteFactor;
      }

      const yieldQty = Number(prodRecipe.target_yield_quantity);
      const costPerYieldUnit = yieldQty > 0 ? batchCost / yieldQty : 0;

      if (costPerYieldUnit > 0) {
        return {
          unitCost: Math.round(costPerYieldUnit * 10000) / 10000,
          isFromProductionRecipe: true,
          recipeName: prodRecipe.name
        };
      }
    }
  }

  return { unitCost: directPrice, isFromProductionRecipe: false };
}
