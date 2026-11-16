import { useState, useEffect, useCallback, useMemo } from 'react';

export interface UsePosAutoFitOptions {
  baseWidth?: number;  // Ideal unconstrained width (default: 1180)
  baseHeight?: number; // Ideal unconstrained height (default: 820)
  minScale?: number;   // Minimum downscale factor (default: 0.72)
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
    minScale = 0.72,
    maxScale = 1.0,
    storageKey = 'flow_pos_autofit',
  } = options;

  const [isAutoFit, setIsAutoFitState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) return saved === 'true';
      // Default to false on standard screens, enable only if screen height is genuinely constrained (< 780px)
      return typeof window !== 'undefined' && window.innerHeight < 780;
    } catch {
      return false;
    }
  });

  const [viewport, setViewport] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : baseWidth,
    height: typeof window !== 'undefined' ? window.innerHeight : baseHeight,
  }));

  // Debounced window resize handler — NEVER listens to visualViewport to prevent Chrome zoom layout loops
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const curW = window.innerWidth;
        const curH = window.innerHeight;
        setViewport(prev => {
          if (Math.abs(prev.width - curW) < 6 && Math.abs(prev.height - curH) < 6) {
            return prev;
          }
          return { width: curW, height: curH };
        });
      }, 150);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const scale = useMemo(() => {
    if (!isAutoFit) return 1.0;
    // If the browser window height is at least baseHeight - 20, snap to 1.0 (zero scaling)
    if (viewport.height >= baseHeight - 20) return 1.0;

    const scaleW = viewport.width / baseWidth;
    const scaleH = viewport.height / baseHeight;
    const calculated = Math.min(scaleW, scaleH);

    // If calculated scale is close to 1.0 (>= 0.96), snap to 1.0
    if (calculated >= 0.96) return 1.0;

    const clamped = Math.min(maxScale, Math.max(minScale, calculated));
    // Round to 2 decimal places for rock-solid stability
    return Math.round(clamped * 100) / 100;
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
    if (!isAutoFit || scale >= 0.98) {
      return {
        width: '100%',
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
      };
    }

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
