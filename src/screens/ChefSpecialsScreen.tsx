import { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { 
  Loader2, Calendar, MapPin, AlertCircle, ChefHat, Layers, 
  CheckCircle, Plus, Trash2, Sparkles, Sliders, TrendingUp,
  Search, Minus, Percent
} from 'lucide-react';

interface ChefSpecialsScreenProps {
  permissions: any;
  user: any;
}

interface ChefSpecial {
  id?: string;
  branch: string;
  date: string;
  type: 'upsell' | 'limited';
  recipe_id: string;
  recipe_name: string;
  initial_qty: number | null;
  remaining_qty: number | null;
  created_at?: string;
  updated_at?: string;
}

export default function ChefSpecialsScreen({ permissions, user }: ChefSpecialsScreenProps) {
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getPastDateString = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Permissions gate check
  const canView = permissions?.can_view_upsell || user?.role === 'Admin' || user?.role === 'Manager';
  const canManage = permissions?.can_manage_upsell || user?.role === 'Admin' || user?.role === 'Manager';

  // Tabs: 'today' | 'analytics'
  const [activeTab, setActiveTab] = useState<'today' | 'analytics'>('today');

  // Branch and Date selection for "Today"
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [branches, setBranches] = useState<any[]>([]);

  // List of active specials today
  const [specials, setSpecials] = useState<ChefSpecial[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);

  // Add Special Form state
  const [searchRecipeQuery, setSearchRecipeQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [specialType, setSpecialType] = useState<'upsell' | 'limited'>('upsell');
  const [initialQty, setInitialQty] = useState<string>('20');
  const [formBranch, setFormBranch] = useState<string>('');

  // Analytics tab state
  const [startDate, setStartDate] = useState(getPastDateString(7));
  const [endDate, setEndDate] = useState(getTodayString());
  const [analyticsBranch, setAnalyticsBranch] = useState('All');
  const [historyLogs, setHistoryLogs] = useState<ChefSpecial[]>([]);

  // Global status
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch initial configuration (branches, recipes)
  useEffect(() => {
    if (!canView) return;

    const initData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [branchesRes, recipesRes] = await Promise.all([
          api.getBranchesList(),
          api.getMenuRecipes()
        ]);

        if (branchesRes.success && branchesRes.data) {
          setBranches(branchesRes.data);
          const firstBranch = branchesRes.data[0]?.name || '';
          setSelectedBranch(firstBranch);
          setFormBranch(firstBranch);
        }

        if (recipesRes.success && recipesRes.data) {
          setRecipes(recipesRes.data.filter((r: any) => r.is_active));
        }
      } catch (err: any) {
        setError(err.message || 'Error loading page configuration');
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [canView]);

  // Load today's specials when selectedBranch changes
  const loadTodaySpecials = async () => {
    if (!canView || selectedBranch === 'All' && branches.length === 0) return;
    setLoading(true);
    try {
      // If 'All' is selected, fetch for all branches or default to first branch
      const branchParam = selectedBranch === 'All' ? (branches[0]?.name || '') : selectedBranch;
      const res = await api.getTodaySpecials(branchParam);
      if (res.success) {
        setSpecials(res.data || []);
      } else {
        setError(res.error || 'Failed to fetch specials');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading specials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'today') {
      loadTodaySpecials();
    }
  }, [selectedBranch, activeTab, branches]);

  // Load analytics when activeTab becomes 'analytics' or inputs change
  const loadHistoryLogs = async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const res = await api.getSpecialsHistory(startDate, endDate, analyticsBranch);
      if (res.success) {
        setHistoryLogs(res.data || []);
      } else {
        setError(res.error || 'Failed to fetch historical specials');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading historical logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'analytics') {
      loadHistoryLogs();
    }
  }, [startDate, endDate, analyticsBranch, activeTab]);

  // Filtered recipe list for search auto-suggest
  const filteredRecipes = useMemo(() => {
    if (!searchRecipeQuery) return [];
    return recipes.filter(r => 
      r.item_name.toLowerCase().includes(searchRecipeQuery.toLowerCase())
    ).slice(0, 8);
  }, [searchRecipeQuery, recipes]);

  // Handlers
  const handleAddSpecial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    if (!selectedRecipe) {
      alert('Please select a menu recipe first.');
      return;
    }
    if (!formBranch) {
      alert('Please select a branch.');
      return;
    }

    setActionLoading(true);
    try {
      const isLimited = specialType === 'limited';
      const qty = isLimited ? parseInt(initialQty, 10) : null;

      const newSpecial: ChefSpecial = {
        branch: formBranch,
        date: getTodayString(),
        type: specialType,
        recipe_id: selectedRecipe.id,
        recipe_name: selectedRecipe.item_name,
        initial_qty: qty,
        remaining_qty: qty
      };

      const res = await api.saveSpecial(newSpecial);
      if (res.success) {
        // Reset form
        setSelectedRecipe(null);
        setSearchRecipeQuery('');
        // Reload list
        if (selectedBranch === formBranch || selectedBranch === 'All') {
          await loadTodaySpecials();
        }
      } else {
        alert('Failed to save special. Note: The same item cannot be added twice as the same special type on the same date.');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving special');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSpecial = async (id: string) => {
    if (!canManage) return;
    if (!window.confirm('Are you sure you want to remove this item from today\'s specials?')) return;

    setActionLoading(true);
    try {
      const res = await api.deleteSpecial(id);
      if (res.success) {
        setSpecials(prev => prev.filter(s => s.id !== id));
      } else {
        alert(res.error || 'Failed to delete special');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting special');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateQuantity = async (special: ChefSpecial, change: number) => {
    if (!canManage || !special.id || special.type !== 'limited') return;

    const currentRem = special.remaining_qty ?? 0;
    const newRem = Math.max(0, currentRem + change);

    // Optimistically update
    setSpecials(prev => prev.map(s => s.id === special.id ? { ...s, remaining_qty: newRem } : s));

    try {
      const updatedSpecial = {
        ...special,
        remaining_qty: newRem,
        updated_at: new Date().toISOString()
      };
      const res = await api.saveSpecial(updatedSpecial);
      if (!res.success) {
        alert(res.error || 'Failed to update quantity');
        loadTodaySpecials(); // Revert
      }
    } catch (err: any) {
      alert(err.message || 'Error updating quantity');
      loadTodaySpecials(); // Revert
    }
  };

  // Analytics stats computations
  const stats = useMemo(() => {
    const totalUpsell = historyLogs.filter(h => h.type === 'upsell').length;
    const totalLimited = historyLogs.filter(h => h.type === 'limited').length;

    // Most popular recipe counts
    const recipeCounts: Record<string, { count: number; type: string }> = {};
    historyLogs.forEach(h => {
      if (!recipeCounts[h.recipe_name]) {
        recipeCounts[h.recipe_name] = { count: 0, type: h.type };
      }
      recipeCounts[h.recipe_name].count += 1;
    });

    let topUpsell = 'N/A';
    let topUpsellCount = 0;
    let topLimited = 'N/A';
    let topLimitedCount = 0;

    Object.entries(recipeCounts).forEach(([name, val]) => {
      if (val.type === 'upsell' && val.count > topUpsellCount) {
        topUpsell = name;
        topUpsellCount = val.count;
      } else if (val.type === 'limited' && val.count > topLimitedCount) {
        topLimited = name;
        topLimitedCount = val.count;
      }
    });

    return {
      totalUpsell,
      totalLimited,
      topUpsell: topUpsellCount > 0 ? `${topUpsell} (${topUpsellCount}x)` : 'None',
      topLimited: topLimitedCount > 0 ? `${topLimited} (${topLimitedCount}x)` : 'None'
    };
  }, [historyLogs]);

  // Gates out unauthorized users
  if (!canView) {
    return (
      <div style={unauthorizedContainer}>
        <AlertCircle size={48} color="#dc3545" />
        <h2 style={{ margin: '16px 0 8px 0', color: '#1e293b' }}>Access Denied</h2>
        <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '400px' }}>
          You do not have the required permissions to view or manage Chef's Specials & Upselling. Contact your administrator if you believe this is in error.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '24px' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={28} style={{ color: 'var(--primary)' }} /> Chef's Specials & Upsell
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Promote menu items or manage limited-quantity daily specials. Items disappear automatically tomorrow.
          </p>
        </div>
        
        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: '#f3f4f6', padding: '4px', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
          <button 
            onClick={() => setActiveTab('today')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              background: activeTab === 'today' ? 'white' : 'transparent',
              color: activeTab === 'today' ? '#111827' : '#6b7280',
              boxShadow: activeTab === 'today' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Today's Board
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              background: activeTab === 'analytics' ? 'white' : 'transparent',
              color: activeTab === 'analytics' ? '#111827' : '#6b7280',
              boxShadow: activeTab === 'analytics' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <TrendingUp size={16} /> History & Statistics
          </button>
        </div>
      </div>

      {error && (
        <div style={errorStyle}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* TODAY'S BOARD TAB */}
      {activeTab === 'today' && (
        <div style={todayBoardGrid}>
          
          {/* ADD / MANAGE FORM PANEL */}
          <div style={panelCard}>
            <div style={panelHeaderStyle}>
              <ChefHat size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                Configure New Special
              </h3>
            </div>
            
            <form onSubmit={handleAddSpecial} style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '20px' }}>
              <fieldset disabled={!canManage} style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '18px' }}>
                
                {/* Branch location select */}
                <div style={formGroup}>
                  <label style={formLabelStyle}>Select Branch</label>
                  <select 
                    value={formBranch} 
                    onChange={(e) => setFormBranch(e.target.value)}
                    style={formInputStyle}
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Recipe search auto-suggest */}
                <div style={{ ...formGroup, position: 'relative' }}>
                  <label style={formLabelStyle}>Search Menu Item</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={searchIconStyle} />
                    <input
                      type="text"
                      placeholder="Type recipe or item name..."
                      value={searchRecipeQuery}
                      onChange={(e) => {
                        setSearchRecipeQuery(e.target.value);
                        if (selectedRecipe && e.target.value !== selectedRecipe.item_name) {
                          setSelectedRecipe(null);
                        }
                      }}
                      style={searchFieldStyle}
                    />
                  </div>

                  {/* Suggestion list */}
                  {filteredRecipes.length > 0 && !selectedRecipe && (
                    <div style={suggestionBoxStyle}>
                      {filteredRecipes.map((r) => (
                        <div 
                          key={r.id} 
                          onClick={() => {
                            setSelectedRecipe(r);
                            setSearchRecipeQuery(r.item_name);
                          }}
                          style={suggestionItemStyle}
                        >
                          <span style={{ fontWeight: 600, color: '#334155' }}>{r.item_name}</span>
                          <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                            {r.menu_sections?.name || 'Section'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedRecipe && (
                    <div style={selectedBadgeStyle}>
                      <CheckCircle size={14} color="#10b981" />
                      <span>Selected: <strong>{selectedRecipe.item_name}</strong></span>
                    </div>
                  )}
                </div>

                {/* Special Type Selector */}
                <div style={formGroup}>
                  <label style={formLabelStyle}>Special Type</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={typeCardLabel(specialType === 'upsell', '#e83e8c')}>
                      <input 
                        type="radio" 
                        name="special_type" 
                        checked={specialType === 'upsell'}
                        onChange={() => setSpecialType('upsell')}
                        style={{ display: 'none' }}
                      />
                      <Sparkles size={16} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>Upsell Item</span>
                        <span style={{ fontSize: '11px', opacity: 0.8 }}>Featured on chef's board today</span>
                      </div>
                    </label>

                    <label style={typeCardLabel(specialType === 'limited', '#fd7e14')}>
                      <input 
                        type="radio" 
                        name="special_type" 
                        checked={specialType === 'limited'}
                        onChange={() => setSpecialType('limited')}
                        style={{ display: 'none' }}
                      />
                      <Layers size={16} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>Limited QTY</span>
                        <span style={{ fontSize: '11px', opacity: 0.8 }}>Track stock count live</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Quantity Input (only if limited) */}
                {specialType === 'limited' && (
                  <div style={formGroup}>
                    <label style={formLabelStyle}>Initial Quantity Available</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={initialQty} 
                      onChange={(e) => setInitialQty(e.target.value)}
                      style={formInputStyle}
                    />
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={actionLoading || !selectedRecipe} 
                  style={submitButtonStyle(!selectedRecipe || actionLoading)}
                >
                  {actionLoading ? <Loader2 size={18} className="spin" /> : <Plus size={18} />}
                  Add to Specials Board
                </button>
              </fieldset>
              
              {!canManage && (
                <div style={readOnlyWarningStyle}>
                  <AlertCircle size={14} style={{ marginRight: '6px' }} />
                  You have view-only permissions.
                </div>
              )}
            </form>
          </div>

          {/* ACTIVE SPECIALS LIST PANEL */}
          <div style={{ ...panelCard, flex: 2 }}>
            <div style={{ ...panelHeaderStyle, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                  Today's Active Specials
                </h3>
              </div>

              {/* Branch filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={16} color="#64748b" />
                <select 
                  value={selectedBranch} 
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  style={compactSelectStyle}
                >
                  <option value="All">All Branches</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Loader2 size={32} className="spin" style={{ color: 'var(--primary)', margin: '0 auto' }} />
                  <p style={{ marginTop: '8px', color: '#64748b' }}>Loading specials...</p>
                </div>
              ) : specials.length === 0 ? (
                <div style={emptyBoardStyle}>
                  <ChefHat size={40} color="#cbd5e1" />
                  <h4 style={{ margin: '12px 0 4px 0', color: '#475569' }}>No Specials Active</h4>
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                    Chefs haven't registered any specials at this location today.
                  </p>
                </div>
              ) : (
                <div style={specialsGrid}>
                  {specials.map(s => {
                    const isLimited = s.type === 'limited';
                    const initial = s.initial_qty ?? 0;
                    const remaining = s.remaining_qty ?? 0;
                    const percentRemaining = initial > 0 ? (remaining / initial) * 100 : 0;

                    return (
                      <div key={s.id} style={specialCardStyle(s.type)}>
                        <div style={specialCardHeaderStyle}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={typeBadgeStyle(s.type)}>
                                {isLimited ? <Layers size={11} /> : <Sparkles size={11} />}
                                {s.type.toUpperCase()}
                              </span>
                              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>{s.branch}</span>
                            </div>
                            <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: '4px 0 0 0' }}>
                              {s.recipe_name}
                            </h4>
                          </div>
                          
                          {canManage && (
                            <button 
                              onClick={() => s.id && handleDeleteSpecial(s.id)}
                              style={deleteCardButtonStyle}
                              title="Delete Special"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>

                        {/* Count controller (for limited specials) */}
                        {isLimited && (
                          <div style={qtyPanelStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Remaining Stock</span>
                              <span style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>
                                {remaining} / {initial}
                              </span>
                            </div>

                            {/* Live progress indicator bar */}
                            <div style={progressBarContainerStyle}>
                              <div style={progressBarFillStyle(percentRemaining, percentRemaining < 20 ? '#ef4444' : '#fd7e14')} />
                            </div>

                            {/* Incrementor/Decrementor */}
                            {canManage && (
                              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                <button 
                                  onClick={() => handleUpdateQuantity(s, -1)}
                                  disabled={remaining <= 0}
                                  style={adjustQtyButtonStyle(remaining <= 0)}
                                >
                                  <Minus size={14} /> Sell 1
                                </button>
                                <button 
                                  onClick={() => handleUpdateQuantity(s, 1)}
                                  style={adjustQtyButtonStyle(false)}
                                >
                                  <Plus size={14} /> Restock 1
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {!isLimited && (
                          <div style={upsellPanelStyle}>
                            <p style={{ margin: 0, fontSize: '13px', color: '#6f7885', lineHeight: '1.4' }}>
                              Active as upselling prompt on POS & Server screens for today.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* HISTORY & ANALYTICS TAB */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Analytics Filters */}
          <div style={filterPanelStyle}>
            <div style={filterGroupStyle}>
              <label style={labelStyle}>
                <Calendar size={16} style={{ marginRight: '6px' }} /> Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={filterGroupStyle}>
              <label style={labelStyle}>
                <Calendar size={16} style={{ marginRight: '6px' }} /> End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={filterGroupStyle}>
              <label style={labelStyle}>
                <MapPin size={16} style={{ marginRight: '6px' }} /> Filter Branch
              </label>
              <select
                value={analyticsBranch}
                onChange={(e) => setAnalyticsBranch(e.target.value)}
                style={selectStyle}
              >
                <option value="All">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stats KPI Dashboard */}
          <div style={kpiGridStyle}>
            <div style={kpiCardStyle('#e83e8c')}>
              <Sparkles size={24} color="#e83e8c" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={kpiLabelStyle}>Total Upsell Items</span>
                <span style={kpiValueStyle}>{stats.totalUpsell}</span>
              </div>
            </div>

            <div style={kpiCardStyle('#fd7e14')}>
              <Layers size={24} color="#fd7e14" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={kpiLabelStyle}>Total Limited Specials</span>
                <span style={kpiValueStyle}>{stats.totalLimited}</span>
              </div>
            </div>

            <div style={kpiCardStyle('#2e7d32')}>
              <TrendingUp size={24} color="#2e7d32" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={kpiLabelStyle}>Top Upselled Recipe</span>
                <span style={kpiValueStyle}>{stats.topUpsell}</span>
              </div>
            </div>

            <div style={kpiCardStyle('#1565c0')}>
              <Percent size={24} color="#1565c0" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={kpiLabelStyle}>Top Limited Recipe</span>
                <span style={kpiValueStyle}>{stats.topLimited}</span>
              </div>
            </div>
          </div>

          {/* Detailed Logs Table */}
          <div style={panelCard}>
            <div style={panelHeaderStyle}>
              <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                Specials History Ledger
              </h3>
            </div>

            <div style={{ overflowX: 'auto' }}>
              {historyLogs.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  No historical records found for the selected filter range.
                </div>
              ) : (
                <table style={tableStyle}>
                  <thead>
                    <tr style={tableHeaderRowStyle}>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>Branch</th>
                      <th style={thStyle}>Recipe Item</th>
                      <th style={thStyle}>Special Type</th>
                      <th style={thStyle}>Initial Qty</th>
                      <th style={thStyle}>Remaining Qty</th>
                      <th style={thStyle}>Depletion Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyLogs.map((log) => {
                      const isLimited = log.type === 'limited';
                      const init = log.initial_qty ?? 0;
                      const rem = log.remaining_qty ?? 0;
                      const depleted = init - rem;
                      const depletionRate = isLimited && init > 0 ? Math.round((depleted / init) * 100) : null;

                      return (
                        <tr key={log.id} style={tableRowStyle}>
                          <td style={tdStyle}>{log.date}</td>
                          <td style={tdStyle}>{log.branch}</td>
                          <td style={{ ...tdStyle, fontWeight: 700, color: '#1e293b' }}>{log.recipe_name}</td>
                          <td style={tdStyle}>
                            <span style={typeBadgeStyle(log.type)}>
                              {isLimited ? 'LIMITED' : 'UPSELL'}
                            </span>
                          </td>
                          <td style={tdStyle}>{isLimited ? init : '-'}</td>
                          <td style={tdStyle}>{isLimited ? rem : '-'}</td>
                          <td style={{ ...tdStyle, fontWeight: 600, color: depletionRate !== null && depletionRate > 80 ? '#b91c1c' : '#475569' }}>
                            {depletionRate !== null ? `${depletionRate}%` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Styling definitions
const unauthorizedContainer = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  height: '60vh',
  textAlign: 'center' as const,
  padding: '24px',
  backgroundColor: '#fff',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow)'
};



const errorStyle = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fee2e2',
  color: '#b91c1c',
  padding: '12px 16px',
  borderRadius: 'var(--radius)',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '14px',
};

const todayBoardGrid = {
  display: 'flex',
  gap: '24px',
  alignItems: 'flex-start',
  flexWrap: 'wrap' as const
};

const panelCard = {
  backgroundColor: '#ffffff',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow)',
  overflow: 'hidden',
  flex: 1,
  minWidth: '320px'
};

const panelHeaderStyle = {
  padding: '16px 20px',
  borderBottom: '1px solid var(--border)',
  backgroundColor: '#fafafb',
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
};

const formGroup = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '6px',
};

const formLabelStyle = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#475569',
};

const formInputStyle = {
  padding: '10px 12px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  fontSize: '14px',
  outline: 'none',
  color: '#334155',
  backgroundColor: 'white'
};

const searchFieldStyle = {
  padding: '10px 12px 10px 36px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  fontSize: '14px',
  outline: 'none',
  color: '#334155',
  width: '100%',
  boxSizing: 'border-box' as const
};

const searchIconStyle = {
  position: 'absolute' as const,
  left: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: '#94a3b8'
};

const suggestionBoxStyle = {
  position: 'absolute' as const,
  top: '100%',
  left: 0,
  right: 0,
  backgroundColor: 'white',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
  zIndex: 10,
  maxHeight: '200px',
  overflowY: 'auto' as const
};

const suggestionItemStyle = {
  padding: '10px 12px',
  cursor: 'pointer',
  borderBottom: '1px solid #f1f5f9',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '13.5px'
};

const selectedBadgeStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  backgroundColor: '#f0fdf4',
  color: '#166534',
  padding: '6px 12px',
  borderRadius: '6px',
  fontSize: '13px',
  marginTop: '8px'
};

const typeCardLabel = (active: boolean, activeColor: string) => ({
  flex: 1,
  padding: '12px',
  borderRadius: '8px',
  border: `2px solid ${active ? activeColor : 'var(--border)'}`,
  backgroundColor: active ? `${activeColor}08` : 'white',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  cursor: 'pointer',
  color: active ? activeColor : '#64748b',
  transition: 'all 0.2s ease',
  userSelect: 'none' as const
});

const submitButtonStyle = (disabled: boolean) => ({
  marginTop: '10px',
  padding: '12px',
  borderRadius: '6px',
  backgroundColor: disabled ? '#94a3b8' : 'var(--primary)',
  color: 'white',
  border: 'none',
  fontWeight: 700,
  fontSize: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  cursor: disabled ? 'default' : 'pointer',
  boxShadow: disabled ? 'none' : '0 4px 6px -1px rgba(0,0,0,0.08)'
});

const readOnlyWarningStyle = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  color: '#64748b',
  padding: '8px 12px',
  fontSize: '12.5px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const compactSelectStyle = {
  padding: '6px 12px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  fontSize: '13px',
  outline: 'none',
  color: '#475569',
  backgroundColor: 'white',
  cursor: 'pointer'
};

const emptyBoardStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  padding: '60px 20px',
  textAlign: 'center' as const
};

const specialsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '16px'
};

const specialCardStyle = (type: 'upsell' | 'limited') => ({
  border: `1px solid ${type === 'upsell' ? '#fbcfe8' : '#fed7aa'}`,
  borderRadius: '8px',
  backgroundColor: type === 'upsell' ? '#fdf2f8' : '#fffbeb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
  display: 'flex',
  flexDirection: 'column' as const,
  overflow: 'hidden'
});

const specialCardHeaderStyle = {
  padding: '14px 16px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  borderBottom: '1px solid rgba(0,0,0,0.03)'
};

const typeBadgeStyle = (type: string) => {
  const isLimited = type === 'limited';
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '9.5px',
    fontWeight: 800,
    backgroundColor: isLimited ? '#ffedd5' : '#fce7f3',
    color: isLimited ? '#ea580c' : '#db2777'
  };
};

const deleteCardButtonStyle = {
  border: 'none',
  background: 'transparent',
  color: '#ef4444',
  cursor: 'pointer',
  padding: '4px',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.2s',
  hover: {
    backgroundColor: '#fee2e2'
  }
};

const qtyPanelStyle = {
  padding: '16px',
  backgroundColor: 'white',
  borderTop: '1px solid rgba(0,0,0,0.02)',
  display: 'flex',
  flexDirection: 'column' as const
};

const upsellPanelStyle = {
  padding: '16px',
  backgroundColor: 'white',
  borderTop: '1px solid rgba(0,0,0,0.02)'
};

const progressBarContainerStyle = {
  height: '6px',
  backgroundColor: '#f1f5f9',
  borderRadius: '3px',
  overflow: 'hidden',
};

const progressBarFillStyle = (percent: number, color: string) => ({
  width: `${percent}%`,
  height: '100%',
  backgroundColor: color,
  borderRadius: '3px',
  transition: 'width 0.3s ease'
});

const adjustQtyButtonStyle = (disabled: boolean) => ({
  flex: 1,
  padding: '8px',
  borderRadius: '6px',
  backgroundColor: disabled ? '#f1f5f9' : 'white',
  border: `1px solid ${disabled ? '#e2e8f0' : '#cbd5e1'}`,
  color: disabled ? '#cbd5e1' : '#334155',
  fontSize: '12.5px',
  fontWeight: 700,
  cursor: disabled ? 'default' : 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px'
});

// Analytics Filter Styles
const filterPanelStyle = {
  backgroundColor: '#ffffff',
  padding: '16px 24px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow)',
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: '24px',
  alignItems: 'center',
};

const filterGroupStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '6px',
};

const labelStyle = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#64748b',
  display: 'flex',
  alignItems: 'center',
};

const inputStyle = {
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  fontSize: '14px',
  outline: 'none',
  width: '180px',
  color: '#334155',
  backgroundColor: 'white'
};

const selectStyle = {
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  fontSize: '14px',
  outline: 'none',
  width: '200px',
  color: '#334155',
  backgroundColor: 'white',
  cursor: 'pointer',
};

// KPI Dashboard Styles
const kpiGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '20px'
};

const kpiCardStyle = (color: string) => ({
  backgroundColor: 'white',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '18px 20px',
  boxShadow: 'var(--shadow)',
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  borderLeft: `4px solid ${color}`
});

const kpiLabelStyle = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px'
};

const kpiValueStyle = {
  fontSize: '20px',
  fontWeight: 800,
  color: '#0f172a',
  marginTop: '4px'
};

// Table Styles
const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  textAlign: 'left' as const,
  fontSize: '14px'
};

const tableHeaderRowStyle = {
  backgroundColor: '#f8fafc',
  borderBottom: '2px solid #e2e8f0'
};

const thStyle = {
  padding: '14px 20px',
  color: '#475569',
  fontWeight: 700,
  fontSize: '13px'
};

const tableRowStyle = {
  borderBottom: '1px solid #f1f5f9',
  hover: {
    backgroundColor: '#f8fafc'
  }
};

const tdStyle = {
  padding: '14px 20px',
  color: '#475569',
  verticalAlign: 'middle'
};
