/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client';
import { 
  TrendingUp, Calendar, Building, Loader2, PieChart, BarChart3, Sliders
} from 'lucide-react';
import { reconcileSchedulesAndPunches } from '../../utils/attendanceAnalysis';

interface LaborIntelligenceViewProps {
  user?: any;
  employees: any[];
  branches: any[];
}

export default function LaborIntelligenceView({ user: _user, employees, branches }: LaborIntelligenceViewProps) {
  const [subTab, setSubTab] = useState<'forecasting' | 'vs_sales'>('forecasting');
  const [loading, setLoading] = useState(true);

  // Filter States
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [filterBranch, setFilterBranch] = useState('All');
  const [targetLaborPct, setTargetLaborPct] = useState(25);

  // Raw DB Data
  const [schedules, setSchedules] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [dailyPayments, setDailyPayments] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [startDate, endDate, filterBranch]);

  const loadData = async () => {
    setLoading(true);
    const [schedRes, attRes, payRes] = await Promise.all([
      api.getEmployeeSchedules({ startDate, endDate, branch: filterBranch }),
      api.getAttendanceLogs({ startDate, endDate, branch: filterBranch }),
      api.getAllDailyPayments({ startDate, endDate, branch: filterBranch })
    ]);

    if (schedRes.success) setSchedules(schedRes.data || []);
    if (attRes.success) setAttendanceLogs(attRes.data || []);
    if (payRes.success) setDailyPayments(payRes.data || []);

    setLoading(false);
  };

  // Helper: compute employee wage
  const getEmployeeWage = (emp: any) => {
    if (!emp) return 10; // Default $10/hr fallback
    if (emp.salary_type === 'Hourly') return parseFloat(emp.hourly_rate) || 10;
    const salary = parseFloat(emp.salary) || 1000;
    const days = parseFloat(emp.working_days_per_week) || 6;
    const hours = parseFloat(emp.default_daily_hours) || 9;
    return salary / (days * 4.333 * hours);
  };

  // 1. Forecasted Labor Computations (from Published Schedules)
  const forecastItems = useMemo(() => {
    return schedules.map(s => {
      const emp = employees.find(e => e.employee_id === s.employee_id);
      const wage = getEmployeeWage(emp);
      
      // Calculate scheduled hours
      let durationHrs = 8;
      if (s.start_time && s.end_time) {
        const [h1, m1] = s.start_time.split(':').map(Number);
        const [h2, m2] = s.end_time.split(':').map(Number);
        let startMins = h1 * 60 + m1;
        let endMins = h2 * 60 + m2;
        if (endMins < startMins) endMins += 1440;
        const breakMins = parseInt(s.break_duration_mins || 0, 10);
        durationHrs = Math.max(0, (endMins - startMins - breakMins) / 60);
      }

      const projectedCost = Math.round(durationHrs * wage * 100) / 100;

      return {
        ...s,
        employee_name: emp ? `${emp.first_name || ''} ${emp.last_name || ''}` : s.employee_id,
        position: emp?.position || 'Staff',
        branch: s.branch || emp?.branch || 'Main',
        wage: Math.round(wage * 100) / 100,
        durationHrs: Math.round(durationHrs * 100) / 100,
        projectedCost
      };
    });
  }, [schedules, employees]);

  // Aggregate Forecast Summaries
  const forecastTotals = useMemo(() => {
    let totalScheduledHours = 0;
    let totalForecastedCost = 0;

    forecastItems.forEach(item => {
      totalScheduledHours += item.durationHrs;
      totalForecastedCost += item.projectedCost;
    });

    return {
      totalScheduledHours: Math.round(totalScheduledHours * 10) / 10,
      totalForecastedCost: Math.round(totalForecastedCost * 100) / 100
    };
  }, [forecastItems]);

  // 2. Labor Cost vs. Sales Analysis Computations
  const salesVsLaborItems = useMemo(() => {
    // Reconcile actual attendance for total worked labor cost
    const reconciled = reconcileSchedulesAndPunches({
      schedules,
      attendanceLogs,
      employees
    });

    // Group actual labor cost & sales revenue by date
    const dateMap = new Map<string, {
      date: string;
      branch: string;
      scheduledHours: number;
      actualHours: number;
      laborCost: number;
      salesRevenue: number;
    }>();

    // Map labor cost from actual attendance / schedules
    reconciled.forEach(rec => {
      const emp = employees.find(e => e.employee_id === rec.employee_id);
      const wage = getEmployeeWage(emp);
      const hrs = rec.actual_hours || rec.scheduled_hours;
      const cost = hrs * wage;

      if (!dateMap.has(rec.date)) {
        dateMap.set(rec.date, {
          date: rec.date,
          branch: rec.branch,
          scheduledHours: 0,
          actualHours: 0,
          laborCost: 0,
          salesRevenue: 0
        });
      }

      const obj = dateMap.get(rec.date)!;
      obj.scheduledHours += rec.scheduled_hours;
      obj.actualHours += rec.actual_hours;
      obj.laborCost += cost;
    });

    // Map sales revenue from daily payments / POS orders
    dailyPayments.forEach(p => {
      const pDate = p.date ? p.date.split('T')[0] : '';
      if (!pDate) return;

      const usdVal = parseFloat(p.amount_usd) || 0;
      if (!dateMap.has(pDate)) {
        dateMap.set(pDate, {
          date: pDate,
          branch: p.branch || 'Main',
          scheduledHours: 0,
          actualHours: 0,
          laborCost: 0,
          salesRevenue: 0
        });
      }

      dateMap.get(pDate)!.salesRevenue += usdVal;
    });

    // Convert map to array and compute Labor %
    return Array.from(dateMap.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(row => {
        const laborCost = Math.round(row.laborCost * 100) / 100;
        const salesRevenue = Math.round(row.salesRevenue * 100) / 100;
        const laborPct = salesRevenue > 0 ? Math.round((laborCost / salesRevenue) * 1000) / 10 : 0;
        const varianceToTarget = Math.round((laborPct - targetLaborPct) * 10) / 10;

        return {
          ...row,
          scheduledHours: Math.round(row.scheduledHours * 10) / 10,
          actualHours: Math.round(row.actualHours * 10) / 10,
          laborCost,
          salesRevenue,
          laborPct,
          varianceToTarget
        };
      });
  }, [schedules, attendanceLogs, dailyPayments, employees, filterBranch, targetLaborPct]);

  // Total Sales & Overall Labor % KPI
  const overallKPIs = useMemo(() => {
    let totalLaborCost = 0;
    let totalSalesRevenue = 0;
    salesVsLaborItems.forEach(r => {
      totalLaborCost += r.laborCost;
      totalSalesRevenue += r.salesRevenue;
    });

    const overallLaborPct = totalSalesRevenue > 0 
      ? Math.round((totalLaborCost / totalSalesRevenue) * 1000) / 10 
      : 0;

    return {
      totalLaborCost: Math.round(totalLaborCost * 100) / 100,
      totalSalesRevenue: Math.round(totalSalesRevenue * 100) / 100,
      overallLaborPct
    };
  }, [salesVsLaborItems]);

  const getHealthBadge = (pct: number) => {
    if (pct === 0) return <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', backgroundColor: '#f1f5f9', color: '#64748b' }}>NO SALES DATA</span>;
    if (pct <= targetLaborPct) {
      return <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>OPTIMAL ({pct}%)</span>;
    }
    if (pct <= targetLaborPct + 5) {
      return <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>MODERATE ({pct}%)</span>;
    }
    return <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>HIGH OVERHEAD ({pct}%)</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Controls & KPI Banner */}
      <div style={{ backgroundColor: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={22} style={{ color: 'var(--primary)' }} /> Labor Intelligence & Cost Analytics
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Forecast scheduled shift budgets and analyze Labor Cost % against POS sales revenue.
            </p>
          </div>

          {/* Sub-tab Switcher */}
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px', gap: '4px' }}>
            <button 
              onClick={() => setSubTab('forecasting')}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                backgroundColor: subTab === 'forecasting' ? 'white' : 'transparent',
                color: subTab === 'forecasting' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: subTab === 'forecasting' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Labor Cost Forecasting
            </button>
            <button 
              onClick={() => setSubTab('vs_sales')}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                backgroundColor: subTab === 'vs_sales' ? 'white' : 'transparent',
                color: subTab === 'vs_sales' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: subTab === 'vs_sales' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Labor % vs Sales Analysis
            </button>
          </div>
        </div>

        {/* Global Filters Bar */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} color="#64748b" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
            <span style={{ fontSize: '12px', color: '#64748b' }}>to</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building size={16} color="#64748b" />
            <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} style={inputStyle}>
              <option value="All">All Branches</option>
              {branches.map((b: any, idx: number) => {
                const name = typeof b === 'string' ? b : b.name;
                return <option key={idx} value={name}>{name}</option>;
              })}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fff7ed', padding: '6px 12px', borderRadius: '8px', border: '1px solid #ffedd5' }}>
            <Sliders size={15} style={{ color: '#ea580c' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#9a3412' }}>Target Labor %:</span>
            <input 
              type="number" 
              value={targetLaborPct} 
              onChange={e => setTargetLaborPct(parseFloat(e.target.value) || 25)} 
              style={{ ...inputStyle, width: '65px', textAlign: 'center', fontWeight: 700, color: '#c2410c' }} 
              min={5} 
              max={60} 
            />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#c2410c' }}>%</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div style={kpiCardStyle}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Projected Labor Budget</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
            ${forecastTotals.totalForecastedCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Based on {forecastTotals.totalScheduledHours} scheduled hours
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Gross POS Sales Revenue</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
            ${overallKPIs.totalSalesRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Actual revenue logged in selected period
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Overall Labor Cost %</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: overallKPIs.overallLaborPct > targetLaborPct ? '#b91c1c' : '#15803d', marginTop: '4px' }}>
            {overallKPIs.overallLaborPct}%
          </div>
          <div style={{ marginTop: '6px' }}>
            {getHealthBadge(overallKPIs.overallLaborPct)}
          </div>
        </div>
      </div>

      {/* TAB 1: LABOR COST FORECASTING */}
      {subTab === 'forecasting' && (
        <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '15px' }}>
            Scheduled Shift Labor Cost Forecast
          </div>

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={32} className="spin" style={{ color: 'var(--primary)', marginBottom: '8px' }} />
              <p style={{ margin: 0 }}>Computing scheduled shift payroll projections...</p>
            </div>
          ) : forecastItems.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <BarChart3 size={40} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)' }}>No Scheduled Shifts Found</h3>
              <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>Publish shift schedules in Shift Planning to view projected labor budgets.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>
                  <th style={{ padding: '14px 16px' }}>Employee</th>
                  <th style={{ padding: '14px 16px' }}>Position / Branch</th>
                  <th style={{ padding: '14px 16px' }}>Date</th>
                  <th style={{ padding: '14px 16px' }}>Shift Window</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Hourly Wage</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Scheduled Hrs</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right' }}>Projected Payroll Cost</th>
                </tr>
              </thead>
              <tbody>
                {forecastItems.map((item, idx) => (
                  <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-main)' }}>{item.employee_name}</td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{item.position} • {item.branch}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 600 }}>{item.date}</td>
                    <td style={{ padding: '14px 16px', color: 'var(--primary)', fontWeight: 600 }}>{item.shift_name} ({item.start_time} - {item.end_time})</td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600 }}>${item.wage.toFixed(2)}/hr</td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700 }}>{item.durationHrs} hrs</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#15803d' }}>${item.projectedCost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 2: LABOR COST VS. SALES ANALYSIS */}
      {subTab === 'vs_sales' && (
        <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '15px' }}>
            Daily Labor Cost % vs POS Revenue Comparison
          </div>

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={32} className="spin" style={{ color: 'var(--primary)', marginBottom: '8px' }} />
              <p style={{ margin: 0 }}>Correlating POS sales with daily labor cost...</p>
            </div>
          ) : salesVsLaborItems.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <PieChart size={40} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)' }}>No Sales & Labor Data</h3>
              <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>No daily sales or labor records match the selected date range.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>
                  <th style={{ padding: '14px 16px' }}>Date</th>
                  <th style={{ padding: '14px 16px' }}>Branch</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Scheduled Hrs</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Worked Hrs</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right' }}>Total Labor Cost ($)</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right' }}>POS Gross Sales ($)</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Labor %</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {salesVsLaborItems.map((row, idx) => (
                  <tr key={row.date + idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-main)' }}>{row.date}</td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{row.branch}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>{row.scheduledHours} hrs</td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600 }}>{row.actualHours} hrs</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: '#b91c1c' }}>${row.laborCost.toFixed(2)}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: '#15803d' }}>${row.salesRevenue.toFixed(2)}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 800 }}>{row.laborPct}%</td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {getHealthBadge(row.laborPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

    </div>
  );
}

const kpiCardStyle = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '20px',
  boxShadow: 'var(--shadow)'
};

const inputStyle = {
  padding: '6px 10px',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  fontSize: '12px',
  outline: 'none',
  backgroundColor: 'white'
};
