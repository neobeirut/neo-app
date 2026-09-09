import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { 
  ArrowLeft, 
  Loader2, 
  DollarSign, 
  CheckCircle, 
  Building2, 
  Layers, 
  Users, 
  SlidersHorizontal,
  Percent,
  Lock,
  Edit3
} from 'lucide-react';
import { 
  calculateTipsDistribution, 
  DEFAULT_DEPARTMENT_FACTORS 
} from '../utils/tipsCalculation';
import type {
  TipsCalculationMode, 
  DepartmentFactorMap, 
  DepartmentSummary,
  TipsDistributionItem
} from '../utils/tipsCalculation';

export default function TipsDistributionScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [collection, setCollection] = useState<any>(null);
  const [distribution, setDistribution] = useState<TipsDistributionItem[]>([]);
  const [totalTipsInput, setTotalTipsInput] = useState<string>('');
  const [mode, setMode] = useState<TipsCalculationMode>('by_department');
  const [deptFactors, setDeptFactors] = useState<DepartmentFactorMap>(DEFAULT_DEPARTMENT_FACTORS);
  const [deptSummaries, setDeptSummaries] = useState<DepartmentSummary[]>([]);
  const [totalPoints, setTotalPoints] = useState<number>(0);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    
    // 1. Fetch collection info
    const { data: cols } = await api.getTipsCollections();
    const col = cols?.find((c: any) => c.id?.toString() === id?.toString());
    
    if (col) {
      setCollection(col);
      const initialTotal = col.total_tips != null ? String(col.total_tips) : '0';
      setTotalTipsInput(initialTotal);
      
      const savedMode: TipsCalculationMode = col.calculation_mode === 'by_employee' ? 'by_employee' : 'by_department';
      setMode(savedMode);

      let savedFactors: DepartmentFactorMap = DEFAULT_DEPARTMENT_FACTORS;
      if (col.department_factors) {
        savedFactors = typeof col.department_factors === 'string' 
          ? JSON.parse(col.department_factors) 
          : col.department_factors;
      }
      setDeptFactors(savedFactors);

      // 2. Fetch distribution and employees
      const [distRes, empRes] = await Promise.all([
        api.getTipsDistribution(id),
        api.getEmployees()
      ]);
      const dist = distRes.data;
      const allEmps = (empRes.success && empRes.data) ? empRes.data : [];
      const empMap = new Map<string, any>(allEmps.map((e: any) => [e.employee_id, e]));

      if (dist && dist.length > 0) {
        // Exclude any staff explicitly marked ineligible, and enrich with employee department if missing
        const eligibleDist = dist
          .filter((d: any) => {
            const emp = empMap.get(d.employee_id);
            if (emp && emp.is_tips_eligible === false) return false;
            if (d.is_tips_eligible === false) return false;
            return true;
          })
          .map((d: any) => {
            const emp = empMap.get(d.employee_id);
            return {
              ...d,
              department: d.department || emp?.department || 'Floor',
              sub_department: d.sub_department || emp?.sub_department || '',
              position: d.position || emp?.position || emp?.department
            };
          });

        const result = calculateTipsDistribution(eligibleDist, initialTotal, savedMode, savedFactors);
        setDistribution(result.items);
        setDeptSummaries(result.departmentSummaries);
        setTotalPoints(result.totalPoints);
      }
    }
    
    setLoading(false);
  };

  const handleTotalTipsChange = (val: string) => {
    setTotalTipsInput(val);
    const num = Math.max(0, parseFloat(val) || 0);
    setCollection((prev: any) => (prev ? { ...prev, total_tips: num } : prev));
    const res = calculateTipsDistribution(distribution, num, mode, deptFactors);
    setDistribution(res.items);
    setDeptSummaries(res.departmentSummaries);
    setTotalPoints(res.totalPoints);
  };

  const handleModeChange = (newMode: TipsCalculationMode) => {
    setMode(newMode);
    if (!collection) return;
    const curTotal = Math.max(0, parseFloat(totalTipsInput) || 0);
    const res = calculateTipsDistribution(distribution, curTotal, newMode, deptFactors);
    setDistribution(res.items);
    setDeptSummaries(res.departmentSummaries);
    setTotalPoints(res.totalPoints);
  };

  const handleDeptFactorChange = (dept: string, val: string) => {
    const num = Math.max(0.1, parseFloat(val) || 0.1);
    const updatedFactors = { ...deptFactors, [dept]: num };
    setDeptFactors(updatedFactors);
    if (!collection) return;
    const curTotal = Math.max(0, parseFloat(totalTipsInput) || 0);
    const res = calculateTipsDistribution(distribution, curTotal, mode, updatedFactors);
    setDistribution(res.items);
    setDeptSummaries(res.departmentSummaries);
    setTotalPoints(res.totalPoints);
  };

  const updateHours = (index: number, val: string) => {
    const updated = [...distribution];
    updated[index].actual_hours_worked = val;
    if (!collection) return;
    const curTotal = Math.max(0, parseFloat(totalTipsInput) || 0);
    const res = calculateTipsDistribution(updated, curTotal, mode, deptFactors);
    setDistribution(res.items);
    setDeptSummaries(res.departmentSummaries);
    setTotalPoints(res.totalPoints);
  };

  const updateFactor = (index: number, val: string) => {
    const updated = [...distribution];
    updated[index].calculated_factor = val;
    if (!collection) return;
    const curTotal = Math.max(0, parseFloat(totalTipsInput) || 0);
    const res = calculateTipsDistribution(updated, curTotal, mode, deptFactors);
    setDistribution(res.items);
    setDeptSummaries(res.departmentSummaries);
    setTotalPoints(res.totalPoints);
  };

  const handleSave = async (status: string) => {
    if (!id || !collection) return;
    setSaving(true);
    
    const finalTotal = Math.max(0, parseFloat(totalTipsInput) || 0);
    const updates = { 
      ...collection, 
      total_tips: finalTotal,
      status,
      calculation_mode: mode,
      department_factors: deptFactors
    };
    
    // Strip frontend-only computed fields to match Supabase schema
    const cleanDistribution = distribution.map(d => {
      const { points, dept_allocated_pool, id: distId, created_at, ...rest } = d;
      return rest;
    });

    const res = await api.updateTipsCollectionAndDistribution(id, updates, cleanDistribution);
    
    setSaving(false);
    if (res.success) {
      if (status === 'Approved') {
        alert('Tips successfully approved and locked!');
      } else {
        alert('Tips draft saved successfully.');
      }
      navigate('/tips');
    } else {
      alert(res.error || 'Failed to save distribution.');
    }
  };

  if (loading) return <div style={{ padding: '60px', textAlign: 'center' }}><Loader2 className="spin" size={32} style={{ color: 'var(--primary)' }} /></div>;
  if (!collection) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Collection not found.</div>;

  const isApproved = collection.status === 'Approved';
  const totalTipsNum = Math.max(0, parseFloat(totalTipsInput) || 0);

  // Group items by department
  const departmentsList = Array.from(new Set(distribution.map(d => d.department || 'Floor')));
  // Ensure Floor is first, then Kitchen, then others
  departmentsList.sort((a, b) => {
    if (a === 'Floor') return -1;
    if (b === 'Floor') return 1;
    if (a === 'Kitchen') return -1;
    if (b === 'Kitchen') return 1;
    return a.localeCompare(b);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate('/tips')} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', backgroundColor: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Back to Collections"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <DollarSign size={26} style={{ color: 'var(--primary)' }} /> Distribution: {collection.tips_id}
              </h1>
              <span style={{ 
                backgroundColor: isApproved ? '#ecfdf5' : '#fffbeb', 
                color: isApproved ? '#047857' : '#b45309', 
                padding: '3px 10px', 
                borderRadius: '12px', 
                fontSize: '12px', 
                fontWeight: 700,
                border: `1px solid ${isApproved ? '#a7f3d0' : '#fde68a'}`
              }}>
                {collection.status}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '13px' }}>
              Branch: <strong>{collection.branch}</strong> • Period: {new Date(collection.date_from).toLocaleDateString()} to {new Date(collection.date_to).toLocaleDateString()} • {distribution.length} Active Staff
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!isApproved ? (
            <div style={{
              padding: '6px 14px',
              backgroundColor: '#f0fdf4',
              color: '#166534',
              borderRadius: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              border: '1.5px solid #86efac',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#15803d', fontWeight: 800 }}>
                    Total Tip Pool
                  </span>
                  <span style={{ fontSize: '10px', backgroundColor: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: '4px', border: '1px solid #bbf7d0', fontWeight: 700 }}>
                    Editable
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#15803d' }}>$</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={totalTipsInput}
                    onChange={e => handleTotalTipsChange(e.target.value)}
                    placeholder="0.00"
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: '#14532d',
                      width: '130px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #86efac',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      outline: 'none'
                    }}
                    title="Edit total tip pool amount (recalculates distribution in real-time)"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#e9f5e9',
              color: '#166534',
              borderRadius: '8px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '16px',
              border: '1px solid #bbf7d0'
            }}>
              <Lock size={18} />
              <span>Total Pool: ${totalTipsNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span style={{ fontSize: '11px', backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                Locked
              </span>
            </div>
          )}
          
          {!isApproved ? (
            <>
              <button 
                onClick={() => handleSave('Draft')} 
                disabled={saving} 
                style={{ padding: '9px 16px', backgroundColor: 'var(--surface)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {saving ? <Loader2 size={16} className="spin" /> : 'Save Draft'}
              </button>
              <button 
                onClick={() => handleSave('Approved')} 
                disabled={saving} 
                style={{ padding: '9px 18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {saving ? <Loader2 size={16} className="spin" /> : <CheckCircle size={18} />} Approve & Lock
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
              <CheckCircle size={16} color="#059669" /> Approved & Locked
            </div>
          )}
        </div>
      </div>

      {/* Mode Switcher & Configuration Banner */}
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: mode === 'by_department' ? '16px' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SlidersHorizontal size={18} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>Calculation Mode:</span>
          </div>

          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => !isApproved && handleModeChange('by_department')}
              disabled={isApproved}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isApproved ? 'default' : 'pointer',
                backgroundColor: mode === 'by_department' ? 'white' : 'transparent',
                color: mode === 'by_department' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: mode === 'by_department' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Building2 size={14} />
              Option 1: By Department, then by Employee
            </button>
            <button
              type="button"
              onClick={() => !isApproved && handleModeChange('by_employee')}
              disabled={isApproved}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isApproved ? 'default' : 'pointer',
                backgroundColor: mode === 'by_employee' ? 'white' : 'transparent',
                color: mode === 'by_employee' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: mode === 'by_employee' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Users size={14} />
              Option 2: Per Employee Directly
            </button>
          </div>
        </div>

        {/* Option 1: Department Multiplier Breakdown Cards */}
        {mode === 'by_department' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {deptSummaries.map(ds => {
              const isFloor = ds.department.toLowerCase().includes('floor');
              const isKitchen = ds.department.toLowerCase().includes('kitchen');
              const cardBg = isFloor ? '#eff6ff' : isKitchen ? '#fef3c7' : '#f3f4f6';
              const borderCol = isFloor ? '#bfdbfe' : isKitchen ? '#fde68a' : '#e5e7eb';
              const textCol = isFloor ? '#1e40af' : isKitchen ? '#92400e' : '#374151';
              const badgeBg = isFloor ? '#3b82f6' : isKitchen ? '#f59e0b' : '#6b7280';

              return (
                <div key={ds.department} style={{ backgroundColor: cardBg, border: `1px solid ${borderCol}`, borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: textCol, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: badgeBg }} />
                      {ds.department} Department
                    </span>
                    <span style={{ backgroundColor: 'white', border: `1px solid ${borderCol}`, color: textCol, fontWeight: 700, fontSize: '12px', padding: '2px 8px', borderRadius: '12px' }}>
                      {ds.sharePercentage}% Share
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Allocated Pool</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>
                        ${ds.allocatedPool.toFixed(2)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: textCol }}>Multiplier:</label>
                      <input 
                        type="number"
                        step="0.5"
                        min="0.1"
                        disabled={isApproved}
                        value={deptFactors[ds.department] ?? ds.factor}
                        onChange={e => handleDeptFactorChange(ds.department, e.target.value)}
                        style={{
                          width: '65px',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          border: `1px solid ${borderCol}`,
                          fontSize: '13px',
                          fontWeight: 700,
                          textAlign: 'center',
                          backgroundColor: isApproved ? '#f3f4f6' : 'white'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '12px', borderTop: `1px dashed ${borderCol}`, paddingTop: '6px', marginTop: '2px' }}>
                    <span>Active Staff: <strong>{ds.employeeCount}</strong></span>
                    <span>•</span>
                    <span>Total Points: <strong>{ds.totalPoints.toFixed(1)}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Option 2: Global Summary */}
        {mode === 'by_employee' && (
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Percent size={18} style={{ color: '#16a34a' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#166534' }}>Global Pool Distribution:</span>
            </div>
            <div style={{ fontSize: '13px', color: '#15803d' }}>
              Total Points: <strong>{totalPoints.toFixed(1)}</strong>
            </div>
            <div style={{ fontSize: '13px', color: '#15803d' }}>
              Tip Rate: <strong>${totalPoints > 0 ? (totalTipsNum / totalPoints).toFixed(4) : '0.00'} / pt</strong>
            </div>
            <div style={{ fontSize: '13px', color: '#15803d' }}>
              Eligible Staff: <strong>{distribution.length}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div style={{ flex: 1, backgroundColor: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', borderBottom: '2px solid var(--border)', zIndex: 1 }}>
              <tr>
                <th style={thStyle}>Employee</th>
                <th style={thStyle}>Department / Role</th>
                <th style={thStyle}>Expected Hours</th>
                <th style={thStyle}>Actual Hours</th>
                <th style={thStyle}>Tip Multiplier (x)</th>
                <th style={thStyle}>Points</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Distributed Tip</th>
              </tr>
            </thead>
            <tbody>
              {mode === 'by_department' ? (
                // Grouped By Department
                departmentsList.map(dept => {
                  const deptItems = distribution.filter(d => (d.department || 'Floor') === dept);
                  const deptSummary = deptSummaries.find(s => s.department === dept);
                  const deptHours = deptItems.reduce((s, d) => s + (parseFloat(String(d.actual_hours_worked)) || 0), 0);
                  const deptPts = deptItems.reduce((s, d) => s + (d.points || 0), 0);
                  const deptTips = deptItems.reduce((s, d) => s + (parseFloat(String(d.tip_amount)) || 0), 0);

                  const isFloor = dept.toLowerCase().includes('floor');
                  const isKitchen = dept.toLowerCase().includes('kitchen');
                  const bannerBg = isFloor ? '#eff6ff' : isKitchen ? '#fef3c7' : '#f3f4f6';
                  const bannerText = isFloor ? '#1e40af' : isKitchen ? '#92400e' : '#374151';

                  return (
                    <div key={dept} style={{ display: 'contents' }}>
                      {/* Department Section Header */}
                      <tr style={{ backgroundColor: bannerBg }}>
                        <td colSpan={7} style={{ padding: '10px 16px', fontWeight: 700, fontSize: '13px', color: bannerText, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>
                              {dept.toUpperCase()} DEPARTMENT — Pool: ${deptSummary ? deptSummary.allocatedPool.toFixed(2) : '0.00'} ({deptSummary ? deptSummary.sharePercentage : 0}%) • Tip Factor: {deptFactors[dept] ?? 1}x
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: 600 }}>
                              {deptItems.length} Staff Members
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Department Items */}
                      {deptItems.map(d => {
                        // Find global index in distribution array to update
                        const globalIdx = distribution.findIndex(item => item.employee_id === d.employee_id);
                        return (
                          <tr key={d.employee_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={tdStyle}><span style={{ fontWeight: 600 }}>{d.employee_name}</span></td>
                            <td style={tdStyle}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ 
                                  padding: '2px 8px', 
                                  borderRadius: '4px', 
                                  fontSize: '12px', 
                                  fontWeight: 600,
                                  backgroundColor: (d.department || '').toLowerCase().includes('kitchen') ? '#fef3c7' : '#eff6ff',
                                  color: (d.department || '').toLowerCase().includes('kitchen') ? '#b45309' : '#1d4ed8'
                                }}>
                                  {d.department || 'Floor'}
                                </span>
                                {d.sub_department && (
                                  <span style={{ 
                                    padding: '2px 8px', 
                                    borderRadius: '4px', 
                                    fontSize: '12px', 
                                    fontWeight: 600,
                                    backgroundColor: '#f1f5f9',
                                    color: '#475569',
                                    border: '1px solid #e2e8f0'
                                  }}>
                                    {d.sub_department}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={tdStyle}><span style={{ color: 'var(--text-muted)' }}>{d.expected_hours || '0'}h</span></td>
                            
                            <td style={tdStyle}>
                              <input 
                                type="number" 
                                value={d.actual_hours_worked} 
                                onChange={e => updateHours(globalIdx, e.target.value)} 
                                disabled={isApproved}
                                style={{ width: '80px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', textAlign: 'center', backgroundColor: isApproved ? '#eef2f5' : 'white' }}
                              />
                            </td>
                            
                            <td style={tdStyle}>
                              <input 
                                type="number" 
                                step="0.1"
                                value={d.calculated_factor} 
                                onChange={e => updateFactor(globalIdx, e.target.value)} 
                                disabled={isApproved}
                                style={{ width: '80px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', textAlign: 'center', backgroundColor: isApproved ? '#eef2f5' : 'white' }}
                              />
                            </td>

                            <td style={tdStyle}>
                              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                {(d.points || 0).toFixed(1)}
                              </span>
                            </td>

                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                              <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '15px' }}>
                                ${Number(d.tip_amount).toFixed(2)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Department Subtotal */}
                      <tr style={{ backgroundColor: '#fafafa', borderBottom: '2px solid #e5e7eb' }}>
                        <td colSpan={3} style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          {dept} Subtotal ({deptItems.length} staff)
                        </td>
                        <td style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 700, textAlign: 'center', color: '#374151' }}>
                          {deptHours.toFixed(1)}h
                        </td>
                        <td style={{ padding: '8px 16px' }} />
                        <td style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 700, color: '#374151' }}>
                          {deptPts.toFixed(1)} pts
                        </td>
                        <td style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 800, textAlign: 'right', color: 'var(--success)' }}>
                          ${deptTips.toFixed(2)}
                        </td>
                      </tr>
                    </div>
                  );
                })
              ) : (
                // Flat Option 2 View
                distribution.map((d, i) => (
                  <tr key={d.employee_id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}><span style={{ fontWeight: 600 }}>{d.employee_name}</span></td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '12px', 
                          fontWeight: 600,
                          backgroundColor: (d.department || '').toLowerCase().includes('kitchen') ? '#fef3c7' : '#eff6ff',
                          color: (d.department || '').toLowerCase().includes('kitchen') ? '#b45309' : '#1d4ed8'
                        }}>
                          {d.department || 'Floor'}
                        </span>
                        {d.sub_department && (
                          <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            fontSize: '12px', 
                            fontWeight: 600,
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #e2e8f0'
                          }}>
                            {d.sub_department}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}><span style={{ color: 'var(--text-muted)' }}>{d.expected_hours || '0'}h</span></td>
                    
                    <td style={tdStyle}>
                      <input 
                        type="number" 
                        value={d.actual_hours_worked} 
                        onChange={e => updateHours(i, e.target.value)} 
                        disabled={isApproved}
                        style={{ width: '80px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', textAlign: 'center', backgroundColor: isApproved ? '#eef2f5' : 'white' }}
                      />
                    </td>
                    
                    <td style={tdStyle}>
                      <input 
                        type="number" 
                        step="0.1"
                        value={d.calculated_factor} 
                        onChange={e => updateFactor(i, e.target.value)} 
                        disabled={isApproved}
                        style={{ width: '80px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', textAlign: 'center', backgroundColor: isApproved ? '#eef2f5' : 'white' }}
                      />
                    </td>

                    <td style={tdStyle}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {(d.points || 0).toFixed(1)}
                      </span>
                    </td>

                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '15px' }}>
                        ${Number(d.tip_amount).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))
              )}

              {/* Grand Total Row */}
              <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid var(--border)', fontWeight: 800 }}>
                <td colSpan={3} style={{ padding: '14px 16px', fontSize: '14px', color: '#111827' }}>
                  GRAND TOTAL ({distribution.length} Staff)
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '14px', color: '#111827' }}>
                  {distribution.reduce((s, d) => s + (parseFloat(String(d.actual_hours_worked)) || 0), 0).toFixed(1)}h
                </td>
                <td style={{ padding: '14px 16px' }} />
                <td style={{ padding: '14px 16px', fontSize: '14px', color: '#111827' }}>
                  {totalPoints.toFixed(1)} pts
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '16px', color: 'var(--success)' }}>
                  ${distribution.reduce((s, d) => s + (parseFloat(String(d.tip_amount)) || 0), 0).toFixed(2)}
                </td>
              </tr>

              {distribution.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No eligible employees found in this collection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const thStyle = { padding: '14px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' };
const tdStyle = { padding: '12px 16px', verticalAlign: 'middle', fontSize: '14px' };

