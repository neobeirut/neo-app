import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Search, Plus, Loader2, DollarSign, Settings, List, ArrowRight } from 'lucide-react';

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
  
  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    if (activeTab === 'collections') {
      const res = await api.getTipsCollections();
      if (res.success && res.data) setCollections(res.data);
    } else if (activeTab === 'employees') {
      const [branchesRes, empRes] = await Promise.all([
        api.getBranchesList(),
        api.getEmployees('Active')
      ]);
      if (branchesRes.success && branchesRes.data) {
        setBranches(branchesRes.data.map((b: any) => typeof b === 'string' ? b : b.name));
      }
      if (empRes.success && empRes.data) {
        setEmployees(empRes.data);
      }
    } else {
      const [branchesRes, settingsRes] = await Promise.all([
        api.getBranchesList(),
        api.getTipsSettings()
      ]);
      
      let bList: string[] = [];
      if (branchesRes.success && branchesRes.data) {
        bList = branchesRes.data.map((b: any) => typeof b === 'string' ? b : b.name);
        setBranches(bList);
      }
      
      if (settingsRes.success && settingsRes.data) {
        let currentSettings = settingsRes.data;
        // Merge missing
        if (bList.length > 0) {
          const newSettings = [...currentSettings];
          bList.forEach(b => {
            if (!newSettings.find(s => s.branch === b)) {
              newSettings.push({ branch: b, calculation_type: 'Weekly', standard_shift_hours: '9', is_active: true });
            }
          });
          setSettings(newSettings);
        } else {
          setSettings(currentSettings);
        }
      }
    }
    setLoading(false);
  };

  const saveSetting = async (index: number) => {
    const s = settings[index];
    const res = await api.saveTipsSettings(s);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a' }}>Tips Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage tip collections, distribution, and branch settings.</p>
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
              <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {settings.map((s, idx) => (
                  <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', backgroundColor: '#f8f9fa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                      <Settings size={20} color="var(--primary)" />
                      <h3 style={{ fontSize: '18px', margin: 0 }}>{s.branch}</h3>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Calculation Type</label>
                        <select style={inputStyle} value={s.calculation_type} onChange={e => updateSetting(idx, 'calculation_type', e.target.value)}>
                          <option value="Daily">Daily</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Monthly">Monthly</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Standard Shift (Hours)</label>
                        <input type="number" style={inputStyle} value={s.standard_shift_hours} onChange={e => updateSetting(idx, 'standard_shift_hours', e.target.value)} />
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

            {activeTab === 'employees' && (
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', alignItems: 'center' }}>
                  <label style={{ fontWeight: 600, fontSize: '14px' }}>Filter by Branch:</label>
                  <select style={{ ...inputStyle, width: '200px' }} value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
                    <option value="All">All Branches</option>
                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', borderBottom: '2px solid var(--border)', zIndex: 1 }}>
                    <tr>
                      <th style={thStyle}>Employee Name</th>
                      <th style={thStyle}>Branch</th>
                      <th style={thStyle}>Role</th>
                      <th style={thStyle}>Default Daily Hours</th>
                      <th style={thStyle}>Days / Week</th>
                      <th style={thStyle}>Tip Factor (Multiplier)</th>
                      <th style={thStyle}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.filter(e => selectedBranch === 'All' || e.branch === selectedBranch).map(e => (
                      <tr key={e.employee_id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={tdStyle}><span style={{ fontWeight: 600 }}>{e.first_name} {e.last_name}</span></td>
                        <td style={tdStyle}>{e.branch}</td>
                        <td style={tdStyle}>{e.position || e.department}</td>
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
                            onClick={() => saveEmployeeTipSetup(e.employee_id)}
                            style={{ padding: '6px 12px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    ))}
                    {employees.filter(e => selectedBranch === 'All' || e.branch === selectedBranch).length === 0 && (
                      <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No employees found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

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
