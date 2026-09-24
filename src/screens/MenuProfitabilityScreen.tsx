import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, AlertTriangle, Package, RefreshCw, Filter, 
  Search, ChevronRight, CheckCircle2, XCircle, Sliders, DollarSign,
  Info, ArrowUpRight, ArrowDownRight, Layers, Eye
} from 'lucide-react';
import { menuProfitabilityApi } from '../api/menuProfitabilityApi';
import type { 
  MenuProductProfitability, 
  MarginScenarioResult, 
  RecipeCostAlert 
} from '../api/menuProfitabilityApi';
import { api } from '../api/client';

export default function MenuProfitabilityScreen({ user, permissions }: { user: any; permissions: any }) {
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'matrix' | 'products' | 'simulator' | 'packaging' | 'alerts'>('matrix');
  
  const [loading, setLoading] = useState<boolean>(true);
  const [rebuilding, setRebuilding] = useState<boolean>(false);
  const [products, setProducts] = useState<MenuProductProfitability[]>([]);
  const [alerts, setAlerts] = useState<RecipeCostAlert[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  
  // Drilldown drawer state
  const [selectedProduct, setSelectedProduct] = useState<MenuProductProfitability | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState<boolean>(false);
  const [drilldownData, setDrilldownData] = useState<any>(null);

  // Simulator state
  const [simProduct, setSimProduct] = useState<number | ''>('');
  const [simPrice, setSimPrice] = useState<number>(0);
  const [simChannel, setSimChannel] = useState<string>('DINE_IN');
  const [simResult, setSimResult] = useState<MarginScenarioResult | null>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);

  const restaurantId = user?.restaurant_id;

  useEffect(() => {
    async function loadBranches() {
      try {
        const bList = await api.getBranches();
        setBranches(bList || []);
        if (bList && bList.length > 0) {
          const defaultB = user?.branch_id || bList[0].id;
          setSelectedBranch(defaultB);
        }
      } catch (err) {
        console.error('Failed to load branches:', err);
      }
    }
    loadBranches();
  }, [user]);

  const loadData = async () => {
    if (!restaurantId || !selectedBranch) return;
    setLoading(true);
    try {
      const [snapData, alertData] = await Promise.all([
        menuProfitabilityApi.getDailySnapshots(restaurantId, selectedBranch, selectedDate),
        menuProfitabilityApi.getActiveAlerts(restaurantId, selectedBranch)
      ]);
      setProducts(snapData);
      setAlerts(alertData);
    } catch (err) {
      console.error('Failed to load profitability data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [restaurantId, selectedBranch, selectedDate]);

  const handleRebuild = async () => {
    if (!restaurantId || !selectedBranch) return;
    setRebuilding(true);
    try {
      await menuProfitabilityApi.rebuildDailySnapshots(restaurantId, selectedBranch, selectedDate);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to rebuild profitability snapshots');
    } finally {
      setRebuilding(false);
    }
  };

  const handleOpenDrilldown = async (prod: MenuProductProfitability) => {
    setSelectedProduct(prod);
    setDrilldownLoading(true);
    try {
      const details = await menuProfitabilityApi.getRecipeCostDetails(restaurantId, selectedBranch, prod.product_id);
      setDrilldownData(details);
    } catch (err) {
      console.error('Failed to load recipe cost drilldown:', err);
    } finally {
      setDrilldownLoading(false);
    }
  };

  const handleRunSimulation = async () => {
    if (!restaurantId || !selectedBranch || !simProduct || simPrice <= 0) return;
    setSimLoading(true);
    try {
      const res = await menuProfitabilityApi.simulateMarginScenario(
        restaurantId,
        selectedBranch,
        Number(simProduct),
        simPrice,
        [],
        simChannel
      );
      setSimResult(res);
    } catch (err: any) {
      alert(err.message || 'Simulation failed');
    } finally {
      setSimLoading(false);
    }
  };

  // Aggregated KPIs
  const totalNetRevenue = products.reduce((sum, p) => sum + (p.net_sales_revenue || 0), 0);
  const totalRealizedFoodCost = products.reduce((sum, p) => sum + (p.realized_total_food_cost || 0), 0);
  const totalTheoreticalFoodCost = products.reduce((sum, p) => sum + (p.theoretical_total_food_cost || 0), 0);
  const totalPackagingCost = products.reduce((sum, p) => sum + (p.total_packaging_cost || 0), 0);
  const totalContributionMargin = products.reduce((sum, p) => sum + (p.realized_contribution_margin || 0), 0);
  const totalCostVariance = products.reduce((sum, p) => sum + (p.total_cost_variance || 0), 0);

  const avgFoodCostPct = totalNetRevenue > 0 ? (totalRealizedFoodCost / totalNetRevenue) * 100 : null;
  const avgMarginPct = totalNetRevenue > 0 ? (totalContributionMargin / totalNetRevenue) * 100 : null;

  // Filtered products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.product_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChannel = channelFilter === 'ALL' || p.channel === channelFilter;
    const matchesCategory = categoryFilter === 'ALL' || p.menu_engineering_category === categoryFilter;
    return matchesSearch && matchesChannel && matchesCategory;
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', color: '#1e293b' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp size={28} color="#2563eb" /> Menu Profitability & Margin Control
          </h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
            Real-time recipe theoretical costing, realized movement costing, and Menu Engineering Intelligence
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select 
            value={selectedBranch} 
            onChange={e => setSelectedBranch(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name || b.branch_name || b.id}</option>
            ))}
          </select>

          <input 
            type="date" 
            value={selectedDate} 
            onChange={e => setSelectedDate(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
          />

          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#2563eb',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: rebuilding ? 'not-allowed' : 'pointer',
              fontWeight: 500
            }}
          >
            <RefreshCw size={16} className={rebuilding ? 'animate-spin' : ''} />
            {rebuilding ? 'Rebuilding...' : 'Rebuild Snapshots'}
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Net Sales Revenue</span>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: '#0f172a' }}>
            ${totalNetRevenue.toFixed(2)}
          </div>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Canonical sales after prorated discounts</span>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Realized Food Cost %</span>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: avgFoodCostPct !== null && avgFoodCostPct > 35 ? '#ef4444' : '#0f172a' }}>
            {avgFoodCostPct !== null ? `${avgFoodCostPct.toFixed(1)}%` : 'N/A'}
          </div>
          <span style={{ fontSize: '12px', color: totalCostVariance > 0 ? '#ef4444' : '#10b981' }}>
            Variance: {totalCostVariance >= 0 ? `+$${totalCostVariance.toFixed(2)}` : `-$${Math.abs(totalCostVariance).toFixed(2)}`}
          </span>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Modeled Packaging Cost</span>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: '#0f172a' }}>
            ${totalPackagingCost.toFixed(2)}
          </div>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Channel-specific takeout/delivery</span>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Contribution Margin</span>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: '#10b981' }}>
            ${totalContributionMargin.toFixed(2)}
          </div>
          <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 500 }}>
            {avgMarginPct !== null ? `${avgMarginPct.toFixed(1)}% margin` : 'N/A'}
          </span>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Active Cost Alerts</span>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: alerts.length > 0 ? '#ef4444' : '#10b981' }}>
            {alerts.length}
          </div>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            {alerts.length > 0 ? 'Requires recipe review' : 'All margins healthy'}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
        {[
          { key: 'matrix', label: 'Menu Engineering Matrix' },
          { key: 'products', label: 'Product Profitability Table' },
          { key: 'simulator', label: 'Margin Scenario Simulator' },
          { key: 'alerts', label: `Cost Alerts (${alerts.length})` }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              color: activeTab === tab.key ? '#2563eb' : '#64748b',
              borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Menu Engineering Matrix (4 Quadrants) */}
      {activeTab === 'matrix' && (
        <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
            Kasavana & Smith Menu Engineering 4-Quadrant Matrix
          </h2>
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
            Popularity is benchmarked on <strong>Gross Sales Volume</strong> (returns do not turn popularity negative). Profitability benchmark uses <strong>Realized Unit Contribution Margin</strong>.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Stars */}
            <div style={{ border: '2px solid #10b981', borderRadius: '8px', padding: '16px', backgroundColor: '#ecfdf5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#065f46', fontSize: '16px', fontWeight: 'bold' }}>⭐ STARS (High Volume, High Margin)</h3>
                <span style={{ fontSize: '12px', backgroundColor: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: '12px' }}>
                  {products.filter(p => p.menu_engineering_category === 'STAR').length} items
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#047857', margin: '6px 0 12px 0' }}>Maintain high quality consistency. Protect portions and avoid drastic changes.</p>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {products.filter(p => p.menu_engineering_category === 'STAR').map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #a7f3d0', fontSize: '13px' }}>
                    <span>{p.product_name}</span>
                    <span><strong>{p.gross_units_sold} sold</strong> | ${p.unit_contribution_margin?.toFixed(2)} CM</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Plowhorses */}
            <div style={{ border: '2px solid #3b82f6', borderRadius: '8px', padding: '16px', backgroundColor: '#eff6ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#1e40af', fontSize: '16px', fontWeight: 'bold' }}>🐴 PLOWHORSES (High Volume, Low Margin)</h3>
                <span style={{ fontSize: '12px', backgroundColor: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: '12px' }}>
                  {products.filter(p => p.menu_engineering_category === 'PLOWHORSE').length} items
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#1d4ed8', margin: '6px 0 12px 0' }}>High popularity but low margin. Re-engineer recipe, substitute expensive ingredients, or gently raise price.</p>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {products.filter(p => p.menu_engineering_category === 'PLOWHORSE').map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #bfdbfe', fontSize: '13px' }}>
                    <span>{p.product_name}</span>
                    <span><strong>{p.gross_units_sold} sold</strong> | ${p.unit_contribution_margin?.toFixed(2)} CM</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Puzzles */}
            <div style={{ border: '2px solid #f59e0b', borderRadius: '8px', padding: '16px', backgroundColor: '#fffbeb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#92400e', fontSize: '16px', fontWeight: 'bold' }}>🧩 PUZZLES (Low Volume, High Margin)</h3>
                <span style={{ fontSize: '12px', backgroundColor: '#f59e0b', color: '#fff', padding: '2px 8px', borderRadius: '12px' }}>
                  {products.filter(p => p.menu_engineering_category === 'PUZZLE').length} items
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#b45309', margin: '6px 0 12px 0' }}>High profitability but low sales. Reposition on menu, feature in server upselling, or run targeted promotions.</p>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {products.filter(p => p.menu_engineering_category === 'PUZZLE').map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #fde68a', fontSize: '13px' }}>
                    <span>{p.product_name}</span>
                    <span><strong>{p.gross_units_sold} sold</strong> | ${p.unit_contribution_margin?.toFixed(2)} CM</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dogs */}
            <div style={{ border: '2px solid #ef4444', borderRadius: '8px', padding: '16px', backgroundColor: '#fef2f2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#991b1b', fontSize: '16px', fontWeight: 'bold' }}>🐕 DOGS (Low Volume, Low Margin)</h3>
                <span style={{ fontSize: '12px', backgroundColor: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: '12px' }}>
                  {products.filter(p => p.menu_engineering_category === 'DOG').length} items
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#b91c1c', margin: '6px 0 12px 0' }}>Neither popular nor profitable. Consider removing from menu or replacing with higher-margin alternatives.</p>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {products.filter(p => p.menu_engineering_category === 'DOG').map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #fecaca', fontSize: '13px' }}>
                    <span>{p.product_name}</span>
                    <span><strong>{p.gross_units_sold} sold</strong> | ${p.unit_contribution_margin?.toFixed(2)} CM</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Product Profitability Table */}
      {activeTab === 'products' && (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
          {/* Controls */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 10px', flex: 1 }}>
              <Search size={16} color="#64748b" />
              <input 
                type="text" 
                placeholder="Search products..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '14px' }}
              />
            </div>

            <select 
              value={channelFilter} 
              onChange={e => setChannelFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
            >
              <option value="ALL">All Channels</option>
              <option value="DINE_IN">Dine-In</option>
              <option value="TAKEAWAY">Takeaway</option>
              <option value="DELIVERY">Delivery</option>
            </select>

            <select 
              value={categoryFilter} 
              onChange={e => setCategoryFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
            >
              <option value="ALL">All Categories</option>
              <option value="STAR">Stars</option>
              <option value="PLOWHORSE">Plowhorses</option>
              <option value="PUZZLE">Puzzles</option>
              <option value="DOG">Dogs</option>
              <option value="UNCLASSIFIED">Unclassified</option>
            </select>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '10px 12px' }}>Product</th>
                  <th style={{ padding: '10px 12px' }}>Channel</th>
                  <th style={{ padding: '10px 12px' }}>Gross Sold</th>
                  <th style={{ padding: '10px 12px' }}>Returns</th>
                  <th style={{ padding: '10px 12px' }}>Net Units</th>
                  <th style={{ padding: '10px 12px' }}>Net Revenue</th>
                  <th style={{ padding: '10px 12px' }}>Theo Food Cost</th>
                  <th style={{ padding: '10px 12px' }}>Realized Food Cost</th>
                  <th style={{ padding: '10px 12px' }}>Packaging</th>
                  <th style={{ padding: '10px 12px' }}>Unit Margin</th>
                  <th style={{ padding: '10px 12px' }}>Margin %</th>
                  <th style={{ padding: '10px 12px' }}>Quadrant</th>
                  <th style={{ padding: '10px 12px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{p.product_name}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f1f5f9' }}>
                        {p.channel}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{p.gross_units_sold}</td>
                    <td style={{ padding: '10px 12px', color: p.units_returned > 0 ? '#ef4444' : '#64748b' }}>
                      {p.units_returned}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{p.net_units}</td>
                    <td style={{ padding: '10px 12px' }}>${p.net_sales_revenue.toFixed(2)}</td>
                    <td style={{ padding: '10px 12px' }}>${p.theoretical_unit_food_cost.toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', color: p.total_cost_variance > 0 ? '#ef4444' : '#1e293b' }}>
                      ${p.realized_unit_food_cost.toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 12px' }}>${p.unit_packaging_cost.toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: (p.unit_contribution_margin || 0) > 0 ? '#10b981' : '#ef4444' }}>
                      {p.unit_contribution_margin !== null ? `$${p.unit_contribution_margin.toFixed(2)}` : 'N/A'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {p.contribution_margin_pct !== null ? `${(p.contribution_margin_pct * 100).toFixed(1)}%` : 'N/A'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: 600,
                        backgroundColor: 
                          p.menu_engineering_category === 'STAR' ? '#d1fae5' :
                          p.menu_engineering_category === 'PLOWHORSE' ? '#dbeafe' :
                          p.menu_engineering_category === 'PUZZLE' ? '#fef3c7' :
                          p.menu_engineering_category === 'DOG' ? '#fee2e2' : '#f1f5f9',
                        color:
                          p.menu_engineering_category === 'STAR' ? '#065f46' :
                          p.menu_engineering_category === 'PLOWHORSE' ? '#1e40af' :
                          p.menu_engineering_category === 'PUZZLE' ? '#92400e' :
                          p.menu_engineering_category === 'DOG' ? '#991b1b' : '#64748b'
                      }}>
                        {p.menu_engineering_category}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button
                        onClick={() => handleOpenDrilldown(p)}
                        style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', padding: '4px' }}
                        title="View Recipe Drilldown"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Margin Scenario Simulator */}
      {activeTab === 'simulator' && (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
            Margin Scenario Simulator
          </h2>
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
            What-if commercial modeling: evaluate how changing menu selling price or portion sizing impacts unit contribution margin and total variable cost.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Select Product</label>
                <select
                  value={simProduct}
                  onChange={e => {
                    const pid = Number(e.target.value);
                    setSimProduct(pid);
                    const prod = products.find(p => p.product_id === pid);
                    if (prod) setSimPrice(prod.average_net_unit_price || 10);
                  }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                >
                  <option value="">-- Choose a product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.product_id}>{p.product_name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Proposed Selling Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={simPrice}
                  onChange={e => setSimPrice(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Channel</label>
                <select
                  value={simChannel}
                  onChange={e => setSimChannel(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                >
                  <option value="DINE_IN">Dine-In</option>
                  <option value="TAKEAWAY">Takeaway</option>
                  <option value="DELIVERY">Delivery</option>
                </select>
              </div>

              <button
                onClick={handleRunSimulation}
                disabled={simLoading || !simProduct}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                {simLoading ? 'Simulating...' : 'Run Simulation'}
              </button>
            </div>

            {/* Simulation Results */}
            <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px 0' }}>Simulation Output</h3>
              {simResult ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#64748b' }}>Proposed Price:</span>
                    <strong>${simResult.proposed_price.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#64748b' }}>Theoretical Food Cost:</span>
                    <strong>${simResult.simulated_theoretical_food_cost.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#64748b' }}>Modeled Packaging:</span>
                    <strong>${simResult.modeled_packaging_cost.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#64748b' }}>Total Variable Cost:</span>
                    <strong>${simResult.simulated_total_variable_cost.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #e2e8f0', fontSize: '16px' }}>
                    <span style={{ fontWeight: 600, color: '#065f46' }}>Unit Contribution Margin:</span>
                    <strong style={{ color: '#10b981' }}>${simResult.simulated_contribution_margin.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                    <span style={{ color: '#64748b' }}>Simulated Food Cost %:</span>
                    <strong>{simResult.simulated_food_cost_pct ? `${(simResult.simulated_food_cost_pct * 100).toFixed(1)}%` : 'N/A'}</strong>
                  </div>
                </div>
              ) : (
                <p style={{ color: '#94a3b8', fontSize: '13px' }}>Select a product and price to model simulated profitability.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Cost Alerts */}
      {activeTab === 'alerts' && (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Active Recipe Cost Alerts</h2>
          {alerts.length === 0 ? (
            <p style={{ color: '#10b981', fontSize: '14px' }}>No active margin or food cost alerts. All products within configured targets.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {alerts.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '6px', border: '1px solid #fecaca', backgroundColor: '#fef2f2' }}>
                  <AlertTriangle size={20} color="#ef4444" />
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '14px', color: '#991b1b' }}>{a.product_name}</strong>
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#7f1d1d' }}>{a.message}</p>
                  </div>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#ef4444', color: '#fff', fontWeight: 600 }}>
                    {a.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recipe Cost Drilldown Drawer / Modal */}
      {selectedProduct && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '480px',
          backgroundColor: '#fff', boxShadow: '-4px 0 16px rgba(0,0,0,0.1)',
          padding: '24px', zIndex: 1000, overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Recipe Cost Breakdown</h3>
            <button onClick={() => setSelectedProduct(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px' }}>×</button>
          </div>

          <h4 style={{ margin: '0 0 8px 0', color: '#2563eb' }}>{selectedProduct.product_name}</h4>
          <p style={{ fontSize: '12px', color: '#64748b', wordBreak: 'break-all', marginBottom: '16px' }}>
            BOM Fingerprint: <code>{selectedProduct.bom_fingerprint}</code>
          </p>

          {drilldownLoading ? (
            <p>Loading recipe components...</p>
          ) : drilldownData ? (
            <div>
              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
                <div>Theoretical Unit Cost: <strong>${drilldownData.theoretical_unit_food_cost}</strong></div>
                <div>Status: <strong>{drilldownData.status}</strong></div>
              </div>

              <h5 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Standard BOM Ingredients</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(drilldownData.components || []).map((c: any, idx: number) => (
                  <div key={idx} style={{ padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{c.item_name}</strong>
                      <span>${c.line_cost?.toFixed(2)}</span>
                    </div>
                    <div style={{ color: '#64748b' }}>
                      {c.base_quantity} {c.base_unit} @ ${c.unit_cost?.toFixed(2)}/unit
                      {c.is_sub_recipe && <span style={{ marginLeft: '6px', color: '#8b5cf6' }}>[Sub-Recipe Prep]</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
