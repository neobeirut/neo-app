import React from 'react';

interface BranchMappingAlertProps {
  branchName?: string;
  restaurantName?: string;
  availableBranches?: Array<{
    flow_branch_id: string;
    flow_branch_name: string;
    external_branch_id: string | number;
    location_key?: string;
  }>;
  onSelectBranch?: (branchName: string) => void;
  onRetry?: () => void;
  onExit?: () => void;
  errorMessage?: string;
}

export const BranchMappingAlert: React.FC<BranchMappingAlertProps> = ({
  branchName,
  restaurantName,
  availableBranches = [],
  onSelectBranch,
  onRetry,
  onExit,
  errorMessage
}) => {
  const isAllOrUnselected = !branchName || branchName.toLowerCase() === 'all' || branchName.toLowerCase() === 'unknown';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 text-center shadow-2xl space-y-4 text-slate-900">
        {/* ICON & TITLE */}
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-3xl mx-auto shadow-sm">
          📍
        </div>

        <div>
          <h3 className="text-xl font-black text-slate-900">
            {isAllOrUnselected ? 'Select POS Terminal Branch' : 'Commerce Branch Not Mapped'}
          </h3>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            {isAllOrUnselected ? (
              <>
                You are signed in as an Admin {restaurantName ? `for ${restaurantName}` : ''}. Please select which physical branch this POS station represents:
              </>
            ) : (
              <>
                The currently active FLOW branch <strong className="text-amber-700 font-bold">"{branchName}"</strong> is not mapped to an external commerce branch in <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 border border-slate-200">commerce_branch_links</code>.
              </>
            )}
          </p>
        </div>

        {/* AVAILABLE BRANCHES SELECTOR */}
        {availableBranches.length > 0 ? (
          <div className="text-left space-y-2 pt-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block px-1">
              Available Branches for {restaurantName || 'This Restaurant'}:
            </span>
            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
              {availableBranches.map((b) => (
                <button
                  key={b.flow_branch_id || b.external_branch_id}
                  type="button"
                  onClick={() => onSelectBranch?.(b.flow_branch_name)}
                  className="w-full p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-emerald-500 text-left transition-all flex items-center justify-between group cursor-pointer active:scale-98 shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 group-hover:border-emerald-500 text-emerald-600 flex items-center justify-center text-base font-black transition shadow-xs">
                      📍
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900 group-hover:text-emerald-700 transition">
                        {b.flow_branch_name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Branch #{b.external_branch_id} {b.location_key ? `• ${b.location_key}` : ''}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs font-black text-emerald-600 opacity-90 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                    Select Branch →
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-left">
            <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider mb-1">Configuration Rule</div>
            <p className="text-xs text-rose-700 font-medium">
              {errorMessage || 'No mapped commerce branches found in commerce_branch_links. Please configure your branch mapping.'}
            </p>
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <div className="flex gap-2.5 pt-2 border-t border-slate-200">
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="flex-1 py-3 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
            >
              🚪 Sign Out
            </button>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition-all shadow-md cursor-pointer"
            >
              🔄 Refresh Status
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
