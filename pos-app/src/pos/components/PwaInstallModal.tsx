import React, { useState, useEffect } from 'react';
import { Smartphone, Download, Share, PlusSquare, X, CheckCircle2 } from 'lucide-react';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
}

export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt
}) => {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    const standalone = (window.navigator as any).standalone ||
      window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(Boolean(standalone));
  }, []);

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          onClose();
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-5 text-slate-900 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-2xl shadow-xs flex-shrink-0">
            🍽️
          </div>
          <div>
            <h3 className="font-black text-lg text-slate-900">Install FLOW Waiter POS</h3>
            <p className="text-xs text-slate-500 font-medium">Full-screen tablet & mobile POS experience</p>
          </div>
        </div>

        {isStandalone ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-[#1e5c4f] flex-shrink-0" />
            <div className="text-xs text-emerald-950">
              <span className="font-black">Already Installed!</span> You are running FLOW Waiter POS in standalone full-screen mode.
            </div>
          </div>
        ) : isIOS ? (
          /* iOS / iPad Instructions */
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Install FLOW Waiter POS onto your iPad or iPhone home screen for <strong className="text-slate-900 font-black">permanent 100% full screen</strong> (no browser address bars or tabs):
            </p>

            <div className="space-y-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-lg bg-emerald-50 text-[#1e5c4f] border border-emerald-200 flex items-center justify-center font-black flex-shrink-0">
                  1
                </span>
                <div className="text-slate-700 font-medium">
                  Tap the <strong className="text-slate-900 font-black inline-flex items-center gap-1">Share button <Share className="w-3.5 h-3.5 text-blue-600 inline" /></strong> at the top right of your screen.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-lg bg-emerald-50 text-[#1e5c4f] border border-emerald-200 flex items-center justify-center font-black flex-shrink-0">
                  2
                </span>
                <div className="text-slate-700 font-medium">
                  Scroll down the menu and tap <strong className="text-slate-900 font-black inline-flex items-center gap-1"><PlusSquare className="w-3.5 h-3.5 text-[#1e5c4f] inline" /> Add to Home Screen</strong>.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-lg bg-emerald-50 text-[#1e5c4f] border border-emerald-200 flex items-center justify-center font-black flex-shrink-0">
                  3
                </span>
                <div className="text-slate-700 font-medium">
                  Tap <strong className="text-slate-900 font-black">Add</strong> in the top-right corner.
                </div>
              </div>
            </div>

            <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              💡 <strong>Tip:</strong> Open the new <strong className="text-amber-950 font-bold">Waiter POS</strong> app icon from your iPad home screen to launch without browser borders!
            </p>
          </div>
        ) : deferredPrompt ? (
          /* Android / Chrome Native 1-Tap Install */
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Install FLOW Waiter POS as a standalone app on your tablet for fast offline access and full-screen ordering.
            </p>
            <button
              type="button"
              onClick={handleNativeInstall}
              className="w-full py-3 px-4 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
            >
              <Download className="w-4 h-4" /> Install Waiter POS App
            </button>
          </div>
        ) : (
          /* General Browser Instructions */
          <div className="space-y-3.5 text-xs text-slate-600">
            <p className="leading-relaxed">
              To install this POS app, open your browser menu (tap <strong>⋮</strong> in the top right) and select <strong className="text-slate-900 font-black">Install App</strong>.
            </p>

            {/* Insecure Origin / LAN HTTP Explanation */}
            {typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2 text-[11px] text-amber-900">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <span>ℹ️ Seeing &quot;Create Shortcut&quot; instead of &quot;Install App&quot;?</span>
                </div>
                <p className="text-amber-900 leading-normal">
                  Android Chrome requires a secure context (HTTPS) for native PWA installation. Over local network HTTP (<span className="font-mono text-slate-900 font-bold">{window.location.host}</span>), Chrome temporarily disables Service Workers and falls back to a web shortcut.
                </p>
                <div className="bg-white border border-amber-200 rounded-lg p-2.5 font-mono text-[10px] space-y-1 text-slate-800 shadow-xs">
                  <div className="text-[#1e5c4f] font-bold">Quick 1-Minute Fix in Chrome:</div>
                  <div>1. Type <strong className="text-slate-900 select-all">chrome://flags</strong> in the tablet address bar</div>
                  <div>2. Search for <strong className="text-slate-900 select-all">unsafely-treat-insecure-origin-as-secure</strong></div>
                  <div>3. Paste <strong className="text-amber-900 select-all font-bold">{window.location.origin}</strong> and toggle to <strong>Enabled</strong></div>
                  <div>4. Tap <strong>Relaunch</strong> Chrome. The native <strong>Install App</strong> button will appear!</div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
