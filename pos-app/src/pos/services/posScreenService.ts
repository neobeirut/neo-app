import { supabase } from '../../api/supabase';
import type { PosScreen, PosScreenButton } from '../types/posScreen';

// Modern High-Contrast Button Color Palette for Screen Matrix Tiles
export const TILE_COLORS = [
  { id: 'slate', name: 'Clean White', bg: 'bg-white', border: 'border-slate-300', text: 'text-slate-800', hover: 'hover:bg-slate-100 hover:border-slate-400' },
  { id: 'amber', name: 'Warm Amber', bg: 'bg-amber-600', border: 'border-amber-700', text: 'text-white', hover: 'hover:bg-amber-700' },
  { id: 'emerald', name: 'Fresh Emerald', bg: 'bg-emerald-600', border: 'border-emerald-700', text: 'text-white', hover: 'hover:bg-emerald-700' },
  { id: 'blue', name: 'Ocean Blue', bg: 'bg-blue-600', border: 'border-blue-700', text: 'text-white', hover: 'hover:bg-blue-700' },
  { id: 'purple', name: 'Royal Purple', bg: 'bg-purple-600', border: 'border-purple-700', text: 'text-white', hover: 'hover:bg-purple-700' },
  { id: 'rose', name: 'Burgundy Wine', bg: 'bg-rose-600', border: 'border-rose-700', text: 'text-white', hover: 'hover:bg-rose-700' },
  { id: 'teal', name: 'Teal Mint', bg: 'bg-teal-600', border: 'border-teal-700', text: 'text-white', hover: 'hover:bg-teal-700' },
  { id: 'orange', name: 'Tangerine', bg: 'bg-orange-500', border: 'border-orange-600', text: 'text-white', hover: 'hover:bg-orange-600' },
  { id: 'charcoal', name: 'Dark Slate', bg: 'bg-slate-800', border: 'border-slate-900', text: 'text-white', hover: 'hover:bg-slate-900' }
];

/**
 * Calculates dynamic grid layout dimensions adhering to:
 * Minimum: 4 horizontal (cols) × 5 vertical (rows) = 20 buttons
 * Maximum: 7 horizontal (cols) × 7 vertical (rows) = 49 buttons
 */
export function calculateDynamicGrid(
  buttonCount: number,
  requestedCols?: number,
  requestedRows?: number
): { cols: number; rows: number; totalSlots: number } {
  let cols = requestedCols ? Math.min(7, Math.max(4, requestedCols)) : 0;
  let rows = requestedRows ? Math.min(7, Math.max(5, requestedRows)) : 0;

  if (cols > 0 && rows > 0) {
    return { cols, rows, totalSlots: cols * rows };
  }

  // Dynamic automatic calculation based on number of buttons
  if (buttonCount <= 20) {
    cols = cols || 4;
    rows = rows || 5;
  } else if (buttonCount <= 25) {
    cols = cols || 5;
    rows = rows || 5;
  } else if (buttonCount <= 30) {
    cols = cols || 5;
    rows = rows || 6;
  } else if (buttonCount <= 36) {
    cols = cols || 6;
    rows = rows || 6;
  } else if (buttonCount <= 42) {
    cols = cols || 7;
    rows = rows || 6;
  } else {
    cols = cols || 7;
    rows = rows || 7;
  }

  cols = Math.min(7, Math.max(4, cols));
  rows = Math.min(7, Math.max(5, rows));

  return { cols, rows, totalSlots: cols * rows };
}

/**
 * Provides adaptive UI density metrics (padding, text size, height) based on grid dimensions.
 */
export function getGridButtonDensity(cols: number, rows: number) {
  if (cols >= 7 || rows >= 7) {
    return {
      padding: 'p-2',
      fontSize: 'text-xs md:text-sm',
      minHeight: 'min-h-[60px]',
      gap: '0.45rem'
    };
  }
  if (cols >= 6 || rows >= 6) {
    return {
      padding: 'p-2.5',
      fontSize: 'text-sm md:text-base lg:text-[17px]',
      minHeight: 'min-h-[72px]',
      gap: '0.55rem'
    };
  }
  if (cols >= 5) {
    return {
      padding: 'p-3',
      fontSize: 'text-base md:text-lg lg:text-xl',
      minHeight: 'min-h-[82px]',
      gap: '0.65rem'
    };
  }
  return {
    padding: 'p-3.5',
    fontSize: 'text-lg md:text-xl lg:text-2xl',
    minHeight: 'min-h-[92px]',
    gap: '0.75rem'
  };
}

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
  fallbackProducts: any[] = [],
  conceptId?: string
): Promise<PosScreen[]> {
  const isNeo = !conceptId || conceptId === '00000000-0000-0000-0000-000000000001' || String(conceptId).toUpperCase() === 'NEO';
  const isOvr = conceptId === '00000000-0000-0000-0000-000000000002' || String(conceptId).toUpperCase() === 'OVRLOAD' || String(conceptId).toUpperCase() === 'OVR';
  const isWck = conceptId === '00000000-0000-0000-0000-000000000003' || String(conceptId).toUpperCase() === 'WICKD' || String(conceptId).toUpperCase() === 'WCK';

  try {
    if (restaurantId) {
      const { data, error } = await supabase
        .from('restaurants')
        .select('settings')
        .eq('id', restaurantId)
        .single();

      if (!error && data?.settings) {
        const conceptKey = isOvr ? 'ovrload' : (isWck ? 'wickd' : (isNeo ? 'neo' : String(conceptId).toLowerCase()));
        const customConceptScreens = data.settings.pos_screens?.[conceptKey]?.screens || data.settings?.[`pos_screens_${conceptKey}`]?.screens;

        if (Array.isArray(customConceptScreens) && customConceptScreens.length > 0) {
          return customConceptScreens;
        }

        // Only use the global restaurant custom screens if the active concept is NÉO
        if (isNeo && data.settings?.pos_screens?.screens && Array.isArray(data.settings.pos_screens.screens) && data.settings.pos_screens.screens.length > 0) {
          return data.settings.pos_screens.screens;
        }
      }
    }
  } catch (err) {
    console.warn('Could not load custom pos_screens from DB:', err);
  }

  // Generate dynamic touch screens from current concept's categories and products
  return generateDefaultScreens(fallbackCategories, fallbackProducts);
}

export async function savePosScreens(
  restaurantId: string,
  screens: PosScreen[],
  conceptId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!restaurantId) return { success: false, error: 'Restaurant ID required' };

    const isNeo = !conceptId || conceptId === '00000000-0000-0000-0000-000000000001' || String(conceptId).toUpperCase() === 'NEO';
    const isOvr = conceptId === '00000000-0000-0000-0000-000000000002' || String(conceptId).toUpperCase() === 'OVRLOAD' || String(conceptId).toUpperCase() === 'OVR';
    const isWck = conceptId === '00000000-0000-0000-0000-000000000003' || String(conceptId).toUpperCase() === 'WICKD' || String(conceptId).toUpperCase() === 'WCK';
    const conceptKey = isOvr ? 'ovrload' : (isWck ? 'wickd' : (isNeo ? 'neo' : String(conceptId).toLowerCase()));

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
    const existingPosScreens = (typeof currentSettings.pos_screens === 'object' && currentSettings.pos_screens !== null && !Array.isArray(currentSettings.pos_screens))
      ? currentSettings.pos_screens
      : {};

    const updatedPosScreens = {
      ...existingPosScreens,
      updatedAt: new Date().toISOString()
    };

    if (isNeo) {
      updatedPosScreens.screens = screens;
      updatedPosScreens.neo = { screens, updatedAt: new Date().toISOString() };
    } else {
      updatedPosScreens[conceptKey] = { screens, updatedAt: new Date().toISOString() };
    }

    const updatedSettings = {
      ...currentSettings,
      pos_screens: updatedPosScreens,
      [`pos_screens_${conceptKey}`]: { screens, updatedAt: new Date().toISOString() }
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
