import { useState, useEffect, useCallback, useMemo } from 'react';

export interface UsePosAutoFitOptions {
  baseWidth?: number;  // Ideal unconstrained width (default: 1180)
  baseHeight?: number; // Ideal unconstrained height (default: 820)
  minScale?: number;   // Minimum downscale factor (default: 0.68)
  maxScale?: number;   // Maximum scale factor (default: 1.0)
  storageKey?: string; // Local storage toggle key
}

export interface UsePosAutoFitReturn {
  scale: number;
  isAutoFit: boolean;
  toggleAutoFit: () => void;
  setAutoFit: (enabled: boolean) => void;
  containerStyle: React.CSSProperties;
  viewportWidth: number;
  viewportHeight: number;
}

export function usePosAutoFit(options: UsePosAutoFitOptions = {}): UsePosAutoFitReturn {
  const {
    baseWidth = 1180,
    baseHeight = 820,
    minScale = 0.68,
    maxScale = 1.0,
    storageKey = 'flow_pos_autofit',
  } = options;

  const [isAutoFit, setIsAutoFitState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  const [viewport, setViewport] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : baseWidth,
    height: typeof window !== 'undefined' ? window.innerHeight : baseHeight,
  }));

  const updateViewport = useCallback(() => {
    if (typeof window === 'undefined') return;
    const w = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    setViewport({ width: Math.round(w), height: Math.round(h) });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    updateViewport();

    let rafId: number | null = null;
    const onResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        updateViewport();
      });
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onResize);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', onResize);
      }
    };
  }, [updateViewport]);

  const scale = useMemo(() => {
    if (!isAutoFit) return 1.0;
    // Calculate ratio needed to fit both width and height within viewport
    const scaleW = viewport.width / baseWidth;
    const scaleH = viewport.height / baseHeight;
    const calculated = Math.min(scaleW, scaleH);

    // Only downscale if the screen is smaller than the base canvas; clamp to safe boundaries
    const target = Math.min(maxScale, Math.max(minScale, calculated));
    // Round to 3 decimal places for stability
    return Math.round(target * 1000) / 1000;
  }, [isAutoFit, viewport.width, viewport.height, baseWidth, baseHeight, minScale, maxScale]);

  const toggleAutoFit = useCallback(() => {
    setIsAutoFitState(prev => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [storageKey]);

  const setAutoFit = useCallback((enabled: boolean) => {
    setIsAutoFitState(enabled);
    try {
      localStorage.setItem(storageKey, String(enabled));
    } catch {
      // ignore
    }
  }, [storageKey]);

  const containerStyle = useMemo<React.CSSProperties>(() => {
    if (!isAutoFit || scale >= 0.999) {
      return {
        width: '100%',
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
      };
    }

    // Modern browser zoom scaling
    const supportsZoom = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('zoom', '1');
    if (supportsZoom) {
      return {
        zoom: scale,
        width: `${Math.round((100 / scale) * 100) / 100}%`,
        height: `${Math.round((100 / scale) * 100) / 100}vh`,
        maxHeight: `${Math.round((100 / scale) * 100) / 100}vh`,
        overflow: 'hidden',
      } as any;
    }

    // Fallback using transform
    return {
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      width: `${Math.round((100 / scale) * 100) / 100}%`,
      height: `${Math.round((100 / scale) * 100) / 100}vh`,
      maxHeight: `${Math.round((100 / scale) * 100) / 100}vh`,
      overflow: 'hidden',
    };
  }, [isAutoFit, scale]);

  return {
    scale,
    isAutoFit,
    toggleAutoFit,
    setAutoFit,
    containerStyle,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  };
}
