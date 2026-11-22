import React, { useState } from 'react';
import {
  posWorkspaceService,
  type ConceptWorkspaceInfo,
  type TerminalWorkspaceState
} from '../services/posWorkspaceService';

interface ConceptWorkspaceSwitcherProps {
  workspaceState: TerminalWorkspaceState;
  cartItemCount: number;
  draftCartCounts?: Record<string, number>;
  canSwitchConcepts?: boolean;
  onWorkspaceChanged: (newState: TerminalWorkspaceState) => void;
  onClearCartRequest?: () => void;
}

export const ConceptWorkspaceSwitcher: React.FC<ConceptWorkspaceSwitcherProps> = ({
  workspaceState,
  cartItemCount,
  draftCartCounts = {},
  canSwitchConcepts = true,
  onWorkspaceChanged,
  onClearCartRequest
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const active = workspaceState.activeConcept;
  const isMultiConceptEnabled = Boolean(canSwitchConcepts && (workspaceState.allowedConcepts?.length || 0) > 1);

  // When the user has access to only 1 concept, the dropdown to select concepts is NOT displayed.
  // Displays only a clean dedicated static concept identity pill.
  if (!isMultiConceptEnabled) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black text-white shadow-sm border border-white/20 select-none"
        style={{ backgroundColor: active.primary_color }}
        title={`Dedicated ${active.name} POS Workspace`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        <span className="tracking-wide uppercase text-xs">{active.name}</span>
      </div>
    );
  }

  const handleSelectConcept = async (targetConcept: ConceptWorkspaceInfo) => {
    if (!isMultiConceptEnabled) return;
    if (targetConcept.id === active.id) {
      setIsOpen(false);
      return;
    }

    setIsSwitching(true);
    try {
      const result = await posWorkspaceService.switchConceptWorkspace(targetConcept.id);
      if (result.success && result.state) {
        // Preserves separate draft carts per concept without discarding cashier work
        onWorkspaceChanged(result.state);
      }
    } finally {
      setIsSwitching(false);
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Brand Pill Trigger Button with Dropdown (Visible only for Multi-Concept Authorized Users) */}
      <div className="relative inline-block text-left">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black text-white shadow-sm transition-all active:scale-95 border border-white/20 hover:brightness-110 cursor-pointer"
          style={{ backgroundColor: active.primary_color }}
          title={`Active Workspace: ${active.name} — Click to switch`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="tracking-wide uppercase text-xs">{active.name}</span>
          <svg className="w-3 h-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1">
              Select Concept Workspace
            </div>
            <div className="space-y-1">
              {workspaceState.allowedConcepts.map(c => {
                const isSelected = c.id === active.id;
                const draftCount = draftCartCounts[c.id] || 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectConcept(c)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-white/10 text-white border border-white/20'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full shadow-sm"
                        style={{ backgroundColor: c.primary_color }}
                      />
                      <span>{c.name}</span>
                      {draftCount > 0 && !isSelected && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                          {draftCount} in draft
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {c.receipt_prefix}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
