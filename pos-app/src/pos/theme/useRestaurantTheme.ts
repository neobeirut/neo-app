import { useState, useEffect } from 'react';
import { supabase, getGlobalRestaurantId } from '../../api/supabase';

export interface PosTheme {
  mainBg: string;       // #F5F6F4
  orderPanel: string;   // #FFFFFF
  primaryColor: string; // from restaurants.primary_color (Superadmin)
  primaryHover: string;
  primaryLight: string;
  primaryText: string;  // text on top of primary button (white or dark)
  text: string;         // #242B28
  textMuted: string;    // #5E6964
  selected: string;     // #E9F4ED
  border: string;       // #E0E3DF
}

const DEFAULT_PRIMARY = '#1e5c4f'; // Default deep spruce / botanical green

export function adjustColorBrightness(hex: string, percent: number): string {
  try {
    let clean = hex.replace('#', '');
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }
    const num = parseInt(clean, 16);
    let r = (num >> 16) + Math.round(255 * (percent / 100));
    let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
    let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));

    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  } catch {
    return hex;
  }
}

export function getContrastTextColor(hex: string): string {
  try {
    let clean = hex.replace('#', '');
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    const num = parseInt(clean, 16);
    const r = (num >> 16);
    const g = ((num >> 8) & 0x00ff);
    const b = (num & 0x0000ff);
    // YIQ formula
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128 ? '#242B28' : '#FFFFFF';
  } catch {
    return '#FFFFFF';
  }
}

export function applyThemeCssVariables(primary: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const hover = adjustColorBrightness(primary, -12);
  const light = adjustColorBrightness(primary, 40);
  const contrast = getContrastTextColor(primary);

  root.style.setProperty('--pos-main-bg', '#F5F6F4');
  root.style.setProperty('--pos-order-panel', '#FFFFFF');
  root.style.setProperty('--pos-text', '#242B28');
  root.style.setProperty('--pos-text-muted', '#5E6964');
  root.style.setProperty('--pos-selected', '#E9F4ED');
  root.style.setProperty('--pos-border', '#E0E3DF');
  root.style.setProperty('--pos-primary', primary);
  root.style.setProperty('--pos-primary-hover', hover);
  root.style.setProperty('--pos-primary-light', light);
  root.style.setProperty('--pos-primary-contrast', contrast);
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-hover', hover);
}

export function useRestaurantTheme(): PosTheme {
  const [primaryColor, setPrimaryColor] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const cached = localStorage.getItem('flow_pos_restaurant_primary_color');
        if (cached && /^#[0-9A-Fa-f]{3,8}$/.test(cached)) {
          applyThemeCssVariables(cached);
          return cached;
        }
      }
    } catch {}
    applyThemeCssVariables(DEFAULT_PRIMARY);
    return DEFAULT_PRIMARY;
  });

  useEffect(() => {
    let isMounted = true;
    const fetchRestaurantTheme = async () => {
      try {
        const restoId = getGlobalRestaurantId();
        if (!restoId) return;

        const { data, error } = await supabase
          .from('restaurants')
          .select('id, name, primary_color')
          .eq('id', restoId)
          .maybeSingle();

        if (error) {
          console.warn('Error fetching restaurant theme color:', error);
          return;
        }

        if (data && data.primary_color && isMounted) {
          const color = data.primary_color.trim();
          setPrimaryColor(color);
          applyThemeCssVariables(color);
          try {
            localStorage.setItem('flow_pos_restaurant_primary_color', color);
          } catch {}
        }
      } catch (e) {
        console.warn('Restaurant theme loading error:', e);
      }
    };

    fetchRestaurantTheme();

    // Listen for storage updates or custom theme change events
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'flow_pos_restaurant_primary_color' && e.newValue) {
        setPrimaryColor(e.newValue);
        applyThemeCssVariables(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const primaryHover = adjustColorBrightness(primaryColor, -12);
  const primaryLight = adjustColorBrightness(primaryColor, 40);
  const primaryText = getContrastTextColor(primaryColor);

  return {
    mainBg: '#F5F6F4',
    orderPanel: '#FFFFFF',
    primaryColor,
    primaryHover,
    primaryLight,
    primaryText,
    text: '#242B28',
    textMuted: '#5E6964',
    selected: '#E9F4ED',
    border: '#E0E3DF'
  };
}
