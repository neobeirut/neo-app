import React from 'react';
import type { StatusGroup, ChannelType } from './orderAdapter';

interface OrderFiltersProps {
  activeStatusTab: StatusGroup | 'ALL';
  onStatusTabChange: (tab: StatusGroup | 'ALL') => void;
  activeChannelFilter: 'All' | ChannelType;
  onChannelFilterChange: (channel: 'All' | ChannelType) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  counts: Record<StatusGroup | 'ALL', number>;
}

export const OrderFilters: React.FC<OrderFiltersProps> = ({
  activeStatusTab,
  onStatusTabChange,
  activeChannelFilter,
  onChannelFilterChange,
  searchQuery,
  onSearchQueryChange,
  counts
}) => {
  const primaryTabs: { id: StatusGroup; label: string; icon: string }[] = [
    { id: 'NEW', label: 'New', icon: '⚡' },
    { id: 'CONFIRMED', label: 'Confirmed', icon: '👍' },
    { id: 'PREPARING', label: 'Preparing', icon: '🍳' },
    { id: 'READY', label: 'Ready', icon: '📦' },
    { id: 'COMPLETED', label: 'Completed', icon: '✓' }
  ];

  const secondaryTabs: { id: StatusGroup | 'ALL'; label: string; icon: string }[] = [
    { id: 'HELD', label: 'Held', icon: '⏸️' },
    { id: 'CANCELLED', label: 'Cancelled', icon: '✕' },
    { id: 'ALL', label: 'All Orders', icon: '📋' }
  ];

  const channels: ('All' | ChannelType)[] = ['All', 'POS', 'WhatsApp', 'App', 'Toters', 'NokNok'];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262D3D] pb-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-[#141820] p-1.5 rounded-2xl border border-[#262D3D]">
          {primaryTabs.map(tab => {
            const isActive = activeStatusTab === tab.id;
            const count = counts[tab.id] || 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onStatusTabChange(tab.id)}
                className={'px-3.5 py-2 rounded-xl text-xs font-black tracking-wider transition-all flex items-center gap-2 ' + (
                  isActive
                    ? 'bg-[#eb660c] text-white shadow-lg shadow-[#eb660c]/25 border border-[#eb660c]'
                    : 'text-gray-400 hover:text-white hover:bg-[#1f2533]'
                )}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className={'px-1.5 py-0.5 rounded-md text-[11px] font-black ' + (
                  isActive ? 'bg-black/30 text-white' : 'bg-[#262D3D] text-gray-300'
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 bg-[#141820] p-1.5 rounded-2xl border border-[#262D3D]">
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
                    : 'text-gray-400 hover:text-white hover:bg-[#1f2533]'
                )}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className="text-[10px] text-gray-400">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mr-1">Channel:</span>
          {channels.map(ch => {
            const isActive = activeChannelFilter === ch;
            return (
              <button
                key={ch}
                type="button"
                onClick={() => onChannelFilterChange(ch)}
                className={'px-3 py-1 rounded-lg text-xs font-bold transition ' + (
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-[#181C24] text-gray-400 hover:text-white hover:bg-[#222838] border border-[#262D3D]'
                )}
              >
                {ch}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search order #, customer, phone..."
            className="w-full bg-[#181C24] border border-[#262D3D] rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#eb660c]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchQueryChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
};