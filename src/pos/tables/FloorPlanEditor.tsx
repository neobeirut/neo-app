import React, { useState, useRef } from 'react';
import type { FloorArea, PosTable, TableShape } from './types';
import { upsertTable, deleteTable, saveFloorLayout, createFloorArea } from './tableService';
import { 
  Plus, 
  Save, 
  Trash2, 
  Move, 
  Check, 
  X, 
  Sliders, 
  Layers,
  Sparkles,
  RotateCcw
} from 'lucide-react';

interface FloorPlanEditorProps {
  branchId: string;
  restaurantId: string;
  areas: FloorArea[];
  tables: PosTable[];
  activeAreaId: string | null;
  onSelectArea: (areaId: string) => void;
  onRefresh: () => Promise<void>;
  onClose: () => void;
}

export const FloorPlanEditor: React.FC<FloorPlanEditorProps> = ({
  branchId,
  restaurantId,
  areas,
  tables,
  activeAreaId,
  onSelectArea,
  onRefresh,
  onClose
}) => {
  const [localTables, setLocalTables] = useState<PosTable[]>(tables);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showAddAreaModal, setShowAddAreaModal] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  
  const canvasRef = useRef<HTMLDivElement>(null);

  const activeTables = localTables.filter(t => 
    activeAreaId ? t.floor_area_id === activeAreaId : true
  );

  const selectedTable = localTables.find(t => t.id === selectedTableId) || null;

  // Handle Drag Start
  const handleMouseDown = (e: React.MouseEvent, table: PosTable) => {
    e.stopPropagation();
    setSelectedTableId(table.id);
    setIsDragging(true);

    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const currentPixelX = (table.position_x / 100) * rect.width;
      const currentPixelY = (table.position_y / 100) * rect.height;
      setDragOffset({
        x: e.clientX - (rect.left + currentPixelX),
        y: e.clientY - (rect.top + currentPixelY)
      });
    }
  };

  // Handle Drag Move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedTableId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    let newX = ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100;
    let newY = ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100;

    // Clamp between 1% and 92%
    newX = Math.max(1, Math.min(92, Math.round(newX * 2) / 2));
    newY = Math.max(1, Math.min(92, Math.round(newY * 2) / 2));

    setLocalTables(prev => prev.map(t => 
      t.id === selectedTableId ? { ...t, position_x: newX, position_y: newY } : t
    ));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Update selected table property
  const updateSelectedProperty = (field: keyof PosTable, value: any) => {
    if (!selectedTableId) return;
    setLocalTables(prev => prev.map(t => 
      t.id === selectedTableId ? { ...t, [field]: value } : t
    ));
  };

  // Add new table
  const handleAddNewTable = async () => {
    if (!activeAreaId) {
      alert('Please select or create a floor area first.');
      return;
    }

    const nextNumber = localTables.length + 1;
    const newCode = `T${nextNumber}`;

    const res = await upsertTable({
      branch_id: branchId,
      floor_area_id: activeAreaId,
      table_code: newCode,
      display_name: `Table ${nextNumber}`,
      capacity: 4,
      shape: 'square',
      position_x: 35,
      position_y: 35,
      width: 7,
      height: 7
    });

    if (res.success && res.data) {
      setLocalTables(prev => [...prev, {
        ...res.data,
        status: 'available',
        current_session_id: null,
        commerce_order_id: null,
        current_bill: 0,
        amount_paid: 0,
        amount_remaining: 0
      }]);
      setSelectedTableId(res.data.id);
    } else {
      alert(res.error || 'Failed to add table');
    }
  };

  // Delete selected table
  const handleDeleteTable = async () => {
    if (!selectedTable) return;
    if (selectedTable.status && selectedTable.status !== 'available') {
      alert('Cannot delete an occupied table.');
      return;
    }
    if (!confirm(`Delete table "${selectedTable.table_code}"?`)) return;

    const res = await deleteTable(selectedTable.id);
    if (res.success) {
      setLocalTables(prev => prev.filter(t => t.id !== selectedTable.id));
      setSelectedTableId(null);
    } else {
      alert(res.error || 'Failed to delete table');
    }
  };

  // Save all layout coordinates
  const handleSaveLayout = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    const res = await saveFloorLayout(localTables);
    if (res.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      await onRefresh();
    } else {
      alert(res.error || 'Failed to save floor layout');
    }
    setIsSaving(false);
  };

  // Add new floor area
  const handleCreateArea = async () => {
    if (!newAreaName.trim()) return;
    const res = await createFloorArea(branchId, restaurantId, newAreaName.trim());
    if (res.success && res.area) {
      setNewAreaName('');
      setShowAddAreaModal(false);
      await onRefresh();
      onSelectArea(res.area.id);
    } else {
      alert(res.error || 'Failed to create area');
    }
  };

  return (
    <div 
      className="absolute inset-0 z-40 bg-[#0B0D12] text-white flex flex-col select-none overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Editor Header Toolbar */}
      <div className="h-16 px-6 bg-[#121620] border-b border-[#22293A] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-black text-amber-400 uppercase tracking-wider">
            <Sliders className="w-5 h-5 text-amber-400" />
            <span>Floor Plan Designer</span>
          </div>

          {/* Area Selector Tabs */}
          <div className="flex items-center gap-1.5 ml-6 bg-[#181E2C] p-1 rounded-xl border border-[#2B354B]">
            {areas.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => onSelectArea(a.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeAreaId === a.id
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {a.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowAddAreaModal(true)}
              className="px-2 py-1.5 rounded-lg text-xs font-bold text-amber-400 hover:bg-[#222A3C] transition flex items-center gap-1"
              title="Add Floor Area"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Area</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleAddNewTable}
            className="px-3.5 py-2 rounded-xl bg-[#222A3C] hover:bg-[#2C364D] text-slate-200 text-xs font-bold flex items-center gap-2 border border-[#35425F] transition"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Add Table</span>
          </button>

          <button
            type="button"
            onClick={handleSaveLayout}
            disabled={isSaving}
            className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 transition shadow-lg ${
              saveSuccess
                ? 'bg-emerald-500 text-white'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
            }`}
          >
            {saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Layout'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            title="Exit Floor Designer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Workspace: 2D Interactive Canvas + Inspector Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Visual 2D Canvas Area */}
        <div 
          ref={canvasRef}
          onClick={() => setSelectedTableId(null)}
          className="flex-1 relative bg-[#0D1017] overflow-hidden cursor-crosshair"
          style={{
            backgroundImage: `radial-gradient(#1E2536 1.5px, transparent 1.5px)`,
            backgroundSize: '24px 24px'
          }}
        >
          {activeTables.map(table => {
            const isSelected = table.id === selectedTableId;
            const shapeClass = 
              table.shape === 'round' ? 'rounded-full aspect-square' :
              table.shape === 'rectangle' ? 'rounded-xl aspect-[16/10]' :
              'rounded-xl aspect-square';

            const renderedWidth = table.width
              ? (table.width > 12 ? Math.round(table.width * 0.5 * 10) / 10 : table.width)
              : 7;

            return (
              <div
                key={table.id}
                onMouseDown={(e) => handleMouseDown(e, table)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTableId(table.id);
                }}
                style={{
                  left: `${table.position_x}%`,
                  top: `${table.position_y}%`,
                  width: `${renderedWidth}%`
                }}
                className={`absolute select-none cursor-move transition-shadow flex flex-col items-center justify-center p-1 sm:p-1.5 border text-center ${shapeClass} ${
                  isSelected
                    ? 'bg-amber-500/20 border-amber-400 ring-4 ring-amber-500/30 z-30 shadow-2xl scale-105'
                    : 'bg-[#181E2C] border-[#2C374D] hover:border-slate-400 z-10 shadow-md'
                }`}
              >
                <div className="font-black text-xs text-white tracking-wider leading-none">
                  {table.table_code}
                </div>
                <div className="text-[9px] text-slate-400 font-semibold mt-0.5 leading-none">
                  {table.capacity}p
                </div>
                {table.display_name && table.display_name !== table.table_code && (
                  <div className="text-[8px] text-slate-500 truncate max-w-full px-0.5 leading-none mt-0.5">
                    {table.display_name}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Inspector Drawer */}
        {selectedTable ? (
          <div className="w-80 bg-[#121620] border-l border-[#22293A] p-5 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#22293A] pb-3">
                <div className="text-xs font-black uppercase text-amber-400 tracking-wider">
                  Table Properties
                </div>
                <button 
                  onClick={() => setSelectedTableId(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Table Code */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Table Code
                </label>
                <input
                  type="text"
                  value={selectedTable.table_code}
                  onChange={(e) => updateSelectedProperty('table_code', e.target.value.toUpperCase())}
                  className="w-full bg-[#1A202E] border border-[#2B354B] rounded-xl px-3 py-2 text-white font-black text-sm focus:border-amber-400 outline-none"
                />
              </div>

              {/* Display Name */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={selectedTable.display_name}
                  onChange={(e) => updateSelectedProperty('display_name', e.target.value)}
                  className="w-full bg-[#1A202E] border border-[#2B354B] rounded-xl px-3 py-2 text-white font-medium text-sm focus:border-amber-400 outline-none"
                />
              </div>

              {/* Shape Selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Shape
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['square', 'rectangle', 'round'] as TableShape[]).map(sh => (
                    <button
                      key={sh}
                      type="button"
                      onClick={() => updateSelectedProperty('shape', sh)}
                      className={`py-2 rounded-xl text-xs font-bold capitalize transition border ${
                        selectedTable.shape === sh
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                          : 'bg-[#1A202E] text-slate-300 border-[#2B354B] hover:border-slate-400'
                      }`}
                    >
                      {sh}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table Size (Width) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Table Size
                  </label>
                  <span className="text-xs font-black text-amber-400">
                    {Math.round((selectedTable.width > 12 ? selectedTable.width * 0.5 : (selectedTable.width || 7)) * 10) / 10}%
                  </span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="14"
                  step="0.5"
                  value={selectedTable.width > 12 ? selectedTable.width * 0.5 : (selectedTable.width || 7)}
                  onChange={(e) => updateSelectedProperty('width', parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                  <button
                    type="button"
                    onClick={() => updateSelectedProperty('width', 5)}
                    className="hover:text-amber-400 transition"
                  >
                    Compact (5%)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedProperty('width', 7)}
                    className="hover:text-amber-400 font-bold text-slate-200 transition"
                  >
                    Standard (7%)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedProperty('width', 10)}
                    className="hover:text-amber-400 transition"
                  >
                    Large (10%)
                  </button>
                </div>
              </div>

              {/* Capacity Selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Capacity (Seats)
                </label>
                <div className="grid grid-cols-5 gap-1 mb-2">
                  {[2, 4, 6, 8, 10].map(cap => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => updateSelectedProperty('capacity', cap)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition border ${
                        selectedTable.capacity === cap
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                          : 'bg-[#1A202E] text-slate-400 border-[#2B354B]'
                      }`}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={selectedTable.capacity}
                  onChange={(e) => updateSelectedProperty('capacity', Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full bg-[#1A202E] border border-[#2B354B] rounded-xl px-3 py-1.5 text-white font-bold text-sm focus:border-amber-400 outline-none"
                />
              </div>

              {/* Area Assignment */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Floor Area
                </label>
                <select
                  value={selectedTable.floor_area_id}
                  onChange={(e) => updateSelectedProperty('floor_area_id', e.target.value)}
                  className="w-full bg-[#1A202E] border border-[#2B354B] rounded-xl px-3 py-2 text-white font-medium text-xs focus:border-amber-400 outline-none"
                >
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* Fine Coordinates Adjustment */}
              <div className="pt-2 border-t border-[#22293A]">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-2">
                  Position Coordinates
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-0.5">X: {Math.round(selectedTable.position_x)}%</label>
                    <input
                      type="range"
                      min="1"
                      max="92"
                      value={selectedTable.position_x}
                      onChange={(e) => updateSelectedProperty('position_x', parseFloat(e.target.value))}
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-0.5">Y: {Math.round(selectedTable.position_y)}%</label>
                    <input
                      type="range"
                      min="1"
                      max="92"
                      value={selectedTable.position_y}
                      onChange={(e) => updateSelectedProperty('position_y', parseFloat(e.target.value))}
                      className="w-full accent-amber-400"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-[#22293A]">
              <button
                type="button"
                onClick={handleDeleteTable}
                className="w-full py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Table</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="w-80 bg-[#121620] border-l border-[#22293A] p-6 flex flex-col items-center justify-center text-center text-slate-500">
            <Move className="w-8 h-8 mb-2 text-slate-600 animate-pulse" />
            <span className="text-xs font-bold text-slate-400">Click or Drag Any Table</span>
            <span className="text-[11px] text-slate-500 mt-1">
              Select a table on the canvas to move it or edit its seats, shape, and code.
            </span>
          </div>
        )}
      </div>

      {/* Add Area Modal */}
      {showAddAreaModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#161B26] border border-[#2B354B] rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-white">Create New Floor Area</span>
              <button onClick={() => setShowAddAreaModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1 font-semibold">Area Name</label>
              <input
                type="text"
                placeholder="e.g. VIP Lounge, Rooftop"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                className="w-full bg-[#1F2636] border border-[#303B52] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddAreaModal(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateArea}
                disabled={!newAreaName.trim()}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs disabled:opacity-50"
              >
                Create Area
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
