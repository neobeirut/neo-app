import { useState, useEffect, useCallback, useMemo } from 'react';

export interface UsePosAutoFitOptions {
  baseWidth?: number;  // Ideal unconstrained width (default: 1366)
  baseHeight?: number; // Ideal unconstrained height (default: 768)
  minScale?: number;   // Minimum downscale factor (default: 0.50)
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
  isPortrait: boolean;
}

export function usePosAutoFit(options: UsePosAutoFitOptions = {}): UsePosAutoFitReturn {
  const {
    baseWidth = 1366,
    baseHeight = 768,
    minScale = 0.50,
    maxScale = 1.0,
    storageKey = 'flow_pos_autofit',
  } = options;

  // Always enable auto-fit by default across all devices and resolutions
  const [isAutoFit, setIsAutoFitState] = useState<boolean>(true);

  const [viewport, setViewport] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : baseWidth,
    height: typeof window !== 'undefined' ? window.innerHeight : baseHeight,
  }));

  const [isPortrait, setIsPortrait] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      (typeof window.matchMedia === 'function' && window.matchMedia('(orientation: portrait)').matches) ||
      window.innerHeight > window.innerWidth
    );
  });

  // Fast & responsive orientation/resize handler with Android Chrome transition support
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateMetrics = () => {
      const curW = window.innerWidth;
      const curH = window.innerHeight;
      const portrait =
        (typeof window.matchMedia === 'function' && window.matchMedia('(orientation: portrait)').matches) ||
        curH > curW;

      setIsPortrait(portrait);
      setViewport(prev => {
        if (Math.abs(prev.width - curW) < 2 && Math.abs(prev.height - curH) < 2) {
          return prev;
        }
        return { width: curW, height: curH };
      });
    };

    let mql: MediaQueryList | null = null;
    try {
      mql = window.matchMedia('(orientation: portrait)');
      if (mql.addEventListener) {
        mql.addEventListener('change', updateMetrics);
      } else if ((mql as any).addListener) {
        (mql as any).addListener(updateMetrics);
      }
    } catch {
      // ignore
    }

    const handleOrientationChange = () => {
      updateMetrics();
      // Android Chrome updates innerWidth/innerHeight asynchronously during orientation transition
      setTimeout(updateMetrics, 100);
      setTimeout(updateMetrics, 250);
      setTimeout(updateMetrics, 500);
    };

    window.addEventListener('resize', updateMetrics, { passive: true });
    window.addEventListener('orientationchange', handleOrientationChange, { passive: true });

    return () => {
      if (mql) {
        if (mql.removeEventListener) {
          mql.removeEventListener('change', updateMetrics);
        } else if ((mql as any).removeListener) {
          (mql as any).removeListener(updateMetrics);
        }
      }
      window.removeEventListener('resize', updateMetrics);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  const scale = useMemo(() => {
    if (!isAutoFit) return 1.0;

    const effectiveBaseW = isPortrait ? 768 : baseWidth;
    const effectiveBaseH = isPortrait ? 1024 : baseHeight;

    const scaleW = viewport.width / effectiveBaseW;
    const scaleH = viewport.height / effectiveBaseH;
    const calculated = Math.min(scaleW, scaleH);

    if (calculated >= 0.98) return 1.0;

    const clamped = Math.min(maxScale, Math.max(minScale, calculated));
    return Math.round(clamped * 100) / 100;
  }, [isAutoFit, viewport.width, viewport.height, baseWidth, baseHeight, minScale, maxScale, isPortrait]);

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

  // Rock-solid 100% viewport container without artificial width bloat (prevents right-edge cart clipping on tablets)
  const containerStyle = useMemo<React.CSSProperties>(() => {
    return {
      width: '100%',
      height: '100dvh',
      maxWidth: '100%',
      maxHeight: '100dvh',
      overflow: 'hidden',
    };
  }, []);

  return {
    scale,
    isAutoFit,
    toggleAutoFit,
    setAutoFit,
    containerStyle,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    isPortrait,
  };
}
