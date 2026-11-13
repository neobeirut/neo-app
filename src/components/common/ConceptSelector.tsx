import React, { useState, useRef, useEffect } from 'react';
import { useActiveConcept, type ConceptFilter } from '../../context/ConceptContext';
import { Layers, ChevronDown, Check, Building2, Store, Sparkles, Shield } from 'lucide-react';

export default function ConceptSelector() {
  const { activeConcept, activeProfile, setActiveConcept, availableConcepts } = useActiveConcept();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getConceptIcon = (code: ConceptFilter) => {
    switch (code) {
      case 'ALL':
        return <Building2 size={16} className="text-slate-400" />;
      case 'NEO':
        return <Store size={16} className="text-emerald-500" />;
      case 'OVRLOAD':
        return <Sparkles size={16} className="text-rose-500" />;
      case 'WICKD':
        return <Sparkles size={16} className="text-purple-500" />;
    }
  };

  const getBadgeStyle = (code: ConceptFilter) => {
    switch (code) {
      case 'ALL':
        return { background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#f8fafc', border: '1px solid #334155' };
      case 'NEO':
        return { background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)', color: '#ecfdf5', border: '1px solid #047857' };
      case 'OVRLOAD':
        return { background: 'linear-gradient(135deg, #881337 0%, #9f1239 100%)', color: '#fff1f2', border: '1px solid #be123c' };
      case 'WICKD':
        return { background: 'linear-gradient(135deg, #4c1d95 0%, #581c87 100%)', color: '#faf5ff', border: '1px solid #6b21a8' };
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all duration-150 cursor-pointer focus:outline-none"
        style={getBadgeStyle(activeConcept)}
        title="Switch Commercial Concept Context"
      >
        <span className="flex items-center justify-center w-5 h-5 rounded-md bg-black/20">
          {getConceptIcon(activeConcept)}
        </span>
        <div className="flex flex-col text-left leading-tight">
          <span className="font-bold tracking-wide uppercase text-[11px]">{activeProfile.name}</span>
          <span className="text-[9px] opacity-75 font-normal truncate max-w-[140px] hidden sm:inline">
            {activeProfile.code === 'ALL' ? 'Company Overview' : activeProfile.tagline}
          </span>
        </div>
        <ChevronDown size={14} className={`transition-transform duration-200 ml-1 opacity-80 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl z-50 overflow-hidden backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3.5 py-2.5 border-b border-slate-800 bg-slate-950/60">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Commercial Concept Context
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Filters dashboards, orders, inventory & reports
            </div>
          </div>

          <div className="p-1.5 space-y-1">
            {availableConcepts.map((concept) => {
              const isSelected = activeConcept === concept.code;
              return (
                <button
                  key={concept.code}
                  onClick={() => {
                    setActiveConcept(concept.code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                    isSelected 
                      ? 'bg-slate-800 text-white font-semibold' 
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span 
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: concept.primaryColor }}
                    />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold">{concept.name}</span>
                        {concept.code === 'ALL' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                            EXEC
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 line-clamp-1">
                        {concept.code === 'ALL' ? 'Cross-concept consolidated view' : concept.tagline}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <Check size={14} className="text-emerald-400 flex-shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="px-3.5 py-2 border-t border-slate-800/80 bg-slate-950/40 text-[10px] text-slate-400 flex items-center gap-1.5">
            <Shield size={11} className="text-slate-500" />
            <span>Strict concept isolation enforced</span>
          </div>
        </div>
      )}
    </div>
  );
}
