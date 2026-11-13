import { conversionFactor, positiveNumber } from './inventoryConfiguration';

export interface ProductionIngredient {
  item_id: string;
  quantity: string | number;
  unit: string;
  waste_percentage: string | number;
  source_location_id: string;
  notes: string;
}

export interface ProductionRecipeDraft {
  recipe_code: string;
  name: string;
  output_item_id: string;
  target_yield_quantity: string | number;
  yield_unit: string;
  default_location_id: string;
  shelf_life_days: string | number;
  prep_time_minutes: string | number;
  instructions: string;
}

export const emptyProductionRecipe = (): ProductionRecipeDraft => ({
  recipe_code: '', name: '', output_item_id: '', target_yield_quantity: '', yield_unit: '',
  default_location_id: '', shelf_life_days: '', prep_time_minutes: '', instructions: ''
});

export function validateProductionRecipe(draft: ProductionRecipeDraft, ingredients: ProductionIngredient[], items: any[], conversions: any[], locations: any[]): string | null {
  if (!draft.recipe_code.trim() || !draft.name.trim()) return 'Enter a recipe code and name.';
  const output = items.find(i => i.id === draft.output_item_id);
  if (!output) return 'Select an output inventory item.';
  if (!positiveNumber(draft.target_yield_quantity)) return 'Batch yield must be greater than zero and finite.';
  if (conversionFactor(output.id, draft.yield_unit, output.base_unit || output.unit, conversions) === null) return 'Choose a yield unit convertible to the output item’s inventory unit.';
  if (draft.default_location_id && !locations.some(l => l.id === draft.default_location_id)) return 'Select a valid output location.';
  if (draft.shelf_life_days !== '' && (!Number.isInteger(Number(draft.shelf_life_days)) || Number(draft.shelf_life_days) <= 0)) return 'Shelf life must be a positive whole number of days, or blank.';
  if (draft.prep_time_minutes !== '' && (!Number.isInteger(Number(draft.prep_time_minutes)) || Number(draft.prep_time_minutes) < 0)) return 'Preparation time must be a non-negative whole number of minutes, or blank.';
  if (!ingredients.length) return 'Add at least one ingredient with quantity and unit.';
  const seen = new Set<string>();
  for (const ingredient of ingredients) {
    const item = items.find(i => i.id === ingredient.item_id);
    if (!item) return 'Select an inventory item for every ingredient.';
    if (item.id === output.id) return 'The output item cannot be an ingredient in its own recipe.';
    if (seen.has(item.id)) return `${item.name} appears more than once. Combine its quantities into one row.`;
    seen.add(item.id);
    if (!positiveNumber(ingredient.quantity)) return `${item.name}: enter a positive, finite quantity.`;
    if (conversionFactor(item.id, ingredient.unit, item.base_unit || item.unit, conversions) === null) return `${item.name}: choose a unit convertible to ${item.base_unit || item.unit}.`;
    const waste = Number(ingredient.waste_percentage);
    if (!Number.isFinite(waste) || waste < 0 || waste >= 100) return `${item.name}: waste percentage must be from 0 to less than 100.`;
    if (ingredient.source_location_id && !locations.some(l => l.id === ingredient.source_location_id)) return `${item.name}: select a valid source location.`;
  }
  return null;
}
