import { supabase } from '../../api/supabase';
import type { PosScreen, PosScreenButton } from '../types/posScreen';

// Modern Palette for Screen Matrix Tiles
export const TILE_COLORS = [
  { id: 'slate', name: 'Slate Dark', bg: 'bg-slate-800/90', border: 'border-slate-700', text: 'text-slate-100', hover: 'hover:bg-slate-750' },
  { id: 'amber', name: 'Warm Amber', bg: 'bg-amber-950/70', border: 'border-amber-500/50', text: 'text-amber-200', hover: 'hover:bg-amber-900/80' },
  { id: 'emerald', name: 'Fresh Green', bg: 'bg-emerald-950/70', border: 'border-emerald-500/50', text: 'text-emerald-200', hover: 'hover:bg-emerald-900/80' },
  { id: 'blue', name: 'Ocean Blue', bg: 'bg-blue-950/70', border: 'border-blue-500/50', text: 'text-blue-200', hover: 'hover:bg-blue-900/80' },
  { id: 'purple', name: 'Royal Purple', bg: 'bg-purple-950/70', border: 'border-purple-500/50', text: 'text-purple-200', hover: 'hover:bg-purple-900/80' },
  { id: 'rose', name: 'Burgundy / Rose', bg: 'bg-rose-950/70', border: 'border-rose-500/50', text: 'text-rose-200', hover: 'hover:bg-rose-900/80' },
  { id: 'teal', name: 'Teal Accent', bg: 'bg-teal-950/70', border: 'border-teal-500/50', text: 'text-teal-200', hover: 'hover:bg-teal-900/80' }
];

export function generateDefaultScreens(categories: any[] = [], products: any[] = []): PosScreen[] {
  const screens: PosScreen[] = [];

  // 1. Root Screen: Buttons leading to category subscreens
  const rootButtons: PosScreenButton[] = categories.map((cat, idx) => {
    const palette = TILE_COLORS[idx % TILE_COLORS.length];
    return {
      id: `btn_root_cat_${cat.id || idx}`,
      label: cat.name || `Category ${idx + 1}`,
      type: 'screen',
      targetScreenId: `screen_cat_${cat.id || idx}`,
      color: palette.id,
      sortOrder: idx
    };
  });

  screens.push({
    id: 'root',
    name: 'Main Menu',
    isRoot: true,
    buttons: rootButtons
  });

  // 2. One Subscreen per Category with its product buttons
  categories.forEach((cat, cIdx) => {
    const screenId = `screen_cat_${cat.id || cIdx}`;
    const catProducts = products.filter((p) => {
      if (p.category_id !== undefined && cat.id !== undefined) {
        return String(p.category_id) === String(cat.id);
      }
      if (p.category && cat.name) {
        return p.category.toLowerCase().trim() === cat.name.toLowerCase().trim();
      }
      return false;
    });

    const productButtons: PosScreenButton[] = catProducts.map((p, pIdx) => ({
      id: `btn_prod_${p.id || pIdx}`,
      label: p.name || 'Dish',
      type: 'product',
      productId: p.id,
      color: 'slate',
      sortOrder: pIdx
    }));

    screens.push({
      id: screenId,
      name: cat.name || `Section ${cIdx + 1}`,
      isRoot: false,
      buttons: productButtons
    });
  });

  return screens;
}

export async function fetchPosScreens(
  restaurantId: string,
  fallbackCategories: any[] = [],
  fallbackProducts: any[] = []
): Promise<PosScreen[]> {
  try {
    if (restaurantId) {
      const { data, error } = await supabase
        .from('restaurants')
        .select('settings')
        .eq('id', restaurantId)
        .single();

      if (!error && data?.settings?.pos_screens?.screens && Array.isArray(data.settings.pos_screens.screens) && data.settings.pos_screens.screens.length > 0) {
        return data.settings.pos_screens.screens;
      }
    }
  } catch (err) {
    console.warn('Could not load custom pos_screens from DB:', err);
  }

  // Generate sensible default matrix from current catalog
  return generateDefaultScreens(fallbackCategories, fallbackProducts);
}

export async function savePosScreens(
  restaurantId: string,
  screens: PosScreen[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!restaurantId) return { success: false, error: 'Restaurant ID required' };

    // Fetch existing settings
    const { data: currentRest, error: fetchErr } = await supabase
      .from('restaurants')
      .select('settings')
      .eq('id', restaurantId)
      .single();

    if (fetchErr && !currentRest) {
      return { success: false, error: fetchErr?.message || 'Failed to fetch restaurant settings' };
    }

    const currentSettings = currentRest?.settings || {};
    const updatedSettings = {
      ...currentSettings,
      pos_screens: {
        screens,
        updatedAt: new Date().toISOString()
      }
    };

    const { error: updateErr } = await supabase
      .from('restaurants')
      .update({ settings: updatedSettings })
      .eq('id', restaurantId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error saving POS screens' };
  }
}
