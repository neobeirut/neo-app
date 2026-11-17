import { useState, useEffect, useCallback, useMemo } from 'react';

export interface UsePosAutoFitOptions {
  baseWidth?: number;  // Ideal unconstrained width (default: 1366)
  baseHeight?: number; // Ideal unconstrained height (default: 768)
  minScale?: number;   // Minimum downscale factor (default: 0.65)
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
    baseWidth = 1366,
    baseHeight = 768,
    minScale = 0.65,
    maxScale = 1.0,
    storageKey = 'flow_pos_autofit',
  } = options;

  // Always enable auto-fit by default across all devices and resolutions
  const [isAutoFit, setIsAutoFitState] = useState<boolean>(true);

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
      }, 100);
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

    const scaleW = viewport.width / baseWidth;
    const scaleH = viewport.height / baseHeight;
    const calculated = Math.min(scaleW, scaleH);

    // If calculated scale is close to 1.0 (>= 0.98), snap to 1.0
    if (calculated >= 0.98) return 1.0;

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
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        overflow: 'hidden',
      };
    }

    const zoomFactor = scale;
    const zoomPercent = `${Math.round((100 / zoomFactor) * 1000) / 1000}%`;

    const supportsZoom = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('zoom', '1');
    if (supportsZoom) {
      return {
        zoom: zoomFactor,
        width: zoomPercent,
        height: zoomPercent,
        maxWidth: zoomPercent,
        maxHeight: zoomPercent,
        overflow: 'hidden',
      } as any;
    }

    return {
      transform: `scale(${zoomFactor})`,
      transformOrigin: 'top left',
      width: zoomPercent,
      height: zoomPercent,
      maxWidth: zoomPercent,
      maxHeight: zoomPercent,
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
