import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Loader2, Calendar, MapPin, AlertCircle, ChefHat, Layers, CheckCircle } from 'lucide-react';

interface Menu86Item {
  name: string;
  type: 'menu' | 'ingredient';
  department?: string;
}

interface Menu86Record {
  id: string;
  branch: string;
  date: string;
  items: Menu86Item[];
  created_at: string;
  updated_at: string;
}

export default function Menu86ViewScreen() {
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState(getTodayString());
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [branches, setBranches] = useState<any[]>([]);
  const [logs, setLogs] = useState<Menu86Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch branches on mount
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await api.getBranchesList();
        if (res.success && res.data) {
          setBranches(res.data);
        }
      } catch (err: any) {
        console.error('Error fetching branches:', err);
      }
    };
    fetchBranches();
  }, []);

  // Fetch 86 logs when date or branch selection changes
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get86Logs(date, selectedBranch);
        if (res.success) {
          setLogs(res.data || []);
        } else {
          setError(res.error || 'Failed to fetch logs');
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching 86 logs');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [date, selectedBranch]);

  // Helper to render department badges
  const renderDepartmentBadge = (dept?: string) => {
    const departmentName = dept || 'Kitchen';
    let bg = '#e2e8f0';
    let color = '#475569';

    switch (departmentName.toLowerCase()) {
      case 'kitchen':
        bg = '#e8f5e9';
        color = '#2e7d32';
        break;
      case 'bar':
        bg = '#f3e5f5';
        color = '#6a1b9a';
        break;
      case 'bakery':
      case 'pastry':
        bg = '#fff3e0';
        color = '#e65100';
        break;
      case 'service':
        bg = '#e3f2fd';
        color = '#1565c0';
        break;
    }

    return (
      <span
        style={{
          marginLeft: '8px',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: bg,
          color: color,
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}
      >
        {departmentName}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '24px' }}>
      
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={28} style={{ color: 'var(--primary)' }} /> Daily "86" Missing Items
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Monitor unavailable dishes, beverages, and ingredients across all branches.
          </p>
        </div>
      </div>

      {/* Filter Panel with Glassmorphism / Subtle Shadow */}
      <div style={filterPanelStyle}>
        <div style={filterGroupStyle}>
          <label style={labelStyle}>
            <Calendar size={16} style={{ marginRight: '6px' }} />
            Select Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={filterGroupStyle}>
          <label style={labelStyle}>
            <MapPin size={16} style={{ marginRight: '6px' }} />
            Branch Location
          </label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
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

      {/* Error alert */}
      {error && (
        <div style={errorStyle}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {loading ? (
          <div style={loadingContainerStyle}>
            <Loader2 size={40} className="spin" style={{ color: 'var(--primary)' }} />
            <p style={{ marginTop: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
              Loading daily logs...
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div style={emptyCardStyle}>
            <CheckCircle size={56} style={{ color: '#10b981', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
              All Clear
            </h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '6px', maxWidth: '360px', textAlign: 'center' }}>
              No missing menu items or ingredients have been logged for this date.
            </p>
          </div>
        ) : (
          <div style={gridStyle}>
            {logs.map((log) => {
              const menuItems = (log.items || []).filter((i) => i.type === 'menu');
              const ingredients = (log.items || []).filter((i) => i.type === 'ingredient');

              return (
                <div
                  key={log.id}
                  style={cardStyle}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)';
                    e.currentTarget.style.borderColor = 'var(--primary)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'var(--shadow)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  <div style={cardHeaderStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={18} style={{ color: 'var(--primary)' }} />
                      <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                        {log.branch}
                      </h2>
                    </div>
                    <span style={timestampStyle}>
                      Updated {new Date(log.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div style={cardContentStyle}>
                    {/* Menu Items Section */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={subSectionHeaderStyle}>
                        <ChefHat size={16} style={{ color: '#0ea5e9' }} />
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#475569' }}>
                          Menu Items ({menuItems.length})
                        </h4>
                      </div>
                      {menuItems.length === 0 ? (
                        <p style={noItemsTextStyle}>None</p>
                      ) : (
                        <ul style={listStyle}>
                          {menuItems.map((item, index) => (
                            <li key={index} style={listItemStyle}>
                              <span style={{ fontWeight: 500, color: '#334155' }}>{item.name}</span>
                              {renderDepartmentBadge(item.department)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Ingredients Section */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={subSectionHeaderStyle}>
                        <Layers size={16} style={{ color: '#f59e0b' }} />
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#475569' }}>
                          Ingredients ({ingredients.length})
                        </h4>
                      </div>
                      {ingredients.length === 0 ? (
                        <p style={noItemsTextStyle}>None</p>
                      ) : (
                        <ul style={listStyle}>
                          {ingredients.map((item, index) => (
                            <li key={index} style={listItemStyle}>
                              <span style={{ fontWeight: 500, color: '#334155' }}>{item.name}</span>
                              {renderDepartmentBadge(item.department)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}



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
  transition: 'border-color 0.2s',
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
  transition: 'border-color 0.2s',
  cursor: 'pointer',
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

const loadingContainerStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  height: '240px',
};

const emptyCardStyle = {
  backgroundColor: '#ffffff',
  border: '1px dashed var(--border)',
  borderRadius: 'var(--radius)',
  padding: '48px 24px',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: 'var(--shadow)',
  marginTop: '16px',
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
  gap: '24px',
};

const cardStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow)',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
  display: 'flex',
  flexDirection: 'column' as const,
  overflow: 'hidden',
};

const cardHeaderStyle = {
  padding: '16px 20px',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#fafafb',
};

const timestampStyle = {
  fontSize: '12px',
  color: '#64748b',
};

const cardContentStyle = {
  padding: '20px',
  display: 'flex',
  gap: '20px',
  flexWrap: 'wrap' as const,
  flex: 1,
};

const subSectionHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '12px',
  paddingBottom: '6px',
  borderBottom: '1px solid #f1f5f9',
};

const noItemsTextStyle = {
  color: '#94a3b8',
  fontSize: '13px',
  fontStyle: 'italic',
  margin: '8px 0',
};

const listStyle = {
  listStyleType: 'none',
  paddingLeft: 0,
  margin: 0,
};

const listItemStyle = {
  fontSize: '13.5px',
  padding: '6px 0',
  display: 'flex',
  alignItems: 'center',
  borderBottom: '1px dashed #f1f5f9',
};
