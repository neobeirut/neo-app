import React, { useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface FullscreenToggleButtonProps {
  className?: string;
  compact?: boolean;
}

function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  return (
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    null
  );
}

export default function FullscreenToggleButton({ className = '', compact = false }: FullscreenToggleButtonProps) {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => Boolean(getFullscreenElement()));

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(getFullscreenElement()));
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (getFullscreenElement()) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        return;
      }

      const root = document.documentElement as any;
      if (root.requestFullscreen) {
        await root.requestFullscreen({ navigationUI: 'hide' });
      } else if (root.webkitRequestFullscreen) {
        await root.webkitRequestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleFullscreen}
      className={
        className ||
        'px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-bold transition flex items-center gap-1.5 border border-slate-300 shadow-xs cursor-pointer'
      }
      title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
    >
      {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      {!compact && <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>}
    </button>
  );
}
