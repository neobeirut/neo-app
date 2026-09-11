import React from 'react';

export interface CommerceBranchItem {
  flow_branch_id: string;
  flow_branch_name: string;
  external_branch_id: string;
  external_branch_name: string;
  location_key?: string;
  restaurant_id?: string;
}

interface BranchMappingAlertProps {
  branchName?: string;
  errorMessage?: string;
  restaurantName?: string;
  availableBranches?: CommerceBranchItem[];
  onSelectBranch?: (branchName: string) => void;
  onRetry?: () => void;
  onExit?: () => void;
}

export const BranchMappingAlert: React.FC<BranchMappingAlertProps> = ({
  branchName,
  errorMessage,
  restaurantName,
  availableBranches = [],
  onSelectBranch,
  onRetry,
  onExit,
}) => {
  const isAllOrUnselected = !branchName || branchName.toLowerCase() === 'all' || branchName.toLowerCase() === 'unknown';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 print:hidden animate-fade-in">
      <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl max-w-lg w-full p-6 text-center shadow-2xl space-y-4">
        {/* ICON & TITLE */}
        <div className="w-14 h-14 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-950/50">
          📍
        </div>

        <div>
          <h3 className="text-xl font-black text-white">
            {isAllOrUnselected ? 'Select POS Terminal Branch' : 'Commerce Branch Not Mapped'}
          </h3>
          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
            {isAllOrUnselected ? (
              <>
                You are signed in as an Admin {restaurantName ? `for ${restaurantName}` : ''}. Please select which physical branch this POS station represents:
              </>
            ) : (
              <>
                The currently active FLOW branch <strong className="text-amber-400 font-bold">"{branchName}"</strong> is not mapped to an external commerce branch in <code className="bg-[#262D3D] px-1.5 py-0.5 rounded text-gray-300">commerce_branch_links</code>.
              </>
            )}
          </p>
        </div>

        {/* AVAILABLE BRANCHES SELECTOR */}
        {availableBranches.length > 0 ? (
          <div className="text-left space-y-2 pt-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block px-1">
              Available Branches for {restaurantName || 'This Restaurant'}:
            </span>
            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
              {availableBranches.map((b) => (
                <button
                  key={b.flow_branch_id || b.external_branch_id}
                  type="button"
                  onClick={() => onSelectBranch?.(b.flow_branch_name)}
                  className="w-full p-3.5 rounded-xl bg-[#0F1115] hover:bg-[#222938] border border-[#262D3D] hover:border-emerald-500 text-left transition-all flex items-center justify-between group cursor-pointer active:scale-98 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#262D3D] group-hover:bg-emerald-950/60 border border-slate-700 group-hover:border-emerald-500/50 text-emerald-400 flex items-center justify-center text-base font-black transition">
                      📍
                    </div>
                    <div>
                      <div className="text-sm font-black text-white group-hover:text-emerald-300 transition">
                        {b.flow_branch_name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Branch #{b.external_branch_id} {b.location_key ? `• ${b.location_key}` : ''}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs font-black text-emerald-400 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                    Select Branch →
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-3 text-left">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Configuration Rule</div>
            <p className="text-xs text-rose-400 font-medium">
              {errorMessage || 'No mapped commerce branches found in commerce_branch_links. Please configure your branch mapping.'}
            </p>
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <div className="flex gap-2.5 pt-2 border-t border-[#262D3D]">
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="flex-1 py-3 bg-[#262D3D] hover:bg-[#323B4E] text-slate-200 hover:text-white rounded-xl text-xs font-black transition-all cursor-pointer"
            >
              🚪 Exit to Admin
            </button>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition-all shadow-lg shadow-emerald-950/50 cursor-pointer"
            >
              🔄 Refresh Status
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
