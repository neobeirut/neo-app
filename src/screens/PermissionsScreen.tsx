import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Loader2, Shield } from 'lucide-react';

export default function PermissionsScreen() {
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const res = await api.getAllAppPermissions();
    if (res.success && res.data) {
      setPermissions(res.data);
    }
    setLoading(false);
  };

  const togglePerm = async (id: string, field: string, val: boolean) => {
    const updated = permissions.map(p => p.id === id ? { ...p, [field]: val } : p);
    setPermissions(updated);
    
    const target = updated.find(p => p.id === id);
    if (target) {
      await api.saveAppPermission(target);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a' }}>App Access Matrix</h1>
        <p style={{ color: 'var(--text-muted)' }}>Manage which departments and users can access specific app modules.</p>
      </div>

      <div style={{ flex: 1, backgroundColor: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
            <Loader2 size={32} className="spin" style={{ color: 'var(--primary)' }} />
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', borderBottom: '2px solid var(--border)', zIndex: 1 }}>
                <tr>
                  <th style={thStyle}>Entity (Dept/User)</th>
                  <th style={thStyle}>Create Orders</th>
                  <th style={thStyle}>Receive Orders</th>
                  <th style={thStyle}>Manage SOPs</th>
                  <th style={thStyle}>Fill SOPs</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Shield size={16} color="var(--primary)" />
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                        <span style={{ fontSize: '11px', backgroundColor: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>{p.type}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <input type="checkbox" checked={p.can_create_orders} onChange={e => togglePerm(p.id, 'can_create_orders', e.target.checked)} />
                    </td>
                    <td style={tdStyle}>
                      <input type="checkbox" checked={p.can_receive_orders} onChange={e => togglePerm(p.id, 'can_receive_orders', e.target.checked)} />
                    </td>
                    <td style={tdStyle}>
                      <input type="checkbox" checked={p.can_manage_checklists} onChange={e => togglePerm(p.id, 'can_manage_checklists', e.target.checked)} />
                    </td>
                    <td style={tdStyle}>
                      <input type="checkbox" checked={p.can_fill_checklists} onChange={e => togglePerm(p.id, 'can_fill_checklists', e.target.checked)} />
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
