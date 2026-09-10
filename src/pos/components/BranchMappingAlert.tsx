import React from 'react';

interface BranchMappingAlertProps {
  branchName?: string;
  errorMessage?: string;
  onRetry?: () => void;
  onExit?: () => void;
}

export const BranchMappingAlert: React.FC<BranchMappingAlertProps> = ({
  branchName,
  errorMessage,
  onRetry,
  onExit,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#181C24] border border-amber-500/40 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl">
        <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl mx-auto mb-4">
          ⚠️
        </div>
        <h3 className="text-lg font-black text-white mb-2">Commerce Branch Not Mapped</h3>
        <p className="text-xs text-gray-300 mb-4 leading-relaxed">
          The currently active FLOW branch <strong className="text-amber-400 font-bold">"{branchName || 'Unknown'}"</strong> is not mapped to an external OVRLOAD commerce branch in <code className="bg-[#262D3D] px-1.5 py-0.5 rounded text-gray-300">commerce_branch_links</code>.
        </p>
        <div className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-3 text-left mb-5">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Configuration Rule</div>
          <p className="text-xs text-rose-400 font-medium">
            {errorMessage || 'Branch-sensitive operations (creating sales orders, dispatching drivers, and updating branch status) are blocked until an explicit mapping is established.'}
          </p>
        </div>
        <div className="flex gap-2.5">
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="flex-1 py-3 bg-[#262D3D] hover:bg-[#323B4E] text-white rounded-xl text-xs font-bold transition-all"
            >
              🚪 Exit to Admin
            </button>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-black font-extrabold rounded-xl text-xs transition-all shadow-lg"
            >
              🔄 Refresh Status
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
