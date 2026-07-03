import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Search, Plus, Loader2, Users } from 'lucide-react';

export default function EmployeesScreen() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const res = await api.getEmployees();
    if (res.success && res.data) {
      setEmployees(res.data);
    }
    setLoading(false);
  };

  const filtered = employees.filter(e => 
    `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={28} style={{ color: 'var(--primary)' }} /> Employees
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Manage staff profiles, roles, departments, and payroll basics.
          </p>
        </div>
        <button 
          onClick={() => navigate('/employees/new')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={20} /> Add Employee
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <Search size={20} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
        <input 
          type="text" 
          placeholder="Search by name or department..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '16px' }}
        />
      </div>

      <div style={{ flex: 1, backgroundColor: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
            <Loader2 size={32} className="spin" style={{ color: 'var(--primary)' }} />
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', borderBottom: '2px solid var(--border)', zIndex: 1 }}>
                <tr>
                  <th style={thStyle}>Employee</th>
                  <th style={thStyle}>Branch</th>
                  <th style={thStyle}>Department</th>
                  <th style={thStyle}>Position</th>
                  <th style={thStyle}>Basic Salary</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => (
                  <tr 
                    key={emp.employee_id} 
                    onClick={() => navigate(`/employees/edit/${emp.employee_id}`)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} 
                    onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--background)'} 
                    onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#eef2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--primary)' }}>
                          {emp.first_name?.[0]}{emp.last_name?.[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{emp.first_name} {emp.last_name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{emp.is_app_user ? 'App Access: Yes' : 'No App Access'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>{emp.branch || 'N/A'}</td>
                    <td style={tdStyle}><span style={{ backgroundColor: '#e9ecef', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>{emp.department || 'N/A'}</span></td>
                    <td style={tdStyle}>{emp.position || 'Staff'}</td>
                    <td style={tdStyle}>${emp.salary || '0'}</td>
                    <td style={tdStyle}>
                      {emp.status !== 'Inactive' ? (
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>Active</span>
                      ) : (
                        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Inactive</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = { padding: '16px', color: 'var(--text-muted)', fontWeight: 600 };
const tdStyle = { padding: '16px' };
