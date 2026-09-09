import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Search, Plus, Loader2, DollarSign, Settings, List, ArrowRight, CheckCircle, XCircle, Users } from 'lucide-react';
import { isEmployeeActive } from '../utils/payrollCalculation';

export default function TipsScreen() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'collections' | 'settings' | 'employees'>('collections');
  const [loading, setLoading] = useState(false);
  
  // Data
  const [collections, setCollections] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('All');
  const [empFilter, setEmpFilter] = useState<'eligible' | 'excluded' | 'all'>('eligible');
  
  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    // Fetch active branches first to ensure deleted or inactive branches never appear
    const branchesRes = await api.getBranchesList();
    const validBranches: string[] = (branchesRes.success && branchesRes.data)
      ? branchesRes.data.map((b: any) => typeof b === 'string' ? b : b.name).filter(Boolean)
      : [];
    setBranches(validBranches);

    if (activeTab === 'collections') {
      const res = await api.getTipsCollections();
      if (res.success && res.data) {
        // Exclude collections belonging to deleted branches
        const activeBranchCols = res.data.filter((c: any) => 
          validBranches.length === 0 || !c.branch || validBranches.includes(c.branch)
        );
        setCollections(activeBranchCols);
      }
    } else if (activeTab === 'employees') {
      const empRes = await api.getEmployees();
      if (empRes.success && empRes.data) {
        // Strictly filter ONLY active employees, and exclude any tied to deleted branches
        const activeEmps = empRes.data.filter((e: any) => {
          if (!isEmployeeActive(e)) return false;
          if (validBranches.length > 0 && e.branch && !validBranches.includes(e.branch)) return false;
          return true;
        });
        setEmployees(activeEmps);
      }
    } else {
      // activeTab === 'settings'
      const settingsRes = await api.getTipsSettings();
      if (settingsRes.success && settingsRes.data) {
        // Only keep tips_settings for branches that actually exist and are active
        const existingSettings = settingsRes.data.filter((s: any) => validBranches.includes(s.branch));
        
        // Merge any valid branch that doesn't have a settings record yet
        const merged = [...existingSettings];
        validBranches.forEach(b => {
          if (!merged.find(s => s.branch === b)) {
            merged.push({ 
              branch: b, 
              calculation_type: 'Weekly', 
              standard_shift_hours: '9', 
              is_active: true,
              calculation_mode: 'by_department',
              department_factors: { Floor: 7, Kitchen: 3 }
            });
          }
        });
        setSettings(merged);
      }
    }
    setLoading(false);
  };

  const saveSetting = async (index: number) => {
    const s = settings[index];
    const payload = {
      ...s,
      calculation_mode: s.calculation_mode || 'by_department',
      department_factors: s.department_factors || { Floor: 7, Kitchen: 3 }
    };
    const res = await api.saveTipsSettings(payload);
    if (res.success) {
      alert(`Settings saved for ${s.branch}`);
    } else {
      alert(res.error || 'Failed to save');
    }
  };

  const updateSetting = (index: number, field: string, val: any) => {
    const updated = [...settings];
    updated[index] = { ...updated[index], [field]: val };
    setSettings(updated);
  };

  const updateDeptFactor = (index: number, dept: 'Floor' | 'Kitchen', val: string) => {
    const updated = [...settings];
    const num = Math.max(0, parseFloat(val) || 0);
    const curFactors = { ...(updated[index].department_factors || { Floor: 7, Kitchen: 3 }) };
    curFactors[dept] = num;
    updated[index] = { ...updated[index], department_factors: curFactors };
    setSettings(updated);
  };

  const updateEmpField = (id: string, field: string, val: string) => {
    const updated = employees.map(e => e.employee_id === id ? { ...e, [field]: val } : e);
    setEmployees(updated);
  };

  const saveEmployeeTipSetup = async (id: string) => {
    const emp = employees.find(e => e.employee_id === id);
    if (!emp) return;
    const res = await api.updateEmployeeWorkHours(
      emp.employee_id,
      parseFloat(emp.default_daily_hours) || 0,
      parseFloat(emp.working_days_per_week) || 0,
      parseFloat(emp.tip_factor) || 0
    );
    if (res.success) {
      alert(`Tip setup saved for ${emp.first_name} ${emp.last_name}`);
    } else {
      alert(res.error || 'Failed to save');
    }
  };

  const toggleEmpTipsEligible = async (employeeId: string, currentVal: boolean) => {
    const newVal = !currentVal;
    setEmployees(prev => prev.map(e => e.employee_id === employeeId ? { ...e, is_tips_eligible: newVal } : e));
    const res = await api.updateEmployeeCriteria(employeeId, { is_tips_eligible: newVal });
    if (!res.success) {
      alert(res.error || 'Failed to update tips eligibility');
      setEmployees(prev => prev.map(e => e.employee_id === employeeId ? { ...e, is_tips_eligible: currentVal } : e));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <DollarSign size={28} style={{ color: 'var(--primary)' }} /> Tips Config & Distribution
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Manage tip collections, distribution, and branch settings.
          </p>
        </div>
        {activeTab === 'collections' && (
          <button 
            onClick={() => navigate('/tips/new')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={20} /> Create Collection
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveTab('collections')}
          style={{ ...tabStyle, borderBottom: activeTab === 'collections' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'collections' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'collections' ? 600 : 500 }}
        >
          <List size={18} /> Collections & History
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          style={{ ...tabStyle, borderBottom: activeTab === 'settings' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'settings' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'settings' ? 600 : 500 }}
        >
          <Settings size={18} /> Branch Settings
        </button>
        <button 
          onClick={() => setActiveTab('employees')}
          style={{ ...tabStyle, borderBottom: activeTab === 'employees' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'employees' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'employees' ? 600 : 500 }}
        >
          <Search size={18} /> Employee Tip Setup
        </button>
      </div>

      <div style={{ flex: 1, backgroundColor: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
            <Loader2 size={32} className="spin" style={{ color: 'var(--primary)' }} />
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            
            {activeTab === 'collections' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', borderBottom: '2px solid var(--border)', zIndex: 1 }}>
                  <tr>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Branch</th>
                    <th style={thStyle}>Period</th>
                    <th style={thStyle}>Total Tips</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle}><span style={{ fontWeight: 600 }}>{c.tips_id}</span></td>
                      <td style={tdStyle}>{c.branch}</td>
                      <td style={tdStyle}>
                        <div style={{ fontSize: '13px' }}>{new Date(c.date_from).toLocaleDateString()}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>to {new Date(c.date_to).toLocaleDateString()}</div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: 'var(--success)' }}>
                          <DollarSign size={16} /> {c.total_tips}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ 
                          backgroundColor: c.status === 'Draft' ? '#fff3cd' : c.status === 'Approved' ? '#d1e7dd' : '#cff4fc', 
                          color: c.status === 'Draft' ? '#856404' : c.status === 'Approved' ? '#0f5132' : '#055160',
                          padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 
                        }}>{c.status}</span>
                      </td>
                      <td style={tdStyle}>
                        <button 
                          onClick={() => navigate(`/tips/distribution/${c.id}`)}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}
                        >
                          View <ArrowRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {collections.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No collections found.</td></tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'settings' && (
              <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                {settings.map((s, idx) => (
                  <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', backgroundColor: '#f8f9fa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                      <Settings size={20} color="var(--primary)" />
                      <h3 style={{ fontSize: '18px', margin: 0 }}>{s.branch}</h3>
                      <span style={{ 
                        marginLeft: 'auto', 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        padding: '2px 8px', 
                        borderRadius: '12px',
                        backgroundColor: s.is_active !== false ? '#ecfdf5' : '#fff1f2',
                        color: s.is_active !== false ? '#047857' : '#be123c',
                        border: `1px solid ${s.is_active !== false ? '#a7f3d0' : '#fecdd3'}`
                      }}>
                        {s.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Branch Status in Tips</label>
                        <select 
                          style={inputStyle} 
                          value={s.is_active !== false ? 'Active' : 'Inactive'} 
                          onChange={e => updateSetting(idx, 'is_active', e.target.value === 'Active')}
                        >
                          <option value="Active">Active (Included in Tips)</option>
                          <option value="Inactive">Inactive (Disabled from Tips)</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Tips Calculation Mode</label>
                        <select 
                          style={inputStyle} 
                          value={s.calculation_mode || 'by_department'} 
                          onChange={e => updateSetting(idx, 'calculation_mode', e.target.value)}
                        >
                          <option value="by_department">Option 1: By Department, then by Employee</option>
                          <option value="by_employee">Option 2: Per Employee Directly</option>
                        </select>
                      </div>

                      {(s.calculation_mode || 'by_department') === 'by_department' && (() => {
                        const floorFactor = (s.department_factors?.Floor !== undefined) ? Number(s.department_factors.Floor) : 7;
                        const kitchenFactor = (s.department_factors?.Kitchen !== undefined) ? Number(s.department_factors.Kitchen) : 3;
                        const sumFactor = (floorFactor + kitchenFactor) || 1;
                        const floorPct = Math.round((floorFactor / sumFactor) * 1000) / 10;
                        const kitchenPct = Math.round((kitchenFactor / sumFactor) * 1000) / 10;

                        return (
                          <div style={{ backgroundColor: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>
                              Department Tip Multipliers (Pool Split)
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                              <div>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                                  Floor Multiplier
                                </label>
                                <input 
                                  type="number" 
                                  step="0.5"
                                  min="0"
                                  style={inputStyle} 
                                  value={floorFactor} 
                                  onChange={e => updateDeptFactor(idx, 'Floor', e.target.value)} 
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                                  Kitchen Multiplier
                                </label>
                                <input 
                                  type="number" 
                                  step="0.5"
                                  min="0"
                                  style={inputStyle} 
                                  value={kitchenFactor} 
                                  onChange={e => updateDeptFactor(idx, 'Kitchen', e.target.value)} 
                                />
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', fontSize: '11px', fontWeight: 600 }}>
                              <span style={{ flex: 1, backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '4px 6px', borderRadius: '4px', textAlign: 'center' }}>
                                Floor: {floorPct}%
                              </span>
                              <span style={{ flex: 1, backgroundColor: '#fef3c7', color: '#b45309', padding: '4px 6px', borderRadius: '4px', textAlign: 'center' }}>
                                Kitchen: {kitchenPct}%
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Calculation Period</label>
                        <select style={inputStyle} value={s.calculation_type || 'Weekly'} onChange={e => updateSetting(idx, 'calculation_type', e.target.value)}>
                          <option value="Daily">Daily</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Monthly">Monthly</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Standard Shift (Hours)</label>
                        <input type="number" style={inputStyle} value={s.standard_shift_hours || '9'} onChange={e => updateSetting(idx, 'standard_shift_hours', e.target.value)} />
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => saveSetting(idx)}
                      style={{ width: '100%', padding: '8px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Save Settings
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'employees' && (() => {
              const branchEmployees = employees.filter(e => selectedBranch === 'All' || e.branch === selectedBranch);
              const eligibleCount = branchEmployees.filter(e => e.is_tips_eligible !== false).length;
              const excludedCount = branchEmployees.filter(e => e.is_tips_eligible === false).length;

              const visibleEmployees = branchEmployees.filter(e => {
                const isTips = e.is_tips_eligible !== false;
                if (empFilter === 'eligible') return isTips;
                if (empFilter === 'excluded') return !isTips;
                return true;
              });

              return (
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <label style={{ fontWeight: 600, fontSize: '14px' }}>Branch:</label>
                        <select style={{ ...inputStyle, width: '180px' }} value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
                          <option value="All">All Active Branches</option>
                          {branches.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>

                      <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <button
                          type="button"
                          onClick={() => setEmpFilter('eligible')}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            backgroundColor: empFilter === 'eligible' ? 'white' : 'transparent',
                            color: empFilter === 'eligible' ? 'var(--primary)' : 'var(--text-muted)',
                            boxShadow: empFilter === 'eligible' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <CheckCircle size={14} color={empFilter === 'eligible' ? '#059669' : undefined} />
                          Eligible Staff ({eligibleCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmpFilter('excluded')}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            backgroundColor: empFilter === 'excluded' ? 'white' : 'transparent',
                            color: empFilter === 'excluded' ? '#be123c' : 'var(--text-muted)',
                            boxShadow: empFilter === 'excluded' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <XCircle size={14} color={empFilter === 'excluded' ? '#e11d48' : undefined} />
                          Excluded ({excludedCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmpFilter('all')}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            backgroundColor: empFilter === 'all' ? 'white' : 'transparent',
                            color: empFilter === 'all' ? '#111827' : 'var(--text-muted)',
                            boxShadow: empFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Users size={14} />
                          All ({branchEmployees.length})
                        </button>
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Showing {visibleEmployees.length} employee{visibleEmployees.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', borderBottom: '2px solid var(--border)', zIndex: 1 }}>
                      <tr>
                        <th style={thStyle}>Employee Name</th>
                        <th style={thStyle}>Branch</th>
                        <th style={thStyle}>Department / Role</th>
                        <th style={thStyle}>Default Daily Hours</th>
                        <th style={thStyle}>Days / Week</th>
                        <th style={thStyle}>Tip Factor (Multiplier)</th>
                        <th style={thStyle}>Tips Eligibility</th>
                        <th style={thStyle}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleEmployees.map(e => {
                        const isTips = e.is_tips_eligible !== false;
                        return (
                          <tr key={e.employee_id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={tdStyle}><span style={{ fontWeight: 600 }}>{e.first_name} {e.last_name}</span></td>
                            <td style={tdStyle}>{e.branch}</td>
                            <td style={tdStyle}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ 
                                  padding: '2px 8px', 
                                  borderRadius: '4px', 
                                  fontSize: '12px', 
                                  fontWeight: 600,
                                  backgroundColor: (e.department || '').toLowerCase().includes('kitchen') ? '#fef3c7' : '#eff6ff',
                                  color: (e.department || '').toLowerCase().includes('kitchen') ? '#b45309' : '#1d4ed8'
                                }}>
                                  {e.department || 'Floor'}
                                </span>
                                {e.sub_department && (
                                  <span style={{ 
                                    padding: '2px 8px', 
                                    borderRadius: '4px', 
                                    fontSize: '12px', 
                                    fontWeight: 600,
                                    backgroundColor: '#f1f5f9',
                                    color: '#475569',
                                    border: '1px solid #e2e8f0'
                                  }}>
                                    {e.sub_department}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{e.position}</div>
                            </td>
                            <td style={tdStyle}>
                              <input type="number" style={{...inputStyle, width: '80px'}} value={e.default_daily_hours || ''} onChange={ev => updateEmpField(e.employee_id, 'default_daily_hours', ev.target.value)} />
                            </td>
                            <td style={tdStyle}>
                              <input type="number" style={{...inputStyle, width: '80px'}} value={e.working_days_per_week || ''} onChange={ev => updateEmpField(e.employee_id, 'working_days_per_week', ev.target.value)} />
                            </td>
                            <td style={tdStyle}>
                              <input type="number" step="0.1" style={{...inputStyle, width: '80px'}} value={e.tip_factor || ''} onChange={ev => updateEmpField(e.employee_id, 'tip_factor', ev.target.value)} />
                            </td>
                            <td style={tdStyle}>
                              <button
                                type="button"
                                onClick={() => toggleEmpTipsEligible(e.employee_id, isTips)}
                                title={isTips ? 'Click to exclude from tips calculation' : 'Click to include in tips calculation'}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '5px 12px',
                                  backgroundColor: isTips ? '#ecfdf5' : '#fff1f2',
                                  color: isTips ? '#047857' : '#be123c',
                                  border: `1px solid ${isTips ? '#a7f3d0' : '#fecdd3'}`,
                                  borderRadius: '20px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isTips ? '#10b981' : '#f43f5e' }} />
                                {isTips ? 'Included' : 'Excluded'}
                              </button>
                            </td>
                            <td style={tdStyle}>
                              <button 
                                onClick={() => saveEmployeeTipSetup(e.employee_id)}
                                style={{ padding: '6px 12px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                              >
                                Save
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {visibleEmployees.length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {empFilter === 'excluded' 
                              ? 'No excluded employees in this branch. All staff are eligible for tips.'
                              : 'No employees found matching the filter.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })()}

          </div>
        )}
      </div>
    </div>
  );
}

const tabStyle = { padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' };
const thStyle = { padding: '16px', color: 'var(--text-muted)', fontWeight: 600 };
const tdStyle = { padding: '16px' };
const inputStyle = { width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '14px', fontFamily: 'inherit' };
