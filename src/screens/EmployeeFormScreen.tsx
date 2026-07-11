import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ArrowLeft, Save, Loader2, Users } from 'lucide-react';
import { encryptAES, decryptAES, getStoredDecryptionKey, ENCRYPTION_ENABLED } from '../utils/cryptoHelper';

export default function EmployeeFormScreen({ user }: { user?: any }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [branch, setBranch] = useState(user?.branch || '');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [basicSalary, setBasicSalary] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [transportation, setTransportation] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [activeStatus, setActiveStatus] = useState('Active');
  const [dateStarted, setDateStarted] = useState('');
  const [pictureUrl, setPictureUrl] = useState('');
  const [idUrl, setIdUrl] = useState('');
  const [proofResidenceUrl, setProofResidenceUrl] = useState('');
  const [criminalUrl, setCriminalUrl] = useState('');
  const [ketabTaeenUrl, setKetabTaeenUrl] = useState('');
  const [dischargeUrl, setDischargeUrl] = useState('');
  const [resignationLetterUrl, setResignationLetterUrl] = useState('');
  const [isAppUser, setIsAppUser] = useState(false);
  const [productionAccess, setProductionAccess] = useState(false);

  // Reference Data
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [allBranches, setAllBranches] = useState<any[]>([]);

  // Upload State
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, [id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void, fieldName: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploadingDoc(fieldName);
    const res = await api.uploadHrDocument(file);
    if (res.success && res.path) {
      setter(res.path);
    } else {
      alert(res.error || 'Upload failed. Ensure the hr_docs bucket exists in Supabase.');
    }
    setUploadingDoc(null);
  };

  const handleViewFile = async (path: string) => {
    const res = await api.getHrSignedUrl(path);
    if (res.success && res.url) {
      window.open(res.url, '_blank');
    } else {
      alert(res.error || 'Failed to open file. Ensure the hr_docs bucket exists.');
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [deptRes, branchRes] = await Promise.all([
        api.getDepartmentsList(),
        api.getBranchesList()
      ]);
      if (deptRes.success) setAllDepartments(deptRes.data || []);
      if (branchRes.success && branchRes.data) setAllBranches(branchRes.data);

      if (isEditing && id) {
        const empRes = await api.getEmployeeById(id);
        if (empRes.success && empRes.data) {
          const emp = empRes.data;
          setFirstName(emp.first_name || '');
          setLastName(emp.last_name || '');
          setBranch(emp.branch || '');
          setDepartment(emp.department || '');
          setPosition(emp.position || '');
          setPaymentMethod(emp.payment_method || 'Cash');
          setActiveStatus(emp.status || 'Active');
          setDateStarted(emp.date_started || '');
          setPictureUrl(emp.picture_url || '');
          setIdUrl(emp.id_url || '');
          setProofResidenceUrl(emp.proof_residence_url || '');
          setCriminalUrl(emp.criminal_url || '');
          setKetabTaeenUrl(emp.ketab_taeen_url || '');
          setDischargeUrl(emp.discharge_url || '');
          setResignationLetterUrl(emp.resignation_letter_url || '');
          setIsAppUser(emp.is_app_user || false);
          setProductionAccess(emp.production_access || false);

          const savedKey = getStoredDecryptionKey(user);
          let loaded = false;

          if (ENCRYPTION_ENABLED && emp.secure_payload) {
            try {
              const rawJSON = decryptAES(emp.secure_payload, savedKey);
              if (rawJSON) {
                const decrypted = JSON.parse(rawJSON);
                setBasicSalary(decrypted.salary?.toString() || '');
                setPhone(decrypted.phone || '');
                setEmergencyContact(decrypted.emergency_contact || '');
                setBankAccount(decrypted.bank_account || '');
                setTransportation(decrypted.transportation?.toString() || '');
                loaded = true;
              }
            } catch (e) {
              console.error(e);
            }
          }

          if (!loaded) {
            if (emp.secure_payload && emp.salary == null && !emp.phone) {
              try {
                const rawJSON = decryptAES(emp.secure_payload, savedKey);
                if (rawJSON) {
                  const decrypted = JSON.parse(rawJSON);
                  setBasicSalary(decrypted.salary?.toString() || '');
                  setPhone(decrypted.phone || '');
                  setEmergencyContact(decrypted.emergency_contact || '');
                  setBankAccount(decrypted.bank_account || '');
                  setTransportation(decrypted.transportation?.toString() || '');
                  loaded = true;
                }
              } catch (e) {}
            }
            if (!loaded) {
              setBasicSalary(emp.salary?.toString() || '');
              setPhone(emp.phone || '');
              setEmergencyContact(emp.emergency_contact || '');
              setBankAccount(emp.bank_account || '');
              setTransportation(emp.transportation?.toString() || '');
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !branch) {
      alert('First Name, Last Name, and Branch are required.');
      return;
    }

    const savedKey = getStoredDecryptionKey(user);
    setSaving(true);

    let securePayloadText: string | null = null;
    if (ENCRYPTION_ENABLED) {
      const sensitiveData = {
        salary: basicSalary ? Number(basicSalary) : null,
        transportation: transportation ? Number(transportation) : null,
        phone: phone || '',
        emergency_contact: emergencyContact || '',
        bank_account: bankAccount || ''
      };
      securePayloadText = encryptAES(JSON.stringify(sensitiveData), savedKey);
    }

    const payload = {
      employee_id: isEditing ? id : undefined,
      first_name: firstName,
      last_name: lastName,
      branch,
      department,
      position,
      status: activeStatus,
      payment_method: paymentMethod,
      date_started: dateStarted || new Date().toISOString().split('T')[0],
      picture_url: pictureUrl,
      id_url: idUrl,
      proof_residence_url: proofResidenceUrl,
      criminal_url: criminalUrl,
      ketab_taeen_url: ketabTaeenUrl,
      discharge_url: dischargeUrl,
      resignation_letter_url: resignationLetterUrl,
      is_app_user: isAppUser,
      production_access: productionAccess,
      secure_payload: securePayloadText,
      salary: ENCRYPTION_ENABLED ? null : (basicSalary ? Number(basicSalary) : null),
      transportation: ENCRYPTION_ENABLED ? null : (transportation ? Number(transportation) : null),
      phone: ENCRYPTION_ENABLED ? '' : (phone || ''),
      emergency_contact: ENCRYPTION_ENABLED ? '' : (emergencyContact || ''),
      bank_account: ENCRYPTION_ENABLED ? '' : (bankAccount || '')
    };

    const res = await api.saveEmployee(payload);
    setSaving(false);
    if (res.success) {
      navigate('/employees');
    } else {
      alert(res.error || 'Failed to save employee.');
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="spin" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: '40px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/employees')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', backgroundColor: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users size={28} style={{ color: 'var(--primary)' }} /> {isEditing ? 'Edit Employee' : 'New Employee'}
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
              {isEditing ? 'Update profile details, position, and uploaded documents.' : 'Register a new employee profile and document records.'}
            </p>
          </div>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer' }}
        >
          {saving ? <Loader2 size={20} className="spin" /> : <Save size={20} />}
          Save Employee
        </button>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* App Access Panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ padding: '16px', backgroundColor: '#e9f5e9', borderRadius: 'var(--radius)', border: '1px solid #c8e6c9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#2e7d32' }}>App User Access</div>
              <div style={{ fontSize: '12px', color: '#4caf50' }}>Allows login to the mobile app.</div>
            </div>
            <input type="checkbox" checked={isAppUser} onChange={e => setIsAppUser(e.target.checked)} style={{ width: '20px', height: '20px' }} />
          </div>

          <div style={{ padding: '16px', backgroundColor: '#e3f2fd', borderRadius: 'var(--radius)', border: '1px solid #b6d4fe', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#0d6efd' }}>Production Access</div>
              <div style={{ fontSize: '12px', color: '#0a58ca' }}>Can view protected recipes.</div>
            </div>
            <input type="checkbox" checked={productionAccess} onChange={e => setProductionAccess(e.target.checked)} style={{ width: '20px', height: '20px' }} />
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ gridColumn: '1 / -1' }}><h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Personal Info</h3></div>
          
          <div>
            <label style={labelStyle}>First Name *</label>
            <input style={inputStyle} value={firstName} onChange={e => setFirstName(e.target.value)} required />
          </div>
          <div>
            <label style={labelStyle}>Last Name *</label>
            <input style={inputStyle} value={lastName} onChange={e => setLastName(e.target.value)} required />
          </div>
          
          <div style={{ gridColumn: '1 / -1', marginTop: '16px' }}><h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Employment Details</h3></div>

          <div>
            <label style={labelStyle}>Branch *</label>
            <select style={inputStyle} value={branch} onChange={e => setBranch(e.target.value)} required>
              <option value="">Select Branch...</option>
              {allBranches.map((b: any) => <option key={b.id || b.name} value={b.name}>{b.name}</option>)}
            </select>
          </div>
          
          <div>
            <label style={labelStyle}>Department</label>
            <select style={inputStyle} value={department} onChange={e => setDepartment(e.target.value)}>
              <option value="">Select Department...</option>
              {allDepartments.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Position</label>
            <input style={inputStyle} value={position} onChange={e => setPosition(e.target.value)} placeholder="e.g. Head Chef" />
          </div>

          <div>
            <label style={labelStyle}>Basic Salary ($)</label>
            <input type="number" style={inputStyle} value={basicSalary} onChange={e => setBasicSalary(e.target.value)} />
          </div>
          
          <div>
            <label style={labelStyle}>Transportation ($)</label>
            <input type="number" style={inputStyle} value={transportation} onChange={e => setTransportation(e.target.value)} />
          </div>
          
          <div>
            <label style={labelStyle}>Payment Method</label>
            <select style={inputStyle} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
          
          <div>
            <label style={labelStyle}>Bank Account Info</label>
            <input style={inputStyle} value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="IBAN or Account #" />
          </div>

          <div>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={activeStatus} onChange={e => setActiveStatus(e.target.value)}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '16px' }}><h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Contact & Additional Info</h3></div>

          <div>
            <label style={labelStyle}>Phone Number</label>
            <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          
          <div>
            <label style={labelStyle}>Emergency Contact</label>
            <input style={inputStyle} value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} />
          </div>
          
          <div>
            <label style={labelStyle}>Date Started</label>
            <input type="date" style={inputStyle} value={dateStarted} onChange={e => setDateStarted(e.target.value)} />
          </div>
          
          <div></div> {/* Empty div for grid alignment */}

          <div style={{ gridColumn: '1 / -1', marginTop: '16px' }}><h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Documents & HR Files</h3></div>

          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {[
              { label: 'Profile Picture', value: pictureUrl, setter: setPictureUrl, key: 'pic' },
              { label: 'ID/Passport', value: idUrl, setter: setIdUrl, key: 'id' },
              { label: 'Proof of Residence', value: proofResidenceUrl, setter: setProofResidenceUrl, key: 'residence' },
              { label: 'Criminal Record', value: criminalUrl, setter: setCriminalUrl, key: 'criminal' },
              { label: 'Ketab Taeen', value: ketabTaeenUrl, setter: setKetabTaeenUrl, key: 'ketab' },
              { label: 'Discharge Form', value: dischargeUrl, setter: setDischargeUrl, key: 'discharge' },
              { label: 'Resignation Letter', value: resignationLetterUrl, setter: setResignationLetterUrl, key: 'resignation' }
            ].map(doc => (
              <div key={doc.key} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--background)' }}>
                <label style={{...labelStyle, marginBottom: 0}}>{doc.label}</label>
                {doc.value ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
                    <button 
                      type="button" 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleViewFile(doc.value); }} 
                      style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '12px', color: '#0d6efd', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', textDecoration: 'underline' }}
                      title={doc.value}
                    >
                      View File
                    </button>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); doc.setter(''); }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input type="file" onChange={(e) => handleFileUpload(e, doc.setter, doc.key)} disabled={uploadingDoc === doc.key} style={{ display: 'block', width: '100%', padding: '6px', fontSize: '12px' }} />
                    {uploadingDoc === doc.key && <span style={{ position: 'absolute', right: '10px', top: '8px', fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>Uploading...</span>}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>

      </form>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' };
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '15px', fontFamily: 'inherit' };
