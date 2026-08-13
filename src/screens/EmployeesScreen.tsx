import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Search, Plus, Loader2, Users, ShieldAlert, KeyRound } from 'lucide-react';
import { decryptAES, getStoredDecryptionKey, ENCRYPTION_ENABLED } from '../utils/cryptoHelper';

export default function EmployeesScreen({ user }: { user?: any }) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Decryption Key States
  const [decryptionKey, setDecryptionKey] = useState<string>('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');

  useEffect(() => {
    const autoKey = getStoredDecryptionKey(user);
    setDecryptionKey(autoKey);
    fetchData(autoKey);
  }, [user]);

  const handleSaveKey = () => {
    if (!keyInput.trim()) {
      alert('Please enter a valid decryption key.');
      return;
    }
    localStorage.setItem('flow_decryption_key', keyInput);
    setDecryptionKey(keyInput);
    setShowKeyModal(false);
    fetchData(keyInput);
  };

  const fetchData = async (keyToUse: string) => {
    setLoading(true);
    const res = await api.getEmployees();
    if (res.success && res.data) {
      // Map sensitive data locally based on encryption status
      const mapped = res.data.map((emp: any) => {
        const decryptedEmp = { ...emp };
        let loaded = false;

        if (ENCRYPTION_ENABLED && emp.secure_payload) {
          try {
            const rawJSON = decryptAES(emp.secure_payload, keyToUse);
            if (rawJSON) {
              const decryptedFields = JSON.parse(rawJSON);
              decryptedEmp.salary = decryptedFields.salary;
              decryptedEmp.phone = decryptedFields.phone;
              decryptedEmp.emergency_contact = decryptedFields.emergency_contact;
              decryptedEmp.bank_account = decryptedFields.bank_account;
              decryptedEmp.transportation = decryptedFields.transportation;
              decryptedEmp.isDecrypted = true;
              loaded = true;
            } else {
              decryptedEmp.isDecrypted = false;
            }
          } catch (e) {
            decryptedEmp.isDecrypted = false;
          }
        }

        if (!loaded) {
          // Fallback if encrypted payload exists but raw columns are null
          if (emp.secure_payload && emp.salary == null && !emp.phone) {
            try {
              const rawJSON = decryptAES(emp.secure_payload, keyToUse);
              if (rawJSON) {
                const decryptedFields = JSON.parse(rawJSON);
                decryptedEmp.salary = decryptedFields.salary;
                decryptedEmp.phone = decryptedFields.phone;
                decryptedEmp.emergency_contact = decryptedFields.emergency_contact;
                decryptedEmp.bank_account = decryptedFields.bank_account;
                decryptedEmp.transportation = decryptedFields.transportation;
              }
            } catch (e) {}
          }
          decryptedEmp.isDecrypted = true;
        }

        return decryptedEmp;
      });
      setEmployees(mapped);
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
            Manage staff profiles, roles, departments, and payroll basics{ENCRYPTION_ENABLED ? ' (Zero-Knowledge AES Encrypted)' : ''}.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {ENCRYPTION_ENABLED && (
            <button
              onClick={() => {
                setKeyInput(decryptionKey);
                setShowKeyModal(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer' }}
            >
              <KeyRound size={18} /> Change Decryption Key
            </button>
          )}
          <button 
            onClick={() => navigate('/employees/new')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={20} /> Add Employee
          </button>
        </div>
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
                    <td style={tdStyle}>
                      {emp.isDecrypted ? (
                        `$${emp.salary || '0'}`
                      ) : (
                        <span style={{ color: 'var(--danger)', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          🔒 Encrypted
                        </span>
                      )}
                    </td>
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

      {/* Decryption Key Request Modal */}
      {showKeyModal && (
        <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={22} color="var(--primary)" /> Decryption Passphrase Required
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '20px', marginBottom: '16px' }}>
              To load and display sensitive payroll parameters, please input your **Secret Restaurant Decryption Passphrase**. This key resides locally in your browser.
            </p>
            <input
              type="password"
              placeholder="Enter Private Decryption Key"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={handleSaveKey}
                style={{ padding: '10px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}
              >
                Submit Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = { padding: '16px', color: 'var(--text-muted)', fontWeight: 600 };
const tdStyle = { padding: '16px' };
