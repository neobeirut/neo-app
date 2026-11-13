import React from 'react';
import type { StatusGroup, ChannelType } from './orderAdapter';
import type { MigrationFilterType } from './orderStore';

interface OrderFiltersProps {
  activeStatusTab: StatusGroup | 'TABLES' | 'ALL';
  onStatusTabChange: (tab: StatusGroup | 'TABLES' | 'ALL') => void;
  activeChannelFilter: 'All' | ChannelType;
  onChannelFilterChange: (channel: 'All' | ChannelType) => void;
  activeConceptFilter?: 'All' | 'NEO' | 'OVRLOAD' | 'WICKD';
  onConceptFilterChange?: (concept: 'All' | 'NEO' | 'OVRLOAD' | 'WICKD') => void;
  isConceptLocked?: boolean;
  activeMigrationFilter?: MigrationFilterType;
  onMigrationFilterChange?: (filter: MigrationFilterType) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  counts: Record<StatusGroup | 'TABLES' | 'ALL', number>;
}

export const OrderFilters: React.FC<OrderFiltersProps> = ({
  activeStatusTab,
  onStatusTabChange,
  activeChannelFilter,
  onChannelFilterChange,
  activeConceptFilter = 'All',
  onConceptFilterChange,
  isConceptLocked = false,
  activeMigrationFilter = 'ALL',
  onMigrationFilterChange,
  searchQuery,
  onSearchQueryChange,
  counts
}) => {
  const isTableServiceEnabled = activeConceptFilter === 'All' || activeConceptFilter === 'NEO';

  const primaryTabs: { id: StatusGroup | 'TABLES'; label: string; icon: string }[] = [
    ...(isTableServiceEnabled ? [{ id: 'TABLES' as const, label: 'Tables', icon: '🪑' }] : []),
    { id: 'NEW' as const, label: 'New', icon: '⚡' },
    { id: 'CONFIRMED' as const, label: 'Confirmed', icon: '👍' },
    { id: 'PREPARING' as const, label: 'Preparing', icon: '🍳' },
    { id: 'READY' as const, label: 'Ready', icon: '📦' },
    { id: 'COMPLETED' as const, label: 'Completed', icon: '✓' },
    { id: 'CANCELLED' as const, label: 'Canceled', icon: '🚫' }
  ];

  const secondaryTabs: { id: StatusGroup | 'ALL'; label: string; icon: string }[] = [
    { id: 'HELD', label: 'Held', icon: '⏸️' },
    { id: 'ALL', label: 'All Orders', icon: '📋' }
  ];

  const channels: ('All' | ChannelType)[] = [
    'All',
    ...(isTableServiceEnabled ? ['Tables' as const] : []),
    'POS',
    'WhatsApp',
    'App',
    'Toters',
    'NokNok'
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          {primaryTabs.map(tab => {
            const isActive = activeStatusTab === tab.id;
            const count = counts[tab.id] || 0;
            const isTable = tab.id === 'TABLES';
            const isCanceled = tab.id === 'CANCELLED';
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onStatusTabChange(tab.id)}
                className={'px-3.5 py-2 rounded-xl text-xs font-black tracking-wider transition-all flex items-center gap-2 ' + (
                  isActive
                    ? (isTable
                        ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 border border-amber-400'
                        : isCanceled
                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/25 border border-rose-500'
                        : 'bg-[#1e5c4f] text-white shadow-xs border border-[#1e5c4f]')
                    : (isCanceled && count > 0
                        ? 'text-rose-400/90 hover:text-rose-300 hover:bg-rose-950/30'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white')
                )}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className={'px-1.5 py-0.5 rounded-md text-[11px] font-black ' + (
                  isActive
                    ? (isTable ? 'bg-black/20 text-slate-950' : 'bg-black/30 text-white')
                    : (isCanceled && count > 0 ? 'bg-rose-950/80 text-rose-300 border border-rose-500/40' : 'bg-white text-slate-700 border border-slate-200')
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          {secondaryTabs.map(tab => {
            const isActive = activeStatusTab === tab.id;
            const count = counts[tab.id] || 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onStatusTabChange(tab.id)}
                className={'px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ' + (
                  isActive
                    ? 'bg-gray-700 text-white border border-gray-500'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                )}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className="text-[10px] text-slate-500">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Filters: Channel & Data Origin */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Channel:</span>
            {channels.map(ch => {
              const isActive = activeChannelFilter === ch;
              const isTableChannel = ch === 'Tables';
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => onChannelFilterChange(ch)}
                  className={'px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ' + (
                    isActive
                      ? (isTableChannel
                          ? 'bg-amber-500 text-slate-950 font-black shadow-sm border border-amber-400'
                          : 'bg-[#1e5c4f] text-white shadow-xs')
                      : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200'
                  )}
                >
                  {ch === 'Tables' ? '🪑 Tables' : ch}
                </button>
              );
            })}
          </div>

          {/* Concept Filter (Phase 2 Multi-Concept Integration) */}
          {onConceptFilterChange && (
            isConceptLocked && activeConceptFilter !== 'All' ? (
              <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-black text-slate-500 uppercase">Concept:</span>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-black text-white flex items-center gap-1.5 ${
                  activeConceptFilter === 'OVRLOAD' ? 'bg-[#e11d48]' : activeConceptFilter === 'WICKD' ? 'bg-[#7c3aed]' : 'bg-[#1e5c4f]'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span>{activeConceptFilter}</span>
                </span>
                <span className="text-[10px] text-slate-400 font-bold">(Locked)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black text-slate-600 uppercase px-1.5">Concept:</span>
                <button
                  type="button"
                  onClick={() => onConceptFilterChange('All')}
                  className={'px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ' + (
                    activeConceptFilter === 'All'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  )}
                >
                  All Concepts
                </button>
                <button
                  type="button"
                  onClick={() => onConceptFilterChange('NEO')}
                  className={'px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ' + (
                    activeConceptFilter === 'NEO'
                      ? 'bg-[#1e5c4f] text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-white'
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-[#1e5c4f] inline-block border border-white" />
                  <span>NÉO</span>
                </button>
                <button
                  type="button"
                  onClick={() => onConceptFilterChange('OVRLOAD')}
                  className={'px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ' + (
                    activeConceptFilter === 'OVRLOAD'
                      ? 'bg-[#e11d48] text-white shadow-xs'
                      : 'text-rose-700 hover:text-rose-900 hover:bg-rose-50'
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-[#e11d48] inline-block border border-white" />
                  <span>OVRLOAD</span>
                </button>
                <button
                  type="button"
                  onClick={() => onConceptFilterChange('WICKD')}
                  className={'px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ' + (
                    activeConceptFilter === 'WICKD'
                      ? 'bg-[#7c3aed] text-white shadow-xs'
                      : 'text-purple-700 hover:text-purple-900 hover:bg-purple-50'
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-[#7c3aed] inline-block border border-white" />
                  <span>WICKD</span>
                </button>
              </div>
            )
          )}

          {/* Migration / Genuine Record Filter */}
          {onMigrationFilterChange && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <span className="text-[10px] font-black text-slate-600 uppercase px-2">Source:</span>
              <button
                type="button"
                onClick={() => onMigrationFilterChange('ALL')}
                className={'px-2.5 py-1 rounded-lg text-xs font-bold transition ' + (
                  activeMigrationFilter === 'ALL'
                    ? 'bg-[#1e5c4f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                )}
              >
                All Sources
              </button>
              <button
                type="button"
                onClick={() => onMigrationFilterChange('GENUINE')}
                className={'px-2.5 py-1 rounded-lg text-xs font-bold transition ' + (
                  activeMigrationFilter === 'GENUINE'
                    ? 'bg-[#1e5c4f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                )}
              >
                Genuine Only
              </button>
              <button
                type="button"
                onClick={() => onMigrationFilterChange('MIGRATION')}
                className={'px-2.5 py-1 rounded-lg text-xs font-bold transition ' + (
                  activeMigrationFilter === 'MIGRATION'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-purple-700 hover:text-purple-900 hover:bg-purple-50'
                )}
              >
                📦 Generated Migration
              </button>
            </div>
          )}
        </div>

        <div className="relative min-w-[240px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search order #, customer, phone..."
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1e5c4f] shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchQueryChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-900 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
