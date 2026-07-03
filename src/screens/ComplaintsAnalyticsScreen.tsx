import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ArrowLeft, Loader2, AlertTriangle, TrendingUp } from 'lucide-react';

const CHART_COLORS = [
  '#2e7d32', // NÉO Flow primary green
  '#2b6cb0', // Deep Blue
  '#e53e3e', // Rust Red
  '#dd6b20', // Gold Yellow
  '#805ad5', // Purple
  '#d53f8c', // Pinkish Red
  '#319795', // Dark Teal
  '#4a5568', // Blue Grey
  '#ed8936', // Orange
  '#48bb78', // Olive Green
];

interface ComplaintsAnalyticsScreenProps {
  permissions?: any;
  user?: any;
}

export default function ComplaintsAnalyticsScreen({ permissions, user: propUser }: ComplaintsAnalyticsScreenProps) {
  const navigate = useNavigate();
  const user = propUser || (localStorage.getItem('neo_admin_user') ? JSON.parse(localStorage.getItem('neo_admin_user')!) : null);
  const canView = permissions?.can_view_complaints || user?.role === 'Admin' || user?.role === 'Manager';

  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState<any[]>([]);

  // Filter States
  const [branchFilter, setBranchFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Dropdowns
  const [branches, setBranches] = useState<string[]>(['All']);

  useEffect(() => {
    if (!canView) {
      alert('Access Denied. You do not have permission to view Client Complaints.');
      navigate('/');
      return;
    }
    loadData();
  }, [canView]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [branchRes, complaintsRes] = await Promise.all([
        api.getBranchesList(),
        api.getComplaints()
      ]);

      if (branchRes.success && branchRes.data) {
        setBranches(['All', ...branchRes.data.map((b: any) => b.name)]);
      }

      if (complaintsRes.success && complaintsRes.data) {
        setComplaints(complaintsRes.data);
      } else {
        alert(complaintsRes.error || 'Failed to load complaints.');
      }
    } catch (err) {
      console.error('Error loading complaints analytics data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setBranchFilter('All');
    setStartDate('');
    setEndDate('');
  };

  // Client Side Filtering
  const filteredComplaints = useMemo(() => {
    return complaints.filter((item) => {
      if (branchFilter !== 'All' && item.Branch !== branchFilter) {
        return false;
      }
      if (startDate) {
        const itemTime = new Date(item.DateCreated).getTime();
        const startDateTime = new Date(`${startDate}T00:00:00.000Z`).getTime();
        if (itemTime < startDateTime) return false;
      }
      if (endDate) {
        const itemTime = new Date(item.DateCreated).getTime();
        const endDateTime = new Date(`${endDate}T23:59:59.999Z`).getTime();
        if (itemTime > endDateTime) return false;
      }
      return true;
    });
  }, [complaints, branchFilter, startDate, endDate]);

  // Aggregate stats using useMemo
  const stats = useMemo(() => {
    const total = filteredComplaints.length;
    let open = 0;
    let resolved = 0;
    let critical = 0;
    let totalResTimeHours = 0;
    let resolvedWithTimeCount = 0;

    const branchMap: Record<string, number> = {};
    const deptMap: Record<string, number> = {};
    const orderTypeMap: Record<string, number> = {};
    const menuItemsMap: Record<string, number> = {};
    const staffMap: Record<string, number> = {};
    const trendMap: Record<string, number> = {};

    filteredComplaints.forEach((c) => {
      const isClosed = c.Status === 'Resolved' || c.Status === 'Closed';
      if (isClosed) {
        resolved++;
        if (c.ResolutionDate && c.DateCreated) {
          const diffMs = new Date(c.ResolutionDate).getTime() - new Date(c.DateCreated).getTime();
          const diffHrs = diffMs / (1000 * 60 * 60);
          totalResTimeHours += diffHrs;
          resolvedWithTimeCount++;
        }
      } else {
        open++;
        if (c.Severity === 'Critical') {
          critical++;
        }
      }

      if (c.Branch) {
        branchMap[c.Branch] = (branchMap[c.Branch] || 0) + 1;
      }
      if (c.Department) {
        deptMap[c.Department] = (deptMap[c.Department] || 0) + 1;
      }
      if (c.OrderType) {
        orderTypeMap[c.OrderType] = (orderTypeMap[c.OrderType] || 0) + 1;
      }
      if (c.ItemInvolved) {
        menuItemsMap[c.ItemInvolved] = (menuItemsMap[c.ItemInvolved] || 0) + 1;
      }
      if (c.StaffInvolved) {
        staffMap[c.StaffInvolved] = (staffMap[c.StaffInvolved] || 0) + 1;
      }
      if (c.DateCreated) {
        const dateStr = c.DateCreated.split('T')[0];
        trendMap[dateStr] = (trendMap[dateStr] || 0) + 1;
      }
    });

    const avgResTime = resolvedWithTimeCount > 0 ? (totalResTimeHours / resolvedWithTimeCount) : 0;

    // 1. Branch Donut Data
    const branchPieData = Object.keys(branchMap).map((name, index) => ({
      name,
      amount: branchMap[name],
      percentage: total > 0 ? Math.round((branchMap[name] / total) * 100) : 0,
      color: CHART_COLORS[index % CHART_COLORS.length]
    })).sort((a, b) => b.amount - a.amount);

    // 2. Department Horizontal Gauges
    const deptGauges = Object.keys(deptMap).map(name => ({
      name,
      amount: deptMap[name],
      percentage: total > 0 ? Math.round((deptMap[name] / total) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);

    // 3. Order Type Donut Data
    const orderTypePieData = Object.keys(orderTypeMap).map((name, index) => ({
      name,
      amount: orderTypeMap[name],
      percentage: total > 0 ? Math.round((orderTypeMap[name] / total) * 100) : 0,
      color: CHART_COLORS[(index + 3) % CHART_COLORS.length]
    })).sort((a, b) => b.amount - a.amount);

    // 4. Trend line mapping (last 7 active logging days)
    const sortedDates = Object.keys(trendMap).sort();
    const trendDates = sortedDates.slice(-7);
    const trendCounts = trendDates.map(d => trendMap[d]);

    // 5. Leaderboards
    const topItems = Object.keys(menuItemsMap).map(name => ({
      name,
      count: menuItemsMap[name]
    })).sort((a, b) => b.count - a.count).slice(0, 5);

    const topStaff = Object.keys(staffMap).map(name => ({
      name,
      count: staffMap[name]
    })).sort((a, b) => b.count - a.count).slice(0, 5);

    return {
      total,
      open,
      resolved,
      critical,
      avgResTime: Math.round(avgResTime * 10) / 10,
      branchPieData,
      deptGauges,
      orderTypePieData,
      trendDates,
      trendCounts,
      topItems,
      topStaff
    };
  }, [filteredComplaints]);

  // Line Chart computations for SVG
  const trendLineSvg = useMemo(() => {
    if (stats.trendDates.length === 0) return null;

    const width = 580;
    const height = 240;
    const paddingLeft = 50;
    const paddingRight = 30;
    const paddingTop = 30;
    const paddingBottom = 40;

    const xLength = width - paddingLeft - paddingRight;
    const yLength = height - paddingTop - paddingBottom;

    const n = stats.trendDates.length;
    const maxVal = Math.max(...stats.trendCounts, 5); // at least scale up to 5

    // Get coordinates
    const points = stats.trendCounts.map((val, idx) => {
      const x = paddingLeft + (idx * xLength) / (n === 1 ? 1 : n - 1);
      const y = height - paddingBottom - (val * yLength) / maxVal;
      return { x, y, val, date: stats.trendDates[idx] };
    });

    // Build line path
    let linePath = '';
    let areaPath = '';

    if (points.length > 0) {
      linePath = `M ${points[0].x} ${points[0].y}`;
      areaPath = `M ${points[0].x} ${height - paddingBottom} L ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length; i++) {
        linePath += ` L ${points[i].x} ${points[i].y}`;
        areaPath += ` L ${points[i].x} ${points[i].y}`;
      }

      areaPath += ` L ${points[points.length - 1].x} ${height - paddingBottom} Z`;
    }

    // Grid lines count
    const gridLines = [];
    const step = 4;
    for (let i = 0; i <= step; i++) {
      const gridY = paddingTop + (i * yLength) / step;
      const gridValue = Math.round(maxVal - (i * maxVal) / step);
      gridLines.push({ y: gridY, val: gridValue });
    }

    return {
      width,
      height,
      points,
      linePath,
      areaPath,
      gridLines,
      paddingLeft,
      paddingRight,
      paddingBottom,
      yBottom: height - paddingBottom
    };
  }, [stats]);

  // Donut SVG Generator
  const renderDonutChart = (data: typeof stats.branchPieData) => {
    if (data.length === 0) return <div style={{ color: 'var(--text-muted)' }}>No data to represent.</div>;

    const R = 50; // radius
    const C = 2 * Math.PI * R; // circumference ~ 314.159
    let accumulatedPercentage = 0;

    return (
      <div style={{ display: 'flex', gap: '30px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        
        {/* SVG Drawing */}
        <div style={{ position: 'relative', width: '150px', height: '150px' }}>
          <svg width="150" height="150" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
            {data.map((slice, idx) => {
              const strokeLength = (slice.percentage / 100) * C;
              accumulatedPercentage += slice.percentage;

              return (
                <circle
                  key={idx}
                  cx="60"
                  cy="60"
                  r={R}
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth="12"
                  strokeDasharray={`${strokeLength} ${C}`}
                  strokeDashoffset={-((accumulatedPercentage - slice.percentage) / 100) * C}
                  style={{ transition: 'stroke-dashoffset 0.5s' }}
                />
              );
            })}
          </svg>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', color: 'var(--text-main)'
          }}>
            <span style={{ fontSize: '20px', fontWeight: 800 }}>{stats.total}</span>
            <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Complaints</span>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '150px' }}>
          {data.map((slice, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: slice.color, display: 'inline-block' }} />
              <span style={{ fontWeight: 600 }}>{slice.percentage}%</span>
              <span style={{ color: 'var(--text-muted)' }}>{slice.name} ({slice.amount})</span>
            </div>
          ))}
        </div>

      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '12px' }}>
        <Loader2 className="spin" size={32} color="var(--primary)" />
        <span style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Analyzing client complaints...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button 
          onClick={() => navigate('/complaints')} 
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', backgroundColor: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp size={28} style={{ color: 'var(--primary)' }} /> Complaints Analytics
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Inspect trends, identify bottleneck branches/departments, and target service improvements.
          </p>
        </div>
      </div>

      {/* Analytics Filter Header */}
      <div style={{ backgroundColor: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', boxShadow: 'var(--shadow)' }}>
        <div style={{ flex: 1, minWidth: '150px' }}>
          <label style={filterLabelStyle}>Branch Filter</label>
          <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} style={filterSelectStyle}>
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '150px' }}>
          <label style={filterLabelStyle}>Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={filterSelectStyle} />
        </div>
        <div style={{ flex: 1, minWidth: '150px' }}>
          <label style={filterLabelStyle}>End Date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={filterSelectStyle} />
        </div>
        {(branchFilter !== 'All' || startDate || endDate) && (
          <button 
            onClick={handleClearFilters}
            style={{ padding: '10px 14px', backgroundColor: 'var(--danger)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <div style={{ ...kpiCardStyle, borderLeft: '4px solid #2e7d32', backgroundColor: '#f1f8e9' }}>
          <span style={kpiLabelStyle}>Total Logged</span>
          <span style={{ ...kpiValueStyle, color: '#1b5e20' }}>{stats.total}</span>
        </div>
        <div style={{ ...kpiCardStyle, borderLeft: '4px solid #e53e3e', backgroundColor: '#fff5f5' }}>
          <span style={{ ...kpiLabelStyle, color: '#e53e3e' }}>Active Critical</span>
          <span style={{ ...kpiValueStyle, color: '#e53e3e' }}>{stats.critical}</span>
        </div>
        <div style={{ ...kpiCardStyle, borderLeft: '4px solid #319795', backgroundColor: '#e6fffa' }}>
          <span style={{ ...kpiLabelStyle, color: '#319795' }}>Avg Resolution</span>
          <span style={{ ...kpiValueStyle, color: '#234e52' }}>{stats.avgResTime} hrs</span>
        </div>
        <div style={{ ...kpiCardStyle, borderLeft: '4px solid #3182ce', backgroundColor: '#ebf8ff' }}>
          <span style={{ ...kpiLabelStyle, color: '#2b6cb0' }}>Resolution Rate</span>
          <span style={{ ...kpiValueStyle, color: '#2c5282' }}>
            {stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0}%
          </span>
        </div>
      </div>

      {stats.total === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', border: '1px dashed var(--border)', borderRadius: '12px', backgroundColor: 'var(--surface)' }}>
          <AlertTriangle size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', color: 'var(--text-main)' }}>No complaint records match filters</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>Broaden your date selection or select other branches.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
          
          {/* Daily Logging Trend Line Chart */}
          {trendLineSvg && (
            <div style={chartCardStyle}>
              <h3 style={chartTitleStyle}>📅 Logging Trend (Last 7 Active Days)</h3>
              
              <div style={{ width: '100%', overflowX: 'auto', padding: '10px 0' }}>
                <svg width={trendLineSvg.width} height={trendLineSvg.height} style={{ overflow: 'visible', margin: '0 auto', display: 'block' }}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2e7d32" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#2e7d32" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal grid lines */}
                  {trendLineSvg.gridLines.map((line, idx) => (
                    <g key={idx}>
                      <line 
                        x1={trendLineSvg.paddingLeft} 
                        y1={line.y} 
                        x2={trendLineSvg.width - trendLineSvg.paddingRight} 
                        y2={line.y} 
                        stroke="#f0f0f0" 
                        strokeWidth="1" 
                      />
                      <text 
                        x={trendLineSvg.paddingLeft - 10} 
                        y={line.y + 4} 
                        textAnchor="end" 
                        fontSize="11" 
                        fill="var(--text-muted)"
                      >
                        {line.val}
                      </text>
                    </g>
                  ))}

                  {/* Area fill */}
                  {trendLineSvg.areaPath && (
                    <path d={trendLineSvg.areaPath} fill="url(#trendGrad)" />
                  )}

                  {/* Polyline line */}
                  {trendLineSvg.linePath && (
                    <path d={trendLineSvg.linePath} fill="none" stroke="#2e7d32" strokeWidth="3" strokeLinecap="round" />
                  )}

                  {/* Dots & labels */}
                  {trendLineSvg.points.map((pt, idx) => (
                    <g key={idx}>
                      <circle cx={pt.x} cy={pt.y} r="5" fill="#2e7d32" stroke="#fff" strokeWidth="2.5" />
                      <text x={pt.x} y={pt.y - 10} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text-main)">
                        {pt.val}
                      </text>
                      {/* Date label */}
                      <text 
                        x={pt.x} 
                        y={trendLineSvg.yBottom + 20} 
                        textAnchor="middle" 
                        fontSize="10" 
                        fill="var(--text-muted)"
                        transform={`rotate(-20, ${pt.x}, ${trendLineSvg.yBottom + 20})`}
                      >
                        {pt.date.slice(5) /* MM-DD */}
                      </text>
                    </g>
                  ))}

                  {/* Axis baseline */}
                  <line 
                    x1={trendLineSvg.paddingLeft} 
                    y1={trendLineSvg.yBottom} 
                    x2={trendLineSvg.width - trendLineSvg.paddingRight} 
                    y2={trendLineSvg.yBottom} 
                    stroke="var(--border)" 
                    strokeWidth="1" 
                  />
                </svg>
              </div>
            </div>
          )}

          {/* Slices breakdowns row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            
            {/* Branch Pie Card */}
            <div style={chartCardStyle}>
              <h3 style={chartTitleStyle}>📍 Complaints by Branch</h3>
              <div style={{ padding: '10px 0', width: '100%' }}>
                {renderDonutChart(stats.branchPieData)}
              </div>
            </div>

            {/* Order Type Pie Card */}
            <div style={chartCardStyle}>
              <h3 style={chartTitleStyle}>🛵 Dine-In vs Delivery</h3>
              <div style={{ padding: '10px 0', width: '100%' }}>
                {renderDonutChart(stats.orderTypePieData)}
              </div>
            </div>

          </div>

          {/* Department Breakdown & Top Leaders row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            
            {/* Department Horizontal Gauges */}
            <div style={chartCardStyle}>
              <h3 style={chartTitleStyle}>🏢 Responsible Departments</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', marginTop: '10px' }}>
                {stats.deptGauges.length === 0 ? (
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No department data available.</span>
                ) : (
                  stats.deptGauges.map((dept, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                        <span>{dept.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{dept.amount} ({dept.percentage}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '10px', backgroundColor: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ width: `${dept.percentage}%`, height: '100%', backgroundColor: '#2e7d32', borderRadius: '5px', transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Leaderboard Lists card */}
            <div style={chartCardStyle}>
              <h3 style={chartTitleStyle}>🍕 Top Complained Items</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                {stats.topItems.length === 0 ? (
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No menu items logged.</span>
                ) : (
                  stats.topItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid #f5f5f5' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={leaderboardNumberStyle}>{idx + 1}</span>
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>{item.name}</span>
                      </div>
                      <span style={leaderboardBadgeStyle}>{item.count} complaints</span>
                    </div>
                  ))
                )}
              </div>

              <h3 style={{ ...chartTitleStyle, marginTop: '24px' }}>👤 Top Staff Involved</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                {stats.topStaff.length === 0 ? (
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No staff members logged.</span>
                ) : (
                  stats.topStaff.map((staff, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid #f5f5f5' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={leaderboardNumberStyle}>{idx + 1}</span>
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>{staff.name}</span>
                      </div>
                      <span style={leaderboardBadgeStyle}>{staff.count} complaints</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}

// Styling Constants
const filterLabelStyle = { 
  display: 'block', 
  fontSize: '11px', 
  fontWeight: 700, 
  color: 'var(--text-muted)', 
  marginBottom: '6px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px'
};

const filterSelectStyle = { 
  width: '100%', 
  padding: '10px 12px', 
  borderRadius: '6px', 
  border: '1px solid var(--border)', 
  fontSize: '14px', 
  fontFamily: 'inherit',
  backgroundColor: '#fff',
  outline: 'none'
};

const kpiCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface)',
  borderRadius: 'var(--radius)',
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  boxShadow: 'var(--shadow)'
};

const kpiLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const kpiValueStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 900
};

const chartCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface)',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  padding: '24px',
  boxShadow: 'var(--shadow)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start'
};

const chartTitleStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 700,
  color: 'var(--text-main)',
  marginBottom: '16px',
  borderBottom: '1px solid #f0f0f0',
  paddingBottom: '8px',
  width: '100%'
};

const leaderboardNumberStyle = {
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  backgroundColor: '#f1f8e9',
  color: '#2e7d32',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  fontWeight: 700
};

const leaderboardBadgeStyle = {
  fontSize: '11px',
  fontWeight: 700,
  backgroundColor: '#f5f5f5',
  color: 'var(--text-muted)',
  padding: '4px 8px',
  borderRadius: '6px',
  border: '1px solid var(--border)'
};
