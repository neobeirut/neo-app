import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ArrowLeft, Loader2, DollarSign, CheckCircle } from 'lucide-react';

export default function TipsDistributionScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [collection, setCollection] = useState<any>(null);
  const [distribution, setDistribution] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    
    // Fetch collection info
    const { data: cols } = await api.getTipsCollections();
    const col = cols?.find(c => c.id?.toString() === id?.toString());
    if (col) setCollection(col);

    // Fetch distribution
    const { data: dist } = await api.getTipsDistribution(id);
    if (dist && col) {
      const recalculated = calculateDistribution(dist, col);
      setDistribution(recalculated);
    } else if (dist) {
      setDistribution(dist);
    }
    
    setLoading(false);
  };

  const calculateDistribution = (dist: any[], col: any) => {
    if (!col) return dist;
    
    const totalTips = parseFloat(col.total_tips) || 0;
    
    // 1. Calculate points for each employee: actual_hours_worked * calculated_factor
    const distWithPoints = dist.map(d => {
      const hours = parseFloat(d.actual_hours_worked) || 0;
      const factor = parseFloat(d.calculated_factor) || 1.0;
      const points = hours * factor;
      return { ...d, points };
    });

    // 2. Sum total points
    const totalPoints = distWithPoints.reduce((sum, d) => sum + d.points, 0);

    // 3. Distribute based on points
    if (totalPoints > 0) {
      const tipPerPoint = totalTips / totalPoints;
      return distWithPoints.map(d => ({
        ...d,
        tip_amount: (d.points * tipPerPoint).toFixed(2)
      }));
    } else {
      return distWithPoints.map(d => ({ ...d, tip_amount: 0 }));
    }
  };

  const updateHours = (index: number, val: string) => {
    const updated = [...distribution];
    updated[index].actual_hours_worked = val;
    // Recalculate
    const recalculated = calculateDistribution(updated, collection);
    setDistribution(recalculated);
  };

  const updateFactor = (index: number, val: string) => {
    const updated = [...distribution];
    updated[index].calculated_factor = val;
    // Recalculate
    const recalculated = calculateDistribution(updated, collection);
    setDistribution(recalculated);
  };

  const handleSave = async (status: string) => {
    if (!id || !collection) return;
    setSaving(true);
    
    const updates = { ...collection, status };
    
    // Strip frontend-only fields (like 'points', 'employee_name' if not in DB schema, etc.)
    // Wait, the mobile app inserts 'employee_name', 'branch', 'actual_hours_worked', 'expected_hours', 'calculated_factor', 'tip_amount', 'status'
    // So just strip 'points' to avoid schema errors.
    const cleanDistribution = distribution.map(d => {
      const { points, id: distId, created_at, ...rest } = d;
      return rest;
    });

    const res = await api.updateTipsCollectionAndDistribution(id, updates, cleanDistribution);
    
    setSaving(false);
    if (res.success) {
      if (status === 'Approved') {
        alert('Tips successfully approved and locked!');
      }
      navigate('/tips');
    } else {
      alert(res.error || 'Failed to save distribution.');
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="spin" /></div>;
  if (!collection) return <div style={{ padding: '40px', textAlign: 'center' }}>Collection not found.</div>;

  const isApproved = collection.status === 'Approved';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/tips')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', backgroundColor: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <DollarSign size={28} style={{ color: 'var(--primary)' }} /> Distribution: {collection.tips_id}
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
              {collection.branch} • {new Date(collection.date_from).toLocaleDateString()} - {new Date(collection.date_to).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '8px 16px', backgroundColor: '#e9f5e9', color: '#2e7d32', borderRadius: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <DollarSign size={18} /> Total Pool: ${collection.total_tips}
          </div>
          
          {!isApproved && (
            <>
              <button onClick={() => handleSave('Draft')} disabled={saving} style={{ padding: '10px 16px', backgroundColor: 'var(--surface)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer' }}>
                Save Draft
              </button>
              <button onClick={() => handleSave('Approved')} disabled={saving} style={{ padding: '10px 16px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={18} /> Approve & Lock
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1, backgroundColor: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', borderBottom: '2px solid var(--border)', zIndex: 1 }}>
              <tr>
                <th style={thStyle}>Employee</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Expected Hours</th>
                <th style={thStyle}>Actual Hours</th>
                <th style={thStyle}>Tip Factor (x)</th>
                <th style={thStyle}>Distributed Tip</th>
              </tr>
            </thead>
            <tbody>
              {distribution.map((d, i) => (
                <tr key={d.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}><span style={{ fontWeight: 600 }}>{d.employee_name}</span></td>
                  <td style={tdStyle}>{d.position || d.department || d.branch}</td>
                  <td style={tdStyle}><span style={{ color: 'var(--text-muted)' }}>{d.expected_hours}h</span></td>
                  
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
                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>${d.tip_amount}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const thStyle = { padding: '16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase' as const };
const tdStyle = { padding: '16px', verticalAlign: 'middle' };
