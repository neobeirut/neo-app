import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ArrowLeft, Loader2, Save } from 'lucide-react';

export default function TipsCreateScreen() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [branches, setBranches] = useState<string[]>([]);
  const [branch, setBranch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [cashTips, setCashTips] = useState('');
  const [cardTips, setCardTips] = useState('');
  const [otherTips, setOtherTips] = useState('');
  const [comments, setComments] = useState('');

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    const res = await api.getBranchesList();
    if (res.success && res.data) {
      const bList = res.data.map((b: any) => typeof b === 'string' ? b : b.name);
      setBranches(bList);
      if (bList.length > 0) setBranch(bList[0]);
    }
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branch || !dateFrom || !dateTo) {
      alert('Branch, Date From, and Date To are required.');
      return;
    }

    const total = (parseFloat(cashTips) || 0) + (parseFloat(cardTips) || 0) + (parseFloat(otherTips) || 0);
    if (total <= 0) {
      alert('Total tips must be greater than 0.');
      return;
    }

    setLoading(true);

    const settingsRes = await api.getTipsSettings(branch);
    const settings = settingsRes.success && settingsRes.data?.length > 0 ? settingsRes.data[0] : null;
    if (!settings) {
      alert('Tips settings not configured for this branch. Please go to Branch Settings first.');
      setLoading(false);
      return;
    }

    const empRes = await api.getEmployeesForTips(branch);
    if (!empRes.success || !empRes.data || empRes.data.length === 0) {
      alert('No active employees found in this branch.');
      setLoading(false);
      return;
    }

    // EXCLUDE KITCHEN STAFF (they get tips via the Pool later)
    const floorEmployees = empRes.data.filter((e: any) => e.department !== 'Kitchen' || (e.first_name + ' ' + e.last_name).toLowerCase().includes('pool'));

    const user = JSON.parse(localStorage.getItem('neo_admin_user') || '{}');
    const timestamp = Date.now().toString().slice(-6);
    
    const newCollection = {
      tips_id: `TIPS-${branch.substring(0,3).toUpperCase()}-${timestamp}`,
      branch,
      date_from: dateFrom,
      date_to: dateTo,
      calculation_type: settings.calculation_type,
      total_tips: total,
      status: 'Draft',
      entered_by: user?.name || 'Admin',
      comments
    };

    const stdHours = parseFloat(settings.standard_shift_hours) || 9;
    
    const distribution = floorEmployees.map((emp: any) => {
      let expectedHours = 0;
      const dDaily = parseFloat(emp.default_daily_hours) || stdHours;
      const dDays = parseFloat(emp.working_days_per_week) || 6;

      if (settings.calculation_type === 'Daily') {
        expectedHours = dDaily;
      } else if (settings.calculation_type === 'Weekly') {
        expectedHours = dDaily * dDays;
      } else if (settings.calculation_type === 'Monthly') {
        expectedHours = dDaily * dDays * 4.33; 
      }

      return {
        employee_id: emp.employee_id,
        employee_name: emp.first_name + ' ' + emp.last_name,
        branch: emp.branch,
        expected_hours: expectedHours.toFixed(1),
        actual_hours_worked: expectedHours.toFixed(1), 
        calculated_factor: Number(emp.tip_factor === null || emp.tip_factor === undefined ? 1.0 : emp.tip_factor),
        tip_amount: 0,
        status: 'Pending'
      };
    });

    const createRes = await api.createTipsCollection(newCollection, distribution);
    setLoading(false);
    
    if (createRes.success && createRes.data) {
      navigate(`/tips/distribution/${createRes.data.id}`);
    } else {
      alert(createRes.error || 'Failed to create tips collection.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: '40px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/tips')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', backgroundColor: 'var(--background)' }}>
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a' }}>Create Tips Collection</h1>
        </div>
      </div>

      <form onSubmit={handleNext} style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div>
          <label style={labelStyle}>Branch *</label>
          <select style={inputStyle} value={branch} onChange={e => setBranch(e.target.value)} required>
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Date From *</label>
            <input type="date" style={inputStyle} value={dateFrom} onChange={e => setDateFrom(e.target.value)} required />
          </div>
          <div>
            <label style={labelStyle}>Date To *</label>
            <input type="date" style={inputStyle} value={dateTo} onChange={e => setDateTo(e.target.value)} required />
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-muted)' }}>Enter Tip Amounts</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Cash ($)</label>
              <input type="number" style={inputStyle} value={cashTips} onChange={e => setCashTips(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Card ($)</label>
              <input type="number" style={inputStyle} value={cardTips} onChange={e => setCardTips(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Other ($)</label>
              <input type="number" style={inputStyle} value={otherTips} onChange={e => setOtherTips(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div style={{ marginTop: '16px', fontSize: '16px', fontWeight: 700, textAlign: 'right' }}>
            Total: <span style={{ color: 'var(--success)' }}>${((parseFloat(cashTips)||0) + (parseFloat(cardTips)||0) + (parseFloat(otherTips)||0)).toFixed(2)}</span>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Comments / Notes</label>
          <textarea style={{...inputStyle, height: '80px'}} value={comments} onChange={e => setComments(e.target.value)} placeholder="Optional comments..." />
        </div>

        <button 
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '12px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', marginTop: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
        >
          {loading ? <Loader2 className="spin" size={20} /> : 'Calculate Distribution'}
        </button>

      </form>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' };
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '15px', fontFamily: 'inherit' };
